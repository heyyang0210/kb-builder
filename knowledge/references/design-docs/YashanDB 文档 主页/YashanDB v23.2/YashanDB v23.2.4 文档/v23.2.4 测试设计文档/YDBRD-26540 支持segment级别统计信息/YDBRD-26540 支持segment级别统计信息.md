Created by 李浩勇, last modified on 七月 22, 2024

# **1. 概述**

本文描述数据库支持segment级别的统计信息。

SR链接：    [YDBRD-26540 支持segment级别统计信息](https://pingcode.yasdb.com/pjm/items/6625bf44fd997db58ade3b92)  

# **2. 需求分析**

## 2.1 功能点分析

SR链接：    [YDBRD-26540 支持segment级别统计信息](https://pingcode.yasdb.com/pjm/items/6625bf44fd997db58ade3b92)  

视图字段：

- OWNER  ：对象所有者，即拥有该对象的数据库用户或模式名  。                   VARCHAR2(64)
- OBJECT_NAME  ：对象的名称，如表名或索引名  。                                         VARCHAR2(64) 
- SUBOBJECT_NAME  ：子对象的名称（如果有的话）  。                                  VARCHAR2(64)
- TABLESPACE_NAME  ：对象所在的表空间名称  。                                            VARCHAR2(64)
- **TS#**：表空间标识，是表空间在数据字典中的内部编号  。                       SMALLINT
- **OBJ#**：字典对象标识，是对象在数据字典中的内部编号  。                     BIGINT
- **DATAOBJ#**：数据对象标识，与OBJ#类似，但可能用于区分不同类型的对象  。  BIGINT
- OBJECT_TYPE  ：对象的类型，如表、索引等  。                                              VARCHAR2(18) 
- STATISTIC_NAME  ：统计项的名称，如“space used”（空间使用）、“physical reads”（物理读取）等  。  VARCHAR2(64) 
- **STATISTIC#**：统计项的标识，是统计项在数据字典中的内部编号  。        TINYINT
- VALUE  ：统计项的值，即该统计项自数据库实例启动以来的累计值  。           BIGINT


STATISTIC_NAME：

0 logical reads 逻辑读块次数，从buffer读取一个块的次数，单位为块数 全量    
  1 physical reads 物理读块次数，调用操作系统接口read一个块的次数，单位为块数 全量    
  2 physical read requests 物理读请求次数，单位为次数 全量    
  3 consistent changes 相当于db block changes。构建cr过程中回滚的事务数，单位为次数 全量    
  4 buffer busy waits 等待buffer的次数，包括等pin、buffer bucket latch，单位为次数 全量    
  5 xslot waits 相当于ITL waits。数据块xslot不足造成的等待次数，单位为次数 全5    
  6 row lock waits 行被其他事务锁住造成的等待次数，单位为次数 全量    
  7 gc cr blocks received 集群下cr blocks接收块数，单位为块数 全量    
  8 gc current blocks received 集群下current blocks接收块数，单位为块数 全量    
  9 gc remote grants 集群下remote blocks接收块数，单位为块数 全量    
  10 gc buffer busy 集群下buffer busy wait的次数，单位为次数 全量

11 segment scans segment扫描的次数，单位为次数 全量

12 space allocated  segment的大小，单位为bytes  全量

  


OBJECT_TYPE:

  
  TABLE    
  TABLE PARTITION    
  TABLE SUBPARTITION    
  INDEX    
  INDEX PARTITION    
  INDEX SUBPARTITION    
  LOB    
  LOB PARTITION    
  LOB SUBPARTITION

## 2.2 规格约束

支持单机、集群、分布式，heap表

# 3.   **详细测试设计**   

**功能用例**

|验证项|子项|备注|  
|
|---|---|---|---|
|视图除 STATISTIC_NAME 以外的属性验证|普通表,分区表,二级分区表,包含range，list，hash，interval四类分区表,临时表,  
,索引：,普通索引,唯一索引,列式索引,反向索引,rtree索引,单索引、复合索引,分区索引,  
,覆盖 9  种OBJECT_TYPE:,TABLE    
  TABLE PARTITION    
  TABLE SUBPARTITION    
  INDEX    
  INDEX PARTITION    
  INDEX SUBPARTITION,LOB    
  LOB PARTITION    
  LOB SUBPARTITION|验证各项属性是否正确,- OWNER  ：对象所有者，即拥有该对象的数据库用户或模式名  。
- OBJECT_NAME  ：对象的名称，如表名或索引名  。
- SUBOBJECT_NAME  ：子对象的名称（如果有的话）  。
- TABLESPACE_NAME  ：对象所在的表空间名称  。
- OBJECT_TYPE  ：对象的名称
|  
|
|视图除 STATISTIC_NAME 以外的属性修改验证|rename table,alter tablespace,drop table,drop partition,add partition,修改分区表表空间,split partition,alter index     `UNUSABLE/`      `INVISIBLE（注意现象）`  ,drop index,*rename index*,  
|验证各项属性是否跟随正确修改,- OWNER  ：对象所有者，即拥有该对象的数据库用户或模式名  。
- OBJECT_NAME  ：对象的名称，如表名或索引名  。
- SUBOBJECT_NAME  ：子对象的名称（如果有的话）  。
- TABLESPACE_NAME  ：对象所在的表空间名称  。
- OBJECT_TYPE  ：对象的名称
,  
,*删除后立即生效*|  
|
|服务重启后，视图内容的失效与重载|  
|  
|  
|
|视图 STATISTIC_NAME 属性验证,table类型验证，包括TABLE/TABLE PARTITION/TABLE SUBPARTITION|0 logical reads 逻辑读块次数，从buffer读取一个块的次数，单位为块数 全量|验证方法insert、update、delete、select ,重启实例再次查询场景,table index lob|  
|
|  
|1 physical reads 物理读块次数，调用操作系统接口read一个块的次数，单位为块数 全量|重启实例再次查询场景,table index lob,LOB：大更新,*清空buffer后update、delete、select*|  
|
|  
|2 physical read requests 物理读请求次数，单位为次数 全量|重启实例再次查询场景,table index lob,LOB：大更新,*清空buffer后update、delete、select*|  
|
|  
|3 consistent changes 相当于db block changes。构建cr过程中回滚的事务数，单位为次数|验证方法insert、update、delete、select ,table index lob,并发处理|  
|
|  
|4 buffer busy waits 等待buffer的次数，包括等pin、buffer bucket latch，单位为次数 全量|session1:,update tb_lhy_0710_01 set c1 = 100 where c1 = 100;,再执行,并发100：update tb_lhy_0710_01 set c1 = 100 where c1 = 100; commit;,session1:,commit;,table index|  
|
|  
|5 xslot waits 相当于ITL waits。数据块xslot不足造成的等待次数，单位为次数 全量|  
|  
|
|  
|6 row lock waits 行被其他事务锁住造成的等待次数，单位为次数 全量|构造行锁场景,session1:,delete from tb_lhy_0710_01 where c1 = 1;,session2:：,update tb_lhy_0710_01 set c2 = 'testt' where c1 = 1;,待查询后 session1: commit;,table|  
|
|  
|7 gc cr blocks received 集群下cr blocks接收块数，单位为块数 全量|  
|  
|
|  
|8 gc current blocks received 集群下current blocks接收块数，单位为块数 全量|  
|  
|
|  
|9 gc remote grants 集群下remote blocks接收块数，单位为块数 全量|  
|  
|
|  
|10 gc buffer busy 集群下buffer busy wait的次数，单位为次数 全量|  
|  
|
|  
|11 segment scans segment扫描的次数，单位为次数 全量|*统计的全表扫描次数*,全表扫描，索引的fast full scan或者表的full scan|  
|
|  
|12 space allocated  segment的大小，单位为bytes  全量|验证方法：空表insert ，  *引起segment扩展*,table index lob|  
|
|OBJ# 和 DATAOBJ# 验证|select obj#, dataobj# from sys.obj$;|  
|  
|
|TS# 验证|select ts# from sys.seg$;|  
|  
|
|视图写操作拦截测试|drop ,alter,delete,update，create index|  
|  
|
|视图权限验证|有select_catalog_role权限可查询,无select_catalog_role权限不可查询|  
|  
|
|*DC失效验证*|*DDL操作后再查统计信息*|*1、DC淘汰后出现在临时表上*,*2、对象新统计信息直接在DC上*,*3、DC失效后，继续做DML，临时和DC上均有*,*视图：*  ***V$TABLE_DICTIONARY***|  
|
|*DC淘汰*|*打开DC太多出现淘汰*||  
|
|*statistics_level*|  
||  
|
|集群gv$segment_statistics视图验证|同上|  
|  
|
|v$segstat_name视图查询验证|视图内容验证|  
|  
|


  


  


```
xslot 死锁：

--session1:
drop table testa;
create table testa(a int,b varchar(100));
begin
for i in 1 .. 400 loop
insert into testa values(i,i);
commit;
end loop;
end;
/

update testa set b='bbbbbbbbb';
commit;

--session2:

drop table testb;
create table testb(a int,b varchar(100));
begin
for i in 1 .. 400 loop
insert into testb values(i,i);
commit;
end loop;
end;
/

update testb set b='bbbbbbbbb';
commit;



--session3:

drop table testc;
create table testc(a int,b varchar(100));
begin
for i in 1 .. 400 loop
insert into testc values(i,i);
commit;
end loop;
end;
/

update testc set b='bbbbbbbbb';
commit;



--session1:
update testa set a=a+1 where a=1;
--session2：
update testb set a=a+1 where a=1;
--session3：
update testc set a=a+1 where a=1;



--session1:
update testb set a=a+1 where a=2;
--session2：
update testc set a=a+1 where a=2;
--session3：
update testa set a=a+1 where a=2;




--session1:
update testc set a=a+1 where a=3;
--session2：
update testa set a=a+1 where a=3;
--session3：
update testb set a=a+1 where a=3;
```

  


  


  


--无索引表

--查询初始环境    
  select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

--为空

--建表

CREATE TABLE tb_lhy_0710_01(c1 int, c2 varchar(10));

--再次查询

select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

--为空

--导入

INSERT INTO tb_lhy_0710_01 values(1, 'test1');

--再次查询

select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

![](https://pingcode.yasdb.com/atlas/files/public/67396da9a1ad9a3311dc92e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

--导入

INSERT INTO tb_lhy_0710_01 values(2, 'test2');

--再次查询

select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

![](https://pingcode.yasdb.com/atlas/files/public/67396da9a1ad9a3311dc92e9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--导入

BEGIN    
  FOR i IN 1 .. 1000 LOOP    
  INSERT INTO tb_lhy_0710_01 values(i, 'test'||i);    
  end LOOP;    
  commit;    
  END;    
  /

--再次查询

select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

--查询表

select count(*) from (select c1, count(*) from tb_lhy_0710_01 group by c1);

--再次查询

select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

![](https://pingcode.yasdb.com/atlas/files/public/67396daa8970c2af4f521477/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

--查询表

select count(*) from tb_lhy_0710_01 where c1 <= 500 ;

--再次查询

select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92eb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--update

update tb_lhy_0710_01 set c2 = 'test' where c1 >= 500;

--再次查询

select * from v$segment_statistics     
  where OBJECT_NAME = upper('tb_lhy_0710_01')    
  AND owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

![](https://pingcode.yasdb.com/atlas/files/public/67396daa8970c2af4f521478/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


session1:

delete from tb_lhy_0710_01 where c1 = 1;

session2:：

update tb_lhy_0710_01 set c2 = 'testt' where c1 = 1;

待查询后 session1: commit;

  


--再次查询

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92ec/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--重复操作

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92ee/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--rename  --预期变化 只有objec_name 发生变化

--重启数据库服务

select count(*) from (select c1, count(*) from tb_lhy_0710_01 group by c1);

--再次查询

![](https://pingcode.yasdb.com/atlas/files/public/67396daa8970c2af4f52147c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--

session1:

update tb_lhy_0710_01 set c1 = 100 where c1 = 100;

session2:：

并发100：update tb_lhy_0710_01 set c1 = 100 where c1 = 100; commit;

session1:

commit;

--再次查询

![](https://pingcode.yasdb.com/atlas/files/public/67396daa8970c2af4f52147d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--索引表

--建表

CREATE TABLE tb_lhy_0710_01(c1 int, c2 varchar(10));   -无信息

CREATE INDEX idx_0711 ON tb_lhy_0711_index(c1); --无信息

INSERT INTO tb_lhy_0711_index values(1, 'test1'); 

  


select * from v$segment_statistics     
  where     
  (OBJECT_NAME = upper('tb_lhy_0711_index') OR OBJECT_NAME = upper('idx_0711'))AND     
  owner = 'LHY' AND STATISTIC_NAME IN ('logical reads', 'physical reads', 'db block changes', 'buffer busy waits', 'ITL waits', 'row lock waits', 'gc cr blocks received', 'gc current blocks received', 'gc remote grants') ORDER BY OBJECT_NAME;

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92ef/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

BEGIN    
  FOR i IN 1 .. 1000 LOOP    
  INSERT INTO tb_lhy_0711_index values(i, 'test'||i);    
  end LOOP;    
  commit;    
  END;    
  /

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92f0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


UPDATE tb_lhy_0711_index SET c2 = 'test' WHERE c1 >= 500;

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92f1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


session1:

delete from tb_lhy_0711_index where c1 = 1;

session2:：

update tb_lhy_0711_index set c2 = 'testt' where c1 = 1;

待查询后 session1: commit;

![](https://pingcode.yasdb.com/atlas/files/public/67396daa8970c2af4f52147e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

select count(*) from (select c1, count(*) from tb_lhy_0711_index group by c1);

![](https://pingcode.yasdb.com/atlas/files/public/67396daaa1ad9a3311dc92f2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--重启数据库服务 --为空

select count(*) from (select c1, count(*) from tb_lhy_0711_index group by c1);

![](https://pingcode.yasdb.com/atlas/files/public/67396daa8970c2af4f52147f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


--

session1:

update tb_lhy_0711_index set c1 = 100 where c1 = 100;

session2:：

并发100：update tb_lhy_0711_index set c1 = 100 where c1 = 100; commit;

session1:

commit;

![](https://pingcode.yasdb.com/atlas/files/public/67396daa8970c2af4f521480/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FFQUFBQUxBQUFCRUNBQUFBQUFBZ0FBQUFBQ0FFQUFnQUFBQUFBRUFvb0NBQUFDQkFBU21CQUFBQVJBQUFJQUFBQWlBRUFCQUFFQUFBQUFRQ0FBUUVBQUFBQUFCSUFJQUVVQUlBQklrQ0FBQ0lBQUFsQUFBZ0FRb0FFQ0FBQUFBQUJBQUVBQUFnQUFBRUFBQklBQUFBQUlRQ0FDQUFCRkFCUUFBQWdDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA0MjMsImV4cCI6MTc4MjMyMTIyM30.kfYiC9gl2epztacAs58VivU_fOxQyYHm5Mk-NnTXaBU)

  


  


  


  


  


  


  


  


## Attachments:

[image2024-7-10_16-50-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTlhMWFkOWEzMzExZGM5MmUxIiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMWExIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDIzLCJleHAiOjE3ODIzOTY4MjN9.e8Gvli-fMH794ZAlcREVnUbRa7zs9PkPzvknScY1p7s)

 (image/png)    


[image2024-7-11_10-34-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTlhMWFkOWEzMzExZGM5MmU0IiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMWExIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDIzLCJleHAiOjE3ODIzOTY4MjN9.2n_Q6AehmUTEjtCRo19T1MYY2NK2srxiO17BTksiWy0)

 (image/png)    


[image2024-7-11_10-37-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTlhMWFkOWEzMzExZGM5MmU1IiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMWExIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDIzLCJleHAiOjE3ODIzOTY4MjN9.kEQyLctqkho9ivLOGKaTJeEHTuW79sxXCuyOfSMU_Jg)

 (image/png)    
