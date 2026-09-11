Created by 郭藏龙, last modified by  陈晓晴 on 七月 17, 2024

SR链接：    [https://pingcode.yasdb.com/pjm/items/66592bdd288e197820989cb7](https://pingcode.yasdb.com/pjm/items/66592bdd288e197820989cb7)    ?    
  #YDBRD-28580 支持Share Pool内存自动管理

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

Share pool是SGA的重要组成部分，用于数据库会话间共享资源的缓存，由一系列子pool构成。share pool包括以下子pool。但是目前share pool的内存虽然是统一配置，但是子pool之间的内存无法动态均衡，导致需要用户根据不同业务场景进行调整，配置难度较大，易用性很差。

Share pool内存统一管理的目的是为了解决内存配置困难的问题，数据库内部会根据实际诉求动态调整子pool的内存，对用户完全透明。

###   [1.2 调研文档](#12-调研文档)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/cncpt/memory-architecture.html](https://docs.oracle.com/en/database/oracle/oracle-database/19/cncpt/memory-architecture.html)  

###   [1.3 需求分析](#13-需求分析)  

Share pool内存统一管理要支持不同组件之间的内存动态均衡，shared pool可以要求组件动态释放内存，组件也可以动态向shared pool申请内存。其中的关键点是内存动态申请和释放的单元，有以下三种实现思路：

|内存单元|优点|缺点|
|---|---|---|
|任意大小内存|各组件内存管理的方式比较灵活，按需申请和释放内存即可|shared pool需要完整实现一套通用的内存管理机制（类似malloc/jmalloc）复杂度较高，而且频繁的小内存申请和释放会导致内存碎片化，性能劣化明显。|
|固定大小内存（本次实现）|管理简单，可以复用现有的机制（例如mpool管理）|需要统一所有组件的内存管理方式|
|固定的多种大小内存（按需优化）|对mpool进行改造，支持buddy分配策略，较方案二有提升了组件内存使用的灵活度，内存碎片问题没有方案一冲突|需要对mpool改造，仍存存在内存碎片问题，目前对没有识别到不同内存单元大小的诉求|


目前share pool包括的组件有两类：

- 基于mpool管理，支持Block级别的申请和释放：sql, dc, dstb
- 独立内存管理：lock, cursor, gcs, gls, grc


后续share pool的组件将分为两类：

- 内存可动态伸缩：需要提供定长内存（以Block为单位）的申请和释放接口
- 固定内存大小：只在shared pool中一次性分配内存（一般不推荐）


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|Share Pool|数据库实例级别的内存区域，包含若干子的内存池（组件）|NA|NA|
|Memory Block|Share Pool中用于动态均衡的内存块，默认大小为16K|NA|NA|


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|
|---|---|---|
|配置参数|SHARE_POOL_SIZE|配置shared pool总大小|
|动态视图|V$SHARE_POOL|查看share pool使用情况|


##   [3. 规格与约束](#3-规格与约束)  

- 目前仅支持dc pool，sql pool, lock pool的动态均衡，其他组件为固定内存
- v$share_pool，gv$share_pool 新增列统计各个子pool动态均衡的内存。


##   [4. 特性](#4-特性)  

###   [4.1 Share pool管理结构](#41-share-pool管理结构)  

Share pool结构定义如下：

```
typedef struct StSharePool {
    MemoryZone*     zone;         // 总内存区域
    CodUint32       blockSize;    // 内存块大小
    SpinLock        lock;           
    SharePoolItem*  items;        // 子内存池
    MemoryPool      freePool;     // 空闲内存池
} SharePool;

```

其中SharePoolItem表示shared pool的一个组件，每个组件注册到share pool需要提供以下信息：

- 初始化方式：是按照固定大小初始化还是按照百分比初始化
- 初始化配置：提供初始化大小或百分比
- 内存管理方式：固定内存大小还是内存可动态伸缩
- 内存最大最小值：初始化会进行校验，同时在动态均衡时也需要满足最大最小值约束


即可动态均衡的几个子POOL的大小满足如下规格：

64MB <= SQL POOL SIZE <= 64TB

16MB <= DC POOL SIZE <= 64TB

16MB <= LOCK POOL SIZE <= 32 GB

可动态伸缩的组件还需要提供内存淘汰接口，share pool可以通过组件注册的接口从相应的内存池淘汰出可用的内存块，接口定义如下：

```
typedef CodBool (*SharePoolItemRecycle)(CodPointer owner, CodUint32 blocks, MpoolBlockCtrlList* list, CodBool preempt);

```

Free pool基于MemoryPool管理空闲的内存，share pool可以从组件释放内存到free pool，每个组件也可以从free pool申请空闲内存。

###   [4.2 初始化](#42-初始化)  

Share pool的内存由参数SHARE_POOL_SIZE决定并且在创建SGA时统一申请，然后给share pool每个组件分配内存，分为三部分：

1. 按固定大小初始化内存：不管share pool配置多大，按照固定的大小分配初始化内存
1. 按百分比初始化内存：根据share pool的大小以及配置比例分配初始化内存
1. 保留内存：剩余的内存通过FREE POOL管理，用于组件后续的内存申请


Share pool初始化每个组件的内存分配之后，每个模块需要单独设置内存的使用。例如对于DC Pool，需要将其内存指针和大小赋值到Kernel上用于后续的dc pool初始化，同时需要设置dc pool在share pool中的id以及回调参数，用于后续的动态均衡。

###   [4.3 Share pool内存动态均衡](#43-share-pool内存动态均衡)  

Share pool提供了申请blocks的接口，定义如下：

```
CodBool sharePoolAllockBlocks(CodUint32 itemId, MpoolBlockCtrlList* list, CodBool preempt)

```

itemId申请者的组件id；preempt为false表示只会从free pool申请，不会去抢占其他组件的内存，反之亦然；list是申请到的内存块列表。

Share pool获取空闲首先会从free pool尝试申请blocks，如果未申请到，同时是抢占模式，会去从其他pool淘汰blocks。从其他pool淘汰blocks也分两种模式：

- 非抢占模式：轻量级淘汰，不会导致其他pool的对象状态发生变化，例如对于DC只会从mpool free list上申请，不会去淘汰对象dc。
- 抢占模式：需要通过淘汰对象的方式释放可用内存。


不同的组件可以同时实现抢占模块和非抢占模式的淘汰，也可以只支持一种方式。

###   [4.4  share pool组件](#44--share-pool组件)  

####   [4.4.1 SQL POOL](#441-sql-pool)  

- 申请：sql pool目前包括了main pool和 pl pool，当对应mpool内存不足时，首先会使用非抢占的方式从share pool申请内存，如果没申请到会自己内部淘汰，如果依然没有可用内存最后会使用抢占的方式从share pool申请内存。
- 淘汰：sql pool需要淘汰自身的内存给share pool，非抢占模式尝试释放main pool和pl pool的free block，抢占模式会通过失效plan以及自我淘汰的方式释放内存。


####   [4.4.2 DC POOL](#442-dc-pool)  

- 申请：使用非抢占的方式从share pool申请内存，如果没申请到会自己内部淘汰，如果依然没有可用内存最后会使用抢占的方式从share pool申请内存。
- 淘汰：非抢占模式尝试释放dc pool的free block，抢占模式自我淘汰的方式释放内存


####   [4.4.3 LOCK POOL](#443-lock-pool)  

- 申请：使用非抢占的方式从share pool申请内存，如果没申请到会使用抢占的方式从share pool申请内存。
- 淘汰：非抢占模式尝试释放lock pool的free block。抢占模式释放空闲的lock以释放内存。


####   [4.4.5 视图](#445-视图)  

v$share_pool，gv$share_pool新增如下字段：

|字段|类型|说明|
|---|---|---|
|MEMORY_INIT_TYPE|VARCHAR(16)|初始化内存池的方式。   *PERCENTAGE: 按照百分比初始化  *NUMBER: 按照固定大小初始化|
|MEMORY_MANAGE_TYPE|VARCHAR(16)|内存管理方式。    *VARIABLE: 内存可动态伸缩   *FIXED: 固定内存大小|
|MEMORY_REQUEST_COUNT|BIGINT|内存池动态申请内存的次数|
|MEMORY_REQUEST_SZIE|BIGINT|内存池动态申请内存的大小|
|MEMORY_FREE_COUNT|BIGINT|内存池动态释放内存的次数|
|MEMORY_FREE_SIZE|BIGINT|内存池动态释放内存的大小|


##   [5.Testcases（自测用例）](#5testcases自测用例)  

调整隐藏配置参数SQL_POOL_SIZE，DICTIONARY_CACHE_SIZE，LOCK_POOL_SIZE等，构造各个动态pool的内存不足需动态申请内存的场景。需要关注内存无泄漏。

## Comments:

|  [](null)  ,主题：share pool内存管理设计评审    
  与会人：郭藏龙，刘丹，郑荃，陈晓晴    
  会议时间：2024/7/11 14:10-15:00    
  会议地点：1002会议室，线上会议    
  会议纪要:,1、关注内存是否有泄漏。,Posted by chenxiaoqing at 七月 29, 2024 09:59|
|---|
