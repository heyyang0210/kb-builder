Created by 陈钦卿, last modified on 七月 04, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/66222497fd997db58addbd31](https://pingcode.yasdb.com/pjm/items/66222497fd997db58addbd31)    ?#YDBRD-26525

开发设计：    [YDBRD-26525: exp支持bit数据类型导出为csv - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156139317)  

交付形态：单机、集群

# 2. 需求分析

## 2.1 功能点分析

|新增参数|含义|取值范围|取值含义|
|---|---|---|---|
|BIT_FORMAT|指定BIT类型的数据格式|DECIMAL|BIT数据导出为十进制|
|  
|  
|BINARY|BIT数据导出为二进制|


## 2.2 规格约束

暂无

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|测试场景|测试项一|测试项二|有效等价类|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|BIT_FORMAT|拼写|大小写|拼写错误|  
|
|  
|  
|格式|--BIT_FORMAT DECIMAL|--BIT_FORMAT==DECIMAL|  
|
|  
|  
|取值|DECIMAL/BINARY|拼写错误，无关字符|默认二进制|
|  
|  
|位置，重复指定|  
|  
|  
|
|功能校验|csv数据|导出为十进制|- 正负数
- 不同n的边界值
- 空值
- 0
|  
|  
|
|  
|  
|导出为二进制|- 全1
- 0
- 空值
|  
|已支持|
|  
|bit列数|单列，多列，4096列|  
|  
|  
|
|  
|表|表类型|仅heap|  
|  
|
|  
|  
|分区类型|bit列不能作为分区键|  
|  
|
|功能结合|结合分隔符|  
|  
|  
|bit导出不带包围符，指定也不带|
|  
|结合  *--query、--query-file*|  
|  
|  
|  
|
|  
|*--tables*  ：单表、多表|  
|  
|  
|  
|
|  
|*--use-threads*  ：单线程、多线程|  
|  
|  
|  
|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[expyasldr支持bit文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTg4OTcwYzJhZjRmNTIxNDY5IiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMTliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDAzLCJleHAiOjE3ODIzOTY4MDN9.BRtsQBhRcuFBWkY2LqXDJquoqVt1g2UapIW1pwShPig)

# 5. 测试框架设计

- 本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYThhMWFkOWEzMzExZGM5MmRiIiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMTliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDAzLCJleHAiOjE3ODIzOTY4MDN9.jwEOmzI5TUf06TXurwhBw3ST4CuAyfJcgh8Y5SYLVTk)

  


## Attachments:

[yasldr支持bit文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYThhMWFkOWEzMzExZGM5MmRjIiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMTliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDAzLCJleHAiOjE3ODIzOTY4MDN9.0T5uLJavFU_RDya0olfPJED0_1dtUEPtAAuXNDVoZn4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYThhMWFkOWEzMzExZGM5MmRiIiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMTliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDAzLCJleHAiOjE3ODIzOTY4MDN9.jwEOmzI5TUf06TXurwhBw3ST4CuAyfJcgh8Y5SYLVTk)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYThhMWFkOWEzMzExZGM5MmRkIiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMTliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDAzLCJleHAiOjE3ODIzOTY4MDN9.vCSM4k8k62tPjzzJkRX8LLOXx4SX1BI3MAhdtaVFYVo)

 (application/msword)    


[expyasldr支持bit文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTg4OTcwYzJhZjRmNTIxNDY5IiwicmVmX2lkIjoiNjczOTZkYTg3MjgyMDZlZmI5MmYyMTliIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNDAzLCJleHAiOjE3ODIzOTY4MDN9.BRtsQBhRcuFBWkY2LqXDJquoqVt1g2UapIW1pwShPig)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
