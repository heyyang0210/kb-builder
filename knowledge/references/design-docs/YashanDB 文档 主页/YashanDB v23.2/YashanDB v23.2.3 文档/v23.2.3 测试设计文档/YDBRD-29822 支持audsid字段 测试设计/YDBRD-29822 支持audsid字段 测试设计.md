Created by 李潮, last modified on 四月 29, 2024

# 1.   **概述**

   本文主要内容为支持audsid字段(  审计会话id)  的测试设计。

# 2.   **需求分析**

SR:     [YDBRD-29822](https://jira.yasdb.com/browse/YDBRD-29822?src=confmacro)    -  v$session支持审计会话ID字段  设计中

设计文档：    [YDBRD-29822 支持audsid字段 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150616237)  

1.DV$SESSION、V$SESSION、GV$SESSION增加1个字段：  AUDSID

2.增加 sequence SYS.AUDSES$（单机集群可修改）

3.变更系统表 AUD$UNIFIED 字段 SESSIONID的含义

4.内置函数userenv支持SESSIONID查询

需求范围：

1. 单机、分布式、共享集群


       2. 交付版本：23.2.3.100

  


  


  


  


新华：

1.单机观察主备

2.分布式观察dn，mn主备切换，升主机表现

3.集群观察ce节点

# 3.   **测试设计方法**

**主要采用的等价类划分，边界值，场景法组合进行设计 **

**1.系统用户连接**  **，audsid为max_uint32**

**2.非系统用户连接，**  **连续发起多个连接，**  **查询主机备机**  **audsid**

**3..非系统用户连接，进行主备切换(备升主发生变化，查询新主机备机**  **audsid——增加并发场景**

~~**4.非系统用户连接，连续发起多个连接直到sequence上限**~~

~~**5**~~  **.非系统用户连接，修改sequence范围，设置cycle false,连续发起多个连接超过新sequence上限**

**6.非系统用户连接，修改sequence范围，设置cycle true，连接超过sequence上限。**

（连续发起N-1个连接，修改sequence new   min value  为old   min value-1  ,修改sequence new   max value  为N+old   min value，继续新发起3个连接  ）

**7.验证背景会话的audsid**

  


以上涉及  三种部署，以及相关的所有类型节点

**校验项：**

**1.查询DV$SESSION、V$SESSION、GV$SESSION的**  **audsid**

**2.查询系统表 AUD$UNIFIED 字段 SESSIONID**

**3.查询内置函数userenv（“SESSIONID”）**

  


  


  


  


  


# 4.   **详细测试设计**

**1.连接场景**

|  
|系统用户|**连续发起多个连接**|主备切换|**修改sequence范围，设置cycle false,连接超过上限**|**修改sequence范围，设置cycle true,连接超过上限**|**sequence是否跳过特殊值**|**背景会话**|
|---|---|---|---|---|---|---|---|
|db主|nextval|nextval|未使用seqence时：nextval直接取值,使用sequence后，sequence cache增加10000后取值nextval,并发已测试，多个连接均取出新值|后续连接失败|sequence在范围内循环|**(废弃，不跳过）**|0|
|db备|**max_uint32**|**max_uint32**||  
  不涉及    
    
    
    
    
,  
,  
|  
    
    
    
    
  不涉及|不涉及||
|cn|**max_uint32**|多个cn都连接,互不干涉|不涉及|||unit32上限构造困难，参考单机集群情况,假设做42万次主备切换，每次10s，需要48天|0|
|dn主|**max_uint32**|nextval|未使用seqence时：nextval直接取值,使用sequence后，sequence cache增加10000后取值nextval,并发已测试，多个连接均取出新值|||参考单机集群||
|dn备|**max_uint32**|**max_uint32**||不涉及||||
|mn主|**max_uint32**|nextval|未使用seqence时：nextval直接取值,使用sequence后，sequence cache增加10000后取值nextval,并发已测试，多个连接均取出新值|||unit32上限构造困难，参考单机集群||
|mn备|**max_uint32**|**max_uint32**||不涉及||||
|ce|**max_uint32**|多个ce都连接|不涉及|  
|  
|**(废弃，不跳过）**|0|


注：特殊值通过  **设置seqence范围为[max_uint32，max_uint32+2]，**  **[0,2]测试**

2.nomount/mount→open场景

系统用户会话和背景会话 audsid 对应 max_uint32和0

|  
|nomount|mount|
|---|---|---|
|单机(db)|√|√|
|集群(ce)|√|√|
|分布式(cn)|√|√|


3.升级场景

|22.2->23.2|离线升级|
|---|---|
|单机(db)|√|
|集群(ce)|不涉及|
|分布式(cn)|√|


# 5.   **测试用例**

**1.冒烟用例**

**2.文本用例**

  


# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


先进行手工测试，暂无可用框架，guider暂不支持主备切换

# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


## Attachments:

[YDBRD-29822冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGY4OTcwYzJhZjRmNTIxMDBmIiwicmVmX2lkIjoiNjczOTZkMGY3MjgyMDZlZmI5MmYxYWFmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODM3LCJleHAiOjE3ODIzOTIyMzd9.2QcOyyuwTni8A7QDZAfgboc_J8bwM9jAWsZec9vlYyA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-29822文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGY4OTcwYzJhZjRmNTIxMDExIiwicmVmX2lkIjoiNjczOTZkMGY3MjgyMDZlZmI5MmYxYWFmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODM3LCJleHAiOjE3ODIzOTIyMzd9.BIrSwQstStfS3c6cs5dq-iTvJsSt0T6QHzqh9JUbgrs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-29822文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGY4OTcwYzJhZjRmNTIxMDEyIiwicmVmX2lkIjoiNjczOTZkMGY3MjgyMDZlZmI5MmYxYWFmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODM3LCJleHAiOjE3ODIzOTIyMzd9.-8OvnT7ahrXylKplKq0KkyV7Do7zp_d9rMoKHNY47cs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议名称：YDBRD-29822 支持audsid字段 测试评审    
  与会人：李潮，施新华，陈步隆，邬建川    
  会议时间：2024/04/25 15:00-15:30    
  纪要：    
  1.直连备机为max_uint32    
  2.backgroup会话为0    
  3.sequence取到max_uint32，0两个特殊值会跳过    
  4.nomount/mount——>open，系统用户可查询当前会话和背景会话audsid    
  5. 22.2升级23.2，视图增加字段，系统表变更值含义及字段类型变更,Posted by lichao at 四月 25, 2024 16:00|
|---|
