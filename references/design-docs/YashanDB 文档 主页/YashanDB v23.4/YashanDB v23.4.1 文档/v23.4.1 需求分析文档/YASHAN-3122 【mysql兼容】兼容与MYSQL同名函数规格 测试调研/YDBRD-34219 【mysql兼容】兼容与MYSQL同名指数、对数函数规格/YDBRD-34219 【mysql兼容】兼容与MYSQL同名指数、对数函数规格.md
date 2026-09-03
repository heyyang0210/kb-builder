# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670e1c30e489dd0868f7bcd4?](https://pingcode.yasdb.com/pjm/items/670e1c30e489dd0868f7bcd4?)  

#YDBRD-34219 【mysql兼容】兼容与MYSQL同名指数、对数函数规格

EXP()、LN()、LOG()、POW()、POWER()、SQRT()

# 2.函数

参考：  [https://dev.mysql.com/doc/refman/5.7/en/mathematical-functions.html](https://dev.mysql.com/doc/refman/5.7/en/mathematical-functions.html)  

All mathematical functions return   `NULL`   in the event of an error

|函数名称|MYSQL|YASHAN|规格说明|
|---|---|---|---|
|EXP(X)|Returns the value of   *e*   (the base of natural logarithms) raised to the power of   `X`  . The inverse of this function is   `LOG()`   (using a single argument only) or   `LN()`  .|EXP函数计算以e=2.71828183... 为底，  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的数值为指数的数学结果，返回一个DOUBLE类型的数值。,expr的值须为数值型，可以是数值型字符串，对于其他类型，函数返回类型不支持错误。,当expr为NULL时，返回NULL。,由于显示精度差异，本函数的计算结果与Oracle同函数的计算结果在前15位可以保持一致，之后可能会有差异。|1、yashandb 规格与 mysql 一致|
|LN(X)|Returns the natural logarithm of   `X`  ; that is, the base-  *e*   logarithm of   `X`  . If   `X`   is less than or equal to 0.0E0, the function returns   `NULL`   and a warning “  Invalid argument for logarithm  ” is reported.,This function is synonymous with   `LOG()`    `X`  . The inverse of this function is the   `EXP()`   function.|LN函数用于计算  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的自然对数，返回一个DOUBLE类型的数值。,expr的值为须为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。,基于自然对数的数学概念，expr的值应该为一个正数。下表列示函数对非正数和一些特殊值的返回规则：,![image.png](https://pingcode.yasdb.com/atlas/files/public/67739300a1ad9a3311de5c7f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBZ0FBQUFBQUVBQUFBQUFFQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFCUUFBQWdBQUFBQUFBQUFBQUFBSUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU3ODEsImV4cCI6MTc4MjQ2NjU4MX0.wo50b71yzwm7MemIRUPk3moZzYwGlPbMZuNGqyZIRgg)|1、特殊值，mysql 返回 NULL，与 yashandb 规格不一致|
|LOG(X),LOG(B,X)|If called with one parameter, this function returns the natural logarithm of   `X`  . If   `X`   is less than or equal to 0.0E0, the function returns   `NULL`   and a warning “  Invalid argument for logarithm  ” is reported.,The inverse of this function (when called with a single argument) is the   `EXP()`   function.,If called with two parameters, this function returns the logarithm of   `X`   to the base   `B`  . If   `X`   is less than or equal to 0, or if   `B`   is less than or equal to 1, then   `NULL`   is returned.,  `LOG(,)`    `B`    `X`   is equivalent to   `LOG() / LOG()`    `X`    `B`  .|LOG函数计算expr2以expr1为底的对数，返回一个DOUBLE类型的数值。,expr1和expr2均为YashanDB认可的  [通用表达式](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  ，其值须为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr1或者expr2的值为NULL时，函数返回NULL。,根据对数的数学概念，expr1应该为除0和1以外的正数，expr2应该为任意一个正数，除此之外的其他情况函数处理规则见下表：,![image.png](https://pingcode.yasdb.com/atlas/files/public/677393dea1ad9a3311de5c84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBZ0FBQUFBQUVBQUFBQUFFQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFCUUFBQWdBQUFBQUFBQUFBQUFBSUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU3ODEsImV4cCI6MTc4MjQ2NjU4MX0.wo50b71yzwm7MemIRUPk3moZzYwGlPbMZuNGqyZIRgg)|1、yashandb  只支持 LOG(B,X)，不支持 LOG(X),2、入参为字符串时，mysql 返回 NULL; yashandb 报错,3、特殊值场景，yashandb 与 mysql 不一致，mysql 返回 NULL|
|POW(X,Y)|Returns the value of   `X`   raised to the power of   `Y`  .|POW/POWER函数计算  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  参数值的exp次幂，其返回类型为：,- 当expr的值为TINYINT、SMALLINT、INT、BIGINT、NUMBER、CHAR、VARCHAR、NCHAR、NVARCHAR类型时，返回NUMBER。
- 当expr的值为FLOAT或DOUBLE类型时，返回DOUBLE。
- 当exp的值为FLOAT或DOUBLE类型时，返回DOUBLE。
- 当expr或exp的值为NULL时，函数返回NULL。
- 对于不能转换为NUMBER类型的expr或exp报错。
,**exp**,指数。,exp为与expr相同的通用表达式，当exp的值为NULL时，函数返回NULL。,下表列示了不同情况下本函数的计算规则：（字符型将被隐式转换为NUMBER类型参与下表规则）,![image.png](https://pingcode.yasdb.com/atlas/files/public/6773a862a1ad9a3311de5ca3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBZ0FBQUFBQUVBQUFBQUFFQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFCUUFBQWdBQUFBQUFBQUFBQUFBSUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU3ODEsImV4cCI6MTc4MjQ2NjU4MX0.wo50b71yzwm7MemIRUPk3moZzYwGlPbMZuNGqyZIRgg)|1、mysql 上，当 Y 为非数值类型时，返回值为1；yashandb 直接报错,2、mysql上，当 X 为非数值类型时，返回值为0；yashandb 直接报错,3、函数计算规则，如果指数为0，不管底数是否为字符串，均返回1，yashandb 只要是不能强转为数值型的字符串类型，均会报错,4、底数为负数，指数为负数，yashandb 报错：YAS-04426 the argument value is out of range，mysql 会执行计算，报结果超出范围：ERROR 1690 (22003): DOUBLE value is out of range in 'pow(-(9),-(2.1))'|
|POWER(X,Y)|This is a synonym for   `POW()`  .|同上|同上|
|SQRT(X)|Returns the square root of a nonnegative number   `X`  .|SQRT函数计算  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的数据的平方根。其返回类型为：,- 当expr的值为TINYINT、SMALLINT、INT、BIGINT、NUMBER、CHAR、VARCHAR、NCHAR或NVARCHAR类型时，返回NUMBER。
- 当expr的值为FLOAT类型时，返回FLOAT。
- 当expr的值为DOUBLE类型时，返回DOUBLE。
- 当expr的值为NULL时，返回NULL。
,其中expr的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为负数时，函数返回Out or range错误，为负数且数据类型为float或double时，函数返回无效数字Nan。|1、入参为无法转 number 的字符串时，mysql 返回0，yashandb 报错：ERROR 8 (HY000): YAS-00008 type convert error : not a valid number,2、入参为负数时，mysql 返回NULL；yashandb 报错：ERROR 4426 (HY000): YAS-04426 the argument value is out of range|


# 4.使用场景

各种使用函数的场景

# 5.测试关注

1.入参、出参参数校验

2.函数功能测试