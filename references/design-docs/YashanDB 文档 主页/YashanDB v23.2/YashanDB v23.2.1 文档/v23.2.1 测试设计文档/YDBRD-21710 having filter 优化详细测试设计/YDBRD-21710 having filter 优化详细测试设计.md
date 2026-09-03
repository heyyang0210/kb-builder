Created by 李攀, last modified by  刘清萍 on 一月 11, 2024

# **1. 概述**

本文描述HAVING FILTER优化功能的测试设计。

SR：    [YDBRD-21710](https://jira.yasdb.com/browse/YDBRD-21710?src=confmacro)    -  Having Filter优化  完成

开发设计文档：    [Having Filter 下推 - 特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133589646)  

测试文档：     [Having filter优化测试调研文档 - 李攀 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133574221)  

# **2. 需求分析**

需求描述：拆分having filter，有汇聚相关的filter必须在group 之后做，完全和汇聚无关的可以下推到group之下。

下推场景：

1.  当前对于不存在group by，但是select里面存在aggr的语句。如果有having条件，having内如果为聚集无关的filter，并且能够保证执行的结果正确。如：sysdate之类的内置函数，在aggregate层也保留一个filter的同时，可以下推到aggregate算子下层。

2.  对于存在group by的having条件，如果存在可以下推的filter，也需要推导到group算子下层（现rewrite和verify已经实现，但仍然存在问题，新的逻辑需要把这aggrhaving和grouphaving两种统一在一个函数里）。这两种下推还存在是否删除原有filter的区别

**下推场景功能详解**  ：

需求范围：  单机和集群 分布式

# **3. 测试**  **设计方法**   

1.对是否下推的条件采用等价类划分方法进行用例设计

2.对子查询，CTE,DML等SQL场景应用采用场景覆盖法进行用例设计，覆盖sql中用到having的每一种场景

3.对比结果和oracle执行结果是否一致

4. 行列执行结果对比是否一致，行列执行计划对比

  


|专项|是否涉及,  
|测试点|
|:---|:---|---|
|CT|是|下推用例需要加到CT并发工程中|
|长稳|-|  
|
|一致性|-|  
|
|安全|-|  
|
|HA|-|  
|
|压力|-|  
|
|性能|是|测试和没有下下推之前的性能对比|
|资料|是|测试开发设计文档和资料网站文档内容描述|


# 4.   **详细测试设计**

需求描述：拆分having filter，有汇聚相关的filter必须在group 之后做，完全和汇聚无关的可以下推到group之下。

下推场景：

1.  当前对于不存在group by，但是select里面存在aggr的语句。如果有having条件，having内如果为聚集无关的filter，并且能够保证执行的结果正确。如：sysdate之类的内置函数，在aggregate层也保留一个filter的同时，可以下推到aggregate算子下层。

2.  对于存在group by的having条件，如果存在可以下推的filter，也需要推导到group算子下层（现rewrite和verify已经实现，但仍然存在问题，新的逻辑需要把这aggrhaving和grouphaving两种统一在一个函数里）。这两种下推还存在是否删除原有filter的区别

|输入条件1|输入条件2|有效等价类|flilter是否下推|备注|无效等价类|
|:---|:---|:---|:---|:---|---|
|不存在groupby,存在聚集函数+having|  
,having 条件为恒fasle|  `select count(*) from test having sysdate < `      `'1990-01-10'`      `;`  ,  `having 1>2;`  ,  `having false;`  ,  `having currenttimestamp>?`  ,  `having abs(1)>1`  ,  `having 伪列 xxx`  ,  `having SYSVAR =XXX(user='SYS')`  |是|在aggregate层也保留一个filter的同时，可以下推到aggregate算子下层。|  `having 列 xxx`  ,  `语法报错`  |
|  
|having 条件TRUE|  `恒true ,having 1<2;`  ,  `having 1=1;`  ,  `having true;`  |否 （result,没有filter）|  
|  
,  
|
|  
|不存在聚集函数+having|  
|不涉及|explain select C01 from table_sharded_101 having sysdate > '2023';|  
|
|存在group by的情况|filter 列包含  group by子句中的属性列|filter列包在含group 的列,  
|是|explain   select   c1  ,  c2   from   TB_YDBRD_13988_015_1   group by   1  ,  c1  ,  c2   having   c1  >  2  ;|filter 列不包含  group by子句中的正常列,语法报错|
|  
|  
|包含group 所有列|是|  
|  
|
|  
|  
|是group 列的四则运算表达式：,+,-,*,/,%|是|group by   1  ,  c1  ,  c2   having   c1+1  >  2   ；|  
|
|  
|  
|含有谓词and or操作|是|group by   1  ,  c1  ,  c2   having   c1  >  2   or c1<1 and c2<>10 |  
|
|  
|filter列是和列完全无关并且不随机的函数|内置函数入参是常量：abs(1)>0,div(1)=xx,  
,  
|是|  
|random ：,不下推|
|  
|随机函数|random 和sys_guid|否|  
|  
|
|  
|过滤条件是列聚集函数|AVG,COUNT,GROUP_CONCAT,MAX MIN STDDEV STDDEV_POP STDDEV_SAMP,SUM SUM_SQUARE VARIANCE VAR_POP VAR_SAMP,  
|否|explain select C01, C02, C03, C04 from table_sharded_101 group by C01, C02, C03, C04 having avg(C01) > 201;|  
|
|  
|窗口函数|core待提单  （oracle报错|否|窗口函数不能放在having后面|  
|
|  
|伪列|- ROWSCN------ 可推（不group by oracle不报错）
- ROWID---------可推
- ROWNUM----- 不推
- USER-----------可推
,connect by 伪列 ：,- level-----------------------------------------不推
- CONNECT_BY_ISCYCLE---------------------不推
- CONNECT_BY_ISLEAF-----------------------不推
,  
|部分可推|  
|ROWSCN，语法错误，,该种情况下oracle可以执行，yashanDB执行错误|
|  
|系统变量|sysdate ,SYSTIMESTAMP,currenttimestamp|是|  
|  
|
|其他基于列的内置函数|内置函数|内置函数嵌套聚合，内置函数嵌内置函数，udf嵌套udf，内置函数嵌UDF|参考文档是否支持下推|  [Having Filter 下推 - 特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133589646)  |  
|
|  
|null值|  
|  
|  [Having Filter 下推 - 特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133589646)  |  
|
|  
|having tilter是自定义函数|  
|否---master下推已提单|  
|  
|
|  
|random|  
|  
|  
|  
|
|filter条件覆盖|  
|filter条件 = >,<,<=，>=,!=,filter条件 like,not like,rlike,not rlike， in/not in, ,exists/not exists, is null/is not null,外部引用,between and,like,not like,rlike,not rlike，    is null/is not null,  
|  
|  
|  
|
|  
|any all some |（1，2，3，4）|  
|  
|（subquery）|
|  
|between and|  
|  
|  
|  
|
|  
|in、not in|in (1,2)|是（已提单）|  
|in（subquery）|
|  
|exists/notexists,|（1，2，3，4）|  
|  
|外部引用不推|
|  
|like,not like,rlike,not rlike|  
|  
|  
|（subquery）|
|  
|is null/is not null|  
|  
|  
|  
|
|场景|dml|delete|  
|  
|  
|
|  
|  
|update|  
|  
|  
|
|  
|  
|insert into select|  
|  
|  
|
|  
|create as select|  
|  
|  
|  
|
|  
|与  where条件组合|where是子查询,where 子句里面有having,正常where子句|  
|  
|  
|
|  
|集合操作union/ union all/intersect/intersect all/minus|  
|  
|  
|  
|
|  
|connect by|connect by后的伪劣 level,xxx xxx|否|  
|  
|
|  
|cte|cte里面,外层select|是|  
|  
|
|子查询|子查询位置|投影列,from 子查询,filter 子查询里面: where 后,having 条件后,  
|  
|子查询要覆盖有group  by和没有group by的情况：,只有aggr没有group时，与聚合列无关的filter，有关的filter，无关的不下推,有group有下推,  
|  
|
|  
|子查询类型|标量子查询,多行子查询,关联查询|  
|  
|  
|
|  
|join on|inner,left out,full out,right out|  
|  
|  
|
|havingfilter包含索引列下推||函数索引,列式索引,降序索引,反向索引,唯一索引,组合索引,分区索引|是（下推到索引扫描算子上？）|  
|  
|
|  
||filter是索引列和非索引列组合|是|  
|  
|
|  
|算子组合|多个物化算子组合，,order by,distinct,limit,join ,aggr等|  
|  
|  
|
|  
|并行时两阶段处理|aggr,group |  
|  
|  
|
|表类型|单机|行表：,列表：,  
|  
|  
|  
|
|  
|分布式|  
|  
|  
|  
|
|  
|集群|跑单机用例|  
|  
|  
|
|绑定参数|  
|计划中可以带？那种,  
,  
,  
,  
|  
|  
|  
|
|UDT|  
|嵌套表----(拦截）|![](https://pingcode.yasdb.com/atlas/files/public/67396ba38970c2af4f5205fd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYwMTAsImV4cCI6MTc4MjMwNjgxMH0.4wyKl7MBPXtPYjvfe3zwjfZxK05kC-HcCYVpBYWcwvc)|  
|  
|
|系统视图|  
|  
|  
|  
|  
|
|性能|大数据量|100W  下推和不下退场景性能结果对比，预期比master，22.2要好,500w数据量下推和不下退场景性能结果对比，预期比master，22.2要好|和master基本一致|  
|  
|
|  
|  
|  
|  
|  
|  
|


# 5.   **测试用例**

  


# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机，集群|


  


# **8. 工作量评估**

工作量：15  *人天*

计划测试完成时间：2023/11

## Attachments:

[having filter下推优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTJhMWFkOWEzMzExZGM4NDZkIiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.vTU_Ff07aO8cHg0o_RaOgqkHYCHZGwt0oMN01t8d9ZY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-11-13_19-55-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTI4OTcwYzJhZjRmNTIwNWY4IiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.AfU4TF_EntLwsVGb0-PTkWlJXjSnCLlyNW7nYjEWZAw)

 (image/png)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTI4OTcwYzJhZjRmNTIwNWZhIiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.zL_QGhD3Sj8lU0mOxOknz_4b8PIsTDCRUZFwYFXlX4w)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTJhMWFkOWEzMzExZGM4NDZlIiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.Dn3p1ghmHqGyUEAXVVijTvBt3aqPfg0uC8B9RrPYkv8)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTJhMWFkOWEzMzExZGM4NDZmIiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.BwI4weTXmpTG9m8clctlVZYIDEz1XojOyjCPth2edoY)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTI4OTcwYzJhZjRmNTIwNWZiIiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.SiRkM-21QEPj0gi08AWDTJ2WJoXH2ZCJADL0LggDQ_4)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTNhMWFkOWEzMzExZGM4NDcwIiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.JFx3HRjzfB8EhKRHQ2bFmXDpmECA9VDdsoNJG9Yiz0w)

 (image/svg+xml)    


[having filter优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTNhMWFkOWEzMzExZGM4NDcxIiwicmVmX2lkIjoiNjczOTZiYTI1OTNmOTljOWZmMjM2NTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDEwLCJleHAiOjE3ODIzODI0MTB9.lXDm2KSX9G8UwOeb0uSl7924dIRzgUadF0Gww_Zc8AM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
