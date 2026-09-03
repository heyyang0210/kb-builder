Created by 高亚宁, last modified on 十月 10, 2024

# 1. 概述

-   [1. 概述](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-1.概述)  
-   [2. 需求分析](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-2.需求分析)  
    -   [2.1 功能点分析](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-2.2应用场景)  
    -   [2.3 规格约束](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-2.3规格约束)  
-   [3. 详细测试设计](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-3.1测试设计方法)  
    -   [3.2 系统级DFX分类](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-3.2系统级DFX分类)  
    -   [3.3 详细测试设计](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-3.3详细测试设计)  
-   [4. 测试用例](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-4.测试用例)  
-   [5. 测试框架设计](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-6.测试环境说明)  
-   [7. 工作量评估](#id-【YDBRD33388】Ystream解析DDL附加主键信息测试设计-7.工作量评估)  


目前DDL的附加日志里只包含object id和sql语句，不包含更详细的元素描述，比如主键信息等。如果要获取DDL的详细元素信息，就必须解析SQL语句，代价较高，并且某些场景信息页无法获得，比如默认的主键约束名称。

如果在DDL附加日志里添加主键相关的信息，则可以简单快速获得这条DDL的主键信息。

![](https://pingcode.yasdb.com/atlas/files/public/67396dfda1ad9a3311dc94a6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBUUFBQUNBQUFBQUFBQVFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMzNjksImV4cCI6MTc4MjMyNDE2OX0._ZKZ0C-oQdhNmAN-kqefMdJydTasL3OhqdUNWHr5AdQ)

# 2. 需求分析

## 2.1 功能点分析

  [https://pingcode.yasdb.com/pjm/items/67048997e489dd0868f15411](https://pingcode.yasdb.com/pjm/items/67048997e489dd0868f15411)    ?    
  #YDBRD-33388 Ystream解析DDL附加主键信息

开发设计方案：    [Ystream解析DDL附加主键信息 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167179782)  

需求来源：    
  YDS能同步主键的更新需求

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|DDL带主键变更|将主键信息组装成json字符串，写入redo日志，有YStream解析成字符串,主键json格式：,{,  name=主键约束名,   // drop主键的DDL如果不带约束名时，该值为空字符串,  action=ADD|DROP|ENABLE|DISABLE,,  disable=false,,  columnNames=[主键列名数组],  // add主键时，不为空,  keepIndex=null,,  dropIndex=null,}|是|是|


## 2.2 应用场景

1. 主键更新


## 2.3 规格约束

**规格：**

1. 支持CREATE TABLE，ALTER TABLE针对主键的add，drop，enable操作的记录
1. add 主键时会记录主键约束名


**约束：**

1. drop column的同时删除主键不会记录主键drop信息


# 3. 详细测试设计

## 3.1 测试设计方法

使用场景法，覆盖主键的所有操作，查看ystream的解析结果中是否有关于主机的附加信息，以及附加信息是否正确

## 3.2 系统级DFX分类

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|否，YDS设计中，暂不涉及|
|安全|  
|
|DFR（故障）|  
|
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|否，  转测功能不涉及该模块修改|
|兼容性|  
|
|资料|是|


## 3.3 详细测试设计

覆盖heap和lsc表

|  
|测试场景|用例详细描述|预期|
|:---|:---|:---|:---|
|1|建表带主键的DDL|create table 带主键约束：行内行外|会记录附加信息|
|2|建表后添加/删除  主键|alter table add/drop constraint,alter table add/drop column带主键约束|会记录附加信息（除drop column）|
|3|modify|alter table modify column（普通列改成主键列，主键列改普通列）|会记录附加信息|
|4|enable主键|alter table disable/enable constarint|会记录附加信息|
|5|validate主键|![](https://pingcode.yasdb.com/atlas/files/public/67396dfda1ad9a3311dc94a7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBUUFBQUNBQUFBQUFBQVFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTMzNjksImV4cCI6MTc4MjMyNDE2OX0._ZKZ0C-oQdhNmAN-kqefMdJydTasL3OhqdUNWHr5AdQ)|不会记录附加信息|
|6|using index 普通索引升级成主键索引||会记录附加信息|
|7|如果列上是先创建了普通索引，再去加主键，就会强制把索引征用为主键索引||会记录附加信息|


# 4. 测试用例

# 5. 测试框架设计

使用ha_regress框架自动化

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|部署|  
|
|操作系统|Linux|


# 7. 工作量评估

总计3人天：

测试调研+测试设计+评审：1人天

测试执行：1人天

上车+问题单回归+CI分析+资料测试：1人天

计划测试完成时间：10.11

## Attachments:

[Ystream测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmNhMWFkOWEzMzExZGM5NGEzIiwicmVmX2lkIjoiNjczOTZkZmI1OTNmOTljOWZmMjM4MTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMzY5LCJleHAiOjE3ODIzOTk3Njl9.1Slerpjss-AsZ0KrtmJ-LyNAdedLon4C57QwCwljmas)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-5-6_11-19-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmNhMWFkOWEzMzExZGM5NGE0IiwicmVmX2lkIjoiNjczOTZkZmI1OTNmOTljOWZmMjM4MTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMzY5LCJleHAiOjE3ODIzOTk3Njl9.OczmyaJuiagrXAh3Wl5Y01d-mTuj8X7TvJpGQTVI_5Y)

 (image/png)    


[数据库级附加日志用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmM4OTcwYzJhZjRmNTIxNjMwIiwicmVmX2lkIjoiNjczOTZkZmI1OTNmOTljOWZmMjM4MTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMzY5LCJleHAiOjE3ODIzOTk3Njl9.vFV04VkObEYrSBeJGnXvG1SmW-ue-2iczaPqBFeYCRQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-11-7_17-11-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmNhMWFkOWEzMzExZGM5NGE1IiwicmVmX2lkIjoiNjczOTZkZmI1OTNmOTljOWZmMjM4MTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMzY5LCJleHAiOjE3ODIzOTk3Njl9.QG1bUoMI2Km13AcYmeikPjiOMIJaJnp1zCwYAck-KLw)

 (image/png)    
