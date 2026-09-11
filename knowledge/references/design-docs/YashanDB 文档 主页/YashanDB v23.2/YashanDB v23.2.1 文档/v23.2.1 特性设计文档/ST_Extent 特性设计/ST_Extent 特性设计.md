Created by 胡威振, last modified on 十二月 15, 2023

#   [详细设计-YDBRD-22076: ST_Extent Design（ST_Extent 方案设计）](#详细设计-ydbrd-22076-st-extent-designst-extent-方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-20896](https://jira.yasdb.com/browse/YDBRD-20896)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-22076](https://jira.yasdb.com/browse/YDBRD-22076)  

##   [1. 总述](#1-总述)  

本文档设计了ST_Extent聚合函数的实现。

支持单机行执行。

###   [1.1 需求来源](#11-需求来源)  

深圳地铁

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=135617002](https://conf.yasdb.com/pages/viewpage.action?pageId=135617002)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|对于一个字段中的所有geometry取二维边界框|作为聚合函数逐个进行extent|是/否|是|
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
|ST_Extent|函数名称|是|  [https://postgis.net/docs/manual-3.3/ST_Extent.html](https://postgis.net/docs/manual-3.3/ST_Extent.html)  |
|Aggregate|聚合函数|是|  [https://postgis.net/docs/manual-3.3/ST_Extent.html](https://postgis.net/docs/manual-3.3/ST_Extent.html)  |
|BOX2D|数据类型|无|  [https://postgis.net/docs/manual-3.3/box2d_type.html](https://postgis.net/docs/manual-3.3/box2d_type.html)  |


###   [1.5 开源依赖](#15-开源依赖)  

该函数不依赖第三方库。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|select ST_Extent(geomfield)......|聚合函数，对geomfield字段中的geometry进行聚合|是|
|函数|BOX2D ST_Extent(geomfiled geometry)|聚合函数，对geomfield字段中的geometry进行聚合|是|


##   [3. 规格与约束](#3-规格与约束)  

- 新增BOX2D自定义数据类型，类型定义如下：


```
create or replace type MDSYS.BOX2D as object (
    xmin double,
    xmax double,
    ymin double,
    ymax double
)
/

create or replace public synonym BOX2D for MDSYS.BOX2D
/

```

- 该函数的功能是返回一个限定一组geometry的2D边界框，返回值类型为BOX2D。
- 只有输入的geometry全都为NULL或者全为EMPTY时，才会返回NULL。
- 该函数为2D函数，即使输入的坐标含有3D，也只会计算2D结果。
- 目前UDT不能作为group by列，所以不支持按照geomtry进行分组。
- 暂时不支持distinct。


##   [4. 特性](#4-特性)  

###   [4.1 ST_Extent聚合函数特性功能点](#41-st-extent聚合函数特性功能点)  

**执行流程描述：**

1. 获取gs1，如果gs1为NULL或者为EMPTY的话，本次执行结果跟上次聚合结果相同，直接返回即可。
1. 如果gs1不为NULL，则获取上次聚合结果。
1. 如果上次聚合结果为NULL，则gs1的box即为本次聚合结果。
1. 如果上次聚合结果不为NULL，则将gs1的box1与上次聚合结果的box2进行merge操作。
1. 将merge完之后的box作为本次聚合结果存储起来。
1. 聚合结束时返回最后一次聚合结果。


**流程图描述：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c25a1ad9a3311dc87f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzODIsImV4cCI6MTc4MjMxMDE4Mn0.QkDecxK_pWDi6TA5Tu4nDkMYze1rPPHzGU_GeBBIFLQ)

###   [4.3 特性性能点1](#43-特性性能点1)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

**1. NULL测试**

- 所有geometry都为NULL。
- 所有geometry都为EMPTY。
- EMPTY与非EMPTY的组合。


**2. 维度测试**

- 所有geometry都是2D。
- 所有geometry都是3D。
- 2D与3D混合。


**3. SRID测试**

- SRID相同场景。
- SRID不同场景。


**4. 类型测试**

- 参数都是相同的原子类型，都是Point或Polygon或LineString。
- 参数是混合的原子类型，Point、Polygon和LineString的组合。
- 参数包含Multi*类型。
- 参数包含Collection类型。


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2023-11-27_11-8-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjU4OTcwYzJhZjRmNTIwOTdmIiwicmVmX2lkIjoiNjczOTZjMjU3MjgyMDZlZmI5MmYwZTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MzgyLCJleHAiOjE3ODIzODU3ODJ9.q-T4Bulr_eNB3VXb3rtrsbg9degpbGMffHccuAV9ir8)

 (image/png)    


[未命名绘图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjVhMWFkOWEzMzExZGM4N2VlIiwicmVmX2lkIjoiNjczOTZjMjU3MjgyMDZlZmI5MmYwZTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MzgyLCJleHAiOjE3ODIzODU3ODJ9.uVwuX15kRaRc3m3tDzFYpvyLmq8F5s9pKQQtAOQkfq4)

 (image/png)    


[image2023-12-5_17-17-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjU4OTcwYzJhZjRmNTIwOTgwIiwicmVmX2lkIjoiNjczOTZjMjU3MjgyMDZlZmI5MmYwZTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MzgyLCJleHAiOjE3ODIzODU3ODJ9.qfhNADLNVlebe9eriLlOCqVFJARIpvaYToZvZgTsKu4)

 (image/png)    


[image2023-12-5_17-17-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjU4OTcwYzJhZjRmNTIwOTgxIiwicmVmX2lkIjoiNjczOTZjMjU3MjgyMDZlZmI5MmYwZTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MzgyLCJleHAiOjE3ODIzODU3ODJ9.3yhO8wqZGcfiolps4ruHW6gKT00FpWD9iLceQU28bso)

 (image/png)    


## Comments:

|  [](null)  ,Posted by huweizhen at 十二月 07, 2023 14:15|
|---|
|评审方案|ST_Extent函数设计文档|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/12/7 15:30-16:30|
|评审地点|腾讯会议|
|评审纪要信息|支持plugin的聚合函数，代码改动较大，需要多人检视。|
|评审是否通过|通过|


|评审方案|ST_Extent函数设计文档|
|---|---|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/12/7 15:30-16:30|
|评审地点|腾讯会议|
|评审纪要信息|支持plugin的聚合函数，代码改动较大，需要多人检视。|
|评审是否通过|通过|
