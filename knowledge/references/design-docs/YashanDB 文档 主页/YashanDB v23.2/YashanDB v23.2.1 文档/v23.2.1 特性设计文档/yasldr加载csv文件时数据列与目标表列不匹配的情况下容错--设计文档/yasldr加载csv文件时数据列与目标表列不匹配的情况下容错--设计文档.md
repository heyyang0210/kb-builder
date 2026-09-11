Created by 程康, last modified by  贺国锋 on 一月 10, 2024

*IR链接：*    [YDBRD-23322](https://jira.yasdb.com/browse/YDBRD-23322)  

*SR链接：br22.2:   *    [YDBRD-23771](https://jira.yasdb.com/browse/YDBRD-23771)  

               master：    [YDBRD-23774](https://jira.yasdb.com/browse/YDBRD-23774)  

##   [1. 总述](#1-总述)  

yasldr加载csv文件时数据列与目标表列不匹配的情况下容错

###   [1.1 需求来源](#11-需求来源)  

  
  使用yasldr加载csv文件时，数据列与目标表列不匹配的情况下会报错

###   [1.2 调研文档](#12-调研文档)  

  [yasldr加载csv文件时数据列与目标表列不匹配的情况下容错--调研文档 - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141567507)  

###   [1.3 需求分析](#13-需求分析)  

客户希望可以支持trailing nullcols选项，可以做到：

1、csv比表多字段，多的字段被忽略

2、csv比表少字段，只加载csv包含的字段

###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|**术语**|**描述**|**借鉴业界**|**参考**|
|---|---|---|---|
|trailing nullcols|描述|是|load data使用此参数名     [YashanDB Doc](https://doc.yashandb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/LOAD%20DATA.html#trailing-nullcols)  |


###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

|**接口**|**接口表现**|**接口说明**|**是否涉及**|
|---|---|---|---|
|配置参数|trailing nullcols|可配置在ctl文件中，用于适配csv文件列少于数据表列的情况|是|


##   [3. 规格与约束](#3-规格与约束)  

1、source文件列多于表列   多的字段被忽略

2、source文件列少于表列 只包含csv字段

     2.1 少的列可为null 插入null

     2.2 少的列不可为null 跳过，日志记录原因

3、lob类型 

![](https://pingcode.yasdb.com/atlas/files/public/67396c32a1ad9a3311dc8863/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCRUFBQUFBQUJBQUFFQUFBQUFBQUFBQUFBQUFBQVFJQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUlBQUFBQUFBQ0FRQUFnQUFBQUFJQUFBQUFBUUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUNBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2NTIsImV4cCI6MTc4MjMxMDQ1Mn0.m-4BA_h9F78SlAjggxUTYED0zbTv3kkud6F8epHBdWg)

4、导入多张表 暂不支持 

5、多个文件导入  22.2 暂不支持 ， master支持

6、按照节点拆分   br22.2暂不支持，master支持

##   [4. 特性](#4-特性)  

流程图：

![](https://pingcode.yasdb.com/atlas/files/public/67396c32a1ad9a3311dc8864/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCRUFBQUFBQUJBQUFFQUFBQUFBQUFBQUFBQUFBQVFJQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUlBQUFBQUFBQ0FRQUFnQUFBQUFJQUFBQUFBUUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUNBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2NTIsImV4cCI6MTc4MjMxMDQ1Mn0.m-4BA_h9F78SlAjggxUTYED0zbTv3kkud6F8epHBdWg)

![](https://pingcode.yasdb.com/atlas/files/public/67396c328970c2af4f5209f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCRUFBQUFBQUJBQUFFQUFBQUFBQUFBQUFBQUFBQVFJQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUlBQUFBQUFBQ0FRQUFnQUFBQUFJQUFBQUFBUUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUNBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2NTIsImV4cCI6MTc4MjMxMDQ1Mn0.m-4BA_h9F78SlAjggxUTYED0zbTv3kkud6F8epHBdWg)

###   [4.1 特性设计](#41-特性设计)  

1、csv比表多字段，多的字段被忽略 — 目前天然支持

2、csv比表少字段，只加载csv包含的字段

        识别ctl的参数配置 —》开启trailing nullcols的功能 —》容错处理兼容  

###   [4.2 特性功能点2](#42-特性功能点2)  

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

** 不涉及**

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1、csv文件列少于表列 

     1.1 少的列可为null

打开参数：插入null

不打开参数： 跳过，日志记录原因

     1.2 少的列不可为null

打开参数 与否 ：跳过，日志记录原因

2、csv文件列多于表列 ：  多的字段被忽略

3、lob类型验证

4、控制文件方式和直接语句方式 均支持

  


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

适配此部分资料

![](https://pingcode.yasdb.com/atlas/files/public/67396c32a1ad9a3311dc8865/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCRUFBQUFBQUJBQUFFQUFBQUFBQUFBQUFBQUFBQVFJQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUJBQUFBQUlBQUFBQUFBQ0FRQUFnQUFBQUFJQUFBQUFBUUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUNBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk2NTIsImV4cCI6MTc4MjMxMDQ1Mn0.m-4BA_h9F78SlAjggxUTYED0zbTv3kkud6F8epHBdWg)

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-1-4_15-0-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzE4OTcwYzJhZjRmNTIwOWYyIiwicmVmX2lkIjoiNjczOTZjMzE1OTNmOTljOWZmMjM2YmE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NjUxLCJleHAiOjE3ODIzODYwNTF9.FJNo2kertqaojPFuRIp3s4YdgyDQ0Ur4-q7uCTxCD-g)

 (image/png)    
