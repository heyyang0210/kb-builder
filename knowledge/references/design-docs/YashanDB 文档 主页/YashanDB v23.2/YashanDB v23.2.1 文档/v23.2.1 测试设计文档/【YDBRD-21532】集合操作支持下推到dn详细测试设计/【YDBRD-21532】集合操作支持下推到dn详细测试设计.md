Created by 孔珂煜, last modified by  许秋莹 on 十二月 27, 2023

# 1. 概述

集合操作支持并行与下推到DN上执行

SR：    [YDBRD-21532](https://jira.yasdb.com/browse/YDBRD-21532?src=confmacro)    -  集合操作支持下推到dn  完成

# 2. 需求分析

## 2.1 功能点分析

- 无新增语法功能
- 如果想在DN或并行线程内做集合操作，按照集合操作不同，当为intersect与minus时需要按照任意hash key分发数据，保证有交集的数据在同一个DN上。
- union则可以对下为任意需求。


|上层路径|算子|
|---|---|
|singleton|winfunc，rownum|
|hash|group by 集合操作投影 + 并行|
|broadcast|复制表 join 分布表，集合操作在复制表|
|random|其他算子|


## 2.2 应用场景 

- 分布式
- 单机并行


# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用场景法，等价类进行测试。其中

- 集合操作应考虑与其他操作进行结合使用，因此场景法为本测试设计的主要测试方法
- DML操作以及算子主要采用等价类划分法


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|测试点|
|:---|:---|---|
|CT|是|集合操作下推到dn与对基表进行ddl，dml的场景进行并发|
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
|性能|是|和master执行时间对比，相同场景下不比master执行时间差|
|可维护性|  
|  
|
|RTO|  
|  
|


  


3.2.1 出现在集合操作上方算子类型

名字里带hash的都是hash，名字里带sort都是有序

带hash的算子出现在集合操作下面需要关注结果正确性

|等价类|算子|备注|
|---|---|---|
|HASH JOIN|HASH_JOIN_INNER|复制表 join 分布表，集合操作在复制表：broadcast|
|  
|HASH_JOIN_LEFT_OUTER|HASH JOIN左右两边都是hash|
|  
|HASH_JOIN_RIGHT_OUTER|  
|
|  
|HASH_JOIN_FULL_OUTER|  
|
|  
|HASH_JOIN_SEMI|in 子查询，exists 子查询|
|  
|HASH_JOIN_RIGHT_SEMI|  
|
|  
|HASH_JOIN_ANTI|  
|
|  
|HASH_JOIN_RIGHT_ANTI|  
|
|NEST LOOP|NESTED_LOOPS_INNER|复制表 join 分布表，集合操作在复制表：broadcast|
|  
|NESTED_LOOPS_LEFT_OUTER|  
|
|  
|NESTED_LOOPS_FULL_OUTER|  
|
|  
|NESTED_LOOPS_SEMI|  
|
|  
|NESTED_LOOPS_ANTI|  
|
|MERGE JOIN|MERGE_JOIN_INNER|复制表 join 分布表，集合操作在复制表：broadcast,先broadcast，再sort|
|  
|MERGE_JOIN_LEFT_OUTER|merge join是sort|
|  
|MERGE_JOIN_FULL_OUTER|  
|
|  
|MERGE_JOIN_SEMI|  
|
|  
|MERGE_JOIN_ANTI|  
|
|ORDER BY|SORT|  
|
|  
|SORT_ORDER_BY|  
|
|GROUP BY|SORTED_GROUP|group by 集合操作投影列 + 并行 ：hash|
|  
|HASH_GROUP|  
|
|  
|SORT_GROUP|  
|
|  
|SORT GROUPING SETS|仅单机列存支持|
|DISTINCT|HASH_DISTINCT|  
|
|  
|SORT_DISTINCT|  
|
|  
|SORTED_DISTINCT|  
|
|ORDER BY + LIMIT|TOP_N|  
|
|DISTINCT + ORDER BY + LIMIT|TOP_DISTINCT_N|  
|
|集合操作|UNION_ALL|  
|
|  
|MINUS|  
|
|  
|MINUS_ALL|  
|
|  
|INTERSECT|  
|
|  
|INTERSECT_ALL|  
|
|  
|UNION|  
|
|聚合|AGGREATE|  
|
|ROWNUM|COUNT|singleton|
|  
|COUNT STOPKEY|  
|
|LIMIT|WINDOW|  
|
|窗口函数|WINDOW_NOSORT|singleton,列存只有WINDOW_NOSORT|
|  
|WINDOW_SORT|  
|
|  
|  
|  
|


3.2.2 表类型

|等价类|备注|
|---|---|
|分布表|单表，JOIN两边的表,集合操作左右不同的表类型|
|复制表|* 复制表二级分区开并行|
|系统表|  
|
|分区表|一级分区表,二级分区表|


3.2.3 DML/DDL操作

|等价类|备注|
|---|---|
|insert|  
|
|update|  
|
|delete|  
|
|merge|  
|
|create as select|  
|


3.2.4 集合操作语句的投影列类型

|等价类|备注|
|---|---|
|聚合函数|  
|
|常量|  
|
|函数表达式|  
|
|窗口函数|  
|
|高级包|  
|
|系统变量：sysdate，user|  
|
|伪列：rownum，rowid|  
|
|子查询|  
|
|索引列|分布式只支持唯一约束和主键约束|
|分布键，非分布键|  
|
|分区键|  
|


3.2.5 集合操作语句出现的位置

|输入条件|等价类|备注|
|---|---|---|
|投影列|  
|select subq1 union subq2|
|FROM|单个集合操作,集合操作在join的两边,集合操作组合集合操作,  
|from （subq1 union subq2）,from （subq1 union subq2） join  table|
|WHERE|in/not in/exists/not exists 集合操作语句|exists (subq1 union subq2)|


3.2.6 集合操作语句场景

|输入条件|等价类|备注|
|---|---|---|
|group by|集合操作子查询有group by,集合操作查询上方有group by|  
|
|case when|投影列case ... when ...,filter上有case ... when...|  
|
|cte|定义cte时有集合操作,查询cte时有集合操作|  
|
|order by|集合操作子查询有order by,集合操作查询上方有order by|  
|
|distinct|集合操作子查询有distinct,集合操作外面查询distinct|select distinct c1 fron t1 union subq1,select distinct (subq1 union subq2)|
|并行|打开并行参数|  
|
|join|集合操作子查询有join,集合操作外面查询有join,inner，left，right，full|  
|
|子查询|  
|  
|
|limit|  
|  
|


  


# 4. 测试用例

冒烟用例：

[YDBRD-21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzJhMWFkOWEzMzExZGM4NTNjIiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.MvkVbzfi9xjf89IlyA0qfhDZEgo_hKUJeiVMdHP2dWQ)

文本用例：

[YDBRD21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzJhMWFkOWEzMzExZGM4NTNlIiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.4b3GBE21lWj8GloKWTA0VikxFsf_N1RKDFC59BwPdTc)

# 5. 测试框架设计

- 本次测试采用yasft测试框架实现，执行sql文件，对比期望结果和实际输出结果，输出测试结果


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2023/12/23

  


测试设计评审纪要

与会人：廖增康、何阳、孔珂煜、谭思宇、吴煜、马文英、许秋莹

评审时间：2023-11-16 15:00-16:00

评审地点：1012会议室    
  会议主题：集合操作支持下推到dn详细测试设计评审

评审纪要信息：

1.带hash的算子出现在集合操作下面需要关注结果正确性

2.注意复制表二级分区开并行的结果

评审通过与否：通过

  


## Attachments:

[YDBRD21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzE4OTcwYzJhZjRmNTIwNmM1IiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.sPhEZT1H6O6QLfkiEHJ4DChgeIqZrMOVx5AlBIv3KVk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzE4OTcwYzJhZjRmNTIwNmM2IiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.e9LnluQcunY-HOaO_ARXURlOX-L3w0NCCIHsnaqbDHw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzI4OTcwYzJhZjRmNTIwNmM3IiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.zF0vvlb3Q10U1qpt34WOppltb9YDnRQAorT_azMfVcM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzJhMWFkOWEzMzExZGM4NTNjIiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.MvkVbzfi9xjf89IlyA0qfhDZEgo_hKUJeiVMdHP2dWQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzI4OTcwYzJhZjRmNTIwNmM4IiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.kSeiH0pny2gcHt6d7Vehoa60K9WCETcTyah6Mriu1Bg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzJhMWFkOWEzMzExZGM4NTNkIiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.1JXF092yz2ZNT29Gp0u5uhCvdr5TD5DXQCubIz1CcIo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD21532-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzJhMWFkOWEzMzExZGM4NTNlIiwicmVmX2lkIjoiNjczOTZiYzE1OTNmOTljOWZmMjM2NmJiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2ODI4LCJleHAiOjE3ODIzODMyMjh9.4b3GBE21lWj8GloKWTA0VikxFsf_N1RKDFC59BwPdTc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
