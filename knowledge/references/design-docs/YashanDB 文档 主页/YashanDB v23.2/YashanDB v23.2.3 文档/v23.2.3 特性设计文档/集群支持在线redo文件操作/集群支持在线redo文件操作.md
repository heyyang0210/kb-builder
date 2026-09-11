Created by 黄杨波, last modified on 五月 15, 2024

#   [YDBRD-25891 : 集群支持在线redo文件操作](#ydbrd-25891--集群支持在线redo文件操作)  

  [https://pingcode.yasdb.com/pjm/items/6621e50afd997db58add56bc](https://pingcode.yasdb.com/pjm/items/6621e50afd997db58add56bc)    ?#YDBRD-26516 集群支持在线redo文件操作

##   [1. Overview（概述）](#1-overview概述)  

目前集群下实例的redo file是在建库时指定，无法新建或删除。本需求支持集群下实例在线增删redo file。

##   [2. Features（功能特性）](#2-features功能特性)  

集群下执行alter database add/drop logfile在线增删本实例redo file。

##   [3. Interfaces（接口）](#3-interfaces接口)  

1. 沿用单机alter database add/drop logfile在线增删本实例redo file
1. 完善现有v$logfile视图，支持查询所有实例的redo文件信息（包括在线离线实例）


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 沿用单机语法
1. 本需求仅支持在线增删本实例的redo file
1. 后续集群支持扩容需要支持在线增删其他实例的redo file（仅限于离线实例）


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 方案实现](#51-方案实现)  

####   [5.1.1 方案设计](#511-方案设计)  

#####   [add redo file](#add-redo-file)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d83a1ad9a3311dc91bb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBSklJQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBaEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFJQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg5MjAsImV4cCI6MTc4MjMxOTcyMH0.RKJh8wTPOi910oNYc5NYggp7z9mzkrXQvYwkCDZD0Z8)

1. 如果操作的是离线实例，reload ctrl redo和boot ctrl，需要更新filem、logm->maxFileCount
    1. 如果是操作其他的离线实例，reload并且更新filem是为了后续遍历filem确认文件名是否已存在等操作的准确性，因为其他实例也会操作该离线实例，并且没同步
    1. 如果是操作本实例，同样也需要reload，虽然filem是准确的，用不上，但后续分配global id时，需要遍历redo页面，假设原本自己所在的页面已满，则需要遍历其他页面的使用情况，这个时候就需要更新
1. 校验与backup并发、校验文件名是否存在（filem最新）、校验文件size
1. 遍历filem获取local id
1. 如果操作的是本实例，reload ctrl redo和boot ctrl，需要更新filem、logm->maxFileCount（离线实例一开始已经reload过，不需要reload）
1. 遍历所有ctrl redo，找到合适的页面，并在页面里找到合适的槽位，获取到global id
1. 校验global id和logm->maxFileCount，大于等于进行扩容
1. 初始化redo file ctrl、创建redo文件、初始化redo head、开启文件监控
1. 暂停ckpt推点，记录逻辑日志LOGT_ADD_REDOFILE，开启原子操作更新bootCtrl→itemCounts[CTRL_REDO_FILE]数目、更新ctrl文件中对应的ctrlId上的RdFileCtrl信息，刷新控制文件，结束原子操作，恢复ckpt推点，有多少个redo文件就循环多少次，不需要同步到其他实例
    1. 操作本实例，此时实例在线，不会有其他实例访问其redo（包括在线恢复），若该实例后续故障，master会访问其redo，此时会主动reload redo，创建文件原子操作进行了几个，就能看到几个，符合预期
    1. 操作离线实例，需要保证离线实例此时无法并发加入集群
        1. 若离线实例正常关闭，master不会访问其redo，无并发问题
        1. 若离线实例异常关闭，master此时会并发访问其redo（为离线实例创建的redo都是未使用过的，过程中在线恢复访问到已创建的多少个都没关系，因为不会使用）
1. 注册filem内存信息，不需要同步
    1. 操作本实例，只有master在线恢复会访问，此时会主动reload更新filem
    1. 操作离线实例，master在线恢复访问，主动reload更新filem。离线实例后续拉起，实例初始化时会遍历ctrl redo重新构筑filem


#####   [drop redo file](#drop-redo-file)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d84a1ad9a3311dc91bc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBSklJQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBaEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFJQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg5MjAsImV4cCI6MTc4MjMxOTcyMH0.RKJh8wTPOi910oNYc5NYggp7z9mzkrXQvYwkCDZD0Z8)

1. 如果操作的是离线实例，reload ctrl redo和boot ctrl，需要更新filem、logm->maxFileCount
    1. 如果操作的是离线实例，reload并且更新filem是为了后续遍历filem确认文件名是否已存在等操作的准确性，因为其他实例也会操作该离线实例，并且没同步
    1. 如果操作的是本实例，则不需要reload，因为自己的filem一定是准确的，且后续不涉及分配global id
1. 校验与backup并发、校验文件名是否存在（filem最新）、是否满足删除条件（redo文件状态、最小redo数量等）
1. 关闭文件监控、关闭文件
1. 暂停ckpt推点，记录逻辑日志LOGT_DROP_REDOFILE，开启原子操作更新bootCtrl→itemCounts[CTRL_REDO_FILE]数目、更新ctrl文件中对应的ctrlId上的RdFileCtrl信息，刷新控制文件，结束原子操作，恢复ckpt推点只能删除一个文件，只会做一次，不需要同步到其他实例
    1. 操作本实例，此时实例在线，不会有其他实例访问其redo（包括在线恢复），若该实例后续故障，master会访问其redo，此时会主动reload redo，能否可见取决于删除是否成功
    1. 操作离线实例，需保证离线实例此时无法加入集群
        1. 若离线实例正常关闭，master不会访问其redo，无并发问题
        1. 若离线实例异常关闭，master会并发访问redo，由于此时redo文件状态小于RDLOG_FILE_ACTIVE，过程中无论是否删除成功，master是否可见，都不会使用该redo


#####   [v$logfile视图](#vlogfile视图)  

1. reload ctrl redo和boot ctrl，更新filem、logm->maxFileCount
1. 遍历所有filem，reload redo head信息，需要上全局锁控制读写并发，全局锁为[instId, type]，粒度为实例级别
    1. v$logfile读redo head上共享锁
    1. rdSaveFileHead写redo head上排他锁
    1. 当v$logfile要访问某个实例所有的redo head时，该实例不能并发写自己的redo head，但此时其他实例是允许并发写自己的redo head，因为此时不涉及他们的redo head并发读
1. 在上述redo ctrl和redo head reload完毕后，遍历所有的filem将redo信息打印
1. v$logfile字段保持不动，唯一的区别是可以通过v$logfile查询所有实例的redo file（离线在线实例）


![](https://pingcode.yasdb.com/atlas/files/public/67396d848970c2af4f521349/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBSklJQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBaEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFJQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQ0FBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg5MjAsImV4cCI6MTc4MjMxOTcyMH0.RKJh8wTPOi910oNYc5NYggp7z9mzkrXQvYwkCDZD0Z8)

#####   [在线恢复过程中处理add/drop的逻辑日志](#在线恢复过程中处理adddrop的逻辑日志)  

1. add/drop redo file在逻辑日志刷盘完成、更新redo ctrl后，在恢复ckpt推点前更新instCtrl->ddlSyncLsn，确保在线恢复时能正确识别该逻辑日志的状态
1. 在线恢复过程中，扫到了add/drop redo file的逻辑日志，且大于instCtrl->ddlSyncLsn，证明该日志需要在线恢复
    1. 对于add redo file而言，此时文件已经创建完毕，redo ctrl可能更新也可能没更新
    1. 对于drop redo file而言，redo ctrl可能更新也可能没更新，文件一定没删除（就算instCtrl->ddlSyncLsn等于该逻辑日志，文件也可能没删除，但redo ctrl肯定已经更新，此时不需要在线恢复，因为该文件已经脱离数据库，后续手动删除即可）
1. 在线恢复前，先将控制add/drop redo file并发的gls lock mark recovery，确保在线恢复过程中，其他实例无法进行add/drop redo file
1. mark recovery完毕后，针对不同的逻辑日志进行不同的操作
    1. add redo file，更新redo ctrl即可
    1. drop redo file，更新redo ctrl，删除redo文件
1. 取消mark recovery，其他实例可以正常申请gls lock进行add/drop redo file


#####   [并发问题讨论](#并发问题讨论)  

reload只会在三处进行：

1. 在线恢复
1. 增删redo
1. v$logfile查询


reload需要全程持有logm->flushLock spinLock、ctrlGlobalLock、ctrlLocalLock控制并发，保证reload的信息正确

reload、增删flush（add/drop redo）、普通flush(recycle、switch redo)三者间的并发

1. reload和普通flush
    1. reload和本地普通flush并发
        1. reload过程中，全程持有logm->flushLock spinLock控制recycle并发
        1. reload过程中，全程持有ctrlLocalLock，控制switch并发
        1. 先上logm->flushLock spinLock、ctrlGlobalLock、ctrlLocalLock，与recycle上锁顺序保持一致，避免死锁
    1. reload和远端普通flush并发
        1. 全程持有ctrlGlobalLock，此时其他实例进行远端普通flush时，无法并发更新redo ctrl，确保读出来的信息是完整的
        1. reload出来的情况取决于远端普通flush的redo ctrl更新到什么情况
1. reload和增删flush
    1. reload和本地增删并发，全程持有logm->flushLock spinLock、ctrlGlobalLock、ctrlLocalLock
        1. 本地增删执行到更新ctrl文件前，reload加载到增删前的样子
        1. 本地增删执行到更新ctrl后，更新filem前，reload加载到增删后的样子，并提前更新filem
        1. 本地增删执行到更新filem后，reload做一次重复覆盖
    1. reload和远端增删并发：
        1. 全程持有ctrlGlobalLock，此时其他实例进行远端增删时，无法并发更新redo ctrl信息，确保读出来额信息是完成完整的
        1. reload出来的redo ctrl信息和本地增删并发类似，加载的情况取决于对端的redo ctrl更新到什么情况
1. 增删flush和普通flush
    1. 增删和recycle，增加和recycle不冲突，删除和recycle有logm->flushLock spinLock控制并发
    1. 增删和switch，增加和switch不冲突，删除和recycle的redo status状态不冲突


#####   [TODO](#todo)  

1. 给离线实例增删redo文件需要限制离线实例（扩缩容再做）
1. 极端情况下，redo ctrl页面有大量空洞，达不到使用规格


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

|test case|result|
|---|---|
|数据库nomount、mount、open进行增删redo、查询v$log操作|open下才能增删redo、至少mount下才能查询v$log|
|实例A进行增删redo操作本实例redo，实例B查询v$log|执行成功，实例B查询结果和实例A的操作预期一致|
|多实例v$log查询和正常业务并发(增删redo、backup、redo切换等)|全部执行成功，v$log结果不一定与操作预期一致|
|多实例并发增删redo操作|全部执行成功|
|多实例redo操作和正常业务并发|全部执行成功|
|多实例redo操作和backup业务并发|只有一个操作能执行成功|
|多实例redo操作和故障、在线恢复并发|执行成功|
|多实例redo操作和启停并发|执行成功|


##   [7.资料设计章节](#7资料设计章节)  

涉及资料说明支持集群在线操作本实例redo file

## Attachments:

[image2024-5-11_17-10-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODM4OTcwYzJhZjRmNTIxMzQyIiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.XhtTf1ui_rnuiRPYmSJbMpxo_b5Yip_KQ1h1-HghyVA)

 (image/png)    


[image2024-5-11_17-23-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODNhMWFkOWEzMzExZGM5MWI1IiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.AwG3XLPc-vem2M0en1dQSaUvb2WDxtuTzB_6eINUXkQ)

 (image/png)    


[image2024-5-13_10-3-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODNhMWFkOWEzMzExZGM5MWI2IiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.riAZsDy9O2cT58sNqEFuZJVRzlQi17N5b0XhEmlV04o)

 (image/png)    


[image2024-5-13_10-7-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODM4OTcwYzJhZjRmNTIxMzQzIiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.uADgMIDy52dV1aqOUw4B8BY1wzh_dpfTHM5AWnno_Ps)

 (image/png)    


[image2024-5-14_9-46-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODM4OTcwYzJhZjRmNTIxMzQ0IiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.iklphsvkysgwJHHdFuh9dK9PBa4arH97scSI3xC7qUs)

 (image/png)    


[image2024-5-14_9-51-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODNhMWFkOWEzMzExZGM5MWI5IiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.eecdkxgFEfr3o3wkTX_xqXsd3Y3C7WxklfQM1ZlT1JM)

 (image/png)    


[image2024-5-14_9-53-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODM4OTcwYzJhZjRmNTIxMzQ3IiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.lU7BF1tMkwwJ3nN6jVfl48j3MRlQYjYBw0XjFLTJ1L8)

 (image/png)    


[image2024-5-14_9-53-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODNhMWFkOWEzMzExZGM5MWJhIiwicmVmX2lkIjoiNjczOTZkODM3MjgyMDZlZmI5MmYxZmU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4OTE5LCJleHAiOjE3ODIzOTUzMTl9.QOBSc4awWaGLT7FnTXvJO8y-Rois_x33wlBWT85Nuvc)

 (image/png)    


## Comments:

|  [](null)  ,THREAD#、STATUS、NAME、BYTES 、BLOCKSIZE,Posted by zhuguoxu at 五月 13, 2024 20:57|
|---|
