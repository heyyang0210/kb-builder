Created by 张欣, last modified on 十一月 12, 2023

# 1.   **概述**

  [YDBRD-14026](https://jira.yasdb.com/browse/YDBRD-14026?src=confmacro)    -  【2023.1】分布式支持LSC表的归档清理命令  完成

研发设计文档     [LSC冷数据清理方案 - 梁桢灏 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=117671012)  

# 2.   **需求分析**

  [YDBRD-14026 分布式支持LSC表的归档清理命令 - 张欣 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122076144)  

目前，LSC冷数据由于归档模式下，SLICE即作为数据文件又作为REDO文件，因此SLICE不会被真正删除。这样归档后的SLICE在归档清理时无法清理导致磁盘无法回收，占用资源。

本特性实现当归档清理时（手动归档清理，自动归档清理）满足归档清理条件的废弃slice能够在归档清理时被清理

### 背景知识：

**1.slice文件**

1）LSC表的冷数据会存储对应的slice文件，转冷数据需要先开启配置，并通过 alter table xxx ALTER SLICE ALL STABLE; 命令转储。转换后在对应的表空间下，根据表的object_id,可以查看不同版本的slice文件。

alter system set     **_ENABLE_ALTER_SLICE**     = "TRUE" scope=memory;

alter table table_YDBRD_14026_001 ALTER SLICE ALL STABLE;

参考     [slice文件的一生 - 高亚宁 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=89093057)  

  


4

![](https://conf.yasdb.com/download/attachments/89093057/image2022-8-26_18-4-6.png?version=1&modificationDate=1661508247000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFJQUFBQUFBQWdBQUNBQUFBQUJBQUFBQkFBQUFBQUFBQUtBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUVBQUFBQUFBQUFBQUFBQUFRQUFRQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFpQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTksImV4cCI6MTc4MjIxODgxOX0.Fh-F0PiN1_sYZ0BQw__Rw1KmHYgIA2Y2a_SdjnKKfVQ)

2）HA主机的slice文件会和归档文件一样发送给备机。

v$lsc_xfmr_slices 视图中会记录每个slice文件的  **LFN**

![](https://pingcode.yasdb.com/atlas/files/public/673969a6a1ad9a3311dc782c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFJQUFBQUFBQWdBQUNBQUFBQUJBQUFBQkFBQUFBQUFBQUtBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUVBQUFBQUFBQUFBQUFBQUFRQUFRQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFpQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTksImV4cCI6MTc4MjIxODgxOX0.Fh-F0PiN1_sYZ0BQw__Rw1KmHYgIA2Y2a_SdjnKKfVQ)

HA备机当前接收到的最小的  **LFN**  可以通过视图v$archive_dest_status 获取，RECEIVED_LFN 字段

![](https://pingcode.yasdb.com/atlas/files/public/673969a68970c2af4f51f9b6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFJQUFBQUFBQWdBQUNBQUFBQUJBQUFBQkFBQUFBQUFBQUtBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUVBQUFBQUFBQUFBQUFBQUFRQUFRQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFpQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTksImV4cCI6MTc4MjIxODgxOX0.Fh-F0PiN1_sYZ0BQw__Rw1KmHYgIA2Y2a_SdjnKKfVQ)

新增  **ARCH_CLEAN**  系统表中也会记录  **LFN**  , 表删除等操作时同时在ARCH_CLEAN 系统表中记录clean_LFN为slice最新的LFN。

归档清理时，当清理的归档的LFN  小  于ARCH_CLEAN 中的记录（最新一次的记录？）时，可以执行SLICE对应的归档清理进行SLICE文件的删除。？

**ARCH_CLEAN**  记录的清理和slice文件的清理不是同步的。

ARCH_CLEAN 系统表中记录相关可清理的信息，并且归档在各个节点都可以做自己的归档清理，因此ARCH_CLEAN 系统表中记录需要等待所有节点（包括备节点）清理该SLICE后，已清理的全局最小LFN推了后，才可以清理该比该LFN小的记录。

**2.归档清理的几种方式**

  [归档清理 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=64827810)  

条件1：归档日志不被本机回放需要，即小于本机rcy_point点；

1）手动清理

alter database   **DELETE ARCHIVELOG { ALL | UNTIL TIME date_string | UNTIL SEQUENCE asn }**

相关参数：  ARCH_CLEAN_IGNORE_MODE = BACKUP/standby 

忽略备份 如果不忽略，没有备份则不会清理，小于  备份集的最大asn的归档日志才会被清理  。设置为BACKUP表示为true,不会和备份集比较。

忽略备机 单机开归档默认，如果不忽略，  小于备机已归档的连续日志号的日志才能被清理。 设置为standby，不会等待备机同步。

2）自动清理

相关参数

MAX_ARCH_FILES_SIZE：归档日志空间上限，  0表示关闭归档自动清理功能

MIN_ARCH_FILES_SIZE：归档日志空间下限，  0表示自动清理全部符合条件的归档

其他：正在备份的归档不允许清理

  


**3.哪些情况会触发slice归档更新/删除？**

前提条件：开启归档(1.建库时开启 2.alter database archivelog /mount状态下可修改 )

COMPACT，

drop column

drop table,truncate table

分区表删除分区?

drop tablespace,drop database

drop AC

  


4.单机，HA，分布式几种形态下归档删除slice文件

单机：需要打开归档，默认  忽略备机，归档自动清理，手动清理 验证删除情况；

HA：主机，备机，级联备  两种配置下各自的归档删除情况；

故障场景：备机，级联备有一个断联

分布式：slice在DN，区分复制表和分布表

  


5.表类型

普通表

分区表

带AC的表

# 3.   **测试设计方法**

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

slice 文件清理，涉及的场景比较多。所以使用较多是场景分析法。分析可能走到slice归档清理的场景，以及手动清理，自动清理的各种可能情况组合。以及单机，HA主备机，分布式上的不同表现。

  


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

### 4.1 可能会走到slice 清理的场景：

1.SLICE被COMPACT合并，删除无效SLICE    
  语法：

ALTER TABLE table_name ALTER SLICE ALL COMPACT [ ASYNC ]

ALTER TABLE table_name ALTER SLICE ALL CLEAN [ ASYNC ]

先进延迟清理，然后是归档清理    
  可能涉及表的slice清理，AC的失效slice清理

2.drop column（首列，中间列，尾列，drop 多列）    
  3.drop table    
  4.truncate table    
  5.drop tablespace 删除databucket表空间    
  6.drop database （删全库，slice会清理，未走归档清理）    
  8.分区表drop 分区    
  9.drop AC     
  DROP ACCESS CONSTRAINT xx    
  表上建有AC,COMPACT、drop table,drop column,truncate table等    
  drop 后再创建同名对象    
  10.分区表truncate 分区    
  11.alter tablespace drop databucket    
  依赖：需要先drop table

  


### 4.2单机，HA，分布式测试差异点

4.2.1 单机

单机默认不开归档，要验证归档清理，前提需要开启归档，需要在建库时指定。

4.2.2 HA

HA默认开启归档。

1.归档清理参数配置将影响可清理的归档，比较重要，需要覆盖全部配置场景

ARCH_CLEAN_IGNORE_MODE =

  
  NONE:HA默认 不忽略备份和备机    
  BACKUP：忽略备份，主机只清理小于所有备机rcy_point起始点的归档；备机只清理小于所有级联备起始点的归档    
  STANDBY：忽略备机：不会等待备机同步；小于备机已归档的连续日志号的日志才能被清理；没有备份过的不清理。    
  BOTH：忽略备份和备机，可能造成need repair

2.手动归档清理（默认忽略备机）[alter database DELETE ARCHIVELOG]可指定如下三种方式：    
  ALL:全部清理 /ALL force:强制清理    
  UNTIL TIME date_string    
  UNTIL SEQUENCE asn    
  3.自动归档清理 配置如下两个参数触发自动清理    
  ARCH_CLEAN_UPPER_THRESHOLD     
  ARCH_CLEAN_LOWER_THRESHOLD 

4.HA可能的异常场景：

一个备机或者级联备异常

switchover

主机异常，failover选新主

4.2.3 分布式

不支持手动归档清理，只支持自动归档清理；

不同DN上要分别触发清理。

### 4.3slice清理验证方式

验证点1：localfs目录下失效的slice文件被清理

验证点2：arch_data$系统表中的记录清空

### 4.4相关视图

arch_data$

v$sysstat

当清理的归档的LFN大于ARCH_CLEAN 中的记录时，可以执行SLICE对应的归档清理进行SLICE文件的删除。因为记录的LFN大于等于生成SLICE的LFN，SLICE已经被归档备份，因此可删除该SLICE，该SLICE同时也发送到了备机。

但ARCH_CLEAN 系统表中记录相关可清理的信息，并且归档在各个节点都可以做自己的归档清理，因此ARCH_CLEAN 系统表中记录需要等待所有节点清理该SLICE后，已清理的全局最小LFN推了后，才可以清理该比该LFN小的记录。不然存在备机没清理，但删除系统表通过REDO已经在备机回放，导致备机无法删除该SLICE，SLICE残留。

v$sysstat视图中的ARCH DATA LFN值记录当前归档的最新LFN，当  arch_data$中的LFN推到ARCH DATA LFN之前时，即可清理对应的slice文件。当arch_data$中的LFN没有推到ARCH DATA LFN之前时，可以通过做一些业务操作并切换日志来使对应slice文件的LFN前推

![](https://pingcode.yasdb.com/atlas/files/public/673969a68970c2af4f51f9b7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFJQUFBQUFBQWdBQUNBQUFBQUJBQUFBQkFBQUFBQUFBQUtBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUVBQUFBQUFBQUFBQUFBQUFRQUFRQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFpQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTksImV4cCI6MTc4MjIxODgxOX0.Fh-F0PiN1_sYZ0BQw__Rw1KmHYgIA2Y2a_SdjnKKfVQ)

![](https://pingcode.yasdb.com/atlas/files/public/673969a6a1ad9a3311dc782e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFJQUFBQUFBQWdBQUNBQUFBQUJBQUFBQkFBQUFBQUFBQUtBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUVBQUFBQUFBQUFBQUFBQUFRQUFRQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFpQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgwMTksImV4cCI6MTc4MjIxODgxOX0.Fh-F0PiN1_sYZ0BQw__Rw1KmHYgIA2Y2a_SdjnKKfVQ)

  


全部测试内容详见xmind:

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR/testkill|/|
|HA|是|
|压力|/|
|性能|/|
|可维护性|/|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 单机和分布式用例自动化采用guider框架，HA用例自动化采用ha_regress框架。目前框架支持程度满足本需求自动化需求。


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


## Attachments:

[支持LSC表的归档清理命令.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTY4OTcwYzJhZjRmNTFmOWIyIiwicmVmX2lkIjoiNjczOTY5YTU1OTNmOTljOWZmMjM1MGY3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MDE4LCJleHAiOjE3ODIyOTQ0MTh9.O53NrHmla7D2sq_AU1HQMENKa3WQ_KeGoL12_IjsArI)

 (application/x-xmind)    


[支持LSC归档清理.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTZhMWFkOWEzMzExZGM3ODJhIiwicmVmX2lkIjoiNjczOTY5YTU1OTNmOTljOWZmMjM1MGY3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MDE4LCJleHAiOjE3ODIyOTQ0MTh9.LUtBMcM-akK2xdkIjeGEBUVzcqDsyRfc2MmMEa3DTQU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
