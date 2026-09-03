Created by 施新华, last modified on 七月 25, 2024

# 1. 概述

 自选举(Raft)模式下，根据客户需要设置每个节点的选举优先级，优先级高的节点在满足条件下优先当选leader。在打开自动切住开关后，若是优先级高节点非主，会自动切换升主。

# 2. 需求分析

  [https://pingcode.yasdb.com/pjm/items/6611a91a579a3edb84d862b6](https://pingcode.yasdb.com/pjm/items/6611a91a579a3edb84d862b6)    ?    
  #YDBRD-25909 Raft自选举支持按优先级选主

参考：    [raft优先级详细设计方案](153005356.html)  

## 2.1 功能点分析

### 2.1.1 基于优先级配置选主

**设计重点**  ：增加参数  HA_ELECTION_PRIORITY(修改立即生效)配置每个节点的优先级，在选举过程中，HA_ELECTION_PRIORITY作为其中一个判断条件，优先级越高，优先当选Leader。

**原则**  ：

选举算法，保证数据一致性的前提下，选优先级最高的节点为主节点。

1. 优先级变更通过选举层广播，不断推送至组内所有节点，直到所有节点更改成功。选举层广播不保证瞬时一致性，保证最终一致性。
1. 节点只可以主动更改自己的优先级。
1. 优先级信息变更同步，通过广播主动推广，日常心跳维护，投票选举的信息交互进行确保最终数据一致性。
1. 优先级为0节点不发起选举，可投票。


**节点启动流程变化**  ：

1. election初始化时，从配置文件加载节点自身优先级（HA_ELECTION_PRIORITY），每个member成员新增priority属性，其中priority初始化为65535。
1. 加载完成后，进行组内广播，将自身的优先级同步至组内节点，同时获取组内节点的优先级。
1. election初始化完成，据情况决定是否发起选举。


**优先级修改广播流程**  ：

节点修改自身优先级后：首先刷新配置文件，然后刷新选举层，更新选举层记录的自身的节点优先级，选举层触发组内广播，将自身的优先级信息同步至组内节点，流程如下：

![](https://conf.yasdb.com/download/attachments/153005356/%E4%BC%98%E5%85%88%E7%BA%A7%E6%B6%88%E6%81%AF%E5%B9%BF%E6%92%AD%E6%B5%81%E7%A8%8B%E5%9B%BE.svg?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTAyMTIsImV4cCI6MTc4MjMyMTAxMn0.IuccZJYyeALD404XpcpR1ZdAIjVaT0ibm0H-Tc3TOK8)

1. NODE1节点收到优先级变更命令；
1. 选举层获得所有组内节点信息；
1. 向所有节点发送一次广播信息；
1. 组内其它节点收到广播，修改NODE1节点的优先级并返回ack，携带本节点记录NODE1节点的优先级以及本地节点的优先级；
1. NODE1节点收到ack，通过对比ack信息的优先级，确保对端节点修改的优先级与本地节点记录的是一致的。
    1. 如果ack的优先级与自身记录的不一致，把对端加入广播队列重新广播，每隔2s广播一次。
1. NODE1根据ack信息，更新对端节点的优先级。


**选举与优先级结合流程**  ：

      顺序：term > 日志 > 优先级

1. 发起选举的节点A检测自身优先级是否0，如果为0则不发起选举。
1. 节点A创建异步任务：向所有节点发送投票请求；节点A记录有其它节点信息。
1. 其余节点收到投票请求，进行校验：
    1. 校验任期。
    1. 校验自己的心跳时间是否超时。
    1. 校验自己是否为leader。
    1. 校验节点A与自己的数据日志新旧，校验节点A与自己的优先级大小，得出下面四种情况：
        1. 节点A的数据日志比自身高，但优先级低，投赞成票。
        1. 节点A的数据日志和自身一样，节点A优先级大于等于自身，投赞成票。
        1. 节点A的数据日志和自身一样，优先级低，投反对票。
        1. 节点A的数据日志比自身低，优先级高，投反对票。
1. 节点A收到投票回应，如果respond来自高优先级，未知优先级节点，是反对票，不处理，等待选举超时时间，按多数派规则判断是否升主；是赞成票，将该节点从节点列表中删除。面对反对票有以下俩种场景：
    1. 如果高优先级节点正常，高优先级会在此过程中发起选举，成功当选主节点，然后发送心跳压制，其他节点退出选举。
    1. 如果这个过程中高优先级节点异常，在一轮选举结束后，会成功选出新节点。
1. 节点A查看是否满足升主条件，如果满足以下俩种情况，则升主，不满足则等待或退出：
    1. 票数满足多数派，且节点列表是空的，即高优先级，优先级信息不明确的节点都已回应。
    1. 票数满足多数派，且选举时间超时。


异常：

       选举过程中优先级变更，不会影响数据一致性，因此在优先级变更与选举的并发场景下，可能结果：

1. 选出的节点，在满足数据一致的前提下，并非是优先级最高的节点。
1. 选举到超时时间，仍未选出主节点，需进行多一轮选举。


### 2.1.2 自动回切

新增ha_election_auto_primary_switch 配置参数，支持自动将主节点切换至优先级高的节点上，目前不支持多种策略配置，发现优先级高节点就会回切。

回切流程：

1）leader每次更新节点优先级，间隔心跳周期时，检查策略(目前只有优先级)，决定是否自动回切。

2）检测自己是否为优先级最高的节点，如果不是，则找到对应的优先级最高的节点，记录该节点并计数。该计数达到一定次数(HA_ELECTION_TIMEOUT/HA_ELECTION_INTERVAL)时，对应节点下发switchover指令。避免优先级变更瞬时不一致带来的反复切主。

3）如果记录的节点发生替换，测重新计数。

### 2.1.3 视图变更DV$ELECTION / V$ELECTION

本视图显示在HA架构中开启自动选主时，当前节点实时的选举状态，当自动选主关闭时本视图无数据，新增peers_info 字段。

|字段|类型|说明|
|:---|:---|:---|
|LEADER_GROUP_ID|INTEGER|主节组ID|
|LEADER_GROUP_NODE_ID|INTEGER|主节点的节点ID|
|TERM|BIGINT|当前主节点的任期|
|LFN|BIGINT|日志刷盘序号|
|LFN_TERM|BIGINT|日志刷盘的任期|
|STATE|VARCHAR(64)|当前节点的选举状态：,Startup：启动,PreCandidate：预选举,Candidate：候选者,Follower：跟随者,Leader：领导者,Shutdown：关闭,Unknown：未知|
|LAST_HEARTBEAT_TIME|TIMESTAMP|当前节点最后一次收到心跳的时间|
|PEERS|VARCHAR(768)|当前节点的节点组成员|
|EXTEND_INFO|JSON|对端节点的节点信息，现有：节点优先级，例子：{Node1：{GROUP_ID:1, GROUP_NODE_ID:1, ELECTION_PRIORITY:100}, Node2:{GROUP_ID:1, GROUP_NODE_ID:2, ELECTION_PRIORITY:100}....}|


## 2.2 应用场景

1）HA部署下，希望指定节点优先为主节点；

2）HA部署下，当优先级高节点故障恢复后，可以自动回切升主。

## 2.3 规格约束

1. 支持单机，分布式MN,DN节点组。
1. HA_ELECTION_PRIORITY 类型为int32，取值范围为[0, 100]，数字越大，优先级越高；默认值为1，0表示禁止该节点发起选举。


# 3. 详细测试设计

## 3.1 测试设计方法

参数配置采用边界值、等价类测试；其它采用场景法验证。

## 3.2 详细测试设计

### 3.2.1 配置参数测试

|参数名称|测试项|测试详细描述|
|---|---|---|
|HA_ELECTION_PRIORITY|参数内容|有效等价类：1, 10，99,边界值：0,100,无效等价类：-1,101,10000000000000,通过v$election视图查询|
||生效方式|scope=[memory, both, spfile],立即生效|
|ha_election_auto_primary_switch|参数内容|有效值：true  ，false,其它：test111 |
||生效方式|scope=[memory, both, spfile],立即生效|
|_ha_election_auto_primary_switch_interval|参数内容|隐藏参数，范围[1,3600],自动切主检测时间(s)|
||生效方式|scope=[memory, both, spfile],立即生效|


  


### 3.2.2 基于优先级选举测试和回切测试场景

|部署形态|测试场景|场景描述|预期|备注|
|---|---|---|---|---|
|单机    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|部署    
    
|1主2备，覆盖默认优先级配置以及优先级不同|选举正常，v$election显示与配置一致|默认配置|
|||1主4备，覆盖默认优先级配置以及优先级不同|选举正常，v$election显示与配置一致|默认采用此部署规格|
|||1主32备，覆盖默认优先级配置以及优先级不同|选举正常，v$election显示与配置一致|默认配置|
||优先级配置不同    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|重启集群|选举正常，优先级高节点升主|不一定，需要看日志|
|||主节点故障|选举正常，优先级高备节点升主|记录RTO时间|
|||优先级高备故障，然后故障主节点|选举正常，次优先级高备节点升主|记录RTO时间|
|||主节点故障，选举过程修改节点优先级|选举正常，优先级高节点可能升主|记录RTO时间|
|||主节点故障，优先级高节点升主过程改小优先级|升主正常|记录RTO时间|
|||部分备节点故障，其它节点修改优先级；拉起故障节点观察记录优先级是否正确|节点记录优先级与配置一致|查询一致|
|||部分节点与其它节点网络不通，分别修改优先级；然后网络恢复|恢复后经过1s节点记录本地和其他节点优先级正确|  
|
|||主节点与备网络不通超过1分钟，然后恢复|备发起选举，重新选出主；,网络恢复，原主降备(term低)|原主降备正常|
|||选取低优先级节点执行switchover|手动切换成功|正常|
|||优先级高备故障，拉起备后主节点立即故障|优先级高节点可能无法当选leader，日志不一定最新|日志优先|
|||优先级高备节点need repair， 主节点故障|该节点不会升主|未升主|
|||优先级高备节点abnormal，主节点故障|该节点不会升主|还是会升主|
|||优先级高备节点mismatch，主节点故障|该节点不会升主|  
|
|||优先级高备节点所在磁盘满，主节点故障|节点状态异常，该节点不会升主|磁盘满不能投票|
|||优先级高备节点dbfile内容(redo, ctrl, system, user, swap,temp,undo)异常，主节点故障|该节点可能升主失败|还是可能会升主|
|||优先级高节点nomount/mount状态，主故障|该节点不会升主|不会升主|
||优先级配置为0    
    
    
    
    
    
    
|修改主节点优先级为0，重启cluster|原主不会当选leader|pass|
|||修改某个备节点优先级为0，主节点故障|优先级为0节点不会当选leader|只能投票|
|||修改某个备节点优先级为0，然后执行switchover|切换正常|正常|
|||修改所有备节点优先级为0，主非0，主节点故障；,恢复故障节点|1.无法选出主,2. 原主恢复仍然为主|pass|
|||修改所有节点优先级为0，主节点故障；拉起故障节点|无主选出|无主|
|||修改所有节点优先级为0，重启cluster|无主选出|无主|
|||修改所有节点优先级为0，执行switchover|切换正常|正常|
|||选举过程，修改所有节点优先级为0|可能无法选出主|pass|
||优先级配置相同    
    
|部分节点优先级相同(例如: 90,90,90,30,30)， 主故障|优先级90节点当选leader|pass|
|||全部节点优先级相同(1,1,1,1,1),全部节点优先级相同(100,100,100,100,100),重启cluster,主节点故障|1. 重启后选举正常；
1. 主节点故障，备选主正常
|pass|
|||所有节点相同，执行switchover|切换正常|pass|
||全部节点配置自动回切    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|修改某个备优先级最高|切换正常|pass|
|||修改部多个备优先级最高|某个优先级高备执行切换|pass|
|||主节点优先级最高|不会发生切换|pass|
|||切换过程修改某个备优先级最高|此次切换过程继续|pass|
|||重启cluster|优先级最高节点最终为主|重启后主是日志最新的，最终是优先级最高节点为主|
|||优先级高节点与主网络不通|切换失败|不会切换|
|||优先级配置相同|不会自动切换|不会切换|
|||优先级最高节点故障|次高优先级节点执行切换|pass|
|||部分备优先级相同且最高，部分节点故障|正常优先级高切换|pass|
|||选取优先级低备执行switchover|手动切换成功，但是会出现回切|pass|
|||优先级高节点need repair|不会切换升主|不会切换升主|
|||优先级高节点mismatch|不会切换升主|  
|
|||优先级高节点abnormal|不会切换升主|数据文件异常abnormal，升主失败，原主保持住节点|
|||优先级高节点nomount/mount|不会切换升主|pass|
|||优先级高节点在发起选举|不会切换升主|  
|
|||优先级高节点在降备|不会切换升主|不会切换升主|
|||主节点磁盘满造成ABNORMAL，修改备机优先级高|不会切换升主|优先级高备机不会升主|
|||高优先级节点与主GAP较大，超过10|到达检测时间不会切换|可能经过多轮检测才能切换|
||部分节点配置自动回切    
    
    
    
    
|组内只有主节点打开回切开关，主优先最高|不会切换|pass|
|||组内只有主节点打开回切开关，备优先级最高|备切换|切换|
|||组内只有主节点打开回切开关，多个备优先级最高|其中一个备切换升主，不会出现连续切换|pass|
|||组内只有主节点打开回切开关，最高优先级节点与主网络不通|次优先高节点升主|pass|
|||组内只有主节点打开回切开关，发现优先级高节点后修改其它备优先更高|最高优先级节点最终为主|pass|
|||组内只有备节点打开回切开关|不会触发回切|不会切换|
||扩容|扩容备节点|优先级和回切开关复制主节点,无主扩容，复制备节点配置|按照默认配置扩容未复制|
||资料|资料中对于优先级和回切使用说明|需要说明使用风险|  
|
||升级|从低版本升级到当前版本|升级后选举正常|  
|
|分布式|优先级配置    
    
    
    
    
    
    
    
    
    
|DN组内各个节点设置优先级不同，重启DN组|dv$election查看视图|存在bug，dv视图无新增字段|
|||DN组内各个节点设置优先级不同，主节点故障|优先级高节点升主|pass|
|||DN组内各个节点设置优先级不同，主备网络不通|出现脑裂，网络恢复原主降备|pass|
|||DN组内各个节点设置优先级相同，重启DN组|dv$election查看视图|pass|
|||DN组内各个节点设置优先级相同，主DN故障|选举正常|pass|
|||MN组内各个节点设置优先级不同，重启MN组|dv$election查看视图|视图显示不全|
|||MN组内各个节点设置优先级不同，主节点故障|优先级高节点升主|pass|
|||MN组内各个节点设置优先级不同，主备网络不通|出现脑裂，网络恢复原主降备|pass|
|||MN组内各个节点设置优先级相同，重启MN组|选举正常|pass|
|||MN组内各个节点设置优先级相同，主MN故障|选举正常|pass|
|||MN组内各个节点设置优先级相同|dv$election查看视图|pass|
||回切    
    
    
|打开回切，DN组内节点优先级不同|优先级高节点升主|  
|
|||打开回切，DN组内节点优先级相同|主不变|  
|
|||打开回切，MN组内节点优先级不同|优先级高节点升主|  
|
|||打开回切，MN组内节点优先级相同|主不变|  
|
||DN组扩容|扩容DN组|扩容DN组内节点优先级是默认1，回切关闭|  
|
|||缩容DN组|缩容正常|  
|


  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|是|


  


# 4. 测试用例

# 5. 测试框架设计

已有HA测试框架。

# 6. 测试环境说明

虚拟机>=2台。

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Attachments:

[raft选举支持优先级.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOWVhMWFkOWEzMzExZGM5Mjk5IiwicmVmX2lkIjoiNjczOTZkOWU3MjgyMDZlZmI5MmYyMTJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwMjEyLCJleHAiOjE3ODIzOTY2MTJ9.69Cfw-pcbQVpvthu27ejhFNogMZqMmEL-0lOdUysjMc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,参与人：何金阳，陈步隆，许中立，李晶，施新华    
  1）刷新设计文档到最新 --许中立    
  2）扩容参数是否拷贝新增配置确认 --许中立    
  3）刷新部分用例预期； --施新华    
  4）回切开关打开，主节点发起校验判断是否回切 --施新华,Posted by shixinhua at 六月 21, 2024 16:14|
|---|
