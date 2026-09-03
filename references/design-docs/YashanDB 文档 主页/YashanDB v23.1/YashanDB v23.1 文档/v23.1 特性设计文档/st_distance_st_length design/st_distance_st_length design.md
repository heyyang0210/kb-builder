Created by 叶显昊, last modified on 十月 15, 2024

#   [YDBRD-13292 : ST_Distance Design（ST_Distance方案设计）](#ydbrd-13292--st-distance-designst-distance方案设计)  

SR链接：    [YDBRD-13292](https://jira.yasdb.com/browse/YDBRD-13292)  

##   [1. Overview（概述）](#1-overview概述)  

本特性参考postgis中的ST_Distance函数——返回两个geometry参数的距离

###   [语法](#语法)  

```
double ST_Distance(geometry g1, geometry g2);

```

```
double ST_Length(geometry a_2dlinestring);

```

##   [2. Features（功能特性）](#2-features功能特性)  

- distance


|某个参数|另一个参数|设计表现|设计说明|
|---|---|---|---|
|geometry类型|合法输入|返回两个参数直线距离|预期行为|
|两个参数的SRID不同||报错|SRID不同，报错|
|合法类型，NULL|合法输入|返回NULL|计算中参数中有NULL则返回NULL|
|其它输入||报错|不支持的输入格式|


- length


|参数1|设计表现|设计说明|
|---|---|---|
|LineString, MultiLineString, LinearRing, srid为0或在spatial_ref_sys中|返回2D笛卡尔坐标长度或大地坐标长度|预期行为|
|srid不为0且不在spatial_ref_sys中|报错|预期之外的srid值|
|其它geometry|返回0|无效输入|
|合法类型，NULL|返回NULL|计算中参数中有NULL则返回NULL|
|其它输入|报错|不支持的输入格式|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
static YspiResult geomDistance(YspiHandle hExec);
static YspiResult geomLength(YspiHandle hExec);

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

与postgis相比，st_distance不支持3个参数的调用形式，st_length不支持2个参数的调用形式

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

distance

- 判断两边的srid是否相等，不相等报错
- 判断srid，不在spatial_ref_sys中报错（0除外）
- 对于点类型，计算距离同length
- 对于线类型，计算两个geometry的最近点，再按照点计算
- 对于polygon，多考虑包含的情况，其它与线一样


length

- 判断srid，不在spatial_ref_sys中报错（0除外）
- 判断geometry类型，不支持的类型返回0
- 根据srid是否是大地坐标计算对应的长度


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 计算的结果是否正确
- SRID不同是否按预期报错
- 对于空值是否按预期返回空
- 对于不支持的类型是否按预期报错


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*