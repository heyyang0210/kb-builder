Created by 许中立, last modified on 五月 20, 2024

#   [友商调研](#友商调研)  

|友商|能力体现|实现方案|链接|
|---|---|---|---|
|oceanBase|选举时，优先级高的副本当选主节点。通过OCP图形化界面修改Zone优先级|在选举过程中，Leader 将通过续约动作感知 Follower 副本的优先级变化，当 Follower 副本的优先级高于自己的时候，Leader 将通过主动切主动作，将 Leader 转移至 Follower 副本。|  [https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000749988](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000749988)  |
|高斯DCS|设置副本优先级，主节点故障时，权重越小的备节点切换为主节点的优先级越高。只在对应节点上修改slave_priority_weight参数，改变节点优先级||  [https://support.huaweicloud.com/api-dcs/UpdateSlavePriority.html#section1](https://support.huaweicloud.com/api-dcs/UpdateSlavePriority.html#section1)  |


#   [崖山raft优先级基础背景（暂定）](#崖山raft优先级基础背景暂定)  

1. HA节点在tender上会记录组内所有节点的优先级。
1. 发生选举，主备倒换时不允许修改优先级。


#   [单机修改节点priority方案](#单机修改节点priority方案)  

|方案编号|具体方案|优点|缺点|备注|
|---|---|---|---|---|
|方案一|实现alter arch_dest_xxx set priority=1，该sql只修改本地节点的记录的对应节点的选举优先级，需用户在该组所有节点上执行一遍。配置文件中记录优先级信息，格式大约为: ARCHIVE_DEST_xxx=192.168.1.4:1689/priority|工作量小，场景简单|用户体验差，修改优先级操作麻烦||
|方案二|实现election_priority 配置参数，记录自身的选举优先级。修改election_priority时，（HA层/tender层）广播至组内所有节点，tender记录的对应的节点优先级进行同步修改|用户使用便捷，参数保持一致能力，单机分布式共用一套能力|场景复杂，需考虑一致性，异常场景等，场景复杂|单机已支持HA层主备间通信能力|
|方案三|实现alter arch_dest_xxx set priority=1，该sql只修改本地节点的记录的对应节点的选举优先级。为便捷用户使用，OM增加对应命令，类似增删备机，OM逐个直连节点执行SQL修改节点priority|用户使用便捷，场景简单|依赖工具|OM复用单机增删备机的逻辑即可|


#   [分布式方案讨论](#分布式方案讨论)  

|方案编号|具体方案|优点|缺点|备注|
|---|---|---|---|---|
|方案一|CM新增priority动态字段，该值只能有节点自身进行修改，由alter arch_dest_xxx set priority=1 sql修改后，事件通知CM，cm在同步到其他各节点||||
|方案二|采用单机方案二，分布式无额外工作量|单机分布式共用一套能力|单机场景复杂||


## Comments:

|  [](null)  ,2024/5/21 优先级方案讨论：    
  1. 确认优先级发生的异常场景，是否需要选举，主备倒换时不允许修改优先级的约束。    
  2. 优先级高的节点自动升主能力是否需要做，可以做个开关参数吗，由用户控制。    
  3. 采用方案二    
  4. 高优先级节点故障情况下，选举时间会拉长。    
  5. v$election 新增 peers_state（暂定） json字段，观测priotity，json便于后续可拓展，兼容性。,Posted by xuzhongli at 五月 21, 2024 11:49|
|---|
