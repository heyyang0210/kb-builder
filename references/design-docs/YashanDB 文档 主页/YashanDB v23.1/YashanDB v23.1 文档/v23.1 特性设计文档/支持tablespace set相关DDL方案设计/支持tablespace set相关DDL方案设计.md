Created by 何阳, last modified on 五月 08, 2023

#   [YDBRD-12994 支持tablespace set相关DDL Design（支持tablespace set相关DDL方案设计）](#ydbrd-12994-支持tablespace-set相关ddl-design支持tablespace-set相关ddl方案设计)  

JIRA：    [https://jira.yasdb.com/browse/YDBRD-12994](https://jira.yasdb.com/browse/YDBRD-12994)  

##   [1. Overview（概述）](#1-overview概述)  

​	为了支持扩容，需要支持tablespace set的相关语法

##   [2. Features（功能特性）](#2-features功能特性)  

*说明本方案的功能特性。*

##   [3. Interfaces（接口）](#3-interfaces接口)  

对外的sql语句

```
--- 创建tablespace set
CREATE TABLESPACE SET tablespace_set_name ON dataspace_name [MAXSIZE size_clause] [NEXT size_clause] [SIZE size_clause].

--- alter tablespace set
ALTER TABLESPACE SET tablespace_set_name (MAXSIZE size_clause | NEXT size_clause | RESIZE size_clause)


--- 删除tablespace set
DROP TABLESPACE SET tablespace_set_name.

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 不支持级联删除
1. tablespace set中的contents不为空时，不允许drop
1. 支持maxsize大小为xxx
1. 支持resize规格为
1. 隶属于tablespace set的tablespace不能单独执行atler/drop操作


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

参考：    [https://conf.yasdb.com/pages/viewpage.action?pageId=91771381](https://conf.yasdb.com/pages/viewpage.action?pageId=91771381)  

​	DDL的执行都是现在MN上先执行，然后再到本CN，DN预执行，然后再到MN提交，之后再到DN，和本CN提交，最后到MN上执行delay clean清理相关执行锁资源。

​	tablespace和tablespace set属于不支持两阶段的DDL类型，无法通过回滚恢复。因此tablespace set的DDL，在CN，DN，MN节点上，直接走一阶段的执行提交。

​	由于MN节点上不会插入数据，只存储元数据，因此创建tablespace set的时候，不会创建出datafile，databucket，只需要把tablespace的相关信息记录到tablespace_set$系统表中，可以保证tablespace_set$和ddl_queue$的相关操作在一个事务内。

###   [5.2 故障恢复](#52-故障恢复)  

​	当tablespace set在DN或者本CN执行出现了，有节点异常等情况，可能会出现元数据不一致的情况。可以通过后台推送任务去处理元数据不一致的问题。具体恢复场景可以分成两大类

​	将tablespace set的DDL流程，切分成两个阶段，MN节点执行成功前和MN节点执行成功后。

场景分析：

```
1. MN节点执行成功前，出现了节点故障等场景，在所有节点上都未执行成功，直接报失败返回，不会存在元数据不一致的问题
2. MN节点执行成功后，出现了节点故障等场景，可能出现节点间元数据不一致的问题 --- 通过ddl_queue$中的记录信息做后台推送，元数据自动恢复

```

```
/* MN节点改造
 * tablespace set的执行和ddl_queue$改成一阶段执行提交
 */

/* CN节点 dstbExecuteDdl改造
 * tablespace set在MN节点执行成功后，后续出现失败，都给MN节点发送delay clean with error消息，通知MN走后台推送，推送tablespace set的DDL操作给CN，DN节点
 */

/* CN/DN 的LMM线程处理后台推送消息
 * A.create tablespace set消息
 * 	1.从tablespace_set$系统表判断是否有对应的tablespace set name，如果没有，尝试先清理下可能残留的  tablespace相关文件，然后执行execCreateSpaceSetCtx，成功后返回给MN节点
 * 	2.如果有，则标记为已执行，返回成功给MN节点
 * B.drop tablespace set
 * 	1.从tablespace_set$系统表判断是否有tablespace set name，如果有，执行ankDropSpaceset，ankCommit，然后返回成功给MN节点
 *	2.如果没有，则标记为已执行成功，返回成功给MN节点
 */

```

###   [5.3 并行执行](#53-并行执行)  

​	1. tablespace set的DDL，会先在MN上执行，通过TABLESPACE_SET$系统表的NAME字段的唯一索引，保证了CREATE TABLESPACE SET的并发性，DROP 同一个tablespace set的时候，有系统表上的行锁保护，可以起到并发保护的作用。    
  2. create table与tablespace set的相关操作需要有并发控制，增加tablespace set的锁进行保护

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
--- create tablespace set基本语法

--- drop tablespace set基本语法

--- alter tablespace set 基本语法

--- 故障场景下的create tablespace set自动恢复

--- 故障场景下的drop tablespace set自动恢复

--- 故障场景下的alter tablespace set自动恢复

--- 并发执行的测试脚本

```

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*