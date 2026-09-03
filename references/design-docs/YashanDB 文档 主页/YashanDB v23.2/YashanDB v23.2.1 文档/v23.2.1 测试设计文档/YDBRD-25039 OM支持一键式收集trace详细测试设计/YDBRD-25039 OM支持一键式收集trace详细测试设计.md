Created by 李世铭, last modified on 一月 24, 2024

  


# 1. 概述

把已经实现的收集日志功能附加到一键信息收集的功能里。

目标为collection all 命令可以收集trace等信息。

由于cluster log命令已经支持收集trace，所以本方案直接把cluster log集成到collection all。

# 2. 需求分析

SR：    [YDBRD-25039](https://jira.yasdb.com/browse/YDBRD-25039?src=confmacro)    -  【OM】支持一键式收集trace  完成

设计文档：    [支持一键式收集trace设计方案](141566749.html)  

## 2.1 功能点分析

- collection all 命令新增四个参数：


|长参|短参|含义|类型|限制或说明|
|:---|:---|:---|:---|:---|
|--cluster-log|-cl|收集包含trace在内的集群信息|bool|默认为false，不收集|
|--cluster-log-start|-cls|cluster log 收集的起始时间，例如,'2006-01-02', '15:04:05', '2006-01-02 15:04:05'|string|可以不填，默认为当天0点|
|--cluster-log-end|-cle|cluster log 收集的终止时间，例如,'2006-01-02', '15:04:05', '2006-01-02 15:04:05'|string|可以不填，默认为当前时间|
|--force|-f|无需确认起始时间和终止时间是否符合预期再继续|bool|默认false|


## 2.2 应用场景

一键时收集信息时同时收集集群日志

## 2.3 约束

无

# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合

  


## 3.2 详细测试设计

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
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

详见附件

# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


需要另外申请测试用机器

# 7. 工作量评估

工作量：1  *人天*

计划测试完成时间：1/27

  


  


## Attachments:

[OM支持一键式收集trace.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmNhMWFkOWEzMzExZGM4NTFiIiwicmVmX2lkIjoiNjczOTZiYmM3MjgyMDZlZmI5MmYwOWFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjM4LCJleHAiOjE3ODIzODMwMzh9.3iQoCnjWhKeGFV5Y6L8CtdzXqURdLB5chzfW6h39iHc)

 (application/x-xmind)    


[YDBRD-25038 OM支持一键式更换IP文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmNhMWFkOWEzMzExZGM4NTFkIiwicmVmX2lkIjoiNjczOTZiYmM3MjgyMDZlZmI5MmYwOWFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjM4LCJleHAiOjE3ODIzODMwMzh9.jBMcGC4AZgq2_KByEu3UhSSh-lY8oplusjppp5lXIWY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[OM支持一键式收集trace.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmM4OTcwYzJhZjRmNTIwNmE5IiwicmVmX2lkIjoiNjczOTZiYmM3MjgyMDZlZmI5MmYwOWFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjM4LCJleHAiOjE3ODIzODMwMzh9.7s2yzrqxqe1dCT3ftZMj95zDlUFELPKZyE8cYgh4gus)

 (application/x-xmind)    


[YDBRD-25038 OM支持一键式更换IP文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmNhMWFkOWEzMzExZGM4NTFmIiwicmVmX2lkIjoiNjczOTZiYmM3MjgyMDZlZmI5MmYwOWFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjM4LCJleHAiOjE3ODIzODMwMzh9.9srUFcsx25velhLKLTfQHTFkoAZhJWjwev8QkUnCBbI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-25039 OM支持一键式收集trace文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmNhMWFkOWEzMzExZGM4NTIwIiwicmVmX2lkIjoiNjczOTZiYmM3MjgyMDZlZmI5MmYwOWFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjM4LCJleHAiOjE3ODIzODMwMzh9.rK9A33qaKsQoX3yKtOj8HL_CTVdQbgZyvVGfJlW9KC4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
