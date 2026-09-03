# 1.概述

  [https://pingcode.yasdb.com/pjm/items/670e3cb2e489dd0868f7e606?](https://pingcode.yasdb.com/pjm/items/670e3cb2e489dd0868f7e606?)  

#YDBRD-34249 【mysql兼容】兼容与MYSQL同名字符串查找函数规格

FIND_IN_SET()、INSTR()、POSITION()、SUBSTR()、SUBSTRING()、SUBSTRING_INDEX()

# 2.函数

参考：  [https://dev.mysql.com/doc/refman/5.7/en/string-functions.html](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html)  



|函数名称|MYSQL|YASHAN|规格说明|
|---|---|---|---|
|FIND_IN_SET(str,strList)|返回 strList 中 str 的索引位置，值为 1~N；,如果 str 不在 strList 中，返回0；,如果入参存在 NULL，则返回 NULL,如果 str 参数包括","，报错|FIND_IN_SET函数用于查找  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的字符串在字符串列表strlist中首次出现的位置，函数返回值为INT类型。,本函数遵循如下规则：,- 对大小写不敏感。
- 位置从1开始计数，如果strlist中不存在expr则返回0。
- strlist字符串列表是由','分割的子串组成的字符串。基于此规则，当expr中包含','时，函数将不能保证返回结果的正确性。
,**expr、strlist**,- 在行式计算中，expr和strlist的值不能为RAW类型。
- 在向量化计算中，expr和strlist的值不能为布尔型和RAW类型。
- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- expr不能为超过32000字节的XMLTYPE、LOB类型数据。
- 当expr或strlist中任一值为NULL时，函数返回NULL。
||
|INSTR(str,substr)|与 POSITION 函数的参数顺序相反,返回 str 中 substr 第一次出现的位置；,如果 str 中不存在 substr，返回 0 ；,如果入参存在 NULL，则返回 NULL|INSTR函数从源字符串  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的第position位开始查找目标字符串sub_character，返回第occurrence次出现sub_character的位置值，返回值为BIGINT类型。未查找到则返回0。,**expr、sub_character**,expr指定源字符串，sub_character指定目标字符串，二者均为通用表达式，其值均须为字符型或除JSON、LOB、XMLTYPE类型外的可转化为字符型的其他类型。,- 当expr的值为NULL时，函数返回NULL。
- 当sub_character的值为NULL时，函数返回NULL。
- 当expr的值为empty_clob()时，如果sub_character是NULL或者隐式转换为字符串以后是NULL则函数返回NULL，否则函数返回0。
- 当expr的值为empty_blob()时，函数返回NULL。
,**position**,指定开始查找的偏移量（即起始位置），可省略，默认为1。position为与expr相同的通用表达式，须为数值型数据或可转换为NUMBER类型的其他类型数据。,- position的值应为整数或可被转换为整数，取值范围为[-9223372036854775808,9223372036854775807]。正整数表示从前往后自起始位置开始查找，负整数表示从后向前自起始位置开始查找。
    - 当position的值为带有小数的NUMBER类型时，函数截断其小数位保留整数位。
    - 当position的值为浮点类型时，函数将其奇进偶舍至整数。
- 当position的值为0时，函数不执行查找并返回0。
- 当position为NULL时，函数返回NULL。
,**occurence**,指定返回子字符串在expr中出现的第occurence次的位置，可省略，默认为1。occurrence为与expr相同的通用表达式，其值须为数值型数据或可转换为NUMBER类型的其他类型数据。,- occurence的值必须为正整数或可被转换为正整数，取值范围为[1,9223372036854775807]。
    - 当occurence的值为带有小数的NUMBER类型时，函数截断其小数位保留整数位。
    - 当occurence的值为浮点类型时，函数将其奇进偶舍至整数。
- 当occurence的值为NULL时，函数返回NULL。
||
|POSITION(substr,str),POSITION(substr IN str)|与 locate 参数是同义词；,返回 str 中 substr 第一次出现的位置；,带 pos 的函数，指从 pos 位置开始；,如果 str 中不存在 substr，返回 0 ；,如果入参存在 NULL，则返回 NULL,|POSITION函数在一个  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  2表示的字符串中从左向右查找  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  1表示的字符串，返回expr1第一次出现的位置，该结果为一个BIGINT类型的数字。若没有查找到匹配值，函数返回0。,- expr1、expr2的值须为字符型或除JSON、LOB、XMLTYPE类型外的可转化为字符型的其他类型。
- 当expr1或expr2中任一值为NULL时，函数返回NULL。
||
|SUBSTR(str,pos),SUBSTR(str from pos),SUBSTR(str,pos,len),SUBSTR(str from pos for len)|从 pos 开始返回 str 的子串,带参数 len，从 posc 位置开始返回 str 的子串，子串长度为 len,pos 为正整数时，从左往右索引,pos 为负整数时，从右往左索引,len 值小于 1 ，返回空串,此函数多字节安全|SUBSTR函数用于在源字符串  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的pos位置提取长度为len的子字符串。,**expr**,通用表达式，其值须为字符型或除XMLTYPE类型外的可转换为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- 当expr的值为CLOB/NCLOB类型时返回值与expr的值类型相同，当expr的值为NCHAR/NVARCHAR类型时返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
,**pos**,表示从pos值指定位置开始提取字符串，pos为与expr相同的通用表达式，须为除BIT外数值型数据或可转换为NUMBER的其他类型数据，取值范围为[-2147483648,2147483647]。值为正数表示从字符串的头部开始确定起始位置，值为负数从字符串的尾部开始确定起始位置。,- 当pos的值为带有小数的NUMBER类型（或转换后为NUMBER类型）时，函数截断其小数位保留整数位。
- 当pos的值为浮点类型时，函数将其奇进偶舍取整。
- 当pos值为0时，等同于1。
- 当pos绝对值超过字符串的长度时，函数返回NULL。
- 当pos的值为NULL时，函数返回NULL。
,**len**,表示提取len值指定长度的字符串，可省略。len为与expr相同的通用表达式，须为除BIT外数值型数据或可转换为NUMBER的其他类型数据，取值范围为[-2147483648,2147483647]。,- 当len的值为带有小数的NUMBER类型（或转换后为NUMBER类型）时，函数截断其小数位保留整数位。
- 当len的值为浮点类型时，函数将其奇进偶舍取整。
- 当不指定len，或len的值大于从pos值指定位置至源字符串末尾的长度时，函数返回从pos值指定位置开始至源字符串末尾的子字符串。
- 当len的值为0或负数时，函数返回NULL。
- 当len的值为NULL时，函数返回NULL。
||
|SUBSTRING()|与 substr 函数是同义词|SUBSTRING函数用于在源字符串  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的指定位置提取指定长度的子字符串。,**expr**,通用表达式，其值须为字符型或除XMLTYPE类型外的可转换为字符型的其他类型。,- 在向量化执行引擎中，expr不能为LOB类型的行外存储数据。
- 当expr的值为CLOB/NCLOB类型时返回值与expr的值类型相同，当expr的值为NCHAR/NVARCHAR类型时返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
,**pos**,表示从pos值指定位置开始提取字符串，pos为与expr相同的通用表达式，须为除BIT外数值型数据或可转换为NUMBER的其他类型数据，取值范围为[-2147483648,2147483647]。值为正数表示从字符串的头部开始确定起始位置，值为负数从字符串的尾部开始确定起始位置。,- 当pos的值为带有小数的NUMBER类型（或转换后为NUMBER类型）时，函数将其四舍五入取整。
- 当pos的值为浮点类型时，函数将其奇进偶舍取整。
- 当pos的值等于0或其绝对值超过字符串的长度时，函数返回NULL。
- 当pos的值为NULL时，函数返回NULL。
,**len**,表示提取len值指定长度的字符串，可省略。len为与expr相同的通用表达式，须为除BIT外数值型数据或可转换为NUMBER的其他类型数据，取值范围为[-2147483648,2147483647]。,- 当len的值为带有小数的NUMBER类型（或转换后为NUMBER类型）时，函数将其四舍五入取整。
- 当len的值为浮点类型时，函数将其奇进偶舍取整。
- 当不指定len，或len的值大于从pos值指定位置至源字符串末尾的长度时，函数返回从pos值指定位置开始至源字符串末尾的子字符串。
- 当len的值为0或负数时， 函数返回NULL。
- 当len的值为NULL时，函数返回NULL。
||
|SUBSTRING_INDEX(str, delim,count)|返回 delim 出现 count 次数之前的字串,count 为正数时，从左往右索引,count 为负数时，从右往左索引,count 为小数时，四舍五入|SUBSTRING_INDEX函数用于在源字符串  [expr](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  中提取分隔符delim出现第count次前的子字符串。,**expr**,通用表达式，其值须为字符型或除JSON、LOB、XMLTYPE类型外的可转化为字符型的其他类型。,- 当expr为NCHAR/NVARCHAR类型时返回值为NVARCHAR类型，其余场景返回值为VARCHAR类型。
- 当expr的值为NULL时，函数返回NULL。
,**delim**,分隔符，用于分割源字符串expr。delim为与expr相同的通用表达式，须为字符型数据或除JSON、LOB、XMLTYPE类型外的可转化为字符型的其他类型数据。,- 若使用非字符型的形式输入  `(0,1)`  之间的小数，转换后的delim将去除小数点前的0进行匹配。
- 当delim在expr中未匹配到时，函数将返回expr全部内容。
- 当delim的值为NULL时，函数返回NULL。
,**count**,表示分隔符出现的次数，用于定位分割的终止位置。count为与expr相同的通用表达式，须为除BIT外数值型数据或可转换为NUMBER的其他类型数据，取值范围为[-2147483648,2147483647]。值为正数表示返回分隔符第count次出现时左侧的所有内容（从左侧开始计数），值为负数表示返回分隔符第count次出现时右侧的所有内容（从右侧开始计数）。,- 当count的值为带有小数的NUMBER类型时，函数将其四舍五入取整。
- 当count的值为浮点类型时，函数将其奇进偶舍取整。
- 当count的值超出delim在expr中的出现次数时，函数将返回expr全部内容。
- 当count的值为NULL或0时，函数返回NULL。
|1、count 参数为非数值类型时，mysql 返回 null，并告警，yashandb 报错|


# 4.使用场景

各种使用函数的场景

# 5.测试关注

1.入参、出参参数校验

2.函数功能测试