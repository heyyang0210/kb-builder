Created by 陈俊杰, last modified by  李垠 on 十一月 08, 2024

*IR链接：*    [[YDBRD-20565] YCS运维及韧性增强 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-20565)  

*SR链接：*    [[YDBRD-24201] YCS资源监控和锁优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-24201)  

##   [1. 总述](#1-总述)  

优化资源管理和资源监控线程设计，优化YCS整体架构中的资源启停机制以避免资源的并发启停问题。

###   [1.1 需求来源](#11-需求来源)  

提升集群RM模块运维能力，提升资源监控和用户端并发启停资源场景下的韧性。

###   [1.2 调研文档](#12-调研文档)  

**旧有资源启停设计方案**  ：    [崖山集群资源启动停止设计方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109581586)  

#####   [存在的问题：](#存在的问题)  

- 多个线程都会调用资源启停的函数接口，导致资源启停的并发控制和锁管理存在问题；
- RM模块无状态机设计，导致YCS感知资源是否处于启停状态时依赖resourceItem本身的标志位，且当前资源并无临界状态，雪上加霜；
- 由于无常驻的资源启停线程，YCS启动DB失败时需要重启CM模块才能重启资源，延长了RTO时间，且把 资源启停故障的影响范围扩大到了其他模块；


|流程||对外体现的调整|内部处理的调整|
|---|---|---|---|
|资源管理线程|ycsResManagerProc|外部不感知|线程持久化，将资源启停收敛到单个线程|
|资源监控线程|ycsResMonitorProc|外部不感知|不直接重拉DB，而是推送请求到消息队列|
|YCS启停资源|main|外部不感知|仍通过资源管理线程来启动资源，但停资源改为让资源管理线程来做|
|客户端启停资源|ycsctl start/stop instance|提示信息改变|不直接启停DB，而是推送请求到消息队列，并阻塞地等待ACK|


###   [1.3 需求分析](#13-需求分析)  

（1）  **并发性**  ：需求本身即针对资源并发启停做优化，涉及的场景包括YCS启停时正常启停资源、RM模块处理异常时重拉资源、客户端工具启停资源，均有可能并发，需要有较好的并发处理；

（2）  **可用性**  ：在异常场景下不影响RM模块原本的异常处理能力，资源掉线后能够正常拉起；

（3）  **可靠性**  ：优化前后不影响YCS的可靠性规格，资源启停失败的处理流程与优化前略有不同；

（4）  **可测试性**  ：通过设置AUTO_START参数以及故障点注入，构造资源正常启停、异常启停、并发启停场景来做测试，观察资源(主要是db)状态和ycsctl工具的输出是否符合预期；

（5）  **安全性**  ：不涉及。

（6）  **易用性**  ：用户启停资源依赖ycsctl工具，不更改相关命令格式；客户端工具启停资源并发或者与YCS内部启停资源存在并发时需要有即时响应，输出清晰正确的信息说明资源正在启停中；客户端工具启停资源成功后有清晰正确的提示信息。

（7）  **可修改性**  ：通过设计资源启停状态机来简化此前启停资源时需要设置的部分复杂标志位，后续修改和维护则通过增删资源管理线程的状态和修改特定状态的处理逻辑来完成。

（8）  **兼容性**  ：测试用例预期需要刷新，内部注入的故障点保留。

###   [1.4 术语字典](#14-术语字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|resource manager|资源管理线程|无||
|resource monitor|资源监控线程|无||
|RM|包含资源管理和资源监控等细分模块的抽象大模块|无||


##   [2. 接口](#2-接口)  

|接口||接口表现|是否涉及|详细说明|
|---|---|---|---|---|
|配置参数|AUTO_START|影响DB的默认启停|是|为真时RM会自动拉起异常掉线的DB资源，可能导致用户和RM并发启停资源|
|工具|ycsctl start/stop instance|用户启停DB|是|用户启停资源的接口|
|告警|YcsDbFenced|Ycs管理的DB资源被fence|是|在异常场景下DB fence自己后会掉线并抛出此告警|
|日志和错误码|日志触发条件、等级、事件描述，错误码描述|新增错误码|是|ERR_YCS_RES_MNGR_BUSY错误码说明YCS内部正在启停资源|
|工具|ycsctl status|用户查看资源状态|是|用户查看资源状态的接口|


##   [3. 规格与约束](#3-规格与约束)  

#####   [规格延续：](#规格延续)  

- YFS的主节点与YCS的主节点是同一节点
- 支持正常启停和主备切换
- YCS单节点只管理一个YFS和DB资源
- YFS内嵌资源不支持手动启停


#####   [规格变更：](#规格变更)  

- YFS启动失败时YCS会直接退出
- DB启动失败时YCS无需重启


##   [4. 特性](#4-特性)  

###   [4.1 线程架构和状态机](#41-线程架构和状态机)  

#####   [4.1.1 线程架构](#411-线程架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c6ea1ad9a3311dc8a88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBUUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFJQU1BQUFBZ0FBQWdBQVFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3NTIsImV4cCI6MTc4MjMxMTU1Mn0.IFytWyeNkeeJJqKmW41ONAEOKmm48rx34AEwUpm_n60)

#####   [4.1.2 线程状态机](#412-线程状态机)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c6ea1ad9a3311dc8a89/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBUUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFJQU1BQUFBZ0FBQWdBQVFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3NTIsImV4cCI6MTc4MjMxMTU1Mn0.IFytWyeNkeeJJqKmW41ONAEOKmm48rx34AEwUpm_n60)

#####   [状态说明](#状态说明)  

- **INVALID**  ：无效的边界状态
- **INITING**  ：初次启动资源和资源监控线程，通常在以主或备的身份加入集群成功后启动资源管理线程时
- **IDLE**  ：资源初始化成功，轮询等待其他线程的资源启停请求
- **PROCESSING**  ：正在处理资源启停请求，期间会中止资源监控线程并拒绝工具端的资源启停请求
- **EXITING**  ：线程退出时停止资源和资源监控线程，通常在停止YCS实例、CM内部重启或资源降备时


###   [4.2 数据结构和函数接口](#42-数据结构和函数接口)  

#####   [4.2.1 数据结构](#421-数据结构)  

#####   [资源管理线程消息](#资源管理线程消息)  

```
typedef struct StYcsRmMsg {
YcsRmEvent rmEvent; // 消息的事件类型
ToolItem* item; // 工具端请求启停资源时传入指针
CodBool isCall; // 工具端请求启停资源时为TRUE
CodUint32 resPid; // 资源监控线程请求重启DB时传入旧PID
} YcsRmMsg;

typedef enum EnYcsRmEvent {
RM_MESSAGE_START_DB = 0,
RM_MESSAGE_STOP_DB = 1,
RM_MESSAGE_RESTART_DB = 2,
} YcsRmEvent;

```

#####   [资源管理线程状态](#资源管理线程状态)  

```
// 对状态机的主要状态做了细分，便于输出更具体的信息
typedef enum EnYcsRmStat {
YCS_RM_INVALID = 0, // 无效状态，未初始化、已终止或初始化资源失败
YCS_RM_INIT_YFS, // 初始化启动YFS和监控线程
YCS_RM_INIT_DB, // 初始化启动DB和监控线程
YCS_RM_IDLE, // 正常等待其他线程的消息请求
YCS_RM_START_DB, // 处理启动DB的请求
YCS_RM_STOP_DB, // 处理停止DB的请求
YCS_RM_RESTART_DB, // 处理重启DB的请求
YCS_RM_EXIT_YFS, // 线程退出时停止YFS和监控线程
YCS_RM_EXIT_DB, // 线程退出时停止DB和监控线程
} YcsRmStat;

```

#####   [其他结构体字段变更](#其他结构体字段变更)  

```
typedef struct StResourceItem {
...
volatile CodBool init;       // 保留，用于标记资源管理线程是否启动资源
volatile CodBool inProcess;  // 保留，用于标记resItem是否已分配
YcsContext context  --&gt; isOpen;  // 保留，当前用于标记资源自身的状态，后续需要优化为状态机由资源实例设置，或资源监控线程发现资源异常时强制设为无效

volatile CodBool inWaitFin; // 删除，原用于标记是否有线程正在等待DB启动完成（与服务端握手成功），现可根据资源管理线程的状态来判断是否在启停资源
volatile CodBool isService; // 删除，原用于标记DB是否在线，现可结合资源管理线程状态和资源状态判断是否在线
volatile CodBool isFenced;  // 删除，原用于标记DB是否被fence，但由于该字段仅资源监控线程读写，因此改为局部变量简化结构体
volatile CodUint8 stat;     // 删除，原用于通知资源状态到topo，但由于该字段仅资源监控线程读写，因此改为局部变量简化结构体
...
} ResourceItem;

typedef struct StYcsResourceManager {
...
SpinLock rmStatLock; // 用于线程状态的检查和设置
CodMsgQueue msgQueue; // 消息队列
volatile YcsRmStat stat; // 线程状态
} YcsResourceManager;

typedef struct StToolItem {
...
CodSemaphore sem; // 用于工具服务线程与资源管理线程之间的同步
YcsError ack; // 缓存处理结果和提示信息
} ToolItem;


```

#####   [4.2.2 函数接口](#422-函数接口)  

```
// CM模块可见的接口，通过资源管理线程来启停资源
CodResult ycsCmStartResources(YcsClusterMngr* mngr);
CodVoid ycsCmStopResources(YcsResourceManager* resourceManager);

// 检查和设置资源管理线程的接口
YcsRmStat ycsRmGetResManagerStat(YcsResourceManager* resourceManager);
CodVoid ycsRmSetResManagerStat(YcsResourceManager* resourceManager, YcsRmStat stat);

// 资源管理线程对外提供资源启停服务的接口
CodResult ycsRmAcquireRestartRes(YcsResourceManager* resourceManager, YcsResId resId, CodUint32 oldResPid);
CodResult ycsRmAcquireStartStopRes(YcsResourceManager* resourceManager, YcsResId resId, ToolItem* item, YcsRmEvent type);

```

###   [4.4 异常流程处理](#44-异常流程处理)  

|异常|处理流程|预期|
|---|---|---|
|YFS启动失败|抛出异常，停止YCS|YFS启动失败时YCS也不能工作|
|YFS启动卡住|资源管理线程卡住，直到YCS停止或重启|不core且能被其他线程停掉，DB不会被启动|
|DB启动失败|抛出异常，YCS反复尝试启动DB|YCS不用重启，资源管理线程正常工作|
|DB停卡住|一直等待DB停止直到超时|设置了WAIT_STOP_FIN_TIME参数时强行KILL DB|
|ycsctl启停资源超时|10分钟超时时间，超时后打印信息|信息明确，超时时间无对外参数|
|消息重入|处理流程内会对资源状态做判断，如果已经启或停，会忽略该请求消息|支持消息重入，不出现异常或core|
|启停并发|由单一线程串行执行资源启停，不存在并发问题|支持并发|


以上异常流程为开发识别到的关键异常，会通过  **故障点注入**  来实现场景的构造。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

#####   [正常场景用例](#正常场景用例)  

|场景||预期|备注|
|---|---|---|---|
|YCS正常启停|ycsctl start/stop ycs|连续启停YCS时，资源的启停正常|需要测试AUTO_START参数|
|ycsctl启停资源|ycsctl start/stop instance|能启停成功，且提示信息正确||


#####   [异常场景用例](#异常场景用例)  

|场景|异常|预期|备注|构造方法|
|---|---|---|---|---|
|YCS正常启停|启动YFS失败|YCS退出|不core，不重启|YCS_RM_FAULT_POINT_1|
|YCS正常启停|启动DB失败|反复重拉DB|YCS不需重启|YCS_RM_FAULT_POINT_2|
|YCS正常启停|启动YFS卡住|线程卡住，无法启停资源|不core，YCS能STOP掉|暂无构造方法|
|YCS正常启停|停DB卡住|线程卡住，无法启停资源|不core，YCS能否STOP依赖参数WAIT_STOP_FIN_TIME|暂无构造方法|
|ycsctl启停资源|命令并发|支持并发和消息重入，打印正确提示信息|start/stop instance命令并发|脚本并发|
|ycsctl启停资源|等待超时|超时后打印信息|超时时间无对外参数默认10分钟|新增故障点|
|ycsctl启停资源|命令和监控并发|有一个能执行成功，另一个打印信息||kill DB后执行start instance|
|DB进程异常|KILL -9|资源监控线程能感知到异常并重拉DB|依赖AUTO START参数，重拉失败时能重试|kill -9|
|YCS常见异常|磁盘心跳hung住|DB掉线，磁盘心跳回复后YCS重启能拉起DB||YCS_RM_FAULT_POINT_27|
|YCS常见异常|YCS和DB网络心跳隔离|DB在心跳超时后ABORT，YCS能拉起DB||YCS_FAULT_POINT_56|


**以YCS备节点的DB被kill展示基本异常处理流程**

![](https://pingcode.yasdb.com/atlas/files/public/67396c6e8970c2af4f520c1a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBUUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFJQU1BQUFBZ0FBQWdBQVFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3NTIsImV4cCI6MTc4MjMxMTU1Mn0.IFytWyeNkeeJJqKmW41ONAEOKmm48rx34AEwUpm_n60)

##   [6.资料设计章节](#6资料设计章节)  

**集群服务管理**

- 资源管理
- 共享集群启停


涉及到以上章节的内容，但暂未识别到修改项。

##   [7.未来规划](#7未来规划)  

- 单个线程处理单个消息队列中的资源启停任务，对于当前YCS单节点只管理单个DB且YFS不支持手动启停的场景下是足够的，暂未考虑其他场景；
- 同理，目前对资源管理线程的状态机的细分也是基于以上结论；
- 受限于YFS当前的具体实现，YFS启动卡住时仍然需要YCS主线程调用stop方法，并未将资源启停完全收敛，待YFS完善状态机设计后可能解决；
- 资源管理线程的状态转换只能说明YCS是否正在启停资源，但资源的内部状态仍然是黑盒，需要资源临界状态的需求来完成拆解；


## Attachments:

[ycsResManagerProc.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmQ4OTcwYzJhZjRmNTIwYzE4IiwicmVmX2lkIjoiNjczOTZjNmQ1OTNmOTljOWZmMjM2ZTc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzUyLCJleHAiOjE3ODIzODcxNTJ9._A1PZs4EOBOo9AblZuftNCsJnP8EKIDqWGmTCxsiTGY)

 (image/png)    


[db kill.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmVhMWFkOWEzMzExZGM4YTg2IiwicmVmX2lkIjoiNjczOTZjNmQ1OTNmOTljOWZmMjM2ZTc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzUyLCJleHAiOjE3ODIzODcxNTJ9.I-ZRcBmkWb-EILXklDKZK8JzpDcKmDWRdc2_z7Azkxc)

 (image/png)    


## Comments:

|  [](null)  ,1、toolItem被分配给另一个客户端进程，resourceManagerProc可能感知不到,2、有冲突的消息场景需要梳理一下表现,3、与fence相关的告警、关键字、日志可能需要调整,Posted by chenjunjie at 一月 10, 2024 11:43|
|---|
