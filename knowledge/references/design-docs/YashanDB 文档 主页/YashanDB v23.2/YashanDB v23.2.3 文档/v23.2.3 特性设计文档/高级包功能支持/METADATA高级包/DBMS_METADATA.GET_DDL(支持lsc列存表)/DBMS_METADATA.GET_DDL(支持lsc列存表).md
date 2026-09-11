Created by 唐嘉欣, last modified on 九月 01, 2023

#   [1. OverView（概述）](#1-overview概述)  

给定一个lsc列存表，输出该表的建表create语句

原始需求：    [YDBRD-15659](https://jira.yasdb.com/browse/YDBRD-15659?src=confmacro)    -  dbms_metadata.get_ddl支持获取列存DDL  完成

  [YDBRD-17688](https://jira.yasdb.com/browse/YDBRD-17688?src=confmacro)    -  dbms_metadata.get_ddl支持获取列存ddl  完成

#   [2. Features（功能特性）](#2-features功能特性)  

**语法图：**

syntax::= CREATE [(GLOBAL|PRIVATE) TEMPORARY|SHARDED|DUPLICATED] TABLE [IF NOT EXISTS] [schema "."] table_name"("  relation_properties ")"[table_properties][lsc_table_properties][row_movement_clause]

![](https://pingcode.yasdb.com/atlas/files/public/67396d8fa1ad9a3311dc921e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFFQUFCQUFBQUFZQUFBQUVBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0VBQUFBQUFRRUFBQUFCQUFBQUFBQUJCQUFBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUlDQUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNTQsImV4cCI6MTc4MjMyMDE1NH0.sAyWNQySxSpGk_Pfw3nbtFiy07_zuROPZ-pKi-VnPqI)

![](https://pingcode.yasdb.com/atlas/files/public/67396d8f8970c2af4f5213ab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFFQUFCQUFBQUFZQUFBQUVBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0VBQUFBQUFRRUFBQUFCQUFBQUFBQUJCQUFBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUlDQUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNTQsImV4cCI6MTc4MjMyMDE1NH0.sAyWNQySxSpGk_Pfw3nbtFiy07_zuROPZ-pKi-VnPqI)

**语法支持情况：**

|语句|是否支持|
|---|---|
|relation_properties|全部支持|
|table_properties|部分支持|
|lsc_table_properties|全部支持|
|row_movement_clause|全部支持|


**relation_properties支持情况：**

![](https://pingcode.yasdb.com/atlas/files/public/67396d8f8970c2af4f5213ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFFQUFCQUFBQUFZQUFBQUVBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0VBQUFBQUFRRUFBQUFCQUFBQUFBQUJCQUFBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUlDQUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNTQsImV4cCI6MTc4MjMyMDE1NH0.sAyWNQySxSpGk_Pfw3nbtFiy07_zuROPZ-pKi-VnPqI)

|语句|是否支持|
|---|---|
|column_definition|支持|
|out_of_line_constraint|支持|
|inline_constraint|支持|


注：inline_constraint情况除了NOT NULL仍使用inline_constraint，其他情况都转为out_of_line_constraint

foreign key和check不支持，因为列存不支持foreign key和check

**table_properties支持情况：**

![](https://pingcode.yasdb.com/atlas/files/public/67396d8fa1ad9a3311dc921f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFFQUFCQUFBQUFZQUFBQUVBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0VBQUFBQUFRRUFBQUFCQUFBQUFBQUJCQUFBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUlDQUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNTQsImV4cCI6MTc4MjMyMDE1NH0.sAyWNQySxSpGk_Pfw3nbtFiy07_zuROPZ-pKi-VnPqI)

|语句|是否支持|备注|
|---|---|---|
|organization_clause|支持||
|table_partition_clause|支持||
|lob_clauses|支持||
|logging_clause|支持||
|physical_attribute_clause|部分支持|详情见下表|
|temp_table_attr_clause|不支持|不支持临时表|
|shard_distribute_clause|不支持|不支持分布式|
|parallel_clause|不支持|仅作语法兼容，无实际意义|
|cache_clause|不支持|仅作语法兼容，无实际意义|
|readonly_clause|不支持|仅作语法兼容，无实际意义|
|inmemory_clause|不支持|仅作语法兼容，无实际意义|
|table_compression|不支持|仅作语法兼容，无实际意义|
|nested_table_clauses|不支持|不支持嵌套表类型|


**physical_attribute_clause支持情况：**

![](https://pingcode.yasdb.com/atlas/files/public/67396d8fa1ad9a3311dc9220/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFFQUFCQUFBQUFZQUFBQUVBQUFBZ0FBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQ0VBQUFBQUFRRUFBQUFCQUFBQUFBQUJCQUFBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUlDQUFFQUFBQUFBQUFBQUFBQUFBQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzNTQsImV4cCI6MTc4MjMyMDE1NH0.sAyWNQySxSpGk_Pfw3nbtFiy07_zuROPZ-pKi-VnPqI)

|语句|是否支持|备注|
|---|---|---|
|tablespace|支持||
|pctfree|支持||
|initrans|支持||
|maxtrans|支持||
|deferred_segment_creation|部分情况支持|仅支持输出table的deferred_segment_creation，不支持输出partition的，因为暂无视图可查partition的segment deferred信息|
|tablespace set|不支持|不支持分布式|
|pctused|不支持|仅作语法兼容，无实际含义|
|storage_clause|不支持|仅作语法兼容，无实际含义|


**其他一些零散的不支持的情况**

lob_clause中basicfile|securefile不支持，因为仅作语法兼容，无实际含义

**行存，lsc列存属性差异：**

普通表：

|属性|行存是否支持|列存是否支持|备注|
|---|---|---|---|
|compression (column)|不支持|支持||
|compression_level (column)|不支持|支持||
|compression (table)|不支持|支持||
|compression_level (table)|不支持|支持||
|encoding|不支持|支持||
|order key|不支持|支持||
|升序降序|不支持|支持||
|nullFirst, nullLast|不支持|支持||
|mcol_ttl|不支持|支持||
|唯一性约束|支持|支持||
|comment|支持|支持||
|create index|支持|不支持|lsc表不支持create index索引|
|alter using index|支持|不支持|lsc表不支持create index索引|
|nested table|不支持|不支持|行表暂未实现，lsc表不支持嵌套表类型|


分区表：

|属性|行存是否支持|列存是否支持|备注|
|---|---|---|---|
|compression (column)|不支持|支持||
|compression_level (column)|不支持|支持||
|compression (table)|不支持|支持||
|compression_level (table)|不支持|支持||
|encoding|不支持|支持||
|order key|不支持|支持||
|升序降序|不支持|支持||
|nullFirst, nullLast|不支持|支持||
|mcol_ttl|不支持|支持||
|唯一性约束|支持|支持||
|二级分区表|支持|支持||
|create index|支持|不支持|lsc表不支持create index索引|
|alter using index|支持|不支持|lsc表不支持create index索引|
|comment|不支持|不支持|分区表不支持comment|
|nested table|不支持|不支持|行表暂未实现，lsc表不支持嵌套表类型|


#   [3. Interfaces（接口）](#3-interfaces接口)  

#   [4. Limitations（功能限制）](#4-limitations功能限制)  

支持lsc表，不支持tac表

支持partition分区表，不支持temporary临时表。因为临时表尚不支持lsc列存

不支持nested table嵌套表，因为lsc列存表不支持嵌套表类型

分区表不支持comment

不支持分布式

#   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

#   [5.1. 支持显示order key](#51-支持显示order-key)  

通过查询ALL_SORT_KEY_COLUMNS视图，获取order key信息，并将其拼接成ddl语句：

  `ORDER BY ("KEY1", "KEY2", "KEY3")`  

#   [5.2. 支持显示compression, compression_level](#52-支持显示compression-compression-level)  

通过查询ALL_TABLES视图获取表的压缩编码信息：compression和compression_level列

通过查询ALL_TAB_COLS视图获取列的压缩编码信息：compression和compression_level列

#   [5.3. 支持显示encoding](#53-支持显示encoding)  

通过查询ALL_TAB_COLS视图获取列的encoding编码信息：encoding列

#   [5.4. 支持显示comment](#54-支持显示comment)  

通过查询all_col_comments, all_tab_comments视图，获取comment信息并输出

#   [5.5. 支持显示deferred_segment_creation](#55-支持显示deferred-segment-creation)  

通过查询all_tables视图，获取segment deferred字段并输出

#   [6. Testcases（自测用例）](#6-testcases自测用例)  

|测试用例|输出结果|
|---|---|
|-- 建表语句,create table TAB_LSC_ALL     
  (    
      dep_id int,     
      group_id int compression lz4 low encoding plain,     
      id int compression lz4 medium encoding rle not null primary key,     
      name char(10) default 'Mahiro' compression lz4 high encoding dictionary(plain),     
      msg clob compression lz4 high encoding plain,     
      constraint c1 unique (name)    
  )     
  organization lsc     
  tablespace users     
  pctfree 8 initrans 2 maxtrans 255     
  segment creation immediate     
  lob (msg) store as (tablespace users enable storage in row)     
  logging     
  parallel 8     
  cache     
  readwrite     
  compress     
  compression lz4 high     
  order by (id, dep_id, group_id) nulls first asc scol     
  mcol ttl '1' month     
  enable row movement;,-- 插入comment,comment on table TAB_LSC_ALL is 'Hello hello!';,comment on column TAB_LSC_ALL.msg is 'Hello world!';,select dbms_metadata.get_ddl('TABLE', 'TAB_LSC_ALL') from sys.dual;|成功,CREATE TABLE "REGRESS"."TAB_LSC_ALL"    
  ("DEP_ID" INTEGER COMPRESSION LZ4 HIGH ENCODING PLAIN,    
  "GROUP_ID" INTEGER COMPRESSION LZ4 LOW ENCODING PLAIN,    
  "ID" INTEGER NOT NULL ENABLE COMPRESSION LZ4 MEDIUM ENCODING RLE,    
  "NAME" CHAR(10) DEFAULT 'Mahiro' COMPRESSION LZ4 HIGH ENCODING DICTIONARY(PLAIN),    
  "MSG" CLOB COMPRESSION LZ4 HIGH ENCODING PLAIN,    
  CONSTRAINT "C1" UNIQUE ("NAME")    
  USING INDEX    
  PCTFREE 8 INITRANS 2 MAXTRANS 255    
  TABLESPACE "USERS" ENABLE,    
  PRIMARY KEY ("ID")    
  USING INDEX    
  PCTFREE 8 INITRANS 2 MAXTRANS 255    
  TABLESPACE "USERS" ENABLE    
  ) PCTFREE 8 INITRANS 2 MAXTRANS 255    
  LOGGING    
  TABLESPACE "USERS"    
  SEGMENT CREATION IMMEDIATE    
  LOB ("MSG") STORE AS (    
  TABLESPACE "USERS" ENABLE STORAGE IN ROW)    
  COMPRESSION LZ4 HIGH    
  ORDER BY ("ID","DEP_ID","GROUP_ID") ASC NULLS FIRST SCOL    
  MCOL TTL '2678400' SECOND    
  ORGANIZATION LSC    
  ENABLE ROW MOVEMENT    
  COMMENT ON COLUMN "REGRESS"."TAB_LSC_ALL"."MSG" IS 'Hello world!'    
  COMMENT ON TABLE "REGRESS"."TAB_LSC_ALL" IS 'Hello hello!'|
|-- 建表语句,create table TAB_LSC_PART_ALL     
  (    
      dep_id int,     
      group_id int compression lz4 low encoding plain,     
      id int compression lz4 medium encoding rle not null primary key,     
      name char(10) default 'Mahiro' compression lz4 high encoding dictionary(plain),     
      msg clob compression lz4 high encoding plain,     
      constraint c1 unique (name)    
  )     
  organization lsc     
  tablespace users     
  pctfree 8 initrans 2 maxtrans 255     
  segment creation deferred     
  partition by range (dep_id)     
  subpartition by range (group_id)     
  subpartition template (subpartition spt1 values less than (100), subpartition spt2 values less than (maxvalue))     
  (    
      partition p1 values less than (100) (subpartition sp1 values less than (100), subpartition sp2 values less than (maxvalue)),    
      partition p2 values less than (maxvalue) (subpartition sp3 values less than (100), subpartition sp4 values less than (maxvalue))    
  )    
  lob (msg) store as (tablespace users enable storage in row)     
  logging     
  parallel 8     
  cache     
  readwrite      
  compress     
  compression lz4 high     
  order by (id, dep_id, group_id) nulls first asc scol     
  mcol ttl '1' month     
  enable row movement;,-- 插入comment,comment on table TAB_LSC_PART_ALL is 'Hello hello!';,comment on column TAB_LSC_PART_ALL.msg is 'Hello world!';,select dbms_metadata.get_ddl('TABLE', 'TAB_LSC_PART_ALL') from sys.dual;|输出comment失败，comment语句报错,YAS-00004 feature "do comment on composite part table" has not been implemented yet,YAS-00004 feature "do comment on composite part table" has not been implemented yet,CREATE TABLE "REGRESS"."TAB_LSC_PART_ALL"    
  ("DEP_ID" INTEGER COMPRESSION LZ4 HIGH ENCODING PLAIN,    
  "GROUP_ID" INTEGER COMPRESSION LZ4 LOW ENCODING PLAIN,    
  "ID" INTEGER NOT NULL ENABLE COMPRESSION LZ4 MEDIUM ENCODING RLE,    
  "NAME" CHAR(10) DEFAULT 'Mahiro' COMPRESSION LZ4 HIGH ENCODING DICTIONARY(PLAIN),    
  "MSG" CLOB COMPRESSION LZ4 HIGH ENCODING PLAIN,    
  CONSTRAINT "C1" UNIQUE ("NAME")    
  USING INDEX    
  PCTFREE 8 INITRANS 2 MAXTRANS 255    
  TABLESPACE "USERS" ENABLE,    
  PRIMARY KEY ("ID")    
  USING INDEX    
  PCTFREE 8 INITRANS 2 MAXTRANS 255    
  TABLESPACE "USERS" ENABLE    
  ) PCTFREE 8 INITRANS 2 MAXTRANS 255    
  LOGGING    
  TABLESPACE "USERS"    
  SEGMENT CREATION DEFERRED    
  LOB ("MSG") STORE AS (    
  TABLESPACE "USERS" ENABLE STORAGE IN ROW)    
  PARTITION BY RANGE ("DEP_ID")    
  SUBPARTITION BY RANGE ("GROUP_ID")    
  SUBPARTITION TEMPLATE( SUBPARTITION "SPT1" VALUES LESS THAN (100),    
  SUBPARTITION "SPT2" VALUES LESS THAN (maxvalue))    
  (PARTITION "P1" VALUES LESS THAN (100)    
  PCTFREE 8 INITRANS 2 MAXTRANS 255    
  TABLESPACE "USERS"    
  (SUBPARTITION "SP1" VALUES LESS THAN (100)    
  TABLESPACE "USERS",    
  SUBPARTITION "SP2" VALUES LESS THAN (maxvalue)    
  TABLESPACE "USERS"),    
  PARTITION "P2" VALUES LESS THAN (maxvalue)    
  PCTFREE 8 INITRANS 2 MAXTRANS 255    
  TABLESPACE "USERS"    
  (SUBPARTITION "SP3" VALUES LESS THAN (100)    
  TABLESPACE "USERS",    
  SUBPARTITION "SP4" VALUES LESS THAN (maxvalue)    
  TABLESPACE "USERS"))    
  COMPRESSION LZ4 HIGH    
  ORDER BY ("ID","DEP_ID","GROUP_ID") ASC NULLS FIRST SCOL    
  MCOL TTL '2678400' SECOND    
  ORGANIZATION LSC    
  ENABLE ROW MOVEMENT|


更多详细自测用例：

#   [7. Document（资料）](#7-document资料)  

#   [8. Workload（工作量）](#8-workload工作量)  

#   [9. TODO（遗留问题）](#9-todo遗留问题)  

行表nested_table_clause输出与建表语句语法有冲突（暂时保留）

行表create index信息是否需要输出（暂不需要）

create index, alter using index, comment语句和create table语句不是同一条语句，是否需要区分开（忽略）

二级分区表的情况下，一级分区表的segment created属性永远是N

分区的segment deferred暂无视图可查，不支持导出

#   [10. 评审意见](#10-评审意见)  

1. 补充升序降序
1. 补充nullFirst,nullLast
1. lsc支持唯一键
1. all_tables mcol_ttl
1. 行列建表差异，约束差异
1. 缺少comment
1. 行列分区表适配二级分区


  


## Attachments:

[get_ddl_testcases.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOGY4OTcwYzJhZjRmNTIxM2E1IiwicmVmX2lkIjoiNjczOTZkOGU1OTNmOTljOWZmMjM3Y2NmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzU0LCJleHAiOjE3ODIzOTU3NTR9.wu8u-QOtqNILNW0Y5_u7J1S01J1mgqm_M4zTSyhN5cI)

 (application/octet-stream)    
