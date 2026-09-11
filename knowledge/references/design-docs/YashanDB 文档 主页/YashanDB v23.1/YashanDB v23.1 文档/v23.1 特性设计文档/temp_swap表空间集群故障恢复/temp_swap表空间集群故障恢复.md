Created by 郭藏龙, last modified by  李道一 on 八月 03, 2023

##   [1. Overview（概述）](#1-overview概述)  

有实例退出集群时，需要释放其占用的temp/swap表空间，分为两种情况：

- 实例异常退出：由托管实例负责释放，由于temp/swap空间占用是内存信息，所以托管实例通过存活实例的占用信息，间接处理故障实例
- 实例shutdown退出：由当前实例自己释放temp/swap空间


##   [2. Features（功能特性）](#2-features功能特性)  

##   [3. Interfaces（接口）](#3-interfaces接口)  

新增视图v$temp_extent_pool 查看temporary extent分配情况

一个临时表空间可以有多个数据文件

|列名|数据类型|描述|
|---|---|---|
|TABLESPACE_NAME|DTYPE_VARCHAR|表空间名称|
|FILE_ID|DTYPE_INTEGER|数据文件全局ID|
|EXTENTS_CACHED|DTYPE_NUMBER|已缓存的临时表空间extent数量|
|EXTENTS_USED|DTYPE_NUMBER|已使用的临时表空间extent数量|
|BLOCKS_CACHED|DTYPE_NUMBER|已缓存的临时表空间block数量|
|BLOCKS_USED|DTYPE_NUMBER|已使用的临时表空间block数量|
|BYTES_CACHED|DTYPE_NUMBER|已缓存的字节数|
|BYTES_USED|DTYPE_NUMBER|已使用的字节数|
|INTER_FNO|DTYPE_INTEGER|数据文件在表空间内的文件ID|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Temporary Extent Map](#51-temporary-extent-map)  

引入Temporary Extent Map(TEM)来记录当前实例占用的temp extent(所有isTemp属性表空间的extent，例如临时表空间和swap表空间) 。

#####   [5.1.1 TEM结构](#511-tem结构)  

TEM挂在    `SpaceManager`    下，有以下层次结构

-   `StTempExtentMap`    ，包括一个bucket数组
-   `StTempExtBucket`    ，包括一个spinLock、一个firstBlock链表、一个freeBlock指针
- 每个bucket，有若干个从data buffer里申请来的block及其ctrl，block里存放记录
-   `StTempExtItem`    ，包括block id，和64位标记位


```
/* BufferCtrlBase下的union新增 */
struct {
    struct StBufferCtrlBase* mapBlkPrev;
    struct StBufferCtrlBase* mapBlkNext;
    CodUint32 usedCnt;
    CodUint32 freeCnt;
    /* used for temporary extend map */
};

typedef struct StTempExtItem {
    BlockId     blockId;
    union {
        CodUint64 flags;
        struct {
            CodUint64 cached: 1;
            CodUint64 used:   1;
            CodUint64 unused: 62;
        };
    };
} TempExtItem;

typedef struct StTempExtBucket {
    SpinLock    bucketLock;
    BufferCtrl* firstBlock;     /* first block in bucket list */
    BufferCtrl* freeBlock;      /* one of the free blocks in bucket list (maybe not the first) */
} TempExtBucket;

typedef struct StTempExtentMap {
    TempExtBucket tempExtBuckets[TEMP_EXT_BUCKET_NUM];
} TempExtentMap;

```

temp属性的表空间extent都是定长的，因此不需要记录extent size信息。

当前版本free temporary extent的时候是直接归还到tablespace的，因此cached extent一定是used状态，后续支持将temporary extent先归还到本地，申请时优先从本地cache申请。

#####   [5.1.2 TEM操作](#512-tem操作)  

以下三个接口暴露给space层调用

在    `spcAllocExtent`    中，如果是临时表空间则调用分配接口，有两种情况（1）从文件中分配extent（2）扩展文件后立即分配

extent释放的场景较多，没有统一接口，目前有    `spcFreeExtent, spcFreeExtentBatch, freeUfbListBlock, freeBlockListBlock, spcReleaseInstTempUndo`    调用

-   `tempExtMapAddItem`    ，给定extent block id，将其插入到TEM中
-   `tempExtMapRemoveItem`    ，给定extent block id，将其从TEM中移出
-   `tempExtMapDestroy`    ，shutdown时调用


在插入和删除时，包括以下操作

-   `tempExtMapUpdate`    ，更新某个bucket的freeBlock，遍历firstBlock链表，找到第一个有free item的block，如果没有，将freeBlock置为NULL
-   `tempExtentMapReleaseCtrl`    ，删除item时，如果某个map block已经没有正在使用的item，则从链表上摘下这个map block并释放ctrl，并更新bucket的freeBlock
-   `tempExtMapAllocCtrl`    ，插入item时，如果freeBlock为NULL，且在更新之后仍为NULL，说明已经没有可用map block，需要从buffer pool申请一个，调用bpAllocCtrl接口，使用根据extent id哈希出来的part id


###   [5.2 Tempory Extent故障恢复](#52-tempory-extent故障恢复)  

#####   [5.2.1 实例异常退出](#521-实例异常退出)  

分为以下几步：

- 托管实例锁住temp属性表空间，此时表空间bitmap以及TEM都不会再发生变化
- 托管实例重置所有temp属性表空间的bimtap
- 托管实例通知所有存活实例根据自己的TEM，设置bitmap
- 解锁temp属性表空间，恢复完成


#####   [5.2.2 实例shutdown](#522-实例shutdown)  

shutdown实例遍历TEM，释放所有的cache extent

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

####   [6.1 TEM自测](#61-tem自测)  

配置参数上，VM_BUFFER_SIZE降低，以便频繁触发换入换出

建库时，将swap表空间和temp表空间初始大小和扩展大小降低，以便频繁触发临时表空间文件自动扩展

单机/集群下，串行或者并行执行如下操作：

- 创建临时表，插入大量数据后执行一次commit（temp表空间extent分配和释放）
- 创建多张普通表，插入大量数据
- 对普通表执行查询语句（swap表空间extent分配）
- 对普通表收集统计信息（swap表空间extent分配）
- 执行    `ALTER TABLESPACE SWAP SHRINK SPACE;`    （swap表空间extent释放）
- 执行    `SHUTDOWN;`    （临时表空间extent释放）
- 查询视图    `V$TEMP_EXTENT_POOL`    （视图功能验证）
- ![](https://git.yasdb.com/lidaoyi/pictures/-/raw/master/pictures/2023/08/3_19_54_44_image-20230803195436941.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI4NDksImV4cCI6MTc4MjIyMzY0OX0.C5UhZZpxMu7-3YFBglFZkpSnNHRdOT7FNn0T-82O2Do)


####   [6.2 故障恢复自测](#62-故障恢复自测)  

待定

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

- 二次故障场景分析
- temp extent支持实例级cache
