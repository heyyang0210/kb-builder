Created by 谭思宇, last modified on 十二月 12, 2023

  [YDBRD-23347](https://jira.yasdb.com/browse/YDBRD-23347?src=confmacro)    -  实现PIVOT函数  完成

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

博时基金pivot语句不允许改写，需要支持该语法。

部署形态：不区分

版本：22.2

###   [1.2 调研文档](#12-调研文档)  

  [PIVOT调研（ORACLE）](https://conf.yasdb.com/pages/viewpage.action?pageId=135611967)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|语法解析|按照特定语法树增加parse解析|是|是|
|功能|等价改写|verify阶段按照pivot语义等价改写|是|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


由调研文档中可以看到，PIVOT子句在Oracle中也是通过聚合case when实现，因此采用新增对应语法与verify重写实现。

###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|PIVOT|列转行子句关键字|是|  [oralce PIVOT](https://www.oracle.com/technical-resources/articles/database/sql-11g-pivot.html)  |


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**语法入口：**

跟在表名或on条件之后，alias之前，表示对前面的数据集做pivot

![](https://pingcode.yasdb.com/atlas/files/public/67396c50a1ad9a3311dc898c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFBQUNRQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUJBQUFBQUFFSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyOTMsImV4cCI6MTc4MjMxMTA5M30.wvgVFQWNwosrx9Pfq9aeJSfo2qksDwT7djpVIYcYSvs)

![](https://pingcode.yasdb.com/atlas/files/public/67396c508970c2af4f520b1e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFBQUNRQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUJBQUFBQUFFSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyOTMsImV4cCI6MTc4MjMxMTA5M30.wvgVFQWNwosrx9Pfq9aeJSfo2qksDwT7djpVIYcYSvs)

**特性新增语法：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c508970c2af4f520b1f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQWdBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFBQUNRQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUJBQUFBQUFFSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyOTMsImV4cCI6MTc4MjMxMTA5M30.wvgVFQWNwosrx9Pfq9aeJSfo2qksDwT7djpVIYcYSvs)

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|见上图|----|**是**|
|函数|-|----|否|
|高级包|-|----|否|
|系统视图|-|----|否|
|动态视图|V$RESERVED_WORDS新增关键字PIVOT|----|**是**|
|配置参数|-|----|否|
|驱动接口|-|----|否|
|错误码|ERR_ANS_VERIFY_NON_AGGR_IN_PIVOT(pivot非聚合报错) ERR_ANS_VERIFY_NON_CONST_IN_PIVOT(in非常量报错) ERR_ANS_VERIFY_PARAM_IN_PIVOT(in绑定参数报错)|----|**是**|
|告警|-|----|否|
|日志|-|----|否|


##   [3. 规格与约束](#3-规格与约束)  

规格：

- 聚合列的参数列与for列必须出现在前面查询的投影中
- 聚合函数允许出现除grouping_id，group_id和grouping这三个与grouping sets相关的函数以外的所有聚合，非聚合函数或不带聚合函数报错
- pivot clause前面的dataset若是多表，只能是通过on显式表明的join，而不能是用逗号连接的隐式join
- for列不允许复杂名称
- for列不允许使用伪列
- 其余限制为语法位置导致的限制


约束：（与Oracle不一致部分）

- pivot暂不支持对table function进行pivot
- pivot中聚合函数暂不支持group concat函数
- 暂不支持在cte内对表进行pivot
- 通过cast等bif得到的日期相关类型常量不支持静态优化，暂不支持出现在in列表中
- 别名长度上限为64，超过20的部分在打印时截断


##   [4. 特性](#4-特性)  

相关用例可参考调研文档。

###   [4.1 特性设计](#41-特性设计)  

本次方案主要涉及parse新增语法及verify等价改写

###   [4.2 等价改写](#42-等价改写)  

目前的实现打算采用和Oracle相同的等价改写策略，改写为聚合加case when的形式，由于我们实现了if函数，可以直接使用if函数替代。

假如有一个table，含有4个列

此时有如下语句

```
select * from table
PIVOT
(
  aggr1(proj1) as aggr1, aggr2(proj2) as aggr2
  for proj3 in (const1 as c1, const2 as c2)
)

```

语义等价改写为

```
select proj4, 
       aggr1(if(proj3 = const1, proj1, NULL)) as c1_aggr1, 
       aggr2(if(proj3 = const1, porj2, NULL)) as c1_aggr2,
       aggr1(if(proj3 = const2, proj1, NULL)) as c2_aggr1,
       aggr2(if(proj3 = const2, proj2, NULL)) as c2_aggr2
from   
       table
group by
       proj4; 

```

当外部出现groupby，where filter等时

```
select * from table
PIVOT
(
  aggr1(proj1) as aggr1, aggr2(proj2) as aggr2
  for proj3 in (const1 as c1, const2 as c2)
) 
group by proj4, c1_aggr1, c1_aggr2, c2_aggr1, c2_aggr2;

```

等价改写结果为：

```
select proj4, c1_aggr1, c1_aggr2, c2_aggr1, c2_aggr2 from
(
select proj4, 
       aggr1(if(proj3 = const1, proj1, NULL)) as c1_aggr1, 
       aggr2(if(proj3 = const1, porj2, NULL)) as c1_aggr2,
       aggr1(if(proj3 = const2, proj1, NULL)) as c2_aggr1,
       aggr2(if(proj3 = const2, proj2, NULL)) as c2_aggr2
from   
       table
group by 
	   proj4
)
group by proj4, c1_aggr1, c1_aggr2, c2_aggr1, c2_aggr2;

```

对于一个包含pivot的语句，直接与pivot接触的select只能使用原始表减去pivot用掉的列再加上pivot提供的特殊聚合

所以我认为在语法上，在语义实现上需要将其认为是一个特殊的，类似from子查询的表，经过了pivot之后，外层只能看到pivot所提供的列。

而外层的filter等则无法下推到这个view的下面。

####   [4.2.1 parse](#421-parse)  

增加pivotContext结构体，用于在当前ds存放pivot相关成员

```
typedef struct StPivotContext {
    Expr*    forColumn;  // must be EXPR_COLUMN
    List*    inList;     // rsCols (with alias)
    List*    aggrs;      // rsCols
} PivotContext;

```

而根据调研文档可知，pivot实际语义是对pivot前的结果集进行列抽取并按聚合转置，在语义上操作的将是整体join tree的某一棵子树，因此pivot应该作为join树上某个节点的属性，代表对这个节点的子树进行操作。

根据语法位置，parse pivot应该在数据集alias parse之前及join on条件之后。

####   [4.2.2 verify](#422-verify)  

根据上面描述的pivot语义特点，pivot的verify应该在对当前查询的数据集校验完成后，对join树的校验开始之前进行。

需要生成一个subquery table，这个table包括了被pivot的所有表，直接替换掉pivot所在join node的table。

投影列生成：pivot的这个新生成的table，其原始投影 = pivot内所有表列展开 - in列 - 聚合参数列 + 改写后的 aggr

group列生成：group列 = 原始投影 - aggr

####   [4.2.3 rewrite](#423-rewrite)  

rewrite阶段进行重写，在非单表场景下将pivot投影出去但没有使用的列从投影与group中删除。

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

自测用例参考：    [PIVOT调研（ORACLE）](https://conf.yasdb.com/pages/viewpage.action?pageId=135611967)  

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGZhMWFkOWEzMzExZGM4OTg2IiwicmVmX2lkIjoiNjczOTZjNGY1OTNmOTljOWZmMjM2ZDEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjkzLCJleHAiOjE3ODIzODY2OTN9.Ma0nyvodO8dUHuXUlBqgOdk3inD0Dwgr-8cOz4eEa8k)

 (image/png)    


[image2023-11-24_14-33-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGY4OTcwYzJhZjRmNTIwYjFhIiwicmVmX2lkIjoiNjczOTZjNGY1OTNmOTljOWZmMjM2ZDEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjkzLCJleHAiOjE3ODIzODY2OTN9.xzLD3J6dRDLSzaAecJa9Y-TnptDv8IE-bDkQ065Cw-0)

 (image/png)    


[image2023-11-24_14-28-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGY4OTcwYzJhZjRmNTIwYjFiIiwicmVmX2lkIjoiNjczOTZjNGY1OTNmOTljOWZmMjM2ZDEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjkzLCJleHAiOjE3ODIzODY2OTN9.khbF7ggkiaeCTSAF2Xp_-nMJtJJ4gUMeLaM6Sy3H7EM)

 (image/png)    


[image2023-11-23_11-53-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGZhMWFkOWEzMzExZGM4OTg4IiwicmVmX2lkIjoiNjczOTZjNGY1OTNmOTljOWZmMjM2ZDEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjkzLCJleHAiOjE3ODIzODY2OTN9.z5KVMRJGQvyRfmdLGlQMNl78VpQef4byWuJm5acZqWQ)

 (image/png)    


[image2023-11-22_17-54-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGZhMWFkOWEzMzExZGM4OThhIiwicmVmX2lkIjoiNjczOTZjNGY1OTNmOTljOWZmMjM2ZDEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjkzLCJleHAiOjE3ODIzODY2OTN9.e9g7FnjzJgXz0aGP9Wx_ONYherIaFDHNO2NoUB6GmrM)

 (image/png)    


[image2023-11-22_17-54-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGY4OTcwYzJhZjRmNTIwYjFjIiwicmVmX2lkIjoiNjczOTZjNGY1OTNmOTljOWZmMjM2ZDEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjkzLCJleHAiOjE3ODIzODY2OTN9.S--N-IZu1BZZQWTkaNhXhq9SscN2wbOJs20IwRoZql8)

 (image/png)    


## Comments:

|  [](null)  ,投影列上限4096,Posted by tansiyu at 十二月 12, 2023 15:49|
|---|
|  [](null)  ,UDF名称,Posted by tansiyu at 十二月 12, 2023 16:12|
