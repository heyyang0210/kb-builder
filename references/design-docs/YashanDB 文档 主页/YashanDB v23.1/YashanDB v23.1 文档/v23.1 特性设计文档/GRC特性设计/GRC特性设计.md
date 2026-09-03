Created by 孟凡彬, last modified on 五月 16, 2023

# GRC详细方案设计

|SR|SR说明|
|---|---|
|  [YDBRD-13408](https://jira.yasdb.com/browse/YDBRD-13408?src=confmacro)    -  【共享集群】支持全局资源管理  完成|GRC的基础特性，提供基础的资源管理、资源并发控制等。,  
|
|  [YDBRD-13409](https://jira.yasdb.com/browse/YDBRD-13409?src=confmacro)    -  【共享集群】全局资源内存管理  完成|SGA管理GRC相关资源内存，避免出现不受控、小内存分配。|


## 1. Overview（概述）

基于GRC的概要设计方案，本设计着重阐述GRC的关键数据结构设计与关键流程方案，以及内存管理策略的调整。

动态视图、分布式资源策略在其他SR中设计。

## 2. Features（功能性）

### 全局资源元数据管理

当前版本采用一致性哈希算法，将全局资源的元数据信息分散到各个实例上管理，每一个资源有且仅有一份resource metadata。各个上层模块通过GRC提供的计算master的接口，获取资源元数据所在的master，发送请求到对应的实例。

资源主实例，通过资源排队机制，处理来自各个实例的资源请求。

### 全局资源内存管理

通过哈希算法计算出来的是资源的主节点，resource metaData初始化是没有分配的，第一次访问是会进行resource metaData的创建和初始化。

大量的资源访问，会频繁导致metaData的申请和释放，为了避免碎片化的内存分配和回收，将resource metaData以及enqueue request等纳入到SGA中管理。

## 3. Interfaces（接口）

### 对外提供视图

|函数名称|功能描述|
|---|---|
|V$CLUSTER_MESSAGE_STAT|新增集群消息统计视图，主要面向当前特性辅助的性能调优。列说明如下：,- ID，当前消息类型对应序列号ID
- NAME，消息的名字
- TASK_TYPE，调度消息的类型(fgtask 0, grctask 1, gcstask 2, glstask 3, reformtask 4, batch task 5, sync task 6）
- TIMES，消息处理成功的次数，
- FAILED_TIMES，消息处理失败的次数
- TOTAL_COSTS，消息处理成功的总耗时，单位微秒
- AVG_COST, 消息处理成功的平均耗时，单位微秒
- MAX_COST，消息处理成功的最长耗时
|
|V$SYSTEM_EVENT|基于性能调优考虑，新增以下等待事件：,- gc upgrade grant，锁升级授权读block事件
- get remote xact status，获取远程事务状态事件
- get remote xact info，获取远程事务信息事件
- remote xact wait，远程事务等待事件
|
|V$SYSSTAT|基于性能调优考虑，新增以下全局资源请求耗时统计：,- GC CURRENT BLOCK RECEIVE TIME，请求当前到接收到block的耗时
- GC CR BLOCK RECEIVE TIME，请求当前到接收到cr block的耗时
- GC LOCAL GRANT TIME，请求本地授权读耗时
- GC REMOTE GRANT TIME，请求远端授权读耗时
- GC LOCAL CR GRANTS，请求本地CR授权读block次数
- GC LOCAL GRANT TIME，请求本地CR授权读block耗时
- GC REMOTE CR GRANTS，请求远端CR授权读block次数
- GC REMOTE CR GRANT TIME，请求远端CR授权读block耗时
- GC LOCAL UPGRADE TIME，请求本地block锁升级耗时
- GC REMOTE UPGRADE TIME，请求远端block锁升级耗时
- GET REMOTE XACT STATUS，获取远端事务状态次数
- GET REMOTE XACT STATUS TIME，获取远端事务状态耗时
- GET REMOTE XACT INFO，获取远端事务信息次数
- GET REMOTE XACT INFO TIME，获取远端事务信息耗时
- REMOTE XACT WAITS，等待远端事务次数
- REMOTE XACT WAIT TIME，等待远端事务耗时
|


### 对外提供的参数

|参数名字|默认值|范围|含义|
|---|---|---|---|
|GCS_TASK_COUNT,  
|2|2 ~ 64|处理GCS相关的请求，如根据优先级策略，选择合适的owner响应请求，构建CR block，授权读block。|
|GLS_TASK_COUNT|2|2 ~ 64|处理GLS相关的请求，失效本地锁，通知其他owner实例失效锁，授权加锁。|
|GRC_TASK_COUNT|2|2 ~ 16|处理资源请求以及排队处理。|


## 4. Specification And Constraints（规格与约束）

- 首版本不支持线程自动弹性扩展。
- 不支持基于对象ID的全局资源分布，对buffer进行改造难度以及工作量都比较大。
- 当前特性不支持资源请求死锁检测。


## 5. Detail Design （详细设计）

### 5.1 元数据管理

```
typedef struct StGrcMetadata {
    CodUint32  id;         // resource id
    CodUint32  next;       // hash list next when allocated, free list next when freed
    GrcResName name;       // block id is valid if resType is block resource, otherwise lock id is valid
    CodBool    inProcess;  // a request is being processed
    CodBool    isValid;
    CodUint8   unused[6];
    CodUint8   resType;     // resource type: block resource or non-block resource
    CodUint8   refCount;    // decide whether the resource can be recycled
    CodUint8   xOwner;      // current X owner of the resource
    CodUint8   ownerCount;  // owner count of the resource
    CodUint32  pastCopy;    // the least past copy of the resource
    CodUint64  ownerMap;    // owner map of the resource
    CodUint64  pcOwnerMap;  // owner map of past copy
    GrcRequest request;     // converting request
    GrmList    reqList;     // queued request list when converting
} GrcMetadata;
```

当前版本没有区分GCS和GLS资源，两种资源类型用统一的数据结构来管理。

对于GCS而言，其有past copy以及Xowner的概念，对于GLS而言，只有X、S、null锁，如果是X锁，那么owner只有一个。

### 5.2 消息流转换 

下图给出了4中常见的消息流转换，实例角色总共有三种：master、requester，owner。

![](https://pingcode.yasdb.com/atlas/files/public/67396a338970c2af4f51fd0d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUVBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFDSUFBQUFXQVFEQUFBQUFBQUJBQUFBQUFBRUFBQUFBQUFnQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MzksImV4cCI6MTc4MjIyMjQzOX0.CEIYcExnZr-POBOuKTdBWaJ4L428SFR9u0rXsnaqpcM)

其中当一个实例承担多个角色时，由于是多线程架构，可以直接操作对应的资源信息，比如requester的处理流程中可以直接访问master资源。

闭环消息会改变master上的持有者状态，并且推动下一个排队的消息处理。

### 5.3 线程调度管理

总体设计中描述了各个线程锁承担的职责，对于实例角色与各个线程调度关系并没有展开详细的设计。

下面以三实例下的block请求为例，描述各实例下的线程如何协调完成GCS的请求。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396a338970c2af4f51fd0e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUVBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFDSUFBQUFXQVFEQUFBQUFBQUJBQUFBQUFBRUFBQUFBQUFnQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MzksImV4cCI6MTc4MjIyMjQzOX0.CEIYcExnZr-POBOuKTdBWaJ4L428SFR9u0rXsnaqpcM)

1. 实例1执行查询语句，访问的block不在本地，发送请求到master实例2。
1. 实例2上的GRC_TASK根据请求资源名字，找到对应的资源进入排队处理，  ~~GRC_TASK将转换过的请求转交给本实例的GCS_TASK。~~
1. GRC_TASK根据当前的资源处理策略，通知block的owner实例3去处理请求。注意：这里如果master也是owner时，GRC_TASK会通知本实例的GCS_TASK处理请求。
1. 实例3上的GCS_TASK响应来自master发送的请求，读取block并发送给requester实例1。
1. 实例1的会话接收到block后，发送close消息给实例2，实例2的GRC_TASK登记新的owner信息，并唤醒下一个请求。


### 5.3 内存管理

GRC的资源管理是按照partition进行的，partition的内存管理单元为Grm Context，Grm Context的内存分配颗粒为Chunk，每个chunk为1024个element。

内存主体来自SGA，根据data Buffer大小，默认会从SGA中申请部分chunk进行预留分配。对于动态托管的partition内存采用malloc的方式进行管理，主要考虑因素是当前SGA不支持动态分配和回收内存。

![](https://pingcode.yasdb.com/atlas/files/public/67396a338970c2af4f51fd10/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUVBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFDSUFBQUFXQVFEQUFBQUFBQUJBQUFBQUFBRUFBQUFBQUFnQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MzksImV4cCI6MTc4MjIyMjQzOX0.CEIYcExnZr-POBOuKTdBWaJ4L428SFR9u0rXsnaqpcM)

SGA管理的GRC相关的有GCS Resources，GCS Pastcopy，GCS Requests，GLS Resources，GLS Requests。

- 对于GCS资源，默认从SGA中分配的个数为dataBuffer的数量，动态扩展内存通过malloc进行。
- 对于GLS资源，默认从SGA的分配个数为lock的个数，动态扩展内存通过malloc进行。


## 6. Testcases（自测用例）

## 7. 资料设计章节

内部机制，不涉及相关资料修改；后续对于共享集群提供单独的章节进行统一介绍。

参数、视图刷新对应的资料文档。

## 8. TODO（遗留问题）

增加独立的GRC_TASK处理线程，平衡各种资源请求排队处理时间。

  


## Attachments:

[instanceRole.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMzJhMWFkOWEzMzExZGM3YjgxIiwicmVmX2lkIjoiNjczOTZhMzI3MjgyMDZlZmI5MmVmYjg1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNjM4LCJleHAiOjE3ODIyOTgwMzh9.DBZSfdfpEpjIBhCwoF4UTIfF5rbRuWBWnr89YF2EKfg)

 (image/jpeg)    


[memory.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMzNhMWFkOWEzMzExZGM3YjgyIiwicmVmX2lkIjoiNjczOTZhMzI3MjgyMDZlZmI5MmVmYjg1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNjM4LCJleHAiOjE3ODIyOTgwMzh9.Rm0lKY9pfDdqgzrV2OPDFs0wyk9tupNlTH_1_BffTA8)

 (image/jpeg)    


## Comments:

|  [](null)  ,增加GCS block视图，资源ID要与ROWID可以直接映射起来。,Posted by mengfanbin at 五月 09, 2023 16:49|
|---|
|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396a33a1ad9a3311dc7b87/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUVBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFCQUFBQUFDSUFBQUFXQVFEQUFBQUFBQUJBQUFBQUFBRUFBQUFBQUFnQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE2MzksImV4cCI6MTc4MjIyMjQzOX0.CEIYcExnZr-POBOuKTdBWaJ4L428SFR9u0rXsnaqpcM),Posted by lizuolong at 七月 23, 2024 14:59|
|  [](null)  ,在DHT算法下，GrmPool的chunk大小具体取决于GrmContext要管理的实体对象；,后续更新到GHT算法后，chunk大小统一成8K/16K（目前还未合入，具体待定）,Posted by lizuolong at 七月 26, 2024 09:47|
