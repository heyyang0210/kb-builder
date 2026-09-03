Created by 刘丹, last modified on 二月 01, 2024

# **1. 概述**

  


OID（Object Identifier，对象标识符）是一种全局唯一的标识符，用于在分布式系统中引用和识别对象。OID 可以用来表示各种类型的对象，例如实体、关系、属性、方法等。OID 的格式通常包含一个标识符和一个对象类型标识符，用于唯一标识一个对象。

在数据库中，OID 可以用于在不同的表之间建立引用关系，或者在分布式系统中传递对象的信息。OID 还可以用于实现对象版本控制和历史记录管理，或者作为加密和身份验证机制中的安全标识符。

【本次】  对于系统表有些未在创建时指定对应的objectId，此次修改将会将所有系统表在创建时指定objectId。

# **2. 需求分析**

SR:     [YDBRD-13062](https://jira.yasdb.com/browse/YDBRD-13062?src=confmacro)    -  单机系统对象支持指定OID  完成

开发设计：    [指定oid](113971208.html)  

# **3. 测试**  **设计方法**   

### 3.1 特性关联领域分析：

1.部署形态：单机部署

2.对系统表进行查询，确认都有OID

3.在系统升级后，系统表的OID不变

### **3.2**  ** **  梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|
|资料|否|


# 4.   **详细测试设计**   

|场景|操作步骤|预期结果|备注|
|---|---|---|---|
|直接建库查询|用yasdb安装包直接安装，查询不同视图下系统表的OID|查询成功，OID正确|  
|
|低版本升级|低版本不建库升级，查询不同视图下系统表的OID|查询成功，OID正确|  
|
|  
|低版本建库升级，查询不同系统表下的OID|查询正确，升级后OID未改变|  
|


# 5.   **测试用例**

使用sql脚本

# 6.   **测试框架设计**

自动化用例添加到guider框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[content_1686877662939.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWZhMWFkOWEzMzExZGM3OWIzIiwicmVmX2lkIjoiNjczOTY5ZWY3MjgyMDZlZmI5MmVmOTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTY3LCJleHAiOjE3ODIyOTY1Njd9.4AUu6H6JvmxpylHYVDPnWnCcCS_8B6VexVcF232YYUg)

 (application/x-xmind)    


[系统OID文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWZhMWFkOWEzMzExZGM3OWI0IiwicmVmX2lkIjoiNjczOTY5ZWY3MjgyMDZlZmI5MmVmOTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMTY3LCJleHAiOjE3ODIyOTY1Njd9.nN4b5H9mmFLIo9Z-_j7uO9yUj2rBeJdaI1B6l9EsO84)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
