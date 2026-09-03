Created by 胡威振, last modified on 四月 27, 2023

**SR链接：**    [YDBRD-13369](https://jira.yasdb.com/browse/YDBRD-13369?src=confmacro)    **-**  **支持几何对象处理函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_Simplify函数的功能是：使用Douglas-Peucker算法来简化输入的Geometry。
- 第二个参数表示容差，容差越大，生成的Geometry越简化。如果输入的是负数，则转化成对应的正数进行计算。
- 输入存在null则返回null。
- 允许输入3D坐标，但只会计算2D的结果。
- 当第二个参数大到一定程度的时候，原来的Geometry可能会消失(变成EMPTY)。
- 输入的是Point、MultiPoint，则直接返回原来的值。
- 输入的是LineString、MultiLineString，除非输入的是LINESTRING EMPTY或者是MULTILINESTRING EMPTY，才会返回EMPTY，否则即使缩小到最大程度也会至少保留两个点。
- 输入的是Polygon、MultiPolygon，缩小到一定程度之后会返回POLYGON EMPTY 或 MULTIPOLYGON EMPTY。
- 输入的是GeometryCollection，内部的Geometry与前面所述一致。


#   [2. Grammer（语法）](#2-grammer语法)  

```
geometry ST_Simplify(geom geometry, double tolerance);

```

- udf


```
create or replace function MDSYS.ST_SIMPLIFY(geom in ST_GEOMETRY, tolerance in double) return ST_GEOMETRY is
    geometry ST_GEOMETRY;
    head raw(40);
    ewkb blob;
begin
    SYS.GEOMETRY.ST_SIMPLIFY(geom.head, geom.geom, tolerance, head, ewkb);
    if ewkb is null then
        return null;
    end if;
    geometry := new ST_GEOMETRY(head, ewkb);
    return geometry;
end;
/

create or replace public synonym ST_SIMPLIFY for MDSYS.ST_SIMPLIFY
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeosGSSimplify()
geomSimplify()

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

```
主要是调用GEOSSimplify_r函数。

```

#   [5. Example（用例）](#5-example用例)  

- tolerance


```
select ST_AsText(ST_Simplify(st_geomfromtext('LINESTRING (3 5, 4 5, 2 1, 3 5)'), 1), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
LINESTRING (3 5, 2 1, 3 5)                                      

select ST_AsText(ST_Simplify(st_geomfromtext('LINESTRING (3 5, 4 5, 2 1, 3 5)'), -1), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
LINESTRING (3 5, 2 1, 3 5)                                      


```

- Point、MultiPoint


```
select ST_AsText(ST_Simplify(st_geomfromtext('point(1 1)'), 100000000), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
POINT (1 1)                                                     

select ST_AsText(ST_Simplify(st_geomfromtext('POINT EMPTY'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
POINT EMPTY                                                     


select ST_AsText(ST_Simplify(st_geomfromtext('MULTIPOINT (EMPTY) '), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
MULTIPOINT EMPTY                                                


```

- LineString、MultiLineString


```
select ST_AsText(ST_Simplify(st_geomfromtext('LINESTRING (3 5, 4 6, 2 1, 3 5)'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
LINESTRING (3 5, 3 5)                                           

select ST_AsText(ST_Simplify(st_geomfromtext('LINESTRING (3 5, 3 5)'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
LINESTRING (3 5, 3 5)                                           

select ST_AsText(ST_Simplify(st_geomfromtext('LINESTRING EMPTY'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
LINESTRING EMPTY                                                


select ST_AsText(ST_Simplify(st_geomfromtext('MULTILINESTRING EMPTY'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
MULTILINESTRING EMPTY                                           


```

- Polygon、MultiPolygon


```
select ST_AsText(ST_Simplify(st_geomfromtext('POLYGON EMPTY'), 3), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

select ST_AsText(ST_Simplify(st_geomfromtext('MULTIPOLYGON EMPTY'), 3), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
MULTIPOLYGON EMPTY                                              

select ST_AsText(ST_Simplify(st_geomfromtext('POLYGON ((0 0, 1 0, 1 1, 0 1, 0 0))'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

select ST_AsText(ST_Simplify(st_geomfromtext('MULTIPOLYGON (((0 0, 10 0, 10 10, 0 10, 0 0), (2 2, 2 5, 5 5, 5 2, 2 2)))'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
MULTIPOLYGON EMPTY                                              


```

- GeometryCollection


```
select ST_AsText(ST_Simplify(st_geomfromtext('GEOMETRYCOLLECTION (MULTIPOLYGON (((0 0, 10 0, 10 10, 0 10, 0 0), (2 2, 2 5, 5 5, 5 2, 2 2))), POINT (0 0), MULTILINESTRING ((0 0, 2 0, 0 0), (1 1, 2 2, 1 1)))'), 100), 0) from dual;

ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
GEOMETRYCOLLECTION (POINT (0 0), MULTILINESTRING ((0 0, 0 0), (1 1, 1 1)))

select ST_AsText(ST_Simplify(st_geomfromtext('GEOMETRYCOLLECTION (MULTIPOLYGON (((0 0, 10 0, 10 10, 0 10, 0 0), (2 2, 2 5, 5 5, 5 2, 2 2))), MULTILINESTRING ((0 0, 2 0, 0 0), (1 1, 2 2, 1 1)))'), 100), 0) from dual;
ST_ASTEXT(ST_SIMPLIF                                             
---------------------------------------------------------------- 
GEOMETRYCOLLECTION (MULTILINESTRING ((0 0, 0 0), (1 1, 1 1)))   


```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Simplify.html](https://postgis.net/docs/manual-3.3/ST_Simplify.html)  