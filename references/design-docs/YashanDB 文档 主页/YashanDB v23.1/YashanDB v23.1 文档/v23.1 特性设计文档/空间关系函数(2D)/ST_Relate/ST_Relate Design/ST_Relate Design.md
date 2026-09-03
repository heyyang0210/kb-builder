Created by 胡威振, last modified on 五月 12, 2023

**SR链接：**    [YDBRD-13245](https://jira.yasdb.com/browse/YDBRD-13245?src=confmacro)    **-**  **支持空间关系函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- 功能：测试两个几何图形是否具有匹配交集矩阵模式的拓扑关系，或计算它们的交集矩阵。返回用于表示两个输入几何图形之间空间关系的DE-9IM矩阵字符串。可以使用ST_RelateMatch测试矩阵字符串是否匹配DE-9IM模式。该函数允许测试和评估两个geometry之间的空间(拓扑)关系，由    [Dimensionally Extended 9-Intersection Model](https://en.wikipedia.org/wiki/DE-9IM)    (DE-9IM)定义。
- 可选的规则是:1:OGC/MOD2, 2: Endpoint, 3: MultivalentEndpoint, 4: MonovalentEndpoint，默认值是1，支持隐式转换（四舍五入）， 输入其他值则报错。
- 只会计算2D的结果，如果输入的坐标是3D，则会忽略Z坐标继续计算。
- 如果输入存在null值，则返回null。
- 如果两个Geometry的SRID不同，则报错。
- 通过将交叉矩阵与交叉矩阵模式进行比较来评估特定类型的空间关系。每个空间关系对应一种类型的交叉矩阵模式。一个模式可以包括额外的符号“T”和“*”。常见的空间关系函数ST_Contains, st_covered, ST_CoveredBy, st_Crosses, ST_Disjoint, ST_Equals, ST_Intersects, ST_Overlaps, st_touched和ST_Within，这些函数在计算的时候会先计算出geomA与geomB的交叉矩阵，然后再与对应的模式进行匹配。
- 能够保证的精度是小数点后面15位，小数部分超出15位之后结果不保证。


#   [2. Grammer（语法）](#2-grammer语法)  

```
varchar ST_Relate(geomA geometry, geomB geometry, boundaryNodeRule in integer default 1)

```

- udf


```
create or replace function MDSYS.ST_RELATE(geom1 in ST_GEOMETRY, geom2 in ST_GEOMETRY, boundaryNodeRule in integer default 1) return varchar is
begin
return SYS.GEOMETRY.ST_RELATE(geom1.head, geom1.geom, geom2.head, geom2.geom, boundaryNodeRule);
end;
/

create or replace public synonym ST_RELATE for MDSYS.ST_RELATE
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeosGSRelate()
geomRelate()

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

```
调用主要通过调用 GEOSRelateBoundaryNodeRule_r()函数。

```

#   [5. Example（用例）](#5-example用例)  

```
SQL&gt; select id, geom_type, st_relate(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))')) from test_geom;

          ID GEOM_TYPE                         ST_RELATE(SHP,ST_GEO                                             
------------ --------------------------------- ---------------------------------------------------------------- 
           1 Point2D                           FF0FFF212                                                       
           2 Point3D                           FF0FFF212                                                       
           3 Point Z                           FF0FFF212                                                       
          11 LineString                        FF1FF0212                                                       
          12 LineString3D                      FF1FF0212                                                       
          21 Polygon Simple                    212101212                                                       
          22 Polygon with hole                 212101212                                                       
          23 Polygon 3D                        212101212                                                       
          31 LineRing                          FF1FFF212                                                       
          41 MultiPoint                        FF0FFF212                                                       
          42 MultiLineString                   101F00212                                                       
          43 MultiPolygon                      212FF1FF2                                                       
          51 Geometry Collection               1FFF0F212                                                       
          61 NULL                                                                                              

14 rows fetched.

SQL&gt; select st_relate(st_geomfromtext('point(1 1)'), st_geomfromtext('point(1 1)')) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
0FFFFFFF2                                                       

1 row fetched.


```

- 边界值规则


```
SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 1) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
10FFFF212                                                       

1 row fetched.

SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 1.1) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
10FFFF212                                                       

1 row fetched.

SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 1.6) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
1FFF0F212                                                       

1 row fetched.

SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 2) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
1FFF0F212                                                       

1 row fetched.

SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 3) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
10FFFF212                                                       

1 row fetched.

SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 4) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
10FFFF212                                                       

1 row fetched.

SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), -1) from dual;

YAS-07202 plugin execution error, Invalid boundary node rule -1

SQL&gt; select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 5) from dual;

YAS-07202 plugin execution error, Invalid boundary node rule 5


```

- 2D


```
SQL&gt; select st_relate(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 2 3)')) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
0FFFFFFF2                                                       

1 row fetched.

SQL&gt; select st_relate(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 2 4)')) from dual;

ST_RELATE(ST_GEOMFRO                                             
---------------------------------------------------------------- 
0FFFFFFF2                                                       

1 row fetched.


```

- Srid


```
SQL&gt; select st_relate(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 2 3)', 4329)) from dual;

YAS-07202 plugin execution error, Operation on mixed SRID geometries 0 != 4329

```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Relate.html](https://postgis.net/docs/manual-3.3/ST_Relate.html)  

  [https://en.wikipedia.org/wiki/DE-9IM](https://en.wikipedia.org/wiki/DE-9IM)  

**例如Contains关系的交叉矩阵模式如下，那么用ST_Relate(geomA, geomB)计算出来的交叉矩阵字符串如果与'T*****FF*'相匹配，则说明geomA和geomB是contains关系。**

![](https://pingcode.yasdb.com/atlas/files/public/67396b3d8970c2af4f5202eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFFQUFBQUFBQUFBQUlBQUFBQUFBQUFCQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIxODQsImV4cCI6MTc4MjMwMjk4NH0.vbk6Qqsoviwdn7ERP6gnTo9vACpN2-q3zW6Yi8Acmes)

## Attachments: