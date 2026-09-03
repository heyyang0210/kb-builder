Created by 胡威振, last modified on 六月 13, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_Perimeter函数的功能是：返回geometry polygon或geography polygon的边界长度。如果它是ST_Surface, ST_MultiSurface (Polygon, MultiPolygon)，则返回geometry/geography的二维周长。非面积几何返回0。对于线性几何，使用ST_Length。如果是集合，则是多个周长之和。
- 对于geometry，周长度量的单位由几何的空间参考系指定。
- 对于geography，使用逆测地线问题进行计算，其中周长单位为米。如果PostGIS使用PROJ 4.8.0及以上版本编译，则球体由SRID指定，否则为WGS84所独有。如果use_spheroid=false，那么计算将近似于一个球体而不是一个球体。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 输入存在null则返回null。


#   [2. Grammar（语法）](#2-grammar语法)  

```
float ST_Perimeter(geometry g1);

float ST_Perimeter(geography geog, boolean use_spheroid=true);

```

#   [3. Example（用例）](#3-example用例)  

```
Select st_perimeter(st_geomfromtext('point(1 2)'));
 st_perimeter 
--------------
            0
(1 row)

Select st_perimeter(st_geomfromtext('linestring(1 1, 2 2, 3 3)'));
 st_perimeter 
--------------
            0
(1 row)

```

- 经纬度坐标系


```
SELECT ST_Perimeter(ST_GeogFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))'));
    st_perimeter    
--------------------
 37.379046253787024
(1 row)

SELECT ST_Perimeter(ST_GeogFromText('SRID=104992;POLYGON M ((0 0 0,10 0 0,10 10 0,0 10 0,0 0 0),(2 2 0,2 5 0,5 5 0,5 2 0,2 2 0))'));
   st_perimeter    
-------------------
 5750569.980649361
(1 row)

SELECT ST_Perimeter(ST_GeogFromText('SRID=104972;POLYGON M ((0 0 0,10 0 0,10 10 0,0 10 0,0 0 0),(2 2 0,2 5 0,5 5 0,5 2 0,2 2 0))'));
   st_perimeter    
-------------------
 425200.4798905011
(1 row)



```

- 笛卡尔坐标系


```
SELECT ST_Perimeter(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))'));
      st_perimeter      
------------------------
 0.00038882519592966846
(1 row)

SELECT ST_Perimeter(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 4329));
      st_perimeter      
------------------------
 0.00038882519592966846
(1 row)

SELECT ST_Perimeter(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 4321));
      st_perimeter      
------------------------
 0.00038882519592966846
(1 row)

```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Perimeter.html](https://postgis.net/docs/manual-3.3/ST_Perimeter.html)  