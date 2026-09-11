Created by 叶显昊, last modified on 五月 18, 2023

#   [YDBRD-13292 : ST_MakeLine/ST_MakePoint/ST_Point/ST_PointZ/ST_Polygon Design（ST_MakeLine/ST_MakePoint/ST_Point/ST_PointZ/ST_Polygon方案设计）](#ydbrd-13292--st-makelinest-makepointst-pointst-pointzst-polygon-designst-makelinest-makepointst-pointst-pointzst-polygon方案设计)  

SR链接：    [YDBRD-13285](https://jira.yasdb.com/browse/YDBRD-13285)  

##   [1. Overview（概述）](#1-overview概述)  

本特性参考postgis中的ST_MakeLine/ST_MakePoint/ST_Point/ST_PointZ/ST_Polygon函数——根据参数返回对应的geometry类型

##   [2. Features（功能特性）](#2-features功能特性)  

- ST_MakeLine
- 语法
- ST_MakePoint
- 语法
    - z和m的默认值是NaN，当z或m接收NaN作为输入时输出的结果中该坐标缺省
    - 如果只有m而没有z，则m在计算时被看作z
- ST_Point
- 语法
- ST_PointZ
- 语法
- ST_Polygon
- 语法


```
geometry ST_MakeLine(geometry geom1, geometry geom2);

```

|某个参数|另一个参数|设计表现|设计说明|
|---|---|---|---|
|Point, MultiPoint, LineString|合法输入|返回按顺序连接参数中的点的LineString|预期行为|
|其它geometry|任意输入|报错|不支持的geometry类型报错|
|两个参数的SRID不同||报错|SRID不同，报错|
|合法类型，NULL|合法输入|返回NULL|计算中参数中有NULL则返回NULL|
|其它输入||报错|不支持的输入格式|


```
geometry ST_MakePoint(double x, double y, double z default 'NaN', double m default 'NaN');

```

|某个参数|其它参数|设计表现|设计说明|
|---|---|---|---|
|数字类型|合法输入|返回坐标为参数的Point|预期行为|
|字符串类型，可以转成double|合法输入|同数字类型|支持字符串向数字类型的转换|
|合法类型，NULL|合法输入|返回NULL|计算中参数中有NULL则返回NULL|
|其它输入||报错|不支持的输入格式报错|


```
geometry ST_Point(double x, double y, integer srid default 0);

```

|参数1或2某个参数|参数1或2另一个参数|参数3|设计表现|设计说明|
|---|---|---|---|---|
|数字类型|合法输入|不输入或合法输入|返回坐标为参数的Point|预期行为|
|字符串类型，可以转成double|合法输入|不输入或合法输入|同数字类型|参数1、2支持字符串向数字类型转换|
|合法输入|合法输入|整数类型，>=0|返回坐标为参数的Point，srid为参数3的值|预期行为|
|合法输入|合法输入|整数类型，<0|返回坐标为参数的Point，srid为0|预期行为|
|合法输入|合法输入|字符串类型，可以转成整数类型|同整数类型|参数3支持字符串向整数类型转换|
|合法类型，NULL|合法输入|不输入或合法输入|返回NULL|计算中参数中有NULL则返回NULL|
|合法输入|合法输入|合法类型，NULL|返回NULL|计算中参数中有NULL则返回NULL|
|其它输入|||报错|不支持的输入格式报错|


```
geometry ST_PointZ(double x, double y, double z, integer srid default 0);

```

|参数1、2或3某个参数|参数1、2或3其它参数|参数4|设计表现|设计说明|
|---|---|---|---|---|
|数字类型|合法输入|不输入或合法输入|返回坐标为参数的Point|预期行为|
|字符串类型，可以转成double|合法输入|不输入或合法输入|同数字类型|参数1、2、3支持字符串向数字类型转换|
|合法输入|合法输入|整数类型，>=0|返回坐标为参数的Point，srid为参数3的值|预期行为|
|合法输入|合法输入|整数类型，<0|返回坐标为参数的Point，srid为0|预期行为|
|合法输入|合法输入|字符串类型，可以转成整数类型|同整数类型|参数4支持字符串向整数类型转换|
|合法类型，NULL|合法输入|不输入或合法类型|返回NULL|计算中参数中有NULL则返回NULL|
|合法输入|合法输入|合法类型，NULL|返回NULL|计算中参数中有NULL则返回NULL|
|其它输入|||报错|不支持的输入格式报错|


```
geometry ST_Polygon(geometry lineString, integer srid);

```

|参数1|参数2|设计表现|设计说明|
|---|---|---|---|
|LineString|合法输入|返回用参数构建的Polygon|预期行为|
|其它geometry|合法输入|报错|不支持的geometry类型报错|
|合法输入|整数类型，>=0|返回用参数构建的Polygon，srid为参数3的值|预期行为|
|合法输入|整数类型，<0|返回用参数构建的Polygon，srid为参数1的srid|预期行为|
|合法输入|字符串类型，可以转成整数类型|同整数类型|参数2支持字符串向整数类型转换|
|合法类型，NULL|合法输入|返回NULL|计算中参数中有NULL则返回NULL|
|合法输入|合法类型，NULL|返回NULL|计算中参数中有NULL则返回NULL|
|其它输入||报错|不支持的输入格式|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
static YspiResult geomMakePoint(YspiHandle hExec)
static YspiResult geomPoint(YspiHandle hExec)
static YspiResult geomPointZ(YspiHandle hExec)
static YspiResult geomMakeLine(YspiHandle hExec)
static YspiResult geomPolygon(YspiHandle hExec)

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

与postgis相比

- 不支持字符串、geography类型的参数
- ST_MakePoint中z或m参数为NaN表示没有该坐标的值
- 当srid为负数时不设置srid，即——如果其它参数中不包括srid则srid为0，其它参数中包括srid则为参数原来的值


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

```
...
    YSPI_CALL(yspiGetArg(hExec, 0, YSPI_DOUBLE, &amp;argValue));
    if (argValue.isNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        yspiSetOutArg(hExec, 4, &amp;value);
        yspiSetOutArg(hExec, 5, &amp;value);
        return YSPI_SUCCESS;
    }

    coordinates[dims] = argValue.vDouble;

    dims++;
    YSPI_CALL(yspiGetArg(hExec, 1, YSPI_DOUBLE, &amp;argValue));
    if (argValue.isNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        yspiSetOutArg(hExec, 4, &amp;value);
        yspiSetOutArg(hExec, 5, &amp;value);
        return YSPI_SUCCESS;
    }

    coordinates[dims] = argValue.vDouble;

    dims++;
    bool hasZ = false;
    YSPI_CALL(yspiGetArg(hExec, 2, YSPI_DOUBLE, &amp;argValue));
    if (argValue.isNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        yspiSetOutArg(hExec, 4, &amp;value);
        yspiSetOutArg(hExec, 5, &amp;value);
        return YSPI_SUCCESS;
    } else if (!isnan(argValue.vDouble)) {
        coordinates[dims] = argValue.vDouble;
        dims++;
        hasZ = true;
    }

    YSPI_CALL(yspiGetArg(hExec, 3, YSPI_DOUBLE, &amp;argValue));
    if (argValue.isNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        yspiSetOutArg(hExec, 4, &amp;value);
        yspiSetOutArg(hExec, 5, &amp;value);
        return YSPI_SUCCESS;
    } else if (!isnan(argValue.vDouble)) {
        coordinates[dims] = argValue.vDouble;
        hasZ = true;
    }
...
...
    GeomPoint      point = {.geom = {.type = YAS_GEOM_POINT, .hasZ = hasZ, .hasM = false}, .point = coordinates};
    GeomSerialHead gsHead;
    GeomSerial     gs = {.head = &amp;gsHead};
    YSPI_CALL(piGeomToGs(hExec, &amp;point.geom, &amp;gs));
    value.type = YSPI_BYTES;
    value.vBytes = (uint8_t*)gs.head;
    value.size = gs.headSize;
    value.isNull = false;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 4, &amp;value), piFreeMem(hExec, gs.ewkb));

    value.type = YSPI_BYTES;
    value.vBytes = gs.ewkb;
    value.size = gs.ewkbSize;
    value.isNull = false;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 5, &amp;value), piFreeMem(hExec, gs.ewkb));
    piFreeMem(hExec, gs.ewkb);
    return YSPI_SUCCESS;
...
...
    Geometry* lineString;
    YSPI_RESOURCE_CALL(piParseWkb(hExec, gs.ewkb, gs.ewkbSize, &amp;lineString), piFreeMem(hExec, gs.ewkb));
    piFreeMem(hExec, gs.ewkb);

    GeomPolygon polygon = {
        .geom = {.type = YAS_GEOM_POLYGON, .hasZ = lineString-&gt;hasZ, .hasM = lineString-&gt;hasM, .srid = srid},
        .ringNum = 1,
        .rings = &amp;((GeomLineString*)lineString)-&gt;lineRing};

    GeomSerialHead gsHead;
    GeomSerial     retGs = {.head = &amp;gsHead};
    YSPI_RESOURCE_CALL(piGeomToGs(hExec, &amp;polygon.geom, &amp;retGs), piFreeGeom(hExec, lineString));
    piFreeGeom(hExec, lineString);
...

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 计算的结果是否正确
- SRID不同是否按预期报错
- 对于空值是否按预期返回空
- 对于不支持的类型是否按预期报错


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,st_makeline不会去掉重复的点，st_polygon的参数首尾应该闭合，否则报错,Posted by yexianhao at 五月 05, 2023 17:17|
|---|
