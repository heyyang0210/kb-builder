# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670e30bde489dd0868f7d3a4?](https://pingcode.yasdb.com/pjm/items/670e30bde489dd0868f7d3a4?)  

#YDBRD-34232 【mysql兼容】兼容与MYSQL Date等日期函数规格

DATE()、DATE_ADD(）、LAST_DAY

# 2.函数

参考：  [https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html](https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html)  



|函数名称|MYSQL|YASHAN|规格说明|
|---|---|---|---|
|DATE(expr)|提取日期或日期时间表达式的日期部分。|DATE函数有1或2个参数。当只有一个  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  参数时，DATE函数将expr的值按照配置参数DATE_FORMAT指定格式进行DATE类型转换；当有两个参数时，DATE函数将expr的值按照第二个参数format进行格式转换。,表达式expr的数据类型须为DATE/TIMESTAMP/TIME类型，内容不论是否符合date_format或format格式，都返回正确结果。,当expr的值为NULL时，函数返回NULL。|1、yashandb 可以通过 alter session set date_format = 'YYYY-MM-DD hh24:mi:ss'; 来设置日期格式，mysql 没有找到对应的方法来设置日期格式；---这个是约束？,2、如果 expr 带时分秒，yashandb 会报错。mysql 返回年-月-日的格式,3、expr 为 NULL 值时，yashandb 返回空，mysql 返回 NULL,4、类型非法时，yashandb 报错，mysql 返回 NULL，同时存在warnings|
|DATE_ADD(date, interval expr unit),DATE_SUB(date, interval expr unit)|这些函数执行日期算术。参数   `date`  指定起始日期或日期时间值。   `expr`  是一个表达式，指定要从起始日期添加或减去的间隔值。  `expr`  被评估为字符串；它可能以表示  `-`  负间隔的 开头。  `unit`  是一个关键字，指示应以何种单位解释表达式。,有关时间间隔语法的更多信息，包括说明符的完整列表、每个值的参数  `unit`  的预期形式以及时间算术中操作数解释的规则，请参阅   [时间间隔](https://dev.mysql.com/doc/refman/5.7/en/expressions.html#temporal-intervals)  。  [https://dev.mysql.com/doc/refman/5.7/en/expressions.html#temporal-intervals](https://dev.mysql.com/doc/refman/5.7/en/expressions.html#temporal-intervals)  ,返回值取决于参数：,- 如果   `date`  参数是一个   `DATE`  值，并且您的计算仅涉及  `YEAR`  、   `MONTH`  和  `DAY`  部分（即没有时间部分）。则返回 DATE
- 如果第一个参数是 a   `DATETIME`  (或   `TIMESTAMP`  ) 值，或者如果第一个参数是 a  `DATE`   并且该  `unit`  值使用   `HOURS`  、  `MINUTES`  或   `SECONDS`  。则返回 DATETIME
- 否则返回为字符串。
,为了确保结果   `DATETIME`  ，您可以使用   `CAST()`  将第一个参数转换为  `DATETIME`  。,  `MONTH`  当向   `DATE`  或值 添加间隔时  `DATETIME`  ，如果结果日期包含给定月份中不存在的日期，则该日期将调整为该月的最后一天,unit：,![image.png](https://pingcode.yasdb.com/atlas/files/public/6775e748a1ad9a3311de5cf5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU4NTUsImV4cCI6MTc4MjQ2NjY1NX0.6Yaik5RIylZvr-Ze4PCgf9zhiZE_7ba0noDP2J5GTBU)|DATE_ADD函数用于执行日期运算，通过  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值加上给定的区间值得到时间推进或后退过的结果。,**expr**,通用表达式，expr的值须为DATE、TIME、TIMESTAMP类型或可以转换为DATE、TIMESTAMP类型的字符型。,- 当expr为字面量时，只能为DATE和TIMESTAMP关键字的输入字符串，不能为TIME关键字的输入字符串。例如，DATE '2012-10-12'、TIMESTAMP '2012-10-12 10:20:24.000006'为函数可接受的expr值，而当expr为TIME '10:20:24'时函数则返回错误。
- 当expr为NULL时，函数返回NULL。
,**interval_value**,指定时间前进或后退的区间值，且必须为如下形式：,- 0或正整数字面量，例如0、1、2等。
- 包含0或正整数内容的字符串字面量，例如'0'、'1'、'-2'等。
- 包含负整数内容的字符串字面量，例如'-1'、'-2'等。
- 包含INTERVAL内容的字符串字面量，例如'10-8'、'-8 8:10:24'等。
,**interval_unit**,指定区间值的单位，该值不可为NULL，且必须为如下形式：,- MONTH、YEAR、YEAR TO MONTH关键字（不区分大小写）：此时interval_value被转换为INTERVAL YEAR TO MONTH类型。
- SECOND、MINUTE、HOUR、DAY、MINUTE TO SECOND、HOUR TO SECOND、HOUR TO MINUTE、DAY TO SECOND、DAY TO MINUTE、DAY TO HOUR关键字（不区分大小写）：此时interval_value被转换为INTERVAL DAY TO SECOND类型。
,interval_value与interval_unit必须正确匹配，例如分别为2/YEAR，3/HOUR，'10-8'/YEAR TO MONTH、'-8 8:10:24'/DAY TO SECOND，否则函数返回类型转换错误。,**日期运算规则**,- 当interval_value为INTERVAL YEAR TO MONTH类型时，运算规则为：
    - 先进行month的增减，再判断day是否符合month的增减后的day数。
    - 如果增减后的month的天数小于增减前的month的天数，那么增减后的day数等于增减后的month的最后一天。
- 当expr和interval_value的数据类型不相同时，函数先执行类型转换，若两个数据类型之间无法按照一定的规则进行转换，则返回类型转换错误。类型转换规则如下：
    - expr为DATE/TIME/TIMESTAMP类型时，无需转换，函数直接返回expr的数据类型。
    - expr为CHAR/VARCHAR类型时，函数将其转换为DATE类型，转换成功则返回转换后的数据类型，否则返回类型转换错误。
    - expr为TIME，interval_value为INTERVAL DAY TO SECOND类型时，超过范围将翻转，即超过24小时求余数，例如计算后的小时为25时，将其翻转为1。
    - expr为TIME，interval_value为INTERVAL YEAR TO MONTH类型时，函数返回类型不支持错误。
|1、date 为日期格式，值非法，yashandb 报错；mysql 返回 NULL，并告警,2、date 和 unit 不匹配时，yashandb 报错；mysql 返回 NULL,3、类型非法时，yashandb 报错，mysql 返回 NULL，同时存在warnings|
|LAST_DAY(DATE)|获取日期或日期时间值并返回该月最后一天的相应值。参数无效则返回 NULL|LAST_DAY函数返回  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的日期所在月份的最后一天的日期值，返回类型为DATE，且与DATE_FORMAT参数所指定格式一致。,expr的值须为DATE、TIME、TIMESTAMP类型或可转换为DATE类型的字符型。其中，当为TIME类型时，函数返回NULL。,当expr的值为NULL时，函数返回NULL。|1、date 为日期格式，值非法，yashandb 报错；mysql 返回 NULL，并告警,2、date 和 unit 不匹配时，yashandb 报错；mysql 返回 NULL,3、类型非法时，yashandb 报错，mysql 返回 NULL，同时存在warnings|


# 4.使用场景

各种使用函数的场景

# 5.测试关注

1.入参、出参参数校验

2.函数功能测试