Created by 吕雷奇, last modified by  陈瑞 on 十二月 26, 2023

## 1.   **概述**

本文描述单机行存表list和range一级分区支持分区split；

## 2.   **需求分析**

本需求的开发设计：    [Split Partition - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Split+Partition)  

特性sr连接：    [YDBRD-13576](https://jira.yasdb.com/browse/YDBRD-13576?src=confmacro)    -  分区支持split  完成

本需求是在单机  行存表list和range一级分区支持分区split  。

支持功能

将range（interval）/list 分区重新划分未多个分区；

![](https://conf.yasdb.com/download/attachments/113971362/split_table_partition.GIF?version=1&modificationDate=1686282493000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgyNDYsImV4cCI6MTc4MjIxOTA0Nn0.Dfh1YeOhqnYm-1yL6Nt-lgYcgig4eQj0u6zrwKdCDWU)

功能限制：

1、hash分区不支持split分区；

2、组合分区不支持split分区；

3、update global indexes 为语法兼容，全局索引是一定失效的。update indexes时不会失效local索引但会失效global索引；

# **3. 详细测试方法**

3.1测试设计方法

1）单机需要关注语法；

2）功能需要覆盖和其他特性的交互，主要基于场景法和正交组合给出测试场景；

3.2DFX关联场景：

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

# **5.测试框架**

使用guider，ha_regress,一致性和testkill测试框架

# **6.测试环境**

本地测试环境，1台机器部署2实例；

# **7.工作量评估**

工作量：7人天

计划测试完成时间：

  


  


  


## Attachments:

[集群支持split分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWJhMWFkOWEzMzExZGM3ODQ0IiwicmVmX2lkIjoiNjczOTY5YWI1OTNmOTljOWZmMjM1MTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjQ2LCJleHAiOjE3ODIyOTQ2NDZ9.pAhNj3QijGcRaQE30rfTgI6-x2KAEIY_kqIpMnZhWtQ)

 (application/x-xmind)    


[image2023-11-7_9-36-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWI4OTcwYzJhZjRmNTFmOWNlIiwicmVmX2lkIjoiNjczOTY5YWI1OTNmOTljOWZmMjM1MTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjQ2LCJleHAiOjE3ODIyOTQ2NDZ9.w-91rVssHanNStA3Li6PExe12CuiRaHrNGXKJgD6If8)

 (image/png)    


[image2023-11-7_19-44-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWJhMWFkOWEzMzExZGM3ODQ1IiwicmVmX2lkIjoiNjczOTY5YWI1OTNmOTljOWZmMjM1MTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjQ2LCJleHAiOjE3ODIyOTQ2NDZ9.yKAXp83NrFI9jOKFWuD7WBbxGEHuD7OBBhfXCmniiRU)

 (image/png)    


[分区支持split.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YWI4OTcwYzJhZjRmNTFmOWNmIiwicmVmX2lkIjoiNjczOTY5YWI1OTNmOTljOWZmMjM1MTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MjQ2LCJleHAiOjE3ODIyOTQ2NDZ9.djyETQSbn5cVqfZWEwZR7vWt5qguq6ycJ6tYIsPU-lg)

 (application/x-xmind)    
