Created by 谭思宇, last modified on 十二月 12, 2023

  


##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

博时基金pivot语句不允许改写，需要支持该语法。

部署形态：不区分

版本：22.2

###   [1.2 调研文档](#12-调研文档)  

  [PIVOT调研（ORACLE）非模板标准](https://conf.yasdb.com/pages/viewpage.action?pageId=135611967)  

###   [1.3 需求分析](#13-需求分析)  

由调研文档中可以看到，PIVOT子句在Oracle中也是通过聚合case when实现，因此采用新增对应语法与verify重写实现。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子功能1|子功能1通过什么方案满足|否|否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|
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


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|PIVOT|列转行子句关键字|是|  [oralce PIVOT](https://www.oracle.com/technical-resources/articles/database/sql-11g-pivot.html)  |


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**语法入口：**

跟在表名或on条件之后，alias之前，表示对前面的数据集做pivot

![](https://pingcode.yasdb.com/atlas/files/public/67396c4c8970c2af4f520ae9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFKQUFBQUFBQUFBQUFBRUFRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBSUFBQUFBQUFBQUFBSUFBQVJBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyNTMsImV4cCI6MTc4MjMxMTA1M30.o2nsy0tn8lASHwCzoadL-G5h_bHRH_HOXR5aHUop6UE)

![](https://pingcode.yasdb.com/atlas/files/public/67396c4ca1ad9a3311dc8958/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFKQUFBQUFBQUFBQUFBRUFRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBSUFBQUFBQUFBQUFBSUFBQVJBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyNTMsImV4cCI6MTc4MjMxMTA1M30.o2nsy0tn8lASHwCzoadL-G5h_bHRH_HOXR5aHUop6UE)

**特性新增语法：**

![](https://pingcode.yasdb.com/atlas/files/public/67396c4ca1ad9a3311dc8959/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFKQUFBQUFBQUFBQUFBRUFRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBSUFBQUFBQUFBQUFBSUFBQVJBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyNTMsImV4cCI6MTc4MjMxMTA1M30.o2nsy0tn8lASHwCzoadL-G5h_bHRH_HOXR5aHUop6UE)

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|见上图|----|**是**|
|函数|-|----|否|
|高级包|-|----|否|
|系统视图|-|----|否|
|动态视图|V$RESERVED_WORDS新增关键字PIVOT|----|**是**|
|配置参数|-|----|否|
|驱动接口|-|----|否|
|错误码|错误码、ACTION描述|----|**是**|
|告警|-|----|否|
|日志|-|----|否|


##   [3. 规格与约束](#3-规格与约束)  

- 聚合列的参数列与for列必须出现在前面查询的投影中
- 聚合函数允许出现除grouping_id，group_id和grouping这三个与grouping sets相关的函数以外的所有聚合，非聚合函数或不带聚合函数报错
- pivot clause前面的dataset若是多表，只能是通过on显式表明的join，而不能是用逗号连接的隐式join
- for列不允许复杂名称
- 其余限制为语法位置导致的限制


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
    CodBool  isXml;
    CodUint8 unused[7];
} PivotContext;

```

####   [4.2.2 verify](#422-verify)  

verify pivot放在verify dataset后，此处将新建ds，新建QUERY_SUBQUERY，将原有ds封装。

###   [4.4 特性性能点2](#44-特性性能点2)  

###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

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


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2023-11-22_17-54-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGM4OTcwYzJhZjRmNTIwYWUwIiwicmVmX2lkIjoiNjczOTZjNGI1OTNmOTljOWZmMjM2Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjUzLCJleHAiOjE3ODIzODY2NTN9.FLNkCEyooQZM1d1J4AyEuORr5f_TV2BRoGksVjS2nVM)

 (image/png)    


[image2023-11-22_17-54-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGM4OTcwYzJhZjRmNTIwYWUxIiwicmVmX2lkIjoiNjczOTZjNGI1OTNmOTljOWZmMjM2Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjUzLCJleHAiOjE3ODIzODY2NTN9.05qvRhQQ5IIIhQpaDbodGOsLC1jff8z3997F7o9H4ok)

 (image/png)    


[image2023-11-23_11-53-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGM4OTcwYzJhZjRmNTIwYWUzIiwicmVmX2lkIjoiNjczOTZjNGI1OTNmOTljOWZmMjM2Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjUzLCJleHAiOjE3ODIzODY2NTN9.9M8iIEknRj7p5_lltqK6iaH5e1MGQ51VHY67usCIL9s)

 (image/png)    


[image2023-11-24_14-28-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGNhMWFkOWEzMzExZGM4OTUwIiwicmVmX2lkIjoiNjczOTZjNGI1OTNmOTljOWZmMjM2Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjUzLCJleHAiOjE3ODIzODY2NTN9.3bDLdeKhAnYaj5eK-SGvk-asFDTw6bMUP-VDp4Cr4dM)

 (image/png)    


[image2023-11-24_14-33-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGNhMWFkOWEzMzExZGM4OTUyIiwicmVmX2lkIjoiNjczOTZjNGI1OTNmOTljOWZmMjM2Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjUzLCJleHAiOjE3ODIzODY2NTN9.iqQw29w9Yj03v5vfM9ElNVPpq8MS966hP5f_CnRC-s8)

 (image/png)    


[image.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGM4OTcwYzJhZjRmNTIwYWU1IiwicmVmX2lkIjoiNjczOTZjNGI1OTNmOTljOWZmMjM2Y2Q3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjUzLCJleHAiOjE3ODIzODY2NTN9.zGyNb3dDKoD_3CIMsYetLZP6XglKSKvxHOFIxK9I5eo)

 (image/png)    


## Comments:

|  [](null)  ,cby的位置,Posted by tansiyu at 十一月 24, 2023 09:39|
|---|
|  [](null)  ,列名长度,Posted by tansiyu at 十一月 24, 2023 09:51|
|  [](null)  ,超长列名截断后生成相同字符串报错,Posted by tansiyu at 十一月 24, 2023 09:54|
|  [](null)  ,XML关键字不支持,Posted by tansiyu at 十一月 24, 2023 10:02|
