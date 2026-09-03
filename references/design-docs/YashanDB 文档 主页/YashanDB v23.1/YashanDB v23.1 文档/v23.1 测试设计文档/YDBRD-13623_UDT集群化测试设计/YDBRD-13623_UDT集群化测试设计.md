Created by 张江, last modified on 十月 15, 2024

# 1.概述

本文档用于描述UDT集群化测试设计。

SR链接：    [YDBRD-13623](https://jira.yasdb.com/browse/YDBRD-13623?src=confmacro)    -  UDT的集群化改造  完成

# 2.需求分析

1、功能兼容：UDT在单机使用的基础上能够完全兼容集群场景，包括创建语法、执行调用和相关应用场景(如在PLSQL、TABLE中使用)；

2、单机用例兼容：单机UDT用例能够无缝衔接在集群上执行，无需改造语法，100%兼容，测试结果同单机保持一致；

3、集群使用场景：

      1）实例间串行操作：需关注多个实例间数据同步一致，其中某个实例执行操作后，另一个实例能够感知其变化；

      2）实例间并发操作：需关注多个实例并发执行UDT相关操作，包括CREATE [OR REPLACE] TYPE、CREATE [OR REPLACE] TYPE BODY、使用UDT、DROP TYPE [IFEXISTS]等组合操作，

           同时能够在一定的压力下包括并发数和UDT对象个数执行，集群状态能够保持正常(关注core)，执行结果正确。

# 3.测试设计方法

本次测试设计主要使用场景分析法以及相关的组合策略来设计。

# 4.详细测试设计

1）  使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

详细测试见：

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|是|
|性能|  
|
|可维护性|  
|


# 5.测试用例

待补充。

# 6.测试框架设计

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[UDT集群化改造测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGY4OTcwYzJhZjRmNTFmOTE5IiwicmVmX2lkIjoiNjczOTY5OGY3MjgyMDZlZmI5MmVmNDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MjMxLCJleHAiOjE3ODIyOTM2MzF9.CUJFyINmsWZ8_6TdSb5uX0KlpG0bnKhpQagn-cVC9m4)

 (application/x-xmind)    
