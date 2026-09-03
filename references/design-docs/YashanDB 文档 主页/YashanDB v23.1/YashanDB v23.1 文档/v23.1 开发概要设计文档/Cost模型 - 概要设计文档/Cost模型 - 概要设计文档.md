Created by 王泽凯, last modified on 一月 22, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  

本概要设计文档，将主要把cost模型相关的接口以及框架给进行阐述，具体的算法可以看这个文档：

  [heap表 - 设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109597735)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

此前在未实现新的cost模型前，使用的大部分cost公式都是从rbo继承过来的默认值。这就导致在很多场景计算不够准确。下面列出此前一些计算不准确的场景。

1. Hash Join未实现准确的build table cost，导致hs join和nl join完全估算不准确。
1. Index Scan未准确的实现index range/index ffs/index full等scan的cost，而是通过因子强行的进行调整。
1. Px相关cost也是使用因子实现，并行度以及dn个数并为考虑仔细。
1. Hash Group由于未实现build cost，导致估算也完全不准确。
1. Filter、Expr相关execute cost未考虑。
1. 硬件条件和buffer情况未考虑。


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

-   [8.9.5 The Optimizer Cost Model (oracle.com)](https://docs.oracle.com/cd/E17952_01/mysql-5.7-en/cost-model.html)  
-   [Oracle SQL Tuning_03 CBO算法 | 一个DBA的工作学习笔记 (dbase.cc)](http://dbase.cc/2018/08/09/oracle/Oracle_SQL_Tuning-%E8%AF%BE%E7%A8%8B%E5%AD%A6%E4%B9%A0/03_Oracle_SQL_Tuning/)  
-   [Oracle MREADTIM and SREADTIM workload statistics (dba-oracle.com)](https://www.dba-oracle.com/t_mreadtim_sreadtim_workload_statistics.htm)  
-   [Predicting query execution time: Are optimizer cost models really unusable? | IEEE Conference Publication | IEEE Xplore](https://ieeexplore.ieee.org/abstract/document/6544899)  
-   [A Survey on Advancing the DBMS Query Optimizer: Cardinality Estimation, Cost Model, and Plan Enumeration | Data Science and Engineering (springer.com)](https://link.springer.com/article/10.1007/s41019-020-00149-7)  
-   [How good are query optimizers, really? | Proceedings of the VLDB Endowment (acm.org)](https://dl.acm.org/doi/abs/10.14778/2850583.2850594)  
-   [The Volcano optimizer generator: extensibility and efficient search | IEEE Conference Publication | IEEE Xplore](https://ieeexplore.ieee.org/abstract/document/344061)  
-   [DB2 advisor：一个足够聪明的优化器，可以推荐自己的索引 |IEEE会议出版物 |IEEE Xplore的](https://ieeexplore.ieee.org/abstract/document/839397)  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能    
    
|硬件相关底层cost|通过测试以及锚定相应硬件确定cost|是|是|----|
||算子cost|1. 从实现细节上确定cost,2. 考虑buffer、cpu、io相关影响|是|是|----|
||expr/filter|1. 从实现细节上确定cost|是|是|----|
|性能|性能场景1|TPCH性能提高|是|是|----|
||性能场景2|索引选择正确|是|是|----|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  

**无。**

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

当前文档主要介绍整个cost的架构设计，不涉及细节实现。此外，当前cost只实现了行执行的cost，对于列执行的cost现在还是使用的行cost。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  

大体架构图如下所示。

![](https://pingcode.yasdb.com/atlas/files/public/673969378970c2af4f51f688/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBQUFBQkFBQUJBQUFJQkFBQUFRQUFRQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBRmtCQUFBSkFBQUFrQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjU5OTksImV4cCI6MTc4MjEzNjc5OX0.P8ZEMAIv2ZXTvvb8U4k7HqKczznYGTUx6bKuzlr34nU)

###   [4.1 优化器Group框架以及与Cost计算的关系](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

![](https://pingcode.yasdb.com/atlas/files/public/67396938a1ad9a3311dc74ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBQUFBQkFBQUJBQUFJQkFBQUFRQUFRQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBRmtCQUFBSkFBQUFrQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjU5OTksImV4cCI6MTc4MjEzNjc5OX0.P8ZEMAIv2ZXTvvb8U4k7HqKczznYGTUx6bKuzlr34nU)

当前优化器框架是参照cascade&volcano框架实现的，因此在进行优化的时候，并不是一个Op Tree相应的形式，而是多层Group的组织形式。Cost相关的计算也是在这一架构上进行展开的。

在上图中，可以看到一个memo里面，存在多个group，每个group里包括了多个group expr。在逻辑上，多个group expr输出的结果都是等价的。像是group 0中的hash join和nl join的group expr。尽管他们的物理算子不一样，但实际上，他们的输出结果是一样的。

每个Group Expr中，保存了一个对应的Op。而这个Op对应的父子关系，则由group expr中的child groups来表示。child group指向了下层的group，下层group相当于上层group expr的儿子。同样的，在下层group中，也包括了很多个逻辑上等价的group expr。

每个group expr也包括了对应的Op和childgroups（如果是底层了就是NULL）。整个Op Tree就通过这种group的方式，进行了展开。

  


当前框架在进行遍历的时候，是自顶向下，深度优先的进行遍历。因此会从顶部一直递归到最底下的Group，对最底层group的全部group expr进行Cost相应的计算。

![](https://pingcode.yasdb.com/atlas/files/public/67396938a1ad9a3311dc7501/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBQUFBQkFBQUJBQUFJQkFBQUFRQUFRQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBRmtCQUFBSkFBQUFrQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjU5OTksImV4cCI6MTc4MjEzNjc5OX0.P8ZEMAIv2ZXTvvb8U4k7HqKczznYGTUx6bKuzlr34nU)

在算完最底层的全部group expr后，会保留一个最好的expr，并且将其相应的OptCtx保存下来。OptContext里面保存了这个GroupExpr相应的一些信息。具体内部的结构体内容如下所示。

```
//====================OptContext start=========================//
typedef struct OptContext {
    OptmzState   state;
    CodUint8     unused[4];
    CboGroup*    cboGroup;
    ExtraProp*   reqdProp;
    CostContext* costCtx;              // 主要使用
} OptContext;

//====================CostContext start=========================//
typedef struct StCostContext {
    OptmzState    state;
    CodBool       invalid;
    CodBool       isIndexDesc;
    CodUint8      unused[2];
    CodFloat      shardingFactor;     // 主要使用
    CodFloat      dstbFactor;         // 主要使用
    CboGroupExpr* groupExpr;
    ObjectArray*  childOptCtxs;
    ObjectArray*  subqCtxs;
    ExtraProp*    drvdProp;
    CboCost*      cost;               // 主要使用
    CboStats*     stats;              // 主要使用
} CostContext;

typedef struct StCboCost {
    CodFloat totalCost;
    CodFloat fetchCost;               // 主要使用
                                      // fetch cost = cpu fetch cost + io swap cost
} CboCost;
```

通过这些保存好的context，并将其传递到父亲层的group中，既可以实现父子关系的指定。（ctx传递的具体实现在递归结构中非常容易，只需要在递归儿子的时候放一个指针进去，下层在计算出最好的cost ctx时，把指针赋值好即可拿到。之后放进本层进行计算即可）。

除了上述整体的框架，实际上还有些细节是值得考究的。在算子层的cost时，只保留了最小cost的那个group expr的信息往上传。这样不一定能保证选择出来的最终Op Tree在cost上是最优的。局部最优的集合，逻辑上并不能完全的表征为全局最优。

###   [4.2 Cost](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)      [Model模块](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)      [入口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

整个Cost Model的入口在computeCostCtx这个函数，这个函数首先会将拿到的本层Op和下层传上来的CostCtx进行封装，封装到costInfo内部。然后调用CostOp进行不同Op的cost计算。

![](https://pingcode.yasdb.com/atlas/files/public/673969388970c2af4f51f68a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBQUFBQkFBQUJBQUFJQkFBQUFRQUFRQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBRmtCQUFBSkFBQUFrQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjU5OTksImV4cCI6MTc4MjEzNjc5OX0.P8ZEMAIv2ZXTvvb8U4k7HqKczznYGTUx6bKuzlr34nU)

需要注意的是，在setInfo中，要准确的将儿子Op相关的属性赋值正确。特别是setCostParalInfo，这里会根据分布式的分区信息和并行信息，将相应的factor进行赋值。之后再px以及并行计算的时候，会用到相应的信息。

###   [4.3 Cost Model模块整体框架](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

在进入了CostOp后，就进入了Cost Model内部进行相应的计算了。Cost Model内部主要分为两层，第一层就是Op层，在这一层，不同Op会有不同的cost算法进行计算。

第二层是底层算法，这一层在Op层里呗调用，每个Op计算cost的时候，会调用一些公共的cost算法，比如cpuFetchCost算法，filterExecCost算法等等。

从而由这些底层的算法构成了一致的Cost Model。

![](https://pingcode.yasdb.com/atlas/files/public/673969388970c2af4f51f68b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBQUFBQkFBQUJBQUFJQkFBQUFRQUFRQUFBQUFBQUFBQUFBQUFDQUFDQUFBQUFBRmtCQUFBSkFBQUFrQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjU5OTksImV4cCI6MTc4MjEzNjc5OX0.P8ZEMAIv2ZXTvvb8U4k7HqKczznYGTUx6bKuzlr34nU)

需要注意的是，当前col相关的列执行算法并未实现，这使得全部的cost计算都是基于row行执行算法得来的，在列执行时可能会存在不准确的情况。

###   [4.4](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)      [Cost Model底层因子](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

在底层算法层中，存在很多内部的因子，这些因子是决定cost算法的关键。这些因子主要可以分为两部分。

第一部分就是和硬件相关的因子，主要有CPU、IO、网络三大类相关的因子。相关因子如下所示。

```
// CPU part
// base is ms 2.9GHZ => 2.9 * 10e9 HZ (s) => 2.9 * 10e9 HZ (s) * 1 / 1000
#define CPU_FREQUENCY 2.9e6f
#define AVG_CYCLE_EACH_INSTRUCTIONS 0.5f

// MEMORY part
#define MEM_COPY_INSTR_PER_BYTE 0.322f
#define MEM_COPY_COST_PER_BYTE (MEM_COPY_INSTR_PER_BYTE / CPU_FREQUENCY)
#define MEM_READ_MS (CPU_FREQUENCY / MEM_COPY_INSTR_PER_BYTE)
#define MAT_SLOT_SIZE 2

// IO part
#define IO_LATENCY 6
// ms/bytes  assume: 200MB / 1s, rate => 1 * 1000 ms / (200 * 1024 * 1024) bytes
#define IO_BLOCK_TRANS_RATE 4.76837158203125e-6f

// NET part
#define NET_IO_MS MB(1)
#define MEM_NET_RATIO (MEM_READ_MS / NET_IO_MS)
```

需要注意的是，当前这一部分仍然是锚定了特定的硬件，后续需要做成能够适配不同的硬件进行变化的版本。

第二部分就是各个filter以及expr相关的执行指令数，这一部分是锚定具体的执行代码的，在代码修改后，也需要相应的进行调整。下面是相关的部分因子。

```
// EXPR COST PART
#define CMP_INSTRUCTIONS 138.65f
#define ADD_INSTRUCTIONS 97.65f
#define SUB_INSTRUCTIONS 97.65f
#define MUL_INSTRUCTIONS 126.97f
#define DIV_INSTRUCTIONS 176.35f
#define MOD_INSTRUCTIONS 172.89f
#define NEG_INSTRUCTIONS 97.65f
#define BIT_OPER_INSTRUCTIONS 96.65f
#define VAR_COPY_INSTRUCTIONS 1.0f

#define NATIVE_CONVERT_INSTRUCTIONS 102.65f
#define INTERVAL_CONVERT_INSTRUCTIONS 152.63f
#define NUMBER_CONVERT_INSTRUCTIONS 267.32f
#define VARLEN_CONVERT_INSTRUCTIONS 842.67f

#define ONE_BYTE_TYPE_INSTRUCTIONS 6.0f
#define TWO_BYTE_TYPE_INSTRUCTIONS 7.0f
#define FOUR_BYTE_TYPE_INSTRUCTIONS 8.0f
#define EIGHT_BYTE_TYPE_INSTRUCTIONS 9.0f
#define FLOAT_TYPE_INSTRUCTIONS 8.5f
#define DOUBLE_TYPE_INSTRUCTIONS 9.5f
#define INTERVAL_TYPE_INSTRUCTIONS 19.2f
#define NUMBER_TYPE_INSTRUCTIONS 115.98f
#define VARLEN_TYPE_INSTRUCTIONS 136.62f
```

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

当前cost只实现了行执行的cost，对于列执行的cost现在还是使用的行cost。后续需要考虑相应的实现。

此外，当前cost算法对于硬件的适配做的还不够好，后续需要更好的支持。

## Attachments:

[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzc4OTcwYzJhZjRmNTFmNjdhIiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.fXXyhLKFGrv2Tf7FCQA0A9-ziFNM_j_nUyUvPuAvdoM)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzc4OTcwYzJhZjRmNTFmNjdiIiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.SuUbe9S5iOc-zAmHTjBZpggKixP1t0pd4bT2q1i4bXo)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzc4OTcwYzJhZjRmNTFmNjdkIiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.g5psvK2MNk2eaQ3eBK7phhpj1vGSk0pjsSpVJooSHLY)

 (image/png)    


[image2024-1-22_15-37-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzdhMWFkOWEzMzExZGM3NGY1IiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.7VjKaA5GPwV1VthUFSt3GbeiOF4wKFmMCJMSst2Hi4E)

 (image/png)    


[image2024-1-22_15-37-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzc4OTcwYzJhZjRmNTFmNjgxIiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.hSDaSnbxsX4twwiLqRo2li72sSS_IvzPIqVXiPFFBgI)

 (image/png)    


[image2024-1-22_15-38-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzdhMWFkOWEzMzExZGM3NGY4IiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.svmH4qqOkn55WFewlpJSOGzJQbZzgbLmD2iv1Ue1Gkw)

 (image/png)    


[image2024-1-22_15-39-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5MzdhMWFkOWEzMzExZGM3NGZhIiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.Qsd5sqkLCmpLvhkrepr_UBL29gFBPGJz4bgkluLa9KE)

 (image/png)    


[image2024-1-22_15-56-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Mzc4OTcwYzJhZjRmNTFmNjgzIiwicmVmX2lkIjoiNjczOTY5Mzc3MjgyMDZlZmI5MmVmMGNkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI1OTk5LCJleHAiOjE3ODIyMTIzOTl9.JRAyJJ8RyPQ4kDzCakui_zKJ8JklrDhlQ9hGEceZssk)

 (image/png)    
