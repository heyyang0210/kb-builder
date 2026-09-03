Created by 林永豪, last modified on 七月 23, 2024

*IR链接：*    [YASHAN-929](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f1? #YASHAN-929  【mysql兼容】（功能&语法）支持SCHEMA、双@@参数变量等的特定特性)  

*SR链接：*    [YDBRD-26286](https://pingcode.yasdb.com/pjm/items/661916eefd997db58ad89729? #YDBRD-26286 支持MySQL变量类型)  



-   [1. 总述](#1-总述)  
    -   [1.1 需求来源](#11-需求来源)  
    -   [1.2 调研文档](#12-调研文档)  
    -   [1.3 需求分析](#13-需求分析)  
    -   [1.4 数据字典](#14-数据字典)  
    -   [1.5 开源依赖](#15-开源依赖)  
-   [2. 接口](#2-接口)  
-   [3. 规格与约束](#3-规格与约束)  
-   [4. 特性](#4-特性)  
    -   [4.1 特性设计](#41-特性设计)  
    -   [4.2 特性功能点1：变量类型框架设计](#42-特性功能点1变量类型框架设计)  
    -   [4.3 特性功能点2：变量类型总体处理流程](#43-特性功能点2变量类型总体处理流程)  
    -   [4.4 特性功能点3：变量类型语法](#44-特性功能点3变量类型语法)  
    -   [4.4 特性功能点4：系统变量类型支持表格](#44-特性功能点4系统变量类型支持表格)  
    -   [4.5 特性功能点5：set语句右值表达式类型](#45-特性功能点5set语句右值表达式类型)  
    -   [4.6 特性功能点6: 设置全局变量时的检查](#46-特性功能点6-设置全局变量时的检查)  
    -   [4.7 特性功能点7：右值对default关键字的支持情况](#47-特性功能点7右值对default关键字的支持情况)  
-   [5. Testcases（自测用例）](#5-testcases自测用例)  
-   [6.资料设计章节](#6资料设计章节)  
-   [7.未来规划](#7未来规划)  
-   [8.references](#8references)  




##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=156116150](https://conf.yasdb.com/pages/viewpage.action?pageId=156116150)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

1. 重点关注支持变量类型的值的设置和查询。功能并不生效，即变量类型的值实际上并不影响数据库。
1. 变量类型可作为表达式，表达式类型是新增的EXPR_COMPAT。
1. 使用cast函数测试时，cast的规格目前与yashan表现对齐，本sr不关注cast的输出情况。
1. sqlmode的赋值。mysql服务端一定要用单引号、双引号或反引号扩起，yashan的mysql兼容性对齐这个表现。
1. 目前mysql兼容性不考虑存储过程的适配情况，不需要考虑存储过程和变量类型的交叉测试。
1. 最大支持创建33824个用户变量。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

###   [4.2 特性功能点1：变量类型框架设计](#42-特性功能点1变量类型框架设计)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ed98970c2af4f521bd8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQWhBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBUUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ0MTksImV4cCI6MTc4MjQ1NTIxOX0.SfgpNOSfTl2vPbStv6wvfJ2xpqHZDnCV1PppRJ9n-0A)

1.全局系统变量的生命周期是整个数据库执行的生命周期，在满足条件的情况下，各会话可以查询全局系统变量，也可以更改全局系统变量的值。在数据库生命周期结束后，释放所有全局系统变量。

2.会话系统变量的生命周期：

- 兼容性的设计分两种情况：
    - 第一种情况是执行select语句时，校验阶段会生成一份当前会话系统变量加到objArray中并赋当前对应的全局系统变量的值作为默认值；
    - 第二种情况是执行set语句时，校验阶段会生成一份当前会话系统变量加到objArray中并赋当前对应的全局系统变量的值作为默认值，执行阶段再改为右值。
- 在会话结束后，释放所有会话系统变量。


3.用户变量的生命周期，兼容性的设计上，和会话系统变量的生命周期一致，生成逻辑也一致。

###   [4.3 特性功能点2：变量类型总体处理流程](#43-特性功能点2变量类型总体处理流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ed9a1ad9a3311dc9a4b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUJBQWhBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBUUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ0MTksImV4cCI6MTc4MjQ1NTIxOX0.SfgpNOSfTl2vPbStv6wvfJ2xpqHZDnCV1PppRJ9n-0A)

###   [4.4 特性功能点3：变量类型语法](#44-特性功能点3变量类型语法)  

- 实现上支持":="符号，并且等价于"="符号


|          变量类型,      \,语句类型|全局系统变量|会话系统变量|用户变量|
|---|---|---|---|
|set语句|1. set global 系统变量名 = 右值
1. set @@global.系统变量名 = 右值
|1. set session 系统变量名 = 右值
1. set @@session.系统变量名 = 右值
1. set @@系统变量名 = 右值
1. set   系统变量名 = 右值
1. set local 系统变量名 = 右值
1. set @@local.系统变量名 = 右值
|1. set   @用户变量名 =   右值
|
|select语句|1. select   @@global.系统变量名
|1. select @@session.系统变量名
1. select @@系统变量名
|1. select   @用户变量名
|


###   [4.4 特性功能点4：系统变量类型支持表格](#44-特性功能点4系统变量类型支持表格)  

|序号|系统变量类型|mysql服务端默认值|该SR要支持的默认值|是否为只读的系统变量（只读的不能通过set global和set session来修改）|是否全局和会话层面都能设置|只做语法兼容还是支持实际功能|变量数据类型|变量数据范围|支持设置的右值数据类型|调研例子|
|---|---|---|---|---|---|---|---|---|---|---|
|1|auto_increment_increment |1|1|否|是|语法兼容|~~DTYPE_SMALLINT~~,DTYPE_INTEGER|1~65535|整数类型|mysql服务端：,mysql> set session auto_increment_increment='fdfd';    
  ERROR 1232 (42000): Incorrect argument type to variable 'auto_increment_increment',  
,兼容性：,mysql> set session auto_increment_increment='fdfd';    
  Query OK, 0 rows affected (0.00 sec)|
|2|autocommit|1|1|否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_TINYINT|0/1、true/false、ON/OFF|~~整数类型~~,整数类型、字符串类型|1.其它值报错Variable 'autocommit' can't be set to the value of 'xxx'|
|3|character_set_client |utf8mb4|utf8mb4|否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,~~UTF16()~~  （客户端不能设置utf16字符集，对齐mysql）/,UTF8（set后再select的结果对齐mysql，其他字符集变量类型同理）/,UTF8MB3（set后再select的结果对齐mysql，其他字符集变量类型同理）/,UTF8MB4（set后再select的结果对齐mysql，其他字符集变量类型同理|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|4|character_set_connection |utf8mb4|utf8mb4|否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|5|character_set_results |utf8mb4|utf8mb4|否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|6|character_set_server |utf8mb4|utf8mb4|否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|7|collation_server |utf8mb4_general_ci|utf8mb4_general_ci|否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符序文本串,ascii_bin/ascii_general_ci/gbk_bin/gbk_chinese_ci/,latin1_bin/latin1_general_ci/utf8mb4_bin/utf8mb4_general_ci/,utf8mb3_bin/utf8mb3_general_ci/utf8_bin/utf8_general_ci/,utf16_bin/utf16_general_ci/gb18030_bin/gb18030_chinese_ci|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|8|collation_connection |utf8mb4_general_ci|utf8mb4_general_ci|否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符序文本串,ascii_bin/ascii_general_ci/gbk_bin/gbk_chinese_ci/,latin1_bin/latin1_general_ci/utf8mb4_bin/utf8mb4_general_ci/,utf8mb3_bin/utf8mb3_general_ci/utf8_bin/utf8_general_ci/,utf16_bin/utf16_general_ci/gb18030_bin/gb18030_chinese_ci|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|9|character_set_database|utf8mb4|utf8mb4|否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|10|collation_database|utf8mb4_general_ci|utf8mb4_general_ci|否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符序文本串,ascii_bin/ascii_general_ci/gbk_bin/gbk_chinese_ci/,latin1_bin/latin1_general_ci/utf8mb4_bin/utf8mb4_general_ci/,utf8mb3_bin/utf8mb3_general_ci/utf8_bin/utf8_general_ci/,utf16_bin/utf16_general_ci/gb18030_bin/gb18030_chinese_ci|本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|11|datadir|取决于部署路径，不同环境路径不同|YASDB_DATA|是|否，只读|语法兼容|DTYPE_VARCHAR|定值YASDB_DATA|只读|只读|
|12|init_connect |不显示|不显示|否|否，仅全局才能设置,设置会话时,ERROR 1229 (HY000): Variable 'init_connect' is a GLOBAL variable and should be set with SET GLOBAL|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|init_connect < min(32000, 会话系统变量max_allowed_packet)|本sr定为能向字符型进行转换的类型|  
|
|13|interactive_timeout |28800|28800|否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|1~31536000|整数类型|  
|
|14|license |GPL|COMMERCIAL|是,ERROR 1238 (HY000): Variable 'license' is a read only variable|否，只读，不在讨论范围|语法兼容|DTYPE_VARCHAR|定值COMMERCIAL|只读|只读|
|15|lower_case_table_names |0|0|是|否，只读，不在讨论范围|语法兼容|DTYPE_VARCHAR|定值0|只读|只读|
|16|max_allowed_packet |4194304|4194304|否|否，仅全局才能设置，SESSION variable 'max_allowed_packet' is read-only. Use SET GLOBAL to assign the value|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|  `2的n次方，n取正整数，n最小值为10，最大值为30`  |整数类型|  
|
|17|net_write_timeout |60|60|否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|1~31536000|整数类型|  
|
|18|performance_schema |1|1|是|否，只读|语法兼容|DTYPE_INTEGER|1|只读|只读|
|19|sql_mode |ONLY_FULL_GROUP_BY,,STRICT_TRANS_TABLES,,NO_ZERO_IN_DATE,,NO_ZERO_DATE,,ERROR_FOR_DIVISION_BY_ZERO,,NO_AUTO_CREATE_USER,,NO_ENGINE_SUBSTITUTION，,  
|ERROR_FOR_DIVISION_BY_ZERO,,IGNORE_SPACE,,NO_AUTO_CREATE_USER,,NO_AUTO_VALUE_ON_ZERO,,NO_BACKSLASH_ESCAPES,,NO_ENGINE_SUBSTITUTION,,NO_UNSIGNED_SUBTRACTION,,NO_ZERO_DATE,,NO_ZERO_IN_DATE,,ONLY_FULL_GROUP_BY,,PAD_CHAR_TO_FULL_LENGTH,,STRICT_ALL_TABLES,,STRICT_TRANS_TABLES,,TIME_TRUNCATE_FRACTIONAL|否|是|部分支持实际功能：,ANSI_QUOTES，,REAL_AS_FLOAT,,PIPES_AS_CONCAT,  
,以下语法兼容：,ALLOW_INVALID_DATES，,ERROR_FOR_DIVISION_BY_ZERO，,HIGH_NOT_PRECEDENCE，,IGNORE_SPACE，,NO_AUTO_CREATE_USER，,NO_AUTO_VALUE_ON_ZERO，,NO_BACKSLASH_ESCAPES，,NO_DIR_IN_CREATE，,NO_ENGINE_SUBSTITUTION，,NO_UNSIGNED_SUBTRACTION，,NO_ZERO_DATE，,NO_ZERO_IN_DATE，,ONLY_FULL_GROUP_BY，,PAD_CHAR_TO_FULL_LENGTH，,STRICT_ALL_TABLES，,STRICT_TRANS_TABLES，,TIME_TRUNCATE_FRACTIONAL|DTYPE_VARCHAR|输入正确的sql_mode字符串，目前只支持识别：,ANSI_QUOTES，,REAL_AS_FLOAT,,PIPES_AS_CONCAT，,  
,ALLOW_INVALID_DATES，,ERROR_FOR_DIVISION_BY_ZERO，,HIGH_NOT_PRECEDENCE，,IGNORE_SPACE，,NO_AUTO_CREATE_USER，,NO_AUTO_VALUE_ON_ZERO，,NO_BACKSLASH_ESCAPES，,NO_DIR_IN_CREATE，,NO_ENGINE_SUBSTITUTION，,NO_UNSIGNED_SUBTRACTION，,NO_ZERO_DATE，,NO_ZERO_IN_DATE，,ONLY_FULL_GROUP_BY，,PAD_CHAR_TO_FULL_LENGTH，,STRICT_ALL_TABLES，,STRICT_TRANS_TABLES，,TIME_TRUNCATE_FRACTIONAL|本sr定为能向字符型进行转换的类型|1.如果set sqlmode的时候，用数字来设置，则表现奇怪，不建议。,mysql> set session sql_mode=cast('22' as unsigned);    
  Query OK, 0 rows affected, 1 warning (0.00 sec),mysql> select @@sql_mode;    
  +-------------------------------+    
  | @@sql_mode |    
  +-------------------------------+    
  | PIPES_AS_CONCAT,ANSI_QUOTES,, |    
  +-------------------------------+    
  1 row in set (0.00 sec),mysql> set session sql_mode=cast('23' as unsigned);    
  Query OK, 0 rows affected (0.00 sec),mysql> select @@sql_mode;    
  +---------------------------------------------+    
  | @@sql_mode |    
  +---------------------------------------------+    
  | REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,, |    
  +---------------------------------------------+    
  1 row in set (0.01 sec)|
|20|system_time_zone |CST|CST|是|否，只读|语法兼容|DTYPE_VARCHAR|定值CST|只读|只读|
|21|time_zone |SYSTEM|SYSTEM|否|是|语法兼容|DTYPE_VARCHAR|SYSTEM,"-12:59" ~ "+13:00",  [https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_time_zone](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_time_zone)  |本sr定为能向字符型进行转换的类型|还会检查timezone的合法性。,mysql> set session time_zone=cast('23' as unsigned);    
  ERROR 1232 (42000): Incorrect argument type to variable 'time_zone'    
  mysql> set session time_zone='dsds';    
  ERROR 1298 (HY000): Unknown or incorrect time zone: 'dsds'|
|22|transaction_isolation |REPEATABLE-READ|REPEATABLE-READ|否|是|语法兼容|DTYPE_VARCHAR|  `READ-UNCOMMITTED`  ,  `READ-COMMITTED`  ,  `REPEATABLE-READ`  ,  `SERIALIZABLE`  |本sr定为能向字符型进行转换的类型|  
|
|23|wait_timeout |28800|28800|否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|1~31536000|整数类型|  
|
|24|transaction_read_only|0|0|否|是|语法兼容|DTYPE_TINYINT|0/1、true/false、ON/OFF|整数类型/字符型|1.其它值报错Variable 'autocommit' can't be set to the value of 'xxx'|
|25|version_comment |MySQL Community Server (GPL)|会根据当前安装包的版本来输出，安装包版本会持续刷新|是|否，只读|语法兼容|DTYPE_VARCHAR|会根据当前安装包的版本来输出|只读|只读|
|26|version|取决于安装版本号，例如5.7.44|目前是Yashan Compatibility 1.0.0.0|是|否，只读|语法兼容|DTYPE_VARCHAR|定值|只读|只读|


###   [4.5 特性功能点5：set语句右值表达式类型](#45-特性功能点5set语句右值表达式类型)  

1.右值不支持EXPR_QUERY（一条完整的select语句），其它类型不做特殊拦截处理。

2.参考表达式类型分类：    [表达式分类](https://conf.yasdb.com/pages/viewpage.action?pageId=141570048)  

###   [4.6 特性功能点6: 设置全局变量时的检查](#46-特性功能点6-设置全局变量时的检查)  

1.mysql服务端，只读的系统变量（包括全局系统变量和会话系统变量）不能被set语句来修改。

2.mysql服务端设置全局系统变量需要super权限。为了对齐此表现，mysql兼容性实现上。

3.在设置全局系统变量时，先检查是否只读，只读则报错该变量只读不可设置；然后再检查当前执行用户是否有dba权限，没有则报错权限不充分。

4.在设置会话系统变量时，先检查是否只读，只读则报错该变量只读不可设置

###   [4.7 特性功能点7：右值对default关键字的支持情况](#47-特性功能点7右值对default关键字的支持情况)  

|变量类型|对default表达式的支持情况|
|---|---|
|全局系统变量|支持，如：set @@global.auto_increment_increment =default，设置后会将全局变量的值设置成默认值|
|会话系统变量|支持，如： set @@session.auto_increment_increment =default，设置后会将会话变量的值设置成当前对应全局系统变量的值|
|用户变量|不支持|


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1.同时开启多个会话，关注全局变量和各会话的会话变量，设置和查询这两方面的独立性和正确性。

2.注意以下场景：

```
set define off
set serveroutput on
alter session set compat_vector=mysql;
begin
execute immediate 'set @@global.character_set_client = 'latiN1'';
end;
/
会报错：
YAS-04253 PL/SQL compiling errors:
[2:57] YAS-04209 unexpected word latiN1

这是存储过程doCompileExecuteLn逻辑设计导致，mysql兼容性不做额外处理

解决方法是，用mysql客户端连接yasdb服务端进行测试

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql&gt; set @@global.character_set_client = 'latiN1';
Query OK, 0 rows affected (0.00 sec)


```

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

1.show variables的支持

##   [8.references](#8references)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=156129767](https://conf.yasdb.com/pages/viewpage.action?pageId=156129767)  

  


## Attachments:

## Comments:

|  [](null)  ,1. mySetVarFlag为何设置CTX_FLAG_PTT
1. gMyGlobalVarCtx.array是否可以直接用gMySysVar数组，还是需要循环初始化
,Posted by linyonghao at 六月 13, 2024 16:33|
|---|
|  [](null)  ,~~最大支持创建55536个用户变量~~,最大支持创建33824个用户变量,Posted by linyonghao at 七月 07, 2024 16:45|
