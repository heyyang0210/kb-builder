Created by 党文琪, last modified on 十月 12, 2024

# 1. 概述

此文档为record类型作为函数形参需要支持UDT嵌套功能详细测试设计。

# 2. 需求分析

## 2.1 功能点分析

- record类型作为形参出现时，需要支持嵌套udt类型  ，功能调研文档：    [https://conf.yasdb.com/x/VFX6C](https://conf.yasdb.com/x/VFX6C)  
- 开发设计文档：
- SR:    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c1](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c1)    ?    
  #YASHAN-881 record类型作为函数形参需要支持UDT嵌套


## 2.2 应用场景

- record做入参应用的三种场景：过程体入参，子过程体入参，显式游标入参
- record的三种来源：同一过程体定义，pkg中定义，继承


|udt分类|全局|local|pkg|
|---|---|---|---|
|1|obj|record|record|
|2|varray|varray|varray|
|3|nstb|nstb|nstb|


## 2.3 规格约束

  


# 3. 详细测试设计

## 3.1 测试设计方法

本测试设计基于功能分析，根据record类型来源，应用方式等展开功能测试和dfx测试

## 3.2 详细测试设计

二层嵌套：

|  
|record来源|内层类型|支持情况|类型|应用|
|---|---|---|---|---|---|
|1|过程体定义|  
|支持|参考 udt分类覆盖|参考入参应用，与udt类型结合覆盖,涉及做做子过程体入参，显式游标入参|
|2|pkg中定义|嵌套udt在同一pkg中|支持|参考 udt分类覆盖|参考入参应用，与udt类型结合覆盖,过程体入参,子过程体入参,显式游标入参,body过程体入参|
|3|  
|嵌套udt在不同pkg中|拦截，跨三级依赖拦截|  
|  
|
|4|  
|在body定义record|支持|覆盖有toid和pkg 头部定义场景|重点关注下赋值和类型推导,子过程体入参|
|5|继承|%rowtype 继承表列|支持|表列类型为obj，var，nstb|for循环定义的隐式record做入参,显式定义的record做入参,%rowtype继承定义的record做入参|


过程体入参的应用场景：

|入参应用|  
|  
|  
|过程体入参|子过程体入参|显式游标入参|pkg body过程体的入参|
|---|---|---|---|---|---|---|---|
|1|赋值|在定义变量时赋值|直接赋值|  
|  
|  
|  
|
|2|  
|  
|拼接|  
|  
|  
|  
|
|3|  
|  
|做内置函数的入参|  
|  
|  
|  
|
|4|  
|  
|做构造函数的入参|  
|  
|  
|  
|
|5|  
|类型继承（预计拦截）|  
|  
|  
|  
|  
|
|6|  
|做内层子过程体的入参默认值|  
|  
|  
|  
|  
|
|7|  
|做显式游标的|入参默认值|  
|  
|  
|  
|
|8|  
|  
|投影列|  
|  
|  
|  
|
|9|  
|  
|feilter条件|  
|  
|  
|  
|
|10|  
|执行单元赋值|select into赋值|  
|  
|  
|  
|
|11|  
|  
|等值赋值|  
|  
|  
|  
|
|12|  
|  
|returning into赋值|  
|  
|  
|  
|
|13|  
|被赋值，注意下覆盖in/out/in out三种方向|等值赋值|  
|  
|  
|  
|
|14|  
|  
|select into赋值|  
|  
|  
|  
|
|15|  
|  
|returning into赋值|  
|  
|  
|  
|
|16|  
|  
|fetch赋值|  
|  
|  
|  
|
|17|  
|做过程体入参|子过程体|  
|  
|  
|  
|
|18|  
|  
|其他过程体|  
|  
|  
|  
|
|19|  
|条件判断|  
|  
|  
|  
|  
|
|20|  
|做高级包入参|  
|  
|  
|  
|  
|
|21|  
|做内置函数入参|普通内置函数|  
|  
|  
|  
|
|22|  
|  
|数组函数|  
|  
|  
|  
|
|23|  
|绑定参数|using|  
|  
|  
|  
|
|24|  
|  
|into|  
|  
|  
|  
|
|25|  
|dml|insert|  
|  
|  
|  
|
|26|  
|  
|delete/update|  
|  
|  
|  
|
|27|  
|  
|merge into|  
|  
|  
|  
|
|28|  
|做数组下标索引|  
|  
|  
|  
|  
|
|29|  
|做for索引|  
|  
|  
|  
|  
|
|30|  
|forall/bulk批量处理|  
|  
|  
|  
|  
|


三层嵌套：

|  
|2\3|toid|local|pkg|
|---|---|---|---|---|
|1|toid|record+ toid varray+toid object|\|record+ toid nstb+pkg nstb|
|2|local|record+ local nstb+toid object|record+local nstb+local varray|record+local record+pkg nstb|
|3|pkg|record+pkg nstb+toid object|record+pkg record+pkg varray|record+pkg varray+pkg record|


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