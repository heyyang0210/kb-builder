Created by 赵忠源, last modified on 十月 15, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/661911fefd997db58ad8901b](https://pingcode.yasdb.com/pjm/items/661911fefd997db58ad8901b)    *?*    
  *#YDBRD-26264 兼容MySQL字符集*

##   [1. 总述](#1-总述)  

支持mysql对应的latin、utf8mb4字符集

###   [1.1 需求来源](#11-需求来源)  

Mysql兼容性支持    
  支持形态：单机

###   [1.2 调研文档](#12-调研文档)  

调研文档    [https://conf.yasdb.com/pages/viewpage.action?pageId=153010919](https://conf.yasdb.com/pages/viewpage.action?pageId=153010919)  

###   [1.3 需求分析](#13-需求分析)  

需要关注如下几点：

1. mysql兼容下映射mysql字符集对应yasdb字符集，latin1对齐iso88591，utf8mb4对齐utf8
1. 添加字典序字段，字符集默认字典序，latin1默认为latin1_swedish_ci，utf8mb4默认为utf8mb4_general_ci    
  ~~3. 支持system级和session级修改字符集~~
1. 支持查询当前数据库字符集


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|设置字符集默认字典序|配置参数框架内增加collation字段，对应字符集配置默认字典序|是/否|是|
|功能|系统级/会话级修改字符集|在mysql兼容模式添加流程修改配置参数|是/否|是|
|功能|mysql兼容映射yasdb对应字符集|在mysql兼容模式下添加流程将latin1映射为iso88591，utf8mb4映射为utf8|是/否|是|
|功能|支持latin1_swedish_ci字符序|添加latin1_swedish_ci字符序作为latin1默认字符序|是/否|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


##   [2. 接口](#2-接口)  

```
typedef enum EnCodCollationId {
    ASCII_GENERAL_CS = 0,
    ASCII_GENERAL_CI,

    GBK_GENERAL_CS,
    GBK_GENERAL_CI,

    UTF8_GENERAL_CS,
    UTF8_GENERAL_CI,
    UTF8_PINYIN_CS,
    UTF8_PINYIN_CI,

    ISO88591_GENERAL_CS,
    ISO88591_GENERAL_CI,
    
    GB18030_GENERAL_CS,
    GB18030_GENERAL_CI,
    
    __COLLATION_COUNT__
} CodCollationId;


```

collation对应id

新增my_charset.c用于存放重载的字符集函数修改架构

```
typedef struct StCharsetAttr {
    CodText charsetName;
    CodBool isNational;
    CodUint16 defaultCollation;
} CharsetAttr;



static CharsetAttr gMyCharsetInfo[__CHARSET_COUNT__] = {
    [ASCII]    = {COD_TEXT_DEF("ASCII"), COD_FALSE, ASCII_GENERAL_CI},
    [ISO88591] = {COD_TEXT_DEF("LATIN-1"), COD_FALSE, ISO88591_GENERAL_CI},
    [GBK]      = {COD_TEXT_DEF("GBK"), COD_FALSE, GBK_GENERAL_CI},
    [UTF8]     = {COD_TEXT_DEF("UTF8MB4"), COD_FALSE, UTF8_GENERAL_CI},
    [UTF16]    = {COD_TEXT_DEF("UTF16"), COD_TRUE, UTF8_GENERAL_CI},
    [GB18030]  = {COD_TEXT_DEF("GB18030"), COD_FALSE, GB18030_GENERAL_CI}
};

```

目前支持的collation表

```

mysql&gt; show   collation;
+--------------------+--------------------+------+------------+-------------+---------+---------------+
| COLLATION_NAME     | CHARACTER_SET_NAME | ID   | IS_DEFAULT | IS_COMPILED | SORTLEN | PAD_ATTRIBUTE |
+--------------------+--------------------+------+------------+-------------+---------+---------------+
| ascii_bin          | ascii              |   65 | NULL       | Yes         |       1 | NO PAD        |
| ascii_general_ci   | ascii              |   11 | Yes        | Yes         |       1 | NO PAD        |
| gbk_bin            | gbk                |   87 | NULL       | Yes         |       1 | NO PAD        |
| gbk_general_ci     | gbk                |   28 | Yes        | Yes         |       1 | NO PAD        |
| utf8mb4_bin        | utf8mb4            |   46 | NULL       | Yes         |       1 | NO PAD        |
| utf8mb4_general_ci | utf8mb4            |   45 | Yes        | Yes         |       1 | NO PAD        |
| latin1_bin         | latin1             |   47 | NULL       | Yes         |       1 | NO PAD        |
| latin1_general_ci  | latin1             |   48 | Yes        | Yes         |       1 | NO PAD        |
| gb18030_bin        | gb18030            |  249 | NULL       | Yes         |       1 | NO PAD        |
| gb18030_general_ci | gb18030            |  248 | Yes        | Yes         |       1 | NO PAD        |
+--------------------+--------------------+------+------------+-------------+---------+---------------+

```

utf8、utf8mb3会被映射为utf8mb4

##   [3. 规格与约束](#3-规格与约束)  

mysql兼容性开发暂不支持存储过程，暂不考虑存储过程的使用

暂不支持：

1. 创建数据库、表和字段时指定字符集
1. DML中修改字符集
1. 字符序仅支持设置为默认，后续功能在字符序需求中补齐
1. mysql支持表级、列级设置字符集，数据库字符集
1. mysql的charset与ncharset不分开，可能会出现设置UTF16的情况
1. 不支持对字符集进行设置修改，启库设置时须按yashan流程（流程上支持，但不生效）


##   [4. 特性](#4-特性)  

###   [4.1 设置字符集默认字典序](#41-设置字符集默认字典序)  

1. 添加defaultCollation变量作字符集默认字典序的映射
1. 字符集charset/ncharset对应init流程中添加collation的初始化崖山模式下collation字段存在但无法查询/修改    
  Mysql模式下可以通过select @@CHARACTER_SET_SERVER/@@COLLATION_SERVER全局变量的方式查询


###   [4.2 系统级/会话级修改字符集](#42-系统级会话级修改字符集)  

~~目前yashandb未支持字符集修改，仅能通过建库时set或修改yasdb.ini~~  ~~可能存在风险~~

~~ALTER DATABASE database_name CHARACTER SET utf8mb4;修改的是schema的charset~~    
  ~~yasdb的database character set 实际对应 character-set-server~~

~~【仅在mysql兼容模式下】~~    
  ~~1. 添加SET设置字符集流程（会话级）~~    
  ~~2. 添加alter语句mysql语法转换为yasdb语法（系统级）~~

###   [4.3 mysql兼容映射yasdb对应字符集](#43-mysql兼容映射yasdb对应字符集)  

【仅在mysql兼容模式下】

1. 添加myCharSetName将字符集latin1映射为iso88591，utf8mb4映射为utf8
1. 支持语法上设置字符集（支持但不生效）【ddl需求后验证】


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

自测用例另附

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,会议纪要：,1.不支持mysql语法下的字符集修改；,2.swedish字符序后面字符序需求做；,3.不支持崖山现有的其他字符集设置；（其他先拦截报错）,4.字符集不允许设置为UTF16；,Posted by zhaozhongyuan at 五月 28, 2024 11:34|
|---|
