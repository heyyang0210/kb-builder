Created by 李攀, last modified on 七月 02, 2024

# 1. 概述

本文描述列执行引擎支持 执行态hash join条件下推测试设计。

  


## 1.1 相关文档

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf42](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf42)    ? #YASHAN-1078 执行态hash join条件下推

SR链接：    [https://pingcode.yasdb.com/pjm/items/66194363fd997db58ad8c1a4](https://pingcode.yasdb.com/pjm/items/66194363fd997db58ad8c1a4)    ? #YDBRD-26329 执行态hash join条件下推

开发设计文档：    [执行态hash join条件下推 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156108443)  

  


# 2. 需求分析

hash join流程：

HASH JOIN是将左表（build plan）物化，右表（probe plan）通过HASH算法从左表查找满足join条件的数据。仅支持等值查询。

build表为小表，probe 表为大表，通过build 表在内存中构建hash table。

![](https://pingcode.yasdb.com/atlas/files/public/67396db28970c2af4f5214a5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA4OTYsImV4cCI6MTc4MjMyMTY5Nn0.oK-j5HbUidDoEPCkr9aY_kWybcNRwGkbBNqvZTf1_8E)

## 2.1 功能点分析

- hash join的build侧在原始值比较少的情况下，支持下推所有值到probe侧，利用存储稀疏索引加速。


  


   执行流程：

- 在构建hash table的时候，记录key的原始值，如果构建完成后原始值的数量较少（不超过16），则将原值下推到probe侧。
- 判断probe的表达式类型，只有是column的时候才会生效。
- 如果左右类型不相等，对下推的column做一次cast，如果cast失败则不生效。
- 遍历
    - 将一列中每一行的值取出，生成一个PointRange
    - 将每列所有PointRange组成一个RangeChain
    - 将所有RangeChain组合成一个数组，调用之前索引的接口，对RangeSet执行bind操作，生成一个BoundFilterRangeSet


示例：

## 2.2 应用场景

- hash join在执行时会先扫描右表所有数据，建立hash table，然后使用hash table对probe表数据过滤，生成最终结果。
- 对于右表数据量比较少的情况，可以将原值直接下推到左表的table scan层，进行比较过滤


## 2.3 规格约束

- 部署形态：单机列表、分布式 的LSC表，tac没有稀疏索引
- join     condition一定是等值连接，即左表列=右表列
- 仅支持100个以内的条件（即hash join build结束后，build表的行数不多于100行）
- 左边的表达式必须是column，比如常量，否则不生效,比如  t1.2=t2.c1


  


# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用场景法以及边等价类划分法进行测试设计，对于边界场景：如果构建完成后原始值的数量较少（不超过100）这条使用边界值法进行测试用例设计。

测试策略：现有库上已有较多的hash join用例，所以对于hash  join本身功能不需要测试太多，可以将现有hash join相关的用例提取，开启  alter system set bloom_filter_factor=1; 该参数开启布隆过滤器将build表结果下推到probe表做过滤。将开启后执行用例得到的结果和预期结果进行比对。

数据库中默认bloom_filter_factor=0.3，用例中如果强制开启用alter session 级别，不然设置后用例结尾需要恢复默认值。

然后针对性能场景，和一些基本场景需要进行用例设计，编写用例进行测试验证。

## 3.2 详细测试设计

*1.使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

*用例中，建表后，先收集统计信息，这样CBO才能选较优的执行计划*

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|join的表类型|  
|普通lsc表|  
|  
|  
|
|  
|  
|分布式的分布表|create sharded table .....organization lsc|  
|  
|
|  
|  
|分布式复制表|create duplicated table .....organization lsc|  
|  
|
|  
|分区表|一级分区：,- hash分区
- range分区
- list分区
|  
|  
|  
|
|  
|  
|二级分区表:覆盖1 到2种表类型即可|分布表一级分区仅支持hash分区,只涉及：,- hash-range
-  hash-hash
- hash-list
|  
|  
|
|join类型|  
|hash  join left,hash  join right,hash full join,hash inner join,hash join semi,hash join anti,  
|  
|  
|  
|
|表大小|  
|build表的行数小于16行,,- 左右表均小于16行
- build表大于16行，probe表小于100行（这个场景好像没法构建）
,  
|t1.id=t2.id and t1.id<100|build表的行数大于100行|不下推|
|  
|  
|build表的行数等于于100行|  
|  
|  
|
|连接方式|  
|等值连接|  
|非等值连接|不走hash join|
|filter|filter表达式类型|  
,probe表达式类型是colum,右表是column |  [t1.id](http://t1.id)    =t2.id+1|probe不是column       [t2.id](http://t1.id)    =2,probe表达式类型是colum,右表不是column 使用hint走hash|不下推,走不到hash,  
|
|  
|  
|probe连接条件是函数表达式入参是column，覆盖一下场景函数：如cast,decode、to_date 等,  
|  
|  
|  
|
|  
|filter类型|  
,左右类型不相同可以转换,数据类型转换情况组合：可以隐士转换的数据类型互相组合,数值型：tinyint，smallint，int, bigint，number, float, double,字符型：char, varchar, raw,时间类型：data, time，timestamp，interval,布尔型：bool,lob|  
|左右类型不相同可以转换,非法数据类型转换：,如t1 c1列int 类型  t2 c2列varchar 含有非numer字符,hash 连接条件 t1.c1=t2.c2,  
,  
|报错|
|  
|  
|filter中含有cast函数进行类型转换|  [t1.id](http://t1.id)    =cast(    [t2.](http://t2.id)    c1 as int)+1|  
|  
|
|  
|join 的列数|hash join 条件为单列,hash join 条件为多列：,and 、or 谓词连接的多个condition,复杂filter,  
|  
|  
|  
|
|  
|null  值|build表是空表|  
|  
|  
|
|  
|  
|build表用于连接条件的列全是null值|  
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
|表数量|  
|2,多个表连接join|  
,复杂sql|  
|  
|
|数据量|  
|probe表数据量较多 ，  1000万  以上,,probe表distinct  值在1000万以上,构造其他数据量，比如10万，10万,build表一条数据,  
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
|绑定参数的下推情况|PLSQL中使用绑定参数|  
|  
|  
|
|  
|  
|JDBC绑定参数：guider绑定参数写法|select * from t1 left join t2 on t1.id = t2.id and t2.id>? and t1.name<>?;    
  @bind    
  {    
  int 123 str 'abc'    
  }|  
|  
|
|算子组合|  
|语句中含有order by，limit，group by|  
|  
|  
|
|  
|  
|和nested loop 组合,和mrge join 组合|  
|  
|  
|
|dml|  
|在 cte中|  
|  
|  
|
|  
|  
|在delete,update ,insert select 中|  
|  
|  
|
|build表类型|  
|构建hash table的表是一个子查询|select count(*) from (sbuq) t1 join t2 on ..,t1是子查询|  
|  
|
|  
|  
|系统视图|  
|  
|  
|
|  
|  
|物化视图|  
|  
|  
|
|开启hash join 并行|  
|  
|alter session set DEGREE_OF_PARALLEL = 8;|  
|  
|
|带LSC唯一索引的情况|  
|  
|创建主键，连接列是索引列|  
|  
|


*2.*  *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，  多个 hash join 查询并发|
|KT|是|
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
|性能|是，比较条件下推和不下推的性能，构造不同数据量的场景|
|可维护性|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  


文本用例       电子表

# 5. 测试框架设计

1. 功能测试guider框架已满足
1. ct/kt，testkill框架可满足


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *人天*

计划测试完成时间

  


  


测试设计评审纪要    
    
  与会人：    
    
  评审时间：2024-7.2    
    
  评审地点：腾讯会议    
    
  评审纪要信息：

  


1.性能提升没有目标值

2.遗留点：LSC带索引和没带索引扫描，测试一下表现看是走索引还是稀疏索引下推，*走索引就用不到稀疏索引了，只有走table scan才下推

3.LSC支持唯一索引，主键 index scan 和table full scan性能比较

4.有排序的效果比较好，建表的时候有order by key

5.表中有一部分动态， 一部分静态数据，动态可以手动转换为冷数据

                         

                         

   评审通过与否：通过

## Attachments: