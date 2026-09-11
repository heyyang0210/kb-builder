Created by 程康, last modified on 一月 15, 2024

*IR*  *链接：YDBRD-22205*

*SR*  *链接：YDBRD-23312*

* *

##   [1. 总述](#1-总述)  

imp导入时支持覆盖已存在的表（truncate模式）

###   [1.1 需求来源](#11-需求来源)  

客户在imp导入时，希望可以覆盖已存在的表，不需要手动删除已存在的表再执行imp导入

###   [1.2 调研文档](#12-调研文档)  

Oracle 暂无类似功能

###   [1.3 需求分析](#13-需求分析)  

|**属性**|**场景名称**|**方案设计**|**关键技术点**|**特性是否涉及**|
|---|---|---|---|---|
|功能|导入支持truncate|增加参数控制此特性功能|否|是|
|性能|NA|NA|是/否|是/否|
|可用性|NA|----|是/否|是/否|
|可靠性|NA|----|是/否|是/否|
|可维可测|NA|----|是/否|是/否|
|安全|NA|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|NA|----|----|是/否|
|周边配合|NA|----|----|是/否|
|周边配合|导入导出工具|----|否|是|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

**不涉及**

  


  [1.5 开源依赖](#15-开源依赖)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

**不涉及**

##   [2. 接口](#2-接口)  

**列出从**  **SR**  **层级对外可以感知的特性，对应提供的接口、配置参数、**  **API**  **等。**   SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|**接口**|**接口表现**|**接口说明**|**是否涉及**|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|客户端可配置参数 TRUNCATE = Y or N|----|是|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

**说明从**  **SR**  **层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**   规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

**不涉及**

##   [4. 特性](#4-特性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c0ea1ad9a3311dc8765/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MzYsImV4cCI6MTc4MjMwOTYzNn0.QDn2Q4-CntZw12CoT5x23BTg942d5dkb4j7pfoa_bPU)

![](https://pingcode.yasdb.com/atlas/files/public/67396c0e8970c2af4f5208f7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MzYsImV4cCI6MTc4MjMwOTYzNn0.QDn2Q4-CntZw12CoT5x23BTg942d5dkb4j7pfoa_bPU)

###   [4.1 特性设计](#41-特性设计)  

  


客户端接受新参数   TRUNCATE  ，默认为  N  ，可选为  Y  或  N

导入数据时此参数生效，为Y则先  truncate  当前表，再进行数据导入，完成表数据覆盖功能。

参数生效前提为导入数据的情况下，即只导入数据或导入元数据  +  数据

 

**参数设置说明：**

**本选项用于处理导入过程中，当文件中需要导入的表已经存在时，设置TRUNCATE=Y，会先删除当前表中的数据，再从文件中导入数据。参数可省略，默认为N。**

  


**只有导入表数据时，此参数配置为Y可生效，仅导入元数据时，此参数配置不生效。注意：**

**-**  ** 只配置TRUNCATE=Y时，默认会设置IGNORE=Y，即如果元数据导入冲突则跳过继续执行导入表数据以及索引约束等。**

**-**  ** 配置TRUNCATE=Y，DATA_ONLY=Y，即只对表数据truncate后进行导入，跳过索引约束等。**

**-**  ** 配置TRUNCATE=Y，IGNORE=N，则返回错误。**

  


**使用此参数时，若需要导入的表存在外键约束，则可能truncate失败，此情况下会跳过失败的表继续后续导入操作。**

###   [4.2 特性功能点2](#42-特性功能点2)  

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

#仅导入表数据

imp sys/Cod-2022@127.0.0.1:1688 FILE=export.full.dump ROWS=Y DATA_ONLY=Y

imp sys/Cod-2022@127.0.0.1:1688 FILE=export.full.dump ROWS=Y DATA_ONLY=Y TRUNCATE=Y

#同时导入元数据及表数据

imp sys/Cod-2022@127.0.0.1:1688 FILE=export.full.dump ROWS=Y DATA_ONLY=N IGNORE=Y TRUNCATE=Y

imp sys/Cod-2022@127.0.0.1:1688 FILE=export.full.dump ROWS=Y DATA_ONLY=N IGNORE=Y TRUNCATE=N

imp sys/Cod-2022@127.0.0.1:1688 FILE=export.full.dump ROWS=Y DATA_ONLY=N 

imp sys/Cod-2022@127.0.0.1:1688 FILE=export.full.dump ROWS=Y DATA_ONLY=N TRUNCATE=Y

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments: