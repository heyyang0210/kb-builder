Created by 郑荃, last modified on 五月 30, 2024

SR:    [https://pingcode.yasdb.com/pjm/items/66263dccfd997db58adf0aac](https://pingcode.yasdb.com/pjm/items/66263dccfd997db58adf0aac)    ?    
  #YDBRD-26587 支持DBMS_XA内置系统包

# 1. 概述

DBMS_XA 包为应用提供了和 XA 接口一样功能的方法，  供应用程序在 PL/SQL 中调用 XA 接口。

XA协议标准由X/OPEN组织规定，其官方标准为Distributed Transaction Processing:The XA Specification，规定了一套最基础的分布式事务执行规范；

非原生分布式部署形态下的单机数据库也有联合多个节点执行事务的需求，因而需要单机数据库具备XA事务能力，其中典型的应用如DBLINK能力，通过XA协议来连接同构或异构数据库，在多个节点上执行同一个事务。

|模块|标准定义|落地分析|
|:---|:---|:---|
|AP|Application program 应用模块，发起应用的事务逻辑|理解为应用调用者，不受到数据库控制|
|TM|Trasanction manager 事务管理器，负责协调多个节点的事务，发起指令|与数据库提供的部署模式相关；,比如数据库内置了分布式部署，TM相当于CN或MN的角色，完成了事务各节点状态的收集、指令发送、决策等工作；,若是单机部署数据库，是无法提供TM功能的；,此时，TM应由上层业务在应用层实现自己的逻辑；,经上述分析，本次XA协议的开发内容不涉及TM的功能。|
|RM|Resource manager 资源管理器，负责协调资源、存储、持久化等；例如数据库、文件系统等|理解为单机数据库提供的能力，细化到具体每一个RM,实际可以对应YashanDB中的一个连接/handler与其绑定的事务单元；,存储实现的就是RM的能力|


  


根据不同的部署模式和数据库架构，标准区分了两类情况：

- 紧耦合型：不同节点之间共享资源，同一个完整的进程或线程承载上述几个模块的能力
- 松耦合型：不同节点之间资源独立，通过协调节点、消息来同步


Yashan设计部署是松耦合型，数据库只关注RM这个概念涉及的功能；

TM能力在dstb部署下是由CN、MN完成的；

单机的XA协议实现，不关注TM，需要应用者自行实现。

# 2. 需求分析

  [XA事务特性设计文档](/pages/createpage.action?spaceKey=YAS&title=XA%E4%BA%8B%E5%8A%A1%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3)  

## 2.1 功能点分析

![](https://pingcode.yasdb.com/atlas/files/public/67396d24a1ad9a3311dc8f07/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYxNzAsImV4cCI6MTc4MjMxNjk3MH0.411JxX1K-PTPwkmL0VGKrSGop-a1K9OrI6ratQQcWrU)

#### 子功能：

1. 需要提供XA事务的启动、挂起、恢复、一阶段提交、二阶段提交、普通回滚、二阶段回滚功能
1. 提供事务上下文与线程的绑定、游离、恢复绑定能力
1. 故障重启、主备切换等场景，需要恢复XA事务能力，除了持久化内容，还需要保证未结束的XA事务恢复后，恢复所持有的资源
1. 提供recover查询能力，使得TM可通过recover协议查询所有XA事务列表


#### 优化项功能

1. read-only事务：某节点在收到一阶段的时候，发现自己仅持有了资源，并没有真正修改数据；此时该节点上不需要持久化动作，只需要在一阶段直接释放资源
1. one-phase commit：当TM收集到只有一个节点真正参与事务，则可以选择发送one-phase commit，此时不需要经过一阶段即可直接提交。


#### XA协议中规定RM实现应该具备的几个关键能力实现

|接口所属模块类型|接口|功能描述|
|:---|:---|:---|
|RM资源初始化|xa_open|应用层申请RM资源|
||xa_close|应用层释放RM资源|
|XA事务处理之,线程绑定关系变更|xa_start|以不同模式绑定XA事务与线程|
||xa_end|以不同模式挂起XA事务与线程|
|XA事务处理之,事务持久化2PC变更|xa_preapre|事务持久化变更至一阶段|
||xa_commit|事务持久化变更到提交|
||xa_rollback|事务持久化变更到回滚|
|XA事务查询能力|xa_recover|查询走到phase1和启发式phase2 XA事务；,返回一张表结果|


**接口的标记**

|FLAG|说明|用于接口|落地分析|说明|
|:---|:---|:---|:---|---|
|TMNOFLAGS|默认FLAG|xa_start|此模式，xa_start新启动XA事务，不能指定系统中已经存在的xid|DBMS_XA.XA_START ( xid IN DBMS_XA_XID, flag IN PLS_INTEGER) RETURN PLS_INTEGER;,**GTID要求：**,- 默认NOFLAG下：要求GTID不能与当前任何已存在的GTID一样 【要求与线程绑定状态也要将XA的GTID插入哈希桶，才能检测全局GTID唯一性】
- JOIN或RESUME下：GTID可以是已游离的XA事务，也可以是本线程绑定的XA事务；不能是其他线程绑定的
- JOIN或RESUME下，若是游离的XA事务，要求事务持久化处于phase1之前的状态
,**线程是否已有XA事务绑定**,- 默认NOFLAG下， 要求线程上无XA事务绑定
- JOIN或RESUME下：若指定的GTID就是本线程绑定的XA事务，则可以；否则不允许
,**线程是否有单机事务绑定**,- 默认NOFLAG下：线程上有没有单机事务都可以；若有单机事务，则转换为XA；若无，则启动一个XA事务+持久化为空
- JOIN或RESUME下：不允许有单机事务绑定
,**注：友商这里的实现，允许在线程存在单机事务的情况下，调用JOIN或RESUME功能，并且该单机事务可以和此XA事务的数据续接为一个事务；这一点从YashanDB的事务架构设计上做不到，有差异**,**与DML关系**,无论是任何模式，只要允许调用xa_start，都可以继续执行DML，续接事务内容,- 空事务->启动XA事务->执行DML续接事务
- 已有XA事务->JOIN/RESUME XA事务->执行DML续接事务
|
|TMNOMIGRATE|指定迁移属性|-|不落地||
|TMMIGRATE|||||
|TMJOIN|实现join和resume功能|xa_start|落地，且这两个模式做成一样的；,即可以新启动，也可以指定xid重新绑定已经游离的XA事务||
|TMRESUME|||||
|TMSUSPEND|实现suspend功能|xa_end|落地，仅可将与线程绑定的XA事务挂起游离,suspend功能不提供中间状态；所以与游离能力落地一样即可|DBMS_XA.XA_END ( xid IN DBMS_XA_XID, flag IN PLS_INTEGER) RETURN PLS_INTEGER;,**GTID要求：**,- SUSPEND：要求只能指定本线程绑定的GTID
- SUCCESS/FAIL下：GTID可以是已游离的XA事务，也可以是本线程绑定的XA事务；不能是其他线程绑定的
- SUCCESS/FAIL下，若是游离的XA事务，要求事务持久化处于phase1之前的状态
,**线程是否已有XA事务绑定**,- SUSPEND下： 要求线程上有XA事务绑定
- SUCCESS/FAIL下：若指定的GTID就是本线程绑定的XA事务，则可以；否则不允许
,**线程是否有单机事务绑定**,- SUSPEND下：不涉及
- SUCCESS/FAIL下：若指定的GTID是本线程绑定的XA事务，则可以；否则不允许有其他单机事务绑定
,**与DML关系**,调用xa_end后，事务仍然处于挂起状态，游离在哈希桶，失去绑定关系，不可以继续执行DML,  
|
|TMSUCCESS|实现游离功能、rollback-only、不允许再做DML标志功能|xa_end|落地，这两个标志合一，且不做特殊标记；不区分rollback-only、不允许DML；,可以处理与线程绑定的XA事务，也可以处理已经挂起的XA事务（suspend后依然还可以通过end切换标记）||
|TMFAIL|||||
|无flag|  
|xa_prepare|  
|DBMS_XA.XA_PREPARE ( xid IN DBMS_XA_XID) RETURN PLS_INTEGER;,**GTID要求：**,- 只能指定已经存在的GTID
,**线程是否已有XA事务绑定**,- 若线程绑定的就是prepare指定的GTID，允许prepare
- 若线程绑定了非此GTID的XA事务，则不允许
- GTID可以从游离的XA事务搜索，要求状态在phase1之前，已经phase1的XA事务不允许重复prepare
,**线程是否有单机事务绑定**,- 若线程绑定的即是此GTID事务，已经启动XA事务+单机事务，允许直接prepare
- 若GTID从全局游离中搜索，而线程单独启动单机事务，则不允许处理prepare
,**与DML关系**,调用xa_prepare后，事务游离，且持久化状态至phase1，不允许再续接事务数据操作,**特殊机制**,为了适配read-only事务功能、以及启动XA事务+数据为空事务的特殊状态；,节点在执行prepare时，若发现对应单机事务的状态为OPEN,- 仅更改XA事务状态，且该XA事务不需要游离挂起，直接清理
- 该事务持有的资源可以直接释放
- 后续该事务直接清理，无法再做1/2阶段提交
|
|TMONEPHASE|标记是否用one-phase提交|xa_commit|落地；区别实现是否one-phase提交；,- 如果指定one-phase，则前面不能经过prepare
- 如果指定非one-phase，必须从phase1提交
|DBMS_XA.XA_COMMIT ( xid IN DBMS_XA_XID, onePhase IN BOOLEAN) RETURN PLS_INTEGER;    
    
,**GTID要求：**,- 只能指定已经存在的GTID
,**线程是否已有XA事务绑定**,- 若线程绑定的就是commit指定的GTID，允许
- 若线程绑定了非此GTID的XA事务，则不允许
- GTID可以从游离的XA事务搜索；
- one-phase下：该XA事务状态必须在phase1之前
- 非one-phase下：该XA事务状态必须是phase1
,**线程是否有单机事务绑定**,- 若线程绑定的即是此GTID事务，已经启动XA事务+单机事务，允许one-phase commit
- 若GTID从全局游离中搜索，而线程单独启动单机事务，则不允许处理commit
,**与DML关系**,调用xa_commit后，以及到了phase2，不可再续接事务|
|无flag|  
|xa_rollback|  
|DBMS_XA.XA_ROLLBACK ( xid IN DBMS_XA_XID) RETURN PLS_INTEGER;,这个接口尽可能容错，可以单机回滚也可以二阶段回滚,**GTID要求：**,- 容错；可回滚则回滚，若无就空转返回成功
,**线程是否已有XA事务绑定**,- 若绑定了指定的，则直接回滚
- 若无绑定的，则从全局搜索
- 若绑定了其他XA事务，则不允许执行
,**线程是否有单机事务绑定**,- 若线程绑定的即是此GTID事务，已经启动XA事务+单机事务，允许
- 若GTID从全局游离中搜索，而线程单独启动单机事务，则不允许处理
,**与DML关系**,调用xa_rollback后，事务已结束|
|  
|  
|xa_recover|  
|DBMS_XA.XA_RECOVER RETURN DBMS_XA_XID_ARRAY;|


- 走完整1阶段流程：start->起单机事务->end->xa_commit (one phase) / xa rollback
- 走完整2阶段流程：start->起单机事务->end->prepare->xa commit / xa rollback


**设计实现与友商不同的地方：**

- YashanDB的单机事务是不可以游离的，与handler、xrm强绑定至事务结束
- YashanDB的单机事务与XA事务不可以同时被一个handler处理，一旦标记了XA后起事务，或先起了OPEN的单机事务再标记为XA，则这个事务就完整属于这个GTID
- 当handler被XA事务占用时，若XA事务还能接受DML，则可以进行数据修改，并且所有的修改属于该XA事务
- 当handler被单机事务占用，可以为该单机事务绑定一个新的XA事务，但不允许从哈希桶内拿出已存在的游离XA事务绑定该handler和该单机事务，这一点与友商设计实现不同，友商的测试表现不作为对齐参考
- YashanDB不允许XA事务和单机事务一起提交数据的场景，这一点与友商设计实现不同，友商的测试表现不作为对齐参考


## 2.2 应用场景

## *需求本身的主要应用场景*

- 跨多个资源进行事务处理，并且需要保证数据一致性和完整性的场景都适合使用XA事务


*需求与其他特性的关联场景*

- *事务一致性，通过xa事务的多session，也需要保证一致性*


## 2.3 规格约束

- YashanDB不支持sharding模式部署，本次开发仅设计单机处理接口；


# 3. 详细测试设计

## 3.1 测试设计方法

对于整个事务的流程，采用状态迁移法，从事务开始到结束，梳理出各个环节的状态转换，沿着每一条路径进行覆盖

对于功能验证，主要采用场景法和错误分析法

对于高级包本身的功能，主要采用有效类划分，对入参的有效值和无效值进行验证

## 3.2 详细测试设计

**1、高级包入参验证**

只验证入参，功能结合场景进行验证

#### XA协议中规定RM实现应该具备的几个关键能力实现

|接口所属模块类型|接口|功能描述|
|:---|:---|:---|
|RM资源初始化|xa_open|应用层申请RM资源|
||xa_close|应用层释放RM资源|
|XA事务处理之,线程绑定关系变更|xa_start|以不同模式绑定XA事务与线程|
||xa_end|以不同模式挂起XA事务与线程|
|XA事务处理之,事务持久化2PC变更|xa_preapre|事务持久化变更至一阶段|
||xa_commit|事务持久化变更到提交|
||xa_rollback|事务持久化变更到回滚|
|XA事务查询能力|xa_recover|查询走到phase1和启发式phase2 XA事务；,返回一张表结果|


|接口|入参|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|XA_START   |xid   |有效的  DBMS_XA_XID类型，且xid未被正在使用|  
|非  DBMS_XA_XID类型,null、‘’、空串：‘  ’|  
|
|  
|  
|直接写数据|  
|xid正在被使用|  
|
|  
|  
|  
|  
|xid不符合xid的格式（数据前64位不为数字）,xid长度小于、超过长度限制,xid为空,包含特殊字符,不唯一|  
|
|  
|flag   |不填，默认  TMNOFLAGS|  
|flags异常：,- 非  TMNOFLAGS、  TMJOIN、TMRESUME
- 为空（是否会取默认值）
- 其他接口的flag
- flags的长度上限
- flag特殊字符
|  
|
|  
|  
|TMNOFLAGS、TMJOIN、TMRESUME|  
|  
|  
|
|XA_END   |xid|有效的  DBMS_XA_XID类型，xid已被start,  
|  
|非  DBMS_XA_XID类型,xid不符合xid的格式（数据前64位不为数字）,xid长度小于、超过长度限制,xid为空,包含特殊字符,xid未被使用|  
|
|  
|flag   |不填,TMSUSPEND  、  TMSUCCESS  、TMFAIL,直接写数据,  
|  
|flags异常：,- 非  TMSUSPEND  、  TMSUCCESS  、TMFAIL
- 为空（是否会取默认值）
- 其他接口的flag
- flags的长度上限
- flag特殊字符
- xid未被使用
|  
|
|XA_FORGET   |xid   |有效的  DBMS_XA_XID类型，xid正在被使用，处于xa事务的各个阶段|  
|非  DBMS_XA_XID类型,xid不符合xid的格式（数据前64位不为数字）,xid长度小于、超过长度限制,xid为空,包含特殊字符|  
|
|  
|  
|  
|  
|xid未被使用|  
|
|XA_PREPARE   |xid   |有效的  DBMS_XA_XID类型，xid正在被使用，处于xa事务的各个阶段|  
|非  DBMS_XA_XID类型,xid不符合xid的格式（数据前64位不为数字）,xid长度小于、超过长度限制,xid为空,包含特殊字符|  
|
|  
|  
|  
|  
|xid未被使用|  
|
|XA_ROLLBACK   |xid   |有效的  DBMS_XA_XID类型，xid正在被使用，处于xa事务的各个阶段|  
|非  DBMS_XA_XID类型,xid不符合xid的格式（数据前64位不为数字）,xid长度小于、超过长度限制,xid为空,包含特殊字符|  
|
|  
|  
|  
|  
|xid未被使用|  
|
|XA_COMMIT   |xid   |有效的  DBMS_XA_XID类型，xid正在被使用，处于xa事务的各个阶段|  
|非  DBMS_XA_XID类型,xid不符合xid的格式（数据前64位不为数字）,xid长度小于、超过长度限制,xid为空,包含特殊字符|  
|
|  
|  
|  
|  
|xid未被使用|  
|
|  
|onePhase   |true、faulse|  
|空、null、‘’、空串：‘  ’,其他字符串|  
|
|XA_RECOVER   |入参个数|0|  
|大于0|  
|
|DBMS_XA_XID|入参个数|3|  
|0，1，2,4|  
|
|  
|formatid|number类型|  
|不能转换成number类型的其他数据类型|  
|
|  
|  
|可以转换成number类型的其他数据类型|  
|  
|  
|
|  
|gtrid|RAW|  
|不能转换成RAW类型的其他数据类型|  
|
|  
|  
|可以转换成RAW类型的其他数据类型|  
|  
|  
|
|  
|bqual|RAW|  
|不能转换成RAW类型的其他数据类型|  
|
|  
|  
|可以转换成RAW类型的其他数据类型|  
|  
|  
|


**2、状态转换覆盖**

详细的状态转换：

[状态转换图.eddx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjAwIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.B_CquK-bRE3aPOjPPQfjsOoBmYnPOr35UAGCKA6tgm4)

prepared异常转换（非空XA事务到了prepare阶段再执行start）：

[状态转换图_prepare_异常.eddx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjM4OTcwYzJhZjRmNTIxMDhmIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.VpRagKBWiM1o-8n3V8qD3-pUT8nouC-EwYzHbuzJ5nU)

路径覆盖：

[路径覆盖流程.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjAxIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.rYGvjb7NPZ2WN7KA2MsKTCxDitPa5lfHvXsshK-ecms)

  


**测试的主要场景:**

部署模式：

- 单机


表类型覆盖：

- heap、lsc


路径覆盖：参照附件2个状态转换图，生成用例

- 从空闲状态到事务结束， 覆盖每一条路径， 中间穿插着报错场景后继续往下一步执行
- 路径覆盖过程中穿插事务游离后，下次绑定由原线程处理，或者由其他线程处理


DML覆盖：

- 覆盖从开始到结束，无任何的dml起事务或者dml没有真正修改数据
- 整个流程的不同阶段穿插dml：xa_start之前， xa_start和xa_end之间， xa_end和xa_prepare之间， xa_prepare和commit/rollback之间 ：    

    - xa_start之前执行dml，单机事务转换成分布式事务
    - xa_start和xa_end可以继续执行dml
    - xa_end后分布式事务游离，可以执行单机事务，或者新起分布式事务
    - xa_end后做的dml属于新的单机或者转换成新的分布式事务
    - xa_end以后如果有活跃的单机事务，执行prepare会报错，单机事务提交后，可以执行prepare
    - xa_prepare以后dml会报错
- 事务中的操作：覆盖insert、delete、update、select ，select for update ,dml覆盖有实际的加锁，以及没有实际的加锁


功能覆盖：

-  接口的功能覆盖在状态转测测试工程中即可覆盖
-  xa_recover可以在事务处于各个阶段进行查询，存在多个不同阶段的xa事务时，都可以查询出来，事务结束就查询不出来了
- 在各个阶段执行ddl，看一下是否存在问题


  


**3、异常场景测试**

|接口|场景|场景详细说明|预期|
|---|---|---|---|
|xa_start|同一个xa资源处理不同的xid（xid1、xid2）,  
,  
|处于active,xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;    
  xaResource1.start(xid2  ,   XAResource.  TMNOFLAGS  )  ;|报错|
|  
|  
|处于suspend,xaResource1.end(xid1  ,   XAResource.  TMSUSPEND  )  ; 或者其他的flag    
  xaResource1.start(xid2  ,   XAResource.  TMNOFLAGS  )  ;|xid1已经游离，xid2可以成功|
|  
|  
|xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;,xaResource1.commit或者rollback,xaResource1.start(xid2  ,   XAResource.  TMNOFLAGS  )  ;|xid1已经结束，xid2可以成功|
|  
|  
|xaResource1.prepare(xid1)  ;,xaResource1.start(xid2  ,   XAResource.  TMNOFLAGS  )  ;|报错|
|  
|  
|xaResource1.prepare(xid1)  ;,xaResource1.commit或者rollback,xaResource1.start(xid2  ,   XAResource.  TMNOFLAGS  )  ;|xid1已经结束，xid2可以成功|
|  
|xid已经被其他事务使用未结束（处于active、suspend、parepard状态）|同上面几个场景，把xid2换成xid1|  
|
|xa_end|同一个xa资源处理不同的xid（xid1、xid2）|处于active,xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;    
  xaResource1.end(xid2  ,   XAResource.  TMSUSPEND  )  ;,  
|  
|
|  
|  
|处于suspend,xaResource1.end(xid1  ,   XAResource.  TMSUSPEND  )  ; 或者其他的flag    
  xaResource1.end(xid2  ,   XAResource.  TMSUSPEND  )  ;|xid1已经游离，xid2可以成功|
|  
|  
|xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;,xaResource1commit或者rollback,xaResource1.end(xid2  ,   XAResource.  TMSUSPEND  )  ;|xid1已经结束，xid2可以成功|
|  
|  
|xaResource1.prepare(xid1)  ;,xaResource1.end(xid2  ,   XAResource.  TMSUSPEND  )  ;|报错|
|  
|  
|xaResource1.prepare(xid1)  ;,xaResource1commit或者rollback,xaResource1.end(xid2  ,   XAResource.  TMSUSPEND  )  ;|xid1已经结束，xid2可以成功|
|  
|xid已经被其他事务使用未结束（处于active、suspend、parepard状态）|同上面几个场景，把xid2换成xid1|  
|
|xa_prepare|  
|处于active,xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;    
  xaResource1.prepare(xid2);|报错|
|  
|  
|处于suspend,xaResource1.end(xid1  ,   XAResource.  TMSUSPEND  )  ; 或者其他的flag    
  xaResource1.prepare(xid2);|xid1已经游离，xid2可以成功|
|  
|  
|xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;,xaResource1commit或者rollback,xaResource1.prepare(xid2);|xid1已经结束，xid2可以成功|
|  
|  
|xaResource1.prepare(xid1)  ;,xaResource1.prepare(xid2);|报错|
|  
|  
|xaResource1.prepare(xid1)  ;,xaResource1commit或者rollback,xaResource1.prepare(xid2);|xid1已经结束，xid2可以成功|
|  
|xid已经被其他事务使用未结束（处于active、suspend、parepard状态）|同上面几个场景，把xid2换成xid1|  
|
|xa_commit|xid所在事务已经结束|xaResource1.commit(xid1),xaResource1.commit(xid1)|报错|
|  
|xid挂在其他的session|xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;,xaResource2.commit(xid1)|报错|
|  
|  
|xaResource1.end(xid1  ,   XAResource.  TMNOFLAGS  )  ;,xaResource2.commit(xid1)|一阶段出成功，2阶段报错|
|  
|  
|xaResource1.prepared(xid1)  ;,xaResource2.commit(xid1)|报错|
|  
|  
|xaResource1.commit(xid1),xaResource2.commit(xid1)|报错|
|xa_rollback|xid所在事务已经结束|xaResource1.rollback(xid1),xaResource1.rollback(xid1)|报错|
|  
|xid挂在其他的session|xaResource1.start(xid1  ,   XAResource.  TMNOFLAGS  )  ;,xaResource2.rollback(xid1)|报错|
|  
|  
|xaResource1.end(xid1  ,   XAResource.  TMNOFLAGS  )  ;,xaResource2.rollback(xid1)|成功|
|  
|  
|xaResource1.prepared(xid1)  ;,xaResource2.rollback(xid1)|报错|
|  
|  
|xaResource1.rollback(xid1),xaResource2.rollback(xid1)|报错|
|xid的校验|xid不符合xid的格式（数据前64位不为数字）,xid长度小于、超过长度限制,xid为空,包含特殊字符,不唯一|  
|  
|


  


**4、dfx测试场景**

|分类|场景|预期|
|---|---|---|
|HA|主机上处于各种状态下进行主备倒换，倒换到备机以后，会将所有的XA事务丢弃|  
|
|  
|主机上的xa事务,备机通过xa_recover查询|  
|
|  
|主机上的xa事务，备机通过v$2pc_pending查询|  
|
|  
|备机会拦截相关xa事务的操作|  
|
|KT|XA事务处理各种状态下进行kill，kill拉起后，可以恢复未结束的XA事务，并可以继续接下来的流程|在phase1之前的事务自动回滚,phase1以后，会恢复|
|CT|多个session并发进行分布式事务，xid不同|  
|
|  
|多个session并发进行分布式事务，xid相同|  
|
|  
|多个session并发进行分布式事务，xid不同，数据有交集|  
|
|事务|死锁检测|  
|
|  
|未开启语句重启，并发读写，有数据的交集，事务一致性|  
|
|  
|开启语句重启，并发读写，有数据的交集，事务一致性|  
|
|  
|事务并发过程中带kill|  
|
|  
|事务并发过程中带switchover|  
|
|  
|未决事务的构造？ 在当前模式下如何触发？,一阶段以后断链|  
|
|  
|xa事务中再穿插普通的rollback和commit，还有savepoint|  
|


  


  


|系统级DFX分类|是否涉及|原因|
|---|---|---|
|CT|涉及|分布式事务也存在并发控制，需要验证并发,不同session如果xid相同会报错，xid不同可以成功,不同session修改相同的数据会等待|
|KT|涉及|故障重启、主备切换等场景，需要恢复XA事务能力，除了持久化内容，还需要保证未结束的XA事务恢复后，恢复所持有的资源|
|长稳|不涉及|  
|
|一致性|涉及|xa事务并发，需要保证数据一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR|不涉及|  
|
|HA|涉及|故障重启、主备切换等场景，需要恢复XA事务能力，除了持久化内容，还需要保证未结束的XA事务恢复后，恢复所持有的资源|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|利用当前的jdbc测试框架即可|


# 4. 测试用例

1、测试设计评审时提供冒烟文本用例；

[DBMS_XA门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjAyIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.Vte_7aQVo6NBwWWo01a79q3SXCtBj_IzX133QD8l7-0)

2、启动测试之前提供文本用例，并完成大部分自动化用例；

[DBMS_XA文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjM4OTcwYzJhZjRmNTIxMDkwIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.SJ-NrRuUxRgOTcPncHYW5vV1ASMN8uQ5dRISnO81q98)

# 5. 测试框架设计

- 使用guider测试框架完成功能的自动化
- HA不分使用ha_regress测试框架


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|linux|
|部署|单机|


# 7. 工作量评估

工作量：  *6人周*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[路径覆盖流程.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjAxIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.rYGvjb7NPZ2WN7KA2MsKTCxDitPa5lfHvXsshK-ecms)

 (application/vnd.xmind.workbook)    


[image2024-4-3_14-35-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjAzIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.z527_YezapF4AuFa_o15zp8b3e9m-ttOn6tQpyVuk7g)

 (image/png)    


[image2024-4-3_14-34-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjM4OTcwYzJhZjRmNTIxMDkyIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.SK0m3idB6KR4K8HYUAgyGo05pINIQr9BX7wuJxT37Go)

 (image/png)    


[image2024-4-3_14-33-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjA0IiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.Is8pGlaid1UVhKKAMLGhQ7QbauSJRdKAwkl9uN0BlqA)

 (image/png)    


[image2024-4-3_14-32-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjA1IiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.miYCXNiayz-cBtCO7jbXk5Yi_GYaTD7n-ynHaSLfZ08)

 (image/png)    


[image2024-4-3_14-30-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjM4OTcwYzJhZjRmNTIxMDkzIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.uYXCu1jzI8q-IPMBJxC2h-0semydmK2mbLPA3O98vKo)

 (image/png)    


[状态转换图.eddx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjAwIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.B_CquK-bRE3aPOjPPQfjsOoBmYnPOr35UAGCKA6tgm4)

 (application/octet-stream)    


[状态转换图_prepare_异常.eddx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjM4OTcwYzJhZjRmNTIxMDhmIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.VpRagKBWiM1o-8n3V8qD3-pUT8nouC-EwYzHbuzJ5nU)

 (application/octet-stream)    


[XA协议全量状态转移.emmx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjA2IiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.IMllmfeTuHuvyolX87Tjel4sLr5VRiYTttRVUtVZZTM)

 (application/octet-stream)    


[image2024-4-3_11-43-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjM4OTcwYzJhZjRmNTIxMDk0IiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.EWNXT6yyh5ft-aSnI0FTs3qn9AG6vGBQFI_S9NmbQ1M)

 (image/png)    


[基本转换图片.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjQ4OTcwYzJhZjRmNTIxMDk1IiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9._k-azP8hnJwm0HYFMySiqE4hJ4T8CKDi3eNtYQKbW7Y)

 (image/jpeg)    


[image2024-4-1_11-38-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjQ4OTcwYzJhZjRmNTIxMDk2IiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.xeRhTE45b2qLTYMO3l_HnWEFpqsIao_df9RBsLc1SP8)

 (image/png)    


[DBMS_XA门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjNhMWFkOWEzMzExZGM4ZjAyIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.Vte_7aQVo6NBwWWo01a79q3SXCtBj_IzX133QD8l7-0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[DBMS_XA文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjM4OTcwYzJhZjRmNTIxMDkwIiwicmVmX2lkIjoiNjczOTZkMjM1OTNmOTljOWZmMjM3ODE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTcwLCJleHAiOjE3ODIzOTI1NzB9.SJ-NrRuUxRgOTcPncHYW5vV1ASMN8uQ5dRISnO81q98)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
