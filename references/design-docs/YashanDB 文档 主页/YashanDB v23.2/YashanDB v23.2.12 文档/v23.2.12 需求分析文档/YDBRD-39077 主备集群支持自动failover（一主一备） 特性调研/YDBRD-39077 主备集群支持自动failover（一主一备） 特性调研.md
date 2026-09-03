SR：  [https://pingcode.yasdb.com/pjm/items/67d7934e7ce85d5a0759eaae?](https://pingcode.yasdb.com/pjm/items/67d7934e7ce85d5a0759eaae?)  

#YDBRD-39077 主备集群支持自动failover（主集群实例全部宕机一主一备）

## 友商方案

友商方案已经体现在之前单机一主一备的调研文档了

  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67397555593f99c9ff23bc41](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67397555593f99c9ff23bc41)  



### 工作量预估

1. 架构上，基于现有的单机一主一备OM框架实现，命令保持一致
1. 主集群检测适配：需要等所有主实例宕机 （0.5人周）
1. 备集群failover适配：failover只能在master实例执行，并且failover结束后open其他实例（0.5人周）
1. group和cluster的代码差异处理：单机下，主和备都是node级别的，集群下，主和备是group级别的（0.5人周）
1. 设计文档，资料，自测（1人周）


总共2.5人周





