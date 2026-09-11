Created by 邓秋怡, last modified on 十一月 23, 2023

*详细设计-YDBRD-231 : BULK COLLECT INTO Design（BULK COLLECT INTO方案设计）*

* IR链接：*    [YDBRD-231](https://jira.yasdb.com/browse/YDBRD-231?src=confmacro)    *-*  *游标支持BULK COLLECT Clause*  *完成*

*SR链接：*    [YDBRD-13354](https://jira.yasdb.com/browse/YDBRD-13354?src=confmacro)    *-*  *INTO clause支持Bulk collect*  *完成*

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

需求来源：市场需求（招商证券, 华润银行）

场景：    
  1、FETCH Statement with BULK COLLECT Clause    
  2、SELECT BULK COLLECT INTO    
  3、RETURNING INTO Clause with BULK COLLECT Clause【本次迭代暂不实现】    
  4、EXECUTE IMMEDIATE .. BULK COLLECT INTO ..

需求描述：游标支持BULK COLLECT Clause

需求范围：1、单机和集群

需求规格：支持bulk_collect_into_statement

###   [1.2 调研文档](#12-调研文档)  

  [BULK COLLECT INTO调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=135602707#211-select-into)      
  关键点如下：    
  1、BULK COLLECT INTO 的目标对象必须是集合类型。（即使已经可以确保查询出的结果只有一行数据。bulk collect into的对象也应该是集合类型）    
  2、不能对使用字符串类型作键的关联数组使用BULK COLLECT 子句。（即类似于index by varchar的数组）    
  4、和直接fetch/select .. into的区别如下

- 直接into给变量，需要集合当前索引位置已有值（可以为NULL），否则会报错。 bulk collect into给变量，会对集合变量重新进行初始化，并根据查询个数自动EXTEND空间。
- SQL查询结果是0行数据时，BULK INTO不会报错。


###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|![](https://pingcode.yasdb.com/atlas/files/public/67396c9ca1ad9a3311dc8bae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUlBQUFBQUFBQUFJQUFBQUFFQUFBQUFBQUFBUUFBQUFBQUFDQUFBRUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBZ0FBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFRQUFBQUFBQUFBQUFBQUJBQUVBQUFRQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFJQUFBQUFBQUFBQkFBQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE3OTAsImV4cCI6MTc4MjMxMjU5MH0.2UVIGUsInbLKka0RdqHmpGhzqWZyVF8i9jvgWlian8Q)|1. 对SqlLn和FetchLn以及ExecuteImmediateLn中添加isBulk变量，用于在编译阶段就标定bulk collect into语句。对StSoExecutor中添加columnId和rowId用于在执行阶段标定正在赋值的位置。
1. 执行阶段在循环内调用anlFetch，直到没有数据了或者到达fetch中的limit上限了。
|是|是|
|功能2|![](https://pingcode.yasdb.com/atlas/files/public/67396c9c8970c2af4f520d3d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUlBQUFBQUFBQUFJQUFBQUFFQUFBQUFBQUFBUUFBQUFBQUFDQUFBRUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBZ0FBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFRQUFBQUFBQUFBQUFBQUJBQUVBQUFRQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFJQUFBQUFBQUFBQkFBQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE3OTAsImV4cCI6MTc4MjMxMjU5MH0.2UVIGUsInbLKka0RdqHmpGhzqWZyVF8i9jvgWlian8Q)|1. 是功能1的分支功能，大致思路已在功能1中阐述
|是|是|
|功能3|![](https://pingcode.yasdb.com/atlas/files/public/67396c9c8970c2af4f520d3f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUlBQUFBQUFBQUFJQUFBQUFFQUFBQUFBQUFBUUFBQUFBQUFDQUFBRUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBZ0FBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFRQUFBQUFBQUFBQUFBQUJBQUVBQUFRQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFJQUFBQUFBQUFBQkFBQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE3OTAsImV4cCI6MTc4MjMxMjU5MH0.2UVIGUsInbLKka0RdqHmpGhzqWZyVF8i9jvgWlian8Q)|1. 是功能1的分支功能，大致思路已在功能1中阐述
1. 不同点是还会在FetchLn中添加一个bulkLimit变量，用于可选limit分支
|是|是|
|功能4|![](https://pingcode.yasdb.com/atlas/files/public/67396c9ca1ad9a3311dc8bb0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUlBQUFBQUFBQUFJQUFBQUFFQUFBQUFBQUFBUUFBQUFBQUFDQUFBRUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBZ0FBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFRQUFBQUFBQUFBQUFBQUJBQUVBQUFRQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFJQUFBQUFBQUFBQkFBQUVBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE3OTAsImV4cCI6MTc4MjMxMjU5MH0.2UVIGUsInbLKka0RdqHmpGhzqWZyVF8i9jvgWlian8Q)|1. 是功能1的分支功能，大致思路已在功能1中阐述
|是|是|
|性能|批量执行DML语句|在oracle上，如果PLSQL引擎和SQL引擎不在一台机器，或操作远程表时，使用BULK可以提高执行效率。但yasdb中BULK目前实现上不会有效率区别。|否|是|
|可用性|  
|  
|  
|否|
|可靠性|  
|  
|  
|否|
|可维可测|  
|  
|  
|否|
|安全|  
|  
|  
|否|
|易用性|  
|  
|  
|否|
|可修改性|  
|  
|  
|否|
|兼容性|  
|  
|  
|否|
|周边配合|权限|  
|  
|  
|
|周边配合|审计|  
|  
|  
|
|周边配合|导入导出工具|  
|  
|  
|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|BULK 关键字可用|----|是|
|函数|  
|  
|否|
|高级包|  
|  
|否|
|系统视图|sys.v$RESERVED_WORDS查询结果会多一行BULK关键字信息|----|是|
|动态视图|  
|  
|否|
|配置参数|  
|  
|否|
|驱动接口|  
|  
|否|
|错误码|  
|  
|否|
|告警|  
|  
|否|
|日志|  
|  
|否|


##   [3. 规格与约束](#3-规格与约束)  

- returing子句暂不支持。（包括DELETE INSERT UPDATE EXECUTE IMMEDIATE语句的RETURING）


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

**编译流程**

在soCompileFetchLn或soCompileSelectLn或soCompileExecuteLn中，若读到bulk关键字，则在FetchLn或者SqlLn或ExecuteImmediateLn中isbulk参数置为true，用于标定bulk操作

如果是BULK COLLECTION INTO，检测into的变量必须是集合类型，集合类型的成员类型要和查询语句的个数和类型匹配（和普通INTO规则一样）。

**执行流程**

***SELECT INTO BULK COLLECT***

增加标记SqlLn->isBulk。

1）soExecSqlLn->doExecSqlLn->soTryFetchVars->soFetchSelectIntoVars->soFetchBulkIntoVars 在SqlLn->isBulk时循环anlFetch，并修改exec→rowId。

***FETCH BULK COLLECT***

增加标记FetchLn->isBulk、bulkLimit。

1）soExecFetchLn->soExecFetchCursor->soFetchFetchIntoVars->soFetchBulkIntoVars 在FetchLn->isBulk时循环anlFetch，并修改exec→rowId。

***EXECUTE IMMEDIATE***

增加标记ExecuteImmediateLn->isBulk。

1）soExecExecuteImmediateLn->doExecExecuteImmediateLn->soExecDynSql->soTryFetchVars->soFetchSelectIntoVars->soFetchBulkIntoVars  在ExecuteImmediateLn->isBulk时循环anlFetch，并修改exec→rowId。

***公共***

1）用exec->rowId、columnId标识所要赋值的位置，设计思路为循环调用SendRow来实现批量能力，具体需在编译阶段记录bulk关键字用于与原单sql语句做逻辑区分，并记录limit关键字（可选）来限定批量的量值。

2）核心流程：anlFetch->...->fetchQuery->sendRow->sendColumn->soSendVariant->soSetVarValue（普通into）/soSetVarValueBulk（isBulk）    
  →soGetDestValue（获取目标变量）    
  →soBulkGetCurrValue（根据exec->rowId获取当前待赋值的varray的元素，  **实现了从varray到varray元素的转换，也是这个转换才能使后续直接复用原有into的代码**  ，内含varray空间清空及扩展）    
  →soSetVarrayVarValue  **对varray的元素赋值**  【内有对标量、record|object、varray作区分，分别对应soSetVarrayMemberScalar、soSetVarrayRecord(内部按列赋值)、soVarrayCopy函数】

4）通过调用sendrow每次发送的是一个column的值，当结果集为record array，需要通过soSetVarrayVarValue->soSetVarrayRecord赋值给对应的record的列（exec→columnId）。

###   [4.2 特性可维可测设计](#42-特性可维可测设计)  

###   [4.3 特性安全设计](#43-特性安全设计)  

###   [4.4 特性周边配合](#44-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1、3个语句（fetch、select into、execute） * 单类型、record、多列、多列udt、package.collection    
  2、输入和输出变量类型转换或不匹配测试    
  3、目标变量类型测试    
  4、初始化相关测试    
  5、结合for测试

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2023-11-20_17-53-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWJhMWFkOWEzMzExZGM4YmE5IiwicmVmX2lkIjoiNjczOTZjOWI3MjgyMDZlZmI5MmYxNDdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNzkwLCJleHAiOjE3ODIzODgxOTB9.UncQML12BR91u_KQ2NJuNVyxAt5DFgUUCq_huW1JQv4)

 (image/png)    


[image2023-11-20_18-46-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWI4OTcwYzJhZjRmNTIwZDM4IiwicmVmX2lkIjoiNjczOTZjOWI3MjgyMDZlZmI5MmYxNDdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNzkwLCJleHAiOjE3ODIzODgxOTB9.54PtO3EeNB-G7L2K77tjgKjMm2Foc4I-e_y3WX0eCo4)

 (image/png)    


[image2023-11-20_17-36-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWJhMWFkOWEzMzExZGM4YmFhIiwicmVmX2lkIjoiNjczOTZjOWI3MjgyMDZlZmI5MmYxNDdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNzkwLCJleHAiOjE3ODIzODgxOTB9.OS6Cnd-BPPpgxXmhtOzaL2BEzwo7JoZ4i0usggg9PBE)

 (image/png)    


[image2023-11-20_15-25-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWM4OTcwYzJhZjRmNTIwZDNhIiwicmVmX2lkIjoiNjczOTZjOWI3MjgyMDZlZmI5MmYxNDdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNzkwLCJleHAiOjE3ODIzODgxOTB9.k0ZFTTPG4n29kpq-RLn7ZH92T4ATPq8YDvzl2kFHIMs)

 (image/png)    


[image2023-11-20_15-20-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWM4OTcwYzJhZjRmNTIwZDNiIiwicmVmX2lkIjoiNjczOTZjOWI3MjgyMDZlZmI5MmYxNDdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxNzkwLCJleHAiOjE3ODIzODgxOTB9.JoPFVvSEFMFjae83MSIUwtECjqC38hVbFcaOK1qsJEY)

 (image/png)    
