Created by 陈钦卿, last modified on 五月 17, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/661e7559fd997db58adae95e](https://pingcode.yasdb.com/pjm/items/661e7559fd997db58adae95e)    ?#YDBRD-26433 【yasldr】支持gis对象以csv文件导入到yashandb

开发设计：    [YDBRD-26433: 支持gis数据导入方案设计说明书 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150617754)  

测试概要设计：    [YASHAN-311 测试概要设计 - 范瑜 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150621805)  

交付形态：单机

# 2. 需求分析

## 2.1 功能点分析

- yasldr支持导入ST_GEOMETRY数据类型
- csv  数据中的gis列数据可以通过  ST_GeomFromText函数  直接转换而来
    - ST_GEOMFROMTEXT函数格式：ST_GEOMFROMTEXT(wkt，srid)
    - 故  csv中的gis列数据为wkt(Well-Known Text)
- 增加命令行参数csv_line_size，默认值保持现状为126KB，参数取值范围[1 - 1024*1024]，参数单位为KB。即支持的GIS数据单列最大为1GB。（针对所有模式）  —— 包含分隔符包围符
    - 若gis单列数据超过1G？（  ST_GEOMETRY类型最大4G  ）
    - lob、char、json等其他数据超过1G  ——  **对于char数据，存储层还是有行不能超过63K的限制**
- 修改CSV_CHUNK_SIZE的取值范围，将最大值提升到4GB。（当前最大值为1GB）。（针对所有模式）
- 针对basic导入模式，取消当前“列不能超过32KB大小” 的限制，修改为不能超过csv_line_size大小的限制。（针对basic模式）
    - 即列不能超过csv_line_size  ——basic下列可以超过32KB【实际上只有lob类单列能超过32K,其他数据类型有32K的限制,对于json数据，单列不能超过32M】
    - batch下设置csv_line_size不起作用？  ——batch下列不能超过32KB，行不能超过csv_line_size


- 增加命令行参数gis_srid，用来指定导入gis的坐标系，默认值为0。取值范围[0, INT_MAX]。同一个csv文件默认同一个坐标系。


## 2.2 应用场景

- 使用yasldr将空间数据类型的csv文件导入到数据


## 2.3 规格约束

- 仅限basic  模式使用，batch模式下导入gis数据报错
- 仅支持gis的导入，不支持其他udt导入
- 服务端不支持gis导入
- 待导入的csv数据不包含表名和列名等其他信息
- 若csv_line_size<4M，则单行超过8M不能容错；若csv_line_size>4M，则单行超过csv_line_size*2不能容错


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|场景|输入条件1|输入条件2|有效等价类|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|CSV_LINE_SIZE,控制导入过程中单行CSV数据的最大长度，单位KB|拼写|大写、小写、大小写混合|拼写错误|  
|
|  
|  
|格式|CSV_LINE_SIZE=128,CSV_LINE_SIZE = 128|CSV_LINE_SIZE:128,CSV_LINE_SIZE==128|  
|
|  
|  
|取值|[1, 1048576],默认：126KB，最大值1G,科学计数法|null，0，-1，1048577，小数，表达式(1+2,9/3)，,其他字符：中英文、表情、特殊字符等|  
|
|  
|  
|位置|LOAD     STATEMENT之前/之后|  
|  
|
|  
|  
|重复设置|  
|  
|后设置的生效|
|  
|GIS_SRID,设置导入GIS数据时的坐标系，默认值为0。|拼写|大写、小写、大小写混合|拼写错误|  
|
|  
|  
|格式|GIS_SRID=1,GIS_SRID= 1|GIS_SRID:1,GIS_SRID==1|  
|
|  
|  
|取值|[0, INT_MAX],默认：0,科学计数法|null，-1，  2147483648  ，小数，表达式(1+2,9/3)，,其他字符：中英文、表情、特殊字符等|  
|
|  
|  
|位置|LOAD     STATEMENT之前/之后|  
|  
|
|  
|  
|重复设置|  
|  
|  
|
|  
|CSV_CHUNK_SIZE,控制导入过程中CSV数据文件切分的粒度（单位：MB）|取值|原：[16,1024],现：[16,4096  ),默认：128MB，最大值4G|4096|已有参数，扩展范围,用例sa/sqlloader_client3/refactor/parameter/test_yasldr_22298_01、02.py补充测试点：范围，basic模式，数据大于4G|
|功能校验|CSV_LINE_SIZE|导入模式|batch、basic模式下设置此参数都不报错|  
|  
|
|  
|  
|csv大小|单行小于等于  CSV_LINE_SIZE|单行大于  CSV_LINE_SIZE|  
|
|  
|  
|考虑除gis外的数据类型|  
|  
|  
|
|  
|GIS_SRID|导入模式|basic模式|batch模式下设置GIS_SRID报错|  
|
|  
|  
|导入后检查坐标系是否生效|  
|  
|  
|
|  
|CSV_CHUNK_SIZE|导入模式|batch、basic模式下设置为4G|  
|basic模式下数据可以跨包|
|  
|  
|大数据量|csv大于4G|  
|  
|
|  
|  
|与csv_line_size关系|csv_line_size<  CSV_CHUNK_SIZE|csv_line_size>=CSV_CHUNK_SIZE报错提示|  
|
|  
|导入模式|  
|basic|batch下导入gis报错|  
|
|  
|表列数|4096等|  
|  
|视图USER_TAB_COLS可以看到隐藏列信息。,st_geometry包含2个隐藏列。故最大能建4096/3=1365个st_geometry列。,存储层一行最多63K，gis列的loblocator为50，理论上最多只能导入807列gis。但用例中1000列也能成功导入，最多能导入多少列gis不确定。|
|  
|BOX2D|不支持报错|  
|  
|  
|
|  
|csv内容|数据类型：,ST_GEOMETRY,  
,  
|WKT,1、覆盖所有子类型：,POINT（）,LINESTRING（）,POLYGON（）,MULTIPOINT（）,MULTILINESTRING（）,MULTIPOLYGON（）,GEOMETRYCOLLECTION（）,2、覆盖维度：一维、二维、三维、四维,3、覆盖：空值  empty  、inf、nan、null、空串,4、能够隐式转换成CLOB的数据类型,5、嵌套函数,  点击此处展开...,SQL> create table tt (id int,gis st_geometry);,Succeed.,SQL> insert into tt values(1,st_geomfromtext(  cast('point(1 1)' as varchar)  ));,1 row affected.,yasldr不支持嵌套函数，yasldr使用  st_geomfromtext('')  绑定参数,![](https://pingcode.yasdb.com/atlas/files/public/67396d058970c2af4f520fe2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQVFBQUFJQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUlBQUNBQUFBQUFBZ0FBQ0VBQUNBQUlJQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQVlBQUFBQUFBRUFBQkFCQUlBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUzMDIsImV4cCI6MTc4MjMxNjEwMn0.xbfjvFf-s63pwGzZQtkJdBhXIYXH_17bUqSoLpECsFM),![](https://pingcode.yasdb.com/atlas/files/public/67396d05a1ad9a3311dc8e52/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQVFBQUFJQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUlBQUNBQUFBQUFBZ0FBQ0VBQUNBQUlJQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQVlBQUFBQUFBRUFBQkFCQUlBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUzMDIsImV4cCI6MTc4MjMxNjEwMn0.xbfjvFf-s63pwGzZQtkJdBhXIYXH_17bUqSoLpECsFM),6、  各个坐标数据类型是float（需覆盖边界值、超过边界值、特殊值的inf、nan、inf等、支持科学计数法）,  点击此处展开...,SQL> insert into tt values(2,st_geomfromtext(  'point(1.2e+3 1)'  ));,1 row affected.,SQL>    
  SQL> select id,ST_AsText(gis) from tt;,ID ST_ASTEXT(GIS)    
  ------------ ----------------------------------------------------------------    
  2   POINT (1200.000000000000000 1.000000000000000),1 rows fetched.,7、坐标数据若小数点后位数超过15，则第16位不一定有效,8、  点和点之间有换行，大数据量，>csv_chunk_size|1、WKB（Well-Known Binary）,2、无效WKT：POINT (1 2 3 4 5)、BIN_TO_NUM(1,1)、NVL2(1,2,3)等,3、非  ST_GEOMETRY类型数据：2000-1-2、123等,4、  子类型的限制：多边形中的点需首尾相连等,5、一列中既有point又有linestring|ST_GEOMFROMTEXT（同名函数ST_GEOMETRYFROMTEXT）函数根据给定的wkt（Well-Known Text）和srid返回一个ST_GEOMETRY类型数据。,**wkt的数据类型是CLOB，遵循如下规则：**,  点击此处展开...,- wkt需要是一个有效的Well-Known Text，否则报错。
- 支持的坐标的最高维度是三维，如果输入是四维的坐标，或带有'M'字样的坐标，则会忽略第四个坐标轴，生成三维坐标。
- 如果输入的坐标中既有二维的点，也有三维的点，则会把二维的点提升到三维，Z轴的数值补零。
- 支持输入'inf'、'nan'，如果一个坐标全是'nan'，则会存为EMPTY。
- 支持输入空的ST_GEOMETRY数据（如POINT EMPTY）。
- 点坐标不能跟EMPTY同时使用，如MULTIPOINT(1 1，EMPTY)就会报错。
- 输入的wkt如果前面的字符已经构成了一个有效的ST_GEOMETRY数据，并且后面还有其他字符，则会生成前面的有效ST_GEOMETRY数据。
- 支持能够隐式转换成CLOB的数据类型。
,  
,**srid的数据类型是INT，表示该ST_GEOMETRY类型数据的空间参考系，遵循如下规则：**,  点击此处展开...,- 支持能够隐式转换成INT的类型，如果输入的是小数则进行四舍五入转换。
- 该参数可以省略，省略时默认值是0（srid=0表示没有定义空间参考系）。
- 如果输入的是负数，则会按照0进行处理。
|
|功能结合|容错|  
|1、ST_GEOMETRY类型转换失败,2、违反非空约束|  
|ST_GEOMETRY类型不能做分区键，不支持唯一索引、主键、check约束、外键。支持非空约束。,  点击此处展开...,SQL> create table tt (id int,gis st_geometry   not null  );,Succeed.,SQL> insert into tt values(2,st_geomfromtext('point EMPTY'));,1 row affected.,SQL> insert into tt values(1,st_geomfromtext(''));,YAS-04006 cannot insert NULL value to column GIS,SQL> select id,ST_AsText(gis) from tt;,ID ST_ASTEXT(GIS)    
  ------------ ----------------------------------------------------------------    
  2 POINT EMPTY,1 row fetched.,SQL> drop table tt;,Succeed.,SQL> create table tt (id int,gis st_geometry);,Succeed.,SQL> insert into tt values(2,st_geomfromtext('point EMPTY'));,1 row affected.,SQL> insert into tt values(1,st_geomfromtext(''));,1 row affected.,SQL> select id,ST_AsText(gis) from tt;,ID ST_ASTEXT(GIS)    
  ------------ ----------------------------------------------------------------    
  2 POINT EMPTY    
  1,2 rows fetched.|
|  
|分隔符包围符|简单覆盖gis列数据中某些字符作为分隔符或包围符的情况，gis列数据可能需要转义|  
|  
|  
|
|  
|多文件|  
|  
|  
|  
|
|  
|use_native_type|是否有影响|  
|  
|yasldr端不对坐标中的float做转换,yasldr表现同insert,![](https://pingcode.yasdb.com/atlas/files/public/67396d058970c2af4f520fe3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQVFBQUFJQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUlBQUNBQUFBQUFBZ0FBQ0VBQUNBQUlJQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQVlBQUFBQUFBRUFBQkFCQUlBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUzMDIsImV4cCI6MTc4MjMxNjEwMn0.xbfjvFf-s63pwGzZQtkJdBhXIYXH_17bUqSoLpECsFM),![](https://pingcode.yasdb.com/atlas/files/public/67396d058970c2af4f520fe4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQVFBQUFJQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUlBQUNBQUFBQUFBZ0FBQ0VBQUNBQUlJQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQVlBQUFBQUFBRUFBQkFCQUlBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUzMDIsImV4cCI6MTc4MjMxNjEwMn0.xbfjvFf-s63pwGzZQtkJdBhXIYXH_17bUqSoLpECsFM),![](https://pingcode.yasdb.com/atlas/files/public/67396d06a1ad9a3311dc8e53/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQVFBQUFJQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUlBQUNBQUFBQUFBZ0FBQ0VBQUNBQUlJQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQVlBQUFBQUFBRUFBQkFCQUlBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUzMDIsImV4cCI6MTc4MjMxNjEwMn0.xbfjvFf-s63pwGzZQtkJdBhXIYXH_17bUqSoLpECsFM)|
|  
|从pg导出，导入到yashandb|copy|COPY     (  SELECT     ST_AsText(geometry_column)     FROM     tablename     WHERE     condition  )     TO     'output.txt'  ;|  
|```
drop table if exists test;
create table test(c1 int, c2 geometry);
begin;
insert into test values(1,'POINT EMPTY');
insert into test values(2,'POINT Z (1 2 3)');
insert into test values(3,'LINESTRING EMPTY');
insert into test values(4,'LINESTRING(0 0, 1 1)');
insert into test values(5,'POLYGON((0 0,1 0,1 1,0 1,0 0))');
insert into test values(6,'MULTIPOINT(0 0, 2 0)');
insert into test values(7,'MULTILINESTRING((0 0, 2 0), (1 1, 2 2))');
insert into test values(8,'MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2)))');
insert into test values(9,'GEOMETRYCOLLECTION(MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))),POINT(0 0),MULTILINESTRING((0 0, 2 0),(1 1, 2 2)))');
insert into test values(10,null);
insert into test values(11,'POINT (nan nan)');
insert into test values(12,'POINT (3.1415926 3.1415926)');
insert into test values(13,'POINT (-1 -1)');
commit;

COPY(SELECT c1,  ST_AsText(c2)FROM test) TO 'D:\copy\test11\test.csv';

drop table if exists test1;
create table test1(c1 int, c2 geometry);
begin;
insert into test1 values(1,'POINT EMPTY');
insert into test1 values(2, st_geomfromtext('POINT Z (1 2 3)', 4326));
insert into test1 values(3, st_geomfromtext('LINESTRING EMPTY', 4326));
insert into test1 values(4, st_geomfromtext('LINESTRING(0 0, 1 1)', 4326));
insert into test1 values(5, st_geomfromtext('POLYGON((0 0,1 0,1 1,0 1,0 0))', 4326));
insert into test1 values(6, st_geomfromtext('MULTIPOINT(0 0, 2 0)', 4326));
insert into test1 values(7, st_geomfromtext('MULTILINESTRING((0 0, 2 0), (1 1, 2 2))', 4326));
insert into test1 values(8, st_geomfromtext('MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2)))', 4326));
insert into test1 values(9, st_geomfromtext('GEOMETRYCOLLECTION(MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0),(2 2,2 5,5 5,5 2,2 2))),POINT(0 0),MULTILINESTRING((0 0, 2 0),(1 1, 2 2)))', 4326));
insert into test1 values(10,null);
insert into test1 values(11, st_geomfromtext('POINT (nan nan)', 4326));
insert into test1 values(12, st_geomfromtext('POINT (3.1415926 3.1415926)', 4326));
insert into test1 values(13, st_geomfromtext('POINT (-1 -1)', 4326));
commit;

COPY(SELECT c1,  ST_AsText(c2)FROM test1) TO 'D:\copy\test11\test1.csv';

带不带坐标导出的文件都一样
```,pg导出的文件分隔符为\t，第十行导入失败。,[test.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDU4OTcwYzJhZjRmNTIwZmRkIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzAyLCJleHAiOjE3ODIzOTE3MDJ9.37BzwvOFpNK39lYlb18eYg2QKzzRb7N7eQ80inz7y5A),![](https://pingcode.yasdb.com/atlas/files/public/67396d06a1ad9a3311dc8e54/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQVFBQUFJQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUlBQUNBQUFBQUFBZ0FBQ0VBQUNBQUlJQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQVlBQUFBQUFBRUFBQkFCQUlBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUNBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ29BPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUzMDIsImV4cCI6MTc4MjMxNjEwMn0.xbfjvFf-s63pwGzZQtkJdBhXIYXH_17bUqSoLpECsFM)|
|  
|lobfile/lls|不支持，报错|  
|  
|  
|
|  
|集群|  
|  
|  
|  
|
|  
|yasboot|不考虑|  
|  
|  
|
|  
|fromtext转换对数据库资源有要求？|  
|  
|  
|  
|
|可靠性|在正常/异常场景下循环重复导入导出， 检查是否有内存泄露、资源未释放等|  
|  
|  
|  
|
|  
|导入过程中ctrl+c/kill yasdb/kill yasldr|  
|  
|  
|  
|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|暂无性能要求|摸底，模型：几列gis数据，几G数据。|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件     

[yasldr支持gis文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDU4OTcwYzJhZjRmNTIwZmRlIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzAyLCJleHAiOjE3ODIzOTE3MDJ9.s0viMHzHLpiPUT_yT0b_NgVUHUP4q6AnLkE1ZbAE_-A)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


  


- 本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDVhMWFkOWEzMzExZGM4ZTRkIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzAyLCJleHAiOjE3ODIzOTE3MDJ9.ZZ7RTQp3cI1RPKll8i6pVpTQ_lIue_Ti7Zqpk9X6upU)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDVhMWFkOWEzMzExZGM4ZTRkIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzAyLCJleHAiOjE3ODIzOTE3MDJ9.ZZ7RTQp3cI1RPKll8i6pVpTQ_lIue_Ti7Zqpk9X6upU)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDU4OTcwYzJhZjRmNTIwZmRmIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzAyLCJleHAiOjE3ODIzOTE3MDJ9.H_p5ymeumL_DzILrW0gAsjg6cdn7PmEO_M3-3gFrvdc)

 (application/msword)    


[yasldr支持gis文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDU4OTcwYzJhZjRmNTIwZmRlIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzAyLCJleHAiOjE3ODIzOTE3MDJ9.s0viMHzHLpiPUT_yT0b_NgVUHUP4q6AnLkE1ZbAE_-A)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[test.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDU4OTcwYzJhZjRmNTIwZmRkIiwicmVmX2lkIjoiNjczOTZkMDQ1OTNmOTljOWZmMjM3Njg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzAyLCJleHAiOjE3ODIzOTE3MDJ9.37BzwvOFpNK39lYlb18eYg2QKzzRb7N7eQ80inz7y5A)

 (text/csv)    


## Comments:

|  [](null)  ,YDBRD-26433【yasldr】支持gis对象以csv文件导入到yashandb 测试设计评审纪要    
  与会人：陈钦卿、范瑜、贺国峰    
  评审时间：2024.05.09 10:45:00    
  会议纪要：    
  1、csv_line_size包含分隔符和包围符的大小，需要考虑st_geometry、char、lob、json等数据类型    
  2、CSV_CHUNK_SIZE与csv_line_size参数之间存在约束关系，csv_line_size>=CSV_CHUNK_SIZE需报错并提示用户合理取值    
  3、batch模式下设置GIS_SRID报错    
  4、考虑gis列数据有换行符且数据量大于csv_chunk_size的场景    
  5、use_native_type=false是否对gis导入有影响？已知yasldr端不对坐标中的float做转换    
  6、不支持lobfile/lls导入    
  7、从pg导出gis的csv数据导入yashandb    
  8、yasboot不考虑    
  9、摸底st_geometry数据类型导入性能,Posted by chenqinqing at 五月 09, 2024 15:55|
|---|
