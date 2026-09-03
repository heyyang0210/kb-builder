Created by 汪少华, last modified by  许中立 on 一月 30, 2024

#   [session worker Design（XXX方案设计）](#session-worker-designxxx方案设计)  

  [https://jira.yasdb.com/browse/YDBRD-12979](https://jira.yasdb.com/browse/YDBRD-12979)  

##   [1. Overview（概述）](#1-overview概述)  

在分布式环境中，不对worker的使用实现精准的限制，会出现一些死锁问题，为了更好地管理worker，避免死锁问题的出现，对于会话的worker使用需要更加准确的控制，合理地控制并发数。

场景描述：

#####   [模型1：常态活动会话很多，负载任务超出系统负担 ----- 不是正常场景，需要扩资源或者调整业务](#模型1常态活动会话很多负载任务超出系统负担-------不是正常场景需要扩资源或者调整业务)  

#####   [模型2：单CN的业务会话较多，常态活动会话很多，负载任务不会超出系统负担（短平快的任务居多）](#模型2单cn的业务会话较多常态活动会话很多负载任务不会超出系统负担短平快的任务居多)  

1. CN必须使用共享模式，CN侧收编worker线程开销
1. max sessions配置大于max workers
1. CN的连接池的数量使用max workers，降低配置复杂度(DN的压力通过CN的连接池收编)
1. CN共享模式会导致资源争抢，会一定程度影响执行效率，不会导致业务失败（其它特性的超时机制除外）
1. DN使用专用模式，解决调度死锁问题，以及DN上资源管控因为线程切换导致的性能问题


#####   [模型3：单CN的业务会话较多，常态活动会话有限，负载任务不会超出系统负担](#模型3单cn的业务会话较多常态活动会话有限负载任务不会超出系统负担)  

1，2，3， 5 同模型 2

1. CN共享模式会导致资源争抢
1. 4.1 小概率出现活动会话很多，事务（或查询）执行时间长的任务较多（CN共享模式会导致排队，部分执行等待时间较久，影响用户体验，不会产生失败），系统慢慢消化波峰；
1. 4.2 小概率出现活动会话很多，事务（或查询）执行时间长的任务少，同模型2 （CN共享模式会导致争抢，会影响执行效率，执行快速切换，不会产生失败）


#####   [模型4：单CN的业务会话较少，常态活动会话更少，负载任务不会超出系统负担，模型等同于模型3](#模型4单cn的业务会话较少常态活动会话更少负载任务不会超出系统负担模型等同于模型3)  

#####   [模型5：单CN的业务会话较少，常态活动会话接近，负载任务不会超出系统负担](#模型5单cn的业务会话较少常态活动会话接近负载任务不会超出系统负担)  

1. CN可以使用专用模式（类比）
1. max sessions配置 <= max workers
1. DN使用专用模式，解决调度死锁问题，以及DN上资源管控因为线程切换导致的性能问题


##   [2. Features（功能特性）](#2-features功能特性)  

1. 大量业务并发时不会出现死锁卡住的场景
1. 单个CN最大执行并发数受配置参数max_workers影响，多CN总并发数暂时不做处理，由用户自发设置
1. 小概率出现负载超出系统负担导致资源争用的控制问题，通过资源管控CPU与IO进行管控的IR进行解决，波峰由系统慢慢消化


##   [3. Interfaces（接口）](#3-interfaces接口)  

对外接口无调整。

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 要求DN上的参数配置，必须和CN相协同(需要DN上的max_worker >= CN max_workers 之和) 由配置实现控制
1. CN限制只允许使用共享模式（简化用户配置复杂度）


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

关于OB的连接管理，线程管理的调研。

设计要点：

1. CN data connection连接池与CN max worker数相等，DN使用专用模式，DN会话数 = 各CN data connection连接池之和，解决调度死锁问题，以及DN上资源管控因为线程切换导致的性能问题
1. 引入活跃会话概念，表示占有worker的会话，DN的max workers需要慎重考虑，针对业务特点，以及DN硬件能力判断进行调优
1. 会话建立连接和上一次断联合并，减少消息的交互


###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b348970c2af4f5202aa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBRUJCQUFBSUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE4OTcsImV4cCI6MTc4MjMwMjY5N30.KBScl0AROicIfQZQP-GZnSnzXNeJJ4AMrqTp_yEWytc)

![](https://pingcode.yasdb.com/atlas/files/public/67396b34a1ad9a3311dc8122/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBRUJCQUFBSUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE4OTcsImV4cCI6MTc4MjMwMjY5N30.KBScl0AROicIfQZQP-GZnSnzXNeJJ4AMrqTp_yEWytc)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

CN端的主要改变：

1. 默认开启共享模式，max_reactor_channels 默认为1，会话释放流程有所调整，采用reactor激发的方式
1. 会话上未绑定事务，采用争抢的方式释放会话，有新的会话进来在等待，会释放自身的会话


>   引入问题，jdbc保活机制，和共享模式有部分冲突——解决：针对保活会话采用长链接模式    同时并发长查询（事务），会导致新的会话连接进不来，此时对外表现出可连接数= max_workers  

>   争抢的方式，需要维护一个活跃会话数，当活跃会话超过max_worker数，需要其他会话主动释放，worker上需要绑定globalSid  

DN端主要改变：

1. DN上使用专有模式，对于每一个创建的会话绑定一个会话（可以来自池，或者自我创建）
1. DN端max_session和max_worker受CN配置影响，max_sessions = max_workers = 各个CNmax_worker之和


>   如果来自线程池，线程池是否还需要受max_workers创建，不受限可能导致线程池持续处于高水位状态（优化，增加最优线程池参数，超出部分采用临时创建的方式，或增加回收机制）  

>   如实现redo解绑，是否还需要保留这两个参数在DN上的效果  

```
// 任务1 CN端实现共享模式
CodResult dstbSubmitTask(AnlHandler* handler, CodPointer runResponseTask)
{
	// 加latch锁，判断是否绑定worker
	// 无worker 等待计数 + 1
	// 提交任务
}; 

static inline CodBool anrYieldWorker(AniWorker* worker, AnrSession* session)
{
	// 判断是否有事务
	// 无事务，判断是否有等待会话
	// 有则退出，等待计数 -1;
}

// 任务2：DN端实现专有模式，不缓存session info信息，多CN仍保持原来创建会话的模式

CodBool anrCheckQueueAndExit(AniWorker* worker, AnlHandler* handler)
{
	// 去除事务存在判断
	// 去除DDL delay clean done 判断
	// 一个会话直到释放前长期持有该线程。
}


// 异常场景及状态，采取多状态模式，导致状态存在并发设置的场景，对于异常事件的上报，通过isConnected标记来判断是否发生过网络异常，发送失败仅设置EXECUTE_ERROR


```

配置实例说明：

拉起集群为1mn 3cn 3dn（三个主）

每个CN均设置max_sessions=100 和 max_workers =10

结果，每个DN对应的max_worker均需要10 * 3， 对应的max_sessions均需要 10 * 3；

当查询分布式视图时，CN上的最大峰值也会达到max_workers =

影响评估：

max_reactor_channels 默认为1

max_workers配置在windows下（CN端也必须开启专有模式），要求必须大于max_sessions

配置max_sessions，对于CN扩容有较大影响：

>   1.DN上不做max_sessions的设置，其他关联设置，需要实现解绑参数依赖    2.对于DN上的handler存在，因并发突然的增大，导致handler总数变大，考虑实现回收机制    3.对于max_sessions的配置，是否需要实现扩大设置不重启  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

针对各函数的ut测试，提升看护能力。

CN大量会话并发压力测试，验证切换worker工程无故障。

CN大量会话，间杂频繁的事务操作，耗时较长的查询操作（分钟级别），验证效率没有明显的下降。

部分常见故障，并发场景（单节点挂掉，switch over）能够正常的响应和恢复。

较可能存在问题的点，会话的部分资源创建在网络线程，如果在网络线程出现排队（大量会话同时创建），可能存在部分连接建立超时的场景

##   [7. Document（资料）](#7-document资料)  

1.标注DN上的max_sessions, max_workers支持配置

2.CN上的max_workers范围值调整，目前为【8，16368】，未实现

3.对于涉及长查询，多事务并发场景，推荐如何配置，未实现

4.max_reactor_channels在CN上有所调整，配置为0，代表使用默认值1；

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

1. windows系统不支持共享模式，要求max_workers > max_sessions
1. 辅助功能：线程号绑定会话，增加DFX能力
1. 限制多CN间的连接，避免同时创建过多的线程
1. 暂不考虑对于小查询的响应时间的提升
1. handler，worker提供回收机制


## Attachments:

[image2023-5-11_16-45-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzNhMWFkOWEzMzExZGM4MTFjIiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODk3LCJleHAiOjE3ODIzNzgyOTd9.gUrVfAtMr8vIEwhGrUDhT0ZZ2-KxIZmKsE-PEWkufSU)

 (image/png)    


[image2023-5-11_11-57-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzM4OTcwYzJhZjRmNTIwMmE3IiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODk3LCJleHAiOjE3ODIzNzgyOTd9.QiIUdq78Cgh4FwpPJqor8ccd5yMxN7vvkiklYAKdK84)

 (image/png)    


[image2023-5-11_11-53-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzNhMWFkOWEzMzExZGM4MTFkIiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODk3LCJleHAiOjE3ODIzNzgyOTd9.--9SoHm9pQBVcDBt8Nh-ojUX-1eBls-pwfGYWF2W3nA)

 (image/png)    


[image2023-5-11_10-42-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzM4OTcwYzJhZjRmNTIwMmE4IiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODk3LCJleHAiOjE3ODIzNzgyOTd9.-S1hD1AOH0gFZr9rI0jEKLecJelmEGGzZQC4Z036o1Q)

 (image/png)    


[image2023-5-11_10-42-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzRhMWFkOWEzMzExZGM4MTFlIiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODk3LCJleHAiOjE3ODIzNzgyOTd9._ZT5vFrMQpwPxRkPwHAsT8UIjYWRLSp7ZkUnGpyU1Xo)

 (image/png)    


[image2023-5-17_9-29-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzQ4OTcwYzJhZjRmNTIwMmE5IiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODk3LCJleHAiOjE3ODIzNzgyOTd9.ouDk9ZpwH1vKs_U19_udpIR6Rb2ufuy32D1WZ-VVPYo)

 (image/png)    


[image2023-5-17_9-30-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzRhMWFkOWEzMzExZGM4MTIxIiwicmVmX2lkIjoiNjczOTZiMzM3MjgyMDZlZmI5MmYwMmQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxODk3LCJleHAiOjE3ODIzNzgyOTd9.ZWKAoJjbK-Ev00Vw0a6lMM6JDPjj1FHu2L2rHD1pZyA)

 (image/png)    
