Created by 冯浩楠, last modified on 六月 06, 2024

  [https://pingcode.yasdb.com/pjm/items/66169303fd997db58ad70aef](https://pingcode.yasdb.com/pjm/items/66169303fd997db58ad70aef)    ?    
  #YDBRD-26067 【分布式】支持分布式行存CLOB/JSON

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#1-%E6%80%BB%E8%BF%B0)  

分布式放开行表功能后，支持行lob的基本功能。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#2-%E6%8E%A5%E5%8F%A3)  

无新增接口

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

不支持outline lob跨节点参与计算。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#4-%E7%89%B9%E6%80%A7)  

### 4.1 现状分析

#### 现状分析

1. LOB跨节点传输：已经支持，方案概述：行外LOB各个节点传输locator，真正使用数据（当前只涉及插入、查询）的时候，通过locator上的endpoint去指定节点上读。
    1. lob读使用ics，计划改成channel
    1. 当前实现方案：    [分布式支持大Lob写入、查询设计文档](112725825.html)  
1.  tempLob缓存机制：
    1. 单机：分为两类，一类缓存在handler上，一类缓存在stmt上，缓存在stmt上的有两类执行结束后会释放，不会释放的会cache到handler上，会释放的场景：
        1. tempLobLocator不会发送给客户端的
        1. 计算过程中子worker上产生的tempLob
    1. 分布式：分布式下在一个节点上产生的tempLob需要被其它节点读，所以全部缓存在了handler上，通过cacheid访问，同时stmt上维护一个cacheID list，释放机制：
        1. 对于需要释放的tempLob，执行结束时释放stmt→tempLobCacheIdList
        1. 执行结束后不能释放的，将cacheID从stmt→tempLobCacheIdList中移除。
1. 单机实现机制：行外lob将数据缓存在((TabQueueBlockHead*)head)->vmCacheList上，通过vmid直接读数据


#### 当前问题

当前问题分析：当前支持lob的跨节点传输，对于行lob计算过程中产生的lob的传输方案需要讨论。

1. 子线程中tempLob跨节点传输的方案。
1. 当前所有的cacheID缓存在主handler上还是子线程上也缓存。
1. 并行线程种tempLob存储方案


结论：基于当前现状，无法满足outline lob跨节点参与计算。

### 4.2 支持范围

除不支持outline lob跨节点参与计算外，其余和单机保持一致，范围包含：

|支持项|说明|
|---|---|
|基本SQL语法|1. 建表支持lob类型，支持指定行内以及行外存储。disable/enable storage in row
1. insert
1. update
1. select
|
|LOB API|  [分布式支持LOB更新删除以及API：详细设计](119542667.html)  |
|JSON处理函数|JSON，JSON_ARRAY_GET，JSON_ARRAY_LENGTH，JSON_EXISTS，JSON_FORMAT，JSON_PARSE，JSON_QUERY，JSON_SERIALIZE，......|
|高级包|23.3暂不支持|


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- 基本SQL语法
- LOB API
- JSON处理函数
