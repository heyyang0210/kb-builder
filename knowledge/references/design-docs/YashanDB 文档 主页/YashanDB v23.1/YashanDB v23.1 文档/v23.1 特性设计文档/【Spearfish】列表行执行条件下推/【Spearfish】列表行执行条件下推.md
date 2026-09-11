Created by 黄文早 on 七月 12, 2023

#   [列表行执行条件下推](#列表行执行条件下推)  

##   [1. Overview（概述）](#1-overview概述)  

对于列表，有一些语句只能通过行引擎执行，为了提高行引擎执行的效率，将执行的条件下推给存储，使用列式的过滤，提高过滤速度，减少内存拷贝以及函数调用此时，以此提升性能。

##   [2. Features（功能特性）](#2-features功能特性)  

​	行引擎支持将条件下推给存储，存储正确接收这些条件并进行过滤

##   [3. Interfaces（接口）](#3-interfaces接口)  

无

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

```
1. 只能下推常量
2. 对比列的规格，应与列条件下推保持一致
3. 索引扫描不进行条件下推

```

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

功能实现基于delete 条件下推，参考：

  [https://conf.yasdb.com/pages/viewpage.action?pageId=109585983](https://conf.yasdb.com/pages/viewpage.action?pageId=109585983)  

放开了update/select(包括子查询的select)的条件的下推。

主要测试点：

1. 可以通过select.. for update 语句对比列存的执行计划，观察是否下推。
1. update 语句是否下推，性能是否有提升
1. 子查询内的条件是否下推，对比旧的行计划，和列的select 计划。


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

二层用例自测。

##   [7. Document（资料）](#7-document资料)  

无

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

  


## Comments:

|  [](null)  ,hint 指定行引擎也会下推,Posted by huangwenzao at 七月 12, 2023 16:09|
|---|
|  [](null)  ,多表更新场景，子查询,Posted by huangwenzao at 七月 12, 2023 16:14|
|  [](null)  ,绑定参数场景，绑定特殊值,Posted by huangwenzao at 七月 12, 2023 16:17|
|  [](null)  ,rownum,Posted by huangwenzao at 七月 12, 2023 16:24|
|  [](null)  ,tac 行执行忽略选择率,Posted by huangwenzao at 七月 12, 2023 16:29|
