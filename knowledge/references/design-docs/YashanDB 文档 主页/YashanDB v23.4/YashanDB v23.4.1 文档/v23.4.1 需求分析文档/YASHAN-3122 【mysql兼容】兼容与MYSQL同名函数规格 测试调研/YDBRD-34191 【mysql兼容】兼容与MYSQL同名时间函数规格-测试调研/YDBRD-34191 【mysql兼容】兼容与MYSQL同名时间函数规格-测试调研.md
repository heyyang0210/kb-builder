# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670de9bce489dd0868f7a15b?](https://pingcode.yasdb.com/pjm/items/670de9bce489dd0868f7a15b?)  

#YDBRD-34191 【mysql兼容】兼容与MYSQL同名时间函数规格

time,timediff,timestamp,timestampdiff与mysql同名函数兼容

# 2.时间类型介绍

参考：  [https://dev.mysql.com/doc/refman/9.1/en/datetime.html](https://dev.mysql.com/doc/refman/9.1/en/datetime.html)  

|类型|MYSQL|YASHAN|
|---|---|---|
|date|The DATE type is used for values with a date part but no time part. MySQL retrieves and displays DATE values in 'YYYY-MM-DD' format. The supported range is '1000-01-01' to '9999-12-31'.|DATE类型的默认格式为YYYY-MM-DD，也可以按类似YYYY-MM-DD [HH[24]][:MI][:SS]的标准格式进行指定,0001-01-01 00:00:00 ~ 9999-12-31 23:59:59|
|datetime|The DATETIME type is used for values that contain both date and time parts. MySQL retrieves and displays DATETIME values in 'YYYY-MM-DD hh:mm:ss' format. The supported range is '1000-01-01 00:00:00' to '9999-12-31 23:59:59'.||
|timestamp|The TIMESTAMP data type is used for values that contain both date and time parts. TIMESTAMP has a range of '1970-01-01 00:00:01' UTC to '2038-01-19 03:14:07' UTC.|1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999|
|time|MySQL retrieves and displays TIME values in 'hh:mm:ss' format (or 'hhh:mm:ss' format for large hours values). TIME values may range from '-838:59:59' to '838:59:59'. The hours part may be so large because the TIME type can be used not only to represent a time of day (which must be less than 24 hours), but also elapsed time or a time interval between two events (which may be much greater than 24 hours, or even negative).|00:00:00.000000 ~ 23:59:59.999999|


# 3.时间函数规格介绍

参考：  [https://dev.mysql.com/doc/refman/9.1/en/date-and-time-functions.html](https://dev.mysql.com/doc/refman/9.1/en/date-and-time-functions.html)  

|函数|MYSQL|YASHAN|
|---|---|---|
|TIME(expression)|提取传入表达式的时间部分，表达式为空时返回空,```
SELECT TIME("19:30:10");
-> 19:30:10
+----------+
| TIME(1)  |
+----------+
| 00:00:01 |
+----------+
1 row in set (0.06 sec)

mysql> SELECT TIME("2024-11-01");
+--------------------+
| TIME("2024-11-01") |
+--------------------+
| 00:20:24           |
+--------------------+
1 row in set, 1 warning (0.00 sec)

mysql> SELECT TIME(1.1);
+------------+
| TIME(1.1)  |
+------------+
| 00:00:01.1 |
+------------+
1 row in set (0.06 sec)

mysql> SELECT TIME('a');
+-----------+
| TIME('a') |
+-----------+
| 00:00:00  |
+-----------+
1 row in set, 1 warning (0.00 sec)

mysql> SELECT TIME(true);
+------------+
| TIME(true) |
+------------+
| 00:00:01   |
+------------+
1 row in set (0.00 sec)


```|TIME函数对  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  的值进行时间部分数值的提取，其返回值类型有以下几种情况：,- 当expr的值为DATE、TIME、TIMESTAMP、字符型时，返回TIME类型。
- 当expr的值为NULL时，返回NULL。
- 当expr的值为其他类型时，返回类型不支持。
,当expr的值为字符型时，  其格式必须符合以下规范：,- 字符串类型1：以'yyyy-mm-dd'开头，且至少包含有'yyyy-mm-dd'格式的字符串，需符合年、月、日的一般限制条件，如月份值介于1-12之间、日期值介于1-31之间等。
- 字符串类型2：'hh24:mi:ss.ff'格式的字符串，此字符串可从后向前省略部分，需符合小时、分、秒的一般限制条件，如小时值介于0-23之间、分钟值介于0-59之间等。此时TIME函数会对省略的部分补0。
|
|TIMEDIFF(expr1，expr2)|TIMEDIFF函数用于计算expr1与expr2之间的时间差,  返回为时间类型  ，  expr1和expr2是能够转为time或者datetime的表达式  ，转换必须为同一类型，任一表达式为null时返回null,```
mysql> SELECT TIMEDIFF('2000-01-01 00:00:00',
    ->                 '2000-01-01 00:00:00.000001');
        -> '-00:00:00.000001'
mysql> SELECT TIMEDIFF('2008-12-31 23:59:59.000001',
    ->                 '2008-12-30 01:01:01.000002');
        -> '46:58:57.999999'
```|TIMEDIFF函数用于计算expr1与expr2之间的时间差，返回一个  INTERVAL DAY TO SECOND  类型的数值。,**expr1/expr2**,- expr1和expr2为YashanDB  认可的  [通用表达式](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  ，并且  类型相同  ，即TIMESTAMP、DATE或TIME类型，或可以转换为TIMESTAMP、DATE、TIME类型的字符型。
- 当expr1和expr2都不为字符型，且expr1和expr2类型不同时，则报错  。
- 当其中一个参数为TIMESTAMP、DATE、TIME类型，另一个参数为字符型时，则将字符串类型的参数转换成与另一个参数类型相同的时间日期类型。
- 当expr1和expr2都为字符型时，则将expr1和expr2都转成TIMESTAMP类型。
- 当expr1或者expr2的值为NULL时，函数返回NULL。
|
|TIMESTAMP(expression, interval)|单个参数时，函数返回  date或datetime  类型；有2个参数时，将第二个时间参数加到第一个参数返回  datetime  类型，如果参数有null则返回null,```
mysql> SELECT TIMESTAMP("2017-07-23",  "13:10:11");
-> 2017-07-23 13:10:11
mysql> SELECT TIMESTAMP('2003-12-31');
        -> '2003-12-31 00:00:00'
mysql> SELECT TIMESTAMP('2003-12-31 12:00:00','12:00:00');
        -> '2004-01-01 00:00:00'
```|如果是1个参数，TIMESTAMP函数计算timestamp_expr表示的日期，返回一个  TIMESTAMP  类型的日期值。,如果是2个参数，TIMESTAMP函数计算timestamp_expr表示的日期加上time_expr表示的时间，返回一个  TIMESTAMP  类型的日期值。,**timestamp_expr**,YashanDB认可的通用表达式，timestamp_expr的值必须为DATE、TIMESTAMP、TIME或者字符型数据，当为字符型时，必须确保字符串符合当前TIMESTAMP类型的格式要求。,当timestamp_expr为NULL时，函数返回NULL。,**time_expr**,YashanDB认可的通用表达式，time_expr的值必须为DATE、TIMESTAMP、TIME或者字符型数据，当为字符型时，必须确保字符串符合当前TIME类型的格式要求。,当time_expr为NULL时，函数返回NULL。|
|TIMESTAMPDIFF(unit,datetime_expr1,datetime_expr2)|计算时间差，expr1和expr2是date或者datetime类型，返回 datetime_expr2 − datetime_expr1 的时间差，若一个为date，一个为datetime，date将转为datetime类型，表达式为null时返回null,unit：MICROSECOND (microseconds), SECOND, MINUTE, HOUR, DAY, WEEK, MONTH, QUARTER, or YEAR.,```
mysql> SELECT TIMESTAMPDIFF(DAY,'2003-02-01','2003-05-01');   // 计算两个时间相隔多少天
        -> 89
mysql> SELECT TIMESTAMPDIFF(MONTH,'2003-02-01','2003-05-01');   // 计算两个时间相隔多少月
        -> 3
mysql> SELECT TIMESTAMPDIFF(YEAR,'2002-05-01','2001-01-01');    // 计算两个时间相隔多少年
        -> -1
mysql> SELECT TIMESTAMPDIFF(MINUTE,'2003-02-01','2003-05-01 12:05:55');  // 计算两个时间相隔多少分钟
        -> 128885
```|TIMESTAMPDIFF函数根据unit所指定的时间单位，计算expr1与expr2之间的时间差，返回一个BIGINT类型的数值，expr1小于expr2时返回值为正，expr1大于expr2时返回值为负。,**unit**,表示函数计算结果的单位，unit不可以为NULL，且必须为如下字符字面量中的一项：,- MICROSECOND
- SECOND
- MINUTE
- HOUR
- DAY
- WEEK
- MONTH
- QUARTER
- YEAR
,**expr1/expr2**,expr1和expr2为YashanDB认可的通用表达式，其值须为TIMESTAMP、DATE或TIME类型，或可以转换为TIMESTAMP、DATE类型的字符型。,当expr1或者expr2的值为NULL时，函数返回NULL。,当expr1或者expr2的值为DATE类型时，系统对微秒部分补0。,当expr1或者expr2的值为TIME类型时，系统对缺少的日期部分补充为当天日期值。|


# 4.使用场景

时间转换与时间差计算

# 5.测试关注

1.入参类型与转换规则，注意字符串类型

2.返回类型兼容