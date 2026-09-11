Created by 冯皓博, last modified on 四月 28, 2024

  [https://pingcode.yasdb.com/pjm/items/6618f2e2fd997db58ad850ee](https://pingcode.yasdb.com/pjm/items/6618f2e2fd997db58ad850ee)    ?    
  #YDBRD-26208 【mysql兼容】（协议）COM_QUERY文本结果集支持基础类型

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

YashanDB mysql兼容模式首先需要支持普通结果集的fetch，第一步则需要完成YashanDB类型向mysql类型的映射。

COM_QUERY命令字会返回元数据，故需要完成Yashan元数据向mysql元数据的映射。

COM_QUERY命令字本身会触发文本结果集的返回，故返回的所有类型均在服务端转换为字符串格式。（如有字符集转换则包含字符集转换）

![](https://pingcode.yasdb.com/atlas/files/public/67396e98a1ad9a3311dc980b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFCQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUlBQUFBQUFBUUFBQUFBQUJBQUFBQUFBQUFCQUFBQUFBS0FBQUFRQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBTUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgyMzQsImV4cCI6MTc4MjQ0OTAzNH0.xgK6Yttelc647TJBUI3pLD4FwDS81RvC_1Mb1_070Hg)

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

外场mysql

###   [1.2](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)      [大数据量适配](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)      [调研](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

涉及到max_allowed_packet：    [https://conf.yasdb.com/x/6Ur6C](https://conf.yasdb.com/x/6Ur6C)  

#### 参数：

net-buffer-length

默认大小：  16384    
  最小值：  1024    
  最大值：  1048576    
  扩充生命周期：从收到报文扩充，到当前SQL stmt结束缩小。

max-allowed-packet

默认大小：  64MB(MYSQL 8.0)，4MB(MYSQL 5.7)    
  最小值：1024    
  最大值：1073741824

#### 接收端：

接收端将报文全部缓冲到net->buff（即使业务跨包也是）。

![](https://pingcode.yasdb.com/atlas/files/public/67396e988970c2af4f521999/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFCQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUlBQUFBQUFBUUFBQUFBQUJBQUFBQUFBQUFCQUFBQUFBS0FBQUFRQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBTUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgyMzQsImV4cCI6MTc4MjQ0OTAzNH0.xgK6Yttelc647TJBUI3pLD4FwDS81RvC_1Mb1_070Hg)

#### 发送端：

发送端自己维护发送报文内存，该内存和net→buff解耦，单独控制，拼接报文时可能多次realloc

该发送报文内存在每次do_command（收到请求）时重置

发送时如果当前报文量小，能缓存则缓存，到了该发的时机，则统一调用net_flush

目标：使单次发送系统调用最小发送报文为net->buff大小，最大不限制。

![](https://pingcode.yasdb.com/atlas/files/public/67396e988970c2af4f52199b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFCQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUlBQUFBQUFBUUFBQUFBQUJBQUFBQUFBQUFCQUFBQUFBS0FBQUFRQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBTUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgyMzQsImV4cCI6MTc4MjQ0OTAzNH0.xgK6Yttelc647TJBUI3pLD4FwDS81RvC_1Mb1_070Hg)

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

以下为类型映射表格，目前的COM_QUERY仅列举单向映射：Yashan→mysql

  


类型映射确认：

1、如果yashanDB和mysql的数据类型能够一一对应，此类型映射无疑义

2、如果yashanDB找不到mysql的对应类型，是否要兼容此类数据类型？（YashanDB的类型mysql能查到）

3、后续此类类型映射问题，最好抓包把所有类型的全部元数据值确认，保证类型映射的正确性

|  
|YashanDB|Mysql|支持情况|映射关系确认|
|---|---|---|---|---|
|1|YSDB_BOOL|MY_TYPE_TINY|支持|  
|
|2|YSDB_TINYINT|MY_TYPE_TINY|支持|一一对应|
|3|YSDB_SMALLINT|MY_TYPE_SHORT|支持|一一对应|
|4|YSDB_INTEGER|MY_TYPE_LONG|支持|一一对应|
|5|YSDB_BIGINT|MY_TYPE_LONGLONG|支持|一一对应|
|6|YSDB_UTINYINT|MY_TYPE_TINY|支持（暂不回合）|一一对应|
|7|YSDB_USMALLINT|MY_TYPE_SHORT|支持（暂不回合）|一一对应|
|8|YSDB_UINTEGER|MY_TYPE_LONG|支持（暂不回合）|一一对应|
|9|YSDB_UBIGINT|MY_TYPE_LONGLONG|支持（暂不回合）|一一对应|
|10|YSDB_FLOAT|MY_TYPE_FLOAT|  
|  
|
|11|YSDB_DOUBLE|MY_TYPE_DOUBLE|  
|  
|
|12|YSDB_NUMBER|MY_TYPE_NEWDECIMAL|支持|一一对应|
|13|YSDB_DATE|MY_TYPE_DATETIME|支持|  
|
|14|YSDB_SHORTDATE|MY_TYPE_DATE|  
|  
|
|15|YSDB_SHORTTIME|MY_TYPE_TIME|  
|  
|
|16|YSDB_TIMESTAMP|MY_TYPE_TIMESTAMP|支持|一一对应|
|17|YSDB_TIMESTAMP_TZ|MY_TYPE_UNKNOW|  
|  
|
|18|YSDB_TIMESTAMP_LTZ|MY_TYPE_UNKNOW|  
|  
|
|19|YSDB_YM_INTERVAL|MY_TYPE_UNKNOW|  
|  
|
|20|YSDB_DS_INTERVAL|MY_TYPE_UNKNOW|  
|  
|
|21|YSDB_CHAR|MY_TYPE_STRING|支持|  
|
|22|YSDB_NCHAR|MY_TYPE_STRING|  
|  
|
|23|YSDB_VARCHAR|MY_TYPE_VAR_STRING|支持|  
|
|24|YSDB_NVARCHAR|MY_TYPE_VAR_STRING|  
|  
|
|25|YSDB_RAW|MY_TYPE_VAR_STRING|  
|  
|
|26|YSDB_CLOB|MY_TYPE_BLOB|  
|  
|
|27|YSDB_BLOB|MY_TYPE_BLOB|  
|  
|
|28|YSDB_BIT|MY_TYPE_BIT|  
|  
|
|29|YSDB_ROWID|MY_TYPE_UNKNOW|  
|  
|
|30|YSDB_NCLOB|MY_TYPE_UNKNOW|  
|  
|
|31|YSDB_CURSOR|MY_TYPE_UNKNOW|  
|  
|
|32|YSDB_JSON|MY_TYPE_JSON|  
|  
|
|33|YSDB_ENUM|MY_TYPE_ENUM|  
|  
|
|34|YSDB_SET|MY_TYPE_SET|  
|  
|


  [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#2-%E6%8E%A5%E5%8F%A3)  

1、支持mysql黑屏工具触发的结果集fetch

2、支持驱动触发的结果集fetch，对应接口为：SQLExecDirect等直接执行接口，之后通过接口获取元数据可以拿到相关元数据

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、不支持LOB类型。

2、仅支持登录流程中包含默认客户端字符集，不支持登录后客户端主动设置的set names、set character_set_results、set character_set_client等。

3、支持的报文大小同mysql，都为客户端max_packet_size，客户端如果将此参数设小，那么其收到报文后会报错并断连（mysql工具为此表现，驱动还未测试）。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

报文：总共为1+column count+row count+1个包

  


packet1：column count

packet2：column metatata * column count

packet3：row packet * row count

packet4：ok packet

  


###   [4.1 元数据](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

|类型|目前值|说明|
|---|---|---|
|catalog|def|永远为def|
|database|""|返回当前schema？,目前未返回值|
|virtual table name|""|返回当前表名？,目前未返回值|
|physical table name|""|目前未确定含义|
|virtual column name|列名|返回当前  列名|
|physical column name|""|目前未确定含义|
|length of fixed length fields|10|固定0x0c|
|client charset number|character_set_results|  
|
|size|bytesize|to make sure what size? charsize/bytesize/definesize,目前未确认返回size的类型|
|type|对应类型|  
|
|flags|MY_FIELD_FLAG_NOT_NULL,MY_FIELD_FLAG_UNSIGNED_FLAG,目前已支持上述属性|#define MY_FIELD_FLAG_NOT_NULL          1    
  #define MY_FIELD_FLAG_PRI_KEY_FLAG      2    
  #define MY_FIELD_FLAG_UNIQUE_KEY_FLAG   4    
  #define MY_FIELD_FLAG_MULTIPLE_KEY_FLAG 8    
  #define MY_FIELD_FLAG_BLOB_FLAG         16    
  #define MY_FIELD_FLAG_UNSIGNED_FLAG     32    
  #define MY_FIELD_FLAG_ZEROFILL_FLAG     64    
  #define MY_FIELD_FLAG_BINARY_FLAG       128,目前支持的flag不完整|
|decimals|符合mysql要求的decimals|max shown decimal digits:,- 0x00 for integers and static strings
- 0x1f for dynamic strings, double, float
- 0x00 to 0x51 for decimals
,目前decimals固定返回0，可能不符合规范|
|reserved|0|  
|


###   [4.2 数据](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

row packet

格式：size+data

###   [4.3 字符集](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

涉及到set character_set_client+set character_set_results，均在客户端登陆时，收到报文中包含的字符集初始化

1、set character_set_client：客户端传来的信息的字符集，例如：sql文本、入参等等

2、set character_set_results：服务端传回的信息的字符集，例如：元数据、数据、error信息、出参等等

PS：当前版本上述字符集一致，并且无法更改，都在客户端连接时初始化

###   [4.4 大数据量适配](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

net→buff：

生命周期：worker初始化时申请，worker销毁时释放

扩充时机：接收报文大于当前net→buff时、写报文超过当前net→buff时

shrink时机：每次收到新请求时：do_command，shrink到  net-buffer-length

写报文时扩充大小：每次扩充：min(2倍扩充，需要的新大小)

写报文时遇到大于1G的数据：允许发送，之后客户端会报错

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

未来SQL类型支持会更多，后续SQL类型转测时需要新增协议测试

## Attachments:

## Comments:

|  [](null)  ,COM_QUERY文本结果集支持基础类型评审：,与会人：冯皓博、张鹏飞、林永豪、邓秋怡、李子怡、罗文芳、马士杰、史鑫、赵忠源、赵育    
  评审时间：2024.4.24  17：00    
  评审地点：线上会议    
  评审纪要：,1、协议支持跨包流程：其中遇到的报文空间申请、释放均使用原生malloc封装的函数，后续补充SGA/PGA相关接口实现,2、协议数据类型支持：目前支持部分数据类型，类型映射尚不完整，后续特性支持这些类型时check对应映射关系，如有缺漏则补充协议    
,3、报文字段调研清楚：目前部分元数据尚未调研完善，转测前同测试调研完毕,Posted by fenghaobo at 四月 28, 2024 09:26|
|---|
