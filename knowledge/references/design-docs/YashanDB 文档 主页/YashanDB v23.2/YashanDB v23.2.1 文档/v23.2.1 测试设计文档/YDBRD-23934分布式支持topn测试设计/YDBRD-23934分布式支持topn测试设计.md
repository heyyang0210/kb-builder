Created by 韩晓盼, last modified on 十二月 13, 2023

IR：    [YDBRD-23848](https://jira.yasdb.com/browse/YDBRD-23848?src=confmacro)    -  分布式支持优化器TopN计划和选择  完成

SR：    [YDBRD-23934](https://jira.yasdb.com/browse/YDBRD-23934?src=confmacro)    -  分布式支持topn   完成

# 1. 概述

本文描述支持 TOPN 算子的测试设计。  Top N 表示取前 N 条有序的结果集，使每次排序只在 N 个大小的集合进行排序，提高执行效率； 主要用于order by + limit (offset) 场景。

本文支持部署模式：分布式

# 2. 需求分析

## 2.1 功能点分析

1、功能特性：

- 支持按照多个列指定顺序（升序、降序）排序后获取前 N 行数据
- 可以限制排序内存的大小
- 数据量超过排序内存大小后将数据写到临时文件
- 排序完成后删除临时文件


2、语法：

```
create table t1(a int, b char(20));
insert into t1 values(1,'ab');
insert into t1 values(1,'ab');
insert into t1 values(2,'ab');
...
...

select * from t1 order by b limit 6;

select * from t1 order by b limit 5 offset 1;
```

3、开发接口：

```
// 在分布式上放开topN功能
static inline CodResult initSortPlan(AnlOptimizer* optmzr, CboOperator* cboOp, AnlPlan** anlPlan, PlanType planType)
{
MemoryContext* mctx = optmzr->owner;
COD_CALL(initBasePlan(mctx, cboOp, anlPlan, planType));
(*anlPlan)->sort.topN = PHYS_SORT(cboOp)->sortDesc->topN; // 将sort算子的topN赋值给anlPlan上去执行，走SORT_FOT_LIMIT复合排序类型
(*anlPlan)->sort.forType = (*anlPlan)->sort.topN == 0 ? SORT_FOR_DEFAULT : SORT_FOR_LIMIT;
COD_CALL(anlCopySortColArray2List(mctx, PHYS_SORT(cboOp)->sortDesc->sortCols, &(*anlPlan)->sort.sortExprs));
COD_CALL(makeSortRsColumns(mctx, cboOp->projExprs, anlPlan));
return COD_SUCCESS;
}

// 分布式已经放开 
CodResult createRowDistinct(AnlOptimizer* optmzr, CboOperator* cboOp, PlanDataset* ds, AnlPlan** anlPlan)
{
/*
* 赋初值给 DistinctPlan
*/
(*anlPlan)->distinct.topN = PHYS_UNIQUE(cboOp)->topN; //赋初值给topN
return COD_SUCCESS;
}


// 分布式已经放开 
static inline CodResult initGroupPlan(MemoryContext* mctx, CboOperator* cboOp, AnlPlan** anlPlan, PlanType planType,
PlanDataset* ds)
{
// 赋初值给GroupByPlan
(*anlPlan)->groupBy.topN = PHYS_GROUP(cboOp)->topN; // 赋值给topN
return COD_SUCCESS;
}
```

开发文档：    [分布式支持TpoN方案设计 YDBRD-23934 - 何阳 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138556933)    、    [TopN Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/TopN+Design)  

## 2.2 应用场景

-  主要用于order by + limit (offset) 场景


## 2.3 规格约束

- N 由 limit 跟 offset 的和决定，目前没有限制，大于 uint32 的最大值才不会选上该计划。
- 插入 key 的每行大小不超过 19K，否则报错


# 3. 详细测试设计

## 3.1 测试设计方法

      边界值、场景测试。limit N（当N达到上限，计划将不走topn sort），对N的边界进行测试属于边界值；limit 与其他（distinct、group by、过滤条件等）组合测试属于场景测试。

## 3.2 详细测试设计

       1.使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式

![](https://pingcode.yasdb.com/atlas/files/public/67396bbaa1ad9a3311dc850c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY1NjIsImV4cCI6MTc4MjMwNzM2Mn0.jI_hiJIDJUlykS0qsw1SaV4UejxVfZLu_fGvWZ-xJz0)

        2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

具体测试点：

- **并发测试**


1、同一张表同时执行多个 TopN 查询，覆盖：全内存排序、部分内排部分外排

2、不同表同时执行多个 TopN 查询，覆盖：全内存排序、部分内排部分外排

- **长稳测试**


可覆盖：order by KEY [KEY 长度为 19K] limit N offset F，排序内存超上限

- **性能测试**


1、横向对比

新旧版本间的对比（验证 TopN 的性能是否更优）

|排序方式|测试用例|期望结果|
|---|---|---|
|全内排|1000000 个选 10 个|新版本性能比旧版本好|
||10000000 个选 10 个||
|部分外排|10000000 个选 100000 个||


2、纵向对比

对比相同数据下 N 数量的性能差异

|排序方式|测试用例|期望结果|
|---|---|---|
|全内排|100000 个选 10 个/100个/1000个/10000个|性能相差不大|
||1000000 个选 10 个/100个/1000个/10000个/100000个|  
|
|部分外排|10000000 个选 100000个/500000个/1000000个/5000000个|  
|


- **总结**


|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|  
|
|长稳|涉及|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|涉及|
|可维护性|  
|


参考文档：    [TOPN 算子测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=91780819)  

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[冒烟用例及全量文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmFhMWFkOWEzMzExZGM4NTBiIiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTYyLCJleHAiOjE3ODIzODI5NjJ9.PYRDs0NgSQX-wNzFcSV5x5qPCODevM9s9WdZlyL1q1g)

# 5. 测试框架设计

- 沿用guider框架


# 6. 测试环境说明

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


# 7. 工作量评估

工作量：5人天

计划测试完成时间：2023年12月19日

[分布式支持topn测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmE4OTcwYzJhZjRmNTIwNjk0IiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTYyLCJleHAiOjE3ODIzODI5NjJ9.n0m4UMvFSu4wuNbXAaA_vROkjifwi6dCawMw1zm5Bx4)

## Attachments:

[image2023-12-5_16-32-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmE4OTcwYzJhZjRmNTIwNjk1IiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTYyLCJleHAiOjE3ODIzODI5NjJ9.8EmfmKDcDYkGRQdP6rqy7bXT52czxf9HVhzBEPu_6lg)

 (image/png)    


[image2023-12-13_17-22-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmE4OTcwYzJhZjRmNTIwNjk2IiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTYyLCJleHAiOjE3ODIzODI5NjJ9.YQXyl1EahjiV7y4MP6id95uePuvZRvmG-K5OYnU9NjY)

 (image/png)    


[分布式支持topn测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmE4OTcwYzJhZjRmNTIwNjk0IiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTYyLCJleHAiOjE3ODIzODI5NjJ9.n0m4UMvFSu4wuNbXAaA_vROkjifwi6dCawMw1zm5Bx4)

 (application/x-xmind)    


[冒烟用例及全量文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmFhMWFkOWEzMzExZGM4NTBiIiwicmVmX2lkIjoiNjczOTZiYmE1OTNmOTljOWZmMjM2NjU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTYyLCJleHAiOjE3ODIzODI5NjJ9.PYRDs0NgSQX-wNzFcSV5x5qPCODevM9s9WdZlyL1q1g)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计：    [TOPN 算子测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=91780819)  ,开发设计文档：    [TopN Design - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/TopN+Design)  ,22.2 SR：     [[YDBRD-23848] 分布式支持优化器TopN计划和选择 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-23848)  ,Posted by hanxiaopan at 十二月 13, 2023 11:52|
|---|
