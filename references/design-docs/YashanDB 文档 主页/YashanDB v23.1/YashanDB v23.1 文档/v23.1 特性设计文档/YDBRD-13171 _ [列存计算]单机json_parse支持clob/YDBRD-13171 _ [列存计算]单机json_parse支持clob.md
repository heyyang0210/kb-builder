Created by 王仁松 on 十月 12, 2023

SR：    [YDBRD-13171](https://jira.yasdb.com/browse/YDBRD-13171?src=confmacro)    -  [列存计算] 单机json_parse支持clob  完成

# 1. Overview（概述）

1. json_parse 支持clob
1. 输出的json最大不能超过32MB
1. 用连续内存存储
1. 读大json


# 2. Features（功能特性）

1.  json_parse支持clob类型的输入的解析
1. 支持输出解析后的大json


# 3. Interfaces（接口）

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

# 4. Specification And Constraints（规格与约束）

1. 列存json_parse最大支持到32MB。


# 5. Detail Design（详细设计）

## 5.1 Crab json函数支持大json

### 5.1 大lob的访问

在sr 13172中已经设计。

### 5.2.1 列转行方案

使用memlob发送给客户端

memlob新增类型：

```
typedef enum EnMemLobType {
    MEM_LOB_SQL_TEXT,
	MEM_LOB_CRAB_COL,
    __MEM_LOB_TYPE_COUNT__
} MemLobType;
```

对应读取接口：

```
static MemLobProc gMemLobProcs[__MEM_LOB_TYPE_COUNT__] =
{
    [MEM_LOB_SQL_TEXT] = {
        .getLengthb = anlSqlTextLengthb,
        .read = anlReadSqlText
    },
    [MEM_LOB_CRAB_COL] = {
        .getLengthb = anlCrabMemLobLengthb,
        .read = anlReadCrabMemLob
    },
};
```

对应的在Crab实现，以及在anchorbase代码中实现对应的读取接口以及释放接口：

```
/// # Safety
#[no_mangle]
pub unsafe extern "C" fn cReadCrabMemLob(
    handler: *mut AnlHandler,
    locator: u64,
    offset: u64,
    size: *mut u64,
    buf: *mut u8,
) -> i32 {
    let f = || {
        read_mem_lob(
            handler.into(),
            locator,
            offset,
            &mut *size,
            std::slice::from_mut(&mut *buf),
        )
    };
    catch_alloc_error!(f)
}

/// # Safety
#[no_mangle]
pub unsafe extern "C" fn cCloseCrabMemLob(handler: *mut AnlHandler, locator: u64) -> i32 {
    let f = || release_mem_lob(handler.into(), locator);
    catch_alloc_error!(f)
}

/// # Safety
/// No memory alloc
#[no_mangle]
pub unsafe extern "C" fn cEndColMemLobCache(handler: *mut AnlHandler) {
    end_col_cache(handler.into());
}
```

对应的释放时机在yacJson2String中，从server->crab中读取结束后即可调用cReadCrabMemLob释放。

### 5.2.2 Yason支持allocator的注入

方案一：将代码中所有的使用到Vec<u8>的地方改为类似于std::io::Write/Read这种形式，支持自定义的输入输入流进行Yason相关的使用。优点：优化明显，支持后续开发的可能的扩展以及适应性。缺点：涉及面广，影响面大，改动点多，工作量太大。

```
pub fn parse_to<T: AsRef<str>, W: Write>(bytes: &mut W, str: T, extended: bool) -> BuildResult<&Yason>
···
pub struct YasonBuf<W: Write> {
    bytes: W,
}
···
pub struct ArrayRefBuilder<'a, W: Write>(pub(crate) InnerArrayBuilder<'a, &'a mut W);
pub struct ObjectRefBuilder<'a, W: Write>(pub(crate) InnerObjectBuilder<'a, &'a mut W);
```

  


方案二：将代码中所有的使用到Vec<u8>的地方改为Vec<u8, Allocator>的形式，天然兼容原来的代码，因为Vec本身就持有alloc。优点：改动点小，工作量小，兼容旧代码。缺点：引入Allocator，需要用nightly编译。

```
pub fn parse_to<T: AsRef<str>, A: Allocator>(bytes: &mut Vec<u8, A>, str: T, extended: bool) -> BuildResult<&Yason>
···
pub struct YasonBuf<A: Allocator> {
    bytes: Vec<u8, A>,
}
···
pub struct ArrayRefBuilder<'a, A: Allocator>(pub(crate) InnerArrayBuilder<'a, &'a mut A);
pub struct ObjectRefBuilder<'a, A: Allocator>(pub(crate) InnerObjectBuilder<'a, &'a mut A);
```

使用Vec<u8>的地方总计107处，17个文件的修改。

### 5.2.3 自测

确认走列存的json_parse。

```
drop table if exists t1;
create table t1(c1 int, c2 clob) organization tac;
insert into t1 values(1, '"abc"');
select json(c2) from t1;
drop table t1;
```

  


# 6. Testcases（自测用例）

- 跑过门禁、二层ci现有用例；
- 补充json_parse解析使用outline lob形式存储的clob的用例；


# 7. Document（资料）

# 8. Workload（工作量）

|Yason注入分配器|2人天|
|---|---|
|json_parse支持clob|1人天|
|自测test|1人天|
|  
|  
|
|  
|  
|
|  
|  
|


# 6. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-6-28_10-21-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGQ4OTcwYzJhZjRmNTFmZmFmIiwicmVmX2lkIjoiNjczOTZhZGQ1OTNmOTljOWZmMjM1YWQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTY4LCJleHAiOjE3ODIzNzU5Njh9.hT4Oh0RFA_uIVaJsXZMijMXgFSkCYQlqK4P95Bkl-yg)

 (image/png)    


[image2023-6-28_10-15-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGRhMWFkOWEzMzExZGM3ZTI2IiwicmVmX2lkIjoiNjczOTZhZGQ1OTNmOTljOWZmMjM1YWQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTY4LCJleHAiOjE3ODIzNzU5Njh9.TWEe43McW1C5Z8zPwTyPx6SEnSyOS8K--wN1PR5GZL4)

 (image/png)    


[image2023-6-27_10-42-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGQ4OTcwYzJhZjRmNTFmZmIwIiwicmVmX2lkIjoiNjczOTZhZGQ1OTNmOTljOWZmMjM1YWQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTY4LCJleHAiOjE3ODIzNzU5Njh9.m2B84wS5RBaGut8-AAnILm3Agwztn68yRcbX3ntktDQ)

 (image/png)    


[image2023-6-25_10-55-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGRhMWFkOWEzMzExZGM3ZTI3IiwicmVmX2lkIjoiNjczOTZhZGQ1OTNmOTljOWZmMjM1YWQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTY4LCJleHAiOjE3ODIzNzU5Njh9.CghUlKecy6irrq4CoQ0O7ukt3bG4rel5DikF_B48X8M)

 (image/png)    


[image2023-6-5_17-58-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGRhMWFkOWEzMzExZGM3ZTI4IiwicmVmX2lkIjoiNjczOTZhZGQ1OTNmOTljOWZmMjM1YWQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTY4LCJleHAiOjE3ODIzNzU5Njh9.VZRrHFEcmQuPS9sZtjogEUzTP6chU1wnobSDD4nuGxw)

 (image/png)    
