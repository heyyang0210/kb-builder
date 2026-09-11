Created by 胡波洋, last modified on 四月 12, 2023

  [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

oracle median文档：    [MEDIAN (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/MEDIAN.html#GUID-DE15705A-AC18-4416-8487-B9E1D70CE01A)  

由于本需求仅支持median窗口函数，普通聚集函数暂时未支持，此设计文档仅涉及median窗口函数形式。

median函数支持对某一列数据或者表达式求中位数，参数类型为数值类型或者时间类型。  中位数是按顺序排列的一组数据中居于中间位置的数。

假设用于求median的数据其中一个窗口数据共有N个，排序后为X  1 ..... N,  

当N为奇数时，median函数返回X  (n + 1) /2，  

当N为偶数时，median函数返回(（X  (n + 1) /2   ）- X  n/2  ) / 2 + (X  n/2  )

在单行计算中，当expr的值为NULL时，函数返回NULL。

在多行计算中，函数将忽略expr值为空的行，当所有行均为空时，计算结果为NULL。

median函数返回值：当median参数类型为数值类型，返回值为该浮点型或者NUMBER类型，当参数为时间类型，返回值类型为时间类型

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


#### 语法形式：

![](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/img/median.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIxOTUsImV4cCI6MTc4MjMwMjk5NX0.73XPlyh3xvyWB-E5yDaBPSA0iVA4U2uwFwaWaVeFh7I)

  [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. median参数个数有且仅有一个
1. median参数类型为数值类型或者时间类型，不支持可隐式转换为数值类型的其他类型。  This function takes as arguments any numeric data type or any nonnumeric data type that can be implicitly converted to a numeric data type（此为oracle文档中描述，可以隐式转为数值类型，但是在oracle里面试了如果是可以转为数值的varchar，oracle也是报错的  ）当前yasdb也是报错处理。
1. MEDIAN窗口函数不支持在expr前加DISTINCT。
1. MEDIAN窗口函数over中禁用order by。


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

|expr类型|返回值类型|
|---|---|
|tinyint|number|
|smallint|number|
|int|number|
|bigint|number|
|float|float|
|double|double|
|number|number|
|date|date|
|timestamp|timestamp|
|time|time|
|interval|interval|
|其他|报错|


###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#51-architecture%E6%9E%B6%E6%9E%84)  

  


###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

CodResult     biwFrameFinalizeMedian  (  AnlStmt  *     stmt  ,     AnlWindow  *     window  ,     WinFuncDecl  *     decl  )

CodResult     biwFrameAddMedian  (  AnlStmt  *     stmt  ,     AnlWindow  *     window  ,     WinFuncDecl  *     decl  ,     SlideDirection     dir  )

CodResult     biwVerifyMedian  (  AnlVerifier  *     vrfr  ,     ExprNode  *     node  )

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.基本功能用例包括数值类型和时间类型

2.报错类型用例

3.使用dinstinct报错

4.使用order by报错

5.median的列有空值

6.median的列只有空值

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*