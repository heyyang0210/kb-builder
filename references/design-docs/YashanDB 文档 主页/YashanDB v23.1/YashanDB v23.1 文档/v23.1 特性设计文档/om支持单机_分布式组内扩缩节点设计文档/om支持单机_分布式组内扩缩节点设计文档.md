Created by 瞿蓝孟 on 七月 11, 2023

##   [1. Overview（概述）](#1-overview概述)  

本文描述om支持单机增删备节点，分布式DN,MN组内增删备节点的设计方案

##   [2. Features（功能特性）](#2-features功能特性)  

- om支持单机增删备节点
- om支持分布式DN,MN组内增删备节点


##   [3. Interfaces（接口）](#3-interfaces接口)  

####   [3.1 新增node-add gen命令](#31-新增node-add-gen命令)  

om首先要生成新增节点的信息，通过node-add gen命令生成新增节点的信息

- 每次只能指定一个主机，如果需要在N个主机上都增加M个节点，需要执行N次
- 需要校验新增host信息是否与已存在的host信息存在冲突，主要校验ip是否已存在
- 需要校验集群名称是否与当前集群一致。


#####   [3.1.1如果host为新增的主机，需要指定新主机的相关信息；](#311如果host为新增的主机需要指定新主机的相关信息)  

该命令会生成hosts_add.toml，yasdbName_add.toml，新增主机和节点信息

```
yasboot config node gen -c yashandb -u yashan -p password --ip 127.0.0.1 --port 22  --group-id 1 -node 1  --data-path /home/yashan/yasdb_data

```

参数：

-c,--cluster: 指定需要新增的host所在的集群名称

-u,--username 主机ssh用户名

-p,--password 主机密码

--ip 部署的ip地址

--port 主机ssh连接端口

--group-id 需要扩容的组id

--node 需要扩容的数量

--data-path 数据实例的DATA目录

hosts_add.toml示例

```
cluster = "yasdb"
[om]
hostid = "host0001"
[om.config]
LISTEN_ADDR = "192.168.6.115:1675"

[[host]]
hostid = "host0001"
user = "jenkins"
ip = "192.168.6.115"
port = 22
path = "/var/lib/jenkins/anchorbase/install"
[host.yasagent]
	[host.yasagent.config]
    	LISTEN_ADDR = "192.168.6.115:1676"

```

#####   [3.1.2如果host为已有的主机](#312如果host为已有的主机)  

该命令只会生成yasdbName_add.toml，新增节点信息

```
yasboot config node gen --hostid host0001 --group-id 1 --node 2

```

--hostid 原hosts.toml中主机的id

--group-id 需要扩容的组id

--node 扩容节点数量 默认值为1

yasdbName_add.toml示例

```
cluster = "yasdb"
[[group]]
  group_type = "mn"
  name = "mng1"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
  [[group.node]]
    data_path = "/var/lib/jenkins/anchorbase/install/data/yasdb"
    hostid = "host0001"
    role = 2
    [group.node.config]
      DIN_ADDR = "192.168.6.115:1679"
      LISTEN_ADDR = "192.168.6.115:1678"
      REPLICATION_ADDR = "192.168.6.115:1680"
      RUN_LOG_LEVEL = "DEBUG"

```

####   [3.2 新增扩容命令](#32-新增扩容命令)  

```
yasboot node add -t yasdbName_add.toml -c yasdbName --force --retry --retry—count 2 --retry—time 100

```

-t,--toml：扩容toml文件

-c,--cluster: 集群名称

-f, --force: 强制扩容，默认为false；不指定此参数时，必须要有主节点，后续build在主节点上执行；指定该参数，则主节点不存在情况下，从备节点下发build命令。

--retry: 扩容失败后自动清理环境重试，默认为false；（第一个迭代先不实现）

--retry—count: 重试次数；

--retry—time: 重试超时时间，单位为秒，超时时间未成功停止退出；

- 需要校验新增yasdbName_add.toml中节点信息与当前节点信息是否有重复
- 需要校验集群名称是否与当前集群一致。
- 校验节点数量是否超过节点组最大允许数量（目前分布式节点最大规模为3，单机节点规模最大为32）


####   [3.3 新增缩容命令](#33-新增缩容命令)  

上个版本增加的CN缩容命令格式只允许删除单节点，需要调整到跟此命令一致；

```
yasboot node remove -c yasdbName --node-ids "1-1,1-2,1-3" --purge --force

```

-c， --cluster: 指定需要缩容的集群名称

--node-ids: 指定需要缩容的节点

--purge: 清理节点data数据，默认为false

-f, --force: 强制缩容，默认为false；不指定此参数时，不允许缩容至集群最小提供服务的节点数（具体计算方式由db提供），指定此参数时，不校验，直接删除。

####   [3.4 新增清理环境命令](#34-新增清理环境命令)  

扩容失败时，才能使用；清理完成后，可以重新执行扩容命令。

```
yasboot node remove clean -c yasdbName

```

-c,--cluster  yasdb cluster name 集群名称

- 扩容失败时，才能使用：校验集群上一次扩容命令的状态，
- 一次扩容多个节点时，扩容部分成功，则只清理扩容失败的节点，扩容成功的节点保留不动；
- 清理时，走缩容的高级包，在集群中清理掉扩容节点数据，缩容的高级包需要支持容错（例如没有节点信息也要允许成功）；
- 清理完成后，可以重新执行扩容命令；


####   [3.5 任务查看能力](#35-任务查看能力)  

由于扩容命令是异步的，扩容命令过程中，用户可调用任务查询命令查看任务的执行状态

om已经具备任务查看能力

```
yasboot task watch -c yasdbName -u uuid

```

-c,--cluster  yasdb cluster name 集群名称-u,--uuid     task uuid 需要查看的任务的uuid

目前命令执行结果如下：

```
[jenkins@localhost work]$ ./bin/yasboot task watch -c tt -u fbdcf2c4fbd7de9e
 type | uuid             | name                | hostid | index | status  | return_code | progress | cost 
----------------------------------------------------------------------------------------------------------
 task | fbdcf2c4fbd7de9e | UpgradeYasdbCluster | -      | tt    | SUCCESS | 0           | 100      | -    
------+------------------+---------------------+--------+-------+---------+-------------+----------+------
task completed, status: SUCCESS


```

目前uuid的查询方法：

- 执行命令的时候命令行界面会返回当前任务的uuid
- 调用task list查询所有任务，找到你想查看的任务的uuid


```
yasboot task watch -c yasdbName -u uuid

```

-c,--cluster  yasdb cluster name 集群名称执行结果如下：

```
[jenkins@localhost work]$ ./bin/yasboot task list -c tt 
 uuid             | name                | index | hostid | status  | ret_code | progress | created_at          | cost 
----------------------------------------------------------------------------------------------------------------------
 fbdcf2c4fbd7de9e | UpgradeYasdbCluster | tt    | -      | SUCCESS | 0        | 100      | 2023-05-13 18:56:10 | -    
------------------+---------------------+-------+--------+---------+----------+----------+---------------------+------
 80f5244d7982df13 | DeployYasdbCluster  | tt    | -      | SUCCESS | 0        | 100      | 2023-05-13 18:55:49 | -    
------------------+---------------------+-------+--------+---------+----------+----------+---------------------+------


```

**目前task list命令不支持按照类型查看命令，这次sr会修改，提供-type参数，方便用户快速查看指定类型的任务**

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 扩容命令无法并行，可以一次扩缩容多个节点，但是不允许多次调用命令，每次扩缩容N个节点
- 由于扩容命令是后台执行的，故任务的成功失败只在日志有标志语句体现，命令界面无法感知


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  



###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 单机扩容流程](#521-单机扩容流程)  



1. 用户根据自身需求，新增host信息或者节点信息：yasboot node-add gen
1. 用户执行扩容命令：yasboot node add t -t yasdbName_add.toml -c yasdbName
1.     - 配置文件校验，校验失败返回失败原因：
        - 校验集群名称是否与当前集群一致。
        - 校验新增yasdbName_add.toml中节点信息与当前节点信息是否有重复
        - 校验节点数量是否超过节点组扩容上限（单机节点规模最大为32）
        - 校验是否有主节点，instance和database视图状态是否分别为open和normal
        - 检查是否有“--force参数”，有则在主节点上执行build语句；否则选一个状态符合的备节点执行

1. 创建扩容任务，目前扩容任务可分为：
    1. 部署新节点。
    1. 配置yasdb.ini，与主节点参数保持强一致。
    1. 需要保持强一致的参数：
        1. DIN_CONNECTIONS_PER_NODE
        1. HA_ELECTION_ENABLED
        1. HA_ELECTION_TIMEOUT
        1. HA_HEARTBEAT_INTERVAL
        1. QUORUM_SYNC_STANDBYS
    1. 以nomount形式拉起新节点。
    1. 直连主节点执行全量数据的build,"BUILD DATABSE TO REMOTE ('remote_address', 'remote_address1' ...)"。
    1. 直连主主节点顺序执行：
    1. 需要设置超时时间，不能无限重试，导致任务一直卡主无法完成
        1. alter system set DB_BUCKET_NAME_CONVERT="路径"
        1. alter system set REDO_FILE_NAME_CONVERT="路径"
        1. alter system set DB_FILE_NAME_CONVERT ="路径"
        1. alter system set arch_dest_n="node_n"
        1. 路径根据新增的节点按照固定的格式自动生成。
    1. 直连备节点顺序执行：执行步骤4流程
    1. 扩容任务完成。


#####   [扩容异常场景：](#扩容异常场景)  

1. 步骤4失败处理流程： 失败的原因有很多种，例如：build 过程中，主机掉线，主机服务器掉电，因为网络闪断，主机降备等原因，此类故障以下列方式统一处理。
    1. yasom 需要反馈告警给用户，让用户知道扩容异常
    1. yasom 提供任务重入的能力，当build失败后，用户执行重新执行命令（执行清理命令，然后重新执行扩容命令）。
1. 步骤5/6失败，异常分为： 主机异常（主备非预期切换（网络异常，主机掉电等））：yasom 需要通过v$election以及v$database两个视图确认当前节点组中有新主产生后，重新执行alter system set arch_dest="node_n"。 备机异常：记录异常备机后，继续往下执行，待所有节点遍历执行完成后，重新遍历未执行异常备节点，反复执行，直至执行成功。
1. om自身挂掉，拉起后继续下发任务；步骤4下发任务要检查是否有节点在build database阶段：在主节点上查询v$backup_progress，如果type是buckup，stage不是end，那就表示build database还在进行中。
1. agent进程挂掉，任务会失败，重新拉起agent进程后，需要执行清理命令后重新下发扩容命令


####   [5.2.2 单机缩容流程](#522-单机缩容流程)  



1. om 在创建缩容任务时，检验缩容命令是否包含参数--force
    1. 未指定--force 参数，需要校验当前节点组中存在的节点数。即需要校验QUORUM_SYNC_STANDBYS 参数的值
    1. 当QUORUM_SYNC_STANDBYS 为major时，缩容后的节点数不能小于多数派节点
    1. 当QUORUM_SYNC_STANDBYS为具体的值时，缩容后的节点数不能小于QUORUM_SYNC_STANDBYS的值
    1. 指定了--force 参数后，不校验直接按用户指定的节点数删除。
1. 工具（om）直连主节点，顺序执行一下步骤
    1. 执行：alter system set arch_dest_n="node_n"语句，将某一备机同步至最新数据，防止删除的备机是最新日志的备机，导致事务提交卡住。处理相关的HA参数，删除链路，将选举层将该节点删除。
    1. alter system set DB_BUCKET_NAME_CONVERT="路径"
    1. alter system set REDO_FILE_NAME_CONVERT="路径"
    1. alter system set DB_FILE_NAME_CONVERT ="路径"
1. 工具（om）直连其他备机，重复步骤2。
1. 工具将节点停止，工具清理数据目录。（--purge参数，未指定时不停止节点，清理数据目录）
1. 工具层通过查询视图（v$archive_dest_status）来判断节点是否已剔除当前集群。
1. 缩容任务完成


#####   [缩容异常场景：](#缩容异常场景)  

1. 执行步骤1时，组内无主节点（主机异常掉线，组内非预期的主备切换）。
1.     - yasom 需要通过视图判断新的主节点出现后，重新执行。

1. 备机异常（网络异常，备机掉线等）
1.     - yasom 在步骤1过程中，需要跳过异常备机，并记录异常节点，待正常节点执行完成后，再遍历异常节点继续执行，直到执行成功。



####   [5.2.3 分布式扩容流程](#523-分布式扩容流程)  



1. 扩容前准备 用户需要根据自身需求判断是否需要新增host信息，若需要新增host信息需要执行根据实际的信息配置host.toml并执行新增host命令：yasboot config node gen
1. 用户通过yasboot 执行扩容命令：yasboot node add -t yasdbName.toml -c yasdbName
    1. 工具层在下发扩容任务前需要做配置信息校验：
    1.         - 校验集群名称是否与当前集群一致。
        - 校验新增yasdbName_add.toml中节点信息与当前节点信息是否有重复
        - 校验节点数量是否超过节点组扩容上限（分布式节点规模最大为3）
        - 校验是否有主节点，MN组是否有主节点，主节点instance和database视图状态是否分别为open和normal

    1. 校验失败时，需要将具体的错误信息返回到客户端给用户，以方便用户矫正配置信息。
1. 工具层（om）连接至主mn创建节点元数据，并生成节点启动需要的yasdb.ini文件。
1.     - dbms_cm.create_node(node_id,endpoint,groupId,groupType,'localhost','data path','service address','replica address','data address'), 其中node_Id,endpoint 为出参;

1. 工具层（om）以nomount 模式拉起扩容的节点。
1. 客户端返回创建扩容任务成功。
1. 工具层直接节点组主机执行： BUILD DATABSE TO REMOTE ('node1_address', 'node2_address1' ...)
1. 任务完成（可通过task watch命令查看扩容命令是否完成）。


####   [5.2.4 分布式缩容流程](#524-分布式缩容流程)  



1. 工具直连主MN调用删除节点高级包接口前需要校验信息：
    1. om 在创建缩容任务时，检验缩容命令是否包含参数--force
    1. 未指定--force 参数，需要校验当前节点组中存在的节点数。即需要校验QUORUM_SYNC_STANDBYS 参数的值
    1. 当QUORUM_SYNC_STANDBYS 为major时，缩容后的节点数不能小于多数派节点
    1. 当QUORUM_SYNC_STANDBYS为具体的值时，缩容后的节点数不能小于QUORUM_SYNC_STANDBYS的值
    1. 指定了--force 参数后，不校验直接按用户指定的节点数删除。
1. 工具层（om）调用删除高级包接口，高级包接口调用成功后，返回成功。
1. 任务完成。


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

1. SR：单机支持自选举增删备机：
    1. AR：OM支持单机扩缩容（3人/周）
    1. 联调自测（1人周）
1. SR：分布式DN组支持增删节点：
    1. AR：OM支持分布式增删流程（2/人周）
    1. 联调与自测 （1人/周）


##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[扩缩容.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2Q4OTcwYzJhZjRmNTFmZDQyIiwicmVmX2lkIjoiNjczOTZhM2Q1OTNmOTljOWZmMjM1N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTAzLCJleHAiOjE3ODIyOTg1MDN9.3RrVNnKi-EKoT5JhdYxw8HpUJvclgKhml6C5BWxrtAE)

 (image/png)    


[分布式增加备机组内节点扩缩容.drawio (2).svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2RhMWFkOWEzMzExZGM3YmI4IiwicmVmX2lkIjoiNjczOTZhM2Q1OTNmOTljOWZmMjM1N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTAzLCJleHAiOjE3ODIyOTg1MDN9.fKL6WznN9tB7tj5MZOyje3sqr-803Wi_s_296__0usw)

 (image/svg+xml)    


[分布式删除备机组内节点扩缩容.drawio (2).svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2RhMWFkOWEzMzExZGM3YmI5IiwicmVmX2lkIjoiNjczOTZhM2Q1OTNmOTljOWZmMjM1N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTAzLCJleHAiOjE3ODIyOTg1MDN9.G99Grl0BaZNo-yrAvVVu3nzgc4d13TKSfWKFR7CyMuE)

 (image/svg+xml)    


[单机删除备机组内节点扩缩容.drawio (2).svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2VhMWFkOWEzMzExZGM3YmJhIiwicmVmX2lkIjoiNjczOTZhM2Q1OTNmOTljOWZmMjM1N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTAzLCJleHAiOjE3ODIyOTg1MDN9.NOSW2Z1Pf5os5DJbUWNCr8TR0BhIm-Mb9B-355B8RHo)

 (image/svg+xml)    


[单机增加备机组内节点扩缩容.drawio (2).svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2U4OTcwYzJhZjRmNTFmZDQzIiwicmVmX2lkIjoiNjczOTZhM2Q1OTNmOTljOWZmMjM1N2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTAzLCJleHAiOjE3ODIyOTg1MDN9.kgxs_PephJzFFVtN9jkbWdr01XKuvszNjTqAkZdZu4E)

 (image/svg+xml)    
