Created by 李攀, last modified on 十一月 17, 2023

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

group by：全是常量的优化, 等价类列的优化

IR:       [YDBRD-11465](https://jira.yasdb.com/browse/YDBRD-11465)       -     group by优化     设计中

SR:     [[YDBRD-13710] Group by使用等价类优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13710)  

  [[YDBRD-13711] group by常量优化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13711)  

开发设计文档：    [详细设计 - 吴昊旻 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133574933)  

  


# 2. 需求分析

distinct及group by需要键值序列做去重，键值数量可缩减来加快执行效率；

缩减规则：

1. 当键值序列出现在谓词中，且键值符合等价类规则时，键值数量可缩减；
1. 当键值序列出现常量，但不全是常量时，常量可消除；
1. 当键值序列全部为常量时，保留一个常量；
1. 当去重列包含主键列和唯一键索引时，主键列已要求插入的数据非重复，返回的结果不会有重复值，可进行优化。


**支持的部署形态**  ：单机（行列），分布式，集群

## 2.1 功能点分析

1.  分组列中的每一个常量都是等价的，若分组列包含非常量列时，仅需对非常量列进行去重，若去重列全为常量时，仅需对其中一个常量进行分组，即能实现相同的效果。

2.分组列中包含属于同一等价类的列，返回的结果数据均相同，对哪一列分组都是等价的，因此可以仅对相同等价类内的某一列进行分组。

## 2.2 应用场景

  


优化器对group by进行优化，用于query中

## 2.3 规格约束

**2.3.1规格**

- 提取所有表的主键索引，消除无效的去重/分组列，消除distinct
- 消除去重/分组列中属于相同主键类的列
- 消除去重列中的常量
- 仅有distinct没有group by的时候，去重列包含汇聚函数消除distinct，直接走aggr
- 执行计划中打印去重有效列信息


1.把常量优化规则从tryOptmzRsCols中拿出来，做单独一个函数    
  2.等价类优化之后，要进行替换，即a,b from t1 where a=2 and b=2的时候，distinct expression会打印成 distinct expression（2）    
  3.等价类优化之后再做常量消除，如果a,b,'a' from t1 where a=2 and b=2的时候，等价类会替换成a=2,'a'，即为全常量的场景，再进一步做常量消除    
  4.移到trans阶段去做，将上述所有逻辑全部移到trans_unique和trans_group阶段去调用，消除和优化都挪（消除怎么挪没有想法，直接return COD_SUCCESS？）全常量的话走sorted distinct    
  并且加一个排序（这个排序是把distinct值大的放在前面，要用到统计信息，那就是还调用cost接口？）    
  5.groupingSet也要优化到

**2.3.2约束**

- 当前版本不支持多表场景下的distinct消除，对于多表的情况，统计信息会记录是否为唯一行，即主键特征，来确定是否需要消除distinct
- 当前版本不支持对唯一键索引的distinct消除
- 同时存在distinct和groupby的时候，当分组列为去重列的子集时，消除distinct，保留groupby（都有去重作用）
- 当返回结果只有一条时（通过cbo_stats中max_row判断)，消除distinct。
- 规则3、4可以放在trans_unique阶段做，入口函数为isUniqueRemovable


  


# 3. 详细测试设计

## 3.1 测试设计方法

1. 主要采用等价类划和场景覆盖法的测试用例设计方法


## 3.2 详细测试设计

 DFX涉及点如下：

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


  


详细功能点设计：

|输入条件1|条件2|有效等价类|备注（测试点，预期）|无效等价类|备注|
|:---|---|:---|:---|:---|:---|
|优化点|常量优化|常量和列组合，分组表达式去掉常量|如：group by 1,2,c1  预期 是group by c1|  
|  
|
|  
||全常量,对其中一个cost值最小的常量进行分组|如：group by 1,2,3  ,    group by by false,1,'test',null,|没有常量|  
|
||含有表达式常量||group by 4,2+3,group by1+1,2+3|  
|  
|
||唯一键优化 |主键索引优化|goup by c1,c2 (c1是主键)，分组表达式预期是group by c1|  
|  
|
|||  
|主键列为单列|  
|  
|
|||  
|主键列为多列 |  
|  
|
|||唯一索引|通过给列创建unique约束，goup by c1,c2 (c1列有unique约束)，分组表达式预期是group by c1|  
|  
|
|||  
|多列唯一键|  
|  
|
|||  
|create unique index --普通索引，group by goup by c1,c2 (c1列为unique索引列）|  
|  
|
|||  
|create unique index --函数索引 group by c1+1,c2(c1+1为函数索引表达式)|  
|  
|
|||  
|create unique index --函数索引|  
|  
|
|||  
|全局/分区索引|  
|  
|
|||  
|反向唯一索引|非唯一索引|  
|
|||  
|索引属性usable，正常使用|unusable|不会被用当成唯一键进行优化|
|||  
|索引属性visable,正常可以生产优化计划|invisable（列存默认为invisable）|不能被优化器使用，无法，无法生成group by优化计划|
||等价类优化|having filter 使用= 来使多列等价|group by c1,c2 having c1 = c2|  
|  
|
|||  
|group by c1,c2，c3 having c1 = c2 and c2=c3 |2列为非等价列   group by c1,c2 having c1 >=c2|不优化|
|||数据类型 |  
|  
|  
|
|||  
|group by c1,c2,c3 having c1 = c2|  
|  
|
|||  
|多表   group by t1.c1,t2.c2 having t1.c1 = t2.c2  ,  
|  
|  
|
|||  
|group by c1,c2，c3 having c1 = 2 and c2=2 |  
|  
|
|||join on 后|s  elect   t1.id,t2.id,t2.age from t1 left join t2 on t1.id = t2.id group by t1.id,t2.id,t2.age;,  
,select   t1.  id  ,  t2.  id  ,  t1.  age  ,  t2.  age   from   t1   left join   t2    on   t1.  id   = t2.  id   where   t1.  age  =t2.  age   group by   t1.  id  ,  t2.  id  ,  t1.  age  ,  t2.  age  ;|  
|  
|
|场景覆盖|dml|insert  into select|  
|  
|  
|
|  
|  
|update   select |  
|  
|  
|
|  
|谓词下推|  
|  
|  
|  
|
|  
|  
|delete ...select|  
|  
|  
|
|  
|  
|merge|  
|  
|  
|
|  
|ddl|create as select|  
|  
|  
|
|  
|表类型|行表|  
|  
|  
|
|  
|  
|列表|  
|  
|  
|
|  
|  
|临时表|  
|  
|  
|
|  
|  
|分区表|  
|  
|  
|
|  
|join|inner join|  
|  
|  
|
|  
|  
|left/right/full|  
|  
|  
|
|  
|  
|semi/anti|  
|  
|  
|
|  
|cte|  
|  
|  
|  
|
|  
|视图|普通视图|dba视图、系统表、动态视图|  
|  
|
|  
|  
|物化视图|  
|  
|  
|
|  
|  
|dblink|  
|  
|  
|
|  
|子查询|关联子查询|  
|  
|  
|
|  
|  
|非关联子查询|  
|  
|  
|
|  
|  
|子查询嵌套|  
|  
|  
|
|  
|  
|子查询位置：,select/from/where|  
|  
|  
|
|  
|where/having|比较符号：  =, >, >=, <, <=, <>|  
|  
|  
|
|  
|  
|between and , in , exists, any, all, NULL判断|  
|  
|  
|
|  
|  
|and, or|  
|  
|  
|
|  
|  
|常量，列，表达式，函数，子查询，伪列，外部引用，sysdate|  
|  
|  
|
|  
|  
|CASE... WHEN|  
|  
|  
|
|  
|group列|列，常量，表达式，标量子查询，普通函数，窗口函数，聚合函数，case...when...，bool exp|  
|  
|  
|
|  
|  
|投影列类型：|数据类型覆盖|  
|  
|
|  
|  
|  
|外部引用|  
|  
|
|  
|  
|投影列上有约束|  
|  
|  
|
|  
|  
|投影列上有索引|  
|  
|  
|
|  
|和distinct结合|当分组列为去重列的子集时|- 同时存在distinct和groupby的时候，当分组列为去重列的子集时，消除distinct，保留groupby（都有去重作用）
- select distinct age, c4,count(age) from t1 group by age, c4;
|  
|  
|
|  
|  
|聚集函数+distinct+group by|保留aggr 和group ,消除distinct|  
|  
|
|  
|group by|同投影列|  
|  
|  
|
|  
|  
|grouping sets，rollup，cube|  
|  
|  
|
|  
|  
|伪列：rownum，rowid,level|  
|  
|  
|
|  
|limit|  
|  
|  
|  
|
|  
|集合操作|union，union all|  
|  
|  
|
|  
|  
|intersect，intersect all|  
|  
|  
|
|  
|  
|minus，minus al|  
|  
|  
|
|  
|  
|绑定参数|  
|  
|  
|
|  
|部署形态|单机/分布式/集群|  
|  
|  
|


# 4. 测试用例

  


[group by优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTVhMWFkOWEzMzExZGM4NDAyIiwicmVmX2lkIjoiNjczOTZiOTU1OTNmOTljOWZmMjM2NDdlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjEyLCJleHAiOjE3ODIzODIwMTJ9._W8UgZYDWjtktRxqp-h-FYeFG328nkkY7o5V7X_xEvQ)

  


# 5. 测试框架设计

不涉及

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：7   *人天*

计划测试完成时间：

  


## Attachments:

[group by优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTVhMWFkOWEzMzExZGM4NDAyIiwicmVmX2lkIjoiNjczOTZiOTU1OTNmOTljOWZmMjM2NDdlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjEyLCJleHAiOjE3ODIzODIwMTJ9._W8UgZYDWjtktRxqp-h-FYeFG328nkkY7o5V7X_xEvQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,补充绑定参数,  
,Posted by kongkeyu at 十一月 02, 2023 16:10|
|---|
