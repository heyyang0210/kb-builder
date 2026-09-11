Created by 文博浩, last modified on 六月 12, 2023

##   [1. Overview（概述）](#1-overview概述)  

本设计方案旨在Crab实现Lob Column。

##   [2. Features（功能特性）](#2-features功能特性)  

当前实现的inline clob是在transform转成varchar，crab内部以Utf8Type支持inline clob。本次在crab内部支持clob、blob类型和Lob Column。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 不能作为索引列
- 不能在LOB列上建立check约束项
- 不能修改LOB列的数据类型
- 不能作为分区键
- 不能对含有LOB列的列存表执行UPDATE操作
- 不能以LOB列作为过滤条件对列存表执行DELETE操作
- 分布式架构中不支持LOB作为分布键


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 增加Clob、Blob类型](#51-增加clobblob类型)  

- 增加编码方式枚举。


```
/// Supported encoding mode.
pub enum CharSet {
    Utf8,
}

```

- 在DataType枚举中增加Clob、Blob。


```
pub enum DataType {
    ...
    Clob(CharSet),
    Blob,
}

pub enum SqlDataType {
    ...
    Clob = 29u8,
    Blob = 30u8,
    ...
}

```

```
trait LobType: VarLenType {}

#[derive(Copy, Clone, Debug)]
pub struct ClobType(pub Charset);

mod impl_clob_type {
    use super::*;

    impl Type for ClobType {
        type Native = Lob;
        type NativeOwned = LobBuf;
        const NAME: &amp;'static str = "CLOB";
        const IS_VARLEN: bool = true;
        ...
    }
}

#[derive(Copy, Clone, Debug)]
pub struct BlobType;

mod impl_blob_type {
    use super::*;

    impl Type for BlobType {
        type Native = Lob;
        type NativeOwned = LobBuf;
        const NAME: &amp;'static str = "BLOB";
        const IS_VARLEN: bool = true;
        ...
    }
}

```

###   [5.2 Column定义](#52-column定义)  

- Lob Column基于VarLenColumn来实现，额外存储了是否一列全是inline的标志位。


```
#[derive(Debug, Clone)]
pub struct LobColumn&lt;T: LobType&gt; {
    column: VarLenColumn&lt;T&gt;,

    /// All data is inline.
    is_inline: bool,
}

```

###   [5.3 序列化/反序列化](#53-序列化反序列化)  

- 序列化


```
impl&lt;T: LobType&gt; Serialize for LobColumn&lt;T&gt; {
    #[inline]
    fn serialize&lt;S: Write&gt;(&amp;self, s: &amp;mut S) -&gt; Result&lt;()&gt; {
        Serialize::serialize(self.data_type(), s)?;

        let with_null = self.null_count() &gt; 0;

        let mut flags: u8 = 0;
        if with_null {
            flags |= WITH_NULL_BITMAP_MASK;
        }
        s.write_u8(flags)?;

        self.data().serialize(s)?;
        self.data_offset().serialize(s)?;
        if with_null {
            let null_bitmap = self.null_bitmap().unwrap();
            null_bitmap.serialize(s)?;
        }

        s.write_u8(self.is_inline() as u8)?;

        Ok(())
    }
}

```

- 反序列化


```
#[inline]
fn deserialize_lob_column&lt;T: LobType&gt;(
    &amp;mut self,
    ty: T,
    with_null: bool,
    len: usize,
    alloc: &amp;Arc&lt;dyn Allocator&gt;,
) -&gt; Result&lt;LobColumn&lt;T&gt;&gt; {
    let data = self.deserialize_vector(UInt8Type, alloc)?;
    let offset = self.deserialize_vector(Int32Type, alloc)?;
    if len + 1 != offset.len() {
        return Err(Error::CodecError(format!(
            "expected len of {} vector is {} but actually is {}",
            Int32Type.data_type(),
            len + 1,
            offset.len()
        )));
    }
    let null_bitmap = if with_null {
        Some(self.deserialize_bitmap(len, alloc)?)
    } else {
        None
    };
    let is_inline = self.deserialize_u8()? != 0;

    Ok(unsafe { LobColumn::from_vector(ty, data, offset, null_bitmap, is_inline) })
}

```

###   [5.4 Lob结构体](#54-lob结构体)  

带所有权：

```
const LOB_HEAD_LEN: usize = 2;

/// An owned `Lob` value, backed by a buffer of bytes in lob binary format.
/// This can be created from a `Vec&lt;u8&gt;`.
#[derive(Debug, Clone)]
pub struct LobBuf {
    val: Vec&lt;u8&gt;,
}

impl LobBuf {
    /// Creates a new `LobBuf` from `Vec&lt;u8&gt;`.
    #[inline]
    pub fn new(val: Vec&lt;u8&gt;) -&gt; Self {
        debug_assert!(val.len() &gt; LOB_HEAD_LEN);
        LobBuf { val }
    }

    #[inline]
    pub fn clone_from_lob(&amp;mut self, lob: &amp;Lob) {
        self.val.clear();
        self.val.extend_from_slice(lob.as_bytes())
    }
}

```

按照存储的lob头格式实现，存储有改动这里也需要改。

```
typedef struct StColumnarLobHead {
    CodUint8 type;
    CodUint8 charLen : 1;
    CodUint8 inRow : 1;
    CodUint8 hasLocator : 1;  // for inrow data has locator
    CodUint8 unused : 5;
    union {
        LobCoupon coupon;   // outrow lob message
        CodChar   data[0];  // inrow data
    };
} ColumnarLobHead;

```

```
const CHAR_LEN_FLAG: u8 = 1;
const IN_LINE_FLAG: u8 = 2;
const HAS_LOCATOR_FLAG: u8 = 4;

#[derive(Debug)]
pub struct LobHead {
    lob_type: u8,
    flag: u8,
}

impl LobHead {
    #[inline]
    pub fn new(val: &amp;Lob) -&gt; &amp;LobHead {
        debug_assert!(!val.as_ref().is_empty());
        unsafe { &amp;*(val as *const Lob as *const u8 as *const LobHead) }
    }

    #[inline]
    pub fn lob_type(&amp;self) -&gt; u8 {
        self.lob_type
    }

    #[inline]
    pub fn char_len(&amp;self) -&gt; u8 {
        self.flag &amp; CHAR_LEN_FLAG
    }

    #[inline]
    pub fn is_inline(&amp;self) -&gt; bool {
        self.flag &amp; IN_LINE_FLAG == IN_LINE_FLAG
    }

    #[inline]
    pub fn has_locator(&amp;self) -&gt; bool {
        self.flag &amp; HAS_LOCATOR_FLAG == HAS_LOCATOR_FLAG
    }
}

```

不带所有权：

```
/// A slice of `Lob` value.
#[derive(Debug)]
pub struct Lob {
    val: [u8],
}

impl Lob {
    /// Creates a new `Lob` from the reference of `[u8]`.
    #[inline]
    pub fn new&lt;V: AsRef&lt;[u8]&gt; + ?Sized&gt;(val: &amp;V) -&gt; &amp;Lob {
        debug_assert!(!val.as_ref().len() &gt; LOB_HEAD_LEN);
        unsafe { &amp;*(val.as_ref() as *const [u8] as *const Lob) }
    }

    #[inline]
    pub fn get_lob_head(&amp;self) -&gt; &amp;LobHead {
        LobHead::new(self)
    }

    #[inline]
    pub fn is_inline(&amp;self) -&gt; bool {
        LobHead::is_inline(Lob::get_lob_head(self))
    }

    #[inline]
    pub fn has_locator(&amp;self) -&gt; bool {
        self.get_lob_head().has_locator()
    }

    pub fn as_bytes(&amp;self) -&gt; &amp;[u8] {
        &amp;self.val
    }

    #[inline]
    pub fn inline_data(&amp;self) -&gt; &amp;[u8] {
        let data = self.val.as_ptr();
        unsafe { std::slice::from_raw_parts(data.add(LOB_HEAD_LEN), self.data_len()) as _ }
    }

    #[inline]
    pub fn to_lob_buf(&amp;self) -&gt; Result&lt;LobBuf&gt; {
        let mut val = Vec::new();
        val.try_reserve(self.val.len())?;
        val.extend_from_slice(&amp;self.val);

        Ok(LobBuf { val })
    }

    #[inline]
    pub fn len(&amp;self) -&gt; usize {
        if self.is_inline() {
            self.val.len()
        } else {
            // outline is not implemented yet
            todo!()
        }
    }

    pub fn data_len(&amp;self) -&gt; usize {
        if self.has_locator() {
            // 只有更新场景会带LobLocator
            // 存储没确定locator长度，实现更新lob时补充
            todo!()
        } else {
            self.len() - LOB_HEAD_LEN
        }
    }

    pub fn is_empty(&amp;self) -&gt; bool {
        self.len() &lt; LOB_HEAD_LEN
    }

    /// Unsupported comparing Lob.
    #[inline]
    pub fn equals&lt;T: AsRef&lt;Lob&gt;&gt;(&amp;self, _other: T) -&gt; Result&lt;bool&gt; {
        Err(Error::UnsupportedFeature("Comparing Lob".to_string()))
    }
}

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 在现有用例的基础上补充新增支持clob、blob类型的函数用例。
- 刷新typeof()用例，clob类型可以正确输出。
- 之前clob传进crab是utf8，可能有些用例走到了排序，clob不支持排序。


##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## Comments:

|  [](null)  ,函数支持clob、blob：,1. 用str实现的地方抽象接口，把clob、blob转成字符串。
1. 为outline预留接口。
1. 函数用到的str方法，给[u8]做同样的实现。
,Posted by wenbohao at 三月 31, 2023 14:29|
|---|
|  [](null)  ,Lob Column用T为ClobType、BlobType实现。inline跟存储新的格式对齐。,Posted by wenbohao at 三月 31, 2023 14:40|
