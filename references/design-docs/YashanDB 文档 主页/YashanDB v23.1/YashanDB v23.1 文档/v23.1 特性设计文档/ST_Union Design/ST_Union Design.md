Created by 王仁松 on 五月 19, 2023

**SR链接：**    [YDBRD-13274](https://jira.yasdb.com/browse/YDBRD-13274?src=confmacro)    **-**  **支持叠加分析函数**  **完成**

![](https://conf.yasdb.com/download/attachments/109597603/image2023-5-18_16-53-0.png?version=1&modificationDate=1684399980000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI4MTgsImV4cCI6MTc4MjIyMzYxOH0.dx-REkTaCeky59bT-JC05DW5-Df_td1cfMBwZlA5xVc)

  


# 一、概述

- 返回一个即包含对象A，也包含对象B并且两者没有重叠的几何图形对象
- 如果输入中有NULL，则返回NULL
- postgis中该函数支持3D，Z坐标并不会丢弃，但是Z坐标并不参与计算，输出结果的Z坐标只会复制、平均或者插值


# 二、语法

  


```
geometry ST_Union( geometry geomA , geometry geomB , double gridSize = -1 );
```

我们目前不支持数组、聚合（集合）的输入形式。

# 三、接口

```
static YspiResult geomUnion(YspiHandle hExec)
YspiResult piGeosGSUnion(YspiHandle hExec, GeomSerial* gsA, GeomSerial* gsB, double gridSize, GeomSerial* retGs);
```

# 四、详细设计

![](https://pingcode.yasdb.com/atlas/files/public/67396acc8970c2af4f51ff5a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI4MTgsImV4cCI6MTc4MjIyMzYxOH0.dx-REkTaCeky59bT-JC05DW5-Df_td1cfMBwZlA5xVc)

设置用户自定义函数，网格线默认给-1，通过自定义函数赋值默认值

```
MDSYS.ST_Union(geomA in ST_GEOMETRY, geomB in ST_GEOMETRY, gridSize in double default -1) return ST_GEOMETRY
```

在函数处理过程中，拿到传入的geomA和geomB对象，本质上是goes对象，在piGeosGSIntersection中调用GEOSSymDifferencePrec_r或者GEOSSymDifference_r实现交集的叠加分析功能。

geomUnion中处理：

- 当B为空时，返回A
- 当A为空时，返回B


piGeosGSDifference中处理：

- 当gridSize >= 0时，使用GEOSSymDifferencePrec_r（并且默认要求GEOS版本>=3.9）
- 当gridSize < 0时，使用GEOSSymDifference_r


```
GEOSGeometry* GEOSSymDifferencePrec_r(	
	GEOSContextHandle_t 	handle,
	const GEOSGeometry * 	g1,
	const GEOSGeometry * 	g2,
	double 	gridSize 
)	

GEOSGeometry* GEOSSymDifference_r(	
	GEOSContextHandle_t 	handle,
	const GEOSGeometry * 	g1,
	const GEOSGeometry * 	g2 
)
```

  


# 五、规格差异

## 与postgis规格差异：

|场景|postgis|yasdb|
|---|---|---|
|当A与B都为空时|返回B|返回A|


# 六、测试用例

```
SQL> select ST_AsText(ST_Union(st_geomfromtext( 'LINESTRING empty'), st_geomfromtext( 'POINT empty' ))) from dual;

ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
LINESTRING EMPTY

1 row fetched.

SQL> SELECT ST_AsText(ST_Union(st_geomfromtext('linestring empty'), st_geomfromtext('polygon empty'))) from dual;

ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
LINESTRING EMPTY

1 row fetched.

select ST_AsText(ST_Union(st_geomfromtext('POINT(1 2)' ), st_geomfromtext('POINT(-2 3)'))) from dual;
select  ST_AsText(ST_Union(st_geomfromtext('POINT(1 2)' ), st_geomfromtext('POINT empty' )))from dual;

ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
MULTIPOINT (1.000000000000000 2.000000000000000, -2.000000000000000 3.000000000000000)

1 row fetched.

SQL>
ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
POINT (1.000000000000000 2.000000000000000)

1 row fetched.

select  ST_AsText(ST_Union(st_geomfromtext('LINESTRING empty'), st_geomfromtext('POINT empty' )))from dual;
select  ST_AsText(ST_Union(st_geomfromtext('LINESTRING empty'), st_geomfromtext('multiPOINT ((1 1))')))from dual;
select  ST_AsText(ST_Union(st_geomfromtext('LINESTRING (0 0, 2 2, 3 3, 4 4)'), st_geomfromtext('multiPOINT ((1 1))')))from dual;

ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
LINESTRING EMPTY

1 row fetched.

SQL>
ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
MULTIPOINT (1.000000000000000 1.000000000000000)

1 row fetched.

SQL>
ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
LINESTRING (0.000000000000000 0.000000000000000, 2.000000000000000 2.000000000000000, 3.000000000000000 3.000000000000000, 4.000000000000000 4.000000000000000)

1 row fetched.

SQL> select  ST_AsText(ST_Union(st_geomfromtext('POINT(1 2)' ), null))from dual;

ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------


1 row fetched.

SQL> select  ST_AsText(ST_Union(st_geomfromtext('LINESTRING (0 0, 2 2, 3 3, 4 4)'), st_geomfromtext('multiPOINT ((1 4))'))) from dual;

ST_ASTEXT(ST_UNION(S
----------------------------------------------------------------
GEOMETRYCOLLECTION (LINESTRING (0.000000000000000 0.000000000000000, 2.000000000000000 2.000000000000000, 3.000000000000000 3.000000000000000, 4.000000000000000 4.000000000000000), POINT (1.000000000000000 4.000000000000000))

1 row fetched.
```

  


# 七、参考文档

  [https://postgis.net/docs/manual-3.3/ST_Union.html](https://postgis.net/docs/manual-3.3/ST_Union.html)  

# 附件

无

  


## Attachments:

[image2023-5-19_11-3-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2NhMWFkOWEzMzExZGM3ZGNkIiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.wiAlrduI1FR38jjfOR3CF51kuaKjHuLSnA6Xv2erS78)

 (image/png)    


[image2023-5-19_11-3-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2NhMWFkOWEzMzExZGM3ZGNlIiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.whUTCG9X3ukPU1yfkeXH6LlhyLAkTXL_-jK1yiISdWI)

 (image/png)    


[image2023-5-19_11-1-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2M4OTcwYzJhZjRmNTFmZjU1IiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.PPXrUG_t7VIRj-zPvhLAAry4s-FZGH0r12uDSFceEN4)

 (image/png)    


[image2023-5-17_16-40-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2M4OTcwYzJhZjRmNTFmZjU2IiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.gnBCiut0H7aATei1c5y6GejGoHYf3-jgXbm9p7h4tkQ)

 (image/png)    


[image2023-5-16_17-1-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2M4OTcwYzJhZjRmNTFmZjU3IiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.R_BvQUbNQ5ib2JE7opG49HI2YPQvCOVtx5q9p6ixM1M)

 (image/png)    


[image2023-5-16_14-51-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2M4OTcwYzJhZjRmNTFmZjU4IiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.XJjHwAIioo5nZiJTWYRrQ4XtzPUPa0axoj71PoYvSVQ)

 (image/png)    


[st_envelope_postgis.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2NhMWFkOWEzMzExZGM3ZGNmIiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.Sa9wptK-zMCpAcx1NApBYcwRSqCNfxyJYgTTq6hmmSw)

 (application/octet-stream)    


[st_envelope_yasdb.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2NhMWFkOWEzMzExZGM3ZGQwIiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.FDmIeev3mezMMt7j9axIuPmxzig16t2D-arb-XHHkdQ)

 (application/octet-stream)    


[YDBRD_10938.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2NhMWFkOWEzMzExZGM3ZGQxIiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.E1JmO-sDPKlkPba9nKa0J1DBZ4EMvjcxiKzj_7Zyhws)

 (application/octet-stream)    


[image2023-5-18_14-58-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2NhMWFkOWEzMzExZGM3ZGQyIiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.oNyB-eE1N2jz1x1HlWnMcZ-_xi4-LcAn-Oym30yq24A)

 (image/png)    


[image2023-5-17_16-43-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhY2M4OTcwYzJhZjRmNTFmZjU5IiwicmVmX2lkIjoiNjczOTZhY2M1OTNmOTljOWZmMjM1YTFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyODE4LCJleHAiOjE3ODIyOTkyMTh9.aFxNlb7-yiwhqHFwZOwGGlcJl0UykpBaSmvzVQarYIQ)

 (image/png)    
