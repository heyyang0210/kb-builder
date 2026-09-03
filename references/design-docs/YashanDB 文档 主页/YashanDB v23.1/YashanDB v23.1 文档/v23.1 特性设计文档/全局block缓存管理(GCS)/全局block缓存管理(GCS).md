Created by 龙忠友, last modified on 一月 17, 2024

  


#   [YDBRD-13471 : 全局block缓存管理](#ydbrd-13471--全局block缓存管理)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-12140](https://jira.yasdb.com/browse/YDBRD-12140)  

##   [1. Overview（概述）](#1-overview概述)  

全局缓存管理服务(Global Cache Service)，简称GCS。在集群架构下作为核心的组件提供页面缓存服务。在单机模式下，页面的访问通过buffer进行，但在集群模式下，本地buffer只能提供对本地访问能力，同时block的生命周期要复杂很多，block不在本地buffer时，有可能在其他实例的buffer上；即使block在本地的buffer里，它也有可能不是一个有效的页面，是否修改得根据全局资源状态决定。

##   [2. Features（功能特性）](#2-features功能特性)  

- 从共享存储加载block到buffer
- 对block的访问，包括读写
- buffer淘汰
- pastcopy的维护
- block的并发访问


##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 接口](#31-接口)  

|接口名称|说明|
|---|---|
|axcLoadBlock|load block|
|axcLatchBlock|latch block|
|axcRecycleBlock|buffer淘汰|
|gcsReleaseBlocks|释放gcs资源|


###   [3.2 通讯消息](#32-通讯消息)  

|消息名称|回调函数|说明|
|---|---|---|
|MSG_WAKEUP_BLOCK_REQUEST|msgWakeupRequest|在处理排队中的消息时，当本线程处理不了时，需要让对应的线程组去处理|
|MSG_REQ_MASTER_BLOCK|msgReqMasterBlock|master处理requester的current block请求|
|MSG_GRANT_LOAD_BLOCK_ACK|msgGrantLoadBlockAck|requester处理授权ack|
|MSG_CLOSE_REQ_BLOCK|msgCloseRequestBlock|master处理闭环消息|
|MSG_ASK_OWNER_SEND_BLOCK|msgAskOwnerSendBlock|master要求owner去发送block，owner处理|
|MSG_OWNER_SEND_BLOCK_ACK|msgOwnerSendBlockAck|requester处理owner发送的block|
|MSG_REQ_MASTER_UPGRADE_BLOCK|msgReqMasterUpgradeBlock|master处理requester的锁升级请求|
|MSG_BROADCAST_INVALIDATE_BLOCK|msgBroadcastInvalidateBlock|master要求owner失效block，owner处理|
|MSG_INVALIDATE_BLOCK_ACK|msgInvalidateBlockAck|owner失效block后恢复ack，master处理|
|MSG_ASK_OWNER_INVALIDATE_BLOCK|msgAskOwnerInvalidateBlock|master要求owner失效block，owner处理|
|MSG_GRANT_UPGRADE_BLOCK_ACK|msgGrantUpgradeBlockAck|owner失效block后，给requester恢复授权ack，requester处理|
|MSG_REQ_RECYCLE_BLOCK|msgReqRecycleBlock|master处理requester的recycle请求|
|MSG_RECYCLE_BLOCK_ACK|msgRecycleBlockAck|requester处理master的recycle回复|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 不支持消息异常处理。
1. 不支持Memeory mapped tablespace


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

####   [5.1.1 物理视图](#511-物理视图)  

以三个实例为例，用下图描述每个实例与实体间的关系

- 实例1在handler中完成buffer到GCS的访问，通过ICS消息通道发送请求到实例2。
- 实例2通过ICS channel收到实例1的请求后，交由后台task service负责响应消息，在其中完成GRC相关的资源处理，当然其中亦有GCS参与。
- 实例3通过ICS channel收到实例2的授权消息后，交由task service完成GCS到buffer层的资源处理。
- 实例1通过ICS channel获取实例3发送的应答结果，交由handler完成继续的资源访问。


![](https://pingcode.yasdb.com/atlas/files/public/67396b1b8970c2af4f5201b1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

####   [5.1.2 逻辑视图](#512-逻辑视图)  

下图描述了buffer、GCS、以及GRC的逻辑关系。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1b8970c2af4f5201b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

- buffer层通过GCS提过的接口访问block。
- GCS根据GRC获取到授权信息（GRC的执行实体可能是本实例，也可能是其他实例），通过ICS消息交换通道发送到目的端。
- 目的端GCS获取本地资源后返回结果到请求方。


###   [5.2 Data Structures & Flow（流程）](#52-data-structures--flow流程)  

####   [5.2.1 角色](#521-角色)  

在集群架构中，对于资源的请求，管理，持有等操作，对于每个实例都扮演着不同的角色，常常称为RMO模型，即requester、master、owner。

- requester：发起资源请求的实例，同一个实例对于同一资源的请求是串行的，多个实例对同一资源的请求是并行的。
- master: 资源目录所在的实例，集群内同一资源的master有且只有一份，其是按需分配的，master提供实例间资源的并发访问控制。
- owner: 持有资源的实例，owner有sOwner和xOwner之分，xOwner是持有block的主实例，其具有写权限，sOwner具备读权限，不管sOwner还是xOwner，其都持有的是block的最新版本。


####   [5.2.2 主要流程](#522-主要流程)  

根据消息的处理，基本的场景为：本地加载block、请求current block读、请求current block写、请求upgrade block、buffer 淘汰、pastcopy的维护管理。下面逐步描述各种场景流程。

#####   [本地加载block](#本地加载block)  

当requester访问block时，master发现该block没有被任何实例持有，于是返回ack，让requester从共享存储上读取block。此时requester和master可以是同一个实例，也可以是不同实例，当是同一个实例时，不会产生跨实例消息交互。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1ca1ad9a3311dc802a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

#####   [请求current block 读](#请求current-block-读)  

requester请求current block读，master发现有实例持有该block，优先看是否master持有，如果master持有，master转发block，否则要求onwer转发block，该过程可能是三个实例参与，也可能是两个实例参与。当三个实例参与时，requester、master、owner代表不同的实例；当两个实例参与时，分两种：requester、master是同一个实例；master、owner是同一个实例。

如果owner持有X锁，发送block之后会降级为S锁。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1c8970c2af4f5201b3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

#####   [请求current block 写](#请求current-block-写)  

requester请求current block写，master发现有实例持有该block，当只有一个owner时，消息的处理流程和请求读是一样的，为了覆盖失效其他owner的场景，这里假设有两个或两个以上的owner，大概流程如下

![](https://pingcode.yasdb.com/atlas/files/public/67396b1c8970c2af4f5201b4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

#####   [请求upgrade block](#请求upgrade-block)  

requester持有S锁，然后要请求block写，这时会进行锁升级，如果有2个owner，master直接让requester之外的owner失效，owner失效后给requester返回授权；如果2个以上的owner，master则广播，让requester和xOwner之外的owner失效，在处理广播ack时，如果此时ownercount是2，则回到前面2个owner的逻辑。

锁升级类似请求写的流程，不同之处在于，锁升级只有消息传输，没有block传输，不过在并发场景下，进行锁升级的同时，自身的S锁有可能会被失效(其他实例也进行锁升级)。此时需要转换为请求 current block写。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1c8970c2af4f5201b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

#####   [buffer 淘汰](#buffer-淘汰)  

实例在进行buffer淘汰时，如果自身的全局资源状态是有效的，即持有X或S锁，需要向master发送消息，让master取消资源登记。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1c8970c2af4f5201b6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

#####   [pastcopy的维护管理](#pastcopy的维护管理)  

pastcopy：current block过去的一个副本，oracle RAC叫PI(past image),存在pastcopy的意义在于加速恢复。其存在与bufferPool中，不能刷盘，current block刷盘时，如果有pastcopy需要通知其释放，每个实例的同一个资源只存在一份pastcopy

假设有三个实例，inst0、inst1、inst2此时inst2 持有b1 的X锁，且b1是脏页t0时刻：inst0 请求b1 的X 锁，完成本次请求后的一个状态是，inst0 持有b1 current block的X锁，master登记了xOwner是inst0，ownerCount=1，pastcopy列上有inst2，inst2上的b1 变成了pastcopy，X锁变成Free。

t1时刻：inst1 请求b1 的X 锁，完成本次请求后的一个状态是，inst1 持有b1 current block的X锁，master登记了xOwner是inst1，ownerCount=1，pastcopy列上有inst0、inst2，inst0上的b1 变成了pastcopy，X锁变成Free。

t2时刻：inst2 请求b1 的S 锁，完成本次请求后的一个状态是，inst2 持有b1 current block的S锁，inst1 的X 锁降级为S 锁，master登记了xOwner是inst1，ownerCount=2，map=(110)，pastcopy列上有inst0、inst2，inst0上的b1 变成了pastcopy。

t3时刻：inst2 请求b1 的X 锁，完成本次请求后的一个状态是，inst2 持有b1 current block的X锁，inst1 的X 锁被Free，master登记了xOwner是inst2，ownerCount=1，pastcopy列上有inst1、inst0， inst1上的b1 变成了pastcopy。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1c8970c2af4f5201b7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVSQUFBQUFRQUFBQWdFQUFBQUFBQUFnQWlBQUFBUUVBQUFRQUFDQUFNQkFBQUFBQUFBQUFBQUFBQUFFQUFBRVFBQUFBQUFBQUFBQUFBSUFBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBUUlBZ0JBQUFBQUFBZ0FBQ0FBQUFBQUFJQUFBQUFBQUFBQUFRQkJBQUFRZ0FRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA5NDgsImV4cCI6MTc4MjMwMTc0OH0.LfyoJqGcoG-O78Z0iCtqVhmBW1VxNXzN8u4buQfvxKg)

###   [5.3 DFX设计](#53-dfx设计)  

本次设计不考虑DFX能力

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

部署三个实例：

1. 实例0执行


```
	create table t (id int);
	insert into t values (1);
	commit;

```

1. 实例1执行


```
	select * from t where id = 1;

```

1. 实例0、实例1同时执行


```
	insert into t values (1);
	commit;

```

1. 实例2执行


```
	insert into t values (1);
	commit;

```

1. 实例1执行


```
	select * from t;
	select * from t;
	select * from t;
	select * from t;
	select * from t;
	select * from t;

```

1. 实例0执行


```
	select * from t;
	select * from t;
	select * from t;
	select * from t;
	select * from t;
	select * from t;

```

1. 实例2执行


```
	insert into t values (1);
	commit;

```

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[taskprocess.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWE4OTcwYzJhZjRmNTIwMWEwIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.AWRQPvKCMrSGFOZ_Jt2O7_NJxcjs_4xLnymbtg1fghw)

 (image/png)    


[readmsg.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWE4OTcwYzJhZjRmNTIwMWExIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.52NcWA5KsDhQ7DEtnnvPqXurF_DgAPLCchlW5mzG67U)

 (image/png)    


[area_cell.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWE4OTcwYzJhZjRmNTIwMWEzIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.Zz37iHKyruiDSMiXXop0EAxcvLjDCRghse_Nc2qlx4c)

 (image/png)    


[内存布局.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWFhMWFkOWEzMzExZGM4MDE5IiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.pF1pPRDVUXTkCnUWUclTxBByuXHdCiypvV7aOyp4EUE)

 (image/png)    


[逻辑视图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWE4OTcwYzJhZjRmNTIwMWE1IiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.xAKi4MuRidBlC0h4teETiS1tTnqQdOu3oj45SVKIPRU)

 (image/png)    


[task.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWFhMWFkOWEzMzExZGM4MDFiIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.lFGDDDqi4b7KhyGutS829VBtEVw_4VyYML-WLhXj9k4)

 (image/png)    


[scene.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWJhMWFkOWEzMzExZGM4MDIzIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.UxVrP0XyZbyBdGEc_EjdcEoqNrJzP-OqXPRninzaXrM)

 (image/png)    


[gcs.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWJhMWFkOWEzMzExZGM4MDI1IiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.Qk0LkVmG8r5MaadwOPuIyGXkNSEqbb_aWhu0v7WxeEE)

 (application/x-xmind)    


[requesterX.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWI4OTcwYzJhZjRmNTIwMWFlIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.ChVffh3uxIY0hCXCSwTmoKI2EQnhkH-JVvJII0V2ruc)

 (image/jpeg)    


[requesterX.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWJhMWFkOWEzMzExZGM4MDI2IiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.AF-zySkm32aKkK2iyyZ3tjdFijzPKZkyswLGoKdVlQ4)

 (image/jpeg)    


[requesterX.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWI4OTcwYzJhZjRmNTIwMWFmIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.KhuNPwxDb5A66jPMC4atSU3MJhcn-_MAuyAW6eXhP6s)

 (image/jpeg)    


[requesterX.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWI4OTcwYzJhZjRmNTIwMWIwIiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.FY6RB3R1mhbEqeQ6K2px1l319EBP_7phZOPQS3i6VwY)

 (image/jpeg)    


[recycle.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWJhMWFkOWEzMzExZGM4MDI4IiwicmVmX2lkIjoiNjczOTZiMWE3MjgyMDZlZmI5MmYwMWRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwOTQ4LCJleHAiOjE3ODIzNzczNDh9.i05BI0vCtvz3-xvyYU5pINDR9tx8qP9DMwBS0s1vAsg)

 (image/jpeg)    


## Comments:

|  [](null)  ,评审时间：2023.5.10 下午 17：00,参与人员：孟凡彬、同二鹏、张丽红、牛亚娜、吕雷奇、高亚宁、徐凡博,评审意见：,          1、设计文档中增加对pastcopy维护管理的描述。,          2、尽量精准构建用例覆盖到场景,          3、迭代3 增加一些DFX能力,Posted by longzhongyou at 五月 11, 2023 12:00|
|---|
|  [](null)  ,gcs的相关并发梳理：,Posted by longzhongyou at 七月 21, 2023 18:01|
