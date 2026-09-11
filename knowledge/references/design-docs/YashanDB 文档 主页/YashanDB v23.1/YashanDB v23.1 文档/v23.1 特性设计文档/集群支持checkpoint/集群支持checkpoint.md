Created by 李道一, last modified by  Vivian Liu on 五月 10, 2023

#   [YDBRD-13429: 支持实例checkpoint](#ydbrd-13429-支持实例checkpoint)  

  [[YDBRD-13429] 支持实例checkpoint - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13429)  

##   [1. Overview（概述）](#1-overview概述)  

集群的checkpoint和单机类似，但是需要处理旧版本脏页，即Past Copy清理的问题；

block在集群各个实例之间通过内部高速网络流转，假设实例A，B，C，有block P，对应的master是A，那么，一个典型的past copy产生场景如下

![](https://git.yasdb.com/lidaoyi/pictures/-/raw/master/pictures/2023/04/12_10_47_33_pastcopy%E7%94%9F%E6%88%90.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI4NTcsImV4cCI6MTc4MjMwMzY1N30.JDNF7pmK4TlRq3Ih0BSLY1UR53g1Qtv-2lWx0fO-nd8)

- B先以写模式加载P，向A申请后，将B标记为x owner
- B修改P，拥有P的最新版本
- C以写模式加载P，向A申请，A发现当前最新版本在B手上，通知B将其发送给C，同时失效掉自己持有的P
- C收到B发来的P，通知A，A将x owner修改为C，将B标记为past copy owner


此时，B和C内存中都有P和相关ctrl，在B眼中，P是  **BP_IS_PASTCOPY**  ；在C眼中，P是  **BP_HAS_PASTCOPY**

C刷盘时，发现P有旧版本，刷盘时发送清理请求给A，A发现旧版本在B上，发送清理通知给B，B收到通知后，将内存中的P清理掉，同时向A返回确认，A将B移除出past copy owner。这一过程称之为  **正向清理**

B刷盘时，不将自己的P写入磁盘，因为它手中是旧版本，而是发送刷盘请求给A，A发现最新版本在C上，发送刷盘通知给C，C刷盘后，返回确认给A，A才能通知B将P从自己的内存中清理掉，同时A将B从past copy owner中去掉，这一过程称之为  **反向清理**

##   [2. Features（功能特性）](#2-features功能特性)  

集群适配单机的checkpoint和buffer clean，支持past copy的正向和反向清理

##   [3. Interfaces（接口）](#3-interfaces接口)  

配置参数和接口同单机checkpoint，正向清理函数在    `axcCleanRemoteBlock`    ，反向清理函数在    `axcReqCleanBlock`  

新增以下消息类型

|消息类型|处理函数|备注|
|---|---|---|
|MSG_REQ_MASTER_CLEAN_BLOCK|msgReqMasterCleanBlock|xowner发送给master|
|MSG_ASK_OWNER_CLEAN_BLOCK|msgAskOwnerCleanBlock|master发送给pcowner|
|MSG_OWNER_CLEAN_BLOCK_ACK|msgOwnerCleanBlockAck|pcowner发送给master|
|MSG_REQ_MASTER_FLUSH_BLOCK|msgReqMasterFlushBlock|pcowner发送给master|
|MSG_ASK_OWNER_FLUSH_BLOCK|msgAskOwnerFlushBlock|master发送给xowner|
|MSG_GRANT_CLEAN_BLOCK_ACK|msgGrantCleanBlockAck|xowner发送给pcowner|


主要接口如下

|文件|函数|简述|
|---|---|---|
|axc_ckpt.c|  `void axcReqCleanBlock(AnkHandler* handler, DbwrManager* dbwrm, CodUint8 mode)`  |在    `dbwrPrepareBlocks`    中调用，负责反向清理流程的发起，给master发送请求刷盘消息后返回，不等待|
|axc_ckpt.c|  `void axcCleanRemoteBlock(AnkHandler* handler, DbwrManager* dbwrm)`  |在    `dbwrPerform`    中调用，负责正向清理流程的发起，给master发送清理past copy消息后返回，不等待|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

规格和约束同单机checkpoint

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

无论是正向还是反向清理，都有一个原则，就是block在各实例间的流转，在各实例的状态，都必须受对应的master管控；

因此，正反向清理都是由block的master负责给current/pastcopy owner发送消息

在    `dbwrPrepareBlocks`    中，会扫描脏页队列，将队列中    `BP_HAS_PASTCOPY`    和    `BP_IS_PASTCOPY`    的block id分别记录在一个数组里，以备后续清理流程

###   [正向清理流程](#正向清理流程)  

正向清理在脏页刷盘结束后执行，requester将遍历    `BP_HAS_PASTCOPY`    的数组，根据master分到不同的chunk中，然后批量发送block id给对应的master

![](https://git.yasdb.com/lidaoyi/pictures/-/raw/master/pictures/2023/04/12_11_41_29_%E6%AD%A3%E5%90%91%E6%B8%85%E7%90%86.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI4NTcsImV4cCI6MTc4MjMwMzY1N30.JDNF7pmK4TlRq3Ih0BSLY1UR53g1Qtv-2lWx0fO-nd8)

###   [反向清理流程](#反向清理流程)  

![](https://git.yasdb.com/lidaoyi/pictures/-/raw/master/pictures/2023/04/12_14_15_33_%E5%8F%8D%E5%90%91%E6%B8%85%E7%90%86.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI4NTcsImV4cCI6MTc4MjMwMzY1N30.JDNF7pmK4TlRq3Ih0BSLY1UR53g1Qtv-2lWx0fO-nd8)

###   [触发频率控制](#触发频率控制)  

  `AXC_REQ_CLEAN_INTERVAL`    控制发送间隔，避免因为网络、处理时延等原因，导致请求清理的实例不断发送消息

如果上一次清理的时间距离现在还不到    `AXC_REQ_CLEAN_INTERVAL`    ，那么等100ms后再请求

###   [数据结构](#数据结构)  

```
#define AXC_REQ_CLEAN_INTERVAL  (CodDate)(10 * COD_US_1MS)
typedef struct StCleanBlock {
    BlockId   id;
    CodUint64 lsn;
} CleanBlock;

typedef struct StGcsCleanReq {
    CodUint8    instId;
    CodUint8    unused[3];
    CodUint16   blockCnt;
    CodUint16   dhtVersion;
    CleanBlock  blocks[0];
} GcsCleanReq;

typedef struct StGcsCleanChunk {
    CleanBlock* blocks;
    CodUint32   blockCnt;
} GcsCleanChunk;

typedef struct StGcsCleanArea {
    CodUint32      capacity;
    GcsCleanChunk* chunks;
} GcsCleanArea;

typedef struct StAxcDbwr {
    CodUint32      reqCleanCnt;
    CodUint32      cleanCnt;
    CodUint32      capacity;
    CodDate        lastReqTime;     // last time when request master clean pastcopy
    CleanBlock*    cleanBlocks;
    CleanBlock*    reqCleanBlocks;
} AxcDbwr;

```

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

checkpoint的自测和单机一致，需要额外添加pastcopy清理的测试

产生pastcopy的方式很简单，实例A插入若干数据，实例B执行update即可

- 正向清理：实例B执行checkpoint，查询视图    `V$GRC_PASTCOPY`  
- 反向清理：实例A执行checkpoint，查询视图    `V$GRC_PASTCOPY`  


##   [7.资料设计章节](#7资料设计章节)  

参考手册-动态视图-V$GRC_PASTCOPY：1.本视图显示PAST COPY信息。——PAST COPY后增加括号，解释含义2.LSN。——使用全称或中文，否则需在1.参考手册-术语表中增加LSN解释；2.doc/md-html.config中abbr_words列表增加lsn

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Comments:

|  [](null)  ,5-5 评审简单纪要,1. 文档中补充past copy block对应的日志刷盘相关设计
1. 需要新增若干统计指标，包括反向清理时，pc owner等待耗时；正反向清理时，current block刷盘耗时
1. 以该SR的版本作为checkpoint刷盘性能的基线
,Posted by lidaoyi at 五月 06, 2023 09:58|
|---|
|  [](null)  ,past copy等待耗时目前不好统计，遗留,Posted by lidaoyi at 五月 08, 2023 19:43|
