Created by 陈晓晴, last modified on 四月 28, 2023

JIRA：     [[YDBRD-8342] TAC支持nologging load - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-8342)  

###   [Nologging优化](#nologging优化)  

##   [1. Overview（概述）](#1-overview概述)  

在批量数据操作场景下，可以通过nologging的方式来提高效率，降低系统IO负载。但是nologging存在两个明显的问题：

1. 宕机之后无法从 redo恢复数据，存在数据丢失的风险
1. 主备之间无法同步


因此nologging的主要应用场景为数据迁移，原因如下：

1. 有原始的数据集，即使极端情况下，数据库意外宕机，也不存在数据丢失的风向
1. 如果是备份部署形态，数据迁移通常是先进行主机数据导入，然后再build备机，这样效率最高


本次主要针对以下场景进行nologging的优化：

1. tac表的batch insert以及列索引的insert
1. create/rebuild columnar index


需要注释的是，nologging并不是完全不产生redo，而是会减少redo的产生量。

导入流程

1. 通过alter table将表的属性设置为nologging
1. 通过导入工具进行批量导入
1. 通过create index nologging建立索引
1. 通过alter table将表的属性置为logging
1. 4.1 若在alter table logging前数据库宕机，重启后需要truncate对应表


##   [2. Features（功能特性）](#2-features功能特性)  

####   [2.1 指定TAC表的logging模式](#21-指定tac表的logging模式)  

（1） 可支持在建表时指定表的logging属性为nologging。

（2）可以通过alter table命令进行修改。 将表的logging属性修改为nologging之后，对表的插入将忽略大多数redo。

####   [2.2 指定create的logging模式](#22-指定create的logging模式)  

列索引的创建指定nologging选项之后，索引创建过程中只产生少量的redo。

####   [2.3 宕机处理](#23-宕机处理)  

在宕机重启后后所有nologging的表会被标记为corrupted

##   [3. Interfaces（接口）](#3-interfaces接口)  

####   [3.1 设置表的logging属性](#31-设置表的logging属性)  

表创建之后默认为logging

```
alter table test nologging;
alter table test logging;

```

####   [3.2 查看表的loggging属性](#32-查看表的loggging属性)  

```
select logging from user_tables where table_name = 'TEST';

```

也可查看TAB$系统表的FLAGS字段。

####   [3.3  设置create/rebuild index logging选项](#33--设置createrebuild-index-logging选项)  

默认为logging

```
create index idx on test(a) nologging;

```

实际上现在index的logging实现是跟表保持一致的，IDX$上的flags标记的logging属性并未生效。

##   [4.Limitations（功能限制）](#4limitations功能限制)  

- 只用于数据迁移场景，不主备同步，需要后建备机
- nologging只对batchinsert生效
- nologging操作完成之后，需要执行一次全量checkpoint，才能保证数据持久性，否则宕机之后存在数据丢失的风险
- 如果checkpoint执行完之前宕机，重启之后数据可能丢失。因此对于插入要truncate table并重新导入，对于create index要进行重建。
- 在checkpoint之后要将table的表重新设为logging，一切标记为nologging的表都是存在数据丢失可能性的表, 重启后表都会标记为corrupted。
- nologging状态下的表只允许进行插入和查询的操作，其他dml操作不允许; 可以进行ddl操作。
- 对于存在备机的场景，无法修改表的nologging属性。
- 如果一个事务失败了，该事务内做过插入操作的nologging表都会被标记为corrupted。tac表nologging的相关限制：
- tac表在nologging状态下，不允许删除主键约束；不允许modify column。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1.对于管理资源的页面，应当都需要记录undo和redo。

2.对于一个页面，要保证changeNum连续，因此该页面的所有修改要么全部不记录redo，要么全部都需要记录。

3.在一个原子操作中若既有需要logging的页面修改，也有需要nologging的页面修改，在需要logging的页面前需要进行清理redo，修改页面后重新保存redo的记录位置， 保证需要logging的页面的redo记录被保存。

###   [tac需要logging的页面：](#tac需要logging的页面)  

segment的首页，以及segment中的管理页面extent_map，相关页面的redo和undo的记录都需要保留。以及swf对于segment的管理页面：SwfBidRootMapBlock、SwfBidMapBlock，需要记录页面的undo和redo；swf的元数据管理页面也有部分需要记录redo，

为SwfEntryBlock、SwfColEntryBlock。

相关页面：BLOCK_SWF_SEG_HEAD、BLOCK_SEG_EXTMAP

###   [字典需要logging的页面：](#字典需要logging的页面)  

segemnt的首页，以及segment中的管理页面extent_map，相关页面的redo和undo的记录都需要保留。

相关页面：BLOCK_EDS_SEG_HEAD、BLOCK_SEG_EXTMAP

###   [列索引需要logging的页面：](#列索引需要logging的页面)  

与tac使用swf一致，对于segment上的管理相关的页面都需要记录redo和undo。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. tac表nologging后，导入数据，执行logging，关库后重启进行相应的dml。
1. tac表含字典列nologging后，导入数据，执行logging，关库后重启进行相应的dml。
1. heap表使用列索引，nologging后，导入数据，执行logging，关库后重启进行相应的dml。
1. 1-3的用例在导入过程中宕机，重启后数据库能否正常运行。相应表的corrupted是否标记。
1. nologging相关限制的验证。


##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

##   [9. 参考](#9-参考)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=91774551](https://conf.yasdb.com/pages/viewpage.action?pageId=91774551)  