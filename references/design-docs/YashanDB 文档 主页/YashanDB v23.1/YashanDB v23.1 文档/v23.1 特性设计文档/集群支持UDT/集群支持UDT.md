Created by 郝鑫刚, last modified on 六月 09, 2023

#   [YDBRD-13623](https://jira.yasdb.com/browse/YDBRD-13623?src=confmacro)    -  UDT的集群化改造  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

UDT的功能适配在集群下正常使用。

1.1 集群下一个实例上CREATE/REPLACE TYPE后可以在其它实例上使用TYPE。

1.2 集群下一个实例上DROP TYPE后其它实例上也不能使用。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

  


|功能|  
|  
|
|:---|:---|:---|
|CREATE/REPLACE TYPE,DROP TYPE,CREATE/REPLACE TYPE BODY,DROP TYPE BODY,CREATE TABLE|  
|  
|
|DML、匿名块中使用UDT类型|  
|  
|


  


  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

  


  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

  


本次无新增功能，只是适配UDT的原有功能在集群多实例下的使用。

由于PROCEDURE、FUNCTION、PACKAGE、TRIGGER等还未适配集群，需要用匿名块验证。

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

UDT本身的并发控制策略：

|场景|并发策略|  
|  
|
|---|---|---|---|
|CREATE TYPE|OBJ$索引控制无并发|  
|  
|
|REPLACE TYPE|udtOpenDictWithLock|置无效，重新加载|  
|
|DROP TYPE |udtOpenDictWithLock|置无效，重新加载|  
|
|CREATE TYPE BODY|如果存在TYPE: udtOpenDictWithLock|置无效，重新加载|  
|
|REPLACE TYPE BODY|如果存在TYPE: udtOpenDictWithLock|置无效，重新加载|  
|
|DROP TYPE BODY|如果存在TYPE: udtOpenDictWithLock|置无效，重新加载|  
|
|CREATE TABLE|lockUdtDictShared,获取DictEntry共享锁。,获取子TYPE的共享锁。|  
|  
|
|DML、过程体|anlOpenUdtDictByToid,ankOpenUdtDictByToid,openAdtDict|复用context时会检测是否都有效。,TYPE不存在会报错。,获取时无效会重新load。|  
|
|嵌套表|同CREATE TABLE/ DML|无独立的DictEntry结构。在父表的column上保存相关数据。|  
|
|对象表|同CREATE TABLE/ DML|和表里一列是OBJECT时一致。|  
|


  


**udtOpenDictWithLock**  ():

获取DictEntry上执行锁。

获取当前TYPE使用的其它TYPE的共享锁。

获取使用当前TYPE的其它TYPE（往上递归）的执行锁。

底层使用doLockTableExclusive接口。

![](https://pingcode.yasdb.com/atlas/files/public/67396b528970c2af4f5203ba/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBWUFBQUFBQUFBQUFBQUFBQUFBQ0lBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUNBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUVBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTMwMjYsImV4cCI6MTc4MjMwMzgyNn0.1pyTcjX5PUS2crROqV-YpAjFHNs3XHWoTdWMIGdyYy0)

  


  


|场景|适配|  
|
|---|---|---|
|udtOpenDictWithLock,lockUdtDictShared|底层axcLockTable接口适配UdtDict结构。,  
,放锁时失效要适配TYPE。doInvalidateLockedObject|axcLockTable有获取TYPE的集群锁。|
|  
|  
|  
|
|CREATE TYPE|commit时写实例消息创建其它实例entry。|  
|
|REPLACE TYPE|udtOpenDictWithLock,commit时实例消息让其它实例UdtDict失效|  
|
|DROP TYPE |udtOpenDictWithLock,unLockProc时写实例消息删除其它实例的DictEntry。|  
|
|CREATE TYPE BODY|udtOpenDictWithLock,commit时写实例消息让集群UdtDict失效。|TYPE存在时axcLockTable有获取oid对应的集群锁。,TYPE不存在时只写表就可以。|
|REPLACE TYPE BODY|udtOpenDictWithLock,commit时写实例消息让集群UdtDict失效。|  
|
|DROP TYPE BODY|udtOpenDictWithLock,commit时写实例消息让集群UdtDict失效。|  
|
|CREATE TABLE|lockUdtDictShared,TYPE的DictEntry同步后天然支持。|axcLockTable有获取TYPE的集群锁。|
|DML、过程体|TYPE的DictEntry同步后天然支持。|  
|
|嵌套表|在TRUNCATE TABLE等操作中要去掉对嵌套表的集群消息。|  
|
|对象表|同DML使用|  
|


  


时序问题：

1. CREATE TYPE时增加获取gls X锁的步骤。commitProc中先放锁再insertIndex。
1. 其它DDL调udtOpenDictWithLock时会同时获取gls X锁。
1. 收到所有实例处理完消息后再放锁。
1. 所有DDL操作加gls X锁可以保证部分先收到消息的实例无法在所有实例未处理完当前消息前做DDL操作。


![](https://pingcode.yasdb.com/atlas/files/public/67396b528970c2af4f5203bb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBWUFBQUFBQUFBQUFBQUFBQUFBQ0lBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUNBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUVBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTMwMjYsImV4cCI6MTc4MjMwMzgyNn0.1pyTcjX5PUS2crROqV-YpAjFHNs3XHWoTdWMIGdyYy0)

  


|实例0\实例n|CREATE TYPE |ALTER TYPE |DROP TYPE|
|---|---|---|---|
|CREATE TYPE|OBJ$唯一约束|gls X锁,所有实例执行完CreateType消息后才可以执行。|gls X锁,所有实例执行完CreateType消息后才可以执行。|
|ALTER TYPE,(replace type/,type body ddl,X锁自动失效)|OBJ$唯一约束|gls X锁,所有实例执行完AlterType消息后才可以执行。|gls X锁,所有实例执行完AlterType消息后才可以执行。|
|DROP TYPE|存在特殊情况，如下说明|gls X锁 + 事务提交后报错|gls X锁 + 事务提交后报错|


  


特殊情况：

DROP时候其它实例处理消息有先后，未处理完的实例上由于gls X锁无法做DDL操作，处理完DROP的可以创建同名TYPE，那么第三个实例存在DROP、CREATE的两个消息乱序问题。

![](https://pingcode.yasdb.com/atlas/files/public/67396b528970c2af4f5203bc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBWUFBQUFBQUFBQUFBQUFBQUFBQ0lBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUNBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUVBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTMwMjYsImV4cCI6MTc4MjMwMzgyNn0.1pyTcjX5PUS2crROqV-YpAjFHNs3XHWoTdWMIGdyYy0)

  


嵌套表的适配：

|场景|问题|解决方案|
|---|---|---|
|第一次INSET时|MSG_SSM_ENTRY中无法单从oid获取到嵌套表的DictEntry|消息中增加基表到嵌套表的关系|
|大数据INSERT|有btree缓存消息广播无法获取到嵌套表的DictEntry|嵌套表不发btree消息|
|跨实例DML中有table列的filter|ankGetUdtTableColumnValue提前RESTORE_STACK，然后在接口中有消息处理流程使用栈，导致栈数据错误|函数执行完后再  RESTORE_STACK|


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考**  ** **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** **  **）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考**  ** **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** **  **）。用于支撑测试方案的灰盒测试。**

  


**参考 gAXCMsgProcessor 中的实现DictEntry同步。**

  


1. 函数接口


|name|Meaning|
|:---|:---|
|AXC_CB->axcBcstCreateType|广播同步create type消息|
|AXC_CB->axcBcstDropType|广播同步drop type消息|
|AXC_CB->axcBcstAlterType|广播同步alter type消息|


1. 消息接口


|name|function|Meaning|
|:---|:---|:---|
|MSG_CREATE_TYPE|msgCreateType|执行实例广播创建TYPE的DictEntry|
|MSG_CREATE_TYPE_ACK|msgNullFunc|  
|
|MSG_DROP_TYPE|msgDropType|执行实例广播删除TYPE的DictEntry|
|MSG_DROP_TYPE_ACK|msgNullFunc|  
|
|MSG_ALTER_TYPE|msgAlterType|执行实例广播失效TYPE的UdtDict|
|MSG_ALTER_TYPE_ACK|msgNullFunc|  
|


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 实例0 create type，实例1、2端验证type的存在。   √
1. 实例0 drop type，实例1、2验证type的销毁。 
1. 实例0 create/replace/drop type body，实例1、2验证type的变化。 
1. 实例0 replace type，实例1、2验证type的变化
1. 验证以上ddl的交叉并发是否正确
1. 验证以上ddl与type的使用并发是否正确。如create type与使用该type的匿名块并发。


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及资料变动。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-5-14_12-0-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTJhMWFkOWEzMzExZGM4MjJlIiwicmVmX2lkIjoiNjczOTZiNTI3MjgyMDZlZmI5MmYwNDVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzMDI2LCJleHAiOjE3ODIzNzk0MjZ9.06TEmI3YGoyg2uqEYthaQx-ZlEGmI8nWC1HEsgyd3r4)

 (image/png)    
