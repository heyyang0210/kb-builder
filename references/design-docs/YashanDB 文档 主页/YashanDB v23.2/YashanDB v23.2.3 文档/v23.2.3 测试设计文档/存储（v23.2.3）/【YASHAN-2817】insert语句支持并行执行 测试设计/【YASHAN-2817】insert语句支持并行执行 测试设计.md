Created by 高亚宁, last modified on 六月 25, 2024

#  1. 概述

本文描述insert into select并行的测试设计

# 2. 需求分析

## 2.1 功能点分析

SR：    [https://pingcode.yasdb.com/pjm/items/661f6e6cfd997db58adb5eba](https://pingcode.yasdb.com/pjm/items/661f6e6cfd997db58adb5eba)    ?    
  #YDBRD-26461 insert语句支持并行执行

概要设计方案：    [https://conf.yasdb.com/pages/viewpage.action?pageId=150631163 ](https://conf.yasdb.com/pages/viewpage.action?pageId=150631163)  

开发设计方案：    [https://conf.yasdb.com/pages/viewpage.action?pageId=150631163 ](https://conf.yasdb.com/pages/viewpage.action?pageId=150631163)  

测试调研文档：    [【YASHAN-2817】insert语句支持并行执行 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150607361)  

需求来源：宏杉科技产品适配 

需求场景： 100G数据加载 36min10s 执行语句 instert into test select * from test3；

交付形态：单机和集群

需求分析： 

1. 经过与研发同学定位， YashanDB当前insert 语句不支持 并行支持，该场景相对比Oracle 存在较大性能差距 
1. 通过hint 设置并行度


功能特性：

- 提供insert into select语句中select并行的能力  insert     into   t1   select     /*+ parallel(t2,4)*/   *   from   t2 ;


- 提供insert into select语句中insert并行能力  insert     /*+ parallel(t1,4)*/     into   t1   select   *   from   t2 ;


- 提供insert into select语句中insert， select并行能力  insert     /*+ parallel(t1,4)*/     into   t1   select     /*+ parallel(t2,4)*/   *   from   t2 ;


## 2.2  ** 应用场景**

1. 大量数据插入：当你需要从一个表或者多个表中选择大量数据，并将其加载到另一个表中时，使用并行     `INSERT INTO SELECT`     可以提高插入速度，因为它可以利用多个进程或线程同时执行加载操作，从而加快数据传输速度。
1. 数据仓库加载：在数据仓库环境中，通常需要定期从源系统中抽取大量数据，并加载到数据仓库中进行分析和报告。并行     `INSERT INTO SELECT`     可以显著缩短数据加载的时间，提高数据仓库的可用性和性能。
1. ETL 过程：在 ETL（抽取、转换、加载）过程中，通常需要对抽取的数据进行各种转换和加工，然后将结果加载到目标表中。并行     `INSERT INTO SELECT`     可以在加载阶段加速数据的转移和加载，从而减少整个 ETL 过程的执行时间。
1. 分区表维护：当对分区表进行维护操作时，比如数据迁移、数据归档等，使用并行     `INSERT INTO SELECT`     可以快速将数据从一个分区加载到另一个分区，而无需阻塞其他用户的访问


## 2.3 规格约束

- insert into select并行默认是noappend模式，如果指定了append hint，依然是noappend模式。
- select的并行受限于当前sql引擎支持并行的能力，只支持单表的select并行，具体支持哪些需要sql能通执行计划显示哪些hint是失效的。
- 分布式下不支持并行insert。
- 集群下的并行只能是单实例下的并行。
- 列表的insert into select走的是列执行引擎，目前无法支持并行。
- insert into不支持并行(没有subquery的场景)。
- 并行语句加的是表的排它锁。
- 有并行语句的事务内，表不能从共享锁升级为排它锁。
    - 对表先做了非并行的dml， insert/delete/update之后，不能再对表进行并行dml。
    - 对表做了并行dml之后，不能再查询表的数据，即不能再执行select/update/delete。
    - 对表做了并行dml之后，可以再次进行insert和insert的并行dml，因为这两个语句不需要读取表数据。


# 3. 详细测试设计

## 3.1 测试设计方法

1. 部署方式：单机、集群3实例
1. 并行insert into select语法，采用路径覆盖和等价类划分法
1. insert into select语句的三种并行功能是否生效，重点考虑并行过程中的父事务和子事务的一致性，采用场景法设计
1. 视图：v$transaction修改  PTX_XID的实现
1. 性能：与Oracle做性能对比测试，同等条件下，并行insert性能不低于Oracle
1. 拦截：分布式不支持，列表不支持
1. 系统级DFX分类    



|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及，并行insert只在特定场景下使用，不是用户常用的操作|
|一致性|涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，  转测功能不涉及该模块修改|
|安全|不涉及，  转测功能不涉及该模块修改|
|DFR|不涉及，  转测功能不涉及该模块修改|
|HA|涉及|
|压力|不涉及，  转测功能不涉及该模块修改|
|性能|涉及|
|可维护性|不涉及，  转测功能不涉及该模块修改|
|资料|涉及|


## 3.2 详细测试设计

### 3.2.1  SQL语法：

hint:  /*+ noappend PARALLEL(  表名,并行度)   */

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|仅子查询带hint|insert     into   t1   select     /*+ parallel(t2,4)*/   *   from   t2 ;|hint格式错误：    
  没有//或者//不匹配,*不匹配,parallel拼写错误,parallel格式错误：不带表名，不带括号，表名带引号,并行度设置为负数，0，小数，超大数|
|  
|并行度设置为256（不会报错，  超过255时会退化为255  ）|hint中的表不是查询的表|
|  
|使用其他类型的hint，例如LEADING，FULL，INDEX|  
|
|  
|  
|hint中的表名错误或者不存在|
|仅insert带hint|insert   /*+ parallel(t1,4)*/     into   t1   select   *   from   t2 ;|hint格式错误：    
  没有//或者//不匹配,*不匹配,parallel拼写错误,parallel格式错误：不带表名，不带括号，表名带引号,并行度设置为负数，0，小数，超大数|
|  
|并行度设置为256（不会报错，  超过255时会退化为255  ）|insert使用其他类型的hint，例如LEADING，FULL，INDEX|
|  
|insert使用  parallel，select使用其他类型的hint|hint中的表不是插入的表|
|  
|  
|hint中的表名错误或者不存在|
|insert和子查询都带hint|insert   /*+ parallel(t1,4)*/     into   t1   select     /*+ parallel(t2,4)*/   *   from   t2 ;|  
|
|  
|并行度设置为256（不会报错，  超过255时会退化为255  ）|  
|
|  
|2个hint的并行度不同|  
|
|  
|带noappend|  
|
|  
|带append，不报错，但实际仍是noappend|  
|
|alter session enable/disable parallel dml|alter session enable parallel dml|alter system parallel dml|
|  
|alter session disable parallel dml|alter session enable para dml|
|  
|  
|alter session enable parallel ddl|
|  
|  
|alter session parallel dml|
|  
|  
|alter session enable parallel|
|  
|  
|alter session enable dml|
|  
|无论是否开启dml并行，都可执行insert into select并行语句|  
|


### 3.2.2  功能

|  
|测试场景|用例详细描述|预期|备注|
|:---|:---|:---|:---|:---|
|1|开启/关闭dml并行|执行alter session disable parallel dml关闭并行，执行insert并行语句，查看执行计划|插入成功，不会开并行|  
|
|2|  
|在同一个session反复开启、关闭parallel dml，执行insert并行语句|以最后一次执行的状态为准|  
|
|3|  
|开启parallel dml，开启xa事务，关闭xa事务后，再开启parallel dml，执行insert并行语句|执行xa事务后，该session不会再开启并行dml|  
|
|4|  
|开启/关闭并行session，只对当前session生效，退出session后，默认不开启并行dml|  
|  
|
|5|并行插入功能|执行alter session enable parallel dml开启并行，建普通表，并行插入时，仅子查询  带hint，查看执行计划|插入成功，返回的行数正确，子查询部分为并行插入|普通表和分区表在并行insert时没有差别，并行select可能有不同，需要确认|
|6|  
|执行alter session enable parallel dml开启并行，建分区表，并行插入时，仅insert  带hint，查看执行计划和v$transaction|插入成功，返回的行数正确，insert部分为并行插入,v$transaction中的子事务数量和指定的并行度一致|  
|
|7|  
|执行alter session enable parallel dml开启并行，建分区表，并行插入时，insert和子查询都  带hint，两个hint的并行度不一致|插入成功，返回的行数正确，insert和子查询部分都带并行,v$transaction中的子事务数量和指定的较大的并行度一致|  
|
|8|  
|insert使用  parallel，select使用其他类型的hint|可以并行|hint（不需要全量覆盖）：,FULL INDEX NO_INDEX INDEX_FFS,PARALLEL,LEADING,NO_USE_HASH NO_USE_MERGE NO_USE_NL USE_HASH USE_MERGE USE_NL,SELECTIVITY,BULKLOAD,MAX_WORKERS_PER_EXEC|
|9|  
|对表先做普通的dml(insert/delete/update)，不提交或回滚，对该表在当前session做并行insert（3种都要考虑）,提交事务，做并行insert|仅select并行不报错    
  带insert并行的会报错,事务提交后，并行insert成功|ORA-12839: cannot modify an object in parallel after modifying it|
|10|  
|对表先做并行insert，不提交或回滚，对该表做普通insert或者并行insert：,子查询返回0行,子查询返回非0行,回滚事务，做普通insert或者并行insert|回滚前后，执行普通insert或者并行insert都成功|ORA-12838: cannot read/modify an object after modifying it in parallel|
|11|  
|并行insert执行后，不提交或者回滚，查询该表及其执行计划  /update/delete  ，事务提交后，查询该表及其执行计划|查询表和执行计划、  update/delete  报错,事务提交后查询表和执行计划成功|ORA-12838: cannot read/modify an object after modifying it in parallel,查询：select，select for update，闪回查询|
|12|  
|并行插入的表中有外键约束，做并行insert，查看并行数|并行插入成功，但实际是单线程执行|Oracle：目标表上不能定义任何触发器或参照完整性约束（约束里是这么写的，但实际实现可能不是这样，需要测试）,考虑覆盖其他完整性约束：,非空约束（NOT NULL）,唯一约束（Unique key）,主键约束（Primary key）,外键约束（Foreign key）,检查性约束（Check）,结论：只有目标表有外键约束时，insert into select不并行，其他约束都会并行|
|13|  
|给并行插入的表建唯一索引，子查询中包含重复数据，且重复数据分布在不同的insert子线程上，不带,#### on_duplicate_clause|并行插入报错|  
|
|14|  
|给并行插入的表建唯一索引，子查询中包含重复数据，且重复数据分布在不同的insert子线程上，带,#### on_duplicate_clause|并行插入成功，可以并行|  
|
|15|  
|并行insert的表上包含insert类型的触发器：,行级触发器/表级别触发器,触发器为before/after,过程体部分带（普通dml/并行insert）/不带dml ,是否带自治事务|过程体中不带dml时，并行insert语句执行成功，但实际是单线程执行,过程体中带dml时，执行结果需要结合实际情况分析，实际是单线程执行|![](https://conf.yasdb.com/download/attachments/76938889/image2022-4-20_18-34-29.png?version=1&modificationDate=1650450600000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU5MzcsImV4cCI6MTc4MjMxNjczN30.N9gbEI54n8MKRb01A3_9H6OyYC8PYNRuUk2bXv9vwn0),ORA-04091: table GYN.GYN_STUDENT is mutating, trigger/function may not see it,结论：只要目标表上有触发器，就不会并行|
|16|  
|在存储过程中调用insert into select并行插入|插入成功，可以并行|华润银行|
|17|  
|目标表中的列包含udt类型|插入成功，可以并行|  
|
|18|  
|开启xa事务，在xa事务中做并行insert插入|插入成功，不会并行|Oracle只要开启xa事务，不会再开启并行，即使xa事务已结束，当前session也不会开启并行|
|19|  
|先做并行insert插入，再开启xa事务做普通插入/并行插入|开启xa事务后，做普通插入报错，做并行插入成功，但不会并行|  
|
|20|  
|当目标表和查询表相同时，在一个事务内连续执行两次并行插入：,不在xa事务内，当目标表和查询表相同时，连续执行两次并行插入会报错,在xa事务内，当目标表和查询表相同时，连续执行两次并行插入不会报错，因为没有启并行|不在xa事务内，会开启并行，第二次插入会报错,在xa事务内，不会开启并行，第二次插入成功|  
|
|21|  
|目标表是视图或者物化视图的基表，做并行插入|插入成功，带普通视图会并行，带物化视图不会并行|  
|
|22|  
|给临时表做并行insert|  
|临时表：,全局：会话级，事务级,私有：会话级，事务级|
|23|  
|并行insert时，子查询带多张表join|不会走并行|  
|
|24|  
|开启可串行化事务，执行insert into select并行|插入成功，不会走并行|+执行计划,+实际是否并行,计划走并行，实际不能并行，会报错？实际的并行数按照资源情况分，不一定与计划中一致,执行时发现不能并行，是走单线程（万一一个都申请不到，怎么处理），还是退回原来的方式执行？,max_parallel_worker参数，最大并行总数,超过最大cpu核数时，能否正常并行,生成执行计划时，未开启可串行化事务，实际执行时，开启可串行化事务，之前的计划是否可用，如果不可用要报错？,支持alter session disable/enable parallel dml,在开启可串行化事务前后，开启  parallel dml,怎么查询session是否开启parallel dml|
|25|  
|并行插入大量数据后，全部回滚或者回滚到  savepoint，校验数据库和并行线程数v$rollback|回滚成功，数据量正确，回滚时的并行线程数正确,回滚后，事务会结束，资源会被释放|构造事务，包含多个目标表，给不同的目标表并行插入数据（线程数不同），回滚事务|
|26|  
|并行插入大量数据后，全部提交|提交成功，数据量正确，提交后，事务会结束，资源会被释放|资源：锁，内存|
|27|  
|开启all类型的表级附加日志，并行插入成功后，查看逻辑日志|与不开并行的逻辑日志没有差异，用户不感知|  
|
|28|  
|启动insert并行事务，查看v$transaction视图中的PTX_XID|PTX_XID正确|  
|
|29|  
|使用dblink，执行并行insert|子查询中的表带dblink，给本地的表做并行插入，会走并行    
  insert中的表带dblink，相当于给远端数据库做并行insert into select，不会走并行|  
|
|30|  
|分区表和普通表带lob和大于8000字符的varchar类型，不会并行|不会并行|  
|
|31|CT/KT|并发对同一张表做并行insert和select，并行度不同，结合三种事务操作|数据库不会core，不会出现内存泄漏|KT中考虑重启回滚|
|32|  
|并发对同一张表做并行insert和普通dml，结合三种事务操作|数据库不会core，不会出现内存泄漏|DML：,简单dml：insert 、delete、update,批插：insert into select ,多表update、delete,insert on duplicate key,外键级联更新,merge into,跨分区更新,冷数据更新、删除,行链接、行迁移|
|33|  
|并发对同一张表做ddl（少量），普通dml和并行insert，结合三种事务操作|数据库不会core，不会出现内存泄漏|ddl考虑shrink table，  rebuild index online|
|34|  
|并发对多张表做并发insert，普通dml和ddl，多表的dml在一个事务内，结合三种事务操作|数据库不会core，不会出现内存泄漏|  
|
|35|一致性|纯并行insert操作并发|  
|  [事务测试概要设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144146309)  |
|36|  
|主机并行insert时，备机读一致性|  
|  
|
|37|+|一致性考虑故障场景|  
|  
|
|38|主备|主机做并行insert时，备机做switchover|switchover成功，旧主机未提交的事务会回滚|  
|
|39|  
|主机做并行insert时，kill主机，备机做failover|failover成功|kill主机时，主机上的并行事务可能处于以下状态：,子事务cxact commit状态，redo已刷盘,父事务pxact commit状态，redo已刷盘，已记录commit scn,修改状态：,子事务end，刷新commit scn,父事务end,父事务redo刷盘前被kill，重启后子事务和父事务会回滚,父事务redo已刷盘，已记录commit scn后被kill，重启后事务会继续提交|
|40|  
|主备倒换后，新主机做并行insert成功|  
|  
|
|41|  
|在备机查询并行insert语句的执行计划|  
|Oracle查询执行计划也会起事务|
|42|+|备机执行  alter session disable/enable parallel dml|报错|  
|
|43|拦截|给列表做并行insert|报错|  
|
|44|  
|分布式环境，给表做并行insert|报错|  
|
|45|集群|以上场景在集群环境都要覆盖|  
|  
|
|46|  
|实例1和实例2同时对同一张表做并行insert|insert成功，能并行|  
|
|47|  
|对同一张表，实例1并行insert，实例2做普通dml，ddl|执行成功|  
|
|48|性能|100G数据并行对普通表做insert into select，考虑1，2，4，6，8，10，15，20|  
|指定noappend|
|49|  
|100G数据并行分区表做insert into select，考虑1，2，4，6，8，10，15，20|  
|指定noappend|
|50|  
|100G数据并行对普通表做insert into select，考虑1，2，4，6，8，10，15，20，开启nologging|  
|指定noappend|
|51|  
|100G数据并行分区表做insert into select，考虑1，2，4，6，8，10，15，20，开启nologging|  
|指定noappend|
|52|  
|100G数据并行对普通表做insert into select，考虑1，2，4，6，8，10，15，20，带唯一约束/索引|  
|指定noappend|
|53|  
|100G数据并行分区表做insert into select，考虑1，2，4，6，8，10，15，20，带唯一约束/索引|  
|指定noappend|
|54|升级|22.2，23.2归档包升级到最新转测版本，升级前后，查询transaction视图，做并行insert|查询transaction视图正常,升级前执行并行insert会报错,升级后执行并行insert成功|  
|
|55|23.2.3.100 SIT补测场景|外部表select合入后，需要补测insert into select并行场景|外部表在insert中，会报错,外部表在子查询中，插入成功，但查询不并行|  
|
|56|  
|默认32个并行，先并行插入，使用30个，再给另一张表并行插入，使用6个并行，执行成功，实际并行数为2|  
|  
|


# 4. 测试用例

1. 冒烟用例；
1. 文本用例，并完成大部分自动化用例；    



|  
|用例详细描述|预期|
|:---|:---|:---|
|1|建普通表，并行插入时，仅子查询  带hint，查看执行计划|插入成功，返回的行数正确，子查询部分为并行插入|
|2|建分区表，并行插入时，仅insert  带hint，查看执行计划和v$transaction|插入成功，返回的行数正确，insert部分为并行插入,v$transaction中的子事务数量和指定的并行度一致|
|3|建分区表，并行插入时，insert和子查询都  带hint，两个hint的并行度不一致|插入成功，返回的行数正确，insert和子查询部分都带并行,v$transaction中的子事务数量和指定的较大的并行度一致|
|4|对表先做普通的dml(insert/delete/update)，不提交或回滚，对该表在当前session做并行insert（3种都要考虑）,提交事务，做并行insert|仅select并行不报错    
  带insert并行的会报错,事务提交后，并行insert成功|
|5|目标表带外键约束，做并行insert成功，但不会并行|  
|
|6|目标表带insert类型的触发器，做并行insert成功（也可能会失败），但不会并行|  
|


# 5. 测试框架设计

使用guider框架自动化

CT/KT使用guider框架

ha场景使用ha_regress框架

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|部署|单机、集群|
|操作系统|Linux|


# 7. 工作量评估

总计15人天：

测试调研+测试设计+评审：3人天

自动化用例准备：5人天

测试执行：5人天

上车+问题单回归+CI分析+资料测试：2人天

  


测试计划（1个人投入测试）：

5.10 测试设计评审

5.17 完成测试用例

5.31 转测

6.14 上车

计划测试完成时间：6.14

## Attachments:

[并行insert into select.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWU4OTcwYzJhZjRmNTIxMDVkIiwicmVmX2lkIjoiNjczOTZkMWQ1OTNmOTljOWZmMjM3N2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1OTM3LCJleHAiOjE3ODIzOTIzMzd9.gFEsf7aROCrJVb3iiSwljxXm_xydXbNxYmVcHI8NohU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,主题：并行insert into select测试设计评审,与会人：李燕琼，陈敬厅，林俊喆，崔园园，郑荃，高亚宁,会议时间：2024/5/10,会议地点：线上会议,会议纪要：,1. 执行计划走并行，实际执行时不能并行，会报错？实际的并行数按照资源情况分，不一定与计划中一致，执行时发现不能并行，是走单线程（万一一个线程资源都申请不到，怎么处理），还是退回原来的方式执行？——研发方案待定@李燕琼
1. 考虑并行参数：MAX_PARALLEL_WORKERSï，STARTUP_ROLLBACK_PARALLELISMï，DEGREE_OF_PARALLEL    
  单个insert并行线程数超过并行参数值，会报错？    
  多个insert并行线程数，整体超过了并行参数值，超过的部分会报错？
1. 超过最大cpu核数时，能否正常并行
1. 生成执行计划时，未开启可串行化事务，实际执行时，开启可串行化事务，之前的计划是否可用，如果不可用要报错？
1. 支持alter session disable/enable parallel dml，新增开启关闭并行dml语法和功能测试
1. 在开启可串行化事务前后，开启parallel dml，看是否报错
1. 怎么查询session是否开启parallel dml？
,Posted by gaoyaning at 五月 10, 2024 11:59|
|---|
|  [](null)  ,第7点Oracle调研结果：,Select * FROM V$OPTION where parameter like 'Parallel%';    
  select * from V$pq_sesstat where STATISTIC like '%Parallelized';    
  select * from v$px_process; ,![](https://pingcode.yasdb.com/atlas/files/public/67396d1e8970c2af4f52105e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU5MzcsImV4cCI6MTc4MjMxNjczN30.N9gbEI54n8MKRb01A3_9H6OyYC8PYNRuUk2bXv9vwn0),Posted by gaoyaning at 五月 10, 2024 15:12|
