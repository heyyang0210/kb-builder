Created by 刘大境, last modified on 七月 25, 2024

# 1. 概述

在原有的mysql框架之上，适配索引的特定特性  。

IR：    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f5](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2f5)    ?    
  #YASHAN-933 【mysql兼容】（功能&语法）支持索引的特定特性

SR：    [https://pingcode.yasdb.com/pjm/items/6619098ffd997db58ad88408](https://pingcode.yasdb.com/pjm/items/6619098ffd997db58ad88408)    ?    
  #YDBRD-26254 MySQL索引DDL语法支持

开发文档：    [支持索引的特定特性设计文档 - 李子怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153023765)  

测试调研文档：    [YDBRD-26254 MySQL索引DDL语法支持测试调研 - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159423341)  

# 2. 需求分析

【create table table_name(  *col_name*     *column_definition*  )指定索引语法图】

### | {INDEX | KEY} [index_name] [index_type] (key_part,...)    
  [index_option] ...    
  | {FULLTEXT | SPATIAL} [INDEX | KEY] [index_name] (key_part,...)    
  [index_option] ...    
  | [CONSTRAINT [symbol]] PRIMARY KEY    
  [index_type] (key_part,...)    
  [index_option] ...    
  | [CONSTRAINT [symbol]] UNIQUE [INDEX | KEY]    
  [index_name] [index_type] (key_part,...)    
  [index_option] ...    
  | [CONSTRAINT [symbol]] FOREIGN KEY    
  [index_name] (col_name,...)    
  reference_definition    
  }

【Create Index 语法图】

### CREATE [UNIQUE | FULLTEXT | SPATIAL] INDEX index_name    
  [index_type]    
  ON tbl_name (key_part，...)    
  [index_option]    
  [algorithm_option | lock_option] ...    

### key_part: col_name [(length)] [ASC | DESC]    --升序/降序

### index_option: {    
  KEY_BLOCK_SIZE [=] value       --指定索引块大小    
  | index_type                              --索引类型    
  | WITH PARSER parser_name选项{ngram / simple / infix / boolean /ddefault}   --解析器    
  | COMMENT 'string'      --索引注释    
  }

### index_type:    
  USING {BTREE | HASH}   --索引类型

### algorithm_option:    
  ALGORITHM [=] {DEFAULT | INPLACE | COPY}   ---删除索引算法

### lock_option:    
  LOCK [=] {DEFAULT | NONE | SHARED | EXCLUSIVE}  --锁算法

【Alter table table_name语法图】

### ALTER TABLE tbl_name    
  [alter_option [, alter_option] ...]    
  [partition_options]

### alter_option: {    
  table_options    
  | ADD [COLUMN] col_name column_definition ---新增单列 列名及数据类型    
  | ADD [COLUMN] (col_name column_definition,...) ---新增多列 列名及数据类型    
  | ADD {INDEX | KEY} [index_name] --新增索引    
  [index_type] (key_part,...) [index_option] ...--新增索引下分支选项    
  | ADD {FULLTEXT | SPATIAL} [INDEX | KEY] [index_name]     
  (key_part,...) [index_option] ...

  


【Alter table table_name rename/disbale 语法图】

### ALTER TABLE tbl_name

### RENAME   {  INDEX     |     KEY  }   *old_index_name*     TO     *new_index_name*

### {  DISABLE     |     ENABLE  }   KEYS

  


【DROP INDEX语法图】

### DROP INDEX index_name ON tbl_name    
  [algorithm_option | lock_option] ...

### algorithm_option:    
  ALGORITHM [=] {DEFAULT | INPLACE | COPY}  ---删除索引算法

### lock_option:    
  LOCK [=] {DEFAULT | NONE | SHARED | EXCLUSIVE}  --锁算法

【ALTER TABLE DROP INDEX语法图】

### ALTER TABLE tbl_name DROP {INDEX | KEY} index_name    --指定索引关键字删除

【ALTER TABLE TABLE_NAME ADD COLUMN语法图】

### ALTER TABLE tbl_name ADD [COLUMN] (col_name column_definition,...) --可指定新增单列，多列

【ALTER TABLE TABLE_NAME modify 语法图】

### ALTER TABLE TABLE_NAME modify col_name column_definition；

  


  


  


# 3.规格约束

drop索引，不能删除约束创建的索引，执行删除命令会进行拦截。

索引变更中的first, after不支持。

索引选项， 不支持using hash，使用using hash 会显示未实现。

# 4. 详细测试设计

~~(1). 约束：创建/修改/添加索引键为主键/唯一，外键约束父子表带索引，NULL 、NOT NULL列做为索引键~~

~~(2). 覆盖MYSQL支持索引类型：B-tree索引、HASH索引、Full-Text索引、SPATIAL索引、R-tree索引、Prefix索引、Composite索引、唯一索引、主键索引、外键索引、~~

~~(3).新增列做为索引键，修改索引列数据类型/索引列名，或对普通索引添加约束~~

(4). 索引创建修改后观测手段：information_schema.STATISTICS   DBA_INDEXES （暂不支持show index from table_name;)

(5). 创建/修改索引前后，带DML操作，包括唯一索引，数据验证。

~~(6) .对内置索引进行修改、删除~~

(7).ADD UNIQUE INDEX，在MYSQL 支持DDL 约束的用例上已有覆盖，在原用例上改造 加information_schema.STATISTICS查询即可，无需新增用例

(8). 本次语法兼容，主要关注语法图上分支 是否能创建/修改/删除成功，成功后查询information_schema.STATISTICS视图

(9).升级前后兼容.

- 升级后mysql模式/yashan创建的索引dml/ddl正常
- 升级后mysql模式创建的索引，切换到yashan模式dml/ddl正常
- 升级后切换mysql模式拦截


（10). 对于语法路径的验证，首先覆盖全量的可选项，与其他可选项正交组合，正交组合中覆盖一些可选项顺序调换。其次覆盖一个该路径的最小语法(不带任何可选项)。最后最小语法，在某个可选项中选择一类覆盖。

## 4.1.1专项覆盖

|专项|是否涉及|说明|
|---|---|---|
|并发|不涉及|语法兼容|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|不涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


## 4.2 测试设计方法

|编号|输入条件|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|1|create table table_name(  *col_name*     *column_definition*  )      |~~1.行内：create table table_name data_type (col_name column_definition)[NOT NULL | NULL] [DEFAULT default_value][AUTO_INCREMENT] [UNIQUE [KEY]] [[PRIMARY] KEY]）  备注：约束SR已测过，在历史用例上加上索引视图查询即可~~,~~2.组合索引/单列索引~~,~~3.建表语句中创建多个index/key     同一列指定索引 create table t1(id text,key idx_1(id(100)) KEY_BLOCK_SIZE = 8,key idx_2(id(100)) KEY_BLOCK_SIZE = 8);~~,~~4. 建表语句中创建多个index/key   不同列指定索引~~,~~5.建表语句中创建多个index/key ，同时存在行内+行外创建索引~~|~~建表语句重创建多个index/key，  index_name名字重复~~,  
|  
|
|2|create index语法,  
|~~CREATE [UNIQUE | FULLTEXT | SPATIAL] INDEX index_name~~    
  ~~[index_type]~~    
  ~~ON tbl_name (key_part,...)~~    
  ~~[index_option]~~    
  ~~[algorithm_option | lock_option]   语法覆盖~~,~~表上索引键与create INDEX为不同索引键~~,~~表上指定索引键与create index索引键重复~~,~~同一用户下，不同表之间index_name重名~~|~~表上index_name与create index index_name重名~~,~~表上索引键与create UNIQUE index索引键冲突~~,  
|  
|
|3|Alter table table_name modify COLUMN|~~表名 带/不带schema~~,~~修改索引列名~~,~~修改索引列数据类型~~,~~修改索引列字符集/排序规则 ~~  ~~CHARACTER SET/COLLATE~~  ~~  ~~,~~修改索引列 数据类型带约束 NULL/NOT NULL~~,~~列默认值设为~~  ~~DEFAULT ""~~  ~~   / ~~  ~~DEFAULT  ~~  ~~NULL~~,~~修改前后带DDL/DML业务操作~~,~~B-tree索引、HASH索引、Full-Text索引、SPATIAL索引、R-tree索引、Prefix索引、Composite索引，对以上索引类型列，做modify COLUMN~~|~~索引列 插满值char(10)修改varchar(5)数据类型~~,~~索引列 跨类型modify， 列如varchar类型modify  DATE~~,~~modify 重名列名~~|  
|
|4|ALTER TABLE tbl_name ADD [COLUMN] (col_name column_definition,...)|~~新增列做为索引列~~,~~新增多列设为NULL/NOT NULL~~,~~新增列并定义列默认值为~~  ~~DEFAULT  0~~  ~~  / ~~  ~~DEFAULT  ~~  ~~NULL~~,~~新增列定义为主键约束/唯一约束/外键约束~~,~~新增列并设置索引     ALTER TABLE tbl_name ADD COLUMN col_name column_definition,ADD INDEX index_name (col_name);~~,~~新增列并设置注释      ALTER TABLE tbl_name ADD COLUMN col_name column_definition COMMENT 'column_comment';~~,~~新增前后带DDL/DML业务操作~~|~~新增列设为~~  ~~DEFAULT  ""~~,  
|  
|
|  
|alter table table_name add INDEX/KEY (a)  algorithm_option    /  lock_option|~~建表时指定索引，ADD索引~~,~~create index后，ADD索引~~,指定不同列，ADD索引,~~指定多列，ADD索引 ~~,指定索引单列/多列  length  长度     ALTER     TABLE   a   ADD   KEY(a(  100  ), b(50));  ——已在语法用例覆盖全|~~列上有索引，重复ADD INDEX/KEY  ~~,~~ADD a/b列组合索引 ，a列上已有索引~~|  
|
|5|ALTER TABLE tbl_name DROP {INDEX | KEY} index_name|~~删除索引列主键/唯一约束、再删索引~~,未删除外键约束，删除父表索引,~~带有NOT NULL/NULL索引列，删除索引~~,~~指定INDEX关键字删除索引~~,~~指定KEY关键字删除索引~~,mysq模式l创建外键后，mysql模式下删除外键自动的索引   ~~\或者切换yahsan模式删除那个索引~~|~~未删除主键/唯一约束，删除索引 ~~,~~修改索引名称，删除索引时使用旧索引名~~,~~指定系统表删除对应的内置索引~~,~~同时指定关键字 INDEX KEY删除索引~~,~~指定算法删除索引报错~~|~~MYSQL支持在同列新增不同索引类型，我们表现是？需要关注~~,~~CREATE TABLE a (a TEXT,b INT);~~    
  ~~create FULLTEXT index a on a(a) key_block_size=100 COMMENT'000' WITH PARSER ngram;~~    
  ~~alter table a ADD key(a(100));~~|
|6|DROP INDEX index_name on table_name|~~不带算法~~,~~带算法algorithm_option ~~  ~~ [=] {DEFAULT | INPLACE | COPY}~~,~~带算法~~  ~~lock_option~~  ~~ [=] {DEFAULT | NONE | SHARED | EXCLUSIVE}~~,~~带两种~~  ~~algorithm_option   lock_option ~~  ~~算法组合覆盖~~,~~建索引时算法，与删除索引算法不一致~~,mysq模式l创建外键后，mysql模式下删除外键自动的索引  ~~\或者切换yahsan模式删除那个索引~~|~~未删除主键/唯一约束，删除索引  带算法~~,~~修改索引名称，删除索引时使用旧索引名   带算法~~,~~指定系统表删除对应的内置索引    带算法~~,  
|  
|
|7|交互场景|MYSQL创建普通索引，切换YASHAN  using index索引升级 --不core,MYSQL创建同名索引、切换YASHAN drop index   --不core,YASHAN创建表索引、切换MYSQL做DDL/DML 、drop index --不core,MYSQL创建表指定索引、CREATE INDEX, 切换YASHAN做DDL/DML业务操作 --不core|  
|  
|


# 5. 文本用例

  


  


# 6. 测试框架设计

本次测试采用yasft测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7. 测试环境说明

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[image2024-7-15_14-33-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODM4OTcwYzJhZjRmNTIxOTFhIiwicmVmX2lkIjoiNjczOTZlODM1OTNmOTljOWZmMjM4NTllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjY5LCJleHAiOjE3ODI1MjQwNjl9.G2XwsdpAswAH8bVtLJmuWH3UAmqp5oq_adEv5pZATHo)

 (image/png)    


[mysql兼容索引DDL语法.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODM4OTcwYzJhZjRmNTIxOTFjIiwicmVmX2lkIjoiNjczOTZlODM1OTNmOTljOWZmMjM4NTllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjY5LCJleHAiOjE3ODI1MjQwNjl9.jLD2zF6GrmC-N8UNRLw0fLqYsNMIOdAdkqZsRBJDGaY)

 (application/x-xmind)    


[mysql兼容索引DDL语法.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODNhMWFkOWEzMzExZGM5NzhkIiwicmVmX2lkIjoiNjczOTZlODM1OTNmOTljOWZmMjM4NTllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjY5LCJleHAiOjE3ODI1MjQwNjl9.kZO_QZ4Mc3gDM1gjoRrq6_LXQ-CeNz7o2XF5YUTUAgI)

 (application/x-xmind)    


[YDBRD-26254 MySQL索引DDL语法支持.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODM4OTcwYzJhZjRmNTIxOTFlIiwicmVmX2lkIjoiNjczOTZlODM1OTNmOTljOWZmMjM4NTllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjY5LCJleHAiOjE3ODI1MjQwNjl9._1BunqaDS7hQdlWt8iTJr9QAl4xiKBdsl-WmM_fSUBc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计方案评审,与会人：张鹏飞、郑荃、陈瑞、林永豪、李子怡、刘大境,评审时间：2024-07-17 16:00-16:40 评审地点：线上    
  会议主题：MySQL索引DDL语法支持    
  评审纪要信息：,1.create table create index不支持FULLTEXT/SPATIAL索引类型    
  2. WITH PARSER parser_name 索引解析器，不支持，当前语法未做兼容    
  3. {DISABLE | ENABLE} KEYS 不支持，当前语法未做兼容    
  4. RENAME {INDEX | KEY} old_index_name TO new_index_name 不支持，当前语法未做兼容    
  5. 索引长度规格与YASHAN模式对齐，索引COMMENT不支持，当前语法未做兼容    
  6. 索引COMMT' MEGRE_THRESHOLD= ' 需要测试    
  7.升级场景不存在同版本之间升级，需要重点关注不支持mysql的版本 -> 支持mysql的版本    
  8. MYSQL创建多个不同表上，同名索引，需要切换YASHAN模式 删除索引，不core,9.ALTER TABLE tbl_name ADD COLUMN col_name column_definition,ADD INDEX index_name (col_name)不支持，当前语法未做兼容,Posted by liudajing at 七月 17, 2024 17:06|
|---|
|  [](null)  ,不支持同时alter table ADD 唯一约束 和普通索引    
  不支持同时alter table ADD KEY/INDEX,Posted by liudajing at 七月 23, 2024 15:01|
