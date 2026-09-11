Created by 李道一, last modified by  Vivian Liu on 五月 17, 2023

#   [YDBRD-13517: 集群支持sequence](#ydbrd-13517-集群支持sequence)  

  [[YDBRD-13517] 【共享集群】集群支持sequence - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13517)  

##   [1. Overview（概述）](#1-overview概述)  

序列是数据库对象一种。多个用户可以通过序列生成连续的数字以此来实现主键字段的自动、唯一增长，并且一个序列可为多列、多表同时使用。

序列消除了串行化并且提高了应用程序一致性。

##   [2. Features（功能特性）](#2-features功能特性)  

集群支持    `CREATE SEQUENCE`    ，    `ALTER SEQUENCE`    ，    `DROP SEQUENCE`  

##   [3. Interfaces（接口）](#3-interfaces接口)  

本方案不涉及新增接口，是对单机sequence功能在集群下的适配

新增如下消息

|消息类型|处理函数|备注|
|---|---|---|
|MSG_ALTER_SEQUENCE|msgAlterSequence|执行    `alter sequence`    的实例向其他实例广播|
|MSG_ALTER_SEQUENCE_ACK|msgNullFunc||


  `seqCache`    新增一个标记位

```
typedef struct StSeqCache {
    MemoryContext* mctx;
    CodUint64      dictVersion;
    SequenceDesc   desc;
    CodUint16      ownerId;
    CodBool        isValid;		// 判断该cache是否有效
} SeqCache;

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

sequence的缓存是实例级别，有可能会造成全局的序列值乱序，但可以保证每个实例内部序列值递增

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

单机下已经实现sequence，在集群下存在多实例缓存和并发控制问题；

目前总体思路是，利用GLS机制，在获取    `nextVal`    时给sequence对象上共享锁，在drop和alter时给sequence对象上排他锁

####   [sequence创建和删除](#sequence创建和删除)  

  `doCreateSequence`    和    `doDropSequence`    中，将新的序列信息写入到系统表    `SEQ$`    中，在打开系统表的cursor时，通过    `dictOpenCursor->ankOpenSysCursor->openTableCursor->lockTableShared->lockTableSharedInternal->lockObjectShared->doLockTableShared->axcLockTable`    给表上锁

当前，删除sequence的同步广播是复用删除table的逻辑，存在问题：目前删除table的消息处理函数，只有当obj的类型为table时才会失效dc，其余情况不会，所以复用会造成sequence的内存残留，此外，删除AC也是用的该逻辑

####   [alter sequence](#alter-sequence)  

######   [缓存失效](#缓存失效)  

目前单机机制下，    `alter sequence`    修改系统表后，没有广播给其他实例，这不符合集群下的要求，可能会出现如下情况

||T1|T2|T3|T4|T5|
|---|---|---|---|---|---|
|**A**|1|||2，该值错误，应该为7，同时推进HWM||
|**B**||6|  `ALTER SEQUENCE seq1 MINVALUE 6;`  ||7|
|*HWM*|6|11|7|7|12|


集群下，    `alter sequence`    后，需要发送广播给其他实例，将对应oid的    `SeqCache`    设置为无效

当需要访问序列的缓存时，判断    `dictVersion`    和    `SeqCache`    标志位，若缓存已被失效或者版本不对应，则重新加载缓存

广播流程图如下

![](https://git.yasdb.com/lidaoyi/pictures/-/raw/master/pictures/2023/04/18_19_58_1_%E4%BF%AE%E6%94%B9seq%E6%B5%81%E7%A8%8B.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTMwMDEsImV4cCI6MTc4MjMwMzgwMX0.heYh9RSRssNezNoSX-fYh8WgSCiutaFxxIM5KlzZas8)

######   [多实例缓存对HWM的影响](#多实例缓存对hwm的影响)  

默认配置下，假设实例A，B，C均对序列取了值，那么三个实例都会有序列的缓存，同时，缓存中记录的HWM不一致

这时候，如果在HWM较小的实例上执行    `alter sequence`    ，目前的机制下，由于缓存有效，会跳过加载系统表，获取最新的HWM（单机的逻辑下不可能出现HWM被其他实例推进的情况，但集群下这种场景很常见），从而根据旧版本的HWM来覆盖系统表，出现如下问题

||T1|T2|T3|
|---|---|---|---|
|**A**|1||  `ALTER SEQUENCE SEQ1 INCREMENT BY 5;`  |
|**B**||6||
|*HWM*|21|41|25，该值错误，应该为45|


该问题可以通过在加载系统表时，判断自身缓存的HWM和读取到的HWM是否相等来解决；

  `desc->nextValue = (codNumberCompare(&oldHwm, &desc->hwm) == 0) ? desc->nextValue : desc->hwm;`  

同时在集群下，执行    `alter sequence`    前必须执行一次    `dcReLoadSeqCache`    ，获取最新的水位线

此外，还存在不同实例拿到同一个区间的情况，如果此时，旧区间的实例执行alter，那么水位线按照旧区间实例的nextval来修改

  `CREATE SEQUENCE S1 MINVALUE 1 MAXVALUE 6 CACHE 3 CYCLE;`  

||T1|T2|T3|T4|T5|T6|T7|T8|T9|
|---|---|---|---|---|---|---|---|---|---|
|**A**|1|||||||  `ALTER SEQUENCE S1 MAXVALUE 10;`    此时A，B和系统表有相同的水位线，无法判断谁最新，以自己的nextval为准||
|**B**||4|5|6|1|2|3||2|
|*HWM*|4|7|7|7|4|4|4|2，符合预期，按照A的nextval来推水位线|5|


####   [并发控制](#并发控制)  

sequence在实例间进行同样修改或获取时的并发场景

  `CREATE SEQUENCE S1 CACHE 5;`  

-   `Next-Next`    并发
- 假设实例A创建了序列，并获取    `nextval`    ，一直获取到5，这时候实例A，B并发获取    `nextval`    ，是否会出现读取到系统表同一个水位线的情况
- 经断点测试，此时后一个实例会卡在    `heapRowIdFetch`    ，通过这个函数控制并发
- ![](https://git.yasdb.com/lidaoyi/pictures/-/raw/master/pictures/2023/04/23_14_29_19_%E9%9B%86%E7%BE%A4%E5%B9%B6%E5%8F%91seq.nextval.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTMwMDEsImV4cCI6MTc4MjMwMzgwMX0.heYh9RSRssNezNoSX-fYh8WgSCiutaFxxIM5KlzZas8)
-   `Drop-Drop`    并发
- 假设两个实例同时进入删除序列的逻辑，是否会导致日志的重复记录
- 经代码逻辑检查和断点测试，可排除
-   `Drop-Next`    并发
- 单机下会core，修复已合入
-   [drop sequence与select sequence.nextVal并发bug](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/19915)  
- 集群上了GLS锁后，drop和next不会同时进行
-   `Next-Alter`    并发
- 处理alter的广播消息不上锁，直接将缓存标记为无效；
- 旧的机制下，获取nextval推进HWM，会读取系统表，取得最新的水位线，以此计算nextval和新水位线
- 有可能存在如下时序：
- 读系统表加载sequence -> 读系统表获取最新水位线 -> 收到alter消息，seq更改 -> 用旧的seq信息计算水位线
- 从而导致水位线更新错误
- 在加入GLS锁机制后，由于alter需要上排他锁，可以避免该问题


####   [order/noorder sequence](#ordernoorder-sequence)  

单机目前对order和noorder序列是一样的处理，在单机下两者表现一致，集群下需要做适配

同样是实现全局的连续，order和nocache的不同点主要在于水位线，order在cache内不会推水位线，nocache每次获取nextval都会更新系统表

需要注意的是，  **只有在集群部署形态、有序、有缓存的情况下，才做特殊的适配**

######   [方案一：上GLS锁后广播](#方案一上gls锁后广播)  

在    `ankSeqNextVal`    ，重新加载缓存后，加入判断

- GLS广播上X锁，用    `axcLockRWLock`    接口
- 广播同步nextval消息，收到广播的实例检查自己是否有该序列的cache，若有则发送nextval
- 获取收到的到最大的nextval，更新hwm


######   [方案二：通过GRC管理](#方案二通过grc管理)  

将有序有缓存序列作为一种资源纳入到GRC管理中，经过R-M-O三个角色的消息流转后，获取该资源的权限

- requester根据oid查找master，向master发送请求
- master发现该sequence资源在owner上，向owner发送失效通知
- 注：如果master是第一次收到这条消息，就创建对应的资源然后grant即可
- owner失效seqCache，将nextval发送给master
- master收到确认后，更新nextval，将这个nextval附带，发送grant消息给requester
- requester收到grant，加载系统表，获取hwm，根据收到的nextval更新hwm，返回闭环消息
- master收到闭环消息，将owner修改为requester


如果是通过alter从order到noorder，alter之后会广播失效所有cache，执行ddl的实例将新nextval写进hwm里

######   [方案三：集中式管理](#方案三集中式管理)  

集群下所有order序列的nextval生成，统一给master实例发送消息，由master生成nextval后返回给请求实例

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

sequence自测大部分和单机一致，需要增加多实例间的sequence查询测试样例（实例A、B、C行的数字表示执行    `SELECT SEQ.NEXTVAL FROM DUAL;`    得到的结果，HWM可以通过查询系统表    `SEQ$`    或者视图    `ALL_SEQUENCES`    获取）

####   [创建、删除sequence](#创建删除sequence)  

||T1|T2|T3|T4|T5|T6|
|---|---|---|---|---|---|---|
|**A**|  `CREATE SEQUENCE SEQ1;`  ||||  `CREATE SEQUENCE SEQ1;`  ||
|**B**||1||  `SELECT SEQ1.NEXTVAL FROM DUAL;`    报错||1|
|**C**|||  `DROP SEQUENCE SEQ1;`  ||||
|*HWM*|1|21|||1|21|


####   [修改sequence](#修改sequence)  

  `CREATE SEQUENCE SEQ2 CACHE 5;`  

||T1|T2|T3|T4|T5|
|---|---|---|---|---|---|
|**A**|1|||7||
|**B**||6|  `ALTER SEQUENCE SEQ2 MINVALUE 6;`  ||12|
|*HWM*|6|11|7|12|17|


  `CREATE SEQUENCE SEQ3 CACHE 5;`  

||T1|T2|T3|T4|T5|
|---|---|---|---|---|---|
|**A**|1|||7||
|**B**||6|  `ALTER SEQUENCE SEQ3 NOCACHE;`  ||8|
|*HWM*|6|11|7|8|9|


  `CREATE SEQUENCE SEQ4;`  

||T1|T2|T3|T4|
|---|---|---|---|---|
|**A**|1|  `ALTER SEQUENCE SEQ4 INCREMENT BY 5;`  ||  `ALTER SEQUENCE SEQ4 NOCACHE;`  |
|**B**|||6||
|*HWM*|21|6|106|106|


  `CREATE SEQUENCE SEQ5;`  

||T1|T2|T3|T4|
|---|---|---|---|---|
|**A**|1|  `ALTER SEQUENCE SEQ5 INCREMENT BY 5;`  |6|  `ALTER SEQUENCE SEQ5 NOCACHE;`  |
|**B**|||||
|*HWM*|21|6|106|11|


  `CREATE SEQUENCE SEQ6;`  

||T1|T2|T3|T4|T5|
|---|---|---|---|---|---|
|**A**|1|  `ALTER SEQUENCE SEQ6 INCREMENT BY 5;`  ||106|  `ALTER SEQUENCE SEQ6 NOCACHE;`  |
|**B**|||6|||
|*HWM*|21|6|106|206|111|


  `CREATE SEQUENCE SEQ7;`  

||T1|T2|T3|T4|T5|
|---|---|---|---|---|---|
|**A**|1||  `ALTER SEQUENCE SEQ7 ORDER;`  |41||
|**B**||21|||42|
|*HWM*|21|41|41|61|61|


##   [7.资料设计章节](#7资料设计章节)  

开发手册-SQL参考手册-SQL语句-CREATE SEQUENCE：ORDER|NOORDER和CACHE|NOCACHE选项的描述中，增加共享集群部署时，全局是否能有序的提示。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  