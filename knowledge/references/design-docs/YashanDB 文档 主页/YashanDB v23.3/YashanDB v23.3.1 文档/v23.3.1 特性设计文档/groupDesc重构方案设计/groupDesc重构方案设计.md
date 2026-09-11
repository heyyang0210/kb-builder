Created by 郭泽霖, last modified on 五月 31, 2024

  [IR : YASHAN-2855 分布式GroupDesc结构重构](https://pingcode.yasdb.com/ship/ideas/66279b64009f91eb87f67a88)  

  [SR : YDBRD-26829 GroupDesc结构优化](https://pingcode.yasdb.com/pjm/items/66385367c36a3d30a8619084)  

##   [1. 总述](#1-总述)  

问题本质上是，sql层设计的stage pipeline这一概念，没有对应的数据结构。所使用的GroupDesc这一结构，在各种场景下大量复用：

```
typedef struct StGroupDesc {
    union {
        CodUint32     groupId;    // route,optimizer,prepare,executor 
        CodUint16     endpoint;   // executor
    };
    GroupStrategy strategy;  // route,optimizer,prepare
} GroupDesc;

```

尤其是执行跟优化的复用，groupId跟endpoint纠缠在一起，很不好理解。另一方面，为了支持在pn执行sql，也需要对此结构做一定扩展，添砖加瓦很麻烦，不如直接重构。重构的目标：执行时尽量不使用GroupDesc

###   [1.1 需求来源](#11-需求来源)  

内部技术需求

影响分布式、集群视图查询

###   [1.2 调研文档](#12-调研文档)  

无，内部结构调整

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子功能1||否|否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|**是**|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

无

##   [4. 特性](#4-特性)  

###   [4.0 现状](#40-现状)  

GroupDesc的使用点巨多，但基本都是有迹可循的，如图所示：

![](download/attachments/144125049/groupDesc.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwMjEsImV4cCI6MTc4MjQ0ODgyMX0.kapwILMf_FMB_c5NihG7_IQ2A70zBgoWzOKjNqaOW3U)

1. 直接使用GroupDesc的调用点，多为分布式计划产生与路由相关接口。
1.     - strategy跟id本质上是正交的

1. DstbCoordPlan上有一个GroupDesc成员，大体的含义是表示当前的coord/subCoord在哪个stage pipeline上执行，计划和执行都在用
1.     - 实际上这里的strategy没什么用

1. TabQueuePortGroup的GroupDesc成员，表示TabQueue的端口，计划产生，执行时会转为endpoint，也因此GroupDesc union了一个endpoint成员。
1.     - 执行完createTabQueueToEndpoint后，此处的GroupDesc完全失去了作用

1. ExecGroupArray中保存了GroupDesc到endpoint的映射关系，一个作用是在需要endpoint的时候调用，把GroupDesc转成endpoint；另外会下发给所有查询涉及到的节点，与路由表配合使用计算hash重分发的端口以及runtime filter的端口
1.     - 路由表中存的是chunk->groupId，因此即使port上已经是endpoint，计算hash重分发仍然需要key->chunk->group->endpoint
    - runtime filter单纯没有转换

1. 另外，pn查询需要对stage pipeline做出抽象，类似type+id的方式。
1.     - 目前实现是pn与dn两套路由，单纯id不够表达，需要type辅助，甚至标记都可以。



###   [4.1 特性设计](#41-特性设计)  

根据现状的描述，可以简单做出以下几点结论：

1. 除了涉及GroupDesc到endpoint转换的点，strategy没有任何作用，完全可以在结构体内铲掉，单独描述
1.     - **除非一个plan里，一个id+type能够对应多个strategy**  ，例如分布式视图join分布表
    - 维护一个id+type到strategy的映射，直接挂在masterDstbCoordPlan上面，后面根据这个映射产生id+type到endpoint的映射

1. DstbCoordPlan上需要保留id+type
1.     - 当前的subplan下发框架，并非把stage的rootPlan下发给stage的nodes，而是根据subCoord下发的
    - 并且dn/pn上也有可能访问这个成员

1. TabQueuePortGroup计划完全不需要，甚至TabQueueAttr都不需要，此结构的创建推后到执行
1.     - 当前先在TabQueuePortGroup中去掉GroupDesc，考虑在TabQueueAttr上加id+type，在createTabQueueToEndpoint时实现转换
    - Port需要保留type知道自己访问pn/dn哪个路由表，一个bool足矣

1. ExecGroupArray中实际也只需要保存id+type到endpoint的映射
1. 综上，GroupDesc可以使用全新的结构体来代替：
1. 这个描述执行和计划共同使用感觉没有任何问题。
1.     - 集群是什么？



```
typedef enum EnStagePipeType {
    STAGE_PIPE_GROUP = 0,
    STAGE_PIPE_NODE,
} StagePipeType;

typedef struct StStagePipe {
    union {
        CodGroupId groupId;
        CodNodeId  nodeId;
    };
    StagePipeType  type;
} StagePipe;

```

###   [4.2 结构体变化](#42-结构体变化)  

```
typedef struct StTabQueuePortGroup {
  //  GroupDesc groupDesc;
    CodUint16 endpoint; // new
    CodUint16 start;
    CodUint16 count;
    CodBool   isAbort;
    CodBool   isPnRoute; // new
} TabQueuePortGroup; //名字感觉可以改成TabQueuePort了

typedef struct StTabQueueAttr {
    ...
    CodUint16          readerPGroupCount; // new
    CodUint16          writerPGroupCount; // new
    StagePipe*         readerPGroups; // new
    StagePipe*         writerPGroups; // new
    
    // TabQueuePortGroup* readerPGroups;
    // TabQueuePortGroup* writerPGroups;
    CodUint16     readerPortCount; // new
    CodUint16     writerPortCount; // new
    TabQueuePort* readerPorts; // new
    TabQueuePort* writerPorts; // new
    ...
} TabQueueAttr;

typedef struct StPxStage {
    ...
     // CodUint16          groupCount;
    // TabQueuePortGroup* portGroups; /* stage instances on nodes */
    CodUint16          pipeCount; //new
    StagePipe*         pipes; /* stage instances on nodes */  //new
    ...
} PxStage

// describe pipe &amp; strategy
typedef struct StGroupDesc {
    StagePipe     pipe;
    GroupStrategy strategy;
} GroupDesc;

typedef struct StDstbCoordPlan {
    ...
    //GroupDesc    groupDesc;
    //CodUint16    groupId;
    StagePipe*     pipe;
    ObjectArray*   GroupDescs; // store pipe -&gt; strategy, master only; use hashmap?
    ...
} DstbCoordPlan;

typedef struct StExecGroupItem {
    // GroupDesc  group;
    StagePipe  pipe;
    CodUint32  endpointCount;
    CodUint16* endpoints;
} ExecGroupItem;

```

###   [4.3 流程](#43-流程)  

1. 在路由接口外边包一层，将产生的GroupDesc转成pipe与strategy的映射关系记录到全局数组/哈希表里，并把这个挂到dstbCoord上
1.     - 或者不动原有的groupMaker流程，只在planner修改trySetRtFilterGroups，setPortGroups，createCoordPlan这几处的AnlPlan结构，同时建立映射

1. 接口调整
1.     - createDstbExecGroupArray，改为用上文所提到的数组/哈希表直接转，不再使用coord
    - createTabQueueToEndpoint，将原地改变成用pipe+映射关系转换
    - crab接口调整



![](download/attachments/144125049/process.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwMjEsImV4cCI6MTc4MjQ0ODgyMX0.kapwILMf_FMB_c5NihG7_IQ2A70zBgoWzOKjNqaOW3U)

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

无

##   [6.资料设计章节](#6资料设计章节)  

无

##   [7.未来规划](#7未来规划)  

1. 路由接口去掉GroupDesc，将strategy映射逻辑改为使用PipeType，完全替代GroupDesc
1. TabQueueAttr的创建整个推后到执行，根据stage或其他办法直接建立endpoint
1. 路由表接口调整，建立chunk->endpoint的映射关系，在dn/pn上不再访问路由表


## Comments:

|  [](null)  ,与会人：李伟超，徐晓锋，黄靖东，林俊喆，施新华，李世铭，郭泽霖    
  会议时间：2024/05/31    
  纪要信息：    
  1.同意技术方案，run    
  2.StagePipe成员采用CodNodeId，pipe->strategy映射采用数组    
  3.后序演进考虑optimize时是否感知与使用路由,Posted by guozelin at 五月 31, 2024 11:57|
|---|
