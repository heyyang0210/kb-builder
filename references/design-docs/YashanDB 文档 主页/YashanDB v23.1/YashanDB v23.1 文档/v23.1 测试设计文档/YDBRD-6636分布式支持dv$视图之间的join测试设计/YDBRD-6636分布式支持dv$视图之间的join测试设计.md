Created by 罗爽, last modified on 一月 18, 2024

# 1.   **概述**

本文描述分布式dv$视图之间join的测试设计。

# 2.   **需求分析**

SR：    [YDBRD-6636](https://jira.yasdb.com/browse/YDBRD-6636?src=confmacro)    -  分布式支持dv$视图之间的join  完成

子任务：    [YDBRD-14451](https://jira.yasdb.com/browse/YDBRD-14451?src=confmacro)    -  分布式支持DN上的plan cache  完成

开发设计文档：    [YDBRD-6636：分布式支持dv$视图之间的join](112724817.html)    、    [YDBRD-14451：分布式支持DN上的plan cache](/pages/createpage.action?spaceKey=YAS&title=YDBRD-14451%EF%BC%9A%E5%88%86%E5%B8%83%E5%BC%8F%E6%94%AF%E6%8C%81DN%E4%B8%8A%E7%9A%84plan+cache)  

**功能描述：**  dv$视图做join，相当于CN下发到单个节点上执行对应v$视图的join，然后CN将数据汇总，不同节点间的数据不做任何关联聚集操作。

子任务分析：对于plan cache，需观察sql相关dv$视图有没有记录dn节点上的dml操作。未启用plan cache时，不记录dn节点的操作。

**覆盖场景：**

- dv$视图与dv$视图
- dv$视图与v$视图
- dv$视图与DAB视图、ALL视图、USER视图
- dv$视图与系统表


**规格约束：**

1.dv$视图与v$视图join，升级处理，v$视图按dv$视图处理。

   – 2023/07/06修改：降级处理，即dv$视图与v$视图、DBA等视图join，只查cn本地的。原因：备机不能查系统表，在备机上查会导致回放出问题。

2.  order by，group by，窗口函数，聚集函数，limit，rownum 都只在收到计划的节点内生效（分布式不支持窗口函数，rownum），CN只做汇总。order by在CN汇总后可能不是有序的；group by可能有重复的；limit限制各节点的条数，最终CN返回的是节点数*limit数。不支持对汇总结果排序，limit等。

3.  只允许和DBA视图、USER视图、ALL视图、系统表、v$之间join。

**dv$视图分析：**

由于动态视图，DBA视图等数量太多，对DV$视图分类整理，按类别判断是否能与其他join。

|分类1|分类2|视图|描述|是否有数据|join对象|说明|
|---|---|---|---|---|---|---|
|  
    
    
,  
,  
,  
,  
,  
,  
,  
,  
,状态信息|数据库状态|DV$DATABASE|数据库状态汇总|Y|  
|  
|
||  
,  
,  
,会话状态|DV$DATA_CONNECTION|会话内连接信息|Y|GLOBAL_SESSION_ID >   **DV$SESSION**  .GLOBAL_SESSION_ID,,SQL_ID >  **DV$SQL**  .SQL_ID;      **DV$SQLAREA**  . SQL_ID,,PEER_ENDPOINT >  ** DV$NODE**  .ENDPOINT,|**只有dv$视图|
|||DV$SESSION|已创建的会话信息|Y|USER#,  USERNAME > (系统表)  **USER$**  .USER#,USERNAME,    
                                     (DBA视图)  **DBA_USERS**  .USER_ID,  USERNAME,    
                                     (ALL视图)   **ALL_USERS**  .USER_ID,USERNAME,    
                                     (DBA视图)  **USER_USERS**  .USER_ID,USERNAME,    
,SQL_ID >  **DV$SQL**  .SQL_ID;    **DV$SQLAREA**  . SQL_ID,|  
|
|||DV$SESSION_WORKER|使用session worker池的汇总信息|Y|  
|  
|
||实例状态|DV$INSTANCE|实例状态的汇总信息|Y|  
|  
|
||字典状态|DV$DICT_CACHE|字典缓存的状态信息|Y|USER_ID   > (系统表)  **USER$**  .USER#,    
                    (DBA视图)  **DBA_USERS**  .USER_ID  ,    
                    (ALL视图)   **ALL_USERS**  .USER_ID,    
                    (DBA视图)  **USER_USERS**  .USER_ID,,OBJECT_ID > (系统表)  **OBJ$**  .obj#,|  
|
||  
,链路状态|DV$DIN_LINK|链路汇总信息|Y|ENDPOINT >   **DV$NODE**  .ENDPOINT,PEER_ENDPOINT >   **DV$NODE**  .ENDPOINT,这3个视图之间可join|  
|
|||DV$DIN_NODE|内部网络链路状态的汇总信息|Y|||
|||DV$DIN_STAT|内部网络统计的汇总信息|Y|||
||LSC表状态|DV$LSC_SLICE_STAT|SLICE状态信息|可构造|BO,OBJ,DATAOBJ >    (系统表)  **OBJ$**|  
|
||版本|DV$VERSION|所有节点的版本信息|Y|  
|  
|
|事务|事务|DV$2PC_PENDING|未决事务|N|  
|  
|
|||DV$TRANSACTION|事务汇总信息|可构造|SID >   **DV$SESSION**  .SID|  
|
|  
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
  资源|  
,  
,  
,  
,  
,内存|DV$ALLOCATOR|内存使用情况|Y|  
|  
|
|||DV$BUFFER_POOL|数据缓存区基本信息|Y|这两个可join: id, size|  
|
|||DV$BUFFER_POOL_STATISTICS|数据缓存区的统计信息|Y||  
|
|||DV$COLUMNAR_MEM_POOL|列式计算过程中内存池的详细信息|Y|  
|  
|
|||DV$GLOBAL_MPOOL|节点实例级的内存池信息|Y|  
|  
|
|||DV$VM|VM的整体内存信息|Y|  
|  
|
|||DV$SGA|全局内存信息|Y|name >   **DV$SGASTAT**  .name|  
|
|||DV$SGASTAT|各个内存池详细信息|Y|name >   **v$share_pool**  .name|  
|
|||DV$HOT_CACHE|节点热页缓存的汇总信息|Y|  
|  
|
||归档|DV$ARCHIVE_GAP|归档gap区间|N|  
|  
|
||控制文件|DV$CONTROLFILE|所有控制文件信息|Y|  
|  
|
||数据文件|DV$DATAFILE|所有数据文件信息|Y|TS# >   **dv$tablespace**  .id,,name > (DBA视图)  **DBA_DATA_FILES**  .FILE_NAME,          >(DBA视图)  **DBA_TEMP_FILES**  .FILE_NAME|  
|
||redo文件|DV$LOGFILE|所有redo文件信息|Y|  
|  
|
||undo|DV$UNDO_SEGMENTS|所有undo segment信息汇总|Y|这两个视图可join|  
|
|||DV$UNDOSTAT|undo相关统计信息汇总|Y||  
|
||节点|DV$NODE|节点信息列表|-|-|  
|
||表空间|DV$DATABUCKET|LSC表空间的databucket文件信息|Y|id> (DBA视图)  **DBA_DATA_BUCKETS**  .databuket_id,,usl >    **DBA_DATA_BUCKETS**  .databuket_url,,TS# >   **DV$TABLESPACE**  .id|  
|
|||DV$TABLESPACE|表空间的汇总信息|Y|id >   **DV$DATABUCKET**  .id|  
|
||表|DV$CORRUPTED_TABLE|损坏表的信息|N|  
|  
|
||游标|DV$DICT_CURSOR|正在被使用的游标信息|Y|SID >   **DV$SESSION**  .SID,,SQL_ID >   **DV$SQL**  .sql_id|  
|
||锁|DV$LOCK|节点的锁信息|N|  
|  
|
|||DV$SPINLOCK|节点spin锁的信息|Y|SID >   **DV$SESSION**  .SID,|  
|
|主备    
    
    
    
|链路|DV$ARCHIVE_DEST|主备链路配置信息|Y|这两个视图可join|cn无主备    
    
    
    
    
|
||统计信息|DV$ARCHIVE_DEST_STATUS|备机的统计信息|Y|||
||选举|DV$ELECTION|节点实时的选举状态|Y|  
||
||复制|DV$REPLICATION_EVENT|主备复制汇总信息|Y|  
||
||redo|DV$REPLICATION_STATUS|备机redo传输汇总信息|Y|  
||
|  
    
    
    
  SQL|SQL|DV$SQL|SQL统计信息|Y|  
    
  SQL视图之间可join: SQL_ID, SQL_TEXT, HASH_VALUE|  
    
    
    
    
    
|
|||DV$SQLAREA|SQL统计信息（相同SQL合并）|Y|||
|||DV$SQLSTATS|SQL执行计划统计信息汇总|Y|||
|||DV$SQLTEXT|正在执行的SQL语句汇总信息|Y|||
|||DV$SQL_PLAN|执行计划信息|Y|||
|||DV$SQL_PLAN_STATISTICS|子游标详细执行计划信息|Y|||
|配置参数|配置参数|DV$PARAMETER|  
|Y|这两个视图差不多，可join|  
|
|||DV$SYSTEM_PARAMETER|  
|Y||  
|
|统计信息    
    
    
    
    
    
    
    
    
    
    
|统计信息    
    
    
    
    
    
    
    
    
    
|DV$ARCHIVED_LOG|归档文件统计信息|Y|  
|  
|
|||DV$MYSTAT|当前会话的统计信息|Y|SID >   **dv$session**  .SID,,STATISTIC# >   **V$STATNAME**  .STATISTIC#|  
|
|||DV$OPEN_CURSOR|statement的统计信息及每个statement的内存使用信息|Y|SID >   **dv$session**  .SID,    
  SQL_ID >   **DV$SQL**  .sql_id,|  
|
|||DV$OSSTAT|操作系统的系统利用率统计信息|Y|  
|  
|
|||DV$PROCESS|当前线程信息|Y|  
|  
|
|||DV$PUB_STAT |MN节点后台推送任务的统计信息|N|  
|  
|
|||DV$SYSSTAT|会话的相关统计信息|Y|name >   **V$STATNAME**  .STATISTIC#|  
|
|||DV$SYSTEM_EVENT|系统事件统计信息|Y|  
|  
|
|||DV$VMSTAT|VM的统计信息|Y|SID >   **DV$SESSEION**  .SID|  
|
|||  
  DV$REDOSTAT    
    
|redo性能的统计信息|Y|  
|  
|
|||DV$SESSTAT|会话的统计信息|Y|SID >   **DV$SESSEION**  .SID,STATISTIC# >   **V$STATNAME**  .STATISTIC#|  
|
|故障|故障|DV$DIAG_INCIDENT|故障事件信息|可构造|SESSION_ID >   **DV$SESSEION**  .SID|  
|
|||DV$DIAG_PROBLEM|问题信息|可构造|PROBLEM_KEY >   **DV$DIAG_INCIDENT**  .ERROR_NUMBER|  
|
|||DV$HM_FINDING|节点的相关健康检查成果|可构造|  
|  
|
|||DV$HM_RUN|节点的所有健康检查相关信息及其状态|可构造|  
|  
|
|审计|审计|DV$AUD_UNIFIED|审计信息|Y|对应单机视图：aud$unified，,UNIFIED_AUDIT_POLICIES > (DBA视图)  **AUDIT_UNIFIED_ENABLED_POLICIES**  .POLICY_NAME,,UNIFIED_AUDIT_POLICIES > (DBA视图)  **AUDIT_UNIFIED_POLICIES**  .POLICY_NAME,,action ->   **V$AUDITABLE_OBJECT_ACTIONS**  .action,,action ->   **V$AUDITABLE_SYSTEM_ACTIONS**  .action,,action ->   **AUDITABLE_SYSTEM_ACTIONS**  .action|  
|
|其他|备份恢复|DV$BACKUP_PROGRESS|备份或恢复的进度信息|Y|  
|  
|
||执行计划|DV$SQL_PLAN_STATISTICS|子游标详细执行计划信息|Y|SQL_ID >   **DV$SQL**  .SQL_ID|  
|
||日志回放|DV$RECOVERY_PROGRESS|日志回放进度汇总信息|Y|  
|  
|


**系统表和视图类似**  ：

|动态视图|系统表|DBA/USER/ALL视图|
|---|---|---|
|V$TABLESPACE|  
|DBA_TABLESPACES/USER_TABLESPACES|
|V$DATABUCKET|  
|DBA_DATA_BUCKETS|
|V$DATAFILE|  
|DBA_DATA_FILES (>DBA_TEMP_FILES)|
|V$LSC_SLICE_STAT|  
|DBA_LSC_SLICE_STAT/ALL_LSC_SLICE_STAT/USER_LSC_SLICE_STAT|
|  
|OBJ$|DBA_OBJECTS/ALL_OBJECTS/USER_OBJECTS|
|  
|USER$|DBA_USERS/ALL_USERS/USER_USERS|


**特殊系统表：**  GTS_INFO$信息位于mn上。

# 3.   **测试设计方法**

测试设计主要采用等价类及错误推测等测试法进行设计

[dv视图join.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmRhMWFkOWEzMzExZGM3NjdlIiwicmVmX2lkIjoiNjczOTY5NmQ3MjgyMDZlZmI5MmVmMzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDQ0LCJleHAiOjE3ODIyMTM4NDR9.AZ3QQKLfp-g-qtonFf7i9tUzhiEHKiwFwrJYyLedlcI)

# 4.   **详细测试设计**

1）join对象策略

|对象|对象|结果|
|---|---|---|
|dv$视图|本视图，对应v$视图|√|
|  
|其他可join视图（见上表）|√|
|  
|v$视图对应的等价DBA/ALL/USER视图|√|
|  
|系统表及等价DBA/ALL/USER视图|√|
|  
|自定义视图|×|
|  
|GTS_INFO$|  
|


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

  


# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|部署|集群|
|操作系统|Linux|


  


  


## Attachments:

[dv视图join.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmRhMWFkOWEzMzExZGM3NjdlIiwicmVmX2lkIjoiNjczOTY5NmQ3MjgyMDZlZmI5MmVmMzNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDQ0LCJleHAiOjE3ODIyMTM4NDR9.AZ3QQKLfp-g-qtonFf7i9tUzhiEHKiwFwrJYyLedlcI)

 (application/x-xmind)    
