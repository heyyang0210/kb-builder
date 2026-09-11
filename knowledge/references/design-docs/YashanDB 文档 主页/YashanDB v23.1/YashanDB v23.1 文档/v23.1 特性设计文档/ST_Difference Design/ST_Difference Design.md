Created by 王仁松 on 五月 19, 2023

**SR链接：**    [YDBRD-13274](https://jira.yasdb.com/browse/YDBRD-13274?src=confmacro)    **-**  **支持叠加分析函数**  **完成**

![](https://conf.yasdb.com/download/attachments/109594057/image2023-5-15_11-26-47.png?version=1&modificationDate=1684121208000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI1ODcsImV4cCI6MTc4MjIyMzM4N30.EgkW39wDhpBUD9GmB-n9kd459M4capvC7tbUEKazn2I)

# 网格线

在计算时将计算的geometry对象投射到网格线上，并且在网络线上计算并得出结果

  


# 一、概述

- 根据输入geomA和geomB返回包含A但不包含B的几何图形对象
- 如果A完全包含在B中，则返回适当类型的空对象
- 该函数严格按照输入顺序决定输出内容
- 支持3D，Z坐标并不会丢弃，但是Z坐标并不参与计算，输出结果的Z坐标会复制、平均或插值


# 二、语法

```
geometry ST_Difference(geometry geomA, geometry geomB, float8 gridSize = -1);
```

  


# 三、接口

```
static YspiResult geomDifference(YspiHandle hExec)
```

# 四、详细设计

通过从参数中输入的geomA和geomB对象，转换为geos的数据结构并传入geos库接口GEOSDifferencePrec_r：

```
GEOSGeometry* GEOSDifferencePrec(  
    const GEOSGeometry *    ga,
    const GEOSGeometry *    gb,
    double  gridSize
)  

GEOSGeometry* GEOSDifference(	
	const GEOSGeometry * 	ga,
	const GEOSGeometry * 	gb 
)
```

网格线默认给-1，通过自定义函数赋值默认值

```
MDSYS.ST_Difference(geomA in ST_GEOMETRY, geomB in ST_GEOMETRY, gridSize in double default -1) return ST_GEOMETRY
```

在函数处理过程中，拿到传入的geomA和geomB对象，本质上是goes对象，在piGeosGSDifference中调用GEOSDifferencePrec_r或者GEOSDifference_r实现difference的叠加分析功能

```
static YspiResult geomDifference(YspiHandle hExec);
YspiResult piGeosGSDifference(YspiHandle hExec, GeomSerial* gsA, GeomSerial* gsB, double gridSize, GeomSerial* retGs);
```

geomDifference中处理：

- 当A为空时，返回A
- 当B为空时，返回A


piGeosGSDifference中处理：

- 当gridSize >= 0时，使用GEOSDifferencePrec_r（并且默认要求GEOS版本>=3.9）
- 当gridSize < 0时，使用GEOSDifference_r


![](https://pingcode.yasdb.com/atlas/files/public/67396a8ba1ad9a3311dc7d20/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI1ODcsImV4cCI6MTc4MjIyMzM4N30.EgkW39wDhpBUD9GmB-n9kd459M4capvC7tbUEKazn2I)

# 五、规格差异

## 与postgis规格差异：

规格上并无较大差异

# 六、测试用例

```
SELECT ST_AsText(
    ST_Difference(
            st_geomfromtext('LINESTRING(50 100, 50 200)'),
            st_geomfromtext('LINESTRING(50 50, 50 150)')
        ), 0
    ) from dual;

ST_ASTEXT(ST_DIFFERE
----------------------------------------------------------------
LINESTRING (50 150, 50 200)

1 row fetched.

SQL> SELECT ST_AsText( ST_Difference(st_geomfromtext( 'MULTIPOINT(-118.58 38.38 5,-118.60 38.329 6,-118.614 38.281 7)' ),st_geomfromtext('POINT(-118.614 38.281 5)' )) ,0) from dual;

ST_ASTEXT(ST_DIFFERE
----------------------------------------------------------------
MULTIPOINT Z (-119 38 6, -119 38 5)

1 row fetched.

SQL> SELECT ST_AsText( ST_Difference(st_geomfromtext( 'MULTIPOINT(-118.58 38.38 5,-118.60 38.329 6,-118.614 38.281 7)' ),st_geomfromtext('POINT empty' )) ,0) from dual;

ST_ASTEXT(ST_DIFFERE
----------------------------------------------------------------
MULTIPOINT Z (-119 38 5, -119 38 6, -119 38 7)

1 row fetched.

SQL> SELECT ST_AsText( ST_Difference(st_geomfromtext( 'MULTIPOINT empty' ),st_geomfromtext('POINT empty' )) ,0) from dual;

ST_ASTEXT(ST_DIFFERE
----------------------------------------------------------------
MULTIPOINT EMPTY

1 row fetched.
```

  


# 七、参考文档

  [https://postgis.net/docs/manual-3.3/ST_Difference.html](https://postgis.net/docs/manual-3.3/ST_Difference.html)  

# 附件

无

## Attachments:

[image2023-5-16_14-51-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGFhMWFkOWEzMzExZGM3ZDFlIiwicmVmX2lkIjoiNjczOTZhOGE3MjgyMDZlZmI5MmVmZDZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNTg3LCJleHAiOjE3ODIyOTg5ODd9.GtHJ56eFVr1d91P40KS0JSLkMMV1YxwmkO1QTkqByJg)

 (image/png)    


[st_envelope_postgis.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGFhMWFkOWEzMzExZGM3ZDFmIiwicmVmX2lkIjoiNjczOTZhOGE3MjgyMDZlZmI5MmVmZDZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNTg3LCJleHAiOjE3ODIyOTg5ODd9.d43WWqkAFnZK-c-PO2NYazuFK_UypaXwOc5D7O6mzvM)

 (application/octet-stream)    


[st_envelope_yasdb.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGI4OTcwYzJhZjRmNTFmZWE4IiwicmVmX2lkIjoiNjczOTZhOGE3MjgyMDZlZmI5MmVmZDZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNTg3LCJleHAiOjE3ODIyOTg5ODd9.RZYYZEb4FH57M_5mI3ayhcseNKZ_GQn_e8PazLQeJYM)

 (application/octet-stream)    


[YDBRD_10938.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhOGI4OTcwYzJhZjRmNTFmZWE5IiwicmVmX2lkIjoiNjczOTZhOGE3MjgyMDZlZmI5MmVmZDZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNTg3LCJleHAiOjE3ODIyOTg5ODd9.84-2YBcivB0MGctMmlc__ZaH_w-4wjxHwLCjJH2Ytgk)

 (application/octet-stream)    
