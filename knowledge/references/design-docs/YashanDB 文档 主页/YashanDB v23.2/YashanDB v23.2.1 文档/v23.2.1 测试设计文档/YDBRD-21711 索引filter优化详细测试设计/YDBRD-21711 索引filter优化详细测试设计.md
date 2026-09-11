Created by 刘清萍, last modified on 一月 24, 2024

# **1. 概述**

本文描述功能的测试设计。

SR：    [YDBRD-21711](https://jira.yasdb.com/browse/YDBRD-21711?src=confmacro)    -  索引Filter优化  完成

开发设计文档：    [索引谓词优化 - 特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138543512)  

测试文档：    [索引filter 优化测试调研 - 李攀 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133575062)  

# **2. 需求分析**

需求描述：扫描算子上的Filter，如果属于某个索引，可以在执行完索引rangeset后直接执行，减少回表操作的数量。

需求范围：单机和集群

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|filter拆分与转换|1. 在优化时，需要将scan上的filter拆分成三个。主要为：回表才能执行的filt
1. er、索引上执行的filter、索引rangeSet对应的Filter。
1. 在实现中，拆分的流程如下：
    1. 先讲filter拆成索引相关和非索引相关filter
    1. 对于索引相关filter，传入原本rangeset生成逻辑，从而生成rangeset，之后将rangeset转化成索引rangeSet对应的Filter
    1. 结合rangeFilter对原indexFilter做拆分，得到索引上执行的Filter
|是|是|
|功能|index Cost优化|1. 重构index scan中计算rangeSelectivity的接口，结合rangeFilter实现新的Index Io Blocks计算
|是|是|
|功能|explain index优化|1. 在打印的条数上，也区分开index scan的过滤条数和access的过滤条数
1. 同时区分开
|是|是|
|性能|index scan性能提升|1. index scan在有回表且回表条件可以放在index上时，性能较之前版本有提升。
|是|是|


|归类|EXPLAIN打印项|说明|  
|研发资料链接|
|:---|:---|:---|---|:---|
|索引扫描算子|INDEX UNIQUE SCAN|唯一索引扫描，仅仅适用于where条件是等值查询的SQL，且  结果最多返回一条记录,若创建组合索引，则组合索引列都参与到filter中才会走到索引唯一扫描|explain select * from t1 where c1 =1;|  [Btree Scan - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Btree+Scan)  |
||INDEX RANGE SCAN DESCENDING|索引范围降序扫描,  
|explain select c1,c2 from t1 where c1 in (1,2) order by c1 desc;|  
|
||INDEX RANGE SCAN|区间查询，返回结果不止一条,当扫描对象是唯一索引时，  在唯一索引列上使用了range操作符  （between、<、>）；,扫描对象是非唯一性索引时，则没有限制（exists,like【通配符在前边】，not in不会走），  组合索引，前导列要在fileter中  。,  
|explain select c1,c2 from t1 where c1 in (1,2) order by c1;|  
|
||skip scan|适用于组合索引，  当过滤条件中不存在索引前置列，并且前置列的distinct值比较少时,索引列前面的列基数小（列值相比于行数非常少），将一个查询，根据索引前面列的值进行拆分，拆分成多个查询,,例如： 有个索引建在列（gender，email），gender只有2个值：男和女,select * from customers where email =       ['a@b.company.com](null)    ' 就可以拆分为两个查询：,select * from customers where gender = '男' and email =       ['a@b.company.com](null)    ' union all select * from customers where gender = '女' and email =       ['a@b.company.com](null)    '|  
|  
|
||INDEX FULL SCAN DESCENDING|索引降序全扫描,  
|explain select c1 from t1 order by c1 desc;|  
|
||INDEX FULL SCAN|索引全扫描。,如果有索引包含了查询的所有列，同时需要使用索引的前导列排序，  CBO可能会有优先使用INDEX FULL SCAN,explain select c1 from t1 where c1 not in (1) order by c1；|explain select c1 from t1 order by c1；|  
|
||INDEX FAST FULL SCAN|索引快速全扫描。类似索引全扫描，但扫描结果不是有序的。,当SELECT中的投影列全部在索引键中时，CBO将考虑使用INDEX FAST FULL SCAN,组合索引更容易走到|explain select c1 from t1 ；|  
|
||INDEX FULL SCAN (MIN/MAX)|针对min、max函数优化，只返回一条记录,tac多表不支持|explain select min(c1) from t1 order by c1；|  
|
||INDEX RANGE SCAN (MIN/MAX)|针对min、max函数优化，只返回一条记录,tac多表不支持|explain select min(c1) from t1 where c1 >3 order by c1；|  
|


# **3. 测试**  **设计方法**   

1.对索引是否优化条件采用等价类划分方法进行用例设计

2.对子查询，CTE,DML等SQL场景应用采用场景覆盖法进行用例设计，覆盖sql中用到每一种场景

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
|性能|是|测试和没有优化之前的性能对比|
|资料|是|测试开发设计文档和资料网站文档内容描述|


# 4.   **详细测试设计**

**之前索引文本用例整理:   yasft\standalone\testcase\ddl_02\index**

|输入条件|有效等价类|预期|备注|
|---|---|---|---|
|索引类型（红色标注为不做优化的）|唯一索引-----like加通配符|  
|不回表的下推,回表的不下推|
|  
|反向索引|  
|cost也不搞|
|  
|组合索引|  
|不能有函数索引|
|  
|指定索引列的同时指定排序方式   （  desc|asc）|  
|  
|
|  
|列式索引|  
|  
|
|  
|函数索引---------oracle支持 yashan目前只显示cost值|  
|  
|
|  
|RTREE索引------不做优化 只是cost之前在索引上 现在在表上|  
|  
|
|  
|分区索引|  
|  
|
|filter条件覆盖|filter条件 = >,<,<=，>=,!=|  
|like有通配符不生成range set     “1%”|
|  
|filter条件 like,not like,rlike,not rlike， in/not in, |  
|  
,![](https://conf.yasdb.com/download/attachments/141573187/image2024-1-9_9-39-54.png?version=1&modificationDate=1704764394910&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYwNDEsImV4cCI6MTc4MjMwNjg0MX0.wEcc7pYlByei55GBec8_kQVlUjnFKa4rxclgfMI5_C0),  
    
    
    
    
    
    
    
|
|  
|exists/not exists, is null/is not null|  
||
|  
|外部引用|  
||
|  
|between and|  
||
|  
|+ - * /|  
||
|  
|case when|  
||
|  
|and or 嵌套多个条件|  
||
|  
|any all some|  
||
|filter位置|where----filter条件|  
||
|  
|having---算子组合|  
|  
|
|  
|join on----join类型|  
|  
|
||visiable|  
|  
|
|  
|usable|  
|  
|
|  
|online|  
|  
|
|  
|INITRANS|  
|  
|
|算子组合|order by|  
|  
|
|  
|group by|  
|  
|
|  
|limit|  
|  
|
|  
|distinct|  
|  
|
|  
|  [多表索引扫描算子测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133570016)  |  
|  
|
|场景|dml----delete、update、insert、create table as select|  
|  
|
|  
|集合操作union/ union all/intersect/intersect all/minus|  
|  
|
|  
|connect by|  
|  
|
|  
|cte|  
|  
|
|子查询|标量子查询,多行子查询,关联查询|  
|  
|
|join on类型|where ,inner,left out,full out,right out|  
|  
|
|表类型（单机集群分布式）|行表|  
|  
|
|  
|列表-------不走行执行拦截|  
|  
|
|性能|100W  优化和不优化场景性能结果对比，预期比master要好,500w数据量 优化和不优化场景性能结果对比，预期比master要好|  
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

工作量：13  *人天*

计划测试完成时间：2024/1/24

  


测试设计评审纪要    
    
  与会人：刘清萍、孔珂煜、李攀、王泽凯、陈关羽    
    
  评审时间：2024/1/8 16:30-17:30    
    
  评审地点：腾讯会议    
  会议主题：索引filter优化测试设计评审    
    
  评审纪要信息：    
    
  1.补充索引属性相关测试点

2.补充filter出现位置，filter条件关注组合情况，计划是否正确

3.关注行转列情况，上车有出现此类失败

4.开发补充不走rangeset的filter

  
  评审通过与否：通过

## Attachments:

[image2023-12-29_17-40-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTNhMWFkOWEzMzExZGM4NDc1IiwicmVmX2lkIjoiNjczOTZiYTM1OTNmOTljOWZmMjM2NTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDQxLCJleHAiOjE3ODIzODI0NDF9._XSzLL4tKkx01uGiqh3HLxCEInrOfKXKv29vYU_AcoU)

 (image/png)    


[索引filter优化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTM4OTcwYzJhZjRmNTIwNWZmIiwicmVmX2lkIjoiNjczOTZiYTM1OTNmOTljOWZmMjM2NTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDQxLCJleHAiOjE3ODIzODI0NDF9.mDCCISO7yTpZm3GExOfmhygkTgjsGDiiU8y3IPQ6rio)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-1-9_9-39-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTM4OTcwYzJhZjRmNTIwNjAxIiwicmVmX2lkIjoiNjczOTZiYTM1OTNmOTljOWZmMjM2NTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDQxLCJleHAiOjE3ODIzODI0NDF9.SxyyHmN6mYpdS65TMI2LOh77gjTrkndUG9n9D1vI5JE)

 (image/png)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTM4OTcwYzJhZjRmNTIwNjAzIiwicmVmX2lkIjoiNjczOTZiYTM1OTNmOTljOWZmMjM2NTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDQxLCJleHAiOjE3ODIzODI0NDF9.8z8USrTVAr9Tde7_OF728su9_dU4oUJwxI9LQseP46E)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTNhMWFkOWEzMzExZGM4NDc3IiwicmVmX2lkIjoiNjczOTZiYTM1OTNmOTljOWZmMjM2NTMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDQxLCJleHAiOjE3ODIzODI0NDF9.ZF4PxSQIr2x0Ewwn9c4-5MaRuOq2_LbCNytYaYhMZ3U)

 (image/svg+xml)    
