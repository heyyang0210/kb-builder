Created by 周彬鑫, last modified on 十二月 15, 2023

# 1. 概述

*支持PIVOT函数 *

# 2. 需求分析

## 2.1 功能点分析

- *语法图*


***在select 语句中的位置***

![](https://conf.yasdb.com/download/attachments/135610693/image2023-11-25_11-17-27.png?version=1&modificationDate=1700882247000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0OTcsImV4cCI6MTc4MjMwNzI5N30.MUepto0g62YfARHx8LL_R0XKCBTSZYAGrWyKGzQGZQE)

![](https://conf.yasdb.com/download/attachments/135610693/image2023-11-25_11-17-43.png?version=1&modificationDate=1700882263000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0OTcsImV4cCI6MTc4MjMwNzI5N30.MUepto0g62YfARHx8LL_R0XKCBTSZYAGrWyKGzQGZQE)

***pivot_clause***

![](https://conf.yasdb.com/download/attachments/135610693/image2023-11-25_11-9-53.png?version=1&modificationDate=1700881794000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY0OTcsImV4cCI6MTc4MjMwNzI5N30.MUepto0g62YfARHx8LL_R0XKCBTSZYAGrWyKGzQGZQE)

## 2.2 应用场景

- select 语句


## 2.3 规格约束

- 聚合列的参数列与for列必须出现在前面查询的投影中
- 聚合函数允许出现除grouping_id，group_id和grouping这三个与grouping sets相关的函数以外的所有聚合，非聚合函数或不带聚合函数报错
- pivot clause前面的dataset若是多表，只能是通过on显式表明的join，而不能是用逗号连接的隐式join
- for列不允许复杂名称（如 t1.col）
- 其余限制为语法位置导致的限制
- 聚集函数不支持group_concat系列，包括 group concat， wm concat， listagg， stringagg，与oracle不一致（oracle只有listagg）；聚集函数支持stddev_pop、stddev_samp、var_pop、var_samp Oracle 均不支持
- IN列长度大于20，输出的列名自动截断长度20后的字符，与oracle不一致
- 聚合或 IN列 别名长度上限为64，超过64报错，与oracle不一致


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

对语法图使用路径覆盖。

对于与其他场景的组合使用场景组合法。

对于函数位置使用场景组合。

对于函数参数 使用错误推测法。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


[支持PIVOT函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjdhMWFkOWEzMzExZGM4NGZkIiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDk3LCJleHAiOjE3ODIzODI4OTd9.JaYMhRxhmiP1xukpvtc3VSFxSwBCkomFhbMhc7VJoFI)

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|  
|
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


*       3. 详细测试点*

|测试点|等价类|备注|
|:---|:---|:---|
|关键字校验|关键字大小写、缺失、拼写错误|  
|
|  
|PIVOT与表、视图同名|  
|
|  
|XML拦截|  
|
|  
|v$reserved_words新增PIVOT|  
|


语法图-路径覆盖

|测试点|等价类|备注|
|:---|:---|:---|
|aggregate_expression|单个聚合|  
|
|  
|多个聚合，用','分隔|  
|
|  
|多个聚合，用非'.'分隔|报错|
|  
|多个聚合，聚合个数上限|  
|
|  
|聚合有/无别名|  
|
|  
|聚集函数（列、常量、表达式、伪列、null表达式、distinct/all）(覆盖所有聚集函数)|  
|
|  
|聚集函数 非投影列|报错|
|  
|非聚集函数|报错|
|select_list_column|单列、列别名|  
|
|  
|常量、表达式、伪列、null表达式、复杂列名|报错|
|  
|多列|报错|
|const_expression|常量、可被静态优化的表达式|  
|
|  
|cast(as) 指定类型、列、绑定参数|报错|
|  
|单个值|  
|
|  
|多个值用','分隔|  
|
|  
|多个值用非'.'分隔|报错|
|  
|多个值，列数上限|  
|
|  
|常量有/无别名|  
|
|非法语法|投影列包含for 列|报错|
|  
|投影列包含聚合列|报错|


函数位置

|测试点|等价类|备注|
|:---|:---|:---|
|外层group by|pivot 在 group by 前|  
|
|  
|pivot 在 group by 后|报错|
|外层order by|pivot 在 order by 前|  
|
|  
|pivot 在 order by 后|报错|
|外层where filter|pivot 在where filter 前|  
|
|  
|pivot 在 where filter 后|报错|
|外层connect by |pivot 在connect by 前|  
|
|  
|pivot 在connect by 后|报错|
|外层limit offset/offset fetch|pivot 在limit offset/offset fetch 前 |  
|
|  
|pivot 在limit offset/offset fetch 后|报错|
|pivot 在投影|  
|报错|
|sample|pivot在sample前|报错|
|  
|pivot在sample后|  
|
|flashback|pivot在flashback前|报错|
|  
|pivot在flashback后|  
|


结合其他语句

|测试点|等价类|备注|
|---|---|---|
|JOIN|left join/right join/inner join/outer join|必须显式写出join on,若多表查询from t1,t2 oracle报错|
|  
|pivot join pivot|  
|
|多表join（3张表）|t1 pivot join t2 join t3|  
|
|  
|t1 join t2 pivot join t3|  
|
|  
|t1 join (t2 join t3 pivot)|  
|
|  
|t1 join t2 join t3 pivot|  
|
|  
|可在单表PIVOT后加别名|  
|
|  
|不可在多表PIVOT后加别名|  
|
|集合|union(all)/minus(all)/intersect(all)|  
|
|  
|pivot union pivot|  
|
|  
|select from (tb1 union tb2) pivot|  
|
|子查询|pivot的结果作为子查询（子查询位置覆盖 投影、filter、from）|  
|
|  
|pivot语句内含子查询（子查询位置覆盖 投影、filter、from）|  
|
|CTE|pivot 在内层|  
|
|  
|pivot 在外层|  
|
|组合复杂查询|组合group by /having/order by /limit offset/offset fetch/connect by/filter|  
|
|DML|insert into select|  
|
|  
|update set  col = pivot|  
|
|  
|update set col = 1 where col1 > pivot|  
|
|  
|delete where col = pivot|  
|
|DDL|create table/view as select|  
|
|嵌套|嵌套pivot|不支持 |


交付形态

|部署|存储|
|---|---|
|单机|行列|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[PIVOT函数冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjc4OTcwYzJhZjRmNTIwNjg4IiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDk3LCJleHAiOjE3ODIzODI4OTd9.41djWdkQa_p_zHWl7Y8xZvG-xF-9xg-kdm--_F5ET68)

详见附件

# 5. 测试框架设计

- 使用Guider框架实现用例的自动化


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：10  *人天*

计划测试完成时间：2023/12/11

  


## Attachments:

[支持PIVOT函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjc4OTcwYzJhZjRmNTIwNjg2IiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDk3LCJleHAiOjE3ODIzODI4OTd9.shgkY8YZzgpYuXEUu0Yo7QG0uYKMKns4LQrGwq5DDuw)

 (application/x-xmind)    


[支持PIVOT函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjdhMWFkOWEzMzExZGM4NGZkIiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDk3LCJleHAiOjE3ODIzODI4OTd9.JaYMhRxhmiP1xukpvtc3VSFxSwBCkomFhbMhc7VJoFI)

 (application/x-xmind)    


[PIVOT函数冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjc4OTcwYzJhZjRmNTIwNjg4IiwicmVmX2lkIjoiNjczOTZiYjc3MjgyMDZlZmI5MmYwOTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NDk3LCJleHAiOjE3ODIzODI4OTd9.41djWdkQa_p_zHWl7Y8xZvG-xF-9xg-kdm--_F5ET68)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
