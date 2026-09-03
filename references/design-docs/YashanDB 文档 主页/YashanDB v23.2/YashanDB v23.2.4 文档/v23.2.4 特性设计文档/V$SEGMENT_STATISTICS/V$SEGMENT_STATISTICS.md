Created by 曾昭瀚, last modified on 七月 18, 2024

#   [SEGMENT_STATISTICS视图](#segment-statistics视图)  

v$segment_statistics：  *SR链接：**    [YDBRD-26540](https://pingcode.yasdb.com/pjm/items/6625bf44fd997db58ade3b92)    *

dv$segment_statistics和gv$segment_statistics：  *SR链接：**    [YDBRD-26545](https://pingcode.yasdb.com/pjm/items/6625c400fd997db58ade5133)    *

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

v$segment_statistics主要展示segment级别的统计信息，例如某张普通heap表的物理读次数和读取的bytes数、某个普通btree索引的buffer等待次数等。segment级别的统计信息能方便用户定位是哪个对象出现性能问题。

新数科技监控系统适配，需要支持v$segment_statistics、dv$segment_statistics和gv$segment_statistics，部署形态包括主备、分布式和集群。

###   [1.2 调研文档](#12-调研文档)  

  [支持segment级别统计信息调研文档 - 王博文 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153023732)  

  [V$SEGMENT_STATISTICS (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/refrn/V-SEGMENT_STATISTICS.html#GUID-C78D4DE2-F2EE-4E97-911E-7D0E741F8100)  

  [V$SEGSTAT_NAME (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SEGSTAT_NAME.html#GUID-3381E4A9-D83C-48F7-9084-D7360839CE98)  

```
-- Oracle 19c下的统计项
SQL&gt; select STATISTIC#, name, sampled from V$SEGSTAT_NAME;

STATISTIC# NAME                                               SAMPLE
---------- -------------------------------------------------- ------
         0 logical reads                                      YES
         1 buffer busy waits                                  NO
         2 gc buffer busy                                     NO
         3 db block changes                                   YES
         4 physical reads                                     NO
         5 physical writes                                    NO
         6 physical read requests                             NO
         7 physical write requests                            NO
         8 physical reads direct                              NO
         9 physical writes direct                             NO
        11 optimized physical reads                           NO
        12 optimized physical writes                          NO
        13 gc cr blocks received                              NO
        14 gc current blocks received                         NO
        15 ITL waits                                          NO
        16 row lock waits                                     NO
        18 IM non local db block changes                      NO
        19 space used                                         NO
        20 space allocated                                    NO
        22 segment scans                                      NO
        23 IM scans                                           NO
        24 IM populate CUs                                    NO
        25 IM prepopulate CUs                                 NO
        26 IM repopulate CUs                                  NO
        27 IM repopulate (trickle) CUs                        NO
        28 gc remote grants                                   NO
        29 IM db block changes                                YES

已选择 27 行。

1. IM开头表示in memory，不支持
2. gc开头表示global cache，是集群下的概念
3. physical writes暂不支持，dbwr还没法分辨block是哪个segment的。单位为块数
4. 表空间相关的暂不支持
5. segment scans，这次暂不支持
6. optimized的不支持，被合并后的物理操作次数，单位为次数
7. request的不支持，request次数会被优化，单位为次数
8. 暂时不支持采样

```

###   [1.3 需求分析](#13-需求分析)  

**CHECKLIST**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|收集项统计|确定要收集的对象和收集项|是|是|
|功能|收集项持久化|数据存放在全局临时表，dc失效和淘汰的时候持久化|是|是|
|功能|统计项收集方法|统计项收集方式|是|是|
|功能|动态视图实现|fix table定义、动态视图实现|是|是|
|功能|列存对象收集|列存对象收集方式|是|是|
|备机|备机查询视图|备机查询结果不准|否|是|
|故障|\|\|否|否|
|周边配合|权限|\|否|是|
|周边配合|审计|\|否|否|
|周边配合|导入导出工具|\|否|否|


##   [2. 接口](#2-接口)  

```
desc v$segment_statistics
 名称                                      是否为空? 类型
 ----------------------------------------- -------- ----------------------------
 OWNER                                              VARCHAR2(64)
 OBJECT_NAME                                        VARCHAR2(64)
 SUBOBJECT_NAME                                     VARCHAR2(64)
 TABLESPACE_NAME                                    VARCHAR2(64)
 TS#                                                SMALLINT
 OBJ#                                               BIGINT
 DATAOBJ#                                           BIGINT
 OBJECT_TYPE                                        VARCHAR2(18)
 STATISTIC_NAME                                     VARCHAR2(64)
 STATISTIC#                                         TINYINT
 VALUE                                              BIGINT

gv$segment_statistics多了一个inst_id，表示实例id
dv$segment_statistics多了group_id表示组id、group_node_id表示组内节点id

desc v$segstat_name
 名称                                      是否为空? 类型
 ----------------------------------------- -------- ----------------------------
 STATISTIC#                                         TINYINT
 NAME                                               VARCHAR2(64)
 SAMPLED                                            VARCHAR2(3)



```

##   [3. 规格与约束](#3-规格与约束)  

当STATISTICS_LEVEL为TYPICAL、ALL时会统计段统计信息，当为BASIC时不会收集。

现阶段统计较为粗略，例如不区分undo的操作和对象的操作，但能大致反映性能数据。为了性能考虑不宜频繁统计。

备机统计数据不准。删除的object不显示统计信息。

##   [4. 特性](#4-特性)  

###   [4.1 收集对象和统计项](#41-收集对象和统计项)  

收集对象包括：表、索引以及他们的分区/子分区。只收集有segment的对象。

lob暂时不收集。AC支持？

segment级的统计项包括：

|ID|收集项|含义|收集方式|
|---|---|---|---|
|0|logical reads|逻辑读块次数，从buffer读取一个块的次数，单位为块数|全量|
|1|physical reads|物理读块次数，调用操作系统接口read一个块的次数，单位为块数|全量|
|2|physical read requests|物理读请求次数，单位为次数|全量|
|3|consistent changes|相当于db block changes。构建cr过程中回滚的事务数，单位为次数|全量|
|4|buffer busy waits|等待buffer的次数，包括等pin、buffer bucket latch，单位为次数|全量|
|5|xslot waits|相当于ITL waits。数据块xslot不足造成的等待次数，单位为次数|全量|
|6|row lock waits|行被其他事务锁住造成的等待次数，单位为次数|全量|
|7|gc cr blocks received|集群下cr blocks接收块数，单位为块数|全量|
|8|gc current blocks received|集群下current blocks接收块数，单位为块数|全量|
|9|gc remote grants|集群下远程授权读取磁盘次数，单位为次数|全量|
|10|gc buffer busy|集群下buffer busy wait的次数，单位为次数|全量|
|11|segment scans|segment扫描的次数，单位为次数|全量|
|12|space allocated|segment的大小，单位为bytes|全量|


统计项可以通过v$segstat_name查到，v$segstat_name的结构如下：

|列名|类型|含义|
|---|---|---|
|STATISTIC#|INTEGER|统计项ID|
|NAME|VARCHAR2(64)|统计项名称|
|SAMPLED|VARCHAR2(3)|YES/NO|


###   [4.2 数据结构与持久化](#42-数据结构与持久化)  

####   [4.2.1 数据结构](#421-数据结构)  

segment统计信息在内存中表示为：

```
typedef struct StSegStats {
    CodUint64 logicReads;
    CodUint64 physicalReads;
    CodUint64 consistentChanges;
    CodUint64 bufBusyWaits;
    CodUint64 xslotWaits;
    CodUint64 rowLockWaits;
    ...
} SegStats;

```

segment级别的统计信息与具体某个对象相关，对象包括表、索引以及各自对应的子/分区。

SegStats附着在TableDict、IndexDict、TabPartDict、IndPartDict上。

在HeapDict、SwfDict、SpfDict、Btree、Rtree增加一个SegStats指针指向dc上对象的SegStats。如果指针为空，说明不需要统计。

例如列存的变长列HeapDict的segStats指针设置为空，不独立统计。

####   [4.2.2 持久化](#422-持久化)  

由于segment级别的统计信息是附着在dc上的，所以会面临失效和淘汰，如果dc被重新加载，此时segment统计信息都被清零，丢失了以前的数据。

例如某张表xslot waits为100次，修改该表某一列类型alter table modify column后dc失效，重新select该表，此时该表的itl waits应当仍为100（修改列类型只会查不会改对象数据，所以不会增加对象的wait次数）。

所以我们在dc失效或者淘汰前将segment统计信息刷到系统表上，在加载dc的时候将统计信息加载上来，在删除表或者分区时将统计信息删除，插入、更新、读取、删除持久化的segment统计信息时机如下：

|系统表操作|时机|
|---|---|
|写入/更新|dc失效（dcInvalid）或者淘汰未失效的dc（dcRecycle）|
|读取|加载dc|
|删除|删除对象|


考虑到数据是临时数据，数据库重启后不应该保留数据，并且在集群模式下每个实例应该创建独立的系统表，故系统表定义为全局临时表，系统表定义如下：

```
CREATE GLOBAL TEMPORARY TABLE SEG_STATS$
(
    OBJ#             BINARY_BIGINT    NOT NULL,
    TS#              BINARY_BIGINT    NOT NULL,
    STATISTICS#      BINARY_TINYINT   NOT NULL,
    VALUE            BINARY_BIGINT    NOT NULL,
) ON COMMIT PRESERVE ROWS SYSTEM 88 ORGANIZATION HEAP
/
CREATE INDEX I_SEG_STATS1 ON SEG_STATS$(OBJ#)
/

```

全局临时表需要一个统一的handler来增删改查，在保留的后台handler增加一个HANDLER_SEG_STATS：

```
typedef enum EnKernelHandlerId {
    HANDLER_BOOT = 0,
    HANDLER_LOGW = 1,
    HANDLER_CKPT = 2,
    ...
    HANDLER_GTS = 13,
    HANDLER_SEG_STATS = 14,
} KernelHandlerId;

```

每次要刷统计信息的时候，要push cursor的idxHandler和segHandler，push前需要统一加锁：

```
AnkHandler* statsHandler = handler-&gt;kernel-&gt;handlers[HANDLER_SEG_STATS];

// push Btree和HeapDict，在此之前需要加锁，锁在statsHandler上
Latch(statsHandler-&gt;segStatsLatch);
CodPointer idxHandler, segHandler;
ankPush(statsHandler, sizeof(Btree), (CodPointer*)&amp;cursor-&gt;attr.indexScanAttr.idxHandler);
ankPush(statsHandler, sizeof(HeapDict), (CodPointer*)&amp;cursor-&gt;segHandler));
ankStartCursor();
...
UnLatch(statsHandler-&gt;segStatsLatch);

```

###   [4.3 收集方式](#43-收集方式)  

收集对象的统计信息依赖handler也就是session的统计信息。基本想法是当涉及到对象的基本操作时，将session的统计信息差值统计到改对象的统计信息上。

例如表的插入heapInsert，通过在heapInsert前后得到handler的统计信息快照，相减即得到该表的统计信息变化值，然后将变化值累加进表的统计信息里。

在AnkHandler的AnkStats上增加一个结构体SegStats，以统计session的segment统计信息。在对象基本操作函数开头记录handler上SegStats的初始快照，在结束的时候计算与初始快照的插值然后累加进dc上的SegStats。

heapInsert统计流程如下：

```
CodResult tabInsert(AnkCursor* cursor)
{
    AnkHandler* handler = cursor-&gt;attr.handler;
    SegStats before = handler-&gt;stats.segStats;  // 保留快照
    {...}  // insert
    TableDict* dc = cursor-&gt;attr.dc;
    if (cursor-&gt;attr.partNum != COD_INVALID_ID64) {  // 增加插值
        // 处理分区/子分区
        TabPartDict* part = ptGetPart(cursor-&gt;attr.partNum);
        part-&gt;segStats.logicReads += handler-&gt;stats.segStats.logicReads - before.logicReads;
        ...
        return COD_SUCCESS;
    }
    // 处理表
    dc-&gt;segStats.logicReads += handler-&gt;stats.segStats.logicReads - before.logicReads;
    ...
    return COD_SUCCESS;
}

```

####   [4.3.1 对象记录统计信息时机](#431-对象记录统计信息时机)  

table、table partition和table subpartition：

|table segment类型|fetch|insert|delete|update|lock|
|---|---|---|---|---|---|
|heap|heapFetch、heapMultiFetch、heapRowIdFetch|tabInsert、doTabBatchInsert、doTabFullBlockInsert|heapDelete|heapUpdate|heapLock|
|tac|swfFetch、swfMultiFetch、swfFetchByRowId、swfScanByRowId、swfFetchByRowIdSet|swfTabMultiInsert|swfDelete|swfUpdate|swfLock|
|lsc|spfMultiFetch、spfFetch、spfReadByRowId|spfTabMultiInsert|spfTabDelete|spfTabUpdate|spfLock|


index、index partition和index subpartition：

|index segment类型|fetch|insert|update|delete|
|---|---|---|---|---|
|btree|btreeFetch、btreeBatchFetch|idxListInsert|idxListUpdate|idxListDelete|
|rtree|rtreeFetch|idxListInsert|idxListUpdate|idxListDelete|
|col index|colIndexMultiFetch、colIndexFetch|idxListInsert|idxListUpdate|idxListDelete|


####   [4.3.2 logic reads统计](#432-logic-reads统计)  

统一在blockStackPush里，使用handler->stat.bpStat->bufferGets：

####   [4.3.3 physical reads统计](#433-physical-reads统计)  

统计在loadDiskBlock里，使用handler->stat.ioStat->diskReads：

####   [4.3.4 ITL waits/row lock waits统计](#434-itl-waitsrow-lock-waits统计)  

row lock waits：xactLocalWait，统计次数

xslot waits：ankAddXslotWait，统计次数

####   [4.3.5 buffer busy waits统计](#435-buffer-busy-waits统计)  

bpLatchExclusive和bpLatchShared中统计，同visitPinned

####   [4.3.6 consistent changes统计](#436-consistent-changes统计)  

crStatistic中统计，使用handler->stat.crStat.crReverts

###   [4.4 动态视图定义](#44-动态视图定义)  

现在动态视图是通过fix table实现的。在定义完基本的fix table后，动态视图就可以通过sql来联结各个fix table以得到结果。fix table以x$开头。

####   [4.4.1 v$segstat_name](#441-vsegstat-name)  

x$segstat_name结构和v$segstat_name一样，内容写死，v$segstat_name的sql为：select * from x$segstat_name;

####   [4.4.2 v$segment_statistics](#442-vsegment-statistics)  

x$segment_statistics，结构为(obj#, ts#, statistics#, value)，数据获取过程：

```
遍历所有dc entry，拿到valid dc，取出dc上的stats(遍历表上所有index、lob)，如果有分区，遍历所有分区，然后把stats放入x$segment_statistics中

```

x$global_tmp_segstat，结构也为(obj#, ts#, statistics#, value)，数据获取过程：

```
用专有handler扫SEG_STATS$，取出stats放入x$global_tmp_segstat视图中

```

v$segment_statistics语句：

```
select u.name as owner, o.name as object_name, o.subname as subobject_name,
       ts.name as tablespace_name, ts.id as ts#, o.obj# as obj#, o.dataobj# as dataobj#,
       decode(o.type#, 1, 'TABLE', 4, 'INDEX', 6, 'AC', 7, 'TABLE PARTITION',
              8, 'INDEX PARTITION', 9, 'LOB', 10, 'LOB PARTITION',
              16, 'AC PARTITION', 23, 'TABLE SUBPARTITION', 24, 'INDEX SUBPARTITION',
              25, 'LOB SUBPARTITION', 'UNDEFINED'),
       sn.name as statistics_name, sn.statistics# as statistics#,
       s.value as value
from sys.obj$ o, sys.user$ u, sys.v$tablespace ts, x$segstat_name as sn,
     (select nvl(dcs.obj#, gts.obj#), nvl(dcs.ts#, gts.ts#),
             nvl(dcs.statistics#, gts.statistics#), nvl(dcs.value, gts.value) from
      x$segment_statistics dcs full outer join x$global_tmp_segstat gts on dc.obj#=global.obj#) s
where o.obj#=s.obj# and s.ts#=ts.id and sn.statistics#=s.statistics# and o.owner#=u.user# and
      ts.id = t.ts# and o.name != '_NEXT_OBJECT'

```

####   [4.4.3 gv$segment_statistics](#443-gvsegment-statistics)  

在v$segment_statistics基础上加上userenv('instance')

####   [4.4.4 dv$segment_statistics](#444-dvsegment-statistics)  

在v$segment_statistics基础上加上group_id和group_node_id

###   [4.5 特性周边配合](#45-特性周边配合)  

####   [4.5.1 权限](#451-权限)  

```
create or replace view v_$segment_statistics as select * from v$segment_statistics
/
create or replace public synonym v$segment_statistics for v_$segment_statistics
/
grant select on v_$segment_statistics to select_catalog_role
/

create or replace view gv_$segment_statistics as select * from gv$segment_statistics
/
create or replace public synonym gv$segment_statistics for gv_$segment_statistics
/
grant select on gv_$segment_statistics to select_catalog_role
/

```

v$segstat_name和gv$segstat_name类似

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

wait构造

##   [6.资料设计章节](#6资料设计章节)  

说明视图定义和统计项定义

##   [7.未来规划](#7未来规划)  

缓存，然后一把统计进去

## Comments:

|  [](null)  ,会议纪要：,1.space used、space allocated和segment scans需要确认含义与工作量,2.STATISTICS_LEVEL在tpcc里要设成basic，和tpcc工程负责人确认,3.统计项名字和Oracle的保持一致,4.TAC和LSC需要文早评估工作量,5.统计项加上physical read requests，gc buffer busy,6. seg_stats$加上dataoid，对象删除的时候不删除系统表上的,7.全局临时表专有handler不占用kernel handler，自己申请一个。handler上不加latch，db上加一个manager，里面有专有handler和latch,Posted by zengzhaohan at 七月 09, 2024 17:47|
|---|
