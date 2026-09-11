Created by 许中立 on 六月 07, 2024

2024/6/24 raft优先级设计评审会议纪要：    
  1. 旧主从选举时的高优先级列表排除，经过心跳超时时间确认，旧主处于故障状态。    
  2. HA_ENABLE_AUTO_PRIORITY_SWITCH 改成 HA_AUTO_PRIMARY_SWITCH    
  3. 广播消息体优化，做成通用消息，兼容后续可能存在的新消息。增加msgId字段。    
  4. 补充优先级投票表格    
  5. 投票时受到未知优先级节点的消息，将其优先级更新并按判断优先级和投票结果，进行处理。    
  6. peers_info 格式更改为{node_group_id:1，node_id:1，priority:1}    
  7. 自动回切场景梳理，循环广播实现梳理，找对应SE讨论