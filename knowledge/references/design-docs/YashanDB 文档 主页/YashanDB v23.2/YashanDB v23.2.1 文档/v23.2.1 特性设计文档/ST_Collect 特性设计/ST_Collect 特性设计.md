Created by 胡威振, last modified on 十二月 15, 2023

#   [详细设计-YDBRD-22077: ST_Collect Design（ST_Collect 方案设计）](#详细设计-ydbrd-22077-st-collect-designst-collect-方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-20896](https://jira.yasdb.com/browse/YDBRD-20896)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-22077](https://jira.yasdb.com/browse/YDBRD-22077)  

##   [1. 总述](#1-总述)  

本文档设计了ST_Collect普通函数和聚合函数的实现。

支持单机行执行。

###   [1.1 需求来源](#11-需求来源)  

深圳地铁

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=135616799](https://conf.yasdb.com/pages/viewpage.action?pageId=135616799)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|对两个geometry进行collect操作|作为普通函数进行collect|是/否|是|
|功能|对于一个字段中的所有geometry进行collect操作|作为聚合函数逐个进行collect|是/否|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|ST_Collect|函数名称|是|  [https://postgis.net/docs/manual-3.3/ST_Collect.html](https://postgis.net/docs/manual-3.3/ST_Collect.html)  |
|聚合函数|聚合函数|是|  [https://postgis.net/docs/manual-3.3/ST_Collect.html](https://postgis.net/docs/manual-3.3/ST_Collect.html)  |


###   [1.5 开源依赖](#15-开源依赖)  

该函数不依赖第三方库。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|select ST_Collect(geom1, geom2)......|普通函数，聚合geom1和geom2|是|
|SQL语法|select ST_Collect(geomfield)......|聚合函数，对geomfield字段中的geometry进行聚合|是|
|函数|geometry ST_Collect(geom1 geometry, geom2 geometry)|普通函数，聚合geom1和geom2|是|
|函数|geometry ST_Collect(geomfiled geometry)|聚合函数，对geomfield字段中的geometry进行聚合|是|


##   [3. 规格与约束](#3-规格与约束)  

- 该函数的功能是根据输入的一组geometry生成一个GeometryCollection或者是Multi*的geometry，输入的geometry在输出的GeometryCollection中保持不变。
- 如果输入的geometry都是相同类型的geometry，则会返回Multi*的geometry，否则返回GeometryCollection。
- 只有输入的geometry全都为NULL时，才会返回NULL，对于聚合函数而言，当输入的参数为常量NULL时也会返回NULL。
- 该函数支持3D坐标。
- 如果输入的geometry的维度不同，则报错。
- 如果输入的geometry的SRID不同，则报错。
- 目前UDT不能作为group by列，所以不支持按照geomtry进行分组。
- 暂时不支持distinct。


##   [4. 特性](#4-特性)  

###   [4.1 ST_Collect普通函数特性功能](#41-st-collect普通函数特性功能)  

**执行流程描述：**

1. 获取gs1，判断gs1是否为NULL。
1. 如果gs1为NULL，获取gs2，判断gs2是否为NULL。


- gs2为NULL则返回NULL。
- gs2不为NULL则返回gs2。


1. 如果gs2不为NULL，获取gs2，判断gs2是否为NULL，如果gs2为NULL，则返回gs1。
1. 将gs1和gs2转成geometry。
1. 校验维度是否相同，不同则报错。
1. 校验SRID是否相同，不同则报错。
1. 创建结果集合collect，其elements为输入的geom1和geom2，elementNum为2。
1. 如果g1和g2的类型不同，则collect的最终类型是Collection。
1. 如果g1和g2的类型相同，并且g1和g2是Multi*或Collection，则collect的最终类型也是Collection。
1. 其他情况则可断定collect的类型是Multi*，具体是MultiPoint、MultiPolygon还是MultiLineString则根据g1进行判断。
1. collect的Box置为NULL，并返回collect。


**流程图描述：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c24a1ad9a3311dc87ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUlBQUFBQVFBQUFBQUFBQUFBQUFBQUFDQ0FBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUlBQUFFQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzMDcsImV4cCI6MTc4MjMxMDEwN30.U3IyOLn7R3OA91Nt9PlxAbRRBZ0oKcccUdYN8BpIlDQ)

###   [4.2 ST_Collect聚合函数特性功能点](#42-st-collect聚合函数特性功能点)  

**执行流程描述：**

1. 获取gs1，如果gs1为NULL的话，本次执行结果跟上次聚合结果相同，直接返回即可。
1. 如果gs1不为NULL，则获取上次聚合结果。
1. 如果上次聚合结果为NULL，则构造只含有gs1的collection，具体细节跟普通函数构造过程相同，只是此时只有一个元素。
1. 如果上次聚合结果不为NULL，则说明上次聚合结果已经产生了collection，此时需要向这个collection中添加gs1元素。
1. 添加过程中需要校验gs1与collection的维度、SRID是否相同，不相同则报错。
1. 扩充collection元素大小，增加gs1成员，如果collection类型不是GeometryCollection（有可能是Multi*），则判断collection与gs1对应的Multi*类型是否相同，不相同的话则collection的最终类型为GeometryCollection，否则不变。
1. 保留本次聚合结果。
1. 聚合结束时返回最后一次聚合结果。


**流程图描述：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c24a1ad9a3311dc87eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUlBQUFBQVFBQUFBQUFBQUFBQUFBQUFDQ0FBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUlBQUFFQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzMDcsImV4cCI6MTc4MjMxMDEwN30.U3IyOLn7R3OA91Nt9PlxAbRRBZ0oKcccUdYN8BpIlDQ)

###   [4.3 特性性能点1](#43-特性性能点1)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

**1. NULL测试**

- 其中一个参数为NULL。
- 两个参数都为NULL，对于聚合函数则是所有geometry都为NULL。


**2. 维度测试**

- 两个geometry都是2D，对于聚合函数则是所有geometry都是2D。
- 两个geometry都是3D，对于聚合函数则是所有geometry都是3D。
- 2D与3D混合，该场景应当报错。


**3. SRID测试**

- SRID相同场景。
- SRID不同场景，该场景报错。


**4. 类型测试**

- 参数都是相同的原子类型，都是Point或Polygon或LineString。
- 参数是混合的原子类型，Point、Polygon和LineString的组合。
- 参数包含Multi*类型。
- 参数包含Collection类型。


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

行执行group by需要进行物化，但是当前udt还不支持物化，所以目前没法使用group by。

迭代三已有需求在做udt支持group by     [https://jira.yasdb.com/browse/YDBRD-22986。](https://jira.yasdb.com/browse/YDBRD-22986%E3%80%82)  

## Attachments:

[image2023-11-27_11-10-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjNhMWFkOWEzMzExZGM4N2U5IiwicmVmX2lkIjoiNjczOTZjMjM1OTNmOTljOWZmMjM2YWNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MzA3LCJleHAiOjE3ODIzODU3MDd9.gnPO8ZOMh_NWM9owGFwc48C_BNxt4fyO8wrAkmg4FP0)

 (image/png)    


## Comments:

|  [](null)  ,Posted by huweizhen at 十二月 07, 2023 14:15|
|---|
|评审方案|ST_Collect函数设计文档|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/12/7 15:30-16:30|
|评审地点|腾讯会议|
|评审纪要信息|支持plugin的聚合函数，代码改动较大，需要多人检视。|
|评审是否通过|通过|


|评审方案|ST_Collect函数设计文档|
|---|---|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/12/7 15:30-16:30|
|评审地点|腾讯会议|
|评审纪要信息|支持plugin的聚合函数，代码改动较大，需要多人检视。|
|评审是否通过|通过|
