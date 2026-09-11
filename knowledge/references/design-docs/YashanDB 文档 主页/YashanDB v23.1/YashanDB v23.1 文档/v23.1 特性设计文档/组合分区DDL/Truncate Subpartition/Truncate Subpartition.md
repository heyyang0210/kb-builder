Created by 未知用户 (zengzhaohan), last modified on 五月 17, 2023

## 一、语法

```
ALTER TABLE table_name TRUNCATE PARTITION part_name, ...
ALTER TABLE table_name TRUNCATE SUBPARTITION subpart_name, ...

```

  


## 二、功能

truncate与一级分区相似，如果是组合分区，truncate子分区将会清空该子分区下的数据，并且可以truncate多个子分区

|功能|
|---|
|truncate多个分区|
|truncate多个子分区（不必是同个分区）|


## 三、用例

|分区类型|测试场景|用例|输出结果|
|---|---|---|---|
|hash-hash|truncate一级分区|create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1 , subpartition sub2, subpartition sub3)    
  (partition p1,partition p2);,create index idx_hh_composite on hh_composite(a) local;,INSERT INTO hh_composite VALUES(10, 'a', lpad('a', 10000, 'b'));    
  INSERT INTO hh_composite VALUES(20, 'b', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(30, 'c', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(40, 'd', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(50, 'e', lpad('a', 10000, 'b'));,alter table hh_composite truncate partition p1;    
  select * from hh_composite;    
    
|数据都分配到了p1，truncate后select到0行|
||truncate二级分区|drop table hh_composite;,create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1 , subpartition sub2, subpartition sub3)    
  (partition p1,partition p2);,create index idx_hh_composite on hh_composite(a) local;,INSERT INTO hh_composite VALUES(10, 'a', lpad('a', 10000, 'b'));    
  INSERT INTO hh_composite VALUES(20, 'b', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(30, 'c', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(40, 'd', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(50, 'e', lpad('a', 10000, 'b'));,  
  alter table hh_composite truncate subpartition p1_sub2;,select * from hh_composite;|插入5行，truncate后select到2行|
|hash-list|truncate分区|create table hl_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by list(b)    
  (partition p1 (subpartition sub1 values('a') , subpartition sub2 values('b')),partition p2(subpartition sub3 values('a') , subpartition sub4 values('b')));    
  alter table hl_composite truncate partition p1;,create index idx_hl_composite on hl_composite(a) local;,INSERT INTO hh_composite VALUES(10, 'a', lpad('a', 10000, 'b'));    
  INSERT INTO hh_composite VALUES(20, 'b', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(30, 'a', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(40, 'b', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(50, 'a', lpad('a', 10000, 'b'));,INSERT INTO hh_composite VALUES(60, 'b', lpad('a', 10000, 'b'));,alter table hl_composite truncate partition p1;,select * from hl_composite;,  
,create table hl_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a') , subpartition sub2 values('b'))    
  (partition p1,partition p2);    
  alter table hl_composite truncate subpartition p1_sub2, p1_sub1;|成功。|
|hash-range|truncate分区|create table hr_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than ('a') , subpartition sub2 values less than ('b'))    
  (partition p1,partition p2);,create index idx_hr_composite on hr_composite(a) local;    
  alter table hr_composite truncate partition p1;,  
,create table hr_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than ('a') , subpartition sub2 values less than ('b'))    
  (partition p1,partition p2);,create index idx_hr_composite on hr_composite(a) local;    
  alter table hr_composite truncate subpartition p1_sub1;|成功。|
|list-hash|truncate分区|create table lh_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values(10), partition p2 values(20));,create index idx_lh_composite on lh_composite(a) local;    
  alter table lh_composite truncate partition p1;,  
,create table lh_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values(10), partition p2 values(20));,create index idx_lh_composite on lh_composite(a) local;    
  alter table lh_composite truncate subpartition p1_sub1;|成功。|
|list-list|truncate分区|create table ll_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values(default))    
  (partition p1 values(10), partition p2 values(20));,create index idx_ll_composite on ll_composite(a) local;    
  alter table ll_composite truncate partition p1;,INSERT INTO ll_composite VALUES(10, 'a', lpad('a', 10000, 'b'));    
  INSERT INTO ll_composite VALUES(20, 'b', lpad('a', 10000, 'b'));,alter table ll_composite truncate partition p1;,select count(*) from ll_composite where a=10;    
  select count(*) from ll_composite where a=20;|成功。|
|list-range|truncate分区|drop table lr_composite;,create table lr_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than('b'))    
  (partition p1 values(10), partition p2 values(20));,insert into lr_composite values(10, 'a');,alter table lr_composite truncate subpartition p2_sub2;,-- 0,select * from lr_composite;|成功。|
|range-hash|truncate分区|drop table rh_composite;,create table rh_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values less than(10), partition p2 values less than(20));,insert into rh_composite values(1, 'a', lpad('a', 10000, 'b'));,alter table rh_composite truncate partition p2;,-- 0,select * from rh_composite;|成功。|
|range-list|truncate分区|drop table rl_composite;,create table rl_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values(default))    
  (partition p1 values less than(10), partition p2 values less than(20));,insert into rl_composite values(1, 'a', lpad('a', 10000, 'b'));,alter table rl_composite truncate partition p2;,-- 0,select * from rl_composite parttition(p2);,alter table rl_composite truncate subpartition p1_sub1;,-- 0,select * from rl_composite;|成功。|
|range-range|truncate分区|drop table rr_composite;,create table rr_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by range(b),subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than(MAXVALUE))    
  (partition p1 values less than(10), partition p2 values less than(20));,create index idx_rr_composite on rh_composite(a) local;,insert into ll_composite values(1, 'a', lpad('a', 10000, 'b'));,alter table ll_composite truncate partition p1;,alter table ll_composite truncate subpartition p1_sub1;,-- 0,select * from ll_composite;|成功。|


## Comments:

|  [](null)  ,1. truncate 带索引、lob
,Posted by zengzhaohan at 五月 10, 2023 15:15|
|---|
