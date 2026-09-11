# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670e3eb9e489dd0868f7e7c9?](https://pingcode.yasdb.com/pjm/items/670e3eb9e489dd0868f7e7c9?)  

#YDBRD-34255 【mysql兼容】兼容与MYSQL同名字符串处理函数规格

LPAD()、LTRIM()、REPLACE()、RIGHT()、RPAD()、RTRIM()、TRIM()

# 2.函数

参考：  [https://dev.mysql.com/doc/refman/5.7/en/string-functions.html](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html)  



|函数名称|MYSQL|YASHAN|规格说明|
|---|---|---|---|
|LPAD(str,len,padstr)|用 padstr 左填充 len 个字符到 str，返回 str；,如果 str 长度大于 len，则返回 len 个字符的 str；,此函数多字节安全|LPAD函数从左边对  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值进行指定字符、指定长度的填充，得到一个新字符串。,**expr**,expr的值须为字符型或可转换为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr为NCLOB、NCHAR或NVARCHAR类型时，返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
,**pad_length**,指定进行填充后字符串的最终长度，pad_length为与expr相同的通用表达式，须为数值型数据或可转换为NUMBER类型的其他类型数据，取值范围为[-9223372036854775808,32000]。,- 当pad_length的值为NULL或[-9223372036854775808,0]时，函数返回NULL。
- 当pad_length的值为小数时，函数截断其小数位保留整数位。
- 当pad_length的值小于等于expr字符串长度时，其效果等同于对expr字符串进行截取，函数返回从左到右对expr按该长度进行截取的子字符串。
- 当pad_length的值大于expr字符串长度时，其效果才是对expr字符串进行填充。
,**pad_character**,指定要填充的内容，可省略。pad_character为与expr相同的通用表达式，须为字符型数据或可转换为字符型的其他类型数据。,- 省略pad_character时，默认填充空格。
- 指定pad_character时，函数将循环从左至右读取pad_character的字符并填充到expr的左边，直到满足pad_length的长度要求为止。
- 在向量化执行引擎中，pad_character不能为LOB类型的行外存储数据。
- 当pad_character的值为NULL时，函数返回NULL。
||
|LTRIM(str)|返回删除前导空格的 str|LTRIM函数从左往右删除  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值里与trim_character匹配的内容，得到一个新的子字符串。,**expr**,通用表达式，其值须为字符型或除NCLOB外的可转换为字符型的其他类型。,- 当expr为CLOB类型时，返回值为CLOB类型，当expr为NCHAR/NVARCHAR时，返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- 当expr的值为NULL时，函数返回NULL。
,**trim_character**,指定要匹配的内容，可省略。trim_character为与expr相同的通用表达式，须为字符型或可转换为字符型的其他类型。,- 省略trim_character时，默认的匹配内容为1个空格。
- 指定trim_character时，函数将会从左至右逐一对比expr与trim_character中的字符，若expr中的字符在trim_character中存在则在expr中将其删除，直到遇到首个不存在于trim_character中的字符时停止。若全部字符均被匹配删除，函数返回空字符串。
- 在向量化执行引擎中，trim_character不能为LOB类型的行外存储数据。
- 当trim_character的值为NULL时，函数返回NULL。
||
|REPLACE(str, from_str, to_str)|返回 str 中出现 from_str 替换成 to_str 后的字符串；搜索时区分大小写|REPLACE函数将源字符串  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  中所有的search_character替换为replace_character，返回一个VARCHAR类型的新字符串。,**expr**,expr的值须为字符型或除JSON、LOB、XMLTYPE类型外的可转化为字符型的其他类型。,当expr的值为NULL时，函数返回NULL。,**search_character**,要进行替换的字符串，search_character为与expr相同的通用表达式，须为字符型或除JSON、LOB、XMLTYPE类型外的可转化为字符型的其他类型。,当search_character的值为NULL时，函数不执行任何替换。,**replace_character**,按此字符串的值进行替换，replace_character为与expr相同的通用表达式，须为字符型或除JSON、LOB、XMLTYPE类型外的可转化为字符型的其他类型。,- 当replace_character的值为NULL时，函数将删除expr中的search_character部分。
- 不指定replace_character时，默认替换值为NULL。
||
|RIGHT(str,len)|返回 str 中从最后侧开始检索的 len 个长度的字符串,入参任意一个为 NULL，则返回 NULL|RIGHT函数将  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的字符串从右边截取指定长度，得到一个子字符串并将其返回。,**expr**,expr的值须为字符型或可转换为字符型的其他类型（LOB、XMLTYPE类型支持隐式转换）。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr为NCLOB/NCHAR/NVARCHAR类型时，返回值为NVARCHAR。其余场景返回值为VARCHAR。
- 当expr的值为NULL时，函数返回NULL。
,**length**,指定字符串截取的长度，length为与expr相同的通用表达式，须为除BIT外数值型数据，或可转换为NUMBER类型的其他类型数据，取值范围[-2147483648,2147483647]。,- 当length的值为NULL，0或负数时，函数返回NULL。
- 当length值为小数时，函数将先对其进行取整，规则如下：
    - length为NUMBER型或者浮点型时：四舍五入取整。
    - length为可转换为NUMBER的其他类型时：截取整数部分。
- 若length值大于expr字符串长度，则将其按expr字符串长度值处理。
||
|RPAD(str, len, padstr)|用 padstr 右填充 len 个字符到 str，返回 str；,如果 str 长度大于 len，则返回 len 个字符的 str；,此函数多字节安全|RPAD从右边对  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的字符串进行指定字符、指定长度的填充，得到一个新字符串。,**expr**,expr的值须为字符型或可转换为字符型的其他类型（LOB、XMLTYPE类型支持隐式转换）。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr为NCLOB、NCHAR、NVARCHAR类型时，返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
,**pad_length**,指定填充后字符串的最终长度，pad_length为与expr相同的通用表达式，须为除BIT外数值型数据或可转换为NUMBER类型的其他类型数据，取值范围[-9223372036854775808,32000]。,- 当pad_length的值为NULL、0或负数时，函数返回NULL。
- 当pad_length的值为小数时，函数截断其小数位保留整数位。
- 当pad_length的值小于等于expr字符串长度时，其效果等同于对expr字符串进行截取，函数返回从左到右对expr按该长度进行截取的子字符串。
- 当pad_length的值大于expr字符串长度时，其效果才是对expr字符串进行填充。
,**pad_character**,指定要填充的内容，可省略。pad_character为与expr相同的通用表达式，须为字符型数据或可转换为字符型的其他类型数据（LOB、XMLTYPE类型支持隐式转换）。,- 省略pad_character时，默认填充空格。
- 指定pad_character时，函数将循环从左至右读取pad_character的字符并填充到expr的左边，直到满足pad_length的长度要求为止。
- 在向量化执行引擎中，pad_character不能为LOB类型的行外存储数据。
- 当pad_character的值为NULL时，函数返回NULL。
||
|RTRIM(str)|返回删除尾随空格的 str|RTRIM函数从右往左删除  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的字符串里与trim_character匹配的内容，得到一个新的子字符串。,**expr**,通用表达式，其值须为字符型或除NCLOB类型外的可转换为字符型的其他类型。,- 当expr为CLOB类型时，返回值为CLOB类型，当expr为NCHAR/NVARCHAR时，返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- 当expr的值为NULL时，函数返回NULL。
,**trim_character**,指定要匹配的内容，可省略。trim_character为与expr相同的通用表达式，须为字符型或可转换为字符型的其他类型。,- 省略trim_character时，默认的匹配内容为1个空格。
- 指定trim_character时，函数将会从左至右逐一对比expr与trim_character中的字符，若expr中的字符在trim_character中存在则在expr中将其删除，直到遇到首个不存在于trim_character中的字符时停止。若全部字符均被匹配删除，函数返回空字符串。
- 在向量化执行引擎中，trim_character不能为LOB类型的行外存储数据。
- 当trim_character的值为NULL时，函数返回NULL。
||
|TRIM([{BOTH | LEADING | TRAILING} [REMSTR] FROM ] str), TRIM([remstr FROM] STR)|返回删除所有前缀或者尾随 remstr 的字符串；如果不指定 BOTH,LEADING,TRAILING,则删除前缀和尾随空格；,此函数为多字节安全|TRIM函数用于删除源字符串  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的前缀或后缀，返回新的子字符串。,**LEADING|TRAILING|BOTH**,指定删除字符串的前缀|后缀|前后缀，可省略，默认为BOTH。,**trim_character**,指定前/后缀的内容，可省略，默认为1个空格。trim_character为与expr相同的通用表达式，其值须为字符型或可转换为字符型的其他类型，且长度只能为1字节。,当trim_character的值为NULL时，函数返回NULL。,**expr**,通用表达式，其值须为字符型或除NCLOB类型外的可转换为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- 当expr为CLOB类型时返回值为CLOB类型，当expr为NCHAR/NVARCHAR时返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
||


# 4.使用场景

各种使用函数的场景

# 5.测试关注

1.入参、出参参数校验

2.函数功能测试