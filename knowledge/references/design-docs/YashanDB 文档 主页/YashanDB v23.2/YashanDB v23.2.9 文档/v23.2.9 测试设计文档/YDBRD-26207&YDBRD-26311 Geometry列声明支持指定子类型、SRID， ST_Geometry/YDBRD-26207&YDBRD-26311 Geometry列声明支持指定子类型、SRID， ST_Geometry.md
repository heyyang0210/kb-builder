Created by 党文琪, last modified on 十一月 15, 2024

# 1. 概述

需求：

  [https://pingcode.yasdb.com/pjm/items/6618f29bfd997db58ad84fa3](https://pingcode.yasdb.com/pjm/items/6618f29bfd997db58ad84fa3)    ?    
  #YDBRD-26207 Geometry列声明支持指定子类型、SRID

  [https://pingcode.yasdb.com/pjm/items/66193300fd997db58ad8a9d7](https://pingcode.yasdb.com/pjm/items/66193300fd997db58ad8a9d7)    ?    
  #YDBRD-26311 ST_Geometry_Columns视图可显示子类型、Srid、维度

开发设计文档：

  [gis支持geometry子类型特性开发设计文档 - 龚雯 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171080173)  

测试调研文档：

  [YASHAN-858 geometry列数据类型支持PostGIS语法和行为兼容需求调研 - 党文琪 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=177833650)  

# 2. 需求分析

## 2.1 功能点分析

场 景： 

create/alter table时列数据类型支持形如geometry(point, 4326)语法 

需求描述： 

1 当insert/update时，如果geomtry的子类型与声明不匹配，返回错误；    
  2 如果srid与声明不匹配，返回错误；如srid未指定，则使用声明的srid 

需求范围：

 1、单机

功能分析：

本次新增的功能是在已经支持指定表列为geometry类型的前提下，指定子类型及SRID的语法，需要关注类型与srid的校验，在不同场景的使用情况：

|  
|  
|  
|  
|
|---|---|---|---|
|1|类型,支持维度到3维，支持指定为z，不支持指定为m|指定ST_GEOMETRY列的类型为  ST_GEOMETRY，同时指定srid|CREATE TABLE tb_YDBRD26207_001(road_id int PRIMARY KEY, geom geometry(geometry,4327));,INSERT INTO tb_YDBRD26207_001 VALUES (1,st_geomfromtext('LINESTRING(191232 243118,191108 243242)',4327));|
|2|  
|POINT|POINT (1 2)|
|3|  
|LINESTRING|LINESTRING (1 2,4 5)|
|4|  
|LINEARRING|LinearRing(0 0, 1 1, 0 0)|
|5|  
|POLYGON|POLYGON ((1 0,1 1,2 2,1 0),(0 0,6 6,8 8,0 0))|
|6|  
|MULTIPOINT|MULTIPOINT ((1 1),(2 2))|
|7|  
|MULTILINESTRING|MULTILINESTRING ((1 2,4 5),(2 3,5 6))|
|8|  
|MULTIPOLYGON|MULTIPOLYGON (((1 5, 4 3, 6 6, 2 6, 1 5)), ((6 5, 8 8, 6 9, 6 5)))|
|9|  
|GEOMETRYCOLLECTION|GEOMETRYCOLLECTION (POINT (1 0),LINESTRING (1 2,4 5))|
|10|srid|可配置范围：  [0,999999],若为负数转换为0，若为小数四舍五入|  
|
|11|  
|常用的srid|4326，4327，3857，4490，4479，4480，4508，4509，  2349|
|12|  
|转换结果验证|SELECT ST_SRID(ST_GeomFromText('POINT(-58.2687 29.149)',1356)) res FROM DUAL;|
|13|  
|子类型有单双引号|预计对齐支持|
|14|应用场景|create table|建表时指定父类型，指定子类型；指定类型+srid；指定约束；指定创建索引；作为分区键；作为临时表表列|
|15|  
|alter table|新增列；修改列定义（修改子类型，修改srid)，修改列名，修改缺省值（修改类型，修改srid),truncate,drop|
|16|  
|insert into|结合表类型定义验证|
|17|  
|update|做set值/做filter条件|
|18|  
|delete|filter条件|
|19|  
|merge|指定gis子类型的列做关联键|
|20|  
|plsql|游标打开表列|
|21|gis函数|构造函数,ST_MakePoint、 ST_MakeLine|构造对象用于更新列值，用于默认值|
|22|  
|访问函数,ST_Dimension、ST_NPoints|本次不关注|
|23|  
|编辑函数,ST_AddPoint|本次不关注|
|24|  
|校验函数,ST_Valid|本次不关注|
|25|  
|空间参考函数,ST_SRID、ST_SetSRID、ST_Transform|查看srid正确，修改srid与定义不符合时是否报错|
|26|  
|Input,ST_GeomFromWKT、ST_GeomFromGeoJson|构建对象用于表列insert或更新|
|27|  
|Output,ST_AsBinary、ST_AsText、ST_AsGeoJson|检查转换输出的数据是否符合预期|
|28|  
|空间关系,ST_Intersects、 ST_Contains|本次不关注|
|29|  
|度量函数,ST_Area、ST_Length|本次不关注|
|30|  
|叠加分析函数,ST_Union、ST_Intersects|本次不关注|
|31|  
|处理函数,ST_Buffer、ST_ConvexHull、ST_Simplify|本次不关注|
|32|  
|仿射变换函数,ST_Rotate|本次不关注|
|33|  
|线性参考,ST_LineLocatePoint|本次不关注|
|34|视图测试点|维度|2，3，4（4暂不支持）|
|35|  
|类型|GEOMETRY，subtype，subtype+z|
|36|  
|srid|[0,999999]|


|新增视图字段|类型|维度|子类型|srid|
|---|---|---|---|---|
|1|geometry|2|GEOMETRY|指定值（默认0）|
|2|point|2|POINT|指定值（默认0）|
|3|pointm（不支持）|/|/|/|
|4|pointz|3|POINT|指定值（默认0）|
|5|pointzm（不支持）|/|/|/|
|6|无子类型|2|GEOMETRY|0|
|7|非geometry类型|无|无|无|


  


## 2.2 应用场景

- 用于ddl语句和dml语句中，详情见需求分析
- 本次测试应该重点关注指定子类型和srid后dml，ddl的行为


## 2.3 规格约束

参考开发设计文档中的规格约束：

1.若未安装gis插件或安装了旧版本的插件，则不支持ddl指定子类型，并且不支持向gis子类型的列插入数据

2.当前geometry不支持维度m，只支持二维或三维z，若指定三维m或四维，ddl语句报错

3.srid的范围是int，若为负数转换为0，若为小数四舍五入（与其他gis函数规格一致）

4.支持的子类型：POINT、LINESTRING、POLYGON、MULTIPOINT、MULTILINESTRING、MULTIPOLYGON、  GeometryCollection

5.  insert/update表现

|定义类型|insert/update的维度限制|insert/update的子类型限制|
|:---|:---|:---|
|geometry|无限制（2、3），可以互不相同|无限制，可以互不相同|
|geometry(geometry)|只支持二维|无限制，可以互不相同|
|point|只支持二维|只支持point类型|
|pointz|只支持三维（z）|只支持pointz和不指定zm的point类型|
|multipoint|只支持二维|只支持multipoint|
|GEOMETRYCOLLECTION|只支持二维|只支持  GEOMETRYCOLLECTION|


其他类型参考以上类型

若没有指定srid或指定srid为0，无限制，可以互不相同（超过边界按照3.1的规则报错或转换）；

若指定srid不为0，数据的srid必须等于建表srid或0，超过边界按照3.1的规则报错或转换后再进行判断。

# 3. 详细测试设计

## 3.1 测试设计方法

测试设计主要采用边界值法和等价类划分法

gis相关函数按照大类覆盖，不需要覆盖全量

|  
|一级测试点|二级测试点|三级测试点|
|---|---|---|---|
|1|DDL|建表，指定  geometry(geometry)|insert任意符合条件的子类型，指定不同的srid无异常，desc查看定义，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|2|  
|建表，指定  geometry(subtype)|覆盖所有支持的二维类型，desc查看定义，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|3|  
|  
|覆盖所有支持的三维类型，desc查看定义，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|4|  
|  
|覆盖四维，当前预计拦截报错，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|5|  
|建表，指定  geometry(非法类型)|非gis类型，包括普通标量，box2d，udt类型及无效值，desc查看定义，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|6|  
|建表，指定  geometry(geometry，srid)|覆盖srid超出  [0,999999]，desc查看定义，查看ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|7|  
|  
|srid为小数，包括直接写和指数型，desc查看定义，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|8|  
|  
|srid为表达式|
|9|  
|  
|srid为整数，但非spatial_ref_sys中的有效值，desc查看定义，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|10|  
|  
|srid为整数，是spatial_ref_sys中的有效值，insert时覆盖srid符合定义和不符合定义两种，desc查看定义，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|11|  
|建表，create table as select|预计不支持|
|12|  
|建表，有not null约束|创建后insert null|
|13|  
|建表，有主键约束|输入重复值|
|14|  
|建表，有外键约束|修改引用|
|15|  
|建表，检查约束|超出数据范围或格式限制|
|16|  
|建表，默认约束|建表时不指定子类型，不指定srid，默认值设置子类型和srid|
|17|  
|  
|设置默认约束指定子类型，不指定srid，子类型与定义相同,使用默认值insert/不使用默认值insert|
|18|  
|  
|设置默认约束指定子类型，不指定srid，子类型与定义不同,使用默认值insert/不使用默认值insert|
|19|  
|  
|设置默认约束指定子类型，指定srid，srid与表列定义相同,使用默认值insert/不使用默认值insert|
|20|  
|  
|设置默认约束指定子类型，指定srid，srid与表列定义不同,使用默认值insert/不使用默认值insert|
|21|  
|建分区表指定为分区键|不支持|
|22|  
|建临时表指定表列包含子类型和subtype|  
|
|23|  
|建视图|  
|
|24|  
|modify column|新增一个  geometry列，包含指定子类型，指定srid，查看ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|25|  
|  
|删除一个指定了  geometry列，包含指定子类型，执行srid，查看ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|26|  
|  
|修改datatype，修改子类型，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|27|  
|  
|修改datatype，修改srid，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|28|  
|  
|修改维度（不支持）,（调研下已支持的范围）|
|29|  
|  
|修改列名后再调用，select/insert指定，查看  ST_Geometry_Columns视图和系统表geometry_columns$，表列符合定义|
|30|  
|  
|修改缺省值，修改子类型类型，srid与定义一致|
|31|  
|  
|修改缺省值，修改子类型类型与定义不一致|
|32|  
|  
|修改缺省值，修改srid与定义不一致|
|33|  
|创建索引|  
|
|34|  
|truncate|truncate之后insert或查表|
|35|  
|drop/drop if exists|其他用例中覆盖删除后查视图|
|36|DML|insert into values（）|插入值不符合/符合定义的子类型或srid|
|37|  
|insert into select|插入值不符合/符合定义的子类型或srid|
|38|  
|update|子类型列做filter条件，直接匹配|
|39|  
|  
|子类型列做set条件，set值符合定义的子类型/srid|
|40|  
|  
|子类型列做set条件，set值不符合定义的子类型/srid|
|41|  
|delete|子类型做filter条件，直接匹配|
|42|  
|merge|指定gis子类型的列做关联键|
|43|其他应用|dbms_metadata    
  获取建表语句，检查结果是否符合预期|  
|
|44|异常容错|指定srid时语法错误|无逗号，指定多个|
|45|  
|指定类型时无括号|  
|
|46|  
|只指定srid不指定subtype|  
|
|47|  
|指定类型和srid为null|  
|
|48|  
|指定类型和srid为非法字符串|  
|
|49|  
|插入值或更新值与定义的类型或srid不同|已在其他用例中覆盖|
|50|函数相关|构造函数,不指定srid：ST_MakePoint、 ST_MakeLine,可以指定srid：  ST_POINT、ST_POINTZ、ST_POLYGON|用于insert,  
|
|51|  
|  
|用于构造默认值|
|52|  
|空间参考函数,ST_SRID、ST_SetSRID、ST_Transform|查看已插入数据srid正确,其他用例中已覆盖|
|53|  
|  
|修改srid与定义不符合时是否报错|
|54|  
|  
|用于filter条件中|
|55|  
|Input,ST_GeomFromWKT（不支持）（确认下函数是否支持，确认下函数名）、ST_GeomFromGeoJson,ST_GEOMFROMEWKB|构建对象用于表列insert或更新|
|56|  
|  
|用于构造默认值|
|57|  
|Output,ST_AsBinary、ST_AsText、ST_AsGeoJson|检查转换输出的数据是否符合预期|
|58|  
|GEOMETRYTYPE，ST_GEOMETRYTYPE，返回对应子类型|验证数据插入后，子类型是否与定义一致，应用在查询和filter中|
|59|  
|ST_GEOMCOLLFROMTEXT，根据wkt和srid返回一个ST_GEOMETRY类型数据，如果传入的WKT不是GEOMETRYCOLLECTION，则返回NULL。|用于数据构造，指定srid符合或不符合定义|
|60|  
|  
|用于默认值，指定srid符合或不符合定义|
|61|  
|ST_LENGTH，返回长度，此函数与srid有关（不关注）|检查插入数据的srid，定义的数据srid在  spatial_ref_sys，正常返回|
|62|  
|  
|检查插入数据的srid，定义的数据srid为0   ，正常返回|
|63|  
|  
|检查插入数据的srid，定义的数据srid不在  spatial_ref_sys，返回null|
|64|  
|ST_X，ST_Y，  ST_Z  ，返回对应坐标值|用于数据参与运算|
|65|其他视图测试点|非  geometry类型表列，在新增视图和表中不可查|BOX2D|
|66|  
|  
|其他数据类型|
|67|  
|  
|不包含  geometry子类型的  UDT类型|
|68|  
|  
|包含  geometry子类型的UDT类型|
|69|  
|表删除后，新增视图和表中查不到|ddl用例中执行完删除后再检查一次视图和表，其他用例已覆盖|
|70|  
|检查数据库名无异常|  
|
|71|  
|所属用户名无异常，多个用户下存在同名表，同名列时标识清晰|  
|


## 并发用例设计：

1. 创建依赖表，包含指定子类型或指定srid
1. alter修改依赖表，增加删除表列
1. alter修改依赖表，修改默认值
1. 并发dml，插入值符合定义
1. 并发dml，插入值不符合定义
1. truncate表
1. 删除依赖对象


并发组1：并发insert，update，delete

并发组2：并发dml，同时有alter增删表列

并发组3：并发dml，同时有alter修改列默认值

并发组4：并发dml，同时有truncate

并发组5：全量并发，dml，alter修改表定义，truncate

用例后置开启结果校验

其他场景测试：

1、旧插件+新版本，建表，dml，ddl，功能不可用，但ddl可用

2、旧版本只支持指定大类型，升级后视图行为，功能无异常

3、%rowtype场景拦截，包括表列继承，游标继承（预期与规格约束中描述一致）

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|功能|是|
|长稳|是|
|安全|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Comments:

|  [](null)  ,1、调研当前gis类型支持ddl更新表列的行为范围（支持增删列，不支持修改已有列的类型，列名，默认值）,2、  ST_GEOMCOLLFROMTEXT，ST_LENGTH，ST_X，ST_Y行为与本次转测支持范围无关,3、  %rowtype场景拦截，包括表列继承，游标继承（预期与规格约束中描述一致）,4、关注下新增视图的权限，sys用户下，普通用户下与其他视图保持一致,5、普通标量指定子类型和srid，预计报错拦截,Posted by dangwenqi at 十一月 15, 2024 16:16,其他：LinearRing最后实现的是支持插入但不支持指定为子类型|
|---|


差异案例：

1、insert语句中用到seq时，子类型的检查比sequence取值更早，所以插入有成功，有失败时，检查最终结果seq值仍是连续的，与普通类型不同

![WXWorkLocal_17329535794311.png](https://pingcode.yasdb.com/atlas/files/public/674ac92fa1ad9a3311de3b2f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlCQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjM5OTAsImV4cCI6MTc4MjMzNDc5MH0.wNN2KtrThJi5dPhU1_Gc2S3_M5tV2bZrhs_07SfNpqE)

![clipbord_1732953726930.png](https://pingcode.yasdb.com/atlas/files/public/674ac93ca1ad9a3311de3b30/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlCQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjM5OTAsImV4cCI6MTc4MjMzNDc5MH0.wNN2KtrThJi5dPhU1_Gc2S3_M5tV2bZrhs_07SfNpqE)

