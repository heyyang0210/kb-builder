Created by 马程飞, last modified on 十一月 28, 2023

#   [一.Overview (概述)](#一overview-概述)  

OFFLINE某个表空间后，该表空间不可读写，执行ONLINE表空间后表空间恢复正常可用状态

OFFLINE表空间的需求场景：

- 需要禁止访问一部分数据库时
- 重命名或重分配表空间中的数据文件时


#   [二.Features(功能特性)](#二features功能特性)  

OFFLINE表空间有以下3种模式：

- OFFLINE NORMAL，一致性OFFLINE，可以直接进行ONLINE
- OFFLINE TEMPORARY，语法兼容，实际和NORMAL类型相同
- OFFLINE IMMEDIATE，非一致性OFFLINE，仅当数据库开启归档时才可使用该方式，不能直接ONLINE，需要根据归档日志和在线日志对数据文件进行恢复（暂不支持恢复功能）后才可以ONLINE
- 不指定以上3种模式时默认为NORMAL类型


#   [三.Interfaces(接口)](#三interfaces接口)  

  `ALTER TABLESPACE space_name OFFLINE [NORMAL|TEMPORARY|IMMEDIATE];`  

  `ALTER TABLESPACE space_name ONLINE;`  

#   [四.Specification And Constraints (规格与约束)](#四specification-and-constraints-规格与约束)  

- 内置表空间和临时表空间不能被OFFLINE
- 读写OFFLINE表空间下数据文件的操作报错页面不可读
- 不允许对OFFLINE表空间进行DDL操作，例如ADD FILE、DROP FILE等
- 表空间OFFLINE之后不能创建同名表空间或文件
- 归档模式开启时，优先使用OFFLINE NORMAL或OFFLINE TEMPORARY,不建议使用OFFLINE IMMEDITAE


#   [五.Detail Design(详细设计)](#五detail-design详细设计)  

OFFLINE流程简要图：

- OFFLINE IMEMDIATE 是非一致性OFFLINE,会在文件头更新rcyPoint和flushPoint
- OFFLINE NORMAL/TEMPORARY是一致性OFFLINE,会做一次等待的全量CHECKPOINT


![](https://pingcode.yasdb.com/atlas/files/public/67396b58a1ad9a3311dc8264/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTMzMDYsImV4cCI6MTc4MjMwNDEwNn0.JGZnjewajnJK7a1RBlNxXuYmDNVL_RDmRsoJCnMtdhY)

ONLINE流程简要图：

- ONLINE TABLESPACE 相比于单机，改造全局锁、添加消息发送机制


![](https://pingcode.yasdb.com/atlas/files/public/67396b58a1ad9a3311dc8265/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQWtBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTMzMDYsImV4cCI6MTc4MjMwNDEwNn0.JGZnjewajnJK7a1RBlNxXuYmDNVL_RDmRsoJCnMtdhY)

#   [六.Testcases(自测用例）](#六testcases自测用例)  

- CREATE TABLESPACE MCF DATAFILE 'MCF' SIZE 10M;
- ALTER TABLESPACE MCF OFFLINE;
- ALTER TABLESPACE MCF ONLINE
- create tablespace mcf datafile 'mcf' size 4m;
- create table mcf(a int) tablespace mcf;
- insert into mcf values(3);
- create tablespace macf datafile 'macf' size 4m;
- alter tablespace macf add datafile 'macf02' size 4m;
- create table macf(a int) tablespace macf;
- insert into macf values(1);
- alter system set _fault_point = 'KNL_FAULT_POINT_4' scope = memory;
- alter system set _fault_point = 'KNL_FAULT_POINT_5' scope = memory;
- alter tablespace mcf offline;
- alter tablespace macf offline;


#   [七.资料设计章节](#七资料设计章节)  

删除资料中表空间OFFLINE/ONLINE操作不允许的限制

#   [八 TODO （遗留问题）](#八-todo-遗留问题)  

## Attachments:

[off.drawio(1).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTc4OTcwYzJhZjRmNTIwM2YwIiwicmVmX2lkIjoiNjczOTZiNTc1OTNmOTljOWZmMjM2MTFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzMzA2LCJleHAiOjE3ODIzNzk3MDZ9.akTe8I5z4lWES00OOJZD9Fkb5QymKRkcLpvwZnYiAXA)

 (image/png)    


## Comments:

|  [](null)  ,参与人员：马志宏、陆世杰、朱国旭、张丽红、张彩虹,评审意见：,1.补充资料,2.拦截OFFLINE DATAFILE场景,3.优化表空间创建、删除流程,Posted by machengfei at 十二月 11, 2023 19:48|
|---|
