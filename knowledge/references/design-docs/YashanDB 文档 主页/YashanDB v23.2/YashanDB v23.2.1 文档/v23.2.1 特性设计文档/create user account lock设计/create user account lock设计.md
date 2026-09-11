Created by 张志鹏, last modified on 十二月 18, 2023

  


#   [YDBRD-22070 create user account lock design](#ydbrd-22070-create-user-account-lock-design)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-22070](https://jira.yasdb.com/browse/YDBRD-22070)  

##   [1. Overview（概述）](#1-overview概述)  

支持在创建用户的同时锁定用户。

##   [2. Features（功能特性）](#2-features功能特性)  

支持create user xxx identified by yyy account lock/unlock    
  account lock状态用户登录报错

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
syntax::= CREATE USER user_name 
([
IDENTIFIED BY [VALUES] password
| DEFAULT TABLESPACE tablespace
| PROFILE profilename
| ACCOUNT (LOCK|UNLOCK)
])
{" " 
([
IDENTIFIED BY [VALUES] password
| DEFAULT TABLESPACE tablespace
| PROFILE profilename
| ACCOUNT (LOCK|UNLOCK)
])}

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

account lock/unlock子句不可重复

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

create user account lock和alter user account lock(已实现功能）可复用一套解析执行流程，改动很小解析 account lock/unlock语法，记录系统表。可通过dba_users查看ACCOUNT_STATUS。

###   [5.1 Architecture（架构）](#51-architecture架构)  

略

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

略

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

无影响

###   [5.4 DFX设计](#54-dfx设计)  

略

###   [5.5 其他](#55-其他)  

略

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

以下创建成功均要测试登录表现，需要grant create session 权限。    
  create user xxx identified by yyy account lock  预期创建成功，用户被锁定，无法登录create user xxx identified by yyy account unlock  创建成功，可登录create user xxx identified by yyy  创建成功，可登录create user xxx account lock identified by yyy  创建成功，锁定create user xxx account;   报错语法错误create user xxx account lockk  报错，语法错误create user xxx account lock account unlock; 报错

##   [7.资料设计章节](#7资料设计章节)  

  [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20USER.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20USER.html)  

doc/产品文档/开发手册/SQL参考手册/SQL语句/CREATE USER.md

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

无

## Attachments:

[image2023-12-13_9-26-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDM4OTcwYzJhZjRmNTIwOGI4IiwicmVmX2lkIjoiNjczOTZjMDM1OTNmOTljOWZmMjM2OTRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDk1LCJleHAiOjE3ODIzODQ4OTV9.gpSHpQwaTvI7am_iTz94nSkjkbGMlHD5AYcoV6fJVvs)

 (image/png)    


[image2023-12-13_9-26-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDNhMWFkOWEzMzExZGM4NzJiIiwicmVmX2lkIjoiNjczOTZjMDM1OTNmOTljOWZmMjM2OTRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDk1LCJleHAiOjE3ODIzODQ4OTV9.jTAMIHDLLJchidVDOywv7la-RyGdtfoWYr01Do0YRdI)

 (image/png)    


[image2023-11-1_10-11-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDM4OTcwYzJhZjRmNTIwOGI5IiwicmVmX2lkIjoiNjczOTZjMDM1OTNmOTljOWZmMjM2OTRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDk1LCJleHAiOjE3ODIzODQ4OTV9.7d_p8ehdzYYrcQkvrr6oWoA1RCDx94tmUTNhoiUUJuY)

 (image/png)    


[image2023-11-1_10-11-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDNhMWFkOWEzMzExZGM4NzJjIiwicmVmX2lkIjoiNjczOTZjMDM1OTNmOTljOWZmMjM2OTRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDk1LCJleHAiOjE3ODIzODQ4OTV9.1cUbekLivPxDRVQNN98Y9MXtc4VZnW4w2fBkfiepIx0)

 (image/png)    


[image2023-11-1_9-59-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDM4OTcwYzJhZjRmNTIwOGJhIiwicmVmX2lkIjoiNjczOTZjMDM1OTNmOTljOWZmMjM2OTRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDk1LCJleHAiOjE3ODIzODQ4OTV9.1twh2CdIyCjtBQpvnuDMa7awyGHzRN-1QKHRUSqZzK0)

 (image/png)    


[image2023-11-1_9-58-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDM4OTcwYzJhZjRmNTIwOGJiIiwicmVmX2lkIjoiNjczOTZjMDM1OTNmOTljOWZmMjM2OTRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDk1LCJleHAiOjE3ODIzODQ4OTV9.TKWoFMDvDp3s3fl3fSWcYqR2N7rL7d0ipyyklsG6CqE)

 (image/png)    
