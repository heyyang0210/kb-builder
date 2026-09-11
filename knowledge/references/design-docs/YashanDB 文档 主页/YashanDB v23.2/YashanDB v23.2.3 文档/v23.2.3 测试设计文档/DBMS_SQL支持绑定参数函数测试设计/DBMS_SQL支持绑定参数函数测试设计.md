Created by 张江, last modified on 五月 30, 2024

# 1.概述

SR链接：    [YDBRD-22221](https://jira.yasdb.com/browse/YDBRD-22221?src=confmacro)    -  支持绑定参数函数  开发中

本次需求涉及到的DBMS_SQL绑定参数对应子函数为：  DBMS_SQL.  BIND_VARIABLE、DBMS_SQL.BIND_VARIABLE_RAW、DBMS_SQL.VARIABLE_VALUE、BIND_ARRAY

# 2.需求分析

## 2.1功能点分析

1)  DBMS_SQL.  BIND_VARIABLE：根据语句中的绑定参数将指定的列值绑定到游标给定的变量中。语法结构如下：

DBMS_SQL.BIND_VARIABLE (    
      c IN INTEGER,    
      name IN VARCHAR2,    
      value IN <datatype>

);

OR

DBMS_SQL.BIND_VARIABLE (    
      c IN INTEGER,

    name IN VARCHAR2,

    value IN VARCHAR2 CHARACTER SET ANY_CS

    [,out_value_size IN INTEGER]

);

其中c为给定的游标ID；name为绑定参数名称；value为绑定到游标中变量的值；out_value_size为当指定  VARCHAR2、RAW、CHAR类型变量或者IN/OUT模式变量时给定的最大预期字节大小，如果没有给定大小，则使用当前值的长度。如果值参数未初始化，则必须指定此参数。

2)DBMS_SQL.BIND_VARIABLE_RAW：用于将RAW类型数据绑定到游标给定的变量中。语法结构如下：

DBMS_SQL.BIND_VARIABLE_RAW (    
      c IN INTEGER,

    name IN VARCHAR2,

    value IN RAW

    [,out_value_size IN INTEGER]

);

其中c为给定的游标ID；name为绑定参数名称；value为要绑定到游标中变量的RAW类型数据；out_value_size为当指定  VARCHAR2、RAW、CHAR类型变量或者IN/OUT模式变量时给定的最大预期字节大小，如果没有给定大小，则使用当前值的长度。如果值参数未初始化，则必须指定此参数。

3)DBMS_SQL.BIND_ARRAY：  将给定游标语句中绑定参数和对应集合变量进行绑定。语法结构如下：

DBMS_SQL.BIND_ARRAY (

    c IN INTEGER,

    name IN VARCHAR2,

        <table_variable> IN <datatype>

    [,index1 IN INTEGER,

    index2 IN INTEGER)]

);

其中c为给定的游标ID；name为绑定参数名称；table_variable为对应投影列类型的绑定变量名称，index2/index1为元素上下限的索引值。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机、HA和集群环境。

# 3.详细测试设计

## 3.1测试设计方法

主要采用等价类划分、场景法组合进行设计。

## 3.2详细测试设计

### 3.2.1等价类划分

DBMS_SQL.BIND_VARIABLE (c IN INTEGER,name IN VARCHAR2,value IN <datatype>);

DBMS_SQL.BIND_VARIABLE (c IN INTEGER,name IN VARCHAR2,  value IN VARCHAR2 CHARACTER SET ANY_CS [,out_value_size IN INTEGER]  );

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
||参数类型|1、c：,整型：int/integer、,可以兼容的类型：bigint、number、float、double,2、name：字符型名称标识,3、value：,覆盖目前YashanDB支持的标量数据类型，如下：,- 数值型：  TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE
- 字符型：CHAR、VARCHAR
- 日期型：  DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND
- 布尔型：BOOLEAN
- 大对象型：BLOB、CLOB、NCLOB
- 其他类型：ROWID、UROWID、JSON、XMLTYPE
,4、out_value_size：,数值型或者可以隐式转换成整型：tinyint、smallint、int/integer、bigint、number、float、double；|c：  字符型或者不在有效类型范围内的其他类型,name：非字符型,value：YashanDB目前不支持的其他类型(UDT  ),out_value_size：非数值型或者不能隐式转换成数值型的其他类型|
||  
,  
,  
,  
,  
,参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,name：包含前导':'冒号的字符串名称标识,value：定义同绑定参数所在投影列类型的绑定变量名,out_value_size：数值应大于等于实际传入的值对应字节大小|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,name：,- 未带引号
- 未带前导':'
- ?拦截
,value：,- 定义列类型与绑定参数所在投影列类型不一致
- 变量未提前声明
- value值实际占用大小超过目标表字段定义大小(以显示size指定大小，入参小于实际字段大小时截断?)
,out_value_size：,- 非数值型的其他值
- 数值越过int类型的边界值
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|是否有最大绑定参数个数限制32000(绑定参数中varchar、clob大小超过32000时),JDBC绑定参数个数限制：32000|/|
|异常处理|/|主要表现在参数校验过程中出现的异常|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行bind_variable操作|/|
|使用场景|/|- 通常和execute、variable_value等子函数结合使用
- 可以在循环语句、条件控制语句中使用
- 重复绑定以最后一次为准、缺少绑定参数时
|/|


DBMS_SQL.BIND_VARIABLE_RAW (c IN INTEGER,name IN VARCHAR2,  value IN RAW [,out_value_size IN INTEGER]  );

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
||参数类型|1、c：,整型如：int/integer,可以兼容的类型：bigint、number、float、decimal,2、name：字符型名称标识,3、value：RAW类型,4、out_value_size：,数值型或者可以隐式转换成整型：tinyint、smallint、int/integer、bigint、number、float、decimal；|c：  字符型或者不在有效类型范围内的其他类型,name：非字符型,value：非RAW类型,out_value_size：非数值型或者不能隐式转换成数值型的其他类型|
||  
,  
,  
,  
,  
,参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,name：包含前导':'冒号的字符串名称标识,value：,定义同绑定参数所在投影列类型的绑定变量名,blob类型数据是否可以合raw类型数据转换,out_value_size：数值应大于等于实际传入的值对应字节大小|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,name：,- 非字符型名称如数字
- 未带引号
- 未带前导':'
- 长度>42bytes
,value：,- 定义列的绑定变量为非RAW类型
- 变量未提前声明
- 输入的数据非十六进制
- 输入字符串类型数据的字节长度超过RAW列宽度的2倍时
,out_value_size：,- 非数值型的其他值
- 数值越过int类型的边界值
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|是否有最大绑定参数个数限制？|/|
|异常处理|/|主要表现在参数校验过程中出现的异常|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行bind_variable操作|/|
|使用场景|/|- 用于绑定RAW类型的列数据
- 通常和execute、variable_value等子函数结合使用
- 可以在循环语句、条件控制语句中使用
|/|


DBMS_SQL.VARIABLE_VALUE(   c   IN     INTEGER  ,   name     IN   VARCHAR2,   value     OUT   NOCOPY <datatype>);

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
||参数类型|1、c：,整型：int/integer、,可以兼容的类型：bigint、number、float、decimal,2、name：字符型名称标识,3、value：,覆盖目前YashanDB支持的标量数据类型，如下：,- 数值型：  TINYINT、SMALLINT、INT/INTEGER、BIGINT、NUMBER、FLOAT、DOUBLE
- 字符型：CHAR、VARCHAR
- 日期型：  DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND
- 布尔型：BOOLEAN
- 大对象型：BLOB、CLOB
- 其他类型：ROWID、UROWID、JSON、(XMLTYPE?)
|c：  字符型或者不在有效类型范围内的其他类型,name：非字符型,value：YashanDB目前不支持的其他类型(udt  )|
||  
,  
,  
,  
,  
,参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,name：字符串名称标识，可以不包含前导':',value：出参类型与bind_variable定义类型一致或者可以隐式转换,  
,  
|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,name：,- 非法的标识符如_1、%a等(待确认)
- 未带引号
,value：,- 定义列类型与绑定参数所在投影列类型不一致
- 变量未提前声明
- value值实际占用大小超过出参变量定义大小时报错
,  
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|/|/|
|异常处理|/|1、参数校验异常,2、异常句柄捕获处理,- 通过others去捕获异常处理
- 通过dbms_sql内置系统异常去捕获处理，内置系统异常为：dbms_sql.inconsistent_type
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行variable_value操作|/|
|使用场景|/|- 通常和execute、bind_variable等子函数结合使用
- 可以在循环语句、条件控制语句中使用
- 出参变量用于其他场景自定义函数返回值、变量赋值运算等
|/|


DBMS_SQL.BIND_ARRAY (  c IN INTEGER,  name IN VARCHAR2,  <table_variable> IN <datatype>  [,index1 IN INTEGER,  index2 IN INTEGER)]  );

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
,参数校验|参数个数|3或者5|参数个数不为3或者不为5|
||参数类型|1、c：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、varchar/nvarchar、char/nchar,2、name：合法的字符型名称标识,3、  table_variable  ：,本次要实现的dbms_sql.内置table类型及其可以绑定的子类型对应如下：,4、index1..index2,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、float、double、varchar/nvarchar、char/nchar|c：  不在有效类型范围内的其他类型,大对象|日期型|boolean|raw|rowid|json|xmltype|自定义类型等,name：非字符型、非法的名称,table_variable  ：非dbms_sql.内置table类型，普通标量类型、自定义类型,index1..index2：不能和整型隐式转换的其他类型,大对象|日期型|  raw|rowid|json|xmltype|自定义类型等|
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
|  
,  
,  
,  
,  
,参数值|c：  正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,name：字符串名称标识，可以不包含前导':',table_variable  ：为dbms_sql内置嵌套表类型，其绑定的子类型可以与select列表中列类型匹配或者隐式转换,index1..index2：可以是负数、0、正数，index1<=index2,  
,  
|c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,name：,- 非法的标识符如@&等(待确认)
- 未带引号
,table_variable  ：,- 非嵌套表类型并且其基础类型与实际表字段类型不匹配(未做校验)
- 变量未提前声明
- 自定义类型
- 普通标量类型
,index1..index2：,- 非整型数据如字符串、中英文等
- 特殊值：空串''、NULL值、'NULL'
- 超过int类型边界值
- index1>index2
- 索引值对应元素不存在(ORA-29252: collection does not contain elements at index locations in call to    
  dbms_sql.bind_array)
,  
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|/|/|/|
|异常处理|/|参数校验异常：,- 参数缺失
- 参数过多
- 绑定变量未提前声明
- 绑定变量名称有误
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行variable_value操作|/|
|使用场景|/|1.和bind_variable、define_column、execute、fetch_rows、column_value等子过程结合使用,2.在循环语句、条件控制语句中使用,3.解析语句类型为select语句时：,- 绑定投影列
- 用作where条件
- 作为in/not int条件的参数传递给查询语句(验证oracle19c、23c，当绑定数组包含多行数据时，返回结果为绑定数组的最后一条数据)
- 用作table表函数的入参(oracle执行时报错，ORA-22905: cannot access rows from a non-nested table item)(只绑定最后一条数据，不是整个table类型)--异常处理
- 处理动态生成查询，用作条件参数
- 匿名块中等值赋值(oracle执行时报错， expression is of wrong type)--异常处理
,4.解析语句类型为dml语句时：,insert/update/delete/merge into：,- 作为insert value值
- 作为set value值
- 用作where条件
,insert into select xxx：,- 作为列绑定参数
- where条件
,5.通过variable_value取值，未取到值|/|


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


### 3.2.2单机使用场景：

|分类|使用场景|备注|
|:---|:---|:---|
|应用对象|DBMS_SQL绑定参数函数常用在匿名块、存储过程、自定义函数、自定义package、过程体之间的嵌套调用|  
|
|解析的sql语句类型|1、DQL语句：,普通select语句，包含但不限于单表查询、多表关联查询、子查询等,select语句中可以带有order by、where、limit、not in、not exists、case when、distinct子句等,2、DML语句包含但不限于insert、insert into select、update、delete,3、RETURNING子句：包含insert  returning语句(delete returning、update returning暂不支持),4、过程体对象：匿名块、存储过程、自定义函数、自定义package、过程体之间的嵌套调用|  
|
|异常处理语句|在调用绑定参数子函数过程中可能发生的各种异常，包括如下(具体见各子函数异常处理场景)：,- 参数校验异常：通过各子函数无效等价类构造
- 执行时异常：通过dbms_sql内置异常句柄或者others异常来捕获处理
,  
|  
|
|条件选择语句|通常和其他子函数一起判断执行和获取结果集处理时，可以调用的子函数有bind_variable、variable_value等|  
|
|循环控制语句|通常和其他子函数一起在循环语句中使用，可以调用的绑定参数子函数有bind_variable、variable_value等,循环语句有for loop、while loop|  
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
|结合表操作|在执行调用子函数过程中可以对表进行如下操作：,1、执行ddl操作：drop、truncate,2、执行dml操作：可以在execute、variable_value等前后执行insert、update、delete操作|  
|
|并发场景|根据dbms_sql子函数执行流程和使用场景，使用testkill框架并发执行，根据数据库对象分类可以为：,- table的并发：ddl、dml、select、ddl+dml+select组合操作
- plsql过程体对象的并发：ddl、exec、过程体之间的嵌套调用
,table和plsql过程体对象之间的并发使用场景可以参考之前已有的ci用例|  
|


### 3.2.3集群使用场景

|分类|场景|
|---|---|
|实例间串行操作|可复用单机部分场景，主要针对语句类型是dml、returning子句和过程体之间对象语句|
|实例间并发操作|根据dbms_sql子函数执行流程和使用场景，使用testkill框架并发执行，根据数据库对象分类可以为：,- table的并发：ddl、dml、select、ddl+dml+select组合操作
- plsql过程体对象的并发：ddl、exec、过程体之间的嵌套调用
,table和plsql过程体对象之间的并发使用场景可以参考之前已有的ci用例|


### 3.2.4HA使用场景

|分类|场景|
|:---|:---|
|  
,  
,  
,主备间数据同步|1、DML+RETURNING操作,主节点调用DBMS_SQL.EXECUTE函数可以正常执行DML操作，备节点调用DBMS_SQL.EXECUTE时则报错,可以正常调用OPEN_CURSOR、PARSE、IS_OPEN、CLOSE_CURSOR子函数操作,需检查数据已同步至备节点,2、DQL,主备节点可以正常调用各子函数执行查询操作，返回数据结果一致,3、PLSQL过程体对象调用,主备节点可以正常调用各子函数执行过程体对象，遵循主读写备只读机制|
|主备间故障操作|1、备机出现故障时，主机可以继续正常执行DBMS_SQL操作,2、主节点出现故障时，执行failover切换后的新主机可以正常执行DBMS_SQL操作|
|主备间切换操作|主节点执行完DBMS_SQL操作后，执行主备切换(switchover)操作，新主机可以继续执行DBMS_SQL操作|


2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
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

*bind_variable和*