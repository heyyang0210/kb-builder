Created by 王博文, last modified on 七月 31, 2024

*IR链接：*    [YASHAN-932](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f4)  

*SR链接：*    [YDBRD-26261](https://pingcode.yasdb.com/pjm/items/66190f63fd997db58ad88c3f)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

支持MySQL兼容中锁实例及解锁功能。

加实例级别的备份锁，允许在线备份期间的DML，阻止会导致快照不一致的操作。

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=159445587](https://conf.yasdb.com/pages/viewpage.action?pageId=159445587)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|锁实例及解锁功能|见特性设计|是|是|


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

###   [2.1 SQL语法](#21-sql语法)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e9ca1ad9a3311dc9827/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgzMzEsImV4cCI6MTc4MjQ0OTEzMX0.-xZJ0iS7C6R1FjyHWKhZceslSyRudCMPDlCISFD00FE)

![](https://pingcode.yasdb.com/atlas/files/public/67396e9c8970c2af4f5219b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFFQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgzMzEsImV4cCI6MTc4MjQ0OTEzMX0.-xZJ0iS7C6R1FjyHWKhZceslSyRudCMPDlCISFD00FE)

##   [3. 规格与约束](#3-规格与约束)  

（1）MySQL中实例锁不拦截创建二进制日志，YashanDB中不考虑。

（2）加锁阻塞的语句仅考虑YashanDB已支持的内容。

（3）兼容MySQL模式当前不支持临时表。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

围绕实例锁以及阻塞语句设计。

MySQL实例锁特点

- 多个会话可同时持有实例锁，被持有后阻塞其它会话
- 加锁后阻塞语句范围：DDL（除shutdown、操作对象为临时表以外），grant，revoke
- 等待获取锁时间lock_wait_timeout为[1,31536000]秒，默认1年
- 执行加锁语句需要BACKUP_ADMIN权限


###   [4.2 特性功能点1 支持加实例级锁](#42-特性功能点1-支持加实例级锁)  

YashanDB加实例锁特性设计

- StAnkHandlerAttr添加成员CodBool isInstanceLocked表示当前会话有无持有实例锁
- StDatabase添加成员CodUint64 instanceLockCount表示当前持有实例锁的会话数
- 不阻塞条件(count == 0 || (count == 1 && isLocked))
- 设置阻塞：doExecute函数判断sql type进行等待，统计等待事件？
- 使用系统参数TRANSACTION_LOCK_TIMEOUT（kernel->lockTimeout），默认为0表示死等
- 增加权限BACKUP_ADMIN


###   [4.3 特性功能点2 释放实例级锁](#43-特性功能点2-释放实例级锁)  

YashanDB放实例锁特性设计

- 置零isLocked，count-=1
- 执行unlock语句，执行exit语句：anrLogout，执行shutdown：ankFreeHandler


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
-- unlock语句解锁
-- session1
lock instance for backup;
-- session2，预期卡住
create table t1 (f1 int);
-- session1，预期session2恢复执行
unlock instance;

-- exit解锁
-- session1
lock instance for backup;
-- session2，预期卡住
create table t1 (f1 int);
-- session1，预期session2恢复执行
exit;

```

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

开发手册/SQL参考手册/SQL语句/00SQL语句.md中新增语句LOCK INSTANCE FOR BACKUP.md、UNLOCK INSTANCE.md，权限.md。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


  


## Attachments:

[image2024-4-26_10-29-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOWNhMWFkOWEzMzExZGM5ODI1IiwicmVmX2lkIjoiNjczOTZlOWI3MjgyMDZlZmI5MmYyYTAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MzMxLCJleHAiOjE3ODI1MjQ3MzF9.F5kss9uoSfVeVH5DoICxdFXymiodWEpsjGJYFFtNXtM)

 (image/png)    


## Comments:

|  [](null)  ,1、在verifyCommonDDL函数中进行阻塞,2、会话被阻塞只进行短时间等待并报错返回,3、不考虑shutdown释放锁,4、使用系统参数DDL_LOCK_TIMEOUT,Posted by wangbowen at 七月 31, 2024 17:29|
|---|
