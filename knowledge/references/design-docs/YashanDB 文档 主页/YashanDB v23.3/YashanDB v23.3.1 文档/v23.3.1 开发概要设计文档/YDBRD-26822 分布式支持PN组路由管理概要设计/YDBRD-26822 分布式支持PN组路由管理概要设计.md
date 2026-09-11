Created by 刘建中 on 六月 07, 2024

  [YDBRD-26822 ](https://pingcode.yasdb.com/pjm/items/6638439cc36a3d30a86174e5? #YDBRD-26822 分布式支持PN组路由管理)    ：分布式支持PN组路由管理

**目录**



-   [1 overview（概述）](#YDBRD26822分布式支持PN组路由管理概要设计-1overview（概述）)  
-   [2 Features（功能特性）](#YDBRD26822分布式支持PN组路由管理概要设计-2Features（功能特性）)  
-   [3 Interfaces（接口）](#YDBRD26822分布式支持PN组路由管理概要设计-3Interfaces（接口）)  
-   [4 Limitations（功能限制）](#YDBRD26822分布式支持PN组路由管理概要设计-4Limitations（功能限制）)  
-   [5 Detail Design（详细设计）](#YDBRD26822分布式支持PN组路由管理概要设计-5DetailDesign（详细设计）)  
    -   [5.1 方案架构](#YDBRD26822分布式支持PN组路由管理概要设计-5.1方案架构)  
        -   [一层映射：数据 → chunk](#YDBRD26822分布式支持PN组路由管理概要设计-一层映射：数据→chunk)  
        -   [二层映射：chunk → PN节点](#YDBRD26822分布式支持PN组路由管理概要设计-二层映射：chunk→PN节点)  
    -   [5.2 路由算法](#YDBRD26822分布式支持PN组路由管理概要设计-5.2路由算法)  
        -   [5.2.1 算法选型](#YDBRD26822分布式支持PN组路由管理概要设计-5.2.1算法选型)  
        -   [5.2.2 路由算法描述](#YDBRD26822分布式支持PN组路由管理概要设计-5.2.2路由算法描述)  
        -   [5.2.3 扩/缩容时的路由分配](#YDBRD26822分布式支持PN组路由管理概要设计-5.2.3扩/缩容时的路由分配)  
    -   [5.3 Cache数据的惰性加载机制](#YDBRD26822分布式支持PN组路由管理概要设计-5.3Cache数据的惰性加载机制)  
    -   [5.4 PN路由系统表](#YDBRD26822分布式支持PN组路由管理概要设计-5.4PN路由系统表)  
    -   [5.5 路由模块详细设计](#YDBRD26822分布式支持PN组路由管理概要设计-5.5路由模块详细设计)  
        -   [5.5.1 路由相关数据结构](#YDBRD26822分布式支持PN组路由管理概要设计-5.5.1路由相关数据结构)  
        -   [5.5.2 路由信息管理](#YDBRD26822分布式支持PN组路由管理概要设计-5.5.2路由信息管理)  
        -   [5.5.3 路由相关消息通知](#YDBRD26822分布式支持PN组路由管理概要设计-5.5.3路由相关消息通知)  
        -   [5.5.4 更新路由通知的处理过程](#YDBRD26822分布式支持PN组路由管理概要设计-5.5.4更新路由通知的处理过程)  
        -   [5.5.5 按需拉取PN路由过程](#YDBRD26822分布式支持PN组路由管理概要设计-5.5.5按需拉取PN路由过程)  
        -   [5.5.6 mn按需初始化路由](#YDBRD26822分布式支持PN组路由管理概要设计-5.5.6mn按需初始化路由)  
        -   [5.5.7 路由版本管理](#YDBRD26822分布式支持PN组路由管理概要设计-5.5.7路由版本管理)  
    -   [5.6 PN扩缩容机制与故障处理流程](#YDBRD26822分布式支持PN组路由管理概要设计-5.6PN扩缩容机制与故障处理流程)  
-   [6 Test Cases（自测用例）](#YDBRD26822分布式支持PN组路由管理概要设计-6TestCases（自测用例）)  
-   [7 Workload（工作量）](#YDBRD26822分布式支持PN组路由管理概要设计-7Workload（工作量）)  
-   [8 References（参考文档）](#YDBRD26822分布式支持PN组路由管理概要设计-8References（参考文档）)  
-   [9 TODO（遗留问题）](#YDBRD26822分布式支持PN组路由管理概要设计-9TODO（遗留问题）)  
-   [10 会议纪要](#YDBRD26822分布式支持PN组路由管理概要设计-10会议纪要)  




# 1 overview（概述）

*简要说明本设计方案的背景、需求。*

存算分离架构下的PN数据路由的方案，参考了分布式下DN的数据路由方式。主要区别点是：PN上存放的是数据的Cache，此外，PN的扩缩容机制也有所区别。

PN节点上的数据Cache包括MemoryCache和DiskCache，其在整个存算分离架构中的位置如下图的绿色模块标出：

![](https://pingcode.yasdb.com/atlas/files/public/67396e1f8970c2af4f5216b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUNBQUFBQUFBTFFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBa0FBRUFBUUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUJBQUFDQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA1ODMsImV4cCI6MTc4MjM4MTM4M30.I-CIzGytQfl0EGIPeGhuNbzFActnFAs_3hhsaFgJtiA)

                                                                                                    图1

数据Cache在存算分离中，主要作用是加速在PN执行的查询速度，具体的收益包括：

1）加速：PN对热数据可以直接访问本地的Mem或者Disk；

2）减少IO：减少了PN到S3的远程读取带来的网络IO开销。

  


本方案是Cache数据在PN组各节点的路由管理。好的路由方案需要满足：

① 平衡性：数据在PN节点尽可能均衡分布；

② 单调性：当有新的PN节点上线后，系统中原有的数据要么还是映射到原来的节点上，要么映射到新加入的节点上，不会出现从一个老节点重新映射到另一个老节点；

③ 稳定性：节点扩缩容或重启时，路由尽量少变更。

PN节点的Cache数据路由问题，本质上和计算调度问题紧密相关：因为查询计划会分发到那些Cache了需要用到的数据的PN节点去执行。

# 2 Features（功能特性）

*说明本方案的功能特性。*

本方案的功能特性包括：

1） PN节点Cache数据的路由算法；

2） PN组路由的维护和管理；

3） PN节点故障和扩缩容的支持。

# 3 Interfaces（接口）

*列出本方案对外提供的接口、配置参数、API等。*

本方案提供的是供内部模块调用的接口，包括：

① 根据分布式key，计算获取对应的chunk id；（这个接口直接沿用之前已有的实现即可）

```
// key -> chunkId
CodResult anlDstbKeyToChunkId(AnlStmt* stmt, TableDict *dc, PartKey *key, CodUint32 *chunkId)
```

② 根据chunk id + dataspace id，获取指定PN组的对应PN节点ID。接口定义如下：

```
// chunkId -> pnNodeId  (在原有方法基础上复用)
CodResult anlGetGroupByChunk(AnlStmt* stmt, CodBool isPnRoute, CodUint32 chunkId, GroupDesc* group);

// 访问路由表:
CodResult ankOpenPnRouteDict(AnkHandler* handler, CodUint64 dsId, CodUint32 pnGroupId, RouteDict** dc);
CodVoid   ankCloseRouteDict(RouteDict* dc);
```

优化器生成计划，以及将计划下发到PN执行时，需要用到以上两个接口。

# 4 Limitations（功能限制）

*说明本方案对外的功能限制或约束。*

本方案只针对内部模块之间使用的接口。

# 5 Detail Design（详细设计）

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

## 5.1 方案架构

*说明方案的总体架构，优先考虑通过架构图进行描述。*

路由方案是以Chunk为粒度。如参考文章[2描述，数据空间  dataspace具有chunks属性，指定其chunk的数量。对于每一个数据空间的每一个chunk，路由方案需要确定该chunk位于哪个PN节点。

采用“数据 - Chunk - PN节点”的二层映射方式，如下图：

![](https://pingcode.yasdb.com/atlas/files/public/67396e1fa1ad9a3311dc9529/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUNBQUFBQUFBTFFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBa0FBRUFBUUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUJBQUFDQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA1ODMsImV4cCI6MTc4MjM4MTM4M30.I-CIzGytQfl0EGIPeGhuNbzFActnFAs_3hhsaFgJtiA)

                   图2

#### **一层映射：数据 → chunk**

数据到Chunk：使用上图描述的分布算法。

① 用hash算法，把分布键值映射为一个32位无符号整数的hash值；

② hash值对chunks总数取模，得到Chunk ID。

#### **二层映射：chunk → PN节点**

二层映射也即路由算法。Chunk到PN节点的路由算法，原则是：①使Chunk在PN节点间尽可能均匀地分布；②减少在扩缩容时的chunk路由变动。

## 5.2 路由算法

### 5.2.1   算法  选型

对于存算分离下PN节点Cache数据的路由方案，在选型上可以有两种选择：

① 增加一个系统表，用来维护管理PN节点的数据路由；

② 通过统一的一致性Hash算法来管理路由。

方案2可以不需要依赖系统表，在内存数据结构中按照统一的一致性Hash算法进行管理即可，可带来简洁性，降低工程复杂度。因此我们重点对方案2做调研和测试分析。

对使用一致性Hash的方式（通过不同算法对比，使用了最新最优的DxHash一致性Hash算法），做了调研分析和工程可行性测试：

-      [基于DxHash的YashanDB分布式数据路由算法](https://conf.yasdb.com/pages/viewpage.action?pageId=130121967)  

-      [均衡性测试](https://conf.yasdb.com/pages/viewpage.action?pageId=130125671)  

分析和测试表明：对于方案②，由于在chunks的数目非常有限（最多4096个），即使使用最新最优的一致性Hash算法，在YashanDB的使用场景下，也很难满足均衡性的要求。

因此我们  **使用方案①**  ，即基于系统路由表的方式。

### 5.2.2 路由算法描述

按照平衡性的要求，chunk_count个cache数据在pn_count个节点的路由满足：

i)  每个PN至少分配 chunks_count/pn_count 个chunk；

ii) 有chunks_count%pn_count个PN会多分配到1个chunk。

每个chunk在PN只存一份，不存副本。

以15个Chunk，4个PN节点为例，通过路由算法计算后，chunk在PN节点间的分布如下图。

![](https://pingcode.yasdb.com/atlas/files/public/67396e1f8970c2af4f5216b6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUNBQUFBQUFBTFFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBa0FBRUFBUUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUJBQUFDQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA1ODMsImV4cCI6MTc4MjM4MTM4M30.I-CIzGytQfl0EGIPeGhuNbzFActnFAs_3hhsaFgJtiA)

                                                                         图3

路由方式描述：

**1)**   按照chunk#1 ~ chunk#n的顺序做分布；

**2)**   分配给PN节点中，目前chunk数最少的节点；

**3)**   如果可分配给多个PN节点（即这些PN节点的chunk数相同），则  选择分配给序号最小的PN节点。

**复制表的情况：**

在存算分离下架构，目前方案中，PN节点  **不支持**  对复制表执行查询。

如果查询中包含复制表和普通表，则生成的查询计划中，对复制表的查询是在DN执行，而普通表的查询在则PN节点执行。

### 5.2.3 扩/缩容时的路由分配

**1、扩容**

包括扩容1个或多个PN节点的情况，都按照如下方式进行分配：

① 先按照均衡性和少搬迁的原则，确定新扩容的几个PN节点上，应该分布多少个chunk。

*如果chunk数为M，扩容后的PN数为n，则按照均衡性和少搬迁的原则，新的PN上分布的chunk最多为M/n+1，且至少有一个新的PN上chunk数为M/n。*

② 对扩容出来的多个PN节点，按ID递增顺序，依次分配。即：先分配完了id较小的新PN，再分配id较大的新PN。

③ 按照分配算法，将老PN节点上的部分chunk路由变更为新的PN节点。

     具体分配算法为：a.优先搬迁chunk较多的老PN上的chunk；b.对chunk数相同的老PN，优先搬迁节点ID较小的PN节点上的chunk；c.搬迁某台老PN上的chunk时，按照chunk id递减的顺序进行搬迁。

*注：这里的“搬迁”其实就是路由变更，并不是指搬迁数据。*

**2、缩容**

包括缩容1个或多个PN节点的情况，都按照如下方式进行分配：

① 按照5.2.2中描述的算法，确定余下的PN节点上，应该分配多少个chunk；

② 按照5.2.2中描述的算法，将被缩容的原PN上的chunk，分配到余下的PN节点。

③ 优先搬迁到chunk较少的PN上；按照chunk id递减的顺序进行搬迁。

## 5.3 Cache数据的惰性加载机制

Cache数据的惰性加载机制，主要针对扩缩容和PN节点路由变动的场景。以一个具体例子说明惰性加载机制：

假设有8个PN节点PN1 ~ PN8，其上分别分布有chunk1 ~ chunk8，此外，在PN1上还分布有chunk9。因此，涉及到读chunk1、chunk9的查询都会分发到PN1执行。

如果新扩容了一个PN节点，即增加到9个节点PN1 ~ PN9。按照路由算法，应该将chunk9分配到PN9上去。在惰性加载机制里，chunk9并不会从PN1搬迁PN9，实际上，扩容后chunk9可以直接从PN1删除。而在下次查询涉及到对chunk9的读取时，计划下发到PN9节点，PN9发现在本地并没有chunk9，这时会去S3将chunk9读过来，并放入Cache里。

在SnowFlake中有相似的机制（称为惰性一致性路由：Lazy Consistent Hashing）。

## 5.4 PN路由系统表

PN路由系统表结构定义如下：

|PN_ROUTE$||||
|:---|---|---|---|
|DS_ID|NOT NULL|BIGINT|数据空间ID|
|CHUNK#|NOT NULL|INTEGER|CHUNK ID|
|GROUP_ID#|NOT NULL|INTEGER|PN组ID|
|PN_NODE#|NOT NULL|BIGINT|PN节点ID|
|VERSION|NOT NULL|BIGINT|版本|


注意这里的DS_ID + CHUNK#字段可以唯一对应到系统表ROUTE$的对应字段。

集群可以被划分为多个PN组。  **对每一个Chunk + DataSpace + PN组，都会在系统路由表里存在一条唯一的路由记录**  。集群划分为PN组，可以支持对不同业务的查询分离，以及支持用户指定PN组进行查询。

路由数据结构对应到PN_ROUTE$表，在open阶段会从系统表加载，并在扩缩容或者数据重均衡时会更新系统表。

**PN路由的创建：**

PN路由系统表（PN_ROUTE$）的路由创建是用按需创建的方式，具体方式参考  **5.5.6**  节。

## 5.5 路由模块详细设计

### 5.5.1 路由相关数据结构

在路由相关数据结构的设计上，主要出发点  是尽量复用原有数据结构，在其基础上做修改。

**struct StDictManager**  ** **  结构中增加pnRouting字段：

```
typedef struct StDictManager
{
    SpinLock          lock;
    //...
    RouteEntry        routes[ANK_MAX_DATASPACE];
    PnRouting         pnRouting;
    //...
} DictManager;
```

PnRouting结构承载PN路由，PnGroupRoute为单个PN组的路由。其定义如下：

```
typedef struct StPnRouting {
    PnGroupRoute pngRoutes[COD_MAX_PN_GROUP_NUM];
    CodUint64    pngRouteVersions[ANK_MAX_DATASPACE];  // only use in pn node
    SpinLock     lock;
    CodUint8     unused[4];
} PnRouting;

typedef struct StPnGroupRoute {
    RouteEntry routes[ANK_MAX_DATASPACE];
    CodUint32  pnGroupId;
    CodBool    used;
    CodUint8   reserved[3];
} PnGroupRoute;
```

**struct RouteEntry**  保持原有结构不变。

对于RouteDict，可以复用原有的数据结构定义，并增加供PN路由使用的若干字段：

```
typedef struct StRouteDict {
    CodUint32      id;
    CodUint32      chunkCount;
    CodUint32*     chunkRoute;  // chunk id -> (dn group id)/(pn node id)
    MemoryContext* mctx;
    CodUint32      refCount;
    union {
        CodUint32 groupCount;
        CodUint32 pnNodeCount;     // 新增字段
    };
    union {
        CodGroupId* groups;
        CodUint32*  pnNodes;       // 新增字段
    };
    CodGroupId       localGroupId;
    CodGroupId       pnGroupId;    // 新增字段
    SpinLock         lock;
    volatile CodBool valid;
    CodUint8         unused[3];
    CodUint64        version;
} RouteDict;
```

不同之处是：chunkRoute字段表示的是chunkId 到PN nodeId的映射关系。

新增的pnNodeCount字段，与之前的groupCount作为一个union；新增的pnNodes字段，与之前的groups作为一个union。

### 5.5.2 路由信息管理

**MN：**

在集群初次启动后，MN根据各PN组节点配置情况，完成内存数据结构的初始化，并创建系统表。

创建DataSpace后，根据chunk数量和PN节点配置，按5.2的算法完成路由分配，并写入系统表。同时推送Notify消息到CN，更新路由信息。

在发生PN节点扩缩容后，根据单调性的原则分配新的路由，更新系统表。同时推送Notify消息到CN。

MN在检测到PN节点异常后，并不需要去更新系统表或者通知CN；只有在认为PN节点是持续较长时间异常后，将该PN节点按缩容的形式处理。

**CN：**

在每次CN节点启动后，CN从系统表读取路由信息。

创建DataSpace后，根据收到的MN的Notify消息，判断版本号，从系统表读取并更新内存路由数据结构。

发生节点扩缩容后，CN根据收到的MN的Notify消息，判断版本号，从系统表读取并更新内存路由数据结构。

在CN检测到PN节点异常后，并不需要去通知其他CN或MN。而是按照单调性原则分配新的路由，并更新内存数据结构。并不需要去更新系统表。如果节点异常后恢复，则可以从系统表将对应这个恢复节点的路由重新读取即可。

  


不同场景的对比如下：

|  
|MN|CN|
|---|---|---|
|节点启动|集群初次启动：MN根据PN组配置情况，完成内存数据结构的初始化，并创建系统表（与创建DN系统路由表的时机和方式是一样的）。,MN节点启动：从系统表读取路由信息。|CN节点启动：从系统表读取路由信息。|
|首次查询（按需创建路由）|根据chunk数量和PN节点配置，按5.2的算法完成路由分配，并写入系统表。,同时推送Notify消息到CN，更新路由信息。|根据收到的MN的Notify消息，判断版本号，从MN拉取新创建的DataSpace的路由信息。|
|PN扩/缩容|根据单调性的原则分配新的路由，更新系统表。,同时推送Notify消息到CN。|根据收到的MN的Notify消息，判断版本号，从MN拉取变更的路由信息。|
|PN节点异常|MN在检测到PN节点异常后，并不需要去更新系统表或者通知CN。|在CN检测到PN节点异常后，并不需要去通知其他CN或MN。,而是按照单调性原则分配新的路由，并更新内存数据结构。并不需要去更新系统表。,如果节点异常后恢复，则可以从系统表将对应这个恢复节点的路由重新读取即可。|


**支持按需创建路由表记录**

支持按需创建PN组下各DataSpace的路由记录。

### **5.5.3 路由相关消息通知**

与路由相关的消息，只需要新增加一种消息类型：更新路由消息。在发生PN节点扩/缩容时，MN在完成路由计算和更新后，推送“路由更新消息”到CN。

**更新路由通知**

使用场景：创建/删除PN组、PN扩容、PN缩容、PN节点异常、PN节点异常恢复。

推送方式：更新路由消息通过MetaAgent模块由MN推送给CN。

更新路由消息的内容包括：

- DataSpace id
- PN Group id
- 路由版本号


可选：消息内容中也可以包含扩/缩容或异常的PN节点ID，方便后续的扩展使用。

### 5.5.4 更新路由通知的处理过程

更新路由通知消息的发送和处理，主要通过MetaAgent模块来完成。MetaAgent模块的技术细节可以参考文档：    [MetaAgent设计文档 [v3]](https://conf.yasdb.com/pages/viewpage.action?pageId=135620691)  

MetaAgent使用如下两个CMD来发送消息通知：

```
ICS_CMD_META_AGENT_NOTIFY,
ICS_CMD_META_AGENT_NOTIFY_ACK,
```

在MetaAgent内部，除了“路由更新通知”外，还支持扩展其他通知类型。

MetaAgent处理通知的技术方案可以参考文档：    [MetaAgent支持PN路由变化通知设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722)  

在CM模块检测到PN节点扩缩容/异常后，会将事件通过CM的函数anrDstbCmReportEvent通知到MetaAgent模块。

```
typedef enum EnCmEventType {
    CM_EVENT_TYPE_INVALID = 0,
    CM_EVENT_TYPE_ADD_NODE = 1,
    CM_EVENT_TYPE_DELETE_NODE = 2,
    CM_EVENT_TYPE_ADD_GROUP = 3,
    CM_EVENT_TYPE_DELETE_GROUP = 4,
    CM_EVENT_TYPE_CHANGE_ROLE = 5,
    CM_EVENT_TYPE_CHANGE_RUNNING_STATE = 6,
    CM_EVENT_TYPE_CHANGE_NODE_STATE = 7,
} CmEventType;
```

  


对应增删PN节点和增删PN组，可以复用原有的枚举值add_node, delete_node, add_group, add_delete等event类型，通过Event中的groupInfo区分是DN还是PN。

通过yasboot start、stop等方式引起的PN节点 state变化，通过CM_EVENT_TYPE_CHANGE_NODE_STATE类型的event来通知。

因为节点异常或异常恢复等引起的PN节点 running state变化，通过CM_EVENT_TYPE_CHANGE_RUNNING_STATE类型的event来通知。

以扩容一个PN节点为例，更新路由通知的处理过程如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396e1fa1ad9a3311dc952a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUNBQUFBQUFBTFFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBa0FBRUFBUUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUJBQUFDQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA1ODMsImV4cCI6MTc4MjM4MTM4M30.I-CIzGytQfl0EGIPeGhuNbzFActnFAs_3hhsaFgJtiA)

                                                                                                                         图4

在之前存算一体的方式下，DN节点启动后，Open阶段之前，CM就会触发ADD_NODE_EVENT 事件。

而对存算分离架构下的PN节点，没有nomount状态，以实现快速启动和快速扩缩容，因此在触发ADD_NODE_EVENT事件时，PN已经处于open的状态。

### 5.5.5 按需拉取PN路由过程

1. 当cn首次接收pn查询请求，调用ankOpenPnRouteDict打开pn路由：

① 将会在dcLoadRouteDic中尝试拉取mn的pn route并进行对比和更新；

② preLoadPnRoute获取本地的pn route version，调用getPnRouteMeta进行路由拉取更新。

2. 拉取流程

新增一组消息，cn通过消息拉取mn本地的pn_route：

```
AND_MSG_DEF(ICS_CMD_META_AGENT_PN_ROUTE, 0, ICS_CONN_VER_INIT, anrProcMetaAgentMsg),
AND_MSG_DEF(ICS_CMD_META_AGENT_PN_ROUTE_ACK, 0, ICS_CONN_VER_INIT, anrProcMetaAgentAck),
```

消息体：

```
typedef struct StMaPnRouteMsg {
    CodUint64  reqId;
    CodUint64  dsId;
    CodUint64  version;  // cn local pn route version
    CodGroupId pnGroupId;
    CodChar    reserve[4];
} MaPnRouteMsg;

typedef struct StMaPnRouteAck {
    CodUint64  reqId;
    CodUint64  dsId;
    CodUint64  version;
    CodGroupId pnGroupId;
    CodError   error;
    List*      chunkRoute;  // The containing element is CodUint32
} MaPnRouteAck;
```

在Meta Agent模块实现上述消息接口。具体可以参考（    [MetaAgent支持PN路由变化通知设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722)    ）。

3. preLoadPnRoute会调用andMetaAgentGetPnRouteMeta

① 通过maBuildPnRouteMsg构造发送信息

② 调用Meta Agent模块中实现好的maSendIcsSyncWait并阻塞等待通知

4. mn接收ICS_CMD_META_AGENT_PN_ROUTE消息，由Meta Agent模块推送任务到maPnRouteMetaProc

① maExtractPnRouteMsg解码消息

② 返回最新的路由表信息

③ 发生错误则将ack.error置为相应的错误码，并返回ack消息

5. mn将最新的路由表信息打包构造ics发送消息ICS_CMD_META_AGENT_PN_ROUTE_ACK

6. cn接收ICS_CMD_META_AGENT_PN_ROUTE_ACK消息，Meta Agent唤醒maSendIcsSyncWait

① 对比reqId是否一致，不一致则报错

② 调用maGetPnRouteDescList将mn返回的结果转为pnRouteDescList

7. 当需要让pn路由失效时，调用  *dcInvalidPnRouteDict*

8. 异常和并发情况

- 确定前提，cn上（一个组 + 一个dataspaceId）对应的dc将会是有且仅有一个，同时全局共用，在改变dataspace时发生变化
- pn节点变化后，cn接受到mn的消息后将路由置为失效
- 首先外部会将RouteEntry进行锁定，防止了并发获同一个路由（dataspaceId和pnGroupId相同）
- 版本是否更新通过对比version确定
- 当cn的路由过旧甚至影响到pn完全无法执行时，pn返回错误让cn将重新开始路由拉取
- 其余如消息收发以及超时等机制依赖Meta Agent模块来处理


### 5.5.6 mn按需初始化路由

1. 当cn向mn拉取pn route时，mn会调用ankGetPnChunkRouteList，如果发现本地没有pn route则从零生成：

① getNodeListByGroupId获取当前集群中属于pnGroupId的所有pn节点

② 通过读取dataspace系统表获取当前的chunkCount

③ 通过节点信息和chunkCount通过路由算法（保证均衡性的方式）生成pnRouteDescList

④ 调用ankTryUpdatePnRouteDict持久化pn路由表

2. 组扩容

天然支持，cn查询时发现没有路由会向mn拉取，mn发现对应的pnGroupId和dsId没有路由会自动生成一个新的

3. 组缩容

① 节点组内节点数据不可以删除到0哥，需要调用dbms_cm.delete_group才能完全删除一个组

② 相应组缩容事件触发，通知cn删除本地路由并进行无效化，mn删除本地路由同时也进行无效化

### 5.5.7 路由版本管理

路由版本管理，有两种可选方案：

**方案一：**

在之前存算一体架构中也有系统路由表（ROUTE$），表中有version字段表示路由版本。但在具体的实现上，并没有将version字段用起来。

在存算分离架构中，用了一张新的系统表PN_ROUTE$来表示PN的路由（表定义见5.4）。表中的version字段，是对 DataSpace + PN组 + Chunk而言，即每个DataSpace每个PN组的每个Chunk，有自己的路由版本。

路由版本号更新：

1. MN和CN在内存中为每个DataSpace的每个PN组维护一个版本号，版本号的值为该DataSpace在该PN组下，所有chunk的版本号的最大值；

2. 当发生路由变动时，MN将版本号值自增1；

3. 发生了路由变动的那些chunk，其version值更新为新的版本号值，并同步到系统路由表；

4. MN推送更新路由通知到CN；

5. CN判断通知内容中DataSpace和PN组的version值，如果大于本地的版本值，则从系统路由表读取新的路由信息，并更新本地版本值。

**方案二：**

之前的存算一体架构中，是通过数据空间系统表（DATASPACE$）中的version字段来管理路由版本的。只要路由或DN组构成发生变化，DataSpace的version值就会加1。

DATASPACE$系统表的定义如下：

```
NAME                                                NULL?      DATATYPE                          
--------------------------------------------------  ---------  --------------------------------- 
DS_ID                                               NOT NULL   BIGINT                            
NAME                                                NOT NULL   VARCHAR(64)                       
CHUNK_COUNT                                         NOT NULL   INTEGER                           
GROUP_COUNT                                         NOT NULL   INTEGER                           
GROUPS                                              NOT NULL   VARCHAR(8000)                     
VERSION                                             NOT NULL   BIGINT
```

在方案二中，复用DATASPACE$表中version，来对PN组的路由版本号进行更新。即：DN组变动，以及任意PN组内节点变动，都会使version值加1。

**方案选择：**

|  
|优势|不足|
|---|---|---|
|方案一|DN路由和PN组路由解耦；,路由版本的控制粒度更细；,只需依赖PN_ROUTE$一张系统即可。|工程实现：有额外的复杂度。|
|方案二|工程实现：可以基于在已有的流程基础上来实现。|带来了耦合：DN组的节点变动，以及任意PN组内节点变动，都会使version值加1；,路由版本粒度较粗；,依赖PN_ROUTE$和DATASPACE$两张系统表。|


对比两种方案的优缺点，因为DN的路由版本和PN的路由版本应该区分开来管理，所以  **选用方案一**  。

**CN检测到PN节点异常：**

如5.5.2所述，在CN检测到PN节点异常后，并不需要去通知其他CN或MN。而是按照单调性原则分配新的路由，并更新内存数据结构。并不需要去更新系统表。

这里要注意，在CN在本地重新分配了路由，并更新了内存数据结构后，并不需要去更新路由版本号。路由版本号统一由MN节点来管理。

**PN节点对路由版本的维护：**

在每次查询执行，CN会将PN组的路由版本号也带给PN，然后PN会更新本地维护的版本号。

**PN上拒绝路由过时的查询计划：**

在PN节点需要维护dataspace各pn组的路由版本号。

在PN节点做Prepare阶段，如果发现CN下发的路由版本号小于本节点维护的版本号，则返回路由过时的错误信息。

## 5.6 PN扩缩容机制与故障处理流程

PN扩缩容时，涉及到chunk的路由变动。

与DN扩缩容机制不一样的是，PN节点之间不做chunk数据的搬迁。chunk数据路由发生变动后，新路由的PN节点在第一次查询Miss时，会去S3读取；而Chunk老路由的PN节点对应的Cache，则按照一定算法（比如LRU）进行淘汰。

**扩容：**

    1.  扩容新PN节点；

    2.  原来的PN节点上的部分chunk，路由更新为新PN（遵循：  *i.*   保持每个PN节点chunk数的均衡（相差不超过1）；   *ii.*   尽可能少的chunk路由变动）；

    3.  MN更新系统路由表；

    4.  MN通过MetaAgent推送路由更新的消息到CN（消息内容见5.5.3）；

    5.  CN的MetaAgent收到路由更新通知；

    6.  CN判断版本号，从MN拉取路由并更新内存路由数据结构和系统表；

    7.  新PN在第一次会去S3读取；

    8.  新PN cache chunk数据

    9.  路由变更的chunk原来所在PN，按lru方式淘汰cache。

**缩容：**

*过程和扩容类似。*

    1.  缩容PN节点；

    2.  原来在缩容PN上的chunk，路由变更到剩余的PN节点上，（遵循：  *i.*   保持每个PN节点chunk数的均衡（相差不超过1）；   *ii.*   尽可能少的chunk路由变动）；

    3.  MN更新系统路由表；

    4.  MN通过MetaAgent推送路由更新的消息到CN（消息内容见5.5.3）；

    5.  CN的MetaAgent收到路由更新通知；

    6.  CN判断版本号，从MN拉取路由并更新内存路由数据结构和系统表；

    7.  chunk路由变动到的PN在第一次会去S3读取；

    8.  chunk路由变动到的PN cache chunk数据；

    9.  路由变更的chunk原来所在PN，按lru方式淘汰cache

**节点恢复并重新加入：**

PN节点因网络故障或节点宕机而失联，然后网络恢复或节点重启，节点重新加入：出于设计复杂性的考虑，按照“缩容1个节点，然后扩容的1个节点”相同的流程处理。

**节点短暂失联：**

PN节点因网络故障短暂失联，在被认为节点失效之前，节点恢复。对这种情况，只有内存的路由数据结构需要调整，并不需要更新系统表。在短暂失联期间，由其他PN节点直接从S3读取数据。

**“脑裂”场景：**

“脑裂”问题发生在多CN的场景。比如，对某个PN（假设为PN1），由于网络故障等原因，CN1判断PN1是故障节点；而CN2和PN1的通信是正常，因此CN2判断PN1属于正常的节点。CN1和CN2对节点PN1的状态判断发生了不一致。

处理方式：  容忍CN之间对PN节点状态判断不一致的情况，各CN只在内存数据结构中处理异常节点的路由变动。如果是短暂的节点异常，则在异常恢复时，可以从系统表恢复原有路由。

# 6 Test Cases（自测用例）

*设计开发人员自测用例（文字描述）。*

自测用例与测试结果：

  [存算分离HA测试方案](https://conf.yasdb.com/pages/viewpage.action?pageId=147782018)  

  [存算分离可靠性测试](https://conf.yasdb.com/pages/viewpage.action?pageId=152995503)  

# 7 Workload（工作量）

*评估代码量KLOC、工作量（人天）*

|任务分解|工作量|说明|
|---|---|---|
|PN路由表信息维护管理|4人天|  
|
|路由算法(包括变更算法)与路由接口实现|3人天|  
|
|各节点(MN/CN/PN)路由更新与版本管理实现|3人天|  
|
|节点扩缩容与节点异常等处理（主要是MN）|4人天|  
|
|MM模块：路由更新的消息发布和处理|2人天|  
|
|支持按需方式创建路由记录|4人天|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|


# 8 References（参考文档）

主要参考：

[1].       [存算分离架构](https://conf.yasdb.com/pages/viewpage.action?pageId=119559628)  

[2].       [YashanDB分布式表数据分布分区机制分析](https://conf.yasdb.com/pages/viewpage.action?pageId=124263846)  

[3].       [分布式订阅推送方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91781847)  

[    [4](/pages/createpage.action?spaceKey=YAS&title=4)    ].       [MetaAgent支持PN路由变化通知设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722)  

# 9 TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

# 10 会议纪要

会议时间：

  


## Attachments: