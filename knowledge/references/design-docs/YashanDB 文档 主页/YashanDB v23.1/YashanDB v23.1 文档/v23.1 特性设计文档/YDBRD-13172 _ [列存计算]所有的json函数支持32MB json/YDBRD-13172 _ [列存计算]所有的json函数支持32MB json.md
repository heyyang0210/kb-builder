Created by 王仁松, last modified on 六月 06, 2024

SR：     [[YDBRD-13172] [列存计算]所有的json函数支持32MB json - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13172)  

# 1. Overview（概述）

json函数：  JsonArrayGet/JsonArrayLength/JsonExists/JsonQuery/JsonSerialize支持大Json（32MB）的计算。

# 2. Features（功能特性）

1. 存储方面使用lob进行json类型的存储。
1. crab支持使用lob形式存储的大json的读取、插入、查询等。
1. Yason支持注入分配器。


# 3. Interfaces（接口）

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

# 4. Specification And Constraints（规格与约束）

1. json最大支持到32MB。


# 5. Detail Design（详细设计）

## 5.1 存储json方案

另有存储ar和相关存储人员开发。

## 5.2 Crab json函数支持大json

### 5.2.1 JsonType

修改JsonType的Native为Lob，NativeOwned为YasonBuf。

```
mod impl_json_type {
    use super::*;

    impl Type for JsonType {
        type Native<'a> = Json<'a>;
        type NativeOwned = JsonBuf;
···
···
}

#[derive(Debug, Copy, Clone)]
pub struct Json<'a> {
    lob: &'a Lob,
    buf: Option<&'a Arc<OutlineLobBuf>>,
}

#[derive(Debug, PartialEq, Clone)]
pub struct JsonBuf {
    lob: LobBuf,
    buf: Option<Arc<OutlineLobBuf>>,
}
```

  


### 5.2.2 JsonColumn

修改JsonColumn数据结构，在JsonType的基础上，增加json_buf，用于当列中存在outline lob时分配内存缓存yasonbuf数据。

```
#[derive(Debug, Clone)]
pub struct JsonColumn {
    column: VarLenColumn<JsonType>,
    /// All data is inline.
    is_inline: bool,
    /// Memory buffer used when there are large(outline) Lobs in the column
    cache_outline_json_buf: Arc<RwLock<CodVec<Option<Arc<OutlineLobBuf>>>>>,
    /// Just for json column builder, cannot be used for `select`.eq.
    calc_outline_json_buf: CodVec<Arc<OutlineLobBuf>>,
    alloc: Arc<dyn Allocator>,
}
```

![](https://pingcode.yasdb.com/atlas/files/public/67396ade8970c2af4f51ffb3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFBQUFJQUFBQUFBQUFBQUFBRUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFCQUFBQkFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQWdDQUFBQUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1NzIsImV4cCI6MTc4MjMwMDM3Mn0.pp7mqhQEKOeRTSR_Rk66F7u7R1m7SZVSx3kfwpwTBeg)

使用Option类似与指针的作用，避免Vec分配一大片连续内存，同时inline lob可以用None表示，outline lob首次未易读表示None，其余则用YasonBuf进行outline buf的缓存。

采用这种方式，当需要访问大json时，可以通过mutex在持有不可变引用的情况下往原有的column的json_buf添加数据，另外可以通过元素的index值简单快速找到json_buf中对应的位置并且可以判断其（大lob）是否有缓存。

inline lob在json_buf始终未None并没有实际意义，只是方便outline lob在json_buf中的快速查找，可以让下标值一一对应。

基于以上，有两种方案：

1. JsonColumn 需要提供额外的读取获取yason的接口。    
    

1. JsonColumn的Datum直接设计成Yason


```
impl JsonColumn {
    pub fn read_json_from_lob(&self, index: usize, data: &Lob) -> &Yason {
        todo!()
    }
}
```

  


优化点：

对于整个column都是inline的情况下，获取yason时可以直接根据Lob的data进行Yason的返回。

对应的JsonColumn的Builder同样实现具体的builder trait：

```
trait TypedColumnBuilder

trait TypedNonNullColumnBuilder

trait Builder
```

在构建column的时候，遇到大json（大于32K）时，将其转化为inline lob存入，但其本质上是outline lob。

### 5.2.3 大Lob的访问

![](https://pingcode.yasdb.com/atlas/files/public/67396ade8970c2af4f51ffb4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFBQUFJQUFBQUFBQUFBQUFBRUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFCQUFBQkFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQWdDQUFBQUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1NzIsImV4cCI6MTc4MjMwMDM3Mn0.pp7mqhQEKOeRTSR_Rk66F7u7R1m7SZVSx3kfwpwTBeg)

通过flag判断其是否是outline，然后通过type判断outline locator的类型，与存储沟通知在列存这边都是AnkLobcator：

```
typedef enum EnVarLobType {
    LOB_KNL_COUPON = 0,
    LOB_TEMP_COUPON,
    LOB_KNL_LOCATOR,
    LOB_MEMORY_LOCATOR
} VarLobType;
```

使用LOB_KNL_LOCATOR，即2。从Lob的数据中对应偏移取56字节。

通过LobLocatorHead可以根据协议获取outline lob的size大小。

```
typedef struct StLobLocatorHead {
    CodUint64 endpoint : 16;
    CodUint64 lobSize : 48;
    CodChar data[0];
} LobLocatorHead;
```

在LobLocatorHead中endpoint占用2字节，lobSize占用6字节，总共8字节，我们取lobSize6字节读取出u64即可。

由于在crab内部无法访问存储的接口，而访问大Lob又需要访问存储的接口实现，因此可以在crab中定义trait，在anchorbase中实现trait，并且传入trait object来实现访问存储接口获取大Lob数据的回调功能。

```
pub trait LobHandle: Send + Sync + Debug {
    fn open(&self, lob: &Lob) -> Result<Box<dyn LobReader>>;
}

pub trait LobReader: Send + Sync + Debug {
    fn read(&mut self, buf: &mut [u8]) -> Result<usize>;
}
```

可以在QueryContext中新增访问大Lob的trait object成员，便于crab访问：

```
#[derive(Debug)]
pub struct QueryContext {
···
}

impl Context for QueryContext {
···
	fn lob_handler(&self) -> crab::error::Result<Option<Box<dyn LobHandle>>>
···
}

pub trait Context: Any + Send + Sync + Interrupt + Finish + Debug {
···
	fn lob_handler(&self) -> Result<Option<Box<dyn LobHandle>>>;
}
```

访问的存储的具体的接口主要是根据locator读取outline lob到指定buf的  ankReadLobByLocator。

```
extern "C" {
    pub fn ankReadLobByLocator(
        handler: *mut AnkHandler,
        locator: *mut AnkLobLocator,
        offset: CodUint64,
        charLen: *mut CodUint8,
        size: *mut CodUint64,
        buf: *mut CodChar,
    ) -> CodResult;
}
```

由于需要使用AnkHandler，并且QueryContext中有Handler可以直接使用并且Handler处于anchor-rs中，考虑直接将访问outline lob的接口实现在Handler中：

```
pub struct Handler {
    handler: *mut AnlHandler,
···
}

impl Handler {
	#[inline]
	pub fn read_outline_lob(
        &self,
        locator: &LobLocator,
        mut size: u64,
        buf: &mut [u8],
    	) -> Result<()> {
		todo!();
	}
···
}
```

  


### 5.2.4 自测

通过特殊的建表语句显式创建以outline lob形式存储的列表：

```
create table tac_outrow_clob_01(c1 int, c2 clob)lob(c2)store as(disable storage in row)organization tac;
```

这样使用insert插入很小的lob都是以outline lob形式进行存储的。

### 5.2.5 插入

与存储沟通表示，32k以内用sql工具insert插入没有问题，超过32k则需要使用驱动客户端进行大json的插入。

实际使用jdbc驱动插入大json，最大只支持到64k，超过64k则报错：

![](https://pingcode.yasdb.com/atlas/files/public/67396ade8970c2af4f51ffb5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQUFBQUFBQUFJQUFBQUFBQUFBQUFBRUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFCQUFBQkFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQWdDQUFBQUFBQUFBQUlBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1NzIsImV4cCI6MTc4MjMwMDM3Mn0.pp7mqhQEKOeRTSR_Rk66F7u7R1m7SZVSx3kfwpwTBeg)

但是不影响存储outline lob功能，超过32k即使用outline lob存储json，可先将规格提升到64k。但列存本身不做限制，后续插入规格提升，列存天然支持。

## 5.3 Yason支持注入分配器

原yason底层是Vec<u8>，使用的是默认的分配器：

```
pub struct YasonBuf {
    bytes: Vec<u8>,
}

impl YasonBuf {
    /// Creates a new `YasonBuf` from `Vec<u8>`.
    ///
    /// # Safety
    ///
    /// Callers should guarantee the `bytes` is a valid `YASON`.
    #[inline]
    pub unsafe fn new_unchecked(bytes: Vec<u8>) -> Self {
        debug_assert!(!bytes.is_empty());
        YasonBuf { bytes }
    }

···
}
```

YasonBuf本身使用传入的Vec作为底层的Vec，可以不做修改传入带分配器创建的Vec即可。

而从Yason转换为YasonBuf时，主要有两种方式：

```
impl Yason {
···
    #[inline]
    pub fn to_yason_buf(&self) -> YasonResult<YasonBuf> {
        let mut bytes = Vec::new();
        bytes
            .try_reserve(self.bytes.len())
            .map_err(YasonError::TryReserveError)?;
        bytes.extend_from_slice(&self.bytes);

        Ok(YasonBuf { bytes })
    }
···
}

impl ToOwned for Yason {
    type Owned = YasonBuf;

    #[inline]
    fn to_owned(&self) -> YasonBuf {
        unsafe { YasonBuf::new_unchecked(self.bytes.to_vec()) }
    }
}
```

两种方式都是使用rust的默认分配器构建Vec。如果需要在大Json场景下从Yason构建YasonBuf：

- 第一种方式我们需要新增接口
- 第二种方式我们应该在此场景下禁止使用，而使用to_yason_buf_in显式传入分配器的方式


```
pub fn to_yason_buf_in(&self, alloc: Allocator) -> YasonResult<YasonBuf>;
```

## ~~5.4 大json计算memlob的特化场景~~

|~~函数/算子~~|~~概述~~|~~是否特化~~|
|---|---|---|
|~~case when~~|~~根据条件返回then或者else的表达式结果，如果类型都是json的话，是可以正常返回的，会使用TypedAppend::append接口来构建新的column，而大json类型是没有做特化的，需要特化~~|~~已做~~|
|~~coalesce~~|~~在多个expr中返回第一个不为空的expr值，如果类型都是json的话，是可以正常返回的，需要特化~~|~~已做~~|
|~~if~~|~~三个expr参数，expr2和expr3未同一类型时，可返回正常结果，但是如果都是Json，是返回原Column，不存在转换到新的column，不需要特化~~|~~不需要~~|
|~~nullif~~|~~对两个值进行比较，json不支持比较，不需要特化~~|~~不需要~~|
|~~nvl~~|~~返回两个expr值参数中的首个非空的表达式的值，其中有类型转换，大json不支持大部分类型转换，但是同为json类型时，可正常返回，需要特化~~|~~已做~~|
|~~string/case~~|~~转换字符串大小写，不支持json，不需要特化~~|~~不需要~~|
|~~string/concat~~|~~字符串拼接，不支持json，不需要特化~~|~~不需要~~|
|~~string/initcap~~|~~字符串单词分隔，不支持json，不需要特化~~|~~不需要~~|
|~~string/pad~~|~~字符串合成，不支持json，不需要特化~~|~~不需要~~|
|~~string/replace~~|~~字符串特换，不支持json，不需要特化~~|~~不需要~~|
|~~cast~~|~~类型转换，其中clob和json的转换，历史版本已做特化~~|~~已做~~|
|~~subquery~~|~~关联子查询可返回大json，需要做特化，比如：~~    
,~~drop~~  ~~ ~~  ~~table~~  ~~ ~~  ~~if~~  ~~ ~~  ~~exists~~  ~~ test_large_json_append_datum_t2;~~    
  ~~create~~  ~~ ~~  ~~table~~  ~~ ~~  ~~test_large_json_append_datum_t2~~  ~~(id ~~  ~~int~~  ~~, c1 ~~  ~~json~~  ~~) organization lsc tablespace users;~~    
  ~~insert into~~  ~~ test_large_json_append_datum_t2 ~~  ~~values~~  ~~(~~  ~~1~~  ~~, ~~  ~~json~~  ~~(~~  ~~'"123"'~~  ~~));~~    
  ~~select~~  ~~ id, (~~  ~~select~~  ~~ json_array_get(c1,~~  ~~0~~  ~~) ~~  ~~from~~  ~~ test_large_json_append_datum_t1 ~~  ~~where~~  ~~ ~~  ~~test_large_json_append_datum_t1~~  ~~.~~  ~~id~~  ~~ ~~  ~~=~~  ~~ ~~  ~~test_large_json_append_datum_t2~~  ~~.~~  ~~id~~  ~~) ~~  ~~from~~  ~~ test_large_json_append_datum_t2;~~|~~已做~~|
|~~binary~~|~~不支持json，不需要做特化~~|~~不需要~~|
|~~unary~~|~~不支持json，不需要特化~~|~~不需要~~|
|~~filter~~|~~历史版本已做~~|~~已做~~|
|~~merge_sort~~|~~并行下的order by会走merge_sort，会从json的column中构建新的column，需要特化~~|~~已做~~|
|~~sorted_group~~|~~Json不支持比较，不需要特化~~|~~不需要~~|
|~~sorter~~|~~历史版本已做~~|~~已做~~|
|~~first_value~~|~~历史版本已做~~|~~已做~~|
|~~lag~~|~~历史版本已做~~|~~已做~~|
|~~greatest_least~~|~~在多个参数中横向进行比较，json不支持比较，不需要特化~~|~~不需要~~|


# 6. Testcases（自测用例）

- 跑过门禁、二层ci现有用例；
- 补充使用outline lob形式存储的json的用例；


# 7. Document（资料）

# 8. Workload（工作量）

|JsonColumn以及JsonType改造|3人天|
|---|---|
|原json函数适配|2人天|
|与存储联调|2人天|
|测试用例|1人天|
|Yason注入分配器|5人天|
|缓冲|1人天|


# 6. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-6-28_10-15-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGVhMWFkOWEzMzExZGM3ZTI5IiwicmVmX2lkIjoiNjczOTZhZGQ1OTNmOTljOWZmMjM1YWQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTcyLCJleHAiOjE3ODIzNzU5NzJ9.7qodw1gjrzpTanIo31vgnfylvB8sY21Y2xxmiuzeJDU)

 (image/png)    


[image2023-6-5_17-58-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGU4OTcwYzJhZjRmNTFmZmIyIiwicmVmX2lkIjoiNjczOTZhZGQ1OTNmOTljOWZmMjM1YWQ2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTcyLCJleHAiOjE3ODIzNzU5NzJ9.wBPtsFdEpjBTUDupIX-lRQuNl68d1W6juD_DafMgF8Y)

 (image/png)    


## Comments:

|  [](null)  ,在GAT支持生命周期之后，Json本身的Native可以拿到OutlineBuf，因此之前为JsonType做特化的逻辑就可以删除掉了，特化的方案也就不需要了,  
,Posted by wangrensong at 六月 06, 2024 16:09|
|---|
