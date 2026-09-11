Created by 王仁松 on 五月 19, 2023

**SR链接：**    [YDBRD-13274](https://jira.yasdb.com/browse/YDBRD-13274?src=confmacro)    **-**  **支持叠加分析函数**  **完成**

![](https://conf.yasdb.com/download/attachments/109596613/image2023-5-17_15-55-1.png?version=1&modificationDate=1684310101028&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBRUFBQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI3MDAsImV4cCI6MTc4MjIyMzUwMH0.QbtaSKPhKPrs7_eGgz0SESavgi_GLJI3InQO0duNQjs)

  


# 一、概述

- 返回一个即处于对象A，也处于对象B的几何图形对象，即返回两个对象的交集
- 如果A完全包含在B中，则返回适当类型的空对象
- 支持3D，Z坐标并不会丢弃，但是Z坐标并不参与计算，输出结果的Z坐标会复制、平均或插值
- 不支持M坐标，M坐标会被丢弃
- 参考postgis源码实现，预计表示形式不会有较大差异


# 二、语法

  


```
geometry ST_Intersection( geometry geomA , geometry geomB , double gridSize = -1 );
```

我们不支持geography，因此只实现geometry的udf。

# 三、接口

```
static YspiResult geomIntersection(YspiHandle hExec)
YspiResult piGeosGSIntersection(YspiHandle hExec, GeomSerial* gsA, GeomSerial* gsB, double gridSize, GeomSerial* retGs);
```

# 四、详细设计

通过从参数中输入的geomA和geomB对象，转换为geos的数据结构并传入geos库接口  GEOSIntersectionPrec_r和GEOSIntersection_r  ：

```
GEOSGeometry* GEOSIntersectionPrec_r(	
	GEOSContextHandle_t 	handle,
	const GEOSGeometry * 	g1,
	const GEOSGeometry * 	g2,
	double 	gridSize 
)	

GEOSGeometry* GEOSIntersection_r(	
	GEOSContextHandle_t 	handle,
	const GEOSGeometry * 	g1,
	const GEOSGeometry * 	g2 
)
```

网格线默认给-1，通过自定义函数赋值默认值

```
MDSYS.ST_Intersection(geomA in ST_GEOMETRY, geomB in ST_GEOMETRY, gridSize in double default -1) return ST_GEOMETRY
```

在函数处理过程中，拿到传入的geomA和geomB对象，本质上是goes对象，在piGeosGSIntersection中调用  GEOSIntersectionPrec_r  或者  GEOSIntersection_r  实现交集的叠加分析功能.

geomDifference中处理：

- 当B为空时，返回B
- 当A为空时，返回A


piGeosGSDifference中处理：

- 当gridSize >= 0时，使用  GEOSIntersectionPrec_r  （并且默认要求GEOS版本>=3.9）
- 当gridSize < 0时，使用  GEOSIntersection_r


![](https://pingcode.yasdb.com/atlas/files/public/67396ac9a1ad9a3311dc7dcb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBRUFBQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI3MDAsImV4cCI6MTc4MjIyMzUwMH0.QbtaSKPhKPrs7_eGgz0SESavgi_GLJI3InQO0duNQjs)

# 五、规格差异

## 与postgis规格差异：

规格上并无较大差异

# 六、测试用例

```
SQL> SELECT ST_AsText(ST_Intersection(st_geomfromtext('polygon ( (2 0, 0 2, 0 0, 2 0) )'), st_geomfromtext('polygon ( (2 2, 2 0, 0 0, 2 2) )')), 0) from dual;

ST_ASTEXT(ST_INTERSE
----------------------------------------------------------------
POLYGON ((2 0, 0 0, 1 1, 2 0))

1 row fetched.

SQL> SELECT ST_AsText(ST_Intersection(st_geomfromtext('linestring ( 2 0, 0 2 )'), st_geomfromtext('polygon ( (2 2, 2 0, 0 0, 2 2) )')), 0) from dual;

ST_ASTEXT(ST_INTERSE
----------------------------------------------------------------
LINESTRING (2 0, 1 1)

1 row fetched.

SQL> SELECT ST_AsText(ST_Intersection(st_geomfromtext('linestring ( 2 0, 0 2 )'), st_geomfromtext('polygon ( (2 0, 0 2, 0 0, 2 0) )')), 0) from dual;

ST_ASTEXT(ST_INTERSE
----------------------------------------------------------------
LINESTRING (2 0, 0 2)

1 row fetched.

SQL> SELECT ST_AsText(ST_Intersection(st_geomfromtext('POINT(0 0)'), st_geomfromtext('polygon ( (2 0, 0 2, 0 0, 2 0) )')), 0) from dual;

ST_ASTEXT(ST_INTERSE
----------------------------------------------------------------
POINT (0 0)

1 row fetched.

SQL> SELECT ST_AsText(ST_Intersection(st_geomfromtext('POINT(3 0)'), st_geomfromtext('polygon ( (2 0, 0 2, 0 0, 2 0) )')), 0) from dual;

ST_ASTEXT(ST_INTERSE
----------------------------------------------------------------
POINT EMPTY

1 row fetched.
SQL> SELECT ST_AsText(ST_Intersection(st_geomfromtext('linestring empty'), st_geomfromtext('polygon empty'))) from dual;

ST_ASTEXT(ST_INTERSE
----------------------------------------------------------------
POLYGON EMPTY

1 row fetched.

SQL> SELECT ST_AsText(ST_Intersection(st_geomfromtext('linestring empty'), st_geomfromtext('point (0 0)'))) from dual;

ST_ASTEXT(ST_INTERSE
----------------------------------------------------------------
LINESTRING EMPTY

1 row fetched.
```

  


# 七、参考文档

  [https://postgis.net/docs/manual-3.3/ST_Intersection.html](https://postgis.net/docs/manual-3.3/ST_Intersection.html)  

# 附件

无

  


## Attachments:

[image2023-5-17_16-43-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhYzk4OTcwYzJhZjRmNTFmZjUxIiwicmVmX2lkIjoiNjczOTZhYzk3MjgyMDZlZmI5MmVmZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNzAwLCJleHAiOjE3ODIyOTkxMDB9.eIjuvF2ElZ8OwM_2nJVyADwPnQtf7VITYP7tQ1obBPE)

 (image/png)    


[image2023-5-17_16-40-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhYzk4OTcwYzJhZjRmNTFmZjUyIiwicmVmX2lkIjoiNjczOTZhYzk3MjgyMDZlZmI5MmVmZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNzAwLCJleHAiOjE3ODIyOTkxMDB9.IHB8cGJ7GCSKjX5At-7l-9ZymR2vKDw_YKTk66IM7_U)

 (image/png)    


[image2023-5-16_17-1-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhYzlhMWFkOWEzMzExZGM3ZGM4IiwicmVmX2lkIjoiNjczOTZhYzk3MjgyMDZlZmI5MmVmZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNzAwLCJleHAiOjE3ODIyOTkxMDB9.GmV3U7GhSrlBTz4kfIu0Nb5QIqTci_B0JRZBhiJ-4MY)

 (image/png)    


[image2023-5-16_14-51-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhYzlhMWFkOWEzMzExZGM3ZGM5IiwicmVmX2lkIjoiNjczOTZhYzk3MjgyMDZlZmI5MmVmZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNzAwLCJleHAiOjE3ODIyOTkxMDB9.MyMdZdNP7sAhMPSyCG4VcGkyfFpvVTL62YC7qPJjf58)

 (image/png)    


[st_envelope_postgis.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhYzk4OTcwYzJhZjRmNTFmZjUzIiwicmVmX2lkIjoiNjczOTZhYzk3MjgyMDZlZmI5MmVmZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNzAwLCJleHAiOjE3ODIyOTkxMDB9.WUvBu_l9w6btIr7Vjc_IkXn_p_ltzd7RlRx1qeZNxe8)

 (application/octet-stream)    


[st_envelope_yasdb.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhYzk4OTcwYzJhZjRmNTFmZjU0IiwicmVmX2lkIjoiNjczOTZhYzk3MjgyMDZlZmI5MmVmZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNzAwLCJleHAiOjE3ODIyOTkxMDB9.fVjick_C38QLQjPYbkIaz4z37AE80aeCjwtcVVTuhzo)

 (application/octet-stream)    


[YDBRD_10938.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhYzlhMWFkOWEzMzExZGM3ZGNhIiwicmVmX2lkIjoiNjczOTZhYzk3MjgyMDZlZmI5MmVmZTNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNzAwLCJleHAiOjE3ODIyOTkxMDB9.iAwIHKi6fGIDvWBgKQb5s2vpmsSaizRfO4BZMXrMwDI)

 (application/octet-stream)    
