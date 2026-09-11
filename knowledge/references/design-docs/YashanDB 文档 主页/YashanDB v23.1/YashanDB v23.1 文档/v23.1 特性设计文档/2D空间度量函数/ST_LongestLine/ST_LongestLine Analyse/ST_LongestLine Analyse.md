Created by 胡威振, last modified on 六月 25, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_LongestLine函数的功能是：返回两个几何图形上的点之间的二维最长LineString。返回的LineString开始于g1，结束于g2。
- 最长的LineString总是出现在两个顶点之间。如果找到多个，则返回第一个最长的LineString。LineString的长度等于ST_MaxDistance返回的距离。
- 如果g1和g2是相同的几何体，则返回几何体中相距最远的两个顶点之间的LineString。这是一个由ST_MinimumBoundingCircle计算的圆的直径。
- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 如果计算结果是一个EMPTY，则返回null。
- 输入为null则返回null。
- 实际上会先计算两个geometry的凸包，然后把凸包传给ST_LongestLine函数进行计算。即：ST_LongestLine(ST_ConvexHull(geom1), ST_ConvexHull(geom2));


#   [2. Grammar（语法）](#2-grammar语法)  

```
geometry ST_LongestLine(geometry geom1, geometry geom2);

```

#   [3. Example（用例）](#3-example用例)  

```
select ST_AsText(ST_LongestLine(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY')));
 st_astext 
-----------
 
(1 row)

select ST_AsText(ST_LongestLine(ST_GeomFromText('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))')));
      st_astext      
---------------------
 LINESTRING(0 0,2 0)
(1 row)


```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_LongestLine.html](https://postgis.net/docs/manual-3.3/ST_LongestLine.html)  