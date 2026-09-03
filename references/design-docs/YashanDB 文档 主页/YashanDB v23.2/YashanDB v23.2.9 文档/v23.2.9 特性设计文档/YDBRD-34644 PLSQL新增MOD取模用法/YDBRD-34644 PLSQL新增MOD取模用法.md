*概要设计-YDBRD-34644 : PLSQL新增MOD取模用法*

*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf15](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf15)  *?*    


##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

来源于南方电网项目，项目中PL/SQL对象中使用到MOD语法，需要支持单机、分布式和集群环境。

###   [1.2 调研文档](#12-调研文档)  

此功能对标的是Oracle，本次验证使用的是Oracle 19C（未验证其他版本）：

1. Oracle的PL/SQL语法中支持MOD语法，此语法实现的是取模操作，同操作符“%”的作用一致。
1. Oracle的PL/SQL语法中不支持使用%操作符作取模操作，只能使用MOD语法。


测试调研文档：  [https://pingcode.yasdb.com/wiki/spaces/LISIYU/pages/67399011728206efb9301a18](https://pingcode.yasdb.com/wiki/spaces/LISIYU/pages/67399011728206efb9301a18)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|PL/SQL语法支持MOD语法|1. 增加MOD关键字
1. 表达式解析（addExprWordUntil）过程中，识别PL/SQL语法环境和MOD的tokenId，根据条件转化为mod操作符处理
1. 标签检查（soCompileCheckLableIsKeyword）中去除对MOD关键字的限制
|是|是|  
|
|性能|性能场景1|----|是/否|否|  
|
|可用性|恢复场景|----|是/否|否|  
|
|可靠性|故障场景|----|是/否|否|  
|
|可维可测|DFX功能1|----|是/否|否|  
|
|安全|安全场景1|----|是/否|否|----|
|易用性|----|----|是/否|否|----|
|可修改性|----|----|是/否|否|----|
|兼容性|----|----|是/否|否|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|----|


###   [1.4 数据字典](#14-数据字典)  

不涉及。

###   [1.5 开源依赖](#15-开源依赖)  

不涉及。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|PL/SQL语法|变量A MOD 变量B|变量A对变量B做取模操作|是|


##   [3. 规格与约束](#3-规格与约束)  

|语法环境|MOD关键字,出现的位置|场景|yasdb|oracle|
|---|---|---|---|---|
|SQL语法|-|MOD关键字作为%操作符使用|不支持|不支持|
|||MOD关键字作为普通标识符使用|支持|支持|
|,PSQL语法|参数|作为变量名|支持|支持|
||声明（declare）|作为目标变量使用|支持|支持|
|||表达式中按操作符处理（addExprWordUntil）|**支持**|**支持**|
||过程体（Body）|表达式中按操作符处理（addExprWordUntil）|**支持**|**支持**|
|||当出现mod()函数时,1、如果mod字符前有其他变量，按照操作符处理,   示例：var1 := A mod (a);  或 var1 := A mod (B,C);,2、如果mod字符前没有变量，作为函数处理,  实例： var1 := mod(A,B);|支持|支持|
|||作为 select INTO 目标变量使用|支持|支持|
|||作为 fetch INTO 目标变量使用|**支持**|不支持|
|||作为游标 open,close|**支持**|不支持|
|||作为 SET 的目标变量名使用（soCompileSetVar）|**支持**|不支持|
|存储过程调用|存储过程参数的表达式中|call procedure_name(a mod b)|**支持**|不支持|
|||exec procedure_name(a mod b)|支持|支持|
|函数调用|函数参数的表达式中|select func_name(a mod b)|不支持|不支持|


注：其他未列场景，默认与Oracle行为一致。

##   [4. 特性](#4-特性)  

###   [4.1 特性功能点](#41-特性功能点)  

1. 增加MOD关键字对应的token，.isNamable属性为true，即MOD关键字可以作为变量名
1. 表达式解析（addExprWordUntil）过程中，识别PL/SQL语法环境和MOD的tokenId
    1. 如果是LWORD_NAME类型，转化为操作符类型处理
    1. 如果是LWORD_FUNCTION类型，判断mod字符前面的exprChain长度，及Node类型，区分处理。
1. 标签检查（soCompileCheckLableIsKeyword）中去除对MOD关键字的限制


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. SQL语法中，不识别MOD关键字和对应语法
1. PL/SQL语法中，MOD关键字作为变量名声明使用
1. PL/SQL语法中，MOD关键字在表达式中作为操作符使用
1. PL/SQL语法中，过程体中，MOD关键字不支持作为set目标变量使用，可以作为into目标变量使用


##   [6.未来规划](#6未来规划)  

无。  
