Created by 王仁松, last modified on 十月 31, 2023

  [YDBRD-1037](https://jira.yasdb.com/browse/YDBRD-1037?src=confmacro)    -  分布式上支持列表 集合操作  完成

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/subquery.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3NzcsImV4cCI6MTc4MjMxMTU3N30.UH5Rv4MVpjdgmeY2s0bk-gCRm4VwExhC8zJajQjyPzY)

  [Set Operators](/pages/createpage.action?spaceKey=YAS&title=Set+Operators)  

# 1. Overview（概述）

1. 原单机列存已支持支持集合操作：  union, union all, intersect, intersect all, minus, minus all。
1. 现分布式场景下列存也要支持对应集合操作。


# 2. Features（功能特性）

1. 分布式列存  支持集合操作：  union, union all, intersect, intersect all, minus, minus all。
1. union，intersect, minus做去重；union all, intersect all, minus all 不做去重。
1. 新增except（all）关键字，效果等同于minus（all）。


# 3. Interfaces（接口）

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

# 4. Specification And Constraints（规格与约束）

1. 集合操作都拉到cn上进行


# 5. Detail Design（详细设计）

```
intersect, intersect all

需求描述：

intersect操作求2个查询的交集，并去除重复项，intersect all则返回全部交集，不去重。



需求规格：

1、子查询列表中的相应表达式必须在数量上匹配，并且必须在相同的数据类型组中

2、返回数据类型：

1）如果两个查询都选择相同长度的数据类型 CHAR 的值，则返回的值具有该长度的数据类型 CHAR。如果查询选择不同长度的 CHAR 值，则返回值是 VARCHAR2，其长度为较大的 CHAR 值。

2）如果其中一个或两个查询选择数据类型为 VARCHAR2 的值，则返回值的数据类型为 VARCHAR2。

3）如果两边都是数值数据类型，返回数据类型为优先级最高的数据类型，优先级如下

double>float>number>bigint>init>smallint>tinyint

4）如果两边都是时间类型，仅支持同数据类型的集合操作，比如date和timestamp不能做集合操作

3、做交集操作时不允许隐式转换，如两个子查询数据列的数据类型不同则报错





except, except all和minus，minus all

需求描述：

except和minus操作求2个查询的差集，返回左边结果集不在右边结果集部分，并去重。except all和minus all的结果集不去重。这两个操作结果集跟子查询的前后顺序有关。



需求规格：

1、子查询列表中的相应表达式必须在数量上匹配，并且必须在相同的数据类型组中

2、返回数据类型：

1）如果两个查询都选择相同长度的数据类型 CHAR 的值，则返回的值具有该长度的数据类型 CHAR。如果查询选择不同长度的 CHAR 值，则返回值是 VARCHAR2，其长度为较大的 CHAR 值。

2）如果其中一个或两个查询选择数据类型为 VARCHAR2 的值，则返回值的数据类型为 VARCHAR2。

3）如果两边都是数值数据类型，返回数据类型为优先级最高的数据类型，优先级如下

double>float>number>bigint>init>smallint>tinyint

4）如果两边都是时间类型，仅支持同数据类型的集合操作，比如date和timestamp不能做集合操作

3、做交集操作时不允许隐式转换，如两个子查询数据列的数据类型不同则报错
```

  


![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/subquery.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3NzcsImV4cCI6MTc4MjMxMTU3N30.UH5Rv4MVpjdgmeY2s0bk-gCRm4VwExhC8zJajQjyPzY)

  


所有集合操作都是二目运算：共有3种集合运算：[UNION | INTERSECT | MINUS]；

6种集合操作：[UNION | UNION ALL | INTERSECT | INTERSECT ALL| MINUS | MINUS ALL]。

### Union，Union All

union做两个集合的并集，即对左右两个运算的结果做并操作，并去除并操作之后的重复的结果。

union all对于操作结果不做去重。

### Intersect，Intersect All

Intersect做两个集合的交集，即对左右两个运算的结果做取相同记录的操作，并去除重复结果。

interscet all对于操作结果不做去重。

### Minus，Minus All

minus做两个集合的差集，即对左右两个运算的结果做差运算，返回出现在第一个查询结果中，但不在第二个查询结果中的记录，并去除重复结果，运算符前后的操作对象顺序不同会导致结果不同。

minus all对于操作结果不做去重。

另外except关键字也可以支持，需要新增逻辑。

### 新增关键字

新增except（all）关键字，效果等同于minus（all）；即做两个集合的差集运算，返回出现在第一个查询结果中，但不在第二个查询结果中的记录，运算符前后的操作对象顺序不同会导致结果不同。

except对集合操作结果做去重；except all对集合操作结果不做去重。

|方案|优点|缺点|
|---|---|---|
|方案一：增加token，在语法解析时将except等同于minus进行处理，实际调用逻辑使用minus的代码逻辑|改动小，影响面小|能支持except语句的输入解析，但相关输出比如计划等还是minus|
|方案二：增加type，支持语法解析，实际调用逻辑使用minus的代码逻辑|输入输出均是except|改动适中|
|方案三：增加算子，支持语法解析，代码逻辑独立（列存计算可复用minus的逻辑）|完全支持except新增关键字|改动大，影响面大|


本文档使用方案一。

### 操作优先级

  `intersect (all) = union (all) = minus (all)`  

可以通过多个集合操作符将多个查询的结果进行组合。此时，需要注意它们之间的优先级和执行顺序：

- 所有集合操作符的优先级相同；
- 相同的集合操作符按照从左至右的顺序执行；
- 使用括号可以明确指定执行的顺序。


### 数据类型转换规则

- 数值类型：Double > Float > Decimal > Integer (转换优先级与coalesce实现一致)；
- 字符串类型：
    - 都是CHAR与CHAR类型：如果长度相同返回相同CHAR类型，如果长度不同，返回VARCHAR类型；
    - 只要有VARCHAR类型：返回VARCHAR类型（选取两者较长的长度）；
- 时间日期类型：Timestamp > OracleDate/Date > Time, 其他时间日期类型只支持与自己进行运算，否则报错；


**如果两个集合的输入类型不一致，需要在适配层面使用Cast进行转换；**

**需要注意的是，如果两边都是FixedUtf8，长度不同时，不能使用Cast转换成长度相同的类型，否则计算结果会有误；**

**转换规格矩阵：**

|expr1|expr2|输出类型|
|---|---|---|
|Double|Double|Double|
|Double|Float|Double|
|Double|Decimal|Double|
|Double|Integer|Double|
|Float|Float|Float|
|Float|Double|Double|
|Float|Decimal|Float|
|Float|Integer|Float|
|Decimal|Decimal|Decimal|
|Decimal|Double|Double|
|Decimal|Float|Float|
|Decimal|Integer|Decimal|
|Integer|Integer|Integer|
|Integer|Double|Double|
|Integer|Float|Float|
|Integer|Decimal|Decimal|
|char(n)|char(n)|char(n)|
|char(m)|char(n)|varchar(max(m, n))（实际比较会带有空格进行比较，因此不必纠结输出类型）|
|char(m)|varchar(n)|varchar(max(m, n))|
|varchar|varchar|varchar(取两者较长长度)|
|varchar|char|varchar(取两者较长长度)|
|Timestamp|Timestamp|Timestamp|
|Timestamp|OracleDate/Date|Timestamp|
|Timestamp|Time|Timestamp|
|OracleDate/Date|OracleDate/Date|OracleDate/Date|
|OracleDate/Date|Timestamp|Timestamp|
|OracleDate/Date|Time|OracleDate/Date|
|Time|Time|Time|
|Time|Timestamp|Timestamp|
|Time|OracleDate/Date|OracleDate/Date|


|  
|TINYINT|SMALLINT|INT|BIGINT|NUMBER|FLOAT|DOUBLE|CHAR|VACHAR|DATE|TIMESTAMP|YM_INTERVAL|DS_INTERVAL|TIME|BOOLEAN|BIT|CLOB|BLOB|NCLOB|XMLTYPE|RAW|JSON|ROWID|UROWID|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|TINYINT|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|SMALLINT|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|INT|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|BIGINT|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|NUMBER|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|FLOAT|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|DOUBLE|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|CHAR|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|VACHAR|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|DATE|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|TIMESTAMP|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|YM_INTERVAL|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|DS_INTERVAL|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|TIME|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|BOOLEAN|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|BIT|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|CLOB|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|BLOB|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|NCLOB|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|XMLTYPE|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|RAW|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|JSON|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|ROWID|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|UROWID|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|


  


### 优化器修改

优化器方面需要生成分布式场景下对应的集合操作的计划，目前了解到需要优化器方面将原来对分布式场景下集合操作的拦截做相应的去除，这一部分工作已有ar。

### 列存修改

- 列存单机已有集合操作的计算代码，分布式可复用，将分布式场景集合操作计划放开后，需要根据相应的测试用例的执行结果对相应的适配工作，以符合分布上场景下集合操作的预期。
- 另支持except作为关键字，即差集操作，等同于minus；关键字有except，except all。


### 测试用例修改

原单机测试用例不做修改，现需添加分布式场景下集合操作的门禁测试用例。可根据单机的测试用例做相应的修改。

  [standalone/testcase/function5/test_sdv_setOp · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function5/test_sdv_setOp)  

### 支持功能点：

|功能|支持|例子|
|---|---|---|
|||（拼接）|true|```
select col6||col8 from tac_setop_T1 minus select col6||col8 from tac_setop_T1 order by 1;
```|
|>, <, >=, <=, <>, !=, <>/ and, or, not等|true|```
select col2,col4 from tac_setop_T1 where col2 <= 0 and col4 != 1 minus select col2,col4 from tac_setop_T2 where col4 <= 0 order by 1,2;
```|
|+, - ,*, /, %(Oracle不支持)|true|```
select col1+col2,col2-col1,col1*col2,col1/col2 from tac_setop_T1 minus select col1+col2,col2-col1,col1*col2,col1/col2 from tac_setop_T2 order by 1,2,3,4;
```|
|abs,mod,div|true|```
select abs(col1),mod(col2,3) from tac_setop_T1 minus select abs(col1),mod(col2,3) from tac_setop_T2 order by 1,2;
```|
|order by|true|```
select col1 from tac_setop_T1 minus select col1 from tac_setop_T2 order by 1;
```|
|数学函数 cos,acos,sin,ason,tan,atan,tan2,pi,cot|true|```
select cos(col1),sin(col1) from tac_setop_number1 minus select cos(col1),sin(col1) from tac_setop_number2 order by 1,2;
```|
|字符函数concat,length,lengthb,lower,upper,trim,substr,instr,replace,coalesce|true|```
select cos(col1),sin(col1) from tac_setop_number1 minus select cos(col1),sin(col1) from tac_setop_number2 order by 1,2;
```|
|RANGE|LIST|REFERENCE partition on distributed|false|```
CREATE TABLE SET_MULTI_YDBRD_T4 (A4 INT, B4 SMALLINT, C4 INT, D4 INT, E4 BIGINT, X4 VARCHAR(30)) ORGANIZATION TAC PARTITION BY RANGE(A4) (PARTITION P1 VALUES LESS THAN (-100), PARTITION P2 VALUES LESS THAN (0), PARTITION P3 VALUES LESS THAN (200), PARTITION P4 VALUES LESS THAN (1000), PARTITION P5 VALUES LESS THAN (MAXVALUE));
```|
|rownum|false|```
select c1 from tac_setop_T1 where rownum <8 intersect all select c2 from tac_setop_T1 where rownum <8 minus all (select c1 from tac_setop_T1 where rownum <8 intersect all select c2 from tac_setop_T1 where rownum <8 intersect (select c1 from tac_setop_T1 where rownum <8) intersect all select c2 from tac_setop_T1 where rownum <2) order by 1;
```|


### 单机用例报错点

报错是因为分布式本身还不支持对应操作。

```
SQL> CREATE TABLE SET_MULTI_YDBRD_T4 (A4 INT, B4 SMALLINT, C4 INT, D4 INT, E4 BIGINT, X4 VARCHAR(30)) ORGANIZATION TAC PARTITION BY RANGE(A4) (PARTITION P1 VALUES LESS THAN (-100), PARTITION P2 VALUES LESS THAN (0), PARTITION P3 VALUES LESS THAN (200), PARTITION P4 VALUES LESS THAN (1000), PARTITION P5 VALUES LESS THAN (MAXVALUE));

YAS-00004 feature "RANGE|LIST|REFERENCE partition on distributed" has not been implemented yet



SQL> select c1 from tac_setop_T1 where rownum <8 intersect all select c2 from tac_setop_T1 where rownum <8 minus all (select c1 from tac_setop_T1 where rownum <8 intersect all select c2 from tac_setop_T1 where rownum <8 intersect (select c1 from tac_setop_T1 where rownum <8) intersect all select c2 from tac_setop_T1 where rownum <2) order by 1;

[1:35]YAS-04371 unsupport ROWNUM in distributed database
```

### 资料修改

Doc相关资料需做对应修改：

1. doc/产品文档/开发手册/SQL参考手册/SQL语句/    [SELECT.md](http://SELECT.md)  


![](https://pingcode.yasdb.com/atlas/files/public/67396c6ea1ad9a3311dc8a8a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3NzcsImV4cCI6MTc4MjMxMTU3N30.UH5Rv4MVpjdgmeY2s0bk-gCRm4VwExhC8zJajQjyPzY)

还需要补充except与minus的关系以及优先级。

# 6. Testcases（自测用例）

- 跑过门禁、二层ci现有用例；
- 添加分布式对应用例（待补充）


# 7. Document（资料）

  [Set Operators](/pages/createpage.action?spaceKey=YAS&title=Set+Operators)  

# 8. Workload（工作量）

# 6. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

  


  


  


  


  


  


  


## Attachments:

## Comments:

|  [](null)  ,2023年10月26日会议纪要：,1. except关键字采用方案一
1. 添加except关键字需要在Doc资料上补充两者关系
1. Doc资料上补充集合操作组合使用的优先级
1. 设计文档补充类型转换的矩阵列表
1. 补充等价类信息
,Posted by wangrensong at 十月 26, 2023 17:49|
|---|
|  [](null)  ,对于cast(NULL as xxx) 和cast(NULL as yyy) xxx和yyy本身不能比较但是却能得出结果的情况，是由于NULL现在是无类型，会转化成相同类型，无需关注 ,Posted by wangrensong at 十一月 02, 2023 10:25|
