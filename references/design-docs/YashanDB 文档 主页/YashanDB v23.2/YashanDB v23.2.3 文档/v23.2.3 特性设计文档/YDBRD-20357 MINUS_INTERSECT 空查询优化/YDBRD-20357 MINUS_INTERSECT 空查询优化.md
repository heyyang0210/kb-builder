Created by 林俊喆, last modified on 五月 29, 2024

SR链接：    [https://pingcode.yasdb.com/pjm/items/6611648d579a3edb84d6dc05](https://pingcode.yasdb.com/pjm/items/6611648d579a3edb84d6dc05)    ?

##   [1. 总述](#1-总述)  

逻辑上可以确定结果集为空集的情况，对于当前实现不会把整个子计划树去掉，分布式下会导致需要被优化掉的子计划树的stage仍被启动。该SR针对MINUS(ALL)及INTERSECT(ALL)操作，操作的子查询为空集的情况的优化。

###   [1.1 需求来源](#11-需求来源)  

分布式TPCDS性能优化，优化掉集合操作空的子查询操作

###   [1.2 调研文档](#12-调研文档)  

无

###   [1.3 需求分析](#13-需求分析)  

需要在计划树上去掉空集合时minus和intersect的子树，需要在静态改写阶段可以判断出算子表达式的结果集是否为空集。

###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

无

##   [3. 规格与约束](#3-规格与约束)  

1. update，insert，delete，merge先不支持，所有优化针对 select。
1. not exists (全量数据) 和 not in (全量数据)的anti jion恒false暂时不支持，后续优化支持。
1. minus，union，union all在返回数据集非空的情况下保留。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

####   [4.1.1 算子表达式为空集的情况](#411-算子表达式为空集的情况)  

|逻辑算子|情况|备注|
|---|---|---|
|join graph||当前跳过，待后置joingraph改造合入后，该阶段不应遇到该算子|
|select|child为空集 或 filter为false||
|delete|不删除||
|update|不删除||
|insert|不删除||
|merge|不删除||
|scan|filter为false||
|view scan|child为空集 或 filter为false||
|A left outer join B|A为空集|join情况仍需补充|
|A right outer join B|B为空集||
|A full outer join B|A为空集 且 B为空集||
|A left semi join B|A为空集 或 B为空集, join condition为false||
|A left anti join B|A为空集（若B为空集则为A），join condition 为true||
|A inner join B|A为空集 或 B为空集, join condition为false||
|group by|havingFilter恒false 或 下层算子为空集 或 topn 0||
|distinct|下层算子为空集||
|aggr|跳过，至少会返回null||
|window function|topn 0 或 下层算子为空集||
|union/union all|A为空集 且 B为空集||
|minus/minus all|A为空集（若B为空集则为A）||
|intersect/intersect all|A为空集 或 B为空集||
|result|child为空集 或 filter为false||
|count|不删除||
|ac scan|filter为false||
|expand|不删除||
|table func scan|filter为false||


|不应遇到的算子|备注|
|---|---|
|OP_LOGICAL_IDXSCAN|逻辑转逻辑拓展路径|
|OP_LOGICAL_RUNTIME|未使用|
|OP_LOGICAL_SORTAGGRDIST|逻辑转逻辑拓展路径|
|OP_LOGICAL_FIRSTROW|逻辑转逻辑拓展路径|
|OP_LOGICAL_WINPART|逻辑转逻辑拓展路径|
|OP_LOGICAL_JOIN|逻辑转逻辑拓展路径|


####   [4.1.2 minus(all) 路径优化](#412-minusall-路径优化)  

对于A MINUS(ALL) B：

若算子表达式A为空集，则将路径替换为resultFalse

若算子表达式B为空集，则将路径替换为A

####   [4.1.3 intersect(all) 路径优化](#413-intersectall-路径优化)  

对于A INTERSECT(ALL) B：

若算子表达式A为空集或算子表达式B为空集，均将路径替换为resultFalse

###   [4.2 优化效果](#42-优化效果)  

优化前，打印计划未将空集合的子树删除：

![](https://pingcode.yasdb.com/atlas/files/public/67396d4b8970c2af4f5211de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBUUFBQUFJQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBZ0FBQUFBQUVBQUFBQUFBQUFJQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwODQsImV4cCI6MTc4MjMxNzg4NH0.XmT1tjpBUYWwvnChT5i5RGYoj5LqZNLQimExuMuFtyU)

优化后，打印计划可以看出空集合的子树已被删除：

![](https://pingcode.yasdb.com/atlas/files/public/67396d4b8970c2af4f5211df/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBUUFBQUFJQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBZ0FBQUFBQUVBQUFBQUFBQUFJQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwODQsImV4cCI6MTc4MjMxNzg4NH0.XmT1tjpBUYWwvnChT5i5RGYoj5LqZNLQimExuMuFtyU)

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. minus左子树组合 group by,left jion, right jion,full jion, semi jion, limit, rownum, window(窗口函数),distinct 算子为恒 false, explain查看子树是否被删除
1. intersect左子树组合 group by,left jion, right jion,full jion, semi jion, limit, rownum, window(窗口函数),distinct 算子为恒 false, explain查看子树是否被删除
1. minus右子树组合 group by,left jion, right jion,full jion, semi jion, limit, rownum, window(窗口函数),distinct 算子为恒 false, explain查看子树是否被删除
1. intersect右子树组合 group by,left jion, right jion,full jion, semi jion, limit, rownum, window(窗口函数),distinct 算子为恒 false, explain查看子树是否被删除
1. minus左/右子树多个算子组合为恒false, explain查看子树是否被删除
1. intersect左/右子树多个算子组合为恒false, explain查看子树是否被删除
1. 优化掉的子树中带子查询（先不修改，增加删除子查询引用接口），cte（增加删除cte引用接口）


##   [6.资料设计章节](#6资料设计章节)  

无

##   [7.未来规划](#7未来规划)  

1. minus，union，union all在返回数据集非空的情况下保留，需要后续调整集合操作的投影。


  


  


  


  


## Attachments: