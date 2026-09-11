Created by 韩晓盼 on 六月 14, 2023

SR：    [YDBRD-13390](https://jira.yasdb.com/browse/YDBRD-13390?src=confmacro)    -  支持ST_AsLatLonText  完成

# 1.   **概述**

简要说明需求背景，本文范围如下：

（1）  支持ST_AsLatLonText函数：  ST_AsLatLonText(geom   geometry  , format string) 

（2）支持的Geometry类型  ：Point

（3）支持2D、3D、4D，但对  z-index、m-index不进行处理

# 2.   **需求分析**

##### 2.0 预备知识

**1、经度、纬度**

1.  经度（longitude，lon）的范围为-180至+180度，纬度（latitude，lat）的范围为-90至+90度。
1.  本文坐标（X，Y），其中X代表lon，Y代表lat。
1.  X，Y坐标点投影到经度纬度的格式为：D°M''S.SSS"C，其中


- D 表示度数（Degrees）
- M 表示分钟（Minute）
- S 表示秒（Second）
- C 表示基本方向（NSEW）：北（north，N）、南（south，S）、西（West，W）、东（east，E）


      其中格式必须包含D，其余M、S、C可选，且格式区分大小写。

|format|D|M|S|C|结果（以’POINT(-3.2342342 -2.32498)‘为例）|
|---|---|---|---|---|---|
|  
|√|√|√|√|2°19'29.928"S （  'D°M''S.SSS"C'  ）|
|  
|√|  
|  
|  
|省略了“C”，“S”，“M”,2.3250 degrees S （  'D.DDDD degrees C'  ）|
|  
|√|√|√|  
|省略了“C”，则度数在南或西时以“-”符号显示：,-2°19'29.928"  （  'D°M''S.SSS"'  ）|
|  
|√|√|  
|√|省略了“S”，则分将显示为十进制，精度与指定的位数相同,2°19"S（  'D°M"C'  ）,  
|
|  
|√|  
|  
|√|省略了“M”，则度以十进制显示，并具有指定的位数精度（包含秒S的前提是包含分钟M  ）,2°"S（  'D°"C'  ）|
|  
|  
|  
|  
|  
|省略格式字符串（或零长度），将使用默认格式'D°M''S.SSS"C'|


- 可以重复“D”、“M”、“S”标记以指示所需的宽度和精度（“SSS.SSSS”表示“1.0023”），“C”不可重复
- 一串“D”、“M”、“S”和一个“C”在格式字符串中只能出现一次


                

![](https://pingcode.yasdb.com/atlas/files/public/673969508970c2af4f51f73b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUVBQUFBQUJBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY2NjMsImV4cCI6MTc4MjEzNzQ2M30.-axe6wi0FBpS24XCCsgefm9U4nhRPgWyth5_IMVXztQ)

  


##### 2.1 函数基本特征

**     **  **ST_AsLatLonText**  **函数**

- 功能     


      根据输入Geometry返回点的度、分、秒表示形式。

![](https://pingcode.yasdb.com/atlas/files/public/673969508970c2af4f51f73c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUVBQUFBQUJBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjY2NjMsImV4cCI6MTc4MjEzNzQ2M30.-axe6wi0FBpS24XCCsgefm9U4nhRPgWyth5_IMVXztQ)

- 语法


```
ST_AsLatLonText(geom geometry, format string) return clob

```

      参数1类型：geometry

      参数2类型：char、varchar

      返回类型：clob

      Null值：geom为null则返回null；  format为null返回null

- 限制


      1、  如果输入的Geometry是一个不合法的Geometry，则会报解析失败的错误。

      2、  format参数是一个格式字符串，长度限制到1024，不支持中文

参考：    [ST_AsLatLonText Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/ST_AsLatLonText+Design)  

# 3.   **测试设计方法**

边界值，等价类，场景分析等。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

4.1 函数入参

|测试点|  
|有效等价类|  
|无效等价类|备注|
|---|---|---|---|---|---|
|函数入参个数|ST_AsLatLonText|1，2|  
|0，3|  
|
|入参|ST_AsLatLonText  .geom|1、支持的Geometry子类型（Point）：,- 可以是输出函数表达式；
- 表中的Geometry列；
- 构造函数表达式
,2、特殊值：,- null
- 空串
- EMPTY
- 表达式（函数）
- double边界值
- nan，-nan，inf， -inf
|其中，Point（X，Y，Z，M）测试点：,- X  ∈  [-180,180]，Y  ∈  [-90,90]为正负数；
- X   ∉  [-180,180]，Y   ∉  [-90,90]为正负数；
- X，Y的小数位等于15，大于15
- 带Z，M，不带Z，M
|1、当前还不支持的Geometry子类型（2D、3D、4D）,- LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection；
- Polyhedral surfaces、Tin、Circularstring、Compoundcurve、Curpolyogn、Multicurve、Multisurface
,   前后两类geom报错不一致,2、非法字符串，内容格式无法转换,- 符合格式，但特定字符大小写书写有误；
- 格式不符合；
,3、除某些可以通过函数（ST_MakePoint、ST_Point、ST_PointZ、ST_geomFromGeoJson、ST_GeomFromText、ST_GeomFromWKB、ST_GeomFromEWKB）转换成geomtry外的其他数据类型，如date，boolean等|  
|
|  
|ST_AsLatLonText  .format|1、正确的格式，默认  'D°M''S.SSS"C'：,- 在包含‘’D‘’的情况下，省略了“C”
- 在包含‘’D‘’的情况下，省略了“S”
- 在包含‘’D‘’的情况下，省略了“M”和“S”
- 全部省略
,2、指定宽度和精度：,- 在不重复“C”的情况下，重复“D”、“M”、“S”
,3、格式字符串长度边界值（1024）,4、可以转换为字符串，且符合个数的数据类型，如char、varchar,5、特殊值：,- null
- 空串
- 格式中包含空格（如'D°  M'' S.SSS" C'）
,  
|注：正确格式中的  D”、“M”、“S”和“C”均为大写|1、错误格式：,- 在包含  “C”、“M”、“S”的情况下，省略‘’D‘’
- 重复“C”
- 没有输入两个单引号进行转义
- D”、“M”、“S”和“C”任意字母为小写
- 格式中包含空格（如'D. DDD°M. MM'' S.    SSS" C'）
,2、正确格式，但格式字符串长度大于1024,3、不能转换为字符串或转换后格式不正确的数据类型，如中文，日期格式字符串等|  
|
|其他|函数名称|正确拼写：  ST_AsLatLonText|  
|拼错或少写字母：SS  ST_ATLatLonText、ST_LatLonxt  等等|  
|


4.2 函数使用场景

|测试场景|  
|示例|备注|
|---|---|---|---|
|函数嵌套|自嵌套|不支持|  
|
|  
|其他函数表达式作为函数入参|ST_AsLatLonText  (ST  _geomFromGeoJson),,ST_AsLatLonText  (  ST_geomFromText),,ST_AsLatLonText  (ST_geomFromWKB),,ST_AsLatLonText  (ST_geomFromEWKB  ),ST_AsLatLonText  (ST_MakePoint  ),,ST_AsLatLonText  (ST_Point),,ST_AsLatLonText  (ST_PointZ  )，,ST_AsLatLonText  (ST_GeometricMedian),,ST_AsLatLonText  (ST_Simplify  )|  
,  
|
|  
|多层嵌套|ST_AsLatLonText  (ST  _geomFromGeoJson(ST_AsGeoJson(  ST_geomFromText  )))等|  
|
|查询场景中使用函数|作为select投影列返回|select   ST_AsLatLonText  ()   from table；|  
|
|  
|作为where条件表达式|1. where   ST_AsLatLonText  (col1) = xx，> <, like, between等
1. where col1 =   ST_AsLatLonText  (xx)
|  
|
|  
|结合join|1. 作为join投影列
1. 作为join条件（on,where）
|  
|
|  
|结合in/exists/any/all/some等子查询|1. 作为表达式左值
1. 作为表达式右值（expr,子查询）
|  
|
|  
|结合group by分组(聚合函数和窗口函数)|1. 作为分组列
1. 在having条件中使用
|  
|
|  
|在嵌套查询中使用|在外层查询，内层查询中|  
|
|  
|结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|  
|
|  
|结合distinct|  
|  
|
|DML场景中使用函数|update|set值|  
|
|  
|delete|ST_AsLatLonText函数的结果  作为where条件|  
|
|  
|insert|ST_AsLatLonText函数的结果  作为insert的值|  
|
|  
|merge|  
|  
|
|DDL场景中使用函数|  
|create/alter table时作为列的default值|  
|
|pl/sql场景中使用函数|在pl/sql中使用|变量赋值，游标投影列，动态执行+绑定参数|  
|


注：

1. 测试重点：验证输入合法的  Geometry  （Point），在使用  ST_AsLatLonText  函数能够获得  点的度、分、秒表示形式  ，且结果正常
1. 结果对比postGIS


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例

详见：

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2023-6-6_19-24-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTBhMWFkOWEzMzExZGM3NWFmIiwicmVmX2lkIjoiNjczOTY5NTA1OTNmOTljOWZmMjM0ZDI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjYyLCJleHAiOjE3ODIyMTMwNjJ9.c7d3LF46_baeGQlFwPUbhkK3a7kZFxzELW-3b6K3FDg)

 (image/png)    


[image2023-5-9_11-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTBhMWFkOWEzMzExZGM3NWIwIiwicmVmX2lkIjoiNjczOTY5NTA1OTNmOTljOWZmMjM0ZDI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjYyLCJleHAiOjE3ODIyMTMwNjJ9.DhHdxuAYgLHPhQ4Uk8rQxSmfmssNKqv7GmysBPk2zvs)

 (image/png)    


[image2023-5-11_11-3-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTA4OTcwYzJhZjRmNTFmNzNhIiwicmVmX2lkIjoiNjczOTY5NTA1OTNmOTljOWZmMjM0ZDI0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NjYyLCJleHAiOjE3ODIyMTMwNjJ9.nuECl_C_W_dBzTp5eiPtJZImFEKB5uza6QcnKQv_gD0)

 (image/png)    
