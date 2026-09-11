Created by 易文亮, last modified on 十一月 16, 2023

# 1.   **概述**

本文档描述INSERT INTO增量导入(写入)LSC冷数据的测试设计

当前insert into插入的是动态数据，支持单插/批插，支持带select子查询，本次实现LSC表走BULKLOAD批量插入接口，可以带单个或多个values，也可以带select子查询，作为bulkload全量导入的一种增量写入版本。

# 2.   **需求分析**

sr：    [YDBRD-21586](https://jira.yasdb.com/browse/YDBRD-21586?src=confmacro)    -  支持insert /*+bulkload */语句增量导入LSC冷数据  完成

开发设计：    [【Spearfish】LSC表增量导入方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133567101)  

语法：  INSERT [hint] (single_table_insert|multi_table_insert)

INSERT  /*+bulkload*/ into table_name values(value1,value2,value3[,...])[,...] | select_clause;

**bulkload增量导入批插缓存在rgd上，缓存在rgd时数据不可见，commit数据会转冷并可见。如果达到上限写满1个scol_slice_row也会转冷，commit后可见。**

隐式commit:执行ddl前会执行隐式commit; 隐式rollback，事务开启后dml报错会触发隐式rollback。

功能限制：

1. 语法只支持LSC表。
1. 不支持多表插入使用该hint。（insert语法下）
1. 在开始增量导入后，不允许创建savepoint。已经有savepoint的情况下，也不允许进行增量导入。
1. 在增量导入过程中，不允许开启自动提交（或者说明开启后带来的影响）
1. 当一个会话开启对一张LSC表的增量导入后，必须要提交或者回滚后，当前会话才能操作其他LSC表进行增量导入，否则会报错处理。


# 3.   **测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

# 4.   **详细测试设计**

## 4.1 语法验证 

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|表类型|分布表|普通、分区表、二级分区表|tac/heap|  
|
|  
|复制表|普通、分区表、二级分区表|多表|  
|
|数据类型|char，varchar|各数据类型的边界值|  
|  
|
|  
|tinyint，smallint，int，bigint|  
|  
|  
|
|  
|number|  
|  
|  
|
|  
|float，double|  
|  
|  
|
|  
|time，timestamp，date|  
|  
|  
|
|  
|clob/blob|32000大小限制  |  
|  
|
|  
|json|  
|udt|  
|
|  
|boolean|  
|bit|  
|
|数据类型转换|隐式类型转换|支持隐式转换，且数据不越界|跨类型不支持隐式转换,越界|  
|
|  
|强制类型转换|select cast( c1 as date) |不支持转换,越界|  
|
|是否指定列|全表插入|  
|  
|  
|
|  
|指定部分表列插入|带分布键/不带分布键/带分区键/不带分区键|  
|  
|
|投影列数量|待插入的列等于投影列个数|  
|插入列与数据列数不一致|  
|
|  
|单列|投影列可以有null值，补null|  
|  
|
|  
|多列|最大4096|  
|  
|
|投影列类型|单列|  
|  
|  
|
|  
|表达式列，函数列|普通函数，聚集函数，窗口函数|  
|  
|
||伪列|rownum ， rowid ，rowscn|  
|  
|
|  
|标量子查询|  
|  
|  
|
|  
|常量|  
|  
|  
|
|  
|sysdate，systimestamp|select count(*) |  
|  
|
|待插入表约束|not null|单列约束，多列约束|~~check~~|  
|
|  
|unique|  
|~~外键~~|  
|
|  
|主键|  
|  
|  
|
|  
|default|  
|  
|  
|
|insert_clause|values|单个/多个|  
|  
|
|  
|select子查询|  
|  
|  
|
|  
|  
|  
|  
|  
|
|select子查询|join|inner，left，right，full,128张表|connect by|  
|
|  
|集合操作|union，intersect，minus|  
|  
|
|  
|distinct|  
|  
|  
|
|  
|group by|  
|  
|  
|
|  
|order by|  
|  
|  
|
|  
|limit offset|  
|  
|  
|
|  
|in|多列，单列,in list,in subquery|  
|  
|
|  
|exists|  
|  
|  
|
|  
|关联子查询，非关联子查询|  
|  
|  
|
|  
|like，rlike，not like，not rlike|  
|  
|  
|
|  
|between and|  
|  
|  
|
|  
|is null， is not null|  
|  
|  
|
|  
|any，all，some|  
|  
|  
|
|子查询对象类型|table|heap/tac/lsc,行列混合|  
|  
|
|  
|view|create view v1 as select * from t1;  ---- 验证分布式支不支持,insert into t1 select * from v1;|  
|  
|
|  
|分区表|interval，hash，range，list,分区表往普通表里插入,普通表往分区表里插入|  
|  
|
|子查询返回值|多行多列|  
|  
|  
|
|  
|单行多列|  
|  
|  
|
|  
|多行单列|  
|  
|  
|
|  
|单行单列|  
|  
|  
|
|数据特征|insert表的数据和select表的数据分布是否一致|  
|  
|  
|
|  
|大量数据|大量插入时看一下行表和列表的性能,set timing on,两个表的分布键一样性能有提升 不是分布键性能没有提升|  
|  
|


指定分区增量导入

insert into on duplicate key   --拦截报错

插入带/不带分布/分区键  

二级分区表？

逻辑复制日志？ --不支持

增量导入重复数据？暂时报错，后面考虑去重。

关注下内存资源使用情况

导入线程跟转换线程有关，默认32

4.2 场景验证

|序号|测试场景|预期|备注|
|---|---|---|---|
|1|对多表进行增量导入(  insert all into  )|失败报错|  
|
|2|创建savepoint后再执行增量导入|失败报错|  
|
|3|增量导入未commit尝试创建savepoint|报错|  
|
|4|增量导入commit后尝试创建savepoint|成功|  
|
|5|增量导入rollback后尝试创建savepoint|成功|  
|
|6|开启自动提交再执行增量导入|报错|  
|
|7|增量导入未commit开启自动提交成功，再执行增量导入报错|事务规则|  
|
|8|增量导入过程中并发开启自动提交|报错|  
|
|9|对同一张表增量导入不提交，反复执行n次，最后commit|导入成功，commit成功|  
|
|10|对同一张表增量导入提交，反复执行n次|能导入和commit成功|  
|
|11|对同一张表增量导入不提交，反复执行n次，最后rollback|导入成功，rollback成功|  
|
|12|对同一张表增量导入rollback，反复执行n次|导入成功，rollback成功|  
|
|13|间隔性对同一张表增量导入commit/rollback，反复执行n次|成功|  
|
|14|同一个会话对一张表执行增量导入不提交，再对其他表进行增量导入|报错|  
|
|15|同一个会话对一张表执行增量导入不提交，对该表进行增删改查成功|增量导入失败回滚整个事务，dml失败只回滚自身|  
|
|16|同一个会话对一张表执行增量导入不提交，对其他表进行增删改查成功|增量导入失败回滚整个事务，dml失败只回滚自身|  
|
|17|同一个会话对一张表执行增量导入提交/rollback，再对其他表进行增量导入|成功|  
|
|18|同一个会话对一张表执行增量导入提交/rollback，对其他表进行增删查改操作|成功|  
|
|19|增量导入数据触发转一个slice，确认数据和slice文件生成，rollback再确认数据和slice文件|正常|  
|
|20|增量导入数据触发转一个slice，确认数据和slice文件生成，commit再确认数据和slice文件|正常|  
|
|21|增量导入数据触发转多个slice，确认数据和slice文件生成，rollback再确认数据和slice文件|正常|  
|
|22|增量导入数据触发转多个slice，确认数据和slice文件生成，commit再确认数据和slice文件|正常|  
|
|23|事务验证:一个会话增量导入不提交,当前会话查询|无索引无法查询到，有索引不保证|  
|
|24|事务验证:一个会话增量导入不提交,其他会话查询|无法查询到|  
|
|25|事务验证:一个会话增量导入提交,当前会话查询|能查询到|  
|
|26|事务验证:一个会话增量导入提交,其他会话查询|能查询到|  
|
|27|指定分区增量导入满足分区范围的值|成功|  
|
|28|指定分区增量导入不满足分区范围的值|报错失败|  
|
|29|LSC表带全局索引增量导入考虑回表和不回表|导入成功，结果分情况|  
|
|30|LSC表带本地索引增量导入考虑回表和不回表|导入成功，结果分情况|  
|
|31|二级分区表增量导入|成功|  
|
|32|增删列再执行增量导入，导入后再增删列，再执行增量导入|成功|  
|
|33|增量导入失败，会回滚所有未提交事务确认|符合预期|  
|
|34|增量导入大量数据，触发rgd缓存上限，再提交|导入成功，结果符合预期|  
|
|35|增量导入大量数据，触发rgd缓存上限，再回滚|结果符合预期|  
|


## 注  ：当前会话不保证事务可见性。增量导入2000W数据，当前会话可查到落盘数据，其他会话查询为0；

## 4.3 其他场景

内存泄漏：

1）反复增量导入100次，导入1次提交一次，导入正常，无内存泄漏

2）反复增量导入100次不提交，最后一次提交，导入正常，无内存泄漏

3）增量导入大量数据10W/100W/1000W条，确认无内存泄漏

并发：

1）对同一张表并发增量导入

2）对同一张表增量导入、插入、导入并发

3）增量导入和dml+ddl并发

性能测试：

1）bulkload增量导入与bulkload的csv导入性能对比

2）  ~~DATAX走增量导入性能与竞品相当~~

3）增量写入冷数据+commit性能优于写入热数据+转冷。

一致性

HA：增量导入后，备机回放，确认主备同步，备机确认拦截

分布式主备验证，备机确认拦截

# 5.  ** 测试用例设计**

门槛用例：

[load_insert_ceil.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWE4OTcwYzJhZjRmNTIwN2ZhIiwicmVmX2lkIjoiNjczOTZiZWE1OTNmOTljOWZmMjM2ODQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODgyLCJleHAiOjE3ODIzODQyODJ9.NSJr8pcNCspUDPK5XPeesrOXuvWVnlY5-eDZu3zCWkw)

文本用例：

[LSC增量导入冷数据文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWFhMWFkOWEzMzExZGM4NjZmIiwicmVmX2lkIjoiNjczOTZiZWE1OTNmOTljOWZmMjM2ODQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODgyLCJleHAiOjE3ODIzODQyODJ9.e4EQBE2NuketfD6UhQKI_fdHRmcystdGch0FX8Eb8aU)

# 6.   **测试框架设计**

使用Guider，本次不做额外框架设计

# 7.   **测试环境说明**

部署：单机+分布式

## Attachments:

[image2023-11-13_17-47-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWFhMWFkOWEzMzExZGM4NjcwIiwicmVmX2lkIjoiNjczOTZiZWE1OTNmOTljOWZmMjM2ODQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODgyLCJleHAiOjE3ODIzODQyODJ9.z03WsqZ1heFo7Q_N7tlMdJcSyRmu_ITj6lO5-2dwDLU)

 (image/png)    


[load_insert_ceil.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWE4OTcwYzJhZjRmNTIwN2ZhIiwicmVmX2lkIjoiNjczOTZiZWE1OTNmOTljOWZmMjM2ODQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODgyLCJleHAiOjE3ODIzODQyODJ9.NSJr8pcNCspUDPK5XPeesrOXuvWVnlY5-eDZu3zCWkw)

 (application/octet-stream)    


[LSC增量导入冷数据文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWFhMWFkOWEzMzExZGM4NjZmIiwicmVmX2lkIjoiNjczOTZiZWE1OTNmOTljOWZmMjM2ODQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3ODgyLCJleHAiOjE3ODIzODQyODJ9.e4EQBE2NuketfD6UhQKI_fdHRmcystdGch0FX8Eb8aU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
