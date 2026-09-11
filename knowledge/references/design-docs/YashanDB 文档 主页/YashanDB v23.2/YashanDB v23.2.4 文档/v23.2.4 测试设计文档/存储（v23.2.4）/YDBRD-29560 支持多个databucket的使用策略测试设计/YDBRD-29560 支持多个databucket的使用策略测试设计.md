Created by 刘大境, last modified on 十月 15, 2024

# 1. 概述

嘉实现场POC中一台物理机有12个盘，但是只部署了2个DN，因而涉及到如何充分使用多盘的问题。

当前LSC默认用法是顺序使用，优先写入第一个bucket，写满后再写入第二个。这种用法无法重复发挥多盘性能。

IR:       [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf45](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf45)    ?    
  #YASHAN-1081 存储目录支持动态添加目录

开发文档：    [LSC支持bucket使用优化 - 谢锐 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153019462)  

# 2. 需求分析

1。支持配置bucket的使用策略

2。支持多盘使用提升写入查询性能

3。  导入时支持将数据打散到多个DataBucket

4。  支持并行查询时，通过优化slice扫描顺序来提升查询性能

5。增加配置参数DATABUCKET_WRITE_POLICY  

      值：Sequential，Round-Robin

      默认值：Round-Robin

      立即生效：是

# 3.规格约束

本次SR只覆盖单机LSC表类型/分布式LSC表类型，不涉及集群

# 4. 详细测试设计

## 4.1 测试设计方法

测试关注点：

1.配置参数DATABUCKET_WRITE_POLICY默认值校验，及修改后校验

2.对比DATABUCKET_WRITE_POLICY设置Sequential，Round-Robin写入查询性能提升多少

3.观测手段：

(1)，通过V$LSC_SLICE_STAT查看Slice分布情况。

(2)，通过V$DATABUCKET查看bucket使用情况。

(3)，通过OM监控磁盘负载

4.导入、insert bulkload多bucket多盘下性能指标提升不低于10%，低于10%需分析根因

5. 主要对比多bucket下多盘配置  Sequential/Round-Robin，性能对比

## 4.1.1专项覆盖

|专项|是否涉及|说明|
|---|---|---|
|并发|涉及|  
|
|长稳|不涉及|/|
|一致性|不涉及|/|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|/|
|安全|不涉及|/|
|DFR/testkill|涉及|  
|
|HA|不涉及|/|
|压力|不涉及|/|
|性能|涉及|  
|
|可维护性|不涉及|/|
|兼容性|不涉及|/|


## 4.2 测试设计方法

|编号|测试场景|输入条件|备注|
|---|---|---|---|
|1|修改配置参数  DATABUCKET_WRITE_POLICY|alter system   set   DATABUCKET_WRITE_POLICY=''为空,alter system   set   DATABUCKET_WRITE_POLICY=NULL,alter system set DATABUCKET_WRITE_POLICY=Sequential 大/小写/大小写混合,alter system set DATABUCKET_WRITE_POLICY=Round-Robin 大/小写/大小写混合,alter system set DATABUCKET_WRITE_POLICY 立即生效(memory),alter system set DATABUCKET_WRITE_POLICY 同步参数文件(both),alter system set DATABUCKET_WRITE_POLICY 重启生效(spfile)|修改前后查询  DATABUCKET_WRITE_POLICY参数,  
|
|2|  
|alter SESSION    set   DATABUCKET_WRITE_POLICY=''为空,alter SESSION  set   DATABUCKET_WRITE_POLICY=NULL,alter SESSION set DATABUCKET_WRITE_POLICY=Sequential 大/小写/大小写混合,alter SESSION set DATABUCKET_WRITE_POLICY=Round-Robin 大/小写/大小写混合,alter SESSION set DATABUCKET_WRITE_POLICY 立即生效(memory),alter SESSION set DATABUCKET_WRITE_POLICY 同步参数文件(both),alter SESSION set DATABUCKET_WRITE_POLICY 重启生效(spfile)| 报错看护|
|3|创建带多个bucket的表空间bucket在一个盘配置参数配置  Sequential|手工测导入100G|  
|
|4|创建带多个bucket的表空间bucket在多个盘配置参数配置  Sequential|手工测导入100G|  
|
|5|创建带多个bucket的表空间bucket在一个盘配置参数配置  Round-Robin|手工测导入100G|  
|
|6|创建带多个bucket的表空间bucket在多个盘配置参数配置  Round-Robin|手工测导入100G|  
|
|7|CI 导入性能工程、tpch查询性能工程性能不同盘下多个bucket|配置参数配置  Sequential|找个多盘的CI机器，跑导入、TPCH用例|
|8|CI 导入性能工程、tpch查询性能工程性能不同盘下多个bucket|配置参数配置  Round-Robin|  
|
|9|并发|1.导入过程，来回修改配置参数  DATABUCKET_WRITE_POLICY+带视图查询+并行度参数设置+slice参数开关|无卡住情况，无core|


## 5 文本用例

  


  [TPCH手工导入测试 - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153024113)  

  


## Attachments:

[image2024-5-27_17-40-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjE4OTcwYzJhZjRmNTIxNDlhIiwicmVmX2lkIjoiNjczOTZkYjE3MjgyMDZlZmI5MmYyMjEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwODY1LCJleHAiOjE3ODIzOTcyNjV9.cuTBtzSoIL62blodsUdO4k9NcrznflKZWaJrchfNyKw)

 (image/png)    


[YASHAN-1081存储目录支持动态添加目录.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjFhMWFkOWEzMzExZGM5MzBmIiwicmVmX2lkIjoiNjczOTZkYjE3MjgyMDZlZmI5MmYyMjEzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwODY1LCJleHAiOjE3ODIzOTcyNjV9.NKTzmXX86VmEsam32QwuP1YVEE1cAgSZfo4kjZQ_pTY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
