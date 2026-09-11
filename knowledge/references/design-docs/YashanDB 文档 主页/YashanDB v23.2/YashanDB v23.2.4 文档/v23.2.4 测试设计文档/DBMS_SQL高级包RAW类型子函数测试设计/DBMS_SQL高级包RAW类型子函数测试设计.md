Created by 张江, last modified on 七月 11, 2024

# 1.概述

SR链接：    [https://pingcode.yasdb.com/pjm/items/662667e1fd997db58adf293b](https://pingcode.yasdb.com/pjm/items/662667e1fd997db58adf293b)    ?#YDBRD-26591 新增DBMS_SQL系统包RAW类型子函数

本次需求涉及到的RAW类型子函数有：

DBMS_SQL.BIND_VARIABLE_RAW(已转)

DBMS_SQL.VARIABLE_VALUE_RAW

DBMS_SQL.DEFINE_COLUMN_RAW

DBMS_SQL.COLUMN_VALUE_RAW

# 2.需求分析

# 2.1功能点分析

1)  DBMS_SQL.BIND_VARIABLE_RAW：根据游标中给定语句中的绑定参数名称将RAW类型值绑定到绑定变量中。语法结构如下：

DBMS_SQL.BIND_VARIABLE_RAW (

    c IN INTEGER,

    name IN VARCHAR2,

    value IN RAW [,

    out_value_size IN INTEGER]

);其中c为给定的游标ID，name为绑定参数名称，value为要绑定RAW类型值对应的绑定变量名称，out_value_size参数可选，指定RAW类型变量给定的最大预期字节大小(以字节为单位)。

2)DBMS_SQL.VARIABLE_VALUE_RAW：用于返回给定游标中绑定RAW类型变量的值，通常用于包含PLSQL语句中绑定变量值或者带有return子句的DML语句。语法结构如下：

DBMS_SQL.VARIABLE_VALUE_RAW (

    c IN INTEGER,

    name IN VARCHAR2,

    value OUT RAW

);其中c为给定的游标ID，name为绑定参数名称，value为指定绑定参数对应的绑定变量值。

3)  DBMS_SQL.DEFINE_COLUMN_RAW：用于定义给定游标中已选择RAW类型数据的列，定义的列由给定游标语句中的select列的相对位置进行标识，只能用于select类型游标。语法结构如下：

DBMS_SQL.DEFINE_COLUMN_RAW (

    c IN INTEGER,

    position IN INTEGER,

    column IN RAW,

    column_size IN INTEGER

);  其中c为给定的游标ID，position为投影列位置，第一列位置为1，column为投影列对应变量名称，column_size为指定raw类型的最大预期大小(以字节为单位)。

4)  DBMS_SQL.COLUMN_VALUE_RAW：用于返回给定游标中指定位置的游标结果集，此过程通常用于访问调用FETCH_ROWS后获取的数据。语法结构如下：

DBMS_SQL.COLUMN_VALUE_RAW (

    c IN INTEGER,

    position IN INTEGER,

    value OUT RAW

    [,  column_error OUT NUMBER]

    [,actual_length OUT INTEGER]

);  其中c为给定的游标ID，position为投影列位置，第一列位置为1，value为投影列对应出参变量值，column_error参数可选，为指定列值的错误代码，actual_length参数可选，为列在截断之前的实际长度。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机、集群和分布式环境。

# 3.详细测试设计

## 3.1测试设计方法

主要采用等价类划分、场景法组合进行设计。

## 3.2详细测试设计

### 3.2.1等价类划分

DBMS_SQL.BIND_VARIABLE_RAW (  c IN INTEGER,  name IN VARCHAR2,  value IN RAW  [,out_value_size IN INTEGER])

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
,  
,参数校验|参数个数|可以是3或者4个|参数个数小于3或大于4个|
||参数类型|1、c：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、nchar、varchar、nvarchar,2、name：字符型名称标识,3、value：,可以和raw类型隐式转换的标量数据类型，如下：,- 字符型：CHAR、VARCHAR、NCHAR、NVARCHAR
- 大对象型：BLOB
- 其他类型：ROWID、UROWID、JSON
,4、out_value_size：,数值型或者可以隐式转换成整型的类型：tinyint、smallint、int/integer、bigint、number、float、double、char、varchar、nchar、nvarchar；|c：  不在有效类型范围内的其他类型：,clob、nclob、blob、date、time、timestamp、interval year to month、interval day to second、raw、rowid、json、xmltype、udt,name：非字符型名称,value：非raw或者不能和raw隐式转换的标量类型；,非标量类型：udt、gis、dbms_sql内置嵌套表类型,out_value_size：非数值型或者不能隐式转换成数值型的其他类型|
||  
,  
,  
,  
,  
,参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,name：包含前导':'冒号的字符串名称标识，可以是数字、英文、数字+英文、特殊字符开头,value：定义同绑定参数类型一致或者可以隐式转换的绑定变量名称,out_value_size：数值可以不指定，默认为绑定变量定义大小；大于等于实际传入的值对应字节大小，小于实际长度时则会截断,  
,raw类型上限值补充超过8000bytes的数据|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,name：,- 未带引号
- 未带前导':'
- ?拦截
- 其他非法的绑定参数名称如:"bind1"等
,value：,- 定义投影列类型为非raw类型
- 变量未提前声明
- 输入的数据非十六进制
- 输入字符串类型数据的字节长度超过RAW列宽度的2倍时
- value值实际占用大小超过目标表字段定义大小，执行execute时会报长度过大错误
,out_value_size：,- 非数值型的其他值
- 数值越过int类型的边界值
- 负数
- 上限值为8000
|
||参数名|- 使用位置参数传值验证
- 使用关键字参数传值验证，校验参数名称正确性
|/|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|验证多个绑定参数(如512、1024)绑定插入到表中场景|/|
|异常处理|/|编译阶段异常：,- 参数缺失或过多
- 绑定参数类型不匹配
,执行阶段异常：,- 执行dml操作时，value值类型与目标表字段类型不匹配
- 执行dml操作时，value值实际占用大小超过目标表字段定义大小
- 匿名块赋值操作时，绑定命令未初始化时(作为等号右边赋值目标)--numeric or value error: character string buffer too small
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行bind_variable_raw操作|/|


DBMS_SQL.VARIABLE_VALUE_RAW(c IN INTEGER,name IN VARCHAR2,value OUT RAW);

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
,  
,参数校验|参数个数|3个|参数个数不为3|
||参数类型|1、c：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、nchar、varchar、nvarchar,2、name：字符型名称标识,3、value：,可以和raw类型隐式转换的标量数据类型，如下：,- 字符型：CHAR、VARCHAR、NCHAR、NVARCHAR
- 大对象型：BLOB
- 其他类型：ROWID、UROWID、JSON
|c：  不在有效类型范围内的其他类型：,clob、nclob、blob、date、time、timestamp、interval year to month、interval day to second、raw、rowid、json、xmltype、udt,name：非字符型名称,value：  非raw或者不能和raw隐式转换的标量类型；,非标量类型：udt、gis、dbms_sql内置嵌套表类型|
||  
,  
,  
,  
,  
,参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,name：字符串名称标识，可以不包含前导':'，可以是数字、英文、数字+英文、特殊字符开头,value：出参类型与bind_variable_raw定义类型一致或者可以隐式转换|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,name：,- 未带引号
- 未带前导':'
- ?拦截
- 其他非法的绑定参数名称如:"bind1"等
,value：,- 出参类型与绑定参数类型不一致
- 出参变量未提前声明
- value值实际占用大小超过定义出参变量大小
|
||参数名|- 使用位置参数传值验证
- 使用关键字参数传值验证，校验参数名称正确性
|/|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|验证多个绑定参数(如512、1024)绑定插入到表中场景|/|
|异常处理|/|编译阶段异常：,- 参数缺失或过多
- 出参类型为非raw或者不能和raw隐式转换的类型
,执行阶段异常：,- 未调用bind_variable_raw子过程
- 出参类型和绑定参数类型不匹配
- 可以通过内置系统预定义异常(dbms_sql.inconsistent_type)去捕获
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行variable_value_raw操作|/|


DBMS_SQL.DEFINE_COLUMN_RAW  (c IN INTEGER,position IN INTEGER,column IN RAW,column_size IN INTEGER);

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
,  
,参数校验|参数个数|可以是3或者4个|参数个数不为3|
||参数类型|1、c：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、nchar、varchar、nvarchar,2、  position：,整型：int/integer；,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、varchar、nchar、nvarchar,3、column：,可以和raw类型隐式转换的标量数据类型，如下：,- 字符型：CHAR、VARCHAR、NCHAR、NVARCHAR
- 大对象型：BLOB
- 其他类型：ROWID、UROWID、JSON
,4、column_size ,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、varchar、nchar、nvarchar|c：  不在有效类型范围内的其他类型：,clob、nclob、blob、date、time、timestamp、interval year to month、interval day to second、raw、rowid、json、xmltype、udt,position：非数值型或者不能隐式转换成数值型的其他类型,column：  非raw或者不能和raw隐式转换的标量类型；,非标量类型：udt、gis、dbms_sql内置嵌套表类型,column_size：非数值型或者不能隐式转换成数值型的其他类型|
||  
,  
,  
,  
,  
,参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,position：从1开始的有效正数，与解析语句中select列表项所在位置对应,column：定义与投影列对应的raw类型合法变量,column_size：一般应与select列表中定义列大小一致，最大值应小于等于字符串类型存储的最大长度(32000)；,指定大小小于实际长度时会发生数据截断|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,position  ：,- 负数、0或者值大于select列表项个数
- 非数值型的其他值
- null、空串''
,column：,- 变量未提前声明
- 非raw类型或者不能和raw类型隐式转换的类型变量
- 变量名称错误
,column_size：,- 负数
- 数值越过类型存储的最大长度(上限为8000)
- 非数值型的其他值
- 值缺失
|
||参数名|- 使用位置参数传值验证
- 使用关键字参数传值验证，校验参数名称正确性
|  
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|/|/|
|异常处理|/|编译阶段异常：,- 参数缺失或过多
- 变量类型为非raw或者不能和raw隐式转换的类型
,执行阶段异常：,- column_size输入无效值时执行异常
- 不能同时调用  define_column_raw和define_array子过程
- 通过系统预定义异常捕获处理
|  
|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行variable_value_char操作|/|


DBMS_SQL.COLUMN_VALUE_RAW (c IN INTEGER,position IN INTEGER,value OUT RAW[,column_error OUT NUMBER][,actual_length OUT INTEGER]);

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
,参数校验|参数个数|可以是3或者5|参数个数不为3或者5|
||参数类型|1、c：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、nchar、varchar、nvarchar,2、position：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、varchar、nchar、nvarchar,3、  value：,可以和raw类型隐式转换的标量数据类型，如下：,- 字符型：CHAR、VARCHAR、NCHAR、NVARCHAR
- 大对象型：BLOB
- 其他类型：ROWID、UROWID、JSON
,4、  column_error：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、nchar、varchar、nvarchar,5、actual_length：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、char、nchar、varchar、nvarchar|c：  不在有效类型范围内的其他类型：,clob、nclob、blob、date、time、timestamp、interval year to month、interval day to second、raw、rowid、json、xmltype、u,position：  非数值型或者不能隐式转换成数值型的其他类型,value：  非raw或者不能和raw隐式转换的标量类型；,非标量类型：udt、gis、dbms_sql内置嵌套表类型,column_error、actual_length：非数值型或者不能隐式转换成数值型的其他类型|
||参数值|c：正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,position：为从1开始的有效正数，与解析语句中select列表项所在位置对应,value：与define_column_raw中定义类型一致或可以隐式转换,column_error、actual_length：为出参变量，需验证值是否正确,column_error=0，actual_length=列存储数据占用的实际大小|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,position：,- 负数、0或者值大于select列项个数
- 非数值型的其他值
,value：,- 变量未提前声明
- 出参变量类型与define_column_raw定义类型不一致，且不能隐式转换
- 变量名称错误
,column_erro、actual_length：,获取column_error、actual_length对应输出值时，必须要一起出现，否则报错|
||参数名|- 使用位置参数传值验证
- 使用关键字参数传值验证，校验参数名称正确性
|  
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|/|/|
|异常处理|/|编译阶段异常：,- 参数缺失或过多
- 出参变量类型与  define_column_raw定义类型不一致，且不能隐式转换
,执行阶段异常：,- 投影列数据大小超过出参变量定义大小
- 定义和出参类型不匹配时：  调用define_column/define_column_raw过程定义投影列类型与出参变量类型不一致且不能隐式转换时，可以通过dbms_sql.inconsistent_type内置异常捕获
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行column_value_raw操作|/|


### 3.2.2使用场景

|分类|使用场景|备注|
|:---|:---|:---|
|  
,  
,DBMS_SQL.BIND_VARIABLE_RAW|- 在SELECT语句中使用
- 过程体赋值操作
- 过程体对象调用中使用
- 打开动态游标语句中使用
- returning子句中使用(报错拦截)
- 自定义/内置函数中使用
- 在cte语句中使用
- 在dml语句中使用(insert/insert all、update、delete、merge into)
- 结合index by子句(绑定key,value，绑定参数是用key获取value形式)
|  
|
|  
,DBMS_SQL.  VARIABLE_VALUE_  RAW|- 出参变量用作存储过程/自定义函数入参和返回值
- 出参变量用作嵌套子过程/子函数入参和返回值
- 出参变量参与赋值运算
- 在控制语句中使用
- 调用bind_variable子过程绑定raw类型数据，调用variable_value_raw能正确获取绑定变量出参值
|  
|
|  
,  
,  
,  
,DBMS_SQL.DEFINE_COLUMN_  RAW|解析语句类型为select语句时，可以定义如下的投影列作为绑定变量，包含但不限于：,- select 表列
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
|可以通过调用column_value子过程正确获取出参值|
|DBMS_SQL.COLUMN_VALUE_  RAW|- 和DBMS_SQL其他子过程结合使用
- 出参变量值用于回写表操作
- 出参变量值用作存储过程、自定义函数出入参
- 出参变量值用作嵌套子过程/子函数出入参
- 在控制语句中使用
|  
|
|使用对象|匿名块、存储过程、自定义函数、自定义package及其嵌套子过程/子函数|  
|
|动态执行|在动态sql中执行调用子过程|  
|
|  
,  
,结合表操作|DBMS_SQL绑定参数子函数调用过程前后执行DDL操作|  
|
||DBMS_SQL绑定参数子函数调用过程前后执行DML操作|  
|
||DBMS_SQL支持结果集和描述信息子函数调用前后执行DDL操作|  
|
||DBMS_SQL支持结果集和描述信息子函数调用前后执行DML操作|  
|
|结合DBMS_SQL其他子过程/子函数|  
|  
|
|参考DBMS_SQL历史场景测试点|  
|  
|


## 3.3DFX测试

梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|DFR|否|
|HA|否|
|KT|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|压力|否|
|可维护性|否|
|安全|否|
|性能|否|
|长稳|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*