Created by 陈关羽, last modified on 八月 23, 2024

  


#   [YDBRD-26267 : 支持MySQL Use database命令方案设计](#ydbrd-26267--支持mysql-use-database命令方案设计)  

SR链接：    [https://pingcode.yasdb.com/pjm/items/661913a5fd997db58ad89169](https://pingcode.yasdb.com/pjm/items/661913a5fd997db58ad89169)    ?

##   [1. Overview（概述）](#1-overview概述)  

mysql的database与schema同义，基础版的方案将use database视作为alter session set current_schema，默认为切换当前用户。本方案是在已实现的use database命令的基础版本上，主要是在内部对user和schema的区分调整。

##   [2. Features（功能特性）](#2-features功能特性)  

(1) 支持use database命令。

(2) user与schema/database不再等同。

##   [3. Interfaces（接口）](#3-interfaces接口)  

相关接口改动：

```
CodResult myGetMappedUserName(const CodText* orgName, CodUint16 maxNameLen, CodText* userName); //mySchemaToUserName改为myGetMappedUserName

CodResult myInserSysUser(AnlHandler* handler, CodUint16 schemaId, CodPointer compatCtx) //myInsertSysSchema改为myInserSysUser

CodResult myDeleteSysUser(AnlHandler* handler, CodUint16 schemaId) //myDeleteSysSchema改为myDeleteSysUser

CodResult ankGetSchemaProfileIdent(AnkHandler* handler, const CodText* name, UserProfile** profile, CodUint64* ident) // ankGetUserProfileIdent改为ankGetSchemaProfileIdent

CodPointer dcGetUserIdent(AnkHandler* handler, const CodText* name, CodUint8 userDictType, CodUint64* ident) //增加userDictType参数，内部函数逻辑修改为：根据userDictType获取用户身份。

CodResult ddlOpenSchema(AnkHandler* handler, const CodText* userName, UserDict** userDict) //ddlOpenUser改为ddlOpenSchema

UserDict* dcGetSchemaByName(AnkHandler* handler, const CodText* name)  //增加接口dcGetSchemaByName

CodResult ankGetSchemaProfile(AnkHandler* handler, const CodText* name, UserProfile** profile) //增加接口ankGetSchemaProfile

CodResult dcLatchSchemaByName(AnkHandler* handler, const CodText* userName, UserDict** user)  //增加接口dcLatchSchemaByName


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

MySQL兼容下，用户作为一个身份象征，schema作为用户操作的数据库对象。比如，用户user1在创建了schema1.t1表，并执行增删改查操作。见    [调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=162992484)  

示例：

![](https://pingcode.yasdb.com/atlas/files/public/67396ede8970c2af4f521c01/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUNBQUVBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFCQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQkNBQUFBQUFBQUlBQUFJQUFCQUFBRUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1NDQsImV4cCI6MTc4MjQ1NTM0NH0.lxnx8p7yfubialU3wH1fhsZd1ebEJZilhLR1Ya_FLTE)

|对象|表现|示例|
|---|---|---|
|schema|1. create schema schm时，会将直接将schm加到  user$系统表（如果有对象名存在于该系统表，则会报错）。
1. use schm时，切换到schm。
1. 允许对schm：建表，插入数据，修改数据等操作。
1. MySQL模式下创建的schema，不能在yashan模式下用作登录用户。
|![](https://pingcode.yasdb.com/atlas/files/public/67396edea1ad9a3311dc9a74/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUNBQUVBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFCQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQkNBQUFBQUFBQUlBQUFJQUFCQUFBRUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1NDQsImV4cCI6MTc4MjQ1NTM0NH0.lxnx8p7yfubialU3wH1fhsZd1ebEJZilhLR1Ya_FLTE)|
|user|1. create user user时，会加上"$MY_"前缀，并加到  user$系统表（如果有对象名存在于该系统表，则会报错）。
1. 赋予dba权限后，coon user/pwd，切换用户。
1. mysql.schema$ 替换为mysql.user$，从mysql.user$可以查询到所有可以作为登录用户的用户信息。
|![](https://pingcode.yasdb.com/atlas/files/public/67396edea1ad9a3311dc9a75/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUNBQUVBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFCQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQkNBQUFBQUFBQUlBQUFJQUFCQUFBRUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1NDQsImV4cCI6MTc4MjQ1NTM0NH0.lxnx8p7yfubialU3wH1fhsZd1ebEJZilhLR1Ya_FLTE)|
|database|create database user时，等同于执行create schema user，权限与schema一致。|![](https://pingcode.yasdb.com/atlas/files/public/67396ede8970c2af4f521c02/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUNBQUVBQUFBQUFBQUFCQUFDQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFCQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQkNBQUFBQUFBQUlBQUFJQUFCQUFBRUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ1NDQsImV4cCI6MTc4MjQ1NTM0NH0.lxnx8p7yfubialU3wH1fhsZd1ebEJZilhLR1Ya_FLTE)|


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

在处理增删改schema/user/database的流程中，区分schema与user的处理。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

新增结构体UserDictType，区分schema，user属性：

```
typedef enum EnUserDictType {
    USER_DICT_DEFAULT = 0,
    USER_DICT_SCHEMA = 1,
    USER_DICT_IDENTITY = 2
} UserDictType;


```

流程相关改动：区分user与schema两种对象的行为。

|流程阶段|涉及相关主要函数|说明|
|---|---|---|
|解析阶段|myParseCreateUser,myParseAlterSchema,myParseDropSchema|增加对象属性赋值（  parser  ->  context  ->  entry->userDictType）|
|校验阶段|myVerifyCreateUser,myVerifyAlterSchema,myVerifyDropSchema|根据userDictType  区分校验user、schema。,  
|
|执行调用存储接口|ankCreateUser,ankDropUser,ankAlterUser|若是user，向sys.user$插入时加上前缀“$MY_”；若是schema，则直接插入。|


###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

自测关注点：

1. 支持use database/schema命令
1. user/schema/database操作权限的变化


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2024-8-11_16-13-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGVhMWFkOWEzMzExZGM5YTZmIiwicmVmX2lkIjoiNjczOTZlZGU3MjgyMDZlZmI5MmYyZGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NTQ0LCJleHAiOjE3ODI1MzA5NDR9.1q33mgKfjQyZVJsDEFcDWV7_6mTmsabHUCo4o26VLkg)

 (image/png)    


[image2024-8-11_15-29-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGVhMWFkOWEzMzExZGM5YTczIiwicmVmX2lkIjoiNjczOTZlZGU3MjgyMDZlZmI5MmYyZGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NTQ0LCJleHAiOjE3ODI1MzA5NDR9._FvjrCdt1MixcxjKLroyihbAEMo5f_7s4oLPjy8OS1g)

 (image/png)    
