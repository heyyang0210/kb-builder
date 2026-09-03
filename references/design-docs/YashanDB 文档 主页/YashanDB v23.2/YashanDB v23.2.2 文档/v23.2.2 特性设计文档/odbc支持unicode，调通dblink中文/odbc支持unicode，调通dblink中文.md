Created by 冯皓博, last modified on 三月 12, 2024

*IR链接：*    [YDBRD-26956](https://jira.yasdb.com/browse/YDBRD-26956?src=confmacro)    *-*  *ORACLE使用DBLINK连接崖山支持中文*  *开发中*

*SR链接：*    [YDBRD-27689](https://jira.yasdb.com/browse/YDBRD-27689?src=confmacro)    *-*  *【c驱动】支持WCHAR进行字符编码映射*  *待启动*    [YDBRD-27690](https://jira.yasdb.com/browse/YDBRD-27690?src=confmacro)    *-*  *【odbc】支持string w接口进行unicode字符编解码*  *待启动*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

ODBC支持UNICODE能力，包含  **函数调用**  和  **字符串数据类型绑定**  。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

外场需要使用到ORACLE DBLINK能力，要求ORACLE DBLINK能力支持关于中文字符的查询。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/unicode?view=sql-server-ver16](https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/unicode?view=sql-server-ver16)  

#### 1、ODBC字符集支持背景：

目前ODBC支持两种字符集，一种是ANSI字符集，即环境默认字符集（比如中国大陆的微软操作系统默认字符集为GBK，中国台湾的微软操作系统默认字符集为BIG5），另一种是UNICODE字符集。

这两种字符集的使用按照接口来区分，如果使用UNICODE字符集，那么用户需要调用以W结尾的接口，比如SQLConnectW。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

#### 1、UNICODE支持定义：

目前，ODBC 支持的唯一 Unicode 编码是 UCS-2，它使用 16 位整数（固定长度）来表示一个字符。

PS：仅支持基础平面的UNICODE字符，不支持扩展平面的UNICODE字符？

#### 2、  影响范围：

这会对两个主要领域带来影响：  **函数调用**  和  **字符串数据类型**  。 驱动程序管理器根据应用程序和驱动程序的要求来映射函数字符串参数和字符串数据，这两者可以支持 Unicode，也可以支持 ANSI。   

#### 3、如何区分驱动程序是否支持UNICODE：

Unicode 驱动程序必须导出 SQLConnectW 才能被驱动程序管理器识别为 Unicode 驱动程序。

#### 4、  如何编写UNICODE应用程序：

可以通过以下两种方式之一将应用程序重新编译为 Unicode 应用程序：

- 在应用程序中包含 Sqlucode.h 头文件中包含的 Unicode #define。
- 使用编译器的 Unicode 选项编译应用程序。 （对于不同的编译器，此选项将有所不同。）


  [https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/unicode-applications?view=sql-server-ver16](https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/unicode-applications?view=sql-server-ver16)  

#### 5、ANSI/UNICODE混合调用

  [https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/function-mapping-in-the-driver-manager?view=sql-server-ver16](https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/function-mapping-in-the-driver-manager?view=sql-server-ver16)  

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#2-%E6%8E%A5%E5%8F%A3)  

#### 1、需适配函数列表：

下面是支持 Unicode (W) 和 ANSI (A) 版本的 ODBC API 函数的列表：

|  
|接口|说明|ANSI版本是否已实现|UNICODE版本是否已实现|UNICODE版本采用字符计数还是字节计数|UNICODE版本是否有用例|
|---|---|---|---|---|---|---|
|1|SQLBrowseConnect|  
|  
|  
|  
|  
|
|2|SQLColAttribute|  
|√|√|字节（已验证）|√|
|3|SQLColAttributes|  
|  
|  
|  
|  
|
|4|SQLColumnPrivileges|  
|  
|  
|  
|  
|
|5|SQLColumns|  
|？未合入|  
|  
|  
|
|6|SQLConnect|  
|√|√|字符（已验证）|√|
|7|SQLDataSources|  
|  
|  
|  
|  
|
|8|SQLDescribeCol|  
|√|√|字符（已验证）|√|
|9|SQLDriverConnect|  
|√|√|字符（已验证）|√|
|10|SQLDrivers|  
|  
|  
|  
|  
|
|11|SQLError|  
|  
|  
|  
|  
|
|12|SQLExecDirect|  
|√|√|字符（已验证）|√|
|13|SQLForeignKeys|  
|  
|  
|  
|  
|
|14|SQLGetConnectAttr|  
|√|√|字节（已验证）|√|
|15|SQLGetConnectOption|  
|  
|  
|  
|  
|
|16|SQLGetCursorName|  
|  
|  
|  
|  
|
|17|SQLGetDescField|  
|√|√|字节（已验证）|√|
|18|SQLGetDescRec|  
|  
|  
|  
|  
|
|19|SQLGetDiagField|  
|√|√|字节（已验证）|  
|
|20|SQLGetDiagRec|  
|√|√|字符（已验证）|  
|
|21|SQLGetInfo|  
|√|√|字节（已验证）|√|
|22|SQLGetStmtAttr|  
|√|√|无关|√|
|23|SQLGetTypeInfo|  
|√|√|无关|√|
|24|SQLNativeSql|  
|  
|  
|  
|  
|
|25|SQLPrepare|  
|√|√|字符（已验证）|√|
|26|SQLPrimaryKeys|  
|  
|  
|  
|  
|
|27|SQLProcedureColumns|  
|  
|  
|  
|  
|
|28|SQLProcedures|  
|  
|  
|  
|  
|
|29|SQLSetConnectAttr|  
|√|√|无关|无关|
|30|SQLSetConnectOption|  
|  
|  
|  
|  
|
|31|SQLSetCursorName|  
|  
|  
|  
|  
|
|32|SQLSetDescField|  
|√|√|字节（无法找到用例）|√（无法找到用例）|
|33|SQLSetStmtAttr|  
|√|√|无关|无关|
|34|SQLSpecialColumns|  
|  
|  
|  
|  
|
|35|SQLStatistics|  
|  
|  
|  
|  
|
|36|SQLTablePrivileges|  
|  
|  
|  
|  
|
|37|SQLTables|目录函数，如果  SQL_C_WCHAR支持则天然支持|√|√|字符（已验证）|√|


#### 2、需适配数据类型：

SQL类型

|类型|说明|适配情况|
|---|---|---|
|SQL_WCHAR|SQL_WCHAR 数据具有固定的字符串长度|无需适配|
|SQL_WVARCHAR|SQL_WVARCHAR 具有声明最大值的可变长度|无需适配|
|SQL_WLONGVARCHAR|SQL_WLONGVARCHAR 具有含最大值的可变长度|无需适配|


C类型

|类型|说明|适配情况|
|---|---|---|
|SQL_C_CHAR|ANSI|无需适配|
|SQL_C_WCHAR|UNICODE|需要新增改绑定类型|
|SQL_C_TCHAR|如果应用程序编译为 Unicode 应用程序，则此宏将插入 SQL_C_WCHAR；如果应用程序编译为 ANSI 应用程序，则插入 SQL_C_CHAR|无需适配|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、Unicode 驱动程序仍必须支持 ANSI 数据类型，包括 SQL_CHAR。

如果使用 Unicode 驱动程序的应用程序绑定到 SQL_CHAR，驱动程序管理器不会将 SQL_CHAR 数据映射到 SQL_WCHAR。 Unicode 驱动程序必须接受 SQL_CHAR 数据。

2、对于始终返回或采用字符串或长度参数的 Unicode 函数，参数作为字符数的形式传递。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

需要实现两点：

- 所有上述接口列表中的W后缀函数
- 实现  SQL_C_WCHAR类型的fetch、出入参绑定


###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)      [W后缀函数实现](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

可根据不带W后缀的函数为主体，在其之前调用ucs2_to_utf8完成，或者在其后调用utf8_to_ucs2。

###   [4.2](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)      [实现SQL_C_WCHAR类型](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

完成fetch、  出入参绑定

fetch StrLen_or_Ind：返回长度为字节长度（MYSQL+ORACLE）

绑定BufferLength：长度为字节长度（MYSQL+ORACLE）

本质是UTF16编码

![](https://pingcode.yasdb.com/atlas/files/public/67396cc38970c2af4f520e35/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMDMsImV4cCI6MTc4MjMxNDEwM30.juZlTe3rSOKXmTqtn1fvbVG1cBvoYextGj3xQ9McylE)

```
indicator = 24
单字符：55408,57111
```

###   [4.3 linux UTF16处理](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

WCHAR(wchar_t)：

- linux：4字节
- windows：2字节


L"abcdefg"

- linux：UTF32，占7*4=28字节（不带末尾L'\0'）
- windows：UTF16，占7*2=14字节（不带末尾L'\0'）


char16_t

- linux：2字节
- windows：2字节


u"abcdefg"

- linux：UTF16，占7*2=14字节（不带末尾L'\0'）
- windows：UTF16，占7*2=14字节（不带末尾L'\0'）


U"abcdefg"

- linux：UTF32，占7*4=28字节（不带末尾L'\0'）
- windows：UTF32，占7*4=28字节（不带末尾L'\0'）


其他固定编码字符串见：    [https://learn.microsoft.com/en-us/cpp/cpp/string-and-character-literals-cpp?view=msvc-170&redirectedfrom=MSDN](https://learn.microsoft.com/en-us/cpp/cpp/string-and-character-literals-cpp?view=msvc-170&redirectedfrom=MSDN)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

##   [5.自测用例](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1、完成ODBC W接口普通功能测试

2、支持DBLINK查询+插入中文字符串

|序号|类型|自测是否通过|备注|
|---|---|---|---|
|1|byteConvInt8NString|√|  
|
|2|byteConvInt16NString|√|  
|
|3|byteConvInt32NString|√|  
|
|4|byteConvInt64NString|√|  
|
|5|byteConvFloatNString|√|  
|
|6|byteConvDoubleNString|√|  
|
|7|byteConvStringNString|√|  
|
|8|byteConvNumberNString|√|  
|
|9|byteConvDateNString|√|  
|
|10|byteConvShortTimeNString|√|  
|
|11|byteConvTimestampNString|√|  
|
|12|byteConvTimestampTzNString|  
|无需支持，目前TimestampTz类型尚未支持|
|13|byteConvTimestampLtzNString|  
|无需支持，目前TimestampTz类型尚未支持|
|14|byteConvYMIntervalNString|√|  
|
|15|byteConvDSIntervalNString|√|  
|
|16|byteConvBitNString|√|  
|
|17|byteConvBoolNString|√|  
|
|18|byteConvRowIdNString|√|  
|
|19|byteConvClobNString|  
|无需支持，LOB已做单独处理|
|20|byteConvNClobNString|  
|无需支持，LOB已做单独处理|
|21|byteConvBlobNString|  
|无需支持，LOB已做单独处理|
|22|byteConvJsonNString|  
|无需支持，LOB已做单独处理|
|23|byteConvRawNString|  
|无需支持，LOB已做单独处理|


##   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

## Attachments:

## Comments:

|  [](null)  ,byteConv[a-zA-Z]+NString,需要支持的类型转换：,byteConvFloatNString,byteConvDoubleNString,byteConvStringNString,byteConvNumberNString,byteConvDateNString,byteConvShortTimeNString,byteConvTimestampNString,byteConvTimestampTzNString,byteConvYMIntervalNString,byteConvDSIntervalNString,byteConvBitNString,byteConvBoolNString,byteConvRowIdNString,byteConvClobNString,byteConvNClobNString,byteConvBlobNString,byteConvJsonString,byteConvJsonNString,byteConvRawNString,Posted by fenghaobo at 二月 27, 2024 11:17|
|---|
|  [](null)  ,linux：,#include <wchar.h>,linux没有WCHAR,linux的wchar_t为4字节,Posted by fenghaobo at 二月 29, 2024 10:21|
|  [](null)  ,  [https://learn.microsoft.com/en-us/cpp/cpp/string-and-character-literals-cpp?view=msvc-170&redirectedfrom=MSDN](https://learn.microsoft.com/en-us/cpp/cpp/string-and-character-literals-cpp?view=msvc-170&redirectedfrom=MSDN)  ,L前缀字符串,Posted by fenghaobo at 二月 29, 2024 14:49|
