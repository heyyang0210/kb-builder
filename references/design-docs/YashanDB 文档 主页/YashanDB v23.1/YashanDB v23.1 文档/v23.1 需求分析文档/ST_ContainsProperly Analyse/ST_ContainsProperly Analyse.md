Created by 胡威振, last modified on 十一月 08, 2023

  


#   [YDBRD-22073: ST_ContainsProperly Research（ST_ContainsProperly 特性调研）](#ydbrd-22073-st-containsproperly-researchst-containsproperly-特性调研)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-20897](https://jira.yasdb.com/browse/YDBRD-20897)     / SR链接：    [https://jira.yasdb.com/browse/YDBRD-22073](https://jira.yasdb.com/browse/YDBRD-22073)  

##   [1. Overview（概述）](#1-overview概述)  

本文档调研了postgis的ST_ContainsProperly函数。

该函数的功能是判断geomB是否与geomA的内部相交，但不与边界或外部相交，即geomB中每个点都在geomA内部（geomA完全包含geomB）。

参考文档：    [https://postgis.net/docs/manual-3.3/ST_ContainsProperly.html](https://postgis.net/docs/manual-3.3/ST_ContainsProperly.html)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 语法](#21-语法)  

```
boolean ST_ContainsProperly(geometry geomA, geometry geomB);

```

###   [2.2 功能](#22-功能)  

如果geomB与geomA的内部相交，但不与边界或外部相交，则返回true，否则返回false。

###   [2.3 补充](#23-补充)  

- geomA与geomB的SRID必须相同，否则报错。
- 输入存在NULL则返回NULL。
- 如果其中一个geometry为EMPTY，则返回false。
- ST_ContainsProperly与ST_Contains的区别举例：ST_ContainsProperly(A, A)=false, ST_Contains(A, A)=true。
- 两个几何图形的DE-9IM相交矩阵匹配ST_Relate中使用的[T**FF*FF*]，即ST_Relate(A, B)匹配T**FF*FF* 等价于 ST_ContainsProperly(A, B)=true。
- 该函数会使用空间索引，postgis中的实现有两种路径，一种是调用GEOS库的GEOSPreparedContainsProperly接口，另一种就是不能调用GEOSPreparedContainsProperly接口时，会调用GEOSRelatePattern接口与[T**FF*FF*]进行匹配。
- _ST_ContainsProperly是不走索引的函数接口。
- 计算的是2D场景。


###   [2.4 SQL举例](#24-sql举例)  

```

select st_containsproperly(st_geomfromtext('polygon((0 0, 4 0, 4 4, 0 4, 0 0))', 4326), st_geomfromtext('point(3 4)', 4327));
ERROR:  containsproperly: Operation on mixed SRID geometries (Polygon, 4326) != (Point, 4327)

select st_contains(st_geomfromtext('polygon((0 0, 4 0, 4 4, 0 4, 0 0))'), st_geomfromtext('linestring(3 3, 4 4)'));
 st_contains
-------------
 t

select st_containsproperly(st_geomfromtext('polygon((0 0, 4 0, 4 4, 0 4, 0 0))'), st_geomfromtext('linestring(3 3, 4 4)'));
 st_containsproperly
---------------------
 f


```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

依赖第三方库GEOS，GEOS只有GEOSPreparedContainsProperly和GEOSPreparedContainsProperly_r接口，所以其他情况postgis调用了GEOS的GEOSRelatePattern接口。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

无