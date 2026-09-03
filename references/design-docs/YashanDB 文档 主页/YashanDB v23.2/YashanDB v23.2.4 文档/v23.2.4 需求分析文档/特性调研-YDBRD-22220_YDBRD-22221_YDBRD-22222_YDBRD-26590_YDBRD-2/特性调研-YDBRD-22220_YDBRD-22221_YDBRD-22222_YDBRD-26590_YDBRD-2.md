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

  [oracle文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SQL.html#GUID-EBEDD4D2-EC2C-4E96-AB57-40AC7E009BBF)  

DBMS_SQL高级包提供了一组接口用于动态解析执行DML和DDL语句。

###   [1.1 需求合理性分析](#11-需求合理性分析)  

DBMS_SQL高级包是一组常用的内置高级包。在实际外场使用中多有用到。

###   [1.2 需求实现分析](#12-需求实现分析)  

###   [1.2.1 DBMS_SQL安全](#121-dbms-sql安全)  

DBMS_SQL是使用AUTHID CURRENT_USER编译的，任何DBMS_SQL子过程体的调用都以当前用户的权限运行。

####   [防止恶意或意外访问打开的游标编号](#防止恶意或意外访问打开的游标编号)  

当DBMS_SQL子过程体使用了一个未打开的游标id时，将raise ORA-29471错误，并且向警报日志发出警报，同时在当前会话内，DBMS_SQL将无法执行。

IS_OPEN子过程体返回数据的游标编号在当前session是否为OPEN。在session是OPEN的游标编号，返回TURE，如果输入NULL返回

FALSE，如果为未打开的游标，raise ORA-29471错误。

####   [防止游标的不当使用](#防止游标的不当使用)  

游标受到保护，不会受到破坏已知现有游标的安全漏洞的影响。

在绑定和执行时进行检查。或者，可以对每个DBMS_SQL子程序调用执行检查。

- 在调用子过程体时，与最新解析时的current_user相同。
- 在调用子过程体时，与最新解析时的enabled roles相同（当使用AUTHID DEFINER模式时，不检查）。
- 在调用子过程体时，与最新解析时的container相同。


检查失败将raise ORA-29470错误。

###   [1.2.2 DBMS_SQL常量](#122-dbms-sql常量)  

|名称|数据类型|值|说明|
|---|---|---|---|
|v6|INTEGER|0|指定oracle版本6的行为|
|NATIVE|INTEGER|1|指定程序连接的数据的正常行为|
|V7|INTEGER|2|指定oracle版本7的行为|
|FOREIGN_SYNTAX|INTEGER|4294967295|指定非 Oracle 数据库语法和行为。需要首先使用数据库会话中设置的 SQL 转换配置文件转换要解析的 SQL 语句进行转换。SQL 转换配置文件是一个数据库架构对象，用于指导如何将 SQL 语句转换为 Oracle。如果未设置配置文件，则会引发错误。|


###   [1.2.3  DBMS_SQL执行流程](#123--dbms-sql执行流程)  

按照以下流程执行

1. **OPEN_CURSOR**
1. **PARSE**  （缺少parse，后续报错ORA-01003: no statement parsed）
1. **BIND_VARIABLE, BIND_ARRAY**   （缺少bind_variable，execute阶段报错ORA-01008: not all variables bound）
1. **DEFINE_COLUMN， DEFINE_ARRAY**   （缺少define_column，column_value报错ORA-01007: variable not in select list）
1. **EXECUTE**   （缺少execute，fetch_row报错ORA-01002: fetch out of sequence；variable_value不影响入参值获取，column_value获取空值）
1. **FETCH_ROWS or EXECUTE_AND_FETCH**  （缺少fetch_rows，variable_value不影响入参值获取，column_value获取空值）
1. **VARIABLE_VALUE, COLUMN_VALUE**
1. **CLOSE_CURSOR**


![](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/img/arpls008.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIwMzgsImV4cCI6MTc4MjMyMjgzOH0.QBP8bhCI7spyr-hTgjKqcrQFGRxnIbHRTkgqNsiV2Mo)

###   [1.2.4 DBMS_SQL异常](#124-dbms-sql异常)  

COLUMN_VALUE子过程或者VARIABLE_VALUE子过程当给定的参数类型与值得类型不匹配时，抛出inconsistent_type异常。

```
inconsistent_type EXCEPTION;
  pragma exception_init(inconsistent_type, -6562);


```

匹配的错误信息

```
ORA-06562: type of out argument must match type of column or bind variable

```

###   [1.2.5 DBMS_SQL子过程体](#125-dbms-sql子过程体)  

|子程序|描述|
|---|---|
|BIND_ARRAY procedure|将给定值绑定到给定集合。|
|BIND_VARIABLE procedure|将给定值绑定到给定变量。|
|BIND_VARIABLE_RAW procedure|将给定值（raw类型）绑定到给定变量。|
|BIND_VARIABLE_CHAR procedure|将给定值（char类型）绑定到给定变量。|
|CLOSE_CURSOR procedure|关闭给定游标并释放内存。|
|COLUMN_VALUE procedure|返回游标中给定位置的游标元素的值。|
|COLUMN_VALUE_RAW procedure|返回游标中给定位置的游标元素的值（返回raw类型）。|
|COLUMN_VALUE_CHAR procedure|返回游标中给定位置的游标元素的值（返回char类型）。|
|DEFINE_ARRAY procedure|定义要从给定游标中选择的集合，仅用于    `SELECT`    语句。|
|DEFINE_COLUMN procedrue|定义要从给定游标中选择的列，仅用于    `SELECT`    语句。|
|DEFINE_COLUMN_RAW procedrue|定义要从给定游标中选择的列（raw类型），仅用于    `SELECT`    语句。|
|DEFINE_COLUMN_CHAR procedrue|定义要从给定游标中选择的列（char类型），仅用于    `SELECT`    语句。|
|DESCRIBE_COLUMNS procedure|描述    `DBMS_SQL`    打开并解析的游标的列。|
|EXECUTE function|执行给定的游标。|
|EXECUTE_AND_FETCH function|执行给定的游标并读取行。|
|FETCH_ROWS function|从给定游标中读取一行。|
|IS_OPEN function|如果给定游标处于打开状态，则返回    `TRUE`    。|
|OPEN_CURSOR function|返回新游标的游标 ID 号。|
|PARSE procedure|解析给定的语句。|
|VARIABLE_VALUE procedure|返回给定游标的命名变量的值。|
|VARIABLE_VALUE_RAW procedure|返回给定游标的命名变量的值（返回raw类型）。|
|VARIABLE_VALUE_CHAR procedure|返回给定游标的命名变量的值（返回char类型）。|
|LAST_ERROR_POSITION function|返回sql语句中报错的字节偏移位置，从0字节开始。|
|TO_REFCURSOR function|将一个open、parse或execute过的游标转换为ref Cursor(weakly typed)。|
|TO_CURSOR_NUMBER function|将一个open的ref cursor转换为dbms_sql管理的cursor，返回cursor id号。|


####   [1.2.5.1 OPEN_CURSOR Function](#1251-open-cursor-function)  

用于打开一个新游标。（经测试，占用了cursor wrapper，且未主动关闭时，当前session将一直被占用）

**语法**

```
DBMS_SQL.OPEN_CURSOR (
   treat_as_client_for_results    IN     BOOLEAN    DEFAULT FALSE) 
  RETURN INTEGER;

or

DBMS_SQL.OPEN_CURSOR (
   security_level                 IN     INTEGER,
   treat_as_client_for_results    IN     BOOLEAN    DEFAULT FALSE) 
  RETURN INTEGER;

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|treat_as_client_for_results|BOOLEAN|IN|否|FALSE|允许递归语句的调用方将自身设置为客户端，以接收从递归语句返回给客户端的语句结果。返回的语句结果可由 GET_NEXT_RESULT 过程检索。|
|security_level|INTEGER|IN|否|--|指定要对打开的游标强制执行的安全保护级别。有效的安全级别值为 0、1 和2 。当向此重载提供NULL参数值时，以及对于使用不带参数的 open_cursor 重载打开的游标，将对打开的游标强制执行默认安全级别值。|


安全保护级别：

- ***Level 0：***   允许DBMS_SQL对游标进行所有操作，而无需进行任何安全检查。游标可以从代码中获取，甚至可以重新绑定和重新执行，这些代码使用与分析游标时有效的有效用户 ID 或角色不同的有效用户 ID 或角色运行。默认情况下，此安全级别处于关闭状态。
- ***Level 1：***   要求DBMS_SQL在此游标上执行绑定和执行操作的调用方的引用容器、有效用户 ID 和角色必须与此游标上最近一次解析操作的调用方的角色相同。
- ***Level 2：***   要求DBMS_SQL调用方在此游标上执行的所有绑定、执行、定义、描述和获取操作的引用容器、有效用户 ID 和角色必须与此游标上最近一次解析操作的调用方的角色相同。


**pragmas**

```
pragma restrict_references(open_cursor,RNDS,WNDS);

```

**返回值**

返回新游标的cursor ID，INTEGER类型。

**使用说明**

- 当不再需要此游标时，需要调用CLOSE_CURSOR procedure显式关闭，若未关闭，将在当前session一直占用，并且处于上次执行结束状态，继续可用。
- 游标是session级别资源，不可跨session使用。
- 您可以使用游标重复运行相同的 SQL 语句或运行新的 SQL 语句。重用游标时，解析新的 SQL 语句时，将重置相应游标数据区域的内容。在重用游标之前，不需要关闭并重新打开游标。


####   [1.2.5.2 PARSE Procedure](#1252-parse-procedure)  

在给定的游标中解析给定的语句。所有语句都会立即解析，此外，DDL语句会在解析时立即运行。

PARSE Procedure有多个版本：

- 以VARCHAR2类型的语句作为入参
- 以一个分段字符串，一段使用VARCHAR2A（TABLE OF VARCHAR2(32767)），另一段使用VARCHAR2S（TABLE OF VARCHAR(256)）的语句作为入参，可以通过这些过程解析超过varchar2长度限制的语句。
- 以一个CLOB类型的语句作为入参，用于解析超过32k字节的sql语句。


**语法**

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

or 

DBMS_SQL.PARSE (
   c                           IN   INTEGER, 
   statement                   IN   VARCHAR2A,
   lb                          IN   INTEGER, 
   ub                          IN   INTEGER,
   lfflg                       IN   BOOLEAN, 
   language_flag               IN   INTEGER[
 [,edition                     IN   VARCHAR2 DEFAULT NULL],
   apply_crossedition_trigger  IN   VARCHAR2 DEFAULT NULL,
   fire_apply_trigger          IN   BOOLEAN DEFAULT TRUE]
 [,schema                      IN   VARCHAR2 DEFAULT NULL]
 [,container                   IN   VARCHAR2)];
 
DBMS_SQL.PARSE (
   c                           IN   INTEGER, 
   statement                   IN   VARCHAR2s,
   lb                          IN   INTEGER, 
   ub                          IN   INTEGER,
   lfflg                       IN   BOOLEAN, 
   language_flag               IN   INTEGER[
 [,edition                     IN   VARCHAR2 DEFAULT NULL],
   apply_crossedition_trigger  IN   VARCHAR2 DEFAULT NULL,
   fire_apply_trigger          IN   BOOLEAN DEFAULT TRUE]
 [,schema                      IN   VARCHAR2 DEFAULT NULL]
 [,container                   IN   VARCHAR2)];


```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要解析语句使用的游标ID。字符串类型报错PLS-00307: too many declarations of 'PARSE' match this call|
|statement|VARCHAR2/CLOB/VARCHAR2A/VARCHAR2S/|IN|是|--|需要解析的SQL语句，大于32K的语句可以存储在CLOB内。（与PLSQL语句不同，SQL语句不需要末尾分号）|
|lb|INTEGER|IN|否|--|语句中elements的下限|
|ub|INTEGER|IN|否|--|语句中elements的上限|
|lfflg|BOOLEAN|IN|否|--|若为TRUE，则在每个elements后增加换行|
|language_flag|INTEGER|IN|是|--|指定 SQL 语句的行为。有关可能的值及其相应行为的详细信息，请参阅DBMS_SQL常量。   1. 合法值为0-6，大于6报错ORA-29327: unsupported client compatibility mode used when talking to the server，小于0报错ORA-01426: numeric overflow。 2.number类型小数截断，binary_float/double类型四舍五入    3. 字符串类型报错PLS-00307: too many declarations of 'PARSE' match this call。 4. NULL值报错> ORA-01011: Cannot use v7 compatibility mode when talking to v6 server|
|edition|VARCHAR2|IN|否|NULL|指定运行语句的版本：1. 若为NULL并且container也为NULL，以当前版本运行。2. 若为NULL但指定了一个有效的container，以container默认的版本执行。3. 给定用户和要执行语句的版本，用户必须对版本具有USER权限。4. 非字符串类型报错|
|apply_crossedition_trigger|VARCHAR2|IN|否|NULL|指定要应用于指定 SQL 的前向交叉触发器的非限定名称。1. 非字符类型报错PLS-00307: too many declarations of 'PARSE' match this call|
|fire_apply_trigger|BOOLEAN|IN|否|TRUE|指示指定的触发器是本身要执行，还是只能作为选择其他触发器时使用的指南。1. true，false，null为合法值 2. 非boolean类型报错|
|schema|VARCHAR2|IN|否|NULL|指定解析非限定对象名称的schema，如果为NULL，则为当前生效的user schema。1.不存在的schema报错ORA-01435: user does not exist 2. 非字符类型，报错 3. 不区分大小写 4. 支持双引号|
|container|VARCHAR2|IN|否|--|指定cursor执行的容器，如果指定NULL或未指定，则目标容器的名称为调用容器的名称，并且不执行容器切换 。1.不存在的容器不报错 2. 非字符类型报错|


**使用说明**

- 使用DBMS_SQL执行DDL语句可能导致程序停止响应。例如发生死锁。
- schema只影响非限定名称的schema，并非是切换用户执行，不影响权限校验的loginUserId。
- 由于客户端代码不能引用远程包变量或常量，所以必须显式的使用常量的值。    
  例如不在客户端编译时，可以使用DMBS_SQL.NATIVE常量
- 而在客户端编译时，则需显式的使用常量的值
- VARCHAR2S类型是支持旧代码的向后兼容性，但更推荐使用VARCHAR2A。
- 如果需要解析的SQL语句大于32K，推荐使用CLOB版本的重载替代VARCHAR2A版本的重载。
- 如果container参数于当前container相同，container不会发生切回，当前默认角色将生效。


```
	DBMS_SQL.PARSE(cur_hdl, stmt_str, DBMS_SQL.NATIVE); 

```

```
	DBMS_SQL.PARSE(cur_hdl, stmt_str, 1); 

```

####   [1.2.5.3 BIND_VARIABLE Procedures](#1253-bind-variable-procedures)  

根据语句中绑定参数的名称将值绑定到游标中的绑定参数。

**语法**

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

datatype可为以下类型

```
ADT (user-defined object types)
BINARY_DOUBLE
BINARY_FLOAT
BFILE
BLOB
BOOLEAN
CLOB CHARACTER SET ANY_CS
DATE
DSINTERVAL_UNCONSTRAINED
NESTED table
NUMBER
OPAQUE types
REF
TIME_UNCONSTRAINED
TIME_TZ_UNCONSTRAINED
TIMESTAMP_LTZ_UNCONSTRAINED
TIMESTAMP_TZ_UNCONSTRAINED
TIMESTAMP_UNCONSTRAINED
UROWID
VARCHAR2 CHARACTER SET ANY_CS
VARRAY
YMINTERVAL_UNCONSTRAINED

```

**参数说明**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|要绑定值的游标的 ID 号。|
|name|VARCHAR2|IN|是|--|语句中变量的名称。绑定变量名称的长度必须为 <=128 个字节。（否则报错identifier is too long）。1. 同名的绑定变量名称只需绑定一次，多次绑定以最后一次为准（与execute immediate有差异）。2.不区分大小写|
|value|datatype中定义的数据类型|IN|是|--|要绑定到游标中的变量的值。|
|out_value_size|INTEGER|IN|否|--|对于VARCHAR2、RAW、CHAR类型的OUT或IN/OUT变量，指定最大的出参值size（以字节为单位）。1. 如果没给定，默认为当前value的长度，如果value未初始化，则长度为0，在execute给出参赋值时，若size不够，报错2. 若赋值为NULL，相当于未给定size 3.若value初始化，同时给定size，已size为准 4.若value不是varchar类型，但给定了size，将重载varchar类型的BIND_VARIABLE 5. 对于入参，若size小于实际长度，value将截断|


**其他限制**

1. 如果是IN或IN/OUT变量或集合，则给定的绑定值必须对变量或数组类型有效。OUT变量的绑定值将被忽略。
1. 绑定的数量少于实际绑定参数数量（包括缺少out方向的绑定参数），execute阶段报错
1. execute阶段将出参赋值，后续variable_value则是从出参赋值到变量。
1. DML可以多次执行，每次绑定不同的值。
1. SQL 语句的绑定变量或集合由其名称标识。将值绑定到绑定变量或绑定数组时，在语句中标识该值的字符串必须包含前导冒号，如以下示例所示


```
SELECT emp_name FROM emp WHERE SAL &gt; :X;

```

对应的绑定调用中的name参数的冒号可加可不加

```
BIND_VARIABLE(cursor_name, ':X', 3500); 

or

BIND_VARIABLE (cursor_name, 'X', 3500);

```

####   [1.2.5.4 BIND_VARIABLE_RAW Procedure](#1254-bind-variable-raw-procedure)  

**语法**

```
DBMS_SQL.BIND_VARIABLE_RAW (
   c              IN INTEGER,
   name           IN VARCHAR2,
   value          IN RAW [,out_value_size IN INTEGER]);

```

其他同BIND_VARIABLE procedure。

####   [1.2.5.5 BIND_VARIABLE_CHAR Procedure](#1255-bind-variable-char-procedure)  

**语法**

```
DBMS_SQL.BIND_VARIABLE_CHAR (
   c              IN INTEGER,
   name           IN VARCHAR2,
   value          IN CHAR CHARACTER SET ANY_CS [,out_value_size IN INTEGER]);

```

其他同BIND_VARIABLE procedure。

####   [1.2.5.6 BIND_ARRAY Procedure](#1256-bind-array-procedure)  

此过程根据语句中变量的名称将给集合值绑定到游标中的给定绑定变量。

**语法**

```
DBMS_SQL.BIND_ARRAY ( 
   c                   IN INTEGER, 
   name                IN VARCHAR2, 
   &lt;table_variable&gt;    IN &lt;datatype&gt; 
 [,index1              IN INTEGER, 
   index2              IN INTEGER)] ); 

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
&lt;tm_tab&gt;       Time_Table
&lt;ttz_tab&gt;      Time_With_Time_Zone_Table
&lt;tms_tab&gt;      Timestamp_Table
&lt;tstz_tab&gt;     Timestamp_With_ltz_Table
&lt;tstz_tab&gt;     Timestamp_With_Time_Zone_Table
&lt;ids_tab&gt;      Interval_Day_To_Second_Table
&lt;iym_tab&gt;      Interval_Year_To_Month_Table

TYPE binary_double_table 
                    IS TABLE OF BINARY_DOUBLE  INDEX BY BINARY_INTEGER;
TYPE binary_float_table 
                    IS TABLE OF BINARY_FLOAT   INDEX BY BINARY_INTEGER;
TYPE bfile_table    IS TABLE OF BFILE          INDEX BY BINARY_INTEGER;
TYPE blob_table     IS TABLE OF BLOB           INDEX BY BINARY_INTEGER;
TYPE clob_table     IS TABLE OF CLOB           INDEX BY BINARY_INTEGER;
TYPE date_table     IS TABLE OF DATE           INDEX BY BINARY_INTEGER;
TYPE interval_day_to_second_Table 
                    IS TABLE OF dsinterval_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE interval_year_to_MONTH_Table 
                    IS TABLE OF yminterval_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE number_table   IS TABLE OF NUMBER         INDEX BY BINARY_INTEGER;
TYPE time_table     IS TABLE OF time_unconstrained           
                                               INDEX BY BINARY_INTEGER;
TYPE time_with_time_zone_table 
                    IS TABLE OF time_tz_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE timestamp_table 
                    IS TABLE OF timestamp_unconstrained   
                                               INDEX BY BINARY_INTEGER;
TYPE timestamp_with_ltz_Table 
                    IS TABLE OF timestamp_ltz_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE timestamp_with_time_zone_Table 
                    IS TABLE OF timestamp_tz_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE urowid_table   IS TABLE OF UROWID         INDEX BY BINARY_INTEGER;
TYPE varchar2_table IS TABLE OF VARCHAR2(2000) INDEX BY BINARY_INTEGER;



```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|要绑定值的游标的 ID 号。|
|name|VARCHAR2|IN|是|--|语句中变量的名称。绑定变量名称的长度必须为 <=30 个字节。（经测试实际是超过41字节报错，为parse阶段报错）。1. 同名的绑定变量名称只需绑定一次，多次绑定以最后一次为准（与execute immediate有差异）。2.不区分大小写|
|table_variable|datatype中定义的数据类型|IN|是|--|要绑定到游标中的table变量的值。|
|index1|INTEGER|IN|否||table元素的下限索引，不可为NULL|
|index2|INTEGER|IN|否||table元素的上限索引，不可为NULL|


**规格约束**

- table_variable只能使用dbms_sql中定义的类型
- index2必须大于等于index1
- index1和index2可省略，则为varray.first和varray.last
- index1和index2间可以不连续，应该使用的next函数获取下一个值
- index1和index2需要是存在的下标，否则报错


####   [1.2.5.7 DEFINE_COLUMN Procedure](#1257-define-column-procedure)  

此过程定义一个从给定游标中被select的列，此过程只能用于SELECT游标。

列由SELECT投影中的相对位置确定，column参数的类型决定了所定义的列的类型。

**语法**

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

<datatype>为以下类型：

```
BINARY_DOUBLE
BINARY_FLOAT
BFILE
BLOB
CLOB CHARACTER SET ANY_CS
DATE
DSINTERVAL_UNCONSTRAINED
NUMBER
TIME_UNCONSTRAINED
TIME_TZ_UNCONSTRAINED
TIMESTAMP_LTZ_UNCONSTRAINED
TIMESTAMP_TZ_UNCONSTRAINED
TIMESTAMP_UNCONSTRAINED
UROWID
YMINTERVAL_UNCONSTRAINED
user-defined object types
collections (VARRAYs and nested tables)
REFs
Opaque types

```

**Pragmas**

```
pragma restrict_references(define_column,RNDS,WNDS);

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|要定义的行的cursor id|
|position|INTEGER|IN|是|--|定义列的相对位置，下标从1开始。1. 非法position报错ORA-01007: variable not in select list|
|column|列出的<datatype>类型|IN|是|--|要定义的列的值。此值的类型决定了所定义列的类型。1. 不要求与投影列类型相同，在column_value阶段检查是否可隐式转换 2. 可为常量|
|column_size|INTEGE|IN|否|--|VARCHAR2 类型的列的列值的最大预期大小（以字节为单位）。1. 定义了column_size即默认column列为varchar类型 2. 若对于varchar类型的参数，column_size比实际返回值小，截断，其他类型参数，|


**使用说明**

- 重复定义同一个position不报错，以最后一次定义为准，若定义类型与后续使用column_value不匹配，报错ORA-06562: type of out argument must match type of column or bind variable（属于column_value的规则）。
- 使用字符长度语义时，VARCHAR2 类型的列值可以返回的最大字节数计算为： column_size * 当前字符集的最大字符字节大小。例如，将 column_size 指定为 10 意味着在将字符长度语义与 UTF8 字符集一起使用时，无论其表示的字符数如何，最多可以返回 30 （10*3） 个字节。


####   [1.2.5.8 DEFINE_COLUMN_RAW Procedure](#1258-define-column-raw-procedure)  

**语法**

```
DBMS_SQL.DEFINE_COLUMN_RAW (
   c              IN INTEGER,
   position       IN INTEGER,
   column         IN RAW,
   column_size    IN INTEGER);

```

其他同DEFINE_COLUMN procedure。

####   [1.2.5.9 DEFINE_COLUMN_CHAR Procedure](#1259-define-column-char-procedure)  

**语法**

```
DBMS_SQL.DEFINE_COLUMN_CHAR (
   c              IN INTEGER,
   position       IN INTEGER,
   column         IN CHARACTER SET ANY_CS,
   column_size    IN INTEGER);

```

其他同DEFINE_COLUMN procedure。

###   [1.2.5.10 DEFINE_ARRAY Procedure](#12510-define-array-procedure)  

此过程定义要fetch的列。此过程允许从单个select中fetch多行到PL/SQL nest_table的变量。    
  当fetch行时，它们将复制到DBMS_SQL buffer中，直到执行COLUMN_VALUE，此时行将复制到作为COLUMN_VALUE的参数的表中。

**标量和lob类型的集合**

可以将局部变量声明为以下表项类型之一，然后使用DBMS_SQL将任意数量的行读取到其中（这些类型与使用BIND_ARRAY过程指定的类型相同）

```
TYPE binary_double_table 
                    IS TABLE OF BINARY_DOUBLE  INDEX BY BINARY_INTEGER;
TYPE binary_float_table 
                    IS TABLE OF BINARY_FLOAT   INDEX BY BINARY_INTEGER;
TYPE bfile_table    IS TABLE OF BFILE          INDEX BY BINARY_INTEGER;
TYPE blob_table     IS TABLE OF BLOB           INDEX BY BINARY_INTEGER;
TYPE clob_table     IS TABLE OF CLOB           INDEX BY BINARY_INTEGER;
TYPE date_table     IS TABLE OF DATE           INDEX BY BINARY_INTEGER;
TYPE interval_day_to_second_Table 
                    IS TABLE OF dsinterval_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE interval_year_to_MONTH_Table 
                    IS TABLE OF yminterval_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE number_table   IS TABLE OF NUMBER         INDEX BY BINARY_INTEGER;
TYPE time_table     IS TABLE OF time_unconstrained           
                                               INDEX BY BINARY_INTEGER;
TYPE time_with_time_zone_table 
                    IS TABLE OF time_tz_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE timestamp_table 
                    IS TABLE OF timestamp_unconstrained   
                                               INDEX BY BINARY_INTEGER;
TYPE timestamp_with_ltz_Table 
                    IS TABLE OF timestamp_ltz_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE timestamp_with_time_zone_Table 
                    IS TABLE OF timestamp_tz_unconstrained 
                                               INDEX BY BINARY_INTEGER;
TYPE urowid_table   IS TABLE OF UROWID         INDEX BY BINARY_INTEGER;
TYPE varchar2_table IS TABLE OF VARCHAR2(2000) INDEX BY BINARY_INTEGER;


```

**语法**

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
&lt;tm_tab&gt;       Time_Table
&lt;ttz_tab&gt;      Time_With_Time_Zone_Table
&lt;tms_tab&gt;      Timestamp_Table
&lt;tstz_tab&gt;     Timestamp_With_ltz_Table
&lt;tstz_tab&gt;     Timestamp_With_Time_Zone_Table
&lt;ids_tab&gt;      Interval_Day_To_Second_Table
&lt;iym_tab&gt;      Interval_Year_To_Month_Table

```

**Pragmas**

```
pragma restrict_references(define_array,RNDS,WNDS);


```

后续的 FETCH_ROWS 调用获取“count”行。进行COLUMN_VALUE调用时，这些行将放置在位置 lower_bnd、lower_bnd+1、lower_bnd+2 等位置。虽然仍有行传入，但用户会继续发出 FETCH_ROWS/COLUMN_VALUE 调用。这些行在COLUMN_VALUE调用中指定为参数的表中不断累积。

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要绑定array的cursor id。|
|position|INTEGER|IN|是|--|定义列的相对位置，下标从1开始。1. 非法position报错|
|table_variable|表中定义的<datatype>|IN|是|--|声明为<datatype>类型的局部变量。1. 经测试只能使用dbms_sql定义的类型，自定义的table类型报错 2.多次define，可以是相同的变量|
|cnt|INTEGER|IN|是|--|一次fetch的行数。1. 大于实际可以fetch的最大行数，则一次fetch全部行 2. 不同列调用define_array的cnt不同，取最小值|
|lower_bnd|INTEGER|IN|是|--|结果复制到集合中，从此下限索引开始。1. 可为正数，负数或零。|


**使用说明**

- cnt参数必须是大于0的整数，否则将引发异常。（小数number，字符串、binary_float/double四舍五入）
- lower_bnd可以为正数、负数或零。
- 发出DEFINE_ARRAY调用的查询不能包含bind_array，但可以bind_variable绑定数组。
- index在execute时初始化为指定的lower_bnd，每次调用column_value时更新，如果重新execute，define的索引将重置为lower_bnd


###   [1.2.5.11 EXECUTE Function](#12511-execute-function)  

该函数执行给定cursor id对应的游标，返回已处理的函数。

**语法**

```
DBMS_SQL.EXECUTE (
   c   IN INTEGER)
  RETURN INTEGER;

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要执行的cursor id|


**返回值**

返回已处理的行数，INTEGER类型。返回值只对INSERT，UPDATE和DELETE语句有效。其他类型的语句（包括DDL），返回值未定义，必须忽略(测试结果为0)。

**使用说明**

- TO_CURSOR_NUMBER函数返回的DBMS_SQL游标的执行方式与已执行的DBMS_SQL游标的执行方式相同。因此，为此游标调用 EXECUTE 将导致错误。
- 可以对同一个cursor多次执行，对于SELECT语句，将重置FETCH游标。


###   [1.2.5.12 EXEECUTE_AND_FETCH Function](#12512-exeecute-and-fetch-function)  

此函数执行给定的游标并fetch行。

此函数与EXECUTE后再执行FETCH_ROWS的效果相同。主要是在对远程数据库使用时，可以减少网络往返次数。

**语法**

```
DBMS_SQL.EXECUTE_AND_FETCH (
   c              IN INTEGER,
   exact          IN BOOLEAN DEFAULT FALSE)
  RETURN INTEGER;

```

**Pragmas**

```
pragma restrict_references(execute_and_fetch,WNDS);

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|execute和fetch的cursor id。|
|exact|BOOLEAN|IN|否|FALSE|1. 设置为FASE，查不到数据或查到多行数据均不报错，2.设置为TRUE，查不到数据报错OCI_NO_DATA；匹配多行，报错ORA-01422: exact fetch returns more than requested number of rows。注意：Oracle 不支持对 LONG 列使用精确的 fetch TRUE 选项。即使引发了异常，这些行仍会被提取并可用。|


**返回值**

返回EXECUTE_AND_FETCH实际读取的行数，INTEGER类型。

**使用说明**

非SELECT语句报错（不同语句报错不一样， DML报错ORA-01002: fetch out of sequence，DDL报错ORA-01003: no statement parsed。

###   [1.2.5.13 FETCH_ROWS Function](#12513-fetch-rows-function)  

此函数从给定的游标中获取一行。

只要还有待提取的函数，就可以重复调用。这些行被检索到缓冲区中，并且必须要在每次调用FETCH_ROWS之后使用COLUMN_VALUE读取每列。

**语法**

```
DBMS_SQL.FETCH_ROWS (
   c              IN INTEGER)
  RETURN INTEGER;

```

**Pragmas**

```
pragma restrict_references(fetch_rows,WNDS);

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|cursor ID|


**返回值**

返回实际读取的行数，INTEGER类型。

**使用说明**

- 未进行execute的游标进行fetch_rows报错ORA-01002: fetch out of sequence
- fetch_rows获取不到数据时，第一次获取空数据，再进行fetch_rows报错ORA-01002: fetch out of sequence


####   [1.2.5.14 VARIABLE_VALUE Procedure](#12514-variable-value-procedure)  

此过程返回给定游标的命名变量的值。它用于返回带有返回子句的 PL/SQL 块或 DML 语句中的绑定变量的值。

**语法**

```
--for single Row
DBMS_SQL.VARIABLE_VALUE (
   c               IN  INTEGER,
   name            IN  VARCHAR2,
   value           OUT NOCOPY &lt;datatype&gt;);

or 

--for bulk
DBMS_SQL.VARIABLE_VALUE ( 
   c                 IN   INTEGER, 
   name              IN   VARCHAR2,
   value             OUT NOCOPY &lt;table_type&gt;); 

```

datatype可以为下列类型

```
ADT (user-defined object types)
BINARY_DOUBLE
BINARY_FLOAT
BFILE
BLOB
BOOLEAN
CLOB CHARACTER SET ANY_CS
DATE
DSINTERVAL_UNCONSTRAINED
NESTED table
NUMBER
OPAQUE types
REF
TIME_UNCONSTRAINED
TIME_TZ_UNCONSTRAINED
TIMESTAMP_LTZ_UNCONSTRAINED
TIMESTAMP_TZ_UNCONSTRAINED
TIMESTAMP_UNCONSTRAINED
UROWID
VARCHAR2 CHARACTER SET ANY_CS
VARRAY
YMINTERVAL_UNCONSTRAINED

table_type

```

<table_type>为DBMS_SQL与定义的TABLE类型。

**Pragmas**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|想要获取值对应的cursor id。|
|name|VARCHAR|IN|是|--|需要获取值的绑定参数名称。1. 不存在的name报错ORA-01006: bind variable does not exist 2.前导冒号可选 3. 不区分大小写|
|value|上述的<dataType>指定的类型|OUT|是|--|返回指定绑定参数的值。1.如果此输出参数的类型与实际类型（调用BIND_VARIABLE所定义的）不匹配，将会抛出RA-06562, inconsistent_type异常。2.可以重复获取值 3. 入参也可以获取值|


**使用说明**

####   [1.2.5.15 VARIABLE_VALUE_RAW Procedure](#12515-variable-value-raw-procedure)  

**语法**

```
DBMS_SQL.VARIABLE_VALUE_RAW (
   c               IN  INTEGER,
   name            IN  VARCHAR2,
   value           OUT RAW);

```

其他同VARIABLE_VALUE procedure。

####   [1.2.5.16 VARIABLE_VALUE_CHAR Procedure](#12516-variable-value-char-procedure)  

**语法**

```
DBMS_SQL.VARIABLE_VALUE_CHAR (
   c               IN  INTEGER,
   name            IN  VARCHAR2,
   value           OUT CHAR CHARACTER SET ANY_CS);

```

其他同VARIABLE_VALUE procedure。

####   [1.2.5.17 COLUMN_VALUE Procedure](#12517-column-value-procedure)  

此过程返回给定游标中给定位置的游标元素的值，此过程用于访问FETCH_ROWS获取的数据。

**语法**

```
DBMS_SQL.COLUMN_VALUE (
   c                 IN  INTEGER,
   position          IN  INTEGER,
   value             OUT &lt;datatype&gt; 
 [,column_error      OUT NUMBER] 
 [,actual_length     OUT INTEGER]);

```

<datatype>可以为以下类型：

```
BINARY_DOUBLE
BINARY_FLOAT
BFILE
BLOB
CLOB CHARACTER SET ANY_CS
DATE
DSINTERVAL_UNCONSTRAINED
NUMBER
TIME_TZ_UNCONSTRAINED
TIME_UNCONSTRAINED
TIMESTAMP_LTZ_UNCONSTRAINED
TIMESTAMP_TZ_UNCONSTRAINED
TIMESTAMP_UNCONSTRAINED
UROWID
VARCHAR2 CHARACTER SET ANY_CS
YMINTERVAL_UNCONSTRAINED
user-defined object types
collections (VARRAYs and nested tables)
REFs
Opaque types

```

以下语法适用于bulk操作。

```
DBMS_SQL.COLUMN_VALUE( 
   c                 IN             INTEGER, 
   position          IN             INTEGER, 
   &lt;param_name&gt;      IN OUT NOCOPY  &lt;table_type&gt;);  

```

<param_name>以及对应的<table_type>可以匹配下列匹配对：

```
bdbl_tab     Binary_Double_Table
bflt_tab     Binary_Float_Table
bf_tab       Bfile_Table
bl_tab       Blob_Table
cl_tab       Clob_Table
d_tab        Date_Table
ids_tab      Interval_Day_To_Second_Table
iym_tab      Interval_Year_To_Month_Table
n_tab        Number_Table
tm_tab       Time_Table
ttz_tab      Time_With_Time_Zone_Table
tms_tab      Timestamp_Table
tstz_tab     Timestamp_With_ltz_Table
tstz_tab     Timestamp_With_Time_Zone_Table
ur_tab       Urowid_Table
c_tab        Varchar2_Table

```

**Pragmas（Single Row）**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|想要获取值对应的cursor id。|
|position|INTEGER|IN|是|--|列在cursor中的相对位置。语句中的第一列的位置为 1。1. position顺序不要求 2.position非法报错ORA-01007: variable not in select list|
|value|上述的<dataType>指定的类型|OUT|是|--|返回指定列的值。1.如果此输出参数的类型与实际类型（调用DEFINE_COLUMN所定义的）不匹配，将会抛出RA-06562, inconsistent_type异常。2. 如果输出参数类型与实际类型匹配，但与投影列类型不一致，只在隐式转换时检查|
|column_error|NUMBER|OUT|否|--|返回指定列值的任何错误代码。1. column_value执行不报错，返回0。2. column_value执行报错，测试返回也是0。|
|actual_length|INTEGER|OUT|否|--|指定列的值在截断之前的实际长度。1. 字符类型返回实际长度 2. 非字符类型没有明显规律）|


**Pragmas（Bulk）**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|想要获取值对应的cursor id。|
|position|INTEGER|IN|是|--|列在cursor中的相对位置。语句中的第一列的位置为 1。|
|<param_name>|上述的<table_type>指定的类型|IN OUT NOCOPY|是|--|声明为<table_type>类型的局部变量。对于批量操作，该过程将新元素加到适当（隐式维护的）index处。例如，如果在使用 DEFINE_ARRAY 过程中指定了10行的批处理大小（cnt 参数），并指定了 1 的起始索引 （lower_bound），则在调用 FETCH_ROWS 函数后首次调用此子程序将填充索引 1..10 处的元素，下一次调用将填充元素 11..20， 等等。|


**异常**

如果给定 OUT 参数值的类型与值的实际类型不同，则会引发INCONSISTENT_TYPE （ORA-06562）。当通过调用过程 DEFINE_COLUMN 定义列时，此类型是给定的类型。

**使用说明**

1. define_column的column参数只是定义了投影列的类型，实际获取投影列的值由COLUMN_VALUE的value参数获取。


####   [1.2.5.18 COLUMN_VALUE_RAW Procedure](#12518-column-value-raw-procedure)  

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

####   [1.2.5.19 COLUMN_VALUE_CHAR Procedure](#12519-column-value-char-procedure)  

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

####   [1.2.5.20 CLOSE_CURSOR Procedure](#12520-close-cursor-procedure)  

此过程关闭一个给定的游标，分配给游标的内存将被释放，并且您无法再从该游标获取。

**语法**

```
DBMS_SQL.CLOSE_CURSOR (
   c    IN OUT INTEGER);

```

**Pragmas**

```
pragma restrict_references(close_cursor,RNDS,WNDS);

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN OUT|是|--|入参为想要关闭的cursor id，出参被设置为NULL。|


**使用说明**

- 被关闭后的游标不可再使用，否则报错ORA-29471: DBMS_SQL access denied。


###   [1.2.5.21 IS_OPEN Function](#12521-is-open-function)  

此函数检查给定游标当前是否处于打开状态。

**语法**

```
DBMS_SQL.IS_OPEN (
   c              IN INTEGER)
  RETURN BOOLEAN;

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|需要判断打开状态的cursor id。|


**返回值**

对于已打开但未关闭的任何游标编号，返回 TRUE，对于NULL游标（close_cursor的出参返回NULL）编号，返回 FALSE。

**使用说明**

1. 对于非法cursor id（包括打开后关闭的cursor id），报错ORA-29471: DBMS_SQL access denied


####   [1.2.5.22 DESCRIBE_COLUMNS Procedure](#12522-describe-columns-procedure)  

此过程描述由DBMS_SQL打开并解析的游标的列。

**语法**

```
DBMS_SQL.DESCRIBE_COLUMNS ( 
   c              IN  INTEGER, 
   col_cnt        OUT INTEGER, 
   desc_t         OUT DESC_TAB);

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN|是|--|所描述列对应的cursor id。|
|col_cnt|INTEGER|OUT|是|--|返回select投影列的列数。|
|desc_t|DESC_TAB|OUT|是|--|描述table，返回查询中每列的描述。`. 类型必须为DBMS_SQL.DESC_TAB，否则报错PLS-00306: wrong number or types of arguments in call to 'DESCRIBE_COLUMNS'。2. 非select语句，报错ORA-00900: invalid SQL statement|


**使用说明**

1. 需要先执行parse后才能再执行describe_columns
1. select语句才可以执行describe_columns
1. 投影列有别名时，呈现别名信息。


####   [1.2.5.23 LAST_ERROR_POSITION Function](#12523-last-error-position-function)  

此函数返回SQL语句报错位置的字节偏移量，从0开始。

**语法**

```
DBMS_SQL.LAST_ERROR_POSITION 
   RETURN INTEGER;

```

**返回值**

返回SQL语句报错位置的字节偏移量。

**使用说明**

1. 该函数须在调用dbms_sql.parse后，调用其他dbms_sql子过程前调用（经测试，execute也可获取pos，但不确保一定可以）。
1. 多次parse，以最后一次parse为准
1. 没有语法错误时，last_error_position为0
1. 记录的last_error_position在下次open_cursor或close_cursor时清除。


####   [1.2.5.24 TO_REFCURSOR Function](#12524-to-refcursor-function)  

此函数将一个open、parse和execute过的游标，转换为一个PL/SQL内的REF CURSOR（weakly-typed）。只能对select游标使用。

**语法**

```
DBMS_SQL.TO_REFCURSOR(
   cursor_number IN OUT INTEGER)
  RETURN SYS_REFCURSOR;

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|c|INTEGER|IN OUT|是|--|入参为被转换的cursor id，出参被设置为NULL|


**返回值**

转换后的ref cursor。

**使用说明**

1. 传入的游标必须为open，parse和execute过的，其他情况将报错（fetch过也可以，但不能fetch到eof的）。
1. 一旦cursor_number被转换为ref cursor后，cursor_number将不能被其他dbms_sql使用。
1. 当cursor_number被转换为ref cursor后，使用 DBMS_SQL.IS_OPEN检查cursor_number是否为打开状态将返回错误。
1. 如果cursor_number在parse时使用的一个有效的container参数，将无法被转换为ref cursor。


####   [1.2.5.25 TO_CURSOR_NUMBER Function](#12525-to-cursor-number-function)  

此函数将一个open的ref cursor转换为由dbms_sql管理的游标，并返回其id号。

**语法**

```
DBMS_SQL.TO_CURSOR_NUMBER(
   rc IN OUT SYS_REFCURSOR)
  RETURN INTEGER;

```

**参数**

|参数|数据类型|方向|是否必填|默认值|说明|
|---|---|---|---|---|---|
|rc|SYS_REFCURSOR|IN OUT|是|--|入参为ref cursor，出参被设置为无效的游标|


**返回值**

转换后的cursor id。

**使用说明**

1. 传入的游标必须为open，否则报错。可以是fetch到eof的游标，转换后再fetch会报错。
1. 一旦ref cursor被转换为cursor number后，任何本地动态SQL操作都无法再访问ref cursor（报错无效的游标）。
1. 转换后的cursor number处于已经执行的状态，再execute会报错，可以重新parse-execute。


###   [1.2.6 DBMS_SQL数据结构](#126-dbms-sql数据结构)  

####   [1.2.6.1  DBMS_SQL DESC_REC Record Type](#1261--dbms-sql-desc-rec-record-type)  

此Record类型保存动态查询中单个列的描述信息。

此类型已被弃用，取而代之的是 DESC_REC2 记录类型。

它是 DESC_TAB 表类型和 DESCRIBE_COLUMNS 过程的元素类型。

**语法**

```
TYPE desc_rec IS RECORD (
      col_type            BINARY_INTEGER := 0,
      col_max_len         BINARY_INTEGER := 0,
      col_name            VARCHAR2(32)   := '',
      col_name_len        BINARY_INTEGER := 0,
      col_schema_name     VARCHAR2(32)   := '',
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
|col_name|VARCHAR2(32)|''|列名称|
|col_name_len|BINARY_INTEGER|0|列名称长度|
|col_schema_name|VARCHAR2(32)|''|列schema名称|
|col_schema_name_len|BINARY_INTEGER|0|列schema名称长度|
|col_precision|BINARY_INTEGER|0|列precision|
|col_scale|BINARY_INTEGER|0|列scale|
|col_charsetid|BINARY_INTEGER|0|列字符串id|
|col_charsetform|BINARY_INTEGER|0|列字符集格式|
|col_null_ok|BOOLEAN|TRUE|列是否可能为NULL，TRUE说明可能为NULL|


####   [1.2.6.2 DBMS_SQL DESC_REC2 Record Type](#1262-dbms-sql-desc-rec2-record-type)  

DESC_REC2 是 DESC_TAB2 表类型和 DESCRIBE_COLUMNS2 过程的元素类型。

此记录类型与DESC_REC相同，但 col_name 字段除外，该字段已扩展为VARCHAR2的最大可能大小。因此，最好选择DESC_REC2，因为列名值可以大于 32 个字符。DESC_REC 已被弃用。

```
TYPE desc_rec2 IS RECORD (
   col_type            binary_integer := 0,
   col_max_len         binary_integer := 0,
   col_name            varchar2(32767) := '',
   col_name_len        binary_integer := 0,
   col_schema_name     varchar2(32)   := '',
   col_schema_name_len binary_integer := 0,
   col_precision       binary_integer := 0,
   col_scale           binary_integer := 0,
   col_charsetid       binary_integer := 0,
   col_charsetform     binary_integer := 0,
   col_null_ok         boolean        := TRUE);

```

**字段**

|字段|类型|默认值|说明|
|---|---|---|---|
|col_type|BINARY_INTEGER|0|列类型|
|col_max_len|BINARY_INTEGER|0|最大列长度|
|col_name|VARCHAR2(32767)|''|列名称|
|col_name_len|BINARY_INTEGER|0|列名称长度|
|col_schema_name|VARCHAR2(32)|''|列schema名称|
|col_schema_name_len|BINARY_INTEGER|0|列schema名称长度|
|col_precision|BINARY_INTEGER|0|列precision|
|col_scale|BINARY_INTEGER|0|列scale|
|col_charsetid|BINARY_INTEGER|0|列字符串id|
|col_charsetform|BINARY_INTEGER|0|列字符集格式|
|col_null_ok|BOOLEAN|TRUE|列是否可能为NULL，TRUE说明可能为NULL|


####   [1.2.6.3 DBMS_SQL DESC_REC3 Record Type](#1263-dbms-sql-desc-rec3-record-type)  

DESC_REC3是DESC_TAB3表类型和DESCRIBE_COLUMNS3过程的元素类型。

DESC_REC3相比DESC_REC2，增加了两个附加字段用于保存动态查询中列的类型名称（type_name）和类型名称长度（type_name_len）。当列是用户自定义类型（集合或对象类型）时，这两个字段保存类型名称和类型名称长度。仅当col_type字段的值为109（用户自定义类型的ORACLE类型编号）时，才会填充col_type_name和col_type_name_len字段。

**语法**

```
TYPE desc_rec3 IS RECORD (
   col_type               binary_integer := 0,
   col_max_len            binary_integer := 0,
   col_name               varchar2(32767) := '',
   col_name_len           binary_integer := 0,
   col_schema_name        varchar2(32) := '',
   col_schema_name_len    binary_integer := 0,
   col_precision          binary_integer := 0,
   col_scale              binary_integer := 0,
   col_charsetid          binary_integer := 0,
   col_charsetform        binary_integer := 0,
   col_null_ok            boolean := TRUE,
   col_type_name          varchar2(32767)   := '',
   col_type_name_len      binary_integer := 0);

```

**字段**

|字段|类型|默认值|说明|
|---|---|---|---|
|col_type|BINARY_INTEGER|0|列类型|
|col_max_len|BINARY_INTEGER|0|最大列长度|
|col_name|VARCHAR2(32767)|''|列名称|
|col_name_len|BINARY_INTEGER|0|列名称长度|
|col_schema_name|VARCHAR2(32)|''|列schema名称|
|col_schema_name_len|BINARY_INTEGER|0|列schema名称长度|
|col_precision|BINARY_INTEGER|0|列precision|
|col_scale|BINARY_INTEGER|0|列scale|
|col_charsetid|BINARY_INTEGER|0|列字符串id|
|col_charsetform|BINARY_INTEGER|0|列字符集格式|
|col_null_ok|BOOLEAN|TRUE|列是否可能为NULL，TRUE说明可能为NULL|
|col_type_name|VARCHAR2(32767)|''|用户自定义类型名称，此字段仅当col_type为109时有效|
|col_type_name_len|BINARY_INTEGER|0|用户自定义类型名称长度，此字段仅当col_type为109时有效|


####   [1.2.6.4 DBMS_SQL DESC_REC4 Record Type](#1264-dbms-sql-desc-rec4-record-type)  

DESC_REC3是DESC_TAB3表类型和DESCRIBE_COLUMNS3过程的元素类型。

DESC_REC4 与 DESC_REC3 相同，只是它支持在包含动态查询中列的架构名称 （col_schema_name） 和类型名称 （col_type_name） 的字段中使用更长的标识符

**语法**

```
TYPE desc_rec4 IS RECORD (
   col_type               binary_integer := 0,
   col_max_len            binary_integer := 0,
   col_name               varchar2(32767) := '',
   col_name_len           binary_integer := 0,
   col_schema_name        DBMS_ID := '',
   col_schema_name_len    binary_integer := 0,
   col_precision          binary_integer := 0,
   col_scale              binary_integer := 0,
   col_charsetid          binary_integer := 0,
   col_charsetform        binary_integer := 0,
   col_null_ok            boolean := TRUE,
   col_type_name          DBMS_ID   := '',
   col_type_name_len      binary_integer := 0);

```

**字段**

|字段|类型|默认值|说明|
|---|---|---|---|
|col_type|BINARY_INTEGER|0|列类型|
|col_max_len|BINARY_INTEGER|0|最大列长度|
|col_name|VARCHAR2(32767)|''|列名称|
|col_name_len|BINARY_INTEGER|0|列名称长度|
|col_schema_name|DBMS_ID|''|列schema名称|
|col_schema_name_len|BINARY_INTEGER|0|列schema名称长度|
|col_precision|BINARY_INTEGER|0|列precision|
|col_scale|BINARY_INTEGER|0|列scale|
|col_charsetid|BINARY_INTEGER|0|列字符串id|
|col_charsetform|BINARY_INTEGER|0|列字符集格式|
|col_null_ok|BOOLEAN|TRUE|列是否可能为NULL，TRUE说明可能为NULL|
|col_type_name|DBMS_ID|''|用户自定义类型名称，此字段仅当col_type为109时有效|
|col_type_name_len|BINARY_INTEGER|0|用户自定义类型名称长度，此字段仅当col_type为109时有效|


####   [1.2.6.5 DBMS_SQL DESC_TAB Table Type](#1265-dbms-sql-desc-tab-table-type)  

This is a table of DESC_REC Record Type.

**语法**

```
TYPE desc_tab IS TABLE OF desc_rec INDEX BY BINARY_INTEGER;

```

####   [1.2.6.6 DBMS_SQL DESC_TAB2 Table Type](#1266-dbms-sql-desc-tab2-table-type)  

This is a table of DESC_REC2 Record Type.

**语法**

```
TYPE desc_tab2 IS TABLE OF desc_rec2 INDEX BY BINARY_INTEGER;

```

####   [1.2.6.7 DBMS_SQL DESC_TAB3 Table Type](#1267-dbms-sql-desc-tab3-table-type)  

This is a table of DESC_REC3 Record Type.

**语法**

```
TYPE desc_tab3 IS TABLE OF desc_rec3 INDEX BY BINARY_INTEGER; 

```

####   [1.2.6.8  DBMS_SQL DESC_TAB4 Table Type](#1268--dbms-sql-desc-tab4-table-type)  

This is a table of DBMS_SQL DESC_REC4 Record Type.

**语法**

```
TYPE DESC_TAB4 IS TABLE OF DESC_REC4 INDEX BY BINARY_INTEGER; 

```

###   [1.3 数据字典](#13-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|友商、业界资料链接|


###   [1.4 开源依赖](#14-开源依赖)  

无。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级包|包含高级包常量、异常、子过程和自定义类型，详细说明见需求实现分析|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. 其他补充](#5-其他补充)  

bind_variable/bind_variable_char/bind_variable_raw必须用对应的variable_value/variable_value_char/variable_value_raw取值，否则报错输出参数的类型必须与列或绑定变量的类型匹配。

define_column/define_column_char/define_column_raw必须用对应的column_value/column_value_char/column_value_raw取值，否则报错输出参数的类型必须与列或绑定变量的类型匹配。

|  
|bind_variable场景|variable_value场景|表现|备注|
|---|---|---|---|---|
|**VARCHAR**|value为varchar类型，带或未带  out_value_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||value为varchar类型，带或未带  out_value_size|value为int等可转换类型类型|报错ORA-06562: type of out argument must match type of column or bind variable|文档中明确提到bind_variable和variable_value的类型需要匹配，否则报错|
||value为varchar类型，带或未带  out_value_size|使用variable_value_char\variable_value_raw|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
|**CHAR**|value为char类型，未带out_value_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||value为char类型，带out_value_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||value为char类型，带或未带out_value_size|value为int等可转换类型|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
||value为char类型，带或未带out_value_size|使用variable_value_char函数|报错ORA-06562: type of out argument must match type of column or bind variable|疑似bind_variable和variable_value遇到char和raw类型全当作varchar处理|
|**RAW**|value为raw类型，未带out_value_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||value为raw类型，带out_value_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||value为raw类型，带或未带out_value_size|value为int等|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
||value为raw类型，带或未带out_value_size|使用variable_value_raw函数|报错ORA-06562: type of out argument must match type of column or bind variable|疑似bind_variable和variable_value遇到char和raw类型全当作varchar处理|


define_column对于column为varchar和char类型必须加size，不加则报错PLS-00307: too many declarations of 'DEFINE_COLUMN' match this call。raw类型没有这个限制

|  
|define_column场景|column_value场景|表现|备注|
|---|---|---|---|---|
|  
    
  **VARCHAR**|column为varchar，带column_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||column为varchar，带column_size|value为int等可转换类型|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
||column为varchar，带column_size|使用column_value_char/column_value_raw|报错ORA-06562: type of out argument must match type of column or bind variable|疑似define_column带column_size和column_value遇到char和raw类型，全当作varchar处理|
|  
    
  **CHAR**|column为char，带column_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||column为char，带column_size|value为int等可转换类型|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
||column为char，带column_size|使用column_value_char|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
|  
    
  **RAW**|column为raw，带column_size|value为varchar，char，raw|均不报错，进行隐式类型转换|  
|
||column为raw，带column_size|value为int等可转换类型|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
||column为raw，带column_size|使用column_value_raw|报错ORA-06562: type of out argument must match type of column or bind variable|  
|
||column为raw，不带column_size|value为varchar，char，raw，以及使用column_value_raw|报错ORA-06562: type of out argument must match type of column or bind variable|不是转成了varchar类型。无法判断|


## Comments:

|  [](null)  ,1. ddl语句parse后，查看v$open_cursor视图查看游标是否还在？
1. soWrapper移动至handler对于原有游标的影响，避免资源泄漏。
1. 高级包权限是否影响parse时的权限校验？
1. 执行不同用户的存储过程，是否影响currUser校验？
,Posted by liaofeng at 十一月 28, 2023 14:24|
|---|
|  [](null)  ,1. ddl语句parse未close_cursor，查看v$open_cursor视图， 未增加行；dml语句parse后未close_cursor，v$open_cursor有增加行，若close_cursor，v$open_cursor新增行删除；parse失败的dml语句未close_cursor，v$open_cursor视图也未增加行。
1. 原有游标增加openCursors记录未关闭的游标执行结束时关闭。同时增加自测用例覆盖
1. 高级包权限只影响高级包执行，不影响parse和execute过程的权限校验。
1. 执行不同用户的存储过程，currUser切换，影响currUser的校验。
,Posted by liaofeng at 十一月 28, 2023 14:50|
|  [](null)  ,bind/define的value类型和取值的类型分组：,独立的：binary_double/binary_float/blob/clob/nclob/rowid/date/timestamp,1.char/varchar/raw,2.nchar/nvarchar,3.number/int...（oracle都是number实现）,  
,Posted by zengsiyin at 七月 08, 2024 15:23|
