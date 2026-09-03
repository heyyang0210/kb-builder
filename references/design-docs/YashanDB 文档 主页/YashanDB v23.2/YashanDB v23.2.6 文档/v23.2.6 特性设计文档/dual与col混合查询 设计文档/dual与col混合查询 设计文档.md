Created by 胡威振, last modified on 九月 11, 2024

详细设计-YDBRD-30817 : 支持dual和列表混合查询,并且走列执行引擎 Design（支持dual和列表混合查询,并且走列执行引擎方案设计）

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66a0b2254283cf23d4f25a87](https://pingcode.yasdb.com/ship/ideas/66a0b2254283cf23d4f25a87)    ?

SR链接：    [https://pingcode.yasdb.com/pjm/items/66a3503966228b9470779d39](https://pingcode.yasdb.com/pjm/items/66a3503966228b9470779d39)    ?

##   [1. 总述](#1-总述)  

该文档设计了支持dual和列表混合查询，并且走列执行引擎。

###   [1.1 需求来源](#11-需求来源)  

需求来源于智慧工会。支持单机和分布式。

主要是解决智慧工会下面的应用场景：

![](https://pingcode.yasdb.com/atlas/files/public/67396dfe8970c2af4f521637/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFDQUVBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM0NDUsImV4cCI6MTc4MjMyNDI0NX0.avp1GamEolU6DchDZluVlq6Z_QGYzlvpPNHtiRY_9ik)

###   [1.2 调研文档](#12-调研文档)  

**概述**   友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

###   [1.3 需求分析](#13-需求分析)  

- dual表与col表组合查询时计划走列执行。


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

- 支持hash join。
- 不支持bloom_filter，开了布隆过滤器之后不会生效。
- 支持merge join。
- 支持nest loop。
- 支持聚合函数。
- 支持子查询，关联与非关联都支持。
- 支持集合操作。
- 支持与窗口函数相结合。
- 支持排序、limit。
- 不能在dual上建索引，但是可以与有索引的表结合进行查询。
- 不支持并行，开了并行之后并不会生效。
- not in、 anti 都支持。


##   [4. 特性](#4-特性)  

###   [1. 计划上放开dual与col表的混合查询](#1-计划上放开dual与col表的混合查询)  

- 增加新的标志CTX_FLAG_DUAL_TABLE，表示查询SQL语句中有系统表，并且只含有DUAL这个系统表。
-   `anlPreColExecute`    中会判断    `HAS_FIXED_TABLE(ANL_PARSETREE)`    ，将这个条件改为    `HAS_FIXED_TABLE(ANL_PARSETREE) && !HAS_DUAL_TABLE_ONLY(ANL_PARSETREE)`    。


```
CodResult anlPreColExecute(AnlStmt* stmt)
{
    if (stmt->planContext->actualExecEngine == ENGINE_ROW || HAS_DSTB_GATHER_VIEW(ANL_PARSETREE) ||
        HAS_FIXED_TABLE(ANL_PARSETREE)) {
        return COD_SUCCESS;
    }
    PreColExecute preColExecute = ANL_ATTR->callbackSet.preColExecute;
    if (preColExecute == NULL) {
        COD_SET_ERROR(ERR_ANS_MODE_IS_NOT_SUPPORTED);
        return COD_ERROR;
    }
    return preColExecute(stmt);
}
```

-   `hasPreNotImplFeat`    中会判断    `HAS_SYS_TABLE(ctx->parseTree)`    ，将这个条件改为    `HAS_SYS_TABLE(ctx->parseTree) && !HAS_DUAL_TABLE_ONLY(ctx->parseTree)`    。


```
static inline CodBool hasPreNotImplFeat(AnlContext* ctx, QueryContext* queryCtx)
{
    if (HAS_COL_TABLE(ctx->parseTree) && (HAS_ROW_TABLE(ctx->parseTree) || HAS_SYS_TABLE(ctx->parseTree))) {
        COD_IMPL_ERROR("hybrid of columnar table and heap table");
        return COD_ERROR;
    }
    COD_CALL(hasNotSupportedFeature(HAS_COL_TABLE(ctx->parseTree), queryCtx));
    return COD_SUCCESS;
}
```

-   `isForcedRow`    中会判断是否含有系统表    `tabIncls->acTabIncls.hasSysTable`    ，需要加一个限制:     `!HAS_DUAL_TABLE_ONLY(ctx->parseTree)`    。


```
static inline CodBool isForcedRow(TabIncls* tabIncls)
{
    return tabIncls->acTabIncls.hasGlobalTempTab || tabIncls->acTabIncls.hasTabFunc || tabIncls->acTabIncls.hasDynView ||
           tabIncls->acTabIncls.hasTrigger || tabIncls->acTabIncls.hasStoredProcedure || tabIncls->acTabIncls.hasColNotImplFeat ||
           tabIncls->hasExternalTab || (!tabIncls->acTabIncls.hasColTab && tabIncls->acTabIncls.accessLob) ||
           tabIncls->acTabIncls.hasSysTable || tabIncls->hasPrivateTempTab || tabIncls->hasRecCte;
}
```

-   `setRealExecEngine`    中会判断是否含有heap表    `tabIncls->acTabIncls.hasHeapTab`    ，需要加一个限制:     `!HAS_DUAL_TABLE_ONLY(ctx->parseTree)`    。


```
static CodResult setRealExecEngine(CboOptimizer* cboOpt, QueryDesc* queryDesc, CodBool isDualTabOnly)
{
    TabIncls*   tabIncls = &cboOpt->tabIncls;
    SelectDesc* selectDesc = queryDesc->select;
    CodBool     isDstb = anlIsDstbDeployMode(cboOpt->stmt);

    if (cboOpt->stmt->context->type != SQL_CREATE_TABLE) {
        // 如果只含有dual，需要放开。
        if (tabIncls->acTabIncls.hasColTab && tabIncls->acTabIncls.hasHeapTab && !isDualTabOnly) {
            COD_IMPL_ERROR("hybrid of columnar table and heap table");
            return COD_ERROR;
        }
        if (tabIncls->acTabIncls.hasColTab && tabIncls->acTabIncls.accessLob && tabIncls->acTabIncls.hasHeapTab) {
            COD_IMPL_ERROR("hybrid of columnar table and heap table with lob column");
            return COD_ERROR;
        }
    }
    if ((tabIncls->acTabIncls.hasColTab || isDstb) && tabIncls->hasRecCte) {
        COD_IMPL_ERROR("Recursive cte in columnstored table or distribute database");
        return COD_ERROR;
    }
    if ((tabIncls->acTabIncls.hasLscTab || tabIncls->acTabIncls.hasAc) && tabIncls->acTabIncls.hasGlobalTempTab) {
        COD_IMPL_ERROR("hybrid of LSC/AC table and global temporal table");
        return COD_ERROR;
    }
    if ((tabIncls->acTabIncls.hasLscTab || tabIncls->acTabIncls.hasAc) && tabIncls->acTabIncls.hasTabFunc) {
        COD_IMPL_ERROR("hybrid of LSC/AC table and table function");
        return COD_ERROR;
    }
    if ((tabIncls->acTabIncls.hasLscTab || tabIncls->acTabIncls.hasAc) && tabIncls->acTabIncls.hasDynView) {
        COD_IMPL_ERROR("hybrid of LSC/AC table and dynamic view");
        return COD_ERROR;
    }
    if ((tabIncls->acTabIncls.hasLscTab || tabIncls->acTabIncls.hasAc) && tabIncls->acTabIncls.hasColNotImplFeat) {
        COD_IMPL_ERROR("hybrid of LSC/AC table and unsupported features of column stored");
        return COD_ERROR;
    }
    if ((tabIncls->acTabIncls.hasLscTab || tabIncls->acTabIncls.hasAc) && tabIncls->acTabIncls.hasTrigger) {
        COD_IMPL_ERROR("hybrid of LSC/AC table and trigger");
        return COD_ERROR;
    }
    if ((tabIncls->acTabIncls.hasLscTab || tabIncls->acTabIncls.hasAc) && tabIncls->acTabIncls.hasStoredProcedure) {
        COD_IMPL_ERROR("hybrid of LSC/AC table and stored procedure");
        return COD_ERROR;
    }

    if (cboOpt->isDml && !isDstb &&
        cboOpt->stmt->context->type != SQL_INSERT &&
        cboOpt->stmt->context->type != SQL_CREATE_TABLE) {
        cboOpt->optCfg.execEngine = ENGINE_ROW;
        return COD_SUCCESS;
    }

    if (cboOpt->isDml && !isDstb && cboOpt->stmt->context->type == SQL_INSERT &&
        cboOpt->tabIncls.acTabIncls.accessLob) {
        cboOpt->optCfg.execEngine = ENGINE_ROW;
        return COD_SUCCESS;
    }

    // distributed only dblink table use column engine
    // 判断是否有dblink的时候需要排除掉只含有dual的情况。
    if (isDstb && cboOpt->tabIncls.hasLinkTab && !(cboOpt->tabIncls.acTabIncls.hasSystemTable && !isDualTabOnly)) {
        cboOpt->optCfg.execEngine = ENGINE_COL;
        return COD_SUCCESS;
    }

    // standalone dblink table dml use row engine
    if (cboOpt->isDml && !isDstb && cboOpt->tabIncls.hasLinkTab) {
        cboOpt->optCfg.execEngine = ENGINE_ROW;
        return COD_SUCCESS;
    }

    // create table as select
    if (cboOpt->stmt->context->type == SQL_CREATE_TABLE) {
        TableDef* def = (TableDef*)cboOpt->stmt->context->entry;
        if (!isDstb && (!IS_COL_TABLE(def->relType) || cboOpt->tabIncls.acTabIncls.accessLob)) {
            cboOpt->optCfg.execEngine = ENGINE_ROW;
            return COD_SUCCESS;
        }
    }

    if (isForcedRow(tabIncls, isDualTabOnly) || selectDesc->soForUpdate) {
        cboOpt->optCfg.execEngine = ENGINE_ROW;
        return COD_SUCCESS;
    }
    if (isForcedCol(tabIncls) || (tabIncls->acTabIncls.hasColTab && cboOpt->optCfg.execEngine == ENGINE_DEFAULT)) {
        cboOpt->optCfg.execEngine = ENGINE_COL;
        return COD_SUCCESS;
    }
    if (cboOpt->optCfg.execEngine == ENGINE_DEFAULT) {
        cboOpt->optCfg.execEngine = ENGINE_ROW;
    }

    return COD_SUCCESS;
}
```

-   `verifyKernelTableType`    是设置ANL_PARSETREE->tableFlags标志的接口，需要根据条件设置    `CTX_FLAG_DUAL_TABLE`    标志。


```
CodVoid setDualFlag(AnlStmt* stmt, CodBool isDualTable)
{
    if (!isDualTable) {
        ANL_PARSETREE->tableFlags &= ~CTX_FLAG_DUAL_TABLE;
    }
}

CodVoid verifyKernelTableType(AnlStmt* stmt, KernelTableRef* ref)
{
    CodBool isSysTable = ankIsSysTab(ref->dc);
    CodBool isDualTable = isDualTab(ref);

    // 先判断是否有DUAL表，如果有，就加上这个标志。
    if (isDualTable) {
        ANL_PARSETREE->tableFlags |= CTX_FLAG_DUAL_TABLE;
    }

    if (isSysTable) {
        // 如果这个sys表不是dual表，需要将CTX_FLAG_DUAL_TABLE标志位置为false。
        setDualFlag(stmt, isDualTable);
        ANL_PARSETREE->tableFlags |= CTX_FLAG_SYS;
    }
    if (ref->type == USER_VIEW || ref->type == FIXED_VIEW) {
        setDualFlag(stmt, isDualTable);
        ANL_PARSETREE->tableFlags |= CTX_FLAG_VIEW;
    } else if (ref->type == NORMAL_TABLE || ref->type == PART_TABLE || ref->type == MATERIALIZED_VIEW) {
        ANL_PARSETREE->tableFlags |= CTX_FLAG_ROW;
    } else if (ref->type == DYNAMIC_VIEW) {
        setDualFlag(stmt, isDualTable);
        ANL_PARSETREE->tableFlags |= CTX_FLAG_SYS;
    } else if (ref->type == FIXED_TABLE) {
        setDualFlag(stmt, isDualTable);
        ANL_PARSETREE->tableFlags |= CTX_FLAG_SYS;
        ANL_PARSETREE->tableFlags |= CTX_FLAG_FIXED_TABLE;
    } else {
        if (ankIsGtt(ref->dc) || ankIsPtt(ref->dc)) {
            stmt->context->parseTree->tableFlags |= CTX_FLAG_ROW;
        } else {
            stmt->context->parseTree->tableFlags |= CTX_FLAG_COL;
        }
    }
}
```

###   [2. 列执行增加DualOperator进行单独计算](#2-列执行增加dualoperator进行单独计算)  

- 增加DualOperator算子，存放dual的schema，dual的字段    `dummy`    是varchar类型，try_new时创建一个varchar类型的filed，并作为schema的field，需要同时支持UTF8和GB18030。
- name与ColScan的name相同，都为ColScan。
- 支持rescan，need_rescan返回true。


```
pub struct DualOperator {
    schema: Arc&lt;Schema&gt;,
}

```

- 增加DualCursor的Cursor。


```
struct DualCursor {
    schema: Arc&lt;Schema&gt;,
    output_ty: DataType,
    ctx: Arc&lt;dyn Context&gt;,
    is_finish: bool,
}


```

- name与ColScanCursor相同，都为Table Scan。
- next时根据输出类型是utf8还是gb18030构造一行一列数据为‘X’的ColumnSet。
- transform：


```
fn transform_table_scan_plan<Builder: LogicalPlanBuilder>(
    table_scan: &AnchorTableScan,
    table_dict: Arc<TableDict>,
    context: &mut PlanContext<Builder>,
    stmt: &Statement,
    partitions: CodVec<u64>,
    scan_mode: ScanMode,
    part_info: Option<PartInfo>,
    tracer: Option<Box<dyn TraceOutput>>,
) -> Result<Box<dyn Operator>> {
    let std_alloc = context.std_alloc();

    let mut expr_ctx = transform_table_scan_params(table_scan, context, stmt)?;

    let (rowid_pos, project_exprs) =
        transform_table_scan_project_list(table_scan, &std_alloc, &mut expr_ctx)?;

    // dblink filter push down to remote
    let filter_expr = if table_dict.is_dblink() {
        None
    } else {
        table_scan.filter()
    };
    let filter_expr = match filter_expr {
        Some(expr) => Some(expr.transform_expr(&mut expr_ctx)?),
        None => None,
    };
    if table_scan.is_dual_scan() {
        let dual_scan = Box::try_new(DualOperator::try_new(
            stmt.handler()?.charset(),
            context.std_alloc(),
        )?)? as Box<dyn Operator>;
        let filter_op = match filter_expr {
            None => dual_scan,
            Some(expr) => filter(dual_scan, expr.into(), tracer)?,
        };

        let schema = filter_op.schema();
        let ret = check_project(&project_exprs, schema);
        return if ret {
            Ok(projection(filter_op, project_exprs)?)
        } else {
            Ok(filter_op)
        };
    }

    transform_table_scan_inner(
        table_scan,
        table_dict,
        &mut expr_ctx,
        partitions,
        scan_mode,
        part_info,
        tracer,
        std_alloc,
        project_exprs,
        filter_expr,
        rowid_pos,
        stmt,
    )
}
```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. dual与col表简单join。
1. 非dual的其他系统表与col表的简单join。
1. heap表与col表的简单join。
1. dual查询出现在子查询中。
1. dual查询的project有子查询。
1. dual和列表参与join。
1. dual查询后做hash group、排序、limit等。
1. 并行、runtime filter。
1. 单机和分布式场景。


##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

## Comments:

|  [](null)  ,聚集函数，窗口函数要看是否支持。,Posted by huangjingdong at 九月 05, 2024 09:38|
|---|
|  [](null)  ,runtime filter  anti NA （not 特别关注）,Posted by huangjingdong at 九月 05, 2024 09:39|
|  [](null)  ,关注dual评估值是否准确（计划中的评估记录数）,Posted by huweizhen at 九月 05, 2024 10:14|
|  [](null)  ,与dblink的配合,Posted by huweizhen at 九月 05, 2024 10:22|
|  [](null)  ,评估准确,![](https://pingcode.yasdb.com/atlas/files/public/67396dfe8970c2af4f521638/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFDQUVBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM0NDUsImV4cCI6MTc4MjMyNDI0NX0.avp1GamEolU6DchDZluVlq6Z_QGYzlvpPNHtiRY_9ik),Posted by huweizhen at 九月 10, 2024 17:18|
|  [](null)  ,考虑是否放开支持并行，主要是join场景，分发策略是否正确。,Posted by huweizhen at 九月 11, 2024 10:36|
|  [](null)  ,补充测试点：dual作为子查询的一部分。,Posted by huweizhen at 九月 11, 2024 10:50|
|  [](null)  ,放开风险很大，dual相当于复制表，目前有很多问题，该特性不放开支持并行。,Posted by huweizhen at 九月 11, 2024 11:01|
