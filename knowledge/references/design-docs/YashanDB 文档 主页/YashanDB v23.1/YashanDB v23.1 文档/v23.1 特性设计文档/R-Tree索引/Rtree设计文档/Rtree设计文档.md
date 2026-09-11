Created by 张锐, last modified on 十二月 26, 2023

##   [1. Overview（概述）](#1-overview概述)  

  [https://jira.yasdb.com/browse/YDBRD-13240](https://jira.yasdb.com/browse/YDBRD-13240)  

本设计文档，支持给geometry类型创建rtree 索引。

  [Geometry类型概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=100103339)  

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持创建rtree索引
- 支持DML：插入，删除，更新，以及对应的回滚
- 支持扫描，扫描接口：给定矩形框，返回所有和其相交的矩形框（匹配函数可以定制化）
- 支持MVCC（基本事务能力，一致性查询）
- 支持基本索引DDL
- 支持分区
- 当前只放开2维float rtree index


##   [3. Interfaces（接口）](#3-interfaces接口)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a44a1ad9a3311dc7be1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FCQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUpBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzMzYsImV4cCI6MTc4MjIyMzEzNn0.3m7-_yN4oRBvQyiWZdJi_jVZxYd-cWiFnPJ770ZfEPM)

  


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- rtree索引只支持给geometry类型列创建
- 创建rtree index必须使用rtree关键字
- 不支持unique rtree索引
- rtree索引只支持单列索引，不支持多列复合rtree索引
- rtree索引不支持create/rebuild online
- rtree索引不支持reverse
- rtree索引不支持function
- rtree高度上限：24层
- 维度上限：6维
- 支持单机
- 不支持可串行化事务


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

Rtree索引是一个高度平衡树，它是B树在n维空间的扩展。Rtree存储的键值是Geometry对象的MBR（Minimum Boundary Rectangle），采用空间聚集的方式把相邻近的Geometry对象划分在一起，组成更高一级的节点；在更高一层又根据这些节点的MBR进行聚集，划分形成更高一级的节点，直到所有Geometry对象组成一个Root节点。

YashanDb Rtree Index设计原型参考    [Rtree选型](https://conf.yasdb.com/pages/viewpage.action?pageId=104210467)    。

YashanDb Rtree Index实现的主要原则是：物理操作尽量复用btree，逻辑操作重新实现。

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396a448970c2af4f51fd6c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FCQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUpBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzMzYsImV4cCI6MTc4MjIyMzEzNn0.3m7-_yN4oRBvQyiWZdJi_jVZxYd-cWiFnPJ770ZfEPM)

![](https://pingcode.yasdb.com/atlas/files/public/67396a44a1ad9a3311dc7be2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FCQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQWdBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUpBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzMzYsImV4cCI6MTc4MjIyMzEzNn0.3m7-_yN4oRBvQyiWZdJi_jVZxYd-cWiFnPJ770ZfEPM)

新增redo类型：

- LOGT_RTREE_INIT_DATA_BLOCK
- LOGT_RTREE_INIT_SEG
- LOGT_RTREE_INSERT_KEY
- LOGT_RTREE_DELETE_KEY
- LOGT_RTREE_INSERT_PARENT
- LOGT_RTREE_UPDATE_PARENT
- LOGT_RTREE_COMPACT_BLOCK
- LOGT_RTREE_REROOT
- LOGT_RTREE_SPLIT
- LOGT_RTREE_UNDO_LEAF_KEY
- LOGT_RTREE_UNDO_BRANCH_KEY
- LOGT_RTREE_UNDO_COMPACT


新增undo类型：

- UNDO_RTREE_INSERT
- UNDO_RTREE_DELETE
- UNDO_RTREE_BRANCH_INSERT
- UNDO_RTREE_BRANCH_UPDATE
- UNDO_RTREE_COMPACT


###   [5.1 Rtree Build Tree](#51-rtree-build-tree)  

build/rebuild rtree根据原始表数据大小，有3种情况（假设原始表数据存在n个MBR，一个rtree block最多可容纳r个MBR）：

- n <= r，直接将所有MBR写入一个rtree block
- n <= 2r，使用rtree split算法，划分MBR，build rtree，具体算法参考：    [Rtree分裂算法](https://conf.yasdb.com/pages/viewpage.action?pageId=104210467#rtree%E5%88%86%E8%A3%82%E7%AE%97%E6%B3%95)    。
- n > 2r，使用STR算法构建rtree，具体算法参考：    [STR Build Rtree](https://conf.yasdb.com/pages/viewpage.action?pageId=104210467#str-build-rtree)    。


###   [5.2 Rtree Index Insert](#52-rtree-index-insert)  

查找插入位置：

- branch节点，选取当前MBR加入后，key的MBR扩充面积最小的key
- leaf节点，如果存在isSame的deleted key，则选取这个key的slot，isSame插入，否则直接选取block->keys作为slot插入
- null值不插入rtree


###   [5.3 Rtree Index Delete](#53-rtree-index-delete)  

查找要删除的MBR：

- branch节点，遍历block的所有key，如果MBR包含于key，则选取当前key向下查找
- leaf节点，遍历block的所有key，如果MBR与key相等并且rowid相同，则当前key就是要删除的key
- 如果在leaf节点没有找到，则返回上一层继续查找


###   [5.4 Rtree Index结构性变更](#54-rtree-index结构性变更)  

- 结构性变更和btree基础逻辑一致，都是使用xslot0来lock页面
- 结构性变更需要开启自治事务


####   [5.4.1 update parent](#541-update-parent)  

查找插入位置的时候，如果途径的branch节点由于要插入的MBR而扩大，则我们在插入MBR前，要自底向上的调整这条路径的MBR

- 计算带插入leafBlock的MBR，并且根据要插入的MBR调整，向上调整
- 在上一层，使用新的MBR更新老的MBR
- 更新完一层后，需要判断上一层是否需要调整，如果需要调整继续向上调整


####   [5.4.2 split](#542-split)  

查找到的block如果插入不下当前MBR，则需要分裂，分裂算法参考：    [Rtree分裂算法](https://conf.yasdb.com/pages/viewpage.action?pageId=104210467#rtree%E5%88%86%E8%A3%82%E7%AE%97%E6%B3%95)    。

分裂的时候，向上计算parentKey会把待插入key计算进来，真正split的时候，对于leafBlock，待插入key不会写入block，对于parentBlock，待插入key在分裂的时候就会写入block。

root leaf block split：

- root leaf block根据分裂算法，分裂成2个block
- 生成新的2个block的MBR parent key
- root重新init为只包含2个parent key的root


normal leaf block split：

-     1. 当前block根据分裂算法，分裂成2个block，生成新的2个block的MBR parent key

-     1. 向上modify parent：update 当前leaf的parent key

-     1. 在当前parent block插入新block的parent key，如果插入不下则进入步骤4，如果可以插入进入步骤5

-     1. parent block 继续split，split时如果insertedKey被划分到当前parent block，则此次split后插入insertedKey到parent block，进入步骤2

-     1. 判断parent block修改前后是否MBR有扩大，如果扩大则进入update parent流程



####   [5.4.3 compact](#543-compact)  

- rtree compact流程与btree compact一样
- compact完成后，需要判断当前block compact前后MBR是否缩小，如果缩小需要进入update parent流程


###   [5.5 Rtree Scan](#55-rtree-scan)  

支持3种扫描算子：包含，被包含，相交

扫描流程：

- 从root开始扫描，对每个key执行rtree_filter，若满足条件则向下继续查找
- 在leaf block如果有个key满足rtree_filter则返回
- 当遍历完一个block后，level++，继续扫描
- block finish scan：leaf block遍历完所有key；branch block遍历完所有key以及每个key的子树
- 当root block finish scan后，扫描结束


算子rtree_filter设置：

- 对于包含算子，branch rtree_filter是相交，leaf rtree_filter是包含
- 对于被包含算子，branch rtree_filter和leaf rtree_filter都是被包含
- 对于相交算子，branch rtree_filter和leaf rtree_filter都是相交


sql需要根据执行计划，设置对应的coarseOpType，以及scanMbr(rtreeRange与indexRange是个union)：

```
typedef struct StAnkRtreeScanRange {
    RtreeMBR scanMbr;
} AnkRtreeScanRange;

union {
    SegScanInfo       segScanInfo;
    AnkIndexScanRange indexRange;
    AnkRtreeScanRange rtreeRange;
};

typedef enum EnRtreeOpType {
    RTREE_INTERSECT = 0, /* the scan MBR intersects the target MBR */
    RTREE_INCLUDE   = 1, /* the scan MBR contains the target MBR */
    RTREE_INCLUDEIN = 2, /* the scan MBR is contained within the target MBR */
} RtreeOpType;

typedef struct StAnkRtreeScanAttr {
    CodUint8       scanAction; /* scanAction must be first */
    CodUint8       coarseOpType;
    CodUint8       rtreeUnused[2];
    CodBool        isLast[ANK_MAX_RTREE_LEVEL];
    BtreeLocation* scanLocation;
    RtreeCoarseOp  branchOp;
    RtreeCoarseOp  leafOp;
} RtreeScanAttr;

typedef struct StAnkIndexScanAttr {
    CodPointer  idxHandler;
    IdxAccessor idxFetch;
    CodChar*    currKey;
    CodUint64   partNum;
    CodUint64   heapDataOid;
    CodUint64   accessObject;

    CodUint16   heapSpaceId;
    CodUint8    indexSlot;
    CodBool     isIndexOnly;

    union {
        CodUint8      scanAction; /* scanAction must be first */
        BtreeScanAttr bsAttr;
        RtreeScanAttr rsAttr;
    };
    AnkGetIndexDesc getIndexDesc;
} AnkIndexScanAttr;

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

ddl测试场景：

- create rtree index，查询dba_indexes视图的index_type
- drop index
- truncate index
- rebuild index
- alter index
- 分区索引


dml测试场景：

- insert
- insert过程中，触发调整parent
- insert过程中，触发split，级联split
- insert过程中，触发compact
- insert过程中，触发compactWithUndo
- insert与delete的rollback
- delete
- insert和delete的rollback
- scan（当前SR只能通过ut测试，待sql SR转测时，可以正常测试）
- 可串行化事务拦截


触发split后，还有几种场景：

- root split
- leaf split
- 级联split，触发update parent cascade
- 级联split，当前level split后，待插入key被划分到left，触发insertCurParent


触发compactWithUndo后，可能还会触发update parent cascade

rtree redo undo全覆盖，每个redo的rollback，revert。

  
    


  


## Attachments:

[image2023-6-13_9-2-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDM4OTcwYzJhZjRmNTFmZDY3IiwicmVmX2lkIjoiNjczOTZhNDM1OTNmOTljOWZmMjM1ODM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzM2LCJleHAiOjE3ODIyOTg3MzZ9.9Y-Q04reUiFoQBgmDrinZhvZqqiQSsMhRTxSnOQaTYI)

 (image/png)    


[image2023-6-13_9-2-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDM4OTcwYzJhZjRmNTFmZDY4IiwicmVmX2lkIjoiNjczOTZhNDM1OTNmOTljOWZmMjM1ODM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzM2LCJleHAiOjE3ODIyOTg3MzZ9.cS2wd2BiVpzQk-hwUjIIE0nqCDGwZT5RwrIpeh9bPno)

 (image/png)    


[image2023-6-25_14-44-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDRhMWFkOWEzMzExZGM3YmRmIiwicmVmX2lkIjoiNjczOTZhNDM1OTNmOTljOWZmMjM1ODM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzM2LCJleHAiOjE3ODIyOTg3MzZ9.peWAjfW2NgnQXZiGhD2dx9IgmgP_Gz_suIug0vaOWpQ)

 (image/png)    


[image2023-6-25_14-44-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDRhMWFkOWEzMzExZGM3YmUwIiwicmVmX2lkIjoiNjczOTZhNDM1OTNmOTljOWZmMjM1ODM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzM2LCJleHAiOjE3ODIyOTg3MzZ9._-D8mPFzD-pTU94B-cpuPDj2Ct1nzCh-irutE4XAFjc)

 (image/png)    


[image2023-6-25_14-44-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDQ4OTcwYzJhZjRmNTFmZDZhIiwicmVmX2lkIjoiNjczOTZhNDM1OTNmOTljOWZmMjM1ODM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzM2LCJleHAiOjE3ODIyOTg3MzZ9.fadSytfsznrCcG72YF_YHeeSSdu-PI8EZd3khNU4XTw)

 (image/png)    


[rtree_index.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhNDQ4OTcwYzJhZjRmNTFmZDZiIiwicmVmX2lkIjoiNjczOTZhNDM1OTNmOTljOWZmMjM1ODM3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMzM2LCJleHAiOjE3ODIyOTg3MzZ9.5odfTJjP-m7N_vKvvritB-GJVNyGJY5zPNIPIFgen8A)

 (application/octet-stream)    
