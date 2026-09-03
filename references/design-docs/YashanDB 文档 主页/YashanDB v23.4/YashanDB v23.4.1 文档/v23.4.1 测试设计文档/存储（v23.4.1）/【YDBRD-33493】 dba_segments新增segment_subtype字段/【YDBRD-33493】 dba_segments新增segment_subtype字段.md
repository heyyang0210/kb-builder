Created by 刘丹, last modified on 十一月 12, 2024

IR链接：

  [https://pingcode.yasdb.com/ship/ideas/660b7482009f91eb87f2c022?](https://pingcode.yasdb.com/ship/ideas/660b7482009f91eb87f2c022?)  

#YASHAN-1302  dba_segments新增segment_subtype字段

SR链接：

  [https://pingcode.yasdb.com/pjm/items/67051c48e489dd0868f21f6c?](https://pingcode.yasdb.com/pjm/items/67051c48e489dd0868f21f6c?)  

#YDBRD-33493 dba_segments新增segment_subtype字段

测试设计调研文档：

  [YASHAN-1302 dba_segments新增segment_subtype字段 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/LIUDAN/pages/673b26fe593f99c9ff2689cf)  

# 1. 概述

dba_segments新增segment_subtype字段

# 2. 需求分析

## 2.1 功能点分析

- dba_segments新增segment_subtype字段,可以通过segment_subtype字段查询segments是在assm还是ssm


## 2.2 应用场景

- 查询segments是在assm空间还是ssm空间，不同的表空间存储和管理的模式不同，使得可以通过dba视图查询当前段使用的什么管理方法


## 2.3 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

1. 部署方式：单机、分布式、集群
1. 主要采用场景法进行测试


## 3.2 详细测试设计

1. *场景法*


||测试场景|用例描述|预期场景|备注|
|---|---|---|---|---|
|1|新增字段基础校验|desc dba_segments|新增了segment_subtype字段，字段类型和字段名称都正确 ||
|||查询dba_tab_columns视图|dba_tab_columns查询结果新增一行，多segment_subtype||
|2|基础功能校验|创建表，通过segment_name字段查询segment_type是什么类型    ,创建表、分区表、索引、分区索引  ，查询视图，看是ssm还是assm|SEGMENT_SUBTYPE是ASSM|覆盖基本的对象类型|
|3|HA|主机创建对象，备机查询dba视图,|segment_subtype类型是assm||
|4|升级|从低版本升级到高版本，升级后使用des查询视图,并创建对象，查询segment_type字段|升级后desc dba_segments视图有segment_subyte字段，通过对象查询视图，类型是ssm||
|||升级前创建对象，升级后查询视图|||


|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例； 


     2.启动测试之前提供文本用例，并完成大部分自动化用例；

       详见附件



# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*


*使用Guider框架完成测试用例*

- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0NDNhYzM3MjgyMDZlZmI5MzQwMGI4IiwicmVmX2lkIjoiNjc0NDNhYzM3MjgyMDZlZmI5MzQwMGJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5MTkyLCJleHAiOjE3ODI1NDU1OTJ9.wfxicEAtWx8dCaXVwNaUhOyfVsqp0Svo01PbQACIuMg)

  


  
