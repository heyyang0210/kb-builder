Created by 孟麟, last modified on 十二月 18, 2023

# 1. 概述

  


  [YDBRD-23740](https://jira.yasdb.com/browse/YDBRD-23740?src=confmacro)    *-*  *支持V$SESS_TIME_MODEL视图，统计各种操作的会话累积时间*  *完成*

新增视图用于统计会话4类操作的耗时。

# 2. 需求分析

## 2.1 功能点分析

V$SESS_TIME_MODEL字段分析

|字段|类型|描述|字段分析|
|:---|:---|:---|---|
|SID|SMALLINT|会话ID|链接到数据库的会话均有唯一ID|
|STAT_ID|INTEGER|统计项ID|每个会话固定4个统计项|
|STAT_NAME|VARCHAR(64)|统计项名称    
  * DB TIME：执行数据库用户级调用所花费的时间（以微秒为单位）    
  * PARSE TIME ELAPSED：解析SQL语句所花费的总时间（以微秒为单位）    
  * HARD PARSE ELAPSED TIME：硬解析SQL语句所花费的时间（以微秒为单位）    
  * SQL EXECUTE ELAPSED TIME：执行SQL语句所花费的时间（以微秒为单位）|1、会话执行所有SQL，统计项的值均会增加,2、连续2次执行相同语句，第2次  HARD PARSE ELAPSED TIME值不会增加|
|VALUE|BIGINT|统计值|不会出现负数，由大到小的情况|


  


## 2.2 应用场景

1、视图

2、其他特性关联：无

## 2.3 规格约束

1、支持单机

# 3. 详细测试设计

## 3.1 测试设计方法

视图各字段的测试设计方法，针对字段取值：使用边界值，等价类，以及场景分析法

## 3.2 详细测试设计

1、动态视图通用测试点

2、V$SESS_TIME_MODEL，针对各字段分析测试场景：

|字段|类型|描述|字段分析|测试点分析|
|:---|:---|:---|---|---|
|SID|SMALLINT|会话ID|链接到数据库的会话均有唯一ID|1、不同连接方式：1）yasql带ip，不带ip；2）yasql内部使用conn；3）yasql内部使用@sql文件执行， 4）jdbc；5）yasql -c，yasql -f,2、反复登录不执行任何语句，退出,3、kill session、ctrl+z退出session,4、并发；5、不同类型用户|
|STAT_ID|INTEGER|统计项ID|每个会话固定4个统计项|并发时每个sid均对应4个统计项|
|STAT_NAME|VARCHAR(64)|统计项名称    
  * DB TIME：执行数据库用户级调用所花费的时间（以微秒为单位）    
  * PARSE TIME ELAPSED：解析SQL语句所花费的总时间（以微秒为单位）    
  * HARD PARSE ELAPSED TIME：硬解析SQL语句所花费的时间（以微秒为单位）    
  * SQL EXECUTE ELAPSED TIME：执行SQL语句所花费的时间（以微秒为单位）|1、会话执行所有SQL，统计项的值均会增加,2、连续2次执行相同语句，第2次  HARD PARSE ELAPSED TIME值不会增加|1、执行语句，语句按类型覆盖（ddl/dml/dcl/plsql），时间累计,2、执行语句报错，看时间变化,3、连续2次执行相同语句，看  HARD PARSE ELAPSED TIME值变化情况|
|VALUE|BIGINT|统计值|不会出现负数，由大到小的情况||


3、其他专项分析

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及，加入查询视图的语句|
|KT|涉及，加入查询视图的语句|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

# 5. 测试框架设计

功能使用guider框架可满足，专项使用testkill等框架可满足。

# 6. 测试环境说明

通用测试环境，无特殊要求

# 7. 工作量评估

工作量：2  *人天*

计划测试完成时间：12-08

## Attachments:

[YDBRD-23740文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjlhMWFkOWEzMzExZGM4NTAzIiwicmVmX2lkIjoiNjczOTZiYjk1OTNmOTljOWZmMjM2NjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTQ4LCJleHAiOjE3ODIzODI5NDh9.sYsXzc1Z7Mja8KV_IQJQHl1c-Mjy2V7UQIJFTWlfkws)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-23740_v$sess_time_model-测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjlhMWFkOWEzMzExZGM4NTA0IiwicmVmX2lkIjoiNjczOTZiYjk1OTNmOTljOWZmMjM2NjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTQ4LCJleHAiOjE3ODIzODI5NDh9.gABb7Igp_iL9XdIT_TQf2h0Dfsgb-WqQOHKY8PLig1A)

 (application/x-xmind)    
