Created by 汪少华, last modified on 六月 27, 2023

  [https://pingcode.yasdb.com/pjm/items/6766352a622069d46dfaab83?](https://pingcode.yasdb.com/pjm/items/6766352a622069d46dfaab83?)  

#YDBRD-36808 create table as select支持重试

##   [1. Overview（概述）](#1-overview概述)  

当前在insert select阶段，如果遇到资源不足，并没有重试，直接报错返回给客户端了。需要支持重试，对齐insert into select

##   [2. Features（功能特性）](#2-features功能特性)  

执行create table as select时，如果在insert into select阶段发生类似资源不足的错误，支持重试一段时间，一般错误约30s。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

单机和集群仍保持原设计，不支持重试执行re-execute.

heap 表不支持 re-execute.（原因heap表不支持ctas

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

关于create table as select流程梳理

1.首先执行DDL

2.判断是否存在CTAS

3.如存在，执行CTAS，执行成功，提交事务

4.如果执行失败，在失败分支立刻回滚insert into select事务

5.判断错误码是否需要重试执行，如重试则返回第三步，当前最大重试时间为30s，列执行，配额相关错误码不受超时时间控制，即不超时重试。

6.不需要重试，失败流程直接退出



|错误场景|判断方式|create table as select 是否可能涉及|其他|
|---|---|---|---|
|内存配额不足导致需要重试|execQuotaRetry,ERR_ANS_EXEC_PX_RES_UNAVAILABLE,ERR_RES_QUOTA_PX_CONGESTION,ERR_RES_USER_MEM_QUOTA_CONGESTION|是||
|列执行相关错误需要重试|colNeedReExecute|是||
|cm集群管理相关错误需要重试|dstbCmErrorCodeNeedRetry,ERR_DSTB_CM_NORMAL_NODE_NOT_FOUND,ERR_DSTB_CM_PRIMARY_NODE_NOT_FOUND|是||
|plan cache失效|ERR_DSTB_CONTEXT_MISMATCH,ERR_DSTB_PLAN_CONTEXT_MISMATCH|是|23.2版本不涉及|
|一些crab或者ank相关错误码|ERR_CRAB_MEM_ALLOC_ERROR,ERR_CRAB_ALLOC_MATERIAL_QUOTA_ERROR,ERR_ANK_CONSISTENT_WRITE|是||
|会话相关错误|dphConnNeedRetry,ERR_DSTB_INVALID_SESSION,ERR_ANS_INSTANCE_SERVICE_UNAVAILABLE,ERR_ANS_DB_NOT_READWRITE|是||


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

|错误码|故障点||insert into select 表现|
|---|---|---|---|
|ERR_DSTB_CM_NORMAL_NODE_NOT_FOUND|FP_DDL_5|可正常重试|可正常重试|
|ERR_DSTB_CM_PRIMARY_NODE_NOT_FOUND|FP_DDL_6|可正常重试|可正常重试|
|ERR_RES_QUOTA_PX_CONGESTION|FP_DDL_7|可正常重试|可正常重试|
|ERR_RES_USER_MEM_QUOTA_CONGESTION|FP_DDL_8|可正常重试|可正常重试|
|ERR_CRAB_MEM_ALLOC_ERROR|FP_DDL_9|可正常重试|可正常重试|
|ERR_CRAB_ALLOC_MATERIAL_QUOTA_ERROR|FP_DDL_10|可正常重试|可正常重试|
|ERR_ANK_CONSISTENT_WRITE|FP_DDL_11|YAS-03730 append to memory slice failed, the whole transaction has been rolled back 直接失败（cancel的够早就不会出现|YAS-03730 append to memory slice failed, the whole transaction has been rolled back 直接失败（cancel的够早就不会出现|
|ERR_DSTB_INVALID_SESSION|FP_DDL_12|YAS-01204 the transaction has been fully rolled back because of the failure of rolling back current transaction 直接失败 |YAS-01204 the transaction has been fully rolled back because of the failure of rolling back current transaction 直接失败 |
|ERR_ANS_INSTANCE_SERVICE_UNAVAILABLE|FP_DDL_13|YAS-01204 the transaction has been fully rolled back because of the failure of rolling back current transaction,YAS-06027 instance service unavailable, reason: test 直接失败|YAS-01204 the transaction has been fully rolled back because of the failure of rolling back current transaction,YAS-06027 instance service unavailable, reason: test 直接失败|
|ERR_ANS_DB_NOT_READWRITE|FP_DDL_14|不触发重试，同时报错transaction rollback all|不触发重试，同时报错transaction rollback all|
|ERR_ANS_EXEC_PX_RES_UNAVAILABLE|FP_DDL_15|需要配合资源管理使用|需要配合资源管理使用|
|一般非重试错误|FP_DDL_16|立即失败退出|立即失败退出|
|||||
|||||


##   [7. Document（资料）](#7-document资料)  

不涉及

##   [8. Workload（工作量）](#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

