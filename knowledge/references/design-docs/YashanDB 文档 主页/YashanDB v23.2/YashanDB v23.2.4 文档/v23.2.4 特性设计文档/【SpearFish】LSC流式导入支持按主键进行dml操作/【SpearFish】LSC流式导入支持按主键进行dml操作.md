Created by 万谦, last modified by  黄文早 on 十月 16, 2024

*详细设计-YDBRD-26165 : LSC流式导入支持按主键进行dml操作*

* IR链接：*    [YDBRD-2889](https://pingcode.yasdb.com/ship/ideas/664f15955d57e18ea9d09907? #YASHAN-2889  分布式支持批量更新和删除)  

*SR链接：*

# 1. 总述

## 1.1 需求来源

原始的客户需求描述。关注需求的来源、规格、合理性，要用明确的语言描述，不能模棱两可。要把客户的业务场景描述清楚，知道客户希望怎么用，而且除了功能特性要求，也要尽可能了解非功能特性要求，例如性能、安全等。

**需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分行存和列存。**

来源：flink流式导入时可能有少量dml操作 并且一般场景为基于主键条件的单行删除更新

目标：lsc表需要放开dedup导入时候的dml限制 并且加速基于唯一索引的dml速度

部署形态：分布式

## 1.2 调研文档

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  [Flink](https://conf.yasdb.com/display/~linshipei/Flink)  

## 1.3 需求分析

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

1.3.1 进行bulkload导入的表允许进行带索引条件的dml操作

1.3.2 LSC表支持索引回表

## 1.4 数据字典

**描述本篇文档中特性的术语集**

|名称|含义|
|---|---|
|rgd|LSC表bulkload导入或者开启bulkload hint插入的缓存数据存储结构|


## 1.5 开源依赖

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

无

# 2. 接口

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

无

# 3. 规格与约束

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

1，只支持非rgd数据的回表 如果待dml的数据落在rgd内 则直接报错

2，索引回表计划目前和行表一致

3，LSC flink导入只能支持带唯一索引条件的dml操作

  


# 4. 特性

## 4.1 bulkLoad导入LSC表支持dml

**放开bulkload导入的表对dml的拦截 但此SR只支持dml带唯一索引条件**

**具体限制：走索引扫描的dml可以正常支持 要么成功（在非本事务内）要么报错（本事务数据更新不支持）**

**                  走表扫描的dml只能操作非本事务的数据 不报错 会漏本事务数据的处理**

## 4.2 LSC表支持索引回表

4.2.1 回表计划

**回表条件和行表计划一致**

  


4.2.2 回表dml流程

索引扫描->条件过滤→LSC rowid扫描->锁行->过滤->dml

  


4.2.3 存储支持

fetchByRowId已经支持 

## 4.3 异常处理

4.3.1   **落在rgd内的数据不支持dml**

此SR只能支持rgd插入的数据和dml操作的数据不冲突

  


4.3.2 回滚

参看bulkload的事务机制 由于  **dml只能支持和rgd内事务不冲突情况 可做到语句级回滚**

  


具体flink导入场景：

场景1

（1）插入数据 key1        成功

（2）dml操作数据 key2 成功

场景2

（1）插入数据 key1        和原有数据冲突

（2）dml操作数据 key2 成功

场景3

（1）插入数据 key1        成功

（2）dml操作数据 key1  报错不支持

场景4

（1）插入数据 key1        和原有数据冲突

（2）dml操作数据 key1 报错不支持

# 5. Testcases（自测用例）

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


1，索引回表自测 现存行表及tac的回表场景（普通表、分区表local索引及分区表global索引）

2，flink流式导入场景模拟 使用insert /*+bulkload dedup*/与dml仿照一次flink导入事务的处理

2.1 插入数据和dml数据不冲突

2.2 插入数据和dml数据冲突

2.3 异常场景 插入或dml失败 发生在插入rgd前 语句回滚 插入后则事务整体回滚

# 6. 资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

bulkload导入LSC表（或insert带bulkload hint）事务内可进行带主键条件的dml操作

# 7. 未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

工作量评估：1人周

待解决问题：列存回表代价和行表不可简单划等号 需要列存cost模型支持在适合列存场景下走索引回表

  


## Attachments:

[image2024-4-26_10-57-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzlhMWFkOWEzMzExZGM5M2FhIiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.91VIJaTDI5nGWzeFS-wJpxRtrNcxTNmuJ21R6E5LKfs)

 (image/png)    


[image2024-5-6_9-35-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzk4OTcwYzJhZjRmNTIxNTM4IiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.0WJW5jJilWDHBCnn7Hdg91ezUNPrWLP8a9DPrh-V8Xg)

 (image/png)    


[image2024-5-7_18-48-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzlhMWFkOWEzMzExZGM5M2FiIiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.86tCpTmTBA7ypk4A2A3uhjvEnuCAWYxwEL9Y-4sx7Tc)

 (image/png)    


[image2024-5-7_18-49-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzk4OTcwYzJhZjRmNTIxNTM5IiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.kw9xvy61e5a4yEMtRXXL2ch0cZoH9P-TW18Fy-M44-k)

 (image/png)    


[image2024-4-26_17-13-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzk4OTcwYzJhZjRmNTIxNTNhIiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.AlmkIcluCPpujlve4PqCiZKxHfISIFHVCpNUob13p9g)

 (image/png)    


[image2024-4-28_9-45-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzk4OTcwYzJhZjRmNTIxNTNiIiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.HblWjztQGNtl4md-ZAKoPds4PbWnl73T2GpbNu11_TA)

 (image/png)    


[image2024-4-28_9-48-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzlhMWFkOWEzMzExZGM5M2FjIiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.3JwX13cAXwnkeEjEpgo9bppkinqFCI0XuxFusgLfCy4)

 (image/png)    


[image2024-5-10_9-15-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYzlhMWFkOWEzMzExZGM5M2FkIiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.YyAEs4yaCq9hdNB3yUPAo7hD9ahdfHpe1FerXfQF1EU)

 (image/png)    


[image2024-5-7_18-53-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkY2E4OTcwYzJhZjRmNTIxNTNjIiwicmVmX2lkIjoiNjczOTZkYzk3MjgyMDZlZmI5MmYyMzZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExNzAzLCJleHAiOjE3ODIzOTgxMDN9.6yypFTf-qrSihBflU5H6hFGiH98spvvHP__trq9fRdk)

 (image/png)    


## Comments:

|  [](null)  ,2024年5月29日,评审意见：计划适当调大列表回表的代价 并确保带索引条件只操作单行一定可选择索引扫描计划,Posted by wanqian at 五月 29, 2024 10:21|
|---|
