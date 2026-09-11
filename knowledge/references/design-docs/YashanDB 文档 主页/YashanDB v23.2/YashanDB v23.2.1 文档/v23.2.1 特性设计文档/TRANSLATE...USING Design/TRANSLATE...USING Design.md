Created by 唐嘉欣, last modified on 十一月 02, 2023

  [YDBRD-21635](https://jira.yasdb.com/browse/YDBRD-21635?src=confmacro)    -  支持TRANSLATE ... USING函数  完成

#   [1. OverView（概述）](#1-overview概述)  

将输入的字符串转换成用数据库字符集或国家字符集编码的字符串

USING CHAR_CS表示用数据库字符集编码，输出VARCHAR

USING NCHAR_CS表示用国家字符集编码，输出NVARCHAR

####   [语法图](#语法图)  

![](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/img/translate_using.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI)

#   [2. Features（功能特性）](#2-features功能特性)  

##   [2.1 支持的传入参数类型](#21-支持的传入参数类型)  

支持输入参数类型隐式转换，输出参数类型为VARCHAR或NVARCHAR

####   [oracle translate...using调研](#oracle-translateusing调研)  

|**oracle translate...using类型支持情况**|||||||||||||
|:---:|---|---|---|---|---|---|---|---|---|---|---|---|
|char|varchar2|nchar|nvarchar2|raw|long raw|long|number|float|int|smallint|decimal|binary_float|
|支持|支持|支持|支持|支持|不支持|不支持|支持|支持|支持|支持|支持|支持|
|**binary_double**|**date**|**timestamp**|**timestamp tz**|**timestamp ltz**|**interval ym**|**interval ds**|**clob**|**nclob**|**blob**|**bfile**|**rowid**|**urowid**|
|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|


####   [oracle中translate...using和to_char/to_nchar的区别](#oracle中translateusing和to-charto-nchar的区别)  

|**oracle to_char/to_nchar类型支持情况（与translate...using有区别）**|||||||||||||
|:---:|---|---|---|---|---|---|---|---|---|---|---|---|
|char|varchar2|nchar|nvarchar2|raw|long raw|long|number|float|int|smallint|decimal|binary_float|
|支持|支持|支持|支持|不支持|不支持|不支持|支持|支持|支持|支持|支持|支持|
|binary_double|date|timestamp|timestamp tz|timestamp ltz|interval ym|interval ds|clob|nclob|blob|bfile|rowid|urowid|
|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|不支持|不支持|


####   [anchorbase translate...using支持输入参数类型](#anchorbase-translateusing支持输入参数类型)  

|**anchorbase translate...using支持输入参数类型**||||||||||||
|:---:|---|---|---|---|---|---|---|---|---|---|---|
|char|varchar|nchar|nvarchar|tinyint|smallint|int|bigint|binary_float|binary_double|number|date|
|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|
|**shorttime**|**timestamp**|**interval ym**|**interval ds**|**bit**|**bool**|**rowid**|**clob**|**nclob**|**blob**|**raw**|**json**|
|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|支持|


##   [2.2 支持的传入参数（字符串）字符集](#22-支持的传入参数字符串字符集)  

- 当字符串的字符集与数据库字符集或nchar字符集相同时
- 当字符串的字符集与数据库字符集和nchar字符集都不同时


>   因为使用execVarConvertSafe函数进行字符集转换，原生支持了各个字符集的转换  

>   当字符串编码集与目标编码集相同时（char和char_cs、nchar和nchar_cs），不转换原样输出    当字符串编码集与目标编码集不同时（nchar和char_cs、char和nchar_cs），转换报错  

**Anchorbase与Oracle的差异：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c2aa1ad9a3311dc8817/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI)

![](https://pingcode.yasdb.com/atlas/files/public/67396c2a8970c2af4f5209a8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI)

oracle第一种情况也是直接输出内容，但是已经经过一次转换（非法字节转ef,bf,bd）

第二种情况，oracle遇到非法字节转ef,bf,bd，anchorbase遇到非法字符报错

#   [3. Interfaces（接口）](#3-interfaces接口)  

#   [4. Limitations（功能限制）](#4-limitations功能限制)  

- CHAR_CS/NCHAR_CS不支持绑定参数，在执行阶段之前无法知道具体参数是哪一个，这样就无法确定输出结果的类型。


#   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

##   [5.1 新增translate函数的参数parse方法](#51-新增translate函数的参数parse方法)  

- 新增CHAR_CS和NCHAR_CS关键字
- 修改translate函数（最小，最大）参数个数为(2, 3)


>   将CHAR_CS和NCHAR_CS添加到lexer的token中    parseExprUntilEx解析CHAR_CS/NCHAR_CS时（token_id），新建一个ExprNode作为传入参数，其值为常量字符串"CHAR_CS"和"NCHAR_CS"，执行阶段只需读取ExprNode的常量字符串即可判断目标字符集  

>   参数个数为2时，采用translate...using分支    参数个数为3时，采用一般translate分支  

##   [5.2 新增translate函数verify分支](#52-新增translate函数verify分支)  

分为参数个数为2和3两种情况

CHAR_CS情况，输出类型（node->desc.type）为VARCHAR

NCHAR_CS情况，输出类型（node->desc.type）为NVARCHAR

##   [5.3 新增translate函数conclude分支](#53-新增translate函数conclude分支)  

分为参数个数为2和3两种情况

输出类型同verify

##   [5.4 新增translate函数exec分支](#54-新增translate函数exec分支)  

分为参数个数为2和3两种情况

使用execVarConvertSafe函数进行字符集转换

#   [6. Testcases（自测用例）](#6-testcases自测用例)  

#   [7. Document（资料）](#7-document资料)  

调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=130139425](https://conf.yasdb.com/pages/viewpage.action?pageId=130139425)  

oracle translate...using文档：    [https://docs.oracle.com/en//database/oracle/oracle-database/23/sqlrf/TRANSLATE-USING.html#GUID-EC8DE4D2-4F24-456D-A2E7-AD8F82E3A148](https://docs.oracle.com/en//database/oracle/oracle-database/23/sqlrf/TRANSLATE-USING.html#GUID-EC8DE4D2-4F24-456D-A2E7-AD8F82E3A148)  

oracle to_char文档：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_CHAR-character.html#GUID-EC078E16-11FE-4ABE-AE05-DA9AC1B4BEBC](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_CHAR-character.html#GUID-EC078E16-11FE-4ABE-AE05-DA9AC1B4BEBC)  

oracle to_nchar文档：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_NCHAR-character.html#GUID-539E9F5C-CB47-4BCE-B468-C34CF6BABDC5](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_NCHAR-character.html#GUID-539E9F5C-CB47-4BCE-B468-C34CF6BABDC5)  

#   [8. Workload（工作量）](#8-workload工作量)  

#   [9. TODO（遗留问题）](#9-todo遗留问题)  

  


  


  


## Attachments:

[image2023-10-19_11-53-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmFhMWFkOWEzMzExZGM4ODBiIiwicmVmX2lkIjoiNjczOTZjMmE3MjgyMDZlZmI5MmYwZTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDU5LCJleHAiOjE3ODIzODU4NTl9.1WBSIjBO4mEST8mH4c0aggC0aWYe8GveJTaPwvGgiDQ)

 (image/png)    


[image2023-10-19_11-56-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmE4OTcwYzJhZjRmNTIwOTlkIiwicmVmX2lkIjoiNjczOTZjMmE3MjgyMDZlZmI5MmYwZTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDU5LCJleHAiOjE3ODIzODU4NTl9._zHJ7pH2LRcnxgjJmoQ2rq_tv6YCdmlZVFAyIowFt28)

 (image/png)    


[image2023-10-19_16-37-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmFhMWFkOWEzMzExZGM4ODEwIiwicmVmX2lkIjoiNjczOTZjMmE3MjgyMDZlZmI5MmYwZTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDU5LCJleHAiOjE3ODIzODU4NTl9.2Tvl6t8Uln9ZbskC-vckAsaKCymmtRfLDY5wpKE2K6w)

 (image/png)    


[image2023-10-19_17-15-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmFhMWFkOWEzMzExZGM4ODExIiwicmVmX2lkIjoiNjczOTZjMmE3MjgyMDZlZmI5MmYwZTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDU5LCJleHAiOjE3ODIzODU4NTl9.CvXY4fvCBHS0joYrk-kgaR5b-HSHtqfvNXQ3flxiYRg)

 (image/png)    


[image2023-10-19_17-17-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmE4OTcwYzJhZjRmNTIwOWE0IiwicmVmX2lkIjoiNjczOTZjMmE3MjgyMDZlZmI5MmYwZTgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDU5LCJleHAiOjE3ODIzODU4NTl9.n_kzTDuagjaqBHjD8y_ukw7ep5JSTTKbVKAx4SvZtzg)

 (image/png)    


## Comments:

|  [](null)  ,需要注意的点,1.输入参数有误时，错误码、报错信息改变,![](https://pingcode.yasdb.com/atlas/files/public/67396c2a8970c2af4f5209a9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI),![](https://pingcode.yasdb.com/atlas/files/public/67396c2a8970c2af4f5209ab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI),2.新增token，需要刷用例,![](https://pingcode.yasdb.com/atlas/files/public/67396c2b8970c2af4f5209ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI),Posted by tangjiaxin at 十月 19, 2023 11:58|
|---|
|  [](null)  ,create table test_xxx (data varchar2(4));,create view v_xxx as select translate(data using char_cs) translate from test_xxx;,desc v_xxx;,Anchorbase：拉满,![](https://pingcode.yasdb.com/atlas/files/public/67396c2b8970c2af4f5209ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI),Oracle：5倍,![](https://pingcode.yasdb.com/atlas/files/public/67396c2b8970c2af4f5209af/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQWdBQUFBQUFBQVFBQkFJQUFBQUFJQUFBQUJBQUVBQUNBQUFBSUFBQUFBQVRnQUFRQUFBQUFBQUFBQUJBQUFBQUFFQUFBQUFBQUFBQUFBRUFBSUFBQUFJQUFBQUFBQWdBZ0FBQUFCQUFBQUFnQUFBUUFDQUFBQUFBQUFBQUFBQUFLQUZBQUFBQUFBQUFBQUFBQUFFQUJBQUlBQUFBQUFBQUNCQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0NTksImV4cCI6MTc4MjMxMDI1OX0.Vc4J67Us4QRYAAeWNNLHQXYpgNjjlcSIuCX1RZHxxeI),Posted by tangjiaxin at 十月 24, 2023 14:50|
|  [](null)  ,4个问题（不同字符集报错、CHAR_CS/NCHAR_CS不支持绑定参数、parse报错信息变更、默认输出字符串长度与oracle不一致）抄送，找SE对一下,Posted by tangjiaxin at 十月 24, 2023 15:12|
|  [](null)  ,转换不能超过32000，超过则报错,Posted by tangjiaxin at 十一月 02, 2023 15:56|
