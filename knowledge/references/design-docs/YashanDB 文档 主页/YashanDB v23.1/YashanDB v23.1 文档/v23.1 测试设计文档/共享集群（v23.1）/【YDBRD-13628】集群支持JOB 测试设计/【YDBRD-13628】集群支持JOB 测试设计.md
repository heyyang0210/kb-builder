Created by 王伟, last modified on 十二月 20, 2023

# **1. 概述**

本文描述集群支持JOB 测试设计。job具备定时任务的功能，能够对定时任务进行创建、管理、执行等操作。job的实现主要通过内置高级包DBMS_JOB和DBMS_SCHEDULER进行操作。

SR:     [YDBRD-13628](https://jira.yasdb.com/browse/YDBRD-13628?src=confmacro)    -  集群支持JOB  完成

开发设计文档：    [集群支持job](https://conf.yasdb.com/pages/viewpage.action?pageId=117670243)  

# **2. 需求分析**

## 2.1 测试需求

1. 原单机数据库下JOB所有功能均正常
1. RAC集群中任意实例可操作JOB，并同步JOB信息到所有实例上
1. JOB可以在RAC中随机实例执行
1. JOB可以在RAC中指定固定实例执行
1. 集群下并发操作JOB无core


## 2.2 接口梳理

|包|接口|参数|测试点|备注|
|---|---|---|---|---|
|**DBMS_JOB**|### SUBMIT|   job,what,next_date,interval,no_parse  |-|参数单机已覆盖|
|||instance IN BINARY_INTEGER DEFAULT  any_instance,job的执行实例，0为随机实例执行|1. 有效值[0,运行实例号]
1. integer类型校验
1. integer类型隐式转换
1. 无效值输入
|  
|
|||force IN BOOLEAN DEFAULT FALSE,为TRUE时可以指定没有运行的instance|1. true
1. false、不输入、null
1. 与instance 参数组合测试
|  
|
||**BROKEN**|-|多实例交互测试、验证|参数单机已覆盖|
||**CHANGE**|waht、next_date、interval 修改|-|参数单机已覆盖|
|||instance|同上|  
|
|||force|同上|  
|
||**INTERVAL**|-|多实例交互测试、验证|参数单机已覆盖|
||**NEXT_DATE**|-|多实例交互测试、验证|参数单机已覆盖|
||**RUN**|-|多实例交互测试、验证|参数单机已覆盖|
|||force|同上|  
|
||**WHAT**|-|多实例交互测试、验证|参数单机已覆盖|
||**REMOVE **|-|多实例交互测试、验证|参数单机已覆盖|
||**INSTANCE（新）**|job_id|1. 有效值：已存在的job_id
1. integer 类型校验
1. integer 隐式转换
1. 无效值：不存在的job_id，非integer输入
|  
|
|||instance|同上|  
|
|||force|同上|  
|
|**DBMS_SCHEDULER**,  
    
    
    
    
    
    
    
|**CREATE_JOB**|-|多实例交互测试、验证|参数单机已覆盖|
||**DISABLE**|-|多实例交互测试、验证|参数单机已覆盖|
||**ENABLE**|-|多实例交互测试、验证|参数单机已覆盖|
||**DROP_JOB **|-|多实例交互测试、验证|参数单机已覆盖|
||**SET_ATTRIBUTE**|auto_drop    
  comments    
  end_date    
  job_action    
  repeat_interval    
  start_date|多实例交互测试、验证|参数单机已覆盖|
|||instance_id（新）|同上|  
|
|||第4个入参：value2（用于可能有2个关联值的属性）|1、其他属性增加一个随机值（不生效）|补充|
||**RUN_JOB（补）**|job_name|  
|  
|
|||current_session（bool）    
  执行是否放后台|1. true
1. false、不输入
1. null
1. 绑定实例上运行job
1. 非绑定实例上运行job
|  
|


## 2.3 相关视图

|包|系统视图|说明|
|---|---|---|
|### DBMS_JOB,  
    
|#### ALL_JOBS|数据库中所有job|
||#### DBA_JOBS|dba用户下的job|
||#### USER_JOBS|当前用户下的job|
|### DBMS_SCHEDULER|#### ALL_SCHEDULER_JOBS|数据库中所有dbms_scheduler|
||#### DBA_SCHEDULER_JOBS|dba用户下的dbms_scheduler|
||#### USER_SCHEDULER_JOBS|当前用户下的dbms_scheduler|


## 2.4 测试范围

- 部署形态：集群
- 部署环境：单主机磁阵/多主机磁阵
- 节点个数：不超过4节点


## 2.5 影响范围

集群的实例ID修改为从1开始计数（原来是从0开始），产生的影响主要有以下几个方面：

1. 影响v$instane视图中的instance_number的查询结果。
1. 影响sys.dbms_awr.awr_report()中的实例ID为0是无效的。
1. test_sdv_DBMS_JOB_115。


# **3. 测试**  **设计方法**   

主要采用场景法，等价类划分法、边界值法。测试点为：

- 定时任务的接口调用正确
- 集群中任意实例均能查看、修改job
- job的绑定运行实例功能验证
- 实例间交互操作job，同步到所有实例
- 集群下并发操作JOB无core。


# 4.   **详细测试设计**

[集群JOB.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmU4OTcwYzJhZjRmNTFmYTUxIiwicmVmX2lkIjoiNjczOTY5YmU1OTNmOTljOWZmMjM1MjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjU1LCJleHAiOjE3ODIyOTUwNTV9.TSaaGE-rL_zEjsQC1WoLrVlzpZbbtBHTxYWJwW_3Q9U)

# 5.   **测试用例**

[集群执行JOB测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmVhMWFkOWEzMzExZGM3OGM5IiwicmVmX2lkIjoiNjczOTY5YmU1OTNmOTljOWZmMjM1MjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjU1LCJleHAiOjE3ODIyOTUwNTV9.p0ykrD0F-u5-wTnWzBGpEQYrM9_ZCKs7J2qy7nuC5sM)

# 6.   **测试框架设计**

本次测试使用guider框架，testkill框架  实现

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|rac 单机3实例共享存储|


## Attachments:

[集群JOB.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmU4OTcwYzJhZjRmNTFmYTUxIiwicmVmX2lkIjoiNjczOTY5YmU1OTNmOTljOWZmMjM1MjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjU1LCJleHAiOjE3ODIyOTUwNTV9.TSaaGE-rL_zEjsQC1WoLrVlzpZbbtBHTxYWJwW_3Q9U)

 (application/x-xmind)    


[集群执行JOB测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmU4OTcwYzJhZjRmNTFmYTUyIiwicmVmX2lkIjoiNjczOTY5YmU1OTNmOTljOWZmMjM1MjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjU1LCJleHAiOjE3ODIyOTUwNTV9.fmd6zlURx8_IzEzGQZDs8fTJNptZ19I1scU725_itZU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[集群执行JOB测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmVhMWFkOWEzMzExZGM3OGM5IiwicmVmX2lkIjoiNjczOTY5YmU1OTNmOTljOWZmMjM1MjRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjU1LCJleHAiOjE3ODIyOTUwNTV9.p0ykrD0F-u5-wTnWzBGpEQYrM9_ZCKs7J2qy7nuC5sM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
