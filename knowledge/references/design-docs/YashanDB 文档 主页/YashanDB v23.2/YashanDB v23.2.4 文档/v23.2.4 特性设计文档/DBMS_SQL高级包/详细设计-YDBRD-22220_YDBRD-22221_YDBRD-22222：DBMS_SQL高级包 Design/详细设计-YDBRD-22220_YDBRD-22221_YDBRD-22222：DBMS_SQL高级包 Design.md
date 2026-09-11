Created by 未知用户 (liaofeng), last modified by  曾思尹 on 七月 08, 2024

  


IR链接：

  [YDBRD-17281](https://jira.yasdb.com/browse/YDBRD-17281?src=confmacro)    -  高级包DBMS_SQL新增函数  设计中

  [https://pingcode.yasdb.com/ship/ideas/66164960009f91eb87f36e83](https://pingcode.yasdb.com/ship/ideas/66164960009f91eb87f36e83)    ?    
  #YASHAN-2827 新增DBMS_SQL系统包子函数

SR链接：

  [YDBRD-22220](https://jira.yasdb.com/browse/YDBRD-22220?src=confmacro)    -  DBMS_SQL游标相关操作函数  开发中

  [YDBRD-22221](https://jira.yasdb.com/browse/YDBRD-22221?src=confmacro)    -  支持绑定参数函数  开发中

  [YDBRD-22222](https://jira.yasdb.com/browse/YDBRD-22222?src=confmacro)    -  支持结果集和描述信息的获取  开发中

  [https://pingcode.yasdb.com/pjm/items/66266796fd997db58adf292f](https://pingcode.yasdb.com/pjm/items/66266796fd997db58adf292f)    ?    
  #YDBRD-26590 新增DBMS_SQL系统包CHAR类型子函数

  [https://pingcode.yasdb.com/pjm/items/662667e1fd997db58adf293b](https://pingcode.yasdb.com/pjm/items/662667e1fd997db58adf293b)    ?    
  #YDBRD-26591 新增DBMS_SQL系统包RAW类型子函数

  


##   [1. 总述](#1-总述)  

DMBS_SQL高级包提供了一组接口用于动态解析执行DML和DDL语句。需要实现相关游标相关操作子过程、绑定参数操作子过程和结果集和信息获取子过程，以及配套的常量和异常。

**DBMS_SQL子过程**

DMBS_SQL高级包提供了一组接口用于动态解析执行DML和DDL语句。包含游标相关操作子过程、绑定参数操作子过程和结果集和信息获取子过程。

  


**DBMS_SQL常量**

本次需求还关联有一个DBMS_SQL常量

|名称|数据类型|值|说明|
|---|---|---|---|
|NATIVE|INTEGER|1|指定程序连接的正常行为|


**DBMS_SQL异常**

COLUMN_VALUE子过程或者VARIABLE_VALUE子过程当给定的参数类型与值得类型不匹配时，抛出inconsistent_type异常。

###   [1.1 需求来源](#11-需求来源)  

客户使用DMBS_SQL高级包相关子程序。需求来源部署形态为单机。

###   [1.2 调研文档](#12-调研文档)  

详细调研文档见    [特性调研-YDBRD-22220/YDBRD-22221/YDBRD-22222：DBMS_SQL高级包](https://conf.yasdb.com/pages/viewpage.action?pageId=135610574)    。

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|dbms_sql游标操作函数|通过改写复用原有过程体游标能力支持|是|是|
|功能|dbms_sql绑定变量操作函数|通过编写一套sender接口支持|是|是|
|功能|dbms_sql结果集和描述信息获取函数|通过使用execute接口和fetch接口，以及新增sender接口实现|是|是|
|功能|dbms_sql常量|使用常量框架新增常量|否|是|
|功能|dbms_sql异常|使用异常框架新增异常|否|是|
|周边配合|权限|复用原有权限能力|否|是|
|部署模式|支持单机和集群，分布式 暂不支持|---|否|否|
|性能|性能场景1|------|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|子过程体|高级包的子函数和子存储过程|否|参考技术设计链接|
|CursorWrapper|在PLSQL用于给游标进行包装|否|参考游标设计文档|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|BIND_ARRAY procedure|内置高级包子存储过程|将给定值绑定到给定集合。|是|
|BIND_VARIABLE procedure|内置高级包子存储过程|将给定值绑定到给定变量。|是|
|BIND_VARIABLE_RAW procedure|内置高级包子存储过程|将给定值（raw类型）绑定到给定变量。|是|
|BIND_VARIABLE_CHAR procedure|内置高级包子存储过程|将给定值（char类型）绑定到给定变量。|是|
|CLOSE_CURSOR procedure|内置高级包子存储过程|关闭给定游标并释放内存。|是|
|COLUMN_VALUE procedure|内置高级包子存储过程|返回游标中给定位置的游标元素的值。|是|
|COLUMN_VALUE_RAW procedure|内置高级包子存储过程|返回游标中给定位置的游标元素的值（出参为raw类型）。|是|
|COLUMN_VALUE_CHAR procedure|内置高级包子存储过程|返回游标中给定位置的游标元素的值（出参为char类型）。|是|
|DEFINE_ARRAY procedure|内置高级包子存储过程|定义要从给定游标中选择的集合，仅用于SELECT语句。|是|
|DEFINE_COLUMN procedrue|内置高级包子存储过程|定义要从给定游标中选择的列，仅用于SELECT语句。|是|
|DEFINE_COLUMN_RAW procedrue|内置高级包子存储过程|定义要从给定游标中选择的列（raw类型），仅用于SELECT语句。|是|
|DEFINE_COLUMN_CHAR procedrue|内置高级包子存储过程|定义要从给定游标中选择的列（char类型），仅用于SELECT语句。|是|
|DESCRIBE_COLUMNS procedure|内置高级包子存储过程|描述DBMS_SQL打开并解析的游标的列。|是|
|EXECUTE function|内置高级包子函数|执行给定的游标。|是|
|EXECUTE_AND_FETCH function|内置高级包子函数|执行给定的游标并读取行。|是|
|FETCH_ROWS function|内置高级包子函数|从给定游标中读取一行。|是|
|IS_OPEN function|内置高级包子函数|如果给定游标处于打开状态，则返回TRUE。|是|
|OPEN_CURSOR function|内置高级包子函数|返回新游标的游标 ID 号。|是|
|PARSE procedure|内置高级包子存储过程|解析给定的语句。|是|
|VARIABLE_VALUE procedure|内置高级包子存储过程|返回给定游标的命名变量的值。|是|
|VARIABLE_VALUE_RAW procedure|内置高级包子存储过程|返回给定游标的命名变量的值（出参为raw类型）。|是|
|VARIABLE_VALUE_CHAR procedure|内置高级包子存储过程|返回给定游标的命名变量的值（出参为char类型）。|是|
|TO_REFCURSOR Function|内置高级包子函数|此函数将一个open、parse和execute过的游标，转换为一个PL/SQL内的REF CURSOR（weakly-typed）。只能对select游标使用。|是|
|TO_CURSOR_NUMBER Function|内置高级包子函数|此函数将一个open的ref cursor转换为由dbms_sql管理的游标，返回其id号。|是|
|DBMS_SQL.NATIVE常量|内置高级包常量|内置高级包常量，INTEGER类型，值为1，用于指定程序连接的数据的正常行为。|是|
|DBMS_SQL.inconsistent_type异常|内置高级包异常|COLUMN_VALUE子过程或者VARIABLE_VALUE子过程当给定的参数类型与值得类型不匹配时，抛出inconsistent_type异常。|是|


##   [3. 规格与约束](#3-规格与约束)  

1. PL/SQL中游标的上限是300个。普通plsq游标和dbms_sql游标共同占用。


##   [4. 特性](#4-特性)  

**DBMS_SQL子过程**

DMBS_SQL高级包提供了一组接口用于动态解析执行DML和DDL语句。包含游标相关操作子过程、绑定参数操作子过程和结果集和信息获取子过程。

|功能集|子程序|描述|备注|
|---|:---|:---|---|
|游标相关操作|DBMS_SQL.OPEN_CURSOR Function|返回新游标的游标 ID 号。|  
|
||DBMS_SQL.PARSE Function|解析给定的语句。|  
|
||DBMS_SQL.EXECUTE Function|执行给定的游标。|  
|
||DBMS_SQL.CLOSE_CURSOR Procedure|关闭给定游标并释放内存。|  
|
||DBMS_SQL.IS_OPEN Function|对于已打开但未关闭的任何游标编号，返回 TRUE，对于NULL游标（close_cursor的出参返回NULL）编号，返回 FALSE。|  
|
||DBMS_SQL.TO_REFCURSOR Function|此函数将一个open、parse和execute过的游标，转换为一个PL/SQL内的REF CURSOR（weakly-typed）。只能对select游标使用。|  
|
||DBMS_SQL.  TO_CURSOR_NUMBER Function|此函数将一个open的ref cursor转换为由dbms_sql管理的游标，返回其id号。|  
|
|绑定参数相关操作,  
|DBMS_SQL.BIND_VARIABLE Procedures|将给定值按名绑定到绑定参数。|（UDT，VARRAY）|
||DBMS_SQL.BIND_VARIABLE_RAW Procedure|将给定RAW类型值按名绑定到绑定参数。|  
|
||DBMS_SQL.  BIND_VARIABLE_CHAR   Procedure|将给定CHAR类型值按名绑定到绑定参数。|  
|
||DBMS_SQL.BIND_ARRAY Procedure|将给定array值按名绑定到绑定参数|  
|
||DBMS_SQL.VARIABLE_VALUE Procedure|获取绑定参数值，赋值给变量|  
|
||DBMS_SQL.  VARIABLE_VALUE_RAW   Procedure|获取绑定参数值，赋值给RAW类型变量|  
|
||DBMS_SQL.  VARIABLE_VALUE_CHAR   Procedure|获取绑定参数值，赋值给CHAR类型变量|  
|
|结果集和描述信息获取|DBMS_SQL.DEFINE_COLUMN Procedure|定义要从给定游标中选择的列，仅用于    `SELECT`    语句。|（UDT，VARRAY）|
|  
|DBMS_SQL.DEFINE_COLUMN_RAW Procedure|定义要从给定游标中选择的列（RAW类型），仅用于    `SELECT`    语句。|  
|
|  
|DBMS_SQL.DEFINE_COLUMN_CHAR Procedure|定义要从给定游标中选择的列（CHAR类型），仅用于    `SELECT`    语句。|  
|
|  
|  [DBMS_SQL.DEFINE_ARRAY Procedure](https://conf.yasdb.com/display/YAS/DBMS_SQL.DEFINE_ARRAY+Procedure)  |定义要从给定游标中选择的集合，仅用于    `SELECT`    语句。|  
|
|  
|DBMS_SQL.EXECUTE_AND_FETCH Function|执行给定的游标并读取行。|  
|
|  
|DBMS_SQL.FETCH Function|从给定的游标中获取一行|  
|
|  
|DBMS_SQL.COLUMN_VALUE Procedure|返回游标中给定位置的游标元素的值。|  
|
|  
|DBMS_SQL.COLUMN_VALUE_RAW Procedure|返回游标中给定位置的游标元素的值（返回RAW类型）。|  
|
|  
|DBMS_SQL.COLUMN_VALUE_CHAR Procedure|返回游标中给定位置的游标元素的值（返回CHAR类型）。|  
|
|其他|DBMS_SQL.DESCRIBE_COLUMNS Procedure|描述游标的列信息|  
|
|  
|DBMS_SQL.LAST_ERROR_POSITION Function|返回最后的错误的字节偏移位置|  
|


**DBMS_SQL常量**

本次需求还关联有一个DBMS_SQL常量

|名称|数据类型|值|说明|
|---|---|---|---|
|NATIVE|INTEGER|1|指定程序连接的正常行为|


**DBMS_SQL异常**

COLUMN_VALUE子过程或者VARIABLE_VALUE子过程当给定的参数类型与值得类型不匹配时，抛出inconsistent_type异常。

**DBMS_SQL类型**

**总体执行流程**

1. **OPEN_CURSOR**
1. **PARSE**   （缺少parse，后续报错no statement parsed）
1. **BIND_VARIABLE, BIND_ARRAY**   （缺少bind_variable，execute阶段报错 not all variables bound）
1. **DEFINE_COLUMN， DEFINE_ARRAY**   （缺少define_column，column_value报错variable not in select list）
1. **EXECUTE**   （缺少execute，fetch_row报错fetch out of sequence；variable_value不影响入参值获取，column_value获取空值）
1. **FETCH_ROWS or EXECUTE_AND_FETCH**  （缺少fetch_rows，variable_value不影响入参值获取，column_value获取空值）
1. **VARIABLE_VALUE, COLUMN_VALUE**
1. **CLOSE_CURSOR**


![](https://pingcode.yasdb.com/atlas/files/public/67396db78970c2af4f5214c6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQWtBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBaEFBQUFBQVFBQUFBQUFBb0FBQUFBQUFBZ0JBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUVBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEwMjgsImV4cCI6MTc4MjMyMTgyOH0.Jl_9pn5Na2GRfeYpnw-1gE6QzfzocPRpsgtN80GYGwk)

###   [4.1 特性设计](#41-特性设计)  

###   [4.1.1 dbms_sql cursor设计](#411-dbms-sql-cursor设计)  

1. 复用已有SoWrapper结构体。由原来stmt->soExecInfo级别资源修改为handler级别资源（同时为了不影响原有游标功能，soExecInfo上新增openCursors保存已打开的cursor，执行结束时释放）。
1. 未主动关闭游标时，执行结束不会自动关闭游标，待session断连时检查释放。（建议不需要再使用游标时主动释放，否则可能造成游标资源紧张）
1. 在stmt上增加bindValues和defineColumns链表。有用于处理绑定参数和define Column。
1. 未主动使用close_cursor关闭游标，游标将保持当前执行状态。（可以跨执行语句）
1. session断连时释放未主动close的游标。


![](https://pingcode.yasdb.com/atlas/files/public/67396db78970c2af4f5214c7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQWtBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBaEFBQUFBQVFBQUFBQUFBb0FBQUFBQUFBZ0JBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUVBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEwMjgsImV4cCI6MTc4MjMyMTgyOH0.Jl_9pn5Na2GRfeYpnw-1gE6QzfzocPRpsgtN80GYGwk)

**相关结构体**

```
typedef struct StSoWrappers {
    CodUint16   freeCount;
    CodUint16   bound;

    CodUint16   hwm;
    CodUint16   extCount;
    CodPointer  extents[SO_WRAPPERS_EXTENTS]; // equal 10 == (300 / 30)
    CodPointer  owner;
} SoWrappers;

typedef struct StCursorWrapper {
    CodUint16         stmtid;  // resource, point to stmtid
    CodUint8          flags;
    volatile CodUint8 refcount;
    CodUint32         securityLevel;
} CursorWrapper;


```

###   [4.1.2 dbms_sql绑定变量设计](#412-dbms-sql绑定变量设计)  

1. dbms_sql绑定变量以及获取绑定变量值与execute和fetch的执行是分离的，需要在stmt上增加bindValues数组（成员为AnlParamItem）保存绑定变量值，使用MemHeap内存，生命周期同游标，
1. 在bind_variable阶段，保存type，size等信息，如果是入参，将变量值深拷贝到bindValues内。
1. 新增dbmsSqlSender接口组。dbmsSqlReadbinds将bindValue浅拷贝到paramItem上（注意出参不需要拷贝）。在fetch结束时，通过dbmsSqlSendOutParam将paramItem浅拷贝到bindValue上。
1. 在variable_value阶段，将bindValues赋值到变量上。
1. close_cursor时释放bindValues内存。


![](https://pingcode.yasdb.com/atlas/files/public/67396db78970c2af4f5214c8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQWtBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBaEFBQUFBQVFBQUFBQUFBb0FBQUFBQUFBZ0JBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUVBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEwMjgsImV4cCI6MTc4MjMyMTgyOH0.Jl_9pn5Na2GRfeYpnw-1gE6QzfzocPRpsgtN80GYGwk)

###   [4.1.3 dbms_sql结果集获取设计](#413-dbms-sql结果集获取设计)  

1. stmt上新增defineColumns（成员为AnlParamItem），临时保存结果集。
1. define_columns，首次执行时initDefineColumns，保存type和size
1. fetch结果集时，通过新增的dbmsSqlSendRows，将结果集发送到defineColumns上（检查size，不足截断）。
1. column_value阶段，从defineColumns上检索需要获取的值，进行类型判断，赋值给变量。
1. close_cursor释放defineColumns内存。


![](https://pingcode.yasdb.com/atlas/files/public/67396db7a1ad9a3311dc9339/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQWtBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBaEFBQUFBQVFBQUFBQUFBb0FBQUFBQUFBZ0JBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUVBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEwMjgsImV4cCI6MTc4MjMyMTgyOH0.Jl_9pn5Na2GRfeYpnw-1gE6QzfzocPRpsgtN80GYGwk)

**相关数据结构**

```
typedef struct StAnlParamItem {
    Variant   value;
    union {
        struct {
            CodUint8  proType;
            CodUint8  proDir;  // for parameter binding
            CodUint8  precision;
            CodInt8   scale;
            CodUint16 version;
            CodUint16 size;
        };
        SoUdtDef* udtDef;
        TypeRef*  typeRef;
    };
    
    CodUint16  properties;
    CodUint16  argPos;
    CodUint8   flags;
    CodUint8   isChar : 1;
    CodUint8   reserved : 7;
    CodUint8   unused[2];
} AnlParamItem;


static AnlSender gDbmsSqlSender = {
    .sendPrepResult  = dbmsSqlSendPrepResult,
    .sendExecBegin   = dbmsSqlSendExecBegin,
    .sendExecEnd     = dbmsSqlSendExecEnd,
    .sendFetchBegin  = dbmsSqlSendFetchBegin,
    .sendFetchEnd    = dbmsSqlSendFetchEnd,
    .sendDmlResult   = dbmsSqlSendDmlResult,
    .sendVariant     = dbmsSqlSendVariant,
    .sendBytes       = dbmsSqlSendBytes,
    .sendLob         = dbmsSqlSendLob,
    .sendRow         = dbmsSqlSendRow,
    .sendOutput      = dbmsSqlSendOutput,
    .sendResultSet   = dbmsSqlSendResultSet,
    .readBindings    = dbmsSqlReadBindings,
};


```

###   [4.1.4 DBMS_SQL安全](#414-dbms-sql安全)  

1. DBMS_SQL子过程的调用均以当前用户的权限运行。
1. DBMS_SQL子过程使用了一个未打开的游标id时，进行报错，但不禁止当前会话的合法使用。
1. 调用bind或executi子过程时，检查与最近parse时的current_user是否相同（open_cursor的默认级别为1）。


###   [4.1.5 DBMS_SQL.OPEN_CURSOR Function](#415-dbms-sqlopen-cursor-function)  

打开一个新游标。

###   [功能特性](#功能特性)  

1. **语法**


```
DBMS_SQL.OPEN_CURSOR (
   security_level                 IN     INTEGER    DEFAULT 1,
   treat_as_client_for_results    IN     BOOLEAN    DEFAULT FALSE) 
  RETURN INTEGER;

```

1. **参数**


**以下参数除特殊说明外，均为可隐式转换的类型，下同**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|treat_as_client_for_results|BOOLEAN|IN|否|FALSE|语法兼容。|
|security_level|INTEGER|1|否|--|只支持级别1，级别0和级别2为语法兼容。|


1. **返回值**


返回新游标的cursor ID，INTEGER类型。

####   [规格与约束](#规格与约束)  

1. 创建的新游标与open游标变量类似，会占用cursor_wrapper（最大300个）。
1. 创建的游标若未关闭，将在当前session一致占用cursor_wrapper，并且处于可用状态，直到手动close_cursor。
1. 游标是session级别资源，不可以跨session使用。
1. 游标可以重复运行相关的SQL或新的SQL语句，而不需要重新关闭打开游标。解析新的SQL语句时，将重置相应游标数据区域的内容。
1. 如果参数只有一个显式NULL，默认重载参数为treat_as_client_for_results。（oracle报错PLS-00307: too many declarations of 'OPEN_CURSOR' match this call）
1. security_level只支持级别1，在bind_variable和execute阶段检查userId是否与parse阶段相同。


####   [详细设计](#详细设计)  

1. 原有的SoWrappers是stmt级别的资源，现在需要搬迁到anlHandler上。
1. 执行open_cursorh函数时，从SoWrappers上分配一个新的CursorWraper，并且分配一个stmt(类似于open语句)。
1. 返回值设置为cursorWrpper的wid。


###   [4.1.6 DMBS_SQL.CLOSE_CURSOR Procedure](#416-dmbs-sqlclose-cursor-procedure)  

此过程关闭一个给定的游标，分配给游标的内存将被释放，并且无法再从该游标获取。

####   [功能特性](#功能特性-1)  

1. **语法**


```
DBMS_SQL.CLOSE_CURSOR (
   c    IN OUT INTEGER);

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN OUT|是|--|入参为想要关闭的cursor id，出参被设置为NULL。|


####   [规格与约束](#规格与约束-1)  

1. 被释放后的游标不可再使用，否则报错DBMS_SQL access denied。


####   [详细设计](#详细设计-1)  

1. 检查c的合法性。
1. 关闭soWrapper，释放stmt资源。
1. 设置出参。


###   [4.1.7 DBMS_SQL.PARSE Procedure](#417-dbms-sqlparse-procedure)  

在给定的游标中解析给定的语句。所有语句都会立即解析，此外DDL语句会在解析时立即运行（DDL语句使用execute函数不生效）。

####   [功能特性](#功能特性-2)  

1. **语法**


```
DBMS_SQL.PARSE (
   c                           IN   INTEGER,
   statement                   IN   VARCHAR2,
   language_flag               IN   INTEGER[
 [,edition                     IN   VARCHAR2 DEFAULT NULL],
   apply_crossedition_trigger  IN   VARCHAR2 DEFAULT NULL,
   fire_apply_trigger          IN   BOOLEAN DEFAULT TRUE]
 [,schema                      IN   VARCHAR2 DEFAULT NULL]
 [,container                   IN   VARCHAR2)];

or

DBMS_SQL.PARSE (
   c                           IN   INTEGER,
   statement                   IN   CLOB,
   language_flag               IN   INTEGER[
 [,edition                     IN   VARCHAR2 DEFAULT NULL],
   apply_crossedition_trigger  IN   VARCHAR2 DEFAULT NULL,
   fire_apply_trigger          IN   BOOLEAN DEFAULT TRUE]
 [,schema                      IN   VARCHAR2 DEFAULT NULL]
 [,container                   IN   VARCHAR2)];  

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要解析语句使用的游标ID。字符串类型报错PLS-00307: too many declarations of 'PARSE' match this call|
|statement|VARCHAR2/CLOB/VARCHAR2A/VARCHAR2S/|IN|是|--|需要解析的SQL语句，大于32K的语句可以存储在CLOB内。（与PLSQL语句不同，SQL语句不需要末尾分号）|
|language_flag|INTEGER|IN|是|--|语法兼容。 1. 合法值为0-6。|
|edition|VARCHAR2|IN|否|NULL|语法兼容|
|apply_crossedition_trigger|VARCHAR2|IN|否|NULL|语法兼容|
|fire_apply_trigger|BOOLEAN|IN|否|TRUE|语法兼容|
|schema|VARCHAR2|IN|否|NULL|指定解析非限定对象名称的schema，如果为NULL，则为当前生效的user schema。1.不存在的schema报错 2. 不区分大小写 3. 支持双引号|
|container|VARCHAR2|IN|否|--|语法兼容|


####   [规格与约束](#规格与约束-2)  

1. 如果需要解析的SQL语句大于32K，推荐使用CLOB版本的parse。
1. SQL语句最大值不超过2M。
1. DML语句中不可以间接执行DDL语句。
1. 非字符类型隐式转换（oracle可能会报错too many declarations of 'PARSE' match this call）


####   [详细设计](#详细设计-2)  

1. 使用soPrepareDynSql解析SQL语句，对于大于32K的数据，使用largeBlock保持sql文本。
1. 检查绑定参数是否'?'，有则报错。
1. 执行anlPrepare2，如果设置了schema，切换currUserId和currUser
1. 如果是DDL语句，直接执行SQL语句。


###   [4.1.8 DBMS_SQL.EXECUTE Function](#418-dbms-sqlexecute-function)  

该函数执行给定cursor id对应的游标，返回已处理的函数。

####   [功能特性](#功能特性-3)  

1. **语法**


```
DBMS_SQL.EXECUTE (
   c   IN INTEGER)
  RETURN INTEGER;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要执行的cursor id。|


1. **返回值**


返回已处理的行数，INTEGER类型。返回值只对INSERT，UPDATE和DELETE语句有效。其他类型的语句（包括DDL），返回值未定义（返回0？）。

####   [规格和约束](#规格和约束)  

1. 可以对同一个cursor多次执行，对于SELECT语句，将重置FETCH游标。


####   [详细设计](#详细设计-3)  

1. 检查cursor id是否合法。
1. 使用anlExecute执行（DDL跳过执行）
1. 对于INSERT，UPDATE和DELETE语句，返回cursor->attr.totalFetchNum。


###   [4.1.9 IS_OPEN Function](#419-is-open-function)  

此函数检查给定游标当前是否处于打开状态。

####   [功能特性](#功能特性-4)  

1. **语法**


```
DBMS_SQL.IS_OPEN (
   c              IN INTEGER)
  RETURN BOOLEAN;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要判断打开状态的cursor id。|


1. **返回值**


对于已打开但未关闭的任何游标编号，返回 TRUE，对于NULL游标（close_cursor的出参返回NULL）编号，返回 FALSE。

###   [规格与约束](#规格与约束-3)  

1. 入参为NULL时不报错。


###   [详细设计](#详细设计-4)  

1. 检查是否为NULL，为NULL返回FALSE。
1. 判断cursor是否合法，再判断是否为打开状态。若不合法或非打开状态，报错。


###   [4.1.10 DBMS_SQL.BIND_VARIABLE Procedures](#4110-dbms-sqlbind-variable-procedures)  

根据语句中绑定参数的名称将值绑定到游标中的绑定参数。

####   [功能特性](#功能特性-5)  

1. **语法**


```
DBMS_SQL.BIND_VARIABLE (
   c              IN INTEGER,
   name           IN VARCHAR2,
   value          IN &lt;datatype&gt;);

or

DBMS_SQL.BIND_VARIABLE (
   c              IN INTEGER,
   name           IN VARCHAR2,
   value          IN VARCHAR2 CHARACTER SET ANY_CS [,out_value_size IN INTEGER]);


```

datatype可为任何SQL支持的类型？。

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|要绑定值的游标的 ID 号。|
|name|VARCHAR2|IN|是|--|语句中变量的名称。1. 同名的绑定变量名称只需绑定一次，多次绑定以最后一次为准（与execute immediate有差异）。|
|value|datatype中定义的数据类型|IN|是|--|要绑定到游标中的变量的值。|
|out_value_size|INTEGER|IN|否|--|对于VARCHAR2、RAW、CHAR类型的OUT或IN/OUT变量，指定最大的出参值size（以字节为单位）。1. 如果没给定，默认为当前value的长度，如果value未初始化，则必须给定该参数。（若size小于实际返回的size，报错）2.如果给定了size，则默认重载为varchar类型，若size小于value长度，对value进行截断|


###   [规格与约束](#规格与约束-4)  

1. 对于IN或IN/OUT的绑定参数，给定的绑定值需要是合法值。对于OUT方向的绑定参数，绑定值将忽略。
1. 绑定的数量少于实际绑定参数数量（包括缺少out方向的绑定参数），execute阶段报错
1. SQL 语句的绑定变量或集合由其名称标识。将值绑定到绑定变量或绑定数组时，在语句中标识该值的字符串必须包含前导冒号，（?形式的绑定参数不好支持），如以下示例所示


```
SELECT emp_name FROM emp WHERE SAL &gt; :X;

```

对应的绑定调用中的name参数的冒号可加可不加

```
BIND_VARIABLE(cursor_name, ':X', 3500); 

or

BIND_VARIABLE (cursor_name, 'X', 3500);

```

####   [详细设计](#详细设计-5)  

1. 检查cursor id合法性
1. 若未初始化bindValues，进行初始化
1. 遍历parseTree->params，按名匹配绑定参数。若未匹配到报错退出。
1. 若匹配到了绑定参数，将value的值深拷贝到bindValues上。


###   [4.1.11 BIND_VARIABLE_RAW Procedure](#4111-bind-variable-raw-procedure)  

**语法**

```
DBMS_SQL.BIND_VARIABLE_RAW (
   c              IN INTEGER,
   name           IN VARCHAR2,
   value          IN RAW [,out_value_size IN INTEGER]);

```

其他同BIND_VARIABLE procedure。

###   [4.1.12 BIND_VARIABLE_CHAR Procedure](#4112-bind-variable-char-procedure)  

**语法**

```
DBMS_SQL.BIND_VARIABLE_CHAR (
   c              IN INTEGER,
   name           IN VARCHAR2,
   value          IN CHAR CHARACTER SET ANY_CS [,out_value_size IN INTEGER]);

```

其他同BIND_VARIABLE procedure。

###   [4.1.13 BIND_ARRAY Procedure](#4113-bind-array-procedure)  

此过程根据语句中变量的名称将集合变量绑定给游标中的绑定变量。(用于bulk array binds，实现类似FORALL的功能)

1. **语法**


```
DBMS_SQL.BIND_ARRAY ( 
   c                   IN INTEGER, 
   name                IN VARCHAR2, 
   &lt;table_variable&gt;    IN &lt;datatype&gt; 
 [,index1              IN INTEGER, 
   index2              IN INTEGER)] ); 

```

其中<table_variable>以及对应的<datatype>可以是以下类型

```
TYPE binary_double_table IS TABLE OF BINARY_DOUBLE  INDEX BY BINARY_INTEGER;
TYPE binary_float_table IS TABLE OF BINARY_FLOAT   INDEX BY BINARY_INTEGER;
TYPE blob_table     IS TABLE OF BLOB           INDEX BY BINARY_INTEGER;
TYPE clob_table     IS TABLE OF CLOB           INDEX BY BINARY_INTEGER;
TYPE date_table     IS TABLE OF DATE           INDEX BY BINARY_INTEGER;
TYPE interval_day_to_second_table IS TABLE OF INTERVAL DAY TO SECOND INDEX BY BINARY_INTEGER;
TYPE interval_year_to_month_table IS TABLE OF INTERVAL YEAR TO MONTH INDEX BY BINARY_INTEGER;
TYPE number_table   IS TABLE OF NUMBER         INDEX BY BINARY_INTEGER;
TYPE timestamp_table IS TABLE OF timestamp INDEX BY BINARY_INTEGER;
TYPE time_table IS TABLE OF TIME INDEX BY BINARY_INTEGER;
TYPE varchar2_table IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|要绑定值的游标的 ID 号。|
|name|VARCHAR2|IN|是|--|语句中变量的名称。绑定变量名称的长度必须为 <=30 个字节。（经测试实际是超过41字节报错，为parse阶段报错）。1. 同名的绑定变量名称只需绑定一次，多次绑定以最后一次为准（与execute immediate有差异）。2.不区分大小写|
|table_variable|datatype中定义的数据类型|IN|是|--|要绑定到游标中的table变量的值。|
|index1|INTEGER|IN|否||table元素的下限索引，不可为NULL|
|index2|INTEGER|IN|否||table元素的上限索引，不可为NULL|


1. **规格约束**


- table_variable只能使用dbms_sql中定义的类型
- index2必须大于等于index1
- index1和index2可省略，则为varray.first和varray.last
- index1和index2间可以不连续，使用next获取下一个index值
- index1和index2需要是存在的下标，否则报错
- 每次执行都将重新从index1开始
- BAND_ARRAY和DEFINE_ARRAY不能同时存在。
- BAND_ARRAY和BIND_VARIABLE可以同时存在，bind_variable的绑定变量每次使用相同值


####   [详细设计](#详细设计-6)  

1. 检查cursor id合法性
1. 检查index1，index2的合法性
1. 若未初始化bindValues，进行初始化
1. 遍历parseTree->params，按名匹配绑定参数。若未匹配到报错退出。
1. 若匹配到了绑定参数，将nest_table的值深拷贝到bindValues上，同时标记为bind_array。
1. 执行DML语句时，如果发现是bulk array binds，循环调用anlexecute，在dbmsSqlReadBindings时，通过next方法循环获取nest_table的成员，将成员拷贝到绑定变量内。


###   [4.1.14 VARIABLE_VALUE Procedure](#4114-variable-value-procedure)  

此过程返回给定游标的命名变量的值。它用于返回带有返回子句的 PL/SQL 块或 DML 语句中的绑定变量的值。

####   [功能特性](#功能特性-6)  

1. **语法**


```
--for single Row
DBMS_SQL.VARIABLE_VALUE (
   c               IN  INTEGER,
   name            IN  VARCHAR2,
   value           OUT NOCOPY &lt;datatype&gt;);

```

datatype可以为任何SQL类型？

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|想要获取值对应的cursor id。|
|name|VARCHAR|IN|是|--|需要获取值的绑定参数名称。1. 不存在的name报错ORA-01006: bind variable does not exist 2.前导冒号可选 3. 不区分大小写|
|value|上述的<dataType>指定的类型|OUT|是|--|返回指定绑定参数的值。1.如果此输出参数的类型与实际类型（调用BIND_VARIABLE所定义的）不匹配，将会抛出RA-06562, inconsistent_type异常。2.可以重复获取值 3. 入参也可以获取值|


###   [规格与约束](#规格与约束-5)  

1. 未执行bind_variable就直接执行variable_value。报错。
1. 执行了bind_variable，但未执行execute，直接执行variable_value。不报错，且可以正常获取入参值。
1. 重新parse，会重置bindValues。


####   [详细设计](#详细设计-7)  

1. 检查cursor id合法性
1. 检查bindValues是否初始化过，未初始化报错。
1. 遍历parseTree->params，按名匹配绑定参数，未匹配报错
1. 匹配时，从bindValues上获取绑定参数值，赋值给value出参。


###   [4.1.15 VARIABLE_VALUE_RAW Procedure](#4115-variable-value-raw-procedure)  

**语法**

```
DBMS_SQL.VARIABLE_VALUE_RAW (
   c               IN  INTEGER,
   name            IN  VARCHAR2,
   value           OUT RAW);

```

其他同VARIABLE_VALUE procedure。

###   [4.1.16 VARIABLE_VALUE_CHAR Procedure](#4116-variable-value-char-procedure)  

**语法**

```
DBMS_SQL.VARIABLE_VALUE_CHAR (
   c               IN  INTEGER,
   name            IN  VARCHAR2,
   value           OUT CHAR CHARACTER SET ANY_CS);

```

其他同VARIABLE_VALUE procedure。

由于value为char类型出参，会按实参的字符串缓冲区大小来填充空格。

###   [4.1.17 DBMS_SQL.DEFINE_COLUMN Procedure](#4117-dbms-sqldefine-column-procedure)  

此过程定义一个从给定游标中被select的列，此过程只能用于SELECT游标。

列由SELECT投影中的相对位置确定，column参数的类型决定了所定义的列的类型。

####   [功能特性](#功能特性-7)  

1. **语法**


```
DBMS_SQL.DEFINE_COLUMN (
   c              IN INTEGER,
   position       IN INTEGER,
   column         IN &lt;datatype&gt;);

or

DBMS_SQL.DEFINE_COLUMN (
   c              IN INTEGER,
   position       IN INTEGER,
   column         IN VARCHAR2 CHARACTER SET ANY_CS,
   column_size    IN INTEGER);

```

datatype可为任何SQL支持的类型。

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|要定义的行的cursor id|
|position|INTEGER|IN|是|--|定义列的相对位置，下标从1开始。1. 非法position报错ORA-01007: variable not in select list|
|column|列出的<datatype>类型|IN|是|--|要定义的列的值。此值的类型决定了所定义列的类型。1. 不要求与投影列类型相同，在column_value阶段检查是否可隐式转换|
|column_size|INTEGE|IN|否|--|VARCHAR2 类型的列的列值的最大预期大小（若指定为字符长度的类型，则使用字符长度，其他以字节长度）。1. 定义了column_size即默认column列为varchar类型 2. 若column_size比实际返回值小，截断。|


###   [规格与约束](#规格与约束-6)  

1. 重复定义同一个position不报错，以最后一次定义为准。


###   [详细设计](#详细设计-8)  

1. 检查sql语句类型是否为QUERY。
1. 通过parseTree->columns检查定义的define_columns是否合法。
1. stmt上新增defineColumns保存当前cursor的define columns。


###   [4.1.18 DEFINE_COLUMN_RAW Procedure](#4118-define-column-raw-procedure)  

**语法**

```
DBMS_SQL.DEFINE_COLUMN_RAW (
   c              IN INTEGER,
   position       IN INTEGER,
   column         IN RAW,
   column_size    IN INTEGER);

```

其他同DEFINE_COLUMN procedure。

###   [4.1.19 DEFINE_COLUMN_CHAR Procedure](#4119-define-column-char-procedure)  

**语法**

```
DBMS_SQL.DEFINE_COLUMN_CHAR (
   c              IN INTEGER,
   position       IN INTEGER,
   column         IN CHARACTER SET ANY_CS,
   column_size    IN INTEGER);

```

其他同DEFINE_COLUMN procedure。

column_size以字节为单位（若指定为字符长度的类型，则使用字符长度），若column_size比实际返回值小，截断。

###   [4.1.20 DEFINE_ARRAY Procedurec](#4120-define-array-procedurec)  

此过程定义需要fetch的列。通过此过程，可以从select语句中fetch多行到nest_table变量。当fetch行时，结果集复制到dbms_sql的buffer中，直到执行column_value，将buffer中的值复制到column_value的出参中。

###   [功能特性](#功能特性-8)  

1. **语法**


```
DBMS_SQL.DEFINE_ARRAY (
   c           IN INTEGER, 
   position    IN INTEGER,
   &lt;table_variable&gt;    IN &lt;datatype&gt; 
   cnt         IN INTEGER, 
   lower_bnd   IN INTEGER);


```

其中<table_variable>以及对应的<datatype>可以是以下任何一对匹配，DEFINE_ARRAY将重载以接受不同数据类型。

```
&lt;clob_tab&gt;     Clob_Table
&lt;bflt_tab&gt;     Binary_Float_Table
&lt;bdbl_tab&gt;     Binary_Double_Table
&lt;blob_tab&gt;     Blob_Table
&lt;bfile_tab&gt;    Bfile_Table
&lt;date_tab&gt;     Date_Table
&lt;num_tab&gt;      Number_Table
&lt;urowid_tab&gt;   Urowid_Table
&lt;vchr2_tab&gt;    Varchar2_Table
&lt;tms_tab&gt;      Timestamp_Table
&lt;ids_tab&gt;      Interval_Day_To_Second_Table
&lt;iym_tab&gt;      Interval_Year_To_Month_Table

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要绑定array的cursor id。|
|position|INTEGER|IN|是|--|定义列的相对位置，下标从1开始。1. 非法position报错|
|table_variable|表中定义的<datatype>|IN|是|--|声明为<datatype>类型的局部变量。1. 只可是dbms_sql内部定义的类型 2.多次define，以最后一次定义为准。|
|cnt|INTEGER|IN|是|--|一次fetch的行数。1. 大于实际可以fetch的最大行数，则一次fetch全部行 2. 不同列调用define_array的cnt不同，取最小值|
|lower_bnd|INTEGER|IN|是|--|结果复制到集合中，从此下限索引开始。1. 可为正数，负数或零。|


####   [规格和约束](#规格和约束-1)  

- cnt参数必须是大于0的整数。
- lower_bnd可以为正数、负数或零。
- DEFINE_ARRAY不能同时包含define_column
- 发出DEFINE_ARRAY调用的查询不能包含bind_array，但可以bind_variable绑定数组。
- index在execute时初始化为指定的lower_bnd，每次调用column_value时更新，如果重新execute，define的索引将重置为lower_bnd


####   [详细设计](#详细设计-9)  

1. 检查sql语句是否为query。
1. 检查游标是否有使用过define_column或bind_array。
1. 通过parseTree->columns检查定义的define_columns是否合法。
1. 使用stmt上的defineColumns保存define_column定义，同时标记为define_array，使用<datatype>初始化nest_table变量。
1. fetch_rows时判断如果是define_array场景，类似bulk语法，循环调用anl_fetch。直到没有数据或者到达cnt数量。sendVariant时，从lower_bnd开始赋值。
1. column_value时将值从缓冲区赋值给出参，同时更新lower_bnd。


###   [4.1.21 DBMS_SQL.FETCH_Rows Function](#4121-dbms-sqlfetch-rows-function)  

此函数从给定的游标中获取一行。

只要还有待提取的函数，就可以重复调用。这些行被检索到缓冲区中，并且必须要在每次调用FETCH_ROWS之后使用COLUMN_VALUE读取每列。

###   [功能特性](#功能特性-9)  

1. **语法**


```
DBMS_SQL.FETCH_ROWS (
   c              IN INTEGER)
  RETURN INTEGER;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|cursor ID|


1. **返回值**


返回实际读取的行数，INTEGER类型。

####   [规格与约束](#规格与约束-7)  

1. 未进行execute的游标就进行fetch_rows报错。
1. fetch_rows获取不到数据，第一次获取空数据，如果再进行fetch报错。
1. 只有query语句才可以进行fetch。


####   [详细设计](#详细设计-10)  

1. 检查cursor id的合法性，以及sql语句类型是否为QUERY，cursor是否处于未EXECUTE状态。
1. 执行anlfetch,通过新增的dbmsSqlSendRow将值发送给defineColumns的变量区。
1. 返回cursor->attr.totalFetchNum。


###   [4.1.22 EXECUTE_AND_FETCH Function](#4122-execute-and-fetch-function)  

此函数执行给定的游标并fetch行。

此函数与EXECUTE后再执行FETCH_ROWS的效果相同。

####   [功能特性](#功能特性-10)  

1. **语法**


```
DBMS_SQL.EXECUTE_AND_FETCH (
   c              IN INTEGER,
   exact          IN BOOLEAN DEFAULT FALSE)
  RETURN INTEGER;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|execute和fetch的cursor id。|
|exact|BOOLEAN|IN|否|FALSE|1. 设置为FASE，查不到数据或查到多行数据均不报错，2.设置为TRUE，检查fetch结果是否为1行，否则报错|


####   [规格与约束](#规格与约束-8)  

1. 非QUERY语句报错。


####   [详细设计](#详细设计-11)  

1. 检查cursor对应的sql语句类型是否为QUERY。
1. 执行anlExecute和anlFetch，通过新增的dbmsSqlSendRow将值发送给defineColumns的变量区。
1. 若设置了exact参数，检查fetch结果是否为1行。


###   [4.1.23 COLUMN_VALUE Procedure](#4123-column-value-procedure)  

此过程返回给定游标中给定位置的投影列的值，此过程用于访问FETCH_ROWS获取的数据。

####   [功能特性](#功能特性-11)  

1. **语法**


```
DBMS_SQL.COLUMN_VALUE (
   c                 IN  INTEGER,
   position          IN  INTEGER,
   value             OUT &lt;datatype&gt; 
 [,column_error      OUT NUMBER] 
 [,actual_length     OUT INTEGER]);

```

datatype可为任何SQL支持的类型。

1. **参数**


**Single Row**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|想要获取值对应的cursor id。|
|position|INTEGER|IN|是|--|列在cursor中的相对位置。语句中的第一列的位置为 1。1. position顺序不要求 2.position非法报错|
|value|上述的<dataType>指定的类型|OUT|是|--|返回指定列的值。1.如果此输出参数的类型与实际类型（调用DEFINE_COLUMN所定义的）不匹配，抛出异常。2. 如果输出参数类型与实际类型匹配，但与投影列类型不一致，只在隐式转换时检查|
|column_error|NUMBER|OUT|否|--|返回指定列值的任何错误代码。1. column_value执行不报错，返回0。2. column_value执行报错，测试返回也是0。|
|actual_length|INTEGER|OUT|否|--|指定列的值在截断之前的实际长度。1. 字符类型返回实际长度 2. 非字符类型没有明显规律）|


####   [规格与约束](#规格与约束-9)  

####   [详细设计](#详细设计-12)  

1. 检查sql语句类型是否为QUERY。
1. 通过parseTree->columns判断position的合法性
1. 从stmt上的defineColumns获取值（未定义的position报错）
1. 进行类型检查，若value的类型与define_column定义的类型不同，报错。
1. 赋值给变量。


###   [4.1.24 COLUMN_VALUE_RAW Procedure](#4124-column-value-raw-procedure)  

**语法**

```
DBMS_SQL.COLUMN_VALUE_RAW (
   c               IN  INTEGER,
   position        IN  INTEGER,
   value           OUT RAW
 [,column_error    OUT NUMBER]
 [,actual_length   OUT INTEGER]);

```

其他同COLUMN_VALUE procedure。

###   [4.1.25 COLUMN_VALUE_CHAR Procedure](#4125-column-value-char-procedure)  

**语法**

```
DBMS_SQL.COLUMN_VALUE_CHAR (
   c               IN  INTEGER,
   position        IN  INTEGER,
   value           OUT CHAR CHARACTER SET ANY_CS
 [,column_error    OUT NUMBER]
 [,actual_length   OUT INTEGER]);

```

其他同COLUMN_VALUE procedure。

由于value为char类型出参，会按实参的字符串缓冲区大小来填充空格，actual_length返回的实际长度不包含填充的空格。

###   [4.1.26 DESCRIBE_COLUMNS Procedure](#4126-describe-columns-procedure)  

此过程描述由dbms_sql打开并解析的游标的投影列

####   [功能特性](#功能特性-12)  

1. **语法**


```
DBMS_SQL.DESCRIBE_COLUMNS ( 
   c              IN  INTEGER, 
   col_cnt        OUT INTEGER, 
   desc_t         OUT DESC_TAB);

```

DESC_TAB定义

```
TYPE desc_rec IS RECORD (
      col_type            BINARY_INTEGER := 0,
      col_max_len         BINARY_INTEGER := 0,
      col_name            VARCHAR2(64)   := '',
      col_name_len        BINARY_INTEGER := 0,
      col_schema_name     VARCHAR2(64)   := '',
      col_schema_name_len BINARY_INTEGER := 0,
      col_precision       BINARY_INTEGER := 0,
      col_scale           BINARY_INTEGER := 0,
      col_charsetid       BINARY_INTEGER := 0,
      col_charsetform     BINARY_INTEGER := 0,
      col_null_ok         BOOLEAN        := TRUE);
TYPE desc_tab IS TABLE OF desc_rec INDEX BY BINARY_INTEGER;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|所描述列对应的cursor id。|
|col_cnt|INTEGER|OUT|是|--|返回select投影列的列数。|
|desc_t|DESC_TAB|OUT|是|--|描述table，返回查询中每列的描述。. 类型必须为DBMS_SQL.DESC_TAB，否则报错PLS-00306: wrong number or types of arguments in call to 'DESCRIBE_COLUMNS'。2. 非select语句，报错ORA-00900: invalid SQL statement|


1. **使用说明**
1. 需要先执行parse后才能再执行describe_columns
1. select语句才可以执行describe_columns
1. 不会呈现invisible列的信息。
1. 绑定参数列呈现默认推导列信息。


####   [详细设计](#详细设计-13)  

1. 检查游标id。
1. 检查游标是否已经parse过，且为query语句。
1. 获取context->parseTree->columns获取投影列信息。构造一个desc_tab类型的variant，循环将rsColumn的信息给成员赋值(跳过invisible列)，最后赋值给出参。
1. udt类型通过toid获取schema_name
1. 赋值col_cnt出参。


###   [4.1.27 LAST_ERROR_POSITION](#4127-last-error-position)  

此函数返回SQL语句报错位置的字节偏移量，从0开始。

####   [语法功能](#语法功能)  

**语法**

```
DBMS_SQL.LAST_ERROR_POSITION 
   RETURN INTEGER;

```

**返回值**

返回SQL语句报错位置的字节偏移量。

####   [规格约束](#规格约束)  

1. 该函数须在调用dbms_sql.parse后，调用其他dbms_sql子过程前调用。execute阶段如果原有错误信息设置了pos，则也可以获取last_error_position。
1. 如果原有报错不包含pos，则不会更新last_error_position。
1. 多次parse，以最后一次parse为准
1. 没有语法错误时，last_error_position为0
1. 记录的last_error_position在下次open_cursor或close_cursor时清除。


####   [详细设计](#详细设计-14)  

1. 在原有的CodTextPos内增加offset表示字节偏移量。
1. 原有更新TextPos->column的位置，增加更新offset。
1. 设置错误码的pos时，保存错误信息偏移，
1. parse或execute执行错误时，在handler上记录pos


###   [4.1.28 TO_REFCUROSR Function](#4128-to-refcurosr-function)  

此函数将一个open、parse和execute过的游标，转换为一个PL/SQL内的REF CURSOR（weakly-typed）。只能对select游标使用。

####   [功能特性](#功能特性-13)  

1. **语法**


```
DBMS_SQL.TO_REFCURSOR(
   cursor_number IN OUT INTEGER)
  RETURN SYS_REFCURSOR;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|cursor_number|INTEGER|IN OUT|是|--|入参为被转换的cursor id，出参被设置为NULL|


1. **返回值**


转换后的sys_refcursor，弱类型。

####   [规格与约束](#规格与约束-10)  

1. 传入的游标必须为open，parse和execute过的，其他情况将报错（fetch过也可以，但不能fetch到eof的）。
1. 只能对select游标使用。
1. 一旦cursor_number被转换为ref cursor后，cursor_number将不能被其他dbms_sql使用（包括DBMS_SQL.IS_OPEN）。


####   [详细设计](#详细设计-15)  

1. 检查游标语句是否为query
1. 检查游标是否已经状态是否为STMT_STATUS_EXECUTE，且不为EOF
1. 设置返回值为sys_refcursor，通过游标信息设置vCursor内容
1. 设置出参


###   [4.1.29 TO_CURSOR_NUMBER Function](#4129-to-cursor-number-function)  

此函数将一个open的ref cursor转换为由dbms_sql管理的游标，返回其id号。

####   [功能特性](#功能特性-14)  

1. **语法**


```
DBMS_SQL.TO_CURSOR_NUMBER(
   rc IN OUT SYS_REFCURSOR)
  RETURN INTEGER;

```

1. **参数**


|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|rc|SYS_REFCURSOR|IN OUT|是|--|入参为ref cursor，出参被设置为无效的游标|


1. **返回值**


转换后的cursor id。

####   [规格与约束](#规格与约束-11)  

1. 传入的游标必须为open，否则报错。
1. 一旦ref cursor被转换为cursor number后，任何本地动态SQL操作都无法再访问ref cursor（报错无效的游标）。
1. 转换后的cursor为等同于executed后的游标，且无法再进行execute。
1. fetch到eof的游标可以转换


####   [详细设计](#详细设计-16)  

1. 检查游标是否为ref cursor
1. 检查游标是否处于open状态
1. 将游标资源转为由dbms_sql管理，设置返回值为dbms_sql游标id号，增加无法再次执行的标志位
1. 设置出参为无效游标


###   [4.1.30 DMBS_SQL常量](#4130-dmbs-sql常量)  

**相关数据结构**

```
typedef struct StBipNameSpaceItem {
    AnlAppHeap        appHeap;
    CodChar           buf[COD_NAME_BUFFER_SIZE];
    CodText           packName;
    CodPointer        packContext;
    CodUint8          flag;
    CodUint8          unused[7];
    union {
        Variant*      headVars;
        AnlParamItem* headItem;
    };
} BipNameSpaceItem;

typedef struct StBipItem {
    CodText     name;
    BipItemType type;
    CodUint32   sid;
    union {
        // BIP_ITEM_FUNCTION / BIP_ITEM_PROCEDURE
        struct {
            CodPointer entry;
            CodPointer argList;
            CodUint32  argsCount;
        };
        // BIP_ITEM_PROPERTY
        struct {
            CodPointer packContext;
            CodPointer propertyText;
            CodPointer varDef;
            CodPointer propertyInit;
        };
        // BIP_ITEM_TYPE
        struct {
            CodPointer  typeText;
            CodPointer  typeDecl;
            CodPointer  typeInit;
        };
        BipException* exception;
    };
} BipItem;

```

**编译阶段适配**

1. soFindPackageItem阶段增加bipFindItem流程。尝试找到bipItem。
1. 首次访问创建和初始化bip的context。
1. 变量blockId注册为SO_GLOBAL_BLOCK_ID，addrType注册为VAR_ADDR_BIP。


**执行阶段适配**

1. 在soGetGlobalVarValue阶段，通过判断addrType为VAR_ADDR_BIP进入soGetBipVarValue流程。
1. 首次加在创建和初始化bipNamespace，变量存在bipNamespace的AnlAppHeap内。
1. 后续通过bip名字匹配对应的bipNamespaceItem。
1. 通过sid获取对应变量。


###   [4.1.31 DBMS_SQL类型](#4131-dbms-sql类型)  

####   [4.1.31.1 DBMS_SQL DESC_REC Record Type](#41311-dbms-sql-desc-rec-record-type)  

它是 DESC_TAB 表类型和 DESCRIBE_COLUMNS 过程的元素类型。

**语法**

```
TYPE desc_rec IS RECORD (
      col_type            BINARY_INTEGER := 0,
      col_max_len         BINARY_INTEGER := 0,
      col_name            VARCHAR2(64)   := '',
      col_name_len        BINARY_INTEGER := 0,
      col_schema_name     VARCHAR2(64)   := '',
      col_schema_name_len BINARY_INTEGER := 0,
      col_precision       BINARY_INTEGER := 0,
      col_scale           BINARY_INTEGER := 0,
      col_charsetid       BINARY_INTEGER := 0,
      col_charsetform     BINARY_INTEGER := 0,
      col_null_ok         BOOLEAN        := TRUE);
TYPE desc_tab IS TABLE OF desc_rec INDEX BY BINARY_INTEGER;

```

**字段**

|字段|类型|默认值|说明|
|---|---|---|---|
|col_type|BINARY_INTEGER|0|列类型|
|col_max_len|BINARY_INTEGER|0|最大列长度|
|col_name|VARCHAR2(64)|''|列名称|
|col_name_len|BINARY_INTEGER|0|列名称长度|
|col_schema_name|VARCHAR2(64)|''|列schema名称|
|col_schema_name_len|BINARY_INTEGER|0|列schema名称长度|
|col_precision|BINARY_INTEGER|0|列precision|
|col_scale|BINARY_INTEGER|0|列scale|
|col_charsetid|BINARY_INTEGER|0|列字符串id|
|col_charsetform|BINARY_INTEGER|0|列字符集格式（保留字段）|
|col_null_ok|BOOLEAN|TRUE|列是否可能为NULL，TRUE说明可能为NULL|


####   [4.1.31.2 DBMS_SQL DESC_TAB Table Type](#41312-dbms-sql-desc-tab-table-type)  

用于保存describe_column获取列描述信息

**语法**

```
TYPE desc_tab IS TABLE OF desc_rec INDEX BY BINARY_INTEGER;

```

####   [4.1.31.3 DBMS_SQL TABLE Types For Scalar and LOB Collections](#41313-dbms-sql-table-types-for-scalar-and-lob-collections)  

用于define_array和bind_array

**语法**

```
TYPE binary_double_table IS TABLE OF BINARY_DOUBLE  INDEX BY BINARY_INTEGER;
TYPE binary_float_table IS TABLE OF BINARY_FLOAT   INDEX BY BINARY_INTEGER;
TYPE blob_table     IS TABLE OF BLOB           INDEX BY BINARY_INTEGER;
TYPE clob_table     IS TABLE OF CLOB           INDEX BY BINARY_INTEGER;
TYPE date_table     IS TABLE OF DATE           INDEX BY BINARY_INTEGER;
TYPE interval_day_to_second_table IS TABLE OF INTERVAL DAY TO SECOND INDEX BY BINARY_INTEGER;
TYPE interval_year_to_month_table IS TABLE OF INTERVAL YEAR TO MONTH INDEX BY BINARY_INTEGER;
TYPE number_table   IS TABLE OF NUMBER         INDEX BY BINARY_INTEGER;
TYPE timestamp_table IS TABLE OF timestamp INDEX BY BINARY_INTEGER;
TYPE time_table IS TABLE OF TIME INDEX BY BINARY_INTEGER;
TYPE urowid_table IS TABLE OF UROWID INDEX BY BINARY_INTEGER;
TYPE varchar2_table IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;


```

###   [4.1.32 DBMS_SQL异常](#4132-dbms-sql异常)  

**DBMS_SQL.inconsistent_type**

当COLUMN_VALUE Procedure或VARIABLE_VALUE Procedure的value类型与定义的值（通过DEFINE_COLUMN或BIND_VARIABLE)不同时，引发此异常。

使用内置高级包异常框架增加异常。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

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

## Attachments:

[image2023-11-24_10-42-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjZhMWFkOWEzMzExZGM5MzMxIiwicmVmX2lkIjoiNjczOTZkYjY1OTNmOTljOWZmMjM3ZWM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMDI4LCJleHAiOjE3ODIzOTc0Mjh9.I50x_6y3DIUq4fbxTe7Yt0NFLJ7hvwR3Pgcgzdoh0-8)

 (image/png)    


[image2023-11-24_14-15-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjY4OTcwYzJhZjRmNTIxNGMwIiwicmVmX2lkIjoiNjczOTZkYjY1OTNmOTljOWZmMjM3ZWM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMDI4LCJleHAiOjE3ODIzOTc0Mjh9.QbF9GlYOv7zY-Dvq3FCdwFA7XIhrISAaiPaRMfzCIA0)

 (image/png)    


[image2023-11-28_9-19-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjZhMWFkOWEzMzExZGM5MzM2IiwicmVmX2lkIjoiNjczOTZkYjY1OTNmOTljOWZmMjM3ZWM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMDI4LCJleHAiOjE3ODIzOTc0Mjh9.rcRA_IGL9MUP0HfV-LCl4OANdFHuvp-3A0RamGHi9o0)

 (image/png)    


## Comments:

|  [](null)  ,1. insert into select + bind_array场景调研
1. bind_array +  select建议保持oracle一致的结果（调研oracle23情况）
1. dbms_sql内置table类型数量建议保持保持当前规格。
,Posted by liaofeng at 五月 22, 2024 16:55|
|---|
