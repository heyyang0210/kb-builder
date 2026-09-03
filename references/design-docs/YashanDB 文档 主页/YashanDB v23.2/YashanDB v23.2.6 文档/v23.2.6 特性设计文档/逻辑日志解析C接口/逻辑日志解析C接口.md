Created by 马志宏, last modified on 三月 21, 2024

### 背景

YashanDB需要支持CDC功能，往其他类型数据库（oracle，MySQL等）实时同步数据。基本原理是，从redo里解析出  **逻辑日志**  ，组装成SQL，在其他数据库上执行，实现数据同步。

为此需要提供解析日志的API接口，用来从redo解析出逻辑日志

####   [接口](#接口)  

日志解析接口以lgm(log miner)开头，主要有：

void (LogCallback*)（level，fmt，。。。）

- CodResult   **lgmInit**  (MinerHandler* handler, LogCallback* func)
- void   **lgmDestory**  (MinerHandler* handler)
- CodResult   **lgmBufExtent**  (MinerHandler* handler，CodUint64 bufSize)           // 用来扩展解析buffer，默认内存是128M：64M读文件buffer，64M解析缓存
- void   **lgmSetRedoFiles**  (MinerHandler* handler, CodChar** redoPath, CodUint32 redoCount)
- void   **lgmSetArchPath**  (MinerHandler* handler, CodChar* archPath)
- void   **lgmSetPoint**  (MinerHandler* handler, RdPoint point, CodUint64 scn)         // 设置日志解析开始点
- void   **lgmGetPoint**  (MinerHandler* handler, RdPoint* point, CodUint64* scn)    // 获取当前日志解析点
- void   **lgmParseLob**  (MinerHandler* handler, CodChar* data, CodUint32 size, LogMinerLobCoupon* coupon);   // lob列的值是LobCoupon结构体，需要单独解析
- CodResult   **lgmFetch**  (MinerHandler* handler, CodUint32* type, LogMinerResult* result, CodUint32* errorCode)每调用一次，返回一个DDL日志或者DML日志的解析结果


```
typedef struct StLogMinerCols {
    CodUint32  columnCount;
    CodUint32* columnIds; // 列id数据
    Coduint32* size;      // size数组，size为INVALID 0xFFFF表示NULL
    CodChar**  data;      // data数组
} LogMinerCols;

typedef struct StLogMinerDML {
    CodUint64    objectId; // 对象ID
    CodUint32    ssn;      // sql序列号，用于rollback to savepoint
    LogMinerCols data;  // insert和update改动的列数据
    LogMinerCols where; // update和delete的where条件列数据
} LogMinerDML;

typedef struct StLogMinerDDL {
    CodUint64 objectId;
    CodChar*  sql; // DDL原始sql语句
} LogMinerDDL;

typedef struct StLogMinerXACT {
    CodUint64 scn;  // 事务结束scn
    CodDate   time; // scn对应的时间
    RdPoint   point;
} LogMinerXACT;

typedef struct StLogMinerLob {
    CodUint64 xid;
    CodUint64 lobId;
    CodUint32 offset;
    CodUint32 size;
    CodChar*  data;
} LogMinerLob;

typedef struct StLogMinerLobCoupon {
    CodUint64 lobId;   // isInRow为FALSE时有效
    CodBool   isInRow; // TRUE：数据直接记在行内，FALSE：数据记录在LOB里
    CodUint8  unused;  // 对齐字段，无意义
    CodUint16 dataSize; // isInRow为TRUE时有效,表示data长度
    CodChar*  data;     // isInRow为TRUE时有效,表示行内存储的数据
} LogMinerLobCoupon;

typedef enum EnLogMinerType {
    MINER_INSERT,
    MINER_UPDATE,
    MINER_DELETE,
    MINER_LOB,
    MINER_DDL,
    MINER_XACT_BEGIN,
    MINER_XACT_COMMIT,
    MINER_XACT_ROLLBACK,
    MINER_ROLLBACK_SAVEPOINT,
} LogMinerType;

typedef enum EnLogMinerError {
    ERROR_BUF_SIZE,     // buffer大小不足
    ERROR_FILE_READ,    // 读文件失败
    ERROR_INVALID_FILE, // 文件头校验失败 
    ERROR_NO_MORE_LOG,  // 日志已经解析到结尾了，没有更多的日志了
    ERROR_FILE_NOT_FOUND, // redo文件或归档文件没找到，可能被清理了
} LogMinerError;

typedef struct StLogMinerResult {
    CodUint64 xid;
    CodUint64 lsn;
    CodUint32 handlerId;
    
    union {
        LogMinerDML  dml;
        LogMinerDDL  ddl;
        LogMinerXACT xact;
        LogMinerLob  lob;
    }
} LogMinerResult;

```

####   [日志读取](#日志读取)  

redo文件的句柄可以长期持有，不用每次解析重新打开文件

根据传入的point，先在归档路径里找对应的文件，然后在redo里找对应的文件，未找到则报错ERROR_FILE_NOT_FOUND

找到日志后，读取pack，并遍历group，解析每一条record，直到找到第一个XACT_BEGIN日志，再开始日志解析

数据库会一直产生日志，工具解析日志，当日志解析到current日志结尾时，如何检测新日志产生？

1. 尝试读取下一个pack，如果校验失败，sleep，继续尝试
1. 优点：逻辑简单。缺点：没有新日志产生时，产生不必要的读IO，sleep时间短，读IO变大，sleep时间长，解析延迟高
1. 读到结尾后，报错误码，上层工具去不停查询视图，当新产生日志后，再调用  **lgmFetch**  继续解析
1. 优点：不会产生额外的读IO。缺点：需要工具适配，查询间隔也影响解析延迟
1. 使用linux文件监控接口，对文件的修改操作进行监控，当发生修改后，触发事件，继续解析
1. 优点：延迟最小，没有额外读IO。缺点：实现较为复杂，缺少充分调用，可能存在未知问题（比如是否影响写IO性能）


####   [日志解析](#日志解析)  

初始化后，会创建session队列，队列足够长，每个session有唯一的ID，对应于日志group里的handler Id。session上有当前事务，数据缓存

#####   [事务日志解析：](#事务日志解析)  

1. 解析到XACT_BEGIN后，根据handlerId，找到对应的session，设置其事务状态，初始化数据缓存，告诉工具事务开始
1. 解析到XACT_COMMIT/XACT_ROLLBACK后，将该session上未结束的DML日志丢弃，告诉工具事务提交或者回滚
1. 解析到ROLLBACK_SAVEPOINT，将该session上未结束的DML日志丢弃，并返回savepoint的xid和ssn给工具，让工具把这个事务内，  **比该ssn大的所有DML丢弃**


#####   [HEAP表解析流程：](#heap表解析流程)  

1. 如果某个日志的handlerId对应的session没有初始化，说明该session的事务没开始，忽略这个日志，继续解析
1. 如果DML日志对应的session已经初始化，则判断改session上次的DML操作状态
    1. 如果上次DML状态是END，当前日志isFirst，则判断是否为行链接
    1.         - 如果不是行链接，则一条日志里记录了所有的数据，包括where条件，解析出数据，返回给工具，并标记DML状态为END
        - 如果是行链接，则这条日志只记录了部分数据，按列Id缓存数据，标记DML状态为RUNNING

    1. 如果上次DML状态是RUNNING，判断当前日志类型
    1.         - 当前日志不是isFirst的，说明是行链接的一部分，按列Id缓存数据
        - 当前日志是LOGT_MINER_END，说明行链接解析结束了，把缓存的数据，返回给工具，并标记DML状态为END
        - 当前日志是isFrist，说明上次DML没有完成就失败了，丢弃上次DML数据，缓存当前DML数据
        - 当前日志是Rollback类型，也说明上次DML没有完成就失败了，丢弃上次DML数据

1. 如果解析到XACT_END日志，判断是否有session持有对应XID
    1. 如果有，说明这个session的事务已经启动，将该session上未结束的DML数据清空，告诉工具事务结束
    1. 如果没有，说明事务没开始，忽略这条日志
1. 如果解析到一个LOB日志，不需要缓存，直接返回给工具，由工具去组装
1. 遇到DDL日志，直接返回给工具


#####   [TAC表DML解析流程：](#tac表dml解析流程)  

1. 如果上次DML状态是END，当前日志是LOG_MINER_BEGIN，标记DML状态为RUNNING
1. 如果上次DML状态是RUNNING，判断当前日志类型
1.     - 当前日志是  **LOGT_MINER_SWF_INDEX**  ，则为update或delete的where条件
    - 当前日志是SWF BIT或BYTE类型，说明是定长列，缓存数据（如果是第一个batch，则根据行个数申请资源）
    - 当前日志是HEAP insert或update类型，说明是变长列，分别解析出每行对应的值，存入缓存
    - 当前日志是LOG_MINER_END，说明batch解析结束了，标记DML状态为END，把缓存的数据，一行一行返回给工具
    - 当前日志是LOG_MINER_BEGIN，说明上次DML没有完成就失败了，丢弃上次DML数据，缓存当前DML数据
    - 当前日志是Rollback类型，也说明上次DML没有完成就失败了，丢弃上次DML数据

1. 遇到DDL日志，直接返回给工具


####   [BUFFER管理](#buffer管理)  

解析过程，可能遇到很多handler并发的情况，而且每一行的长度不是固定的，在TAC表解析时，还会遇到一次性解析多行的情况。所以直接给每个handler申请固定长度的buffer不合适。为此，buffer要设计成动态申请和释放，buffer不足时，支持扩容

- 将buffer分为很多大小相同的block，每个block大小为64K，初始化时，有1024个block
- 每个block都有一个head，记录了usedSize，nextBlock等信息
- 全局有1个指针数组free_list，空闲的block挂在这里，每个session也有自己的block_list
- session开始解析DML或LOB时，申请一个block，后续空间不足时，继续申请
- session结束解析DML时，释放block到free_list
- 如果free_list为空，无法继续申请block时，报ERROR_BUF_SIZE错误码，工具可以调用  **lgmBufExtent**  去扩展内存，继续解析
- 内存只能扩展，不能释放，直到调用  **lgmDestory**


####   [编译和调用](#编译和调用)  

在CMakeList里，通过include_directories将所需要的头文件直接引入，这样就不需要依赖其他so，生成单独的so，名字:libyas_logminer.so

java调用可以使用JNI方式，需要java层封装适配接口

####   [使用流程](#使用流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396e0ca1ad9a3311dc94ec/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFFQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM4MTQsImV4cCI6MTc4MjMyNDYxNH0.x0MKjw7njWcFTiUSZJqXdcK1O1JfnNE-B5EbgS84vAc)

![](https://pingcode.yasdb.com/atlas/files/public/67396e0ca1ad9a3311dc94ed/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFFQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM4MTQsImV4cCI6MTc4MjMyNDYxNH0.x0MKjw7njWcFTiUSZJqXdcK1O1JfnNE-B5EbgS84vAc)

1. 执行  **lgmInit**  ，初始化handler
1. 查询  **v$logfile**  ，获取所有redo文件路径，通过  **lgmSetRedoFiles**  设置redo文件路径
1. select VALUE from v$parameter where NAME='ARCHIVE_LOCAL_DEST', 获取归档路径，通过  **lgmSetArchPath**  设置归档路径
1. 在表上开启附加日志
1. 查询  **v$database**  视图，获取FLUSH_POINT和SCN，  **然后执行全量导入**  （闪回查询）
1. 通过  **lgmSetPoint**  设置解析开始点，即第5步查到的点
1. 执行  **lgmFetch**  ，逐条解析日志
1. 解析结束后，调用  **lgmDestory**  释放资源


####   [异常场景](#异常场景)  

1. 传入的redo文件和归档路径不正确，lgmFetch会报错
1. 发生了归档清理，删除了需要的归档，lgmFetch报错
1. 正在解析的过程中，如果发生日志切换或者删除了redo，导致读写并发，可以从checksum校验该情况，则尝试寻找归档，如果不存在，则报错
1. 正在解析的过程中，新增了redo文件，当解析到下个文件的时候，报错找不到，需要重新查询视图，设置新的redo文件路径
1. 内存不足时，lgmFetch会报错误码，此时可以执行  **lgmBufExtent**  扩展内存，每次至少扩展1M
1. 当redo解析到结尾，并且一段时间没有新日志产生，报ERROR_NO_MORE_LOG错误码，此时工具需要查询视图，看flush_point有没有更新，没有更新则sleep，更新后继续解析


####   [测试用例](#测试用例)  

so文件无法独立测试，需要编写ut用例进行封装，ut用例需要提供元数据缓存，数据类型转换，视图查询等功能测试时构造相同属性的两个表，一个模拟源数据库，一个模拟目标数据库

1. 单线程执行DML，解析顺序保持一致，同步到目标表后，数据一致
1. 多线程执行DML，解析，单并发同步到目标表后，数据一致
1. 多线程执行DML，解析，多并发同步到目标表后，数据一致
1. 不同表类型，LCS，TAC，EPC，HEAP
1. 不同索引类型，primary，unique，all
1. 列存表批量导入场景


DOC

|接口名称|接口函数声明|接口说明|参数说明|
|---|---|---|---|
|lgmInit|CodResult lgmInit(LgmManager** lgmPointer, CodChar* logPath, CodChar* logLevel);|初始化LgmManager指针|*   [1] lgmPointer: 需要初始化的LgmManager指针，初始化过程将申请必要的内存，并将该指针指向该内存<br>*   [2] logPath: run log目录，解析过程中产生的log信息将记录将记录到该目录的run.log文件 <br>*   [3] logLevel: run log的级别，有DEBUG，INFO，ERROR，ALL级别<br>*   [4] 返回结果：COD_SUCCESS为初始化成功，COD_ERROR为初始化失败|
|lgmDestory|CodVoid lgmDestory(LgmManager* lgmm);|释放LgmManager指针|*   [1] lgmm: 需要释放的LgmManager指针，将释放解析过程中申请的所有内存，关闭打开的文件句柄<br>*   [2] 返回结果: 空|
|lgmSetRedoFiles|CodVoid lgmSetRedoFiles(LgmManager* lgmm, CodChar** redoPath, CodUint32 redoCount);|设置redo文件的绝对路径|*   [1] lgmm: LgmManager指针<br>*   [2] redoPath: redo文件的绝对路径数组<br>*   [3] redoCount: redo文件的个数，即redoPath数组长度<br>*   [4] 返回结果: 空|
|lgmSetArchPath|CodVoid lgmSetArchPath(LgmManager* lgmm, CodChar* archPath);|设置归档目录的绝对路径|*   [1] lgmm: LgmManager指针<br>*   [2] archPath: 归档目录的绝对路径<br>*   [3] 返回结果：空|
|lgmSetPoint|CodVoid lgmSetPoint(LgmManager* lgmm, RdPoint point, CodUint64 scn);|设置开始解析的redo位置|*   [1] lgmm: LgmManager指针<br>*   [2] point: 开始解析的redo日志点<br>*   [3] scn: 开始解析的scn<br>*   [4] 返回结果：空|
|lgmGetPoint|CodVoid lgmGetPoint(LgmManager* lgmm, RdPoint* point, CodUint64* scn);|获取当前解析的redo位置|*   [1] lgmm: LgmManager指针<br>*   [2] point: 当前的redo日志点<br/>*   [3] scn: 当前的scn<br/>*   [4] 返回结果：空|
|lgmExtendBuffer|CodResult lgmExtendBuffer(LgmManager* lgmm, CodUint64 bufSize);|扩展内存|*   [1] lgmm: LgmManager指针<br/>*   [2] bufSize: 本次扩展的内存大小<br/>*   [3] 返回结果：COD_SUCCESS为内存扩展成功，COD_ERROR为内存扩展失败|
|lgmGetBufferSize|CodUint64 lgmGetBufferSize(LgmManager* lgmm);|获取当前已申请的内存总大小|*   [1] lgmm: LgmManager指针<br/>*   [2] 返回结果：当前已申请的内存总大小|
|lgmParseLob|CodVoid lgmParseLob(CodChar** data, CodUint32 col, CodUint32 size, LogMinerLobCoupon* minerCoupon);|LOB列数据的独立解析接口|*   [1] data: 列数据数组<br>*   [2] col：LOB列在数组中的位置<br/>*   [3] size: LOB列数据长度<br/>*   [4] minerCoupon: LOB列的解析结果，如果是行内存储，则minerCoupon上包含数据，如果是行外存储，minerCoupon上包含LobId<br/>*   [5] 返回结果：空|
|lgmFetch|CodResult lgmFetch(LgmManager* lgmm, CodUint32* type, LogMinerResult* result, CodUint32* errorCode);|获取一条逻辑日志|*   [1] lgmm: LgmManager指针<br>*   [2] type: 逻辑日志类型<br/>*   [3] result: 逻辑日志结果集<br/>*   [4] errorCode: 失败类型<br/>*   [5] 返回结果：COD_SUCCESS为解析成功，COD_ERROR为解析失败|


##   [初始化](#初始化)  

###   [初始化LgmManager指针](#初始化lgmmanager指针)  

```
CodResult lgmInit(LgmManager** lgmPointer, CodChar* logPath, CodChar* logLevel);

```

使用该函数初始化一个LgmManager指针，调用其他接口时，需要将该指针变量传入，示例：

```
LgmManager* lgmm = NULL;
CodChar* logPath = "/home/test/logminer/runlog";
CodChar* logLevel = "INFO";
  
if (lgmInit(&amp;lgmm, logPath, logLevel) != COD_SUCCESS) {
    printf("lgmInit failed\n");
}

```

lgmInit失败的场景：

1. 内存不足，该函数会申请130M左右的内存
1. log路径，log级别不正确


###   [设置redo和归档路径](#设置redo和归档路径)  

```
CodVoid lgmSetRedoFiles(LgmManager* lgmm, CodChar** redoPath, CodUint32 redoCount);
CodVoid lgmSetArchPath(LgmManager* lgmm, CodChar* archPath);

```

通过查询V$LOGFILE获取所有redo文件的路径，查询参数得到归档路径，然后调用上述函数设置路径，示例：

```
CodChar* redoPaths[3] = {"/home/test/data/redo1", "/home/test/data/redo2", "/home/test/data/redo3"};
CodChar* archPath = "/home/test/archive";

lgmSetRedoFiles(lgmm, redoPaths, 3);
lgmSetArchPath(lgmm, archPath);

```

###   [设置解析开始点](#设置解析开始点)  

```
CodVoid lgmSetPoint(LgmManager* lgmm, RdPoint point, CodUint64 scn);

```

设置开始点之前，确保要解析的表，已经开启了附加日志。开始点可以通过V$DATABASE视图得到当前日志点和当前SCN，解析API只解析后续新产生的redo。

##   [执行解析](#执行解析)  

###   [获取一条逻辑日志](#获取一条逻辑日志)  

```
CodResult lgmFetch(LgmManager* lgmm, CodUint32* type, LogMinerResult* result, CodUint32* errorCode);

```

执行该函数后，如果解析到一条含有附加日志的redo，就会返回COD_SUCCESS，然后根据type，从result里获取相应的数据，其中type和LogMinerResult定义如下：

```
typedef enum EnLogMinerType {
    MINER_INSERT = 1,
    MINER_UPDATE,
    MINER_DELETE,
    MINER_LOB,
    MINER_DDL,
    MINER_XACT_BEGIN,
    MINER_XACT_COMMIT,
    MINER_XACT_ROLLBACK,
    MINER_ROLLBACK_SAVEPOINT,
} LogMinerType;

typedef struct StLogMinerResult {
    CodUint64 lsn; // 日志序列号，可用于进度跟踪
    CodUint32 xid; // 事务ID
    CodUint32 handlerId; // 会话ID

    union {
        LogMinerDML  dml;   // 对应 MINER_INSERT，MINER_UPDATE，MINER_DELETE 类型
        LogMinerDDL  ddl;   // 对应 MINER_DDL 类型
        LogMinerXACT xact;  // 对应 MINER_XACT_BEGIN，MINER_XACT_COMMIT，MINER_XACT_ROLLBACK，MINER_ROLLBACK_SAVEPOINT 类型
        LogMinerLob  lob;   // 对应 MINER_LOB 类型
    };
} LogMinerResult;

```

###   [解析DML](#解析dml)  

类型为MINER_INSERT，MINER_UPDATE，MINER_DELETE时，从result.dml解析出数据，LogMinerDML定义如下：

```
typedef struct StLogMinerCols {
    CodUint32  columnCount; // 列个数
    CodUint16* columnIds;   // 列ID的数组
    CodUint16* size; // 列的长度数组
    CodChar**  data; // 列的数据数组
} LogMinerCols;

typedef struct StLogMinerDML {
    CodUint64    objectId; // 对象ID
    CodUint32    ssn;      // DML sql的序列号，同一条sql的ssn相同
    LogMinerCols data;     // 行数据，INSERT，UPDATE的数据列
    LogMinerCols where;    // 索引数据，UPDATE，DETELE的where条件列
} LogMinerDML;

```

因为redo日志不会记录每个列的数据类型，只能得到数据字节和长度，要解析到完整的DML sql语句，需要调用者根据列类型去转换

###   [解析DDL](#解析ddl)  

DDL的内容时一条完整的DDL sql字符串

```
typedef struct StLogMinerDDL {
    CodUint64 objectId;
    CodChar*  sql;  
} LogMinerDDL;

```

###   [解析LOB块](#解析lob块)  

当LOB列存入长数据时，可能发生行外存储，存储到LOB对象，LOB块含有lobId，一条数据的lobId是相同的。如果遇到  **相同lobId的数据，需要上层进行拼接**  ，组成完整的LOB数据

```
typedef struct StLogMinerLob {
    CodUint64 lobId; // LOB块的ID
    CodUint32 xmap;  // 事务ID
    CodUint32 size;  // 该LOB分片的长度
    CodChar*  data;  // 该LOB分片的数据
} LogMinerLob;


```

###   [解析事务日志](#解析事务日志)  

事务包括BEGIN，COMMIT，ROLLBACK和ROLLBACK  SAVEPOINT，这些对应事务ID是result.xid，其他信息记在以下结构体内：

```
typedef struct StLogMinerXACT {
    CodUint32 ssn; // 仅对ROLLBACK SAVEPOINT有效，表示小于等于该ssn的DML语句，都要回退掉
    CodUint64 scn; // 仅对COMMIT，ROLLBACK，表示事务结束时的scn
    CodDate   time; // scn对应的时间
    RdPoint   point; // 事务日志对应的redo日志点
} LogMinerXACT;

```

需要注意的是，MINER_ROLLBACK_SAVEPOINT可能是用户下发的rollback to savepoint操作产生的，也可能是执行失败，数据库内部产生的，如果遇到该类型日志，要丢弃该事务中，ssn小于等于result.xact.ssn的DML。

##   [异常场景处理](#异常场景处理)  

lgmFetch失败场景可以根据errorCode分类：

1. MINER_ERROR_BUF_SIZE：
1. 解析时内存不足，可能是大并发事务或者遇到批量insert，数据量较大，可以调用lgmExtendBuffer来扩展内存，然后重新lgmFetch，建议每次扩展至少1M内存
1. MINER_ERROR_FILE_READ：
1. 文件读取失败，可能是redo或归档路径不对，也可能是权限获其他问题，可从run log里找到具体原因。如果是路径错误，重新设置路径
1. MINER_ERROR_INVALID_FILE：
1. redo或归档文件的checksum不正确，可能是文件已损坏
1. MINER_ERROR_NO_MORE_LOG：
1. redo日志已经解析到最后，没有更多的日志了，可能数据库此时没有业务。此时可以查询数据库视图，看FLUSH_POINT是否不变，等FLUSH_POINT更新后再继续解析
1. MINER_ERROR_REDO_NOT_FOUND：
1.     - 可能是新增了redo文件，但是解析接口没有同步，需要重新设置redo路径
    - 可能是归档备机清理了，需要增大归档预留空间，或者关闭自动清理改为手动清理



python调用logminer示例

```
# -*- coding: utf-8 -*-

import os
from ctypes import *

home = os.getenv('YASDB_HOME')
so_path = home + '/lib/libyas_logminer.so'

lob_pool = {}

MINER_INSERT = 1
MINER_UPDATE = 2
MINER_DELETE = 3
MINER_LOB = 4
MINER_DDL = 5
MINER_XACT_BEGIN = 6
MINER_XACT_COMMIT = 7
MINER_XACT_ROLLBACK = 8
MINER_ROLLBACK_SAVEPOINT = 9


class RdPoint(Structure):
    _pack_ = 4
    _fields_ = [("lfn", c_uint64),
                ("rstId", c_uint32),
                ("asn", c_uint32),
                ("blockId", c_uint32)]


class Cols(Structure):
    _pack_ = 8
    _fields_ = [("colCount", c_uint32),
                ("colIds", POINTER(c_uint16)),
                ("size", POINTER(c_uint16)),
                ("data", POINTER(c_void_p))] # 二级指针， 必须用c_void_p， 不能用 c_char_p


class DML(Structure):
    _pack_ = 8
    _fields_ = [("objId", c_uint64),
                ("ssn", c_uint32),
                ("data", Cols),
                ("where", Cols)]


class LOB(Structure):
    _pack_ = 8
    _fields_ = [("lobId", c_uint64),
                ("xmap", c_uint32),
                ("size", c_uint32),
                ("data", c_char_p)]


class DDL(Structure):
    _pack_ = 8
    _fields_ = [("objectId", c_uint64),
                ("sql", c_char_p)]


class XACT(Structure):
    _pack_ = 8
    _fields_ = [("ssn", c_uint32),
                ("scn", c_uint64),
                ("time", c_int64),
                ("point", RdPoint)]


class Output(Union):
    _pack_ = 8
    _fields_ = [("dml", DML),
                ("ddl", DDL),
                ("lob", LOB),
                ("xact", XACT)]


class LgmResult(Structure):
    _pack_ = 8
    _fields_ = [("lsn", c_uint64),
                ("xid", c_uint32),
                ("handlerId", c_uint32),
                ("output", Output)]


class LgmLobCoupon(Structure):
    _pack_ = 8
    _fields_ = [("lobId", c_uint64),
                ("inRow", c_uint8),
                ("unused", c_uint8),
                ("size", c_uint16),
                ("data", c_char_p)]


def openApi():
    api = CDLL(so_path)

    api.lgmInit.argtypes = [POINTER(c_void_p), c_void_p, c_void_p]
    api.lgmInit.restype = c_int32
    api.lgmDestory.argtypes = [c_void_p]
    api.lgmSetRedoFiles.argtypes = [c_void_p, POINTER(c_char_p), c_uint32]
    api.lgmSetArchPath.argtypes = [c_void_p, c_char_p]
    api.lgmSetPoint.argtypes = [c_void_p, RdPoint, c_uint64]
    api.lgmGetPoint.argtypes = [c_void_p, POINTER(RdPoint), POINTER(c_uint64)]
    api.lgmFetch.argtypes = [c_void_p, POINTER(c_uint32), POINTER(LgmResult), POINTER(c_uint32)]
    api.lgmFetch.restype = c_int32
    api.lgmParseLob.argtypes = [POINTER(c_char_p), c_uint32, c_uint32, POINTER(LgmLobCoupon)]

    return api


# 根据列的类型，转换二进制数据为字符串
def data2Str(column_type, data, size):
    if column_type == "BOOLEAN":
        val = cast(data, POINTER(c_bool))
        if val.contents.value:
            return 'true'
        else:
            return 'false'

    if column_type == "TINYINT":
        val = cast(data, POINTER(c_int8))
        return str(val.contents.value)

    if column_type == "SMALLINT":
        val = cast(data, POINTER(c_int16))
        return str(val.contents.value)

    if column_type == "INTEGER":
        val = cast(data, POINTER(c_int32))
        return str(val.contents.value)

    if column_type == "BIGINT":
        val = cast(data, POINTER(c_int64))
        return str(val.contents.value)

    if column_type == "CHAR":
        val = cast(data, c_char_p)
        return '\'' + str(val.value[0:size].decode('utf-8')) + '\''

    if column_type == "VARCHAR":
        val = cast(data, c_char_p)
        return '\'' + str(val.value[0:size].decode('utf-8')) + '\''

    if column_type == "FLOAT":
        assert 0

    if column_type == "DOUBLE":
        assert 0

    if column_type == "NUMBER":
        assert 0

    if column_type == "DATE":
        assert 0

    assert 0


# out是Cols结构体，对应DML结构体里的 data 或者 where
# table是表元数据
# 该函数把每一列的data，解析成字符串
def parseColData(out, table):
    col_list = []
    val_list = []

    if table.tab_name == 'None':
        return col_list, val_list

    for i in range(out.colCount):
        colId = out.colIds[i]
        colSz = out.size[i]

        if table.col_types[colId] == 'CLOB' or table.col_types[colId] == 'BLOB':
            lob = LgmLobCoupon()
            api.lgmParseLob(out.data, i, colSz, byref(lob))
            if lob.inRow:
                lobStr = '\'' + lob.data[0:lob.size].decode('utf-8') + '\''
                col_list.append(table.col_names[colId])
                val_list.append(str(lobStr))
            else:
                lobStr = '\'' + lob_pool.get(lob.lobId, '') + '\''
                col_list.append(table.col_names[colId])
                val_list.append(str(lobStr))
            continue

        val_str = data2Str(table.col_types[colId], out.data[i], colSz)

        col_list.append(table.col_names[colId])
        val_list.append(val_str)

    return col_list, val_list


```

## Attachments:

[截图_20220414092514.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGM4OTcwYzJhZjRmNTIxNjc3IiwicmVmX2lkIjoiNjczOTZlMGM3MjgyMDZlZmI5MmYyNTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODE0LCJleHAiOjE3ODI0MDAyMTR9.nXSR02x31rewX9tptCmJPESnagZPESBUhycdtQCwBwE)

 (image/png)    


[截图_20220429110457.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGNhMWFkOWEzMzExZGM5NGViIiwicmVmX2lkIjoiNjczOTZlMGM3MjgyMDZlZmI5MmYyNTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODE0LCJleHAiOjE3ODI0MDAyMTR9.uaoyLpF96ZQaQgOpyEBHR8MEOJpFv0546MXDAlqSZ0M)

 (image/png)    


[00逻辑日志API.md](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGM4OTcwYzJhZjRmNTIxNjc5IiwicmVmX2lkIjoiNjczOTZlMGM3MjgyMDZlZmI5MmYyNTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODE0LCJleHAiOjE3ODI0MDAyMTR9.TLXjmPYSAtF1Hp38eziUazKWW0lNszQoIHp7xqVfE1Y)

 (application/octet-stream)    


[逻辑日志API使用介绍.md](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGM4OTcwYzJhZjRmNTIxNjdhIiwicmVmX2lkIjoiNjczOTZlMGM3MjgyMDZlZmI5MmYyNTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODE0LCJleHAiOjE3ODI0MDAyMTR9.O8_nyem7FBSR7OS4R-U8SkbqEIi26L2NEhThPk2RYFQ)

 (application/octet-stream)    


[逻辑日志接口列表.md](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGM4OTcwYzJhZjRmNTIxNjdiIiwicmVmX2lkIjoiNjczOTZlMGM3MjgyMDZlZmI5MmYyNTVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODE0LCJleHAiOjE3ODI0MDAyMTR9.WHExPkH4NgEzcis0zsmfleQ0J594puneD6eBZ3xzU0k)

 (application/octet-stream)    


## Comments:

|  [](null)  ,1. RdPoint的具体结构好像没看到；
1. XACT是对应commit，begin不会有记录是吧？
1. LogMinerResult的lsn是什么含义？
1. lgmBufExtent，如果这个buf不够大是什么后果？
1. DML, DDL内给的是ObjectID，和表的对应关系，需要调用者自己去系统表/视图中去查对吧？
1. DML/DDL中是否要带scn，时间？
1. DDL的xid会是什么？
1. 怎么判断DML类型，是判断data和where当中的columns是否为0是吗？
1. DML的where，目前仅是主键/唯一键是吧？还是整行？
1. Lob是怎么使用，是同一个LobId的多个不同offset的Lob record拼成一个完整Lob，这仅是某一列是吧，也就是DML data的一部分？那么和DML event是怎么配合？
,Posted by chenyang at 四月 21, 2022 16:29|
|---|
|  [](null)  ,1. 结构如下，包含4个值，这些都可以在视图查到
,typedef struct StRdPoint {    
      CodUint64 lfn;    
      CodUint32 rstId;    
      CodUint32 asn;    
      CodUint32 blockId;    
  } RdPoint;,2.   XACT有两个日志，begin和commit,3. lsn是log sequence number，日志的序列号，递增的，可以用来查看解析进度，也可以不用,4. buf不够大，可能在高并发场景，尤其是列存表解析时容易出现内存不足,5. 解析工具感知不到元数据，需要工具去把objId和表对应起来，而且result里每一行的所有列，也是没有经过类型转换的，要根据列的属性转换成对应的类型,6. 没有带scn，因为这些都在事务内，所有XACT提交的那个scn就是它们的scn,7. xid是事务ID，唯一标识一个事务，但它不是递增的,8.   **lgmFetch**   里返回了type，   MINER_INSERT, MINER_UPDATE, MINER_DELETE,就能判断,9. where是在指定的表上指定的，可以指定主键，唯一索引，整行,10. 同一个lobID拼成一个完成的lob，它对应的是某个lob列的值，是DML的一部分。先拼好lob，然后把DML这一行解析出来，lob列对应的值就是lobId,Posted by mazhihong at 四月 21, 2022 17:02|
|  [](null)  ,追问：,1. RdPoint的几个字段含义可能需要再看下，然后如果是对RdPoint排序，大小关系应该是什么样？
1. XACT的begin, commit，scn和时间戳是各自不同的对吧，分别表示开始和结束的时间和scn；
1. buf不够大内存不足，从接口这个层面，是会报错吗？还是挂掉，或是阻塞？
1. DDL也有事务ID是吧，我原以为DML才有，那么一定是一个DDL一个事务，不存在多个DDL事务id一致吧？
1. “  where是在指定的表上指定的，可以指定主键，唯一索引，整行  ”，调用者指定吗？这个指定动作，是在哪里？
,Posted by chenyang at 四月 21, 2022 17:10|
|  [](null)  ,马志宏：,1. RdPoint， rstId只和failover有关系，这个你不用关心    
  asn 是日志文件号，每切换一次redo，都会加1    
  blockId是在文件里的具体位置，这个不用关心    
  lfn是日志刷盘需要，是一直递增的，可以用这个比较顺序
1. XACT的begin好像不记录scn，只记录xid。scn和时间是一一对应的，我也是把scn转成时间。
1. buf不够会报内存不足的错误码，调用内存扩展的接口后，可以继续解析
1. 一个DDL一个事务
1. 在另一个wiki里有开启表的附加日志的语法
,Posted by chenyang at 四月 21, 2022 17:22|
|  [](null)  ,1. buf扩展上限 1T
1. lgmGet。。获取内存，路径信息
1. run log callback接口待定
,Posted by mazhihong at 五月 07, 2022 15:10|
|  [](null)  ,测试用例：,1. 参考ha用例
1. 补充数据类型
1. 补充不同表，不同索引，列类型（带lob）
,Posted by mazhihong at 六月 08, 2022 12:05|
