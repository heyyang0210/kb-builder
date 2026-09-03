Created by 李坤宇, last modified on 八月 03, 2023

#   [YDBRD-13653 : AC分布式计划设计方案](#ydbrd-13653--ac分布式计划设计方案)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-13653](https://jira.yasdb.com/browse/YDBRD-13653)  

##   [1. Overview（概述）](#1-overview概述)  

本方案是为了支持AC在分布式部署形式下使用。

##   [2. Features（功能特性）](#2-features功能特性)  

优化器支持生成分布式AC计划后，能够在分布式部署下生成使用AC的执行计划，支持所有单机已支持的AC相关能力（例如并行）。

##   [3. Interfaces（接口）](#3-interfaces接口)  

在分布式下，创建AC后，支持两种使用AC的形式：

1. 普通查询改写为使用AC的查询
1. 直接查询AC


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 对于AC相关功能，分布式与单机保持一致。即支持单机场景下能支持使用ac的所有场景。
1. 对于分布式下的限制，与表扫保持一致。例如关联子查询不能在dn上执行等限制。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

基于AC并行的derive，进一步支持derive分布式信息。

```
static CodResult deriveAcDstbDesc(CboOptimizer* cboOpt, CboOperator* op, DstbDesc* dstbDesc)
{
    CodBool    isPart = isPartScanOp(op);
    TableDict* dc = isPart ? PHYS_PART_AC_SCAN(op)-&gt;table-&gt;tableAcInfo.originTabDc
                           : PHYS_AC_SCAN(op)-&gt;table-&gt;tableAcInfo.originTabDc;
    TableDesc* desc = ankGetTableDesc(dc);
    CodUint32  groupCount;
    COD_CALL(cboGetGroupList(cboOpt, COD_GROUP_TYPE_DN, &amp;groupCount, &amp;dstbDesc-&gt;groupDesc));
    dstbDesc-&gt;groupCount = (CodUint16)groupCount;
    dstbDesc-&gt;dstbStatus = DSTB_RANDOM;
    dstbDesc-&gt;dataspaceId = desc-&gt;dsId;
    if ((CodBool)desc-&gt;isDuplicated) {
        dstbDesc-&gt;dstbStatus = DSTB_REPLICATED;
        dstbDesc-&gt;dataspaceId = 0;
    }
    return COD_SUCCESS;
}

```

可以看到AC的分布式信息确定为：

1. 当AC建在分布表时，为random；
1. 当AC建在复制表时，为replicated；


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

自测关注点：

1. 分区表类型：分布表、复制表。
1. 直接查询AC、查询改写AC。
1. 用例结果正确性。
1. 查询中出现子查询，关联子查询、非关联子查询。


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

当前分布式下没有考虑利用AC基表的分布键信息进行重分布等操作，当AC中包含分布键时，存在优化空间。