Created by 王仁松, last modified on 五月 05, 2023

**SR链接：**    [YDBRD-10938](https://jira.yasdb.com/browse/YDBRD-10938?src=confmacro)    **-**  **GIS：属性访问函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- GeometryType函数的功能是根据输入的geometry返回geometry对象的类型type。
- 与函数Geometry的区别在于，输出的是geometry对象的type字符串没做全大写，并且在开头加入了“ST_”
- 输入对象为geometry，输出为text，即string字符串，例如: 'ST_LineString', 'ST_Point', 等等


#   [2. Grammar（语法）](#2-grammar语法)  

```
text ST_GeometryType(geometry g1);

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
static inline YspiResult geomSTGeometryType(YspiHandle hExec)

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

内部直接通过调用GEOS库GEOSGeomType_r拿到类型type的string，使用snprintf在前面拼接“ST_”返回返回varchar。

```
static inline YspiResult geomSTGeometryType(YspiHandle hExec)
{
    YspiValue value;
    GeomSerial gsIn;
    bool hasNull = false;
    YSPI_CALL(piGetLobArg(hExec, 0, YSPI_BLOB, &amp;gsIn.ewkbSize, (char**)&amp;gsIn.ewkb, &amp;hasNull));
    if (hasNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        return yspiReturn(hExec, &amp;value, false);
    }

    char* ret;
    if (piGeosGSSTGeometryType(hExec, &amp;gsIn, &amp;ret) != YSPI_SUCCESS) {
        piFreeMem(hExec, gsIn.ewkb);
        return YSPI_ERROR;
    }

    piFreeMem(hExec, gsIn.ewkb);
    value.type = YSPI_STRING;
    value.isNull = false;
    value.vStr = ret;
    value.size = (uint32_t)strlen(ret);
    YspiResult result = yspiReturn(hExec, &amp;value, false);
    piFreeMem(hExec, ret);
    return result;
}

YspiResult piGeosGSSTGeometryType(YspiHandle hExec, GeomSerial* gs, char** out)
{
    GeosCtx  ctx = piGeosInit();
    GeosGeom geom = GEOSGeomFromWKB_buf_r(ctx, gs-&gt;ewkb, gs-&gt;ewkbSize);
    if (geom == NULL) {
        piGeosSetError(hExec);
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    char* ret = GEOSGeomType_r(ctx, geom);
    if (ret == NULL) {
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    piGeosGeomDestroy(ctx, geom);
    // "ST_" in front , strlen of "ST_" is 3
    uint32_t outSize = (uint32_t)strlen(ret) + 3;
    if (piAllocMem(hExec, outSize + 1, out) != YSPI_SUCCESS) {
        piGeosFree(ctx, ret);
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    snprintf(*out, outSize + 1, "ST_%s", ret);
    (*out)[outSize] = 0;
    piGeosFree(ctx, ret);
    piGeosFinish(ctx);
    return YSPI_SUCCESS;
}

```

#   [5. Example（用例）](#5-example用例)  

- 类型


```

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('point(1 2)')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_Point

1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('LINESTRING(77.29 29.07,77.42 29.26,77.27 29.31,77.29 29.07)')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_LineString

1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('Polygon((3 3, 6 3, 6 6, 3 6, 3 3))')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_Polygon

1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('MULTIPOINT ( (0 0), (1 2) )')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_MultiPoint

1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('MULTILINESTRING ( (0 0,1 1,1 2), (2 3,3 2,5 4) )')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_MultiLineString

1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('MULTIPOLYGON (((1 5, 5 5, 5 1, 1 1, 1 5)), ((6 5, 9 1, 6 1, 6 5)))')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_MultiPolygon

1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('GEOMETRYCOLLECTION ( POINT(2 3), LINESTRING(2 3, 3 4))')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_GeometryCollection

1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('linearring(0 0 ,1 1, 1 0, 0 0)')) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------
ST_LineString

1 row fetched.



```

- null测试


```

SQL&gt; SELECT GeometryType(null) from dual;

GEOMETRYTYPE(NULL)
----------------------------------------------------------------


1 row fetched.

SQL&gt; SELECT ST_GeometryType(ST_GeomFromText('linearring(0 0 ,1 1, 1 0, 0 0)', null)) from dual;

ST_GEOMETRYTYPE(ST_G
----------------------------------------------------------------


1 row fetched.


```

- 规格特别说明postgis不支持显式linearring输入，我们支持。那么GeometryType就需要处理linestring的情况，实际上返回LINESTRING处理。
- 所有支持类型查询


```
drop table if exists test_geom;
create table test_geom(id int, geom_type varchar(32), shp st_geometry);
--point
insert into test_geom values(1, 'Point2D', ST_GeomFromText('point (1 1)'));
insert into test_geom values(2, 'Point3D', ST_GeomFromText('point (1 2 1)'));
insert into test_geom values(3, 'Point Z', ST_GeomFromText('point Z(1 3 2)'));

--line string
insert into test_geom values(11, 'LineString', ST_GeomFromText('linestring(0 0, 1 1, 1 0)'));
insert into test_geom values(12, 'LineString3D', ST_GeomFromText('linestring(0 0 0, 1 1 1, 1 0 0)'));

--polygon
insert into test_geom values(21, 'Polygon Simple', ST_GeomFromText('Polygon((3 3, 6 3, 6 6, 3 6, 3 3))'));
insert into test_geom values(22, 'Polygon with hole', ST_GeomFromText('Polygon((3 3, 6 3, 6 6, 3 6, 3 3), (4 4,4 5,5 5,5 4,4 4))'));
insert into test_geom values(23, 'Polygon 3D', ST_GeomFromText('Polygon((3 3 3, 6 3 3, 6 6 6, 3 6 6, 3 3 3))'));

--linear ring
insert into test_geom values(31, 'LineRing', ST_GeomFromText('linearring(0 0 ,1 1, 1 0, 0 0)'));

--multi type
insert into test_geom values(41, 'MultiPoint', ST_GeomFromText('MULTIPOINT ( (0 0), (1 2) )'));
insert into test_geom values(42, 'MultiLineString', ST_GeomFromText('MULTILINESTRING ( (0 0,1 1,1 2), (2 3,3 2,5 4) )'));
insert into test_geom values(43, 'MultiPolygon', ST_GeomFromText('MULTIPOLYGON (((1 5, 5 5, 5 1, 1 1, 1 5)), ((6 5, 9 1, 6 1, 6 5)))'));

--collection
insert into test_geom values(51, 'Geometry Collection', ST_GeomFromText('GEOMETRYCOLLECTION ( POINT(2 3), LINESTRING(2 3, 3 4))'));

--Null
insert into test_geom values(61, 'NULL', NULL);
insert into test_geom values(62, 'Point3D', ST_GeomFromText('point (1 2 1)', NULL));
commit;

select id, ST_GeometryType(shp) from test_geom;

drop table test_geom;

```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_GeometryType.html](https://postgis.net/docs/manual-3.3/ST_GeometryType.html)  

# 附件

postgis所有类型的type的输出：

![](https://pingcode.yasdb.com/atlas/files/public/67396ac8a1ad9a3311dc7dc7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI2OTMsImV4cCI6MTc4MjIyMzQ5M30.4FHL1JBwx7mG2ry8LwbtUGbwGgPSOqrY_le1Od7wtww)

## Attachments: