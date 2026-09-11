

# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670de6f9e489dd0868f7a0f6?](https://pingcode.yasdb.com/pjm/items/670de6f9e489dd0868f7a0f6?)  

#YDBRD-34182 【mysql兼容】兼容与MYSQL同名数学函数规格

time,timediff,timestamp,timestampdiff与mysql同名函数兼容

# 2.数学函数介绍

参考：  [https://dev.mysql.com/doc/refman/9.1/en/mathematical-functions.html#function_round](https://dev.mysql.com/doc/refman/9.1/en/mathematical-functions.html#function_round)  

|函数|MYSQL|YASHAN|
|---|---|---|
|ABS(X)|Returns the absolute value of   `X`  , or   `NULL`   if   `X`   is   `NULL`  .,The result type is derived from the argument type. An implication of this is that   `ABS(-9223372036854775808)`   produces an error because the result cannot be stored in a signed   `BIGINT`   value.,```
mysql> SELECT ABS(2);
        -> 2
mysql> SELECT ABS(-32);
        -> 32
```|ABS函数计算一个数值的绝对值，  其返回值的数据类型为：,![image.png](https://pingcode.yasdb.com/atlas/files/public/673ee0e68970c2af4f53b6d8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU2ODYsImV4cCI6MTc4MjQ2NjQ4Nn0.7lE2uUXqvtblEbN__y2byuCIoeuhg3XcZoDB6-QHlZo),其中  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  的值为数值型，或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。|
|CEIL(X)|同ceiling|CEIL函数对  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  表示的数据进行向上取整，其返回规则为：,- 当expr的值为数值型时，返回与其相同数据类型的数据。
- 当expr的值为字符型时，返回NUMBER类型的数据。
- 当expr的值为NULL时，返回NULL。
- 当expr的值为浮点类型特殊值时：
    - Nan：函数返回Nan
    - Inf：函数返回Inf
-Inf：函数返回-Inf,其中expr的值为数值型，或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。|
|CEILING(X)|Returns the smallest integer value not less than   `X`  . Returns   `NULL`   if   `X`   is   `NULL`  .,```
mysql> SELECT CEILING(1.23);
        -> 2
mysql> SELECT CEILING(-1.23);
        -> -1
```,|无|
|FLOOR(X)|Returns the largest integer value not greater than   `X`  . Returns   `NULL`   if   `X`   is   `NULL`  .,For exact-value numeric arguments, the return value has an exact-value numeric type. For string or floating-point arguments, the return value has a floating-point type.,```
mysql> SELECT FLOOR(1.23), FLOOR(-1.23);
        -> 1, -2
```|FLOOR函数对给定参数  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  的值进行向下取整，其返回类型为：,- 当expr的值为数值型数据时，返回与其相同类型的数据。
- 当expr的值为字符型数据时，返回NUMBER类型的数据。
- 当expr的值为NULL时，返回NULL。
,其中expr的值为数值型，或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。|
|MOD(N,M)|Modulo operation. Returns the remainder of   `N`   divided by   `M`  . Returns   `NULL`   if   `M`   or   `N`   is   `NULL`  .,This function is safe to use with   `BIGINT`   values.,  `MOD()`   also works on values that have a fractional part and returns the exact remainder after division:,  `MOD(,0)`    `N`   returns   `NULL`  .,```
mysql> SELECT MOD(234, 10);
        -> 4
mysql> SELECT 253 % 7;
        -> 1
mysql> SELECT MOD(29,9);
        -> 2
mysql> SELECT 29 MOD 9;
        -> 2
mysql> SELECT MOD(34.5,3);
        -> 1.5
```|MOD为取模函数，与  [算术运算符](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E8%BF%90%E7%AE%97%E7%AC%A6/%E7%AE%97%E6%9C%AF%E8%BF%90%E7%AE%97%E7%AC%A6)  算法一致。,在算术运算时，YashanDB通过隐式数据转换，将参与运算的数据类型统一到某个数据类型，并按此数据类型返回运算结果，具体规则请参考  [算术运算符](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E8%BF%90%E7%AE%97%E7%AC%A6/%E7%AE%97%E6%9C%AF%E8%BF%90%E7%AE%97%E7%AC%A6)  里的数据类型描述。,  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  1、  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  2的值为数值型，或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。  对于其他类型，函数返回类型不支持。,当expr1或expr2中任一值为NULL时，函数返回NULL。|
|ROUND(X（,D）)|Rounds the argument   `X`   to   `D`   decimal places. The rounding algorithm depends on the data type of   `X`  .   `D`   defaults to 0 if not specified.   `D`   can be negative to cause   `D`   digits left of the decimal point of the value   `X`   to become zero. The maximum absolute value for   `D`   is 30; any digits in excess of 30 (or -30) are truncated. If   `X`   or   `D`   is   `NULL`  , the function returns   `NULL`  .,The return value has the same type as the first argument (assuming that it is integer, double, or decimal). This means that for an integer argument, the result is an integer (no decimal places):,  `ROUND()`   uses the following rules depending on the type of the first argument:,- For exact-value numbers,   `ROUND()`   uses the “  round half away from zero  ” or “  round toward nearest  ” rule: A value with a fractional part of .5 or greater is rounded up to the next integer if positive or down to the next integer if negative. (In other words, it is rounded away from zero.) A value with a fractional part less than .5 is rounded down to the next integer if positive or up to the next integer if negative.
- For approximate-value numbers, the result depends on the C library. On many systems, this means that   `ROUND()`   uses the “  round to nearest even  ” rule: A value with a fractional part exactly halfway between two integers is rounded to the nearest even integer.
,The following example shows how rounding differs for exact and approximate values:,For more information, see   [Section 14.25, “Precision Math”](https://dev.mysql.com/doc/refman/9.1/en/precision-math.html)  .,The data type returned by   `ROUND()`   (and   `TRUNCATE()`  ) is determined according to the rules listed here:,- When the first argument is of any integer type, the return type is always   `BIGINT`  .
- When the first argument is of any floating-point type or of any non-numeric type, the return type is always   `DOUBLE`  .
- When the first argument is a   `DECIMAL`   value, the return type is also   `DECIMAL`  .
- The type attributes for the return value are also copied from the first argument, except in the case of   `DECIMAL`  , when the second argument is a constant value.
- When the desired number of decimal places is less than the scale of the argument, the scale and the precision of the result are adjusted accordingly.
- In addition, for   `ROUND()`   (but not for the   `TRUNCATE()`   function), the precision is extended by one place to accommodate rounding that increases the number of significant digits. If the second argument is negative, the return type is adjusted such that its scale is 0, with a corresponding precision. For example,   `ROUND(99.999, 2)`   returns   `100.00`  —the first argument is   `DECIMAL(5, 3)`  , and the return type is   `DECIMAL(5, 2)`  .
- If the second argument is negative, the return type has scale 0 and a corresponding precision;   `ROUND(99.999, -1)`   returns   `100`  , which is   `DECIMAL(3, 0)`  .
,```
mysql> SELECT ROUND(-1.23);
        -> -1
mysql> SELECT ROUND(-1.58);
        -> -2
mysql> SELECT ROUND(1.58);
        -> 2
mysql> SELECT ROUND(1.298, 1);
        -> 1.3
mysql> SELECT ROUND(1.298, 0);
        -> 1
mysql> SELECT ROUND(23.298, -1);
        -> 20
mysql> SELECT ROUND(.12345678901234567890123456789012345, 35);
        -> 0.123456789012345678901234567890
mysql> SELECT ROUND(150.000,2), ROUND(150,2);
+------------------+--------------+
| ROUND(150.000,2) | ROUND(150,2) |
+------------------+--------------+
|           150.00 |          150 |
+------------------+--------------+
  mysql> SELECT ROUND(2.5), ROUND(25E-1);
+------------+--------------+
| ROUND(2.5) | ROUND(25E-1) |
+------------+--------------+
| 3          |            2 |
+------------+--------------+
```|ROUND函数对  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  的值按照指定格式四舍五入一个  日期值  ，返回一个DATE类型的日期；,  [ROUND | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ROUND.html)  |
|SIGN()|Returns the sign of the argument as   `-1`  ,   `0`  , or   `1`  , depending on whether   `X`   is negative, zero, or positive. Returns   `NULL`   if   `X`   is   `NULL`  .,```
mysql> SELECT SIGN(-32);
        -> -1
mysql> SELECT SIGN(0);
        -> 0
mysql> SELECT SIGN(234);
        -> 1
```|SIGN函数返回  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/expr)  表示的数值的符号，包括1、-1、0。,expr的值须为数值型，或可以转换为NUMBER类型的字符型（转换失败返回Invalid number错误）。对于其他类型，函数返回类型不支持。,当expr的值为NULL时，函数返回NULL。,当expr的值为正数时，函数返回1；当expr的值为负数时，函数返回-1；当expr的值为0时，函数返回0。,对于浮点数据里的Nan、-Inf、Inf特殊值：,- SIGN(Nan) = 1
- SIGN(Inf) = 1
- SIGN(-Inf) = -1
|


# 4.使用场景

数值运算使用

# 5.测试关注

1.支持入参类型，返回类型精度

2.round函数功能不同

