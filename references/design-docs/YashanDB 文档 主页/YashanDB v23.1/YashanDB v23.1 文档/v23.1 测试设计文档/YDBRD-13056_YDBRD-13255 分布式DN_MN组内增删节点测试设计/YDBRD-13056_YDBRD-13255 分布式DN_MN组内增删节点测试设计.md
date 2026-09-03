Created by 刘美秀, last modified by  施新华 on 十一月 14, 2023

# 1. 概述

本文档描述 分布式DN 组内增删节点  的  测试设计，

SR：        [YDBRD-13056](https://jira.yasdb.com/browse/YDBRD-13056?src=confmacro)    -  DN组支持增删节点  完成    [YDBRD-13255](https://jira.yasdb.com/browse/YDBRD-13255?src=confmacro)    -  【OM】分布式DN组内备节点的添加与删除  完成    [YDBRD-13253](https://jira.yasdb.com/browse/YDBRD-13253?src=confmacro)    -  【OM】分布式MN组内备节点的添加与删除  完成

  [YDBRD-13057](https://jira.yasdb.com/browse/YDBRD-13057?src=confmacro)    -  MN组支持增删节点  完成

开发设计文档：    [DN,MN组内增删备机概要设计方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109588639)  

# **2. 需求分析**

## **2.1 功能特性**

**可一次性增加/删除 MN 多个备节点**

- 生成配置文件：    `yasboot config node gen`  
- 部署新增主机：    `yasboot host add`  
-   `扩容：yasboot node add`  
-   `缩容：yasboot node remove`  
-   `任务阶段task list:NodeAdd，BuildDatabaseToMultiAddress, AddDEAlterHA`  


  


### 2.1.1 生成新增节点配置文件命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot config node gen</span>
```

执行新增命令返回成功后，仅代表新增备机前置条件满足，任务创建成功。仍有可能正在进行数据同步，确认该节点正式可用，可通过查询视图进行确认新增备机任务是否成功。

|选项|含义|
|:---|:---|
|-c, --cluster|生成的集群名称|
|-u, --username|主机ssh用户名|
|-p, --password|ssh登录密码|
|-N|ssh免密登录|
|--ip|部署的ip地址，允许多个ip上新增|
|--port|主机ssh连接端口|
|-i, --install-path|数据库安装路径（HOME目录）|
|--data-path|数据库实例的DATA目录|
|-f, --force|是否强制部署数据库，强制表示不会检查当前主机运行状态是否能够部署|
|-g,--group-id|组id。默认为1|
|--node|新增的总节点数。默认为1|
|--host-id|主机的id，允许多个主机|


### 2.1.2 部署新增主机命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot host add</span>

```

|选项|含义|
|:---|:---|
|-i,--install-pkg|软件包文件本地路径|
|-t,--toml|要安装软件包的主机相关信息的配置文件|
|-f, --force|忽略错误并强制安装，默认为false|
|--disable|屏蔽任务进度条展示|
|-c,--cluster|集群名称|


### 2.1.3 扩容命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot node add</span>

```

|选项|含义|
|:---|:---|
|*-c, --cluster*|集群名称|
|*-t, --toml*|扩容节点的配置文件|
|*-d, --child*|展示任务以及子任务信息|
|*--disable*|屏蔽运行的进度信息|
|*--no-primary*|是否允许在没有主节点的情况执行操作，默认为false|


### 2.1.4 缩容命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot node remove</span>

```

|选项|含义|
|:---|:---|
|*-c, --cluster*|YashanDB的集群名|
|*-n, --node-id*|节点ID（可以通过cluster status命令查看）|
|*-f, --force*|跳过确认直接执行命令|
|*-p, --purge*|删除缩容节点的data数据|
|*-w, --nowait*|运行后不等待执行命令结果|
|*-d, --child*|展示任务以及子任务信息|
|*--disable*|屏蔽运行的进度信息|
|*--node-ids*|要删除的节点ID，支持多个，使用逗号分隔|
|*--clean*|清理所有扩容失败的节点，默认为false（不适用于CN节点）|
|*--no-primary*|是否允许在没有主节点的情况执行操作，默认为false（不适用于CN节点|


### 2.1.5 查看任务

task list 扩容三阶段：NodeAdd，BuildDatabaseToMultiAddress, AddDEAlterHA

### 2.1.6 视图

系统表TASK$和视图dv$task

|字段|描述|
|---|---|
|task_id:|任务管理ID，单调递增，持久化多个任务时，按taskId排序，从下往上执行。|
|task_type|任务类型，TASK_TYPE_SCALE_OUT, TASK_TYPE_SCALE_IN,|
|task_status|描述任务状态，TASK_STATUS_READY, TASK_STATUS_OPENING, TASK_STATUS_COMPLETED|
|task_create_time|描述任务创建时间|
|task_update_time|描述任务更新时间|
|task_data|描述当前任务数据，根据各任务机制，按照自身逻辑添加。|


## **2.2 规格约束**

1. 分布式进行增删节点时，保证集群处于可用状态，增删节点的组内所有节点处于正常可用状态（删除节点处于异常状态也可进行删除操作）。
1. 不允许直接删除主节点，需要先执行switchover将主节点降备。
1. 增删节点不可与switchover并发。
1. 增删节点不允许并发（无论是新增还是删除，上一次任务没完成前不允许执行再新增任务）。
1. 0 < 分布式最大扩容的备机总数 <= 2
1. 组内无主节点时不允许扩容
1. 现阶段不支持节点隔离能力，因此删除节点时，现只支持将被删除节点停止。待隔离能力实现后，再支持被删除节点不停止的选项。
1. 分布式下，om缩容不允许删光组内所有节点。


  


节点组打开自选举，OM可以一次增加多个备机或者删除多个备机，扩容时需要保证备节点与主节点下面参数一致：

- DIN_CONNECTIONS_PER_NODE
- HA_ELECTION_ENABLED
- HA_ELECTION_TIMEOUT
- HA_HEARTBEAT_INTERVAL
- HA_ELECTION_LEADER_LEASE_ENABLED
- QUORUM_SYNC_STANDBYS


# **3 测试设计方法**

### 3.1 特性关联领域分析：

- 功能性：  参数校验、结合业务场景、修改配置文件中参数


- 部署形态：分布式  （一主两备）同机部署、跨机部署、打开自选主
- 可靠性、异常：扩缩容过程中异常，需手动clean回滚
- 易用性：是否简单易上手，报错是否明确、可查看任务进度


### 3.2 测试设计：

本次测试设计主要采用场景法以及边界值、等价类方法验证功能性、可靠性、并发

涉及视图：  系统表TASK$和视图v$task  ，v$cm_node_info

数据对象覆盖：TABLESPACE、TABLESPACE SET、TABLE、INDEX、ACCESS CONSTRAINT、VIEW、AUDIT POLICY、USER、ROLE、COMMENT、OUTLIKE、SQLMAP

  


# **4 详细测试设计**

测试设计如下：

（1）参数验证：生成配置文件hosts_add.toml，yasdbName_add.toml

|命令|参数|有效等价类|预期|备注|
|:---|:---|---|---|---|
|yasboot config node gen|--ip|填写单个ip、填写多个ip|成功|  
|
|  
|  
|全是已有主机ip|报错host 192.168.4.126 exist, please use --host-id to generate file|  
|
|  
|  
|全是新主机ip|成功|仅指定ip时会生成  hosts_add.toml,仅指定host-id时不会生成  hosts_add  .toml|
|  
|  
|部分已有主机ip，部分新主机ip|不能同时指定新机和旧机，报错ip已存在，且不能同时指定host-id和ip，同时指定host和ip报错you can only give --ip or --host-id|  
|
|  
|  
|新增主机已有同名集群|报错confirm whether a cluster with the same name: 'yashan' has been deployed.|  
|
|  
|-g,--group-id|已有groupid|成功|  
|
|  
|  
|不存在的groupid|报错6 unfound in db|  
|
|  
|  
|指定多个groupid|报错yasboot error: invalid string '4,5', reason: cannot convert to int64|  
|
|  
|  
|CN|报错unsupport group type|  
|
|  
|  
|group 组已有三个节点|报错max node you can add is 0, but 2 you given|  
|
|  
|--node|范围内的节点数|成功|分布式节点最大规格3|
|  
|  
|已有1节点，节点数>3|报错max node you can add is 2, but 3 you given|  
|
|  
|--host-id|单个id已存在，|成功|  
|
|  
|  
|多个已存在id|成功|  
|
|  
|  
|部分id不存在|报错|  
|
|yasboot host add|-i,--install-pkg|填写正确安装包路径|成功|  
|
|  
|-c,--cluster|与  hosts_add  .toml中一致的集群名|成功|  
|
|yasboot node add|-t,--toml|填写正确配置文件|  
|  
|
|  
|--no-primary|无主节点+加参数=true、有主节点+加参数=true|  
|  
|
|yasboot node remove|--purge|加参数、不加参数|  
|  
|
|  
|--no-primary|有主节点-加参数、有主节点-不加参数、无主节点-加参数|  
|  
|
|  
|--node-ids|填一个存在节点|成功|  
|
|  
|  
|填一个不存在的节点|报错|  
|
|  
|  
|填多个存在节点|成功|  
|
|  
|  
|填多个节点其中部分节点不存在|报错|  
|
|  
|  
|缩容单个CN 节点|  
|  
|
|  
|  
|缩容多个CN 节点|  
|  
|
|  
|  
|remove不同节点组|  
|  
|
|  
|--clean|加参数、不加参数|  
|  
|


  


（2）扩缩容验证

|特性|测试因子|测试场景|预期|备注|
|---|---|---|---|---|
|生成配置|节点数|config node生成2个节点|成功|  
|
|  
|  
|config node生成>3个节点|报错|  
|
|  
|  
|生成3个host，2个节点|成功|  
|
|  
|可靠性|mn主节点 故障时生成配置|成功|  
|
|扩容|节点|从1主 扩容 到1主1备|成功|  
|
|  
|  
|从1主1备 扩容到 1主2备|成功|  
|
|  
|  
|从1主 扩容到 1主2备|成功|  
|
|  
|  
|add 3节点|超过最大值，报错|  
|
|  
|  
|节点扩容后再次扩容|报错port used host0002:1698 is repeated, please check node betweeen 3-5 and 3-4|  
|
|  
|  
|节点扩容，缩容时不清理节点数据，再次扩容|成功 因为节点id复用后路径不一样|  
|
|  
|  
|主节点不同状态时扩容：  stop/normal/abnormal/noumout|open/normal 成功，其他状态时报错node 3-1 is unavailable|  
|
|  
|  
|扩容2节点后，缩容一节点，再次使用同一份配置扩容|扩容失败|  
|
|  
|  
|扩容成功后yasboot cluster status 查看状态|有新增节点信息|  
|
|  
|  
|扩容成功后yasboot 重启节点|成功|  
|
|  
|  
|扩容成后查看视图：系统表：sys.node_info$；视图：v$cm_node_info、dv$node|有新增的扩容的节点信息|  
|
|  
|  
|  
|  
|  
|
|  
|机器|扩容节点在原有主机|成功|  
|
|  
|  
|扩容节点在新主机|成功|  
|
|  
|主备切换|扩容后switchover|成功|  
|
|  
|  
|原有1节点，扩容+1节点，扩容后主节点故障|无法自动选主|  
|
|  
|  
|原有1节点，扩容+2节点，扩容后主节点故障|自动选主成功|  
|
|  
|  
|原有1节点，扩容+2节点，remove 1节点后主节点故障|无法自动选主|  
|
|  
|配置|扩容参数不一致：,- DIN_CONNECTIONS_PER_NODE
- HA_ELECTION_ENABLED
- HA_ELECTION_TIMEOUT
- HA_HEARTBEAT_INTERVAL
- HA_ELECTION_LEADER_LEASE_ENABLED
- QUORUM_SYNC_STANDBYS
|报错|  
|
|  
|  
|参数检查|v$election, v$archive_dest_status视图中节点信息正确|  
|
|  
|并发|扩容时，DDL/DML|扩容过程不影响业务|  
|
|  
|  
|扩容时，元数据导入--MN|  
|  
|
|  
|  
|扩容时，业务数据导入--DN|  
|  
|
|  
|  
|扩容时，数据恢复--|不能恢复|  
|
|  
|  
|ddl_queue$中有推送记录时扩容|扩容后新节点switchover ，可以查询到ddl_queue$中记录|  
|
|  
|  
|同时扩容缩容 同一节点组的相同节点 |报错|  
|
|  
|  
|同时扩容缩容 同一节点组的不同节点 |报错|  
|
|  
|  
|同时扩容不同节点组|成功|  
|
|  
|  
|同时缩容不同节点组|成功，缩容1-2，3-2|  
|
|  
|  
|扩容时主备切换|报错|  
|
|  
|可靠性|无主节点|不指定  --no-primary扩容报错，指定则可以扩容|阶段一  NodeAdd|
|  
|  
|扩容前MN备节点故障|  
|  
|
|  
|  
|扩容前的组备节点故障|node 3-3 is unavailable|  
|
|  
|  
|CN/其他DN 故障时扩容|不影响扩容，故障解除后$cm_node_info一致|  
|
|  
|  
|拉起新增节点失败|  
|  
|
|  
|  
|组内其他备机故障时扩容|失败|  
|
|  
|  
|集群版本号不一致时MN主节点故障|网络|阶段二  BuildDatabaseToMultiAddress,阶段三 AddDEAlterHA|
|  
|  
|扩容时（build/链路配置）时主机故障|  
|  
|
|  
|  
|扩容时（build/链路配置）时主机abnormal |  
|  
|
|  
|  
|扩容时（build/链路配置）时 原有备节点故障|  
|  
|
|  
|  
|扩容时（build/链路配置）时 新增备节点故障|  
|  
|
|  
|  
|扩容时（build/链路配置）时 switchover|报错|  
|
|  
|  
|扩容时（build/链路配置）时mn主节点故障|  
|  
|
|  
|  
|mn switchover|不影响|  
|
|  
|  
|扩容时CN故障|故障解除后CN 能查到新增节点信息|  
|
|  
|  
|链路配置时 OM故障|  
|  
|
|  
|  
|回滚失败再次回滚|失败报错|  
|
|  
|  
|扩容host ip 不可达--hosts_add.toml|失败报错|  
|
|  
|  
|扩容端口被占用|失败报错|  
|
|  
|  
|扩容路径无权限  --data-path|stderr: mkdir /home/root: permission denied|  
|
|  
|  
|扩容时集群停止|  
|  
|
|  
|  
|扩容失败后再次扩容|exist scale failed node: [4-5], please execute 'yasboot node remove --clean' first|  
|
|  
|  
|扩容失败后重启集群|node yashan.4-6 is ScaleFailed, you can only use 'yasboot node' to operate other nodes in this group|  
|
|缩容|节点|1主1备缩容 到1主|成功|  
|
|  
|  
|1主2备缩容到1主|  
|  
|
|  
|  
|1主2备缩容到1主1备|  
|  
|
|  
|  
|仅1主时缩容|报错|  
|
|  
|  
|最大保护模式下，修改quorum|删除节点后需满足选举|  
|
|  
|  
|缩容后主异常，可重新选主|  
|  
|
|  
|  
|缩容参数检查|v$election, v$archive_dest_status视图中节点信息正确|  
|
|  
|  
|业务背景下缩容|业务正常|  
|
|  
|  
|CN不stop，缩容CN 节点|  
|  
|
|  
|  
|--node-ids 缩容多个CN节点|  
|  
|
|  
|可靠性|缩容时主节点异常|  
|  
|
|  
|  
|缩容时备节点异常|  
|  
|
|  
|  
|缩容时OM 异常|  
|  
|
|  
|  
|缩容时switchover|失败|  
|
|  
|  
|缩容失败后再次缩容|  
|  
|
|  
|  
|缩容时集群停止，拉起集群后|  
|  
|


  


  


（2）  专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|是|
|可靠性|是|


# **5 测试用例**

门槛用例

  


# **6 测试框架设计**

本次测试采用codbase_test测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **7 测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|1节点部署,1主2备部署|
