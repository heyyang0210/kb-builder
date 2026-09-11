Created by 李攀, last modified on 十月 15, 2024

# **1. 概述**

本文描述支持多个join order计划的最优选择 的测试设计。

SR：       [YDBRD-21717](https://jira.yasdb.com/browse/YDBRD-21717?src=confmacro)    -  支持top10 join order  完成

开发设计文档：    [支持多个Join Order优化 - 特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133581260)  

  [](https://conf.yasdb.com/pages/viewpage.action?pageId=133575859)  

# **2. 需求分析**

场景  ：优化器TOPN计划参与最优选择

增加了join order的搜索空间，无可以感知到的新增功能点

支持的部署形态：单机（行列），分布式，集群  

# **3. 测试**  **设计方法**   

 1.功能用例：没有可以感知到的功能点，但是会影响多表join查询场景较多，主要是影响查询性能

 2.存量用例已覆盖所有功能点，因此需要全量跑存量用例，重点关注join相关用例，goo用例

3.重点关注真实场景的性能表现：tpcc tpch join-order-benchmark等

4.执行计划对比，关注join用例的执行计划和之前是否发生变化，变化后的cost值，join order等信息

5.测试资料描述，涉及资料文档检查

  


# 4.   **详细测试设计**

**功能测试点：跑存量用例**

  


**性能测试场景覆盖：列出以下场景需要验证**

|性能场景|责任人|
|---|---|
|TPC-C(普通表，分区表)|李攀|
|TPC-H(单机，分布式)|董灵林|
|深燃|李攀|
|JDBC性能|郑思远|
|元数据导入导出性能|范瑜，,华润元数据导入导出 --谢昭贤|
|AWR|李攀|
|join-order-benchmark|孔珂煜|


# 5.   **测试用例**

**部分存量用例用作冒烟：**

[join order 冒烟用例 goo.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTRhMWFkOWEzMzExZGM4NDc4IiwicmVmX2lkIjoiNjczOTZiYTQ1OTNmOTljOWZmMjM2NTM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDg1LCJleHAiOjE3ODIzODI0ODV9.vj3o9d7XCsyTrfFHR0C9FTOm0Xd6kU4WKKGfFCbGTMs)

## Attachments:

[join order 冒烟用例 goo.rar](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTRhMWFkOWEzMzExZGM4NDc4IiwicmVmX2lkIjoiNjczOTZiYTQ1OTNmOTljOWZmMjM2NTM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MDg1LCJleHAiOjE3ODIzODI0ODV9.vj3o9d7XCsyTrfFHR0C9FTOm0Xd6kU4WKKGfFCbGTMs)

 (application/octet-stream)    
