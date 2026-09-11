Created by 邬建川, last modified on 五月 14, 2024

*-SR链接：*

  [https://pingcode.yasdb.com/pjm/items/661690a8fd997db58ad70a67](https://pingcode.yasdb.com/pjm/items/661690a8fd997db58ad70a67)    ?    
  #YDBRD-26064 支持视图展示CN/DN间的消息等待事件统计

##   [1. 总述](#1-总述)  

增加cn/dn间消息交互流程中的等待事件，以增强相关场景下的问题定位能力。

###   [1.1 需求来源：](#11-需求来源)  

- 内部需求，  **来源**  ：深智城   **场景**  ：问题定位能力补齐
- 支持形态： 分布式


###   [1.2 调研文档：](#12-调研文档)  

略

###   [1.3 需求分析：](#13-需求分析)  

增加cn/dn交互过程中的等待事件，主要聚焦于一般执行过程中cn或者dn需要进行等待的场景。通过详尽需要等待的场景，增加相应的事件，增强问题定位能力。

###   [1.4 数据字典：](#14-数据字典)  

略

###   [1.5 开源依赖：](#15-开源依赖)  

略

##   [2. 接口](#2-接口)  

###   [等待事件相关视图(已存在)：](#等待事件相关视图已存在)  

- **v$system_event**
- **v$session_wait**
- **v$session**


###   [等待事件](#等待事件)  

|类型|事件名|节点|场景|开始|结束|
|---|---|---|---|---|---|
|分布式节点交流统一事件|wait distributed result|cn/其他节点|一般分布式下消息交流的命令字，没有添加具体事件就是这个|发送端发送消息|接收到消息回信|
|cn/dn 建连|cn connecting dstb node|cn|分布式会话，cn/其他节点建连|cn发送建连命令|其他节点处理建连结束，cn收到ack，一次可能同时等待多个节点建连结束|
||dstb node wait cn cmd|dn/mn/cn 包括备机|分布式会话，其他节点建连后轮询等待cn的cmd|建连完成后，没有正在执行的命令字时|有命令正在执行，或者会话结束|
|channel数据传输|tabqueue channel receive data（暂不添加）|cn/dn/ 集群|分布式执行数据传输的网络交互|查询执行中cn接收一次channel发送的数据|接收结束|
||stats channel receive data|cn|收集统计信息channel传输数据|cn接收一次channel发送的msg|接收结束|
|lob|dstb lob data request|cn|分布式lob查询, lob read data时的等待，read length不添加|lob请求端发送请求|接收完lob数据|
|执行|alloc px res(已有)|cn/ 单机|并行资源申请|一次执行的整个资源申请之前|该次执行资源申请结束|
||dstb release px res|cn|并行资源释放|申请资源失败的场景，cn发送释放资源命令字|所有dn完成资源释放并ack|
||dstb dml prepare|cn|执行前prepare|资源申请及plan的序列化等操作结束后，发送prepare命令字等待dn处理|所有dn完成prepare操作并ack|
||dstb dml start|cn|实际执行的命令字|查询语句，prepare结束后cn发送start命令字|所有stage group 执行结束|
|事务|xa prepare|cn|2pc的prepare|cn发送事务prepare给涉及的dn|所有dn 事务prepare完成|
||xa commit|cn|2pc的commit|cn发送事务commit|所有dn commit完成|
||check xa end（已有）|cn|异常场景等待事务结束|事务commit出现异常时，等待事务二阶段提交|dn事务结束后，ack|
||dstb commit|cn|单节点commit|发送相应命令字给dn执行|cn等待所有dn完成相应命令|
||dstb rollback|cn|rollback all/ rollback savepoint/ rollback current|以下同上||
||dstb savepoint|cn|生成新savepoint|||
||dstb release savepoint|cn|删除savepoint|||
|ddl/dcl|dstb alter system|cn|cn等待其他节点alter system操作|||
||dstb alter sesssion|cn|cn等待其他节点的alter session操作|||
||dstb execute ddl|cn|cn发送ddl给 mn/dn 等待目标执行结束|||
||dstb execute dcl|cn|ddl的事务操作|||


##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

- 完善cn/dn消息交互场景中的等待事件


##   [5. 详细设计](#5-详细设计)  

分析每个ics命令字是否需要添加等待事件

###   [需要添加](#需要添加)  

####   [按ICS命令字分类：](#按ics命令字分类)  

#####   [DIN_CONNECT cn/dn 建立 innerConnection：](#din-connect-cndn-建立-innerconnection)  

- 目前没有相应等待事件，cn上增加等待事件。 dn建连后轮询线程添加等待cn发送命令的事件。


#####   [ICS_CMD_TABQ tabQueue](#ics-cmd-tabq-tabqueue)  

- pxColWrite 添加等待事件
- pxColRead 添加等待事件


#####   [ICS_CMD_DATA_BUS channel 统计信息收集：](#ics-cmd-data-bus-channel-统计信息收集)  

- 统计信息收集， CN向 其他CN/DN 发送　gather_stats的dph命令字， 其他节点利用cahnnel向CN发送统计信息， cn chnRecvMsg 接收统计信息


该部分实际等待时间在channel上，不为该命令添加额外等待事件

- 增加cn等待其他节点发送统计信息的事件
- dn：发送，客户端连接的cn：接收and发送，其他cn：接收。


#####   [ICS_DPH_NET：](#ics-dph-net)  

涉及命令字，disconnect，cancel，base_ack, lob_ack, runtime_filter, runtime_filter_ack    
  接收端由网络线程处理

- **RUNTIME_FILTER**   后， cn wait_ack可以添加等待事件。
- **CANCEL**  后cn，采用统一的等待事件 dstb_wait_result
- **DISCONNECT**    cn没有等待


#####   [ICS_CMD_DPH_WORKER 执行控制：](#ics-cmd-dph-worker-执行控制)  

- 该类型的命令字较多，涉及dcl，ddl，dml，查询，统计信息收集等等，目前CN端会有一个统一的wait_dstb_result等待事件。
- ack类型不需要添加等待事件（回消息端）
- 其他一律细化为具体cmd


####   [按使用场景分类及展开：](#按使用场景分类及展开)  

#####   [cn/dn 建连](#cndn-建连)  

||事件|节点|展开说明|
|---|---|---|---|
||cn connecting to dn|cn|执行中，分布式会话建立时的一次消息交互，cn等待dn完成建连|
||dn wait cn cmd|dn|分布式会话cn/dn建连成功后， dn的消息轮询线程等待cn进一步命令字的等待事件|


#####   [channel 数据传输](#channel-数据传输)  

||事件|节点|展开说明|
|---|---|---|---|
||tabQueue channel receive data|cn/dn|分布式执行数据传输的网络交互|
||stats channel receive data|cn|收集统计信息时，cn通过channel接收来自dn的统计信息。 其他cn接收当前cn转发的统计信息|


#####   [lob](#lob)  

||事件|节点|展开说明|
|---|---|---|---|
||dstb lob|cn/dn|分布式lob插入和查询|


#####   [执行](#执行)  

||事件|节点|展开说明|
|---|---|---|---|
||alloc px res|cn|并行资源申请|
||release px res|cn|并行资源释放|
||dstb dml prepare|cn|执行prepare阶段，计划/事务 信息下发,dn上进行一些资源的初始化。对于没有并行的执行则直接anlExecute|
||dstb dml start|cn|实际执行阶段，触发dn调用 anlExecute|


#####   [事务](#事务)  

||事件|节点|展开说明|
|---|---|---|---|
||xa prepare|cn|两阶段提交中的prepare部分|
||xa commit|cn|两阶段提交中的commit部分|
||xa end check|cn|等待事务结束|
||dstb commit|cn|单节点提交，不走2pc|
||dstb rollback|cn|包括整个事务的rollback，rollback到某个savepoint， rollback 到当前savepoint|
||dstb savepoint|cn|创建savepoint|
||dstb release savepoint|cn|删除savepoint|


#####   [ddl/dcl](#ddldcl)  

||事件|节点|展开说明|
|---|---|---|---|
||dstb alter system|cn|alter system操作，cn等待其他节点执行完成|
||dstb alter session|cn|alter session操作， cn等待其他节点执行完成|
||dstb execute ddl|cn|cn等待mn或dn执行ddl|
||dstb execute dcl|cn|ddl的事务操作，commit，rollback，delay_clean等|


####   [等待事件添加的实现](#等待事件添加的实现)  

dphCmdMethod结构体  **增加等待事件字段**  ， anlWaitExecuteResult传入命令字，然后开启对应的等待事件

```
typedef struct StDphCmdMethod {
	CodText   name;
	CodUint8  cmdTrait;
	WaitEvent event;   // 新增
	// callback to be added
} DphCmdMethod;

```

内部添加的事件

```
static EventOperator gEventOperator[__EVENT_COUNT__] = {
    EVENT_OPER_DEF(EVENT_TABQ_CHN_RECEIVE,        "tabQueue channel receive data",       WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_STAT_CHN_RECEIVE,        "stats channel receive data",          WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_CONNECT_DN,              "cn connecting to dn",                 WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_WAIT_CN_CMD,             "dn wait cn cmd",                      WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_ALTER_SYS,          "dstb alter system",                   WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_ALTER_SESSION,      "dstb alter session",                  WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_XA_PREPARE,         "xa prepare",                          WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_XA_ROLLBACK,        "xa rollback",                         WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_XA_COMMIT,          "xa commit",                           WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_XA_END_CHECK,       "check xa end",                        WAIT_CLASS_DISTRIBUTED,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_COMMIT,             "dstb commit",                         WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_ROLLBACK,           "dstb rollback",                       WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_SAVEPOINT,          "dstb savepoint",                      WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_RELEASE_SAVEPOINT,  "dstb release savepoint",              WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_EXECUTE_DDL,        "dstb execute ddl",                    WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_EXECUTE_DCL,        "dstb execute dcl",                    WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_ALLOC_PX_RES,            "alloc px res",                        WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_RELEASE_PX_RES,          "release px res",                      WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_DML_PREPARE,        "dstb dml prepare",                    WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_DML_START,          "dstb dml start",                      WAIT_CLASS_APPLICATION,   Time),
    EVENT_OPER_DEF(EVENT_DSTB_LOB,                "dstb lob",                            WAIT_CLASS_APPLICATION,   Time),
};

```

###   [无需添加](#无需添加)  

#####   [ICS_CMD_TASK （分布式task相关）：](#ics-cmd-task-分布式task相关)  

- 目前分布式task 主要涉及dn组扩缩容，组内扩缩容相关任务。task框架对每个子任务有相应的视图可以查询到当前的执行状态。
- 无需添加等待事件。


#####   [ICS_CMD_SYN_GTS :](#ics-cmd-syn-gts-)  

- mn同步全局时间戳的命令字，mn进行全局的广播，并且不会等待回应。
- 无需添加等待事件。


#####   [ICS_CMD_PUBLISH （订阅推送）：](#ics-cmd-publish-订阅推送)  

- 存在视图查看消息的推送状态
- 无需添加等待事件


#####   [ICS_CMD_LOAD_DATA_OID (获取全局oid)](#ics-cmd-load-data-oid-获取全局oid)  

- 接收端mmMgr proc线程处理
- 和mn的交互


#####   [ICS_CMD_PENDING （未决事务管理） mn和其他节点的交互](#ics-cmd-pending-未决事务管理-mn和其他节点的交互)  

- send端（mn）等待
- receive端 由tm proc线程轮询处理


#####   [ICS_CMD_CM (集群):](#ics-cmd-cm-集群)  

- 集群相关暂不考虑


#####   [ICS_DPH_BACK](#ics-dph-back)  

涉及命令字， GET_SCN, MULCN_DDL, CHECK_CONNECTION,R ESET_USER_CONNECTION

- **GET_SCN**  , 事务拿远端scn，有统一等待事件dstb_wait_result  lgtsMgr的proc  和mn的交互
- **CN_DDL**  ,有统一等待事件dstb_wait_result  lmmMgr   cn间交互
- **CHECK_CONNECTION**  , 同上 lmmMgr   cn与 mn/cn 交互
- **RESET_USER_CONNECTION**  , 同上 lmmMgr cn与 mn/cn 交互


##   [6. 自测](#6-自测)  

|自测点|预期|
|---|---|
|执行查询语句|查询 v$system_event 可以观测到cn/dn 上channel接收的等待时间|
|执行统计信息语句|可以观测到cn上channel的接收等待时间|
|执行查询语句|可以观测到cn/dn建连中，cn等待连接建立成功的事件，dn建连后等待cn发送命令字的事件|
|执行alter system/alter session语句|观测相应的等待事件|
|执行dcl/ddl|观测到对应等待事件|
|事务相关操作|观测到事务相关等待事件|
|执行dml|观测到执行相关等待事件，申请资源/dml prepare/dml start|
|lob插入|dn请求cn发送lob的等待事件|


##   [7. 资料设计](#7-资料设计)  

略

##   [8. 未来规划](#8-未来规划)  

略