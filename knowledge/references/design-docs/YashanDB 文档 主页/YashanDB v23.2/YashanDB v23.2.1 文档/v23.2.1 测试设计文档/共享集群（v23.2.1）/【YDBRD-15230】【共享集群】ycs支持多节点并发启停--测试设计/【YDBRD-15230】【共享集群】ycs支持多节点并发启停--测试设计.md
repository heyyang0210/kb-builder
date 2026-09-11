Created by 张茜, last modified on 一月 22, 2024

# **1. 概述**

崖山集群服务（后续简称YCS）负责管理共享集群数据库，包括：集群节点管理，节点的加入退出，故障仲裁；集群资源管理，例如数据库、文件系统、浮动IP（技术项目阶段暂不支持）等等，维护资源依赖关系，启停、监控节点上的资源，并提供查询节点资源拓扑的接口能力方便被管理资源根据拓扑信息进行集群重组。

共享集群  之前已经具备2节点并发启停的能力，  本文描述支持4节点并发启停，主要包含节点的加入退出，选举流程，资源的加入退出。

SR：       [YDBRD-15230](https://jira.yasdb.com/browse/YDBRD-15230?src=confmacro)    -  【共享集群】ycs支持多节点并发启停  完成

开发设计文档：    [YCS支持多节点集群启停详细设计方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138572091)  

测试概要设计：    [YDBRD-20480 测试概要设计文档 - 张丽红 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141560994)  

# **2. 需求分析**

## 2.1     基本功能特性

|功能|  
,设计表现|设计说明|涉及接口|
|:---|:---|:---|:---|
|YCS进程启动|通过命令行拉起YCS进程|客户端工具进程直接启动YCS进程|ycsctl start ycs|
|YCS进程停止|通过命令行停止YCS进程|客户端工具发送停止命令到YCS服务端，服务端自行停止|ycsctl stop ycs|
|DB进程启动|通过命令行拉起DB进程|  
|ycsctl start instance|
|DB进程停止|通过命令行停止DB进程|  
|ycsctl stop instance|
|告警日志|投票开始告警|在投票开始时打印告警|trigger to select new primary, old primary: 0|
|告警日志|投票结束告警|在投票结束时打印告警|teller node 1 write vote result finished, new master:1, age:2, voting age: 2|
|YCS topo状态查看|通过命令查看topo状态|客户端工具从服务端获取topo信息并展示|ycsctl status|


## 2.2 启停并发

1）四  节点场景，带DB的YCS启停操作和DB启停操作可并发     （不考虑单独DB的启停并发）

## 2.3 规格约束

1、并发启停包含主节点，出现以下问题时不关注：

     1）并发停止部分节点包含主节点时，如果触发了db switchover，可能会导致db停止失败，需要通过配置强制停止来解决

     2）启动ycs与停止ycs并发时，db可能会因为not open反复被拉起，需要通过db自选主解决

     3）启动ycs与停止ycs并发时，如果正在停止的db被选为主，可能触发db core，需要通过db自选主解决

     4）并发停止部分ycs时，如果db退出与reform并发，可能导致db无法停止，需要通过配置强制停止来解决

2、多节点故障

3、不考虑HA集群

4、只考虑DB以OPEN模式启动

5、DFX节点随机故障不考虑

# **3. **  **详细测试设计**

## **3.1. 测试设计方法**

4节点在并发处理上比2节点多几层算法，因为牵扯多个角色的转换，计票着，候选者，跟随着，以及一个周期巡检的一个角色（normal）。

同理，3节点同样存在差异于2节点，存在多个节点的角色转换，  因此从黑盒测试的角度上需要考虑并发处理选主多于2节点。

主要采用场景法、正交组合法梳理测试场景，涉及以下几方面：

1）参数AUTO_START取值覆盖（NEVER、ALWAY）。

2）并发启停交互场景，其中包含YCS和YCS交互、YCS和DB交互：带DB场景包含：带业务和不带业务但有数据

      1、并发启动

      2、并发停止

      3、并发启动和停止交互。

3）并发启停和故障交互场景  （不测）  ：

     覆盖不同的故障类型，包括：

     1、kill -19、kill -15、kill -9 。

     2、网络延迟、丢包、内存满、cpu满、断网卡、reboot。

## ** 3.2. 详细测试设计**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|是|
|HA|/|
|压力|/|
|性能|/|
|可维护性|是|


# **4. 测试用例**

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例


[多节点并发启停--冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzc4OTcwYzJhZjRmNTIwNmQ2IiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.pONBB0ZE1S6jD13OOwG52w0Q2SZSYF9FV-Osrtk19uU)

[【YDBRD-15230】【共享集群】ycs支持多节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTRkIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.shF8gcJ_c8MkyBm4nOGOZ8f9wNKeAth40_vq08W8Lgs)

[多节点并发启停--2节点.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTRlIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9._UREmRkZyrtONllJ93OHd-Q0120Fkg97XpYcpdoneNc)

# **5. 测试框架设计**

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


|用例类型|测试框架|用例目录|用例个数|备注|
|:---|:---|:---|:---|:---|
|基本故障业务场景用例|ha|  
|/|  
|
|DB并发启停用例|ha|  
|/|  
|
|公共故障场景用例|dfr|/|  
|  
|
|长稳用例|regress_rac|/|  
|  
|
|并发KT用例|testkill|/|  
|  
|
|一致性KT用例|consistency|/|  
|  
|
|不可自动化用例|/|  
|  
|  
|


  


# **6.测试环境说明**

1）部署形态：集群

2）节点数量：4节点

3）部署模式：单主机磁阵+多主机磁阵

# **7. 工作量评估**

**工作量：15人天**

|工作量|备注|
|:---|:---|
|四节点并发启停用例输出|  
|
|新增并发启停自动化|  
|
|新增并发启停用例测试执行|  
|
|问题单跟踪回归|  
|
|CI工程新增和沟通对齐|  
|
|需求上车|  
|


  


# **8. TODO**

  


# **9. 上车工程分析**

  


  


  


  


  


  


  


  


  


  


  


  


  


  


  


## Attachments:

[image2023-12-27_16-16-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTRmIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.t6d--IS7p-q1WaaHKSmrIhbqhsOXEhuowovUEp7m_K8)

 (image/png)    


[多节点并发启停--冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzc4OTcwYzJhZjRmNTIwNmQ2IiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.pONBB0ZE1S6jD13OOwG52w0Q2SZSYF9FV-Osrtk19uU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[【YDBRD-15230】【共享集群】ycs支持多节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzc4OTcwYzJhZjRmNTIwNmQ3IiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.IkqUf8zwpKq-plcsodXlTovINPQ7T_q6A9uU7_NDLO8)

 (application/x-xmind)    


[【YDBRD-15230】【共享集群】ycs支持多节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzc4OTcwYzJhZjRmNTIwNmQ4IiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.rdiOhUbnqHcAQKTesKu7sFwNOdMG0n9PRIRCOId5O_w)

 (application/x-xmind)    


[【YDBRD-15230】【共享集群】ycs支持多节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzc4OTcwYzJhZjRmNTIwNmQ5IiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.4ACs1G0oey1Q56X3FGJgRlTFHXsScxCt1-h0_srAAEU)

 (application/x-xmind)    


[2节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTUwIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.yjuGDI1G4GBMZ8uFU8AVdqaJIqNIw1W8seft-somd2I)

 (application/x-xmind)    


[2节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTUxIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.55sXYN3o0w9IUBVjiWP52CiXW03s3ati8OqcJCy_p4E)

 (application/x-xmind)    


[【YDBRD-15230】【共享集群】ycs支持多节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTRkIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.shF8gcJ_c8MkyBm4nOGOZ8f9wNKeAth40_vq08W8Lgs)

 (application/x-xmind)    


[多节点并发启停--2节点.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTRlIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9._UREmRkZyrtONllJ93OHd-Q0120Fkg97XpYcpdoneNc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2023/12/28 周四15:00-16:00    
  二、会议地点：线上会议    
  三、会议主持人：张茜    
  四、参会人员：Trump、李垠、吕雷奇、张丽红、徐凡博、张茜    
  五、会议主题：【YDBRD-15230】ycs支持多节点并发启停--测试设计,会议纪要：    
  1、并发启停过程中，db会因为not open反复被拉起。 --需要开发提供碰到该问题的解决手段    
  2、YCS多节点并发启停，YFS是否需要配合YCS？？ --需要YCS和YFS开发对齐，已确认，无特别说明，只要查看topo正常和yfscmd 操作正常即可。    
  3、网络故障过程中，其他节点启停，需要完善设计导图。    
  4、补充YFS元数据同时并发启停操作。,Posted by zhangqian at 十二月 28, 2023 17:03|
|---|
|  [](null)  ,交付范围不包含四节点，因此4节点并发启停只挑一些基础并发场景做基本场景覆盖。主要覆盖2节点并发启停。,[2节点并发启停.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzdhMWFkOWEzMzExZGM4NTUxIiwicmVmX2lkIjoiNjczOTZiYzY3MjgyMDZlZmI5MmYwYTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTcyLCJleHAiOjE3ODIzODMzNzJ9.55sXYN3o0w9IUBVjiWP52CiXW03s3ati8OqcJCy_p4E),Posted by zhangqian at 一月 03, 2024 11:35|
