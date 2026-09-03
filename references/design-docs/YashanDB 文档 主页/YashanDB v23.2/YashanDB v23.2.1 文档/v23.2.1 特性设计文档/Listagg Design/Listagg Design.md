Created by 文博浩, last modified by  胡威振 on 一月 19, 2024

SR：    [YDBRD-21515](https://jira.yasdb.com/browse/YDBRD-21515?src=confmacro)    -  列存计算支持聚集函数LISTAGG  完成

##   [1. Overview（概述）](#1-overview概述)  

本文档设计实现LISTAGG函数将指定的列执行拼接操作，并通过分隔符分隔，返回一行VARCHAR/RAW类型的字符串。

##   [2. Features（功能特性）](#2-features功能特性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c188970c2af4f52091d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQkFBQUFBQUFBQlFBQUFBQUFBQUlBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwMzksImV4cCI6MTc4MjMwOTgzOX0.bNJGaJigtQdJGtl2SVmyYYiKyxByFaxKNh7MgO3Z_DQ)

- ALL | DISTINCT：可选的。
- measure_expr：可以是任何的表达式。假如是传入的值是null的时候可以被忽略。如果measure的类型是raw, 那么返回值也一定是raw类型， 其他情况下返回值类型都是varchar。
- delimiter：分隔符，是可选的，且默认是null。但是假如measure_expr的类型是raw，那么分隔符的类型也必须是raw 或者能转成raw类型的string。
- order_by_clause: 确定值的返回顺序。如果指定了order_by，就一定要指定winthin group，这两个条件必须同时指定或者根本不指定。
- query_partition_clause: 分区信息。根据分区内column去做拼接，每个分区的结果一致。


*listagg_overflow_clause*  ::=

![](https://pingcode.yasdb.com/atlas/files/public/67396c18a1ad9a3311dc878f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQkFBQUFBQUFBQlFBQUFBQUFBQUlBQUFBQUFBQVFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkwMzksImV4cCI6MTc4MjMwOTgzOX0.bNJGaJigtQdJGtl2SVmyYYiKyxByFaxKNh7MgO3Z_DQ)

list_overflow描述了当返回值超过返回的数据类型的最大长度的时候的函数的行为，

- on overflow error：使用这个子句的话，溢出会报错。
- on overflow truncate：使用这个子句的话，将会返回一个截断的返回值。
- truncation indicator：截断指示符，会在截断的最后的位置显示截断指示符，如果省略的会话，则截断指示符为省略号‘...’；如果mearsure_expr是raw类型的话，那么截断指示符也必须为raw或者string（能转成raw类型）类型。
- WITH COUNT：在截断指示符之后，数据库附加截断值的数量（截断了多少行column数据，不算空行），括在括号中。在这种情况下，数据库会截断足够的度量值，以便在返回值中留出最终分隔符、截断指示符的空间，并为括在括号中的数字值留出 24 个字节。所以带有with count的时候，需要预留 2（括号）+ 24 = 26个字节。
- WITHOUT COUNT：数据库从返回值中省略截断值的数量。在这种情况下，数据库会截断足够的度量值，以便在返回值中为最终分隔符和截断指示符留出空间。不需要留24个字节给count以及2个字节给括号。
- 未设置without跟with时，默认是带with count。


设置truncate后，对于溢出的总结：raw跟varchar通用

当终止符或分隔符长度超过8000或者（分隔符长度）+（终止符长度）+（withcount26个字节）超过8000, 直接报错（前面的括号表明存在这些表达式才进行计算）

完整的一行 * n行 + 分隔符的长度 <= 8000 正常输出。最后一行时不需要加上分隔符长度。

当发生 > 8000 的时候，就需要进行报错处理。报错有几种情况：是否有overflow的子句，如果没有直接报错，如果子句是error,也进行报错；

- 如果是without count，当终止符或分隔符长度超过 8000 或者终止符+分隔符长度超过 8000，终止符退化成‘...’显示（待确认）, 并且不显示分隔符；如果前面条件不成立，那么会显示可以显示的行数+分隔符+终止符（可显示的行数可能为0）
- 如果是with count或者缺省时，当终止符或分隔符长度超过 8000 - 2 - 24 = 7974 或者终止符+分隔符长度超过 7974 ，显示count，终止符退化成‘...’显示（待确认）, 并且不显示分隔符；如果前面条件不成立，那么会显示可以显示的行数+分隔符+终止符+count（可显示的行数可能为0）


由于字符串转raw类型是1字符=>2字符，length(raw)最大值为16000

参数：

LISTAGG( measure_expr [, delimiter] [truncation-indicator])

listagg有3个参数, 分隔符、终止符可以省略。

mearsure_expr：拼接的字符串表达式

- 忽视空值，整行跳过
- 常量表达式、变量表达式


|输入类型|输出类型|
|---|---|
|Raw|Raw|
|Boolean|不支持|
|其他类型|Varchar|


delimiter(可选)：拼接多个值时的分隔符

- 如果不指定，默认是NULL
- 只支持常量（measure为字符串类型时，则delimiter可以是数值常量表达式（12+1，会转成13后，最大值小于1e126, 再转成字符串）、字符串、stable表达式（sysdate等），为raw类型时，必须为十六进制常量字符串（不能是 ‘12+1‘））


|函数输出类型|delimiter输入类型|支持与否|
|---|---|---|
|Raw|Raw|支持|
||Char|支持|
||Varchar|支持|
||其他类型|不支持|
|Varchar|Boolean|不支持|
||Json|不支持|
||Clob|不支持|
||Blob|不支持|
||其他类型|支持|


终止符truncation-indicator(可选)：溢出时显示

- 只支持常量（数值或字符串）
- 当mearsure_expr为raw类型时，必须为十六进制常量字符串（不能是'12+1'）
- 当mearsure_expr非raw类型：可以是数值常量，数值常量表达式（12+1，会转成13后，最大值小于1e126, 再转成字符串），字符串，不能是stable表达式


|函数输出类型|truncation-indicator输入类型|支持与否|
|---|---|---|
|Raw|Raw|支持|
||Char|支持|
||Varchar|支持|
||其他类型|不支持|
|Varchar|Boolean|不支持|
||Json|不支持|
||Clob|不支持|
||Blob|不支持|
||其他类型|支持|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
impl ListAgg {
    /// Creates a `ListAgg` aggregate expression.
    #[inline]
    pub fn new&lt;E: Into&lt;Box&lt;dyn Expression&gt;&gt;&gt;(
        measure_expr: E,
        delimiter: Option&lt;Const&gt;,
        truncation_indicator: Option&lt;Const&gt;,
        distinct: bool,
        overflow: bool,
        with_count: bool,
    ) -&gt; Self {
        Self {
            measure_expr: [measure_expr.into()],
            delimiter,
            truncation_indicator,
            distinct,
            overflow,
            with_count,
        }
    }
}

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

以下与行存对齐。

- string默认最大输出长度8000， raw最大输出长度16000，超过则根据是否设置truncate处理
- 不支持配置参数设置 standard or extent 模式
- 对于raw类型，我们会完整输出，oracle是截断的。输出规则（计算溢出规则，溢出之后处理规则，参考第2节）跟varchar保持一致
- 不论实际拼接的expr是否有溢出， 当终止符或分隔符长度超过8000或者（分隔符长度）+ （终止符长度）+ （withcount26个字节）超过8000, 直接报错（前面的括号表明存在这些表达式才进行计算）
- 不支持bit跟bool类型、udt
- 分隔符可以是常量、静态表达式（cast as date以及sysdate等都属于）；终止符只能是常量（cast as date，sysdate等都不属于）（待确认绑定参数）
- float、double、number类型的拼接跟oracle会有出入，因为精度是一定的。
- 对于clob、blob、json，在转字符串时，如果长度超过32000，会直接报错，无论是否设置truncate
- 拼接行如果是 isNull，则该行会被省略
- 拼接溢出时，在计算count时，如果后续行有null值，则该行不会被算到count当中
- 如果拼接行时未溢出，但是拼接分隔符时溢出，则在溢出处理时，该行也不会显示，count计算会加上该行


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

- 结构体


```
#[derive(Debug, Clone, PartialEq)]
pub struct ListAgg {
    measure_expr: [Box&lt;dyn Expression&gt;; 1],
    delimiter: Option&lt;Const&gt;,
    truncation_indicator: Option&lt;Const&gt;,
    distinct: bool,
    overflow: bool,
    with_count: bool,
}

```

crab内实现与WmConcat类似的concat，为varchar和raw分别实现trait。

```
pub trait ListAggType: ColumnType {
    fn concat(&amp;self, input: &amp;&lt;Self as Type&gt;::Native, buffer: &amp;mut Vec&lt;u8, StdAlloc&gt;) -&gt; Result&lt;()&gt;;

    fn len(&amp;self, input: &amp;&lt;Self as Type&gt;::Native, alloc: &amp;Arc&lt;dyn Allocator&gt;) -&gt; Result&lt;usize&gt;;

    fn delimiter(&amp;self, delimiter: Option&lt;Const&gt;, alloc: &amp;Arc&lt;dyn Allocator&gt;) -&gt; Result&lt;Vec&lt;u8&gt;&gt;;

    fn indicator(&amp;self, indicator: Option&lt;Const&gt;, alloc: &amp;Arc&lt;dyn Allocator&gt;) -&gt; Result&lt;Vec&lt;u8&gt;&gt;;

    fn count(&amp;self, count: usize, buffer: &amp;mut Vec&lt;u8, StdAlloc&gt;, alloc: &amp;Arc&lt;dyn Allocator&gt;) -&gt; Result&lt;()&gt;;

    fn get_value(&amp;self, buffer: Vec&lt;u8, StdAlloc&gt;) -&gt; Result&lt;Option&lt;RawDatumBuf&gt;&gt;;

    fn create_column(&amp;self, alloc: &amp;Arc&lt;dyn Allocator&gt;, is_null: bool, buffer: &amp;[u8]) -&gt; Result&lt;ColumnRef&gt;;

    fn create_group_column(
        &amp;self,
        alloc: &amp;Arc&lt;dyn Allocator&gt;,
        results: &amp;mut Vec&lt;ListAggSimplifyAggregator&lt;Self&gt;, StdAlloc&gt;,
    ) -&gt; Result&lt;ColumnRef&gt;;

    fn create_column_with_group_num(
        &amp;mut self,
        alloc: &amp;Arc&lt;dyn Allocator&gt;,
        group_num: usize,
        results: &amp;mut Vec&lt;ListAggSimplifyAggregator&lt;Self&gt;, StdAlloc&gt;,
    ) -&gt; Result&lt;ColumnRef&gt;;

    fn append_grouping_values(
        &amp;mut self,
        group_num: usize,
        builder: &amp;mut dyn Builder,
        results: &amp;mut Vec&lt;ListAggSimplifyAggregator&lt;Self&gt;, StdAlloc&gt;,
    ) -&gt; Result&lt;()&gt;;
}

```

- 行存listagg_overflow_clause子句存在GroupConcatDecl里：


```
typedef struct StListaggOverFlowDecl {
    CodBool  isOverFlowError;          // if has 'on overflow error' ,or has 'on overflow truncate'
    CodBool  isWithCount;          // if use 'withCount'
    CodUint8 reserved[6];
    Expr*    trctIndicator;  // termination identifier
} ListaggOverFlowDecl;

typedef struct StGroupConcatDecl {
    VarExprList         concatList;
    List*               sortExprs;
    Expr*               separator;
    CodUint32           funcId;
    CodUint16           colId;
    CodBool             isDistinct;
    CodUint8            reserved;
    ListaggOverFlowDecl overFlowDecl;
} GroupConcatDecl;

```

在impl GroupConcat实现接口：

```
#[inline]
pub fn has_overflow(&amp;self) -&gt; bool {
    let group_concat = self.group_concat_expr().unwrap();
    group_concat.info.overFlowDecl.isOverFlowError
}

#[inline]
pub fn has_with_count(&amp;self) -&gt; bool {
    let group_concat = self.group_concat_expr().unwrap();
    group_concat.info.overFlowDecl.isWithCount
}

#[inline]
pub fn separator(&amp;self) -&gt; *const Expr {
    let group_concat = self.group_concat_expr().unwrap();
    group_concat.info.separator as *const Expr
}

#[inline]
pub fn indicator(&amp;self) -&gt; *const Expr {
    let group_concat = self.group_concat_expr().unwrap();
    group_concat.info.overFlowDecl.trctIndicator as *const Expr
}

```

- 表达式适配


```
#[inline]
pub fn transform_agg_function_expr&lt;Builder: LogicalPlanBuilder&gt;(
    expr_node: &amp;ExprNode,
    expr_ctx: &amp;mut ExprContext&lt;Builder&gt;,
) -&gt; Result&lt;Box&lt;dyn AggregateExpr&gt;&gt; {
    ...
    FuncId::GroupConcat =&gt; {
        ...
        match func_id {
            FuncId::WmConcat =&gt; {...}
            FuncId::ListAgg =&gt; create_list_agg_expr(
                func,
                |expr, delimiter, indicator, distinct, overflow, with_count| {
                    ListAgg::new(expr, delimiter, indicator, distinct, overflow, with_count).into()
                },
                expr_ctx,
            ),
        }
    }
}

#[inline]
fn transform_agg_function&lt;Builder: LogicalPlanBuilder&gt;(
    function: &amp;AnchorFunction,
    context: &amp;mut ExprContext&lt;'_, Builder&gt;,
) -&gt; Result&lt;Var&gt; {
    ...
    FuncId::GroupConcat =&gt; {
        match func.func_id() {
            FuncId::WmConcat =&gt; {...}
            FuncId::ListAgg =&gt; create_list_agg_expr(
                func,
                |expr, delimiter, indicator, distinct, overflow, with_count| {
                    ListAgg::new(expr, delimiter, indicator, distinct, overflow, with_count).into()
                },
                context,
            ),
        }
    }
}

```

实现与create_agg_concat_expr功能相似的create_list_agg_expr，入参不同：

```
fn create_list_agg_expr&lt;Builder: LogicalPlanBuilder&gt;(
    function: &amp;GroupConcat,
    f: fn(
        Box&lt;dyn Expression&gt;,
        Option&lt;Const&gt;,
        Option&lt;Const&gt;,
        bool,
        bool,
        bool,
    ) -&gt; Box&lt;dyn AggregateExpr&gt;,
    expr_ctx: &amp;mut ExprContext&lt;'_, Builder&gt;,
) -&gt; Result&lt;Box&lt;dyn AggregateExpr&gt;&gt; { ... }

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 聚集
- 窗口
- 省略参数组合
- 8000边界左右
- raw类型与其他类型


##   [7.性能测试](#7性能测试)  

##   [8.资料设计章节](#8资料设计章节)  

把“本函数仅支持作用于HEAP表。”删掉。

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## 10. Example

解读listagg(c2, '0' ON OVERFLOW TRUNCATE)：

c2是8000个a：aaaaa

返回值a0a0a0 a0...(4015)，length=7979

括号里的count值只计算c2中剩余的行数

公式：中间过程得到的串 + 3(默认...) + 26 与 8000 比较

  


## Attachments:

[listagg.out](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTdhMWFkOWEzMzExZGM4NzhkIiwicmVmX2lkIjoiNjczOTZjMTc3MjgyMDZlZmI5MmYwZDdlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDM4LCJleHAiOjE3ODIzODU0Mzh9.dgy0FPyyhf_nauIJaGkC1whjsy9chsIci74Oz6K1Tus)

 (application/octet-stream)    


[listagg.out](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTdhMWFkOWEzMzExZGM4NzhlIiwicmVmX2lkIjoiNjczOTZjMTc3MjgyMDZlZmI5MmYwZDdlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MDM4LCJleHAiOjE3ODIzODU0Mzh9.DH5dLuV_kr7WOoQCQvYNwWNRWBIOOcsRUsBTx3Z1KJQ)

 (application/octet-stream)    


## Comments:

|  [](null)  ,1. 调研终止符与分隔符长度超过8000时是报错还是用默认的'...'显示
1. 调研是否可以  绑定参数输入
1. 完善自测用例
,Posted by wenbohao at 十月 27, 2023 14:30|
|---|
|  [](null)  ,终止符+分隔符长度超过4000时用终止符默认的'...'显示，超过8000报错。,Posted by wenbohao at 十一月 07, 2023 15:17|
|  [](null)  ,退化操作要与行执行一致，最终输出的所有内容用'...'显示，而不是只把终止符替换成'...',Posted by huweizhen at 七月 04, 2024 14:34|
