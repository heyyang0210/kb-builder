Created by 黄思源, last modified on 七月 05, 2024

*详细设计-YDBRD-29502 : 分布式支持将备份集恢复到空集群*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/666bb39a5d57e18ea9d28910](https://pingcode.yasdb.com/ship/ideas/666bb39a5d57e18ea9d28910)    *?*  *  
*  *#YASHAN-2921 分布式支持通过备份集恢复新的集群*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6673fe1e288e197820aa44cf](https://pingcode.yasdb.com/pjm/items/6673fe1e288e197820aa44cf)    *?*    
  *#YDBRD-29502 在新环境上恢复备份集之前，创建分布式集群节点*

##   [1. 总述](#1-总述)  

将备份集恢复到一个空集群。

###   [1.1 需求来源](#11-需求来源)  

嘉实基金

###   [1.2 调研文档](#12-调研文档)  

  [分布式异机恢复](https://conf.yasdb.com/pages/viewpage.action?pageId=156136499)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|yasboot支持部署空集群|高级包不执行、不建库、只创建目录、配置文件|是|是|
||yasbak支持分发备份集|yasbak分发备份集|是|是|
|适配|节点扩容、组扩容|nodeid、groupid、endpoint从db中查询获得|是|是|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

只列出有变动的接口：

1.   `yasboot package de gen`    新增字段
1.     -   `--node-info`    ：指定yasrman生成的节点信息文件的路径。

1.   `yasbak deploy`    新增字段
1.     -   `-f, --force`    ：跳过对主节点的校验。

1.   `yasbak distribute`    ：新增命令，分发备份集到对应的目录下
1.     -   `-c, --cluster`    ：集群名称。
    -   `-b, --backup-set`    ：备份集路径。



##   [3. 规格与约束](#3-规格与约束)  

仅支持分布式。

##   [4. 特性](#4-特性)  

###   [4.1 流程](#41-流程)  

1. 在旧集群中执行    `list backup tag 'full_01' dstbinfo to 'dstbinfosby'`    命令，拿到一个文件dstbinfosby。
1. 执行    `package de gen`    命令，指定--node-info dstbinfosby，不需要指定--mn，--cn，--dn，yasboot从文件中获取每个节点的数量。datapath由用户通过--data-path指定，不从文件中读取。
1. 执行    `package install`    命令，拉起yasom/yasagent。（不变）
1. 执行    `cluster deploy`    命令。（不变）
1. 拷贝旧集群的catalog，打包备份集。（手动操作）
1.   `yasbak deploy`    指定    `-f`    参数（新增参数，用于跳过寻找主节点和校验权限），初始化yasbak。（指定的catalog需要和旧集群的保持一致）
1. 执行    `yasbak distribute -c minidb --backup-set backupset.tag.gz`    ，备份集的压缩包的格式内容（压缩包内容下方）。
1. 执行    `yasbak reset`    ，会生成yasbak_nodeinfo_minidb文件，将datapath加到文件中。
1. 执行    `yasbak restore clsuter`  


###   [4.2 package de gen 生成配置文件](#42-package-de-gen-生成配置文件)  

新增    `--node-info`    ：指定yasrman得到的节点信息。

生成的yashan.toml会新增：

```
cluster = "empty_minidb"
empty_cluster = true # empty_cluster为true的时候，主要用此参数标识创建空集群。node.name这些参数需要存在


[[group]]
  # 这些数据从文件中里面获取
  groupid = 1
  
  [[group.node]]
    nodeid = "1-1:1"

```

>   根据节点配置文件生成的yashan.toml，不要手动修改groupid, node.name, node.nodeid这些参数。因为集群拓扑发生变化，请重新用节点配置文件生成新的yashan.toml文件。  

###   [4.3 cluster deploy创建空集群](#43-cluster-deploy创建空集群)  

1. yasboot层查看文件内容是否有缺失。
1.     - 如果empty_cluster=true，查看yashan.toml的node.name，node.nodeId是否存在。

1. yasboot下发任务。
1.     - 父任务：DeployEmptyCluste。记录信息到om的sqlite中。
    - 给每个节点并发下发DeployEmptyNode任务。
        - 创建配置文件，目录，密码文件等。
        - 拉起节点到nomount状态。



###   [4.4 yasbak deploy 初始化yasbak](#44-yasbak-deploy-初始化yasbak)  

新增    `-f, --force`    ：跳过对主节点的校验。

因为会找主节点，看是否有v$instance或v$database的权限，这时候数据库是nomount状态，所以新增参数跳过这一步。

###   [4.5 yasbak distribute 分发备份集](#45-yasbak-distribute-分发备份集)  

备份集压缩包的格式。（现在手动打包）

- minidb.tar.gz
    - mn-1-1.tar.gz（节点类型-节点名称，格式限制，否则无法识别节点）
    - cn-2-1.tar.gz
    - dn-3-1.tar.gz


```
# mn-1-1.tar.gz内部结构如下
# 如果是增量备份，一个压缩包里面有多个备份集
$ tar -tf mn-1-1.tar.gz 
bak_2024070214170545/
bak_2024070214170550/
....

```

**yasbak distribute**

|字段|说明|
|---|---|
|-c, --cluster|集群名称|
|-b, --backup-set|备份集压缩包的路径|


流程：（同步传输，不通过任务）

yasboot->yasom：将压缩包发送到yasom给yasom。

yasom：解压。查看备份集是否齐全（MN、DN组至少有一个备份压缩包，CN每个节点都有备份压缩包）。

yasom->yasagent：将压缩包发送到节点的backup目录下，解压。

###   [4.6 yasbak reset](#46-yasbak-reset)  

生成的nodeInfoFile的原来的url改成listen_addr。

新增din_addr、replica_addr、data_path、hostname（hostname使用新节点在om所在服务器的标识，如host0001，host0002......）

```
nodeCount=15
node_id=2-1, node_type=CN, listen_addr=192.168.18.141:11688, din_addr=192.168.18.141:11688, replica_addr=192.168.18.141:11688, data_path='/data/shm/newdata/mn-1-1', hostname=host0001
node_id=1-1, node_type=MN, listen_addr=192.168.18.141:11678, din_addr=192.168.18.141:11678, replica_addr=192.168.18.141:11678, data_path='/data/shm/newdata/mn-1-2', hostname=host0002

```

###   [4.7 扩容](#47-扩容)  

  `yasboot config node gen`  

展示的nodeId从    `group_info$`    表中获取

```
select id, next_node_id from group_info$ where id = groupid

```

  `yasboot config group gen`  

展示的groupId从    `cluster_info$`    表中获取

```
select max_endpoint, next_group_id from cluster_info$

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,会议纪要：,时间：2024.07.04,与会人：张旭涛、董灵林、高亚宁、黄思源、瞿蓝孟、刘美秀、马志宏、许中立,1. package de gen 指定了--nodeinfo，但是没有指定--data-path，使用--node-info里面的data-path。
1. 处于nomount状态可以查看v$instance视图，所以–force只跳过 找主节点和v$database的报错。
1. --node-info和--mn、--cn、--dn的冲突，鉴于yasboot当前的设计限制，不实现，仍保留为--node-info优先级最高。
,Posted by huangsiyuan at 七月 04, 2024 18:55|
|---|
