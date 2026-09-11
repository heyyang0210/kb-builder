Created by 梁荣钦, last modified on 五月 10, 2024

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af6d](https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af6d)    *? #YASHAN-29 集群版本故障处理优化 （RTO目标）*

  


##   [1. 总述](#1-总述)  

  [集群DB在线恢复](https://conf.yasdb.com/pages/viewpage.action?pageId=119552238)    ：

>   集群形态部署下，每个DB实例均为对等状态，承载部分全局资源，所有DB实例共享数据库，通过共享缓存模块完成业务的并发控制。如果部分DB实例异常关闭，导致整个DB集群处于不一致状态，包括数据库物理页面的不一致，共享缓存状态的不一致。YCS检测到部分DB异常关闭时，通过更新其他DB实例的拓扑状态，使得MASTER DB感知到其他DB实例的异常，MASTER DB实例需要触发故障的在线恢复，修正前述的不一致问题，让整个DB集群处于正常提供全量服务的状态。  

本次的需求是着重于优化YASDB集群下，从部分可用到完全可用的RTO时间。

###   [1.2 数据字典](#12-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|RTO时间|指灾难发生后，从系统宕机导致业务停顿之刻开始，到系统恢复至可以支持各部门运作，业务恢复运营之时，此两点之间的时间段。|是|  [百度百科](https://baike.baidu.com/item/RTO/8933405)  |


###   [1.3 集群DB在线恢复经历的阶段](#13-集群db在线恢复经历的阶段)  

- 为了尽可能使得系统更快可用，YASDB会优先处理那些对系统运行最为关键的数据，使得系统部分可用，因此分为了两个阶段，部分可用阶段以及完全可用阶段。


1. 系统不可用到部分可用阶段：
    1. 通过TOPO触发在线恢复，选主，冻结实例
    1. 锁定GRC资源，重分布；重建GRC资源
    1. 故障实例日志预分析，对涉及到的block上锁，逻辑redo以及涉及的spaceid上锁Extent；
    1. 解冻实例
1. 系统部分可用到完全可用阶段：
    1. 对故障实例日志进行回放；
    1. 恢复故障实例事务；
    1. 在线恢复表空间，回放逻辑日志；
    1. current block刷盘，等待所有block刷盘，推点；


- 经过    [RTO测试](https://conf.yasdb.com/pages/viewpage.action?pageId=150608558)    ，发现有几个时间较长的，可优化的点：
    - 恢复故障实例事务：恢复故障实例事务依赖日志回放刷盘后的block，而日志后台刷盘有可能时间较长，因此托管实例事务加载时间会比较长。
    - current block刷盘：当前currentblock代码由于是串行刷盘，如遇到强冲突场景，产生大量current block时，可改为后台线程刷盘，可减少前台在线恢复RTO时间；


##   [2. 接口](#2-接口)  

|接口|接口字段|接口说明|
|---|---|---|
|动态视图V$INSTANCE_RECOVERY|PART_AVAILABLE_TIME|该字段为共享缓存的恢复时间，且只在集群生效。|
|动态视图V$INSTANCE_RECOVERY|FULLY_AVAILABLE_TIME|该字段为实例恢复完全可用的时间，且只在集群生效。|
|动态视图GV$INSTANCE_RECOVERY|动态视图V$INSTANCE_RECOVERY相同，并多加一个实例ID|该视图只在集群生效，但可以在集群所有实例通用。|


##   [3. 规格与约束](#3-规格与约束)  

1. current block 刷盘线程数最大为64，根据日志预分析上锁的block来确定需要多少个线程数量，不支持主动调整线程数量。
1. rcy buffer writer摘链批量化每次摘链个数为64，不支持主动调整。
1. 视图V$INSTANCE_RECOVERY只能在master实例查询获得，单机以及集群非MASTER查询该视图为空。


##   [4. 特性](#4-特性)  

-   [在线恢复总体流程](https://conf.yasdb.com/pages/viewpage.action?pageId=119552238)    如链接所示，当前设计文档不展开，只对比优化前后的点；
- 新增结构体


```
// RcyCleanWorker 这个结构体用于current block并行刷盘承载Worker；
typedef struct StRcyCleanWorker {
    AnkHandler*      handler;
    CodThread        thread;
    CodUint8         id;
    volatile CodBool workCompleted;
    volatile CodBool interrupted;
    volatile CodBool running;
} RcyCleanWorker;

typedef struct StRcyBufferPool {
    SpinLock  lock;
    CodUint32 chunkCnt;

    RcyBufferChunk chunks[BP_MAX_CHUNK_CNT];
    BufferBucket*  buckets;

    RcyBufferLock   rbla[ANK_MAX_RCY_PARALLERLISM];
    RcyBufferWriter rbwa[AXC_RCY_BPWR_COUNT];
    RcyCleanWorker  rcw[RCY_BP_CLEAN_WORKERS]; // 新增，current block刷盘Worker存放数组

    CodUint32 bucketCnt;
    CodUint32 blockTotalCnt;
    CodUint32 blockUsedHwm;
    CodUint32 blockIdHwm;
    RcyBufferCtrl* dtyHead;
    RcyBufferCtrl* dtyTail;

    RcyBufferCtrl* dtyHighPriorityHead; // 新增，恢复故障实例事务专用脏页链，高优先级队列
    RcyBufferCtrl* dtyHighPriorityTail; // 新增，恢复故障实例事务专用脏页链，高优先级队列

    volatile CodUint32 dtyCnt;
    volatile CodUint32 bpCtrlCnt;
    CodUint32  blkCntThreshold;
    CodUint16  rbwCnt;
    CodUint8  rcwCnt;                   // 新增，记录current block刷盘Worker个数

    volatile CodBool replayFinish;
    volatile CodUint64 currentCnt;
} RcyBufferPool;

```

###   [4.1 恢复故障实例事务优化](#41-恢复故障实例事务优化)  

- 优化点：
-     1. 针对快速恢复托管事务的高优先级队列；
    1. 针对ctrl刷盘每次只有一个，改为批量摘链刷盘；

- 优化后流程：
-     1. 对故障实例日志进行回放，如果回放的是block 类型是BLOCK_UNDO_SEGMENT或者BLOCK_XACT，添加到高优先级队列，而其他block添加到普通队列；
    1. 在刷盘线程中，若当前线程id为前N个，则优先对高优先级队列进行刷盘，在对普通队列进行刷盘；
    1. 刷盘线程在摘链时，上锁，取前M个，不足M则把剩下全取走，放锁，对ctrl解析并刷盘；



![](https://pingcode.yasdb.com/atlas/files/public/67396ea4a1ad9a3311dc9867/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBZ0FBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFRQUFBQWdBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MTgsImV4cCI6MTc4MjQ0OTQxOH0.kZKn29hhSfjAVcV4MXe-SVIAOf4ATw3rswJz6jE6LhY)

###   [4.2 current block刷盘优化](#42-current-block刷盘优化)  

- 优化点：将串行改成优先使用并行，特殊情况下可换成串行；
- 优化后流程：将current block 刷盘线程放到物理日志回放后执行；
-     1. 通过rcyBp->chunks内block个数来确定最大Worker个数有多少。
    1. 通过最大Worker个数来尽最大努力创建刷盘线程数rcwCnt；
    1. 若rcwCnt为零，则无法创建子线程，需要通过当前线程串行刷盘；（完）
    1. 若rcwCnt不为零，则后台执行刷盘；
    1. 在执行完事务托管、逻辑日志回放、表空间恢复后，等待所有block刷盘完毕；
    1. 推点；



![](https://pingcode.yasdb.com/atlas/files/public/67396ea4a1ad9a3311dc9868/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBZ0FBQUFBQUFBQUFCQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFRQUFBQWdBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MTgsImV4cCI6MTc4MjQ0OTQxOH0.kZKn29hhSfjAVcV4MXe-SVIAOf4ATw3rswJz6jE6LhY)

###   [4.3 特性可维可测设计](#43-特性可维可测设计)  

- 在原有视图    [V$INSTANCE_RECOVERY](https://conf.yasdb.com/pages/viewpage.action?pageId=141573666)    上添加一列“ESTD_CLUSTER_AVAILABLE_TIME”可知当前从灾难发生到系统部分可用的时间，结合原有视图的BEGIN_TIME与END_TIME，可以算出
-     1. 从灾难发生到系统部分可用的时间
    1. 从灾难发生到系统完全可用的时间
    1. 系统部分可用到系统完全可用的时间

- ESTD_CLUSTER_AVAILABLE_TIME：此字段代表最近一次故障恢复部分可用的时间，精度为微秒
    - IN_RECOVERY为true。ESTD_CLUSTER_AVAILABLE_TIME= NULL则代表当前集群处于故障恢复，但故障恢复尚未部分可用
    - IN_RECOVERY为false。ESTD_CLUSTER_AVAILABLE_TIME= NULL则代表之前没有以当前实例作为master进行过故障恢复；ESTD_CLUSTER_AVAILABLE_TIME!= NULL则代表最近一次以当前实例作为master进行故障恢复部分可用的时间。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 设置自动拉起数据库，执行TPCC业务隔离场景，在中等压力下，10分钟 kill db 非MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置自动拉起数据库，执行TPCC业务隔离场景，在中等压力下，10分钟 kill db MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置自动拉起数据库，执行TPCC业务不隔离场景，在中等压力下，10分钟 kill db MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置自动拉起数据库，执行TPCC业务不隔离场景，在中等压力下，10分钟 kill db 非MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置不自动拉起数据库，执行TPCC业务隔离场景，在中等压力下，10分钟 kill db 非MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置不自动拉起数据库，执行TPCC业务隔离场景，在中等压力下，10分钟 kill db MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置不自动拉起数据库，执行TPCC业务不隔离场景，在中等压力下，10分钟 kill db MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置不自动拉起数据库，执行TPCC业务不隔离场景，在中等压力下，10分钟 kill db 非MASTER后，查询V$INSTANCE_RECOVERY视图，对比优化前后的时间。
1. 设置自动拉起数据库，执行TPCC业务隔离场景，在中等压力下，每10分钟 随机kill一个db，测试平均时间是否下滑以及在线恢复是否稳定。


##   [6.资料设计章节](#6资料设计章节)  

1. V$INSTANCE_RECOVERY视图资料补充;


##   [7.未来规划](#7未来规划)  

- 未来可支持在线程池内，自动调整current block线程数量，达到在不妨碍脏页刷盘的优先级下，current block不阻塞最终刷盘，比较优RTO时间。


## Attachments:

[image2024-5-9_15-5-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTQ4OTcwYzJhZjRmNTIxOWYzIiwicmVmX2lkIjoiNjczOTZlYTQ1OTNmOTljOWZmMjM4NzBhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjE4LCJleHAiOjE3ODI1MjUwMTh9._6b_tNwC0dInUPa-WyGrvY_c0VEl1pkA4DxzZAUwhkw)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：,1、刷盘线程数，以及摘链批量化参数均为自适应，用户无感知；,2、视图新增部分可用时间改为共享缓存的恢复时间；,3、视图V$INSTANCE_RECOVERY只算单次故障；,4、current block多个并行刷盘线程必然比单线程快；,5、视图新增完全可用时间，这个时间点在所有刷盘线程完成时；,Posted by liangrongqin at 五月 10, 2024 10:53|
|---|
|  [](null)  ,新增GV视图GV$INSTANCE_RECOVERY,Posted by liangrongqin at 五月 10, 2024 10:58|
|  [](null)  ,注：默认调整刷脏页线程数量等于刷盘线程参数 DBWR_COUNT,另有一个参数可以独立调整刷脏页线程数量：_RCY_BPWR_COUNT,Posted by liangrongqin at 五月 11, 2024 09:59|
