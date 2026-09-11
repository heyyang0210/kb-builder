Created by 吕雷奇, last modified on 十一月 07, 2023

## 1.   **概述**

本文描述集群支持分区split；

## 2.   **需求分析**

本需求的开发设计：    [Split Partition - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Split+Partition)  

特性sr连接：    [YDBRD-21348](https://jira.yasdb.com/browse/YDBRD-21348?src=confmacro)    -  集群支持分区split  完成

本需求是在单机支持的基础上进行的集群功能适配。

支持功能

将range（interval）/list 分区重新划分未多个分区；

![](https://conf.yasdb.com/download/attachments/113971362/split_table_partition.GIF?version=1&modificationDate=1686282493000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY5ODMsImV4cCI6MTc4MjMwNzc4M30.RFRO1tA3Y98csOgF3rJ37Ygt0ugRT8-m1WLDcdvhHTU)

功能限制：

1、hash分区不支持split分区；

2、组合分区不支持split分区；

3、update global indexes 为语法兼容，全局索引是一定失效的。update indexes时不会失效local索引但会失效global索引；

# **3. 详细测试方法**

3.1测试设计方法

基于单机已经验证过的语法等特性，除新增语法外本次测试重点主要放在集群透明多写的特性上；主要基于场景法和正交组合给出测试场景；

3.2详细测试设计

1.详细设计功能点；

2.DFX关联场景：

|  
|测试项|是否涉及|  
|
|---|---|---|---|
|1|长稳|涉及|  
|
|2|可靠性|涉及|  
|
|3|并发|涉及|  
|
|4|HA|涉及|  
|
|5|安全|不涉及|  
|
|6|一致性|涉及|  
|
|7|压力|不涉及|  
|
|8|可维护性|不涉及|  
|


# **4.**  **详细测试设计**   

1.冒烟用例；

2.用例

# **5.测试框架**

使用guider，ha_regress,一致性和testkill测试框架

# **6.测试环境**

本地测试环境，1台机器部署2实例；

# **7.工作量评估**

工作量：7人天

计划测试完成时间：

  


  


  


## Attachments:

[image2023-11-7_9-36-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzc4OTcwYzJhZjRmNTIwNmRhIiwicmVmX2lkIjoiNjczOTZiYzc3MjgyMDZlZmI5MmYwYTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTgzLCJleHAiOjE3ODIzODMzODN9.nyjSBGZ_dZu1aMX83d9O1-KRorjXodqAxXxhR8fW5UU)

 (image/png)    


[集群支持split分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzhhMWFkOWEzMzExZGM4NTUyIiwicmVmX2lkIjoiNjczOTZiYzc3MjgyMDZlZmI5MmYwYTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTgzLCJleHAiOjE3ODIzODMzODN9.R1_tj0C8dfVj4vtu5tZ6khLYGp6aW0tw-gsoX4uhYlQ)

 (application/x-xmind)    


[split_table_partition.gif](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzg4OTcwYzJhZjRmNTIwNmRiIiwicmVmX2lkIjoiNjczOTZiYzc3MjgyMDZlZmI5MmYwYTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTgzLCJleHAiOjE3ODIzODMzODN9.6TEnQ6GH6paGPtz7O8oEAjRNGZYYhYeKQrGrGK4QDGE)

 (image/gif)    
