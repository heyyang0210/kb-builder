Created by 许秋莹, last modified on 七月 29, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6618aacffd997db58ad7e8d9](https://pingcode.yasdb.com/pjm/items/6618aacffd997db58ad7e8d9)    ?    
  #YDBRD-26114 CTE支持递归功能

递归查询是CTE（Common Table Expressions，公共表表达式）的一个特性，它允许用户执行递归操作，从而可以查询具有层次结构的数据。本文档为cte支持递归功能的详细测试文档。

# 2. 需求分析

## 2.1 功能点分析

递归CTE基本语法如下：

```
recursive_cte = WITH cte_name ["(" (column_alias) {"," (column_alias)} ")"] AS "(" anchor_query (UNION ALL) recursive_query ")"

```

- **递归查询定义**  。  递归CTE允许在SQL中定义递归查询。它通过在CTE内部引用自身来实现递归。
- **递归成员定义**  。分为anchor_query 和recursive_query 
- **层次查询**  。  通过递归CTE，可以轻松地查询任意层级的数据，而无需事先知道层级的深度。
- **递归终止条件**  。  通常在递归成员的非递归部分完成，通过UNION ALL将递归步骤与终止条件分开。
- **性能考虑**  。


## 2.2 应用场景

- cte中用union all关键字定义递归cte，递归部分引用cte名称进行递归查询
- 支持部署模式：单机 集群
- 支持行表，列表暂不支持


## 2.3 规格约束

##### 语法：

1. recursive_query部分不可以单独存在。（引用本身CTE定义的时候就会被认为是递归CTE子句）
1. 单anchor_query时候会退化回既有的CTE功能。(    [Common Table Expression - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Common+Table+Expression)    )
1. 两个query之间连接符号需为  UNION ALL  （不能用其他类型，猜测可能是因为 递归不能死循环，所以不能有交集的 INTERSECT 和 MINUS）
1. anchor_query和recursive_query没什么顺序要求。可以调转顺序。
1. anchor_query和recursive_query的投影列  数量和CTE定义一致  、cte定义的投影列语法和column类似  **，**  都是  默认按大写存放。 anchor_query和CTE部分的投影列名称没有必然联系  ，可以不一致。
1. recursive_query中只能引用自身CTE一次。引用多次则报错。
1. recursive_query中特殊场景的限制：带distinct、带group、  aggr function、部分win function(当前yasdb内的窗口函数都支持)、带自身CTE的子查询、limit offset、order by
1. cte部分在join条件下，作为左右表并无区别，但是outer join下只能作为join的左表（非补空侧）


# 3. 详细测试设计

## 3.1 测试设计方法

*本测试设计主要采用等价类划分法，对cte 递归语句和非递归语句部分测试；另外，结合场景法进行cte造数据方面的测试*

## 3.2 详细测试设计

#### DFX测试

|e系统级DFX分类|是否涉及|
|:---|:---|
|CT|N|
|KT|N|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


#### 3.2.1 递归cte所在位置

|等价类|备注|
|---|---|
|from后定义cte|  
|
|where后定义cte|  
|
|having后定义cte|  
|
|join 前定义cte|- left join
- right join
- full join
- inner join
|
|join 后定义cte|  
|
|select后定义cte（作为投影列）|  
|


![](https://conf.yasdb.com/download/attachments/156110441/image2024-6-5_15-39-23.png?version=1&modificationDate=1717573164000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAyNDMsImV4cCI6MTc4MjMyMTA0M30.-pmnKF53BR5GP1h1v8U7XYhVeoXeYcDRDd-kNF2s6Zs)

#### 3.2.2   **anchor_query语句包**  含操作

|等价类|备注|
|---|---|
|order by 操作|  
|
|group by 操作|  
|
|distinct|  
|
|聚合函数|  
|
|窗口函数|  
|
|table function|  
|
|connect by|  
|
|grouping sets|  
|
|null值|- = null
- != null
- is null
- is not null
|
|包含子查询|- 关联子查询
- 非关联子查询
|
|包含union操作|只能出现一次，用于递归，所以不支持|


#### 3.2.3 recursive_query filter类型条件过滤

|等价类|条件|备注|
|---|---|---|
|where|比较运算符过滤：  =、!=、<、>、<=、>=   |  
|
|  
|逻辑运算符过滤：  AND、OR、NOT|  
|
|  
|模糊查询过滤：LIKE 、NOT LIKE、rlike、not rlike|  
|
|  
|空值检查过滤：IS NULL 、 IS NOT NULL ,= null 、 != null,  
|  
|
|  
|范围检查过滤：between and 、in 、 exists,in：,- in 常量
- in 单列
- in list
- in subq
|  
|
|  
|any / all / some|  
|
|  
|case when|  
|
|  
|窗口函数过滤：如：RANK、  ROW_NUMBER、RANK、NTILE|  
|
|  
|聚集函数过滤：如：  SUM、AVG、COUNT|不支持 报错需合理|
|  
|limit offset|  
|
|  
|order by |  
|
|  
|（+）|  
|
|having|同上|不支持 报错需合理|
|on,- left join
- right join
- full join
- inner join
|同上|  
|


#### 3.2.4 recursive_query filter条件值类型

|等价类|备注|
|---|---|
|常量|select * from tb1 where c1 = 1；|
|表达式|  
|
|函数|  
|
|普通子查询,- 标量子查询
- 非标量子查询
|  
|
|join子查询,- outer join
- inner join
|  
|
|可隐式转换列|  
|
|伪列,- ROWSCN
- ROWID
- ROWNUM
- USER
|  
|


#### 3.2.5 recursive_query 列数据类型

|等价类|备注|
|:---|:---|
|数值型：int, smallint, tinyint, bigint,float, double, number, |  
|
|字符型: CHAR, VARCHAR, NCHAR, NVARCHAR|  
|
|布尔型|  
|
|日期时间型:  day，time，timestamp，YtoM， DtoS|  
|
|大对象型：CLOB BLOB NCLOB|  
|
|RAW JSON ROWID|  
|
|- cte投影列与recursive_query列数据类型对应，与anchor_query对应
- cte投影列与recursive_query列数据类型对应，与anchor_query不对应
- cte投影列与recursive_query列数据类型不对应，与anchor_query对应
- cte投影列与recursive_query列数据类型不对应，与anchor_query不对应
|  
|


#### 3.2.6 recursive_query投影列类型

|等价类|备注|
|:---|:---|
|普通列|  
|
|子查询|  
|
|伪列|  
|
|窗口函数|  
|
|聚合函数|  
|
|表达式|  
|
|常量|  
|
|NULL|  
|
|udt 隐藏列|  
|
|hint|  
|
|random|  
|


#### 3.2.7 使用场景

|等价类|备注|
|---|---|
|PLSQL|  
|
|INSERT INTO tb1 SELECT (),- 作为投影列
- from 后
|  
|
|INSERT INTO|  
|
|MERGE |  
|
|UPDATE|  
|
|DELETE|  
|
|- CREATE TABLE AS
- CREATE VIEW AS
|create view as ...update|
|多个cte之间相互引用|  
|
|多个cte，包含递归cte和非递归cte|全引用和不全引用的情况|
|定义多个cte 每个cte是否用到(其中包含的cte覆盖一下3.4.5.6点),- with ...
- dml with... cte
- create table as ...cte
- create view as ...cte
- plsql ...cte
|- 每个定义的cte全部用上
- 部分cte用上
- 所有cte都没用上
|


####   
  3.2.8 cte返回行数和层数

|等价列|备注|
|---|---|
|返回0行|  
|
|返回单行|  
|
|返回多行|  
|
|返回>100行|  
|
|  
|  
|
|递归0层|  
|
|递归1层|  
|
|递归>100层|  
|
|**进入死循环**|1.是否正常报错?,规定1000层，超过则报错；,2.参数可以修改,  
,  
|
|是否有最大值？ 1000层递归|  
|


#### 3.2.9 cte语句名

|等价类|备注|
|---|---|
|大小写|```
with cte(c1) as(
  select * from a
  union all
  select c1 + 1 from CTE where cte.c1 < 5
)
select * from cte;
```|
|包含数值类型|- 中文
- 英文
- 特殊字符 # ￥ 5=% ^ ''
- 表情符号
- 其他国家语言
,  
|
|  
|  
|


#### 3.2.10 recursive_query限制 报错处理

|等价类|备注|
|---|---|
|connect by   |  
|
|distinct   |  
|
|group by|  
|
|aggr|  
|
|pivot   |  
|
|having   |  
|
|top/limit |  
|
|for update|  
|
|from中只能引用一次递归cte|  
|
|cte只能作为outer join的非补空边|  
|
|关键字非   **union all**,- **union **
- **minus**
- **minus all**
- **intersect **
- **intersect all**
|  
|
|关键字为union all，但没引用cte名|  
|
|列存不支持 |增加拦截用例|


#### 3.2.11 表类型

|等价类|备注|
|---|---|
|普通表|  
|
|复制表|  
|
|分区表|  
|
|视图|视图里面定义一个cte，访问此视图，查询视图操作|


#### 3.2.12 考虑anchor 和 recursive之间如何造数

  [https://oi-wiki.org/graph/scc/#tarjan-%E7%AE%97%E6%B3%95](https://oi-wiki.org/graph/scc/#tarjan-%E7%AE%97%E6%B3%95)  

- 数边
- 反组边
- 横叉边
- 前向边


#### 3.2.13 计划

与Oracle计划作对比，检查差异点是否会造成性能查或结果错误的问题

### 用例上库前 to do list：

- [x] 检查每个cte语句是否加了 order by   

- [x] 检查新建的视图 表 存储过程 是否删除   

- [x]  检查recursive关键字   

  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

  


# 5. 测试框架设计

- 本次测试采用yasft测试框架实现，执行sql文件，对比期望结果和实际输出结果，输出测试结果


# 6. 测试环境说明

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：15  *人天*

计划测试完成时间：2024/7/25

  


会议纪要：支持递归cte测试设计评审

与会人：许秋莹、马文英、谭思宇、陈秋富

会议时间：2024/7/9

会议地点：25#702 10:30 - 11:30

  
  纪要信息：

1. 增加create view as ...update 用例
1. 增加anchor 和 recursive 返回行数，考虑造数相关用例
1. 增加 递归部分 udt隐藏列用例
1. 列存增加拦截用例
1. 增加多个cte之间相互引用用例
1. 增加多个cte，包含递归cte和非递归cte（并且分全引用和不全引用的情况）
1. 增加递归部分 hint相关用例
1. 查询过程中出现非稳态的情况 例：random


  


评审通过与否：通过