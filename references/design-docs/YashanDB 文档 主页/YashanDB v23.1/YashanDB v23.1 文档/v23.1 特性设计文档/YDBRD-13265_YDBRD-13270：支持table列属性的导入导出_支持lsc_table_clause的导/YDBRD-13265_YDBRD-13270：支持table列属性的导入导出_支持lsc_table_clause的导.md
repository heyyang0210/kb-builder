Created by 史鑫, last modified on 十月 18, 2024

## SR:

##   [[YDBRD-14306] 【imp/exp】支持table列属性的导入导出 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-14306)  

  [[YDBRD-14307] 【imp/exp】支持lsc_table_clause的导入导出 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-14307)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#1-overview%E6%A6%82%E8%BF%B0)  

支持表的列属性（压缩，编码）；lsc表的属性（sort/mcol_ttl）的导入导出。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

列属性：  compression_clause/  encoding_clause，其中compression_clause针对tac/lsc，encoding_clause针对lsc

lsc表属性：table_sort_clause/mcol_ttl_clause

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#51-architecture%E6%9E%B6%E6%9E%84)  

####   [5.1.1 文件格式](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#511-%E6%96%87%E4%BB%B6%E6%A0%BC%E5%BC%8F)  

#### 具体格式

|格式|语法|  
|
|---|---|---|
|表|排序|ORDER BY "("column_name{"," column_name}")" [NULLS (FIRST|LAST)] [ASC|DESC]|
|  
|ttl|MCOL TTL|
|  
|压缩|COMPRESSION compression_type [HIGH|MEDIUM|LOW]|
|列|压缩|COMPRESSION compression_type [HIGH|MEDIUM|LOW] .|
|  
|编码|ENCODING (PLAIN|RLE|DICTIONARY'('(RLE|(PLAIN ["," CARDINALITY]))')'|'BYTE-PACKED').|


#### 细节：

（1）表的comrepssion，compression_level，只有在comrepssion不为null时，统一导出。

（2）  mcol_ttl_clause，以us存储，将其转换成s， codDSInterval2Text后，统一导出为：‘codDSInterval2Text’ day to second

（3）表/列的comrepssion == UNCOMPRESSED不导出压缩属性

####   [5.1.2 查询方式](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#512-%E6%9F%A5%E8%AF%A2%E6%96%B9%E5%BC%8F)  

|信息|视图|完整语句|所需信息|关注点|
|:---|:---|:---|:---|:---|
|表--压缩/ttl|dba_tables|  
|SQL> desc dba_tables    
  NAME NULL? DATATYPE    
  ---------------------------------------------------------------- --------- ---------------------------------    
  OWNER NOT NULL VARCHAR(64)    
  TABLE_NAME NOT NULL VARCHAR(64)    
  TABLE_TYPE VARCHAR(4)    
  TABLESPACE_NAME VARCHAR(64)    
  STATUS CHAR(5)    
  PCT_FREE NOT NULL INTEGER    
  INI_TRANS NOT NULL INTEGER    
  MAX_TRANS NOT NULL INTEGER    
  LOGGING VARCHAR(1)    
  CORRUPTED CHAR(1)    
  NUM_ROWS BIGINT    
  BLOCKS BIGINT    
  EMPTY_BLOCKS BIGINT    
  SAMPLE_SIZE BIGINT    
  LAST_ANALYZED DATE    
  COMPRESSION VARCHAR(12)    
  COMPRESSION_LEVEL VARCHAR(6)    
  MCOL_TTL BIGINT    
  PARTITIONED VARCHAR(1)    
  TEMPORARY VARCHAR(1)    
  ROW_MOVEMENT VARCHAR(7)    
  ENABLE_XFMR VARCHAR(7)    
  DATABASE_MAINTAINED VARCHAR(1)    
  DURATION VARCHAR(15)    
  NESTED VARCHAR(1)    
  SHARDED VARCHAR(1)|  
|
|表--排序|dba_sort_tables+dba_sort_key_columns|  
|dba_sort_tables--[NULLS (FIRST|LAST)] [ASC|DESC],dba_sort_key_columns--ORDER BY "("column_name{"," column_name}")"|  
|
|列|压缩|  
|dba_tab_cols|  
|
||编码||||


  


  


####   [5.1.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#513-%E6%A8%A1%E5%BC%8F)    新增视图

DBA_SORT_TABLES：获取表的排序信息

DBA_SORT_KEY_COLUMNS：表的排序键信息

```
--DBA_SORT_TABLE
CREATE OR REPLACE VIEW DBA_SORT_TABLE(OWNER, TABLE_NAME, SORT_METHOD, NULLS_FIRST, SORT_TYPE) AS
    SELECT U.NAME, O.NAME,  DECODE(S.SORTMETHOD#, 0, 'DESC', 1, 'ASC'), DECODE(S.NULLSFIRST#, 0, 'N', 1, 'Y'),  DECODE(S.SORTTYPE#, 0, 'SORT_NORMAL', 1, 'SORT_ZSORT', 2, 'SORT_HSORT', '')
    FROM SYS.OBJ$ O, SYS.USER$ U, SYS.TABSORT$ S 
    WHERE S.BO# = O.OBJ# AND O.OWNER# = U.USER#
/
CREATE OR REPLACE PUBLIC SYNONYM DBA_SORT_TABLE FOR SYS.DBA_SORT_TABLE
/

--USER_SORT_TABLE
CREATE OR REPLACE VIEW USER_SORT_TABLE(TABLE_NAME, SORT_METHOD, NULLS_FIRST, SORT_TYPE) AS
    SELECT O.NAME,  DECODE(S.SORTMETHOD#, 0, 'DESC', 1, 'ASC'), DECODE(S.NULLSFIRST#, 0, 'N', 1, 'Y'),  DECODE(S.SORTTYPE#, 0, 'SORT_NORMAL', 1, 'SORT_ZSORT', 2, 'SORT_HSORT', '')
    FROM SYS.OBJ$ O, SYS.TABSORT$ S 
    WHERE S.BO# = O.OBJ# AND O.OWNER#= userenv('SCHEMAID')
/
CREATE OR REPLACE PUBLIC SYNONYM USER_SORT_TABLE FOR SYS.USER_SORT_TABLE
/
GRANT SELECT ON USER_SORT_TABLE TO PUBLIC
/

--ALL_SORT_TABLE
CREATE OR REPLACE VIEW ALL_SORT_TABLE(OWNER, TABLE_NAME, SORT_METHOD, NULLS_FIRST, SORT_TYPE) AS
    SELECT U.NAME, O.NAME,  DECODE(S.SORTMETHOD#, 0, 'DESC', 1, 'ASC'), DECODE(S.NULLSFIRST#, 0, 'N', 1, 'Y'),  DECODE(S.SORTTYPE#, 0, 'SORT_NORMAL', 1, 'SORT_ZSORT', 2, 'SORT_HSORT', '')
    FROM SYS.OBJ$ O, SYS.USER$ U, SYS.TABSORT$ S 
    WHERE S.BO# = O.OBJ# AND O.OWNER# = U.USER#
    AND (O.OWNER# = userenv('SCHEMAID')
     OR O.OBJ# IN (SELECT UOR.OBJ# FROM SYS.USER_OBJROLES$ UOR WHERE USER# = userenv('SCHEMAID'))
     OR check_sys_privilege(O.OWNER#, O.TYPE#) = 'TRUE')
/
CREATE OR REPLACE PUBLIC SYNONYM ALL_SORT_TABLE FOR SYS.ALL_SORT_TABLE
/
GRANT SELECT ON ALL_SORT_TABLE TO PUBLIC
/


--DBA_SORT_KEY_COLUMNS
CREATE OR REPLACE VIEW DBA_SORT_KEY_COLUMNS(OWNER, TABLE_NAME, COLUMN_NAME, COLUMN_POSITION) AS
    SELECT U.NAME, O.NAME,  C.NAME, SC.POS#
    FROM SYS.OBJ$ O, SYS.USER$ U,  SYS.COL$ C, SYS.SORTCOL$ SC
    WHERE SC.OBJ# = O.OBJ# AND SC.OBJ#=C.OBJ# AND C.COL#=SC.COL# AND O.OWNER# = U.USER#
/
CREATE OR REPLACE PUBLIC SYNONYM DBA_SORT_KEY_COLUMNS FOR SYS.DBA_SORT_KEY_COLUMNS
/

--USER_SORT_KEY_COLUMNS
CREATE OR REPLACE VIEW USER_SORT_KEY_COLUMNS(TABLE_NAME, COLUMN_NAME, COLUMN_POSITION) AS
    SELECT O.NAME,  C.NAME, SC.POS#
    FROM SYS.OBJ$ O,  SYS.COL$ C, SYS.SORTCOL$ SC
    WHERE SC.OBJ# = O.OBJ# AND SC.OBJ#=C.OBJ# AND C.COL#=SC.COL# AND O.OWNER# = userenv('SCHEMAID')
/
CREATE OR REPLACE PUBLIC SYNONYM USER_SORT_KEY_COLUMNS FOR SYS.USER_SORT_KEY_COLUMNS
/
GRANT SELECT ON USER_SORT_KEY_COLUMNS TO PUBLIC
/

--ALL_SORT_KEY_COLUMNS
CREATE OR REPLACE VIEW ALL_SORT_KEY_COLUMNS(OWNER, TABLE_NAME, COLUMN_NAME, COLUMN_POSITION) AS
    SELECT U.NAME, O.NAME,  C.NAME, SC.POS#
    FROM SYS.OBJ$ O, SYS.USER$ U,  SYS.COL$ C, SYS.SORTCOL$ SC
    WHERE SC.OBJ# = O.OBJ# AND SC.OBJ#=C.OBJ# AND C.COL#=SC.COL# AND O.OWNER# = U.USER#
    AND (O.OWNER# = userenv('SCHEMAID')
     OR O.OBJ# IN (SELECT UOR.OBJ# FROM SYS.USER_OBJROLES$ UOR WHERE USER# = userenv('SCHEMAID'))
     OR check_sys_privilege(O.OWNER#, O.TYPE#) = 'TRUE')
/
CREATE OR REPLACE PUBLIC SYNONYM ALL_SORT_KEY_COLUMNS FOR SYS.ALL_SORT_KEY_COLUMNS
/
GRANT SELECT ON ALL_SORT_KEY_COLUMNS TO PUBLIC
/
```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```
--表空间
create tablespace spc datafile 'file' size 32m databucket 'bucket';


drop user user1 cascade;
create user user1 identified by 1;
grant dba to user1;
conn user1/1@192.168.7.109:1688
--表
--lsc 有compression/encoding
drop table if exists t1;
create table t1(id1 int COMPRESSION lz4 HIGH,id2 int COMPRESSION lz4,id3 int COMPRESSION lz4 MEDIUM,id4 int COMPRESSION lz4 low,id5 int default 222 not null COMPRESSION lz4 low ENCODING PLAIN,id6 int COMPRESSION lz4 ENCODING rle,id7 int COMPRESSION lz4 ENCODING DICTIONARY(plain),id8 int COMPRESSION lz4 ENCODING DICTIONARY(RLE),id9 int ,id10 varchar(100) COMPRESSION lz4 ENCODING DICTIONARY(RLE) ,id11 number COMPRESSION lz4 ENCODING BYTE-PACKED) organization lsc tablespace spc;

--heap 无compression/encoding
drop table if exists t2;
create table t2(id1 int);
insert into t2 values(1);
commit;

--tac 有encoding，encoding只能是DICTIONARY，列只能是string，无compression
drop table if exists t3;
create table t3(id1 varchar(100) ENCODING DICTIONARY(plain),id2 char(100)) organization tac;
insert into t3 values('1','2');
commit;

--lsc 有compression/encoding,compression表属性/列属性均设置（仅支持lz4压缩）
drop table if exists t4;
create table t4(id1 int COMPRESSION lz4 HIGH,id2 int COMPRESSION lz4,id3 int COMPRESSION lz4 MEDIUM,id4 int COMPRESSION lz4 low,id5 int default 222 not null COMPRESSION lz4 low ENCODING PLAIN,id6 int COMPRESSION lz4 ENCODING rle,id7 int COMPRESSION lz4 ENCODING DICTIONARY(plain),id8 int COMPRESSION lz4 ENCODING DICTIONARY(RLE),id9 int ,id10 varchar(100) COMPRESSION lz4 ENCODING DICTIONARY(RLE) ,id11 number COMPRESSION lz4 ENCODING BYTE-PACKED) COMPRESSION lz4 MEDIUM INITRANS 1 organization lsc tablespace spc;


--table_sort_clause/mcol_ttl_clause YM_interval --仅针对lsc
DROP TABLE IF EXISTS t5; 
CREATE TABLE t5(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1' MONTH ORDER BY (year,month,branch) nulls first asc
organization lsc tablespace spc;

--table_sort_clause:nulls last desc DS_interval
DROP TABLE IF EXISTS t6; 
CREATE TABLE t6(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1' YEAR ORDER BY (year,month,branch) nulls last desc organization lsc tablespace spc;

--table_sort_clause:MINUTE TO SECOND
DROP TABLE IF EXISTS t7; 
CREATE TABLE t7(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '30:59.9' MINUTE TO SECOND(9) ORDER BY (year,month,branch) nulls last desc organization lsc tablespace spc;

DROP TABLE IF EXISTS t8; 
CREATE TABLE t8(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1400 5:12:10.222222' day TO SECOND ORDER BY (year,month,branch) nulls last desc organization lsc tablespace spc;

--不排序，默认以第一列
DROP TABLE IF EXISTS t9; 
CREATE TABLE t9(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1400 5:12:10.222222' day TO SECOND organization lsc tablespace spc;

--分区+lob+lsc
DROP TABLE IF EXISTS test_lob; 
CREATE TABLE test_lob(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2), c clob, fee_total NUMBER(10,2),a int)
COMPRESSION lz4 HIGH MCOL TTL '30:59.9' MINUTE TO SECOND(9) ORDER BY (year,month,branch) nulls last desc partition by range(a)(partition p1 values less than(1) ,partition p2 values less than(10)) organization lsc tablespace spc;
insert into test_lob values('1','1','1',1.2,1,rpad('1',2000,'1'),1,1);
commit;

--分区+lob+heap
DROP TABLE IF EXISTS test_lob_heap; 
CREATE TABLE test_lob_heap(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2), c clob, fee_total NUMBER(10,2),a int)
partition by range(a)(partition p1 values less than(1) ,partition p2 values less than(10));
insert into test_lob_heap values('1','1','1',1.2,1,rpad('1',2000,'1'),1,1);
commit;



--user2
drop user user2 cascade;
create user user2 identified by 1;
grant dba to user2;
conn user2/1@192.168.7.109:1688
--表
--lsc 有compression/encoding
drop table if exists t1;
create table t1(id1 int COMPRESSION lz4 HIGH,id2 int COMPRESSION lz4,id3 int COMPRESSION lz4 MEDIUM,id4 int COMPRESSION lz4 low,id5 int default 222 not null COMPRESSION lz4 low ENCODING PLAIN,id6 int COMPRESSION lz4 ENCODING rle,id7 int COMPRESSION lz4 ENCODING DICTIONARY(plain),id8 int COMPRESSION lz4 ENCODING DICTIONARY(RLE),id9 int ,id10 varchar(100) COMPRESSION lz4 ENCODING DICTIONARY(RLE) ,id11 number COMPRESSION lz4 ENCODING BYTE-PACKED) organization lsc tablespace spc;

--heap 无compression/encoding
drop table if exists t2;
create table t2(id1 int);
insert into t2 values(1);
commit;

--tac 有encoding，encoding只能是DICTIONARY，列只能是string，无compression
drop table if exists t3;
create table t3(id1 varchar(100) ENCODING DICTIONARY(plain),id2 char(100)) organization tac;
insert into t3 values('1','2');
commit;

--lsc 有compression/encoding,compression表属性/列属性均设置（仅支持lz4压缩）
drop table if exists t4;
create table t4(id1 int COMPRESSION lz4 HIGH,id2 int COMPRESSION lz4,id3 int COMPRESSION lz4 MEDIUM,id4 int COMPRESSION lz4 low,id5 int default 222 not null COMPRESSION lz4 low ENCODING PLAIN,id6 int COMPRESSION lz4 ENCODING rle,id7 int COMPRESSION lz4 ENCODING DICTIONARY(plain),id8 int COMPRESSION lz4 ENCODING DICTIONARY(RLE),id9 int ,id10 varchar(100) COMPRESSION lz4 ENCODING DICTIONARY(RLE) ,id11 number COMPRESSION lz4 ENCODING BYTE-PACKED) COMPRESSION lz4 MEDIUM INITRANS 1 organization lsc tablespace spc;


--table_sort_clause/mcol_ttl_clause YM_interval --仅针对lsc
DROP TABLE IF EXISTS t5; 
CREATE TABLE t5(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1' MONTH ORDER BY (year,month,branch) nulls first asc
organization lsc tablespace spc;

--table_sort_clause:nulls last desc DS_interval
DROP TABLE IF EXISTS t6; 
CREATE TABLE t6(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1' YEAR ORDER BY (year,month,branch) nulls last desc organization lsc tablespace spc;

--table_sort_clause:MINUTE TO SECOND
DROP TABLE IF EXISTS t7; 
CREATE TABLE t7(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '30:59.9' MINUTE TO SECOND(9) ORDER BY (year,month,branch) nulls last desc organization lsc tablespace spc;

DROP TABLE IF EXISTS t8; 
CREATE TABLE t8(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1400 5:12:10.222222' day TO SECOND ORDER BY (year,month,branch) nulls last desc organization lsc tablespace spc;

--不排序，默认以第一列
DROP TABLE IF EXISTS t9; 
CREATE TABLE t9(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2),fee_total NUMBER(10,2))
COMPRESSION lz4 HIGH MCOL TTL '1400 5:12:10.222222' day TO SECOND organization lsc tablespace spc;

--分区+lob+lsc
DROP TABLE IF EXISTS test_lob; 
CREATE TABLE test_lob(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2), c clob, fee_total NUMBER(10,2),a int)
COMPRESSION lz4 HIGH MCOL TTL '30:59.9' MINUTE TO SECOND(9) ORDER BY (year,month,branch) nulls last desc partition by range(a)(partition p1 values less than(1) ,partition p2 values less than(10)) organization lsc tablespace spc;
insert into test_lob values('1','1','1',1.2,1,rpad('1',2000,'1'),1,1);
commit;

--分区+lob+heap
DROP TABLE IF EXISTS test_lob_heap; 
CREATE TABLE test_lob_heap(year CHAR(4) NOT NULL,month CHAR(2) NOT NULL,branch CHAR(4),revenue_total NUMBER(10,2),cost_total NUMBER(10,2), c clob, fee_total NUMBER(10,2),a int)
partition by range(a)(partition p1 values less than(1) ,partition p2 values less than(10));
insert into test_lob_heap values('1','1','1',1.2,1,rpad('1',2000,'1'),1,1);
commit;



--导出
--全库
exp sys/Cod-2022@192.168.7.109:1688 file=a full=y
--用户
exp sys/Cod-2022@192.168.7.109:1688 file=a owner=user1,user2
--表
exp sys/Cod-2022@192.168.7.109:1688 file=a tables=user1.t1,user1.t2,user1.t3,user1.t4,user1.t5,user1.t6,user1.t7,user1.t8,user1.t9,user1.TEST_LOB,user1.TEST_LOB_HEAP

--导入
imp sys/Cod-2022@192.168.7.109:1688 file=a full=y
imp sys/Cod-2022@192.168.7.109:1688 file=a fromuser=user1 tables=t1,t2,t3,t4,t5,t6,t7,t8,t9,TEST_LOB,TEST_LOB_HEAP
--删除
yasql sys/Cod-2022@192.168.7.109:1688
drop user user1 cascade;
drop user user2 cascade;
create user user1 identified by 1;
grant dba to user1;
create user user2 identified by 1;
grant dba to user2;
exit;
--预期
yasql sys/Cod-2022@192.168.7.109:1688 -f -e D:\导入导出工具总结\col-clause\select.sql > D:\导入导出工具总结\col-clause\select.expected
yasql sys/Cod-2022@192.168.7.109:1688 -f -e D:\导入导出工具总结\col-clause\select.sql > D:\导入导出工具总结\col-clause\select.out
```

#### select.sql

```
select * from dba_tables where DATABASE_MAINTAINED = 'N' order by OWNER,TABLE_NAME;
select * from dba_tab_cols where user_generated = 'Y' and OWNER !='SYS' order by OWNER,TABLE_NAME,COLUMN_ID;
select * from DBA_SORT_TABLE order by OWNER,TABLE_NAME;
select * from DBA_SORT_KEY_COLUMNS order by OWNER,TABLE_NAME,COLUMN_POSITION;
--分区
select * from DBA_PART_TABLES order by OWNER, TABLE_NAME, PARTITIONING_TYPE ;
select * from DBA_PART_KEY_COLUMNS order by OWNER, name, OBJECT_TYPE, COLUMN_NAME;
select * from DBA_TAB_PARTITIONS order by TABLE_OWNER,TABLE_NAME, HIGH_VALUE;
--lob

--表数据
conn user1/1@192.168.7.109:1688;
select * from  t1;
select * from t2;
select * from t3;
select * from  t4;
select * from  t5;
select * from  t6;
select * from  t7;
select * from test_lob;
select * from test_lob_heap;

--表数据
conn user2/1@192.168.7.109:1688;
select * from  t1;
select * from t2;
select * from t3;
select * from  t4;
select * from  t5;
select * from  t6;
select * from  t7;
select * from test_lob;
select * from test_lob_heap;
```

  


##   [7. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  



## Attachments:

[image2022-11-16_11-24-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTE4OTcwYzJhZjRmNTFmZmM1IiwicmVmX2lkIjoiNjczOTZhZTE1OTNmOTljOWZmMjM1YWYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NzI2LCJleHAiOjE3ODIzNzYxMjZ9.mdH94kWuFXh0QPVRmPRiKWuUM_0RRQrU_hYLVKAplz8)

 (image/png)    


[select.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTE4OTcwYzJhZjRmNTFmZmM2IiwicmVmX2lkIjoiNjczOTZhZTE1OTNmOTljOWZmMjM1YWYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NzI2LCJleHAiOjE3ODIzNzYxMjZ9.V0dlSA7xWF2x2wgRXy_5I8AUjtfB1F50Emu2MJKIbYo)

 (application/octet-stream)    
