Created by 陆世杰, last modified on 一月 12, 2024

#   [YDBRD-21702 : ](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)    集群pastcopy清理优化设计文档

SR链接：    [[YDBRD-20571] 集群内核可靠性增强 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-20571)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#1-overview%E6%A6%82%E8%BF%B0)  

本次集群pastcopy（以下简称PC）清理优化包括：

pc清理优化就是在生产者和消息者场景的问题处理，避免在消费者因阻塞时造成集群整体异常。

1. PC消息发送优化(ack消息合并，xowner到request；gcsGrantCleanBlockAck)
1. dbwr在发送前在缓存里去重。
1. PC清理时锁冲突争用优化(batch类消息attach不要重试
1. PC清理消息缓存使用独立内存区域
1. PC发送的消息链路使用专用的链路。


###   [1.1 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [集群pastcopy清理优化调研文档 - 陆世杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133574357)  

###   [1.2 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

### **1.3 需求**

|功能 |涉及表现说明|备注|
|---|---|---|
|消息批量发送|检视涉及PC清理的消息，全部改用批量|代码已合入|
|PC重复消息过滤|消息发送时对发送的blockId去重，保留lsn最大的|现有机制引发问题的分析|
|x锁冲突处理|前台业务锁与后台PC清理锁冲突|在gcsOwnerFlush时加锁调整|
|pc清理消息缓存|pc清理消息缓存使用独立的内存，以免影响集群其他的消息发送|一次分配出全部内存|


## **2.接口**

涉及的接口如下：

        alter system checkpoint;

dbwrPerform(AnkHandler* handler, DbwrManager* dbwrm, DbwrMode mode);

视图：

v$checkpoint

v$grc_pastcopy

v$grc_resource

V$CLUSTER_MESSAGE_POOL

## **3**    [. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

共享集群，2节点以上。

## **4**    [. 详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

集群PC请求相关的消息：

|消息|消息处理函数|实际消息最大值|消息处理|消息场景|
|---|---|---|---|---|
|MSG_REQ_MASTER_CLEAN_BLOCK|msgReqMasterCleanBlock|28+8+8000=8036|AXC_BATCH_TASK|xowner 发送给 master; 正向向消息，xOwner已刷盘；向master发出scn|
|MSG_ASK_OWNER_CLEAN_BLOCK|msgAskOwnerCleanBlock|28+8+8000=8036|AXC_BATCH_TASK|master 发送给 pc; 正向向消息, pc直接从dequeue；此时应该带有scn而且scn要大于pi的scn|
|MSG_OWNER_CLEAN_BLOCK_ACK|msgOwnerCleanBlockAck |28+8+8000=8036|AXC_BATCH_TASK|pc 发送给 master; 正向向消息, grc上清理pc的相关信息|
|MSG_REQ_MASTER_FLUSH_BLOCK|msgReqMasterFlushBlock|28+8+8000=8036|AXC_BATCH_TASK|pc发送给 master; 反向消息, pc请求反向清理到master|
|MSG_ASK_OWNER_FLUSH_BLOCK|msgAskOwnerFlushBlock|28+8+8000=8036|AXC_BATCH_TASK|master 发送给 xowner; 反向消息,master发给xowner刷盘强求,xowner完成flush后再次走到正向清理的流程|
|MSG_GRANT_CLEAN_BLOCK_ACK|msgGrantCleanBlockAck|28+8+8000=8036|AXC_BATCH_TASK|gcsOwnerFlushBlock触发|
|MSG_GRANT_CLEAN_NO_OWNER_PC_ACK|msgGrantCleanNoOwnerPCAck|28+8+8000=8036|AXC_BATCH_TASK|授权无owner的block处理|


### 4    [.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#51-architecture%E6%9E%B6%E6%9E%84)    锁优化

pc刷盘的时候会申请两次锁，  gcsOwnerFlushBlock和prepare。

优化gcsOwnerFlushBlock的锁申请不考虑重试，失败就返回。

### 4    [.2 PC内存池](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#51-architecture%E6%9E%B6%E6%9E%84)  

使用单独的内存池来存储PC消息。

PC消息池大小的考虑，为兼容消息池设计，考虑PC消息池缓存数据量4GB大小的PC页，每个页面需要消息24bytes(  CleanBlock  )，

按照每256个block使用8k的内存计算，在不考虑重复消息的前提下4GB的PC页面需要16MB大小的消息池。需再在  axcCreateMsgArea时额外在申请16M的内存。

在现有的5个msgPool的基础上添加一个  AxcMsgPool，新创建的内存独立使用。

### 4    [.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#51-architecture%E6%9E%B6%E6%9E%84)    消息发送链路

使用ics的专用链路，在等待PC时不影响其它的链路。

若PC消息池耗尽，则将PC请求的消息直接丢弃消息（现有的模式为等待5秒）。

### 4    [.4 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#53-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

## 5    [. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|类别|场景|预期|备注|
|:---|:---|:---|:---|
|功能|4节点数据库正常启停|数据库正常|开启增量检查点|
|功能|2节点，实例0做构造100万以上的脏页，实例1做checkpoint|数据库正常，checkpoint成功完成|关闭增量检查点|
|功能|4节点，所有实例构造100万以上的脏页，所有实例同时做checkpoint|数据库正常，checkpoint成功完成|关闭增量检查点|
|性能|4节点，工程用例，所有实例业务并发DML和并做全量checkpoint|PC消息丢失，集群整体运行正常；checkpoint正常完成|开启增量检查点|
|性能|2节点，所有实例构造100万以上的脏页，实例1挂起dbwr，PC消息池耗尽，实例0做全量checkpoint；|PC消息丢失，集群整体运行正常；checkpoint等待PC flush|关闭增量检查点|
|  
|  
|  
|  
|


** **

##   [6. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=130148040#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2024-1-11_17-6-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYTBhMWFkOWEzMzExZGM4YmNlIiwicmVmX2lkIjoiNjczOTZjYTA3MjgyMDZlZmI5MmYxNGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxOTU3LCJleHAiOjE3ODIzODgzNTd9.MOouYYm1oPD5-y9VHXLRHG6pJ0VetIKzfPbWSLmufm8)

 (image/png)    


## Comments:

|  [](null)  ,1：统计一批最大256个PC反向清理所需时间,2：,Posted by lushijie at 一月 12, 2024 18:16|
|---|
|  [](null)  ,1.优化点的评估,2.计算一批256个PC反向清理所需时间,Posted by lushijie at 一月 12, 2024 18:26|
