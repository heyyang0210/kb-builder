Created by 许秋莹, last modified on 十二月 29, 2023

# 1. 概述

本文为YDBRD-21540 窗口函数支持DN上执行-优化器的详细测试设计。

**SR: **    [YDBRD-21540](https://jira.yasdb.com/browse/YDBRD-21540?src=confmacro)    -  窗口函数支持DN上执行-优化器  完成

# 2. 需求分析

## 2.1 功能点分析

- 为了加快window function对SQL语句的执行速度，减少网络数据交互，可以把窗口函数的执行放到数据节点（dn）上执行。
- 执行含有     WINDOW FUNCTION     的 SQL语句时 (格式一般为     OVER(...)  ），都会在生成执行计划的时候分配一个     WINDOW FUNCTION     算子。


**       窗口函数的通用语法：**

![](https://pingcode.yasdb.com/atlas/files/public/67396b9f8970c2af4f5205dc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQ0FBQUFBQUlBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFRQUFBQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFFQUFBZ0FnQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFDQUFBQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU4OTMsImV4cCI6MTc4MjMwNjY5M30.cXNaBzN2SX8AnvIY-GOO0QO-BPbfv0K1xoD3hH5bFLY)

```
WINDOW_FUNC = WINDOW_FUNC([func_parameter]) OVER ([query_partition_clause] [order_by_clause [ windowing_clause]])

##query_partition_clause用于对表数据进行分组，可省略，则表示所有数据为一个分组。expr不能为NULL，且可以为 列字段、常量表达式
query_partition_clause = PARTITION BY (expr {"," expr}|("(" expr {"," expr} ")")).

##order_by_clause用于对分组内的数据行进行排序，可省略。语法同SELECT语句中的order_by_clause描述
order_by_clause = ORDER BY ((expr | position | c_alias) [ASC|DESC] [(NULLS FIRST) | (NULLS LAST)]) {"," ((expr | position | c_alias) [ASC|DESC] [(NULLS FIRST) | (NULLS LAST)])}.

##windowing_clause用于对分组内的数据行进行进一步的筛选，每个分组通过BETWEEN ...AND自定义各自的窗口行范围，即滑动窗口，只有部分窗口函数可以使用此功能。
##此功能需要与order_by_clause结合使用，保证筛选的基础为有序的行集合
windowing_clause = (ROWS|RANGE) ((BETWEEN (UNBOUNDED PRECEDING|CURRENT ROW|value_expr(PRECEDING|FOLLOWING)) AND (UNBOUNDED FOLLOWING|CURRENT ROW|value_expr (PRECEDING|FOLLOWING)))|(UNBOUNDED PRECEDING|CURRENT ROW|value_expr PRECEDING)).
```

  


## 2.2 应用场景

- 专用的窗口函数：     [DENSE_RANK](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/DENSE_RANK)    、    [FIRST_VALUE](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/FIRST_VALUE)    、    [LAG](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LAG)    、    [LAST_VALUE](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LAST_VALUE)    、    [LEAD](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LEAD)    、    [RANK](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/RANK)    、    [ROW_NUMBER](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ROW_NUMBER)    、    [MEDIAN](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/MEDIAN)  
- 部分其他类型的函数也可作为窗口函数使用，通过over关键字识别：      [AVG](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/AVG)    、    [COUNT](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/COUNT)    、    [LISTAGG](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LISTAGG)    、    [MAX](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/MAX)    、    [MIN](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/MIN)    、    [SUM](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SUM)  


## 2.3 规格约束

- 窗口函数的分区键为常量值时，不下推
- 窗口移动需要配合order by子句一起使用  ，如果没有order by，数据没有做排序，滑动窗口计算出来的数据会出现随机的问题。
- 不支持的特性，partkey为子查询，聚集函数


# 3. 详细测试设计

## 3.1 测试设计方法

*本文测试设计主要根据窗口函数的语法类型，进行等价类划分、边界值测试；下推的结果进行CT/KT和压力测试，与master进行比较。*

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|测试点|
|:---|:---|---|
|CT|是|窗口函数下推到dn与对基表进行ddl，dml的场景进行并发|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|是|与master执行时间对比，相同场景下不比master执行时间慢|
|可维护性|  
|  
|


#### **3.2.1 表类型**

|等价类|备注|
|---|---|
|分布表|  
|
|复制表|  
|
|系统表|  
|
|分区表|一级分区表    
  二级分区表|


  


**3.2.2 出现位置**

|等价类|备注|
|---|---|
|投影列|  
|
|filter,- where
- having
- on
,  
,and / or filter|where winfunc = c1,where winfunc = winfunc,on winfunc = c1,on winfunc = winfunc,having winfunc = c1,having winfunc = winfunc|
|子查询|from子查询,投影  列子查询,where 子查询,JOIN 子查询,ON 子查询,GROUP BY 子查询,ORDER BY 子查询,关联子查询,非关联子查询|
|order by 子句|  
|
|group by|  
|
|dml|insert into ...select window_function...,update where select ,delete where select|


  


**3.2.3 窗口函数**

|等价类|备注|
|---|---|
|专用的窗口函数：,- DENSE_RANK
- FIRST_VALUE
- LAG
- LAST_VALUE
- LEAD
- RANK
- ROW_NUMBER
- MEDIAN
|  
|
|其他类型的函数：,- AVG
- COUNT
- LISTAGG
- MAX
- MIN
- SUM
|  
|


  


**3.2.4 分区键列类型 **

![](https://pingcode.yasdb.com/atlas/files/public/67396b9f8970c2af4f5205de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQ0FBQUFBQUlBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFRQUFBQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFFQUFBZ0FnQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFDQUFBQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU4OTMsImV4cCI6MTc4MjMwNjY5M30.cXNaBzN2SX8AnvIY-GOO0QO-BPbfv0K1xoD3hH5bFLY)

|等价类|备注|
|---|---|
|常量|不下推（关注结果）|
|子查询|不支持|
|聚集函数|不支持|
|普通列：,- 单列
- 多列
- 列表达式: c1 + c2, c1 + 1, abs(c1)
- sysdate, user
- 伪列：rownum，rowid（关注结果是不是稳定）
- 外部引用列
- 其他函数列：udf，dbms_random, 窗口函数
- 列数据类型：blob, clob, nclob, nchar, nvarchar, xmltype, json
- 非分区键列
- 一级分区键列
- 二级分区键列
- 分布键列
|  
|


  


**3.2.4 order by键的类型**

![](https://pingcode.yasdb.com/atlas/files/public/67396b9fa1ad9a3311dc8453/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQ0FBQUFBQUlBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFRQUFBQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFFQUFBZ0FnQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFDQUFBQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU4OTMsImV4cCI6MTc4MjMwNjY5M30.cXNaBzN2SX8AnvIY-GOO0QO-BPbfv0K1xoD3hH5bFLY)

|等价类|备注|
|---|---|
|常量|  
|
|子查询,- 关联子查询
- 非关联子查询
|  
|
|聚集函数|  
|
|普通列：,- 单列
- 多列
- 列表达式: c1 + c2, c1 + 1, abs(c1)
- sysdate, user
- 伪列：rownum，rowid（关注结果是不是稳定）
- 外部引用列
- 其他函数列：udf，dbms_random, 窗口函数
- 列数据类型：blob, clob, nclob, nchar, nvarchar, xmltype, json
- 非分区键列
- 一级分区键列
- 二级分区键列
- 分布键列
|  
|


  


  


**3.2.5 **  **窗口函数应用场景**

|等价类|备注|
|---|---|
|集合操作 + 窗口函数,- union
- union all
- intersect
- intersect all
- minus
- minus all
|select ...over ()  from (sql1 union sql2),select winfunc union select winfunc |
|distinct + 窗口函数|select distinct ... over () from tb1|
|join,- inner join
- left join
- right join
- full join
|  
|
|in / exists subquery,- where winfunc () in (select c1 from )
- where c1 in (select winfunc from)
|  
|
|any / all / some subquery,- winfunc = all （select c1 from ）
- c1 = all （select wincfunc from)
|  
|


  


**3.2.6 函数嵌套**

|等价类|备注|
|---|---|
|partition by 嵌套函数    
  1.普通函数,2.聚合函数|select avg(c2) over(partition by   **avg(id)**   order by c2)from tb1 group by id,c2;,不下推|
|order by 嵌套函数,1.普通函数    
  2.聚合函数|select avg(c2)over(order by   **count(c1)**  )from tb1 group by id,c2;,desc asc;|
|嵌套层数|最大嵌套127层|


  


**3.2.7 函数数量**

|等价类|备注|
|---|---|
|单个|  
|
|多个|  
|
|特别多个 （>200）|  
|


  


**3.2.8 执行计划**

|等价类|备注|
|---|---|
|索引扫描：,- partition by 含索引键
- order by 含索引键
|索引类型：,分区索引：local，global,unique 索引,函数索引,复合索引 ,索引属性：usable, unusable, visiable, invisiable|
|全表扫描|  
|
|window nosort|  
|


  


**3.2.9 并行**

|等价类|备注|
|---|---|
|分布式并行|  
|
|单机并行|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[YDBRD-21540-冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWZhMWFkOWEzMzExZGM4NDUyIiwicmVmX2lkIjoiNjczOTZiOWY1OTNmOTljOWZmMjM2NGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODkzLCJleHAiOjE3ODIzODIyOTN9.6pLItZt-N5sJJLgYvv-2uVT1qlnJcY3Gj7jW17FFJGE)

  


# 5. 测试框架设计

- 本次测试采用yasft测试框架实现，执行sql文件，对比期望结果和实际输出结果，输出测试结果


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|机器|内存|版本|数据库|
|---|---|---|---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2023/12/27

  


测试设计评审纪要

与会人：廖增康、何阳、孔珂煜、吴煜、许秋莹

评审时间：2023-12-7 15:00-16:00

评审地点：1012会议室    
  会议主题：窗口函数支持DN上执行详细测试设计评审

评审纪要信息：

1.order by键的结果需要着重关注，可能会不稳定

2.并行增加单机并行

3.  partition by 嵌套函数不下推

评审通过与否：通过

## Attachments:

[YDBRD-21540-冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWY4OTcwYzJhZjRmNTIwNWRhIiwicmVmX2lkIjoiNjczOTZiOWY1OTNmOTljOWZmMjM2NGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODkzLCJleHAiOjE3ODIzODIyOTN9.DJCLc0TTLHV25piQ0sFkRT7kvU8xwyxsyKUrE19Cm0Q)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-21540-冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWZhMWFkOWEzMzExZGM4NDUyIiwicmVmX2lkIjoiNjczOTZiOWY1OTNmOTljOWZmMjM2NGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODkzLCJleHAiOjE3ODIzODIyOTN9.6pLItZt-N5sJJLgYvv-2uVT1qlnJcY3Gj7jW17FFJGE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
