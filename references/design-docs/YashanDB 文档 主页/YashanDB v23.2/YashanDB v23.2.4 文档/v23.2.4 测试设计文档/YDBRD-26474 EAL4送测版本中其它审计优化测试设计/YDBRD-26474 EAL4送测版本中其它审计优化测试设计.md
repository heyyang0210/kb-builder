Created by 刘晓旋, last modified on 十月 09, 2024

# 1. 概述

IR链接：    [#YASHAN-876](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2bc? #YASHAN-876  审计功能增强)  

SR链接：    [#YDBRD-26474](https://pingcode.yasdb.com/pjm/items/661f9ff1fd997db58adbc83c? #YDBRD-26474 在EAL4送测版本中其它审计的优化)  

EAL4 认证后，对涉及的需求落入到正式版本中：  再启停审计、黑白名单审计、记录事务 id 等审计优化

# 2. 需求分析

## 2.1 功能点分析

在 EAL4 认证测试中，对涉及的场景：数据库启动、黑白名单检测、回滚操作记录对应事务的id等，这些场景的审计处理是对统一审计功能的补充和增强，需要落到通用版本中。

1、数据库启动

新增审计项：startup

nomount, mount 方式启动时：审计记录写 run.log 日志文件，其中 object_name 标识 nomount, mount；

open 方式启动时：启动成功写系统表，否则写 run.log 日志文件。

2、  密码口令过期、用户锁定

审计项：LOGON

3、密码登录方式

审计项：LOGON

OBJECT_NAME 新增密码方式：OS、PASSWORD、PASSWORD WITH UKEY、OS WITH UKEY

4、SSL 登录信息

审计项：LOGON

AUTHENTICATION_TYPE   新增：PROTOCOL=tcps

5、违反密码复杂度的报错审计

审计项：CREATE USER、ALTER USER

6、审计表新增事务 ID、ROLE

系统表 UNIFIED_AUDIT_TRAIL   新增2个字段事务 ID、标识用户

事务ID：transaction_id(bigint)

标识用户：  role (varchar(64)：security admin、audit admin、system admin、normal

7、新增黑白名单的审计

新增审计项：ip control

8、审计记录操作添加约束

1）针  对 aud$unified、 unified_audit_trail 视图， 只有具有 audit_admin 权限的用户或 sys 用户才允许查看

2）删除审计记录，有具有 audit_admin 权限的用户或 sys 用户才允许删除

## 2.2 应用场景

EAL4 测评的需求

## 2.3 规格约束

不涉及

  


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：场景法覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用 xmind 的方式*


**功能测试**

|测试场景|测试项|等价类|备注|
|---|---|---|---|
|启动审计，审计事件为 startup|通过 yasboot 方式启动|nomount 拉起，覆盖：启动成功、启动失败，  OBJECT_NAME   记录   nomount,mount 拉起，覆盖：启动成功、启动失败，  OBJECT_NAME   记录   mount,open 拉起，覆盖：启动成功、启动失败|  
|
|  
|通过手动启动 |nomount 拉起，覆盖：启动成功、启动失败，  OBJECT_NAME   记录   nomount,mount 拉起，覆盖：启动成功、启动失败，  OBJECT_NAME   记录   nomount,open 拉起，覆盖：启动成功、启动失败|  
|
|  
|通过 alter database 切换状态|nomount 拉起，不记录审计事件,mount 拉起，不记录审计事件,open 拉起，不记录审计事件|  
|
|密码口令过期、用户锁定|口令过期|登录失败|  
|
|  
|用户锁定|登录失败|  
|
|密码登录方式|OS 认证登录|登录成功，  OBJECT_NAME   记录   OS,登录失败，  OBJECT_NAME   记录   OS|  
|
|  
|口令认证登录|登录成功，  OBJECT_NAME   记录 PASSWORD,登录失败，  OBJECT_NAME   记录 PASSWORD|  
|
|  
|UKEY + OS 认证登录|登录成功，  OBJECT_NAME   记录 OS WITH UKEY,登录失败，  OBJECT_NAME   记录 OS WITH UKEY|  
|
|  
|UKEY + 口令认证登录|登录成功，  OBJECT_NAME   记录 PASSWORD WITH UKEY,登录失败，  OBJECT_NAME   记录 PASSWORD WITH UKEY|  
|
|通讯加密登录|SSL 通讯登录|登录成功，  AUTHENTICATION_TYPE   记录：PROTOCOL=tcps,登录失败，  AUTHENTICATION_TYPE   记录：PROTOCOL=tcps|  
|
|  
|TLCP 通讯登录|登录成功，  AUTHENTICATION_TYPE   记录：PROTOCOL=tcps,登录失败，  AUTHENTICATION_TYPE   记录：PROTOCOL=tcps|  
|
|不符合密码复杂度|创建用户，密码强度校验不通过|登录失败，记录审计|  
|
|  
|修改用户，密码强度校验不通过|登录失败，记录审计|  
|
|审计表新增事务 ID、用户角色|事务 ID|事务操作覆盖（覆盖事务成功、事务失败）：,1）DDL：CREATE、DROP、ALTER（table、view、index）,2）DML：INSERT、UPDATE、DELETE ,3）DQL: SELECT,注：SELECT语句不会分配事务id，事务id列为NULL|EAL4 测评认证中，测试报告截图是在   unified_audit_trail 系统表中新增的事务id列为 statement_id；但是本需求改成了在 aud$unified   新增列名为 transaction_id，是否需要跟测评时保持一致？,![](https://pingcode.yasdb.com/atlas/files/public/67396da78970c2af4f521467/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAzOTksImV4cCI6MTc4MjMyMTE5OX0.8W9TwwdS0UOQSRLuE5IzcXZu6zF3drWgiegnNtzmNyw)|
|  
|用户角色|用户角色覆盖：,AUDIT ADMIN,SYSTEM ADMIN,SECURITY ADMIN,普通用户（NORMAL）|EAL4 测评认证中，测试报告截图是在   unified_audit_trail 系统表中新增的事务id列为 role；但是本需求改成了在 aud$unified   新增列名为 role，是否需要跟测评时保持一致？,![](https://pingcode.yasdb.com/atlas/files/public/67396da7a1ad9a3311dc92d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBWUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQ0FBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAzOTksImV4cCI6MTc4MjMyMTE5OX0.8W9TwwdS0UOQSRLuE5IzcXZu6zF3drWgiegnNtzmNyw)|
|黑白名单审计|设置白名单|白名单访问，登录成功,黑名单访问，登录失败|  
|
|  
|设置黑名单|白名单访问，登录成功,黑名单访问，登录失败|  
|
|  
|同时设置黑白名单|白名单访问，登录成功,黑名单访问，登录失败|  
|
|审计操作新增约束|audit_admin 权限|覆盖：开启三权分立开关、关闭三权分立开关,访问系统表   aud$unified、 unified_audit_trail，访问成功,清除审计事件，清除成功|不管三权分立是否打开，都不能对 aud$unified系统表做 load_data/insert/update/delete 操作|
|  
|sys 权限|覆盖：开启三权分立开关、关闭三权分立开关,访问系统表   aud$unified、 unified_audit_trail，访问成功,清除审计事件，清除成功|  
|
|  
|security_admin 权限|覆盖：开启三权分立开关、关闭三权分立开关,访问系统表   aud$unified、 unified_audit_trail，访问失败,清除审计事件，清除失败|  
|
|  
|dba 权限|覆盖：开启三权分立开关、关闭三权分立开关,访问系统表   aud$unified、 unified_audit_trail，访问失败,清除审计事件，清除失败|  
|
|  
|普通用户权限|覆盖：开启三权分立开关、关闭三权分立开关,访问系统表   aud$unified、 unified_audit_trail，访问失败,清除审计事件，清除失败|  
|


  


  


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*    


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|是  --可针对部分审计项目对比一下之前master版本的性能|
|可维护性|  
|
|兼容性|单机、集群|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

[EAL4审计优化冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTc4OTcwYzJhZjRmNTIxNDYwIiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.Xznqf6QAVasE8ERCzRpVywOyPqVV_FjlrvtcVAZ4mzc)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

## Attachments:

[image2024-5-17_18-47-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTc4OTcwYzJhZjRmNTIxNDYxIiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.AixsblHEa-WEVsJvCt8sP4PhhO2SRyEIENhPAhEYDfc)

 (image/png)    


[image2024-4-29_18-8-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTdhMWFkOWEzMzExZGM5MmQ0IiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.ELGY94xv9aIsvq4y0XOwugQnQ2Wfey78AT1SpMznscg)

 (image/png)    


[image2024-4-29_18-8-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTc4OTcwYzJhZjRmNTIxNDYyIiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.30LsJMeoNpbU9coUiZ8jH63bs3-KVcgtC1-9pspCqEQ)

 (image/png)    


[image2024-4-29_18-7-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTdhMWFkOWEzMzExZGM5MmQ2IiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.fcQzkphhMhC6va6-tiNiKMlCJbgwg0bn6QexDYoW-LU)

 (image/png)    


[image2024-4-29_18-7-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTc4OTcwYzJhZjRmNTIxNDYzIiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.cXuo31uK37dRIdCCqGVnFDSMPClbyxiDfmExJidvVpk)

 (image/png)    


[image2024-4-29_18-7-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTc4OTcwYzJhZjRmNTIxNDY1IiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.prkrMrwYVtzZkszoXOXRULnmuk-6--Yy05yh5ivMbak)

 (image/png)    


[EAL4审计优化冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTc4OTcwYzJhZjRmNTIxNDYwIiwicmVmX2lkIjoiNjczOTZkYTc3MjgyMDZlZmI5MmYyMTk3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzk5LCJleHAiOjE3ODIzOTY3OTl9.Xznqf6QAVasE8ERCzRpVywOyPqVV_FjlrvtcVAZ4mzc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,与会人：王林、王海峰、孙志祥、胡晓畔、刘晓旋    
  会议时间：2024-07-17 17：00 ~ 18：00    
  腾讯会议：152-732-995    
  纪要信息：,1、审计权限约束对比 master 的变更：master 支持对系统表   aud$unidied     执行 load_data/insert/update/delete 操作，但本需求需要实现将系统表 aud$unidied 的 load_data/insert/update/delete 操作进行拦截,2、性能测试：可针对部分审计项目对比一下之前 master 版本的性能  ,Posted by liuxiaoxuan at 七月 17, 2024 18:53|
|---|
