Created by 胡威振, last modified on 七月 11, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_Perimeter函数的功能是：计算polygon（包含polygon的集合类型）的周长，或者说计算区域的周长，对于不能构成区域的几何图形，则返回0。
- 如果输入的SRID确定的坐标系是笛卡尔坐标系，则按照投影坐标下的算法进行计算，不同笛卡尔坐标系得到的数值是一样的，但是单位不一样。
- 如果输入的SRID确定的坐标系是经纬度坐标系，则调用proj库进行计算，不同经纬度坐标系得到的结果的数值不保证相等。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 输入为null则返回null。
- 大部分情况下不同的笛卡尔坐标系(经纬度坐标系)计算的结果是一样的，只是单位不同（单位由参考系决定），但也有不一样的情况。
- 对于输入的经纬度坐标，如果数值非法，则转换成合法经纬度进行计算。


#   [2. Grammer（语法）](#2-grammer语法)  

```
double ST_Perimeter(geom geometry);

```

- udf


```
create or replace function MDSYS.ST_PERIMETER(geom in ST_GEOMETRY) return double is
begin
    return SYS.GEOMETRY.ST_PERIMETER(geom.head, geom.geom);
end;
/

create or replace public synonym ST_PERIMETER for MDSYS.ST_PERIMETER
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomGeodPerimeter()
piGeomPerimeter()

```

#   [4. Details（详细设计）](#4-details详细设计)  

- 输入为NULL，直接返回NULL。
- 根据Srid判断是笛卡尔坐标系还是经纬度坐标系。
- 如果输入的是经纬度坐标系：


>   如果输入的是Polygon类型，则调用proj接口逐个计算每个环的周长，最后结果为每个环周长之和。  

>   如果输入的是集合类型，则递归调用piGeomGeodPerimeter，求每个子类型的周长，最终结果为每个子类型周长之和。  

>   如果输入的是其他类型，则直接返回0。  

- 如果输入的是笛卡尔坐标系：


>   如果输入的是Polygon类型，则逐个计算每个环的周长（不断求两点距离，逐个相加），最后结果为每个环周长之和。  

>   如果输入的是集合类型，则递归调用piGeomPerimeter，求每个子类型的周长，最终结果为每个子类型周长之和。  

>   如果输入的是其他类型，则直接返回0。  

#   [5. Restrict（限制）](#5-restrict限制)  

- 对于经纬度坐标系，在不同环境下精度可能不同，行为依赖proj库。


#   [6. Example（用例）](#6-example用例)  

```
SQL&gt; select st_Perimeter(st_geomfromtext('point (1 2)')) from dual;

ST_PERIMETER(ST_GEOM 
-------------------- 
                   0

1 row fetched.

SQL&gt; select st_Perimeter(st_geomfromtext('linestring(1 2, 3 4)')) from dual;

ST_PERIMETER(ST_GEOM 
-------------------- 
                   0

1 row fetched.


```

- 笛卡尔坐标系


```
SQL&gt; SELECT ST_Perimeter(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 3773)) from dual;

ST_PERIMETER(ST_GEOM 
-------------------- 
          3.888E-004

1 row fetched.

```

- 经纬度坐标系


```
SQL&gt; SELECT ST_Perimeter(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 4329)) from dual;

ST_PERIMETER(ST_GEOM 
-------------------- 
          3.738E+001

1 row fetched.

SQL&gt; SELECT ST_Perimeter(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 7042)) from dual;

ST_PERIMETER(ST_GEOM 
-------------------- 
          3.738E+001

1 row fetched.


```

#   [7. Reference（参考文档）](#7-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Perimeter.html](https://postgis.net/docs/manual-3.3/ST_Perimeter.html)  