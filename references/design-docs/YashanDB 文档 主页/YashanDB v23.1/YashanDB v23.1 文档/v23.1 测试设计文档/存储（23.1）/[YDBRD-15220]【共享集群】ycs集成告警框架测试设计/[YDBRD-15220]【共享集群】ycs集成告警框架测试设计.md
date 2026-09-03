Created by 高亚宁, last modified by  吕雷奇 on 十一月 22, 2023

# 1. 概述

-   [1. 概述](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-1.概述)  
-   [2. 需求分析](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-2.需求分析)  
    -   [功能特性：](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-功能特性：)  
-   [3. 测试设计方法 ](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-3.测试设计方法)  
    -   [3.1 测试范围：](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-3.1测试范围：)  
    -   [3.2 专项覆盖](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-3.2专项覆盖)  
-   [4. 详细测试设计      ](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-4.详细测试设计)  
-   [5. 测试用例](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-5.测试用例)  
-   [6. 测试框架设计](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-[YDBRD15220]【共享集群】ycs集成告警框架测试设计-7.测试环境说明)  


本文描述ycs集成告警框架测试设计。

# **2. 需求分析**

SR：    [YDBRD-15220](https://jira.yasdb.com/browse/YDBRD-15220?src=confmacro)    -  【共享集群】ycs集成告警框架  完成

研发设计文档：    [共享集群告警日志框架 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113974055)  

### **功能特性：**

1. 支持当共享集群发生特定状况的时候，上报告警。
1. 支持系统特定状况解除时取消报警。


**功能限制：目前支持以下6种告警**

|告警项|告警类型名称|产生告警的对象ID|触发上报告警条件|触发取消报警条件|备注|
|:---|:---|:---|:---|:---|:---|
|结点间链路异常关闭|  `InterChannelClosed`  |对端结点Id|网络心跳超时|结点重连成功|CI 虚拟机分机部署下构造；|
||||ics链路异常关闭|||
|访问选举盘异常|DiskError|0|读盘异常：,1、请求选举时遇到读盘失败|结点内部重启流程|读写权限变更，构造；,  
|
|||0|写盘异常：,1、请求选举时遇到写盘失败|||
|||0|锁盘异常：,1、选主时锁盘失败|||
|结点被踢出集群|ClusterSeparated|0|在结点异常断连重组集群时，block 上的 age与内存中的不一致|结点内部重启流程|触发topo变更后；|
|||0|结点启动失败|||
|||0|发送磁盘心跳失败|||
|||0|选主时重置失败|||
|||0|选主时该结点是下线状态|||
|选举盘检查异常|NewVoteExpected|0|YCS监控线程中检查到非新加入的选举磁盘age大于内存age|结点内部重启流程|  
|
|数据库异常停止|DBInstanceDown|db的resource id|yasDB进程挂掉|DB重新上线|  
|
|告警日志重置标记|AlertReset|当前结点id|YCS启动成功后|无|遇到该告警项时，之前的告警上报的事件都已经解决，不会再发取消告警。|


# **3. 测试**  **设计方法**   

主要采用  场景法进行设计

### 3.1 测试范围：

1. 磁阵环境，Rac单机部署3实例；
1. 触发6种告警项、消除，告警产生、消除信息正确上报
1. 告警上报原则


### 3.2 专项覆盖

|专项|是否涉及|说明|
|:---|:---|:---|
|并发|不涉及|  
|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


# 4.   **详细测试设计**

[YCS告警.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGVhMWFkOWEzMzExZGM3OTc1IiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.l8--8slr_ha18FEmERrV-CJktl-vM-gcnF24Q6CCBPM)

# 5.   **测试用例**

[集群支持告警.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGVhMWFkOWEzMzExZGM3OTc2IiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.uBtukbcQUEQGgGyY33tnXAbmh7SG7tT_rBbdUwYPpN0)

# 6.   **测试框架设计**

本次测试为手动测试。

  


# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[集群支持黑匣子.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGU4OTcwYzJhZjRmNTFmYWZkIiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.blMXK-PNcOhJog5K6hF8uVvRY70PBpblzBHfSsGEo70)

 (application/x-xmind)    


[黑匣子.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGU4OTcwYzJhZjRmNTFmYWZlIiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.S7S0IYP5hL1aUtqNvPGRBt2te4pwLFtZ0vWEQa6i1gI)

 (application/x-xmind)    


[image2021-11-2_17-6-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGU4OTcwYzJhZjRmNTFmYWZmIiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.dM0HlGW0GqrQagXgW1EOa1b9I1R3lXKOXEF-vAWs9OY)

 (image/png)    


[image2021-11-2_17-5-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGU4OTcwYzJhZjRmNTFmYjAwIiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.8EsDSpZ1xkB3Ixk8pD0x0uWPhOO9GrfmJv7YOe4yvQg)

 (image/png)    


[image2021-11-2_17-3-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGU4OTcwYzJhZjRmNTFmYjAxIiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.55XlwBhXHTKW6c2UwswB_ZZlWMiFfYX185jTEF0Gh_w)

 (image/png)    


[image2021-11-2_17-2-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGVhMWFkOWEzMzExZGM3OTc3IiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.rNHmsYFC-RqUIG6whZrXN9DTZDBZ95CcJC6YUOD4o5M)

 (image/png)    


[YCS告警.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGVhMWFkOWEzMzExZGM3OTc1IiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.l8--8slr_ha18FEmERrV-CJktl-vM-gcnF24Q6CCBPM)

 (application/x-xmind)    


[集群支持告警.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGVhMWFkOWEzMzExZGM3OTc2IiwicmVmX2lkIjoiNjczOTY5ZGQ1OTNmOTljOWZmMjM1M2FhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjEwLCJleHAiOjE3ODIyOTYwMTB9.uBtukbcQUEQGgGyY33tnXAbmh7SG7tT_rBbdUwYPpN0)

 (application/vnd.ms-excel)    
