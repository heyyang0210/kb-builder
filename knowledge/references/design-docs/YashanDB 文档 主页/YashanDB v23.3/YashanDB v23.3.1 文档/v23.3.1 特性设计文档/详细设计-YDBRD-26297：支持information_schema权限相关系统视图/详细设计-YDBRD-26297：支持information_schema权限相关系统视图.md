Created by 赵忠源, last modified on 七月 17, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66192c17fd997db58ad8a633](https://pingcode.yasdb.com/pjm/items/66192c17fd997db58ad8a633)    *?*    
  *#YDBRD-26297 支持information_schema字符集相关系统视图*

##   [1. 总述](#1-总述)  

支持information_schema权限相关系统视图：SCHEMA_PRIVILEGES    
  TABLE_PRIVILEGES    
  USER_PRIVILEGES

###   [1.1 需求来源](#11-需求来源)  

mysql兼容

###   [1.2 调研文档](#12-调研文档)  

调研文档    [https://conf.yasdb.com/pages/viewpage.action?pageId=156122479](https://conf.yasdb.com/pages/viewpage.action?pageId=156122479)  

###   [1.3 需求分析](#13-需求分析)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|SCHEMA_PRIVILEGES|添加视图查询流程|是|是|
|功能|TABLE_PRIVILEGES|添加视图查询流程|是|是|
|功能|USER_PRIVILEGES|添加视图查询流程|是|是|
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


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SELECT 语法查询|SELECT * FROM INFORMATION_SCHEMA.SCHEMA_PRIVILEGES/TABLE_PRIVILEGES/USER_PRIVILEGES|----|是|
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

SCHEMA_PRIVILEGES视图

|GRANTEE|TABLE_CATALOG|TABLE_SCHEMA|PRIVILEGE_TYPE|IS_GRANTABLE|
|---|---|---|---|---|
|user@host|def|USER|mysql.db下对应priv列为yes，每个为一行|是否有grant权限（grant_priv）|


TABLE_PRIVILEGES视图

|GRANTEE|TABLE_CATALOG|TABLE_SCHEMA|TABLE_NAME|PRIVILEGE_TYPE|IS_GRANTABLE|
|---|---|---|---|---|---|
|user@host|def|TABLE所属SCHEMA|TABLE_NAME|mysql.tables_priv下对应priv列为yes，每个为一行|是否有grant权限（grant_priv）|


USER_PRIVILEGES视图

|GRANTEE|TABLE_CATALOG|PRIVILEGE_TYPE|IS_GRANTABLE|
|---|---|---|---|
|user@host|def|mysql.user下对应priv列为yes，每个为一行|是否有grant权限（grant_priv）|


视图中GRANTABLE字段主要指obj所属用户是否有grant权限，PRIVILEGE_TYPE主要为obj对应的权限

视图信息均取自于mysql.db， mysql.user, mysql.tables_priv三表，与三表对齐    
  约束上同mysql.db， mysql.user, mysql.tables_priv三表    
  yasdb各系统用户权限上与mysql不完全对齐，行为上以三表为准    
  本需求内添加新权限类型，mysql USAGE权限对应yasdb的create session权限    
  schema权限暂未实现，目前暂不关注，后续schema权限需求上车后补齐

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

本需求同mysql，查询视图对应的 mysql.db， mysql.user, mysql.tables_priv

前置需求设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=150618848](https://conf.yasdb.com/pages/viewpage.action?pageId=150618848)  

###   [4.1 支持SCHEMA_PRIVILEGES视图](#41-支持schema-privileges视图)  

添加information_schema视图，查询mysql.db对应列

###   [4.2 支持TABLE_PRIVILEGES视图](#42-支持table-privileges视图)  

添加information_schema视图，查询mysql.tables_priv对应列

###   [4.3 支持USER_PRIVILEGES视图](#43-支持user-privileges视图)  

添加information_schema视图，查询mysql.user对应列

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

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

## Attachments:

[image2024-6-18_16-11-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTJhMWFkOWEzMzExZGM5YTk1IiwicmVmX2lkIjoiNjczOTZlZTI1OTNmOTljOWZmMjM4YTYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NzE3LCJleHAiOjE3ODI1MzExMTd9.urpdJqlRtaONkYeb1nD5rRBQi6tNZ2UTIsfyRVkakwo)

 (image/png)    


[image2024-6-18_16-11-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZTI4OTcwYzJhZjRmNTIxYzIzIiwicmVmX2lkIjoiNjczOTZlZTI1OTNmOTljOWZmMjM4YTYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NzE3LCJleHAiOjE3ODI1MzExMTd9.XWm3EzgsGNA24WU8vrGWs_p9fht_SLieTzv7Nyt-bwE)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要,1. schema_priv仅有字段，数据等schema权限需求后实现
1. information_schema权限同前面需求
,Posted by zhaozhongyuan at 七月 01, 2024 11:34|
|---|
