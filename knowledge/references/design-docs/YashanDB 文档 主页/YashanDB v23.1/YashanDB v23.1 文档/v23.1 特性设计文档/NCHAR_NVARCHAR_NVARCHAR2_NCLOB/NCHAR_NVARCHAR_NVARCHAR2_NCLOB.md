Created by 陈敬厅 on 七月 17, 2023

IR链接：    [[YDBRD-219] 【单机】支持NCHAR/NVARCHAR数据类型 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-219)  

SR链接：    [[YDBRD-4263] 支持支持NCHAR/NVARCHAR/NVARCHAR2/NCLOB数据类型 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-4263)  

# 1. Overview（概述）

本设计目的为YashanDB提供NCHAR/NVARCHAR/NVARCHAR2/NCLOB数据类型，并支持在此数据类型上的操作和运算，NCHAR/NVARCHAR/NCLOB在功能上类似CHAR/VARCHAR/VARCHAR2/CLOB。

# 2. Features（功能特性）

## 2.1 基础语法功能

- 建表：create table t1 (c1 nvarchar(4000)); 指定c1的数据类型为nvarchar，并同时指定其长度为4000，其可以存4000个英文字符或者中文汉字。
- 插入：insert into t1 values ('中中中中中中中中中');，插入不超过列长度的中文字符或英文字符。
- 查询：select c1 from t1; 查询nvarchar的列。
- 更改数据类型：alter table t1 modify c1 varchar(4000); 更改nvarchar的列为varchar类型，反之操作亦可。
- 删除nvarchar的列：alter table t1 drop column c1。
- 增加nvarchar的列：alter table t1 add c2 nvarchar(4000);
- 类型比较，select c1 from t1 order by c1;
- 在PLSQL中使用。
- 隐式类型转换


......

## 2.2 与内置函数结合，可以进行字符串连接、截取、转换等操作

- 使用length函数获取nvarchar变量的长度。
- 使用substr函数从nvarchar变量中提取子字符串。
- 使用upper函数将nvarchar变量中的字符转换为大写。
- 使用concat函数连接两个varchar2变量。
- 使用cast显式类型转换


.....

## 2.3 支持unicode字符集，默认以UTF16编码

nvarchar类型是用以支持国家字符集的数据类型，国家字符集是数据库增强字符处理能力的特性，nvarchar用以存储unicode字符，默认以utf16编码格式存放数据。

## 2.4 可变长度，与varchar相同，存储时只占用实际长度所需空间，最大长度为4000个字符

## 2.5 存储多语言数据：由于 NVARCHAR 使用的是 Unicode 编码，因此可以存储多语言数据，包括中文、日文、韩文等等

## 2.6 区分大小写，大小写敏感

## 2.7 支持为NVARCHAR列建索引

# 3. Interfaces（接口）

## 1.UTF16字符排序、大小写转换、字符比较、计算长度等接口

![](https://pingcode.yasdb.com/atlas/files/public/67396a3a8970c2af4f51fd32/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBQUFBZ0FBQUFBQUFBSUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUJBQVFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE5MTYsImV4cCI6MTc4MjIyMjcxNn0.uttZJjR-A8aPo155YEoPQQcbg34KF-cnSTKersOjKak)

![](https://pingcode.yasdb.com/atlas/files/public/67396a3aa1ad9a3311dc7ba9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBQUFBZ0FBQUFBQUFBSUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUJBQVFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE5MTYsImV4cCI6MTc4MjIyMjcxNn0.uttZJjR-A8aPo155YEoPQQcbg34KF-cnSTKersOjKak)

## 2.相关配置，参数设置，视图更新

### 1.数据库字符集配置

通过配置文件设置国家字符集配置参数，在yasdb.ini文件中预先写入：NLS_CHARACTER_SET=UTF16，可以设置国家字符集的编码格式。

通过建库语句配置国家字符集：在建库时通过sql语句配置数据库的编码格式：  create database test character set utf8/gbk/ascii/iso88591/utf16，不用此方法设置整个数据库的编码格式为UTF16，会导致所有地方都使用UTF16  编码，可能会有不兼容和乱码问题。使用create database test national character set utf16/utf8.

### **2.客户端字符集配置**

~~通过修改客户端环境变量文件yasc_env.ini设置客户端字符集，在文件中写入：NLS_CHARACTER_SET=UTF16。（不支持）~~

### **3.相关视图配置**

ALL_TAB_COLS、ALL_ARGUMENTS、ALL_COLL_TYPES、ALL_TYPE_ATTRS、DBA_TAB_COLS、DBA_ARGUMENTS、DBA_COLL_TYPES、DBA_TYPE_ATTRS、USER_TAB_COLS、USER_ARGUMENTS、USER_COLL_TYPES、USER_TYPE_ATTRS、V$DATATYPE等

JDBC相关metadata排查，是否需要变动。

### **4.相关参数配置**

使用show parameter NLS_CHARACTER_SET;显示当前国家字符集配置参数。

......

### 5.国家字符集设置写入控制文件

启动数据库时校验配置参数的合法性。

  


### 6.jdbc接口

涉及改动的接口：setString，setNtring，setClob，getClob，getNString，getString。其中setNtring/getNString为本次新增接口。

### 7.C驱动接口

涉及接口：

yacBindParameter：支持绑定为任何可转换类型插入到NVARCHAR列，支持绑定为字符串类型插入到NCLOB列

yacBindColumn：支持从NVARCHAR列fetch到任何可转换类型，支持从NCLOB列fetch到字符串类型

yacLobRead：支持从NCLOB列读取字符串

yacLobWrite：支持向NCLOB列写入字符串

# 4. Specification And Constraints（规格与约束）

## 1.NCHAR

NCHAR最大长度为当前存储单列的最大长度。nchar（n)，n代表字符长度，不代表字节长度。

NCHAR当前最大支持4000长度，即4000字符。

  


## 2.NVARCHAR

NVARCHAR最大长度为32000字节。

NVARCHAR当前最大支持16000长度，即16000字符。

## 3.NVARCHAR2

NVARCHAR2最大长度为32000字节。

NVARCHAR当前最大支持16000长度，即16000字符。

NVARCHAR2与NVARCHAR同义。

## 4.NCLOB

~~NCLOB最大长度为32000字节。后面不跟n指定字符长度。（）~~

（跟clob保持一致的长度即可）

以后的clob默认按照nclob处理（utf16）。

NCLOB长度与CLOB保持一致

## 5.内置函数规格

目前group_concat/wm_concat/listagg/string_agg函数不支持，其他内置函数参照char/varchar/clob支持特性，同样支持。内置函数md文档目前没有更新，其他有关national char的文档也没有更新。

## 6.类型提升规格

一般而言，在national char和其他类型做计算、拼接、转换的时候，会优先提升为national char类型，长度计算会按照national char的规则进行计算。

对有规定返回值类型的内置函数而言，入参为national char时其返回值仍保持自身的返回类型。

nclob在和nvarcahr nchar拼接时会返回nclob类型。

规格参照oracle中national char的规格。

## 7.视图

目前更新了系统视图和用户视图，即建库时所建的包含在yasdb_home/admin/下的视图，包括ALL_TAB_COLS、ALL_ARGUMENTS、ALL_COLL_TYPES、ALL_TYPE_ATTRS、DBA_TAB_COLS、DBA_ARGUMENTS、DBA_COLL_TYPES、DBA_TYPE_ATTRS、USER_TAB_COLS、USER_ARGUMENTS、USER_COLL_TYPES、USER_TYPE_ATTRS。其他V$、DV$等其他视图并未更新。

## 8.语法功能

与char/varchar/clob对齐，长度参照上述规格。列存目前不支持national char

## 9.PLSQL

PLSQL中已适配，高级包中已适配。

## 10.字符集

目前只支持UTF16LE的national char，即utf16小端的字符集，其他字符集不支持。

## 11.当前功能

当前只实现了数据类型在DML语法中的基本功能、大部份内置函数中支持入参功能，PLSQL中支持、高级包中支持，其他复杂语义可能未覆盖。

# 5. Detail Design（详细设计）

## 5.1 Architecture（架构）

总体架构如下图：

![](https://pingcode.yasdb.com/atlas/files/public/67396a3a8970c2af4f51fd33/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUlBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBQUFBZ0FBQUFBQUFBSUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUJBQVFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE5MTYsImV4cCI6MTc4MjIyMjcxNn0.uttZJjR-A8aPo155YEoPQQcbg34KF-cnSTKersOjKak)

## 5.2 Data Structures & Flow（数据结构与流程）

提供两个组件：

1. utf16编码解码器；
1. varConvert系列函数。


###  5.2.1 utf16设计

utf16有两种编码形式，分别使用2 byte和4 byte

2 byte: xxxx xxxx | xxxx xxxx    
  4 byte: 1101 10xx | xxxx xxxx | 1101 11xx | xxxx xxxx

输入为一个长度为n的字符串（char,utf16），将其解码到码平面上。即

xxxx xxxx xxxx xxxx <= xxxx xxxx | xxxx xxxx    
  yyyy yyyy yyxx xxxx xxxx <= 1101 10yy | yyyy yyyy | 1101 11xx | xxxx xxxx

utf16接口函数共需要23个接口函数：

```
void utf16TextUpper(CodText* text);
void utf16TextLower(CodText* text);
void utf16Substr(const CodText* text, CodUint32 pos, CodUint32 size, CodText* subText);

CodUint64 utf16Length(const CodText* text);
CodInt32  utf16PinyinCsCmp(const CodText* text1, const CodText* text2);
CodInt32  utf16PinyinCiCmp(const CodText* text1, const CodText* text2);
CodInt32  utf16GeneralCsCmp(const CodText* text1, const CodText* text2);
CodInt32  utf16GeneralCiCmp(const CodText* text1, const CodText* text2);
CodBool   utf16GeneralCsEqual(const CodText* text1, const CodText* text2);
CodBool   utf16GeneralCiEqual(const CodText* text1, const CodText* text2);
CodBool   utf16PinyinCsEqual(const CodText* text1, const CodText* text2);
CodBool   utf16PinyinCiEqual(const CodText* text1, const CodText* text2);
CodInt64  utf16TextInText(const CodText* subText, const CodText* text, CodInt64 startPos, CodUint64 nth);
CodUint32 utf16CharPos(const CodText* text, CodUint32 pos);
CodResult utf16Deduplicate(CodText* text, CodChar* buf, CodUint32* len);
CodResult utf16NextCharLengthb(const CodText* text, CodUint32 pos, CodInt32* mblen);
CodVoid   utf16PosMove(CodText* text, CodTextPos* pos, CodUint32 n);
CodResult utf16Translate(CodText* srcText, CodText* patternText, CodText* translateText, CodText* vTranslateText);

CodResult utf16PinyinCsNlssort(const CodText* srcText, CodText* nlsText, CodUint32 bufLen);
CodResult utf16PinyinCiNlssort(const CodText* srcText, CodText* nlsText, CodUint32 bufLen);
CodResult utf16GeneralCsNlssort(const CodText* srcText, CodText* nlsText, CodUint32 bufLen);
CodResult utf16GeneralCiNlssort(const CodText* srcText, CodText* nlsText, CodUint32 bufLen);
```

### 5.2.2 varConvert系列函数

需要开发DataType与这四种类型，这四种类型之间的转换。大致有4*38*2=304种转换方式（300多个函数）。

```
typedef enum EnDataType
{
    DTYPE_UNKNOWN       = 0,
    DTYPE_BOOL          = 1,
    DTYPE_TINYINT       = 2,
    DTYPE_SMALLINT      = 3,
    DTYPE_INTEGER       = 4,
    DTYPE_BIGINT        = 5,
    DTYPE_UTINYINT      = 6, // map mysql uint8
    DTYPE_USMALLINT     = 7, // map mysql uint16
    DTYPE_UINTEGER      = 8, // map mysql uint32
    DTYPE_UBIGINT       = 9, // map mysql uint64
    DTYPE_FLOAT         = 10,
    DTYPE_DOUBLE        = 11,
    DTYPE_NUMBER        = 12,
    DTYPE_DATE          = 13,
    DTYPE_SHORTDATE     = 14, // map mysql date
    DTYPE_SHORTTIME     = 15, // map mysql time
    DTYPE_TIMESTAMP     = 16,
    DTYPE_TIMESTAMP_TZ  = 17,
    DTYPE_TIMESTAMP_LTZ = 18,
    DTYPE_YM_INTERVAL   = 19,
    DTYPE_DS_INTERVAL   = 20,
    DTYPE_UNUSED1       = 21,
    DTYPE_UNUSED2       = 22,
    DTYPE_UNUSED3       = 23,
    //don't change the order of DataType
    DTYPE_CHAR          = 24,
    DTYPE_NCHAR         = 25,
    DTYPE_VARCHAR       = 26,
    DTYPE_NVARCHAR      = 27,
    DTYPE_RAW           = 28,
    DTYPE_CLOB          = 29,
    DTYPE_BLOB          = 30,
    DTYPE_BIT           = 31,
    DTYPE_ROWID         = 32,
    DTYPE_NCLOB         = 33,
    DTYPE_CURSOR        = 34,
    DTYPE_JSON          = 35,
    DTYPE_UDT_OBJECT    = 36,
    DTYPE_UDT_ARRAY     = 37,
    DTYPE_UDT_TABLE     = 38,

    __DTYPE_COUNT__,
    //INTERNAL USE ONLY, forbidden in operArray
    DTYPE_RECORD    = 247,
    DTYPE_PROCEDURE = 248,
    DTYPE_DUMMY     = 249, //only for to_date/to_timestamp/to_XXInterval dummy argument, carefully call
    DTYPE_FUNCTION  = 250,
    DTYPE_OBJECT = 251,
    DTYPE_QUERY  = 252,
    DTYPE_COLUMN = 253,
    DTYPE_TUPLE  = 254,
    __COMPLEX_DTYPE_COUNT__
} DataType;
```

  


# 6. Testcases（自测用例）

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


所有的测试点都比较重要

# 7.资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

# 8. TODO（遗留问题）

1. 并没有和oracle完全对齐（oracle存在MAX_STRING_SIZE = EXTENDED，和MAX_STRING_SIZE = STANDARD两种选项）。长度和oracle不能完全一致，以后跟随MAX_STRING_SIZE参数支持32000长度。
1. varCompare、varEqual、gTypeAdjuster等可能会出现问题。传入varenv环境。
1. 超过1000行的SR是否需要拆成两个SR？
1. 列存怎么办？
1. 当客户端和数据库为utf8，使用NVARCHAR时，yasql是否有能力做字符编码转换？yasql进行utf8→utf16，驱动做。


## Attachments: