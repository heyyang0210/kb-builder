Created by 范瑜, last modified on 七月 11, 2024

# 1. 概述

IR：    [https://pingcode.yasdb.com/ship/ideas/6667ef6c5d57e18ea9d25513](https://pingcode.yasdb.com/ship/ideas/6667ef6c5d57e18ea9d25513)    ?    
  #YASHAN-2919 支持dts独立导出能力适配YMP

SR:    [https://pingcode.yasdb.com/pjm/items/66738c29288e197820a97cba](https://pingcode.yasdb.com/pjm/items/66738c29288e197820a97cba)    ?    
  #YDBRD-29426 【dts】dts支持命令行导出oracle/mysql数据到csv

需求来源：  内部需求

需求场景：

支持dts独立导出能力适配YMP

1. dts将数据导出成csv，支持oracle 11/19 和mysql 5.6/8.0
1. YMP当前是使用lib库的方式，利用java的jni调用方式，当出现问题时很难进行定位解决。


需求描述：

1、dts支持命令行模式运行，参考yasldr

2、支持oracle 11/19 和mysql 5.6/8.0

交付形态：  单机和集群

需求规格：无

# 2. 需求分析

## 2.1 功能点分析

（1）dst支持命令行导出oracle数据到指定csv文件，支持参数设置

（2）dst支持命令行导出mysql数据到指定csv文件，支持参数设置

使用方式：    `yasdts {Command Options}`  

  `yasdts --engine mysql --host 127.0.0.1 --port 3306 -u root -p 123456 -f ./test.csv --query "select * from dts.test"`  

新增命令参数：

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
|--max-file-rows|指定每多少行拆分为一个数据文件。默认值为2000000。[0, INT32_MAX]|
|--max-file-size|指定多大拆分为一个数据文件。单位为Bytes,  默认值为1G。 和file-rows谁先达到谁为准。|
|--buffer-size|指定数据缓冲区的内存大小，单位为Bytes,  默认值为1G。[64M - 64G]|
|--batch-size|指定单次fetch从服务端读取的行数，影响性能和内存使用, 默认值20480。 [4096, INT32_MAX]|
|--character-set|指定连接目标数据库时使用的字符集。支持UTF8、GBK。  默认值UTF8。|
|--national-character-set|指定连接目标数据库时使用的国家字符集。支持UTF8、GBK。  默认值UTF8。仅oracle有效。|


## 2.2 应用场景

（1）数据备份

## 2.3 规格约束

支持导出的数据类型：

（1）oracle

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


  


(2) mysql

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


  


# 3. 详细测试设计

## 3.1 测试设计方法

（1）功能类主要从数据库层面和工具层面进行分析，使用场景法进行测试

（2）工具层参数校验主要使用边界值和等价类方法进行测试

### 3.1.1 功能测试

（1）数据库层面

|序号|测试项|测试子项|观察点|备注|
|---|---|---|---|---|
|1|导出对象|1、表类型：非分区表、分区表、临时表、外部表、同义词,2、视图：系统视图、自定义视图、物化视图|导出成功，内容正确|默认其它参数是正确|
|2|列类型|oracle：,（1）内置数据类型,VARCHAR2(size [BYTE | CHAR]),NVARCHAR2(size),NUMBER [ (p [, s]) ],FLOAT [(p)],LONG,DATE,BINARY_FLOAT,BINARY_DOUBLE,TIMESTAMP [(fractional_seconds_precision)],TIMESTAMP [(fractional_seconds_precision)] WITH TIME ZONE,TIMESTAMP [(fractional_seconds_precision)] WITH LOCAL TIME ZONE,INTERVAL YEAR [(year_precision)] TO MONTH,INTERVAL DAY [(day_precision)] TO SECOND [(fractional_seconds_precision)],RAW(size),LONG RAW,ROWID,UROWID [(size)],CHAR [(size [BYTE | CHAR])],NCHAR[(size)],CLOB,NCLOB,BLOB,BFILE,  
,（2）用户自定义类型,Object Types,REF Data Types,Varrays,Nested Tables,  
,（3）Oracle-Supplied类型,Any Types：ANYTYPE、ANYDATA、ANYDATASET,XML Types：XMLType、URI Data Types、  HTTPURIType、XDBURIType、DBURIType、URIFactory Package,Spatial Types：SDO_GEOMETRY、SDO_TOPO_GEOMETRY、SDO_GEORASTER|（1）导出成功，内容正确,（2）导出报错，报错信息合理，等价覆盖,（3）除了xmltype，其它导出失败，等价覆盖|时间：,23：59：59,00：00：00 导出null,  
,包围符：双引号,分割符：逗号|
|3|  
|mysql：,（1）数值数据类型：,  [BIT[(M)]](https://dev.mysql.com/doc/refman/8.0/en/bit-type.html)  ,  [TINYINT[(M)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)  ,  [BOOL](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)    ,     [BOOLEAN](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)  ,  [SMALLINT[(M)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)  ,  [MEDIUMINT[(M)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)  ,  [INT[(M)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)  ,  [INTEGER[(M)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)  ,  [BIGINT[(M)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/integer-types.html)  ,  [DECIMAL[(M[,D])] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/fixed-point-types.html)  ,  [DEC[(M[,D])] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/fixed-point-types.html)    ,     [NUMERIC[(M[,D])] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/fixed-point-types.html)    ,     [FIXED[(M[,D])] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/fixed-point-types.html)  ,  [FLOAT[(M,D)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/floating-point-types.html)  ,  [FLOAT(p) [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/floating-point-types.html)  ,  [DOUBLE[(M,D)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/floating-point-types.html)  ,  [DOUBLE PRECISION[(M,D)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/floating-point-types.html)    ,     [REAL[(M,D)] [UNSIGNED] [ZEROFILL]](https://dev.mysql.com/doc/refman/8.0/en/floating-point-types.html)  ,  
,（2）日期和时间数据类型：,  [DATE](https://dev.mysql.com/doc/refman/8.0/en/datetime.html)  ,  [DATETIME[(fsp)]](https://dev.mysql.com/doc/refman/8.0/en/datetime.html)  ,  [TIMESTAMP[(fsp)]](https://dev.mysql.com/doc/refman/8.0/en/datetime.html)  ,  [TIME[(fsp)]](https://dev.mysql.com/doc/refman/8.0/en/time.html)  ,  [YEAR[(4)]](https://dev.mysql.com/doc/refman/8.0/en/year.html)  ,  
,（3）字符串数据类型,[NATIONAL] CHAR[(  *M*  )] [CHARACTER SET     *charset_name*  ] [COLLATE     *collation_name*  ],[NATIONAL] VARCHAR(  *M*  ) [CHARACTER SET     *charset_name*  ] [COLLATE     *collation_name*  ],  [BINARY[(M)]](https://dev.mysql.com/doc/refman/8.0/en/binary-varbinary.html)  ,  [TINYBLOB](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [TINYTEXT [CHARACTER SET charset_name] [COLLATE collation_name]](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [BLOB[(M)]](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [TEXT[(M)] [CHARACTER SET charset_name] [COLLATE collation_name]](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [MEDIUMBLOB](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [MEDIUMTEXT [CHARACTER SET charset_name] [COLLATE collation_name]](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [LONGBLOB](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [LONGTEXT [CHARACTER SET charset_name] [COLLATE collation_name]](https://dev.mysql.com/doc/refman/8.0/en/blob.html)  ,  [ENUM('value1','value2',...) [CHARACTER SET charset_name] [COLLATE collation_name]](https://dev.mysql.com/doc/refman/8.0/en/enum.html)  ,  [SET('value1','value2',...) [CHARACTER SET charset_name] [COLLATE collation_name]](https://dev.mysql.com/doc/refman/8.0/en/set.html)  ,  
,（4）JSON数据类型,  
,（5）空间数据类型,  `GEOMETRY/`    POINT/  LINESTRING/  POLYGON,MULTIPOINT/  MULTILINESTRING/MULTIPOLYGON/GEOMETRYCOLLECTION|（1）（2）（3）（4）导出成功，内容正确,（5）导出报错，报错信息合理，等价覆盖|  
|
|4|列值|null、空串、空格、数据类型边界值、自定义长度边界值,数值类型：-inf、nan、inf,,字符类型：空格、包含包围符、分隔符、特殊字符（表情包）、包含换行符、中文等,大对象类型：行内、行外|结合列类型测试，每个类型都要覆盖到|  
|
|5|列数|（1）宽表, 超过block的大小,（2）非宽表|不针对每个列类型进行测试，对列类型进行组合，导出成功，内容正确|  
|
|6|权限|1、表所属用户与登录用户一致,2、表所属用户（sql语句带schema）与登录用户不一致,（1）登录用户有表的select 权限,（2）登录用户无表的select权限|1、导出成功，导出内容正确,2、,（1）导出成功，导出内容正确,（2）导出报错，报错信息合理|  
|
|7|数据库资源|1、资源充足下导出,2、资源不足下导出|1、导出成功,2、导出报错，报错信息合理|  
|
|8|数据库版本|（1）oracle 11/19 ,（2）mysql 5.6/8.0|导出成功，导出内容正确|先测试高版本，再测试低版本|
|9|其它|本地、远程导出|导出成功，导出内容正确|  
|


  


（2）工具层面

|参数|作用|有效类|观察点|无效类|观察点|
|---|---|---|---|---|---|
|-v, --version|显示版本号|1、-v， --version,2、  不写全，比如：--vers|打印版本信息正确|1、大写、大小写混合,2、前缀包含等，如：--version1| 报错信息合理|
|--help|显示帮助信息|1、--help,2、yasdts直接回车|1、2打印帮助信息正确|1、大写、大小写混合|报错信息合理|
|--engine|执行导出的数据库类型，取值范围 [Oracle, MySQL]|1、--engine,2、值：,（1）oralce,（2）mysql,大写、大小写混合、小写|导出成功，导出内容正确|1、命令大小写,2、值：,（1）非取值范围,（2）空格、空串等|报错信息合理|
|-h , --host|待导出的数据库的服务器地址|1、-h --host,2、值：,（1）ip地址,（2）主机名：英文、  中文  等|导出成功，导出内容正确|1、命令大小写,2、值：,（1）ip格式不对、ip不存在等,（2）空串、空格等|报错信息合理|
|-P, --port|待导出的数据库的监听端口|1、-P, --port,2、值：,端口号范围内|导出成功，导出内容正确|1、命令大小写,2、值：,（1）端口号范围外,（2）int32最大值|报错信息合理|
|-d, --database|执行导出的数据库实例名|1、-d, --database,2、值：,（1）长度：oracle/mysql数据库实例名规格限制,（2）内容：oracle/mysql数据库实例名规格限制|导出成功，导出内容正确|1、命令大小写,2、值：,（1）不存在,（2）空串、空格等|报错信息合理|
|-u ,  --user|数据库用户名， 系统用户或普通用户，普通用户需要具备访问系统表权限。|1、-u ,  --user,2、值：,（1）长度：oracle/mysql用户名规格限制,（2）内容：oracle/mysql用户名规格限制,3、功能：,（1）dba用户,（2）普通用户，有最小权限:select 权限|导出成功，导出内容正确|1、命令大小写,2、值：,（1）不存在,（2）空串、空格等,3、功能：,（1）无权限|报错信息合理|
|*-p, --password*|数据库用户密码。|1、-p, --password,2、值：,（1）长度：oracle/mysql密码规格限制,（2）内容：oracle/mysql密码规格限制|导出成功，导出内容正确|1、命令大小写,2、值：,（1）不存在,（2）空串、空格等|报错信息合理|
|--dba|是否以as dba的方式连接数据库，缺省时表示以非dba方式连接，仅当连接的数据库为ORACLE时生效。|1、-–dba,2、功能：,（1）dba用户以as dba方式登录,（2）普通用户以as dba方式登录,（3）engine为mysql时指定|导出成功，导出内容正确|1、命令大小写,2、后面跟着其它参数值，,比如：–dba  test|报错信息合理|
|*-f, --file*|CSV文件导出的导出路径加数据文件名，支持相对路径。若对应文件不存在则自动创建，若目录不存在则报错。若文件存在则覆盖。|1、  *-f, --file*,2、路径,（1）内容：带有中文或者特殊字符，比如点等,（2）形式：,相对路径：,- (单个点)：表示当前目录
- ..(双点)：表示父目录
- 带点： /data/./data
- 带双点：/data/../data
,绝对路径,（3）长度：小于256,（4）权限：有wx权限,（5）文件是否存在：存在、不存在|导出成功，导出内容正确|1、命令大小写,2、路径：,（3）长度：大于256,（4）权限：有目录权限无文件wx权限； 无目录权限,（5）文件是否存在：目录不存在,（6）指定的是目录,（7）空串、空格等|报错信息合理|
|-t, --table|指定执行导出的表名，仅支持单表，优先级低于--query。指定时可以带库名和模式名。|1、-t, --table,2、值：,（1）中文、英文大小写、带特殊字符比如：单双引号,（2）带schema/数据库名：,- 与登录用户名一致
- 与登录用户不一致
,（3）长度：oracle/mysql用户名规格限制|导出成功，导出内容正确|1、命令大小写,2、值:,（1）表不存在,（2）带错误的schema和数库名,（3）空串、空格等|报错信息合理|
|-q, --query|指定执行导出的数据库的查询语句。优先级高于 -t。|1、-q, --query,2、  sql语句类型: dql,3、dql操作类型：连接查询，指定分区，简单覆盖,4、投影列形式：表列、常量、伪劣、表达式,5、投影类型：覆盖支持的类型,6、  null、数据类型边界值、特殊值、存在换行、包含分隔符或者包围符、存在需要转义的字符等,7、  投影列值长度：  数据类型长度、大对象类型：行内、行外等,8、查询条件：包含中文、单双引号、特殊字符等,9、sql语句内容：,（1）单纯sql语句,（2）带有注释， 覆盖：英文、中文、sql语句等,10、sql语句长度：不大于2M,11、同时指定query和table|导出成功，导出内容正确|1、命令大小写,2、  sql语句类型：ddl、dml、dcl、plsql,3、空串、空格等,4、  sql语句长度大于2M,5、非sql语句|报错信息合理|
|--log-path|指定生成的运行日志的文件路径，文件路径必须存在，支持相对路径，缺省时将在当前执行目录生成日志文件|1、--log-path,2、路径,（1）内容：带有中文或者特殊字符，比如点等,（2）形式：,相对路径：,- (单个点)：表示当前目录
- ..(双点)：表示父目录
- 带点： /data/./data
- 带双点：/data/../data
,绝对路径,（3）长度：小于256,（4）权限：有wx权限,（5）文件是否存在：存在、不存在|导出成功，导出内容正确|1、命令大小写,2、路径：,（3）长度：大于256,（4）权限：有目录权限无文件wx权限； 无目录权限,（5）文件是否存在：目录不存在,（6）指定的是目录,（7）空串、空格等|报错信息合理|
|--log-level|指定运行日志的日志级别，默认值为INFO,     取值范围为[OFF, ERROR, WARN, INFO, DEBUG, TRACE]|1、--log-level,2、值：,（1）[OFF, ERROR, WARN, INFO, DEBUG, TRACE],（2）大小写,构造对应日志级别信息，观察日志内容|导出成功，日志内容正确|1、命令大小写,2、值:,（1）  空串、空格,（2）其它字符串|报错信息合理|
|*--lob*|设置LOB数据的导出方式，取值范围为[CSV, LLS]， 默认值为LLS。    
  LLS表示将LOB数据和JSON数据另外导出至一个单独的文件，该文件路径与数据文件路径相同    
  CSV表示将LOB数据和JSON数据到当前CSV文件。|1、--lob,2、值：csv、lls,3、功能，覆盖csv、lls：    
  （1）单列、多列lob,（2）lob长度：行内、行外,（3）  lob文件的命名？test.csv  生成test.lob,（4）lob内容：中英文、表情包、特殊字符等|导出成功，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）其它字符串,  
|报错信息合理|
|--outline-columns|设置行外导出的列，以引号包围，逗号作为分割，例: ”c1,c2“, 优先级比--lob高。对于query和table都会生效。限制真实表列，不包含投影列。如果设置的列表结构中不存在，不会报错。|1、--outline-columns,2、功能：,（1）单列、多列：列规格、重复列  c1,c1（只导出一个）,（2）列名：中文 、英文大小写、包含单双引号逗号等特殊字符， 逗号后列缺失，如："c1, ",（3）总的列长度：  有长度限制吗？限制2M,（4）结合--table：指定部分列、所有列，只针对lob类型，其它类型不生效,（5）结合--query：有交集、无交集、不存在的列,（6）结合–lob：csv、lls,（7）同时指定--table、--query|导出成功，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）其它字符串|报错信息合理|
|--max-file-rows|指定每多少行拆分为一个数据文件。默认值为2000000。(0, INT32_MAX]|1、--max-file-rows,2、值：默认、最小值、中间值、最大值,3、功能：,（1）结合表实际行数：表实际行数大于、小于、等于max-file-rows,（2）结合–table、–query,（3）科学计数法  (支持),  
|导出成功，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）非数值,（3）数值：浮点数、超过int32|报错信息合理|
|--max-file-size|指定多大拆分为一个数据文件。单位为Bytes,  默认值为1G。 和file-rows谁先达到谁为准。|1、--max-file-size,2、值：默认、最小值、中间值、最大值,3、功能：,（1）普通类型、大对象类型,（2）--max-file-rows和--max-file-size关系：max-file-rows总行大小等于、小于、大于--max-file-size,（3）在max-file-rows总行大小大于max-file-size前提下，表实际行数大小与max-file-size关系：大于、小于、等于max-file-rows,（4）行完整性：一行的大小小于、等于、大于max-file-size,（5）值完整性：达到max-file-size时，刚好是单字节字符、多字节字符|导出成功，拆分文件正确，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）非数值,（3）数值：浮点数、超过int32、科学计数法|报错信息合理|
|--buffer-size|指定数据缓冲区的内存大小，单位为Bytes,  默认值为1G。[64M - 64G]|1、buffer-size,2、值：默认、最小值、中间值、最大值,3、功能：,（1）普通类型、大对象类型,（2）表行数大小与buffer-size的关系：大于、等于、小于,（3）表数据大小大于buffer-size前提下：刚好时单字节字符、多字节字符,（4）结合max-file-rows、max-file-size：大于、等于、小于|导出成功，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）非数值,（3）数值：浮点数、超过int32、科学计数法|报错信息合理|
|--batch-size|指定单次fetch从服务端读取的行数，影响性能和内存使用, 默认值20480。 [4096, INT32_MAX]|1、batch-size,2、值：默认、最小值、中间值、最大值,3、功能：,（1）普通类型、大对象类型,（2）结合max-file-rows、max-file-size：大于、等于、小于,（3）结合buffer-size：一次fetch的大小小于、等于、大于buffer-size|导出成功，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）非数值,（3）数值：浮点数、超过int32、科学计数法|报错信息合理|
|--character-set|指定连接目标数据库时使用的字符集。支持UTF8、GBK。  默认值UTF8。|1、--character-set,2、值：默认、utf8、gbk,3、功能：,（1）普通类型、大对象类型,（2）数据库字符集与character-set关系：一致、不一致|导出成功，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）非数值,（3）数值：浮点数、超过int32、科学计数法|报错信息合理|
|--national-character-set|指定连接目标数据库时使用的国家字符集。支持UTF8、GBK。  默认值UTF8。仅oracle有效。|1、--national-character-set,2、值：默认、utf8、gbk,3、功能：,（1）普通类型、大对象类型,（2）数据库字符集与character-set关系：一致、不一致|导出成功，导出内容正确|1、命令大小写,2、值：,（1）空串、空格,（2）非数值,（3）数值：浮点数、超过int32、科学计数法|报错信息合理|


### 3.1.2 并发测试

异常情况下关注一下是否有内存泄露

|序号|测试场景|预期结果|
|---|---|---|
|1|导出与ddl并发|存在以下情况：,（1）导出成功，ddl失败,（2）导出失败，ddl成功,  
|
|2|导出与dml并发|存在以下情况：,（1）导出成功，dml失败,（2）导出失败，dml成功|
|3|导出与dql并发|导出成功和dql成功|


### 3.1.3 异常测试

|序号|测试场景|预期结果|
|---|---|---|
|1|导出过程中磁盘满， 覆盖：导出文件大小小于、大于buffer-size|导出报错，进程正常退出|
|2|导出过程中ctrl+c|进程正常退出|
|3|导出过程中节点异常|导出报错，进程正常退出|


### 3.1.4 性能/大数据量测试

|序号|测试场景|预期结果|
|---|---|---|
|1|tpch模型导出，覆盖oracle/mysql|摸底，无性能要求|
|2|lob模型导出，覆盖oracle/mysql|摸底，无性能要求|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
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
|性能|  
|  
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


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：



  


## Comments:

|  [](null)  ,会议纪要：    
  与会人：贺国峰、冯皓博、陈钦卿、范瑜    
  评审时间：2024.07.11 14:30:00    
  评审地点：线上会议    
  评审纪要信息：    
  1、  关注是否有内存泄露  ,2、lob文件的命名？test.csv  生成test.lob,Posted by fanyu at 七月 11, 2024 15:00|
|---|
