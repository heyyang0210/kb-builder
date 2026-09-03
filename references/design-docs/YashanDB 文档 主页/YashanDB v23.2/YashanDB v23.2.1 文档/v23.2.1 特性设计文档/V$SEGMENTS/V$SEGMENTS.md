Created by 江祉涵, last modified on 一月 06, 2024

sr链接：    [https://jira.yasdb.com/browse/YDBRD-23701](https://jira.yasdb.com/browse/YDBRD-23701)  

  


##   [1. Overview（概述）](#1-overview概述)  

提供heap,以及tac表,lsc表关于segment数据的空间占用查询。包括表所对应的index，lob的segment的数据空间

##   [2. Features（功能特性）](#2-features功能特性)  

主要提供以下两部分：

单机提供V$SEGMENTS视图（open状态可用），分布式下提供DV$SEGMENTS视图。

```
select * from V$SEGMENTS;

```

一个表一行记录，显示segment对应类型以及大小。

|视图|描述|备注|
|---|---|---|
|V$SEGMENTS|查询不同segments的类型以及大小|会显示每个segment所属的表的名称|
|DV$SEGMENTS|分布式查询各个节点不同segments的类型以及大小|会显示每个segment所属的表的名称|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CodResult ankFtSegmentsFetch(AnkCursor* cursor);

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

为加快视图查询速度，当前不统计ac。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Display（字段展示）](#51-display字段展示)  

**v$segments**

|字段|字段类型|描述|备注|
|---|---|---|---|
|table_name|VARCHAR(64)|segments所属表名||
|owner|VARCHAR(64)|segments所属用户名||
|tablespace_name|VARCHAR(64)|segments所属表空间||
|segment_name|VARCHAR(64)|segment名称||
|partition_name|VARCHAR(64)|若为分区类型则为分区名否则为NULL||
|segment_type|VARCHAR(18)|segments类型|一共有九种类型|
|bytes|BIGINT|segment所占空间大小||
|blocks|BIGINT|segment所占空间页面数||
|extents|BIGINT|segment所占空间extents数目||


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

通过依次遍历tab$,ind$,lob$,tabpart$,indpart$,lobfrag$获得对应所需的segment，再根据objid获取对应dataoid，根据spaceid，entry，dataoid计算出对应的blocks和extents，再根据block_size计算出对应的bytes

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,1. 热slice数据统计在哪个视图    
  2. 与分布式确认视图最终的使用方法,Posted by jiangzhihan at 十二月 25, 2023 14:57|
|---|
