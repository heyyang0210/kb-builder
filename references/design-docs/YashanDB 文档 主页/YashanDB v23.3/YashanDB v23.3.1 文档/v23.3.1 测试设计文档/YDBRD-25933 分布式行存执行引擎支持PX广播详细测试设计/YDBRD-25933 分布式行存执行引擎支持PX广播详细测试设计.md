Created by 赵育, last modified on 六月 15, 2024

# 1. 概述

为了提升分布式行执行的能力，YashanDB分布式行存执行引擎需要支持PX广播分发。

SR链接：    [https://pingcode.yasdb.com/pjm/items/6611a95d579a3edb84d863f8](https://pingcode.yasdb.com/pjm/items/6611a95d579a3edb84d863f8)    ?

#YDBRD-25933 分布式行存执行引擎支持PX广播

# 2. 需求分析

## 2.1 功能点分析

- 功能


          计划上已支持了 px broadcast 算子，本 sr 在执行层上适配行表；只要存在复制数据，都会走到 px broadcast 算子；

- 外部接口
- 体现在查询计划上，无其他外部接口的变化。
- 功能约束
- 分布式行目前不支持LOB数据类型。—不支持行外 lob 的计算(大于 4000)，行内支持。
- 实现流程


          参考开发设计文档

              [分布式行表支持px广播设计文档 - 李晶 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153025478)  

## 2.2 应用场景

- 典型场景：


1、复制表与分区表做 join/union

2、大表与小表做 join/union，广播小表的数据

3、非关联子查询：cn 上做 I2N 的分发、dn 上做 N2N 的分发（分布式行表不支持，暂不关注）；

## 2.3 规格约束

- 分布式行目前不支持LOB数据类型


# 3. 详细测试设计

## 3.1 测试设计方法

使用场景法对典型场景进行覆盖；

## 3.2 详细测试设计

功能：

1、非关联子查询在 cn 上汇聚，广播到 dn；---- I2N

3、非关联子查询：带多个条件，子查询作为其中一个条件，覆盖：broadcast 少量数据(子查询条件过滤掉大部分数据，分发少量数据的情况)、broadcast 大量数据(子查询过滤效果有限，验证数据分发大量数据的情况)；

4、数据类型：表中存在 lob(覆盖：行内、行外)、不存在 lob；

5、非关联子查询（下推到 dn 做为底层算子）作为 where 条件的条件值、作为 group by having 的条件值，单独表的条件；参考 tpch Q15、Q11、Q22 ---不涉及，不测试

6、复制表与分区表做 join/union

7、大表分区表与小表分区表做 join/union 

8、tpch 对比列表计划，使用 1G/10G 数据量，走 px broadcast 的算子在行表上执行；Q11、Q15、Q16、Q17、Q21、Q22、Q2、Q5、Q7、Q8

9、tpcds 对比列表计划，使用 1G/10G 数据量，测试 px broadcast 的算子在行表上执行；Q14、Q23、Q24、Q2、Q30、Q44、Q54、Q56、Q58、Q65、Q66、Q70、Q71、Q72、Q81、Q83、Q84、Q88、Q8、Q96

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及，单机移植用例已包含|
|KT|涉及，单机移植用例已包含|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|暂不考虑|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmZhMWFkOWEzMzExZGM5NTk4IiwicmVmX2lkIjoiNjczOTZlMmY3MjgyMDZlZmI5MmYyNmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTkxLCJleHAiOjE3ODI0NTczOTF9.LvmWg2PEc4lk0-C6h72G3mWIsOhLQ0CNxUMov6StKCc)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmZhMWFkOWEzMzExZGM5NTk4IiwicmVmX2lkIjoiNjczOTZlMmY3MjgyMDZlZmI5MmYyNmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTkxLCJleHAiOjE3ODI0NTczOTF9.LvmWg2PEc4lk0-C6h72G3mWIsOhLQ0CNxUMov6StKCc)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmY4OTcwYzJhZjRmNTIxNzI3IiwicmVmX2lkIjoiNjczOTZlMmY3MjgyMDZlZmI5MmYyNmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTkxLCJleHAiOjE3ODI0NTczOTF9.uIWsQj3PVJohgE4JxuROrEcvbMVb615ENxzZ4GONdGw)

 (application/msword)    


[分布式行存执行引擎支持PX广播测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmY4OTcwYzJhZjRmNTIxNzI4IiwicmVmX2lkIjoiNjczOTZlMmY3MjgyMDZlZmI5MmYyNmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTkxLCJleHAiOjE3ODI0NTczOTF9.b9phg-WxEMVZ0bH1ib3IMmnRMnkZvRAjtiu8W9d0I78)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式行存执行引擎支持PX广播测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmZhMWFkOWEzMzExZGM5NTk5IiwicmVmX2lkIjoiNjczOTZlMmY3MjgyMDZlZmI5MmYyNmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTkxLCJleHAiOjE3ODI0NTczOTF9.-wvEs3htxOXrU-kwa6sbAecLSqTBGXThw-DQNBdpaDw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式行存执行引擎支持PX广播测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMmZhMWFkOWEzMzExZGM5NTlhIiwicmVmX2lkIjoiNjczOTZlMmY3MjgyMDZlZmI5MmYyNmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcwOTkxLCJleHAiOjE3ODI0NTczOTF9.lhDxN54BwwoZfffOQ9Edo-eZJ-yrRuiRplv3iKOFReo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：冯浩楠、李晶、林俊喆、施新华、赵育    
  会议时间：2024/6/6 10:00-10:20    
  会议地点：线上会议    
  纪要信息：    
  1、lob 类型关注行内、行外的区别，存在行外 lob ，不走该算子，该 SR 暂时不做重点测试；    
  2、增加 CT、KT 用例    
  3、暂不关注性能，关注功能正确性    
  4、查询计划跟列表是否保持一致？---遗留待确认，@冯浩楠,Posted by zhaoyu at 六月 06, 2024 10:23|
|---|
