IR：  [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf4d?](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf4d?)  

#YASHAN-1089  分布式支持排队调度功能

## 1. 总述

需求来源：深智城  
需求分析：分布式AP场景有大量需要较多资源执行的查询，这些操作并行进入数据库进行执行时，由于资源争抢剧烈，性能表现比较差，也会影响执行可靠性，例如部分资源不足引起的报错等。当前需求需要引入排队调度机制来解决相关问题。
功能概要描述：

1. 识别出资源密集型SQL，即需要大量资源的列存表查询SQL
1. 资源密集型SQL按会话进行排队调度
1. 按资源使用组进行队列管理


### 1.1 需求来源

分布式AP场景遇到大量问题都是由于资源密集型SQL并发，加剧资源争抢，导致执行性能欠佳。调研参考了Oracle、StarRocks、OceanBase等数据库厂商在这方面的优化机制，主要都集中在排队调度上，基本可以解决并发无序争抢资源相关问题。  
需要实现以下几个能力

1. 识别出需要大量资源的列存表查询SQL，通过资源组排队调度管理
1. 可以设置资源使用组可以同时执行资源密集型SQL的数量
1. 达到同时执行资源密集型SQL的数量限制后，新的资源密集型SQL需要等待前面执行完
1. 执行时由于分布式资源不足导致资源预约失败，所有资源密集型SQL需要排队进行预约
1. DN侧反馈执行相关实时信息，协助排队调度管理
1. 用户可以设置排队等待超时时间，排队超时后将返回报错
1. 增加相关视图或字段，展示资源组及特定会话排队调度相关信息


本需求主要是功能实现，也涉及可靠性及性能体验，同时需要一定可维可测的能力，对其他质量属性涉及较少。本需求特性支持主备(单机)、分布式部署形态，共享集群未支持列存及资源管理不涉及。从机制上不区分行列，不过从使用场景看，主要是列存表查询才会涉及。

### 1.2 调研文档

|对比项|Oracle|StarRocks|OceanBase|YashanDB|
|---|---|---|---|---|
|排队机制|active session pool|查询队列|大查询列表，实现限流策略（不是很系统）|排队调度|
|管控对象|OLAP场景|INSERT 导入、SELECT查询和统计信息查询|大查询|列存表查询|
|队列范围|资源使用组级别|支持全局及资源组粒度|全局|资源使用组级别|
|排队的时机|组内活跃会话数达到上限|并发查询数量或资源使用率（CPU、内存、并发度）达到一定阈值|执行超过5s的查询标记为大查询，总的大查询线程超过30%后被挂起|当前CN组内活跃会话数达到上限或者资源预约失败|
|出队列时机|活跃会话空余，先进先出|等待有足够的计算资源才能开始执行|小查询执行一段时间后，大查询继续执行|当前CN组内活跃会话数低于上限|
|是否实现优先级|使用组内没有区分优先级|使用组内没有区分优先级|无|使用组内不区分优先级|
|排队异常处理|排队等待超时后终止执行并报错|排队等待超时后终止执行并报错|无|排队等待超时后终止执行并报错|
|可维可测|RSRC_CONSUMER_GROUP / RSRC_SESSION_INFO 视图展示资源组和会话排队等待相关信息|通过query_queue相关监控项展示全局/资源组当前、累计及超时数量|通过ob_plan_cache_plan_stat视图展示|兼容Oracle视图|
|分布式全局协调|不涉及|BE默认每隔1秒向FE报告资源使用情况，FE中看到BE全局的统计信息|无说明|通过ACK带回或定时报告资源统计，粒度较粗|
|其他|OLTP、当连接池或用来控制并发|通过开关各自控制导入任务、select查询或者统计信息查询是否启用查询队列管理；是否启用资源组粒度查询队列，也是通过开关控制||单CN无法看到资源组会话全貌，不同CN间仍需要通过在DN上预占资源进行争抢|


详情见  [调研详情](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673d45c0ff43ee9c85b2378f)  

### 1.3 需求分析

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|识别资源密集型SQL|识别出需要大量资源的列存表查询SQL，通过资源组排队调度管理|是|是|----|
||限制资源组内最大同时执行数量|可以设置资源使用组可以同时执行资源密集型SQL的数量|是|是|----|
||进入等待队列|达到同时执行资源密集型SQL的数量限制后，新的资源密集型SQL需要等待前面执行完；执行时由于分布式资源不足导致资源预约失败，所有资源密集型SQL需要排队进行预约|是|是|----|
||反馈实时资源信息|DN侧反馈执行相关实时信息，协助排队调度管理|是|是|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|----|
||性能场景2|----|是/否|是/否|----|
|可用性|恢复场景|----|是/否|是/否|----|
|可靠性|等待超时报错|用户可以设置排队等待超时时间，排队超时后将返回报错|是|是|----|
|可维可测|展示资源组排队调度情况|V$RSRC_CONSUME_GROUP增加ACTIVE_SESSIONS、REQUESTS、QUEUE_LENGTH、ACTIVE_SESSION_LIMIT_HIT、QUEUED_TIME、QUEUE_TIME_OUTS等字段|是|是|----|
||展示特定会话排队调度情况|新增V$RSRC_SESSION_INFO视图，包含SID、CURRENT_CONSUMER_GROUP、STATE、CURRENT_QUEUED_TIME、QUEUED_TIME、QUEUE_TIME_OUTS等字段|是|是|----|
|安全|安全场景1|----|是/否|是/否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|----|----|是/否|是/否|----|
|周边配合|权限|----|----|是/否|----|
|周边配合|审计|----|----|是/否|----|
|周边配合|导入导出工具|----|----|是/否|----|


### 1.4 数据字典

    **描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|资源密集型SQL|用来描述 SQL 查询或语句在执行过程中需要大量消耗诸如 CPU（中央处理器）时间、内存、磁盘 I/O（输入 / 输出）操作等各类系统资源的情况|是|无|


### 1.5 开源依赖

不涉及

## 2. 接口

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级包|DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE/UPDATE_PLAN_DIRECTIVE增加active_sess_pool_p1参数|指定资源组内活跃会话数|是|
|系统视图|使用DBA_RSRC_PLAN_DIRECTIVES的active_sess_pool_p1字段，字段原来有预留|----|是|
|动态视图|V$RSRC_CONSUME_GROUP增加ACTIVE_SESSIONS、REQUESTS、QUEUE_LENGTH、ACTIVE_SESSION_LIMIT_HIT、QUEUED_TIME、QUEUE_TIME_OUTS等字段|----|是|
|动态视图|新增V$RSRC_SESSION_INFO视图，包含SID、CURRENT_CONSUMER_GROUP、STATE、CURRENT_QUEUED_TIME、QUEUED_TIME、QUEUE_TIME_OUTS等字段|----|是|
|配置项|增加配置项_ENABLE_QUEUE_COL_QUERY，取值TURE或FALSE，默认是TRUE|控制是否对列存表查询进行排队调度|是|


## 3. 规格与约束

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**    
规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

|类型|规格或约束项|技术说明|备注|
|---|---|---|---|
|规格|排队调度只支持资源组级别|配合资源使用组元数据使用|StarRock先支持了全局队列，再支持资源组级别是往精细化发展。Oracle也只支持资源组级别，YashanDB直接做资源组级别就满足需要了。|
|规格|只有列存表查询才会受到排队调度约束|其他操作不需要太多资源，没必要进行限制|StarRocks、OceanBase都是识别到资源密集型SQL才进行限制，Oracle通过文档说明OLTP场景不适用。后续考虑将导入、收集统计信息也纳入管理。|


## 4. 特性

![queue_frame.png](https://pingcode.yasdb.com/atlas/files/public/673d466a8970c2af4f53b5fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY3NTQsImV4cCI6MTc4MjQ2NzU1NH0.VureGdPhzpnqlr09rd66gdPkv0Q47dyctPiq-SZlzKw)

### 4.1 识别资源密集型SQL

根据SQL类型，确定该执行是否受该排队调度管理。目前只有涉及列存表的查询，即select/insert into select操作，暂不包含create table as select操作。

- 非Exectue/Direct Execute命令，例如prepare、fetch等命令字不涉及
- DDL、DCL、查询无关的DML语句不涉及
- heap表、系统视图等查询语句不涉及
- 导入数据，统计信息收集操作，暂时不涉及，后续可能会加入管控中


#### 4.1.1 类型控制开关

增加_ENABLE_QUEUE_COL_QUERY配置开关，控制列存表查询是否启用排队调度，默认为ON。为后续逐渐增加导入、统计信息收集等操作开关做准备。

### 4.2 资源组内最大同时执行限制

资源计划指令RSRC_PLAN_DIRECTIVE增加active_sess_pool_p1，表示可以资源使用组内同时执行资源密集型SQL会话数量。

队列等待超时时间继续使用EXECUTION_QUEUE_TIMEOUT进行控制，同时兼容Oracle的queueing_p1参数。

资源密集型SQL开始执行，以及执行结束，都要维护资源使用组内正在执行数量的统计。

### 4.3 排队调度

没有单独的线程资源进行调度管理，会话在执行时，统一通过资源管理相关接口调用判断，是否进入排队调度。排队调度逻辑由资源管理相关接口提供，接口内实现排队等待、检测等操作。资源预占失败重试，或其他重试，都要重新进入该接口。

#### 4.3.1 排队信息

1. 会话信息
1. 进队列时间
1. 评估内存资源信息
1. 预占资源失败信息（如果是由于预占导致重试）


按严格先进先出方式进行调度，后续实时资源信息完善了，再进行精细化调度。

#### 4.3.2 进入队列时机

1. 当前资源使用组活跃资源密集型SQL已超过设定上限
1. 资源预占失败，需要重试
1. 前面已经有会话预占资源失败，后面的会话也需要进入队列等待（细节待议）


#### 4.3.3 出队列时机

1. 当前资源使用组活跃资源密集型SQL低于设定上限
1. 当前会话在队列前面已经没有其他等待的会话


### 4.4 反馈实时资源信息（可选）

CN侧只有单CN自己的信息，不知道全局资源情况无法做出精细化调度，需要DN侧及时反馈。

DN侧实时资源信息包括：

1. CPU使用率（主机全局）
1. SPA内存使用比例（全局）
1. 并发线程使用比例（全局）
1. 各资源组SPA内存使用比例
1. 各资源组并发资源使用比例
1. 各资源组下是否出现查询内存不足溢出到磁盘的查询


实时资源信息使用策略：

1. DN cpu、内存、并发资源使用过高时，放缓执行（资源预占尝试频率降低）
1. 资源组下出现了查询内存不足溢出后，CN暂不下发新的执行


#### 4.4.1 方案一 dml ack中附带部分实时信息

1. 达到一定时间间隔后，往CN的ack中增加DN实时资源信息
1. CN解析ack时，通过标志判断是否需要解出资源信息


目前资源预占失败时，ack中带了所需内存大小信息。

#### 4.4.2 方案二 定时任务推到CN

1. task任务框架中增加定时任务，定时先所有CN推送DN实时资源信息
1. CN直接在ICS接收线程里刷新DN资源信息


### 4.5 等待超时报错

1. 会话等待执行超过设定时间，则不再等待，直接返回超时报错
1. 超时时间由元数据指定，RSRC_PLAN_DIRECTIVE的EXECUTION_QUEUE_TIMEOUT
1. 超时后，需要累计到统计视图上


### 4.6 RSRC_CONSUME_GROUP视图

|字段|类型|说明|备注|
|---|---|---|---|
|ACTIVE_SESSIONS|NUMBER|当前正在执行的资源密集型SQL数量||
|EXECUTION_WAITERS|NUMBER|等待执行的资源密集型SQL||
|REQUESTS|NUMBER|资源组内已经执行的资源密集型SQL数量||
|QUEUE_LENGTH|NUMBER|当前等待执行的会话数||
|ACTIVE_SESSION_LIMIT_HIT|NUMBER|活跃会话达到上限次数||
|QUEUED_TIME|NUMBER|资源组内所有会话累计等待时间||
|QUEUE_TIME_OUTS|NUMBER|资源组内会话累计等待调度超时次数||
|PARALLEL_DOWNGRADE|NUMBER|资源组内出现并行资源降级次数|并行资源预占失败后减为1执行|


### 4.7 RSRC_SESSION_INFO视图

|字段|类型|说明|备注|
|---|---|---|---|
|SID|NUMBER|会话ID||
|CURRENT_CONSUMER_GROUP|VARCHAR2(32)|资源使用组名||
|STATE|VARCHAR2(32)|会话状态：RUNNING 执行中，QUEUED 排队中，IDLE 当前没有命令执行，WAITING 等待事件||
|CURRENT_QUEUED_TIME|NUMBER|在队列中等待时间（状态为QUEUED），单位毫秒。||
|QUEUED_TIME|NUMBER|会话累计等待时间||
|QUEUE_TIME_OUTS|NUMBER|会话累计等待调度超时次数||
|PARALLEL_DOWNGRADE|NUMBER|资源组内出现并行资源降级次数|并行资源预占失败后减为1执行|


### 4.8 资源使用组变更相关并发

#### 4.8.1 修改active_sess_pool_p1

修改实时生效。主要有改大和改小两种场景：

- 改大，增加活跃会话数 下一次检测时按新的值执行，堆积在队列中等待的会话可以往下执行
- 改小，减少活跃会话数 下一次检测时按新的值执行，已经放行执行的会话不影响，新执行或排队中的会话按新值进行


#### 4.8.2 修改EXECUTION_QUEUE_TIMEOUT或queueing_p1

修改实时生效。更新后，执行时按新的超时时间进行判断检测

### 4.9 备节点、主备切换场景

资源管理相关元数据更新后，排队调度相关逻辑直接访问最新值，不存在复杂的缓存刷新或调整逻辑。

## 5.未来规划

### 5.1 扩展资源密集型SQL

将数据导入、统计信息收集等操作也纳入到资源密集型SQL，同样需要走排队调度机制进行控制。

### 5.2 定期收集实时资源信息

DN定期向CN上报实时资源信息，以辅助精细化调度决策。