Created by 未知用户 (liaofeng), last modified on 五月 11, 2024

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c1](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c1)    ?    
  #YASHAN-881 record类型作为函数形参需要支持UDT嵌套

SR链接：    [https://pingcode.yasdb.com/pjm/items/661817a6fd997db58ad7aa3e](https://pingcode.yasdb.com/pjm/items/661817a6fd997db58ad7aa3e)    ?    
  #YDBRD-26092 record类型作为函数形参需要支持UDT嵌套

  


##   [1. 总述](#1-总述)  

当前版本函数形参列表中出现record类型嵌套其他udt类型时进行了拦截处理，本需求用于放开该限制

###   [1.1 需求来源](#11-需求来源)  

属于放开规格限制，问题单转需求。

###   [1.2 调研文档](#12-调研文档)  

内部调整，无。

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|形参列表支持record嵌套其他udt类型|放开原有拦截点，适配record嵌套场景|是|是|
|性能|性能场景1||否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|udt类型|包括plsql内的record、varray、nest table和udt类型object、varray、nest table|兼容oracle||


###   [1.5 开源依赖](#15-开源依赖)  

无

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|函数型参列表|支持record嵌套udt类型的形参|---|是|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

暂无

##   [4. 特性](#4-特性)  

###   [4.1 函数形参列表支持record嵌套udt类型](#41-函数形参列表支持record嵌套udt类型)  

1. 原来拦截点是在执行阶段，初始化record类型的形参时，使用soCheckRecordArgument函数检查record成员是否全为标量。现在放开拦截点，同时适配嵌套udt类型的检查。（对于非绑定参数类型的实参，在verifyCallProcArgs阶段会进行详细类型检查，对于绑定参数类型依赖于执行阶段soCheckRecordArgument，但检查不完全，待绑定参数重构合入后，可去除执行阶段检查）
1. 调整soInitArgument对于record类型出参的处理，新增函数soInitInOutRecordArg，对成员递归处理udt类型和标量类型。
1. 原来已经支持object嵌套情况的形参，可以record可以复用部分逻辑。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- **入参**
- **出参**
- **出入参**


|  
|record|object|array|udt array|udt nested table|
|---|---|---|---|---|---|
|record|record嵌套record|record嵌套object|record嵌套array|record嵌套udt array|record嵌套udt nested table|
|object|-|object嵌套object|-|object嵌套udt array|object嵌套udt nested table|
|array|array嵌套record|array嵌套object|array嵌套array|array嵌套udt array|array嵌套udt nested table|
|nested table|nested table嵌套record|nested table嵌套object|nested table嵌套array|nested table嵌套udt array|nested table嵌套udt nested table|
|udt array|-|udt array嵌套object|-|udt array嵌套udt array|udt array嵌套udt nested table|
|udt nested table|-|udt nested table嵌套object|-|udt nested table嵌套udt array|udt nested table嵌套udt nested table|


**多层嵌套场景**

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。