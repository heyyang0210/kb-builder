Created by 邓秋怡, last modified on 十一月 15, 2024

  


#   [YDBRD-34018：兼容LCASE等字符串函数](#ydbrd-34018兼容lcase等字符串函数)  

IR链接：    [YASHAN-3047](https://pingcode.yasdb.com/ship/ideas/66b06f9a5808037af126228c?#YASHAN-3047)      
  SR链接：    [YDBRD-34018](https://pingcode.yasdb.com/pjm/items/670c7f80e489dd0868f6c117?#YDBRD-34018)  

#   [1. Overview（概述）](#1-overview概述)  

  [MYSQL 5.7 LCASE函数文档](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html#function_lcase)  

  [MYSQL 5.7 LOCATE函数文档](https://dev.mysql.com/doc/refman/5.7/en/json-search-functions.html#function_json-extract)  

  [MYSQL 5.7 UCASE函数文档](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html#function_load-file)  

函数的语法、功能调研基于MYSQL 5.7。

#   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|LCASE|LCASE() 是 LOWER() 的同义词。将字符串 str 的所有字符改为小写。|
|UCASE|UCASE() 是 UPPER() 的同义词。将字符串 str 的所有字符改为大写。|
|LOCATE|LOCATE返回子串在字符串中出现的位置。|


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

##   [2.1 LCASE](#21-lcase)  

###   [2.1.1 功能点1：语法](#211-功能点1语法)  

LCASE(str)

UCASE(str)

LOCATE(substr,str)、LOCATE(substr,str,pos)

###   [2.1.2 功能点2：参数规格](#212-功能点2参数规格)  

LCASE(str)/UCASE(str)

|参数|参数类型|参数说明|
|---|---|---|
|str|可以转换为字符串的类型||


LOCATE(substr,str)、LOCATE(substr,str,pos)：

|参数|参数类型|参数说明|
|---|---|---|
|substr|可以转换为字符串的类型||
|str|可以转换为字符串的类型||
|pos|可以转换为数值的类型||


###   [2.1.3 需求详细描述](#213-需求详细描述)  

#### 

LCASE(str)：

- LCASE() 是 LOWER() 的同义词。在存储视图定义时，视图中使用的 LCASE() 会被改写为 LOWER()。根据当前字符集映射，将字符串 str 的所有字符改为小写。默认值为 latin1（cp1252 西欧字符集）。
- LOWER()和 UPPER()对二进制字符串（BINARY、VARBINARY、BLOB）无效。要对二进制字符串进行字母大小写转换，首先要使用与字符串中存储的数据相适应的字符集将其转换为非二进制字符串。
- ![image.png](https://pingcode.yasdb.com/atlas/files/public/67467652a1ad9a3311de3789/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBRkFBRUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUxMjEsImV4cCI6MTc4MjQ2NTkyMX0.xqE21hmGlg5dwfM-J0UIgWoKXEG_gGmn085nRjnYINc)
- 对于 Unicode 字符集的校对，LOWER() 和 UPPER() 根据校对名称中的 Unicode 校对算法（UCA）版本（如果有）工作，如果没有指定版本，则根据 UCA 4.0.0 工作。例如，utf8_unicode_520_ci 根据 UCA 5.2.0 工作，而 utf8_unicode_ci 则根据 UCA 4.0.0 工作。 参见第 10.10.1 节 “Unicode 字符集”。
- 该函数是多字节安全函数。
- 在 MySQL 以前的版本中，视图中使用的 LOWER() 在存储视图定义时被改写为 LCASE()。在 MySQL 5.7 中，在这种情况下 LOWER() 不会被重写，但视图中使用的 LCASE() 会被重写为 LOWER()。(错误 #12844279）




UCASE(str)：

- 根据当前字符集映射，将字符串 str 的所有字符改为大写。默认值为 latin1（cp1252 西欧字符集）。
- 有关同样适用于 UPPER() 的信息，请参见 LOWER() 的说明。其中包括如何对二进制字符串（BINARY、VARBINARY、BLOB）进行字母大小写转换（这些函数对二进制字符串无效）的信息，以及有关 Unicode 字符集大小写折叠的信息
- 该函数是多字节安全函数。
- 在以前的 MySQL 版本中，视图中使用的 UPPER() 在存储视图定义时被改写为 UCASE()。在 MySQL 5.7 中，在这种情况下 UPPER() 不会被重写，但在视图中使用的 UCASE() 会被重写为 UPPER()。(错误 #12844279)




LOCATE(substr,str)、LOCATE(substr,str,pos)：

- 第一种语法返回子串 substr 在字符串 str 中首次出现的位置。第二种语法从位置 pos 开始，返回子串 substr 在字符串 str 中第一次出现的位置。如果子串 substr 不在字符串 str 中，则返回 0。如果任何参数为 NULL，则返回 NULL。
- 此函数是多字节安全函数，只有当至少一个参数是二进制字符串时才区分大小写，默认不区分。
- ![image.png](https://pingcode.yasdb.com/atlas/files/public/67467d548970c2af4f53b8ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBRkFBRUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUxMjEsImV4cCI6MTc4MjQ2NTkyMX0.xqE21hmGlg5dwfM-J0UIgWoKXEG_gGmn085nRjnYINc)


##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*