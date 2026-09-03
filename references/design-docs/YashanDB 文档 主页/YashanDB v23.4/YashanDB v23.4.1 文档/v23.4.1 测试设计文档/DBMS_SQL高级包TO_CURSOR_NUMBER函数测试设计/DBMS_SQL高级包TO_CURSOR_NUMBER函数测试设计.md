Created by 张江, last modified on 七月 16, 2024

# 1.概述

SR链接：    [https://pingcode.yasdb.com/pjm/items/662667e1fd997db58adf293b](https://pingcode.yasdb.com/pjm/items/662667e1fd997db58adf293b)    ?#YDBRD-26591 新增DBMS_SQL系统包RAW类型子函数

# 2.需求分析

# 2.1功能点分析

BMS_SQL.TO_CURSOR_NUMBER：  用于获取并将已打开的强类型或者弱类型的REF CURSOR转换为dbms_sql游标编号(ID)。语法结构如下：

DBMS_SQL.TO_CURSOR_NUMBER( rc IN OUT SYS_REFCURSOR) RETURN INTEGER;

其中rc为需要转换为游标编号的ref cursor，返回值为dbms_sql使用的游标ID，类型为integer。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机、集群和分布式环境。

# 3.详细测试设计

## 3.1测试设计方法

主要采用等价类划分、场景法组合进行设计。

## 3.2详细测试设计

### 3.2.1等价类划分

DBMS_SQL.TO_CURSOR_NUMBER( rc IN OUT SYS_REFCURSOR) RETURN INTEGER

|输入条件1|输入条件2|有效等价类|无效等价类|
|:---|:---|:---|:---|
|  
,  
,参数校验|参数个数|1个|参数个数不为1|
||  
,参数类型|1、rc：,- 系统预定义sys_refcursor
- type ... is ref cursor
,1. 不带return子句
|  
,rc：非动态游标类型|
||参数值|  
,rc：  已open或open+fetch后的ref cursor,  
|c：,- 游标定义未打开
- 游标打开后关闭
- null、空串''
- 常量值
- type ... is ref cursor return
|
||参数名|- 使用位置参数传值验证
- 使用关键字参数传值验证
|/|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|返回值类型|使用typeof查询返回值类型正确|/|
||返回值|校验返回值|/|
|数据规格|/|同一个session下最多可定义和打开300个动态游标|/|
|异常处理|/|编译阶段异常：,- 参数缺失或过多
- 参数类型为非  动态游标类型
,执行阶段异常：,- 游标未打开
- 游标打开后关闭
- 可通过系统预定义异常(  INVALID_CURSOR  )去捕获
|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行to_cursor_number操作|/|


### 3.2.2使用场景

|分类|使用场景|备注|
|---|---|---|
|  
,动态游标来源|- open cursor for query
- open cursor for query using
- 自定义函数返回值
- 自定义package中子函数返回值
- dbms_sql.to_refcursor
- 游标变量赋值给另一个游标变量
- 游标查询语句来源于package全局变量
|  
|
|  
,  
,  
,动态游标语句样式|- select 表列
- select 表达式操作(内置函数、四则运算等)
- CTE查询：with table as select
- select 子查询
- select 视图/物化视图
- select 自定义函数
- select case when
- select 系统表
- select table表函数
- select 递归查询
- select 分区表(select * from tab partiton(partition_name))
|挑几种去覆盖|
|使用对象|匿名块、存储过程、自定义函数、自定义package及其嵌套子过程/子函数|  
|
|  
,返回值其他场景交互|- 回写表操作
- 用作存储过程/自定义函数/嵌套子过程/子函数的出入参
- 用作package子过程/子函数出入参
- 转换后的游标ID使用dbms_sql.to_refcursor转换为ref cursor用在其他场景(如return_result入参、存储过程/自定义函数/嵌套子过程的出入参等)
- 使用绑定参数形式作为DBMS_SQL子过程/子函数的游标ID
|  
|
|  
,  
,  
,结合DBMS_SQL其他子过程/子函数|转换后的游标ID用作其他DBMS_SQL子过程/子函数的游标ID,parse→execute-close_cursor|  
|
||parse->bind_variable->execute→variable_value->close_cursor|  
|
||parse->bind_array->execute->close_cursor|  
|
||define_column->fetch_rows->column_value->close_cursor|  
|
||parse->bind_variable->define_array->execute->fetch_rows->column_value->close_cursor|  
|
|异常场景|- 转换为cursor number后，再次调用execute、execute_and_fetch操作报错invalid cursor
- 转换前游标进行fetch操作，若fetch到底，转换后调用fetch_rows子函数报错statement is eof
- 转换后调用出参rc报错invalid cursor
- 游标fetch到中间某一行时出错，如ZERO_DIVIDE、INVALID_NUMBER异常
|  
|
|  
,  
,curid := dbms_sql.to_cursor_number(cur)，调用后cur校验,  
|游标属性校验(  %isopen,%found,%notfound,%rowcount  )|  
|
||再次执行dbms_sql.to_cursor_number|  
|
||重新open后执行fetch操作|  
|
||重新open后执行赋值操作|  
|
||重新open后执行dbms_sql.to_cursor_number|  
|
|  
,  
,cur2 := cur1,curid := dbms_sql.to_cursor_number(cur2)，调用后cur1校验|游标属性校验(  %isopen,%found,%notfound,%rowcount  )|  
|
||执行fetch、close操作|  
|
||重新open cur2后，检查cur1游标属性校验(  %isopen,%found,%notfound,%rowcount  )|  
|
||重新open cur2后，cur1执行fetch、close操作|  
|
||重新open cur2后，cur1执行dbms_sql.to_cursor_number操作，检查cur2游标属性(  %isopen,%found,%notfound,%rowcount  )|  
|


## 3.3DFX测试

梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|DFR|否|
|HA|否|
|KT|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|压力|否|
|可维护性|否|
|安全|否|
|性能|否|
|长稳|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*