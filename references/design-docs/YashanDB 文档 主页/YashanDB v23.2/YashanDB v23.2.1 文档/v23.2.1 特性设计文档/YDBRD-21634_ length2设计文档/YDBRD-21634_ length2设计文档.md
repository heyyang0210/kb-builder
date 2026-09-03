Created by 袁昊坤, last modified on 十月 15, 2024

#   [YDBRD-21634: length2](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [Design](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [(length2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)      [方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：    [YDBRD-21634](https://jira.yasdb.com/browse/YDBRD-21634?src=confmacro)    -  支持LENGTH2函数  完成

MR链接：    [feat:YDBRD-11491 支持LENGTH2函数 (!26321) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/26321)  

  


##   [1. Overview（概述）](#1-overview概述)  

SR描述：支持LENGTH2函数，以utf16规则返回长度。

规格范围：单机，集群。

##   [2. Features（功能特性）](#2-features功能特性)  

length2(char)

length2函数主要功能为：根据UTF16返回输入字符串长度。

![](https://pingcode.yasdb.com/atlas/files/public/67396c3e8970c2af4f520a63/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFDQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBUUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQVlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwNDMsImV4cCI6MTc4MjMxMDg0M30.TESR4hh1eipExzQC41cxXrFSkf7DJ2Enp0oRMOjs74c)

###   [2.1 函数参数](#21-函数参数)  

参数：char,需要时字符型或者可以隐式转换为字符型的表达式。

- 不支持CLOB/NCLOB/BLOB/BIT。
- 输入字符串内的空格也会计入返回长度。
- 当输入Null的时候，返回Null。
- 参数可以输入任意能转成字符串的类型。
- 不支持不输入参数。
- 支持绑定参数。


###   [2.2 函数返回值](#22-函数返回值)  

返回类型为BIGINT类型。

###   [2.3与length函数的区别体现](#23与length函数的区别体现)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c3ea1ad9a3311dc88d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBSUFBQUFDQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBUUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQVlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAwNDMsImV4cCI6MTc4MjMxMDg0M30.TESR4hh1eipExzQC41cxXrFSkf7DJ2Enp0oRMOjs74c)

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
bifVerifyLength2(AnlVerifier* vrfr, ExprNode* node)

bifExecLength2(AnlStmt* stmt, ExprNode* func, Variant* retValue)


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 函数第一个参数必须为字符串类型，或可转换为字符串的其它类型。不支持CLOB/NCLOB/BLOB/BIT。
- 函数入参为1个。
- 不支持不输入参数。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

复用length处理逻辑，对部分细节进行修改。

verify阶段：

- 对CLOB/NCLOB/BLOB/BIT做拦截处理。


exec阶段：

- 其它数据类型采用UTF16length处理。
- JSON数据类型采用lengthb处理。


###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 可大部分复用length测试用例。
- 测试返回结果是否与length一致。
- 测试表情包length与length2区别。
- 不同字符集下length2是否符合预期。


##   [7.资料设计章节](#7资料设计章节)  

  [SQL Language Reference (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/SUBSTR.html#GUID-C8A20B57-C647-4649-A379-8651AA97187E)  

  [Oracle 切换字符集 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130148190)  

## Attachments:

[WXWorkLocal_16969061178717.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2VhMWFkOWEzMzExZGM4OGNmIiwicmVmX2lkIjoiNjczOTZjM2U3MjgyMDZlZmI5MmYwZjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMDQzLCJleHAiOjE3ODIzODY0NDN9.9nqRZuW1dRbLHOgxwjOo1KK72BurtMhR6VFfgh3-NZ8)

 (image/png)    


[WXWorkLocal_16969061178717.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2VhMWFkOWEzMzExZGM4OGQwIiwicmVmX2lkIjoiNjczOTZjM2U3MjgyMDZlZmI5MmYwZjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMDQzLCJleHAiOjE3ODIzODY0NDN9.C1kJ99i1vekABRRW2-5fJIzN4bTD5lKmeOD31_kxyn4)

 (image/png)    


[length2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjM2U4OTcwYzJhZjRmNTIwYTYxIiwicmVmX2lkIjoiNjczOTZjM2U3MjgyMDZlZmI5MmYwZjY4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMDQzLCJleHAiOjE3ODIzODY0NDN9.4u-cpuvamhn7DecRqZnnbYeicbUI6xm-X0DQ7KokYBw)

 (application/octet-stream)    
