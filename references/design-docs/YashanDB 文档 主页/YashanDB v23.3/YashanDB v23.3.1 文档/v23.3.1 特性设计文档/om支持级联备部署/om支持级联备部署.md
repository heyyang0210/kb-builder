Created by 瞿蓝孟, last modified by  马志宏 on 十月 28, 2024

##   [1. 总述](#1-总述)  

IR链接：    [https://pingcode.yasdb.com/ship/ideas/6683a9745d57e18ea9d3fa66](https://pingcode.yasdb.com/ship/ideas/6683a9745d57e18ea9d3fa66)    ?#YASHAN-2957  Om支持级联备部署

SR链接：    [https://pingcode.yasdb.com/pjm/items/6690918f288e197820ba894d](https://pingcode.yasdb.com/pjm/items/6690918f288e197820ba894d)    ?#YDBRD-30288 【OM】支持单机主备模式的级联备部署

###   [1.1 需求来源](#11-需求来源)  

数研所需求

###   [1.2 调研文档](#12-调研文档)  

db级联备相关文档：    [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E9%AB%98%E5%8F%AF%E7%94%A8/%E5%8D%95%E6%9C%BA%E4%B8%BB%E5%A4%87%E9%83%A8%E7%BD%B2/%E7%BA%A7%E8%81%94%E5%A4%87%E9%85%8D%E7%BD%AE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E9%AB%98%E5%8F%AF%E7%94%A8/%E5%8D%95%E6%9C%BA%E4%B8%BB%E5%A4%87%E9%83%A8%E7%BD%B2/%E7%BA%A7%E8%81%94%E5%A4%87%E9%85%8D%E7%BD%AE.html)  

###   [1.3 需求分析](#13-需求分析)  

- 支持单机在主备模式下的级联备部署；
- 一主一备和一主多备都需要支持；
- 级联备不开启HA自选主；
- 级联备不设置保护模式


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

生成配置命令新增参数--disk-found-path

```
./bin/yasboot package se gen -c yashandb --node 2 --cascaded-node 2 --cascade-parent 2
--cascaded-node  级联备节点个数，选填参数，不填默认值为0，最大值为32-备机个数
--cascaded-parent 级联备绑定备节点，选填参数，不填默认为最后一个备节点，范围[1,node-1]

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
      CGROUP_ROOT_DIR = "/sys/fs/cgroup"
      LISTEN_ADDR = "127.0.0.1:1688"
      REPLICATION_ADDR = "127.0.0.1:1689"
      RUN_LOG_FILE_PATH = "/home/wolf/anchorbase/work/log/yashandb/db-1-1/run"
      RUN_LOG_LEVEL = "DEBUG"
      SLOW_LOG_FILE_PATH = "/home/wolf/anchorbase/work/log/yashandb/db-1-1/slow"

  [[group.node]]
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 2
    cascade-parent = true
    [group.node.config]
      CGROUP_ROOT_DIR = "/sys/fs/cgroup"
      LISTEN_ADDR = "127.0.0.1:1690"
      REPLICATION_ADDR = "127.0.0.1:1691"
      RUN_LOG_FILE_PATH = "/home/wolf/anchorbase/work/log/yashandb/db-1-2/run"
      RUN_LOG_LEVEL = "DEBUG"
      SLOW_LOG_FILE_PATH = "/home/wolf/anchorbase/work/log/yashandb/db-1-2/slow"

  [[group.node]]
    data_path = "/home/wolf/anchorbase/work/data/yashandb"
    hostid = "host0001"
    role = 3  ## 新增类型，表示是级联备
    [group.node.config]
      CGROUP_ROOT_DIR = "/sys/fs/cgroup"
      LISTEN_ADDR = "127.0.0.1:1692"
      REPLICATION_ADDR = "127.0.0.1:1693"
      RUN_LOG_FILE_PATH = "/home/wolf/anchorbase/work/log/yashandb/db-1-3/run"
      RUN_LOG_LEVEL = "DEBUG"
      SLOW_LOG_FILE_PATH = "/home/wolf/anchorbase/work/log/yashandb/db-1-3/slow"


```

##   [3. 规格与约束](#3-规格与约束)  

- 考虑到一主多备的情况，级联备默认固定附属在最后一个备节点上。
- 级联备默认不开启HA自选主


##   [4. 特性](#4-特性)  

####   [4.1 db的配置文件变更](#41-db的配置文件变更)  

om的主体部署流程不变，只是级联备的配置文件（yasdb.ini）按照db要求有所变动

- 一主一备一级联备（只展示级联备特殊的配置项，与常规节点没区别的配置项不展示）
- 一主一备多级联备
- 一主多备多级联备，级联备固定绑定到第一个备节点，也就是1-2上面


```
主机
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1693 NODE_ID=1-3:3

备机：
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1689 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1693 NODE_ID=1-3:3  DISABLE_ELECTION=TRUE VALID_FOR=ALL_ROLES

级联备
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1689 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2 VALID_FOR=PRIMARY_ROLE

```

```
主机
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2

备机：
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1689 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1693 NODE_ID=1-3:3 DISABLE_ELECTION=TRUE VALID_FOR=ALL_ROLES
ARCHIVE_DEST_3=SERVICE=127.0.0.1:1695 NODE_ID=1-4:3 DISABLE_ELECTION=TRUE VALID_FOR=ALL_ROLES

级联备1
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1691 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2 VALID_FOR=PRIMARY_ROLE

级联备2
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1691 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2 VALID_FOR=PRIMARY_ROLE

```

```
主机
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1693 NODE_ID=1-3:3

备机1：
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1689 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1693 NODE_ID=1-3:3
ARCHIVE_DEST_3=SERVICE=127.0.0.1:1695 NODE_ID=1-4:4 DISABLE_ELECTION=TRUE VALID_FOR=ALL_ROLES
ARCHIVE_DEST_4=SERVICE=127.0.0.1:1697 NODE_ID=1-5:4 DISABLE_ELECTION=TRUE VALID_FOR=ALL_ROLES

备机2：
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1689 NODE_ID=1-1:1
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2

级联备1
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1689 NODE_ID=1-1:1  去掉
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2 VALID_FOR=PRIMARY_ROLE

级联备2
ARCHIVE_DEST_1=SERVICE=127.0.0.1:1689 NODE_ID=1-1:1  去掉
ARCHIVE_DEST_2=SERVICE=127.0.0.1:1691 NODE_ID=1-2:2 VALID_FOR=PRIMARY_ROLE

```

####   [4.2 db的配置文件变更](#42-db的配置文件变更)  

为了方便展示，计划在cluster status命令的展示结果中，增加一列（source node）展示级联备绑定的节点id，方便用户直接能看出节点是级联备节点，这个需要db的修改再做适配（relipcation_status视图）。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 部署一主一备一级联备
- 一主一备多级联备
- 一主多备一级联备
- 一主多备多级联备


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

## Comments:

|  [](null)  ,与会人：马志宏、瞿蓝孟、高亚宁、李世铭,会议时间：2024.08.02,会议地点：线上会议,会议纪要：,1.  级联备默认固定附属在最后一个备节点上，package se gen命令新增cascade-parent，指定绑定备机；,2.只考虑一个备机绑定级联备，多个备机绑定级联备暂不考虑，也不支持；,3.级联备的最大个数不是32，应该为32-备机个数（原因是一个节点的  ARCHIVE_DEST最多配置32个，备机的个数也会占据这个数量  ）；,4.级联备的database_role字段展示standby（cascade），新增一个source_node，展示绑定的父node-id；,5.升级前要查询db的replication_status视图，确定哪些节点是级联备；升级时退出升级模式顺序：备机-级联备-主机；,6.一主一备一级联备，不考虑仲裁；,  
,Posted by qulanmeng at 八月 02, 2024 17:00|
|---|
|  [](null)  ,级联备的database_role字段展示standby（cascade）不展示了，有source_node可以知道父节点，从而判断级联备的关系。,而且增加source_node后，太长了，显示效果不好,Posted by qulanmeng at 八月 15, 2024 15:32|
