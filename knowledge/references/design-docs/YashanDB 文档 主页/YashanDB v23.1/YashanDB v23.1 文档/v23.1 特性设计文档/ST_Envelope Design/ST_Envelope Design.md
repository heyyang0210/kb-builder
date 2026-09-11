Created by 王仁松 on 四月 27, 2023

**SR链接：**    [YDBRD-10938](https://jira.yasdb.com/browse/YDBRD-10938?src=confmacro)    **-**  **GIS：属性访问函数**  **完成**

![](https://postgis.net/docs/manual-3.3/images/st_envelope01.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI2MzgsImV4cCI6MTc4MjIyMzQzOH0.dHCC3d3zWkfFgpjQhZZFSMj4k8sBMPcu0-vjILjNthE)

#   [1. Overview（概述）](#1-overview概述)  

- 根据输入的geometry返回一个最小外包矩形
- 输出类型为geometry
- 对于点point特殊输入，输出的geometry类型会从polygon退化返回点
- 目前还不支持3D
- postgis的输出是顺时针输出，本文是逆时针输出


#   [2. Grammar（语法）](#2-grammar语法)  

```
geometry ST_Envelope(geometry g1);

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
static YspiResult geomEnvelope(YspiHandle hExec)

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

内部直接通过调用GEOS库ST_Envelope拿到外包矩形geom，组合对应head和ewkb组合成geometry返回。

```
static YspiResult geomEnvelope(YspiHandle hExec)
{
    YspiValue value;
    GeomSerial gsIn;
    bool hasNull = false;
    YSPI_CALL(piGetLobArg(hExec, 0, YSPI_BLOB, &amp;gsIn.ewkbSize, (char**)&amp;gsIn.ewkb, &amp;hasNull));
    if (hasNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        YSPI_CALL(yspiSetOutArg(hExec, 1, &amp;value, false));
        varAsNull(&amp;value, YSPI_BLOB);
        return yspiSetOutArg(hExec, 2, &amp;value, false);
    }

    GeomSerialHead gsHead;
    GeomSerial gs = {.head = &amp;gsHead};

    YSPI_RESOURCE_CALL(piGeosGSEnvelope(hExec, &amp;gsIn, &amp;gs), piFreeMem(hExec, gsIn.ewkb));

    piFreeMem(hExec, gsIn.ewkb);
    value.type = YSPI_BYTES;
    value.vBytes = (uint8_t*)gs.head;
    value.size = gs.headSize;
    value.isNull = false;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 1, &amp;value, false), piFreeMem(hExec, gs.ewkb));

    value.type = YSPI_BYTES;
    value.vBytes = gs.ewkb;
    value.size = gs.ewkbSize;
    value.isNull = false;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 2, &amp;value, false), piFreeMem(hExec, gs.ewkb));
    piFreeMem(hExec, gs.ewkb);
    return YSPI_SUCCESS;
}

YspiResult piGeosGSEnvelope(YspiHandle hExec, GeomSerial* gsIn, GeomSerial* gsOut)
{
    GeosCtx  ctx = piGeosInit();
    GeosGeom geom = GEOSGeomFromWKB_buf_r(ctx, gsIn-&gt;ewkb, gsIn-&gt;ewkbSize);
    if (geom == NULL) {
        piGeosSetError(hExec);
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    GeosGeom ret = GEOSEnvelope_r(ctx, geom);
    if (ret == NULL) {
        piGeosSetError(hExec);
        piGeosGeomDestroy(ctx, geom);
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    piGeosGeomDestroy(ctx, geom);

    if (piGeosGeomToGS(hExec, ctx, ret, gsOut) != YSPI_SUCCESS) {
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    piGeosGeomDestroy(ctx, ret);
    piGeosFinish(ctx);
    return YSPI_SUCCESS;
}

```

#   [5. 规格差异](#5-规格差异)  

与postgis的规格差异：

|场景|geos|postgis|
|---|---|---|
|返回polugon|逆时针输出|顺时针输出|
|垂直线、水平线|返回polygon|返回linestring|
|任意类型empty|返回point empty|返回对应类型empty|


详细差异可见附件

#   [6. Example（用例）](#6-example用例)  

- 类型


```

SQL&gt; select st_astext(st_envelope(st_geomfromtext('point(1 3)')), 0) from dual;

ST_ASTEXT(ST_ENVELOP
----------------------------------------------------------------
POINT (1 3)

1 row fetched.
-- 垂直线
SQL&gt; select st_astext(st_envelope(st_geomfromtext('linestring(1 3, 1 4)')), 0) from dual;

ST_ASTEXT(ST_ENVELOP
----------------------------------------------------------------
POLYGON ((1 3, 1 3, 1 4, 1 4, 1 3))

1 row fetched.
-- 水平线
SQL&gt; select st_astext(st_envelope(st_geomfromtext('linestring(2 3, 3 3)')), 0) from dual;

ST_ASTEXT(ST_ENVELOP
----------------------------------------------------------------
POLYGON ((2 3, 3 3, 3 3, 2 3, 2 3))

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Envelope(ST_GeomFromText('GEOMETRYCOLLECTION (LINESTRING(55 75,125 150), POINT(20 80))')), 0) from dual;

ST_ASTEXT(ST_ENVELOP
----------------------------------------------------------------
POLYGON ((20 75, 125 75, 125 150, 20 150, 20 75))

1 row fetched.


```

- null测试


```

SQL&gt; SELECT ST_AsText(ST_Envelope(ST_GeomFromText('point (1 2 1)', NULL))) from dual;

ST_ASTEXT(ST_ENVELOP
----------------------------------------------------------------


1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Envelope(ST_GeomFromText(NULL))) from dual;

ST_ASTEXT(ST_ENVELOP
----------------------------------------------------------------


1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Envelope(NULL)) from dual;

ST_ASTEXT(ST_ENVELOP
----------------------------------------------------------------


1 row fetched.



```

- 规格特别说明对于point类型的输入，会输出point，包括multipoint是同一个点的情况
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

select id, ST_AsText(ST_Envelope(shp)) from test_geom;

drop table test_geom;

```

#   [7. Reference（参考文档）](#7-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Envelope.html](https://postgis.net/docs/manual-3.3/ST_Envelope.html)  

# 附件

建表语句：

yasdb输出：

postgis输出：

## Attachments:

[st_envelope_postgis.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGI4OTcwYzJhZjRmNTFmZWFjIiwicmVmX2lkIjoiNjczOTZhOGI1OTNmOTljOWZmMjM1OTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNjM4LCJleHAiOjE3ODIyOTkwMzh9.2auQ7mQQkyPAxLf1MAitj4IgBOXrMYIsIag61Cwm6_I)

 (application/octet-stream)    


[st_envelope_yasdb.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGI4OTcwYzJhZjRmNTFmZWFkIiwicmVmX2lkIjoiNjczOTZhOGI1OTNmOTljOWZmMjM1OTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNjM4LCJleHAiOjE3ODIyOTkwMzh9.aVe1bkxGSE4KhZUdoOtU36dQ_nw0kjolnSFBKjqMsw4)

 (application/octet-stream)    


[YDBRD_10938.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGI4OTcwYzJhZjRmNTFmZWFlIiwicmVmX2lkIjoiNjczOTZhOGI1OTNmOTljOWZmMjM1OTYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNjM4LCJleHAiOjE3ODIyOTkwMzh9.Lq11wq2bsEDF-BAAo7HfoGNoowC-AjffIigOcGvj2mo)

 (application/octet-stream)    
