Created by 李攀, last modified by  马文英 on 四月 25, 2024

  


设计文档地址：    [Bitmap Or 特性设计文档 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150606841)  

# **1. 概述**

### index combine

oracle支持index combine功能，最早是用在bitmap index上的，在9i开始oracle默认可以使用在btree索引上，这是由_b_tree_bitmap_plans参数来控制的。

oracle将btree索引中获得的rowid信息通过BITMAP CONVERSION FROM ROWIDS的步骤转换成bitmap进行匹配，然后匹配完成后通过BITMAP CONVERSION TO ROWIDS再转换出rowid获得数据或者回表获得数据。

  


### bitmap or

bitmap or用于多索引or查询场景，如select * from t2 where id=100 or age = 20; 在id和age都存在单列btree索引的情况下，oracle可以利用这两个索引。优化器根据CBO代价模型，可能会生成利用bitmap or的计划，总共分为三步：

1. 利用id列的索引得到id=100的rowid，通过BITMAP CONVERSION FROM ROWIDS将rowid转换为bitmap。
1. 利用age列的索引得到age=20的rowid，通过BITMAP CONVERSION FROM ROWIDS将rowid转换为bitmap。
1. 对两个bitmap执行bitmap or操作，得到最终的bitmap
1. 通过BITMAP CONVERSION TO ROWIDS将最终的bitmap转换为rowid集合
1. 回表得到数据


# **2. 需求分析**

功能特性：

支持bitmap PLAN算子，优化器根据or 谓词匹配什么情况下会走bitmap or计划，可能存在即使用了or连接的两个condition都使用到了单列索引，也不会走bitmap or计划，原因是可能走bitmap or花费的cost要大与不走bitmap or。

  


以下列出哪些情况下可以走  bitmap or计划的具体规格说明：

  


规格与约束：

index or的实现，支持使用多索引（与执行配合，支持index or的bitmap操作）。    
  index or 选择多索引后，在执行实现基于rowid的bitmap，即执行支持rowid bitmap算子

  


# 3.   **测试设计方法**   

等价类划分,

单机：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|---|:---|:---|:---|:---|
|  
|索引类型|多个单列索引，查询谓词使用or连接,  
|or 连接的condition能选索引|组合索引|  
|
|  
|  
|多个单列desc 索引|  
|  
|  
|
|  
|  
|desc+asc 组合|  
|  
|  
|
|  
|  
|多个基于单列操作的函数索引 |  
|基于多列操作的函数索引,如 create index ..on ..(c1+c2)|  
|
|  
|  
|分区表分区（local）索引|  
|  
|  
|
|  
|  
|反向索引|  
|  
|  
|
|  
|走索引扫描的filter类型|>，<， >=， <=，!=，<>|  
|any,some,all|  
|
|  
|  
|in|  
|not in|  
|
|  
|  
|between and,  
|  
|like/not like|  
|
|  
|  
|is null|  
|  
|  
|
|  
|索引扫描组合|INDEX RANGE SCAN+INDEX RANGE SCAN|  
|  
|  
|
|  
|  
|INDEX RANGE SCAN+INDEX full SCAN|  
|  
|  
|
|  
|  
|INDEX RANGE SCAN+INDEX fast full SCAN|  
|  
|  
|
|  
|  
|INDEX RANGE SCAN+INDEX fast full SCAN|  
|  
|  
|
|  
|  
|INDEX RANGE SCAN+INDEX_UNIQUE_SCAN|  
|  
|  
|
|  
|  
|INDEX RANGE SCAN+  INDEX RANGE SCAN (MIN/MAX)|  
|  
|  
|
|  
|  
|INDEX FULL SCAN DESCENDING|  
|  
|  
|
|  
|  
|INDEX FULL SCAN DESCENDING|  
|  
|  
|
|  
|  
|INDEX RANGE SCAN DESCENDING|  
|  
|  
|
|  
|场景|投影的列都是索引列,如select a1,a2 from t where a1=? or a2=? ;|bitmap 都会走回表 |  
|  
|
|  
|  
|投影列含有不是索引的列,select a1,a2,a3,a4 from t where a1=? or a2=? ;|bitmap 都会走回表|  
|  
|
|  
|  
|order  by|  
|  
|  
|
|  
|  
|子查询|  
|  
|  
|
|  
|  
|cte|  
|  
|  
|
|  
|算子组合|table access full,order by,group by,limit,join(  hash join、merge join  ),distinct,  
|  
|  
|  
|
|  
|condition 个数|or谓词连接2个condition（条件为=）加索引类型|  
|6个condition，最大支持5个|  
|
|  
|  
|or谓词连接2个condition（条件为= 和<=等组合）|  
|  
|  
|
|  
|  
|3个condition|  
|  
|  
|
|  
|  
|4个condition|  
|  
|  
|
|  
|  
|5个condition|  
|  
|  
|
|  
|与不走索引的condition组合|例如：a1,a2,a3,a4,a5 1，2，3有索引，4，5没有索引,condition 为：a1=2 or a2=3 or a4=3,a1=? or a4=? or a2=?,a4=? or a5=? or a2=?  or a1=?,a1>=2 or a2<=3 or a4=1|  
|  
|  
|
|  
|condition含有()的情况|(a1>=2 or a2<=3 ）or a4=1|可以走  bitmap or|  
|  
|
|  
|  
|(a1>=2 or a4<=3 ）or a2=1|  
|  
|  
|
|  
|filter列数据类型覆盖|int，varchar ,char,  timestamp,time,  interval year to month,boolean等|  
|  
|  
|
|  
|表类型|heap|  
,  
|  
|  
|
|  
|  
|hash 分区表,list分区表,range 分区表,创建本地分区表local索引|  
|  
|  
|
|  
|含有nulll和空数据|filter含有null ,和’‘数据|  
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
|  
|  
|  
|  
|
|explain |  
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


# 4.   **详细测试设计**

  


# 5.   **测试用例**

文本用例：

  


# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

## Comments:

|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396d03a1ad9a3311dc8e42/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDUyMzcsImV4cCI6MTc4MjMxNjAzN30.GrTynjvm09fqtBkrgM80AHYJVZuThueEGEGVA-FbJig),Posted by mawenying at 五月 15, 2024 18:48|
|---|
