  [https://pingcode.yasdb.com/pjm/items/6743dd4f2c685d48562e4503?](https://pingcode.yasdb.com/pjm/items/6743dd4f2c685d48562e4503?)  

#YDBRD-35697 子表DDL操作时支持对父表加共享锁而不是排他锁

# 1. 概述

在存在外键的一些场景，子表做DDL，yashan会给父表加排他锁，会阻塞父表的业务，出现死锁的情况，与oracle表现不一致。

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


## 2.2 应用场景

*需求本身的主要应用场景*

- 在存在外键的场景下，对子表做DDL


需求与其他特性的关联场景

- 无


## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


# 3. 详细测试设计

## 3.1 测试设计方法

*本测试设计中主要采用场景法，对存在外场场景下的子表和父表进行各种的DDL操作，验证加锁的操作是否正确*

## 3.2 详细测试设计

测试范围：单机、集群

1. *功能场景*


|测试场景|预期|场景举例|
|---|---|---|
|给目标表做,一、创建/重建索引 ,1. create index [online] [local]
1. rebuild [partition/subpartition] [online]
,,二、修改索引,共享锁：,1. VISIBLE/INVISIBLE
1. COALESCE
1. NOPARALLEL/PARALLEL
1. INITRANS
1. UNUSABLE
1. NOLOGGING/LOGGING
1. RENAME TO
,|父子表是共享锁|create table T1(f1 int unique, f2 varchar(100));,create table T2(f1 int , f2 varchar(100));,alter table T2 add foreign key(f1) references T1(F1);,insert into T1 values(2,'test2');,insert into T2 values(2,'test2');,commit;,--session1,insert into T1 values(1,'test1');,--session2,create  index index1 on T2(f1);,drop table T2;,drop table T1;|
|给目标表做分区操作,- merge partition/subpartition
- split partition
- drop partition/subpartition
- truncate partition/subpartition
- add  partition/subpartition
|父子表是共享锁,,*oracle加的共享锁，可以直接ddl*,*myql不能把外键创建在分区键，分区键还必须包含唯一键，不存在该场景*,|create table T1(f1 int unique, f2 varchar(100))partition by range(f1) ,(partition p1 values less than (10), partition p2 values less than (20));,create table T2(f1 int unique, f2 varchar(100))partition by range(f1) ,(partition p1 values less than (10), partition p2 values less than (20));,alter table T2 add foreign key(f1) references T1(F1);,insert into T1 values(2,'test2');,insert into T2 values(2,'test2');,commit;,--session1,insert into T1 values(1,'test1');,--session2,alter table  T2 split partition p2  at (15) into (partition   p2,partition p3);,alter table T2 drop partition p2;|
|给目标表添加约束,- 主键
- 唯一
- check
- 外键  --共享锁
- 删除约束  --排他锁
,|父子表除外键是排他锁，其余是共享锁,|s1:,ALTER SYSTEM SET ddl_lock_timeout = 100000;,SET AUTOCOMMIT OFF；,drop table c;,drop table p;,create table p(a int primary key);,create table c(a int);,insert into p values(1);,s2:,alter table c add foreign key(a) references p(a);,s1:,insert into c values(1);|
|给目标表增加，删除一列,- 增加列  --共享锁
- 删除列  --排他锁
- 增加列的同步增加约束  主键/外键/唯一/check/not nul
|增加列直接成功，drop column 排他锁,,*oracle 增加列直接成功，drop column 等待*,*MYSQL直接可以删除成功*|create table T1(f1 int unique, f2 varchar(100));,create table T2(f1 int , f2 varchar(100));,alter table T2 add foreign key(f1) references T1(F1);,insert into T1 values(2,'test2');,insert into T2 values(2,'test2');,commit;,--session1,insert into T1 values(1,'test1');,--session2,alter table  T2 drop column F2;,--不结束的就drop 表会出现死锁（oracle）,drop table T2;,drop table T1;|
|修改目标表的数据类型  --排他锁|报错|create table T1(f1 int unique, f2 varchar(100));,create table T2(f1 int , f2 varchar(100));,alter table T2 add foreign key(f1) references T1(F1);,insert into T1 values(2,'test2');,insert into T2 values(2,'test2');,commit;,--session1,insert into T1 values(1,'test1');,--session2, alter table  T2 modify  F2 varchar(110);,|
|给目标表做truncate、drop全表 --排他锁|报错,,*oracle等待 加的排他锁*,*mysql 会等待*|create table T1(f1 int unique, f2 varchar(100));,create table T2(f1 int , f2 varchar(100));,alter table T2 add foreign key(f1) references T1(F1);,insert into T1 values(2,'test2');,insert into T2 values(2,'test2');,commit;,--session1,insert into T1 values(1,'test1');,--session2, alter table  T2  rename to T2_NEW;|
|给目标表做shrink table --排他锁,实测是共享锁，与开发对齐，加入该场景|报错,,*oracle 加排他锁*|create table T1(f1 int unique, f2 varchar(100));,create table T2(f1 int , f2 varchar(100));,alter table T2 add foreign key(f1) references T1(F1);,insert into T1 values(2,'test2');,insert into T2 values(2,'test2');,commit;,--session1,insert into T1 values(1,'test1');,--session2,alter table  T2 enable row movement;,alter table T2 shrink space;,--不结束的就drop 表会出现死锁,drop table T2;,drop table T1;|
|A,B,C 三表外键成链|对A表做DDL，B,C表均添加共享锁。,对B表做DDL，B,C表均添加共享锁。,对C表做DDL，A,B表均添加外键。||
|A表是B,C两表的父表|对A表做DDL，B,C表均添加共享锁。,对B,C表做DDL，表A添加共享锁。||
|并发|父表ddl + 子表dml并发,子表ddl+ 父表dml并发||


集群以上场景将不同session 放在不同实例上



    2. :DFX覆盖

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|  
不涉及|
|长稳|  
不涉及|
|一致性|  
不涉及|
|三方测试工具  
(sqltest，sqlancer)|不涉及  
|
|安全|  
不涉及|
|DFR|不涉及  
|
|HA|  
不涉及|
|压力|  
不涉及|
|性能|不涉及  
|
|可维护性|  
不涉及|


  


# 4. 测试用例

  [【YDBRD-35697 】子表操作DDL支持对父表加共享锁.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdjNTRiNjQzOTgyM2YyYWMxZjI2MmY1IiwicmVmX2lkIjoiNjc3YjMwODcxZTE1NTEyMzViZWViYjE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5NDcwLCJleHAiOjE3ODI1NDU4NzB9.fiNm7K8UDrHUs5NAdROwCnhB_pyEG7sPQVwZvMh1YVo)  

冒烟用例：

  [test.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdjNTRiN2U2YTFhZTkyYWUzNzM2ODUyIiwicmVmX2lkIjoiNjc3YjMwODcxZTE1NTEyMzViZWViYjE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5NDcxLCJleHAiOjE3ODI1NDU4NzF9.ZPd3xJ4SWRXobip-DrfyA0M3WjkDBBKSllOlb0UOZl8)  

# 5. 测试框架设计

- *当前的guider框架可以满足并发的精准看护*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *5人天*

- *调研+测试设计+评审 --2人天*
- *用例自动化+测试+上车--7人天*


计划测试完成时间：



参考:  [https://pingcode.yasdb.com/wiki/spaces/ZHENGQUAN/pages/6764ca0ea03b8234860b6a08](https://pingcode.yasdb.com/wiki/spaces/ZHENGQUAN/pages/6764ca0ea03b8234860b6a08)  