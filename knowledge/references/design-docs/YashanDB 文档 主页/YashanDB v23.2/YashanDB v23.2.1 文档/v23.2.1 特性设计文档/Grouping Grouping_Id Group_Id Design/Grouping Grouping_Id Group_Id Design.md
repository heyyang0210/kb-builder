Created by 胡威振, last modified on 十一月 03, 2023

  


#   [YDBRD-970: Grouping Grouping_Id Group_Id Expression Design（Grouping Grouping_Id Group_Id Expression方案设计）](#ydbrd-970-grouping-grouping-id-group-id-expression-designgrouping-grouping-id-group-id-expression方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-970](https://jira.yasdb.com/browse/YDBRD-970)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-21441](https://jira.yasdb.com/browse/YDBRD-21441)  

##   [1. Overview（概述）](#1-overview概述)  

本文档设计了yashandb中grouping、grouping_id、group_id聚合函数的实现。支持单机列执行及分布式。

调研文档链接：    [https://conf.yasdb.com/display/YAS/Grouping+Grouping_Id+Group_Id+Analyse](https://conf.yasdb.com/display/YAS/Grouping+Grouping_Id+Group_Id+Analyse)  

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 Grouping](#21-grouping)  

Syntax: 

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/grouping.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MzIsImV4cCI6MTc4MjMwOTYzMn0.Dkmnwp1gJyMqGx2sxxC80VmSwzLzhAOR7sZBZyixHNk)

1.grouping函数的主要功能是用于标记一个字段在一个分组聚合结果中的每一行中是否是该行所在的分组的键值,如果是则该行的grouping的结果为0，否则为1。

2.grouping标记了其参数字段是否参与了聚合结果的分组，grouping的参数为一个字段，类型不限，返回类型为number。

3.参数字段必须出现在group by子句中。

4.当输出结果为0时，代表该字段在这组分组中被用来分组。如果结果为1时，则代表该字段没有被用来分组。grouping可以用来区分一个行的null值是因为本身为null还是因为不被聚合所以为null。

###   [2.2 Grouping_Id](#22-grouping-id)  

Syntax: 

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/grouping_id.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MzIsImV4cCI6MTc4MjMwOTYzMn0.Dkmnwp1gJyMqGx2sxxC80VmSwzLzhAOR7sZBZyixHNk)

1.grouping_id函数返回所有参数的grouping结果的1和0组成的一个number类型，所以当grouping_id参数为一个时，结果同grouping。

2.grouping_id在功能上等同于获取多个grouping函数的结果，并将它们连接到一个位向量(由1和0组成的字符串)中。

3.grouping_id的参数为一个或多个字段，返回值类型为number。参数个数最大为126个。

4.grouping_id只能用在带有group by的 select语句中出现，参数必须group by里出现的字段。

5.grouping_id可以用于取出有多个字段组成的分组中重复的部分，比grouping使用方便。

###   [2.3 Group_Id](#23-group-id)  

Syntax: 

![](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/img/group_id.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg4MzIsImV4cCI6MTc4MjMwOTYzMn0.Dkmnwp1gJyMqGx2sxxC80VmSwzLzhAOR7sZBZyixHNk)

1.group_id()可以用来找出重复的分组。所有不同的分组都会以0起步，但是相同的分组会在0的基础上递增。

2.group_id函数没有任何参数，返回值类型为i32。

3.此函数仅适用于包含group by子句的select语句。

4.如果某个特定分组存在n个重复，则GROUP_ID返回范围为0到n-1的数字。

##   [3. Interfaces（接口）](#3-interfaces接口)  

1.对外接口：grouping(expr)、grouping_id(expr1,expr2,...)、group_id()。

2.SQL语法：

```
select grouping(expr) from table group by expr;

select grouping_id(expr1,expr2,...) from table group by expr1,expr2...;

select group_id() from table group by expr;


```

3.内部接口:

bifVerifyGrouping、bifVerifyGroupingId、bifVerifyGroupId。

bifExecGrouping、bifExecGroupingId、bifExecGroupId。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

**规格约束**  ：

1.当前设计不支持行执行，只支持单机列执行和分布式。

2.函数参数的类型需要是能够成为group by列的，例如lob类型不能作为group by列，就不支持。

3.这三个聚合函数不同于其他普通聚合函数，这些聚合函数必须结合group by进行使用，即这三个函数的参数（有参数的）必须出现在group by中。

4.这三个聚合函数不同于普通函数，不能出现在group by中（跟普通聚合表达式特性相同），即不支持select grouping(expr) from table group by grouping(expr)。

5.支持与其他普通函数的嵌套，但不支持与group函数嵌套。

6.group by中可以为expr、rollup、cube、grouping sets。

7.grouping、grouping_id函数不支持使用distinct。

**与oracle的差异**  ：

1.grouping_id函数参数的个数最多支持126个，与oracle存在差异。

2.group_id返回的类型是int，oracle是number（但oracle的内部也可能是int）。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1.添加grouping、grouping_id、group_id函数时，将其添加为聚合函数，其中grouping参数个数限制为1个，grouping_id参数个数限制为1到126个，group_id参数个数限制为0个。

2.verify阶段，校验groupExprs是否为空，如果为空则报错；如果不为空，对于grouping、grouping_id函数，需要判断这两个函数的参数是否都在groupExprs里，如果不在，则报错。

此外也涉及到校验聚合表达式框架的一些调整，之前校验时参数个数不为1则会拦截报错，现在遇到group函数则需要放开这个限制。

3.conclude阶段，grouping、grouping_id函数类型都是number，group_id函数类型是Int。

4.bifExec时拦截报错。（行执行拦截）

5.列执行transform：

涉及到的算子：AnchorHashGroup、AnchorSortGroup、AnchorSortGrouping。

当group by后面只有expr列时，即不含grouping sets、rollup、cube时，会走到AnchorHashGroup；当参数和group by后都是常量时，会走到AnchorSortGroup；其他情况都会走到AnchorSortGrouping。

对于走到AnchorHashGroup、AnchorSortGroup的情况，只需要返回Const::Decimal((MAX_PRECISION as u8, Some(Decimal::ZERO)))即可（对于group_id返回的是Const::Int32(Some(0))），这种情况的结果只有0。

对于AnchorAggregate、AnchorHashGroup、AnchorSortGroup中调用到aggregate、sorted_aggregate接口的地方，传入的grouping_expr为空，with_group_id为false。

对于走到AnchorSortGrouping的情况，在    `GroupAggMap`    中增加新成员    `grouping_exprs: Vec<Vec<Box<dyn Expression>, StdAlloc>, StdAlloc>`    ，适配agg时遇到grouping函数就将其收集起来，然后放在    `GroupAggMap`    中去。

将grouping、grouping_id、group_id按照聚合表达式进行适配，适配时去GroupAggMap中查找对应的位置，找到之后返回Var(id)，没找到则报错。（  **此时取id的时候不需要再对expr是否在groupExprs中进行校验，因为计划可能会优化group by**  ）

6.crab实现设计文档：

  [https://conf.yasdb.com/display/YAS/Crab+GROUP_ID+Design](https://conf.yasdb.com/display/YAS/Crab+GROUP_ID+Design)  

  [https://conf.yasdb.com/display/YAS/Crab+Grouping+Design](https://conf.yasdb.com/display/YAS/Crab+Grouping+Design)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

正常:

1.部分group by字段grouping/grouping_id。

2.全部group by字段都进行grouping/grouping_id。

3.grouping、grouping_id参数个数测试。

4.group by 中只有普通列。

5.group by 中有grouping sets、rollup、cube以及与普通列的组合。

6.有group_sets没有grouping_exprs。

7.与普通函数嵌套。

8.对null的处理。

9.常量测试。

10.分布式场景验证。

异常:

1.groupExpr为空，有grouping。

2.grouping_exprs里面存在不在groupExprs里的表达式。

3.不支持distinct。

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

是否支持两阶段？

评审结论：不走两阶段。

## Comments:

|  [](null)  ,Posted by huweizhen at 十月 31, 2023 14:11|
|---|
|评审方案|grouping、grouping_id、group_id函数设计文档|
|与会人|胡威振、黄靖东、李嘉瑞、刘晓旋、严丽英、李凯峰、唐嘉欣|
|评审时间|2023/10/31 15:00-16:00|
|评审地点|25栋702会议室|
|评审纪要信息|- 验证集群是否限制。
- verify参考groupconcat，不能过分修改原代码。
- 对于走sortGrouping的情况，遇到grouping函数，不能优化groupBy后的常量。
- 本Sr对于grouping函数不走两阶段。
- 补充测试用例：重复字段、绑定参数。
|
|评审是否通过|通过|
|  [](null)  ,补充：grouping、grouping_id函数不支持输入NULL常量作为参数(待CCB)。,  
,Posted by huweizhen at 十一月 03, 2023 10:22|
|  [](null)  ,  [2023-11-22 CCB会议纪要 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135605204)  ,ccb结论：禁止NULL。并禁止在grouping sets中使用null和常量。,Posted by huweizhen at 十一月 23, 2023 14:14|


|评审方案|grouping、grouping_id、group_id函数设计文档|
|---|---|
|与会人|胡威振、黄靖东、李嘉瑞、刘晓旋、严丽英、李凯峰、唐嘉欣|
|评审时间|2023/10/31 15:00-16:00|
|评审地点|25栋702会议室|
|评审纪要信息|- 验证集群是否限制。
- verify参考groupconcat，不能过分修改原代码。
- 对于走sortGrouping的情况，遇到grouping函数，不能优化groupBy后的常量。
- 本Sr对于grouping函数不走两阶段。
- 补充测试用例：重复字段、绑定参数。
|
|评审是否通过|通过|
