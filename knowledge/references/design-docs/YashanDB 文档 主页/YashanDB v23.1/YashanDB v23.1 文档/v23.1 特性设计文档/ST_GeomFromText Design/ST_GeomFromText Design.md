Created by 胡威振, last modified on 四月 18, 2023

**SR链接：**    [YDBRD-13234](https://jira.yasdb.com/browse/YDBRD-13234?src=confmacro)    -  支持以WKT格式输入Geometry对象  完成

#   [1. Overview（概述）](#1-overview概述)  

- ST_GeomFromText函数的功能是返回一个根据输入的WKT返回一个Geometry。该函数有两种变体。第一种是不接受SRID，返回一个没有定义空间参考系统的Geometry(即SRID=0)。第二个以SRID作为第二个参数，并返回一个空间参考系为SRID的Geometry。
- 支持的Geometry类型：Point、LineString、Polygon、MultiPoint、MultiLineString、MultiPolygon、GeometryCollection。
- 如果输入存在null，则返回null，空串作为null值处理。
- 第一个参数支持隐式转换(转成clob类型)；第二个参数支持隐式转换(转成integer)，小数做四舍五入处理。
- 暂时不支持直接查ST_GeomFromText，需要结合ST_AsText一起使用。
- 如果输入的WKT是一个不合法的Geometry，则会报解析失败的错误。
- 支持POINT EMPTY这样的输入。


#   [2. Grammar（语法）](#2-grammar语法)  

```
geometry ST_GeomFromText(WKT clob, srid in integer default 0);

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
piGeosGSFromWkt()
geomFromWkt()

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

```
内部主要通过调用geos_c GEOSSetSRID_r()、GEOSGeomFromWKT_r()、GEOSWKBWriter_write_r()等函数来实现解析，然后转成我们自己定义的类型。

```

```
static YspiResult geomFromWkt(YspiHandle hExec)
{
    YspiValue vSrid;
    if (yspiGetArg(hExec, 1, YSPI_INTEGER, &amp;vSrid) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }

    uint32_t wktSize;
    char* wkt;
    bool hasNull = false;
    if (piGetLobArg(hExec, 0, YSPI_CLOB, &amp;wktSize, &amp;wkt, &amp;hasNull) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }

    YspiValue value;
    if (hasNull || vSrid.isNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        return yspiReturnAsLob(hExec, YSPI_BLOB, &amp;value);
    }

    int32_t srid = vSrid.vInt32;
    GeomSerial* gs;
    uint32_t gsSize;
    if (piGeosGSFromWkt(hExec, wkt, srid, &amp;gs, &amp;gsSize) != YSPI_SUCCESS) {
        piFreeMem(hExec, wkt);
        return YSPI_ERROR;
    }

    value.type = YSPI_BYTES;
    value.vBytes = (uint8_t*)gs;
    value.size = gsSize;
    value.isNull = false;
    YspiResult result = yspiReturnAsLob(hExec, YSPI_BLOB, &amp;value);
    piFreeMem(hExec, gs);
    return result;
}

```

#   [5. Example（用例）](#5-example用例)  

- 类型


```
SQL&gt; select ST_AsText(ST_GeomFromText('POINT (1 2)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT (1.0 2.0)                                                 

SQL&gt; select ST_AsText(ST_GeomFromText('POINT Z (1 2 3)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT Z (1.0 2.0 3.0)                                           

SQL&gt; select ST_AsText(ST_GeomFromText('POINT ZM (1 2 3 4)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT Z (1.0 2.0 3.0)                                           

SQL&gt; select ST_AsText(ST_GeomFromText('LINESTRING (1 2, 3 4, 5 6)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
LINESTRING (1.0 2.0, 3.0 4.0, 5.0 6.0)                          

SQL&gt; select ST_AsText(ST_GeomFromText('LINEARRING (0 0 0, 4 0 0, 4 4 0, 0 4 0, 0 0 0)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
LINESTRING Z (0.0 0.0 0.0, 4.0 0.0 0.0, 4.0 4.0 0.0, 0.0 4.0 0.0, 0.0 0.0 0.0)

SQL&gt; select ST_AsText(ST_GeomFromText('POLYGON ((0 0 0,4 0 0,4 4 0,0 4 0,0 0 0),(1 1 0,2 1 0,2 2 0,1 2 0,1 1 0))'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POLYGON Z ((0.0 0.0 0.0, 4.0 0.0 0.0, 4.0 4.0 0.0, 0.0 4.0 0.0, 0.0 0.0 0.0), (1.0 1.0 0.0, 2.0 1.0 0.0, 2.0 2.0 0.0, 1.0 2.0 0.0, 1.0 1.0 0.0))

SQL&gt; select ST_AsText(ST_GeomFromText('MULTIPOINT ( (0 0), (1 2) )'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
MULTIPOINT (0.0 0.0, 1.0 2.0)                                   

SQL&gt; select ST_AsText(ST_GeomFromText('MULTILINESTRING ( (0 0,1 1,1 2), (2 3,3 2,5 4) )'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
MULTILINESTRING ((0.0 0.0, 1.0 1.0, 1.0 2.0), (2.0 3.0, 3.0 2.0, 5.0 4.0))

SQL&gt; select ST_AsText(ST_GeomFromText('MULTIPOLYGON (((1 5, 5 5, 5 1, 1 1, 1 5)), ((6 5, 9 1, 6 1, 6 5)))'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
MULTIPOLYGON (((1.0 5.0, 5.0 5.0, 5.0 1.0, 1.0 1.0, 1.0 5.0)), ((6.0 5.0, 9.0 1.0, 6.0 1.0, 6.0 5.0)))

SQL&gt; select ST_AsText(ST_GeomFromText('GEOMETRYCOLLECTION ( POINT(2 3), LINESTRING(2 3, 3 4))'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
GEOMETRYCOLLECTION (POINT (2.0 3.0), LINESTRING (2.0 3.0, 3.0 4.0))


```

- null测试


```
SQL&gt; select ST_AsText(ST_GeomFromText('POINT (1 2)', null), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.

SQL&gt; select ST_AsText(ST_GeomFromText(null, 4326), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.


```

- integer


```
SQL&gt; select ST_Srid(st_GeomFromText('POINT(1 2)', 4326)) from dual;

ST_SRID(ST_GEOMFROMT 
-------------------- 
                4326

1 row fetched.

SQL&gt; select ST_Srid(st_GeomFromText('POINT(1 2)', 4326.4)) from dual;

ST_SRID(ST_GEOMFROMT 
-------------------- 
                4326

1 row fetched.

SQL&gt; select ST_Srid(st_GeomFromText('POINT(1 2)', 4326.5)) from dual;

ST_SRID(ST_GEOMFROMT 
-------------------- 
                4327

1 row fetched.


```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_GeomFromText.html](https://postgis.net/docs/manual-3.3/ST_GeomFromText.html)  