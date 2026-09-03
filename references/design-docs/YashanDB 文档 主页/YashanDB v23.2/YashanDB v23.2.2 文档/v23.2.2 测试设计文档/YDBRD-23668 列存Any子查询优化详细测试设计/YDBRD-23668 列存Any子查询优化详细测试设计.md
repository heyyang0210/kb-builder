Created by 周彬鑫, last modified on 十二月 21, 2023

# 1. 概述

本需求在特定场景下通过缓存子查询结果，提升查询整体性能。直接目标是优化TPCDS Q45。SR：    [YDBRD-23668](https://jira.yasdb.com/browse/YDBRD-23668?src=confmacro)    -  列存Any子查询优化  开发中

# 2. 需求分析

## 2.1 功能点分析

- 性能优化，对外功能点无变化。
- 识别功能点：通过hash set缓存子查询结果，涉及hash set场景验证


## 2.2 应用场景

- col=any(subquery)和col!=all(subquer  y)即not  * in，subquery为非关联子查询场景下，内部缓存子查询结果，提升查询性能；*


## 2.3 规格约束

- 只支持非关联子查询的性能优化
- 特殊场景下无性能优化，可能性能更差（具体场景如，子查询只执行一行或执行行数较少并且执行一次子查询很快）


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

针对开发设计的方案，使用错误推测法：对于hash set过滤，使用  左右存在null的场景、invalid场景（子查询带过滤，且过滤掉的数据占比少（少于10%）的场景）

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


[列存Any查询优化.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjI4OTcwYzJhZjRmNTIwZGYwIiwicmVmX2lkIjoiNjczOTZjYjI3MjgyMDZlZmI5MmYxNWRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzc3LCJleHAiOjE3ODIzODkxNzd9._ac8OgS87YA1efP9pGtItQRSLEapP4-prFUh6Qhcz0k)

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
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
|性能|是|
|可维护性|  
|


*       3. 详细测试点*

- ***功能测试点***


|输入条件|等价类|备注|
|---|---|---|
|col=any(subquery)|col为常量/表达式/null/null表达式|  
|
|  
|子查询的结果包含null/全为null|  
|
|  
|invalid值：,子查询过滤的数据不超过10%|  
|
|  
|col与子查询交换位置|  
|
|col != all(subquery)|col为常量/表达式/null/null表达式|  
|
|  
|子查询的结果包含null/全为null|  
|
|  
|invalid值：,子查询过滤的数据不超过10%|  
|
|  
|col与子查询交换位置|  
|
|单独 in（）且不带or => 改写为any,   in(subquery)     **<==>**     =any(subquery)|同上述=any测试点|见explain判断有无改写|
|not in（subquery）=>改写 !=all,col not in(subquery) <==> col !=all(subquery)|同上述!=all测试点|见explain判断有无改写|


- ***性能优化***


|框架|预期|
|---|---|
|TPCDS|100G Query45 5s优化至1s内|
|自建大数据量复杂场景|（=any、!=all、以及in改写的场景）与master对比性能有提升|


- **并发资源不足场景**


crab内部算子可用最大配额计算方式如下：

columnar_vm_buffer_size * columnar_Material_percent * COLUMNAR_MAX_OPERATOR_MEM_PERCENT * 80% （单机）    
  columnar_vm_buffer_size * columnar_Material_percent * COLUMNAR_MAX_OPERATOR_MEM_PERCENT * COLUMNAR_MAX_STAGE_MEM_PERCENT （分布式）

|输入条件|预期|
|---|---|
|修改配置参数，构造内存不足子查询结果集写磁盘场景|结果合理（查看是否有文件存在？）|
|并发下内存不足|结果合理|


- **对外功能点无变化**


提前跑二层上车工程，预期对二层无影响

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *功能使用yasft框架，CT/KT使用testkill框架，性能使用TPCDS*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式|


# 7. 工作量评估

工作量：8  *人天*

计划测试完成时间：2024/1/8

## Attachments:

[列存Any查询优化.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjI4OTcwYzJhZjRmNTIwZGYwIiwicmVmX2lkIjoiNjczOTZjYjI3MjgyMDZlZmI5MmYxNWRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNzc3LCJleHAiOjE3ODIzODkxNzd9._ac8OgS87YA1efP9pGtItQRSLEapP4-prFUh6Qhcz0k)

 (application/x-xmind)    


## Comments:

|  [](null)  ,会议名称：列存Any子查询优化测试设计评审,评审时间：2023/12/21 15:00-16:00,参与人：孟麟、李嘉瑞、周彬鑫,1.构造复杂子查询，大数据量，子查询执行时间长时会有优化。复杂查询构造多join/集合，=any !=all 组合 and/or连接,2.改写TPCDS语句，in→not in 验证!=all是否优化,3.计划内为=any/ !=all时会有优化,4.内存不足场景 数据不能有太多重复值,评审结论：通过,  
,Posted by zhoubinxin at 十二月 21, 2023 15:16|
|---|
