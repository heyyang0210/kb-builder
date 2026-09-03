Created by 孟麟, last modified on 十二月 18, 2023

# YDBRD-22185 测试概要设计

  [YDBRD-22185](https://jira.yasdb.com/browse/YDBRD-22185)    * *  *-*  * *  *支持sys_extract_utc函数*  * *  *验收中*

  [YDBRD-22656](https://jira.yasdb.com/browse/YDBRD-22656)    * *  *-*  * *  *支持sys_extract_utc函数*  * *  *开发中*

## 1. 需求概述

1、需求来源：22.2，市场-  华润数科；回合23.2

2、需求概述：函数功能是将  带有时区偏移或时区区域名称的日期时间值中提取 UTC（协调世界时间），如果未指定时区，则日期时间与会话时区关联

3、部署形态：主备(单机)行表、集群

## 2. 功能点

1、功能：

（1）语法图

![](https://pingcode.yasdb.com/atlas/files/public/67396b78a1ad9a3311dc8335/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQ2OTcsImV4cCI6MTc4MjMwNTQ5N30.-h0mOqgj3E-gxbP-RQBq2e_HNCKdmL6BqJJ9N16h4lU)

（2）函数入参和出参均为timestamp类型，null、''处理：报错

2、差异：无（当前崖山不支持时区），可以理解为输入时间均为北京时间（东八区，UTC+8）

## 3. 规格约束

1、当前崖山不支持时区，可以理解为输入时间均为北京时间（东八区，UTC+8）

## 4. 主要应用场景

1、应用场景：时间处理场景

2、关联特性：无

## 5. 概要测试设计

### 5.1 功能测试设计

1、功能设计：

（1）函数公共部分参考函数顶层设计

（2）需额外注意的测试点：覆盖特殊时间，转换后跨年、月和日的时间

（3）功能一致性：对齐oracle

2、拦截：分布式，单机列表拦截

### 5.2 DFX测试设计

1、专项覆盖：CT、KT

2、可测试性：已满足

## 6. 测试策略

|测试项|自动化|框架|详细|
|:---|:---|:---|:---|
|功能|是|yasft|1、函数公共,2、注意覆盖特殊时间，转换后跨年、月和日的时间,3、单机列表，分布式拦截|
|CT/KT|是|testkill|补充函数使用语句|


## 7. 后续关注(可选)

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

## Attachments: