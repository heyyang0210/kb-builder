Created by 胡晓畔, last modified on 九月 20, 2024

  


  [https://pingcode.yasdb.com/pjm/items/66bdc45e66228b94707f54a0](https://pingcode.yasdb.com/pjm/items/66bdc45e66228b94707f54a0)    ?    
  #YDBRD-31624 DBLink查询性能优化

# 1. 概述

本需求对客户现场特定SQL进行优化，目标在同等配置的崖山数据库通过DBLINK连接远端oracle环境，查询性能超过同等环境下达梦。

交付形态：单机，集群

# 2. 需求分析

## 2.1 功能点分析

不涉及新增功能

## 2.2 应用场景

客户应用SQL

针对优化点的增补场景

## 2.3 规格约束

- 当前需求只优化查询
- 三个配置参数   EXS_DBLINK_ROWARRAY_SIZE     DRV_MEMORY_BLOCK_SIZE  EXS_DEFAULT_YDBC_BUFFER_SIZE 【优化使用体验，当前需求测试使用参数默认值，默认值已达最优】


  


# 3. 详细测试设计

## 3.1 测试设计方法

AB测试法，使用同样数据和SQL，对比达梦8与崖山的性能数据

数据准备：

梳理客户现场SQL语句和拿回的统计信息，根据统计信息和SQL确认数据分布情况，造数需要尽量贴近客户现象数据模型

## 3.2 详细测试设计

### 3.2.1 造数分析

  


  


### 3.2.2 测试场景

|测试场景|  
|  
|预期|备注|
|---|---|---|---|---|
|客户场景sql|用例附件,[sql1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjNhMWFkOWEzMzExZGM5NDg0IiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.ppa5mR70Wavyo_FPpKWPsbhG5ovmoqObuHMXMEEhkRA),[sql2-jlzg.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjNhMWFkOWEzMzExZGM5NDg1IiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.OMegF5lZ7gmQ1Jsqaj69gprYBVm7iWg3K2SR69U41bM),[sql3-jsjc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjNhMWFkOWEzMzExZGM5NDg2IiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.0Fh3WdRT8vkzpOHTQjZOsM3isa9VWoNLsbEdir8W8WE),[sql4-jszg.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjM4OTcwYzJhZjRmNTIxNjEyIiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.-apYmGujF6az_Pg-orKb46wUNamf6dxFRh1d9DSVTT0),[sql5-qzbg.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjQ4OTcwYzJhZjRmNTIxNjEzIiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.xfAOVPy6tgMUShmxVa_skpkLx8YsaPWpaTEkcP9d8dQ)|  
|性能数据优于达梦|当前客户sql在本需求性能不优，已有其他三个优化需求承接,  [https://pingcode.yasdb.com/ship/ideas/66e2aad089f961f3301155e1](https://pingcode.yasdb.com/ship/ideas/66e2aad089f961f3301155e1)    ?    
  #YASHAN-3325 distinct 投影优化    
    [https://pingcode.yasdb.com/ship/ideas/66e16a4089f961f330114a9a](https://pingcode.yasdb.com/ship/ideas/66e16a4089f961f330114a9a)    ?    
  #YASHAN-3319 dblink远端查询支持filter带绑定参数    
    [https://pingcode.yasdb.com/ship/ideas/66e16b1d4283cf23d4f52a11](https://pingcode.yasdb.com/ship/ideas/66e16b1d4283cf23d4f52a11)    ?    
  #YASHAN-3320 支持将包括join，group by等复杂查询下推到dblink远端执行,本SR关注补充优化场景测试中的部分列查询数据,全表count()查询不优，规划需求解决,  [https://pingcode.yasdb.com/ship/ideas/66ed16964283cf23d4f58d73](https://pingcode.yasdb.com/ship/ideas/66ed16964283cf23d4f58d73)    ?    
  #YASHAN-3344 DBLink支持count(*)下推到远端执行,  
|
|补充优化场景测试|字符类型查询优化|~~1000列  ~~     128列,char(500),varchar2(500),nchar(250),nvarchar2(250),查询全表 ，部分列(32 64 128 )|  
|根据崖山存储规格，调整测试场景最大测试列为128列,  
|
|  
|number类型查询优化|~~1000列  ~~     128列,number ,查询全表 ，部分列(32 64 128 )|  
|  
|
|  
|number，字符类型组合 |~~1000列  ~~     128列,number + 字符型,查询全表 ，部分列(32 64 128 )|  
|  
|


  


  


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|√|
|可维护性|  
|


  


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

# 5. 测试框架设计

Guider + yasft 

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Attachments:

[sql1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjNhMWFkOWEzMzExZGM5NDg0IiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.ppa5mR70Wavyo_FPpKWPsbhG5ovmoqObuHMXMEEhkRA)

 (application/octet-stream)    


[sql2-jlzg.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjNhMWFkOWEzMzExZGM5NDg1IiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.OMegF5lZ7gmQ1Jsqaj69gprYBVm7iWg3K2SR69U41bM)

 (application/octet-stream)    


[sql3-jsjc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjNhMWFkOWEzMzExZGM5NDg2IiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.0Fh3WdRT8vkzpOHTQjZOsM3isa9VWoNLsbEdir8W8WE)

 (application/octet-stream)    


[sql4-jszg.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjM4OTcwYzJhZjRmNTIxNjEyIiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.-apYmGujF6az_Pg-orKb46wUNamf6dxFRh1d9DSVTT0)

 (application/octet-stream)    


[sql5-qzbg.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjQ4OTcwYzJhZjRmNTIxNjEzIiwicmVmX2lkIjoiNjczOTZkZjM3MjgyMDZlZmI5MmYyNDk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMTMzLCJleHAiOjE3ODIzOTk1MzN9.xfAOVPy6tgMUShmxVa_skpkLx8YsaPWpaTEkcP9d8dQ)

 (application/octet-stream)    
