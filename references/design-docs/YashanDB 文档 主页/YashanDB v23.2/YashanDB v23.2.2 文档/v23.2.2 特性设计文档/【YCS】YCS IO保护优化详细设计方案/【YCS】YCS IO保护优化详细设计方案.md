Created by 李垠, last modified on 十一月 08, 2024

#   [YCS IO保护优化详细设计方案](#ycs-io保护优化详细设计方案)  

SR链接:     [YDBRD-21560](https://jira.yasdb.com/browse/YDBRD-21385)    IR链接:     [YDBRD-20565](https://jira.yasdb.com/browse/YDBRD-20565)  

##   [1. 总述](#1-总述)  

IO保护功能的工作原理是将IO数量记录下来并写到磁盘中，当集群选举完成，新主产生后，由新主检测磁盘中原db主的在途IO数，当这个数量为0时，新主才能正式升主，通过这种方式防止db原主和db新主的写冲突问题。旧方案存在一个缺陷，就是当db原主的在途IO产生后到写盘完成的时间内，新ycs主无法读取到这个在途IO数，认为db原主不存在在途IO而直接升主，这种情况属于IO保护失效，可能造成写坏数据块的问题。

###   [1.1 需求来源](#11-需求来源)  

部署形态：共享集群

内部需求，提高集群产品健壮性。

###   [1.2 调研文档](#12-调研文档)  

优化方案，不涉及调研文档

###   [1.3 需求分析](#13-需求分析)  

|功能|方案设计|关键技术点|特性是否涉及|备注|
|---|---|---|---|---|
|db io保护优化|db的第一个io请求确保io数量写盘后再处理io|1、io数目写盘再处理io；2、io请求中检测读盘hang住的故障，如果读盘hang住超过磁盘心跳则重新读盘|是||
|yfs io保护优化|yfs的第一个io请求确保io数量写盘后再处理io|1、io数目写盘再处理io；2、io请求中检测读盘hang住的故障，如果读盘hang住超过磁盘心跳则重新读盘|是||


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

无对外接口设计

##   [3. 规格与约束](#3-规格与约束)  

|规格/约束项|类型|规格、约束|原理说明|备注|竞品分析|
|---|---|---|---|---|---|
|性能|规格|可能会影响性能，根据实际测试结果确定影响程度|io请求增加了一步：io从0变为非零时，io数目写到ycs盘再处理io请求，可能会影响性能||不涉及|
||规格|RTO变长|投票后升主，需要等待io数目为0或者超时，即RTO可能增加一个磁盘心跳超时时间|超时时间由DISK_HB_KEEP_ALIVE配置参数指定|不涉及|
||规格|IO数目从0变为非零需要先将数目写盘再处理IO，从非零递增或递减不需要等待IO数目写盘|IO数目从0变为非零需要先将数目写盘再处理IO，从非零递增或递减不需要等待IO数目写盘||不涉及|
||约束|此方案能降低Kill -19，kill -18后发生双主的概率但不能100%解决|io请求流程中，在开始IO前，会检测上一次读盘时间，并判断是否存在卡住的情况，若存在则做出相应处理。但是如果在这一步处理后到nzwFlushed为true（途径1是内存中的io数为0；途径2是io数写盘完成）之前备升主完成，然后又kill -18，则这种检测机制被跳过，会发生双主问题||不涉及|


##   [4. 特性](#4-特性)  

###   [4.1 yfs IO保护流程](#41-yfs-io保护流程)  

####   [4.1.1 yfs io请求流程](#411-yfs-io请求流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ccda1ad9a3311dc8cda/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFCQUFBQUFBQUFBSUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFnQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFDRUFBRUFBUUFDQUFBQUFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1NzEsImV4cCI6MTc4MjMxNDM3MX0.jZeYYJSx0mQaEKXaZwa5ai0ZntlOMtCwQQ3h0s0dXqs)

如图所示，yfs 在写盘时，采用叫做”安全写“的方法，强制将第一个io请求的io数目写入ycs盘后，在执行io操作，防止其他节点读不到这个节点的yfs io数目。  **图中蓝色框属于危险区域，如果kill -19卡在蓝色区域，kill -18时备升主发生在蓝色区域，则可能出现双主问题**  。

- 读ycs盘时记录读取时间，每次io请求时，检查这个时间与当前的差值，超过磁盘心跳超时，就读取ycs盘，以获得最新的master，一定程度上防止kill -19/18场景下，原主不知道备已经升主而导致的双主问题。
- 检测到master不是自己时，说明集群发生了备升主，当前节点是旧主，此时返回错误。
- 当io数目从0变为非0时（通过标记位nzwFlushed表示这种情况），强制将io数目写盘，并阻塞后序io请求，直到本次强制写盘完成。
- 当io数目从非0递增时（通过标记位nzwFlushed表示这种情况），不需要强制写盘。
- 每进来一个io请求，writeCount增1。
- io数目写盘后，设置标志位nzwWaitFlush，放行后序io请求。
- 磁盘心跳流程中，周期性的将writeCount写入ycs盘（当io数目从0变为非0时强制写ycs盘，从非0递增时不需要强制写盘，依靠磁盘心跳流程周期写盘）


####   [4.1.2 ycs备升主流程](#412-ycs备升主流程)  

对于投票产生的新主，有以下处理流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396ccd8970c2af4f520e6b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFCQUFBQUFBQUFBSUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFnQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFDRUFBRUFBUUFDQUFBQUFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1NzEsImV4cCI6MTc4MjMxNDM3MX0.jZeYYJSx0mQaEKXaZwa5ai0ZntlOMtCwQQ3h0s0dXqs)

如图所示，ycs投票后的处理流程中，在更新topo前，先检查所有节点的yfs io数目是否为0，如果不为0需要等到为0或者超时，然后再更新topo。

####   [4.1.3 数据结构设计](#413-数据结构设计)  

结构StYcsContext 中新增两个函数指针beginWrite和endWrite，yfs启动时初始化这两个函数，yfs io请求开始和结束时调用这两个函数，实现yfs io数目写盘相关操作。

```

typedef struct StYcsContext {
    // filled by YCS
...

    YcsBeginWrite       beginWrite;
    YcsEndWrite         endWrite;
...


```

StYcsInstance 结构中增加writeCount、nzwWaitFlush和nzwFlushed三个成员，writeCount记录yfs io数目。

nzwWaitFlush表示io请求是否需要等待，当io数目增加时，设置为真，表示后续得io请求需要等待；当io数目完成写盘后，此变量设置为假表示不需要等待，后续io请求可以通行。

nzwFlushed的用于控制io数目从0变为非零时强制写盘。当io数目为0时设置为假，使io请求开始时，将io数目强制写盘，然后设置为真，使后续io请求（io数目从非零开始递增）能够直接处理不需要io数目强制写盘。

```
typedef struct StYcsInstance {
...

    volatile CodUint32  writeCount;
    volatile CodBool    nzwWaitFlush;
    volatile CodBool    nzwFlushed;
...

} YcsInstance;


```

StYcsNodeCtrl是ycs盘的内存结构，增加变量writeCount，表示yfs io数目。

```
typedef struct StYcsNodeCtrl{
...
    CodUint32 writeCount;      // yfs write request count
...
} YcsNodeCtrl;


```

结构StYcsClusterMngr 中新增lastReadTick。

```
typedef struct StYcsClusterMngr {
...
    CodUint64         lastReadTick;  // tick of last success read voting disk
...
} YcsClusterMngr;


```

###   [4.2 db IO保护流程](#42-db-io保护流程)  

####   [4.2.1 特性流程设计](#421-特性流程设计)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ccd8970c2af4f520e6c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFCQUFBQUFBQUFBSUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFnQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFDRUFBRUFBUUFDQUFBQUFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM1NzEsImV4cCI6MTc4MjMxNDM3MX0.jZeYYJSx0mQaEKXaZwa5ai0ZntlOMtCwQQ3h0s0dXqs)

如图所示，db io请求开始时，强制将第一个io请求的io数目写入ycs盘后，在执行io操作，防止其他节点读不到这个节点的db io数目。  **图中蓝色框属于危险区域，如果kill -19卡在蓝色区域，kill -18时备升主完成并且db在topo中被设置为离线发生在蓝色区域，则可能出现写坏数据块的问题**  。

- db磁盘心跳中将writeCount写入ycs盘，并更新lastRead。
- 原来使用writeRef的地方用writeCount替代，流程不变。详见：    [https://conf.yasdb.com/pages/viewpage.action?pageId=133575533](https://conf.yasdb.com/pages/viewpage.action?pageId=133575533)  
- db io请求结束时，writeCount减1，逻辑简单，流程图省略。
- db io请求开始时，检测ycs是否被驱逐，如果是则返回错误，不处理本次io请求。
- 当io数目从0变为非0时（通过标记位nzwFlushed表示这种情况），强制将io数目写盘，并阻塞后序io请求，直到本次强制写盘完成。
- 当io数目从非0递增时（通过标记位nzwFlushed表示这种情况），不需要强制写盘。
- 每进来一个io请求，writeCount增1。
- io数目写盘后，设置标志位nzwWaitFlush，放行后序io请求。


####   [4.2.2 数据结构设计](#422-数据结构设计)  

nzwWaitFlush表示io请求是否需要等待，当io数目增加时，设置为真，表示后续得io请求需要等待；当io数目完成写盘后，此变量设置为假表示不需要等待，后续io请求可以通行。

nzwFlushed的用于控制io数目从0变为非零时强制写盘。当io数目为0时设置为假，使io请求开始时，将io数目强制写盘，然后设置为真，使后续io请求（io数目从非零开始递增）能够直接处理不需要io数目强制写盘。

writeCount表示db io数目（这个变量替换掉原来的writeRef）。

lastBeat 最近一次写入db磁盘心跳的时间。

lastRead最近一次读db磁盘心跳的时间。

ycs 从这个结构中用于获得系统时间。

```
typedef struct StYcscDiskHBCtx {
    SpinLock     lock;
    CodThreadLock diskLock;
...

    volatile CodBool    nzwWaitFlush;      // wait until non-zero-writeCount(nzw) flushed to disk
    volatile CodBool    nzwFlushed;        // non-zero-writeCount(nzw) is already flushed to disk
    volatile CodUint32  writeCount;
...
    CodDate      lastBeat;                 // last datetime write heart beat
    CodDate      lastRead;                 // last datetime read heart beat
...
    CodChar*     resBuf;
    YcsContext*  ycs;
} YcscDiskHBCtx;


```

diskhbkeepalive db与ycs握手时，ycs将这个配置参数传给db，用于判断读盘卡住超时的超时时间。

```
typedef struct StYcsContext {
...
    CodUint32           diskhbkeepalive;
...

typedef struct StYcsShakingAck {
...
    volatile CodBool callback;    // call back ycs function
    CodUint32 diskhbkeepalive;


```

StYfsiIntance 和YfsiFuncSet 用于db启动时，传入initYCS函数，此函数意图将YcsContext*  ycs赋值给yfs，后面yfs在处理db的io请求时，从这个ycs结构中获得系统时间。

```
typedef struct StYfsiIntance {
...
volatile CodBool callback;    // call back ycs function
    YcsContext*   ycs;

typedef struct YfsiFuncSet {
    YfsiInitYCS        initYCS;

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

注意ycs需要开debug日志

|用例名称|用例步骤描述|期望|实际结果|备注|
|---|---|---|---|---|
|RTO测试|RTO测试|首先摸底，然后根据实际情况确定RTO基线|||
|性能测试|性能测试|性能不劣化|||
|ycsdump工具功能测试|ycsdump工具功能测试|功能正常|||
|【db用例一】ycs、db磁盘心跳卡住（模拟kill 19/18发生在绿色区域）|执行业务，设置故障点YCS_FAULT_POINT_61，同时设置YCS_FAULT_POINT_65（卡住主db磁盘心跳并且不会占有spinlock），主ycs的YCS_RM_FAULT_POINT_27（ycs磁盘心跳卡住）故障点，触发备升主，备升主后，取消所有故障点|日志报错begin write failed, failde to check node evicted，不会出现双主，不core|2024-02-29 17:40:41.890 6114 [ERROR][errno=-0001]: [YCSC] begin write failed, failde to check node evicted [ycs_client.c:1295]||
|【db用例二】db前序db io未完成写盘|执行业务，设置故障点YCS_FAULT_POINT_62，业务卡住|设置故障点时，日志中打印[YCSC] wait pre io flushed, writeCount，注意该故障无法恢复|2024-03-04 16:27:26.734 15866 [DEBUG] [YCSC] wait pre io flushed, writeCount:0 [ycs_client.c:1285]||
|db/yfs io 数从非零递增|执行业务，观察ycs日志|业务执行成功，日志中[YCS] begin write, not force writeCount后面打印的数目必须是大于0。观察是否产生core文件，不产生core文件为正确|begin write, not force writeCount:1||
|db io保护门槛用例|详见用例||||
|【yfs用例一】(验证yfs io 保护)ycs磁盘心跳卡住（模拟kill 19/18发生在绿色区域）|执行业务，设置故障点YCS_FAULT_POINT_61，设置主ycs的YCS_FAULT_POINT_64（ycs磁盘心跳卡住但不持有锁）故障点，触发备升主，备升主后，取消所有故障点|日志报错2024-03-19 12:15:15.010 17898 [ERROR][errno=-0001]: [YCS RM]yfs begin write failed, master is not self [ycs_resource.c:115]，不会出现双主，不core|2024-03-19 12:15:15.010 17898 [ERROR][errno=-0001]: [YCS RM]yfs begin write failed, master is not self [ycs_resource.c:115]]||
|【yfs用例二】yfs前序yfs io未完成写盘|执行业务，设置故障点YCS_FAULT_POINT_62，业务卡住，观察ycs日志|设置故障点时，日志中打印wait pre io flushed, writeCount:0，注意，此故障点无法恢复|2024-03-19 12:26:52.289 18760 [DEBUG] [YCS] wait pre io flushed, writeCount:0 [ycs_ycr.c:1671]]||
|【yfs用例四】备升主等待yfs的IO为0|设置故障点YCS_FAULT_POINT_63，执行业务，设置磁盘心跳卡住故障点，备升主后，新主的日志中记录等待旧主yfs io为0的内容|设置写完yfs writeCount后卡住的故障点YCS_FAULT_POINT_63,然后执行业务，kill -19主ycs，备升主后查看日志|备升主等待原主yfs io结束的日志，等待时长大约30s 2024-03-05 12:04:39.653 6952 [ERROR][errno=-0001]: [YCS]check ongoing write, node 0's is 1 [ycs_diskhb.c:239] ... 2024-03-05 12:05:08.666 6952 [ERROR][errno=-0001]: [YCS]check ongoing write, node 0's is 1 [ycs_diskhb.c:239]  2024-03-05 12:05:09.666 6952 [ERROR][errno=-0001]: [YCS] check ongoing write, there is ongoing write node [ycs_diskhb.c:252]||


用例触发方法详见    [https://conf.yasdb.com/pages/viewpage.action?pageId=144144451](https://conf.yasdb.com/pages/viewpage.action?pageId=144144451)  

##   [6.资料设计章节](#6资料设计章节)  

参数说明中强调，IO操作的时延如果大于该参数设置，可能导致写冲突损坏数据。

##   [7.未来规划](#7未来规划)  

oracle的对于投票盘的读写是放在asm中管理的，这样有个好处，就是当发生写投票盘卡住时，可以将节点与投票盘离线，如果后面卡顿情况缓解，节点能够再次写盘时，会发现无法写盘，这样看起来能够彻底解决kill -19/-18问题，具体情况有待分析，ycs和yfs可以考虑向这个方向演进。

## Attachments:

[yfsio保护.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2NhMWFkOWEzMzExZGM4Y2NlIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.soDfpwFtjQbvuLE4Tvcr3Yi2iF78vTO9laH96DolEOA)

 (image/png)    


[yfsio保护.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2NhMWFkOWEzMzExZGM4Y2NmIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.f1MwgAI6INgQ9QKkn0euxPU5ek_YHLhONA0NYlm7xXY)

 (image/png)    


[yfsio保护.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2M4OTcwYzJhZjRmNTIwZTVmIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.kOog1KGpj62jncC4grc4_wkwQ_myu_e-0uXqk5J_fo4)

 (image/png)    


[yfsio保护.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2NhMWFkOWEzMzExZGM4Y2QwIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.pLMBhIV-JqPnDZX3ysUuKwrVPU0iAaNvk3y4cGypWK8)

 (image/png)    


[yfsio保护.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2M4OTcwYzJhZjRmNTIwZTYwIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.r-PuW474_Cmx3LLGDTt_7k4XjOKimJAsKAvL7eOes-M)

 (image/png)    


[yfsio保护.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2NhMWFkOWEzMzExZGM4Y2QyIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.6zCV0cT0wMUkRngdLcoi_HpiN_KuxF5N1fQkpPmInsw)

 (application/octet-stream)    


[备升主.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2M4OTcwYzJhZjRmNTIwZTYyIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.CUrEyg44dCkS15pWEVLkmB1tzVIp2QZbcngzjEY1HI8)

 (application/octet-stream)    


[备升主.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2M4OTcwYzJhZjRmNTIwZTYzIiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.x3uLPMXpumXlzUWDOkQgg4PAGfBD4auOt4f9grn3jpo)

 (image/png)    


[备升主.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2NhMWFkOWEzMzExZGM4Y2Q1IiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.IVO5-J5omlZ6yqT6QrOheCoJDagM_6ZZcVPn0AqOcFU)

 (application/octet-stream)    


[dbio保护.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2RhMWFkOWEzMzExZGM4Y2Q2IiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.6lutX2xzrNV-JNk39JXunCu8VpOvjJqhbi5ZitxCJSs)

 (application/octet-stream)    


[dbio保护.drawio](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2RhMWFkOWEzMzExZGM4Y2Q4IiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.2-9eDK8a1IEC7fiN_QK0FEcpqsq-U-0Srvdy8c_I5Uc)

 (application/octet-stream)    


[dbio保护.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjY2RhMWFkOWEzMzExZGM4Y2Q5IiwicmVmX2lkIjoiNjczOTZjY2M3MjgyMDZlZmI5MmYxNmIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNTcxLCJleHAiOjE3ODIzODk5NzF9.c6e9GsgZjhtgOdLqzTuup1GUrl_etmO6DAw_eEYuyYw)

 (image/png)    
