Created by 王博文 on 四月 12, 2024

SR链接：    [视图中字段支持comment功能](https://pingcode.yasdb.com/pjm/items/6613a8cefd997db58ad5abcd?)  

##   [1. Overview（概述）](#1-overview概述)  

  [YDBRD-22904 刷新视图依赖信息](https://jira.yasdb.com/browse/YDBRD-22904)    支持对 force view 进行编译以及对系统表 col$ 刷新，满足支持 COMMENT ON COLUMN force view 的元数据条件。

本设计方案旨在支持 COMMENT ON COLUMN 语句操作 force view 中的列。

##   [2. Features（功能特性）](#2-features功能特性)  

对外提供语法

![](https://pingcode.yasdb.com/atlas/files/public/67396cc28970c2af4f520e33/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMyMzYsImV4cCI6MTc4MjMxNDAzNn0.5C5-9PiemCiFPqWrC_VbSnhl6Gq2ti9ftrcLxc5egF4)

语法图来源于     [COMMENT](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/COMMENT.html)     语句，本次支持 view 可选为 force view。

即对使用     [CREATE FORCE VIEW](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20VIEW.html)     语句创建的 force view，使用语句 COMMENT ON COLUMN 语句操作后预期成功，记录可在系统表 COM$、系统视图 DBA_TAB_COMMENTS、DBA_COL_COMMENTS 中查询。

##   [3. Interfaces（接口）](#3-interfaces接口)  

本方案不涉及新增接口，仅支持上文语法图中关键字 view 可选为 force view。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

执行 COMMENT ON COLUMN force view 需确保 force view 可编译成功或 col$ 存在操作的列的记录。

##   [5 Architecture（架构）](#5-architecture架构)  

根据force view创建方式不同，成功进行 COMMENT 操作的条件不同。

对比以下3个场景：

|场景（均默认基表不存在）|描述（执行comment on column force view）|
|---|---|
|create force view fv1 as select * from ft1;,create table ft1 (id int, name varchar(100));|未创建基表均无法执行，报错无效标识符|
||创建基表，yasdb、oracle可对列名（id、name）执行，其余（如age）报错无效标识符|
|create force view fv2 as select id,name from ft2;,create table ft2 (id int, name varchar(100));   –- a,create table ft2 (id int, age int);                      –- b|未创建基表，oracle可对id、name执行；yasdb报错无效标识符|
||创建基表a，编译成功，yasdb可执行|
||创建基表b，由于编译不通过，yasdb报错无效标识符|
|create force view fv3(id, name) as select age from ft3;,create table ft3 (age int);|未创建基表，yasdb、oracle均可执行（在col$记录id、name）|
||创建基表，尽管无法查询fv3（编译不通过），但仍可执行comment|


参考    [View编译、元数据刷新](https://conf.yasdb.com/pages/viewpage.action?pageId=147780873)    。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

报错原因均为 COMMENT 语句指定的列名不存在。

对于以上3种情况，使用以下3组自测用例。

```
1、create force view fv1 as select * from ft1;
-- 预期失败（因为不存在基表）
comment on column fv1.id is 'fv1.id';
create table ft1 (id int, name varchar(100));
-- 预期成功
comment on column fv1.id is 'fv1.id';
comment on column fv1.name is 'fv1.name';
-- 预期失败
comment on column fv1.age is 'fv1.age';
-- 可查询到对id、name的记录
select * from com$;

2、create force view fv2 as select id,name from ft2;
-- 预期失败（因为不存在基表）
comment on column fv2.id is 'fv2.id';
create table ft2 (id int, age int);
-- 预期失败（因为视图编译失败）
comment on column fv2.id is 'fv2.id';
comment on column fv2.name is 'fv2.name';
comment on column fv2.age is 'fv2.age';
select * from com$;

drop table ft2;
create table ft2 (id int, name varchar(100));
-- 预期成功（因为视图编译成功）
comment on column fv2.id is 'fv2.id';
comment on column fv2.name is 'fv2.name';
-- 预期失败
comment on column fv2.age is 'fv2.age';
select * from com$;

3、create force view fv3(id, name) as select * from ft3;
-- 预期成功（col$中包含id、name列）
comment on column fv3.id is 'fv3.id';
comment on column fv3.name is 'fv3.name';
-- 预期失败
comment on column fv3.age is 'fv3.age';
select * from com$;

```

第4组用例描述基表本已存在的情况：

```
4、create table ft4(id int, name varchar(100));
create force view fv4 as select id, age from ft4;
-- 预期失败（因为视图编译失败）
comment on column fv4.id is 'fv4.id';
comment on column fv4.name is 'fv4.name';
comment on column fv4.age is 'fv4.age';

drop view fv4;
create force view fv4 as select id, name from ft4;
-- 预期成功（因为视图编译成功）
comment on column fv4.id is 'fv4.id';
comment on column fv4.name is 'fv4.name';
-- 预期失败
comment on column fv4.age is 'fv4.age';
select * from com$;

```

##   [7.资料设计章节](#7资料设计章节)  

不涉及资料修改。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments: