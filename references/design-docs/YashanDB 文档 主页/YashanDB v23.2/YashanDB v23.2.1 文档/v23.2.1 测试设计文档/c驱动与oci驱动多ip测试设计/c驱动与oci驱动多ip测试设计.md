Created by 龚雯, last modified on 十二月 18, 2023

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

  [YDBRD-23295](https://jira.yasdb.com/browse/YDBRD-23295?src=confmacro)    -  【OCI】支持指定多IP+primary模式  完成

  [YDBRD-23296](https://jira.yasdb.com/browse/YDBRD-23296?src=confmacro)    -  【c驱动】支持指定多IP+primary模式  完成

# 1. 概述

目前深燃外场在进行OCI切换的时候，原来使用的是mySql,支持在主备模式下的多ip配置，所以需要崖山也支持同样的特性。

代码仅改动C驱动，OCI依赖C驱动，规格一致，测试点一致，共享一份测试设计

# 2. 需求分析

## 2.1 功能点分析

- C驱动和oci在连接函数中支持多IP的URL，或者在C驱动的配置文件$YASDB_HOME  "  /client/yasc_service.ini支持多ip的配置。


## 2.2 应用场景

- *HA环境，不确定用哪个ip端口进行连接，传入多个ip端口的连接对，自动寻找最前面的可用连接对连接主机*


## 2.3 规格约束

- *只支持*  *primary模式，不支持loadBalance模式*


# 3. 详细测试设计

## 3.1 测试设计方法

*url字符串中ip和关键字primary有多个等价类-等价类划分法*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方*  *式*
1. 安全：有可能存在内存泄露，需要添加内存泄露工程


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|是|
|DFR|否|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


           HA：涉及连接主机备机，需要HA环境

           性能：需要测试在多ip时连接时长，如有过长的时间需要开发进行分析

|输入条件|有效等价类|编号|备注|无效等价类|编号|备注|
|:---|:---|:---|:---|:---|:---|:---|
|关键字|primary:|testMultiip_2|  
|primary|testMultiip_4|  
|
|  
|PRIMARY:|testMultiip_3|  
|loadbalance:|testMultiip_4|  
|
|  
|pRimarY:|testMultiip_4|  
|test:|testMultiip_4|  
|
|  
|空|testMultiip_1|  
|primary：|testMultiip_4|  
|
|ip个数|1|testMultiip_1|  
|0|testMultiip_5|  
|
|  
|2|testMultiip_2|  
|  
|  
|  
|
|  
|10|testMultiip_3|URL长度限制256字节|  
|  
|  
|
|分隔符|,|testMultiip_2|  
|，|testMultiip_6|  
|
|  
|  
|  
|  
|;|testMultiip_6|  
|
|  
|  
|  
|  
|空格|testMultiip_6|  
|
|连接方式|URL字符串|testMultiip_1|  
|  
|  
|  
|
|  
|$YASDB_HOME  /client/yasc_service.ini|  
|MULTIIP=12.1.1.1:1620,12.1.1.1:1620,12.1.1.1:1620,12.1.1.1:1620,12.1.1.1:1620,12.1.1.1:1620,12.1.1.1:1620,12.1.1.1:1620,192.168.7.206:6888,192.168.7.205:6888|  
|  
|  
|
|是否有空格|有|testMultiip_3|  
|  
|  
|  
|
|  
|无|testMultiip_2|  
|  
|  
|  
|
|有效主机的出现位置|第一个|testMultiip_7|  
|无|testMultiip_7|  
|
|  
|中间|testMultiip_7|  
|  
|  
|  
|
|  
|最后一个|testMultiip_3|  
|  
|  
|  
|
|非有效主机的连接对内容|有效备机|testMultiip_7|  
|格式错误，不符合ip:port的格式|testMultiip_8|  
|
|  
|无效连接对|testMultiip_2|  
|空串|testMultiip_8|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


C/OCI文本用例见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*
- *使用c/oci对应git仓库里的CUNIT框架，c驱动已使用HA部署，oci驱动工程使用单机部署，需要改写脚本为HA部署*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*机器ip：192.168.7.129 *

*操作系统：x86系统*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：12.01

## Attachments:

[oci多ip文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGNhMWFkOWEzMzExZGM4M2Q3IiwicmVmX2lkIjoiNjczOTZiOGM1OTNmOTljOWZmMjM2M2Y0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Mzc3LCJleHAiOjE3ODIzODE3Nzd9.grcLHYFTjossDB6SFpQ_WCVedrmgqmRAyIEb-KdDaPU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[oci&c多ip文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGM4OTcwYzJhZjRmNTIwNTYyIiwicmVmX2lkIjoiNjczOTZiOGM1OTNmOTljOWZmMjM2M2Y0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Mzc3LCJleHAiOjE3ODIzODE3Nzd9.H40ylBQzzU2TAqJAmsMjcIFCoNClPgb9-_CuSUEaWpY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
