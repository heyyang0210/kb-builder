# 1. 概述

列存支持sys_guid函数，用于生成唯一主键。

  [https://pingcode.yasdb.com/pjm/items/673444d8e489dd086808db45?](https://pingcode.yasdb.com/pjm/items/673444d8e489dd086808db45?)  

#YDBRD-35302 列存支持sys_guid函数

  [(1371) sys_guid函数调研 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673bed33593f99c9ff2693da)  

# 2. 需求分析

## 2.1 功能点分析

根据机器和时间（微秒）生成主键，具有唯一性

返回为raw类型，32位

## 2.2 应用场景

- *不同机器的不同数据库合并数据后，防止主键冲突*


## 2.3 规格约束

支持列存，且行存一并修改统一

单机，分布式，集群

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

*场景-边界值-等价类*

## 3.2 详细测试设计

|测试场景|测试点|预期|备注|
|---|---|---|---|
|函数关键字检查|名称(覆盖大小写）|成功|已有用例覆盖|
||同名用户，表，视图|成功|已有用例覆盖|
|入参|入参检查|无参|已有用例覆盖|
|同一个节点，相同机器|查询直接调用，连续调用|唯一||
||插入/修改列调用|唯一||
||建表设置列默认，连续插入生成|唯一||
||建表设置列默认，连续插入生成主键（分布键不支持）|唯一||
||作为分区键|||
||建表设置列默认，并发插入生成|唯一||
||建表设置列默认，多列使用，插入生成|不同||
||建表设置列默认，插入数据包括改列|插入指定数据||
||建表设置列默认，连续插入生成100w数据|耗时较长||
|不同节点，在相同机器|建表，并发插入生成|唯一||
|不同节点，在不同机器|建表，并发插入生成|唯一||
|~~不同数据库~~|~~建表，主键唯一，与oracle，并发插入数据，表合并~~|~~不保证~~||
|其他|行存|一致||
||arm+x86|||
||主备节点|||
|||||


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|是||
|KT|否||
|长稳|否||
|一致性|否||
|三方测试工具  
(sqltest，sqlancer)|否||
|安全|否||
|DFR|否||
|HA|否||
|压力|否||
|性能|是|可通过测试并发对比，是否差异过大|
|可维护性|否||


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  [YDBRD-35302 冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZWVmYmVhMWFkOWEzMzExZGUzNTQ5IiwicmVmX2lkIjoiNjczZDkyMzM1OTNmOTljOWZmMjdiOTFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjEyLCJleHAiOjE3ODI0MTA2MTJ9.ybtCiaCs7-fzDvcTmDLa4diJZvpsVp-fy11uCF1xmVw)    [YDBRD-35302 文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZWVmYmU4OTcwYzJhZjRmNTNiNmYyIiwicmVmX2lkIjoiNjczZDkyMzM1OTNmOTljOWZmMjdiOTFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0MjEyLCJleHAiOjE3ODI0MTA2MTJ9.vPDbNW3K6ie1LgjGbra3giZ0JPAUgtup7jPSDse_ciM)  

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*
- *ytp+CT框架*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：