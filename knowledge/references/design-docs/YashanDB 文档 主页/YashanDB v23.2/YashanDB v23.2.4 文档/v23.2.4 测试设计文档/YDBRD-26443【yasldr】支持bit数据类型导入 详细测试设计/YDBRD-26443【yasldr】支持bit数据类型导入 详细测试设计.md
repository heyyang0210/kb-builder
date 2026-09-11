Created by 陈钦卿, last modified on 七月 04, 2024

# 1. 概述

SR：       [https://pingcode.yasdb.com/pjm/items/661e78d5fd997db58adae9fe](https://pingcode.yasdb.com/pjm/items/661e78d5fd997db58adae9fe)    ?#YDBRD-26443 【yasldr】支持bit数据类型导入

开发设计：    [YDBRD-26675:支持bit类型数据导入设计文档 - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156130087)  

交付形态：单机、集群

# 2. 需求分析

## 2.1 功能点分析

yasldr支持bit数据类型导入。需要新增参数控制csv中bit数据类型的格式。

|新增参数|含义|取值范围|取值含义|备注|
|---|---|---|---|---|
|BIT_FORMAT|指定BIT类型的数据格式|DECIMAL|BIT数据为十进制|若  为bit(64)，  范围同bigint：  -2  63     (-9,223,372,036,854,775,808) ~ 2  63  -1 (9,223,372,036,854,775,807),若为bit(n)：0~2  n  -1,需要进行数据转换|
|  
|  
|BINARY|BIT数据为二进制|数据只能由0和1组成，且长度不能超过64位（含64）|


仅针对bit类型。

不涉及服务端。

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
|格式|BIT_FORMAT=DECIMAL|BIT_FORMAT==DECIMAL|  
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
|功能校验|csv数据|十进制|- 小数，小数部分截断
- 科学计数法
- 正负数
- 不同n的边界值
- 空值
- 0
|- 超过边界
- 空串
- 字母，无关字符
- inf，-inf，nan
|  
|
|  
|  
|二进制|- 0和1
- 多个0
- 全部0/1
|- 超过64位
- 非0、1数字，字母，无关字符
|  
|
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
|功能结合|容错|违反约束|- 主键、外键
- 唯一
- 非空
- check
|  
|  
|
|  
|trim|  
|  
|  
|  
|
|  
|with embedded|  
|  
|  
|  
|
|  
|traling nullcols|  
|  
|  
|  
|
|  
|control_text/control_file|  
|  
|  
|  
|
|  
|basic/batch|  
|  
|  
|  
|
|  
|多文件|  
|  
|  
|  
|
|  
|包围符|- 数字
- 包围符里带空格
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
|性能|摸底|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[yasldr支持bit文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTY4OTcwYzJhZjRmNTIxNDVmIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZTAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzg1LCJleHAiOjE3ODIzOTY3ODV9.VRmi6DhOlIKpunmBw8z2oparGIvoBGLXTMbefIG0Wcs)

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

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTZhMWFkOWEzMzExZGM5MmQwIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZTAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzg1LCJleHAiOjE3ODIzOTY3ODV9.NM_lfRLMcxA8Jjrbpgi5wEyugGC5ImBlPPTWBAAxVt0)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTZhMWFkOWEzMzExZGM5MmQwIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZTAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzg1LCJleHAiOjE3ODIzOTY3ODV9.NM_lfRLMcxA8Jjrbpgi5wEyugGC5ImBlPPTWBAAxVt0)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTZhMWFkOWEzMzExZGM5MmQxIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZTAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzg1LCJleHAiOjE3ODIzOTY3ODV9.br3VaYrfv4o0qw8B9KoK17VE39U-Y3zv297xiesx11k)

 (application/msword)    


[yasldr支持bit文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYTY4OTcwYzJhZjRmNTIxNDVmIiwicmVmX2lkIjoiNjczOTZkYTY1OTNmOTljOWZmMjM3ZTAzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMzg1LCJleHAiOjE3ODIzOTY3ODV9.VRmi6DhOlIKpunmBw8z2oparGIvoBGLXTMbefIG0Wcs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,测试设计评审纪要    
  与会人：陈钦卿、范瑜、贺国锋、程康    
  评审时间：2024.07.03 11:00:00    
  会议纪要：需确定BIT_FORMAT参数默认值是十进制还是二进制,Posted by chenqinqing at 七月 03, 2024 17:19|
|---|
