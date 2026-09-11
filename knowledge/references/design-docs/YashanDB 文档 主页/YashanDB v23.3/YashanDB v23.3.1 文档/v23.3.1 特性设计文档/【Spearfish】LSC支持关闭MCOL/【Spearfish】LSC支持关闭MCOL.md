Created by 万谦, last modified on 七月 11, 2024

*详细设计-YDBRD-26165 : LSC支持关闭MCOL Design*

* IR链接：YDBRD-XXXX*

*SR链接：*    [YDBRD-26165](https://pingcode.yasdb.com/pjm/items/6618e35dfd997db58ad8245f)  

# 1. 总述

## 1.1 需求来源

原始的客户需求描述。关注需求的来源、规格、合理性，要用明确的语言描述，不能模棱两可。要把客户的业务场景描述清楚，知道客户希望怎么用，而且除了功能特性要求，也要尽可能了解非功能特性要求，例如性能、安全等。

**需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分行存和列存。**

LSC表MCOL在查询时效果差 并存在空间膨胀问题 而转冷需要一定的时间 在流式导入和冷热场景下支持关闭MCOL以达到查询性能稳定 

核心诉求：

1，需要语法支持在建表时或建表后关闭开启MCOL

2，关闭MCOL后需要提供一定的dml能力

3，关闭MCOL后需要支持多表更新

4，关闭MCOL后需要明确事务机制

部署形态：分布式

## 1.2 调研文档

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  [【Spearfish】LSC导入优化概要设计](150624499.html)  

  [LSC关闭MCOL调研](https://conf.yasdb.com/pages/viewpage.action?pageId=147782646)  

## 1.3 需求分析

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

1.3.1 语法支持

1 建表时指定LSC表开启或关闭MCOL

2 建表后通过alter语法开启或关闭MCOL

  


1.3.2 dml能力

1 已提交数据可见

2 本事务未提交数据可见

3 其它事务未提交数据不可见

4 锁及冲突解决

  


1.3.3 多表dml

支持多表dml 并且满足dml语义

  


1.3.4 事务机制

关闭MCOL后 提供一定的事务机制保证数据完整性

1 提交成功的数据持久化

2 回滚机制

## 1.4 数据字典

**描述本篇文档中特性的术语集**

## 1.5 开源依赖

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

# 2. 接口

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

# 3. 规格与约束

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

  


1，关闭MCOL后事务能力受到限制 同行冲突时不等待而是first win后一个事务失败

2，同会话下 同张表的bulk load模式插入和普通dml互斥

3，事务内的语句如果在插入rgd数据后失败 则事务整体回滚 若在插入rgd数据前失败 则语句回滚

4，  LSC_MCOL_ENABLED配置只影响后续建表的默认MCOL打开关闭情况



PS：本SR完成后进行了一次规格修复，讨论详见：

  [https://pingcode.yasdb.com/wiki/pages/6739722f728206efb92f4b06](https://pingcode.yasdb.com/wiki/pages/6739722f728206efb92f4b06)    


|变更规格|SR之前表现|SR支持后表现|解释|
|---|---|---|---|
|LSC插入|默认插入到MCOL中,要转冷需要等待MCOL TTL时间自动转换或强制使用alter slice命令转换|关闭MCOL后插入先缓存到内存结构中,事务过程中按照一定的刷盘策略生成slice文件,事务期间数据只对本会话可见 最终事务提交更新元数据对外可见|  
|
|SCOL删除|流程：锁行->设置deleteBitMap→提交,说明：每行上的事务性严格保证|流程：设置内存pendingDelete信息->开始提交->锁行->设置deleteBitMap→提交完成,说明：事务进行期间不再锁行 使用缓存保留本事务的删除信息 只等到事务提交时才按顺序对行（实际是chunk）加锁 设置最终delete信息|SCOL的删除操作也作为内存数据缓存在handler上 |
|SCOL更新逻辑日志|由于是删除 + 插入热数据 可保证完整的逻辑日志解析能力|**插入冷数据的日志解析没支持 故而不能完整解析冷数据的update**|  
|
|SCOL更新后冲突|报错唯一性冲突|所有带索引情况下的update都默认转变为replace|update变为upsert|
|AC扫描|scol数据被delete后 ac部分数据失效 未失效数据可走ac扫描|scol数据删除放到最后失效ac 事务期间ac扫描退化成表扫描|  
|
|行冲突处理|1.不带索引时时序表现,时序1 事务A操作行x 加上行锁,时序2 事务B操作行x 等待行锁,时序3 事务A提交 放行锁,时序4 事务B加行锁成功 进入操作判断,2.带索引时时序表现和上面相同,  
,此时操作判断由于在加锁后可以确保锁住的行一定没有发生改变|1.不带索引时时序表现,时序1 事务A操作行x,时序2 事务B操作行y,时序3 事务AB谁先加上行锁 谁先操作（例如B先提交先拿锁）,时序4 事务B提交 放锁,时序5 事务A加上行锁 进入操作判断,2.带索引时时序表现,时序1 事务A操作行x 对索引对应行加锁,时序2 事务B操作行x 尝试索引对应行加锁 进入等待事务A结束流程,时序3 事务A加上行锁 提交 放行锁 索引xslot锁,时序4 事务B尝试索引对应行加锁 加上行锁 提交 放锁,  
|锁的操作延迟到提交的时候,此时再去锁行 如果发生了行迁移 则无法确定当前的操作是否正确,例如一个更新（删除+插入）操作不能准确判断删除的行是被自己删除的 更新操作的正确性没法保证,因此：,开启row movement 同行冲突前一个事务成功 后一个事务失败,关闭row movement 由于都是删除操作 一定可保证删除成功 两个事务都成功|
|SavePoint|非bulkload插入的事务对savepoint使用没有限制,bulkload插入后若事务没提交 不允许创建savepoint,创建savepoint后 不允许进行bulkload插入|bulkload插入或关闭MCOL进行dml后事务没提交（存在内存数据） 不允许创建savepoint,创建savepoint后 不允许进行bulkload插入及关闭MCOL进行dml|  
|
|auto commit|非bulkload的事务对auto commit的设置没有限制,打开auto commit后 不允许进行bulkload插入|1. 打开auto commit后 不允许进行bulkload插入 此限制不变
1. 非bulkload事务 不限制auto commit的设置 但要从机制上限制小文件的迅速产生
|  
|
|事务回滚|插入rgd数据后失败 则事务整体回滚 若在插入rgd数据前失败 则语句回滚|插入rgd数据后失败 则事务整体回滚 若在插入rgd数据前失败 则语句回滚|回滚粒度保持一致 但插入的数据新增了删除信息|
|bulkload操作限制|单个会话只能对一张表进行bulkload插入操作 并且和表上所有普通dml互斥|单个会话可对多张表进行bulkload插入操作 并且只在表内bulkload和普通dml互斥|  
|


  


如何限制小文件迅速产生：

clickHouse 

使用配置项  **parts_to_throw_insert**  限制单个分区中活跃的文件数量 当后台合并发现现存值超过此配置时 直接中断插入

  [https://clickhouse.com/docs/en/operations/settings/merge-tree-settings#parts-to-throw-insert](https://clickhouse.com/docs/en/operations/settings/merge-tree-settings#parts-to-throw-insert)  

  


startrocks

控制合并版本 默认1000

  [https://docs.starrocks.io/zh/docs/3.0/faq/loading/Loading_faq/](https://docs.starrocks.io/zh/docs/3.0/faq/loading/Loading_faq/)  

  


两者都是通过限制现存待合并的文件个数限制后续小文件的产生

  


yasdb小文件限制方案：

数据库内部记录小文件的增长速度 采集时间为3s 若3s内的小文件产生数量大于300 则会插入报错

小文件的定义：行数小于配置项scolSliceRows的1/32

# 4. 特性

## 4.1 关闭开启MCOL功能

4.1.1 语法

```
create table xx disable/enable mcol;
alter table xx disable/enable mcol;
```

增加全库默认MCOL开关配置项：   LSC_MCOL_ENABLED 内存及重启都生效 默认值关闭

DBA_TABLES视图增加字段MCOL表示是否开启MCOL 此字段LSC表展示true/false 其它表类型字段为空

  


4.1.2 alter disable mcol处理

关闭MCOL前的MCOL内数据立马做一次数据转换 

按照目前的强制转换流程 依赖后台线程进行实际的转换 而前台只负责触发和校验 

设计关闭MCOL流程如下：

1，触发强制转换（加表共享锁）

2，加表排他锁

3，检查是否已全部转换

4，若全部转换 则修改表mcol属性 返回成功

5，若还有没转换的vgd 则进行报错

## 4.2 pendingDelete设计

pendingDelete作为当前事务的删除信息缓存 支持以下功能：

1 按chunk粒度聚集 方便删除信息合并

2 每行记录版本信息 保证事务可见性正确

3 缓存索引列数据 最终删除时索引删除需要此信息找行

  


**数据结构：**

按slice chunk粒度序列化

![](https://pingcode.yasdb.com/atlas/files/public/67396ecb8970c2af4f521b81/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

pendingDeletes顶层由hashMap构成 其中hashMap支持动态扩展

  


常驻内存：hashMap

可序列化数据：pendingDeleteItem ptr

  


```
#define PENDING_DELETE_KEY_BUFFER_SLICE 8

typedef struct StSpfPendingDeleteNode {
    CodUint32 sliceId;
    CodUint32 chunkId;
    CodUint32 next;
    CosVmPtr  fixBuffer; // offset + ssn + indexId 上限24k * index count行
    CosVmPtr  keyBuffer[PENDING_DELETE_KEY_BUFFER_SLICE]; // key
} SpfPendingDeleteNode;

typedef struct StSpfPendingDeleteNodeList {
    CodUint32             itemCount;
    SpfPendingDeleteNode* NodeList[0];
} SpfPendingDeleteNodeList;

typedef struct StSpfPendingDeletes {
    CodMemAllocator*         allocator;
    CodQuotator*             quotator;
    CodUint32                bucketNum;
    CodUint32                listCount;
    CodUint32*               bucketHead; // 桶起点
    SpfPendingDeleteNodeList nodeLists[0];
} SpfPendingDeletes;
```

1个chunk node占用20字节 记录24K行数据删除信息   每个slice8M行 341个chunk 占用内存6KB

假设每行数据500字节 约合4G数据占用内存6KB 单节点导入10TB数据占用大约15M 

  


**接口：**

```
CodResult spfPendingDeleteCreate(CodMemAllocator* allocator, CodQuotator* quotator, CodUint32 bucketNum, SpfPendingDeletes* pendingDeletes);
CodResult spfPendingDeleteAppend(SpfPendingDeletes* pendingDeletes, RowId rowId, CodUint32 ssn, CodUint16 indexSlot);
CodVoid   spfPendingDeleteRead(SpfPendingDeletes* pendingDeletes, CodUint32 sliceId, CodUint32 chunkId, CodUint32 ssn, CodBytes* data);
CodVoid   spfPendingDeleteDestroy(SpfPendingDeletes* pendingDeletes);
```

  


读流程：hash找对应item->若在交换文件内需要进行换入

写流程：hash找对应item->delete信息尝试写入(→序列化)

  


这部分在另外一个去重SR有详细介绍

## 4.3 rgd支持本事务读可见

4.3.1 rgd模块调整

目前的spf模块关系如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ecb8970c2af4f521b82/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

可以看到 rgd作为spf的子结构 实际内部又依赖索引操作 并且元数据是由coral管理的 显得十分不合适 实际上 rgd作为冷数据缓存 完全可以归纳到coral（scol）内

  


调整框架如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ecba1ad9a3311dc99f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

其中的scol中的metadata和slice为现在coral这一模块 为减少移动 目前这部分接口和定位先不变

在coral的外层包一个scol的概念 新增rgd相关处理逻辑

![](https://pingcode.yasdb.com/atlas/files/public/67396ecba1ad9a3311dc99f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

1，rgd作为scol的缓存部分 元数据由swd管理 数据结构依赖rgdBuffer和pendingDelete 对外提供扫描和追加写的接口

2，rgd只记录一个分区下的数据 pendingDelete也作相应适配

3，在scol层提供更新和删除接口 内部去调用现coral和rgd提供的删除或写接口

4，spf层将索引操作作为回调传递给scol scol内部根据回调实现对索引的操作

  


由于目前coral中的元数据处理埋的过深 决定将rgd相关逻辑放到coral中 coral变成实际上的scol

  


4.3.2 flush设计

  [统一导入刷盘实现讨论](https://conf.yasdb.com/pages/viewpage.action?pageId=150616108)  

可做到slice写满刷盘 刷盘时按照当前数据中最大ssn更新swd中元数据信息

  


4.3.3 rgd支持扫描

1，rgd数据可见性

在rgdBuffer中增加ssn辅助列 刷盘前根据ssn和cursor ssn判断行可见性 如果已经刷盘 则可根据swd meta中的ssn判断整个slice的可见性

例如

ssn为3的插入语句到来 发现当前rgd_buffer的行数已经达到scol_slice_rows 立即触发刷盘 此刻rgd_buffer中的ssn最大为2 则生成完后用2去更新swd的元数据 后续再次扫描ssn肯定大于等于3 保证可以扫到swd中整个已生成的slice的数据

  


2，合并pendingDelete中的删除行 也要根据ssn判断哪些删除发生在语句前

  


3，索引扫描 由于rgd采取提交后再锁行删除索引 因此索引中的内容可能已经删除 此时要结合pendingDelete才能确认行到底存不存在

**startIndexScan 时根据dc的tableId检查下handler有没有此表的缓存数据 有则往cursor上加个回调 索引扫描根据回调判断行的可见**

  


数据结构：

```
typedef struct StRgdScanCtx {
    AnkHandler* handler;
    DataSet*    ds;
    CodUint32   ssn;    // 扫描事务号
    CodUInt32   offset; // 已扫到位置
    CodBool     rowFetch;
} RgdScanCtx;
```

  


接口：

```
CodResult coralInitRgdScanCtx(AnkCursor* cursor, SpfDict* dict, SpfExecuteCtx* ctx, CodBool rowFetch);
CodVoid   rgdReleaseScanCtx(RgdScanCtx* scanCtx);
CodResult rgdMultiFetch(AnkCursor* cursor, SpfDict* dict);
CodResult rgdFetch(AnkCursor* tabCursor, RgdScanCtx* scanCtx, CodBool* isEof);
CodResult rgdFetchByRowId(RgdScanCtx* scanCtx, SliceRowId rowId, DataSet* ds, CodBool* isFound);
```

  


流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396ecba1ad9a3311dc99f6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

  


4.3.4 并行扫描

结合模块调整 rgd的元数据也由swd管理 sliceid和并行度中range拆分可以统一 具体扫描时再区分数据在rgd还是coast内

实现同个会话 handler共用rgd上下文

使用接口：  **ankInitParalHandler**

**并行handler使用主handler上的上下文进行初始化 对rgd相关的进行引用**

## 4.4 rgd支持删除更新

根据    [LSC导入性能优化概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147764387)     dml和cdc导入删除更新可统一

接口：

```
CodResult spfSColDeleteRow(AnkCursor* cursor);
CodResult spfSColUpdateRow(AnkCursor* cursor);
```

  


4.4.1 带主键索引的删除更新

插入流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396ecb8970c2af4f521b83/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

其中deDup为主键去重的hint 可指定insert直接去重 不使用insert on dup key减少流程

  


删除流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396ecc8970c2af4f521b84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

当删除行落在rgd内时 只需要记录pendingDelete信息 此时删除是带有所有索引列信息的 可以记下 后续真正删除可不回表

最后提交时会设置scol内的deleteBitMap和删除索引信息 达到删除目的

  


更新流程：

删除旧行 + 插入新行（deDup模式）

更新的行在rgd内时 需要先设置更新行的delete信息 接着用新行进行deDup的插入更新主键的信息并插入数据 由于此时必定冲突且是replace操作

  


4.4.2 无索引的删除更新

无索引的插入和更新不需要关注冲突 按目前流程对rgd进行数据插入即可 pendDelete内的记录都是删除操作 提交时只需要按此去设置chunk的deleteBitMap

  


4.4.3 多索引的删除更新

和单索引的操作类似 只是插入时尝试去插入所有的索引 并在冲突时按索引id记录pendingDelete的replace信息

## 4.5 coast扫描、删除和更新

扫描即需要在coralDbmLoadChunk时按照ssn合并pendingDelete 

scol的dml跟rgd的dml只有一处不同 就是dml执行前需要加上slice的共享锁 防止操作期间slice被合并（由于rgd内未提交 不对后台任务可见 因此可不加锁）

其它的操作例如update变为delete + insert等和rgd一样 记录的pendingDelete信息也按delete和replace进行区分

4.5.1 coralLock

当进行coralDelete时 如果关闭了MCOL 则不对chunk加锁 但是依然要加slice的共享锁去判断版本 方式扫描时满足条件的slice去真正删除时被合并

  


4.5.2 sColUpdate

insertVgd回调 之前的coral更新被拆解为deleteCoralRow + insertVgd动作

当关闭MCOL后 更新的流程调整如下

![](https://pingcode.yasdb.com/atlas/files/public/67396ecc8970c2af4f521b85/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

## 4.6 rgd多表

说明：flink cdc导入时可以单事务导入多表

方案2：

spfInsertCtx使用链表管理 不设置上限

  


结构体

![](https://pingcode.yasdb.com/atlas/files/public/67396ecc8970c2af4f521b86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUlBQUFBQW9nQUFBQUFBQUFBQUJBUUFBUUFDQUNBQUFBSUFnQUFBQ1FBQUFBQWdRSUFBQUFBQUFBQUFBQUtBQUFBQUFBQVFBQUFBQUJRQUFBQUFBRUFpQUlBQUFBQWdnZ0FBQUFBQkFBQUFBQUFBQUtBQUFLQUFBQWdBQ0FBQUFDQUFBQUNBQVFBQUNBQUFBQUFBQUFBRUFnQUFDQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg5NzMsImV4cCI6MTc4MjQ0OTc3M30.kACvZ2fL4VcJ670q0uG2AdbMnHTjGCjQLQAhXWzVWfU)

将内存数据上下文进行抽象 生命周期和会话一致 

## 4.7 事务回滚

1，回滚粒度

主handler上使用创建rgd和插入rgd标识 判断当前语句回滚还是整个事务回滚

  [BULKLOAD插入的事务处理](https://conf.yasdb.com/pages/viewpage.action?pageId=147768954)  

*2，冲突回滚*

*当开启行迁移 发生行冲突时 后面一个事务回滚*

*不开启行迁移 只支持delete操作 则可忽略*

## 4.8 主备同步

文件同步 rgd生成文件时 就可同步备机

事务同步 事务提交成功后 数据才对备机可见

  


*限制：*

*1，关闭MCOL后 同张表dml和bulk load互斥*

  


# 5. Testcases（自测用例）

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


1.语法自测 正常、异常以及关闭MCOL后立刻将存量MCOL转冷能力

2.rgd扫描 常规扫描+并行扫描

3.dml 多表 + insert on dup ky + 带索引并发

4.事务 匿名块 + sql回滚

5.主备同步

6.流式导入功能验证

7.单机的interval分区

# 6. 资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

1，语法说明

2，视图新增字段介绍

3，功能限制 例如提交时出现行迁移 无主键直接报错全事务回滚

  


2024年5月10日

与会人：谢锐，黄文早，易文亮，任艳芬，万谦

评审纪要：

明确对外影响：

1，语法+配置项

2，同表一个事务内 bulkload和普通dml操作互斥 不同表不影响

3，dml的能力有所改变

（1）普通插入变成replace insert + verify pendingDelete + 返回错误或成功

（2）之前dml冲突时会等待 现在最后锁行 有冲突情况下 后一个事务会失败

（3）单行冲突死锁问题

会话1 删除行

会话2 replace行 加btree锁

会话1 提交时加chunk锁 尝试加btree锁

会话2 提交加chunk锁 发现死锁

  


预计转测时间   2024/6/10

预计工作量                                       1人月

（1）框架调整                                 1人周

（2）语法+多表框架+扫描支持      1人周

（3）dml支持                                  1人周

（4）整体流程+自测                       1人周

# 7. 未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-5-6_9-37-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2JhMWFkOWEzMzExZGM5OWYwIiwicmVmX2lkIjoiNjczOTZlY2I3MjgyMDZlZmI5MmYyY2U2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4OTczLCJleHAiOjE3ODI1MjUzNzN9.uAAotIaMINCB1ac5ww5welfTmayewjWBB1leKM6JFXQ)

 (image/png)    
