Created by 赵忠源, last modified on 七月 08, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6619125afd997db58ad89093](https://pingcode.yasdb.com/pjm/items/6619125afd997db58ad89093)    *?*    
  *#YDBRD-26265 兼容MySQL排序*

##   [1. 总述](#1-总述)  

兼容以下MySQL排序

latin1_bin

latin1_swedish_ci

utf8mb4_bin

utf8mb4_general_ci

###   [1.1 需求来源](#11-需求来源)  

Mysql兼容性支持    
  支持形态：单机

###   [1.2 调研文档](#12-调研文档)  

调研文档见：    [https://conf.yasdb.com/pages/viewpage.action?pageId=156131597](https://conf.yasdb.com/pages/viewpage.action?pageId=156131597)  

###   [1.3 需求分析](#13-需求分析)  

需要关注如下几点：

1. 支持目前yashan字符集下的各字符序（除utf16及pinyin字符序）
1. 支持ddl下的设置字符序语法（语法支持，实际不生效）
1. 支持dcl设置字符序[COLLATE]，映射为yashan对应的NLSSORT
1. 支持latin1_swedish字符序


**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|支持目前yashan字符集下的各字符序|增加mysql模式下的映射|是|是|
|功能|支持ddl下的语法设置字符序|各处ddl增加关键词COLLATE对应流程|是|是|
|功能|支持dcl设置字符序[COLLATE]|映射为yashan对应的NLSSORT|是|是|
|功能|支持latin1_swedish字符序|新增swedish字符序码表|是|是|
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
static myCollationAttr gMyCollationInfo[__COLLATION_COUNT__] = {
    [ASCII_GENERAL_CI]    = {COD_TEXT_DEF("ascii_general_ci"), ASCII, 11, 1, COD_TRUE},
    [ASCII_GENERAL_CS]    = {COD_TEXT_DEF("ascii_bin"), ASCII, 65, 1, COD_TRUE},
    [GBK_GENERAL_CI]      = {COD_TEXT_DEF("gbk_chinese_ci"), GBK, 28, 1, COD_TRUE},
    [GBK_GENERAL_CS]      = {COD_TEXT_DEF("gbk_bin"), GBK, 87, 1, COD_TRUE},
    [UTF8_GENERAL_CI]     = {COD_TEXT_DEF("utf8mb4_general_ci"), UTF8, 45, 1, COD_TRUE},
    [UTF8_GENERAL_CS]     = {COD_TEXT_DEF("utf8mb4_bin"), UTF8, 46, 1, COD_TRUE},
    [UTF16_GENERAL_CI]    = {COD_TEXT_DEF("utf16_general_ci"), UTF16, 54, 1, COD_TRUE},
    [UTF16_GENERAL_CS]    = {COD_TEXT_DEF("utf16_bin"), UTF16, 55, 1, COD_TRUE},
    [ISO88591_GENERAL_CI] = {COD_TEXT_DEF("latin1_general_ci"), ISO88591, 48, 1, COD_TRUE},
    [ISO88591_GENERAL_CS] = {COD_TEXT_DEF("latin1_bin"), ISO88591, 47, 1, COD_TRUE},
 	[ISO88591_SWEDISH_CI] = {COD_TEXT_DEF("latin1_swedish_ci"), ISO88591, 8, 1, COD_TRUE},
    [GB18030_GENERAL_CI]  = {COD_TEXT_DEF("gb18030_chinese_ci"), GB18030, 248, 2, COD_TRUE},
    [GB18030_GENERAL_CS]  = {COD_TEXT_DEF("gb18030_bin"), GB18030, 249, 1, COD_TRUE},
};

```

##   [3. 规格与约束](#3-规格与约束)  

1. 崖山支持的PINYIN字符序暂未在mysql模式下支持
1. 目前yashanDB仅支持启库时设置修改字符集和字符序，其他仅语法支持，实际不生效


##   [4. 特性](#4-特性)  

###   [4.1 支持目前yashan字符集下的各字符序](#41-支持目前yashan字符集下的各字符序)  

目前崖山字符集对应的字符序如表所示

```
SQL&gt; select * from INFORMATION_SCHEMA.COLLATIONS;

COLLATION_NAME                    CHARACTER_SET_NAME                                   ID IS_DEFAULT IS_COMPILED               SORTLEN 
--------------------------------- --------------------------------- --------------------- ---------- ----------- --------------------- 
ascii_bin                         ascii                                                65            Yes                             1
ascii_general_ci                  ascii                                                11 Yes        Yes                             1
gbk_bin                           gbk                                                  87            Yes                             1
gbk_chinese_ci                    gbk                                                  28 Yes        Yes                             1
utf8mb4_bin                       utf8mb4                                              46            Yes                             1
utf8mb4_general_ci                utf8mb4                                              45 Yes        Yes                             1
latin1_bin                        latin1                                               47            Yes                             1
latin1_general_ci                 latin1                                               48 Yes        Yes                             1
utf16_bin                         utf16                                                55            Yes                             1
utf16_general_ci                  utf16                                                54 Yes        Yes                             1
gb18030_bin                       gb18030                                             249            Yes                             1
gb18030_chinese_ci                gb18030                                             248 Yes        Yes                             2
latin1_swedish_ci                 latin1                                                8 Yes        Yes                             1

```

utf8、utf8mb3将被映射为utf8mb4处理

```
    {.name = COD_TEXT_DEF("utf8mb4_bin"), .id = MY_COLLATION_UTF8MB4_BIN, .mapYasCollation = UTF8_GENERAL_CS},
    {.name = COD_TEXT_DEF("utf8mb4_general_ci"), .id = MY_COLLATION_UTF8MB4_GENERAL_CI, .mapYasCollation = UTF8_GENERAL_CI},
    {.name = COD_TEXT_DEF("utf8mb3_bin"), .id = MY_COLLATION_UTF8MB3_BIN, .mapYasCollation = UTF8_GENERAL_CS},
    {.name = COD_TEXT_DEF("utf8mb3_general_ci"), .id = MY_COLLATION_UTF8MB3_GENERAL_CI, .mapYasCollation = UTF8_GENERAL_CI},
    {.name = COD_TEXT_DEF("utf8_bin"), .id = MY_COLLATION_UTF8_BIN, .mapYasCollation = UTF8_GENERAL_CS},
    {.name = COD_TEXT_DEF("utf8_general_ci"), .id = MY_COLLATION_UTF8_GENERAL_CI, .mapYasCollation = UTF8_GENERAL_CI},

```

兼容模式下与崖山模式下的字符序对照可见gMyCollationInfo

###   [4.2 支持ddl下的语法设置字符序](#42-支持ddl下的语法设置字符序)  

ddl语句（如schema）内语法支持设置字符序，设置后不生效，字符序须与字符集对应，否则报错；

###   [4.3 支持dml,dcl设置字符序[COLLATE]](#43-支持dmldcl设置字符序collate)  

dml、dcl语句中可设置字符序，将映射到崖山现有的NLSSORT返回结果

###   [4.4 支持latin1_swedish字符序](#44-支持latin1-swedish字符序)  

支持mysql的latin1_swedish字符序，添加对应swedish码表

添加后latin_swedish为latin的默认字符序

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,1. latin1_swedish 不作为默认字符序
1. utf16保留与否？保留，资料说明
1. 整理yashan与mysql字符集字符序对照关系
,Posted by zhaozhongyuan at 六月 27, 2024 11:18|
|---|
