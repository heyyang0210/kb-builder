Created by 吕雷奇, last modified on 十一月 07, 2023

**SR链接：**    [YDBRD-16442](https://jira.yasdb.com/browse/YDBRD-16442?src=confmacro)    **-**  **YFS支持在线故障处理**  **完成**

**开发设计文档链接：**    [YFS 在线故障恢复](https://conf.yasdb.com/pages/viewpage.action?pageId=122071311)  

  


**使用说明 **    [【YDBRD-16442】YFS server 故障注入](https://conf.yasdb.com/pages/viewpage.action?pageId=124267067)  

# **1. 概述**

本特性sr主要交付了对于一些故障场景下，yfs系统依然可以对外提供高可用服务；

# **2. 需求分析**

**2.1 涉及场景**

1. 备机启动流程
    1. 主流程为备机启动时发送启动请求给主机，主机返回应答消息，备机接受消息后状态变更，开始启动，启动完成后，状态变更，并且发送消息给master，master清除冻结状态后正常提供服务，测试涉及过程中需要考虑主备之间通讯时主备之间状态变更，以及消息交互时的网络丢包和延迟；
1.  备机stop流程
    1. 主流为备机下发stop 命令后,备机发送stop命令给主机，主机节点收到消息后停止对应的备机任务；
1. 备机升主流程
    1. 备机开始升主时，把topo中记录的所有待加入备机节点获取到，等待所有备机节点计入后，完成升主；需要考虑备升主过程中，有新的备机节点加入集群，有备机从集群剔除；
1. 主备复制流程
    1. 主机在完成脏页刷盘前，会将redolog发送给备机，备机完成回放后，发送成功消息给主机，主机收到所有备机实例成功消息后，刷盘推进回放点。
1. 请求转发流程
    1. 当备机收到需要更改元数据字段的请求时，需要发送请求消息给主机，主机处理完消息后，将处理结果返回给备机；


**2.2 功能限制**

1. 只考虑两节点场景；
1. 不支持二次故障？
1. 当前测试不带db（不启动db）


# **3. 测试**  **设计方法**   

主要采用场景法进行测试

3.1 备机启动流程

![](https://pingcode.yasdb.com/atlas/files/public/673969d0a1ad9a3311dc7923/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUlBQUFFQUNBQUFRSUFBQUFnQkFBQUlBQUFBQUFBQUFBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBZ0FCRUFBQUFBQUNBQUVBQUFBQUFBUUJBQUFBQUFBQUFBQUFBQUFFQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxMjIsImV4cCI6MTc4MjIxOTkyMn0.S1aB5H_yqV8B2jKAVEK84NvWXz2IU-AbfyK0DA-uMqQ)

3.2备机stop流程

![](https://pingcode.yasdb.com/atlas/files/public/673969d0a1ad9a3311dc7924/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUlBQUFFQUNBQUFRSUFBQUFnQkFBQUlBQUFBQUFBQUFBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBZ0FCRUFBQUFBQUNBQUVBQUFBQUFBUUJBQUFBQUFBQUFBQUFBQUFFQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxMjIsImV4cCI6MTc4MjIxOTkyMn0.S1aB5H_yqV8B2jKAVEK84NvWXz2IU-AbfyK0DA-uMqQ)

3.3备机升主

![](https://pingcode.yasdb.com/atlas/files/public/673969d0a1ad9a3311dc7925/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUlBQUFFQUNBQUFRSUFBQUFnQkFBQUlBQUFBQUFBQUFBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBZ0FCRUFBQUFBQUNBQUVBQUFBQUFBUUJBQUFBQUFBQUFBQUFBQUFFQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxMjIsImV4cCI6MTc4MjIxOTkyMn0.S1aB5H_yqV8B2jKAVEK84NvWXz2IU-AbfyK0DA-uMqQ)

3.4主备复制

![](https://pingcode.yasdb.com/atlas/files/public/673969d08970c2af4f51fab0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUlBQUFFQUNBQUFRSUFBQUFnQkFBQUlBQUFBQUFBQUFBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBZ0FCRUFBQUFBQUNBQUVBQUFBQUFBUUJBQUFBQUFBQUFBQUFBQUFFQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxMjIsImV4cCI6MTc4MjIxOTkyMn0.S1aB5H_yqV8B2jKAVEK84NvWXz2IU-AbfyK0DA-uMqQ)

3.5 请求转发（备机收到更新元数据请求时，转发给主机）

![](https://pingcode.yasdb.com/atlas/files/public/673969d08970c2af4f51fab1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBRUlBQUFFQUNBQUFRSUFBQUFnQkFBQUlBQUFBQUFBQUFBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBZ0FCRUFBQUFBQUNBQUVBQUFBQUFBUUJBQUFBQUFBQUFBQUFBQUFFQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUNBQUFBQUNBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxMjIsImV4cCI6MTc4MjIxOTkyMn0.S1aB5H_yqV8B2jKAVEK84NvWXz2IU-AbfyK0DA-uMqQ)

# 4.   **详细测试设计**      

4.1备机启动：

|序号|场景描述|预期结果|是否需要加faultpoint|备注|
|---|---|---|---|---|
|1|备机启动流程中，备机发送build_req请求给主机时，丢包 10%|有重试机制，环境不core，  备机继续发送start_build_req给主机|需要加断点|测试结果；故障清除后能正常启动；节点状态正常|
|2|备机启动流程中，备机发送build_req请求给主机时，丢包 50%|有重试机制，环境不core，  备机继续发送start_build_req给主机|  
|测试结果；故障清除后能正常启动；节点状态正常|
|3|备机启动流程中，主机冻结状态发送应答报文给备机时，丢包|有重试机制，环境不core|需要加断点|测试结果；故障清除后能正常启动；节点状态正常|
|4|备机启动流程中，备机状态变更后，发送end_buid报文给主机，丢包|有重试机制，环境不core|需要加断点|  
|
|5|备机启动流程中，主机冻结状态后，发送start_build_ok给备机时，丢包|有重试机制，环境不core，  备机继续发送start_build_req给主机？|需要加断点|  
|
|6|备机启动流程中，在发送build_req请求前，kill备机|环境不core，备机还未加入集群，主机可以正常对外提供业务|需要加断点|  
|
|7|备机启动流程中，备机在发送了build_req请求后，kill备机|环境不core，主机通过topo变更解除冻结状态，可以正常对外提供业务|需要加断点|  
|
|8|备机启动流程中，备机在发送了end_build请求后，kill备机|环境不core，主机通过topo变更解除冻结状态，可以正常对外提供业务|需要加断点|  
|
|9|备机启动流程中，备机发送build_req请求给主机时，kill主机|环境不core，备机可以正常启动，启动完成后，可以正常对外提供业务|需要加断点|  
|
|10|备机启动流程中，主机冻结状态后，kill主机|环境不core，备机可以正常启动，启动完成后，可以正常对外提供业务|需要加断点|  
|
|11|备机启动流程中，备机发送end_buid报文给主机时，kill主机|环境不core，备机可以正常启动，启动完成后，可以正常对外提供业务|需要加断点|  
|
|12|备机启动流程中，主机收到多个备机同时启动的消息，主机冻结后，会记录多个请求冻结实例id|  
|  
|暂时不测，只考虑2节点|


4.2备机stop流程

|序号|场景描述|预期结果|是否需要加faultpoint|备注|
|---|---|---|---|---|
|1|备机stop流程中，发送stop_rep消息时，丢包|有重试，环境不core，备机正常stop，主机能对外提供业务，停止对应task？|需要加断点|  
|
|2|备机stop流程中，执行完stop命令后，kill 备机进程|环境不core，主机能正常提供业务|不用加断点|  
|
|3|备机stop流程中，执行完stop命令后，kill 主机进程|环境不core|不用加断点|  
|


4.3备机升主

|序号|场景描述|预期结果|是否需要加faultpoint|备注|
|---|---|---|---|---|
|1|备机升主过程中，等待备节点加入，发送rejoin消息给备机，丢包|有重试，环境不core|需要加断言|  
|
|2|备机升主过程中，其他备机状态为open，其他备机发送try_join消息给主机，丢包|有重试，环境不core|需要加断言|  
|
|3|备机升主过程中，其他备机状态为starting状态，发送ignore_join消息给主机，丢包|有重试，环境不core|需要加断言|  
|
|4|备机升主过程中，其他备机状态刚好为被主机标记为请求冻结的实例，发送refuse_join消息给主机，丢包|有重试，环境不core|需要加断言|  
|
|5|备机升主过程中，其他备机状态为open，kill备机|备机升主成功，可以正常对外提供业务|无需断言|暂时无法测试需要三节点|
|6|备机升主工程中，备机节点刚加入为starting状态，kill新加入的备机|备机升主成功，可以正常对外提供业务|无需断言|switchover kill 原备节点|
|7|备机升主过程中，其他备机状态刚好为被主机标记为请求冻结的实例，kill新加入的备机|备机升主成功，可以正常对外提供业务|  
|暂时无法测试需要三节点|
|8|备机升主过程中，其他备机状态为open，kill主机|  
|  
|暂时无法测试需要三节点|
|9|备机升主过程中，备机节点刚加入为starting状态，kill升主的节点|会重新备节点升主|无需断言|switchover kill 升主节点|
|10|备机升主过程中，其他备机状态刚好为被主机标记为请求冻结的实例，kill升主的节点|重新选主|  
|暂时无法测试需要三节点|


4.4主备复制流程

|序号|场景描述|预期结果|是否需要加faultpoint|备注|
|---|---|---|---|---|
|1|主备复制过程中，主机发送inc_rep 给备机，丢包|有重试，备机等待|需要加断言|  
|
|2|主备复制过程中，备机发送rep_ack 给备机，丢包|有重试，主机等待|需要加断言|  
|
|3|主备复制过程中，主机发送inc_rep 给备机前，kill备机|不core，主机正常|需要加断言|  
|
|4|主备复制过程中，备机发送rep_ack 给主机前，kill主机|备机升主，可以正常提供业务|需要加断言|  
|
|5|主备复制过程中，备机发送rep_ack 给主机前，kill备机|主机可以继续正常提供业务|需要加断言|  
|
|6|主备复制过程中，构造大量的脏页，脏页为刷盘时，kill主机，之后重新拉起主机|备机自动升主，且数据一致|需要加断言|带db业务？|


4.5请求转发

|序号|场景描述|预期结果|是否需要加faultpoint|备注|
|---|---|---|---|---|
|1|请求转发流程中，备机发送cmd_redirect给主机，丢包|有重试，不core|需要加断言|  
|
|2|请求转发流程中，主机处理完成后，发送结果给备机，丢包|有重试，不core|需要加断言|  
|
|3|请求转发流程中，主机状态非open，发送错误信息给备机，丢包|有重试，不core|需要加断言|  
|
|4|请求转发流程中，备机发送cmd_redirect给主机，kill主机|备机升主，可以继续对外提供业务|需要加断言|  
|
|5|请求转发流程中，备机发送cmd_redirect给主机，kill备机|不core，可以正常对外提供业务|需要加断言|  
|
|6|请求转发流程中，主机处理完消息，kill主机|不core，备机升主，可以继续对外提供业务|需要加断言|  
|
|7|请求转发流程中，主机状态非open，kill主机|不core，备机升主，可以继续对外提供业务|需要加断言|  
|
|8|请求转发流程中，主机状态非open，kill备机|不core，报错|需要加断言|  
|


  


# 5.   **测试用例**

  


# 6.   **测试框架设计**

  


# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-8-10_12-0-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDA4OTcwYzJhZjRmNTFmYWE5IiwicmVmX2lkIjoiNjczOTY5ZDA3MjgyMDZlZmI5MmVmN2Q0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTIyLCJleHAiOjE3ODIyOTU1MjJ9.RW3F6kWDdzoRPAOmKb3xOkq1bmyca5KatJkqanrKB9k)

 (image/png)    


[image2023-8-11_10-58-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDA4OTcwYzJhZjRmNTFmYWFiIiwicmVmX2lkIjoiNjczOTY5ZDA3MjgyMDZlZmI5MmVmN2Q0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTIyLCJleHAiOjE3ODIyOTU1MjJ9.gsmWuQyHTABqECfONptAXabEjaf-eOvmASc-z7jeUtk)

 (image/png)    
