Created by 赵育, last modified on 五月 13, 2024

# 1. 概述

YashanDB mysql兼容模式首先需要支持普通结果集的fetch，第一步则需要完成YashanDB类型向mysql类型的映射。

COM_QUERY命令字会返回元数据，故需要完成Yashan元数据向mysql元数据的映射。

COM_QUERY命令字本身会触发文本结果集的返回，故返回的所有类型均在服务端转换为字符串格式。（如有字符集转换则包含字符集转换）

## 2.2 应用场景

用户使用 mysql client/mysql jdbc 驱动将数据同步/插入到 yashandb 服务端，通过 mysql client/mysql jdbc驱动查询不同数据类型的数据；测试场景均基于该前提。

- 部分数据类型 mysql server 与 yashandb 范围未严格一致，不考虑通过 yashandb 客户端插入数据，通过 mysql client 端获取数据的情况；


1、mysql-client 上查询不同字段类型的用户数据，并关注包长相关参数配置

2、jdbc 驱动上查询不同字段类型的结果及元数据信息

## 2.3 规格约束

1、不支持LOB类型。

2、仅支持登录流程中包含默认客户端字符集，不支持登录后客户端主动设置的set names、set character_set_results、set character_set_client等。

3、支持的报文大小同mysql，都为客户端max_packet_size，客户端如果将此参数设小，那么其收到报文后会报错并断连（mysql工具为此表现，驱动还未测试）。

# 3. 详细测试设计

## 3.1 测试设计方法

从功能出发，结合等价类、边界值的测试设计方法，输出测试设计。

## 3.2 详细测试设计

不同数据类型在 yashandb 服务端到 mysql 客户端的处理：元数据映射、用户数据映射，目前测试只考虑下表中标注"支持"的类型；

测试策略：

1、通过 jdbc 驱动验证数据类型映射及元数据信息，预期与 mysql server 返回的结果相同

2、使用 mysql client 验证用户数据正确性及 mysql 客户端相关配置参数，预期与 mysql server 返回的结果相同

3、不考虑元数据差异：比如分区表、临时表、索引等，只在 heap 表上测试基本功能

|  
|YashanDB|YashanDB 字段长度|Mysql|Mysql 字段长度|支持情况|映射关系确认|测试场景|
|---|---|---|---|---|---|---|---|
|1|YSDB_BOOL|1 Byte|MY_TYPE_TINY|1 Byte|支持|  
|1、字符串、0、非 0 整数、true、false|
|2|YSDB_TINYINT|1 Byte|MY_TYPE_TINY|1 Byte|支持|一一对应|1、边界值：  [-2  7     , 2  7     - 1],2、任意值、0,3、USE_NATIVE_TYPE 不应该生效？  ---本 sr 不关注,4、指定显示宽度及 ZEROFILL   ---本 sr 不关注|
|3|YSDB_SMALLINT|2 Byte|MY_TYPE_SHORT|2 Byte|支持|一一对应|1、边界值：  [-2  15  , 2  15     - 1]、范围外值,2、任意值、0,3、USE_NATIVE_TYPE 不应该生效？|
|4|YSDB_INTEGER|4 Byte|MY_TYPE_LONG|4 Byte|支持|一一对应|1、边界值：  [-2  31  , 2  31     - 1]、范围外值,2、任意值、0,3、USE_NATIVE_TYPE 不应该生效？|
|5|YSDB_BIGINT|8 Byte|MY_TYPE_LONGLONG|8 Byte|支持|一一对应|1、边界值：  [-2  63  , 2  63     - 1]、范围外值,2、任意值、0,3、USE_NATIVE_TYPE 不应该生效？|
|6|YSDB_UTINYINT|  
|MY_TYPE_TINY|  
|支持（暂不回合）|一一对应|YashanDB 不支持无符号类型|
|7|YSDB_USMALLINT|  
|MY_TYPE_SHORT|  
|支持（暂不回合）|一一对应|YashanDB 不支持无符号类型|
|8|YSDB_UINTEGER|  
|MY_TYPE_LONG|  
|支持（暂不回合）|一一对应|YashanDB 不支持无符号类型|
|9|YSDB_UBIGINT|  
|MY_TYPE_LONGLONG|  
|支持（暂不回合）|一一对应|YashanDB 不支持无符号类型|
|10|YSDB_FLOAT|4 Byte|MY_TYPE_FLOAT|4 Byte|  
|  
|1、边界值：,[-3.402823E38, -1.401298E-45]    
  0    
  [1.401298E-45, 3.402823E38]    
  数字3.402823和1.401298为四舍五入的值，非最精确值、范围外值,2、任意值、0,3、USE_NATIVE_TYPE 不应该生效？,4、特殊值：Inf、-Inf、Nan,5、指定精度|
|11|YSDB_DOUBLE|8 Byte|MY_TYPE_DOUBLE|8 Byte|  
|  
|1、边界值：,[-1.79769313486232E308, -4.94065645841247E-324]    
  0    
  [4.94065645841247E-324, 1.79769313486232E308]    
  数字1.797693134862315807和4.94065645841247为四舍五入的值，非最精确值,2、任意值、0,3、USE_NATIVE_TYPE 不应该生效？,4、特殊值：Inf、-Inf、Nan,5、指定精度|
|12|YSDB_NUMBER|1~22 Byte,P:取值范围[1,38],S:取值范围[-84,127],不指定 P 及 S 时，默认不限制|MY_TYPE_NEWDECIMAL|最大数字位数为 65，P 默认为 10，S 默认为 0|支持|一一对应|1、边界值：  0，根据精度刻度来测试边界值,2、默认精度和刻度 --Yashandb 与 mysql 不一致,3、指定精度和刻度,4、刻度为负数,yasql 与 yashandb 的范围交集|
|13|YSDB_DATE|8 Byte,0001-01-01 00:00:00 ~ 9999-12-31 23:59:59|MY_TYPE_DATETIME|*fsp 取值范围从 0-6*,     `'1000-01-01 00:00:00'`       to       `'9999-12-31 23:59:59'`  ,可精确到微秒：    `'1000-01-01 00:00:00.000000'`       to       `'9999-12-31 23:59:59.499999'`  ,  
|支持|  
|1、边界值、典型值、0值，2、fsp 指定时间精度|
|14|YSDB_SHORTDATE|  
|MY_TYPE_DATE|  
|  
|  
|  
|
|15|YSDB_SHORTTIME|  
|MY_TYPE_TIME|  
|  
|  
|  
|
|16|YSDB_TIMESTAMP|8 Byte,1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999|MY_TYPE_TIMESTAMP|*4 bytes*,*fsp 取值范围从 0-6*,     `'1000-01-01 00:00:00'`       to       `'9999-12-31 23:59:59'`  ,可精确到微秒：    `'1000-01-01 00:00:00.000000'`       to       `'9999-12-31 23:59:59.499999'`  |支持|一一对应|1、边界值、典型值、0值,2、fsp 指定时间精度,3、指定时区 ---没映射，暂不关注|
|17|YSDB_TIMESTAMP_TZ|  
|MY_TYPE_UNKNOW|  
|  
|  
|  
|
|18|YSDB_TIMESTAMP_LTZ|  
|MY_TYPE_UNKNOW|  
|  
|  
|  
|
|19|YSDB_YM_INTERVAL|  
|MY_TYPE_UNKNOW|  
|  
|  
|  
|
|20|YSDB_DS_INTERVAL|  
|MY_TYPE_UNKNOW|  
|  
|  
|  
|
|21|YSDB_CHAR|1~8000 Byte|MY_TYPE_STRING|0 ~ 255 Byte|支持|  
|1、首位空格,2、大小写,3、字符集,  
|
|22|YSDB_NCHAR|  
|MY_TYPE_STRING|  
|  
|  
|  
|
|23|YSDB_VARCHAR|1~32000 Byte|MY_TYPE_VAR_STRING|0 ~ 65535 Byte|支持|  
|1、首位空格,2、大小写,3、字符集|
|24|YSDB_NVARCHAR|  
|MY_TYPE_VAR_STRING|  
|  
|  
|  
|
|25|YSDB_RAW|  
|MY_TYPE_VAR_STRING|  
|  
|  
|  
|
|26|YSDB_CLOB|  
|MY_TYPE_BLOB|  
|  
|  
|  
|
|27|YSDB_BLOB|  
|MY_TYPE_BLOB|  
|  
|  
|  
|
|28|YSDB_BIT|  
|MY_TYPE_BIT|  
|  
|  
|  
|
|29|YSDB_ROWID|  
|MY_TYPE_UNKNOW|  
|  
|  
|  
|
|30|YSDB_NCLOB|  
|MY_TYPE_UNKNOW|  
|  
|  
|  
|
|31|YSDB_CURSOR|  
|MY_TYPE_UNKNOW|  
|  
|  
|  
|
|32|YSDB_JSON|  
|MY_TYPE_JSON|  
|  
|  
|  
|
|33|YSDB_ENUM|  
|MY_TYPE_ENUM|  
|  
|  
|  
|
|34|YSDB_SET|  
|MY_TYPE_SET|  
|  
|  
|  
|


  


*mysql client 对 COM_QUERY 文本结果集收发报文的处理*

|配置参数|取值范围|含义|测试场景|
|---|---|---|---|
|net-buffer-length|[1M,1G]，默认值：16M|每个客户端线程都与一个连接缓冲区和结果缓冲区相关联。两者都以net_buffer_length给定的大小开始，但根据需要动态扩大到max_allowed_packet字节。在每个SQL语句之后，结果缓冲区缩减为net_buffer_length|对于   *COM_QUERY 来说，客户端配置影响接收报文的大小，对于发送报文大小的影响在 dml 操作中验证；*,1、配置   net-buffer-length > max-allowed-packet，比如 net-buffer-length = 1M，max-allowed-packet = 1K，获取查询结果    
    
,2、配置 net-buffer-length <= max-allowed-packet,net-buffer-length = 默认值，max-allowed-packet = 默认值，获取字段值长度覆盖：<=64M、64M+1B;,net-buffer-length = 默认值，max-allowed-packet = 1G，获取字段长度覆盖：1G+1B ,net-buffer-length = 默认值，max-allowed-packet > 最大字符串类型长度，获取字段长度覆盖：<最大字符串类型长度、最大字符串类型长度+1B,  
,最大长度：4096 列 *32000B|
|max-allowed-packet|[1K,1G]，默认值：64M|1、数据包的最大大小,2、生成/中间结果的字符串最大大小,3、包消息缓冲区初始化为net_buffer_length字节，需要时可以扩充到max_allowed_packet字节,4、如果使用大的 BLOB 字段，应该设置该值与 BLOB 字段长度一样大小的值,5、客户端也存在该配置，当客户端作为接收端时(默认值为 1G)，客户端也同样可以更改该参数值，||
|  [default-character-set](https://dev.mysql.com/doc/refman/8.0/en/mysql-command-options.html#option_mysql_default-character-set)  |  
|yashandb 支持的字符集：  GBK、UTF-8、GB18030、ASCII和ISO-8859-1字符集；,mysql 支持的字符集|1、mysql client 通过     [default-character-set](https://dev.mysql.com/doc/refman/8.0/en/mysql-command-options.html#option_mysql_default-character-set)     指定与 yashandb 相同的字符集、不同的字符集,yashandb ：固定：  UTF-8，mysql client 设置：gbk 字符集|


  


元数据映射，通过 jdbc 驱动接口 java.sql.DatabaseMetaData、java.sql.ResultGetMetaData 获取数据库及列的属性来验证元数据信息

|类型|目前值|说明|测试方法|
|---|---|---|---|
|catalog|def|永远为def|ResultSetMetaData meteData = resultSet.getMetaData();    
  String catalogName = meteData.getCatalogName(1);    
  Assert.assertEquals(catalogName, "cs");|
|database|""|返回当前schema？,目前未返回值|  
|
|virtual table name|""|返回当前表名？,目前未返回值|使用表别名进行查询|
|physical table name|""|目前未确定含义|String meteTableName = meteData.getTableName(1);    
  Assert.assertEquals(meteTableName, tableName);|
|virtual column name|列名|返回当前  列名|String columnLabel = meteData.getColumnLabel(1);    
  Assert.assertEquals(columnLabel, "a1");|
|physical column name|""|目前未确定含义|String columnName1 = meteData.getColumnName(1);    
  Assert.assertEquals(columnName1, "col1");|
|length of fixed length fields|10|固定0x0c|驱动端无法验证|
|client charset number|character_set_results|  
|mysql client 端来测试设置的编码？|
|size|bytesize|to make sure what size? charsize/bytesize/definesize,目前未确认返回size的类型|通过客户端与服务端的编码方式来验证？|
|type|对应类型|  
|String columnTypeName1 = meteData.getColumnTypeName(1);    
  Assert.assertEquals(columnTypeName1, "BIT");    
  String columnTypeName2 = meteData.getColumnTypeName(2);    
  Assert.assertEquals(columnTypeName2, "TINYINT");    
  String columnTypeName3 = meteData.getColumnTypeName(3);    
  Assert.assertEquals(columnTypeName3, "SMALLINT");    
  String columnTypeName4 = meteData.getColumnTypeName(4);    
  Assert.assertEquals(columnTypeName4, "INT");    
  String columnTypeName5 = meteData.getColumnTypeName(5);    
  Assert.assertEquals(columnTypeName5, "BIGINT");    
  String columnTypeName6 = meteData.getColumnTypeName(6);    
  Assert.assertEquals(columnTypeName6, "DECIMAL");    
  String columnTypeName7 = meteData.getColumnTypeName(7);    
  Assert.assertEquals(columnTypeName7, "DATETIME");    
  String columnTypeName8 = meteData.getColumnTypeName(8);    
  Assert.assertEquals(columnTypeName8, "TIMESTAMP");    
  String columnTypeName9 = meteData.getColumnTypeName(9);    
  Assert.assertEquals(columnTypeName9, "CHAR");    
  String columnTypeName10 = meteData.getColumnTypeName(10);    
  Assert.assertEquals(columnTypeName10, "VARCHAR");|
|flags|MY_FIELD_FLAG_NOT_NULL,MY_FIELD_FLAG_UNSIGNED_FLAG,目前已支持上述属性|#define MY_FIELD_FLAG_NOT_NULL          1    
  #define MY_FIELD_FLAG_PRI_KEY_FLAG      2    
  #define MY_FIELD_FLAG_UNIQUE_KEY_FLAG   4    
  #define MY_FIELD_FLAG_MULTIPLE_KEY_FLAG 8    
  #define MY_FIELD_FLAG_BLOB_FLAG         16    
  #define MY_FIELD_FLAG_UNSIGNED_FLAG     32    
  #define MY_FIELD_FLAG_ZEROFILL_FLAG     64    
  #define MY_FIELD_FLAG_BINARY_FLAG       128,目前支持的flag不完整|dataBaseMeteData = conn.getMetaData();    
  ResultSet columns = dataBaseMeteData.getColumns(catalog, schema, meteTableName, columnName1);    
  Object nullable = columns.getObject("NULLABLE");    
  Object isNullable = columns.getObject("IS_NULLABLE");,  
,DatabaseMetaData dataBaseMeteData = conn.getMetaData();    
  ResultSet typeInfo = dataBaseMeteData.getTypeInfo();,Object unsignedAttribute = typeInfo.getObject("UNSIGNED_ATTRIBUTE");,  
,  
|
|decimals|符合mysql要求的decimals|max shown decimal digits:,- 0x00 for integers and static strings
- 0x1f for dynamic strings, double, float
- 0x00 to 0x51 for decimals
,目前decimals固定返回0，可能不符合规范|  
|
|reserved|0|  
|  
|


*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[COM_QUERY文本结果集支持基础类型测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTc4OTcwYzJhZjRmNTIxODYwIiwicmVmX2lkIjoiNjczOTZlNTc1OTNmOTljOWZmMjM4M2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDYxLCJleHAiOjE3ODI0NTc4NjF9.48Cp5VxJ6U02ElvANQqdqDaitczoabo4EhIAQ90x4e4)

详见附件

# 5. 测试框架设计

- 适配 mysql-test 测试框架，目前原生测试用例无法执行，可以新增测试套的方式往该测试框架里边补充测试用例
- testng 测试框架，补充 mysql jdbc 驱动测试用例


# 6. 测试环境说明

*不涉及*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTdhMWFkOWEzMzExZGM5NmQ1IiwicmVmX2lkIjoiNjczOTZlNTc1OTNmOTljOWZmMjM4M2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDYxLCJleHAiOjE3ODI0NTc4NjF9.mf1TO5Vs3js0IVGkjEu5fNSLwIioYkuYgQxc2xKwJP0)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTdhMWFkOWEzMzExZGM5NmQ1IiwicmVmX2lkIjoiNjczOTZlNTc1OTNmOTljOWZmMjM4M2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDYxLCJleHAiOjE3ODI0NTc4NjF9.mf1TO5Vs3js0IVGkjEu5fNSLwIioYkuYgQxc2xKwJP0)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTc4OTcwYzJhZjRmNTIxODYxIiwicmVmX2lkIjoiNjczOTZlNTc1OTNmOTljOWZmMjM4M2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDYxLCJleHAiOjE3ODI0NTc4NjF9.57Xx7CB3g4YZ5vqDYZtejdNckZaXI23vYhtFdjCxU-Q)

 (application/msword)    


[image2024-4-23_11-26-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTc4OTcwYzJhZjRmNTIxODYyIiwicmVmX2lkIjoiNjczOTZlNTc1OTNmOTljOWZmMjM4M2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDYxLCJleHAiOjE3ODI0NTc4NjF9.Um8oqI-MS8Yl-owW4R5pFl3o8K9_4zYpWyxRrH4FQT4)

 (image/png)    


[COM_QUERY文本结果集支持基础类型测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTc4OTcwYzJhZjRmNTIxODYwIiwicmVmX2lkIjoiNjczOTZlNTc1OTNmOTljOWZmMjM4M2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDYxLCJleHAiOjE3ODI0NTc4NjF9.48Cp5VxJ6U02ElvANQqdqDaitczoabo4EhIAQ90x4e4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：张鹏飞、冯皓博、赵育、杜卓林    
  会议时间：2024/5/8 14:15-14:45    
  会议地点：线上会议    
  纪要信息：    
  1、整形类型，暂不关注显示宽度及 ZEROFILL，与协议无关，暂不关注    
  2、类型范围不一致的，暂时关注范围的交集，数据类型范围与协议无关，暂不关注    
  3、TIMESTAMP 类型，fsp 及时区相关内容，与协议无关，暂不关注    
  4、由于目前支持的类型限制，max-allowed-packet 参数能测试到的最大长度为 4096 列 *32000B    
  5、字符集转换目前重点测试，yashandb：UTF-8，mysql client 设置：gbk 字符集,Posted by zhaoyu at 五月 08, 2024 18:58|
|---|
