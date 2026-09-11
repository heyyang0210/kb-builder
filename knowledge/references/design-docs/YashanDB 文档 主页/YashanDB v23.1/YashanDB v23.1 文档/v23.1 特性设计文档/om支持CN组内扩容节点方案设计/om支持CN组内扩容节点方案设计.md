Created by 瞿蓝孟, last modified on 七月 18, 2023

##   [1. Overview（概述）](#1-overview概述)  

本文描述om支持CN组增加节点；（CN删除节点的功能之前已实现）

##   [2. Features（功能特性）](#2-features功能特性)  

- om支持分布式CN组增加节点


##   [3. Interfaces（接口）](#3-interfaces接口)  

相关命令均已在其他SR中实现，不需要新增命令

####   [3.1 主机相关](#31-主机相关)  

#####   [3.1.1如果host为新增的主机](#311如果host为新增的主机)  

该命令会生成hosts_add.toml，生成yasdbName_add.toml，新增主机和节点信息；如果文件已经存在，会被覆盖

```
yasboot config node gen -c yashandb -u yashan -p password --ip 127.0.0.1 --port 22 --node 2

```

参数：

|选项|含义|
|---|---|
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


hosts_add.toml示例

```
cluster = "tt"
secret_key = "5457c544ee7da671"
[om]
hostid = "host0001"
[om.config]
LISTEN_ADDR = "192.168.0.1:1675"

[[host]]
hostid = "host0001"
user = "jenkins"
ip = "192.168.0.1"
port = 22
path = "/var/lib/jenkins/anchorbase/install"
[host.yasagent]
	[host.yasagent.config]
    	LISTEN_ADDR = "192.168.0.1:1676"

```

#####   [3.1.2 如果host为已有的主机](#312-如果host为已有的主机)  

```
yasboot config node gen --host-id host0001,host0002 --group-id 1 --node 2 --cluster yashandb

```

|--host-id|主机的id，允许多个主机|
|---|---|
|--group-id|组id。默认为1|
|--node|新增的总节点数。默认为1|
|--cluster|集群名称|


#####   [3.1.3 部署主机](#313-部署主机)  

```
yasboot host add --install-pkg yashandb-22.2.0.9-linux-x86_64.tar.gz -t hosts_add.toml

```

|选项|含义|
|---|---|
|--disable|屏蔽任务进度条展示|
|-c,--cluster|集群名称|
|-f, --force|忽略错误并强制安装，默认为false|
|-i,--install-pkg|软件包文件本地路径|
|-t,--toml|要安装软件包的主机相关信息的配置文件|


####   [3.2 扩容命令](#32-扩容命令)  

```
 yasboot node add --toml yasdbName_add.toml --cluster yashandb

```

|选项|含义|
|---|---|
|-t,--toml|扩容的节点配置文件|
|-c,--cluster|集群名称|


##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 扩容命令无法并行，可以一次扩缩容多个节点，但是不允许多次调用命令，每次扩缩容N个节点
- 由于扩容命令是后台执行的，故任务的成功失败只在日志有标志语句体现，命令界面无法感知
- 扩容命令过程中，用户可调用任务查询命令查看任务的执行状态


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a3da1ad9a3311dc7bb7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxMzcsImV4cCI6MTc4MjIyMjkzN30.doKaDTHn5guS4bO9zltxSqXi2eAnhTd6ucZRx1PL5bI)

1. 新增hosts_add.toml和yasdbName_add.toml文件
1. 如果有新增主机，执行    `yasboot host add`    命令
1. 执行扩容命令：    `yasboot node add`  
1.     - 校验是否允许扩容（复用DN扩容的检查逻辑）
        - 上一次任务是否成功，组的节点中是否有”ScaleFailed“的节点，如果存在，返回”are you sure clean？“，return
        - sqlite中这个组的的任一节点的状态switching||scaling，return
        - 组内节点是否都处于正常可用状态（v$instace中status=open，v$database中status=normal），如果不是，return
        - 扩容的节点数是否达到上限，如果原有+新增>max，return
        - 校验yasdbName_add.toml文件，如果与现有的有冲突，return（清理完成后再次扩容是同样的操作，默认清理是只清理失败的节点，用户需要自己删除yasdb_add.toml文件中成功的节点，然后再次扩容，不然会有节点信息冲突）
        - 比较需要保持强一致的参数，配置在node.Config中强一致参数如果和主节点不一致，return
            - DIN_CONNECTIONS_PER_NODE
            - HA_ELECTION_ENABLED
            - HA_ELECTION_TIMEOUT
            - HA_HEARTBEAT_INTERVAL
            - HA_ELECTION_LEADER_LEASE_ENABLED
            - QUORUM_SYNC_STANDBYS

1. 创建扩容任务高级包（db的task）
1. 启动扩容任务高级包（db的task）


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments: