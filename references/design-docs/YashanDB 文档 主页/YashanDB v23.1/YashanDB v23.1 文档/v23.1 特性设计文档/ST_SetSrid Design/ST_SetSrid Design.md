Created by 胡威振, last modified on 七月 04, 2023

**SR链接：**    [YDBRD-13302](https://jira.yasdb.com/browse/YDBRD-13302?src=confmacro)    **-**  **支持ST_SetSRID函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- 将几何体上的SRID设置为特定的整数值。
- 输入存在Null则返回Null，否则返回已经设置好Srid的Geometry。
- 输入的Srid如果是负数，则按照0（默认值处理）。
- 第二个参数支持隐式转换。


#   [2. Grammer（语法）](#2-grammer语法)  

```
geometry ST_SetSRID(geometry geom, integer srid);

```

- udf


```
create or replace function MDSYS.ST_SETSRID(geom in ST_GEOMETRY, srid in integer) return ST_GEOMETRY is
    geometry ST_GEOMETRY;
    head raw(40);
    ewkb blob;
begin
    SYS.GEOMETRY.ST_SETSRID(geom.head, geom.geom, srid, head, ewkb);
    if ewkb is null then
        return null;
    end if; 
    geometry := new ST_GEOMETRY(head, ewkb);
    return geometry;
end;
/

create or replace public synonym ST_SETSRID for MDSYS.ST_SETSRID
/

```

#   [3. Details（详细设计）](#3-details详细设计)  

- 输入存在为NULL，直接返回NULL。
- 判断输入的Srid，如果小于0，则给默认值0。
- 根据输入的srid，设置输出geometry的头部和wkb的srid。


```
    int32_t srid = vSrid.vInt32 &lt; 0 ? SRID_DEFAULT : vSrid.vInt32;
    GeomSerialHead gsHead = *(GeomSerialHead*)vGsHead.vBytes;
    gsHead.srid = srid;
    GeomSerial gsOut = {.head = &amp;gsHead};

    Geometry *geom;
    YSPI_RESOURCE_CALL(piGsToGeom(hExec, &amp;gsIn, &amp;geom), piFreeMem(hExec, gsIn.ewkb));
    piFreeMem(hExec, gsIn.ewkb);
    
    geom-&gt;srid = srid;
    YSPI_CALL(piGeomToGs(hExec, geom, &amp;gsOut));
    value.isNull = false;
    value.type = YSPI_BYTES;

    value.size = vGsHead.size;
    value.vBytes = (uint8_t*)&amp;gsHead;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 3, &amp;value), piFreeMem(hExec, gsOut.ewkb));

    value.size = gsOut.ewkbSize;
    value.vBytes = gsOut.ewkb;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 4, &amp;value), piFreeMem(hExec, gsOut.ewkb));
    piFreeMem(hExec, gsOut.ewkb);

```

#   [4. Example（用例）](#4-example用例)  

```
SQL&gt; select st_srid(st_boundary(st_setsrid(st_geomfromtext('point(1 2)'), 1))) from dual;

ST_SRID(ST_BOUNDARY( 
-------------------- 
                   1

1 row fetched.

SQL&gt; select st_srid(st_setsrid(st_geomfromtext('point(1 2)'), -100)) from dual;

ST_SRID(ST_SETSRID(S 
-------------------- 
                   0

1 row fetched.

SQL&gt; select st_srid(st_setsrid(st_geomfromtext('point(1 2)'), 0)) from dual;

ST_SRID(ST_SETSRID(S 
-------------------- 
                   0

1 row fetched.

SQL&gt; select st_srid(st_setsrid(st_geomfromtext('point(1 2)'), 1)) from dual;

ST_SRID(ST_SETSRID(S 
-------------------- 
                   1

1 row fetched.

SQL&gt; select st_srid(st_setsrid(st_geomfromtext('point(1 2)'), null)) from dual;

ST_SRID(ST_SETSRID(S 
-------------------- 
                    

1 row fetched.


```

#   [5. Reference（参考文档）](#5-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_SetSRID.html](https://postgis.net/docs/manual-3.3/ST_SetSRID.html)  