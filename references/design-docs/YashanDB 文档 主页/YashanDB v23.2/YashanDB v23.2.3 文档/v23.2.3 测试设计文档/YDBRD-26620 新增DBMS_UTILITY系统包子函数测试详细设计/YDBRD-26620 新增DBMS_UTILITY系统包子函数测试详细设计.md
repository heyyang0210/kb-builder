Created by 刘美秀, last modified on 六月 19, 2024

# 1. 概述

DBMS_UTILITY系统包子函数，提供了多种工具类子程序

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/66276c48fd997db58adfd88c](https://pingcode.yasdb.com/pjm/items/66276c48fd997db58adfd88c)    ?    
  #YDBRD-26620 新增DBMS_UTILITY系统包子函数

  


开发设计：    [YDBRD-26620: 新增DBMS_UTILITY系统包子函数](https://conf.yasdb.com/pages/viewpage.action?pageId=153015229)  

测试调研：    [YDBRD-26620 新增DBMS_UTILITY系统包子函数测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153015658)  

概要设计：    [YDBRD-26620 新增DBMS_UTILITY系统包子函数测试概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=153015651)  

## 2.1 功能点分析

- GET_HASH_VALUE
- GET_TIME
- FORMAT_ERROR_BACKTRACE
- COMMA_TO_TABLE
- TABLE_TO_COMMA
- ACTIVE_INSTANCES     **参考gv$instance视图**
- CURRENT_INSTANCE
- DB_VERSION     **参考v$version**
- GET_ENDIANNESS
- GET_PARAMETER_VALUE     **参考v$parameter**
- GET_SQL_HASH
- IS_BIT_SET
- IS_CLUSTER_DATABASE     **参考v$instance视图的PARALLEL字段**
- NAME_RESOLVE
- NAME_TOKENIZE
- OLD_CURRENT_SCHEMA
- OLD_CURRENT_USER
- PORT_STRING


  


**开发设计的主要原理**

PL/SQL执行过程中分为  **编译**  和  **执行**  两个阶段:

1. 编译阶段一般是检查包名，参数的个数和类型是否符合要求；--公共方法中校验
1. 执行阶段可以拿到完整的参数；


## 2.2 应用场景

- 根据场景需要执行对应的工具程序


## 2.3 规格约束

|规格/约束|描述|说明|备注|
|:---|:---|:---|:---|
|规格|table_to_comma 关联数组中的table不进行校验，可以是任意字符串，即不合法的对象名|  
|表现同oracle|
|规格|comma_to_table，对于uncl_array则每个name的格式为     **a [. b [. c ]][ @ d ]**  。 对于lname_array格式为:  **a [. b]***  . 并对a,b,c,d这些name进行命名合法性校验|object标识沿用anchorbase数据约束规格|  
|
|规格|name_tokenize，输入的一般格式为     **a [. b [. c ]][@ dblink ]**  ，尝试读identifier时：如果第一个字符是合法的，向后读到不合法字符时停止。如果第一个字符不合法则会报错。|存在一些oracle报错但是yashandb不报错，返回对应的nextpos的场景 但是保证解析出来的     *a,b,c,dbLink*     都是合法的|与oracle不一致|
|规格|get_parameter_value的 listno为int，无实际意义，兼容。|预留|与oracle不一致|
|规格|GET_HASH_VALUE参数范围和ORACLE保持一致，哈希算法采用内部实现。|hash算法跟oracle不一致|与oracle不一致|
|规格|GET_TIME返回当前时间戳。|anchorbase输出为i64值,oracle输出为i32的值|与oracle不一致|
|规格|IS_BIT_SET对n的范围进行校验，只能是正整数，且小于RAW变量所能表示的位数。|oracle允许n的取值大于raw变量表示的位数，且最大支持到n+5字节的位数；另外n还能取值0和负数，且表现难以推断|与oracle不一致|
|约束|TABLE_TO_COMMA,COMMA_TO_TABLE，ACTIVE_INSTANCES中的内置UDT在分布式下不支持，函数/过程不支持。|  
|分布式不支持|


## 3. 详细测试设计

## 3.1 测试设计方法

|验证项|设计方法|验证内容|
|:---|:---|---|
|入参校验|等价类划、边界值|参数个数（多参、少参、无参）、,参数类型（正确、不正确）、,参数顺序、,入参值-数据长度、数据为空、数据错误|
|业务逻辑验证|等价类划、错误推测、场景设计|  
|
|部署验证|等价类划|单机、分布式、集群,DBMS_UTILITY旧接口在分布式、集群执行,dba/sys 在CN/DN/MN执行高级包,分布式高级包消息一致性|
|特性交互|等价类划|DBMS_JOB、,绑定参数,权限,审计|


## 3.2 详细测试设计

单机支持数据类型：int/tinint/smallint/float/double/bigint/number/clob/blob/time/data/datatime/boolean/INTERVAL DAY TO SECOND/INTERVAL YEAR TO MONTH/RAW/json/xmltype/ROWID/UROWID/ST_GEOMETRY/BOX2D/数组/

关键字校验：高级包名称及其子函数拼写有误

**参数验证**

|  
|接口|接口表现|接口说明|参数/返回值|参数个数|参数数据类型,  
|参数类型|参数值|
|:---|:---|:---|:---|---|---|---|---|---|
|1|高级函数|DBMS_UTILITY.GET_HASH_VALUE|计算给定字符串的哈希值，哈希值落在给定的范围内。|name VARCHAR2：要进行哈希处理的字符串,base NUMBER：要开始的返回哈希值的基值,hash_size NUMBER：哈希表的所需大小,RETURN NUMBER;哈希值|有效：3,无效：0,1,4|有效：,name：char/varchar/nchar/nvarchar，可隐式转换为字符型的类型,base/hash_size：数值型-int/tinint/smallint/float/double/bigint/number，'1'等转换为数值型的,返回值类型验证:typeof(  RETURN   ),无效：,name：不可隐式转换为字符型的类型,base/hash_size：不能转换为数值型--如time/data/datatime,  
|常量、,表列、,函数返回值，,表达式|  
,有效：,name  数据长度验证：32000,name内容：中文、英文、特殊字符、表情符，数字、空白符,base/hash_size   number边界验证：-2147483648,2147483647,,-2147483648+1,2147483647-1,无效：,参数为空：'',null,参数错误   @,base/hash_size number边界验证-超出：-2147483648-1,2147483647+1|
|2|高级函数|DBMS_UTILITY.GET_TIME|返回一个数值用于表示当前时间，以百分之一秒为单位。|RETURN NUMBER;|有效：0,无效：1|/|/|/|
|3|高级函数|DBMS_UTILITY.GET_ENDIANNESS|获取数据库平台的字节序。|RETURN NUMBER;,1 表示 big-endian  将高序字节存储在起始地址（高位编址）  ，,2 表示 little-endian--  将低序字节存储在起始地址（低位编址）|有效：0,无效：1|/|/|/|
|4|高级函数|DBMS_UTILITY.IS_CLUSTER_DATABASE|判断数据库是在集群模式，只有RAC部署返回为true。|RETURN BOOLEAN;|有效：0,无效：1|/|/|/|
|5|高级函数|DBMS_UTILITY.OLD_CURRENT_SCHEMA|返回当前会话的SCHEMA。|RETURN VARCHAR2;|有效：0,无效：1|/|/|/|
|6|高级函数|DBMS_UTILITY.OLD_CURRENT_USER|返回当前会话的USER。|RETURN VARCHAR2;|有效：0,无效：1|/|/|/|
|7|高级函数|DBMS_UTILITY.IS_BIT_SET|检查给定的RAW变量对应位置的bit是否被设置。|r IN RAW：  需要检查的RAW值,n IN NUMBER：  需要检查的bit,RETURN NUMBER：  如果对应位置的bit为1则返回1|有效：2,无效：0,3|有效：,r：raw，隐式转换-字符型/blob,n：数值型-int/tinint/smallint/float/double/bigint/number，'1'等转换为数值型的,返回值类型验证:typeof(RETURN),无效：,r：不可隐式转换为raw的类型-int,n：不能转换为数值型--如time/data/datatime|  
|有效：,r数据长度验证：—32000个字符/2,8000(cast(rpad('f',8000,'f') as raw) 8000*2,r内容：0-9A-F,base/hash_size   number边界验证：  ['1E-30',cast(rpad('9',125,'9') as number],无效：,参数为空：'',null,'G',参数错误   @|
|8|高级函数|DBMS_UTILITY.PORT_STRING|返回操作系统的平台以及版本。|RETURN VARCHAR2|有效：0,无效：1|/|/|/|
|9|高级函数|DBMS_UTILITY.CURRENT_INSTANCE|返回当前连接实例id。|RETURN NUMBER|有效：0,无效：1|/|/|/|
|10|高级过程|DBMS_UTILITY.ACTIVE_INSTANCES|返回当前活跃实例id。| INSTANCE_TABLE OUT ：包含活动实例编号和名称的列表。当没有实例启动时，列表为空,instance_count      OUT NUMBER：活动实例数|有效,2,无效：0，3|有效：,INSTANCE_TABLE：  dbms_utility.instance_table,instance_count：数值型-int/tinint/smallint/float/double/bigint/number，'1'等转换为数值型的,  
,无效：,INSTANCE_TABLE：varchar,instance_count：不能转换为数值型--如time/data/datatime|  
|无效：,参数为空：'',null,参数错误   @|
|11|高级函数|DBMS_UTILITY.FORMAT_ERROR_BACKTRACE|返回PLSQL调用错误信息。|RETURN VARCHAR2--  输出类似于SQLERRM函数的输出|有效：0,无效：1|  
|  
|  
|
|12|高级过程|DBMS_UTILITY.DB_VERSION|返回数据库版本信息。|version OUT VARCHAR2：表示数据库的内部软件版本,compatibility OUT VARCHAR2：,数据库的兼容性设置由“compatible”决定。参数。    `init`      `ora`  ,如果未在文件中指定该参数，则返回该参数。    `init.ora`      `NULL`  |有效：0,无效：1|有效：  字符型,无效：  不可隐式转换为字符型的类型,  
|  
|无效：,参数为空：'',null,参数错误   @|
|13|高级过程|DBMS_UTILITY.NAME_RESOLVE|返回对象名字解析信息。|name IN VARCHAR2,  对象的名称  它可以采用 [[a.]b.]c[@d] 形式，其中 a、b、c 是 SQL 标识符，d 是 dblink。 不对 dblink 执行语法检查。 如果指定了 dblink，或者名称解析为具有 dblink 的内容，则不会解析对象，但会填充 schema、part1、part2 和 dblink OUT 参数。    
  context IN NUMBER,  必须是0到9之间的数值。- 0:table - 1:PL/SQL - 2: sequences - 3: trigger - 4:Java Source - 5: Java resource - 6: Java class - 7: type - 8: Java shared data - 9: index    
  schema OUT VARCHAR2,  对象的模式    
  part1 OUT VARCHAR2,  名称的第一部分    
  part2 OUT VARCHAR2,    
  dblink OUT VARCHAR2,    
  part1_type OUT NUMBER,    `part1`    类型  5: synonym - 7: procedure(top level) - 8: function(top level) - 9: packag    
  object_number OUT NUMBER);  对象标识符|有效：8,无效：0,1,9|有效：,name/schema/part1/part2/dblink:字符型,context/part1_type/object_number:数值型-int/tinint/smallint/float/double/bigint/number，'1'等转换为数值型的,  
,无效：,name/schema/part1/part2/dblink:不可隐式转换为字符型的类型,context/part1_type/object_number:,不能转换为数值型--如time/data/datatime|  
|有效：,name-对象存在,context [0-10],name对象类型和context类型匹配,无效：,name-对象不存在,,数据长度验证：32000,context：-1,11,name对象类型和context类型不匹配,参数为空：'',null，,参数错误   @|
|14|高级过程|DBMS_UTILITY.GET_SQL_HASH|返回SQL的MD5的hash值信息。|name IN VARCHAR2：要散列的字符串,hash OUT RAW：存储返回的哈希值的所有 16 个字节,pre10ihash OUT NUMBER：存储 10i 之前的数据库版本哈希值,RETURN NUMBER;最后 4 个字节|有效：3,无效：0,2|有效：,name:字符型,hash 隐式转换-字符型/blob,NUMBER:数值型-int/tinint/smallint/float/double/bigint/number，'1'等转换为数值型的,无效：,hash   ：不可隐式转换为raw的类型-int,pre10ihash ：不能转换为数值型--如time/data/datatime|  
|有效,name  数据长度验证：32000,name内容：中文、英文、特殊字符、表情符，数字、空白符,参数为空：'',null，,  
,无效：,参数错误   @,  
|
|15|高级包过程|DBMS_UTILITY.COMMA_TO_TABLE|将逗号分隔的名字字符串转换成数组|list IN VARCHAR2：逗号分隔列表，简单- a, b, c, d ，第一次重载： a [. b [. c ]][ @ d ]，第二次重载的以下格式： a [. b]*,tablen OUT BINARY_INTEGER：PL/SQL 表中的表数,tab OUT uncl_array/  lname_array  ：包含名称列表的 PL/SQL 表,PS：分布式不支持|有效：3,无效：0,2|有效：,list :字符型,tablen:BINARY_INTEGER,tab :uncl_array、  lname_array,无效：,tablen/tab date|  
|有效：,name内容：有效标识符，, uncl_array：a [. b [. c ]][ @ d ],lname_array: a [. b]*，多个对象总共-32000,无效：,无效标识符：中文、英文、特殊字符、表情符，数字,name数据长度验证：单个对象-32000（最长64），,uncl_array：a.b.c.d@e,lname_array:a.b.c.d@e,参数为空：'',null，,参数错误 @|
|16|高级包过程|DBMS_UTILITY.TABLE_TO_COMMA|将名字数组转换成逗号分隔的字符串|tab IN UNCL_ARRAY,   包含表名列表的 PL/SQL 表    
  tablen OUT BINARY_INTEGER,   PL/SQL 表中的表数    
  list OUT VARCHAR2   以逗号分隔的表列表,**PS:不校验tab合法性，**  分布式不支持|有效：3,无效：0,1,4|有效：,tab：  uncl_array、  lname_array,tablen：数值型,list：字符型,无效：,tab: varchar,tablen: date/list|  
|有效：,uncl_array：a [. b [. c ]][ @ d ],lname_array: a [. b]*,单个对象-32000，多个对象总共-32000,无效：—不会 校验对象是否合法,  
|
|17|高级包过程|DBMS_UTILITY.NAME_TOKENIZE|将形如 **a [. b [. c ]][@ dblink ]**的字符串转换为4部分：a,b,c,dblink进行输出--校验|name IN VARCHAR2,  输入名称,由 SQL 标识符组成（例如，scott.foo@dblink）    
  a OUT VARCHAR2,  名称的第一个标记的输出    
  b OUT VARCHAR2,  名称的第二个标记的输出    
  c OUT VARCHAR2,  名称的第三个标记的输出（如果适用）    
  dblink OUT VARCHAR2,名称的输出    `dblink`      
  nextpos OUT BINARY_INTEGER);  解析输入名称后的下一个位置|有效：6,无效：0,7|有效：,name/a/b/c/dblink：字符型,nextpos BINARY_INTEGER/int,无效,a/b/c/dblink date,  
|  
|有效,name:a [. b [. c ]][@ dblink ],无效：,无效标识符，标识符长度>64,参数为空：'',null，,参数错误 @|
|18|高级包函数|DBMS_UTILITY.GET_PARAMETER_VALUE|通过参数名拿取,v$parameter中的参数值|parnam IN VARCHAR2：参数名称, intval IN OUT BINARY_INTEGER：整数参数的值或字符串参数的值长度, strval IN OUT VARCHAR2：字符串参数的值,listno IN BINARY_INTEGER   **DEFAULT 1**  ：列出项目编号。如果检索可多次指定以累加值的参数的参数值，请使用此参数获取每个单独的参数。,RETURN BINARY_INTEGER;,0：  INTEGER  /  BOOLEAN     parameter,1：string/file parameter|有效：3,4,无效：0,1,5|有效,parnam：字符型,intval/strval/listno 数值型,  
,无效：,intval/strval/listno:date,  
|  
|有效：,parnam 存在参数,listno：-1，=max(int64),  
,无效：,parnam 不存在参数，长度=  32000,listno >max(int64),参数为空：'',null，,参数错误 @|
|19|高级包类型|DBMS_UTILITY.LNAME_ARRRAY|关联数组定义：  **TYPE LNAME_ARRAY IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;**|  
|  
|  
|  
|  
|
|20|高级包类型|DBMS_UTILITY.UNCL_ARRAY|关联数组定义：  **TYPE UNCL_ARRAY IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;**|  
|  
|  
|  
|  
|
|21|高级包类型|DBMS_UTILITY.INSTANCE_RECORD|TYPE INSTANCE_RECORD IS RECORD (inst_number NUMBER, inst_name VARCHAR(64));|  
|  
|  
|  
|  
|
|22|高级包类型|DBMS_UTILITY.INSTANCE_TABLE|TYPE INSTANCE_TABLE IS TABLE OF INSTANCE_RECORD;|  
|  
|  
|  
|  
|


  


**业务使用**

高级包函数--返回值使用：

RETURN NUMBER: GET_HASH_VALUE  /GET_TIME/GET_ENDIANNESS/IS_CLUSTER_DATABASE(  BOOLEAN  )//IS_BIT_SET/CURRENT_INSTANCE

RETURN VARCHAR: OLD_CURRENT_SCHEMA/OLD_CURRENT_USER/PORT_STRING/FORMAT_ERROR_BACKTRACE

高级过程–返回值使用：

GET_SQL_HASH

高级过程–出参使用：

ACTIVE_INSTANCES/DB_VERSION/NAME_RESOLVE/GET_SQL_HASH/COMMA_TO_TABLE/TABLE_TO_COMMA/NAME_TOKENIZE/GET_PARAMETER_VALUE

|输入条件|等价类|备注|
|:---|:---|:---|
|DDL,  
|create时函数返回值作为列的默认值|  
|
||alter时函数返回值作为列的default默认值|  
|
|DML,  
|insert|函数返回值作为values|
||update|函数返回值作为条件|
||delete|  
|
||filter条件|  
|
|DQL,  
|作为select投影列返回|  
|
||作为where条件|1. where func(col1) = xx
1. where col1 = func(xx)
|
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|
||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null|  
|
||结合group by分组(聚合函数)|  
|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||变量调用|做内置函数入参|
||参与运算--RETURN NUMBER|+ - * /  > < >= <=  and or|
|plsql|变量赋值|  
|
||动态sql的绑定参数传入|  
|
||  
|高级包/过程体？|


**其他场景**

|  
|接口|接口表现|接口说明|参数/返回值|有效,  
|无效|
|:---|:---|:---|:---|---|---|---|
|1|高级函数|DBMS_UTILITY.GET_HASH_VALUE|计算给定字符串的哈希值，哈希值落在给定的范围内。|name VARCHAR2：要进行哈希处理的字符串,base NUMBER：要开始的返回哈希值的基值,hash_size NUMBER：哈希表的所需大小,RETURN NUMBER;哈希值|1.  base:浮点数、整数,hash_size：整数,2.通过参数绑定入参,  
|  
,hash_size：0、浮点数|
|2|高级函数|DBMS_UTILITY.GET_TIME|返回一个数值用于表示当前时间，以百分之一秒为单位。|RETURN NUMBER;|1.获取当前时间,2.获取时间差：start-end,end-start,3.时间差转换：转换为s:(end-start)/100,4.系统时间：  1970年1月1日 00:00:00、2070年,5.作为时间函数入参，转换为时间--转换后时间正确|/|
|3|高级函数|DBMS_UTILITY.GET_ENDIANNESS|获取数据库平台的字节序。|RETURN NUMBER;,1   高位编址  ，,2   低位编址|/|/|
|4|高级函数|DBMS_UTILITY.IS_CLUSTER_DATABASE|判断数据库是在集群模式，只有RAC部署返回为true。|RETURN BOOLEAN;|单机/分布式:false,rac集群：true|/|
|5|高级函数|DBMS_UTILITY.OLD_CURRENT_SCHEMA|返回当前会话的SCHEMA。|RETURN VARCHAR2;|1.OLD_CURRENT_SCHEMA默认和OLD_CURRENT_USER一样,2.dba用户登录：ALTER SESSION SET current_schema=当前用户后查询,3.dba用户登录：ALTER SESSION SET current_schema=sys,4.dba用户登录：ALTER SESSION SET current_schema=其他自定义用户后查询,5.sys用户登录：ALTER SESSION SET current_schema=dba用户后查询,6.用户为"'",' '|/|
|6|高级函数|DBMS_UTILITY.OLD_CURRENT_USER|返回当前会话的USER。|RETURN VARCHAR2;|1.sys,2.dba,3.用户为"'",' '|/|
|7|高级函数|DBMS_UTILITY.IS_BIT_SET|检查给定的RAW变量对应位置的bit是否被设置。|r IN RAW：  需要检查的RAW值,n IN NUMBER：  需要检查的bit,RETURN NUMBER：  如果对应位置的bit为1则返回1|/|  
|
|8|高级函数|DBMS_UTILITY.PORT_STRING|返回操作系统的平台以及版本。|RETURN VARCHAR2|x86_64,arm_64|/|
|9|高级函数|DBMS_UTILITY.CURRENT_INSTANCE|返回当前连接实例id。|RETURN NUMBER|备机执行,CN/DN/MN执行|/|
|10|高级过程|DBMS_UTILITY.ACTIVE_INSTANCES|返回当前活跃实例id。| INSTANCE_TABLE OUT ：包含活动实例编号和名称的列表。当没有实例启动时，列表为空,instance_count      OUT NUMBER：活动实例数|  
,分布式拦截,  
|  
|
|11|高级函数|DBMS_UTILITY.FORMAT_ERROR_BACKTRACE|返回PLSQL调用错误信息。|RETURN VARCHAR2--  输出类似于SQLERRM函数的输出|YAS-[errcode]: at [objectName], line [number],errcode/objectName/number 正确,return >2000字节被截断|  
|
|12|高级过程|DBMS_UTILITY.DB_VERSION|返回数据库版本信息。|version OUT VARCHAR2：表示数据库的内部软件版本,compatibility OUT VARCHAR2：,数据库的兼容性设置由“compatible”决定。参数。    `init`      `ora`  ,如果未在文件中指定该参数，则返回该参数。    `init.ora`      `NULL`  |  
,compatibility    返回null|出参长度不足：VARCHAR(2)|
|13|高级过程|DBMS_UTILITY.NAME_RESOLVE|返回对象名字解析信息。|name IN VARCHAR2,  对象的名称  它可以采用 [[a.]b.]c[@d] 形式，其中 a、b、c 是 SQL 标识符，d 是 dblink。 不对 dblink 执行语法检查。 如果指定了 dblink，或者名称解析为具有 dblink 的内容，则不会解析对象，但会填充 schema、part1、part2 和 dblink OUT 参数。    
  context IN NUMBER,  必须是0到9之间的数值。- 0:table - 1:PL/SQL - 2: sequences - 3: trigger - 4:Java Source - 5: Java resource - 6: Java class - 7: type - 8: Java shared data - 9: index    
  schema OUT VARCHAR2,  对象的模式    
  part1 OUT VARCHAR2,  名称的第一部分    
  part2 OUT VARCHAR2,    
  dblink OUT VARCHAR2,    
  part1_type OUT NUMBER,    `part1`    类型  5: synonym - 7: procedure(top level) - 8: function(top level) - 9: packag    
  object_number OUT NUMBER);  对象标识符|sys对象、dba对象,分布式不支持dblink,  
,t1,sys.t1,sys.package.process@dblink|a.b.c.d@e,a..b,  
,出参长度不足：VARCHAR(1)|
|14|高级过程|DBMS_UTILITY.GET_SQL_HASH|返回SQL的MD5的hash值信息。|name IN VARCHAR2：要散列的字符串,hash OUT RAW：存储返回的哈希值的所有 16 个字节,pre10ihash OUT NUMBER：存储 10i 之前的数据库版本哈希值,RETURN NUMBER;最后 4 个字节|  
|  
,  
|
|15|高级包过程|DBMS_UTILITY.COMMA_TO_TABLE|将逗号分隔的名字字符串转换成数组|list IN VARCHAR2：逗号分隔列表，简单- a, b, c, d ，第一次重载： a [. b [. c ]][ @ d ]，第二次重载的以下格式： a [. b]*,tablen OUT BINARY_INTEGER：PL/SQL 表中的表数,tab OUT uncl_array/  lname_array  ：包含名称列表的 PL/SQL 表,PS：分布式不支持|  
|  
|
|16|高级包过程|DBMS_UTILITY.TABLE_TO_COMMA|将名字数组转换成逗号分隔的字符串|tab IN UNCL_ARRAY,   包含表名列表的 PL/SQL 表    
  tablen OUT BINARY_INTEGER,   PL/SQL 表中的表数    
  list OUT VARCHAR2   以逗号分隔的表列表,**PS:不校验tab合法性，**  分布式不支持|  
|  
|
|17|高级包过程|DBMS_UTILITY.NAME_TOKENIZE|将形如 **a [. b [. c ]][@ dblink ]**的字符串转换为4部分：a,b,c,dblink进行输出|name IN VARCHAR2,  输入名称,由 SQL 标识符组成（例如，scott.foo@dblink）    
  a OUT VARCHAR2,  名称的第一个标记的输出    
  b OUT VARCHAR2,  名称的第二个标记的输出    
  c OUT VARCHAR2,  名称的第三个标记的输出（如果适用）    
  dblink OUT VARCHAR2,名称的输出    `dblink`      
  nextpos OUT BINARY_INTEGER);  解析输入名称后的下一个位置|  
,sys对象、dba对象,分布式不支持dblink,  
,t1,sys.t1,sys.package.process@dblink,a空白符b|a.b.c.d@e,a..b,  
|
|18|高级包函数|DBMS_UTILITY.GET_PARAMETER_VALUE|通过参数名拿取,v$parameter中的参数值|parnam IN VARCHAR2：参数名称, intval IN OUT BINARY_INTEGER：整数参数的值或字符串参数的值长度, strval IN OUT VARCHAR2：字符串参数的值,listno IN BINARY_INTEGER   **DEFAULT 1**  ：列出项目编号。如果检索可多次指定以累加值的参数的参数值，请使用此参数获取每个单独的参数。,RETURN BINARY_INTEGER;,0：  INTEGER  /  BOOLEAN     parameter,1：string/file parameter|  
,字符串参数,整数参数,布尔值参数,浮点参数BLOOM_FILTER_FACTOR,参数value类型都为varchar|  
|
|19|高级包类型|DBMS_UTILITY.LNAME_ARRRAY|关联数组定义：  **TYPE LNAME_ARRAY IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;**|  
|  
|  
|
|20|高级包类型|DBMS_UTILITY.UNCL_ARRAY|关联数组定义：  **TYPE UNCL_ARRAY IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;**|  
|  
|  
|
|21|高级包类型|DBMS_UTILITY.INSTANCE_RECORD|TYPE INSTANCE_RECORD IS RECORD (inst_number NUMBER, inst_name VARCHAR(64));|  
|  
|  
|
|22|高级包类型|DBMS_UTILITY.INSTANCE_TABLE|TYPE INSTANCE_TABLE IS TABLE OF INSTANCE_RECORD;|  
|  
|  
|


  


**特性交互**

|测试项|描述|备注|
|---|---|---|
|权限|所有用户权限都能执行|  
|
|审计|高级包能被审计|  
|
|备份恢复|  
|不涉及|
|升级|  
|离线升级验证|
|分布式|分布式CN/DN/MN 用sys/DBA执行|  
|
|DBMS_METADATA.GET_DDL|查询高级包过程体|  
|
|DBMS_UTILITY原有接口|DBMS_UTILITY.FORMAT_CALL_STACK()     
  RETURN VARCHAR; 返回当前过程体调用栈的格式化输出|分布式/集群执行，复用已有用例|
|  
|DBMS_UTILITY.FORMAT_ERROR_STACK     
  RETURN VARCHAR;返回当前错误栈的格式化输出|分布式/集群执行，复用已有用例|
|  
|DBMS_UTILITY.EXEC_DDL_STATEMENT (    
  parse_string IN VARCHAR2    
  );执行DDL语句，其中parse_string为待执行的语句|分布式/集群执行，分布式拦截|


**专项验证**

|测试项|描述|  
|
|---|---|---|
|HA|主备执行|  
|
|并发|背景业务下执行|增加到CT/KT|


  


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

冒烟：

文本：

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：9  *人天*

计划测试执行时间：2024.6.4-14

## Attachments:

[image2024-5-22_1-9-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGJhMWFkOWEzMzExZGM4ZTYzIiwicmVmX2lkIjoiNjczOTZkMGE3MjgyMDZlZmI5MmYxYTZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTE5LCJleHAiOjE3ODIzOTE5MTl9.ztoyP6Yt3ZJ7t1Nsu4pP22gJbZO4-QoggPrETfjXXOM)

 (image/png)    


[set_false.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGI4OTcwYzJhZjRmNTIwZmYyIiwicmVmX2lkIjoiNjczOTZkMGE3MjgyMDZlZmI5MmYxYTZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTE5LCJleHAiOjE3ODIzOTE5MTl9.EGMVoDkX7qIGEAYJ5hNL8qha1ngNGeww3mJvJ6uRnLU)

 (image/png)    


[DBMS_UTILITY文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGI4OTcwYzJhZjRmNTIwZmYzIiwicmVmX2lkIjoiNjczOTZkMGE3MjgyMDZlZmI5MmYxYTZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTE5LCJleHAiOjE3ODIzOTE5MTl9.NDad34sM6p1N5GhJkoIY4evy3Afcz1xapGTdmrXArQY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[test_sr26620_smoke.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGJhMWFkOWEzMzExZGM4ZTY0IiwicmVmX2lkIjoiNjczOTZkMGE3MjgyMDZlZmI5MmYxYTZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTE5LCJleHAiOjE3ODIzOTE5MTl9.4jwkrccWiLiwIiIVC84_afJejjx4VxAsU1W2IqcEv2M)

 (application/octet-stream)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：王海峰，施新华，何阳，赖美全，邬建川，刘美秀    
  会议时间：2024/5/31 14:15-15:00    
  会议地点：线上    
  纪要信息：    
  1.约束同步：DBMS_UTILITY.EXEC_DDL_STATEMENT---分布式拦截    
  2.信息同步：入参RAW类型在计算时数据长度约束为32000，而不是存储的8000    
  3.新增场景：错误码验证,~~ERR_ANK_OBJECT_INCOMPATIBLE object specified is incompatible with the flag specified~~    
  ERR_PL_TOO_MANY_PART_OF_NAME 报错信息：input object has too many parts,Posted by liumeixiu at 五月 31, 2024 15:37|
|---|
