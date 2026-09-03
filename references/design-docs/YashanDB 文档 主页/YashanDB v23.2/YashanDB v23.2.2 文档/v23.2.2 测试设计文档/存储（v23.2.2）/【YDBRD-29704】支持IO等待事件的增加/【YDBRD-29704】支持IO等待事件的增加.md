Created by 刘丹, last modified on 四月 18, 2024

IR链接：    [[YDBRD-29668]](https://jira.yasdb.com/browse/YDBRD-29668)      [ 等待事件完善 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-29668)  

SR链接：    [[YDBRD-29704]](https://jira.yasdb.com/browse/YDBRD-29704)      [ IO相关等待事件完善 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-29704)  

# 1. 概述

新增2个system I/O的等待事件，vm换入换出和数据文件的扩展。发生相应的等待事件后，可以在V$system_event,v$session_event种查看等待事件的命中次数和前台耗时

# 2. 需求分析

## 2.1 功能点分析

- 新增2个等待事件，vm换入换出：  swapping in/out vm block,数据文件扩展：extending data file
- 构造等待事件，在V$session_event和v$system_event中可以查看等待事件的命中次数
- 有等待事件时，session退出后在v$session_event的等待事件数量会减少，但是v$system_event的数量保持不变


## 2.2 应用场景

- 构造VM换入换出和数据文件扩展场景，查询V$SESSION_EVENT，V$system_event视图，记录了等待事件的发生


## 2.3 规格约束

- VM的换入换出和数据文件的扩展不依赖于具体的部署形态，所以单机、集群和分布式均涉及这些等待事件的加入。


# 3. 详细测试设计

## 3.1 测试设计方法

对于本次设计主要采用场景法

- 通过构造不同的等待事件，查询视图观测各个字段是否符合预期


## 3.2 详细测试设计

涉及场景：

1.环境：单机，集群，分布式

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


|编号|测试场景|用例详细描述|预期|备注|
|---|---|---|---|---|
|1|单机--正常功能场景|不构造等待事件，查询x$system_event、v$session_event、v$system_event视图|X$system_event视图中可以查到新增的3个等待事件，v$session_event、v$system_event视图中当前SID没有|数据文件扩展覆盖resize和表空间不足自动扩展两种场景|
|  
|  
|构造  VM的换入换出和数据文件的扩展等待事件，在v$session_event、v$system_event视图中查询|查询结果正常，字段准确|  
|
|  
|  
|打开2个session，分别构造  VM的换入换出和数据文件的扩展等待事件，在v$session_event、v$system_event视图中查询,关闭其中一个session，|查询结果正常，字段准确,V$system_event的记录不变，V$sesion_event中的记录减一|  
|
|  
|  
|分别构造  VM的换入换出和数据文件的扩展等待事件，在v$session_event、v$system_event视图中查询,增加一个session,在该session中构造等待事件，|V$system_event和V$sesion_event中的记录增加|  
|
|  
|集群|基本场景同单机|  
|GV是个实|
|  
|  
|2个实例上分别构造等待事件，查询  v$session_event、v$system_event视图和GV$session_event和GVv$system_event视图,断开其中一个实例|在  v$session_event、v$system_event视图中只能查到当前实例的等待事件，在GV视图中可以查到所有实例的等待事件,GV$session_event视图查询到的等待事件减少|  
|
|  
|  
|构造等待事件，查询  v$session_event、v$system_event视图和GV$session_event和GVv$system_event视图,在起一个实例，构造等待事件|GV$session_event，GV$system_event视图查询到的等待事件增加|  
|
|  
|分布式|同单机|  
|分布式不支持resize|
|2|并发|构造  VM的换入换出和数据文件的扩展等待事件  ，同时查询视图,  
|无core和卡住问题|多session数据文件扩展，表空间减小，同时查询视图|
|  
|长稳|数据文件扩展|  
|  
|


# 4. 测试用例

1、门槛用例

[IO等待事件增加门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmJhMWFkOWEzMzExZGM4Yzg3IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.5uLfW7tSl6rw60E_lucsiWKhTRxxNVsRYLpecothAEQ)

2、文本用例

[IO等待事件的文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmJhMWFkOWEzMzExZGM4Yzg4IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.DytsxK514jIxdq0zeCylJRcdcnu2aTe64i3tfEGK0xE)

# 5. 测试框架设计

- guider框架


# 6. 测试环境说明

linux

# 7. 工作量评估

工作量：  *1人/5天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmJhMWFkOWEzMzExZGM4Yzg5IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.xZXy-OBRHLqPzKR5iYiXbp_Fri5yL8YN1oWEHT-0zuM)

## Attachments:

[session_event文本用例模版.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmNhMWFkOWEzMzExZGM4YzhhIiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.YPWEbCYKzwRxf-ND6o7ZrDNFZnoi6IQ32Cylp6g62Iw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmJhMWFkOWEzMzExZGM4Yzg5IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.xZXy-OBRHLqPzKR5iYiXbp_Fri5yL8YN1oWEHT-0zuM)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmNhMWFkOWEzMzExZGM4YzhiIiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.uO54K69nM5OUXsR62uR3G6oFK29J8S2pKOVgEZiyfhA)

 (application/msword)    


[IO等待事件增加门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmJhMWFkOWEzMzExZGM4Yzg3IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.5uLfW7tSl6rw60E_lucsiWKhTRxxNVsRYLpecothAEQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[IO等待事件的文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmJhMWFkOWEzMzExZGM4Yzg4IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDc3LCJleHAiOjE3ODIzODk0Nzd9.DytsxK514jIxdq0zeCylJRcdcnu2aTe64i3tfEGK0xE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,与会人：刘丹、郑荃、李佐龙    
  会议时间：2024.04.11    
  会议地点：线上会议,会议  纪要：,1. 新增测试点：并发构造多session，多次resize表空间，同时查询视图
1. 长稳中可以增加数据文件扩展的场景
,Posted by liudan at 四月 11, 2024 10:51|
|---|
