Created by 胡威振, last modified on 十一月 08, 2023

  


#   [YDBRD-22074: ST_DWithin Research（ST_DWithin 特性调研）](#ydbrd-22074-st-dwithin-researchst-dwithin-特性调研)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-20897](https://jira.yasdb.com/browse/YDBRD-20897)     / SR链接：     [https://jira.yasdb.com/browse/YDBRD-22074](https://jira.yasdb.com/browse/YDBRD-22074)  

##   [1. Overview（概述）](#1-overview概述)  

本文档调研了postgis的ST_DWithin函数。

该函数的功能是判断两个几何图形是否在给定距离内。

参考文档：    [https://postgis.net/docs/manual-3.3/ST_DWithin.html](https://postgis.net/docs/manual-3.3/ST_DWithin.html)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 语法](#21-语法)  

```
boolean ST_DWithin(geometry g1, geometry g2, double precision distance_of_srid);

boolean ST_DWithin(geography gg1, geography gg2, double precision distance_meters, boolean use_spheroid = true);

```

###   [2.2 功能](#22-功能)  

**geometry**  ：

如果几何图形g1和g2在给定距离distance_of_srid内，则返回true，否则返回false。

  `distance_of_srid`    的单位是g1和g2的SRID的单位，类型是double。

**geography**  ：

如果地理几何图形gg1和gg2在给定距离distance_meters内，则返回true，否则返回false。

  `distance_meters`    的单位是meters，类型是double。

  `use_spheroid`    如果为true则表示计算的过程中使用的椭球参考系，如果为true则表示使用的是椭球参考系，这样计算的更精确，但效率会低一些，默认值是true。

###   [2.3 补充](#23-补充)  

- 如果输入的distance_of_srid<0，则报错。
- 输入存在NULL则返回NULL。
- geomA与geomB的SRID必须相同，否则报错。
- 如果其中一个geometry为空，则返回false。
- 计算的是2D场景，如果需要计算3D场景，可以调用ST_3DDWithin接口。
- postgis的核心计算逻辑与ST_Distance一样，先计算A与B的最小距离，然后与distance_of_srid进行比较。


###   [2.4 SQL举例](#24-sql举例)  

```
select st_dwithin(st_geomfromtext('point(0 0)', 4326), st_geomfromtext('point(3 4)', 4327), 1);
ERROR:  LWGEOM_dwithin: Operation on mixed SRID geometries (Point, 4326) != (Point, 4327)

select st_dwithin(st_geomfromtext('point(0 0)'), st_geomfromtext('point(3 4)'), -1);
ERROR:  Tolerance cannot be less than zero


select st_dwithin(st_geomfromtext('point(0 0)'), st_geomfromtext('point empty'), NULL);
 st_dwithin
------------

(1 row)

select st_distance(st_geomfromtext('point(0 0)'), st_geomfromtext('point(3 4)'));
 st_distance
-------------
           5

select st_dwithin(st_geomfromtext('point(0 0)'), st_geomfromtext('point(3 4)'), 4);
 st_dwithin
------------
 f

select st_dwithin(st_geomfromtext('point(0 0)'), st_geomfromtext('point(3 4)'), 5);
 st_dwithin
------------
 t

select st_dwithin(st_geomfromtext('point(0 0)'), st_geomfromtext('point empty'), 5);
 st_dwithin
------------
 f


```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

无

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

无