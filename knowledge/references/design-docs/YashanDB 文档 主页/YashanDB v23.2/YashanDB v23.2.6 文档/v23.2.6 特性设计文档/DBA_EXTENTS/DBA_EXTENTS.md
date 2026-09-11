Created by 李燕琼, last modified on 九月 11, 2024

##   [1. Overview（概述）](#1-overview概述)  

当磁盘空间不足，且表空间的数据文件上存在大量空洞，可以通过shrink space缩小数据文件的方式释放磁盘空间。 shrink space只能释放文件高水位线以上的空间，需要先压缩空洞，降低文件的高水位线，shrink space才能有效果。 压缩空洞的方法有：

- shrink table： 可以将表上的extent还给表空间，但是不能保证能降低表空间数据文件的高水位线
- 重建表/索引： 重建表可以通过create table as select + rename table实现
- move table：当前还不支持该功能


如何确定要shrink哪张表或者重建哪张表，需要先确认文件的高水位线附近的extent属于哪个对象。

##   [2. Features（功能性）](#2-features功能性)  

通过DBA_EXTETS查看每一个extent所属的对象信息，extent的起始位置，大小。 通过该视图可以查到某个数据文件的高水位线上的extent属于哪个对象。

通过USER_EXTETS查看当前用户的每一个extent所属的对象信息，extent的起始位置，大小。

##   [3. Interfaces（接口）](#3-interfaces接口)  

DBA_EXTENTS

|字段|字段类型|描述|
|---|---|---|
|OWNER|VARCHAR(64)|extent所属对象的用户名|
|SEGMENT_NAME|VARCHAR(64)|extent所属的segment名|
|PARTITION_NAME|VARCHAR(64)|extent所属的分区名|
|SEGMENT_TYPE|VARCHAR(18)|extent所属的segmen类型|
|TABLESPACE_NAME|VARCHAR(64)|extent所属的表空间名|
|EXTENT_ID|BIGINT|extent在segment内的ID|
|FILE_ID|BIGINT|extent所属的文件ID|
|BLOCK_ID|BIGINT|extent所属的BLOCK ID|
|BYTES|BIGINT|extent的字节大小|
|BLOCKS|BIGINT|extent的Block数|


**USER_EXTENTS**

|字段|字段类型|描述|
|---|---|---|
|SEGMENT_NAME|||
|PARTITION_NAME|||
|SEGMENT_TYPE|||
|TABLESPACE_NAME|||
|EXTENT_ID|||
|FILE_ID|||
|BLOCK_ID|||
|BYTES|||
|BLOCKS|||


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

DBA_EXTENTS不能显示以下信息：

- TEMP/SWAP/UNDO表空间的信息
- 不能显示回收站里的对象的extent信息。


##   [5. Detail Design （详细设计）](#5-detail-design-详细设计)  

**X$USED_EXTENTS**

该FIX TABLE展示object segment的每一个extent的信息

|字段|字段类型|描述|
|---|---|---|
|TABLESPACE_ID|||
|SEG_FILE_ID|||
|SEG_BLOCK_ID|||
|EXTENT_ID|||
|EXTENT_FILE_ID|||
|EXTENT_BLOCK_ID|||
|EXTENT_BLOCK_NUM|||


通过x$used_extents fixed table查看所有的extent。

第一层：遍历系统表(SEG$)，查到每一个对象的主segment。

第二层： 每查到一个对象，把这个对象的每一个segment(针对列表的多个segment)的每一个extent信息查到，组织成一行数据。

segment提供从指定位置开始查询多个extent信息的能力，一次查询多个extent。

DBA_EXTENTS通过联合查询x$used_extents和DBA_EXTENTS，展示每一个extent的详细信息。

###   [5.1 DBA视图](#51-dba视图)  

**SYS_DBA_SEGS**

该视图展示TABLE, INDEX, LOB，AC这些有存储对象的segment详细信息，视图通过seg$， v$tablespace等系统表和视图获取segment的详细信息。

|字段|字段类型|描述|
|---|---|---|
|OWNER|||
|SEGMENT_NAME|||
|PARTITION_NAME|||
|SEGMENT_TYPE|||
|TABLESPACE_ID|||
|TABLESPACE_NAME|||
|HEADER_FILE|||
|HEADER_BLOCK|||
|BYTES|||
|BLOCKS|||
|EXTENTS|||


**DBA_EXTENTS**

该视图展示segment的每一个extent的详细信息，通过SYS_DBA_SEGS和X$USED_EXTENTS联合查询展示每一个segment extent的详细信息。

###   [5.2 USER视图](#52-user视图)  

**SYS_USER_SEGS**

该视图展示TABLE, INDEX, LOB，AC这些有存储对象的segment详细信息，视图通过SYS_OBJECTS，seg$， v$tablespace等系统表和视图获取segment的详细信息。

|字段|字段类型|描述|
|---|---|---|
|SEGMENT_NAME|||
|PARTITION_NAME|||
|SEGMENT_TYPE|||
|TABLESPACE_ID|||
|TABLESPACE_NAME|||
|HEADER_FILE|||
|HEADER_BLOCK|||
|BYTES|||
|BLOCKS|||
|EXTENTS|||


**USER_EXTENTS**  该视图展示segment的每一个extent的详细信息，通过SYS_DBA_SEGS和X$USED_EXTENTS联合查询展示每一个segment extent的详细信息。  **回收站里的对象不显示**

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

**验证各个对象的segment信息能否都显示出来**

- 行表，列表 带Lob
- btree/rtree/column 索引
- AC


测试重点验证列表的冷数据热数据都有的场景下能否正确显示

以上对象的分区，二级分区

正确性验证：

- 与DBA_SEGMENTS对比，是否所有的segment都包含了
- 与v$datafile里统计出来的used blocks对比，是否数量是对的
- 不要开回收站，目前回收站在DBA_SEGMENTS里面会显示，但是在DBA_EXTENTS里不显示


**验证各种DDL之后，SEG$的维护是否正确**

- ADD/DROP/SPLIT分区，二级分区
- 各种对象TRUNCATE之后，SEG$维护是否正确


##   [7. 资料设计章节](#7-资料设计章节)  

视图资料描述

##   [8. TODO (遗留问题)](#8-todo-遗留问题)  