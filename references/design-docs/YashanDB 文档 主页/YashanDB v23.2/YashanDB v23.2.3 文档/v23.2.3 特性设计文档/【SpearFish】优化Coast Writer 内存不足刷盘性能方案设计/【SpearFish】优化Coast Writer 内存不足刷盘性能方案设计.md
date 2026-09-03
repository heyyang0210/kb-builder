Created by 黄文早, last modified on 五月 09, 2024

  [https://pingcode.yasdb.com/pjm/items/6618e2c6fd997db58ad823bb](https://pingcode.yasdb.com/pjm/items/6618e2c6fd997db58ad823bb)    ?    
  #YDBRD-26162 优化coast writer内存不足刷盘性能

#   [**优化Coast Writer 内存不足刷盘性能方案设计**](#优化coast-writer-内存不足刷盘性能方案设计)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

1. 导入场景，compact 场景如果发生换出换出，会导致巨大的写放大，严重影响性能
1. 大块内存换入，可能导致内存使用上限不可控，导致无法提供最小使用


###   [1.2 需求分析](#12-需求分析)  

​	目前coast writer 内存换入换出机制中，换入换出以列为单位，每次需要整列中所有的内存换入/换出。当内存不能满足需要时，总是需要换出、换入大量空间，从而导致写放大严重。

####   [当前coast writer 内存管理机制](#当前coast-writer-内存管理机制)  

coast 中，每一列都有单独一个Column Writer，多个Column Writer 组成了slice writer，Column writer 内存结构如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d608970c2af4f52125f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUNBQUFBQUFBSUFBQUFnQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBZ0FBSWdBQUFBQVFBQUlBQUFBQWdFQUFBQUlBQUFBQUFCQVFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4MTIsImV4cCI6MTc4MjMxODYxMn0.GeQKZewqFcEMktz9tNx6aiWuL-y1_dDYpMGArEUdq_s)

其中内存细分为一下几类：

1. 定长类型，只分配一次内存，按顺序写入buffer，写满之后整体进行压缩/写磁盘（plain encoder 的定长类型buffer）
1. 变长类型，执行过程中按需分配新内存，由分配者管理多个内存片段，每个新分配的内存片段顺序写入（plain encoder 的变长数据buffer）
1. writer 上下文内存，生命周期与slice writer一致
1. 每次在一个slice 写入过程中会多次申请，释放的内存，例如数据encoder，bitmap。
1. 申请后会随机读写的内存，例如字典的hash index，和字典 value buffer，bloom filter 内存


其中除了第4类内存都可以换出到磁盘中，由于整列换出/换入，内存不足时，容易造成写放大严重。

##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

###   [4.1 换入换出机制设计](#41-换入换出机制设计)  

####   [4.1.1 设计目标](#411-设计目标)  

1. 导入过程中不报错，writer 需要常驻的内存申请完成后，内存不足不会报错。
1. 降低换入换出导致磁盘IO。
1. 提供一套可供列存使用的统一换入换出机制。


####   [4.1.2 内存管理](#412-内存管理)  

1. 严格内存分类，整体上，将内存分为可换出内存和不可换出内存。不可换出内存需要在slice writer 创建时全部分配，不再允许encoder,bitmap 之类，在slice 写入过程中重复分配的内存。目的是防止因为内存碎片，导致配额充足场景，内存不足，导致失败。
1. slice writer内存按配额管理，slice 创建时，需要按表类型计算最小配额，申请最小配额和不可换出的内存，申请配额/内存失败，释放已申请的配额/内存，持续等待，直到可以分配出所以不可换出的内存。以4096列计算，最大内存约为50M（主要空间为encoder result，每个大小约为1576 字节）
1. 对于可换出的内存，划分可换出内存优先级，优先级如下。


|优先级|说明|示例|
|---|---|---|
|0|顺序写入，并且已经写满的内存，只会最后进行一次读取，不再写入|plain编码，变长类型申请的内存分片|
|1|顺序写入，但是没写满的内存，后续执行会不断写入，写满后整体读取|plain编码，定长类型的内存|
|2|会发生随机读写的内存|字典编码的索引和值|


内存分配时，分配流程图如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d608970c2af4f521260/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUNBQUFBQUFBSUFBQUFnQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBZ0FBSWdBQUFBQVFBQUlBQUFBQWdFQUFBQUlBQUFBQUFCQVFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4MTIsImV4cCI6MTc4MjMxODYxMn0.GeQKZewqFcEMktz9tNx6aiWuL-y1_dDYpMGArEUdq_s)

​	如果配额充足，直接尝试分配物理内存，配额不足时，尝试拓展配额，拓展配额失败，新申请的内存，淘汰比该内存优先级低的内存，淘汰过程中，不断尝试，申请配额和内存，直到比此次分配分配优先级低的内存全部淘汰。若分配不出，如果该次分配必须申请物理内存，则报错失败，若非必须，则申请物化内存。

1. 内存被换出时，需要申请跟内存相同大小的磁盘空间，已经被换出的内存写过程中不再换入，字典如果发生换出，编码回退到 plain 编码，bloom filter 内存被换出，后续不再使用bloom filter，其他内存如果被换出，而是直接向磁盘中写入，最后需要生成slice 文件时，再部分换入，压缩，写入磁盘。


####   [4.1.3  物化内存空间管理](#413--物化内存空间管理)  

**方案1：使用文件管理**

​	每个slice 固定换出到两个文件中，内存按生命周期划分，分为slice 级别生命周期和block 级别生命周期，两个生命周期中的内存分别换出到一个临时文件中。通过引用计数，统计引用该文件的内存，引用计数降为0时，文件truncate，目的是防止内存申请，释放导致文件空洞产生。

优点：实现简单，无性能损耗。

缺点：需要调用者分配内存时，传递内存生命周期hint。

**方案2：使用临时表空间**

​	临时表空间支持表空间管理，有block回收机制，每次申请新的物化内存，内存向block size 对齐，占用多个vm block。读写时也访问多个vm block。释放空间可以通过vm 表空间处理。

优点：不用进行空间管理，统一虚拟内存分配机制。

缺点：管理较为复杂，由于使用vm block，会导致读取一批数据时，需要多次读block 请求；需要两次拷贝（disk->vm buff->  columnar vm buffer），或者临时表空间提供读写穿能力，工作量较大。

![](https://pingcode.yasdb.com/atlas/files/public/67396d60a1ad9a3311dc90d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUNBQUFBQUFBSUFBQUFnQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBZ0FBSWdBQUFBQVFBQUlBQUFBQWdFQUFBQUlBQUFBQUFCQVFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4MTIsImV4cCI6MTc4MjMxODYxMn0.GeQKZewqFcEMktz9tNx6aiWuL-y1_dDYpMGArEUdq_s)

####   [4.1.4 rgd buffer 调整](#414-rgd-buffer-调整)  

**设计目的**

1. 提供换入换出能力，并给出最小内存。
1. 作为rgd buffer可读的基础，提供实时的读写能力。
1. 作为pending delete buffer，提供大量数据缓存能力。


**设计前提**

1. rgd 不支持语句级别回滚，这保证实时生成 冷数据文件提供了可能：
1. a. 当一个语句开始时，如果先前生成的数据比较多，可以将已经生成的数据刷盘。
1. b. 在一个语句生成过程中，如果rgd 缓存中只有该语句生成的数据，可以将语句的数据生成的数据立即刷盘。


​	当一条语句开始时，如果之前语句积攒的数据达一个slice 大小，那可以将之前语句生成的slice 转为冷数据，语句执行过程中，如果语句生成的slice 行数超过一个slice ，则可以将本语句生成的slice 刷盘。因此由a，b两点可以保证，rgd 内未刷盘数据最多只会有2个最大 slice 大小的数据。rgd 设计时可以控制一个rgd buffer 最大缓存的行数。

**变长数据按行组织，定长数据按偏移访问**

​	rgd buffer 将定长数据和变长数据分别存储在不同的内存片段上。

​	对于定长列，需要在buffer 创建时，计算所有定长列需要的内存，同时分配大段虚拟内存。并计算每个列的偏差值，偏差值一次计算后可以多个rgd buffer共用，因为每个rgd buffer 的行数，表定义是一致的，所以列在内存中的偏移也是一致的。

​	对于变长列，所有变长列紧凑地存储在多个内存片段中。初始化时根据表定义中变长列数量分配一个初始化内存片段，内存片段每次使用不足时，申请翻倍的内存空间。在定长区，变长列存储一个5字节的向量，1 字节存储值所在的内存片段id，4字节存储值在内存片段中的便宜。值长度通过前后值相减获取，值不跨内存分片，需要记录内存分片存储数据的长度，用于计算最后一个值的长度，首个内存片段分配根据变长列数量分配，每个变长列预分配4096 字节，下次内存不足时下次分配两倍内存，内存无法分配则直接序列化到磁盘。

![](https://pingcode.yasdb.com/atlas/files/public/67396d60a1ad9a3311dc90d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUNBQUFBQUFBSUFBQUFnQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBZ0FBSWdBQUFBQVFBQUlBQUFBQWdFQUFBQUlBQUFBQUFCQVFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFJQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4MTIsImV4cCI6MTc4MjMxODYxMn0.GeQKZewqFcEMktz9tNx6aiWuL-y1_dDYpMGArEUdq_s)

​	同时，需要限制rgd 中缓存的行数，因为一个rgd buffer只能缓存固定行数，rgd 中的rgd buffer 数量不能过多，否则当分区数过多时，rgd内存过多，导致无法换出的内存过多，按一个rgd buffer内存256字节计算，一个rgd 中最多32 个buffer，每个buffer固定缓存64K行数据，则一个rgd 最多可以缓存的数据为2M行。  **自适应单个rowgroup 大小**

​	按极限场景，4096定长列，每列char 8000，如果按rowgroup 计算需要约128G 内存，不合理，因此，对于定长列多的数据，

​	由于内存分配接口限制，不能超过2G，导致一个rgd buffer 可能需要 ,因此需要根据表定义的定长列行长度，自适应单个rowgroup 大小，从而限制单个rgd buffer 的内存大小，限制办法为：根据表定义的定长列数量，计算一行需要的内存。从而计算2G 内存下最多可以buffer 的定长行大小。

####   [4.1.5 coast 写入调整](#415-coast-写入调整)  

​	由于现在不支持rowgroup layout，因此可以支持冷数据按列进行写入，并且不需要按block 为单位写入，即可以先完成一列数据的完整写入，再写入下一列数据，最后所有数据一起生成元数据文件。

####   [4.1.6 重要接口与数据结构定义](#416-重要接口与数据结构定义)  

```
typedef struct StCosVmNode {
    CodUint32 size;
    CodUint32 next;
    CodUint32 prve;
    CodUint32 id;
    CodUint64 handle;
    union {
        CodUint32 flag;
        struct {
            CodUint32 inMemory : 1;
            CodUint32 canSwap : 1;
            CodUint32 longLifetime : 1;
            CodUint32 listId : 2;
            CodUint32 unused : 27;
        };
    };
    union {
        CodUint64  offset;
        CodPointer ptr;
    };
} CosVmNode;

typedef struct StCosVmList {
    CodUint32 head;
    CodUint32 tail;
} CosVmList;

typedef enum EnCosVmListType {
    COS_VM_FULL,
    COS_VM_APPEND_ONLY,
    COS_VM_RANDOM_ACCESS,
    __COS_VM_TYPE_CNT__,
} CosVmListType;

typedef struct StCosVmStats {
    CodUint64 serdeSize;
    CodUint64 serdeTime;
    CodUint64 serdeCnt;
    CodUint64 inMemorySize;
    CodUint64 inDiskSize;
    CodUint64 totalAllocSize;
} CosVmStats;

// design for multi vm resource
typedef CodResult (*VmReadDisk)(CodPointer ctx, CodUint64 handle, CodUint32 offset, CodUint32 size, CodUint8* buffer);
typedef CodResult (*VmWriteDisk)(CodPointer ctx, CodUint64 handle, CodUint32 offset, CodUint32 size, CodUint8* buffer);
typedef CodResult (*VmAllocDisk)(CodPointer ctx, CodUint32 size, CodBool longLifeTime, CodUint64* handle);

typedef struct StVmDiskSource {
    CodPointer  ctx;
    VmReadDisk  read;
    VmWriteDisk write;
    VmAllocDisk alloc;
} VmDiskSource;

typedef struct StCosVmAllocator {
    CodMemAllocator allocator;
    CodQuotator*    quotator;
    CosVmList       list[__COS_VM_TYPE_CNT__];
    CosVmList       swapOutList;
    CosVmStats      stats;
    VmDiskSource    vmDiskSource;
    CodStack        reserveStack;
    CodUint32       maxNodeCnt;
    CosVmNode       nodes[0];
} CosVmAllocator;

typedef struct StCosVmHead* CosVmPtr;

CodResult cosInitVmAllocator(CodMemAllocator* allocator, CodQuotator* quotator, VmDiskSource source,
                             CodUint32 maxMemorySlice, CodUint32 reserveMemory);
CodResult cosAllocVm(CosVmAllocator* alloctor, CodUint32 size, CosVmPtr* head);
CodVoid   cosFreeVm(CosVmAllocator* alloctor, CosVmPtr ptr);
CodResult cosVmWrite(CosVmPtr dest, CodUint32 offset, CodPointer src, CodUint32 size);
CodResult cosVmRead(CosVmPtr src, CodUint32 offset, CodPointer dest, CodUint32 size);
CodResult cosPinVm(CosVmPtr src, CodPointer* ptr);
CodVoid   cosUnpinVm(CosVmPtr src);
// stack for temporary memory, stack of handler always smaller than expected
CodStack* cosGetReservedStack(CosVmAllocator* allocator);
CodBool   cosIsVmInMemory(CosVmPtr ptr);

typedef struct StRgdColMapItem {
    CodUint32     offset;
    DataSliceType type;
    CodUint16     valueSize;
    CodBool       nullable;
} RgdColMapItem;

#define MAX_VAR_SLICE_NUM 16
typedef struct StRgdColMap {
    CodUint32     columnNum;
    CodUint32     maxRowNum;
    CodUint32     bufferSize;
    RgdColMapItem rgdColMapItem[0];
} RgdColMap;

typedef struct StRgdBuffer {
    RgdColMap*    map;
    CVMAllocator* allocator;
    CVMPtr        fixedValues;
    CVMPtr        varValues[MAX_VAR_SLICE_NUM];
    CodUint32     rowNum;
} RgdBuffer;

CodVoid   initRgdColMapItems(ColumnAttr* attrs, RgdColMap* map);
CodResult initRgdBuffer(CVMAllocator* allocator, RgdColMap* map, RgdBuffer* buffer);
CodUint32 rgdBufferGetMaxBufferRow(ColumnAttr* attrs, CodUint32 columnNum);
CodResult rgdBufferWriteRows(RgdBuffer* buffer, RgdBufferColumn* columns, CodUint32 rowNum);

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. vm 内存接口测试
1. vm 内存接口测试
1. 导入序列化接口测试。
1. coast 内存最小值测试
1. 导入导入序列化内存用量。


##   [6.子任务拆分与工作量评估](#6子任务拆分与工作量评估)  

1. vm 接口，接口自测（3人天）
1. vm 接口，对接coast，自测（12人天，代码10+自测2）
1. rgd buffer 序列化改造（5人天，代码3.5，+自测1.5）
1. 整体性能验证（3人天）


##   [7.未来规划](#7未来规划)  

本需求解决了，导入场景物理内存不足时，产生大量换出问题。还有以下问题需要解决：

1. 多个 slice 内存可控
1. rgd和slice 相互淘汰


## Attachments:

[image2024-4-25_14-58-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjBhMWFkOWEzMzExZGM5MGQwIiwicmVmX2lkIjoiNjczOTZkNjA1OTNmOTljOWZmMjM3YWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODExLCJleHAiOjE3ODIzOTQyMTF9.SN1ig11N_cWunkTazxNhf9oFYfIMFZztiK1Gmt6NmNQ)

 (image/png)    


[image2024-4-25_14-57-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjA4OTcwYzJhZjRmNTIxMjVkIiwicmVmX2lkIjoiNjczOTZkNjA1OTNmOTljOWZmMjM3YWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODExLCJleHAiOjE3ODIzOTQyMTF9.FWualXYs7Yl2B7fnN8TzLtimu7vnG77l6-xqlKc1XcM)

 (image/png)    


## Comments:

|  [](null)  ,评审会议纪要：    
  1.保证单分区执行过程中不会因内存不足失败,  
,Posted by huangwenzao at 五月 09, 2024 16:09|
|---|
