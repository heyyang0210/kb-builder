Created by 马程飞, last modified on 四月 14, 2023

#   [一.概述](#一概述)  

当前YASDB刷脏页时是按照脏页在脏页队列中的顺序，将这些脏页挨个拷贝到dbwr的flush buffer中，等到buffer满或者脏页队列没有脏页时将buffer中的页面统一刷盘，每次仅写一个页面，脏页队列上的脏页是乱序的，这样写的效率很低，如果把脏页队列上物理相邻的页面合并，将这些脏页一起拷贝到buffer中，在刷盘时可以一次写入多个页面，有效提升刷盘效率

#   [二.功能特性](#二功能特性)  

```
* 在进行脏页IO合并时需要指定寻找的neighbor个数（包含中心脏页），通过参数DBWR_FLUSH_NEIGHBORS_COUNT 设置，设置立即生效

* 参数默认值为16，范围是[1,64]，1代表关闭合并

` ALTER SYSTEM SET DBWR_FLUSH_NEIGHBORS_COUNT = 32 SCOPE = MEMORY;` 

```

#   [三.接口](#三接口)  

  `static void dbwrPrepareCkptBlocks(AnkHandler* handler, DbwrManager* dbwrm, CodUint64* maxLfn)`  

  `static void dbwrHandleDtyBlock(AnkHandler* handler, DbwrManager* dbwrm, BufferCtrlBase* ctrl, BufferCtrlBase* ctrlNext, CodUint64* maxLfn, CodBool* needExit, CodBool* nextIsFlushed)`  

#   [四.详细设计](#四详细设计)  

###   [当前ckpt刷盘时将脏页拷贝到flushBuffer中的简要流程图：](#当前ckpt刷盘时将脏页拷贝到flushbuffer中的简要流程图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a35a1ad9a3311dc7b91/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQWdBQUNBQUFBQUFBQUlBQUFBQUFDQUFBQUFBQVFBQkFBQUFBSUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE3MjQsImV4cCI6MTc4MjIyMjUyNH0.uLGj-7zrjA4e4BCzXDXyoggfJxGIUEEFaR6zB78gN1g)

###   [脏页合并流程相较上述流程的变化](#脏页合并流程相较上述流程的变化)  

- 上述流程是按照全局脏页队列的顺序每次copy一个脏页到flushBuffer的流程，合并时只是需要根据每个中心ctrl寻找一批邻居页面进行处理
- 中心ctrl被unlatch之后根据参数指定的DBWR_FLUSH_NEIGHBORS_COUNT 处理这批邻居页面
- 根据DBWR_FLUSH_NEIGHBORS_COUNT 和中心ctrl的blockId确定起始处理的页面firstBlockId,前后各占一半
- 从firstBlockId开始，过滤后再进行latch


###   [合并前后对比简图如下](#合并前后对比简图如下)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a358970c2af4f51fd1b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQWdBQUNBQUFBQUFBQUlBQUFBQUFDQUFBQUFBQVFBQkFBQUFBSUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE3MjQsImV4cCI6MTc4MjIyMjUyNH0.uLGj-7zrjA4e4BCzXDXyoggfJxGIUEEFaR6zB78gN1g)

###   [问题及解决方案](#问题及解决方案)  

#####   [question1: ctrlNext推进](#question1-ctrlnext推进)  

- 脏页队列中的下一个脏页: ctrlNext，布尔变量 : nextIsFlushed 表示ctrlNext指向的脏页是否在本批页面中被拷贝
- 根据firstBlock和count依次累加尝试拷贝，如果发现有ctrlNext所指向的页面，则赋值nextIsFlushed为true
- 每当一个由currCtrl寻找的一批页面被拷贝结束后，根据nextIsFlushed值获取下一个中心ctrl,nextIsFlushed ? queue.head : ctrlNext;
- 在每个脏页都能一次摘掉的情况下，currCtrl一定是脏页队列上第一个未被拷贝过的脏页，此时currCtrl具有有序性
- 如果存在没在ctrlNext后面的脏页没能一次摘下的情况，则可能出现本次prepare重复摘的情况


#####   [question2: 有些脏页加锁没加上没能成功摘掉，旧的逻辑是通过统计lastSkip来保证设置正确的ckptEnd](#question2-有些脏页加锁没加上没能成功摘掉旧的逻辑是通过统计lastskip来保证设置正确的ckptend)  

- 由于旧的逻辑是按照脏页队列上的顺序来处理，因此每次摘页面失败都可以实时更新lastSkip,在处理到ckptEnd的时候设置ckptEnd等于lastSkip并退出本次prepare
- 引入合并后摘脏页的顺序是乱序的，因此无法正确统计lastSkip,新的策略是每次摘ckptEnd之前先设置ckptEnd = ckptEnd->dtyPrev
- 假如ckptEnd->dtyPrev == NULL，设置needExit为true,退出本次prepare


#####   [question3: prepareCkptBlocks退出判断条件](#question3-prepareckptblocks退出判断条件)  

- 由于currCtrl具有有序性，则在拷贝页面时有两种情况时设置needExit为true,退出本次prepare


1.ctrlNext == NULL

2.dbwrm->blockCnt >= dbwrm->capacity

#####   [question4: 存在一些脏页是isDirty但是还未加到全局脏页队列上，这些脏页需要跳过](#question4-存在一些脏页是isdirty但是还未加到全局脏页队列上这些脏页需要跳过)  

- 在从脏页队列上摘掉后修改isDirty为false的同时设置ctrl->truncPoint.asn = 0
- 这样这些未加到全局脏页队列上的脏页就可以区分
- 直接判断dirty和readonly


###   [合并脏页示例图](#合并脏页示例图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396a35a1ad9a3311dc7b92/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBRUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUJBQUFFQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQWdBQUNBQUFBQUFBQUlBQUFBQUFDQUFBQUFBQVFBQkFBQUFBSUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE3MjQsImV4cCI6MTc4MjIyMjUyNH0.uLGj-7zrjA4e4BCzXDXyoggfJxGIUEEFaR6zB78gN1g)

###   [并发控制](#并发控制)  

- 和表空间删除并发，整个prepare都在ckptm->lock锁内，删除表空间在预备阶段也会加该锁摘脏页，可以做到并发控制


#   [五.测试用例](#五测试用例)  

测试方法

show parameter DBWR_FLUSH_NEIGHBORS_COUNT;select * from x$parameter where name = '_DBWR_SORT_ENABLED'

select value from v$sysstat where name = 'DBWR CHECKPOINT BUFFER WRITES';select value from v$sysstat where name = 'DISK WRITES';

查询统计信息方式：select * from v$sysstat where name like 'DBWR FLUSH NEIGHBORS COUNT%';

#   [六.（TODO）](#六todo)  

## Attachments:

[合并图.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMzU4OTcwYzJhZjRmNTFmZDE3IiwicmVmX2lkIjoiNjczOTZhMzU3MjgyMDZlZmI5MmVmYmFkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNzIzLCJleHAiOjE3ODIyOTgxMjN9.J3g7PwAf-I1aDWxU0l6Y-snUUmJq3WNWUaWxLPSsPQc)

 (image/png)    


[next推进.drawio (3).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMzU4OTcwYzJhZjRmNTFmZDE4IiwicmVmX2lkIjoiNjczOTZhMzU3MjgyMDZlZmI5MmVmYmFkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNzIzLCJleHAiOjE3ODIyOTgxMjN9.Xdjgy8hx-vVSPc6-JMH0WIrv775e-FAFP8DSYHaRWuk)

 (image/png)    


[next推进.drawio (4).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMzVhMWFkOWEzMzExZGM3YjkwIiwicmVmX2lkIjoiNjczOTZhMzU3MjgyMDZlZmI5MmVmYmFkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNzIzLCJleHAiOjE3ODIyOTgxMjN9.SK_scjnUX2_rShrzu-I-W1jH1u_OSJzfR9N_GH5SXIc)

 (image/png)    


## Comments:

|  [](null)  ,1.参数改成dbwr_neighbor_search_conunt,2.Search neighbor,前后各search_conunt/2 个页,3.unlatch之后再去search neighbor,4.neighbor处理完之后，next更新两种情况，一种是preDty→next ，一种是lishHead,Posted by machengfei at 二月 20, 2023 11:49|
|---|
|  [](null)  ,5.sort加个隐藏参数,Posted by machengfei at 二月 20, 2023 11:52|
