Created by 张茜, last modified on 一月 04, 2024

**SR链接：**    [YDBRD-15210](https://jira.yasdb.com/browse/YDBRD-15210?src=confmacro)    **-**  **V$视图适配fixed view**  **完成**

目前开发明确说明无该模块的设计文档

# **1.概述**

该需求主要针对  现有的V$视图要改为select子查询，适配新的fixed table/view框架

# **2.需求分析**

动态性能视图有两类：V$视图和DV$视图，两者在底层设计实现上具有一定的共性。动态视图的查询函数底层实现进行了统一，但动态视图还是两套独立的定义，操作接口。

 为了支持共享集群形态下新增GV$，需要对当前动态视图框架进行统一的调整，使得后续动态视图更易于维护、扩展和升级。因此引入了fixed view/table。

所有V$视图均从fixed_table/view框架获取。

# **3.规格**

部署模式：单机、分布式、集群

# **4.约束限制**

1、创建outline不能和系统视图同名，创建报错对象已存在，和oracle不一致。

2、只有DDL操作权限不足的时候会报insufficient privilege，如果不允许查到对应的表报的都是table or view not exists，和oracle不一致。

# **5.动态视图/配置参数**

涉及视图（以及部分视图的GV$视图）：

|视图名称|试图功能|备注|
|---|---|---|
|V$YFS_FILE|显示 YFS 故障组（Failgroup）信息|  
|
|V$YFS_FAILGROUP|显示 YFS 故障组（Failgroup）信息|  
|
|V$YFS_DISKGROUP|显示 YFS 磁盘组（Diskgroup）信息|  
|
|V$YFS_DISK|显示 YFS 磁盘（Disk）信息|  
|
|V$WINDOW_FUNCTION|显示当前系统提供的所有窗口函数信息|  
|
|V$VMSTAT|显示VM的统计信息 |  
|
|V$VM|用于检测VM使用情况|  
|
|V$VERSION|显示数据库的版本信息|  
|
|V$UNDOSTAT|显示undo相关统计信息汇总|  
|
|V$UNDO_SEGMENTS|展示数据库中当前所有undo segment里的undo block使用情况|  
|
|V$TRANSACTION|显示事务汇总信息|  
|
|V$TEMPORARY_SEGMENT|显示数据库会话中全局临时表的segment信息|  
|
|V$TEMP_EXTENT_POOL|用于检测临时属性的表空间，其extent分配情况。|  
|
|V$TASK|任务视图，显示当前执行和等待的任务信息|  
|
|V$TABLESPACE|表空间（Tablespace）的信息|  
|
|V$TABLE_DICTIONARY|提供关于数据字典表（Data Dictionary Tables）的信息。数据字典表存储了关于数据库对象（例如表、索引、列等）的元数据信息。|  
|
|V$SYSTEM_WAIT_CLASS|显示当前所有等待事件类的统计信息|  
|
|V$SYSTEM_PARAMETER|显示系统配置参数信息|  
|
|V$SYSTEM_EVENT|显示当前所有等待事件统计信息|  
|
|V$SYSSTAT|显示所有session的相关统计信息|  
|
|V$STATNAME|用于显示统计项的信息，与V$SYSSTAT中统计项对应|  
|
|V$SQLTEXT|显示当前正在执行的SQL语句汇总信息|  
|
|V$SQLSTATS|显示SQL游标的基本性能统计信息，每一行代表SQL文本和优化器计划的唯一组合（即SQL_ID和 PLAN_HASH_VALUE 的唯一组合）的数据|  
|
|V$SQLAREA|显示共享SQL区中每条SQL的统计信息，包含SQL在statement上的内存消耗，解析，优化和执行信息|  
|
|V$SQL_TRACE|动态性能视图，用于提供有关 SQL 跟踪（SQL tracing）的信息。SQL 跟踪是一种用于捕获和记录执行过程中 SQL 语句的详细信息的方法，以便进行性能分析和故障排除。|  
|
|V$SQL_PLAN_TRACE|动态性能视图，用于提供有关 SQL 语句执行计划跟踪（SQL plan tracing）的信息。SQL 执行计划跟踪是一种捕获和记录 SQL 语句执行过程中生成的执行计划的详细信息的方法，以便进行性能分析和优化|  
|
|V$SQL_PLAN_STATISTICS|显示子游标的详细执行计划信息，需要配置参数statistics_level=all才能使用|  
|
|V$SQL_PLAN|显示所有的执行计划信息|  
|
|V$SQL|显示当前所有的SQL执行统计信息（每个SQL一条）|  
|
|V$SPINLOCK|显示spin锁的信息|  
|
|V$SHARE_POOL|显示系统共享内存池信息|  
|
|V$SGASTAT|显示全局内存各个内存池详细信息|  
|
|V$SGA|用于显示全局内存信息|  
|
|V$SESSTAT|显示实例当前所有会话的统计信息,与V$SYSSTAT区别：V$SYSSTAT记录的是所有会话的累计值，V$SESSTAT记录的是分会话ID的统计值|  
|
|V$SESSION_WORKER|显示共享模式打开时，使用session worker池的汇总信息|  
|
|V$SESSION_WAIT|显示当前所有会话等待事件信息。|  
|
|V$SESSION_ROLES|显示当前登录USER的所有生效角色|  
|
|V$SESSION|显示当前所有会话信息|  
|
|V$ROLLBACK|提供有关回滚段（Rollback Segment）的信息。回滚段是用于支持数据库事务回滚和并发控制的数据库对象|  
|
|V$RESOURCE_REQUEST|显示资源当前等待处理的消息 |  
|
|V$RESERVED_WORDS|显示单机和分布式所有关键字的信息|  
|
|V$REPLICATION_STATUS|显示集群中所有节点的备机redo传输汇总信息|  
|
|V$REPLICATION_EVENT|显示主备复制汇总信息|  
|
|V$REDOSTAT|显示redo性能的统计信息|  
|
|V$RECOVERY_PROGRESS|显示日志回放进度汇总信息|  
|
|V$PX_WORKER|显示并行worker池中的worker信息|  
|
|V$PX_SESSION|显示正在运行并行任务的会话信息|  
|
|V$PUB_STAT|显示分布式后台推送任务的统计信息|  
|
|V$PROCESS|显示系统中所有线程信息|  
|
|V$PRIVATE_TEMP_TABLES|显示所有私有临时表的汇总信息|  
|
|V$PQ_TQSTAT|显示当前statement上次执行的并行查询的表队列的统计信息，可用于分析表队列分片是否合理，只在连接存续期间可以查询|  
|
|V$PLANCACHE|用于检测plan cache的使用情况|  
|
|V$PARAMETER|显示所有配置参数汇总信息|  
|
|V$OSSTAT|显示来自操作系统的系统利用率统计信息 |  
|
|V$OPEN_CURSOR|查看每个statement相关信息以及使用的公共-SQL1堆内存池情况。|  
|
|V$NODE|显示节点自身的节点信息|  
|
|V$MYSTAT|显示当前session的统计项信息，且显示的是V$SESSTAT的子集，SID对应V$SESSION的SID|  
|
|V$LSC_XFMR_SLICES|显示所有slice文件的汇总信息|  
|
|V$LSC_SLICE_STAT|单机部署中，本视图显示所有LSC表的存储相关统计信息，存在分区时，以分区为单位进行展示。 分布式部署中，除CN外，本视图显示当前实例的所有LSC表的存储相关统计信息，存在分区时，以分区为单位进行展示；在CN上，本视图显示MN实例的所有LSC表的存储相关统计信息。|  
|
|V$LOGFILE|数据库日志文件的详细信息|  
|
|V$LOCKED_OBJECT|显示当前所有对象锁的信息|  
|
|V$LOCK|显示当前所有锁的信息|  
|
|V$LARGE_POOL|显示大对象池的相关统计信息|  
|
|V$INSTANCE|显示集群中所有实例状态的汇总信息|  
|
|V$HOT_CACHE|查看数据库中当前热页缓存区的使用情况|  
|
|V$HM_RUN|故障诊断视图，显示所有健康检查相关信息及其状态|  
|
|V$HM_FINDING|故障诊断视图，显示相关健康检查成果|  
|
|V$HM_CHECK_PARAM|故障诊断视图，显示健康巡检项目对应的参数信息|  
|
|V$HM_CHECK|故障诊断视图，显示当前所有的健康巡检项目信息。|  
|
|V$GRC_RESOURCE|显示共享集群全局资源情况|  
|
|V$GRC_PASTCOPY|本视图显示PAST COPY BLOCK（多实例同时持有脏块时，只有最新版本的一个实例具备写权限，其他不具备写权限的历史版本实例所持有的脏块称为PAST COPY BLOCK）信息。|  
|
|V$GRC_DHTRULE|显示共享集群中master资源的hash分布情况|  
|
|V$GLS_LOCK|显示共享集群全局锁情况|  
|
|V$GLOBAL_MPOOL|主要描述实例级别的公共-SQL1堆内存池/SQL缓存池/字典缓存池的统计信息|  
|
|V$FUNCTION|显示当前系统提供的所有内置函数信息|  
|
|V$ERROR_CODE|显示所有错误码的详细信息|  
|
|V$ELECTION|显示在HA架构中开启自动选举时，当前节点实时的选举状态，当自动选举关闭时本视图无数据|  
|
|V$DYNAMIC_VIEWS|显示当前系统提供的所有动态视图名称|  
|
|V$DML_STATS|显示上次统计信息收集之后，内存中记录的表变化的情况，用于内部机制的实现。用户如果需要查看表的变化情况，请使用USER_TAB_MODIFICATIONS视图。|  
|
|V$DISKCACHE|展示磁盘缓存的状态信息|  
|
|V$DIN_STAT|显示分布式下当前节点的内部网络统计的汇总信息，单机查询为空|  
|
|V$DIN_NODE|显示分布式下当前节点内部网络链路状态的汇总信息，单机查询为空|  
|
|V$DIN_LINK|显示分布式集群中所有节点内部每条链路的汇总信息|  
|
|V$DICT_CURSOR|显示正在被使用的游标信息|  
|
|V$DICT_CACHE|展示字典缓存中的状态信息|  
|
|V$DIAG_PROBLEM|故障诊断视图，显示当前所有的问题信息|  
|
|V$DIAG_INCIDENT|故障诊断视图，显示当前所有事件信息|  
|
|V$DIAG_FAULT|故障诊断视图，显示所有故障模式定义。|  
|
|V$DBWR_STATISTICS|显示Database Writer线程的统计信息|  
|
|V$DATATYPE|显示当前系统支持的所有数据类型信息|  
|
|V$DATAFILE|单机部署中，本视图显示数据文件汇总信息。 分布式部署中，除CN外，本视图显示当前实例的数据文件汇总信息；在CN上，本视图显示MN上实例的数据文件汇总信息。|  
|
|V$DATABUCKET|单机部署中，本视图显示所有LSC表空间的databucket（数据桶）文件信息。 分布式部署中，除CN外，本视图显示当前实例的所有LSC表空间的databucket（数据桶）文件信息；在CN上，本视图显示MN实例的所有LSC表空间的databucket（数据桶）文件信息。|  
|
|V$DATABASE|记录数据库实例相关信息|  
|
|V$DATA_CONNECTION|显示分布式集群中当前节点已创建的会话内连接信息|  
|
|V$CPUSTAT|显示单机，主备和分布式集群中所有节点的资源管理汇总信息|  
|
|V$CORRUPTED_TABLE|单机部署中，本视图显示所有损坏表的信息。 分布式部署中，除CN外，本视图显示当前实例的所有损坏表汇总信息；在CN上，本视图显示MN的所有损坏表信息|  
|
|V$CONTROLFILE|显示当前所有控制文件信息|  
|
|V$COLUMNAR_MEM_POOL|显示列式计算过程中内存池的详细信息|  
|
|V$COLUMNAR_MEM_CACHE|显示列式存储稳态数据的内存缓存信息|  
|
|V$COL_CODEC_DICT_VALUES|单机部署中，本视图显示所有TAC表的所有字典结构中的值，存在分区时，以分区为单位进行展示|  
|
|V$CM_NODE_INFO|显示CM模块存储的NODE INFO信息列表|  
|
|V$CM_GROUP_INFO|显示CM模块存储的GROUP INFO信息列表|  
|
|V$CM_CLUSTER_INFO|显示CM模块存储的CLUSTER INFO信息。|  
|
|V$CLUSTER_TASK_STAT|共享集群后台线程的相关统计信息|  
|
|V$CLUSTER_MESSAGE_STAT|显示共享集群消息交互统计信息|  
|
|V$CLUSTER_MESSAGE_POOL|显示共享集群消息池的概况 |  
|
|V$CLUSTER_MESSAGE|显示共享集群消息池中待处理的消息信息|  
|
|V$CHECKPOINT|显示checkpoint的相关信息|  
|
|V$CHANNEL_PERF|用于查询当前会话各1对1channel的传输性能统计。|  
|
|V$BUFFER_POOL_STATISTICS|显示数据缓存区的统计信息|  
|
|V$BUFFER_POOL|显示数据缓存区基本信息|  
|
|V$BUFFER_CONTROL|显示数据缓存区页面控制信息|  
|
|V$BUFFER_ACCESS_STATISTICS|显示会话级别buffer访问的统计信息|  
|
|V$BACKUP_PROGRESS|显示备份或恢复的进度信息汇总|  
|
|V$AUDITABLE_SYSTEM_ACTIONS|显示所有的系统行为的审计项信息。|  
|
|V$AUDITABLE_OBJECT_ACTIONS|显示针对对象的审计类型。|  
|
|V$ARCHIVED_LOG|显示归档文件统计信息|  
|
|V$ARCHIVE_GAP|显示归档gap区间|  
|
|V$ARCHIVE_DEST_STATUS|所有备机的统计信息|  
|
|V$ARCHIVE_DEST|归档目标的详细信息|  
|
|V$ALLOCATOR|本视图显示当前使用内存的状况。|  
|
|V$ALERT_EVENT|示所有告警事件名称。|  
|
|V$2PC_PENDING|V$2PC_PENDING|  
|


# **6.测试设计方法**

针对该需求的测试主要从视图的公共测试角度进行，主要采用场景法进行，涉及的主要测试维度如下：

1、针对视图本身的名称和字段名称，字段类型定义的规范性做校验，这部分涉及资料，原则上针对目前现有的均不该有变化

2、针对视图的DDL和DML写操作是否做拦截，做校验

3、针对视图的权限做校验，所有用户都有权限查看动态视图（非sys用户访问需要加  Schema  ），非sys用户可创建不同  Schema  下的同名动态视图，非sys用户不加schema不可访问

4、针对视图的基本过滤查询做校验

5、针对每个视图各自定义，看其在各自部署环境上的表象。

6、针对视图中涉及到的每个字段的值的正确性做校验，需构造相应的场景，建立对应的表和字段、字段值来验证值的正确性

7、从业务的角度考虑视图和业务的并发操作，因为查询V$视图本质上是读系统表。执行业务过程中会对相关的系统表做一些读写操作，环环相扣。 因此需要在执行业务过程的同时对相关视图进行查询操作。校验并发过程前中后无core，无hang，无异常报错

8、select查询视图过程中，构造基础故障场景kill -9 实例、断网

9、视图和业务的并发过程中，构造基础故障场景kill -9 实例、断网

# **7.详细测试设计**

# **8.测试用例**

# **9.测试框架/测试用例自动化**

# **10.测试环境说明**

# **11.测试版本**

# **12.上车分析**

## Attachments:

[V_DYNAMIC_VIEWS_20230828_视图分组.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzQ4OTcwYzJhZjRmNTFmYTZjIiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.Tc5mz7zXSTo6PxEr9r2jBe8PHpQFyAdewfAY2fpZE74)

 (text/csv)    


[【YDBRD-15210】【共享集群】V$视图适配fixed view_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzRhMWFkOWEzMzExZGM3OGUyIiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.mefshXPVm2K9ZNIQV1IKL0CKIZAr0QIscuhBG4qZvAE)

 (application/x-xmind)    


[【YDBRD-15210】【共享集群】V$视图适配fixed view_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzRhMWFkOWEzMzExZGM3OGUzIiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.UZKgQ5bY-lcnewQPR2hdbtnj6PtFx2ZmqdD9LhqLbls)

 (application/x-xmind)    


[【YDBRD-15210】【共享集群】V$视图适配fixed view_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzQ4OTcwYzJhZjRmNTFmYTZlIiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.JpOXWCJplW9kQows4MlKS35pvw21MEEgVnwdmYJis2A)

 (application/x-xmind)    


[【YDBRD-15210】【共享集群】V$视图适配fixed view_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzQ4OTcwYzJhZjRmNTFmYTcwIiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.tM_qe_3Pkg9k-LuifFm5Y8XKKfjia25VZ29KYo56468)

 (application/x-xmind)    


[【YDBRD-15210】【共享集群】V$视图适配fixed view_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzRhMWFkOWEzMzExZGM3OGU1IiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.MoxgCE3C5ohiiCo14xwgy1EVa0l3r4PrZLxUTeLAxGE)

 (application/x-xmind)    


[YDBRD-15210-V$视图适配fixed_view.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzRhMWFkOWEzMzExZGM3OGU2IiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.FrUlo2ZowDvEuOK4BgJ_nEBmuZT3t4rvW_tq9iP3Urs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[【YDBRD-15210】【共享集群】V$视图适配fixed view_测试设计 (1).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzQ4OTcwYzJhZjRmNTFmYTcyIiwicmVmX2lkIjoiNjczOTY5YzQ1OTNmOTljOWZmMjM1MjhkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTAxLCJleHAiOjE3ODIyOTUzMDF9.1MxQOPEzhYxFVoL0vINN2c4zSfMDzIG5G58qFO1hu5M)

 (application/x-xmind)    


## Comments:

|  [](null)  ,质量加固点：,1、跟进sql、存储组将相关GV$视图用例上传集群用例库中。,2、补充select VIEW_NAME from DBA_VIEWS where VIEW_NAME like '%V%';所有视图的select ,select count( *） 查询，上传集群testkill库中（业务的场景需要分发各组）。,3、sql执行方式，同一会话中查询后，操作  shutdown immediate/abort;,![](https://pingcode.yasdb.com/atlas/files/public/673969c4a1ad9a3311dc78e7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg5MDEsImV4cCI6MTc4MjIxOTcwMX0.zrdKdd9IBIClx_jeW7kAC_rACChv_QBoJ8g8hlwW4UY),4、不同会话查询过程中，yasql下发shutdown immediate(配置自动拉起),5、循环查询过程中，循环下发stop ycs、start ycs、stop instance、start instance,6、查询过程中，构造网络故障（引用网络工程看护自动化）,断网/丢包/延迟/kill -9/kill -19,7、循环查过程中，故障另外一个节点,8、视图之间复杂查询（和自建视图、表还有GV$视图关联查询）,Posted by zhangqian at 一月 04, 2024 09:39|
|---|
