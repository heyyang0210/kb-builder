Created by 黄杨波, last modified by  牛亚娜 on 十月 24, 2023

#   [YDBRD-15423 : 设计、优化GLS视图](#ydbrd-15423--设计优化gls视图)  

  [https://jira.yasdb.com/browse/YDBRD-15423](https://jira.yasdb.com/browse/YDBRD-15423)  

##   [1. Overview（概述）](#1-overview概述)  

集群全局锁服务主要涉及两部分内存，一部分是requester实例本地管理的gls lock内存(这部分内存主要记录的这个实例上gls lock的信息，如mode、status、shareCount等)，另一部分是master实例管理的grc lock item内存(这部分内存主要记录的某个lockId的gls lock的ownerMap、ownerCount、Xowner等)。集群GLS动态视图主要展示的是每个实例上的第一部分内存，即这个实例当前申请了哪些gls lock，这些gls lock的状态是怎么样的。不涉及第二部分内存，第二部分属于grc内存，会在grc动态视图中展示。

##   [2. Features（功能特性）](#2-features功能特性)  

可以查看当前实例本地获取了哪些gls lock，这些gls lock当前的全局权限、本地权限是什么状态等信息。

##   [3. Interfaces（接口）](#3-interfaces接口)  

提供V$GLS_LOCK视图，用户可以直接select查询该视图

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 视图字段结构](#51-视图字段结构)  

|字段|类型|描述|
|---|---|---|
|ID|BIGINT|全局锁ID|
|TYPE|VARCHAR(32)|全局锁TYPE|
|RESOURCE_NAME|VARCHAR(128)|全局资源ID|
|GLOBAL_STATUS|TINYINT|缓存的MASTE RESOURCE的锁状态，本地释放锁后不会清除MODE|
|LOCAL_STATUS|TINYINT|本地的锁状态|
|SHARE_COUNT|SMALLINT|共享锁持有者数量|
|XID|BIGINT|持有排他锁的XRM XID|


###   [5.2 视图字段说明](#52-视图字段说明)  

####   [ID：此字段为全局锁ID](#id此字段为全局锁id)  

1. table为objectId
1. user/role为profileId
1. tablespace为spaceId
1. 一些系统的lockId，如LOCK_SPACE_DDL=0、LOCK_SPACE_MANAGER=1(控制实例并发创建/删除/alter tablespace)、LOCK_USER_CREATE=3(控制实例并发创建user)、LOCK_KERNEL_BUILD=3


####   [TYPE：全局锁TYPE](#type全局锁type)  

1. OBJECT_LOCK
1. USER_LOCK
1. ROLE_LOCK
1. SYSTEM_LOCK
1. SEGMENT_LOCK
1. SEGMENT_EXTEND_LOCK
1. SPC_EXTENT_LOCK
1. INTERVAL_EXTEND_LOCK
1. UNKNOWN


####   [RESOURCE_NAME：全局资源ID](#resource-name全局资源id)  

在代码实现中，全局资源ID为UINT64，前56位为全局锁ID，后8位为全局锁TYPE。所以RESOURCE_NAME整体表现为一个字符串'[A],[B]'，A为全局锁ID，B为全局锁TYPE

####   [GLOBAL_STATUS：缓存的MASTE RESOURCE的锁状态](#global-status缓存的maste-resource的锁状态)  

0：NONE

1：SHARE

2：EXCLUSIVE

####   [LOCAL_STATUS：本地的锁状态](#local-status本地的锁状态)  

0：IDLE

1：SHARE

2：INTENTIONAL EXCLUSIVE

3：EXCLUSIVE

####   [XID：持有排他锁的XRM XID](#xid持有排他锁的xrm-xid)  

此字段用于显示X锁所对应的事务，当LOCAL_STATUS=EXCLUSIVE时，此字段才具备意义，否则为NULL

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 实例执行表的dml/ddl操作，验证V$GLS_LOCK视图判断对应的oid的gls lock是否存在，锁模式是否匹配，涉及到的gls lock有(oid + OBJECT_LOCK/SEGMENT_LOCK/SEGMENT_EXTEND_LOCK/INTERVAL_EXTEND_LOCK)。OBJECT_LOCK为表锁处理dml/ddl，SEGMENT_LOCK控制多实例并发创建segment，SEGMENT_EXTEND_LOCK控制多实例并发segment拓展，INTERVAL_EXTEND_LOCK控制多实例并发interval分区拓展
1. 实例执行user操作，验证V$GLS_LOCK视图，涉及到的gls lock有(user profileId + USER_LOCK、LOCK_USER_CREATE=3 + SYSTEM_LOCK)。user profileId + USER_LOCK控制多实例对user的dml/ddl，LOCK_USER_CREATE=2 + SYSTEM_LOCK控制多实例并发创建user
1. 实例执行tablespace操作，验证V$GLS_LOCK视图，涉及到的gls lock有(LOCK_SPACE_MANAGER=1 + SYSTEM_LOCK、tablespace id + SPC_EXTENT_LOCK)。LOCK_SPACE_MANAGER=1 + SYSTEM_LOCK控制多实例并发tablespace ddl即create、drop、alter，tablespace id + SPC_EXTENT_LOCK控制多实例并发进行tablespace extent处理即drop datafile、shrik等
1. 实例执行grant role to user会给role上gls S lock(role profileId + ROLE_LOCK)，目前只有normal role才会上锁，sys role不会上锁(sys role不会被drop)
1. LOCK_SPACE_DDL、LOCK_KERNEL_BUILD暂没有使用，为预留类型


##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  