Created by 万谦, last modified on 十一月 28, 2023

#   [LSC HA重构优化](#lsc-ha重构优化)  

JIRA：    [YDBRD-21755](https://jira.yasdb.com/browse/YDBRD-21755)  

##   [1. Overview（概述）](#1-overview概述)  

​    重构LSC HA整体框架，简化逻辑及流程。

##   [2. Features（功能特性）](#2-features功能特性)  

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
// kernel层：
CodVoid   sdfTaskCreate(SdfTaskCreateCtx* itemCreateCtx, SdfTask* sdfTask);
CodVoid   sdfTaskDestroy(SdfTask* sdfTask);
CodResult sdfTaskNext(SdfTask* sdfTask, CodUint32* size, CodChar* buffer, CodUint32* offset);

CodVoid   sdfMgrInit(SdfManager* sdfMgr);
CodVoid   sdfMgrRelease(SdfManager* sdfMgr);
CodVoid   sdfMgrInsertNewTask(SdfManager* sdfMgr, SdfTask* sdfTask);
CodVoid   sdfMgrDeletTaskById(SdfManager* sdfMgr, CodUint64 id);
SdfTask*  sdfMgrNextTask(SdfManager* sdfMgr);
CodBool   sdfMgrSyncComplete(SdfManager* sdfMgr, CodUint64 lfn);

CodResult ankLoadSdfManager(AnkHandler* handler, SdfManager* sdfMgr, CodUint64 minLfn);

// replication层
CodResult lsndStartSdfSender(ReplManager* repl, CodUint32 stbyId);
CodResult lsndStartSdfSenders(ReplManager* repl, DatabaseRole role);
CodVoid   lsndStopSdfSender(ReplManager* repl, CodUint32 stbyId);
CodVoid   lsndStopSdfSenders(ReplManager* repl);

CodResult lrcvStartSdfReceiver(ReplManager* repl);
CodVoid   lrcvStopSdfReceiver(ReplManager* repl);

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c63a1ad9a3311dc8a2f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 SdfTask模块](#521-sdftask模块)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c63a1ad9a3311dc8a30/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ)

​      **数据结构：**

```
typedef struct StSdfTask {
    CodUint64  id;
    Filename   path;
    CodUint64  lfn;
    CodPointer prev;
    CodPointer next;
    CodUint64  offset;
    CodInt32   fd;
    CodUint16  columnNum;
    CodUint16  currId;
    CodUint8   sliceType;
    CodBool    running;
    CodUint8   reserved[2];
} SdfTask;

```

​      **SdfTask是以slice为粒度的同步任务。**

​    全局id标识属于哪个slice的任务，path则是要同步的slice目录位置；

​    lfn是该slice文件的事务信息，沿用之前的slice文件先于元数据同步规则，redo在同步时可以据此判断是否有要先于redo发送的slice文件；

​    offset和fd联合使用可以知道当前同步文件的读取位置；

​    columnNum和sliceType联合使用可以知道目录下的文件组成，此sliceType取值区间为[SILO, COLUMN, SLICE, ROWGROUP]；

​    currId是当前处理的文件编号；

​    prev、next和running是task在SdfManager中的属性，分别指示其链表位置和运行状态。

####   [5.2.2 SdfManager模块](#522-sdfmanager模块)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c638970c2af4f520bc3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ)

​      **数据结构：**

```
#define SDF_TASK_LIMIT_COUNT   4096
typedef struct StSdfManager {
    SpinLock         lock;
    CodUint32        id;
    CodUint32        num;
    SdfTask*         freeList;
    SdfTask*         activeList;
    CodUint64        minLfn;
    SdfTask          tasks[SDF_TASK_LIMIT_COUNT];
    volatile CodBool loaded;
    volatile CodBool valid;
} SdfManager;

```

​    lock用于任务队列及状态维护；

​    num表示当前任务个数；

​    freeList和activeList分别为空闲队列和活跃队列，新增一个活跃任务时，经历从空闲队列摘取空闲任务、创建任务最后再插入任务到活跃队列的流程；一个活跃任务结束后，也会经历任务销毁、从活跃队列出列最后回归空闲队列步骤；activeList上的任务以lfn升序排序；

​    minLfn表示当前manager上最小的任务lfn，redo在同步时据此判断同步的redo pack区间内存不存在未同步的slice文件；

​    tasks是任务存储数组，数组上限为4096；

​    loaded状态表示当前manager是否加载完成，首次心跳时，redo发送线程会根据备机的sendLfn去加载local_fs下所有的未发送slice；

​    valid表示当前manager中的任务是否完整，当出现备机断连后，任务数量达到上限被丢弃情况时，valid会变成false，下次备机再次建联发现是非完整的任务队列，就会再次去加载一次。

​      **重要流程：**

（1）当备机连接正常，但活跃任务达到上限，新增任务时会等待到备机异常或者有活跃任务完成回归空闲队列

（2）首次心跳只有等到加载完成后，才能进行redo的同步，但加载和slice同步是并行的，sdfSender只要任务队列是valid并且存在活跃任务就会进行同步

####   [5.2.3 SdfSender&SdfReceiver](#523-sdfsendersdfreceiver)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c63a1ad9a3311dc8a35/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ)

​      **数据结构：**

```
typedef struct StSdfProcArg {
    AnhHandler* handler;
    CodUint32   id;
    CodUint32   workerId;
} SdfProcArg;

typedef struct StSdfSender {
    CodUint32        id;
    CodUint32        workerNum;
    AnhHandler       handler[SDF_MAX_SYNC_WORKER];
    SdfProcArg       procArg[SDF_MAX_SYNC_WORKER];
    CodThread        thread[SDF_MAX_SYNC_WORKER];
    SdfManager       sdfManager;
} SdfSender;

typedef struct StSdfReceiver {
    CodUint32        id;
    CodUint32        workerNum;
    AnhHandler       handler[SDF_MAX_SYNC_WORKER];
    SdfProcArg       procArg[SDF_MAX_SYNC_WORKER];
    CodThread        thread[SDF_MAX_SYNC_WORKER];
    volatile CodBool connect[SDF_MAX_SYNC_WORKER];
} SdfReceiver;

```

​    id表示备机编号；

​    workerNum都表示启动的工作线程数量；

​    handler数组存放各个工作线程同步使用的句柄，并通过SdfProcArg传递给工作线程；

​    procArg内的id表示备机编号，workerId则是线程编号，主备之间相同id的工作线程一一匹配；

​    sdfManager用于维护sender上的任务队列信息；

​    connect数组表示receiver中的工作线程是否已经和主机连接成功。

​      **报文设计：**

```
typedef struct StSdfHandshake {
    CodUint64 code;
} SdfHandshake;

typedef struct StSdfConnectReq {
    CodUint32   id;
    CodUint32   workerId;
} SdfConnectReq;

typedef struct StSdfSyncReq {
    FileName  path;
    CodUint16 columnNum;
    CodUint8  type;
    CodUint8  reserved;
} SdfSyncReq;

typedef struct StSdfSyncHead {
    CodUint16 locatorId;
    CodUint16 reserved;
    CodUint32 size;
} SdfSyncHead;

```

​     SdfHandshake中的code是sdf sync阶段使用的交互密码，心跳和建联时据此判断信息类型；

​     SdfConnectReq是主机中的sdfSender向备机建联请求时的req信息，备机可以根据id和workerId区别到底是哪一个主机的哪一个worker请求；

​    SdfSyncReq是开启一个slice同步的请求信息，其中path表示在主机上的slice目录位置，columnNum和type决定了目录下的文件构成；

​    SdfSyncHead中保存了此批同步数据的所属文件信息，根据path和locatorId即可拼接出数据文件路径。

​      **重要流程：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c63a1ad9a3311dc8a32/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ)

####   [5.2.4 流程](#524-流程)  

建联流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396c638970c2af4f520bc6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ)

同步流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396c638970c2af4f520bc8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ)

FAL流程：

​    相比之前采用私有的发送线程进行归档数据同步，新框架由于备机回放点后续的slice同步任务都被加载到sender的manager上，因此FAL只需要检查对应asn的redo日志的最小lfn是否大于等于manager上最小lfn，一旦区间内的slice都同步完成，对应的归档redo也可进行同步。

####   [5.2.5 异常处理](#525-异常处理)  

【1】心跳加载和任务生成并发，有可能造成重复任务，在生成任务处处理，如果发现新增的任务重复，则跳过；

【2】主线程产生任务后，由于其它原因需要回滚，在回滚文件前，要将任务队列中的任务摘除，摘除时会出现以下几种场景：

① 任务已执行完毕，备机接收到的残留文件由redo回放回滚

② 任务未开始执行，直接从任务队列中摘除

③ 任务正在执行，有两种选择，一个是直接打断，二是等待同步完成后退化成①场景处理

【3】回滚文件redo在备机回放执行时，回滚的文件可能出现以下两种情况：

① 文件不存在，回放时直接跳过

② 文件存在，则尝试摘除任务队列中的此文件

【4】sdfMgr的状态切换细则

① sdfMgr初始情况，loaded标记为false表示还没有加载完全，valid标记为true表示当前任务队列没有出现不完整的情况

② 进行任务加载完成后，loaded变成true

③ 当备机断连，活跃任务到达4096上限，还有新增任务需要入列，valid被标记为false

④ 备机建联，首次心跳时，会出现以下情况：

（1）loaded为false 表示是首次加载 redoSendProc加载任务即可

（2）loaded为true valid为true 表示上一次断连后 产生的任务没有达到任务上限 直接返回

（3）loaded为true valid为false 表示上一次断连后 产生的任务达到任务上限 出现了任务丢失情况 此时redoSendProc先清空所有残留的任务 将valid设置为true loaded置为false 回归到（1）场景

###   [5.3 DFX](#53-dfx)  

**统计信息增强**

```
typedef enum EnStatType {
    ....
    SCOL_SYNC_TIME,        // 数据库内同步任务总耗时
    SCOL_SYNC_CNT,         // 数据库内同步任务总同步次数
    SCOL_SYNC_WRITE_CNT,   // 数据库内同步任务总写盘次数
    SCOL_SYNC_WRITE_BYTES, // 数据库内同步任务总写盘字节数
    SCOL_SYNC_WRITE_TIME,  // 数据库内同步任务总写盘耗时
    SCOL_SYNC_READ_CNT,    // 数据库内同步任务总读盘次数
    SCOL_SYNC_READ_BYTES,  // 数据库内同步任务总读盘字节数
    SCOL_SYNC_READ_TIME,   // 数据库内同步任务总读盘耗时
    ....
}

```

​    在v$sysstat中增加有关同步的统计项

**视图增强**

​    增加v$lsc_slice_sync_status展示当前数据库内活跃的slice同步任务情况

|字段|类型|说明|
|---|---|---|
|DEST_ID|TINYINT|备机ID，与ARCHIVE_DEST_x参数相对应|
|SYNC_FILE_PATH|VARCHAR(256)|要同步的slice文件目录|
|LFN|BIGINT|此任务的序列号|
|STATUS|VARCHAR(16)|任务状态: RUNNING ACTIVE ABNORMAL|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

现有LSC HA相关用例

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

（1）在线发送可以不等lfn设置好再执行任务 避免阻塞其它redo同步

（2）加载任务动作尝试交给其它线程做？避免阻塞redoSendProc

## Attachments:

[image2023-11-7_20-12-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTFjIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.wmNu92XnWreGF3D8a0rkUvfihSpUqysoEiGgLgS-vCg)

 (image/png)    


[image2023-11-7_20-12-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTFlIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.UFG2UzJW9SkfwTl5IKJ4GFOdWGRcL4gaulBa30srZ0U)

 (image/png)    


[image2023-11-7_20-13-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTFmIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.4-WYeHevb_UX63DVXBYT_GHs4Fq-nJRRb1FJAml26AY)

 (image/png)    


[image2023-11-7_20-13-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTIwIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.dW7H3RYNIpwl1oChz3DknXeuB5NSCKPtQFZa6JZH5j4)

 (image/png)    


[image2023-11-8_21-55-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTIyIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.rnzTRJRWtAGVnLop9gtnVeFYOxa5Mwhak6OqTJHtQx8)

 (image/png)    


[image2023-11-8_21-56-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjI4OTcwYzJhZjRmNTIwYmIzIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.sHEinxqlcenr0WDQazPKLq_UFzG7EnSHjc05nmrm-RY)

 (image/png)    


[image2023-11-13_19-9-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjI4OTcwYzJhZjRmNTIwYmI1IiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.jqhXv1dnPjUhypomIfK1irLSD0ZQ0FDH-SdXynBZ-OE)

 (image/png)    


[image2023-11-13_19-11-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjI4OTcwYzJhZjRmNTIwYmI3IiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.XZb8ZjR58mMl3OWm7aj_QOaxbQpk_wGjgmY4ZdurSlY)

 (image/png)    


[image2023-11-13_19-11-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTI0IiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.hoNr-Q6Pq0LJvuszh3adjIsaOzIKL5tO0rPPmcyFoTo)

 (image/png)    


[image2023-11-13_19-12-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTI2IiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.ZnegMI3jjAX07qQLPAwR1bygVpE3FH_WyYy4314K2p8)

 (image/png)    


[image2023-11-13_19-12-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjI4OTcwYzJhZjRmNTIwYmI5IiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.XxI37DImsUfWTz2Lkl9iNRmfQTRkIJbIUkexLCpMqFQ)

 (image/png)    


[image2023-11-7_20-12-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTI4IiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.dq2mEeTYyC17eF5BHWHwN90FUJlrB-qR_iApPf_zkew)

 (image/png)    


[image2023-11-7_20-13-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjI4OTcwYzJhZjRmNTIwYmJiIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.80ga1i4kIELm7aQtkFEVmBCUWvLiUIHw_CCEAhdU0M4)

 (image/png)    


[image2023-11-7_20-13-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjJhMWFkOWEzMzExZGM4YTJhIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.S6YU_qeGNJECzN1z6ZdliOX_tKNLiyg0vCEaK3vo8jQ)

 (image/png)    


[image2023-11-28_17-10-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjM4OTcwYzJhZjRmNTIwYmMxIiwicmVmX2lkIjoiNjczOTZjNjI3MjgyMDZlZmI5MmYxMWIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTQ5LCJleHAiOjE3ODIzODY5NDl9.y9mAdvWWIYC6qtmni7zE2W4J2kdA-ujcWUgG_eJ1rFM)

 (image/png)    


## Comments:

|  [](null)  ,2023年11月8日与顺哥讨论：,（1）scfItem和scfM相对独立 可提前开启详细设计,（2）scfItem外包装一个迭代器做取数动作,（3）scf模块暂定改名为SDF（sync database file）,  
,2023年11月9日与志宏讨论：,（1）scfm的加载统一放到心跳时做，且只做一次，fal只检查归档内文件是否已发送,（2）lfn需要再考虑如何优化，粗略方案有：,①写lfn的动作用一个redo来同步,②保持现在的做法，先发文件，再同步lfn，此做法在新模块下表现为新增一个写lfn的item,③lfn提前获取，生成slice时就确定,（3）sender与receiver之前维护长连接，参考CMSG_TYPE_CONNECT和processWaitConnect的做法，并维护心跳,（4）scfSender的shutdown放到redoSender之前，每次结点退出、降备停止,（5）receiver的多worker框架先搭起来，为后续内存任务发送接收准备,（6）考虑（1）中加载和任务创建并发的情况，目前就有处理，判断元数据完整性,Posted by wanqian at 十一月 09, 2023 15:59|
|---|
|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396c63a1ad9a3311dc8a35/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFRQVFBQUlBQUFBQUFBQUFBQUFFQUFBQ0lBQUFBQUFBQUlBQUFBQUFDQUFBQUFFQUlBQUNBZ0FBQUFBQUFBQUFBQUFJQUFBQkFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBZ0FBQUVBQUFBQUlBQUFCQkFBQUFBQUFBQUFBQUFBZ0FBRUFoRUFBQUFBQUNBQUtBQUFBQUFBQUFFQUFnQUFBZ0FBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1NTAsImV4cCI6MTc4MjMxMTM1MH0.3-akVkoHztUgw45faX0uqDm9Yvne-X-54l1Ap7I_xUQ),Posted by wanqian at 十一月 16, 2023 19:08|
|  [](null)  ,2023年11月29日评审结果：,（1）模块名仍然以SCF开头,（2）将sdfManager模块拆解到sdfSender上 工作线程相关元素抽象成一个worker 负责发送或接收,（3）尝试减少报文头类型,（4）lfn的设置还是采取先发文件->等待结果→设置lfn方式避免阻塞其它事务的redo同步,（5）v$lsc_slice_sync_stats更名为v$slice_replication_status,（6）增加等待事件EVENT_RD_WAIT_SLICE_SYNC 表示redo在同步时等待slice提前同步的信息,Posted by wanqian at 十一月 30, 2023 10:53|
|  [](null)  ,新增视图：v$slice_replicate_stats 视图展示系统内所有本地slice冷数据的同步情况,适配dv$slice_replicate_stats 在上述字段前加分布式结点相关信息,Posted by wanqian at 十二月 13, 2023 11:41|
|列id|名称|含义|
|0|DEST_ID|备机ID，与ARCHIVE_DEST_x参数相对应|
|1|BUCKET_NAME|同步文件所在Bucket路径|
|2|DATAOBJ|同步文件所属对象id|
|3|SLICE_ID|同步文件编号|
|4|COLUMN_NUM|同步文件的列数量|
|5|STATUS|同步情况 ABNORMAL备机连接异常 SYNCED发送完成 CANCELED被取消 RUNNING运行中|
|6|EXEC_ROUND|同步任务执行轮次 EXEC_ROUND-1为此任务失败次数|
|  [](null)  ,去掉了之前只支持SILO类型slice文件同步的限制，所有输出格式的slice文件都支持同步,Posted by wanqian at 十二月 14, 2023 19:16|
|  [](null)  ,dataobj改成name、subname，删除column_num，增加进度=已发送size/slice的size，发送速率=已发送size/发送耗时(M/s),Posted by yiwenliang at 十二月 20, 2023 16:47|


|列id|名称|含义|
|---|---|---|
|0|DEST_ID|备机ID，与ARCHIVE_DEST_x参数相对应|
|1|BUCKET_NAME|同步文件所在Bucket路径|
|2|DATAOBJ|同步文件所属对象id|
|3|SLICE_ID|同步文件编号|
|4|COLUMN_NUM|同步文件的列数量|
|5|STATUS|同步情况 ABNORMAL备机连接异常 SYNCED发送完成 CANCELED被取消 RUNNING运行中|
|6|EXEC_ROUND|同步任务执行轮次 EXEC_ROUND-1为此任务失败次数|
