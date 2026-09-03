Created by 党文琪, last modified on 十月 12, 2024

# 1.   **概述**

此测试设计描述定时任务高级包stop_job接口的测试设计

SR链接：       [YDBRD-16501](https://jira.yasdb.com/browse/YDBRD-16501?src=confmacro)    -  支持DBMS_SCHEDULER.STOP_JOB  完成

开发方案链接：    [https://conf.yasdb.com/x/JKNGBw](https://conf.yasdb.com/x/JKNGBw)  

# 2.   **需求分析**

**对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等**

本需求重点关注对正在执行job停止是否生效，本次停止不影响下次执行及后续执行时间的计算。需要确认系统表中记录的状态，执行失败次数，下次执行时间等

# **3. 测试设计方法**

**主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计;重点关注定时任务的启停。**

# **4. 详细测试设计**

**1）测试场景**

本次测试需要覆盖单机及集群

**2）基础用例构造**

1、构造一个执行时间较长的定时任务，如在某张表中insert 100w行。

**3）接口测试**

|  
|测试点|测试点|
|:---|:---|:---|
|DBMS_SCHEDULER.STOP_JOB|job_name|一个入参or多个入参|
|  
|  
|入参为schor入参为job|
|  
|  
|传参方式：变量/record/function返回值|
|  
|force|仅语法支持|
|  
|commit_semantics|仅语法支持|


**4）场景测试**

**重点覆盖，一个或多个入参状态不一致时，调用生效的情况。**

**覆盖与其他定时任务的接口一起使用时，定时任务状态是否正常。**

**集群场景通过指定instance_id，检查执行是否生效**

**5）并发测试**

**创建定时任务，并发修改定时任务或其依赖对象，并发调用stop_job,检查有无异常**

xmind版测试设计：

规格限制：

**RUN_JOB程序会手动执行一次定时任务。定时任务的状态会变为RUNNING，但无法通过STOP_JOB接口停止。会等到本次执行结束后再释放**

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[DBMS_SCHEDULER.STOP_JOB .xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWZhMWFkOWEzMzExZGM3N2ZhIiwicmVmX2lkIjoiNjczOTY5OWU3MjgyMDZlZmI5MmVmNTNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzUyLCJleHAiOjE3ODIyOTQxNTJ9.UhqgNzqvxmxjo1t12vhXzTM9fsMd722xkbwniTjPqOM)

 (application/x-xmind)    


[stop_job.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OWY4OTcwYzJhZjRmNTFmOTg0IiwicmVmX2lkIjoiNjczOTY5OWU3MjgyMDZlZmI5MmVmNTNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NzUyLCJleHAiOjE3ODIyOTQxNTJ9.cY38ujbDWEkvl8NHNGL_s3FwJZF2lvilUWcT7tZQYpM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
