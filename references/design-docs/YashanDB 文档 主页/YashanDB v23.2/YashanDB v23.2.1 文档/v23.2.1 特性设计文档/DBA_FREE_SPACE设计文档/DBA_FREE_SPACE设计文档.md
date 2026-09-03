Created by 马程飞, last modified on 十一月 15, 2023

SR链接：    [YDBRD-21584](https://jira.yasdb.com/browse/YDBRD-21584?src=confmacro)    -  支持DBA_FREE_SPACE视图，查看表空间和数据文件空闲空间信息  完成

  


#   [一.Overview (概述)](#一overview-概述)  

支持DBA_FREE_SPACE视图，可以查询表空间内各个数据文件的空间空闲信息。

#   [二.Features(功能特性)](#二features功能特性)  

- 显示数据库所有ONLINE数据文件的空闲空间信息
- 视图详细字段如下图：


|Column|Datatype|NULL|Description|
|---|---|---|---|
|  `TABLESPACE_NAME`  |  `VARCHAR(64)`  |  
|Name of the tablespace containing the extent|
|  `FILE_ID`  |  `NUMBER`  |  
|Absolute file number of the data file containing the extent|
|  `BLOCK_ID`  |  `NUMBER`  |  
|Starting block number of the extent|
|  `BYTES`  |  `BIGINT`  |  
|Size of the extent (in bytes)|
|  `BLOCKS`  |  `NUMBER`  |  
|Size of the extent (in Oracle blocks)|
|  `RELATIVE_FNO`  |  `NUMBER`  |  
|Relative file number of the file containing the extent|


#   [三.Interfaces(接口)](#三interfaces接口)  

  `SELECT * FROM DBA_FREE_SPACE;`  

#   [四.Specification And Constraints (规格与约束)](#四specification-and-constraints-规格与约束)  

- OFFLINE TABLESPACE或 OFFLINE DATAFILE是OFFLINE不会显示任何EXTENT空闲记录
- 如果数据文件没有任何空闲空间(FREE BLOCKS为0)，则该视图中不会有任何关于该文件的EXTENT空闲记录
- 只统计表空间当前未分配的EXTENT，在回收站中未归还的EXTENT不统计入该视图


#   [五.Detail Design(详细设计)](#五detail-design详细设计)  

####   [5.1（创建动态视图v$FREE_SPACE为DBA_FREE_SPACE提供所需数据，V$FREE_SPACE的结构如下):](#51创建动态视图vfree-space为dba-free-space提供所需数据vfree-space的结构如下)  

|Column|Datatype|NULL|Description|
|---|---|---|---|
|  `TS#`  |  `NUMBER`  |  
|Id of the tablespace|
|  `FILE_ID`  |  `NUMBER`  |  
|Absolute file number of the data file |
|  `BLOCK_ID`  |  `NUMBER`  |  
|Starting block number of the free space|
|  `BLOCKS`  |  `NUMBER`  |  
|Size of the free space|


####   [5.2(v$FREE_SPACE实现方法)：](#52vfree-space实现方法)  

- 遍历各个表空间下的数据文件，读取数据文件的MAP BLOCK，bitmap上每一段连续的0即代表一个空闲块(不能超过当前文件大小)
- 代表空闲块的一组bit中首个bit所代表的extent的首个block id作为该空闲块的start block id
- 累加这些bit所代表的页面数，作为该空闲块的blocks
- 如果单个文件包含多个空闲块，在每个空闲块统计后需要记录上一个空闲块的start block id和blocks用于后续查找空闲块的起始位置


####   [5.3 创建DBA_FREE_SPACE](#53-创建dba-free-space)  

```
CREATE OR REPLACE VIEW DBA_FREE_SPACE(TABLESPACE_NAME,FILE_ID,BLOCK_ID,BYTES,BLOCKS,RELATIVE_FNO) 
AS SELECT TS.NAME,DF.ID,FS.BLOCK_ID,FS.BLOCKS * DB.BLOCK_SIZE, FS.BLOCKS,DF.RELATIVE_FNO
FROM SYS.V$DATABASE DB,SYS.V$TABLESPACE TS,SYS.V$DATAFILE DF,SYS.V$FREE_SPACE FS
WHERE TS.ID == FS.TS# AND DF.TS# = DF.TS# AND DF.ID = FS.FILE_ID
ORDER BY TS.ID, FILE_ID, BLOCK_ID
```

####   [5.4 （兼容性）](#54-兼容性)  

- 特性新增DBA视图


#   [六.Testcases(自测用例）](#六testcases自测用例)  

- SELECT * FROM V$DBA_FREE_SPACE;
- CREATE TABLESPACE MCF DATAFILE 'MCF' SIZE 4M AUTOEXTEND ON NEXT 1M MAXSIZE 1G EXTENT UNIFORM SIZE 1M;
- CREATE TABLE MCF(A CHAR(2000), B CHAR(2000)) TABLESPACE MCF;
- INSERT INTO MCF VALUES('SDSD','CVVVC');
- INSERT INTO MCF SELECT * FROM MCF;
- SELECT * FROM DBA_FREE_SPACE WHERE TABLESPACE_NAME = 'MCF';


#   [七.资料设计章节](#七资料设计章节)  

DBA视图资料

#   [八 TODO （遗留问题）](#八-todo-遗留问题)  

- 补齐统计回收站中对象未归还EXTENT的能力


## Comments:

|  [](null)  ,参与人员：马志宏、陆世杰、朱国旭、刘大境,  
,评审意见：,1.完善资料,2.补充自测用例、覆盖多场景,3.在高并发场景下验证视图性能,Posted by machengfei at 十二月 11, 2023 19:52|
|---|
