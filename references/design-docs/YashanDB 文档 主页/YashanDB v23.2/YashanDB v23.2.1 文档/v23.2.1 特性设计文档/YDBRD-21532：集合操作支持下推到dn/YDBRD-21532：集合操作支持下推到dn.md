Created by 谭思宇, last modified by  何阳 on 一月 04, 2024

jira     [集合操作支持下推到dn](https://jira.yasdb.com/browse/YDBRD-21532)  

##   [1. Overview（概述）](#1-overview概述)  

TPC-DS需求，需要部分算子支持下推以满足性能需求。

##   [2. Features（功能特性）](#2-features功能特性)  

当前集合操作单机场景下未支持并行，分布式场景下未支持并行与DN执行，DN执行与并行路径等价。

##   [3. Interfaces（接口）](#3-interfaces接口)  

仅修改require产生新的物理路径即可。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 影响单机与分布式。
1. 集合操作都可以下推


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

本次需求只产生DN单阶段集合操作或并行但阶段集合操作，不涉及两阶段新加路径。

###   [5.1 Architecture（架构）](#51-architecture架构)  

如果想在DN或并行线程内做集合操作，按照集合操作不同，当为intersect与minus时需要按照任意hash key分发数据，保证有交集的数据在同一个DN上。

union则可以对下为任意需求。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

由于DN集合操作必须要hash分发，因此requireSet内基本可以参照    `extendGroupHashPart`    的写法。

而requireUnion则可以直接传原始的paraDesc与dstbDesc，并且如果没有原始paraDesc与dstbDesc的场景时，直接传DSTB_RANDOM的并行或分布式需求即可。

由于曾经unionall及其他集合操作支持过并行，可以通过git历史看到之前禁用前的写法。将其稍加改造后requireUnionall如下

union All下推路径设计：1：继承上层传下来的（去重添加，保证优化过的路径不再被优化），    
  如果上层为singleton，则生成singlton和random如果上层为hash，则生成hash。    
  如果上层为广播，则生成广播。如果上层为random，则生成random。

union/intersect/minus：    
  1：上层传下来的不是hash    
  A，添加singleton路径。    
  B，添加hash 路径，hash要确定选择hashkey，每个儿子采用restrict的方式才可以保证数据正确性，选择hashkey，按照distinct排序（具体算法可以单独一个模块）。    
  hashkey的添加思路：按照distinct大小，如果distinct超过rows，则可以停止。    
  2：上层传下来的是hash，则hashkey是一定包含在集合操作的投影中的，映射对应的hashkey传给自己的儿子。

```

static CodResult makeSingleSetProp(CboOptimizer* cboOpt, ExtraProp* oriProp, ObjectArray* outProps)
{
    MemoryContext* mctx = cboOpt-&gt;mctx;
    ObjectArray*   childProps;
    ExtraProp*     reqdProp;
    COD_CALL(anlCreateArray(mctx, &amp;childProps));
    COD_CALL(makeExtraProp(mctx, &amp;reqdProp));
    if (oriProp-&gt;paralDesc != NULL) {
        COD_CALL(makeSingleParalDesc(mctx, &amp;reqdProp-&gt;paralDesc));
    }
    if (oriProp-&gt;dstbDesc != NULL) {
        COD_CALL(makeLocalDstbDesc(cboOpt, &amp;reqdProp-&gt;dstbDesc));
    }
    COD_CALL(objArrayAdd(childProps, reqdProp));
    COD_CALL(objArrayAdd(outProps, childProps));

    return COD_SUCCESS;
} 

static CodResult makeHashSetProp(CboOptimizer* cboOpt, ExtraProp* oriProp, ObjectArray* outProps)
{
    // hash
    ObjectArray* childProps;
    ExtraProp* reqdProp;
    MemoryContext* mctx = cboOpt-&gt;mctx;
    COD_CALL(anlCreateArray(mctx, &amp;childProps));
    COD_CALL(copyPropResetSort(mctx, oriProp, &amp;reqdProp, COD_FALSE));

    ObjectArray* partKeys = NULL;
    ObjectArray* rsCol = PHYS_SET(op)-&gt;leaderRsCols;
    COD_CALL(makeDstbKeyFromRsCols(cboOpt, rsCol, &amp;partKeys, PHYS_SET(op)-&gt;leaderRsCols-&gt;count));

    ColumnAttr* dstAttrs;
    COD_CALL(anlAllocMem(mctx, sizeof(ColumnAttr) * partKeys-&gt;count, (CodChar**)&amp;dstAttrs));
    setAttrsByRsCols(rsCol, partKeys, dstAttrs);

    if (oriProp-&gt;paralDesc != NULL) {
        COD_CALL(makeParalDesc(mctx, &amp;reqdProp-&gt;paralDesc, partKeys, DSTB_HASHED, cboOpt-&gt;partCnt, dstAttrs,
                               cboOpt-&gt;degree));
        oriProp-&gt;paralDesc-&gt;isRestrict = COD_TRUE;
    }

    if (oriProp-&gt;dstbDesc != NULL) {
        CodUint32 groupCount;
        GroupDesc* groupDesc;
        COD_CALL(cboGetGroupList(cboOpt, COD_GROUP_TYPE_DN, &amp;groupCount, &amp;groupDesc));
        COD_CALL(makeDstbDesc(mctx, &amp;reqdProp-&gt;dstbDesc, partKeys, DSTB_HASHED, groupCount, groupDesc, dstAttrs));
        oriProp-&gt;dstbDesc-&gt;isRestrict = COD_TRUE;
    }

    COD_CALL(objArrayAdd(childProps, reqdProp));
    COD_CALL(objArrayAdd(outProps, childProps));
    return COD_SUCCESS;
} 

CodResult requireUnionAll(CboOptimizer* cboOpt, CboOperator* op, ExtraProp* oriProp, ObjectArray* outProps)
{
 	MemoryContext* mctx = cboOpt-&gt;mctx;
    ObjectArray*   childProps = NULL;
    COD_CALL(anlCreateArray(mctx, &amp;childProps));
    ExtraProp* childProp;
    COD_CALL(copyPropResetSort(mctx, oriProp, &amp;childProp, COD_TRUE));
    COD_CALL(objArrayAdd(childProps, childProp));
    COD_CALL(objArrayAdd(outProps, childProps));

    return COD_SUCCESS;
}

CodResult requireSet(CboOptimizer* cboOpt, CboOperator* op, ExtraProp* oriProp, ObjectArray* outProps)
{
    if (oriProp-&gt;dstbDesc-&gt;dstbStatus != DSTB_HASHED) {
        COD_CALL(makeSingleSetProp(cboOpt, oriProp, outProps));
        return makeHashSetProp(cboOpt, oriProp, outProps);
    }

    // hash
 	MemoryContext* mctx = cboOpt-&gt;mctx;
    ObjectArray*   childProps = NULL;
    COD_CALL(anlCreateArray(mctx, &amp;childProps));
    ExtraProp* childProp;
    COD_CALL(copyPropResetSort(mctx, oriProp, &amp;childProp, COD_TRUE));
    COD_CALL(objArrayAdd(childProps, childProp));
    COD_CALL(objArrayAdd(outProps, childProps));

    return COD_SUCCESS;
}


```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,补充下推场景描述,Posted by liaozengkang at 十一月 07, 2023 11:36|
|---|
|  [](null)  ,复制表路径,Posted by liaozengkang at 十一月 07, 2023 11:43|
|  [](null)  ,会议纪要：,会议时间： 2023-11-07  11:00 - 12:00,参与人员：谭思宇,  何阳，许秋莹，孔珂煜，吴煜，廖增康,结论：, 1. 先测试select, 集合操作dml等开发好新打个包再测试., 2. 补充下推场景描述., 3. 复制表路径.,Posted by liaozengkang at 一月 04, 2024 15:17|
