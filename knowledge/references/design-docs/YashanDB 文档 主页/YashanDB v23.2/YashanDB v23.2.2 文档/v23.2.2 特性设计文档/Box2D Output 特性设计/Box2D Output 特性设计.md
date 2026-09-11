Created by 胡威振, last modified on 四月 11, 2024

#   [详细设计-YDBRD-26076: Box2D Output Design（Box2D Output 方案设计）](#详细设计-ydbrd-26076-box2d-output-designbox2d-output-方案设计)  

IR链接：

SR链接：    [https://pingcode.yasdb.com/pjm/items/66175572fd997db58ad736d6](https://pingcode.yasdb.com/pjm/items/66175572fd997db58ad736d6)    ?

##   [1. 总述](#1-总述)  

本文档设计了ST_AsText、ST_AsBinary、ST_AsEwkb、ST_AsHexEwkb支持Box2D参数的实现。

支持单机行执行。

###   [1.1 需求来源](#11-需求来源)  

超图

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=150603959](https://conf.yasdb.com/pages/viewpage.action?pageId=150603959)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|将Box2D输出成WKT|将转换好的geometry输出成WKT|将Box2D转成Geometry|是|
|功能|将Box2D输出成WKB|将转换好的geometry输出成WKB|将Box2D转成Geometry|是|
|功能|将Box2D输出成EWKB|将转换好的geometry输出成EWKB|将Box2D转成Geometry|是|
|功能|将Box2D输出成HEXEWKB|将转换好的geometry输出成HEXEWKB|将Box2D转成Geometry|是|
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

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|ST_AsText|输出函数|是|  [https://postgis.net/docs/manual-3.3/ST_AsText.html](https://postgis.net/docs/manual-3.3/ST_AsText.html)  |
|ST_AsBinary|输出函数|是|  [https://postgis.net/docs/manual-3.3/ST_AsBinary.html](https://postgis.net/docs/manual-3.3/ST_AsBinary.html)  |
|ST_AsEwkb|输出函数|是|  [https://postgis.net/docs/manual-3.3/ST_AsEWKB.html](https://postgis.net/docs/manual-3.3/ST_AsEWKB.html)  |
|ST_AsHexEwkb|输出函数|是|  [https://postgis.net/docs/manual-3.3/ST_AsHEXEWKB.html](https://postgis.net/docs/manual-3.3/ST_AsHEXEWKB.html)  |
|Box2D|数据类型|是|  [https://postgis.net/docs/manual-3.3/box2d_type.html](https://postgis.net/docs/manual-3.3/box2d_type.html)  |


###   [1.5 开源依赖](#15-开源依赖)  

该函数不依赖第三方库。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|Select ST_AsText(box2dArg, [precision])......|将Box2D参数输出成WKT|是|
|SQL语法|Select ST_AsBinary(box2dArg, [byteOrder])......|将Box2D参数输出成WKB|是|
|SQL语法|Select ST_AsEwkb(box2dArg, [byteOrder])......|将Box2D参数输出成EWKB|是|
|SQL语法|Select ST_AsHexEwkb(box2dArg, [byteOrder])......|将Box2D参数输出成HexEWKB|是|
|函数|Clob ST_AsText(box box2d, precision int default 15)|----|是|
|函数|Blob ST_AsBinary(box box2d, byteOrder string default 'None')|----|是|
|函数|Blob ST_AsEwkb(box box2d, byteOrder string default 'None')|----|是|
|函数|Clob ST_AsHexEwkb(box box2d, byteOrder string default 'None')|----|是|


##   [3. 规格与约束](#3-规格与约束)  

1.ST_AsText、ST_AsBinary、ST_AsEwkb、ST_AsHexEwkb函数，除了入参将geometry换成了box2D之外，其他规格都不变。

2.Box2D转换成Geometry的规则：

- 如果Box2D是一个点，也就是xmin = xmax，ymin = ymax，这种情况会将Box2D转换成一个Point。
- 如果Box2D是一个水平线或者垂线，也就是xmin = xmax && ymin != ymax，ymin = ymax && xmin != xmax，这种情况会返将Box2D转换成一个LineString。
- 对于其他情况，也就是Box2D是一个矩形的情况，会将Box2D转换成一个Polygon。
- 生成的geometry的Srid为0。


##   [4. 特性](#4-特性)  

###   [4.1 ST_AsText（box2d）函数特性功能](#41-st-astextbox2d函数特性功能)  

**执行流程描述：**

1.获取precision参数，如果为NULL则返回NULL，如果大于16，则取16，如果小于等于0，则取0，否则取输入的值（与之前的ST_AsText、ST_AsBinary、ST_AsEWKB处理过程相同，对于后面两个函数则是获取byteOrder参数）。

2.获取boxArg参数，如果为NULL则直接返回NULL。

3.根据boxArg参数的数据生成对应的Geometry(sird为0)。

- 如果Box2D是一个点，也就是xmin = xmax，ymin = ymax，这种情况会将Box2D转换成一个Point。
- 如果Box2D是一个水平线或者垂线，也就是xmin = xmax && ymin != ymax，ymin = ymax && xmin != xmax，这种情况会返将Box2D转换成一个LineString。
- 对于其他情况，也就是Box2D是一个矩形的情况，会将Box2D转换成一个Polygon。


4.将生成的Geometry通过geos库输出成wkt/wkb/ewkb/hexewkb。

###   [4.2 特性性能点1](#42-特性性能点1)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

**1. NULL测试**

- 其中一个参数为NULL。
- 两个参数都为NULL，对于聚合函数则是所有geometry都为NULL。


**2. 类型测试**

- box2d是一个Point的情况。
- box2d是一个LineString的情况。
- box2d是一个Polygon的情况。


**3. 函数嵌套**

- 与ST_Extent函数的嵌套。


##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2023-11-27_11-8-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzA4OTcwYzJhZjRmNTIwZTJjIiwicmVmX2lkIjoiNjczOTZjYzA3MjgyMDZlZmI5MmYxNjZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMjE2LCJleHAiOjE3ODIzODk2MTZ9.2ZN4uI_kOG3Rp6WQffqzCmr_dXOvGwVnxMlNLqZII8U)

 (image/png)    


[未命名绘图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzBhMWFkOWEzMzExZGM4YzljIiwicmVmX2lkIjoiNjczOTZjYzA3MjgyMDZlZmI5MmYxNjZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMjE2LCJleHAiOjE3ODIzODk2MTZ9.aDYKGggGCbdM5aHQIOhcDFNU6KmsV96DAAJhYcD3kzg)

 (image/png)    


## Comments:

|  [](null)  ,Posted by huweizhen at 四月 09, 2024 15:03|
|---|
|评审方案|Box2D Output函数设计文档|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2024/4/12  10:00-10:30|
|评审地点|腾讯会议|
|评审纪要信息|无|
|评审是否通过|通过|


|评审方案|Box2D Output函数设计文档|
|:---|:---|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2024/4/12  10:00-10:30|
|评审地点|腾讯会议|
|评审纪要信息|无|
|评审是否通过|通过|
