 IR链接：     [https://pingcode.yasdb.com/ship/ideas/67caaad7d424ab0a52b712d8?](https://pingcode.yasdb.com/ship/ideas/67caaad7d424ab0a52b712d8?)  

#YASHAN-3729  主备集群支持自动failover（主集群实例全部宕机一主一备）

SR链接：     [https://pingcode.yasdb.com/pjm/items/67d7934e7ce85d5a0759eaae?](https://pingcode.yasdb.com/pjm/items/67d7934e7ce85d5a0759eaae?)  

#YDBRD-39077 主备集群支持自动failover（主集群实例全部宕机一主一备）

## ﻿  [ 1. 总述 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#1-%E6%80%BB%E8%BF%B0)  ﻿

一主一备集群，支持主集群实例全部故障后，备集群自动failover升主。

### ﻿  [ 1.1 需求来源 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  ﻿

朝阳银行

### ﻿  [ 1.2 调研文档 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  ﻿

﻿  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67d78366529b5c0231ce4c50](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67d78366529b5c0231ce4c50)  

### ﻿  [ 1.3 需求分析 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  ﻿

|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|
|零丢失模式|1. 主备正常时，开启最大保护模式，备库宕机时，降为最大可用模式
1. 主库所有实例宕机后，在满足最大保护模式的情况下，进行failover
1. 否则不进行failover
,|是|是|
|非零丢失模式|1. 主备使用最大可用或者最大性能模式
1. 主库所有实例宕机后，进行failover
|是|是|


### ﻿  [ 1.4 数据字典 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  ﻿

无

### ﻿  [ 1.5 开源依赖 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  ﻿

无

## ﻿  [ 2. 接口 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#2-%E6%8E%A5%E5%8F%A3)  ﻿

  [election enable on](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20election.html#election-enable-on)  

  [election enable off](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20election.html#election-enable-off)  

  [election config show](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20election.html#election-config-show)  

  [election config set](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20election.html#election-config-set)  

  [election config unset](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20election.html#election-config-unset)  

  [election event show](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20election.html#election-event-show)  



## ﻿  [ 3. 规格与约束 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  ﻿

1. 仅支持一主一备集群
1. 零丢失模式下，主实例宕机前处于最大保护模式时，才能触发failover
1. 不支持脑裂自动修复
1. 开启OM选举时，必须所有实例在线（非master不要求open）
1. failover切换和保护模式切换依赖于yasom和对应节点的yasagent正常


## ﻿  [ 4. 特性 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#4-%E7%89%B9%E6%80%A7)  ﻿

![image.png](https://pingcode.yasdb.com/atlas/files/public/67d78e636a1ae92ae3737091/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBZ0FBQUFRQUFBQUFBQUNnQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjY5MjAsImV4cCI6MTc4MjM3NzcyMH0.ZyCrgy3n-2T7BVVAdQhbbSiSjh7w_cCozq_riGRbEto)

每个服务器上都有一个yasagent，yasom把监控信息传给所有的yasagent，让yasagent监控每个实例的状态。

当某个实例发生异常，yasagent就会上报给yasom，yasom决策，做出相应的处理，比如failover或者改变保护模式。



yasboot命令进行控制并配置相关参数：

yasboot:

1. yasboot   election enable on/off --force       // 开启或关闭选举功能，on：开启自选举，off：关闭自选举，--force：在数据库状态异常的情况下，强制关闭自选举（可能会导致数据库主机无法启动）
1. yasboot election config -k key -v value      // 设置选举相关参数
1. yasboot election config show             // 显示主备选举状态和选举参数配置
1. yasboot election event show             // 显示yasom启动以来，发送的选举相关事件


参数如下（右边为默认值）：

- FailoverThreshold = 9;                 // 触发failover的心跳超时时间，单位s，取值范围[2,1000]，心跳间隔默认1s，目前无法修改。
- FailoverAutoReinstate = false； //  集群不支持脑裂自动修复
- ZeroDataLossMode=true;          //  数据零丢失模式，  **正常情况下以最大保护模式运行，切换后变为最大可用**  ，并禁止自动切换 ，直到旧主机降备并完全同步新主机


### 4.1基于yasom自动切换流程

基于yasom的自动切换，是外部仲裁模式，由yasom下发切换命令。总共有5个步骤：

1. 检测切换条件是否满足，如：主机是否正常，主备LAG是否过大；
1. 选择日志最多的备机，下发alter database failover命令；
1. 持久化新主node id和reset id；
1. 更新路由等其他操作；
1. 如果旧主机恢复连接，则降备，脑裂修复。


![](https://pingcode.yasdb.com/atlas/files/public/673969a48970c2af4f51f9a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBZ0FBQUFRQUFBQUFBQUNnQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjY5MjAsImV4cCI6MTc4MjM3NzcyMH0.ZyCrgy3n-2T7BVVAdQhbbSiSjh7w_cCozq_riGRbEto)

###  4.2切换模式

1. 普通模式：适用于最大可用、最大性能。切换限制少，但不保证RPO=0，数据可能丢失；
1. 零丢失模式：适用于最大保护。只在确保备机不丢数据的情况下，即RPO=0，才执行自动切换，RTO < 30s，否则等待人工介入


### 4.3 切换条件

1. 自动切换开启，主集群master实例和备集群master实例均已OPEN，并且备集群不是NEED REPAIR状态；
1. 备库与主集群所有实例失联时间超过  FailoverThreshold，并且yasom也查不到主集群的存活实例；
1. 如果是  **零丢失模式**  ，备机不丢失数据的情况下，才能自动切换   。    


## ﻿  [ 5. Testcases（自测用例） ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  ﻿

|用例|预期|﻿  
|
|---|---|---|
|零丢失模式，主集群所有实例用yasctl stop，然后拉起旧主库|保护模式模式降级为最大可用，然后备集群升主。然后旧主库降备，随后恢复最大保护模式|﻿  
|
|零丢失模式，备集群所有实例用yasctl stop，过一会再open|保护模式模式降级为最大可用，过一会恢复为最大保护|﻿  
|
|零丢失模式，先后stop备集群和主集群，等保护模式降级后，然后拉起备集群|failover不会触发|﻿  
|
|非零丢失模式，先后stop备集群和主集群，然后拉起备集群|failover会触发，旧主库重启后，可能脑裂||


## ﻿

