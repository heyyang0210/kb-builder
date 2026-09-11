Created by 未知用户 (zengzhaohan), last modified on 五月 16, 2023

# 一、语法

```
-- 可以drop多个partition
ALTER TABLE table_name DROP PARTITION part_name, ...
-- 可以drop多个subpartition
ALTER TABLE table_name DROP SUBPARTITION subpart_name, ...

```

  


# 二、功能

与一级分区drop功能相似，只是改成drop二级分区。

|功能|
|---|
|drop一个子分区|
|drop同一分区下的多个子分区|
|drop子分区，local索引相应的子分区也被drop|


# 三、限制

drop的约束有：

|约束|
|---|
|不能删除一个分区下所有的subpartiton|
|不能drop hash subpartition|
|不能跨分区drop二级分区|


# 四、用例

除了DDL的功能外，还需要验证：

- 无法再插数据到drop的分区/子分区
- drop后，select drop的分区会报错，例如select parttition(p1, p2, ...)或者select subpartition(subp1, subp2, ...)报错


|分区类型|测试场景|用例|输出结果|
|---|---|---|---|
|hash-hash|drop一级分区|create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1 , subpartition sub2)    
  (partition p1,partition p2);alter table hh_composite drop partition p1;|失败，不能drop hash分区|
||drop二级分区|create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1 , subpartition sub2, subpartition sub3)    
  (partition p1,partition p2);    
  alter table hh_composite drop subpartition p1_sub1;|失败，不能drop hash分区|
|hash-list|drop一级分区|drop table hl_composite;,create table hl_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by list(b)    
  (partition p1(subpartition sub1 values('a') , subpartition sub2 values('b')),partition p2(subpartition sub3 values('a') , subpartition sub4 values('b')));    
  alter table hl_composite drop partition p1;|失败，不能drop hash分区|
||drop二级分区|create table hl_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by list(b)    
  (partition p1(subpartition sub1 values('a') , subpartition sub2 values('b'), subpartition sub3 values('c')),partition p2(subpartition sub4 values('a') , subpartition sub5 values('b')));,create index idx_hl_composite on hl_composite(a) local;    
  alter table hl_composite drop subpartition sub1, sub2;,select * from dba_ind_subpartitions where index_name=upper('idx_hl_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('hl_composite'); --3条|成功。|
||跨分区drop子分区|create table hl_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by list(b)    
  (partition p1(subpartition sub1 values('a') , subpartition sub2 values('b'), subpartition sub3 values('c')),,partition p2(subpartition sub4 values('a') , subpartition sub5 values('b')));,alter table hl_composite drop subpartition sub1, sub4;|失败，不能跨分区drop子分区|
||删所有分区|create table hl_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by list(b)    
  (partition p1(subpartition sub1 values('a') , subpartition sub2 values('b'), subpartition sub3 values('c')),,partition p2(subpartition sub4 values('a') , subpartition sub5 values('b')));,alter table hl_composite drop subpartition sub5, sub4;|失败，不能drop掉所有分区|
|hash-range|drop一级分区|create table hr_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than ('a') , subpartition sub2 values less than ('b'))    
  (partition p1,partition p2);|失败，不能drop hash分区|
||drop二级分区|create table hr_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than ('a') , subpartition sub2 values less than ('b'))    
  (partition p1,partition p2);,create index idx_hr_composite on hr_composite(a) local;,alter table lh_composite drop partition p1_sub1;,select * from dba_ind_subpartitions where index_name=upper('idx_hr_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('hr_composite'); --3条|成功。|
|list-hash|drop一级分区|create table lh_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by hash(b)    
  (partition p1 values(10)(subpartition p1_sp1, subpartition p1_sp2), partition p2 values(20)(subpartition p2_sp1));,create index idx_lh_composite on lh_composite(a) local;    
  alter table lh_composite drop partition p1;,select * from dba_ind_subpartitions where index_name=upper('idx_hr_composite'); --1条    
  select * from dba_lob_subpartitions where table_name=upper('hr_composite'); --1条|成功。|
||drop二级分区|create table lh_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by hash(b)    
  (partition p1 values(10)(subpartition p1_sp1, subpartition p1_sp2, subpartition p1_sp3), partition p2 values(20)(subpartition p2_sp1));    
  alter table lh_composite drop subpartition p1_sp2;|失败，不能drop hash分区|
|list-list|drop一二级分区|drop table ll_composite;,create table ll_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values(default))    
  (partition p1 values(10), partition p2 values(20));,create index idx_ll_composite on ll_composite(a) local;,alter table lr_composite drop partition p1;,alter table lr_composite drop subpartition p2_sub2;,select * from dba_ind_subpartitions where index_name=upper('idx_ll_composite'); --1条    
  select * from dba_lob_subpartitions where table_name=upper('ll_composite'); --1条|  
|
|list-range|drop一二级分区|drop table lr_composite;,create table lr_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than('b'))    
  (partition p1 values(10), partition p2 values(20));,create index idx_lr_composite on lr_composite(a) local;,alter table lr_composite drop partition p1;,alter table lr_composite drop subpartition p2_sub2;,select * from dba_ind_subpartitions where index_name=upper('idx_lr_composite'); --1条    
  select * from dba_lob_subpartitions where table_name=upper('lr_composite'); --1条|  
|
|range-hash|drop一二级分区|drop table rh_composite;,create table rh_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values less than(10), partition p2 values less than(20));,create index idx_rh_composite on rh_composite(a) local;,alter table rh_composite drop partition p1;,alter table rh_composite drop subpartition p2_sub2;,select * from dba_ind_subpartitions where index_name=upper('idx_rh_composite'); --1条    
  select * from dba_lob_subpartitions where table_name=upper('rh_composite'); --1条|  
|
|range-list|drop一二级分区|drop table rl_composite;,create table rl_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values('b'))    
  (partition p1 values less than(10), partition p2 values less than(20));,create index idx_rl_composite on rl_composite(a) local;,alter table rl_composite drop partition p1;,alter table rl_composite drop subpartition p2_sub2;,select * from dba_ind_subpartitions where index_name=upper('idx_rl_composite'); --1条    
  select * from dba_lob_subpartitions where table_name=upper('rl_composite'); --1条|  
|
|range-range|drop一二级分区|drop table rr_composite;,create table rr_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than('b'))    
  (partition p1 values less than(10), partition p2 values less than(20));,create index idx_rr_composite on rr_composite(a) local;,alter table rr_composite drop partition p1;,alter table rr_composite drop subpartition p2_sub2;,select * from dba_ind_subpartitions where index_name=upper('idx_rr_composite'); --1条    
  select * from dba_lob_subpartitions where table_name=upper('rr_composite'); --1条|  
|


drop二级分区与分区索引联合测试

|测试场景|用例|输出结果|
|---|---|---|
|建local索引，drop一个一级分区|drop table lr_composite;    
  create table lr_composite(c1 int, c2 int)    
  partition by list(c1)    
  subpartition by range(c2)    
  (partition p1 values(10) (subpartition sp1 values less than(20), subpartition sp2 values less than(30)),     
  partition p2 values(20) (subpartition sp3 values less than(10), subpartition sp4 values less than(40)));    
  create index lr_composite_idx on lr_composite(c2) local;    
  alter table lr_composite drop partition p1;,select * from DBA_TAB_SUBPARTITIONS where table_name='LR_COMPOSITE';    
  select * from DBA_IND_SUBPARTITIONS where index_name='LR_COMPOSITE_IDX';|查到2个表的二级分区,查到2个索引的二级分区|
|建local索引，drop一个二级分区|drop table lr_composite;    
  create table lr_composite(c1 int, c2 int)    
  partition by list(c1)    
  subpartition by range(c2)    
  (partition p1 values(10) (subpartition sp1 values less than(20), subpartition sp2 values less than(30)),     
  partition p2 values(20) (subpartition sp3 values less than(10), subpartition sp4 values less than(40)));    
  create index lr_composite_idx on lr_composite(c2) local;    
  alter table lr_composite drop subpartition sp3;,select * from DBA_TAB_SUBPARTITIONS where table_name='LR_COMPOSITE';    
  select * from DBA_IND_SUBPARTITIONS where index_name='LR_COMPOSITE_IDX';|查到3个表的二级分区,查到3个索引的二级分区|
|建local索引，drop多个二级分区|drop table lr_composite;    
  create table lr_composite(c1 int, c2 int)    
  partition by list(c1)    
  subpartition by range(c2)    
  (partition p1 values(10) (subpartition sp1 values less than(20), subpartition sp2 values less than(30)),     
  partition p2 values(20) (subpartition sp3 values less than(10), subpartition sp4 values less than(40)));    
  create index lr_composite_idx on lr_composite(c2) local;    
  alter table lr_composite drop subpartition sp3, sp2;,select * from DBA_TAB_SUBPARTITIONS where table_name='LR_COMPOSITE';    
  select * from DBA_IND_SUBPARTITIONS where index_name='LR_COMPOSITE_IDX';|不能drop多个分区下的子分区,subpartition names specified are across multiple partitions|


## Comments:

|  [](null)  ,1. drop、truncate 不进回收站
,Posted by zengzhaohan at 五月 10, 2023 15:10|
|---|
