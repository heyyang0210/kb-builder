Created by 袁昊坤, last modified on 十一月 15, 2023

#   [YDBRD-21634: md5](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [Design](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [(md5](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)      [方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：    [YDBRD-22287](https://jira.yasdb.com/browse/YDBRD-22287?src=confmacro)    -  支持MD5函数  完成

IR链接：    [YDBRD-21448](https://jira.yasdb.com/browse/YDBRD-21448?src=confmacro)    -  支持MD5函数，用于校验数据  验收中

MR链接：

  


##   [1. Overview（概述）](#1-overview概述)  

SR描述：支持MD5函数，用于校验数据，输入VARCHAR/NVARCHAR/BLOB/CLOB/NCLOB/NCHAR/CHAR，输出VARHCAR,md5值。

规格范围：单机。

##   [2. Features（功能特性）](#2-features功能特性)  

md5(str)

md5函数主要功能为：为字符串算出一个固定长度的32位十六进制md5值。

![](https://pingcode.yasdb.com/atlas/files/public/67396c1c8970c2af4f520952/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUNBQVFBQUFBQUFBSUFBSUFBQUFBQUFBQUlBQUVBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNTYsImV4cCI6MTc4MjMwOTg1Nn0.qavf7DsERzku8Br8rpxLeGL9hTvL2H8BQXNYvifSu50)

###   [2.1 函数参数](#21-函数参数)  

参数：str

|char|nchar|varchar|nvarchar|int|integer|smallint|bigint|tinyint|float|double,  
|date|timestamp|CLOB|NCLOB|BLOB|BOOL|JSON|BIT|
|:---|:---|:---|:---|:---|:---|---|---|---|:---|:---|:---|:---|---|---|:---|:---|:---|:---|
|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|√|


###   [2.2 函数返回值](#22-函数返回值)  

返回类型为varchar(32)类型。

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
bifVerifyMD5(AnlVerifier* vrfr, ExprNode* node)

bifExecMD5(AnlStmt* stmt, ExprNode* node, Variant* retValue)


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 参数为null或空串时返回值为null。
- 返回值均为varchar(32)类型。
- 对于double，float类型，函数返回其科学计数法的md5值。
- 对于bool类型，函数返回对应0/1的md5值。


true/1:c4ca4238a0b923820dcc509a6f75849b

false/0:cfcd208495d565ef66e7dff9f98764da

- 不同字符集对md5值不影响。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

exec阶段：

- 获取参数，并对null进行处理。
- 计算参数的md5value。
- 将得到的md5value转换为32位16进制值进行输出。


###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 测试bool类型true/false/1/0情况下是否符合预期。
- 测试各数据类型是否符合预期。
- 测试md5结果是否与mysql一致。


##   [7. TODO（遗留问题）](#7-todo遗留问题)  

对于null值和空格的从处理：

- 对于空格：md5转换工具可得，不同数量的空格，md5值不同，但mysql对字符串末尾的空格都进行了消除，全部消除完后若没有字符，则返回的是空串的md5值。(对开头和中间的空格不做消除处理)。
- 对于null：mysql返回null。


此两点是否需要对齐，应怎么取舍。

![](https://conf.yasdb.com/download/attachments/133583023/image2023-11-2_11-9-44.png?version=1&modificationDate=1698894383000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUNBQVFBQUFBQUFBSUFBSUFBQUFBQUFBQUlBQUVBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNTYsImV4cCI6MTc4MjMwOTg1Nn0.qavf7DsERzku8Br8rpxLeGL9hTvL2H8BQXNYvifSu50)

![](https://pingcode.yasdb.com/atlas/files/public/67396c1ca1ad9a3311dc87c2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFnQUFBQUFBQUNBQVFBQUFBQUFBSUFBSUFBQUFBQUFBQUlBQUVBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNTYsImV4cCI6MTc4MjMwOTg1Nn0.qavf7DsERzku8Br8rpxLeGL9hTvL2H8BQXNYvifSu50)

## Attachments:

[WXWorkLocal_16969061178717.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWJhMWFkOWEzMzExZGM4N2JhIiwicmVmX2lkIjoiNjczOTZjMWI1OTNmOTljOWZmMjM2YTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDU2LCJleHAiOjE3ODIzODU0NTZ9.yDhdJnxtLWCFVPa6diPQXcy-6WPltCkpdEdgJYvmpT4)

 (image/png)    


[length2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWI4OTcwYzJhZjRmNTIwOTRkIiwicmVmX2lkIjoiNjczOTZjMWI1OTNmOTljOWZmMjM2YTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDU2LCJleHAiOjE3ODIzODU0NTZ9.ZNHQ76edyAA0foFmHtAZ_CZ9Fg142KJa0hMZgoc_7Uc)

 (application/octet-stream)    


[clipbord_1697424376548.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWI4OTcwYzJhZjRmNTIwOTRlIiwicmVmX2lkIjoiNjczOTZjMWI1OTNmOTljOWZmMjM2YTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDU2LCJleHAiOjE3ODIzODU0NTZ9.rN5aO5hXtlMg9ZAZexU4U_r0nvcDnIlv_qwVGGSkTYo)

 (image/png)    


[md5.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMWJhMWFkOWEzMzExZGM4N2JmIiwicmVmX2lkIjoiNjczOTZjMWI1OTNmOTljOWZmMjM2YTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDU2LCJleHAiOjE3ODIzODU0NTZ9.SOgR0jD9YZCdaxdWGGodSf57gq1Ve7XmevKv2zSy5dM)

 (application/octet-stream)    
