Created by 林俊喆, last modified on 六月 27, 2024

#   [分布式列存支持通过DBLINK访问ORACLE](#分布式列存支持通过dblink访问oracle)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

嘉实基金需求，需要支持分布式下多源异构数据库的联邦查询，当前需求的主要目标是分布式YashanDB访问ORACLE。

###   [1.2 调研文档](#12-调研文档)  

当前YashanDB已经通过DBLINK实现了database粒度的外部数据访问，当前YashanDB的DBLINK支持范围为单机行存，外部数据源支持YashanDB以及ORACLE。具体设计可参考以下文档：

  [Yashan Database Link概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135618805)  

  [Yashan Database Link实现](https://conf.yasdb.com/pages/viewpage.action?pageId=150626779)  

###   [1.3 需求分析](#13-需求分析)  

当前YashanDB已经实现通过Database Link形式对ORACLE的访问，但支持范围为单机行存，当前分布式AP场景主要使用列式计算，需要扩展当前Database Link的使用范围。

1. 适配分布式下的DBLINK元数据对象管理能力。
1. 确认通过DBLINK的表扫描的分布属性（一阶段实现是先当作CN本地表，工作量小），insert/update/delete带子查询包含dblink table时的处理。
1. DBLINK数据源为oracle时数据当前是转换成行表达式，需要增加对列存的支持。
1. DBLINK能力增强，当前投影列没有下推到对端数据库，需要将投影列下推。


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|
|---|---|---|
|DBLINK|实现在不同的数据库之间进行数据共享和交互，将一个数据库中的数据作为另一个数据库的表来使用，也可以在不同的数据库之间进行数据传输和共享。目前异构数据库仅支持ORACLE|参考Oracle的DB Link功能|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

增加内部SQL命令TRANSPORT DBLINK，用于数据库元数据迁移任务。

##   [3. 规格与约束](#3-规格与约束)  

1. 当前仅支持基础数据类型，不支持lob。
1. 当前不支持一个查询内多个节点同时使用DBLINK访问ORACLE。
1. DBLINK框架不支持多个线程共享一个连接，分布式下当前会话有未提交的DBLINK事务，则再进行包含DBLINK表的查询（包括dml子查询中包含DBLINK表），当前报错不支持，需要提交或回滚当前会话无DBLINK事务后可执行。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

####   [4.1.1 分布式适配DBLINK的DDL](#411-分布式适配dblink的ddl)  

当前分布式下禁止了DBLINK的创建、删除、修改。

适配在分布式下创建、删除、修改DBLINK的能力，同分布式下其他DDL，所有节点都会保存DBLINK的元数据。参考    [分布式DDL](https://conf.yasdb.com/pages/viewpage.action?pageId=141564288)    ，适配CREATE DBLINK、DROP DBLINK、ALTER DBLINK。

适配扩缩容场景下的元数据迁移，保证扩缩容后DBLINK对象元数据的一致性。参考    [元数据迁移](https://conf.yasdb.com/pages/viewpage.action?pageId=109603333)    ，增加DBLINK元数据导出命令TRANSPORT DBLINK。

####   [4.1.2 分布式下通过DBLINK查询的计划生成](#412-分布式下通过dblink查询的计划生成)  

当前DBLINK连接ORACLE如果多个节点并发，无法保证在一个事务内，所以当前选择只在一个节点使用DBLINK访问ORACLE。当前选择CN和选择DN区别不大，故当前先实现分布式下DBLINK连接作为CN本地表。修改    `makeCoordDstbDesc`    函数，增加DBLINK TABLE的判断。

当前DBLINK TABLE增加了ROW_TABLE标记，当作ROW_TABLE。由于当前版本不支持行列混合，将DBLINK TABLE在包含列表时当作列表，走列执行；否则则走行执行。

对于分布式下DML带子查询包含DBLINK TABLE，insert/delete/update算子使用行执行器（同当前分布式下delete/update带子查询），子查询使用列执行器，添加col2row算子。

####   [4.1.3 DBLINK对接列存，实现dblink_table_scan算子](#413-dblink对接列存实现dblink-table-scan算子)  

DBLINK的表当前没有独立dc，协议实现在执行层单独实现，不走存储层。当前crab的ColScan对接存储的AnkCursor，无法直接对接DBLINK框架。

设计新增    `dblink scan operator`    和    `dblink scan cursor`    ，用于对接DBLINK框架，承载DBLINK SCAN。

```
#[derive(Debug)]
pub struct DblinkScan {
    table: Box&lt;PlanTable&gt;
    table_id: u64,
    runtime_filter_info: Option&lt;Vec&lt;TransformedRuntimeFilter, StdAlloc&gt;&gt;,
    projection: Vec&lt;u16, StdAlloc&gt;,
    project_schema: Arc&lt;Schema&gt;,
    schema: Arc&lt;Schema&gt;,
    access_columns: u16,
    trace_output: Option&lt;Box&lt;dyn TraceOutput&gt;&gt;,
    px_sender_info: Option&lt;PxSenderInfo&gt;,
}

impl Operator for DblinkScan {
    ...
}

sturct DblinkScanCursor {
    table: Box&lt;YlnTable&gt;,
    cursor: Box&lt;YlnCursor&gt;,
    last_col_set: Option&lt;(ColumnSet, bool)&gt;,
    context: Arc&lt;dyn Context&gt;,
    task_id: u32,
    result_schema: Arc&lt;Schema&gt;,
    px_sender_info: Option&lt;PxSenderInfo&gt;,
    runtime_filter_info: Option&lt;Vec&lt;TransformedRuntimeFilter, StdAlloc&gt;&gt;,
    runtime_filter: Vec&lt;Box&lt;dyn BoundRuntimeFilter&gt;, StdAlloc&gt;,
    expected_global_runtime_filter_info: Option&lt;Vec&lt;TransformedRuntimeFilter, StdAlloc&gt;&gt;,
    std_alloc: StdAlloc,
    runtime_filter_sample_rows: usize,
    disable_runtime_filter_ration: f64,
    // The px context can not release when table scan have global runtime filter.
    _px_context_guard: Option&lt;PxContextGuard&gt;,
}

impl Cursor for DblinkScanCursor {
    ...
}

trait DblinkCursorFetcher {
    fn dblink_fetch（&amp;mut self, cursor: Box&lt;YlnCursor&gt;) -&gt; Result&lt;(Option&lt;ColumnSet&gt;, bool)&gt;;
}

impl DblinkCursorFetcher for ColumnSetFetcherImpl {
    ...
}

```

当前DBLINK框架从远端数据库读取的数据是以DBLINK协议定义的格式保存，需要转换成dataset格式才能被crab使用。以下函数用于DBLINK拉取数据转换成dataset格式。

```
// 初始化ylnCursor，分配dataset
CodResult execOpenColYlnCursor(AnlStmt* stmt, PlanTable* table, YlnCursor** cursor);

CodVoid execCloseColYlnCursor(AnlStmt* stmt, YlnCursor* cursor);

// 从ylnCursor的ylnDataset解码成dataset, ylnDataset的数据足够填充dataset，则填充完返回；ylnDataset的数据不足以填充dataset，调用ylnRemoteFetch拉取数据，填充dataset，直到eof或者dataset填充满
static CodResult execYlnAddRowToDataSet(YlnCursor* cursor， CodBool* isEof);

CodResult fetchYlnDataSet(YlnCursor* cursor， CodBool* isEof);

// datasetSlice的attach函数数组，用于将column data拷贝到datasetSlice
ColumnDataAttach gDataAttachs[__DTYPE_COUNT__]；

```

####   [4.1.4 DBLINK投影表达式下推](#414-dblink投影表达式下推)  

1. 当前DBLINK沙箱进程拼接发给oracle的sql投影列为*，需要在协议中增加投影列列名，拼接到sql上。


```
// 当前为SELECT * FROM后拼接table name 和 filter，需要增加投影列列名，并拼接
static CodResult exsExecQuery(ExsSession* session, ExsDblinkCursor* cursor);

```

1. DBLINK TABLE verify时没有生成需要扫描的列（当前用    `colBitmap`    字段记录），需要在verify补上生成，在执行时可以根据此字段获取需要扫描的列。（由于优化后可能调整需要扫描的列，当前此字段可能并不准确，可以考虑优化后再生成，本需求优先实现在verify时生成    `colBitmap`    ）


```
// 增加初始化colBitmap
CodResult verifyDblinkTable(AnlVerifier* vrfr, QueryTable* table, CodBool dscrNeeded);

// 增加生成colBitmap setTableRefColumn
CodResult verifyColumnInDblinkTable(AnlVerifier* vrfr, QueryTable* table, const CodText* name, VarColumn* column, CodBool* isFound);

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|序号|场景|预期|备注|
|---|---|---|---|
|1|分布式下连接CN、DN、MN创建DBLINK|||
|2|分布式下连接CN、DN、MN删除DBLINK|||
|3|分布式下连接CN、DN、MN变更DBLINK|||
|4|分布式下to oracle，DML 情况下使用DBLINK|||
|5|分布式下yashandb的列存表跟oracle的表做联邦查询||定长类型、非定长类型覆盖|
|6|分布式下yashandb的行存表跟oracle的表做联邦查询||分布式行表|
|7|CN扩容，连接扩容节点通过DBLINK做查询|||
|8|insert/delete/update/select基本语法|||
|9|insert into select，插入的表是dblink table||单机/分布式，列表|
|10|insert into select，子查询中有dblink table||单机/分布式，列表|
|11|delete/update修改的表是dblink table|||
|12|delete/update子查询的表是dblink table|||
|13|CTE和子查询中包含DBLINK TABLE||CTE和子查询多次调用|
|14|分布式下，当前会话有未提交的DBLINK事务，再做DBLINK查询|||


测试场景参考：    [测试场景](https://conf.yasdb.com/pages/viewpage.action?pageId=156128547)     4.1节，以当前单机用例改造为主

##   [6.资料设计章节](#6资料设计章节)  

无，无对外接口，无需补充资料。

##   [7.未来规划](#7未来规划)  

1. 分布式下DBLINK支持LOB等数据类型
1. 分布式下支持一个查询内多个节点同时使用DBLINK访问ORACLE。
