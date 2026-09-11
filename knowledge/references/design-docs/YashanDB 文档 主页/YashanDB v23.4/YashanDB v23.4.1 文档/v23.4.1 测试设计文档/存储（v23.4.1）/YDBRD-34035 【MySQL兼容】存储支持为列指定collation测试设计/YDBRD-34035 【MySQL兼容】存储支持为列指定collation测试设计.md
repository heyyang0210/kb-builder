Created by 刘丹, last modified on 十月 28, 2024

IR链接：

  [https://pingcode.yasdb.com/ship/ideas/66d6763789f961f33010666c?](https://pingcode.yasdb.com/ship/ideas/66d6763789f961f33010666c?)  

#YASHAN-3276  【mysql兼容】MySQL支持按Collation比较字符串

SR链接：

  [https://pingcode.yasdb.com/pjm/items/670c999ce489dd0868f6debe?](https://pingcode.yasdb.com/pjm/items/670c999ce489dd0868f6debe?)  

#YDBRD-34035 【MySQL兼容】存储支持为列指定collation

调研文档：

  [知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/LIUDAN/pages/67c049422d2effe8fb202b6b)  

# 1.   **概述**

mysql兼容下支持为列指定字符集对应的排序规则，可以建库时指定collcaction，也可以建表时指定表的collation或者列的collation，collation后会影响到order by语句的顺序，会影响到where条件中筛选出来的结果，会影响distinct, group by ,having语句的查询结果。排序规则和字符集是对应的关系，匹配失败会报错

# 2.   **需求分析**

## 2.1 功能点分析

**语法：**

**1、建库指定字符序：**

![image.png](https://pingcode.yasdb.com/atlas/files/public/67c6d9516a1ae92ae3736974/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBZ0FBQUFBQUFBQUFBQVFBRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBUUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk3MjMsImV4cCI6MTc4MjQ3MDUyM30.iEvxNQl3vkrvO6FlStE0V62CC19Z6KU05zBLPMtIlvc)

**2、表级的字符序如下：**

- CHARACTER SET: 表示字符集（  charset 是 character set 的简写  ）
- COLLATE: 表示字符集排序  （CHARACTRE SET 与 COLLATE 有对应关系，不满足条件会报错  eg: “COLLATION 'utf8mb4_bin' is not valid for CHARACTER SET 'ascii'”）


![image.png](https://pingcode.yasdb.com/atlas/files/public/67c6d8cb39823f2ac1f263fa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBZ0FBQUFBQUFBQUFBQVFBRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBUUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk3MjMsImV4cCI6MTc4MjQ3MDUyM30.iEvxNQl3vkrvO6FlStE0V62CC19Z6KU05zBLPMtIlvc)

**3、列级别的字符集和collation如下：**

- character set: 表示字符集 (不能简写)
- collate: 表示字符排序


![image.png](https://pingcode.yasdb.com/atlas/files/public/67c66e256a1ae92ae37368ef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBZ0FBQUFBQUFBQUFBQVFBRUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQkFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBUUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk3MjMsImV4cCI6MTc4MjQ3MDUyM30.iEvxNQl3vkrvO6FlStE0V62CC19Z6KU05zBLPMtIlvc)

**4、涉及视图修改的有**

information_schema.tables的TABLE_COLLATION列

information_schema.columns视图的collation_name、CHARACTER_SET_NAME列

information_schema.schemata视图的default_collation_name、DEFAULT_CHARACTER_SET_NAME列

show create table/database语句验证



**5、需求涉及功能点**

- collation规则支持库级，表级和列级以及在select语句中指定。其中的优先级顺序是select指定>列级>表级
- 库级的指定方式是create database test collate [collation],，可以通过information_schema.shemata观测，不指定时继承连接的collation      
- 表级的指定方式是create table test collate [collation],可以通过information_schema.tables来观测，不指定继承schema的
- 列级的指定方式是create table test(f1 char(10) collate [collation]),可以通过INFORMATION_SCHEMA.COLUMNS视图来观测，不指定继承表的
- 表达式的collation推导时，对于column，应使用列定义的colation作为隐式collation
- 列上的索引，根据其collation的规则，可能创建为函数索引
- 分区表应该按照collation来生成分区键
- 唯一约束（含主键）、外键的检查由约束列的collaction来决定






**6、排序规则介绍**  ：根据排序规则名称大概来区分不同的排序规则，collation通常由字符集前缀，语言或规则标识和后缀组成，后缀表示比较行为：

- _ci:不区分大小写，
-  _cs:区分大小写，
-  _bin:按二进制比较,区分大小写和重音,
- _ai:不区分重音（部分字符集支持),
- **_**  unicode  : 基于 Unicode 的排序规则


支持排序规则的数据类型:

||支持列指定，但是实际不生效--视图中查询为空|支持列指定，生效，视图查询有值|列指定报错|
|---|---|---|---|
||数值型：bigint,smallint,tinyint,int,mediumint,DECIMAL,DEC,NUMERIC,FIXED,float,double,real,boolean,日期型：date,datetime,time,timestamp|nchar-->utf8_bin(特定),nvarchar,tinytext,text,mediumtext,longtext(映射)---->clob,char,varchar|BINARY---->(映射)raw(确认),varbinary,TINYBLOB---->(映射)blob,blob,MEDIUMBLOB,LONGBLOB|




## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

mysql兼容下支持的字符序：

1. ascii_bin
1. ascii_general_ci
1. gb18030_bin
1. gb18030_chinese_ci
1. gbk_bin
1. gbk_chinese_ci
1. ISO88591    ~~_bin~~  
1. ISO88591_GENERAL_CI
1. utf8mb4_bin
1. utf8mb4_general_ci


# 3. 详细测试设计

## 3.1 测试设计方法

主要涉及语法和功能的验证

1. 语法主要采用等价类划分和路径覆盖法，对于不同的参数划分有效等价类和无效等价类， 对于有效等价类组合路径覆盖对于语法的各个路径进行组合覆盖
1. 功能主要采用场景法和错误推测法


测试观测点：

1. 指定collate后观测视图，库级别通过 information_schema.schemata，表级通过information_schema.tables观测，列级通过information_schema.columns视图观测
1. 功能验证时观测:


            对于_ci结尾的排序规则，例如:3个值分别是'APPLE','apple','Aplle'，主要验证where=‘apple’返回3条结果，order by排序的结果是‘APPLE’，‘Aplle’,'apple',distinct的去重结果是'apple'

            对于_bin结尾的排序规则，例如:3个值分别是'APPLE','apple','Aplle'，主要验证where=‘apple’返回1条结果，order by排序的结果是‘APPLE’，‘Aplle’,'apple',distinct的去重结果是3条

    3、对于视图适配修改的字段，结合功能进行验证



# 3.2 详细测试设计

1、语法验证：

- 语法验证中组合覆盖所有的collation 和charset
- 语法验证的同时，验证视图适配适配修改是否正确，视图需要关注视图中大小写是否正确


|测试场景|有效等价类|无效等价类|备注|
|---|---|---|---|
|建库指定字符序,CREATE DATABASE mydatabase,CHARACTER SET utf8mb4,COLLATE utf8mb4_unicode_ci;|- 建库不指定字符序，继承连接的collation      
- charset_name和collation_name单引号、双引号、反引号括起
- charset_name和collation_name拼写正确
- charset_name与和collation_name搭配正确
- charset_name与和collation_name小写，小写，大小写混合
- 只指定 CHARACTER 不指定COLLATE，可以成功，继承崖山 （  collation从哪继承？  ）不能指定，显示指定和崖山一样
- 只是定 COLLATE 不指定CHARACTER ，可以成功（  character从哪继承？  ）
- CHARACTER 和COLLATE 在语法中的前后顺序不一样
|- 缺失collate、charset关键字
- collation_name与charset不匹配
- charset_name与和collation_name拼写错误
- blob,binary等二进制数据类型指定collation
- collate关键字位置不正确
- yashan支持但是mysql兼容模式不支持的字符集排序（如：UTF8_PINYIN_CS、UTF8_PINYIN_CI、GB18030_PINYIN_CS、GB18030_PINYIN_CI），可参考oracle兼容性说明资料
- 服务端跟建表指定的字符集不匹配（比如服务端是 utf8 字符集，指定 ASCII_GENERAL_CS 字符序）
- 指定多个collation ，会报错Multiple COLLATE
- 指定多个charset
- CHARACTER SET 缩写  charset
,|有效等价类创建成功后再视图中可以查询成功,无效等价类报错信息正确,|
|建表指定表的字符序,CREATE TABLE mytable (,id INT AUTO_INCREMENT PRIMARY KEY,,name VARCHAR(255) NOT NULL,) DEFAULT CHARSET=utf8mb  4 COLLATE=utf8mb4_unicode_ci;|- 同上
- 不指定字符否则继承schema的（COLLATE和CHARACTER 都不指定）
- 只指定 CHARACTER 不指定COLLATE（ CHARACTER 跟当前schema的CHARACTER 不相同，是否会报错，还是COLLATE从哪获取？）
- 只是定 COLLATE 不指定CHARACTER（ COLLATE 跟当前schema的CHARACTER 不相同，是否会报错，还是COLLATE 从哪获取？）
|- 同上
,,,||
|建表指定列的的字符序,CREATE TABLE mytable (,id INT AUTO_INCREM  ENT PRIMARY KEY,,name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,,description TEXT COLLATE utf8mb4_general_ci,) ;|- 同上
,1. 并补充同时指定表和列：
1. 表和列指定不同的字符序
1. 表和列指定相同的字符序
1. 表中的多个列的collation不一样，匹配相同的字符集/匹配不同的字符集
|- 同上
||
|alter table add column|- 跟当前表的字符序一样
- 跟当前表的字符序不一样
- 跟其他列的字符序一样
- 跟其他的字符序不一样
- 只指定 CHARACTER 不指定COLLATE 
- 只是定 COLLATE 不指定CHARACTER 
,|||


2、功能验证:(覆盖所有支持的collation和所有可以指定collation的数据类型nchar，nvarchar，tinytext，text，mediumtext，longtext，char,varchar）

|序号|测试场景|测试步骤|预期结果|备注|
|---|---|---|---|---|
|1|创建表,表级指定collation，验证查询的基本功能|1.创建表，给表指定collation，查看视图,2、select语句中未显示带collation 查询验证(覆盖下where,order by,distinct、having等基础查询)|1.INFORMATION_SCHEMA.TABLES视图查询结果正确，select查询的表现结果正确|验证过程中的select查询验证主要覆盖下where,order by,distinct, group by ,having（可以用sql的用例进行改造交叉覆盖）,其中where包含:,1. 比较运算符：=、!=、<、>、<=、>= 
1. 逻辑运算符：AND、OR、NOT
1. 模糊查询：LIKE、NOT LIKE、RLIKE、NOT RLIKE
1. 空值检查：IS NULL、IS NOT NULL
1. 范围检查：between and、in、not in、exists、not exists
1. any / all / some
1. case when
|
|2|创建一个表，给表中的列指定collation，验证查询的基本功能|1.创建表，给表中的列指定collation，查看视图，并使用select查询验证(覆盖下where,order by,distinct等基础查询)|1.INFORMATION_SCHEMA.COLUMNS视图查询结果正确，select查询的表现结果正确|交叉覆盖显示指定和隐式继承|
|3|创建一个表，表和列同时指定collation，验证查询的基本功能|1.表和列指定的collation不同，并使用select查询验证,2.表和列指定的collation相同，并使用select查询验证,3.表和列指定的collation不同，并使用select查询验证表和列的优先级|1.INFORMATION_SCHEMA.TABLES和INFORMATION_SCHEMA.COLUMNS视图查询结果正确，select查询的表现结果正确,2.列的优先级大于表的|交叉覆盖显示指定和隐式继承|
|4|列的优先级和select查询的优先级验证|1.创建表，列指定collation,查询视图，select 时指定的collation与列级别的collation不同,2.创建表，列指定collation,查询视图，select 时指定的collation与列级别的collation相同|1、select指定的优先级大于列指定（如果不匹配会报错）,||
|5|索引（  列指定了collation的情况  ）,- create index 
- alter table 增加索引
|1、建表未指定字符序，给字符列创建索引，使用select走索引扫描查询,2、只指定表的字符序，未指定列的字符序，创建索引，使用select走索引扫描查询,3、指定了列的字符序，索引为单列，索引的字符序跟随列的，使用select走索引扫描查询,4、索引为多列，不同列collaction不一样，可以兼容同一个字符集（如：utf8mb4_bin、utf8mb4_general_ci），使用select走索引扫描查询,5、索引为多列，不同列collaction不一样，不可以兼容（如：utf8mb4_bin、latin1_bin），使用select走索引扫描查询--  索引列是其它数据类型,|1、索引可以走库的collation,2、索引走表的collation,3、索引走列的collaction,4、是否报错，还是可以转换,5、报错|组合基础的filter条件进行验证,|
|6|唯一约束（含主键）,- 建表带主键、唯一约束
- alter table的方式增加主键约束
- alter table 增加列的同时增加唯一约束
- 增加唯一索引
|唯一约束所在的列，覆盖不同的字符序（覆盖先建约束后插入、先插入后再创建约束）,1、字符一样，大小写不一样:'APPLE','apple','Aplle',2、  重音场景：ÀÁÂÃÄ、'àáâãä' 、'aaaaa'--8.0（对齐）,3、存在空格的场景：‘TEST1’、‘TEST1      ’、‘TEST1  ’、‘TEST 1’|1、CI识别为一样的，bin识别不一样，CI重复插入或者更新成相同值报错，bin不会报错，,2、CI识别为一样的，bin识别不一样，CI重复插入或者更新成相同值报错，bin不会报错,3、末尾的空格会去掉，中间的空格不会去掉||
|7|外键    |外键约束所在的列覆盖不同的字符序（覆盖先建后插入、先插入后再创建约束））,1、父表跟主表字符一样，大小写不一样:'APPLE','apple','Aplle',2、父表跟主表 重音场景：ÀÁÂÃÄ、'àáâãä' 、'aaaaa',3、父表跟主表空格不一样的场景：‘TEST1’、‘TEST1      ’、‘TEST1  ’、‘TEST 1’,4、父表所有在列和主表所在的列collation不匹配，创建外键失败|1、有的字符序父表和子表大小、重音不一样，也能在父表找到依赖，有的字符序则会报错,2、子表和子表尾部空格数不一样，也能识别找到依赖|使用外键场景dml，级联删除  ，|
|8|check约束|check约束所在列覆盖不同的字符序（覆盖先建后插入、先插入后再创建约束）,1、check（f1='APPLE'）时插入或者更新‘APPLE','apple','Aplle',2、check（f1=ÀÁÂÃÄ）时插入或者更新ÀÁÂÃÄ、'àáâãä' 、'aaaaa',3、check（f1=TEST1’）时插入或者更新‘TEST1’、‘TEST1      ’、‘TEST1  ’、‘TEST 1’||check约束可以组合覆盖常见的filter条件|
|9|与alter table 结合|1.alter table add column时指定collation，查询INFORMATION_SCHEMA.COLUMNS视图，并select查询,2.alter table change 列名的时候修改collation,查询INFORMATION_SCHEMA.COLUMNS视图，并select查询,3.alter table modify (不支持)|1.视图增加一列，查询结果正确,||
|10|分区表（一级、二级）,1. hash分区
1. list分区
1. range分区
1. key分区
|1.将指定collation列作为分区键--  是否分区  ，  分区查询，查询范围落在部分分区范围内,2.做select查询，全表扫描,3、创建索引（索引包含、不包含分区键），基于索引扫描查询---  local index|1.select查询结果正确|数据包含大小写，重音，空格,分区剪枝,|
|11|其他类型数据指定 collate|1. 建表，给
1. 数值型：bigint,smallint,tinyint,int,mediumint,DECIMAL,DEC,NUMERIC,FIXED,float,double,real,boolean,bit
1. 日期型：date,datetime,time,timestamp 指定collate
1. binary/varbinary/blob 相关指定collate
|1.数值型和日期型指定collation不报错，查询视图无值，实际不生效,2.二进制不支持指定collate，创建的时候报错||
|12|与多表查询结合,     HASH JOIN,     MERGE JOIN,     NEST LOOP,     UNION/ALL|1.创建多张表，都指定collate，使用join查询,2.创建多张表，部分指定collate，部分不指定collate，使用join查询,3.不同表的collation不一样，可以转换,4.不同表的collation不一样，不能转换（utf8与acsii）|||
|13|视图|创建视图的时候指定collate,create view v1(f1 ,f2 collate)|报错||
|14|HA|主机创建列指定collation，备机查询视图与主机一致，且备机的select查询遵循collate的排序规则,主备倒换后，新主创建成功，且遵循指定的collate|||
|15|HA|带逻辑备机场景下，创建表带collation，并创建索引插入数据，逻辑备机升主|||
|16|并发|创建表列指定字符序和select 视图及select表并发|||


  


(DFX）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|涉及，|
|长稳|涉及|
|一致性|不涉及，测试单机场景，不涉及一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，|
|安全|不涉及，不涉及用户密码权限登安全性问题，不涉及安全专项|
|DFR/testkill|不涉及，|
|HA|涉及，|
|压力|不涉及，|
|性能|不涉及，|
|可维护性|不涉及，|




# 4. 测试用例

测试设计细化后的文本用例

详见附件

# 5.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 6.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

# 7. 工作量评估

工作量：  *11人天*

*调研+评审+测试设计--3天*

*自动化用例+测试  --7天*

*上车分析 -1天*

计划测试完成时间：2025.3.18

  




