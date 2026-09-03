Created by 刘立, last modified on 八月 29, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/661916eefd997db58ad89729](https://pingcode.yasdb.com/pjm/items/661916eefd997db58ad89729)    ?    
  #YDBRD-26286 支持MySQL变量类型

1. 重点关注支持变量类型的设置和使用，本SR只支持sql_mode的部分功能，其他功能是否生效另外SR跟踪，不生效的数据类型的值实际上并不影响数据库。


## 1.1相关文档

开发设计：    [特性设计-YDBRD-26286：支持MySQL变量类型](156116155.html)  

测试调研：    [YDBRD-26286：支持MySQL变量类型测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=156130972)  

其他：    [生态兼容总体设计](/pages/createpage.action?spaceKey=YAS&title=%E7%94%9F%E6%80%81%E5%85%BC%E5%AE%B9%E6%80%BB%E4%BD%93%E8%AE%BE%E8%AE%A1)  

# 2. 需求分析

## 2.1 功能点分析

1. 系统变量支持的取值范围、变量类型为会话/全局、对于超范围的处理情况。
1. 功能理解
1.     - 全局系统变量的生命周期是数据库执行的生命周期。在启动数据库时加载全局系统变量，关闭数据库时释放全局系统变量，重启数据库时重新加载全局系统变量为默认值。
    - 会话系统变量的生命周期是在第一次使用/设置会话系统变量到会话结束。第一次执行为select，会话系统变量赋值为当前全局系统变量的值作为默认值；第一次执行为set，会话系统变量为当前全局系统变量的值作为默认值，执行阶段改为右值。在会话结束时释放所有会话系统变量。
    - 用户变量的生命周期大致上与会话系统变量相同，区别在于用户变量第一次执行为select时赋值为NULL。



## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

1. MySQL中存在超范围值报错warning，修改未生效，自动修正为最大/最小值。本SR实现超范围直接报错，修改失败，不会自动修正。
1. 部分参数取值范围与MySQL不一致，按实际设计范围生效。


  


|变量名称|变量含义|作用域|类型|是否只读|MySQL取值范围|YashanDB取值范围|
|---|---|---|---|---|---|---|
|auto_increment_increment|主从服务器上自增字段的复制间隔|全局/会话|INT|否|动态生效,默认值为1,取值范围[1~65535]，1~65535之间的整数。|与MySQL相同|
|autocommit|事务是否自动提交|全局/会话|Boolean|否|动态生效,默认值为1,取值范围true、1、on、false、0、off。指定非0/1时不区分大小写|与MySQL相同|
|character_set_client|客户端发送语句的字符集|全局/会话|String|否|动态生效,默认值为utf8    
  取值范围,执行SHOW CHARACTER SET;返回的所有字符集，其中不支持ucs2、utf16、utf16le、utf32|默认值为    
  UTF8MB4    
  取值范围：    
  ASCII/GB18030/GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4|
|character_set_connection|客户端连接到数据库后传输使用的字符集|全局/会话|String|否|同上|同上|
|character_set_results|服务器返回给客户端的结果集所使用的字符集|全局/会话|String|否|同上|同上|
|character_set_server|服务器默认字符集|全局/会话|String|否|同上|同上|
|collation_server|服务器上数据库的默认排序规则|全局/会话|String|否|动态生效,默认值latin1_swedish_ci,取值范围,执行SELECT CHARACTER_SET_NAME, COLLATION_NAME, ID FROM information_schema.COLLATIONS ORDER BY CHARACTER_SET_NAME, COLLATION_NAME;查询显示是内容|默认值为    
  UTF8MB4    
  取值范围：    
  UTF8MB4_BIN/,UTF8MB4_GENERAL_CI|
|collation_connection|连接的字符集排序规则|全局/会话|String|否|同上|同上|
|character_set_database|当前数据库使用的默认字符集|全局/会话|String|否|同character_set_client|同character_set_client|
|collation_database|数据库使用的字符集排序规则|全局/会话|String|否|同collation_server|同collation_server|
|datadir|服务器数据目录的路径|全局|  
|是|默认值为服务器数据目录的路径|定值 YASDB_DATA|
|init_connect|每个客户端连接时执行的字符串，由一个或多个SQL语句组成|全局|String|否|默认不显示    
  取值范围：最小值为0，支持的最大值为当前会话中@@session.max_allowed_packet设置的值，及当前会话数据包消息缓冲区初始化字节大小|默认不显示    
  取值范围：最小值为  0字节字符串，最大值为min(32000,@@session.max_allowed_packet)字节字符串|
|interactive_timeout|服务器在关闭交互式连接之前等待活动的时间|全局/会话|INT|否|动态生效,默认值为28800,取值范围[1~31536000]，单位秒|与MySQL相同|
|license|服务器拥有的许可证类型|全局|String|是|默认值为GPL|定值COMMERCIAL|
|lower_case_table_names|控制表名存储和比较时是否区分大小写|全局|INT|是|默认值取决于服务器平台，在Linux上时默认值为0|定值0|
|max_allowed_packet|数据包消息缓冲区初始化字节大小|全局/会话（会话变量为只读）|INT|否|动态生效,默认值为4194304,取值范围[1024~1073741824]，该值应设置为1024的整数倍，非1024的整数倍会向下取整为最接近的值|默认值为4194304,取值范围[1024~1073741824]，该值应设置为1024的整数倍，非1024的整数倍报错|
|net_write_timeout|在中止写入之前等待块写入连接的秒数|全局/会话|INT|否|动态生效,默认值为60,取值范围[1~31536000]，单位秒|与MySQL相同|
|performance_schema|是否启用性能模式|全局|Boolean|是|默认值为1|默认值1|
|sql_mode|设置SQL模式|全局/会话|Enumeration|否|动态生效    
  默认值：ONLY_FULL_GROUP_BY STRICT_TRANS_TABLES NO_ZERO_IN_DATE NO_ZERO_DATE ERROR_FOR_DIVISION_BY_ZERO NO_AUTO_CREATE_USER NO_ENGINE_SUBSTITUTION,有效值：ALLOW_INVALID_DATES,ANSI_QUOTES,ERROR_FOR_DIVISION_BY_ZERO,HIGH_NOT_PRECEDENCE,IGNORE_SPACE,NO_AUTO_CREATE_USER,NO_AUTO_VALUE_ON_ZERO,NO_BACKSLASH_ESCAPES,NO_DIR_IN_CREATE,NO_ENGINE_SUBSTITUTION,NO_FIELD_OPTIONS,NO_KEY_OPTIONS,NO_TABLE_OPTIONS,NO_UNSIGNED_SUBTRACTION,NO_ZERO_DATE,NO_ZERO_IN_DATE,ONLY_FULL_GROUP_BY,PAD_CHAR_TO_FULL_LENGTH,PIPES_AS_CONCAT,REAL_AS_FLOAT,STRICT_ALL_TABLES,STRICT_TRANS_TABLES,输入其他类型执行成功时结果无法预测|与MySQL相同|
|system_time_zone|服务器系统时区|全局|String|是|默认值取决于服务器开始执行时从机器默认值中继承的时区|定值CST|
|time_zone|当前时区|全局/会话|String|否|动态生效    
  默认值为SYSTEM,在修改时需要使用mysql_tzinfo_to_sql程序加载时区表，执行命令：    
  mysql_tzinfo_to_sql /usr/share/zoneinfo | mysql -u root -p mysql    
  加载后修改范围为 mysql.time_zone_name表中的NAME字段，加载前该表为空，如系统支持时区发现变化可重新执行加载，重新执行只会增加新的时区，不会删除表中原有信息|"-12:59" ~ "+13:00"|
|transaction_isolation|事务隔离级别|全局/会话|Enumeration|否|动态生效,默认值为READ-UNCOMMITTED,支持指定READ-UNCOMMITTED,READ-COMMITTED,REPEATABLE-READ,SERIALIZABLE|与MySQL相同|
|wait_timeout|服务器在关闭非交互式连接之前等待该连接活动的秒数|全局/会话|INT|否|动态生效,默认值28800,取值范围[1~31536000]，单位秒,在使用交互式新建连接的session wait_timeout 会受到 global interactive_timeout 的影响，最终session wait_timeout 的结果与 global wait_timeout 的结果不一致，反而与 global interactive_timeout 一致。|默认值28800,取值范围[1~31536000]，单位秒,不支持    [mysql_real_connect()](https://dev.mysql.com/doc/c-api/5.7/en/mysql-real-connect.html)  |
|transaction_read_only|默认事务访问模式|全局/会话|Boolean|否|动态生效,默认值为0,取值范围true、1、on、false、0、off。|默认值为0,取值范围true、1、on、false、0、off。|
|version_comment|版本说明|全局|  
|是|默认值    
  MySQL Community Server (GPL)|依据安装包版本输出|
|version|版本信息|全局|  
|是|默认值    
  5.7.44|定值  Yashan Compatibility 1.0.0.0|


# 3. 详细测试设计

## 3.1 测试设计方法

1、set语句、select语句、具体参数值，采用等价类划分、边界值等输出测试点；交互功能结合场景法输出测试点。

## 3.2 详细测试设计

1、新增变量类型相关语法

1）使用set、select语法

|设置范围|语句|有效等价类|无效等价类|
|---|---|---|---|
|设置全局系统变量|set global max_connections=1000;    
  set @@global.max_connections=1000;    
  set @@max_connections=1000;(不存在会话变量时使用)    
  set global max_connections:=1000;    
  set @@global.max_connections:=1000;    
  set @@max_connections:=1000;|- 语句大小写
- 系统变量大小写
|- 语句不完整
- 不支持的系统变量
|
|设置会话系统变量|set session max_connections=1000;    
  set @@session.max_connections=1000;    
  set @@max_connections=1000;    
  set session max_connections:=1000;    
  set @@session.max_connections:=1000;    
  set @@max_connections:=1000;    
  set local max_connections=1000;    
  set @@local.max_connections=1000;    
  set local max_connections:=1000;    
  set @@local.max_connections:=1000;|- 语句大小写
- 系统变量大小写
|- 语句不完整
- 不支持的系统变量
|
|查看全局系统变量|SELECT @@global.变量名;    
  SELECT @@变量名;（@@优先标记会话变量，不存在会话变量时标记全局变量）|- 语句大小写
- 系统变量大小写
|- 语句不完整
- 不支持的系统变量
|
|查看全局系统变量|SELECT @@session.变量名;    
  SELECT @@变量名;（@@优先标记会话变量，不存在会话变量时标记全局变量）|- 语句大小写
- 系统变量大小写
|- 语句不完整
- 不支持的系统变量
|
|设置用户变量|set @test=1;,set @test:=1;(使用:=支持在set以外的语句为变量赋值)|- 语句大小写
- 变量覆盖：大小写、特殊字符（使用特殊字符带反引号）
|- 语句不完整
- 特殊字符
|
|查看用户变量|select @test;|- 已声明的用户变量
- 未声明的用户变量
|- 不存在的用户变量
|


2）在set以外的语句为用户变量赋值

|语句|位置|备注|
|---|---|---|
|select|select 后直接加变量并赋值    
  SELECT @test := 7;|  
|
|  
|count返回内容赋值|  
|
|  
|投影列|  
|
|  
|select语句中包含where|  
|
|  
|select语句中包含group by|  
|
|  
|select语句中包含order by|  
|
|  
|select语句中包含having|  
|
|insert|values中赋值并插入|  
|
|  
|使用select插入，在select中赋值|  
|


2、对于所有系统变量的设置覆盖有效值和非法值，非法值同时覆盖仅支持全局变量修改会话变量，修改只读变量

|变量名称|默认值|有效值|无效值|备注|
|---|---|---|---|---|
|auto_increment_increment|1|1、65535、2|超范围：0、65536,非法类型：string、bool,‘1’、true、’test’、null|覆盖全局和会话|
|autocommit|1|true、1、on、false、0、off|不是on/off的string：’1’、‘false’,其他INT：2、-1    
  其他类型：null|覆盖全局和会话|
|character_set_client|utf8mb4|ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4,  
|不支持的字符集：big5、dec8等,非法字符：’test’,其他类型：1、true、null,  
,  
|覆盖全局和会话|
|character_set_connection|utf8mb4|同上|同上|覆盖全局和会话|
|character_set_results|utf8mb4|同上|同上|覆盖全局和会话|
|character_set_server|utf8mb4|同上|同上|覆盖全局和会话|
|collation_server|utf8mb4_general_ci|UTF8MB4_BIN/,UTF8MB4_GENERAL_CI|不支持的字符排序：big5_bin、armscii8_bin等,非法字符：’test’,其他类型：1、true、null,  
|覆盖全局和会话|
|collation_connection|utf8mb4_general_ci|同上|同上|覆盖全局和会话|
|character_set_database|utf8mb4|同character_set_client|同character_set_client|覆盖全局和会话|
|collation_database|utf8mb4_general_ci|同collation_server|同collation_server|覆盖全局和会话|
|datadir|YASDB_DATA|只读|指定 session 进行修改    
  指定 global 进行修改|全局只读|
|init_connect（@@session.max_allowed_packet小于32000）|不显示|空字符串、1字节字符串、@@session.max_allowed_packet个字节字符串|指定 session 进行修改    
  字符串长度超过@@session.max_allowed_packet,非法类型：1、true、null|全局|
|init_connect（@@session.max_allowed_packet大于32000）|  
|32000个字节字符串|字符串长度超过32000|  
|
|interactive_timeout|28800|1、31536000、7200|超范围：0、31536001,非法类型：string、bool,‘1’、true、’test’、null|覆盖全局和会话|
|license|COMMERCIAL| 只读|指定 session 进行修改    
  指定 global 进行修改|全局只读|
|lower_case_table_names|0| 只读|指定 session 进行修改    
  指定 global 进行修改|全局只读|
|max_allowed_packet|4194304|1024、1073741824、1048576、  ~~1048577~~  ~~（非1024的整数倍向下取整为1048576）~~|超范围：0、1023、1073741825、1073742848、1048577,非法类型：string、bool,‘1’、true、’test’、null|全局|
|max_allowed_packet|4194304|只读|指定 session 进行修改|会话只读|
|net_write_timeout|60|1、31536000、120|超范围：0、31536001,非法类型：string、bool,‘1’、true、’test’、null|覆盖全局和会话|
|performance_schema|1| 只读|指定 session 进行修改    
  指定 global 进行修改|全局只读|
|sql_mode|ONLY_FULL_GROUP_BY,,STRICT_TRANS_TABLES,,NO_ZERO_IN_DATE,,NO_ZERO_DATE,,ERROR_FOR_DIVISION_BY_ZERO,,NO_AUTO_CREATE_USER,,NO_ENGINE_SUBSTITUTION|ALLOW_INVALID_DATES,ANSI_QUOTES,ERROR_FOR_DIVISION_BY_ZERO,HIGH_NOT_PRECEDENCE,IGNORE_SPACE,NO_AUTO_CREATE_USER,NO_AUTO_VALUE_ON_ZERO,NO_BACKSLASH_ESCAPES,NO_DIR_IN_CREATE,NO_ENGINE_SUBSTITUTION,NO_FIELD_OPTIONS,NO_KEY_OPTIONS,NO_TABLE_OPTIONS,NO_UNSIGNED_SUBTRACTION,NO_ZERO_DATE,NO_ZERO_IN_DATE,ONLY_FULL_GROUP_BY,PAD_CHAR_TO_FULL_LENGTH,PIPES_AS_CONCAT,REAL_AS_FLOAT,STRICT_ALL_TABLES,STRICT_TRANS_TABLES,进行排列组合|非给定范围：,READ-COMMITTED,其他类型值：,1、true、’test’、null,  
|覆盖全局和会话|
|system_time_zone|CST| 只读|指定 session 进行修改    
  指定 global 进行修改|全局只读|
|time_zone|SYSTEM|-12:59、+13:00、-01:00、+05:30,  
|超范围：-13:00、+13:01    
  分钟数超出合法范围：+11:60    
  其他字符串：'test'    
  其他类型：1、true、null|覆盖全局和会话|
|transaction_isolation|REPEATABLE-READ|READ-UNCOMMITTED,READ-COMMITTED,REPEATABLE-READ,SERIALIZABLE|非给定范围：,WRITE-COMMITTED,给定范围值进行组合：,READ-UNCOMMITTED、READ-COMMITTED,其他类型值：,1、true、’test’、null|覆盖全局和会话|
|wait_timeout|28800|1、31536000、7200|超范围：0、31536001,非法类型：string、bool,‘1’、true、’test’、null|覆盖全局和会话|
|transaction_read_only|0|true、1、on、false、0、off|不是on/off的string：’1’、‘false’,其他INT：2、-1    
  其他类型：null|覆盖全局和会话|
|version_comment|依据安装包版本输出| 只读|指定 session 进行修改    
  指定 global 进行修改|全局只读|
|version|Yashan Compatibility 1.0.0.0| 只读|指定 session 进行修改    
  指定 global 进行修改|全局只读|


3、sql_mode部分参数功能已经支持，测试在使用@@sql_mode修改系统变量后，已经支持的参数功能能正常生效

|配置作用域|配置参数|预期结果|备注|
|---|---|---|---|
|设置全局系统变量|ANSI_QUOTES,REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,REAL_AS_FLOAT,ANSI_QUOTES,PIPES_AS_CONCAT,REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,REAL_AS_FLOAT,PIPES_AS_CONCAT,除覆盖上述参数场景外，覆盖上述参数+1个/多个只支持语法兼容无实际意义的参数|对于全局系统变量设置，设置成功后新会话功能生效|参数修改在多次修改同一个全局系统变量、会话系统变量时覆盖|
|设置会话系统变量|ANSI_QUOTES,REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,REAL_AS_FLOAT,ANSI_QUOTES,PIPES_AS_CONCAT,REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,REAL_AS_FLOAT,PIPES_AS_CONCAT,除覆盖上述参数场景外，覆盖上述参数+1个/多个只支持语法兼容无实际意义的参数|对于会话系统变量设置，设置成功后当前会话生效|  
|


4、与其他场景的交互

1）多会话场景

|变量范围|测试点|场景|预期结果|
|---|---|---|---|
|用户变量|用户变量的生效周期为当前会话，已经创建的会话和还未创建的会话都不会受到当前会话的用户变量影响|1、创建2个会话s1、s2    
  2、s1创建用户变量@t1    
  3、s2获取用户变量@t1    
  4、新建会话s3    
  5、s3获取用户变量@t1    
  6、会话s1、s2、s3分别设置用户变量为不同值并使用|3、s2获取用户变量为NULL    
  5、s3获取用户变量为NULL    
  6、不同会话中相同名称的用户变量各自独立互不影响|
|全局系统变量和会话系统变量|全局变量和会话变量之间的独立性和正确性|1、创建2个会话s1、s2。均执行select查看全局系统变量和会话系统变量    
  2、s1修改全局系统变量    
  3、s2查看全局系统变量    
  4、s1修改会话系统变量    
  5、s2查看会话系统变量    
  6、新建会话s3，s3查看会话系统变量和全局系统变量|2、修改成功    
  3、s2全局变量改变    
  4、修改成功    
  5、s2会话变量不变    
  6、s3全局变量与s1一致，会话变量与全局变量一致|
|  
|  
|1、创建3个会话s1、s2、s3    
  2、s3查看会话系统变量    
  3、会话s1修改全局系统变量    
  4、会话s2、s3查看会话系统变量|4、会话s2中会话系统变量为s1修改后的值，会话s3中会话系统变量为s1修改前的值|
|  
|  
|1、新连接会话先获取全局变量    
  2、新连接会话先设置全局变量    
  3、新连接会话先获取会话变量    
  4、新连接会话先设置会话变量|均能获取到正确的值|
|全局变量|全局变量的生命周期|1、数据库正常停止后重启    
  2、数据库异常停止后重启|数据库重启后全局变量恢复到默认值|


2）与compat_vector交互，修改compat_vector不影响已经设置的变量

|测试点|场景|预期结果|
|---|---|---|
|修改compat_vector不影响已设置的系统变量|1、设置全局系统变量    
  2、修改compat_vector为yashan    
  3、查看全局系统变量|3、查看全局系统变量成功，变量值正确|
|  
|1、设置会话系统变量    
  2、修改compat_vector为yashan    
  3、查看会话系统变量|3、查看会话系统变量成功，变量值正确|
|  
|1、设置用户变量    
  2、修改compat_vector为yashan    
  3、使用用户变量|3、用户变量正确，可正常使用|
|修改compat_vector不影响sql_mode功能|1、设置sql_mode为支持功能的值ANSI_QUOTES，REAL_AS_FLOAT,PIPES_AS_CONCAT    
  2、修改compat_vector为yashan    
  3、修改回mysql|修改后sql_mode功能正常生效|


3）权限测试

|场景|预期结果|
|---|---|
|非dba权限的用户设置全局系统变量|设置失败，报错信息合理准确|
|非dba权限的用户设置会话系统变量|设置成功，设置结果正常生效|
|非dba权限的用户设置用户变量|设置成功，设置结果正常生效|


5、设置用户变量和系统变量，  ~~set语句右值表达式~~

- 设置用户变量，右值覆盖不同的    [数据类型](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B/00%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B.html)  
- 表达式场景覆盖用户变量  、全局系统变量、会话系统变量


|表达式|描述|
|---|---|
|EXPR_QUERY（不支持）|右值为完整select语句，set @@session.wait_timeout=(select @@session.interactive_timeout)|
|EXPR_SEQUENCE|右值为 sequence，示例：,CREATE SEQUENCE seq_yashan1;,set @@session.wait_timeout=seq_yashan1.NEXTVAL;|
|EXPR_CASE|右值为 CASE ，示例：,SET @@session.wait_timeout = (CASE WHEN @@session.wait_timeout > 2600 THEN 2700 WHEN @@session.wait_timeout < 2600 THEN 2500 ELSE 2600 END);|
|EXPR_ADD|用于表示sql语句中的二元运算符 +|
|EXPR_SUB|用于表示sql语句中的二元运算符 -|
|EXPR_MUL|用于表示sql语句中的二元运算符 *|
|EXPR_MOD|用于表示sql语句中的二元运算符 %，进行两个表达式取余操作|
|EXPR_DIV|用于表示sql语句中的二元运算符 /|
|EXPR_CAT|用于表示sql语句中的二元运算符 |，进行两个表达式拼接操作|
|EXPR_AND|用于表示sql语句中的二元运算符 &，进行两个表达式按bit位与操作|
|EXPR_OR|用于表示sql语句中的二元运算符 ^，进行两个表达式按bit位异或操作|
|EXPR_XOR|用于表示sql语句中的二元运算符 ||，进行两个表达式按bit位或操作|
|EXPR_NEG|用于表示sql语句中的一元运算符 -，进行表达式取反操作|
|EXPR_DATA_TYPE|右值为cast()    [类型转换](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E8%BD%AC%E6%8D%A2.html)  |
|EXPR_FILTER|右值为 bool 表达式：,set @@session.transaction_read_only=1<2;|


6、使用用户变量和系统变量值

- 用户变量覆盖不同的数据类型
- 全局系统变量和会话系统变量挑选每个数据类型的变量覆盖一个（SMALLINT、TINYINT、VARCHAR、INTEGER）
- 使用位置覆盖用户变量、全局系统变量、会话系统变量


|类别|语句|位置|子场景|
|---|---|---|---|
|DML|select|SELECT List|  
|
|  
|  
|WHERE |比较运算符：=、!=、<、>、<=、>= |
|  
|  
|  
|逻辑运算符：AND、OR、NOT|
|  
|  
|  
|模糊查询：LIKE、NOT LIKE、RLIKE、NOT RLIKE|
|  
|  
|  
|空值检查：IS NULL、IS NOT NULL|
|  
|  
|  
|范围检查：between and、in、not in、exists、not exists|
|  
|  
|  
|any / all / some|
|  
|  
|  
|case when|
|  
|  
|GROUP BY|  
|
|  
|  
|HAVING |同where|
|  
|  
|ORDER BY|  
|
|  
|  
|LIMIT|  
|
|  
|  
|在嵌套查询的子查询中使用|SELECT List|
|  
|  
|  
|WHERE |
|  
|  
|  
|GROUP BY|
|  
|  
|  
|HAVING |
|  
|  
|  
|ORDER BY|
|  
|  
|  
|LIMIT|
|  
|  
|JOIN查询，作为JOIN条件的一部分|  
|
|  
|  
|投影列，语句中包含投影列|  
|
|  
|  
|CTE，语句中包含CTE|  
|
|  
|  
|SET，语句中包含SET|  
|
|  
|insert|使用VALUES插入|用户变量覆盖定义的值和空值|
|  
|  
|通过select插入|  
|
|  
|  
|自增字段|使用变量触发生成自增字段|
|  
|update|作为更新内容|  
|
|  
|  
|作为匹配条件，where|同 select 中 where|
|  
|  
|UPDATE with LIMIT，作为limit条数|  
|
|  
|delete|作为匹配条件，where|同 select 中 where|
|  
|  
|DELETE with LIMIT，作为limit条数|  
|
|  
|  
|DELETE with CASE|用在CASE中|
|DCL|不涉及|  
|  
|
|DDL|alter session|  
|  
|
|  
|alter system|  
|  
|
|  
|alter table|Default，增加默认值|  
|
|  
|COMMENT|用于为表添加注释|  
|
|  
|create table|作为Default|  
|
|  
|create table as select|用于select部分|  
|
|  
|create view as select|用于select部分|  
|
|  
|BACKUP DATABASE|用于备份中的tag_name|  
|
|  
|RESTORE DATABASE|用于备份中的tag_name|  
|
|在存储过程中使用（存储过程只要不core即可，实际使用无法识别报错）|存储过程内使用|  
|  
|
|  
|作为参数传入存储过程|  
|  
|
|在自定义函数中使用|自定义函数内使用|  
|  
|
|  
|作为参数传入自定义函数|  
|  
|
|在内置函数中使用|  [内置函数](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)    参考    
  以下函数不进行覆盖：    
  窗口函数（Window Function）    
  内置表函数（Table Function）    
  地理信息处理函数（GIS Function）    
  不支持传参的函数|  
|  
|


7、mysql模式下并发修改同一个全局系统变量为不同的值

|系统级DFX分类|是否涉及|
|---|---|
|CT|Y|
|KT|Y|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[支持MySQL变量类型文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjZhMWFkOWEzMzExZGM5NzAyIiwicmVmX2lkIjoiNjczOTZlNjY1OTNmOTljOWZmMjM4NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODIyLCJleHAiOjE3ODI0NTgyMjJ9.JsjlD4Y8dGqIexWeKs7tyuSoS5PryyPrvBDOlTYdi-s)

# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

# 8. 与 mysql 的差异点

|序号|yashan|mysql|
|---|---|---|
|1|auto_increment_increment,yashan 超过取值范围报错，如设置为 0,![](https://pingcode.yasdb.com/atlas/files/public/67396e66a1ad9a3311dc9708/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFJQUlBQUFBQUFBSUFBQUFBQUFBQUFFQUFBQUVBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUJBR2dBQUFFQUFBQUFnQUNBQUFBQUFBQUFRQUFBUWdBQUFBQWdBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4MjIsImV4cCI6MTc4MjM4MjYyMn0.yOlUAZVBQd8xdouykj4cEpINn6u2Wd1t1Lj41__mE7o)|auto_increment_increment,mysql 超过取值范围报 warning，并自动修正为最大/最小值，如设置为 0,![](https://pingcode.yasdb.com/atlas/files/public/67396e668970c2af4f521894/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFJQUlBQUFBQUFBSUFBQUFBQUFBQUFFQUFBQUVBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUJBR2dBQUFFQUFBQUFnQUNBQUFBQUFBQUFRQUFBUWdBQUFBQWdBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4MjIsImV4cCI6MTc4MjM4MjYyMn0.yOlUAZVBQd8xdouykj4cEpINn6u2Wd1t1Lj41__mE7o)|
|2|character_set_client,取值范围与 yashan 支持范围一致，与 mysql 不同,yashan 取值范围,ASCII/GB18030/,GBK/LATIN1/UTF8,/UTF8MB3/UTF8MB4|  
|
|3|character_set_connection、character_set_connection、character_set_results、character_set_server、character_set_database,取值范围与 yashan 支持范围一致，与 mysql 不同,yashan 取值范围,ASCII/GB18030/,GBK/LATIN1/,UTF16/UTF8,UTF8MB3/,UTF8MB4|  
|
|4|collation_server、collation_connection、collation_database,取值范围与 yashan 支持范围一致，与 mysql 不同,yashan 取值范围,ascii_bin/ascii_general_ci/gbk_bin/gbk_chinese_ci/,latin1_bin/latin1_general_ci/utf8mb4_bin/utf8mb4_general_ci/,utf8mb3_bin/utf8mb3_general_ci/utf8_bin/utf8_general_ci/,utf16_bin/utf16_general_ci/gb18030_bin/gb18030_chinese_ci|  
|
|5|datadir   定值为 YASDB_DATA|datadir 默认值为服务器数据目录的路径|
|6|init_connect,最大值为 min(32000,@@session.max_allowed_packet)，最大不能大于 32000|init_connect,最大值为 当前会话中@@session.max_allowed_packet设置的值|
|7|license 定值 GPL|license 定值 COMMERCIAL|
|8|system_time_zone 定值 CST|system_time_zone,默认值取决于服务器开始执行时从机器默认值中继承的时区|
|9|time_zone,取值范围 "-12:59" ~ "+13:00"|time_zone,在修改时需要使用mysql_tzinfo_to_sql程序加载时区表，执行命令：    
  mysql_tzinfo_to_sql /usr/share/zoneinfo | mysql -u root -p mysql    
  加载后修改范围为 mysql.time_zone_name表中的NAME字段，加载前该表为空，如系统支持时区发现变化可重新执行加载，重新执行只会增加新的时区，不会删除表中原有信息|
|10|max_allowed_packet,设置为非 1024 的整数倍报错|max_allowed_packet,取值范围[1024~1073741824]，该值应设置为1024的整数倍，非1024的整数倍会向下取整为最接近的值|
|11|version_comment,依据安装包版本输出|version_comment,默认值 MySQL Community Server (GPL)|
|12|version,定值Yashan Compatibility 1.0.0.0|version,mysql 版本|
|13|set 右值不支持 select 语句,set @@session.sql_mode=(select @@session.sql_mode);,![](https://pingcode.yasdb.com/atlas/files/public/67396e668970c2af4f521895/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFJQUlBQUFBQUFBSUFBQUFBQUFBQUFFQUFBQUVBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUJBR2dBQUFFQUFBQUFnQUNBQUFBQUFBQUFRQUFBUWdBQUFBQWdBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4MjIsImV4cCI6MTc4MjM4MjYyMn0.yOlUAZVBQd8xdouykj4cEpINn6u2Wd1t1Lj41__mE7o)|右值支持 select ,set @@session.sql_mode=(select @@session.sql_mode);|
|14|set 以外的语句给用户变量赋值显示与 mysql 不一致，只包含用户变量部分,![](https://pingcode.yasdb.com/atlas/files/public/67396e678970c2af4f521896/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFJQUlBQUFBQUFBSUFBQUFBQUFBQUFFQUFBQUVBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUJBR2dBQUFFQUFBQUFnQUNBQUFBQUFBQUFRQUFBUWdBQUFBQWdBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4MjIsImV4cCI6MTc4MjM4MjYyMn0.yOlUAZVBQd8xdouykj4cEpINn6u2Wd1t1Lj41__mE7o)|![](https://pingcode.yasdb.com/atlas/files/public/67396e678970c2af4f521897/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFJQUlBQUFBQUFBSUFBQUFBQUFBQUFFQUFBQUVBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUJBR2dBQUFFQUFBQUFnQUNBQUFBQUFBQUFRQUFBUWdBQUFBQWdBQUFBQ0FBQkFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4MjIsImV4cCI6MTc4MjM4MjYyMn0.yOlUAZVBQd8xdouykj4cEpINn6u2Wd1t1Lj41__mE7o)|
|15|会话系统变量的初始化在第一次切换 mysql 兼容模式时,使用 mysql 客户段登录时无差异|会话变量的初始化在会话建立时|


  


  


## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjY4OTcwYzJhZjRmNTIxODhmIiwicmVmX2lkIjoiNjczOTZlNjY1OTNmOTljOWZmMjM4NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODIyLCJleHAiOjE3ODI0NTgyMjJ9.Ipn61Fr4bK47jQtoFLRq13UehK-Y-60e570TP6AgzmM)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjY4OTcwYzJhZjRmNTIxODkwIiwicmVmX2lkIjoiNjczOTZlNjY1OTNmOTljOWZmMjM4NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODIyLCJleHAiOjE3ODI0NTgyMjJ9.aP4P3FVJSypC9UrgoTS1eWcmwVL5L_0u-xyR9-_Va_0)

 (application/msword)    


[image2024-7-5_15-49-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjY4OTcwYzJhZjRmNTIxODkxIiwicmVmX2lkIjoiNjczOTZlNjY1OTNmOTljOWZmMjM4NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODIyLCJleHAiOjE3ODI0NTgyMjJ9.itbT4QIc_3x3gbQBqEBGtGvemVy_ulfUTQfMtcG-1RE)

 (image/png)    


[image2024-7-5_15-50-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjZhMWFkOWEzMzExZGM5NzAzIiwicmVmX2lkIjoiNjczOTZlNjY1OTNmOTljOWZmMjM4NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODIyLCJleHAiOjE3ODI0NTgyMjJ9.jYkOjw967o2dzUqNq6lTV5D3LdgOyCYVXEgxkntdsq0)

 (image/png)    


[支持MySQL变量类型文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjZhMWFkOWEzMzExZGM5NzA0IiwicmVmX2lkIjoiNjczOTZlNjY1OTNmOTljOWZmMjM4NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODIyLCJleHAiOjE3ODI0NTgyMjJ9.EhXPTBkEStxzEtzUwKbX4wA1rT5YCN522MJK9jz5DPQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[支持MySQL变量类型文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjZhMWFkOWEzMzExZGM5NzAyIiwicmVmX2lkIjoiNjczOTZlNjY1OTNmOTljOWZmMjM4NDNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODIyLCJleHAiOjE3ODI0NTgyMjJ9.JsjlD4Y8dGqIexWeKs7tyuSoS5PryyPrvBDOlTYdi-s)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,【会议纪要】,与会人：林永豪、张鹏飞、孟麟、刘立    
  会议时间：2024-07-05 16：30 ~ 17：30    
  会议地点：线上    
  腾讯会议：708-350-943    
  纪要信息：,1、右值表达式场景不在本SR覆盖，在支持set的SR覆盖    
  2、存储过程只要不出现core、重启即可，在存储过程中使用报错无法识别    
  3、max_allowed_packet不支持非1024的整数倍自动向下取整，非1024整数倍报错    
  4、支持:=方式赋值，补充相关测试点,Posted by liuli at 七月 05, 2024 17:20|
|---|
