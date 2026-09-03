Created by 陈楚坤, last modified on 十月 15, 2024

*详细设计-YDBRD-23035 : HashJoin性能优化 方案设计*

* IR链接：*    [YDBRD-22365](https://jira.yasdb.com/browse/YDBRD-22365?src=confmacro)    *-*  *hash join性能优化*  *设计中*

*SR链接：*    [YDBRD-23035](https://jira.yasdb.com/browse/YDBRD-23035?src=confmacro)    *-*  *hash join性能优化*  *完成*

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

华润银行单机行存部署形态，hash join性能与oracle差距较大。原有的代码实现存在明显的性能问题，需进行重构优化。

###   [1.2 调研文档](#12-调研文档)  

当前的hash join实现基于物化区框架实现，HashTable的实现也比较朴素，没有针对不同场景进行优化。内存的使用比较保守，没有针对内存充足的场景进行优化，存在明显的性能瓶颈。以下文档对hash join的性能问题进行了更详细的分析，同时给出了原型验证方案和验证结果。

性能问题分析：    [hash join性能问题分析和优化方向](https://conf.yasdb.com/pages/viewpage.action?pageId=135606968)  

*原型方案验证：*    [hash join方案](https://conf.yasdb.com/pages/viewpage.action?pageId=135600808)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|hash join执行流程抽象|增加一个抽象层，统一接口，支持扩展不同的hash join实现|是|是|
|功能|行格式定义和编解码|将key和value存储在一起|是|是|
|功能|行数据存储|支持缓存，用于顺序存储和读取行数据的容器|是|是|
|功能|HashTable结构|简化结构、两阶段build、bloom filter、compaction、partition|是|是|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|监控hash join性能指标|----|是|是|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|是|是|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


hash join性能优化是对原有hash join实现的一次彻底重构，从用户视角上不会感知到重构带来的功能上的变化，目标是具备更好的执行性能。

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无。

##   [2. 接口](#2-接口)  

SQL语法保持不变，新增以下会话级配置项：

- 1、_HASH_JOIN_ALGORITHM：hash join使用的算法，可配置为0和1，分别表示HDT和PARTITION，默认为PARTITION。
- 2、_HASH_AREA_SIZE：每次hash join可使用的最大内存大小，默认32MB，最小8M，最大8G。当hashtable的大小小于该值时，不会执行分区，会把整个hashtable放在内存。


##   [3. 规格与约束](#3-规格与约束)  

- 1、HashRow的大小不能超过65489字节。
- 2、最大支持256个分区。
- 3、单个分区的hash table最大大小为33521672。


##   [4. 特性](#4-特性)  

###   [4.1 hash join执行流程抽象](#41-hash-join执行流程抽象)  

将hash join的整个流程拆分为多个阶段，每个阶段对应一个抽象接口。然后再将整个过程抽象为一个状态机，通过状态变更去驱动hash join的执行。当要实现新的hash join算法时，只需要按要求实现这些抽象接口即可。

对hash join流程进行拆分和抽象的过程可见文档：    [hash join流程抽象](https://conf.yasdb.com/pages/viewpage.action?pageId=138560317)  

```
typedef enum EnHashJoinAlgorithm {
    HASH_JOIN_ALGORITHM_HDT = 0,
    HASH_JOIN_ALGORITHM_PARTITION,
    __HASH_JOIN_ALGORITHM_COUNT__,
} HashJoinAlgorithm;

typedef enum EnHashJoinType {
    HASH_JOIN_INNER = 0,
    HASH_JOIN_LEFT_OUTER,
    HASH_JOIN_RIGHT_OUTER,
    HASH_JOIN_FULL_OUTER,
    HASH_JOIN_SEMI,
    HASH_JOIN_RIGHT_SEMI,
    HASH_JOIN_ANTI,
    HASH_JOIN_RIGHT_ANTI,
    __HASH_JOIN_COUNT__,
} HashJoinType;

typedef enum EnHashJoinStage {
    JOIN_STAGE_NEXT_PARTITION = 0,          // increment currPart and build hash map and initialize probe fetch and update buildIsEmpty state
    JOIN_STAGE_FETCH_PROBE,                 // fetch probe and update probeIsEof state
    JOIN_STAGE_FIND,                        // make key and probe hashtable and update isMatched/buildRowIsVisited state;
    JOIN_STAGE_NEXT_ROW,                    // fetch next row and update nextRowIsEof/buildRowIsVisited state
    JOIN_STAGE_FETCH_PROBE_FEED_BUILD_NULL, // fetch probe and update probeIsEof state
    JOIN_STAGE_FETCH_BUILD_FEED_PROBE_NULL, // fetch hashtable and update buildIsEof state
    JOIN_STAGE_EOF,                         // eof
    __JOIN_STAGE_COUNT__,
} HashJoinStage;

```

- HashJoinAlgorithm：hash join算法，目前支持两种算法
- HashJoinType：hash join类型
- HashJoinStage：拆分后的hash join阶段


```
typedef struct StHashJoinContext HashJoinContext;

typedef CodResult (*HashJoinFunc)(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
typedef CodResult (*HashJoinCloseFunc)(AnlStmt* stmt, HashJoinContext* context);
typedef CodResult (*HashJoinGetColumnValue)(AnlStmt* stmt, HashJoinContext* context, VarColumn* column, Variant* value);
typedef CodVoid (*HashJoinSetNull)(AnlStmt* stmt, HashJoinContext* context, VarColumn* column, CodBool isNull);

typedef struct StHashJoinOperator {
    HashJoinFunc            prepare;
    HashJoinFunc            init;
    HashJoinFunc            append;         // exec and fetch build table, append row data and update buildIsEmpty state
    HashJoinFunc            buildPartition; // partition build table row data
    HashJoinFunc            probePartition; // exec and fetch probe table, partition probe table row data
    HashJoinFunc            initFetch;
    HashJoinCloseFunc       close;
    HashJoinFunc            feedProbeNull;
    HashJoinFunc            feedBuildNull;
    HashJoinSetNull         setNull;
    HashJoinGetColumnValue  getColumnValue;
    HashJoinGetColumnValue  getColumnValueIsNull;

    HashJoinFunc    probeOperators[__JOIN_STAGE_COUNT__];
} HashJoinOperator;

```

HashJoinOperator定义了hash join所有的抽象接口。

```
typedef struct StHashJoinState {
    CodUint16	    partCount;
    CodUint16	    currPart;
    union {
        CodBool     stageState;
        union {
            CodBool probeIsEof;
            CodBool buildIsEof;
            CodBool nextRowIsEof;
            CodBool buildIsEmpty;
            CodBool isMatched;
        };
    };
    CodBool         nextPartIsEof;
    CodBool         needProjection;
    CodBool         buildRowIsVisited;
    CodBool         isFedNull;
    CodUint8        unused[3];
    HashJoinStage   currStage;
} HashJoinState;

```

HashJoinState保存hash join执行过程中的状态信息，它决定了下一步将执行什么操作。

```
typedef struct StHashJoinContext {
    HashJoinType        joinType;
    HashJoinAlgorithm   algorithm;
    HashJoinState       state;
    HashJoinOperator*   op;
    HashJoinInfo*       info;
    Expr**              probeExprs;
    CodBool             appended;
    CodBool             buildPartitioned;
    CodBool             probePartitioned;
    CodUint8            unused[5];
    CodUint64           resultCount;
    union {
        HdtContext*  hdtContext;
        PhjContext*  phjContext;
    };
} HashJoinContext;

```

HashJoinContext是hash join的上下文信息，通过枚举支持不同类型的hash join实现。

###   [4.2 行格式定义和编解码](#42-行格式定义和编解码)  

原有hash join的实现在构建hashtable时，是将关联条件相关的表达式作为key，build表的投影表达式作为value分离存储的。key和value分布存储在不同的页面上，通过RowId进行关联。新的实现将key和value分配在一起。通过新增MAT_ROW_NEW_HASH类型的行格式实现的。

格式为：| MatRowHead | key body | HashRowMate | value body|

```
typedef struct StRowData {
    CodUint16 size;
    CodUint8  data[];
} RowData;

typedef union UnRowDataId {
    struct {
        CodUint32   chunkId;
        CodUint16   offset;
        CodUint16   unused     : 14;
        CodUint16   isInvalid  : 1;
        CodUint16   unswizzled : 1;
    };
    RowData*        ptr;
} RowDataId;

typedef union UnHashRowMate {
    CodUint64   hash;
    CodUint64   count;
    RowDataId   next;
} HashRowMate;

typedef struct StMatNewHashRow {
    MatRowHead*     head;
    HashRowMate*    mate;
} MatNewHashRow;

CodResult matMakeHashKey(AnlStmt* stmt, MatKeyMaker* maker);
CodResult matMakeAndAppendHashValue(AnlStmt* stmt, MatKeyMaker* keyMaker, MatKeyMaker* valueMaker);
CodResult matMakeHashRow(AnlStmt* stmt, MatKeyMaker* keyMaker, MatKeyMaker* valueMaker);

void matDecodeHashKey(MatCache* keyCache, MatColumnLocator* locator);
void matDecodeHashValue(MatCache* valueCache, MatColumnLocator* locator);
void matDecodeHashRow(MatCache* keyCache, MatCache* valueCache, MatColumnLocator* locator);

```

matMakeHashKey用于构建MatNewHashRow的key部分，matMakeAndAppendHashValue用于往MatNewHashRow中追加value部分。matMakeHashRow执行matMakeHashKey和matMakeAndAppendHashValue。

matDecodeHashKey用于解码MatNewHashRow的key部分，matDecodeHashValue用于解码MatNewHashRow的value部分。matDecodeHashRow执行matDecodeHashKey和matDecodeHashValue。

###   [4.2 行数据存储](#42-行数据存储)  

原hash join行数据使用MatCache相关接口进行读写，在VM页面上的读写是通过slot进行定位，会有一个二次读写的开销。对于hash join来说，这个slot的没有意义的，可以优化掉。因此实现了一种新的存储行数据的方式。

![](https://pingcode.yasdb.com/atlas/files/public/67396c4ba1ad9a3311dc894d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBRUFBQUFBQUFFUUFBQUFBQWdBQUFBQ0FBQUJBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyMzIsImV4cCI6MTc4MjMxMTAzMn0.3caX5jOyNVP0JdrxRh48StHyFWnpwW13gWQV1MYi0G8)

```
typedef struct StRowData {
    CodUint16 size;
    CodUint8  data[];
} RowData;

typedef union UnRowDataId {
    struct {
        CodUint32   chunkId;
        CodUint16   offset;
        CodUint16   unused     : 14;
        CodUint16   isInvalid  : 1;
        CodUint16   unswizzled : 1;
    };
    RowData*        ptr;
} RowDataId;

typedef struct StRowChunk {
    CodUint32	    chunkId;
    CodUint32	    next;
    CodUint16	    rows;
    CodUint16	    offset;
    CodUint8        unused[12];
    RowChunk*       nextChunk;
    CodUint8	    data[];
} RowChunk;

typedef struct StRowCollection {
    VmContext   context;
    RowChunk*   currChunk;
    CodUint32   headChunkId;
    CodUint32   tailChunkId;
    CodUint32   chunks;
    CodUint32   rows;
} RowCollection;

typedef struct StRowChunkScanner {
    RowCollection*  collection;
    CodUint32       maxOpenChunks;
    CodUint32       openChunks;
    CodBool         needClose;
    CodBool         isEof;
    CodBool         unswizzled;
    CodUint8        unused[5];
    RowChunk*       currChunk;
    RowChunk*       headChunk;
} RowChunkScanner;

typedef struct StRowDataScanner {
    RowChunkScanner chunkScanner;
    CodUint16       offset;
    CodUint16       end;
    CodBool         isEof;
    CodUint8        unused[3];
    RowData*        currRow;
    RowDataId       rowId;
} RowDataScanner;


CodResult rcAllocChunk(RowCollection* collection, RowChunk** chunk);
CodVoid rcAppendChunk(RowCollection* collection, RowChunk* chunk);

CodResult rcOpen(AnlStmt* stmt, RowCollection *collection);
CodVoid rcClose(AnlStmt* stmt, RowCollection *collection);
CodResult rcMerge(AnlStmt* stmt, RowCollection* dst, RowCollection* src);
CodResult rcAppendRowData(RowCollection* collection, RowData* rowData, RowDataId* rowId);

CodResult rcScannerOpen(AnlStmt* stmt, RowCollection* collection,
                        RowChunkScanner* scanner, CodBool needClose, CodUint32 maxOpenChunks);
CodResult rcScannerClose(RowChunkScanner* scanner);
CodResult rcScannerNext(RowChunkScanner* scanner);

CodResult rdScannerOpen(AnlStmt* stmt, RowCollection* collection,
                        RowDataScanner* scanner, CodBool needClose, CodUint32 maxOpenChunks);
CodVoid rdScannerClose(RowDataScanner* scanner);
CodResult rdScannerNext(RowDataScanner* scanner);

```

RowData是对行数据的抽象，它只定义了一个size，表明行数据的大小，MatRowHead可以转换为RowData。

RowData存储在VM页面上，每个VM页面对应一个RowChunk，所有的RowChunk组成RowCollection。

RowChunkScanner用于遍历RowCollection中的RowData。只有RowCollection在未pinned时才可进行遍历，RowChunkScanner内部需要协调好VM页面的开关问题，避免重复打开。needClose参数用于标识每遍历完一个RowChunk后是否需要close，若为true表示遍历完后就close，否表示在rcScannerClose的时候再统一close。maxOpenChunks参数限制Scanner能同时打开的Chunk数，当打开的Chunk数大于该值时，在遍历完Chunk后就close。

RowDataScanner用于遍历存储在RowCollection中的RowData，基于RowChunkScanner实现。RowDataScanner通过RowDataId指向具体的RowData。RowDataId有两种状态，当RowData所在的RowChunk能被缓存时，unswizzled为false，可通过RowDataId::ptr指针直接引用RowData。当RowData所在RowChunk不能被缓存时，unswizzled为true，需通过RowDataId::chunkId和RowDataId::offset从指定RowChunk上读取。

###   [4.3 HashTable的组织结构](#43-hashtable的组织结构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c4ba1ad9a3311dc894e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBRUFBQUFBQUFFUUFBQUFBQWdBQUFBQ0FBQUJBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyMzIsImV4cCI6MTc4MjMxMTAzMn0.3caX5jOyNVP0JdrxRh48StHyFWnpwW13gWQV1MYi0G8)

整个HashTable由保存HashNewRow的RowCollection和hashMap构成，另外对于RIGHT OUTER JOIN和FULL OUTER JOIN两种join方式，还会有nullRowDataCollection，用于保存key存在NULL值的部分HashNewRow。

```
typedef struct StHashEntry {
    CodUint64   hashValue;
    RowDataId   rowId;
} HashEntry;

typedef struct StHashEntries {
    CodUint8    chunkHead[sizeof(RowChunk)];
    HashEntry   entries[];
} HashEntries;

typedef struct StHashMap {
    CodUint8        chunkHead[sizeof(RowChunk)];
    HashEntries*    chunks[];
} HashMap;

typedef struct StJoinHashTable {
    AnlStmt*        stmt;
    VmContext       context;
    HashMap*        hashMap;
    CodUint32       partId;
    CodUint32       hashSize;
    CodUint32       hashMask;
    CodUint32       maxOpenChunks;
    CodUint32       currCount;
    CodBool         isCountOpt;
    CodBool         isOpen;
    CodBool         aloneStoreNull;
    CodUint8        unused;
    RowCollection   rowDataCollection;
    RowCollection   nullRowDataCollection;
    RowChunk*       extraChunk;
    RowDataScanner  scanner;
} JoinHashTable;

CodResult htOpen(AnlStmt* stmt, JoinHashTable* ht, const HashJoinPlan* hsJoin, CodUint32 maxOpenChunks, CodUint32 partId);
CodVoid htResetHashMap(JoinHashTable* ht);
CodVoid htClose(AnlStmt* stmt, JoinHashTable* ht);
CodResult htAppendHashRow(AnlStmt* stmt, JoinHashTable* ht, MatNewHashRow* row);
CodResult htMerge(AnlStmt* stmt, JoinHashTable* dst, JoinHashTable* src, CodUint32 newPartId);
CodResult htBuild(AnlStmt* stmt, JoinHashTable* ht, CodUint32 distinct, CodBool needCompaction);

CodResult htFind(JoinHashTable* ht, MatNewHashRow* key, MatNewHashRow* row);
CodResult htNext(JoinHashTable* ht, MatNewHashRow* row);

typedef struct StHtScanner HtScanner;
typedef CodResult (*HtFetch)(HtScanner* scanner);

typedef struct StHtScanner {
    JoinHashTable*  ht;
    CodBool         onlyNoVisited;
    CodBool         isEof;
    CodBool         isNullScan;
    CodUint8        resetVisited;
    CodUint32       hashIndex;
    CodUint32       currCount;
    CodUint32       unused2;
    HashEntry*      currEntry;
    RowDataScanner  rowScanner;
    RowDataScanner  nullScanner;
    RowData*        currRow;
    HtFetch         fetchRowData;
} HtScanner;

CodResult htScannerOpen(AnlStmt* stmt, JoinHashTable* ht, HtScanner* scanner, CodBool onlyNoVisited, CodBool resetVisited);
CodResult htFetch(HtScanner* scanner);
CodVoid htScannerClose(HtScanner* scanner);

```

HashTable的构造过程分成两个阶段：append和build，先调用htAppendHashRow将数据append到RowCollection中，然后再调用htBuild根据数据构造hashMap。

htMerge用于将多个HashTable合并为一个HashTable。

htFind和htNext接口用于执行查找和遍历查找到的多个值。

HtScanner接口用于对整个HashTable进行遍历。

###   [4.4 分区](#44-分区)  

当HashTable无法完全放入内存时，需要对HashTable进行分区。当前最大支持256个分区。分区的数量由数据量决定。

- 1、根据统计信息，预估HashTable的大小，若大小小于_HASH_AREA_SIZE的大小，则将分区数初始化为1，否则按最大分区数进行分区。
- 2、append阶段按初始化好的分区数进行，append的过程中使用hll算法统计distinct值和生成包含各个分区统计信息的直方图。
- 3、append结束后，进入buildPartition阶段，根据distinct值、数据真实大小和直方图，决定最终的分区数。


若根据统计信息确定的初始分区数为1，最终由于统计信息不准确，数据量过大就需要执行extend操作，将一个分区表扩展为多个分区表。

若最开始初始化的分区数为256，根据distinct值和直方图会计算出一个最优的分区数。这时候需要进行分区合并。合并的规则如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396c4b8970c2af4f520adf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBRUFBQUFBQUFFUUFBQUFBQWdBQUFBQ0FBQUJBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBRUFBQUFRQUFBQUFBRUFBQUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAyMzIsImV4cCI6MTc4MjMxMTAzMn0.3caX5jOyNVP0JdrxRh48StHyFWnpwW13gWQV1MYi0G8)

```
#define PHJ_HLL_P                       14
#define PHJ_HLL_Q                       (64 - PHJ_HLL_P)
#define PHJ_HLL_REGISTERS               (1 &lt;&lt; PHJ_HLL_P)
#define PHJ_HLL_P_MASK                  (PHJ_HLL_REGISTERS - 1)

typedef struct StJoinHll {
    CodUint64   distinct;
    CodUint8    registers[PHJ_HLL_REGISTERS];
} JoinHll;

CodVoid joinHllOpen(JoinHll* hll);
CodVoid joinHllAdd(JoinHll* hll, uint64_t hashValue);
CodVoid joinHllCount(JoinHll* hll);

```

JoinHll实现了HyperLogLog算法，使用固定16KB的内存空间，实现O(1)时间复杂度统计build表的distinct值。用于预估后续需要建多大的hashMap。

```
typedef struct StJoinBloomFilter {
    RowCollection   collection;
    RowChunkScanner scanner;
    CodUint32	        chunks;
    CodUint32	        bits;
    CodUint32           bitMask;
    CodUint32	        unused;
    RowChunk*       data[PHJ_FILTER_MAX_CHUNKS];
} JoinBloomFilter;

```

布隆过滤器用于过滤probe表的HashNewRow，提升低匹配率场景的探测性能，同时在分区场景下减少probe表的物化。

```
typedef struct StJoinHistItem {
    CodUint64	size;
    CodUint32	count;
    CodUint32	distinct;
} JoinHistItem;

typedef struct StJoinHistogram {
    CodUint64		maxSize;
    CodUint64		totalSize;
    CodUint32		maxCount;
    CodUint32		totalCount;
    CodUint32       itemCount;
    CodUint32       itemMask;
    JoinHistItem	items[PHJ_MAX_PARTITION_COUNT];
} JoinHistogram;

CodResult joinHistOpen(AnlStmt* stmt, JoinHistogram* hist, CodUint32 itemCount);
CodVoid joinHistUpdate(JoinHistogram* hist, CodUint64 hashValue, CodUint32 size, CodBool isNewValue);
CodVoid joinHistMerge(JoinHistogram* hist);
CodUint32 joinHistCalcPartitionCount(JoinHistogram* hist, CodUint32 bestSize);
CodVoid joinHistClose(AnlStmt* stmt, JoinHistogram* hist);

```

直方图用于统计HashNewRow的分布情况，指导如何进行分区。直方图的大小为最大分区数，包含了每个分区的HashNewRow总大小和数量和distinct值。

joinHistUpdate将更新直方图，isNewValue来源于joinBFInsert，用于统计distinct值。

###   [4.5 分区执行上下文](#45-分区执行上下文)  

```
typedef struct StPhjContext {
    VmContext           context;
    JoinBloomFilter     filter;
    JoinHistogram       histogram;
    JoinHll*            hll;
    RowData*            tmpRowData;
    MatNewHashRow       result;
    MatRow              tmpKeyRow;
    MatRow              tmpValueRow;
    CodUint32           partCount;
    CodUint32           partMask;
    CodUint32           tmpChunkId;
    CodBool             useFilter;
    CodBool             buildIsNull;
    CodBool             probeIsNull;
    CodBool             decodeNoMatched;
    CodBool             isOpen;
    CodBool             isCacheProbe;
    CodUint8            unused[6];
    CodUint64           hashAreaSize;
    CodUint64           fetchProbeCount;
    Variant**           probeExprCache;
    CodUint64*          getCountArray;
    MatCache            buildCaches[__MAT_CACHE_COUNT__];
    MatCache            probeCaches[__MAT_CACHE_COUNT__];
    MatColumnLocator    buildLocator;
    MatColumnLocator    probeLocator;
    JoinHashTable**     hts;
    HtScanner           htScanner;
    RowCollection**     probeCollections;
    RowDataScanner      probeScanner;
    RowCollection       hashCollection;
} PhjContext;

CodResult phjPrepare(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* hsJoin);
CodResult phjInit(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* hsJoin);

CodResult phjAppend(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjBuildPartition(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjProbePartition(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjInitFetch(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjClose(AnlStmt* stmt, HashJoinContext* context);

CodResult phjFeedProbeNull(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjFeedBuildNull(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);

CodResult phjGetColumnValue(AnlStmt* stmt, HashJoinContext* context, VarColumn* column, Variant* value);
CodResult phjGetColumnValueIsNull(AnlStmt* stmt, HashJoinContext* context, VarColumn* column, Variant* value);

CodResult phjNextPartition(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjFetchProbe(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjFind(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjNextRow(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);

CodResult phjFetchProbeFeedBuildNull(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodResult phjFetchBuildFeedProbeNull(AnlStmt* stmt, HashJoinContext* context, HashJoinPlan* plan);
CodVoid phjSetNull(AnlStmt* stmt, HashJoinContext* context, VarColumn* column, CodBool isNull);

```

PhjContext是HashJoinContext的分区实现，在执行hashjoin的过程中通过该上下文来与HashTable进行交互。实现了HashJoinOperator规定的相关接口。

###   [4.6 DFX](#46-dfx)  

statistics_level设置为ALL，开启autotrace时，展示hash join内部统计信息，包括分区数、build表大小、数量、distinct值等信息。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

CI用例。

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

[image2023-11-22_15-57-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGFhMWFkOWEzMzExZGM4OTQwIiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.R40Uti1DjVM132IC3HKLnixj1bVKqKt7gPtFuzb2HCs)

 (image/png)    


[image2023-11-22_9-34-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGE4OTcwYzJhZjRmNTIwYWQ0IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.HoHb_XyvjYOFQpNvw6QUZTm55FLYb_a4rGbPELTfLgE)

 (image/png)    


[image2023-11-22_9-34-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGFhMWFkOWEzMzExZGM4OTQxIiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.5Km6yaWZqZ1K2fEDglpENTpuA9IRxMH6nmA57-rLD2M)

 (image/png)    


[image2023-11-21_21-21-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGJhMWFkOWEzMzExZGM4OTQyIiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9._bZcDr_D8ewGaN3iiVND0UuiYboTKpVEe9-gPizr7Ks)

 (image/png)    


[image2023-11-21_20-51-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGI4OTcwYzJhZjRmNTIwYWQ1IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.R-9pW9gis2WWL6Jq5s8xo7lyuIHDmhgI9KSsxZfi6Ck)

 (image/png)    


[image2023-11-21_20-44-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGJhMWFkOWEzMzExZGM4OTQ0IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.6IFyid3s3qfjR3v4kCgHc2Ip1u6ryrzgbWJKd4sf-C8)

 (image/png)    


[image2023-11-21_20-18-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGI4OTcwYzJhZjRmNTIwYWQ3IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.osDVmIHNdnbs59UkGonTx_0CbLJa8beAbPkirFIK0II)

 (image/png)    


[image2023-11-21_17-57-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGJhMWFkOWEzMzExZGM4OTQ2IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.9F7cGX44gi7nnF9Bm-3zlAyL4KMckrTT-R1Z07yMflA)

 (image/png)    


[image2023-11-21_17-57-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGJhMWFkOWEzMzExZGM4OTQ3IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.d5kdrlD1BonJrNLu3ysgCP1aFOKfdnv88RLATNeOYDk)

 (image/png)    


[image2023-11-21_17-50-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGJhMWFkOWEzMzExZGM4OTQ4IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.zZIRCq_PIWxQPEd_aGKUBaBKU8UVsetmnbpsSXia_8A)

 (image/png)    


[image2023-11-21_17-49-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGJhMWFkOWEzMzExZGM4OTQ5IiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.3TrpX0ybL-FfnRK5-NOU7cP794IhTUlJdmJUZPf_sUg)

 (image/png)    


[image2023-11-21_15-23-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNGI4OTcwYzJhZjRmNTIwYWRiIiwicmVmX2lkIjoiNjczOTZjNGE1OTNmOTljOWZmMjM2Y2MxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMjMyLCJleHAiOjE3ODIzODY2MzJ9.2TOYIBfmBr6Rjwd2ZUelMFkAebJlEQ7hcJU3exltmps)

 (image/png)    
