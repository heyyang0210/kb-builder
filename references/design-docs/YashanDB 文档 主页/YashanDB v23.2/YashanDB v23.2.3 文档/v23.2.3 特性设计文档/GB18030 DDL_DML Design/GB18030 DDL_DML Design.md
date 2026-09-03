Created by 文博浩, last modified on 四月 12, 2024

IR链接：YDBRD-19655

SR链接：YDBRD-23960

##   [1. 总述](#1-总述)  

列存执行允许服务端的字符集设置为GB18030，不涉及客户端。

###   [1.1 需求来源](#11-需求来源)  

产品化需求，单机、分布式数据库内核支持字符集(GB18030-2022)。

###   [1.2 调研文档](#12-调研文档)  

GB18030-2020支持87887个汉字、228个汉字部首（214个康熙部首和14个补充CKJ部首）、10种少数民族现行文字。

支持汉字样例：

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|DDL|下文展开|----|是|
|功能|DML|下文展开|----|是|
|性能|----|----|----|否|
|可用性|----|----|----|否|
|可靠性|----|----|----|否|
|可维可测|----|----|----|否|
|安全|----|----|----|否|
|易用性|----|----|----|否|
|可修改性|----|----|----|否|
|兼容性|----|----|----|否|
|周边配合|----|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

无

##   [3. 规格与约束](#3-规格与约束)  

只支持查询数据，暂不支持函数，字符集为GB18030时函数需要报错。

UTF8字符集下clob、char、varchar的实现不修改，之后替换为crab-charset库实现时与行存对齐。

##   [4. 特性](#4-特性)  

服务端字符集设置

- 建库时可以通过建库SQL指定：CREATE DATABASE DB CHARACTER SET GB18030;
- 建库时如果不通过建库SQL指定，则会通过读取yasdb.ini获取，CHARACTER_SET=GB18030。如果yasdb.ini中没有指定，则linux下默认UTF8，windows下默认GBK。
- 不能通过alter system set或者alter session set修改


客户端字符集设置

- 修改{YASDB_HOME}/client/yasc_env.ini来配置，CHARACTER_SET=GB18030。如果yasc_env.ini中没有指定，则linux下默认UTF8，windows下默认GBK。


DDL

- create table(LSC/TAC)
    - char/varchar/clob类型
    - default列值
    - 约束
        - not null
        - unique
        - primary key
    - LSC表建表时指定varchar/char作为排序列
    - 建分区表时指定varchar/char作为part key
    - 建分布表时指定varchar/char作为分布key
    - 二级分区
- alter table(LSC/TAC)
    - add
        - default值
    - modify
    - drop
    - 约束
        - not null
        - unique
        - primary key
- drop table(LSC/TAC)
- truncate table(LSC/TAC)
- create index(TAC)
- alter index(TAC)
- drop index(TAC)
- hint行表走列执行引擎
- 绑定参数


DML

- insert
- update
- delete
- select
- insert into select


###   [4.1 特性设计](#41-特性设计)  

crab内部以增加新类型的方式支持非UTF8字符集下的char和varchar，使用Utf8和FixedUtf8(u16)的地方逐步支持String(CharsetId)和FixedString((CharsetId, u16))，功能完全支持后替换。Clob类型支持字符集，这次需要把之前填UTF8的地方填上正确的字符集。

```
pub enum DataType {
    ...
    String(CharsetId),
    FixedString((CharsetId, u16)),
    Clob(CharsetId),
}

```

原本crab里的    `enum Charset`    可以用crab-charset的    `enum CharsetId`    替换，只需要维护一套枚举。

```
pub enum CharsetId {
    /// See [`Ascii`].
    ASCII = 0,
    /// See [`Iso88591`].
    ISO88591 = 3,
    /// See [`Gbk`].
    GBK = 1,
    /// See [`Gb18030`].
    GB18030 = 5,
    /// See [`Utf8`].
    UTF8 = 2,
    /// See [`Utf16`].
    UTF16 = 4,
}

impl TryFrom&lt;u8&gt; for CharsetId {
    type Error = Error;
    #[inline]
    fn try_from(value: u8) -&gt; Result&lt;Self, Self::Error&gt; {
        if value &gt; CharsetId::GB18030 as u8 {
            return Err(Error::default());
        }
        Ok(unsafe { std::mem::transmute::&lt;u8, CharsetId&gt;(value) })
    }
}

impl fmt::Display for CharsetId {
    #[inline]
    fn fmt(&amp;self, f: &amp;mut fmt::Formatter&lt;'_&gt;) -&gt; fmt::Result {
        match &amp;self {
            CharsetId::ASCII =&gt; write!(f, "Ascii"),
            CharsetId::ISO88591 =&gt; write!(f, "Iso8859-1"),
            CharsetId::UTF8 =&gt; write!(f, "Utf8"),
            CharsetId::UTF16 =&gt; write!(f, "Utf16"),
            CharsetId::GBK =&gt; write!(f, "Gbk"),
            CharsetId::GB18030 =&gt; write!(f, "Gb18030"),
        }
    }
}

```

StringType实现

```
pub struct StringType {
    charset: CharsetId,
}

mod impl_string_type {
    impl Type for StringType {
        type Native&lt;'a&gt; = &amp;'a RStr;
        type NativeOwned = RString&lt;StdAlloc&gt;;
        const NAME: &amp;'static str = "VARCHAR";
        const IS_VARLEN: bool = true;

        ...
    }

    impl VarLenType for StringType {}
}

```

FixedStringType实现

```
pub struct FixedStringType {
    charset: CharsetId,
    len: u16,
}

mod impl_fixed_string_type {
    impl Type for FixedStringType {
        type Native&lt;'a&gt; = &amp;'a RStr;
        type NativeOwned = RString&lt;StdAlloc&gt;;
        const NAME: &amp;'static str = "CHAR";
        const IS_VARLEN: bool = false;

        ...
    }

    impl FixedLenType for FixedStringType {
        #[inline]
        fn bit_width(&amp;self) -&gt; usize {
            self.len() as usize * 8
        }
    }
}

```

###   [4.2 DDL](#42-ddl)  

建表放开对字符集GB18030的拦截，

```
if (IS_COL_TABLE(def-&gt;relType)) {
    if (ANL_VARENV-&gt;charset != UTF8 &amp;&amp; ANL_VARENV-&gt;charset != GB18030) { //维护支持数组
        COD_SET_ERROR(ERR_ANS_PARSER_INVALID_CREATE_TAB);
        return COD_ERROR;
    }
}

```

其他DDL功能在实现StringType、FixedStringType分支后天然支持。

###   [4.3 DML](#43-dml)  

在anchor-rs实现    `enum Charset`    与行存字符集枚举    `enum EnCodCharsetId`    映射。

```
#[repr(u16)]
pub enum Charset {
    UNKNOWN = EnCodCharsetId___CHARSET_COUNT__ as u16,
    ASCII = EnCodCharsetId_ASCII as u16,
    GBK = EnCodCharsetId_GBK as u16,
    UTF8 = EnCodCharsetId_UTF8 as u16,
    UTF16 = EnCodCharsetId_UTF16 as u16,
    ISO88591 = EnCodCharsetId_ISO88591 as u16,
    GB18030 = EnCodCharsetId_GB18030 as u16,
}

impl From&lt;u16&gt; for Charset {
    #![allow(non_upper_case_globals)]
    fn from(charset: u16) -&gt; Self {
        match charset as EnCodCharsetId {
            EnCodCharsetId_ASCII =&gt; Charset::ASCII,
            EnCodCharsetId_GBK =&gt; Charset::GBK,
            EnCodCharsetId_UTF8 =&gt; Charset::UTF8,
            EnCodCharsetId_UTF16 =&gt; Charset::UTF16,
            EnCodCharsetId_ISO88591 =&gt; Charset::ISO88591,
            EnCodCharsetId_GB18030 =&gt; Charset::GB18030,
            _ =&gt; Charset::UNKNOWN,
        }
    }
}

impl From&lt;Charset&gt; for EnCodCharsetId {
    #[inline]
    fn from(ch: Charset) -&gt; Self {
        ch as EnCodCharsetId
    }
}

```

```
typedef enum EnCodCharsetId {
    ASCII = 0,
    GBK,
    UTF8,
    ISO88591,
    UTF16,
    GB18030,
    __CHARSET_COUNT__
} CodCharsetId;

```

AnchorDataType通过try_convert()转成列存DataType，由于ColumnAttr不带字符集信息，需要取stmt->handler->curVarEnv->charset的字符集，推导出列存DataType。

```
pub trait TryConvert&lt;T&gt;: Sized {
    fn try_convert(value: T, charset: Charset) -&gt; Result&lt;Self&gt;;
}

impl TryConvert&lt;AnchorTypeInfo&gt; for DataType {
    #[inline]
    fn try_convert(ty_info: AnchorTypeInfo, charset: Charset) -&gt; Result&lt;Self&gt; {  //把charset放到AnchorTypeInfo中
        let ty = ty_info.anchor_ty;
        match ty {
            ...
            AnchorDataType::AnUnknown =&gt; Ok(DataType::Utf8),
            AnchorDataType::Varchar =&gt; match charset {
                Charset::UTF8 =&gt; Ok(DataType::Utf8),
                Charset::GB18030 =&gt; Ok(DataType::String(Charset::Gb18030)),
                _ =&gt; Err(Error::CrabError(Box::try_new(
                    crab::error::Error::UnsupportedFeature("other charsets".try_to_string()?),
                )?)),
            },
            AnchorDataType::Char =&gt; match charset {
                Charset::UTF8 =&gt; Ok(DataType::FixedUtf8(ty_info.len)),
                Charset::GB18030 =&gt; Ok(DataType::FixedString((Charset::Gb18030, ty_info.len))),
                _ =&gt; Err(Error::CrabError(Box::try_new(
                    crab::error::Error::UnsupportedFeature("other charsets".try_to_string()?),
                )?)),
            },
        }
    }
}

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设置服务端、客户端字符集为GB18030，

- 单机、分布式
- LSC、TAC表
- DDL、DML
- GB18030-2022汉字字符、非GB18030-2022汉字字符


正交测试。

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

适配函数

## Attachments:

[18030-2022样例.zip](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzY4OTcwYzJhZjRmNTIxMTI4IiwicmVmX2lkIjoiNjczOTZkMzU1OTNmOTljOWZmMjM3OTFkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NTUyLCJleHAiOjE3ODIzOTI5NTJ9.ZNvvQbqE1_FAOseBOr5zQe-3W8fjuMu2qB8erQRBYqI)

 (application/zip)    


## Comments:

|  [](null)  ,会议纪要：列存GB18030 DDL/DML开发设计评审,时间：2024/04/12 11:00-12:00,与会人：黄靖东，孟麟，钟溱，林博，王仁松，胡威振，文博浩,纪要信息：,1. 2024.4.22那周与YDBRD-23961一起转测
1. 开发门禁没有字符集用例看护，需要与工程组沟通增加看护
,评审结论：评审通过,Posted by wenbohao at 四月 12, 2024 12:02|
|---|
