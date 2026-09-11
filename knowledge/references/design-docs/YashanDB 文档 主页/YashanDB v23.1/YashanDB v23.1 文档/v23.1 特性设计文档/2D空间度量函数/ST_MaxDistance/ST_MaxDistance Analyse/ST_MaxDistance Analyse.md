Created by 胡威振, last modified on 六月 19, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_MaxDistance 函数的功能是：以投影单位返回两个几何图形之间的二维最大距离。最大距离总是出现在两个顶点之间。这是ST_LongestLine返回的LineString长度。
- 如果g1和g2是相同的几何体，则返回该几何体中相距最远的两个顶点之间的距离。
- geom1与geom2的srid如果不同则报错。
- 如果输入的是Empty，则返回Null。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 输入为null则返回null。
- 实际上会先计算两个geometry的凸包，然后把凸包传给ST_MaxDistance函数进行计算。即：ST_MaxDiistance(ST_ConvexHull(geom1), ST_ConvexHull(geom2));


#   [2. Grammar（语法）](#2-grammar语法)  

```
float ST_MaxDistance(geometry g1, geometry g2);

```

#   [3. Example（用例）](#3-example用例)  

```
select ST_MaxDistance(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY'));
 st_maxdistance 
----------------
               
(1 row)

select ST_MaxDistance(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))'));
 st_maxdistance 
----------------
              2
(1 row)


```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_MaxDistance.html](https://postgis.net/docs/manual-3.3/ST_MaxDistance.html)  