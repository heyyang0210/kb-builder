Created by 李思语, last modified on 六月 03, 2024

-   [](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-)  
-   [1. 概述](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-1.概述)  
-   [2. 需求分析](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-2.需求分析)  
    -   [2.1 功能点分析](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-2.1功能点分析)  
    -   [2.3 规格约束](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-2.3规格约束)  
    -   [2.4 返回值](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-2.4返回值)  
-   [3. 详细测试设计](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-3.1测试设计方法)  
        -   [3.1.1 DBMS_SQL.TO_REFCURSOR](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-3.1.1DBMS_SQL.TO_REFCURSOR)  
            -   [等价类](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-等价类)  
            -   [场景法：](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-场景法：)  
        -   [3.1.2 DBMS_SQL.LAST_ERROR_POSITION](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-3.1.2DBMS_SQL.LAST_ERROR_POSITION)  
            -   [等价类：](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-等价类：)  
-   [4. 测试用例](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-4.测试用例)  
-   [5. 测试框架设计](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-6.测试环境说明)  
-   [7. 工作量评估](#DBMS_SQL高级包(TO_REFCURSOR,LAST_ERROR_POSITION)测试设计-7.工作量评估)  


# 1. 概述

本文描述  DBMS_SQL.TO_REFCURSOR,DBMS_SQL.LAST_ERROR_POSITION  测试设计。

SR:     [https://pingcode.yasdb.com/pjm/items/6628e06bfd997db58ae115ce](https://pingcode.yasdb.com/pjm/items/6628e06bfd997db58ae115ce)    ?    
  #YDBRD-26654 高级包DBMS_SQL新增取错误码位置的函数

# 2. 需求分析

## 2.1 功能点分析

- **TO_REFCURSOR **  : 将OPENED、PARSEd和EXECUTEd游标，并将其转换/迁移到PL/SQL可管理的REF CURSOR。
- **LAST_ERROR_POSITION **  : 用于返回  发生错误的SQL语句文本中的字节偏移量  **。**  （  在PARSE之后，在调用任何其他DBMS_SQL过程或函数之前调用此函数。）


语法：

```
DBMS_SQL.TO_REFCURSOR(
   cursor_number IN OUT INTEGER)
  RETURN SYS_REFCURSOR;

DBMS_SQL.LAST_ERROR_POSITION
   RETURN INTEGER;

```

## 2.3 规格约束

|函数|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|---|
|TO_REFCURSOR|cursor_number|IN OUT|INTEGER|是|要转换为  REF CURSOR的游标ID|- 入参为被转换的cursor id，出参被设置为NULL
- 传入的游标必须为open，parse和execute过的，其他情况将报错（fetch过也可以，但不能fetch到eof的）
- 只能对select游标使用。
- 一旦cursor_number被转换为ref cursor后，cursor_number将不能被其他dbms_sql使用（包括DBMS_SQL.IS_OPEN）。
|


## 2.4 返回值

|函数|返回类型|说明|
|---|---|---|
|TO_REFCURSOR|SYS_REFCURSOR|返回从DBMS_SQL游标编号转换的PL/SQL REF CURSOR|
|LAST_ERROR_POSITION|INTEGER|返回  发生错误的SQL语句文本中的字节偏移量，SQL语句中的第一个字符位于位置0。|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

### 3.1.1 DBMS_SQL.TO_REFCURSOR

#### 等价类

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|1个（符合要求的参数）|执行成功|0，2个|报错，提示正确|
|/|参数类型|- cursor_number：int或可隐式转换为int类型
|  
|- cursor_number：时间/json/xmltype/rowid/urowid/blob/clob/nclob/raw/自定义
|报错，提示正确|
|  
|参数值|正常调用open，parse和execute后返回的游标ID|  
|- 指定不存在的游标ID
- open后的  游标ID
- open parse后的  游标ID
- close后的  游标ID
- NULL值
- 常量
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|返回值校验|返回值类型|使用typeof查询返回值类型正确|  
|  
|  
|
|  
|返回值|输出返回值|  
|  
|  
|
|出参校验|cursor_number|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|子函数调用次数|/|1次|  
|2次|  
|
|parse的statement参数类型|/|select （cte查询，+for update,start with,CONNECT_BY_ROOT，union 等等）|  
|ddl，dcl，非select的dml 语句|  
|
|动态执行|/|to_refcursor动态执行绑定参数|  
|  
|  
|


#### 场景法：

|分类|场景|
|---|---|
|在plsql中应用    
    
|自定义函数|
||匿名块|
||package|
||procedure|
|TO_REFCURSOR与dbms_sql其他函数结合使用|open→ parse→ execute→ to_refcursor→ is_open|
||open→ parse→ execute→ to_refcursor→ close|
||open→ parse→ execute→ to_refcursor→   fetch_rows|
||open→ parse→ execute→ fetch_rows→ to_refcursor(1. fetch_rows到最后一行，再调用to_refcursor；2. fetch_rows到不是最后一行，再调用to_refcursor)|
||dbms_sql.return_result|
||parse →  EXECUTE →  parse →  to_refcursor|
||parse →  EXECUTE →  parse →  EXECUTE →  to_refcursor    
  declare|
||parse →  parse →  EXECUTE →  to_refcursor|
||parse → EXECUTE → fetch →  execute →  to_refcursor    
  declare|
|cur:=DBMS_SQL.TO_REFCURSOR,调用函数前cur校验|cur为ref cursor |
||cur为sys cursor|
||cur非动态游标（显示游标，package游标，标量等）|
||cur是已声明的|
||cur 是已open的|
||cur已fetch的|
||cur是已关闭的|
||cur异常捕获后，再调用TO_REFCURSOR函数赋值|
|cur:=DBMS_SQL.TO_REFCURSOR,调用函数后,cur校验|cur游标执行open (open cur for select .... )|
||cur游标执行fetch (fetch cur  into ... / fetch cur bulk collect into ...）|
||cur游标执行close（close cur）|
||cur游标赋值操作|
||游标属性校验（  %isopen,%found,%notfound,%rowcount  ）|
||cur游标fetch后重新open再fetch|
||cur作为实参 |
||类型继承%type|
||cur异常捕获后，cur输出|


### 3.1.2 DBMS_SQL.LAST_ERROR_POSITION

#### 等价类：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|函数调用次数 |/|1次|  
|  
|  
|
|  
|  
|多次|  
|  
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|返回值校验|返回值类型|使用typeof查询返回值类型正确|  
|  
|  
|
|  
|返回值|输出返回值，并校验值|  
|  
|  
|
|动态执行|/|动态执行绑定参数|匿名块动态执行里面动态sql 出错后返回位置怎么计算？|  
|  
|
|函数调用顺序|/|未open，直接调用|返回值=0|  
|  
|
|  
|/|在parse后调用，parse有错误，异常捕获 调用函数|返回值=sql文本错误位置-1|  
|  
|
|  
|/|在parse后调用，parse有错误，异常捕获 先close后，再调用函数|返回值=0|  
|  
|
|  
|/|在parse后调用，parse成功，调用函数|返回值=0|  
|  
|
|  
|  
|在execute后调用，parse成功，execute失败，异常捕获 调用函数|返回值=sql文本错误位置-1|  
|  
|
|  
|  
|在execute后调用，parse成功，execute成功，调用函数|返回值=0|  
|  
|
|  
|  
|在fetch_rows后调用，parse成功，execute成功，fetch失败，调用函数|oracle:返回值=sql文本错误位置-1,yasdb：只对于parse和execute阶段进行设置pos|  
|  
|
|  
|/|在close后调用|返回值=0|  
|  
|
|使用场景|plsql|自定义函数，匿名块，package，procedure|  
|  
|  
|
|  
|parse函数statement参数出错语句分类|分类：ddl，dcl，dml，匿名块(1.普通匿名块出错，2.匿名块里面调用dbms_sql出错异常捕获在外层，3..匿名块里面调用dbms_sql出错异常捕获在内层)|匿名块场景2，3和函数调用顺序(parse阶段出错，execute阶段出错)正交测试|  
|  
|
|  
|  
|是否绑定参数|  
|  
|  
|
|  
|statement出错次数|0次，1次，多次|多次：返回最后一次出错的位置偏移量-1|  
|  
|


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

  [dbms_lob文本用例.xlsx](#)  

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：