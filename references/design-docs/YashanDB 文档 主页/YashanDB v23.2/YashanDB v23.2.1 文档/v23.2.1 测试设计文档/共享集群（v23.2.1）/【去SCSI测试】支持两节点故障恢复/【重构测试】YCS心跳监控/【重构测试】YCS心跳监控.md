Created by 张茜, last modified on 十一月 08, 2023

### 23.1重构前YCS相关SR及相关测试设计

  [【YDBRD-15390】【共享集群】故障恢复--监控流程测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122072653)  

  [【YDBRD-15225】【共享集群】ycs支持故障快速检测 测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=115150889)  

  [【YDBRD-14045】【共享集群】支持拓扑状态管理和监控，查看 测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112724891)  

### **【开发设计方案】**

**原方案设计：**    [共享集群拓扑状态管理和监控设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109593972)  

  [【YCS】ycs支持故障快速检测](113976093.html)  

**新方案：**    [ycs去依赖SCSI——监控流程设计方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130146158)  

  [ycs磁盘心跳监控方案设计 - 廖增康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133577030)  

### **【重构变化】**

**重构说明：**

投票流程：投票流程用于决定哪个节点将成为主节点或者执行特定任务    
  takeover是备切主。standalone以独立模式运行。    
  以前：当主ycs心跳异常时，备会做takeover流程备切主；备异常时，主以standalone模式运行    
  现在：当主ycs心跳异常时，备会走发现没主，投票流程选举主；备异常时，主走投票选举流程

![](https://conf.yasdb.com/download/attachments/133586056/image2023-11-8_9-41-16.png?version=1&modificationDate=1699407405000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc0NjEsImV4cCI6MTc4MjMwODI2MX0.C6Cr-WRMyGQNGffHpsro0Lm51XfxAkOxBsz-ApM7mhU)

  
  两者的结果一样，不过中间算法不一样。

**用例新增（DISK_HB_KEEP_ALIVE 、NETWORK_HB_TIMEOUT参数设置最小值和最大值）：**

1、不带DB业务，构造心跳异常

2、带DB业务（GCS、GLS），构造心跳异常，观察数据一致性。

  


### **【本次转测约束】**

 1、集群两节点测试。

  


### 【测试环境】

1、无scsi驱动的磁阵环境

2、去除提权

### 【测试方案】

1、 沿用原用例

2、 针对新增点进行补充测试(以前基本上都只是参数设置观察日志的场景)

3、故障模拟：网络延迟、网卡down、丢包、网络堵塞、kill -19、gdb、变更磁盘权限、卸载磁盘（可能不行？？）

4、RESTART_TIMES/STOP_DURING重拉次数/重拉间隔默认配置下

5、强制停止  WAIT_STOP_FIN_TIME=10s

### **【补充测试用例】**

**主要针对以下几类场景：**

1、不带DB业务，但DB有数据，设置DISK_HB_KEEP_ALIVE 、NETWORK_HB_TIMEOUT参数分别为最小值、最大值时，构造网络故障和磁盘故障，所有的场景均需要包含主备轮次故障

|序号|用例场景|用例名称|测试步骤|预期结果|备注|测试结果|
|---|---|---|---|---|---|---|
|1|DISK_HB_KEEP_ALIVE设置最小值2s、600s|ycs两两监控--磁盘心跳超时--多机|1、设置心跳时间为2s、600s,2、构造ycs进程磁盘心跳超时，触发心跳故障处理。（修改磁盘组权限/卸载磁盘组--ycr和投票盘）,3、恢复磁盘组权限|2、超过设置时间后ycs进程无法工作但进程还在DB进程不在，可通过ycsctl status查看,3、ycs进程恢复工作| 心跳超时，ycs两两监控，不会剔除ycs进程重拉，剔除进程重拉只会存在ycs和db间|  
|
|2|NETWORK_HB_TIMEOUT设置最小值2s、600s|ycs两两监控--网络心跳超时--多机|1、设置心跳时间为2s、600s,2、构造ycs进程网络心跳超时，触发心跳故障处理。,3、恢复网络|2、超过设置时间后无法工作，可通过ycsctl status查看,3、ycs进程恢复工作|  
,网络延迟、网卡down、丢包、网络堵塞、kill -19、gdb、kill -  ~~11， kill~~   15（DB和YCS安装部署选择不同网卡，模拟故障）|  
|
|3|DISK_HB_KEEP_ALIVE设置最小值2s、600s|ycs和db之间监控--磁盘心跳超时|1、设置心跳时间为2s、600s,2、构造ycs和db间磁盘心跳超时，触发心跳故障处理。（修改磁盘组权限/卸载磁盘组--数据盘）,3、恢复磁盘组|2、超过设置时间后不响应，通过yasql校验，设置时间+10s后，db进程被剔除重拉,3、重拉成功|  
|  
|
|4|NETWORK_HB_TIMEOUT设置最小值2s、600s|ycs和db之间--网络心跳超时|1、设置心跳时间为2s、600s,2、构造ycs和db间网络心跳超时，触发心跳故障处理。,3、恢复网络|2、超过设置时间后不响应，通过yasql校验，设置时间+10s后，db进程被剔除重拉,3、重拉成功|网络延迟、网卡down、丢包、网络堵塞、kill -19、gdb、kill -  ~~11， kill~~   15|  
|


2、带DB业务，yasql业务循环执行前提下，设置DISK_HB_KEEP_ALIVE 、NETWORK_HB_TIMEOUT参数分别为默认值最小值、最大值时，构造网络故障和磁盘故障，所有的场景均需要包含主备轮次故障

|序号|用例场景|用例名称|测试步骤|预期结果|备注|测试结果|
|---|---|---|---|---|---|---|
|1|DISK_HB_KEEP_ALIVE设置最小值2s、600s|ycs两两监控--磁盘心跳超时--多机|1、设置心跳时间为2s、600s,2、构造ycs进程磁盘心跳超时，触发心跳故障处理。（修改磁盘组权限/卸载磁盘组--ycr和投票盘）,3、恢复磁盘组权限|2、超过设置时间后无法工作但进程还在，可通过ycsctl status查看日志,3、ycs进程恢复工作|  
|  
|
|2|NETWORK_HB_TIMEOUT设置最小值2s、600s|ycs两两监控--网络心跳超时--多机|1、设置心跳时间为2s、600s,2、构造ycs进程网络心跳超时，触发心跳故障处理。,3、恢复网络|2、超过设置时间后无法工作，可通过ycsctl status查看,3、ycs进程恢复工作|  
,网络延迟、网卡down、丢包、网络堵塞、kill -19、gdb、kill -  ~~11， kill~~   15|  
|
|3|DISK_HB_KEEP_ALIVE设置最小值2s、600s|ycs和db之间监控--磁盘心跳超时|1、设置心跳时间为2s、600s,2、构造ycs和db间磁盘心跳超时，触发心跳故障处理。（修改磁盘组权限/卸载磁盘组--数据盘）,4、恢复磁盘组权限|2、超过设置时间后不响应，通过yasql校验，设置时间+10s后，db进程被剔除重拉,3、重拉成功|  
|  
|
|4|NETWORK_HB_TIMEOUT设置最小值2s、600s|ycs和db之间--网络心跳超时|1、设置心跳时间为2s、600s,2、构造ycs和db间网络心跳超时，触发心跳故障处理。,3、恢复网络|2、超过设置时间后不响应，通过yasql校验，设置时间+10s后，db进程被剔除重拉,3、重拉成功|网络延迟、网卡down、丢包、网络堵塞？？ 打点,kill -19、gdb、kill -  ~~11， kill~~   15|  
|


### **【开发门槛用例】**

## Attachments:

[image2023-11-6_15-0-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGM4OTcwYzJhZjRmNTIwNzc2IiwicmVmX2lkIjoiNjczOTZiZGM3MjgyMDZlZmI5MmYwYWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDYxLCJleHAiOjE3ODIzODM4NjF9.ULipO9rrVzUCLL8wxDqM8dRY0u-uAjDYbCFLj-Cp8aU)

 (image/png)    


[监控冒烟测试.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGQ4OTcwYzJhZjRmNTIwNzc3IiwicmVmX2lkIjoiNjczOTZiZGM3MjgyMDZlZmI5MmYwYWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDYxLCJleHAiOjE3ODIzODM4NjF9.PySDq_cq_GcWXT-zTJY9M5-AigAsgR-ExqY6iSzJHQQ)

 (text/plain)    


[image2023-11-8_9-41-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGQ4OTcwYzJhZjRmNTIwNzc4IiwicmVmX2lkIjoiNjczOTZiZGM3MjgyMDZlZmI5MmYwYWQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NDYxLCJleHAiOjE3ODIzODM4NjF9.KJaxVxyDTr8ouYf2vKJ-kEXCbj_uLDjuRXGHeLqwzu0)

 (image/png)    
