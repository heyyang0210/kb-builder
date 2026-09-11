Created by 刘美秀, last modified on 七月 22, 2024

# 1.   **概述**

分布式放开 DN/MN 3副本约束，规格变更为支持5副本

  


SR：    [https://pingcode.yasdb.com/pjm/items/66611413288e1978209d27a5](https://pingcode.yasdb.com/pjm/items/66611413288e1978209d27a5)    ?    
  #YDBRD-28867 输出多副本跨DC/跨城部署容灾方案

  


开发概要设计：    [分布式容灾方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156125395)  

开发设计：    [容灾切换后节点间元数据不一致修复方案设计 - 廖增康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156116864)  

  


# 2.   **需求分析**

### **2.1 功能点分析**

- DN支持5副本
- MN支持5副本


### **2.2 应用场景**

3地3中心5副本

### **2.3 约束**

- DN/MN 最大支持5副本


# 3.   **测试设计方法**

## 3.1 测试设计方法

|验证项|设计方法|
|:---|:---|
|功能验证|场景法|
|特性交互|场景法、等价类划|


### 特性关联领域分析：

1. 部署：DN/MN 5节点部署成功，超出报错
1. 故障场景：5节点，节点故障个数<=2，业务正常，否则异常；主节点故障能自动选主
1. 扩缩容：组内/组间，扩容至5节点，超出报错
1. 资料：规格刷新


## 3.2 详细测试设计

- 验证不同节点个数部署。


|节点类型|验证项|验证点|预期结果|备注|
|---|---|---|---|---|
|DN|部署|5节点|部署成功，故障大于2个节点无法选主；,重启集群后业务正常。|  
|
|  
|  
|6节点|package config gen配置生成失败、|  
|
|  
|  
|  
|toml中手动加到6节点，  ~~无法部署成功~~|不会报错|
|MN|部署|5节点|部署成功，故障大于2个节点无法选主；,重启集群后业务正常。|  
|
|  
|  
|6节点|package config gen配置生成失败、|  
|
|  
|  
|  
|toml中手动加到6节点，  ~~无法部署成功~~|不会报错|
|YCM|可视化部署|6mn/dn组内6节点|报错|  
|
|  
|  
|5mn，dn组内5节点|部署成功|  
|
|ALL|最大规格|5Mn，8DN, 32-5DN|部署成功，DDL/DML正常|  
|


- DN组内部署5节点采用场景法设计用例。


|节点类型/节点id|验证项|1(主)|2(备)|3（备）|4(备)|5(备)|预期|
|---|---|:---:|:---:|:---:|---|---|:---:|
|MN/DN|1备节点故障|正常|正常|正常|正常|正常|读写正常|
|  
|  
|~~正常~~|~~故障~~|~~正常~~|~~正常~~|~~正常~~|~~读写正常~~|
|  
|  
|~~正常~~|~~正常~~|~~故障~~|~~正常~~|~~正常~~|~~读写正常~~|
|  
|  
|~~正常~~|~~正常~~|~~正常~~|~~故障~~|~~正常~~|~~读写正常~~|
|  
|  
|~~正常~~|~~正常~~|~~正常~~|~~正常~~|~~故障~~|~~读写正常~~|
|  
|2备节点故障|正常|正常|故障|正常|故障|读写正常|
|  
|3备节点故障|正常|故障|故障|正常|故障|可读|
|  
|主节点故障|故障|正常|正常|正常|正常|选主后读写正常|
|  
|主+1备故障|故障|故障|正常|正常|正常|选主后读写正常|
|  
|主+2备故障|故障|故障|正常|正常|故障|读写异常|
|  
|~~主+3备故障~~|~~故障~~|~~故障~~|~~正常~~|~~正常~~|~~故障~~|~~读写异常~~|
|  
|所有节点故障|故障|故障|故障|故障|故障|读写异常|


|场景|测试点|预期|备注|
|---|---|---|---|
|DN切换，CN和MN正常|组内5节点正常|1.DDL/DML正常；,2. 备节点数据同步正常。|  
|
|  
|无业务场景下主节点故障|1.记录选主时间；,2. CN选择正确主进行DDL/DML；,3.故障节点恢复之后状态为follower，同步数据正常。|RTO<30秒|
|  
|主节点故障|1.连接主节点session报错，cn上报错合理；未完成事务回滚。,2.选出主之前无法进行DDL/DML操作；,3.选出主之后无残留事务，新业务正常；,4.故障节点恢复之后降备。|RTO<30秒,保持事务一致性，下同。|
|  
|高并发业务下，DN组内节点连续进行选举|1.最终可以选出主节点；,2.查询节点状态正常。|  
|
|MN切换，CN和DN正常|场景同上|  
|  
|
|DN组内扩缩容|1主，扩容4节点，缩容至1节点|成功|带业务背景|
|  
|1主，扩容5节点|生成配置报错，|  
|
|  
|  
|toml中手动加到6节点，  ~~无法扩容成功~~|不会报错|
|  
|1主2备，扩容2节点|成功|  
|
|  
|1主2备，扩容3节点|报错|  
|
|MN组内扩缩容|场景同上|  
|  
|
|DN组扩容|扩容1DN组，跨机，节点数为5|  
|  
|
|  
|扩容1DN组，跨机，节点数为6|报错|  
|


  


- 视图查询


（1）v$election

本视图显示在HA架构中开启自动选举时，当前节点实时的选举状态，当自动选举关闭时本视图无数据。

|字段|类型|说明|
|---|---|---|
|LEADER_SERVICE_ID|INTEGER|主节点服务ID|
|LEADER_SERVICE_GROUP_ID|INTEGER|主节点所在的服务内组ID|
|LEADER_GROUP_NODE_ID|BIGINT|主节点的节点id|
|TERM|BIGINT|当前主节点的任期|
|LFN|BIGINT|日志刷盘序号|
|LFN_TERM|BIGINT|日志刷盘的任期|
|STATE|VARCHAR(64)|当前节点的选举状态    
  * Startup：启动    
  * PreCandidate：预选举    
  * Candidate：候选者    
  * Follower：跟随者    
  * Leader：领导者    
  * Shutdown：关闭    
  * Unknown：未知|
|LAST_HEARTBEAT_TIME|TIMESTAMP|当前节点最后一次收到心跳的时间|


（2）dv$election

本视图显示在分布式集群的HA架构中开启自动选举时，当前节点实时的选举状态，当自动选举关闭时本视图无数据。

|字段|类型|说明|
|---|---|---|
|SERVICE_ID|INTEGER|节点服务ID|
|SERVICE_GROUP_ID|INTEGER|服务内组ID|
|GROUP_NODE_ID|BIGINT|组内节点id|
|LEADER_SERVICE_ID|INTEGER|主节点服务ID|
|LEADER_SERVICE_GROUP_ID|INTEGER|主节点所在的服务内组ID|
|LEADER_GROUP_NODE_ID|BIGINT|主节点的节点id|
|TERM|BIGINT|当前主节点的任期|
|LFN|BIGINT|日志刷盘序号|
|LFN_TERM|BIGINT|日志刷盘的任期|
|STATE|VARCHAR(64)|当前节点的选举状态    
  * Startup：启动    
  * PreCandidate：预选举    
  * Candidate：候选者    
  * Follower：跟随者    
  * Leader：领导者    
  * Shutdown：关闭    
  * Unknown：未知|
|LAST_HEARTBEAT_TIME|TIMESTAMP|当前节点最后一次收到心跳的时间|


测试点：

正常情况下选举信息是否正常；

注入故障查看选举是否正常；

视图查询结果是否正确。

  


**专项**

|验证项|备注|
|:---|---|
|DFR|用例加入到dfr中|


**资料**

|验证项|
|:---|
|~~部署~~|
|~~扩缩容~~|
|高可用/YashanDB高可用概述|
|产品描述/产品规格/物理规格|


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

冒烟：

  


  


文本：

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *4人天*

计划测试执行时间：

## Attachments:

[image2022-4-11_15-53-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWRhMWFkOWEzMzExZGM5MmY5IiwicmVmX2lkIjoiNjczOTZkYWQ3MjgyMDZlZmI5MmYyMWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNTYxLCJleHAiOjE3ODIzOTY5NjF9.lMoOjPquwRdIKZSOtY8HNz6oMn3jm1R2a4VaqmzwJXw)

 (image/png)    


[image2022-4-11_19-55-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWRhMWFkOWEzMzExZGM5MmZhIiwicmVmX2lkIjoiNjczOTZkYWQ3MjgyMDZlZmI5MmYyMWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNTYxLCJleHAiOjE3ODIzOTY5NjF9.M8s-2hIrXyaID2i38U4URZUcf2lhL27GuKjM2c8yj8g)

 (image/png)    


[image2022-4-11_21-37-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWQ4OTcwYzJhZjRmNTIxNDg3IiwicmVmX2lkIjoiNjczOTZkYWQ3MjgyMDZlZmI5MmYyMWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNTYxLCJleHAiOjE3ODIzOTY5NjF9.uLXAig4IUi2daxwYQ1ibsE6CZT6_0oO4l9uxTg6hWlA)

 (image/png)    


[分布式MNDN支持5副本文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWQ4OTcwYzJhZjRmNTIxNDg4IiwicmVmX2lkIjoiNjczOTZkYWQ3MjgyMDZlZmI5MmYyMWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNTYxLCJleHAiOjE3ODIzOTY5NjF9.B2lQnu_ff339emQ5aOngTdy1b5rQEtKCeBQuK363zwE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式MNDN支持5副本文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWQ4OTcwYzJhZjRmNTIxNDg5IiwicmVmX2lkIjoiNjczOTZkYWQ3MjgyMDZlZmI5MmYyMWQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNTYxLCJleHAiOjE3ODIzOTY5NjF9.xgE-yCyWQ4Plbukv68R4SYH4Bna8Du77OYRIuCOvn1c)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：何金阳，施新华，廖增康，刘美秀    
  会议时间：15:00-15:30    
  会议地点：1002    
  纪要信息：    
  1.信息同步：toml中手动加到6节点，可以部署成功    
  2.保留1个等价类，删除冗余用例：1备节点故障、主+3备故障    
  3.资料规格更新：产品描述/产品规格/物理规格,Posted by liumeixiu at 七月 15, 2024 16:33|
|---|
|  [](null)  ,1.信息同步：toml中手动加到6节点---，实际扩容会报错check yasdb configuration file error: max node you can add is 5, but 6 you given,Posted by liumeixiu at 七月 15, 2024 17:58|
