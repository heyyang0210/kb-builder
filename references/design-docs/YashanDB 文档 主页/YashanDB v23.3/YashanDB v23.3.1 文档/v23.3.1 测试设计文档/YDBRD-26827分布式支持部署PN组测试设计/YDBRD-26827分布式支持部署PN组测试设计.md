Created by 施新华, last modified on 六月 17, 2024

# 1. 概述

        该需求为内部需求，由分布式需要往存算分离的方向进行架构演化而产生。当前YashanDB分布式架构中DN存算一体，当计算资源变化需要进行扩缩时，操作相对复杂， 因此引入PN作为拥有快速伸缩能力的计算类型节点。

PN组节点规模会更大，并且启停和扩缩容效率更高，同时也拥有目前分布式大部分的能力，例如目前的分布式集群管理，备份恢复，集群升级等。

存算分离特点：

- 计算和存储分层解耦，可独立按需扩展；
- 计算节点无状态，可快速启动关闭；
- 存储层可以基于低成本的对象存储；
- 业界技术发展趋势，在云服务上可以充分利用云的基础设施能力（对象存储、弹性计算）


# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/663850a7c36a3d30a8618b9a](https://pingcode.yasdb.com/pjm/items/663850a7c36a3d30a8618b9a)    ?    
  #YDBRD-26827 分布式支持部署PN组

参考：    [YDBRD-26827 分布式支持部署PN组](153001695.html)  

## 2.1 功能点分析

本需求主要实现分布式支持存算分离部署，新增PN组，实现功能如下：

- 支持创建PN组、OM管理PN节点；
- 支持PN节点无状态、弹性扩缩容；
- 支持PN节点启停；
- 支持对PN节点的异常检测；
- 支持通过yasboot管理PN组和PN节点。
- 支持包含PN组的分布式备份恢复。
- 支持包含PN组的分布式部署模式升级。
- 支持本地视图查询(已加入白名单)和系统参数修改；
- PN状态是readonly，拦截DDL和DML操作。


### 2.1.1 存算分离架构图

![](https://conf.yasdb.com/download/attachments/119559628/yashandb_disaggregated_storage_and_compute.drawio.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTgsImV4cCI6MTc4MjM4MjY5OH0.PwckKIeJbQobvZYEJJurnFTLi9ehUDghl2yvc_bGwmU)

如上，新增PN(Processor Node Group)组，PN组内节点无主从关系，无状态。

在存算分离模式下，DN存储热数据，PN存储冷数据，PN对于存储支持以下能力(非本次测试范围)：

- 支持将冷数据存储到对象存储中（通过S3接口对接）；
- 支持LSC冷数据的PN本地缓存DiskCache；
- 支持LSC元数据的PN本地缓存MetaCache；
- 支持事务（读写一致）；
- 支持AC。


查询计划在存算分离模式下也会变化，后续需求实现。

### 2.1.2 yasboot部署存算分离模式

|功能项|详细描述|备注说明|
|---|---|---|
|部署文件生成|yasboot package de gen --pn x-x 生成部署文件|1、pn组内最大节点数是64    
  2、pn组个数最大32    
  3、--pn为可选项，默认值为0-0，即默认不包含pn|
|部署数据库|yasboot cluster deploy -c xxx -t xxx.toml    
  yasboot cluster status -c xxx|部署成功，然后查询节点状态，支持显示pn节点状态|
|PN节点启停|yasboot node restart/stop/start/status -c xxx -n xxx |PN节点启停和查询，支持不同启动模式和停止模式|
|PN组启停|yasboot group restart/stop/start/status -c xxx -n xxx |PN组启停以及查询，支持不同启动模式和停止模式|
|集群启停|yasboot cluster restart/stop/start/status -c xxx|集群操作，支持不同启动模式和停止模式|
|PN节点配置|yasboot node config set/show/unset -c xxx -n x-x |指定pn节点配置|
|PN组配置|yasboot group config set/show/unset -c xxx -g x,yasboot cluster config set/show/unset|指定pn组配置以及集群配置|
|PN组扩缩容|1、生成PN组扩容文件 ,yasboot config group gen -c xxx --node x --group x -t PN/DN,2、扩容PN组,yasboot group add -c xxx -t xxx.toml  ,yasboot group status -c xxx  -g x,3、删除PN组,yasboot group remove -c xxx --group-ids x |1、新增-t 参数，指定扩容节点组类型，可选DN，PN，默认是DN组类型,2、支持删除全部PN组,3、若是存在PN组，根据第一个PN生成参数|
|PN节点扩缩容|1、生成PN组内节点扩容文件,yasboot config node gen -c xxx  --group-id x --node x,2、扩容PN节点,yasboot node add -c xxx -t xxx.toml,3、删除PN节点,yasboot node remove -c xxx --node-ids （--node-id）|1、生成扩容文件，配置复制组内第一个节点,2、删除组内节点需要至少保留一个节点,3、扩容会复制第一个节点参数|
|yasboot日志收集|yasboot collection ,yasboot cluster log |日志收集包含PN节点|
|yasboot monit|启动monit, 监控节点包含PN节点|PN节点故障可自动拉起|
|yasboot process|yasboot process yasdb restart/start/stop/ status |操作包含PN节点|
|备份恢复|yasrman或yasbak备份分布式集群，包含PN节点；,根据备份数据恢复集群正常|  
|
|升级|yasboot cluster upgrade 升级数据库包含PN节点|  
|


### 2.1.3 PN集群管理

PN节点状态复用原有节点状态迁移过程：

- Init: 初始化状态，节点创建之后未启动之前处于该状态，yasmonit不监控节点进程。
- Removed：节点已被删除，yasmonit不监控节点进程。
- Started：节点已启动，yasmonit监控节点进程。
- Stopped：节点已被停止，查询执行时不使用该节点，yasmonit不监控节点进程。节点启动后自动切换到Started状态。
- Isolated：节点被隔离，查询执行时不使用该节点，yasmonit不监控节点进程。


![](https://conf.yasdb.com/download/attachments/130132006/state2.png?version=1&modificationDate=1696853025004&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTgsImV4cCI6MTc4MjM4MjY5OH0.PwckKIeJbQobvZYEJJurnFTLi9ehUDghl2yvc_bGwmU)

视图查询存在以下变化：

|动态视图|说明|
|:---|:---|
|v$cm_group_info|新增PN类型|
|v$cm_node_info|新增PN类型|
|dv$node|新增PN类型显示|


### 2.1.4 PN节点启停

PN启动内核存在以下变化：

- PN将忽略系统表及redo日志等存储文件
- PN复用目前现有的控制文件能力，去除不必要的tablespace，仅保留swap表空间
- PN默认且仅有open状态
- PN默认切仅以READ_ONLY模式打开
- PN无需关心database的情况，在初次启动阶段就将创建基础的database，用于后续正常执行。


  


首次部署启动流程：

![](https://conf.yasdb.com/download/attachments/130132006/pn2.png?version=1&modificationDate=1697447283000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTgsImV4cCI6MTc4MjM4MjY5OH0.PwckKIeJbQobvZYEJJurnFTLi9ehUDghl2yvc_bGwmU)

  


首次在集群中启动流程：

1. 通过读取配置文件，获得随意一个MN节点的endpoint和dataAddress地址。
1. 已事件形式通知ics，建立与MN之间的网络通信。
1. 向MN发送注册消息，并发送nodeId和clusterId。
1. 如果该MN不是主MN，则返回主MN的endpoint和dataAddress地址。重复2-3步骤。
1. 主MN收到注册消息，MN收到注册信息后，根据系统表的信息进行校验，并返回校验结果。如果该节点校验通过，返回集群信息。若注册失败则一直重复。
1. 节点收到集群信息，进入更新流程。
1. 执行分布式实例启动流程，启动完成后需要切换状态（NodeState,RunningState）
1. 状态切换完成后，持久化自身的动态信息到控制文件（ctrl file）中
1. 集群信息持久化失败，启动失败，报错退出
1. 集群信息持久化成功后，向MN上报节点状态（NodeState）NODE_STATE_STARTED, 运行时状态（RunningState）NODE_RUNNING_STATE_NORMAL
1. 向MN/CN上报失败则切换上报目标，通过从线程池中添加任务去上报，直至上报成功。上报返回带有MN/CN的clusterVersion。
1. 节点校验cluster版本号，如果不一致则进入拉取流程。


非首次启动PN节点流程：

- 节点从mn读取数据，并放入nodeCache当中；  若无法获取MN主节点，启动报错  。
- 执行分布式实例启动流程，启动完成后需要切换状态（NodeState,RunningState）以及角色。
- 状态切换完成后，持久化自身的动态信息到控制文件（ctrl file）中。
- 动态信息持久化失败，启动失败，报错退出。
- 动态信息持久化成功后，向MN上报节点状态（NodeState）NODE_STATE_STARTED, 运行时状态（RunningState）NODE_RUNNING_STATE_NORMAL。
- 向MN/CN上报失败则切换上报目标，通过从线程池中添加任务去上报，直至上报成功。上报返回带有MN/CN的clusterVersion。
- 节点校验cluster版本号，如果不一致则进入拉取流程。


PN节点停止流程：

- 节点下线时需要上报自身的动态信息上报至MN,上报成功由MN广播至dn外的各个节点。
- 若上报mn失败，则上报至cn，由cn广播至各个节点。
- 此处不能因为无法上报而导致节点不能停止，所以上报一次即可，失败不重试。


### 2.1.5 PN节点扩缩容

复用DN组内节点扩缩容流程

### 2.1.6 PN组扩缩容

复用DN扩缩容流程

### 2.1.7 PN节点故障处理

PN节点无主备，通过ICS网络心跳检测感知节点状态变化。CN检测PN状态和DN类似，至少去掉  FullSync数据同步状态。

- Normal： 节点运行正常。
- Suspect: 节点被怀疑存在问题，需要确认。
- Abnormal：节点状态异常，在恢复正常之前查询执行应避免使用。


![](https://conf.yasdb.com/download/attachments/130132006/state.png?version=1&modificationDate=1696672354000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTgsImV4cCI6MTc4MjM4MjY5OH0.PwckKIeJbQobvZYEJJurnFTLi9ehUDghl2yvc_bGwmU)

### 2.1.8 PN节点用户管理

- 由于PN没有系统表也不存用户表和相关数据，仅允许sys用户直连PN节点。
- 同时PN仅作查询计算节点，由CN下发计划，因此也由CN来负责用户鉴权即可，PN将会在代码层面跳过用户判定的逻辑。


### 2.1.9 PN上数据存储

PN节点部署完成后，同步DN上元数据，包括Bucket，Part和Chunk数据。

### 2.1.10 PN节点动态视图处理

由于PN没有系统表等相关数据和部分模块的省略，部分现有的动态视图或者视图在查询过程中可能发生不可预期的错误（空指针core）， 为了避免问题出现，将采用白名单的方式放开PN的视图访问。

加入白名单视图：

|动态视图名称|保留原因|实际测试结果|
|:---|:---|---|
|V$ALERT_EVENT|显示所有告警事件名称|  
|
|V$ALLOCATOR|显示当前使用内存的状况|  
|
|V$BUFFER_ACCESS_STATISTICS|显示会话级别buffer访问的统计信息|  
|
|V$BUFFER_CONTROL|显示数据缓存区页面控制信息|  
|
|V$BUFFER_POOL|数据缓存区基本信息|  
|
|V$BUFFER_POOL_STATISTICS|数据缓存区的统计信息|  
|
|V$CHANNEL_PERF|用于查询当前会话各1对1channel的传输性能统计|  
|
|V$CM_CLUSTER_INFO|显示CM模块存储的CLUSTER INFO信息|  
|
|V$CM_GROUP_INFO|显示CM模块存储的GROUP INFO信息列表|  
|
|V$CM_NODE_INFO|显示CM模块存储的NODE INFO信息列表|  
|
|V$CM_TASK_INFO|显示CM模块存储的TASK INFO信息|  
|
|V$COLUMNAR_MEM_POOL|列式计算过程中内存池的详细信息|  
|
|V$CONTROLFILE|控制文件信息|  
|
|V$DATABASE|数据库信息|  
|
|V$DATAFILE|数据文件信息|  
|
|V$DATATYPE|显示当前系统提供的所有数据类型信息，具体清单见开发手册数据类型、游标、RECORD|  
|
|V$DIAG_FAULT|故障诊断视图，显示所有故障模式定义|不支持|
|V$DIAG_INCIDENT|故障诊断视图，显示当前所有事件信息|不支持|
|V$DIAG_PROBLEM|故障诊断视图，显示当前所有的问题信息|不支持|
|V$DICT_CACHE|字典缓存中的状态信息|  
|
|V$DICT_CURSOR|正在被使用的游标信息|  
|
|V$DIN_LINK|节点内部每条链路的信息|  
|
|V$DIN_NODE|节点内部网络链路状态的信息|  
|
|V$DIN_STAT|节点的内部网络统计的信息|  
|
|V$DUAL|虚拟表，可用于测试数据库的连通性或获取常量值|报错|
|V$DYNAMIC_VIEWS|显示当前系统提供的所有动态视图名称|  
|
|V$ERROR_CODE|显示所有错误码的详细信息|  
|
|V$FIXED_TABLE|显示当前实例中每个固定表的详细信息|  
|
|V$FIXED_VIEW_DEFINITION|显示当前实例中每个固定视图的定义信息|  
|
|V$FUNCTION|显示当前系统提供的所有内置函数信息，具体清单见开发手册内置函数|  
|
|V$GLOBAL_MPOOL|节点实例级的内存池信息|  
|
|V$HM_CHECK|显示当前所有的健康巡检项目信息|不支持|
|V$HM_CHECK_PARAM|显示健康巡检项目对应的参数信息|不支持|
|V$HM_FINDING|显示相关健康检查成果|不支持|
|V$HM_RUN|显示所有健康检查相关信息及其状态|不支持|
|V$INSTANCE|节点实例状态的信息|  
|
|V$LARGE_POOL|显示大对象池的相关统计信息|  
|
|V$LOCK|节点的锁信息|  
|
|V$LOCKED_OBJECT|显示当前所有对象锁的信息|  
|
|V$MYSTAT|会话的统计信息|  
|
|V$NODE|节点信息|  
|
|V$OPEN_CURSOR|节点statement的信息|  
|
|V$OSSTAT|来自操作系统的系统利用率统计信息|  
|
|V$PARAMETER|节点的参数信息|  
|
|V$PLANCACHE|用于检测plan cache的使用情况|  
|
|V$PQ_TQSTAT|显示当前statement上次执行的并行查询的表队列的统计信息，可用于分析表队列分片是否合理，只在连接存续期间可以查询|  
|
|V$PROCESS|当前线程信息|  
|
|V$PX_RES_MGR|显示当前节点的并行执行资源管理信息|  
|
|V$PX_SESSION|显示正在运行并行任务的会话信息|  
|
|V$PX_WORKER|显示并行worker池中的worker信息|  
|
|V$RESERVED_WORDS|显示单机和分布式所有关键字的信息|  
|
|V$SESSION|已创建的会话信息|  
|
|V$SESSION_EVENT|显示当前所有等待事件统计信息|  
|
|V$SESSION_ROLES|显示当前登录USER的所有生效角色|  
|
|V$SESSION_WAIT|显示当前所有会话等待事件信息|  
|
|V$SESSION_WORKER|执行使用session worker池的信息|  
|
|V$SESSTAT|会话的统计信息|  
|
|V$SESS_TIME_MODEL|显示各种操作的会话累积时间|  
|
|V$SGA|全局内存信息|  
|
|V$SGASTAT|全局内存各个内存池详细信息|  
|
|V$SHARE_POOL|显示系统共享内存池信息|  
|
|V$SPINLOCK|spin锁的信息|  
|
|V$SQL|SQL执行统计信息|  
|
|V$SQLAREA|共享SQL区中每条SQL的统计信息，包含SQL在statement上的内存消耗，解析，优化和执行信息|  
|
|V$SQLSTATS|SQL执行计划统计信息|  
|
|V$SQLTEXT|正在执行的SQL语句信息|  
|
|V$SQL_BIND_CAPTURE|显示所有在库缓存中的绑定变量的相关信息|  
|
|V$SQL_PLAN|节点的执行计划信息|  
|
|V$SQL_PLAN_STATISTICS|节点的子游标详细执行计划信息|  
|
|V$STATNAME|显示统计项的信息，与V$SYSSTAT中统计项对应|  
|
|V$SYSSTAT|会话的相关统计信息|  
|
|V$SYSTEM_EVENT|节点系统事件统计信息|  
|
|V$SYSTEM_PARAMETER|节点系统配置参数信息|  
|
|V$SYSTEM_WAIT_CLASS|显示当前所有等待事件类的统计信息|  
|
|V$TABLESPACE|显示当前实例的所有表空间的汇总信息|  
|
|V$TASK|显示当前执行和等待的任务信息|不支持|
|V$TEMPORARY_LOBS|显示所有临时LOB的相关统计信息|  
|
|V$VERSION|版本信息|  
|
|V$VM|节点的VM的整体内存信息|  
|
|V$VMSTAT|节点的VM的统计信息|  
|
|V$WINDOW_FUNCTION|显示当前系统提供的所有窗口函数信息|  
|


- fixed table与dynamic view都归到以上的白名单中管理
- DBA视图，由于本身需要系统表和创建视图支撑，所以PN不支持此类视图


### 2.1.10 备份恢复

yasrman支持对于PN节点备份恢复，在原有备份流程进行简化处理：

- 备份环节pn无需参与数据备份阶段
- 恢复环节pn也正常删除archive、data、dbfiles和local_fs中所有文件
- 后续以open方式拉起pn节点后，由pn节点自动创建控制文件


### 2.1.11 升级

在原有升级流程基础上进行以下改动变化：

- PN无需进行数据备份
- PN无需关心系统表的升级，需要直接忽略元数据的升级操作
- 只需保证PN能够升级重启并正常使用即可
- PN升级的时候需要去清空diskcache（由后续PN上使用diskcache的SR补充该能力）


## 2.2 应用场景

数据量大，并且已有存储设备。

## 2.3 规格约束

|类型|详细说明|备注|
|---|---|---|
|规格|单个PN组的最大节点数量是64，最大PN组数量是32|yasboot需要支持此规格，超过规格进行部署限制|
|规格|PN节点秒级扩缩容|  
|
|约束|只支持LSC列存表|  
|
|约束|分布式部署下支持PN节点|  
|
|约束|只有SYS用户可直连PN节点|  
|
|约束|直连PN节点仅能查询纳入白名单的动态视图|  
|
|约束|直连PN数据库不允许查询普通表和系统表|提示不存在|
|约束|不支持资源管理|  
|
|约束|不支持DBA视图|  
|
|约束|不支持参数自适应能力|  
|


# 3. 详细测试设计

## 3.1 测试设计方法

*主要采用场景法不同场景功能，参数使用边界值，等价类进行验证。*

## 3.2 详细测试设计

|测试场景|测试项|测试描述|预期|备注|验证结果|
|---|---|---|---|---|---|
|部署卸载    
    
|分布式存算分离部署，指定 --pn参数|1、部署 --pn 1个PN组    
  2、部署 -- pn 多个PN组    
  3、部署配置 --pn 0-0，1-0，0-1    
  4、yasboot cluster status -c xxx |1、部署成功,查询显示节点状态正常，包含PN节点,2、观察PN节点资源占用|  
|部署成功，目前cursor资源未释放|
||PN最大规格部署|1、部署指定–pn 1-64    
  2、部署指定–pn 32-1    
  3、部署指定–pn 32-64|部署成功|  
|资源不足，部署出现  yasom panic|
||部署指定--pn参数非法|1、部署指定 --pn 0-100，33-0    
  2、部署指定 --pn 1-65    
  3、部署指定 --pn 33-1    
  4、部署指定 --pn 1，0或33|生成部署文件报错|yasboot需要校验规格|边界值已经验证|
||卸载|yasboot cluster clean -c xxx   --purge --force|卸载成功，删除数据库data目录等信息|  
|  
|
|OM操作PN节点    
    
|node级别操作|restart/stop/stop/status -n PN节点,停止参数指定: --stop-mode normal|immediate|abort,启动状态指定：--start-mode  mount|nomount|open|操作正常|  
|资源不足，shutdown出  现core|
||group级别操作|restart/stop/stop/status -g PN组,停止参数指定: --stop-mode normal|immediate|abort,启动状态指定：--start-mode  mount|nomount|open|操作正常|  
|PN节点只能启动到open，指定nomount/mount启动成功，状态实际是open|
||cluster操作|restart/stop/stop/status ,停止参数指定: --stop-mode normal|immediate|abort,启动状态指定：--start-mode  mount|nomount|open|操作正常|  
|同上|
||yasboot process yasdb|restart/start/stop/status  操作|查询显示pn节点进程信息正常|  
|操作正常|
|OM配置PN节点|node级别配置|yasboot node config set/unset/show 指定PN节点|修改成功|  
|配置成功|
||group级别配置|yasboot group config set/unset/show 指定PN组|修改成功|  
|配置成功|
||cluster级别配置|yasboot cluster config set/unset/show 修改全局参数|修改成功|  
|配置成功|
|OM日志收集|全量收集|yasboot collection|收集日志包含PN节点信息，包括日志，进程堆栈，配置信息等|  
|收集成功|
||cluster收集|yasboot cluster log |收集日志包含PN节点运行日志，告警和监听日志|  
|收集成功|
|monit|启动monit|kill pn节点|自动拉起|  
|拉起成功|
||停止monit|kill pn节点|无法自动拉起|  
|关闭monit后无法拉起|
|PN上元数据同步|查询元数据信息|v$tablespace,v$databucket,v$datafile|查询显示正常|  
|v$databucket PN不支持|
|用户管理|SYS用户|直连PN|连接成功|  
|SYS连接成功|
||DBA用户|直连PN|连接报错|  
|无法连接|
||其它用户|直连PN|连接报错|  
|无法连接|
|DDL    
    
    
    
    
    
    
    
|对象操作|直连PN操作对象：,  对象,CREATE/DROP ACCESS CONSTRAINT    
  CREATE/DROP DIRECTORY    
  CREATE/DROP LIBRARY    
  CREATE/DROP PROFILE    
  CREATE/DROP ROLE    
  CREATE/DROP SQLMAP    
  CREATE/DROP SYNONYM    
  CREATE/DROP VIEW    
  CREATE/ALTER/DROP AUDIT POLICY    
  CREATE/ALTER/DROP DATABASE LINK    
  CREATE/ALTER/DROP DATABASE    
  CREATE/ALTER/DROP FUNCTION    
  CREATE/ALTER/DROP INDEX    
  CREATE/ALTER/DROP MATERIALIZED VIEW    
  CREATE/ALTER/DROP OUTLINE    
  CREATE/ALTER/DROP PACKAGE    
  CREATE/ALTER/DROP PROCEDURE    
  CREATE/ALTER/DROP PROFILE    
  CREATE/ALTER/DROP SEQUENCE    
  CREATE/ALTER/DROP/LOCK TABLE    
  CREATE/ALTER/DROP TABLESPACE SET    
  CREATE/ALTER/DROP ABLESPACE    
  CREATE/ALTER/DROP TRIGGER    
  CREATE/ALTER/DROP TYPE    
  CREATE/ALTER/DROP USER    
  CREATE/ALTER/DROP TYPE|操作报错|  
|执行报错，只有,ALTER DATABASE CONVERT TO NORMAL; 执行成功|
||LOAD DATA|直连PN操作|操作报错|  
|不支持|
||AUDIT POLICY|直连PN操作|操作报错|  
|报错|
||NOAUDIT POLICY|直连PN操作|操作报错|  
|报错|
||ANALYZE|直连PN操作|操作报错|  
|报错|
||BACKUP ARCHIVELOG|直连PN操作|操作报错|  
|不支持|
||BACKUP DATABASE|直连PN操作|操作报错|  
|报错|
||BUILD DATABASE|直连PN操作|操作报错|  
|不支持，无法启动到nomount|
||COMMENT|直连PN操作|操作报错|  
|不支持|
|DML|增删改|直连PN进行表增删改|操作报错|  
|目前无法查询的创建表|
|DQL|查询用户创建表|直连PN进行用户表查询|操作报错|  
|目前无法查询的创建表|
|DCL|grant/revoke|直连PN节点操作|操作报错|  
|不支持，需要具备读和写节点支持|
|其它SQL|SET AUTOTRACE|直连节点PN节点操作|**操作成功**|  
|只能显示结果，无法打印出计划，提示表或视图不存在|
||SET TRANSACTION|直连节点PN节点操作|操作报错|  
|报错，需要读写权限|
||SHUTDWON|直连节点PN节点操作|**操作成功**|  
|操作成功|
||EXPLAIN|直连节点PN节点操作|**操作成功**|只有视图可查询|可查看视图计划|
||FLASHBACK|直连节点PN节点操作|操作报错|  
|报错，需要读写权限|
||ALTER SYSTEM|直连节点PN节点操作|**操作成功**|  
|操作成功|
||ALTER SESSION|直连节点PN节点操作|**操作成功**|  
|操作成功|
||MERGE|直连节点PN节点操作|操作报错|  
|报错，需要读写权限|
||PURGE|直连节点PN节点操作|操作报错|  
|报错，需要读写权限|
|事务相关SQL|commit/rollback/savepoint/release savepoint|直连PN节点操作|操作报错|  
|报错，需要读写权限|
|动态视图|白名单动态视图|直连PN操作动态视图，支持视图链接：,2.1.10 PN节点动态视图处理|查询结果正确|  
|部分节点查询错误|
||非白名单视图|直连PN查询非白名单中视图|不能出现core|  
|无core|
|系统表|查询系统表|直连PN查询系统表|查询报错|  
|提示不存在|
|高级包|高级包参考：    [内置高级包 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/00%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85.html)  |直连PN进行操作|预期与DN可操作能力一致|  
|除了本地查询有结果，其它不支持|
|可靠性测试    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|停止节点|PN节点执行shutdown normal|停止成功|  
|停止成功|
|||PN节点执行shutdown immediate|停止成功|  
|停止成功|
|||PN节点执行shutdown abort|停止成功|  
|停止成功|
|||PN节点执行shutdown wait standby|停止成功|  
|停止成功|
||节点故障    
    
    
    
    
    
    
    
    
    
|故障PN组内一个节点(kill -9)|  
|无业务，下同|kill后拉起成功|
|||故障1个PN组(kill -9)|  
|  
|kill后拉起成功|
|||故障所有PN组(kill -9)|  
|  
|kill后拉起成功|
|||部分CN故障，PN节点故障恢复|  
|  
|kill后拉起成功|
|||全部CN故障，PN故障恢复|  
|  
|kill后拉起成功|
|||MN节点组无Primary，PN故障恢复|  
|  
|PN重启成功，连接MN主节点超时后会自动shutdown|
|||MN节点组全部故障，PN故障恢复|  
|  
|PN重启成功，连接MN主节点超时后会自动shutdown|
|||MN主备倒换过程，PN故障恢复|  
|  
|kill后拉起成功|
|||1个DN组故障，PN故障恢复|  
|  
|kill后拉起成功|
|||所有DN组故障，PN故障恢复|  
|  
|kill后拉起成功|
|||CN/MN/DN故障，PN节点故障恢复|  
|  
|PN重启成功，连接MN主节点超时后会自动shutdown|
||集群故障    
    
|停止所有节点再次拉起|启动正常|  
|当内存不足时，停止节点出现core|
|||重启所有服务器，然后拉起集群|启动正常|  
|  
|
|||服务器掉电，然后拉起集群|启动正常|  
|  
|
||网络|PN组内节点之间网络不通|  
|  
  无业务背景|  
|
|||PN组内节点之间网络丢包|  
||  
|
|||PN组内节点之间网络错包|  
||  
|
|||PN组内节点之间网络时延大|  
||  
|
|||PN组之间网络异常(不通，丢包，错包，时延)|  
||  
|
|||PN节点与CN之间网络异常(不通，丢包，错包，时延)|  
||  
|
|||PN节点与MN之间网络异常(不通，丢包，错包，时延)|  
||  
|
|||PN节点与DN之间网络异常(不通，丢包，错包，时延)|  
||  
|
|||PN节点与其它节点之间网络异常(不通，丢包，错包，时延)|  
||  
|
||磁盘|1、PN节点安装磁盘满，观察PN节点状态,2、磁盘满情况下重启节点|  
|  
|  
|
||内存|服务器内存不足|  
|  
|重启PN节点会core|
||句柄|PN节点所在服务器句柄不足，观察业务，重启PN节点|无core|  
|PN节点无异常|
|||PN节点所在服务器进程数配置不足，观察业务，重启PN节点|无core|  
|进程全部退出|
||数据文件损坏|数据库dbfile目录下文件损坏|  
|  
|无告警，重启后文件恢复|
|||数据库dbfile目录下文件丢失|  
|  
|无告警，重启后文件恢复|
|扩缩容    
    
    
    
|PN组内扩缩容    
    
    
    
    
    
    
|一次扩容1个PN节点|记录时间|  
|32s，再次扩容5s|
|||一次扩容10个PN节点|记录时间|  
|6s|
|||一次扩容到最大值64节点|成功|  
|成功|
|||扩容超过组内最大规格|报错|  
|拦截|
|||一次缩容1个节点|记录时间|  
|8s|
|||一次缩容多个节点(5,10)|记录时间|  
|  
|
|||缩容到1个节点|成功|  
|成功|
|||缩容小于1个节点|报错|  
|提示至少保留一个节点|
|||扩容PN节点失败，进行回滚|回滚成功|  
|  
|
|||缩容PN节点失败，进行回滚|删除成功|  
|  
|
||PN组扩缩容    
    
    
    
    
    
    
    
|扩容1个PN组|成功|  
|成功|
|||扩容5个PN组|成功|  
|成功|
|||扩容到32PN组|成功|  
|报错，与DN未区分开|
|||扩容超过32PN组|报错|  
|报错|
|||缩容1个PN组|成功|  
|成功|
|||缩容5个PN组|成功|  
|成功|
|||删除所有PN组|成功|  
|成功|
|||缩容后再次扩容|成功|  
|成功|
|||集群内无PN组，扩容PN组|成功|  
|成功|
|||扩容PN组失败，进行回滚|回滚成功|  
|  
|
|||缩容PN组失败，进行回滚|删除成功|  
|  
|
|备份恢复    
    
|yasrman备份恢复|1、通过yasrman全量备份带PN集群,2、通过yasrman增量备份带PN集群|备份成功|  
|备份成功，PN不备份|
|||通过yasrman恢复带PN集群|恢复成功，检查数据与备份时一致|  
|恢复成功|
|||PN节点故障，进行备份|备份失败|  
|备份失败|
|||数据备份过程，PN节点故障|备份失败，自动删除已经创建备份集|  
|可能失败或成功|
|||数据恢复过程，PN节点故障|恢复成功|  
|恢复成功，不校验PN|
||yasbak备份恢复|通过yasbak备份带PN集群|备份成功|  
|备份成功|
|||通过yasbak恢复带PN集群|恢复成功|  
|恢复成功|
|升级|快速升级|部署带PN组，小版本之间快速升级|升级成功，业务运行正常|  
|  
|
||离线升级|部署带PN组，大版本之间进行升级|升级成功，业务运行正常|  
|  
|
||回滚|升级过程注入故障导致失败，进行回滚|回滚成功，业务运行正常|  
|  
|
|长稳|带PN部署长稳|运行不低于24小时，观察是否存在内存泄漏|无内存泄漏|  
|  
|
|内存检测|asan版本运行|运行asan版本，重启PN节点|无内存泄漏|  
|存在泄漏|


  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|是|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|是|


  


# 4. 测试用例

# 5. 测试框架设计

1、安装部署框架增加用例，需要支持S3接口；

2、guider支持PN部署，框架支持S3接口。

# 6. 测试环境说明

*测试环境需要配置支持S3接口*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：2024.6.7

## Attachments:

[YDBRD-26827分布式支持部署PN组文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmNhMWFkOWEzMzExZGM5NzIwIiwicmVmX2lkIjoiNjczOTZlNmI3MjgyMDZlZmI5MmYyN2YwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODk4LCJleHAiOjE3ODI0NTgyOTh9.Q7GuiR2cGNdX0zIokDABEiRJ6ZXWXLWE0aKILDhWvuc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,会议时间：2024-05-28,参与人：李伟超，陈步隆，周宇航，施新华,内容：,1. 本需求不包含业务，去掉背景业务；
1. 去掉S3接口测试；
1. 补充kill不同信息信号输入类型，包含15,9,18,19,11
1. 验证PN节点是否能正常生成黑匣子
,Posted by shixinhua at 五月 28, 2024 17:45|
|---|
