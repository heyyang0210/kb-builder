Created by 邓秋怡, last modified on 八月 08, 2024

*IR链接：*    [YASHAN-932](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f4)  

*SR链接：*    [YDBRD-26259](https://pingcode.yasdb.com/pjm/items/66190f1ffd997db58ad88ba2? #YDBRD-26259 支持MySQL锁表功能)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=159445202](https://conf.yasdb.com/pages/viewpage.action?pageId=159445202)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|锁表及解锁功能|见特性设计|是|是|


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

###   [2.1 SQL语法](#21-sql语法)  

LOCK {TABLE | TABLES} tbl_schema.tbl_name lock_type [, tbl_name lock_type] ...

lock_type: { READ | WRITE }

UNLOCK {TABLE | TABLES}

##   [3. 规格与约束](#3-规格与约束)  

（1）差异点较多，从以下实现逻辑推理规格较为合理。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

（1）mysql支持但是当前yashan不支持的功能。

- LOCK TABLES后当前会话只能访问出现在LOCK TABLES里面出现的表。 LOCK TABLES前会释放所有通过LOCK TABLE获取的锁。【白名单】【对齐】
- LOCK TABLES前如果有建立了触发器，会隐式的把当前的触发器涉及到的表也LOCK上。【  **不对齐**  】
- 如果在事务表上使用 ALTER TABLE，或者使用 Windows 操作系统，那么 ALTER TABLE 会解除对表的锁定（如果在表上使用了 LOCK TABLE）。这样做是因为 InnoDB 和这些操作系统无法删除正在使用的表。【  **ddl拦截，后续有用到的再放开**  】
- LOCK TABLES 和 UNLOCK TABLES 不能在存储程序。【  **不对齐**  】
- performance_schema 数据库中的表（除setup_xxx）都不能用lock table锁定。【不能锁动态视图->对齐】
- LOCK TABLES 语句生效时，禁止使用下列语句： 创建表，创建表 ... LIKE、CREATE VIEW、DROP VIEW 以及关于存储函数、存储过程和事件的 DDL 语句。【  **ddl拦截**  】


（2）方案设计。

1、LOCK TABLE(和ddl锁在一个group)

- read和write大方向上都使用现在代码中exclusive的逻辑(lockTableDirectly) + SELECT权限校验（没有权限报表不存在错误） + LOCK TABLES 权限校验，mysql和现有yashan细节差异如下。
- commit不释放锁（yashan释放，可对齐），rollback不释放锁（yashan释放，可对齐），ddl（mysql ddl alter不释放锁，drop仅释放当前表的锁。yashan ddl释放所有锁，【  **不对齐，ddl拦截**  】）。
- lock table前进行commit，可对齐。
- 


2、UNLOCK TABLE

- ankUnlockTable
- 先判断unlock table的Ggroup（这个group只存ddl和lock tables的锁）是否为空，为空则不commit。否则commit。【lock ->unlock之前不会存在其他锁】
- 直接unlock，啥也不做（ggroup空），直接返回
- 先lock，再unlock，Ggroup一定非空，一定会先commit，再释放所有锁。


3、退出会话

- ankUnlockTableDirectly/


4、表的状态是全局的，但是自己会维护一个锁的list。

##   [5. 自测用例](#5-自测用例)  

1. LOCK/WRITE 不让其他会话写测试
1. commit不释放锁/rollback不释放锁/ddl仅释放当前表的锁
1. lock table前进行commit
1. UNLOCK TABLE是否生效


##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


  


## Attachments:

[image2024-7-29_19-42-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGRhMWFkOWEzMzExZGM5YTZjIiwicmVmX2lkIjoiNjczOTZlZGQ1OTNmOTljOWZmMjM4YTM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NTE5LCJleHAiOjE3ODI1MzA5MTl9.5II8Rn4LUtguQ7XRZJuh1tCCHdwUsz_niKhIk6qh5Js)

 (image/png)    


[image2024-7-29_19-42-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZGQ4OTcwYzJhZjRmNTIxYmY5IiwicmVmX2lkIjoiNjczOTZlZGQ1OTNmOTljOWZmMjM4YTM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDQ0NTE5LCJleHAiOjE3ODI1MzA5MTl9.93exoOnw09mAZNMds_Fkl7EwOkxVayBe27IvdFs2fQ8)

 (image/png)    
