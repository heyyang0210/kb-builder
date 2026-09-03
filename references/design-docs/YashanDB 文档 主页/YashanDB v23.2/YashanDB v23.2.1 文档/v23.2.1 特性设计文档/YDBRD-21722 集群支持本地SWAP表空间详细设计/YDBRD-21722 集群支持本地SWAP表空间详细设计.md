Created by 陈宜顺, last modified by  梁荣钦 on 十月 12, 2024

IR:    [YDBRD-20500](https://jira.yasdb.com/browse/YDBRD-20500?src=confmacro)    -  支持本地swap表空间  完成  SR:    [YDBRD-21722](https://jira.yasdb.com/browse/YDBRD-21722?src=confmacro)    -  支持本地swap表空间  完成

##   [1. Overview（概述）](#1-overview概述)  

该需求来源于问题[    [YDBRD-16879] 【RAC集群】收集统计信息性能差，单机用时3分31秒，集群用时2小时43分44秒](https://jira.yasdb.com/browse/YDBRD-16879)  

参见之前的根因分析：

1. 磁阵IO性能较差
1. 单机的swap file有个优化，在open的时候，使用的是非sync模式，也就是swap out的时候只要写入fs缓存，就会返回。因为VM本身就是临时数据，如果进程挂掉或者宕机丢失不会对VM有影响。同时如果swap in的时候，fs缓存大概率会命中，不产生驱动层的IO。
1. 目前集群下swap file也是要通过YFS来管理，因此只能采用direct模式open raw device，每次swap out都是实打实的IO，而且swap in也不会有缓存。所以在产生大量vm swap时，性能差异和单机会很明显。


因此，需要支持本地swap表空间，通过本地文件系统优化集群下的swap file性能问题。

本次需要支持的部署形态为单机、集群，分布式场景用到的是本地文件系统，不需要磁阵环境，因此暂不涉及分布式场景。

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 涉及功能](#21-涉及功能)  

|功能|设计表现|设计说明|
|---|---|---|
|单机：新增SWAP表空间|只支持CREATE SWAP TABLESPACE|全局SWAP表空间只支持本地路径|
|集群：新增SWAP表空间|支持CREATE [LOCAL] SWAP TABLESPACE两种语法|集群本地SWAP表空间支持本地路径和磁阵路径；全局SWAP表空间只支持磁阵路径|
|修改SWAP表空间|支持ALTER TABLESPACE语法|暂不涉及新功能, 能修改现有的属性即可|
|删除SWAP表空间|支持DROP TABLESPACE语法|支持删除SWAP表空间|


###   [2.2 VM表空间切换](#22-vm表空间切换)  

- 可通过    `ALTER SYSTEM SET DEFAULT_SWAP_TABLESPACE = 表空间名字`    更改SWAP表空间信息；


##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 创建SWAP表空间语法](#31-创建swap表空间语法)  

####   [集群场景](#集群场景)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c468970c2af4f520a9e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQmdBQUFnQUFBQUFnQUJBQUFBQUFBQUFBQUFBQUFBQUFBa0lBQUFBQVFBQUFBQUFBQUFBQUFCQUFBQVFBQUFBQUFBQUVBQkFBQUNBQUNBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFJQUVBQUFBQUFBQUFBQUJBQUlBRUlBRUFBQUFnQUFBQUFFQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxMTIsImV4cCI6MTc4MjMxMDkxMn0.V4WkntVZlxX67DynGD6hVC05J7sZPy2j6BF2GnEYIBE)

![](https://pingcode.yasdb.com/atlas/files/public/67396c468970c2af4f520a9f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQmdBQUFnQUFBQUFnQUJBQUFBQUFBQUFBQUFBQUFBQUFBa0lBQUFBQVFBQUFBQUFBQUFBQUFCQUFBQVFBQUFBQUFBQUVBQkFBQUNBQUNBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFJQUVBQUFBQUFBQUFBQUJBQUlBRUlBRUFBQUFnQUFBQUFFQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxMTIsImV4cCI6MTc4MjMxMDkxMn0.V4WkntVZlxX67DynGD6hVC05J7sZPy2j6BF2GnEYIBE)

- 这个是本地TEMP表空间，作为对比，详情参见    [集群支持本地临时表空间详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133584601)  


![](https://pingcode.yasdb.com/atlas/files/public/67396c46a1ad9a3311dc890d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQmdBQUFnQUFBQUFnQUJBQUFBQUFBQUFBQUFBQUFBQUFBa0lBQUFBQVFBQUFBQUFBQUFBQUFCQUFBQVFBQUFBQUFBQUVBQkFBQUNBQUNBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFJQUVBQUFBQUFBQUFBQUJBQUlBRUlBRUFBQUFnQUFBQUFFQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxMTIsImV4cCI6MTc4MjMxMDkxMn0.V4WkntVZlxX67DynGD6hVC05J7sZPy2j6BF2GnEYIBE)

![](https://pingcode.yasdb.com/atlas/files/public/67396c468970c2af4f520aa0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQmdBQUFnQUFBQUFnQUJBQUFBQUFBQUFBQUFBQUFBQUFBa0lBQUFBQVFBQUFBQUFBQUFBQUFCQUFBQVFBQUFBQUFBQUVBQkFBQUNBQUNBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFJQUVBQUFBQUFBQUFBQUJBQUlBRUlBRUFBQUFnQUFBQUFFQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxMTIsImV4cCI6MTc4MjMxMDkxMn0.V4WkntVZlxX67DynGD6hVC05J7sZPy2j6BF2GnEYIBE)

####   [单机场景](#单机场景)  

不支持Local swap space的创建，其余与集群保持一致；

###   [3.2 更改SWAP表空间语法](#32-更改swap表空间语法)  

- 集群与单机一致


![](https://pingcode.yasdb.com/atlas/files/public/67396c46a1ad9a3311dc890e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQmdBQUFnQUFBQUFnQUJBQUFBQUFBQUFBQUFBQUFBQUFBa0lBQUFBQVFBQUFBQUFBQUFBQUFCQUFBQVFBQUFBQUFBQUVBQkFBQUNBQUNBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFJQUVBQUFBQUFBQUFBQUJBQUlBRUlBRUFBQUFnQUFBQUFFQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxMTIsImV4cCI6MTc4MjMxMDkxMn0.V4WkntVZlxX67DynGD6hVC05J7sZPy2j6BF2GnEYIBE)

###   [3.3 删除SWAP表空间语法](#33-删除swap表空间语法)  

- 集群与单机一致


![](https://pingcode.yasdb.com/atlas/files/public/67396c46a1ad9a3311dc890f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQmdBQUFnQUFBQUFnQUJBQUFBQUFBQUFBQUFBQUFBQUFBa0lBQUFBQVFBQUFBQUFBQUFBQUFCQUFBQVFBQUFBQUFBQUVBQkFBQUNBQUNBQUFBQUFBQUFJQUFBQUFBQUFBQWdBQUFJQUVBQUFBQUFBQUFBQUJBQUlBRUlBRUFBQUFnQUFBQUFFQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAxMTIsImV4cCI6MTc4MjMxMDkxMn0.V4WkntVZlxX67DynGD6hVC05J7sZPy2j6BF2GnEYIBE)

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 单机不支持创建LOCAL SWAP TABLESPACE，可以创建SWAP TABLESPACE
1. 分布式不支持创建SWAP TABLESPACE和LOCAL SWAP TABLESPACE，只能在建库的时候创建出默认的
1. 集群下支持创建LOCAL SWAP TABLESPACE和SWAP TABLESPACE
1. 对于能创建出来的SWAP TABLESPACE，均支持ALTER和DROP
1. 对于本地表空间，不可以同时指定磁阵文件和本地文件。
1. 本地SWAP表空间实例间不能共享，各用各的。
1. 只使用用户默认的SWAP表空间，即使空间不足也不跨SWAP表空间
1. DROP DATAFILE / SPACE的过程中，需要检测当前DEFAULT_SWAP_TABLESPACE；
1.   `ALTER SYSTEM SET DEFAULT_SWAP_TABLESPACE = 表空间名字`    ，这个语句只能在SWAP表空间没有查询业务时切换, 即VM没有正在被使用；
1. 切换DEFAULT_SWAP_TABLESPACE 语句可以重启后切换，也可以在线切换；
1. 集群可存在多个SWAP表空间，但有且只有一个在实例当中正在被使用；
1. 不同的实例可以拥有不同的SWAP表空间；


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

- 概念：本地SWAP表空间指的是每一个实例都有一个相对应的独立空间；而全局SWAP表空间指的是所有实例共享一个空间；


||全局SWAP表空间|本地SWAP表空间|
|---|---|---|
|逻辑层面|只要能够访问得到，所有实例共享整个空间|每一个实例都有相对应的独立空间|
|是否支持本地路径|不支持|支持|
|文件名字|与表空间保持一致|都有一个特殊的后缀"_实例"|
|SQL语法|CREATE SWAP TABLESPACE|CREATE LOCAL SWAP TABLESPACE|
|文件数量|创建多少个就是多少个|创建的文件数量 * 实例个数|


- 如需要查询当前使用的是哪个VM表空间，可直接查看配置项DEFAULT_SWAP_TABLESPACE，默认值为建库时的SWAP表空间；


###   [5.1 建SWAP表空间语法](#51-建swap表空间语法)  

- 参见2.2节说明，SWAP表空间创建语法分为带LOCAL关键字和不带LOCAL关键字的场景，只有集群允许带LOCAL关键字
- 不带FOR ALL/FOR LEAF语法
- 需要是TEMPFILE类型
- 对于SWAP表空间的文件管理，与临时表空间的文件管理类似，参考    [集群支持本地临时表空间详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133584601)  


###   [5.2 VM适配](#52-vm适配)  

原来只有一个SWAP，VM都是记的表空间内的spaceBlockId，在有多个SWAP的情况下，需要VmCtrl加spcId以确定当前换出到具体哪个SWAP表空间

```
typedef struct StVmCtrl {
    volatile CodUint8 status;
    CodUint8          partId;
    CodUint16         handlerId;
	CodUint8          reseved[4];  // 讨论下
    VmCtrlId          prev; /* list prev in part */
    VmCtrlId          next; /* list next */
    union {
        CodUint32    blockId;
        BlockId      swapId; // 修改后
    };
    VmChain          chain;
} VmCtrl;

```

###   [5.3 ALTER SWAP表空间](#53-alter-swap表空间)  

与当前ALTER普通表空间行为保持一致，如果删除了正在使用的表空间文件，则使用到VM的对应查询报错

###   [5.4 DROP SWAP表空间](#54-drop-swap表空间)  

表空间损坏场景，需要支持DROP SWAP表空间：

- 删除SWAP表空间前处理：
    - 确保表空间是空的，需要遍历VM链表，确认没有用户在使用该表SWAP空间（待定）
    - 遍历所有用户列表，确认该SWAP该SWAP表空间没有作为默认表空间使用


###   [5.5 故障恢复](#55-故障恢复)  

与临时表空间一致，启动时重置，需要区分本地SWAP表空间和全局SWAP表空间上的处理，本地SWAP表空间实例间不需要同步

```
恢复期间对swap、temp的共享表空间的处理
    6). db master实例广播所有实例本地锁住swap、temp表空间的extent lock，防止业务修改表空间

```

- 本实例故障后，其它实例不需要锁住表空间，实例上业务可以继续进行
    - MSG_FREEZE_TEMP_SPACE等消息处理
    - rfmTempSpace函数处理，跳过本地表空间
- 本实例故障后，重新拉起需要走单机清理流程
- Temporary Extent Map处理


其它详见    [集群支持本地临时表空间详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133584601)  

###   [5.6 VM表空间切换流程](#56-vm表空间切换流程)  

1. 初始化
1.     - 现在的DEFAULT_SWAP_TABLESPACE 存放在ini配置中；（nomount时加载，mount状态下做校验）
    - 其中，SWAP表空间校验失败时，需要直接报错；

1. 开始执行    `ALTER SYSTEM SET DEFAULT_SWAP_TABLESPACE = 表空间名字`    语句；
    1. shrink 当前SWAP表空间；
    1. 上spc extent lock锁，检测extent bitmap是否有线程在使用VM，即是否为空；
    1. 如果为非空，报错返回；为空则继续进行；
    1. 上SPC DDL锁，检测指定表空间是否为SWAP表空间，不是SWAP表空间则报错，是SWAP表空间则继续进行；
    1. 设置SPC active标记，更新配置；
1. 若此时有线程正在使用VM进行alloc：
    1. 死循环上spc extent lock锁，获取当前SPACE，检测当前space是否active；
    1. 如果是active space，放锁扩展extent；
1. 查看视图是否切换成功


```
	SQL&gt; show parameter DEFAULT_SWAP_TABLESPACE;

	NAME                                                             VALUE

	---------------------------------------------------------------- ----------------------------------------------------------------
	DEFAULT_SWAP_TABLESPACE                                          SWAP


	1 row fetched.

```

###   [5.7 视图适配：](#57-视图适配)  

无

###   [5.8 DFX设计](#58-dfx设计)  

1. 协议、驱动、访问控制、通讯、加密，不涉及；
1. 性能：使用本地SWAP表空间后，使用VM的性能与单机接近；
1. 可靠性，不涉及；
1. 主备复制，不涉及；


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

详见    [集群支持本地临时表空间详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133584601)  

###   [6.1 集群场景](#61-集群场景)  

|测试条件|预期结果|说明|
|---|---|---|
|创建SWAP表空间WITHOUT DATAFILE语法|成功||
|创建SWAP表空间带FOR ALL|报错||
|SWAP表空间不带FOR ALL/LEAF|成功||
|创建SWAP表空间带中文名称|成功||
|创建SWAP表空间，混用本地文件系统和YFS文件系统|报错|不支持混用路径|
|更改SWAP表空间添加删除文件，混用本地文件系统和YFS文件系统|报错|不支持混用路径|


###   [6.2 单机场景](#62-单机场景)  

|测试条件|预期结果|说明|
|---|---|---|
|创建SWAP表空间WITHOUT DATAFILE语法|成功||


###   [6.2 分布式场景](#62-分布式场景)  

|测试条件|预期结果|说明|
|---|---|---|
|创建SWAP表空间WITHOUT DATAFILE语法|报错|所有创建语句均需要拦截|


##   [7.资料设计章节](#7资料设计章节)  

1. 补充CREATE SWAP的语法图；
1. 补充创建SWAP表空间的规格约束以及表空间管理的文档；
1. 补充配置参数DEFAULT_SWAP_TABLESPACE；


##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

1. 暂无


## Attachments:

[1704953935747.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDU4OTcwYzJhZjRmNTIwYTk5IiwicmVmX2lkIjoiNjczOTZjNDU1OTNmOTljOWZmMjM2YzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTEyLCJleHAiOjE3ODIzODY1MTJ9.ZFAWc_al11bTTihQ_8tvzmJb-Pg-oyOaR7U6H1mJ8v8)

 (image/png)    


[image2024-2-24_17-25-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDY4OTcwYzJhZjRmNTIwYTljIiwicmVmX2lkIjoiNjczOTZjNDU1OTNmOTljOWZmMjM2YzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTEyLCJleHAiOjE3ODIzODY1MTJ9.CDyoOg1FmsSw51R7iUymuZXB_GSqIhLHyQTI4_2FXzM)

 (image/png)    


[image2024-2-24_17-27-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNDY4OTcwYzJhZjRmNTIwYTlkIiwicmVmX2lkIjoiNjczOTZjNDU1OTNmOTljOWZmMjM2YzY5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwMTEyLCJleHAiOjE3ODIzODY1MTJ9.rC0fdxslr_MRjiPa58HbkrAmcJt11GUM6d4P6Oyv2ac)

 (image/png)    


## Comments:

|  [](null)  ,# 会议纪要    
  1. 不能删除正在使用的文件以及(全局 | 本地)SWAP/临时表空间；    
  2. 删除文件与SWAP表空间的判断逻辑从表空间角度考虑，即通过extent BitMap确认；    
  3. 创建用户支持指定临时/SWAP表空间：在单机 / 分布式下不支持Local语法需要在资料中体现；    
  4. 在USER$以及升级脚本中，SWAPTS#去掉DEFAULT 3；    
  5. StUserCreateDef的Tablespaceid等五个槽位需要确认下是否会被使用，如没使用直接删除；    
  6. 导入导出用户定义时需要注意包括临时/SWAP表空间；,# 遗留问题    
  1. 分布式是否需要支持创建SWAP表空间？责任人：陈宜顺,  
,  
,Posted by liangrongqin at 一月 18, 2024 10:20|
|---|
|  [](null)  ,  [本地SWAP表空间设计变更](https://conf.yasdb.com/pages/viewpage.action?pageId=141587554)  ,Posted by liangrongqin at 一月 19, 2024 14:47|
