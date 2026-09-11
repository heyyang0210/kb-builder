Created by 黄文早, last modified on 七月 13, 2023

  


#   [Insert On Duplicate Update Design](#insert-on-duplicate-update-design)  

  [https://jira.yasdb.com/browse/YDBRD-14029](https://jira.yasdb.com/browse/YDBRD-14029)  

##   [1. Overview（概述）](#1-overview概述)  

​	深圳通需求，需要支持insert into ... on duplicate update

​	LSC支持insert into... on duplicate update功能

##   [2. Features（功能特性）](#2-features功能特性)  

​		lsc 支持insert into duplicate update 功能

##   [3. Interfaces（接口）](#3-interfaces接口)  

​	sql语法

  [https://conf.yasdb.com/display/~wangyibo/insert+on+duplicate](https://conf.yasdb.com/display/~wangyibo/insert+on+duplicate)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 不允许修改分区键（与行表一致）
1. 仅支持单张表的insert（与行表一致）
1. 不支持对视图操作（与行表一致）
1. set_clause之后不可以出现where filter（与行表一致）
1. 当表上有多个独立的唯一约束时，仅更新与原表唯一冲突的第一条记录（与行表一致）
1. 唯一约束的声明顺序不同，会导致结果不稳定（与行表一致）
1. 分布式set 语句中不允许出现复杂子查询


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

####   [功能分析](#功能分析)  

​		有以下场景：表中有一个主键，当插入一条数据时发现，主键已存在表中，放弃插入，转为更新表中冲突的记录。

​		以一个具体场景为例子，在一个系统中，有多个用户，每个用户都有一个唯一的id表示，需要记录某个用户发生车祸的次数。只有少数用户会发生车祸，如果为每个用户都创建一条记录，存储代价太大。如果不创建记录，就得在业务层先查询是否已经存在用户的记录，再去更新这条记录，那就变成了两条语句，更新还可能失败，需要重试，导致业务层代码变得复杂。有了insert on duplicate key update，就可以通过一条语句完成复杂的业务逻辑，并且保证原子性。

####   [执行流程](#执行流程)  

​		 insert on duplicate update执行流程如下。语句先执行插入，如果插入报错，存储返回一个rowid。通过这个rowid 去fetch，如果fetch不到数据，行可能已经被其他事务删除，重新执行插入，如果fetch 到数据，则对该行加锁，如果没锁到行，行可能已经被其他事务删除，重新执行插入，锁到行后，行也可能和报错冲突时不一样，徐涛通过插入行和锁到的最新行，判断插入行是否和锁到的罪行行冲突，如果冲突，则update，不冲突则重新插入。

![](https://pingcode.yasdb.com/atlas/files/public/67396a398970c2af4f51fd2f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE4ODUsImV4cCI6MTc4MjIyMjY4NX0.xm4EoNaYNoFjoMVP2XW4elqpzkJ8RAWkmdffpKcrxdM)

####   [LSC 实现](#lsc-实现)  

​		lsc 对外应该与其他表一致，冲突后返回一个物理的rowid。由于索引中存储的rowid是逻辑row id，需要将在报错时，将逻辑row id转换成报物理row id。

​		可以返回物理row id 后，lsc 表的执行流程与tac/heap表一致。只是经过fetch，锁行之后，如果锁到了行，且行在冷数据中，lsc表不需要进行检查是否还会冲突。

####   [索引根据逻辑row id 获取物理row id](#索引根据逻辑row-id-获取物理row-id)  

​	每次冲突根据逻辑row id ，索引列和冲突行，获取物理row id。扫描系统表，获得逻辑slice id 所在的物理slice id。如果物理slice id 未发生过变化，则可以直接转换为物理row id，如果发生了变化，根据索引列，以及插入的行，对索引中的每个列，生成一个range pont，组合成range set，作为条件，以查询到的slice id作为scan range，在表中扫描，过滤后得到一行，和这一行的物理row id。

####   [force push down](#force-push-down)  

​	执行条件全部在存储内部进行过滤，对于一些之前不支持行过滤的条件，列存需要支持。在range set 上加forcePushDown字段，存储必须accept。现在列存已经具有除lob列外的所有数据类型的等值过滤能力。无额外工作量。

####   [存储支持is null 下推](#存储支持is-null-下推)  

​		索引中的值可能有null值，因此，列存需要支持IS NULL 下推。is null 下推不需要经过filter，把block的 null bitmap 取反即可返回结果。由于coast zonemap 无null值信息，is null 不参与block级别和slice 级别过滤。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

​		sql用例，null值下推ut用例。

##   [7. Document（资料）](#7-document资料)  

  [https://conf.yasdb.com/display/~wangyibo/insert+on+duplicate](https://conf.yasdb.com/display/~wangyibo/insert+on+duplicate)  

##   [8. Workload（工作量）](#8-workload工作量)  

​		10 pd

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## Comments:

|  [](null)  ,分布式拦截子查询在执行层做,Posted by huangwenzao at 七月 13, 2023 15:28|
|---|
|  [](null)  ,#### 存储内部支持    [ is null 下推](https://conf.yasdb.com/pages/viewpage.action?pageId=119550559#%E5%AD%98%E5%82%A8%E6%94%AF%E6%8C%81is-null-%E4%B8%8B%E6%8E%A8)  ,Posted by huangwenzao at 七月 13, 2023 15:43|
