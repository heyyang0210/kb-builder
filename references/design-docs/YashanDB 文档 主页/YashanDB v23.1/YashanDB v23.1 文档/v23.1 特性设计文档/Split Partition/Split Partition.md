Created by 未知用户 (zengzhaohan), last modified by  曾昭瀚 on 一月 16, 2024

JIRA：    [[YDBRD-13576] 分区支持split - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13576)    、    [[YDBRD-21348] 集群支持分区split - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21348)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

SPLIT PARTITION能将一个range(包括interval)/list分区重新划分为多个分区。

SPLIT PARTITION一般用在将一个大分区划分为多个小分区的场景，当一个分区过于臃肿影响到了查询、备份等性能时，可以考虑SPLIT PARTITION。

SPLIT PARTITION与ADD PARTITION不同的是

1. 如果range分区表中有MAXVALUE分区或者list分区表中有DEFAULT分区，此时无法使用ADD PARTITION增加分区，需要使用SPLIT PARTITION从MAXVALUE/DEFAULT划分出新分区。
1. 用户希望在range分区表开始或者中间分区中添加新分区也需要使用SPLIT PARTITION，因为ADD PARTITION只能从最高的part bound往后添加分区。


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

将一个类型为range/list的子/分区重新划分为多个分区

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a46a1ad9a3311dc7beb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI0MDcsImV4cCI6MTc4MjIyMzIwN30.GGFyFMIC11N2AgLA-FarqXx7yPxd3kGREBDzvCyvCfI)

  


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. hash分区不能split
1. update global indexes为语法兼容，全局索引是一定失效的。update indexes时不会失效local索引但会失效global 索引。
1. 暂不支持组合分区split


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 5.1 总体流程

```
// 1. 修改元数据
//   1.1 生成split后最后一个分区的part bound
//   1.2 创建split后表的分区、索引分区、lob分区
//   1.3 删除被split的分区元数据
//
// 2. 数据迁移
//   2.1 检查数据是否都迁移到split后的某个分区里
//     2.1.1 是的话判断是否能复用，可以的话则复用被split分区
//   2.2 否则失效全局索引，如果没有update indexes则也要失效对应的local索引分区
//   2.3 遍历原分区数据，插入到对应的分区中
//   2.4 删除被split分区的segment
//
// 3. 集群失效dc
//   3.1 进入到DDL二阶段释放互斥锁时，通知其他实例失效dc
```

### 5.2 生成最后一个分区的part bound

如果是range分区，则最后一个分区的part bound继承被split分区的part bound，例如

```
create table split_range_part(c1 int)
partition by range(c1)
(partition p1 values less than(100),
partition p2 values less than(200),
partition p3 values less than(300),
partition p4 values less than(MAXVALUE));
alter table split_range_part split partition p4 at(350) into (partition p4, partition p5); -- p4的part bound是350，p5的part bound是400
```

如果是list分区，则最后一个分区的part bound是被split分区part bound和其余split分区part bound的差集，例如

```
drop table if exists split_list_part;
create table split_list_part(c1 int)
partition by list(c1)
(partition p1 values (100, 150, 170),
 partition p2 values (200, 250, 280),
 partition p3 values (300, 400),
 partition p4 values (default));
alter table split_list_part split partition p2 values(250) into (partition p5, partition p6); -- p5的part bound是250，p6的part bound是(200, 280)
```

### 5.3 判断能否重用split分区

1. 固定判断split后的最后一个分区能否重用被split分区
1. 如果一级分区的tablespace、pctfree等存储属性相同且各个子分区的tablespace也相同，则能够重用，否则不能，例如


```
create tablespace split_part_test datafile 'split_part_test1' size 64M;
drop table if exists split_list_part;
create table split_list_part(c1 int)
partition by list(c1)
(partition p1 values (100, 150, 170),
 partition p2 values (200, 250, 280),
 partition p3 values (300, 400),
 partition p4 values (default));
insert into split_list_part values(100),(150),(170),(200),(250),(280),(300),(400),(350),(380),(390),(410);
alter table split_list_part split partition p4 values(350) into (partition p4, partition p5 tablespace split_part_test); -- p5没法重用p4，因为p5和p4的表空间不一样

-- valid local index
drop table if exists split_range_part;
create table split_range_part(c1 int)
partition by range(c1)
(partition p1 values less than(100),
 partition p2 values less than(200),
 partition p3 values less than(300),
 partition p4 values less than(MAXVALUE));
create index split_range_idx on split_range_part(c1) local (partition p1, partition p2, partition p3, partition p4);
-- all rows in p5
insert into split_range_part values(449),(451);
alter table split_range_part split partition p4 into (partition p4 values less than(400), partition p5);
select index_name, status from dba_ind_partitions where index_name=upper('split_range_idx');
```

### 5.4 partId修改策略

1. 如果是list分区，partId从最大的partId往后分配，例如最大的partId是10，分裂成2份，则变成10 11 12
1. 如果是range分区
    1. 如果要split的分区isInterval，split前的分区转化成range分区，partId从transition part的partId往后分配，例如transition part的partId是20，分裂成2份，则变成20 30 40
    1. 否则，如果是split最后一个分区，partId从最大的partId+1往后分配，例如20 30，分裂30成2份，则变成20 31 41
    1. 否则，如果前一个分区的partid和被split分区的partId间隔存放得下split分区数-1，则挨个放下否则重新生成后续partid，例如19 21，分裂21成2份，则21前面变成19 20，如果分裂成3份，则变成19 29 39 49
    1. 如果被split分区的partId与下一个分区的partId有间隔，则最后一个分区的partId为partId+1，否则重用partId，例如19 21 23，分裂21成2分，则变成19 20 22 23，例如19 21 22，分裂21成2份，则变成19 20 21 22


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|分区类型|测试场景|用例|说明|
|---|---|---|---|
|list|一分为二|drop table if exists split_list_part;    
  create table split_list_part(c1 int)    
  partition by list(c1)    
  (partition p1 values (100, 150, 170),    
  partition p2 values (200, 250, 280),    
  partition p3 values (300, 400),    
  partition p4 values (default));    
  insert into split_list_part values(100),(150),(170),(200),(250),(280),(300),(400),(350);    
  alter table split_list_part split partition p4 values(350) into (partition p4, partition p5);    
  select table_name, partition_name, high_value from dba_tab_partitions where table_name=upper('split_list_part') order by partition_name;|p4 part bound为350，p5为default|
||一分为多|drop table if exists split_list_part;    
  create table split_list_part(c1 int)    
  partition by list(c1)    
  (partition p1 values (100, 150, 170),    
  partition p2 values (200, 250, 280),    
  partition p3 values (300, 400),    
  partition p4 values (default));    
  insert into split_list_part values(100),(150),(170),(200),(250),(280),(300),(400),(350),(380),(390),(410);    
  alter table split_list_part split partition p4 into (partition p4 values (350), partition p5 values (380), partition p6);    
  select table_name, partition_name, high_value from dba_tab_partitions where table_name=upper('split_list_part') order by partition_name;|p4 part bound为350,p5 part bound为380,p6 part bound为default|
||组合分区|drop table if exists test;    
  create table test(c1 int, c2 varchar(10))    
  partition by list(c1)    
  subpartition by range(c2) (partition p1 values(100,200), partition p2 values(200,300)(subpartition p2subp1 values less than('b'), subpartition p2subp2 values less than('c')));    
  alter table test split partition p2 into (partition p2 values(200), partition p3);|p2的子分区定义复制一份到p3|
||带index|drop table if exists split_list_part;    
  create table split_list_part(c1 int, c2 int)    
  partition by list(c1)    
  (partition p1 values (100, 150, 170),    
  partition p2 values (200, 250, 280),    
  partition p3 values (300, 400),    
  partition p4 values (default));    
  create index split_list_idx on split_list_part(c1) local (partition p1, partition p2, partition p3, partition p4);    
  create index split_list_global_idx on split_list_part(c2);    
  insert into split_list_part values(500, 100);    
  insert into split_list_part values(600, 100);    
  alter table split_list_part split partition p4 into (partition p4 values(500), partition p5) update indexes;    
  select index_name, status from dba_ind_partitions where index_name=upper('split_list_idx');    
  select index_name, index_type, status from dba_indexes where index_name=upper('split_list_global_idx');|local和global index都是usable|
||带嵌套表|create or replace type split_udt_type as table of int;    
  /    
  drop table if exists split_list_part;    
  create table split_list_part(c1 int, c2 split_udt_type)    
  nested table c2 local store as split_udt_tab    
  partition by list(c1)    
  (partition p1 values (100, 150, 170),    
  partition p2 values (200, 250, 280),    
  partition p3 values (300, 400),    
  partition p4 values (default));    
  insert into split_list_part values(500, split_udt_type(1, 2, 3));    
  insert into split_list_part values(600, split_udt_type(4, 5, 6, 7));    
  alter table split_list_part split partition p4 values(500) into(partition p4, partition p5);    
  select c1, v.* from split_list_part partition(p4) t, table(t.c2) v;    
  select c1, v.* from split_list_part partition(p5) t, table(t.c2) v;|  
|
||带lob类型|  
|  
|
|range|一分为二|drop table if exists split_range_part;    
  create table split_range_part(c1 int)    
  partition by range(c1)    
  (partition p1 values less than(100),    
  partition p2 values less than(200),    
  partition p3 values less than(300),    
  partition p4 values less than(MAXVALUE));    
  insert into split_range_part values(49),(51),(149),(151),(200),(201),(300),(301),(400),(401);    
  alter table split_range_part split partition p1 at(50) into (partition p1, partition p5);    
  select table_name, partition_name, high_value from dba_tab_partitions where table_name=upper('split_range_part') order by partition_name;|  
|
||一分为多|drop table if exists split_range_part;    
  create table split_range_part(c1 int)    
  partition by range(c1)    
  (partition p1 values less than(100),    
  partition p2 values less than(200),    
  partition p3 values less than(300),    
  partition p4 values less than(MAXVALUE));    
  insert into split_range_part values(49),(51),(149),(151),(200),(201),(300),(301),(400),(401);    
  alter table split_range_part split partition p1 into (partition p1 values less than(-50), partition p5 values less than(50), partition p6);    
  select table_name, partition_name, high_value from dba_tab_partitions where table_name=upper('split_range_part') order by partition_name;|  
|
||组合分区|drop table if exists test;    
  create table test(c1 int, c2 varchar(10))    
  partition by range(c1)    
  subpartition by range(c2) (partition p1 values less than(100), partition p2 values less than(200)(subpartition p2subp1 values less than('b'), subpartition p2subp2 values less than('c')));    
  alter table test split partition p2 into (partition p2 values less than(150), partition p3);|  
|
||带index|drop table if exists split_range_part;    
  create table split_range_part(c1 int, c2 int)    
  partition by range(c1)    
  (partition p1 values less than(100),    
  partition p2 values less than(200),    
  partition p3 values less than(300),    
  partition p4 values less than(MAXVALUE));    
  create index split_range_idx on split_range_part(c1) local (partition p1, partition p2, partition p3, partition p4);    
  create index split_range_global_idx on split_range_part(c2);    
  insert into split_range_part values(349, 100),(451, 100);    
  alter table split_range_part split partition p4 into (partition p4 values less than(400), partition p5) update indexes;    
  select index_name, status from dba_ind_partitions where index_name=upper('split_range_idx');    
  select index_name, index_type, status from dba_indexes where index_name=upper('split_range_global_idx');|  
|
||带嵌套表|create or replace type split_udt_type as table of int;    
  /    
  drop table if exists split_range_part;    
  create table split_range_part(c1 int, c2 split_udt_type)    
  nested table c2 local store as split_udt_tab    
  partition by range(c1)    
  (partition p1 values less than(100),    
  partition p2 values less than(200),    
  partition p3 values less than(300),    
  partition p4 values less than(MAXVALUE));    
  insert into split_range_part values(300, split_udt_type(1, 2, 3));    
  insert into split_range_part values(400, split_udt_type(4, 5, 6, 7));    
  alter table split_range_part split partition p4 at(400) into(partition p4, partition p5);    
  select count(*) from dba_tab_partitions where table_name=upper('split_udt_tab');|  
|
|interval|一分为二|drop table if exists split_range_part;    
  create table split_range_part (a int)     
  partition by range(a)    
  interval(5)    
  (    
  partition p1 values less than(5),    
  partition p2 values less than(10)    
  );    
  insert into split_range_part values(500);    
  insert into split_range_part values(1000);    
  insert into split_range_part values(2000);    
  insert into split_range_part values(6),(8);    
  alter table split_range_part split partition p2 at(8) into (partition p3, partition p4);    
  select * from split_range_part partition(p3);    
  select * from split_range_part partition(p4);|  
|
||一分为多|drop table if exists split_range_part;    
  create table split_range_part (a int)     
  partition by range(a)    
  interval(5)    
  (    
  partition p1 values less than(5),    
  partition p2 values less than(10)    
  );    
  insert into split_range_part values(500);    
  insert into split_range_part values(1000);    
  insert into split_range_part values(1001),(1002);    
  insert into split_range_part values(2000);    
  declare    
  name varchar(128);    
  col_sql varchar(32000);    
  begin    
  select partition_name into name from dba_tab_partitions where table_name=upper('split_range_part') and HIGH_VALUE='1005';    
  col_sql:='alter table split_range_part split partition '|| name || ' at(1002) into (partition p3, partition p4)';    
  execute immediate col_sql;    
  end;    
  /|  
|
||带index|drop table if exists split_range_part;    
  create table split_range_part(c1 int, c2 int)    
  partition by range(c1)    
  (partition p1 values less than(100),    
  partition p2 values less than(200),    
  partition p3 values less than(300),    
  partition p4 values less than(MAXVALUE));    
  create index split_range_idx on split_range_part(c1) local (partition p1, partition p2, partition p3, partition p4);    
  create index split_range_global_idx on split_range_part(c2);    
  insert into split_range_part values(349, 100),(451, 100);    
  alter table split_range_part split partition p4 into (partition p4 values less than(400), partition p5) update indexes;    
  select index_name, status from dba_ind_partitions where index_name=upper('split_range_idx');    
  select index_name, index_type, status from dba_indexes where index_name=upper('split_range_global_idx');|  
|
||带嵌套表|create or replace type split_udt_type as table of int;    
  /    
  drop table if exists split_range_part;    
  create table split_range_part(c1 int, c2 split_udt_type)    
  nested table c2 local store as split_udt_tab    
  partition by range(c1) interval(5),(partition p1 values less than(100),    
  partition p2 values less than (200),    
  partition p3 values less than (300))  ;    
  insert into split_range_part values(501, split_udt_type(1, 2, 3));    
  insert into split_range_part values(502, split_udt_type(4, 5, 6, 7));,declare    
  name varchar(128);    
  col_sql varchar(32000);    
  begin    
  select partition_name into name from dba_tab_partitions where table_name=upper('split_range_part') and HIGH_VALUE='505';    
  col_sql:='alter table split_range_part split partition '|| name || ' at(502) into (partition p4, partition p5)';    
  execute immediate col_sql;    
  end;    
  /    
  select c1, v.* from split_list_part partition(p4) t, table(t.c2) v;    
  select c1, v.* from split_list_part partition(p5) t, table(t.c2) v;|  
|


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#7-document%E8%B5%84%E6%96%99)  

1. split partiton语法：    [ALTER TABLE (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ALTER-TABLE.html#GUID-552E7373-BF93-477D-9DA3-B2C9386F2877)  
1. split subpartition语法：    [ALTER TABLE (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ALTER-TABLE.html#GUID-552E7373-BF93-477D-9DA3-B2C9386F2877)  
1. Oracle的split文档：    [Maintenance Operations for Partitioned Tables and Indexes (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/vldbg/maintenance-partition-tables-indexes.html#GUID-6BB84952-7021-4CBA-91ED-180E0656E02B)  


##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

1人/月

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=11698367#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1. 分布式、列存LSC暂不支持


## Attachments:

[split_table_subpartiton.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDZhMWFkOWEzMzExZGM3YmVhIiwicmVmX2lkIjoiNjczOTZhNDY3MjgyMDZlZmI5MmVmYzk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNDA3LCJleHAiOjE3ODIyOTg4MDd9.iOFBvIsoHZeIogB307ZUalSMnuiADUG4G3TADXSuE8s)

 (image/gif)    


[split_table_subpartiton.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDY4OTcwYzJhZjRmNTFmZDc0IiwicmVmX2lkIjoiNjczOTZhNDY3MjgyMDZlZmI5MmVmYzk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyNDA3LCJleHAiOjE3ODIyOTg4MDd9.C_B46aaXGgmSX9cLCc2xBA6V1njULzuHoqFVb4aWJ6A)

 (image/gif)    


## Comments:

|  [](null)  ,二级分区嵌套表,Posted by zengzhaohan at 七月 06, 2023 15:17|
|---|
