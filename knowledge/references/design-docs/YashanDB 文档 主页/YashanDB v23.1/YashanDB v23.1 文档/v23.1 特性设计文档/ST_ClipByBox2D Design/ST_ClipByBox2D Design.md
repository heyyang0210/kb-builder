Created by 王仁松, last modified on 六月 09, 2023

**SR链接：**    [YDBRD-13274](https://jira.yasdb.com/browse/YDBRD-13274?src=confmacro)    **-**  **支持叠加分析函数**  **完成**

![](https://conf.yasdb.com/download/thumbnails/109585829/image2023-5-6_16-30-2.png?version=1&modificationDate=1683361802000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI1MDYsImV4cCI6MTc4MjIyMzMwNn0.sozm-KHxZNCnTI5BYslh8ZJSDbi9F9O3v3Ip6BEgdJg)

# 二维边界框

本质上是  一种空间数据类型，用于表示包围几何图形或几何图形集合的二维边界框。该表示形式包含值 xmin、 ymin、 xmax、 ymax。这些是 X 和 Y 区段的最小值和最大值。

  


# 一、概述

- 根据输入的box2d返回一个被该2D矩形框裁剪后的几何图形 - 输出类型为geometry
- 输入为两个参数，第一个为被裁剪的几何图形，第二个参数为二维矩形框，为geometry类型
- 不保证输出的结果一定是有效的结果


# 二、语法

```
geometry ST_ClipByBox2D(geometry geom, geometry box2d);

```

  


# 三、接口

```
static YspiResult geomClipByBox2D(YspiHandle hExec)

```

  


# 四、详细设计

通过StGeometry中bbox拿到StBBox4D类型，从而拿到xmin、 ymin、 xmax、 ymax，之后调用geos库接口GEOSClipByRect_r进行裁剪。postgis也调用该接口，因此实际表现应该是相同的。

```
typedef struct StBBox4D {
    double xmin;
    double xmax;
    double ymin;
    double ymax;
    double zmin;
    double zmax;
    double mmin;
    double mmax;
} BBox4D;

typedef struct StGeometry {
    BBox4D*  bbox;
    int32_t  srid;
    uint8_t  hasZ : 1;
    uint8_t  hasM : 1;
    uint8_t  unused : 6;
    uint8_t  type;
    uint8_t  aligned[2];
} Geometry;

```

```

GEOSGeometry* GEOSClipByRect_r	(	GEOSContextHandle_t 	handle,
const GEOSGeometry * 	g,
double 	xmin,
double 	ymin,
double 	xmax,
double 	ymax 
)	

```

```
static YspiResult geomClipByBox2D(YspiHandle hExec)
{
    GeomSerial gsIn;
    bool hasNull = false;
    YSPI_CALL(piGetLobArg(hExec, 0, YSPI_BLOB, &amp;gsIn.ewkbSize, (char**)&amp;gsIn.ewkb, &amp;hasNull));
    YspiValue value;
    if (hasNull) {
        varAsNull(&amp;value, YSPI_BYTES);
        YSPI_CALL(yspiSetOutArg(hExec, 2, &amp;value));
        varAsNull(&amp;value, YSPI_BYTES);
        return yspiSetOutArg(hExec, 3, &amp;value);
    }

    GeomSerial gsInBox;
    hasNull = false;
    YSPI_CALL(piGetLobArg(hExec, 1, YSPI_BLOB, &amp;gsInBox.ewkbSize, (char**)&amp;gsInBox.ewkb, &amp;hasNull));
    if (hasNull) {
        piFreeMem(hExec, gsIn.ewkb);
        varAsNull(&amp;value, YSPI_BYTES);
        YSPI_CALL(yspiSetOutArg(hExec, 2, &amp;value));
        varAsNull(&amp;value, YSPI_BYTES);
        return yspiSetOutArg(hExec, 3, &amp;value);
    }

    Geometry* geom;
    if (piParseWkb(hExec, gsInBox.ewkb, gsInBox.ewkbSize, &amp;geom) != YSPI_SUCCESS) {
        piFreeMem(hExec, gsIn.ewkb);
        piFreeMem(hExec, gsInBox.ewkb);
        return YSPI_ERROR;
    }
    piFreeMem(hExec, gsInBox.ewkb);

    if (!geom-&gt;bbox) {
        piFreeMem(hExec, gsIn.ewkb);
        varAsNull(&amp;value, YSPI_BYTES);
        YSPI_CALL(yspiSetOutArg(hExec, 2, &amp;value));
        varAsNull(&amp;value, YSPI_BYTES);
        return yspiSetOutArg(hExec, 3, &amp;value);
    }
    
    GeomSerialHead gsHead;
    GeomSerial retGS = {.head = &amp;gsHead};
    if (piGeosGSClipByBox2D(hExec, &amp;gsIn, geom-&gt;bbox-&gt;xmin, geom-&gt;bbox-&gt;ymin, 
            geom-&gt;bbox-&gt;xmax, geom-&gt;bbox-&gt;ymax, &amp;retGS) != YSPI_SUCCESS) {
        piFreeMem(hExec, gsIn.ewkb);
        piFreeGeom(hExec, geom);
        return YSPI_ERROR;
    }

    piFreeMem(hExec, gsIn.ewkb);
    piFreeGeom(hExec, geom);
    value.type = YSPI_BYTES;
    value.vBytes = (uint8_t*)retGS.head;
    value.size = retGS.headSize;
    value.isNull = false;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 2, &amp;value), piFreeMem(hExec, retGS.ewkb));

    value.type = YSPI_BYTES;
    value.vBytes = retGS.ewkb;
    value.size = retGS.ewkbSize;
    value.isNull = false;
    YSPI_RESOURCE_CALL(yspiSetOutArg(hExec, 3, &amp;value), piFreeMem(hExec, retGS.ewkb));
    piFreeMem(hExec, retGS.ewkb);
    return YSPI_SUCCESS;
}

```

  


# 五、规格差异

## 与postgis规格差异

|~~场景~~|~~postgis~~|~~自研~~|
|---|---|---|
|~~外包框存在NaN~~|~~支持~~|~~不支持~~|


2023.05.24修改：规格差异：

|场景|postgis|自研|
|:---|:---|:---|
|外包框支持Inf、-Inf的输入|不支持|支持|
|~~被裁剪图形与裁剪框无交集时~~|~~返回适当类型empty~~|~~返回null~~|


2023.06.09测试评审会议确定规格：

clip确定规格：

|输入场景|输出|
|---|---|
|裁剪框为nan等特殊值输入|输出结果不保证有效（无效结果）|
|裁剪框为empty|等同于裁剪框为nan（无效结果）|
|被裁剪图形为empty|返回对应类型empty|
|裁剪框为point（x最值相等，y最值相等）|返回null（无效裁剪框，不过多关注）|
|裁剪框为水平线（y最值相等）|返回null（无效裁剪框，不过多关注）|
|裁剪框为垂直线（x最值相等）|返回null（无效裁剪框，不过多关注）|


以上，说明文档应明确说明裁剪框必须为有效的外包框（非nan输入，非point，非水平线，非垂直线），否则并不保证结果有效性

# 六、测试用例

- 类型


```
SQL&gt; select st_astext(st_clipbybox2d(st_geomfromtext('polygon((2 0, 3 0, 3 2, 2 3, 0 2, 2 0))'), st_geomfromtext('multipoint(0 0, 0 2, 2 2, 2 0)')), 0) from dual;

ST_ASTEXT(ST_CLIPBYB
----------------------------------------------------------------
POLYGON ((0 2, 2 2, 2 0, 0 2))

1 row fetched.

SQL&gt; select st_astext(st_clipbybox2d(st_geomfromtext('polygon((2 0, 3 0, 3 2, 2 3, 0 2, 2 0))'), st_geomfromtext('multipoint(empty, (1 2), (3 4), empty, (4 5))')), 0) from dual;

ST_ASTEXT(ST_CLIPBYB
----------------------------------------------------------------
POLYGON ((1 2, 1 2, 2 3, 3 2, 1 2))

1 row fetched.


```

- null测试


```
SQL&gt; select st_astext(st_clipbybox2d(st_geomfromtext('polygon((2 0, 3 0, 3 2, 2 3, 0 2, 2 0))'), st_geomfromtext('point empty')), 0) from dual;

ST_ASTEXT(ST_CLIPBYB
----------------------------------------------------------------


1 row fetched.

SQL&gt; select st_astext(st_clipbybox2d(st_geomfromtext('polygon((2 0, 3 0, 3 2, 2 3, 0 2, 2 0))'), st_geomfromtext('point (1 2)')), 0) from dual;

ST_ASTEXT(ST_CLIPBYB
----------------------------------------------------------------


1 row fetched.

SQL&gt; select st_astext(st_clipbybox2d(st_geomfromtext('polygon((2 0, 3 0, 3 2, 2 3, 0 2, 2 0))'), st_geomfromtext('multipoint  ((1 2))')), 0) from dual;

ST_ASTEXT(ST_CLIPBYB
----------------------------------------------------------------


1 row fetched.
SQL&gt; select st_astext(st_clipbybox2d(st_geomfromtext('polygon((2 0, 3 0, 3 2, 2 3, 0 2, 2 0))'), st_geomfromtext('multipoint(empty, (1 nan), (3 1), empty, (4 nan))')), 0) from dual;

ST_ASTEXT(ST_CLIPBYB
----------------------------------------------------------------


1 row fetched.


```

~~对于st_clipbybox2d崩溃的产生条件（场景）：~~

- ~~min > max~~
- ~~min = max~~
- ~~第一个参数为empty的时候~~


# 七、TODO

可优化项

- ~~被裁剪几何图形可完全被包含在裁剪外包框中，可直接返回被裁剪图形~~
- 被裁剪几何图形与裁剪外包框完全不相交时，可直接返回empty


2023.05.24修改：

- 实现功能：被裁剪几何图形可完全被包含在裁剪外包框中，可直接返回被裁剪图形


# 八、参考文档

  [https://postgis.net/docs/manual-3.3/ST_ClipByBox2D.html](https://postgis.net/docs/manual-3.3/ST_ClipByBox2D.html)  

# 附件

无

## Attachments:

[st_envelope_postgis.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGE4OTcwYzJhZjRmNTFmZWEzIiwicmVmX2lkIjoiNjczOTZhODk1OTNmOTljOWZmMjM1OTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNTA2LCJleHAiOjE3ODIyOTg5MDZ9.QpZGTWfbkmjUZ8ZvB2YgjBHn2xucfGKw4YnrProa-G8)

 (application/octet-stream)    


[st_envelope_yasdb.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGE4OTcwYzJhZjRmNTFmZWE0IiwicmVmX2lkIjoiNjczOTZhODk1OTNmOTljOWZmMjM1OTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNTA2LCJleHAiOjE3ODIyOTg5MDZ9.wHgECvEPuMZk2a8XvV4njPvnEM60W1K5Tzu_MerNnYA)

 (application/octet-stream)    


[YDBRD_10938.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGFhMWFkOWEzMzExZGM3ZDFhIiwicmVmX2lkIjoiNjczOTZhODk1OTNmOTljOWZmMjM1OTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNTA2LCJleHAiOjE3ODIyOTg5MDZ9.Wz-lZIdOdkVE86uy-mQYBZ0K5j-QqhPgXaspnJAcT2s)

 (application/octet-stream)    


## Comments:

|  [](null)  ,2023.06.09测试评审会议确定规格：,clip确定规格：,以上，说明文档应明确说明裁剪框必须为有效的外包框（非nan输入，非point，非水平线，非垂直线），否则并不保证结果有效性,Posted by wangrensong at 六月 09, 2023 18:34|
|---|
|输入场景|输出|
|裁剪框为nan等特殊值输入|输出结果不保证有效（无效结果）|
|裁剪框为empty|等同于裁剪框为nan（无效结果）|
|被裁剪图形为empty|返回对应类型empty|
|裁剪框为point（x最值相等，y最值相等）|返回null（无效裁剪框，不过多关注）|
|裁剪框为水平线（y最值相等）|返回null（无效裁剪框，不过多关注）|
|裁剪框为垂直线（x最值相等）|返回null（无效裁剪框，不过多关注）|
|  [](null)  ,2023.06.16：最新更改    
    
,1. 裁剪框中输入有nan，返回null
1. 裁剪框为empty，返回null
1. 被裁剪图形为empty，返回被裁剪图形
1. 裁剪框为point、水平线、垂直线，返回null
1. 输入参数有null，返回null
1. 正常裁剪框上的点或线（被裁剪图形输入是点或线类型），无法裁剪，返回empty
1. 被裁剪图形的box被包含在裁剪框的box，直接返回被裁减图形
1. 被裁剪图形的box与裁剪框的box完全不相交，返回被裁剪图形类型的empty
,Posted by wangrensong at 六月 16, 2023 14:44|
|  [](null)  ,clip裁剪box中有srid，会忽略（即使裁剪框的srid和被裁剪图形的srid不一致），因为我们只获取裁剪框的box,Posted by wangrensong at 六月 16, 2023 15:10|
|  [](null)  ,2023.0620：更改标准第6条,6.  正常裁剪框上的点或线（被裁剪图形输入是点或线（单点或单线（垂直线或水平线））），无法裁剪，返回empty,Posted by wangrensong at 六月 20, 2023 15:35|


|输入场景|输出|
|:---|:---|
|裁剪框为nan等特殊值输入|输出结果不保证有效（无效结果）|
|裁剪框为empty|等同于裁剪框为nan（无效结果）|
|被裁剪图形为empty|返回对应类型empty|
|裁剪框为point（x最值相等，y最值相等）|返回null（无效裁剪框，不过多关注）|
|裁剪框为水平线（y最值相等）|返回null（无效裁剪框，不过多关注）|
|裁剪框为垂直线（x最值相等）|返回null（无效裁剪框，不过多关注）|
