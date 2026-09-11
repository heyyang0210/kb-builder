Created by 许中立, last modified on 六月 04, 2024

##   [1. 总述](#1-总述)  

实现支持单机，分布式形态的自选举优先级的能力，根据优先级值的设定，在异常场景下，使得预期节点成为主节点。根据需求可自由变更节点优先级。

###   [1.1 需求来源](#11-需求来源)  

分布式国金认证

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=153004045](https://conf.yasdb.com/pages/viewpage.action?pageId=153004045)  

|数据库名称|优先级功能表现|自动切主功能表现|优点|缺点|
|---|---|---|---|---|
|oceanBase|选举时所有副本都会在同一时刻广播自己优先级，根据优先级选出高优先级节点。优先级有多重因素影响，数据库内部自动变更，无需用户介入|enable_auto_leader_switch控制自动切主开关|多重因素影响，机器环境，内存使用等|自动切主只有开关选择|
|NuRaft|同一 Raft 组中的所有节点都将知道所有成员的优先级。priority_0 每个节点都有一个内部本地值目标优先级，该优先级最初设置为 。max(priority of all nodes)。目标优先级的最小值应为 。priority_priority_ < target_prioritytarget_priority = target_priority * 0.81|不涉及|选举由区间，防止多个节点同时发起选举，节点可根据目标值来决定是否发起选举|异常场景下，选出新主的时间延长，可能延长好几轮选举|
|gaussDB|设置副本优先级，主节点故障时，权重越小的备节点切换为主节点的优先级越高。slave_priority_weight|不涉及|||


###   [1.3 需求分析](#13-需求分析)  

在异常场景下，让预期节点成为主节点，让非预期节点不参与选举，避免成为主节点。自选举在满足数据一致的前提下，按节点优先级进行升主。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|触发选举时，优先级高的节点优先升主|投票时,根据对比优先级的结果，决定投赞成票or反对票|是|是|
|功能|HA_ELECTION_PRIORITY 参数配置节点优先级|配置节点的优先级，通过数据库内部同步到组内各个节点上|是|是|
|功能|HA_ENABLE_AUTO_PRIORITY_SWITCH 参数开关控制自动切主策略，优先级高的节点按策略自动升主|将优先级高的节点升为主节点，并且根据策略组合，决定自动切换的方式与时机|是|是|
|性能|优先级高的节点故障场景下，成功选出主节点的时间延长至投票超时时间|在投票超时时比候选节点优先级高的节点没有响应，并且候选节点获得了多数票，则候选节点当选为主节点。|是|是|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|配置参数|HA_ELECTION_PRIORITY|该节点的选举优先级，支持选举时，根据节点优先级进行投票，选出优先级最高的节点为主节点。|是|
|配置参数|HA_ENABLE_AUTO_PRIORITY_SWITCH|控制自动将优先级高的节点升主的开关，默认为关|是|
|SQL语法|alter system set HA_ELECTION_PRIORITY = [0,100]|修改本地节点记录的指定节点的优先级，数据库将修改同步至组内所有节点。分布式下支持在CN指定DN组，DN节点修改|是|
|SQL语法|yasboot node config set -c cluster_name -k key -v value -n node_id|OM支持修改相关的自选举优先级配置项|是|
|动态视图|(v/dv)$election|新增 peers_info字段，观测节点记录的组内priotity，数据格式采用json便于后续可拓展，兼容性。|是|


##   [3. 规格与约束](#3-规格与约束)  

1. 支持分布式MN,DN，支持单机。
1. HA_ELECTION_PRIORITY  类型为int32，取值范围为[0, 100]，数字越大，优先级越高。默认值为1，0表示禁止该节点发起选举。


##   [4. 特性](#4-特性)  

###   [设计原则](#设计原则)  

1. 选举算法，保证数据一致性的前提下，选优先级最高的节点为主节点。
1. 优先级变更通过选举层广播，不断推送至组内所有节点，直到所有节点更改成功。选举层广播不保证瞬时一致性，保证最终一致性。
1. 节点只可以主动更改自己的优先级。
1. 优先级信息变更同步，通过广播主动推广，日常心跳维护，投票选举的信息交互进行确保最终数据一致性。


###   [4.1 优先级管理](#41-优先级管理)  

1. 节点新增配置参数HA_ELECTION_PRIORITY，目前该参数只在MN，DN，单机上生效。
1. HA_ELECTION_PRIORITY 可通过以下三种方式进行修改：
    1. 单机，分布式下，直连数据库执行alter system set HA_ELECTION_PRIORITY = [0,100], both=。适用于单机，分布式。
    1. 单机，分布式下，通过yasboot命令进行修改，yasboot node config set -c cluster_name -k key -v value -n node_id。适用于单机，分布式。
    1. 分布式下，直连正常状态的CN，执行alter system set HA_ELECTION_PRIORITY = [0,100]，type=dn/node=node_id; 修改指定组/节点的节点优先级。


####   [初始化流程](#初始化流程)  

1. election初始化时，从配置文件加载节点自身优先级（HA_ELECTION_PRIORITY），每个member成员新增priority属性。priority初始化为65535，u16的最大值，代表无效值。
1. 加载完成后，进行组内广播，将自身的优先级同步至组内节点，同时获取组内节点的优先级。广播流程详情看4.2
1. election初始化完成，据情况决定是否发起选举。


####   [优先级变更流程](#优先级变更流程)  

1. 节点本地优先级变更，刷新配置文件。
1. 刷新选举层，更新选举层记录的自身的节点优先级。
1. 选举层触发组内广播，将自身的优先级信息同步至组内节点。


####   [优先级广播](#优先级广播)  

#####   [广播模块概要图](#广播模块概要图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396dba8970c2af4f5214d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBSUJBQUFBQUFBQUFCQUNBQUFnQ0FBQWdBQUFCQUFJUUFBQUJBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQ0FBQUFBUUFBQUFBQUFnQUFRQUFJQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExNDEsImV4cCI6MTc4MjMyMTk0MX0.8HXR1IbSfBjn8jmGeJ-1Ce1XaovncpUYpYb82ZEh2VM)

#####   [广播流程图](#广播流程图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396dbaa1ad9a3311dc934e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBSUJBQUFBQUFBQUFCQUNBQUFnQ0FBQWdBQUFCQUFJUUFBQUJBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQ0FBQUFBUUFBQUFBQUFnQUFRQUFJQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExNDEsImV4cCI6MTc4MjMyMTk0MX0.8HXR1IbSfBjn8jmGeJ-1Ce1XaovncpUYpYb82ZEh2VM)

1. A节点收到优先级变更命令
1. 选举层获得所有组内节点信息。记录在self结构体中，记录需要发送的节点有哪些。
1. 向所有节点发送一次广播信息。（不可阻塞等待，影响正常心跳发送）
1. B节点收到广播，修改对应的节点的优先级
1. B节点返回ack，携带B节点记录A节点的优先级，携带B节点自身的优先级。
1. A节点收到ACK，通过对比ack信息的优先级，确保B节点修改的优先级与A节点记录的是一致的。
    1. 如果ack的优先级与自身记录的不一致，B节点存在广播队列中则跳过，不存在，则将B节点信息放到广播队列中。每隔2秒广播一次。
1. 根据ack信息，更新B节点的优先级。


```
// 优先级消息结构
// 请求和回应都用该结构体

pub struct PriorityMsg&lt;T: ElectionType&gt; {
    pub target_node_id: T::NodeId,
    pub source_node_id: T::NodeId,
    pub target_priority: u16,
    pub source_priority: u16,
}

```

####   [异常情况](#异常情况)  

1. 优先级广播时，发起广播节点的故障，无法与其他节点通信。此时其他节点不知道该节点优先级变更。 ———— 广播定时重试，直到广播成功。此时选举可能选出的节点并不是优先级最高的节点，或选举时间延迟至一轮选举超时。


###   [4.2 优先级与选举算法](#42-优先级与选举算法)  

####   [优先级与选举流程结合](#优先级与选举流程结合)  

![](https://pingcode.yasdb.com/atlas/files/public/67396dba8970c2af4f5214da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBSUJBQUFBQUFBQUFCQUNBQUFnQ0FBQWdBQUFCQUFJUUFBQUJBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQ0FBQUFBUUFBQUFBQUFnQUFRQUFJQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExNDEsImV4cCI6MTc4MjMyMTk0MX0.8HXR1IbSfBjn8jmGeJ-1Ce1XaovncpUYpYb82ZEh2VM)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396dbaa1ad9a3311dc934f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBSUJBQUFBQUFBQUFCQUNBQUFnQ0FBQWdBQUFCQUFJUUFBQUJBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQ0FBQUFBUUFBQUFBQUFnQUFRQUFJQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExNDEsImV4cCI6MTc4MjMyMTk0MX0.8HXR1IbSfBjn8jmGeJ-1Ce1XaovncpUYpYb82ZEh2VM)

|本地优先级\本地数据新旧|新|等于|旧|
|---|---|---|---|
|高|投反对票|投反对票|投赞成票|
|等于|投反对票|投赞成票|投赞成票|
|小于|投反对票|投赞成票|投赞成票|


选举流程：

1. 发起选举的节点A检测自身优先级是否0，如果为0则不发起选举。
1. 节点A创建异步任务：向所有节点发送投票请求。
1. 节点A拿到高优先级，优先级信息不明确的节点列表1
1. 其余节点收到投票请求，进行校验：
    1. 校验任期。
    1. 校验自己的心跳时间是否超时。
    1. 校验自己是否为leader。
    1. 校验节点A与自己的数据日志新旧，校验节点A与自己的优先级大小，得出下面四种情况：
        1. 节点A的数据日志比自身高，但优先级低，投赞成票。
        1. 节点A的数据日志和自身一样，节点A优先级大于等于自身，投赞成票。
        1. 节点A的数据日志和自身一样，优先级低，投反对票。
        1. 节点A的数据日志比自身低，优先级高，投反对票。
1. 节点A收到投票回应，如果respond来自高优先级，未知优先级节点，是反对票，不处理，等待选举超时时间，按多数派规则判断是否升主。是赞成票，将该节点从节点列表1中删除。面对反对票有以下俩种场景：
    1. 如果高优先级节点正常，高优先级会在此过程中发起选举，成功当选主节点。发送心跳压制，其他节点退出选举。
    1. 如果这个过程中高优先级节点异常，在一轮选举结束后，会成功选出新节点。
1. 节点A查看是否满足升主条件，如果满足以下俩种情况，则升主，不满足则等待或退出：
    1. 票数满足多数派，且节点列表1是空的，即高优先级，优先级信息不明确的节点都已回应。
    1. 票数满足多数派，且选举时间超时。


####   [心跳通信协议变更](#心跳通信协议变更)  

1. 心跳请求与心跳回应附带节点优先级信息，收到消息的节点，自动更新节点优先级。


```
// 心跳请求
pub struct HeartbeatRequest&lt;T: ElectionType&gt; {
    pub target_node_id: T::NodeId,
    pub leader_id: T::NodeId,
    pub term: u64,
    pub priority: u16,
}

// 心跳回应
pub struct HeartbeatResponse&lt;T: ElectionType&gt; {
    pub target_node_id: T::NodeId,
    pub resp_node_id: T::NodeId,
    pub term: u64,
    pub priority: u16,
}

```

####   [选举投票通信协议变更](#选举投票通信协议变更)  

```
// 投票请求
pub struct VoteRequest&lt;T: ElectionType&gt; {
    pub target_node_id: T::NodeId,
    pub candidate_id: T::NodeId,
    pub vote_id: u64,
    pub term: u64,
    pub factor: T::VoteFactor,
    pub pre_vote: bool,
    pub move_leader: bool,
    pub priority: u16,
}

// 投票回应
pub struct VoteResponse&lt;T: ElectionType&gt; {
    pub node_id: T::NodeId,
    pub candidate_id: T::NodeId,
    pub vote_id: u64,
    pub term: u64,
    pub pre_vote: bool,
    pub vote_result: VoteResult,
    pub priority: u16,
}

```

####   [选举算法异常情况](#选举算法异常情况)  

![](https://pingcode.yasdb.com/atlas/files/public/67396dba8970c2af4f5214db/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBSUJBQUFBQUFBQUFCQUNBQUFnQ0FBQWdBQUFCQUFJUUFBQUJBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQ0FBQUFBUUFBQUFBQUFnQUFRQUFJQUFBQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExNDEsImV4cCI6MTc4MjMyMTk0MX0.8HXR1IbSfBjn8jmGeJ-1Ce1XaovncpUYpYb82ZEh2VM)

1. 选举过程中携带的优先级信息，便于节点间同步更新优先级变更。
1. 选举过程中优先级变更，不会影响数据一致性，因此在优先级变更与选举的并发场景下，最坏的结果有俩种：
    1. 选出的节点，在满足数据一致的前提下，并非是优先级最高的节点。
    1. 选举到超时时间，仍未选出主节点，需进行多一轮选举。


###   [4.3 自动回切](#43-自动回切)  

节点新增HA_ENABLE_AUTO_PRIORITY_SWITCH配置参数，支持自动将主节点切换至优先级高的节点上。用户可配置不同策略模式，亦可将多个策略模式组合使用，灵活适配不同场景，当前的策略模式有：    
  1. swtichover升主的节点不会重新自动切主。    
  2. failover升主后，一段时间不会触发自动切主。    
  3. 用户可指定自动切主的时间段（业务闲暇时）。    
  4，没有业务时，才可自动切换。    
  默认策略为1。

####   [自动切主流程](#自动切主流程)  

1. leader每次更新节点优先级，间隔心跳周期时，检查策略，根据策略类型，决定是否自动回切。
1. 检测自己是否为优先级最高的节点，如果不是，则找到对应的优先级最高的节点，记录该节点并计数。该计数达到一定次数(HA_ELECTION_TIMEOUT/HA_ELECTION_INTERVAL)时，对对应节点下发switchover指令。避免优先级变更瞬时不一致带来的反复切主。
1. 如果记录的节点发生替换，测重新计数。


```
// switchover指令
pub struct trySwitchover&lt;T: ElectionType&gt; {
    pub node_id: T::NodeId,
    pub term: u64,
    pub priority: u16,

```

####   [异常场景](#异常场景)  

1. 修改节点B的优先级，使其成为优先级最高的节点，但主节点A与节点B网络故障。无法通过主节点的switchover进行切换 ---- 节点B心跳超时后，发起选举，由于其他节点网络并无问题，因此选举不会成功。（讨论如何处理）


###   [4.5 特性可维可测设计](#45-特性可维可测设计)  

####   [dv/v$election 视图](#dvvelection-视图)  

本视图显示在HA架构中开启自动选主时，当前节点实时的选举状态，当自动选主关闭时本视图无数据。新增peers_info 字段

|字段|类型|说明|
|---|---|---|
|LEADER_GROUP_ID|INTEGER|主节组ID|
|LEADER_GROUP_NODE_ID|INTEGER|主节点的节点ID|
|TERM|BIGINT|当前主节点的任期|
|LFN|BIGINT|日志刷盘序号|
|LFN_TERM|BIGINT|日志刷盘的任期|
|STATE|VARCHAR(64)|当前节点的选举状态<br>*   Startup：启动<br>*   PreCandidate：预选举<br>*   Candidate：候选者<br>*   Follower：跟随者<br>*   Leader：领导者<br>*   Shutdown：关闭<br>*   Unknown：未知|
|LAST_HEARTBEAT_TIME|TIMESTAMP|当前节点最后一次收到心跳的时间|
|PEERS|VARCHAR(768)|当前节点的节点组成员|
|PERRS_INFO|JSON|对端节点的节点信息，现有：节点优先级，例子：{node_id:1-1, priority:30},{node_id:1-2, priority:50}|


###   [4.6 特性周边配合](#46-特性周边配合)  

1. om适配yasboot node config set -c cluster_name -k key -v value -n node_id 修改优先级相关参数。


##   [工作量](#工作量)  

|功能|人力|
|---|---|
|选举算法流程适配优先级|4天/人|
|优先级广播能力|4天/人|
|自动回切|3天/人|


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

自测用例设计方法：

1. 部署5副本，将节点优先级设置成0，打开HA，kill主节点。测试节点优先级为0时，是否会发起选举。
1. 部署5副本，将节点A设为优先级最高，kill掉主节点B，测试正常情况下，优先级最高节点是否会当选主节点。
1. 部署5副本，关闭自动回切，将节点A优先级设为最高，节点B优先级第二高，kill掉主节点，节点A。测试是否节点B是否等待一个选举时间后，成为主节点。
1. 部署5副本，开启自动回切，选出主节点B后，将节点A优先级设为最高。待节点A通过自动回切成为主节点后，kill掉节点A，拉起节点B。等待选出新主，将节点A回复。测试自动回切能力。
1. 部署5副本，开启自动回切，进行switchover，查看是否会报错。
1. 部署5副本，修改节点优先级。查看所有节点信息。测试是否广播到所有节点。
1. 部署5副本，kill节点A，修改节点B优先级，等待优先级同步后，拉起节点A。测试节点A恢复后，是否能同步节点B优先级的更改。


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

1. HA整体考虑，大部分参数是需要保证组内一致性的，比如HA_ELECTION_ENABLED，HA_ELECTION_LEADER_LEASE_ENABLED，是否这些参数需要通过广播保证一致性，减少客户操作难度。
1. HA_ENABLE_AUTO_PRIORITY_SWITCH 是否需要像节点优先级一样，通过数据库保证组内一致性。
1. 主备同步时，优先同步优先级高的节点。


## Attachments:

 (application/octet-stream)    


[优先级模块概要设计图.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjk4OTcwYzJhZjRmNTIxNGQyIiwicmVmX2lkIjoiNjczOTZkYjk3MjgyMDZlZmI5MmYyMjkxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTQxLCJleHAiOjE3ODIzOTc1NDF9.RZEpKJZ1ZycfEqnUn2VeFsU8SuCe2G-ER4y98jHiKhM)

 (image/svg+xml)    


[优先级模块概要设计图.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjk4OTcwYzJhZjRmNTIxNGQzIiwicmVmX2lkIjoiNjczOTZkYjk3MjgyMDZlZmI5MmYyMjkxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTQxLCJleHAiOjE3ODIzOTc1NDF9.lrKVRnFzqJugqMQPovdC5udx1hsRHioSrzbLyTBGxOY)

 (image/svg+xml)    


[image2024-5-29_18-14-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjlhMWFkOWEzMzExZGM5MzRhIiwicmVmX2lkIjoiNjczOTZkYjk3MjgyMDZlZmI5MmYyMjkxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTQxLCJleHAiOjE3ODIzOTc1NDF9.zuWFbTKHLcVRdMJgsTZpbme9v9DXqcid1QgTEeRbVgI)

 (image/png)    


[优先级选举算法.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjlhMWFkOWEzMzExZGM5MzRjIiwicmVmX2lkIjoiNjczOTZkYjk3MjgyMDZlZmI5MmYyMjkxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTQxLCJleHAiOjE3ODIzOTc1NDF9.S5U0fSrXndOgCZ6NGLje2uBSmm1TVuFGwjUegwqR8HY)

 (image/svg+xml)    


[优先级选举算法.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmFhMWFkOWEzMzExZGM5MzRkIiwicmVmX2lkIjoiNjczOTZkYjk3MjgyMDZlZmI5MmYyMjkxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTQxLCJleHAiOjE3ODIzOTc1NDF9.vjEIZjFR5OTE-61sgvdU3jb-r0Hvn085sArCmi35jtg)

 (image/svg+xml)    
