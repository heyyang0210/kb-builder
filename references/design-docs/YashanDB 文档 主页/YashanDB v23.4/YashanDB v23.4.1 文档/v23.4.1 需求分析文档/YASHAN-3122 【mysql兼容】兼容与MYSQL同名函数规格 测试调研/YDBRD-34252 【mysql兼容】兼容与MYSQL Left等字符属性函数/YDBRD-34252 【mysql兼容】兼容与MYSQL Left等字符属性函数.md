# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670e3debe489dd0868f7e74d?](https://pingcode.yasdb.com/pjm/items/670e3debe489dd0868f7e74d?)  

#YDBRD-34252 【mysql兼容】兼容与MYSQL Left等字符属性函数

LEFT()、RIGHT()、LENGTH()、OCTET_LENGTH()、UPPER()、LOWER()

# 2.函数

参考：  [https://dev.mysql.com/doc/refman/5.7/en/string-functions.html](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html)  



|函数名称|MYSQL|YASHAN|规格说明|
|---|---|---|---|
|LEFT(str,len)|返回 str 最左边的长度为 len 的子串；,参数存在 NULL，则返回 NULL,该函数多字节安全的|LEFT函数将  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值从左边截取指定长度，得到一个子字符串并将其返回。,**expr**,expr的值须为字符型或可转换为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr为NCLOB/NCHAR/NVARCHAR时返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
,**length**,指定字符串截取的长度，length为与expr相同的通用表达式，须为除BIT外数值型数据或可转换为NUMBER类型的其他类型数据，取值范围为[-2147483648,2147483647]。,- 当length的值为NULL或[-2147483648,0]时，函数返回NULL。
- 当length值为小数时，函数将先对其进行取整，规则如下：
    - NUMBER型或浮点型：四舍五入取整。
    - 可转换为NUMBER的其他类型：向下取整（即截取整数部分）。
- 当length值大于expr字符串长度时，将其按expr字符串长度值处理。
||
|RIGHT(str,len)|返回 str 最右边的长度为 len 的子串；,参数存在 NULL，则返回 NULL,该函数多字节安全的|RIGHT函数将  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的字符串从右边截取指定长度，得到一个子字符串并将其返回。,**expr**,expr的值须为字符型或可转换为字符型的其他类型（LOB、XMLTYPE类型支持隐式转换）。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr为NCLOB/NCHAR/NVARCHAR类型时，返回值为NVARCHAR。其余场景返回值为VARCHAR。
- 当expr的值为NULL时，函数返回NULL。
,**length**,指定字符串截取的长度，length为与expr相同的通用表达式，须为除BIT外数值型数据，或可转换为NUMBER类型的其他类型数据，取值范围[-2147483648,2147483647]。,- 当length的值为NULL，0或负数时，函数返回NULL。
- 当length值为小数时，函数将先对其进行取整，规则如下：
    - length为NUMBER型或者浮点型时：四舍五入取整。
    - length为可转换为NUMBER的其他类型时：截取整数部分。
- 若length值大于expr字符串长度，则将其按expr字符串长度值处理。
||
|LENGTH(str)|返回字符串的长度，以字节为单位，多字节字符计算为多个字节。而 char_length 返回字符数|没有 length 函数？||
|OCTET_LENGTH(str)|与 length 函数是同义词|OCTET_LENGTH函数按字节统计  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的长度，返回一个BIGINT的数值。,本函数与  [LENGTHB](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/LENGTH-LENGTHB.html)  函数同义。,**expr**,通用表达式，其值须为字符型或可转化为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- 当expr的值为NULL时，函数返回NULL。
||
|UPPER(str)|根据当前字符集转为大写，默认字符集  `latin1`   ,该函数对二进制字符类型无效，需要先转为非二进制类型再转成大写,|UPPER函数用于将源字符串  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  中的小写字母转换为大写字母，返回转换后的新字符串。,**expr**,通用表达式，其值须为字符型或可转化为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr为CHAR、NCHAR或NVARCHAR类型时，返回值的类型与expr的类型相同，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
||
|LOWER(str)|根据当前字符集转为小写，默认字符集  `latin1`   ,mysql> SET @str = BINARY 'New York';  
mysql> SELECT LOWER(@str), LOWER(CONVERT(@str USING latin1));
+-------------+-----------------------------------+
| LOWER(@str) | LOWER(CONVERT(@str USING latin1)) |
+-------------+-----------------------------------+
| New York    | new york                          |
+-------------+-----------------------------------+,对于 Unicode 字符集的排序规则，   `LOWER()`  和   `UPPER()`  按照排序规则名称中的 Unicode 排序算法 (UCA) 版本工作|LOWER函数将  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值中的大写字母转换为小写，返回一个新字符串。,**expr**,通用表达式，其值须为字符型或可转换为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr为CHAR、NCHAR或NVARCHAR类型时，返回值与expr同类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
||


# 4.使用场景

各种使用函数的场景

# 5.测试关注

1.入参、出参参数校验

2.函数功能测试