Created by 邓秋怡, last modified on 十一月 15, 2024

  


IR链接：    [YASHAN-3277](https://pingcode.yasdb.com/ship/ideas/66d6767a4283cf23d4f44591?#YASHAN-3277)      
  SR链接：    [YDBRD-34089](https://pingcode.yasdb.com/pjm/items/670cdefce489dd0868f73846?#YDBRD-34089)      
  设计文档：    [设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=177842814)  

##   [1. Overview（概述）](#1-overview概述)  

1、MySQL参数持久化，使用参数文件记录mysql的全局变量值，实例启动的时候，把配置文件里的值作为默认值    
  2、OM安装数据库时

##   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|MySQL参数持久化，文件my.ini|启动后读取变量，默认值为文件设置的值|


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

mysql变量：详情见    [mysql变量类型调研](https://conf.yasdb.com/pages/viewpage.action?pageId=156116150)  

- mysql系统变量包括两种，全局系统变量和会话系统变量。此sr只关心全局系统变量。
- 服务器启动时，会将每个全局变量初始化为其默认值。这些默认值可以通过my.cnf配置文件进行修改。
- 服务器启动后，可以通过set语句动态修改，直接生效，不需要重启库。
- set @@var = default;生效的数据不是文件的初值，是mysql指定的特定值。
- 变量分为只读和可修改，可修改的都可通过文件初始化，只读只有部分可以通过文件初始化（具体变量见下表）
- 文件内同一参数可以重复设置，最后一次设置生效。


全局变量及变量功能如下：

|序号|系统变量类型|mysql服务端默认值|YASHAN的默认值|是否为只读的系统变量（只读的不能通过set global和set session来修改）|是否允许在文件级别指定默认值|是否全局和会话层面都能设置|只做语法兼容还是支持实际功能|变量数据类型|变量数据范围|文件初始化变量数据范围|支持设置的右值数据类型|调研例子|
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|1|auto_increment_increment |1|1|否|是|是|语法兼容|~~DTYPE_SMALLINT~~,DTYPE_INTEGER|1~65535||整数类型|mysql服务端：,mysql> set session auto_increment_increment='fdfd';    
  ERROR 1232 (42000): Incorrect argument type to variable 'auto_increment_increment',  
,兼容性：,mysql> set session auto_increment_increment='fdfd';    
  Query OK, 0 rows affected (0.00 sec)|
|2|autocommit|1|1|否|  
是|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_TINYINT    
  (mysql:bool)|0/1、true/false、ON/OFF|文件带引号配置参数值支持，set命令报错  

autocommit = 'false',autocommit = 'off',autocommit = '0',autocommit = false,autocommit = off,autocommit = 0|~~整数类型~~,整数类型、字符串类型|1.其它值报错Variable 'autocommit' can't be set to the value of 'xxx'|
|3|character_set_client |utf8mb4|utf8mb4|否|  
否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,~~UTF16()~~  （客户端不能设置utf16字符集，对齐mysql）/,UTF8（set后再select的结果对齐mysql，其他字符集变量类型同理）/,UTF8MB3（set后再select的结果对齐mysql，其他字符集变量类型同理）/,UTF8MB4（set后再select的结果对齐mysql，其他字符集变量类型同理||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|4|character_set_connection |utf8mb4|utf8mb4|否|  
否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|5|character_set_results |utf8mb4|utf8mb4|否|  
否|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|6|character_set_server |utf8mb4|utf8mb4|否|是|是|语法兼容|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|7|collation_server |utf8mb4_general_ci|utf8mb4_general_ci|否|是|是|语法兼容|DTYPE_VARCHAR|输入正确的字符序文本串,ascii_bin/ascii_general_ci/gbk_bin/gbk_chinese_ci/,latin1_bin/latin1_general_ci/utf8mb4_bin/utf8mb4_general_ci/,utf8mb3_bin/utf8mb3_general_ci/utf8_bin/utf8_general_ci/,utf16_bin/utf16_general_ci/gb18030_bin/gb18030_chinese_ci||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|8|collation_connection |utf8mb4_general_ci|utf8mb4_general_ci|否|  
否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符序文本串,ascii_bin/ascii_general_ci/gbk_bin/gbk_chinese_ci/,latin1_bin/latin1_general_ci/utf8mb4_bin/utf8mb4_general_ci/,utf8mb3_bin/utf8mb3_general_ci/utf8_bin/utf8_general_ci/,utf16_bin/utf16_general_ci/gb18030_bin/gb18030_chinese_ci||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|9|character_set_database|utf8mb4|utf8mb4|否|  
否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符集文本串,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|10|collation_database|utf8mb4_general_ci|utf8mb4_general_ci|否|  
否|是|语法兼容|DTYPE_VARCHAR|输入正确的字符序文本串,ascii_bin/ascii_general_ci/gbk_bin/gbk_chinese_ci/,latin1_bin/latin1_general_ci/utf8mb4_bin/utf8mb4_general_ci/,utf8mb3_bin/utf8mb3_general_ci/utf8_bin/utf8_general_ci/,utf16_bin/utf16_general_ci/gb18030_bin/gb18030_chinese_ci||本sr定为能向字符型进行转换的类型|1.只能设置字符集文本字符串,2.不支持设置字符集id（mysql服务端可以设置1~99，本sr不支持）|
|11|datadir|取决于部署路径，不同环境路径不同|YASDB_DATA|是|  
是|否，只读|语法兼容|DTYPE_VARCHAR|定值YASDB_DATA||只读|只读|
|12|init_connect |不显示|不显示|否|是|否，仅全局才能设置,设置会话时,ERROR 1229 (HY000): Variable 'init_connect' is a GLOBAL variable and should be set with SET GLOBAL|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_VARCHAR|init_connect < min(32000, 会话系统变量max_allowed_packet)||本sr定为能向字符型进行转换的类型|  
|
|13|interactive_timeout |28800|28800|否|是|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|1~31536000||整数类型|  
|
|14|license |GPL|COMMERCIAL|是,ERROR 1238 (HY000): Variable 'license' is a read only variable|否|否，只读，不在讨论范围|语法兼容|DTYPE_VARCHAR|定值COMMERCIAL||只读|只读|
|15|lower_case_table_names |0|0|是|是  
|否，只读，不在讨论范围|语法兼容|DTYPE_INTEGER|定值0||只读|只读|
|16|max_allowed_packet |4194304|4194304|否|  
是|否，仅全局才能设置，SESSION variable 'max_allowed_packet' is read-only. Use SET GLOBAL to assign the value|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|  `2的n次方，n取正整数，n最小值为10，最大值为30`  |1024-1073741824  
非2的n次方报错|整数类型|  
|
|17|net_write_timeout |60|60|否|  
是|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|1~31536000||整数类型|  
|
|18|performance_schema |1|1|是|是  
|否，只读|语法兼容|DTYPE_INTEGER|1|performance_schema = 'false',performance_schema = 'off',performance_schema = '0',performance_schema = false,performance_schema = off,performance_schema = 0|只读|只读|
|19|sql_mode |ONLY_FULL_GROUP_BY,,STRICT_TRANS_TABLES,,NO_ZERO_IN_DATE,,NO_ZERO_DATE,,ERROR_FOR_DIVISION_BY_ZERO,,NO_AUTO_CREATE_USER,,NO_ENGINE_SUBSTITUTION，,  
|ERROR_FOR_DIVISION_BY_ZERO,,IGNORE_SPACE,,NO_AUTO_CREATE_USER,,NO_AUTO_VALUE_ON_ZERO,,NO_BACKSLASH_ESCAPES,,NO_ENGINE_SUBSTITUTION,,NO_UNSIGNED_SUBTRACTION,,NO_ZERO_DATE,,NO_ZERO_IN_DATE,,ONLY_FULL_GROUP_BY,,PAD_CHAR_TO_FULL_LENGTH,,STRICT_ALL_TABLES,,STRICT_TRANS_TABLES,,TIME_TRUNCATE_FRACTIONAL|否|  
是|是|部分支持实际功能：,ANSI_QUOTES，,REAL_AS_FLOAT,,PIPES_AS_CONCAT,  
,以下语法兼容：,ALLOW_INVALID_DATES，,ERROR_FOR_DIVISION_BY_ZERO，,HIGH_NOT_PRECEDENCE，,IGNORE_SPACE，,NO_AUTO_CREATE_USER，,NO_AUTO_VALUE_ON_ZERO，,NO_BACKSLASH_ESCAPES，,NO_DIR_IN_CREATE，,NO_ENGINE_SUBSTITUTION，,NO_UNSIGNED_SUBTRACTION，,NO_ZERO_DATE，,NO_ZERO_IN_DATE，,ONLY_FULL_GROUP_BY，,PAD_CHAR_TO_FULL_LENGTH，,STRICT_ALL_TABLES，,STRICT_TRANS_TABLES，,TIME_TRUNCATE_FRACTIONAL|DTYPE_VARCHAR|输入正确的sql_mode字符串，目前只支持识别：,ANSI_QUOTES，,REAL_AS_FLOAT,,PIPES_AS_CONCAT，,  
,ALLOW_INVALID_DATES，,ERROR_FOR_DIVISION_BY_ZERO，,HIGH_NOT_PRECEDENCE，,IGNORE_SPACE，,NO_AUTO_CREATE_USER，,NO_AUTO_VALUE_ON_ZERO，,NO_BACKSLASH_ESCAPES，,NO_DIR_IN_CREATE，,NO_ENGINE_SUBSTITUTION，,NO_UNSIGNED_SUBTRACTION，,NO_ZERO_DATE，,NO_ZERO_IN_DATE，,ONLY_FULL_GROUP_BY，,PAD_CHAR_TO_FULL_LENGTH，,STRICT_ALL_TABLES，,STRICT_TRANS_TABLES，,TIME_TRUNCATE_FRACTIONAL||本sr定为能向字符型进行转换的类型|1.如果set sqlmode的时候，用数字来设置，则表现奇怪，不建议。,mysql> set session sql_mode=cast('22' as unsigned);    
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
|20|system_time_zone |CST|CST|是|否|否，只读|语法兼容|DTYPE_VARCHAR|定值CST||只读|只读|
|21|time_zone |SYSTEM|SYSTEM|否|  
否|是|语法兼容|DTYPE_VARCHAR|SYSTEM,"-12:59" ~ "+13:00",  [https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_time_zone](https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_time_zone)  ||本sr定为能向字符型进行转换的类型|还会检查timezone的合法性。,mysql> set session time_zone=cast('23' as unsigned);    
  ERROR 1232 (42000): Incorrect argument type to variable 'time_zone'    
  mysql> set session time_zone='dsds';    
  ERROR 1298 (HY000): Unknown or incorrect time zone: 'dsds'|
|22|transaction_isolation |REPEATABLE-READ|REPEATABLE-READ|否|是|是|语法兼容|DTYPE_VARCHAR|  `READ-UNCOMMITTED`  ,  `READ-COMMITTED`  ,  `REPEATABLE-READ`  ,  `SERIALIZABLE`  ||本sr定为能向字符型进行转换的类型|  
|
|23|wait_timeout |28800|28800|否|是|是|支持实际功能（协议需要用到，在协议SR中测）|DTYPE_INTEGER|1~31536000|文件中设置wait_timeout = '23'支持加载；, set @@wait_timeout = '12';报错|整数类型|  
|
|24|transaction_read_only|0|0|否|是|是|语法兼容|DTYPE_TINYINT|0/1、true/false、ON/OFF|文件中那个支持设置布尔类型带引号或不带引号，查询时要查询select @@tx_read_only;,,transaction_read_only = 'false',transaction_read_only = 'off',transaction_read_only = '0',transaction_read_only = false,transaction_read_only = off,transaction_read_only = 0,|整数类型/字符型|1.其它值报错Variable 'autocommit' can't be set to the value of 'xxx'|
|25|version_comment |MySQL Community Server (GPL)|会根据当前安装包的版本来输出，安装包版本会持续刷新|是|否|否，只读|语法兼容|DTYPE_VARCHAR|会根据当前安装包的版本来输出||只读|只读|
|26|version|取决于安装版本号，例如5.7.44|目前是Yashan Compatibility 1.0.0.0|是|否|否，只读|语法兼容|DTYPE_VARCHAR|定值||只读|只读|
|27|validate_password_check_user_name|OFF|OFF|否|是|否，仅全局才能设置|支持实际功能|DTYPE_BOOL|0/1、true/false、ON/OFF|validate_password_check_user_name = 'false',validate_password_check_user_name = 'off',validate_password_check_user_name = '0',validate_password_check_user_name = false,validate_password_check_user_name = off,validate_password_check_user_name = 0|整数类型|  
|
|28|validate_password_dictionary_file|空|空|否|是|否，仅全局才能设置|支持实际功能|DTYPE_CHAR|有效文件路径||字符型|  
|
|29|validate_password_length|8|8|否|是|否，仅全局才能设置|支持实际功能|DTYPE_INTEGER|[0, 2147483647]||整数类型|  
|
|30|validate_password_mixed_case_count|1|1|否|是|否，仅全局才能设置|支持实际功能|DTYPE_INTEGER|[0, 2147483647]||整数类型|  
|
|31|validate_password_number_count|1|1|否|是|否，仅全局才能设置|支持实际功能|DTYPE_INTEGER|[0, 2147483647]||整数类型|  
|
|32|validate_password_policy|1|1|否|是  
|否，仅全局才能设置|支持实际功能|DTYPE_SMALLINT|0/1/2||整数类型/字符型|  
|
|33|validate_password_special_char_count|1|1|否|是  
|否，仅全局才能设置|支持实际功能|DTYPE_INTEGER|[0, 2147483647]||整数类型|  
|
|34|foreign_key_checks|1|1|否|否  
|是|语法兼容|DTYPE_TINYINT,(MYSQL:BOOL)|  
||  
|  
|
|35|lower_case_file_system|0|0|是|否|否，只读|语法兼容|DTYPE_BOOL|  
||  
|  
|
|36|net_buffer_length|16384|16384|否|是  
|否，仅全局才能设置|语法兼容|DTYPE_INTEGER|  
|0-1048576|  
|  
|
|37|net_read_timeout|30|30|否|是|是|语法兼容|DTYPE_INTEGER|  
||  
|  
|
|38|query_cache_size|1048576|1048576|否|是  
|否，仅全局才能设置|语法兼容|DTYPE_INTEGER|  
||  
|  
|
|39|query_cache_type|0|0|否|是|是|语法兼容|DTYPE_TINYINT|0，1，2  
|#query_cache_type = 'false',query_cache_type = 'off',query_cache_type = '0',#query_cache_type = false,query_cache_type = off,query_cache_type = 0|  
|  
|
|40|sql_auto_is_null|0|0|否|  
否|是|语法兼容|DTYPE_TINYINT|on,off,0,1  
||  
|  
|
|41|sql_log_bin|0|0|否|否  
|是|语法兼容|DTYPE_TINYINT|  
||  
|  
|
|42|sql_quote_show_create|1|1|否|否  
|是|语法兼容|DTYPE_TINYINT|  
||  
|  
|
|43|sql_select_limit|COD_MAX_INT64|COD_MAX_INT64|否|否  
|是|语法兼容|DTYPE_BIGINT|  
||  
|  
|
|44|tx_isolation|READ-COMMITTED|READ-COMMITTED|否|否  
|是|语法兼容|DTYPE_VARCHAR|  
||  
|  
|
|45|tx_read_only|0|0|否|否  
|是|语法兼容|DTYPE_TINYINT|  
||  
|  
|


(3) SQL语法有关的功能特性调研，需要给出语法图或EBNF，说明各语法分支的具体含义。

|功能|调研表现|调研表现|
|---|---|---|
|语法分支1|用例输出行为|行为解释说明|
|语法分支2|用例输出行为|行为解释说明|


(4) 与协议、通讯、多线程多进程同步有关的功能特性调研，需要给出时序图。

(5) 调研数据库的功能相关的系统表、系统视图和配置参数，需要罗列，给出原始资料链接和概括小结。

(6) 偏内层，无法直接感知的功能特性，要从explain、视图、DFX函数、用户文档以及相关功能的表现，进行多方佐证。

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*