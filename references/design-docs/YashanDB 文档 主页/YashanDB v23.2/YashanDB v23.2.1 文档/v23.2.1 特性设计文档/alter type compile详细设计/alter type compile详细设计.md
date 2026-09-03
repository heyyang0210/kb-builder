Created by 郝鑫刚, last modified on 十月 30, 2023

  [YDBRD-7301](https://jira.yasdb.com/browse/YDBRD-7301?src=confmacro)    -  支持alter type  完成

  


##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

实现alter type的type_compile_clause分支功能。

对type或type body进行一次显示的重新编译。如果编译错误，可能看到具体的错误信息，type的状态是INVALID。

支持单机和集群部署方式。

对非当前用户的TYPE执行时需要ALTER ANY TYPE权限。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c00a1ad9a3311dc8709/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQkFBQUVBQkFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBRUFBQUFBQUFBQUVBQUFBQUFJQUVBQUFBQUFBQUFBQUFBQUFBQWdBQUVFQWdBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFFQUFBQUFBQUFBQUlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NTcsImV4cCI6MTc4MjMwOTI1N30.80aGp5WLv1oP6FCQ_r7wOVkLMhmcJcZcnF2aTOfkqQI)

![](https://pingcode.yasdb.com/atlas/files/public/67396c00a1ad9a3311dc870a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQkFBQUVBQkFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBRUFBQUFBQUFBQUVBQUFBQUFJQUVBQUFBQUFBQUFBQUFBQUFBQWdBQUVFQWdBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFFQUFBQUFBQUFBQUlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NTcsImV4cCI6MTc4MjMwOTI1N30.80aGp5WLv1oP6FCQ_r7wOVkLMhmcJcZcnF2aTOfkqQI)

![](https://pingcode.yasdb.com/atlas/files/public/67396c008970c2af4f520894/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQkFBQUVBQkFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBRUFBQUFBQUFBQUVBQUFBQUFJQUVBQUFBQUFBQUFBQUFBQUFBQWdBQUVFQWdBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFFQUFBQUFBQUFBQUlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NTcsImV4cCI6MTc4MjMwOTI1N30.80aGp5WLv1oP6FCQ_r7wOVkLMhmcJcZcnF2aTOfkqQI)

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

ALTER TYPE语法。

  


CodResult       dcReCompileUdtDict  (  AnkHandler  *     handler  ,     CodText  *     userName  ,     CodText  *     typeName  ,     CodUint64     oid  );    
  CodResult       dcReCompileUdtBody  (  AnkHandler  *     handler  ,     CodText  *     userName  ,     CodText  *     typeName  ,     CodUint64     bodyId  );

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

*说明本方案对外的功能限制或约束。*

1. 编译参数无实际作用，只做语法支持。（DEBUG相当于PLSQL_OPTIMIZE_LEVEL=1）
1. REUSE SETTINGS无实际作用，只做语法支持。
1. EDITIONABLE/NONEDITIONABLE是之前支持的，只语法支持。


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

  


**功能：**

ALTER TYPE COMPILE的逻辑是比较特殊的，非典型的DDL流程，不加锁、不需要TYPE必须存在，所以实现上执行完alterObjTypeCompile()后直接返回。

COMPILE的实现复用之前DML中的重编译流程。

![](https://pingcode.yasdb.com/atlas/files/public/67396c00a1ad9a3311dc870b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQkFBQUVBQkFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBRUFBQUFBQUFBQUVBQUFBQUFJQUVBQUFBQUFBQUFBQUFBQUFBQWdBQUVFQWdBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFFQUFBQUFBQUFBQUlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NTcsImV4cCI6MTc4MjMwOTI1N30.80aGp5WLv1oP6FCQ_r7wOVkLMhmcJcZcnF2aTOfkqQI)

重编译流程：

1. 根据oid获取出sql、申请临时的MemoryContext、起新事务。
1. 构造SQL语句编译后的AnlStmt、AnlContext结构，构造ObjTypeCreateRef，isRecplace为TRUE。
1. 执行CREATE OR REPLACE TYPE的DDL流程。


  


**锁：**

ALTER TYPE COMPILE中不申请新的锁，在REPLACE的DDL流程中会获取TYPE的锁。

  


**依赖：**

依赖的对象：根据过程体的实现，REPLACE的DDL流程中遇到的INVALID对象会进行重编译。

被依赖对象：REPLACE TYPE时会失效相关对象。后续使用对象时会自动重编译。

  


**并发：**

ALTER TYPE COMPILE流程中只操作表和openUdtDict，无新增并发场景。

  


**集群、主备：**

CREATE OR REPLACE TYPE的DDL流程中会有ALTER TYPE日志和消息，无新增场景。

  


**资源：**

openUdtDict，有close。

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95099805#54-dfx%E8%AE%BE%E8%AE%A1)  

- ALTER TYPE审计已支持，不涉及新的审计需求。
- 功能上来说不需要导入导出。


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


|  
|  
|  
|  
|
|---|---|---|---|
|只有type或是TABLE/VARRAY|默认、SPECIFICATION执行正常。,BODY报错。对象不存在。|  
|  
|
|只有type body对象|默认报错。对象不存在,SPECIFICATION报错。对象不存在,BODY执行报错。body的编译错误。|  
|  
|
|OBJECT + BODY 都有错误|默认、SPECIFICATION执行报错。只显示object的编译错误。,BODY执行报错。显示body的编译错误。|  
|  
|


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=95099805#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

  


ALTER     [TYPE.md](http://TYPE.md)    文档需要对应修改

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments: