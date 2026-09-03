Created by 胡威振, last modified on 十一月 08, 2023

  


#   [YDBRD-22074: ST_DWithin Design（ST_DWithin 方案设计）](#ydbrd-22074-st-dwithin-designst-dwithin-方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-20897](https://jira.yasdb.com/browse/YDBRD-20897)     / SR链接：     [https://jira.yasdb.com/browse/YDBRD-22074](https://jira.yasdb.com/browse/YDBRD-22074)  

##   [1. Overview（概述）](#1-overview概述)  

本文档设计了ST_DWithin函数的实现。

支持单机行执行。

调研文档：    [https://conf.yasdb.com/display/YAS/ST_DWithin+Analyse](https://conf.yasdb.com/display/YAS/ST_DWithin+Analyse)  

##   [2. Features（功能特性）](#2-features功能特性)  

- ST_DWithin函数的功能是判断两个geometry之间的距离是否在指定范围内，如果是，则返回true，否则返回false。
- geomA与geomB的SRID必须相同，否则报错。
- 如果输入存在NULL则返回NULL。
- 如果输入的distance<0，则报错。
- 该函数计算的是2D场景，但是会根据SRID区分经纬度坐标还是投影坐标进行计算。
- 该函数支持使用rtree索引。


##   [3. Interfaces（接口）](#3-interfaces接口)  

语法：

```
boolean ST_DWithin(geom1 geometry, geom2 geometry, distance in double);

```

SQL语法：

```
select ST_DWithin(geom1, geom2, distance) from table;

```

内部接口：

```
geomDWithin

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

与postgis的差别主要在于SRID是经纬度坐标时，我们不提供use_spheroid参数，统一按照椭球参考系进行计算。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

该函数的主要逻辑就是先计算geom1与geom2之间的距离，然后与distance进行比较，从而返回结果，计算距离的过程可以调用之前开发distance时写的接口。

执行流程：

- 首先获取distance参数，判断是否为NULL，如果distance为NULL，则直接返回NULL。
- 判断distance是否小于0，如果小于0则报错。
- 获取并判断geom1和geom2是否为NULL，如果为NULL，则返回NULL。
- 判断geom1与geom2的SRID是否相同，不相同则报错。
- 判断geom1和geom2是否存在EMPTY，如果存在，则返回false。
- 如果是经纬度坐标系，则调用piGeomGeodDistance接口计算geom1与geom2的距离，否则调用dist2DRecursive接口计算geom1与geom2的距离。
- 如果两个geometry之间的距离realDistance<=distance则返回true，否则返回false。


**RTree索引：**

主要思路是通过第三个参数，扩大rtree索引到的geometry的外包框（即xmin、ymin减小distance，xmax、ymax增大distance），然后用扩大之后的外包框与另外一个geometry的外包框进行关系判断，如果二者不相交，则说明两个geometry之间的距离肯定大于给定的distance，此时就可以直接返回false。

在gSpatialFunc中添加ST_DWithin，leftType为RTREE_INTERSECT，rightType为RTREE_INTERSECT，维度为2维。

新增__MAKE_RTREE_KEY3__内部接口，接收三个参数，用于处理ST_DWithin函数，在__MAKE_RTREE_KER3__执行的时候对外包框进行扩充。

![](https://pingcode.yasdb.com/atlas/files/public/67396c258970c2af4f52097e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkzNzIsImV4cCI6MTc4MjMxMDE3Mn0.0OZ9Aju_Et_zURP7XjI-xOQtfqcp1Vvk9KgLY2b_bwM)

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- NULL值测试，以及tolerance为负数。
- 输入的geometry类型覆盖Point、Linestring、Polygon、GeometryCollection之间的组合。
- 测试距离小于tolerance、等于tolerance、大于tolerance。
- 根据SRID测试经纬度坐标、投影坐标。
- 建立索引，ST_DWithin作为filter，并且其中一列有建立rtree index。
- 非法数据测试。


##   [7.资料设计章节](#7资料设计章节)  

无

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

无

## Attachments:

[image2023-11-7_18-20-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjU4OTcwYzJhZjRmNTIwOTdjIiwicmVmX2lkIjoiNjczOTZjMjU3MjgyMDZlZmI5MmYwZTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MzcyLCJleHAiOjE3ODIzODU3NzJ9.G3Xu2PW4WV1TK_B7mvhBuG04KSBMAdiLxRDIYK7T5Hk)

 (image/png)    


[image2023-11-7_18-20-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjVhMWFkOWEzMzExZGM4N2VjIiwicmVmX2lkIjoiNjczOTZjMjU3MjgyMDZlZmI5MmYwZTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MzcyLCJleHAiOjE3ODIzODU3NzJ9.Mq1jCikiPMMOAgGy_41OgWRKQ719lgTSsy__b1WgWGY)

 (image/png)    


## Comments:

|  [](null)  ,Posted by huweizhen at 十一月 08, 2023 11:45|
|---|
|评审方案|ST_DWithin函数设计文档|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/11/9 10:00-11:00|
|评审地点|腾讯会议|
|评审纪要信息|- ​__MAKE_RTREE_KEY3__扩大外包框时需要根据SRID进行区分，大地坐标与投影坐标扩大算法不同  。
- 扩大外包框时，对于投影坐标，如果超过FLT_MAX就用FLT_MAX而不是报错。
- 扩大外包框时，对于大地坐标，如果范围超过纬度，则用纬度最大值。
|
|评审是否通过|通过|


|评审方案|ST_DWithin函数设计文档|
|---|---|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/11/9 10:00-11:00|
|评审地点|腾讯会议|
|评审纪要信息|- ​__MAKE_RTREE_KEY3__扩大外包框时需要根据SRID进行区分，大地坐标与投影坐标扩大算法不同  。
- 扩大外包框时，对于投影坐标，如果超过FLT_MAX就用FLT_MAX而不是报错。
- 扩大外包框时，对于大地坐标，如果范围超过纬度，则用纬度最大值。
|
|评审是否通过|通过|
