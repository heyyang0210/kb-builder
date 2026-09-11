# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670e1b56e489dd0868f7bbad?](https://pingcode.yasdb.com/pjm/items/670e1b56e489dd0868f7bbad?)  

#YDBRD-34216 【mysql兼容】兼容与MYSQL同名三角函数规格

ACOS()、ASIN()、ATAN()、ATAN2()、COS()、COT()、PI()、SIN()、TAN()

# 2.三角函数

参考：  [https://dev.mysql.com/doc/refman/5.7/en/mathematical-functions.html](https://dev.mysql.com/doc/refman/5.7/en/mathematical-functions.html)  

All mathematical functions return   `NULL`   in the event of an error

|函数名称|MYSQL|YASHAN|规格说明|
|---|---|---|---|
|ACOS(X)|Returns the arc cosine of   `X`  , that is, the value whose cosine is   `X`  . Returns   `NULL`   if   `X`   is not in the range   `-1`   to   `1`  .|ACOS函数计算给定参数的反余弦值，参数为弧度表示，大小在区间[-1,1]，函数将返回一个大小在区间[0,pi]的DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|
|ASIN(X)|Returns the arc sine of   `X`  , that is, the value whose sine is   `X`  . Returns   `NULL`   if   `X`   is not in the range   `-1`   to   `1`  .|ASIN函数返回给定参数的反正弦值，参数以弧度表示，大小在区间[-1,1]，函数将返回一个大小在区间[-pi/2,pi/2]的DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致，返回值为 double,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|
|ATAN(X)|Returns the arc tangent of   `X`  , that is, the value whose tangent is   `X`  .|ATAN函数返回给定参数的反正切值，参数为以弧度表示的角度，大小本身无限制（只受限于其所属数据类型所规定范围），函数返回一个大小在区间[-pi/2,pi/2]的DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致，返回值为 double,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|
|ATAN2(X,Y)|Returns the arc tangent of the two variables   `X`   and   `Y`  . It is similar to calculating the arc tangent of   ` / `    `Y`    `X`  , except that the signs of both arguments are used to determine the quadrant of the result.|ATAN2函数返回给定参数 expr1/expr2 的结果的反正切值，参数以弧度表示，大小本身无限制（只受限于其所属数据类型所规定范围），函数将返回一个大小在区间[-pi,pi]的DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  1和  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  2的值均为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr1或expr2中任一值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致，返回值为 double,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|
|COS(X)|Returns the cosine of   `X`  , where   `X`   is given in radians.|COS函数返回给定参数的余弦值，参数为以弧度表示的角度，大小本身无限制（只受限于其所属数据类型所规定范围），函数将返回一个大小在区间[-1,1]的DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致，返回值为 double,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|
|COT(X)|Returns the cotangent of   `X`  .|COT函数返回给定参数的余切值，参数为以弧度表示的角度，大小本身无限制（只受限于其所属数据类型所规定范围），函数将返回一个DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致，返回值为 double,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|
|PI()|返回 π (pi) 的值。默认显示的小数位数为七位，但 MySQL 内部使用完整的双精度值。由于此函数的返回值是双精度值，因此其确切表示可能因平台或实现而异。这也适用于使用 PI 函数的任何表达式|PI函数无给定参数，返回圆周率的值，返回数据类型为DOUBLE|1、mysql 与 yashandb 规格一致，返回值为 double|
|SIN(X)|Returns the sine of   `X`  , where   `X`   is given in radians.|SIN函数返回给定参数的正弦值，参数为以弧度表示的角度，大小本身无限制（只受限于其所属数据类型所规定范围），函数返回一个大小在区间[-1,1]的DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致，返回值为 double,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|
|TAN(X)|Returns the tangent of   `X`  , where   `X`   is given in radians.|TAN函数返回给定参数的正切值，参数为以弧度表示的角度，大小本身无限制（只受限于其所属数据类型所规定范围），函数返回一个DOUBLE类型数据。,其中  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值为数值型或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|1、mysql 与 yashandb 规格一致，返回值为 double,2、yasql 客户端显示与 mysql client 端显示不一致，yasql 显示 NULL 为空串，mysql client 显示 NULL 为 NULL|




# 4.使用场景

各种使用数学函数的场景

# 5.测试关注

1.入参、出参参数校验

2.函数功能测试