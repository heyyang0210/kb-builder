Created by 胡威振, last modified on 四月 25, 2023

**SR链接：**    [YDBRD-13245](https://jira.yasdb.com/browse/YDBRD-13245?src=confmacro)    **-**  **支持空间关系函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- 这些函数是用来测试和评估两个Geometry之间的空间(拓扑)关系，由    [Dimensionally Extended 9-Intersection Model](https://en.wikipedia.org/wiki/DE-9IM)    (DE-9IM)定义。
- DE-9IM被指定为一个9元素矩阵，表示两个几何图形的内部、边界和外部之间的交点的尺寸。它由9个字符的文本字符串表示，使用符号'F'， '0'， '1'， '2'(例如。“FF1FF0102”)。
- 通过将交叉矩阵与交叉矩阵模式进行比较来评估特定类型的空间关系。一个模式可以包括额外的符号“T”和“*”。常见的空间关系是由命名函数ST_Contains, st_containsproper, st_covered, ST_CoveredBy, st_crossing, ST_Disjoint, ST_Equals, ST_Intersects, ST_Overlaps, st_touched和ST_Within提供的。使用显式模式允许在一个步骤中测试交叉、覆盖等的多个条件。它还允许测试没有命名空间关系函数的空间关系。例如，关系“Interior-Intersects”具有DE-9IM模式T********，它不由任何命名谓词计算。
- 如果两个Geometry的SRID不同，则报错。
- 只会计算2D的结果，如果输入的是3D坐标，则会忽略Z坐标继续计算。


#   [2. Grammar（语法）](#2-grammar语法)  

```
boolean ST_Relate(geometry geomA, geometry geomB, text intersectionMatrixPattern);

text ST_Relate(geometry geomA, geometry geomB);

text ST_Relate(geometry geomA, geometry geomB, integer boundaryNodeRule);

```

#   [3. Functions（功能）](#3-functions功能)  

##   [3.1 形式1](#31-形式1)  

```
boolean ST_Relate(geometry geomA, geometry geomB, text intersectionMatrixPattern);

```

- 根据给定的intersectionMatrixPattern测试两个几何图形是否在空间上相关。


##   [3.2 形式2](#32-形式2)  

```
text ST_Relate(geometry geomA, geometry geomB);

```

- 返回用于表示两个Geometrys之间空间关系的DE-9IM矩阵字符串。可以使用ST_RelateMatch测试矩阵字符串是否匹配DE-9IM模式。


##   [3.3 形式3](#33-形式3)  

```
text ST_Relate(geometry geomA, geometry geomB, integer boundaryNodeRule);

```

- 类似于形式2，但是允许指定边界节点规则。边界节点规则允许更精细地控制几何边界点是否被认为位于DE-9IM内部或边界。可选的规则有(不支持隐式转换，输入其他值则报错):


>   1:OGC/MOD2    2: Endpoint    3: MultivalentEndpoint    4: MonovalentEndpoint  

- 实际上形式2是按照规则1：OGC/MOD2进行计算的。


#   [4. Example（用例）](#4-example用例)  

- 使用形式1测试空间关系


```
SELECT ST_Relate('POINT(1 2)', ST_Buffer( 'POINT(1 2)', 2), '0FFFFF212');
st_relate
-----------
t

SELECT ST_Relate(POINT(1 2)', ST_Buffer( 'POINT(1 2)', 2), '*FF*FF212');
st_relate
-----------
t

```

- Null


```
select st_relate(st_geomfromtext('point(1 2)'), null);
 st_relate 
-----------
 
(1 row)

select st_relate(null, st_geomfromtext('point(1 3)'));
 st_relate 
-----------
 
(1 row)

select st_relate(null, null);
 st_relate 
-----------
 
(1 row)


```

- 2D


```
select st_relate(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 2 3)'));
 st_relate 
-----------
 0FFFFFFF2
(1 row)

select st_relate(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 2 4)'));
 st_relate 
-----------
 0FFFFFFF2
(1 row)

select st_relate(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 3 4)'));
 st_relate 
-----------
 FF0FFF0F2
(1 row)


```

- 不同SRID


```
select st_relate(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 2 3)', 4329));
ERROR:  relate_full: Operation on mixed SRID geometries (Point, 0) != (Point, 4329)


```

- 边界值规则


```
select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'));
 st_relate 
-----------
 10FFFF212
(1 row)

select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 1);
 st_relate 
-----------
 10FFFF212
(1 row)

select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 2);
 st_relate 
-----------
 1FFF0F212
(1 row)

select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 3);
 st_relate 
-----------
 10FFFF212
(1 row)

select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 4);
 st_relate 
-----------
 10FFFF212
(1 row)

select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 5);
ERROR:  GEOSRelate: Invalid boundary node rule 5

select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), -1);
ERROR:  GEOSRelate: Invalid boundary node rule -1

select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )'), ST_GeomFromText('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))'), 1.2);
ERROR:  function st_relate(geometry, geometry, numeric) does not exist
LINE 1: select st_relate(ST_GeomFromText('LINESTRING(3 5, 4 6 ,3 5 )...
               ^
HINT:  No function matches the given name and argument types. You might need to add explicit type casts.


```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Relate.html](https://postgis.net/docs/manual-3.3/ST_Relate.html)  

  [https://en.wikipedia.org/wiki/DE-9IM](https://en.wikipedia.org/wiki/DE-9IM)  

  [https://www.cnblogs.com/oloroso/p/14298258.html](https://www.cnblogs.com/oloroso/p/14298258.html)  

**例如Contains关系的交叉矩阵模式如下，那么用ST_Relate(geomA, geomB)计算出来的交叉矩阵字符串如果与'T*****FF*'相匹配，则说明geomA和geomB是contains关系。**

![](https://pingcode.yasdb.com/atlas/files/public/67396b3c8970c2af4f5202e7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1NDgsImV4cCI6MTc4MjMwNDM0OH0.T30fwA_-2M9TmsIx-nW2MJWCM_bwAPx2UiIRkkY23e0)

## Attachments: