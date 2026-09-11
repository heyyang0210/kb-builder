Created by 周彬鑫, last modified on 五月 28, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6618d1edfd997db58ad8006a](https://pingcode.yasdb.com/pjm/items/6618d1edfd997db58ad8006a)    ?    
  #YDBRD-26128 崖山DBLINK连接ORACLE支持远程调用Oracle的存储过程

崖山DBLINK连接到Oracle，支持：调用远端procedure，udf，udp.procedure, udp.function

需求范围：  单机 、YASDB连接ORACLE

# 2. 需求分析

## 2.1 功能点分析

- *支持直接调用远端的procedure，UDF，UDP.procedure，udp.function ，支持远端procedure等在本地的应用*


## 2.2 应用场景

- *支持直接调用远端的procedure，UDF，UDP.procedure，udp.function ，支持远端procedure等在本地的应用*


## 2.3 规格约束

当前基于dblink 远程调用Oracle函数及存储过程，约束包含以下方面：

- 输出、输入及返回参数 仅支持  **数据库基本类型**  对应的标量参数(即当前需求不支持游标，UDT等）
- 事务物属性：对Oracle函数及存储过程调用只限于只读事务及自治事务（或转化），不支持XA 事务。
- 不支持报错场景：函数索引，check 约束，建表default值使用函数，func_xxx@dblink_name(p1,...)%type 场景


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

远端procedure/UDF/UDP 的调用，使用场景覆盖法。

procedure/UDF/UDP功能的覆盖，使用等价类以及场景覆盖法。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


**1.1 远端procedure**

|测试点|等价类|备注|
|---|---|---|
|远端procedure有无参数|远端procedure无参|  
|
|  
|远端procedure 有参，支持当前DB所有标量数据类型,--参考DBLINK类型映射,覆盖所有标量类型,覆盖参数方向为 in ， out， in out ，并且验证参数方向正确性|  
|
|procedure调procedure|远端procedure调远端procedure,  
|包含存储过程中有事务/无事务场景，预期有非自治事务场景报错。,包含跨link调用/不跨link调用|
|  
|本地procedure调远端procedure|本地procedure内调用远端procedure,存在本地触发器，本地触发器包含远端存储过程|
|带schema调用|schema.procedure 调用远端/嵌套调用procedure|schema与udp名称重合、优先级判断|
|本地匿名块调用远端procedure|本地匿名块调用远端procedure|  
|
|  
|本地匿名块嵌套调用远端procedure|  
|
|自治事务|远端procedure声明了自治事务|  
|
|  
|本地procedure/匿名块声明了自治事务，调用远端procedure|  
|
|非自治事务|含INSERT/COMMIT/ROLLBACK ->报错|  
|
|  
|不含INSERT/COMMIT/ROLLBACK ->正常|  
|


**1.2 远端function**

|测试点|等价类|备注|
|---|---|---|
|远端function-无出参|覆盖返回值类型,--参考DBLINK类型映射，覆盖所有标量类型|  
|
|远端function 有单个/多个out出参|--参考DBLINK类型映射,覆盖所有标量类型,覆盖参数方向为 in ， out， in out ，并且验证参数方向正确性|结合远端function-return定义：,1、  返回值数据类型：,标量数据类型；,UDT(嵌套UDT)类型,2、返回值语句：,变量；,常量/变量表达式,3、用作实参|
|远端function+远端表查询|把UDF返回值插入到远端表，结合使用DML、SELECT语句|  
|
|远端function+本地表查询|覆盖function使用位置,-- 参考pl语言测试设计checklist|重点覆盖UDF的位置：group by、投影、order by |
|远端function 返回值 + 本地表insert   ，update，delete|支持|  
|
|远端UDF+外部引用+内置函数|  
|  
|
|远端function作为本地表default 列|验证不支持,-- 同类型验证 作为索引等也不支持|  
|
|函数索引|验证不支持|  
|
|function 调 function| 本地function+远端function,UDF内包含 远端UDF,UDF内包含 远端UDF+本地UDF,UDF内包含 本地内置函数+远端UDF,远端UDF嵌套调用UDF|  
|
|procefure 调 function|远端function + 本地procedure|  
|
|  
|远端function + 远端procedure|覆盖跨link/不跨link,嵌套调用与下述“function 调 procedure”相同，无需重复覆盖，完整测试一遍，后续简单覆盖。|
|function 调 procedure|本地function + 远端procedure|  
|
|  
|远端function + 远端procedure|嵌套调用与上述“procefure 调 function”相同，无需重复覆盖，简单覆盖。|
|带schema调用|schema.远端function/嵌套调用|简单覆盖|
|本地匿名块调用远端function|本地匿名块调用远端function|匿名块与procedure 相同，无需全量覆盖，简单覆盖即可|
|  
|本地匿名块嵌套调用远端function/procedure,function 调 procudure,procedure 调 function,function 调function|简单覆盖|
|绑定参数传入函数参数|execute immediate 'select :1 from dual' into a using func1();,execute immediate 'select func1(:1) from dual' into a using 1;,出入参都需要覆盖|全量覆盖数据类型，复用上述覆盖标量类型用例覆盖|


**1.3 远端udp**

|测试点|等价类|备注|
|---|---|---|
|带schema调用|schema.UDP.proc /schema.udp.function |  
|
|本地udp含远端procedure|  
|  
|
|本地udp含远端udf|  
|  
|
|远端udp含远端udf、procedure|  
|  
|
|重点测UDP调用的场景|  
|  
|


**1.4 其他场景**

|测试点|等价类|备注|
|---|---|---|
|多层嵌套调用|本地匿名块->本地存储过程->本地函数->远端函数->远端存储过程|简单覆盖即可,重点场景：,1、嵌套的时候出入参位置、类型不一致,2、跨link调用,  
    
    
    
    
    
|
|  
|本地匿名块->本地存储过程->本地函数->本地存储过程->远端存储过程||
|  
|本地匿名块->远端存储过程->远端函数->远端存储过程->远端函数||
|  
|远端函数->远端存储过程->远端函数->远端存储过程->远端函数||
|  
|本地函数->本地存储过程->本地函数->本地存储过程->远端存储过程||
|  
|远端存储过程->远端存储过程->远端函数->远端存储过程->远端存储过程||
|  
|本地存储过程->本地存储过程->本地函数->本地存储过程->远端函数||
|结合下推函数|下推函数列表：,差异列没标BIW的都是会下推的,  [yasdb和oracle可下推的函数列表 - 马士杰 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=112729419)  ,函数出现在filter里面，与sql复杂度关系不大,  
,procedure 调用下推函数,function 调用下推函数|filter的有一些函数是下推到远端执行的，这部分之前没覆盖，这次测试DBLINK需求的时候需要补充,---无需全量测试，与数据类型相关，在filter位置的函数即可|
|同义词|调用远端procedure/udf/udp 使用同义词调用|复用上述部分用例|


**1.5 不支持场景报错**

|测试点|等价类|备注|
|---|---|---|
|游标变量  |  
|验证不支持,  
|
|参数UDT复合类型|array，record，object,嵌套表类型|验证不支持|
|check 约束|  
|验证不支持|
|func_xxx@dblink_name(p1,...)%type|  
|验证不支持|
|同义词|远端procedure/function/udp调用同义词|验证不支持|
|YASHAN连接YASHAN|调用远端procedurer、UDF、UDP|拦截报错|
|分布式、集群下|  
|拦截报错|


**1.6 PLSQL场景**

|一级分类|三级分类|场景|备注|
|:---|:---|:---|---|
|语法特性|调用|PROCEDURE调用：CALL、EXEC、BEGIN .. END匿名块,UDF调用：SELECT、BEGIN .. END(通常用由变量接受或用于赋值)|简单覆盖|
||UDP调用|支持的对象：,type_definition    
  item_declaration    
  cursor_declareation    
  function_declaration    
  procedure_declaration|游标相关不支持，合理报错|
||  
|调用对象：,公有变量在实例间调用,公有类型的初始化,存储过程在不同实例间调用，传入不同类型的入参|  
|
||  
|异常情况：,权限不足,状态非有效|  
|
|  
,形参和实参|参数类型|覆盖  IN、IN OUT、OUT类型|  
|
||数据类型|1、  标量数据类型,2、  UDT(嵌套UDT)类型|UDT不支持，合理报错|
||参数赋值|初始化、变量赋值|  
|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,声明部分|  
,  
,  
,  
,  
,变量声明|1、变量类型,1)普通变量；,2)引用变量(%TYPE、%ROWTYPE)；,3)RECORD变量(TABLE%ROWTYPE、TABLE.COLUMN%type)；,4)集合变量(VARRAY、NESTED TABLE)；,5)游标：,显示游标；,隐式游标属性(QL%FOUND、SQL%NOTFOUND、SQL%ROWCOUNT、SQL%ISOPEN)；,返回类型：标量类型、UDT；,6)UDT(嵌套UDT),  
|不支持的类型：,引用变量、RECORD、集合变量、游标、UDT不支持，合理报错；,不支持的类型报错场景：,本地调用出入参涉及->报错，远端内部使用->支持。|
||自定义异常|exception_name EXCEPTION,远端自定义异常，具体表现|简单覆盖|
||  
,自治事务|pragma autonomous_transaction,1、  主事务包含COMMIT、ROLLBACK、SAVEPOINT操作,2、  子事务过程体内包含COMMIT、ROLLBACK、SAVEPOINT操作|  
|
||  
,  
,  
,UDF-RETURN定义|1、  返回值数据类型：,标量数据类型；,UDT(嵌套UDT)类型,2、返回值语句：,变量；,常量/变量表达式,3、用作实参|UDT不支持，合理报错,简单覆盖,在上述UDF用例中覆盖。|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,执行场景|普通SQL语法|1、使用对象：,TABLE：,执行  DDL、DML操作；,事务相关；,MERGE INTO；,UDT应用于TABLE；,和游标结合，OPEN CURSOR ROLLBACK,2、常用内置函数；,3、子查询操作(INSERT .. SELECT))：,单表查询：覆盖基本查询操作如聚合、排序、子查询等；,多表关联查询|简单覆盖|
||变量赋值与计算|1、  SELECT INTO、游标赋值等,2、  变量处理|简单覆盖|
||流程控制|FOR LOOP、WHILE LOOP、CASE WHEN、GOTO、IF THEN|简单覆盖|
||动态执行|EXECUTE IMMEDIATE INTO/USING|上述用例覆盖|
||过程体嵌套|PROCEDURE和UDF互相嵌套调用|上述用例覆盖|
||递归调用|  
|上述用例覆盖|
||UDT应用于PROCEDURE/UDF|  
|简单覆盖|
|异常处理部分|系统预定义异常|包含但不限于VALUE_ERROR、NO_DATA_FOUND、TOO_MANY_ROWS等|  
|
||自定义异常|异常定义->异常初始化->异常抛出->异常接收|  
|
||验证表相关操作如DML、调用其他过程体对象|||


  


**1.7 测试范围**

|部署形态| 存储|
|---|---|
|单机|行存|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是,本地调用同时远端修改并发|
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


[YDBRD-26128DBLINK支持存储过程冒烟用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDBhMWFkOWEzMzExZGM4ZTJhIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTg1LCJleHAiOjE3ODIzOTE1ODV9.ru-kDrG1X_9nrRof39JxnPiRINvCRwFLfC3BMIwqwGM)

详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[YDBRD-26128DBLINK支持存储过程冒烟用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDBhMWFkOWEzMzExZGM4ZTJhIiwicmVmX2lkIjoiNjczOTZkMDA1OTNmOTljOWZmMjM3NjQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTg1LCJleHAiOjE3ODIzOTE1ODV9.ru-kDrG1X_9nrRof39JxnPiRINvCRwFLfC3BMIwqwGM)

 (application/vnd.ms-excel)    


## Comments:

|  [](null)  ,会议名称：DBLINK连接支持存储过程测试设计评审,评审,评审时间：2024/05/07 11:00-12:00,参与人：胡晓畔、廖峰、徐伟、张欣、彭灵继、周彬鑫,1.补充schema与UDP同名时调用schema.proc的场景,2.PLSQL语法相关场景简单覆盖即可,3.补充跨link场景,4.procedure与udf嵌套重合，重点覆盖procedure、udf简单覆盖即可,评审结论：通过,Posted by zhoubinxin at 五月 09, 2024 15:58|
|---|
