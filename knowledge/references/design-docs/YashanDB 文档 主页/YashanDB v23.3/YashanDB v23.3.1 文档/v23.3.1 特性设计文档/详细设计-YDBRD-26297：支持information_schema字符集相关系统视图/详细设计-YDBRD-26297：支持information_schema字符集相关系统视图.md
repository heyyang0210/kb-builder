Created by 赵忠源, last modified on 六月 20, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66192c17fd997db58ad8a633](https://pingcode.yasdb.com/pjm/items/66192c17fd997db58ad8a633)    *?*    
  *#YDBRD-26297 支持information_schema字符集相关系统视图*

##   [1. 总述](#1-总述)  

支持information_schema特定的视图&系统表    
  CHARACTER_SETS    
  COLLATION_CHARACTER_SET_APPLICABILITY    
  COLLATIONS

###   [1.1 需求来源](#11-需求来源)  

mysql兼容

###   [1.2 调研文档](#12-调研文档)  

调研文档    [https://conf.yasdb.com/pages/viewpage.action?pageId=153013722](https://conf.yasdb.com/pages/viewpage.action?pageId=153013722)  

###   [1.3 需求分析](#13-需求分析)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|CHARACTER_SETS|修改charsetinfo结构，添加视图查询流程|是|是|
|功能|COLLATION_CHARACTER_SET_APPLICABILITY|修改collationinfo结构，添加视图查询流程|是|是|
|功能|COLLATIONS|修改collationinfo结构，添加视图查询流程|是|是|
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

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SHOW 语法查询|SHOW CHARSET/SHOW COLLATION|----|是|
|SELECT 语法查询|SELECT * FROM INFORMATION_SCHEMA.CHARACTER_SETS/COLLATION_CHARACTER_SET_APPLICABILITY/COLLATIONS|----|是|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


```
typedef struct StCharsetAttr {
    CodText charset_name;
    CodBool isNational;
    CodUint16 defaultCollation;
} CharsetAttr;

typedef struct StCodCollationAttr {
    CodText   collation_name;
    CodUint16 charset_id;
    CodUint16 collation_id;
    CodUint16 sortlen;
} CollationAttr;

```

##   [3. 规格与约束](#3-规格与约束)  

1. sortlen目前为完全与mysql对应字符序相同
1. yasdb支持字符集和字符序较少，视图显示结果与mysql不同
1. yasdb目前compiled和pad attribute都为固定yes和no pad，由框架和字符序底层逻辑决定的
1. 目前yasdb仅有字符集对应的general_ci和general_cs，暂无mysql的chinese字符序和latin1_swedish(字符序需求做)，id与mysql的general相同，latin1字符序默认为general_ci
1. 空串目前显示为NULL


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

动态视图字段设计与mysql相同

```
mysql&gt; DESC information_schema.collations；
+--------------------+-------------+------+-----+---------+-------+
| Field              | Type        | Null | Key | Default | Extra |
+--------------------+-------------+------+-----+---------+-------+
| COLLATION_NAME     | varchar(32) | NO   |     |         |       |
| CHARACTER_SET_NAME | varchar(32) | NO   |     |         |       |
| ID                 | bigint(11)  | NO   |     | 0       |       |
| IS_DEFAULT         | varchar(3)  | NO   |     |         |       |
| IS_COMPILED        | varchar(3)  | NO   |     |         |       |
| SORTLEN            | bigint(3)   | NO   |     | 0       |       |
+--------------------+-------------+------+-----+---------+-------+

mysql&gt; DESC information_schema.character_sets;
+----------------------+-------------+------+-----+---------+-------+
| Field                | Type        | Null | Key | Default | Extra |
+----------------------+-------------+------+-----+---------+-------+
| CHARACTER_SET_NAME   | varchar(32) | NO   |     |         |       |
| DEFAULT_COLLATE_NAME | varchar(32) | NO   |     |         |       |
| DESCRIPTION          | varchar(60) | NO   |     |         |       |
| MAXLEN               | bigint(3)   | NO   |     | 0       |       |
+----------------------+-------------+------+-----+---------+-------+
4 rows in set (0.00 sec)


```

information_schema视图信息都从两视图中查询

###   [4.1 支持CHARACTER_SETS视图](#41-支持character-sets视图)  

|CHARACTER_SET_NAME|DEFAULT_COLLATE_NAME|DESCRIPTION|MAXLEN|Pad_attribute|
|---|---|---|---|---|
|gCharsetInfo|gCharsetInfo|与mysql对齐|gMaxCharWidth|全NO PAD(YAS目前规格)|


###   [4.2 支持COLLATION_CHARACTER_SET_APPLICABILITY视图](#42-支持collation-character-set-applicability视图)  

|COLLATION_NAME|CHARACTER_SET_NAME|
|---|---|
|gCollationInfo|gCollationInfo|


###   [4.3 支持COLLATIONS视图](#43-支持collations视图)  

|COLLATION_NAME|CHARACTER_SET_NAME|ID|IS_DEFAULT|IS_COMPILED|SORTLEN|
|---|---|---|---|---|---|
|gCollationInfo|gCollationInfo|与mysql对应字符序id对齐|codCollationIsDefault|gCollationInfo|暂全为Yes|


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

![](https://pingcode.yasdb.com/atlas/files/public/67396ee18970c2af4f521c21/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ2OTYsImV4cCI6MTc4MjQ1NTQ5Nn0.eDkmAuEOHC0KMLzkwirhzAmDCs4GASpNVQIP6gdTdXs)

![](https://pingcode.yasdb.com/atlas/files/public/67396ee2a1ad9a3311dc9a94/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NDQ2OTYsImV4cCI6MTc4MjQ1NTQ5Nn0.eDkmAuEOHC0KMLzkwirhzAmDCs4GASpNVQIP6gdTdXs)

## Attachments:

## Comments:

|  [](null)  ,会议纪要：,1.不做DBA视图，正常从动态视图内查询,2.select和show语法上须支持mysql语法,Posted by zhaozhongyuan at 五月 29, 2024 14:57|
|---|
