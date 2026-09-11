Created by 张江, last modified on 六月 05, 2024

# 1.概述

SR链接：    [YDBRD-22222](https://jira.yasdb.com/browse/YDBRD-22222?src=confmacro)    -  支持结果集和描述信息的获取  开发中

本次需求涉及到的DBMS_SQL结果集和描述信息子函数主要为：  DBMS_SQL.DEFINE_ARRAY(本次不做)、DBMS_SQL.DEFINE_COLUMN、DBMS_SQL.FETCH_ROWS、DBMS_SQL.EXECUTE_AND_FETCH、DBMS_SQL.DESCRIBE_COLUMNS(本次不做)、DBMS_SQL.COLUMN_VALUE

# 2.需求分析

## 2.1功能点分析

1）DBMS_SQL.DEFINE_ARRAY：用于实现从指定游标中获取数据行中列的集合。可以从单个select语句中批量获取行，存储在DBMS_SQL缓冲区中，直到调用DBMS_SQL.COLUMN_VALUE返回游标中指定位置的元素值。语法如下：

DBMS_SQL.DEFINE_ARRAY (c IN INTEGER,position IN INTEGER,<table_variable> IN <datatype>,cnt IN INTEGER, lower_bnd IN INTEGER  );

其中，c为要  绑定数组的游标ID；position为定义数组中列的位置，第一列位置为1；  table_variable为已声明的局部变量；cnt为要fetch的数据行数；lower_bnd为可选参数，表示数据集合的下线索引值。

2）DBMS_SQL.DEFINE_COLUMN：用于实现从给定游标中选择的列。定义的列由给定游标语句中的select列的相对位置进行标识，定义的类型也同样被标识。语法如下：

DBMS_SQL.DEFINE_COLUMN (

    c IN INTEGER,

    position IN INTEGER,

    column IN <datatype>);

OR

DBMS_SQL.DEFINE_COLUMN (

    c IN INTEGER,

    position IN INTEGER,

    column IN VARCHAR2 CHARACTER SET ANY_CS,

    column_size IN INTEGER);

其中，c为游标ID；  position为定义的数据行中列的位置，第一列位置为1；column为定义的列名；column_size参数可选，为  varchar2类型定义的列可以返回的最大长度。

返回的最大字节数计算方式为：column_size * 当前字符集中最大字符对应的字节大小，如在UTF8字符集中，将column_size指定为10表示可以返回最多30(10*3)个字节大小。

3）DBMS_SQL.FETCH_ROWS：用于从给定的游标中获取一行数据，只要还有行要提取，则可以重复调用；返回实际提取的行数。语法如下：

DBMS_SQL.FETCH_ROWS (

    c IN INTEGER

) RETURN INTEGER;其中，c表示游标ID，返回给定游标中的一行数据。

4）DBMS_SQL.EXECUTE_AND_FETCH：用于执行给定的游标并获取数据行。该函数功能等同于调用execute+fetch_rows，在针对远程数据库时，调用execute_and_fetch子函数会减少网络往返使用次数，提升性能。语法如下：

DBMS_SQL.EXECUTE_AND_FETCH (

    c IN INTEGER,

    exact IN BOOLEAN DEFAULT FALSE)

 RETURN INTEGER;

其中，c为游标ID；exact设置为true，若实际查询的行数不为1时，则触发异常；设置为false，若实际查询不到数据或者查询到多行数据时不报错。

返回值：返回指定的数据行。

5）DBMS_SQL.DESCRIBE_COLUMNS：用于描述通过DBMS_SQL打开和解析的列信息。语法如下：

DBMS_SQL.DESCRIBE_COLUMNS (c IN INTEGER,col_cnt OUT INTEGER,desc_t OUT DESC_TAB  );

其中，c为游标ID；col_cnt为出参，表示查询语句中的列数；desc_t为出参，  描述要填写查询列元数据信息的数据集，为嵌套表类型，在Oracle中定义为dbms_sql.desc_rec类型，具体如下：

TYPE desc_rec IS RECORD (    
      col_type BINARY_INTEGER := 0,    
      col_max_len BINARY_INTEGER := 0,    
      col_name VARCHAR2(32) := '',    
      col_name_len BINARY_INTEGER := 0,    
      col_schema_name VARCHAR2(32) := '',    
      col_schema_name_len BINARY_INTEGER := 0,    
      col_precision BINARY_INTEGER := 0,    
      col_scale BINARY_INTEGER := 0,    
      col_charsetid BINARY_INTEGER := 0,    
      col_charsetform BINARY_INTEGER := 0,    
      col_null_ok BOOLEAN := TRUE

);

TYPE desc_tab IS TABLE OF desc_rec INDEX BY BINARY_INTEGER;

列元数据信息说明如下：

|列名|说明|
|:---|:---|
|col_type|列的类型|
|col_max_len|列的最大长度|
|col_name|列名|
|col_name_len|列名长度|
|col_schema_name|列所属模式名|
|col_schema_name_len|列所属模式名长度|
|col_precision|列的精度|
|col_scale|列的宽度|
|col_charsetid|列字符集id|
|col_charsetform|列字符集样式|
|col_null_ok|列是否为NULL值标志：如果为true，则可以存储null值|


6）  DBMS_SQL.COLUMN_VALUE：用于返回给定游标中指定位置的光标元素对应的值，该函数通常用于访问调用FETCH_ROWS获取的数据。语法如下：

DBMS_SQL.COLUMN_VALUE (c IN INTEGER,position IN INTEGER,value OUT <datatype>[,column_error OUT NUMBER][,actual_length OUT INTEGER]);

对于含有CHAR、RAW、ROWID数据的变量，可以使用下面的语法结构：

DBMS_SQL.COLUMN_VALUE (c IN INTEGER,position IN INTEGER,value OUT   CHAR CHARACTER SET ANY_CS  [,column_error OUT NUMBER][,actual_length OUT INTEGER]);

DBMS_SQL.COLUMN_VALUE (c IN INTEGER,position IN INTEGER,value OUT   RAW  [,column_error OUT NUMBER][,actual_length OUT INTEGER]);

DBMS_SQL.COLUMN_VALUE (c IN INTEGER,position IN INTEGER,value OUT   RAW  [,column_error OUT NUMBER][,actual_length OUT INTEGER]);

其中，c为游标ID；  position为列在光标中的相对位置，第一列位置为1；value为返回指定列的值，若输出参数的类型与对DEFINE_COLUMN的调用所定义的值的实际类型不同，则会触发  ORA-06562  ,     inconsistent_type错误；

column_error为返回指定列值的错误代码；actual_length为返回指定列在截断之前的实际长度。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机和集群环境。

# 3.详细测试设计

## 3.1测试设计方法

主要采用等价类划分、场景法组合进行设计。

## 3.2详细测试设计

### 3.2.1等价类划分：

DBMS_SQL.DEFINE_COLUMN (c IN INTEGER,position IN INTEGER,column IN <datatype>)

DBMS_SQL.DEFINE_COLUMN (c IN INTEGER,position IN INTEGER,column IN VARCHAR2,column_size IN INTEGER)

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,参数校验,  
    
|参数个数|可以是3或者4个|参数个数小于3或大于4个|
||  
,  
,  
,  
,  
,  
,  
,  
,参数类型|1、c：,整型：int/integer,可以兼容的类型：bigint、number、float、DOUBLE,2、  position：,整型如：int/integer；,可以兼容的类型：tinyint、smallint、bigint、number、float、DOUBLE,3、column：,覆盖目前YashanDB支持的标量数据类型，如下：,- 数值型：  TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE
- 字符型：CHAR、VARCHAR、NCHAR、NVARCHAR(类型转换)
- 日期型：  DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND
- 布尔型：BOOLEAN
- 大对象型：BLOB、CLOB、NCLOB
- 其他类型：ROWID、UROWID、RAW、JSON、(XMLTYPE?)
,4、  column_size,数值型：tinyint、smallint、int/integer、bigint、number、float、DOUBLE等；|c：  字符型或者不在有效类型范围内的其他类型,position：非数值型或者不能隐式转换成数值型的其他类型,column：YashanDB目前不支持的其他类型,column_size：非数值型或者不能隐式转换成数值型的其他类型,  
|
||参数值|1、c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,2、  position：为从1开始的有效正数，与解析语句中select列表项所在位置对应,3、column：定义列的类型有效，并且与select列表中列类型匹配或者可以隐式转换,4、column_size：当定义的变量为varchar类型时，则需要指定column_size该参数值，一般应与select列表中定义列大小一致，  最大值应小于等于varchar类型存储的最大长度(oracle可以输入的最大值为32000)|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,position：,- 为负数、0或者值大于select列表项个数
- 非数值型的其他值
,column：,- 定义列类型与实际select列类型不匹配或者不能隐式转换
- 变量未提前声明
,column_size：,- column_size为负数、非数值型的其他值
- 数值越过varchar类型存储的最大长度(32k)
- 参数缺失或超出(如定义列为varchar类型时，未指定column_size该参数值)
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|/|/|
|异常处理|/|主要表现在参数校验过程中出现的异常|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行define_column操作|/|
|使用场景|/|- 通常在声明单元中定义好变量，类型与select投影列类型匹配
- 通常和execute、fetch_rows、column_value子函数结合使用
|/|


DBMS_SQL.FETCH_ROWS(c IN INTEGER)   RETURN INTEGER

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,参数校验,  
    
|参数个数|1个|参数个数不为1|
||参数类型|整型如：int/integer,可以兼容的类型：bigint、number、float、DOUBLE|字符型或者不在有效类型范围内的其他类型|
||参数值|正常调用open_cursor后返回的游标ID,c integer :=   dbms_sql.open_cursor|- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
- 当要fetch的数据为空时，后需再调用fetch_rows函数时则报错
- 未调用execute函数时执行fetch_rows则报错
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|返回值类型|使用typeof查询返回值类型正确|/|
|  
|返回值|返回值为1或者0|当要获取的行数为空时，后续执行  fetch_rows操作则报错|
|数据规格|/|/|/|
|异常处理|  
|1、参数校验异常,2、执行过程中出现的异常：,- 通过others去捕获异常并处理
- 通过系统预定义异常去捕获，需要结合define_column子函数一起使用，可能涉及到的异常句柄有：  ZERO_DIVIDE
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行fetch_rows操作|/|
|使用场景|/|- 通常定义一个整型变量用于获取返回值行数，rows := dbms_sql.fetch_rows(c)
- 可以用于if控制语句中
- 可以用于for loop循环语句中
|/|


DBMS_SQL.EXECUTE_AND_FETCH (c IN INTEGER,exact IN BOOLEAN DEFAULT FALSE) RETURN INTEGER

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,  
,  
,参数校验,  
    
|参数个数|可以是1或者2个|参数个数小于1或者大于2个|
||参数类型|c：,整型：int/integer,浮点型如：bigint、number、float、double,exact：,布尔型：BOOLEA,可以和布尔型互转的其他有效类型|c：,字符型或者不在有效类型范围内的其他类型,exact：,非布尔型或者不能同布尔型互转的其他类型|
||参数值|c：,正常调用open_cursor后返回的游标ID,c integer :=   dbms_sql.open_cursor,exact：,参数可缺省，默认为false,null值,true、false,可以和布尔型互转的其他有效值：,- true：'true'、't'、'yes'、'y'、'on'、'1'、1
- false：'false'、'f'、'no'、'n'、'off'、'0'、0
|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,exact：,- 非true、false或者不能同  布尔型互转的其他非法值
- 空串''
,exact=true时：,- 未查询到数据行时则报no data found错误
- 查询到多行数据时，则报exact fetch returns more than requested number of rows错误
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|返回值类型|使用typeof查询返回值类型正确|/|
||返回值|返回值为1或者0|/|
|数据规格|/|/|/|
|异常处理|/|1、参数校验异常,2、执行过程中出现的异常：,- 通过others去捕获异常并处理
- 通过系统预定义异常去捕获，需要结合define_column子函数一起使用，可能涉及到的异常句柄有：  ZERO_DIVIDE(后续不补全)
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行execute_and_fetch操作|/|
|使用场景|/|- 通常定义一个整型变量用于获取返回值行数，rows := dbms_sql.execute_and_fetch(c)
- 可以用于if控制语句中
- 可以用于for loop循环语句中
- 返回的结果行数为1、0、可用于赋值、回写表操作
|/|


DBMS_SQL.COLUMN_VALUE (c IN INTEGER,position IN INTEGER,value OUT <datatype>[,column_error OUT NUMBER][,actual_length OUT INTEGER])

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,参数校验,  
    
|参数个数|可以是3或者5|参数个数不为3或者5|
||参数类型|1、c：,整型如：int/integer,浮点型如：bigint、number、float、double,2、position：,数值型如：tinyint、smallint、int/integer、bigint、number、float、double；,3、  value：,覆盖目前YashanDB支持的标量数据类型，如下：,- 数值型：  TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE
- 字符型：CHAR、VARCHAR、NVARCHAR、NCHAR
- 日期型：  DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND
- 布尔型：BOOLEAN
- 大对象型：BLOB、CLOB、NCLOB
- 其他类型：ROWID、UROWID、RAW、JSON、(XMLTYPE?)、geometry等
,4、  column_error：,数值型如：int/integer、bigint、number、float等,5、actual_length：,数值型如：int/integer、bigint、number、float等|c：  字符型或者不在有效类型范围内的其他类型,position：非数值型或者不能隐式转换成数值型的其他类型,value：YashanDB目前不支持的其他类型(UDT类型作为投影列),column_error、actual_length：非数值型或者不能隐式转换成数值型的其他类型|
||参数值|c：正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,position：为从1开始的有效正数，与解析语句中select列表项所在位置对应,value：定义列对应变量的类型有效，并且与define_column中定义类型完全一致,column_erro、actual_length：为出参变量，需校验返回值正确,正常情况下column_error=0，actual_length=列存储数据占用的实际大小；,当调用define_column定义列的大小<列实际存储数据大小时，column_erro返回为非0的正数，actual_length=列存储数据占用的实际大小|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,position：,- 为负数、0或者值大于select列表项个数
- 非数值型的其他值
,value：,- 定义列类型与define_column定义类型不一致，且不能隐式转换的类型
- 变量未提前声明
,column_erro、actual_length：,获取column_error、actual_length对应输出值时，必须要一起出现，否则报错|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|/|/|
|异常处理|/|1. 参数校验异常
1. 通过dbms_sql内置系统异常去捕获处理，内置系统异常为：dbms_sql.inconsistent_type
1. 范围溢出、长度溢出、不能隐式转换、精度溢出等
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行column_value操作|/|
|使用场景|/|1. 用于输出define_column定义列类型的变量值
1. 通常和define_column、execute、fetch_rows子函数结合使用
1. 可以用于loop循环语句中
|/|


DBMS_SQL.DEFINE_ARRAY (c IN INTEGER,position IN INTEGER,<table_variable> IN <datatype>,cnt IN INTEGER, lower_bnd IN INTEGER  )

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,参数校验|参数个数|5个|参数个数不为5|
||参数类型|1、c：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、varchar/nvarchar、char/nchar,2、  position：,数值型或者可以隐式转换成整型：tinyint、smallint、int/integer、bigint、number、float、DOUBLE、boolean,字符型：varchar、nvarchar、char、nchar,3、  <table_variable>：,本次要实现的dbms_sql.内置table类型及其可以绑定的子类型对应  如下：,4、  cnt：,数值型或者可以隐式转换成整型：tinyint、smallint、int/integer、bigint、number、float、DOUBLE,字符型：varchar、nvarchar、char、nchar,5、lower_bnd：,数值型或者可以隐式转换成整型：tinyint、smallint、int/integer、bigint、number、float、DOUBLE,字符型：varchar、nvarchar、char、nchar|c：  不在有效类型范围内的其他类型：,大对象|日期型|boolean|raw|rowid|json|xmltype|自定义类型等,position：非数值型或者不能隐式转换成数值型的其他类型：,大对象|日期型|raw|rowid|json|xmltype|自定义类型等,<table_variable>：非dbms_sql.内置table类型，普通标量类型、自定义类型,cnt：非数值型或者不能隐式转换成数值型的其他类型：,大对象|日期型|raw|rowid|json|xmltype|自定义类型等,lower_bnd：非数值型或者不能隐式转换成数值型的其他类型：,大对象|日期型|raw|rowid|json|xmltype|自定义类型等|
||序号|内置嵌套表类型|可绑定的基础类型|
|1|DBMS_SQL.NUMBER_TABLE|TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE|
|2|DBMS_SQL.CLOB_TABLE|CLOB、NCLOB|
|3|DBMS_SQL.BLOB_TABLE|BLOB|
|4|DBMS_SQL.VARCHAR2_TABLE|VARCHAR、NVARCHAR、CHAR、NCHAR|
|5|DBMS_SQL.BINARY_FLOAT_TABLE|FLOAT|
|6|DBMS_SQL.BINARY_DOUBLE_TABLE|DOUBLE|
|7|DBMS_SQL.DATE_TABLE|DATE|
|8|DBMS_SQL.TIMESTAMP_TABLE|TIMESTAMP|
|9|DBMS_SQL.INTERVAL_DAY_TO_SECOND_TABLE|INTERVAL DAY TO SECOND|
|10|DBMS_SQL.INTERVAL_YEAR_TO_MONTH_TABLE|INTERVAL YEAR TO MONTH|
|11|DBMS_SQL.UROWID_TABLE|UROWID、RAW|
|参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,position：为从1开始的有效正数，与解析语句中select列表项所在位置对应,<table_variable>：为dbms_sql内置嵌套表类型，其绑定的子类型与select列表中列类型匹配或者可以隐式转换,cnt：大于0的正数，可以小于、等于、大于结果集行数,lower_bnd：可以是正数、负数或者0|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,position：,- 负数、0
- 大于select列表项个数
- 非数值型的其他值
- null值、空串''
,<table_variable>：,- 嵌套表基础类型与实际表字段类型不一致(execute阶段校验)
- 自定义类型
- 普通标量类型
- 变量未提前声明
,cnt：,- 负数、0
- 数值越过int类型边界值
- null值、空串''
,lower_bnd：,- 非数值型的其他值
- 数值越过int类型边界值
- null值、空串''
|
|关键字校验|  
|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|  
|/|/|
|数据规格|  
|/|/|
|异常处理|  
|1.参数校验异常：,- 参数缺失或过多
- 绑定变量未提前声明
- 无效的参数值
,2.执行时异常：,同一条查询语句中，不能同时调用bind_array和define_array(ORA-29255: Cursor contains both bind and define arrays which is not permissible),同一条查询语句中，不能同时调用define_column和define_array(ORA-29256: Cursor contains both regular and array defines which is illegal)|/|
|权限控制|  
|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行column_value操作|/|
|使用场景|  
|1.和bind_variable、execute、fetch_rows、column_value等子过程结合使用,2.解析语句类型为select语句时，可以定义如下的投影列作为绑定数组变量，包含但不限于：,- select 表列
- select 表达式操作(内置函数、四则运算等)
- CTE查询：with table as select
- select 子查询
- select 视图/物化视图
- select 自定义函数
- select case when
- select 系统表
- select table表函数
- select 递归查询
- select 分区表(select * from tab partiton(partition_name))
,3.在循环语句、条件控制语句中使用|/|


|序号|内置嵌套表类型|可绑定的基础类型|
|---|---|---|
|1|DBMS_SQL.NUMBER_TABLE|TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE|
|2|DBMS_SQL.CLOB_TABLE|CLOB、NCLOB|
|3|DBMS_SQL.BLOB_TABLE|BLOB|
|4|DBMS_SQL.VARCHAR2_TABLE|VARCHAR、NVARCHAR、CHAR、NCHAR|
|5|DBMS_SQL.BINARY_FLOAT_TABLE|FLOAT|
|6|DBMS_SQL.BINARY_DOUBLE_TABLE|DOUBLE|
|7|DBMS_SQL.DATE_TABLE|DATE|
|8|DBMS_SQL.TIMESTAMP_TABLE|TIMESTAMP|
|9|DBMS_SQL.INTERVAL_DAY_TO_SECOND_TABLE|INTERVAL DAY TO SECOND|
|10|DBMS_SQL.INTERVAL_YEAR_TO_MONTH_TABLE|INTERVAL YEAR TO MONTH|
|11|DBMS_SQL.UROWID_TABLE|UROWID、RAW|


DBMS_SQL.DESCRIBE_COLUMNS (c IN INTEGER,col_cnt OUT INTEGER,desc_t OUT DESC_TAB  )

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,参数校验|参数个数|3个|参数个数不为3|
||参数类型|1、c：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、varchar/nvarchar、char/nchar,2、  col_cnt：数值型或者可以隐式转换成整型：tinyint、smallint、int/integer、bigint、number、float、DOUBLE,字符型：varchar、nvarchar、char、nchar,3、desc_t：dbms_sql.desc_tab，内置嵌套表类型。具体定义如下：,(覆盖精度，字节大小，覆盖所有标量类型、自定义类型等),(构造异常场景，其他子过程关联异常情况),(各个接口异常组合情况),```
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
```|c：  不在有效类型范围内的其他类型：,大对象|日期型|boolean|raw|rowid|json|xmltype|自定义类型等,col_cnt：  非数值型或者不能隐式转换成数值型的其他类型：,大对象|日期型|raw|rowid|json|xmltype|自定义类型等,desc_t：非内置dbms_sql.desc_tab嵌套表类型，如自定义类型、RECORD、普通标量类型等|
||参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,col_cnt：出参值，校验列的个数正确性,desc_t：出参值，需校验如下描述信息正确性,![](https://pingcode.yasdb.com/atlas/files/public/67396ce98970c2af4f520f10/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBSUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBRUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ1OTUsImV4cCI6MTc4MjMxNTM5NX0.RHqJcYh7U6HPiiDaI4C1V9tS3zrXX-iSr6VCr2jP3zc),col_schema_name：经在oracle环境上测试，当列类型为有toid的自定义类型时，输出所属对象对应schema名称，其他情况下值为空,col_charsetform：为保留字段，值为空,col_charsetid：yasdb实现(普通类型：n类型：，取建库时指定的字符集)|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|返回值类型|使用typeof查询返回值类型正确|/|
|  
|返回值|col_cnt：返回查询语句中列的个数,desc_t：返回列的描述信息,类型映射关系：,![](https://pingcode.yasdb.com/atlas/files/public/67396ce9a1ad9a3311dc8d7e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBSUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBRUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ1OTUsImV4cCI6MTc4MjMxNTM5NX0.RHqJcYh7U6HPiiDaI4C1V9tS3zrXX-iSr6VCr2jP3zc)|/|
|数据规格|/|/|/|
|异常处理|/|参数校验异常：,- 参数缺失或过多
- 变量未提前声明
- 无效的参数值
- 要解析的语句类型为非select查询语句
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行column_value操作|/|
|使用场景|/|1.解析语句类型为select查询语句，包含但不限于如下场景：,- select 表列(表列类型覆盖目前支持的所有标量类型和自定义类型)
- select 表列 as 别名
- select 视图/物化视图
- select 自定义函数
- select 自定义函数 as 别名
- select 表达式操作(内置函数、四则运算等)
- select case shen
- select 子查询
- CTE查询：with table as select
- select 系统表
- select table表函数
- select 递归查询
- select 分区表(select * from tab partiton(partition_name))
,2.出参  desc_t对应子元素值作为其他存储过程、自定义函数、package子过程/子函数的入参值(入参类型为：dbms_sql.desc_rec),3.出参desc_t值用作table表函数的入参--报错，ORA-22905: cannot access rows from a non-nested table it|/|


### 3.2.2单机使用场景：

|分类|使用场景|备注|
|---|---|---|
|应用对象|DBMS_SQL支持结果集函数常用在匿名块、存储过程、自定义函数、自定义package、过程体之间的嵌套调用|  
|
|解析的sql语句类型|普通select语句，包含但不限于单表查询、多表关联查询、子查询等,select语句中可以带有order by、where、limit、not in、not exists、case when、distinct子句等|  
|
|异常处理语句|在调用结果集子函数过程中可能发生的各种异常，包括如下(具体见各子函数异常处理场景)：,- 参数校验异常：通过各子函数无效等价类构造
- 执行时异常：通过系统预定义异常句柄或者others异常来捕获处理
,  
|  
|
|条件选择语句|通常用于判断执行和获取结果集处理，可以调用的子函数有fetch_rows、execute_and fetch、column_value等|  
|
|循环控制语句|通常在循环语句中可以调用的结果集子函数有fetch_rows、column_value等,循环语句有for loop、while loop|  
|
|和其他子函数之间的结合使用|根据DBMS_SQL的执行流来选择使用各个子函数，执行流如下：,1. OPEN_CURSOR
1. PARSE
1. BIND_VARIABLE,BIND_VARIABLE_PKG or BIND ARRAY
1. DEFINE_COLUMN DEFINE_COLUMN_LONG or DEFINE_ARRAY
1. EXECUTE
1. FETCH_ROWS or EXECUTE_AND_FETCH
1. VARIABLE_VALUE,VARIABLE_PKG,COLUMN_VALUE or COLUMN_VALUE_LONG
1. CLOSE_CURSOR
|  
|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,结合表操作|使用动态执行对表操作：,1、执行ddl：drop、truncate，发现oracle有这样的问题：,场景一：在调用execute之后对表执行truncate操作，再执行fetch_rows和其他子函数操作,oracle表现：执行完fetch_rows操作后报错，提示：ORA-08103: object no longer exists,场景二：在调用execute之后对表执行drop操作，再执行fetch_rows和其他子函数操作,(回收站),oracle表现：可以正常执行后续操作，获取数据正确,2、执行dml：insert、update、delete；,打开游标时结果集,- 在调用execute前后执行insert操作，后续检查执行其他子函数执行结果
- 在调用execute前后执行update操作，后续检查执行其他子函数执行结果
- 在调用execute前后执行delete操作，后续检查执行其他子函数执行结果
|场景一：,![](https://conf.yasdb.com/download/attachments/135612369/image2023-11-23_19-33-57.png?version=1&modificationDate=1700739238000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBSUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBRUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ1OTUsImV4cCI6MTc4MjMxNTM5NX0.RHqJcYh7U6HPiiDaI4C1V9tS3zrXX-iSr6VCr2jP3zc),场景二：,![](https://conf.yasdb.com/download/attachments/135612369/image2023-11-23_19-37-50.png?version=1&modificationDate=1700739471000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFnQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBSUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBRUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ1OTUsImV4cCI6MTc4MjMxNTM5NX0.RHqJcYh7U6HPiiDaI4C1V9tS3zrXX-iSr6VCr2jP3zc)|
|并发场景|根据dbms_sql子函数执行流程和使用场景，使用testkill框架并发执行，根据数据库对象分类可以为：,- table的并发：ddl、dml、select、ddl+dml+select组合操作
- plsql过程体对象的并发：ddl、exec、过程体之间的嵌套调用
,table和plsql过程体对象之间的并发使用场景可以参考之前已有的ci用例|  
|


### 3.2.3集群使用场景：

|分类|场景|备注|
|---|---|---|
|实例间串行操作|1、实例1和实例2在调用子函数操作时互不影响；,2、实例1对引用表执行ddl、dml操作，实例2执行调用子函数操作；,3、复用单机使用场景|  
,  
|
|实例间并发操作|根据要解析的sql语句类型和使用场景，使用testkill框架在多个实例间并发执个各子函数操作，列举如下：,1、sql语句类型：,1)、单表普通查询,2)、多表关联查询,3)、结合子查询,4)、select可以带有的子句有order by、where、limit、in(not in)、exists(not exists)、case when等,2、plsql对象：,匿名块、存储过程、自定义函数、自定义package、过程体对象之间的嵌套调用等,3、各子函数之间的组合调用，参考下面执行流：,- OPEN_CURSOR
- PARSE
- BIND_VARIABLE,BIND_VARIABLE_PKG or BIND ARRAY
- DEFINE_COLUMN DEFINE_COLUMN_LONG or DEFINE_ARRAY
- EXECUTE
- FETCH_ROWS or EXECUTE_AND_FETCH
- VARIABLE_VALUE,VARIABLE_PKG,COLUMN_VALUE or COLUMN_VALUE_LONG
- CLOSE_CURSOR
,4、结合表的相关操作ddl、dml|  
|


### 3.2.4HA使用场景

|分类|场景|
|:---|:---|
|主备间数据同步|1、主备节点可以正常调用各子函数执行查询操作，主备获取数据返回结果一致,2、主备节点可以正常调用各子函数执行过程体对象，主备获取数据返回结果一致|
|主备间故障操作|1、备机出现故障时，主机可以继续正常执行DBMS_SQL操作,2、主节点出现故障时，执行failover切换后的新主机可以正常执行DBMS_SQL操作|
|主备间切换操作|主节点执行完DBMS_SQL操作后，执行主备切换(switchover)操作，新主机可以继续执行DBMS_SQL操作|


  


2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


   电子表格

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

## Attachments:

[image2023-11-23_19-25-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTg4OTcwYzJhZjRmNTIwZjBjIiwicmVmX2lkIjoiNjczOTZjZTg3MjgyMDZlZmI5MmYxODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTk0LCJleHAiOjE3ODIzOTA5OTR9.XAgMv8Cbrx_6GbZEWWC6yfIca5RW88Q2q4GsLV808H4)

 (image/png)    


[image2023-11-23_19-33-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZThhMWFkOWEzMzExZGM4ZDdjIiwicmVmX2lkIjoiNjczOTZjZTg3MjgyMDZlZmI5MmYxODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTk1LCJleHAiOjE3ODIzOTA5OTV9.bTZ5DfDKrdKCakpnqHF37at4Py-fuB715nhNf6qZnAk)

 (image/png)    


[image2023-11-23_19-37-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTk4OTcwYzJhZjRmNTIwZjBlIiwicmVmX2lkIjoiNjczOTZjZTg3MjgyMDZlZmI5MmYxODViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTk1LCJleHAiOjE3ODIzOTA5OTV9._UQIZH0DEn0iXa49BEDPhvBkZV0Q259OdzMhdgP6rxA)

 (image/png)    
