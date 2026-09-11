Created by 陈楚坤 on 八月 05, 2024

IR链接：：    [https://pingcode.yasdb.com/ship/ideas/6614fdd4009f91eb87f32f98](https://pingcode.yasdb.com/ship/ideas/6614fdd4009f91eb87f32f98)    ?#YASHAN-2818 HashJoin性能优化

*SR链接：*  ：    [https://pingcode.yasdb.com/pjm/items/6618e9f7fd997db58ad83345](https://pingcode.yasdb.com/pjm/items/6618e9f7fd997db58ad83345)    ?#YDBRD-26180 HashJoin性能优化

##   [1. 总述](#1-总述)  

基于批量执行框架，实现批量Partition Hash Join算子。 整体目标：

- 1.Hash Join的性能优于单行执行。


###   [1.1 需求来源](#11-需求来源)  

在行存引擎跑批生成报表的场景，数据量大，表达式计算复杂，YashanDB和Oracle在SQL引擎的计算效率上的差距非常明显，性能通常落后2到10倍之间，客户对性能提升述求明确。 通过对聚集函数场景指令分布分析，SQL引擎和存储引擎指令数量各占比50%，即使没有SQL引擎，YashanDB仍然与Oracle有性能差距。因此优化执行代码无法解决成倍的性能差距。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

本需求的目标是通过批量执行来优化Hash Join的性能。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|整体框架|见下文|是|是|----|
|功能|执行流程|见下文|是|是|----|
|功能|分区算法|见下文|是|是|----|
|功能|数据倾斜处理|见下文|是|是|----|
|可维可测|监控hash join性能指标|见下文|是|是|----|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无开源依赖

##   [2. 接口](#2-接口)  

SQL语法保持不变，新增以下会话级配置项：

- 1._HASH_JOIN_FORCE_PARTITION：用于强制执行分区，当该值为True时，无论build表数据多大，都会执行分区。配置项默认值为False。


##   [3. 规格与约束](#3-规格与约束)  

- 1._HASH_AREA_SIZE：hash join单个分区可使用的最大内存大小，默认32MB，最小1M，最大8G。当hashtable的大小小于该值时，不会执行分区，会把整个hashtable放在内存。
- 2.最大支持4096个分区。


##   [4. 特性](#4-特性)  

###   [4.1 整体框架](#41-整体框架)  

Hash Join核心功能是基于TupleSet物化区实现了支持分区的哈希表——JoinPartHashTable，并在此基础上实现了build和probe两个流程。为了方便后续的并行化和pipleline改造，使用Sink和Source执行模型。将整个执行过程拆分成了Sink和Source两个阶段。

Sink阶段会fetch右表的数据并将数据分区写入JoinPartHashTable的TupleSet中。整个Sink阶段又拆分成了Sink、Combine、Finalize三个阶段。主要涉及到2个数据结构，HashJoinLsnk和HashJoinGsnk。

-     1. Sink阶段：每个线程创建独立的HashJoinLsnk，每个HashJoinLsnk包含一个JoinPartHashTable，独立的接收输入，并将接收到的数据分区写入JoinPartHashTable的TupleSet中。

-     1. Combine阶段：每个线程执行完成后，进入Combine阶段，将HashJoinLsnk上的JoinPartHashTable添加到HashJoinGsnk上。

-     1. Finalize阶段：将HashJoinGsnk上来自不同线程的多个JoinPartHashTable合并到一个全局的JoinPartHashTable，这里可能涉及到重新分区。

- 在当前的实现中，只包含一个HashJoinLsnk和一个HashJoinGsnk，挂在RtOpHashJoin上。
- Source阶段fetch左表，并在Sink阶段生成的JoinPartHashTable中执行探测，返回最终的结果集。


![](https://pingcode.yasdb.com/atlas/files/public/67396eb58970c2af4f521aaa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4MTEsImV4cCI6MTc4MjQ0OTYxMX0.fhz7V-sxNLPt0W0hkDPUhc_V7jdGKmZJEstMBQ4dmHw)

###   [4.2 执行流程](#42-执行流程)  

####   [4.2.1 Sink阶段的执行流程](#421-sink阶段的执行流程)  

Sink阶段比较简单，整个过程拆分成了

整个阶段：INIT、BUILD、PROBE、SCAN_HT、SCAN_PROBE、DONE

####   [Sink阶段流程：](#sink阶段流程)  

- 1.sink：将build表分区写入HashTable的TupleSet
- 2.finalize：根据各分区大小，执行repartition，这个阶段只会扩大分区数，不会减少分区数
- 3.spillProbe: 根据分区数决定是否进行probe表物化，若需要物化，则执行probe表物化
- 4.初始化好GlobalSource和LocalSource的状态，进入INIT阶段


####   [INIT状态：](#init状态)  

- 1.调用jphtPrepareFinalize，确定需要构建hashMap的分区数，生成[partitionStart, partitionEnd]，若分区已经扫完，进入DONE状态，否则进入BUILD状态


####   [BUILD状态：](#build状态)  

- 1.若build表为空(无论是否有分区)，left join/full join/anti join进入SCAN_PROBE状态，其他join类型进入INIT状态
- 2.调用jphtFinalize，选定本次需要构建hashMap的TupleChunk，然后构建hashMap，若已经没有TupleChunk，根据join类型和是否分区等规则进入下一状态
- 3.若isExternal为true，根据[partitionStart, partitionEnd]初始化probeScanner，进入PROBE状态


#####   [步骤2的状态转换图：](#步骤2的状态转换图)  

- 1.若只有一个分区或有多个分区但是isPartital为false(只有一个分区的前提是isPartial也为false)：inner join/left join/semi join/anti join -> INIT， right/full/right semi/right anti -> SCAN_HT
- 2.若有多个分区且isPartial为true：inner join/semi join -> INIT,  right join/full join/right semi join/right anti join -> SCAN_HT,  left join/anti join -> SCAN_PROBE


####   [PROBE状态：](#probe状态)  

- 1.若JphtScanner.isDone为true，调用hjFetchProbe得到probe表的DataChunk，若EOF，进入BUILD状态，否则生成key，调用jphtProbe执行探测
- 2.若JphtScanner.isDone为false，调用hjBatchProbeNext执行JphtScanNext


#####   [不同join类型的JphtScanNext执行流程：](#不同join类型的jphtscannext执行流程)  

- 1.inner join：调用jphtScanInnerJoin比较key值和filter，对于匹配的记录，返回
- 2.left join：isPartial为false：调用jphtScanInnerJoin比较key值和filter，对于匹配的记录，打标志，返回。DataChunk匹配结束后，对未打标志的部分记录右表补NULL返回。isPartial为true：调用jphtScanInnerJoin比较key值和filter，对于匹配的记录，打标志，返回。


####   [SCAN_HT状态：](#scan-ht状态)  

- 1.遍历build表，返回结果
- 2.遍历结束后，根据join类型和isPartial进入下一状态


#####   [步骤2的状态转换图：](#步骤2的状态转换图-1)  

- 1.若isPartial为false：INIT
- 2.若isPartial为true：right join/right semi join/right anti join -> INIT,  full join -> SCAN_PROBE


####   [SCAN_PROBE：](#scan-probe)  

- 1.遍历probe表，返回结果
- 2.进入INIT状态


####   [Source阶段流程：](#source阶段流程)  

|join类型|整体执行流程|单个分区执行流程|probe端是否忽略NULL|build端是否忽略NULL|probe端是否需要访问标志|build端是否需要访问标志|是否需要遍历probe表|是否需要遍历build表|build表为空|probe表为空|
|---|---|---|---|---|---|---|---|---|---|---|
|inner join|INIT:,  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表进行探测，返回匹配的结果    
  3.继续执行1，直到遍历完build表,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，返回匹配的结果|是|是|否|否|否|否|结果为空|结果为空|
|left join|  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表进行探测，返回匹配的结果，在匹配匹配的probe端记录上打标志    
  3.继续执行1，直到遍历完build表,4.遍历probe表，右表补NULL，将未打标志的probe端记录返回,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，返回匹配的结果，不匹配的结果右表补NULL返回|否|是|否|否|否|否|结果为左表|结果为空|
|right join|  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表进行探测，返回匹配的结果，并在匹配的build端记录上打标志    
  3.继续执行1，直到遍历完build表    
  4.左表补NULL，遍历build表，将未打标志的记录返回,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，返回匹配的结果，并在匹配的build端记录上打标志,3.左表补NULL，遍历build表，将未打标志的记录返回|是|否|否|是|否|是|结果为空|结果为右表|
|full join|  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表进行探测，返回匹配的结果，并在匹配的probe端和build端的记录上打标志    
  3.继续执行1，直到遍历完build表    
  4.左表补NULL，遍历build表，将未打标志的记录返回    
  5.右表补NULL，遍历probe表，将未打标志的记录返回,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，返回匹配的结果，并在匹配的build端的记录上打标志，不匹配的右表补NULL返回,3.左表补NULL，遍历build表，将未打标志的记录返回|否|否|是|是|是|是|结果为左表|结果为右表|
|semi join|  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表，拿到未打标志的记录进行探测，返回匹配的结果（当有多次匹配时，只返回第一次匹配），同时在probe端的记录打标志    
  3.继续执行1，直到遍历完build表,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，返回匹配的结果（当有多次匹配时，只返回第一次匹配）|是|是|是|否|否|否|结果为空|结果为空|
|right semi join|  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表进行探测，在build表匹配的记录上打标志    
  3.继续执行1，直到遍历完build表    
  4.左表补NULL，遍历build表，将打了标志的部分记录返回,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，在build表匹配的记录上打标志,3.左表补NULL，遍历build表，将打了标志的部分记录返回|是|是|否|是|否|是|结果为空|结果为空|
|anti join|  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表未打过标志的记录进行探测，在probe表匹配的记录打标志    
  3.继续执行1，直到遍历完build表    
  4.右表补NULL，遍历probe表将未打过标志的记录返回,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，返回不匹配的记录|否|是|是|否|是|否|结果为左表|结果为空|
|right anti join|  
|**Nested Loop HashJoin:**,1.遍历build表记录构建hashTable    
  2.遍历probe表进行探测，在build表匹配的记录上打标志    
  3.继续执行1，直到遍历完build表    
  4.左表补NULL，遍历build表，将未打标志的记录返回,**HashJoin:**,1.遍历build表构建hashTable,2.遍历probe表进行探测，在build表匹配的记录上打标志,3.左表补NULL，遍历build表，将未打标志的记录返回|是|否|否|是|否|是|结果为空|结果为右表|


###   [4.2 Hash Table结构](#42-hash-table结构)  

###   [4.3 分区算法](#43-分区算法)  

当HashTable太大，无法完全放进内存时，需要进行分区，单个分区允许的最大大小由_HASH_AREA_SIZE决定。JoinPartHashTable的分区数初始大小为4，在Sink的Finalize阶段，会根据实际写入的数据量和数据大小重新评估最终的分区数，并执行分区合并或分区扩展。最大可扩展到4096个分区。

分区数的确定规则为：持续的将分区数乘以2，直到最大的分区的预估大小小于_HASH_AREA_SIZE的1/2。

###   [4.4 数据倾斜处理](#44-数据倾斜处理)  

分区扩展是根据数据量预估的，当存在数据倾斜时，某些分区的数据量可能会超过_HASH_AREA_SIZE的大小。在执行这些分区的Hash Join时，可能会出现内存不足的情况。为了使Hash Join能正常运行，对于大小大于_HASH_AREA_SIZE的分区，会采用Nested loop hash join，将build表拆分为多个小的range，然后多次扫描probe表来执行hash join。

###   [4.5 监控hash join性能指标](#45-监控hash-join性能指标)  

通过设置ALTER SESSION SET statistics_level=ALL; SET AUTOTRACE ON;可查看Hash Join的监控指标，包括：

- 1.Estimate Rows：build表预估行数，从统计信息获取。
- 2.Estimate Row Size：build表每行数据的预估大小，根据表结构推导。
- 3.Estimate Data Size：build表预估的数据总大小，决定初始分区数。
- 4.Estimate Partition Count：预估的初始分区数。
- 5.Force Partition：是否开启强制分区。
- 6.Real Rows：build表实际有效数据行数。
- 7.Physical Partition Count：物理分区数，即build表数据实际创建的分区数。
- 8.Logical Partition Count：逻辑分区数，由于可能存在数据倾斜，执行时会对小的物理分区进行合并，合并后的物理分区为1个逻辑分区。每个逻辑分区数是一个join单元。
- 9.Logical Partitions：显示逻辑分区的详细信息，每个逻辑分区对应一个三元组:[物理分区序号, 分区的数据行数, 分区的range数]，其中若只有一个物理分区，物理分区序号为：(n)，否则为(start, end)，如(1)表示分区1,(1, 4)表示分区1,2,3。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

CI用例。

##   [6.资料设计章节](#6资料设计章节)  

不涉及资料。

##   [7.未来规划](#7未来规划)  

- 1.并行Hash Join
- 2.probe物化裁剪、probe表首个分区不物化


## Attachments:

[image2024-7-8_15-50-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjNhMWFkOWEzMzExZGM5OTAzIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.LK7k4i55eypZHtO6zURWfXWf47mn55G1G0RE3_EzssU)

 (image/png)    


[image2024-4-25_15-13-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjM4OTcwYzJhZjRmNTIxYTkwIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.iKwN7EUUPo99lz2szGDb-7jmlbSJcX_VQDeHBRvNngA)

 (image/png)    


[image2024-4-25_15-8-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjM4OTcwYzJhZjRmNTIxYTkxIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.8VX8J1bkTEDFkyEB_LI5zOPzzvVirLwcTDgWo6GsYG8)

 (image/png)    


[image2024-4-25_15-5-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjNhMWFkOWEzMzExZGM5OTA0IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.vK4Pgzkq-j6KHc1mCLNrMxUwaXZ22V0v_OV1bep-jmc)

 (image/png)    


[image2024-4-25_11-11-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjNhMWFkOWEzMzExZGM5OTA1IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.dBTXa0JaMxANLWPQmhfCWBOgdBo2LJHAJwht9C5cdLM)

 (image/png)    


[image2024-4-19_14-19-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjM4OTcwYzJhZjRmNTIxYTkzIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.8dK6wljT6wcJbF0DwZ4AHogyQJuRnT64LfGMo9jIZOY)

 (image/png)    


[image2024-4-19_14-19-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjNhMWFkOWEzMzExZGM5OTA3IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.oE5PPo3-rM4GoMq8XAjGo3B5LFQdOwU9A6ZQ83DIwTE)

 (image/png)    


[image2024-4-19_11-14-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjNhMWFkOWEzMzExZGM5OTA4IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.JA4x1E0xNuK-EJ5QGpFsdA1MPrWLedFHGbuXwEIXeBo)

 (image/png)    


[image2024-4-18_18-34-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjNhMWFkOWEzMzExZGM5OTA5IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.m3OLrelNFf3TYFlINiVa07hGW3jSBK3VYUfza7XQ4gI)

 (image/png)    


[image2024-4-18_17-35-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjNhMWFkOWEzMzExZGM5OTBhIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.49reVAms9brE0xJ8qD3_3uZCb5KRjWm2bm8U8mZtrGE)

 (image/png)    


[image2024-4-18_17-32-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjM4OTcwYzJhZjRmNTIxYTk2IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.leoWztJmb8SO0moM2m94EVTNipNUYNJfT_UqpKuan6g)

 (image/png)    


[image2024-4-18_11-36-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYTk3IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.T9cpCaKKGbYQx6NTeTAAJz1448gAE26MX_tM9er9fEY)

 (image/png)    


[image2024-4-18_11-21-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYTk5IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.Tdu-bIEOT7iabVD9H-aaxUVHBzPUvYlFyvv19utaKAk)

 (image/png)    


[image2024-4-18_10-56-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYTlhIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.KEYdRD35oxqgx3ietvxAQERBqARlV59f548INncNJgU)

 (image/png)    


[image2024-4-17_17-53-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTBiIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.aNjReZM_ZSJ6KpviOMFgo9hNn9KHrUS08uP-zqymWxQ)

 (image/png)    


[image2024-4-17_17-34-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTBjIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.njtLDZskdrjV-zwjGwV3QDnUQiVVLcOK3fyybrFvIq0)

 (image/png)    


[image2024-4-17_17-19-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYTliIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.CU3vOzTcyX1vkMcNCoNW0L59AwtW2eiRmQhssRDMDNw)

 (image/png)    


[image2024-4-17_17-17-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTBlIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.rTX4TH0eu-SeerlCu8Bodc-vouT3LFw2bvvKjMqRclY)

 (image/png)    


[image2024-4-17_16-54-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYTljIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.zCObpzV7MjOvlS9d0YFvlq6Fkrc6y0ZmjKWRRyHr2I4)

 (image/png)    


[image2024-4-17_16-54-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTEwIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.rmnaXJKdcA6N5EZQR_SYnDga7hQWzkym_arG7c_hrvQ)

 (image/png)    


[image2024-4-17_16-6-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTExIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.pWBhQJiL3jmKyXTp1kPGWI5f40ArAveKmTp6FTqlWcA)

 (image/png)    


[image2024-4-16_16-32-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYTlkIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.PlwnUx6ttiOhb_Azi4kOgfUWj1x6h1s6GjrkCGoBPrM)

 (image/png)    


[image2024-4-16_16-11-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTEyIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.hysM-7mhyGKN5IJfFSuA2JE5T1wD9mPiVeWQWNUIz1A)

 (image/png)    


[image2024-4-16_15-55-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYTlmIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.a4bd552GzIv6OW8yE6Bke37R75zTcxTcgZskFsAdN-8)

 (image/png)    


[image2024-4-16_15-41-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYWEwIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.7840yk7uBbcKUfTQPi83GBp0BXTZfDpHxpdXBGz5MnM)

 (image/png)    


[image2024-4-16_15-35-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYWExIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.3YHZEInEUrf1KKzMP7z2Uz-u9QpQ4KL6P1hohXS0LTY)

 (image/png)    


[image2024-4-16_15-12-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjQ4OTcwYzJhZjRmNTIxYWEyIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.sNIKeyEx0dly2kUlrZGk_v67ZiEZslwWwrx7zRDLJwc)

 (image/png)    


[image2024-4-16_14-46-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTE0IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.iJ6_6lVluAiDb2UTMmCZsEiAkmikwO7yvI2ywJoNqCY)

 (image/png)    


[image2024-4-16_14-38-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjRhMWFkOWEzMzExZGM5OTE1IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.GkiboDfTjODHC4--U7-lNXZLiab01M78Mkrc0lUWYdQ)

 (image/png)    


[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTE2IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.x0d334YARiO_eUDXAMlEavU_LF5snjQQLf2crTfLeJ0)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTE3IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.jdzsZvpx6xAQvPnX1GcgGaCK1-MQI1rOs4np3ORSPj8)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTE4IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.-YjuozBHea2vrkQX-o21O5Z6o_597orVkgdd7GIwvJc)

 (image/png)    


[image2024-6-14_11-33-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjU4OTcwYzJhZjRmNTIxYWE0IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.jsTKZwYlB5_k64UGuk0_2zWsoqkqgYw0mtbc2BtsWEM)

 (image/png)    


[image2024-6-14_11-4-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjU4OTcwYzJhZjRmNTIxYWE1IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.QSWA6hTEU7mWzqzFOi44Q5LVcBYTWG0V4M3snH1sffE)

 (image/png)    


[image2024-6-14_11-3-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTE5IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.50zOYmx1fvlx_NaR2n9WtF5aMA73w6TpXB0h3oazCCQ)

 (image/png)    


[image2024-6-14_10-59-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTFhIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.Ua6gcK8aA4pvqx5mVz1lZQs6y3BGZXsxUhHvKql-1E4)

 (image/png)    


[image2024-4-28_17-47-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTFiIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.W93ZddtRReSd3-KmVr4qQaEfTRL1OWW6kGhBduFuu9I)

 (image/png)    


[image2024-4-28_16-54-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjU4OTcwYzJhZjRmNTIxYWE2IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.FQIZjXqA8w-3DSAc0YToUDxff6WOSccmQI1iRtOxTj4)

 (image/png)    


[image2024-4-28_14-54-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjU4OTcwYzJhZjRmNTIxYWE3IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.t5UXCh9rmHTN9x-9mOjyerpsA3DeBgH20v84gPmDm9E)

 (image/png)    


[image2024-4-28_11-57-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTFjIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.4K0qxqFarsCVOVXjciM7rMbh-YpXIbJC1b7b8Ti98IY)

 (image/png)    


[image2024-4-28_11-11-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjU4OTcwYzJhZjRmNTIxYWE4IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.7ohDuXP9Sh-7fKU4lJrZTg1y21fQSUFvMCT7-eoqTD0)

 (image/png)    


[image2024-4-28_11-3-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjU4OTcwYzJhZjRmNTIxYWE5IiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.Sd5Teq_De2oWZ5nR816-sGFOQGaDO66ulazB-KYdrAM)

 (image/png)    


[image2024-4-28_10-51-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYjVhMWFkOWEzMzExZGM5OTFkIiwicmVmX2lkIjoiNjczOTZlYjM1OTNmOTljOWZmMjM4ODhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODExLCJleHAiOjE3ODI1MjUyMTF9.vAM0h3uLgBzz_yZUXBYESA4LHEIn7WvBUW9S7J-HHAw)

 (image/png)    
