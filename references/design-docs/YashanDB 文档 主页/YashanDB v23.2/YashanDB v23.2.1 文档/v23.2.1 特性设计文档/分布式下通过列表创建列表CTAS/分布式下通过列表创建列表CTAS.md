Created by 周宇航, last modified on 十月 30, 2023

jira：    [[YDBRD-13647]分布式下通过列表创建列表](https://jira.yasdb.com/browse/YDBRD-13647)  

##   [1. Overview（概述）](#1-overview概述)  

- 该功能作用
    - 通过select相关的语句将得到的结果集的行列信息复制到新表，但不包括约束项、存储参数、分区、表空间等信息。
    - 可以快速的创建表，快速插入复制的数据。
- 实现必要性
    - 可以快速建立一个临时用的表，否则还需要从头create和insert。
    - 也可以快速建立一个相同结构的表，当select使用过滤条件where 1=2。
- yasdb目前相关情况
    - 单机版已经支持。
-   [其他数据库厂商该功能的调研情况](https://conf.yasdb.com/pages/viewpage.action?pageId=122073520)  


##   [2. Features（功能特性）](#2-features功能特性)  

|支持特性|
|---|
|分布式场景支持    `create table as select`    语法|


##   [3. Interfaces（接口）](#3-interfaces接口)  

create table as

![](https://pingcode.yasdb.com/atlas/files/public/67396c71a1ad9a3311dc8a93/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQ0FBQUFBRUFnSUFBQUFJQUFBQUFBUUFBQUFBQUFBQUFBQUFBQ0FBQXdBQkFBQUFBQWdBQUFBQUFBQUFBQUJBQUFBQUFBQVNBQUFBQUFFQWdBQUFBQWdBQUFBQUNBQUFBQUFBZ0FnQUFBQUFBQ0JJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FFQUFRQUFBQUFBQUlBQUFBQUFBQUFBQkFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4ODksImV4cCI6MTc4MjMxMTY4OX0.wi5VMSMDMQ9GK_Y4kjY2wXg9uvgfIQmK9ZKm1sCZDX4)

column_clause

![](https://pingcode.yasdb.com/atlas/files/public/67396c718970c2af4f520c25/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQ0FBQUFBRUFnSUFBQUFJQUFBQUFBUUFBQUFBQUFBQUFBQUFBQ0FBQXdBQkFBQUFBQWdBQUFBQUFBQUFBQUJBQUFBQUFBQVNBQUFBQUFFQWdBQUFBQWdBQUFBQUNBQUFBQUFBZ0FnQUFBQUFBQ0JJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FFQUFRQUFBQUFBQUlBQUFBQUFBQUFBQkFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4ODksImV4cCI6MTc4MjMxMTY4OX0.wi5VMSMDMQ9GK_Y4kjY2wXg9uvgfIQmK9ZKm1sCZDX4)

table_properties

![](https://pingcode.yasdb.com/atlas/files/public/67396c718970c2af4f520c26/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQ0FBQUFBRUFnSUFBQUFJQUFBQUFBUUFBQUFBQUFBQUFBQUFBQ0FBQXdBQkFBQUFBQWdBQUFBQUFBQUFBQUJBQUFBQUFBQVNBQUFBQUFFQWdBQUFBQWdBQUFBQUNBQUFBQUFBZ0FnQUFBQUFBQ0JJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FFQUFRQUFBQUFBQUlBQUFBQUFBQUFBQkFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4ODksImV4cCI6MTc4MjMxMTY4OX0.wi5VMSMDMQ9GK_Y4kjY2wXg9uvgfIQmK9ZKm1sCZDX4)

其余可参考    [create table结构](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 子查询语句，语句中不支持同时存在行存表和列存表，否则返回错误。
- 执行CTAS宕机后恢复，可能出现短暂的出现表不存在但创建时提示表已经存在。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 执行流程](#51-执行流程)  

- 用户发送create table as select（后续简称为CTAS）到其中一个CN。
- CN1将计划传至CN2，CN2解析计划，分别为    `DDL创建表计划`    和    `DML插入子计划`    。
- 其中DDL计划跟    [元数据管理方案](https://conf.yasdb.com/pages/viewpage.action?pageId=91771381)    一致：


ddl执行流程

![](https://conf.yasdb.com/download/attachments/91771381/DDL%E6%89%A7%E8%A1%8C%E6%A1%86%E6%9E%B6%E7%AE%80%E5%9B%BE-%E6%94%AF%E6%8C%81%E4%B8%A4%E9%98%B6%E6%AE%B5DDL%E6%B5%81%E7%A8%8B.png?version=1&modificationDate=1666339101000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQ0FBQUFBRUFnSUFBQUFJQUFBQUFBUUFBQUFBQUFBQUFBQUFBQ0FBQXdBQkFBQUFBQWdBQUFBQUFBQUFBQUJBQUFBQUFBQVNBQUFBQUFFQWdBQUFBQWdBQUFBQUNBQUFBQUFBZ0FnQUFBQUFBQ0JJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FFQUFRQUFBQUFBQUlBQUFBQUFBQUFBQkFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4ODksImV4cCI6MTc4MjMxMTY4OX0.wi5VMSMDMQ9GK_Y4kjY2wXg9uvgfIQmK9ZKm1sCZDX4)

- DML分布式计划由其中一个CN生成，所有CN和所有MN不执行该语句
- 只有DN需要执行DML分布式计划。


###   [5.2 计划生成和执行](#52-计划生成和执行)  

####   [5.2.1 DDL和DML有各自的计划传递形式和事务设计，而CTAS作为将DDL、DML混合的特例语句：](#521-ddl和dml有各自的计划传递形式和事务设计而ctas作为将ddldml混合的特例语句)  

- 首先CTAS是归为DDL语句
- DDL传递信息仅涉及少量信息，比如sql语句，oid等元数据
- DML涉及表数据修改，DN本身没有生成分布式计划能力，需要CN生成分布式计划和提供    `context`    ，其中传递信息会包含更多的    `context`    来保证DN之间的数据交互


####   [5.2.2 CTAS需要按照模拟两个语句的执行，即先执行DDL再执行DML。](#522-ctas需要按照模拟两个语句的执行即先执行ddl再执行dml)  

- 控制DML计划仅由其中一个CN生成
- 所有节点照常执行DDL计划，需要注意在不需要执行DML的CN/MN节点将subQuery置为NULL，防止子计划执行
- CN参考DML执行生成对应需要的上下文信息
- CN和DN都需要先执行DLL，并保存生成的临时DC，等待后续使用
- 目前临时DC会存储在stmt.context.CTASDC中，CN会控制DDL执行到提交前再执行DML计划，两者将会利用临时DC来保证执行流程正常


CTAS额外的补充操作

![](https://pingcode.yasdb.com/atlas/files/public/67396c718970c2af4f520c27/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQ0FBQUFBRUFnSUFBQUFJQUFBQUFBUUFBQUFBQUFBQUFBQUFBQ0FBQXdBQkFBQUFBQWdBQUFBQUFBQUFBQUJBQUFBQUFBQVNBQUFBQUFFQWdBQUFBQWdBQUFBQUNBQUFBQUFBZ0FnQUFBQUFBQ0JJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FFQUFRQUFBQUFBQUlBQUFBQUFBQUFBQkFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4ODksImV4cCI6MTc4MjMxMTY4OX0.wi5VMSMDMQ9GK_Y4kjY2wXg9uvgfIQmK9ZKm1sCZDX4)

###   [5.3 事务性保证设计](#53-事务性保证设计)  

####   [5.3.1 分布式中DDL与DML的混合操作并不符合事务性，原子性无法保证](#531-分布式中ddl与dml的混合操作并不符合事务性原子性无法保证)  

- 目前情况:
-     1. DDL执行成功则代表创建表成功，DML执行成功则代表数据插入成功，此时流程正常。
    1. DDL执行失败，代表MN节点出现问题，则后续DML执行也不会再继续，符合    `原子性`    。
    1. DDL执行成功，后续DML执行失败，DML会触发事务回滚，但表并不会跟随回滚，一旦目前的MN执行DDL成功，后续其他节点会被    `同步`    ，创建的表不会随着DML回滚而删除，此时不符合    `原子性`    。



####   [](#532-利用mn记录的ddl-queue来增加补偿drop-table操作)  

- 目前DDL一致性保证由MN记录的    `ddl_queue$`    上保存DDL元数据来保证，DML的一致性由CN来决定commit/rollback
- 当CN决定回滚时，由CN来组织drop table非常危险，一旦宕机将会有残留的table，而且后续MN会把创建的表同步给其他节点，因此：
-     1.   `ddl_queue$`    保存反向的    `drop table`    操作
    1. 当DML事务成功，清空补偿操作。
    1. 当DML事务失败，CN执行DML回滚和清空表，并且最后通知删除MN上的表。
    1. 最终MN清空表，成功后移除补偿命令。



正常流程

![](https://pingcode.yasdb.com/atlas/files/public/67396c71a1ad9a3311dc8a94/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQ0FBQUFBRUFnSUFBQUFJQUFBQUFBUUFBQUFBQUFBQUFBQUFBQ0FBQXdBQkFBQUFBQWdBQUFBQUFBQUFBQUJBQUFBQUFBQVNBQUFBQUFFQWdBQUFBQWdBQUFBQUNBQUFBQUFBZ0FnQUFBQUFBQ0JJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FFQUFRQUFBQUFBQUlBQUFBQUFBQUFBQkFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4ODksImV4cCI6MTc4MjMxMTY4OX0.wi5VMSMDMQ9GK_Y4kjY2wXg9uvgfIQmK9ZKm1sCZDX4)

DML失败流程

![](https://pingcode.yasdb.com/atlas/files/public/67396c728970c2af4f520c28/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQ0FBQUFBRUFnSUFBQUFJQUFBQUFBUUFBQUFBQUFBQUFBQUFBQ0FBQXdBQkFBQUFBQWdBQUFBQUFBQUFBQUJBQUFBQUFBQVNBQUFBQUFFQWdBQUFBQWdBQUFBQUNBQUFBQUFBZ0FnQUFBQUFBQ0JJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FFQUFRQUFBQUFBQUlBQUFBQUFBQUFBQkFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA4ODksImV4cCI6MTc4MjMxMTY4OX0.wi5VMSMDMQ9GK_Y4kjY2wXg9uvgfIQmK9ZKm1sCZDX4)

####   [5.3.3 故障处理](#533-故障处理)  

1. 在MN节点上未提交，所有的操作都走回滚处理(依赖于会话管理的故障处理和主动发送Rollback消息两种方式)
1. 在MN节点提交后，出现故障通过DDL Log后台推送drop table来回撤所有操作，DML操作也等于被撤回。


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 基本功能保证参考单机的测试用例
- 事务性验证测试，需要主动制造DML回滚
-     1. 在并行操作中把子查询涉及的表加锁，等待回滚触发。
    1. 代码埋点，快速触发回滚问题发生。



##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

##   [9. 参考文档](#9-参考文档)  

-   [元数据管理方案](https://conf.yasdb.com/pages/viewpage.action?pageId=91771381)  


## Attachments:

[image2023-8-9_19-40-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzE4OTcwYzJhZjRmNTIwYzFmIiwicmVmX2lkIjoiNjczOTZjNzA1OTNmOTljOWZmMjM2ZThmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwODg5LCJleHAiOjE3ODIzODcyODl9.cPbddmZpQ1fnvFJPozuHeAKdrMRi1dBAvi7ZlKp9PQ4)

 (image/png)    


[image2023-8-9_20-31-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzFhMWFkOWEzMzExZGM4YThlIiwicmVmX2lkIjoiNjczOTZjNzA1OTNmOTljOWZmMjM2ZThmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwODg5LCJleHAiOjE3ODIzODcyODl9.H8vzrIBc06DWZUgT0-2M-v50BsGUzz50UM4un-laKDI)

 (image/png)    


[image2023-8-9_20-31-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzE4OTcwYzJhZjRmNTIwYzIwIiwicmVmX2lkIjoiNjczOTZjNzA1OTNmOTljOWZmMjM2ZThmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwODg5LCJleHAiOjE3ODIzODcyODl9._mHVjjE4jefopP0X9P9oHk9a8tiPb-E6EPkGJqm-7qk)

 (image/png)    


[image2023-8-10_9-10-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzE4OTcwYzJhZjRmNTIwYzIxIiwicmVmX2lkIjoiNjczOTZjNzA1OTNmOTljOWZmMjM2ZThmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwODg5LCJleHAiOjE3ODIzODcyODl9.wzava9MC7CDXBYXLdQZECX-IUlVHiULqZyNOltAZ7Iw)

 (image/png)    


[CTAS.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzFhMWFkOWEzMzExZGM4YThmIiwicmVmX2lkIjoiNjczOTZjNzA1OTNmOTljOWZmMjM2ZThmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwODg5LCJleHAiOjE3ODIzODcyODl9.kLDnoWUQ4NCICPtz6UNc9WkcsWk5oXiWtHnlvqKVr0A)

 (image/png)    


[image2023-9-12_9-11-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNzFhMWFkOWEzMzExZGM4YTkwIiwicmVmX2lkIjoiNjczOTZjNzA1OTNmOTljOWZmMjM2ZThmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwODg5LCJleHAiOjE3ODIzODcyODl9.Q0zccikpRKXI9MRlaHTYWC9gf9YiRZu0wHk0EkKy__s)

 (image/png)    
