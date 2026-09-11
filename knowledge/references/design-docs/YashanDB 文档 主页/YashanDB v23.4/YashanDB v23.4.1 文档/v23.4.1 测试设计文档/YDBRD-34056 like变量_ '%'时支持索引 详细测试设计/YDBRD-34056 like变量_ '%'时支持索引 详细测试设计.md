Created by 钟溱, last modified on 十月 29, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/670cc405e489dd0868f701d4](https://pingcode.yasdb.com/pjm/items/670cc405e489dd0868f701d4)    *?*    
  #YDBRD-34056 like变量|| '%'时支持索引

该需求支持filter  like右边为变量时，可以走算子index rangeScan，从而提高执行性能

# 2. 需求分析

## 2.1 功能点分析

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|filter like右边的表达式为包含param的复杂表达式时支持走index range Scan|在生成rangeSet的判断条件上增加分支判断复杂表达式的分支|是|是|
|功能|filter like右边的表达式为包含静态子查询的复杂表达式时支持走index range Scan|在生成rangeSet的判断条件上增加分支判断的分支|是|是|
|性能|选上索引后性能|加快查询速度|是|是|


优化场景如下：

表达式覆盖系统变量，常量，列，函数，外部引用，非关联子查询；

  


性能场景：

数据量小，命中少，性能无明显提升

数据量大（十万百万），命中少，性能上升

数据量大（十万百万），命中大 ，预期可能性能差

## 2.2 应用场景

1、本身应用场景：查询性能优化，优化场景见功能点分析

2、关联特性：无

## 2.3 规格约束

1. 复杂表达式中仅支持出现EXPR_SYSVAR/EXPR_PARAM/EXPR_CONST/EXPR_REF(外部引用)/EXPR_DATA_TYPE/EXPR_ADD/EXPR_SUB/EXPR_MUL/EXPR_MOD/EXPR_DIV/EXPR_CAT(||)/EXPR_NEG(取反)/EXPR_QUERY/EXPR_FUNCTION
1. 复杂表达式中出现SYSVAR时，仅支持出现SYSVAR_SYSDATE/SYSVAR_SYSTIMESTAMP/SYSVAR_NULL/SYSVAR_UTC_TIMESTAMP/SYSVAR_USER
1. 复杂表达式中出现FUNCTION时，该函数的每个入参也必须为上述表达式类型
1. 复杂表达式中出现子查询时，必须为非关联静态子查询


# 3. 详细测试设计

## 3.1 测试设计方法

本特性测试设计，主要使用等价类、边界值、场景分析等测试设计工程方法。

## 3.2 详细测试设计

1.使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式

|条件1|条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|---|:---|:---|
|非%开头的包含param的复杂表达式|系统变量|EXPR_SYSVAR|仅支持出现,SYSVAR_SYSDATE,SYSVAR_SYSTIMESTAMP,SYSVAR_NULL,SYSVAR_UTC_TIMESTAMP,SYSVAR_USER|  
|  
|
|||EXPR_PARAM|绑定参数。 通常用占位符表示。用于指向实际传入的绑定参数内容。,plsql中的输入参数一般也会转换成PARAM的形式。|  
|  
|
|||EXPR_CONST|表示常量的表达式类型|  
|  
|
|||EXPR_REF|表示外部引用|  
|  
|
|||EXPR_DATA_TYPE|用于表示sql语句中cast语法转换的目标类型。 |  
|  
|
|||EXPR_ADD|二元运算符 + ，两个表达式相加操作。|  
|  
|
|||EXPR_SUB|二元运算符 - ，两个表达式相减操作。|  
|  
|
|||EXPR_MUL |二元运算符 *，两个表达式相乘操作。|  
|  
|
|||EXPR_MOD|二元运算符 %，两个表达式取余操作。|  
|  
|
|||EXPR_DIV|二元运算符 /，两个表达式相除操作。|  
|  
|
|||EXPR_CAT(||)|二元运算符 |，两个表达式拼接操作。|  
|  
|
|||EXPR_NEG(取反)|一元运算符 -，表达式取反操作。|  
|  
|
|||EXPR_QUERY|子查询语句。通常位于filter in、exists等条件位置中。|  
|  
|
|||EXPR_FUNCTION|用于表示sql语句中的内置函数。通常是 function+args的组合去形成EXPR_FUNCTION。|  
|  
|
|  
|FUNCTION|函数的每个入参也必须为上述表达式类型|挑一些常见的覆盖|  
|  
|
|  
|子查询|非关联静态子查询|  
|  
|  
|
|  
|column|列数据带%|  
|  
|  
|
|  
|外部引用|位于子查询中|  
|  
|  
|
|  
|运算符|- 比较运算符：=、!=、<、>、<=、>= 
- 逻辑运算符：AND、OR、NOT
- 算术运算符: +、-、*、/、%、MOD、DIV
- 连接运算符: ||、CONCAT
|  
|  
|  
|
|  
|常量|数值常量、字符常量、时间常量、布尔常量、二进制常量  （bit）、特殊值null|  
|  
|  
|
|  
|udt|CREATE TYPE|  [自定义类型 | YashanDB Doc](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/PL%E5%AF%B9%E8%B1%A1/%E8%87%AA%E5%AE%9A%E4%B9%89%E7%B1%BB%E5%9E%8B.html)     待考虑 oracle应该也是不支持（待确定）|  
|  
|
|  
|udf|CREATE FUNCTION|  [自定义函数 | YashanDB Doc](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/PL%E5%AF%B9%E8%B1%A1/%E8%87%AA%E5%AE%9A%E4%B9%89%E5%87%BD%E6%95%B0.html)     待考虑 oracle应该也是不支持（待确定）|  
|  
|
|%|位置|like :a||'%'|  
|  
|  
|
|||like '%'||:a|  
|  
|  
|
|||like '%' ||:a|| '%'|  
|  
|  
|
|||like :a|| '%'|| :a|  
|  
|  
|
|||子查询内|  
|  
|  
|
|||连续多个|  
|  
|  
|
||个数|单个|  
|  
|  
|
|||多个|无限制|  
|  
|
|以%开头的包含param的复杂表达式|同上,  
|  
|  
|  
|  
|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|跑一下|
|长稳|  
|跑一下|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|是|数据量小，命中少，性能无明显提升,数据量大（十万百万），命中少，性能上升,数据量大（十万百万），命中大 ，预期可能性能差,取外场的用例执行|
|可维护性|  
|  
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

  [详细测试设计文档模板.doc](#)  

## Attachments:

[image2024-10-29_14-55-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWJjZjc4OTcwYzJhZjRmNTMwN2IzIiwicmVmX2lkIjoiNjczOWJjZjc3MjgyMDZlZmI5MzBhODFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDYwMDYxLCJleHAiOjE3ODI1NDY0NjF9.N5pVr5GUvoFtkpTddBuOGLdrcNu2F1OPNPDSBJ0UdYs)

 (image/png)    
