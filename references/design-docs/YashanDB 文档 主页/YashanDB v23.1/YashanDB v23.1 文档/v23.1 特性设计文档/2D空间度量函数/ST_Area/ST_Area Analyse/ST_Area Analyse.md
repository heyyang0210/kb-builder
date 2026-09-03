Created by 胡威振, last modified on 六月 13, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_Area函数的功能是：返回geometry polygon或geography polygon的面积。
- 对于geometry类型，计算二维笛卡尔(平面)面积，其单位由SRID指定。
- 对于geography类型，默认情况下，区域是在以平方米为单位的球体上确定的。要使用更快但精度较低的球面模型计算面积，请使用ST_Area(geog,false)。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 输入为null则返回null。


#   [2. Grammar（语法）](#2-grammar语法)  

```
float ST_Area(geometry g1);

float ST_Area(geography geog, boolean use_spheroid=true);

```

#   [3. Example（用例）](#3-example用例)  

```
Select st_area(st_geomfromtext('point(1 2)'));
 st_area 
---------
       0
(1 row)

Select st_area(st_geomfromtext('linestring(1 1, 2 2, 3 3)'));
 st_area 
---------
       0
(1 row)

```

- 经纬度坐标系


```
SELECT ST_Area(ST_GeogFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))'));
      st_area      
-------------------
 86.27760430602939
(1 row)

SELECT ST_Area(ST_GeogFromText('SRID=104972;POLYGON M ((0 0 0,10 0 0,10 10 0,0 10 0,0 0 0),(2 2 0,2 5 0,5 5 0,5 2 0,2 2 0))'));
      st_area      
-------------------
 6106870664.729549
(1 row)

SELECT ST_Area(ST_GeogFromText('SRID=104992;POLYGON M ((0 0 0,10 0 0,10 10 0,0 10 0,0 0 0),(2 2 0,2 5 0,5 5 0,5 2 0,2 2 0))'));
      st_area       
--------------------
 1117046590047.3403
(1 row)



```

- 笛卡尔坐标系


```
SELECT ST_Area(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))'));
        st_area        
-----------------------
 9.432672669780515e-09
(1 row)


SELECT ST_Area(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 4329));
        st_area        
-----------------------
 9.432672669780515e-09
(1 row)


SELECT ST_Area(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 4321));
        st_area        
-----------------------
 9.432672669780515e-09
(1 row)

```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Area.html](https://postgis.net/docs/manual-3.3/ST_Area.html)  