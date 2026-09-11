Created by 李道一, last modified by  化明虎 on 十月 14, 2024

#   [YDBRD-14782: 集群支持profile](#ydbrd-14782-集群支持profile)  

  [[YDBRD-14782] 集群支持profile - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-14782)  

##   [1. Overview（概述）](#1-overview概述)  

集群下对单机创建、删除、修改profile进行适配

##   [2. Features（功能特性）](#2-features功能特性)  

集群支持创建、删除、修改profile

##   [3. Interfaces（接口）](#3-interfaces接口)  

接口无改动，与单机相同

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

规格和约束同单机

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

集群下对profile的适配主要考虑两个问题：多实例并发控制以及profile全局生效

同其他大多数适配一样，目前通过GLS锁机制来实现多实例并发控制

profile的广播同步涉及一下几种情况

- profile创建，    `SYNC_CREATE_PROFILE`  
- profile删除，    `SYNC_ALTER_PROFILE`  
- profile修改，    `SYNC_DROP_PROFILE`  
- 用户登录时，因为密码过期、密码错误等原因造成的登录失败，    `SYNC_LOGIN_FAILED`  
- 用户登录时，如果前一次登录失败，但没有超出连续失败次数限制，本次登录成功，同样为    `SYNC_LOGIN_FAILED`  


这五种情况目前用一个广播接口实现    `axcBcstSyncProfile(AnkHandler* handler, CodUint8 action, CodUint32 id)`    ，根据action区分调用场景

######   [CREATE PROFILE](#create-profile)  

类似于用户和角色，profile没有oid，在内存中分配槽位，因此需要将创建profile的动作串行化，同一时刻只能有一个实例在创建profile，确保分配唯一且可用的profile id，上GLS Mutex锁，分配到profile id后给id上GLS排他锁

在其他实例同步时，参考applyCreateProfile函数，分配id，然后从系统表中加载

######   [DROP PROFILE](#drop-profile)  

删除profile时，先上本地排他锁，再上GLS排他锁

同步删除profile时，参考applyDropProfile，清空profile名字，版本号自增

######   [ALTER PROFILE](#alter-profile)  

修改profile时，先上本地排他锁，再上GLS排他锁

同步修改profile时，参考applyAlterProfile，加载系统表

######   [用户登录失败/成功](#用户登录失败成功)  

在登录时，如果需要更新用户profile，会调用    `userUpdateProfile`    函数写系统表并提交，共涉及如下几个函数

```
static CodResult checkLoginStatus(AnkHandler* handler, UserProfile* userProfile, ProfileDict* profileDict)
static void doSetPwdExpire(AnkHandler* handler, UserProfile* userProfile)
static CodResult doSetPwdExpireGrace(AnkHandler* handler, UserProfile* userProfile, CodUint64 graceTime)
static void doUpdateLoginFailed(AnkHandler* handler, UserDict* userDict, ProfileDict* profileDict)
static CodResult doUpdateLoginSuccess(AnkHandler* handler, UserDict* userDict, ProfileDict* profileDict)

```

在写系统表前，给这个用户上GLS排他锁，类型为LOCK_TYPE_LOGIN_FAILED（避免与用户共享锁冲突），在更新系统表成功后，广播

其他实例同步时，重新加载系统表

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

######   [创建、删除profile](#创建删除profile)  

一个实例上创建，另一个实例上删除，串行、乱序、随机执行多次，无卡死，无core

######   [profile的修改以及生效](#profile的修改以及生效)  

*以下操作，在多实例上串行执行*

创建profile，设置连续登录失败次数为3

创建一个用户，使用该profile

赋予该用户创建会话权限

用错误的密码登录3次，第4次应该被锁定

将该用户解锁，修改profile，连续失败次数为5

用错误的密码登录5次，第6次应该被锁定

将该用户解锁，用正确密码登录，应该成功

用错误的密码登录4次，第5次用正确密码登录

再用错误密码登录5次，下一次被锁定

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  