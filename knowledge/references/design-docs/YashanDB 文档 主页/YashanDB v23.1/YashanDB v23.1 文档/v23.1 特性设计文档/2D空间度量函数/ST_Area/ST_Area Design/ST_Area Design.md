Created by 胡威振, last modified on 七月 11, 2023

**SR链接：**    [YDBRD-13290](https://jira.yasdb.com/browse/YDBRD-13290?src=confmacro)    **-**  **支持空间度量函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_Area函数的功能是：计算polygon（包含polygon的集合类型）的面积，或者说计算的是区域的面积，对于不能构成区域的几何图形，则返回0。
- 如果输入的SRID确定的坐标系是笛卡尔坐标系，则按照投影坐标下的算法进行计算，不同笛卡尔坐标系得到的数值是一样的，但是单位不一样。
- 如果输入的SRID确定的坐标系是经纬度坐标系，则调用proj库进行计算，不同经纬度坐标系得到的结果的数值不保证相等。
- 该函数只会计算2D，如果输入的是三维，则会忽略Z坐标进行计算。
- 输入为null则返回null。
- 大部分情况下不同的笛卡尔坐标系(经纬度坐标系)计算的结果是一样的，只是单位不同（单位由参考系决定），但也有不一样的情况。
- 对于输入的经纬度坐标，如果数值非法，则转换成合法经纬度进行计算。


#   [2. Grammer（语法）](#2-grammer语法)  

```
double ST_Area(geom geometry);

```

- udf


```
create or replace function MDSYS.ST_AREA(geom in ST_GEOMETRY) return double is
begin
    return SYS.GEOMETRY.ST_AREA(geom.head, geom.geom);
end;
/

create or replace public synonym ST_AREA for MDSYS.ST_AREA
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomGeodArea()
piGeomArea()

```

#   [4. Details（详细设计）](#4-details详细设计)  

- 输入为NULL，直接返回NULL。
- 根据Srid判断是笛卡尔坐标系还是经纬度坐标系。
- 如果输入的是经纬度坐标系：


>   如果输入是Polygon类型，则调用proj接口逐个计算每个环的面积，最后结果为Polygon的外环面积减去所有内环面积。  

>   如果输入的是集合类型，则递归调用piGeomGeodArea，求每个子类型的面积，最终结果为每个子类型面积之和。  

>   如果输入的是其他类型，则直接返回0。  

- 如果输入的是笛卡尔坐标系：


>   如果输入的是Polygon类型，则逐个计算每个环的面积，最后结果为外环面积减去所有内环面积。  

>   如果输入的是集合类型，则递归调用piGeomArea，求每个子类型的面积，最终结果为每个子类型面积之和。  

>   如果输入的是其他类型，则直接返回0。  

#   [5. Restrict（限制）](#5-restrict限制)  

- 对于经纬度坐标系，在不同环境下精度可能不同，行为依赖proj库。


#   [6. Example（用例）](#6-example用例)  

```
SQL&gt; select st_area(st_geomfromtext('point (1 2)')) from dual;

ST_AREA(ST_GEOMFROMT 
-------------------- 
                   0

1 row fetched.

SQL&gt; select st_area(st_geomfromtext('linestring(1 2, 3 4)')) from dual;

ST_AREA(ST_GEOMFROMT 
-------------------- 
                   0

1 row fetched.

```

- 笛卡尔坐标系


```
SQL&gt; SELECT ST_Area(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 3773)) from dual;

ST_AREA(ST_GEOMFROMT 
-------------------- 
          9.433E-009

1 row fetched.

```

- 经纬度坐标系


```
SQL&gt; SELECT ST_Area(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 4329)) from dual;

ST_AREA(ST_GEOMFROMT 
-------------------- 
          8.628E+001

1 row fetched.

SQL&gt; SELECT ST_Area(ST_GeomFromText('POLYGON((-71.1776848522251 42.3902896512902,-71.1776843766326 42.3903829478009,-71.1775844305465 42.3903826677917,-71.1775825927231 42.3902893647987,-71.1776848522251 42.3902896512902))', 7042)) from dual;

ST_AREA(ST_GEOMFROMT 
-------------------- 
          8.628E+001

1 row fetched.


```

#   [7. Reference（参考文档）](#7-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Area.html](https://postgis.net/docs/manual-3.3/ST_Area.html)  

计算多边形面积公式（交叉相乘相减）：



## Attachments:

[image2023-6-21_9-33-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDk4OTcwYzJhZjRmNTFmYmFiIiwicmVmX2lkIjoiNjczOTZhMDk1OTNmOTljOWZmMjM1NTAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODkyLCJleHAiOjE3ODIyOTcyOTJ9.qqWtsvXAM-jj3A47rBzpcIrAdc8iBkFUECKtB4Txd_A)

 (image/png)    


[image2023-6-21_9-34-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDk4OTcwYzJhZjRmNTFmYmFjIiwicmVmX2lkIjoiNjczOTZhMDk1OTNmOTljOWZmMjM1NTAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODkyLCJleHAiOjE3ODIyOTcyOTJ9.MuVFPkOIoKrsz_oZUVlu0VBvJt7rvS1CE8cCrmTJwJ4)

 (image/png)    


[image2023-6-21_9-34-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDk4OTcwYzJhZjRmNTFmYmFkIiwicmVmX2lkIjoiNjczOTZhMDk1OTNmOTljOWZmMjM1NTAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODkyLCJleHAiOjE3ODIyOTcyOTJ9.qImNXONxWeAZkPGltYdgEXGACFXT11GppoAYL6JaSmg)

 (image/png)    


[image2023-6-21_9-35-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDk4OTcwYzJhZjRmNTFmYmFlIiwicmVmX2lkIjoiNjczOTZhMDk1OTNmOTljOWZmMjM1NTAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwODkyLCJleHAiOjE3ODIyOTcyOTJ9.bS6XIQYIOi7zHZrrj3kNPAzKexPW4HeBlxDmG4XHHDs)

 (image/png)    
