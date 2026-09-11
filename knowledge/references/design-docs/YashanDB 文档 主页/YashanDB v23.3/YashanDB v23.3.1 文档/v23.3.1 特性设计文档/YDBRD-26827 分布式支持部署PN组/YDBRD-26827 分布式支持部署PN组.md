Created by 周宇航, last modified on 六月 04, 2024

*YDBRD-26827 分布式支持部署PN组，*    [SR链接](https://pingcode.yasdb.com/pjm/items/663850a7c36a3d30a8618b9a?%20=#YDBRD-26827%20%E5%88%86%E5%B8%83%E5%BC%8F%E6%94%AF%E6%8C%81%E9%83%A8%E7%BD%B2PN%E7%BB%84)  



-   [1. 总述](#1-总述)  
    -   [1.1 需求来源](#11-需求来源)  
    -   [1.2 调研文档](#12-调研文档)  
    -   [1.3 需求分析](#13-需求分析)  
    -   [1.4 数据字典](#14-数据字典)  
    -   [1.5 开源依赖](#15-开源依赖)  
-   [2. 接口](#2-接口)  
-   [3. 规格与约束](#3-规格与约束)  
-   [4. 特性](#4-特性)  
    -   [4.1 PN内核启动](#41-pn内核启动)  
        -   [4.1.1 实例启动](#411-实例启动)  
        -   [4.1.2 内核修剪](#412-内核修剪)  
    -   [4.2 PN集群管理](#42-pn集群管理)  
    -   [4.3 PN节点启停](#43-pn节点启停)  
        -   [4.3.1 pn复用原有节点的状态和迁移过程](#431-pn复用原有节点的状态和迁移过程)  
        -   [4.3.2 pn部署过程（首次启动）](#432-pn部署过程首次启动)  
        -   [4.3.3 pn内部模块交互](#433-pn内部模块交互)  
        -   [4.3.4 pn启动](#434-pn启动)  
        -   [4.3.5 pn停止](#435-pn停止)  
    -   [4.4 PN节点扩缩容](#44-pn节点扩缩容)  
        -   [4.4.1 pn组扩容](#441-pn组扩容)  
        -   [4.4.2 pn组缩容](#442-pn组缩容)  
        -   [4.4.3 pn节点扩容](#443-pn节点扩容)  
        -   [4.4.4 pn节点缩容](#444-pn节点缩容)  
    -   [4.5 PN故障处理](#45-pn故障处理)  
        -   [4.5.1 ics网络心跳](#451-ics网络心跳)  
        -   [4.5.2 probe节点探测](#452-probe节点探测)  
    -   [4.6 yasboot检查PN状态](#46-yasboot检查pn状态)  
    -   [4.7 PN用户管理](#47-pn用户管理)  
    -   [4.8 PN动态视图处理](#48-pn动态视图处理)  
    -   [4.9 兼容备份恢复](#49-兼容备份恢复)  
    -   [4.10 兼容集群升级](#410-兼容集群升级)  
    -   [4.11 直连PN节点操作数据库语句的执行情况](#411-直连pn节点操作数据库语句的执行情况)  
    -   [4.12 PN需要启动的线程](#YDBRD26827分布式支持部署PN组-4.12PN需要启动的线程)  
-   [5. Testcases（自测用例）](#5-testcases自测用例)  
-   [6.资料设计章节](#6资料设计章节)  
-   [7.未来规划](#7未来规划)  




##   [1. 总述](#1-总述)  

当前YashanDB存算一体的分布式架构(CN&MN&DN)较为完善且可用，如果要在基础上通过引入对象存储，实现存储的弹性扩展的存算分离架构，此时的计算资源并不能做到快速的弹性伸缩，DN节点的扩容是一个相当重的操作。在各方面的权衡后，选择了引入PN作为拥有快速伸缩能力的计算类型节点。

PN组节点规模会更大且要求启停和扩缩容效率更高，同时也拥有目前分布式大部分的能力，例如目前的分布式集群管理，备份恢复，集群升级等。本设计文档目的在于让用户无感地使用新的存算分离分布式架构，同样只需要yasboot等工具间接操作pn节点变化。

  [YashanDB存算分离总体方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119559628)    。

###   [1.1 需求来源](#11-需求来源)  

- 内部需求，由分布式需要往存算分离的方向进行架构演化而产生。
-   [存算分离技术项目立项评审纪要](https://conf.yasdb.com/pages/viewpage.action?pageId=124257774)    。
- 支持形态：分布式。


###   [1.2 调研文档](#12-调研文档)  

  [存算分离竞品调研分析](https://conf.yasdb.com/pages/viewpage.action?pageId=119558136)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|PN内核启动|添加新的yasdb启动流程，为PN专门跳过无需使用的功能，例如redo文件、系统表等|是|是|
|功能|PN集群管理|复用现有的CM集群管理|是|是|
|功能|PN节点启停|yasboot命令支持PN节点启停|是|是|
|功能|PN扩缩容|yasboot命令支持PN扩缩容|是|是|
|可靠性|PN故障处理|复用现有的ics网络检测和节点probe能力|是|是|
|兼容性|yasboot检查PN状态|可以使用    `yasboot status`    相关命令检查PN状态|是|是|
|兼容性|PN用户管理|由于PN没有存储用户系统表，PN将会忽略需要判定用户权限的代码|是|是|
|兼容性|PN动态视图处理|由于PN节点没有系统表且启动流程较独特，部分动态视图无法使用|是|是|
|兼容性|兼容备份恢复|将PN节点纳入现有的分布式备份恢复功能|是|是|
|兼容性|兼容集群升级|将PN节点纳入现有的分布式兼容集群升级功能|是|是|
|兼容性|直连PN节点操作数据库语句的执行情况|需要保证PN节点执行该类语句时行为可预期|是|是|
|兼容性|PN启动需要启动的线程|无|是|是|


###   [1.4 数据字典](#14-数据字典)  

略

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|
|---|---|---|
|yasdb启动数据库|  `yasdb`    命令原有的参数    `-t`    新增pn类型选项，以此启动pn类型节点|支持新类型pn，同时简化存储、系统表等模块来提高pn的启动速度|
|生成包含pn节点的toml文件|通过    `yasboot package de gen --pn 1-3`    生成包括pn节点的集群配置文件|--pn为可选项，默认值为0-0，即默认不包含pn|
|部署包含pn节点的集群|通过    `yasboot cluster deploy`    部署包括pn节点的集群|yasom和高级包支持新类型pn|
|pn节点的启停|通过    `yasboot node stop/start`    控制pn节点状态|通过读取控制文件信息判断是否初次启动|
|生成pn组扩容的toml文件|通过    `yasboot config group gen`    生成配置信息|无|
|pn组的扩容|通过    `yasboot group add`    控制pn节点数量变化|无|
|pn组的缩容|通过    `yasboot group remove`    控制pn节点数量变化|允许删完所有的pn组|
|生成pn节点扩容的toml文件|通过    `yasboot config node gen`    生成配置信息|生成的配置文件会复制当前pn组的其中一个节点的参数|
|pn节点的扩容|通过    `yasboot node add`    控制pn节点数量变化|无|
|pn节点的缩容|通过    `yasboot node remove`    控制pn节点数量变化|至少需要保留一个pn组的节点|
|包含pn的集群备份恢复|通过    `yasboot backup`    系列命令进行备份恢复|无|
|包含pn的集群升级|通过    `yasboot cluster upgrade`    进行集群升级|无|


##   [3. 规格与约束](#3-规格与约束)  

|类型|描述|方案说明|
|---|---|---|
|规格|目前单个pn组的最大节点数量是64，最大pn组数量是32|由相关宏    `COD_MAX_PN_GROUP_NUM`    和    `COD_MAX_PN_NODE_NUM`    定义|
|约束|只允许sys用户登录pn数据库|pn不存在用户系统表，因此不会进行用户鉴权和接受其他用户登录|
|约束|直连pn数据库仅能查询纳入白名单的动态视图|由于pn的内核修剪和系统表缺失，部分动态视图无法查询|
|约束|直连pn数据库不允许查询普通表和系统表|pn保存任何系统表和普通表，因此查询会产生    `not exist`    的信息|
|约束|不支持资源管理能力|由于资源管理后续会和执行强依赖，因此PN将会临时初始化相关变量保证执行正常运行|
|约束|不支持参数自适应能力|无|
|约束|不支持DBA视图|无|
|约束|不支持ADR模块|无|


##   [4. 特性](#4-特性)  

###   [4.1 PN内核启动](#41-pn内核启动)  

####   [4.1.1 实例启动](#411-实例启动)  

定义pn相关的基本数据类型，添加    `yasdb -t pn`    的创建类型，通过该命令运行一个pn节点实例：

```
typedef enum EnGroupType {
	...
	COD_GROUP_TYPE_PN = 5,
} CodGroupType;

typedef enum EnNodeType {
	...
	COD_NODE_TYPE_PN = 5,
} CodNodeType;

```

```
var GROUP_TYPE_ID = map[GroupType]int{
    ...
    GROUP_TYPE_DB: 4,
	GROUP_TYPE_PN: 5,
}

```

由于yasom中    `GROUP_TYPE_DB`    已经占用了枚举量4，因此内核和yasom的    `GROUP_TYPE_PN`    都统一顺延至枚举量5。

####   [4.1.2 内核修剪](#412-内核修剪)  

由于PN仅需计算和查询且节点无状态的需求，将需要对内核启动的过程中不必要的部分进行修剪

- pn将忽略系统表及redo日志等存储文件
- pn复用目前现有的控制文件能力，去除不必要的tablespace，仅保留swap表空间
- pn默认且仅有open状态
- pn默认切仅以READ_ONLY模式打开
- pn无需关心database的情况，在初次启动阶段就将创建基础的database，用于后续正常执行


和其他类型的节点相比，PN会有自己的启动流程。

![](https://pingcode.yasdb.com/atlas/files/public/67396ebf8970c2af4f521b08/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQW9BQUFBQkFBQUFBQUlBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUlBQVFDQUFBQUFBQUFCQUFBQUFFQUFBQVFBQUFDQUlBQUFJRUFBQUFFQUFBQUJBQUFBQWdnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NTYsImV4cCI6MTc4MjQ0OTY1Nn0.iPdqRL2nWcly2-puinMY9jNEvqUEYI1tQKswMFv_WXI)

###   [4.2 PN集群管理](#42-pn集群管理)  

  [集群管理静态信息管理](https://conf.yasdb.com/pages/viewpage.action?pageId=95110445#53-%E9%9D%99%E6%80%81%E4%BF%A1%E6%81%AF%E7%AE%A1%E7%90%86)    和    [集群管理动态信息管理](https://conf.yasdb.com/pages/viewpage.action?pageId=95110445#54-%E5%8A%A8%E6%80%81%E4%BF%A1%E6%81%AF%E7%AE%A1%E7%90%86)    将会继续在pn中沿用，继续保留代码和逻辑，但都无需持久化该类数据。

pn仍然需要持久化nodeState（当节点处于Isolated隔离状态重启时）等信息到控制文件中，沿用现有代码和逻辑。

|字段|数据类型|描述|
|---|---|---|
|clusterId|CodChar[64]|集群id|
|nodeId|NodeId|节点ID|
|nodeState|CodUint8|isolate 状态时持久化|
|term|CodUint64|组内主节点的任期|
|version|CodUint64|动态信息版本号|
|statusUpdateTime|CodUint64|动态信息变更时间戳|


###   [4.3 PN节点启停](#43-pn节点启停)  

PN节点的启停将分为首次启动（即部署带pn的集群）和非首次启动（即重启集群或者单独启停节点）。

####   [4.3.1 pn复用原有节点的状态和迁移过程](#431-pn复用原有节点的状态和迁移过程)  

- Init: 初始化状态，节点创建之后未启动之前处于该状态，yasmonit不监控节点进程。
- Removed：节点已被删除，yasmonit不监控节点进程。
- Started：节点已启动，yasmonit监控节点进程。
- Stopped：节点已被停止，查询执行时不使用该节点，yasmonit不监控节点进程。节点启动后自动切换到Started状态。
- Isolated：节点被隔离，查询执行时不使用该节点，yasmonit不监控节点进程。


![](https://pingcode.yasdb.com/atlas/files/public/67396ebfa1ad9a3311dc997c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQW9BQUFBQkFBQUFBQUlBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUlBQVFDQUFBQUFBQUFCQUFBQUFFQUFBQVFBQUFDQUlBQUFJRUFBQUFFQUFBQUJBQUFBQWdnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NTYsImV4cCI6MTc4MjQ0OTY1Nn0.iPdqRL2nWcly2-puinMY9jNEvqUEYI1tQKswMFv_WXI)

####   [4.3.2 pn部署过程（首次启动）](#432-pn部署过程首次启动)  

用户使用    `yasboot package de gen --dn 3-1 --pn 1-3`    生成带PN节点的集群配置，再通过    `yasboot cluster deploy`    来启动部署集群流程，和现有设计流程类似，    [集群管理启动流程](https://conf.yasdb.com/pages/viewpage.action?pageId=100077256)    ：

![](https://pingcode.yasdb.com/atlas/files/public/67396ebf8970c2af4f521b0c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQW9BQUFBQkFBQUFBQUlBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUlBQVFDQUFBQUFBQUFCQUFBQUFFQUFBQVFBQUFDQUlBQUFJRUFBQUFFQUFBQUJBQUFBQWdnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NTYsImV4cCI6MTc4MjQ0OTY1Nn0.iPdqRL2nWcly2-puinMY9jNEvqUEYI1tQKswMFv_WXI)

- 首次在集群中启动：
-     1. 通过读取配置文件，获得随意一个MN节点的endpoint和dataAddress地址。
    1. 已事件形式通知ics，建立与MN之间的网络通信。
    1. 向MN发送注册消息，并发送nodeId和clusterId。
    1. 如果该MN不是主MN，则返回主MN的endpoint和dataAddress地址。重复2-3步骤。
    1. 主MN收到注册消息，MN收到注册信息后，根据系统表的信息进行校验，并返回校验结果。如果该节点校验通过，返回集群信息。若注册失败则一直重复。
    1. 节点收到集群信息，进入更新流程。
    1. 执行分布式实例启动流程，启动完成后需要切换状态（NodeState,RunningState）
    1. 状态切换完成后，持久化自身的动态信息到控制文件（ctrl file）中
    1. 集群信息持久化失败，启动失败，报错退出
    1. 集群信息持久化成功后，向MN上报节点状态（NodeState）NODE_STATE_STARTED,运行时状态（RunningState）NODE_RUNNING_STATE_NORMAL
    1. 向MN/CN上报失败则切换上报目标，通过从线程池中添加任务去上报，直至上报成功。上报返回带有MN/CN的clusterVersion。
    1. 节点校验cluster版本号，如果不一致则进入拉取流程。



####   [4.3.3 pn内部模块交互](#433-pn内部模块交互)  

- mn在接收    `dbms_cm.create_node`    后添加对应pn的元数据信息，同时mn的cm模块开始相应的probe探测
- 数据库启动后，ics网络初始化
    -   `andIcsInit`    初始化相关内存信息。
    -   `andIcsStart`    启动ics模块。
    -   `icsStartLsnr`    开启地址端口监听。
    -   `icsStartMonitor`    开启网络相关icsMonitorProc线程监听事件。
- cm初始化
    -   `andCmInit`    初始化相关内存信息。
    -   `andCmStartup`    调用    `andCmStartupWithNotify`    启动cm模块。
        - 调用    `cmStartup`    初始化信息
            - 首次启动，从mn拉取节点信息，不需要通过    `cmUpdateLocalNodeStatusToSysTable`    持久化到系统表
            - 非首次启动，由于没有持久化到系统表，pn同样从mn拉取节点信息
        - 启动    `cmStartMainThread`    , 开启    `cmMainThreadEntry`    线程任务
            - pn也不需要将首次拉取的节点信息通过    `cmUpdateLocalNodeStatusToSysTable`    持久化到系统表
            - pn不需要    `cmUpdateSysTableByNodeCacheChanges`    去持久化节点信息到系统表
        - pn不必使用    `cmStartProbeTimer`    ，原代码设计已经判断非cn和非mn不使用此功能
        - 调用    `cmNotifyLocalStatusChange`    通知mn/cn节点启动完成
- 由cm发送内部事件event通知ics与MN建立网络通信


####   [4.3.4 pn启动](#434-pn启动)  

用户通过    `yasboot cluster start`    、    `yasboot group start`    或者    `yasboot node start`    启动pn节点。

- 节点从mn读取数据，并放入nodeCache当中。
- 执行分布式实例启动流程，启动完成后需要切换状态（NodeState,RunningState）以及角色。
- 状态切换完成后，持久化自身的动态信息到控制文件（ctrl file）中。
- 动态信息持久化失败，启动失败，报错退出。
- 动态信息持久化成功后，向MN上报节点状态（NodeState）NODE_STATE_STARTED, 运行时状态（RunningState）NODE_RUNNING_STATE_NORMAL。
- 向MN/CN上报失败则切换上报目标，通过从线程池中添加任务去上报，直至上报成功。上报返回带有MN/CN的clusterVersion。
- 节点校验cluster版本号，如果不一致则进入拉取流程。


####   [4.3.5 pn停止](#435-pn停止)  

用户通过    `yasboot cluster stop`    、    `yasboot group stop`    或者    `yasboot node stop`    启动pn节点。

- 节点下线时需要上报自身的动态信息上报至MN,上报成功由MN广播至dn外的各个节点。
- 若上报mn失败，则上报至cn，由cn广播至各个节点。
- 此处不能因为无法上报而导致节点不能停止，所以上报一次即可，失败不重试。


###   [4.4 PN节点扩缩容](#44-pn节点扩缩容)  

pn新节点部署过程会相当快，对外界用户来说pn的    `add/remove`    和    `start/stop`    以及    `fault/recover`    将会是同一个效果，可概括为（集群发现一个新的    `pn节点可用`    ）/（集群发现一个原先的    `pn节点不可用`    ）。

####   [4.4.1 pn组扩容](#441-pn组扩容)  

- 用户通过    `yasboot config group gen`    生成toml配置文件，后续该命令应该引入额外的参数（如    `-t --type`    ，可选值    `pn`    、    `dn`    ）来指定生成对应的组类型。
- 用户通过    `yasboot group add`    使用toml配置文件生成新组（新组配置文件至少需要有一个节点），生成前先进行相关校验，复用现有流程：
    - 校验集群状态。
    - 检查配置文件是否至少有一个node。
    - 检查ip地址是否可用，端口号是否被占用。
- yasom内部调用MN的高级包    `dbms_cm.create_group`    ，复用现有流程：
    - 校验参数是否正确，是否和现有集群有冲突。
    - 将新组加入集群，生成对应group_id。
    - 将    `CM_EVENT_TYPE_ADD_GROUP`    事件通过cm的函数    `anrDstbCmReportEvent`    通知具体的节点内的其他模块（如ics网络）有组新增事件。
- yasom内部调用MN的高级包    `dbms_cm.create_node`    ，和后续    `pn节点扩容`    类似。
- 返回新节点的group_id和node_id，验证集群状态以及版本号。
- 如果发生组扩容失败
    - 生成配置失败，则手动重新生成
    - 在yasom检查阶段失败，则根据报错信息进行环境调整
    - 在调用高级包时失败，则同样根据报错信息进行调整
    - 注册完毕后节点拉起失败（例如端口占用），这时候需要执行    `yasboot group remove`    来删除该组


####   [4.4.2 pn组缩容](#442-pn组缩容)  

- 用户通过    `yasboot group remove`    命令移除组，复用现有流程：
    - 校验集群状态。
- yasom内部调用MN的高级包    `dbms_cm.delete_group`    ，复用现有流程：
    - 校验参数是否正确，是否和现有集群有冲突。
    - 将    `CM_EVENT_TYPE_DELETE_GROUP`    事件通过cm的函数    `anrDstbCmReportEvent`    通知具体的节点内的其他模块（如ics网络）有组删除事件。
- 逐一停止组内节点，随后删除相关节点文件及目录。
- 如果发生组缩容失败，重试即可


####   [4.4.3 pn节点扩容](#443-pn节点扩容)  

- 用户通过    `yasboot config node gen`    生成toml配置文件。
- 用户通过    `yasboot node add`    使用toml配置文件生成新节点，生成前先进行相关校验，复用现有流程：
    - 校验集群状态。
    - 检查组是否以及存在。
    - 检查配置文件是否有至少有一个node。
    - 检查ip地址是否可用，端口号是否被占用。
- yasom内部调用MN的高级包    `dbms_cm.create_node`    ，复用现有流程：
    - 校验参数是否正确，是否和现有集群有冲突。
    - 将新节点信息加入组，生成对应node_id。
    - 将    `CM_EVENT_TYPE_ADD_NODE`    事件通过cm的函数    `anrDstbCmReportEvent`    通知具体的节点内的其他模块（如ics网络）有节点新增事件。
- yasom调用    `yasdb`    命令拉起pn数据库程序。
    - 拉起后过程和    `节点部署过程`    一致。
- 返回新节点的node_id，验证集群状态以及版本号。
- 如果发生节点扩容失败
    - 生成配置失败，则手动重新生成
    - 在yasom检查阶段失败，则根据报错信息进行环境调整
    - 在调用高级包时失败，则同样根据报错信息进行调整
    - 注册完毕后节点拉起失败（例如端口占用），这时候需要执行    `yasboot node remove --clean`    来删除该节点


####   [4.4.4 pn节点缩容](#444-pn节点缩容)  

- 用户通过    `yasboot node remove`    命令移除组，复用现有流程：
    - 校验集群状态。
- yasom内部调用MN的高级包    `dbms_cm.delete_node`    ，复用现有流程：
    - 校验参数是否正确，是否和现有集群有冲突。
    - 停止该节点，流程与    `pn停止`    一致。
    - 将    `CM_EVENT_TYPE_DELETE_NODE`    事件通过cm的函数    `anrDstbCmReportEvent`    通知具体的节点内的其他模块（如ics网络）有节点删除事件。
    - 删除节点文件及目录。
- 如果发生节点缩容失败，重试即可


###   [4.5 PN故障处理](#45-pn故障处理)  

pn不存在主备，也就没有相关的数据一致性问题和脑裂问题，故障处理将会集中在网络与节点宕机两个问题中。

####   [4.5.1 ics网络心跳](#451-ics网络心跳)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ebfa1ad9a3311dc997e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQW9BQUFBQkFBQUFBQUlBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUlBQVFDQUFBQUFBQUFCQUFBQUFFQUFBQVFBQUFDQUlBQUFJRUFBQUFFQUFBQUJBQUFBQWdnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NTYsImV4cCI6MTc4MjQ0OTY1Nn0.iPdqRL2nWcly2-puinMY9jNEvqUEYI1tQKswMFv_WXI)

  
  主要通过ics网络心跳感知对端动态信息变更，pn也需要用和原先pn的notify功能来通知其他节点。

####   [4.5.2 probe节点探测](#452-probe节点探测)  

  [原probe任务流程](https://conf.yasdb.com/pages/viewpage.action?pageId=95110445#5922-probe-%E6%B5%81%E7%A8%8B)    主要是对dn进行管理，提高dn的节点的可用行，现同样需要额外对pn节点进行探测，以保证cn/mn节点能快速的确认哪些pn节点对自己是可用的（如网络通信正常）。

cn对pn的状态感知将会和dn类似，pn继续沿用该部分代码和逻辑，但pn不会变化到    `FullSync`    的数据同步状态，代码无需修改。

- Normal： 节点运行正常。
- Suspect: 节点被怀疑存在问题，需要确认。
- Abnormal：节点状态异常，在恢复正常之前查询执行应避免使用。
- ~~FullSync：节点正在进行全量数据同步（build database）。~~


![](https://pingcode.yasdb.com/atlas/files/public/67396ebfa1ad9a3311dc997f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQ0FBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQW9BQUFBQkFBQUFBQUlBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUlBQVFDQUFBQUFBQUFCQUFBQUFFQUFBQVFBQUFDQUlBQUFJRUFBQUFFQUFBQUJBQUFBQWdnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NTYsImV4cCI6MTc4MjQ0OTY1Nn0.iPdqRL2nWcly2-puinMY9jNEvqUEYI1tQKswMFv_WXI)

###   [4.6 yasboot检查PN状态](#46-yasboot检查pn状态)  

通过在yasom中status相关代码添加pn节点的检查，以下命令都可查询到pn的状态

-   `yasboot cluster status`  
-   `yasboot group status`  
-   `yasboot node status`  


###   [4.7 PN用户管理](#47-pn用户管理)  

- 由于pn没有系统表也不存用户表和相关数据，仅允许sys用户直连pn节点。
- 同时pn仅作查询计算节点，由cn下发计划，因此也由cn来负责用户鉴权即可，pn将会在代码层面跳过用户判定的逻辑。


###   [4.8 PN动态视图处理](#48-pn动态视图处理)  

yasboot部署流程会重点关注以下视图来检查节点是否拉起，引入新类型pn和结构体StCmCluster新增pnGroups信息后，需要更新的部分动态视图：

|动态视图|说明|
|---|---|
|v$cm_group_info|ftCmGetAllGroupId生成groupIdList遍历中需要新增COD_GROUP_TYPE_PN|
|v$cm_node_info|生成的分布式查询计划需要考虑png，ftCmGetAllNodeId中生成nodeIdList需要额外遍历COD_GROUP_TYPE_PN|
|dv$node|原有设计已考虑pn新类型，无需修改|


同时，由于PN没有系统表等相关数据和部分模块的省略，部分现有的动态视图或者视图在查询过程中可能发生不可预期的错误（空指针core），为了避免问题出现，将采用白名单的方式放开PN的视图访问:

- 代码层面列出按照字典序列出PN可以和需要使用的动态视图
- 提供回调接口    `isDynamicViewFiltered`    来二分遍历判断是否需要屏蔽该动态视图
- 通过将    `ank_cursor.c`    相关的动态视图的操作函数，例如在    `ankDvFetch`    中调用    `isDynamicViewFiltered`    来判断
    - 如果是    `DV$`    视图，则为分布式收集各个节点的信息，PN需要返回空的结果。
    - 如果是    `V$`    或者    `X$`    等视图，则为直连节点查询，PN需要返回报错信息表明不支持查询该视图。
    -   `GV$`    等视图，在直连PN时也能查询，PN同样需要返回报错信息，但实际报错信息可能将会输出    `X$`    而不是    `GV$`    。
    - 报错信息格式例子为：    `YAS-00044 "PN query X$UNDO_SEGMENTS" has not been supported`    。


目前需要加入白名单的动态视图

|动态视图名称|保留原因|
|---|---|
|$ALERT_EVENT|显示所有告警事件名称|
|$ALLOCATOR|显示当前使用内存的状况|
|$AXCTOPO|集群编号，查询V$INSTANCE动态视图需要查询该视图|
|$BUFFER_ACCESS_STATISTICS|显示会话级别buffer访问的统计信息|
|$BUFFER_CONTROL|显示数据缓存区页面控制信息|
|$BUFFER_POOL|数据缓存区基本信息|
|$BUFFER_POOL_STATISTICS|数据缓存区的统计信息|
|$CHANNEL_PERF|用于查询当前会话各1对1channel的传输性能统计|
|$CM_CLUSTER_INFO|显示CM模块存储的CLUSTER INFO信息|
|$CM_GROUP_INFO|显示CM模块存储的GROUP INFO信息列表|
|$CM_NODE_INFO|显示CM模块存储的NODE INFO信息列表|
|$CM_TASK_INFO|显示CM模块存储的TASK INFO信息|
|$COLUMNAR_MEM_POOL|列式计算过程中内存池的详细信息|
|$COM_WORKER|worker池信息（不对外展示）|
|$CONTROLFILE|控制文件信息|
|$DATABASE|数据库信息|
|$DATAFILE|数据文件信息|
|$DATATYPE|显示当前系统提供的所有数据类型信息，具体清单见开发手册数据类型、游标、RECORD|
|$DICT_CACHE|字典缓存中的状态信息|
|$DICT_CURSOR|正在被使用的游标信息|
|$DIN_LINK|节点内部每条链路的信息|
|$DIN_NODE|节点内部网络链路状态的信息|
|$DIN_STAT|节点的内部网络统计的信息|
|$DUAL|虚拟表，可用于测试数据库的连通性或获取常量值|
|$DYNAMIC_VIEWS|显示当前系统提供的所有动态视图名称|
|$ERROR_CODE|显示所有错误码的详细信息|
|$FIXED_TABLE|显示当前实例中每个固定表的详细信息|
|$FIXED_VIEW_DEFINITION|显示当前实例中每个固定视图的定义信息|
|$FUNCTION|显示当前系统提供的所有内置函数信息，具体清单见开发手册内置函数|
|$GLOBAL_MPOOL|节点实例级的内存池信息|
|$INSTANCE|节点实例状态的信息|
|$LARGE_POOL|显示大对象池的相关统计信息|
|$LOCK|节点的锁信息|
|$LOCKED_OBJECT|显示当前所有对象锁的信息|
|$MYSTAT|会话的统计信息|
|$NODE|节点信息|
|$OPEN_CURSOR|节点statement的信息|
|$OSSTAT|来自操作系统的系统利用率统计信息|
|$PARAMETER|节点的参数信息|
|$PLANCACHE|用于检测plan cache的使用情况|
|$PQ_TQSTAT|显示当前statement上次执行的并行查询的表队列的统计信息，可用于分析表队列分片是否合理，只在连接存续期间可以查询|
|$PROCESS|当前线程信息|
|$PX_RES_MGR|显示当前节点的并行执行资源管理信息|
|$PX_SESSION|显示正在运行并行任务的会话信息|
|$PX_WORKER|显示并行worker池中的worker信息|
|$RESERVED_WORDS|显示单机和分布式所有关键字的信息|
|$SESSION|已创建的会话信息|
|$SESSION_EVENT|显示当前所有等待事件统计信息|
|$SESSION_ROLES|显示当前登录USER的所有生效角色|
|$SESSION_WAIT|显示当前所有会话等待事件信息|
|$SESSION_WORKER|执行使用session worker池的信息|
|$SESSTAT|会话的统计信息|
|$SESS_TIME_MODEL|显示各种操作的会话累积时间|
|$SGA|全局内存信息|
|$SGASTAT|全局内存各个内存池详细信息|
|$SHARE_POOL|显示系统共享内存池信息|
|$SPINLOCK|spin锁的信息|
|$SQL|SQL执行统计信息|
|$SQLAREA|共享SQL区中每条SQL的统计信息，包含SQL在statement上的内存消耗，解析，优化和执行信息|
|$SQLSTATS|SQL执行计划统计信息|
|$SQLTEXT|正在执行的SQL语句信息|
|$SQL_BIND_CAPTURE|显示所有在库缓存中的绑定变量的相关信息|
|$SQL_PLAN|节点的执行计划信息|
|$SQL_PLAN_STATISTICS|节点的子游标详细执行计划信息|
|$STATNAME|显示统计项的信息，与V$SYSSTAT中统计项对应|
|$SYSSTAT|会话的相关统计信息|
|$SYSTEM_EVENT|节点系统事件统计信息|
|$SYSTEM_PARAMETER|节点系统配置参数信息|
|$SYSTEM_WAIT_CLASS|显示当前所有等待事件类的统计信息|
|$TABLESPACE|显示当前实例的所有表空间的汇总信息|
|$TASK|显示当前执行和等待的任务信息|
|$TEMPORARY_LOBS|显示所有临时LOB的相关统计信息|
|$VERSION|版本信息|
|$VISIBLE_PARAMETER|节点可见的配置参数信息|
|$VM|节点的VM的整体内存信息|
|$VMSTAT|节点的VM的统计信息|
|$WINDOW_FUNCTION|显示当前系统提供的所有窗口函数信息|


- fixed table与dynamic view都归到以上的白名单中管理
- DBA视图，由于本身需要系统表和创建视图支撑，所以PN不支持此类视图


###   [4.9 兼容备份恢复](#49-兼容备份恢复)  

参考    [om管理YashanDB备份恢复设计(分布式)](https://conf.yasdb.com/pages/viewpage.action?pageId=109592351)    ，

pn后续需要兼容yasrman命令，由于目前备份恢复主要是针对数据备份，而除了控制文件和配置文件外没有需要去备份的数据，

因此pn反而是需要在yasrman代码中跳过大部分备份恢复的操作，让兼容备份的命令和流程正常执行：

- 备份环节pn无需参与数据备份阶段
- 恢复环节pn也正常删除archive、data、dbfiles和local_fs中所有文件
- 后续以open方式拉起pn节点后，由pn节点自动创建控制文件


###   [4.10 兼容集群升级](#410-兼容集群升级)  

参考    [分布式升级设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=144131121)    ，

需pn后续要兼容    `yasboot cluster upgrade`    命令，在原有流程的所有dn组升级后，对所有pn组进行升级。

目前整体流程：

1. 逐个节点进行升级前检查，如果有哪个节点状态异常，则报错退出
    1. 配置环境yac相关脚本执行环境
    1. **执行yac_precheck.sh，返回0表示检查通过**
    1. 检查DB状态，通过preupgrade.sql检查
1. 对YCS元数据进行备份1.配置环境yac相关脚本执行环境
    1. 对各个节点执行  **yac_preupgrade.sh**  。
1. 停止YCS的守护服务（进程退出自动拉起），目前YCS没有守护服务
1. 停止集群内所有节点
1. 备份DB元数据
    1. 备份DB的元数据文件
        1. 元数据文件（system文件）
        1. 用户数据文件
        1. 日志（redo/undo）
1. 替换二进制程序，将工具升级
    1. 逐个主机更新安装包
    1. 逐个主机更新环境变量
1. 离线适配ycs不兼容修改
    1. 配置环境yac相关脚本执行环境
    1. **对各个节点执行yac_upgrade.sh，返回0表示执行通过**    // YCR备份只需一个节点操作，脚本通过识别YAC_NODE_ID，判断在哪个节点上执行
1. 变更DB元数据
    1. 拉起其中一个DB节点到nomount状态
    1. 进入upgrade模式，alter database open upgrade
    1. 升级元数据，执行upgrade.sql，upgrade.toml中共享集群节点类型是ce
    1. 退出upgrade模式， alter database exit upgrade
    1. 节点退出，shutdown
1. 恢复拉起所有节点。
1. 检查升级后的状态
    1. 配置环境yac相关脚本执行环境
    1. **执行yac_postcheck.sh，返回0表示检查通过**
    1. 检查DB状态
1. 恢复YCS的守护服务


```
ycsctl stop cluster -c cluster_name

```

根据pn的特点，有以下改动：

- pn无需进行步骤5的数据备份
- pn无需关心系统表的升级，需要直接忽略步骤8的升级操作
- 只需保证pn能够升级重启并正常使用即可
- PN升级的时候需要去清空diskcache（由后续PN上使用diskcache的SR补充该能力）


###   [4.11 直连PN节点操作数据库语句的执行情况](#411-直连pn节点操作数据库语句的执行情况)  

下表为ddl和dcl在pn中的表现和预期描述：

|语句|目前在PN中表现|当前预期是否合理|修正描述以及新的预期|
|---|---|---|---|
|ALTER DATABASE|1. 显示  **YAS-00004 feature "alter database ADD" has not been implemented yet**  类的报错信息占大多数
1. 由于PN仅处于OPEN状态，其他语句会有类似  **YAS-02036 the database is already open**  或  **YAS-02266 the database is not in upgrade mode**  的错误信息
1. **ALTER DATABASE SWITCHOVER;**  会有类似的报错  **YAS-02402 switchover cannot be executed on primary database**
|是|无|
|ALTER DATABASE LINK|YAS-00004 feature "alter database link" has not been implemented yet|是|无|
|ALTER FUNCTION,ALTER INDEX,ALTER PACKAGE,ALTER PROCEDURE,ALTER PROFILE,ALTER TABLE,ALTER TABLESPACE,ALTER TABLESPACE SET,ALTER TRIGGER,ALTER TYPE,ALTER USER,COMMENT,FLASHBACK,ALTER OUTLINE,ALTER AUDIT POLICY,AUDIT POLICY,NOAUDIT POLICY|YAS-06010 the database is not in readwrite mode|是|无|
|ALTER SEQUENCE|分布式部署中用户无法执行本语句|是|无|
|ALTER SESSION,ALTER SYSTEM|1. type=pn尚不支持
1. **ALTER SYSTEM CHECKPOINT**  和  **ALTER SYSTEM FLUSH BUFFER_CACHE**  会进入卡死状态
1. 其余语句正常执行或提示YAS-06010 the database is not in readwrite mode
|否|通过修改函数    `parseRange`    以支持PN在alter system/session中的表现，例如：,-   `alter system set PARAMETER type = all`    同样可以影响所有PN节点的参数
- 也可以使用    `alter system set PARAMETER type = PN`    单独修改所有的PN节点
- 其他表现都和    [Alter system文档](https://conf.yasdb.com/display/YAS/Alter+system)    保持一致
,对于  **ALTER SYSTEM CHECKPOINT**  和  **ALTER SYSTEM FLUSH BUFFER_CACHE**  则需要从代码层面跳过pn类型，后续预期为：,**YAS-00004 feature "ALTER SYSTEM CHECKPOINT" has not been implemented yet；**,**YAS-00004 feature "ALTER SYSTEM FLUSH BUFFER_CACHE" has not been implemented yet**|
|ALTER MATERIALIZED VIEW|YAS-00004 feature "alter materialized view" has not been implemented yet|是|无|
|BACKUP DATABASE|YAS-02079 archive log mode must be enabled when backup database|是|无|
|BACKUP ARCHIVELOG|YAS-02079 archive log mode must be enabled when backup database|是|无|
|BUILD DATABASE|YAS-02071 the database is already mounted,YAS-02419 replication mode is not enabled|是|无|
|RESTORE DATABASE FROM 'backup';|YAS-02071 the database is already mounted|是|无|
|RECOVER DATABASE|YAS-02037 the database must be mounted and not open,YAS-02036 the database is already open|是|无|
|SHUTDOWN|正常使用|是|无|
|COMMIT,GRANT,REVOKE,ROLLBACK,SET TRANSACTION|由PN仅处于readonly模式，以下语句将会有错误提示`YAS-06010 the database is not in readwrite mode`|是|无|
|SAVEPOINT,RELEASE SAVEPOINT|以下两类语句本身不支持在cn外的节点使用，会有错误提示`YAS-00004 feature "savepoint" has not been implemented yet`|是|无|
|LOAD DATA,LOCK TABLE|YAS-00004 feature "load data" has not been implemented yet,YAS-00004 feature "lock table" has not been implemented yet|是|无|
|ANALYZE DATABASE,ANALYZE SCHEMA,ANALYZE TABLE|YAS-00004 feature "analyze database" has not been implemented yet,YAS-00004 feature "analyze schema" has not been implemented yet,YAS-00004 feature "analyze table" has not been implemented yet|是|无|
|SET AUTOTRACE|正常运行|是|无|


下表为高级包在pn中的表现和预期描述：

|高级包语句|例句|目前在PN中表现|当前预期是否合理|修正描述以及新的预期|
|---|---|---|---|---|
|DBMS_AUDIT_MGMT|--设置清理时间点    
  BEGIN    
  DBMS_AUDIT_MGMT.SET_LAST_ARCHIVE_TIMESTAMP(    
  DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED ,    
  SYSDATE);    
  END;    
  /|YAS-04243 invalid identifier "DBMS_AUDIT_MGMT"."GET_LAST_ARCHIVE_TIMESTAMP",YAS-05398 invalid procedure "DBMS_AUDIT_MGMT"."CLEAR_LAST_ARCHIVE_TIMESTAMP"|是|无|
|DBMS_AWR|--从WRM$_SNAPSHOT表获取两个snap_id值    
  EXEC DBMS_AWR.AWR_REPORT(2621752453,1,168,169);|YAS-05398 invalid procedure "DBMS_AWR"."CREATE_SNAPSHOT",  
|是|无|
|DBMS_HM|BEGIN    
  DBMS_HM.RUN_CHECK('Redo File Check','hm1','RF_NUM=1');    
  END;    
  /|YAS-02244 the value of parameter BLC_DF_NUM is invalid|是|无|
|DBMS_IJOB|```
<span class="token comment" style="color: rgb(153,153,153);">--以SYS用户执行，为SALES用户创建JOB</span>
<span class="token keyword" style="color: rgb(204,153,205);">DECLARE</span>
    job_id <span class="token keyword" style="color: rgb(204,153,205);">INT</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
    SYS<span class="token punctuation" style="color: rgb(204,204,204);">.</span>DBMS_IJOB<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SUBMIT<span class="token punctuation" style="color: rgb(204,204,204);">(</span>
    job_id<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
 cuser<span class="token operator" style="color: rgb(103,205,204);">=&gt;</span><span class="token string" style="color: rgb(126,198,153);">'SALES'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
 <span class="token keyword" style="color: rgb(204,153,205);">INTERVAL</span><span class="token operator" style="color: rgb(103,205,204);">=&gt;</span> <span class="token string" style="color: rgb(126,198,153);">'sysdate+1/24/60'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
 what<span class="token operator" style="color: rgb(103,205,204);">=&gt;</span> <span class="token string" style="color: rgb(126,198,153);">'proce_t;'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">COMMIT</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```|YAS-06010 the database is not in readwrite mode|是|无|
|DBMS_JOB|```
<span class="token keyword" style="color: rgb(204,153,205);">DECLARE</span>
  jobid BIGINT<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
  DBMS_JOB<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SUBMIT<span class="token punctuation" style="color: rgb(204,204,204);">(</span>jobid<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
  	<span class="token string" style="color: rgb(126,198,153);">'begin job_proc; end;'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
  	SYSDATE<span class="token punctuation" style="color: rgb(204,204,204);">,</span>
  	<span class="token string" style="color: rgb(126,198,153);">'SYSDATE+1'</span>
  	<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
  <span class="token keyword" style="color: rgb(204,153,205);">COMMIT</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
  DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'Job:'</span><span class="token operator" style="color: rgb(103,205,204);">||</span>jobid<span class="token operator" style="color: rgb(103,205,204);">||</span><span class="token string" style="color: rgb(126,198,153);">' is created!'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span> 
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```|YAS-06010 the database is not in readwrite mode|是|无|
|DBMS_LOB|select DBMS_LOB.GET_LENGTH(DUMMY) from DUAL;,select DBMS_LOB.ISTEMPORARY (DUMMY) a from DUAL;|正常使用|是|无|
|DBMS_LOCK|```
exec DBMS_LOCK<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SLEEP <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">10</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|正常使用|是|无|
|DBMS_METADATA|```
<span class="token keyword" style="color: rgb(204,153,205);">SELECT</span> DBMS_METADATA<span class="token punctuation" style="color: rgb(204,204,204);">.</span>GET_DDL<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'view'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span> <span class="token string" style="color: rgb(126,198,153);">'V_AREA'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token keyword" style="color: rgb(204,153,205);">FROM</span> dual<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|正常使用，但由于PN没有存储任何可以直接使用的类型，通常出现错误信息：,YAS-02012 table or view does not exist|是|无|
|DBMS_MVIEW|```
EXEC DBMS_MVIEW<span class="token punctuation" style="color: rgb(204,204,204);">.</span>REFRESH<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'TEST_MVIEW'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```,```
<span class="token punctuation" style="color: rgb(204,204,204);">
</span>
```|YAS-06010 the database is not in readwrite mode|是|无|
|DBMS_OUTPUT|```
<span class="token keyword" style="color: rgb(204,153,205);">SET</span> serveroutput <span class="token keyword" style="color: rgb(204,153,205);">ON</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'yashanDB'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>                         
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'hello world!'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'coming'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span> 
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>        
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```|正常使用|是|无|
|DBMS_PARAM|EXEC DBMS_PARAM.OPTIMIZE(NULL, 'LSC', NULL, NULL,    
   '/data/shm/data/pn-5-1/dbfiles', '/data/shm/data/pn-5-1/dbfiles');,```
<span class="token keyword" style="color: rgb(204,153,205);">SELECT</span> DBMS_PARAM<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SHOW_RECOMMEND<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token keyword" style="color: rgb(204,153,205);">FROM</span> dual<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|当使用  **EXEC DBMS_PARAM.OPTIMIZE();**  时，由于PN没有datafile和redofile的路径，导致代码拼接出裸路径  **/**  **_io_diag.tmp**  ，并在后续有报错  **YAS-00311 failed to create file /_io_diag.tmp, errno 13, error message "Permission denied"。**,  
,当主动填写路径后可以正常使用。|是|无|
|DBMS_PICKLER|```
<span class="token comment" style="color: rgb(153,153,153);">-- 启用dbms_output</span>
<span class="token keyword" style="color: rgb(204,153,205);">SET</span> serveroutput <span class="token keyword" style="color: rgb(204,153,205);">ON</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token comment" style="color: rgb(153,153,153);">-- 匿名块</span>
<span class="token keyword" style="color: rgb(204,153,205);">DECLARE</span>
   tds_flag <span class="token keyword" style="color: rgb(204,153,205);">INT</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   full_type_name <span class="token keyword" style="color: rgb(204,153,205);">VARCHAR</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">255</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> :<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token string" style="color: rgb(126,198,153);">'SALES.UDT_VARRAY_TYP'</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   typeoid <span class="token keyword" style="color: rgb(204,153,205);">BIGINT</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   version <span class="token keyword" style="color: rgb(204,153,205);">INT</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   tds RAW<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">8000</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   instantiable <span class="token keyword" style="color: rgb(204,153,205);">VARCHAR</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">255</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   sup_owner <span class="token keyword" style="color: rgb(204,153,205);">VARCHAR</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">255</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   sup_name <span class="token keyword" style="color: rgb(204,153,205);">VARCHAR</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">255</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   attr_rc SYS_REFCURSOR<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   subtype_rc SYS_REFCURSOR<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
   tds_flag :<span class="token operator" style="color: rgb(103,205,204);">=</span> sys<span class="token punctuation" style="color: rgb(204,204,204);">.</span>dbms_pickler<span class="token punctuation" style="color: rgb(204,204,204);">.</span>get_type_shape<span class="token punctuation" style="color: rgb(204,204,204);">(</span>full_type_name<span class="token punctuation" style="color: rgb(204,204,204);">,
</span> typeoid<span class="token punctuation" style="color: rgb(204,204,204);">,</span> version<span class="token punctuation" style="color: rgb(204,204,204);">,</span> tds<span class="token punctuation" style="color: rgb(204,204,204);">,</span> instantiable<span class="token punctuation" style="color: rgb(204,204,204);">,</span> sup_owner<span class="token punctuation" style="color: rgb(204,204,204);">,</span> sup_name<span class="token punctuation" style="color: rgb(204,204,204);">,</span> attr_rc<span class="token punctuation" style="color: rgb(204,204,204);">,</span> subtype_rc<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'tds flag: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> tds_flag<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">' full_type_name: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> full_type_name<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">' typeoid: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> typeoid<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">' version: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> version<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">' tds: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> tds<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">' instantiable: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> instantiable<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">' sup_owner: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> sup_owner<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_OUTPUT<span class="token punctuation" style="color: rgb(204,204,204);">.</span>PUT_LINE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">' sup_name: '</span> <span class="token operator" style="color: rgb(103,205,204);">||</span> sup_name<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_SQL<span class="token punctuation" style="color: rgb(204,204,204);">.</span>RETURN_RESULT<span class="token punctuation" style="color: rgb(204,204,204);">(</span>attr_rc<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
   DBMS_SQL<span class="token punctuation" style="color: rgb(204,204,204);">.</span>RETURN_RESULT<span class="token punctuation" style="color: rgb(204,204,204);">(</span>subtype_rc<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```|YAS-04253 PL/SQL compiling errors:    
  [10:12] YAS-04371 unsupport cursor in distributed database    
  [11:15] YAS-04371 unsupport cursor in distributed database    
  [13:16] YAS-04243 invalid identifier "SYS"."DBMS_PICKLER"."GET_TYPE_SHAPE"    
  [22:27] YAS-04243 invalid identifier "ATTR_RC"    
  [23:27] YAS-04243 invalid identifier "SUBTYPE_RC"|是|无|
|DBMS_RANDOM|```
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
DBMS_RANDOM<span class="token punctuation" style="color: rgb(204,204,204);">.</span>INITIALIZE<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token number" style="color: rgb(240,141,73);">100</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```,```
<span class="token keyword" style="color: rgb(204,153,205);">SELECT</span> DBMS_RANDOM<span class="token punctuation" style="color: rgb(204,204,204);">.</span>NORMAL <span class="token keyword" style="color: rgb(204,153,205);">FROM</span> dual<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|正常使用|是|无|
|DBMS_RESOURCE_MANAGER|```
EXEC DBMS_RESOURCE_MANAGER<span class="token punctuation" style="color: rgb(204,204,204);">.</span>CREATE_CONSUMER_GROUP<span class="token punctuation" style="color: rgb(204,204,204);">(</span>
    <span class="token string" style="color: rgb(126,198,153);">'RESGROUP1'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
    <span class="token string" style="color: rgb(126,198,153);">'GROUP FOR CPU RESOURCE1'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|- 调用DBMS_RESOURCE_MANAGER高级包下的所有子程序时，都需要以SYS用户连接数据库，否则报错。
- 分布式部署下，高级包DBMS_RESOURCE_MANAGER下的所有过程/函数只允许逐条调用，且只能在CN节点上操作。
,  
,目前PN执行的错误信息为：YAS-06010 the database is not in readwrite mode|是|无|
|DBMS_ROWID|```
<span class="token keyword" style="color: rgb(204,153,205);">SELECT</span> ROWID<span class="token punctuation" style="color: rgb(204,204,204);">,</span> DBMS_ROWID<span class="token punctuation" style="color: rgb(204,204,204);">.</span>ROWID_BLOCK_NUMBER<span class="token punctuation" style="color: rgb(204,204,204);">(</span>ROWID<span class="token punctuation" style="color: rgb(204,204,204);">)</span>
<span class="token keyword" style="color: rgb(204,153,205);">FROM</span> tbl_rowid
<span class="token keyword" style="color: rgb(204,153,205);">WHERE</span> ID <span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token number" style="color: rgb(240,141,73);">2</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>

```|正常使用，但由于PN没有存储任何可以直接使用的类型，通常出现错误信息：,YAS-02012 table or view does not exist|是|无|
|DBMS_SCHEDULER|```
EXEC DBMS_SCHEDULER<span class="token punctuation" style="color: rgb(204,204,204);">.</span>CREATE_JOB<span class="token punctuation" style="color: rgb(204,204,204);">(</span>
	<span class="token string" style="color: rgb(126,198,153);">'sche_example'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token string" style="color: rgb(126,198,153);">'PLSQL_BLOCK'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token string" style="color: rgb(126,198,153);">'begin insert into area values(TO_CHAR(SYSDATE,''SS''),
''sche'',''sche example''); commit; end;'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token number" style="color: rgb(240,141,73);">0</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	SYSDATE<span class="token operator" style="color: rgb(103,205,204);">+</span><span class="token number" style="color: rgb(240,141,73);">10</span><span class="token operator" style="color: rgb(103,205,204);">/</span><span class="token number" style="color: rgb(240,141,73);">24</span><span class="token operator" style="color: rgb(103,205,204);">/</span><span class="token number" style="color: rgb(240,141,73);">60</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token string" style="color: rgb(126,198,153);">'SYSDATE+1'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token keyword" style="color: rgb(204,153,205);">NULL</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token string" style="color: rgb(126,198,153);">'DEFAULT_JOB_CLASS'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token boolean" style="color: rgb(240,141,73);">true</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token boolean" style="color: rgb(240,141,73);">true</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span>
	<span class="token keyword" style="color: rgb(204,153,205);">NULL</span>
	<span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|YAS-06010 the database is not in readwrite mode|是|无|
|DBMS_SQL|DECLARE    
  cur1 SYS_REFCURSOR;    
  BEGIN    
    OPEN cur1 FOR SELECT * FROM V$NODE;    
    DBMS_SQL.RETURN_RESULT(cur1,false);    
  END;    
  /|[2:6] YAS-04371 unsupport cursor in distributed database    
  [4:8] YAS-05242 invalid cursor    
  [5:26] YAS-04243 invalid identifier "CUR1"|是|无|
|DBMS_STANDARD|EXEC DBMS_STANDARD.RAISE_APPLICATION_ERROR(29999+1, 'Account past due.');,```
<span class="token keyword" style="color: rgb(204,153,205);">call</span> DBMS_STANDARD<span class="token punctuation" style="color: rgb(204,204,204);">.</span>LOADJAVA<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'/mnt/d/com/test/Hello.class'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
```|正常出现对应的错误码和信息,操作java会在代码执行到ankOpenSysCursor时出错|否|需要从代码拦截，抛出不支持的错误信息：,**YAS-00004 feature "DBMS_STANDARD.LOADJAVA" has not been implemented yet**|
|DBMS_STATS|```
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
    DBMS_STATS<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SET_TABLE_STATS<span class="token punctuation" style="color: rgb(204,204,204);">(</span> <span class="token string" style="color: rgb(126,198,153);">'SALES'</span><span class="token punctuation" style="color: rgb(204,204,204);">,
</span><span class="token string" style="color: rgb(126,198,153);">'SALES_INFO_RANGE'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span> <span class="token string" style="color: rgb(126,198,153);">'P_SALES_INFO_RANGE_1'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span> <span class="token number" style="color: rgb(240,141,73);">10</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span> <span class="token number" style="color: rgb(240,141,73);">1</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span> <span class="token number" style="color: rgb(240,141,73);">15</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```|除GATHER_TABLE_STATS、GATHER_SCHEMA_STATS和GATHER_DATABASE_STATS  外，其他函数/存储过程不适用于分布式部署。,实际错误提示主要为YAS-06010 the database is not in readwrite mode。,GATHER_TABLE_STATS、GATHER_SCHEMA_STATS  由于PN没有存储任何可以直接使用的类型，通常出现错误信息：YAS-02012 table or view does not exist。,GATHER_DATABASE_STATS为YAS-06010 the database is not in readwrite mode|是|无|
|DBMS_UTILITY|BEGIN    
  DBMS_OUTPUT.PUT_LINE(DBMS_UTILITY.FORMAT_CALL_STACK);    
  END;    
  /,  
,DECLARE    
  BEGIN    
    DBMS_UTILITY.EXEC_DDL_STATEMENT('alter system set DIN_HB_TIMEOUT=10800 scope=both');    
  END;    
  /|正常使用|是|无|
|OWA_UTIL|DECLARE    
    owner VARCHAR(200);    
    name varchar(200);    
    lineno number;    
    caller_t varchar(200);    
  BEGIN    
  OWA_UTIL.WHO_CALLED_ME(owner, name, lineno, caller_t);    
  DBMS_OUTPUT.PUT_LINE('owener: ' || owner || ' name: ' || name || ' lineno: ' || lineno || ' caller_t: '|| caller_t);    
  END;    
  /|[7:1] YAS-05398 invalid procedure "OWA_UTIL"."WHO_CALLED_ME"|是|无|
|UTL_FILE|```
<span class="token keyword" style="color: rgb(204,153,205);">DECLARE</span>  
    HANDLE_R UTL_FILE<span class="token punctuation" style="color: rgb(204,204,204);">.</span>FILE_TYPE<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
	HANDLE_A UTL_FILE<span class="token punctuation" style="color: rgb(204,204,204);">.</span>FILE_TYPE<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
	HANDLE_W UTL_FILE<span class="token punctuation" style="color: rgb(204,204,204);">.</span>FILE_TYPE<span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">BEGIN</span>
    HANDLE_R <span class="token operator" style="color: rgb(103,205,204);">:=</span> UTL_FILE<span class="token punctuation" style="color: rgb(204,204,204);">.</span>FOPEN<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'/data'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token string" style="color: rgb(126,198,153);">'yashan.txt'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token string" style="color: rgb(126,198,153);">'r'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token number" style="color: rgb(240,141,73);">100</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
    HANDLE_A <span class="token operator" style="color: rgb(103,205,204);">:=</span> UTL_FILE<span class="token punctuation" style="color: rgb(204,204,204);">.</span>FOPEN<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'/data'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token string" style="color: rgb(126,198,153);">'yashan.txt'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token string" style="color: rgb(126,198,153);">'a'</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
	HANDLE_W <span class="token operator" style="color: rgb(103,205,204);">:=</span> UTL_FILE<span class="token punctuation" style="color: rgb(204,204,204);">.</span>FOPEN<span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">'/data'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token string" style="color: rgb(126,198,153);">'yashan.txt'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token string" style="color: rgb(126,198,153);">'w'</span><span class="token punctuation" style="color: rgb(204,204,204);">,</span><span class="token number" style="color: rgb(240,141,73);">32000</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token keyword" style="color: rgb(204,153,205);">END</span><span class="token punctuation" style="color: rgb(204,204,204);">;</span>
<span class="token operator" style="color: rgb(103,205,204);">/</span>
```|正常使用|是|无|


### 4.12 PN  需要启动的线程

参考    [后台线程汇总](https://conf.yasdb.com/pages/viewpage.action?pageId=130130179)  

|DN线程|预期PN是否需要使用|使用场景|
|---|---|---|
|TIMER|是|yasdb的时钟(逻辑时钟)线程，精度1ms|
|BUFFER_POOL|是|  
|
|PRELOADER|是|冷数据扫描预读线程|
|PRELOADER|是|同上|
|SMON|否|死锁检测、undo均衡与回收、buffer lru调整|
|CKPT|否|全量和增量checkpoint任务调度|
|DBWR|否|checkpoint与buffer clean的dirty block刷盘|
|DBWR|否|同上|
|SCHD_TIMER|是|  
|
|CHN_BKG_SNDER|是|  
|
|CHN_BKG_SNDER|是|  
|
|CHN_BKG_SNDER|是|  
|
|REPL_TCP_LSNR|否|HA的监听线程|
|REACTOR|是|共享模式任务相应线程|
|LISTENER_LOG|是|  
|
|UDS_LSNR|是|UDS监听线程|
|TCP_LSNR|是|tcp监听线程|
|MMON|否|awr快照后台自动创建和清理|
|JOB_QUEUE|否|job的调度线程。|
|RD_ARCH|否|归档redo文件|
|ARCH_DATA|否|归档slice文件清理|
|HEALTH_MONITOR|否|监控线程，主要执行一些故障检测，处理异常|
|PARAL_WORKER_0|是|并行执行线程|
|PARAL_WORKER_1|是|同上|
|LOGW|否|定时flush redo|
|ICS_TCP_LSNR|是|ICS TCP监听线程|
|ICS_MONITOR|是|ICS监控线程|
|ICS_SEND1_1_0|是|ICS发送链路服务线程|
|ICS_RECV1_0_0|是|同上|
|ICS_RECV1_1_0|是|同上|
|CM_WORKER_0|是|worker池空转线程|
|CM_WORKER_1|是|worker池空转线程|
|CM_WORKER_2|是|worker池空转线程|
|CM_SERVICE|是|CM主线程|
|ICS_SEND2_1_0|是|ICS发送链路服务线程|
|LMM_SERVICE|否|元数据同步线程|
|TM_SERVICE|否|事务故障恢复线程|
|LGTS_SERVICE|否|事务ID请求处理线程|
|TASK_WORKER_0|否|worker池空转线程|
|TASK_SERVICE|否|分布式任务框架主线程|
|……后续还有其他ICS_SEND连接未列出|  
|  
|


pn取消不必要的线程启动，主要通过内核启动过程进行修改。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|用例名称|用例描述|用例类型|
|---|---|---|
|集群部署以及重启|部署以及重启包含pn的集群|st|
|pn启停以及重启|通过yasboot命令启停以及重启pn|st|
|新增pn节点|通过yasboot命令和配置文件新增pn节点|st|
|移除pn节点|通过yasboot命令移除pn节点|st|
|pn异常后cn/mn感知与推送|pn异常下线后集群节点的处理|st|
|包含pn的集群升级|包含pn的集群后能正常升级和重启|st|
|包含pn的集群备份与恢复|包含pn的集群能够不影响原有的备份与恢复|st|


##   [6.资料设计章节](#6资料设计章节)  

- 考虑产品稳定性，对外文档不展示该SR，需要将资料在内部文档中进行描述
    - 在    `/内部文档`    添加PN目录，添加该SR编号对应的文件，编写yasboot、yasdb的命令参数变化，描述PN以及规格
    - 在    `/内部文档`    添加    `高可用/高可用运维`    ，添加PN关于扩缩容的章节
- yasboot工具方面目前需要隐藏help提示信息中，关于本次SR中PN的信息：
    - yasdb 隐藏 help 中关于 pn 的提示
    - yasboot package de gen 隐藏 help 中关于 --pn 的提示
    - yasboot config group gen 隐藏 help 中关于 -t 参数的提示


##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

1. 支持资源管理能力
1. 支持参数自适应能力


## Attachments:

[image2024-5-15_18-15-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYmY4OTcwYzJhZjRmNTIxYjA3IiwicmVmX2lkIjoiNjczOTZlYmY1OTNmOTljOWZmMjM4OGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODU2LCJleHAiOjE3ODI1MjUyNTZ9.8TaZ2IphbyAtUgMMYDq3EiC8iSmvn1LBkNP1bFxY45Y)

 (image/png)    


## Comments:

|  [](null)  ,2024.5.11 会议纪要,参会人：周宇航，李伟超，陈步隆，陈俊杰，何金阳，瞿蓝孟，施新华,-  PN的open选项是否可用
    - 答：实际中默认且仅有为open
- 实际使用PN组进行查询的控制参数，能否在组变化时自适应
    - 答：目前不能，也不在该SR针对这一块进行设计
- PN对应的动态视图，需要进行详细汇总
    - 将PN需要的视图进行描述补充
    - fixed table方面的动态视图处理
    - DBA视图的对齐
- DCL方面的命令和操作进行梳理
- PN升级的时候需要去删除diskcache
- 文档方面的对齐
-     1. 不在官方文档进行PN的展示
    1. 在工具命令隐藏相关PN的参数
    1. 能否单独在内部文档展示PN相关修改
    1. 与资料同学对齐

,Posted by zhouyuhang at 五月 13, 2024 10:03|
|---|
