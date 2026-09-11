Created by 刘丹, last modified on 十二月 26, 2023

**测试详细设计目的：**    
  **对新增v$session_event视图各个新增字段，变化校验测试**

**SR:**    [[YDBRD-23742] 支持v$session_event视图 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-23742?jql=text%20~%20%22%E6%94%AF%E6%8C%81v%24session_event%22)  

# 1. 概述

支持V$SESSION_EVENT视图，统计会话的等待事件的信息，根据文档，22.2版本共41个等待事件

# 2. 需求分析

## 2.1 功能点分析

- **新增v$session_event，可以统计会话等待事件信息**
- **跟v$system_event字段相同，只多了一个SID新字段，显示会话ID**
- **有等待事件时，session退出后在v$session_event的等待事件数量会减少，但是v$system_event的数量保持不变**
- **具体字段如下：**


|字段|类型|说明|备注|
|:---|:---|:---|:---|
|SID|SMALLINT|会话ID|  
|
|EVENT|VARCHAR(32)|等待事件名称|  
|
|TOTAL_WAITS|BIGINT|总等待次数|  
|
|TOTAL_TIMEOUTS|BIGINT|总超时次数|  
|
|TIME_WAITED|BIGINT|等待时间（单位毫秒）|  
|
|AVERAGE_WAIT|NUMBER|平均等待时间（单位毫秒）|  
|
|TIME_WAITED_MICRO|BIGINT|等待时间（单位微秒）|  
|
|TOTAL_WAITS_FG|BIGINT|前台等待次数|  
|
|TOTAL_TIMEOUTS_FG|BIGINT|前台超时次数|  
|
|TIME_WAITED_FG|BIGINT|前台等待时间 （单位毫秒）|  
|
|AVERAGE_WAIT_FG|NUMBER|前台平均等待时间（单位毫秒）|  
|
|TIME_WAITED_MICRO_FG|BIGINT|前台等待时间（单位微秒）|  
|
|EVENT_ID|INTEGER|等待事件ID|  
|
|WAIT_CLASS|VARCHAR(16)|等待事件类别    
  * APPLICATION    
  * CONCURRENCY    
  * COMMIT    
  * USER I/O    
  * SYSTEM I/O    
  * OTHER    
  * IDLE    
  * NETWORK    
  * CONFIGURATION    
  * CLUSTER|  
|


## 2.2 应用场景

- 通过查询V$SESSION_EVENT视图，知道会话的等待事件的信息


## 2.3 规格约束

- session释放后，v$session_event的等待事件数量会减少
- v$session_event的字段对齐v$system_event


# 3. 详细测试设计

## 3.1 测试设计方法

对于本次设计主要采用场景法

- 通过构造不同的等待事件，查询视图观测各个字段是否符合预期


## 3.2 详细测试设计

涉及场景：

1.环境：单机

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|/|
|HA|涉及|
|压力|/|
|性能|/|
|可维护性|/|


|编号|测试场景|用例详细描述|预期|备注|
|---|---|---|---|---|
|1|正常拦截场景|对V$session_event做ddl/dml操作,创建同名视图|拦截|  
|
|2|查询语法|带filter,带join联合查询：与v$system_event,v$session等,group by order by,desc 视图，查看字段类型是否与v$system_event一样|查询结果正常，字段正确|  
|
|3|权限|创建一个新用户，只给用户create session的权限，查询视图|查询结果正常，字段正确|v$session也查询正确,22.2版本视图无权限控制|
|4|正常功能场景|构造等待事件，在v$session_event和v$system_event中查询|查询结果正常|  
|
|  
|  
|构造等待事件，在v$session_event和v$system_event中查询，关闭session，v$session_event的等待事件统计变少，v$system_event视图中等待事件统计不变|查询结果正常，字段准确|  
|
|  
|  
|构造等待事件，在v$session_event和v$system_event中查询，增加session,v$session_event的等待事件统计变多|查询结果正常，字段准确|  
|
|5|并发|跑大并发的业务一段时间，过程中并发查询V$SESSION_EVENT，观测下视图查询会不会卡住或者coe,业务结束后查询V$SYSTEM_EVENT和V$SESSION_EVENT，查看下统计的值是否有不合理的|无core产生|  
|


# 4. 测试用例

# 5. 测试框架设计

- guider框架


# 6. 测试环境说明

linux

# 7. 工作量评估

工作量：  *1人/5天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjJhMWFkOWEzMzExZGM4NjhkIiwicmVmX2lkIjoiNjczOTZiZjI3MjgyMDZlZmI5MmYwYzAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTQ2LCJleHAiOjE3ODIzODQ1NDZ9.2fx-u8745PSc2yO17xd868wIW9QsKW-Z6FMOxtbjk20)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjJhMWFkOWEzMzExZGM4NjhkIiwicmVmX2lkIjoiNjczOTZiZjI3MjgyMDZlZmI5MmYwYzAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTQ2LCJleHAiOjE3ODIzODQ1NDZ9.2fx-u8745PSc2yO17xd868wIW9QsKW-Z6FMOxtbjk20)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjJhMWFkOWEzMzExZGM4NjhlIiwicmVmX2lkIjoiNjczOTZiZjI3MjgyMDZlZmI5MmYwYzAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTQ2LCJleHAiOjE3ODIzODQ1NDZ9.3Ors7sEbvpKVR-oZv-wD39ZU8YweubsMlpy5df4fmN0)

 (application/msword)    


[session_event文本用例模版.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjI4OTcwYzJhZjRmNTIwODE4IiwicmVmX2lkIjoiNjczOTZiZjI3MjgyMDZlZmI5MmYwYzAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTQ2LCJleHAiOjE3ODIzODQ1NDZ9.FcyVRF0cVI219MvuqnHTkVuD_pU3ZdZ8gOq98oX_PwM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
