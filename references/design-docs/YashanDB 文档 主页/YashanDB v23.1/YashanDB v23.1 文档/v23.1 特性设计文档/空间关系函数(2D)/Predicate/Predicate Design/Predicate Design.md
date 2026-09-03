Created by 胡威振, last modified on 四月 25, 2023

**SR链接：**    [YDBRD-13245](https://jira.yasdb.com/browse/YDBRD-13245?src=confmacro)    **-**  **支持空间关系函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

>   **空间关系函数均有以下规格**  ：    1. 如果两个Geometry的Srid不同，则报错。
  1. 如果输入存在null值，则返回null。
  1. 只会计算2D结果，如果坐标中有Z轴，则会忽略Z坐标继续计算。
  1. 能够保证的精度是小数点后面15位，小数部分超出15位之后结果不保证。
  

##   [1.1 ST_Contains](#11-st-contains)  

- ST_Contains(geomA geometry, geomB geometry)函数的功能是：当且仅当B中没有点位于A的外部，且B中至少有一个点位于A的内部时，A包含B，返回TRUE。
- 语法：boolean ST_Contains(geomA geometry, geomB geometry);
- ST_Contains是ST_Within的逆。因此，ST_Contains(A,B) = ST_Within(B,A)。


##   [1.2 ST_Within](#12-st-within)  

- ST_Within(geomA geometry, geomB geometry)函数的功能是：测试geomA的点是否在geomB的外部，并且geomA和geomB至少有一个共同的内部点。如果geomA完全在几何图形geomB中，则返回TRUE。为了使这个函数有意义，源几何图形必须具有相同的坐标投影，即具有相同的SRID。假设ST_Within(A,B)为真，ST_Within(B, A)为真，则认为这两个几何图形在空间上相等。
- 语法：boolean ST_Within(geomA geometry, geomB geometry);
- ST_Within是ST_Contains的逆。因此，ST_Within(A,B) = ST_Contains(B,A)。


##   [1.3 ST_CoveredBy](#13-st-coveredby)  

- ST_CoveredBy(geomA geometry, geomB geometry)函数的功能是：如果几何A中没有点位于几何B之外，则返回true，否则返回false。
- 语法：boolean ST_CoveredBy(geomA geometry, geomB geometry);


##   [1.4 ST_Covers](#14-st-covers)  

- ST_Covers(geomA geometry, geomB geometry)函数的功能是：如果几何B中没有点在几何A之外，则返回true。等效地，测试几何B的每个点是否都在几何A内部(即与几何A的内部或边界相交)。
- 语法：boolean ST_Covers(geomA geometry, geomB geometry);


##   [1.5 ST_Crosses](#15-st-crosses)  

- ST_Crosses(geomA geometry, geomB geometry)函数的功能是：测试两个几何图形是否有一些(而不是全部)相同的内点。比较两个几何对象，如果它们的交点“在空间上交叉”，也就是说，两个几何对象有一些(但不是所有)内部点共有，则返回true。几何图形内部的交集必须是非空的，并且维度必须小于两个输入几何图形的最大维度。另外，两个几何图形的交集不能等于源几何图形中的任何一个。否则，返回false。
- 语法：boolean ST_Crosses(geomA geometry, geomB geometry);


##   [1.6 ST_Disjoint](#16-st-disjoint)  

- ST_Disjoint(geomA geometry, geomB geometry)函数的功能是：测试两个几何图形是否不相交(它们没有共同点), 如果不相交则返回true， 否则返回false。
- 语法：boolean ST_Disjoint(geomA geometry, geomB geometry);


##   [1.7 ST_Equals](#17-st-equals)  

- ST_Equals(geomA geometry, geomB geometry)函数的功能是：测试两个几何图形是否包含同一组点。如果给定的几何图形“空间相等”，则返回true。注意，空间相等的意思是ST_Within(A,B) = true和ST_Within(B,A) = true，也意味着点的顺序可以不同，但表示相同的几何结构。
- 语法：boolean ST_Equals(geomA geometry, geomB geometry);


##   [1.8 ST_Intersects](#18-st-intersects)  

- ST_Intersects(geomA geometry, geomB geometry)函数的功能是：测试两个几何图形是否相交(它们至少有一个共同点)。比较两个几何图形，如果它们相交则返回true。如果几何图形有共同点，它们就相交。
- 语法：boolean ST_Intersects(geomA geometry, geomB geometry);


##   [1.9 ST_Overlaps](#19-st-overlaps)  

- ST_Overlaps(geomA geometry, geomB geometry)函数的功能是：测试两个几何图形是否相交并具有相同的维度，但彼此之间不完全包含。如果几何图形A和B“空间重叠”则返回TRUE。如果两个几何体具有相同的维度，每个几何体至少有一个点不属于另一个几何体(或等价地说，它们都不覆盖另一个几何体)，并且它们内部的交叉点具有相同的尺寸，那么它们就是重叠的。重叠关系是对称的。
- 语法：boolean ST_Overlaps(geomA geometry, geomB geometry);


##   [1.10 ST_Touches](#110-st-touches)  

- ST_Touches(geomA geometry, geomB geometry)函数的功能是：测试两个几何图形是否至少有一个共同点，但它们的内部不相交。如果geomA和geomB相交，但它们的内部不相交，则返回TRUE。同样地，A和B至少有一个共同点，并且这些共同点位于至少一个边界上。对于点/点输入，关系总是FALSE，因为点没有边界。
- 语法：boolean ST_Touches(geomA geometry, geomB geometry);


#   [2. Interfaces（接口）](#2-interfaces接口)  

```
piGeosGSContains()
geomContains()
·····

```

#   [3. Detail Design（详细设计）](#3-detail-design详细设计)  

```
调用geos_c GEOSContains_r()等对应函数。

```

#   [4. Example（用例）](#4-example用例)  

```
SQL&gt; select id, geom_type from test_geom where st_contains(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));

          ID GEOM_TYPE                         
------------ --------------------------------- 
          43 MultiPolygon                     

1 row fetched.

SQL&gt; select st_contains(st_geomfromtext('point(1 0)'), st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))')) from dual;

ST_CONTAINS(ST_GEOMF 
-------------------- 
false               

1 row fetched.

SQL&gt; select id, geom_type from test_geom where st_coveredby(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));

          ID GEOM_TYPE                         
------------ --------------------------------- 
          51 Geometry Collection              

1 row fetched.

SQL&gt; select st_coveredby(st_geomfromtext('point(1 0)'), st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))')) from dual;

ST_COVEREDBY(ST_GEOM 
-------------------- 
false               

1 row fetched.

SQL&gt; select id, geom_type from test_geom where st_covers(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));

          ID GEOM_TYPE                         
------------ --------------------------------- 
          43 MultiPolygon                     

1 row fetched.

SQL&gt; select st_covers(st_geomfromtext('point(1 0)'), st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))')) from dual;

ST_COVERS(ST_GEOMFRO 
-------------------- 
false               

1 row fetched.

```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Contains.html](https://postgis.net/docs/manual-3.3/ST_Contains.html)  

  [https://postgis.net/docs/manual-3.3/ST_Within.html](https://postgis.net/docs/manual-3.3/ST_Within.html)  

  [https://postgis.net/docs/manual-3.3/ST_CoveredBy.html](https://postgis.net/docs/manual-3.3/ST_CoveredBy.html)  

  [https://postgis.net/docs/manual-3.3/ST_Covers.html](https://postgis.net/docs/manual-3.3/ST_Covers.html)  

  [https://postgis.net/docs/manual-3.3/ST_Crosses.html](https://postgis.net/docs/manual-3.3/ST_Crosses.html)  

  [https://postgis.net/docs/manual-3.3/ST_Disjoint.html](https://postgis.net/docs/manual-3.3/ST_Disjoint.html)  

  [https://postgis.net/docs/manual-3.3/ST_Equals.html](https://postgis.net/docs/manual-3.3/ST_Equals.html)  

  [https://postgis.net/docs/manual-3.3/ST_Intersects.html](https://postgis.net/docs/manual-3.3/ST_Intersects.html)  

  [https://postgis.net/docs/manual-3.3/ST_Overlaps.html](https://postgis.net/docs/manual-3.3/ST_Overlaps.html)  

  [https://postgis.net/docs/manual-3.3/ST_Touches.html](https://postgis.net/docs/manual-3.3/ST_Touches.html)  

## Attachments:

## Comments:

|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396b3b8970c2af4f5202dc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIxMTMsImV4cCI6MTc4MjMwMjkxM30.HejcFhwEkNEbyMjWwsa2-UE1-5YenGmWvkZ_nIvH1zE),  
    
  空间关系函数作为filter，如果顺序发生变化，结果可能变。,Posted by huweizhen at 七月 15, 2024 15:00|
|---|
