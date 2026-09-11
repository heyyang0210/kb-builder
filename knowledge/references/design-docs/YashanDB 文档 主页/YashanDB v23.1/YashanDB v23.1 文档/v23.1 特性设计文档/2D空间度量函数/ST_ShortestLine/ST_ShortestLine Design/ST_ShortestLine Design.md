Created by 胡威振, last modified on 六月 26, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_ShortestLine函数的功能是：返回两个几何图形之间的二维最短LineString，最短LineString的两个端点不一定是输入的几何图形的端点。
- 返回的LineString从geom1开始，以geom2结束。
- 如果geom1和geom2相交，则结果是一条以交点为起点和终点的直线。LineString长度与ST_Distance对g1和g2返回的长度相同。
- geom1与geom2的srid如果不同则报错。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 如果计算结果是一个EMPTY，则返回LINESTRING EMPTY，不会返回null。
- 输入为null则返回null。


#   [2. Grammer（语法）](#2-grammer语法)  

```
geometry ST_ShortestLine(geom1 geometry, geom2 geometry);

```

- udf


```
create or replace function MDSYS.ST_SHORTESTLINE(geom1 in ST_GEOMETRY, geom2 in ST_GEOMETRY) return ST_GEOMETRY is
    geom ST_GEOMETRY;
    head raw(40);
    ewkb blob;
begin
    SYS.GEOMETRY.ST_SHORTESTLINE(geom1.head, geom1.geom, geom2.head, geom2.geom, head, ewkb);
    if ewkb is null then
        return null;
end if;
    geom := new ST_GEOMETRY(head, ewkb);
return geom;
end;
/

create or replace public synonym ST_SHORTESTLINE for MDSYS.ST_SHORTESTLINE
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomShortestLine()

```

#   [4.Details（详细设计）](#4details详细设计)  

- 计算过过程与ST_ClosestPoint相同，只是最终需要用计算得到的两个点构造LineString。


#   [5. Example（用例）](#5-example用例)  

```
SQL&gt; select ST_AsText(ST_ShortestLine(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY'))) from dual;

ST_ASTEXT(ST_SHORTES                                             
---------------------------------------------------------------- 
LINESTRING EMPTY                                                

1 row fetched.

SQL&gt; select ST_AsText(ST_ShortestLine(ST_GeomFromText('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))'))) from dual;

ST_ASTEXT(ST_SHORTES                                             
---------------------------------------------------------------- 
LINESTRING (0.000000000000000 0.000000000000000, 0.000000000000000 0.000000000000000)

1 row fetched.


```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_ShortestLine.html](https://postgis.net/docs/manual-3.3/ST_ShortestLine.html)  