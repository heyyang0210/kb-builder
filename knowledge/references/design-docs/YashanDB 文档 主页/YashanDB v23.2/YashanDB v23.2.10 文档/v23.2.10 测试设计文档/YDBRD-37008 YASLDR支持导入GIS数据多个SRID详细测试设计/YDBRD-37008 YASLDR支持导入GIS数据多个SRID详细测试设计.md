# 1. 概述

IR：   [https://pingcode.yasdb.com/ship/ideas/676be94a5ebb317b2c016029?](https://pingcode.yasdb.com/ship/ideas/676be94a5ebb317b2c016029?)  

#YASHAN-3567  YASLDR支持导入GIS数据多个SRID

SR:     [https://pingcode.yasdb.com/pjm/items/6771f7bea9f31a27f6b0ce0f?](https://pingcode.yasdb.com/pjm/items/6771f7bea9f31a27f6b0ce0f?)  

#YDBRD-37008 YASLDR支持导入GIS数据多个SRID

需求来源： YMP迁移GIS数据（同构）

场景：1.当前YASLDR导入CSV格式的GIS数据时，一次导入只能使用参数指定一个SRID，实际上在创建表不定义SRID的时候，导入时可以/需要导入不同的SRID

需求描述： YASLDR支持导入GIS数据多个SRID

交付形态：单机



# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 功能现状

仅支持csv文件级别指定坐标系srid

示例：

|步骤|语句|
|---|---|
|建表并插入数据|drop table if exists test6;  
create table test6(c1 int, c2 geometry);
begin;
insert into test6 values(1, st_geomfromtext('POLYGON((0 0,1 0,1 1,0 1,0 0))', 4326));
insert into test6 values(1, st_geomfromtext('POLYGON((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))', 8192));
commit;|
|csv文件内容|copy导出的内容,COPY  (  SELECT   c1,  ST_AsText(c2)   FROM   test6)   TO   'D:\fanyu\demand_research\23.2\ydbrd-311\copy\test6\test6.csv'  ;,![image.png](https://pingcode.yasdb.com/atlas/files/public/6788f62ea1ad9a3311de6cc8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUlBQWdBSUFBQUFBQUFRUUFBQUFBQUFBQUFFQVFBQUFBQUlBQUFFQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFFQUFBQUFvQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE1ODksImV4cCI6MTc4MjM1MjM4OX0.AHHTXKvXfHbrtN6MlAEKZMV9qRYPsv6QS3FeZ_g1ehU)|
|yasldr导入|yasldr regress/regress@127.0.0.1:1688 control_text="load data infile 'D:\fanyu\demand_research\23.2\ydbrd-311\copy\test6\test6.csv' append into table test6(c1,c2)"   ** GIS_SRID=4326**|


### 2.1.2 新增功能

支持列级别指定坐标系srid

新增语法：

![image.png](https://pingcode.yasdb.com/atlas/files/public/6788f76ca1ad9a3311de6cca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUlBQWdBSUFBQUFBQUFRUUFBQUFBQUFBQUFFQVFBQUFBQUlBQUFFQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFFQUFBQUFvQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE1ODksImV4cCI6MTc4MjM1MjM4OX0.AHHTXKvXfHbrtN6MlAEKZMV9qRYPsv6QS3FeZ_g1ehU)

![image.png](https://pingcode.yasdb.com/atlas/files/public/6788f7bea1ad9a3311de6ccd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUlBQWdBSUFBQUFBQUFRUUFBQUFBQUFBQUFFQVFBQUFBQUlBQUFFQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFFQUFBQUFvQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE1ODksImV4cCI6MTc4MjM1MjM4OX0.AHHTXKvXfHbrtN6MlAEKZMV9qRYPsv6QS3FeZ_g1ehU)

其中func_name 仅支持ST_GeomFromText函数



ST_GeomFromText函数规格限制：

语法：

![image.png](https://pingcode.yasdb.com/atlas/files/public/6788fa9ba1ad9a3311de6cd2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUlBQWdBSUFBQUFBQUFRUUFBQUFBQUFBQUFFQVFBQUFBQUlBQUFFQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFFQUFBQUFvQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDE1ODksImV4cCI6MTc4MjM1MjM4OX0.AHHTXKvXfHbrtN6MlAEKZMV9qRYPsv6QS3FeZ_g1ehU)

ST_GEOMFROMTEXT(wkt,  [srid])

ST_GEOMFROMTEXT（同名函数ST_GEOMETRYFROMTEXT）函数根据给定的wkt（Well-Known Text）和srid返回一个ST_GEOMETRY类型数据。

**wkt**

wkt的数据类型是CLOB，遵循如下规则：

- wkt需要是一个有效的Well-Known Text，否则报错。
- 支持的坐标的最高维度是三维，如果输入是四维的坐标，或带有'M'字样的坐标，则会忽略第四个坐标轴，生成三维坐标。
- 如果输入的坐标中既有二维的点，也有三维的点，则会把二维的点提升到三维，Z轴的数值补零。  近期会支持四维
- 支持输入'inf'、'nan'，如果一个坐标全是'nan'，则会存为EMPTY。
- 支持输入空的ST_GEOMETRY数据（如POINT EMPTY）。
- 点坐标不能跟EMPTY同时使用，如MULTIPOINT(1 1，EMPTY)就会报错。
- 输入的wkt如果前面的字符已经构成了一个有效的ST_GEOMETRY数据，并且后面还有其他字符，则会生成前面的有效ST_GEOMETRY数据。
- 支持能够隐式转换成CLOB的数据类型。


**srid**

srid的数据类型是INT，表示该ST_GEOMETRY类型数据的空间参考系，遵循如下规则：

- 支持能够隐式转换成INT的类型，如果输入的是小数则进行四舍五入转换。
- 该参数可以省略，省略时默认值是0（srid=0表示没有定义空间参考系）。
- 如果输入的是负数，则会按照0进行处理。


当输入的参数存在NULL时，函数返回NULL，空串作为NULL处理。



示例：

|步骤|语句|
|---|---|
|csv文件内容|表结构如：create table test6(c1 int, c2 geometry);,csv文件内容：,c1,  c2_text, c2_srid,"1",  "POLYGON((0 0,1 0,1 1,0 1,0 0))",  "4326"|
|yasldr导入|yasldr regress/regress  control_text="'load data OPTIONS(DEGREE_OF_PARALLELISM=6) infile '$YASDB_DATA/c5csv/c5csv_test_gis_load.csv' fields terminated by ',' append into table c5csv_test_gis_load (c1, c2 \"  **ST_GeomFromText(?,?)**   \")'"|




## 2.2 应用场景

 YMP迁移GIS数据（同构）



## 2.3 规格约束

  1） 本次仅支持ST_GeomFromText函数，参数个数在[1,2]之间，即不小于1且不大于2

  2）csv数据列的个数和导入语句中指定的表列及函数参数和的数目不一致时，其行为与当前行为保持一致（参见TRAILING NULLCOLS参数说明）

  3）不支持函数嵌套使用

  4）仅basic模式支持使用函数

  5）拆分文件split模式下不支持函数



# 3. 详细测试设计

## 3.1 测试设计方法

### 3.1.1 功能测试

|输入条件1|输入条件2|有效类|备注|无效类|备注|
|---|---|---|---|---|---|
|对象|对象|1、行表,2、分区表、非分区表,3、视图||||
||列类型|1、空间数据类型：Point、LineString、LineRing、Polygon、MultiPoint、MultiLineString、MultiPolygon、Geometry Collection,2、其它数据类型|||报错|
|csv文件|csv列值|1、空间数据类型,（1）null， 即空,（2）包含：inf、nan、empty等,（3）列值嵌套函数， 如：trim(' POLYGON((0 0,1 0,1 1,0 1,0 0)) '),2、其它数据类型：,（1）null， 即空,（2）覆盖：特殊字符、边界值等|wkt数值是doule类型,st_astextn只显示15位小数,科学计数法|||
||csv列数|1、单列 ：wkt或者srid,2、2列： wkt和srid,3、多列：空间数据类型列和其它数据类型列组合,4、4096  *2  列：,（1）空间数据类型列， 带wkt、srid,（2）空间数据类型列和其它数据类型组合|ST_GeomFromText(?,?),csv文件srid是空串，导入后，检查st_srid() ,|1、不符合wkt格式：非空间数据类型格式,2、不符合srid值：,非字符、大于int最大值||
||csv单列长度|1、单列长度: 1KB、1G、1M、126KB,2、单列长度与csv_line_size长度关系：,（1）wkt长度 小于等于csv_line_size,（2）wkt长度+srid长度 小于等于csv_line_size|csv_line_size:一行长度限制,[1KB， 1G],  默认126KB,csv_chunk_size:一次读取的块大小,[16MB, 4G]|1、大于1GB,2、列长度与csv_line_size长度关系：,（1）wkt长度大于csv_line_size,（2）wkt长度+srid大于csv_line_size,||
||csv单行长度|1、单行长度：1KB、1GB、1MB、126KB,2、csv单行长度与csv_line_size关系,（1）wkt长度 小于等于csv_line_size,（2）wkt长度+srid长度 小于等于csv_line_size||1、大于1GB,2、csv单行长度与csv_line_size关系,（1）wkt长度 大于csv_line_size,（2）wkt长度+srid长度 大于csv_line_size||
||csv行数|csv行数与csv_chunk_size关系：,（1）多行长度小于等于csv_chunk_size,（2）多行长度大于csv_chunk_size， 构造多个chunk|调整batchsize|csv行数与csv_chunk_size关系：,（1）单行长度大于csv_chunk_size大小,||
|||||||
|语法参数校验,col_name "func ([args])"|col_name|1、col_name 与 func同名,2、co_name 包含 func名字：,（1）col_name前缀包含,（2）col_name后缀包含,（3）col_name中间包含||1、col_name以前已覆盖，此处不再进行测试||
||"func( [args])"|1、带双引号,2、col_name  和  "func([args])" 存在空格：,（1）单个空格,（2）多个空格,3、col_name 和 "func([args])" 存在换行：单个、多个|3、,如：,c1, ,c2 ,",func([args])”，,c3|1、不带双引号、带单引号||
|语法参数校验,"func( [args])"|ST_GEOMFROMTEXT(wkt,  [srid])|1、ST_GEOMFROMTEXT名字大小写,2、同名函数ST_GEOMETRYFROMTEXT（  支持  ）,3、参数个数：1个、2个,4、参数形式：常量、变量（?）、变量+常量 如（?||'1'）  （当成普通值  ）,5、参数值：后续再展开,6、参数长度：后续再展开||1、ST_GEOMFROMTEXT名字错误， 前缀包含ST_GEOMFROMTEXT,3、参数个数：无、0个、3个,4、变量：多个?,  非？形式 如：:col_name,5、函数嵌套||
||参数-wkt|1、参数值：null、空间数据类型格式,2、参数长度：小于1GB、等于1GB||1、参数值：,（1）无效的Well-Known Text,（2）点坐标与EMPTY同时使用，如MULTIPOINT(1 1，EMPTY),（3）嵌套函数， 如：trim(wkt)等||
||参数-srid|1、参数值：null、数值、带单引号数值、科学计数法、负数、浮点数、int最大值|ST_GeomFromText(?,null),,null当成普通值|1、参数值：,（1）非数值：中文、英文等,（2）超过int最大值,（3）函数嵌套，如：to_number(srid)|会容错？|
||与其它语法结合|1、"func( [args])"与filler_colum_clause,2、"func( [args])"与lob_column_clause,3、"func( [args])"与lls_column_clause,|c1 lls ST_GeomFromText(?,null)|4、列名后带多个"func( [args])"||
|||||||
|结合导入其它功能|容错|1、覆盖未超过容错限制、超过容错限制,2、错误触发点：,（1）wkt、srid,（2）在非空间数据类型列上使用"func( [args])"|clob ST_GeomFromText(?,null),varchar   ST_GeomFromText(?,null)|||
||切分|||拆分：,（1）basic模式,（2）batch模式,（3）服务端模式||
||batch模式|||batch模式：,"func( [args])"中args：常量、变量、变量+常量||
||多文件|多个文件导入||||
||trailinig nullcols|1、csv文件列数少于指定的列数,（1）wkt和srid同时被trailing nullcols,（2）wkt被trailing nullcols,（3）srid被trailing nullcols,2、csv文件列数大于指定的列数|trailinig nullcols作用：指定多余的列自动补充null|||
||lob导入|1、csv文件内置lob内容,  如c1 "func ([args])"||1、lobfile或者lls方式，如 c1 lls  "func ([args])"||
||with embedded|1、wkt内容存在换行,2、wkt和srid之间存在换行|with embedded作用：单行数据内可以存在换行|||
||服务端导入||报错|||
||文件级别srid与列级别srid优先级|1、同时指定文件级别srid和列级别srid:   列级别优先级高,（1）ST_GEOMFROMTEXT('point(0,0)',  ?),（2）ST_GEOMFROMTEXT(?),（3）ST_GEOMFROMTEXT(?,  4326),（4）ST_GEOMFROMTEXT(?,  ?),2、指定文件级别srid（或默认），不指定列级别srid,3、不指定文件级别srid,  指定列级别srid||||
||control_text或者control_file|1、方式：control_text或者control_file,2、control_file文件大小没有限制（  2M限制？  ）||||
||log文件|检查log文件内容||||
|结合sql其它功能|Geometry列声明支持指定子类型、SRID,规格限制：,1、 如果srid与声明不匹配，返回错误；,2、如果srid未指定，则使用声明的srid|  
1、导入的srid（文件级别、列级别）与列声明的一致,2、导入的空间列子类型与列声明子类型一致（  容错待开发确认  ）|create table t1(,c1  Geometry,),,create table t1(,c1  Geometry(),)|1、导入的空间列子类型与列声明子类型不一致,2、导入的srid与列声明的不一致,||
||gis函数数据库权限|gis函数是否需要特殊数据库权限||||
|其它||||1、未安装gis插件||






### 3.1.2 性能测试

|场景|备注|
|---|---|
|指定文件级别srid和指定字段级别srid导入性能摸底对比||


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|是  
|
|一致性|  
|
|三方测试工具  
(sqltest，sqlancer)|  
|
|安全|  
|
|DFR||
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


  


# 4. 测试用例

  [YDBRD-37008 YASLDR支持导入GIS数据多个SRID文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4ZjE0NDgwMmExMTUzMWE3Yzk3YjllIiwicmVmX2lkIjoiNjc4ZjE0NDgwMmExMTUzMWE3Yzk3YmEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQxNTg5LCJleHAiOjE3ODI0Mjc5ODl9.jKSudpEncJ1eN2htrLFrlKmOiI708aA8gF8zRrPDG-0)  

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

  


## Attachments:





会议纪要：    
  与会人：贺国峰、张欣、黄家华、范瑜    
  评审时间：2025.01.17 15:00:00    
  评审地点：线上会议    
  评审纪要信息：    
  1、wkt数值是doulel类型，可以试一下科学计数法、doule类型特殊值等

2、近期有SR会支持到四维， csv文件可以构造四维数据

3、当表列数为4096列空间数据类型时， csv列带wkt、srid， csv列数应该为4096列*2  
  4、  ST_GeomFromText(?,?)， 变量+常量 如（?||'1'），非单个？形式当成普通值  
  5、  文件级别srid与列级别srid优先级， 列级别优先级高  
  6、检查log文件内容， 新增语法，log文件会记录列和函数

7、  Geometry列声明支持指定子类型、SRID， 当导入有错误时，待开发确认是否容错？

  
