Created by 刘大境, last modified on 八月 29, 2024

# 1. 概述

在原有的mysql table框架之上，适配相关的表选项列数据类型及属性

IR:       [YASHAN-934 【mysql兼容】（功能&语法）支持表的特定特性](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f6?%20#YASHAN-934%20%20%E3%80%90mysql%E5%85%BC%E5%AE%B9%E3%80%91%EF%BC%88%E5%8A%9F%E8%83%BD&%E8%AF%AD%E6%B3%95%EF%BC%89%E6%94%AF%E6%8C%81%E8%A1%A8%E7%9A%84%E7%89%B9%E5%AE%9A%E7%89%B9%E6%80%A7)  

SR：    [YDBRD-26252 兼容MySQL Table相关DDL语法](https://pingcode.yasdb.com/pjm/items/6619084afd997db58ad8820e?%20#YDBRD-26252%20%E5%85%BC%E5%AE%B9MySQL%20Table%E7%9B%B8%E5%85%B3DDL%E8%AF%AD%E6%B3%95)  

开发文档：    [兼容MySQL Table相关DDL语法设计文档 - 李子怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150612334)  

测试调研文档：    [兼容MySQL Table相关DDL语法调研文档 - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153013623)  

# 2. 需求分析

(1)【表选项】

engine/character set/collate/row_format

指定表的ENGINE/CHARACTER SET/COLLATE/ROW_FORMAT属性

其中：

1.ENGINE: 表示存储引擎

2.CHARACTER SET: 表示字符集（  charset 是 character set 的简写  ）

3.COLLATE: 表示字符集排序  （CHARACTRE SET 与 COLLATE 有对应关系，不满足条件会报错  eg: “COLLATION 'utf8mb4_bin' is not valid for CHARACTER SET 'ascii'”）

4.ROW_FORMAT: 表示创建和管理表的存储格式 （可取值：DEFAULT|DYNAMIC|FIXED|COMPRESSED|REDUNDANT|COMPACT）

- ![](https://conf.yasdb.com/download/attachments/150612334/image2024-4-28_14-30-38.png?version=1&modificationDate=1714285838000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc2NDYsImV4cCI6MTc4MjQ0ODQ0Nn0.aDyPBZuNk4hLh4tzOjQKGV995_c3Hfc-5sUNxKyApWs)


CREATE     TABLE   表名( ..... )   ENGINE   = [engine_name]   DEFAULT     CHARSET   = [charset_name]   COLLATE   = [collate_name] ROW_FORMAT = [row_format] 

CREATE     TABLE   表名( ..... )   CHARACTER     SET   [charset_name]   COLLATE   [collate_name]

  


(2)   【列数据类型和属性】

collate/character set/comment

指定列的collate/character set/comment属性（collate/character set如果列级别没有设置，继承表级别的设置）

其中：

1.character set: 表示字符集 (不能简写)

2.collate: 表示字符排序

3.comment: 表示注释(最长1024字节：Comment for field *** is too long (max = 1024))

![](https://conf.yasdb.com/download/attachments/150612334/image2024-4-28_14-55-2.png?version=1&modificationDate=1714287302000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzc2NDYsImV4cCI6MTc4MjQ0ODQ0Nn0.aDyPBZuNk4hLh4tzOjQKGV995_c3Hfc-5sUNxKyApWs)

alter table change ：  **ALTER TABLE**   table_name   **CHANGE**     old_column_name  new_column_name column_definition

                                  可以重命名列并更改定义（change = modify + rename）

                                  可以使用FIRST和AFTER对列进行重新排序（暂不支持）

                                  修改列的数据类型时，需保证列中值空（column to be modified must be empty）

  


# 3.规格约束

|支持的MySQL兼容语法|映射的yashan SQL语句类型|
|---|---|
|create table|SQL_CREATE_TABLE|
|alter table|SQL_ALTER_TABLE|


1.TABLE相关DDL语法仅做语法兼容。

2.charset名称和collation名称，支持使用单引号、双引号、反引号括起；table名称，列名称 支持用双引号，反引号括起。

3.ROW_FORMAT 可取值限定为：DEFAULT|DYNAMIC|FIXED|COMPRESSED|REDUNDANT|COMPACT。

4.CHARACTER SET与COLLATE 有对应关系，不满足要求会报错。（详见：表一）

5.CHARACTER SET与 COLLATE属性只针对字符类型数据列，如果列为非字符类型，设置这两个属性会报错。

6.列属性comment 最长1024个字节。

8.分区表/临时表/  CREATE TABLE LIKE不支持

9. table_name, 列名称MYSQL不支持双引号，支持单引号和反引号括起

10.字符集要求不允许设置UTF16，做报错拦截看护

表一：  CHARACTER SET与COLLATE 的一对多对应关系  (参考：    [mysql字符集设置](https://conf.yasdb.com/pages/viewpage.action?pageId=150617920)    )

|CHARACTER SET|COLLATE|DEFAULT COLLATION|
|---|---|---|
|ASCII|ASCII_GENERAL_CS,ASCII_GENERAL_CI|ASCII_GENERAL_CI|
|GBK|GBK_GENERAL_CS,GBK_GENERAL_CI|GBK_GENERAL_CI|
|UTF8|UTF8_GENERAL_CS    
  UTF8_GENERAL_CI    
  UTF8_PINYIN_CS    
  UTF8_PINYIN_CI|UTF8_GENERAL_CI|
|LATIN1|ISO88591_GENERAL_CS,ISO88591_GENERAL_CI|ISO88591_GENERAL_CI|
|GB18030|GB18030_GENERAL_CS    
  GB18030_GENERAL_CI    
  GB18030_PINYIN_CS    
  GB18030_PINYIN_CI|GB18030_GENERAL_CI|
|UTF8MB4|UTF8MB4_BIN,UTF8MB4_GENERAL_CI|UTF8_GENERAL_CI|
|UTF8MB3|UTF8MB4_BIN,UTF8MB4_GENERAL_CI|UTF8_GENERAL_CI|
|UTF16|UTF16_GENERAL_CS,UTF16_GENERAL_CI,UTF16_PINYIN_CS,UTF16_PINYIN_CI|UTF16_GENERAL_CI|


# 4. 详细测试设计

## 4.1 测试设计方法

语法中的各个参数验证采用正交组合验证，涉及comment边界值验证

测试关注点：

1.CHARACTER SET与DEFAULT COLLATION正常对应关系交互能够创建/修改成功，对应异常关系创建/修改失败

2.comment做边界值验证

3.alter table change生效后，查询视图及表正常

4.  表选项有无 = 号都可创建成功，展示一致

5.  CHARACTER SET 指定字符集后，不指定COLLATE属性，走COLLATE默认属性？

6.   *create table表选项ROW_FORMAT不指定默认为Dynamic(动态格式)？*

*7.*  *表和列的comment属性*

*8.是有一些关键字，我们不能做表名和列名，但是mysql可以。 这些在mysql模式下，应该要支持作为表名或者列名，我们不能做表名和列名的关键字， 在mysql上做对比， mysql支持，我们就要支持*

关注对象：表名、列名、user名称、schema_name、表空间名称、索引名称

*YASHAN关键字文档：*    [https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E4%BF%9D%E7%95%99%E5%85%B3%E9%94%AE%E5%AD%97.html](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E4%BF%9D%E7%95%99%E5%85%B3%E9%94%AE%E5%AD%97.html)  

## 4.1.1专项覆盖

|专项|是否涉及|说明|
|---|---|---|
|并发|不涉及|语法兼容|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|不涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


## 4.2 测试设计方法

*语法：*  *语法中的各个参数验证采用边界值，等价类划分，不同参数的有效等价类做正交组合验证，无效等价类单独覆盖*

|编号|测试场景|输入条件|有效等价类|无效等价类|备注|
|---|---|---|---|---|---|
|1|create table|ENGINE AND engine_name|ENGINE带 = engine_name,ENGINE不带= engine_name,不指定  ENGINE也不指定DEFAULT,engine_name  大写,engine_name小写,engine_name大小写,engine_name单引号、双引号、反引号括起（  **结合大小写和大小写混合**  ）|ENGINE=带关键字  ACCESS/HAVING     /   OFFLINE /UNION ,ENGINE  关键字缺失,指定ENGINE缺失 engine_name,engine_name为  NULL,engine_name  ""为空,engine_name  特殊符号,engine_name   字符长度超过64位,engine_name为  数字组合,指定ENGINE engine_name  指定DEFAULT|  
|
|2|  
|CHARACTER SET  ,**CHARSET**|CHARACTER SET带等号 charset_name,CHARACTER SET不带等号 charset_name,不指定CHARACTER SET  ,charset_name单引号、双引号、反引号括起（  **结合大小写和大小写混合**  ）,charset简写|关键字缺失,指定关键字，缺失charset_name,charset_name为null,charset_name为空"",指定DEFAULT,不支持的字符集（UTF16)|  
|
|3|  
|COLLATE|COLLATE 带等号 collation_name,COLLATE 不带等号 collation_name,不指定COLLATE （走默认排序，与MySQL保持一致),collation_name  单引号、双引号、反引号括起,  
|COLLATE 关键字缺失,指定关键字，缺失collation_name,collation_name为null,collation_name为空"",不支持的collate(utf8mb4_unicode_ci)|  
|
|4|  
|ROW_FORMAT|COLLATE 带等号 正交6个值,COLLATE 不带等号 正交6个值,不指定row_format,COLLATE 大小写，大小写混合|值大小写，大小写混合,值关键字缺失,指定不相关值，例如：SECOND|  
|
|5|  
|CHARACTRE SET/  **CHARSET**  与 COLLATE 对应关系|正常对应关系,列为字符类型  **varchar(32k),blob**,**只指定CHARACTRE，不指定COLLATE **,**只指定COLLATE不指定CHARACTRE**|错误对应关系,列为非字符类型  **（覆盖下YASHAN所有支持的数据类型）**,**如果表中既有字符列，又有非字符列，加表的字符属性是否会报错?**,  
|参考表一|
|  
|  
|  
|**表指定CHARACTRE SET 与 COLLATE，列指定跟表一样的CHARACTRE SET 与 COLLATE**|  
|  
|
|  
|  
|  
|**表指定CHARACTRE SET 与 COLLATE，列指定跟表不一样的CHARACTRE SET 与 COLLATE**|  
|  
|
|  
|  
|  
|**表和列只指定CHARACTRE，属于相同COLLATE下不同值**,**表和列只指定CHARACTRE，属于不同的COLLATE**,**表和列只指定COLLATE，属于相同COLLATE**,**表和列只指定COLLATE，属于不同COLLATE**|  
|  
|
|6|  
|comment|创建表属性  comment ,创建列属性comment|指定列属性长度为0,指定列属性长度为1025,指定表属性长度为2049,指定表属性长度为0,(表comment规格2048，列comment规格1024),空字符串|dba_tab_columns,对比MYSQL|
|  
|  
|  
|**使用mysql创建的表或者列的属性，用yashan的语法修改或者清除**|  
|  
|
|7|  
|table_name|  
|带关键字ACCESS/HAVING / OFFLINE /UNION,特殊符号,字符长度超过64位|  
|
|8|ALTER TABLE|CHARACTER SET|指定CHARACTER SET=charset_name,指定指定CHARACTER SET不指定charset_name,带等号、不带等号|不指定指定CHARACTER SET,指定CHARSET简写报错,  
|未实现|
|  
|  
|  
|**修改CHARACTER 和建表时指定的COLLATE 匹配、**|  
|未实现|
|9|  
|COLLATE|COLLATE 带等号 collation_name,COLLATE 不带等号 collation_name,不指定COLLATE （走默认排序，与MySQL保持一致，这个如何校验？）,指定DEFAULT,不指定COLLATE,**修改COLLATE 和建表时指定的CHARACTER 匹配、不匹配**|带关键字ACCESS/HAVING / OFFLINE /UNION|未实现|
|10|  
|COMMENT|只修改表属性  comment ,只修改列属性comment,表/列comment同时修改|指定列属性长度为0,指定列属性长度为1025,指定表属性长度为2049,指定表属性长度为0,(表comment规格2048，列comment规格1024),空字符串|  
,dba_tab_columns,  
|
|  
|  
|  
|**使用yashan语法创建的comment，使用mysql兼容模式下的语法进行修改或者清理**|  
|  
|
|11|  
|ALTER TABLE table_name CHANGE old_column_name new_column_name column_definition|列中无值变更,修改列的数据类型(该列为空),修改多列属性,修改列属性+修改列名组合|带有值的列变更,字符类型修改为非字符类型|dba_tab_columns|
|  
|  
|  
|**指定的new_column_name 和old_column_name 相同**,**指定的new_column_name 和old_column_name 不相同**|**不指定 new_column_name **,**ALTER TABLE table_name CHANGE old_column_name  column_definition**|  
|
|  
|  
|  
|**在同一条语句中把列从非字符类型修改成字符类型的同时，修改CHARACTER SET和COLLATE**|**column_definition中指定CHARSET会报错**|未实现|
|  
|  
|  
|**覆盖yashan支持的所有modify的路径**|alter table new_column_name为保留关键字,alter table rename new_tablename为保留关键字|  
|
|  
|  
|  
|  
|  
|  
|
|12|拦截场景|create table|  
|指定分区表,指定临时表,指定嵌套表,CREATE TABLE LIKE,UDT列作为create table字符集列|  
|
|13|  
|分布式和集群形态下create table拦截（不支持，不做观测）|  
|  
|  
|
|14|  
|单机LSC、TAC  create table拦截（不支持，语法识别不到）|  
|  
|  
|
|15|交互场景|create table 后指定tablespace，做DDL/DML操作|指定内置表空间  SYSTEM、SYSAUX、USERS,指定加密、压缩、MMS表空间|指定内置表空间  TEMP、UNDO、SWAP|  
|
|16|  
|create/alter table指定  schema|  
|  
|  
|
|17|  
|create table as select|  
|  
|  
|
|18|  
|create table_name/列名/tablespace_name/schema/user_name/view|使用崖山保留关键字在MY_SQL兼容下进行测试|  
|  
|
|19|升级场景|22.2版本升级23.2版本create table赋予MYSQL属性|  
|  
|  
|
|20|  
|22.2版本create table普通表，23.2版本alter table COMMENT赋予MYSQL属性|  
|  
|  
|


  


# 5. 文本用例

  


# 6. 测试框架设计

本次测试采用yasft测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7. 测试环境说明

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[YDBRD-26252 兼容MySQL Table相关DDL语法.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODI4OTcwYzJhZjRmNTIxOTEyIiwicmVmX2lkIjoiNjczOTZlODI1OTNmOTljOWZmMjM4NTlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjQ2LCJleHAiOjE3ODI1MjQwNDZ9.GjaSyors_NxYALnzw7FvTPFtnh2SUpi8R1ngoG9ug-c)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26252 兼容MySQL Table相关DDL语法.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODJhMWFkOWEzMzExZGM5Nzg3IiwicmVmX2lkIjoiNjczOTZlODI1OTNmOTljOWZmMjM4NTlhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjQ2LCJleHAiOjE3ODI1MjQwNDZ9.qjTthfXjGj5nN7OsQgAEDgvXDZ1e9VMB8FDFCMMeYPc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
