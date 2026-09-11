Created by 陈楚坤 on 十一月 28, 2024

*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/671b434c52495bd785c6b3b9?](https://pingcode.yasdb.com/ship/ideas/671b434c52495bd785c6b3b9?)  #YASHAN-3395  hash group（行算子）性能通过分区的方式优化

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6720390ce489dd0868007d06?](https://pingcode.yasdb.com/pjm/items/6720390ce489dd0868007d06?)  #YDBRD-34779 hash group（行算子）性能通过分区的方式优化

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

        博时Hash Group By执行时间是Oracle的7倍，需要针对该场景进行性能优化。

###   [1.2 调研文档](#12-调研文档)  

*原型验证：*  [https://pingcode.yasdb.com/wiki/spaces/CHENCHUKUN/pages/6739c1fc728206efb930f929](https://pingcode.yasdb.com/wiki/spaces/CHENCHUKUN/pages/6739c1fc728206efb930f929)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|基础物化区接口|见下文|是|是|
||两阶段聚集函数接口|见下文|是|是|
||Partition Hash Group|见下文|是|是|
||Union All表达式优化|见下文|是|是|
||并行Combine|见下文|是|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|Auto Trace|----|是|是|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

无开源依赖。

##   [2. 接口](#2-接口)  

无新增接口。

##   [3. 规格与约束](#3-规格与约束)  

- 1.不修改原有实现，也不影响规格与约束，只对满足以下条件的Hash Group走新的实现：
    - 1.聚集函数只包含count、sum、min、max、avg。
    - 2.函数参数不带distinct。
    - 3.keySize + valueSize（包含内部实现的额外开销）小于ANK_MAX_ROW_SIZE。
- 2.Hash Group能使用的最大内存大小由_HASH_AREA_SIZE参数决定，会根据该参数决定分区数。
- 3.Hash Group的最大分区数为512。
- 4.Combine最大并行度由DEGREE_OF_PARALLEL控制，实际使用的并行度可能小于等于DEGREE_OF_PARALLEL。
- 5.不支持通过hint指定并发度。


##   [4. 特性](#4-特性)  

        特性的核心是实现Partition Hash Group算法，整体架构如下图所示：

- 1.RowSet：基于VM实现的通用物化区接口，支持分区存储，支持一写多读。
- 2.AggrFunction：二阶段聚集函数执行接口，为每个聚集函数提供了init、update、combine接口。
- 3.AggrHashTable：基于RowSet和AggrFunction实现的专门用于Hash Group的哈希表，对算子暴露标准的MatOperator接口。


![clipbord_1732763285362.png](https://pingcode.yasdb.com/atlas/files/public/6747de9da1ad9a3311de38b4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQ0FoQUFBQVFBQVFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQkFBQUFBQUFBQUFBQUFBQUlBQUJRQUFBQUJBQUFBQUFBQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFJRXdBQUFBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ4NDYsImV4cCI6MTc4MjMzNTY0Nn0.wCYbApbbVstHwC3OAwjlFsSl396t_plo47ZOVJrknZ8)

###   [4.1 基础物化区接口](#41-特性设计)  

        当前物化区提供了一套基于VmContext和MatCache的接口，用于读写物化区数据。存在页面读取效率不高的问题，MatRow通过逻辑指针引用，每次引用都需要openVm，不适合用于管理较复杂的数据结构。在实现Partition Hash Join时，实现了RowCollection接口，简化了MatRow的存储方式，并提供了更高效的访问MatRow的方式。这些接口对Partition Hash Group来说还是不够用，比如不支持分区、不支持多读（写入时pinned住页面的同时，让其他业务可读）。为此需要对RowCollection进行改造：支持分区存储，页面添加引用计数来支持多读、支持定制读取和写入过程中对页面的操作(KEEP_PINNED、UNPIN、DESTROY)。

        物化区类图如下图所示，各结构的含义：

- 1.RowData：表示一行数据，比如MatRow。
- 2.RowChunk：指向一个VM页面，保存VM页面的元数据信息，如引用计数、行数等。一个RowChunk容纳一行或多行RowData。提供了pin和unpin接口对接VM接口。
- 3.RowDataId：指向某个RowData的逻辑指针，直接引用了RowChunk，提供了pin和unpin接口。
- 4.RowCollection：由一系列RowChunk构成，从VmContext分配VM页面，并进行管理，内部采用分段数组存储RowChunk。
- 5.RowCollectionAppender：用于写入往RowCollection中写入数据，可以写入一个页面或者写入一个RowData。可指定CacheOption（见下文）。
- 6.RowChunkScanner：用于顺序读取RowCollection中的RowChunk。可指定CacheOption（见下文）。
- 7.RowDataScanner：基于RowChunkScanner实现，用于顺序读取RowCollection中的RowData。
- 8.RowSet：由多个RowCollection构成，用于分区存储RowData，每个RowCollection表示一个分区。
- 9.RowSetAppender：用于往RowSet写入数据，会根据哈希值将数据写入合适的分区。
- 10.RowGroup：也是由多个RowCollection构成，与RowSet不同的是，RowGroup不拥有RowCollection的所有权，且不同RowCollection之间没有分区关系。通常用于将多个RowCollection合并在一起进行读取。
- 11.RowGroupScanner：基于RowDataScanner实现，用于顺序读取RowGroup中的RowData。


        ChunkCacheOption的含义：

- 1.CHUNK_CACHE_OP_KEEP_PINNED：在读写的过程中，一直保持页面在pinned状态。
- 2.CHUNK_CACHE_OP_UNPIN_AFTER_DONE：在读写过程中，当切换到新的页面时，对旧的页面执行unpin。
- 3.CHUNK_CACHE_OP_DESTROY_AFTER_DONE：在读页面的过程中，当切换到新的页面时，对就页面执行unpin，并释放页面。


![clipbord_1732779345970.png](https://pingcode.yasdb.com/atlas/files/public/67481d5ba1ad9a3311de38f3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQ0FoQUFBQVFBQVFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQkFBQUFBQUFBQUFBQUFBQUlBQUJRQUFBQUJBQUFBQUFBQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFJRXdBQUFBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ4NDYsImV4cCI6MTc4MjMzNTY0Nn0.wCYbApbbVstHwC3OAwjlFsSl396t_plo47ZOVJrknZ8)

###   [4.2 两阶段聚集函数接口](#42-特性功能点2)  

        使用AggrState表示聚集函数值，包含了Variant和buff，其中buff用于存储变长数据。使用AggrFunctionDecl描述每一个聚集函数，每个聚集函数定义了init、update、combine三个接口：

- 1.init用于初始化AggrState。
- 2.update为第一阶段聚集，根据参数表达式的执行结果更新AggrState。
- 3.combine为第二阶段聚集，将一个AggrState合并到另一个AggrState。


        gAggrFunctionSet全局数组定义了所有聚集函数的tAggrFunctionDecl，针对改SR，当前只需实现count、sum、min、max四个聚集函数。

```
typedef struct StAggrState {
    Variant*   value;
    CodUint8*  buff;
} AggrState;

typedef CodResult (*AggrStateInit)(ExprNode* expr, AggrState* state);
typedef CodResult (*AggrStateUpdate)(AnlStmt* stmt, ExprNode* expr, AggrState* state);
typedef CodResult (*AggrStateCombine)(AnlStmt* stmt, AggrState* source, AggrState* target);

typedef struct StAggrFunctionDecl {
    CodText           name;
    AggrStateInit     init;
    AggrStateUpdate   update;
    AggrStateCombine  combine;
} AggrFunctionDecl;

extern AggrFunctionDecl gAggrFunctionSet[__AGGR_COUNT__];
```

###   [4.3 Partition Hash Group](#43-特性性能点1)  

        Partition Hash Group的目标是在内存有限的情况下，将整个分组聚集拆分为多个阶段，尽量保证每一步操作都在内存中完成，避免换入换出，同时提高内存访问的局部性，以达到提升性能的目的。整体流程如下图所示：

- 1.第一阶段：根据统计信息、行数据大小、_HASH_AREA_SIZE确定分区数（见下文），将生成多个RowSet、每个RowSet存储一批数据，最大大小为_HASH_AREA_SIZE（保证RowSet和HashMap全内存）。利用HashMap将具有相同GroupKey的数据进行合并，完成第一阶段聚集。在这个阶段，存在同一个RowSet中的所有数据的GroupKey都是不相同的，RowSet由多个Partition构成，数据根据哈希值分配到不同的Partition中，同一个RowSet中的多个Partition之间的数据是没有交集的。
- 2.第二阶段：将多个RowSet相同的分区合并为一个分区，利用HashMap进行第二阶段聚集，最终数据保存在第一个RowSet中，其余RowSet被释放。
- 3.第三阶段：扫描第一个RowSet，得到的结果即为HashGroup的最终结果。


![clipbord_1732762825016.png](https://pingcode.yasdb.com/atlas/files/public/6747dcd0a1ad9a3311de38b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQ0FoQUFBQVFBQVFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQkFBQUFBQUFBQUFBQUFBQUlBQUJRQUFBQUJBQUFBQUFBQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFJRXdBQUFBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ4NDYsImV4cCI6MTc4MjMzNTY0Nn0.wCYbApbbVstHwC3OAwjlFsSl396t_plo47ZOVJrknZ8)

#### 4.3.1 行编码

        整体上复用现有的MatRow，将key和聚集结果存储在一起。key部分使用MAT_ROW_NEW_HASH格式，聚集结果部分，为了支持原地聚集来提升性能，以及避免因数据长度变动而重新分配内存，每个聚集结果采用定长表示，定长数据直接存储Variant，变长数据又Variant + 定长缓冲区构成。其中定长缓冲区的大小为聚集结果可能的最大长度，在trsfMat阶段生成，同时为了避免因缓冲区分配过大，物化开销增多而导致性能劣化，在trsfMat阶段还会控制每个行数据的最大长度，当超过指定长度时，不走Partition Hash Group。

![clipbord_1732780311036.png](https://pingcode.yasdb.com/atlas/files/public/67482121a1ad9a3311de38fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQ0FoQUFBQVFBQVFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQkFBQUFBQUFBQUFBQUFBQUlBQUJRQUFBQUJBQUFBQUFBQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFJRXdBQUFBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ4NDYsImV4cCI6MTc4MjMzNTY0Nn0.wCYbApbbVstHwC3OAwjlFsSl396t_plo47ZOVJrknZ8)

#### 4.3.2 AggrHashTable

        AggrHashTable基于RowSet和AggrFunction实现了MatOperator接口。将整个Partition Hash Group的流程抽象在ahtPutIfAbsent、ahtFetch流程中。主要由以下组件构成：

- 1.RowSet：包含至少一个RowSet，分区存储写入的数据。在第一阶段的写入过程中，RowSet所有页面保持pinned，每行数据都插入到HashMap中进行维护，方便快速查找。
- 2.AggrHashMap：基于RowCollection实现的HashMap，相当于一个大的AggrHashEntry数组，每个AggrHashEntry包含哈希值和RowDataId，指向存储在RowSet中的RowData。
- 3.AggrHashCombiner：用于执行第二阶段聚集，将多个RowSet的Partition合并到同一个Partition。Combine的过程中会生成AggrHashMap。


![clipbord_1732782162172.png](https://pingcode.yasdb.com/atlas/files/public/67482867a1ad9a3311de390f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFCQUFBQUFBQUFBQUFBQUFBQ0FoQUFBQVFBQVFBRUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUVBUUFBQUFBQkFBQUFBQUFBQUFBQUFBQUlBQUJRQUFBQUJBQUFBQUFBQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFCQUFBQUFnQUFBQUFBQUFJRXdBQUFBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ4NDYsImV4cCI6MTc4MjMzNTY0Nn0.wCYbApbbVstHwC3OAwjlFsSl396t_plo47ZOVJrknZ8)

#### 4.3.3 分区数的确定和溢出处理

        分区数由统计信息(keyRowCount)、行数据大小（rowSize）、_HASH_AREA_SIZE大小综合决定。在keyRowCount准确的情况下，最终物化区将保留keyRowCount行数据，需要的内存大小由keyRowCount行数据和HashMap构成。其总大小为：

**totalSize = keyRowCount * rowSize + NextPowerOfTwo(keyRowCount) * sizeof(AggrHashEntry)**

        为了尽量的将每个分区的数据都pinned在内存中，提升内存访问性能，需要尽量让每个分区所占的数据大小小于_HASH_AREA_SIZE，同时分区数不能大于最大分区数，最终的预估分区数为：

**partitionCount = MIN(ROW_SET_MAX_PARTITIONS, NextPowerOfTwo(CEIL(totalSize / _HASH_AREA_SIZE)))**

**        **  按这种方式预估的分区数，在统计信息准确的情况下，理论上能保证第二阶段聚集时，每个分区的数据和HashMap的大小小于_HASH_AREA_SIZE，能全pinned在内存中。当统计信息不准时，可能导致聚集后的数据过大，超过_HASH_AREA_SIZE的大小。这种情况下，在创建HashMap和RowGroupScanner时，会设置maxPinned参数，只允许pinned住不超过_HASH_AREA_SIZE的内存，当访问超过的部分的内存时，需要调用VM的open、close接口，性能会有所下降。

> 当_HASH_AREA_SIZE配置的比较小、totalSize比较大时，第一阶段生成的RowSet中，每个Partition可能很小，这会导致很大的内存浪费，也影响性能。应该如何解决？自适应内存分配？手动调大_HASH_AREA_SIZE？

#### 4.3.4 大基数表优化

        在对大基数表执行Hash Group时，第一阶段聚集几乎过滤不了数据，绝大部分数据都需要写入物化区，这时候查找hash map成为了不必要的开销。针对这种场景，第一阶段可以不做聚集，只做分区，省去查找hash map的开销。为了实现这一点，在物化的过程中，会对采样前5%的数据，当这部分数据的过滤率小于10%时，会禁用掉第一阶段聚集，第一阶段只做分区。

#### 4.3.4 大字段min/max优化

        当min/max聚集函数的参数是定义很大的变长数据类型时，若实际存储的值很小，可能会造成很大的空间浪费，同时带来很大的物化开销，可能会导致性能劣化。为了避免这种劣化，在trsfMat阶段，会对这类场景进行识别：当min/max聚集函数的参数为大于1KB的变长数据类型，且distinct值大于rows的1/2时，禁用Partion Hash Group，走HDT Hash Group。

###   [4.4 Union All表达式优化](#44-特性性能点2)  

        博时的场景是Hash Group下面是由多个Table Full Scan构成的Union All。且Table Full Scan的投影基本上是简单的COLUMN_EXPR。若能简化Union All投影计算过程，对该场景会有一定的性能提升。当前23.2版本Union All是通过View Scan来切换ds的，23.3版本已经去除了Union All对View Scan的依赖，Union All本身具备投影，并在trsfMat阶段物化为MAT_COLUMN，ViewScan直接透传下层投影。

      Union All投影物化为MAT_COLUMN为我们优化提供了承载点，思路为：创建一个新的运行时表达式RtExprNode，COLUMN_EXPR对应的是RtColumnExpr，在执行期动态场景，主要目的是简化COLUMN_EXPR的执行流程，将anlGetTable和各种复杂重复的判断流程提到RtColumnExpr生成阶段，执行阶段直接调用存储接口attach数据，不再执行这些重复的逻辑。

```
typedef struct RtExprNode {
    ExprNode*   expr;
} RtExprNode;

typedef struct StRtColumnExpr {
    RtExprNode  base;
    AnlTable*   table;
} RtColumnExpr;

typedef CodResult (*RtExprExecute)(AnlStmt* stmt, RtExprNode* node, Variant* value);
typedef CodResult (*RtExprGenerator)(AnlStmt* stmt, ExprNode* source, RtExprNode** target);

RtExprGenerator gRtExprGenerators[__EXPR_COUNT__];
RtExprExecute gRtExprExecs[__EXPR_COUNT__];
```

###   [4.5 并行Combine](#45-特性可维可测设计)  

        Partition Hash Group的第二阶段，是将多个RowSet合并为一个RowSet，RowSet的每个分区都是相互独立的，开启多个线程独立的执行每个分区的合并可以提升性能，整理流程为：

- 1.根据DEGREE_OF_PARALLELP的大小，从ParallelManager分配DEGREE_OF_PARALLEL - 1个线程。
- 2.为每个线程分配一个AggrHashCombiner，每个线程循环的从AggrHashTable中顺序的获取分区执行combine，直到所有分区都处理完成。
- 3.主线程同样创建AggrHashCombiner，执行combine，直到所有分区处理完成，等待子线程退出，然后释放线程资源。


        并行Combine只有在RowSet总数据量大于一定值时才开启。

###   [4.6 Auto Trace](#46-特性安全设计)  

**        **  为了方便定位性能问题，Auto Trace需要打印以下信息：

- 1.PartCount：分区数。
- 2.rowSetCount：第一阶段生成的RowSet数量。
- 3.TotalChunks：总共使用的页面数量。
- 4.EstimateDistinct：统计信息预估的distinct值。
- 5.HllEstimateDistinct：HLL算法预估的distinct值。
- 6.RealDistinct：实际的distinct值。
- 7.TotalRows：参与hash group的数据行数。
- 8.MatRows：物化的数据行数。
- 9.SwapCount：发生换入换出的次数。
- 10.Dop：Combine并行度。
- 11.Is2PhaseAggr：是否采用了两阶段聚集。
- 12.CombineTime：Combine执行时间。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

- 1.门禁、二、三层用例。
- 2.考虑统计信息不准的场景，distinct值预估过小导致预估分区数较少，要能正常的控制内存使用且不报错。
- 3.性能：
    - 1.考虑数据的分布情况，第一阶段聚集去重比例直接影响了物化的开销，对性能有很大影响。
    - 2.考虑换入换出对性能的影响。
    - 3.考虑不同数据长度对性能的影响：定义超长字符串，实际存储小字符串、min/max聚集函数参数为变长数据类型，且存储的值非定长。
    - 4.覆盖多种key、聚集函数。


##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

- 1.RowSet是基于RowCollection进行改造的，新的RowCollection对旧RowCollection进行了一些优化，这些优化对Hash Join同样适用，可以让Hash Join的实现更简洁。由于时间不够，对优化后的RowCollection等结构添加了New关键字与旧实现区分开。后期要使用新的实现替换旧的实现，并让Hash Join适配新的实现。
- 2.针对统计信息不准确的场景，支持repartition。


