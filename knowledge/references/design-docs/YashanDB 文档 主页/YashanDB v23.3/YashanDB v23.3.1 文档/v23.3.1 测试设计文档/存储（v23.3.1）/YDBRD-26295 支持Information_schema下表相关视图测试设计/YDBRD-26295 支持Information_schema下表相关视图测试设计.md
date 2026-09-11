Created by 刘大境, last modified by  郑荃 on 八月 22, 2024

# 1. 概述

在原有的mysql框架之上，适配相关的系统视图。记录MySQL中的元数据信息。information_schema是一个虚拟数据库，物理上并不存在相关的目录和文件。

IR：    [YASHAN-925 【mysql兼容】支持特定的视图&系统表](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ed?%20#YASHAN-925%20%20%E3%80%90mysql%E5%85%BC%E5%AE%B9%E3%80%91%E6%94%AF%E6%8C%81%E7%89%B9%E5%AE%9A%E7%9A%84%E8%A7%86%E5%9B%BE&%E7%B3%BB%E7%BB%9F%E8%A1%A8)  

SR:     [YDBRD-26295 支持Information_schema下表相关视图](https://pingcode.yasdb.com/pjm/items/66192b18fd997db58ad8a611)  

开发文档：    [支持Information_schema下表相关视图设计文档 - 李子怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152998632)  

# 2. 需求分析

1. INFORMATION_SCHEMA.COLUMNS ：  存储表中所有列的信息，包括列名称、数据类型、是否允许为空、默认值等    
  2. INFORMATION_SCHEMA.PARTITIONS ：  存储数据库中分区表的信息。    
  3. INFORMATION_SCHEMA.STATISTICS ：  存储表的索引和统计信息，包括索引名称、索引类型、列名称、唯一性等。    
  4. INFORMATION_SCHEMA.TABLES ：  存储数据库中所有表的信息，包括表名称、所属模式、表类型 如基本表、视图等    
  5. INFORMATION_SCHEMA.VIEWS ：  存储数据库中所有视图的信息

# 3.规格约束

  


功能限制：mysql模式暂不支持创建分区表，(PARTITIONS表的正确性，可以通过yashan模式创建分区表后验证）

## 4 .测试设计方法

测试关注点：

1.针对每个视图字段定义，使其值发生变更进行查询

2.测试过程中需要对比MYSQL进行测试

3.关注COLUMNS PARTITIONS STATISTICS TABLES VIEWS  视图结构与MYSQL区别做对比

4.字段定义为NULL，本次不做重点测试

## 4.1.1专项覆盖

|专项|是否涉及|说明|
|---|---|---|
|并发|涉及|  
|
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

|编号|测试场景|输入条件|有效等价类|备注|
|---|---|---|---|---|
|1|INFORMATION_SCHEMA.COLUMNS|TABLE_CATALOG     列所在表的目录名|1.当前库默认查询|def|
|2|  
|TABLE_SCHEMA    列所在表的模式名|1.创建大写自定义用户，创建MYSQL属性表时 指定自定义用户schema，查询select TABLE_SCHEMA from INFORMATION_SCHEMA.COLUMNS where table_name='table_name';字段为自定义用户名称,2.创建小写自定义用户，查询|  
|
|3|  
|TABLE_NAME     列所在表的名称|1.特殊字符/表情包做为  TABLE_NAME  ，查询,2.  双引号和反引号括起做为TABLE_NAME，查询,3.大小写做为TABLE_NAME，查询,4.table_name长度64位,5.rename table_name，查询|  
|
|4|  
|COLUMN_NAME   列的名称,  
|1.特殊字符/表情包做为column_name，查询,2.  单引号和反引号括起做为column_name，查询,3.大小写做为column_name，查询,4.add/drop列，查询,5.COLUMN_NAME长度64位,6.   alter table change old_column_name new_column_name old_datatype |  
|
|5|  
|ORDINAL_POSITION     列在表中的位置,COLUMN_DEFAULT     列的默认值|1.  add/drop单列，查询是否自增或者自减ID,2. add/drop多列，查询是否自增或者自减ID,3、  drop 列后再add 一列，新增的列的位置（比如说drop 第3列后再add 第3列，新增的列位置是3，还是4？）|MYSQL COLUMN_DEFAULT字段为NULL,MYSQL不会自动排序，需要order by排序|
|6|  
|IS_NULLABLE      列是否允许为空('YES' or 'NO')|1. 创建多列，NULL，NOT NULL，DEFAULT，不指定
1. 修改列为NULL
1. 修改列NOT NULL
|允许为空为YES,需要对比MYSQL表现|
|7|  
|DATA_TYPE     列的数据类型|1. 覆盖MYSQL支持的所有数据类型
1. alter table change old_column_name new_column_name new_datatype 
|  
|
|8|  
|CHARACTER_MAXIMUM_LENGTH     ,列的最大长度，仅适用于字符类型的列(  对于字符串列，以字符为单位的最大长度  )|1.创建 表非字符类型，查询为NULL,2.创建 表字符类型，查询显示字符长度,3. 字符类型修改为非字符类型，查询为NULL      (通过alter table change来修改),4. 非字符类型修改为字符类型，查询显示字符长度,5.  从varchar(50) 改为varchar(16000)查询显示字符长度,6. 从 varchar(16000)改为varchar(50)查询显示字符长度,7、  覆盖clob、blob(longtext)|  
|
|9|  
|CHARACTER_OCTET_LENGTH    字符列中存储的字符所占的字节数|1.创建 表非字符类型，查询为NULL,2.创建 表字符类型，查询显示字符长度,3. 字符类型修改为非字符类型，查询为NULL      (通过alter table change来修改),4. 非字符类型修改为字符类型，查询显示字符长度,5.  从varchar(50) 改为varchar(16000)查询显示字符长度,6. 从 varchar(16000)改为varchar(50)查询显示字符长度,7.覆盖MYSQL支持的字符类型 CHAR  VARCHAR ,8、  覆盖clob、blob(longtext)|  
|
|10|  
|NUMERIC_PRECISION      数字列中允许的最大位数|1.覆盖常见数值型 INT、  NUMBER（指定不同位数）,2.非数值类型 展示为NULL|  
|
|11|  
|NUMERIC_SCALE    数值数据类型的小数部分的位数|1.覆盖数值型 INT、  NUMBER(指定小数位数不同),2.非数值类型 展示为NULL|  
|
|12|  
|DATETIME_PRECISION      日期时间数据类型的小数部分的位数|1.指定非时间数据类型,2.指定时间数据类型   （DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND）|  
|
|13|  
|CHARACTER_SET_NAME     字符集名称,COLLATION_NAME   排序规则名称|1.不指定列character set ,1.不指定列collation|为NULL在资料中解释|
|14|  
|COLUMN_TYPE       列数据类型|1. 覆盖MYSQL支持的所有数据类型
1. alter table change old_column_name new_column_name new_datatype   
|DATA_TYPE和COLUMN_TYPE都是列数据类型，对比MYSQL2个的字段差异|
|15|  
|COLUMN_KEY         列是否为表的主键或唯一索引的一部分|1.创建表时指定字符类型为主键/唯一键,2.创建表时指定非字符类型为主键/唯一键|  
|
|16|  
|EXTRA    列的附加属性,PRIVILEGES  列上拥有的权限,GENERATION_EXPRESSION   存储生成列的计算表达式|/|设为NULL，未实现不做重点观测，通过上面测试点覆盖查询即可|
|17|  
|COLUMN_COMMENT     列的注释或描述|1.注释特殊字符,2.列注释边界值1024,3.空字符串,4.列注释边界值0|  
|
|18|INFORMATION_SCHEMA.PARTITIONS（后续有create table分区表SR专门测试该视图,本次SR不涉及)|TABLE_CATALOG   表所属的目录名|YASHAN模式下创建分区表，切换MYSQL模式 查询|def|
|19|  
|TABLE_SCHEMA    表所属的数据库名|1.创建大写自定义用户，创建分区表时指定用户schema查询1. 2.创建小写自定义用户，  创建分区表时指定用户schema查询
|  
|
|20|  
|TABLE_NAME     表的名称|1.特殊字符/表情包做为  TABLE_NAME  ，查询,2.双引号  做为TABLE_NAME，查询,3.rename table_name|  
|
|21|  
|PARTITION_NAME      分区的名称,SUBPARTITION_NAME     子分区的名称|1.特殊字符/表情包做为  分区  _name，查询,2.大小写做为分区_name，查询,3.add drop 1 2级分区|  
|
|22|  
|PARTITION_ORDINAL_POSITION    分区的位置,SUBPARTITION_ORDINAL_POSITION  子分区的位置|1.创建1、2级分区表,2.add drop 1 2级分区,  
|  
|
|23|  
|PARTITION_METHOD    分区的方法,SUBPARTITION_METHOD  子分区的方法|1.覆盖YASHAN支持1级分区类型 HASH/LIST/  RANGE/  interval,2.覆盖YASHAN支持2分区类型组合 HASH-HASH/HASH-LIST/HASH-RANGE,RANGE-HASH/RANGE-LIST/RANGE-RANGE,LIST-HASH/LIST-RANGE/LIST-LIST|  
|
|24|  
|PARTITION_EXPRESSION   分区的表达式,SUBPARTITION_EXPRESSION    子分区的表达式,PARTITION_DESCRIPTION  分区的描述,DATA_LENGTH    表中每个分区的数据长度,MAX_DATA_LENGTH    表中每个分区的最大数据长度,INDEX_LENGTH    表中每个分区的索引长度,CHECKSUM  分区的校验和值,PARTITION_COMMENT  分区的注释,NODEGROUP  节点组|/|设为NULL，未实现不做重点观测，通过上面测试点覆盖查询即可|
|25|  
|TABLE_ROWS     表中每个分区的行数|1.单个分区做insert /update/ delete/truncate  查询分区行数变化|  
|
|26|  
|AVG_ROW_LENGTH   表中每个分区的平均行长度    
|1.单个分区做insert /update/ delete/truncate  查询|存在平均长度是小数的情况是四舍五入么？,比如一行3字节，1行4字节|
|27|  
|DATA_FREE   表中每个分区的未使用空间    
|1.每个分区 都指定不同表空间  做DML ,2.对单个/多个分区做DML操作 查询|  
|
|28|  
|CREATE_TIME     分区的创建时间|1.add 分区/子分区,2.正常创建分区表  查询|  
|
|29|  
|UPDATE_TIME   分区的最近更新时间|1. add/DROP单个分区/子分区数据
1. add/DROP多个分区/子分区数据
|  
|
|30|  
|CHECK_TIME      分区的检查时间|1.统计信息收集的时间|  
|
|31|  
|TABLESPACE_NAME     表空间名称|1. 指定内置表空间  SYSTEM
1. 指定加密
1. rename tablespace_name
|  
|
|32|INFORMATION_SCHEMA.STATISTICS|TABLE_CATALOG    表所属的目录名称|1.默认库，创建MYSQL属性表，查询|def|
|33|  
|TABLE_SCHEMA      表所属的目录名称|1.索引指定SCHEMA,2.索引不指定schema|  
|
|34|  
|TABLE_NAME     表的名称|1.rename  table_name 查询,2.默认创建表 查询|  
|
|35|  
|NON_UNIQUE    索引是否非唯一(0不能包含重复项，1可以包含重复项)|1.自定义索引默认查询,2.查询内置索引，所属数据库,3.创建唯一索引、非唯一索引,4.创建非唯一索引，修改为唯一索引,5.非主键索引，修改为主键索引|  
|
|36|  
|INDEX_SCHEMA    索引所属的数据库名称|1.自定义索引默认查询,2.查询内置索引，所属数据库,3.表和索引不在一个shema下|  
|
|37|  
|INDEX_NAME   索引的名称（PRIMARY/index_name)|1.rename index_name,2.创建索引默认查询|  
|
|38|  
|SEQ_IN_INDEX    索引列的顺序（从1开始）|1.根据表名条件过滤，查询出现两种索引，一种是系统索引  一种是自建索引,2.根据索引名条件过滤，查询索引,3.索引列指定单列/多列|  
|
|39|  
|COLUMN_NAME    索引列的名称|1.alter table change变更索引列名称,2.默认建表，指定索引列名称 查询|  
|
|40|  
|COLLATION    索引列的排序规则（'A' 升序，‘D‘ 降序，NULL 未排序）|1.指定索引列升序 ,2.指定索引列降序,3.不指定索引排序 |  
|
|41|  
|CARDINALITY    索引列的基数（索引中唯一值数目的估计值）|1.自定义索引默认查询,2.查询内置索引|  
|
|42|  
|SUB_PART    索引前缀（列部分被编入索引,被编入索引字符的数目， 整列为索引null）,PACKED   密钥的打包方式,NULLABLE  索引列是否包含空值（null包含，‘’不包含）,COMMENT  注释,INDEX_COMMENT  索引的注释|1.针对  NULLABLE字段  索引列不包含空值|设为NULL，未实现不做重点观测，通过上面测试点覆盖查询即可|
|43|  
|INDEX_TYPE    索引类型     (     BTREE  ,     FULLTEXT  ,     HASH  ,     RTREE  )    
|1.创建索引，覆盖BTREE,HASH,RTREE,FULLTEXT数据类型,2.YASHAN模式下建表、索引覆盖现有支持索引类型：唯一索引、列式索引、函数索引、反向索引、分区索引、RTREE索引|备注：  (     BTREE  ,     FULLTEXT  ,     HASH  ,     RTREE  )类型只覆盖btree，其它类型暂时无法覆盖，待MYSQL支持索引SR 进行补测|
|44|INFORMATION_SCHEMA.TABLES|TABLE_CATALOG    表所属的数据库名称|1.默认查询当前库|  
|
|45|  
|TABLE_SCHEMA   表所属的模式名称|1.建表指定schema,2.建表不指定schenma|  
|
|46|  
|TABLE_NAME  表名称|1.rename table_name|  
|
|47|  
|TABLE_TYPE  表类型(BASE TABLE, VIEW, SYSTEM VIEW)|1.创建表覆盖MYSQL表类型,2.使用YASHAN模式创建HEAP/LSC/TAC表 ，切换MYSQL模式查询表类型|  
|
|48|  
|ENGINE 引擎,VERSION    表的版本号,DATA_LENGTH    表中数据的总长度(聚集索引所占的空间),MAX_DATA_LENGTH    表中数据的最大长度,INDEX_LENGTH   表中所有索引的总长度(二级索引所占的空间),CHECK_TIME  表最后一次被检查的时间,TABLE_COLLATION 表使用的字符集和校对规则,CHECKSUM 表的校验和,AUTO_INCREMENT   表中下一个自动增量值的预期值,DATA_FREE  表中未分配给任何对象的空间(已分配但是未使用的字节数)|/|设为NULL，未实现不做重点观测，通过上面测试点覆盖查询即可|
|49|  
|ROW_FORMAT    表使用的行格式(fixed/dynamic)|1.指定  COMPACT,2.不指定|  
|
|50|  
|TABLE_ROWS    表中的行数|1. 对比select count(*)行数是否一致
1. 表中无数据
|table_rows=dba_tables视图里num_rows字段，与MYSQL实现不一样|
|51|  
|AVG_ROW_LENGTH     每行的平均长度|1.表中无数据,2.表中有数据|  
|
|52|  
|CREATE_TIME    表创建的时间|1.默认创建|  
|
|53|  
|UPDATE_TIME    表更新的时间|1.alter table/drop table  查询|  
|
|54|  
|CREATE_OPTIONS   额外的选项或属性（是否分区、加密）|1.普通表，不带/带加密表空间,2.分区表，不带/带加密表空间|表级加密选项/分区表功能暂未支持|
|55|  
|TABLE_COMMENT    表指定注释或描述|1.不指定表注释，例如为"" ,2.指定表注释表情包、特殊字符,3.表注释边界值2048,4.空字符串|  
|
|56|INFORMATION_SCHEMA.VIEWS|TABLE_CATALOG    视图所属的数据库名|1.默认库上 建视图，查询|  
|
|57|  
|TABLE_SCHEMA    视图所在的模式（database）名|1. 自定义用户，创建视图，指定schema
|  
|
|58|  
|TABLE_NAME    视图的名称|1..创建基础表 插入数据，创建视图|  
|
|59|  
|VIEW_DEFINITION    视图的定义 SQL 语句|1..创建基础表 插入数据，创建视图，查询,2..修改视图定义SQL语句，查询|  
|
|60|  
|CHECK_OPTION    视图的检查选项，包括     NONE  、  LOCAL     和     CASCADED|  
,1.创建基础表 插入数据，创建视图 指定/不指定检查选项为  NONE,  
|备注：当前只可为  NONE|
|61|  
|IS_UPDATABLE    视图是否可更新的标志，值为     YES     或     NO|1.创建视图，检查默认值|备注：当前只可为NO，YES功能尚未支持|
|62|  
|DEFINER     视图的创建者|1.默认当前用户创建|备注：投影`DEFINER`需要带反引号，区别关键字|
|63|  
|SECURITY_TYPE       视图的安全类型，包括     DEFINER     和     INVOKER|1.创建视图，检查默认值  （MYSQL默认值 DEFINER为0）|对应MYSQL.STORED_OBJECT_OPTIONS$中的,SECURITY_TYPE_ID，0 表示 DEFINER，1表示INVOKER,    YASHAN: NONE,备注：INVOKER字段功能暂未支持，无法观测|
|64|  
|CHARACTER_SET_CLIENT      客户端连接时使用的字符集编码|1.不指定character set|  
|
|65|  
|COLLATION_CONNECTION     客户端连接时使用的字符集排序规则|1.不指定COLLATION|  
|
|66|desc|INFORMATION_SCHEMA.COLUMNS,INFORMATION_SCHEMA.PARTITIONS,INFORMATION_SCHEMA.STATISTICS,INFORMATION_SCHEMA.TABLES,INFORMATION_SCHEMA.VIEWS,大小写混合|1.查询5个视图表结构，并且对比MYSQL 五个视图 （重点比对数据类型和字段名）|  
|
|67|拦截场景|对5个视图 ,alter视图拦截,dml拦截,同名对象拦截,drop 视图拦截|  
|  
|
|68|并发场景|INFORMATION_SCHEMA.COLUMNS,INFORMATION_SCHEMA.PARTITIONS,INFORMATION_SCHEMA.STATISTICS,INFORMATION_SCHEMA.TABLES,INFORMATION_SCHEMA.VIEWS|1.  前置条件：普通表、分区表、视图、索引
1. 并发过程：DDL+DML+查询组合、 drop view/table/index +查询
|  
|


# 5. 文本用例

  


# 6. 测试框架设计

本次测试采用yasft测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[YDBRD-26295 支持Information_schema下表相关视图.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODY4OTcwYzJhZjRmNTIxOTI5IiwicmVmX2lkIjoiNjczOTZlODU1OTNmOTljOWZmMjM4NWQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjgwLCJleHAiOjE3ODI1MjQwODB9.e36K84jb3j8FpdCWiqxeRUf_PZq12WxHDzIn4TIs5ZE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试纪要：    
  1.INFORMATION_SCHEMA.PARTITIONS 暂时不测，后续有专门SR mysql create table支持分区表SR 看护,2.INFORMATION_SCHEMA.COLUMNS 视图 ordinal_psition字段 与MYSQL 自增序列规则有差异，MYSQL是补齐序列 我们是不补齐被删除的序列,3.视图字段值定义设为NULL可以不做重点看护，简单看护即可,4.补充视图DDL/DML拦截测试点,Posted by liudajing at 七月 01, 2024 16:53|
|---|
