Created by 刘美秀, last modified on 十月 31, 2024

**目的：**    
  1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等    
  2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)    
  3.给测试概要设计和测试详细设计做输入

IR：    [https://pingcode.yasdb.com/ship/ideas/667e57575d57e18ea9d3cb91](https://pingcode.yasdb.com/ship/ideas/667e57575d57e18ea9d3cb91)    ?    
  #YASHAN-2948 执行调度框架自适应调整并行度的算法改进

# 1. 需求概述

需求描述：

执行调度框架自适应调整并行度的算法改进

场 景：

在线程资源成为瓶颈时，当前的算法是简单粗暴，将DOP调整为1，需要实现更平滑的算法

# 2. 友商的实现情况

oracle

## **前言**  ：

（1）并行执行

并行执行是指通过使用多个进程将多个 CPU 和 I/O 资源应用于单个 SQL 语句的执行的能力

|  
|并行|串行|
|---|---|---|
|应用场景|并行执行改进了以下方面的处理：,- 需要大型表扫描、联接或分区索引扫描的查询
- 创建大型索引
- 创建大型表，包括具体化视图
- 批量插入、更新、合并和删除
|小数据集查询,  
|
|适合资源|- 对称多处理器 （SMP）、集群或大规模并行系统
- 足够的 I/O 带宽
- 未充分利用或间歇性使用的 CPU（例如，CPU 使用率通常低于 30% 的系统）
- 足够的内存来支持其他内存密集型进程，例如排序、哈希和 I/O 缓冲区
,涉及影响：CPU、磁盘IO、网络|大量使用 CPU、内存或 I/O 资源的环境|


（2）并行执行服务器池

如果池中的并行执行服务器都被占用，并且并行执行服务器的最大数量已启动，则并行执行协调器将切换到串行处理

## 相关实现

### 自动并行度

自动并行度 （Auto DOP） 使 Oracle 数据库能够自动决定语句是否应并行执行以及应使用什么 DOP。

以下是启用自动 DOP 时的并行语句处理摘要。

1. 发出 SQL 语句。
1. 解析该语句，优化器确定执行计划。
1. 检查 initialization 参数指定的阈值限制。    `PARALLEL_MIN_TIME_THRESHOLD`  
    1. 如果预期执行时间小于阈值限制，则 SQL 语句将串行运行。
    1. 如果预期执行时间大于阈值限制，则根据优化器计算的 DOP 并行运行该语句，包括考虑任何定义的资源限制。


并行语句处理的摘要。

1. 发出 SQL 语句。
1. 解析语句并自动确定 DOP。
1. 选中可用的并行资源。
    1. 如果有足够的并行执行服务器可用，并且队列中没有等待资源的语句，则执行 SQL 语句。
    1. 如果没有足够的并行执行服务器可用，则 SQL 语句将根据指定条件排队，并在满足指定条件时从队列前面出队。


无法获得所需数量的并行执行服务器进程，则 Oracle Database 会将需要并行执行的 SQL 语句排队

# 3. 示例

*友商的用法示例*

### 配置参数

|参数|描述|默认值|值范围|修改范围|备注|备注|
|---|---|---|---|---|---|---|
|PARALLEL_DEGREE_POLICY|是否启用自动并行度、语句排队和内存中并行执行|MANUAL|MANUAL：禁用自动并行度、语句排队和内存中并行执行,LIMITED：启用自动并行度，但禁用了语句排队和内存中并行执行,AUTO：启用自动并行度、语句排队和内存中并行执行,ADAPTIVE：启用自动并行度、语句排队和内存中并行执行，  启用性能反馈|ALTER SESSION,,ALTER SYSTEM|如果评估执行时间大于PARALLEL_MIN_TIME_THRESHOLD，则触发Auto Dop，根据所有scan operations的代价以及所有CPU operations的代价决定需要的并行|  
|
|PARALLEL_DEGREE_LIMIT|限制优化器使用的并行度，以确保并行服务器进程不会搞崩系统|  `CPU`  |CPU：受系统中 CPU 数量的限制,AUTO：等效于CPU,IO：受系统的 I/O 容量限制，将总系统吞吐量除以每个进程的最大 I/O 带宽DBMS_RESOURCE_MANAGER.CALIBRATE_IOIO,integer：指定优化器可以为 SQL 语句选择的最大并行度PARALLEL_DEGREE_POLICY为ADAPTIVE, AUTO,  LIMITED时才可用|ALTER SESSION,,ALTER SYSTEM|  
|  
|
|PARALLEL_MIN_DEGREE|控制由 Automatic degree of parallelism 计算的最小并行度|1|n | CPU|ALTER SESSION,,ALTER SYSTEM|  
|  
|
|PARALLEL_MIN_TIME_THRESHOLD|将语句视为自动并行度之前，语句应具有的最小执行时间|AUTO|AUTO | integer|ALTER SESSION,,ALTER SYSTEM|默认10s，mms存储这默认为1,PARALLEL_DEGREE_POLICY为ADAPTIVE, AUTO,  LIMITED时才可用,  
|  
|
|PARALLEL_THREADS_PER_CPU |CPU 在并行执行期间可以处理的并行执行进程或线程数|1|任何非零数字|ALTER SYSTEM|  
|  
|
|**PARALLEL_ADAPTIVE_MULTI_USER**|将启用一种自适应算法，该算法旨在提高使用并行执行的多用户环境中的性能|false|true | false|ALTER SYSTEM|Oracle会在之后的版本去除该参数，建议使用Parallel Statement Queuing 特性替代|本次需求涉及，用户指定并行度且资源达到瓶颈时，之前的方案是将DOP 设置为1，现在是将DOP 调整为1/4|


**监控视图**

|  
|ORCLE|YASHAN|备注|
|---|---|---|---|
|监视和分析并行语句队列的视图信息|  [V$RSRC_SESSION_INFO](https://docs.oracle.com/en/database/oracle/oracle-database/23/vldbg/using-parallel.html#GUID-1FF1855F-B438-422B-BFC2-1815B47766BB)       监视和分析并行语句队列的视图信息|  
|  
|
|  
|     [V$RSRCMGRMETRIC](https://docs.oracle.com/en/database/oracle/oracle-database/23/vldbg/using-parallel.html#GUID-95325AA4-3E5D-4A20-BF5F-AB34B8FA0DB2)  |  
|  
|
|显示正在运行并行任务的会话信息|**GV$PX_SESSION**|**GV$PX_SESSION**|DEGREE ：执行时的并行度，即所分配到的worker数量    
  REQ_DEGREE ：期望的执行并行度|
|本视图显示集群中所有节点所有会话的相关统计信息|GV$SYSSTAT|GV$SYSSTAT|NAME ：系统统计项名称，可以通过查询V$SYSSTAT视图获得完整的统计项名称    
  CLASS ：系统统计项类别    
  * 1：用户    
  * 2：redo    
  * 4：enqueue    
  * 8：cache    
  * 16：OS    
  * 32：cluster    
  * 64：SQL    
  * 128：DEBUG    
  VALUE ：统计值|
|本视图显示实例当前所有会话的统计信息|GV$SESSTAT|GV$SESSTAT|SID ：会话ID    
  STATISTIC# ： 统计项ID， 标识每一个统计项，可以通过STATISTIC#在V$STATNAME视图中查找对应统计项的具体名称    
  VALUE ：统计值,与V$SYSSTAT区别：V$SYSSTAT记录的是所有会话的累计值，V$SESSTAT记录的是分会话ID的统计值。,  
,查询样例：,SELECT QCSID, SID, INST_ID "Inst", SERVER_GROUP "Group", SERVER_SET "Set",    
  NAME "Stat Name", VALUE    
  FROM GV$PX_SESSTAT A, V$STATNAME B    
  WHERE A.STATISTIC# = B.STATISTIC# AND NAME LIKE 'PHYSICAL READS'    
  AND VALUE > 0 ORDER BY QCSID, QCINST_ID, SERVER_GROUP, SERVER_SET;    
|
|显示集群中所有节点的并行执行资源管理信息|  
|GV$PX_RES_MGR|PX_RES_LIMIT ：资源使用上限    
  MAX_PX_RES_USAGE ：资源最大使用量    
  CURR_PX_RES_USAGE ：资源当前使用量|
|显示并行worker池中的worker信息|  
|GV$PX_WORKER|  
|
|提供有关所有并行查询的历史和预计最大缓冲区使用情况的统计信息|V$PX_BUFFER_ADVICE|  
|仅oracle有的并行相关视图，以下仅列部分,所有：    [使用并行执行 (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/vldbg/using-parallel.html#GUID-106575E7-F384-40F4-AF90-95D247580C0D)  |
|并行执行的会话统计信息|GV$PX_SESSTAT|  
|  
|
|检查查询服务器的状态|V$PX_PROCESS|  
|  
|
|列出每个活动 PX （Parallel Execution） 服务器|V$PX_PROCESS_DETAIL|  
|  
|
|显示查询服务器的状态并提供缓冲区分配统计信息|V$PX_PROCESS_SYSSTAT|  
|  
|
|显示系统中所有当前服务器组的状态|V$PQ_SESSTAT|  
|  
|


  


**SQL Monitor**

|  
|降级原因|
|---|---|
|1|350 DOP downgrade due to adaptive DOP|
|2|351 DOP downgrade due to resource manager max DOP|
|3|352 DOP downgrade due to insufficient number of processes|
|4|353 DOP downgrade because slaves failed to join|


# 4.关联SR：分布式并行度

|  
|SR|开发设计|测试设计|测试用例|
|---|---|---|---|---|
|  
|  [[YDBRD-21144] 执行框架支持自适应并发度](https://jira.yasdb.com/browse/YDBRD-21144)  |  [支持并行执行调度的能力设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138564055)  |  [分布式支持执行资源管理框架测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141562705)  ,  [支持并行执行调度能力测试](https://conf.yasdb.com/pages/viewpage.action?pageId=144121289)  |  [YDBRD_13254上传用例 (!6227)](https://git.yasdb.com/cod-test/yasft/-/merge_requests/6227/diffs)  ,  [stress_test/scenario/set_stagegroup_TPCDS_10G_query.jmx](https://git.yasdb.com/cod-x/yastest_dfx/-/blob/master/stress_test/scenario/set_stagegroup_TPCDS_10G_query.jmx)  |
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