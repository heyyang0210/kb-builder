Created by 郭藏龙, last modified on 十二月 03, 2022

#   [TRUNCATE PARTITION](#truncate-partition)  

###   [语法](#语法)  

```
ALTER TABLE table_name TRUNCATE PARTITION [part_name, ...] 
ALTER TABLE table_name TRUNCATE SUBPARTITION [subpart_name, ...]

```

###   [用例](#用例)  

```
create table rl_composite(a int, b int)
partition by range(a)
subpartition by list(b) 
(
	partition p1 values less than(10)
	(
		subpartition sp1 values(10),
		subpartition sp2 values(20),
        subpartition sp3 values(default)
	),
	partition p2 values less than(20)
	(
		subpartition sp4 values (10),
		subpartition sp5 values (20)
	)
);

-- truncate parition
insert into rl_composite values(1,2);
insert into rl_composite values(2,3);
insert into rl_composite values(15,20);
alter table rl_composite truncate partition p1;
select * from rl_composite;
alter table rl_composite truncate subpartition sp5;
select * from rl_composite;
alter table rl_composite truncate subpartition sp1, sp5;

```

#   [DROP PARTITION](#drop-partition)  

###   [语法](#语法-1)  

```
ALTER TABLE table_name DROP PARTITION part_name, ...
ALTER TABLE table_name DROP SUBPARTITION subpart_name, ...

```

###   [约束](#约束)  

- 指定的所有二级分区必须属于相同的一级分区
- hash分区不能drop partition/subpartition


###   [用例](#用例-1)  

```
create table rl_composite(a int, b int)
partition by range(a)
subpartition by list(b) 
(
	partition p1 values less than(10)
	(
		subpartition sp1 values(10),
		subpartition sp2 values(20),
        subpartition sp3 values(default)
	),
	partition p2 values less than(20)
	(
		subpartition sp4 values (10),
		subpartition sp5 values (20)
	),
	partition p3 values less than(40)
	(
		subpartition sp6 values (10),
		subpartition sp7 values (20)
	)
);

select PARTITION_NAME,SUBPARTITION_NAME,HIGH_VALUE from dba_tab_subpartitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;
select PARTITION_NAME,HIGH_VALUE from dba_tab_partitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;

alter table rl_composite drop partition sp1;         -- specify subparition name
alter table rl_composite drop subpartition p1;       -- speficy partition name 
alter table rl_composite drop subpartition sp1,sp4;  -- subparition across partition
alter table rl_composite drop subpartition sp4,sp5;	 -- drop all subpartition of a partiion 

alter table rl_composite drop partition p1;
select PARTITION_NAME,SUBPARTITION_NAME,HIGH_VALUE from dba_tab_subpartitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;
select PARTITION_NAME,HIGH_VALUE from dba_tab_partitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;

alter table rl_composite drop subpartition sp6;
select PARTITION_NAME,SUBPARTITION_NAME,HIGH_VALUE from dba_tab_subpartitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;


```

#   [ADD PARTITION](#add-partition)  

###   [语法](#语法-2)  

```
ALTER TABLE table_name ADD PARTITION part_name [partion_bound_clause]

```

###   [用例](#用例-2)  

```
create table rl_composite(a int, b int)
partition by range(a)
subpartition by list(b) 
(
	partition p1 values less than(10)
	(
		subpartition sp1 values(10),
		subpartition sp2 values(20),
        subpartition sp3 values(default)
	),
	partition p2 values less than(20)
	(
		subpartition sp4 values (10),
		subpartition sp5 values (20)
	)
);

alter table rl_composite add partition p3;
alter table rl_composite add partition p3 values less than (30);
alter table test add partition p4 values less than (30)
(
    subpartition sp6 values(10),
    subpartition sp7 values(20)
);
drop table rl_composite;
select PARTITION_NAME,SUBPARTITION_NAME,HIGH_VALUE from dba_tab_subpartitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;
select PARTITION_NAME,HIGH_VALUE from dba_tab_partitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;

create table rl_composite(a int, b int)
partition by range(a)
subpartition by list(b) 
SUBPARTITION TEMPLATE
(
	subpartition sp1 values(10),
	subpartition sp2 values(20)
)
(
	partition p1 values less than(10)
	(
		subpartition sp1 values(10),
		subpartition sp2 values(20),
        subpartition sp3 values(default)
	)
);
alter table rl_composite add partition p3 values less than (30);  --- use tempplate
select PARTITION_NAME,SUBPARTITION_NAME,HIGH_VALUE from dba_tab_subpartitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;
select PARTITION_NAME,HIGH_VALUE from dba_tab_partitions where table_name = 'RL_COMPOSITE' order by PARTITION_NAME;


```

#   [遗留问题](#遗留问题)  

- table modification适配二级分区
