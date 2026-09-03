Created by 徐伟, last modified on 十二月 13, 2023

  


* IR链接：*    [YDBRD-22364](https://jira.yasdb.com/browse/YDBRD-22364?src=confmacro)    *-*  *to_date，to_char, date函数, date_format 支持常量fmt缓存*  *验收中*

*SR链接：*    [YDBRD-23064](https://jira.yasdb.com/browse/YDBRD-23064?src=confmacro)    *-*  *CLONE - to_date，to_char, date函数, date_format 支持常量fmt缓存*  *完成*

##   [1. 总述](#1-总述)  

在函数to_date，to_timestamp、to_char, date、trunc、设置date_format后的格式匹配时，在执行过程中常量fmt支持缓存

###   [1.1 需求来源](#11-需求来源)  

需求基于华润性能测试专项提取的需求优化，主要实现在单机行存

###   [1.2 调研文档](#12-调研文档)  

由于是特性函数的性能需求，优化方向基于yashan数据库自身实现进行优化点提取，暂无对应调研文档

###   [1.3 需求分析](#13-需求分析)  

1.该需求实现主要包括如下函数：

|场景|功能|子项|说明|
|---|---|---|---|
|text2Date|函数|to_date|参数为常量fmt|
||函数|to_timestamp|参数为常量fmt|
||函数|trunc|参数为常量fmt|
||函数|date|参数为常量fmt|
||column(date)|插入字符串|插入触发转换|
||filter|date与字符串比较|隐式转换|
|date2Text|函数|to_char|参数为常量fmt|


2.涉及到的优化方向

_（1）函数在参数为时间类型的常量fmt时，将参数进行匹配并记录下对应id，在执行时减少fmt查找流程

_（2）在加载dateFormat配置参数或者设置dateFormat配置参数时，记录fmt对应id；这样在数据插入，filter比较时能较少text转date的fmt查找流程

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|函数支持fmt常量缓存|在trsf阶段，对于to_date，to_timestamp、to_char, date、trunc中的fmt为常量情况下，将value->type设置为DTYPE_OBJECT并且fetchFmt，存下对应ID|是|是|
|功能|配置参数dateFmt支持常量缓存|在加载dateFormat配置参数或者设置dateFormat配置参数时，校验fmt的时候存储对应id|是|是|
|性能|函数执行性能|将常量fmt进行缓存，减少执行fetchFmt动作|是|是|
|性能|date列插入性能|将dateFormat配置参数进行缓存，减少执行fetchFmt动作|是|是|
|性能|date列与字符串比较性能|将dateFormat配置参数进行缓存，减少执行fetchFmt动作|是|是|
|可用性|---|----|否|否|
|可靠性|---|----|否|否|
|可维可测|---|----|否|否|
|安全|---|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|----|----|----|否|
|周边配合|----|----|----|否|
|周边配合|----|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|常量fmt|时间类型的格式符为常量时，如：‘yyyy-mm-dd’|无|---|


###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|----|----|否|
|函数|----|----|否|
|高级包|----|----|否|
|系统视图|----|----|否|
|动态视图|----|----|否|
|配置参数|----|----|否|
|驱动接口|----|----|否|
|错误码|ERR_CMM_DATE_FMT_TOO_LONG，ACTION:the date format is too long for the internal buffer|----|否|
|告警|----|----|否|
|日志|----|----|否|


##   [3. 规格与约束](#3-规格与约束)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

规格：

(1) 对dateFmt配置参数会进行常量缓存

(2) 对列举函数中的参数为时间类型的常量fmt时会进行缓存

约束:

(1) 配置参数或者常量fmt有双引号时在22.2版本暂不支持缓存，在23.2版本会考虑实现

(2) dateFmt长度最大为64，跟原有规格保持一致

##   [4. 特性](#4-特性)  

新增结构体：

```
typedef struct StDateTmFmtNodeDecl {
    CodUint8* fmtArray;
    CodUint8  fmtCount;
    CodUint8  unUsed[7];
} DateTmFmtNodeDecl;


```

###   [4.1 函数常量fmt特性设计](#41-函数常量fmt特性设计)  

常量fmt缓存当前只是单机行存，因此对于表达式的修改得在计划之后，当前选择在trsf阶段改写

1. 在trsf阶段，to_date，to_timestamp、to_char, date、trunc对应参数为常量fmt时，设置exprNode的isConstDateFmt标志位，分配对应参数的exprNode->dateFmtDecl空间, 进行fetchFmt后并存储对应ID在数组中
1. 在执行函数时，判断参数的exprNode上的标志位isConstDateFmt，将fmtArray与fmtCount传入底层函数date2Text与text2Date（还需保留原有fmtStr）
1. 执行date2Text与text2Date时，先判断fmtArray是否为空，非空则省略fetchFmt流程，直接从fmtArray取出对应id，然后按原有流程执行


###   [4.2 配置参数dateFmt特性设计](#42-配置参数datefmt特性设计)  

1. 在加载dateFormat配置参数或者设置dateFormat配置参数时，会校验fmt是否合法，此时存储对应fmtId在varEnv的fmtArray数组上
1. 在执行varConvStringDate与varConvDateString时，取从fmtArray数组取出对应id，然后按原有流程执行


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1、to_date，to_timestamp、to_char, date、trunc 函数fmt为常量时，测试功能正确性以及性能提升效果

2、使用默认dateFmt以及alter 设置dateFmt测试功能正确性

3、使用默认dateFmt以及alter 设置dateFmt，测试在date列插入以及date与string比较时性能提升效果

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

23.2版本考虑实现带双引号的常量fmt缓存