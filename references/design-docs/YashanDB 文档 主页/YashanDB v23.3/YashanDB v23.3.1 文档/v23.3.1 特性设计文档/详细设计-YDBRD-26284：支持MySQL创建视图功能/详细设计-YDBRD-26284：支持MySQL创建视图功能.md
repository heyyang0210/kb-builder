Created by 林永豪, last modified on 七月 21, 2024

*IR链接：*    [YASHAN-929](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f1? #YASHAN-929  【mysql兼容】（功能&语法）支持SCHEMA、双@@参数变量等的特定特性)  

*SR链接：*    [YDBRD-26284](https://pingcode.yasdb.com/pjm/items/6619169cfd997db58ad89606? #YDBRD-26284 支持MySQL创建视图功能)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=150618898](https://conf.yasdb.com/pages/viewpage.action?pageId=150618898)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|创建视图功能支持|见特性设计|是|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|![](https://pingcode.yasdb.com/atlas/files/public/67396ee08970c2af4f521c18/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ2MjIsImV4cCI6MTc4MjQ1NTQyMn0.m7Ok4-CeSqWr_Qe9LiZU0-L4z1Nn8QujAhD05RoPOPg)|----|是|
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

（1）这个SR的测试范围，不包括存储过程，因为存储过程目前还不支持。

（2）algorithm交付范围：

仅支持语法解析，内部实际功能暂未实现

（3）with check option交付范围：

仅支持语法解析，内部实际功能暂未实现

（4）definer交付范围：

支持username和username@hostname两种语法形式。

username支持CURRENT_USER和CURRENT_USER()关键字的语法解析且用户识别为当前会话用户；支持常规名称，常规名称遵循yashan命名规则且可以用反引号括起。

hostname支持语法解析，包括%和常规名称，常规名称遵循yashan命名规则。但实际执行功能未生效。可以用双引号、单引号、反引号括起。

**注意：**

**view的所有者和definer无关。如果当前指定了view的所有者（比如regress.v1），则视图的所有者是指定用户；不指定view所有者时，view的所有者默认为创建会话的schema；**

**definer的指定，是给sql security服务的，和view的所有者无关。**

（5）sql security交付范围：

支持definer和invoker关键字语法解析。

访问view时，会访问view中引用到的对象（表、视图等）。指定definer的情况下，会检查view的definer对引用到的对象是否有访问权限；指定invoker的情况下，会检查当前访问view的用户对引用到的对象是否有访问权限。

（6）algorithm、definer、sql security是按序的，可缺省但是不能重复设置

（7）view的访问对象是私有临时表的情况，不支持，报错

mysql服务端吐回报错ERROR 1352 (HY000): View's SELECT refers to a temporary table 'temp_table_name'

yashan兼容性吐回报错ERROR 2012 (HY000): ERROR 4348 (HY000): YAS-04348 transactional private temporary table YAS$PTT_TEST_TEMPORARY_PRIVATE_TABLE_DELETE is not allowed here

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

围绕create or replace view、drop view来设计

###   [4.2 特性功能点1 mysql和yashan访问schema的差异](#42-特性功能点1-mysql和yashan访问schema的差异)  

- mysql服务端，select子句里的table对象，如果不指定schema则默认使用当前会话schema；
- yashan服务端，select子句里的对象，如果不指定schema则默认使用视图的schema，如果视图的schema也没指定则默认当前会话schema。


###   [4.3 特性功能点2 新增系统表](#43-特性功能点2-新增系统表)  

STORED_OBJECT_OPTIONS，表结构：

```

SQL&gt; desc MYSQL.STORED_OBJECT_OPTIONS$
NAME                                                             NULL?     DATATYPE                          
---------------------------------------------------------------- --------- --------------------------------- 
OBJ#                                                             NOT NULL  BIGINT
CREATE_SCHEMA_ID                                                           SMALLINT
DEFINER_ID                                                                 SMALLINT
DEFINER_CTIME                                                              DATE                          
SECURITY_TYPE_ID                                                           TINYINT                           
HOST                                                                       VARCHAR(64)

```

obj# : 视图的object id

create_schema_id : 创建视图的时候，当前会话的user id

definer_id : 创建视图的时候，如果指定了definer，则为definer对应的user id；默认情况下是当前会话的user id

definer_ctime：创建视图时的时间

security_type_id：为0对应definer，为1对应invoker

host：主机信息字符串

###   [4.4 特性功能点3 definer和invoker适配](#44-特性功能点3-definer和invoker适配)  

当sql security指定为definer时，会看view的owner 是否有 view中depTables的owner权限，和原先yashan实现逻辑一致，不需额外适配；

当sql security指定为invoker时，会看view当前的调用者 是否有 view中depTables的owner权限，需要适配。

###   [4.3 特性性能点1](#43-特性性能点1)  

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

![](https://conf.yasdb.com/download/attachments/150618898/create_view.GIF?version=2&modificationDate=1713842156000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ2MjIsImV4cCI6MTc4MjQ1NTQyMn0.m7Ok4-CeSqWr_Qe9LiZU0-L4z1Nn8QujAhD05RoPOPg)

## Attachments:

[image2024-4-26_10-29-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTBhMWFkOWEzMzExZGM5YThjIiwicmVmX2lkIjoiNjczOTZlZTA3MjgyMDZlZmI5MmYyZGRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NjIxLCJleHAiOjE3ODI1MzEwMjF9.-eWTPS6SO8UicNsIudrHw_c5H2tp7nO1b59J2oFKQzQ)

 (image/png)    
