Created by 王仁松, last modified on 四月 25, 2023

**SR链接：**    [YDBRD-13297](https://jira.yasdb.com/browse/YDBRD-13297?src=confmacro)    **-**  **支持ST_SRID函数**  **完成**

#   [1. Overview（概述）](#1-overview概述)  

- ST_SRID函数的功能是根据输入Geometry返回一个integer类型的ID。
- 支持的Geometry类型：Point、LineString、Polygon、MultiPoint、MultiLineString、MultiPolygon、GeometryCollection。
- 如果输入null，则返回null，参数Geometry类型如果是null带显式的id（比如ST_GeomFromText(null, 4326)），返回null。
- 如果输入的Geometry是一个不合法的Geometry，则会报解析失败的错误。


#   [2. Grammar（语法）](#2-grammar语法)  

```
integer ST_SRID(geometry g1);

```

#   [3. Interfaces（接口）](#3-interfaces接口)  

```
static YspiResult geomGetSrid(YspiHandle hExec);

```

#   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

内部直接通过已经转换成我们定义的类型GeomSerial的data成员直接拿到srid返回。

```
static YspiResult geomGetSrid(YspiHandle hExec)
{
    uint32_t size;
    GeomSerial* gs;
    bool hasNull = false;
    if (piGetLobArg(hExec, 0, YSPI_BLOB, &amp;size, (char**)&amp;gs, &amp;hasNull) != YSPI_SUCCESS) {
        return YSPI_ERROR;
    }

    YspiValue value;
    if (hasNull) {
        varAsNull(&amp;value, YSPI_INTEGER);
    } else {
        value.type = YSPI_INTEGER;
        value.vInt32 = piGSGetSrid(gs);
        value.isNull = false;
        piFreeMem(hExec, gs);
    }
    return yspiReturn(hExec, &amp;value, false);
}

static inline uint32_t piGSGetSrid(GeomSerial* gs)
{
    return *(uint32_t*)gs-&gt;data;
}

```

#   [5. Example（用例）](#5-example用例)  

- 类型


```

SQL&gt; SELECT ST_SRID(ST_GeomFromText('POINT(-71.1043 42.315)',4326)) from dual;

ST_SRID(ST_GEOMFROMT
--------------------
                4326

1 row fetched.

SQL&gt; SELECT ST_SRID(ST_GeomFromText('POINT(-71.1043 42.315)',null)) from dual;

ST_SRID(ST_GEOMFROMT
--------------------


1 row fetched.

SQL&gt; SELECT ST_SRID(ST_GeomFromText('POINT(-71.1043 42.315)')) from dual;

ST_SRID(ST_GEOMFROMT
--------------------
                   0

1 row fetched.


```

- null测试


```

SQL&gt; SELECT ST_SRID(ST_GeomFromText(null, 4326)) from dual;

ST_SRID(ST_GEOMFROMT
--------------------


1 row fetched.

SQL&gt; SELECT ST_SRID(ST_GeomFromText(null)) from dual;

ST_SRID(ST_GEOMFROMT
--------------------


1 row fetched.


```

- failed测试


```
-- 给负值默认为0
SQL&gt; select st_srid(ST_GeomFromText('point(1 2)', -12)) from dual;

ST_SRID(ST_GEOMFROMT
--------------------
                   0

1 row fetched.

SQL&gt; select st_srid(ST_GeomFromText('point(1 2)', 22222222222222222222222222222222222222222)) from dual;

[5:1]YAS-00013 value larger than datatype allowed


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

select id, st_srid(shp) from test_geom;

drop table test_geom;

```

#   [6. Reference（参考文档）](#6-reference参考文档)  

  [https://postgis.net/docs/manual-3.3/ST_SRID.html](https://postgis.net/docs/manual-3.3/ST_SRID.html)  