Created by 胡威振, last modified on 六月 30, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_LongestLine函数的功能是：返回两个几何图形上的点之间的二维最长LineString。返回的LineString开始于g1，结束于g2。
- 最长的LineString总是出现在两个顶点之间。如果找到多个，则返回第一个最长的LineString。LineString的长度等于ST_MaxDistance返回的距离。
- 如果geom1和geom2是相同的几何体，则返回几何体中相距最远的两个顶点之间的LineString。
- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 如果计算结果是一个EMPTY，则返回LINESTRING EMPTY，不会返回null。
- 输入为null则返回null。
- 实际上会先计算两个geometry的凸包，然后把凸包传给ST_LongestLine函数进行计算。即：ST_LongestLine(ST_ConvexHull(geom1), ST_ConvexHull(geom2));


#   [2. Grammer（语法）](#2-grammer语法)  

```
geometry ST_LongestLine(geom1 geometry, geom2 geometry);

```

- udf


```
create or replace function MDSYS.ST_LONGESTLINE(geom1 in ST_GEOMETRY, geom2 in ST_GEOMETRY) return ST_GEOMETRY is
    geom ST_GEOMETRY;
    head raw(40);
    ewkb blob;
begin
    SYS.GEOMETRY.ST_LONGESTLINE(geom1.head, geom1.geom, geom2.head, geom2.geom, head, ewkb);
    if ewkb is null then
        return null;
end if;
    geom := new ST_GEOMETRY(head, ewkb);
return geom;
end;
/

create or replace public synonym ST_LONGESTLINE for MDSYS.ST_LONGESTLINE
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomLongestLine()

```

#   [4.Details（详细设计）](#4details详细设计)  

- 计算过程与ST_MaxDistance相同，用最终结果生成LineString。


#   [5. Example（用例）](#5-example用例)  

```
SQL&gt; select ST_AsText(ST_LongestLine(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY'))) from dual;

ST_ASTEXT(ST_LONGEST                                             
---------------------------------------------------------------- 
LINESTRING EMPTY                                                

1 row fetched.

SQL&gt; 
SQL&gt; select ST_AsText(ST_LongestLine(ST_GeomFromText('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))'))) from dual;

ST_ASTEXT(ST_LONGEST                                             
---------------------------------------------------------------- 
LINESTRING (0.000000000000000 0.000000000000000, 2.000000000000000 0.000000000000000)

1 row fetched.


```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_LongestLine.html](https://postgis.net/docs/manual-3.3/ST_LongestLine.html)  