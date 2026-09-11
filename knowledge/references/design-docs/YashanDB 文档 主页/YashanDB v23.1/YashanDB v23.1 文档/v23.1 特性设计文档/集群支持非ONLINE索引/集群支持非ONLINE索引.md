Created by 黄杨波, last modified on 五月 11, 2023

#   [YDBRD-13434 : 集群支持非ONLINE索引方案设计](#ydbrd-13434--集群支持非online索引方案设计)  

  [https://jira.yasdb.com/browse/YDBRD-13434](https://jira.yasdb.com/browse/YDBRD-13434)  

##   [1. Overview（概述）](#1-overview概述)  

单机下只有一个节点，执行create/drop/alter index会涉及到失效dc，失效完成后本地可见，且create/drop/alter index并发通过本地的latch table lock控制。集群下存在多个写节点，节点间的并发控制通过在本地latch table lock的基础上加上gls X lock控制，当执行节点完成后，需要广播同步其他节点失效dc的操作，使其他节点在重新访问table时重新加载dc使index生效

##   [2. Features（功能特性）](#2-features功能特性)  

1. 集群下某个实例执行create/drop/alter index，其他实例能感知到ddl产生的影响
1. 支持多实例的create/drop/alter index并发(通过Gls X lock实现)


##   [3. Interfaces（接口）](#3-interfaces接口)  

主要是在ddl的二阶段提交中提供实例间广播同步内存信息的接口(并发处理由其他模块支持，这里不进行详细说明)

1. 函数接口


|name|Meaning|
|---|---|
|AXC_CB->axcBcstAlterTable|广播同步alter table失效dc的操作|


1. 消息接口


|name|function|Meaning|
|---|---|---|
|MSG_ALTER_TABLE|msgAlterTable|执行实例广播给其他实例失效dc|
|MSG_ALTER_TABLE_ACK|msgNullFunc|其他实例失效完成后返回执行实例ack|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 不支持online索引
1. 不支持列式索引
1. 不支持创建inmemory索引(拦截方式：集群下无法创建MMS表空间)


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

```
typedef struct StRecAlterTable {
    CodUint64 oid;
} RecAlterTable;

```

###   [5.2 方案实现](#52-方案实现)  

create/drop/alter index：

1. 按照单机逻辑执行create/drop/alter index，通过本地latch table lock + gls X lock控制本地和实例间的并发操作
1. 在本地执行完单机的create/drop/alter index逻辑后，进行二阶段提交，在二阶段提交中调用AXC_CB->axcBcstAlterTable广播其他实例失效dc，广播的内容为RecAlterTable结构体中的内容
1. 当收到其他所有实例的ack后，二阶段提交完成，此时其他实例均没有最新的dc，如果需要访问表则需要重新从系统表加载dc


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 实例A执行非ONLINE索引的ddl，去其他实例查询对应对象的索引清情况是否同步
1. 多实例非ONLINE索引ddl并发，验证正确性
1. 多实例非ONLINE索引ddl与dml并发，验证正确性


##   [7.资料设计章节](#7资料设计章节)  

开发手册-SQL参考手册-SQL语句-create index/alter index：增加共享集群部署下的限制描述

##   [8. TODO（遗留问题）](#8-todo遗留问题)  