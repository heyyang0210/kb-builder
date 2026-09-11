Created by 王博文, last modified on 十一月 07, 2023

JIRA：    [YDBRD-13578](https://jira.yasdb.com/browse/YDBRD-13578?src=confmacro)    -  支持显式lock table  完成

##   [1. Overview（概述）](#1-overview概述)  

本方案旨在显式支持 LOCK TABLE 语法,实现对表、视图定制化锁定。加锁模式包括 share、exclusive。

##   [2. Features（功能特性）](#2-features功能特性)  

**对外提供语法**    
  LOCK TABLE

**CREATE PROFILE**

显式进行锁定表、视图

**LOCK TABLE table_name IN lockmode MODE waitmode;**

![](https://pingcode.yasdb.com/atlas/files/public/67396c188970c2af4f520924/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwNDIsImV4cCI6MTc4MjMwOTg0Mn0.gL8aPvD1wGCJRzaNxzB8lOkC_usMZiQ8Tl_3-jB-U2w)

  


##   [3. Interfaces（接口）](#3-interfaces接口)  

|  
|  
|  
|
|---|---|---|
|parse层|CodResult parseLockTable(AnlParser* parser, LangWord* word);|  
|
|verify层|CodResult verifyLockTable(AnlVerifier* vrfr, CodPointer ctx);|  
|
|存储层|CodResult ankLockTable(AnkHandler* handler, LockTableDef* def);|  
|
|DC|  
|  
|
|dict|  
|  
|


##   [4. Limitations（功能限制）](#4-limitations功能限制)  

不支持 dblink、分区表。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

**Lock Mode**

1、加 share 锁后，其他会话仍可获取 share 锁；

2、加 exclusive 锁后，其他会话不可获取该锁，根据 WAIT 模式不同，数据库给出不同结果。

**Wait Mode**

1、NOWAIT：当事务可获得锁时，立即进行加锁；若不可获得锁，则进行报错。出报错内容：ORA-00054: 资源正忙, 但指定以 NOWAIT 方式获取资源, 或者超时失效。

2、WAIT integer表示可等待的超时时间上限为 integer (单位：秒)，若在超时等待时间内可获得锁则立刻加锁，若超出时限且仍未获得锁则返回错误信息。

3、无 NOWAIT、WAIT 关键词表示 WAIT_INDEFINITELY，即该会话无限期地等待直到获得该锁并加锁，不会因为超时而产生报错。

**Unlock**

1、释放锁方式：会话退出；commit；完整 rollback；rollback 至加锁前建立的 savepoint。

2、对 share 锁，各用户可分别释放锁；对 exclusive 锁，仅能由持锁用户进行释放。

**加锁对象**

1、table：上述即对于table。

2、view：对存在基表的视图加锁：加锁于基表，情况同于table。

对基表未建立的视图(create force view)加锁：进行报错；之后建立该基表，重新对视图显式加锁，则加锁于基表。

3、materialized view：加锁于物化视图对象本身。

**加锁过程**

1、若不可直接获得锁，会话为对象加锁且该锁可在动态试图中查询，在 V$LOCKED_OBJECT 中 LOCKED_MODE 为 0；在 V$LOCK 中，LMODE 为 0 且 REQUEST 为正在请求的锁类型。若在超时时限内获得锁，则进行加锁，此时 V$LOCK 中记录进行更新，包括 KADDR。（释放 0 锁，加锁目标锁）

####   [动态视图设计](#动态视图设计)  

#####   [yasdb 动态视图 V$LOCKED_OBJECT](#yasdb-动态视图-vlocked-object)  

字段及含义如下：

|字段|数据类型|描述|
|---|---|---|
|OBEJECT_ID|uint64，not null|被加锁的对象的OID|
|SESSION_ID|uint16，not null|当前持锁的会话ID|
|LMODE|varchar(8)|被加锁的锁类型|


在 V$LOCKED_OBJECT 视图中，对同一会话，字段 OBJECT_ID 唯一地指出任一被加锁的对象。

**table 隐式加锁**

Oracle：

1、DML 中 insert、delete、update 过程中(commit 前)，隐式加锁：3 - ROW_X (SX): Row Exclusive Table Lock。

2、DDL 中 alter 过程隐式加锁。

YasDB：

1、DML 中 insert、delete、update 过程中(commit 前)，隐式加锁：TS 共享表锁。

2、DDL 中 alter 过程隐式加锁。

DML 后进行 DDL 也会自动释放锁。

对于被请求的锁，可在 v$lock 查询。

####   [内存设计](#内存设计)  

```
typedef struct stSubLockTableDef {
    LangText   tableName;
    LangText   userName;
    CodUint64  objectId;
} SubLockTableDef;

typedef struct stLockTableDef {
    List*            lockTableDefList;  // SubLockTableDef
    CodUint64        lockMode;
    WaitType         waitType;
    CodUint64        waitValue;
} LockTableDef;

```

**开发重点问题**

**LOCK TABLE: parse ->verify->execute**

**自测用例**

LOCK TABLE table_test in share mode NOWAIT;

LOCK TABLE table_test in share mode WAIT 5;

LOCK TABLE table_test in share mode;

-- 创建视图    
  CREATE VIEW view_test AS    
  SELECT     [t1.id](http://t1.id)    ,     [t1.name](http://t1.name)    , t2.age    
  FROM table_test1 t1    
  JOIN table_test2 t2 ON     [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    ;

  
  -- 对视图进行加锁    
  LOCK TABLE view_test IN exclusive mode;

-- 异常情况

对视图的基表进行 drop/alter table add/alter table drop column，视图失效(has errors)，视图的所有基表的锁释放，同 oracle。

这是因为执行 DDL 前后均执行 commit，自动释放所有表锁。

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

  


  


  


## Attachments:

[image2022-8-29_15-14-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTg4OTcwYzJhZjRmNTIwOTIxIiwicmVmX2lkIjoiNjczOTZjMTg3MjgyMDZlZmI5MmYwZDg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDQyLCJleHAiOjE3ODIzODU0NDJ9.XUallW-8mApdRh7j1o4Rf3sFdu5M91SkvweDIq5MX-Y)

 (image/png)    


[image2022-8-26_17-2-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTg4OTcwYzJhZjRmNTIwOTIyIiwicmVmX2lkIjoiNjczOTZjMTg3MjgyMDZlZmI5MmYwZDg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDQyLCJleHAiOjE3ODIzODU0NDJ9.AtEjIXG6p6G2oEWEbCoH-AOWI5r1GIXV4m4pBhjegcE)

 (image/png)    


[image2022-12-13_11-20-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMThhMWFkOWEzMzExZGM4NzkyIiwicmVmX2lkIjoiNjczOTZjMTg3MjgyMDZlZmI5MmYwZDg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDQyLCJleHAiOjE3ODIzODU0NDJ9.CZfaleXKzulCi9IkFrPjmoXQPPOHo--OxA9xnBuZna4)

 (image/png)    


## Comments:

|  [](null)  ,物化视图lock行为；,不要分区表,Posted by wangbowen at 十月 17, 2023 16:40|
|---|
