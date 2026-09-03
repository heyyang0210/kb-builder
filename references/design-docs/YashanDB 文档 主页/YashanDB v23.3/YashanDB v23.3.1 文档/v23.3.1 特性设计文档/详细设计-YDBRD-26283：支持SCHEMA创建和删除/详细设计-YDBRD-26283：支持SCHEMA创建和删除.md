Created by 林永豪, last modified on 五月 14, 2024

*IR链接：*    [YASHAN-929](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f1? #YASHAN-929  【mysql兼容】（功能&语法）支持SCHEMA、双@@参数变量等的特定特性)  

*SR链接：*    [YDBRD-26283](https://pingcode.yasdb.com/pjm/items/66191659fd997db58ad89545? #YDBRD-26283 支持SCHEMA创建和删除)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=150618884](https://conf.yasdb.com/pages/viewpage.action?pageId=150618884)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|四条语句类型支持|见特性设计|是|是|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|
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
|create_schema语法|![](https://pingcode.yasdb.com/atlas/files/public/67396ee0a1ad9a3311dc9a88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4),![](https://pingcode.yasdb.com/atlas/files/public/67396ee08970c2af4f521c15/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)|----|是|
|alter_schema语法|![](https://pingcode.yasdb.com/atlas/files/public/67396ee0a1ad9a3311dc9a8a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4),![](https://pingcode.yasdb.com/atlas/files/public/67396ee0a1ad9a3311dc9a8b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)|----|是|
|drop_schema语法|![](https://pingcode.yasdb.com/atlas/files/public/67396ee08970c2af4f521c16/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)|----|是|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|新增ERR_CMM_INVALID_COLLATION_NAME（请输入合法的排序规则名）|----|是|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

（1） create schema

- 1.功能支持范围：create option中，CHARACTER SET和COLLATE只支持语法层面的设置，实际功能不生效。create schema语句执行后，内部会新增对应user。
- 2.支持if not exists设置，if not exists可以作为可选项表示。带有if not exists时，无论是否有此schema，都返回成功。不带if not exists时，如果已经有此schema，会报错schema已存在
- 3.create schema option，支持同一个设置项 在值相等的情况下重复设置多次，在值不相等的情况下不能重复设置多次，会报错冲突


（2） alter schema

- 1.功能支持范围：alter option中，CHARACTER SET和COLLATE只支持语法层面的设置，实际功能不生效。内部暂时也没更改user的元数据信息。
- 1.alter schema option，支持同一个设置项 在值相等的情况下重复设置多次，在值不相等的情况下不能重复设置多次，会报错冲突


（3） drop schema

- 1.功能支持范围：drop schema语句执行后，内部会删除对应user。
- 2.支持if exists设置，if exists可以作为可选项表示。带有if exists时，无论是否有此schema，都返回成功。不带if exists时，如果没有此schema，会报错schema不存在。特殊情况下，比如，该schema正在被使用，此时无法被删除，则会返回错误。如果返回结果成功，一定只有一个结果，这个schema不存在了。


（4）支持以下mysql兼容语法，且映射yashan SQL语句类型为：

|支持的mysql兼容语法|映射的yashan SQL语句类型|
|---|---|
|create schema|SQL_CREATE_USER|
|alter schema|SQL_ALTER_USER|
|drop schema|SQL_DROP_USER|


（5）支持以下mysql字符集设置，且映射yashan字符集为：

|支持设置的mysql字符集|映射到的yashan字符集|
|---|---|
|ASCII|ASCII|
|GB18030|GB18030|
|GBK|GBK|
|LATIN1|ISO8859-1|
|UTF16|UTF-16|
|UTF8|UTF-8（注意：mysql的utf8最大支持3字节，mysql的utf8mb4最大支持4字节，yashan的utf-8最大支持4字节。）|
|UTF8MB4|UTF-8|
|UTF8MB3|UTF-8|


（6）支持以下mysql字符序设置，且映射yashan字符序为：

|支持设置的mysql字符序|映射到的yashan字符序|绑定哪个字符集|
|---|---|---|
|UTF8MB4_BIN|UTF8_GENERAL_CS|UTF8|
|UTF8MB4_GENERAL_CI|UTF8_GENERAL_CI|UTF8|


注意：utf8mb4_0900_ai_ci不是mysql5.7特性，mysql兼容性开发对齐mysql5.7特性，所以不支持utf8mb4_0900_ai_ci

（7）设置字符集和字符序，仅支持语法设置，实际功能未生效。功能生效在 SR YDBRD-26264 和 SR YDBRD-26265实现。

（8）schema名称、字符集名称和字符序名称，支持使用单引号、双引号、反引号括起

（9）和mysql的差异：

- 1.mysql官方文档中提到：CREATE DATABASE is not permitted within a session that has an active LOCK TABLES statement. 但yashan目前还不支持lock tables，所以这个yashan暂未实现该功能。
- 2.mysql官方文档中提到：Each create_option specifies a database characteristic. Database characteristics are stored in the db.opt file in the database directory. 但yashan不会将设置存入opt文件中，只支持语法设置。
- 3.schema名称命名规范，遵循yashan的命名规则。
- 4.create/alter/drop schema的前提是要有create/alter/drop user的权限。
- 5.create/alter/drop schema的数据库对象操作，对应yashan的create/alter/drop user。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

围绕create schema、drop schema、alter schema三个特性来设计

###   [4.2 特性功能点2：匹配字符集和字符序](#42-特性功能点2匹配字符集和字符序)  

匹配字符集和字符序，用gMyCharsetTokens声明支持设置的mysql字符集，用gMyCollationTokens声明支持设置的mysql字符序。数据结构为MyCharsetToken

```
typedef struct StMyCharsetToken
{
    CodText   name;
    CodUint32 id;
    CodUint16 mapValue;     // 表示映射到yashan的字符集，或表示映射到yashan的字符序
    CodUint8  reversed[2];
} MyCharsetToken;

typedef MyCharsetToken MyCollationToken;

用二分查找思路匹配并校验正确性。

```

**注意：如果设置的字符序，其绑定的字符集如果和之前设置的字符集不同，则报错COLLATION '字符序名称' is not valid for CHARACTER SET '字符集名称'**

###   [4.2 特性功能点2：if exists和if not exists的实现](#42-特性功能点2if-exists和if-not-exists的实现)  

- 1.if exists，是在存储层ankDropUser时发挥作用，如果带有if exists则不报错，否则要报错user本来就不存在。所以需要注册回调，存储层ankDropUser时发现user不存在时，回调检查是否处于mysql兼容模式且带有if exists且当前错误码是否为ERR_ANK_USER_NOT_FOUND。都满足的话则不报错。
- 2.if not exists，是在存储层ankCreateUser时发挥作用，如果带有if not exists则不报错，否则要报错user本来就已经存在。所以需要注册回调，存储层ankCreateUser时发现user已经存在时，回调检查是否处于mysql兼容模式且带有if not exists且当前错误码是否为ERR_ANK_OBJECT_ALREADY_EXISTS。都满足的话则不报错。


###   [4.3 特性功能点3：解析](#43-特性功能点3解析)  

增加myParseCreateDatabase、myParseAlterDatabase、myParseDropDatabase解析流程，处理mysql兼容解析。校验和执行直接调用原先yashan user的对应流程。

###   [4.4 特性功能点4：UTFMB3处理](#44-特性功能点4utfmb3处理)  

mysql的UTF8MB3、UTF8（两者等价，都是最大字节是3的utf8）规则，暂先统一映射成yashan的utf8来处理，yashan的utf8是最大字节是4的utf8。

###   [4.5 特性功能点5: schema、database在存储内部的实现](#45-特性功能点5-schemadatabase在存储内部的实现)  

mysql的schema、database相当于yashan的user，但是这种用户是一种被强制锁定的用户。这种用户没有权限，不能使用其来登录。

考虑以下场景：

mysql中的root用户下，create schema test_schema。则在root用户下show databases，能看到test_schema。但是在regress用户下show databases，则不能看到test_schema。这样看来，schema是user的附属。然后table又是schema的附属。

但是mysql的schema、database映射成yashan的user后，那么对于yashan服务端兼容模式来说，schema、database和user是平级。那此时如果先执行create schema test_schema后再执行create user test_schema的话会报错用户已存在，反过来也是如此。这是不希望看到的。

**为了解决这个问题，设计如下方案：**

在yashan服务端，schema还是用user$存，但schema的名字用一张单独的新系统表（命名为MYSQL.SCHEMA$）存，user$里存的名字是一个内部的名字（加“$MY_”前缀），新系统表里记下原名字到内部名字的对应关系。

不直接加前缀存到user$里的原因是，会导致索引走不了。所以得新增系统表增加对应关系。

注意：后续实现create user时，要和create database/schema不同。create user不需写MYSQL.SCHEMA$，而create database/schema要写MYSQL.SCHEMA$

```
SQL&gt; desc MYSQL.DATABASE$
NAME                                                             NULL?     DATATYPE                          
---------------------------------------------------------------- --------- --------------------------------- 
USER#                                                            NOT NULL  SMALLINT                            
SCHEMA_NAME                                                      NOT NULL  VARCHAR(64)                       
MAP_NAME                                                                   VARCHAR(64)  


```

- 在把映射后的MAP_NAME在存储落表之前，先做action_select去查MYSQL.SCHEMA$系统表是否有原先的SCHEMA_NAME


###   [4.x 特性性能点1](#4x-特性性能点1)  

###   [4.x 特性性能点2](#4x-特性性能点2)  

###   [4.x 特性可维可测设计](#4x-特性可维可测设计)  

###   [4.x 特性安全设计](#4x-特性安全设计)  

###   [4.x 特性周边配合](#4x-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

（1）语法支持

（2）创建schema后，在yashan的DBA_USERS上可查。用户查询权限与yashan user特性保持一致，即哪些可在DBA_USERS、ALL_USERS、USER_USERS上能查到。

（3）用mysql客户端和yasql测试

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

支持字符集和字符序的实际功能

![](https://pingcode.yasdb.com/atlas/files/public/67396ee0a1ad9a3311dc9a88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)

![](https://pingcode.yasdb.com/atlas/files/public/67396ee08970c2af4f521c15/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396ee08970c2af4f521c16/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)

![](https://pingcode.yasdb.com/atlas/files/public/67396ee0a1ad9a3311dc9a8a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)

![](https://pingcode.yasdb.com/atlas/files/public/67396ee0a1ad9a3311dc9a8b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFRQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUlnQUFBQUFBQUlBUUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFRUFBQUFBQUFRQUFLZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBSUFBQUFRQkFBQUFBQUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1ODQsImV4cCI6MTc4MjQ1NTM4NH0.03Ep3_BC89aCn1jKfu1MooH-HyJc4REH6nqs5PlyMs4)

  


## Attachments:

[image2024-4-23_9-7-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGY4OTcwYzJhZjRmNTIxYzBmIiwicmVmX2lkIjoiNjczOTZlZGY1OTNmOTljOWZmMjM4YTRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NTg0LCJleHAiOjE3ODI1MzA5ODR9.em4_PZrMPZ0ZA1YuoUF6E2gxRMsNWSRzAMnmassQFWY)

 (image/png)    


[schema.ebnf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGZhMWFkOWEzMzExZGM5YTg0IiwicmVmX2lkIjoiNjczOTZlZGY1OTNmOTljOWZmMjM4YTRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NTg0LCJleHAiOjE3ODI1MzA5ODR9.RNAGFCnymUhaOdyZvuy-vZIBY5oEyaA7jt3UXQv28xs)

 (application/octet-stream)    


## Comments:

|  [](null)  ,schema和user不能重名，遗留,Posted by linyonghao at 四月 26, 2024 11:06|
|---|


