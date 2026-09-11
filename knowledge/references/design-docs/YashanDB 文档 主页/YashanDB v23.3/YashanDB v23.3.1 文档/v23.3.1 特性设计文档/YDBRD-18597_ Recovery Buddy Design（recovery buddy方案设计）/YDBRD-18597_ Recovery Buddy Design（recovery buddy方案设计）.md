Created by 同二鹏, last modified by  梁荣钦 on 七月 24, 2024

* IR链接：*    [https://pingcode.yasdb.com/pjm/items/66114fcc579a3edb84d66856](https://pingcode.yasdb.com/pjm/items/66114fcc579a3edb84d66856)    *?#YDBRD-18597 支持recovery buddy*

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

YashanDB共享集群架构中，当出现部分实例故障时，DB组件触发实例故障在线恢复。恢复过程主要分为两个阶段，第一阶段完成共享缓存恢复以及构造恢复集，第二阶段完成页面恢复，事务区托管等逻辑。master实例通过分析故障实例日志，结合共享缓存信息完成恢复集构造。当故障实例日志量巨大时，此阶段耗时急剧上升。Recovery Buddy机制，通过设定Buddy Instance，于数据库运行过程中，实时维护Buddy Instance恢复集，当实例发生故障，其Buddy Instance未故障时，故障恢复时尽量减少扫描故障实例日志，可从内存中获取恢复集，从而提高实例恢复效率。

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=150628337](https://conf.yasdb.com/pages/viewpage.action?pageId=150628337)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|性能|集群实例故障在线恢复|详见第四节|是|是|YDBRD-18597|


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|_buddy_instance_memory|范围[5, 100)，默认值15|表示recovery buddy恢复集占用空闲share pool的百分比|是|
|buddy_instance_scan_timeout|范围[0, 无穷]，默认值10|表示buddy instance扫描redo的等待间隔时间，单位为秒|是|
|buddy_instance_scan_interval|范围[0,无穷），默认值64M|表示buddy instance单次分析日志读取的pack数量|是|
|buddy_instance|范围[0, 63], 默认值1|表示伙伴实例的个数，配置为0，则不开启recovery buddy,配置大于1，效果等同于1|是|
|v$share_pool|视图新增recovery buddy pool显示数据|||


##   [3. 规格与约束](#3-规格与约束)  

- 暂不支持多个Buddy Instance


##   [4. 特性](#4-特性)  

###   [4.1 架构](#41-架构)  

为了减少在线恢复第一阶段耗时，实例在内存中实时维护buddy instance的恢复集。通过分析buddy instance的日志，构造页面恢复集。

![](https://pingcode.yasdb.com/atlas/files/public/67396ea58970c2af4f5219fc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVvS0NBQVFBQUFDZ0FBQUFBQUFBQUFBQUFJQUFCZ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFJQUNBQkFBaEFBZ0FBQUFBZ0FBQ0FBQUFCQUJBQUFBQUFBQUJBRUFBQUFBQUFCZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUJJQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MjksImV4cCI6MTc4MjQ0OTQyOX0.Or94g7EHtudnku1kl24c3O4-Fkvhl2MgbfCdLlExaUY)

###   [4.2 详细设计](#42-详细设计)  

####   [4.2.1 内存管理](#421-内存管理)  

为了易用性考虑，不添加更多内存配置参数的考虑下，buddy instance恢复集内存可使用share pool管理。增加配置参数_recovery_buddy_memory，表示占用share pool的百分比，范围[5, 100)，默认值10

#####   [4.2.1.1 内存设计](#4211-内存设计)  

Recovery Buddy Pool作为Share Pool的一部分，归属于share pool的内存区域，需要使用memory pool管理机制，以实现share pool不同内存区的动态均衡能力。

- 需要满足快速查找能力，需要分配哈希桶内存
- Memory Pool管理机制存在内存不连续的特点


![](https://pingcode.yasdb.com/atlas/files/public/67396ea58970c2af4f5219fd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVvS0NBQVFBQUFDZ0FBQUFBQUFBQUFBQUFJQUFCZ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFJQUNBQkFBaEFBZ0FBQUFBZ0FBQ0FBQUFCQUJBQUFBQUFBQUJBRUFBQUFBQUFCZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUJJQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MjksImV4cCI6MTc4MjQ0OTQyOX0.Or94g7EHtudnku1kl24c3O4-Fkvhl2MgbfCdLlExaUY)

1. recovery buddy pool使用mempory pool管理内存，提供等同页面的内存管理方式。
1. 恢复集内存占用场景比较特殊，内存分配按照redo先后顺序，内存回收也是按照redo先后顺序。可以将buddy pool的内存使用抽象为先进先出队列。
1. buddy pool内存维护两个链表，itemlist,bucketList。两个链表都是链接Memory Pool的页面，分别代表恢复集元素的内存和哈希桶的内存。
1. 内存占用以append方式不断往后添加，当前页面使用完毕后，分配freeList上的空闲页面。
1. 内存回收为页面级别，当某个页面整体空闲时，从usedList转移到freeList。按照业务特点，内存回收顺序取决于redo顺序，因此内存回收总是usedList头部页面。


**内存分配**

**不复用当前内存页面的空闲空间，append方式追加，当前页面不能追加内存，分配新的页面**

![](https://pingcode.yasdb.com/atlas/files/public/67396ea5a1ad9a3311dc9870/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVvS0NBQVFBQUFDZ0FBQUFBQUFBQUFBQUFJQUFCZ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFJQUNBQkFBaEFBZ0FBQUFBZ0FBQ0FBQUFCQUJBQUFBQUFBQUJBRUFBQUFBQUFCZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUJJQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MjksImV4cCI6MTc4MjQ0OTQyOX0.Or94g7EHtudnku1kl24c3O4-Fkvhl2MgbfCdLlExaUY)

#####   [4.2.1.2 数据结构设计](#4212-数据结构设计)  

- 在线恢复时所用恢复集元素结构，需要精简,大部分字段无用。
- 因为内存不连续的特点，需要使用二级结构管理哈希桶，bucket结构需独立，不能复用BufferBucket。
- 恢复集存在裁剪情况，恢复集元素内存需要满足复用能力。


```
typedef struct StRecoveryBuddyCtrl {
    BlockId                     bid;
    CodUint64                   lastLsn;
    CodBool                     used;
    CodChar                     reserve[7];
    struct StRecoveryBuddyCtrl* next;
} RcyBuddyCtrl;

typedef struct StRecoveryBuddyBucket {
    SpinLock                    lock;
    CodUint32                   unused;
    struct StRecoveryBuddyCtrl* first;
} RcyBuddyBucket;

typedef struct StRecoveryBuddyWorker {
    CodUint8    reverseBuddyInst;
    CodChar     reserve[7];
    RdPoint     loadPoint;
    AnkHandler* handler;
    CodThread   thread;
    CodChar*    buffer;
} RcyBuddyWorker;

typedef struct StRecoveryBuddyMemoryManager {
    SpinLock           lock;
    CodUint32          totalItem;
    CodUint8           hwm; // item hwm for current block
    MemoryPool         pool;
    MpoolBlockCtrlList itemBlockList;
    MpoolBlockCtrlList bucketBlockList;
} RcyBuddyMemContext;

#define BUDDY_BUCKET_BLOCKS (1024) // 16K * 1024 / sizeof(RcyBuddyBucket) = 1M

typedef struct StRecoveryBuddyManager {
    SpinLock           lock;
    CodChar*           hashBuckets[BUDDY_BUCKET_BLOCKS];
    RcyBuddyMemContext memContext;
    RdPoint            nextPoint;
    CodChar            dcAuxLog[MAX_LOGIC_RECORD_SIZE];
    CodUint64          dcAuxLogLsn;
    RcyBuddyWorker     worker;
    CodUint8           reverseBuddyMap[ANK_MAX_INSTANCES];
} RcyBuddyManager;



```

####   [4.2.2 线程设计](#422-线程设计)  

1. 分析线程与在线恢复分析线程有所区别。


- 在线恢复分析线程动态创建销毁，buddy分析线程为常驻线程
- 在线恢复线程从故障实例rcy point扫描至日志结尾结束工作，buddy分析线程常驻持续扫描看护实例的新增日志


1. 因为无法并发读取日志，且构建恢复集的主要耗时开销在于日志读取，因此设定单线程构建恢复集。
1. reform过程（实例重组或者实例恢复），buddy恢复集需要暂停维护。


- 实例个数变化，需要变更伙伴映射关系，本实例恢复集无需继续维护
- 实例个数未变化，一定是实例恢复，如果恢复的实例包含伙伴实例，在线恢复需要使用维护的恢复集，暂停维护buddy恢复集，保证在线恢复无并发使用恢复集。如果恢复的实例不包含伙伴实例，暂停buddy恢复集，让出IO资源，保证在线恢复的性能。


综上，buddy恢复集维护可以复用gMonProc或者独立线程RcyBuddyProc

![](https://pingcode.yasdb.com/atlas/files/public/67396ea58970c2af4f5219ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVvS0NBQVFBQUFDZ0FBQUFBQUFBQUFBQUFJQUFCZ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFJQUNBQkFBaEFBZ0FBQUFBZ0FBQ0FBQUFCQUJBQUFBQUFBQUJBRUFBQUFBQUFCZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUJJQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MjksImV4cCI6MTc4MjQ0OTQyOX0.Or94g7EHtudnku1kl24c3O4-Fkvhl2MgbfCdLlExaUY)

####   [4.2.3 恢复集维护](#423-恢复集维护)  

#####   [4.2.3.1 日志读取](#4231-日志读取)  

1. 日志读取从伙伴实例的rcy point开始，持续读取后续日志
1. 读取日志频率需要做限制，不能无限占用IO资源，增加可配置的限制接口。_buddy_instance_scan_threshold参数控制扫描日志的间隔时间。
1. redo文件元数据为实例级别维护，实例间不会同步。恢复集构建过程读取日志时，如果需要切换日志文件，必须重新加载看护实例的redo文件信息。
1. 读取日志过程，存在日志文件被其他实例删除，复用等情况，此处不能做并发控制，否则对于数据库主业务场景存在较大性能影响。日志读取后，需要对日志做完整性、连续性校验。
1. 日志读取到末尾后，线程睡眠一定时间或者等待LFN同步唤醒。


#####   [4.2.3.2 日志分析](#4232-日志分析)  

1. 遍历日志，过滤attch block和detach block两种日志类型。根据attach block和detach block日志获取block id和对应的lsn信息，添加到恢复集，如果恢复集已经存在该block id，释放旧的恢复集item，重新分配item，记录新的block信息。
1. 过滤DC类逻辑日志，保存最后一条。


#####   [4.2.3.3 恢复集裁剪](#4233-恢复集裁剪)  

1. 随着伙伴实例持久化进行，rcy point不断推进。维护的恢复集部分页面已经不需要恢复，因此恢复集需要定期剔除恢复集页面。rcy point是记录在instance ctrl上，其信息实例间不会同步。恢复集裁剪时需要从磁盘加载伙伴实例的instance ctrl信息，获取更新后的rcy point信息。


####   [4.2.4 Buddy Instance关系](#424-buddy-instance关系)  

#####   [4.2.4.1 伙伴策略](#4241-伙伴策略)  

1. 伙伴策略需要满足节点数大于2时的看护关系，节点数可能是奇数，可能时偶数。因此不能制定两两互为伙伴的策略。本方案设计伙伴实例单向邻居伙伴策略，比如三实例部署，实例一看护实例二，实例二看护实例三，实例三看护实例一。


  


![](https://pingcode.yasdb.com/atlas/files/public/67396ea5a1ad9a3311dc9872/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVvS0NBQVFBQUFDZ0FBQUFBQUFBQUFBQUFJQUFCZ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFJQUNBQkFBaEFBZ0FBQUFBZ0FBQ0FBQUFCQUJBQUFBQUFBQUJBRUFBQUFBQUFCZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUJJQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MjksImV4cCI6MTc4MjQ0OTQyOX0.Or94g7EHtudnku1kl24c3O4-Fkvhl2MgbfCdLlExaUY)

#####   [4.2.4.2 伙伴变更](#4242-伙伴变更)  

1. 实例个数发生变化时，伙伴关系需要变化。实例维护的恢复集如何处理，一是直接丢弃，二是转移到新的看护实例上。两种策略需要基于代价统计决定。如果恢复集覆盖redo区间较小，重分析的代价比恢复集转移代价小，可以将恢复集丢弃。反之，则考虑迁移恢复集。
1. 确定新的伙伴关系后，各实例根据新的看护实例rcy point，从新加载日志，构建恢复集。


#####   [4.2.4.3 恢复集迁移](#4243-恢复集迁移)  

**方案一**

1. 先将发送实例的恢复集转为需要迁移的状态，如userList整体切到migratedList，初始化哈希桶
1. 遍历usedList的block，即可找到所有需要恢复页面的集合，批量发送至接收实例
1. 接收实例收到恢复集，获取页面和lsn信息，构造新的恢复集。如果此时仍然存在原有恢复集，需要将原有恢复集切到待迁移链，初始化哈希桶。
1. 发送实例清空待迁移链表。


**方案二**

恢复集不做迁移，直接销毁，各实例重新构建恢复集。

####   [4.2.5 reform应用](#425-reform应用)  

reform是主实例主导完成。第一阶段重建全局缓存，本实例内存构建恢复集。recovery buddy可以减少第一阶段恢复集构建的代价。如果故障实例只有一个应用buddy恢复集有两种方案。

1. 保持主实例完成恢复流程，主实例第一阶段构建恢复集时，将可用的buddy恢复集拉取过来。
1. buddy实例完成恢复流程，reform流程适配recovery buddy，主实例识别reform任务，具体的页面恢复由可用的buddy实例完成。


两种方案相比

**方案一**  复杂度低，需要付出恢复集拉取的成本。根据TPCC大压力经验，15G日志可能涉及百万级别恢复集。一般情况下，网络通信的耗时不到1毫秒，单次网络通信最多发送32K/(sizeof(BlockId) + sizeof(CodUint64)) = 2K。百万级别恢复集需要大概千次网络通信。耗时大约1S。

**方案二**  复杂度高，可减少一个实例恢复集拉取的代价。当发生多实例故障的情况，比如1，2，3，4节点，2，4节点故障，1节点为2节点的看护实例，3节点为4节点的看护实例。此方案下，仍需要拉取一个恢复集到执行页面恢复的实例。

先基于方案一实现，根据拉取恢复集代价决定是否采用方案二。

**方案一设计**

1. master实例处理在线恢复过程，第一阶段发送消息给故障实例的buddy instance
1. 故障实例的buddy instance收到master实例发送的消息后，创建若干线程，线程并发将恢复集信息发送给master实例。
1. master实例接收到恢复集信息，添加到本地恢复集。
1. master实例接收到恢复集后，从恢复集对应的日志点扫描故障实例日志，直到故障实例日志末尾。


![](https://pingcode.yasdb.com/atlas/files/public/67396ea58970c2af4f521a01/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVvS0NBQVFBQUFDZ0FBQUFBQUFBQUFBQUFJQUFCZ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFJQUNBQkFBaEFBZ0FBQUFBZ0FBQ0FBQUFCQUJBQUFBQUFBQUJBRUFBQUFBQUFCZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUJJQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MjksImV4cCI6MTc4MjQ0OTQyOX0.Or94g7EHtudnku1kl24c3O4-Fkvhl2MgbfCdLlExaUY)

**方案二设计**

1. master实例触发在线恢复任务，发送消息至故障实例的buddy instance，优先选择instance id小，且实例状态为open的buddy instance
1. buddy instance接收到消息后，创建恢复线程，执行页面恢复逻辑
1. buddy instance构建恢复集后，通知master实例。master实例unfreeze grc，托管事务区
1. buddy instance等待master实例unfreeze grc，执行日志重演，页面恢复，DDL恢复逻辑。
1. buddy instance通知master实例完成恢复操作。
1. master实例结束reform流程。


![](https://pingcode.yasdb.com/atlas/files/public/67396ea5a1ad9a3311dc9875/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVvS0NBQVFBQUFDZ0FBQUFBQUFBQUFBQUFJQUFCZ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFJQUNBQkFBaEFBZ0FBQUFBZ0FBQ0FBQUFCQUJBQUFBQUFBQUJBRUFBQUFBQUFCZ0FBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUJJQUFnQUFBQUFBUUFBQUFBQUFBQUFBQUFDQUFBQUFBSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg2MjksImV4cCI6MTc4MjQ0OTQyOX0.Or94g7EHtudnku1kl24c3O4-Fkvhl2MgbfCdLlExaUY)

###   [4.3 故障处理](#43-故障处理)  

####   [日志读取](#日志读取)  

1. 读取若发现日志不连续，不完整，清空恢复集。
1. 日志读取失败，结束本次恢复集维护，等待gmonProc下次触发恢复集维护


####   [恢复集内存](#恢复集内存)  

1. 恢复集内存申请不出，结束本次恢复集维护，等待gMonProc下次触发恢复集维护


####   [reform应用恢复集](#reform应用恢复集)  

**方案一**

1. 获取恢复集失败，master实例重试，恢复集获取可重入。多次获取的恢复集结果是稳定的。
1. 发生二次故障，识别二次故障reform信息，重新开始实例在线恢复


**方案二**

1. 发生二次故障，重新开始实例在线恢复。buddy instance需要清理旧的恢复资源，初始化新的恢复资源。复用之前的恢复集，基于二次故障信息再次构建完整恢复集，执行后续的恢复逻辑。


###   [4.4 统计信息](#44-统计信息)  

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

实例支持多个Buddy Instance

## Attachments:

[image2024-5-28_17-43-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTQ4OTcwYzJhZjRmNTIxOWY0IiwicmVmX2lkIjoiNjczOTZlYTQ3MjgyMDZlZmI5MmYyYTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjI5LCJleHAiOjE3ODI1MjUwMjl9.UD82z7ynQo0AeT3-5du5Y8FUMwpR34OIc6D6WABu9Oo)

 (image/png)    


[image2024-5-29_11-52-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTU4OTcwYzJhZjRmNTIxOWY2IiwicmVmX2lkIjoiNjczOTZlYTQ3MjgyMDZlZmI5MmYyYTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjI5LCJleHAiOjE3ODI1MjUwMjl9.EQrRL87WtS_m9yMBPOjTHgk8cMaF6S5D1N3oBam03WA)

 (image/png)    


[image2024-5-29_11-53-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTVhMWFkOWEzMzExZGM5ODZhIiwicmVmX2lkIjoiNjczOTZlYTQ3MjgyMDZlZmI5MmYyYTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjI5LCJleHAiOjE3ODI1MjUwMjl9.O5xt-BVJfUHJGRSFFRyZhEE-tdyzT8bvR8xLrGqVNok)

 (image/png)    


[image2024-5-30_17-0-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTVhMWFkOWEzMzExZGM5ODZkIiwicmVmX2lkIjoiNjczOTZlYTQ3MjgyMDZlZmI5MmYyYTM2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NjI5LCJleHAiOjE3ODI1MjUwMjl9.mJ9Zz0I2kYf_ZQ70wLNR5j_rYzHRPj_ei3f8cktRFBA)

 (image/png)    


## Comments:

|  [](null)  ,_buddy_instance_scan_num → buddy_instance_scan_interval ,Posted by guocanglong at 六月 12, 2024 14:39|
|---|
