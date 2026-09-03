Created by 钟金健, last modified on 五月 23, 2024

*详细设计-*  *YDBRD-26067*  * : percentile_cont Design（percentile_cont 方案设计）*

* IR链接：*  *YDBRD-26067*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618edb3fd997db58ad84110](https://pingcode.yasdb.com/pjm/items/6618edb3fd997db58ad84110)    *?*    
  *#YDBRD-26184 支持PERCENTILE_CONT函数*

##   [1. 总述](#1-总述)  

本SR目标是yasdb内核支持percentile_cont函数，包括聚合函数功能部分和窗口函数部分。

percentile_cont函数作用：一组数据根据排序键进行排序以后，数据按照线性排列，则指定一个百分比，则可以根据百分比得到一个值，当百分比为0.5时，返回的正是中位数。

交付范围：

- 存储方式：行存
- 部署方式：单机、集群、分布式（暂没有行存）


###   [1.1 需求来源](#11-需求来源)  

功能原始需求来源于“帆软适配”。

客户答复：PERCENTILE_CONT不会有聚合嵌套，BI业务上也不允许聚合函数嵌套聚合函数

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=147778997](https://conf.yasdb.com/pages/viewpage.action?pageId=147778997)  

###   [1.3 需求分析](#13-需求分析)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|函数|支持percentile_cont聚合函数|----|是|
|函数|支持percentile_cont窗口函数|----|是|
|动态视图|v$function视图增加一个函数|----|是|
|动态视图|v$window_function视图增加一个函数|----|是|
|动态视图|gv$window_function视图增加一个函数(集群环境)|----|是|
|错误码|错误码4930 <br/> ACTION描述：argument of function should be a constant or a function of expressions in GROUP BY|----|是|


- **待确认对分布式视图(dv$xxx)的影响**


在分布式环境下对dv$xxx视图用聚合函数和窗口函数

##   [3. 规格与约束](#3-规格与约束)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

####   [4.1.1 聚合函数现有代码分析](#411-聚合函数现有代码分析)  

（1）多个计划路径会走到聚合函数的执行：

- hash group (hdt)：存在两个阶段，first group、group again
- sort group (sdt)：存在两个阶段，first group、group again
- sorted group：数据已经有序，在fetch的时候进行分组，同时计算聚合函数。将组内数据都fetch一次，在切换新group之前进行一次聚合函数的finalize得到聚合函数在这一group的最终结果
- aggr (单纯计算聚合函数)：直接将所有数据行fetch一遍，并最后finalize运算出一行结果
- group aggr distinct：数据已经有序，在fetch的时候进行分组与去重并计算聚合函数。将组内数据都fetch一次，在切换新group之前进行一次聚合函数的finalize得到聚合函数在这一group的最终结果。


（2）基于目前代码框架，实现聚合函数可以分成三种：

- 第一种是一次数据扫描就可以算出最终结果的。这种有max\min\count\sum 等
- 第二种是基于group_concat函数作为框架实现的。这种有group_concat\string_agg\wm_concat\listagg
- 第三种是将整组数据扫过一次以后，得到全部信息以后再对组内数据进行额外操作并最终得出结果。（这种虽然性能最差，却是通用的执行框架，理论上所有聚合函数都可以通过这种框架执行出结果）


**第三种与第二种执行框架的区别与联系：group_concat的执行框架已经具备第三种执行流程所需的所有要求，缺点是group_concat的执行框架是基于变长数据类型进行设计的，对非变长数据类型的聚合函数并不通用**

实现percentile_cont存在两种方案：

- 方案1：将聚合函数第三种执行路径实现，percentile_cont使用第三种执行流程实现（代码复杂度高一些，相当于重新写一套group_concat的流程，group_concat函数的执行也可以收纳进这个执行路径）
- 方案2：将percentile_cont函数嵌入group_concat函数的执行框架内（需要添加许多if分支进行特殊处理）


**最终选择方案1**

####   [4.1.2 窗口函数现有代码分析](#412-窗口函数现有代码分析)  

（1）窗口函数执行存在两个算子，window sort和window nosort对于percentile_cont函数，只有partition by和within group指定的表达式顺序都满足了才能选用window nosort，否则不可以。

（2）窗口函数的实现比较集中，只需要把对应接口实现就好。同时也要保证存在percentile_cont函数情况下，window nosort算子的选用正确性

###   [4.2 特性功能点2：函数完整语法](#42-特性功能点2函数完整语法)  

```
PERCENTILE_CONT( [ ALL ] expr) WITHIN GROUP (ORDER BY expr [ DESC | ASC ] [NULLS FIRST | LAST ] ) [ OVER (query_partition_clause) ]

```

![](https://pingcode.yasdb.com/atlas/files/public/67396d3aa1ad9a3311dc8fb6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBQUVBQUFBZ0FBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBSUFBQUFFQUFBQkFBQUFFQUFBQUFBQUFBQ0FBQUFBQkFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2NjIsImV4cCI6MTc4MjMxNzQ2Mn0.j4U9GTOv1ib-9iXkxQQOe0vbwkzv33s0iy0Rt1uZgFg)

排序默认是ASC，即升序。null默认排在最大的位置，即ASC时，默认为nulls last；当DESC时，nulls first

（1）聚合函数：

- 禁用distinct语法


```
-- 实际例子：
select percentile_cont(0.5) within group (order by expr) from t1;

```

（2）窗口函数部分：

- 禁用over()子句后添加order by语法，组内排序只能通过within group指定
- 窗口定义因为没有order by，所以没办法指定，等价于rows betwwen unbounded preceding and unbounded following


```
-- 实际例子：
select percentile_cont(0.5) within group (order by expr) over (partition by group_expr) from t1;

```

###   [4.3 特性功能点2：函数算法](#43-特性功能点2函数算法)  

The result of PERCENTILE_CONT is computed by linear interpolation between values after ordering them. Using   **the percentile value (P)**   and   **the number of rows (N)**   in the aggregation group, you can compute the row number you are interested in after ordering the rows with respect to the sort specification. This   **row number (RN)**   is computed according to the formula   **RN = (1+(P*(N-1))**  . The final result of the aggregate function is computed by linear interpolation between the values from rows at row numbers   **CRN = CEILING(RN)**   and   **FRN = FLOOR(RN)**  .

```
  If (CRN = FRN = RN) then the result is
    (value of expression from row at RN)
  Otherwise the result is
    (CRN - RN) * (value of expression for row at FRN) +
    (RN - FRN) * (value of expression for row at CRN)

```

插值：数字类型：

记p = RN - FRN;（1）对于数值类型的插值：直接使用上述原始公式

简记：

- 如果刚好定位到一个数据，则直接取这个数据
- 如果处在两个实际数据（v1,v2）中间，则需要对两个数的合取一个比例。v1 * (1-p) + v2 * p


（2）对于date/timestamp/interval的插值：需要对公式进行变形简记：

- 如果刚好定位到一个数据，则直接取这个数据
- 日期类型：如果处在两个实际数据（v1,v2）中间，v1 + p * (v2 - v1)


```
  If (CRN = FRN = RN) then the result is
    (value of expression from row at RN)
  Otherwise the result is
    (value of expression for row at FRN) +
    (RN - FRN) * ((value of expression for row at CRN) - (value of expression for row at FRN))

```

**日期类型需要变形的原因：date类型与date类型相加没有实际意义，且运算矩阵中不支持。而date类型与date类型相减得到的结果是interval类型，具有实际意义**

###   [4.4 特性功能点3：百分比参数规格](#44-特性功能点3百分比参数规格)  

（1）参数类型：参数可以是数值型类型，也可以是支持隐式转换为number的类型

（2）参数范围：常量表达式、对group来说是稳定值的表达式。参数范围(number的范围)，0-1内返回正常结果，范围外（包括null）返回结果在实际执行时会报错

###   [4.5 特性功能点4：组内排序键](#45-特性功能点4组内排序键)  

（1）排序键类型：数值型（tinyint\smallint\integer\bigint\number\binary_float\binary_double）、日期型 （date/timestamp/interval）（不支持time类型）

（2）排序键个数：1 （小于或者超过1个则报错）

（3）当排序键为常量时，相当于没有排序，可以免去排序

**函数返回值由排序键确定**

|排序键入参类型|函数出参类型|备注|
|---|---|---|
|tinyint|number||
|smallint|number||
|integer|number||
|bigint|number||
|number|number||
|binary_float|binary_float||
|binary_double|binary_double||
|date|date||
|timestamp|timestamp||
|interval year to month|interval year to month||
|interval day to second|interval day to second||


###   [4.6 特性功能点5：计划适配](#46-特性功能点5计划适配)  

- 数据是否已经有序
- 数据是升序还是降序
- 升序数据与降序数据的互换
- 是否需要考虑group_concat\string_agg\listagg的排序统一适配:增加计划路径还是直接计划生成有序数据


###   [4.7 特性功能点6：组内数据对null值的处理](#47-特性功能点6组内数据对null值的处理)  

计算组内总行数时忽略组内的空值，即计算组内百分比偏移时，null值的数量不会计算在内

###   [4.6 特性可维可测设计](#46-特性可维可测设计)  

###   [4.7 特性安全设计](#47-特性安全设计)  

###   [4.8 特性周边配合](#48-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


自测覆盖用例场景：

1. 语法路径（有效、无效）
1. 参数入参有效与无效，结果正确与否
1. 聚合函数与其他函数混合使用的场景 （distinct、）
1. 数字类型与日期类型的边界值和精度
1. **构造不同算子走到聚合函数和窗口函数的场景**  (数据来源与不同算子，如有序的和无序的，正序的和反序的)
1. 大数据量场景下的正确性与性能
1. 不同部署方式下的函数正确性


等价类型：

1. 聚合函数部分
1. 窗口函数部分


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

percentile_cont选window nosort算子不用考虑组内数据的升序降序问题。

![](https://pingcode.yasdb.com/atlas/files/public/67396d3aa1ad9a3311dc8fb7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBQUVBQUFBZ0FBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBSUFBQUFFQUFBQkFBQUFFQUFBQUFBQUFBQ0FBQUFBQkFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2NjIsImV4cCI6MTc4MjMxNzQ2Mn0.j4U9GTOv1ib-9iXkxQQOe0vbwkzv33s0iy0Rt1uZgFg)

![](https://pingcode.yasdb.com/atlas/files/public/67396d3a8970c2af4f521147/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlRQUFBQUFBQUFBQUVBQUFBZ0FBQUFBQWdBQUFBQUFBQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBSUFBQUFFQUFBQkFBQUFFQUFBQUFBQUFBQ0FBQUFBQkFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2NjIsImV4cCI6MTc4MjMxNzQ2Mn0.j4U9GTOv1ib-9iXkxQQOe0vbwkzv33s0iy0Rt1uZgFg)

## Attachments:

[clipbord_1713319732157.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2E4OTcwYzJhZjRmNTIxMTQyIiwicmVmX2lkIjoiNjczOTZkMzk1OTNmOTljOWZmMjM3OTMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NjYyLCJleHAiOjE3ODIzOTMwNjJ9.c14Dnnq7leQQ8BQc2TZzr7j_8SjumQmgbov-r4C4wv0)

 (image/png)    
