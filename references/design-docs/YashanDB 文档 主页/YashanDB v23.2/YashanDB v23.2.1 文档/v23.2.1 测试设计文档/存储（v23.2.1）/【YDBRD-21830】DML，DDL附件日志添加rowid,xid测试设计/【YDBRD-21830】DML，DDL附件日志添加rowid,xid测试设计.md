Created by 易文亮, last modified on 十二月 14, 2023

# 1. 概述

*本文主要描述DML，DDL附件日志添加rowid,xid的测试设计*

*目前崖山的附加日志里，只有事务begin和end才记录xid，DML日志不记录xid，也不会记录rowid。*    
  *xid如果不加，DML的解析会比较困难，尤其是长事务的中间位置开始解析，DSG希望在每个DML日志上增加xid（4字节）*    
  *rowid主要是用来定位行位置的，类似主键的作用。如果不是行链接的update，是可以从undo里获取精确值的，但是行链接的update undo只会记录分片的rowid，不是行头的*

# 2. 需求分析

SR链接：    [YDBRD-21830](https://jira.yasdb.com/browse/YDBRD-21830?src=confmacro)    -  DML，DDL附加日志添加rowid，xid  完成

开发设计：    [DML, DDL增加rowid，xid（特性设计） - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138556077)  

## 2.1 功能点分析

- *分别执行各种DDL，DML，确认附加日志里是否记录了xid和rowid*
- *覆盖heap/tac/lsc三种表类型，lsc考虑冷数据*


## 2.2 应用场景

- *执行DDL，DML，确认附加日志里是否记录了xid和rowid*
- *长事务中连续执行多个DML，确认附加日志里有xid和rowid*


## 2.3 规格约束

- *执行成功的DDL和DML才会记录附件日志*
- *像bulkload写入/nologging默认等不会记录附件日志*


# 3. 详细测试设计

## 3.1 测试设计方法

*本设计主要使用场景测试法，开启逻辑日志，构造各种DDL、DML执行成功的场景，确认记录的附件日志符合预期*

## 3.2 详细测试设计

1. *DDL验证：*


*       shrink table*

*       2.DML验证：*

*           insert/update/delete*

*           update触发跨分区更新*

*           LSC冷数据更新、删除*

|序号|测试内容|期望|备注|
|---|---|---|---|
|1|库级附加日志任意模式，DDL逻辑日志|正确解析|库级附加日志已验证，无需补充|
|2|开启MIN模式附加日志，执行DML确认逻辑日志|正确解析，且会记录rowid|库级附加日志已验证，无需补充|
|3|构造lsc冷数据update/delete,  确认逻辑日志|正确解析|  
|
|4|分区表跨分区更新，确认逻辑日志|正确解析|  
|
|5|分区表跨分区更新outlob，确认逻辑日志|正确解析|  
|
|6|二级分区表跨分区更新，确认逻辑日志|正确解析|  
|
|7|升级前打开逻辑日志开关，执行dml，升级后继续执行dml|解析正常，DB不异常|  
|


  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|N|
|KT|N|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|Y|
|压力|N|
|性能|N|
|可维护性|N|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- ha_regress框架


# 6. 测试环境说明

*单机*

# 7. 工作量评估

工作量：  *2人天*

计划测试完成时间：