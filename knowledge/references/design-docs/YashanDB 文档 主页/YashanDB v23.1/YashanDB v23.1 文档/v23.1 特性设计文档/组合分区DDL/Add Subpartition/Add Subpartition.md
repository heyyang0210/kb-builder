Created by 未知用户 (zengzhaohan), last modified by  曾昭瀚 on 十月 31, 2023

# 一、语法

```
-- 往表中新增多个一级分区(hash只能一个)，一级分区下可以定义多个二级分区
ALTER TABLE table_name [add_table_partition]
-- 单独add子分区：modify partition add subpartition，迭代2暂不支持

```

# 二、功能

|功能|
|---|
|add多个一级分区(hash只能一个)，每个分区有多个二级分区|
|指定add分区的segment creation和tablespace属性|
|add一个一级分区，如果没有指定二级分区，会用二级分区模板，如果没有模板，创建默认二级分区|
|add子分区后，也会add对应的local索引子分区|


# 三、约束

|add分区的约束|
|---|
|range分区只能add bound最大的分区，如果需要增加中间的分区，需要使用split(未实现)功能|
|list分区如果已经存在default分区，则不能add partition|
|hash分区每次只能add一个hash分区，同时需要进行数据移动|


# 四、例子

除了DDL的功能外

- 带hash分区（add的话只需关注hash-*）的需要关注和DML的组合，因为add后会有数据重新分布
- 关注跨分区更新到新的分区，关注lob的跨分区更新（在    [组合分区跨分区更新](https://conf.yasdb.com/pages/viewpage.action?pageId=109594014)    有详细说明）
- 新增分区后可以插数据到新的分区
- add后验证是否有新增index分区、lob分区


|分区类型|测试场景|用例|输出结果|
|---|---|---|---|
|hash-hash|add一个一级分区，不指定模板，不定义子分区,  
|drop table hh_composite;    
  create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  (partition p1);    
  create index idx_hh_composite on hh_composite(a) local;    
  alter table hh_composite add partition p2;,insert into hh_composite values(1, '1', '1');,select * from hh_composite partition(p2); --1条    
  select * from dba_ind_subpartitions where index_name=upper('idx_hh_composite'); --2条    
  select * from dba_lob_subpartitions where table_name=upper('hh_composite'); --2条|alter add partition p2之后有2个一级分区，每个一级分区下有一个二级分区,  
|
||add一个一级分区，指定模板，不定义子分区,  
|drop table hh_composite;,create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template(subpartition subp1, subpartition subp2)    
  (partition p1);,create index idx_hh_composite on hh_composite(a) local;    
  alter table hh_composite add partition p2;,insert into hh_composite values(1, '1', '1');,select * from hh_composite partition(p2); --1条,select * from dba_ind_subpartitions where index_name=upper('idx_hh_composite'); --4条    
  select * from dba_lob_subpartitions where table_name=upper('hh_composite'); --4条|alter add partition p2之后有2个一级分区，p2有2个二级分区,  
|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table hh_composite;,create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template(subpartition subp1, subpartition subp2)    
  (partition p1,partition p2);,create index idx_hh_composite on hh_composite(a) local;    
  alter table hh_composite add partition p3(subpartition p3_subp1, subpartition p3_subp2, subpartition p3_subp3);,insert into hh_composite values(1, '1', '1');,select * from hh_composite partition(p2); --1条,select * from dba_ind_subpartitions where index_name=upper('idx_hh_composite'); --2+2+3=7条    
  select * from dba_lob_subpartitions where table_name=upper('hh_composite'); --7条|alter add partition p3之后有3个一级分区，p3有3个二级分区,  
|
||add多个一级分区|drop table hh_composite;,create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  (partition p1, partition p2);,create index idx_hh_composite on hh_composite(a) local;,alter table hh_composite add partition p3, p4;|报错，hash只能添加一个分区|
||add多个hash二级分区|drop table hh_composite;,create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b)    
  (partition p1);,create index idx_hh_composite on hh_composite(a) local;,alter table hh_composite add partition p2 (subpartition p2_sub1, subpartition p2_sub2);,insert into hh_composite values(1, '1', '1');,select * from hh_composite partition(p2); --1条,select * from dba_ind_subpartitions where index_name=upper('idx_hh_composite'); --1+2=3条    
  select * from dba_lob_subpartitions where table_name=upper('hh_composite'); --3条|成功|
||segment creation immediate/deferred|drop table hh_composite;,create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1 , subpartition sub2)    
  (partition p1,partition p2);    
  alter table hh_composite add partition p3 segment creation immediate;,  
,drop table hh_composite;,create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1 , subpartition sub2)    
  (partition p1,partition p2);    
  alter table hh_composite add partition p3 segment creation deferred;|查SEGMENT_CREATED字段|
||指定表空间|drop table hh_composite;,create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1 , subpartition sub2)    
  (partition p1,partition p2);    
  alter table hh_composite add partition p3 tablespace users;|查TABLESPACE_NAME字段|
||重分布|drop table hh_composite;,create table hh_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by hash(b)    
  (partition p1);,insert into hh_composite values(1,1),(2,1);,select count(*) from hh_composite partition(p1);    
  alter table hh_composite add partition p2;,select count(*) from hh_composite partition(p1);,select count(*) from hh_composite partition(p2);|add前p1有2行数据,add partition p2后，p1和p2发生重分布，p1和p2各占一行,  
,  
|
||跨分区更新到add的分区|drop table hh_composite;,create table hh_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by hash(b),subpartition template (subpartition sub1 , subpartition sub2)    
  (partition p1)   **enable row movement**  ;,insert into hh_composite values(2, 2, lpad('a', 10000, 'b'));,alter table hh_composite add partition p2;,update hh_composite set a=1, c=c||c where a=2;,select count(*) from hh_composite partition(p1);,select count(*) from hh_composite partition(p2);,delete from hh_composite where a=2;|add前p1有1行数据,add p2，update后，p1没有数据，p2有1行数据,delete后每个分区都没数据了|
|hash-list|add一个一级分区，不指定模板，不定义子分区,  
|drop table hl_composite;,create table hl_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by list(b)    
  (partition p1,partition p2);    
  alter table hl_composite add partition p3;,create index idx_hl_composite on hh_composite(a) local;,alter table hl_composite modify partition p3 add subpartition subp1 values('a');,select * from dba_ind_subpartitions where index_name=upper('idx_hl_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('hl_composite'); --3条|alter add partition p3后有3个一级分区，p3有1个default子分区,modify add subpartition报错，因为有default子分区了|
||add一个一级分区，指定模板，不定义子分区,  
|drop table hl_composite;,create table hl_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a') , subpartition sub2 values('b'))    
  (partition p1,partition p2);    
  alter table hl_composite add partition p3;,alter table hl_composite modify partition p3 add subpartition subp1 values('c');|alter add partition p3后有3个一级分区，p3有2个子分区,modify add subpartition后，p3有3个二级分区|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table hl_composite;,create table hl_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a') , subpartition sub2 values('b'))    
  (partition p1, partition p2);    
  alter table hl_composite add partition p3(subpartition sub1 values('a'), subpartition sub2 values('b'), subpartition sub3 values('c'));,alter table hl_composite modify partition p3 add subpartition subp1 values('d');|alter add partition p3后有3个一级分区，p3有3个子分区,modify add subpartition后，p3有4个二级分区|
||add多个一级分区|drop table hl_composite;,create table hl_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by list(b)    
  (partition p1,partition p2);    
  alter table hl_composite add partition p3, partition p4;|报错，hash只能添加一个分区|
||modify add多个二级分区|drop table hl_composite;,create table hl_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a') , subpartition sub2 values('b'))    
  (partition p1, partition p2);,alter table hl_composite modify partition p2 add subpartition subp1 values('c'), subpartition subp2 values('d');|成功。modify add subpartition后p2下有4个子分区|
||重分布|drop table hl_composite;,create table hl_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a') , subpartition sub2 values('b'))    
  (partition p1);,insert into hl_composite values(1,'a'),(2,'b'),(3,'a'),(4,'b');,select count(*) from hl_composite partition(p1);    
  alter table hl_composite add partition p3;,select count(*) from hl_composite partition(p1);,select count(*) from hl_composite partition(p3);,select count(*) from hl_composite subpartition(subp3);|成功。|
|hash-range|add一个一级分区，不指定模板，不定义子分区,  
|drop table hr_composite;,create table hr_composite(a int, b varchar(10), c clob)    
  partition by hash(a)    
  subpartition by range(b)    
  (partition p1 ,partition p2);,create index idx_hr_composite on hh_composite(a) local;    
  alter table hr_composite add partition p3;,select * from dba_ind_subpartitions where index_name=upper('idx_hr_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('hr_composite'); --3条|alter add partition p3后有3个一级分区，p3有1个maxvalue子分区,modify add subpartition报错，因为有maxvalue子分区了|
||add一个一级分区，指定模板，不定义子分区,  
|drop table hr_composite;,create table hr_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('b'), subpartition sub2 values less than('c'))    
  (partition p1 ,partition p2);    
  alter table hr_composite add partition p3;    
  alter table hr_composite modify partition p3 add subpartition subp1 values less than('d');|alter add partition p3后有3个一级分区，p3有2个子分区,modify add subpartition后，p3有3个子分区|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table hr_composite;,create table hr_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('b'), subpartition sub2 values less than('c'))    
  (partition p1 ,partition p2);    
  alter table hr_composite add partition p3(subpartition subp1 values less than('d'), subpartition subp2 values less than('e'));    
  alter table hr_composite modify partition p3 add subpartition subp3 values less than('f');|alter add partition p3后有3个一级分区，p3有2个子分区,modify add subpartition后，p3有3个子分区|
||add多个一级分区|drop table hr_composite;,create table hr_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by range(b)    
  (partition p1 ,partition p2);,alter table hr_composite add partition p3(subpartition subp1 values less than('b'), subpartition subp2 values less than('c')), partition p4;|报错，hash只能添加一个分区|
||重分布|drop table hr_composite;,create table hr_composite(a int, b varchar(10))    
  partition by hash(a)    
  subpartition by range(b)    
  (partition p1);,insert into hr_composite values(1, '1', lpad('a', 10000, 'b')), (2, '2', lpad('a', 10000, 'b'));,alter table hr_composite add partition p2;,select * from hr_composite partition(p1); --1条,select * from hr_composite partition(p2); --1条,  
,--无法正常重分布的例子,drop table hr_composite;    
  create table hr_composite(a int, b int, c clob)    
  partition by hash(a)    
  subpartition by range(b)    
  (partition p1(subpartition p1_sub1 values less than(20)));    
  insert into hr_composite values(1, 19, lpad('a', 10000, 'b'));    
  insert into hr_composite values(2, 19, lpad('a', 10000, 'b'));    
  alter table hr_composite add partition p2(subpartition p2_sub1 values less than(10)); --b=19无法重分布到p2，报错。改成30则正常    
  select * from hr_composite partition(p1); --1条    
  select * from hr_composite partition(p2); --1条|  
|
|list-hash|add一个一级分区，不指定模板，不定义子分区,  
|drop table lh_composite;,create table lh_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by hash(b)    
  (partition p1 values(10), partition p2 values(20));,create index idx_hr_composite on lh_composite(a) local;    
  alter table lh_composite add partition p3 values(30);,select * from dba_ind_subpartitions where index_name=upper('idx_lh_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('lh_composite'); --3条|alter add partition p3后有3个一级分区，p3有1个子分区,  
|
||add一个一级分区，指定模板，不定义子分区|drop table lh_composite;,create table lh_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by hash(b),subpartition template(subpartition sub1, subpartition sub2)    
  (partition p1 values(10), partition p2 values(20));    
  alter table lh_composite add partition p3 values(30);|成功。|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table lh_composite;,create table lh_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by hash(b),subpartition template(subpartition sub1, subpartition sub2)    
  (partition p1 values(10), partition p2 values(20));    
  alter table lh_composite add partition p3 values(30)(subpartition subp1, subpartition subp2);|成功。|
||add多个一级分区|drop table lh_composite;,create table lh_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values(10), partition p2 values(20));    
  alter table lh_composite add partition p3 values(30) (subpartition subp1, subpartition subp2), partition p4 values(40) (subpartition subp3);|成功。|
||modify add多个二级分区|drop table lh_composite;,create table lh_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values(10), partition p2 values(20));,alter table lh_composite add partition p3;|modify失败，hash只能添加一个分区|
|list-list|add一个一级分区，不指定模板，不定义子分区,  
|drop table ll_composite;,create table ll_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by list(b)    
  (partition p1 values(10), partition p2 values(20));,create index idx_hr_composite on ll_composite(a) local;    
  alter table ll_composite add partition p3 values(30);,select * from dba_ind_subpartitions where index_name=upper('idx_ll_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('ll_composite'); --3条|alter add partition p3后有3个一级分区，p3有1个default子分区,modify add subpartition报错，因为有default子分区了|
||add一个一级分区，指定模板，不定义子分区,  
|drop table ll_composite;,create table ll_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values('b'))    
  (partition p1 values(10), partition p2 values(20));    
  alter table ll_composite add partition p3 values(30);|成功。|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table ll_composite;,create table ll_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values(default))    
  (partition p1 values(10), partition p2 values(20));    
  alter table ll_composite add partition p3 values(30)(subpartition subp1 values('a'), subpartition subp2 values('b'));|成功。|
||add多个一级分区|drop table ll_composite;,create table ll_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by list(b)    
  (partition p1 values(10), partition p2 values(20));    
  alter table ll_composite add partition p3 values(30), partition p4 values(40);|成功。|
|list-range|add一个一级分区，不指定模板，不定义子分区,  
|drop table lr_composite;,create table lr_composite(a int, b varchar(10), c clob)    
  partition by list(a)    
  subpartition by range(b)    
  (partition p1 values(10), partition p2 values(20));,create index idx_hr_composite on lr_composite(a) local;    
  alter table lr_composite add partition p3 values(30);,select * from dba_ind_subpartitions where index_name=upper('idx_lr_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('lr_composite'); --3条|alter add partition p3后有3个一级分区，p3有1个default子分区,modify add subpartition报错，因为有maxvalue子分区了|
||add一个一级分区，指定模板，不定义子分区,  
|drop table lr_composite;,create table lr_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than('b'))    
  (partition p1 values(10), partition p2 values(20));    
  alter table lr_composite add partition p3 values(30);|modify add subpartition报错，range分区只能add bound最大的分区|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table lr_composite;,create table lr_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than('b'))    
  (partition p1 values(10), partition p2 values(20));    
  alter table lr_composite add partition p3 values(30)(subpartition subp1 values less than('c'), subpartition subp2 values less than('d'));|成功|
||add多个一级分区|drop table lr_composite;,create table lr_composite(a int, b varchar(10))    
  partition by list(a)    
  subpartition by range(b)    
  (partition p1 values(10), partition p2 values(20));    
  alter table lr_composite add partition p3 values(30), partition p4 values(40);|成功|
|range-hash|add一个一级分区，不指定模板，不定义子分区,  
|drop table rh_composite;,create table rh_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by hash(b)    
  (partition p1 values less than(10), partition p2 values less than(20));,create index idx_rh_composite on rh_composite(a) local;    
  alter table rh_composite add partition p3 values less than(10);,select * from dba_ind_subpartitions where index_name=upper('idx_rh_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('rh_composite'); --3条|add失败，range分区只能add bound最大的分区|
||add一个一级分区，指定模板，不定义子分区,  
|drop table rh_composite;,create table rh_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rh_composite add partition p3 values less than(MAXVALUE);|成功。|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table rh_composite;,create table rh_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rh_composite add partition p3 values less than(MAXVALUE)(subpartition subp1, subpartition subp2, subpartition subp3);|modify失败，因为子分区重名|
||add多个一级分区|drop table rh_composite;,create table rh_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by hash(b)    
  subpartition template (subpartition sub1, subpartition sub2)    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rh_composite add partition p3 values less than(30), partition p4 values less than(40);|成功。|
|range-list|add一个一级分区，不指定模板，不定义子分区,  
|drop table rl_composite;,create table rl_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by list(b)    
  (partition p1 values less than(10), partition p2 values less than(20));,create index idx_rl_composite on rh_composite(a) local;    
  alter table rl_composite add partition p3 values less than(MAXVALUE);,select * from dba_ind_subpartitions where index_name=upper('idx_rl_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('rl_composite'); --3条|失败，因为有default子分区了|
||add一个一级分区，指定模板，不定义子分区,  
|drop table rl_composite;,create table rl_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values('b'))    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rl_composite add partition p3 values less than(MAXVALUE);|失败，list值重复|
||add一个一级分区，指定模板，定义多个子分区,  
|drop table rl_composite;,create table rl_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values(default))    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rl_composite add partition p3 values less than(30)(subpartition values('a'), subpartition values('b'));|成功。|
||add多个一级分区|drop table rl_composite;,create table rl_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by list(b)    
  subpartition template (subpartition sub1 values('a'), subpartition sub2 values(default))    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rl_composite add partition p3 values less than(30), partition p4 values less than(40);|成功|
|range-range|add一个一级分区，不指定模板，不定义子分区,  
|drop table rr_composite;,create table rr_composite(a int, b varchar(10), c clob)    
  partition by range(a)    
  subpartition by range(b)    
  (partition p1 values less than(10), partition p2 values less than(20));,create index idx_rr_composite on rh_composite(a) local;    
  alter table rr_composite add partition p3 values less than(MAXVALUE);,select * from dba_ind_subpartitions where index_name=upper('idx_rr_composite'); --3条    
  select * from dba_lob_subpartitions where table_name=upper('rr_composite'); --3条|modify失败，有maxvalue了|
||add一个一级分区，指定模板，不定义子分区,  
|drop table rr_composite;,create table rr_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than('b'))    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rr_composite add partition p3 values less than(MAXVALUE);|成功|
||add一个一级分区，指定模板，定义多个子分区,  
|create table rr_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than(MAXVALUE))    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rr_composite add partition p3 values less than(MAXVALUE)(subpartition values less  than('a'), subpartition values less  than('b'));|成功|
||add多个一级分区|create table rr_composite(a int, b varchar(10))    
  partition by range(a)    
  subpartition by range(b)    
  subpartition template (subpartition sub1 values less than('a'), subpartition sub2 values less than(MAXVALUE))    
  (partition p1 values less than(10), partition p2 values less than(20));    
  alter table rr_composite add partition p3 values less than(30), partition p3 values less than(40);|成功|


## Comments:

|  [](null)  ,1. 跨分区更新
1. add后能正常插入
1. add带lob
,Posted by zengzhaohan at 五月 10, 2023 15:03|
|---|
