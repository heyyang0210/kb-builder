Created by 刘美秀 on 十月 31, 2023

# 1. 概述

本文档描述 分布式DN 组在线扩容的测试设计，

SR：           [YDBRD-743](https://jira.yasdb.com/browse/YDBRD-743?src=confmacro)    -  DN组支持在线扩缩容  完成    [YDBRD-13250](https://jira.yasdb.com/browse/YDBRD-13250?src=confmacro)    -  【OM】支持分布式数据库DN组扩缩容操作  完成

开发设计文档：

DN组扩缩容：    [DN组在线扩容设计文档 - 郑嘉星 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95099008)     、    [DN组扩缩容规格说明 - 郑嘉星 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122063142)    、    [内置dataspace、tablespace set相关建库参数 - 郑嘉星 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124262653)  

数据重分布：    [数据重分布设计文档 - 郑嘉星 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=115147400)  

chunk搬迁：    [支持Chunk搬迁（user-defined) - 邬建川 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119557605)  

# **2. 需求分析**

## **2.1 功能特性**

**支持增加/删除DN组**

- 生成配置文件：    `yasboot config group gen`  
- 部署新增主机：    `yasboot host add`  
-   `扩容：yasboot group add`  
-   `缩容：yasboot group remove`  


**支持重分布命令**

- 自动/手动重分布：    `yasboot dataspace redistribute`  


PS：DS_SCALE_OUT_FACTOR指定创建数据空间时默认每个节点组的分片数，实际chunk数=DS_SCALE_OUT_FACTOR * DN组数

### 2.1.1 扩缩容

#### （1）生成新增节点配置文件命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot config group gen</span>
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
|--node|新增的总节点数。默认为1|
|--group|新增的总组数。默认为1|
|--host-id|主机的id，允许多个主机（已有主机，和--ip只能选一）|


#### （2）部署新增主机命令

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


#### （3）扩容命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot group add</span>

```

|选项|含义|
|:---|:---|
|*-c, --cluster*|集群名称|
|*-t, --toml*|扩容节点的配置文件|
|*-d, --child*|展示任务以及子任务信息|
|*--disable*|屏蔽运行的进度信息|
|--auto-redistribute ON/OFF|扩容后是否自动重分布USERS dataspace，默认值为ON|
|--clean-  residual-immediately|指定后自动清理迁移之后残留的chunk表空间，可能会导致正在执行的查询报错。  默认不自动清理,等价于  alter system clean residual tablespace|


  


新DN组拉起，所有节点NOMOUNT->OPEN

扩容任务状态变化，INIT->START->FINISH

重分布任务状态变化，INIT→START→FINISH

alter system clean residual tablespace 怎么判断是否该清理

#### （4）缩容命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot group remove</span>

```

|选项|含义|
|:---|:---|
|*-c, --cluster*|YashanDB的集群名|
|*-f, --force*|跳过确认直接执行命令|
|*-p, --purge*|删除缩容节点的data数据，不指定时是否停止进程？|
|*-w, --nowait*|运行后不等待执行命令结果|
|*-d, --child*|展示任务以及子任务信息|
|*--disable*|屏蔽运行的进度信息|
|*--group-id*|要删除的节点ID，支持多个，使用逗号分隔|
|--shutdown|通过指定–shutdown，移除完DN组之后，自动停止所有被移除的节点进程,从集群剔除掉后是否会影响业务？|


  


### 2.1.2 重分布命令

```
yasboot cluster redistribute

```

|选项|含义|
|:---|:---|
|-c,--cluster|集群名称|
|--dataspace-id|指定dataspace id，默认0|
|--clean-  residual-immediately|自动清理迁移之后残留的表空间，可能会导致正在执行的查询报错。  默认不自动清理|
|--chunk-id|指定迁移的chunk id，支持指定多个chunk，逗号分隔|
|--target-group GROUP_ID|指定目标DN组，限制1个|


```


```

## **2.2 规格约束**

**规格限制**    
  只支持一个内置的dataspace，不支持用户创建dataspace。

最大支持32个节点组

**并发限制**    
  集群中增删节点组命令和其他会改变集群状态的命令、重分布、组内增删节点、不能并发，如组内增删节点、集群正常停止或重启（-f可以）等。

增删节点组过程中，执行ddl会报错、

**集群状态要求**    
  扩容命令开始执行时所有主节点状态正常，否则报错。----缩容前 校验主节点

迁移表空间过程中，目标DN组所有主备机全程在线，否则报错。—需要手动remove 

**故障恢复**    
  不支持扩容任务续接，如果执行到一半失败，只能保证已经成功的部分可用，失败的部分可清理，但不能重新执行任务。

重分布过程中出现异常中断情况，chunk迁移会保持在出现中断时的状态，可能会有一部分chunk迁移成功，一部分chunk迁移失败。

# **3 测试设计方法**

### 3.1 特性关联领域分析：

- 功能性：  参数校验、结合业务场景、修改配置文件中参数


- 部署形态：分布式  （一主两备）同机部署、跨机部署、打开自选主
- 可靠性、异常：扩缩容过程中异常，可自动回滚
- 易用性：是否简单易上手，报错是否明确、可查看任务进度


### 3.2 测试设计：

本次测试设计主要采用场景法以及边界值、等价类方法验证功能性、可靠性、并发

设计视图：dv$task--正在执行的任务，v$cm_node_info, task$--

数据对象覆盖：TABLESPACE、TABLESPACE SET、TABLE、INDEX、ACCESS CONSTRAINT、VIEW、AUDIT POLICY、USER、ROLE、COMMENT、OUTLIKE、SQLMAP

表类型覆盖：lsc/tac，复制表/分布表/分区表，有无索引、

表空间覆盖：普通表空间、mms、databuket、

表空间集覆盖：普通表空间集、mms表空间集

  


# **4 详细测试设计**

测试设计如下：

（1）参数验证：生成配置文件hosts_add.toml，yasdbName_add.toml

|  
|命令|参数|有效等价类|预期|备注|
|:---|:---|:---|---|---|---|
|1|yasboot config group gen|--ip|填写单个ip、填写多个ip|成功|  
|
|2|  
|  
|全是已有主机ip|成功|  
|
|3|  
|  
|全是新主机ip|成功|仅指定ip时会生成  hosts_add.toml,仅指定host-id时不会生成  hosts_add.toml|
|4|  
|  
|部分已有主机ip，部分新主机ip|不能同时指定新机和旧机，报错ip已存在，且不能同时指定host-id和ip|  
|
|5|  
|group|指定多个|成功|  
|
|6|  
|--node|范围内的节点数|成功|分布式节点最大规格3|
|7|  
|  
|节点数>3|报错|  
|
|8|  
|--host-id|单个id已存在，|成功|  
|
|9|  
|  
|多个已存在id|成功|  
|
|10|  
|  
|部分id不存在|报错|  
|
|11|yasboot host add|-i,--install-pkg|填写正确安装包路径|成功|  
|
|12|  
|  
|版本包和部署时的不一致|成功|目前未校验版本|
|13|  
|-c,--cluster|与  hosts_add  .toml中一致的集群名|成功|  
|
|14|yasboot group add|-t,--toml|填写正确配置文件|  
|  
|
|15|  
|  
|填写错误配置文件|  
|  
|
|16|  
|--cluster|正确cluster|  
|  
|
|17|  
|  
|错误cluster|  
|  
|
|18|  
|  
|cluster 和配置中的不一致|  
|  
|
|19|yasboot group remove|--purge|加参数、不加参数|  
|  
|
|20|  
|--group-id|填一个存在节点|成功|  
|
|21|  
|  
|填一个不存在的节点|报错|  
|
|22|  
|  
|填多个存在节点|成功|  
|
|23|  
|  
|填多个组其中部分组不存在|报错|  
|
|24|  
|--clean|加参数、不加参数|  
|  
|


  


（2）扩容验证

|  
|特性|测试因子|测试场景|预期|备注|
|---|---|---|---|---|---|
|1|生成配置|节点数|config node生成3个节点|成功|  
|
|2|  
|  
|config node生成>3个节点|报错|  
|
|3|  
|  
|生成3个host，2个节点组，3个节点--怎么分布|成功|  
|
|4|扩容|节点|新增节点组 新增1-3个节点|成功|  
|
|5|  
|  
|新增节点组 新增4个节点|报错|  
|
|6|  
|节点组|扩容单个节点组|成功|  
|
|7|  
|  
|扩容多个节点组，扩容至最大节点组（32个）|成功|  
|
|8|  
|  
|扩容超过32个节点组|超过最大值，报错|  
|
|9|  
|  
|同一节点组扩容后再次扩容|报错|  
|
|10|  
|  
|节点组扩容，缩容时不清理节点数据，再次扩容|groupid是否重用？--不重用|  
|
|11|  
|  
|MN主节点/CN/其他DN不同状态时扩容：  normal|成功|  
|
|12|  
|  
|MN主节点/CN/其他DN不同状态时扩容：  stop/abnormal/noumout|报错|  
|
|13|  
|  
|扩容节点组3节点后，缩容一节点，再次使用同一份配置扩容|扩容失败|  
|
|14|  
|  
|扩容成功后yasboot cluster status 查看状态|有新增节点组信息|  
|
|15|  
|  
|扩容成功后yasboot 重启节点|  
|  
|
|16|  
|  
|启动monitor，扩容，扩容成功后 看护，缩容开始取消时看护|扩容成功后新增扩容节点组能被monitor监控|  
|
|17|  
|  
|扩容成后查看视图：系统表：sys.node_info$；视图：v$cm_node_info、dv$node|有新增的扩容的节点组信息|  
|
|18|  
|  
|chunk数=节点组数|成功|  
|
|19|  
|  
|chunk数>节点组数|成功|  
|
|20|  
|  
|chunk数<节点组数|报错|  
|
|21|  
|--auto-redistribute|on 扩容后自动重分布|  
|  
|
|22|  
|  
|off 扩容后不自动重分布|  
|  
|
|23|  
|--clean-  residual-immediately|指定，扩容后立马删除旧数据|  
|  
|
|24|  
|alter system clean residual tablespace|不指定clean后手动清除，直连DN/MN 执行|  
|  
|
|25|  
|  
|不指定，扩容后不会删除旧数据|  
|  
|
|26|  
|机器|扩容节点组在原有主机|  
|  
|
|27|  
|  
|扩容节点组在新主机|  
|  
|
|28|  
|主备切换|扩容后新增节点组switchover|成功|  
|
|29|  
|  
|扩容后新增节点组主节点故障|自动选主成功|  
|
|30|  
|配置cluster_add.toml|扩容参数不一致：,- DIN_CONNECTIONS_PER_NODE
- HA_ELECTION_ENABLED
- HA_ELECTION_TIMEOUT
- HA_HEARTBEAT_INTERVAL
- HA_ELECTION_LEADER_LEASE_ENABLED
- QUORUM_SYNC_STANDBYS
- DB_BLOCK_SIZE
|报错|  
|
|31|  
|  
|参数检查|v$election, v$archive_dest_status视图中节点信息正确|  
|
|32|  
|  
|yas_type改为SE|报错|  
|
|33|  
|  
|yas_type改为CE|报错|  
|
|34|  
|  
|data_path 为不存在路径|  
|  
|
|35|  
|  
|hostid 为不存在hostid|  
|  
|
|36|  
|  
|_ADDR 地址有误|  
|  
|
|37|  
|  
|端口被占用|  
|  
|
|38|  
|  
|role 全改为1|报错|  
|
|39|  
|  
|role 全改为2|报错|  
|
|40|  
|并发|扩容时执行DDL ，再执行扩容|等待超时 ？|  
|
|41|  
|  
|扩容时执行DDL|DDL 被拦截|  
|
|42|  
|  
|扩容时执行DML|不会报错|  
|
|43|  
|  
|长查询时扩容|查询成功，--clean有可能报错|  
|
|44|  
|  
|扩容时，元数据导入|拦截|  
|
|45|  
|  
|扩容时，业务数据导入|  
|  
|
|46|  
|  
|扩容时，恢复备份数据|数据没法恢复|  
|
|47|  
|  
|ddl_queue$中有推送记录时扩容|扩容后新节点switchover ，可以查询到ddl_queue$中记录---待定|  
|
|48|  
|  
|不同会话同时缩容和扩容 新增节点组|报错|  
|
|49|  
|  
|不同会话 同时扩容同1 节点组|报错|  
|
|50|  
|  
|不同会话 同时扩容/缩容不同节点组|报错|  
|
|51|  
|  
|不同会话同时扩容节点组+缩容不同节点组节点|报错|  
|
|52|  
|  
|扩容时新增节点组/MN/其他DN 主备切换|报错|  
|
|53|  
|可靠性|CN/其他DN 故障时扩容|失败|  
|
|54|  
|  
|拉起新增节点组失败|  
|  
|
|55|  
|  
|扩容时（添加节点组/build/链路配置/元数据复制表数据迁移/数据重分布）时新增节点组的主节点故障|  
|  
|
|56|  
|  
|扩容时（添加节点组/build/链路配置/元数据复制表数据迁移/数据重分布）时 新增备节点故障|  
|  
|
|57|  
|  
|扩容时（添加节点组/build/链路配置/元数据复制表数据迁移/数据重分布）时 新增节点组switchover|  
|  
|
|58|  
|  
|扩容时（新增节点组/build/链路配置）时mn主节点故障|  
|  
|
|59|  
|  
|扩容时（添加节点组/build/链路配置/元数据复制表数据迁移/数据重分布）时 mn switchover|  
|  
|
|60|  
|  
|扩容时（元数据复制表数据迁移/数据重分布）时 原DN节点组故障|  
|  
|
|61|  
|  
|扩容时（元数据复制表数据迁移/数据重分布）时 原DN节点组 switchover|  
|  
|
|62|  
|  
|MN故障，启动扩容任务|  
|  
|
|63|  
|  
|在新节点组open状态且现在DDL 前执行DDL|  
|  
|
|64|  
|  
|链路配置时 OM故障|  
|  
|
|65|  
|  
|扩容时执行数据重分布|报错|  
|
|66|缩容|节点|缩容单个节点组|成功|  
|
|67|  
|  
|缩容多个节点组|  
|  
|
|68|  
|  
|缩容节点组为主备部署|  
|  
|
|69|  
|  
|缩容节点组包括MN/CN|报错|  
|
|70|  
|  
|缩容参数检查|v$election, v$archive_dest_status视图中节点信息正确|  
|
|71|  
|  
|业务背景下缩容|业务正常|  
|
|72|  
|  
|缩容时执行数据重分布|报错|  
|
|73|  
|  
|仅剩DN 组时缩容|  
|  
|
|74|  
|  
|有2DN 组缩容2DN 组|  
|  
|
|75|  
|  
|缩容CN、MN|  
|  
|
|76|  
|可靠性|缩容时主节点异常|  
|  
|
|77|  
|  
|缩容时备节点异常|  
|  
|
|78|  
|  
|缩容时OM 异常|  
|  
|
|79|  
|  
|缩容时switchover|失败|  
|
|80|  
|  
|缩容失败后再次缩容|  
|  
|
|81|  
|  
|缩容时集群停止，拉起集群后|  
|  
|


  


（1）参数验证：生成配置文件hosts_add.toml，yasdbName_add.toml

|命令|参数|测试场景|预期|
|:---|:---|---|---|
|yasboot dataspace redistribute|--dataspace-id|0、缺省|成功|
|  
|  
|1、不填、a|报错|
|  
|-c,--cluster|正确|成功|
|  
|  
|不存在|报错|
|  
|--clean-  residual-immediately|指定|  
|
|  
|  
|不指定|  
|
|  
|--chunk-id|存在chunk|成功|
|  
|  
|不存在 chunk|报错|
|  
|-target-group GROUP_ID|存在的DN group id|成功|
|  
|  
|不存在的DN group id|报错|
|  
|  
|CN/MN|报错|
|  
|  
|搬迁到同一个DN|成功，但实际不执行搬迁|
|  
|  
|搬迁到不同DN|  
|
|  
|  
|先校验节点状态|  
|


  


（2）重分布验证

|特性|测试因子|测试场景|预期|备注|
|---|---|---|---|---|
|yasboot dataspace redistribute|自动重分布|原有2个节点组每个节点组1个chunk，add 1一个节点组，执行重分布|，add报错|  
|
|  
|  
|不新增节点组时直接执行重分布，均匀分布时|成功，实际chunk不会搬迁|  
|
|  
|  
|原有1个节点组128个chunk，add 1个节点组后重分布|重分布后每个节点组64个chunk|  
|
|  
|  
|原有1个节点组128个chunk，add 2个节点组后重分布|重分布后chunk数是43和42|  
|
|  
|  
|原有32个节点组4096个chunk，remove节点组后重分布|成功，仅创建拦截128|  
|
|  
|  
|创建64个tablespace set，add 节点组后重分布|  
|  
|
|  
|  
|创建64个tablespace set，remove节点组后重分布|  
|  
|
|  
|  
|数据重分布后，备机自动同步|  
|  
|
|  
|  
|源DN组switchover 后重分布|  
|  
|
|  
|  
|目的DN组switchover 后重分布|  
|  
|
|  
|  
|重分布完成后alter tablespace set|  
|  
|
|  
|  
|重分布完成后drop tablespace set|  
|  
|
|  
|  
|重分布完成后table ddl/dml|  
|  
|
|  
|  
|有CN节点故障，ddl_queue$后未推送DDL时重分布|  
|  
|
|  
|  
|重分布迁移到同一主机|  
|  
|
|  
|  
|重分布迁移到不同主机|  
|  
|
|  
|  
|重分布完成后查看系统表/视图 dataspace-扩容/缩容后查$/route$|  
|  
|
|  
|  
|建表指定segament---分布式不支持？|  
|  
|
|  
|--clean-  residual-immediately|自动清理迁移之后残留的表空间|  
|  
|
|  
|手动重分布|  
|  
|  
|
|  
|--chunk-id|指定单个|  
|  
|
|  
|  
|指定多个，多个chunk id都存在|  
|  
|
|  
|  
|存在重复的chunk id|报错|  
|
|  
|  
|不存在chunk id|报错|  
|
|  
|--target-group|节点不存在|  
|  
|
|  
|  
|多个groupid |报错|  
|
|  
|  
|节点故障|  
|  
|
|  
|并发|重分布时DDL|拦截|  
|
|  
|  
|先DDL再执行重分布|  
|  
|
|  
|  
|重分布时DML|  
|  
|
|  
|  
|重分布时导入元数据|拦截|  
|
|  
|  
|重分布时导出元数据|  
|  
|
|  
|  
|不同会话同时执行重分布|  
|  
|
|  
|  
|不同会话同时执行重分布和cluster restart|  
|  
|
|  
|  
|重分布过程中dml+查询|不会出现不一致|  
|
|  
|可靠性|重分布任务时 MN故障|  
|  
|
|  
|  
|DN/MN/主节点故障时启动重分布|  
|  
|
|  
|  
|DN/MN/备节点故障时启动重分布|  
|  
|
|  
|  
|注册重分布任务时MN switchover|  
|  
|
|  
|  
|注册重分布任务到禁止DDL期间执行DDL|等待正在执行的DDL结束|  
|
|  
|  
|（数据迁移/刷新路由/清理表空间）时源DN组switchover|  
|  
|
|  
|  
|（数据迁移/刷新路由/清理表空间）时目的DN组switchover|  
|  
|
|  
|  
|（数据迁移/刷新路由/清理表空间）时源DN组主节点故障|  
|  
|
|  
|  
|（数据迁移/刷新路由/清理表空间）时目的DN组主节点故障|  
|  
|
|  
|  
|（数据迁移/刷新路由/清理表空间）时MN故障|  
|  
|
|  
|  
|迁移完部分chuck时故障|  
|  
|
|  
|  
|chunk的的1个datafile 迁移到一半时故障|  
|  
|
|  
|  
|重分布时 cluster stop -f|  
|  
|
|  
|  
|重分布失败后再次重分布|  
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
