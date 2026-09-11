Created by 未知用户 (liaofeng), last modified by  袁昊坤 on 四月 18, 2024

IR链接：    [https://pingcode.yasdb.com/pjm/items/6611a218579a3edb84d83a8a](https://pingcode.yasdb.com/pjm/items/6611a218579a3edb84d83a8a)  

  


##   [1. 总述](#1-总述)  

表函数table()目前支持UDT类型，但不支持UDT类型的绑定参数。目前外场诉求需要table()支持plsql内的绑定参数。

###   [1.1 需求来源](#11-需求来源)  

源于国信融选市场需求，需要支持静态sql改写的绑定参数，样例如下。

```
create type objtype1 is object
(c1 number,c2 number,c3 number);
/

create type nstbtype2 is table of objtype1;
/

declare
cur1 sys_refcursor;
tab nstbtype2 := nstbtype2();
begin
open cur1 for select a.c1,a.c2,a.c3 from table(tab) a ;
end;
/

```

###   [1.3 调研文档](#13-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=150605628](https://conf.yasdb.com/pages/viewpage.action?pageId=150605628)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|table()表函数支持plsql绑定参数|在doVerifyTableFunc阶段适配绑定参数场景，plsql内的绑定参数可以从上下文语境中获取到udt类型toid，从而改写为COLLECTION ITERATOR函数。|是|是|
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
|表函数|表函数返回的结果集可以替代table作为数据源|||
|绑定参数|又称绑定变量，通过绑定参数，可以将sql语句一次解析，执行时绑定不同的变量。|||


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|语法|table()表函数支持plsql内的绑定参数|table()表函数内的参数可以为plsql的绑定参数，包括静态sql语句和动态sql语句内的绑定参数|是|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

1. 仅支持plsql内的绑定参数，协议的绑定参数不支持。


##   [4. 特性](#4-特性)  

###   [4.1 表函数增加绑定参数适配](#41-表函数增加绑定参数适配)  

在表函数verify阶段doVerifyTableFunc函数增加绑定参数适配，增加一个node->type == EXPR_PARAM的处理分支。复用原有的verifyCollTypeTableFunc能力，需要额外适配的是增加verify阶段获取绑定参数的toid能力，通过在anlGetUdtToidFromNode接口增加处理绑定参数分支函数anlGetUdtToidFromParam进行支持。

###   [4.2 静态sql获取绑定参数的tiod值](#42-静态sql获取绑定参数的tiod值)  

静态sql在prepare阶段，可以通过提前设置stmt->soExecInfo.prarentCompiler指针指向当前compiler从而获取到绑定参数对应变量的信息。增加的anlGetUdtToidFromParam函数内，对于静态sql，通过stmt->soExecInfo.prarentCompiler判断现在处于静态sql编译阶段，增加静态sql获取绑定参数tiod函数

1.根据compiler->currLine->type判断是否是OPEN或FOR的cursor。如果是OPEN cursor，则通过paramList获取相关信息。判断是否为udt类型，若是，获取tiod，若不是则报错。

2.如果是FOR cursor，则通过impCursor.inputVars获取相关信息。判断是否为udt类型，若是，获取tiod，若不是则报错。

3.否则通过prarentCompiler获取的SqlLn上的inputVars，通过绑定参数id从iputVars上拿到vid，再找对应的变量定义，判断是否为udt类型，若是，获取tiod，若不是则报错。

###   [4.2 动态sql获取绑定参数的tiod值](#42-动态sql获取绑定参数的tiod值)  

动态sql在prepare阶段，此时过程体处于exec immediateLn阶段，可以通过提前设置stmt->soExecInfo.prarentExec指向当前executor从而获取到绑定参数对应的变量信息。

增加的anlGetUdtToidFromParam函数内，对于动态sql，通过stmt->soExecInfo.prarentExec判断现在处于动态sql执行阶段，增加动态sql获取绑定参数tiod函数，实现上通过prarentExec获取的ExecuteImmediateLn，通过绑定参数id从usingClause.vars上拿到UsingVar，再找对应的变量定义，判断是否为udt类型，若是，获取tiod，若不是则报错。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。