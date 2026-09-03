Created by 胡威振, last modified on 五月 22, 2023

**SR链接：**    [YDBRD-13369](https://jira.yasdb.com/browse/YDBRD-13369?src=confmacro)    **-**  **支持几何对象处理函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_GeometricMedian函数的功能是：使用Weiszfeld算法计算MULTIPOINT的几何中位数。最终会返回一个POINT，该POINT到MULTIPOINT的所有POINT的距离之和是最小的，输出的POINT的维度又输入的MULTIPOINT的最大维度决定，并且不会超过三维。
- 第二个参数表示公差，该算法会不断迭代进行计算，直到连续迭代之间的距离变化小于给定的公差。
- 第三个参数表示迭代最大次数，当第四个参数设置为True时，如果迭代计算了max_iter之后仍未满足第二个条件，则会返回Error；当第四个参数设置为False(默认值)时，则即使进行了max_iter次迭代仍未满足第二个条件，也不会返回error。
- 如果没有提供tolerance，则根据输入的Geometry的Bbox计算tolerance，特殊情况计算结果与postgis不一定一致。
- 由于当前阶段不会存储M坐标，所以即使输入的是4D坐标，也只会按照3D进行计算，与postgis不同，不会将M视作权重。
- 第一个参数是Null时，函数会返回null，第一个参数输入的是POINT时，则会返回该POINT（但不会保留输入的M坐标，与postgis有差别），输入的是MULTIPOINT EMPTY时则返回POINT EMPTY。
- 第二个参数只能是非负数，否则报错。
- 第三个参数只能是正整数，输入的是负数或者是Null则报错，按照yashanDB规格进行隐式转换。
- 第四个参数默认值是False，如果输入的是Null则按照false进行处理。


#   [2. Grammer（语法）](#2-grammer语法)  

```
geometry ST_GeometricMedian (geom geometry, tolerance in double default NULL, maxIter in int default 10000, failIfNotConverged in boolean default false);

```

- udf


```
create or replace function MDSYS.ST_GEOMETRICMEDIAN(geom in ST_GEOMETRY, tolerance in double default NULL, maxIter in int default 10000, failIfNotConverged in boolean default false) return ST_GEOMETRY is
geometry ST_GEOMETRY;
head raw(40);
ewkb blob;
begin
SYS.GEOMETRY.ST_GEOMETRICMEDIAN(geom.head, geom.geom, tolerance, maxIter, failIfNotConverged, head, ewkb);
if ewkb is null then
return null;
end if;
geometry := new ST_GEOMETRY(head, ewkb);
return geometry;
end;
/

create or replace public synonym ST_GEOMETRICMEDIAN for MDSYS.ST_GEOMETRICMEDIAN
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeomGeometricMedian()
geomGeometricMedian()

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

- 获取参数geom、tolerance、maxIter、failNotConverged之后进行校验：
- 如果geom是空，则函数直接返回NULL；
- 如果failIfNotConverged==NULL，则令failIfNotConverged=false；
- 如果maxIter < 0 || maxIter == NULL，则报错；
- 如果tolerance < 0 则报错；如果tolerance == NULL，则会根据geom的外包框计算一个tolerance值(计算公式参考postgis)，如果geom没有外包框，则tolerance给默认值1e-8；
- 如果geom是POINT，则返回该geom，如果是MULTIPOINT，则继续计算，其他类型则报错。
- 采取Weiszfeld算法取点进行迭代计算，当前代码保留了对M坐标的使用，即视作权重，但实际上不会走到这些代码，因为拿到的geom的维度始终小于4。


#   [5. Example（用例）](#5-example用例)  

- geom


```
select st_astext(st_geometricMedian(null, 1, 1, null)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('POINT(1 2)'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (1.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('POINT(1 2 3)'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT Z (1.000000000000000 2.000000000000000 3.000000000000000) 

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('POINT(1 2 3 4)'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT Z (1.000000000000000 2.000000000000000 3.000000000000000) 

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('POINT(1 2 3 -4)'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT Z (1.000000000000000 2.000000000000000 3.000000000000000) 

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MULTIPOINT(1 1, 2 2, 3 3)'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (2.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MULTIPOINT(1 1 1, 2 2 2, 3 3 3)'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT Z (2.000000000000000 2.000000000000000 2.000000000000000) 

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MULTIPOINT(1 1 1 1, 2 2 2 2, 3 3 3 3)'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT Z (2.000000000000000 2.000000000000000 2.000000000000000) 

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MULTIPOINT EMPTY'), Null, 0, NUll)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT EMPTY                                                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('LINESTRING(1 2, 2 3, 4 2)'), Null, 0, NUll)) from dual;

YAS-07202 plugin execution error, ST_GeometricMedian unsupported geometry type: LINESTRING

```

- tolerance


```
select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 100, 1, false)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (2.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 0, 1, false)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (2.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), null, 1, false)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (2.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), -1, 1, false)) from dual;

YAS-07202 plugin execution error, Tolerance must be positive.

select st_astext(st_geometricMedian(st_geomfromtext('multipoint(1 1, 2 3, 1 9, 29 3)'), null, 0, true)) from dual;

YAS-07202 plugin execution error, Median failed to converge within 1e-08 after 0 iterations.


```

- maxIter、failIfNotConverged


```
select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 1, 2, true)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (2.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 1, 0, true)) from dual;

YAS-07202 plugin execution error, Median failed to converge within 1 after 0 iterations.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 1, 0, null)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (2.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 1, 0, false)) from dual;

ST_ASTEXT(ST_GEOMETR                                             
---------------------------------------------------------------- 
POINT (2.000000000000000 2.000000000000000)                     

1 row fetched.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 1, -1, false)) from dual;

YAS-07202 plugin execution error, Maximum iterations must be positive.

select st_astext(st_geometricMedian(st_geomfromtext('MultiPoint(1 1, 2 2, 3 3)'), 1, null, false)) from dual;

YAS-07202 plugin execution error, Maximum iterations must be positive.

```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_GeometricMedian.html](https://postgis.net/docs/manual-3.3/ST_GeometricMedian.html)  