Created by 施新华, last modified on 十二月 22, 2023

# 1. 概述

目前YashanDB分布式部署下，DN组内至少需要3个节点；当有客户成本预算不足但又需要支持高可用时，就需要支持一主一备部署模式，支持故障自动切换，以降成本。

该方案基于  OM实现单机一主一备的功能上进行开发，通过OM进行仲裁切换。

SR：    [YDBRD-21153](https://jira.yasdb.com/browse/YDBRD-21153?src=confmacro)    -  分布式DN组支持一主一备形态  完成

概要设计：    [YDBRD-19830 分布式DN组支持一主一备形态部署概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133589335)    ，    [分布式DN组一主一备详细设计方案](138557371.html)  

# 2. 需求分析

DN组内一主一备实现切换，需要与OM密切配合实现。

## 2.1 功能点分析

- DN组内部署一主一备，yasom和yasagent正常情况下，主节点故障，备升主；
- 零丢失模式下，主故障后，备升主后保护模式切换成最大可用以便提供业务，RPO必须是0。
- 非零丢失模式，最大可用和最大性能保护模式下，主故障，备升主后保护模式不变。
- 非零丢失模式下，产生脑裂现象，旧主库降备后无法继续接收日志数据yasom能主动进行修复。
- yasom故障，仲裁功能无法使用。
- yasagent故障，yasom无法探测该主机上节点状态，影响切换。
- OM仲裁功能和自选举互斥，同时只能支持一种。(组内2节点以上采用raft自动选举能力  )
- 扩缩容与OM仲裁功能互斥。
- DV$REPLICATION_STATUS视图增加字段TIME_SINCE_LAST_MSG。
- OM配置开启仲裁能力后，DB侧参数  OM_ELECTION_ENABLE参数同步修改。
- 具体yasboot配置参数：


|yasboot命令|参数选项|参数含义|
|:---|---|---|
|yasboot election enable on,启用基于yasom的仲裁选举|*-c, --cluster*|部署YashanDB的集群名（必传参数）|
||*--group-ids*|组ID（必传参数）|
|yasboot election enable off,禁用基于yasom的仲裁选举|*-c, --cluster*|部署YashanDB的集群名（必传参数）|
||*--group-ids*|组ID|
||*-f, --force*|强制禁用，忽略离线的数据库节点的参数重置|
|yasboot election config show,展示仲裁选举的参数设置和运行状态|*-c, --cluster*|部署YashanDB的集群名（必传参数）|
||*--group-ids*|组ID|
||输出结果|1. Protection Mode：yasom记录的主库保护模式。
1. Members：表示节点信息。包括节点状态，节点角色，备库传输延迟，回放延迟和回放速率等。
1. Properties：当前生效的参数值。
1. Automatic Failover：仲裁选举状态。
    1. DISABLED：选举关闭。
    1. Enabled in Potential Data Loss Mode：选举开启，并且切换可能丢失数据。
    1. Enabled in Zero Data Loss Mode：选举开启，并且不会丢失数据。
    1. Enabled in Zero Data Loss Mode (NOT ALLOWED)：选举开启，但不是最大保护模式，可能有数据丢失风险，禁止自动切换。
|
|yasboot election config set,设置仲裁选举相关的参数    
    
    
|*-c, --cluster*|部署YashanDB的集群名（必传参数）|
||*--group-ids*|组ID|
||*-k, --key*|设置参数的名称（必传参数）|
||*-v, -value*|设置参数key对应的值（必传参数）|
||参数名称以及范围|**FailoverThreshold**   默认值: 9 范围：[2, 1000] 含义：备机心跳超时时间，到达该时间后，yasom将执行failover切换流程。    
  **FailoverAutoReinstate**   默认值: false 范围：true/false 含义：是否启用自动脑裂修复。启用后，如果备机发生脑裂，处于NEED REPAIR状态，yasom将尝试自动修复。    
  **ZeroDataLossMode**   默认值: true 范围：true/false 含义：是否启用零丢失模式。启用后，将设置主备为最大保护模式，当主库宕机时，备库可自动failover；当备库异常时，主库将由yasom降级为最大可用模式，并禁止自动failover，直到备库恢复同步后，yasom重新将主库升级为最大保护模式后，使能自动failover。|
|yasboot election config unset,重置仲裁选举相关的参数为默认值|*-c, --cluster*|部署YashanDB的集群名（必传参数）|
||*--group-ids*|组ID（必传参数）|
||*-k, --key*|设置参数的名称（必传参数）|
|yasboot election event show,查看仲裁选举相关的事件，包括事件名，发生时间，处理时间，处理是否成功等,  
    
    
|*-c, --cluster*|部署YashanDB的集群名（必传参数）|
||*--group-ids*|组ID|
||输出结果|**事件名称及含义：**,**failover**          备库无法连接主库，并且心跳超时后，向yasom上报，通知yasom将进行仲裁选举    
  **confirm role**   主库重启的时候，需要确认自己的角色，向yasom上报，通知yasom确认该节点的实际角色。如果旧主库需要降备，将直接启动为备库    
  **need repair**    备库状态为NEED REPAIR，可能是非零丢失模式下，产生脑裂现象，旧主库降备后无法继续接收日志数据，需要通知yasom修复该备库    
  **protection demote**   零丢失模式下，当备库异常，导致主库事务阻塞时，主库向yasom上报，通知yasom将主库的保护模式降级为最大可用模式，并禁止自动切换    
  **protection promote**   零丢失模式下，当备库恢复同步后，主库向yasom上报，通知yasom将主库的保护模式升级为最大保护模式，并恢复自动切换|
||备注|1. 同一种事件最多保存5条，超出将淘汰老的事件。
1. 在1分钟内，下发SQL处理失败3次后，将不再处理failover和need repair事件，后续的相同事件会被忽略，并在最近一次事件记录里增加Ignore字段的值。
|


  


## 2.2 应用场景

- 分布式在最少节点部署下能支持DN高可用。


## 2.3 规格约束

- 分布式组内yasom仲裁选举与自选举互斥，需要增加配置拦截。
- 主节点与外部网络隔离，备机升主，可能出现双主现象。
- 从OM下发的组内扩缩容，与仲裁选举要互斥，即在开启仲裁选举模式时，不可组内扩缩容。
- OM下发的failover需要拦截。
- 主节点为ABNORMAL状态，不会自动切换。
- 拦截MN，CN组配置仲裁能力。


# 3. 详细测试设计

## 3.1 测试设计方法

|测试项|测试方法|
|---|---|
|yasboot参数|采用边界值，等价类测试方法进行覆盖验证|
|DB进程，yasom，yasagent进程故障|采用正交测试方法进行验证|


|**零丢失模式**||||||
|:---:|---|---|---|---|---|
|**HOST1**|||**HOST2**||**预期结果**|
|**yasom**|**DN1主节点状态**|**yasagent1状态**|**DN2备节点状态**|**yasagent2状态**||
|正常|故障|正常|正常|正常|DN2升主并切换为最大可用模式|
|正常|正常|故障|正常|正常|DN节点不影响，业务正常|
|正常|正常|正常|故障|正常|DN1切换为最大可用模式|
|正常|正常|正常|正常|故障|DN节点不影响，业务正常|
|正常|故障|故障|正常|正常|DN2升主并切换为最大可用模式|
|正常|正常|正常|故障|故障|DN1切换为最大可用模式|
|正常|故障|正常|正常|故障|DN2不会升主，DML业务阻塞|
|正常|正常|故障|故障|正常|DN1保护模式不变，业务阻塞|
|正常|故障|正常|正常|故障|DN2不会升主，DML业务阻塞|
|正常|正常|故障|正常|故障|DN节点不影响，业务正常|
|正常|故障|正常|故障|正常|业务全部阻塞|
|正常|正常|故障|故障|故障|DN1保护模式不变，业务阻塞|
|正常|故障|故障|正常|故障|DN2不会升主，DML业务阻塞|
|故障|正常|正常|正常|正常|仲裁功能失效，业务不影响|
|故障|故障|故障|正常|正常|DN2不会升主，不能提供DML业务|
|故障|正常|正常|故障|故障|DN1保护模式不变，业务阻塞|


## 3.2 详细测试设计

详细测试场景如下xmind。

[分布式DN组一主一备支持OM仲裁.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWJhMWFkOWEzMzExZGM4NDM1IiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.0tkm4vFot7cqfntHpae9XCRKXr7sLepDRKyeSO8j5lU)

# 4. 测试用例

冒烟用例：

全量文本用例：

# 5. 测试框架设计

采用现有分布式HA测试框架。

# 6. 测试环境说明

需要三台虚拟机(系统不限)以及chaosblade故障注入工具。

# 7. 工作量评估

工作量：2人/周

计划测试完成时间：

  


## Attachments:

[分布式DN组一主一备支持自动选举.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWI4OTcwYzJhZjRmNTIwNWJmIiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.H0_5aUKajziHYz6dVCJp3VdndzFqVaR7EDoqqfzbgZg)

 (application/x-xmind)    


[分布式DN组一主一备支持OM仲裁.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWM4OTcwYzJhZjRmNTIwNWMwIiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.RIIoXCMy7zA0whR0y_CxEVbmUmZWt-r3PvJziSgIN_w)

 (application/x-xmind)    


[DN组一主一备支持OM仲裁冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWM4OTcwYzJhZjRmNTIwNWMxIiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.kZv0kEwDe1Nz_LsiDlkhYIQ1N4O74N6Y6BJeeICvE34)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式DN组一主一备支持OM仲裁.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWM4OTcwYzJhZjRmNTIwNWMyIiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.5V7SFJqfYQ617EVJsrIfOG7I39UjHeYNq5iv-4cNNWs)

 (application/x-xmind)    


[DN组一主一备支持OM仲裁文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWNhMWFkOWEzMzExZGM4NDM2IiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.uXTTc3p7VQ-sISMWEBfEsgU0X-Cy8PS5PYP_Vz853wQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式DN组一主一备支持OM仲裁.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWJhMWFkOWEzMzExZGM4NDM1IiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.0tkm4vFot7cqfntHpae9XCRKXr7sLepDRKyeSO8j5lU)

 (application/x-xmind)    


[DN组一主一备支持OM仲裁冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWM4OTcwYzJhZjRmNTIwNWMzIiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.S2SHfGHIWxryt9adbvYDUUr54KBYHXIeu0xEuGWneqQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[DN组一主一备支持OM仲裁文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWNhMWFkOWEzMzExZGM4NDM3IiwicmVmX2lkIjoiNjczOTZiOWI1OTNmOTljOWZmMjM2NGNjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NzU2LCJleHAiOjE3ODIzODIxNTZ9.3CwxI5-1ofrNbM_OV9W4Rw7NyUEjW5_8ssCWHdwp-H0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,参与人：何金阳，马志宏，刘顺鹏，许中立，施新华,测试设计评审纪要：,1. 原有的yasboot election 相关命令增加 --group_ids      [刘顺鹏](https://conf.yasdb.com/display/~liushunpeng)      
  2. 分布式上yasboot election enable on/off 可以默认开启或关闭满足条件DN组仲裁功能      [刘顺鹏](https://conf.yasdb.com/display/~liushunpeng)      
  3. yasboot election show config不指定group id可以展示所有节点组信息     [刘顺鹏](https://conf.yasdb.com/display/~liushunpeng)      
  4. 零丢失模式下，拦截修改保护模式(OM下发和直连) @许中立    
  5. 仲裁开启后，是否拦截OM_ELECTION_ENABLE参数修改    
  6. DN组扩容需要确认是否拷贝OM_ELECTION_ENABLE参数？需要确认 @许中立    
  7. 开启OM仲裁后，升级和卸载会报错，资料中需要体现,Posted by shixinhua at 十二月 22, 2023 14:56|
|---|
