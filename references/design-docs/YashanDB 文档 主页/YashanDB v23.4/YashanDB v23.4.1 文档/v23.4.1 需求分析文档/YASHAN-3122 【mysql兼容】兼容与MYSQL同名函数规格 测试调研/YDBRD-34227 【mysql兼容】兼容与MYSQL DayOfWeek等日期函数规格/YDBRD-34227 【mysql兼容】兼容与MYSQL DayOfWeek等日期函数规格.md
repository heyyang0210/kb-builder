# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670e2ebbe489dd0868f7d0c8?](https://pingcode.yasdb.com/pjm/items/670e2ebbe489dd0868f7d0c8?)  

#YDBRD-34227 【mysql兼容】兼容与MYSQL DayOfWeek等日期函数规格

DATE_FORMAT()、DAYOFWEEK()、EXTRACT()

# 2.函数

参考：  [https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html](https://dev.mysql.com/doc/refman/5.7/en/date-and-time-functions.html)  



|函数名称|MYSQL|YASHAN|规格说明|
|---|---|---|---|
|DATE_FORMAT(date,format)|Formats the   `date`   value according to the   `format`   string.,The specifiers shown in the following table may be used in the   `format`   string. The   `%`   character is required before format specifier characters. The specifiers apply to other functions as well:   `STR_TO_DATE()`  ,   `TIME_FORMAT()`  ,   `UNIX_TIMESTAMP()`  .,![image.png](https://pingcode.yasdb.com/atlas/files/public/6773b437a1ad9a3311de5cbd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFRQWdBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUVBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU4MDUsImV4cCI6MTc4MjQ2NjYwNX0.sD3zRhUCiZp7vE9UGdlwZniULDB45D47pMjmJvKRDfw),由于 MySQL 允许存储不完整的日期（例如），因此月份和日期说明符的范围从零开始  `'2014-00-00'`  。,日期和月份名称及缩写所使用的语言由系统变量的值控制   `lc_time_names`  （  [第 10.16 节“MySQL 服务器区域设置支持”](https://dev.mysql.com/doc/refman/5.7/en/locale-support.html)  ）。,对于  `%U`  、  `%u`  、   `%V`  和  `%v`  说明符，请参阅函数的描述   `WEEK()`  以获取有关模式值的信息。模式会影响周数的编号方式。,  `DATE_FORMAT()`  返回一个具有字符集和排序规则的字符串，由   `character_set_connection`  和给出，   `collation_connection`  以便它可以返回包含非 ASCII 字符的月份和星期名称。|DATE_FORMAT函数将给定的参数  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  按format定义的格式进行提取，返回VARCHAR类型的字符串。 expr的值为DATE类型或可以转换为DATE类型的其他类型，format必须是字符型或可以转换为字符串类型。,当expr的值为NULL时，函数返回NULL。,如果输入format为NULL，则函数返回NULL。,如果输入format无法与format列表里的类型相匹配，则输出format对应的字符。|1、date 为空串时，yashandb 报错，mysql 返回 NULL,2、月份及日期为 0 值时，yashandb 报错，mysql 返回 NULL,3、format 为空串时，yashandb 报错，mysql 返回 NULL,4、format 为 NULL 时，yashandb 返回空，mysql 返回 NULL|
|DAYOFWEEK(date)|返回星期几的索引  `date`   （  `1`  = 星期日，  `2`  = 星期一，...，  `7`  = 星期六）。这些索引值对应于 ODBC 标准。|DAYOFWEEK函数用于计算  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  位于所在周的第几天（以周日为第一天计算），返回一个INT类型的数值。,expr的值须为TIMESTAMP/DATE类型或可以转换为TIMESTAMP/DATE类型的字符型。,当expr的值为NULL时，函数返回NULL。||
|EXTRACT(unit from date)|该函数使用与 或   `EXTRACT()`  相同类型的说明符，但从日期中提取部分内容，而不是执行日期算术。有关该参数的信息，请参阅  [时间间隔](https://dev.mysql.com/doc/refman/5.7/en/expressions.html#temporal-intervals)  。   `unit`    `DATE_ADD()`    `DATE_SUB()`    `unit`  |EXTRACT函数对给定参数  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  进行年、月、日、小时、分、秒等数值的提取，其返回值类型有以下几种情况：,- 当expr值为NULL时，返回NULL。
- 当expr值的数据类型不为DATE、TIMESTAMP、TIME、INTERVAL DAY TO SECOND、INTERVAL YEAR TO MONTH时，返回类型不符合预期。
- expr值的数据类型与年、月、日、小时、分、秒的指定存在如下对应关系，其中出现N/A时返回Illegal format错误，否则按最后一列类型返回：
,![image.png](https://pingcode.yasdb.com/atlas/files/public/6773ca4fa1ad9a3311de5cdc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFRQWdBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUVBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU4MDUsImV4cCI6MTc4MjQ2NjYwNX0.sD3zRhUCiZp7vE9UGdlwZniULDB45D47pMjmJvKRDfw)|1、yashandb 不支持字符串格式，需要用 SELECT EXTRACT(YEAR FROM cast('2019-07-02' as date)) from dual; mysql 支持字符串格式的日期；,2、date 如果不包括 unit 的值，比如 ‘2019-07-02’ 不带 MINUTE，yashandb 报错，mysql 返回 0|


# 4.使用场景

各种使用函数的场景

# 5.测试关注

1.入参、出参参数校验

2.函数功能测试