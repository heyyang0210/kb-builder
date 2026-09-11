Created by 吴煜, last modified on 六月 25, 2024

*详细设计-YDBRD-26599 : 支持UTL_I18N内置系统包*

PINGCODE：    [https://pingcode.yasdb.com/pjm/items/66271e31fd997db58adf6151](https://pingcode.yasdb.com/pjm/items/66271e31fd997db58adf6151)    ?    
  #YDBRD-26599 支持UTL_I18N内置系统包

##   [1. 总述](#1-总述)  

支持支持UTL_I18N内置系统包，实现RAW跟字符串的类型转换；

###   [1.1 需求来源](#11-需求来源)  

产品化需求，兼容ORACLE。

需要支持的部署形态包括:

- 单机
- 分布式
- 集群


###   [1.2 调研文档](#12-调研文档)  

有两种实现方式A：通过oracle解析出UTL_I18N内置系统包的sql源码，在system_packages.sql中加入转换后yashan能执行的sql源码B：通过C函数实现，定义在BIP文件中，通过C语言代码实现函数功能

优点A：复刻oracle功能，后续基本不会出问题B：流程清晰可控缺点A：高级包SQL源码转换有更多的语法不兼容，需要工作量去转换B：需要更细致的自测

本文档采用方式B来实现

###   [1.3 需求分析](#13-需求分析)  

该特性实现string_to_raw和raw_to_char两个子函数。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|将VARCHAR2或NVARCHAR2字符串转换为另一个字符集。结果作为RAW数据类型返回|高级包子函数|是|是|
|功能|RAW将数据库字符集中未编码的数据转换为VARCHAR2字符串|高级包子函数|是|是|
|可维可测|查看输出结果||是|是|
|兼容性|||否|否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|raw|  `RAW`     是一种原始数据类型，用于存储固定长度的二进制数据，它是一种无格式的数据类型|是|  [oracle术语描述](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/UTL_I18N.html#GUID-B5D5A4C8-F55E-4DA2-B2FA-3F81A89451FF)  |
|CHARACTER SET ANY_CS|允许数据来自于任何数据集|||


oracle与yashan的数据类型比较

  [https://conf.yasdb.com/pages/viewpage.action?pageId=107390710](https://conf.yasdb.com/pages/viewpage.action?pageId=107390710)  

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级包|UTL_I18N.RAW_TO_CHAR(a,'b')|将raw类型的数据a转换成b字符集格式的char|是|
|高级包|UTL_I18N.STRING_TO_RAW(s,'b')|将b字符集格式的string s 转换成raw|是|
|系统视图|||否|
|配置参数|||否|
|日志|||否|


##   [3. 规格与约束](#3-规格与约束)  

新增以下规格/约束:

|规格/约束|描述|说明|备注|
|---|---|---|---|
|规格|如果用户指定了无效的字符集、字符串    `NULL`    或长度为 0 的字符串，则该函数返回一个    `NULL`    字符串。|兼容oracle||
|规格|yashan有效的字符集 UTF8,UTF16, GBK, GB18030, ISO88591|是否兼容oracle||
|约束|目前只支持RAW_TO_CHAR、STRING_TO_RAW两个子函数|||
|约束|STRING_TO_RAW中  RAW的规格为8000|||
||RAW_TO_CHAR中     入参最大值为8000|||
|规格|对于不符合字符集的转换会报错，不会返回乱码|oracle会返回乱码||


##   [4. 特性](#4-特性)  

###   [4.1 高级包子函数](#41-高级包子函数)  

####   [STRING_TO_RAW 子函数](#string-to-raw-子函数)  

```
UTL_I18N.STRING_TO_RAW( 
   data          IN VARCHAR2 CHARACTER SET ANY_CS,
   dst_charset   IN VARCHAR2 DEFAULT NULL)
RETURN RAW;

```

此函数将    `VARCHAR2`    字符串转换为另一个有效的 字符集，并将结果作为    `RAW`    数据返回。

|参数|描述|
|---|---|
|  `data`  |待转换的    `VARCHAR2`    或    `NVARCHAR2`    字符串。|
|  `dst_charset`  |指定目标字符集。如果    `dst_charset`    是    `NULL`    ，则取当前数据库字符集用于字符数据，国家字符集用于     `NCHAR`     数据。|
|  `RAW`    返回值|待转换字符串在目标字符集的RAW类型表示。|


####   [RAW_TO_CHAR 子函数](#raw-to-char-子函数)  

缓冲区转换

```
UTL_I18N.RAW_TO_CHAR(
   data          IN RAW,
   src_charset   IN VARCHAR2 DEFAULT NULL)
 RETURN VARCHAR2;

```

分段转换 (阿里云、金仓、ob都未提供)

实现参数out 但不支持分段转换，保持转换原子性

```
UTL_I18N.RAW_TO_CHAR (
   data            IN RAW,
   src_charset     IN VARCHAR2 DEFAULT NULL)
RETURN VARCHAR2;

```

|范围|描述|
|---|---|
|  `data`  |指定    `RAW`    要转换为    `VARCHAR2`    字符串的数据|
|  `src_charset`  |  `RAW`    指定数据所源自的字符集。如果 src_charset 为    `NULL`    ，则取当前数据库字符集。|
|  `VARCHAR2`    返回值|RAW数据转换的VARCHAR2字符串。|


###   [4.2 函数实现](#42-函数实现)  

####   [新增高级包 UTL_I18N](#新增高级包-utl-i18n)  

1. 在gBuiltinPackages里新增一个高级包的定义;
1. 为高级包新建一个.c文件，里面使用宏BIP_DECL()定义对应的高级包，.h文件里面使用宏BIP_EXTERNAL_DECL()暴露对应的高级包;


####   [定义子函数](#定义子函数)  

1.函数定义

```
BIP_METHOD_DECL(UtlI18n, Raw2Char, 2, 4, COD_TRUE);
BIP_METHOD_DECL(UtlI18n, String2Raw, 2, 2, COD_FALSE);

```

2.函数参数定义

```
BIP_FUNC_ARGS_DEC_BEGIN(UtlI18n, RAW_TO_CHAR)
BIP_FUNC_ARGS("DATA", BIP_INVAL, COD_TRUE, DTYPE_RAW, COD_TEXT_DEF(""))
BIP_FUNC_ARGS("SRC_CHARSET", BIP_INVAL, COD_TRUE, DTYPE_VARCHAR, COD_TEXT_DEF(""))
BIP_FUNC_ARGS("SCANNED_LENGTH", BIP_INVAL, COD_FALSE, DTYPE_BIGINT, COD_TEXT_DEF(""))
BIP_FUNC_ARGS("SHIFT_STATUS", BIP_INVAL, COD_FALSE, DTYPE_BIGINT, COD_TEXT_DEF(""))
BIP_FUNC_ARGS_DEC_END

```

```
BIP_FUNC_ARGS_DEC_BEGIN(UtlI18n, STRING_TO_RAW)
BIP_FUNC_ARGS("DATA", BIP_INVAL, COD_TRUE, DTYPE_VARCHAR, COD_TEXT_DEF(""))
BIP_FUNC_ARGS("DST_CHARSET", BIP_INVAL, COD_TRUE, DTYPE_VARCHAR, COD_TEXT_DEF(""))
BIP_FUNC_ARGS_DEC_END

```

####   [子函数实现](#子函数实现)  

1.bipVerifyRaw2Char(AnlVerifier* vrfr, ExprNode* node) / bipVerifyString2Raw(AnlVerifier* vrfr, ExprNode* node)

​	校验高级包参数是否为空

2.bipExecRaw2Char(AnlStmt* stmt, ExprNode* node, Variant* retValue) / bipExecString2Raw(AnlStmt* stmt, ExprNode* node, Variant* retValue)

​	具体实现相关功能

​		1.拿到入参具体值,检验字符集参数是否合法,入参个数是否合法只能是2个或者4个

​		2.进行转换execVarConvertSafe,字符集先转换成touni后fromuni，以unicode为中介做转换

​		3.定义返回值,调用returnOutVar

3.bipConcludeRaw2Char(AnlStmt* stmt, ExprNode* node, TypeDesc* retType) / bipString2Raw(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)

​	参数retValue用作返回值

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|功能|场景|预期|备注|
|---|---|---|---|
|RAW_TO_CHAR|RAW转换成字符串之缓冲区转换|预期返回正确结果|UTL_I18N.RAW_TO_CHAR(hextoraw('616263646566C2AA'), 'utf8')|
|STRING_TO_RAW|字符串转换成RAW|预期返回正确结果||
|用户指定了无效的字符集、字符串    `NULL`    或长度为 0 的字符串||返回一个NULL字符串||


##   [6.资料设计章节](#6资料设计章节)  

1. UTL_I18N高级包的描述
1. 高级包子函数STRING_TO_RAW 和RAW_TO_CHAR 的描述


##   [7. 工作量](#7-工作量)  

##   [8.未来规划](#8未来规划)  

## Comments:

|  [](null)  ,会议纪要,时间5.24  地点1002,人员：吴煜、何阳、王海峰、董灵林、赵育、杜卓林,内容：确定  RAW_TO_CHAR子函数中  入参 raw规格,           分段转换功能先不做,Posted by wuyu at 五月 24, 2024 11:23|
|---|
