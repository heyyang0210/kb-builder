Created by 瞿蓝孟, last modified on 八月 14, 2024

##   [1. 总述](#1-总述)  

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7485009f91eb87f2c216](https://pingcode.yasdb.com/ship/ideas/660b7485009f91eb87f2c216)    *?#YASHAN-1802 主备支持部分节点之间的自选主*

SR链接：    [https://pingcode.yasdb.com/pjm/items/668e6050288e197820b9947e](https://pingcode.yasdb.com/pjm/items/668e6050288e197820b9947e)    ?#YDBRD-30226 OM支持部分节点开启自选主

###   [1.1 需求来源](#11-需求来源)  

数研所需求，客户需要在北京部署一个3节点raft主备，然后在苏州部署3个备库，北京的主库异步发送redo给苏州的备库，但是苏州的备库不参与自动选举，不参与quorum接收redo

###   [1.2 调研文档](#12-调研文档)  

概要设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=159428829](https://conf.yasdb.com/pages/viewpage.action?pageId=159428829)  

db设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=159428833](https://conf.yasdb.com/pages/viewpage.action?pageId=159428833)  

###   [1.3 需求分析](#13-需求分析)  

- om部署时，新增参数控制，指定部分节点不参与自选主；
- 支持部署后，单独开关自选主的命令；
- 升级命令适配


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

####   [生成配置命令新增参数](#生成配置命令新增参数)  

####   [--group](#--group)  

####   [--standby-node](#--standby-node)  

```
./bin/yasboot package se gen -c yashandb --node 3 --group 2 --standby-node 3
--group,--standby-node 不能与--cascade-parent，cascade-node同时使用
--group 默认为1，最大为2，第二个group全为备节点，除去1号节点外，其他为级联备，group2不参与自选主
--standby-node 控制备group里面的节点数量，不指定默认跟node保持一致，group为1或不填写时，指定该参数保存

```

其他命令参数不变

部署配置文件变动：

```
cluster = "yashandb"
create_simple_schema = false
uuid = "66ab3227bf48248378abb8789e2d1274"
yas_type = "SE"

[[group]]
  database_role = "primary"
  group_type = "db"
  name = "dbg1"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
    REDO_FILE_NUM = 4
    REDO_FILE_SIZE = "128M"

[[group]]
  database_role = "primary"
  group_type = "db"
  name = "dbg1"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
    REDO_FILE_NUM = 4
    REDO_FILE_SIZE = "128M"

  [[group.node]]
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 1
    [group.node.config]

  [[group.node]]
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 2
    [group.node.config]
    
  [[group.node]]
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 2
    [group.node.config]
    
[[group]]
  database_role = "primary"
  group_type = "db"
  name = "dbg2"
  [group.config]
    CHARACTER_SET = "utf8"
    ISARCHIVELOG = true
    REDO_FILE_NUM = 4
    REDO_FILE_SIZE = "128M"
    
  [[group.node]]
    cascade-parent = true
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 2
    [group.node.config]

  [[group.node]]
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 3
    [group.node.config]
    
  [[group.node]]
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 3 
    [group.node.config]


```

####   [单独开关自选主命令](#单独开关自选主命令)  

auto_election disable/-c yashandb --group 2

```
./bin/yasboot group auto_election disable  -c yashandb --group-id

```

- 只支持单机，分布式
- group-id找不到报错
- 不做其他校验，只下发sql到db，db处理


```
sql格式：ALTER SYSTEM SET HA_ELECTION_ENABLED=TRUE/FASLE,scope=both;

```

关闭先备后主开启先主后备

##   [3. 规格与约束](#3-规格与约束)  

- 分布式和集群不支持。
- 配置项中，不参与选举的所有节点都必须保持一致。
- 本节点不参与自选举，HA_ELECTION_ENABLED 必须设置为FALSE。
- 不考虑一主一备多级联备仲裁的情况
- 2个group的节点数量相加不能超过33


##   [4. 特性](#4-特性)  

####   [4.1 db的配置文件变更](#41-db的配置文件变更)  

om的主体部署流程不变，只是新增了一个group，第二个group全为备节点，除去1号节点外，其他为级联备，group2不参与自选主

配置文件（yasdb.ini）按照db要求有所变动

- 一主3备2级联备（北京3节点123，苏州3节点456）
- group1有3个节点（北京，1主2备），group有3节点（苏州，1备2级联备）
- 234是一级备节点，56是级联备
- 23与1默认配置好级联备相关的配置信息，当1变成备节点后，23自动切换成级联备
- 56是4的级联备
- 与普通主备不同的点在于：
- 23与4不包含同为一级备节点的相关ARCHIVE_DEST_信息，这点需要注意。


```
group 1
节点1：HA_ELECTION_ENABLED=TRUE，           
ARCHIVE_DEST_2=node2， DISABLE_ELECTION=FALSE，VALID_FOR=ALL_ROLES                       
ARCHIVE_DEST_3=node3， DISABLE_ELECTION=FALSE，VALID_FOR=ALL_ROLES    
ARCHIVE_DEST_4=node4， DISABLE_ELECTION=TRUE,  VALID_FOR=PRIMARY_ROLE

节点2：HA_ELECTION_ENABLED=TRUE，
ARCHIVE_DEST_1=node1， DISABLE_ELECTION=FALSE，VALID_FOR=PRIMARY_ROLE               
ARCHIVE_DEST_3=node3， DISABLE_ELECTION=FALSE，VALID_FOR=PRIMARY_ROLE           
ARCHIVE_DEST_4=node4， DISABLE_ELECTION=TRUE，VALID_FOR=PRIMARY_ROLE

节点3：HA_ELECTION_ENABLED=TRUE，           
ARCHIVE_DEST_2=node2， DISABLE_ELECTION=FALSE，VALID_FOR=PRIMARY_ROLE               
ARCHIVE_DEST_1=node1， DISABLE_ELECTION=FALSE， VALID_FOR=PRIMARY_ROLE            
ARCHIVE_DEST_4=node4， DISABLE_ELECTION=TRUE，VALID_FOR=PRIMARY_ROLE


group 2
节点4：HA_ELECTION_ENABLED=FALSE，           
ARCHIVE_DEST_5=node5， VALID_FOR=ALL_ROLES                   
ARCHIVE_DEST_6=node6,   VALID_FOR=ALL_ROLES 
ARCHIVE_DEST_1=node1， DISABLE_ELECTION=TRUE，     VALID_FOR=PRIMARY_ROLE 

节点5：HA_ELECTION_ENABLED=FALSE，         
ARCHIVE_DEST_4=node4， VALID_FOR=PRIMARY_ROLE ，     
ARCHIVE_DEST_6=node6，VALID_FOR=PRIMARY_ROLE，     
ARCHIVE_DEST_1=node1， DISABLE_ELECTION=TRUE，VALID_FOR=PRIMARY_ROLE         

节点6：HA_ELECTION_ENABLED=FALSE，         
ARCHIVE_DEST_4=node4， VALID_FOR=PRIMARY_ROLE ，     
ARCHIVE_DEST_5=node5，VALID_FOR=PRIMARY_ROLE，     
ARCHIVE_DEST_1=node1， DISABLE_ELECTION=TRUE，VALID_FOR=PRIMARY_ROLE

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 3-3（2个group的节点个数）部署，示例的结构
- 4-3结构部署
- 3-4


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

## Comments:

|  [](null)  ,与会人：马志宏、瞿蓝孟、施新华、张旭涛,会议时间：2024.08.14 10：00,会议地点：线上会议,会议纪要：,1.使用新命令group   auto_election disable/-c yashandb --group 2  ；,2.单机/分布式的toml文件去掉  database_role字段  ；,3.扩容，对group1（具有primary节点）扩容不拦截，走原来扩容逻辑；,4.缩容无法缩容第一个节点；,5.后续DFX考虑OM新增空节点的需求,  
,Posted by qulanmeng at 八月 20, 2024 09:23|
|---|
|  [](null)  ,规格变更：,1.group1的23与1节点不能生成级联备相关配置，1-1的  VALID_FOR配置去掉；,2.对group进行开启自选主时，检查v$archive_dest视图，除开其他group的节点，同一group内节点的VALID_FOR不能为ALL_ROLSE,有该配置不允许修改HA,Posted by qulanmeng at 八月 21, 2024 10:24|
