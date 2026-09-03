Created by 张欣, last modified on 十一月 07, 2023

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

本文档描述alter type compile功能的测试设计。也就是对UDT TYPE（OBJECT,VARRAY,NESTED TABLE）做重编译的功能。

IR/SR 链接：    [YDBRD-9416](https://jira.yasdb.com/browse/YDBRD-9416?src=confmacro)    -  支持alter type compile和编译option  完成

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


### 2.1.1 语法图：

![](https://conf.yasdb.com/download/attachments/133576327/image2023-10-26_16-13-56.png?version=1&modificationDate=1698307784000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTUzNjcsImV4cCI6MTc4MjMwNjE2N30.-5-TpskIVmaSoxJAH813BrGk1kyVzVagKKyxLCXqUf8)

![](https://conf.yasdb.com/download/attachments/133576327/image2023-10-26_16-14-20.png?version=1&modificationDate=1698307809000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTUzNjcsImV4cCI6MTc4MjMwNjE2N30.-5-TpskIVmaSoxJAH813BrGk1kyVzVagKKyxLCXqUf8)

编译选项格式：

![](https://conf.yasdb.com/download/attachments/133576327/image2023-10-26_16-14-33.png?version=1&modificationDate=1698307822000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTUzNjcsImV4cCI6MTc4MjMwNjE2N30.-5-TpskIVmaSoxJAH813BrGk1kyVzVagKKyxLCXqUf8)

>   ALTER TYPE [ schema. ] type_name COMPILE [ DEBUG ] [ SPECIFICATION | BODY ] [ compiler_parameters_clause ]... [ REUSE SETTINGS ]  

  


说明：

1.  EDITIONABLE|NONEDITIONABLE: 用于指定procedure是否成为可编辑或不可编辑的对象，仅语法支持，默认为EDITIONABLE。

2.[schema] 可选，UDT type的schema,默认当前用户；需要是存在的user

3.type_name: UDT type的名称，可以是object/varray/nested table 3种类型；需要是当前或指定schema下存在的type。

4.  DEBUG：指示PL/SQL编译器生成并存储供PL/SQL调试器使用的代码，作用同编译选项PLSQL_OPTIMIZE_LEVEL=1。仅语法支持。

5.  [ SPECIFICATION | BODY ]：可选。

1. 不指定: 默认重编译heap和 body。（针对object，varray和nested table没有body，只编译head）;  
1. SPECIFICATION: 仅编译object的head ; varray和nested table重编译。 
1. BODY: 仅编译object的body ; varray和nested table没有body【预期报错】


6.编译选项[ compiler_parameters_clause ]：可选，仅语法支持，可以指定一个或多个选项及对应值。需要测试语法兼容性，覆盖各个参数及取值的支持情况。详细内容见：

7.[  REUSE SETTINGS]：   防止数据库删除和重新获取编译编译开关。使用RESUE SETTINGS时，数据库将保留现有设置，编译时未指定的参数使用现有设置重编译。

8.  TIMESTAMP timestamp：oracle资料未体现，实际支持。 可能在其他语法分支。本次要测一下。

语法图验证点：语法支持，默认值，关键字大小写、正确性校验，关键字指定顺序，可选必选项。

## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


### 2.2.1 重编译的对象类型

|#### object head,#### object body,#### object head + body|- 只有head定义，无方法； 指定SPECIFICATION或不指定将重编译；指定body将报错。
- 有constructor/static/member(map/order)方法。指定BODY或不指定将重编译这些方法。
- object type关系类型：嵌套 继承 都存在依赖关系。
- 方法中可能使用到的plsql单元有：UDT type,local UDT,procedure,function,UDP。
- 特殊的预定义type: geometry/st_geometry
|
|---|---|
|#### VARRAY|存在依赖链的情况：varray成员类型可能是其他object/VARRAY/Nested Table type。|
|#### Nested Table|同上|


### 2.2.2 type的使用场景

1.作为表列类型。 这种情况 不允许drop 或replace 修改type，指定force也不支持。理论上type不会变更。验一下alter type 的语法支持 及对table状态无影响；

2.在pl/sql中使用 【使用较多，需要重点测一下】

- 作为存储过程、自定义函数形参或变量类型；
- 在UDP中作为变量类型或者子过程或函数中使用；
- type之间存在类型嵌套；
- 或者object type存在继承关系；


这种情况，create or replace 修改type定义不支持，但是加force关键字是可以修改的。

在存储过程、自定义函数中使用，重编译type后，依赖type的过程体会被置成INVAILD状态。下次执行到会先重编译，不影响使用。可以在  **dba_objects视图**  的status字段查看对象状态。

3.type变更的场景：

- 未创建，或已经创建被drop （全部drop 或object 仅drop body）;
- create or replace xxx [force] 修改;
- type本身未变更，type依赖的对象变更或失效（type; body方法中调用的过程体；%rowtype,%type 继承的table）


### 2.2.3 依赖失效规则

参考    [依赖失效规则 - 廖峰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95111198)  

依赖的对象：根据过程体的实现，REPLACE的DDL流程中遇到的INVALID对象会进行重编译。

被依赖对象：REPLACE TYPE时会失效相关对象。后续使用对象时会自动重编译。

特殊的：object的head和body的依赖关系：body依赖head   body可以是invaild,head 是vaild。 head是invaild以后 recompile head,先编译body,body预期invaild

### 2.2.4 权限

相关的一个权限：  **ALTER ANY TYPE**

1.  SYS 用户创建的type,需要sysdba用户有权限执行alter type;    (oracle实测不支持)

2.当前user创建的type(user有create type权限),有alter type权限;

3.user1有create any type权限，user1 create user2.type1,user1没有alter type权限；如果非user1创建的user2.type1 user1也没有alter type权限；

4.user1有alter any type权限，可以对除sys下的type执行alter type；

5.除上述的其他type权限，EXECUTE ANY TYPE，DROP ANY TYPE，UNDER ANY TYPE 无alter type权限。

权限视图：check_sys_privilege 函数，

### 2.2.5 审计

执行alter type操作要记审计。涉及场景：

1.对alter any type权限进行审计

2.对alter type行为进行审计

3.对莫个对象上的alter type行为进行审计

策略：创建审计策略，alter type相关的权限或行为能够被审计到。审计日志。

### 2.2.6 集群场景

集群alter type不单独加锁。验证在多实例上replace,drop 和alter type;以及并发场景。

  


多创建一些有依赖的type,导入数据库；然后再重编译。

分布式上验证拦截

## 2.3 规格约束

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

1.语法图–采用路径覆盖，遍历路径分支及可选参数。

  


2.对type的依赖关系使用场景分析法。

例如B依赖A，C依赖B。 A，B, C可能有如下几种情况：

|  
|A|B|C|
|---|---|---|---|
|UDT type在其他plsql对象中使用|UDT type|procedure、function（形参，return type, local UDT）,UDP(pkg head,pkg body),object的方法（head-形参，内部-实参）|  
|
|UDT type 嵌套|object type1,VARRAY type1,nested table type1|object type2,VARRAY type2,nested table type2|object type3,VARRAY type3,nested table type3|
|object type 继承|父类型object type1|子类型object type2|  
|
|object head&body|object1 head|object1 body|  
|


**DBA_DEPENDENCIES视图**  会记依赖关系。

3.采用错误推测法，分析重编译失败的可能场景。

- 对象不存在；
- 无alter type权限；
- type存在编译错误；
- type依赖的对象不存在或者是INVAILD状态，且重编译后还是INVAILD。


## 3.2 详细测试设计

1. 
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


[alter type compile.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGI4OTcwYzJhZjRmNTIwNTVmIiwicmVmX2lkIjoiNjczOTZiOGI3MjgyMDZlZmI5MmYwNzYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzY2LCJleHAiOjE3ODIzODE3NjZ9.MZp_KmUzBO1LINXyAa767Dkj6g9aI6MlEoMtl7ffQqw)

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 用例自动化用到guider,testkill两个测试框架，初步看没有不能自动化用例。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：11.13

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGJhMWFkOWEzMzExZGM4M2Q1IiwicmVmX2lkIjoiNjczOTZiOGI3MjgyMDZlZmI5MmYwNzYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzY2LCJleHAiOjE3ODIzODE3NjZ9.2DadZTUU3Ccx_2I9nzzDGxg0rFPf0SRZGVBc9mW227Q)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGJhMWFkOWEzMzExZGM4M2Q1IiwicmVmX2lkIjoiNjczOTZiOGI3MjgyMDZlZmI5MmYwNzYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzY2LCJleHAiOjE3ODIzODE3NjZ9.2DadZTUU3Ccx_2I9nzzDGxg0rFPf0SRZGVBc9mW227Q)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGI4OTcwYzJhZjRmNTIwNTYwIiwicmVmX2lkIjoiNjczOTZiOGI3MjgyMDZlZmI5MmYwNzYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzY2LCJleHAiOjE3ODIzODE3NjZ9.9RtGoOLo3lKhcEtKAnlc_3jDrbDqzQ4a-9hPkhxZLg8)

 (application/msword)    


[alter type compile.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGI4OTcwYzJhZjRmNTIwNTVmIiwicmVmX2lkIjoiNjczOTZiOGI3MjgyMDZlZmI5MmYwNzYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzY2LCJleHAiOjE3ODIzODE3NjZ9.MZp_KmUzBO1LINXyAa767Dkj6g9aI6MlEoMtl7ffQqw)

 (application/x-xmind)    
