Created by 彭灵继, last modified on 六月 02, 2023

  


#   [YDBRD-7800: Any/All/Some重写优化 Design（方案设计）](#ydbrd-7800-anyallsome重写优化-design方案设计)  

SR链接：    [YDBRD-7800: Any/All/Some重写优调研](https://jira.yasdb.com/browse/YDBRD-7800)  

##   [1. Overview（概述）](#1-overview概述)  

主方案主要为Any/All/Some重写优化设计方案，主要描述优化实现的思路及设计细节。

##   [2. Features（功能特性）](#2-features功能特性)  

根据特性调研方案，可以得出以下结论：

1. Some为Any的同义词。
1. 当前只有比较运算符>、>=、<、<=、=、!= 这六种运算符可作为Any/All的左边运算符。
1. 当前比较运算符与Any/All 组合时，只支持标量比较，不支持向量比较(Oracle 亦是如此）。因而当子查询（或集合）必须为单列投影。


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult rewriteFilterAnyAll(AnlRewriter* rwtr, FilterNode* node);

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

当前实现为运算符限定为 >、>=、<、<= 。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [1. 运算符为Any运算符时且投影列中不含为aggr、与父查询无关联、或子查询投影列不为LOB/bool类型时，将any改写为min/max函数](#1-运算符为any运算符时且投影列中不含为aggr与父查询无关联或子查询投影列不为lobbool类型时将any改写为minmax函数)  

|比较运算符|Any|
|---|---|
|>|min|
|>=|min|
|<|max|
|<=|max|


其中投影列数据集是否为NULL时，并不影响改写结果。当子查询中不含有aggr函数时，在子查询投影列中增加min/max函数，将原投影列的expr做为函数参数，投影列属性(attr)则不变（即不改变原子查询的数据类型等信息）当子查询含有为aggr函数时，则下述第2种方式改写。

```
     select * from t1 where a1 &gt; any (select a2 from t2);
 ==&gt; select * from t1 where a1 &gt; (select min(a2) from t2);
   
     select * from t1 where a1 &gt; any (select a2 from t2 where x1= x2);
 ==&gt; select * from t1 where a1 &gt; (select min(a2) from t2 where x1= x2);

```

除上述情况外，则按以下方式进行改写

###   [2. Any运算符改写为Semi join](#2-any运算符改写为semi-join)  

```
     select * from t1 where a1 &gt; any (select max(a2) from t2);
 ==&gt; select * from t1, semi-join (select max(a2) from t2) VSQ$1@SEL$0 on a1 &gt; VSQ$1@SEL$0.PROJ$0;

```

有关联查询

```
     select * from t1 where a1 &gt; any (select max(a2) from t2 where x1=x2);
 ==&gt; select * from t1, semi-join (select max(a2),x2 from t2 group by x2) VSQ$1@SEL$0 on a1 &gt; VSQ$1@SEL$0.PROJ$0 and x1= VSQ$1@SEL$x2 ;

```

###   [3. All运算符改写为Anti join](#3-all运算符改写为anti-join)  

```
     select * from t1  where a1 &gt; all (select a2 from t2);
 ==&gt; select * from t1, anit-join (select a2 from t2) VSQ$1@SEL$0 on a1 &lt;= VSQ$1@SEL$0.PROJ$0;

```

有关联查询，则不进行改写。

```
    select * from t1 where a1 &gt; all(select a2 from t2 where x1= x2);
==&gt; select * from t1, anit-join (select a2,x2 from t2) VSQ$1@SEL$0 on a1 &lt;= VSQ$1@SEL$0.PROJ$0 and x1= VSQ$1@SEL$0.PROJ$1 ;    

```

###   [改写公共限制条件](#改写公共限制条件)  

1. 子查询必须为简单查询：即子查询不能为集合运算(union, minus等）或由此改写出来的View。通过查询子查询中dataset中的queryTable进行检查（由此扩展为CTE等)
1. 子关联查询不能含有rownum/limit、group by、connect by、窗口函数、UDF函数（如GIS函数）等。


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

参见 regresstest/sql/filter_rwrt_anyall.sql 门禁测试

##   [7. TODO（遗留问题）](#7-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-2-21_17-32-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMGU4OTcwYzJhZjRmNTFmYmI2IiwicmVmX2lkIjoiNjczOTZhMGU3MjgyMDZlZmI5MmVmYTE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExMzExLCJleHAiOjE3ODIyOTc3MTF9.YAMWEIUZnjUUUT1Bfaro6lHQ9h9mZ9kaquWRpV5PO2Q)

 (image/png)    
