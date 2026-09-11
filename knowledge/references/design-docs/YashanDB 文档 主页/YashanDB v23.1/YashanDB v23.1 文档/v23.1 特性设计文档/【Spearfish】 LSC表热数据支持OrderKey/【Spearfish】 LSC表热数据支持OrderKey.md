Created by 谢锐, last modified on 四月 27, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#1-overview概述)  

  [https://jira.yasdb.com/browse/YDBRD-13038?filter=-1](https://jira.yasdb.com/browse/YDBRD-13038?filter=-1)  

LSC表热数据是实时同步的，存在高频更新删除场景。

支持热数据Slice通过OrderKey索引来加点其点查性能。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#2-features功能特性)  

*说明本方案的功能特性。*

*列出本方案对外提供的接口、配置参数、API等。*

1，创建时可指定仅针对SCOL或全部使用order key。

2，支持动态启用/关闭 mcol order key。

3，支持通过MCOl order key加速扫描，可通过v$sysstat以及autotrace等方式观察MCOL执行方式。

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#4-limitations功能限制)  

*说明本方案对外的功能限制或约束。*

1，MCOL和SCOL的order key是一致的，建表时指定，不可修改。

     这里order key的生命周期与slice一致。

2，仅支持针对等值条件使用order key扫描。

     range扫描代价难以评估

3，与SCOL一样，仅特定条件的下推。

     参考：    [LSC条件下推](https://conf.yasdb.com/pages/viewpage.action?pageId=76910895)  

4，order key与btree索引一样有类型和大小约束。

     对于老版本，升级后打开mcol order by时会检查是否符合约束。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#5-detail-design详细设计)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#51-architecture架构)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

*参考*    [【Spearfish】LSC表支持更新删除](/pages/createpage.action?spaceKey=YAS&title=%E3%80%90Spearfish%E3%80%91LSC%E8%A1%A8%E6%94%AF%E6%8C%81%E6%9B%B4%E6%96%B0%E5%88%A0%E9%99%A4)  

  


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#52-data-structures--flow数据结构与流程)  

*设计主要数据结构、工作流程、序列图等。*

  


#### 1，支持可选的MCOL排序

  


语法调整：

ORDER BY "("column_name{"," column_name}")" [NULLS (FIRST|LAST)] [ASC|DESC] [SCOL].

增加可选SCOL，默认对MCOL和SCOL都应用排序键。

  


系统表调整：

```
CREATE TABLE TABSORT$

(

BO# BINARY_BIGINT NOT NULL,

SORTMETHOD# BINARY_INTEGER NOT NULL,

NULLSFIRST# BINARY_INTEGER NOT NULL,

SORTTYPE# BINARY_INTEGER NOT NULL,

SORTMCOL BOOLEAN  //是否对MCOL排序，null或false时，不排序MCOL

) SYSTEM 153 ORGANIZATION HEAP
```

升级脚本中增加该列。

  


Alter命令：

alter table xx enable/disable mcol order by.

  


  


#### 2.TableSortDesc

作为order key的元数据，在vgd支持order key后，其中存储了索引必须的信息，如cmpInfo等。

```
typedef struct StTableSortDesc {
    CodUint64           oid;
    CodBool             isAsc;
    CodBool             nullsFirst;
    SortType            type;
    CodUint16           colCnt;
    TableSortColumnDesc cols[ANK_MAX_SORT_COLUMNS];

    CodUint16           colIds[ANK_MAX_SORT_COLUMNS];
    CodUint8            cmpInfoTypes[ANK_MAX_SORT_COLUMNS];
    AnkIndexColumnDesc  cmpInfoColDesc[ANK_MAX_SORT_COLUMNS];
    BtreeCmpInfo        *cmpInfo;
} TableSortDesc;
```

  


#### 3.Filter表示与选择

调整filter模块接口，spf中直接存储CodFilter，filter管理不走coast接口。

目前按照order key顺序来选择可用条件，下推的point和section条件均可运用。

注意：order key第一个section条件列后的列不可作为过滤条件。

         范围后的查询字段都不是有序的，所以索引都失效了，目前实现上

  


#### 4. Order key存储结构

OrderKey与Btree关系如下：

Order Key {

    Index {

         Btree

    }

}

OrderKey是一个Index结构，其实现目前使用Btree。

  


order key dict挂在vgd slice Dict上，vgd slice相关操作对order key进行维护。

vgd slice转换时删除order key存储结构。

查询时根据filter初始化vgd slice scan，如有下推条件且可用于order key，则启用order key扫描。

此外如果order key覆盖条件，则查询结果是精确的。

如所有查询列均被order key覆盖，则走index only scan。

  


#### 5. CodScanFilter与IndexRange

CodScanFilter可以表示列的多个条件，其关系是OR。不同列之间是AND。

IndexRange只能表示一个多列的区间。

CodScanFilter到IndexRange映射是笛卡尔乘积关系。

如a =1 or a =2 and b>10 or b<5 转换为Index Range为：

(1,10) ~ (1,+∞)

(1,-∞) ~ (1,5)

(2,10)~(2,+∞)

(2,-∞) ~ (2,5)

这里没有不做条件本身改写，如integer类型 a条件可改为 a =1 or a =2 →  a > 0 and a < 3。

由上层优化器来改写。

  


5.1 条件的排序与去重

索引扫描将条件拆分为多个IndexRange，分别扫描后将结果合并。

这决定了扫描条件不能有交集，否则结果不对，因而需要对条件做排序，将重叠重复值进行合并。

  


6，查看执行方式

set autotrace on;

alter session set statistics_level = all;

执行语句后显示相关统计信息：

[MColScanMode] : order key scan

  


select * from v$sysstat where name like ‘%MCOL%’;      

增加了如下统计信息：

MCOL SCAN SLICES 8 4

MCOL ORDER KEY SCAN SLICES 8 4

  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#7-document资料)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

|任务|说明|工作量评估|  
|
|---|---|---|---|
|VGD支持Order key子结构|根据order key创建Btree，在vgd转换时删除Btree，vgd dml操作时维护Btree|2人周|  
|
|支持基于vgd order key扫描|依赖条件下推，确定是否能走order key扫描，封装扫描接口。,以及auto trace跟踪等|1人周|  
|
|  
|  
|  
|  
|


##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


  


## Attachments:

## Comments:

|  [](null)  ,order by(c) asc null first [SCOL],alter table xx enable/disable mcol order by ;     
  enable时创建segment，disable删除    
  老的表默认使用scol，升级时保持元数据兼容性。    
  仅支持等值条件。    
  统计信息：mcol slices, mcol order key scan slices.,order key的约束需要与btree索引保持一致。order key长度受索引最大记录长度限制。目前order key创建时未约束。数据类型？,Posted by xierui at 四月 18, 2023 11:55|
|---|
|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396afea1ad9a3311dc7efa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBRkFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQkFnQUFBQUFBQUFBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NTksImV4cCI6MTc4MjMwMTM1OX0.Spl7MAPVGEb0YtDBF-2nuSDAb97dG-JPtQIQIwT5vcE),Posted by xierui at 四月 21, 2023 14:32|
|  [](null)  ,测试时注意number比较，以及重复的等值条件等情况。,多条件，下推条件的顺序与SQL中顺序不一定一致。,非order key前序条件不可用，首条件是区间，后面只能带点值等等。,  
,Posted by xierui at 四月 27, 2023 22:01|
|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396afe8970c2af4f520084/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBRkFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQkFnQUFBQUFBQUFBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NTksImV4cCI6MTc4MjMwMTM1OX0.Spl7MAPVGEb0YtDBF-2nuSDAb97dG-JPtQIQIwT5vcE),Posted by xierui at 五月 09, 2023 21:13|
