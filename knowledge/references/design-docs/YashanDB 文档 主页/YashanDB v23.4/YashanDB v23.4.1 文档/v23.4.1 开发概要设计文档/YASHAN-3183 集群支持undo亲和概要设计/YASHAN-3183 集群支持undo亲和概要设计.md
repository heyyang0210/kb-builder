Created by 孟凡彬, last modified on 十一月 15, 2024

YASHAN-3183 : 集群支持undo亲和

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66cc7b844283cf23d4f3c39a](https://pingcode.yasdb.com/ship/ideas/66cc7b844283cf23d4f3c39a)    ?

  


-   [1. 总体概述](#1-总体概述)  
    -   [1.1 需求来源](#11-需求来源)  
    -   [1.2 友商调研](#12-友商调研)  
    -   [1.3 需求分析](#13-需求分析)  
    -   [1.4 数据字典](#14-数据字典)  
    -   [1.5 开源依赖](#15-开源依赖)  
-   [2. 对外接口](#2-对外接口)  
-   [3. 规格与约束](#3-规格与约束)  
-   [4. 架构设计](#4-架构设计)  
    -   [4.1 逻辑架构](#41-逻辑架构)  
    -   [4.2 流程设计](#42-流程设计)  
-   [5. 特性设计](#5-特性设计)  
    -   [5.1 数据结构设计](#51-数据结构设计)  
    -   [5.2 功能场景设计](#52-功能场景设计)  
    -   [5.3 动态视图设计](#53-动态视图设计)  
    -   [5.4 性能场景设计](#54-性能场景设计)  
    -   [5.5 安全性设计](#55-安全性设计)  
-   [6.未来规划](#6未来规划)  


##   [1. 总体概述](#1-总体概述)  

在共享集群产品形态下，每个实例具备独立的undo表空间，管理各自的事务以及undo空间分配，并且每个实例只会只会分配使用各自undo表空间，undo表空间具备一定的实例亲和性特点。

在共享集群架构下，为了协调多个实例访问、修改共享的数据，对数据的访问进行了全局控制，通过对数据块和锁进行全局资源抽象管理，通过一定的算法在多个实例间均衡管理全局资源。任一资源元数据在集群内具备唯一性，每个实例管理一部分全局资源的元数据信息。通过全局请求排队机制管理数据块以及锁资源请求，提供全局资源的并发访问控制。

###   [1.1 需求来源](#11-需求来源)  

基于当前共享集群下多实例undo亲和性特点，提出了共享集群形态下undo数据的全局资源管理要具备本地亲和性的优化诉求，进而提升undo的分配、访问效率；从功能场景来看，此优化对用户是透明的。

###   [1.2 友商调研](#12-友商调研)  

从业界视角，oracle rac与yashan集群采用类似的实例私有表空间管理，其默认支持undo亲和性管理，详细参考    [对象资源管理](https://conf.yasdb.com/pages/viewpage.action?pageId=156110813)    。

###   [1.3 需求分析](#13-需求分析)  

基于当前实例undo亲和的特点，需要设计一套全新的基于对象亲和的资源分配管理策略，减少跨节点之间全局资源的访问。当前需求需要从以下几个维度进行设计：

|类别|子类|分析|
|---|---|---|
|功能|\|当开启undo亲和性时，对当前undo表空间下的事务管理、事务访问、undo分配、一致性查询、回滚、XA等功能无影响。<br> 当开启undo亲和性时，要满足实例的在线启停、事务托管诉求。|
|DFX|可靠性|开启undo亲和性时，集群内核支持在线实例故障，对RTO有较小影响。|
||性能|开启undo亲和性时，对TPCC测试等典型性能测试的结果无影响。|
||安全性|当前特性属于全局资源管理优化类需求，  **不涉及安全相关**  。|
||易运维|需要提供一定的视图能力，用户监控、管理当前undo亲和的状态。|
||兼容性|当前只改动内存管理结构，不涉及升级。|


###   [1.4 数据字典](#14-数据字典)  

当前需求不涉及新增数据字典，考虑新增动态视图。

###   [1.5 开源依赖](#15-开源依赖)  

当前需求不依赖第三方组件。

##   [2. 对外接口](#2-对外接口)  

undo亲和对外呈现主要有两个维度：

1. 通过提供集群级隐藏参数    `_undo_affinity`    ，用户可以选择关闭undo亲和功能，通常不建议用户配置。
1. 通过提供动态视图V$GRC_AFFINITY_POLICTY呈现当前的对象亲和策略。


##   [3. 规格与约束](#3-规格与约束)  

1. undo亲和管理仅针对于实例undo表空间下管理的对象，而不是整个表空间层面。
1. undo亲和管理当前需求下仅针对的是UNDO全局资源亲和性管理，仅在集群下生效。
1. 临时表空间UNDO属于全局分配资源，不受UNDO亲和管理。
1. _undo_affinity参数需要各实例间配置一致。


##   [4. 架构设计](#4-架构设计)  

###   [4.1 逻辑架构](#41-逻辑架构)  

undo亲和需要在GRC组件中引入OHT的管理能力，引入OHT后逻辑架构变化如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ef08970c2af4f521c89/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFFQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUlBQUFJQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBRUlBQUFBQUFBQUFRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MTAsImV4cCI6MTc4MjQ2NzMxMH0.7rWqNZaayStAfWov0jQcXMGvDZiht2o9ibUTvvhqrUo)

###   [4.2 流程设计](#42-流程设计)  

引入OHT管理后，整个全局资源的访问链路需要作出调整，具体变化如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ef0a1ad9a3311dc9afa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFFQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUlBQUFJQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBRUlBQUFBQUFBQUFRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MTAsImV4cCI6MTc4MjQ2NzMxMH0.7rWqNZaayStAfWov0jQcXMGvDZiht2o9ibUTvvhqrUo)

##   [5. 特性设计](#5-特性设计)  

通过对UNDO表空间下管理的数据库资源进行抽象，定义UNDO对象，每个实例的UNDO对象具备全局唯一的dataOid。同一个表空间下的undo对象共享相同的dataOid。

当前设计属于用户自定义对象亲和特性的前置需求，需要构建完整的OHT管理能力。

###   [5.1 数据结构设计](#51-数据结构设计)  

定义OHT用以管理相关的GRC对象，每个对象具备独立的partition，用以管理此对象相关的GRC资源。

```
typedef struct StGrcObject {
    CodUint32     id;          /* hash object id */
    CodUint32     next;        /* hash list next when allocated, free list next when freed */
    CodUint64     objectId;    /* data object id */
    CodBool       isValid;
    CodUint8      master;      /* the object resources master */
    CodUint8      prevMaster;  /* previous master holding the object resources */
    CodUint8      status;      /* ght-&gt;oht, oht-&gt;oht, oht-&gt;ght, idle */
    GrcPartition* partition;   /* object resource partition, if current instance is master */
} GrcObject;

/* object hash table */
typedef struct StOhtRule {
    CodUint32   bucketCnt;          /* object hash bucket count */
    GrmBucket*  buckets;            /* bucket for object hash table */
    GrmContext  objects;            /* grc object context GrmContext&lt;GrcObject&gt;*/
    CodUint8    instMap[AXC_MAX_INSTANCES];
    GrmPool     objPool;
} OhtRule;

```

在GRC层面增加OHT rule的结构，与GHT平级，根据不同的策略到不同的rule下访问对应的资源。

```
typedef struct StGrcContext {
    Latch             latch;         // latch protecting resource concurrency access
    CodUint16         version;       // grc context version (old dht version...)
    CodUint16         unused;
    CodUint64         instMap;       // instance map for GRC

    GhtRule           ghtRule;
    OhtRule           ohtRule;

    GrcArea*          blockArea;     // block area held by current instance
    GrcArea*          nonBlockArea;  // non block area held by current instance
    GrmPool           reqPool;
    GrcRecoverManager glsrecoverM;
    GcsRcyManager     gcsRcyM;
    MigrationManager  migration;
    GcsReleaseManager gcsReleaseM;
    GrcRemaster       remaster;
} GrcContext;

```

在grc remaster阶段需要进行oht的remaster管理，引入ohtMap数据结构用以记录当前需要托管的实例oht。

```
typedef struct StGrcRemaster {
    GhtRule         ghtRule;
    CodUint64       instMap;
    CodUint16       version;
    CodUint8        ohtMap[AXC_MAX_INSTANCES];
} GrcRemaster;

```

###   [5.2 功能场景设计](#52-功能场景设计)  

####   [OHT对象管理](#oht对象管理)  

在GRC层面通过GHT管理的资源目录进行对象资源信息查询，从而计算得到对应的资源应该属于哪个节点，从而到对应的节点上访问对应的资源partition。

引入OHT后，形成了OHT与GHT结合的资源目录结构。全局缓存管理层通过先查询OHT，再查询GHT的方式获知资源的全局位置信息。详细算法可以参考详细参考    [对象资源管理](https://conf.yasdb.com/pages/viewpage.action?pageId=156110813)    中OHT资源管理部分。

资源目录OHT、GHT在集群所有实例下保持全局一致性，其下管理的资源partition是按资源分配策略再各个实例下分别管理。当undo对象以OHT方式管理时，所有此undo对象的Resource、Request、PastCopy全部受对应的    `GrcObject`    管理。

这里说明一点不管是采用OHT还是GHT管理资源，任意时刻，集群下同一对象的资源master仅有一份有效。

**OHT对象访问**

OHT对象资源访问分两部分：

- 资源目录查询，Requester通过dataOid查询OHT管理的那些    `GrcObject`    结构，获知资源的master信息。
- master资源访问：Requester将请求消息发送到对应的master节点，再次通过dataOid访问对应的    `GrcObject`    获取到资源partition，进行资源的访问。


整个资源请求过程进行了两次OHT资源目录查询，但目的是不同的。

**OHT对象迁移**

OHT对象迁移与普通GHT管理的资源迁移不同，OHT的迁移仍然以OHT整体为单位，即OHT资源的迁移仍然保持实例亲和的特点。OHT迁移本质上属于partition的搬迁，此部分不需要额外的工作量，与GHT下的partition实例间搬迁是一致的。

**OHT对象恢复**

当节点发生故障时，需要重新恢复OHT管理的对象资源，与GHT类似，通过扫描data buffer，如果对应的block所属的dataOid归OHT对象管理，则在OHT对应的    `GrcObject`    下恢复对应的Resource以及PastCopy。

默认undo亲和是开启的，如果有关闭此功能的诉求，可以通过配置隐藏参数    `_undo_affinity`    进行功能的关闭，此参数设置需要重启生效，并且所有实例要求配置相同。

####   [实例启停场景](#实例启停场景)  

实例启动和停止场景下需要进行资源的迁移，这里场景又进行了一定的细分。

|启停场景|实例类别|场景分析|
|---|---|---|
|启动|主|主实例启动时，进行OHT的全局初始化，同时主实例启动阶段会托管所有实例的undo表空间，此时要进行所有实例undo对象的注册。|
|启动|非主|非主实例启动，在加入集群reform阶段，将归属于本实例的undo对象迁移到本实例，整个过程发生在Grc remaster阶段。|
|停止|主|主实例停止时会先进行主实例的切换，后续停止过程变为非主实例停止。|
|停止|非主|非主实例停止时需要将当前实例管理的undo对象（包含本实例所有的以及本实例托管的），交由其他存活实例托管(此场景托管属于实例级，而非对象级)，此阶段通过Grc remaster完成。|


####   [在线恢复场景](#在线恢复场景)  

当发生实例故障时，reform选举出新的实例，根据当前实例拓扑信息，进行OHT的托管。OHT托管遵循最小移动原则，即在存活节点间不会产生OHT的迁移（启停实例除外），对于故障实例而言，其本身的undo对象以及其托管的undo对象，基于一定的负载策略在存活的节点上进行均匀托管。

到资源恢复阶段，根据统一的资源扫描恢复算法，基于最新的OHT资源目录，计算各节点下buffer block的主节点，并在对应的主节点下恢复全局资源信息。

####   [UNDO使用场景](#undo使用场景)  

UNDO的实例亲和特性不会影响上层模块的业务处理逻辑，通过缓冲区对象管理传递对应的dataOid信息即可，OHT的访问对上层模块透明。

1. 针对UNDO对象有：undo segment、undo block、事务、XA事务。
1. UNDO表空间下的非UNDO对象：undo space, undo space bitmap。


由于UNDO对象贯穿整个实例运行过程，因此对于主实例而言，仅在undo表空间加载阶段进行OHT资源的注册，其他实例在reform阶段进行迁移。

###   [5.3 动态视图设计](#53-动态视图设计)  

基于可维可测的考虑，新增X$GRC_OBJECT、V$GRC_AFFINITY_POLICY，GV$GRC_AFFINITY_POLICY进行UNDO亲和对象的信息查询；

另外，增加了X$GRC_OBJ_RES、X$GRC_OBJ_REQ、X$GRC_OBJ_PC三种fixed table，原来的V$GRC_RESOURCE, V$RESOURCE_REQUEST, V$GRC_PASTCOPY这三个视图（以及他们的GV化视图）将各自添加他们的结果。

####   [5.3.1 X$GRC_OBJECT](#531-xgrc-object)  

|字段|类型|描述|
|---|---|---|
|ID|INTEGER|buffer object 在内存中的ID|
|OBJ|BIGINT|亲和策略对应的data object id|
|POLICY|SMALLINT|亲和策略：0为默认策略，即按GHT分布；1，指定实例亲和；2，自动亲和，目前为预留类型|
|MASTER|SMALLINT|亲和实例|
|CURR_MASTER|SMALLINT|obj当前所在的实例（当亲和实例不在线时，会被托管至其他在线实例）|
|PREV_MASTER|SMALLINT|上一次的亲和实例|
|STATUS|SMALLINT|当前资源迁移状态|


####   [5.3.2 V$GRC_AFFINITY_POLICY，GV$GRC_AFFINITY_POLICY](#532-vgrc-affinity-policygvgrc-affinity-policy)  

|字段|类型|描述|
|---|---|---|
|DATA_OBJECT_ID|BIGINT|亲和策略对应的data object id|
|POLICY|VARCHAR(8)|亲和策略：DEFAULT为默认策略，即按GHT分布；AFFINITY，指定实例亲和；AUTO，自动亲和，目前为预留类型|
|MASTER|SMALLINT|亲和实例|
|CURRENT_MASTER|SMALLINT|obj当前所在的实例（当亲和实例不在线时，会被托管至其他在线实例）|
|PREVIOUS_MASTER|SMALLINT|上一次的亲和实例|
|STATUS|SMALLINT|当前资源迁移状态|


**注**  ：此处为两个视图的公共字段，GV$GRC_AFFINITY_POLICY会多出GROUP_ID、GROUP_NODE_ID、INST_ID（与现有其他GV$视图相同）

####   [5.3.3 X$GRC_OBJ_RES](#533-xgrc-obj-res)  

|字段|类型|描述|
|---|---|---|
|RESOURCE_NAME|VARCHAR(128)|资源名称，block资源[space][file][id]|
|XOWNER|TINYINT|持有写锁或最近一次持有写锁的节点|
|OWNER_COUNT|TINYINT|持有资源的节点数|
|OWNER_MAP|BIGINT|持有资源的节点位图，64位整型值，每一位代表节点的ID，如果该节点持有资源，ownerMap中对应的位设置为1|
|PASTCOPY_MAP|BIGINT|持有PASTCOPY的节点位图，此字段标记持有该BLOCK的PASTCOPY资源的节点|
|IN_PROCESS|BOOLEAN|是否有节点请求获取当前资源|
|REQUEST_COUNT|TINYINT|资源上当前请求消息数量|
|DISK_LSN|BIGINT|最近一次刷盘的LSN|
|WRITE_INST|TINYINT|正在刷盘的实例ID|
|OBJ|BIGINT|当前资源所属的对象ID|


当查询V$GRC_RESOURCE时，可以获取到来自X$GRC_OBJ_RES的信息（type固定为0）

####   [5.3.4 X$GRC_OBJ_REQ](#534-xgrc-obj-req)  

|字段|类型|描述|
|---|---|---|
|RESOURCE_NAME|VARCHAR(128)|资源名称，block资源[space][file][id]|
|TYPE|INTEGER|请求类型|
|INSTANCE_ID|INTEGER|发出请求消息的节点ID|
|SESSION_ID|INTEGER|发出请求消息的会话ID|
|SERIAL_NO|INTEGER|请求消息的序列号|
|IN_PROCESS|BOOLEAN|当前请求是否正在处理|


当查询V$RESOURCE_REQUEST时，可以获取到来自X$GRC_OBJ_REQ的信息

####   [5.3.5 X$GRC_OBJ_PC](#535-xgrc-obj-pc)  

|字段|类型|描述|
|---|---|---|
|TS#|INTEGER|页面space id|
|FILE#|INTEGER|页面file id|
|BLK#|INTEGER|页面ID|
|RESOURCE_NAME|VARCHAR(128)|资源名称，block资源[space][file][id]|
|INSTANCE_ID|TINYINT|持有该PAST COPY BLOCK的节点|
|LSN|BIGINT|PAST COPY BLOCK的LSN（Log Sequence Number）|


当查询V$GRC_PASTCOPY时，可以获取到来自X$GRC_OBJ_PC的信息

###   [5.4 性能场景设计](#54-性能场景设计)  

当前优化对TPCC场景下的性能不会有大的影响，主要原因有：

1. TPCC下的事务属于常驻内存页面，跨节点访问通过消息直接访问，不会进行页面传输，常驻内存页面仅在第一次加载时会访问全局资源，因此OHT对事务访问提升是没有作用的。
1. TPCC下的undo使用和访问具备一定的实例亲和特点，跨节点访问直接由对方实例构造CR页面发送，只有少量的需要拉取undo到本地。
1. TPCC下跑极致性能，通常undo retention设置保留时间很短，大部分undo都是热页访问，对全局资源的访问较少。


当前优化对非TPCC类的业务场景，如大并发、长事务同时带有一定节点亲和性的业务场景有一定提升，具体数据要看实际测试结果。

###   [5.5 安全性设计](#55-安全性设计)  

当前特性属于基于内部架构特征的优化类需求，不涉及安全相关的场景。

##   [6.未来规划](#6未来规划)  

当前需求涉及到的OHT对象管理相对还少，因为UNDO对象是常驻的，不会被在线创建以及删除。通过后续用户自定义对象资源亲和进一步完善OHT相关能力。

## Attachments:

[OHT物理架构.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjA4OTcwYzJhZjRmNTIxYzg4IiwicmVmX2lkIjoiNjczOTZlZWY1OTNmOTljOWZmMjM4YjJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTEwLCJleHAiOjE3ODI1NDI5MTB9.uJn9k1wZIJfrbybGy7BmY5AUMrBRakKhdPb8lDt-HHk)

 (image/png)    


## Comments:

|  [](null)  ,```
评审时间：2024-10-30 16:00

参与人员：孟凡彬、同二鹏、陈宜顺、李佐龙、张丽红、龙忠友

评审意见：

1. 动态视图V$GRC_AFFINITY_POLICY
   REMASTER_CNT    INTEGER    对象资源发生remaster(迁移)的次数   => 先去掉
   STATUS          SMALLINT   考虑增加DBA_视图，并以字符串形式展示该字段

2. 实例停止/故障，那么他管理的UNDO别人如何托管？
    => GHT？hash分散
        => 如果采用此方案，那实例再次拉起后，分散的资源还得收集起来，变成OHT管理迁移会原本的实例
    => ✔OHT？以整个UNDO表空间为单位托管

3. 实例停止/故障，那么他管理的所有对象别人如何托管？（未来：用户可以指定对象亲和，那么一个实例管理的对象可能很多）
    => 实例级托管：将实例所有对象托管至一个存活实例（目前实现相当于是该方案 —— ！需要会分散到多个实例）
    => 对象级托管：将实例所有对象，拆分到多个实例，分别托管
    （待定）

4. 实例级托管后，某个实例可能集中有很多对象（负载重）——先不考虑
    => 评估“实例是否可能不会再起来了”，所以可以考虑打散？

5. 配置项实例间统一（集群级配置项），记录到规格约束内

6. 设计基于UNDO亲和的场景，性能测试？TPCC场景不会有太大提升

7. 本周内可以转测
```,Posted by lizuolong at 十月 30, 2024 17:17|
|---|
|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396ef0a1ad9a3311dc9afb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFFQUVBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUlBQUFJQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBRUlBQUFBQUFBQUFRQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY1MTAsImV4cCI6MTc4MjQ2NzMxMH0.7rWqNZaayStAfWov0jQcXMGvDZiht2o9ibUTvvhqrUo),Posted by lizuolong at 十月 31, 2024 16:48|


