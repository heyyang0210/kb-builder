

  [https://pingcode.yasdb.com/pjm/items/67c912b07ce85d5a07574c4c?](https://pingcode.yasdb.com/pjm/items/67c912b07ce85d5a07574c4c?)  

#YDBRD-38762 支持to_single_byte函数



# 1 设计简介

TO_SINGLE_BYTE函数用于将字符串中的多字节字符(全角字符)转换为等价的单字节字符(半角字符)。



# 2 特性概述

支持TO_SINGLE_BYTE函数，用于全角字符转换成半角字符，在处理包含中日韩等字符集的数据库时特别有用，因为这些字符集通常包含全角和半角字符的对应关系。

### 1.4 数据字典

```
TO_SINGLE_BYTE ( char )

参数：
char：支持字符类型(CHAR, VARCHAR, NCHAR, NVARCHAR),返回输入相同字符类型。
```

# 3 方案分析（可选）

*概要设计中已经系统性阐述的，本章节可以省略，或根据特性设计中对场景的扩展进行补充。没有概要设计的，本章节需要做分析。*



## 3.1 业内方案分析（可选）

*该特性在业内的实现机制，对比分析，优劣性对比。*

*旧版本中需求调研独立文档承载，新版本中在概要设计中阐述。*



## 3.2 外部依赖分析（可选）

*开源及第三方软件使用选型影响分析，重点描述本特性需要引入的开源及第三方软件的选型影响分析。*

*需要附加软件管理委员会评审结论。*



# 4 特性设计

|约束||
|---|---|
|只支持YashanDB数据库当前指定字符集，不支持字符串类型输入设置字符集|创建数据库时指定字符集，后续无法更改。|
|国家字符集（NCHAR, NVCHAR）仅支持为UTF-16，建库时指定，后续无法更改。||
|当数据库字符集同时包含单字节和多字节字符时，函数才能生效。||
|char支持字符类型(CHAR, VARCHAR, NCHAR, NVARCHAR)|函数返回传入字符类型|
|char支持所有能隐式转换成字符类型的数据类型，返回 VARCHAR 字符类型。|不能转换字符类型的数据类型会报错。|
|不支持CLOB类型，CLOB类型可以通过隐式数据转换作为参数传入||
|TO_SINGLE_BYTE当前不支持列执行crab||


### 4.1 新增窗口函数定义:

   1.  gBuiltinMethods 内置函数定义里面新增 TO_SINGLE_BYTE窗口函数定义:

```
  {BIF_DECL("TO_SINGLE_BYTE", ToSingleByte, 1, 1), .aggrId = COD_INVALID_ID8, .inclFlags = BIF_TRAIT_DBLINK_PUSHABLE | BIF_TRAIT_DETERMINISTIC},
```



### 4.2 内置函数实现接口:

  1. 新增TO_SINGLE_BYTE窗口函数 verify, conclude,exec功能函数接口.

  2. verify，conclude 实现接口 bifVerifyToSingleByte，bifConcludeToSingleByte，函数判断当前输入是否字符类型，并且设置返回数据类型与输入相同字符类型。

  3. exec 实现接口 bifExecToSingleByte， 函数获取当前数据库字符集，根据字符集调用 gCollation 字符集对应 toSingleByte 转换接口转换输入字符串。

### 4.3 gCollation toSingleByte接口实现:

   1. yashandb数据库当前支持 ASCII，GBK，UTF8，ISO88591，UTF16，GB18030 6种字符集类型。

       1.  ASCII，ISO88591 为单字节字符集，不用处理转换。

       2.  GBK，GB18030  采用相同字节编码，用统一的 gbkToSingleByte 转换实现函数。

       3.  UTF8 需要解码为 Unicode 双字节编码，与 UTF16 使用相同Unicode 全角转半角处理函数。

   2. gbkToSingleByte  字符集全角转半角处理逻辑:

       1. GBK字符集双字节首字节为 0xA3 为全角字符，转换处理：丢弃首字节，清除第二个字节最高位。

       2. GBK字符集首字节和第二个字节都是 0xA1, 转换成 ASCII 0x20 空格字符。 

```
#define GBK_MULTI_HIGH_BYTE     0xA3
#define GBK_MULTI_SPACE_BYTE    0xA1
#define GBK_CLEAR_HIGHEST_BIT   0x7F
#define ASCII_SAPCE_BYTE        0x20

CodVoid gbkToSingleByte(CodText* srcText, CodText* dstText)
{
    CodUchar* src = (CodUchar*)srcText->str;
    CodUchar* dst = (CodUchar*)dstText->str;
    CodUchar* end = (CodUchar*)srcText->str + srcText->len;
    CodUint32 l;
    CodUchar  singleByte;

    while (src < end) {
        l = isGbkChar(src, end);
        if (l == 0) {
            *dst++ = *src++;
        } else {
            if ((CodUint8)*src == GBK_MULTI_HIGH_BYTE && (CodUint8)*(src + 1) >= GBK_MULTI_SPACE_BYTE) {
                singleByte = (*(src + 1) & GBK_CLEAR_HIGHEST_BIT);
                *dst++ = singleByte;
                src += l;
            } else if ((CodUint8)*src == GBK_MULTI_SPACE_BYTE && (CodUint8)*(src + 1) == GBK_MULTI_SPACE_BYTE) {
                *dst++ = ASCII_SAPCE_BYTE;
                src += l;
            } else {
                *dst++ = *src++;
                *dst++ = *src++;
            }
        }
    }
    dstText->len = (CodUint32)(dst - (CodUchar*)dstText->str);
}
```

    3.  Unicode 双字节转换处理函数 codWCharToSingle：

        1. 在 Unicode 中，全角字符的编码范围为 0xFF01 至 0xFF5E , 与半角字符对应关系为相差 0xFEE0 (65248) (全角编码 = 半角编码 + 65248).

         2. 全角空格为单独的 0x3000, 需要转换成半角的 0x2000.

```
#define MAX_UNICODE_PAGE        0xFFFF
#define UNI_MULTI_SPACE_BYTE    0x3000
#define UNI_SINGLE_SPACE_BYTE   0x0020
#define UNI_MULTI_START_BYTE    0xFF01
#define UNI_MULTI_END_BYTE      0xFF5E
#define UNI_MULTI_SINGLE_DIV    0xFEE0

CodWChar codWCharToSingle(CodWChar wc)
{
    if (COD_UNLIKELY(wc > MAX_UNICODE_PAGE)) {
        return wc;
    }

    if (wc == UNI_MULTI_SPACE_BYTE) {
        return UNI_SINGLE_SPACE_BYTE;
    } else if (wc >= UNI_MULTI_START_BYTE && wc <= UNI_MULTI_END_BYTE) {
        return wc - UNI_MULTI_SINGLE_DIV;
    }
  
    return wc;
}
```



### 4.4 安全性设计

*不涉及安全相关的，可以不用详细展开。对于涉及安全威胁分析及设计的，根据安全设计方法，数据流图、业务场景以及信任边界进行分析说明。具体方法有：*

|*分析手段*|*安全分析点*|
|---|---|
|*外部交互分析*|*需要关注仿冒、抵赖相关威胁分析。*|
|*数据流分析*|*需要关注篡改、信息泄露、拒绝服务分析。*|
|*处理过程分析*|*需要关注仿冒、篡改、抵赖、拒绝服务、权限提升分析。*|
|*数据存储分析*|*需要关注篡改、抵赖、信息泄露、决绝服务分析。*|




# 5 资料设计



# 6 自测用例设计

测试方案设计: 

|测试项目||预期||
|---|---|---|---|
|db配置gbk字符集, 验证to_single_byte 字符串，字符串包含ascii码可转换全角字符，0 -9, a-z, A-Z, 空格，可转换标点符号 (比如！？＞＠ ), 中文字符，半角字符||转换成半角字符||
|验证 to_single_byte 输入 null, ''空字符。||输出空||
|db配置utf8字符集, 验证to_single_byte 字符串，字符串包含ascii码可转换全角字符，0 -9, a-z, A-Z, 空格，可转换标点符号 (比如！？＞＠ ), 中文字符，半角字符||转换成半角字符||
|验证to_single_byte 国表字符串(NCHAR, NVCHAR)，字符串包含ascii码可转换全角字符，0 -9, a-z, A-Z, 空格，可转换标点符号 (比如！？＞＠ ), 中文字符，半角字符||转换成半角字符||
|验证 to_single_byte 输入ascii码单字符||输出原结果||


# 7 参考资料（非必选）



