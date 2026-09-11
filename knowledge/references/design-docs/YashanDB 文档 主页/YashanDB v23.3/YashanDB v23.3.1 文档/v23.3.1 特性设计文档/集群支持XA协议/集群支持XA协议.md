Created by 陈宜顺, last modified on 七月 16, 2024



-   [1. 总述](#1-总述)  
    -   [1.1 需求来源](#11-需求来源)  
    -   [1.2 调研文档](#12-调研文档)  
    -   [1.3 需求分析](#13-需求分析)  
    -   [1.4 数据字典](#14-数据字典)  
    -   [1.5 开源依赖](#15-开源依赖)  
-   [2. 接口说明](#2-接口说明)  
-   [3. 规格与约束](#3-规格与约束)  
-   [4. 特性](#4-特性)  
    -   [4.1 集群支持XA协议基本功能](#41-集群支持xa协议基本功能)  
    -   [4.1.1 Gtid全局资源管理](#411-gtid全局资源管理)  
    -   [4.1.2 集群支持XA协议](#412-集群支持xa协议)  
        -   [4.1.2.1 实现要点](#4121-实现要点)  
        -   [4.1.2.2 流程分析](#4122-流程分析)  
        -   [4.1.2.2 RMO流转分析](#4122-rmo流转分析)  
        -   [4.1.2.3 优化项](#4123-优化项)  
        -   [4.1.2.4 其它场景](#4124-其它场景)  
    -   [4.2 集群支持XA协议的在线故障恢复](#42-集群支持xa协议的在线故障恢复)  
        -   [4.2.1 GTID资源恢复](#421-gtid资源恢复)  
        - 
        -   [4.2.2 未决事务托管](#422-未决事务托管)  
        -   [4.2.3 并发保护](#423-并发保护)  
        -   [4.2.4 在线恢复](#424-在线恢复)  
        -   [4.2.5 XaRecover](#425-xarecover)  
    -   [4.3 可维可测设计](#43-可维可测设计)  
        -   [4.3.1 JDBC](#431-jdbc)  
        -   [4.3.2 视图设计](#432-视图设计)  
-   [5. 自测用例](#5-自测用例)  
-   [6.资料设计章节](#6资料设计章节)  
-   [7.未来规划](#7未来规划)  




需求链接：    [YASHAN-813  集群支持XA协议](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b27d)  

用户故事：    [YDBRD-26120 集群支持XA协议](https://pingcode.yasdb.com/pjm/items/6618b02bfd997db58ad7f321)  

##   [1. 总述](#1-总述)  

XA 协议是由 X/Open 组织提出的分布式事务处理规范，主要定义了事务管理器 TM 和局部资源管理器 RM 之间的接口。目前单机已经在存储模块上支持了XA接口，由于集群也有联合多个节点执行事务的需求，因而需要集群具备XA事务能力，其中典型的应用如DBLINK能力，通过XA协议来连接同构或异构数据库，在多个节点上执行同一个事务。

###   [1.1 需求来源](#11-需求来源)  

本地事务一般只发生在一个数据库中，通过同一套事务管理机制进行管理，不涉及节点间的协调和合作，机制实现上较为简单。分布式事务相比于本地事务而言，出现了跨节点的情况，需要服务与服务之间远程协作才能完成事务操作，提交成功的条件更为严格，需要异常处理也变得复杂起来。业界分布式事务一般通过2PC或者3PC解决分布式提交的问题，然而不同厂商间的分布式事务实现方式千差万别，为了统一分布式事务的接口使用，XA协议应运而生。它是一个规范化的2PC协议，目前主流的数据库，如oracle、DB2 都是支持 XA 协议的。

支持XA协议后，数据库上层的业务可以以较小的代价对多个同构或异构数据库进行事务的控制，保证事务ACID属性，从而简化业务模型，提高系统的健壮性和业务复杂性。

目前，单机已在存储上支持XA协议接口，本次需求需要支持共享集群形态部署的XA协议接口，以满足共享集群下的XA协议通信。

###   [1.2 调研文档](#12-调研文档)  

1. 单机支持XA事务文档：    [XA事务特性设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141561330)  
1.   [YDBRD-22292 jdbc支持XA协议概要设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=144132472)  
1.   [Developing Applications with Oracle XA](https://docs.oracle.com/en/database/oracle/oracle-database/21/adfns/xa.html)    ， 其中23.5.3节重点讲了RAC中使用XA的相关说明


###   [1.3 需求分析](#13-需求分析)  

一、集群支持XA协议基本功能

1. 需要提供XA事务的启动、挂起、恢复、一阶段提交、二阶段提交、普通回滚、二阶段回滚功能
1. 提供事务上下文与线程的绑定、游离、恢复绑定能力


二、集群支持XA协议的在线故障恢复

1. 支持实例故障（掉电重启、单实例/多实例）后的未决事务托管，需要恢复XA事务能力，除了持久化内容，还需要保证未结束的XA事务恢复后，恢复所持有的资源
1. 提供recover查询能力，使得TM可通过recover协议查询所有XA事务列表


|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|基本功能|XA协议基本功能||是|是|  [https://pingcode.yasdb.com/pjm/items/6618b02bfd997db58ad7f321](https://pingcode.yasdb.com/pjm/items/6618b02bfd997db58ad7f321)    ?<br/>#YDBRD-26120 集群支持XA协议|
|可靠性|故障场景|----|是|是|  [https://pingcode.yasdb.com/pjm/items/6618b02bfd997db58ad7f321](https://pingcode.yasdb.com/pjm/items/6618b02bfd997db58ad7f321)    ?<br/>#YDBRD-26120 集群支持XA协议|
|可维可测|视图能力|----|是|是|随基本功能的特性一起带入|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|GTID|分布式事务在单机上唯一ID标识符|是|XA协议标准|
|2PC提交|分布式事务二阶段提交规范|是|XA协议标准|
|GtidResource|GTID资源，GrcResource的一种，记录了GTID的运行实例号|否|原创技术|


###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口说明](#2-接口说明)  

|接口|实现要点|是否需要落地|是否允许夸实例|
|---|---|---|---|
|ax_reg|跟随单机|否|不涉及|
|ax_unreg|跟随单机|否|不涉及|
|xa_open|跟随单机，直接返回成功|是|不涉及|
|xa_close|跟随单机，直接返回成功|是|不涉及|
|xa_start|需要在全局和本地Gtid绑定，不允许跨实例，其它跟随单机|是|不允许|
|xa_end|需要在全局和本地Gtid游离，不允许跨实例，其它跟随单机|是|不允许|
|xa_preapre|需要在全局和本地Gtid绑定，不允许跨实例，其它跟随单机|是|不允许|
|xa_commit|先本地结束事务，释放本地Gtid资源，再释放全局Gtid资源，允许跨实例，其它跟随单机|是|允许|
|xa_rollback|先本地结束事务，释放本地Gtid资源，再释放全局Gtid资源，允许跨实例，其它跟随单机|是|允许|
|xa_forget|清除启发式结束事务，需要在全局和本地Gtid绑定，不允许跨实例，其它跟随单机|是|不允许|
|xa_recover|未清理的phase2事务，需要返回本实例及托管实例的未决事务|是|不允许|


##   [3. 规格与约束](#3-规格与约束)  

1. 单实例上的表现，与单机相同。
1. 涉及跨实例场景：
    1. XaStart、XaEnd、XaPrepare不允许跨实例
    1. XaCommit、XaRollback允许跨实例
1. XA事务数上限为24K个(ANK_MAX_HANDLERS + ANK_MAX_PENDING_TRANS) ，实际运行过程中上限为'MAX_SESSIONS配置项的值'+8K
1. 当XaPrepare前发生故障，事务回滚，当XaPrepare后，不管是哪个实例故障，未决事务恢复。
1. XaPrepare在prepare一个空事务的时候会当做一次提交处理，行为表现同XaCommit


##   [4. 特性](#4-特性)  

###   [4.1 集群支持XA协议基本功能](#41-集群支持xa协议基本功能)  

###   [4.1.1 Gtid全局资源管理](#411-gtid全局资源管理)  

**逻辑视图**

![](https://pingcode.yasdb.com/atlas/files/public/67396ee6a1ad9a3311dc9ab5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

- 新增GTIDS资源，与GCS、GLS并列，用于管理全局的TID资源
- 新增GTID处理线程，用于处理GTID请求


**内存结构**

![](https://pingcode.yasdb.com/atlas/files/public/67396ee68970c2af4f521c43/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

- 新增Gtid的GRC资源类型：GRC_RES_GTID
- Non Block Area包含Lock以及Gtid两种资源
- Gtid资源区域的内存管理与Lock资源区域相同，每个GTID也需要分配资源状态信息管理单元（GrcResource），计算hash时使用的是codMurmurHash算法。
- 全局Gtid的数量一般远远少于Block数量，所以需要的内存相对较小。目前设计上限为ANK_MAX_HANDLERS+ANK_MAX_PENDING_TRANS = 16K+8K = 24K。


```
// 主要数据类型及数据结构设计
typedef enum EnGrcResType {
    GRC_RES_BLOCK = 0,
    GRC_RES_LOCK = 1,
    GRC_RES_GTID,
} GrcResType;

typedef union StGrcResName {
    CodUint64 value;
    union {
        BlockId blockId;
        LockId  lockId;
    };
    Gtid gtid;
} GrcResName;

typedef struct StGrmHead {
    CodUint32 id;      // resource id
    CodUint32 next;    // hash list next when allocated, free list next when freed
} GrmHead;

typedef struct StGrcResource {
    GrmHead    head;       // grc resource head
    GrcResName name;       // block id is valid if resType is block resource, otherwise lock id is valid
    CodBool    inProcess;  // a request is being processed
    CodBool    isValid;
    CodBool    inRecover;   // recovering
    CodUint8   type;        // resource type: block resource or non-block resource
    CodUint8   writeInst;   // current writing instance;, instance should be granted when flushing block
    CodUint8   refCount;    // decide whether the resource can be recycled
    CodUint16  xOwner;      // the latest owner of the resource
    CodUint8   ownerCount;  // owner count of the resource
    CodUint8   xaFinInst;   // mark which instance commit/rollback the xa on this gtid
    CodUint16  xaFinSid;    // mark which session commit/rollback the xa on this gtid
    CodUint32  pastCopy;    // the least past copy of the resource
    CodUint64  ownerMap;    // owner map of the resource
    CodUint64  auxMap;      // owner map of past copy(block resource), auxiliary statistics for broadcast unlock(non-block resource)
    GrcRequest request;     // current converting request
    GrmList    reqList;     // queued request list when converting
    GrcHistRec histRecorder;  // recorder for grc resource histories
    CodUint64  diskLsn;     // default 0, valid for gcs resource
} GrcResource;

```

- 本次实现把Gtid结构体嵌入了GrcResource结构体，增大了GrcResource结构体大小近一倍，后续需要把字段根据不同资源进行拆分，解耦。


**未决事务处理**

当前XaManager没有做实例托管的扩展，需要在该需求中扩展XaManager，使得可以托管其它实例的未决事务。

-     1. 当Master加载Xa事务区时，需要同时加载所有其它实例的Xa事务区，因为此时只有Master一个节点，需要托管其它实例的Xa事务

-     1. 当非Master加载Xa事务区时，Master先取消托管该实例的Xa事务，注销GtidResource资源，然后该实例重新加载Xa事务，重新注册Xa事务



```
typedef struct StXaArea {
    CodUint32   maxExtents;
    CodUint32   extentCount;
    XaExtent*   extents;
    TableSpace* space;
    XaBucket    buckets[XA_HASH_BUCKETS];
} XaArea;

typedef struct StXaManager {
    XaArea         area[ANK_MAX_INSTANCES];
    CodAtomicInt32 token;
    XaLamport      xaLamport;
} XaManager;

```

**未决事务上限**

单机场景下，未决事务上限由ANK_MAX_PENDING_TRANS宏控制。然而在集群的背景下，ANK_MAX_PENDING_TRANS只能控制单个实例上的未决事务个数。全局的未决事务上限如何确定？

方案1：单个实例的XA事务上限还是通过ANK_MAX_PENDING_TRANS控制，最大8192，全局的未决事务上限为ANK_MAX_PENDING_TRANS * 实例个数

该方案实现简单，各个实例只要考虑各自的未决事务即可，不需要进行协商。这样Master托管XA的情况下需要预留（ANK_MAX_PENDING_TRANS * 实例个数）这么多个Gtid的槽位。

方案2：全局未决事务上限为ANK_MAX_PENDING_TRANS，多实例间的未决事务总和不能超过该值。单个实例上不允许超过的XA事务数为ANK_MAX_PENDING_TRANS / INSTANCE_COUNT，最小为128

- 方案1：申请GTID时需要先广播消息查询其它实例的GTID数量并求和，确认所有实例的GTID数量是否达到上限，然后再申请资源。涉及并发，需要上GLS锁
- 方案2：实现较为简单，只需要控制每个实例上的XA事务数量即可。


综上，选择方案2

**线程架构设计**

![](https://pingcode.yasdb.com/atlas/files/public/67396ee68970c2af4f521c44/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

**Hash算法**

![](https://pingcode.yasdb.com/atlas/files/public/67396ee68970c2af4f521c45/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

- Gtid结构体分为两部分，长度和数据，其中数据长度最多128Bytes
- 以实际长度为准，取出Gtid的数据数组，并使用codMurmurHash计算哈希值


**Gtid唯一性**

Gtid在整个生命周期内具备集群下的唯一性，通过GrcResource机制进行检查。

向资源Master确认Gtid的唯一性。

**RMO流转**

![](https://pingcode.yasdb.com/atlas/files/public/67396ee7a1ad9a3311dc9ab9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

Gtid资源同样涉及Requester、Master以及Owner之间的流转。对于初始状态Owner不存在的情况，只允许进行资源的注册，即xaStart，而xaEnd/xaPrepare/xaCommit/xaRollback都不允许成功

**注：GTID的全局资源管理为共享集群与单机的主要处理差异**

###   [4.1.2 集群支持XA协议](#412-集群支持xa协议)  

####   [4.1.2.1 实现要点](#4121-实现要点)  

- 当XaPrepare完成后，可以在另外一个实例执行XaCommit/XaRollback
- 对于xaStart的join和resume、xaEnd、xaPrepare非空事务、xaForget非未决事务、xaRecover几个场景，只需要本地执行，不需要有消息交互
- 除了上述接口外，每个Xa事务，先进行全局的Gtid查询，找到对应master和owner，
    - owner落在本地，再按照本地处理
    - owner落在远程，则发消息处理（XaCommit/XaRollback），Owner执行本地处理
- 异常处理：
    - 实例故障，处于prepare状态的XA事务由master托管，正常执行。非prepare状态的XA事务回滚


####   [4.1.2.2 流程分析](#4122-流程分析)  

下图标识了不允许跨实例的情况

![](https://pingcode.yasdb.com/atlas/files/public/67396ee7a1ad9a3311dc9abc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

####   [4.1.2.2 RMO流转分析](#4122-rmo流转分析)  

RMO角色分布对接口支持情况

*注：xaEnd、xaPrepare、xaForget都是本地执行，不涉及RMO流转，不产生对应的集群下的XA请求

|资源角色分布|不允许跨实例的接口（XaStart、XaEnd、XaPrepare）|允许跨实例的接口(XaCommit/XaRollback)|
|---|---|---|
|RMO|成功|成功|
|RO+M|成功|成功|
|R+MO|失败|成功|
|RM+O|失败|成功|
|R+M+O|失败|成功|


处理原则：

- 初始状态，Owner不存在，这种情况xaEnd/xaPrepare/xaCommit/xaRollback都不允许成功（行为表现跟随单机）
- 如果没有Owner，Requester成为Owner，这点与GRC的规则保持一致
- 对于不允许跨实例的xa接口，Requester和Owner不同需要报错
- 只有Master登记Owner信息，xaEnd/xaPrepare/xaCommit/xaRollback不允许Owner不存在的情况


引入消息：

|消息名称|消息说明|
|---|---|
|MSG_XA_REQ|XA请求消息，发给master|
|MSG_ASK_OWNER_DO_XA|master转发请求给owner，执行对应XA请求|
|MSG_XA_REQ_CLOSE|XA的闭环请求，表示该次XA请求结束，GTID资源释放，可以处理下一个请求|
|MSG_XA_ACK|XA的请求消息的应答，包含此次请求的成功与否以及失败原因|


**Owner不存在的场景**

![](https://pingcode.yasdb.com/atlas/files/public/67396ee78970c2af4f521c4b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

**Owner存在的场景**

情况1： RMO在同一实例，情况跟单机相似

![](https://pingcode.yasdb.com/atlas/files/public/67396ee7a1ad9a3311dc9abd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

情况2： RO+M

![](https://pingcode.yasdb.com/atlas/files/public/67396ee7a1ad9a3311dc9abe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

情况3： R+MO

![](https://pingcode.yasdb.com/atlas/files/public/67396ee88970c2af4f521c4e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

情况4： RM+O

![](https://pingcode.yasdb.com/atlas/files/public/67396ee8a1ad9a3311dc9ac0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

情况5： R+M+O

![](https://pingcode.yasdb.com/atlas/files/public/67396ee8a1ad9a3311dc9ac1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

![](https://pingcode.yasdb.com/atlas/files/public/67396ee88970c2af4f521c51/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

####   [4.1.2.3 优化项](#4123-优化项)  

1. read-only事务：需要先发送清理GRC资源的请求，然后执行本地commit动作
1. one-phase commit：需要发送commit消息，走RMO请求流转流程
1. 启发式结束事务：需要清理本实例及托管实例的事务


```
备注：
read-only事务：某节点在收到一阶段的时候，发现自己仅持有了资源，并没有真正修改数据；此时该节点上不需要持久化动作，只需要在一阶段直接释放资源
one-phase commit：当TM收集到只有一个节点真正参与事务，则可以选择发送one-phase commit，此时不需要经过一阶段即可直接提交。
以上两项都是优化项，但XA协议要求one-phase事务必须要实现，经评估可以实现；

read-only需要在phase1的部分来识别； one-phase commit在落地的时候，通过flag带过来，存储需要根据各自场景来识别是否可以做one-phase提交

启发式结束事务：指一些特殊场景下，如故障，RM根据自己的判断，在无TM发送决策的情况下，直接将某事务完成；
这种启发式完成事务，可能造成数据不一致。 目前分析，可能在某节点上堆积过多未决事务、或长期占用锁等资源，才有必要做不经TM决策的启发式处理；

这类处理一般放在后台、或连接断连时，本版本可以只处理连接断连时的简易情况。

```

####   [4.1.2.4 其它场景](#4124-其它场景)  

- 可能存在没有Owner的GtidResource：两个实例同时去commit，一个成功，另一个会报错: YAS-05432 distributed transaction is already finished by other session(%u-%u)，其中后面的数值为具体的被提交的实例号以及会话号。


###   [4.2 集群支持XA协议的在线故障恢复](#42-集群支持xa协议的在线故障恢复)  

恢复要点：

- 实例故障，走GRC资源重分布流程，存活实例的XA owner会重新向GRC注册GTID资源
- master实例托管故障实例的XA事务，加载故障实例的XA事务区，并向GRC注册托管的XA事务GTID资源，托管时Owner信息仍然维持为故障实例
- 在master实例完成托管XA事务前，不允许启动新的XA事务，新启动的XA事务会被拦截
- 实例恢复，走GRC资源迁移流程，先迁移GRC资源到恢复实例，然后master取消XA事务托管，恢复的实例恢复接管XA事务
- 资源恢复期间通过freeze和unfreeze阶段进行上锁和解锁。由于unfreeze实例后，XA事务可能还没托管完成，需要增加unfreeze XA步骤，用于等XA事务托管完成后，放开XA事务的创建。
- 未决事务需要恢复出来


####   [4.2.1 GTID资源恢复](#421-gtid资源恢复)  

GTID资源重分布随着no-Block Area的GrcResource资源恢复进行，有部分场景需要适配

**节点故障**

1. 节点故障场景不存在Gtid资源迁出的场景，需要存活实例恢复接管故障节点的全局资源
1. master实例执行    `xaLoad`    托管故障实例的未决xa事务，并向GRC注册Gtid资源，注册后master实例成为Gtid资源的托管实例。实际发消息请求时，根据实际owner的在线状态决定发给实际owner还是master。
1. 存量Owner的重新注册，    `MSG_BEGIN_GRC_RECOVER`    消息里面需要处理GTID的恢复：    `grcBeginGtidRecover`    ，已持有GTID的owner需要重新向master注册
1. 故障节点未走到prepare阶段的事务全部回滚


![](https://pingcode.yasdb.com/atlas/files/public/67396ee88970c2af4f521c52/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)

**节点恢复**

1. 存量GTID的迁移。
1. master实例解除托管故障实例的XA事务，对应的Gtid资源释放。
1. （此时GRC上的Gtid资源已经在故障过程中由master实例在托管过程中恢复，此时通过第一步的GTID迁移已经恢复过来了）
1. 恢复实例执行xaLoad恢复自己的未决xa事务，并恢复对应的表锁以及GLS锁资源信息，完成XA事务区加载。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ee8a1ad9a3311dc9ac6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFoQUVCQkFDZ0FJQWdBQUlBQUJJQUFBSUFJQUFBQUZDQ0FnQ0lBQUFFQUFBQUFBQUFBQVlBQUFBVUFJVkF3QUJBZ0VRQkFDUWdDQUFBQUFBQUNBQUFBQkFBQUFRUUFnQ0FDQUFBQkFBQkFBQUFBZ0NBQUFBQXdDQUFBQkFBRUFBZ0FnQUFBQUFBQUlFQUVCQUFGQUFBQUFFQUlBQUFBU1FBUVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ4MDMsImV4cCI6MTc4MjQ1NTYwM30.iq9V1Am7esNIUlpjmjpBvy7JArz5hJJrps8LKid7Rjo)


####   [](#)  

####   [4.2.2 未决事务托管](#422-未决事务托管)  

主实例托管在线故障实例的未决事务，Master按照Gtid算法管理。

未决事务的托管由主节点进行。

需要改造XaManager

参考事务区托管的方案进行托管

```
CodResult axcXaLoad(AnkHandler* handler)
{
    AxcInstance* cluster = handler-&gt;kernel-&gt;cluster;
    AxcTopo*     topo = &amp;cluster-&gt;topo;

    if (topo-&gt;master != topo-&gt;id) {
        XaArea* area = &amp;handler-&gt;kernel-&gt;db.xam.area[INSTANCE_ID];
        area-&gt;isReleaseDeposit = COD_TRUE;
        axcReleaseXaDeposit(handler);
        if (xaAreaLoad(handler, topo-&gt;id) != COD_SUCCESS) {
            area-&gt;isReleaseDeposit = COD_FALSE;
            return COD_ERROR;
        }
        area-&gt;isReleaseDeposit = COD_FALSE;
    } else {
        for (CodUint32 id = 0; id &lt; topo-&gt;instCnt; id++) {
            if (xaAreaLoad(handler, id) != COD_SUCCESS) {
                return COD_ERROR;
            }
        }
    }
    return COD_SUCCESS;
}


```

####   [4.2.3 并发保护](#423-并发保护)  

XA访问受Grclatch保护以及grc->isXaRecovering标记保护

释放GrcLatch后，XA事务仍不能进行，因为有可能后台还在加载托管XA事务。需要等待后台XA事务完成加载、GTID资源全部恢复出来后，广播MSG_UNFREEZE_XA消息后，XA事务可以继续进行

####   [4.2.4 在线恢复](#424-在线恢复)  

Gtid恢复时，需要所有活的实例扫描本地的Xa事务，master还要扫描托管实例，并进行注册。

日志分析时识别XaPrepare的事务，并标记为未决事务，在GtidResource上登记。

####   [4.2.5 XaRecover](#425-xarecover)  

master实例需要连托管的XA事务一起返回出来。行为表现同v$2pc_pending视图。

###   [4.3 可维可测设计](#43-可维可测设计)  

####   [4.3.1 JDBC](#431-jdbc)  

需要通过jdbc测试，jdbc设计详见：    [jdbc支持XA协议](https://conf.yasdb.com/pages/viewpage.action?pageId=130144770)  

####   [4.3.2 视图设计](#432-视图设计)  

V$GRC_RESOURCE

V$2PC_PENDING：在master查，会显示集群其它实例的XA事务，包括托管的XA事务，在非master查，只显示本实例的XA事务

GV$2PC_PENDING: 查全量的未决事务

##   [5. 自测用例](#5-自测用例)  

1. 单节点执行XA事务
1. 跨节点执行XA事务
1. 单实例故障场景，未决XA事务能正常提交
1. 存量单机XA事务用例跑通（    [https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_XgOIXCrv&runId=ci_record_G3uZkAPw&lastRunId=ci_record_b5sBlf4A）](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_XgOIXCrv&runId=ci_record_G3uZkAPw&lastRunId=ci_record_b5sBlf4A%EF%BC%89)  
1. 实例故障场景XA事务用例跑通


##   [6.资料设计章节](#6资料设计章节)  

1. JDBC的接口说明
1. 视图说明


##   [7.未来规划](#7未来规划)  

1. 主备切换场景的XA事务恢复能力
1. JDBC支持
1. GrcResource结构体字段根据不同资源进行拆分，解耦


## Attachments:

[1713786462476.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTRhMWFkOWEzMzExZGM5YWE1IiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.L_97DGy5S28I4mmhAStkQSB1ZxcnBi2-cfX_ercroHg)

 (image/png)    


[1713787358357.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTQ4OTcwYzJhZjRmNTIxYzMzIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.CX37NNgHk5hFl_gx_Lo1YIsS1HpCJdV4K6IfL_liKqk)

 (image/png)    


[1713928159617.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTU4OTcwYzJhZjRmNTIxYzM1IiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.EPnh27lxDIvvit0JmQPdRGqoqLcoS2fw_TZwRe2T3HU)

 (image/png)    


[1713928197445.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTU4OTcwYzJhZjRmNTIxYzM2IiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.t47eRJqgtIbznAaIYl-IdzQAZn1wOtaOoDsOV8qrGQw)

 (image/png)    


[1713928471448.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTU4OTcwYzJhZjRmNTIxYzM3IiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.7iMZxSCVWmfR0AJv3dccK0wjijkr4bBBAabMFFrzLQc)

 (image/png)    


[1713928532187.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTU4OTcwYzJhZjRmNTIxYzM4IiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.T6fWwp_Fx6zCHmosNR_Y54rnW8GCQZiMZB7QL22DNhw)

 (image/png)    


[1713928587551.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTVhMWFkOWEzMzExZGM5YWE5IiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.RbvWhUrFH0KvwvrJ1wZrhIo1IfDjPpgCdz9yAOSCYOI)

 (image/png)    


[1713928609300.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTVhMWFkOWEzMzExZGM5YWFhIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.uHqmcJCKPjHAAKdS0KY7ztbxg7dzH8FYkQOblG8HEFo)

 (image/png)    


[1713928715757.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTU4OTcwYzJhZjRmNTIxYzM5IiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.2DK0t2xBL4j4McLo2OWUrBhBHtcavG8RWVbcd2_pvvs)

 (image/png)    


[1713928977857.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTVhMWFkOWEzMzExZGM5YWFiIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.1_uYD5NbX6IpqEYgAPANFQAmYxsbeuWel1YKK_xFSkM)

 (image/png)    


[1713928159617.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTU4OTcwYzJhZjRmNTIxYzNhIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.G-hWjKvqNE6c2Y29yg06XZ5QZF0t8shgbkEInXMiZc8)

 (image/png)    


[1718159930438.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTU4OTcwYzJhZjRmNTIxYzNkIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.p20H_YPyo6YVd086pPqUqeADJIQwZxZ5Ey-ORJQF3SM)

 (image/png)    


[1718198703288.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTVhMWFkOWEzMzExZGM5YWFmIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.XiN0ZjXeqPR_vGYuNW3F3HicIJ5kNc1L-sabXTIQdQA)

 (image/png)    


[1718196468801.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTY4OTcwYzJhZjRmNTIxYzQwIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.p2aJa6-FiZ4DVbIPBBFgJjhRZB7NQ47iMlWrmUtWSBk)

 (image/png)    


[1718173592321.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTY4OTcwYzJhZjRmNTIxYzQxIiwicmVmX2lkIjoiNjczOTZlZTQ3MjgyMDZlZmI5MmYyZTBkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0ODAzLCJleHAiOjE3ODI1MzEyMDN9.o5HsTHNmUJ5qFvpvnP_fI1FGku27_Ec_-BKJFkRxECw)

 (image/png)    


## Comments:

|  [](null)  ,讨论纪要：    
  1. 消息处理机制，需要支持消息可重入    
  2. 新增资源涉及闭环，要处理闭环消息的检测    
  3. 故障恢复和锁、block类似    
  4. XA事务区是持久化的，对于prepare，跟单机一样处理    
  ——需要看下事务区托管的实现    
  5. 约束：GTID在reform过程中不可访问    
  6. 是否需要支持跨实例查询单个XA事务？不提供，查全量，xa_recover,Posted by chenyishun at 五月 08, 2024 11:40|
|---|
|  [](null)  ,交叉测试点：,1. 全局资源历史dump
1. 闭环消息处理
,Posted by chenyishun at 五月 21, 2024 10:21|
|  [](null)  ,评审纪要    
  1. 未决事务数量，由于master实例的xrm可能会不足以支撑接管所有残留事务，23.3版本先考虑限制每个实例上未决事务的数量，如不超过（ANK_MAX_PENDING_TRANS / 最大实例数量），优先保证4节点上功能正常。后续版本考虑扩展xrmPool的机制。    
  2. GrcResName里面直接存Gtid，以后再整理和解耦    
  3. V$GRC_RESOURCE里面RESOURCE_NAME字段显示GTID资源时，只显示GTID的长度属性，格式：['gtid长度']，如[20]    
  4. V$GRC_RESOURCE里面，显示GTID资源时，XOWNER为owner的实例id号，OWNER_COUNT为0或1，OWNER_MAP没有使用，恒为0,Posted by chenyishun at 六月 18, 2024 20:05|
|  [](null)  ,DBA_2PC_PENDING_TRANS,Posted by chenyishun at 六月 27, 2024 17:13|
