Created by 郭藏龙, last modified by  黄杨波 on 九月 04, 2024

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

全局资源在访问时，通常需要通过加锁控制并发。对于读而言虽然请求的是共享锁，但是加共享锁通常都会有spin lock的竞争，在并发较高的情况下，spin lock冲突会很大，尤其是在ARM架构下，lock引起cache line失效会导致很容易出现跨NUMA节点的内存访问，严重影响并发性能。目前识别到的主要瓶颈有两种：

- bucket lock : Data buffer中的block读访问必须要首先持有bucket lock之后，再latch block
- entry block：对表加共享锁，需要在entry lock内设置锁的状态


###   [1.2 需求分析](#12-需求分析)  

解决全局资源冲突的主要思路是将其本地化，session在访问资源时首先从本地cache搜索，如果命中的话就不需要产生全局资源争用。同时需要保证不同session访问全局资源的一致性，当资源状态发生变换时，需要失效所有session的本地缓存以保证后续可以获取最新资源。基于这些分析，session级别的资源cache需要重点考虑以下几个问题：

- 哪些资源可以cache到本地：这类资源的特点是经常被并发访问，而且需要通过读写锁控制并发，本次主要针对block lock和table lock进行优化。
- 什么情况下这些资源被cache到本地：当识别到资源有高并发读访问，而且写较少时cache到本地才有意义，否则会适得其反。（只有针对block lock才有此机制，table lock暂没有，当前是无脑cache table lock）
- 本地cache什么时候被失效：当资源状态发生变化时，本地cache应当被失效，例如当table加排他锁时，就需要失效所有的本地共享锁cache。


##   [2. 接口](#2-接口)  

###   [2.1 参数](#21-参数)  

_SESSION_CACHE_BLOCKS: 控制每个session cache block lock 的数量，br23.3默认16，master默认0（取值范围：0 - 1023）

_SESSION_CACHE_TABLES: 控制每个session cache table lock的数量，默认16（取值范围：0 - 1023）

_SESSION_BLOCK_CACHE_THRESHOLD：当某个block的shareCount大于该参数时，才会被cache到本地，默认32（取值范围：1 - 65535）

###   [2.2 动态视图](#22-动态视图)  

V$SESSION_LOCK_CACHES: 查看每个session的cache情况：

|字段|类型|说明|
|---|---|---|
|SID|INTEGER|会话ID|
|CACHE_TYPE|VARCHAR(16)|LOCK CACHE类型：TABLE CACHE、BLOCK CACHE|
|TOTAL|BIGINT|产生LOCK CACHE的总数（包含当前存在的数目以及被复用的数目）|
|HITS|BIGINT|LOCK CACHE命中次数|
|INVALIDS|BIGINT|LOCK CACHE失效次数|
|MISS|BIGINT|LOCK CACHE未命中次数|
|COUNT|BIGINT|当前LOCK CACHE的总数|


###   [2.3 统计项](#23-统计项)  

- BUFFER READ CACHE TOTAL: block lock被cache到session的总次数（包含槽位复用）
- BUFFER READ CACHE HITS: block lock cache命中的次数
- BUFFER READ CACHE INVALIDS ：block lock cache被失效的次数（包含槽位复用）
- BUFFER READ CACHE MISS : block lock cache未命中的次数
- TABLE LOCK CACHE TOTAL: table lock被cache到session的总次数 （包含槽位复用）
- TABLE LOCK CACHE HITS: table lock cache命中的次数
- TABLE LOCK CACHE INVALIDS ：table lock cache被失效的次数（包含槽位复用）
- TABLE LOCK CACHE MISS : table lock cache未命中次数


##   [3. 规格与约束](#3-规格与约束)  

- 在读写密集的场景下，session级cache可能会导致性能下降，需要进行参数调优


##   [4. 特性](#4-特性)  

###   [4.1 Lock cache](#41-lock-cache)  

session上resource cache分为两类：

- insert cache : 用于插入时空闲页面查找加速（已实现）
- btree cache: 用于btree的热块cache（已实现）
- lock cache : 用于降低全局锁冲突，目前包括block lock 和 table lock


lock cache用于表示某一类lock在session上的缓存，定义如下：

```
typedef struct StLockCache {
	LockCacheItem* items;     // cache数组
	SpinLock       lock;      // 用于添加/访问和失效的并发控制
	CodUint16      capacity;  // 总的容量
	CodUint16      current;   // 本地cache淘汰时复用的位置
    CodUint16      count;
} LockCache; 

```

每个lock cache item包含指向原始全局资源的指针以及本地cache的状态：

```
typedef struct StLockCacheItem {
	CodPointer res;   // 指向原始resource的指针
	CodUint8 status;  // 本地cache的状态
} LockCacheItem;

```

每个cache item的状态有三种：

- IDLE ：cache有效，但是当前session没有使用，下次访问时可以直接使用本地cache。
- BUSY ： cache有效，但是当前session正在使用，失效本地cache时需要等待其变为idle/invalid状态。
- INVALID ：cache无效，lock cache初始化或资源状态发生变化时，将所有session的本地资源设置为无效。


###   [4.2 Block lock cache](#42-block-lock-cache)  

对于block lock cache，lock cache item中保存的是data buffer中的ctrl指针。

Data Buffer中的block ctrl新增cache status：

```
typedef enum EnBpLocalCacheStatus {
BP_LOCAL_CACHE_NONE,    // 当前block没有被session cache
BP_LOCAL_CACHE_VALID,   // 当前block至少被一个session cache
BP_LOCAL_CACHE_COPYING, // 当前block正在作copy on write
BP_LOCAL_CACHE_INVALID, // 当前block至少被一个session cache，但是已经被失效
} BpLocalCacheStatus;

```

#####   [4.2.1 Attach Block Read](#421-attach-block-read)  

Attach block时，首先会增加根据block id从session cache中匹配block的过程，但是以下场景即使有匹配的block也不能使用cache :

- resident或者pin的方式访问：这两种访问模式调用者会将直接引用block的地址，读取时不会再重新attach block。但是cache block如果被cow之后，会导致继续引用一个旧的block。
- 读请求current block但是cache的是cr block或者cache的block不满足cr要求。（如果是CR block在bpUnlatch时并不会被加入cache，因此cr block不会被cache，也就不存在此情况）。
- 访问temp tablespace block


如果本地cache中未找到要read的block，仍然从bucket查找block。但此时找到的block有可能cache是有效状态，这时候有两种场景：

- 如果是resident或者pinned的方式访问，需要通过cow机制，latch最新的block，否则可能会导致调用者引用旧block。
- 如果非resident或者pinned，直接latch当前block即可。


#####   [4.2.2 Detach Block](#422-detach-block)  

Detach block时，需要判断是否需要将block加入到本地的session cache:

- 读锁访问的block
- 非resident和pinned的block
- 连续读访问超过阈值的block
- 非dirty或者marked block: 如果cache，cow机制会导致页面版本丢失
- 非temp tablespace block


由于将block加入到本地session需要修改全局block ctrl的cache状态，因此需要在bucket lock中修改，以免和修改为copy状态产生并发。

#####   [4.2.3 Attach Block X](#423-attach-block-x)  

Latch block时，如果cache的状态是VALID，此时有可能有并发的读访问，不能直接修改cache block。此时需要先失效原始block，copy一个新的block进行修改。具体的流程如下：

- 在bucket block内将当前ctrl的cache状态标记为BP_LOCAL_CACHE_COPYING，此时block不能被并发淘汰，也不能被并发访问。
- 释放bucket lock，申请新的block后将旧的block copy到新block，然后重新加bucket lock。（由于该block被cache，因此当前的ctrl latch是S/IDLE，因此copy出来的新的block ctrl latch不保留原来的latch关系，直接跳过等待）
- 将旧block的cache状态改为BP_LOCAL_CACHE_INVALID，并且从bucket移除（仍然处于LRU上）。
- 将新block加入到bucket中，并使用新的block继续修改。


#####   [4.2.4 Buffer淘汰](#424-buffer淘汰)  

淘汰时如果需要遇到cache非BP_LOCAL_CACHE_NONE的情况：

- 如果是BP_LOCAL_CACHE_COPYING：此时block正在被COW，不能淘汰
- 如果是BP_LOCAL_CACHE_INVALID：此时block虽然被失效，但可能有本地session仍然在使用此block，因此需要等待所有的session使用结束才能淘汰。
- 如果是BP_LOCAL_CACHE_VALID：优先将全局block设置为BP_LOCAL_CACHE_INVALID，然后转为第二种场景。


#####   [4.2.5 集群本地资源状态失效](#425-集群本地资源状态失效)  

失效资源状态的时候都使用write接口访问block，天然支持

#####   [4.2.6 并发控制](#426-并发控制)  

- add cache、latch x的ctrl cache状态判断、淘汰时的ctrl cache状态判断都是在bucket lock中进行，不会有并发问题


###   [4.3 Table lock cache](#43-table-lock-cache)  

对于table lock cache，lock cache item中保存的是entry指针。

table lock cache是指将shared lock缓存到session上，如果加shared lock时命中本地cache，那么就不需要在全局登记锁信息，从而降低entry lock的冲突。

#####   [4.3.1 lock table shared](#431-lock-table-shared)  

事务内首次加同表shared lock时，还是会先申请一个ankLock，但是在entry上登记锁信息之前会先搜索session cache，如果命中的话会将cache item设置为busy（在此期间如果有cache失效的请求，会产生表锁等待），同时将cache信息记录到lock上，用于后续的释放。如果没有命中的话，还是保持原有的加锁流程。

#####   [4.3.2 unlock table shared](#432-unlock-table-shared)  

释放shared lock时，根据lock上记录的cache信息可以判断是否使用的是本地cache的lock（ankLock的cacheSlot字段，若不是本地cahce则为ANK_MAX_RES_CACHE_COUNT）:

- 如果是：将对应的cache状态设置为idle，这样cache就可以被直接失效，不需要修改任何entry的锁信息。
- 如果不是：除了原有释放表锁的流程外，需要将表锁加入到本地cache中，同时会在entry上打上cache标记（entry->lockCached置为true），这样如果加排他锁时就能根据此标记判断是否需要失效session的本地cache。


#####   [4.3.3 lock table exclusive](#433-lock-table-exclusive)  

加表的排他锁时，会根据entry上的cache标记判断是否存在session本地cache，如果存在就需要失效本地cache:

1. 遍历所有的session，找到entry对应的lock cache
1. 如果cache是busy状态，说明共享表锁还未被释放，那么就需要等待，同时要进行表锁超时处理
1. 将idle状态的的cache设置为invalid，后续这个cache不会再被使用
1. 在确保所有cache都失效后，将entry->lockCached标记置为false


#####   [4.3.4 lock table upgrade](#434-lock-table-upgrade)  

当session持有table cache（S lock）时申请X lock进行锁升级时，在发现entry->lockCached去遍历失效所有session cache时需要跳过自己

#####   [4.3.5 dead lock detection](#435-dead-lock-detection)  

在进行死锁检测确认表锁依赖关系时，若entry schLock shareCount > 0或entry->lockCached都代表此时有session引用S lock

1. 通过cache上S lock也会分配ankLock挂在xrm上，因此checkHoldTableLock接口天然支持识别是否持有S lock（shareCount || cache）
1. 由于目前持有S lock的handler数量与entry上记的shareCount不符合，因此死锁检测不能简单判断达到shareCount数量就退出循环，而是要遍历完所有的handler


#####   [4.3.6  集群本地资源状态失效](#436--集群本地资源状态失效)  

1. unlock的时候如果本地资源状态是idle，仍然需要失效session cache
1. recycle的时候如果全局资源状态非None，那么需要失效session cache


#####   [4.3.7 并发控制](#437-并发控制)  

1. cache的search和add是由session串行执行，因为不存在并发问题。同时如果unlock table shared需要add lock cache，那么当前session本地cache中一定不存在此表锁cache，不需要额外判断。
1. 失效所有session的本地cache和add cache都是在entry lock内进行，所以不会存在并发问题。
1. 单个cache item的状态判断和修改都是在item lock中进行，所以不会存在并发问题。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

#####   [5.1 block lock cache](#51-block-lock-cache)  

1. 验证开启block cache之后，对高并发读热点数据的性能提升
1. 分别开启/关闭 block cache之后与对比TPCC性能


#####   [5.2 table lock cache](#52-table-lock-cache)  

1. 开启table cache之后，共享表锁本地缓存是否生效
1. 加排他表锁时，是否能正确失效表锁缓存


##   [6.资料设计章节](#6资料设计章节)  

视图和参数

##   [7.未来规划](#7未来规划)  

增加cache相关统计信息