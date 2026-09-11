Created by 余睿杰, last modified on 七月 16, 2024

  


IR:     [YASHAN-2861](https://pingcode.yasdb.com/ship/ideas/66279d35009f91eb87f67bcc)     -- 分布式支持PN上的diskcache

SR:     [YDBRD-27022](https://pingcode.yasdb.com/pjm/items/663f40aa288e197820895a96)     -- PN支持diskcache

##   [1. 总述](#1-总述)  

此设计方案包含对于diskcache支持目录缓存的设计。

在现有实现中， diskcache 假定其后端存储机制为 tablespace，因此产生了较高耦合度的代码。在存算分离项目中新增的Pn节点类型不包含任何tablespace，因此无法原生使用 diskcache。

此设计方案计划将diskcache实现抽象化，剥离出原有基于tablespace的实现，并添加基于文件目录的新的实现。另外，在所有场景下，改用文件目录实现，并将原有tablespace实现作为死代码暂存。

###   [1.1 需求来源](#11-需求来源)  

基于存算分离架构（     [设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=119559628)     ）下 pn 节点的 s3 数据缓存需求，对现有 diskcache 模块进行改造适配，以及针对 diskcache 视图的改造增强。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

###   [2.1. 用户可感知接口变化](#21-用户可感知接口变化)  

####   [2.1.1. 动态视图](#211-动态视图)  

######   [](#2111-vdiskcache-gvdiskcache)  

增加字段：

|字段|类型|说明|
|---|---|---|
|REGION_GROUP_ID|INTEGER|磁盘缓存的区域所在组ID|
|REGION_LOAD_TIMESTAMP|TIMESTAMP|磁盘缓存区域开始加载时间戳，在首次写入 region 时无意义，为 1970-01-01T00:00:00.000000|


注：     `REGION_GROUP_ID`     由原有的     `RGION_GROUP_ID`     更名而来。

#####   [](#2112-dvdiskcache)  

|字段|类型|说明|
|---|---|---|
|GROUP_ID|INTEGER|组ID|
|GROUP_NODE_ID|INTEGER|组内节点ID|
|REGION_ID|INTEGER|磁盘缓存的区域ID|
|REGION_GROUP_ID|INTEGER|磁盘缓存的区域所在组ID|
|REGION_HIT|INTEGER|磁盘缓存区域的总命中次数|
|ITEM_NUM|INTEGER|磁盘缓存区域的缓存对象数量|
|REGION_LOAD_TIMESTAMP|TIMESTAMP|磁盘缓存区域开始加载时间戳，在首次写入 region 时无意义，为 1970-01-01T00:00:00.000000|


字段说明同上；   **此视图需要进入 pn 的 dv 白名单（详见 **    [此设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=153001695#48-pn%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE%E5%A4%84%E7%90%86)    ** ）**   。

####   [2.1.2. 统计项](#212-统计项)  

|字段|说明|
|---|---|
|DISKCACHE EVICT CNT|磁盘缓存总淘汰次数|


####   [2.1.3. 配置参数](#213-配置参数)  

#####   [2.1.3.1. FsDevice 根目录](#2131-fsdevice-根目录)  

  `DISKCACHE_FS_ROOT`  

|名字|值|
|---|---|
|参数类型|字符串|
|默认值|?/local_fs/cache/|
|取值范围|标准目录路径格式|
|参数说明|DiskCache Fs 根目录：（1）推荐使用节点相对路径；（2）设置后不允许用户手动管理此路径下的文件|
|修改立即生效|是|
|会话级参数|否|
|只读参数|否|
|引入版本|v23.3|


注：

1. 支持热修改，修改时使旧 diskcache 失效。
1. 若字符串过长，在设置时验证长度直接报错； diskcache 内使用这个字符串时默认长度合法。
1. 当设置成一个非空文件夹或非文件夹时报错。
1. 当设置成一个绝对路径时告警，因为可能出现同一机器多个节点使用同一个绝对路径的情况，但能成功设置。


#####   [2.1.3.2. FsDevice 空间限制](#2132-fsdevice-空间限制)  

  `DISKCACHE_FS_CAPACITY`  

|名字|值|
|---|---|
|参数类型|数值|
|默认值|100MB|
|取值范围|  `[64MB, 2^64-1]`  |
|参数说明|DiskCache 最大占用空间（单位：字节）|
|修改立即生效|是|
|会话级参数|否|
|只读参数|否|
|引入版本|v23.3|


参数值会向下变成块大小的整数倍数。

支持在线（且是启用时）修改，修改时若新大小小于当前占用大小，主动释放部分资源减小占用大小（从 lru 中持续淘汰直到大小符合预期）。

####   [2.1.4. 错误码](#214-错误码)  

以下所有错误码不应向最终用户展示，因为 diskcache 只是作为缓存机制存在，当内部失败时外部应作容错处理并消除对应错误码。

-   `ERR_DISKCACHE_META_CORRUPT`  
-   `ERR_DISKCACHE_OUT_OF_SPACE`  
-   `ERR_DISKCACHE_NEEDS_REBUILD`  
-   `ERR_DISKCACHE_UNEXPECTED_FILE_SIZE`  


###   [2.1. DiskCache 内部各模块对外代码接口](#21-diskcache-内部各模块对外代码接口)  

####   [2.1.3. CacheDevice, CacheDevHandler](#213-cachedevice-cachedevhandler)  

这类接口与原有的基于 tablespace 实现的     `cacheDev*()`     函数同名，但不包含具体实现，只包含抽象化、调用具体实现接口的部分。

另外将原实现中职责定义不明确的     `CacheDevice`     拆分成两个结构体，一个长期结构体     `CacheDevice`     与一个短期结构体     `CacheDevHandler`     ，其中     `CacheDevHandler`     只在     `.c`     中定义，内部结构对外不可见。

```
typedef enum EnCacheDeviceType {
    CACHE_DEVICE_TABLESPACE,
    CACHE_DEVICE_FS,
} CacheDeviceType;

typedef struct StCacheDeviceCfg {
    CacheDeviceType type;

    union {
        TbspDeviceCfg tbsp;
        FsDeviceCfg   fs;
    };
} CacheDeviceCfg;

// ank_defs.h {
typedef union UnCacheDevLocation {
    TbspDevLocation tbsp;
    FsDevLocation   fs;
} CacheDevLocation;
// ank_defs.h }

// diskcache_device.c {
typedef struct StCacheDevHandler {
    CacheDevice*     dev;
    CodMemAllocator* alloc;  // Handler owner
} CacheDevHandler;
// diskcache_device.c }

// 回调函数类型定义
typedef CacheDevLocation (*CacheDevOffset)(CacheDevLocation base, CodUint16 offset);
typedef CodVoid (*CacheDevRegisterLoc)(CodPointer concrete, const CacheDevLocation* loc);

typedef CodResult (*CacheDevOpen)(Kernel* kernel, const CacheDeviceCfg* cfg, CodMemAllocator* allocator,
                                  CodPointer* concrete);
typedef CodVoid (*CacheDevClose)(CodPointer concrete);

typedef CodResult (*CacheDevAlloc)(CodPointer concrete, CodUint32 blockCnt, CacheDevLocation* loc);
typedef CodResult (*CacheDevFree)(CodPointer concrete, CodUint32 blockCnt, CacheDevLocation loc);

typedef CodResult (*CacheDevWrite)(CodPointer concrete, CacheDevLocation loc, CodUint32 blockCnt,
                                   const CodChar* buffer);
typedef CodResult (*CacheDevRead)(CodPointer concrete, CacheDevLocation loc, CodUint32 blockCnt, CodChar* buffer);

// 回调函数集
typedef struct StCacheDevCallbacks {
    CodPointer dev;  // The concrete CacheDevice implementation.

    CacheDevOffset      offset;
    CacheDevRegisterLoc registerLoc;  // On load(), device should know about all locations allocated

    CacheDevOpen  devOpen;
    CacheDevClose devClose;

    CacheDevAlloc devAlloc;
    CacheDevFree  devFree;

    CacheDevWrite devWrite;
    CacheDevRead  devRead;
} CacheDevCallbacks;

// 启停 cache device 长期结构体， open 申请空间， close 释放空间
CodResult cacheDevOpen(Kernel* kernel, const CacheDeviceCfg* cfg, CodMemAllocator* allocator, CacheDevice** outDev);
CodVoid   cacheDevClose(CacheDevice* dev);

// 创建销毁 handler 短期结构体， alloc 申请空间， release 释放空间
CodResult cacheDevAllocHandler(CacheDevice* dev, CodMemAllocator* alloc, CacheDevHandler** handler);
CodVoid   cacheDevReleaseHandler(CacheDevHandler* handler);

// 获取 handler 内部信息
CacheDeviceType cacheDevGetType(CacheDevHandler* handler);
CodPointer      cacheDevGetInternal(CacheDevHandler* handler);

CodUint32 cacheDevGetBlockSize(CacheDevHandler* handler);

// 从 cache device 中申请/释放一块存储空间
CodResult cacheDevAlloc(CacheDevHandler* handler, CodUint32 blockCnt, CacheDevLocation* loc);
CodResult cacheDevFree(CacheDevHandler* handler, CodUint32 blockCnt, CacheDevLocation loc);

// 读写已分配的存储空间
CodResult cacheDevWrite(CacheDevHandler* handler, CacheDevLocation loc, CodUint32 blockCnt, const CodChar* buffer);
CodResult cacheDevRead(CacheDevHandler* handler, CacheDevLocation loc, CodUint32 blockCnt, CodChar* buffer);

// 内部函数，可视为 location 的加法运算
CacheDevLocation cacheDevOffset(CacheDevHandler* handler, CacheDevLocation loc, CodUint16 offset);
// 内部函数，每次申请空间时需要调用回调注册空间
CodVoid cacheDevRegisterLoc(CacheDevHandler* handler, const CacheDevLocation* loc);

// Check whether the error code indicates that the space has run out.
static inline CodBool cacheDevIsOutOfSpaceError(CodError error)
{
    return error == ERR_ANK_NOFREE_EXTENTS ||    // tablespace
           error == ERR_DISKCACHE_OUT_OF_SPACE;  // fs
}

// 删除 cacheDevNextNBlock(), cacheDeviceGetspaceid(), AS_SPCBID()

```

####   [2.1.1. TbspDev](#211-tbspdev)  

这类接口由原有的    `cacheDev*`    重命名而成。由于是已有代码，此处不展开讨论具体实现。这些接口与实现需要挪到    `diskcache_tbsp_device.{h,c}`    里，在    `diskcache_device.{h,c}`    里保留    `cacheDev*()`    函数作为抽象层调用具体实现里的回调函数。

```
typedef CodUint32 TbspDevLocation;

CodResult tbspDevInit(Kernel* kernel, TbspDeviceCfg cfg, CodMemAllocator* allocator, TbspDevice* device);
CodVoid   tbspDevRelease(TbspDevice* device);
// ...
CodResult tbspDevFree(TbspDevice* device, CodUint32 blockCnt, TbspDevLocation location);
// ...

```

以下几点需要注意：

1. 原有的    `cacheDevOpen()`    和    `cacheDevClose()`    职责拆分
1.     - 新的    `cacheDevOpen()`    职责为申请 device 内存，并调用具体实现的 init 函数
    - 新的    `cacheDevClose()`    职责为调用实现 release 接口，之后释放 device 内存
    - 增加    `tbspDevInit()`    作为 tablespace 实现的 init 函数，初始化 TbspDevice
    - 增加    `tbspDevRelease()`    作为 tablespace 实现的 release 函数，释放 TbspDevice 内申请的资源

1. 为了函数参数位置的统一，修改    `tbspDevFree()`    的参数，调换    `location`    与    `blockCnt`    这两个参数位置


####   [2.1.2. FsDev](#212-fsdev)  

在    `diskcache_fs_device.{h,c}`    里提供、实现以下接口函数：

```
typedef struct StFsDevLocation {
    CodUint32 file;
    CodUint16 block;
} FsDevLocation;

typedef struct StFsDeviceCfg {
    FileName root;
} FsDeviceCfg;

typedef struct StFsDevice {
    KernelAttr*      attr;
    CodMemAllocator* alloc;  // FsDevice owner
    FsDeviceCfg      cfg;
    CodAtomicUint32  lastFileId;
    CodUint32        dbBlockSize;
} FsDevice;

CodVoid fsDevSetCallbacks(CacheDevCallbacks* cb);

CodResult fsDevOpen(Kernel* kernel, const CacheDeviceCfg* cfg, CodMemAllocator* alloc, FsDevice** dev);
CodVoid   fsDevClose(FsDevice* dev);

CodResult fsDevAlloc(FsDevice* dev, CodUint32 blockCnt, CacheDevLocation* loc);
CodResult fsDevFree(FsDevice* dev, CodUint32 blockCnt, CacheDevLocation loc);

CodResult fsDevWrite(FsDevice* dev, CacheDevLocation loc, CodUint32 blockCnt, const CodChar* buffer);
CodResult fsDevRead(FsDevice* dev, CacheDevLocation loc, CodUint32 blockCnt, CodChar* buffer);

```

####   [2.1.4. DiskCache](#214-diskcache)  

```
// diskcache.h
// 删除 struct StDiskDevice

struct StDiskCacheHandler {
    DiskCacheImp*    diskCache;
    CacheDevHandler* cacheDevHandler;
};

```

####   [2.1.5. (coast level)](#215-coast-level)  

####   [2.1.6. (ank)](#216-ank)  

```
// ank_defs.h
typedef struct StKernelAttr {
    // ...
    CodUint64       diskCacheFsCapacity;  // capacity as number of bytes
    CodAtomicUint64 diskCacheFsOccupied;  // number of bytes currently occupied
    FileName        diskCacheFsRoot;
    // ...
} KernelAttr;

```

其中 capacity 和 root 与上述配置项对应； occupied 为一个原子变量，表示在当前时间点 diskcache 已使用字节数量。

##   [3. 规格与约束](#3-规格与约束)  

- 设计不考虑用户使用挂载点干扰文件目录结构：若用户自定义挂载点，不保证一定能使用到 diskcache 。
- 当前 FsDevice 对于     `alloc/free`     的粒度为文件级，而对于     `write/read`     的粒度为块级。
- 修改     `DISKCACHE_FS_ROOT`     配置项将会重建 diskcache ，原有缓存数据将会丢失，但不会影响到上游原始数据。
- 修改     `DISKCACHE_FS_CAPACITY`     配置项低于当前已占用空间时会在当前会话中逐步淘汰已缓存数据。
- 当 diskcache 内部出现错误（例如出现文件不可读写等报错）时，用户不应感知 diskcache 错误：
    - 查询时数据库遇到 diskcache 错误应尝试从源头拉取数据。
- 为避免单台机器上多个节点 diskcache 路径冲突，     `DISKCACHE_FS_ROOT`     推荐为节点相对路径（不以     `/`     开头）
    - 若确实是绝对路径，需要告警，但仍然设置成功
- 用户不允许添加名字为 cache 的 databucket


##   [4. 特性](#4-特性)  

###   [4.1. 文件结构方案](#41-文件结构方案)  

####   [4.1.1. 文件编号](#411-文件编号)  

FsDevice 内部将每个文件对应一个 u32 数字，内部维护一个原子 u32 变量作为计数器，且不感知文件中存储的具体数据类型。

为了避免一个文件夹中（ FsDevice 根目录）包含过多文件，将这个 u32 的上 16 位作为文件夹名，下 16 位作为文件夹中的文件名。另外，编号 0 保留，不对外提供编号 0 文件。

例如，编号     `0x01020304`     的文件名为     `ROOT/0102/0304`     。

####   [4.1.2. tmpfs 文件系统特殊处理](#412-tmpfs-文件系统特殊处理)  

由于 tmpfs 无法使用 O_DIRECT 打开文件，报错 EINVAL ，在 diskcache 中打开文件时会优先尝试 O_DIRECT ，若遇到此报错则退回成非 O_DIRECT 打开方式。

####   [4.1.3. 标记文件](#413-标记文件)  

为了防止用户手动修改     `config.ini`     配置文件里的     `DISKCACHE_FS_ROOT`     成其他文件夹，需要将 diskcache 管理的文件夹与其他文件夹区分开来。因此在 diskcache 首次创建时将在其根目录下创建一个隐藏空文件     `.diskcache`     。其作用是在起库时若遇到一个非空文件夹，并且文件夹里面包含这个文件，就表明这个文件夹是被 diskcache 管理的。

起库流程如下：

1. 当指定     `DISKCACHE_FS_ROOT`     不存在或者为空时，尝试创建 diskcache ，若失败则告警且不启用 diskcache ，起库能正常成功
1. 当指定     `DISKCACHE_FS_ROOT`     为非空文件夹且包含     `.diskcache`     标记文件时，尝试加载 diskcache
    1. 若加载失败（小概率事件，例如磁盘故障），则删除     `DISKCACHE_FS_ROOT`     下所有文件并重建 diskcache ；若再失败则告警且不启用 diskcache
1. 当指定     `DISKCACHE_FS_ROOT`     为其他情况时（非文件夹，不包含     `.diskcache`     标记文件等情况），告警且不启用 diskcache


当用户执行     `ALTER SYSTEM`     DDL 来修改     `DISKCACHE_FS_ROOT`     值时，上述告警场景则改为直接在 DDL 里报错。

###   [4.2. diskCache*() 接口](#42-diskcache-接口)  

####   [4.2.1. 管理接口](#421-管理接口)  

  `diskCacheCreate()`     、     `diskCacheLoad()`     、     `diskCacheDestroy()`     这几个函数列出了 diskcache 结构体的初始化与销毁逻辑，不需要大修改，仅需适配转换抽象层这个变化。

当     `diskCacheCreate()`     、     `diskCacheLoad()`     启动逻辑报错时， diskcache 需设空，调用者需拦截错误码，后续需要用到 diskcache 时直接跳过。     `diskCacheDestroy()`     销毁逻辑内部报错时（因为需要刷盘写文件）也须拦截错误码。

####   [4.2.2. 读写接口](#422-读写接口)  

  `diskCacheWrite()`     、     `diskCacheRead()`     以及实际刷盘使用的函数     `regionSync()`     无需大改，仅适配抽象层。

###   [4.3. cacheDev*() 接口](#43-cachedev-接口)  

这一系列函数是主要的修改点，需要针对 FsDevice 实现一套新的逻辑，因此将原有的对外函数抽离出去，保留基于     `CacheDevice`     的抽象实现。以下章节描述了 FsDevice 提供的对应接口，而 CacheDevice 抽象层只需要调用 FsDevice 提供的函数指针。

####   [](#431-cachedevopen-cachedevclose)  

1. open
    1. 分配 device 内存
    1. 创建 handler
    1. 将入参 cfg 复制到 device 内的 cfg 中
1. close
    1. 释放 handler


####   [](#432-cachedevgetblocksize)  

完全维持不变，仍然使用 Kernel 内的 block size 。

####   [](#433-cachedevalloc-cachedevfree)  

1. alloc
    1. 验证创建文件是否会超出上限
    1. 验证文件是否已存在
    1. 创建父文件夹与文件，修改文件大小
    1. 修改 diskCacheFsOccupied
1. free
    1. 删除文件
    1. 修改 diskCacheFsOccupied


####   [](#434-cachedevwrite-cachedevread)  

1. write
    1. 打开位于 location 的文件（仅写＋不创建），函数返回时关闭
    1. 验证文件大小，避免让文件变大，否则报错
    1. seek 到 location 指定的偏移量，写入指定长度字节
1. read
    1. 打开位于 location 的文件（仅读），函数返回时关闭
    1. seek 到 location 指定的偏移量，读取指定长度字节


注：上面提到的打开文件需要考虑到 tmpfs 场景，在 diskcache 启动时需要尝试 O_DIRECT ，若报错 EINVAL 则后续打开时关闭 O_DIRECT 选项。

###   [4.4. Coast 中对 diskcache 提供函数的容错处理](#44-coast-中对-diskcache-提供函数的容错处理)  

考虑到 diskcache 操作可能失败，但因为 diskcache 只是缓存机制，就算失败也不应对外层逻辑造成冲击，因此需要保证 diskcache 调用者（ coast ）对 diskcache 错误作容错处理。

diskcache 共对外提供以下几个接口，其中一个接口需要作容错处理：

-   `pfnOpen()`     全部入口都已作容错处理
-   `pfnClose()`     返回 void
-   `pfnRead()`     已在     `cosDiskCacheRead()`     作容错处理，为对外唯一读取接口
-   `pfnWrite()`     已在     `cosDiskCacheWrite()`     作容错处理，为对外唯一写入接口
-   `pfnInvalid()`     调用链中不包含容错处理，需要在     `cosDiskCacheInvalidBySpaceId()`     中添加容错处理，包括丢弃 diskcache 错误码并修改其函数返回值成 void
    - 调用链如下：
        -   `dupRecvSpaceInfo()`  
        -   `ankCacheInvalidBySpcId()`  
        -   `ankCoastInvalidCacheBySpaceId()`  
        -   `cosInstanceCacheInvalidBySpcId()`  
        -   `cosDiskCacheInvalidBySpaceId()`  


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

###   [5.1. 最小流程场景，功能＋视图](#51-最小流程场景功能视图)  

1. 建 S3 LSC 表
1. 插入一条数据
1.   `ALTER SYSTEM SET SCOL_CACHEABLE_SCAN_ROWS=1 TYPE=ALL SCOPE=BOTH`  
1. 读取数据
    1. 查看 diskcache 视图与统计视图确认 diskcache 未被使用
    1. （手动测试）验证 diskcache 目录的文件数量、大小与修改时间
1. 转冷
1. 读取数据
    1. 查看 diskcache 视图确认 diskcache 生成了一个 region
    1. 查看统计视图确认 diskcache 已被读写，且淘汰次数为 0
    1. （手动测试）验证 diskcache 目录的文件数量、大小与修改时间
1. 重启，读取数据，查看视图，手动测试时验证目录


###   [5.2. 大量数据场景，功能＋视图](#52-大量数据场景功能视图)  

1. 建 S3 LSC 表
1. 插入数据，数据量应保证超过 diskcache 配置的上限
1.   `ALTER SYSTEM SET SCOL_CACHEABLE_SCAN_ROWS=1 TYPE=ALL SCOPE=BOTH`  
1. 读取数据
    1. 查看 diskcache 视图与统计视图确认 diskcache 未被使用
    1. （手动测试）验证 diskcache 目录的文件数量、大小与修改时间
1. 转冷
1. 读取数据
    1. 查看 diskcache 视图确认 diskcache 生成了一个 region
    1. 查看统计视图确认 diskcache 已被读写，且淘汰次数不为 0
    1. （手动测试）验证 diskcache 目录的文件数量、大小与修改时间
1. 重启，读取数据，查看视图，手动测试时验证目录


###   [5.3. 异常场景](#53-异常场景)  

1. 建 S3 LSC 表
1. 插入大量数据
1.   `ALTER SYSTEM SET SCOL_CACHEABLE_SCAN_ROWS=1 TYPE=ALL SCOPE=BOTH`  
1. 删除 diskcache 目录中的一个文件
    1. 其他文件异常场景在代码中表现都是读写失败，因此不需要测不同的文件异常场景
1. 发起查询，确认查询能够成功


###   [5.4. 配置参数修改](#54-配置参数修改)  

####   [](#541-diskcache-fs-root)  

#####   [](#5411-alter-system-set-diskcache-fs-root--xxx)  

首先执行最小流程场景，然后修改 dn 节点上的     `DISKCACHE_FS_ROOT`     为符合以下描述的路径，验证其预期行为：

|修改后|预期行为|备注|
|---|---|---|
|可读写的空文件夹|成功，查询成功并使用 diskcache||
|可读写的空文件夹，挂载在 tmpfs 上|成功，查询成功并使用 diskcache||
|不可读的文件夹|失败|无法验证     `.diskcache`     标记文件是否存在|
|不可写的空文件夹|失败|无法创建     `.diskcache`     标记文件，创建失败|
|非文件夹|失败||
|不存在的路径|成功（创建完整路径），查询成功并使用 diskcache|若创建完整路径失败则报错|
|路径过长|失败||
|不带     `?/`     的最长路径|成功，查询成功并使用 diskcache|例如     `1....1`  |
|深层路径|成功，查询成功并使用 diskcache||
|路径为绝对路径|告警绝对路径，剩余行为同上||


#####   [5.4.1.2. 直接修改配置文件](#5412-直接修改配置文件)  

首先执行最小流程场景，关闭 dn 节点，然后修改配置文件中     `DISKCACHE_FS_ROOT`     为符合以下描述的路径后启动 dn 节点验证其预期行为：

|修改后|预期行为|备注|
|---|---|---|
|可读写的空文件夹|起库成功，使用 diskcache||
|可读写的空文件夹，挂载在 tmpfs 上|起库成功，使用 diskcache||
|不可读的文件夹|起库成功, 有告警无法使用 diskcache|无法验证     `.diskcache`     标记文件是否存在|
|不可写的空文件夹|起库成功，有告警无法使用 diskcache|无法创建     `.diskcache`     标记文件，创建失败|
|非文件夹|起库成功，有告警无法使用 diskcache||
|不存在的路径|起库成功，使用 diskcache|若创建完整路径失败则告警并无法使用 diskcache|
|路径过长|起库成功，有告警无法使用 diskcache||
|不带     `?/`     的最长路径|起库成功，使用 diskcache|例如     `1....1`  |
|深层路径|起库成功，使用 diskcache||
|路径为绝对路径|起库成功，告警绝对路径，剩余行为同上||


####   [](#542-diskcache-fs-capacity)  

首先执行大量数据场景，然后修改     `DISKCACHE_FS_CAPACITY`     为以下数值，验证其预期行为：

|修改后|预期行为|备注|
|---|---|---|
|最小值 64MB|成功|会执行淘汰操作|
|最大值|成功|修改后上限仅受文件系统大小限制|
|低于最小值 64MB - 1B|失败||
|高于最大值|失败，无法解析成 u64||


##   [6.资料设计章节](#6资料设计章节)  

- 错误码
-   `V$DISKCACHE`     ，     `GV$DISKCACHE`     ，     `DV$DISKCACHE`     动态视图
-   `V$SYSSTAT`     视图
- 配置参数
    - 在     `ENABLE_DISKCACHE`     说明中添加：“启用时禁止创建名字为     `cache`     的 databucket”


##   [7.未来规划](#7未来规划)  

由于时间限制以及需要更细节的展开，以下能力不在当前特性设计中支持，可以考虑在将来新的需求中引入：

- 修改 root 时将原有 cache 复制到新 root 下
- diskcache 内部最小化清理故障资源，例如当 region 故障时删除此 region 等等


## Attachments:

[diskcache-write.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzBhMWFkOWEzMzExZGM5OTgzIiwicmVmX2lkIjoiNjczOTZlYzA3MjgyMDZlZmI5MmYyYzQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODczLCJleHAiOjE3ODI1MjUyNzN9.YaK9D7XGCMcx9iyhn2qPhR11wRNZ8qwCSZ0yiAw-JrU)

 (image/png)    


## Comments:

|  [](null)  ,2024-07-12   设计评审会议纪要,  [谢锐](https://conf.yasdb.com/display/~xierui)      [黄文早](https://conf.yasdb.com/display/~huangwenzao)      [余睿杰](https://conf.yasdb.com/display/~yuruijie)      [任艳芬](https://conf.yasdb.com/display/~renyanfen)      [易文亮](https://conf.yasdb.com/display/~yiwenliang)  ,1. 决策项：V$DISKCACHE与GV中RGION_GROUP_ID需要更名，需要刷对应用例预期
1. 决策项：REGION_LOAD_TIMESTAMP“仅读取时有意义”这段话需要写在字段说明中
1. REGION_LOAD_DURATION用处不大，去除
1. 设置DISKCACHE_FS_ROOT为绝对路径时日志告警（warn），但放行
1. 添加约束，不允许添加名字为cache的databucket，因为默认路径为 ?/local_fs/cache
1. 需要在文档中说明推荐用法是将空文件夹软链接到节点数据目录下的local_fs/cache    

    1. 疑问：目前提到diskcache的只有V$, GV$, 统计信息，错误码与配置参数，需要跟进
1. 决策项：DISKCACHE_FS_ROOT设置非空时报错，必须提供一个不存在路径（数据库创建完整路径）或者空文件夹
1. 决策项：无须对设置DISKCACHE_FS_ROOT为当前值做特殊处理，依靠上述的要求空文件夹作为约束
1. DISKCACHE_FS_CAPACITY作为缓存机制，设置下限太低无意义，修改下限为64MiB
1. 需要确认淘汰是否会造成空洞id导致部分空间被无意义占用
1. 决策项：接口名称是否需要修改等待代码检视时再考虑
1. 重新确认启动顺序，看能否把attr中新增的三个字段挪到diskcache内部
1. 启动时确认能否启用O_DIRECT打开方式，而不是每次打开都尝试打开两遍
1. 由于目前diskcache难以被用到，自测用例中需显式添加 SCOL_CACHEABLE_SCAN_ROWS=1
1. 用例中增加重启后查缓存场景
1. 由于决策项修改，不可读文件夹在验证是否空文件夹时报错
1. 补充capacity相关用例，验证设置最小值、最大值都不应报错，超出两侧范围报错，塞数据后缩小上限成功
1. 需要手测深层级文件夹，例如 ?/1/1/1/1/...
1. 需要保证 DISKCACHE_FS_ROOT=1/2/3 等同于 ?/1/2/3
,Posted by yuruijie at 七月 13, 2024 10:59|
|---|
|  [](null)  ,上述评审意见修改结果：,1. 已修改
1. 已修改
1. 已去除
1. 已修改
1. 已修改
1. 等待跟进，文档项不阻塞开发
1. 已修改
1. 已修改
1. 已修改
1. 经确认，能用但是需要小调整
    1. 目前lru淘汰机制仅在write中用到，lru中只返回需要清除的region id
    1. 在缩小diskcache中需要做到删除对应的region，而不是重用
1. 已修改
1. 经确认，无法挪入diskcache内部
    1. 从config中读取设置时，cbpmEnableDiskCache断点时gInstance.kernel.diskCache为null
1. 已修改
1. 已修改
1. 已修改
1. 已修改
1. 已修改
1. 已修改
1. 已修改
,Posted by yuruijie at 七月 13, 2024 12:03|
|  [](null)  ,补充：,1. 当diskcache故障时（例如缺少文件），需要尝试去恢复diskcache状态，使得diskcache能够重新正常工作
1. 起库时与alter system时共用同一套设置配置项流程，无法直接强制要求空文件夹
1. 当用户手动修改config文件夹到任意路径时（例如 ?/dbfiles ），需要保证不要把此路径的数据写坏
,方案修改：,1. 起库时若root不存在或为空文件夹，创建diskcache
    1. 创建时在root下创建 .diskcache 隐藏标记文件
1. 起库时若root非空且包含 .diskcache 标记文件，尝试加载
    1. 若失败（小概率事件：磁盘故障等原因），铲掉整个root文件夹，重新创建diskcache
    1. 若无法铲掉，告警，不使用diskcache
1. 其他情况下（例如root非空且不包含标记文件）配置时报错，diskcache启用失败，告警且不使用diskcache，仍然可以起库
,Posted by yuruijie at 七月 16, 2024 11:04|
