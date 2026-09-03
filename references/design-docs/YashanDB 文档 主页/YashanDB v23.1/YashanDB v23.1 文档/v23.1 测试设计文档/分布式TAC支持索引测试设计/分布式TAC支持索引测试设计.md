Created by 刘晓旋, last modified on 八月 07, 2023

# 1. 概述

本需求实现了生成分布式列表的索引扫描计划。

# 2. 需求分析

  [YDBRD-5228](https://jira.yasdb.com/browse/YDBRD-5228?src=confmacro)    -  分布式TAC支持索引  完成

### 2.1 功能特性

对TAC生成分布式索引计划。详情参见开发设计     [分布式TAC支持索引方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=122073046)  

### 2.2 接口

本方案将原先不走索引的分支放开，增加了支持索引的算子，为内部调用函数，无对外接口。

### 2.3 约束

支持分布式索引列表，和单机TAC表的索引规格一致。修改前分布式列存计划不支持 index scan，修改后支持。

![](https://pingcode.yasdb.com/atlas/files/public/673969d1a1ad9a3311dc792f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUlBUkJBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxNTAsImV4cCI6MTc4MjIxOTk1MH0.0Pgef3oT9Z5-IVa_5cfUK8X1pzsyjJgOp7rXo24sLzg)

  


# 3. 详细测试设计

### 3.1 功能测试

由于本需求分布式与单机的规格一致，因此功能测试参考单机。

|大类|测试场景|备注|
|---|---|---|
|单表|1、表类型,普通表,分区表（hash/range/list）,临时表（global、private） ----- 分布式暂不支持,分布式覆盖：分布表、复制表,  
,2、数据类型：覆盖所有数据类型：数值类型（tinyint/smallint/int/bigint/float/double/number/bit）、字符类型（char/varchar/n char/n varchar）、时间类型(date/time/timestamp/interval  ym/interval ds)、大对象类型（clob/blob/json 不支持比较但可以作为投影列、raw支持比较）、boolean,  
,3、索引类型：主键约束、唯一键、普通索引、分区索引、reverse 索引（确认单机是否支持）,  
,4、覆盖所有的 index 算子：,index unique scan,index range scan ,index range scan descending,index full scan,index full scan descending,index fast full scan,index full scan (min/max),index range scan (min/max),  
,5、覆盖：global 索引、local 索引、单列索引、组合索引,  
,6、索引列位置：在投影不在 filter、在 filter 不在投影、投影和 filter 都存在,  
,7、filter 条件覆盖所有谓词（>、<、<>、=、>=、<=、in/not in、between and、like/not like、exists/not exists 等）、is null/is not null、组合 and/or 【<>、not in、exists/not exists、not like 不走索引；下来确认 is (not) null 是否支持索引】,  
,8、组合聚集函数、内置函数、 distinct、group by having、order by、connect by、rownum、rowid,  
,9、select for update (跟单机确认一下，与单机保持一致),  
,10、组合子查询，覆盖：view、cte、case when、any/some/all 等，子查询覆盖能走索引,  
,11、hint：full scan、index、index fast full,  
,12、创建/删除索引后，索引是否有效/失效,  
,13、并行,  
,14、plsql 绑定参数,  
,15、insert ... select,  
,16、update/delete，filter 为索引列   ---- 可以走索引,  
,17、where 有 and、or，覆盖：部分 filter 条件走索引、部分不走索引，全部走索引的场景；filter 覆盖：同一个列、不同的列 【1、where id > 1 or id < -1 也是能走索引 2、组合索引(a,b)，where a > 1 or b < -1 不能走索引，但是 and 可以；3、where id > 1 and id < -1 会改写 filter false，不走scan算子】|  
|
|多表|1、覆盖以上场景,  
,2、多表 join，语法覆盖 left right join/full join/inner join，算子覆盖：hash join/nestloop join/merge join。索引覆盖：单张表上有索引、多张表上有索引,（hash join 的 join condition 是不会下推到表上的，所以要用 where col1 = const 的条件走索引；nest loop 是可以将 on t1.id = t2.id 下推到右表的 scan 上，可以走索引；比较条件可以放在 on 也可以放在 where，如 on t1.id = 1 where t1.c1 = t2.c1;）,  
,3、集合操作：union/minus/intersect (all)，部分子句走索引、所有子句走索引，每个子句互不干扰|  
|


### 3.2 专项测试

性能：

1）大数据量下，走索引的查询性能

2）大数据量下，创建索引后，insert/update/delete 的性能 ？

  


并发：

同一个对象，DML 与 select 走索引之间并发

同一个对象，select 与 create/drop index 之间并发

不同对象之间的并发

  


长稳：

大数据量下，反复增删索引，执行 DML 与 select

## Attachments: