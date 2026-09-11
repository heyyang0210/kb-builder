Created by 张锐, last modified on 七月 10, 2023

##   [Rtree Scan](#rtree-scan)  

在gis场景中，使用rtree index来做粗过滤。对于特定的gis算子，可以使用rtree index来做粗过滤，使真正需要做filter的key变为全集的一个极小子集。所以rtree scan就是对于一个给定的MBR以及一个给定的scan operation，返回Rtree中所有满足条件的MBR。

扫描流程如下：

- 从root开始扫描
- 对于每个branch block，遍历key，对每个key执行rtree_filter，若满足条件则向下遍历子树
- 对于每个leaf block，遍历key，对每个key执行rtree_filter，若满足条件则返回key
- 当遍历完一个block后，level++，继续扫描
- 当root block finish scan后，扫描结束（block finish scan：leaf block遍历完所有key，branch block遍历完所有key以及每个key的子树）


当前rtree index支持三种scan operation：

- 包含
- 被包含
- 相交


根据rtree的定义，我们可以发现rtree_filter对于每一种operation如下：

- 对于包含算子，branch的rtree_filter是相交，leaf的rtree_filter是包含
- 对于被包含算子，branch的rtree_filter和leaf的rtree_filter都是被包含
- 对于相交算子，branch的rtree_filter和leaf的rtree_filter都是相交


![](https://pingcode.yasdb.com/atlas/files/public/67396a428970c2af4f51fd63/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQkNFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIyOTksImV4cCI6MTc4MjIyMzA5OX0.HQJrPreb2cHsdE83DY0R218NkaIPdBWUABKiLK_pU7E)

例如对于上述rtree，scan mbr是红色虚线部分，scan operation是相交，则扫描过程如下：

- 进入root block，查看R1是否与scan mbr相交，发现相交，进入R1的child block
- 遍历R1的child block（leaf），发现R12与scan mbr相交，则返回R12
- 接着遍历，发现R1的child block已经遍历完，则返回root
- root从R2开始接着遍历，发现R2与scan mbr相交，进入R2的child block
- 遍历R2的child block（leaf），发现R21与scan mbr相交，则返回R21
- 接着遍历，发现R2的child block已经遍历完，则返回root
- root从R3开始接着遍历，发现R3与scan mbr不相交，root扫描结束，则扫描结束


##   [Geometry空间谓词与Rtree索引算子的关系](#geometry空间谓词与rtree索引算子的关系)  

假设A列上有空间索引，把B作为扫描范围（scanMbr）

|Geometry空间谓词|含义|Rtree扫描算子|备注|
|---|---|---|---|
|ST_Contains（A, B)|A包含B|被包含|scanMbr(B)被包含于A(Rtree数据)|
|ST_Contains（B, A)|B包含A|包含|scanMbr(B)包含A(Rtree数据)|
|ST_Within (A, B)|A包含于B|包含|scanMbr(B)包含A(Rtree数据)|
|ST_Within (B, A)|B包含于A|被包含|scanMbr(B)被包含于A(Rtree数据)|
|ST_Equal|相等，等价于A包含B，并且B包含A|被包含|理论上先包含、被包含、相交三个算子都可以，被包含可能性能会更好。|
|ST_Covers|有相交部分|相交|与A，B顺序无关|
|ST_Crosses|有相交部分|相交|与A，B顺序无关|
|ST_Intersects|有相交部分|相交|与A，B顺序无关|
|ST_Overlaps|有相交部分|相交|与A，B顺序无关|
|ST_Touches|有相交部分|相交|与A，B顺序无关|


##   [Rtree索引的选择](#rtree索引的选择)  

特定的gis算子可以使用rtree index加速扫描，但是如果给定的scan mbr过于异常，则可能使用rtree index的性能还不如全表扫描。例如对于上述例子，如果给定的scan mbr包含了R1，R2，R3，相当于整个rtree都满足扫描条件，这个场景下，全表扫描更优。

所以对于优化器而言，需要识别哪些场景可以使用rtree index做扫描加速。

当前的想法是rtree的统计信息统计一下rtree root的mbr，可以根据scan mbr与root中的mbr的关系来判断是否可以使用rtree index来加速扫描。

注：在实际使用场景中，理论上不会给定一个特别大的scan mbr。

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

## Attachments: