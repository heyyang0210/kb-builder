Created by 胡威振, last modified on 六月 21, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_ShortestLine函数的功能是：返回两个几何图形之间的二维最短LineString，最短LineString的两个端点不一定是输入的几何图形的端点。
- 返回的LineString从geom1开始，以geom2结束。
- 如果geom1和geom2相交，则结果是一条以交点为起点和终点的直线。LineString长度与ST_Distance对g1和g2返回的长度相同。
- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 如果计算结果是一个EMPTY，则返回null。
- 输入为null则返回null。


#   [2. Grammar（语法）](#2-grammar语法)  

```
geometry ST_ShortestLine(geometry geom1, geometry geom2);

```

#   [3. Example（用例）](#3-example用例)  

```
select ST_AsText(ST_ShortestLine(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY')));
 st_astext 
-----------
 
(1 row)

select ST_AsText(ST_ShortestLine(ST_GeomFromText('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))')));
      st_astext      
---------------------
 LINESTRING(0 0,0 0)
(1 row)


```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_ShortestLine.html](https://postgis.net/docs/manual-3.3/ST_ShortestLine.html)  