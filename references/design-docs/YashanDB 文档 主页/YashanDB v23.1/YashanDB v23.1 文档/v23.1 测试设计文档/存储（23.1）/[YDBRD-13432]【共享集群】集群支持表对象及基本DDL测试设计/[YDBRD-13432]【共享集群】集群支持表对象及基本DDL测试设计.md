Created by 高亚宁, last modified by  马爽 on 十二月 26, 2023

# **1. 概述**

本文描述集群支持表对象及基本DDL测试设计

SR:     [YDBRD-13432](https://jira.yasdb.com/browse/YDBRD-13432?src=confmacro)    -  【共享集群】集群支持表对象及基本DDL  完成

开发设计：    [集群表对象及基本DDL - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107383815)  

# **2. 需求分析**

**2.1 功能特性**

1. 集群下某个实例执行create table(as select)/alter table/truncate table/drop table，其他实例能感知到ddl产生的影响
1. 支持多实例的table ddl并发(通过Gls Lock和gcs写系统表实现)


**2.2 功能限制**

1. 不支持分布表、复制表
1. 不支持TAC/LSC列表
1. 不支持嵌套表
1. create table nologging不支持
1. alter table不支持nologging转化为logging
1. alter table不支持开启附加日志
1. alter table不支持alter table shrink space


# **3. 测试**  **设计方法**   

主要采用边界值法，正交试验法、场景法进行测试

### 3.1测试范围：

1. Rac部署形态；
1. Rac下，create table(as select)/alter table/truncate table/drop table语法及基本功能测试——复用单机现有设计和用例
1. Rac下，  某个实例执行create table(as select)/alter table/truncate table/drop table，其他实例能感知到ddl产生的影响——单独设计，写用例看护，重点测试alter
1. 并发/testkill：多实例间create table(as select)/alter table/truncate table/drop table并发
1. 内存、cursor等资源泄漏


### 3.2功能交互：

1. 建表时调用sequence
1. 给表建索引、触发器，触发器暂不支持


### 3.3专项覆盖

|专项|是否涉及|说明|
|:---|:---|---|
|并发|涉及|  
|
|长稳|涉及|框架/工程暂不支持，SIT补充|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|涉及|  
|
|HA|涉及|暂不支持，后期补测|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


# 4.   **详细测试设计**   

[Rac支持表对象及基本DDL.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWRkIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.qzUOpZOXBIk_vX_Afv0SduTpHYB2XVPPY2D0ZIQuWgE)

# 5.   **测试用例**

[Rac支持表对象及基本DDL.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWRlIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.zXGqb1WcBIamp0ayH-uz4kGksE431IAKSAFbiiCmQLs)

# 6.   **测试框架设计**

1. 功能自动化用例添加到yasft/cluster
1. 并发/testkill 用例添加到anchor_test/storage_testcase_cluster


# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-4-20_16-8-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDhhMWFkOWEzMzExZGM3OTU2IiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.OMErba9dL1IgRV6NAMBMbmq2xAFGUfYQRtYJ1BCWEG0)

 (image/png)    


[image2023-4-20_16-7-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWRmIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.C0J-ioAqyOw-opUdijP-BxLjwTkKSEGgxjivPQ8vHXw)

 (image/png)    


[image2023-4-20_16-7-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDhhMWFkOWEzMzExZGM3OTU3IiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.2E2pMV0-g4JB6PVtUfvn3XhMC8ULoGc0DUWPl0fuY14)

 (image/png)    


[表空间透明压缩测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWUwIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.YjEjFabgOGjbM7gEf9DROeDmeCw0V4s_t94vgj9CNaY)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDhhMWFkOWEzMzExZGM3OTU4IiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.YgUW5Qj4rx7pdliKRmi8c97nhb6gr3GAKxf0npB03IA)

 (application/vnd.xmind.workbook)    


[image2023-4-12_17-9-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWUxIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.67O3AID4OuFQn9rVEG1oWspmR8WhQY46c9adyOmjBW4)

 (image/png)    


[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWUyIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.ZiUQ31006Dfw-dpC8Q_OKyIYgXow5C-nWnbpOIzj15Q)

 (application/vnd.xmind.workbook)    


[Rac支持表对象及基本DDL.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWRkIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.qzUOpZOXBIk_vX_Afv0SduTpHYB2XVPPY2D0ZIQuWgE)

 (application/x-xmind)    


[Rac支持表对象及基本DDL.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDg4OTcwYzJhZjRmNTFmYWRlIiwicmVmX2lkIjoiNjczOTY5ZDg1OTNmOTljOWZmMjM1MzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NDczLCJleHAiOjE3ODIyOTU4NzN9.zXGqb1WcBIamp0ayH-uz4kGksE431IAKSAFbiiCmQLs)

 (application/vnd.ms-excel)    
