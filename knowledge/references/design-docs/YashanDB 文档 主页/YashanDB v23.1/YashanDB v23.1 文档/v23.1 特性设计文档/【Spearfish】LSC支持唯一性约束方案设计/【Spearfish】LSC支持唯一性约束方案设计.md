Created by 陈宜顺, last modified on 十月 12, 2023

JIRA：[    [YDBRD-12905] LSC表支持唯一性约束](https://jira.yasdb.com/browse/YDBRD-12905)  

##   [1. Overview（概述）](#1-overview概述)  

深圳通POC需求，CDC工具需要去重能力，用于检查冲突并进行处理。需要支持LSC表为某个列字段定义唯一约束项，表示要求该列字段上的值在当前表中无重复，当该列字段上已存在重复的数据时，无法成功添加此约束项。

##   [2. Features（功能特性）](#2-features功能特性)  

|支持特性名称|不支持特性名|
|---|---|
|建表指定唯一约束（create table）|add constraint using index语法|
|添加唯一性约束（alter table add constraint）|索引语法（create/alter/drop index）|
|修改唯一性约束（alter table modify constraint）|disable primary key cascade keep index|
|删除唯一性约束（alter table drop constraint）|分布式场景不支持enable/disable constraint语法|
|约束指定形式：行内，inline_constraint|分布式场景不支持modify constraint语法|
|约束指定形式：行外，out_of_line_constraint||
|primary key语法（行内、行外）||
|分布式形态，分布式下唯一键必须是分布键的一部分||
|创建的index默认是invisible的||
|disable primary key cascade drop index||


##   [3. Interfaces（接口）](#3-interfaces接口)  

添加/删除唯一性约束的语法与行表/TAC表保持一致。

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 唯一性约束仅用于去重，不能用于索引查询，执行计划通过特殊接口感知（YDBRD-14145中提供）
1. 不支持索引语法（create/alter/drop index）
1. 不支持add constraint using index语法
1. 分布式场景不支持enable/disable constraint语法、不支持modify constraint语法


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 逻辑Slice到物理Slice映射关系](#51-逻辑slice到物理slice映射关系)  

由于SliceId在作为value写入Btree的时候应该保持稳定，不能频繁修改，在写入Btree的时候，需要提供一个逻辑的SliceId，以下称SliceLogicId

为了复用RowId结构体的DataOid槽位，SliceLogicId是全表范围内（跨分区）分配的，在系统表中维护SliceLogicId到物理SliceId的映射关系，引入系统表：

```
CREATE TABLE TABSIM$
(
    BO#             BINARY_BIGINT       NOT NULL,
    LOGIC_ID#       BINARY_BIGINT       NOT NULL,    
    DATAOID#        BINARY_BIGINT       NOT NULL,    
    SLICE_ID        BINARY_INTEGER      NOT NULL,
) SYSTEM 162 ORGANIZATION HEAP
/

CREATE UNIQUE INDEX I_TAB_SIM1 ON TABSIM$(BO#, LOGIC_ID#)
/
CREATE INDEX I_TAB_SIM2 ON TABSIM$(DATAOID#, SLICE_ID)
/

```

1. 从VGD写入的时候，每创建一个VGD，分配一个SliceLogicId
1. 从RGD写入的时候，每写入一个slice，也分配一个SliceLogicId
1. SliceLogicId与某个vgd的sliceId或者coast的sliceId对应
1. 发生转换时，SliceLogicId不变，修改SliceLogicId到sliceId的映射关系
1. 通过表的Oid和SliceLogicId可以确定这个slice是哪个分区下的哪个slice，当发生drop表或者drop分区的时候，把对应表或者分区下的记录删除。
1. TABSIM$维护的是逻辑Slice到物理Slice映射关系，逻辑SliceId在表内是顺序增长的，与数据存储格式如MCOL或者SCOL无关，因此转换后逻辑SliceId也不变。
1. 每个VGD在加载DC的时候需要维护自己的逻辑sliceId编号，方式为找TABSIM$系统表，由于物理sliceId到逻辑sliceId为一对多关系，需要找最大的逻辑Id作为当前VGD的SliceLogicId


###   [5.2 RowId格式](#52-rowid格式)  

1. 拟写入Btree的RowId与行表写入的Btree的RowId格式比较


![](https://pingcode.yasdb.com/atlas/files/public/67396af98970c2af4f52005c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUlBQUFBQUFBQUFBQUFBQUJBQUFFQUVBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFDQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFDQUFBQkFBQUFBQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0NDUsImV4cCI6MTc4MjMwMTI0NX0.g4mZRLTemNUlbyfQElSgZQGwmHNCKnupF84doDslWds)

特点：

- 唯一且不变
- 由生成时决定
- 可以保证LSC表的某一行的唯一性
- 逻辑RowId暂不能回表查询，以后如有需要，则按需提供回表能力


1. 对RowId的改造


- 要点：SliceLogicId为64位，复用RowId中dataOid的槽位，布局如下：


![](https://pingcode.yasdb.com/atlas/files/public/67396af9a1ad9a3311dc7ed3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUlBQUFBQUFBQUFBQUFBQUJBQUFFQUVBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFDQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFDQUFBQkFBQUFBQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0NDUsImV4cCI6MTc4MjMwMTI0NX0.g4mZRLTemNUlbyfQElSgZQGwmHNCKnupF84doDslWds)

1. 格式描述


![](https://pingcode.yasdb.com/atlas/files/public/67396af9a1ad9a3311dc7ed5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUlBQUFBQUFBQUFBQUFBQUJBQUFFQUVBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFDQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFDQUFBQkFBQUFBQUFBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA0NDUsImV4cCI6MTc4MjMwMTI0NX0.g4mZRLTemNUlbyfQElSgZQGwmHNCKnupF84doDslWds)

###   [5.3 写入时Btree的处理](#53-写入时btree的处理)  

1. openCursor时，需要新增rowId的辅助列
1. spfMultiInsert时，需要确定当前写入记录对应的sliceId，可能存在跨slice的情况，需要处理
1. spfMultiInsert后，需要往rowId辅助列写入SliceRowId
1. 调用idxListInsert写入btree


###   [5.4 更新时Btree的处理](#54-更新时btree的处理)  

1. swfUpdate更新数据。
1. 如果当前更新的是热数据，则通过VGD的DC直接可以拼出Btree的SliceLogicId + rowId
1. 如果当前更新的是冷数据，则需要通过key进行一次btree fetch，获得Btree的SliceLogicId + rowId
1. idxListUpdate更新Btree的Key


###   [5.5 删除时Btree的处理](#55-删除时btree的处理)  

1. swfDelete删除数据
1. 如果当前更新的是热数据，则通过VGD的DC直接可以拼出Btree的SliceLogicId + rowId
1. 如果当前更新的是冷数据，则需要通过key进行一次btree fetch，获得Btree的SliceLogicId + rowId
1. idxListDelete删除Btree的Key


###   [5.6 回Slice处理（暂不实现）](#56-回slice处理暂不实现)  

当物理SliceId发生变化（如转换）时，需要维护SliceMap的关系。但是逻辑SliceId是没有发生变化的。

slice合并和删除的处理：

slice删除场景，对应的Btree里面的记录也会被删掉，但逻辑SliceId不复用

slice合并场景，老的逻辑SliceId在btree中不变，新写入的sliceId使用新的逻辑SliceId

回slice能力才会用到sliceMap，目前暂时不支持回Slice能力。

###   [5.7 Bulkload场景导入的处理](#57-bulkload场景导入的处理)  

Bulkload和非Bulkload场景都走的是spfMultiInsert接口，btree的处理在spfMultiInsert之后，因此不需要特殊处理。

###   [5.8 后建/删唯一约束](#58-后建删唯一约束)  

后建唯一约束：需要先检查该列字段上是否已存在重复的数据，适配indexFillSegment

后删唯一约束：和行表一致，不需要特殊处理

###   [5.9 需要特殊处理的DDL](#59-需要特殊处理的ddl)  

创建的index默认是invisible的，

其它参考第四节功能限制

###   [5.10 导入导出](#510-导入导出)  

- imp/exp工具支持，需要验证功能正确性
- loader工具支持，包括客户端和服务端模式


###   [5.11 分布式场景](#511-分布式场景)  

分布式场景分布键需要包含在唯一键里面，即分布键需要是唯一键的子集

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 建表时带唯一约束
1. 建表通过alter命令添加唯一约束
1. 空表场景添加唯一约束
1. 非空表场景添加唯一约束
1. 添加/删除/修改主键
1. 不支持场景拦截


##   [7. Workload（工作量）](#7-workload工作量)  

评估代码量KLOC、工作量（人周）。

|模块|任务|工作量|
|---|---|---|
|btree|模块整改|1人周|
|lsc|支持唯一键|1人周|
|lsc|添加sliceIdMap|1人周|
|lsc|索引语法拦截及自测|1人周|


##   [8. TODO（遗留问题）](#8-todo遗留问题)  

说明本方案遗留的问题或下一步需要解决的问题。

1. 需要支持根据sliceIdMap的回表查询


## Attachments:

[1681368623482.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjhhMWFkOWEzMzExZGM3ZWM4IiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.t6xFag9fMYdFkcJ1R_9i1LSBAFWSxaZytVKy25ZU2_s)

 (image/png)    


[1681368519597.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjg4OTcwYzJhZjRmNTIwMDUyIiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.7Pcw3ApXpzvDaZd_H1h3qi4imAMNToTYXOnfsvUD3k0)

 (image/png)    


[image2023-4-18_17-7-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjg4OTcwYzJhZjRmNTIwMDUzIiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.pYEY3CJSexfPMXn-9cYklwbzJQUSR-b9xgjvWuAd-7M)

 (image/png)    


[image2023-4-18_17-18-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjhhMWFkOWEzMzExZGM3ZWNhIiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.3NHyFOANkmzu052dZ05Q5xH05UNYpxNU6Remgg67t8Y)

 (image/png)    


[image2023-4-24_19-37-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjg4OTcwYzJhZjRmNTIwMDU0IiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.NHlsBjM4oraj7k95-_OusPoW7U1yKG3YHVYrEzsli4o)

 (image/png)    


[image2023-4-27_15-48-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjhhMWFkOWEzMzExZGM3ZWNjIiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.7cNpDB9McYqjyymWDwKPZKo5dyrfrwmwcmcy_yrXsfA)

 (image/png)    


[image2023-4-27_15-55-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjhhMWFkOWEzMzExZGM3ZWNlIiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.fuJ5q80JAZPEdPRiSHvWT3IlfUnhdTosjhTCdt6sMT8)

 (image/png)    


[image2023-4-27_16-0-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjk4OTcwYzJhZjRmNTIwMDU2IiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.f4nKgwIDbqGtOMSi4RGjvoOlGLjsSZZVf7f4H1k8QOQ)

 (image/png)    


[image2023-4-27_16-3-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjk4OTcwYzJhZjRmNTIwMDU3IiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.hX-qbcNVwFx26fBk9z7WrBYLrhFIsoewUjFG1OFYwdk)

 (image/png)    


[image2023-4-27_16-9-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjlhMWFkOWEzMzExZGM3ZWNmIiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.eAeme5c7UtLPEVI7lAswCoWGJXg2PH6mkqK1Xnd5nYg)

 (image/png)    


[image2023-4-27_16-3-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjlhMWFkOWEzMzExZGM3ZWQwIiwicmVmX2lkIjoiNjczOTZhZjg3MjgyMDZlZmI5MmVmZmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNDQ1LCJleHAiOjE3ODIzNzY4NDV9.GRGwOpZ94qmPVUt5KoIYUwnCqqWObBpXERvjX3YIepA)

 (image/png)    


## Comments:

|  [](null)  ,1. table fetch -> key     
  2. btree fetch -> logicSliceId +     
  rowId（冷数据需要）    
  3. 拼btree key    
  4. table delete/update,Posted by chenyishun at 四月 28, 2023 10:30|
|---|
