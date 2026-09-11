IR链接：  [https://pingcode.yasdb.com/ship/ideas/66d57a7f89f961f330105a43?](https://pingcode.yasdb.com/ship/ideas/66d57a7f89f961f330105a43?)  #YASHAN-3261  Ystream优化

SR链接：  [https://pingcode.yasdb.com/pjm/items/67074eebe489dd0868f39616?](https://pingcode.yasdb.com/pjm/items/67074eebe489dd0868f39616?)  #YDBRD-33792 Ystream内

##   [1. 总述](#1-总述)  

参考 Oracle System Global Area 和 share pool 相关配置。

###   [1.1 需求合理性分析](#11-需求合理性分析)  

目前 ystream 的 pool 需要手工配置，使用不是很方便，业内 Oracle 的 stream pool 集成在 SGA 内自动管理，比较方便。Ystream 提供类似能力。

###   [1.2 需求实现分析](#12-需求实现分析)  

#### 1.2.1 STREAMS_POOL_SIZE 配置

The   `STREAMS_POOL_SIZE`   value helps determine the size of the Streams pool.

Oracle's Automatic Shared Memory Management feature manages the size of the Streams pool when the   `SGA_TARGET`   initialization parameter is set to a nonzero value. If the   `STREAMS_POOL_SIZE`   initialization parameter also is set to a nonzero value, then Automatic Shared Memory Management uses this value as a minimum for the Streams pool.

If   `SGA_TARGET`   is set to a nonzero value and   `STREAMS_POOL_SIZE`   is not specified or is set to a null value,   [Automatic Shared Memory Management](https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/managing-memory.html#GUID-04EFED7D-D1F1-43C3-B78F-0FF9AFAC02B0)   uses 0 (zero) bytes as a minimum for the Streams pool.

If the   `STREAMS_POOL_SIZE`   initialization parameter is set to a nonzero value, and the   `SGA_TARGET`   parameter is set to 0 (zero), then the Streams pool size is the value specified by the   `STREAMS_POOL_SIZE`   parameter, in bytes.

If both the   `STREAMS_POOL_SIZE`   and the   `SGA_TARGET`   initialization parameters are set to 0 (zero), then, by default,   **on the first request for Streams pool memory **  in a database, an amount of memory equal to 10% of the shared pool is transferred from the buffer cache to the Streams pool. Products and features that use the Streams pool include Oracle GoldenGate, XStream, Oracle Advanced Queuing, and Oracle Data Pump.

The Streams pool is a shared resource, and the amount of memory a process can use from the Streams pool is determined by the application. The capture or apply parameter   `MAX_SGA_SIZE`   can be controlled for Oracle GoldenGate or XStream. For Oracle Advanced Queuing, use the procedures in the   `dbms_aqadm`   package to control the amount of Streams Pool needed.



Oracle 的 stream pool 位于 SGA，通常由 SGA 自动管理。用户可通过   STREAMS_POOL_SIZE   的配置项自动、或手动的控制 XStream 的内存消耗。上述文档的逻辑如下：

![image.png](https://pingcode.yasdb.com/atlas/files/public/674ecf5ea1ad9a3311de3e82/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYwMzgsImV4cCI6MTc4MjQ2NjgzOH0.pdwQpuQWmT9WyeC30_WrczqL5QHptyHSHsVIFyb3WHE)

SGA_TARGET 指定了 SGA 的总大小，系统会自动调整各模块的内存比例。

- 当配置 SGA_TARGET，表示由系统自动管理内存，此时 STREAMS_POOL_SIZE  表示自动内存管理时，stream pool 的最小值。
- 当没有配置 SGA_TARGET，表示人工配置内存分配，此时如 配置了 STREAMS_POOL_SIZE 则为 stream pool 的总大小，否则从 share pool 的 buffer cache 内存中按比例（10%）规划用作 stream pool。分配的时机是第一次对 share pool 的分配请求时。


PS：SGA_TARGET 运行时不可修改，如修改需重启。



**CHECKLIST**

|属性|场景名称|需求调研|关键技术点|特性是否涉及|逆向工程|
|---|---|---|---|---|---|
|自动管理 STREAM POOL SIZE|不明确 stream 的内存消耗|友商支持配置 SGA 时指定 stream pool 的下限，但 stream pool 的大小由系统自行管理。|是|是|否，仅参考|
|人工指定 STREAM POOL SIZE|人工明确指定 stream 内存上限|不指定 SGA 关闭内存自动管理，此时指定 strean pool size 即明确的 stream pool size。|是|是|否，仅参考|
|自动预分配 STREAM POOL|不指定任何参数时|share pool 第一次响应空间分配请求时，从 buffer cache 中分配 10% 用作 stream pool|是|是|否|


Oracle 这样的安排，通过两层参数的组合，实现了 stream pool 动态、静态的控制。

yashan db 的 SGA 实现与 Oracle 不同，是通过计算各 sub pool 反推 SGA 的总大小，实际上仅支持自动管理内存，即表中第一种情况。此时，按照 Oracle 的做法，STREAM POOL SIZE 配置表示 stream pool 的下限。Yashan DB 如果希望精确控制 stream pool size，在现有 sharepool 管理机制下，需要增加配置。

infra 中 pool 的实现，当 block 被释放时会被挂到 free list 上，如果要支持限定 stream pool size 下限的能力，那么需要调整其挂载到 share pool 中的 recycle callback，避免在 preemptive 模式下 free list 上的 block 被夺走，stream pool size 降低到下限以下。

#### 1.2.2 logminer Pool 的结构优化

logminer 的 pool 主要事务元数据、LCR 等缓存管理，为了适配超大 LCR，目前其 block size 设定为 512K。实际上多数事务都是小事务，512K 的 block 通常是冗余的。因此，logminer pool 考虑实现多种内存分配策略：

- 16K 以下的小内存（或者 16K 的 2/3？）从 block 为 16K 的 pool（也就是 share pool） 中分配。
- 其他大内存从 block 为 512K 的 large pool（logminer 内部的 large pool，不是 SGA）分配。


```
typedef StLgmPool {
  MemoryPool *pool;	     // block size 16K,mount to share pool
  MemoryPool *largePool; // malloced
}LgmPool;
```

如采用 1.2.1 中的 ystream pool size 控制方法，large pool 不可能从 share pool 中分配，将不计入 share pool size，这会使得配置的语义与 Oracle 差异较大。

如采用两种pool，由于 memory pool 的直接内存分配依赖 memory ctx，那么需调整增加新的 mctx 封装、内存分配接口。

```
typedef StLgmMemCtx {
  MemoryContext *ctx;
  MemoryContext *largeCtx;
}LgmMemCtx;

// 内存管理接口封装， alloc 等
```

#### 1.2.2 Logminer 的内存池改造

目前 logminer 内部自行实现了一套内存管理机制，需改造为 memory pool 管理。

###   [1.3 数据字典](#13-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|||||
|||||


###   [1.4 开源依赖](#14-开源依赖)  

无。

##   [2. 接口](#2-接口)  

友商特性对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|alter system set ystream_pool_size =xx;|目前已实现，但需要根据新语义重新实现。,可能由于方案的约束，某些情况不支持动态调整 ystream pool size。|是|
|配置项|限制 stream pool size 上限。|YSTREAM_POOL_SIZE 的语义可能要发生变化，按需增加配置项用于明确指定 pool size|是|
|函数|CodResult lgmSetPool(Logminer*lgm, MemoryPool *pool, MemoryPool *largPool);|用于指定 ystream 两种 pool|是|
|函数|CodResult lgmMctxCreate();,CodResult lgmMctxAlloc();,CodResult lgmMctxDestroy();|内存管理接口|是|


##   [3. 规格与约束](#3-规格与约束)  

**说明调研特性对外的功能规格或约束。给出各友商的差异点、优缺点描述。**

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

无。