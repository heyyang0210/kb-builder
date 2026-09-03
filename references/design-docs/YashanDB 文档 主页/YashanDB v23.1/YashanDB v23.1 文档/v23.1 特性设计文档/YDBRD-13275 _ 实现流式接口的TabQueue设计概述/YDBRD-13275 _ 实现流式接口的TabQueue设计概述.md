Created by 罗继鸿, last modified on 七月 14, 2023

IR链接：    [YDBRD-11522](https://jira.yasdb.com/browse/YDBRD-11522?src=confmacro)    -  分布式数据通道（TabQueue）性能优化  完成  / SR链接：    [YDBRD-13275](https://jira.yasdb.com/browse/YDBRD-13275?src=confmacro)    -  实现流式接口的TabQueue  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

1. 提供自动协商发送和接收模块内存消耗的逻辑通道
1. 提供能指导实施团队现场调参的动态视图
1. 支撑TabQueue性能提升


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

实现一个可靠的跨节点字节流传输，能自动协商发送窗口，发送缓存，接收缓存大小，减少初始化的内存占用，提升数据通道性能，增加观测手段，实现流式发送接口，提升接口易用性。

  
  (1) Channel基础协议实现

实现拥塞控制，内存自动扩展，双工

参考文档：    [Channel：可靠的跨节点字节流传输](/pages/createpage.action?spaceKey=YAS&title=Channel%EF%BC%9A%E5%8F%AF%E9%9D%A0%E7%9A%84%E8%B7%A8%E8%8A%82%E7%82%B9%E5%AD%97%E8%8A%82%E6%B5%81%E4%BC%A0%E8%BE%93)  

  


(2) 性能视图

指导客户现场实施团队评估网络性能，获取点到点的TabQueue性能基线，指导参数配置

参考文档：    [Channel性能视图 channel_perf](https://conf.yasdb.com/pages/viewpage.action?pageId=119551243)  

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

本轮未新增参数，沿用原有PQ_POOL_SIZE，TAB_QUEUE_WINDOW_SIZE两个配置参数

新增channel性能视图

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

TabQueue是分布式计划的各个Stage之间通信的基础组件，抽象一对多，多对一，多对多的发送能力，提供Random，Hash，Merge，Partition的数据分发能力，其主要规格是功能规格

Channel是支撑TabQueue进行数据发送的底层基础设施，其主要规格为性能规格

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

参考文档：    [Channel：可靠的跨节点字节流传输](/pages/createpage.action?spaceKey=YAS&title=Channel%EF%BC%9A%E5%8F%AF%E9%9D%A0%E7%9A%84%E8%B7%A8%E8%8A%82%E7%82%B9%E5%AD%97%E8%8A%82%E6%B5%81%E4%BC%A0%E8%BE%93)  

参考文档：    [Channel性能视图 channel_perf](https://conf.yasdb.com/pages/viewpage.action?pageId=119551243)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

  


Channel公用物理连接

  


![](https://pingcode.yasdb.com/atlas/files/public/67396ae38970c2af4f51ffcb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk3NDQsImV4cCI6MTc4MjMwMDU0NH0.-WB-ggJz85Mof6kO8X_hv9ZUhUVCy9w_TCROPUDm4w0)

  


Channel的基础设施

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

  


参考文档：    [Channel：可靠的跨节点字节流传输](/pages/createpage.action?spaceKey=YAS&title=Channel%EF%BC%9A%E5%8F%AF%E9%9D%A0%E7%9A%84%E8%B7%A8%E8%8A%82%E7%82%B9%E5%AD%97%E8%8A%82%E6%B5%81%E4%BC%A0%E8%BE%93)  

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

新的Channel实现不改变TabQueue的对外接口，不影响兼容性

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

参考文档：    [Channel性能视图 channel_perf](https://conf.yasdb.com/pages/viewpage.action?pageId=119551243)  

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-%E5%85%B6%E4%BB%96)  

参考tpcc，导入工具的性能看护模块，TabQueue的也需要一个端到端性能看护

看护点：不同数据类型，不同数据量，不同窗口大小

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

测试需覆盖，一对多，多对多，多对一场景，覆盖不同报文大小，覆盖发送端不同速率，接收端不同速率场景，网络拥堵场景

端到端需关注不同数据类型，不同投影大小，不同数据量

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*trace记录Channel的详细信息*

*节点级Channel历史统计信息*

*内存消耗视图*

## Comments:

|  [](null)  ,1. 相同PQ_POOL_SIZE配置下，支持的SQL并发能力提升50%
,Posted by luojihong at 七月 14, 2023 15:46|
|---|
