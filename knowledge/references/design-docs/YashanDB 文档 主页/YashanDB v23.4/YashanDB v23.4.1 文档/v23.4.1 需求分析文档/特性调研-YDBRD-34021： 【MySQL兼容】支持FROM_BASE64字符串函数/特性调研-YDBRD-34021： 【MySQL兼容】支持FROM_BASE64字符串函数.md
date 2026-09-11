Created by 邓秋怡, last modified on 十一月 08, 2024

  


#   [YDBRD-34021： 支持FROM_BASE64字符串函数](#ydbrd-34021-支持from-base64字符串函数)  

IR链接：    [YASHAN-3047](https://pingcode.yasdb.com/ship/ideas/66b06f9a5808037af126228c?#YASHAN-3047)      
  SR链接：    [YDBRD-34021](https://pingcode.yasdb.com/pjm/items/670c82d2e489dd0868f6c366?#YDBRD-34021)  

#   [1. Overview（概述）](#1-overview概述)  

  [MYSQL 5.7 FROM_BASE64函数文档](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html#function_from-base64)  

函数的语法、功能调研基于MYSQL 5.7。

#   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|FROM_BASE64|解码 base64 编码字符串并返回结果|


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

##   [2.1 FROM_BASE64](#21-from-base64)  

###   [2.1.1 功能点1：语法](#211-功能点1语法)  

FROM_BASE64(str)：

- 接收用 TO_BASE64() 使用的 base-64 编码规则编码的字符串，并以二进制字符串的形式返回解码结果。如果参数为 NULL 或不是有效的 base-64 字符串，则结果为 NULL。有关编码和解码规则的详细信息，请参阅 TO_BASE64() 的说明。


###   [2.1.2 功能点2：参数规格](#212-功能点2参数规格)  

|参数|参数类型|参数说明|
|---|---|---|
|str|字符串类型|base64 编码的字符串|


###   [2.1.3 需求详细描述](#213-需求详细描述)  

- 如果在 mysql 客户端中调用 FROM_BASE64()，二进制字符串将使用十六进制符号显示，具体取决于 --binary-as-hex 的值。
- 编码及解码规则如下  
-- 字母值 62 的编码为 “+”。
-- 字母值 63 的编码为“/”。
-- 编码输出由 4 个可打印字符组成。输入数据的每 3 个字节使用 4 个字符编码。如果最后一组字符不完整，则用“=”字符填充，长度为 4。
-- 编码输出每 76 个字符后加一个换行符，以便将长输出分成多行。
-- 解码可识别并忽略换行、回车、制表符和空格。
- 0-63对应ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/
- mysql_function里面多一行
- 返回值类型由返回值长度确定：入参字符个数*3/4=返回值字符个数，返回值字符个数*3=返回值字节数。


![image.png](https://pingcode.yasdb.com/atlas/files/public/6746db638970c2af4f53b920/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUxODEsImV4cCI6MTc4MjQ2NTk4MX0.9KuU3kgRqRj8_vsUyZWNG7av7KWyh29bIMK9c8vVCuo)

返回值类型具体如下：



##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*返回类型是否要根据长度变化。*