Created by 瞿蓝孟, last modified on 五月 16, 2024

SR：    [https://pingcode.yasdb.com/pjm/items/661f35a3fd997db58adb1f15](https://pingcode.yasdb.com/pjm/items/661f35a3fd997db58adb1f15)    ?    
  #YDBRD-26457 【OM】yasboot支持主备集群的部署

##   [1. 总述](#1-总述)  

共享集群已经支持一主一备甚至一主多备的场景，但是om部署的共享集群还是“单机”状态，故om需要支持共享集群的主备部署功能。

可视化不在这个迭代中处理，有另外的SR跟踪：

  [https://pingcode.yasdb.com/pjm/items/661e3dc8fd997db58adabd53](https://pingcode.yasdb.com/pjm/items/661e3dc8fd997db58adabd53)    ?#YDBRD-26428 【OM】【主备集群】支持主备集群可视化安装

###   [1.1 需求来源](#11-需求来源)  

集群要求

###   [1.2 调研文档](#12-调研文档)  

  [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E9%AB%98%E5%8F%AF%E7%94%A8/%E4%B8%BB%E5%A4%87%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E4%B8%80%E4%B8%BB%E4%B8%80%E5%A4%87%E9%85%8D%E7%BD%AE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E9%AB%98%E5%8F%AF%E7%94%A8/%E4%B8%BB%E5%A4%87%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E4%B8%80%E4%B8%BB%E4%B8%80%E5%A4%87%E9%85%8D%E7%BD%AE.html)  

###   [1.3 需求分析](#13-需求分析)  

集群现在主备要求，对于yasboot现有的部署流程来说，实际是需要部署2（甚至更多）套多节点的集群，一套集群作为主集群（内部节点DATABASE_ROLE全是primary），另一套集群作为备集群（内部节点DATABASE_ROLE全是STANDBY）。

而且每一套集群，内部的节点还需要分为主-备2中角色；

综合考虑，对于om而言现在总共有4种节点类型：

1. 主集群主节点：最后部署时需要执行create database语句------等价于现有架构的集群主节点
1. 备集群主节点：最后部署时需要执行build databasee 语句------需要新增的类型
1. 主集群备节点：同4
1. 备集群备节点：3和4可以归为同一类节点，最后部署时不需要执行任何语句------等价于现有架构的集群备节点


注意：现在备集群的备节点功能db还未实现，备集群只有主节点是open状态，备节点只能保持nomount状态。

- 现在想不破坏单机和分布式的部署，所以文件的主体结构不能变动；
- 1.只修改yashandb.toml
    - 目前集群只有ce一种group_type，新增一个字段database_role（名称是从db内部抄过来的），有 PRIMARY和STANDBY 这2种类型，用来区分主集群和备集群，node的role字段用来区分集群内的主备节点；
    - 将CEDisks和YFSConfig都放入group.config中，作为共享集群特有的groupconfig，这样可以区分2个集群使用不同的配置；
    - 不用改动原有结构，单机/分布式不受影响，集群只需要额外增加对应的命令参数即可，改动较小
    - 大概效果如下：    [https://conf.yasdb.com/pages/viewpage.action?pageId=144123963](https://conf.yasdb.com/pages/viewpage.action?pageId=144123963)  


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

```
./bin/yasboot package ce gen --ip ip1,ip2 --cluster tt --data /dev/sde --vote /dev/sdc --ycr /dev/sdd --group N --node 1

```

新增“--group”参数，控制备集群的数量。

考虑到命令长度问题，命令行只能输入一套磁阵，其余备集群的磁阵地址需要手动修改配置文件。

因为备集群在om内部属于group的概念，所有组的节点数量是一样的，备集群的磁阵地址需要手动修改配置文件

##   [3. 规格与约束](#3-规格与约束)  

- 需求规格：1、支持一主多备集群的部署2、支持同构集群复制，要求主集群和备集群的节点数对等，版本相同（非对称有另外的IR，暂无SR，先不考虑）
- 3、跟单集群保持一致
- 备集群只有一个节点为open状态，其他节点都是started状态
- 考虑到命令行不能太长，共享集群的ce gen命令格式跟之前保持一致，只能输入一套共享磁阵地址，其余备集群的磁阵地址需要手动修改配置文件。
- 由于共享磁阵的环境限制，建议测试先只关注共享集群1主1备的场景，开发自验也只会保证这个场景，其他场景可能存在问题。


##   [4. 特性](#4-特性)  

部署流程：

1. 部署主集群所有节点，拉起到nomount状态。
1. 主集群的主节点，执行create database。
1. 部署备集群所有节点，拉起到nomount状态。
1. 备集群主节点执行build database。


配置文件yasdb.ini要新增配置项：

主机群：

```
REPLICATION_ADDR = 192.168.1.2:16899 #每个节点都要新增该端口，用于主备通信
ARCHIVE_DEST_1 = SERVICE=192.168.1.3:16899  #备集群的REPLICATION_ADDR

```

备集群：

```
REPLICATION_ADDR = 192.168.1.3:16899 #每个节点都要新增该端口，用于主备通信
ARCHIVE_DEST_1 = SERVICE=192.168.1.2:16899  #主集群的REPLICATION_ADDR

```

由于db的限制，备集群只有一个节点是open状态，其他的都是started状态；

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

后续有非对称复制的需求，计划增加“--asymmetric”，暂时会作为隐藏参数，备集群备节点控制为1个--额外扩展，不在该SR交付范围

  


## Comments:

|  [](null)  ,会议纪要：    
  时间：2024.05.09 17:00-18:00    
  与会人：瞿蓝孟、张彩虹、朱国旭、马志宏,1.data参数只填写一个，如果不同主机的磁阵路径不一样，需要手动修改。,2. 第二个组的nodeid从2-1开始计算。,3.  备集群备节点 database_status的unconnected改成“-” ,  
  Posted by qulanmeng at 五月 14, 2024 16:22|
|---|
