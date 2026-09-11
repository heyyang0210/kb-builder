Created by 王仁松, last modified on 四月 27, 2023

**SR链接：**    [YDBRD-10938](https://jira.yasdb.com/browse/YDBRD-10938?src=confmacro)    **-**  **GIS：属性访问函数**  **完成**

![](https://pingcode.yasdb.com/atlas/files/public/67396a898970c2af4f51fe9e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI0OTIsImV4cCI6MTc4MjIyMzI5Mn0.vdwMcv2LckiF59fK5iuoEHOsyafdyTiKq1tW2cl0RqI)

#   [1. Overview（概述）](#1-overview概述)  

- 根据输入的geometry返回一个闭包, 类型为geometry，作用是返回对应输入的geometry对象的组合边界
- 多边形的边界是分隔外部和内部的线性环
- 线的边界是端点
- 点的边界就是点(空点)
- 不支持GEOMETRYCOLLECTION的输入


#   [2. Grammar（语法）](#2-grammar语法)  

```
geometry ST_Boundary(geometry geomA);

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
static YspiResult geomBoundary(YspiHandle hExec)

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

内部直接通过调用GEOS库ST_Boundary拿到边界geom，组合对应head和ewkb组合成geometry返回。

```
static YspiResult geomBoundary(YspiHandle hExec)
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

    YSPI_RESOURCE_CALL(piGeosGSBoundary(hExec, &amp;gsIn, &amp;gs), piFreeMem(hExec, gsIn.ewkb));

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

YspiResult piGeosGSBoundary(YspiHandle hExec, GeomSerial* gsIn, GeomSerial* gsOut)
{
    GeosCtx  ctx = piGeosInit();
    GeosGeom geom = GEOSGeomFromWKB_buf_r(ctx, gsIn-&gt;ewkb, gsIn-&gt;ewkbSize);
    if (geom == NULL) {
        piGeosSetError(hExec);
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    GeosGeom ret = GEOSBoundary_r(ctx, geom);
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

#   [5. 规格说明](#5-规格说明)  

- 规格特别说明


1. GEOS不支持GEOMETRYCOLLECTION的输入，因此对于GEOMETRYCOLLECTION类型的输入会报错
1. 对于线来说，输出的边界端点，按照x，y坐标轴上的顺序输出，z坐标不参与计算，比如：linestring(1 2, -2 4, -1 3)会输出multipoint(-1 3, 1 2)
1. 线如果是闭环线，则输出empty


与postgis的规格差异：

|场景|geos|postgis|
|---|---|---|
|point|GEOMETRYCOLLECTION EMPTY|POINT EMPTY|
|multipoint|GEOMETRYCOLLECTION EMPTY|MULTIPOINT EMPTY|
|linestring端点相同（3D）|MULTIPOINT EMPTY|支持Z坐标|
|geometrycollection|不支持，报错|支持geometrycollection|
|multipolygon emptry|MULTILINESTRING EMPTY|GEOMETRYCOLLECTION EMPTY|
|linestring或者multilinestring输出|输出的点按照X坐标从负到正的顺序，Y坐标从负到正的顺序输出（X相等，则比较Y）|输出的点按照输入的顺序输出|


更多详细差异可见附件

#   [6. Example（用例）](#6-example用例)  

- 类型


```

SQL&gt; SELECT ST_AsText(ST_Boundary(ST_GeomFromText('LINESTRING(1 1,0 0, -1 1)'))) from dual;

ST_ASTEXT(ST_BOUNDAR
----------------------------------------------------------------
MULTIPOINT (1.000000000000000 1.000000000000000, -1.000000000000000 1.000000000000000)

1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Boundary(ST_GeomFromText('POLYGON((1 1,0 0, -1 1, 1 1))'))) from dual;

ST_ASTEXT(ST_BOUNDAR
----------------------------------------------------------------
LINESTRING (1.000000000000000 1.000000000000000, 0.000000000000000 0.000000000000000, -1.000000000000000 1.000000000000000, 1.000000000000000 1.000000000000000)

1 row fetched.
-- 不支持GeometryCollection
SQL&gt; SELECT ST_AsText(ST_Boundary(ST_GeomFromText('GEOMETRYCOLLECTION ( POINT(2 3), LINESTRING(2 3, 3 4))'))) from dual;

YAS-07202 plugin execution error, IllegalArgumentException: Operation not supported by GeometryCollection
-- multilnestring
SQL&gt; select st_astext(st_boundary(st_geomfromtext('multilinestring((1 1, 2 2, 1 1), (2 2, 3 3, 4 4))'))) from dual;

ST_ASTEXT(ST_BOUNDAR
----------------------------------------------------------------
MULTIPOINT (2.000000000000000 2.000000000000000, 4.000000000000000 4.000000000000000)

1 row fetched.
-- 不支持z坐标
SQL&gt; select st_astext(st_boundary(st_geomfromtext('LINESTRING(1 2 -1, -2 4 -2, 1 2 -3)')), 1) from dual;

ST_ASTEXT(ST_BOUNDAR
----------------------------------------------------------------
MULTIPOINT EMPTY

1 row fetched.


```

- null测试


```

SQL&gt; SELECT ST_AsText(ST_Boundary(ST_GeomFromText('point (1 2 1)', NULL))) from dual;

ST_ASTEXT(ST_BOUNDAR
----------------------------------------------------------------


1 row fetched.

SQL&gt; SELECT ST_AsText(ST_Boundary(ST_GeomFromText(NULL))) from dual;

ST_ASTEXT(ST_BOUNDAR
----------------------------------------------------------------


1 row fetched.



```

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

select id, ST_AsText(ST_Boundary(shp)) from test_geom where geom_type != 'Geometry Collection';

drop table test_geom;

```

#   [7. Reference（参考文档）](#7-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_Boundary.html](https://postgis.net/docs/manual-3.3/ST_Boundary.html)  

# 附件

建表语句：

yasdb输出：

postgis输出：

  


  


## Attachments:

[st_boundary_postgis.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhODk4OTcwYzJhZjRmNTFmZTlhIiwicmVmX2lkIjoiNjczOTZhODk1OTNmOTljOWZmMjM1OTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNDkyLCJleHAiOjE3ODIyOTg4OTJ9.gwmYVbB6VZxB_hm5tBpke4LXxrYh02zQh-UjaTYBgyo)

 (application/octet-stream)    


[st_boundary_yasdb.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhODlhMWFkOWEzMzExZGM3ZDExIiwicmVmX2lkIjoiNjczOTZhODk1OTNmOTljOWZmMjM1OTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNDkyLCJleHAiOjE3ODIyOTg4OTJ9.7FjQwV9_os-bhXAuC6SeLYbfyx0AaPAz6FXhX5zXLGY)

 (application/octet-stream)    


[YDBRD_10938.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhODk4OTcwYzJhZjRmNTFmZTljIiwicmVmX2lkIjoiNjczOTZhODk1OTNmOTljOWZmMjM1OTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNDkyLCJleHAiOjE3ODIyOTg4OTJ9.xchu4BhKhhqSHF2tgT6c6WegkNQCmL8gj6vnvUFv8Ug)

 (application/octet-stream)    
