Created by 周彬鑫, last modified on 十二月 12, 2023

# 1. 概述

LISTAGG函数将指定的列执行拼接操作，并通过分隔符分隔，返回一行VARCHAR/RAW类型的字符串。

# 2. 需求分析

### 2.1 语法图

![](https://conf.yasdb.com/download/attachments/130131949/listagg.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU4NzksImV4cCI6MTc4MjMwNjY3OX0.xLWvQsAOxORDqduqZFPlvJSwouQs8DAM-wWkifT4h_8)

  


*listagg_overflow_clause*  ::=

![](https://conf.yasdb.com/download/attachments/130131949/listagg_overflow_clause.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU4NzksImV4cCI6MTc4MjMwNjY3OX0.xLWvQsAOxORDqduqZFPlvJSwouQs8DAM-wWkifT4h_8)

  


### **2.2 规格限制**

- string默认最大输出长度8000， raw最大输出长度16000，超过则根据是否设置truncate处理
- 不支持配置参数设置 standard or extent 模式
- 对于raw类型，我们会完整输出，oracle是截断的。输出规则（计算溢出规则，溢出之后处理规则，参考第2节）跟varchar保持一致
- 不论实际拼接的expr是否有溢出， 当终止符或分隔符长度超过8000或者（分隔符长度）+ （终止符长度）+ （withcount26个字节）超过8000, 直接报错（前面的括号表明存在这些表达式才进行计算）
- 不支持bit跟bool类型、udt
- 分隔符可以是常量、静态表达式（cast as date以及sysdate等都属于）；终止符只能是常量（cast as date，sysdate等都不属于）
- float、double、number类型的拼接跟oracle会有出入，因为精度是一定的。
- 对于clob、blob、json，在转字符串时，如果长度超过32000，会直接报错，无论是否设置truncate
- 拼接行如果是 Null，则该行会被省略
- 拼接溢出时，在计算count时，如果后续行有null值，则该行不会被算到count当中
- 如果拼接行时未溢出，但是拼接分隔符时溢出，则在溢出处理时，该行也不会显示，count计算会加上该行
- 列存对于溢出退化的规则与行存聚集函数的表现一致（行存LISTAGG作为聚集函数与窗口函数的退化规则不一致。聚集函数：退化后终止符为'...' 打印不超过8000的所有行+分隔符以及终止符，不打印最后一个分隔符。窗口函数：退化后只打印'...' 以及with count行数（若有），不打印任何行


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|LISTAGG（ ALL/DISTINCT measure_expr [, delimiter] [ listagg_overflow_clause]）|不填ALL/DISTINCT，默认为ALL listagg (expr, delimiter)|  
|
|  
|listagg (expr, delimiter ON OVERFLOW ERROR)|  
|
|  
|listagg (expr, delimiter ON OVERFLOW TRUNCATE '--')|  
|
|  
|listagg (expr, delimiter ON OVERFLOW TRUNCATE WITH COUNT)|  
|
|  
|listagg (expr, delimiter ON OVERFLOW TRUNCATE WITHOUT COUNT)|  
|
|  
|listagg (ALL expr, delimiter ON OVERFLOW ERROR)|  
|
|  
|listagg (DISTINCTexpr, delimiter ON OVERFLOW ERROR)|  
|
|  
|...|  
|
|measure_expr|为空值忽视|clob、blob，在转字符串时，如果长度超过32000，会直接报错，无论是否设置truncate|
|  
|支持raw、char、varchar、int、float、double、date、time、timestamp、interval year to month、interval day to second、blob、clob、json|不支持bit、bool|
|  
|常量/变量表达式|  
|
|delimiter|常量/常量表达式|变量|
|  
|支持raw、char、varchar、int、float、double、date、time、timestamp、interval year to month、interval day to second、json|不支持clob，blob，bit，bool|
|  
|默认为NULL|  
|
|  
|stable表达式（sysdate、now）|  
|
|  
|  
|大于8000 直接报错(raw为16000)|
|  
|  
|多个分隔符|
|ON OVERFLOW TRUNCATE 'truncation-indicator' WITH/WITHOUT COUNT|未设置时默认溢出报错ON OVERFLOW ERROR|  
|
|  
|ON OVERFLOW ERROR|  
|
|  
|ON OVERFLOW TRUNCATE 'truncation-indicator' WITH COUNT（如果后续行有 null值，则该行不会被算到count当中）|  
|
|  
|ON OVERFLOW TRUNCATE 'truncation-indicator' WITHOUT COUNT|  
|
|truncation-indicator|默认为'...'|  
|
|  
|只能为常量|变量、stable表达式（sysdate、now）|
|  
|  
|大于 8000 直接报错(raw为16000)|
|  
|  
|多个终止符|
|delimiter、truncation-indicator对溢出规则的影响：with count|  
|分隔符+终止符+withcount26个字节>8000，直接报错|
|delimiter、truncation-indicator对溢出规则的影响：without count|  
|分隔符+终止符>8000字节报错|
|WITHIN GROUP (order_by_clause)|不指定|  
|
|  
|单列order by expr、order by expr NULLS FIRST、order by expr NULLS LAST、order by expr ASC、order by expr DESC...|  
|
|  
|多列order by expr1，expr2 ... 、order by expr1 desc null first，expr2 asc ...|  
|
|  
|使用列别名|  
|
|  
|limit|  
|
|OVER (query_partition_clause)|单列partition by expr|  
|
|  
|多列 partition by expr1, expr2|  
|
|  
|使用列别名|  
|
|返回值类型|measure_expr为raw，则返回raw|  
|
|  
|其余返回varchar|  
|
|作为filter|> listagg、in/not in子查询、exists/not exists子查询|  
|
|distinct|  
|  
|
|结合join|left join 、 right join、inner join、full join|  
|
|子查询|  
|  
|
|集合操作|union/union all、minus/minus all、intersect / intersect all|  
|
|结合group by|  
|  
|
|结合order by|  
|  
|
|结合limit|limit offset|  
|
|plsql |绑定参数、匿名块、自定义函数|  
|
|dml|insert into values 、 insert into select 、update set、 delete where|  
|
|ddl|create table/view as select |  
|
|上述函数子句与外层group by、order by、limit offset的组合|  
|  
|
|函数嵌套|order by 嵌套函数|  
|
|  
|partition by 嵌套函数|  
|
|  
|listagg 嵌套函数|  
|
|  
|listagg自嵌套|  
|
|  
|组合嵌套|  
|


## 3.2 详细测试设计

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

参考原行存支持listagg函数测试设计

  [listagg普通函数测试设计（单机行存） - 分布式测试 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95116775)  

用例　    [standalone/testcase/function5/test_sdv_listagg_ydbrd7228 · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function5/test_sdv_listagg_ydbrd7228)  

  [LISTAGG窗口函数 测试设计 - 陈钦卿 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95113106)  

用例　    [standalone/testcase/function3/OLAP_func/heap/test_sdv_OLAP_listagg · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function3/OLAP_func/heap/test_sdv_OLAP_listagg)  

  


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[列存支持LISTAGG冒烟文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWVhMWFkOWEzMzExZGM4NDQ5IiwicmVmX2lkIjoiNjczOTZiOWU1OTNmOTljOWZmMjM2NGRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODc5LCJleHAiOjE3ODIzODIyNzl9.Cs11lQ-5z46pud78rKCmcocAutspyIm5mTct2XsC3T8)

# 5. 测试框架设计

1. 使用yasft框架实现自动化


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式|


# 7. 工作量评估

工作量：10  *人天*

计划测试完成时间：2023-11-24

## Attachments:

[LISTAGG测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWU4OTcwYzJhZjRmNTIwNWQ0IiwicmVmX2lkIjoiNjczOTZiOWU1OTNmOTljOWZmMjM2NGRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODc5LCJleHAiOjE3ODIzODIyNzl9.VLoVWxRC4kBy1MnvU3W4AaY8Zhuc3l6KmJjTqrDi7Sk)

 (application/x-xmind)    


[LISTAGG测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWU4OTcwYzJhZjRmNTIwNWQ1IiwicmVmX2lkIjoiNjczOTZiOWU1OTNmOTljOWZmMjM2NGRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODc5LCJleHAiOjE3ODIzODIyNzl9.IG4ny_2sf4NLbU1pkAr1f6QprHv60IGgsJDAwvqc-so)

 (application/x-xmind)    


[列存支持LISTAGG冒烟文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWU4OTcwYzJhZjRmNTIwNWQ2IiwicmVmX2lkIjoiNjczOTZiOWU1OTNmOTljOWZmMjM2NGRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODc5LCJleHAiOjE3ODIzODIyNzl9.7k0B3JiII_ylaSfKgnWOqZ29NY8UkPhzUFnWh247B6I)

 (application/vnd.ms-excel)    


[列存支持LISTAGG冒烟文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWVhMWFkOWEzMzExZGM4NDQ5IiwicmVmX2lkIjoiNjczOTZiOWU1OTNmOTljOWZmMjM2NGRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1ODc5LCJleHAiOjE3ODIzODIyNzl9.Cs11lQ-5z46pud78rKCmcocAutspyIm5mTct2XsC3T8)

 (application/vnd.ms-excel)    


## Comments:

|  [](null)  ,会议纪要：,与会人：黄靖东、林博、孟麟、周彬鑫、文博浩    
  评审时间：2023-11-01 16:00-17:00    
  评审地点：708    
  评审纪要信息：,1.列存规格与行存基本保持一致    
  2.可复用行存已有用例，在其基础上补充用例,评审通过与否：通过,Posted by zhoubinxin at 十月 18, 2024 09:51|
|---|
