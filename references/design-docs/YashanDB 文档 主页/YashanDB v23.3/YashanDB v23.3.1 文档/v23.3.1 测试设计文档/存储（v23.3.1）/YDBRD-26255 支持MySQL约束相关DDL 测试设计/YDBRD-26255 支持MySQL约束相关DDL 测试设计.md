Created by 陈瑞, last modified on 六月 28, 2024

# 1. 概述

在原有的mysql框架之上，适配约束相关DDL。

  [https://pingcode.yasdb.com/pjm/items/66190a1bfd997db58ad884c4](https://pingcode.yasdb.com/pjm/items/66190a1bfd997db58ad884c4)    ?    
  #YDBRD-26255 支持MySQL约束相关DDL

# 2. 需求分析

## 2.1 功能点分析

【索引、外键和 CHECK 约束】

（1）PRIMARY KEY：DROP PRIMARY KEY 

唯一索引，必须

定义为NOT NULL。如果没有显式声明，会隐式声明为NOT NULL。

          既可以作为表约束，也可以作为列约束。

          存在外键时会无法删除。

          删除语法： ALTER TABLE [table_name] DROP PRIMARY KEY 

                             （alter table ... modify/change...不能删除prinary key, unique）

                               ALTER TABLE [table_name] MODIFY  [column_name] [column_def] NULL (可以删除非空约束)

                               ALTER TABLE [table_name] CHANGE  [old_column_name] [new_column_name] [column_def] NULL  (可以删除非空约束)

          

          添加语法： ALTER TABLE [table_name] ADD PRIMARY KEY   (  primary_key_column  )

                             ALTER TABLE [table_name] ADD CONSTRAINT [constraint_name] PRIMARY KEY   (  primary_key_column  )

                             ALTER TABLE [table_name] MODIFY [column_name] [column_def] PRIMARY KEY

                             ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] PRIMARY KEY

         差异点：MYSQL允许对同一列建多个唯一约束， yashan (报错： such unique or primary key already exists in the table)

（2）KEY | INDEX ：KEY 通常是 INDEX 的同义词。 当在列定义中给定时，键属性 PRIMARY KEY 也可以指定为 KEY

          在MySQL中，”KEY”关键字有两种作用：一种是创建索引，另一种是定义外键。

（3）DROP：ALTER TABLE newtable DROP FOREIGN KEY newtable_FK

删除语法： ALTER TABLE [table_name] DROP FOREIGN KEY [fk_name]

## 2.2 应用场景

1、not null 约束

2、primary key

3、unqiue

4、外键约束

5、check 约束

6、default

## 2.3 规格约束

- 索引、外键和 CHECK 约束的规格默认与yashan保持一致。
- 一张表中最多有一个主键约束。
- 为列创建索引，不是主键或唯一键时可使用KEY替代INDEX （单列索引，多列索引）。
- 在创建外键时，需要注意参照的表中该列必须是PRIMARY KEY或UNIQUE KEY，否则无法定义成功。


# 3. 详细测试设计

## 3.1 测试设计方法

1、alter session 切换到mysql兼容模式

2、针对本次新增功能，场景法测试，按照每种约束创建，删除，新增能力测试

- *primary/unique 全量创建语法覆盖，包括崖山以支持和新增语法解析是否正确*
- *直接在列定义key = 创建primary*
- *unique index = unique key = unique*
- 外键约束不支持列定义拦截，覆盖创建语法，删除语法，级联删除
- check 约束，not null约束覆盖新增语法
- check 约束识别表达式差异点
- 对索引使用key 替代创建成功
- using index ，disbale 约束，modify 约束，mysql  ~~不支持的语法拦截~~


  


3、视图：INFORMATION_SCHEMA.TABLE_CONSTRAINTS、INFORMATION_SCHEMA.KEY_COLUMN_USAGE 等INFORMATION_SCHEMA未转测   --本次不转侧不测

创建后查看崖山的相关视图和约束：DBA_CONSTRAINTS、DBA_CONS_COLUMNS

索引：dba_indexes;

  


4、查询索引：  show index from t1;  --未支持，本次不转侧不测

  


5、约束的数据验证：

创建约束前插入正常，非法

创建约束后插入正常，非法

删除约束后插入非法

  


  


|  
|场景|测试点|预期|
|---|---|---|---|
|主键约束|创建主键|create table 表时创建约束,列级,1、create table xxx(  column_name   primary key)；,2、create table xxx(  column_name   key)；    --键属性 PRIMARY KEY 也可以指定为 KEY,表级,3、create table xxx(  column_name  ， primary key(  column_name  ));,4、create table xxx(  column_name  ， constraint cons1 primary key(  column_name  ) );|1、show index from t1;,2、数据校验：,插入违反值 --报错,插入null --报错,3、DBA_CONSTRAINTS、DBA_CONS_COLUMNS,视图准确|
|  
|  
|alter table 创建约束    
,表级,1、 ,ALTER TABLE [table_name] ADD PRIMARY KEY   (  primary_key_column  ),2、,ALTER TABLE [table_name] ADD CONSTRAINT [constraint_name] PRIMARY KEY (primary_key_column),  
,列级,3、,ALTER TABLE [table_name] MODIFY [column_name] [column_def] PRIMARY KEY,ALTER TABLE [table_name] MODIFY [column_name] [column_def] KEY,4、 ,ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] PRIMARY KEY,ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] KEY,  
,  
,6、  结合default / not null 约束 null,ALTER TABLE [table_name] add column column_name PRIMARY KEY,ALTER TABLE [table_name] add column column_name KEY,7、,ALTER TABLE [table_name] add （column column_name， PRIMARY KEY（primary_key_column））,  
,  
|1、show index from t1;,2、数据校验,插入违反约束值 --报错,插入null --报错,3、创建主键前约束校验，创建主键后约束校验,4、,DBA_CONSTRAINTS、DBA_CONS_COLUMNS,视图准确|
|  
|以上交叉覆盖单列和多列联合主键|  
|  
|
|  
|同一个表创建多个主键|1、在一条语句中创建多个主键报错,2、已存在主键，新增列、modify 列、change 列、add constraint时新增主键|报错|
|  
|与其他约束同时使用|1、default ，已有数据情况下，新增一列有default 'a' 约束,同时含有主键约束,2、创建指定not null 与不指定not null 相同,3、创建时指定 null 报错,4、同一列指定unique 和 primary key； --不支持|  
|
|  
|auto_increment|指定列属性时指定auto_increment|数据自增正常不报错    --迭代四补测|
|  
|删除主键|ALTER TABLE [table_name] DROP PRIMARY KEY ,ALTER TABLE [table_name] DROP constraint const_name,ALTER TABLE [table_name] DROP column|1、,DBA_CONSTRAINTS、DBA_CONS_COLUMNS,视图准确,2、对数据不再做校验|
|unqiue 约束|创建约束|1、create table 表时创建约束,create table xxx(  column_name   unique key)；,~~create table xxx(~~  ~~column_name ~~  ~~unique index)；  --不存在该场景~~,create table xxx(  column_name   unique)；,表级,create table xxx(  column_name，  unique key（  unique_key_column  ）)；,create table xxx(  column_name，  unique index（  unique_key_column  ）)；,create table xxx(  column_name，   unique（  unique_key_column  ）)；,  
,create table xxx(column_name，constraint cons_ydbrd26255_1 unique（unique_key_column）)；    
,create table xxx(column_name，constraint cons_ydbrd26255_1 unique key（unique_key_column）)；,create table xxx(column_name，constraint cons_ydbrd26255_1 unique index（unique_key_column）)；|1、show index from t1;,2、数据校验：,插入违反值 --报错,插入null --不报错,3、DBA_CONSTRAINTS、DBA_CONS_COLUMNS,视图准确|
|  
|  
|表级,1、 ,ALTER TABLE [table_name] ADD unique (key_column),ALTER TABLE [table_name] ADD unique KEY (key_column),ALTER TABLE [table_name] ADD unique index (key_column),2、,ALTER TABLE [table_name] ADD CONSTRAINT [constraint_name] unique (key_column),ALTER TABLE [table_name] ADD CONSTRAINT [constraint_name] unique KEY (key_column),ALTER TABLE [table_name] ADD CONSTRAINT [constraint_name] unique index (key_column),3、,ALTER TABLE [table_name] modify [column_name] [column_def] unique；,ALTER TABLE [table_name] modify [column_name] [column_def] unique key；,4、,ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] unique；,~~ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] unique index；不存在~~,ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] unique key；,  
,列级,5、,ALTER TABLE [table_name] add column (column_name unique KEY),ALTER TABLE [table_name] add column (column_name unique ),结合default / not null / null 约束|  
|
|  
|删除约束|1、ALTER TABLE [table_name] DROP constraint const_name,2、alter table ... modify/change 未对uniuqe删除|1、show index from t1;,2、数据校验：,插入违反值 --报错,插入null --不报错,3、DBA_CONSTRAINTS、DBA_CONS_COLUMNS,视图准确|
|  
|  
|  
|  
|
|  
|以上交叉覆盖单列和多列联合主键|  
|  
|
|  
|同一个表创建多个约束|1、同一列，几列创建多个unique， --拦截报错,2、同一列，几列同时创建主键和unique --报错|mysql创建多个unique不报错，但是是bug，不保持同步|
|  
|与其他约束同时使用|1、default ，已有数据情况下，新增一列有default 'a' 约束,同时含有主键约束,2、创建指定not null 与不指定not null 相同,3、创建时指定 null 不报错|  
|
|not null 约束|创建约束|列级：,create table xxx(  column_name xxx not null  )；,表级：,~~ALTER TABLE [table_name] ADD CONSTRAINT [constraint_name] not null; ~~,NOT NULL约束项只能作为行内约束被定义，不存在该场景,ALTER TABLE [table_name] MODIFY [column_name] [column_def] not null;,ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] not null;,  
|  
|
|  
|删除约束|1、ALTER TABLE [table_name] DROP constraint const_name,2、建表已经创建约束 not nul，执行，MODIFY 不指定not null 约束，默认删除,ALTER TABLE [table_name] MODIFY [column_name] [column_def] not null;,3、 建表已经创建约束 not nul，CHANGE 不指定not null 约束，默认删除,ALTER TABLE [table_name] CHANGE [old_column_name] [new_column_name] [column_def] not null;|  
|
|外键约束|创建约束，mysql创建约束时默认外键列创建索引，可选指定索引名。|create table 表时创建约束,1、  FOREIGN   后不带index_name,create table xxx(  column_name，FOREIGN KEY  reference_definition）,2、  FOREIGN   后带index_name,create table xxx(  column_name，FOREIGN KEY    index_name   (  *index_col_name*  ,...) reference_definition）,3、带”KEY”关键字定义外键，  FOREIGN   后不带index_name,create table xxx(  column_name，key index_name      (  *index_col_name*  ,...) ,FOREIGN KEY  reference_definition）,4、带”KEY”关键字定义外键，  FOREIGN   后不带index_name,create table xxx(  column_name，key index_name      (  *index_col_name*  ,...) ,FOREIGN KEY   index_name   (  *index_col_name*  ,...) reference_definition） --只有前面的KEY index_name      (  *index_col_name*  ,...)生效,5、带CONSTRAINT constraint_name,  FOREIGN   后不带index_name,create table xxx(  column_name，constraint constraint_name FOREIGN KEY  reference_definition）,6、带CONSTRAINT constraint_name,  FOREIGN   后带index_name,create table xxx(  column_name，constraint constraint_name FOREIGN KEY    index_name   (  *index_col_name*  ,...) reference_definition）,7、不带CONSTRAINT constraint_name,带”KEY”关键字定义外键,create table xxx(  column_name，KEY index_name      (  *index_col_name*  ,...) , FOREIGN KEY(  *index_col_name*  ,...) reference_definition）,8、带CONSTRAINT constraint_name,带”KEY”关键字定义外键,  FOREIGN   后带index_name,create table xxx(  column_name，KEY index_name      (  *index_col_name*  ,...) ,constraint constraint_name FOREIGN KEY    index_name   (  *index_col_name*  ,...) reference_definition）   --只有前面的KEY index_name      (  *index_col_name*  ,...)生效,  
|1、show index from t1;,2、数据校验：,插入违反值 --报错,插入null --不报错,3、DBA_CONSTRAINTS、DBA_CONS_COLUMNS,视图准确|
|  
|  
|9、不带  FOREIGN KEY 关键字，实际没创建外键,create table xxx(  column_name reference_definition  )；|yashan 有效，mysql无效,在MySQL中，这种写法只会被当作一个普通的列定义，而不是外键约束。这意味着尽管语法上看起来像是定义了外键约束，但实际上并不会对  id  列应用外键约束|
|  
|  
|alter table   表时创建约束,1、  ADD CONSTRAINT,ALTER TABLE [table_name] ADD CONSTRAINT   FOREIGN KEY(  *index_col_name*  ,...) reference_definition);,2、ADD CONSTRAINT 带index_name,ALTER TABLE [table_name] ADD CONSTRAINT FOREIGN KEY  index_name(  *index_col_name*  ,...) reference_definition);,3、add column  行内,ALTER TABLE [table_name] add column (column_name datetype reference_definition),4、add column 行外，+ foreign key(),ALTER TABLE [table_name] add column (column_name datetype，foreign key(  *index_col_name*  ) reference_definition),5、add column 行外，key index_name(  *index_col_name*  )+ foreign key() ,ALTER TABLE [table_name] add column (column_name datetype，key index_name(  *index_col_name*  ) ，foreign key(  *index_col_name*  ) reference_definition),6、add column 行外，foreign key()  + index_name(  *index_col_name*  ),ALTER TABLE [table_name] add column (column_name datetype, foreign key  index_name(  *index_col_name*  ) reference_definition),7、add column 行外，key index_name(  *index_col_name*  )+ foreign key() ,ALTER TABLE [table_name] add column (column_name datetype, key index_name(  *index_col_name*  ), foreign key  index_name(  *index_col_name*  ) reference_definition),  
|  
|
|  
|行内定义外键--mysql不支持|~~alter table inline 不支持，拦截~~,~~create table inline 不支持，拦截~~|  
|
|  
|级联删除| [ON DELETE {RESTRICT | CASCADE | SET NULL | NO ACTION}]|功能验证|
|  
|  
| [ON UPDATE {RESTRICT | CASCADE | SET NULL | NO ACTION}]|支持|
|  
|  
|MATCH full | partial | simple |语法兼容|
|  
|删除约束|alter table DROP FOREIGN KEY   *fk_symbol;*    
,ALTER TABLE [table_name] DROP constraint const_name;|  
|
|  
|  
|存在外键无法删除父表主键/unique|  
|
|check约束|功能|检查数值范围|支持|
|  
|  
|检查日期范围|支持|
|  
|  
|检查字符串长度|支持|
|  
|  
|检查是否为非空值|支持|
|  
|  
|检查是否为特定取值|支持|
|  
|  
|组合条件 CHECK|支持|
|  
|  
|使用内置函数,**字符串函数**,1. **数值函数**  ：
1. **字符串函数**  ：
1. **日期和时间函数**  ：
1. **逻辑运算**  ：
|支持。nysql支持的内值函数。,--后面迭代支持函数补测,  
|
|  
|  
|正则表达式|yashan支持|
|  
|语法，和崖山相同，只交叉覆盖部分|create table ,表级别,1、带  constraint   create table xxx(  column_name，constraint constraint_name check（expr）),2、不带constraint   create table xxx(column_name，check（expr）)  列级别,3、alter table add constrint constraint_name check（expr）|  
|
|  
|删除约束|alter table drop constrint   constraint_name；|  
|
|key|创建普通索引|create table xxx(column_name，key indx_nam（  *index_col_name,...*  ）),  
,create table xxx(column_name，index indx_nam（  *index_col_name,...*  ）)|1、创建索引成功,2、插入数据成功|
|  
|  
|分区表innodb引擎拦截外键|报错|
|公共场景|  
|using index,modify_constraint,disable constraint|不拦截|


  


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

# 5. 测试框架设计

- yasft


# 6. 测试环境说明

*单机*

# 7. 工作量评估

工作量：4  *人天*

计划测试完成时间：06/27

  [详细测试设计文档模板.doc](#)  

## Attachments:

[image2024-6-20_21-57-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODNhMWFkOWEzMzExZGM5NzkwIiwicmVmX2lkIjoiNjczOTZlODM3MjgyMDZlZmI5MmYyOGJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjczLCJleHAiOjE3ODI1MjQwNzN9.vPbPSz9xhE0FZZRlyYmprgsqRtgdRk7xt6km4yLQQss)

 (image/png)    


[冒烟用例-mysql兼容约束.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODRhMWFkOWEzMzExZGM5NzkxIiwicmVmX2lkIjoiNjczOTZlODM3MjgyMDZlZmI5MmYyOGJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjczLCJleHAiOjE3ODI1MjQwNzN9.iOaP7gHhXDHfeNugwgTrvLw0HRdPs3UJGixPAKdEVgc)

 (application/octet-stream)    


[mysql兼容约束ddl文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODQ4OTcwYzJhZjRmNTIxOTFmIiwicmVmX2lkIjoiNjczOTZlODM3MjgyMDZlZmI5MmYyOGJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjczLCJleHAiOjE3ODI1MjQwNzN9._k0UMJxjGcJeFZ4gT2T76ZOlUBUsCiIm2JVTk_N81_g)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计方案评审,与会人：张鹏飞、郑荃、陈瑞、林永毫、李子怡,评审时间：2024-05-21 10:00-10:40 评审地点：线上    
  会议主题：    
  评审纪要信息：    
  1、崖山支持但是mysql原本不支持的场景，不做拦截，兼容主要内容为mysql支持，但是崖山不支持场景  --包括disbale 、 modify 约束，创建主键/唯一键指定 using index，外键在列上定义,2、创建外键时在外键列创建index  --子怡确认代码是否做,3、  INFORMATION_SCHEMA视图还未做，show index from table_name也未做  --查询视图用yashan的dba视图查看,4、check约束测下，mysql的特有的表达式，以及mysql的独有内置函数作为表达式   --已补充,评审结论：通过,Posted by chenrui at 六月 24, 2024 15:10|
|---|
|  [](null)  ,1、  INFORMATION_SCHEMA转测后，  验证索引相关视图，包括key，index，主键，外键，唯一键方式创建的索引,2、mysql的Innodb表不支持在分区表创建外键，目前不这次，后期补测拦截,3、check约束后期sit补测内置函数,4、key 方式创建索引，在索引需求转测测试，目前只测试 key创建主键的方式,Posted by chenrui at 六月 28, 2024 10:33|
