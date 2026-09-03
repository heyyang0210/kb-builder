Created by 胡威振, last modified on 十一月 24, 2023

详细设计-YDBRD-38942: 分布式substring和substr函数支持outline lob Design（分布式substring函数支持outline lob方案设计）

IR链接：  [https://pingcode.yasdb.com/ship/ideas/67c800711349f73b35dbe49b?](https://pingcode.yasdb.com/ship/ideas/67c800711349f73b35dbe49b?)  

SR链接：  [https://pingcode.yasdb.com/pjm/items/67d146d56dccc3daa3166162?](https://pingcode.yasdb.com/pjm/items/67d146d56dccc3daa3166162?)  

##   [1. 总述](#1-总述)  

该文档设计了单机和分布式场景列执行的substring和substr函数支持outline lob数据。

###   [1.1 需求来源](#11-需求来源)  

市总工会-智慧工会项目。

支持单机、分布式的列执行。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|
|---|---|---|
|SELECT SUBSTRING(c, 1, 4) FROM table;|c为clob类型，且为outline。|支持对outline lob取子串操作|
|SELECT SUBSTR(c, 1, 4) FROM table;|c为clob类型，且为outline。|支持对outline lob取子串操作|


##   [3. 规格与约束](#3-规格与约束)  

1.不支持输出的长度超过32000

##   [4. 特性](#4-特性)  

调用存储获取lob长度以及子串的相关接口来实现计算。

###   [4.1 特性设计](#41-特性设计)  

**1.封装一个获取子串的的要读取的最大字节和读取子串的接口**

```
// 计算要读取的最大字节数，按照当前字符集的单个最大字节数与字符个数的乘积来算。
CodResult anlLobSubStrReadSize(AnlStmt* stmt, Variant* srcLob, CodUint64 lobLen, CodUint64 location, CodUint32 length, CodUint64* readSize)
{
    VarLobHead* srcLobHead = ((VarLobHead*)srcLob->vLob.data);
    CodBool     isMultiChar = (srcLobHead->charLen == 0);
    CodUint16   envCharset = (srcLob->type == DTYPE_NCLOB) ? ANL_VARENV->nCharset : ANL_VARENV->charset;
    CodUint32   readMbLen = (isMultiChar ? codTextMaxCharWidth(envCharset) : srcLobHead->charLen);

    if (location + length > lobLen) {
        length = (CodUint32)(lobLen - location);
    }
    *readSize = MIN(ANS_MAX_STRING_LEN, length * readMbLen);
    return COD_SUCCESS;
}
// 获取lob的子串，返回的数据是inline，存在res中，其中res的内存在外面需要分配好。
CodResult anlLobSubStrInline(AnlStmt* stmt, Variant* srcLob, CodUint64 location, CodUint64* readSize, CodChar* res)
{
    VarLobHead* srcLobHead = ((VarLobHead*)srcLob->vLob.data);
    CodBool     isMultiChar = (srcLobHead->charLen == 0);
    CodUint16   envCharset = (srcLob->type == DTYPE_NCLOB) ? ANL_VARENV->nCharset : ANL_VARENV->charset;
    CodUint32   readMbLen = (isMultiChar ? codTextMaxCharWidth(envCharset) : srcLobHead->charLen);
    CodUint64   offsetB = 0;

    if (isMultiChar) {
        COD_CALL(ankVarLobLocatePos(stmt->handler->khdlr, &srcLob->vLob, location, &offsetB));
    } else {
        offsetB = location * readMbLen;
    }
    COD_CALL(ankVarLobRead(stmt->handler->khdlr, &srcLob->vLob, offsetB, readSize, res));
    return COD_SUCCESS;
}
```

**2.给LobReader trait增加substr_read_size和substr接口，用于在anchorbase中调用上面增加的anlLobSubStrReadSize和anlLobSubStrInline来获取子串。**

```
fn substr_read_size(&mut self, lob_len: usize, location: i32, length: i32) -> Result<usize>;
fn substr(&mut self, location: i32, read_size: &mut usize, buf: &mut [u8]) -> Result<()>;
```

**3.给crab中的LobReader结构体增加sub_str和sub_str_charset接口，分别计算utf8字符集和GB18030字符集的lob子串。**

```
#[inline]
pub fn substr(
  &self,
  data: &Lob,
  lob_len: usize,
  location: i32,
  length: i32,
  lob_buf: &mut LobBuf,
) -> Result<usize> {
  let mut reader = self.lob_handle()?.open(data)?;
  let mut read_size = self.substr_read_size(data, lob_len, location, length)?;
  if read_size > MAX_STRING_LEN {
    return Err(Error::ExprEvaluateError(
      "unsupported output outline line lob".try_to_string()?,
    ));
  } else if read_size == 0 {
    return Ok(0);
  }
  let mut buf = Buffer::alloc(&self.alloc, read_size)?;
  let mut res_buf = &mut buf.as_bytes_mut()[..read_size];
  reader.substr(location, &mut read_size, &mut res_buf)?;
  let str = unsafe { std::str::from_utf8_unchecked(&buf.as_bytes()[..read_size]) };
  lob_buf.append_str(str)?;
  Ok(read_size)
  }

pub fn substr_charset<C: Charset>(
  &self,
  data: &Lob,
  lob_len: usize,
  location: i32,
  length: i32,
  lob_buf: &mut LobBuf,
) -> Result<usize> {
  let mut reader = self.lob_handle()?.open(data)?;
  let mut read_size = self.substr_read_size(data, lob_len, location, length)?;
  if read_size > MAX_STRING_LEN {
    return Err(Error::ExprEvaluateError(
      "unsupported output outline line lob".try_to_string()?,
    ));
  } else if read_size == 0 {
    return Ok(0);
  }
  let mut buf = Buffer::alloc(&self.alloc, read_size)?;
  let mut res_buf = &mut buf.as_bytes_mut()[..read_size];
  reader.substr(location, &mut read_size, &mut res_buf)?;
  let rstr = RStr::from_bytes(&buf.as_bytes()[..read_size]);
  lob_buf.append_rstr::<C>(rstr)?;
  Ok(read_size)
  }
```

** 4.给substring的BoundSubstringClob和BoundSubstringClob3实现outline lob的计算。**

```
// 主要是在获取lob数据之后判断是否是inline，如果不是的话就通过lobReader来调用上面增加的接口。
if value.is_inline() {
  self.substr(value.inline_data()?, &mut result)?;
} else {
  self.substr_outline(value, &mut result)?;
}
```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1.输入的clob长度小于32000。

2.输入的clob长度小于32000但是采用行外存储的方式。

3.输入的clob长度超过32000并且截取长度小于32000。

4.输入的clob长度超过32000并且截取长度大于32000（预期报错）。

5.与其他函数的嵌套以及自嵌套。

6.location的边界值，负数、0、正数、超过clob长度的数。

7.多字节字符。

**8.create table as、insert into、delete、update场景验证。**

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

后续将支持输出长度超过32000的场景。