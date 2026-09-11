Created by 汪少华, last modified on 七月 30, 2024

**YDBRD-26035 支持查询带lob字段的gv视图**

##   [1. Overview（概述）](#1-overview概述)  

当前识别到GV$SQLAREA，GV$SQL，GV$SQLSTATS视图中的sql_fulltext字段为CLOB类型，因未支持LOB字段的跨节点传输，目前只能支持小于32KB大小的字符，为了能够显示更复杂的SQL，支持以上视图中的LOB数据跨节点传输。

##   [2. Features（功能特性）](#2-features功能特性)  

支持GV$SQLAREA，GV$SQL，GV$SQLSTATS视图大于32KB大小的字符不截断显示

支持DV$SQLAREA，DV$SQL，DV$SQLSTATS视图大于32KB大小的字符不截断显示

##   [3. Interfaces（接口）](#3-interfaces接口)  

select SQL_FULLTEXT from gv$sql;

select SQL_FULLTEXT from gv$sqlarea;

select SQL_FULLTEXT from gv$sqlstats;

select SQL_FULLTEXT from dv$sql;

select SQL_FULLTEXT from dv$sqlarea;

select SQL_FULLTEXT from dv$sqlstats;

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

gv视图查询中不支持跨节点lob计算

create table as/insert into select 场景下（含gv视图），主worker在insert向其他节点发送lob请求时无法处理其他节点的请求，不支持

字段其他功能限制同CLOB类型保持一致，sql 缓存不超过2M的sql text

因为缓存的是ctxCursor，可能在sql 缓存频繁刷新的时候发现当前ctxCursor输出invalid context sql字段。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

流程简述：（连接node 1查询，共两个实例 node 1, node 2）

1.node 1执行GV视图查询，通知node 2执行相关查询操作

2.node 2在并行线程中，执行fetch相关字段，识别到sql_fulltext类型为CLOB

3.将CLOB类型的ctxCursor以memory lob的方式存储起来

4.通过px 将memory lob 的 row 发送给node 1

5.node 1在向客户端返回数据时，发现是memory lob类型且存储在node 2上，去node 2上获取，node 2返回LOB数据

新增内容：

1.支持memory lob等其他lob跨节点传输

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

![](https://git.yasdb.com/wangshaohua/picture/-/raw/main/pictures/2024/07/29_14_52_6_20240729145201.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEyNDgsImV4cCI6MTc4MjMyMjA0OH0.S3GAOBy9lMYKL7L6SUEj9iavpok6uiti1lVk7Gcx-b4)

无新增数据结构

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

|用例测试点|预置条件|测试步骤|预期结果|备注|进展|
|---|---|---|---|---|---|
|GV$SQLAREA|集群部署，超过32KB的sql||可以显示超过32KB的sql|pytest用例||
|GV$SQL|集群部署，超过32KB的sql||可以显示超过32KB的sql|pytest用例||
|GV$SQLSTATS|集群部署，超过32KB的sql||可以显示超过32KB的sql|pytest用例||
|DV$SQLAREA|分布式部署，超过32KB的sql||可以显示超过32KB的sql|pytest用例||
|DV$SQL|分布式部署，超过32KB的sql||可以显示超过32KB的sql|pytest用例||
|DV$SQLAREA|分布式部署，超过32KB的sql||可以显示超过32KB的sql|pytest用例||


执行超过32KB的sql语句

select SQL_FULLTEXT from gv$sql;

select SQL_FULLTEXT from gv$sqlarea;

select SQL_FULLTEXT from gv$sqlstats;

##   [7. Document（资料）](#7-document资料)  

主要参考当前LOB的设计文档

  [概要设计文档-Lob/Json/Xmltype - 林永豪 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130140019#41-lob%E6%9E%B6%E6%9E%84%E5%9B%BE)  

  [分布式支持LOB类型 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104215255)  

##   [8. Workload（工作量）](#8-workload工作量)  

问题前置了解，lob相关代码了解 —— 1天

设计文档输出 —— 1天

代码开发 —— 2天

自测（含上车问题解决） —— 2天

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## Attachments:

[gvLob.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmRhMWFkOWEzMzExZGM5MzVlIiwicmVmX2lkIjoiNjczOTZkYmQ3MjgyMDZlZmI5MmYyMmNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMjQ4LCJleHAiOjE3ODIzOTc2NDh9.9Ox52PU0vuPSVDVzkNu0LPJ7PyVjREd8orNRrQb20Gc)

 (image/png)    
