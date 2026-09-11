Created by 李垠, last modified on 十一月 08, 2024

#   [YCS支持多节点集群启停](#ycs支持多节点集群启停)  

SR链接:     [https://jira.yasdb.com/browse/YDBRD-20480](https://jira.yasdb.com/browse/YDBRD-20480)  

##   [1. 总述](#1-总述)  

YCS节点启停的设计已经在之前去scsi需求中完成，从功能上讲，前序设计已经具备2节点以上并发启停的能力。本文档的目的在于，明确2节点和2节点以上并发启动场景在设计上的差异，作为开发自验和测试设计的参考。

附去scsi并发启停设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=130147446](https://conf.yasdb.com/pages/viewpage.action?pageId=130147446)  

###   [1.1 需求来源](#11-需求来源)  

前期集群数据库交付的是2节点场景，为了提升产品竞争力，要求支持4节点场景。YCS从设计看已经满足2节点以上的场景，对于4节点，需要梳理流程上的差异，识别不兼容的实现细节。

###   [1.2 调研文档](#12-调研文档)  

关于并发启停的调研在前序设计中已经完成，本文不再赘述。

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|并发启动ycs|详见前序设计文档|否|是|
|功能|并发停止ycs|详见前序设计文档|否|是|
|可维可测|投票开始告警|在投票开始时打印告警|否|是|
|可维可测|投票结束告警|在投票结束时打印告警|否|是|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|告警|投票开始告警包含投票信息，投票结束告警包含投票结果|----|是|


##   [3. 规格与约束](#3-规格与约束)  

_1）并发停止部分节点包含主节点时，如果触发了db switchover，可能会导致db停止失败，需要通过配置强制停止来解决

_2）启动ycs与停止ycs并发时，db可能会因为not open反复被拉起，需要通过db自选主解决

_3）启动ycs与停止ycs并发时，如果正在停止的db被选为主，可能触发db core，需要通过db自选主解决

_4）并发停止部分ycs时，如果db退出与reform并发，可能导致db无法停止，需要通过配置强制停止来解决

##   [4. 特性](#4-特性)  

###   [4.1 并发启动YCS](#41-并发启动ycs)  

并发启动流程：

_1）从ycs盘获取全部信息

_2）容错处理：如果主节点被kill掉并立即拉起，为了避免双主，它不能再成为主，它将等待其他节点选举结束产生新的主，如果超时则触发投票

_3）写初始磁盘心跳

_4）如果集群中先启动的节点已经完成投票，则获取新master

如果新master无效，则发起投票，发送事件，触发集群启动

如果master有效，则加入集群

容错处理：在加入主节点时，先探测主节点是否存活，如果主节点离线，则触发投票

_5）如果集群正在投票（其他节点），则退出启动流程，待投票完成后，发送事件，触发集群启动

_6）ycs监控进程会周期探测投票进度，待投票完成，会触发事件，集群会根据主、备角色进入启动流程

_6）投票选出的主节点，会选择yfs和db的master

容错处理：当主节点产生后，等待选举结果的节点会请求加入，此时，主节点会根据自身状态来决定是否允许加入，即如果资源master还未产生，则拒绝加入，备节点会重试，直到资源主产生或者超时退出。

![](https://pingcode.yasdb.com/atlas/files/public/67396c6ca1ad9a3311dc8a80/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBUUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3MjEsImV4cCI6MTc4MjMxMTUyMX0.XFrRwmEvWq-sd9D4ncdociuqeZ_MDKyWflJLGk3376w)

###   [4.2 并发停止YCS](#42-并发停止ycs)  

停止流程

_1）停止db、yfs资源监控

_2）检测标志位，如果已经停止则返回成功，防止重复停止

_3）下发停止db的脚本

_4）等待db停止成功，如果超时未停止成功，则根据配置参数WAIT_STOP_FIN_TIME决定是否强制停止db

```
当WAIT_STOP_FIN_TIME大于0时，则超过WAIT_STOP_FIN_TIME未停成功，触发强制停止

如果WAIT_STOP_FIN_TIME为0，则会一直等待db停止成功

```

_5）更新topo

_6）停止yfs

_7）停止资源监听

_8）停止ycs监控、停止磁盘心跳

_9）ycs退出集群

```
  对于主节点：向其他节点发送主退出消息， 其他节点收到后，将主在自己的topo中设置为离线，db master的ycs选取新的db master；触发投票

  对于备节点：向主节点发退出消息，主节点收到后将退出节点在topo中设置为离线

```

_10）关闭连接

_11）停止ICS、停止计时、停止线程管理

_12）关闭log

下图是2个YCS退出集群的时序图

![](https://pingcode.yasdb.com/atlas/files/public/67396c6ca1ad9a3311dc8a81/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQkFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBUUlBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3MjEsImV4cCI6MTc4MjMxMTUyMX0.XFrRwmEvWq-sd9D4ncdociuqeZ_MDKyWflJLGk3376w)

###   [4.3 特性可维可测设计](#43-特性可维可测设计)  

投票开始告警trigger to select new primary, old primary: 0

投票结束告警teller node 1 write vote result finished, new master:1, age:2, voting age: 2

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=138563388](https://conf.yasdb.com/pages/viewpage.action?pageId=138563388)  

##   [6.资料设计章节](#6资料设计章节)  

2节点相关描述改为4节点

##   [7.未来规划](#7未来规划)  

无

## Attachments:

[集群管理内部结构-第 4 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmM4OTcwYzJhZjRmNTIwYzExIiwicmVmX2lkIjoiNjczOTZjNmM3MjgyMDZlZmI5MmYxMjcwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzIxLCJleHAiOjE3ODIzODcxMjF9.Chw4X5eYpCmhBv0_ZnOIRW_la0K5aZMl_nZs-TqTbEI)

 (image/png)    


[集群管理内部结构-第 3 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmM4OTcwYzJhZjRmNTIwYzEyIiwicmVmX2lkIjoiNjczOTZjNmM3MjgyMDZlZmI5MmYxMjcwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzIxLCJleHAiOjE3ODIzODcxMjF9.dwpJrsRD12qn7hkySKxP6_M-n9OII1W4echf7Yx7WcQ)

 (image/png)    


 (application/octet-stream)    


## Comments:

|  [](null)  ,2节点和4节点并发启停的差异在于：,4节点在并发处理上比2节点多几层算法，因为牵扯多个角色的转换，计票着，候选者，跟随着，以及一个周期巡检的一个角色（normal）。,同理，3节点同样存在差异于2节点，存在多个节点的角色转换，,Posted by zhangqian at 十二月 28, 2023 16:24|
|---|
