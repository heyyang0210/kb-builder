Created by 李美娥, last modified on 十二月 19, 2023

# 1. 参考资料

（1）需求：    [YDBRD-13384](https://jira.yasdb.com/browse/YDBRD-13384?src=confmacro)    -  支持以WKB格式输入Geometry对象  完成

        开发设计：    [ST_GeomFromEWKB/ST_GeomFromWKB Design - YashanDB - SICS-CoD Confluence (yasdb.com](https://conf.yasdb.com/pages/viewpage.action?pageId=107388245)  

        对外提供的函数：  geometry ST_GeomFromWKB(wkb blob, srid integer default 0)、geometry ST_GeomFromEWKB(wkb blob)

        函数目前支持的类型：Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

（2）需求：    [YDBRD-13385](https://jira.yasdb.com/browse/YDBRD-13385?src=confmacro)    -  支持以WKB格式输出Geometry对象  完成

        开发设计：    [ST_AsBinary/ST_AsEWKB Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107388255)  

        对外提供的函数：  bytea ST_AsBinary(geometry g1, text NDR_or_XDR)、  bytea ST_AsEWKB(geometry g1, text NDR_or_XDR)

        函数目前支持的类型：Point、LineString、Polygon、 MultiPoint、MultiLineString、 MultiPolygon、GeometryCollection类型

# 2.   **需求分析**

对功能/需求进行详细说明及分析，包括但不限于需求涉及的规格、约束，主要业务场景，系统/模块上下文等

2.1 函数功能

    ST_GeomFromWKB、ST_GeomFromEWKB均是接受十六进制串（可以转为geometry对象的十六进制串，输出的gemotry对象），传入的十六进制串带srid信息时，会保留srid信息，结合st_srid均可查询到十六进制串的srid信息， ST_GeomFromWKB还可以再单独指定srid，最终按照指定的srid为准。若输入的十六进制串不含srid信息时，默认的srid是0。

2.2 语法

（1）  **geometry ST_GeomFromWKB(wkb blob, srid integer default 0);**

**         geometry ST_GeomFromEWKB(wkb blob);**

第1个入参为二进制类型，格式blob。   如果输入的WKB不合法，不能转成Geometry类型 要能够识别报错。  （备注：目前因解析受限，ST_GeomFromWKB、ST_GeomFromEWKB对一些非法的十六进制串，比如某个geometry的十六进制重复2次，不会报错，postgis会报错。）

- 支持2 （X  Y），3 (X Y Z)，4 (X Y Z M)维坐标的输入
- 支持隐式转换为blob的
- 数据来源方式：通过wkt入表，然后结合st_asbinary或者ST_AsEWKB处理后，作为函数的入参；                             通过postgis的查询出来的十六进制串，将数据插入到表的blob列，然后函数处理blob列。


第2个入参可选，表示传入SRID。

- 不传入同时blob不带srid信息，默认为  SRID=  0，若blob带srid信息，就是自带的srid；
- 取值范围同int （  -2^31 (-2,147,483,648)   ~  2^31 - 1 (2,147,483,647)）  ；有效的SRID范围 可以查询PostGIS中的spatial_ref_sys表内的srid字段获取，一共8500个；  目前空间参考系功能还未实现 不会校验SRID是否在有效范围，但是测试要验证传入的SRID被正确记录 不出错，不丢失。
- 传入浮点类型 小数位做四舍五入处理。
- 支持隐式转换


两个参数  如果输入存在null，则返回null，空串作为null值处理。

不支持直接查ST_GeomFromWKB、ST_GeomFromEWKB  ，需要结合ST_AsText/ST_AsWKB等输出函数一起使用。

（2）  **bytea ST_AsBinary(geometry g1, text NDR_or_XDR);**    


**bytea ST_AsEWKB(geometry g1, text NDR_or_XDR);**

ST_AsBinary返回不带SRID元数据的几何图形的 OGC/ISO 已知二进制 （WKB）表示形式；

ST_AsEWKB：返回具有 SRID 元数据的几何图形的扩展已知二进制 （EWKB） 表示形式；

第1个入参为geometry类型。可以通过输入函数（st_geomFromText、st_geomFromWKB、st_geomFromEWKB、  ST_GeomFromGeoJson  ）传入,也可以是表中geometry类型的列。

- 支持2 （X  Y），3 (X Y Z)，4 (X Y Z M)维坐标的输入。当前版本不支持4维，输出3维坐标，不会输出第4维坐标M。
- 超长文本入参（geom）结果是否无误


第2个参数是varchar类型，表示输出的是大端还是小端，NDR是小端，XDR是大端。

- 不带byteorder，默认为编码使用服务器计算机字节序。
- 带byteorder，采用指定字节序编码的文本参数，或者小端序（“NDR”）或大端序（“XDR”）。
- 支持大小写混合
- 多余空格或者其他非法字符，报错  （备注：postgis会把其当作默认的ndr处理）


  


2.3 支持的  geometry的子类型

Point、LineString、LineRing、Polygon、MultiPoint、MultiLineString、MultiPolygon、Geometry Collection

函数测试的重点是需要验证上述这些子类型都能够正常输入输出，且结果正确。

测试策略： 先覆盖2，3，4维的简单数据，每一种格式；（数据目前直接复用postgis里面的数据）然后测试复杂数据（比如长线段，多边形很多个边，集合元素很多等）。结果对比postGIS   

后续支持的Geometry子类型增加，函数需要补充测试。

# 3.   **测试设计方法**

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

等价类，边界值，场景分析。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

函数的测试点本质同内置函数，参考    [*内置函数测试设计checklist - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=76929071)    的测试点，进行设计。

相较于以往内置函数的常规测试点，增加名称传递的方式。（内部代码通过创建自定义函数实现）

数据：整数、浮点数、科学计数法格式的数据、null

srid：  使用常用的4326、4610、  4490、4214等。（    [SRID WKID 空间参考简介_srid和wkid_bigbigtree911的博客-CSDN博客](https://blog.csdn.net/bigbigtreewhu/article/details/52162277?ops_request_misc=%257B%2522request%255Fid%2522%253A%2522168197695316800188553300%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=168197695316800188553300&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~sobaiduend~default-1-52162277-null-null.142^v85^insert_down1,239^v2^insert_chatgpt&utm_term=%E5%B8%B8%E7%94%A8%E7%9A%84srid&spm=1018.2226.3001.4187)    ）

  


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

[wkb的文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTVhMWFkOWEzMzExZGM3NWNmIiwicmVmX2lkIjoiNjczOTY5NTU1OTNmOTljOWZmMjM0ZDVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzQxLCJleHAiOjE3ODIyMTMxNDF9.LMUq9fu00qhm6CmNrvQOcDN-RrNVl92qTnQnzKmLsCc)

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[GIS_WKB.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTVhMWFkOWEzMzExZGM3NWQwIiwicmVmX2lkIjoiNjczOTY5NTU1OTNmOTljOWZmMjM0ZDVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzQxLCJleHAiOjE3ODIyMTMxNDF9.m2w2N-tQ_ixX2DRZdgVRSnD4E0Xm8817XzQfnC83Upk)

 (application/x-xmind)    


[wkb的文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NTVhMWFkOWEzMzExZGM3NWNmIiwicmVmX2lkIjoiNjczOTY5NTU1OTNmOTljOWZmMjM0ZDVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NzQxLCJleHAiOjE3ODIyMTMxNDF9.LMUq9fu00qhm6CmNrvQOcDN-RrNVl92qTnQnzKmLsCc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
