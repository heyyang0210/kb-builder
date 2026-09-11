Created by 陈钦卿, last modified on 十一月 07, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/670a5885e489dd0868f66755](https://pingcode.yasdb.com/pjm/items/670a5885e489dd0868f66755)    ?#YDBRD-33989 【mysql兼容】支持字符集相关系统函数

开发设计：    [详细设计文档-- YDBRD-33989: 支持字符集相关系统函数 - 王林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171081317)  

交付形态：单机

# 2. 需求分析

## 2.1 功能点分析

（1）CHARSET()     函数返回指定字符串的字符集

参数：  *str -- *  必需的。 一个字符串。

如果参数为     NULL  ，     CHARSET()     函数将返回     binary  。

（2）COLLATION() 函数返回指定的字符串的排序规则

参数：  *str -- *  必需的。 一个字符串。

如果参数为     NULL  ，     COLLATION()     函数将返回     binary  。

## 2.2 应用场景

CHARSET    
  COLLATION

## 2.3 规格约束

charset：返回binary或服务端字符集。

collation：返回binary或服务端字符集默认的字符序。

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|测试场景|测试项一|测试项二|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|参数校验|参数|个数|1个|0个、2个|  
|
|  
|  
|类型|常量：,- 字符串常量、‘’、空格、空串 —— 返回服务端字符集字符序
- 数值常量、null —— 返回binary
|  
|  
|
|  
|  
|  
|变量：,- 列名 —— 返回列对应的字符集/字符序（不区分列值是否为null）
- 用户定义变量（set @t1 = 'a';）
- 系统变量(@@global.validate_password_dictionary_file)
|  
|  
|
|  
|  
|  
|数据类型,- tinyint、smallint、mediumint、int、bigint、float、double、decimal、  TINYBLOB、BLOB、MEDIUMBLOB  、  LONGBLOB、  date、time、timestamp、bit、  BINARY、VARBINARY ——   返回binary
- char、varchar、TINYTEXT、TEXT、MEDIUMTEXT、LONGTEXT、nchar、nvarchar
|  
|  
|
|  
|  
|  
|表达式：布尔表达式、运算表达式、null表达式、连接符运算|  
|  
|
|  
|  
|  
|内置函数：数值函数、字符函数、日期函数、转换函数、其他函数、窗口函数、聚集函数、  单独为MySQL模式提供的内置函数,重点关注convert函数：  CHARSET  (  CONVERT  (  'ABC'   USING gbk  ))     CHARSET  (  CONVERT  (  col_blob   USING utf8mb4  ))|  
|convert函数实际不生效|
|  
|  
|长度|select charset(lpad('a',32000,'b'));|  
|  
|
|函数校验|返回值类型|varchar，  最大长度64字节|yashan当前支持7个字符集，都要覆盖,```
SQL> select * from INFORMATION_SCHEMA.COLLATION_CHARACTER_SET_APPLICABILITY;
 
COLLATION_NAME                    CHARACTER_SET_NAME
--------------------------------- ---------------------------------
ascii_bin                         ascii
ascii_general_ci                  ascii
gb18030_bin                       gb18030
gb18030_chinese_ci                gb18030
gbk_bin                           gbk
gbk_chinese_ci                    gbk
latin1_bin                        latin1
latin1_general_ci                 latin1
latin1_swedish_ci                 latin1
utf16_bin                         utf16
utf16_general_ci                  utf16
utf8mb4_bin                       utf8mb4
utf8mb4_general_ci                utf8mb4
binary                            binary
 
14 rows fetched.
```|  
|实际上只支持5个，binary和utf16不支持|
|  
|函数名|- 大小写、拼写错误、名称缺失、带单双引号
- 与表/视图同名
- v$mysql_function新增函数名
|  
|  
|  
|
|  
|自嵌套|127层、128层|  
|  
|  
|
|系统视图|INFORMATION_SCHEMA.SCHEMATA|查看数据库字符集和字符序|崖山无此系统视图,```
mysql> desc INFORMATION_SCHEMA.SCHEMATA;
+----------------------------+------------------+------+-----+---------+-------+
| Field                      | Type             | Null | Key | Default | Extra |
+----------------------------+------------------+------+-----+---------+-------+
| CATALOG_NAME               | varchar(64)      | NO   |     | NULL    |       |
| SCHEMA_NAME                | varchar(64)      | NO   |     | NULL    |       |
| DEFAULT_CHARACTER_SET_NAME | varchar(64)      | NO   |     | NULL    |       |
| DEFAULT_COLLATION_NAME     | varchar(64)      | NO   |     | NULL    |       |
| SQL_PATH                   | varbinary(0)     | YES  |     | NULL    |       |
| DEFAULT_ENCRYPTION         | enum('NO','YES') | NO   |     | NULL    |       |
+----------------------------+------------------+------+-----+---------+-------+
6 rows in set (0.00 sec)
```|  
|  
|
|  
|information_schema.TABLES视图  TABLE_COLLATION字段|查看表字符序|崖山当前字段无效|  
|  
|
|  
|information_schema.COLUMNS视图  CHARACTER_SET_NAME和COLLATION_NAME字段|查看列字符集和字符序|崖山当前字段无效|  
|  
|
|功能校验|参数为常量|~~修改~~  ~~character_set_connection值~~,~~SET NAMES utf8mb4~~,~~set @@global.~~  ~~NAMES~~  ~~ ~~  ~~='utf8mb4'~~|返回值相应改变|  
|修改yasdb服务端字符集|
|  
|  
|~~session级别参数~~|~~其余会话返回值不改变~~|  
|  
|
|  
|参数单列|列指定字符集和字符序|~~返回列指定的字符集和字符序~~|  
|都返回服务端对应字符集    
    
    
    
    
    
    
|
|  
|  
|列指定字符集，未指定字符序|~~返回列指定的字符集，列指定字符集的默认字符序~~|  
||
|  
|  
|列未指定字符集，指定字符序|~~返回列指定字符序对应的字符集，列指定的字符序~~|  
||
|  
|  
|修改列的字符集和字符序,ALTER     TABLE   t1   MODIFY   c1   VARCHAR  (  100  )   CHARACTER     SET   ascii   COLLATE   ascii_general_ci;|~~返回值相应改变~~|  
||
|  
|  
|表指定字符集和字符序|~~返回表指定的字符集和字符序~~|  
||
|  
|  
|表指定字符集，未指定字符序|~~返回表指定的字符集，表指定字符集的默认字符序~~|  
||
|  
|  
|表未指定字符集，指定字符序|~~返回表指定字符序对应的字符集，表指定的字符序~~|  
||
|  
|  
|修改表的字符集和字符序,ALTER     table   t1 CONVERT   to     CHARACTER     set   latin1;    
  ALTER     table   t1   DEFAULT     CHARACTER     set   latin1;|~~返回值相应改变~~|  
||
|  
|  
|数据库指定字符集和字符序|~~返回数据库指定的字符集和字符序~~|  
|  
|
|  
|  
|数据库指定字符集，未指定字符序|~~返回数据库指定的字符集，数据库指定字符集的默认字符序~~|  
|  
|
|  
|  
|数据库未指定字符集，指定字符序|~~返回数据库指定字符序对应的字符集，数据库指定的字符序~~|  
|  
|
|  
|  
|修改数据库的字符集和字符序,alter     database   demo   character     set   utf8   collate   utf8_general_ci;|~~返回值相应改变~~|  
|  
|
|  
|  
|~~若数据库，表，列指定的字符集字符序不同~~|~~优先级：~~  ~~**数据库字符集 < 表字符集 < 列字符集**~~|  
|  
|
|  
|参数为多列拼接（在char，nchar拼接下有意义，但mysql不支持nchar）|col1 VARCHAR(5) CHARACTER SET latin1,col2 VARCHAR(5) CHARACTER SET ascii|  
|  
|mysql支持nchar|
|  
|  
|多列同表|- charset(concat(col1,col2))
- charset(concat(col2,col1))
|  
|  
|
|  
|  
|多列来自不同表|select charset(concat(t1.col1,t2.col1)) from t1,t2|  
|  
|
|  
|表类型|仅heap表|  
|  
|  
|
|  
|  
|分区表简单覆盖|  
|  
|  
|
|  
|  
|临时表|  
|  
|  
|
|  
|  
|dblink远端表|  
|  
|  
|
|  
|from|dual|  
|  
|  
|
|  
|  
|单表、多表|  
|  
|  
|
|  
|  
|view|表现同表|  
|  
|
|函数语法位置|DQL|group by/having /order by/connect by/join on |  
|  
|  
|
|  
|  
|子查询|  
|  
|  
|
|  
|  
|操作符：in/not in、exists/not exists 、between and、like/not like|  
|  
|  
|
|  
|  
|filter |  
|  
|  
|
|  
|  
|CTE|  
|  
|  
|
|  
|DDL|create table as select|  
|  
|  
|
|  
|  
|create view/materialized view as select|  
|  
|  
|
|  
|DML|insert into values/insert into select|  
|  
|  
|
|  
|  
|update|  
|  
|  
|
|  
|  
|delete|  
|  
|  
|
|  
|plsql中使用|  
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
|性能|？|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


  


- yasft


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Comments:

|  [](null)  ,1.非默认和默认的字符序覆盖；,2.数据库设置非utf字符集时候，测试char 组合nchar,Posted by huxiaopan at 十一月 06, 2024 11:33|
|---|
