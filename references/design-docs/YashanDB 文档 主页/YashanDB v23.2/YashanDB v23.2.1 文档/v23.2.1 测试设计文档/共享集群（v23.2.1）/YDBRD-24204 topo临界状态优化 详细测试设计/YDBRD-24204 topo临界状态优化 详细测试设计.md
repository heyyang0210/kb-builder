Created by 张丽红, last modified on 二月 23, 2024

SR链接：    [YDBRD-24204](https://jira.yasdb.com/browse/YDBRD-24204?src=confmacro)    -  topo临界状态优化  完成

开发设计文档链接：

YFS多节点故障开发设计：    [YFS 多节点故障](https://conf.yasdb.com/pages/viewpage.action?pageId=141566058)  

YFS多节点故障测试设计：    [YFS 支持多节点故障测试设计](/pages/createpage.action?spaceKey=~zhanglihong&title=YFS+%E6%94%AF%E6%8C%81%E5%A4%9A%E8%8A%82%E7%82%B9%E6%95%85%E9%9A%9C%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)    （测试场景基本可以全覆盖）

# 1. 概述

该需求为问题单转需求，属于比较个性化的YCS级别的优化

# 2. 需求分析

## 2.1 功能点分析

- 该需求真正实现是在"YFS支持多节点故障"中进行实现的，并未涉及YCS层面的开发，涉及需求为"    [YDBRD-21567](https://jira.yasdb.com/browse/YDBRD-21567?src=confmacro)    -  YFS支持多节点故障  完成  "
- 该需求主要针对特定场景下的问题进行优化，比较有针对性，详细应用场景参考2.2


## 2.2 应用场景

**场景一：在备机需要build较长时间的前提下，备机build的过程中主停止/故障**

**场景解析：**    
  1. 主节点同意了备节点去build    
  2. 备节点在build过程中，主的yfs要stop    
  3. 然后YFS 主节点应该在等备节点的所有的REP线程结束，    
  4. 备机一直在给主节点发送停止冻结业务的消息，但是主节点处理不了消息了，因为主节点是在停止过程中

涉及测试点：

|场景编号|场景描述|备注|是否需要新增用例场景|
|---|---|---|---|
|1|2实例场景下，主执行业务完成后，启动备，启动过程中，主进行正常stop|**这里涉及的业务最好是需要较长时间的，类似创建很大的datafile文件这种，可以从数据库的层面触发，也可以从yfscmd的层面触发**|需要|
|2|2实例场景下，主执行业务完成后，启动备，启动过程中，主被kill|  
|需要|
|3|3实例场景下，主执行业务完成后，多个备并发启动，启动过程中，主进行正常stop|需要在3+节点上测试|需要|
|4|3实例场景下，主执行业务完成后，多个备并发启动，启动过程中，主被kill|  
|需要|


  
  **场景二：**

**场景描述：有多主机的前提下，yfs启动过程中被kill**

**场景解析：**    
  yfs 节点开始启动，但没启动完成，topo 标记 yfs 节点为 offline。    
  yfs 在启动中被kill，topo 记录 yfs 节点还是 offline，其他节点无法感知 yfs 启动中退出事件。

**涉及测试点：**

|场景编号|场景描述|备注|是否需要新增用例场景|
|---|---|---|---|
|1|不带业务，yfs主启动的过程中被kill|等同于单点故障场景中的场景5：两实例下，不带业务，主实例start 和 kill -9 主实例并发|不需要|
|2|不带业务，yfs备启动的过程中被kill|等同于单点故障场景中的场景7：两实例下，不带业务，备实例start 和 kill -9 备实例并发|不需要|
|3|不带业务，多个yfs备同时启动的过程中其中一个被kill|该场景需要在3+以上场景下进行测试，2节点场景下不做测试|需要|
|4|不带业务，多个yfs备同时启动的过程中所有备都被kill，再重新并发启动所有yfs备|该场景需要在3+以上场景下进行测试，2节点场景下不做测试|需要|
|5|带业务前提下，1个yfs备启动的过程中被kill|等同于单点故障场景中的场景8：两实例下，带业务，备实例start 和 kill -9 备实例并发|不需要|


## 2.3 规格约束

- 不涉及


# 3. 详细测试设计

## 3.1 测试设计方法

1、该需求主要针对单点场景，主要测试方法采用的是场景法，从新的实现机制的角度去梳理

## 3.2 关联特性/依赖分析

1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|故障和启停操作并发时会涉及，在故障里一起考虑|
|KT|涉及|
|长稳|属于基础功能测试，不涉及长稳|
|一致性|不涉及db级别的一致性，不考虑|
|三方测试工具    
  (sqltest，sqlancer)|不涉及任务新增语法，不涉及该专项|
|安全|不涉及任务用户/权限/密码等操作，不涉及该专项|
|DFR|涉及，涉及到不同类型的故障|
|HA|YFS多节点故障不支持集群HA模式，不涉及该专项|
|压力|yfs层面不考虑压力场景，不涉及该专项|
|性能|不涉及任何性能层面的优化和修改，不涉及该专项|
|可维护性|不涉及日志观测以及其它不明显的观测点，不涉及该专项|
|RTO|不涉及故障检测时间和故障处理时间的修改，不涉及该专项|


## 3.3 详细测试设计

从新的实现机制来考虑，主要就是涉及到了异常，其实也就是YFS多节点的故障，这里在分析完成后重点针对新增场景进行测试，这里每种测试场景都需要考虑带业务和不带业务两种场景

|编号|场景描述|子场景|备注|是否需要做用例新增|
|---|---|---|---|---|
|1|yfs 停止时有yfs的集群间消息产生|2实例场景下，备stop的同时，备上有元数据相关业务下发|这里其实就是yfs stop和增量复制等操作同时进行，其实就是stop和其它可以触发集群间消息的操作的并发，尤其是非主的stop，主的stop都涉及到备升主，在备升主的部分进行考虑即可,这里集群间消息除了增量复制还有什么？建议都做一下覆盖，操作如下：,1 增量复制,2 topo变更（在多节点下比较容易触发，在多节点中进行测试，在2节点中不进行测试）,3 end build（在多节点下比较容易触发，在多节点中进行测试，在2节点中不进行测试）,同test_sdv_cluster_ydbrd_13472_para_diffmaster_stop_standby_003，4，库上已有用例|不需要|
|  
|  
|2实例场景下，备stop的同时，备上有集群间消息的操作相关业务下发(topo变更)|同test_sdv_cluster_ydbrd_13472_para_diffmaster_stop_standby_003，4，库上已有用例|不需要|
|  
|  
|2实例场景下，备stop的同时，备上有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|2实例场景下，备stop的同时，主上有元数据相关业务下发|同test_sdv_cluster_ydbrd_13472_para_diffmaster_stop_standby_001，2，库上已有用例|不需要|
|  
|  
|2实例场景下，备stop的同时，主上有集群间消息的操作相关业务下发(topo变更)|  
|需要|
|  
|  
|2实例场景下，备stop的同时，主上有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|2实例场景下，备stop的同时，主备上都有元数据相关业务下发|同test_sdv_cluster_ydbrd_13472_para_stop_master_003，库上已有用例|不需要|
|  
|  
|2实例场景下，备stop的同时，主备上都有集群间消息的操作相关业务下发(topo变更)|  
|需要|
|  
|  
|2实例场景下，备stop的同时，主备上都有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|  
|  
|  
|
|  
|  
|3+实例场景下，多个备同时stop的时候，多个备上有元数据相关业务下发|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，多个备上有集群间消息的操作相关业务下发(topo变更)|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，多个备上有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，主上有元数据相关业务下发|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，主上有集群间消息的操作相关业务下发(topo变更)|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，主上有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，主备上都有元数据相关业务下发|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，主备上都有集群间消息的操作相关业务下发(topo变更)|  
|需要|
|  
|  
|3+实例场景下，多个备同时stop的时候，主备上都有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|  
|  
|  
|
|  
|  
|2实例场景下，备kill的同时，主上有元数据相关业务下发|  
|需要|
|  
|  
|2实例场景下，备kill的同时，主上有集群间消息的操作相关业务下发(topo变更)|  
|需要|
|  
|  
|2实例场景下，备kill的同时，主上有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|  
|  
|  
|
|  
|  
|3+实例场景下，多个备同时kill的时候，主上有元数据相关业务下发|  
|需要|
|  
|  
|3+实例场景下，多个备同时kill的时候，主上有集群间消息的操作相关业务下发(topo变更)|  
|需要|
|  
|  
|3+实例场景下，多个备同时kill的时候，主上有集群间消息的操作相关业务下发(end build)|  
|需要|
|  
|  
|  
|  
|  
|
|2|stop的时候备升主/备升主的时候stop|2实例场景下，备升主(stop触发)的时候，stop当前备|2实例并发stop场景，等同于基本场景中场景6和场景7|不需要|
|  
|  
|2实例场景下，备升主(kill触发)的时候，stop当前备|主kill和stop操作的并发，等同于单点故障场景中场景1和场景2|不需要|
|  
|  
|  
|  
|  
|
|  
|  
|3+实例场景下，备升主(stop触发)的时候，stop当前备|3实例场景下的并发stop场景|需要|
|  
|  
|3+实例场景下，备升主(stop触发)的时候，stop其它备|  
|需要|
|  
|  
|3+实例场景下，备升主(stop触发)的时候，stop所有备|等同于4节点并发启停场景中的场景17和场景18|不需要|
|  
|  
|3+实例场景下，备升主(kill触发)的时候，stop当前备|  
|需要|
|  
|  
|3+实例场景下，备升主(kill触发)的时候，stop其它备|  
|需要|
|  
|  
|3+实例场景下，备升主(kill触发)的时候，stop所有备|  
|需要|
|  
|stop的时候冻结/冻结的时候stop|2实例场景下，备启动的过程中stop当前备|其实就是yfs启动和停止的并发|需要|
|  
|  
|2实例场景下，备启动的过程中stop主|  
|需要|
|  
|  
|2实例场景下，备启动的过程中kill当前备|同test_sdv_ydbrd_16227_fault_010，库上已有用例|不需要|
|  
|  
|2实例场景下，备启动的过程中kill主|同test_sdv_ydbrd_16227_fault_009，库上已有用例|不需要|
|  
|  
|  
|  
|  
|
|  
|  
|3+实例场景下，多个并发备启动的过程中stop其中1个备|  
|需要|
|  
|  
|3+实例场景下，备启动的过程中stop其它备|  
|需要|
|  
|  
|3+实例场景下，备启动的过程中stop主|  
|需要|
|  
|  
|3+实例场景下，多个并发备启动的过程中kill其中1个备|同单点故障场景中的场景18和场景20|不需要|
|  
|  
|3+实例场景下，备启动的过程中kill其它备|  
|需要|
|  
|  
|3+实例场景下，备启动的过程中kill主|  
|需要|
|3|网络隔离|  
|该场景直接在yfs多节点故障场景中进行测试即可，不必再在这里做重复测试|  
|
|4|备升主的时候，有客户端请求|2实例场景下，备升主(stop触发)的时候，原主收到可本地处理的客户端请求|同test_sdv_cluster_ydbrd_13472_para_diffmaster_stop_standby_001，2，库上已有用例|不需要|
|  
|  
|2实例场景下，备升主(stop触发)的时候，原主收到需master处理的客户端请求|同test_sdv_cluster_ydbrd_13472_para_diffmaster_stop_standby_001，2，库上已有用例|不需要|
|  
|  
|2实例场景下，备升主(stop触发)的时候，原备收到可本地处理的客户端请求|同test_sdv_cluster_ydbrd_13472_para_diffmaster_stop_standby_003，4，库上已有用例|不需要|
|  
|  
|2实例场景下，备升主(stop触发)的时候，原备收到需master处理的客户端请求|同test_sdv_cluster_ydbrd_13472_para_diffmaster_stop_standby_003，4，库上已有用例|不需要|
|  
|  
|2实例场景下，备升主(stop触发)的时候，原主和原备同时收到可本地处理的客户端请求|同test_sdv_cluster_ydbrd_13472_para_stop_master_003，库上已有用例|不需要|
|  
|  
|2实例场景下，备升主(stop触发)的时候，原主和原备同时收到需master处理的客户端请求|同test_sdv_cluster_ydbrd_13472_para_stop_master_003，库上已有用例|不需要|
|  
|  
|2实例场景下，备升主(kill触发)的时候，原备收到可本地处理的客户端请求|  
|需要|
|  
|  
|2实例场景下，备升主(kill触发)的时候，原备收到需master处理的客户端请求|  
|需要|
|  
|  
|  
|  
|  
|
|  
|  
|3实例场景下，备升主(stop触发)的时候，多个备同时收到可本地处理的客户端请求|同并发启停场景中的场景24|不需要|
|  
|  
|3实例场景下，备升主(stop触发)的时候，多个备收到需master处理的客户端请求|同并发启停场景中的场景24|不需要|
|  
|  
|3实例场景下，备升主(stop触发)的时候，原主和多个备同时收到可本地处理的客户端请求|  
|需要|
|  
|  
|3实例场景下，备升主(stop触发)的时候，原主和多个备同时收到需master处理的客户端请求|  
|需要|
|  
|  
|  
|  
|  
|
|  
|  
|3实例场景下，备升主(kill触发)的时候，多个备同时收到可本地处理的客户端请求|同并发启停场景中的场景23|不需要|
|  
|  
|3实例场景下，备升主(kill触发)的时候，多个备收到需master处理的客户端请求|同并发启停场景中的场景23|不需要|


  
    


# 4. 测试用例

1. 不需要单独提供冒烟用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  


# 5. 测试框架设计

- 不涉及框架新增，使用ha框架即可


# 6. 测试环境说明

- 正常使用多节点多主机环境即可


# 7. 工作量评估

工作量：6  *人天*

计划测试完成时间：xx

工作量分析：

|工作项|时间成本|备注|
|---|---|---|
|需求调研+开发串讲|0人/天|转测前完成|
|测试设计输出及细节沟通对齐|0.5人/天|转测前完成|
|测试设计评审|0.5人/天|转测前完成|
|测试用例输出|0.1人/天|转测前完成|
|测试用例自动化|1人/天|转测前完成|
|测试执行|3人/天|  
|
|问题单跟踪回归|0.1人/天|  
|
|CI工程新增和沟通对齐|0.1人/天|  
|
|需求上车|0.1人/天|  
|


# 8. 测试用例维护

- **需要新增文件夹**
- **需要新增CI工程**


|测试项|框架|目录|备注|
|---|---|---|---|
|故障测试|ha框架|testcase/fault_test/yfs_fault/node2|  
|
|  
|  
|  
|  
|


# 9. 上车分析

  


# 10. TBD

  


  


  


## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzY4OTcwYzJhZjRmNTIwNmQ1IiwicmVmX2lkIjoiNjczOTZiYzY1OTNmOTljOWZmMjM2NmUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTMyLCJleHAiOjE3ODIzODMzMzJ9.4YAejmsqdjPl87l56Htu6clFSgfXGVjCKcQAgCoXlgk)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzZhMWFkOWEzMzExZGM4NTRjIiwicmVmX2lkIjoiNjczOTZiYzY1OTNmOTljOWZmMjM2NmUzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTMyLCJleHAiOjE3ODIzODMzMzJ9.v7QHSJrp1jYN2-g1tYOrdHF_8h2s4jGWZ2sja7949qg)

 (application/msword)    
