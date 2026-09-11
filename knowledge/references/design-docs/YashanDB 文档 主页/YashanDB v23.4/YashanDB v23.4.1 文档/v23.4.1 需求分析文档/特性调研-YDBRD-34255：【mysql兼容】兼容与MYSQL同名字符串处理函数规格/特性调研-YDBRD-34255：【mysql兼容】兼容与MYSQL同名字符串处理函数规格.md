

IR链接：  [https://pingcode.yasdb.com/ship/ideas/66c5b23b4283cf23d4f37342?](https://pingcode.yasdb.com/ship/ideas/66c5b23b4283cf23d4f37342?)  #YASHAN-3122  【mysql兼容】兼容与MYSQL同名函数规格  
SR链接：  [https://pingcode.yasdb.com/pjm/items/670e3eb9e489dd0868f7e7c9?](https://pingcode.yasdb.com/pjm/items/670e3eb9e489dd0868f7e7c9?)  #YDBRD-34255 【mysql兼容】兼容与MYSQL同名字符串处理函数规格

#   [1. Overview（概述）](#1-overview概述)  

函数的语法、功能调研基于MYSQL 5.7。

#   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|LPAD()|用指定的字符串左填充|
|REPLACE()|替换指定字符串|
|RIGHT()|返回指定的最右边的字符数|
|RPAD()|用指定的字符串右填充|
|LTRIM()|删除前导空格|
|RTRIM()|删除尾随空格|
|TRIM()|删除前导空格和尾随空格|


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

##   [2.1 LPAD/RPAD](#21-lcase)  

###   [2.1.1 功能点1：语法](#211-功能点1语法)  

LPAD(str,len,padstr)。返回字符串 str，并用字符串 padstr 左填充到 len 字符长度。如果字符串长度大于 len，返回值将缩短为 len 字符。任何参数为NULL则返回NULL。

###   [2.1.2 功能点2：参数规格](#212-功能点2参数规格)  

|参数|参数类型|参数说明|
|---|---|---|
|str、padstr|能转换成字符类型或二进制类型的所有类型|无|
|len|数值类型|**字符**  长度，最大max_allowed_packet|


###   [2.1.3 需求详细描述](#213-需求详细描述)  

### 返回值类型

由第二个参数len决定。

|参数len||返回类型||
|---|---|---|---|
|字面量|0|char0 binary0|返回类型是否是二进制类型取决于str和padstr中是否存在二进制类型（其中bit类型作为二进制类型处理）|
||1-255|varcharN varbinaryN||
||256及以上|text大类 blob||
|非字面量如表列|表列|longtext longblob||


### 返回值数据

最大长度限制：max_allowed_packet

输入len非整数：四舍五入

|入参|返回值|
|---|---|
|存在Null|Null|
|len为负数|Null|
|||


##   [2.2 REPLACE](#22-json-extract)  

###   [2.2.1 语法](#221-功能点1语法)  

REPLACE(str,from_str,to_str)

返回字符串 str，并用字符串 to_str 替换所有出现的字符串 from_str。REPLACE() 在搜索 from_str 时执行  **大小写敏感**  匹配。任何参数为NULL则返回NULL。

###   [2.2.2 参数规格](#222-功能点2参数规格)  

|参数|参数类型|参数格式|
|---|---|---|
|str、from_str、to_str|能转换成字符类型或二进制类型的所有类型|无|


###   [2.2.3 需求详细描述](#223-需求详细描述)  

1、匹配时大小写敏感，即使给表列设置了collate。

![image.png](https://pingcode.yasdb.com/atlas/files/public/67862518a1ad9a3311de69c6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)

2、返回值类型

三个参数中存在二进制类型则返回二进制类型，否则返回字符类型。

3、返回值长度

str_len/from_str_len*to_str_len。

非表列参数时严格遵循。表列参数mysql存在推导长度不够大导致执行失败的场景。

![image.png](https://pingcode.yasdb.com/atlas/files/public/678df3eca1ad9a3311de6e8e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)

![image.png](https://pingcode.yasdb.com/atlas/files/public/678df3dda1ad9a3311de6e8d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)

4.第二个参数长度为0的空串时，返回第一个参数

![image.png](https://pingcode.yasdb.com/atlas/files/public/678f1636a1ad9a3311de6f55/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)

##   [2.3 RIGHT](#23-load-file)  

###   [2.3.1 语法](#231-功能点1语法)  

RIGHT(str,len);

返回字符串 str 最右边的 len 字符，如果任何参数为 NULL，则返回 NULL。

###   [2.3.2 参数](#232-功能点2参数)  

|参数|参数类型|参数格式|
|---|---|---|
|str|能转换成字符类型或二进制类型的所有类型||
|len|数值类型|最大18446744073709551615(uint64)|


###   [2.3.3 ](#233-功能点3使用场景)    [需求详细描述](#223-需求详细描述)  

### 返回类型：

根据第二个参数len决定

|参数str|参数len||返回类型||
|---|---|---|---|---|
|字面量|字面量|0|char0 binary0|返回类型是否是二进制类型取决于str是否为二进制类型（其中bit类型作为二进制类型处理）,![image.png](https://pingcode.yasdb.com/atlas/files/public/67871deaa1ad9a3311de6aad/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)|
|||1-255|varcharN varbinaryN||
|||256及以上|text大类 blob||
||非字面量如表列|表列|返回str转换为字符串或二进制类型后的具体类型|![image.png](https://pingcode.yasdb.com/atlas/files/public/67871aa9a1ad9a3311de6a9d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)|
|非字面量|字面量||返回str类型+min(len,length(str))|![image.png](https://pingcode.yasdb.com/atlas/files/public/67871bc2a1ad9a3311de6aa4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)|
||非字面量||返回str类型转换成字符类型或二进制类型以后的类型|![image.png](https://pingcode.yasdb.com/atlas/files/public/67871c9fa1ad9a3311de6aa6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)|
||||||
||||||


### 

##   [2.4 LTRIM/RTRIM/TRIM](#21-lcase)  

###   [2.4.1 功能点1：语法](#211-功能点1语法)  

LTRIM(str)。返回去掉左边空格字符后的字符串 str。如果 str 为空，则返回 NULL。

RTRIM(str)。返回去掉右边空格字符后的字符串 str。如果 str 为空，则返回 NULL。

TRIM([{BOTH | LEADING | TRAILING} [remstr] FROM] str), TRIM([remstr FROM] str)。返回去掉左右两边指定字符串后的str，如果str为空，则返回NULL。

###   [2.4.2 功能点2：参数规格](#212-功能点2参数规格)  

|参数|参数类型|参数说明|
|---|---|---|
|str|能转换成字符类型或二进制类型的所有类型|无|


###   [2.4.3 需求详细描述](#213-需求详细描述)  

### 返回值类型

返回类型：bianry(0) varbinary blob  /char(0) varchar text。根据原入参转换成字符类型或者二进制类型后的类型决定。

![image.png](https://pingcode.yasdb.com/atlas/files/public/678df709a1ad9a3311de6e9c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUJBRUFBZ0FBQWdBQUFBQUFDQUFJQUNBQUFBQUFBQkFBQUFBQWdDQUFJSUFBSUFBQUFFQUFJQUFBQ0FBQVFBQUdBQUFBQ0FBQ0FBQ0lBQVFBaUFBZ0FDQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFDQURBQUFBQkFBQUFBQUJRQVJBQUFBQUFBQUFnQkFBQUFBQUFBQ0FBQUJBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMTYsImV4cCI6MTc4MjQ2NzAxNn0.Smuibxo8SKq0vEy12rr_bQDBo0zK_d5YQQUnUJUuxks)

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*