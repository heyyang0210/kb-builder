Created by 李世铭, last modified on 六月 16, 2023

# **1、概述**

OM支持在线添加和删除备节点

设计文档：    [支持添加和删除单机数据库备节点](109591711.html)  

SR：    [YDBRD-13306](https://jira.yasdb.com/browse/YDBRD-13306?src=confmacro)    -  【OM】支持添加和删除单机数据库备节点  完成

# **2、需求分析**

## **2.1 需求描述**

- yasboot支持动态添加和删除多个单机数据库备节点


## **2.2 功能特性**

### 2.2.1 生成新增节点配置文件命令

```
$ yasboot config node gen

```

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


### 2.2.2 部署新增主机命令

```
$ yasboot host add

```

|选项|含义|
|:---|:---|
|-i,--install-pkg|软件包文件本地路径|
|-t,--toml|要安装软件包的主机相关信息的配置文件|
|-f, --force|忽略错误并强制安装，默认为false|
|--disable|屏蔽任务进度条展示|
|-c,--cluster|集群名称|


### 2.2.3 扩容命令

```
$ yasboot node add

```

|选项|含义|
|:---|:---|
|-t,--toml|扩容的节点配置文件|
|--no-primary|true：如果在集群中没有主节点，在备节点上执行build database命令；默认为false|
|-c,--cluster|集群名称|


### 2.2.4 缩容命令

```
$ yasboot node remove

```

|选项|含义|
|:---|:---|
|-c,--cluster|集群名称|
|--purge|清理节点data数据。默认为false|
|-f,--force|true：跳过删除节点的确认操作。默认为false|
|--no-primary|true：允许没有主节点。默认为false|
|--node-ids|要删除的节点信息，逗号分隔|
|--clean|true：清理所有扩容失败的节点。默认为false。--node-ids和--clean选择其中一个。|


## **2.3 特性约束**

1. 扩缩容命令无法并行。但可以一次扩容/缩容多个节点
1. 扩容失败无法在命令行界面感知


# **3、测试设计方法**

1. 功能性：参数校验、结合业务场景、修改配置文件中参数
1. 部署形态：单机（一主两备）同机部署、跨机部署、打开自选主
1. 测试环境：linux
1. 可靠性、异常：异常环境
1. 易用性：使用过程是否简单易上手，报错是否明确


# **4、详细测试设计**

## **4.1 参数验证**

|命令|参数|测试场景|
|:---|:---|:---|
|yasboot config node gen|-c, --cluster|已有集群名|
|  
|  
|不存在的集群名|
|  
|  
|不加参数|
|  
|-u, --username|填写用户名|
|  
|  
|不加参数|
|  
|-p, --password|填写密码|
|  
|  
|不加参数|
|  
|-N|加参数|
|  
|  
|不加参数|
|  
|--ip|填写单个ip|
|  
|  
|填写多个ip|
|  
|  
|全是已有主机ip|
|  
|  
|全是新主机ip|
|  
|  
|部分已有主机ip，部分新主机ip|
|  
|  
|填写不符合格式的ip|
|  
|  
|不加参数|
|  
|--port|填写正确端口|
|  
|  
|填写不符合格式的端口|
|  
|  
|不加参数|
|  
|-i, --install-path|存在的路径|
|  
|  
|不存在的路径|
|  
|  
|不加参数|
|  
|--data-path|存在的路径|
|  
|  
|不存在的路径|
|  
|  
|不加参数|
|  
|-f, --force|加参数|
|  
|  
|不加参数|
|  
|-g,--group-id|已有groupid|
|  
|  
|不存在的groupid|
|  
|--node|范围内的节点数|
|  
|  
|填写与原有备机加起来超过32的节点数|
|  
|--host-id|单个id|
|  
|  
|多个id|
|  
|  
|部分id不存在|
|yasboot host add|-i,--install-pkg|填写正确安装包路径|
|  
|  
|填写错误文件路径|
|  
|-t,--toml|填写正确配置文件|
|  
|  
|填写错误文件|
|  
|-f, --force|加参数|
|  
|  
|不加参数|
|  
|--disable|加参数|
|  
|  
|不加参数|
|  
|-c,--cluster|与  hosts_add  .toml中一致的集群名|
|  
|  
|与  hosts_add  .toml中不一致的且已有的集群名|
|  
|  
|不存在的集群名|
|yasboot node add |-t,--toml|填写正确配置文件|
|  
|  
|填写错误文件|
|  
|--no-primary|加参数|
|  
|  
|不加参数|
|  
|-c,--cluster|与  yasdbName_add  .toml中一致的集群名|
|  
|  
|与  yasdbName_add  .toml中不一致的且已有的集群名|
|  
|  
|不存在的集群名|
|yasboot node remove|-c,--cluster|已有集群名|
|  
|  
|不存在的集群名|
|  
|  
|不加参数|
|  
|--purge|加参数|
|  
|  
|不加参数|
|  
|-f,--force|加参数|
|  
|  
|不加参数|
|  
|--no-primary|加参数|
|  
|  
|不加参数|
|  
|--node-ids|填一个存在节点|
|  
|  
|填一个不存在的节点|
|  
|  
|填多个存在节点|
|  
|  
|填多个节点其中部分节点不存在|
|  
|--clean|加参数|
|  
|  
|不加参数|


## **4.2 测试场景**

  


|命令|场景|  
|
|---|---|---|
|生成配置文件|填写错误的ssh信息，是否会报错，配置文件能否生成|  
|
|  
|同时填写password和no-password，查看生效优先级|  
|
|  
|同时填写host-id和ip，查看生效优先级|  
|
|  
|force跳过检查|  
|
|部署主机|部署主机的hosts_add.toml文件格式错误|  
|
|  
|部署主机的hosts_add.toml文件ssh信息错误|  
|
|  
|hosts_add.toml文件不同机器的用户密码和端口信息改成不同的，查看是否生效|  
|
|  
|主机检查失败时，加force强制部署主机|  
|
|  
|尝试并行执行任务|  
|
|扩容|扩容的  yasdbName_add.toml文件格式错误|  
|
|  
|主节点不存在加no-primary进行扩容|  
|
|  
|主节点存在加no-primary进行扩容|  
|
|  
|主节点不存在不加no-primary进行扩容|  
|
|  
|修改配置文件中的配置参数查看是否生效|  
|
|  
|尝试并行执行任务|  
|
|  
|扩容节点特定配置参数与主节点不同需要报错|HA_ELECTION_ENABLED    
  HA_ELECTION_TIMEOUT    
  HA_HEARTBEAT_INTERVAL    
  HA_ELECTION_LEADER_LEASE_ENABLED    
  QUORUM_SYNC_STANDBYS|
|  
|扩容过程中OM故障（kill yasom和yasagent进程）|  
|
|  
|扩容多个节点，部分成功部分失败，clean失败节点后不改toml文件尝试重新扩容|  
|
|  
|扩容多个节点，部分成功部分失败，clean失败节点后修改toml文件尝试重新扩容|  
|
|缩容|主节点不存在加no-primary进行缩容|  
|
|  
|主节点存在加no-primary进行缩容|  
|
|  
|主节点不存在不加no-primary进行缩容|  
|
|  
|同时加  node-ids和clean|  
|
|  
|任务是否可以并行|  
|
|  
|最大保护模式下尝试缩容至少于两个节点|  
|
|  
|非最大保护模式下尝试缩容所有节点|  
|
|  
|尝试并行执行任务|  
|
|  
|扩容失败，加clean清除失败节点|  
|
|  
|缩容过程中OM故障（kill yasom和yasagent进程）|  
|


## Comments:

|  [](null)  ,1.并行执行扩容和缩容,2.扩缩容时进行主备切换,Posted by lishiming at 六月 16, 2023 15:42|
|---|
