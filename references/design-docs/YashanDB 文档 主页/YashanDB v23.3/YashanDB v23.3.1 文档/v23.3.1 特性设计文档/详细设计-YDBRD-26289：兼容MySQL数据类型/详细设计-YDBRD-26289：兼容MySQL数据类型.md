Created by 林永豪, last modified on 七月 11, 2024

*IR链接：*    [YASHAN-926](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ee? #YASHAN-926  【mysql兼容】支持特定的数据类型&规格)  

*SR链接：*    [YDBRD-26289](https://pingcode.yasdb.com/pjm/items/66191837fd997db58ad898c0? #YDBRD-26289 兼容MySQL数据类型)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

1、mysql兼容性开发暂不支持存储过程，所以数据类型不适配存储过程中的使用场景（udt、匿名块等PL/SQL过程体）。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

2024-07-08  **刷新**

|  
|MySQL类型|兼容总结|是否可用于对象命名|文档链接|映射Yashan类型|对齐Yashan规格，不做规格调整|规格差异|
|---|---|---|---|---|---|---|---|
|1|BINARY  [(M)]|1.实现时，映射为yashan的RAW类型,2.实现时，列宽度范围0~255字节，256字节及以上报错,3.省略M时长度为1字节,4.mysql的binary类型会补0x00，现阶段实现先不补0x00,5.同义词：  CHAR BYTE，后面不能跟宽度，固定映射成RAW(1)|否|  [MYSQL-The BINARY and VARBINARY Types](https://dev.mysql.com/doc/refman/5.7/en/binary-varbinary.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |BINARY(即RAW),  
,char?,建议对齐,create table代码带出|是|1.Mysql：,BINARY[(M)]：0~255 bytes,  
,mysql> create table tb1(c1 binary(20));    
  Query OK, 0 rows affected (0.01 sec),mysql> insert into tb1 values('12345');    
  Query OK, 1 row affected (0.00 sec),mysql> insert into tb1 values('中文');    
  Query OK, 1 row affected (0.00 sec),mysql> select * from tb1;    
  +----------------------+    
  | c1 |    
  +----------------------+    
  | 12345 |    
  | 中文 |    
  +----------------------+    
  2 rows in set (0.00 sec),mysql> select length(c1) from tb1;    
  +------------+    
  | length(c1) |    
  +------------+    
  | 20 |    
  | 20 |    
  +------------+    
  2 rows in set (0.00 sec),  
,长度是定长，但映射成raw的话求长度是变长长度,  
,2.Yashan：,底层用raw类型表示，raw的column size范围是[1,8000],实现上，超过255是否报错需确认，0是否支持需确认,  
|
|2|VARBINARY  [(M)]|1.实现时，映射为yashan的RAW类型,2.实现时，列宽度范围0~8000字节，8001字节及以上报错,~~3.32001~65535字节报错~~,3.建表时M不能省略，否则会报错。|否|  [MYSQL-The BINARY and VARBINARY Types](https://dev.mysql.com/doc/refman/5.7/en/binary-varbinary.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |BINARY(即RAW),  
,VARCHAR,  
,32K~64K不支持|是|1.Mysql：,VARBINARY[(M)]：0~65535 bytes,  
,mysql> create table tb2(c1 varbinary(20));    
  Query OK, 0 rows affected (0.00 sec),mysql> insert into tb2 values('12345');    
  Query OK, 1 row affected (0.00 sec),mysql> insert into tb2 values('中文');    
  Query OK, 1 row affected (0.00 sec),mysql> select * from tb2;    
  +--------+    
  | c1 |    
  +--------+    
  | 12345 |    
  | 中文 |    
  +--------+    
  2 rows in set (0.00 sec),mysql> select length(c1) from tb2;    
  +------------+    
  | length(c1) |    
  +------------+    
  | 5 |    
  | 6 |    
  +------------+    
  2 rows in set (0.00 sec),  
,2.Yashan：,底层用raw类型表示，raw的column size范围是[1,8000],实现上，超过8000是否报错需确认，0是否支持需确认|
|3|CHAR  [(M)]|1.实现时，映射为yashan的char类型,2.实现时，列宽度范围0~255字符，256字符及以上报错,3.省略M时长度为1字符,4.同义词：CHARACTER|否|  [MYSQL-The CHAR and VARCHAR Types](https://dev.mysql.com/doc/refman/5.7/en/char.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |CHAR,  
,各类型别名需要排查，支持上|是|1.Mysql：,[0,255]，如果省略M，则长度为1。,当存储CHAR值时，MySQL将其值与空格填充到声明的长度。,当查询CHAR值时，MySQL会删除尾部的空格（启用PAD_CHAR_TO_FULL_LENGTH SQL模式，MySQL将不会删除尾随空格）。,  
,2.Yashan：,存储：<br>1~32000Bytes<br>运算：<br>1~32000Bytes,  
,1、支持的大小/bytes不同,2、MySQL CHAR(M)支持CHAR(0)，而YashanDB暂不支持CHAR(0)|
|4|VARCHAR  [(M)]|1.实现时，映射为yashan的varchar类型,2.实现时，列宽度范围0~8000字符，8001字符及以上报错,3.建表时M不能省略，否则会报错。,4.同义词：CHARACTER VARYING|否|  [MYSQL-The CHAR and VARCHAR Types](https://dev.mysql.com/doc/refman/5.7/en/char.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |VARCHAR,  
,32K~64K不支持|是|1.Mysql：,[0,65535]，M不能省略，否则会报错。,MySQL将VARCHAR值作为1字节或2字节长度前缀加上实际数据。列不超过255个字节，则长度前缀为1个字节。 如果列超过255个字节，长度前缀是两个长度字节。 ,VARCHAR的有效最大长度与所使用的字符集有关。例如，utf8字符每个字符最多需要三个字节，因此可以将使用utf8字符集的VARCHAR列声明为最多21844个字符。,VARCHAR值在存储时不会被填充，在存储和查询值时保留尾随空格。,  
,2.Yashan：,存储：<br>1~32000Bytes<br>运算：<br>1~32000Bytes,  
,1、支持的大小/bytes不同,2、MySQL VARCHAR(M)支持VARCHAR(0)，而YashanDB暂不支持VARCHAR(0)|
|5|NCHAR|1.实现时，映射为yashan的NCHAR类型,2.实现时，列宽度范围0~255字符，256字符及以上报错,3.省略M时长度为1字节,4.同义词：  NATIONAL CHAR、NATIONAL CHARACTER|是|  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |NCHAR|是|1.Mysql：,[0,255]，如果省略M，则长度为1。,NATIONAL/NCHAR/NVARCHAR表示字符集UTF8MB3，它将被UTF8MB4所取代，请考虑使用语法：CHAR(M)  CHARACTER SET UTF8MB4,  
,2.Yashan：,存储：<br>1~4000Bytes<br>运算：<br>1~32000Bytes,列存无此类型,  
,1、支持的大小/bytes不同,2、MySQL NCHAR(M)支持NCHAR(0)，而YashanDB暂不支持NCHAR(0)|
|6|NVARCHAR|1.实现时，映射为yashan的NVARCHAR类型,2.实现时，列宽度范围0~8000字符，8001字符及以上报错,3.建表时M不能省略，否则会报错。,4.同义词：  NATIONAL   VARCHAR、NATIONAL CHARACTER VARYING|是|  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |NVARCHAR|是|1.Mysql：,[0,65535]，M不能省略，否则会报错。,NATIONAL/NCHAR/NVARCHAR表示字符集UTF8MB3，它将被UTF8MB4所取代，请考虑使用语法：CHAR(M)  CHARACTER SET UTF8MB4,  
,2.Yashan：,存储：<br>1~16000Bytes<br>运算：<br>1~32000Bytes,列存无此类型,  
,1、支持的大小/bytes不同,2、MySQL NVARCHAR(M)支持NVARCHAR(0)，而YashanDB暂不支持NVARCHAR(0)|
|7|TINYBLOB|1.实现时，映射为yashan的BLOB类型,2.存长度为0~255字符的十六进制字符串，256字符及以上报错,  
,例：,insert into t1 values(lpad(1,510,1));可以执行成功,字符串转blob，两个十六进制字符转成1字节来存储|否|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |BLOB|是|1.Mysql：,类型支持长度：0~255 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE  (empty lob可以为0),列存：1 ~ 32000Byte|
|8|BLOB|1.实现时，映射为yashan的BLOB类型,2.存长度为0~65535字符的十六进制字符串，65536字符及以上报错,  
|否|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |BLOB|是|1.Mysql：,类型支持长度：0~65535 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE (empty lob可以为0),列存：1 ~ 32000Byte|
|9|MEDIUMBLOB|1.实现时，映射为yashan的BLOB类型,2.存长度为0~16777215字符的十六进制字符串，16777216字符（2的24次方）及以上报错|否|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |BLOB|是|1.Mysql：,类型支持长度：0~16777215 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE (empty lob可以为0),列存：1 ~ 32000Byte|
|10|LONGBLOB|1.实现时，映射为yashan的BLOB类型,2.存长度为0~4294967295字符的十六进制字符串，4294967296字符及以上报错|否|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |BLOB|是|1.Mysql：,类型支持长度：0~4294967295 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE (empty lob可以为0),列存：1 ~ 32000Byte|
|11|TINYTEXT|1.实现时，映射为yashan的CLOB类型,2.存长度为0~255字符的字符串，256字符及以上报错|否|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |CLOB|是|1.Mysql：,类型支持长度：,0~255 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE (empty lob可以为0),列存：1 ~ 32000Byte|
|12|TEXT|1.实现时，映射为yashan的CLOB类型,2.存长度为0~65535字符的字符串，65536字符及以上报错|是|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [Mysql存储规格](https://dev.mysql.com/doc/refman/8.0/en/storage-requirements.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  ,  
|CLOB|是|1.Mysql：,类型支持长度：,0~65535 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE (empty lob可以为0),列存：1 ~ 32000Byte|
|13|MEDIUMTEXT|1.实现时，映射为yashan的CLOB类型,2.存长度为0~16777215字符的字符串，16777216字符（2的24次方）及以上报错|否|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |CLOB|是|1.Mysql：,类型支持长度：,0~16777215 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE (empty lob可以为0),列存：1 ~ 32000Byte|
|14|LONGTEXT|1.实现时，映射为yashan的CLOB类型,2.存长度为0~4294967295字符的字符串，4294967296字符及以上报错|否|  [MYSQL-The BLOB and TEXT Types](https://dev.mysql.com/doc/refman/5.7/en/blob.html)  ,  [MySQL数据类型与YashanDB规格差异-字符串类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E5%AD%97%E7%AC%A6%E4%B8%B2%E7%B1%BB%E5%9E%8B)  |CLOB|是|1.Mysql：,类型支持长度：,0~4294967295 bytes,  
,2.Yashan：,行存：1~4G*DB_BLOCK_SIZE (empty lob可以为0),列存：1 ~ 32000Byte|
|15|MEDIUMINT|1.实现时，映射为yashan的integer类型,2.整型范围是 -8388608~8388607。小于 -8388608或者大于8388607时报错。|否|  [MYSQL-Integer Types (Exact Value) - INTEGER, INT, SMALLINT, TINYINT, MEDIUMINT, BIGINT](https://dev.mysql.com/doc/refman/5.7/en/integer-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |INTEGER|是|1.Mysql：,类型宽度：3,取值范围：[  -8388608 , 8388607  ],  
,2.Yashan：,类型宽度：4,取值范围 [-2,147,483,648 , 2,147,483,647]|
|16|TINYINT|1.实现时，映射为yashan的tinyint类型,2.语法兼容设置M的语法形式，但实际功能不支持|否|  [MYSQL-Integer Types (Exact Value) - INTEGER, INT, SMALLINT, TINYINT, MEDIUMINT, BIGINT](https://dev.mysql.com/doc/refman/5.7/en/integer-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |TINYINT|是|~~无差异~~,1.实现时，映射为yashan的tinyint类型,2.语法兼容设置M的语法形式，但实际功能不支持|
|17|SMALLINT|1.实现时，映射为yashan的smallint类型,2.语法兼容设置M的语法形式，但实际功能不支持|否|  [MYSQL-Integer Types (Exact Value) - INTEGER, INT, SMALLINT, TINYINT, MEDIUMINT, BIGINT](https://dev.mysql.com/doc/refman/5.7/en/integer-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |SMALLINT|是|~~无差异~~,1.实现时，映射为yashan的smallint类型,2.语法兼容设置M的语法形式，但实际功能不支持|
|18|INTEGER|1.实现时，映射为yashan的integer类型,2.语法兼容设置M的语法形式，但实际功能不支持|否|  [MYSQL-Integer Types (Exact Value) - INTEGER, INT, SMALLINT, TINYINT, MEDIUMINT, BIGINT](https://dev.mysql.com/doc/refman/5.7/en/integer-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |INTEGER|是|~~无差异~~,1.实现时，映射为yashan的integer类型,2.语法兼容设置M的语法形式，但实际功能不支持|
|19|BIGINT|1.实现时，映射为yashan的bigint类型,2.语法兼容设置M的语法形式，但实际功能不支持|否|  [MYSQL-Integer Types (Exact Value) - INTEGER, INT, SMALLINT, TINYINT, MEDIUMINT, BIGINT](https://dev.mysql.com/doc/refman/5.7/en/integer-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |BIGINT|是|~~无差异~~,1.实现时，映射为yashan的bigint类型,2.语法兼容设置M的语法形式，但实际功能不支持|
|20|DECIMAL[(M[,D])]   |1.实现时，映射为yashan的number类型,2.M和D按yashan的number规格处理,3.  如果省略M，则默认为10。如果省略D，则默认为0（问题单29748，待修改）|否|  [MYSQL-Fixed-Point Types (Exact Value) - DECIMAL, NUMERIC](https://dev.mysql.com/doc/refman/5.7/en/fixed-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |NUMBER,  
,按yashan规格处理|是|  
|
|21|DEC[(M[,D])] |1.实现时，映射为yashan的number类型,2.M和D按yashan的number规格处理,3.  如果省略M，则默认为10。如果省略D，则默认为0（问题单29748，待修改）|否|  [MYSQL-Fixed-Point Types (Exact Value) - DECIMAL, NUMERIC](https://dev.mysql.com/doc/refman/5.7/en/fixed-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |NUMBER,  
,按yashan规格处理|是|1.Mysql：,DECIMAL[(M[,D])]   ，M是总位数，D是小数点后的位数,M的范围为[1,65]，D的范围[0,30]，  并且D <= M,如果省略M，则默认为10。如果省略D，则默认为0,  
,2.Yashan：,20 Bytes,P:取值范围[1,38],S:取值范围[-84,127]|
|22|NUMERIC[(M[,D])]|1.实现时，映射为yashan的number类型,2.M和D按yashan的number规格处理,3.  如果省略M，则默认为10。如果省略D，则默认为0（问题单29748，待修改）|否|  [MYSQL-Fixed-Point Types (Exact Value) - DECIMAL, NUMERIC](https://dev.mysql.com/doc/refman/5.7/en/fixed-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |NUMBER,  
,按yashan规格处理|是|1.Mysql：,DECIMAL[(M[,D])]   ，M是总位数，D是小数点后的位数,M的范围为[1,65]，D的范围[0,30]，  并且D <= M,如果省略M，则默认为10。如果省略D，则默认为0,  
,2.Yashan：,20 Bytes,P:取值范围[1,38],S:取值范围[-84,127]|
|23|FIXED[(M[,D])]|1.实现时，映射为yashan的number类型,2.M和D按yashan的number规格处理,3.  如果省略M，则默认为10。如果省略D，则默认为0（问题单29748，待修改）|是|  [MYSQL-Fixed-Point Types (Exact Value) - DECIMAL, NUMERIC](https://dev.mysql.com/doc/refman/5.7/en/fixed-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |NUMBER,  
,按yashan规格处理|是|1.Mysql：,DECIMAL[(M[,D])]   ，M是总位数，D是小数点后的位数,M的范围为[1,65]，D的范围[0,30]，  并且D <= M,如果省略M，则默认为10。如果省略D，则默认为0,  
,2.Yashan：,20 Bytes,P:取值范围[1,38],S:取值范围[-84,127]|
|24|FLOAT,FLOAT[(M,D)]|1.实现时，映射为yashan的float类型,2.实现时，对齐yashan的规格（yashan float比mysql float的规格大）,3.语法兼容设置M和D的语法形式，但实际功能不支持|否|  [MYSQL-Floating-Point Types (Approximate Value) - FLOAT, DOUBLE](https://dev.mysql.com/doc/refman/5.7/en/floating-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |FLOAT|  
|  
|
|25|FLOAT(p)|对齐mysql：,如果p从0到24，则数据类型变为FLOAT,如果p从25到53，则数据类型变为DOUBLE|否|  [MYSQL-Floating-Point Types (Approximate Value) - FLOAT, DOUBLE](https://dev.mysql.com/doc/refman/5.7/en/floating-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |FLOAT/DOUBLE|  
|  
|
|26|DOUBLE PRECISION  [(M,D)]   |1.实现时，映射为yashan的double类型,2.语法兼容设置M和D的语法形式，但实际功能不支持|double，否|  [MYSQL-Floating-Point Types (Approximate Value) - FLOAT, DOUBLE](https://dev.mysql.com/doc/refman/5.7/en/floating-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |DOUBLE,  
,语法兼容，实际M/D功能不支持|是|  
|
|27|REAL[(M,D)]|1.实现时，映射为yashan的double类型,2.语法兼容设置M和D的语法形式，但实际功能不支持|否|  [MYSQL-Floating-Point Types (Approximate Value) - FLOAT, DOUBLE](https://dev.mysql.com/doc/refman/5.7/en/floating-point-types.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |DOUBLE,  
,语法兼容，实际M/D功能不支持,按默认情况|是|1、YashanDB已兼容MySQL的  REAL[(M,D)]     语法，但不产生任何功能作用，比如SQL语句：,create table t7(c1 real(2,1));,insert into t7 values(21.13);,MySQL会报错：Out of range value for column 'c1',YashanDB不会报错,2、MySQL  在默认情况下，REAL和REAL[(M,D)]]被  视为  DOUBLE  的同义词，启用REAL_AS_FLOAT模式，REAL和REAL[(M,D)]被视为FLOAT的同义词，而YashanDB的REAL被视为FLOAT的同义词，REAL[(M,D)]的M超过23则被视为DOUBLE同义词|
|28|BOOLEAN|1.实现时，映射为yashan的tinyint类型|是,bool，是|  [MySQL-Numeric Data Type Syntax](https://dev.mysql.com/doc/refman/5.7/en/numeric-type-syntax.html)  ,  [MySQL数据类型与YashanDB规格差异-数字数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%95%B0%E5%AD%97%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B)  |TINYINT|是|1.Mysql：,[-128 , 127]，TINYINT(1)同义词，支持输入：  0/1，'0'/'1'，true/false；不支持输入字符串：'true'/'false'，' t'/'f'， 'on'/'off'， 'yes'/'no',  
,2.Yashan：,支持的输入：0/1；字符串'true'/'false',' t'/'f', 'on'/'off', 'yes'/'no', '0'/'1'，true/false；非零整数（同BIGINT规格相同）|
|29|DATE|1.实现时，映射成yashan的date类型,2.实现时，对齐yashan的date规格|是|  [MySQL-The DATE, DATETIME, and TIMESTAMP Types](https://dev.mysql.com/doc/refman/5.7/en/datetime.html)  ,  [MySQL数据类型与YashanDB规格差异-时间类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%97%A5%E6%9C%9F%E5%92%8C%E6%97%B6%E9%97%B4%E7%B1%BB%E5%9E%8B)  |DATE,  
,yashan现在不支持（预留的shortdate）,  
,后续：带时间的format和不带的format两套控制|是,  
,  
|1、YashanDB DATE类型包含MySQL DATE类型,2、大小/bytes有差异，MySQL DATE是3 Bytes，而YashanDB是  8 Bytes,3、范围也有差异，MySQL DATE的范围是  [1000-01-01,9999-12-31]，而YashanDB的范围是[1000-01-01 00:00:00 , 9999-12-31 23:59:59]|
|30|DATETIME  [(fsp)]|1.实现时，映射成yashan的timestamp类型,2.实现时，对齐yashan的timestamp规格,（yashan timestamp比mysql timestamp的规格大）|是|  [MySQL-The DATE, DATETIME, and TIMESTAMP Types](https://dev.mysql.com/doc/refman/5.7/en/datetime.html)  ,  [MySQL数据类型与YashanDB规格差异-时间类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%97%A5%E6%9C%9F%E5%92%8C%E6%97%B6%E9%97%B4%E7%B1%BB%E5%9E%8B)  |~~DATE~~,timestamp|是|1、YashanDB暂不支持MySQL   DATETIME类型，但MySQL DATETIME类型可以映射成YashanDB的DATE类型，前提是YashanDB需要启动YYYY-MM-DD hh:mm:ss日期格式,2、YashanDB暂不支持MySQL   DATETIME[(fsp)]  类型，但MySQL DATETIME[(fsp)]类型可以映射成YashanDB的  TIMESTAMP  类型|
|31|TIME  [(fsp)]|1.实现时，映射成yashan的time类型,2.实现时，对齐yashan的time规格,（yashan time比mysql time的规格小）|是|  [MySQL-The TIME Type](https://dev.mysql.com/doc/refman/5.7/en/time.html)  ,  [MySQL数据类型与YashanDB规格差异-时间类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%97%A5%E6%9C%9F%E5%92%8C%E6%97%B6%E9%97%B4%E7%B1%BB%E5%9E%8B)  |TIME,  
,yashan现在不支持|是|1、MySQL 支持TIME以及TIME  (fsp)类型，而  YashanDB只支持TIME类型，但不支持TIME  (fsp)类型,2、MySQL   TIME范围是：[-838:59:59.000000,838:59:59.000000]，而YashanDB TIME范围是：[  00:00:00.000000  ,  23:59:59.999999  ]，因此MySQL TIME范围包含了YashanDB TIME范围|
|32|TIMESTAMP  [(fsp)]|1.实现时，映射成yashan的timestamp类型,2.实现时，对齐yashan的timestamp规格,（yashan timestamp比mysql timestamp的规格大）|是|  [MySQL-The DATE, DATETIME, and TIMESTAMP Types](https://dev.mysql.com/doc/refman/5.7/en/datetime.html)  ,  [MySQL数据类型与YashanDB规格差异-时间类型](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162#MySQL数据类型与YashanDB规格差异-%E6%97%A5%E6%9C%9F%E5%92%8C%E6%97%B6%E9%97%B4%E7%B1%BB%E5%9E%8B)  |TIMESTAMP|是|YashanDB   TIMESTAMP  [(fsp)]类型包含MySQL TIMESTAMP[(fsp)]类型|
|33|bit|不在本sr的范围中，目前需求池中未接纳相关需求|是|  
|  
|  
|  
|
|34|serial|不在本sr的范围中，目前需求池中未接纳相关需求|是|  
|  
|  
|  
|
|35|enum|不在本sr的范围中，迭代四支持，,  [https://pingcode.yasdb.com/pjm/items/6622457bfd997db58ade16be](https://pingcode.yasdb.com/pjm/items/6622457bfd997db58ade16be)    ?    
  #YDBRD-26536 行执行引擎支持Enum\Set类型的运算|暂不考虑|  
|  
|  
|  
|
|36|set|不在本sr的范围中，,  [https://pingcode.yasdb.com/pjm/items/6622457bfd997db58ade16be](https://pingcode.yasdb.com/pjm/items/6622457bfd997db58ade16be)    ?    
  #YDBRD-26536 行执行引擎支持Enum\Set类型的运算|暂不考虑|  
|  
|  
|  
|
|37|无符号整型|不在本sr的范围中，    [https://pingcode.yasdb.com/pjm/items/662244fafd997db58ade1599](https://pingcode.yasdb.com/pjm/items/662244fafd997db58ade1599)    ?    
  #YDBRD-26535 行执行引擎支持MySQL无符号类型运算|否|  
|  
|  
|  
|


###   [4.2 特性功能点2](#42-特性功能点2)  

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

**mysql兼容性开发暂不支持存储过程，所以测试数据类型不考虑存储过程的使用**

自测关注点：

（1）建表支持类型验证，插入、查询，建表具体语法交由其他sr

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  可命名用例

```

drop table if exists binary;
create table binary(compat_column int);
drop table if exists binary;
drop table if exists varbinary;
create table varbinary(compat_column int);
drop table if exists varbinary;
drop table if exists char;
create table char(compat_column int);
drop table if exists char;
drop table if exists varchar;
create table varchar(compat_column int);
drop table if exists varchar;
drop table if exists nchar;
create table char(compat_column int);
drop table if exists nchar;
drop table if exists nvarchar;
create table varchar(compat_column int);
drop table if exists nvarchar;
drop table if exists tinyblob;
create table tinyblob(compat_column int);
drop table if exists tinyblob;
drop table if exists blob;
create table blob(compat_column int);
drop table if exists blob;
drop table if exists mediumblob;
create table mediumblob(compat_column int);
drop table if exists mediumblob;
drop table if exists longblob;
create table longblob(compat_column int);
drop table if exists longblob;
drop table if exists tinytext;
create table tinytext(compat_column int);
drop table if exists tinytext;
drop table if exists text;
create table text(compat_column int);
drop table if exists text;
drop table if exists mediumtext;
create table mediumtext(compat_column int);
drop table if exists mediumtext;
drop table if exists longtext;
create table longtext(compat_column int);
drop table if exists longtext;
drop table if exists mediumint;
create table mediumint(compat_column int);
drop table if exists mediumint;
drop table if exists tinyint;
create table tinyint(compat_column int);
drop table if exists tinyint;
drop table if exists smallint;
create table smallint(compat_column int);
drop table if exists smallint;
drop table if exists integer;
create table integer(compat_column int);
drop table if exists integer;
drop table if exists bigint;
create table bigint(compat_column int);
drop table if exists bigint;
drop table if exists decimal;
create table decimal(compat_column int);
drop table if exists decimal;
drop table if exists dec;
create table dec(compat_column int);
drop table if exists dec;
drop table if exists numeric;
create table numeric(compat_column int);
drop table if exists numeric;
drop table if exists fixed;
create table fixed(compat_column int);
drop table if exists fixed;
drop table if exists float;
create table float(compat_column int);
drop table if exists float;
drop table if exists double;
create table double(compat_column int);
drop table if exists double;
drop table if exists real;
create table real(compat_column int);
drop table if exists real;
drop table if exists boolean;
create table boolean(compat_column int);
drop table if exists boolean;
drop table if exists bool;
create table bool(compat_column int);
drop table if exists bool;
drop table if exists date;
create table date(compat_column int);
drop table if exists date;
drop table if exists datetime;
create table datetime(compat_column int);
drop table if exists datetime;
drop table if exists time;
create table time(compat_column int);
drop table if exists time;
drop table if exists timestamp;
create table timestamp(compat_column int);
drop table if exists timestamp;
drop table if exists bit;
create table bit(compat_column int);
drop table if exists bit;
drop table if exists serial;
create table serial(compat_column int);
drop table if exists serial;


```

## Comments:

|  [](null)  ,1.cast as varbinary/varchar/nvarchar我们支持，mysql不支持,Posted by linyonghao at 五月 29, 2024 15:42|
|---|
