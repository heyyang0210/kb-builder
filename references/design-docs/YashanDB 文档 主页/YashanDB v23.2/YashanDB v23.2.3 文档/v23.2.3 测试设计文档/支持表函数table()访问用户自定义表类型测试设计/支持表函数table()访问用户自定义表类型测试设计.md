Created by 张江, last modified on 四月 23, 2024

# 1.概述

SR链接：    [YDBRD-29069](https://jira.yasdb.com/browse/YDBRD-29069?src=confmacro)    -  支持表函数table() 访问用户自定义表类型  设计中

本次需求主要是在过程体语句中实现表函数table()访问用户自定义集合类型，包含嵌套表和varray及其嵌套结构，同时不影响在普通sql场景中使用表函数功能。

# 2.需求分析

## 2.1功能点分析

表函数是用于访问嵌套表、varray集合类型，同时可以关联使用数组函数返回一组数据集的函数。语法结构图如下：

![](https://conf.yasdb.com/download/attachments/147776909/image2024-4-1_17-49-19.png?version=1&modificationDate=1711964960000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYyNTAsImV4cCI6MTc4MjMxNzA1MH0.QM4OGaPN_MeuiV2d6WXi1kRSLB0YWRc6D2W2DkVEkYA)

其中collection_expression 可以是udt类型变量或变量表达式、子查询、表列、自定义函数或集合构造函数，返回一个集合值，类型为嵌套表或varray。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机(集群是否也包含?)。

本次需求table()函数主要使用在select语句中，输入参数为udt集合类型。

# 3.详细测试设计

## 3.1测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

本次测试设计主要采用等价类和场景法及其组合方法。

## 3.2详细测试设计

### 3.2.1等价类测试点

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|  
,  
,  
,参数/表达式    
    
|参数/表达式个数|1|0或者大于1个|
||参数类型|udt类型(有toid)：,1)单层嵌套表、varray类型,2)嵌套类型|1)非udt类型的其他标量类型如数值型、字符型、日期型、布尔型、大对象型等,2)无toid的udt类型,3)udt-object类型,4)嵌套udt中外层为object类型|
||参数/表达式值|1)udt类型的变量或变量表达式：可以是未初始化的，初始化后的(初始化后元素值可以为null、空串''等),2)函数(输入参数来源已覆盖)：,自定义函数：返回值为udt集合类型,集合构造函数如string_to_array、array_append、array_remove、array_replace,3)select表达式(输入参数来源已覆盖)：,select 伪列(column_value),select 嵌套子查询,select 自定义函数|1)非udt类型的变量或变量表达式,2)返回值为非udt集合类型的自定义函数,3）select投影列个数大于1,select投影列类型非udt集合类型,4)非法的表达式操作如使用concat(udt,varchar),5)输入参数为非法值如null、空串''等|
|关键字校验(可选)|/|table函数名大小写|table函数名拼写有误|
|返回值校验|返回值类型|使用typeof函数对table函数展开后的元素类型查询|/|
||返回值|检查table函数展开后的数据内容是否正确|/|
|异常处理|/|编译阶段报错：如校验table入参类型是否为udt集合类型，语法校验|/|
|权限控制|/|需要对table函数中引用的udt类型和表等对象进行权限验证,1、过程体外创建的udt类型是否有调用权限,2、访问package的全局udt类型和变量时，package的访问权限,3、访问表列时对应表的访问权限|/|


### 3.2.2场景测试点

|场景点|一级模块|二级模块|备注|
|---|---|---|---|
|table()函数引用位置|PLSQL过程体对象|匿名块、自定义函数、存储过程、package|/|
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
,  
,  
,  
,  
,  
,  
,  
,  
,table()函数使用场景    
    
    
|select into语句中使用table函数|select xxx into var from table()|/|
||  
,  
,  
,execute immediate动态执行table()函数|匿名块执行table()函数作为整体使用  execute immediate执行|/|
|||  
,  
,  
,动态执行select xxx from table(:x)语句|/|
||for循环游标中使用|for循环隐式游标|/|
|||for循环显示游标|/|
||  
,动态游标中使用+fetch|open cursor for select statement,fetch cursor into ,[fetch cursor bulk collect into]|/|
||  
,  
,  
,  
,  
,  
,  
,动态游标+绑定参数+fetch|open cursor for sql_variable using,fetch cursor into ,[fetch cursor bulk collect into]|/|
||  
,  
,dml语句中使用|insert into tab select xxx from table(x)|/|
|||update tab set col=xxx where col=(select xxx from table(x)),update tab set col=(select xxx from table(x)) where col=xxx|运算符包含但不限于=、in、not in、<>等|
|||delete from tab where col=(select xxx from table(x)) |运算符包含但不限于=、in、not in、<>等|
|||merge into tab1 using (select xxx from table(x)) tab2,on (tab1.col=tab02.col)|/|
|  
,  
,  
,  
,table()函数输入参数来源    
    
    
    
|过程体外创建的udt集合类型及其嵌套||/|
||udt集合类型的表列||/|
||成员类型为udt集合类型的object对象||/|
||成员类型为udt集合类型的record变量||/|
||访问package全局udt集合类型||/|
||访问package全局udt集合类型变量||/|
||调用自定义函数||/|
||使用集合构造函数如string_to_array、array_append、array_remove、array_replace(根据实际执行结果)||/|
||使用子查询/嵌套子查询||/|


2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|  
|
|:---|:---|:---|
|CT|是|  
|
|KT|/|  
|
|长稳|/|  
|
|一致性|/|  
|
|三方测试工具    
  (DBeaver)|/|  
|
|安全|/|  
|
|DFR|/|  
|
|HA|/|  
|
|压力|/|  
|
|性能|/|  
|
|可维护性|/|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 主要使用guider框架实现功能用例自动化；
- testkill框架实现CT,KT用例自动化；
- 需要增加部分JDBC用例，使用JDBC框架自动化。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：