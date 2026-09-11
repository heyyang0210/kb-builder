Created by 陈关羽, last modified on 六月 17, 2024

IR：    [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf3a](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf3a)    ?    
  #YASHAN-1070 支持order by stop key算子    
  SR：    [https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53](https://pingcode.yasdb.com/pjm/items/6618a72dfd997db58ad7de53)    ?    
  #YDBRD-26110 支持Order by上的stop key

##   [1. Overview（概述）](#1-overview概述)  

当sql里层有orderby，外层有rownum或者limit时，把外层的对结果集的限制条件推至里层，可加速执行效率。

本特性支持的部署形态为单机/分布式行列。详细调研文档见：    [调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150628938)  

##   [2. Features（功能特性）](#2-features功能特性)  

对于SQL：

```
select * from (select * from ROWNUM_T1 order by 1) where rownum &lt; 2;

```

ORACLE执行计划为：

![](https://pingcode.yasdb.com/atlas/files/public/67396d78a1ad9a3311dc9157/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFJQUFBQWdBQUFBQUFnQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg2MDUsImV4cCI6MTc4MjMxOTQwNX0.0Mr07iJ3-vzS26QF3cJYyJiTpzi1voihKnrLjc2hV4c)

Oracle已做下推，表现为count StopKey上的Filter，下推至sort order by stopKey。

本需求在计划上的体现主要有两点：

- 添加order by stopKey算子，作为承载StopKey的载体。
- Count StopKey上的Filter下推至order by stopKey，其中Filter会被改写为Expr。


yashan计划上显示如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d78a1ad9a3311dc9158/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFJQUFBQWdBQUFBQUFnQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg2MDUsImV4cCI6MTc4MjMxOTQwNX0.0Mr07iJ3-vzS26QF3cJYyJiTpzi1voihKnrLjc2hV4c)

##   [3. Interfaces（接口）](#3-interfaces接口)  

提供给执行的接口：initSortPlan函数

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

order by stopKey说明本方案对外的功能规格或约束。

- 只支持里层orderby，外层rownum/limit的场景，即rownum/limit子查询
- rownum的用法需满足：
    - where rownum < 常数 （下推）
    - where rownum = 常数，常数只能为1（下推），否则恒false（下推）
    - where rownum > 常数，（不下推）。
- limit的用法需满足limit expr offset expr：
    - limit的expr为常数时，大于0，下推
    - limit和offset的expr为参数时，会改写为greatest(floor(:1,0))+greatest(floor(:2,0));


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

|技术点|说明|
|---|---|
|生成Stopkey|当rownum<参数/常数或者存在limit时，会在下推框架中生成StopKey（类型为Expr），并在下推框架中下推，便挂载到selectOp的Prop的sort上或者groupOp\distinctOp上,尝试下推的算子见    [调研](https://conf.yasdb.com/pages/viewpage.action?pageId=150628938)  |
|cost|若有StopKey，COST需要加上|
|explain打印|类型为SORT_FOR_COUNT时，打印出order by stopKey|
|执行支持order by StopKey算子|待分配给行列执行|


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

####   [5.2.1 主要数据结构](#521-主要数据结构)  

```
typedef struct StSortDesc {  // 在SortDesc中增加Expr* stopKey
} SortDesc;

typedef enum EnSortForType {  // 在SortForType中增加SORT_FOR_COUNT
} SortForType;

typedef struct StSortPlan {   // 在SortPlan中增加Expr* stopKey
} SortPlan;

typedef struct StExplainAnnex {  // 在ExplainAnnex中增加SortPlan* sort
} ExplainAnnex;

typedef enum EnExplainAnnexType {   // 在ExplainAnnexType中增加EXPN_SORT_FOR_COUNT_DECL
} ExplainAnnexType;

```

####   [5.2.2 主要函数](#522-主要函数)  

```
// 下推阶段
CodResult pushCountFilter(CboOptimizer* cboOpt, CboOperator* op, ExtraProp* oriProp, ObjectArray* outProps)
{
	// 增加逻辑：如果CountOp上的Filter不为空，则生成StopKey
}

// createPlan阶段
static inline CodResult initSortPlan(AnlOptimizer* optmzr, CboOperator* cboOp, AnlPlan** anlPlan, PlanType planType)
{
	// 增加逻辑：如果stopk不为空，深拷StopKey，sort的forType设置为SORT_FOR_COUNT。
}

// CopyPlan阶段
static CodResult anlCopySort(AnlCopyAssist* assist, SortPlan* srcPlan, SortPlan* dstPlan)
{
	// 增加对StopKey的拷贝
}

// trsfMat阶段
trsfMatSort

// explain打印阶段
CodResult explainSort(AnlStmt* stmt, AnlPlan* plan)
{
	// 增加逻辑：类型为SORT_FOR_COUNT时打印ORDER BY STOPKEY
}
static CodResult explainSortCountInfo(AnlStmt* stmt, const ExplainAnnex* annex, Variant* value, CodBool* isSent)
{
	// 打印StopKey
}

// 执行阶段-行列执行算子


```

###   [5.4 行列执行设计（todo）](#54-行列执行设计todo)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

```
create table ROWNUM_T1 (num int ,c1 varchar(64), c2 varchar(64));
insert into ROWNUM_T1 (num,c1,c2) values (1,'regress','TEST_ROWNUM1');
insert into ROWNUM_T1 (num,c1,c2) values (20,'regress','TEST_ROWNUM2');
insert into ROWNUM_T1 (num,c1,c2) values (3,'regress','TEST_ROWNUM3');
insert into ROWNUM_T1 (num,c1,c2) values (5,'regress','TEST_ROWNUM5');
insert into ROWNUM_T1 (num,c1,c2) values (7,'regress','TEST_ROWNUM7');
insert into ROWNUM_T1 (num,c1,c2) values (9,'REGRESS','TEST_ROWNUM9');
insert into ROWNUM_T1 (num,c1,c2) values (11,'REGRESS','TEST_ROWNUM11');
insert into ROWNUM_T1 values (7,null,null);

explain select * from (select * from ROWNUM_T1 order by 1) where rownum &lt; :1;
select * from (select * from ROWNUM_T1 order by 1) where rownum&lt; -2;
select * from (select * from ROWNUM_T1 order by 1) where rownum&gt; -2;
select * from (select * from ROWNUM_T1 order by num) where rownum = 1;
select * from ROWNUM_T1 order by 1 offset 1 rows;
-- join
select * from (select * from ROWNUM_T1 order by 1) t1 join (select * from ROWNUM_T1 order by 1) t2 on t1.num = t2.num where rownum &lt; 2;

-- 
select * from (select max(num) from (select * from ROWNUM_T1 order by num)) where rownum = 1;



```

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2024-5-9_10-2-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzg4OTcwYzJhZjRmNTIxMmUwIiwicmVmX2lkIjoiNjczOTZkNzg3MjgyMDZlZmI5MmYxZjUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NjA1LCJleHAiOjE3ODIzOTUwMDV9.J5UsA4O1tbLn6SKL7gTn2XxLA0H0J7p7N1oMz-I0dEg)

 (image/png)    


[image2024-5-9_9-46-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzhhMWFkOWEzMzExZGM5MTU0IiwicmVmX2lkIjoiNjczOTZkNzg3MjgyMDZlZmI5MmYxZjUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NjA1LCJleHAiOjE3ODIzOTUwMDV9.y15MTs1hGrJE5trApyVZ5CvndL1oldBWHZ-JYFYaUbA)

 (image/png)    


[image2024-4-29_18-13-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzg4OTcwYzJhZjRmNTIxMmUxIiwicmVmX2lkIjoiNjczOTZkNzg3MjgyMDZlZmI5MmYxZjUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NjA1LCJleHAiOjE3ODIzOTUwMDV9.29xuAVeuE5M44zM1EJ7K9VlEMY__bxSldldf2kdknFU)

 (image/png)    


[image2024-4-29_16-54-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzg4OTcwYzJhZjRmNTIxMmUyIiwicmVmX2lkIjoiNjczOTZkNzg3MjgyMDZlZmI5MmYxZjUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NjA1LCJleHAiOjE3ODIzOTUwMDV9.nTZutjHt0FWp4DNo8iSUHgtRq9fGINw7agtxwud77uY)

 (image/png)    


[下推框架图.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzhhMWFkOWEzMzExZGM5MTU1IiwicmVmX2lkIjoiNjczOTZkNzg3MjgyMDZlZmI5MmYxZjUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NjA1LCJleHAiOjE3ODIzOTUwMDV9.lgPYIZBV4-W8_iasV5v4tfkYNsVfw3xKp6cP0aN9CgE)

 (image/png)    


[image2024-4-26_10-17-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzg4OTcwYzJhZjRmNTIxMmU0IiwicmVmX2lkIjoiNjczOTZkNzg3MjgyMDZlZmI5MmYxZjUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NjA1LCJleHAiOjE3ODIzOTUwMDV9.Vc1gBTEmIpjuIuuYKeo33sVcBHSQMTTeXp8rkl8uXxg)

 (image/png)    
