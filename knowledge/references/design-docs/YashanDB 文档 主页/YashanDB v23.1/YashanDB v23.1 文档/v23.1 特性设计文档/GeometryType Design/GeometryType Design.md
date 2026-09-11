Created by 王仁松, last modified on 五月 05, 2023

**SR链接：**    [YDBRD-10938](https://jira.yasdb.com/browse/YDBRD-10938?src=confmacro)    **-**  **GIS：属性访问函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- GeometryType函数的功能是根据输入的geometry返回geometry对象的类型type。
- 输入对象为geometry，输出为text，即string字符串，例如: 'LINESTRING', 'POLYGON', 'MULTIPOINT', 等等
- 支持圆形字符串和曲线


#   [2. Grammar（语法）](#2-grammar语法)  

```
text GeometryType(geometry geomA);

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
static inline YspiResult geomGeometryType(YspiHandle hExec)

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

内部直接通过调用GEOS库GEOSGeomTypeId_r拿到typeid，根据typeid返回定义好的常量字符串，常量字符串与GEOS中的GeometryTypeId枚举一一对应。

```
static char* gGeometryType[] = {
    [GEOS_POINT] = "POINT",
    [GEOS_LINESTRING] = "LINESTRING",
    [GEOS_LINEARRING] = "LINESTRING",
    [GEOS_POLYGON] = "POLYGON",
    [GEOS_MULTIPOINT] = "MULTIPOINT",
    [GEOS_MULTILINESTRING] = "MULTILINESTRING",
    [GEOS_MULTIPOLYGON] = "MULTIPOLYGON",
    [GEOS_GEOMETRYCOLLECTION] = "GEOMETRYCOLLECTION",
};

static inline YspiResult geomGeometryType(YspiHandle hExec)
{
    GeomSerial* gs;
    uint32_t    gsSize;
    bool        hasNull = false;
    if (piGetLobArg(hExec, 0, YSPI_BLOB, &amp;gsSize, (char**)&amp;gs, &amp;hasNull) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }

    YspiValue value;
    if (hasNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        return yspiReturnAsLob(hExec, YSPI_BLOB, &amp;value);
    }

    char* ret;
    if (piGeosGSGeometryType(hExec, gs, gsSize, &amp;ret) != YSPI_SUCCESS) {
        piFreeMem(hExec, gs);
        return YSPI_ERROR;
    }

    piFreeMem(hExec, gs);
    value.type = YSPI_STRING;
    value.isNull = false;
    value.vStr = ret;
    value.size = (uint32_t)strlen(ret);
    return yspiReturn(hExec, &amp;value, false);
}

YspiResult piGeosGSGeometryType(YspiHandle hExec, GeomSerial* gs, uint32_t gsSize, char** out)
{
    uint32_t gsHeadSize = piGSHeadSize(gs);
    uint8_t* wkb = (uint8_t*)gs + gsHeadSize;
    uint32_t wkbSize = gsSize - gsHeadSize;

    GeosCtx  ctx = piGeosInit();
    GeosGeom geom = GEOSGeomFromWKB_buf_r(ctx, wkb, wkbSize);
    if (geom == NULL) {
        piGeosSetError(hExec);
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    int typeid = GEOSGeomTypeId_r(ctx, geom);
    if (typeid == -1) {
        piGeosFinish(ctx);
        return YSPI_ERROR;
    }

    piGeosGeomDestroy(ctx, geom);
    *out = gGeometryType[typeid];
    piGeosFinish(ctx);
    return YSPI_SUCCESS;
}

```

#   [5. Example（用例）](#5-example用例)  

- 类型


```

SQL&gt; SELECT GeometryType(ST_GeomFromText('point(1 2)')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
POINT

1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('LINESTRING(77.29 29.07,77.42 29.26,77.27 29.31,77.29 29.07)')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
LINESTRING

1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('Polygon((3 3, 6 3, 6 6, 3 6, 3 3))')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
POLYGON

1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('MULTIPOINT ( (0 0), (1 2) )')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
MULTIPOINT

1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('MULTILINESTRING ( (0 0,1 1,1 2), (2 3,3 2,5 4) )')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
MULTILINESTRING

1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('MULTIPOLYGON (((1 5, 5 5, 5 1, 1 1, 1 5)), ((6 5, 9 1, 6 1, 6 5)))')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
MULTIPOLYGON

1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('GEOMETRYCOLLECTION ( POINT(2 3), LINESTRING(2 3, 3 4))')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
GEOMETRYCOLLECTION

1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('linearring(0 0 ,1 1, 1 0, 0 0)')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
LINESTRING

1 row fetched.


```

- null测试


```

SQL&gt; SELECT GeometryType(ST_GeomFromText('linearring(0 0 ,1 1, 1 0, 0 0)')) from dual;

GEOMETRYTYPE(ST_GEOM
----------------------------------------------------------------
LINESTRING

1 row fetched.

SQL&gt; SELECT GeometryType(null) from dual;

GEOMETRYTYPE(NULL)
----------------------------------------------------------------


1 row fetched.

SQL&gt; SELECT GeometryType(ST_GeomFromText('linearring(0 0 ,1 1, 1 0, 0 0)', null)) from dual;

GEOMETRYTYPE(ST_GEOM
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

select id, GeometryType(shp) from test_geom;

drop table test_geom;

```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/GeometryType.html](https://postgis.net/docs/manual-3.3/GeometryType.html)  

# 附件

postgis所有类型的type的输出：

![](https://pingcode.yasdb.com/atlas/files/public/67396a318970c2af4f51fcf2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MjQsImV4cCI6MTc4MjIyMjQyNH0.wue3wykqF-T5GyZSRohcbth7sv3KlrfUyZV3I38VtdE)

## Attachments: