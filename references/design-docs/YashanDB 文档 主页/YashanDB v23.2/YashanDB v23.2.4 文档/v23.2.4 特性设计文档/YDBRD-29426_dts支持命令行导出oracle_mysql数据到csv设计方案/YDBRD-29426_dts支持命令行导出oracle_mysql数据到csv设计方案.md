Created by 贺国锋, last modified on 七月 30, 2024

# YDBRD-29426: dts支持命令行导出oracle/mysql数据到csv设计方案

  [https://pingcode.yasdb.com/pjm/items/66738c29288e197820a97cba](https://pingcode.yasdb.com/pjm/items/66738c29288e197820a97cba)    ?#YDBRD-29426 【dts】dts支持命令行导出oracle/mysql数据到csv

# 1. 总述

     YMP当前是使用lib库的方式，利用java的jni绑定定制，调用yasdts提供的接口，当出现问题时很难进行定位解决。

    yasdts需要支持命令行模式运行，参考yasldr。

    其支持的导出数据库表和字段的能力本次不扩充。

##   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

  
  2.1 dts支持命令行导出oracle数据到指定csv文件，支持参数设置

2.2 dts支持命令行导出mysql数据到指定csv文件，支持参数设置

# 3. 规格与约束

原始设计文档：    [Yasdts独立化运行设计方案](https://conf.yasdb.com/pages/viewpage.action?pageId=150623455)  

支持导出的数据类型

Oracle:

|数据类型|绑定类型|
|:---|:---|
|VARCHAR2(size [BYTE or CHAR])|DTYPE_VARCHAR|
|NVARCHAR2(N)|DTYPE_VARCHAR|
|INT|DTYPE_INTEGER|
|NUMBER[ (p[, s]) ]|DTYPE_NUMBER|
|LONG|DTYPE_CLOB|
|DATE|DTYPE_DATE|
|BINARY_FLOAT|DTYPE_FLOAT|
|BINARY_DOUBLE|DTYPE_DOUBLE|
|TIMESTAMP[(M)]|DTYPE_TIMESTAMP|
|TIMESTAMP [(M)]   WITH TIME ZONE|DTYPE_TIMESTAMP_TZ|
|TIMESTAMP [(M)]   WITH LOCAL TIME ZONE|DTYPE_VARCHAR|
|INTERVAL YEAR [(M)] TO MONTH|DTYPE_YM_INTERVAL|
|INTERVAL DAY [(M)]   TO SECOND [(N)]|DTYPE_DS_INTERVAL|
|RAW(size)|DTYPE_RAW|
|LONG RAW|DTYPE_BLOB|
|CHAR [(size [BYTE or CHAR])]|DTYPE_CHAR|
|NCHAR[(size)]|DTYPE_CHAR|
|CLOB|DTYPE_CLOB|
|NCLOB|DTYPE_CLOB|
|BLOB|DTYPE_BLOB|
|JSON|DTYPE_JSON|
|XMLTYPE|DTYPE_VARCHAR|
|INT/INTEGER/SMALLINT/DEC/NUMERIC/decimal    
  本质上都是NUMBER|DTYPE_NUMBER|
|DOUBLE PRECISION|DTYPE_VARCHAR|


### MySQL:

|数据类型|绑定类型|
|:---|:---|
|TINYINT|DTYPE_TINYINT|
|SMALLINT|DTYPE_SMALLINT|
|MEDIUMINT|DTYPE_SMALLINT|
|INT|DTYPE_INTEGER|
|BIGINT|DTYPE_BIGINT|
|DECIMAL|DTYPE_NUMBER|
|FLOAT|DTYPE_FLOAT|
|DOUBLE|DTYPE_DOUBLE|
|DATE|DTYPE_DATE|
|DATETIME|DTYPE_TIMESTAMP|
|TIMESTAMP[(M)]|DTYPE_TIMESTAMP|
|TIME|DTYPE_SHORTTIME|
|YEAR|DTYPE_SMALLINT|
|CHAR(M)|DTYPE_CHAR|
|VARCHAR(M)|DTYPE_VARCHAR|
|BINARY|DTYPE_BLOB|
|VARBINARY|DTYPE_BLOB|
|TINYBLOB|DTYPE_BLOB|
|TINYTEXT|DTYPE_CLOB|
|BLOB|DTYPE_BLOB|
|TEXT|DTYPE_CLOB|
|MEDIUMBLOB|DTYPE_BLOB|
|MEDIUMTEXT|DTYPE_CLOB|
|LONGBLOB|DTYPE_BLOB|
|LONGTEXT|DTYPE_CLOB|
|JSON|DTYPE_JSON|
|ENUM|DTYPE_VARCHAR|
|SET|DTYPE_VARCHAR|
|TINYINT UNSIGNED|DTYPE_SMALLINT|
|SMALLINT UNSIGNED|DTYPE_INTEGER|
|MEDIUMINT UNSIGNED|DTYPE_BIGINT|
|INT UNSIGNED|DTYPE_BIGINT|
|BIGINT UNSIGNED|DTYPE_NUMBER|


1、MySQL导出时，对部分时间和日期类型做了特殊处理，具体的特殊处理表现为：

1.1）、对于DATETIME和TIMESTAMP类型，若其值为“  0000-00-00 00:00:00.000000  ”时，会将值置为NULL。

1.2）、对于DATE类型，若其值为“  0000-00-00  ”，则会将其值置为NULL。

1.3）、对于YEAR类型，若其值经转换后为0（*(  CodInt32  *)  bind  ->  buffer   ==   0  ），则会将值置为NULL。

2、MySQL导出时，对于数据的大小限制为单列数据不能超过4M，否则导出会报错。对于lob类型的数据，若数据大小超过4M，则需要使用行外lob的方式导出，否则会报错。

3、Oracle导出时，为了兼容YashanDB，对部分数据类型做了特殊处理，具体的特殊处理的表现为：

3.1）若数据类型为NUMBER，则调用OCINumberToText以TM方式进行转换，数据需要满足相关要求。

3.2）若为Date类型，则以"  %04d-%02d-%02d %02d:%02d:%02d  "的格式输出年月日时分秒，其他信息，包括时区等，都不输出。

3.3）若为Timestamp或者TimestampTZ类型，则以"  %04d-%02d-%02d %02d:%02d:%02d.%06d  "的格式输出年月日时分秒毫秒，其他信息不输出。

3.4）若为InteralYM类型，则调用OCIIntervalToText转换后输出。

3.5）若为IntervalDS类型，则调用OCIIntervalToText转换后输出。

# 4. 特性

### 4.1 支持的参数选项

|参数名称|接口表现|
|:---|:---|
|-v, --version|显示版本号|
|--help|显示帮助信息|
|--engine|执行导出的数据库类型，取值范围 [Oracle, MySQL]|
|-h , --host|待导出的数据库的服务器地址|
|-P, --port|待导出的数据库的监听端口|
|-d, --database|执行导出的数据库实例名|
|-u ,  --user|数据库用户名， 系统用户或普通用户，普通用户需要具备访问系统表权限。|
|*-p, --password*|数据库用户密码。|
|--dba|是否以as dba的方式连接数据库，缺省时表示以非dba方式连接，仅当连接的数据库为ORACLE时生效。|
|*-f, --file*|CSV文件导出的导出路径加数据文件名，支持相对路径。若对应文件不存在则自动创建，若目录不存在则报错。若文件存在则覆盖。|
|-t, --table|指定执行导出的表名，仅支持单表，优先级低于--query。指定时可以带库名和模式名。|
|-q, --query|指定执行导出的数据库的查询语句。优先级高于 -t。|
|--log-path|指定生成的运行日志的文件路径，文件路径必须存在，支持相对路径，缺省时将在当前执行目录生成日志文件|
|--log-level|指定运行日志的日志级别，默认值为INFO,     取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|
|*--lob*|设置LOB数据的导出方式，取值范围为[CSV, LLS]， 默认值为LLS。    
  LLS表示将LOB数据和JSON数据另外导出至一个单独的文件，该文件路径与数据文件路径相同    
  CSV表示将LOB数据和JSON数据到当前CSV文件。|
|--outline-columns|设置行外导出的列，以引号包围，逗号作为分割，例: ”c1,c2“, 优先级比--lob高。对于query和table都会生效。限制真实表列，不包含投影列。如果设置的列表结构中不存在，不会报错。|
|--max-file-rows|指定每多少行拆分为一个数据文件。默认值为2000000。[1, INT32_MAX]|
|--max-file-size|指定多大拆分为一个数据文件。单位为Bytes,  默认值为1G。[1024, 1024G]  和file-rows谁先达到谁为准。|
|--buffer-size|指定数据缓冲区的内存大小，单位为Bytes,  默认值为1G。[64M - 64G]|
|--batch-size|指定单次fetch从服务端读取的行数，影响性能和内存使用, 默认值20480。 [1, INT32_MAX]|
|--character-set|指定连接目标数据库时使用的字符集。支持UTF8、GBK。  默认值UTF8。|
|--national-character-set|指定连接目标数据库时使用的国家字符集。支持UTF8、GBK。  默认值UTF8。仅oracle有效。|


### 4.2 使用方式

  `$ yasdts {Command Options}`  

  `示例：`  

  `yasdts --engine mysql --host 127.0.0.1 --port 3306 -u root -p 123456 -f ./test.csv --query "select * from dts.test"`  

### 2.4、开发自测设计

|用例编号|测试场景|预期|
|:---|:---|:---|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|


# 5.兼容性

不涉及

# 6.未来规划

# 7.附录

## Comments:

|  [](null)  ,会议时间：2024-07-10,与会人：杨萌、谢燕玲、范瑜、冯皓博、贺国锋,会议纪要：,1、多个列是导出到一个LLS文件中    
  2、--outline-columns的作用    
  3、buffer-size对于lob内容的影响。    
  4、暂时不考虑性能。    
  5、不支持的类型会直接报错。    
  6、确认下bacth_size对mysql lob的影响,7、分隔符、包围符和日期、时间戳格式保持现状，暂不提供参数设置。分隔符为逗号（，），包围符没有，时间个日期格式随服务端。,Posted by heguofeng at 七月 10, 2024 11:39|
|---|
