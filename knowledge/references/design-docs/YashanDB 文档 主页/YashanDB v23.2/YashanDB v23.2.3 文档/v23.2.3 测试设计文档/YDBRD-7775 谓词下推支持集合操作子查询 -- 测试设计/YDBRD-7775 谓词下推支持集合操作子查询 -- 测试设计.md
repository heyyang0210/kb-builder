Created by 许秋莹, last modified on 五月 08, 2024

# 1. 概述

本文描述谓词跨集合操作下推测试设计，延用补充    [谓词跨集合操作下推测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104220014)  

SR:     [https://pingcode.yasdb.com/pjm/items/66100bde579a3edb84d39069](https://pingcode.yasdb.com/pjm/items/66100bde579a3edb84d39069)    ?    
  #YDBRD-7775 谓词下推支持集合操作子查询

# 2. 需求分析

## 2.1 功能点分析

- 目前的谓词下推只支持下推到select子查询中，增加支持谓词可以下推到带集合操作的子查询中


## 2.2 应用场景

- 谓词包含集合操作的子查询


## 2.3 规格约束

- 当JOIN表、from表是VIEW/CTE/子查询，且内部是集合操作的时候，支持谓词下推到各个集合的子查询中
- 当谓词中含有外部引用时,不进行跨集合下推
- 谓词表达式进行投影列映射之后,假如含有窗口函数,ROWNUM,子查询,不进行跨集合下推
- 谓词跨集合下推之后是挂载在最合适的位置,有些场景不能推到table上,场景有:connect by,聚合函数,窗口函数,子查询,ROWNUM


# 3. 详细测试设计

## 3.1 测试设计方法

*本测试设计主要采用等价类划分法，其中的3.2.3，采用场景法进行测试。*

## 3.2 详细测试设计

#### DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
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
|性能|？ |
|可维护性|  
|


#### 3.2.1 集合操作可以出现的位置

|输入条件1|输入条件2|有效等价类|备注|
|:---|:---|:---|:---|
|from表|普通表|  
|table1 union table2|
|  
|分区表|  
|  
|
|  
|复制表|  
|  
|
|  
|视图|只有集合操作|  
|
|  
|  
|集合操作和join组合|  
|
|  
|  
|集合操作+connect by|  
|
|  
|  
|集合操作+order by|  
|
|  
|  
|集合操作+group by,集合操作+group by having|  
|
|  
|子查询|同视图|  
|
|  
|cte|同视图|  
|
|join表|join类型|inner join|（table1 union table2) join table3|
|  
|  
|left join|  
|
|  
|  
|right join|  
|
|  
|  
|full join|  
|
|  
|  
|semi join|  
|
|  
|  
|anti join|  
|
|  
|  
|cross join|  
|
|  
|表类型|同from表类型|多表混合 ,普通表 分区表 复制表 混合 join|
|filter|filter位置|on|  
|
|  
|  
|where|  
|
|  
|  
|having|  
|
|  
|fiter条件|=,<,>,<=,>=,!=|  
|
|  
|  
|like,not like,rlike,not rlike|  
|
|  
|  
|between ...and|  
|
|  
|  
|is null, is not null|  
|
|  
|  
|in, not in,     exists subquery|  
|
|  
|  
|any,all,some|  
|
|  
|  
|rownum,rowid|  
|
|  
|  
|limit,offset|  
|
|  
|filter类型|~~常量~~|  
|
|  
|  
|~~普通子查询~~|  
|
|  
|  
|~~join子查询~~|  
|
|  
|  
|列|  
|
|  
|  
|列表达式|  
|
|  
|  
|可隐式转换列|  
|
|  
|  
|函数列（普通函数，聚合函数）|  
|
|  
|  
|索引列，非索引列|  
|
|  
|  
|case...when|  
|
|  
|  
|and，or，not|  
|
|  
|filter个数|<10, 1000个|  
|
|投影列类型|列|  
|  
|
|  
|列表达式|  
|  
|
|  
|聚合函数列|  
|  
|
|  
|伪列|connect by有关伪列：level|  
|
|和其他查询组合|connect by|  
|  
|
|  
|group by|  
|  
|


#### 3.2.2 绑定变量部分的跨集合下推和组合优化部分

|输入条件1|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|绑定变量位置|子查询内部|  
|  
|  
|
|  
|父查询里绑定|  
|  
|  
|
|  
|子查询和父查询里均绑定参数|  
|  
|  
|
|谓词组合优化|子查询内部组合优化|  
|  
|  
|
|  
|父查询组合优化|  
|  
|  
|
|  
|父查询谓词下推到子查询后和子查询组合优化|  
|  
|  
|
|  
|  
|  
|  
|  
|


#### 3.2.3 集合操作语句场景

|输入条件|有效等价类|备注|
|---|---|---|
|distinct|集合操作子查询有distinct,集合操作外面查询distinct|select distinct c1 fron t1 union subq1,select distinct (subq1 union subq2)|
|   DML/DDL操作|insert|  
|
|  
|update|  
|
|  
|delete|  
|
|  
|create as select|  
|
|union 左右两边类型|select * from tb1 union select * from tb2|  
|
|  
|select winf from tb1 union select * from tb2|  
|
|  
|select winf from tb1 union select winf from tb2|  
|
|~~考虑数据倾斜场景~~|  
|  
|


#### 3.2.4 以上场景并行执行

#### 3.2.5 查询计划的正确性

  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 本次测试采用yasft测试框架实现，执行sql文件，对比期望结果和实际输出结果，输出测试结果


# 6. 测试环境说明

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：2024/5/8

  


会议纪要：

## Attachments:

[YDBRD-7775-冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWJhMWFkOWEzMzExZGM4ZDhkIiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODgxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzM0LCJleHAiOjE3ODIzOTExMzR9.hGFj7IvqMqzKGVJmhOjrc5azgH2ErWnQtFyWDzLzwew)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-7775-冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWJhMWFkOWEzMzExZGM4ZDhlIiwicmVmX2lkIjoiNjczOTZjZWI3MjgyMDZlZmI5MmYxODgxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NzM0LCJleHAiOjE3ODIzOTExMzR9.DUQJSSp6e-uuyyE69O7mnAEV8MXB22tDyrphoEXgF-E)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
