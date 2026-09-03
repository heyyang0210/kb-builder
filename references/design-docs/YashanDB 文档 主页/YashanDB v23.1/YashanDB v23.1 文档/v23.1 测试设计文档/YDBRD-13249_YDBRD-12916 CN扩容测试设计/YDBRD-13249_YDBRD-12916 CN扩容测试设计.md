Created by 刘美秀 on 十月 31, 2023

# **1 概述**

本文档主要是在分布式场景下，提供在线CN扩容能力

设计文档：    [分布式CN扩容设计 - 廖增康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119544064)         [om支持CN组内扩容节点方案设计 - 瞿蓝孟 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119552900)  

SR：       [YDBRD-13249](https://jira.yasdb.com/browse/YDBRD-13249?src=confmacro)    -  【OM】支持分布式数据库CN组扩容操作  完成    [YDBRD-12916](https://jira.yasdb.com/browse/YDBRD-12916?src=confmacro)    -  CN支持在线扩容  完成

# **2. 需求分析**

## **2.1 功能特性**

- 生成配置：  yasboot config node gen
- 部署新增主机：yasboot host add
- 扩容CN节点：  yasboot node add


### 2.1.1 生成新增节点配置文件命令

```
<span class="hljs-meta" style="color: rgb(31,113,153);">$</span><span class="bash"> yasboot config node gen -c yashandb -u yashan -p password --ip 127.0.0.1 --port 22 --num 2</span>
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
|--node|新增的总节点数。默认为1, CN部署最多3个，扩容约束最多？|
|--host-id|主机的id，允许多个主机|


### DN组间/CN 扩容约束待定？

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
|*--no-primary*|是否允许在没有主节点的情况执行操作，默认为false（CN不允许，不生效）|


## **2.2 特性约束**

1. 扩容CN期间禁止执行分布式DDL.
1. 新扩容CN节点扩容期间禁止执行DML.
1. 元数据迁移最大SQL语句长度不能超过2M长度。
1. 扩容命令无法并行，可以一次扩缩容多个节点，但是不允许多次调用命令，每次扩缩容N个节点
1. 由于扩容命令是后台执行的，故任务的成功失败只在日志有标志语句体现，命令界面无法感知
1. 扩容命令过程中，用户可调用任务查询命令查看任务的执行状态


# **3 测试设计方法**

### 3.1 特性关联领域分析：

- 功能性：  参数校验、结合业务场景、修改配置文件中参数


- 部署形态：分布式部署
- 可靠性、异常：扩容过程中异常，可自动回滚
- 易用性：是否简单易上手，报错是否明确、可查看任务进度


### 3.2 测试设计：

采用等价类、边界值、场景法测试方法

本次测试设计主要采用场景法以及边界值、等价类方法验证功能性、可靠性、并发

设计视图：v$task_info，v$cm_node_info

元数据对象覆盖：TABLESPACE、TABLESPACE SET、TABLE、INDEX、ACCESS CONSTRAINT、VIEW、AUDIT POLICY、USER、ROLE、COMMENT、OUTLIKE、SQLMAP

# **4 详细测试设计**

测试设计如下：

执行报错的，需要观察错误提示是否简洁明确，明确是指能够有效指导用户操作

（1）参数验证：生成配置文件hosts_add.toml，yasdbName_add.toml

|  
|命令|参数|场景|预期|备注|
|:---|:---|:---|---|---|---|
|1|yasboot config gen|--ip|填写单个ip、填写多个ip|成功|  
|
|2|  
|  
|全是已有主机ip|报错|  
|
|3|  
|  
|全是新主机ip|成功|仅指定ip时会生成  hosts_add.toml,仅指定host-id时不会生成  hosts_add.toml|
|4|  
|  
|部分已有主机ip，部分新主机ip|不能同时指定新机和旧机，报错ip已存在，且不能同时指定host-id和ip|  
|
|5|  
|-g,--group-id|已有groupid|成功|  
|
|6|  
|  
|不存在的groupid|报错|  
|
|7|  
|  
|指定多个groupid|报错|  
|
|8|  
|--node|范围内的节点数|成功|分布式节点最大规格3|
|9|  
|  
|节点数>3|报错|  
|
|10|  
|--host-id|单个id已存在，|成功|  
|
|11|  
|  
|多个已存在id|成功|  
|
|12|  
|  
|部分id不存在|报错|  
|
|13|yasboot host add|-i,--install-pkg|填写正确安装包路径|成功|  
|
|14|  
|-c,--cluster|与  hosts_add  .toml中一致的集群名|成功|  
|
|15|yasboot node add|-t,--toml|填写正确配置文件|  
|  
|
|16|yasboot node remove|--clean|加参数、不加参数|  
|  
|


  


|  
|测试因子|场景|预期|
|---|---|---|---|
|1|扩容|一次扩容一个节点|成功|
|2|  
|一次扩容多个节点|  
|
|3|  
|扩容，缩容且清除数据，再次扩容|成功|
|4|  
|扩容，缩容且不清除数据，再次扩容|  
|
|5|  
|多次扩容，最大扩容至8个|  
|
|6|  
|扩容节点在原有主机|  
|
|7|  
|扩容节点在新主机|  
|
|8|  
|扩容失败后可再次扩容|  
|
|9|  
|MN主节点为非open状态时扩容，检查MN主节点/CN，是否检查备节点--主备不同步怎么处理？|报错|
|10|  
|扩容成功后/期间yasboot cluster status 查看状态|有新增节点信息|
|11|  
|扩容成功后yasboot 重启节点|  
|
|12|  
|扩容成后查看视图：系统表：sys.node_info$；视图：v$cm_node_info、dv$node|有新增的扩容的节点信息|
|13|  
|上一次任务失败后不允许扩容|  
|
|14|  
|上一次扩容任务失败后clean后可再次扩容  stop/normal/abnormal/noumout|open/normal 成功|
|15|  
|原有CN 节点处于不同状态时扩容：|open/normal 成功|
|16|  
|新增扩容节点能被monitor看护|  
|
|17|cluster_add.toml|yas_type改为SE|  
|
|18|  
|yas_type改为CE|  
|
|19|  
|data_path 为不存在路径|  
|
|20|  
|hostid 为不存在hostid|  
|
|21|  
|_ADDR 地址有误|  
|
|22|  
|端口被占用|  
|
|23|  
|role 全改为1|不影响|
|24|  
|role 全改为2|不影响----去掉|
|25|并行|先其他CN DDL，再执行扩容|扩容DDL_LOCK_TIMOUT超时报错|
|26|  
|扩容期间 其他CN执行DDL|禁止执行DDL，DDL报错|
|27|  
|扩容期间其他CN 执行DML|不影响|
|28|  
|扩容期间新增CN执行DDL|  
|
|29|  
|扩容期间新增CN执行DML|禁止执行DML|
|30|  
|扩容时其他 CN导入元数据|待确认|
|31|  
|扩容时导入业务数据|其他不影响|
|32|  
|扩容时恢复备份|报错，,备份和扩容/启停 不能同时执行|
|33|  
|扩容时扩容同一CN|  
|
|34|  
|扩容时扩容不同CN|  
|
|35|  
|node 扩容不同节点组 |  
|
|36|  
|group 和node 同时扩容|报错|
|37|可靠性|扩容时(MN导出元数据/元数据迁移/)  MN 主节点故障|  
|
|38|  
|扩容(MN导出元数据/元数据迁移/)时DN节点故障|扩容成功|
|39|  
|扩容前原有CN故障，ddl_queue$有记录|扩容失败|
|40|  
|扩容时原有CN故障，ddl_queue$无记录|扩容失败|
|41|  
|扩容时新增CN 故障|  
|
|42|  
|扩容时(MN导出元数据/元数据迁移/) MN switchover|失败|
|43|  
|OM拉起新增节点失败|  
|
|44|  
|OM故障|  
|
|45|  
|agent故障|  
|
|46|  
|failpoint |  
|


（2）  专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


# **5 测试用例**

  


# **6 测试框架设计**

本次测试采用codbase_test测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **7 测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|1MN,2CN,3DNGroup|
