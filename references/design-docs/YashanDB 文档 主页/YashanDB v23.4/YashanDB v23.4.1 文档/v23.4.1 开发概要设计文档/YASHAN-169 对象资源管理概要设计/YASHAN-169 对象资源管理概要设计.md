Created by 孟凡彬, last modified on 十一月 15, 2024

# 总体概述

## 背景介绍

对共享集群的客户群体而言，一般使用集群会有两种策略：

- 混合负载，集群下的各个实例随机的读写集群下管理的所有数据，此场景下一般会伴随大量的GC请求事件，业务性能一定程度上受全局资源调度的影响。
- 应用分区，集群下每个实例接入的业务是不同的，只有在发生故障时才做切换，此场景下GC请求事件相对较少，同样此场景下客户对业务执行的性能是有一定的要求。


而全局资源管理在上述两种场景种都是非常关键的一个环节。当前版本中GRC管理的资源有两类：GCS资源和GLS资源，通过一定的资源分布算法（DHT，distribute hash table）管理各个节点下的资源元数据信息，详细的资源分布策略可以参考    [GRC概要设计 ](https://conf.yasdb.com/pages/viewpage.action?pageId=109583325)    中相关章节，通过这个算法，每一个资源在集群内，有且只有一个资源主节点。

- 对于GCS而言，通过blockId计算资源的master节点，以1024个blockId为一组。
- 对于GLS而言，通过objectId+lockType决定资源的master节点。


集群在大部分使用场景下，GLS相关的全局资源请求访问是相对较少的，大部分集中在GCS上，而通过blockId计算master节点有一定的随机性，对于混合负载场景下这类随机的分布是没有问题的。而对于应用分区场景下，如果一个实例频繁访问的对象，其资源元数据信息一部分在其他实例上管理，此时会有一些不必要的全局资源请求开销。

因此基于应用分区场景下的数据分布和访问特点，需要支持对象级的资源管理，即支持指定对象（表、索引、分区）对应的资源主节点。

## 需求分析

基于上述的业务场景痛点，需要设计支持一套全新的资源管理与分布策略，其应该具备以下特点：

1. 对象资源管理应该只针对数据块资源，对于非数据块资源是没有必要性的。
1. 对象资源管理应该是基于特定对象级别的，其与原先基于数据块的资源管理是可以共存的。
1. 通过SQL语句可以更改对象的资源管理管理属性，并伴随着全局资源的迁移。
1. 完备的对象资源管理设计应该适配实例启停、实例故障、在线恢复、全量恢复等场景。
1. 对象资源管理的相关信息应具备持久化能力。
1. 对象资源管理应该具备可视化视图查询能力。


## 友商调研

目前共享集群领域只有oracle RAC在早期的10G是支持了对象级资源管理的，但oracle RAC没有直接以正式特性的方式发布此能力，而是通过DRM特性进行承载。

DRM（Dynamic resource manager）是一种基于统计的动态调整的资源管理策略，其整个发展历程是非常曲折的，从oracle整体演进来看，其经历了下面的过程：

![](https://pingcode.yasdb.com/atlas/files/public/67396eeda1ad9a3311dc9ade/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUJBRUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0lBQUFnQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCSUFBZ0FBQUFnQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NTQsImV4cCI6MTc4MjQ2NzI1NH0.w7UolyJ4_Qdlts5j5MYcsdUYpZuS7bQmMRL2ef-r3t4)

DRM是一把双刃剑，是oracle RAC的DBA谈虎色变的一种技术，原因有几方面：

- 基于动态统计变化的资源迁移是用户不可控的，即使后期版本做到了可控，其对DBA的要求是非常高的；
- 早期版本DRM是无法关闭的，DRM占用大锁，导致系统长时间不可用。
- oracle提供手动迁移的方式不友好，需要使用oradebug命令进行。


除了DRM外，RAC还支持基于blockId的资源管理算法，并且在9i版本中引入了基于file affinity的管理策略，后期后续的版本中file affinity基本没有在使用了。

  


对象资源管理是个对用户有高价值的特性，不能因为DRM特性的缺陷，而否认对象资源管理的价值。YashanDB本次交付对象资源管理，只提供手动指定对象迁移以及自动UNDO亲和的能力。基于统计的动态资源迁移能力（DRM），暂时不考虑。

# 总体设计

## 设计概述

基于前面的需求分析，支持对象资源管理最核心的是要引入对象资源管理策略，使得GRC可以根据不同策略管理各类资源。当前默认的资源管理算法为DHT，DHT有一定的局限性：

- 节点数量非2的幂次方时，虚拟节点到物理节点的映射是非常不均衡的，而集群常用的节点规模为2、3、4。
- 当节点出现资源不均衡时，DHT基于负载不同去管理资源的实现比较复杂。


基于上述分析，考虑在当前需求中对默认采用的DHT算法进行优化。

此外除了引入对象资源管理策略后，需要完善缓冲区的管理能力，当前缓冲区采用的是基于BlockId的管理策略，而GCS/GRC是在缓冲区管理的下一层，所以要对缓冲区进行优化设计。

### GHT资源管理

GHT资源管理算法采用的是类似Redis的哈希槽的算法，Oracle RAC也采用类似的策略。

![](https://pingcode.yasdb.com/atlas/files/public/67396eeda1ad9a3311dc9adf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUJBRUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0lBQUFnQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCSUFBZ0FBQUFnQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NTQsImV4cCI6MTc4MjQ2NzI1NH0.w7UolyJ4_Qdlts5j5MYcsdUYpZuS7bQmMRL2ef-r3t4)

具体说明如下：

- 每个Vnode是一个虚拟节点，归属于特定的实例，当发生节点加入离开集群时，以vnode为单位进行重组，故障实例管理的vnode由存活实例进行管理。
- 每个Vnode对应一个Partition，Partition是资源管理的实体。
- 每个Partition下管理若干bucket，bucket中管理具体的Grc Resource资源。


基于集群节点规模下的场景特点，使用GHT相对于DHT更合适，GHT可以做到更灵活的资源迁移以及资源检索，并对节点数没有要求。另外GHT可以通过负载均衡策略，buffer配置大的实例管理的vnode要多一些。

GHT同样具备DHT的一些特点，比如在发生节点启停时，会有少量的节点、资源发生迁移，不需要整个集群所有的全局资源进行调整。

### OHT资源管理

在GHT的算法基础上，引入OHT资源管理，用以解决对象资源管理的诉求。OHT（Objecty Hash Table）通过在GRC上构建一个对象的哈希表，用以做对象和实例的映射关系。

![](https://pingcode.yasdb.com/atlas/files/public/67396eeda1ad9a3311dc9ae1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUJBRUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0lBQUFnQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCSUFBZ0FBQUFnQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NTQsImV4cCI6MTc4MjQ2NzI1NH0.w7UolyJ4_Qdlts5j5MYcsdUYpZuS7bQmMRL2ef-r3t4)

具体说明如下：

- OHT采用层级管理结构，通过ObjectID做哈希，计算得到对应的对象信息，对象是绑定在实例上的。
- 对于每一个对象而言，其存储管理实体与GHT中的Vnode一致，都采用partition的管理策略，partition下再次分多个bucket，每个bucket管理对应的resource。
- 与GHT不同的是，GHT的partition桶内是多个对象的资源混合管理，而OHT的partition桶内是同一个对象的资源管理。
- OHT在启停节点时，如果不涉及到相关绑定实例，此时OHT不会进行资源重分布，当涉及到对应的资源绑定节点时，会进行资源的托管。


  


**OHT与GHT总结：**

- OHT与GHT在整个集群下所有节点下需要保证一致性，当Vnode或者Object属于当前实例时，对应的partition才有效。
- OHT和GHT策略都遵循现有的RMO请求原则，其本身对GCS并没有影响，仅对资源master的计算和资源的寻址过程做了一下调整。
- OHT和GHT采用算法叠加的方式配合计算得到数据块资源的master resource，先计算OHT，OHT无效时采用GHT计算。
- 引入GHT代替DHT可以分离GLS和GCS的分布策略，GLS按照均匀分布而GCS按照负载分布。


Undo表空间下的数据是一类特殊的资源对象，其具备天然的实例亲和特点，一个实例只会使用自己的undo表空间，因此本设计会考虑UNDO默认采用对象亲和策略。

### 对象缓冲区管理

基于前面的场景诉求，需要在缓冲区上增加对象信息，缓冲区改造难点有几个方面：

1. 缓冲区接口上层调用场景有500处左右需要逐个分析改造，  **这部分投入的时间比重会比较大**  。
1. 重启恢复和在线故障恢复场景下，redo日志中没有dataOid，导致回放调用缓冲区接口无法传入dataOid，  **此时需要改造apply block的REDO函数并增加记录dataOid**  。
1. 部分正常逻辑下没有传入dataOid，  **此时需要拿到有效页面后进行dataOid的校验和检查，包括data buffer和GRC**  。
1. DDL诸如drop/truncate/shrink与select并发，存在空间复用时，查询即使传入了认为正确的dataOid，由于空间已经被其他指定对象亲和的object复用，  **此时无法找到有效的master。**


**Buffer Object**

对象缓冲区除需要增加dataOid外，还需让缓冲区具备对象属性，总体来说要具备以下特征：

1. 同一个对象的buffer需要统一管理，通过在buffer中增加对象链表来管理同一个对象的所有buffer。
1. 当一个对象被drop/truncate时，需要进行对象级的checkpoint以及对象缓冲区淘汰。
1. CR一种特殊的页面，其登记dataOid，  **但不受对象资源管理**  。


增加Buffer Object（简称BO）模块，用以管理相关的object信息，所有归属于当前object的buffer ctrl通过BO入口进行链表维护、查询。

下图中给出了基于block id管理与基于dataOid管理的buffer ctrl的示意图：

![](https://pingcode.yasdb.com/atlas/files/public/67396eed8970c2af4f521c70/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBd0FBQUFBQUFBQUFBQUFBQUFBQUFBQUJBRUFBQUFBQUFBQUFBQUFBQUFBSUFBZ0lBQUFnQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCSUFBZ0FBQUFnQUFBQUFJQUFBQUFBRUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NTQsImV4cCI6MTc4MjQ2NzI1NH0.w7UolyJ4_Qdlts5j5MYcsdUYpZuS7bQmMRL2ef-r3t4)

buffer object的管理与现有的buffer ctrl管理并不冲突，属于两个维度。同一个buffer ctrl可以即在hash链表上，也在hash链上。增加buffer object后，buffer ctrl本身的管理仍然主要受buffer bucket管理，包括检索、分配、LRU淘汰等。而buffer object类似buffer bucket的概念，并且由于object管理的buffer是跨partition的，所以buffer object本身不能分区。

buffer object管理机制:

- Buffer Object的个数本次设计暂时采用  **隐藏参数+内部计算**  的方式进行控制，如果用户未配置，则配置为buffer大小相关的值。
- Buffer Object使用  **哈希算法管理object**  ，哈希桶个数定义为  **8192个**  ，buffer object是个全局结构，通过bucket检索相关的object信息。
- Buffer Object有  **淘汰机制**  ，只有那些没有block关联的object可以加入到淘汰链，具体淘汰规则下面的设计后详细开展。


buffer object生命周期：

1. 新分配buffer ctrl，如果传入了有效的dataOid需要进行关联BO，  **只要页面在bpBucket中，ctrl就需要与object进行关联**  。
1. BO分配优先从未使用的进行分配，BO不足时进行BO的淘汰，也就是新分配buffer ctrl上时可能同步进行BO的分配与淘汰。
1. 新分配BO时，使用传入的dataOid进行填充（这里有个假设就是上层模块传入的有效object id是正确的）。
1. BO的检索仅在buffer ctrl页面发生读盘、远程请求、锁升级进行判断，这类开销和影响是完全可控。
1. **BO仅在drop/truncate对象时被失效**  ，被失效不意味着要马上淘汰，其仍然在BO bucket中管理。
1. BO的淘汰通过遍历BO淘汰链进行  **，只有那些没有buffer关联的BO可以被直接淘汰**  ，  **对于已经被失效的BO必须要等到系统最小的查询SCN > BO失效SCN时才可以淘汰**  。


  


引入buffer object后，缓冲区管理要做一定调整变化：

1. **对于buffer的主流程不做改动**  ，原则上如果有效的block在buffer中，不需要BO相关的逻辑参与处理。
1. buffer有效的情况下如果发现传入的dataOid和buffer ctrl上dataOid不一致时，  **由上层进行报错处理**  。
1. 对于新分配的ctrl，单机会读盘，集群会请求master，此时已经释放bucket。
1.     - 根据dataOid检索BO哈希桶，如果没有Object，则创建Object，有的话检查Object有效性。
    - Object有效，将ctrl挂到对应的Object上，进行后续的读盘或者请求master。（此处如果有truncate失效会等待页面被释放，正在加载的过程会产生等待）
    - Object无效，此时原则上修改要进行报错，查询直接转为本地读取CR Block。(此时不会进行master请求，需要新分配个CR，将current释放掉)

1. 对于free的ctrl，单机是没有此场景的，集群存在此场景，如PC是需要继续在buffer bucket下管理的。
1.     - free的ctrl，同样会设置converting，此时释放了bucket，这里的free block不一定是脏页，有可能是free的页面。
    - ~~当一个block变为free时，可能考虑将其从object链上摘掉，脏页应该不能摘，free的页面要摘掉。~~
    - 如果Object有效，按照现有请求流程走master请求。
    - 如果Object无效，此时原则上修改要进行报错，查询直接转为本地读取CR Block。（将converting标记去掉，新分配个CR，将current释放掉）

1. 对于模式不匹配的ctrl，通常意味着锁升级，此时单机同样时没有此场景的，集群存在此场景。    

1.     - 模式不匹配的ctrl，此时会设置converting，此时释放了bucket。
    - 如果bpObject有效，按照现有请求流程处理，该锁升级的锁升级。
    - 如果bpObject无效，此时锁升级要进行报错处理。

1. 对于CR请求而言，CR请求会走latch block和load block两个场景，都有处理，其中对于通过rowId fetch请求的一致性读，  **此时如果本实例内页面无效要全部强制走CR读**  。


新增能力变化：

- 对象级checkpoint，当执行drop/truncate/shrink时进行对象级的checkpoint，将所有此对象相关的buffer ctrl脏页刷盘，集群下所有实例都要进行。
- 对象级淘汰，将执行drop/truncate/shrink时需要进行对象级缓冲区淘汰，将所有此对象相关的buffer ctrl淘汰，集群下所有实例都要进行。


## 设计约束

1. 考虑UNDO表空间的特点，先通过UNDO的自动亲和支持对象级资源管理的能力；
1. Undo表空间亲和的参数为重启生效且所有实例必须保持一致；
1. 支持用户对象资源管理能力仅限于表、索引以及相关分区，  **且仅能作用非系统表和系统索引**  ；
1. 支持通过SQL命令迁移对象，同一个对象在迁移过程中再次迁移会报错。


# 数据结构设计

当前需求需要对GRC的资源管理规则做一定的调整，需要设计新的数据结构，基于上述的原理设计，结构大概如下：

OHT相关的数据结构

```
typedef enum EnGrcOhtStatus {
    GRC_OHT_IDLE = 0,
    GRC_GHT_TO_OHT,
    GRC_OHT_TO_OHT,
    GRC_OHT_TO_GHT,
} GrcOhtStatus;

typedef struct StGrcObject {
    CodUint32     id;          /* hash object id */
    CodUint32     next;        /* hash list next when allocated, free list next when freed */
    CodUint64     objectId;     /* data object id */
    CodUint8      currInst;    /* instance holding the object resources */
    CodUint8      prevInst;    /* previous instance holding the object resources */
    CodUint16     status;      /* ght->oht, oht->oht, oht->ght, idle */
    GrcPartition* partition;   /* object resource partition, if current instance is master */
} GrcObject;

/* object hash table */
typedef struct StOhtRule {
    CodUint32   bucketCnt;          /* object hash bucket count */
    GrmBucket*  buckets;            /* bucket for object hash table */
    GrmContext  objects;            /* grc object context */
    CodUint8    deposit[AXC_MAX_INSTANCES];
    GrmPool     objPool;
} OhtRule;
```

  


GHT相关的数据结构

```
typedef struct StGhtValue {
    CodUint32 vnode;
    CodUint32 bucket;
} GhtValue;

typedef struct StGhtVnode {
    CodUint8    instId;
    CodUint8    status;
} GhtVnode;

typedef struct StGhtInst {
    CodUint8    slot;
    CodUint8    valid;
    CodUint16   vnodes;
    CodUint32   weight;
} GhtInst;

typedef struct StGhtRule {
    CodUint16   instCnt;                       /* active instance count */
    CodUint16   unused;
    CodUint8    logicMap[AXC_MAX_INSTANCES];   /* logic instance map */
    GhtInst     insts[AXC_MAX_INSTANCES];     /* instance info for hash table */
    GhtVnode    vnodes[GRC_MAX_VNODES];       /* vnode info array */
} GhtRule;
```

  


BO相关的数据结构

```
typedef struct StBoBucket{
	SpinLock  lock;
	CodUint32 first;			/* point to first buffer object */
} BoBucket;

typedef struct StBoList {
    CodUint32 count;
    CodUint32 first;
    CodUint32 last;
} BoList;

typedef struct StBoObject {
    CodUint64 dataOid;
    BufferCtrl* ctrl;          /* point to object first buffer ctrl */
    CodUint32 hashNext;        /* next buffer object */
    CodUint32 lruNext;         /* recycle list for object */
    CodUint32 lruPrev;         /* recycle list for object */
    CodUint32 flags;           /* valid object or not, bo is in recycle or not */
    AnkScn    objectScn;       /* system scn when object been invalidated, used for recycle  */
} BoObject;

typedef struct StBoContext {
    SpinLock   lock;
	BoObject*  objects;
    BoBuckets* buckets;
    CodUint32  capacity;
    CodUint32  usedCnt;
	BoList     lruList;
} BoContext;
```

# 接口设计

从当前需求的表现来看，对用户直接暴露的信息有SQL语法、系统表以及动态视图等。

### SQL语法

支持创建table/index以及对应的partition时指定对应的资源分布策略（仅在集群下生效，单机下同样会维护相关的系统表）

支持通过alter table/index进行对象的亲和策略设置，当前版本支持两种default和instance，未来考虑支持auto即基于统计的动态对象资源迁移（DRM）。

同时当前新增语法仅作用于用户表、索引对象，对于系统对象暂不支持。DDL执行提交时广播affinity policy，更新并维护各实例下的OHT的一致性，  **进行同步的资源迁移（由GMON进行）。**

```
alter table <table> set affinity policy instance <instance_id>;
alter table <table> set affinity policy default;
alter table <table> set partition <partition> affinity policy instance <instance_id>;
alter table <table> set partition <partition> affinity policy default;
alter table <table> set subpartition <partition> affinity policy instance <instance_id>;
alter table <table> set subpartition <partition> affinity policy default;
alter index <index> set affinity policy instance <instance_id>;
alter index <index> set affinity policy default;
alter index <index> set partition <partition> affinity policy instance <instance_id>;
alter index <index> set partition <partition> affinity policy default;
alter index <index> set subpartition <partition> affinity policy instance <instance_id>;
alter index <index> set subpartition <partition> affinity policy default;
```

### 系统表

所有的对象亲和策略变更，统一到同一个系统表中管理。当前系统表遵循通用的系统表加载规则， 在DC加载时加载。

系统表加载时，需要同步维护全局的OHT，  **进行同步的资源迁移（由GMON进行）**  。如果当前OHT与系统表中的策略一致，则不需要迁移。

```
CREATE TABLE GRC_AFFINITY_POLICY$
(
    DATAOBJ#     BINARY_BIGINT  NOT NULL,
    POLICY       BINARY_TINYINT NOT NULL,
    MASTER       BINARY_TINYINT NOT NULL,
    PREV_MASTER  BINARY_TINYINT NOT NULL,
    REMASTER_CNT BINARY_INTEGER NOT NULL,
    FLAGS        BINARY_BIGINT  NOT NULL
) SYSTEM 165 ORGANIZATION HEAP;

CREATE UNIQUE INDEX I_GRC_AFFINITY_POLICY1 ON GRC_AFFINITY_POLICY$(DATAOBJ#);
```

### 动态视图

动态视图在当前设计中是比较重要的观测手段，其承载了一些系统表中不具备的信息。其具备下面的关系：

GRC_AFFINITY_POLICY$ -> OHT -> V$GRC_AFFINITY_POLICY/GV$GRC_AFFINITY_POLICY

|列|列类型|列说明|
|---|---|---|
|DATA_OBJECT_ID|BINARY_BIGINT|对象的Data Object Id|
|POLICY|VARCHAR|DEFAULT，AUTO，AFFINITY|
|MASTER|BINARY_TINYINT|当前对象设置的master节点。|
|CURRENT_MASTER|BINARY_TINYINT|当前对象最新的master节点，master节点未启动时，current master为存活实例中的某一个。|
|PREVIOUS_MASTER|BINARY_TINYINT|当前对象的前一个master节点。|
|REMASTER_CNT|BINARY_INTEGER|记录对象发生remaster的次数。|
|STATUS|VARCHAR|REMASTER、IDLE|


动态视图是OHT的直观体现，其可以展示当前正在做资源迁移的信息，以及当前所有对象亲和的对象。

### 配置参数

- 新增隐藏配置参数_undo_affinity = TRUE | FALSE，用以显式开关undo亲和，重启生效，库级参数。
- 新增隐藏配置参数_buffer_objects = xxxx，用以显示控制buffer object的数量，重启生效，实例级参数。


# 场景设计

当前设计方案会对集群部分现有的处理场景下产生影响，如功能场景、并发场景、故障场景、性能场景等，需要分别展开设计。

## 功能场景设计

当前方案涉及到的功能主要分两方面：

- 一方面是新增功能的主要处理机制，新增功能主要包括SQL语法的行为，以及如何协调OHT和GHT算法。
- 另外一方面是已有功能的影响，已有功能包括正常的集群启动、停止，正常的缓冲区淘汰、刷盘，执行DDL等行为。


### SQL功能

主要通过SQL语法向用户提供对象管理的修改能力，一种是显示设置，另外一种是通过DDL进行变更

|功能|变化|功能表现|
|---|---|---|
|create object affinity policy|新增|- 采用统一的系统表GRC_AFFINITY_POLICY$进行管理，创建对象时同步记录到系统表中。
- 由于属于新创建对象，内存中没有相关的资源信息，仅在OHT上登记相关的对象信息并广播到其他实例。
|
|alter object set affinity policy|新增|- 对GRC_AFFINITY_POLICY$相关的记录进行变更，根据语句进行插入、修改。
- DDL进行系统表变更时，需要同步将变更信息同步到OHT上，并广播给所有实例。
- DDL进行系统表变更时，需要根据变更信息，加全局锁GRC Latch进行OHT相关的资源迁移，具体变更策略在后面展开。
- DDL执行  **触发后台异步资源迁移**  ，申请调度任务由GMON进行处理。
- 资源迁移完毕后，重新锁定GRC Latch进行OHT的修改，并完成最终的系统表变更。
|
|drop/truncate table|修改|- drop/truncate时，需要维护GRC_AFFINITY_POLICY$系统表，在二阶段释放空间之前将OHT中相关的Object删除。
- drop/truncate需要刷盘并失效所有实例内存中相关对象的页面，并最终注销所有的OHT管理的GRC resource。
- 缓冲区管理考虑增加Object链和Object脏页链，  **同步支持Object级别淘汰和脏页刷盘**  。
|
|shrink table|修改|- shrink  table与truncate不同，其释放空间但不改变dataOid，shrink修改BO上的SCN即可。
- 集群下释放的blocks需要进行全局对象刷盘和淘汰，不再受原始OHT/GHT管理。
- 当产生空间复用时，由新OHT/GHT管理。
- 当老查询访问释放空间时，由BO上SCN判断进行强制CR访问。
|


### GRC资源管理

全局资源管理采用OHT和GHT叠加的方式：

- 优先通过dataOid进行OHT的检索，如果OHT中含有对应的Object，则获取对应的master。
- 否则采用blockId进行GHT资源检索，此时肯定可以找到对应的资源master。


### OHT资源迁移

资源迁移时根据具体的策略变化，执行步骤有所区别：

|Current Policy|Previous Policy|Action|
|---|---|---|
|GHT|GHT|不需要处理，没有变化。|
|OHT|GHT|- gmon广播加全局GRC Latch锁。
- 扫描所有vnode管理的partition，在符合条件的GRC Resource上设置迁移标记。
- 将对应的Grc Resource、PastCopy, Request全部发送到对应的OHT节点。
- 迁移完毕后，GHT本地资源直接释放。
- 资源迁移完毕后释放GRC Latch锁。
|
|GHT|OHT|- gmon广播加全局GRC Latch锁。
- 扫描当前OHT的partition，在符合条件的GRC Resource上设置迁移标记。
- 将对应的res、pc、request全部发送到对应的GHT节点，迁移完毕后释放GRC Resource。
- 迁移后后，OHT管理资源直接释放。
- 资源迁移完毕后释放GRC Latch锁。
|
|OHT|OHT|直接做vnode类似的partition发送即可。|


当实例未启动时，可以在存活实例上通过SQL语法将资源迁移到当前实例，原则上可以通过SQL语法将资源迁移到任何集群内的有效实例，无论实例是否启动，此时依赖OHT托管的能力。

#### 缓冲区改造

缓冲区管理本身是存储管理的基座，其增加对象属性会有多方面的影响，从数据的类别来看，其处理有所不同。

|数据类型|缓冲区特点|改造难度|
|---|---|---|
|用户表数据|其管理与访问是通过游标进行的，且用户相关的对象信息可以从DC获取到。|较小，只需要传入对应的对象ID即可。|
|系统表数据|与用户表数据类似，访问同样通过游标进行。|较小，只需要传入对应的对象ID即可。|
|UNDO数据|每个实例具备独立的UNDO表空间，UNDO表空间只在当前实例下修改，低概率多实例访问。|需要内部定义UNDO表空间的对象ID。|
|管理数据|如表空间头、文件头、extent bitmap等页面，为多实例共有资源。|对象ID为无效ID，即不支持对象缓冲区管理。|


从缓冲区管理的接口类型来看，需要改造的接口共有以下几大类，概要设计中只关注大类：

|Buffer接口|接口分析|调用分析|
|---|---|---|
|bpAttachBlock|通用性的读取页面接口，面向各种复杂的读取场景。|**要求上层必须传入有效的dataOid与blockId。**|
|bpAttachBlockRa|普通页面预读类，面向的是各个业务场景。|- 接口本身改造没有风险，大部分可以获取到有效的dataOid。
- **极个别拿不到dataOid，要进行改造分析**  。
|
|bpAttachCRBlock|CR读取单个block，需要传入有效的dataOid。|接口本身改造没有风险，可以获取到有效的dataOid。|
|bpAttachCRBlockRa|CR预读类，需要传入有效的dataOid。|接口本身改造没有风险，可以获取到有效的dataOid。|
|bpTryAttachBlock|try attach本身只关注当前实例内的有效页面，对象ID是确定的，不会产生页面请求。|即使上层没有传递dataOid，也不影响使用。|


#### 节点启停

节点启停场景下，GHT按照现有的DHT重组集群规则，将GRC资源迁移到对应的存活节点。

启停节点如果涉及到current master或者master节点，需要进行OHT资源的变化，而对于集群首个节点启动同样有所不同。

|节点|行为|处理策略|
|---|---|---|
|cluster master|start|主节点启动时，默认没有任何OHT对象，当主节点OPEN后，此时主节点已经加载了所有的OHT对象，此后其他节点才能加入集群。|
|cluster master|stop|主节点停止意味着是最后一个停止的节点，此时不需要再进行资源迁移，直接停止即可。|
|current master|start|current master启动这种场景实际上是不存在的，current master一定是存活节点。|
|current master|stop|current master停止时，需要在所有剩余在线实例中找一个实例作为托管实例，将OHT资源以partition方式迁移过去。|
|master|start|master启动时，需要将对象所有相关的OHT资源从current master迁移回master节点。|
|master|stop|master停止时，需要找一个托管节点进行托管，与停止的GHT资源迁移同步进行。|


总结：

- 节点停止的变化本质上是将本节点管理的OHT资源托管给其他实例管理。
- 节点启动的变化本质上是将属于本节点管理的OHT资源迁移到当前节点管理。


## 并发设计

### OHT迁移与并发访问

正常运行过程中，基于对象的访问会通过OHT访问对应的master。根据前面的设计并不是所有场景下的迁移全部加了GRC的大锁，存在部分场景下无GRC大锁访问的情况。

当OHT的状态处于迁移状态时，并发的资源访问会有以下变化：

- 由GHT变为OHT，此时访问OHT时发现Grc Resource还不存在，此时可能对应的Grc Resource还在GHT管理的节点上。因此需要再根据GHT查找，如果GHT上对应的GRC Resource处于未迁移状态则直接访问，如果GHT上不存在，则在OHT上创建资源。
- 由OHT变为GHT，此时访问OHT时发现Grc Resource还不存在，去GHT上查找，如果GHT存在直接访问，GHT不存在，直接在GHT上创建。
- 由OHT变为OHT，由OHT到OHT的资源迁移原则上要做到同步的，原则上不存在并发访问。


总体策略为两边查找，都不存在时，在目标端创建资源，其中如果Grc Resource正处在迁移过程中则需要等待迁移完成。

### DDL与并发访问、空间复用

DDL在SQL功能层面已经展开设计，不再详细展开。

并发场景下，由于DDL不阻塞SELECT，因此旧的SELECT仍然可以访问老的数据，且SHRINK还属于一种特殊的DDL，其没有改变dataOid，但是会释放空间。

结合其他实例复用的并发查询场景，因此概括而言有以下几种并发场景：

|DDL|行为|并发分析|
|---|---|---|
|DROP/TRUNCATE|先查询后复用|老查询访问时数据都已经被刷盘，再次访问buffer通过判断BoObject已经被失效，直接以CR的方式请求，此时的查询通过读盘进行。|
||先复用后查询|老查询访问时数据都已经被刷盘，再次访问如果复用实例属于当前实例，则直接访问有效页面由上层报错。,如果复用实例属于其他实例，通过判断BoObject已经被失效，此时会进行CR读，  **如果复用的实例已经刷盘，则查询报错**  。|
|SHRINK|先查询后复用|老查询访问时数据都已经被刷盘，再次访问buffer通过判断BoObject的scn已经比查询scn大，直接以CR的方式请求，此时的查询通过读盘进行。|
||先复用后查询|老查询访问时数据都已经被刷盘，再次访问如果复用实例属于当前实例，则直接访问有效页面由上层报错。,如果复用实例属于其他实例，通过判断BoObject的scn已经比查询scn大，此时会进行CR读，  **如果复用的实例已经刷盘，则查询报错**  。|


### DDL与后台回滚

后台回滚没有加表锁，因此无法与drop/truncate做并发控制，shrink不需要考虑，因为shrink要给迁移数据会进行事务等待。

后台回滚读取已经被复用的页面时采用的是W的方式读取，通过BoObject很难直接判断，因为DDL属于上次运行的行为，本次启动没有加载BoObject。

因此考虑对所有涉及到对象类型的undo增加oid和dataOid，回滚过程中涉及到的block，通过下面逻辑处理：

- 如果对应的BoObject不存在，则通过oid读取obj$系统表的记录判断对象是否已经失效，并登记到bpObject上。
- 如果对应的BoObject还存在，则直接读取BoObject信息进行判断，通过报错返回给上层。


当发现对象已经失效此时buffer接口返回指定错误码，object已经被失效，由回滚上层进行跳过回滚处理。

## 故障设计

故障场景涉及到的设计会比较多，比如OHT资源管理的变化，在线恢复过程中对OHT的访问，整理如下：

|故障场景|故障分析|
|---|---|
|静态OHT节点故障|如果一个OHT资源对应的节点故障，此时此OHT资源Master会被托管到存活的节点上，通过在线资源恢复的方式进行恢复。|
|迁移过程中OHT节点故障|对于正在迁移的OHT资源，以对应的目标状态进行全局资源恢复即可，可以直接完成正在进行的OHT资源迁移。|
|集群重启日志恢复|重启日志恢复时，根据apply attach block日志中记录的dataOid进行GHT资源的恢复，在后续系统表加载后迁移到对应的OHT下。|
|在线日志恢复|在线日志恢复时，根据apply attach block日志中记录的dataOid进行OHT资源的恢复。实例再次加入后，只做object力度的迁移即可。|


## 性能设计

本设计对性能会有一定的影响，主要有以下几个方面:

1. 由DHT变为GHT，性能原则上会有一定的提升，特别是在3节点下资源分布会更均衡。
1. OHT的引入，即使没有使用OHT，对全局资源的访问要叠加OHT与GHT两套算法，性能会有一定的损耗。
1. Buffer考虑上  **增加master信息**  ，仅在version变化时重新计算master，减少对本地GHT和OHT的访问。
1. GRC_AFFINITY_POLICY$增加迁移的相关统计，为未来做DRM做铺垫。
1. 修改了redo的结构，attach block增加了dataOid，日志量增加，对单机、集群性能都有一定的影响。
1. 修改了undo的结构，undo的大小会变大，同样会单机、集群的性能有一定的影响，同时回滚过程中访问系统表，回滚效率有一定的下降。
1. 引入OHT后需要单独测试指定master到本实例后，单实例跑批业务的性能表现。


## 安全性设计

本特性新增了配置参数以及语法，配置参数权限受系统系统权限保护；语法主要是创建对象时扩展了属性，不涉及权限变更。

# 需求分解

基于上述概要设计，将本设计方案分解为以下几个SR。

|SR标题|SR内容|交付版本|产品形态|
|---|---|---|---|
|全局资源分布策略优化|由DHT算法优化为GHT算法。|23.3|集群|
|支持基于对象的缓冲区管理|1. 增加bp object管理
1. buffer+gcs改造
1. redo+undo结构改造
1. 所有buffer接口的改造(heap/btree/rtree/eds/swf/vgd/spf/xact/undo/ssm/assm/....)
1. drop/truncate/shrink改造
1. 视图改造
|23.3|单机、集群|
|集群支持undo亲和|1. OHT能力构建
1. UNDO与OHT对接
1. 启停（reform）、托管
1. 故障场景的OHT恢复
|23.3|集群|
|集群支持指定对象资源主节点|1. DDL与系统表
1. 在线全局OHT的维护与系统表对接
1. 在线资源迁移与并发访问
1. 资源迁移与节点启停
1. 资源迁移与节点故障
|23.4|集群|
|集群支持缓冲区异步淘汰|- buffer与本地GcsLock解耦
- 支持缓冲区的异步淘汰，后台异步清理master信息
|23.4|集群|
|remaster资源恢复优化|- remaster优化为不清除所有的master信息，改为清除故障节点信息
- 重建非故障节点对应的故障节点管理的master信息
|23.4|集群|
|集群支持异步对象资源迁移|支持后台异步资源迁移任务调度机制|23.4|集群|
|GRC内存管理优化|GRC Resource、GCS Resource以及GLS Resource|23.4|集群|


  


  


## Attachments:

[GHT.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWM4OTcwYzJhZjRmNTIxYzY1IiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.UO2AD0ROvg-CDhAIxs4XHRMf1R9zP21HEV5mhcPsDDM)

 (image/png)    


[GHT.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWM4OTcwYzJhZjRmNTIxYzY2IiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.vXN45sBIQh3r3-iQo3ddRNikgQieukbdnqetaEb3SVY)

 (image/png)    


[shadowMaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWM4OTcwYzJhZjRmNTIxYzY4IiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.qKRuWHrtduj2T217dRSaNfF6E3kNyg1XkMJKTitX7j0)

 (image/png)    


[shadowMaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWM4OTcwYzJhZjRmNTIxYzZhIiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.fc8_6me5dlI46oTPAGf5Ld57msuuN97CsVDAgVxjd7I)

 (image/png)    


[shadowMaster2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWM4OTcwYzJhZjRmNTIxYzZiIiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.C3Wcp7fS9CtTI4RlCefIs7MxNpEfhOhwzqMZLPl6pIY)

 (image/png)    


[shadowMaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWM4OTcwYzJhZjRmNTIxYzZjIiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.yu-G2Rarp-KVIpxzWwfGBhcB8p402tYnRRZT3aaoUYA)

 (image/png)    


[shadowMaster2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWNhMWFkOWEzMzExZGM5YWRjIiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.8nJyrQGuZ1V3qeO8YpjuYalJrZRd5VtBF-ctsqAqdbM)

 (image/png)    


[buffer_object.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWM4OTcwYzJhZjRmNTIxYzZkIiwicmVmX2lkIjoiNjczOTZlZWM3MjgyMDZlZmI5MmYyZTU3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDU0LCJleHAiOjE3ODI1NDI4NTR9.tLyMPpaVZYhefXphSegTaabupr8ygaQcXF-vu6gZIkY)

 (image/png)    
