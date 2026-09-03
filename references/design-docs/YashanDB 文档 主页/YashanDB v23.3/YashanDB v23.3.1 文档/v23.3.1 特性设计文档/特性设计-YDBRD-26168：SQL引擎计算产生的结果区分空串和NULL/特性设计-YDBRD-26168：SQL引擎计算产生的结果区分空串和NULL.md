Created by 邓秋怡, last modified on 七月 12, 2024

*详细设计-YDBRD-26168：SQL引擎计算产生的结果区分空串和NULL*

*IR链接：*    [YASHAN-1692](https://pingcode.yasdb.com/ship/ideas/660b7484009f91eb87f2c1a8? #YASHAN-1692  【MYSQL兼容】not null约束允许插入空串%27%27)  

*SR链接：*    [YDBRD-26168](https://pingcode.yasdb.com/pjm/items/6618e61afd997db58ad828ca? #YDBRD-26168 SQL引擎计算产生的结果区分空串和NULL)  

##   [1. 总述](#1-总述)  

- 增加系统参数 EMPTY_STRING_AS_NULL（建库时指定且建库后不能被修改），默认为TRUE（即Oracle模式， 空串当NULL处理）。当该参数设置为False时，SQL层计算产生的中间结果（内置函数、类型转换等）需要区分NULL和空串。
- 内置函数的返回值可能是空串时， 需要根据EMPTY_STRING_AS_NULL来返回NULL或空串
- 其他数据类型转成STRING时，如果长度为0，需要根据EMPTY_STRING_AS_NULL来返回NULL或空串


###   [1.1 需求来源](#11-需求来源)  

Mysql兼容性支持    
  支持形态：单机

###   [1.2 调研文档](#12-调研文档)  

调研文档见    [SQL引擎计算产生的结果区分空串和NULL调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=153026401)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|
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

##   [3. 规格与约束](#3-规格与约束)  

1. 仅支持单机环境
1. 外置udf，gis函数不适配。
1. 动态视图、系统表（除default）内若有空串，对外表现仍然是null。（rowAddNull）


##   [4. 特性](#4-特性)  

###   [4.1 特性设计——MySQL5.7 生成空串的地方适配](#41-特性设计mysql57-生成空串的地方适配)  

**内置函数**

- 如lpad,substr，LEFT，LENGTH，SUBSTRING， SUBSTRING_INDEX等,还有array相关的stringToArray等,详见调研文档。


**数据类型**

- empty_lob转换成string/json的适配。


**其他**

- anlDateFmtIsConstNull里面format的适配，如果format是空串，解析时候把变量isNull改成true了，所以类似to_date(sysdate,'')返回null。但是如果是空格串，解析时候先trim再判断长度为0，但是不会把isNull改成true，所以后续当作date格式解析的时候会报错（适配）。
- regExpReplace，如果生成的结果是长度为0，则会返回null。（需要适配）
- v$task 视图，系统表里面的yason2Variant（也不适配）
- prepLoadDataFromFile（load data需要适配，从文件中读空串后，以空串插入目标表，需要适配）
- ldrPrepareSplitColValues（yasldr是否需要适配，看工作量）
- anrReadString anrReadLob（协议适配，含输入输出）输出：sendrow
- 系统表里面defaut是空串会适配，用户定义的表default是空串，定义会存在表里面。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 能够产生空串的内置函数检查输出是否是空串
- 能够转换成空串的数据检查输出是否是空串
- 


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。