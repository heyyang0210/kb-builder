Created by 张欣, last modified on 七月 17, 2024

# 1. 概述

1.plsql解析加固；

2.流程跳转，异常处理，嵌套等逻辑出栈场景，验证流程正确，变量正常释放。

# 2. 需求分析

2.1问题单分析

|  
|标题|根因|加固测试内容|
|---|---|---|---|
|  [YDBRD-28765](https://pingcode.yasdb.com/agile/items/665ee39a288e1978209bc65e)  |【plsql】【label】异常捕获嵌套begin end, 标签跳转未拦截|检查goto是否合法时，curBeginBlockId未随pop block切换到最外层begin block|1.原用例场景，异常处理单元goto + label跳转到主执行单元各个位置,2.异常处理单元，流程控制中 + label跳转到主执行单元其他位置,流程控制覆盖：,条件选择：if，case when,循环：for(普通，游标),while,loop,continue,exit,return,3.  **出栈场景内触发异常，走到异常处理，异常捕获/未捕获**,出栈场景见下面整理,4.其他：,异常处理单元再触发当前/其他异常,动态执行 动态语句内部触发异常,  
|
|  [YDBRD-27973](https://pingcode.yasdb.com/agile/items/664c7267288e197820903f02)  |【存储过程】 调用存储，出现soGetCursorStmt core|动态游标执行走到异常处理，在异常处理部分fetch该游标，  context为null，getCursorStmt时core|1.原用例场景，动态游标执行走到异常处理，在异常处理部分fetch该游标，访问游标属性,2.for循环+显式游标/隐式游标/游标变量   **执行**  走到异常处理（如何触发? 查询到执行阶段才报错），在异常处理部分fetch该游标，访问游标属性,3.for循环+显式游标/隐式游标/游标变量   **fetch过程**  走到异常处理，在异常处理部分fetch该游标，访问游标属性,4.pkg显式游标,  
|
|  [YDBRD-28514](https://pingcode.yasdb.com/agile/items/6656f9c8288e1978209741b9)  |【select into】select into使用方式不对，如select into rec *  from PSlot不报错，oracle会报错|过程体内部解析select into语法，select后直接跟into未报错|语法关键字位置发散，包括游标，动态SQL|
|  [YDBRD-29300](https://pingcode.yasdb.com/agile/items/666fee06288e197820a687ca)  |CLONE-【23.2】【业务场景测试】存储过程内的静态SQL hint失效|lexTryRead里把注释和hint去掉了，导致try之后丢失了子查询中的hint信息|静态SQL,动态SQL hint生效情况验证，hint出现在子查询，,子查询位置：,in,exists,嵌套，cte等|
|YDBRD-29242|【外场】过滤条件使用like模糊匹配，带圆括号将like匹配条件括起来后，SQL语句执行报错，Oracle执行不报错|有括号的场景走入了subFilter的判断，括号后是fetch，缺少对于fetch的判断，没有把括号里的内容当成一个filter。    
  从而走入别的流程报错了。|静态SQL,动态SQL中使用带括号的匹配条件,游标+offset_fetch_clause|
|YDBRD-30285|【自提单】存储过程char类型out形参指定raw/blob/clob/nclob类型实参，输出结果有误|根因分析,raw/blob/clob/nclob类型未处理，按32000字节长度填充空格，超过raw的size导致core，填充空格导致lob类型用例报错,修改方案,raw/blob/clob/nclob类型取实际的字节长度 不填充空格|形参：char/nchar out/in out类型,实参：raw/blob/clob/nclob,,rowid/json/xmltype/rownum/boolean,,char/nchar/char(n char),数值/时间日期/时间间隔|
|YDBRD-30196|【自提单】执行动态sql绑定参数char类型赋值未填充空格|给绑定参数赋值时apply type desc给char填充空格,原来未填充|绑定变量左值是char,nchar,obj/varray/nstb成员是char,nchar ,赋值 验证需要填充空格,赋值方式：set,select into,fetch，out出参|


  


2.2场景梳理：

触发出栈的场景：

流程控制：

**条件选择**  :

- if条件判断 


IF THEN; IF THEN ELSE; IF THEN ELSIF

- case条件选择 


CASE selector WHEN；CASE WHEN condition

**循环控制**  :

- for
- forall 批量执行
- while
- loop


**顺序控制**  ：

- goto


**逻辑跳转**  ：

- exit
- continue
-  label
- return


逻辑跳转会触发  **提前出栈**

**以上几种嵌套组合**

**游标**  ：

for+ 隐式游标/显式游标/游标变量

显式游标带参数open

**嵌套结构**  ：

嵌套的语句区，变量声明区

嵌套子过程

**异常处理：**

任意位置触发异常会  **提前出栈**     出栈后继续访问或修改变量

  


  


流程控制+异常

各类流程在栈内，触发提前出栈，验证变量（local 外层定义，pkg变量，游标）状态

异常触发的位置

变量声明区，语句区，语句区的嵌套block的变量声明区，语句区，异常处理单元

  


出栈+变量释放场景

变量在变量声明区：变量初始化default值；构造函数中使用；record type声明 成员default值；子过程的形参default值；游标形参default值；游标声明语句；

变量在语句区：赋值；过程/函数形参；静态SQL: select,DML,游标语句；动态SQL：绑定变量，动态游标；

  


  


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用场景分析，条件组合方法。

## 3.2 详细测试设计

流程控制+异常跳转

|最外层|  
|变量类型|异常触发位置|异常（出栈）触发方式|验证点|
|---|---|---|---|---|---|
|if|if - else -if ..,if - for - if,if- for游标,if - case when - if,if - if-case when,if - while - if,if - loop - if,if - else -if ..+（goto label,return）,if- for游标 +(exit,contine,goto label,return),if - while - if +(exit,contine,goto label,return),if - loop - if+(exit,contine),if - forall|外层声明的变量,语句块有变量声明区，内部声明的变量,pkg变量|内层（2，3层）触发异常|系统异常触发 no_data_found等；,raise;,raise + 句柄;,raise_application_error,  
,  
|1.流程跳转正确,2.变量正常释放|
|case when|case when - if - case when,case when 多层嵌套+（goto label,return）,case when 多层嵌套 128，256,case when -for游标,case when - for -loop,case when -while -if,case when -for游标+(exit,contine),case when - for -loop +(exit,contine,goto label,return),case when -while -if +(exit,contine,goto label,return),case when - forall|  
|  
|  
|  
|
|for |for - if - case when,for游标 - if - case when,for游标 -for游标 ,for - loop - while,for游标- while - loop,for - if - case when+（goto label,return）,for游标 - if - case when+(exit,contine),for - loop - while+(exit,contine),for游标- while - loop+(exit,contine,goto label,return)|  
|  
|fetch过程中触发异常,(历史是否覆盖)|for + 隐式cursor,for + 显式cursor带参数,  
|
|while|while - if -if,while - case when -loop,while - if -if +(exit,contine,goto label,return)|  
|  
|  
|  
|
|loop|loop-case when - if,loop - while -for,loop-case when - if +（goto label,return）,loop - while -for+(exit,contine)|  
|  
|  
|  
|
|forall|forall内部只支持DML不支持嵌套,if - forall,case when - forall,for/loop/while - forall |  
|forall内部的DML执行过程中|  
|  
|


  


  


其他出入栈场景

|  
|场景|异常触发位置|异常（出栈）触发方式|验证点|
|---|---|---|---|---|
|显式游标带参数open|显式游标open在外层，内层是流程控制语句,显式游标open在外层，内层是嵌套的匿名块,显式游标open在外层，内层是子过程|内层|系统触发 no_data_found,INVALID_NUMBER等；,raise;,raise + 句柄;,raise_application_error,goto +label,  
,  
    
|1.流程跳转正确,2.变量正常释放,3.内层继续fetch或重新open - fetch 结果正常,  
    
|
|嵌套的语句区，变量声明区|内层用了外层变量,内层变量，基于外层的类型或变量,2-5层嵌套|内层的变量声明区：,- 变量初始化default值；
- 构造函数中使用；
- record type声明 成员default值；
- 子过程的形参default值；
- 游标形参default值；
- 游标声明语句；
,内层的语句区：,- 赋值：set,select into/bulk into,fetch into/fetch bulk into；insert return into,execute into;
- 过程/函数形参；out出参
- 静态SQL: select,DML,游标语句；
- 动态SQL：绑定变量，动态游标；
|||
|嵌套子过程|子过程用了外层变量,子过程变量，基于外层的类型或变量,pkg变量|子过程头部：,- 形参type
- 形参default值
,子过程变量声明区：同上,子过程语句区：同上,  
|||


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  
