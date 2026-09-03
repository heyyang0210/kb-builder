Created by 何阳, last modified by  化明虎 on 十月 14, 2024

JIRA：    [https://jira.yasdb.com/browse/YDBRD-23933](https://jira.yasdb.com/browse/YDBRD-23933)  

依赖SR：    [https://jira.yasdb.com/browse/YDBRD-24171](https://jira.yasdb.com/browse/YDBRD-24171)  

##   [1. Overview（概述）](#1-overview概述)  

从Tpcds的query67语句，发现窗口函数的filter没有下推到DN节点上，造成在CN上处理大量数据量，执行时间过长。因此需要将将窗口函数的filter下推到DN节点，其中可以将部分filter改写成topN的方式，挂在到窗口函数上，并且需要将窗口函数下推到DN上执行，才能达到最终的效果。

##   [2. Features（功能特性）](#2-features功能特性)  

只实现rank窗口函数的filter下推的两阶段功能。

##   [3. Interfaces（接口）](#3-interfaces接口)  

无对外变更的SQL，配置参数

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 只支持rank函数filter的两阶段执行
1. TopN只支持带有rank函数的窗口函数列，filter条件为 rank窗口函数列 小于，等于，小于等于常量情况，或者常量 大于，大于等于，等于rank窗口函数列的情况


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](#51-architecture架构)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*  需要增加一个算子

**基础数据结构**

1.   `CboOperator`       对应的枚举类型    `EnCboOpType`     OP_LOGICAL_XX  OP_PHYSICAL_XX其中逻辑算子需要放在__LOGICAL_OP_COUNT__之前，物理算子需要放在__LOGICAL_OP_COUNT和__OPERATOR_COUNT__之间
1.   `AnlPlan`           对应的枚举类型    `EnPlanType`     PLAN_XX需要增加XXPlan结构体


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

*设计主要数据结构、工作流程、序列图等。*

1. 生成逻辑OpTree
1. // 无需改动
1. 静态转换，尝试下推
1. 依赖于需求：    [YDBRD-24171](https://jira.yasdb.com/browse/YDBRD-24171)  
1. 逻辑转逻辑  transform这一层，增加执行路径
1. ​
1. optimize
1. createXxPlan 生成计划
1. transform walks 重写
1. 序列化和反序列
1. executeXxPlan & explian
1. 给plan的id赋值


```
// 1. 在gOpTransforms数组中增加OP_LOGICAL_WINPART算子的下表跟算子枚举的映射关系
// 2. 在gOpTransforms中的gXformLogiWinFunc中增加逻辑转逻辑  两阶段的枚举值
// 3. 在gCboTransformer中增加WINPART算在的逻辑转物理的转换函数 txformLogi2PhysWinPart
// 4. 在gCboTransformer中增加窗口函数算子的逻辑转逻辑2阶段的转换函数 txformLogiWinFunc2Phase2

Transformers gOpTransforms[__LOGICAL_OP_COUNT__];
typedef struct StTransformers {
    CodUint16    count;
    CodUint16    explEnd;
    CodUint8     unused[4];
    TransformId* transformId;
} Transformers;

CboTransformer gCboTransformer[];
typedef struct StAdoTransformer {
    TransformCfg* transformCfg;
    OpTransform   transform;
} CboTransformer;

CodResult txformLogi2PhysWinPart(TransContext* transCtx, CboGroupExpr* srcGExpr, CboMemo* cboMemo,
                                 CboGroupExpr** dstGExpr)
{
    // 1. 行表直接返回

    // 2. 创建物理WINPART OP内存

    // 3. 构建物理GroupExpr

    // 4. 将新的物理GroupExpr挂在到CboGroup的phyGroups上

}

CodResult txformLogiWinFunc2Phase2(TransContext* transCtx, CboGroupExpr* srcGExpr, CboMemo* cboMemo,
                                   CboGroupExpr** dstGExpr)
{
    // 1. 判断是否满足下推 (列表，不是引用子查询，并且topN也不是初始值)

    // 2. 新申请CboGroup，做赋值操作

    // 2.1 深拷贝WindowDecl到新创建的CboOperator上

    // 2.2 将新创建的CboOperator挂在到CboGroup上

    // 2.3 将原来的childGroups挂载到新申请出来的CboGroupExpr的childGroups

    // 2.4 将新创建出来的CboGroup挂载到新创建的ObjectArray

    // 2.5 将src CboGroupExpr的childGroups更新成挂载了新创建出来的CboGroup的ObjectArray

    // 3. 转换新创建出来的二阶段的CboGroup
}



```

```
// 1. 在gLogiOpProcesser中增加reqdExprs函数指针 tranWinPartExprs
// 2. 在gLogiOpProcesser中增加stats 函数指针 estWinPartStats
// 3. 在gLogiOpProcesser中增加extraSubq 函数指针 extraWinPartSubqs

CodResult tranWinPartExprs(ProjContext* projCtx, CboGroupExpr* groupExpr)
{
    // 1. 将上层投影透传到当前算子
}

CodResult estWinPartStats(CboOptimizer* cboOpt, CboOperator* cboOp, StatInfo* statInfo)
{
    // 1. stats不存在直接反馈

    // 2. 给CboOperator的stats赋值
}

CodResult extraWinPartSubqs(MemoryContext* mctx, QueryDesc* query, CboOperator* cboOp, ObjectArray** subqOps,
                              CodBool* hasRef)
{
	// 1. 从窗口函数中的表达式，提取子查询出来
    // 2. 需要给subqOps和hashRef赋值
}

typedef struct StLogiOpProcesser {
    OpStats    stats;       /// Cost函数指针
    PushFilter pushFilter;  /// 下推filter函数指针
    ReqdExprs  reqdExprs;   /// require extra property
    SubQExtra  extraSubq;   /// 子查询 extractor信息
} LogiOpProcesser;

LogiOpProcesser gLogiOpProcesser[];

```

```
CodFloat costHashWinPart(CboOperator* cboOp, CostInfo* costInfo)
{
	// hash winpart的代码值，需要有计算公式
}

CodResult deriveHashWinPart(CboOptimizer* cboOpt, CboOperator* op, ObjectArray* inputOptCtxs, ExtraProp** drvdProp)
{
	// winpart 能够提供的property
}

CodResult requireHashWinPart(CboOptimizer* cboOpt, CboOperator* op, ExtraProp* oriProp, ObjectArray* outProps)
{
	// 可以提供的执行路径
}

PhysOpProcesser gPhysOpProcesser[__OPERATOR_COUNT__]

typedef struct StPhysOpProcesser {
    CboOpCost    cost;     // 代价
    CboOpRequire require;  // 需要的属性
    CboOpDerive  derive;   // 能提供的属性
} PhysOpProcesser;

```

```
// 在gPlanGenerator增加函数指针：createHashWinPart
PlanGenerator gPlanGenerator[] ;

static CodResult createHashWinPart(AnlOptimizer* optmzr, CboOperator* cboOp, AnlPlan** plan, PlanDataset* planDs,
                                   PlannerContext* colCtx)
{
	// 1.创建出PLAN_WINPART的AnlPlan内存
    // 2.根据projExprs构建投影的tuple
    // 3.根据partKeys构建tuple
    // 4.根据sortColumns构建tuple
}

```

```
// 在gTrsfMatWalks增加trsfMatWinPart
static CodResult trsfMatWinPart(AnlWalker* walker, AnlPlan* plan)
{

}

static CodResult walkWinPart(AnlWalker* walker, AnlPlan* plan)
{
    // 1. walk plan

    // 2. walk planExpr
}

static CodResult walkWinPartExpr(AnlWalker* walker, AnlPlan* plan)
{

}

PlanWalk gTrsfMatWalks[__PLAN_COUNT__] ;

PlanWalk gPlanDefaultWalks[__PLAN_COUNT__] ;

PlanWalk gPlanExprWalks[__PLAN_COUNT__];


```

```
static CodResult srlzPlanWinPart(AnlSerializer* srlzr, AnlPlan* plan)
{
    // 序列化child plan
    // 序列化WindowDecl
}
static CodResult dsrlzPlanWinPart(AnlSerializer* dsrlzr, AnlPlan* plan)
{
    // 反序列化child plan
    // 反序列化WindowDecl
}

```

```
// 1.列执行算子，统一会在crab里面执行，不需要在额外增加执行函数
// 2.在gAnlOperators中增加explainHashWinPart 计划打印

CodResult explainHashWinPart(AnlStmt* stmt, AnlPlan* plan)
{
    // 增加hash winpart的相关打印
}
AnlOperator gAnlOperators[__PLAN_COUNT__];


```

```
CodVoid anlMakeIDWithDFS(PlanContext* planCtx, AnlPlan* plan)
{
    // 增加对应算子的处理
       case PLAN_WINPART:
            anlMakeIDWithDFS(planCtx, plan-&gt;hashWinPart.child);
            break;
}

```

###   [5.3 执行 (todo)](#53-执行-todo)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

```
--- 功能测试 
--- 1.基本流程
drop table if exists test;
create table test(key int, a int, b int) organization tac;
 
insert into test values(1, 1, 2);
insert into test values(1, 1, 2);
insert into test values(1, 1, 3);
insert into test values(1, 1, 4);
insert into test values(1, 1, 5);
explain select * from (select rank() over( partition by a order by b) as rank1 from test)aa where rank1 = 4;

--- 2.投影子查询，order by子查询， filter子查询

--- 3.异常报错测试

--- 可靠性测试
不涉及

--- 并发测试
不涉及

```

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,会议纪要：,时间: 2023年12月18日 11:00 ~12:00,参与人员：刘晓旋 周彬鑫 徐晓锋 何阳 吴煜,1. filter 条件为in或者exist情况，是否可以改写成topN  — 不支持改写成topN
1. filter const < rank列 < const 支持改写成topN
1. SQL的filter between and语句也是支持改写成topN
1. 构造内存资源不足的场景，是否有专门针对的窗口函数的内存参数  ----  增加执行评审(叶显昊)
1. rank 列的filter，rank is null是否会下推？
,Posted by heyang at 十二月 18, 2023 11:24|
|---|
|  [](null)  ,自测问题记录：,  [Winpart topN联调问题记录](https://conf.yasdb.com/pages/viewpage.action?pageId=138572482)  ,Posted by heyang at 四月 01, 2024 16:55|
