Created by 郭泽霖 on 六月 12, 2023

px需要formulize的部分主要分以下几块：

## 一，统计信息的修正

1. 统计信息不能是logiOp所有，需要每个physOp都维护自己的，用于不同optCtx上的路径的代价估算。derive跟computeCost顺序交换。
1. 通过单节点统计信息推导所有节点统计信息，广播时必要。
1. 如何区分hash 分区跟完全random分区？hash分区下的group 跟 join结果怎么修正？data skew怎么表征？


## 二，网络接口抽象

1. 网络相关参数获取与初始化，测量
1. tcp以及线程切换的代价公式化


## 三，px算子抽象

1. sendType : random , hash , broadcast
1. recvType : fifo , sort 
1. tqType : 1→1 , 1→n , n→1 , n→ n
