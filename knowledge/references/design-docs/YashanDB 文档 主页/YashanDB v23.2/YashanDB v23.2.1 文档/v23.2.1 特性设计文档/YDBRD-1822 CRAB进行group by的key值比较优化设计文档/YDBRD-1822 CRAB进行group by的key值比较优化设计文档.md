Created by 文博浩, last modified on 十二月 13, 2023

##   [1. 总述](#1-总述)  

本设计方案为列存hash group by、sort group by、distinct根据优化器给出的已去重键值做优化，通过去重的键值不做hash和比较加快执行效率。

###   [1.1 需求来源](#11-需求来源)  

列存性能优化。

###   [1.2 调研文档](#12-调研文档)  

缩减规则：

- 当键值序列出现在谓词中，且键值符合等价类规则时，键值数量可缩减；
- 当键值序列出现常量，但不全是常量时，常量可消除；
- 当键值序列全部为常量时，保留一个常量；
- 当去重列包含主键列和唯一键索引时，主键列已要求插入的数据非重复，返回的结果不会有重复值，可进行优化。


##   [2. 接口](#2-接口)  

```
/// Creates an aggregate operator.
#[inline]
#[allow(clippy::too_many_arguments)]
pub fn aggregate(
    child: Box&lt;dyn Operator&gt;,
    group_sets: Vec&lt;Vec&lt;Box&lt;dyn Expression&gt;, StdAlloc&gt;, StdAlloc&gt;,
    valid_group_sets: Vec&lt;Vec&lt;bool, StdAlloc&gt;, StdAlloc&gt;,            // 新增
    aggr_exprs: Vec&lt;Box&lt;dyn AggregateExpr&gt;, StdAlloc&gt;,
    grouping_exprs: Vec&lt;Vec&lt;Box&lt;dyn Expression&gt;, StdAlloc&gt;, StdAlloc&gt;,
    group_id: bool,
    trace_output: Option&lt;Box&lt;dyn TraceOutput&gt;&gt;,
    material_quota: usize,
    row_count: usize,
) -&gt; Result&lt;Box&lt;dyn Operator&gt;&gt; {
    Aggregate::try_new(
        child,
        group_sets,
        valid_group_sets,                                            // 新增
        aggr_exprs,
        grouping_exprs,
        group_id,
        trace_output,
        material_quota,
        row_count,
    )
}

/// Creates an sorted aggregate operator.
#[inline]
#[allow(clippy::too_many_arguments)]
pub fn sorted_aggregate(
    child: Box&lt;dyn Operator&gt;,
    group_sets: Vec&lt;Rollup, StdAlloc&gt;,
    valid_group_sets: Vec&lt;bool, StdAlloc&gt;,                            // 新增
    aggregate_exprs: Vec&lt;Box&lt;dyn AggregateExpr&gt;, StdAlloc&gt;,
    grouping_exprs: Vec&lt;Vec&lt;Box&lt;dyn Expression&gt;, StdAlloc&gt;, StdAlloc&gt;,
    with_group_id: bool,
    operator_quota_id: usize,
    alloc: StdAlloc,
) -&gt; Result&lt;Box&lt;dyn Operator&gt;&gt; {
    let op = SortedAggregate::try_new(
        child,
        group_sets,
        valid_group_sets,                                             // 新增
        aggregate_exprs,
        grouping_exprs,
        with_group_id,
        alloc,
        operator_quota_id,
    )?;
    Ok(Box::new(op))
}

```

##   [3. 规格与约束](#3-规格与约束)  

与YDBRD-11464相同。

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

计划结构体增加了computeExprs、validCount表示去重键值，computeExprs为排序后的groupExprs。

```
typedef struct StGroupByExprs {
    ObjectArray* groupExprs; // for projection
    ObjectArray* computeExprs; // for group by and distinct's computation
    CodUint32    validCount;
    CodBool      isExpr;
    CodUint8     unused[3];
} GroupByExprs;

typedef struct StGroupByPlan {
    ObjectArray*  rsCols;
    AnlPlan*      child;
    ObjectArray*  aggrExprs;
    GroupingSets* groupingSets;
    List*         groupExprs;
    GrpctContext* grpctContext;
    Filter*       havingFilter;
    MatDecl*      matDecl;
    CodUint32     topN;
    ObjectArray*  computeExprs;
    AggrMode      mode;
    CodUint32     validCount;
    CodUint16     resId;
    CodBool       hasAggr;
    CodBool       isValueInline;
    CodBool       aggrPending;
    CodUint8      unused[3];
} GroupByPlan;

typedef struct StDistinctPlan {
    ObjectArray* columns;
    AnlPlan*     child;
    ObjectArray* rsCols;
    ObjectArray* computeExprs;
    List*        sortExprs;
    MatDecl*     matDecl;
    CodUint32    validCount;
    CodUint32    topN;
    CodUint16    resId;
    CodUint8     type;
    CodUint8     unused[5];
} DistinctPlan;

```

transform修改为从computeExprs取前validCount列，得到去重后的键值，生成与groupExprs映射的数组，表示每列是否需要计算，将数组传入crab。

```
pub struct HashGroup {
    plan: Plan,
}

impl HashGroup {
    #[inline]
    pub fn group_exprs(&amp;self) -&gt; Option&lt;List&lt;ResultSetColumn&gt;&gt; {
        unsafe {
            if self.plan.group_by().groupExprs.is_null() {
                None
            } else {
                Some(List::&lt;ResultSetColumn&gt;::from_raw_list(
                    self.plan.group_by().groupExprs,
                ))
            }
        }
    }

    #[inline]
    pub fn valid_group_exprs(&amp;self, group_exprs: &amp;Option&lt;List&lt;ResultSetColumn&gt;&gt;, std_alloc: &amp;StdAlloc) -&gt; Result&lt;Option&lt;Vec&lt;bool, StdAlloc&gt;&gt;&gt; {
        unsafe {
            match group_exprs {
                Some(group_exprs) =&gt; {
                    let valid_count = self.plan.group_by().validCount;
                    if self.plan.group_by().computeExprs.is_null() || valid_count == 0 {
                        Ok(None)
                    } else {
                        // 生成与groupExprs映射的数组
                        let mut valid_vec = Vec::try_with_capacity_in(group_exprs.len(), std_alloc.clone())?;
                        if valid_count == group_exprs.len() {
                            for _ in group_exprs.iter() {
                                valid_vec.try_push(true)?;
                            }
                        } else {
                            for _ in group_exprs.iter() {
                                valid_vec.try_push(false)?;
                            }
                            let compute_exprs: Array&lt;ResultSetColumn&gt; =
                                Array::new(self.plan.group_by().computeExprs);
                            for (id, compute_expr) in compute_exprs.iter().enumerate() {
                                if id &gt; valid_count {
                                    break;
                                }
                                for (group_id, group_expr) in group_exprs.iter().enumerate() {
                                    if compute_expr.as_ref() == group_expr.as_ref() {
                                        valid_vec[group_id] == true;
                                    }
                                }
                            }
                        }
                        Ok(Some(valid_vec))
                    }
                }
                None =&gt; Ok(None)
            }
        }
    }
}

#[repr(transparent)]
pub struct SortGroup {
    plan: Plan,
}

impl SortGroup {
    #[inline]
    pub fn group_exprs(&amp;self) -&gt; Option&lt;List&lt;ResultSetColumn&gt;&gt; {
        unsafe {
            if self.plan.group_by().groupExprs.is_null() {
                None
            } else {
                Some(List::&lt;ResultSetColumn&gt;::from_raw_list(
                    self.plan.group_by().groupExprs,
                ))
            }
        }
    }

    #[inline]
    pub fn valid_group_exprs(&amp;self, group_exprs: &amp;Option&lt;List&lt;ResultSetColumn&gt;&gt;, std_alloc: &amp;StdAlloc) -&gt; Result&lt;Option&lt;Vec&lt;bool, StdAlloc&gt;&gt;&gt; {
        ...
    }
}

#[repr(transparent)]
pub struct GroupByExprs {
    node: AnchorGroupByExprs,
}

impl GroupByExprs {
    #[inline]
    pub fn group_exprs(&amp;self) -&gt; Option&lt;&amp;Array&lt;Expr&gt;&gt; {
        if self.node.groupExprs.is_null() {
            None
        } else {
            let exprs: &amp;Array&lt;Expr&gt; = self.node.groupExprs.into();
            Some(exprs)
        }
    }

    #[inline]
    pub fn valid_group_exprs(&amp;self, group_exprs: &amp;Option&lt;List&lt;ResultSetColumn&gt;&gt;, std_alloc: &amp;StdAlloc) -&gt; Result&lt;Option&lt;Vec&lt;bool, StdAlloc&gt;&gt;&gt; {
        ...
    }
}

```

crab修改：将valid_group_sets一路传下去;

hash group:

impl<T: HashGroupTrait> Cursor for HashAggregateCursor<T> { next }

- execute_remain_data
    - execute_group_by_aggregate
        - execute_group_by_without_invalid
        - execute_group_by_with_invalid
            - compute_keys_hash
                - compute_keys_hash_without_invalid
                    - hash  // 根据valid_group_sets直接赋值0
            - get_or_insert_group
                - compare_key  // 根据valid_group_sets不进行比较，直接返回false


sort group:

impl Cursor for SortedAggregateCursor { next }

- create_column_set
    - execute_group_by_aggregate
        - execute_group_by_without_invalid
        - execute_group_by_with_invalid
            - get_or_insert_group
                - compare_group  // 根据valid_group_sets不进行比较，直接返回false


distinct:

compare_distinction

- compare_column_value  // 根据valid_group_sets不进行比较，直接返回false
- compare_builder_value  // 根据valid_group_sets不进行比较，直接返回false


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

单机、分布式下，

根据缩减规则

- 等价类键值；
- 包含常量键值；
- 全部常量键值；
- 包含主键列和唯一键索引（lsc）；


对比hash group、sort group、distinct结果是否正确、优化前后性能是否有提升。

##   [6.资料设计章节](#6资料设计章节)  

不涉及。

##   [7.未来规划](#7未来规划)  

## Comments:

|  [](null)  ,1.  优化器已经去重的列，对执行并不感知，优化器对不需要比较的列区分出来，对执行才感知。
1. 考虑无冲突hash该怎么处理？
1. 讲数组传入crab。—错别字
1. 需要描述计算hash和比较的逻辑是怎么跳过这里列的hash 计算和比较的。
,Posted by huangjingdong at 十二月 11, 2023 16:18|
|---|
|  [](null)  ,会议纪要,与会人：黄靖东、林博、施新华、文博浩    
  评审时间：2023.12.13 10:00    
  评审地点：708、线上会议    
  评审纪要信息：,- 在适配中把需要比较和不需要比较的列排序分开，不需要比较的列不参与hash值计算。增加compute count，使用时取数组切片
- 判断优化后的列是否可用无冲突hash
- 受影响的distinct：sort distinct、hash distinct、带limit(TopN) distinct
- 计划是否可以观测优化后的列，如果没有需要加在autotrace
,评审通过与否：是,Posted by wenbohao at 十二月 13, 2023 10:34|
|  [](null)  ,第4点：  计划会直接打印优化后的列,Posted by wenbohao at 十二月 13, 2023 10:49|
