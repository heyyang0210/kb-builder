Created by 李燕琼, last modified on 十月 31, 2023

#   [YDBRD-12303 : 系统表seg$方案设计](#ydbrd-12303--系统表seg方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-12303](https://jira.yasdb.com/browse/YDBRD-12303)  

##   [1. Overview（概述）](#1-overview概述)  

本文档说明系统表seg$的设计方案。

seg$的表结构设计，一方面参照Oracle数据库的seg$表结构，另一方面考虑了YASDB的segment实现。通过增加seg$表，数据库加载数据字典，不需要从磁盘读segment block，而是通过查询seg$获取segment相关信息。

##   [2. Features（功能特性）](#2-features功能特性)  

- 系统表seg$表结构设计
- 旧版本segment信息的载入
- 新版本segment信息的生成，更新及删除
- 数据字典的加载


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

seg$用于记录数据库中特定类型对象的segment元信息。

###   [表结构](#表结构)  

####   [oracle seg$表分析](#oracle-seg表分析)  

前期调研了oracle的seg$系统表。

|列名|类型|含义|是否采用|说明|
|---|---|---|---|---|
|FILE#|NUMBER|segment header file number|是|FILE# BLOCK#合并为entry|
|BLOCK#|NUMBER|segment header block number|是||
|TYPE#|NUMBER|segment type|是||
|TS#|NUMBER|tablespace containing this segment引用sys.ts$ 字段ts#|是||
|BLOCKS|NUMBER|blocks allocated to segment so far|否||
|EXTENTS|NUMBER|extents allocated to segment so far|否||
|INIEXTS|NUMBER|initial extent size(单位是blocks数，而不是字节数，由storage clause的initial计算得到)|是||
|MINEXTS|NUMBER|minimum number of extents(In a locally managed tablespace,r this value is set to 1)|否||
|MAXEXTS|NUMBER|maximum number of extents|否||
|EXTSIZE|NUMBER|current next extent size(block数量，而不是字节数)|否||
|EXTPCT|NUMBER|percent size increase|否||
|USER#|NUMBER|user who owns this segment引用sys.user$ 字段user#|是||
|LISTS|NUMBER|freelists|否||
|GROUPS|NUMBER|freelists group|否||
|BITMAPRANGES|NUMBER|ranges per bit map entry（是segment的maxsize)|是||
|CACHEHINT|NUMBER|与块缓冲有关（keep,KEEP,NONE)|否||
|SCANHINT|NUMBER|Reuse it as inc# for ASSM segments可能与备份恢复有关|是|含义ecn|
|HWMINCR|NUMBER|引用dataobj#字段|是||
|SPARE1|NUMBER|Segment flags|是||
|SPARE2|NUMBER||||


####   [yasdb seg$表定义](#yasdb-seg表定义)  

参考oracle seg$的表结构，确定本次新增seg$表的表结构。

```
--表结构
CREATE TABLE SEG$
(
    OBJ#        BINARY_BIGINT       NOT NULL,
    ENTRY       BINARY_INTEGER      NOT NULL,
    DATAOBJ#    BINARY_BIGINT       NOT NULL,
    ECN#        BINARY_INTEGER      NOT NULL,
    TYPE#       BINARY_INTEGER      NOT NULL,
    TS#         BINARY_INTEGER      NOT NULL,
    VERSION#    BINARY_INTEGER      NOT NULL,
    INIEXTS     BINARY_BIGINT       NOT NULL,
    MAXSIZE     BINARY_BIGINT       NOT NULL,
    RESERVED_1  BINARY_BIGINT,
    RESERVED_2  BINARY_INTEGER
) SYSTEM xxx ORGANIZATION HEAP
/

OBJ#: 对象object id，引用obj$的obj#

ENTRY: 对象的file no+ block no

DATAOBJ#:对象的dataoid

ECN#:extent change number

TYPE#: segment类型。0代表TABLE, 1 代表索引， 2 代表LOB

TS#： 表空间no

VERSION#：segment版本。0代表BASE, 1 代表AUTO

INTEXTS:初始extent的block数量。为storage clause预留。

MAXSIZE:对象可达到的最大block个数。为storage clause预留。

--唯一索引：使用OBJ#字段建立索引
CREATE UNIQUE INDEX I_SEG1 ON SEG$(OBJ#)
/


```

####   [seg$描述的segment类型](#seg描述的segment类型)  

seg$记录数据库中特定对象的segment元信息，这些对象包括TABLE/INDEX/LOB SEGMENT，TABLE/INDEX/LOB 的分区，TABLE/INDEX/LOB 的子分区。

###   [旧版本segment信息的载入](#旧版本segment信息的载入)  

兼容性要求seg$能够记录旧版本数据库的segment。实现方法是，在版本升级过程中，创建seg$，并收集现有segment信息，依次向seg$填入segment信息。旧版本segment的version#字段，统一设置为0,也就是BASE

收集segment信息的方式：

途径一：查询系统表OBJ$，TAB$，IND$，LOB$，TABPART$，INDPART$,LOBFRAG$

途径二：无法通过途径一获取的信息，例如segment的ecn，读取物理页面获取。

###   [新版本segment信息的生成，更新及删除](#新版本segment信息的生成更新及删除)  

- 生成


首先，为了编码方便，TAB$，COL$，IND$，ICOL$，USER$，OBJ$这6张核心系统表，seg$系统表本身，及建立在这7张表上的索引，在seg$中没有相应的Seg$元组。

seg$记录的是TABLE/INDEX/LOB对象及它们的分区/子分区对象的segment元信息。segment的创建，并不总是与对象的创建时机一致.当启用延迟段创建时，向表中插入数据时，段文件才会被创建。

seg$元组的生成，就是置于段文件创建之后。

上面同时说明，不真实存储数据的对象类型，在seg$中没有直接对应的元组。以table对象为例，系统表tab$记录了所有TABLE，TABLE 类型如下

```
typedef enum EnTableType {
    TABLE_BOOT = 0,
    TABLE_SYSTEM = 1,
    TABLE_DYNAMIC_VIEW,
    TABLE_NORMAL,
    TABLE_TAC,
    TABLE_EPC,
    TABLE_VIEW,
    TABLE_LSC,  // Local Storage Columnar Table
    TABLE_JOURNAL,      // journal table that is used for online operation
    TABLE_AC,
    TABLE_MATERIALIZED_VIEW,
    \__TABLE_TYPE_COUNT\__
} TableType;

```

TABLE_DYNAMIC_VIEW，TABLE_VIEW属于逻辑表类型，不真实存储数据的物理表类型，在seg$中没有相应记录。

另外TABLE_JOURNAL，临时表也不记录在seg$。

- 更新


目前，只有ecn字段可能更新。目前只有shrink table场景。shrink table引起segment的ecn值递增，此时，seg$中 segment 的ecn#字段也相应更新，与segment block的ecn一致。

- 删除


当删除对象的segment实体时，删除seg$中该segment记录。这种场景发生在truncate/drop TABLE/INDEX/LOB对象及它们的分区/子分区对象时。truncate 这些对象时，对象在系统表OBJ$，TAB$，IND$，LOB$，TABPART$，INDPART$,LOBFRAG$中的记录仍在，但是已经没有segment实体，因此在seg$中没有相应元组。drop这些对象时，对象不复存在，对象拥有的seg$ 元组被同步删除。

###   [数据字典的加载](#数据字典的加载)  

核心系统表及其索引：seg$及其索引，都没有相应的seg$记录，因此它们的数据字典加载方式保持不变

升级模式（alter database open upgrade)：数据进入升级模式时，如果seg$存在，数字字典加载方式，由原来的磁盘读segment block，变更为查询系统seg$。否则，数据字典加载方式保持之前不变，仍是读segment block。

其它情况下：数字字典加载方式，由原来的磁盘读segment block，变更为查询系统seg$

###   [字段说明](#字段说明)  

- INIEXTS，MAXSIZE


为storage clause预留

INIEXTS：初始extent 大小。目前根据表空间的EXTENT大小计算。表空间extent size固定，由INIEXTS等于单个Extent的blocks数量。对于自动分配的表空间，值是8.

MAXSIZE：目前写死，值为0xFFFFFFFF

- RESERVED_1，RESERVED_2


预留字段

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 DFX设计](#52-dfx设计)  

高级包DBMS_SPACE_ADMIN新增一个函数SEGMENT_ECN。

参数：与dbms_space_admin.segment_number_blocks的个数与含义相同。分别是：表空间#， file number, block number, dataobj#

返回值：segment 的ecn

###   [5.3 其他](#53-其他)  

##   [6. TODO（遗留问题）](#6-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*