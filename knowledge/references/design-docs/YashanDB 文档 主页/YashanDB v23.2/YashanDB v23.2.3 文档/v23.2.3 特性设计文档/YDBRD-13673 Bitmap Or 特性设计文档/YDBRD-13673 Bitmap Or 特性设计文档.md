Created by 陈秋富, last modified on 十月 14, 2024

原链接：    [bitmap or 特性设计文档 - 陈楚坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119557701)  

*---------------以下为正文开始分隔线-----------------*

*详细设计-YDBRD-13673 :Bitmap Or Design（多索引bitmap or方案设计）*

*IR链接：*    [[YDBRD-215] 支持bitmap PLAN OR算子 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-215)  

*SR链接：*    [[YDBRD-13673] 多个索引的RowId Bitmap Or - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13673)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

oracle支持index combine功能，最早是用在bitmap index上的，在9i开始oracle默认可以使用在btree索引上，这是由_b_tree_bitmap_plans参数来控制的。

oracle将btree索引中获得的rowid信息通过BITMAP CONVERSION FROM ROWIDS的步骤转换成bitmap进行匹配，然后匹配完成后通过BITMAP CONVERSION TO ROWIDS再转换出rowid获得数据或者回表获得数据。

**当前特性支持的部署形态为 单机行存。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [bitmap or调研 - 陈楚坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119554629)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|bitmap存储结构|见后续章节|是|是|
|周边配合|优化器|  [bitmap or 计划支持 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150606287)  |是|是|
|周边配置|执行器|见后续章节|是|是|
|周边配置|存储|主要涉及存储中的索引以及ROWID表示。见后续章节。|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|bitmap|Bitmap（位图）是一种数据结构，它使用位（bit）数组来表示某种状态集合。|是|  
|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**主要约束来自于ROWID的表示范围，分别涉及 spaceid、fileId、blockId、dir的表示范围。见文档描述**

  [物理规格 | YashanDB Doc](https://doc.yashandb.com/yashandb/22.2/zh/%E4%BA%A7%E5%93%81%E6%8F%8F%E8%BF%B0/%E4%BA%A7%E5%93%81%E8%A7%84%E6%A0%BC/%E7%89%A9%E7%90%86%E8%A7%84%E6%A0%BC.html)  

**其中spaceid表示表空间数量，当前规格为 2048**

**fileId表示**  **单表**  **数据文件数量，当前规格为 64**

**blockId表示单文件数据块个数，当前规格是 64M**

**dir表示行在数据块上的槽位下标，当前规格是 4096**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    bitmap存储结构设计

#### 4.1.1 bitmap存储的基本单元组织格式

![](https://pingcode.yasdb.com/atlas/files/public/67396d458970c2af4f5211b5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBUUFDQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVBQUFBQUFBQUFBQUFvQUFBQkFBQUFBQUFRQUFBRUFBQUtBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMDIsImV4cCI6MTc4MjMxNzgwMn0.YMWEOPj2LfuJd1bAZ5R1mH7yhYQlJTWbvkXulE-8QP8)

（1）将一个页面分割成多个2K的内存块。一个VM页面（64KB）可以划分出32个内存块。

（2）每个内存块之间通过页面标识  **（BlockId）**  以及页面偏移大小  **（Offset）**  来找到。其中blockId和offset两个字段的信息使用 VmBuffLoc 结构体来承接。

（3）bitmap中所有的组织结构都是基于该2KB的页面大小进行组织的。所以一个2K页面最多能存下的元素个数为256个（2KB/8B=256个）。

#### 4.1.2 bitmap存储的数据组织关系

![](https://pingcode.yasdb.com/atlas/files/public/67396d45a1ad9a3311dc9026/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBUUFDQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVBQUFBQUFBQUFBQUFvQUFBQkFBQUFBQUFRQUFBRUFBQUtBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMDIsImV4cCI6MTc4MjMxNzgwMn0.YMWEOPj2LfuJd1bAZ5R1mH7yhYQlJTWbvkXulE-8QP8)

如上图，bitmap设计中将2K内存空间按两种方式组织，一种是直接当存储空间，存储对应index的bit下标值。另一种则是指向下一个2K空间  **（总共可以放下256个，占用8bit）**  。

同理可以形成其他组织形式，如需要存储16 bit数据的、32bit数据量的以及64bit数据量的。

![](https://pingcode.yasdb.com/atlas/files/public/67396d468970c2af4f5211b7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBUUFDQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVBQUFBQUFBQUFBQUFvQUFBQkFBQUFBQUFRQUFBRUFBQUtBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMDIsImV4cCI6MTc4MjMxNzgwMn0.YMWEOPj2LfuJd1bAZ5R1mH7yhYQlJTWbvkXulE-8QP8)

在存入16、32、64bit数据前，会尝试先用一个2KB空间的array数据去装载。当array装满后才会转换成bitmap结构。

#### 4.1.3 需求中存储rowid的方式

由于只有行存支持Btree索引，因此只需要考虑行存的RowId。它由以下几部分构成：

- dataObjectId：行所在的SegmentID，类型为uint64   **(用于进行分区的逻辑表示，占用64bit)**
- spaceId：行所在的表空间的ID，类型为uint16   **（实际使用11bit）**
- fileId：行所在数据文件在对应表空间中的数据文件ID，占用6位，与blockId构成uint32   **（实际使用6bit）**
- blockId：行所在数据块在对应文件中的块ID，占用26位，与fileId构成uint32  **（实际使用26bit）**
- dir：行在数据块上的槽位，类型为uint16  **（实际使用12bit）**


![](https://pingcode.yasdb.com/atlas/files/public/67396d46a1ad9a3311dc9027/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBUUFDQUlBQUFBQUFBQUFBQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVBQUFBQUFBQUFBQUFvQUFBQkFBQUFBQUFRQUFBRUFBQUtBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcwMDIsImV4cCI6MTc4MjMxNzgwMn0.YMWEOPj2LfuJd1bAZ5R1mH7yhYQlJTWbvkXulE-8QP8)

需要保存到bitmap中的RowId字段就包括  **dataObjectId（占用64bit）、spaceId（占用11bit）、fileId（占用6bit）、blockId（占用26bit）、dir（占用12bit）。**  一次性创建可容纳64位值的bitmap是不现实的，为了能分配足够容纳64位值的bitmap，也为了避免空间的浪费。bitmap采用分层结构。

第一层存放dataObjectId对应的64bit，先采用数组的方式存储，通过二分插入的方式保证有序。（由于分区数量基本不会太多，通常一个array就够用了）。

第二层采用16bit的结构存放，也是先采用数组的方式组织，当数组存满后转换成bitmap的方式。（这里将space的后10bit与file的6bit组成16bit数据）。

第二层采用32bit的结构存放，也是先采用数组的方式组织，当数组存满后转换成bitmap的方式。（这里将space的第1bit与block的26bit以及dir的前4bit，组成32bit数据）。

第二层采用8bit的结构存放，直接按bitmap的方式。（将dir的后8bit数据直接存入）。

以上所有的空间都来自于VM页面内存空间。最小的单位为一个2KB的页面块。初始化创建的时候，消耗也只是4个array块大小。总共8KB。

  `  
`  

```
//bitmap中VM管理结构
typedef struct StHbmVmContext {
    VmContext* vmContext;
    VmId       entry;
    VmId       currId;
    CodChar*   currBlock;
    CodChar*   currBuf;
    CodUint32  currOffset;
    VmId       scanId;
    CodChar*   scanBlock;
} HbmVmContext;

//VM块定位信息
typedef union StVmBuffLoc {
    CodPointer pointer;
    struct {
        CodUint32  type : 8;
        CodUint32  count : 8;
        CodUint32  offset : 16;
        MatBlockId blockId;
    };
} VmBuffLoc;

//bitmap主要的存储结构
typedef struct StHeapRowIdBitmap {
    AnlStmt*      stmt;
    HbmVmContext* hbmContext;
    VmBuffLoc     rootLoc;
    CodUint64     count;
} HeapRowIdBitmap;

//bitmap扫描的时候主要的暂存状态
typedef struct StHeapRBMScanState {
    CodUint64 scanCount;
    CodUint64 dataObjectId;
    CodUint64 index2;
    CodUint64 index1;
    CodUint64 index3;
    CodBool   isEof;
} HeapRbmScanState;


//bitmap扫描的时候主要的暂存数据集
typedef struct StHeapRowIdSet {
    CodUint16   capacity;
    CodUint16   count;
    CodUint32   unused;
    RowId       rowIdSet[0];
} HeapRowIdSet;

CodResult heapRbmInit(AnlStmt* stmt, HeapRowIdBitmap* rbm);
CodVoid   heapRbmDestroy(HeapRowIdBitmap* rbm);
CodResult heapRbmSet(HeapRowIdBitmap* rbm, const RowId *rowId);
CodResult heapRbmInitScan(HeapRowIdBitmap* rbm, HeapRbmScanState* state);
CodResult heapRbmScan(HeapRowIdBitmap* rbm, HeapRbmScanState* state, RowId *rowId);
CodResult heapRbmBatchScan(HeapRowIdBitmap* rbm, HeapRbmScanState* state, HeapRowIdSet* rowIdSet);
CodResult heapRbmClear(HeapRowIdBitmap* rbm);
CodResult heapRbmAnd(HeapRowIdBitmap* leftRbm, HeapRowIdBitmap* rightRbm, HeapRowIdBitmap* rbmResult);
```

  


###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    接口部分

通过计划Plan挂载的投影信息，获取到对应需要处理的索引信息。具体的plan的组织形式参考相应的优化器设计文档。

```
typedef struct StBitmapPlan {
    BitMapPlanType type;
    PlanTable*     table;
    AnlPlan*       childs;
    CodUint32      childCount;
    CodUint16      resId;
    CodUint16      resCount;
} BitmapPlan;

CodResult execBitmapPlan(AnlStmt* stmt, AnlPlan* plan);
CodResult fetchBitmapPlan(AnlStmt* stmt, AnlPlan* plan, CodBool* isEof);
CodVoid   closeBitmapPlan(AnlStmt* stmt, AnlPlan* plan);
```

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    执行流程

####   [（](https://conf.yasdb.com/pages/viewpage.action?pageId=119557701#3exec%E9%98%B6%E6%AE%B5)    1）exec阶段

a、初始化bitmap空间结构，并且做好开表准备。

b、遍历所有的IndexDesc，执行exec和fetch，得到rowid。

c、将所有查询出来的rowid添加到bitmap结构中。见4.1结构

**（2）fetch阶段**

a、遍历bitmap，得到所有rowid。（由4.1结构中的 HeapRbmScanState 结构控制扫描状态。）

b、根据rowid，调用anlFetchByRowId回表得到结果，返回给上层投影。（这块需要计划构造从ROWID到某个具体投影列的映射关系，得在trsfmat阶段将表达式映射过去。）

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1、explain查看是否生成了bitmap or计划

2、覆盖多索引、组合索引、包含非索引filter、不同IndexScan方式等多种场景

3、分区表、一个表包含多表空间、多文件的场景

4、边界场景值。

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

~~1、预先得到表的fileId、blockId范围，根据这个范围调整需要使用的bitmap大小？~~

2、并行支持？

3、考虑bitmap and和or出现混合的情况。

## Attachments:

[image2024-5-28_17-43-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDU4OTcwYzJhZjRmNTIxMWFmIiwicmVmX2lkIjoiNjczOTZkNDU3MjgyMDZlZmI5MmYxZDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDAyLCJleHAiOjE3ODIzOTM0MDJ9.h9kmTIZQES0UTHfaOigyOWDK2VJ-GzyXUELmaPWJQ7s)

 (image/png)    


[image2024-5-28_17-39-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDU4OTcwYzJhZjRmNTIxMWIxIiwicmVmX2lkIjoiNjczOTZkNDU3MjgyMDZlZmI5MmYxZDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDAyLCJleHAiOjE3ODIzOTM0MDJ9.NzXr5K6j_sDTAF1DGOmzfYgc004H-3FpOD_izDGoRro)

 (image/png)    


[image2024-5-28_17-27-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDVhMWFkOWEzMzExZGM5MDIyIiwicmVmX2lkIjoiNjczOTZkNDU3MjgyMDZlZmI5MmYxZDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDAyLCJleHAiOjE3ODIzOTM0MDJ9.eeoleg-3u69BRHCeJt5-Vy0Qcjx-U8ovEkIFpBqfzq8)

 (image/png)    


[image2024-5-28_17-19-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDU4OTcwYzJhZjRmNTIxMWIzIiwicmVmX2lkIjoiNjczOTZkNDU3MjgyMDZlZmI5MmYxZDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDAyLCJleHAiOjE3ODIzOTM0MDJ9.F8jUHW7CZB-bxIfuVtWWKzOyRH7m3iRrFdDiGEPGyGI)

 (image/png)    


[bitmap.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDU4OTcwYzJhZjRmNTIxMWI0IiwicmVmX2lkIjoiNjczOTZkNDU3MjgyMDZlZmI5MmYxZDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MDAyLCJleHAiOjE3ODIzOTM0MDJ9.T3sXf90-MrXkYacWmiblV4lw8xzgmEMlxdyq7ov4zn0)

 (image/png)    
