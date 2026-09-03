Created by 张璐恒, last modified on 九月 13, 2024

#   [分布式支持tablespace set的空间回收功能设计文档](#分布式支持tablespace-set的空间回收功能设计文档)  

详细设计-YDBRD-30726 : 分布式支持tablespace set的空间回收功能设计文档

IR链接：    [https://pingcode.yasdb.com/ship/ideas/669f14d84283cf23d4f24d4e](https://pingcode.yasdb.com/ship/ideas/669f14d84283cf23d4f24d4e)    ?#YASHAN-2993 分布式支持tablespace set的空间回收功能

SR链接：    [https://pingcode.yasdb.com/pjm/items/66a1bcc68f5ee1917345bcd1](https://pingcode.yasdb.com/pjm/items/66a1bcc68f5ee1917345bcd1)    ?#YDBRD-30726 分布式支持tablespace set的空间回收功能

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

本需求是针对性解决外场出现的tablespace set空间撑大了，无法释放空间的问题。补丁版本为了解决外场问题，临时支持了直连各个节点执行alter tablespace shrink space (keep size)，但是分布式下分布表的存储逻辑单位是tablespace set，tablespace set下包含多个tablespace，为理解和操作方便，预期能从tablespace set层面解决上述问题。

本需求只涉及分布式一种部署模式，涉及修改代码部分不需要区分行存和列存。

列表的冷数据用databucket存，本需求不涉及databucket这部分空间的缩小。databucket占用空间的缩小下文会提及（都是已有方案）。

###   [1.2 调研文档](#12-调研文档)  

调研主要关注以下几个问题：

1. 其它数据库是否存在类似表空间（集）需要缩小的功能，由此判断其它数据库是否有类似的需求。
1. 如果（1）其它数据库没有，为什么没有，遇到类似问题如何解决？
1. 如果（1）其他数据库有，具体是如何实现的？跟我们的设计有什么区别？跟我们的差异是为了解决什么问题？
1. 其它数据库是否存在类似表空间（集）最大值缩小的功能。为了说明以上问题，可能需要同步关注一下其他数据库的数据存储形式（宏观到tablespace set这一级别就可以了）


####   [oracle](#oracle)  

oracle有类似alter tablespace shrink space的功能

- alter tablepsace xxx   **resize**   10M，只支持  **bigfile tablespace**  ，相当于alter database datafile xxx resize；
- alter tablespace xxx   **shrink space**  ，只支持  **临时表空间**
- alter database datafile xxx resize


以上的目的都是缩小表空间（文件）占用的空间...，oracle下的tablespace没有直接指定表空间maxsize的语法，需要通过表空间下文件的参数来指定文件的maxsize（yashandb也是）oracle的tablespace set下的tablespace都是非临时的bigfile表空间

- alter tablespace set xxx   **resize**   xxx，oracle的resize是同时修改这个tablespace set下所有datafile的size
- 但是oracle  **不支持**  alter tablespace set xxx   **shrink**   space
- oracle  **不支持**  指定、修改tablespace set的  **maxsize**


其它数据库

-  oceanbase不依赖tablespace来管理数据分布，分布表使用分区表的内部机制来管理数据的分布和存储。
-  tidb也没有tablespace类似的概念。TiKV 通过PD对Region以及副本进行调度，以保证数据和读写负载都均匀地分散在各个 TiKV 上，这样的设计保证了整个集群资源的充分利用并且可以随着机器数量的增加水平扩展。
-  StarRocks没有传统意义上的 tablespace 概念。它使用的是一种更简单的表和分区结构来管理数据。数据存储和管理是通过表的设计来完成的，而不是通过额外的 tablespace 层次结构。
-  ClickHouse，数据存储在 ClickHouse 中是通过表和分区进行管理的。数据文件存储在服务器的文件系统中，并通过表结构和配置文件来管理数据的存放位置。用户可以通过配置文件指定数据的存储路径


###   [1.3 需求分析](#13-需求分析)  

**功能点1.shrink space**

1. tablespace set需要类似alter tablespace xxx shink space的功能来缩小表空间集，释放多余的表空间。本sr设计用语法   **alter tablespace set tss1 shrink space**  (tss1是表空间集名字)来实现类似功能。
1. 本sr支持keep size，keep size的意义是避免缩小过多，缩小过多可能导致接下来使用过程中频繁扩张。keep size虽然支持，得到的结果不一定准确，缩小是会尽量向要求keep的size靠齐。得到结果可能比要求的keep size更大。


>   注意当前已经支持的resize也并不是严格的将tablespace set的占用空间调整到指定的size，而是将预设的size平均分配，每一个tablespace已经占用的空间可以比平均值大，不能比平均值小，小则将size调大到平均值。所以resize出来的tablespace set可能会比要求的更大。  

**功能点2.maxsize缩小**

如果遇到tablespace set占用空间太大，说明tablespace set的预留空间超过了用户期待，tablespace set空间缩小后，为了防止表空间集再次占用较大空间，本sr考虑支持缩小maxsize。缩小maxsize的难点是会出现一部分tablespace修改成功，一部分失败。当前修改文件属性的流程是先commit redo再执行修改（估计原因是因为commit redo可能失败而修改ctrl一定能成功），所以如果一部分tablespace修改成功，则修改已经提交，无法回滚，本次操作是否成功不好定义。这个问题的解决方法（暂定第二种）：

1. 通过推送，执行逆向操作，把已经修改的maxsize改回来。
1. 参考resize，允许实际部分maxsize修改失败，  **报执行成功，日志中打印部分失败原因**  （warn）。


**功能点3.DFX**

当前tablespace set信息展示不完整，无便捷展示tablespace set缩小成功的方法。此外，当前tablespace set系统表中的maxsize不准确（不管本需求是否支持maxsize缩小，都不准确）本需求考虑增加视图展示相关信息。目前缺的：

1. tablespace set下的size（分为两项：datafile的size之和以及databucket的size之和）和准确的maxsize
1. tablespace set下属哪些tablespace


tablespace set系统表中的maxsize字段可能不准，需要在文档中增加说明。增加tablespace set相关的gv视图，经过计算展示tablespace set实际的size和maxsize。另外考虑是否增加v$或者dba视图，展示tablespace set下属的tablespace。

**补充说明点.databucket缩小**

本sr不包含databucket缩小，仅作记录。databucket中的数据有三种情况：

1. 已经归档的，可以通过归档清理释放空间
1. 已经删除的，记录在delete bitmap，可以通过compact同时将小Slice合并，然后做clean，然后通过归档清理进行释放
1. 不属于以上两种，即还在用的slice，动不了（动了丢数据）


相关sql

```
ALTER TABLE sales_info ALTER SLICE ALL STABLE;
ALTER TABLE sales_info ALTER SLICE ALL COMPACT;
ALTER TABLE sales_info ALTER SLICE ALL CLEAN;

```

**CHECKLIST**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|shrink|调用单机接口|**是**|**是**|
|功能2|改maxsize|调用单机接口|**是**|**是**|
|性能|功能1、2的执行时间|跟单机类似功能的耗时成倍数|否|**是**|
|可用性|可以恢复到修改前的值||否|**是**|
|可靠性|故障场景|异常场景无推送残留、tablespace set可用|否|**是**|
|可维可测|视图||**是**|**是**|
|安全|alter tablespace set的权限|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|**是**|
|周边配合|审计|----|----|**是**|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|表空间集（tablespace set）|分布式下用于管理分布表、索引、ac、lob数据的逻辑单位，一个tablespace set由多个tablespace组成，分为root tablespace和chunk tablespace，chunk tablespace是真正用于存数据的tablespace，按照路由分布在dn上|是|  [业界资料链接](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-TABLESPACE-SET.html)  |


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|alter tablespace set xxx shrink space;|tablespace set占用空间变小|tablespace set下的数据文件打紧凑，多余的空间回收给系统|是|
|alter tablespace set xxx maxsize 3M|修改tablespace set的最大空间|修改tablespace set下数据文件的最大size之和|是|
|系统视图|DBA_TSS_TABLESPACES|展示tablespace set和tablespace的关系|是|
|动态视图|v$tablespace_set|展示当前节点上tablespace set的size等信息|是|
|错误码|||是|
|告警|告警描述|maxsize会尽可能的调整到指定值，如果无法达到则打warn日志|是|
|日志|日志触发条件、等级、事件描述||是|


##   [3. 规格与约束](#3-规格与约束)  

1. alter tablespace set xxx shrink space keep size，如果指定的size大于当前实际size，则报错。如果没有报错，但最终缩不到预期size，会返回成功，得到的大小不会比size更小但可能更大。
1. 新增视图DBA_TSS_TABLESPACES，视图中不会展示root表空间,目前只支持查询本地关系，未来规划查全局信息。
1. shrink space、resize的时候都不涉及root表空间。
1. 改小maxsize会使得maxsize尽可能的改小到指定值，但是如果指定的maxsize小于实际的size，则不会再改小。因此修改maxsize后得到的结果可能大于指定的maxszie。
1. tablespace_set$中记录的maxsize可能不准。


##   [4. 特性](#4-特性)  

###   [4.1 特性设计：shrink space](#41-特性设计shrink-space)  

alter tablespace set shrink space的功能，新增alter tablespace set action：ACTION_SHRINK_SIZE。

在parse阶段复用tablespace shrink的主要流程，避免再写一套分散维护范围。

在verify阶段，需要查询视图gv$tabelsapce_set,确定shrink这里keep的size比当前size更小，否则报错。

查询sql：

```
SELECT SUM(MAXSIZE),SUM(SIZE) FROM 
(SELECT MAX(DATAFILES_MAX_SIZE) AS MAXSIZE,MAX(DATAFILES_SIZE) AS SIZE 
FROM GV$TABLESPACE_SET 
WHERE NAME= '%s' 
GROUP BY GROUP_ID)

```

如果校验出要求keep的size必当前实际占用的空间更大或者相等，则报错分布式不支持the specified Keep size greater than or equal to the actual occupied size

注意由于内部操作size时以block为单位，所以跟用户指定的size会有些许误差，属于合理现象。

执行阶段，均分要keep的blocks（这里均分的方式是简单的除以，所以结果可能会损失一点余数），遍历tablespace set下的每一个chunk tablespace，构造alter tablespace的结构体，调用单机alter tablespace的接口。

```
static CodResult alterSpaceSetShrinkSpace(AnkHandler* handler, AlterSpaceSetDef* def)
{
if (def-&gt;chunkIds-&gt;count == 0) {
return COD_SUCCESS;
}
CodChar spaceNameBuf[COD_MAX_NAME_LEN];
CodUint64 chunkKeepBlocks = def-&gt;keepBlocks / def-&gt;globalChunkCount;

for (CodUint32 i = 0; i &lt; def-&gt;chunkIds-&gt;count; i++) {
AlterSpaceDef alterSpaceDef;
memset(&amp;alterSpaceDef, 0, sizeof(alterSpaceDef));
CodUint32* chunkId = (CodUint32*) listGet(def-&gt;chunkIds, i);
ankGenerateSpaceName(&amp;alterSpaceDef.name.value, spaceNameBuf, COD_MAX_NAME_LEN, def-&gt;oid, *chunkId);
alterSpaceDef.action = ALTER_SPC_SHRINK;
alterSpaceDef.isOnline = COD_FALSE;
alterSpaceDef.isTemp = COD_FALSE;
alterSpaceDef.keepBlocks = chunkKeepBlocks;

if (ankAlterTablespace(handler, &amp;alterSpaceDef) != COD_SUCCESS) {
if (codGetErrorCode() == ERR_ANK_INVALID_SHRINK_SIZE) {
COD_LOG_INFO(codGetErrorCode(), "error occurs while shrink space %s : %s", spaceNameBuf,
codGetErrorMsg());
codCleanCurError();
continue;
}
}
}

return COD_SUCCESS;
}

```

是否需要对root tablespace 执行shrink 操作，只有chunk tablespace是真正跟数据相关的，缩不缩小root tablespace关系不大，当前方便理解，对root tablespace执行不执行shrink。

当前设计下只要mn，如果cn、dn执行失败（故障、表空间加锁失败、redo持久化失败等等），就直接进入推送流程。推送流程通过表空间集的元数据version来确保推送成功，且当前流程能安全重入，因此故障场景不需要特别处理。

###   [4.2 特性功能点2：maxsize缩小](#42-特性功能点2maxsize缩小)  

解析阶段不做改变，校验阶段删除原有的对于maxsize改大的拦截，增加对maxsize改小的范围和当前已经占用的size的校验。校验方式也是通过查询gv视图拿到当前tablespace set的size，判断新的maxsize是否小于当前的size。小于则报错YAS-04383 tablespace set maxsize cannot be smaller than size

![](https://pingcode.yasdb.com/atlas/files/public/67396e08a1ad9a3311dc94da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM3NDEsImV4cCI6MTc4MjMyNDU0MX0.zE9dAfj5lFkqrOrZhm72pxqLvXcOeDNbBa4_LzuPq2s)

![](image-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM3NDEsImV4cCI6MTc4MjMyNDU0MX0.zE9dAfj5lFkqrOrZhm72pxqLvXcOeDNbBa4_LzuPq2s)

执行的时候将maxsize均分到每个chunk，再算出每个节点上分到多少new maxsize，是通过查询gv视图得到当前节点上的tablespace set的最大值之和与每个节点的new maxsize比较，来判断当前节点上的tablespace set的maxsize是调大还是调小。

创建tablespace set的时候会先建maxsize为最大值的文件，只有最后一个文件的maxsize可能不是最大值，因此alter maxsize改大的时候也从前往后遍历，改小的时候从后往前遍历，尽可能让最后的文件小一点。

涉及到tablespace操作多个文件的功能并不是原子操作，一部分操作成功后就会提交，因此当前改小maxsize的原则是尽量改，如果改到最后一个文件（逆序遍历，也就是第一个文件），发现无法保证所有文件的maxsize之和能缩小到指定值，则会修改失败，但是已经修改的tablespace无法恢复，因此仍然返回成功，在日志中打印warn。

>   更理想的是在修改maxsize之前做校验，然后加锁保证size不再变化，这样就能预期修改一定成功。但是在故障场景下，需要推送保证修改成功，要么tablespace set这个级别的锁得一直保留到推送成功，确保maxsize的修改仍然可以成功（跨度太久，不现实）；要么在推送过程中校验失败则终止推送，也就是仍然不能保证一定修改成功，综上选择在第一次执行的时候做容错，使maxsize尽可能的改小。  

当前设计在dn上重入，只要走完所有流程就一定能返回成功，所以故障场景能够通过现有推送流程得到保证，不需要额外处理。

###   [4.3 特性可维可测设计](#43-特性可维可测设计)  

新增视图，展示tablespace set和tablespace的关系，但是该视图  **只展示chunk表空间**  ，root表空间本身不用于存数据，也不涉及size、maxsize相关的计算，在各个节点上都有一个表空间集同名的root表空间，全部拉到视图里展示没有意义。目前dba视图没有查询全局的能力，所以暂时只查询本地信息，后续考虑支持查询全局信息，DBA_TSS_TABLESPACES。

|字段|说明|
|---|---|
|TABLESPACE_NAME|表空间名称|
|TABLESPACE_ID|表空间id|
|TABLESPACE_SET_NAME|表空间集名称|
|CHUNK_ID|这个表空间对应哪一个chunk,如果是root表空间则该项为空|
|RESIDUAL|这个表空间是不是重分布残留的旧表空间，即当前表空间已经迁移到别的节点（yes/no）|


该视图在单机下为空。

目前计划该视图  **不包含非tablespace set下的表空间**  ，否则跟DBA_TABLESPACES功能重合了。

以两个dn，每个dn7个chunk为例，预期得到的效果：

```
SQL&gt; select * from DBA_TABLESPACES where TABLESPACE_SET_NAME = 'USERS';

TABLESPACE_NAME TABLESPACE_ID TABLESPACE_SET_NAME CHUNK_ID RESIDUAL 
---------------------------------------------------------------- ------------- ---------------------------------------------------------------- ------------ ----------------- 
TSS_2609_CHUNK_0 7 USERS 0 NO 
TSS_2609_CHUNK_1 8 USERS 1 NO 
TSS_2609_CHUNK_2 9 USERS 2 NO 
TSS_2609_CHUNK_3 10 USERS 3 NO 
TSS_2609_CHUNK_4 11 USERS 4 NO 
TSS_2609_CHUNK_5 12 USERS 5 NO 
TSS_2609_CHUNK_6 13 USERS 6 NO 
TSS_2609_CHUNK_7 14 USERS 7 NO 
TSS_2609_CHUNK_8 15 USERS 8 NO 
TSS_2609_CHUNK_9 16 USERS 9 NO 
TSS_2609_CHUNK_10 17 USERS 10 NO 
TSS_2609_CHUNK_11 18 USERS 11 NO 
TSS_2609_CHUNK_12 19 USERS 12 NO 
TSS_2609_CHUNK_13 20 USERS 13 NO 

14 rows fetched.



```

实现方式

```
CREATE OR REPLACE VIEW DBA_TSS_TABLESPACES(TABLESPACE_NAME, TABLESPACE_ID, TABLESPACE_SET_NAME, CHUNK_ID, RESIDUAL) AS
SELECT t.TABLESPACE_NAME, t.ID, s.NAME,
TO_NUMBER(REGEXP_SUBSTR(t.TABLESPACE_NAME, 'TSS_\d+_CHUNK_(\d+)', 1, 1, NULL, 1)),
CASE WHEN r.CHUNK# IS NULL THEN TRUE ELSE FALSE END
FROM SYS.DBA_TABLESPACES t JOIN tablespace_set$ s ON
TO_NUMBER(REGEXP_SUBSTR(t.TABLESPACE_NAME, 'TSS_(\d+)_CHUNK_\d+', 1, 1, NULL, 1)) = s.TSS_OID
LEFT JOIN route$ r ON
TO_NUMBER(REGEXP_SUBSTR(t.TABLESPACE_NAME, 'TSS_\d+_CHUNK_(\d+)', 1, 1, NULL, 1)) = r.CHUNK#
/

```

新增tablespace_set的gv视图，展示tablespace set占用的总空间。cn查询到的是tablespace set的总大小，包括各个dn主节点上该tablespace set的大小，如果某个dn组没有主节点，结果可能不准。每个tablespace set一条数据。

|字段|说明|
|---|---|
|OID|表空间集的oid|
|NAME|表空间集的名字|
|DS_ID|所属dataspace的id|
|NEXT_BLOCKS|这个表空间集中的数据文件每次扩张的大小|
|BLOCK_SIZE|数据文件的数据块大小（单位：字节）|
|DATAFILES_COUNT|这个表空间集合下数据文件的总数|
|DATAFILES_MAX_SIZE|这个表空间集在当前节点的数据文件总的最大SIZE|
|DATAFILES_SIZE|这个表空间集下所有datafile总的实际大小|
|DATAFILES_FREE_BLOCKS|这个表空间集下所有datafile总的空闲可用的数据块数量|
|DATABUCKETS_COUNT|这个表空间集合下DATABUCKET文件的总数|
|DATABUCKETS_MAX_SIZE|这个表空间集在当前节点的DATABUCKET文件的总最大SIZE|
|DATABUCKETS_SIZE|这个表空间集下所有databucket的实际大小|


>   注意以上databucket的size统计只统计本地？不包括s3 databucket  

gv视图实现方式

```
"with tss_ts as ("\
" select ts.id, dba.tablespace_set_name as tss_name, "\
" sum(df.free_blocks) as df_total_free_blocks, count(df.id) as df_count, sum(df.max_size) as df_max_size, "\
" sum(df.bytes) as df_total_bytes, count(db.id) as db_count, "\
" case when exists ( "\
" select 1 "\
" from sys.v$databucket db "\
" where db.ts# = ts.id and db.max_size = -1 "\
" ) then -1 else sum(db.max_size) end as db_max_size, "\
" sum(db.used_size) as db_total_bytes "\
" from sys.v$tablespace ts "\
" left join sys.v$datafile df on df.ts# = ts.id "\
" left join sys.v$databucket db on db.ts# = ts.id "\
" join dba_tss_tablespaces dba on dba.tablespace_id = ts.id "\
" group by ts.id, dba.tablespace_set_name "\
") "\
"select userenv('group_id'), userenv('group_node_id'), userenv('instance'), tss.tss_oid, tss.name, tss.ds_id, tss.next_blocks, d.block_size, "\
" coalesce(sum(tss_ts.df_count), 0), "\
" coalesce(sum(tss_ts.df_max_size), 0), "\
" coalesce(sum(tss_ts.df_total_bytes), 0), "\
" coalesce(sum(tss_ts.df_total_free_blocks), 0), "\
" coalesce(sum(tss_ts.db_count), 0), "\
" case when sum(tss_ts.db_max_size) &lt; 0 then -1 "\
" else coalesce(sum(tss_ts.db_max_size), 0) end , "\
" coalesce(sum(tss_ts.db_total_bytes), 0) "\
"from sys.v$database d,tablespace_set$ tss, tss_ts "\
"where tss.name = tss_ts.tss_name "\
"group by tss.tss_oid, tss.name, tss.ds_id, tss.next_blocks, d.block_size "\

```

###   [4.6 特性安全设计](#46-特性安全设计)  

###   [4.7 特性周边配合](#47-特性周边配合)  

tablespace set的根tablespace原来是8192个block，然而实际上根表、根索引、根lob现在并不需要预占空间，本sr将同步改小root tablespace的文件大小，暂定为128个block（ANK_MIN_DATAFILE_BLOCKS）。maxsize保持不变，还是64M个block（ANK_MAX_DATAFILE_BLOCKS）。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

## Comments:

|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396e08a1ad9a3311dc94da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM3NDEsImV4cCI6MTc4MjMyNDU0MX0.zE9dAfj5lFkqrOrZhm72pxqLvXcOeDNbBa4_LzuPq2s),Posted by zhangluheng at 八月 30, 2024 16:55|
|---|
|  [](null)  ,测试设计：    [YDBRD-30726 分布式支持tablespace set的空间回收测试详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=167161204)  ,Posted by liumeixiu at 九月 12, 2024 10:26|
