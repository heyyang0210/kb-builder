Created by 胡晓畔, last modified on 八月 02, 2024



-   [1. 概述](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-1.概述)  
-   [2. 需求分析](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.需求分析)  
    -   [2.1 功能点分析](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.1功能点分析)  
        -   [2.1.1 FIND_IN_SET()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.1.1FIND_IN_SET())  
        -   [2.1.2 LOAD_FILE()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.1.2LOAD_FILE())  
        -   [2.1.3 CONVERT()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.1.3CONVERT())  
        -   [2.1.4 ROW_COUNT()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.1.4ROW_COUNT())  
        -   [2.1.5 JSON_EXTRACT()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.1.5JSON_EXTRACT())  
    -   [2.2 应用场景](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.2应用场景)  
    -   [2.3 规格约束](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-2.3规格约束)  
-   [3. 详细测试设计](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-3.2详细测试设计)  
        -   [3.2.1 功能测试分析](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-3.2.1功能测试分析)  
            -   [find_in_set()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-find_in_set())  
            -   [load_file()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-load_file())  
            -   [convert()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-convert())  
            -   [row_count()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-row_count())  
            -   [json_extract()](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-json_extract())  
        -   [3.2.2 专项测试](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-3.2.2专项测试)  
-   [4. 测试用例](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-4.测试用例)  
-   [5. 测试框架设计](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-6.测试环境说明)  
-   [7. 工作量评估](#YDBRD26306支持FIND_IN_SET等函数详细测试设计-7.工作量评估)  




# 1. 概述

崖山DB在兼容模式下，适配mysql的以下5个函数：

- FIND_IN_SET()
- LOAD_FILE()
- CONVERT()
- ROW_COUNT()
- JS  功能：在 JSON 文档提取路径表达式指定的数据并返回。  ON_EXTRACT()


# 2. 需求分析

## 2.1 功能点分析

### 2.1.1   FIND_IN_SET()

功能：返回字符串在一个逗号分隔的字符串列表中的索引

语法：FIND_IN_SET(string, string_list)，string_list是一个使用逗号分隔的字符串列表

若有  任一参数为null,返回null；  string_list中找不到string或者string_list 为空字符串，返回0；  string_list 中找到 string，函数将返回对应的位置索引。

### 2.1.2   LOAD_FILE  ()

功能：读取文件并以字符串形式返回文件内容。

函数入参为string形式的文件路径+文件名，要使用此功能，文件必须位于服务器主机上，必须指定文件的完整路径名，并且必须具有FILE特权。 该文件必须全部可读，并且其大小小于max_allowed_packet字节。

~~如果由于不满足上述条件之一而导致文件不存在或无法读取，则该函数返回NULL ~~  **此处与MYSQL有差异，崖山返回报错信息或者空，根据已实现的**  **secure_file_priv参数校验规则。**

### 2.1.3   CONVERT  ()

功能：将任意类型的参数值转为指定的类型或者字符集。

函数两种用法：CONVERT(expr, data_type) 或 CONVERT(expr USING charset)

目标数据类型当前实现为以下类型：     **data_type不与MySQL对齐，范围同cast**

- ~~BINARY[(N)]: 如果参数为空（0 长度），结果是 BINARY(0)，否则结果是 VARBINARY 类型的字符串。~~
- ~~CHAR[(N)]: 结果是 VARCHAR 类型的字符串。除非参数为空，结果是 CHAR(0)。~~
- ~~DATE: 结果是 DATE 类型的。~~
- ~~DATETIME[(M)]: 结果是 DATETIME 类型的，M 是小数秒的位数。~~
- ~~DECIMAL[(M[,D])]: 结果是 DECIMAL 类型的。~~
- ~~JSON: 结果是 JSON 类型的。~~
- ~~NCHAR[(N)]: 结果是 NCHAR 类型的。~~
- ~~SIGNED [INTEGER]: 结果是一个有符号的 BIGINT 类型。~~
- ~~TIME[(M)]: 结果是 TIME 类型的，M 是小数秒的位数。~~
- ~~UNSIGNED [INTEGER]: 结果是一个无符号的 BIGINT 类型。–还不支持映射到yashan~~


  


### 2.1.4   ROW_COUNT  ()

功能：返回上一个 SQL 语句执行的受影响的行数。

函数不需要任何参数

- 如果上一个语句是 DDL 语句，ROW_COUNT() 函数将返回 0。比如 CREATE TABLE, DROP TABLE 等。
- 如果上一个语句是 UPDATE, INSERT, DELETE,  ~~ ALTER TABLE ，~~  create table as select  或者  LOAD DATA 语句，ROW_COUNT() 函数将返回受影响的行数。  ~~**[alter 在崖山当前实现，函数返回0 ]**~~
- 如果上一个语句是一个返回结果集的 SELECT 语句，ROW_COUNT() 函数将返回 -1。
- 如果上一个语句不是一个返回结果集的 SELECT 语句，ROW_COUNT() 函数将返回受影响的行数。比如： SELECT * FROM t1 INTO OUTFILE 'file_name'[yashan暂不支持]。
- 报错的SQL语句不改变ROW_COUNT() 返回值


-- 划线部分是否需要适配还待确认

  


### 2.1.5   JSON_EXTRACT  ()

功能：在 JSON 文档提取路径表达式指定的数据并返回。

如果路径表达式匹配了一个值，则返回该值，如果路径表达式匹配了多个值，则返回一个包含了所有值的数组。

语法：JSON_EXTRACT(json, path, [path]...)

如果 JSON 文档中不存在指定的路径，或任意一个参数为 NULL，函数返回null；

  


## 2.2 应用场景

除find_in_set外，其他函数用于MySQL生态兼容业务 

## 2.3 规格约束

1. convert 函数支持的字符集，以当前崖山兼容的字符集为准：

2. convert函数中   data_type不与MySQL对齐，范围同cast    ，详见     [CAST | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CAST.html)  

3. row_count 中  **alter table ，load data，create table  as select，select for update  不支持，崖山返回 -1**

**UPDATE 不适配CLIENT_FOUND_ROWS标志，返回where条件匹配的行数，而不是受影响的记录数**

INSERT ... ON DUPLICATE KEY UPDATE  ** 返回受影响的行数**

  


  


# 3. 详细测试设计

## 3.1 测试设计方法

从函数语法和功能出发，覆盖语法路径，结合等价类，边界值，场景法 ，错误猜测法等，输出测试点

## 3.2 详细测试设计

### 3.2.1 功能测试分析

#### find_in_set()

|测试场景|测试点|  
|预期|备注|  
|
|---|---|---|---|---|---|
|函数功能 |当前函数已经支持，复用用例改为在兼容模式下测试|  
|  
|现有用例包含加固部分用例，功能覆盖完全 ,--表达式形式|  
|
|补充场景|与当前SR函数交互测试|loadfile    
  convert    
  rowcount    
  jsonExtract|  
|  
|  
|
|  
|补充类型Boolean，raw|  
|  
|**适配，同mysql表现**,**07.24更新 不支持raw**|  
|
|  
|补充与其他MySQL兼容函数的组合 |  
|  
|  
|  
|
|  
|配置空串参数EMPTY_STRING_AS_NULL=FALSE|入参为空串|  
|  
|  
|
|  
|  
|函数结果为空串|  
|  
|  
|
|函数性能|考虑测试性能|  
|  
|  
|  
|


#### load_file()

|测试场景|测试点|  
|预期|备注|  
|
|---|---|---|---|---|---|
|函数语法  |参数测试|无参 ，多参|预期报错|  
|  
|
|  
|  
|空串，null|预期成功，返回null|  
|  
|
|  
|  
|数值类型，字符类型 ,无效的文件路径|预期成功，返回null|  
|  
|
|  
|  
|column 格式   ,  table.column 格式|预期报错|MySQL报错Unknown column xxx  ， Unknown table xxx ，此处是否对齐？-- 不对齐,![](https://conf.yasdb.com/download/attachments/159422597/image2024-7-8_19-48-11.png?version=1&modificationDate=1720439292000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTUsImV4cCI6MTc4MjM4MjY5NX0.ljTCccNDq7u7kHjPqhMytodXvKyxXhnDeI33-ko3-iQ)|  
|
|  
|  
|表达式形式|  
|  
|  
|
|  
|兼容模式|MySQL兼容模式下使用函数|执行成功|  
|  
|
|  
|  
|非兼容模式下使用函数|预期报错|  
|  
|
|函数功能|文件路径有效性|文件路径不在服务器上|返回null --报错|  
|  
|
|  
|  
|文件路径不完整|返回null|  
|  
|
|  
|  
|文件路径为相对路径|返回null--报错|  
|  
|
|  
|  
|文件路径完整正确且在服务器上|执行成功|  
|  
|
|  
|文件的权限|文件没有可读权限|返回null|  
|  
|
|  
|  
|文件只有部分可读权限|返回null|  
|  
|
|  
|  
|文件全部可读|执行成功|  
|  
|
|  
|用户权限|用户没有file 权限|返回null|  
|  
|
|  
|  
|用户拥有file 权限|执行成功|  
|  
|
|  
|  
|用户拥有file 权限后回收|返回null|  
|  
|
|  
|文件大小|超过   max_allowed_packet字节 |返回null|07.22开发反馈当前参数只是语法兼容，实际并未生效，待确认崖山规格|  
|
|  
|  
|不超过  max_allowed_packet字节 |执行成功|  
|  
|
|  
|控制参数   secure_file_priv|当参数设置为禁用功能,即使以上条件都满足也返回null|返回null|MySQL控制参数  secure_file_priv，崖山同样,  
|  
|
|  
|  
|当参数设置为固定目录，文件不符合目录设置|返回null|  
|  
|
|  
|  
|当参数设置为固定目录，文件符合目录设置|执行成功|  
|  
|
|  
|  
|当参数设置不指定目录，其他条件满足即可|执行成功|  
|  
|
|  
|控制参数，路径，文件权限，用户权限，文件大小,组合测试|符合控制参数设置时，全部条件不满足|返回null|  
|  
|
|  
|  
|符合控制参数设置时，部分条件满足|返回null|  
|  
|
|  
|  
|符合控制参数设置时，全部条件满足|执行成功|  
|  
|
|  
|跨服务|本地文件的服务器连接另一台机器的DB,  
|预期报错|  
|  
|
|  
|返回值类型|  
|  
|  
|  
|
|函数应用|DML|函数返回值 insert|执行成功|  
|  
|
|  
|  
|函数返回值update set值，where条件|执行成功|  
|  
|
|  
|  
|函数返回值 delete|执行成功|  
|  
|
|  
|嵌套其他内置函数|函数返回值作为其他函数入参|执行成功|  
|  
|
|  
|  
|其他函数作为当前函数入参|执行成功|  
|  
|
|  
|  
|覆盖字符函数，窗口函数等各类函数|  
|  
|  
|
|  
|  
|与当前SR函数交互测试find_in_set/loadfile/ convert/ rowcount/ jsonExtract|  
|  
|  
|
|  
|应用位置|子查询|执行成功|  
|  
|
|  
|  
|filter|执行成功|  
|  
|
|  
|  
|group by,order by  ,limit ...|执行成功|  
|  
|
|  
|  
|create view as|执行成功|  
|  
|
|  
|  
|insert into select |执行成功|  
|  
|
|  
|  
|default值|预期报错|  
|  
|
|配置空串参数EMPTY_STRING_AS_NULL=FALSE|函数功能测试|  
|预期功能不受影响|  
|  
|
|字符集|测试字符集不同的表现|Linux 端 ：   zh_CN.GB2312[文件内容的字符集],客户端  ：GBK,DB端  ：utf8mb4|  
|确定字符集场景|  
|
|  
|  
|函数入参[文件路径本身]的字符集,  
|  
|  
|  
|
|函数性能|大文件查询性能|性能对标mysql5.7|  
|有数据之后分析|  
|


#### convert()

|测试场景|测试点|  
|预期|备注|  
|
|---|---|---|---|---|---|
| 函数语法|参数测试|无参 ，多参，少参|预期报错|  
|  
|
|  
|  
|语法正确|预期成功|  
|  
|
|  
|  
|语法错误|预期报错|  
|  
|
|  
|  
|表达式形式入参|预期成功|  
|  
|
|  
|  
|column形式入参|预期成功|  
|  
|
|  
|兼容模式|MySQL兼容模式下使用函数|执行成功|  
|  
|
|  
|  
|非兼容模式下使用函数|预期报错|  
|  
|
|函数功能|数据类型|支持准换的数据类型,expr类型： 【覆盖全量 】,  
|执行成功|expr是否支持全量类型,|  
|
|  
|  
|目标数据类型覆盖：,同cast的  type_name     [CAST | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CAST.html)  |预期成功|  
|  
|
|  
|字符集|支持的字符集：当前已适配的字符集,ascii    
  gbk    
  utf8mb4    
  latin1    
  utf16     
  gb18030|预期成功|  
|  
|
|  
|  
|convert 嵌套时使用不同的字符集,比如：,CONVERT(CONVERT('test中' using gbk) using utf8)|  
|CONVERT('test中' using gbk)内层的结果已经不带gbk 字符集，返回结果以当前DB的字符集为准，所以可能会有乱码[比如utf8不识别的gbk字符]|  
|
|  
|  
|其他暂不支持字符集：,少量覆盖,  
|预期报错|  
|  
|
|  
|返回值类型|  
|  
|  
|  
|
|函数应用|DML|函数返回值 insert|执行成功|  
|  
|
|  
|  
|函数返回值update set值，where条件|执行成功|  
|  
|
|  
|  
|函数返回值 delete|执行成功|  
|  
|
|  
|嵌套其他内置函数|函数返回值作为其他函数入参|执行成功|  
|  
|
|  
|  
|其他函数作为当前函数入参|执行成功|  
|  
|
|  
|  
|覆盖字符函数，窗口函数等各类函数|  
|  
|  
|
|  
|  
|与当前SR函数交互测试find_in_set/loadfile/ convert/ rowcount/ jsonExtract|  
|  
|  
|
|配置空串参数EMPTY_STRING_AS_NULL=FALSE|函数功能测试|  
|预期功能不受影响|  
|  
|
|字符集|字符集不匹配|客户端字符集 utf8,服务端字符集 gb18030|字符集不匹配读出乱码|  
|  
|
|性能|不涉及|  
|  
|  
|  
|


#### row_count()

|测试场景|测试点|  
|预期|备注|  
|
|---|---|---|---|---|---|
|函数语法|参数测试|有参，多参|预期报错|  
|√|
|  
|  
|去掉括号|预期报错？|MySQL报错|√|
|  
|返回值|返回值类型|  
|MySQL bigint|√|
|  
|  
|类型最大值|  
|可以不必关注|√|
|  
|兼容模式|MySQL兼容模式下使用函数|执行成功|  
|√|
|  
|  
|非兼容模式下使用函数|预期报错|  
|√|
|函数功能|select|select 常量|返回-1|  
|√|
|  
|  
|表列|返回-1|  
|√|
|  
|  
|函数|返回-1|  
|√|
|  
|  
|explain计划|返回-1|  
|√|
|  
|  
|select +     `INTO`         `OUTFILE`  |~~返回受影响的行数~~|崖山不支持返回-1|√|
|  
|  
|**select for update**|返回-1|  
|√|
|  
|DDL|create 表，视图，用户|返回0|  
|√|
|  
|  
|drop |返回0|  
|√|
|  
|  
|truncate|返回0|  
|√|
|  
|  
|commit|返回0|  
|√|
|  
|  
|grant ,revoke|返回0|  
|√|
|  
|  
|alter 表名|返回0|  
|  
|
|  
|  
|alter 表列名|返回0|  
|  
|
|  
|  
|alter 新增列|返回0|  
|  
|
|  
|  
|alter 修改列类型|~~返回受影响的行数~~|**此处与mysql存在差异，返回 0**|  
|
|  
|  
|其他alter操作适量覆盖|返回0|  
|  
|
|  
|  
|load data |返回受影响的行数|  
|  
|
|  
|  
|**create table  as select**,**create view as select**|返回受影响的行数|  
|  
|
|  
|  
|报错的DDL语句之后查询|返回-1|  
|  
|
|  
|DML|update|  
|**返回where条件匹配的行数，而不是受影响的记录数，与MySQL保持差异**|  
|
|  
|  
|insert|返回受影响的行数|  
|  
|
|  
|  
|delete|返回受影响的行数|  
|  
|
|  
|  
|**INSERT ... ON DUPLICATE KEY UPDATE**|  
|**返回where条件匹配的行数**|  
|
|  
|  
|merge into|返回受影响的行数|  
|  
|
|  
|返回值类型|  
|  
|  
|  
|
|函数应用|DML|函数返回值 insert|执行成功|  
|  
|
|  
|  
|函数返回值update set值，where条件|执行成功|  
|  
|
|  
|  
|函数返回值 delete|执行成功|  
|  
|
|  
|嵌套其他内置函数|函数返回值作为其他函数入参|执行成功|  
|  
|
|  
|  
|覆盖字符函数，窗口函数等各类函数|  
|  
|  
|
|  
|  
|与当前SR函数交互测试find_in_set/loadfile/ convert/ rowcount/ jsonExtract|  
|  
|  
|
|  
|应用位置|子查询|执行成功|  
|  
|
|  
|  
|filter|执行成功|  
|  
|
|  
|  
|group by,order by  ,limit ...|执行成功|  
|  
|
|  
|  
|create view as|执行成功|  
|  
|
|  
|  
|insert into select |执行成功|  
|  
|
|  
|  
|default值|预期报错|调研确认一下|  
|
|配置空串参数EMPTY_STRING_AS_NULL=FALSE|函数功能测试|  
|预期功能不受影响|  
|  
|
|性能|不涉及|  
|  
|  
|  
|


#### json_extract()

|测试场景|测试点|  
|预期|备注|  
|
|---|---|---|---|---|---|
|函数语法|参数测试|少参，无参|预期报错|  
|  
|
|  
|  
|‘’ |预期报错|  
|  
|
|  
|  
|null|返回null|  
|  
|
|  
|  
|非法JSON字符串|预期报错|  
|  
|
|  
|  
|JSON字符串长度覆盖32K|预期成功|  
|  
|
|  
|  
|JSON字符串长度覆盖超过32K|预期报错|  
|  
|
|  
|路径参数|单个合法路径表达式|预期成功|  
|  
|
|  
|  
|单个非法路径表达式|预期报错|  
|  
|
|  
|  
|合法路径表达式+非法路径表达式|预期报错|  
|  
|
|  
|  
|合法路径表达式，在范围内|预期成功|  
|  
|
|  
|  
|合法路径表达式，超出范围|预期报错|  
|  
|
|  
|  
|路径参数只取对象,格式“  $.  ”|预期成功|  
|  
|
|  
|  
|路径参数只取位置,格式“  $[]  ”|预期成功|  
|  
|
|  
|  
|路径参数取 对象和位置|预期成功|  
|  
|
|  
|兼容模式|MySQL兼容模式下使用函数|执行成功|  
|  
|
|  
|  
|非兼容模式下使用函数|预期报错|  
|  
|
|函数功能|JSON文本|符合JSON格式|预期成功|  
|  
|
|  
|  
|不符合JSON格式|预期报错|  
|  
|
|  
|  
|column作为JSON文本,--覆盖字符类型，可转字符类型 LOB，xmltype |预期成功|覆盖nchar  nvarchar|  
|
|  
|  
|使用JSON函数转换|预期成功|  
|  
|
|  
|  
|不使用JSON函数转换|预期成功|  
|  
|
|  
|  
|覆盖最大32k|  
|  
|  
|
|  
|  
|表达式形式|  
|  
|  
|
|  
|路径参数|column作为路径参数|预期报错|  
|  
|
|  
|  
|覆盖多路径参数最大支持个数 --65534|执行成功|  
|  
|
|  
|返回值类型|varchar|  
|mysql 返回类型为json ？|  
|
|函数应用|DML|函数返回值 insert|执行成功|  
|  
|
|  
|  
|函数返回值update set值，where条件|执行成功|  
|  
|
|  
|  
|函数返回值 delete|执行成功|  
|  
|
|  
|嵌套其他内置函数|函数返回值作为其他函数入参|执行成功|  
|  
|
|  
|  
|其他函数作为当前函数入参|执行成功|  
|  
|
|  
|  
|覆盖字符函数，窗口函数等各类函数|  
|  
|  
|
|  
|  
|嵌套已经支持的JSON函数|  
|  
|  
|
|  
|  
|与当前SR函数交互测试find_in_set/loadfile/ convert/ rowcount/ jsonExtract|  
|  
|  
|
|  
|应用位置|子查询|执行成功|  
|  
|
|  
|  
|filter|执行成功|  
|  
|
|  
|  
|group by,order by  ,limit ...|执行成功|  
|  
|
|  
|  
|create view as|执行成功|  
|  
|
|  
|  
|insert into select |执行成功|  
|  
|
|  
|  
|default值|预期报错？|  
|  
|
|配置空串参数EMPTY_STRING_AS_NULL=FALSE|函数功能测试|  
|预期功能不受影响|  
|  
|
|函数性能|查询性能|考虑验证性能|  
|  
|  
|


  


### 3.2.2 专项测试

|系统级DFX分类|是否涉及|
|---|---|
|CT|√|
|KT|√|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|√|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

Guider + yasft 

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  
