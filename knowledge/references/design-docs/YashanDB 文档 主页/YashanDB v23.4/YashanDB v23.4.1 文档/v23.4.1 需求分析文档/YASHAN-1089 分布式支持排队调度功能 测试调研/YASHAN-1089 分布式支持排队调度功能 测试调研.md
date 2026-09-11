

**目的：**    
1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等
2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)
3.给测试概要设计和测试详细设计做输入

IR：  [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf4d?](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf4d?)  

#YASHAN-1089  分布式支持排队调度功能

# 1. 需求概述

需求描述：

分布式支持排队调度功能，支持多任务队列能力，区分任务高低优先级

场 景：

保证高优先级需求可以正常有资源执行

需求分析：

需求范围：分布式  ~~，单机HA~~



有排队调度了那是否还需要DOP降级，DOP 降级和资源调度的优先级是怎么样的？



# 2. 友商的实现情况

## 2.1 数据库资源管理器定义

数据库资源管理器（Database Resource Manager，简称DBRM）是Oracle数据库中的一个组件，提供了一个框架来控制和管理数据库资源的使用，特别是CPU和I/O资源。DBRM允许DBA根据业务需求和优先级来分配资源，以确保关键任务和应用程序能够获得足够的资源，同时限制非关键任务的资源使用

## 2.2 oracle和yashan对比

|关键项|oracle|yashan||
|---|---|---|---|
|调度分级并排队|过MGMT_P1到MGMT_P8 进行分级|不支持||
|资源类型||CPU、内存、并行执行，  [资源类型 | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E6%95%B0%E6%8D%AE%E5%BA%93%E7%AE%A1%E7%90%86/%E8%B5%84%E6%BA%90%E7%AE%A1%E7%90%86/%E8%B5%84%E6%BA%90%E7%B1%BB%E5%9E%8B.html)  ||
| 涉及SQL||仅列存表支持select/insert into select操作||


## 2.3 资源管理器作用

|作用|实现|备注|
|---|---|---|
|保证会话的最低限度CPU 使用量|CREATE_PLAN_DIRECTIVE.MGMT_P1~MGMT_P8||
|分配CPU时间和可用CPU，面向ROLAP-关系型联机分析处理|CREATE_PLAN_DIRECTIVE.MAX_EST_EXEC_TIME||
|限制并行度|CREATE_PLAN_DIRECTIVE.PARALLEL_DEGREE_LIMIT_P1||
|管理并行语句队列的语句顺序，确保关键应用程序的并行语句在资源分配上优先于低优先级用户组的并行语句|MGMT_P1到MGMT_P8|PARALLEL_DEGREE_POLICY设置为AUTO，先入先出，当SQL所需资源 >PARALLEL_SERVERS_TARGET 剩余资源时，则排队,通过配置和设置资源计划，可以控制并行语句退出队列的顺序,确保高优先级语句排在前面：,MGMT_P1到MGMT_P8代表不同的资源管理级别，其中MGMT_P1具有最高优先级，MGMT_P2次之，以此类推。通过合理配置这些参数，可以确保关键应用程序的并行语句在资源分配上优先于低优先级用户组的并行语句|
|限制并行执行服务器数量|CREATE_PLAN_DIRECTIVE.PARALLEL_SERVER_LIMIT||
|创建active session pool||-由指定的最大用户会话组成，超过最大数量的会话将排队等待，等待超过PARALLEL_QUEUE_TIMEOUT则超时|
|资源监控：视图监控|详见3.3章节||
|限制属于某一用户组的每个会话使用的 PGA 内存量|CREATE_PLAN_DIRECTIVE.SESSION_PGA_LIMIT||
|Runaway Queries管理|管理方式：,- 自动切换消费者组
- 取消SQL和终止会话
- 指定操作允许的最长执行时间
|是指执行时间或消耗资源超出预期的查询，在运行时间和资源消耗上有显著特征|
|阻止执行优化器估计运行时间将超过指定限制的操作|CREATE_PLAN_DIRECTIVE.MAX_EST_EXEC_TIME||
|限制会话空闲的时间|CREATE_PLAN_DIRECTIVE.MAX_IDLE_TIME||
|允许数据库根据不断变化的工作负载需求使用不同的资源计划，以动态更改资源计划|CREATE_PLAN_DIRECTIVE.SWITCH_GROUP||






## 2.4 资源管理器的组成

元素包括资源消费者组、资源计划和资源计划指令

|元素|描述|oracle|yashan|备注|
|---|---|---|---|---|
|资源消费组|根据资源需求分组的一组会话。资源管理器将资源分配给资源使用者组，而不是单个会话。|DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP|同|oracle-任何活动计划中的资源消费者组不得超过 28 个|
|资源计划|指令容器，用于指定如何将资源分配给资源使用者组。您可以通过激活特定资源计划来指定数据库如何分配资源。|DBMS_RESOURCE_MANAGER.CREATE_PLAN|同||
|资源计划指令|将资源消费者组与特定计划关联，并指定如何将资源分配给该资源消费者组。|DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE |||






## 2.5 资源管理器管理的资源类型

|资源类型|oracle详情|yashan|
|---|---|---|
|CPU|属性管理、利用率限制-UTILIZATION_LIMIT |MGMT_P1/MAX_UTILIZATION_LIMIT|
|Exadata I/O |||
|Parallel Execution Servers|并行度限制-PARALLEL_DEGREE_LIMIT_P1,并行服务器限制-PARALLEL_SERVER_LIMIT,并行队列超时-PARALLEL_QUEUE_TIMEOUT|PARALLEL_SERVER_LIMIT|
|PGA |session_pga_limit |内存管理：SPA_LIMIT|
|Runaway Queries|管理方式：,- 自动切换消费者组
- 取消SQL和终止会话
- 指定操作允许的最长执行时间
|当内存分配不足时在队列中等待的超时时间 EXECUTION_QUEUE_TIMEOUT|
|Active Session Pool with Queuing|控制消费者组中允许的最大并发活动会话数||
|Undo Pool|控制消费者组可以生成的未提交事务的撤消总量||
|Idle Time Limit|过此时间量后会话将终止||
||||




# 3. 示例

## 3.1 创建复杂资源计划

|步骤|ORACLE示例|yashan|
|---|---|---|
|创建待处理区域|DBMS_RESOURCE_MANAGER.CREATE_PENDING_AREA();|无|
|创建、修改或删除资源使用组|DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP (  
   CONSUMER_GROUP => 'OLTP',
   COMMENT        => 'OLTP applications');,PS：更新-  UPDATE_CONSUMER_GROUP  ，删除-DELETE_CONSUMER_GROUP|同，无update|
|创建资源计划|DBMS_RESOURCE_MANAGER.CREATE_PLAN(  
   PLAN    => 'DAYTIME',
   COMMENT => 'More resources for OLTP applications');,更新-  UPDATE_PLAN  ，删除-DELETE_PLAN|同，无update|
|创建资源计划指令|DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE (  
   PLAN             => 'DAYTIME',
   GROUP_OR_SUBPLAN => 'OLTP',
   COMMENT          => 'OLTP group',
   MGMT_P1          => 75);,更新-UPDATE_PLAN_DIRECTIVE，删除-DELETE_PLAN_DIRECTIVE|同，无update|
|创建用户映射关系|DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING(    
    ATTRIBUTE      => DBMS_RESOURCE_MANAGER.ORACLE_USER, 
    VALUE          => 'OE', 
    CONSUMER_GROUP => 'OLTP');,|同,,删除-DELETE_CONSUMER_GROUP_MAPPING|
|验证待处理区域|DBMS_RESOURCE_MANAGER.VALIDATE_PENDING_AREA();|无|
| 提交待处理区域|DBMS_RESOURCE_MANAGER.SUBMIT_PENDING_AREA();|无|
|清除待处理区域|DBMS_RESOURCE_MANAGER.CLEAR_PENDING_AREA();|无|
|指定活动资源计划|RESOURCE_MANAGER_PLAN |同|
|资源管理功能开关|无|RSRC_MODE--NONE|CPU|MEM|ALL|
|配置Cgroups|无|场景1-未部署：生成待cgroup的部署配置，yasboot package de gen --create-cgroup,场景2-已部署：所有服务器创建资源管理cgroup目录，yasboot host cgroup create|
||||






## 3.2 其他管理操作

|操作|oracle|yashan  -未实现||
|---|---|---|---|
|将会话属性/值对映射到消费者组|DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING（DBMS_RESOURCE_MANAGER.ORACLE_USER，'SCOTT'，'DEV_GROUP'）|||
|切换资源消费者组-单个会话|DBMS_RESOURCE_MANAGER.SWITCH_CONSUMER_GROUP_FOR_SESS ('17', '12345',  
   'HIGH_PRIORITY');|||
|切换资源消费者组-切换用户的所有会话|DBMS_RESOURCE_MANAGER.  **SWITCH_CONSUMER_GROUP_FOR_USER **  ('HR',  
    'LOW_GROUP');|||
|切换当前资源消费者组|DBMS_SESSION.SWITCH_CURRENT_CONSUMER_GROUP('BATCH_GROUP', old_group, FALSE);|||
|自动切换|BEGIN,  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE (,   PLAN             => 'DAYTIME',,   GROUP_OR_SUBPLAN => 'OLTP',,   COMMENT          => 'OLTP group',,   MGMT_P1          => 75,,   SWITCH_GROUP     => 'LOW_GROUP',,   SWITCH_TIME      => 5);,END;,/||涉及属性,SWITCH_GROUP,SWITCH_TIME,SWITCH_ESTIMATE,SWITCH_IO_MEGABYTES,SWITCH_IO_REQS,SWITCH_FOR_CALL,SWITCH_IO_LOGICAL,SWITCH_ELAPSED_TIME|
|##### 授予切换权限|DBMS_RESOURCE_MANAGER_PRIVS.GRANT_SWITCH_CONSUMER_GROUP (  
   GRANTEE_NAME   => 'SCOTT',
   CONSUMER_GROUP => 'OLTP',
   GRANT_OPTION   =>  TRUE);|||
|撤销切换权限|DBMS_RESOURCE_MANAGER_PRIVS.REVOKE_SWITCH_CONSUMER_GROUP（  
   REVOKEE_NAME => 'SCOTT',
   CONSUMER_GROUP => 'OLTP');|||
|设置资源组切换优先集|SET_CONSUMER_GROUP_MAPPING_PRI，||查看当前会话属性的优先级顺序DBA_RSRC_MAPPING_PRIORITY|




## 3.3 视图-资源监控及查看资源管理器配置和状态

DBA_RSRC_CONSUMER_GROUP_PRIVS视图显示授予用户或角色的消费者组

DBA_RSRC_PLANS视图显示数据库中定义的所有资源计划

V$SESSION视图显示当前分配给会话的消费者组

V$RSRC_PLAN视图显示当前活动的计划

|oracle字段视图|描述|oracle字段|yashan|
|---|---|---|---|
|V$RSRC_PLAN|显示当前活动的资源计划及其子计划|||
|V$RSRC_CONSUMER_GROUP|监视所消耗的资源，包括 CPU、I/O 和并行执行服务器。它还可用于监视与 CPU 资源管理、失控查询管理、并行语句排队等相关的统计信息|ACTIVE_SESSIONS、QUEUE_LENGTH、CONSUMED_CPU_TIME、CPU_WAITS、CPU_WAIT_TIME|V$RSRC_CONSUMER_GROUP,NAME、SPA_LIMIT_QUOTA、SESSION_SPA_LIMIT_QUOTA、SPA_REMAIN_QUOTA、SPA_MAX_USE_QUOTA、SESSION_SPA_RESERVED_QUOTA、SPA_LIMIT_EXCEED_TIMES、SESSION_SPA_LIMIT_EXCEED_TIMES|
|V$RSRC_SESSION_INFO|监视一个或多个会话的状态。该视图显示会话如何受到资源管理器的影响，指标的当前和累计统计信息，例如 CPU 消耗、等待时间、排队时间和使用的活动并行服务器数量|||
|V$RSRC_PLAN_HISTORY|显示实例上启用或禁用资源计划的时间|||
|V$RSRC_CONS_GROUP_HISTORY|消费者组之间的资源共享情况|CPU_WAIT_TIME CPU_WAITS CONSUMED_CPU_TIME||
|V$RSRCMGRMETRIC|跟踪一分钟实时指标，以毫秒为单位的 CPU 指标、以会话数为单位的指标或以过去一分钟的利用率为单位的指标|||
|V$RSRCMGRMETRIC_HISTORY|跟踪60分钟指标|||
||||V$CPUSTAT监控集群上资源使用组的CPU使用情况|
||||V$SESSION_SPA-监控会话SPA内存使用情况|
||||V$PX_RES_MGR-监控并行资源使用情况|










# 4.关联SR：

|  
|SR|开发设计|测试设计|测试用例|
|---|---|---|---|---|
|  
|  [[YDBRD-13254] 支持执行资源管理框架](https://jira.yasdb.com/browse/YDBRD-13254?src=confmacro)  |  [支持并行执行调度的能力设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138564055)  |  [分布式支持执行资源管理框架测试设计](https://pingcode.yasdb.com/wiki/pages/67396bdd728206efb92f0adc)  ,  [支持并行执行调度能力测试](https://conf.yasdb.com/pages/viewpage.action?pageId=144121289)  |  [YDBRD_13254上传用例 (!6227)](https://git.yasdb.com/cod-test/yasft/-/merge_requests/6227/diffs)  ,  [stress_test/scenario/set_stagegroup_TPCDS_10G_query.jmx](https://git.yasdb.com/cod-x/yastest_dfx/-/blob/master/stress_test/scenario/set_stagegroup_TPCDS_10G_query.jmx)  |
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


  


# 5. 参考文档

  [Using Parallel Execution (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/vldbg/using-parallel.html#GUID-4A311C0C-8ABC-4E5A-A854-19F04DACBC36)  

  [Finding the Reason for DOP Downgrades (oracle.com)](https://blogs.oracle.com/datawarehousing/post/finding-the-reason-for-dop-downgrades)  

# 6. 后续关注(可选)

*后续测试设计与执行过程中需跟友商做细化对比的内容*