Created by 陈敬厅, last modified on 七月 02, 2024

*详细设计-YDBRD-26579: CTE查询优化 Design（CTE查询优化设计方案设计）*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7482009f91eb87f2c053](https://pingcode.yasdb.com/ship/ideas/660b7482009f91eb87f2c053)    *?*    
  *#YASHAN-1351 cte查询重写优化*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66263201fd997db58adef89c](https://pingcode.yasdb.com/pjm/items/66263201fd997db58adef89c)    *?*    
  *#YDBRD-26579 cte查询重写优化*

  


##   [1. 总述](#1-总述)  

CTE即Common Table Expression，公共表达式，CTE通常作为scan的方式体现在查询计划中，因此可以理解为一个公共表，这是通常意义上的CTE的查询计划的概念，当CTE的使用场景更加复杂时：比如在多个不同的地方使用了同一个CTE，每个使用点的使用情况不尽相同就会产生CTE的查询优化问题，即CTE是作为scan的方式嵌入使用点来进行独立的查询优化改写，还是可以把一个会重复执行的CTE进行物化，作为一个公共数据区域来给不同的使用点使用，由此衍生出内联CTE和共享CTE的概念，此设计就是为了探讨在Cascade/Volcanon优化器中如何对CTE进行查询优化。

###   [1.1 需求来源](#11-需求来源)  

TPCDS计划优化，单机行存（串行）

###   [1.2 调研文档](#12-调研文档)  

略

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子功能1|CTE计划会产生共享CTE的计划|是|是|
|性能|性能场景1|部分场景下CTE执行效率会提升|是|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|是|是|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|是|是|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|CTE|公共表达式|是|  [https://www.cl.cam.ac.uk/teaching/2003/Databases/sql1999.pdf](https://www.cl.cam.ac.uk/teaching/2003/Databases/sql1999.pdf)  |


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|无新增语法，与原CTE语法兼容|----|否|


##   [3. 规格与约束](#3-规格与约束)  

无。

##   [4. 特性](#4-特性)  

此需求不涉及SQL语法功能，只对查询优化层面做功能上的新增。

###   [4.1 特性设计](#41-特性设计)  

目前Yashan的CTE采取总是内联的方式执行的，没有共享CTE的计划产生，需要新增CTE共享的计划，因此需要产生对应的物理算子、逻辑算子等。

###   [4.2 特性功能点1](#42-特性功能点1)  

计划层面可以产生三种不同的CTE的计划：全是内联CTE、部分内联部分共享CTE、全部共享CTE的计划：

![](https://aaaaaaron.github.io/2021/05/01/SQL-CTE-optimize/image-20210426183446419-20210507210541900.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

**全部内联的计划：**

![](https://pingcode.yasdb.com/atlas/files/public/67397174a1ad9a3311dcaabd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

**全是共享CTE计划：**

![](https://pingcode.yasdb.com/atlas/files/public/67397174a1ad9a3311dcaabe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

**部分内联部分共享的计划：**

![](https://pingcode.yasdb.com/atlas/files/public/673971748970c2af4f522c4f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

###   [4.2 特性功能点2](#42-特性功能点2)  

**根据使用点上下文对共享CTE进行优化：**

- 谓词下推，可以根据使用点的谓词选择性地下推，比如可以提取公共部分进行下推。


![](https://pingcode.yasdb.com/atlas/files/public/67397174a1ad9a3311dcaabf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

- sort下推（暂不支持）
- group下推（暂不支持）
- 投影内联CTE的投影优化是天然支持的，根据使用点的投影而进行投影优化，共享CTE的投影优化需要提供投影的并集来进行投影，即保证所有使用点都能获取需要的投影


![](https://pingcode.yasdb.com/atlas/files/public/673971748970c2af4f522c50/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

- 索引选择


由于CTE是公共表，内联CTE本身可以看作是一个scan算子，在条件允许的情况下天然支持索引的选择，而共享CTE的索引选择将视所有的使用点而决定，如第一点谓词下推的情况下，可以使用filter中的列的索引，如果不满足条件的话，将会是一个表扫。

###   [4.3 特性功能点3](#43-特性功能点3)  

**hint选项使CTE内联或者共享**

- 共享CTE MATERIALIZE


![](https://pingcode.yasdb.com/atlas/files/public/673971748970c2af4f522c51/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

- 内联CTE INLINE


![](https://pingcode.yasdb.com/atlas/files/public/67397174a1ad9a3311dcaac0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

###   [4.4 特性功能点4](#44-特性功能点4)  

**隐藏参数 with_subquery 开启物化CTE，内联CTE，自然优化选项**

materialize optimizer inline

![](https://pingcode.yasdb.com/atlas/files/public/673971748970c2af4f522c52/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

此参数可以被sql级的hint优化选项覆盖。

###   [4.4 特性性能点1](#44-特性性能点1)  

典型场景下，共享CTE的计划应该比多处内联CTE的计划不更劣。性能理论上会更好，原因：相同CTE只会执行一次。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

```
--CTE
drop table cte_t1;
drop table cte_t2;

create table cte_t1(c1 int, c2 varchar(10), c3 number);
create table cte_t2(c1 int, c2 varchar(10), c3 number);
create index idx1 on cte_t1(c1);
create index idx2 on cte_t2(c1);

--exp1
--inline
with v as (select c1, c2, c3 from cte_t1 where c3 &gt; 1.0) select * from cte_t1, v where v.c3 &lt; 0.3 order by v.c1; 

--shared
with v as (select c1, c2 from cte_t1 where c1 &gt; 1) select * from cte_t1 t1, v where t1.c1 in (select v.c1 from v, cte_t2 t2 where v.c1 &gt; t2.c1) and v.c1 &lt; t1.c2;

--inline &amp; shared
with v as (select c1, c2 from cte_t1) select t2.c1 from cte_t2 t2, v where t2.c1 = v.c1 and v.c1 &lt; 10 union all select c1 from cte_t1 t1 where t1.c2 &gt; (select c1 from v)
union all select c1 from cte_t2 t2 where t2.c2 &lt; (select c2 from v) union select cast(c2 as int) from v;

--predicate pushdown
with v as (select /*+ materialize */ c1 from cte_t1) select * from cte_t2 t2, v where v.c1 &lt; 5 union all select * from cte_t3, v where v.c1 &lt;5;

```

##   [6.未来规划](#6未来规划)  

**提取公共子表达式为 CTE**

![](https://aaaaaaron.github.io/2021/05/01/SQL-CTE-optimize/image-20210427202305622-20210507210542337.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FnQVFBQUJBQVFRQUFBQUFBQUFBQUFJQkFBSUJBQUFBQUJBQUJBQUFBQUFBUUFBQUFBQUFBQUFHQUFBQUFDZ0lBQUlBQUFRQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFRQUFBQUFBQURZQUdBQUFBQUNFSWdBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFnQUFBQUFBQUFBRUFBSUFBQUJBQUFBQUF3QUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NDYsImV4cCI6MTc4MjMzNTQ0Nn0.k8EW1epCg003HY_KxtuNWvxAnotNbA6l9rFnwtchgHc)

**分布式场景下CTE的distribution按照消费方式来分布**

**并行场景下解决死锁问题，DAG判断有无环路**

## Attachments:

[clipbord_1719820861171.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzM4OTcwYzJhZjRmNTIyYzQ1IiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.coPVEFZl4PMMgyX4KVVus-W5xBNc3fbPZ2U8u9bub5A)

 (image/png)    


[clipbord_1719820861171.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzM4OTcwYzJhZjRmNTIyYzQ2IiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.qbeb7POQVRSWi704viBfURz9YYnkAawJgi-IZsxOpik)

 (image/png)    


[Snipaste_2024-07-01_16-35-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzM4OTcwYzJhZjRmNTIyYzQ3IiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.J299NZmUe0nDzLSv21Wdz7dEPJYUCLL-e53LUPFiYrk)

 (image/png)    


[Snipaste_2024-07-01_16-35-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzM4OTcwYzJhZjRmNTIyYzQ4IiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.l9FBK9N1YN62Fuw-tfTQG1rMFH812AFgZFd3PEXUetU)

 (image/png)    


[Snipaste_2024-07-01_16-35-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzM4OTcwYzJhZjRmNTIyYzQ5IiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.uL-pxWeJ5zELxVPDTQGk7Wbr_XyowIevUSgR9l5iffI)

 (image/png)    


[Snipaste_2024-07-01_16-35-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzNhMWFkOWEzMzExZGNhYWI2IiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.fkVauizb7FgEj3WtdR0L1BhETZSyHPJv5jfR0MKw2-E)

 (image/png)    


[image2024-7-1_18-45-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzNhMWFkOWEzMzExZGNhYWI5IiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.KYp_8yr2596JymwVEq6JcVV0aIOewfsLfKghsYduR1s)

 (image/png)    


[image2024-7-2_11-51-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzRhMWFkOWEzMzExZGNhYWJiIiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.xiKEzWmJLLnDenp99KusiuL2fNVHZtuqksB0D5I7HOg)

 (image/png)    


[image2024-7-2_11-44-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNzQ4OTcwYzJhZjRmNTIyYzRlIiwicmVmX2lkIjoiNjczOTcxNzM1OTNmOTljOWZmMjNhM2I4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjQ2LCJleHAiOjE3ODI0MTEwNDZ9.eFns1VCipplnplz2SGioh2U9vFGmERl-bS-cwkd6Cxo)

 (image/png)    
