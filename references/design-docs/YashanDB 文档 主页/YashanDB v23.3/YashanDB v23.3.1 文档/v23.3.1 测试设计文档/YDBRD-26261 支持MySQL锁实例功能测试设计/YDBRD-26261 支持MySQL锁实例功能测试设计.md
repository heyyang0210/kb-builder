Created by 袁芳达, last modified on 十月 15, 2024

# 1. 概述

*IR链接：*    [YASHAN-932](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f4)  

*SR链接：*    [YDBRD-26261](https://pingcode.yasdb.com/pjm/items/66190f63fd997db58ad88c3f)  

# 2. 需求分析

## 支持MySQL兼容锁实例及解锁功能。

## 2.3 规格约束

-     1. 语句加锁为实例级别，与use指定数据库无关（不需use指定数据库，阻塞操作不同数据库对象的语句）。
    1. 多个会话可同时持有实例锁，持锁后阻塞其他会话。
    1. 执行语句需要 BACKUP_ADMIN 权限。（改成具有数据库备份权限控制，sys，sysdba,sysbackup）
    1. 加锁后，拦截其他会话执行部分语句：
        1. 限时阻塞：DDL（除shutdown、操作对象为临时表以外），grant，revoke。
        1. 报错：purge binary logs。
    1. 加锁后，可成功执行的语句：shutdown，DML，操作对象为临时表的DDL（包括create temporary table，create index，不包括create view）。
    1. 放锁方式：执行unlock instance语句，执行exit退出会话，执行shutdown。



# 3. 详细测试设计

## 3.1 测试设计方法

采用等价类、边界值的测试设计方法进行测试设计：

## 3.2 详细测试设计

|类型|前置场景|测试场景|预期结果|备注|
|---|---|---|---|---|
|功能测试|加锁测试    
    
    
|user1授权BACKUP_ADMIN，加实例锁, user1进行ddl操作|加锁后user2，user1均无法进行DDL操作,shutdown，DML，操作不受影响|具体ddl操作是否受阻塞详情见下表|
|  
||user1授权BACKUP_ADMIN，加实例锁, user2进行ddl操作|加锁后user2，user1均无法进行DDL操作,shutdown，DML，操作不受影响|表现为ddl创建等待10秒报错超时|
|  
||user1授权BACKUP_ADMIN，在session1加实例锁, session1进行ddl操作|加锁后session1，session2均无法进行DDL操作,shutdown，DML，操作不受影响|  
|
|  
||user1授权BACKUP_ADMIN，在session1加实例锁, session2进行ddl操作|加锁后session1，session2均无法进行DDL操作,shutdown，DML，操作不受影响|  
|
|  
||加锁等待时间测试（有其他会话正在执行ddl）|为固定值，暂不用参数控制（10秒）|  
|
|  
|释放锁测试    
    
    
|  
,  
,user1授权BACKUP_ADMIN，加实例锁，user1执行unlock instance语句|解锁后user1，user2可以进行正常的ddl，dml操作|  
|
|  
||  
|  
|  
|
|  
||user1授权BACKUP_ADMIN，加实例锁，user2执行unlock instance语句|解锁成功后user1，user2可以进行正常的ddl，dml操作|user2无权是否可以解锁？|
|  
||user1授权BACKUP_ADMIN，session1加实例锁，session1执行unlock instance语句|解锁后session1，session2可以进行正常的ddl，dml操作|  
|
|  
||user1授权BACKUP_ADMIN，session1加实例锁，session2执行unlock instance语句|解锁后session1，session2可以进行正常的ddl，dml操作|  
|
|  
||执行exit退出会话，执行shutdown|解锁后session1，session2可以进行正常的ddl，dml操作|  
|
|  
||  
|  
|  
|
|权限校验|加锁测试    
    
|user1授权BACKUP_ADMIN，user1加实例锁,  
|加锁成功|  
|
|  
||user1授权BACKUP_ADMIN，user2无授权，user2加实例锁|user2加锁失败|  
|
|  
||  
,user1授权BACKUP_ADMIN，user2也授权，user1加实例锁，user2加实例锁|user1加锁后，  user2再继续加锁,正常执行|  
|
|  
|释放锁测试    
    
|user1授权BACKUP_ADMIN，user2无授权，user1加实例锁，user2放锁|user1加锁成功，  user2放锁失败|  
|
|  
||user1授权BACKUP_ADMIN，user2无授权，user1加实例锁，user1放锁|user1放锁成功|  
|
|  
||user1授权BACKUP_ADMIN，加锁后回收user1BACKUP_ADMIN权限，|回收权限阻塞|  
|
|备份恢复验证|  
|对数据库加锁后，并发执行dml，ddl，备份数据库语句|ddl，dml按加锁后的规则正常执行，备份操作正常执行|  
|
|  
|  
|全量恢复数据库|恢复后的数据与备份时进行的dml，ddl操作相对应|  
|
|  
|  
|在加锁的实例会话恢复数据库后，查看实例锁是否存在|对比mysql表现|  
|
|导入导出|  
|加锁后验证导入导出是否正常|不影响导入导出结果|  
|
|主备验证|  
|主机创建用户授权并加锁|加锁后主机，备机均无法进行DDL操作,shutdown，DML，操作不受影响|  
|
|  
|  
|备机创建用户授权并加锁|加锁后主机，备机均无法进行DDL操作,shutdown，DML，操作不受影响|  
|
|  
|  
|主机解锁|解锁后主机，备机可以进行正常的ddl，dml操作|  
|
|  
|  
|备机解锁|解锁后主机，备机可以进行正常的ddl，dml操作|  
|
|  
|  
|验证主备基线场景|  
|  
|
|  
|  
|主机加锁后，备机升主进行权限回收|  
|  
|
|  
|  
|集群，分布式不支持|拦截|  
|
|  
|  
|  
|  
|  
|


|模块划分|一级模块|二级模块|ddl操作|加锁后是否阻塞|
|:---|:---|:---|---|:---|
|DDL对象    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|表    
    
    
    
    
    
|heap|- DDL：创建、更新，删除
|  
    
    
  是    
    
|
|||tac|||
|||lsc|||
|||分区表|||
|||外部表|||
|||临时表|- DDL：创建、更新，删除
|否（当前mysql兼容模式不支持临时表）|
|||drop 不存表|直接报错|  
|
||索引    
    
    
|Btree索引|- DDL：创建、更新删除
|  
  是    
    
    
|
|||列式索引|||
|||Rtree索引|||
|||AC|||
||约束|主键约束|- DDL：创建、删除
|是|
||  
|外键约束|||
||  
|唯一约束|||
||  
|check约束|||
||  
|非空约束|||
||触发器|  
|- DDL：创建、删除
|是|
||视图|用户视图|- DDL：创建、删除
|  
  是|
|||物化视图|||
||表空间(tablespace)|  
|- DDL：创建、删除
|是|
||序列（sequence）|  
|- DDL：创建、删除
|是|
||同义词（SYNONYM）|  
|- DDL：创建、删除
|是|
||注释（comment）|  
|- DDL：创建、删除
|是|
||用户|  
|- DDL：创建、删除
|是|
||角色|  
|- DDL：创建、删除
|是|
||权限|  
|- DDL：grant，revoke
|是|
||创建redo|  
|- DDL：创建、删除
|是|
||profile|  
|- DDL：创建、删除
|  
|
||闪回数据库，表|  
|  
|是|
||CREATE FUNCTION|  
|- DDL：创建、删除
|是|
||CREATE PACKAGE|  
|- DDL：创建、删除
|是|
||CREATE LIBRARY|  
|- DDL：创建、删除
|是|
||CREATE TYPE BODY|  
|- DDL：创建、删除
|是|
||CREATE TYPE|  
|- DDL：创建、删除
|是|
||主键|  
|- DDL：创建、删除
|是|
||外键审计策略/使能|  
|- DDL：创建、删除
|是|
||OUTLINE|  
|- DDL：创建、删除
|是|
||DATABASE LINK|  
|- DDL：创建、删除
|是|
||CREATE DIRECTORY|  
|- DDL：创建、删除
|是|
||  
|  
|  
|  
|


|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWY4OTcwYzJhZjRmNTIxODc2IiwicmVmX2lkIjoiNjczOTZlNWY1OTNmOTljOWZmMjM4NDFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjIzLCJleHAiOjE3ODI0NTgwMjN9.iBXGoptjusfS0JYL6pi8S15eK3FN8YZno6H0yv2TBxk)

## Attachments:

[YDBRD-26603 & YDBRD-26602 支持DBMS_CRYPTO内置系统包的加解密函数 & HASH函数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWZhMWFkOWEzMzExZGM5NmViIiwicmVmX2lkIjoiNjczOTZlNWY1OTNmOTljOWZmMjM4NDFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjIzLCJleHAiOjE3ODI0NTgwMjN9.C3E4xNjz9c8GtgGjuzOArARzqwGOH0asISSjpg4BXl8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWY4OTcwYzJhZjRmNTIxODc2IiwicmVmX2lkIjoiNjczOTZlNWY1OTNmOTljOWZmMjM4NDFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjIzLCJleHAiOjE3ODI0NTgwMjN9.iBXGoptjusfS0JYL6pi8S15eK3FN8YZno6H0yv2TBxk)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWY4OTcwYzJhZjRmNTIxODc3IiwicmVmX2lkIjoiNjczOTZlNWY1OTNmOTljOWZmMjM4NDFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNjIzLCJleHAiOjE3ODI0NTgwMjN9._KhFQkbJmYCf-F6YADqH09NjIINLWt_YtoYbG6rXRho)

 (application/msword)    


## Comments:

|  [](null)  ,1.补充并发场景,2.ha主备基线场景,Posted by yuanfangda at 八月 07, 2024 14:51|
|---|
