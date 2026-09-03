Created by 唐嘉欣, last modified on 十一月 02, 2023

  [YDBRD-21444](https://jira.yasdb.com/browse/YDBRD-21444?src=confmacro)    -  支持 nls_numeric_characters功能和NLS_DATABASE_PARAMETERS视图  验收中

  [YDBRD-22118](https://jira.yasdb.com/browse/YDBRD-22118?src=confmacro)    -  支持 nls_numeric_characters功能  完成

#   [1. OverView（概述）](#1-overview概述)  

nls_numeric_characters参数是控制数值显示字符，用于指定数值显示格式，即指明使用空格，逗号，句号等字符作为分隔符。该参数一般可以通过alter session来设置。目前只支持设置'.,'和'. '，即只支持修改千分位符。

#   [2. Features（功能特性）](#2-features功能特性)  

##   [2.1 配置参数nls_numeric_characters](#21-配置参数nls-numeric-characters)  

###   [2.1.1 设置命令](#211-设置命令)  

```
alter system set nls_numeric_characters = '. ' scope = spfile;  -- oracle只能用spfile
alter session set nls_numeric_characters = '.,';

```

###   [2.1.2 千分位分隔符的影响效果](#212-千分位分隔符的影响效果)  

千分位分隔符不影响数值类型，以及数值字符串的插入跟显示，仅作用于带有fmt的to_char与to_number场景中。

对格式符fmt没有影响。

替换格式符'G'的对应字符。

##   [2.2 to_char支持修改千分位分隔符](#22-to-char支持修改千分位分隔符)  

```
alter session set nls_numeric_characters = '. ';

```

|语句|是否正确执行|结果|
|---|---|---|
|to_char(10000.12, '99G999D99')|成功|10 000.12|
|to_char(1000012, '99G999D99')|失败，整型长度超过|##########|
|to_char(100.12, '99G999D99')|成功|100.12|


##   [2.3 to_number实现千分位符](#23-to-number实现千分位符)  

|语句|是否正确执行|结果|
|---|---|---|
|to_number('1,234', '9,999')|成功|1234|
|to_number('1,,2,,,34.12', '9,,,,,,99,,9,,,99.99')|成功|1234.12|
|to_number('1234.1,2', '9999.9,9')|失败，因为千分位符不能在小数点分隔符后面||
|to_number('1,2,34.12', '9G9,99D99')|失败，因为'G'和','不能同时使用||
|to_number(',1234', '9,99999')|失败，因为',1234'不是to_char的合法输出，应该为'1234'||


##   [2.4 to_number支持修改千分位分隔符](#24-to-number支持修改千分位分隔符)  

```
alter session set nls_numeric_characters = '. ';

```

|语句|是否正确执行|显示|
|---|---|---|
|to_number('1,00012', '9G99999')|失败，因为千分位符已经被替换成空格||
|to_number('1 00012', '9G99999')|成功|100012|
|to_number('1 000.12', '9G99999')|失败，因为小数位数、千分位符位置不匹配||
|to_number('1 000.12', '9G999D99')|成功|1000.12|
|to_number('1 000', '9G999D')|成功|1000|
|to_number('1 000', '9G999')|成功|1000|
|to_number('1000', '9G999')|失败，因为'1000'不是to_char的合法输出，应该为'1 000'||
|to_number('1000', '9999G')|失败，G的匹配不能缺省||
|to_number('1 000', '9999')|失败，因为'1 000'不是to_char的合法输出，应该为'1000'||
|to_number('1 000   ', '9999')|失败，因为'1 000   '不是to_char的合法输出，应该为'1000'||
|to_number('1,000   .', '9999')|失败，因为'1,000   .'不是to_char的合法输出，应该为'1000.'||
|to_number('1,000. ', '9999')|失败，空格在千分位之前||
|to_number('1 00', '999')|失败，千分位位置未匹配||
|to_number('1 ', '999')|失败，千分位位置未匹配||


#   [3. Interfaces（接口）](#3-interfaces接口)  

```
// 可能需要修改的函数，需要新增对nlsParam的支持
static CodResult numberAsTextByFormat(const CodNumber* n, const CodText* format, const CodText* nlsParam, CodText* text, CodUint32 numwidth);
CodResult asciiNumberFromTextByFormat(const CodText* text, const CodText* format, const CodText* nlsParam, CodNumber* retNumber);

```

#   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 设置的时候只能包含两个字符（字节），第一个字符（字节）表示小数点分隔符，第二个字符（字节）表示千分位分隔符
1. 目前小数点分隔符只支持'.'，千分位只能为' '和','两种情况，即只有'. '和'.,'两种情况
1. 设置命令alter system set中，scope只支持spfile（写入配置文件，重启生效）
1. to_number千分位符有以下约束：


>   to_number的G对应千分位，D对应小数点，当有fmt时，严格根据设置项匹配；当D出现在最后时，匹配的字符串可以缺省；G在最后不能缺省    语句  是否正确执行  结果  to_number('123', '999D')  成功  123  to_number('123', '999G')  失败，'123'不是to_char的合法输出，应该是'123,'    to_number的fmt当没有出现G跟D时，小数点对应的分隔符只能在第一个字符串的最后出现一次，且不能出现在千分位分隔符之前；而千分位分隔符可以出现多次，但只有to_char的合法输出才能作为to_number的输入    语句  是否正确执行  结果  to_number('123.', '999')  成功  123  to_number('1.2,3', '9D9G9')  失败  to_number('123', '9,,,,,,,999')  成功  123  to_number('12,3', '99,99')  失败，'12,3'不是to_char的合法输出，应该是'1,23'  to_number('1,23', '999')  失败，'1,23'不是to_char的合法输出，应该是'123'  

#   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

##   [5.1 添加配置参数](#51-添加配置参数)  

- 新增nls_numeric_characters参数
- 添加set和get回调函数
- 修改numberAsTextByFormat和asciiNumberFromTextByFormat函数，新增对nlsparam入参的支持


##   [5.2 to_char/to_number](#52-to-charto-number)  

###   [5.2.1 修改数据结构](#521-修改数据结构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c1e8970c2af4f520962/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwODEsImV4cCI6MTc4MjMwOTg4MX0.dmQMJSzew7wPOlbf6ZwqVDMKTTrSE5DKlK3w0XU7_2M)

- 在DigitFmt结构体上新增decimalCharacter变量，用于记录decimal character的值，默认为'.'
- 新增groupSeparator变量，用于记录group separator的值，默认为','
- 当使用'.'和','格式符时，即使用默认的字符；当使用'D'和'G'格式符时，即使用设置的字符（若没设置则为默认字符）


###   [5.2.2 新增对nlsparam函数入参的解析函数](#522-新增对nlsparam函数入参的解析函数)  

- nlsparam入参为字符串数据，格式如下（空格可trim掉）


>   '[参数名1] = ''[参数设置1]'' [参数名2] = ''[参数设置2]'''    例如：'NLS_NUMERIC_CHARACTERS = ''ab'''  

###   [5.2.3 to_number实现千分位分隔符](#523-to-number实现千分位分隔符)  

- 根据千分位符的位置信息groupSeparatorMap，校验输入Text是否合法，若不合法则报错
- 移除所有千分位符，以便asciiTextAsNumber将Text转为Number


#   [6. Testcases（自测用例）](#6-testcases自测用例)  

#   [7. Document（资料）](#7-document资料)  

调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=133568351](https://conf.yasdb.com/pages/viewpage.action?pageId=133568351)  

Oracle文档（to_char）：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_CHAR-number.html#GUID-00DA076D-2468-41AB-A3AC-CC78DBA0D9CB](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_CHAR-number.html#GUID-00DA076D-2468-41AB-A3AC-CC78DBA0D9CB)  

Oracle文档（to_number）：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_NUMBER.html#GUID-D4807212-AFD7-48A7-9AED-BEC3E8809866](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_NUMBER.html#GUID-D4807212-AFD7-48A7-9AED-BEC3E8809866)  

Oracle文档（格式符）：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Format-Models.html#GUID-DFB23985-2943-4C6A-96DF-DF0F664CED96](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Format-Models.html#GUID-DFB23985-2943-4C6A-96DF-DF0F664CED96)  

#   [8. Workload（工作量）](#8-workload工作量)  

#   [9. TODO（遗留问题）](#9-todo遗留问题)  

  


## Attachments:

[image2023-10-24_16-38-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWU4OTcwYzJhZjRmNTIwOTYwIiwicmVmX2lkIjoiNjczOTZjMWQ3MjgyMDZlZmI5MmYwZGQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDgxLCJleHAiOjE3ODIzODU0ODF9.l9iMwv9mh3H0KdZnKi6uiNE7c-1QvXFpG_HkAD5u0Vg)

 (image/png)    


[image2023-10-24_16-50-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWVhMWFkOWEzMzExZGM4N2NlIiwicmVmX2lkIjoiNjczOTZjMWQ3MjgyMDZlZmI5MmYwZGQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDgxLCJleHAiOjE3ODIzODU0ODF9.a3Bl-QDNA8iV1bYPYlB8hcoXnYtrMdOxv1MRsnTWRzs)

 (image/png)    


[image2023-10-24_17-0-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWVhMWFkOWEzMzExZGM4N2NmIiwicmVmX2lkIjoiNjczOTZjMWQ3MjgyMDZlZmI5MmYwZGQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDgxLCJleHAiOjE3ODIzODU0ODF9.uNY-zA0YjDrqYILsoNKmW1i_h7TRNcebPYzXhqD5wtU)

 (image/png)    


[image2023-10-24_17-23-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWVhMWFkOWEzMzExZGM4N2QwIiwicmVmX2lkIjoiNjczOTZjMWQ3MjgyMDZlZmI5MmYwZGQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDgxLCJleHAiOjE3ODIzODU0ODF9.QB7-br5iG_OMdiqxVNYHlKXedjRldRcE5eWTWdgBfVc)

 (image/png)    


[image2023-10-24_19-36-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWVhMWFkOWEzMzExZGM4N2QxIiwicmVmX2lkIjoiNjczOTZjMWQ3MjgyMDZlZmI5MmYwZGQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDgxLCJleHAiOjE3ODIzODU0ODF9.MvMWt5YjHxpajUZw3thJOUhBhdxj0sYVwLuUWf2X3wg)

 (image/png)    


## Comments:

|  [](null)  ,Oracle中'G'和'.'不能共存，','和'D'不能共存，之前实现的千分位没有考虑到，是否需要在本次特性中修改？,Posted by tangjiaxin at 十月 24, 2023 17:13|
|---|
|  [](null)  ,设计评审纪要：,- 不需要实现的内容可以从设计文档上去掉，加上条件限制即可
- to_char/to_number的nlsparam参数不需要实现
- 小数点分隔符不能修改，不需要写在设计文档上
,Posted by tangjiaxin at 十月 27, 2023 11:05|
|  [](null)  ,to_char/to_number的nlsparam参数暂时不做，只通过alter session/system来设置配置参数,Posted by tangjiaxin at 十月 31, 2023 10:46|
|  [](null)  ,实现差异：,1. TO_NUMBER格式符0与oracle、列存做了对齐，原本to_number('.12', '0.99')正常输出，但是现在报错,2. TO_NUMBER千分位符与列存进行了对齐，与oracle存在差异，即to_number('1,2,34', '9,999')在oracle不报错，但是在anchorbase和crab都报错,Posted by tangjiaxin at 十一月 01, 2023 09:36|
|  [](null)  ,暂时不改,Posted by tangjiaxin at 十一月 01, 2023 09:48|
|  [](null)  ,测试问题：,1. alter session的权限与orale有差异，oracle只需create session权限，anchorbase需要alter session权限,Posted by tangjiaxin at 十一月 02, 2023 17:29|
