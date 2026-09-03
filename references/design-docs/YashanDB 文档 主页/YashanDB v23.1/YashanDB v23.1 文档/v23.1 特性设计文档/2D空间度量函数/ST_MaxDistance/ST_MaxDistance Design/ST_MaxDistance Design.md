Created by 胡威振, last modified on 七月 06, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_MaxDistance函数的功能是：以投影单位返回两个几何图形凸包之间的二维最大距离。最大距离总是出现在两个顶点之间。这是ST_LongestLine返回的LineString长度。
- 如果g1和g2是相同的几何体，则返回该几何体中相距最远的两个顶点之间的距离。
- geom1与geom2的srid如果不同则报错。
- 如果输入的是Empty，则返回NULL。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 输入为null则返回null。
- 实际上会先计算两个geometry的凸包，然后把凸包传给ST_MaxDistance函数进行计算。即：ST_MaxDistance(ST_ConvexHull(geom1), ST_ConvexHull(geom2));


#   [2. Grammer（语法）](#2-grammer语法)  

```
double ST_MaxDistance(geom1 geometry, geom2 geometry);

```

- udf


```
create or replace function MDSYS.ST_MAXDISTANCE(geom1 in ST_GEOMETRY, geom2 in ST_GEOMETRY) return double is
begin
    return SYS.GEOMETRY.ST_MAXDISTANCE(geom1.head, geom1.geom, geom2.head, geom2.geom);
end;
/

create or replace public synonym ST_MAXDISTANCE for MDSYS.ST_MAXDISTANCE
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomMaxDistance()

```

#   [4. Details（详细设计）](#4-details详细设计)  

- 输入存在NULL，直接返回NULL。
- 调用GEOS的GEOSConvexHull_r接口，求两个geom的凸包，后面的计算都是用凸包。
- geom1与geom2的srid不同，拦截报错。
- 如果geom1或者geom2是集合类型，则会不断递归遍历geom1和geom2，直到拿到原子类型（Point、LineString、Polygon），如果原子类型是Empty，则直接返回。
- 最终进行计算的实际上有9种情况(三种原子类型两两组合)，计算完一次之后将计算的长距离、最长线段的两个点的信息都保存下来，后续遍历会不断更新结果。
- MaxDistance(Point, Point):


>   计算两点的距离，将两点的距离以及两个点保存下来。  

- MaxDistance(Point, LineString):


>   由于点与线段的最远距离，一定是点与两个端点的最长距离，所以直接比较Point与LineString的所有点的距离即可。  

- MaxDistance(Point, Polygon)：


>   由于计算的是凸包的最远距离，Polygon的凸包只有一个环，所以直接求Point到这个环的最远距离即可。（即使有内环，最远距离也是点到外环的距离）  

- MaxDistance(LineString, Point)：


>   计算过程如同MaxDistance(Point, LineString)，设置标志位表明颠倒顺序，最终结果的距离不变，两个点的顺序发生变化。  

- MaxDistance(LineString, LineString)：


>   这里不需要遍历线段，最长距离必定在端点，直接两个for循环遍历两个LineString的点，逐个对比，求出最长距离。  

- MaxDistance(LineString, Polygon)：


>   LineString到Polygon的最远距离实际上是LineString到Polygon外环的最远距离。所以转换成MaxDistance(LineString, LineString)。  

- MaxDistance(Polygon, Point)。


>   计算过程如同MaxDistance(Point, Polygon)，设置标志位表明颠倒顺序，最终结果的距离不变，两个点的顺序发生变化。  

- MaxDistance(Polygon，LineString)：


>   计算过程如同MaxDistance(LineString, Polygon)，设置标志位表明颠倒顺序，最终结果的距离不变，两个点的顺序发生变化。  

- MaxDistance(Polygon1, Polygon2)：


>   由于计算的是凸包的最远距离，Polygon的凸包只有一个环，所以直接求这两个Polygon的环的最远距离即可。（即使有多个环最远距离也是两个Polygon外环的最远距离）  

#   [5. Restrict（限制）](#5-restrict限制)  

- 对于MaxDistance(LineString, Polygon)的情况，计算结果与postgis会不同，postgis是判断Polygon（此时的Polygon是一个凸包，只有一个环）是否包含了LineString的一个点，如果包含了就直接返回Null了。
- Postgis存在Bug。


```
postgres=# select st_maxDistance(st_geomfromtext('LINESTRING(1 0, 2 0, 3 0, 4 0)'), st_geomfromtext('MULTILINESTRING((0 0, 2 0), (1 1, 2 2))'));

 st_maxdistance 
----------------
               
(1 row)

```

#   [6. Example（用例）](#6-example用例)  

```
SQL&gt; select ST_MaxDistance(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('POINT EMPTY')) from dual;

ST_MAXDISTANCE(ST_GE 
-------------------- 
                   

1 row fetched.

SQL&gt; select ST_MaxDistance(st_geomfromtext('MULTIPOINT((0 0), (2 0), EMPTY)'), ST_GeomFromText('MULTIPOINT Z ((0 0 0), (2 0 0))')) from dual;

ST_MAXDISTANCE(ST_GE 
-------------------- 
            2.0E+000

1 row fetched.


```

#   [7. Reference（参考文档）](#7-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_MaxDistance.html](https://postgis.net/docs/manual-3.3/ST_MaxDistance.html)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a0ba1ad9a3311dc7a25/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTExMDQsImV4cCI6MTc4MjIyMTkwNH0.IVzNvejbpTrzUSyjXba-vtUz_WM16uvQKM9LOl43QII)

## Attachments: