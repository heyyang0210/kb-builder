Created by 汪少华, last modified on 六月 27, 2023

##   [1. Overview（概述）](#1-overview概述)  

当前因打开auto commit后，insert /*+bulkload*/ into每次提交，导致产生大量的slice，可能导致性能下降，当前为了支持客户需要，允许在指定场景下满足打开auto commit并执行insert /*+bulkload*/ into的需求。

##   [2. Features（功能特性）](#2-features功能特性)  

1.enable_bulkload_auto_commit为新增系统级参数，非隐藏参数生效范围为单机、集群、分布式。

2.允许在线修改和重启修改两种方式。

3.注意这里不对insert into select 场景特殊处理，insert into select等同于普通insert处理相同。

4.默认值为FALSE。

5.使用场景说明（客户使用场景较多为5.1，5.2）

  5.1 insert into values ()()()() 多行

  5.2 insert into select 

  5.3 create table as select (不受该参数影响）

##   [3. Interfaces（接口）](#3-interfaces接口)  

alter system set enable_bulkload_auto_commit=true scope=memory;

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

在enable_bulkload_auto_commit参数为true时，允许在insert /*+bulkload*/ into下支持auto commit on。

在enable_bulkload_auto_commit参数为false时，不允许在insert /*+bulkload*/ into下支持auto commit on。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1.在insert /*+bulkload*/ into执行过程中，检验是否涉及bulkload插入

2.检测是否打开auto commit，未打开，直接执行

3.如打开auto commit，进一步校验enable_bulkload_auto_commit参数，当前模式是否支持在auto commit打开时，执行insert /*+bulkload*/ into

4.校验成功继续执行，校验失败直接退出。



预期不一致场景说明

    1. alter system修改参数并不会自动提交，这导致设置autocommit on后第一次事务会自动提交之前的事务（所有alter system都是这种方式）

    2. 分布式数据库场景autocommit仅在cn上有效，故该enable参数实际仅修改cn即可达到目的（同样支持修改其他节点）

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

#### 关键函数

```
CodResult cbpmEnableBulkloadAutoCommit(CodParamItem* item, CodText* value, CodParamScope scope);

CodResult ckpmEnableBulkloadAutoCommit(CodParamItem* item, const CodText* value);
```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1.参数是否可设置

2.参数是否可显示

3.参数功能是否生效

门禁用例

```
create table 37072_insert_bulkload (a int) organization lsc;
set auto commit off;
insert /*+bulkload*/ into 37072_insert_bulkload(1); //预期成功
commit;

set auto commit on;
insert /*+bulkload*/ into 37072_insert_bulkload(2); //预期失败

alter system set enable_bulkload_auto_commit=true scope=memory; // 预期成功
insert /*+bulkload*/ into 37072_insert_bulkload(3); //预期成功

select * from enable_bulkload_auto_commit orderby a; // 结果符合预期
```

##   [7. Document（资料）](#7-document资料)  

enable_bulkload_auto_commit是一个为了支持在bulkload场景下执行insert时支持auto commit的开关参数，打开该开关前不允许insert /*+bulkload*/ into在auto commit on下执行，打开开关后允许insert /*+bulkload*/ into在auto commit on下执行，但是因为insert /*+bulkload*/ into在auto commit on下执行可能产生大量的slice文件，并且在持续插入的场景下无法快速合并slice文件，可能导致插入和后续查询性能受到影响，打开该开关需要谨慎考虑，在充分了解需求和影响后执行。

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

  
