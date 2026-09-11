Created by 胡威振, last modified on 十一月 09, 2023

  


#   [YDBRD-20897 : ST_ContainsProperly Design（ST_ContainsProperly 方案设计）](#ydbrd-20897--st-containsproperly-designst-containsproperly-方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-20897](https://jira.yasdb.com/browse/YDBRD-20897)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-22073](https://jira.yasdb.com/browse/YDBRD-22073)  

##   [1. Overview（概述）](#1-overview概述)  

本文档设计了ST_ContainsProperly的实现。

支持单机行执行。

调研文档：    [https://conf.yasdb.com/display/YAS/ST_ContainsProperly+Analyse](https://conf.yasdb.com/display/YAS/ST_ContainsProperly+Analyse)  

依赖于GEOS。

##   [2. Features（功能特性）](#2-features功能特性)  

- ST_ContainsProperly函数的功能是判断geomA是否完全包含geomB。如果geomB完全在geomA内部，则返回true，否则返回false。
- geomA与geomB的SRID必须相同，否则报错。
- 输入存在NULL则返回NULL。
- 如果其中一个geometry为EMPTY，则返回false。
- 该函数计算的是2D场景。
- 该函数支持使用rtree索引。


##   [3. Interfaces（接口）](#3-interfaces接口)  

语法：

```
boolean ST_ContainsProperly(geom1 geometry, geom2 geometry);

```

SQL语法：

```
select ST_ContainsProperly(geom1, geom2) from table;

```

内部接口：

```
geomContainsProperly

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

无

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

该函数主要是调用GEOS库的GEOSPreparedContainsProperly_r和GEOSRelatePattern_r接口。

执行流程：

- 判断输入的geom1和geom2是否存在null，如果存在，则返回null。
- 判断geom1与geom2的SRID是否相同，不同则报错。
- 统一调用GEOSPreparedContainsProperly_r接口。


**RTree索引**  ：在gSpatialFunc中添加ST_ContainsProperly，leftType为RTREE_INCLUDEIN，rightType为RTREE_INCLUDE，维度为2维。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

尽量测到每一个分支。

- NULL值测试。
- 输入的两个参数都是非常量、存在常量、都是非常量。
- 输入的geometry类型覆盖Point、Linestring、Polygon、GeometryCollection之间的组合。
- 边界值测试，geomB与geomA的边界相交，对比contains和containsproperly的结果。
- 建立索引，ST_ContainsProperly作为filter，并且其中一列有建立rtree index。
- 非法数据测试。


##   [7.资料设计章节](#7资料设计章节)  

无

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

无

## Comments:

|  [](null)  ,Posted by huweizhen at 十一月 08, 2023 11:45|
|---|
|评审方案|ST_DWithin函数设计文档|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/11/9 10:00-11:00|
|评审地点|腾讯会议|
|评审纪要信息|不调用  GEOSRelatePattern_r接口，统一调用GEOSPreparedContainsProperly_r接口。|
|评审是否通过|通过|


|评审方案|ST_DWithin函数设计文档|
|---|---|
|与会人|张鹏飞、胡威振、张欣、李美娥|
|评审时间|2023/11/9 10:00-11:00|
|评审地点|腾讯会议|
|评审纪要信息|不调用  GEOSRelatePattern_r接口，统一调用GEOSPreparedContainsProperly_r接口。|
|评审是否通过|通过|
