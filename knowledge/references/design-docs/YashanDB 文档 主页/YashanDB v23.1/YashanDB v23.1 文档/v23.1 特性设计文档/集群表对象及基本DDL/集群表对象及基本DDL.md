Created by 黄杨波, last modified on 五月 11, 2023

#   [YDBRD-13432 : 集群支持表对象及基本DDL方案设计](#ydbrd-13432--集群支持表对象及基本ddl方案设计)  

  [https://jira.yasdb.com/browse/YDBRD-13432](https://jira.yasdb.com/browse/YDBRD-13432)  

##   [1. Overview（概述）](#1-overview概述)  

单机下只有一个节点，执行create table(as select)/drop table等ddl产生或销毁的entry内存以及alter table/truncate table失效dc可以直接在本地可见，且ddl/dml、ddl/ddl并发在本地可以依靠latch lock处理。集群下存在多个写节点，节点之间需要并发控制ddl/ddl、ddl/dml的并发(create table通过写系统表处理并发，无需加gls lock、alter/truncate/drop table通过gls X lock处理并发)，且当一个节点执行完ddl后只有本地产生或销毁entry内存，需要把entry内存的处理同步到其他实例使其他实例对该ddl操作的影响可见

##   [2. Features（功能特性）](#2-features功能特性)  

1. 集群下某个实例执行create table(as select)/alter table/truncate table/drop table，其他实例能感知到ddl产生的影响
1. 支持多实例的table ddl并发(通过Gls Lock和gcs写系统表实现)


##   [3. Interfaces（接口）](#3-interfaces接口)  

主要是在ddl的二阶段提交中提供实例间广播同步内存信息的接口(并发处理由其他模块支持，这里不进行详细说明)

1. 函数接口


|name|Meaning|
|---|---|
|AXC_CB->axcBcstCreateTable|广播同步create table产生的entry|
|AXC_CB->axcBcstDropTable|广播同步drop table销毁的entry和dc|
|AXC_CB->axcBcstAlterTable|广播同步alter table失效dc的操作|


1. 消息接口


|name|function|Meaning|
|---|---|---|
|MSG_CREATE_TABLE|msgCreateTable|执行实例广播给其他实例同步entry内存|
|MSG_CREATE_TABLE_ACK|msgNullFunc|其他实例同步完成后返回执行实例ack|
|MSG_DROP_TABLE|msgDropTable|执行实例广播给其他实例删除entry内存|
|MSG_DROP_TABLE_ACK|msgNullFunc|其他实例删除完成后返回执行实例ack|
|MSG_ALTER_TABLE|msgAlterTable|执行实例广播给其他实例失效dc|
|MSG_ALTER_TABLE_ACK|msgNullFunc|其他实例失效完成后返回执行实例ack|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

create table语法树支持范围：

1. GLOBAL/PRIVATE TEMPORARY全局临时表和私有临时表目前都支持，但temp表空间现在存在问题，但是支持使用的，如果有问题不属于这个表SR修复，只支持HEAP不支持TAC
1. 不支持分布表、复制表
1. 不支持TAC/LSC列表
1. 不支持嵌套表
1. create table nologging在使用的时候，任何的失败，比如插入失败等等，都需要广播失效标记，需要适配，此SR不支持


alter table语法树支持范围：

1. nologging转化为logging时，需要集群所有实例一起做ckpt，需要适配（LOGGING ASYNC为启动线程做nologging转化，此处也需要适配），此SR不支持
1. 不支持开启附加日志
1. 不支持alter table shrink space


truncate table支持所有语法

drop table支持所有语法

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

```
typedef struct StRecCreateTable {
    CodChar    tabName[COD_NAME_BUFFER_SIZE];
    CodUint64  objId;
    CodUint32  userId;
    ObjectType type;
} RecCreateTable;

```

```
typedef struct StRecDropTable {
    CodUint32 userId;
    CodChar   tabName[COD_NAME_BUFFER_SIZE];
} RecDropTable;

```

```
typedef struct StRecAlterTable {
    CodUint64 oid;
} RecAlterTable;

```

###   [5.2 方案实现](#52-方案实现)  

create table(as select)：

1. 按照单机逻辑执行create table，因为涉及到写系统表，同一时刻只能有一个实例获取到系统表对应的block，当更新完成后，其他并发create table的实例拿到block后发现系统表上已经有信息，则返回报错，通过这个方式处理create table的并发问题
1. 当在本地执行完单机的create table逻辑后，进行二阶段提交，在二阶段提交中调用AXC_CB->axcBcstCreateTable广播其他实例同步entry，广播的内容为RecCreateTable结构体中的内容
1. 当收到其他所有实例的ack后，二阶段提交完成，此时其他实例均能看到table


drop table：

1. 按照单机逻辑执行drop table，单机逻辑下是需要上latch X lock，而在集群模式下还需要上gls X lock处理实例间的并发
1. 当在本地执行完单机的drop table逻辑后，进行二阶段提交，在二阶段提交中调用AXC_CB->axcBcstDropTable广播其他实例销毁entry和dc，广播的内容为RecDropTable结构体中的内容
1. 当收到其他所有实例的ack后，二阶段提交完成，此时其他实例均无法看到table


alter/truncate table：

1. 按照单机逻辑执行alter/truncate table，单机逻辑下是需要上latch X lock，而在集群模式下还需要上gls X lock处理实例间的并发
1. 当在本地执行完单机的alter/truncate table逻辑后，进行二阶段提交，在二阶段提交中调用AXC_CB->axcBcstAlterTable广播其他实例失效dc，广播的内容为RecAlterTable结构体中的内容
1. 当收到其他所有实例的ack后，二阶段提交完成，此时其他实例均没有最新的dc，如果需要访问表则需要重新从系统表加载dc


create/drop/alter table并发场景分析及解决方案

1. create table：create table没有上任何的gls lock，通过写系统表+gcs控制并发，广播到部分实例后，会存在部分实例可见table，部分实例不可见，可见table的实例可以进行drop/alter/dml操作，因此可能出现create/drop/alter乱序的消息处理。解决方案：create table二阶段广播前，现根据table oid上RW X lock阻塞部分可见实例的操作，避免乱序
1. drop table：drop table上的是oid的RW X lock，广播到部分实例后，会存在部分实例不可见table，部分实例可见。可见实例由于RW X lock，无法对表进行操作。不可见实例可以创建同名table，但由于table oid是不一致的，因此create二阶段是可以上RW X l的，因此可能会出现drop/create消息乱序处理的情况，两张表虽然名字一样，但oid不一样，如果是drop先于create执行，则没有问题，如果是create先于drop执行，由于table插入nameIndex和oidIndex是头插到bucket中，在drop消息过来之前，查找bucket也是先找到后面新的同名table，而旧的同名table会在后续的drop消息中通过oid查找entry，进而直接通过entry准确的在nameIndex和oidIndex删除掉旧的table entry，因此没有问题
1. alter table：alter table广播到部分实例后，会存在部分实例失效dc、部分实例未失效dc的情况，不会产生异常情况，因为alter上了X锁，dml与drop无法并发，且由于表是实际存在的，因此无法创建同名表


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 实例0 create table，实例1、2端验证table的存在
1. 实例0 drop table，实例1、2验证table的销毁
1. 实例0 alter table，实例1、2验证table的变化
1. 实例0 truncate table，实例1、2验证table的内容清空
1. 验证以上ddl的交叉并发是否正确
1. 验证以上ddl与dml交叉并发是否正确


##   [7.资料设计章节](#7资料设计章节)  

开发手册-SQL参考手册-SQL语句下相应语法文档增加使用限制描述。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

1. 目前广播接口是复用的备机重演的接口逻辑，在集群模式下涉及消息重试，在线日志恢复等等，因此需要重写一套适合集群的同步接口
1. 不支持分布表、复制表、TAC/LSC列表(需要从代码层面拦截，本需求禁用)
1. 不支持嵌套表(需要做适配工作，方案待定，本需求禁用)
1. create table nologging在使用的时候，任何的失败，比如插入失败等等，都需要广播失效标记，需要适配(本需求禁用)
1. nologging转化为logging时，需要集群所有实例一起做ckpt，需要适配（LOGGING ASYNC为启动线程做nologging转化，此处也需要适配，本需求禁用）
1. 使用nologging table失败时适配方案：在rollback给entry打上失效标记时，进行广播，同步失效标记。truncate table时会恢复这个标记，因此在truncate table广播失效dc时需要判断一下是否要恢复entry失效标记
1. nologging转化为logging非异步适配方案：在alter table执行全量ckpt时，需要同步所有实例共同执行全量ckpt，执行完成后二阶段广播失效dc
1. nologging转化为logging异步适配方案：在给entry->inLoggingAsync置为true时，广播同步这个entry的更新信息，广播完成后再启动tabSetLoggingProc线程进行异步的转化。在tabSetLoggingProc线程中广播所有实例共同执行全量ckpt，执行完成后在二阶段提交时将entry信息置回，广播同步entry的置回信息，并失效dc
1. 不支持开启附加日志
1. 不支持alter table shrink space
