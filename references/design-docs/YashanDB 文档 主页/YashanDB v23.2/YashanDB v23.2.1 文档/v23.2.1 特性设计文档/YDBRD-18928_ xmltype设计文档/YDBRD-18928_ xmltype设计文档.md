Created by 袁昊坤, last modified by  周湘淞 on 十月 18, 2024

#   [YDBRD-18928: xmltype](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [Design](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [(xmltype](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)      [方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR链接：    [YDBRD-18928](https://jira.yasdb.com/browse/YDBRD-18928?src=confmacro)    -  增加XMLTYPE数据类型，允许建表和存取使用  完成

MR链接：    [https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/24484](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/24484)  

  


##   [1. Overview（概述）](#1-overview概述)  

SR描述：增加XMLTYPE数据类型，允许建表和存取使用。

规格范围：单机。

设计方案：底层以clob方式进行存储，简单支持XMLTYPE类型进行建表、插入，更新和查询功能。

##   [2. Features（功能特性）](#2-features功能特性)  

yasdb可以使用XMLTYPE关键字显式声明XMLTYPE类型的列。可以对XMLTYPE类型进行插入和查询。

###   [2.1 建表](#21-建表)  

支持在建表时使用XMLTYPE关键字定义XMLTYPE数据的类型

```
create table test(co1 XMLTYPE);

create view v1 as select * from test;


```

###   [2.2 插入](#22-插入)  

目前只支持对XMLTYPE数据的直接简单插入，不对XMLTYPE数据的合法性做校验。

```
insert into test values('&lt;employee&gt;&lt;id&gt;1&lt;/id&gt;&lt;name&gt;John&lt;/name&gt;&lt;/employee&gt;');


```

隐式与强制类型转换:

|参数1|int|double|float|number|char|varchar|float|nchar|nvarchar|raw|bit|clob|blob|json|nclob|date|timestamp|interval year to month|interval day to second|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|cast(XMLTYPE as xxx )支持的类型（oracle）|N|N|N|Y|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|
|cast(XMLTYPE as xxx) 支持的类型(yasdb)（与oracle对齐）|N|N|N|Y|N|N|N|N|N|N|N|N|N|N|N|N|N|N|N|


###   [2.3 查询](#23-查询)  

目前只支持全部输出，不支持结构化查询，输出没有格式。

```

SQL&gt; select * from test;

CO1
----------------------------------------------------------------
&lt;employee&gt;&lt;id&gt;1&lt;/id&gt;&lt;name&gt;John&lt;/name&gt;&lt;/employee&gt;

create table test2(co1 int,co2 XMLTYPE);

Succeed.

SQL&gt; insert into test2 values(1,'&lt;employee&gt;&lt;id&gt;1&lt;/id&gt;&lt;name&gt;John&lt;/name&gt;&lt;/employee&gt;');

1 row affected.

SQL&gt; select * from test2 where co1=1;

         CO1 CO2
------------ ----------------------------------------------------------------
           1 &lt;employee&gt;&lt;id&gt;1&lt;/id&gt;&lt;name&gt;John&lt;/name&gt;&lt;/employee&gt;

1 row fetched.


```

###   [2.4 XMLTYPE函数支持情况](#24-xmltype函数支持情况)  

XMLTYPE对于函数以及高级包的支持情况与CLOB保持一致，具体函数支持情况请查看：

  [函数对XMLTpye的支持情况 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127633160)    。

对于支持XMLTYPE的函数，函数返回值类型，依据函数规格而定，不与CLOB一致，虽底层按CLOB存储，但不按照CLOB返回方式。

例如：

- CONCAT函数，expr为CLOB时，返回值类型为CLOB。 
- 而expr为XMLTYPE时，返回值不为XMLTYPE，返回值为VARCHAR。


|函数|类型|
|---|---|
|CAST|看CAST指定的类型|
|COALESCE|SYS.XMLTYPE|
|CONCAT|VARCHAR2(4000)|
|COUNT|NUMBER|
|INITCAP|VARCHAR2(4000)|
|LENGTH|NUMBER|
|LENGTHB|NUMBER|
|LISTAGG|VARCHAR2(4000)|
|LNNVL|NUMBER|
|LOWER|VARCHAR2(4000)|
|LPAD|VARCHAR2(40)|
|LTRIM|VARCHAR2(4000)|
|NLSSORT|RAW(2000)|
|REPLACE|VARCHAR2(4000)|
|RPAD|VARCHAR2(24)|
|RTRIM|VARCHAR2(4000)|
|SUBSTR|VARCHAR2(4000)|
|SYS_CONTEXT|VARCHAR2(256)|
|TRANSLATE|VARCHAR2(4000)|
|TRIM|VARCHAR2(4000)|
|UPPER|VARCHAR2(4000)|


##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 只支持全部查询，不支持结构化查询，输出没有格式。
- 目前只支持对XMLTYPE数据的直接简单插入，不对XMLTYPE数据的合法性做校验。
- 不支持四则运算与大小比较。
- 不支持where xmltype='XXXXXXXXX'的查询以及删除语句


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

###   [5.1 Architecture（架构）](#51-architecture架构)  

新建XMLTYPE数据类型，进行显式表现，让用户感知使用和得到的是XMLTYPE数据类型，但底层的存储和传输采用clob的存储和传输形式进行实现。

主要实现XMLTYPE数据与字符串的互相转换，其它加减乘除并不涉及。

![](https://pingcode.yasdb.com/atlas/files/public/67396c38a1ad9a3311dc88a3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUJBQUFRQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFTQUFBQUFBQUFBQUFBQVFRQUVBQUFBQUFBQUFBQUFBQUFBQkNBQUFDQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFBQUFCQUFBQUFBQUJBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3NTUsImV4cCI6MTc4MjMxMDU1NX0.aZZ5xmpPT0TR3VscdPGNtDA1zd_xR5PmSgPSqszdxYA)

![](https://pingcode.yasdb.com/atlas/files/public/67396c388970c2af4f520a31/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUJBQUFRQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFTQUFBQUFBQUFBQUFBQVFRQUVBQUFBQUFBQUFBQUFBQUFBQkNBQUFDQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFBQUFCQUFBQUFBQUJBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3NTUsImV4cCI6MTc4MjMxMDU1NX0.aZZ5xmpPT0TR3VscdPGNtDA1zd_xR5PmSgPSqszdxYA)

![](https://pingcode.yasdb.com/atlas/files/public/67396c38a1ad9a3311dc88a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUJBQUFRQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFTQUFBQUFBQUFBQUFBQVFRQUVBQUFBQUFBQUFBQUFBQUFBQkNBQUFDQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFBQUFCQUFBQUFBQUJBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3NTUsImV4cCI6MTc4MjMxMDU1NX0.aZZ5xmpPT0TR3VscdPGNtDA1zd_xR5PmSgPSqszdxYA)

![](https://pingcode.yasdb.com/atlas/files/public/67396c388970c2af4f520a33/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUJBQUFRQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFTQUFBQUFBQUFBQUFBQVFRQUVBQUFBQUFBQUFBQUFBQUFBQkNBQUFDQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFBQUFCQUFBQUFBQUJBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk3NTUsImV4cCI6MTc4MjMxMDU1NX0.aZZ5xmpPT0TR3VscdPGNtDA1zd_xR5PmSgPSqszdxYA)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

特性自测主要以XMLTYPE数据类型是否可以建表，执行结果是否返回XMLTYPE类型，XMLTYPE数据是否可以完整存取，各类函数，高级包执行结果是否符合预期为主。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


##   [7.资料设计章节](#7资料设计章节)  

  


  [XML概述 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124263323)  

  [XPath概述 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124264122)  

  [XQuery概述 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124264217)  

  [XMLTYP调研文档 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124263808)  

  [函数对XMLTpye的支持情况 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127633160)  

  [Oracle中XMLTYPE存在的一些问题 - 袁昊坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127635767)  

  


## Attachments:

[xmltype.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzhhMWFkOWEzMzExZGM4OGExIiwicmVmX2lkIjoiNjczOTZjMzc1OTNmOTljOWZmMjM2YmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzU1LCJleHAiOjE3ODIzODYxNTV9.ZznhClJ2IlfuIVEfO_0zaFnSsEicjQBKgqgRSVtl-8I)

 (application/octet-stream)    


[xmltype.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzhhMWFkOWEzMzExZGM4OGEyIiwicmVmX2lkIjoiNjczOTZjMzc1OTNmOTljOWZmMjM2YmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzU1LCJleHAiOjE3ODIzODYxNTV9.h_wj2hFIFh-exs-YOnCvGVjMVr80cn1ZSKIaIgU7ipI)

 (application/octet-stream)    
