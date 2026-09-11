

# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670de7ace489dd0868f7a133?](https://pingcode.yasdb.com/pjm/items/670de7ace489dd0868f7a133?)  

#YDBRD-34185 【mysql兼容】兼容与MYSQL同名的控制函数规格

case,if,ifnull,nullif与mysql同名函数兼容

# 2.控制函数介绍

参考：  [https://dev.mysql.com/doc/refman/9.1/en/flow-control-functions.html#function_if](https://dev.mysql.com/doc/refman/9.1/en/flow-control-functions.html#function_if)  

|控制函数|mysql|yashan|
|---|---|---|
|CASE|CASE value WHEN compare_value THEN result [WHEN compare_value THEN result ...] [ELSE result] END,CASE WHEN condition THEN result [WHEN condition THEN result ...] [ELSE result] END,If all types are numeric, the aggregated type is also numeric:,If at least one argument is double precision, the result is double precision.,Otherwise, if at least one argument is DECIMAL, the result is DECIMAL.,Otherwise, the result is an integer type (with one exception):,If all integer types are all signed or all unsigned, the result is the same sign and the precision is the highest of all specified integer types (that is, TINYINT, SMALLINT, MEDIUMINT, INT, or BIGINT).,If there is a combination of signed and unsigned integer types, the result is signed and the precision may be higher. For example, if the types are signed INT and unsigned INT, the result is signed BIGINT.,The exception is unsigned BIGINT combined with any signed integer type. The result is DECIMAL with sufficient precision and scale 0.,If all types are BIT, the result is BIT. Otherwise, BIT arguments are treated similar to BIGINT.,If all types are YEAR, the result is YEAR. Otherwise, YEAR arguments are treated similar to INT.,If all types are character string (CHAR or VARCHAR), the result is VARCHAR with maximum length determined by the longest character length of the operands.,If all types are character or binary string, the result is VARBINARY.,SET and ENUM are treated similar to VARCHAR; the result is VARCHAR.,If all types are JSON, the result is JSON.,If all types are temporal, the result is temporal:,If all temporal types are DATE, TIME, or TIMESTAMP, the result is DATE, TIME, or TIMESTAMP, respectively.,Otherwise, for a mix of temporal types, the result is DATETIME.,If all types are GEOMETRY, the result is GEOMETRY.,If any type is BLOB, the result is BLOB.,For all other type combinations, the result is VARCHAR.,Literal NULL operands are ignored for type aggregation.          ,```
mysql> SELECT CASE 1 WHEN 1 THEN 'one'
    ->     WHEN 2 THEN 'two' ELSE 'more' END;
        -> 'one'
mysql> SELECT CASE WHEN 1>0 THEN 'true' ELSE 'false' END;
        -> 'true'
mysql> SELECT CASE BINARY 'B'
    ->     WHEN 'a' THEN 1 WHEN 'b' THEN 2 END;
        -> NULL
```|- *CASE selector*    
  *WHEN selector_value_1 THEN statements_1*    
  *WHEN selector_value_2 THEN statements_2*    
  *...*    
  *WHEN selector_value_n THEN statements_n*    
_[ ELSE _  *else_statements ]*    
  *END CASE;*
- 其中，selector、selector_value_1 、selector_value_2、...、selector_value_n为表达式形式。
- 
- *CASE*    
  *WHEN condition_1 THEN statements_1*    
  *WHEN condition_2 THEN statements_2*    
  *...*    
  *WHEN condition_n THEN statements_n*    
_[ ELSE _  *else_statements ]*    
  *END CASE;*
- 其中，condition_1 、condition_2、...、condition_n为能产生布尔值结果的条件表达式。
- 
|
|IF(expr1,expr2,expr3)|If expr1 is TRUE (expr1 <> 0 and expr1 IS NOT NULL), IF() returns expr2. Otherwise, it returns expr3.,If only one of expr2 or expr3 is explicitly NULL, the result type of the IF() function is the type of the non-NULL expression.,The default return type of IF() (which may matter when it is stored into a temporary table) is calculated as follows:,If expr2 or expr3 produce a string, the result is a string.,If expr2 and expr3 are both strings,   the result is case-sensitive if either string is case-sensitive.,If expr2 or expr3 produce a floating-point value, the result is a floating-point value.,If expr2 or expr3 produce an integer, the result is an integer.,```
mysql> SELECT IF(1>2,2,3);
        -> 3
mysql> SELECT IF(1<2,'yes','no');
        -> 'yes'
mysql> SELECT IF(STRCMP('test','test1'),'no','yes');
        -> 'no'
```|,IF函数有3个  [expr](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  参数，若expr1为TRUE，返回expr2，若expr1为FALSE，返回expr3。,expr1的值可以为任意数据类型，为NULL时视为FALSE，若不为NULL：,- 对于数值类型或可隐式转换为数值类型的其他类型，其值为非0时，视为TRUE，其值为0时，视为FALSE；
- 对于不可隐式转换为数值类型的类型，视为FALSE；
- 对于BOOLEAN类型和BOOLEAN表达式，按其真假处理。
,expr2，expr3的值可以为任意数据类型。当expr2和expr3数据类型不相同时，函数将先进行隐式类型转换再返回结果，转换规则与  [IFNULL](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/IFNULL)  中规则一致。,需注意，本函数如下规格与MySQL中的IF函数存在差异：,- 当expr2和expr3均为BIT类型时，YashanDB返回BIT类型，MySQL返回INT/BIGINT UNSIGNED类型；
- 当epxr2和epxr3为BOOLEAN、TINYINT或SMALLINT类型时，YashanDB按照BOOLEAN<TINYINT<SMALLINT的优先级进行类型转换，MySQL全部返回INT类型；
|
|IFNULL(expr1,expr2)|If expr1 is not NULL, IFNULL() returns expr1; otherwise it returns expr2.,The default return type of IFNULL(expr1,expr2) is the more “general” of the two expressions, in the order STRING, REAL, or INTEGER. Consider the case of a table based on expressions or where MySQL must internally store a value returned by IFNULL() in a temporary table:,```
mysql> CREATE TABLE tmp SELECT IFNULL(1,'test') AS test;
mysql> DESCRIBE tmp;
+-------+--------------+------+-----+---------+-------+
| Field | Type         | Null | Key | Default | Extra |
+-------+--------------+------+-----+---------+-------+
| test  | varbinary(4) | NO   |     |         |       |
+-------+--------------+------+-----+---------+-------+
```|IFNULL函数有2个  [expr](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  参数，当expr1不为NULL时返回expr1，否则返回expr2。,expr1，expr2的值可以为任意数据类型。当expr1和expr2的数据类型相同时，函数返回此数据类型的值。,当expr1，expr2其中之一为RAW、JSON、CLOB、BLOB、NCLOB类型时，不允许与其它类型搭配使用，两个参数必须类型相同，否则函数返回错误，函数返回值类型同expr数据类型。,当expr1，expr2其中之一为XMLTYPE时，expr1和expr2的数据类型必须相同，否则函数返回错误，函数返回值类型为XMLTYPE类型。,若expr1和expr2的数据类型不相同，函数将先进行隐式类型转换后再返回结果，基本规则如下：,- expr1与expr2分属如下不同大类组时，函数返回VARCHAR类型：
- 数值型
- 日期时间型
- 字符型
- ROWID
- expr1与expr2其中之一为布尔型时：
    - 另一方属于非数值型的其他大类时，函数返回VARCHAR类型。
    - 另一方属于数值型（除BIT外）时，函数返回对应的数值类型。
- 另一方为BIT类型时，函数返回BIGINT类型。
- expr1与expr2均属于字符型时，函数返回VARCHAR类型。
|
|NULLIF(expr1,expr2)|Returns NULL if expr1 = expr2 is true, otherwise returns expr1. This is the same as CASE WHEN expr1 = expr2 THEN NULL ELSE expr1 END.,The return value has the same type as the first argument.,```
mysql> SELECT NULLIF(1,1);
        -> NULL
mysql> SELECT NULLIF(1,2);
        -> 1
```|NULLIF函数用于对两个参数的值进行比较，相等时返回NULL，不相等时返回expr1的值。本函数常用于防止程序中因为出现除以零错误而抛出异常。,expr1和expr2均为YashanDB认可的  [通用表达式](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  ，且存在如下约束：,- expr1不能为NULL，否则函数返回错误。
- expr1和expr2均不能为LOB类型及XMLTYPE类型，否则函数返回错误。
- expr2可以为NULL，此时函数返回expr1的值。
,本函数根据以下规则确定返回结果的数据类型：,- expr1和expr2均为数值型时，函数将会确定其中具有最高精度的数据类型，并将计算结果转为该类型返回。
- expr1和expr2均为字符型时，函数返回值类型为expr1的类型。
    - CHAR、VARCHAR与NCHAR、NVARCHAR不可以混合运算，否则函数返回错误。
- expr1和expr2中有一个是DATE类型，另一个是TIMESTAMP类型时，函数返回TIMESTAMP类型。
- expr1与expr2类型为除上述外的其他情况，且两者类型相同时，函数返回相同的数据类型；类型不同，且无法按照一定的规则进行转换时，函数返回类型转换错误。
|


# 4.使用场景

plsql控制语句使用

# 5.测试关注

1.入参类型与转换规则

2.返回类型兼容