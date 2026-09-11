Created by 黄杨波, last modified on 十二月 20, 2023

#   [YDBRD-13428 : 集群全局锁管理方案设计](#ydbrd-13428--集群全局锁管理方案设计)  

  [https://jira.yasdb.com/browse/YDBRD-13428](https://jira.yasdb.com/browse/YDBRD-13428)  

##   [1. Overview（概述）](#1-overview概述)  

单机下只有一个节点，内存全局可见。集群下存在多个写节点，节点之间需要进行并发控制。GLS提供了集群下的全局并发控制的锁服务。GLS提供了互斥和读写两种模式的锁，其全局锁资源依托于GRC模块进行管理，GRC模块将资源在节点之间进行分布，当节点A需要获取锁A时，需要向GLS模块发起加锁请求，当获取了对应的锁后，为了性能起见，会将获取的锁状态缓存在本地，当节点需要再次获取该锁时，无需请求锁资源的master节点。当节点B也需要获取该锁时，如果锁状态相容，无需处理节点A缓存的锁A的状态，如果锁状态不相容，需要等待节点A释放锁，并且之后清除节点A缓存的锁A状态。

##   [2. Features（功能特性）](#2-features功能特性)  

互斥锁(Mutex Lock)：同一时刻只能有一个实例持有该全局锁，此时其他实例被阻塞直至该实例完成业务释放Mutex Lock

1. 多实例并发create user/segment/extent
1. 多实例并发进行interval分区拓展
1. 多实例并发create/drop/alter tablespace


读写锁(X/S Lock)：执行dml操作会获取Gls S Lock，执行ddl操作会获取Gls X Lock

1. 多实例dml并发
1. 多实例dml/ddl并发
1. 多实例ddl并发


##   [3. Interfaces（接口）](#3-interfaces接口)  

1. 集群的GLS Lock总量受单机配置参数LOCK_POOL_SIZE控制
1. 提供V$GLS_LOCK查询当前实例本地缓存的所有GLS Lock信息(全局锁ID、全局锁TYPE、全局资源ID、全局锁状态、本地锁状态、共享锁持有者数量、持有排他锁的XRM XID)
1. 函数接口


|name|Meaning|
|---|---|
|glsInit|初始化gls内存|
|glsDestory|销毁gls内存|
|AXC_CB->axcLockMutex|申请Gls Mutex Lock|
|AXC_CB->axcUnlockMutex|释放Gls Mutex Lock|
|AXC_CB->axcLockRWLock|申请S/X Lock(用于user等对象)|
|AXC_CB->axcUnlockRWLock|释放S/X Lock(用于user等对象)|
|AXC_CB->axcLockTable|申请table S/X Lock|


1. 消息接口


|name|function|Meaning|
|---|---|---|
|MSG_REQ_MASTER_LOCK|msgReqMasterLock|requester向master发送请求gls lock msg|
|MSG_GRANT_LOCK_ACK|msgGrantLockAck|master向requester发送授权gls lock msg|
|MSG_CLOSE_REQ_LOCK|msgCloseReqLock|requester向master发送关闭请求msg|
|MSG_BROADCAST_UNLOCK|msgBroadcastUnlock|master向owner发送释放gls lock msg|
|MSG_UNLOCK_ACK|msgUnlockAck|owner向master发送释放gls lock成功msg|
|MSG_DEGRADE_GRC_LOCK|msgUnlockAck|owner向master发送X->S降级成功msg|
|MSG_WAIT_UNLOCK_TIMEOUT|msgWaitUnlockTimeout|owner向master发送释放gls lock超时msg|
|MSG_REQ_LOCK_TIMEOUT|msgReqLockTimeout|master向requester发送req gls lock超时msg|
|MSG_REQ_LOCK_OCCUR_DEADLOCK|msgReqLockOccurDeadLock|master向requester发送req gls lock出现死锁msg|
|MSG_REQ_RELEASE_LOCK|msgReqMasterLock|requester向master发送释放gls lock msg|
|MSG_GRANT_RELEASE_LOCK|msgGrantLockAck|master向requester发送授权释放gls lock msg|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

```
   typedef struct StGLSArea {
    CodUint32       bucketCnt;
    GrmBucket*      buckets;
    GlsLockPool     lock;
} GlsArea;

```

```
typedef struct StGlsLockPool {
    SpinLock  lock;
    CodUint32 count;
    CodUint32 hwm;
    IdList    freeList;
    GlsLock*  items;
} GlsLockPool;

```

```
typedef struct StGlsLock {
    CodUint32          id;            // unit id in local gls lock area
    CodUint32          bucketNext;    // hash list next when allocated
    CodUint32          freeListNext;  // free list next when freed
    LockId             lockId;        // lock id identify a global lock in grc
    SpinLock           lock;
    CodUint8           mode;          // lock mode acqired from grc
    CodUint8           status;        // used in rwlock only
    volatile CodUint16 shareCount;    // used in rwlock only
    volatile CodUint16 xrmid;
    volatile CodBool   locking;
    volatile CodBool   isRecycling;
    volatile CodBool   invalid;
    CodUint32          refCount;
} GlsLock;

```

###   [5.2 内存管理](#52-内存管理)  

####   [5.2.1 内存组成](#521-内存组成)  

如下图所示，整个cluster->gls内存由两部分组成

第一部分为hash bucket桶，用于根据glsLockId hash查找gls lock，bucket Count为kernel->lockPool.count * 2

第二部分为GlsLockPool，其主要分为两部分内容。第一部分是lock items，这个数组直接存储着每个gls lock内存，其大小为一整块预分配的内存，不支持拓展。其管理的gls lock总量与kernel->lockPool.count一致

kernel->lockPool.count通过LOCK_POOL_SIZE配置参数管理，该值默认为32M，kernel->lockPool.count = LOCK_POOL_SIZE / sizeof(ankLock)，缺省状态下kernel->lockPool.count =  (32 * 1024 * 1024) / 24 = 1,398,101

GlsLockPool的第二部分为freeList，用于对glsLock进行内存回收复用

![](https://pingcode.yasdb.com/atlas/files/public/67396a328970c2af4f51fcff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

####   [5.2.2 内存申请及回收](#522-内存申请及回收)  

#####   [5.2.2.1 内存申请：](#5221-内存申请)  

1. 当一个前台线程申请gls lock的时候，先在bucket查找之前是否有同样lockId的内存
1. （1）如果没有，则申请分配一个gls lock内存出来。分配内存优先从lock items数组中的hwm往后申请空余的内存，如果lock items的hwm被推至最高，则无法直接使用空余内存。此时尝试遍历freeList查找是否有可以回收的gls lock内存(一般来说是必然会有的，如果freeList中所有的gls lock都处于不能回收的状态，则返回报错稍后重试)，分配好内存出来后，refCount++(此标志代表此时前台线程对该gls lock的引用次数)
1. （2）如果有，需要识别两个情况。如果gls lock不处于isRecycling，则可以使用这个gls lock内存，refCount++去使用即可；如果gls lock处于isRecycling，则该gls lock无法使用，此时不能直接去申请分配一个新的gls lock内存出来使用，需要等待整个同lockId的gls lock淘汰回收完成才可以申请分配gls lock内存出来使用(这里等待的原因主要是处理同lockId的淘汰和申请在grc master处的并发)。
1. 当前台线程获取到一个gls lock出来时，就正常走申请gls lock逻辑，整个过程refCount保持不变
1. 当线程使用完gls lock后，释放gls lock时，先释放gls lock→status，随后refCount--


#####   [5.2.2.2 内存回收(当前内存回收方案只针对已经实现并适配的gls lock type，后续如果新增type的内存回收标准与现有类型一致)：](#5222-内存回收当前内存回收方案只针对已经实现并适配的gls-lock-type后续如果新增type的内存回收标准与现有类型一致)  

GLS LOCK TYPE：

1. LOCK_TYPE_OBJECT：表锁的集群化对应的gls lock type。此类型在不开启回收站drop table/开启回收站drop table带purge下，是可以确保oid+LOCK_TYPE_OBJECT不会再有人使用，此种类型＋场景列入内存回收项
1. LOCK_TYPE_SEGMENT：并发创建segment、同步btree cache的sipnLock集群化。此种类型与表锁进行绑定，因为使用的也是表oid，只是类型不一样，在1场景被纳入内存回收项后，此项会作为附带属性一同遍历纳入内存回收项
1. LOCK_TYPE_SEGMENT_EXTEND：并发进行segment拓展。此种类型与表锁进行绑定，因为使用的也是表oid，只是类型不一样，在1场景被纳入内存回收项后，此项会作为附带属性一同遍历纳入内存回收项
1. LOCK_TYPE_INTERVAL_EXTEND：并发interval分区拓展spinLock集群化。此种类型与表锁进行绑定，因为使用的也是表oid，只是类型不一样，在1场景被纳入内存回收项后，此项会作为附带属性一同遍历纳入内存回收项
1. LOCK_TYPE_USER：user latch锁的集群化。由于user profileId存在复用机制，如果drop user后，该profileId+LOCK_TYPE_USER仍有可能被使用，此种类型不作为内存回收项
1. LOCK_TYPE_SYSTEM：spinLock的集群化。目前用于控制并发创建user/tablespace。此种类型的Mutex Lock是作为常驻ID存在的，不作为内存回收项
1. LOCK_TYPE_SPC_EXTENT：表空间并发extent拓展spinLock集群化。此种类型涉及tablespace id。由于tablespace与user一样存在槽位复用机制，drop tablesapce后，该space→id+LOCK_TYPE_EXT仍有可能被使用，此种类型不作为内存回收项


回收方案及流程：

1. 当某个gls lock内存需要回收时，将其打上invalid失效标记，并将该gls lock内存挂到freeList链上，代表该lock是失效的。对于gls lock的内存，这里采用的是双链管理，虽然此时gls lock被挂到了freeList链上，但并没有将其从hash bucket上摘掉，因为虽然这个gls lock是失效的，但当前实例可能会有前台线程正在持有这个内存，及refCount > 0，且如果这个gls lock是有mode的，代表这个实例是某个lockId的gls lock owner，此时需要保证集群下所有实例都能看到这个gls lock
1. 当申请gls lock内存不足时，需要遍历freeList寻找可被复用的gls lock内存，一个gls lock是否从freeList上摘掉并复用有以下几个标准：
1. （1）没有mode && invalid && refCount == 0。设置isRecycling后，将其从freeList摘除，并删除其在hash bucket原来的位置，根据新的gls lockId insert到新的hash bucket中
1. （2）没有mode && invalid && refCount > 0。有前台线程正在req master gls lock，还没有获得grant，需要等待线程获取完gls lock并释放后才能回收，但一般不等待完成，直接跳过，遍历freeList后面的gls lock，稍后重试的时候就可以淘汰了
1. （3）有mode && invalid && refCount == 0。则代表此时gls lock空闲，设置isRecycling，此时可以走grc向master申请注销owner，注销完成后将其从freeList摘除，并删除其在hash bucket原来的位置，根据新的gls lockId insert到新的hash bucket中
1. （4）有mode && invalid && refCount > 0。则代表此时有线程正在使用或等待gls lock，此时不能回收，需等待线程放锁才能回收，但一般不等待完成，直接跳过，遍历freeList后面的gls lock，稍后重试的时候就可以淘汰了
1. （5）isRecycling && invalid，当前该gls lock正在被回收，不可以被二次回收，需跳过该gls lock往下遍历
1. 内存回收场景列举
1. （1）在确保某个id+type的gls lock在后续不会再被使用时，需要将其列入内存回收项，目前只有表这个类型才会出现需要回收的场景，且对于表而言，需要同时失效oid + LOCK_TYPE_OBJECT / LOCK_TYPE_SEGMENT / LOCK_TYPE_SEGMENT_EXTEND / LOCK_TYPE_INTERVAL_EXTEND。失效gls lock的第一个场景为为广播失效表的entry和dc，即msgDropTale，如下图所示：
1. （2）第二个场景主要是为了解决并发问题。删除对象广播给对应的oid+type的gls lock打invalid失效标记并迁移到freeList时，假设其他实例有前台线程正在申请gls oid+type lock，但还没有申请出内存，此时广播打invalid失效标记并迁移gls lock到freeList的操作已经遍历过这个bucket，这就会出现有部分gls oid+type lock没有打invalid失效标记并迁移到freeList。解决方案：在前台线程获取到gls lock并检测到本地对象失效时，判断自己是否有invalid失效标记，若无则打上标记并迁移到freeList中


![](https://pingcode.yasdb.com/atlas/files/public/67396a328970c2af4f51fd01/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

在axcInvalidateGlsLocks中，会根据传入的objectId + type自动遍历该objectId涉及到的所有需要失效的gls type，查找该实例上是否存在object+type的gls lock内存，如果存在则将其失效，并挂到freeList上。此时gls lock内存同时存在与freeList和hash bucket两条链上，如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396a32a1ad9a3311dc7b79/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

在内存申请不足，需要recycle freeList上的gls lock时，对freeList进行遍历，直到找到符合recycle标准的gls lock进行淘汰回收并复用，如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396a328970c2af4f51fd04/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

###   [5.3 获取Gls Lock场景列举](#53-获取gls-lock场景列举)  

获取Mutex Lock：

1.如果本地有可复用的lock->mode(Exclusive)，直接复用lock→mode(Exclusive)，无需request master

2.如果本地无可复用的lock→mode，request master获取lock

 （1）如果此时集群内没有其他instance持有此lock，即ownercount=0，有以下两种交互场景：

           request与master是同一节点，则master直接授权，无需消息传递

           request与master不是同一节点，reques master：

![](https://pingcode.yasdb.com/atlas/files/public/67396a328970c2af4f51fd05/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           MSG_REQ_MASTER_LOCK异常：由request的axcCall感知超时并进行消息重发，master处接收重试消息重新处理

           MSG_GRANT_LOCK_ACK异常：由request的axcCall感知超时并进行消息重发，master处接收重试消息重新处理，并基于上一次的情况重新发送授权消息

           MSG_CLOSE_REQ_LOCK异常：由master的消息等待队列中消息触发该消息的request超时重发消息到master处提醒master感知闭环消息丢失，并到currReq的request处提醒重发闭环消息

 （2）如果此时集群内有其他instance持有此lock，即ownercount=1(因为Mutex Lock是排他锁，最多只能有1个Xowner)，有以下两种交互场景：

           request与master是同一节点，owner与master不是同一节点：

![](https://pingcode.yasdb.com/atlas/files/public/67396a32a1ad9a3311dc7b7b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           MSG_BROADCAST_UNLOCK异常：由request/master处的axcRecv感知超时重试，并根据第一轮的广播情况进行第二轮广播

           MSG_UNLOCK_ACK异常：由request/master处的axcRecv感知超时重试，并根据第一轮的广播情况进行第二轮广播，且request/master处会识别处同一owner多次广播产生的不同ack，只处理最新的ack

           request与master不是同一节点，owner与master是同一节点/owner与master不是同一节点：

![](https://pingcode.yasdb.com/atlas/files/public/67396a32a1ad9a3311dc7b7c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           MSG_REQ_MASTER_LOCK异常：由request的axcCall感知超时并进行消息重发，master处接收重试消息重新处理

           MSG_BROADCAST_UNLOCK异常：由request的axcCall感知超时并进行消息重发，master处接收重试消息并基于上次广播的处理情况重新广播

           MSG_UNLOCK_ACK异常：由request的axcCall感知超时并进行消息重发，master处接收重试消息并基于上次广播的处理情况重新广播，且master处会识别处同一owner多次广播产生的不同ack，只处理最新的ack

           MSG_GRANT_LOCK_ACK异常：由request的axcCall感知超时并进行消息重发，master处接收重试消息重新处理，并基于上一次的情况重新发送授权消息

           MSG_CLOSE_REQ_LOCK异常：由master的消息等待队列中消息触发该消息的request超时重发消息到master处提醒master感知闭环消息丢失，并到currReq的request处提醒重发闭环消息

获取RWLockShared：

1.如果本地有可复用的lock->mode(Exclusive/Shared)，直接复用lock→mode(Exclusive/Shared)，无需request master

2.如果本地无可复用的lock→mode，request master获取lock

（1）如果此时集群内没有其他instance持有此lock，即ownercount=0，有以下两种交互场景：

           request与master是同一节点，则master直接授权，无需消息传递

           request与master不是同一节点，reques master：

![](https://pingcode.yasdb.com/atlas/files/public/67396a328970c2af4f51fd06/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           消息异常同获取Mutex Lock的2.(1)场景中的异常情况

（2）如果此时集群内有其他instance持有此lock，即ownercount>=1(1个Xowner/多个Sowner)，有以下两种交互场景：

           request与master是同一节点，owner与master不是同一节点（这里如果要广播解锁的话，owner必定只有一个，因为如果上共享锁需要广播解锁的话，说明此时集群内有节点持有X锁，而X锁存在时，只有一个owner）：

![](https://pingcode.yasdb.com/atlas/files/public/67396a32a1ad9a3311dc7b7d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           消息异常同获取Mutex Lock的2.(2)第一个场景中的异常情况，其中MSG_DEGRADE_GRC_LOCK异常处理方式和MSG_UNLOCK_ACK一致

           request与master不是同一节点，owner与master是同一节点/owner与master不是同一节点：

![](https://pingcode.yasdb.com/atlas/files/public/67396a32a1ad9a3311dc7b7e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           消息异常同获取Mutex Lock的2.(2)第二个场景中的异常情况，其中MSG_DEGRADE_GRC_LOCK异常处理方式和MSG_UNLOCK_ACK一致

获取RWLockExclusive：

1.如果本地有可复用的lock->mode(Exclusive)，直接复用lock→mode(Exclusive)，无需request master

2.如果本地无可复用的lock→mode，request master获取lock

（1）如果此时集群内没有其他instance持有此lock，即ownercount=0/1(直接获取X锁/锁升级)，有以下两种交互场景：

           request与master是同一节点，则master直接授权，无需消息传递

           request与master不是同一节点，reques master：

![](https://pingcode.yasdb.com/atlas/files/public/67396a328970c2af4f51fd05/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           消息异常同获取Mutex Lock的2.(1)场景中的异常情况

 （2）如果此时集群内有其他instance持有此lock，即ownercount>=1（1个Xowner/多个Sowner）/ownercount>=2（包括request在内多个Sowner），有以下两种交互场景：

           request与master是同一节点：

![](https://pingcode.yasdb.com/atlas/files/public/67396a328970c2af4f51fd07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           消息异常同获取Mutex Lock的2.(2)第一个场景中的异常情况

           request与master不是同一节点：

![](https://pingcode.yasdb.com/atlas/files/public/67396a32a1ad9a3311dc7b7f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFEQUFBRUVCQUpDQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFJU2dRQUJBQUFBS0FBQUJBQUFBQUlBS0VBQUFBUUJBUUFnVUNBSUFRQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFJQWpBQVFBQUJCUUFJQkFBQUFBQUFBUVNBZ0FDQUFBQWdBQUFBQUVSQUFDQVFBQkFRQUFBQUJBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjgsImV4cCI6MTc4MjIyMjQyOH0.lRECAyQk7GUxTo5EoktRU7UhJhg8VssD6QJl6rrsiWc)

           消息异常同获取Mutex Lock的2.(2)第二个场景中的异常情况

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

可通过查询V$GLS_LOCK查询获取的gls lock信息，视图信息    [https://conf.yasdb.com/pages/viewpage.action?pageId=91775132](https://conf.yasdb.com/pages/viewpage.action?pageId=91775132)  

1. 获取gls S lock：对象dml操作(insert/update table)、登陆用户操作(yasql登陆用户)
1. 获取gls X lock：对象ddl操作(drop/alter table、drop/alter user)
1. 获取gls Mutex Lock：create/drop/alter tablespace、create user、interval分区自动拓展
1. 释放gls S lock：在该实例获取到gls S lock后，其他实例获取该gls lock的X权限
1. 释放gls X lock：在该实例获取到gls X lock后，其他实例获取该gls lock的S权限(存在锁降级的情况，不一定会释放)
1. 释放gls Mutex Lock：在该实例获取到gls Mutex Lock后，其他实例获取该gls Mutex Lock
1. 验证ddl/dml、ddl/ddl交叉并发正确性


##   [7.资料设计章节](#7资料设计章节)  

不涉及资料变动

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

recycle和故障恢复：grant/unlock msg不受grc latch控制，grc recover期间仍可以执行，存在问题，需要通过grc latch控制解决

## Attachments: