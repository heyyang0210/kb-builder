Created by 刘建中, last modified on 六月 07, 2024

##   [1. 概述](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#1-overview%E6%A6%82%E8%BF%B0)  

**背景**

MetaAgent是存算分离架构中新引入的一个模块：

```
typedef struct StAndInstance {
    AndAttr         attr;
    GtsMgr          gtsMgr;
    LgtsMgr         lgtsMgr;
    MmMgr           mmMgr;
    LmmMgr          lmmMgr;
    ClusterManager  cm;
    TmMgr           tmMgr;
    AndIcsMgr       icsMgr;
    AndSessionMgr   sessionMgr;
    PubMgr          pubMgr;
    AndTaskManager  taskManager;
    AndMetaAgent    metaAgent;    //新引入模块
} AndInstance;
```

  [MetaAgent](https://conf.yasdb.com/pages/viewpage.action?pageId=135620691)    主要用于元数据拉取（PN与DN之间的存储元数据，CN与MN之间的路由数据）以及路由更新通知。MetaAgent提供  方便扩展且高效的节点间消息管理。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

目前MetaAgent的功能主要包括：

- PN(存储层)从DN获取需要的元数据；
- CN向MN拉取路由；
- MN向CN通知路由变更消息。


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#3-interfaces%E6%8E%A5%E5%8F%A3)  

模块初始化与启停相关接口：

```
CodResult andMetaAgentInit(AndInstance* inst);
CodVoid andMetaAgentDestroy(AndInstance* inst);

CodResult andMetaAgentStartup(AndInstance* inst);
CodVoid andMetaAgentShutdown(AndInstance* inst);
```

存储层拉取元数据相关接口

```
CodResult andMetaAgentRequestTableMeta(const AndMetaAgentRequestInfo* info, CodUint64 tableVersion, CodUint64 oid, TableMeta** tableMeta);
CodResult andMetaAgentRequestChunkMeta(const AndMetaAgentRequestInfo* info, const MetaStoreChunkInfo* info, ChunkMeta** chunkMeta);
CodResult andMetaAgentRequestSlscMeta(const AndMetaAgentRequestInfo* info, onst MetaStoreDataInfo* info, SLscMeta** meta);
CodResult andMetaAgentRequestDbmMeta(const AndMetaAgentRequestInfo* info, const MetaStoreDataInfo* info, SLscDbmMeta** meta);
```

路由相关接口：

```
// 路由通知相关：
CodVoid maNotifyManagerInit(AndMetaAgent* agent);
CodVoid maNotifyManagerDestroy(AndMetaAgent* agent);

// 供ma_pn_route_update.c使用
CodResult maNotifyPnRouteInfo(AndMetaAgent* agent, MaNotifyPnRouteInfo* info);
CodVoid maNotifyAckProc(AndMetaAgent* agent, CodPointer arg);
CodVoid maNotifyMsgProc(AndMetaAgent* agent, CodPointer arg);

// 拉取路由相关：
CodResult andMetaAgentGetPnRouteMeta(AnkHandler* kHandler, MemoryContext* mctx, CodUint64 dsId, CodGroupId pnGroupId, CodUint64 localVersion, List** pnRouteDescList, CodUint64* version);
```

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

目前设计仅用于元数据（如存储层元数据、路由数据等）相关功能

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 5.1 MetaAgent模块框架

MetaAgent定义如下：

```
typedef struct StAndMetaAgent {
    volatile CodBool isInited;
    volatile CodBool isStarted;
    CodUint8         unused[2];

    // client-side (PN/CN)
    SpinLock        requestsLock;
    CodAtomicUint64 currentReqId;
    LinkList        requests;  // Item = AgentRequest

    // server-side (DN/MN)
    AndInstance*  inst;
    CodMsgQueue   queue;  // Msg = AgentRequestMsg
    WorkerPool    workerPool;
    CodThread     mainThread;
    CodThreadLock routeLock;

    MaNotifyManager notifyManager;
    MaTimerManager  timerManager;
} AndMetaAgent;
```

一个通用的处理过程如下：

- 元数据（存储层元数据，路由数据）拉取请求进来，放入queue；
- MetaAgent在mainThread里从queue读取消息，并生成对应的task；
- 将task放入线程池workerPool处理；
- 路由更新通知通过notifyManager来完成；
- timerManager处理发送时的超时和重试。


MetaAgent处理的ICS消息类型：

```
typedef enum EnIcsCommand {
    // ...
    ICS_CMD_META_AGENT_DC = 360,
    ICS_CMD_META_AGENT_DC_ACK = 361,
    ICS_CMD_META_AGENT_CHUNK = 362,
    ICS_CMD_META_AGENT_CHUNK_ACK = 363,
    ICS_CMD_META_AGENT_SLSC = 364,
    ICS_CMD_META_AGENT_SLSC_ACK = 365,
    ICS_CMD_META_AGENT_DBM = 366,
    ICS_CMD_META_AGENT_DBM_ACK = 367,
    ICS_CMD_META_AGENT_PN_ROUTE_PULL = 368,
    ICS_CMD_META_AGENT_PN_ROUTE_PULL_ACK = 369,
    ICS_CMD_META_AGENT_NOTIFY = 370,
    ICS_CMD_META_AGENT_NOTIFY_ACK = 371,
    ICS_CMD_META_AGENT_SAC_MAP = 372,
    ICS_CMD_META_AGENT_SAC_MAP_ACK = 373,
    // ...
} IcsCommand;
```

对应到MetaAgent内部处理类型：

```
typedef enum StMaMsgType {
	MA_DC_META,
	MA_CHUNK_META,
	MA_PART_META,
	MA_LOAD_DELETE_MAP,
	MA_PN_ROUTE_PULL,
	MA_NOTIFY,
	MA_NOTIFY_ACK,
	MA_PART_SAC_MAP,
	__MA_MSG_TYPE_COUNT__
} MaMsgType;
```

### 5.2 获取存储层元数据

PN节点获取元数据流程如下（来源：    [MetaAgent设计文档 [v3]](https://conf.yasdb.com/pages/viewpage.action?pageId=135620691)    ）：

![](https://conf.yasdb.com/download/attachments/135620691/meta-agent-v3-pn-query.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NDIsImV4cCI6MTc4MjQ0OTY0Mn0.prWjWQ8EHhYqHGJ092Bspwh53GmoGt3P59cou2aDJ20)

                                                                                                                     图1

DN节点对消息处理流程如下：

![](https://conf.yasdb.com/download/attachments/135620691/meta-agent-v2-dn-query.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NDIsImV4cCI6MTc4MjQ0OTY0Mn0.prWjWQ8EHhYqHGJ092Bspwh53GmoGt3P59cou2aDJ20)

                                                                                      图2

### 5.3 路由更新通知和路由拉取

PN节点扩缩容，节点启停，节点异常或异常恢复等情况，对应到CM event：

```
typedef struct StCmEvent {
    CmEventType type;
    union {
        CmEventAddNode        addNode;      //扩容PN
        CmEventDeleteNode     deleteNode;   //缩容PN
        CmEventAddGroup       addGroup;     
        CmEventDeleteGroup    deleteGroup;  //删除PN组
        CmEventRoleChanged    roleChanged;
        CmEventRunningStateChanged runningStateChanged;    // PN节点异常/异常恢复
        CmEventNodeStateChanged    nodeStateChanged;       // PN节点启动/停止
    };
} CmEvent;
```

其中nodeState和runningState，可以参考下图（    [集群管理重构详细设计文档](/pages/createpage.action?spaceKey=YAS&title=%E9%9B%86%E7%BE%A4%E7%AE%A1%E7%90%86%E9%87%8D%E6%9E%84%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3)    ）：

![](https://conf.yasdb.com/download/attachments/95110445/%E7%8A%B6%E6%80%81%E8%BF%81%E7%A7%BB.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NDIsImV4cCI6MTc4MjQ0OTY0Mn0.prWjWQ8EHhYqHGJ092Bspwh53GmoGt3P59cou2aDJ20)

                                                                                                                图3

MN节点收到cm event后，通过MetaAgent的  *CodVoid andMetaAgentProcCmEvent(AndInstance* inst, CmEvent* event);*  方法进行处理。

在  *andMetaAgentProcCmEvent*  方法中，按照路由算法变更路由（详见：    [YDBRD-26822 分布式支持PN组路由管理概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=153023493)    ），然后会发送路由变更通知给CN节点。

CN节点在收到变更通知，比对路由版本，发现本地版本过时，则去MN拉取路由：

对路由拉取新增一组消息，cn通过消息拉取mn本地的pn_route：

```
AND_MSG_DEF(ICS_CMD_META_AGENT_PN_ROUTE, 0, ICS_CONN_VER_INIT, anrProcMetaAgentMsg),
AND_MSG_DEF(ICS_CMD_META_AGENT_PN_ROUTE_ACK, 0, ICS_CONN_VER_INIT, anrProcMetaAgentAck),
```

消息体：

```
typedef struct StMaPnRouteMsg {
    CodUint64  reqId;
    CodUint64  dsId;
    CodUint64  version;  // cn local pn route version
    CodGroupId  pnGroupId;
    CodChar   reserve[4];
} MaPnRouteMsg;
 
typedef struct StMaPnRouteAck {
    CodUint64  reqId;
    CodUint64  dsId;
    CodUint64  version;
    CodGroupId  pnGroupId;
    CodError  error;
    List*    chunkRoute;  // The containing element is CodUint32
} MaPnRouteAck;
```

  


Notify功能是在MetaAgent基础上的扩展，增加了通知推送能力。

PN路由推送可以进行高效收发，以及消息重试，同时PN路由推送无需关心具体实现，由MetaAgent框架提供。

以下为pn route路由变更的通知过程：

**通知端：**

① 其他模块调用MetaAgent提供的接口   *maNotifyPnRouteInfo*  ，接收后简单打包为   *MaNotify*   提交到任务执行；

② 消息进一步进行处理，创建MaNotifyTask提交到定时任务，并发送ics消息给各个cn节点进行通知：

- MaNotifyTask将会有一个字段   *MaNotifyInfo*  * *  *notifyInfo*  ，里面保存pn路由的相关消息；
- 创建任务之前会去尝试遍历是否存在相同dsId和pnGroupId的任务，有则直接覆盖并且重置sendTimes，targetNodes和readyToSend；


③ 任务通过定时器进行重新执行，初步预设进行5次重试。

**定时任务：**

① 定时任务超时会触发maNotifyPnRouteTimeoutProc

② 定时任务触发时：

- 为了在高频触发通知时（比如：快速新增多个pn节点）复用定时任务，同时为了防止复用定时器后刚好触发执行定时任务去重发通知，因此：
- 如果timer存在，则不主动发送通知，等待timer计时器触发来负责消息发送


**接收端：**

① 接收通知消息，推到工作线程；

② 处理消息：如果是路由更新，则比对版本并判断是否失效本地路由版本；

③ 返回响应。

**通知端接收响应：**

① 接收通知消息，推到工作线程；

② 解析消息后通过遍历找到对应的MaNotifyTask，删除对应的目标节点；

③ 确认全部都清空后可以清除该定时任务。

路由通知发送与超时处理过程可以参考下图（来源：    [MetaAgent支持PN路由变化通知设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722)    ）：

![](https://pingcode.yasdb.com/atlas/files/public/67396eba8970c2af4f521ac6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NDIsImV4cCI6MTc4MjQ0OTY0Mn0.prWjWQ8EHhYqHGJ092Bspwh53GmoGt3P59cou2aDJ20)

                                                                                                        图4

**主要数据结构定义**

路由通知定义相关：

```
typedef enum EnMaNotifyType {
    MA_NOTIFY_TYPE_INVALID = 0,
    MA_NOTIFY_TYPE_PN_ROUTE_UPDATE = 1,
    // 支持后续消息类型扩展
} MaNotifyType;

// CN收到通知后的操作：
typedef enum EnMaNotifyPnRouteAction {
    MA_NOTIFY_PN_ROUTE_ACTION_INVALID = 0,
    MA_NOTIFY_PN_ROUTE_ACTION_UPDATE,
    MA_NOTIFY_PN_ROUTE_ACTION_DELETE,
} MaNotifyPnRouteAction;

typedef struct StMaNotifyPnRouteInfo {
    CodUint64             dsId;
    CodUint64             version;
    CodGroupId            pnGroupId;
    MaNotifyPnRouteAction action;
} MaNotifyPnRouteInfo;

typedef struct StMaNotifyInfo {
    MaNotifyType type;
    CodUint8     unused[4];
    union {
        MaNotifyPnRouteInfo pnRouteInfo;
    };
} MaNotifyInfo;

// 发送通知
typedef struct StMaNotifyMsg {
    CodUint64    reqId;
    MaNotifyInfo info;
} MaNotifyMsg;

// 通知响应内容
typedef struct StMaNotifyAck {
    CodUint64    reqId;
    CodNodeId    nodeId;
    MaNotifyType type;
    CodUint8     unused[4];
} MaNotifyAck;
```

与通知发送过程和定时器相关的：

```
typedef struct StMaNotifyTask {
    LinkListNode node;
    CodUint32    refCount;  // refCount is maintained by MaNotifyTasks
    CodUint8     unused[4];

    CodThreadLock  lock;
    MemoryContext* memCtx;
    CodUint64      reqId;
    LinkList       targetNodes;  // MaNotifyTargetNode
    MaTimer*       timer;
    CodUint32      sendTimes;
    MaNotifyState  state;
    MaNotifyInfo   notifyInfo;
} MaNotifyTask;

typedef struct StMaNotifyTasks {
    CodThreadLock lock;
    LinkList      taskList;  // MaNotifyTask
} MaNotifyTasks;

typedef struct StMaNotifyManager {
    MaNotifyTasks pnRouteTasks;
} MaNotifyManager;

// 定时器类型：（目前只有通知的类型）
typedef enum EnMaTimerType {
    MA_TIMER_TYPE_INVALID = 0,
    MA_TIMER_TYPE_NOTIFY,
} MaTimerType;

typedef struct StMaTimer {
    // AndTimer must be head of the struct
    AndTimer    base;
    MaTimerType type;
} MaTimer;
```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

用例参考：

  [存算分离HA测试方案](https://conf.yasdb.com/pages/viewpage.action?pageId=147782018)  

##   [7. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

|任务分解|工作量|备注|
|:---|:---|:---|
|MetaAgent框架|2人天|  
|
|MetaAgent提供拉取接口|3人天|  
|
|MetaAgent提供notify，timer能力|2人/天|  
|


##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

##   [9. Reference（参考文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722#9-%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3)    ）

[1]     [notify机制详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=100094348)  

  [[2] 集群管理通信消息详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95114863)  

  [[3] MetaAgent设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=135620691)  

[4]     [MetaAgent支持PN路由变化通知设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=147756722)  

[5]     [YDBRD-26822 分布式支持PN组路由管理概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=153023493)  

  


  


## Attachments:

[pn_notify_data_structure.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYmE4OTcwYzJhZjRmNTIxYWMzIiwicmVmX2lkIjoiNjczOTZlYjk3MjgyMDZlZmI5MmYyYmQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODQyLCJleHAiOjE3ODI1MjUyNDJ9.PtzwfSuZwYeBGCffHD-fRsvHcWM8GUZ-3tkzQVvyt_Q)

 (image/png)    


[pn_notify2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYmFhMWFkOWEzMzExZGM5OTM3IiwicmVmX2lkIjoiNjczOTZlYjk3MjgyMDZlZmI5MmYyYmQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODQyLCJleHAiOjE3ODI1MjUyNDJ9.GMH7ClukgSbAcXA10VwSO9ibnIBMuvlgEWcVUOdWXNg)

 (image/png)    


[pn_notify2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYmE4OTcwYzJhZjRmNTIxYWM0IiwicmVmX2lkIjoiNjczOTZlYjk3MjgyMDZlZmI5MmYyYmQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODQyLCJleHAiOjE3ODI1MjUyNDJ9.JQM9RLFHYRR-utsNE-OC-q9dsK5ihpq80UtUuG_qaCI)

 (image/png)    
