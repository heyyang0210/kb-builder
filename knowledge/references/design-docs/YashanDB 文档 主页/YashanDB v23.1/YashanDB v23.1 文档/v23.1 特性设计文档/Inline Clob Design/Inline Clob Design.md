Created by 文博浩, last modified on 五月 15, 2023

##   [1. Overview（概述）](#1-overview概述)  

在AnchorBase适配crab的LobColumn和存储新的inline clob格式。

##   [2. Features（功能特性）](#2-features功能特性)  

完全支持旧的inline clob功能。inline clob最大规格为32000(不包括lob头长度)。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

  [https://conf.yasdb.com/display/YAS/Lob+Column+Design#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6](https://conf.yasdb.com/display/YAS/Lob+Column+Design#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

补充：

- clob不支持比较 -> clob不支持distinct
- clob不支持排序 -> lsc表建表第一列不可以是clob


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

把之前实现的Utf8Type和Inline Clob的转换去掉。

###   [5.1 涉及到存储格式的修改](#51-涉及到存储格式的修改)  

在set_value中用到存储接口：columnarLobToVarLob

buffer: Buffer::new(Some(alloc.clone()))

```
const LOB_HEAD_DIFF: usize = 10;

impl&lt;'a&gt; SetValue&lt;'a, ClobType&gt; for Variant {
    #[inline]
    fn set_value(
        &amp;mut self,
        _ty: &amp;ClobType,
        datum: Option&lt;Datum&lt;'a, ClobType&gt;&gt;,
        buffer: &amp;mut Buffer,
    ) -&gt; Result&lt;()&gt; {
        match datum {
            Some(d) =&gt; {
                let s = d.value_ref();
                buffer
                    .reserve(LOB_HEAD_DIFF + s.len())
                    .map_err(|_| Error::TransformError("memory alloc error".to_string()))?;
                unsafe {
                    self.set_clob_value(Some(s), buffer.as_mut_ptr());
                }
            }
            None =&gt; unsafe {
                self.set_clob_value(None, buffer.as_mut_ptr());
            },
        };
        Ok(())
    }
}

#[inline]
pub unsafe fn set_clob_value(&amp;mut self, val: Option&lt;&amp;Lob&gt;, buffer_ptr: *mut u8) {
   self.set_data_type(DataType::Clob);
   match val {
        Some(v) =&gt; {
            self.set_clob_value_direct(v, buffer_ptr);
        }
        None =&gt; {
            self.set_null(true);
        }
    }
}

#[inline]
pub unsafe fn set_clob_value_direct(&amp;mut self, val: &amp;Lob, buffer_ptr: *mut u8) {
    self.set_lob_value_direct(val.as_bytes(), buffer_ptr);
}

#[inline]
unsafe fn set_lob_value_direct(&amp;mut self, val: &amp;[u8], buffer_ptr: *mut u8) {
    self.set_null(false);
    self.var.__bindgen_anon_1.vLob.data = buffer_ptr;
    self.var.__bindgen_anon_1.vLob.cursor = ptr::null_mut();
    unsafe {
        columnarLobToVarLob(
            val.as_bytes().as_ptr() as *mut c_void,
            val.len() as u32,
            false,
            self.var.__bindgen_anon_1.vLob.data as *mut c_void,
            &amp;mut self.var.__bindgen_anon_1.vLob.size,
        );
    }
}

```

为LobColumn实现move_buffers，move_lob_buffers：从DataBuffer中拿到flag的all_inline。接口：

```
#[inline]
pub fn lob_all_inrow(&amp;self) -&gt; u8 {
    unsafe { self.inner.flag.__bindgen_anon_1.lobAllInRow() }
}

```

datasetMoveColumn中增加了cursor

```
let result = datasetMoveColumn(
    self.cursor.raw_cursor_mut() as *mut AnkCursor as *mut c_void,
    self.data_set,
    id,
    buf.as_mut_ptr() as _,
    &amp;mut count,
);

```

param去掉lob头，可能会调用存储的heapLobToColumnarLob接口

```
DataType::Clob =&gt; {
    let lobs = variant.clob_value();
    let value = LobBuf::new(lobs.as_bytes().to_vec());
    Const::Clob((Charset::Utf8, Some(value)))
}
DataType::Json =&gt; {
    let lobs = variant.json_value();
    let value = YasonBuf::new_unchecked(lobs.as_bytes().to_vec());
    Const::Json(Some(value))
}

```

```
const VARLOB_HEAD_LEN: usize = 12;

#[repr(transparent)]
pub struct Lobs&lt;'a&gt; {
    lobs: VarLob,
    _marker: PhantomData&lt;&amp;'a str&gt;,
}

impl&lt;'a&gt; Lobs&lt;'a&gt; {
    /// # Safety
    #[inline]
    pub unsafe fn from_raw(lobs: VarLob) -&gt; Self {
        Lobs {
            lobs,
            _marker: PhantomData,
        }
    }

    #[inline]
    pub fn as_bytes(&amp;self) -&gt; &amp;'a [u8] {
        let size = self.lobs.size as usize;
        debug_assert!(size &gt;= VARLOB_HEAD_LEN);
        // ensure data is not null
        if size == VARLOB_HEAD_LEN {
            return "".as_bytes();
        }
        let data = self.lobs.data as *const u8;
        unsafe {
            std::slice::from_raw_parts(data.add(VARLOB_HEAD_LEN), size - VARLOB_HEAD_LEN) as _
        }
    }
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 跑过门禁、二层ci现有用例；
- 补充函数参数是clob的用例；


##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  