Created by 王莹, last modified on 十二月 19, 2023

# 1.   **概述**

该需求主要是将单机dblink功能应用在集群部署上，与单机上的使用基本相同，支持范围一致。

  [YDBRD-15258](https://jira.yasdb.com/browse/YDBRD-15258?src=confmacro)    -  DBLINK的集群化改造  完成

涉及的内容包括：

- ddl
- dml
- 元数据导入导出
- 审计
- 权限


# 2.   **需求分析**

  [集群支持DBLINK - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133593120)  

  [YDBRD-12667_集群支持Dblink-测试概要设计 - 孟麟 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133583627)  

在集群上主要是通过ip和端口号来确认链接的是集群中的哪个实例

集群上验证dblink的功能，主要的验证点有以下几点：

- 实例之间dblink的通用性：实例1create/drop后，其他实例也（不）可使用
- 多实例dblink的并发使用，无core，卡死等问题


约束：与单机保持一致，无新增约束

# 3.   **测试设计方法**

ddl dml语法相关-场景法

不同实例之间元数据修改验证-错误推测法

# 4.   **详细测试设计**

1）

[集群dblink.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2U4OTcwYzJhZjRmNTIwNGQ2IiwicmVmX2lkIjoiNjczOTZiN2U3MjgyMDZlZmI5MmYwNmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MjA3LCJleHAiOjE3ODIzODE2MDd9.OhjPuVx4oD4VFLFW58k8fQbcl8cAGHZLPFQPvn87Wg8)

2）专项（基本复用单机用例）

|专项|是否涉及|场景|
|:---|:---|---|
|并发|Y|1.ddl之间并发；,2.dml与ddl的并发,3.dml与dml的并发|
|长稳|Y,补充事务相关用例|  
|
|一致性|Y|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|安全|/|  
|
|DFR/testkill|Y|针对集群补充DFR测试，主要构造kill ycs(yfs)的各种场景|
|HA|Y|备机拦截写操作的验证|
|压力|/|  
|
|性能|/|  
|
|可维护性|/|  
|


  


  


# 5.   **测试用例**

  


文本用例：

[dblink.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2VhMWFkOWEzMzExZGM4MzRkIiwicmVmX2lkIjoiNjczOTZiN2U3MjgyMDZlZmI5MmYwNmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MjA3LCJleHAiOjE3ODIzODE2MDd9.1j91-jsCvXwjk-ZOcRx7-LmsShbIZlESP-ZcILKENr8)

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7. 工作量评估

工作量：  *21人天*

计划测试完成时间：

  


  


## Attachments:

[集群dblink.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2U4OTcwYzJhZjRmNTIwNGQ3IiwicmVmX2lkIjoiNjczOTZiN2U3MjgyMDZlZmI5MmYwNmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MjA3LCJleHAiOjE3ODIzODE2MDd9.Uzvx-5HYi5_n4ck1C0IeoIrJSBXR6fVDdeGeup8cfNQ)

 (application/x-xmind)    


[集群dblink.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2U4OTcwYzJhZjRmNTIwNGQ2IiwicmVmX2lkIjoiNjczOTZiN2U3MjgyMDZlZmI5MmYwNmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MjA3LCJleHAiOjE3ODIzODE2MDd9.OhjPuVx4oD4VFLFW58k8fQbcl8cAGHZLPFQPvn87Wg8)

 (application/x-xmind)    


[dblink.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiN2VhMWFkOWEzMzExZGM4MzRkIiwicmVmX2lkIjoiNjczOTZiN2U3MjgyMDZlZmI5MmYwNmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MjA3LCJleHAiOjE3ODIzODE2MDd9.1j91-jsCvXwjk-ZOcRx7-LmsShbIZlESP-ZcILKENr8)

 (text/csv)    
