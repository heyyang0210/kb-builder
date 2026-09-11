Created by 范瑜, last modified on 十二月 14, 2023

*此次是功能点优化，且无相关数据库可以调研， 因此测试概要设计中只会做简单的描述*

# 1. 概述

*简要说明本功能/需求的背景，本文档的适用范围*

SR：    [YDBRD-22233](https://jira.yasdb.com/browse/YDBRD-22233?src=confmacro)    -  【OM】yasldr导入通过agent发起  完成  /    [YDBRD-22233](https://jira.yasdb.com/browse/YDBRD-22233?src=confmacro)    -  【OM】yasldr导入通过agent发起  完成

需求背景：  当前yasboot load导入的csv文件必须和yasom进程在同一台主机上。而实际使用过程中，由于单台机器磁盘存贮容量的限制，csv文件会存放在多台不同主机上。因此，本特性需要支持agent模式，可以导入yasagent主机上的csv文件

交付形态：分布式/单机/集群（  工具不区分部署形态  ）

交付版本：23.2

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


实现功能：支持导入部署数据库的主机（yasagent）上的csv文件

对外接口：

yasboot load命令新增参数：

|长参|短参|说明|是否必填|
|---|---|---|---|
|--host-id|无|拆分和导入的csv文件所在主机id, 可以通过yasboot cluster status 命令查询|否，默认是  yasagent  进程所在主机|


## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


需求主要应用场景：

（1）未新增主机，指定--host-id进行拆分/导入

（2）新增主机， 指定--host-id进行拆分/导入

  


与其它特性关联场景：

（1）本地/远程导入（  *--to-local*  ）

（2）是否压缩（--gz）

（3）是否删除csv文件（–delete）

（4）拆分模式：part、node、nodepart

（5）已拆分文件路径(  *--split-file-directory*  )

## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


（1）导入的csv文件必须在yasom管理的主机(yasagent)上

  


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

因为主要使用场景的流程比较清晰，所以本次测试采用场景法为主，边界值/等价类方法为辅

|测试项|前置条件|测试场景|备注|
|---|---|---|---|
|未新增主机|（1）csv文件所在主机无om节点,（2）csv文件所在主机有om节点|1、未指定--host-id执行拆分/导入|  
|
|  
|  
|1、指定--host-id执行拆分,csv文件所在主机，覆盖：    
  （1）为非csv文件所在主机id,（2）为csv文件所在主机,拆分模式，覆盖：,（1）part,（2）node,（3）nodepart,--delete是否删除旧文件， 覆盖：是、否,--to_local是否将文件发送到远程， 覆盖：是、否,--gz是否压缩打包文件，覆盖：是、否,2、指定--host-id进行拆分 + 删除旧文件 + --gz压缩打包文件 + --to_local将文件发送到远程|  
|
|  
|（1）文件拆分后在本地,（2）文件拆分后并发送到远程机器|1、指定--host-id执行导入，--host-id覆盖：,（1）执行命令主机与拆分后文件所在主机不同。 比如：在host1上执行导入命令，csv文件在host2，--host-id为host2（2）执行命令主机与拆分后文件所在主机相同。 比如：都是host1|  
|
|  
|  
|1、指定--host-id一键拆分导入,执行命令主机，覆盖：,（1）与--host-id相同,（2）与--hots-id不同,2、指定--host-id进行拆分 + 删除/不删除旧文件 + 远程/本地导入|  
|
|新增主机|（1）csv文件所在主机无om节点,（2）csv文件所在主机有om节点|在新增主机上执行导入|  
|
|  
|  
|在新增主机上执行拆分|  
|
|  
|  
|在新增主机上执行一键拆分和导入|  
|
|其它|  
|执行拆分， 主备切换后执行导入拆分后的文件|  
|
|  
|  
|表类型：heap、lsc、tac|  
|
|  
|  
|数据类型：lob、其它|  
|
|  
|  
|分区类型：非分区表、分区表|  
|
|  
|  
|组网：分布式、单机、集群|  
|
|参数校验|  
|--host-id参数校验：,有效参数：在场景测试中已覆盖,无效参数：,（1）值为空/空串,（2）值格式不正确、内容不正确、错误--host-id等|  
|


## 3.2 详细测试设计

[YDBRD-22233 yasldr导入通过agent发起详细测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWNhMWFkOWEzMzExZGM4NGI4IiwicmVmX2lkIjoiNjczOTZiYWM1OTNmOTljOWZmMjM2NWEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTgzLCJleHAiOjE3ODIzODI1ODN9.hKbDheDp32ULmhlFuSA3gtthzbyl4QzLyJCB0Ggvnvg)

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|  
|


  


# 4. 测试用例

[YDBRD-22233 yasldr导入通过agent发起测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWNhMWFkOWEzMzExZGM4NGI5IiwicmVmX2lkIjoiNjczOTZiYWM1OTNmOTljOWZmMjM2NWEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTgzLCJleHAiOjE3ODIzODI1ODN9.m8Yp9-73wHRN8PQrO1bNIkEQ5DyvvaTwWYTNFlgFddU)

1. *测试设计评审时提供冒烟文本用例；*
1. *启动测试之前提供文本用例，并完成大部分自动化用例；*


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


使用导入导出测试框架

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：4  *人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[YDBRD-22233 yasldr导入通过agent发起测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWNhMWFkOWEzMzExZGM4NGI5IiwicmVmX2lkIjoiNjczOTZiYWM1OTNmOTljOWZmMjM2NWEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTgzLCJleHAiOjE3ODIzODI1ODN9.m8Yp9-73wHRN8PQrO1bNIkEQ5DyvvaTwWYTNFlgFddU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-22233 yasldr导入通过agent发起详细测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWNhMWFkOWEzMzExZGM4NGI4IiwicmVmX2lkIjoiNjczOTZiYWM1OTNmOTljOWZmMjM2NWEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTgzLCJleHAiOjE3ODIzODI1ODN9.hKbDheDp32ULmhlFuSA3gtthzbyl4QzLyJCB0Ggvnvg)

 (application/x-xmind)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：朱松平、范瑜    
  评审时间：2023.11.9 14:50:00    
  评审地点：708会议室    
  评审纪要信息：    
  1、拆分，主备切换后，再导入,  
,Posted by fanyu at 十二月 12, 2023 20:01|
|---|
