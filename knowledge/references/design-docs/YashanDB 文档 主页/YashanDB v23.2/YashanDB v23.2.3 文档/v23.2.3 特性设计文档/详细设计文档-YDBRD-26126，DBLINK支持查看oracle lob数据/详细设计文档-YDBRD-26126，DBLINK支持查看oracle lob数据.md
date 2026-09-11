Created by 徐伟, last modified on 六月 20, 2024

# **适用场景：IR/SR特性的详细设计文档**

*详细设计-YDBRD-26126: DBLINK支持查看oracle lob数据 Design*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b058](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b058)    *?*    
  *#YASHAN-264 崖山DBLINK连接ORACLE支持查看LOB数据*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618d18afd997db58ad7ff67](https://pingcode.yasdb.com/pjm/items/6618d18afd997db58ad7ff67)    *?*    
  *#YDBRD-26126 崖山DBLINK连接ORACLE支持查看LOB数据*

##   [1. 总述](#1-总述)  

DBLINk支持yashan查看oracle的LOB数据，包括inRow跟outRow lob。当前需求只支持读。

###   [1.1 需求来源](#11-需求来源)  

需求来源：深燃二期

场 景：工程移动系统与ERP强关联，大量dblink用法与Oracle进行交互，包括对lob数据的查看读取

###   [1.2 调研文档](#12-调研文档)  

1、oracle在dblink场景对于lob的支持情况调研：

- 1.1 ORACLE dblink支持lob文档说明:      [https://docs.oracle.com/en/database/oracle/oracle-database/12.2/adlob/distributed-LOBs.html#GUID-B31CB736-B03F-4333-B5E2-EEF883D7D3E5](https://docs.oracle.com/en/database/oracle/oracle-database/12.2/adlob/distributed-LOBs.html#GUID-B31CB736-B03F-4333-B5E2-EEF883D7D3E5)  
- 1.2 dblink支持lob调研文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=150603505](https://conf.yasdb.com/pages/viewpage.action?pageId=150603505)  


2、LOB的oci相关接口介绍：    [https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/OCI-API-for-LOBs.html](https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/OCI-API-for-LOBs.html)  

3、ociLobRead2接口特殊表现调研测试：    [https://conf.yasdb.com/pages/viewpage.action?pageId=150614262](https://conf.yasdb.com/pages/viewpage.action?pageId=150614262)  

###   [1.3 需求分析](#13-需求分析)  

dblink支持从oracle读取LOB数据的实现需要关注如下几点：

1、OCI的lobRead接口是否支持多次读取来完整读完列数据

2、OCI接口返回的lob数据如何组织

3、exs进程对于超长数据，某一列的lob数据超过csPacket buffer，数据如何发送？ 未发送完全的lob列数据下次如何获取?

4、OCI的lobLocator是否需要复用，以及如何复用

5、yex_client（yashan）如何处理outLob

6、yashan的fetchQuery跟execDblinkColumnExpr执行“隔”的很远，如何在ylnReadColumn处组织数据保证能正确处理lob

7、nClob字符集相关如何处理OCI数据返回

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|yashan lob数据组织|exs返回的一批lob数据以varchar形式，在execDblinkColumnExpr createTempLob，做lobAppend，在下次去exsFetch数据之前释放tempLob|是|是|
|功能|exs lob数据组织|exs以字符形式返回数据，第一次读取时只返回行号； 后续再次读取与yashan交互时，需要返回：1、lob数据是否读完，2.lob的offset|是|是|
|功能|yashan与exs通过lob locator进行数据再访问|yashan在execDblinkColumnExpr 时，会将lobOffset，rowOffset，columnId发送给exs先获取lobLocator，exs调用ociLobRead接口，返回的数据存储在conn->lobRecPacket，并返回是否读完以及lobOffset|是|是|
|性能|lob按需读取|lob列在第一次读取时只会返回一个行号，后续只在execDblinkColumnExpr时按需读取，如在sql语句中不使用lob列或者有limit等，则会提前结束。|是|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

依赖OCI接口

##   [2. 接口](#2-接口)  

SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

1、该需求只支持从oracle读取lob，不支持写以及不支持从yashan读写    
  2、对于DML的update/delete远端表时，实现上都是把语句发给远端执行，本地不感知数据类型    
  3、对于insert into 远端表，实现上是按绑定参数将列数据发送给远端，本地获取的数据类型是实际执行expr后的数据类型，并非column的原始类型。类型转换交由远端数据库处理    
  4、对于insert into 远端表 select 远端表，都是先执行select从远端获取数据后，再按绑定参数形式插入；同insert一样，本地感知的也是表达式实际执行后的类型，类型转换交由远端数据库自行处理

##   [4. 特性](#4-特性)  

DBLINK支持从oracle读取lob主要关注的是fetch流程，因此需考虑之前流程上对lob有哪些限制，从而方便该需求设计方案的展开

###   [4.1 dblink原fetch流程](#41-dblink原fetch流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d80a1ad9a3311dc919b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQVVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg4NDMsImV4cCI6MTc4MjMxOTY0M30.OQ4JCa3doyGVbAbam4bO-_ybivBEQvP3AL6maC8ARDk)

###   [4.2 获取lob数据流程](#42-获取lob数据流程)  

**OCILobLocator占用112个字节**

![](https://pingcode.yasdb.com/atlas/files/public/67396d808970c2af4f52132a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQVVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg4NDMsImV4cCI6MTc4MjMxOTY0M30.OQ4JCa3doyGVbAbam4bO-_ybivBEQvP3AL6maC8ARDk)

###   [4.3 处理nclob数据](#43-处理nclob数据)  

1、在describeColumn时判断为nclob时，设置columnAttr的charLen

2、从oracle获取nclob数据时，需设置正确的csfrm跟csid，保证从oci接口返回指定数据流数据（默认都是按utf-8返回）

3、在execDblinkColumnExpr，判断column->desc.type是nclob时，先设置value为nvarchar，然后执行varConvert转成nclob；否则直接用字符串转换后做lopAppend

###   [4.6 特性可维可测设计](#46-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. lob类型测试
1. lob数据量为inrow跟outrow场景
1. 实际投影有lob列跟非lob列
1. lob出现在filter跟投影


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-4-17_10-16-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkN2Y4OTcwYzJhZjRmNTIxMzFjIiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.5SOqHlFxOb2yr0hwjuUGZMgCp5jwb3fAh8uKtwbkLvo)

 (image/png)    


[image2024-4-16_19-31-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkN2Y4OTcwYzJhZjRmNTIxMzFlIiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.0Ebxqg0jGRzOly9yDJmPaYbfzVU86aeXkBlLoTF78PM)

 (image/png)    


[image2024-4-16_17-37-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkN2Y4OTcwYzJhZjRmNTIxMzFmIiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.TAANGsn6gwdMRPpCD_XEcX-QFU3TWkY5MELiiapkMWo)

 (image/png)    


[image2024-4-16_17-9-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODBhMWFkOWEzMzExZGM5MTkyIiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.011cvBBrx6TY8izsdbKb05NQDO2UDtbzXWa9GsprKks)

 (image/png)    


[image2024-4-16_17-7-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODA4OTcwYzJhZjRmNTIxMzIxIiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.bapqN9RpZXX_ez8oCBpNx6cOAQL4NRqUh67DLLKirIg)

 (image/png)    


[image2024-4-16_17-7-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODA4OTcwYzJhZjRmNTIxMzIzIiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.1RFyzDfZLpqiFhb1kioxQ9CR2pz0jEt0oG8IlKx6IQA)

 (image/png)    


[image2024-4-16_17-6-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODBhMWFkOWEzMzExZGM5MTk0IiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.uvDANTaOHSjHT40PRKclaJFYItvQJLTDkfiYyBJg1fQ)

 (image/png)    


[image2024-4-16_17-5-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODA4OTcwYzJhZjRmNTIxMzI1IiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.pSZYPQ6zIQAVwqD5Rhv8IDw0fykVJYr7P9uiuDteVFo)

 (image/png)    


[image2024-4-16_16-0-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODBhMWFkOWEzMzExZGM5MTk5IiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.4Jz-STxZ_TrFhIoazzAtAYY8MKkulEYZvwHf8ybhMVo)

 (image/png)    


[image2023-6-2_15-22-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODA4OTcwYzJhZjRmNTIxMzI4IiwicmVmX2lkIjoiNjczOTZkN2Y1OTNmOTljOWZmMjM3YmViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQzLCJleHAiOjE3ODIzOTUyNDN9.GzGvFEJxQX2cqMJU4OkI21LEGSIjJd1oEfAnCfSbKOM)

 (image/png)    
