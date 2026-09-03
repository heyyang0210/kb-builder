## 对比

|对比项|Oracle|StarRocks|OceanBase|
|---|---|---|---|
|排队机制|active session pool|查询队列|大查询列表，实现限流策略（不是很系统）|
|队列范围|资源使用组级别|支持全局及资源组粒度|全局|
|排队的时机|活跃会话数达到上限，|并发查询数量或资源使用率（CPU、内存、并发度）达到一定阈值|执行超过5s的查询标记为大查询，总的大查询线程超过30%后被挂起|
|出队列时机|活跃会话空余，先进先出|等待有足够的计算资源才能开始执行|小查询执行一段时间后，大查询继续执行|
|是否实现优先级|使用组内没有区分优先级|使用组内没有区分优先级|无|
|排队异常处理|排队等待超时后终止会话并报错|排队等待超时后终止会话并报错|无|
|跟资源的联动|不明显|BE默认每隔1秒向FE报告资源使用情况|无|
|其他|OLTP、当连接池或用来控制并发|通过开关各自控制导入任务、select查询或者统计信息查询是否启用查询队列管理；是否启用资源组粒度查询队列，也是通过开关控制||


## Oracle

### 简介

Active Session Pool with Queuing  
You can control the maximum number of concurrently active sessions allowed within a consumer group. This maximum defines the active session pool.

### 描述

26.1.3.3.1.6 Active Session Pool with Queuing  
You can control the maximum number of concurrently active sessions allowed within a consumer group. This maximum defines the active session pool.

An active session is a session that is actively processing a transaction or SQL statement. Specifically, an active session is either in a transaction, holding a user enqueue, or has an open cursor and has not been idle for over 5 seconds. An active session is considered active even if it is blocked, for example waiting for an I/O request to complete. When the active session pool is full, a session that is trying to process a call is placed into a queue. When an active session completes, the first session in the queue can then be removed from the queue and scheduled for execution. You can also specify a period after which a session in the execution queue times out, causing the call to terminate with an error.

Active session limits should not be used for OLTP workloads. In addition, active session limits should not be used to implement connection pooling or parallel statement queuing.

To manage parallel statements, you must use parallel statement queuing with the PARALLEL_SERVER_LIMIT attribute and management attributes (MGMT_P1, MGMT_P2, and so on).

### 相关配置值

- ACTIVE_SESS_POOL_P1


Specifies the maximum number of concurrently active sessions for a consumer group. Other sessions await execution in an inactive session queue. Default is UNLIMITED.

- QUEUEING_P1


Specifies time (in seconds) after which a session in an inactive session queue (waiting for execution) times out and the call is terminated. Default is UNLIMITED.

Oracle通过活跃会话池实现排队机制

### 可维可测

#### V$RSRC_CONSUMER_GROUP

|字段|类型|说明|备注|
|---|---|---|---|
|ACTIVE_SESSIONS|NUMBER|Number of sessions waiting in the queue  当前活跃会话数||
|EXECUTION_WAITERS|NUMBER|Number of currently active sessions waiting for an execution time slice in which they will be able to use CPU|当前时间片上执行的活跃会话数|
|REQUESTS|NUMBER|Cumulative number of requests that were executed in the consumer group||
|QUEUE_LENGTH|NUMBER|Number of sessions waiting in the queue|当前等待执行的会话数|
|ACTIVE_SESSION_LIMIT_HIT|NUMBER|Number of times that sessions in the consumer group were queued because the consumer group reached its active session limit|活跃会话达到上限次数|
|QUEUED_TIME|NUMBER|Total amount of time that sessions in the consumer group have spent in the QUEUED state because of the active session limit (in milliseconds)||
|QUEUE_TIME_OUTS|NUMBER|Number of times that requests from sessions in the consumer group timed out because they were queued for too long (reached QUEUEING_P1)||


示例

```
SELECT name, active_sessions, queue_length,
  consumed_cpu_time, cpu_waits, cpu_wait_time
  FROM v$rsrc_consumer_group;

NAME               ACTIVE_SESSIONS QUEUE_LENGTH CONSUMED_CPU_TIME  CPU_WAITS CPU_WAIT_TIME
------------------ --------------- ------------ ----------------- ---------- -------------
OLTP_ORDER_ENTRY                 1            0             29690        467          6709
OTHER_GROUPS                     0            0           5982366       4089         60425
SYS_GROUP                        1            0           2420704        914         19540
DSS_QUERIES                      4            2           4594660       3004         55700
```

### V$RSRC_SESSION_INFO

|字段|类型|说明|备注|
|---|---|---|---|
|SID|NUMBER|Session identifier||
|CURRENT_CONSUMER_GROUP|VARCHAR2(32)|The name of the consumer group in which the session currently belongs||
|STATE|VARCHAR2(32)|Current state of the session: RUNNING/QUEUED/IDLE/WAITING||
|CURRENT_QUEUED_TIME|NUMBER|Amount of time (in milliseconds) the current request from the session has been queued (in state QUEUED). If the session does not have a request currently queued up, then this number will be zero.|当前等待调度时间|
|QUEUED_TIME|NUMBER|Total amount of time (in milliseconds) the session has spent in the QUEUED state (in its lifetime)|总共等待调度时间|
|QUEUE_TIME_OUTS|NUMBER|Number of times requests from the session timed out because they queued longer than the Resource Manager plan's limit|等待调度超时次数|


## StarRocks

### 简介

查询队列  
本文档介绍如何在 StarRocks 中管理查询队列。

自 v2.5 版本起，StarRocks 支持查询队列功能。启用查询队列后，StarRocks 会在并发查询数量或资源使用率达到一定阈值时自动对查询进行排队，从而避免过载加剧。待执行查询将在队列中等待直至有足够的计算资源时开始执行。自 v3.1.4 版本起，StarRocks 支持设置资源组粒度的查询队列功能。

您可以为 CPU 使用率、内存使用率和查询并发度设置阈值以触发查询队列。

### 启用查询队列

StarRocks 默认关闭查询队列。您可以通过设置相应的全局会话变量（Global session variable）来为 INSERT 导入、SELECT 查询和统计信息查询启用全局或资源组粒度的查询队列。

#### 启用全局查询队列

设置以下全局会话变量来为导入任务、SELECT 查询或统计信息查询启用全局查询队列管理。

为导入任务启用查询队列：  
SET GLOBAL enable_query_queue_load = true;

为 SELECT 查询启用查询队列：  
SET GLOBAL enable_query_queue_select = true;

为统计信息查询启用查询队列：  
SET GLOBAL enable_query_queue_statistic = true;

#### 启用资源组粒度查询队列

从 v3.1.4 开始，StarRocks 支持资源组粒度查询队列。

如需启用资源组粒度查询队列，除上述全局会话变量之外，您还需要额外设置 enable_group_level_query_queue。

SET GLOBAL enable_group_level_query_queue = true;

### 指定资源阈值

#### 全局粒度的资源阈值

您可以通过以下全局会话变量设置触发查询队列的阈值：query_queue_concurrency_limit、query_queue_mem_used_pct_limit、query_queue_cpu_used_permille_limit

说明

默认设置下，BE 每隔一秒向 FE 报告资源使用情况。您可以通过设置 BE 配置项 report_resource_usage_interval_ms 来更改此间隔时间。

#### 资源组粒度的资源阈值

从 v3.1.4 开始，您可以在创建资源组时为其设置各自的并发查询上限 concurrency_limit 和 CPU 核数上限 max_cpu_cores。当发起一个查询时，如果任意一项资源占用超过了全局粒度或资源组粒度的资源阈值，那么查询会进行排队，直到所有资源都没有超过阈值，再执行该查询

您可以通过 SHOW USAGE RESOURECE GROUPS 来查看每个资源组在每个 BE 上的资源使用信息，参见查看资源组的使用信息。

### 监控指标

您可以通过监控报警功能获取相应监控指标观测查询队列。下列 FE 指标为各 FE 节点基于自身的统计数据得出。

指标    单位    类型    描述  
starrocks_fe_query_queue_pending    个    瞬时值    当前正在队列中的查询数量。
starrocks_fe_query_queue_total    个    瞬时值    历史排队过的查询数量（包括正在运行的查询）。
starrocks_fe_query_queue_timeout    个    瞬时值    排队超时的查询总数量。
starrocks_fe_resource_group_query_queue_total    个    瞬时值    该资源组历史排队的查询数量（包括正在运行的查询）。Label name 表示该资源组的名称。从 v3.1.4 版本起，StarRocks 支持该指标。
starrocks_fe_resource_group_query_queue_pending    个    瞬时值    该资源组正在排队的查询数量。Label name 表示该资源组的名称。从 v3.1.4 版本起，StarRocks 支持该指标。
starrocks_fe_resource_group_query_queue_timeout    个    瞬时值    该资源组排队超时的查询数量。Label name 表示该资源组的名称。从 v3.1.4 版本起，StarRocks 支持该指标。

## OceanBase

资源限流最佳实践

大查询处理策略

当一个线程执行的 SQL 被判定为大查询, 执行大查询的线程会被标记为大查询线程，此时，系统仅允许一定数量的线程继续执行大查询（默认是 30%），剩下的线程就会被挂起。由于租户活跃线程数为固定值（cpu_count * cpu_quota_concurrency），在大查询线程挂起自身的同时，系统会分配一个新的线程来处理队列中的新请求，这样就为其它的小查询让出 CPU ，待小查询执行一段时间后，大查询继续执行，保证小查询高时效性的同时也不会影响大查询的最终完成，从而提高整体的用户体验和系统的响应性能。

提前识别大查询

如果集群中有大量的大查询，且都是在执行中才被判定为大查询，则有可能会耗光租户工作线程，导致小查询无法执行。因此，OceanBase 数据库在 SQL 编译期也增加了大查询预定。在 SQL 开始执行之前从 Plan Cache 中获取 SQL 的执行计划, 通过平均执行时间是否超过大查询阈值来判定其是否为大查询。如果某个 SQL 被预判为大查询，那么该 SQL 就会被放入一个特殊的大查询队列重试，其线程会被释放，系统就能接着执行后面的请求了。

查询限流记录

通过视图 gv$ob_plan_cache_plan_stat 可以查看大查询的限制记录。重点关注 LARGE_QUERYS 列（被判断为大查询的次数）和 DELAYED_LARGE_QUERYS 列（被判断为大查询且被丢入大查询队列的次数）。