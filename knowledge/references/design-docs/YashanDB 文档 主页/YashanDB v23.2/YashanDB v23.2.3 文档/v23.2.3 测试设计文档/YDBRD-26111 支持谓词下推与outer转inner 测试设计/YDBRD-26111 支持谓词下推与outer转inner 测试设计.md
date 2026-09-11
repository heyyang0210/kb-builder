Created by 许秋莹, last modified on 十月 15, 2024

# 1. 概述

开发文档：    [outer2inner测试点 - 吴昊旻 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144139427)  

# 2. 需求分析

## 2.1 功能点分析

- 测试不该转的outer join转成了inner join


## 2.2 应用场景

- left join (right join会转成left join，不重点测试）
- full join


## 2.3 规格约束

# 3. 详细测试设计

## 3.1 测试设计方法

对filter位置，不同filter类型采用等价类的方法

预计补充用例：40个用例 已完成14个用例 剩余工作量：1.5周

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
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


1.where filter----分布式外部引用

|输入条件|等价类|备注|
|---|---|---|
|连接谓词|AND|left join：包含右表的列可以转,full join：包含右表的列或左表的列转left join,同时包含左表的列和右表的列转inner|
|  
|OR|对于left outer，必须只包含右表的列才可以转，若包含了左表的列则不转,or大部分情况下 oralce都不转|
|  
|and or 组合|  
|
|  
|BETWEEN AND|  
|
|cmp filter|=, > , <, <=, >=, ！=|和and同理|
|like|like， not like|like escape,和and同理|
|  
|rlike， not rlike|和and同理|
|in|in (1,2,3,4)|按or考虑|
|  
|in(subquery)|  
|
|any  some|  
|oralce不转 yashan可以转|
|is not null|  
|和and同理|
|not|  
|  
|
|单列（建表列是bool类型）|c1,列表达式 (case when,  || )|和and同理|
|  
|  
|  
|
|不转inner的谓词|is null|  
|
|  
|1 = 1|  
|
|  
|1 = 2|  
|
|  
|not in|not in(value) oracle转inner yashan不转|
|  
|exits|  
|
|  
|not exists|  
|
|  
|all|all oracle可以转 yashan暂时禁掉|
|不同表达式类型|col1 +/*- col2 = const|oracle不转 yashan转inner|
|  
|col1+ - 、 * % const|参考文档：    [表达式 详细设计 —— 表达式类型测试 - 刘晓旋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141570438)  |
|  
|rownum ， random|不改写|
|  
|-col|  
|
|  
||||不转|
|  
||  ^|转inner|
|嵌套表|  
|有问题单合入后测试|
|  
|  
|  
|


2.内置函数作为filter列（内置函数，即输入null不返回null的都不可以转）

|函数分类|
|---|
|聚合函数|
|数学函数|
|字符函数|
|转换函数|
|窗口函数|


3.on filter （on条件上的影响不了当前层，只影响孩子层的outer join)

|父亲join类型|孩子join类型|备注|
|---|---|---|
|inner join|left join|影响左右两边的节点|
|  
|full join|  
|
|left join|left join|  
|
|  
|full join|  
|
|  
|  
|  
|
|外部引用的父表中有group by或者有汇聚函数，汇聚函数出现在各个不同的位置|  
|  
|
|分布式外部引用|  
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

## Attachments:

[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZmM4OTcwYzJhZjRmNTIwZjg5IiwicmVmX2lkIjoiNjczOTZjZmM3MjgyMDZlZmI5MmYxOTgxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTcxLCJleHAiOjE3ODIzOTE1NzF9.ZruEOEJiOo-VyRYeyZLXV8eQI-Tv2PvbCPSPktNNRoY)

 (image/svg+xml)    
