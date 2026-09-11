Created by 胡威振, last modified on 六月 21, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_ClosestPoint函数的功能是：返回geom1上最接近geom2的2D点，这个点不一定是端点。这是从一个几何图形到另一个几何图形的最短直线的第一个点((由ST_ShortestLine计算))。
- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算，如果需要计算3D的场景，可以调用ST_3DClosestPoint函数。
- 如果计算结果是一个EMPTY，则返回null。
- 输入为null则返回null。


#   [2. Grammar（语法）](#2-grammar语法)  

```
geometry ST_ClosestPoint(geometry geom1, geometry geom2);

```

#   [3. Example（用例）](#3-example用例)  

```
select ST_AsText(ST_ClosestPoint(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY')));
 st_astext 
-----------
 
(1 row)

select ST_AsText(ST_ClosestPoint(ST_GeomFromText('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))')));
 st_astext  
------------
 POINT(0 0)
(1 row)


```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_ClosestPoint.html](https://postgis.net/docs/manual-3.3/ST_ClosestPoint.html)  