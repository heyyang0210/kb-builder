Created by 周湘淞, last modified on 五月 14, 2024

*详细设计-YDBRD-26116 : Cost部分算子补全方案设计*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b294](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b294)    *?*    
  *#YASHAN-836 Cost部分算子补全*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618ac33fd997db58ad7eb90](https://pingcode.yasdb.com/pjm/items/6618ac33fd997db58ad7eb90)    *?*    
  *#YDBRD-26116 Cost部分算子补全*

##   [1. 总述](#1-总述)  

对于一些新增的算子，统计信息的计算需要补全，主要包括：集合操作，grouping sets，connect by，winfunc算子。

###   [1.1 需求来源](#11-需求来源)  

客户语句中包含winfunc，grouping sets算子时，要求算子能够根据统计信息选择最优的算法实现，以确保执行性能最优。但当前cost模型对于这些新增的算子的代价计算较为粗糙，不能正确反映算子的具体算法实现性能，需要根据算子实现进行调整。

###   [1.2 调研文档](#12-调研文档)  

  [Cost部分算子补全-特性调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153005198)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|窗口函数算子根据代价评估最优算法|hash根据原有hash计算提取公共函数并调用，sdt调用原有接口，sorted根据条数计算fetch cost。|是|是|
|功能|grouping sets算子根据代价评估最优算法|hash调用提取的公共函数，sort提取sort和group的原有接口。|是|是|
|功能|connect by算子根据条数计算代价|参考join代价计算|是|是|
|功能|集合算子根据条数计算代价|根据条数计算fetch cost|是|是|
|性能|百万级别以上，winfunc算子执行性能|行存走SDT，列存有order by走sort+nosort，无order by走hash|是|是|
|性能|百万级别以上，grouping sets算子执行性能|列存走hash（行存暂未支持grouping sets）|是|是|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

该特性无对外接口，用户仅能通过计划选择算子、算子cost和算子执行性能感知。

内部cost函数接口如下：

```
[OP_PHYSICAL_WINFUNC] = {.cost = costWinFunc},
[OP_PHYSICAL_GROUP] = {.cost = costGroup},
[OP_PHYSICAL_CONNECT_BY] = {.cost = costConnectBy},
// 集合
[OP_PHYSICAL_UNIONALL] = {.cost = costUnionAll},
[OP_PHYSICAL_MINUS] = {.cost = costMinus},
[OP_PHYSICAL_MINUS_ALL] = {.cost = costMinusAll},
[OP_PHYSICAL_INTERSECT] = {.cost = costIntersect},
[OP_PHYSICAL_INTERSECT_ALL] = {.cost = costIntersect}

```

##   [3. 规格与约束](#3-规格与约束)  

1. 当前cost模型均是在行存的基础上写的，未对列存进行特殊计算，本IR不对此进行修改。本IR的实现规格均为行存，涉及到类似window hash的列存部分，仅针对实测性能对算子的cost进行调整，以确保大数据量下能选到性能较好的算子。但window hash的cost计算仍为行存模型，与实际执行不符，但当前不影响。
1. ~~当前cost模型中hash cost计算部分，考虑随机访问块数IO性能时的计算存在问题，即计算hash cost时将这部分随机访问的块视作是在主存内的块，导致随机访问IO较小，但这部分计算和sort以及SDT的cost计算规格不同，因此在实现window hash cost时进行了调整（为了在千万级别以上的列存表选到sort+nosort）。需要关注涉及到hash的所有算子的计划变动~~  。


##   [4. 特性](#4-特性)  

###   [4.1 winfunc算子代价计算](#41-winfunc算子代价计算)  

####   [SDT](#sdt)  

```
CodFloat costRowSortWinFunc(CostInfo* costInfo, ObjectArray* partSortKeys, ObjectArray* projExprs,
                            ObjectArray* winFuncNodes, ExprNodeGet getKeyNode)
{
    // 为与sort代价对齐，调用现有接口；需要根据执行性能调整参数
    return costRowSdt(costInfo, COD_INVALID_UINT64, partSortKeys, projExprs, winFuncNodes, COD_TRUE, getKeyNode);
}



```

####   [NOSORT](#nosort)  

```
CodFloat costRowSortedWinFunc(CostInfo* costInfo, ObjectArray* projExprs, ObjectArray* winFuncNodes)
{
    // 考虑物化、函数执行、fetch、解码代价。主要I/O代价在sort算子中，可根据执行性能在此函数中调整
}


```

####   [HASH](#hash)  

```
CodFloat costRowHashWinPart(CostInfo* costInfo, ObjectArray* partKeyExprs, ObjectArray* projExprs,
                            ObjectArray* sortColumns, ObjectArray* winFuncNodes, CodFloat inRows, CodFloat ndv)
{
    // 和winPart算子操作相同，I/O主要为分区+对分区内数据排序的代价，函数执行、物化、fetch代价可根据执行性能调整
}


```

###   [4.2 grouping sets代价计算](#42-grouping-sets代价计算)  

####   [SORT](#sort)  

```
CodFloat costSortGSets(CboOperator* cboOp, CostInfo* costInfo)
{
    // 将gSets拆成group孩子，并计算每个孩子sort+sorted group代价，加和
}


```

####   [HASH](#hash-1)  

```
CodFloat costHashGSets(CboOperator* cboOp, CostInfo* costInfo)
{
    // // 将gSets拆成group孩子，并计算每个孩子hash group代价，加和
}


```

###   [4.3 connect by代价计算](#43-connect-by代价计算)  

connect by的条数无法通过统计信息估准，Oracle中该算子的条数同样无法估准，因此依赖于条数计算的代价也无法算准。

但由于connect by算子选择具体算法不是通过代价选择的（只要connect filter中包含=就会使用hash，否则使用nest loop），不准确的cost不会影响性能。

connect by的代价可参考join的代价计算。

###   [4.4 集合算子代价计算](#44-集合算子代价计算)  

集合操作中，intersect和minus的条数较难通过统计信息估准，Oracle中这两个集合算子的条数也无法估准，因此无论采用何种算法计算代价，依赖于条数计算的代价也同样是不准确的。

不过，由于集合操作只有hash一种算法，无需通过代价选择特定算法，cost不准确不影响性能。

集合操作的代价计算，可直接根据条数评估fetch代价。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

表5-1

|分类|测试场景|测试内容|
|---|---|---|
|性能测试|条数和distinct数相同，不同数量级|算子计划|
|性能测试|条数固定，distinct不同数量级|算子计划|


表5-2

|算子类型|测试场景|测试内容|
|---|---|---|
|winfunc|winfunc内有order by|大数据量下，行走sdt，列走sort+nosort|
||winfunc内无order by|大数据量下，行走sdt，列走hash|
||各种语法组合，参考    [窗口函数测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=76936312)  |覆盖率|
|grouping sets|各种语法组合，参考    [grouping sets测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133582171)  |覆盖率|
|connect by|有无start with|覆盖率|
||connect filter有无=|覆盖率|
|集合|参考    [集合操作测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135611598)  |覆盖率|


##   [6.资料设计章节](#6资料设计章节)  

1. hash相关算子代价计算调用的通用函数中，使用    `calcVmBlockShiftIoTimes`    函数的方法和其它cost计算函数有未对齐的地方（其它cost函数中使用    `shiftIoTimes`    计算的结果不再额外考虑    `cacheRate`    ，但hash计算函数中有重复考虑的地方），可能导致hash cost计算偏小。尽量不在此SR调整，如果调整，需要考虑所有hash相关算子看护场景。
1.   `costMergeSort`    函数中，调用    `costVmSwapBlock`    传入的block参数是用    `calcVmNormalIoTimes`    计算的，与SDT计算代价的函数未完全对齐，在SDT参数    `valueInline`    为false时，可能导致sort的代价相对于SDT偏小。尽量不调整，若调整，需看护所有SDT相关算子场景。


##   [7.未来规划](#7未来规划)  

当前cost模型仅考虑行存模型，若未来有将行列模型分开考虑代价的性能需求需要进一步调整。