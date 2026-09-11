Created by 陈晓晴, last modified on 五月 13, 2024

*详细设计-YDBRD-XXXX : XXX Design（XXX方案设计）*

* IR链接：YDBRD-XXXX*

*SR链接：*    [YDBRD-26534](https://pingcode.yasdb.com/pjm/items/662244a4fd997db58ade153a)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

bulkload导入支持去重，去重采用delete+insert的模式，且按行执行。在SCol以delete bitmap集中存储批量行的删除信息的背景下，该执行模式的去重方式因为delete bitmap放大了行锁，容易造成死锁，导致表内并行去重不可用；且按行执行加SCol的chunk锁进行删除，此加锁操作开销极大，降低了去重的性能。因此需要优化以上缺陷，提升导入去重性能。

###   [1.2 调研文档](#12-调研文档)  

参考    [https://conf.yasdb.com/pages/viewpage.action?pageId=147764387](https://conf.yasdb.com/pages/viewpage.action?pageId=147764387)  

###   [1.3 需求分析](#13-需求分析)  

1. 解决非业务逻辑导致的并行去重的死锁问题。
1. 提升去重场景的导入性能。


部署形态：分布式

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

新增pengdingDelete结构，用于记录冲突时待删除的行的相关信息。当前记录的待删除行的相关信息为：slice内偏移，待删除索引id。

关闭mcol需求支持后，待删除行的记录信息为：slice内偏移，ssn，optionBitmap(区分纯删除操作delete与更新、去重导致的删除操作replace)，待删除索引id（delete操作不记录，设置为无效），keyOff（delete操作记录key值在keyBuffer中的偏移）

```
// 每个pendingDelete node只记录一个chunck的待删除行信息，追加写。
typedef struct StSpfPendingDeleteNode {
    CodUint64  dataoid;
    CodInt32   sliceId;
    CodUint32  chunkId;
    CodPointer next;      // 用于hash冲突时形成链
    CosVmPtr   fixBuffer; //  buffer内实际记录：CodBool multiChunck + CodUint32 count + 8k * ( CodUint32 rowid + （ssn + optionBitmap + ) indexId （+ key offset）)
    //CosVmPtr  keyBuffer;  // 待删除的索引key值，delete操作才记录。
} SpfPendingDeleteNode;

#define PD_GROUP_LIST_COUNT 24

typedef struct StSpfPendingDeleteNodeGroup {
    CodUint32             itemCount;
    CodUint32             listCount;
    SpfPendingDeleteNode* NodeList[PD_GROUP_LIST_COUNT];
    CodPointer            nextGroup;
} SpfPendingDeleteNodeGroup;

#define PART_TAB_BUCKET_NUM
#define 

//一个SpfPendingDelete结构只记录一个spf结构中的数据。
typedef struct StSpfPendingDeletes {
    CodUint64                dataoid;
    CodMemAllocator*         allocator;
    CodQuotator*             quotator;
    CodUint32                bucketNum;
    CodUint32*               bucketHead; // 桶起点
    SpfPendingDeleteNodeGroup* nodeGroup;
} SpfPendingDelete;

//一个表结构按照分区记录pendingDelete。该结构体挂在handler上。
typedef struct StTabPendingDeletes {
	CodList            extendPartList;  //记录interval分区的SpfPendingDelete
    SpfPendingDelete*  part[0];
    CodUint32          partCount;
} TabPendingDeletes;



```

1. 一个SpfPendingDelete内，每个chunck记录所属的nodeId记录在hash表内，通过sliceId + chunckId快速hash得到所属pendingDelete node的id，然后在node数组中拿到node相关信息。hash冲突的chunck对应的node通过node->next指针在该hash位置上形成链。hash桶数量定为2^25个，需要128M，大约能记录98400个slice。
1. 一个pendingDelete Group中默认申请24个指针大小的数组存储每个 node list起始位置。每个group中，从1到24个node list中 node的数量分别为2，4，8，16...2^24次方个。这样一个group可以记录
1. 待删除记录到来时，先查找是否有对应的pendingDelete node，若没有则需要扫描一次swd获取该slice的multiChunck信息，加上该信息一起生成新的pendingDelete node，并将该nodeId加到hash表中。每个pendingDelete node都只记录对应chunck的待删除记录，非multiChunck的slice在pendingDelete中也按chunck划分记录pendingDelete信息。
1. 一个chunck大小为24k行，pendingDelete node内暂定记录待删除数据量为8K行，假定一个chunck内的冲突1/3的数据。每个冲突的待删除记录以追加写的方式记录到pendingdelete node内。


##   [3. 规格与约束](#3-规格与约束)  

无。

##   [4. 特性](#4-特性)  

在原有的LSC表增量导入去重方案中，每行插入索引时都及时地解决索引冲突，这样做可以保证最终保留的一定时最新版本的数据。但是由于按照单行处理冲突带来了SCol的死锁问题，

考虑将SCol的删除操作集中放在提交阶段延迟有序地执行，可解决死锁问题，也能利用延迟批量处理删除，提升性能。相对应的考虑索引的冲突可以利用主键更新模式，即时地将新行插入，

同时将旧行的删除延迟到SCol加锁删除后执行，不打破加行锁后再操作索引的逻辑。

###   [4.1 特性设计](#41-特性设计)  

####   [导入去重的流程图：](#导入去重的流程图)  

**插入流程：（处理有索引的流程）**

![](https://pingcode.yasdb.com/atlas/files/public/67396d5ea1ad9a3311dc90c7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQkFBSUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBaUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFRQkFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc3MzAsImV4cCI6MTc4MjMxODUzMH0.5r-43vDMJSfgege_Y_CPxNgO3NPyIHXLwNNGwA8EfTQ)

1. 主键更新流程需要在有冲突的时候将conflict rowid设置上，返回给外部。
1. 新增 handler->lscDupCnt标记。每一次主键更新模式的插入有冲突，在lsc表执行deduplicate操作的情况下，handler->lscDupCnt++；否则是handler->dupCnt++。


**提交流程：**

主要是处理pendingDelete node的流程，有两个方案：

**方案一：**

提交时，将一个SpfPendingDelete内的所有node list中的node排序。申请一个所有node总数量的数组，进行归并排序。按照排序顺序处理每一个pendingDelete node。

缺点：额外的内存与排序时间的开销。

**方案二：**

SpfPendingDelete内记录min sliceId，max sliceId，min chunckId与max chunckId，提交时遍历min→max slice，每个slice遍历min→max chunckId，每个sliceId + chunckId做一次hash确认是否有对应的pendingDelete node，有则进行处理。

  


**pendingDelete node处理流程：**

1. 处理pendingDelete node前先准备好一个process bitmap标记整个chunk此次处理了的删除行，大小3KB；另外为LSC表的每个索引都准备一个chunk大小的index bitmap，用于标记处理过的索引，大小也是3KB。这两类bitmap都用于合并pendingDelete内重复删除的操作。
1. 首先处理pengdingDelete内所有行的标记删除。遍历pendingDelete node内的记录，每一个待删除的行，若原行未删除，观察process bitmap该行是否为1，为1则跳过，为0则进行标记删除，同时标记process bitmap对应行为1；若原行已经被删除，则未开启row movement情况，跳过这一行；否则  **报错**  ，回滚事务。  并且，每一行标记了process bitmap后，需要同时在该行记录的索引对应的index bitmap上改行设置成1  **（删除区分replace与delete后，则这一步**  **只对replace操作**  **的索引**  **标记i**  **ndex bitmap对应的位置为1）**  。然后进行handler→lscDupCnt–。
1. 遍历完第一遍pendingDelete后，得到操作过的process bitmap与index bitmap。
1. **（这一步在删除区分replace和delete后才操作）**  再遍历一遍pendingDelete node，此次只处理delete操作的索引，无需再处理replace操作。对于pendingDelete中的每一个delete操作的行，当其对应的process bitmap行为1且所有index bitmap该行为0，取出记录的key值，将所有的索引删除，同时标记所有的index bitmap该行位置为1。
1.  最后process bitmap分别与每一个index bitmap进行一次异或操作，处理异或结果为1的行，回表读取数据，执行对应的索引删除操作。


**例：**

假设原始dbm与pendingDelete如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d5ea1ad9a3311dc90c8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQkFBSUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBaUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFRQkFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc3MzAsImV4cCI6MTc4MjMxODUzMH0.5r-43vDMJSfgege_Y_CPxNgO3NPyIHXLwNNGwA8EfTQ)

处理该pendingDelete的过程如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396d5e8970c2af4f521255/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQkFBSUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBaUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFJQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFRQkFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc3MzAsImV4cCI6MTc4MjMxODUzMH0.5r-43vDMJSfgege_Y_CPxNgO3NPyIHXLwNNGwA8EfTQ)

  


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.工作量评估：](#6工作量评估)  

1. 写入pendingDelete（人天）
1. 提交处理pendingDelete（人天）
1. 自测（人天）+ 性能验证（3人天）


资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


  


  


  


  


  


  


  


  


  


  


  


  


  


## Attachments:

## Comments:

|  [](null)  ,2024/05/11  评审纪要,与会人：谢锐，黄文早，万谦，易文亮，任艳芳,内容：,1. 明确对外影响： 去重必须要开启row movement才能执行。
1. 明确对外影响：关闭mcol后，支持冷数据单独的dml能力，由于延迟删除带来的并发影响，造成语义上的一点改变：延迟删除  可能导致删除时误判，即其他事务已经对该行执行了删除，有两种情况，一种是未开启row movement，原行实际被删除了，这时候忽略本次删除即可；另一种是开启了row movement，原行可能发生了row move，这时候删除线程已经无法重启语句，只能回滚事务。
1. pendingDelete结构设计要保证不会因为内存分配不出导致失败，根据会议给出的意见修改相关结构。
1. 文档的pendingDelete合并部分描述不够详细需补充。
1. 工作量评估重新考虑，自测时间要充足。
,Posted by chenxiaoqing at 五月 13, 2024 11:30|
|---|
