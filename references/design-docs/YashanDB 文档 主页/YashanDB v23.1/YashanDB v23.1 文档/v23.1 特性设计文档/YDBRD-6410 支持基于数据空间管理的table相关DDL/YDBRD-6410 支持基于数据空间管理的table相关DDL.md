Created by 何阳, last modified on 七月 26, 2023

JIRA：    [https://jira.yasdb.com/browse/YDBRD-6410](https://jira.yasdb.com/browse/YDBRD-6410)  

参考文档：

  [Greenplumn 大型分区表](https://gp-docs-cn.github.io/docs/admin_guide/ddl/ddl-partition.html#topic70)      
    [Oceanbase数据分布](https://www.oceanbase.com/docs/community-observer-cn-10000000000013319)         
    [Oracle CREATE TABLE](https://www.oceanbase.com/docs/enterprise-oceanbase-database-cn-10000000000360169)     

  [ClickHouse——数据分片](https://www.jianshu.com/p/aff4fe8c3f72)  

  [Oracle Sharded Table](https://docs.oracle.com/en/database/oracle/oracle-database/12.2/admin/sharding-schema-design.html#GUID-1DBC6C7F-4E0C-47E5-8870-05F829D6C3B3)  

  [在线扩容及数据空间管理规格讨论](https://conf.yasdb.com/pages/viewpage.action?pageId=95095334)  

## 1. Overview（概述）

   每个Dataspace有多个chunk，每个tablespace set只属于一个dataspace，tablespace set会根据dataspace的chunks属性，分配出chunks个tablespace，建表的时候指定tablespace set，表会自动划分成chunks个分片。

   现有分布式下会按照分布信息将表，按照hash分布到默认的dataspace上，默认的dataspace有跟DN组个数一样的chunk，分片是跟DN组个数一样，所以扩容的时候没有办法迁移现有的分片。为了能够保证按照tablespace为基本单位的迁移，需要确保dataspace里面有大于DN组个数的chunk数，也就是需要分布表有跟chunk数一样的分片，可以将现在的分布表进行改造，用一级分区表来表示分布，将一级分区表个数默认设置为跟chunks数一样，方便后续按照chunk进行数据搬迁。

  


## 2. Features（功能特性）

   改造现有分布表，支持分布表可以有大于数据节点个数的分片数

## 3. 调研

1. OceanBase 数据库沿用了分区表的使用方式，但是分区可以均匀分布在数据库任意节点上。  **分区组内的均衡算法是，首先通过数量均衡使得分区在资源单元间的个数分布均匀**  ，然后计算各个资源单元的负载，交换负载最高、负载最低的两个资源单元上的分区，既保持个数均衡，又使得负载更加均衡。随着数据持续写入分区，资源单元的负载会动态变化，会持续触发迁移，使得硬盘持续均衡。
1. greenplumn 既有分布键又支持二级分区，扩容的时候会存在多个节点间数据搬迁，数据搬迁太多，可能会影响正常业务
1. Oracle Sharding是基于Oracle数据库分区特性实现的。Oracle Sharding 本质上是分布式分区，因为它通过支持跨分片的表分区分布来扩展分区，扩容和缩容是按照chunk进行搬迁，不会存在多个节点间的数据搬迁，对业务影响小。
1. clickhouse支持分布和一级分区，扩容之后数据可以按照part方式重分布，也可以通过数据导入导出进行rehash全局重分布


  


下面是oracle文档的分片分区的概念：

分片表的每个分区都驻留在单独的表空间中，每个表空间都与特定的分片相关联。根据分片方法，关联可以自动建立或由管理员定义。

用分片作为分布式的分区：

![](https://pingcode.yasdb.com/atlas/files/public/67396ad68970c2af4f51ff8a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBRUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMxNjUsImV4cCI6MTc4MjIyMzk2NX0.DYk6oTfNj88IKh3aZYMzpek0eo-QM0Z0RGm6SCdsbQI)

![](https://pingcode.yasdb.com/atlas/files/public/67396ad68970c2af4f51ff8b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBRUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTMxNjUsImV4cCI6MTc4MjIyMzk2NX0.DYk6oTfNj88IKh3aZYMzpek0eo-QM0Z0RGm6SCdsbQI)

oracle对所有的子分区也支持分片，从可管理性的角度来看，子分区可以通过将子分区放入单独的表空间并在存储层之间移动来支持分层存储方法。可以在存储层之间迁移子分区，而不会牺牲分片的可扩展性和可用性优势以及在主键上执行分区修剪和分区明智连接的能力。

  


  


|描述|优点|缺点|备注|
|:---|:---|:---|:---|
|方案1：跟GP体系一致，有分布分区关键词|1.继承现有建表语句,   2.可以按照分区分片处理，扩容的时候可以按照tablespace搬迁|1.分布式比单机天然少了一级分区   ,2.  **对外呈现的系统表信息还是有一级分区和二级分区，但是建表语句没有二级分区的概念**   ,3.带有分区表的查询时，需要修改二级分区表跟一级分区表的映射|1.   需要对现有的建表语句在解析层做改造，分布信息用一级分区改造以及映射，同时限制二级分区全部   ,2.需要限制增加alter table 增加分区语句|
|方案2：跟Oracle，Oceanbase体系保持一致，用分区完整替代分布，无分布键关键词|1.可以跟单机的建表语句保持一致   ,2.天然支持一级和二级分区表查询，不需要在SQL语法上做修改,   3.分布式下可以支持二级分区|1.跟现有建表语句不兼容   ,2.不能对一级分区做增删操作，否则会存在节点间数据的迁移(不按tablespace力度迁移)|1.需要对一级分区表的个数进行约束,2.将分区表跟分布做映射,3.需要对默认分布算法做约束，先只支持一致性hash分布|


  


**采用方案2，这样单机和分布式下的概念体系都是一样的，也是跟oracle 的SDB是同套体系概念。**

1. 分布式下需要保证数据能尽可能均匀分布到不同的数据节点，至于是用分布键来表示数据的分布还是用分区键表示数据的分布，这个没有本质的区别。
1. 在使用过程中，一般情况下用户其实不太关心数据的分布是怎样的，但是需要保证增加分布式数据节点能够有性能和容量上的横向扩展，能够保证扩容或者缩容时，按照tablespace整体迁移
1. 现有二级分区的能力在分布式下也可以基本上保持一致。
1. tablespace 和tablespace set其实跟oracle体系是接近的，分布式跟oracle的SDB是有很多共同点，所以方案2是更符合期望的


## 4. Limitations（功能限制）

1. 分布式一级分区只支持hash分区，不支持range，list以及interval分区
1. 分布式下不支持一级分区的增删操作
1. 分布式下不支持指定匿名的一级分区数，一级分区数默认跟chunk个数一致
1. 分布式下指定的一级分区名的个数，需要跟所属tablespace set的chunk数一样，否则会报错
1. 根据DS_SCALE_OUT这个配置参数，如果DS_SCALE_OUT != 1，则不支持distributed by的语法
1. 分布式不支持一级分区指定特定tablespace，语法解析不会报错，校验上会报错
1. 分布式下二级分区不能指定特定tablespace，语法解析不会报错，校验上会报错


## 5. Detail Design（详细设计）

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

  


语法层面增加了一个    `consistent`    字段，这个放在hash字段前面，可以缺省

```
= PARTITION BY RANGE "(" (column {"," column}) ")"
(subpartition_by_range|subpartition_by_list|subpartition_by_hash)
"(" (range_partition_desc {"," range_partition_desc}) ")".

```

  [hash_partitions_by_quantity](#hashpartitionsbyquantity)    **::=**

```
= PARTITIONS hash_partition_quantity [STORE IN "(" (tablespace {"," tablespace}) ")"] 
[OVERFLOW STORE IN "(" (tablespace {"," tablespace}) ")"].

```

  [composite_range_partitions](#compositerangepartitions)    **::=**

```
= PARTITION BY RANGE "(" (column {"," column}) ")"
(subpartition_by_range|subpartition_by_list|subpartition_by_hash)
"(" (range_partition_desc {"," range_partition_desc}) ")".

```

  [subpartition_by_range](#subpartitionbyrange)    **::=**

```
= SUBPARTITION BY RANGE "(" (column {"," column}) ")" [subpartition_template].

```

  [subpartition_template](#subpartitiontemplate)    **::=**

```
= SUBPARTITION TEMPLATE (("(" (
(range_subpartition_desc {"," range_subpartition_desc})
| (list_subpartition_desc {"," list_subpartition_desc})
| (individual_hash_subparts { "," individual_hash_subparts})) ")")).

```

  [range_subpartition_desc](#rangesubpartitiondesc)    **::=**

```
= (SUBPARTITION [subpartname] range_values_clause [TABLESPACE tablespace] [deferred_segment_creation]).

```

  [list_subpartition_desc](#listsubpartitiondesc)    **::=**

```
= (SUBPARTITION [subpartname] list_values_clause [TABLESPACE tablespace] [deferred_segment_creation]).

```

  [individual_hash_subparts](#individualhashsubparts)    **::=**

```
= SUBPARTITION [subpartname] [TABLESPACE tablespace] [deferred_segment_creation].

```

  [subpartition_by_list](#subpartitionbylist)    **::=**

```
= SUBPARTITION BY LIST "(" (column {"," column}) ")" [subpartition_template].

```

  [subpartition_by_hash](#subpartitionbyhash)    **::=**

```
= SUBPARTITION BY HASH "(" (column {"," column}) ")" 
[(subpartition_template | hash_subparts_by_quantity)].

```

  [hash_subparts_by_quantity](#hashsubpartsbyquantity)    **::=**

--- 不支持

```
= SUBPARTITIONS integer [STORE IN "(" (tablespace {"," tablespace}) ")"].

```

```
//  dstbCreateInsertInfo
// DC这部分没有变动，所以优化器这边没有做调整，也是可以跑通的
// 补齐二级分区查询时，做分区剪枝的接口
// 
// 一级partnum -&gt;

CodResult anlDstbKeyToChunkId(AnlStmt* stmt, TableDict *dc, CodUint64 partnum, CodUint32 *chunkId);
CodResult anlGetGroupByChunk(AnlStmt* stmt, TableDict* dc, CodUint32 chunkId, GroupDesc* group);

chunkId &lt;---&gt; DN group 需要修改anlGetGroupByChunk的实现

```

  


**会通过DS_SCALE_OUT的参数来判断走是分区键替代分布信息，还是使用“distributed by”的语法，在DS_SCALE_OUT  != 1的情况下，不支持“distributed by”语法，DS_SCALE_OUT  == 1，建表语句跟现有能力保持一致**

  


场景分析：

1.无distributed by以及partition by关键词 --- 把缺省信息补齐，但是这个会变成一个分区表

2.无distributed by，有partition by — 分布键会变成分区键

3.distributed by，partition by --- 报错

4.distributed by，无 partition by --- 报错

5.不支持的语法，需要报错 （边界条件，规格限制里面的场景）

6.无partition by，有subpartition — 报错

7.有partition by，有subpartition — 成功 （二级分区支持，range，hash，list，模板和非模板）

  


  


### 5.1   分布Cache & 系统表

分布式下Sharded表，至少是一级分区表，一级分区表的个数跟chunk个数一致。

StTableDict中的StDistDict字段，在分布式下可以复用，如果table是sharded表，通过partcol$来加载出来

废弃  DIST$和DISTCOL$  ，修改ankCreateTable和ankDropTable函数，将对应代码移除，错误码信息改造

DIST$系统表通过Part$来表示，  **DIST$和DISTCOL$系统表会被废弃不使用，不存数据到系统表里面，把原来在DIST$系统表**

```
-- TAB$新增两个字段
CREATE TABLE TAB$
(
    OBJ#            BINARY_BIGINT       NOT NULL,
    DATAOBJ#        BINARY_BIGINT,
    TYPE#           BINARY_INTEGER      NOT NULL,
    COLS            BINARY_INTEGER      NOT NULL,
    VCOLS           BINARY_INTEGER      NOT NULL,
    TS#             BINARY_INTEGER      NOT NULL,
    PCTFREE         BINARY_INTEGER      NOT NULL,
    INITRANS        BINARY_INTEGER      NOT NULL,
    MAXTRANS        BINARY_INTEGER      NOT NULL,
    FLAGS           BINARY_INTEGER      NOT NULL,
    PROPERTY        BINARY_INTEGER      NOT NULL,
    ENTRY           BINARY_INTEGER      NOT NULL,
    CHARSET         BINARY_INTEGER,
    FB_SCN          BINARY_BIGINT       NOT NULL,
    ROW_COUNT       BINARY_BIGINT,
    BLOCK_COUNT     BINARY_BIGINT,
    EMPTY_COUNT     BINARY_BIGINT,
    CHAIN_COUNT     BINARY_BIGINT,
    AVG_ROW_SIZE    BINARY_INTEGER,
    AVG_SPACE       BINARY_INTEGER,
    ANALYZE_TIME    DATE,
    SAMPLESIZE      BINARY_BIGINT,
    COMPRESSION        BINARY_INTEGER,
    COMPRESSION_LEVEL  BINARY_INTEGER,
    VERSION         BINARY_BIGINT,
    MCOL_TTL        BINARY_BIGINT,
    DS_ID           BINARY_BIGINT, // 新增
    CHUNKS          BINARY_INTEGER // 新增
) SYSTEM 0 ORGANIZATION HEAP
/

```

  


  


### 5.2 Data Structures & Flow（数据结构与流程）

*设计主要数据结构、工作流程、序列图等。*

## 6. Testcases（自测用例）

*设计开发人员自测用例（文字描述）。*

```
--- oracle 二级分区建表示例
CREATE SHARDED TABLE customers 
( cust_id     NUMBER NOT NULL
, name        VARCHAR2(50)
, address     VARCHAR2(250)
, location_id VARCHAR2(20)
, class       VARCHAR2(3)
, signup_date DATE
, CONSTRAINT cust_pk PRIMARY KEY(cust_id, signup_date)
)
TABLESPACE SET ts1
PARTITION BY CONSISTENT HASH (cust_id)
SUBPARTITION BY RANGE (signup_date)
SUBPARTITION TEMPLATE 
( SUBPARTITION per1 VALUES LESS THAN (TO_DATE('01/01/2000','DD/MM/YYYY')),
  SUBPARTITION per2 VALUES LESS THAN (TO_DATE('01/01/2010','DD/MM/YYYY')),
  SUBPARTITION per3 VALUES LESS THAN (TO_DATE('01/01/2020','DD/MM/YYYY')),
  SUBPARTITION future VALUES LESS THAN (MAXVALUE))
)
PARTITIONS AUTO
;

--- test1
drop table if exists shard_ddl_t1;
create sharded table shard_ddl_t1(r1 int) partition by hash(r1);
insert into shard_ddl_t1 values(1);
insert into shard_ddl_t1 values(2);
insert into shard_ddl_t1 values(3);
insert into shard_ddl_t1 values(4);
insert into shard_ddl_t1 values(5);
insert into shard_ddl_t1 values(6);
select * from shard_ddl_t1;

select * from shard_ddl_t1 partition(SYS_P1);
select * from shard_ddl_t1 partition(SYS_P2);
select * from shard_ddl_t1 partition(SYS_P3);
select * from shard_ddl_t1 partition(SYS_P4);
select * from shard_ddl_t1 partition(SYS_P5);
select * from shard_ddl_t1 partition(SYS_P6);
drop table shard_ddl_t1;

--- unsupport
drop table if exists unsupport_shard_ddl_table;
--- error
create duplicated table unsupport_shard_ddl_table(r1 int, r2 int) partition by consistent hash(r1);
--- error
create sharded table unsupport_shard_ddl_table(r1 int, r2 int) partition by consistent hash(r1) partitions 10;

--- error
create sharded table unsupport_shard_ddl_table(r1 int, r2 int) partition by consistent hash(r1) partitions 10;

--- 二级分区用例



```

  


## 7. Workload（工作量）

*评估代码量KLOC、工作量（人天）。*

## 8. TODO（遗留问题）

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

## Comments:

|  [](null)  ,会议纪要：    
  讨论主题：分布表语法改造    
  参与人员：欧伟杰 李伟超 李怿 张鹏飞 徐晓锋 邹良港 施新华 陈宜顺 何阳    
  时间：2023/7/13 9:30 ~ 10:30    
  会议结论：    
  1.语法层面采用方案2，跟Oracle，Oceanbase体系保持一致，用分区完整替代分布，无分布键关键词。但是要跟产品那边确认，是否直接去掉distribute字段，还是保留distribute字段,工作量问题确认：    
  1.导入导入工具的工作量，分布信息落在哪个分片 --- 需要找继鸿对齐    
  2.驱动相关的工作量  --- 找德柳对齐    
  3.分布式二/三层用例刷新  ---- 需要占用测试工作量,识别到的架构演进问题：    
  1.数据倾斜问题如何解决，联合一二级分区进行分布，是否会对现有的架构要做重大调整    
  2.hash算法升级，如何进行兼容,Posted by heyang at 七月 13, 2023 10:45|
|---|
