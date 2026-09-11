Created by 张欣, last modified on 五月 21, 2023

-   [](#Geometry处理函数测试设计-)  
-   [1. 概述](#Geometry处理函数测试设计-1.概述)  
-   [2. 需求分析](#Geometry处理函数测试设计-2.需求分析)  
    -   [ST_Buffer](#Geometry处理函数测试设计-ST_Buffer)  
    -   [ST_GeometricMedian](#Geometry处理函数测试设计-ST_GeometricMedian)  
    -   [ST_Simplify](#Geometry处理函数测试设计-ST_Simplify)  
-   [3. 测试设计方法](#Geometry处理函数测试设计-3.测试设计方法)  
-   [4. 详细测试设计](#Geometry处理函数测试设计-4.详细测试设计)  
-   [5. 测试用例](#Geometry处理函数测试设计-5.测试用例)  
-   [6. 测试框架设计](#Geometry处理函数测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#Geometry处理函数测试设计-7.测试环境说明)  


# 1.   **概述**

本文档描述    [YDBRD-13369](https://jira.yasdb.com/browse/YDBRD-13369?src=confmacro)    -  支持几何对象处理函数  完成  的测试设计

# 2.   **需求分析**

## **ST_Buffer**

ST_Buffer(geom geometry, width double, style_params in varchar default ' ');

**函数作用**  ：  计算一个Geometry，覆盖从给定的Geometry到给定的距离width内的所有点，实际上得到的计算结果始终是一个有效的Polygon。

参数分析：

**1.geom **  支持输入的geometry子类型：

- 点 得到的结果是近似圆的多边形；


![](https://pingcode.yasdb.com/atlas/files/public/67396949a1ad9a3311dc757f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBaUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQ0VBQUFBQUFJQUFBQUFRQUFBRUFBQUFBQUNBQUFBQUFBQUFnQUFBQUFFQUFBQUFJRUFBZ0FBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY1MzUsImV4cCI6MTc4MjEzNzMzNX0.0W3S1fXdr68xlDEbmTPoSdiALkEuEc0mX6rm2Yd4Ciw)

- 线 得到的结果是多边形；


![](https://pingcode.yasdb.com/atlas/files/public/673969498970c2af4f51f708/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBaUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQ0VBQUFBQUFJQUFBQUFRQUFBRUFBQUFBQUNBQUFBQUFBQUFnQUFBQUFFQUFBQUFJRUFBZ0FBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY1MzUsImV4cCI6MTc4MjEzNzMzNX0.0W3S1fXdr68xlDEbmTPoSdiALkEuEc0mX6rm2Yd4Ciw)

- 多边形 得到的结果是多边形；


![](https://pingcode.yasdb.com/atlas/files/public/673969498970c2af4f51f709/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBaUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQ0VBQUFBQUFJQUFBQUFRQUFBRUFBQUFBQUNBQUFBQUFBQUFnQUFBQUFFQUFBQUFJRUFBZ0FBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY1MzUsImV4cCI6MTc4MjEzNzMzNX0.0W3S1fXdr68xlDEbmTPoSdiALkEuEc0mX6rm2Yd4Ciw)

- 多点，多线，多面  ，GEOMETRYCOLLECTION 类型 得到的结果是MULTIPOLYGON；


坐标输出顺序：  输出的点按照X坐标从负到正的顺序，Y坐标从负到正的顺序输出（X相等，则比较Y）；多边形的边界LINEARRING 点的顺序按多边形的点的顺序输出。

  


**2. width **  给定的距离，double类型，可以为负值，表示缩小该geometry。不可缺省

- 对于Point和LineString而言，如果width是负值，或者0，则始终返回POLYGON EMPTY。
- 对于POLYGON，如果width是0，一般情况会原样返回
- 对于  POLYGON，如果width是负值 可以缩小，缩小到一定程度可能会返回POLYGON EMPTY。


取值范围：double;   [-1.79769313486232E308, -4.94065645841247E-324],  0,  [1.79769313486232E308, 4.94065645841247E-324]    极大、极小值可能会  返回POLYGON EMPTY。

特殊值：null,0，nan,inf

**3.**  **style_params**    varchar类型的一组5个参数（postgis是text类型），默认值是' '（空格），可缺省，缺省5个参数取对应的默认值

![](https://pingcode.yasdb.com/atlas/files/public/673969498970c2af4f51f70a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBaUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQ0VBQUFBQUFJQUFBQUFRQUFBRUFBQUFBQUNBQUFBQUFBQUFnQUFBQUFFQUFBQUFJRUFBZ0FBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY1MzUsImV4cCI6MTc4MjEzNzMzNX0.0W3S1fXdr68xlDEbmTPoSdiALkEuEc0mX6rm2Yd4Ciw)

- 5个参数输入前后顺序不限制；
- 参数之间使用空格分隔，方式是 '  quad_segs=  '， 等号两边不支持空格，影响解析
- 如果重复多次输入同一参数的值，则会以最后一次输入为准
- 可以一次不输全5个参数，未传入的则取默认值
- 字符串长度2048 ；-0  超出的截断


|参数名称（同义词）|类型和取值范围|有效输入|无效输入|  
|
|---|---|---|---|---|
|quad_segs|整数|正整数,0,小数 --  截断成整数,负数 --0,不能转换成数值类型的值 --0  ‘3a0’-3,'a'-0|  
|quad_segs较大的时候，计算结果会有很多点，查过32k会报错|
|mitre_limit,同义词miter_limit|小数|正数,负数,0,小数,不能转换成数值类型的值  --0|  
|join =   mitre(miter)时才有效|
|endcap|枚举|round|flat(butt)|square|枚举范围之外的值|参数名和值的大小写匹配|
|join|枚举|round|mitre(miter)|bevel|枚举范围之外的值|  
|
|side|枚举|both|left|right|枚举范围之外的值|  
|


特殊值：null,'','   '多个空格；

无效值：有参数名以外的内容，

  


限制：

不支持3维坐标，Z,M 坐标不会参与运算； 'POINT(0 1 1)' 和 'POINT(0 1 2)' 计算时认为是同一个点。

输入  geometry的SRID 不影响计算结果。构造数据时可以带上SRID.

特殊值：

1. null,空串，点线面 EMPTY, 多点多线多面中包含成员是EMPTY；


## ST_GeometricMedian

geometry ST_GeometricMedian (geom geometry, tolerance in double default NULL, max_iter in int default 10000, fail_if_not_converged in boolean default false);

**函数作用**  ：  使用Weiszfeld算法计算MULTIPOINT的几何中位数。最终会返回一个POINT，该POINT到MULTIPOINT的所有POINT的距离之和是最小的。 

**geom支持输入的子类型**

|输入|输出|
|---|---|
|point|返回原来的结果（不包含M坐标）|
|multipoint|计算后的结果point|
|其他：LINESTRING，  POLYGON，,GEOMETRYCOLLECTION等|报错不支持|


Weiszfeld算法：    [Weiszfeld 算法求中位中心_qianlinjun的博客-CSDN博客](https://blog.csdn.net/qianlinjun/article/details/53852306)  

max_iter：迭代的次数，正整数 可以为0，上限int32。

tolerance：公差，非负数, 迭代结束时判断连续迭代（和上一次）之间的距离变化是否小于给定的公差。 如果不小于，fail_if_not_converged = false 则返回计算结果，fail_if_not_converged = true则报错。

**参数取值**

|  
|有效等价类|无效等价类|
|---|---|---|
|max_iter|0,1-  2147483647,小数:四舍五入|负数,  
,null|
|tolerance|0,null：根据外包框计算一个值，和pg可能有差异,double 正边界|负数 （特殊：四舍五入-0按0处理不报错）|
|fail_if_not_converged |false,true,null - false|不能转换成bool的数值|


支持3D坐标，支持输入4维M坐标，M不参与运算，输入只有M坐标时，M坐标会转成Z坐标。

输入  geometry的SRID 输出保持一致。

**数据规划：**

- multipoint 数据：数据规格大，很多个点；点密集；点稀疏；
- 公差  tolerance  ：合理范围；极大极小值
- 特殊值：null,point EMPTY, multipoint EMPTY，坐标边界有特殊值nan,inf ，重合的点


## ST_Simplify

ST_Simplify(geom geometry, double tolerance);

**函数功能：**  使用Douglas-Peucker算法来简化输入的Geometry。

Douglas-Peucker算法     [轨迹数据压缩的Douglas-Peucker算法（附代码及原始数据） - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/136286488)  

**输入输出子类型**

|输入|输出|特殊值|
|---|---|---|
|point，multipoint|原样输出|null,point EMPTY,multipoint EMPTY|
|LineString、MultiLineString|简化后的  LineString、MultiLineString|LINESTRING EMPTY,MULTILINESTRING EMPTY,只有2个点的直线,LINEARRING,成员包含EMPTY|
|Polygon、MultiPolygon|简化后的多边形,容差相对较大时，有可能返回EMPTY|矩形,没有‘洞’，有一个或多个‘洞’,成员包含EMPTY|
|GeometryCollection|GeometryCollection 内部成员的简化遵循上述规则|成员包含EMPTY|


**tolerance**   容差：  容差越大，生成的Geometry越简化。类型是double,如果输入的是负数，则转化成对应的正数进行计算。

取值范围：

[-1.79769313486232E308, -4.94065645841247E-324]    
  0    
  [1.79769313486232E308, 4.94065645841247E-324]

**数据规划：**

LineString、Polygon  上锯齿较多，组成的点多；结合容差大、容差小；MultiLineString ，MultiPolygon 类似

Polygon 规格 结合容差大小；

只支持2D坐标，可以输入3D,4D坐标，Z,M 坐标不会参与运算；

  


# 3.   **测试设计方法**

场景分析，等价类。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[ST_Boundary.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDg4OTcwYzJhZjRmNTFmNzAyIiwicmVmX2lkIjoiNjczOTY5NDg3MjgyMDZlZmI5MmVmMTdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTM1LCJleHAiOjE3ODIyMTI5MzV9.g863m17zabZu7ER3V0fq8HWvrOuBQ1JuKtQTuaxv5Js)

 (application/x-xmind)    


[ST_Buffer.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDhhMWFkOWEzMzExZGM3NTdjIiwicmVmX2lkIjoiNjczOTY5NDg3MjgyMDZlZmI5MmVmMTdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTM1LCJleHAiOjE3ODIyMTI5MzV9.BIBcCcllZpiP7RwjQ2zPGICiFqfjMsOtpkCTUYcl7O8)

 (application/x-xmind)    


[ST_GeometricMedian.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDhhMWFkOWEzMzExZGM3NTdkIiwicmVmX2lkIjoiNjczOTY5NDg3MjgyMDZlZmI5MmVmMTdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTM1LCJleHAiOjE3ODIyMTI5MzV9.wciNq2X6uSqnnExEpa8bCguYwJiJTY-HPaG9tg24otI)

 (application/x-xmind)    


[ST_Simplify.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDhhMWFkOWEzMzExZGM3NTdlIiwicmVmX2lkIjoiNjczOTY5NDg3MjgyMDZlZmI5MmVmMTdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTM1LCJleHAiOjE3ODIyMTI5MzV9.4PSW6vWBJRGRbfIu9gNKcusFebyRTTIBOPrHrZCi9Dk)

 (application/x-xmind)    
