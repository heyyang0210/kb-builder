Created by 冯皓博, last modified on 一月 10, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

C驱动是YashanDB的原生驱动，提供一套用于C语言数据库操作的自定义接口，这些接口的实现不遵循任何现有标准，均为自主设计。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

YashanDB第三方和内部配套工具都需要使用数据库的原生驱动来开发高性能应用程序。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

ODBC：    [https://learn.microsoft.com/zh-cn/sql/odbc/reference/syntax/odbc-function-summary?view=sql-server-ver15](https://learn.microsoft.com/zh-cn/sql/odbc/reference/syntax/odbc-function-summary?view=sql-server-ver15)  

OCI：    [OCI: Introduction (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/introduction.html#GUID-27645179-6957-4004-8BB8-38775266B038)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

- 提供多种SQL执行方式
- 对外接口规格不变，根据版本升级保证兼容
- 多层连接身份验证
- 提供隐藏内部实现细节的接口
- 提供多层次句柄结构控制
- 提供内存注入功能
- 提供多项配置参数
- 提供获取元数据的接口
- 提供获取结果集的方式
- 提供批量插入方式
- 提供普通数据的导入
- 提供LOB数据的导入导出


|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|提供多种SQL执行方式|  
|是|  
|  
|
|  
|多层连接身份验证|  
|是|  
|  
|
|  
|提供内存注入功能|  
|  
|  
|  
|
|  
|提供多项配置参数|  
|  
|  
|  
|
|  
|提供多层次句柄结构控制|  
|  
|  
|  
|
|  
|提供获取元数据的接口|  
|是|  
|  
|
|  
|提供获取结果集的方式|  
|是|  
|  
|
|  
|提供批量插入方式|  
|是|  
|  
|
|  
|提供普通数据的导入|  
|  
|  
|  
|
|  
|提供LOB数据的导入导出|  
|是|  
|  
|
|性能|高性能导入|  
|是|  
|  
|
|  
|高性能导出|  
|是|  
|  
|
|  
|LOB高性能导入导出|  
|是|  
|  
|
|可用性|恢复场景|  
|  
|  
|  
|
|可靠性|故障场景|  
|  
|  
|  
|
|安全|密码内存引用|  
|  
|  
|  
|
|易用性|提供隐藏内部实现细节的接口|  
|  
|  
|  
|
|兼容性|对外接口规格不变，根据版本升级保证兼容|  
|  
|  
|  
|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

不涉及

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#2-%E6%8E%A5%E5%8F%A3)  

###   [2.1 句柄关系](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

ENV->CONN→STMT

资源：所有堆资源都属于ENV

申请：级联申请

释放：级联释放

![](https://pingcode.yasdb.com/atlas/files/public/67396d2fa1ad9a3311dc8f47/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

###   [4.1 资源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

#### 1、常见句柄：

|句柄类型|格式|描述|
|---|---|---|
|ENV|YacHandle|环境句柄|
|CONN|YacHandle|连接句柄|
|STMT|YacHandle|语句句柄|
|LOBLOCATOR|YacLobLocator*|LOB句柄|


#### 2、句柄申请释放：

申请：env->conn→stmt/loblocator

释放：stmt/loblocator→conn→env

|句柄类型|句柄级别|句柄申请|句柄释放|是否有释放兜底|
|---|---|---|---|---|
|ENV|最底层的句柄|无交互|无交互|无需|
|CONN|从属于ENV|无交互，实际连接的时候有交互（3次握手+3次业务ACK+2次业务REQ，本质4次往返）|无交互，但如果此时连接未释放，那么有交互（4次挥手+1次业务ACK+1次业务REQ，本质2次往返+2MS）|无，  此处可能需要增加CONN兜底释放|
|STMT|从属于CONN|无交互（理论上CONN连接前连接后都可以创建stmt）|有交互，CMD_FREE_STMT|有，CONN释放时会为未释放的STMT兜底|
|LOBLOCATOR|从属于CONN（  实际上应该要从属于ENV  ）|无交互|无交互|无，  此处可能需要增加CONN/ENV兜底释放|


###   [4.2 数据类型](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

#### 1、内部类型：

每一种实际的数据库建表类型对应一种内部类型，这种内部类型主要用于描述信息，用户在拿到具体数据库类型后可以自行决策要以哪种方式取出或插入

每一个内部类型都以YAC_TYPE_开头

|内部类型宏|建表名|
|---|---|
|YAC_TYPE_UNKNOWN = 0,|无|
|YAC_TYPE_BOOL = 1,|BOOL|
|YAC_TYPE_TINYINT = 2,|TINYINT|
|YAC_TYPE_SMALLINT = 3,|SMALLINT|
|YAC_TYPE_INTEGER = 4,|INTEGER|
|YAC_TYPE_BIGINT = 5,|BIGINT|
|YAC_TYPE_FLOAT = 10,|FLOAT|
|YAC_TYPE_DOUBLE = 11,|DOUBLE|
|YAC_TYPE_NUMBER = 12,|NUMBER|
|YAC_TYPE_DATE = 13,|DATE|
|YAC_TYPE_SHORTTIME = 15,|TIME|
|YAC_TYPE_TIMESTAMP = 16,|TIMESTAMP|
|YAC_TYPE_YM_INTERVAL = 19,|YM INTERVAL|
|YAC_TYPE_DS_INTERVAL = 20,|DS INTERVAL|
|YAC_TYPE_CHAR = 24,|CHAR|
|YAC_TYPE_NCHAR = 25,|NCHAR|
|YAC_TYPE_VARCHAR = 26,|VARCHAR|
|YAC_TYPE_NVARCHAR = 27,|NVARCHAR|
|YAC_TYPE_BINARY = 28,|BINARY|
|YAC_TYPE_CLOB = 29,|CLOB|
|YAC_TYPE_BLOB = 30,|BLOB|
|YAC_TYPE_BIT = 31,|BIT|
|YAC_TYPE_ROWID = 32,|ROWID|
|YAC_TYPE_NCLOB = 33,|NCLOB|
|YAC_TYPE_CURSOR = 34,|CURSOR|
|YAC_TYPE_JSON = 35,|JSON|
|YAC_TYPE_XML = 39,|XML|


#### 2、外部类型：

每一种外部类型对应一种可以实际绑定或者FETCH的类型

每一种外部类型都以YAC_SQLT_开头

每一种类型必须实现逻辑闭环，即支持入参绑定插入+fetch取出

|外部类型宏|C语言格式|说明|读接口|写接口|其他接口|
|---|---|---|---|---|---|
|YAC_SQLT_UNKNOWN = 0,|无|  
|  
|  
|  
|
|YAC_SQLT_BOOL = 1,|typedef bool YacBool;|  
|  
|  
|  
|
|YAC_SQLT_TINYINT = 2,|typedef int8_t YacInt8;|  
|  
|  
|  
|
|YAC_SQLT_SMALLINT = 3,|typedef int16_t YacInt16;|  
|  
|  
|  
|
|YAC_SQLT_INTEGER = 4,|typedef int32_t YacInt32;|  
|  
|  
|  
|
|YAC_SQLT_BIGINT = 5,|typedef int64_t YacInt64;|  
|  
|  
|  
|
|YAC_SQLT_FLOAT = 10,|typedef float YacFloat;|  
|  
|  
|  
|
|YAC_SQLT_DOUBLE = 11,|typedef double YacDouble;|  
|  
|  
|  
|
|YAC_SQLT_NUMBER = 12,|typedef struct StYacNumber {    
  YacUint8 numberPart[YAC_NUMBER_SIZE];    
  } YacNumber;|  
|无|无|yacNumberRound|
|YAC_SQLT_DATE = 13,|typedef YacInt64 YacDate;|  
|yacDateGetDate|yacDateSetDate|  
|
|YAC_SQLT_SHORTTIME = 15,|typedef YacInt64 YacShortTime;|  
|yacShortTimeGetShortTime|yacShortTimeSetShortTime|  
|
|YAC_SQLT_TIMESTAMP = 16,|typedef struct StYacTimestamp {    
  YacUint8 timestampPart[YAC_TIMESTAMP_SIZE];    
  } YacTimestamp;|  
|yacTimestampGetTimestamp|yacTimestampSetTimestamp|  
|
|YAC_SQLT_YM_INTERVAL = 19,|typedef YacInt32 YacYMInterval;|  
|yacYMIntervalGetYearMonth|yacYMIntervalSetYearMonth|  
|
|YAC_SQLT_DS_INTERVAL = 20,|typedef YacInt64 YacDSInterval;|  
|yacDSIntervalGetDaySecond|yacDSIntervalSetDaySecond,yacDSIntervalFromText|  
|
|YAC_SQLT_CHAR = 24,|typedef char YacChar;|准备废弃，但依旧兼容|  
|  
|  
|
|YAC_SQLT_VARCHAR = 26,|typedef char YacChar;|准备废弃，但依旧兼容|  
|  
|  
|
|YAC_SQLT_BINARY = 28,|typedef uint8_t YacUint8;|准备废弃，但依旧兼容|  
|  
|  
|
|YAC_SQLT_CLOB = 29,|typedef struct StYacLobLocator YacLobLocator;|  
|yacLobRead2|yacLobWrite2|yacLobDescAlloc2,yacLobDescFree2,yacLobGetChunkSize,yacLobGetLength,yacLobCreateTemporary2,yacLobFreeTemporary,yacLobIsTemporary,yacLobTrim,yacLobAppend,yacLobWriteAppend(,yacLobGetLength|
|YAC_SQLT_BLOB = 30,|typedef struct StYacLobLocator YacLobLocator;|  
|yacLobRead2|yacLobWrite2|同CLOB|
|YAC_SQLT_BIT = 31,|typedef uint8_t YacUint8;,需明确格式：  类似YacUint8 bit[2] = {0b10101010, 0b11111111};|  
|  
|  
|  
|
|YAC_SQLT_ROWID = 32,|typedef struct StYacRowId {    
  YacUint8 rowIdPart[YAC_ROWID_SIZE];    
  } YacRowId;|  
|yacRowIdToText|yacTextToRowId|  
|
|YAC_SQLT_NCLOB = 33,|typedef struct StYacLobLocator YacLobLocator;|  
|yacLobRead2|yacLobWrite2|同CLOB|
|YAC_SQLT_CURSOR = 34,|YacHandle stmt|  
|  
|  
|  
|
|YAC_SQLT_JSON = 35,|typedef struct StYacLobLocator YacLobLocator;|  
|yacLobRead2|yacLobWrite2|同CLOB|
|YAC_SQLT_XML = 39,|typedef struct StYacLobLocator YacLobLocator;|  
|yacLobRead2|yacLobWrite2|同CLOB|
|YAC_SQLT_CHAR2 = 100,|typedef char YacChar;|代替YAC_SQLT_CHAR|  
|  
|  
|
|YAC_SQLT_VARCHAR2 = 101,|typedef char YacChar;|代替YAC_SQLT_VARCHAR2|  
|  
|  
|
|YAC_SQLT_BINARY2 = 102,|typedef uint8_t YacUint8;|代替YAC_SQLT_BINARY|  
|  
|  
|


###   [4.3 元数据描述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

#### 1、select元数据描述接口：yacColAttribute

该接口通过执行yacPrepare，依据ACK报文中的信息返回select视图中列的元数据

|属性|描述|
|---|---|
|YAC_COL_ATTR_DISPLAY_SIZE|当前数据类型最大显示宽度是多少（服务端字节）,这个字段是为了准备使用字符串接住所有类型的应用准备的，可以提前告知其最大字节长度,如果客户端要应用，最好乘最大膨胀比率|
|YAC_COL_ATTR_NAME|列名，深拷贝|
|YAC_COL_ATTR_SIZE|列大小定义，列的最大服务端字节大小|
|YAC_COL_ATTR_TYPE|列类型宏值，和YAC_TYPE_XXX对应|
|YAC_COL_ATTR_PRECISION|列精度|
|YAC_COL_ATTR_SCALE|列刻度|
|YAC_COL_ATTR_NULLABLE|该列是否可为空|
|YAC_COL_ATTR_CHAR_SIZE|列的字符长定义，，列的最大服务端字符大小|
|YAC_COL_ATTR_CHAR_USED|列是否是字符长定义|
|YAC_COL_ATTR_DISPLAY_CHAR_SIZE|列的最大显示宽度（字符），使用时最好乘客户端字符集最大字符长度|


#### 2、获取结果集列个数

yacNumResultCols

#### 3、获取参数个数

yacNumParams

###   [4.4 句柄相关属性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

#### 1、env属性读取+设置：yacSetEnvAttr、yacGetEnvAttr

|属性|格式|说明|目前是否生效|默认值|生效时间节点|读写|备注|
|---|---|---|---|---|---|---|---|
|YAC_ATTR_CHARSET_CODE = 62,|YacUint32|客户端字符集设置|是|WIN:GBK,LINUX:UTF8|每次字符集转换时|读写|可以后设，OCI字符集只能在ENV初始化的时候设置,是否和OCI一致|


#### 2、conn属性读取+设置：yacSetConnAttr、yacGetConnAttr

|属性|格式|说明|目前是否生效|默认值|设置时间|生效时间节点|读写|备注|
|---|---|---|---|---|---|---|---|---|
|YAC_ATTR_AUTOCOMMIT = 3,|YacUint32  (是否应为YacBool)|自动提交|生效|关|无限制|下一次execute时|读写|OCI设置到STMT级别，我们  是否也可增加一个STMT级别自动提交设置  ，否则一些场景使用不方便|
|YAC_ATTR_LOGIN_TIMEOUT = 4,|YacUint32|连接超时时间，目前为5s|不生效|5s|无限制|下一次连接时|读写|是否应该将其生效  ，目前默认是5S|
|YAC_ATTR_PACKET_SIZE = 6,|YacUint32|报文大小，连接后同服务端PACKET_SIZE配置|不生效|128k|无限制|下一次连接时|读写|是否应该将其生效  ？，或者将其调整为客户端配置，客户端配置优先级高于服务端配置优先级？|
|YAC_ATTR_TXN_ISOLATION = 7,|YacUint8|事务隔离级别|生效|读已提交|连接成功后，当前连接的事务开始前|事务开始前|读写|typedef enum EnYacTxnIsolation {    
  YAC_TXN_READ_COMMITTED = 0,    
  YAC_TXN_CURR_COMMITTED = 1,    
  YAC_TXN_SERIALIZABLE = 2,    
  } YacTxnIsolation;|
|YAC_ATTR_CREDT = 11,|YacUint8|认证方式|生效|RDBMS|无限制|下一次连接时|读写|此处的设置选项  没有暴露到yacli.h，需要暴露,typedef enum StYacCredtType {    
  YAC_CRED_RDBMS = 0,    
  YAC_CRED_EXT = 1,    
  } YacCredtType;|
|YAC_ATTR_MAX_CHARSET_RATIO = 12,|YacUint32|客户端服务端字符集最大膨胀比率|生效|  
|  
|  
|读|  
|
|YAC_ATTR_TAF_ENABLED = 14,|YacBool|TAF是否开启|生效|  
|  
|  
|读|  
|
|YAC_ATTR_TAF_CALLBACK = 15,|YacTafCallbackStruct|TAF回调函数|生效|无|无限制|下一次触发TAF时|读写|  
|
|YAC_ATTR_MAX_NCHARSET_RATIO = 17,|YacUint32|客户端服务端国家字符集最大膨胀比率|生效|  
|  
|  
|读|  
|
|YAC_ATTR_HEARTBEAT_ENABLED = 18,|YacBool|心跳是否开启|生效|关|无限制|下一次连接时|读写|  
|


#### 3、stmt属性读取+设置：yacSetStmtAttr、yacGetStmtAttr

|属性|格式|说明|目前是否生效|默认值|生效时间节点|读写|备注|
|---|---|---|---|---|---|---|---|
|YAC_ATTR_PARAMSET_SIZE = 100,|YacUint32|批量插入行数|生效|1|下一次execute时|读写|  
|
|YAC_ATTR_ROWSET_SIZE = 101,|YacUint32|批量fetch行数|生效|1|下一次fetch时|读写|  
|
|YAC_ATTR_ROWS_FETECHED = 102,|YacUint32 or YacUint64|当前结果集已fetch行数|生效|  
|  
|读|  
|
|YAC_ATTR_ROWS_AFFECTED = 103,|YacUint32 or YacUint64|当前DML已影响行数|生效|  
|  
|读|  
|
|YAC_ATTR_CURSOR_EOF = 104,|YacBool|当前结果集是否已fetch完毕|生效|  
|  
|读|  
|
|YAC_ATTR_SQLTYPE = 105,|YacUint32|当前stmt的sql语句|生效|  
|  
|读|typedef enum EnYacSQLType {    
  YAC_SQLTYPE_UNKNOWN = 0,    
  YAC_SQLTYPE_QUERY = 1,    
  YAC_SQLTYPE_INSERT = 2,    
  YAC_SQLTYPE_UPDATE = 3,    
  YAC_SQLTYPE_DELETE = 4,    
  YAC_SQLTYPE_MERGE = 5,    
  YAC_SQLTYPE_GRANT = 69,    
  YAC_SQLTYPE_REVOKE = 70,    
  YAC_SQLTYPE_COMMIT = 132,    
  YAC_SQLTYPE_ROLLBACK = 133,    
  } YacSQLType;|
|YAC_ATTR_IMPLICIT_RESULT_COUNT = 113,|YacUint32|当前隐式结果集个数|生效|  
|  
|读|  
|
|YAC_ATTR_GET_DATA_SUPPORT = 114,|YacBool|当前是否开启yacGetData函数调用|生效|关|下一次yacGetData函数调用时|读写|  
|


###   [4.5 多种SQL执行方式](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

#### 1、PREPARE+EXECUTE

yacPrepare+yacExecute

#### 2、DIRECTEXECUTE

yacDirectExecute

###   [4.6 内存注入](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

通过ENV初始化时实现：

YacResult yacAllocEnvWithMemCb(YacHandle* env, YacPointer ctxp, YacMalocFunc malocFp, YacRalocFunc ralocFp, YacMfreeFunc mfreeFp);

提供注册内存上下文、malloc回调、realloc回调、free回调来实现应用程序内存接管

###   [4.7 批量插入](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d2f8970c2af4f5210d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

#### 1、普通数据

yacBindParameter+yacBindParameterByName中的bindSize不生效，采用定长offset

所有定长类型

![](https://pingcode.yasdb.com/atlas/files/public/67396d2fa1ad9a3311dc8f49/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

#### 2、变长数据

yacBindParameter+yacBindParameterByName中的bindSize生效

YAC_SQLT_CHAR

YAC_SQLT_VARCHAR

YAC_SQLT_BINARY

YAC_SQLT_CHAR2

YAC_SQLT_VARCHAR2

YAC_SQLT_BINARY2

YAC_SQLT_BIT

![](https://pingcode.yasdb.com/atlas/files/public/67396d2fa1ad9a3311dc8f4a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

#### 3、LOB数据

yacBindParameter+yacBindParameterByName中的bindSize不生效，采用定长为8的offset

YAC_SQLT_CLOB

YAC_SQLT_BLOB

YAC_SQLT_NCLOB

YAC_SQLT_JSON

YAC_SQLT_XML

![](https://pingcode.yasdb.com/atlas/files/public/67396d2fa1ad9a3311dc8f4b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

#### 4、高级变长类型

yacBindParameter+yacBindParameterByName中的bindSize不生效，采用定长为8的offset

YAC_SQLT_OBJSTRING

YAC_SQLT_OBJRAW

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d2fa1ad9a3311dc8f4d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

###   [4.8 批量获取](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

#### 1、普通数据

yacBindColumn中的bindSize不生效，采用定长offset

其他同批量插入

#### 2、变长数据

yacBindColumn中的bindSize不生效，采用定长offset

其他同批量插入

#### 3、LOB数据

yacBindColumn中的bindSize不生效，采用定长offset

其他同批量插入

#### 4、高级变长类型

yacBindColumn中的bindSize不生效，采用定长offset

其他同批量插入

###   [4.9 绑定方式](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

#### 1、静态缓冲区绑定

![](https://pingcode.yasdb.com/atlas/files/public/67396d2f8970c2af4f5210de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

#### 2、动态绑定

![](https://pingcode.yasdb.com/atlas/files/public/67396d2fa1ad9a3311dc8f4f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFFQUFDQUNDQWdJUWdBS0FBQUJLQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUVBQUFBZ2dBQUFBQUFRQUFBQUFBQ0FBQUFBQWdBQUFBQUFBQWdRQUFCQUFBQWlBQUFBQUFBQUFnQUFBQUFBZ0FBQUFBQUFBVUFBQUFBQUFBQUFBQUJDQUVBQVFBQUFBQUFRQUFBQUFBQUFBQUFBQUFRQmdBQUFnQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDIsImV4cCI6MTc4MjMxNzI0Mn0.gXIhYvgUaR3AU3lHJVS7iAze-4dnQU5DKfJMPbsGlas)

###   [4.10 fetch方式](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

同绑定方式

  


##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-1-2_19-19-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmVhMWFkOWEzMzExZGM4ZjM5IiwicmVmX2lkIjoiNjczOTZkMmU3MjgyMDZlZmI5MmYxYzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDQyLCJleHAiOjE3ODIzOTI4NDJ9.0rHVQQ-a95C0JE8EmK5ApaFIgtdLpSb9giuvrQ26_NQ)

 (image/png)    


[image2024-1-2_19-24-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmU4OTcwYzJhZjRmNTIxMGNjIiwicmVmX2lkIjoiNjczOTZkMmU3MjgyMDZlZmI5MmYxYzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDQyLCJleHAiOjE3ODIzOTI4NDJ9.WgiS4ZHoN6vmVXwtctLUX5ohd8PDo0Nl24udXJQHuMo)

 (image/png)    


[image2024-1-2_19-28-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmZhMWFkOWEzMzExZGM4ZjNmIiwicmVmX2lkIjoiNjczOTZkMmU3MjgyMDZlZmI5MmYxYzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDQyLCJleHAiOjE3ODIzOTI4NDJ9.bz9aWSnph9diQELMjx52e2aSTNMxXJ4vNCshA1mVkWY)

 (image/png)    


[image2024-1-2_19-30-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmZhMWFkOWEzMzExZGM4ZjQyIiwicmVmX2lkIjoiNjczOTZkMmU3MjgyMDZlZmI5MmYxYzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDQyLCJleHAiOjE3ODIzOTI4NDJ9.ue9unwAkZaYAFr5N8WDITu4QjdpXRsYJLnWqko6bKX4)

 (image/png)    


[image2024-1-2_20-45-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMmY4OTcwYzJhZjRmNTIxMGQ2IiwicmVmX2lkIjoiNjczOTZkMmU3MjgyMDZlZmI5MmYxYzE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDQyLCJleHAiOjE3ODIzOTI4NDJ9.2iFn7ep0uuRzBqPxV36R2g3jldniDuIAyVRBPYqvwPg)

 (image/png)    
