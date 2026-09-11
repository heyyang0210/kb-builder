

# 1. 概述

新增系统级别参数  enable_bulkload_auto_commit，该参数为true时，支持自动提交+bulkload方式插入数据。

  [https://pingcode.yasdb.com/pjm/items/67663379622069d46dfaab5a?](https://pingcode.yasdb.com/pjm/items/67663379622069d46dfaab5a?)  

#YDBRD-36799 列存insert /*+bulkload*/ into 支持在autocommit on的情况下执行

开发文档：  [https://pingcode.yasdb.com/wiki/spaces/WANGSHAOHUA/pages/677781b7ea9f2a28709376f0](https://pingcode.yasdb.com/wiki/spaces/WANGSHAOHUA/pages/677781b7ea9f2a28709376f0)  

# 2. 需求分析

## 2.1 功能点分析

1.enable_bulkload_auto_commit参数为系统级参数，支持内存修改和文件修改生效两种方式，默认值false

2.enable_bulkload_auto_commit参数配置false时，开启自动提交，执行bulkload导入被拦截

3.enable_bulkload_auto_commit参数配置true时，开启自动提交，支持bulkload导入

## 2.2 应用场景

- *insert /*+bulkload*/ into values()()()多行*
- *insert /*+bulkload*/ into values()单行*
- *insert /*+bulkload*/ into select*
- *create table as select *


## 2.3 规格约束

*1.bulkload多次提交导致会性能下降*

*2.范围：*  单机，分布式，集群

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

*场景-边界值-等价类*

## 3.2 详细测试设计

|测试场景|测试点|预期|备注|
|---|---|---|---|
|参数配置|直接修改，内存生效|||
||写入文件，重启生效|||
||修改非cn节点，不生效|||
||修改cn节点，生效|||
||已有未提交事务，参数设置true,打开自动提交后执行插入，正常|||
||默认值执行，拦截|||
||参数设置true,未打开自动提交|||
||参数设置true,打开自动提交|||
|||||
|||||
|插入场景|insert into ()单行|||
||insert into ()()()()多行|||
||insert into 含lob类型|||
||insert into select 空|||
||insert into select 单行|||
||insert into select 多行|||
||insert into select 冷->冷|||
||insert into select 热->冷|||
||insert into select 多表关联|||
||insert into select 带lob类型|||
||打开mcol，执行插入insert bulkload|||
||关闭mcol,执行插入insert bulkload|||
||关闭mcol,执行插入insert|||
||关闭mcol,执行更新|||
||insert bulkload行冲突时，等锁|||
||insert bulkload插入失败|||
||匿名块使用|||
|||||
|导入|imp导入，1024行提交一次，无相关配置参数--不生效|||
||yasldr导入，basic模式，COMMIT_ROWS=1|||
||yasldr导入lob，basic模式，COMMIT_ROWS=1|||
||yasldr导入，batch模式--不生效|||
|并发|配置参数，单cn，并发插入|||
||混合配置，多cn，并发插入|||
|性能|对比配置前后，性能下降比例 |||
|其他|create table as , 生效|||
||heap，不生效|||
||tac，复制表tac,不生效|||
||分布表lsc,复制表lsc,生效|||
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


  [YDBRD-37072文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4NzdlM2JhMWFkOWEzMzExZGU2YjUxIiwicmVmX2lkIjoiNjc4NzZkODRiMzFmYWQyMWVhMGQ0ZWYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQxNTI4LCJleHAiOjE3ODI0Mjc5Mjh9.2hXgtYtlMm74JSDxenoMMUI1Tpwo85tbn9-abG0bLW4)    [YDBRD-37072 冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4NzdlM2JhMWFkOWEzMzExZGU2YjUyIiwicmVmX2lkIjoiNjc4NzZkODRiMzFmYWQyMWVhMGQ0ZWYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzQxNTI4LCJleHAiOjE3ODI0Mjc5Mjh9.NWYowQ7KttKpgEcNW6JAhUT7Y2iA_6jyfw_uSoq8n-I)  

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*
- *ytp框架*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *1人周*

计划测试完成时间：2.12