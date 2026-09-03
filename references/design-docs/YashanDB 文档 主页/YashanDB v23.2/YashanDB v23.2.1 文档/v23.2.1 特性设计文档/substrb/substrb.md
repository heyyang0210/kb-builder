Created by 袁昊坤 on 十月 24, 2023

#   [YDBRD-18933: substrb](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [Design](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [(substrb](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)      [方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：    [YDBRD-18933](https://jira.yasdb.com/browse/YDBRD-18933?src=confmacro)    -  支持SUBSTRB函数  完成

MR链接：    [feat:YDBRD-18933 支持SUBSTRB函数 master (!26502) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/26502)  

  


##   [1. Overview（概述）](#1-overview概述)  

SR描述：支持SUBSTRB函数，代表返回对应字节长度的字符串。

规格范围：单机，集群。

##   [2. Features（功能特性）](#2-features功能特性)  

substrb(str,positioln,length);

substrb函数()主要功能为，按照字节长度，对指定字符串str，从position开始进行截取，截取length个字节，最终返回，如果截取在汉字中间，则视为错误字节，按错误字节个数补对应空格。

![](https://pingcode.yasdb.com/atlas/files/public/67396c278970c2af4f52098b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0MTAsImV4cCI6MTc4MjMxMDIxMH0.It7NpELJ08yvxl3S5KXK0CSMgi9PjlJF5yCIM7LPmZ0)

###   [2.1 函数参数](#21-函数参数)  

####   [参数1：str 原字符串，需要是字符型或者可以隐式转换为字符型的表达式，不支持NCLOB。](#参数1str-原字符串需要是字符型或者可以隐式转换为字符型的表达式不支持nclob)  

汉字：若读取的3个字节不是完整的汉字，非完整汉字部分用空格进行显示。例如：select substrb('中abc', 2, 3) from dual; 返回：’  a‘ (a前有两个空格)。

- 支持字符类型的表达式。
- 支持可隐式转换为字符型的表达式。


详细类型支持情况见下表：

|char|nchar|varchar|nvarchar|int|number|binary_float|binary_double|smallint|date|timestamp|INTERVAL YEAR TO MONTH|INTERVAL DAY TO SECOND|RAW|CLOB|BLOB|NCLOB|BOOLEAN|JSON|BIT|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|√（汉字占3个字节，不足3个字节，不截取）|√|√（汉字占个字节，不足3个字节，不截取）|√|√|√|√|√|√（输出与数据库日期格式设置有关）|√（输出与数据库日期格式设置有关））|√|√|√|√|√|√|×|√|√|√|


####   [参数2.position 提取子串的起始位置（以1为基），可为数值类型或可转换为数值类型的字符类型。转换后的数值类型范围为-2147483648~2147483647，否则value is larger than INTEGER allowed](#参数2position-提取子串的起始位置以1为基可为数值类型或可转换为数值类型的字符类型转换后的数值类型范围为-21474836482147483647否则value-is-larger-than-integer-allowed)  

- 浮点类型（float和double）舍入和截断规则不同，number类型截断，浮点类型奇进偶舍。
- 超过str长度，返回null；
- 若pos为负数时，为倒序的起始位置；
- 若pos为0时，按照第1个字节为起始位置。


详细类型支持情况见下表：

|char|nchar|varchar|nvarchar|int|number|binary_float|binary_double|smallint|date|timestamp|INTERVAL YEAR TO MONTH|INTERVAL DAY TO SECOND|RAW|CLOB|BLOB|NCLOB|BOOLEAN|JSON|BIT|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|√（支持可转数值的字符串）|√|√（支持可转数值的字符串）|√|√|√|√|√|√|×|×|×|×|×|×|×|×|×|×|×|


####   [参数3.length 提取子串的长度，可为数值类型或可转换为数值类型的字符类型。转换后的数值类型范围为-2147483648~2147483647，否则value is larger than INTEGER allowed](#参数3length-提取子串的长度可为数值类型或可转换为数值类型的字符类型转换后的数值类型范围为-21474836482147483647否则value-is-larger-than-integer-allowed)  

- 浮点类型（float和double）舍入和截断规则不同，number类型截断，浮点类型奇进偶舍。
- 超过integer的最大值，报错。
- 若length<=0，返回null；
- 若length值大于从position值指定位置到str结尾的长度，或缺省length参数时，函数返回从position指定位置至str结尾的所有字节；


详细类型支持情况见下表：

|char|nchar|varchar|nvarchar|int|number|binary_float|binary_double|smallint|date|timestamp|INTERVAL YEAR TO MONTH|INTERVAL DAY TO SECOND|RAW|CLOB|BLOB|NCLOB|BOOLEAN|JSON|BIT|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|√（支持可转数值的字符串）|√|√（支持可转数值的字符串）|√|√|√|√|√|√|×|×|×|×|×|×|×|×|×|×|×|


###   [2.2 函数返回值](#22-函数返回值)  

第一个参数str为raw，nchar，nvarchar类型返回raw，nchar，nvarchar类型，其余返回值为varchar类型；

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
bifVerifySubstrb(AnlVerifier* vrfr, ExprNode* node)

bifExecSubstrb(AnlStmt* stmt, ExprNode* func, Variant* retValue)


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 函数第一个参数必须为字符串类型，或可转换为字符串的其它类型。不支持NCLOB。
- 函数入参至少为2个，至多为3个。
- 输出的内容除raw类型外全部转换成字符串形式。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

verify阶段：

- 判断输入参数合法性。
- 对RAW类型进行特殊处理。


exec阶段：

- 对subPos参数做大于0、为负数、大于字符串长度情况的特殊处理。
- 对subLen参数做小于等于0、大于字符串长度情况的特殊处理。
- 判断是否为RAW或BLOB类型，如果是则按照RAW类型截取，如果不是则按照统一方式截取。
- 统一方法截取，主要以，先从左遍历，再凑右遍历的方式，对截取到的非法汉字进行补空格的操作。
- RAW类型截取，不存在补空格操作，直接进行提取。


###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

exec部分：

![](https://conf.yasdb.com/download/attachments/127638173/image2023-8-30_16-23-32.png?version=1&modificationDate=1693383693000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0MTAsImV4cCI6MTc4MjMxMDIxMH0.It7NpELJ08yvxl3S5KXK0CSMgi9PjlJF5yCIM7LPmZ0)

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

char,varchar,nchar,nvarchar 主要以测试汉字的截取是否返回预期为主。

其余测试主要以测试，负数作为第二个参数，第二个参数取负值或为0的情况为主。

##   [7.资料设计章节](#7资料设计章节)  

  [RAW类型存储方式 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122072186)  

  [SUBSTR (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/SUBSTR.html#GUID-C8A20B57-C647-4649-A379-8651AA97187E)  

## Attachments:

[SUBSTRB_test.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjc4OTcwYzJhZjRmNTIwOTg5IiwicmVmX2lkIjoiNjczOTZjMjc3MjgyMDZlZmI5MmYwZTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDEwLCJleHAiOjE3ODIzODU4MTB9.DcfjQFVFN-iXhpRFE_CAgr3Lni8MX05gGDzgxqTl9bc)

 (application/octet-stream)    


[WXWorkLocal_16969061178717.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjdhMWFkOWEzMzExZGM4N2Y4IiwicmVmX2lkIjoiNjczOTZjMjc3MjgyMDZlZmI5MmYwZTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDEwLCJleHAiOjE3ODIzODU4MTB9.EkEeRWj57_yvcbgWO9H9F328pWHd1SziZhpvYTjGlHU)

 (image/png)    


[length2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjdhMWFkOWEzMzExZGM4N2Y5IiwicmVmX2lkIjoiNjczOTZjMjc3MjgyMDZlZmI5MmYwZTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDEwLCJleHAiOjE3ODIzODU4MTB9.Gkx3h3Fd3VG8Vc_M6DndcXdxap_shvPj6_Kz2Zh5Cj0)

 (application/octet-stream)    


[clipbord_1697424376548.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjdhMWFkOWEzMzExZGM4N2ZhIiwicmVmX2lkIjoiNjczOTZjMjc3MjgyMDZlZmI5MmYwZTVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NDEwLCJleHAiOjE3ODIzODU4MTB9.EZ4CB5r8J2ZxYdK_zAX5lA08RjcgZic8UatD9IPNS0A)

 (image/png)    
