Created by 李攀, last modified on 十二月 13, 2023

#   [1. 概述](https://conf.yasdb.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述支持指定schema收集统计信息的测设设计

sr链接：    [[YDBRD-22121] 高级包DBMS_STATS新增函数 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22121)  

开发设计文档：    [DBMS_STATS新增函数 - 郑翌恺 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133577702)  

  


# **2. 需求分析**

**2.1需求特性**

高级包DBMS_STATS新增函数

删除统计信息：    
  DELETE_TABLE_STATS    
  DELETE_SCHEMA_STATS    
  DELETE_INDEX_STATS    
    
  设置各个维度的选项的参数：    
  GET_PREFS    
  DELETE_SCHEMA_PREFS    
  DELETE_TABLE_PREFS    
    
  DELETE_COLUMN_STATS增加cascade_part, force参数

适配版本：单机、集群

  


2.2详细功能以及参数说明：

### 有default的选项可以被省略

### 2.1 DELETE_TABLE_STATS

|  `DBMS_STATS.DELETE_TABLE_STATS (`      
    `   `      `ownname          VARCHAR,`      
    `   `      `tabname          VARCHAR,`      
    `   `      `partname         VARCHAR  DEFAULT NULL,`      
    `   `      `cascade_parts    `      `BOOLEAN`         `DEFAULT TRUE,`      
    `   `      `cascade_columns  `      `BOOLEAN`         `DEFAULT TRUE,`      
    `   `      `cascade_indexes  `      `BOOLEAN`         `DEFAULT TRUE,`      
    `   `      `force            `      `BOOLEAN`         `DEFAULT FALSE);`  |
|:---|


  


  


|参数|说明|
|:---|:---|
|ownname|用户名。NULL则为当前用户|
|tabname|表名|
|partname|指定要删除统计信息的表分区的名称  ，,**如果该项已被指定，则删除对应分区的统计信息，不删除表的统计信息**,**如果表已分区且参数为NULL，则从全局表检索统计信息，和cascade_parts共同决定是否要删除分区**|
|cascade_parts|指定是否同时删除与表相关联的分区的统计信息。如果将 CASCADE_PARTS 参数设置为 true，则表示删除表及其所有分区的统计信息。如果设置为 false，则仅删除表本身的统计信息，而保留与该表关联的分区的统计信息。默认为TRUE。,**是否删除全部或指定分区的统计信息**|
|cascade_columns|指定是否同时删除与表相关联的所有列的统计信息，默认为TRUE,**调用DELETE_COLUMN_STATS实现，传参DELETE_COLUMN_STATS(user,table,partname,cascadeParts，force)**|
|cascade_indexes|指定是否同时删除与表相关联的所有索引的统计信息，默认为TRUE|
|force|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定,**表的统计信息上锁之后，如果用force=TRUE强制删除表的统计信息，下次收集统计信息前仍需要unlock**|


  


|partname\cascade_parts|true|false|
|:---|:---|:---|
|null|删除表和全部分区|删除表，不删除任何分区|
|not null|不删除表，删除指定分区||


### 2.2 DELETE_SCHEMA_STATS

|  `DBMS_STATS.DELETE_SCHEMA_STATS (`      
    `   `      `ownname          VARCHAR,`      
    `   `      `force            `      `BOOLEAN`         `DEFAULT FALSE);`  |
|:---|


|参数|说明|
|:---|:---|
|ownname|用户名。NULL则为当前用户|
|force|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定|


### 2.3 DELETE_INDEX_STATS

|  `DBMS_STATS.DELETE_INDEX_STATS (`      
    `   `      `ownname          VARCHAR,`      
    `   `      `indname          VARCHAR,`      
    `   `      `partname         VARCHAR  DEFAULT NULL,`      
    `   `      `cascade_parts    `      `BOOLEAN`         `DEFAULT TRUE,`      
    `   `      `force            `      `BOOLEAN`         `DEFAULT FALSE);`  |
|:---|


|参数|说明|
|:---|:---|
|ownname|用户名。NULL则为当前用户|
|indname|索引名|
|partname|指定要删除统计信息的表分区的名称  ，如果表已分区且参数为NULL，则从全局表检索统计信息|
|cascade_parts|指定是否同时删除与索引相关联的分区的统计信息。如果将 CASCADE_PARTS 参数设置为 true，则表示删除表及其所有分区的统计信息。如果设置为 false，则仅删除表本身的统计信息，而保留与该表关联的分区的统计信息。|
|force|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定|


### 2.4 DELETE_COLUMN_STATS

|  `DBMS_STATS.DELETE_COLUMN_STATS (`      
    `   `      `ownname          VARCHAR,`      
    `   `      `tabname          VARCHAR,`      
    `   `      `colname          VARCHAR,`      
    `   `      `partname         VARCHAR  DEFAULT NULL,`      
    `   `      `cascade_parts    `      `BOOLEAN`         `DEFAULT TRUE,`      
    `   `      `force            `      `BOOLEAN`         `DEFAULT FALSE);`  |
|:---|


|参数|说明|
|:---|:---|
|ownname|用户名。NULL则为当前用户|
|tabname|表名|
|colname|列名|
|type|删除类型（'ALL'：同时删除column统计信息和直方图，'HISTOGRAM'：只删除直方图）|
|partname|指定要删除统计信息的表分区的名称  ，如果表已分区且参数为NULL，则从全局表检索统计信息|
|cascade_parts（新增参数）|指定是否同时删除与索引相关联的分区的统计信息。如果将 CASCADE_PARTS 参数设置为 true，则表示删除表及其所有分区的统计信息。如果设置为 false，则仅删除表本身的统计信息，而保留与该表关联的分区的统计信息。|
|force（新增参数）|指示是否强制删除锁定的统计信息。当值为TRUE时，此过程将删除表统计信息，即使已锁定|


### 2.5 GET_PREFS

|  `DBMS_STATS.GET_PREFS (`      
    `   `      `pname     IN   VARCHAR,`      
    `   `      `ownname   IN   VARCHAR DEFAULT NULL,`      
    `   `      `tabname   IN   VARCHAR DEFAULT NULL)`      
    ` `      `RETURN VARCHAR2;`  |
|:---|


|参数|说明|
|:---|:---|
|pname|选项名|
|ownname|用户名，可忽略|
|tabname|表名，可忽略|


### 2.6 DELETE_TABLE_PREFS

|  `DBMS_STATS.DELETE_TABLE_PREFS (`      
    `    `      `ownname    IN  VARCHAR,`      
    `    `      `tabname    IN  VARCHAR,`      
    `    `      `pname      IN  VARCHAR);`  |
|:---|


|参数|说明|
|:---|:---|
|ownname|用户名|
|tabname|表名|
|pname|选项名，目前已实现的选项及默认值：,- CASADE：FALSE。  表示在收集表的统计信息的时候，是否级联收集索引的统计信息
- DEGREE：1。  表示收集统计信息的并行度
- ESTIMATE_PERCENT：1。  表示采样率，范围是0.000 001～100。  这个参数主要是用于CBO估算表的总行数，采样率越高，CBO估算的表行数越接近于真实值，执行计划越能走正确。
- GRANULARITY：GLOBAL。  表示收集统计信息的粒度，该选项只对分区表生效，默认为 AUTO，表示让Oracle根据表的分区类型自己判断如何收集分区表的统计信息。
- METHOD_OPT：FOR ALL COLUMNS SIZE AUTO。  用于控制收集直方图策略。  直方图简就是数据库了解表中某列的数据分布，从而更正确的走更优的执行计划
- STALE_PERCENT：0.1。  用于确定阈值级别，在该阈值级别，对象被认为具有过时的统计信息。该值是自上次统计信息收集以来已修改的行的百分比。
- OPTIONS：GATHER.确定GATHER_TABLE_STATS过程中使用的选项参数。
|


### 2.7 DELETE_SCHEMA_PREFS

|  `DBMS_STATS.DELETE_SCHEMA_PREFS (`      
    `    `      `ownname   IN   VARCHAR2,`      
    `    `      `pname     IN   VARCHAR2);`  |
|:---|


|参数|说明|
|:---|:---|
|ownname|用户名|
|pname|选项名|


# **3. 测试**  **设计方法**   

1.主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

2.对比不同并行度的执行时间长短

3.结果的准确性验证 

  


|专项|是否涉及,  
|
|:---|:---|
|CT|是|
|长稳|  
|
|一致性|  
|
|安全|是|
|HA|是|
|压力|  
|
|性能|是|
|资料|是|


# 4.   **详细测试设计**

**4.1 函数接口入参测试**

|存储过程|参数|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|:---|
|  
    
    
    
    
    
    
    
    
    
    
    
    
    
  DELETE_TABLE_STATS|ownname（用户名）|类型|字符串常量：‘regress’|  
|其他类型变量：int，tinyint，smallint，bigint，number，float，double，time，date，timestamp，interval，blob|  
|
||||  
|  
|  
|  
|
||||字符串变量：varchar，char，varchar2，clob|  
|  
|  
|
|||取值|存在的对象用户名|  
|不存在的ownname|  
|
||||长度：[1,64]|  
|0,65位|  
|
||||null|默认当前用户|特殊值：sysdate，空值报错|  
|
||tabname（表名）|类型|字符串常量：|  
|  
|  
|
||||字符串变量：varchar，char，varchar2，clob|  
|  
|  
|
|||取值|存在的ownname下的表名|  
|ownname下不存在的表,null,空值|  
|
||||长度：[1,64]|  
|0,>64（  65位）|  
|
||cascade_parts|  
|  
|  
|  
|  
|
||  
|  
|  
|  
|  
|  
|
||  
|  
|  
|  
|  
|  
|
||  
|  
|  
|  
|  
|  
|
||cascade_columns|  
|  
|  
|  
|  
|
||  
|  
|  
|  
|  
|  
|
||cascade_indexes|  
|  
|  
|  
|  
|
||force|  
|  
|  
|  
|  
|
|DELETE_SCHEMA_STATS|ownname（用户名）    
    
    
    
|类型|字符串常量：‘regress’|  
|其他类型变量：int，tinyint，smallint，bigint，number，float，double，time，date，timestamp，interval，blob|  
|
|  
||  
|字符串变量：varchar，char，varchar2，clob|  
|  
|  
|
|  
||取值|存在的对象用户名|  
|不存在的ownname|  
|
|  
||  
|长度：[1,64]|  
|0,65位|  
|
|  
||  
|null|默认当前用户|默认当前用户  特殊值：sysdate，空值报错|  
|
|  
|force|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|
|DELETE_INDEX_STATS|ownname（用户名|类型|字符串常量：‘regress’|  
|其他类型变量：int，tinyint，smallint，bigint，number，float，double，time，date，timestamp，interval，blob|  
|
|  
|  
|  
|字符串变量：varchar，char，varchar2，clob|  
|  
|  
|
|  
|  
|取值|存在的对象用户名|  
|不存在的ownname|  
|
|  
|  
|  
|长度：[1,64]|  
|0,65位|  
|
|  
|  
|  
|null|默认当前用户|  
|  
|
|  
|indname|类型+取值|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|
|  
|partname|类型+取值|字符串常量+变量（以下7种枚举值）,1.STALE_PERCENT,2.CASCADE,3.DEGREE,4.ESTIMATE_PERCENT,5.GRANULARITY,6.METHOD_OPT,7.OPTION不支持设置|  
|其他字符串,null,空值,数字类,非字符串类型|  
|
|  
|cascade_parts|类型+取值|true,false,null:使用默认值？|  
|0,1,'true',表达式，布尔表达式,其他非布尔类型|  
|
|  
|force|类型+取值|true,false|  
|0,1,'true',表达式，布尔表达式,其他非布尔类型|  
|
|DELETE_COLUMN_STATS|ownname|类型+取值|  
|之前已经测过|  
|  
|
|  
|tabname|类型+取值|  
|之前已经测过|  
|  
|
|  
|colname|类型+取值|  
|之前已经测过|  
|  
|
|  
|partname|类型+取值|  
|之前已经测过|  
|  
|
|  
|cascade_parts（新增参数）|类型+取值|true,false,null:使用默认值？|需要加用例|0,1,'true',表达式，布尔表达式,其他非布尔类型|  
|
|  
|force（新增参数）|类型+取值|true,false,null:使用默认值？|需要加用例|0,1,'true',表达式，布尔表达式,其他非布尔类型|  
|
|  
|  
|  
|  
|  
|  
|  
|
|GET_PREFS|pname|类型+取值|  
|  
|  
|  
|
|  
|ownname|类型+取值|  
|  
|  
|  
|
|  
|tabname|类型+取值|  
|  
|  
|  
|
|DELETE_TABLE_PREFS|ownname|类型+取值|  
|  
|  
|  
|
|  
|tabname|类型+取值|  
|  
|  
|  
|
|  
|pname|类型+取值|  
|  
|  
|  
|
|DELETE_SCHEMA_PREFS|ownname|类型+取值|  
|  
|  
|  
|
|  
|pname|类型+取值|- CASADE：FALSE。  表示在收集表的统计信息的时候，是否级联收集索引的统计信息
- DEGREE：1。  表示收集统计信息的并行度
- ESTIMATE_PERCENT：1。  表示采样率，范围是0.000 001～100。  这个参数主要是用于CBO估算表的总行数，采样率越高，CBO估算的表行数越接近于真实值，执行计划越能走正确。
- GRANULARITY：GLOBAL。  表示收集统计信息的粒度，该选项只对分区表生效，默认为 AUTO，表示让Oracle根据表的分区类型自己判断如何收集分区表的统计信息。
- METHOD_OPT：FOR ALL COLUMNS SIZE AUTO。  用于控制收集直方图策略。  直方图简就是数据库了解表中某列的数据分布，从而更正确的走更优的执行计划
- STALE_PERCENT：0.1。  用于确定阈值级别，在该阈值级别，对象被认为具有过时的统计信息。该值是自上次统计信息收集以来已修改的行的百分比。
- OPTIONS：GATHER.确定GATHER_TABLE_STATS过程中使用的选项参数。
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|  
|


#### 4.2 场景细分

|测试项|有效等价类|预期|备注|  
|
|:---|:---|:---|:---|:---|
|DELETE_TABLE_STATS|表类型：heap,tac,lsc|  
|查询ALL、DBA、USER）_TAB_STAT视图，验证设置后选项的结果|  
|
|  
|分区表：range、list、hash、二级分区表,临时表,私有临时表,系统表,  
|  
|  
|  
|
|DELETE_SCHEMA_STATS|  
|  
|  
|  
|
|DELETE_INDEX_STATS|索引类型覆盖：  单列索引,复合索引,分区索引,唯一索引,函数索引,反向索引,索引属性：  usable unusable,visable,invisable,有外键约束|  
|  
|  
|
|DELETE_COLUMN_STATS|列数据类型覆盖|  
|  
|  
|
|  
|直方图类型覆盖|  
|  
|  
|
|GET_PREFS|  
|  
|  
|  
|
|DELETE_TABLE_PREFS|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|DELETE_SCHEMA_PREFS|  
|  
|  
|  
|
|权限验证|  
|  
|  
|  
|
|集群部署验证|验证不同实例删除后信息是否同步|每一个delete函数都要验证|分布式添加拦截用例|  
|
|规格|单个schema中表的个数，索引的个数,单个表中列的个数,单个表索引的个数|  
|  
|  
|


  


4.3 关键场景覆盖

|测试项|测试步骤|预期|备注|
|:---|:---|:---|:---|
|DELETE_TABLE_STATS|1.创建表tb ,插入数据，收集统计信息,2.查视图  dba_tab_statistics：,3 .执行一条sql语句，查看explain里面的rows,4.删除表的统计信息，  DELETE_TABLE_STATS,5.查视图dba_tab_statistics：,6.再次执行一条sql语句，查看explain里面的rows,7.再次执行一次删除语句,8.重新收集一次统计信息,  
,  
|1.成功,2.,3.rows和统计信息收集的rows一样,4.删除成功,5.条数为0，没有数据,6.rows恢复为默认选项100000,7.删除成功,8.收集成功，查视图  dba_tab_statistics有数据|  `select table_name,numer_rows, sample_size from dba_tab_statistics where table_name = `      `'TB'`      `;`  |
|  
|删除前没有统计信息|成功|  
|
|  
|删除前统计信息失效|删除成功|  
|
|  
|锁定的时候 force是true和fasle|  
|报错：统计信息是锁定状态|
|  
|删除统计信息后  改变表的元数据 DDL|成功|  
|
|  
|删除统计信息后  改变表的元数据 DML|成功|  
|
|  
|删了统计信息，开了动态采样的时候，查看执行计划|rows不会变,视图查不到数据|  
|
|DELETE_SCHEMA_STATS|1.创建用户use,赋予analyze any权限,2.创建tac,lsc ,heap 分区表，各种索引对象，各插入1000条数据,3.先gather_schema_stats,4.查看  dba_tab_statistics、dba_idx_statistics、,dba_tab_col_statistics、,dba_part_col_statistcs,dba_HISTOGRAMS视图,5.再执行DELETE_SCHEMA_STATS后，,查看  dba_tab_statistics、dba_ind_statistics、,dba_tab_col_statistics、,dba_part_col_statistcs,dba_HISTOGRAMS视图,6.执行sql语句查看执行计划中表、索引的rows,  
,  
|5 视图统计信息值是null|force为true和fasle都验证,锁定某张表  某个索引 ，force是false不被锁定的不会被影响 可以正常删除,指定forece为true的时候，锁定表的统计信息会被删除，但锁的状态不变，再次收集还会报错,  
,schema lock force是false的情况  --预期会报错|
|DELETE_INDEX_STATS|1.创建分区表tb,创建分区索引_1,插入100条数据,2.执行先执行一次删除索引的统计信息,3.使用gater_index_stats收集索引的统计信息，,partname不指定，  cascade_parts为false,4.查询  dba_ind_statistics视图,5.执行删除操作 exec   DELETE_INDEX_STATS..,6.查询dba_ind_statistics视图,7.explain 语句查询rows,  
,  
|  
|  `select INDEX_NAME，PARTITION_NAME，SUBPARTITION_NAME ，NUM_ROWS，SAMPLE_SIZE ，DISTINCT_KEYS from dba_ind_statistics where  = `      `''`      `;`  ,  
,  
,  `select * from tb where c1>1;`  |
|  
|删除索引统计信息后改变索引列类型,改变后insert 数据|  
|  
|
|  
|删除索引统计信息后rebuild索引|  
|  
|
|  
|删除索引统计信息后改变索引属性|  
|  
|
|  
|收集统计信息改变索引属性后再删除索引统计信息|  
|  
|
|  
|force  lock表和索引 、schema|  
|force为true和fasle都验证,锁定某张表  某个索引 ，force是false不被锁定的不会被影响 可以正常删除,指定forece为true的时候，锁定表的统计信息会被删除，但锁的状态不变，再次收集还会报错,  
, lock force是false的情况  --预期会报错|
|DELETE_COLUMN_STATS|1.创建分区表tb,range分区表_1,插入100条数据,2.收集表的统计信息,3.查询  dba_tab_col_statistics,dba_tab_col_statistics、,4.删除该列统计信息DELETE_COLUMN_STATS（  partname指定一个分区，cascade_parts为false  ）,5.查看  dba_tab_col_statistics,dba_tab_col_statistics、视图，查看对应分区的统计信息,6.explain 语句查询rows,7.查看对应分区的统计信息,  
|只删除指定分区的列的统计信息和直方图，不会删除其他分区的直方图和列的统计信息|  
|
|  
|.删除列统计信息DELETE_COLUMN_STATS（  partname指定一个分区，cascade_parts为true  ）|删掉的是指定分区的统计信息|  
|
|  
|锁定某个分区后，  force为false  删除所有分区列的统计信息|被锁定的分区列统计信息不会呗删掉|  
|
|  
|锁定某个分区后，  force为True,  删除所有分区列的统计信息|被锁定的分区列统计信息也会呗删掉|  
|
|GET_PREFS|通过set_prefs设置默认值后get,  
|  
|  
|
|  
|查询时忽略  ownname|报错|  
|
|  
|查询时忽略  tabname|报错|  
|
|DELETE_TABLE_PREFS|先设置选项，get查看选项,删除选项的设置，get查看选项值,再设置查看,  
|  
|  
|
|### DELETE_SCHEMA_PREFS|先设置选项，get查看选项,删除选项的设置，get查看选项值,再设置查看,  
|  
|  
|
|性能|表数量 5W ,列数量 50W,索引约束数量 10W,分区数 10W|  
|  
|
|并发|删除统计信息 + 并发DML,同对象统计信息删除并发,不同对象并发,gather和delelte一起并发,删除和上锁一起并发，一边锁定一边删除,不同schema下并发,RAC多实例并发|  
|  
|
|HA|删除统计信息 主备同步,主备切换后，信息保持一致|  
|  
|
|  
|  
|  
|  
|
|  
|  
|  
|  
|


  


权限验证：

|统计信息设置权限|DELETE_TABLE_STATS,DELETE_TABLE_PREFS,DELETE_COLUMN_STATS,  
|表的owner，无  ANALYZE ANY，无dba权限|有权限，可以设置|
|:---|:---|:---|:---|
|||拥有  ANALYZE ANY权限的其他用户|有权限，可以设置|
|||dba用户|有权限，可以设置|
|||sys用户|有权限，可以设置|
|||无ANALYZE ANY，无dba权限，不是表的owner|无权限设置，提示没有权限|
||DELETE_SCHEMA_STATS,DELETE_SCHEMA_PREFS|schema的owner，无ANALYZE ANY，无dba权限|有权限，可以设置|
|||拥有  ANALYZE ANY权限的其他用户|有权限，可以设置，不能设置sys用户|
|||dba用户|有权限，可以设置，不能设置sys用户|
|||sys用户|有权限，可以设置，可以设置所有的用户|
|||无  无ANALYZE ANY，无dba权限，不是schema的owner|无权限设置，提示没有权限|
||DELETE_INDEX_STATS|索引的owner，无  ANALYZE ANY，无dba权限|有权限，可以设置|
|||拥有  ANALYZE ANY权限的用户|有权限，可以设置|
|||dba用户|有权限，可以设置|
|||sys用户|有权限，可以设置|
|||无ANALYZE ANY，无dba权限的用户|无权限设置，提示没有权限|
||GET_PREFS|拥有  ANALYZE ANY权限的用户|有权限，可以设置|
|||dba用户|有权限，可以设置|
|||sys用户|有权限，可以设置|
|||无ANALYZE ANY，无dba权限的用户|无权限设置，提示没有权限|


# 5.   **测试用例**

  


# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 8. 工作量评估

工作量：20  *人天*

计划测试完成时间

  


会议即纪要：

要重点测试一下状态为锁定  force为 true状态