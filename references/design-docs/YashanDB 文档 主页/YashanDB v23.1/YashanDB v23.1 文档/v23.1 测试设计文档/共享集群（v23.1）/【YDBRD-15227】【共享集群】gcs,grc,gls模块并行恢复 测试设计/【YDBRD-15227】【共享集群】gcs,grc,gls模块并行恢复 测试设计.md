Created by 牛亚娜, last modified on 一月 04, 2024



-   [1. 概述](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-1.概述)  
-   [2. 需求分析](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-2.需求分析)  
    -   [2.1 测试规格](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-2.1测试规格)  
    -   [2.2 约束限制](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-2.2约束限制)  
-   [3. 测试设计方法 ](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-3.测试设计方法)  
-   [4. 详细测试设计](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-4.详细测试设计)  
    -   [4.1 考虑的因子](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-4.1考虑的因子)  
    -   [4.2 GCS资源故障恢复场景](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-4.2GCS资源故障恢复场景)  
    -   [4.3 GLS资源故障恢复场景](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-4.3GLS资源故障恢复场景)  
    -   [4.4 GRC处理在线恢复的请求](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-4.4GRC处理在线恢复的请求)  
    -   [4.5 GRC资源重分布](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-4.5GRC资源重分布)  
-   [5. 测试用例](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-5.测试用例)  
-   [6. 测试框架设计](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-【YDBRD15227】【共享集群】gcs,grc,gls模块并行恢复测试设计-7.测试环境说明)  




# **1. 概述**

本文描述gcs,grc,gls模块并行恢复 测试设计

SR:    [YDBRD-15227](https://jira.yasdb.com/browse/YDBRD-15227?src=confmacro)    -  【共享集群】gcs,grc,gls模块并行恢复  完成

开发设计文档：    [GRC资源恢复](https://conf.yasdb.com/pages/viewpage.action?pageId=122063649)      [GRC处理在线恢复中的请求](https://conf.yasdb.com/pages/viewpage.action?pageId=122064961)  

# **2. 需求分析**

- 集群中每个实例都会管理一部分资源，叫master资源，同时持有一些全局lock资源和block资源。当某个实例发生故障时，它所管理的master资源将会被重分布到在线实例上，同时它所持有的全局资源信息需要从对应的master里面移除。
- GRC会提供  构造recovery set时的block请求；  recovery set构建完成后，也会提供block不在recovery set里面的正常访问


### 2.1 测试规格

- 部署形态：集群
- 部署环境：多主机磁阵+单主机磁阵
- 节点个数：两节点


### 2.2 约束限制

- 暂只支持两实例部署的在线恢复处理
- 集群DB故障在线恢复期间，涉及GRC访问的业务会卡住重试，直至对应的GRC资源已经处于正确状态。
- 集群DB故障在线恢复期间，不能做DDL业务
- 暂不支持二次故障，二次故障指DB在线恢复期间再次发生实例故障
- 如果实例未处于open状态，实例被切换为主，自己abort
- 集群HA模式不支持


# **3. 测试设计方法 **

主要采用场景法梳理测试点，主要包括这几类，其中故障的方式是”kill -9“

- 实例故障后，GCS资源恢复正常
- 实例故障后，GLS资源恢复正常
- 实例故障后，GRC处理在线恢复的请求正常


# **4. 详细测试设计**

### **4.1 考虑的因子**

|考虑的因素|分类|备注|
|---|---|---|
|故障的实例角色|master|  
|
|  
|requester|  
|
|  
|owner|  
|
|故障的实例个数|1个实例|  
|
|  
|所有实例|  
|
|RMO三者之间的关系|requester与master在相同节点，owner在单独节点|  
|
|  
|owner与master在相同节点，requester在单独节点|  
|
|  
|requester与owner在相同节点，master在单独节点|  
|
|YCS是否自动拉起DB|自动拉起|  
|
|  
|不自动拉起|  
|
|GCS场景|本地加载block|  
|
|  
|请求current block读|  
|
|  
|请求current block写|  
|
|  
|请求upgrade block|  
|
|  
|pc场景|  
|
|GLS场景|申请  Mutex Lock-本地无可复用锁，request master获取lock|  
|
|  
|申请  Mutex Lock-本地有可用锁，直接复用|  
|
|  
|申请  Mutex Lock-其他实例持有此lock|  
|
|  
|申请S锁-本地无可用锁，  request master获取lock|  
|
|  
|申请S锁-本地有可用锁，直接复用|  
|
|  
|申请S锁-其它实例有兼容锁(S锁/多个S锁/X锁降级为S锁)|  
|
|  
|申请S锁-其它实例有不兼容锁(X)|  
|
|  
|申请X锁-本地无可用锁，  request master获取lock|  
|
|  
|申请X锁-本地有可用锁，直接复用|  
|
|  
|申请X锁-其它实例有不兼容锁(S锁/多个S锁)|  
|
|  
|申请X锁-其它实例有不兼容锁(X锁/S锁升级为X锁)|  
|


### **4.2 GCS资源故障恢复场景**

这部分通过GCS的基本场景，在各消息流构造故障，观测资源恢复后是否正常。这部分无法精确构造，重点关注故障后实例状态是否正常、恢复后资源访问是否正常、资源的一致性

|故障编号|故障名称|故障场景|故障位置|备注|
|---|---|---|---|---|
|FP_GCS_1|GRC_GCS_FAULT_POINT_1|master要求owner发送block之后|doAskOwnerSendBlock函数最后|  
|
|FP_GCS_2|GRC_GCS_FAULT_POINT_2|master广播invalidBlock消息之后|broadcastInvalidateBlock：分别第一次和最后一次|两节点不可测|
|FP_GCS_3|GRC_GCS_FAULT_POINT_3|master要求发送UpgradeBlock之后|grantRequesterUpgradeBlock最后|两实例并发可以构造|
|FP_GCS_4|GRC_GCS_FAULT_POINT_4|master要求owner invalid block之后|doAskOwnerInvalidateBlock最后|两节点不可测|
|FP_GCS_5|GRC_GCS_FAULT_POINT_5|master要求owner发送 cr block之后|gcsAskOwnerSendCrBlock最后|  
|
|FP_GCS_6|GRC_GCS_FAULT_POINT_6|master处理invalid block ack之前|grcProcessAck 开头部分|两节点不可测|
|FP_GCS_7|GRC_GCS_FAULT_POINT_7|master处理invalid block ack之后，还要等ack|grcProcessAck else 分支|两节点不可测|
|FP_GCS_8|GRC_GCS_FAULT_POINT_8|master处理invalid block ack之后，最后一个ack|grcProcessAck if分支|两节点不可测|
|FP_GCS_9|GRC_GCS_FAULT_POINT_9|master处理close消息之前|grcCloseRequest  开头|  
|
|FP_GCS_10|GRC_GCS_FAULT_POINT_10|master处理close消息之后|grcCloseRequest 中 doCloseRequest函数调用之后|并发构造|
|FP_GCS_11|GRC_GCS_FAULT_POINT_11|master处理close消息之后，处理队列消息之前|grcCloseRequest 中 grcPopRequest函数调用之后|并发构造|
|FP_GCS_12|GRC_GCS_FAULT_POINT_12|owner发送block之前|gcsOwnerSendBlock 开始|  
|
|FP_GCS_13|GRC_GCS_FAULT_POINT_13|owner发送block之后|gcsOwnerSendBlock 最后|  
|
|FP_GCS_14|GRC_GCS_FAULT_POINT_14|owner发送cr block之前|gcsOwnerSendCrBlock 开始|  
|
|FP_GCS_15|GRC_GCS_FAULT_POINT_15|owner发送cr block之后|gcsOwnerSendCrBlock 最后|  
|
|FP_GCS_16|GRC_GCS_FAULT_POINT_16|owner失效block 之前|gcsDoInvalidateBlock 开始|两节点不可测|
|FP_GCS_17|GRC_GCS_FAULT_POINT_17|owner失效block 之后|gcsDoInvalidateBlock 最后|两节点不可测|
|FP_GCS_18|GRC_GCS_FAULT_POINT_18|最后一个owner失效block 之前|gcsOwnerInvalidateBlock 开始|两节点不可测|
|FP_GCS_19|GRC_GCS_FAULT_POINT_19|最后一个owner失效block 之后|gcsOwnerInvalidateBlock 最后|两节点不可测|
|FP_GCS_20|GRC_GCS_FAULT_POINT_20|requester远程请求一个block，发出去之后|axcCall 中 axcRecv调用之前|  
|
|FP_GCS_21|GRC_GCS_FAULT_POINT_21|requester远程请求一个block，收到页面回复ACK，拷贝页面之前|msgOwnerSendBlockAck 中 gcsHandleReceivedBlock调用前|  
|
|FP_GCS_22|GRC_GCS_FAULT_POINT_22|requester远程请求一个block，收到页面回复ACK，发送close之前|msgOwnerSendBlockAck 中 gcsCloseRequestBlock调用前|  
|
|FP_GCS_23|GRC_GCS_FAULT_POINT_23|requester远程请求一个block，收到页面回复ACK，发送close之后|msgOwnerSendBlockAck 中 gcsCloseRequestBlock调用后|  
|
|FP_GCS_24|GRC_GCS_FAULT_POINT_24|requester远程请求一个block，收到读盘ACK，发送close之前|gcsGrantLoadBlockAck中gcsCloseRequestBlock调用前|  
|
|FP_GCS_25|GRC_GCS_FAULT_POINT_25|requester远程请求ra block，收到ACK，发送close之前|gcsProcessRaBlockAck中gcsCloseRequestBlock调用前|需要重启一个实例构造，最开始插入数据至少2个block，通过全表扫描请求ra block|
|FP_GCS_26|GRC_GCS_FAULT_POINT_26|requester远程请求一个block，收到读盘upgrade ACK，发送close之前|gcsGrantUpgradeBlockAck中gcsCloseRequestBlock调用前|  
|


### **4.3 GLS资源故障恢复场景**

这部分通过GLS的基本场景，在各消息流构造故障，观测资源恢复后是否正常。这部分无法精确构造，重点关注故障后实例状态是否正常、恢复后资源访问是否正常、资源的一致性

|故障场景|备注|
|---|---|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner时，master故障|提供打点|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner时，owner故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner时，master和owner都故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master时，owner故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master时，master故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master时，master和owner都故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master，master收到消息后，授权锁资源给requester时，master故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master，master收到消息后，授权锁资源给requester时，requester故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master，master收到消息后，授权锁资源给requester时，master和requester都故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master，master收到消息后，授权锁资源给requester，requester回复close ack时，requester故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master，master收到消息后，授权锁资源给requester，requester回复close ack时，master故障|  
|
|requester申请  lock  ，master收到消息后，发送  "释放锁"消息给owner，owner回复”锁已释放“消息给master，master收到消息后，授权锁资源给requester，requester回复close ack时，master和requester都故障|  
|


### **4.4 GRC处理在线恢复的请求**

这部分主要是涉及到在线恢复过程中对block的访问是否正常，在基本dml和ddl业务下发过程中构造故障，其他实例访问block

- 访问recovery set中的block时，会出现卡住，直到恢复流程完成
- 访问不在recovery set里面的的block时，可以正常访问


|场景|备注|
|---|---|
|依次kill各实例，再依次启动各实例，每启动一个实例，都进行业务下发，基本dml操作，申请block|主要为串行场景，观测故障前后同一份资源访问是否正常|
|同一个实例反复kill多次，每次kill都带业务，基本dml操作，申请block|  
|
|多个实例反复kill，每次kill都带业务，基本dml操作，申请block|  
|
|某个实例kill后，在剩余实例继续进行业务下发；再次启动被kill实例，继续在全部存活实例上进行业务下发，基本dml操作，申请block|  
|
|某个实例kill后，在剩余实例继续进行业务下发；再次启动被kill实例，继续在全部存活实例上进行业务下发，继续多次重复前面的kill操作。。。基本dml操作，申请block|  
|
|  
|  
|
|依次kill各实例，再依次启动各实例，每启动一个实例，都进行业务下发，基本dml+ddl操作，申请lock|  
|
|同一个实例反复kill多次，每次kill都带业务，基本dml+ddl操作，申请lock|  
|
|多个实例反复kill，每次kill都带业务，基本dml+ddl操作，申请lock|  
|
|某个实例kill后，在剩余实例继续进行业务下发；再次启动被kill实例，继续在全部存活实例上进行业务下发，基本dml+ddl操作，申请lock|  
|
|某个实例kill后，在剩余实例继续进行业务下发；再次启动被kill实例，继续在全部存活实例上进行业务下发，继续多次重复前面的kill操作。。。基本dml+ddl操作，申请lock|  
|


### 4.5 GRC资源重分布

这部分主要观察两点：

- 实例故障后，该实例的资源是否重分布在存活实例上，重分布是否正常
- 故障实例恢复后，资源再次重分布是否正常


|场景|备注|
|---|---|
|实例启动成功后，kill主实例|  
|
|实例启动成功后，kill备实例|  
|
|实例启动成功后，kill主实例，再拉起主实例|  
|
|实例启动成功后，kill备实例，再拉起备实例|  
|
|实例启动成功后，kill主实例，再kill备实例|  
|
|实例启动成功后，kill主实例，再kill备实例，再拉起主实例和备实例|  
|


# **5. 测试用例**

[YDBRD-15227-grc资源故障恢复-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2JhMWFkOWEzMzExZGM3OTAzIiwicmVmX2lkIjoiNjczOTY5Y2I1OTNmOTljOWZmMjM1MmVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTg4LCJleHAiOjE3ODIyOTUzODh9.B7ZTf8q5WgzCVAtLKOmUGz6-YGrkbuVE5vVGXlmCcNE)

# **6. 测试框架设计**

使用ha框架和testkill框架

# **7. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[YCS故障恢复门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2JhMWFkOWEzMzExZGM3OTA1IiwicmVmX2lkIjoiNjczOTY5Y2I1OTNmOTljOWZmMjM1MmVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTg4LCJleHAiOjE3ODIyOTUzODh9.YhtHOzMQyr8_RiKkjN0f0yyd2GRNfWGNxDYKEuTvuYg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-8-8_16-34-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2I4OTcwYzJhZjRmNTFmYThlIiwicmVmX2lkIjoiNjczOTY5Y2I1OTNmOTljOWZmMjM1MmVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTg4LCJleHAiOjE3ODIyOTUzODh9.HBYjOYtW5UBWwoyGD0z8_W78V2qNPvbIiRaUfXe7W2A)

 (image/png)    


[YDBRD-15227-grc资源故障恢复-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2JhMWFkOWEzMzExZGM3OTAzIiwicmVmX2lkIjoiNjczOTY5Y2I1OTNmOTljOWZmMjM1MmVhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTg4LCJleHAiOjE3ODIyOTUzODh9.B7ZTf8q5WgzCVAtLKOmUGz6-YGrkbuVE5vVGXlmCcNE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,配置参数data_buffer_part，测试基本功能，重点关注恢复前后资源状态一致,并行资源恢复正常----测试性能指标中关注该点,Posted by zhanglihong at 八月 14, 2023 12:08|
|---|
|  [](null)  ,设置配置参数_DATA_BUFFER_PARTS值小于8，等于8，大于8时，测试基本功能，重点关注恢复前后资源状态是否一致,Posted by niuyana at 八月 18, 2023 10:28|
