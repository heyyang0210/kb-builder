Created by 龙忠友, last modified by  孟凡彬 on 五月 15, 2023

  


#   [YDBRD-13473 : 共享集群支持remote CR](#ydbrd-13473--共享集群支持remote-cr)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-12140](https://jira.yasdb.com/browse/YDBRD-12140)  

##   [1. Overview（概述）](#1-overview概述)  

在YashanDB结构设计中，对于数据的访问可以通过块的一致性读(CR)完成。CR block是一种特殊的block，其不一定是历史上存在的，其对当前访问可以提供一致性读的能力，即CR block上只“存储”了对当前访问可见的数据。存储通过current block + query scn可以生成一个对当前查询可见的CR block。CR block在缓冲区buffer pool中管理，其与current block访问机制类似，区别是CR一旦生成后是不会产生修改的，且CR只在内存中有效，不会写盘。

在集群模式下，相对于单机，block的生命周期复杂了很多，一个block不在当前实例中时，可能在其他实例中；即使在当前实例中，block也可能是个past copy或者无效block。如果继续沿用单机CR的方式，每次获取CR block，都要先获取一个current block，其代价是非常大的，且并不是每一次CR block读后都会修改此block。因此考虑引入新的机制，当发生CR请求时，如果current block不在本地且在其他实例，此时通过CR Transfer的机制完成一致性读，避免无效的block传输。

##   [2. Features（功能特性）](#2-features功能特性)  

- 提供CR请求转换为本地读盘的能力，当current block不在本地，且不在其他实例，发生的CR的请求可以直接读盘。
- 提供远程实例构建CR block的能力，当current block不在本地，且在其他实例，发生的CR请求可以路由在其他实例，由其他实例构建CR block返回。
- 提供CR请求的并发访问，协调多个实例之间同时对同一个block的CR 访问。


##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 函数接口](#31-函数接口)  

|接口名称|说明|
|---|---|
|gcsRequestCrBlock|cr请求，requester调用|
|processReqMasterCrBlock|master处理cr请求|
|closeReqMasterCrBlock|master处理cr请求的闭环消息|
|gcsOwnerSendCrBlock|owner构建CR block并发送|
|gcsAskOwnerSendCrBlock|master要求owner发送CR block|


###   [3.2 通讯消息](#32-通讯消息)  

|消息名称|回调函数|说明|
|---|---|---|
|MSG_WAKEUP_CR_BLOCK_REQUEST|msgWakeupRequest|在处理排队中的消息时，当不属于本线程组处理的消息，需要让对应的线程组去处理|
|MSG_REQ_MASTER_CR_BLOCK|msgReqMasterCrBlock|master处理requester的CR请求|
|MSG_ASK_OWNER_SEND_CR_BLOCK|msgAskOwnerSendCrBlock|owner处理CR block的构建|
|MSG_OWNER_SEND_CR_BLOCK_ACK|msgOwnerSendCrBlockAck|requester处理owner发送的CR block|
|MSG_REROUTE_REQ_CR_BLOCK|msgRerouteReqCrBlock|master处理CR请求的路由消息，当owner不能命中current block时，需要给master路由请求，让master重新找owner去处理|


###   [3.3 配置参数](#33-配置参数)  

|参数|说明|
|---|---|
|_REMOTE_CR_THRESHOLD|隐藏参数，实例持有remote CR block的最大数、默认值 4， [0, 255]； 立即生效|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 不支持消息异常处理。
1. 不支持Memeory mapped tablespace


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

####   [5.1.1 主要数据结构](#511-主要数据结构)  

#####   [CR请求的body数据](#cr请求的body数据)  

```
typedef struct StGcsCrBlockRequest {
    BlockId   id;
    Xid       xid;     
    AnkScn    scn;       //query scn
    CodUint32 ssn;      //statement sequence number
    CodUint8  xIsolevel;   //事务隔离级别
    CodBool   express;   //是否快速请求
    CodBool   is3Way;    //是否三路请求
    CodUint8  unused[3];
    CodUint16 dhtVersion;  //master 版本号
} GcsCrBlockRequest;

```

#####   [CR请求的响应](#cr请求的响应)  

```
typedef struct StGcsCrBlockAck {
    CodBool   is3Way;
    CodBool   express;
    CodUint16 unused;
} GcsCrBlockAck;

```

####   [5.1.2 主要流程](#512-主要流程)  

CR block的处理从消息流程来看，主要有CR 本地读、master发送CR block、owner 发送CR block、master排队CR请求、owner没有current block，owner构建CRblock。现对这些场景的流程做详细说明。

#####   [CR 本地读](#cr-本地读)  

master在处理requester的CR 请求时，如果此时没有实例持有current block，master就会给requester授权，让requester从磁盘读取block，此时CR请求需要发送闭环消息。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1d8970c2af4f5201c1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFFQUVpQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBZ0FnQUFCQUFBQUFBZ0FBZ0JBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQkFBQUFJQUFBQUFBQUJBQ0NBQUFBa0FBQUFBQUFBQUFBRUFBQUFBQUFBRUFJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTEwNDQsImV4cCI6MTc4MjMwMTg0NH0.GTGOAtav206SPcsIrJztHZRDfzWnSZ9De9b6Lzqeaas)

#####   [master 发送CR block](#master-发送cr-block)  

master在处理requester的CR请求时，发现此时有实例持有current block，然后发现master持有，master就直接发送CR block，此时CR请求不需要发送闭环消息。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1d8970c2af4f5201c2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFFQUVpQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBZ0FnQUFCQUFBQUFBZ0FBZ0JBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQkFBQUFJQUFBQUFBQUJBQ0NBQUFBa0FBQUFBQUFBQUFBRUFBQUFBQUFBRUFJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTEwNDQsImV4cCI6MTc4MjMwMTg0NH0.GTGOAtav206SPcsIrJztHZRDfzWnSZ9De9b6Lzqeaas)

#####   [owner 发送CR block](#owner-发送cr-block)  

master在处理requester的CR请求时，发现此时有实例持有current block，且master没有持有，于是要求owner给requester转发CR block，此时CR请求不需要发送闭环消息。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1da1ad9a3311dc8038/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFFQUVpQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBZ0FnQUFCQUFBQUFBZ0FBZ0JBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQkFBQUFJQUFBQUFBQUJBQ0NBQUFBa0FBQUFBQUFBQUFBRUFBQUFBQUFBRUFJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTEwNDQsImV4cCI6MTc4MjMwMTg0NH0.GTGOAtav206SPcsIrJztHZRDfzWnSZ9De9b6Lzqeaas)

#####   [master 排队CR block](#master-排队cr-block)  

master在处理CR 请求时，发现有并发的请求，于是让CR请求进入队列，等上一个请求的闭环消息来在把CR请求pop出来处理，此时CR请求需要发送闭环消息。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1da1ad9a3311dc8039/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFFQUVpQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBZ0FnQUFCQUFBQUFBZ0FBZ0JBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQkFBQUFJQUFBQUFBQUJBQ0NBQUFBa0FBQUFBQUFBQUFBRUFBQUFBQUFBRUFJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTEwNDQsImV4cCI6MTc4MjMwMTg0NH0.GTGOAtav206SPcsIrJztHZRDfzWnSZ9De9b6Lzqeaas)

#####   [owner 没有命中 current block](#owner-没有命中-current-block)  

owner在转发CR block时，发现自己没有current block，则给master回复消息，让master重新找owner去发送CR block，此时CR请求需要发送闭环消息。

![](https://pingcode.yasdb.com/atlas/files/public/67396b1d8970c2af4f5201c4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFFQUVpQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBZ0FnQUFCQUFBQUFBZ0FBZ0JBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQkFBQUFJQUFBQUFBQUJBQ0NBQUFBa0FBQUFBQUFBQUFBRUFBQUFBQUFBRUFJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTEwNDQsImV4cCI6MTc4MjMwMTg0NH0.GTGOAtav206SPcsIrJztHZRDfzWnSZ9De9b6Lzqeaas)

#####   [owner构建CR block](#owner构建cr-block)  

owner在构建CR block时，可能会涉及到多个实例的请求：t1时刻，master 实例2拿到了current block，并写了一条数据，没有committ2时刻，实例3也拿到了current block，也写了一条数据，同样没有committ3时刻，实例1也拿到了current block，没有写t4时刻，实例0请求CR block，master要求实例1转发CR block实例1基于current block开始构建CR block向实例2请求事务状态，并请求undo页面，回滚实例2上未提交的事务。继续向实例3请求事务状态，并请求undo页面，回滚实例2上未提交的事务。最后将构建的block发给实例0

大概流程如下图所示：

![](https://pingcode.yasdb.com/atlas/files/public/67396b1ea1ad9a3311dc803a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFFQUVpQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBZ0FnQUFCQUFBQUFBZ0FBZ0JBQUlBQUFBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQkFBQUFJQUFBQUFBQUJBQ0NBQUFBa0FBQUFBQUFBQUFBRUFBQUFBQUFBRUFJQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFFSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTEwNDQsImV4cCI6MTc4MjMwMTg0NH0.GTGOAtav206SPcsIrJztHZRDfzWnSZ9De9b6Lzqeaas)

###   [5.2 DFX设计](#52-dfx设计)  

本次设计不考虑DFX能力

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

部署三个实例：

1. 实例0执行


```
	create table test (id int);
	insert into test values (1);
	commit;

```

1. 实例1执行


```
	select * from test;
	select * from test;
	select * from test;
	select * from test;
	select * from test;
	select * from test;

```

1. 实例2执行


```
	select * from test;
	select * from test;
	select * from test;
	select * from test;
	select * from test;
	select * from test;

```

1. 实例1、实例2同时执行5次，每一次交互sql语句


```
    --inst 1
	insert into test select 1 from dual connect by level &lt;10000; 
	commit;

   --inst 2
	select * from test;

```

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[taskprocess.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWRhMWFkOWEzMzExZGM4MDJmIiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.02S8lO7zjAIhn9fE4DFOMO1r8e3SvhGnGmVhrR6cDgM)

 (image/png)    


[readmsg.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWQ4OTcwYzJhZjRmNTIwMWI4IiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.x2GYmSF77XVvqdVk-gWSeT4HmspIppsU39wlHjcNKEw)

 (image/png)    


[area_cell.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWRhMWFkOWEzMzExZGM4MDMwIiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.9gDpi1YoiKMnjpsOy9233dF4h8R6-DHFHBAf_g9x7e0)

 (image/png)    


[内存布局.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWQ4OTcwYzJhZjRmNTIwMWI5IiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.o8sC3rS2tDUslOlZ5iJrCiPXZWK7yv_lE0BUciNfKsg)

 (image/png)    


[逻辑视图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWQ4OTcwYzJhZjRmNTIwMWJiIiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.nl4HtD91U3h2hVtqEtl5pDvHt9XI2jXqwjsOY1Fizx0)

 (image/png)    


[task.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWRhMWFkOWEzMzExZGM4MDMxIiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.AyAWFZRJAUhmHOPPAxc9J7XQEzMUYtJHf9X2PuQJFkM)

 (image/png)    


[owners.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWRhMWFkOWEzMzExZGM4MDM1IiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.o711TaOP2Er66SxNJs9cpWb4p_qYNZoEQ3piKU4ix4U)

 (image/png)    


[owners.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWQ4OTcwYzJhZjRmNTIwMWJmIiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.W8Z7cujmKmg5szLtUmxHd3i21mjn0MD94UIlb-NRvio)

 (image/png)    


[master_enqueue_cr_req.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMWRhMWFkOWEzMzExZGM4MDM3IiwicmVmX2lkIjoiNjczOTZiMWM3MjgyMDZlZmI5MmYwMWZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxMDQzLCJleHAiOjE3ODIzNzc0NDN9.U09Sj5_R2Mm1WVoGRp_gNYE1B2nGrwfyR3rrYmHO30s)

 (image/jpeg)    


## Comments:

|  [](null)  ,cr的统计是在requester？owner？,补充三实例查询的流程,Posted by longzhongyou at 五月 12, 2023 11:16|
|---|
