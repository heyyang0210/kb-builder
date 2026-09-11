Created by 陈晓晴, last modified on 十二月 01, 2023

SR链接：    [[YDBRD-21588] 支持insert /*+bulkload */支持去重或报错 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21588)  

##   [1. 总述](#1-总述)  

目前LSC表导入去重只能通过插入热数据并使用insert on duplicate key语句处理，该方法存在执行流程长，对冷数据定位慢且无法批量化处理等问题。本文档描述在LSC表已支持使用bulkload增量导入冷数据的基础上如何进行去重处理，提升导入去重的性能。

且对于当前使用bulkload进行导入的场景，大部分无法进行容错处理，且有的情况会回滚整个事务，增加了用户使用成本（需识别事务是否回滚），在本次开发中也需要通过一定方式支持部分容错的能力。

###   [1.1 需求来源](#11-需求来源)  

（1）使用DATAX等工具进行增量导入的场景，需要同时能够支持类似replace into的功能，在有唯一键冲突的场景下去掉旧的冲突数据，插入新的数据。

（2）bulkload导入功能是否将唯一键冲突进行报错或者去重处理需要用户来决定。这就要求bulkload导入不仅能够支持去重的语义，同时可以通过开关（或某种标记，例如hint）关闭去重功能，将唯一约束冲突报错给客户。

（3）导数的过程，有可能产生一些数据类型等校验的错误，这种错误往往是需要能够进行容错处理的。bulkload导入也需要能够支持部分容错，对于语法、权限、数据类型以及约束不满足等错误，进行容错处理，不会回滚整个事务。若回滚了整个事务，也需要通过一定手段告知用户。

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|兼容性|----|----|是|是|
|周边配合|DATAX工具|----|----|是|
|周边配合|导入导出工具|----|----|是|


###   [1.4 数据字典](#14-数据字典)  

##   [2. 接口](#2-接口)  

###   [insert语法](#insert语法)  

新增hint提示项：deduplicate，与bulkload提示项同时使用时生效；只有deduplicate提示项时将报错。

insert / * +bulkload deduplicate * / into

###   [load 语法](#load-语法)  

新增option_clause：DEDUP，在ENABLE_BULK=true时使用生效，ENABLE_BULK=FALSE时将报错。

##   [3. 规格与约束](#3-规格与约束)  

1. bulkload支持部分容错功能，不能容错的场景将通过报错信息提示用户，整个事务已被回滚，并返回错误，yasldr、datax工具都会将事务回滚的错误信息以及详细原因抛出并停止。
1. yasldr新增option，option = true表示在bulkload导入模式下，对唯一键冲突进行去重处理；insert语句新增hint提示项deduplicate，表示bulkload插入对唯一键冲突进行去重处理。
1. bulkload方式插入数据支持对有唯一键的表在发生唯一键冲突的情况下进行去重处理。
1. 通过升级流程，原LSC表的唯一索引将不可用，需在升级完成后rebuild index才可用。


##   [4. 特性](#4-特性)  

##   [4.1 bulkload错误处理](#41-bulkload错误处理)  

####   [容错处理：](#容错处理)  

1. 错误标识设置：在spfRgdInsert层，若返回错误则进行错误处理——除了违反唯一约束的失败，其他失败都需要再设一层表示bulkload回滚整体事务的错误ERR_SPF_BULKLOAD_FAAILED。
1. 在执行层收到失败，回滚前进行错误码校验，收到事务回滚的错误码则进行整体事务回滚。batch error机制下，一个batch内收到一条ERR_SPF_BULKLOAD_FAAILED错误则直接返回ERROR。对于yasldr的容错机制，返回ERR_SPF_BULKLOAD_FAAILED后将cursorAttr->maxFecthRows设置成无效值，yasldr就会向用户抛出错误。


####   [去重/报错选择](#去重报错选择)  

bulkload对唯一约束的错误处理是选择报错或者去重的开关在sql语法层面设置为hint，yasldr则需新增option，若option设置为true则进行去重，将标记带到cursorAttr上；DATAX则通过语句改写，带hint情况下为去重处理，也将标记带到cursor->attr上。cursorAttr将AnkInsertAction枚举改成CodUint8 AnkInsertAction，通过以下标记表示插入相关的功能：

```
# define INSERT_BULKLOAD ((CodUint8)0x01u)   //LSC表插入冷数据
# define INSERT_DEDUPLICATE ((CodUint8)0x02u)  // 插入自动进行去重处理

```

##   [4.2 主键支持回表](#42-主键支持回表)  

Lsc表记录在索引中的rowId是经过了映射处理的逻辑rowId，系统表SIM$记录了逻辑的SliceId与物理sliceId的映射关系，要实现根据rowId回表的功能，一个方案是Btree直接记录物理rowId，另一个方案是根据现在的逻辑rowId回表。

主键支持回表的情况下，无需在去重的阶段在slice内进行查找，去重的效率更高。

##   [方案一: 记录物理rowId](#方案一-记录物理rowid)  

###   [1.1 lsc表修改逻辑rowId为物理rowId：](#11-lsc表修改逻辑rowid为物理rowid)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c5ea1ad9a3311dc89e8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUNBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQ0FBQUFBUUFBQUFFQUFBQUFBQUFBQUFDQUFBQUFBQ0FBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA0NjcsImV4cCI6MTc4MjMxMTI2N30.STnui7KRTmxd3hqF4YwB1ue_9Zde9TTI6iNwkK8hBQ0)

####   [物理rowId格式特点：](#物理rowid格式特点)  

1. 可以保证LSC表某一行的唯一性。
1. 可能发生多次修改，例如热转冷时需要更新，slice合并时也需要更新。
1. 可以直接使用该rowId进行回表操作。


###   [1.2 btree修改lsc表的rowId记录](#12-btree修改lsc表的rowid记录)  

LSC表目前在btree key上复用了recordOid标记的列用于记录sliceLogicId，即在Btree内目前只存了6字节slice内偏移及8字节的全局唯一的sliceLogicId。现在需要记录最多8字节dataoid以及8字节的slicerowId。

因此，recordOid字段需要新增标记以记录扩展的rowId，方案如下：

```
#define BTREE_RECORD_DATAOID ((CodUin8)0x01u)
#define BTREE_RECORD_LSC_ROWID ((CodUint8)0x04u)

```

recordOid字段有标记BTREE_RECORD_DATAOID + BTREE_RECORD_LSC_ROWID 时，表示btree的recordOid这一列记录对对大小是10字节，BTREE_RECORD_DATAOID 表示记录了dataoid，BTREE_RECORD_LSC_ROWID 表示记录了batchId，在Btree key中的格式如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c5e8970c2af4f520b7b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUNBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQ0FBQUFBUUFBQUFFQUFBQUFBQUFBQUFDQUFBQUFBQ0FBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA0NjcsImV4cCI6MTc4MjMxMTI2N30.STnui7KRTmxd3hqF4YwB1ue_9Zde9TTI6iNwkK8hBQ0)

**兼容性设计**

由于现有的lsc表存储在btree内的都是逻辑rowId，新版本中使用物理rowId，旧的lsc表索引即不兼容。兼容性方案目前有两个：

####   [方案一：](#方案一)  

在升级脚本里，对有主键或唯一键的LSC表执行alter index unusable。新库中LSC表只会有物理rowId相关的代码，用户自行对索引进行重建操作或在升级脚本里直接重建索引（已使用的现场数据量不大的情况）。

####   [方案二：](#方案二)  

保留现有的LSC表逻辑rowId的代码，通过新增IND$上的flag标记标识新旧结构的LSC表索引，走两套不同的代码逻辑。

使用方案二有如下需要注意的点：

（1） insert into on duplicate key功能，新老版本都可用，走的代码逻辑不同。

（2） 本次方案设计的bulkload去重功能（Deduplicate），新版本可用，旧版本不可用。

（3） 老版本不支持唯一键插入全null的key值

###   [1.3 流程](#13-流程)  

往索引里插入物理rowId，首先需要修改现在slice的元数据生成逻辑。

需要在插入冷数据前，先预占swd的slice槽位，得到物理sliceId。冷数据写入结束后，再取当前   **最新scn**   更新swd内sliceMeta的信息。

SliceMeta将新增标记isVisible，插入时不可见，更新时将该标记标记为true，表示可见。

该方案会使得slice生成过程新增undo开销（问题单：    [https://jira.yasdb.com/browse/YDBRD-12004](https://jira.yasdb.com/browse/YDBRD-12004)     ，根本原因应该是使用了插入的scn进行更新）。

####   [rgd插入物理rowId流程：](#rgd插入物理rowid流程)  

rgd导入开始时先预占swd的slice槽位，然后组装物理rowId，先往btree插入，再插入rgd。

####   [vgd插入物理rowId流程](#vgd插入物理rowid流程)  

将vgd插入流程中的申请逻辑sliceId的流程去除，组装dataSet的rowId时直接使用vgd对应的物理sliceId。

####   [xrmf插入物理rowId流程](#xrmf插入物理rowid流程)  

转换过程中，扫描vgd数据的dataset需要带上rowId列；在插入coast时候，先根据dataet上的rowId在btree里进行删除；做完coast插入后，就组装好了dataset上对应的物理rowId，再插入btree。

####   [compact插入物理rowId流程](#compact插入物理rowid流程)  

同xrmf的更新rowId流程一致。

##   [方案二: 根据现有的逻辑rowId回表](#方案二-根据现有的逻辑rowid回表)  

现有的逻辑rowId要进行回表操作需要先转换成物理rowId，意味着每次回表都需要扫一次系统表。在发生compact后，还会再产生扫表确认SliceRowId的offset的开销。

讨论采取方案一。

##   [4.3 bulkload去重实现](#43-bulkload去重实现)  

去重的整体流程为：

**1.**   获取一个rgd进行插入时，先组装rowId，再插入Btree，然后进行去重处理，最后插入rgd dataset中。

**2.**   插入btree时若产生冲突，获取conflict rowId，进行spfDirectDelete删除表数据和btree里的数据，然后将对应的新的记录插入btree。

**4.**   最后将整个dataset的数据深拷贝到rgd中。

- 修改spfRgdWriteDatasetIter流程


![](https://pingcode.yasdb.com/atlas/files/public/67396c5ea1ad9a3311dc89ea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBRUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUNBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQ0FBQUFBUUFBQUFFQUFBQUFBQUFBQUFDQUFBQUFBQ0FBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA0NjcsImV4cCI6MTc4MjMxMTI2N30.STnui7KRTmxd3hqF4YwB1ue_9Zde9TTI6iNwkK8hBQ0)

- 修改写入Btree时的处理：


          1. 按行处理dataset中的数据插入到btree；

          2. 当某行插入到btree后报错唯一约束冲突时，在去重的场景下，获取当前的conflict rowId，调用spfDirecDelete删除冲突的行和key，然后重新将改行数据执行一次插入btree。

          3. 当非dataset首行插入到btree后报错唯一约束冲突时，在报错的场景下，直接返回，前面成功插入btree的数据会执行当前语句回滚。

  


- 新增spfDirecDelete接口


          对于vgd，需要删除表里数据；对于slice文件，不需要回表，直接标记删除delete bitmap。         

          问题：处理冲突过程中，slice rowId对应的swd槽位可能被复用（compact操作导致的变动），由于该接口冷数据的删除不进行回表操作，无法发现rowId对应的数据可能已经发生改变。

          处理方式： 发现冲突后，释放Btree页面锁前，取一下当前scn，与SliceMeta→Scn进行比较，若 currScn<=sliceMeta->scn，说明槽位已经被复用。然后需要重新对该key进行插入，获取新的conflict rowId，重新进行冲突处理。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 可容错的场景（校验层不通过，数据转换不通过，违反唯一约束等），增量导入报错，且不回滚整个事务。（datax、yasldr、yasql）
1. 不能容错的场景，增量导入报错，提示事务回滚。（datax、yasldr、yasql）
1. 带唯一约束的LSC表，dml、转换、合并功能正常执行且符合预期。
1. 去重的场景，增量导入能够自动去重，且将新数据覆盖老数据。
1. 升级后索引不可用，rebuild后可正常使用索引。


##   [6.资料设计章节](#6资料设计章节)  

概要设计：    [https://conf.yasdb.com/pages/viewpage.action?pageId=130144947](https://conf.yasdb.com/pages/viewpage.action?pageId=130144947)  

错误处理：    [https://conf.yasdb.com/pages/viewpage.action?pageId=135604701](https://conf.yasdb.com/pages/viewpage.action?pageId=135604701)  

LSC唯一键设计：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107384763](https://conf.yasdb.com/pages/viewpage.action?pageId=107384763)  

##   [7.未来规划](#7未来规划)  

唯一键发生冲突，需要进行报错处理的场景，可以进行优化，不直接返回错误，而是执行完一整批数据后再返回错误。需要跟工具对齐，列存对这种场景优化了容错处理。

  


  


## Attachments:

## Comments:

|  [](null)  ,2023/11/23讨论纪要：,1. 使用物理rowId待确定：（1）btree是否有方案可扩展物理rowId8字节，加上dataoid共16字节。（2）swd预占槽位，确认之前问题单的根因，是否不会再出现snapshot too old 问题
1. 物理rowId方案若不可用，使用逻辑rowId方案，是否一定成本更高？
1. 找工具组确认bulkload错误方案。使用hint进行去重，以及使用多层错误码表示。
,Posted by chenxiaoqing at 十一月 29, 2023 17:29|
|---|
|  [](null)  ,2023/11/28 讨论纪要,1. Deduplicate：调研其他数据库去重方式的命名。
1. 兼容性处理的两个方案，正式评审时决策：方案一，保持兼容，保存逻辑rowId的代码，新代码需要新增btree 的持久化flag取标识；方案二，直接在升级流程将lsc表老的索引进行alter index unusable，只能创建新的存储格式的lsc索引。推荐方案二。
1. rgd需要校验插入时dataset中事先生成的rowId是否与最终持久化的rowId一致，需要想方案。
1. 新增未来优化点：在唯一键冲突的情况，优化成一批数据执行完，再将错误返回。
1. swd槽位复用问题，插入btree时使用的scn即可行。
1. LSC的Delete BitMap需要新增拓展的接口，在slice行数还未确定时，可以生成、拓展dbm。
1. xfmr转换流程插入物理rowId，在插入slice文件时去做，相当于插入coast时，对btree的处理是更新。
1. 去重/错误选择，cursor上新增枚举？
,Posted by chenxiaoqing at 十一月 29, 2023 17:29|
|  [](null)  ,2023/11/29 评审纪要：,兼容性方案拉版本SE与产品经理对齐。,方案二的注意点：,insert on duplicate key，新版本会走物理rowId接口，老版本继续走逻辑rowId接口，都可用；,bulkload去重功能，即Deduplicate功能，新版本可用，老版本不可用。,Posted by chenxiaoqing at 十一月 30, 2023 15:48|
|  [](null)  ,2023-12-4 讨论纪要：,参与人：何金阳，熊沪，罗文芳，谢锐,索引rowid兼容方案选择方案1，卫健委场景升级由升级工具搞定，或只有该场景需要，则单独制定升级方案来升级。,datax工具部署在用户侧，卫健委场景或无法使用bulkload，升级方案需 考虑相关风险,Posted by xierui at 十二月 04, 2023 15:55|
