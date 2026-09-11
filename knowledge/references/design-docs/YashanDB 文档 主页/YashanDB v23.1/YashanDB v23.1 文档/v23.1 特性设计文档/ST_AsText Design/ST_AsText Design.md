Created by 胡威振, last modified on 四月 26, 2023

**SR链接：**    [YDBRD-13235](https://jira.yasdb.com/browse/YDBRD-13235?src=confmacro)    **-**  **支持将Geometry对象以WKT格式输出**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_AsText函数的功能是返回一个Geometry的    [Well-Known Text](https://postgis.net/docs/manual-3.3/using_postgis_dbmanagement.html#OpenGISWKBWKT)    (WKT)。
- 第二个参数maxdecimaldigits表示输出的坐标中小数点后的位数（默认为15），位数不够则补零。
- 如果输入存在null值，则返回null，空串作为null值处理。
- 第一个参数不支持隐式转换，第二个参数支持隐式转换，小数做四舍五入处理。
- maxdecimaldigits最大值不是15，但是超过15之后的精度就没有什么意义。


#   [2. Restrict（限制）](#2-restrict限制)  

- 支持四维坐标的输入，当前版本不支持输出四维坐标，如果输出的是四维，那么输出的时候只会输出前三个坐标。
- 对于使用ST_GeomFromText函数生成的Geometry而言，输出的point的坐标维度是根据坐标的个数决定的，而不是又 'point z'、'point m'决定的。
- 对于包含多个Geometry的Geometry而言，输出的坐标的维度是当前Geometry中坐标维度的最大值，但不会超过3维，如果维度不够，则补零。
- 如果GEOMETRYCOLLECTION成员包含GEOMETRYCOLLECTION，则会舍弃掉GEOMETRYCOLLECTION成员部分。
- 对于集合类的Geometry，如果内部已经有坐标，则不能使用empty相关的东西。例如：


```
SQL&gt; select st_astext(st_geomfromtext('point z(1 2)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT (1.0 2.0)                                                 

1 row fetched.

SQL&gt; select st_astext(st_geomfromtext('point m(1 2)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT (1.0 2.0)                                                 

1 row fetched.

SQL&gt; select st_astext(st_geomfromtext('point m(1 2 3)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT Z (1.0 2.0 3.0)                                           

1 row fetched.

SQL&gt; select st_astext(st_geomfromtext('multipoint((0 0 0), (9 0))'), 0) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
MULTIPOINT Z (0 0 0, 9 0 0)                                     

1 row fetched.

SQL&gt; select st_astext(st_geomfromtext('MULTIPOINT (0.000000000000000 0.000000000000000, 2.000000000000000 0.000000000000000, EMPTY)')) from dual;

YAS-07202 plugin execution error, ParseException: Expected number but encountered word: 'EMPTY'


```

#   [3. Grammar（语法）](#3-grammar语法)  

```
clob ST_AsText(geom geometry);
clob ST_AsText(geom geometry, maxdecimaldigits integer default 15);

```

#   [4. Interfaces（接口）](#4-interfaces接口)  

```
piGeosGSAsWkt()
geomAsWkt()

```

#   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

```
内部主要通过调用geos_c GEOSWKTWriter_create_r()、GEOSWKTWriter_setOutputDimension_r()、GEOSWKTWriter_setRoundingPrecision_r()、GEOSWKTWriter_write_r()等接口来实现的。

```

```
static YspiResult geomAsWkt(YspiHandle hExec)
{
    YspiValue vPrecision;
    if (yspiGetArg(hExec, 1, YSPI_INTEGER, &amp;vPrecision) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }

    uint32_t size;
    GeomSerial* gs;
    bool hasNull = false;
    if (piGetLobArg(hExec, 0, YSPI_BLOB, &amp;size, (char**)&amp;gs, &amp;hasNull) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }

    YspiValue value;
    if (hasNull || vPrecision.isNull) {
        varAsNull(&amp;value, YSPI_STRING);
        return yspiReturnAsLob(hExec, YSPI_CLOB, &amp;value);
    }

    char* wkt;
    if (piGeosGSToWkt(hExec, gs, size, vPrecision.vInt32, &amp;wkt) != YSPI_SUCCESS) {
        piFreeMem(hExec, gs);
        return YSPI_ERROR;
    }

    piFreeMem(hExec, gs);
    value.type = YSPI_STRING;
    value.vStr = wkt;
    value.size = (uint32_t)strlen(wkt);
    value.isNull = false;
    YspiResult result = yspiReturnAsLob(hExec, YSPI_CLOB, &amp;value);
    piFreeMem(hExec, wkt);
    return result;
}

```

#   [6. Example（用例）](#6-example用例)  

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
SQL&gt; select ST_AsText(ST_GeomFromText('POINT (1 2)'), null) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
                                                                

1 row fetched.

SQL&gt; select ST_AsText(null, 1) from dual;

ST_ASTEXT(NULL,1)                                                
---------------------------------------------------------------- 
                                                                

1 row fetched.


```

- integer


```
SQL&gt; select ST_AsText(ST_GeomFromText('POINT (1 2.345)'), 2) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT (1.00 2.35)                                               


SQL&gt; select ST_AsText(ST_GeomFromText('POINT (1 2.345)'), 1) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT (1.0 2.3)                                                 

SQL&gt; select ST_AsText(ST_GeomFromText('POINT (1 2)')) from dual;

ST_ASTEXT(ST_GEOMFRO                                             
---------------------------------------------------------------- 
POINT (1.000000000000000 2.000000000000000)                     


```

#   [7. Reference（参考文档）](#7-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_AsText.html](https://postgis.net/docs/manual-3.3/ST_AsText.html)  