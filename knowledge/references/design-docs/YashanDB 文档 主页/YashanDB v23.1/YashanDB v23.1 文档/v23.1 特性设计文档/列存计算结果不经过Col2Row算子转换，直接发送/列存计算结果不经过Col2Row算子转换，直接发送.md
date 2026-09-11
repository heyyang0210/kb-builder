Created by 林博, last modified on 八月 23, 2023

#   [YDBRD-17690 : Delete Col2Row Design](#ydbrd-17690--delete-col2row-design)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-17690](https://jira.yasdb.com/browse/YDBRD-17690)  

##   [1. Overview（概述）](#1-overview概述)  

该需求来源于某POC的性能优化。

目前列存计算结果在发送到客户端之前，会经过Col2Row算子将列存结构体转换为行存结构体，再进行发送。该SR目标是去掉Col2Row的转换，直接根据列存结构体进行发送；

##   [2. Features（功能特性）](#2-features功能特性)  

去掉Col2Row算子将列存结构体转换为行存结构体的过程，直接根据列存结构体进行发送；

##   [3. Interfaces（接口）](#3-interfaces接口)  

数据发送的具体实现用户不感知。但是explain plan会发生变化，要去掉上面的Col2Row算子；

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

对于行列执行结果不一致的函数，之前可能走行存常量优化，现在走到列存之后，结果会不同，需要刷预期；例如：

- to_date


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b2ca1ad9a3311dc80cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE1MDEsImV4cCI6MTc4MjMwMjMwMX0.amGJ62QVMW12wmKf4Ug358IsxWYnlDRRbTEzGTtJAcI)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 执行流程](#521-执行流程)  

select对应的执行函数为execQuery/fetchQuery，其功能是从下层取数据，然后通过注册的sender，把数据发送出去。

列存执行入口：

在execQuery执行时，通过判断iscolumnstore来判断是否是列执行，如果是，进入列存算子的transform流程（local_col_query_execute）；在fetchQuery执行时，通过判断iscolumnstore来判断是否是列执行，如果是，进入列存算子的execute流程（local_col_query_fetch）；

Sender注册

- 行存：数据发送的sender有两种类型gServiceSender和gPlsqlSender。注册gPlsqlSender时候会同时置stmt->soExecInfo.isSoSql=COD_TRUE；
- 列存：同样实现两种sender，在transform时，通过判断stmt->soExecInfo.isSoSql来生成对应类型的sender。


####   [5.2.2 ColQuery / ColQueryCursor：](#522-colquery--colquerycursor)  

```
struct ColQuery {
    child: Box&lt;dyn Operator&gt;,
    schema: Arc&lt;Schema&gt;,
    proj_types: Vec&lt;AnDataType&gt;,
    trace_output: Option&lt;Arc&lt;dyn TraceOutput&gt;&gt;,
}

struct ColQueryCursor {
    context: Arc&lt;dyn Context&gt;,
    child: Box&lt;dyn Cursor&gt;,
    stmt: Statement,
    col_set: Option&lt;ColumnSet&gt;,
    row_id: usize,
    col_id: usize,
    senders: Vec&lt;Box&lt;dyn DatumSender&gt;&gt;,
    trace_output: Option&lt;Arc&lt;dyn TraceOutput&gt;&gt;,
}

pub struct ColQueryCursorHandle {
    op: ColQuery,
    cursor: Option&lt;ColQueryCursor&gt;,
    fetch_num: usize,
    fetch_time: u128,
}

```

####   [5.2.3 ExecQuery / FetchQuery](#523-execquery--fetchquery)  

```
pub fn local_col_query_execute(stmt: Statement, plan: &amp;mut Plan) -&gt; Result&lt;()&gt;{
	// 对孩子节点进行递归bind；
	// 生成ColQuery，ColQueryCursorHandle, ColQueryCursor；
	// 保存到QueryContext上的Resource中；
}

pub fn local_col_query_fetch(stmt: Statement, plan: &amp;mut Plan, is_eof: &amp;mut bool) -&gt; Result&lt;()&gt; {
	// 根据ResourceKey，从QueryContext中找到bind生成的ColQueryCursorHandle；
	// 调用ColQueryCursor.next()从下层孩子节点取数据并发送
}

```

####   [5.2.4 Send Data](#524-send-data)  

```
trait SendValue&lt;'a, T: ColumnType&gt; {
    fn send_value(&amp;mut self, ty: &amp;T, datum: Option&lt;Datum&lt;'a, T&gt;&gt;, stmt: *mut AnlStmt, buffer: &amp;mut Buffer) -&gt; Result&lt;bool&gt;;
}

pub trait DatumSender {
    fn send(&amp;mut self, col: &amp;ColumnRef, row_id: usize, stmt: *mut AnlStmt) -&gt; Result&lt;bool&gt;;
}

struct TypedDatumSender&lt;Src: ColumnType, const IS_SO_SQL: bool&gt; {
    src_ty: Src,
    buffer: Buffer,
    _mark1: PhantomData&lt;Src&gt;,
}

#[repr(transparent)]
pub struct Packet {
    packet: CsPacket,
}  // 对C结构体的封装, 发送数据；

impl&lt;Src, const IS_SO_SQL: bool&gt; DatumSender for TypedDatumSender&lt;Src, IS_SO_SQL&gt;
where
    Src: ColumnType,
    for&lt;'a&gt; Variant: SetValue&lt;'a, Src&gt;,
    for&lt;'a&gt; AnchorPacket: SendValue&lt;'a, Src&gt;,
{
    #[inline]
    fn send(&amp;mut self, col: &amp;ColumnRef, row_id: usize, stmt: *mut AnlStmt) -&gt; Result&lt;bool&gt; {
        if IS_SO_SQL {
            self.so_send(col, row_id, stmt)
        } else {
            self.send(col, row_id, stmt)
        }
    }
}

impl ColQueryCursor {
    #[inline]
    fn try_new(
        child: &amp;dyn Operator,
        context: Arc&lt;dyn Context&gt;,
        _schema: Arc&lt;Schema&gt;,
        proj_types: &amp;[AnDataType],
        stmt: Statement,
        trace_output: Option&lt;Arc&lt;dyn TraceOutput&gt;&gt;,
    ) -&gt; Result&lt;Self&gt; {
        // 根据孩子节点的schema，生成对应列类型的sender。
        let is_so_sql = stmt.is_so_sql();
        let senders = if is_so_sql {
            create_datum_senders::&lt;true&gt;(context.alloc(), child.schema(), proj_types)
        } else {
            create_datum_senders::&lt;false&gt;(context.alloc(), child.schema(), proj_types)
        }?;
        let child = child.bind(&amp;context)?;
        Ok(Self { ... })
    }

    fn send_row(col_set: &amp;ColumnSet, ... ... ) -&gt; Result&lt;bool&gt; {
        let columns = col_set.columns();
        let begin_col_id = *col_id;

        for id in begin_col_id..col_set.column_count() {
            let column = &amp;columns[id];
			// 用对应的sender发送数据；
            let is_put = senders[id].send(column, row_id, stmt)?;
            if !is_put {
                *col_id = id;
                return Ok(false);
            }
        }
        Ok(true)
    }
}

```

- 为每种支持的数据类型实现：


```
impl&lt;'a&gt; SendValue&lt;'a, BoolType&gt; for AnchorPacket {
    fn send_value(... ...) -&gt; Result&lt;bool&gt; {
        match datum {
            Some(d) =&gt; Ok(self.put_bool(d.value())?),
            None =&gt; Ok(self.put_null()?),
        }
    }
}

```

- 为Packet实现发送特定数据类型的接口：


```
impl Packet {
	// null
    pub fn put_null(&amp;mut self) -&gt; Result&lt;bool&gt; {
        let ret = unsafe { aniRowPutNull(&amp;mut self.packet) };
        Ok(ret)
    }

	// 基本数据类型
    pub fn put_i8(&amp;mut self, v: i8) -&gt; Result&lt;bool&gt; {
        let ret = unsafe { aniRowPutInt8(&amp;mut self.packet, v as u8) };
        Ok(ret)
    }
    pub fn put_timestamp(&amp;mut self, v: Timestamp) -&gt; Result&lt;bool&gt; {
        let v = unsafe { *(&amp;v as *const Timestamp as *const i64) };
        self.put_i64(v)
    }

	// Number类型
    pub fn put_decimal(&amp;mut self, v: Decimal) -&gt; Result&lt;bool&gt; {
        const DECIMAL_MAX_LEN: usize = 20;
        let mut data: [u8; DECIMAL_MAX_LEN] = [0; DECIMAL_MAX_LEN];
        let len = v.encode(data.as_mut_slice())?;
        self.put_bytes(&amp;data[0..len])
    }
	
	// 字符串类型
    pub fn put_bytes(&amp;mut self, bytes: &amp;[u8]) -&gt; Result&lt;bool&gt; {
        let size = bytes.len() as u32;
        let data = bytes.as_ptr() as *mut u8;
        let ret = unsafe { aniRowPutBytes(&amp;mut self.packet, data, size) };
        Ok(ret)
    }

	// Lob类型
    pub unsafe fn put_lob(&amp;mut self, stmt: *mut AnlStmt, lob: &amp;[u8], data_type: DataType, buf: *mut u8) -&gt; Result&lt;bool&gt; {
        let mut variant = Variant::new();
        unsafe { variant.set_lob_value_direct(lob, buf) };

        let mut is_put = false;
        let ret = unsafe {
            anrColSendLob(
                stmt,
                variant.raw_variant_mut(),
                data_type as u32,
                &amp;mut is_put,
            )
        };
        return_if_error!(ret);

        Ok(is_put)
    }
}

```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 所有数据类型出现在结果投影列；
- 所有数据类型运算/函数出现在结果投影列；


##   [7.资料设计章节](#7资料设计章节)  

不涉及资料

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

## Comments:

|  [](null)  ,设计方案评审会议纪要：,- explain算子打印执行引擎（可选）
- 目前子查询select改写成Result，改回去？
- 只修改Select下面带Col2Row的场景，中间带Col2Row的场景不受影响；
- ResourceKey直接使用PlanId，Col2Row上的handle_key可以删掉；
- 性能：卫健委场景性能提升1s左右；
,Posted by linbo at 八月 23, 2023 15:08|
|---|
