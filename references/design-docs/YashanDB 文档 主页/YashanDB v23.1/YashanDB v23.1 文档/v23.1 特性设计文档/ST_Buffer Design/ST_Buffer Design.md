Created by 胡威振, last modified on 五月 24, 2023

**SR链接：**    [YDBRD-13369](https://jira.yasdb.com/browse/YDBRD-13369?src=confmacro)    **-**  **支持几何对象处理函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- 功能：计算一个Geometry，覆盖从给定的Geometry到给定的距离width内的所有点，实际上得到的计算结果始终是一个有效的Polygon。
- 如果输入的width是一个负值，则会缩小该Geometry，极端情况下会使结果的Polygon缩小为0，从而返回POLYGON EMPTY;对于Point和LineString而言，如果width是负值，则始终返回POLYGON EMPTY。
- 距离的单位是给定的Geometry的空间参考系的单位。
- 该函数只会计算2D场景，如果输入的是3D，则会忽略Z坐标进行计算，计算结果仍然是一个2D的Geometry。
- 如果输入的是一个EMPTY的Geometry，则会返回POLYGON EMPTY。（如果一个GeometryCollection的其中一部分是EMPTY，则计算结果不一定是POLYGON EMPTY）
- 输入的坐标如果含有非法数据则报错。
- 输入存在NULL则返回NULL。
- 如果重复多次输入同一参数，则会以最后一次输入为准。
- style_params有五个参数可以设置，不同参数之间使用空格进行分割，参数顺序可以任意，参数大小写不影响结果，如果省略第三个参数，则会给默认值。具体规则如下：


>   'quad_segs=#': 表示四分之一圆有几个片段（线段），默认值是8，小于0时取0，如果输入的是小数，则会截断成整数，如果输入的是无效的数据，则转换成0，如果计算结果超过32000长度，则报错。    'endcap=round|flat(butt)|square': 端点样式，默认值是round。    'join=round|mitre(miter)|bevel': 连接的样式，默认值是round。    'mitre_limit(miter_limit)=#.#': 用于限制斜接比率，只能影响'join=mitre(miter)'，默认值是5.0。    'side=both|left|right': left 和 right表示形成一个单边的Geometry，只影响LineString，不影响Point或者Polygon(还是会形成封闭的Geometry)，both则会形成一个封闭的Geometry，默认值是both。  

#   [2. Grammer（语法）](#2-grammer语法)  

```
geometry ST_Buffer(geom geometry, width double, style  in varchar default ' ');

```

- udf


```
create or replace function MDSYS.ST_BUFFER(geom in ST_GEOMETRY, width in double, style in varchar default ' ') return ST_GEOMETRY is
    geometry ST_GEOMETRY;
    head raw(40);
    ewkb blob;
begin
    SYS.GEOMETRY.ST_BUFFER(geom.head, geom.geom, width, style, head, ewkb);
    if ewkb is null then
        return null;
    end if;
    geometry := new ST_GEOMETRY(head, ewkb);
    return geometry;
end;
/

create or replace public synonym ST_BUFFER for MDSYS.ST_BUFFER
/

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeosGSBuffer()
geomBuffer()

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

```
主要是调用GEOSBufferParams_create_r、GEOSBufferWithParams_r、GEOSBufferParams_setJoinStyle_r等相关函数，并且实现自己对第三个参数的解析。

```

#   [5. Example（用例）](#5-example用例)  

- 输入的距离是负数


```
SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT(100 90)'), -1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('LINESTRING(50 50,150 150,150 50)'), -1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POLYGON((50 50, 150 150, 150 50, 50 50))'), -1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((52 51, 149 148, 149 51, 52 51))                       

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POLYGON((50 50, 150 150, 150 50, 50 50))'), -2, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((55 52, 148 145, 148 52, 55 52))                       

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POLYGON((50 50, 150 150, 150 50, 50 50))'), -100, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('GEOMETRYCOLLECTION(MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))),POINT(0 0),MULTILINESTRING((0 0, 2 0),(1 1, 2 2)))'), -1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
MULTIPOLYGON (((1 1, 1 2, 2 1, 1 1)), ((5 1, 6 2, 6 5, 5 6, 2 6, 1 5, 1 9, 9 9, 9 1, 5 1)))

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('GEOMETRYCOLLECTION(MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))),POINT(0 0),MULTILINESTRING((0 0, 2 0),(1 1, 2 2)))'), -100, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

1 row fetched.


```

- 只会计算2D


```
SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT(100 90 100)'), 1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((101 90, 100 89, 99 90, 100 91, 101 90))               

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT Z(100 90 100)'), 1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((101 90, 100 89, 99 90, 100 91, 101 90))               

1 row fetched.


```

- Empty


```
SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT EMPTY'), 1, 'quad_segs=3'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('LINESTRING EMPTY'), 1, 'quad_segs=3'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON EMPTY                                                   

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('MULTILINESTRING((0 0, 2 0), (1 1, 2 2), EMPTY)'), 1, 'quad_segs=3'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((0 1, 0 1, 0 2, 1 3, 2 3, 2 3, 3 3, 3 2, 3 2, 3 1, 2 1, 2 1, 3 0, 3 0, 3 -0, 3 -1, 2 -1, 0 -1, -1 -1, -1 -1, -1 0, -1 0, -1 1, 0 1, 0 1))

1 row fetched.


```

- null


```

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT(100 90)'), 1, null), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText(null), 1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText(null), 1, 'quad_segs=1'), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.


```

- 默认值


```
SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT(100 90)'), 1), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((101 90, 101 90, 101 90, 101 89, 101 89, 101 89, 100 89, 100 89, 100 89, 100 89, 100 89, 99 89, 99 89, 99 89, 99 90, 99 90, 99 90, 99 90, 99 90, 99 91, 99 91, 99 91, 100 91, 100 91, 100 91, 100 91, 100 91, 101 91, 101 91, 101 91, 101 90, 101 90, 101 90))

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT(100 90)'), 1, ' '), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((101 90, 101 90, 101 90, 101 89, 101 89, 101 89, 100 89, 100 89, 100 89, 100 89, 100 89, 99 89, 99 89, 99 89, 99 90, 99 90, 99 90, 99 90, 99 90, 99 91, 99 91, 99 91, 100 91, 100 91, 100 91, 100 91, 100 91, 101 91, 101 91, 101 91, 101 90, 101 90, 101 90))

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Buffer(ST_GeomFromText('POINT(100 90)'), 1, '    '), 0) from dual;

ST_ASTEXT(ST_BUFFER(                                             
---------------------------------------------------------------- 
POLYGON ((101 90, 101 90, 101 90, 101 89, 101 89, 101 89, 100 89, 100 89, 100 89, 100 89, 100 89, 99 89, 99 89, 99 89, 99 90, 99 90, 99 90, 99 90, 99 90, 99 91, 99 91, 99 91, 100 91, 100 91, 100 91, 100 91, 100 91, 101 91, 101 91, 101 91, 101 90, 101 90, 101 90))

1 row fetched.


```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Buffer.html](https://postgis.net/docs/manual-3.3/ST_Buffer.html)  

## Comments:

|  [](null)  ,参考mysql，限制quad_segs参数的大小最大为1048576 / 4，如果超过1048576 / 4，则用1048576 / 4。,  [MySQL :: MySQL 5.7 Reference Manual :: 12.16.8 Spatial Operator Functions](https://dev.mysql.com/doc/refman/5.7/en/spatial-operator-functions.html#function_buffer)  ,Posted by huweizhen at 一月 19, 2024 16:12|
|---|
