Created by 林永豪, last modified on 十一月 15, 2023

SR链接：    [YDBRD-15258](https://jira.yasdb.com/browse/YDBRD-15258?src=confmacro)    -  DBLINK的集群化改造  完成

#   [YDBRD-15258: Dblink Rac Design（集群支持dblink 特性设计）](#ydbrd-15258-dblink-rac-design集群支持dblink-特性设计)  

##   [1. Overview（概述）](#1-overview概述)  

集群环境下支持使用dblink

##   [2. Features（功能特性）](#2-features功能特性)  

- 放开dblink对集群的拦截，集群下支持dblink的使用
- 集群中一个实例上CREATE/ALTER （PUBLIC）DBLINK后可以在其它实例上使用DBLINK。
- 集群中一个实例上DROP （PUBLIC）DBLINK后其它实例上也不能使用。
- 集群中dblink并行DDL无core。


##   [3. Interfaces（接口）](#3-interfaces接口)  

无对外提供接口

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 创建dblink不可以指定集群实例名，因为现阶段C驱动接口还不支持识别集群实例名称
- 因为是在yashan集群的场景下，所以仅支持yashan->yashan的dblink和yashan->oracle的dblink
- 在集群中，一个实例做了commit，其它实例不会做commit。没提交的情况下做DDL，可能触发lock wait timeout, wait time 1 milliseconds报错。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [DBLINK框架](#dblink框架)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ca28970c2af4f520d6d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

###   [对DBLINK的操作语句](#对dblink的操作语句)  

- DDL：create、alter、drop
- DML/DQL：insert、update、delect、select


###   [单机DDL关注信息](#单机ddl关注信息)  

- dict entry：可以理解为访问dblink信息的入口，从handler->kernel->dictm.entryMngr上分配。
- smart entity：承载dblink信息（连接信息、用户信息等）的实体，从userDict->smartMngrs[SMART_DICT_DBLINK]上分配。首先看freeItems空闲链表上是否有，没有就从memory分。


###   [遵守原则](#遵守原则)  

- DDL有两阶段。
- 两阶段之前的工作主要是，修改系统表信息并管理entity的生命周期。
- 两阶段时的工作主要是，做提交或者回滚以及管理entry的生命周期。


###   [DBLINK并发控制](#dblink并发控制)  

- dblink并发使用事务执行锁，对smartEntity结构和oid进行控制
- 事务执行锁的好处，一是能对本地的entity加上X锁或者S锁（锁放入handler->xrm->ddlLocks）,二是在集群下可以锁住全局唯一object id
- 统一以DictEntry进入，锁结构是DictEntry.schLock。DDL的时候上X锁，DictEntry.schLock.xrmid设置当前xrmid。DML/DQL的时候上S锁，DictEntry.schLock.sharedCount++
- 当放X锁（两阶段提交后会强制释放）【commitProc】后，把当前的smartEntity置无效【ankCleanLocksDirectly】（置无效有三种情况，一是放X锁，二是alter的时候将旧版本entity失效，三是drop的时候将旧版本entity失效），然后DictEntry.smartEntity置NULL。下一个使用dblink的会从系统表加载出smartEntity。
- 依赖于yex_server沙箱进程执行，需要每个实例各自拉起自己的yex_server程序，yasdb与yex_server使用UDS通信（依赖YASDB_DATA/instance/yex.ipc文件）
- 先放本地锁，再放集群锁，避免先放集群锁后集群其它节点实行篡改


###   [具体策略和适配](#具体策略和适配)  

|                            并发策略,                  \,语句操作|单机并发策略|集群化适配|
|---|---|---|
|CREATE|1.两阶段前（cmdCreateSmart）：,- 根据dblink名字创建object，并获取object id
- 将dblink信息写入到系统表
- 创建dc entry和dblink entity
- 将系统表中对应dblink信息加载到entity中，加载失败需要free掉entity
- entry和entity都赋值上object id，互相指向
- 注册两阶段信息，写redo
,2.两阶段提交（dcSmartCreateCommit）：,- insert entry index，entry存入user->objHashCtx.hashBufs和handler->kernel->dictm→entryHashBufs
- 放entity的X锁（ankCleanLocksDirectly）
,3.两阶段回滚：（dcSmartCreateRollback）：,- dcReleaseEntry，释放entry，将entry存入handler->kernel->dictm.entryMngr的空闲链表中管理
|1.两阶段前（cmdCreateSmart）：,- 创建过程中使用axcLockRWLock(x)
,2.两阶段提交（dcSmartCreateCommit）：,- 写实例消息，同步create操作
- 结束后放锁，axcUnlockRWlock(x)
,3.两阶段回滚：（dcSmartCreateRollback）：,- 不做适配操作
|
|ALTER|1.两阶段前（cmdAlterSmart）,- 给entity加X锁，entry加spinlock
- 修改系统表中对应dblink object的信息
- 分配新的entity（不直接操作原entity信息，主要是考虑到如果现在entity的ref count不为0说明别人还在使用，不方便篡改）
- 将系统表中新的对应dblink object的信息加载到新的entity中
- 新entity和entry相互指向，entry→version++，释放entry锁
- 旧entity置invalid，close entity，如果ref count为0则free entity
- 注册两阶段信息，写redo
,2.两阶段提交：不做，因为entry没动,3.两阶段回滚：不做,  
,注：,free entity时涉及到对远程exs dblink对象的失效。,exs dblinkinvalidate流程的目的是，在exs侧，将object从hash bucket上面移除，顺便再判断是否refCount等于0，等于0则free object。refCount大于0则说明此时object还被别人持有，由别人在持有结束后调用exs close object将此object refCount减1，减到0则free object|1.两阶段前（cmdAlterSmart）,- smartOpenDictWithLock  取集群锁（gls X锁）和spinlock
,2.两阶段提交（需要新加dcSmartAlterCommit）：,- 写实例消息，同步alter操作
- 结束后放锁，axcUnlockRWlock(x)
,3.两阶段回滚：,- 不做适配操作
|
|DROP|1.两阶段前（cmdDropSmart）,- 给entity加X锁，如果entity→ref count大于1，说明还有其他人在使用，不能做drop，直接报错resource busy
- 将对应dblink object信息从系统表中删掉
- entity置invalid
- close entity，如果ref count为0并且当前entity为失效状态，则free entity
,2.两阶段提交（dcSmartDropReleaseEntry）：,- delete entry index，entry从user->objHashCtx.hashBufs和handler->kernel→dictm→entryHashBufs移除
- 放entity的X锁（ankCleanLocksDirectly）
- （unLockProc）：dcReleaseEntry，释放entry，将entry存入handler->kernel->dictm.entryMngr的空闲链表中管理
,3.两阶段回滚：不做，失败了就不删entry|1.两阶段前（cmdDropSmart）,- smartOpenDictWithLock  取集群锁（gls X锁）和spinlock
,2.两阶段提交（dcSmartDropReleaseEntry，放本地锁之后才做，这里做集群锁释放）：,- 写实例消息，同步drop操作
- 结束后放锁，axcUnlockRWlock(x)
,3.两阶段回滚：,- 不做适配操作
|
|DML/DQL|ankOpenDblink：entity->refCount++,ankCloseDblink：entity->refCount--，若要free则free|ankOpenDblink：  获取集群锁（gls S锁），保证其它实例不会把dblink删除或更改,ankCloseDblink：  axcUnlockRWLock()|


###   [集群下不同实例间并发考虑](#集群下不同实例间并发考虑)  

|                 实例n,            \,实例0|CREATE |ALTER |DROP|DML/DQL|
|:---|:---|:---|:---|:---|
|CREATE |OBJ$唯一约束|gls X锁|gls X锁|gls X锁|
|ALTER|OBJ$唯一约束|gls X锁|gls X锁|gls X锁|
|DROP |如果是先create后drop，entry已经是存在的状态，所以会报错。,如果是先drop后create，DROP消息通过oid删除后，不影响|gls X锁。集群X锁同一个oid是互斥的（  AXC_CB->axcLockRWLock  ）。获取锁后会因为oid一致而报错。,  
|gls X锁。集群X锁同一个oid是互斥的。获取锁后会因为oid一致而报错。|gls X锁。集群X锁同一个oid是互斥的。获取锁后会因为oid一致而报错。|
|DML/DQL|entry存在,OBJ$唯一约束|gls S锁,保证DML/DQL正常执行，过程中dblink不被更改。|gls S锁,保证DML/DQL正常执行，过程中dblink不被删除。|可以并发执行|


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

- typedef struct StDictEntry DictEntry;
- typedef struct StSmartEntity SmartEntity;


![](https://pingcode.yasdb.com/atlas/files/public/67396ca28970c2af4f520d6e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca28970c2af4f520d6f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca28970c2af4f520d70/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

加上两个DFX视图，V$DBLINK_OBJ_STAT以及V$DBLINK_MEM_STAT

![](https://pingcode.yasdb.com/atlas/files/public/67396ca28970c2af4f520d75/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca3a1ad9a3311dc8be8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca38970c2af4f520d77/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

###   [5.5 其他](#55-其他)  

###   [代码实现工作量评估](#代码实现工作量评估)  

|工作内容|时间规划（人/天）|
|---|---|
|dcSmartFindEntry接口，集群改写|0.1|
|  
|  
|
|创建dblink接口doCreateSmart，集群改写|0.1|
|创建的两阶段提交接口dcSmartCreateCommit，集群改写|0.1|
|创建的两阶段回滚接口dcSmartCreateRollback，集群改写|0.1|
|  
|  
|
|修改dblink接口doAlterSmart，集群改写|0.1|
|修改的两阶段提交接口dcSmartAlterCommit，集群改写|0.1|
|修改的两阶段回滚接口dcSmartAlterRollback，集群改写|0.1|
|  
|  
|
|删除dblink接口doDropSmart，集群改写|0.1|
|删除的两阶段提交接口dcSmartDropReleaseEntry，集群改写|0.1|
|删除的两阶段回滚接口dcSmartDropRollback，集群改写|0.1|
|  
|  
|
|DML/DQL，open/close dblink接口，集群改写|0.1|
|  
|  
|
|msgCreateObject中dcSyncSetEntry，dblink无额外动作适配|-|
|msgAlterObject中dcSyncAlterEntity，dblink额外适配|0.1|
|msgDropObject中dcSyncDropEntity，dblink额外适配|0.1|
|  
|  
|
|applyCreateSmart，集群改写|0.1|
|applyAlterSmart，集群改写|0.1|
|applyDropSmart，集群改写|0.1|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

起集群环境自测

- 实例0成功创建dblink，实例n可以正常使用dblink
- 实例0没有成功创建dblink，实例n不能正常使用dblink
- 实例0成功删除dblink，实例n上验证该dblink已经不存在
- 实例0没有成功删除dblink，实例n上验证该dblink还存在
- 实例0成功更改dblink，实例n上验证该dblink已经发生变更
- 实例0没有成功更改dblink，实例n上验证该dblink没有发生变更
- 实例0做DML/DQL，实例n上不能把该dblink删掉
- 实例0做DML/DQL，实例n上不能更改该dblink
- DDL/DML/DQL并发测试，无core


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

##   [9. 附图](#9-附图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ca2a1ad9a3311dc8be3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca2a1ad9a3311dc8be4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca2a1ad9a3311dc8be5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca28970c2af4f520d73/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca28970c2af4f520d75/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca3a1ad9a3311dc8be8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

![](https://pingcode.yasdb.com/atlas/files/public/67396ca38970c2af4f520d77/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUF3QUFBQUFBSURFUkJBZ0FBQUlBQUFBZ0FBQUFBQUJnQUJBQUFFQUFRUVFnQUVTQUJBQUFBSUFBQUFBQUFBQWtRQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFDQUFBQ2dBQUFBQUdBRUFBQUFJQWdBQWdBQUFBQUpRSUFNQUFNQUFwQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFNRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDIwMzYsImV4cCI6MTc4MjMxMjgzNn0.kLjsd9y8vMvMYuGiQU5uK5uqpPAdPhfb8Ym-ndurRAg)

## Attachments: