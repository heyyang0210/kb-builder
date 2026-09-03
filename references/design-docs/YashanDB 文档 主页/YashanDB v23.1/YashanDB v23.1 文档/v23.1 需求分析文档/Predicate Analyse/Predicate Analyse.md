Created by 胡威振, last modified on 四月 25, 2023

**SR链接：**    [YDBRD-13245](https://jira.yasdb.com/browse/YDBRD-13245?src=confmacro)    **-**  **支持空间关系函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

>   **空间关系函数均有以下规格**  ：    1. 如果两个Geometry的Srid不同，则报错。
  1. 如果输入存在null值，则返回null。
  1. 只会计算2D结果，如果坐标中有Z轴，则会忽略Z坐标继续计算。
  

##   [1.1 ST_Contains](#11-st-contains)  

- ST_Contains(geometry geomA, geometry geomB)函数的功能是：当且仅当B中没有点位于A的外部，且B中至少有一个点位于A的内部时，A包含B，返回TRUE。
- 语法：boolean ST_Contains(geometry geomA, geometry geomB);
- ST_Contains是ST_Within的逆。因此，ST_Contains(A,B) = ST_Within(B,A)。


![](https://img2020.cnblogs.com/blog/693958/202101/693958-20210119152959427-268422920.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1MDAsImV4cCI6MTc4MjMwNDMwMH0.0lGB9ZVOpvcUZuWfZQRm8ZLP8MCgJYnbWP-9-FVc39Q)

##   [1.2 ST_Within](#12-st-within)  

- ST_Within( geometry geomA, geometry geomB)函数的功能是：测试geomA的点是否在geomB的外部，并且geomA和geomB至少有一个共同的内部点。如果geomA完全在几何图形geomB中，则返回TRUE。为了使这个函数有意义，源几何图形必须具有相同的坐标投影，即具有相同的SRID。假设ST_Within(A,B)为真，ST_Within(B, A)为真，则认为这两个几何图形在空间上相等。
- 语法：boolean ST_Within( geometry geomA, geometry geomB);
- ST_Within是ST_Contains的逆。因此，ST_Within(A,B) = ST_Contains(B,A)。


![](https://img2020.cnblogs.com/blog/693958/202101/693958-20210119153225244-1983082202.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1MDAsImV4cCI6MTc4MjMwNDMwMH0.0lGB9ZVOpvcUZuWfZQRm8ZLP8MCgJYnbWP-9-FVc39Q)

##   [1.3 ST_CoveredBy](#13-st-coveredby)  

- ST_CoveredBy(geometry geomA, geometry geomB)函数的功能是：如果几何A中没有点位于几何B之外，则返回true，否则返回false。
- 语法：boolean ST_CoveredBy(geometry geomA, geometry geomB);


##   [1.4 ST_Covers](#14-st-covers)  

- ST_Covers(geometry geomA, geometry geomB)函数的功能是：如果几何B中没有点在几何A之外，则返回true。等效地，测试几何B的每个点是否都在几何A内部(即与几何A的内部或边界相交)。
- 语法：boolean ST_Covers(geometry geomA, geometry geomB);


##   [1.5 ST_Crosses](#15-st-crosses)  

- ST_Crosses(geometry geomA, geometry geomB)函数的功能是：测试两个几何图形是否有一些(而不是全部)相同的内点。比较两个几何对象，如果它们的交点“在空间上交叉”，也就是说，两个几何对象有一些(但不是所有)内部点共有，则返回true。几何图形内部的交集必须是非空的，并且维度必须小于两个输入几何图形的最大维度。另外，两个几何图形的交集不能等于源几何图形中的任何一个。否则，返回false。
- 语法：boolean ST_Crosses(geometry geomA, geometry geomB);


![](https://img2020.cnblogs.com/blog/693958/202101/693958-20210119153033039-600509244.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1MDAsImV4cCI6MTc4MjMwNDMwMH0.0lGB9ZVOpvcUZuWfZQRm8ZLP8MCgJYnbWP-9-FVc39Q)

##   [1.6 ST_Disjoint](#16-st-disjoint)  

- ST_Disjoint( geometry geomA , geometry geomB )函数的功能是：测试两个几何图形是否不相交(它们没有共同点), 如果不相交则返回true， 否则返回false。
- 语法：boolean ST_Disjoint( geometry geomA , geometry geomB );


![](https://img2020.cnblogs.com/blog/693958/202101/693958-20210119152919323-1263150024.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1MDAsImV4cCI6MTc4MjMwNDMwMH0.0lGB9ZVOpvcUZuWfZQRm8ZLP8MCgJYnbWP-9-FVc39Q)

##   [1.7 ST_Intersects](#17-st-intersects)  

- ST_Intersects( geometry geomA, geometry geomB)函数的功能是：测试两个几何图形是否相交(它们至少有一个共同点)。比较两个几何图形，如果它们相交则返回true。如果几何图形有共同点，它们就相交。
- 语法：boolean ST_Intersects( geometry geomA, geometry geomB);


##   [1.8 ST_Equals](#18-st-equals)  

- ST_Equals(geometry geomA, geometry geomB)函数的功能是：测试两个几何图形是否包含同一组点。如果给定的几何图形“空间相等”，则返回true。注意，空间相等的意思是ST_Within(A,B) = true和ST_Within(B,A) = true，也意味着点的顺序可以不同，但表示相同的几何结构。
- 语法：boolean ST_Equals(geometry geomA, geometry geomB);


![](https://img2020.cnblogs.com/blog/693958/202101/693958-20210119153056166-1434345277.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1MDAsImV4cCI6MTc4MjMwNDMwMH0.0lGB9ZVOpvcUZuWfZQRm8ZLP8MCgJYnbWP-9-FVc39Q)

##   [1.9 ST_Overlaps](#19-st-overlaps)  

- ST_Overlaps( geometry geomA, geometry geomB)函数的功能是：测试两个几何图形是否相交并具有相同的维度，但彼此之间不完全包含。如果几何图形A和B“空间重叠”则返回TRUE。如果两个几何体具有相同的维度，每个几何体至少有一个点不属于另一个几何体(或等价地说，它们都不覆盖另一个几何体)，并且它们内部的交叉点具有相同的尺寸，那么它们就是重叠的。重叠关系是对称的。
- 语法：boolean ST_Overlaps( geometry geomA, geometry geomB);


![](https://img2020.cnblogs.com/blog/693958/202101/693958-20210119153124928-1575843645.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1MDAsImV4cCI6MTc4MjMwNDMwMH0.0lGB9ZVOpvcUZuWfZQRm8ZLP8MCgJYnbWP-9-FVc39Q)

##   [1.10 ST_Touches](#110-st-touches)  

- ST_Touches( geometry geomA, geometry geomB)函数的功能是：测试两个几何图形是否至少有一个共同点，但它们的内部不相交。如果geomA和geomB相交，但它们的内部不相交，则返回TRUE。同样地，A和B至少有一个共同点，并且这些共同点位于至少一个边界上。对于点/点输入，关系总是FALSE，因为点没有边界。
- 语法：boolean ST_Touches( geometry geomA, geometry geomB);


![](https://img2020.cnblogs.com/blog/693958/202101/693958-20210119153153488-2020688549.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM1MDAsImV4cCI6MTc4MjMwNDMwMH0.0lGB9ZVOpvcUZuWfZQRm8ZLP8MCgJYnbWP-9-FVc39Q)

#   [2. Example（用例）](#2-example用例)  

```
SQL&gt; select id, geom_type from test_geom where st_contains(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
 id |  geom_type   
----+--------------
 43 | MultiPolygon
(1 row)


SQL&gt; select st_contains(st_geomfromtext('point(1 0)'), st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
 st_contains 
-------------
 f
(1 row)


SQL&gt; select id, geom_type from test_geom where st_coveredby(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
 id |      geom_type      
----+---------------------
 51 | Geometry Collection
(1 row)


SQL&gt;  select st_coveredby(st_geomfromtext('point(1 0)'), st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
 st_coveredby 
--------------
 f
(1 row)

SQL&gt; select id, geom_type from test_geom where st_covers(shp, ST_GeomFromText('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
 id |  geom_type   
----+--------------
 43 | MultiPolygon
(1 row)


SQL&gt; select st_covers(st_geomfromtext('point(1 0)'), st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))'));
 st_covers 
-----------
 f
(1 row)


```

- SRID不同，则报错


```
select st_covers(st_geomfromtext('point(1 0)', 4326), st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))', 4329));
ERROR:  covers: Operation on mixed SRID geometries (Point, 4326) != (Polygon, 4329)


```

- null


```
SQL&gt; select st_covers(st_geomfromtext('point(1 0)', 4326), null);
 st_covers 
-----------
 
(1 row)

SQL&gt; select st_covers(null, st_geomfromtext('polygon((2 2, 2 4, 4 4, 4 2, 2 2))', 4329));
 st_covers 
-----------
 
(1 row)


```

- 2D


```
select st_equals(st_geomfromtext('point(1 2)'), st_geomfromtext('point(1 2)'));
 st_equals 
-----------
 t
(1 row)

select st_equals(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 2 4)'));
 st_equals 
-----------
 t
(1 row)

select st_equals(st_geomfromtext('point(1 2 3)'), st_geomfromtext('point(1 3 4)'));
 st_equals 
-----------
 f
(1 row)


```

#   [3. Reference（参考文档）](#3-reference参考文档)  

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