Created by 李攀, last modified on 一月 17, 2024

#   [1. 概述](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#1%E6%A6%82%E8%BF%B0)  

本文描述集群支持AWR功能的测试设计

SR链接：    [YDBRD-22809](https://jira.yasdb.com/browse/YDBRD-22809?src=confmacro)    -  集群支持AWR  完成

开发设计文档：    [特性设计-YDBRD-20372:集群支持AWR - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141576567)  

参考文档：    [Oracle RAC AWR指标含义 (askmac.cn)](https://www.askmac.cn/archives/rac-awr-statistics.html)  

awr报告示例：



#   [2. 需求分析](http://cod-conf.sics.com/pages/viewpage.action?pageId=59610608#2%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**2.1 功能点分析**

  


|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|集群指标项|从已有视图中计算得到不同指标项(gv$instance、 V$CLUSTER_TASK_STAT、v$sysstat、 v$cluster_message_stat)|是|是|----|
|  
|AWR高级包调整|WRH$表需要调整，保存集群指标项差值；增加一类高级包内置函数，用于生成集群指标项的JSON数组，用于传递给前端页面呈现|是|是|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|----|
|  
|性能场景2|----|否|否|----|
|可用性|恢复场景|----|否|否|----|
|可靠性|故障场景|----|否|否|----|
|可维可测|DFX功能1|----|否|否|----|
|  
|DFX功能2|----|否|否|----|
|安全|安全场景1|----|否|否|----|
|易用性|----|----|否|否|----|
|可修改性|----|----|否|否|----|
|兼容性|数据库升级|----|否|是|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|----|


**2.2 应用场景**

增加集群独有资源的使用情况监控，GCS相关的统计信息、增加集群消息ICS，锁GLS等相关统计信息

  


**2.3规格约束**

1. 只在集群环境生成的AWR报告中显示YAC Statistics项，单机环境不显示。
1. RAC是每个实例可以生成一个AWR报告，所以AWR报告上统计的是本实例看到的系统统计信息。目前不支持生成汇总的报告


# **3.详细测试设计**

## 3.1 测试设计方法

1.数据检验 采样逻辑覆盖法验证数据的准确性

2.对AWR报告的生成采样等价类划分和场景覆盖法

  


## 3.2 详细测试设计

1.  Information、Report Summary、SQL Statistics页面和单机保持一致，统计的是当前实例的信息，关注每个实例数据生成是否正常，本次不校验每个指标的数据准确性

2.新增展示页面  YAC Statistics 数据准确性验证：

|分类|指标描述|指标|指标信息来源，数据来源公式|
|:---|:---|:---|:---|
|YAC Summary|整集群中的实例数目|Number of Instances|select count(*) from gv$instance;（未判断状态）,  `Begin:select`         `instance_nums `      `into`         `b_instance_nums `      `from`         `SYS.WRH$_CLUSTER_INFO `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num;`      
    `End:select`         `instance_nums `      `into`         `e_instance_nums `      `from`         `SYS.WRH$_CLUSTER_INFO `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num;`  ,  
    
   |
||GCS后台线程数|Number of GCS Tasks|select count(*) from V$CLUSTER_TASK_STAT where TASK_TYPE = 'AXC_GCS_TASK',  
,  `select`         `count`      `(*) `      `into`         `b_LMS_nums `      `from`         `SYS.WRH$_CLUSTER_TASK_STAT `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `TASK_TYPE = `      `'AXC_GCS_TASK'`      `;`      
    `select`         `count`      `(*) `      `into`         `e_LMS_nums `      `from`         `SYS.WRH$_CLUSTER_TASK_STAT `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `TASK_TYPE = `      `'AXC_GCS_TASK'`      `;`  ,  
    
|
|Global Cache Load Profile|从其他实例接收的页面数量|Global Cache blocks received|select value from v$sysstat where name = 'GC CURRENT BLOCK RECEIVED' or  'GC CR BLOCK RECEIVED';    
   ,  `select`         `value `      `into`         `b_gc_curr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id= 801;`      
    `select`         `value `      `into`         `e_gc_curr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id= 801;`      
    `select`         `value `      `into`         `b_gc_cr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 804;`      
    `select`         `value `      `into`         `e_gc_cr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 804;`      
    `r_gc_block_received := e_gc_curr_block_received + e_gc_cr_block_received - b_gc_curr_block_received - b_gc_cr_block_received;`  |
||发送给其他实例的页面数量|Global Cache blocks served|select value from v$sysstat where name = 'GC CURRENT BLOCK SERVED' or name = 'GC CR BLOCK SERVED';    
   ,  `select`         `value `      `into`         `b_gc_curr_block_served `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 800;`      
    `select`         `value `      `into`         `e_gc_curr_block_served `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 800;`      
    `select`         `value `      `into`         `b_gc_cr_block_served `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 803;`      
    `select`         `value `      `into`         `e_gc_cr_block_served `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 803;`      
    `r_gc_block_served := e_gc_curr_block_served + e_gc_cr_block_served - b_gc_curr_block_served - b_gc_cr_block_served;`  |
||收到的全局页面访问/全局锁访问的消息数量|GRC messages received|select sum(recv_times) from v$cluster_message_stat where message_group =  'AXC_GRC_TASK';    
   ,  `select`         `sum`      `(recv_times) `      `into`         `b_message_received `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GRC_TASK'`      `;`      
    `select`         `sum`      `(recv_times) `      `into`         `e_message_received `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GRC_TASK'`      `;`      
    `r_grc_message_received := e_message_received - b_message_received;`  |
|||GCS messages received|select sum(recv_times) from v$cluster_message_stat where message_group =  'AXC_GCS_TASK';,  
,  `select`         `sum`      `(recv_times) `      `into`         `b_message_received `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GCS_TASK'`      `;`      
    `select`         `sum`      `(recv_times) `      `into`         `e_message_received `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GCS_TASK'`      `;`      
    `r_gcs_message_received := e_message_received - b_message_received;`  ,  
   |
|||GLS messages received|select sum(recv_times) from v$cluster_message_stat where message_group =  'AXC_GLS_TASK';    
   ,  `select`         `sum`      `(recv_times) `      `into`         `b_message_received `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GLS_TASK'`      `;`      
    `select`         `sum`      `(recv_times) `      `into`         `e_message_received `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GLS_TASK'`      `;`      
    `r_gls_message_received := e_message_received - b_message_received;`  |
||发送的全局页面访问/全局锁访问的消息数量|GRC messages sent|select sum(send_times) from v$cluster_message_stat where message_group = 'AXC_GLS_TASK';    
   ,  `select`         `sum`      `(send_times) `      `into`         `b_message_sent `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GRC_TASK'`      `;`      
    `select`         `sum`      `(send_times) `      `into`         `e_message_sent `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GRC_TASK'`      `;`      
    `r_grc_message_sent := e_message_sent - b_message_sent;`  |
|||GCS messages sent|select sum(send_times) from v$cluster_message_stat where message_group = 'AXC_GRC_TASK';    
   ,  `select`         `sum`      `(send_times) `      `into`         `b_message_sent `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GCS_TASK'`      `;`      
    `select`         `sum`      `(send_times) `      `into`         `e_message_sent `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GCS_TASK'`      `;`      
    `r_gcs_message_sent := e_message_sent - b_message_sent;`  |
|||GLS messages sent|select sum(send_times) from v$cluster_message_stat where message_group = 'AXC_GCS_TASK';    
   ,  `select`         `sum`      `(send_times) `      `into`         `b_message_sent `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GLS_TASK'`      `;`      
    ` `      `select`         `sum`      `(send_times) `      `into`         `e_message_sent `      `from`         `SYS.wrh$_CLUSTER_MESSAGE_STAT `      `where`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `message_group = `      `'AXC_GLS_TASK'`      `;`      
    ` `      `r_gls_message_sent := e_message_sent - b_message_sent;`  |
||融合写入次数|DBWR Fusion writes|select value from v$sysstat where name = 'DBWR PC OWNER WRITES'    
   ,  `select`         `value `      `into`         `b_dbwr_fusion_writes `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 89;`      
    `select`         `value `      `into`         `e_dbwr_fusion_writes `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 89;`      
    `r_dbwr_fusion_writes := e_dbwr_fusion_writes - b_dbwr_fusion_writes;`  |
|Global Cache Efficiency Percentages|数据块从本地缓存命中占会话总的数据库请求次数的比例。在OLTP应用中最希望的是尽可能维持这个比率较高，因为这是最低成本和最快速的获得数据库数据块的方法。计算公式：Local Cache Buffer Access Ratio = 1 – ( physical reads cache + Global Cache blocks received ) / Logical Reads|Buffer access - local cache %|（总读取次数 - remote cache - disk）/ 总读取次数，参考 Buffer access - remote cache %、Buffer access - disk %    
   ,  `select`         `value `      `into`         `b_buffer_gets `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 120;`      
    `    `      `select`         `value `      `into`         `e_buffer_gets `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 120;`      
    `    `      `r_total_buffer_access := e_buffer_gets - b_buffer_gets;`      
    
    `r_buffer_access_local_cache := r_total_buffer_access - r_buffer_access_remote_cache - r_buffer_access_dist;`      
    
    `r_buffer_access_local_cache_percent := round(r_buffer_access_local_cache*100/r_total_buffer_access, 2);`  |
||数据块从远程实例缓存命中占会话总的数据块请求的比例。在OLTP应用中这个比率和Buffer access – local cache的和应该尽可能的高因为这两种方法访问数据库数据块是最快速最低成本的。这个比率的计算方法：Remote Cache Buffer Access Ratio = Global Cache blocks received / Logical Reads|Buffer access - remote cache %|v$sysstat.BUFFER GETS 代表访问页面缓存的次数，v$sysstat.GC CURRENT BLOCK RECEIVED GC CR BLOCK RECEIVED代表远端发过来页面的次数    
   ,  `select`         `value `      `into`         `b_gc_curr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 801;`      
    `    `      `select`         `value `      `into`         `e_gc_curr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 801;`      
    `    `      `select`         `value `      `into`         `b_gc_cr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 804;`      
    `    `      `select`         `value `      `into`         `e_gc_cr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 804;`      
    `    `      `r_buffer_access_remote_cache := e_gc_curr_block_received + e_gc_cr_block_received - b_gc_curr_block_received - b_gc_cr_block_received;`      
    
    
    `r_buffer_access_remote_cache_percent := round(r_buffer_access_remote_cache*100/r_total_buffer_access, 2);`  |
||从磁盘上读数据块到缓存占会话总的数据块请求次数的比例。在OLTP应用中希望维持这个比例低因为物理读是最慢的访问数据库数据块的方式。这个比率计算方法：,  
,1 – physical reads cache / Logical Reads|Buffer access - disk %|v$sysstat.BUFFER GETS 代表访问页面缓存的次数，GC LOCAL GRANTS代表本地授权读盘次数， GC REMOTE GRANTS代表远端授权读盘次数，（本地授权读盘次数 + 远端授权读盘次数）/ 页面缓存访问总次数    
   ,  `select`         `value `      `into`         `b_gc_local_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 807;`      
    `    `      `select`         `value `      `into`         `e_gc_local_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 807;`      
    `    `      `select`         `value `      `into`         `b_gc_remote_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 811;`      
    `    `      `select`         `value `      `into`         `e_gc_remote_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 811;`      
    `    `      `r_buffer_access_dist := e_gc_local_grants + e_gc_remote_grants - b_gc_local_grants - b_gc_remote_grants;`      
    
    
    `r_buffer_access_disk_percent := round(r_buffer_access_dist*100/r_total_buffer_access, 2);`  |
||  
|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics    
    
|从缓存中获取CR页面的平均耗时|Avg global cache cr block receive time (us)|(v$sysstat.GC CR BLOCK RECEIVE TIME + v$sysstat.GC LOCAL CR GRANT TIME +v$sysstat.GC REMOTE CR GRANT TIME) / (GC CR BLOCK RECEIVED + GC LOCAL CR GRANTS + GC REMOTE CR GRANTS),  
    
   ,  `select`         `value `      `into`         `b_gc_cr_block_receive_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 805;`      
    `    `      `select`         `value `      `into`         `e_gc_cr_block_receive_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 805;`      
    `    `      `select`         `value `      `into`         `b_gc_local_cr_grant_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 812;`      
    `    `      `select`         `value `      `into`         `e_gc_local_cr_grant_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 812;`      
    `    `      `select`         `value `      `into`         `b_gc_remote_cr_grant_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 814;`      
    `    `      `select`         `value `      `into`         `e_gc_remote_cr_grant_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 814;`      
    `    `      `r_gc_cr_block_received_time := e_gc_cr_block_receive_time + e_gc_local_cr_grant_time + e_gc_remote_cr_grant_time - b_gc_cr_block_receive_time - b_gc_local_cr_grant_time - b_gc_remote_cr_grant_time;`      
    
    `    `      `select`         `value `      `into`         `b_gc_cr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 804;`      
    `    `      `select`         `value `      `into`         `e_gc_cr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 804;`      
    `    `      `select`         `value `      `into`         `b_gc_local_cr_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 811;`      
    `    `      `select`         `value `      `into`         `e_gc_local_cr_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 811;`      
    `    `      `select`         `value `      `into`         `b_gc_remote_cr_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 813;`      
    `    `      `select`         `value `      `into`         `e_gc_remote_cr_grants `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 813;`      
    `    `      `r_gc_cr_block_received := e_gc_cr_block_received + e_gc_local_cr_grants + e_gc_remote_cr_grants - b_gc_cr_block_received - b_gc_local_cr_grants - b_gc_remote_cr_grants;`      
    
    
    `r_avg_gc_cr_block_receive_time := round(r_gc_cr_block_received_time/r_gc_cr_block_received, 2);`  ,  
|
||从缓存中获取最新页面的平均耗时|Avg global cache current block receive time (us)|GC CURRENT BLOCK RECEIVE TIME / GC CURRENT BLOCK RECEIVED    
   ,  `select`         `value `      `into`         `b_gc_curr_block_receive_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 802;`      
    `    `      `select`         `value `      `into`         `e_gc_curr_block_receive_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 802;`      
    `    `      `r_gc_curr_block_receive_time := e_gc_curr_block_receive_time - b_gc_curr_block_receive_time;`      
    
    `    `      `select`         `value `      `into`         `b_gc_curr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 801;`      
    `    `      `select`         `value `      `into`         `e_gc_curr_block_received `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 801;`      
    `    `      `r_gc_curr_block_received := e_gc_curr_block_received - b_gc_curr_block_received;`      
    
    `r_avg_gc_curr_block_receive_time := round(r_gc_curr_block_receive_time/r_gc_curr_block_received, 2);`  |
||数据块平均刷盘耗时|Avg global cache current block flush time (us)|DISK WRITE TIME / BUFFER BLOCKS WRITES,  
    
   ,  `select`         `value `      `into`         `b_disk_write_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 3;`      
    `   `      `select`         `value `      `into`         `e_disk_write_time `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 3;`      
    `   `      `r_disk_write_time := e_disk_write_time - b_disk_write_time;`      
    
    `   `      `select`         `value `      `into`         `b_buffer_blocks_writes `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_bid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 132;`      
    `   `      `select`         `value `      `into`         `e_buffer_blocks_writes `      `FROM`         `SYS.wrh$_sysstat `      `WHERE`         `snap_id=l_eid `      `AND`         `dbid = l_dbid `      `AND`         `instance_number = l_inst_num `      `AND`         `stat_id = 132;`      
    `   `      `r_buffer_blocks_writes := e_buffer_blocks_writes - b_buffer_blocks_writes;`      
    
    `r_avg_gc_curr_block_flush_time := round(r_disk_write_time / r_buffer_blocks_writes);`  ,  
|


  


## YAC Sys Stats指标

逻辑验证：通过V$SYSSTAT，  SYS  .  wrh  $  _sysstat表  取2次快照的差值。

|YAC stats|  
|  
|GC BLOCK INVALIDATES|  
|
|:---|:---|:---|:---|:---|
|  
|  
|  
|GC LOCAL GRANT TIME|  
|
|  
|  
|  
|GC REMOTE GRANT TIME|  
|
|  
|  
|  
|GC LOCAL UPGRADES|  
|
|  
|  
|  
|GC LOCAL UPGRADE TIME|  
|
|  
|  
|  
|GC REMOTE UPGRADES|  
|
|  
|  
|  
|GC REMOTE UPGRADE TIME|  
|
|  
|  
|  
|GC RA BLOCK GRANTS|  
|
|  
|  
|  
|GC CLEAN BLOCKS|  
|
|  
|  
|  
|GC SKIP CLEAN BLOCKS|  
|
|  
|  
|  
|GC LOCAL GRANT LOCKS|  
|
|  
|  
|  
|GC LOCAL RELEASE LOCKS|  
|
|  
|  
|  
|GC REMOTE GRANT LOCKS|  
|
|  
|  
|  
|GC REMOTE RELEASE LOCKS|  
|
|  
|  
|  
|GC NOTIFY FLUSH|  
|
|  
|  
|  
|GC CURRENT BLOCK RETRIES|  
|
|  
|  
|  
|GC CR BLOCK RETRIES|  
|
|  
|  
|  
|GC UPGRADE RETRIES|  
|
|  
|  
|  
|GC CLOSE BLOCK RETRIES|  
|
|  
|  
|  
|GC RECYCLE BLOCK RETRIES|  
|
|  
|  
|  
|GC RA BLOCK RETRIES|  
|
|  
|  
|  
|GET REMOTE XACT STATUS|  
|
|  
|  
|  
|GET REMOTE XACT STATUS TIME|  
|
|  
|  
|  
|GET REMOTE XACT INFO|  
|
|  
|  
|  
|GET REMOTE XACT INFO TIME|  
|
|  
|  
|  
|REMOTE XACT WAITS|  
|
|  
|  
|  
|REMOTE XACT WAIT TIME|  
|
|  
|  
|  
|DISKCACHE HIT CNT|  
|
|  
|  
|  
|DISKCACHE MISS CNT|  
|
|  
|  
|  
|DISKCACHE READ BYTES|  
|
|  
|  
|  
|DISKCACHE READ TIME|  
|
|  
|  
|  
|DISKCACHE READ CNT|  
|
|  
|  
|  
|DISKCACHE WRITE BYTES|  
|
|  
|  
|  
|DISKCACHE WRITE TIME|  
|
|  
|  
|  
|DISKCACHE WRITE CNT|  
|
|  
|  
|  
|ARCH DATA LFN|  
|
|  
|  
|  
|ARCH DATA STBY MIN LFN|  
|
|  
|  
|  
|ARCH DATA CHECK LFN|  
|


awr 生成：

|输入条件|有效等价类|无效等价类|编号|
|:---|:---|:---|:---|
|生成awr用户|regress|  
|  
|
|  
|sys|非bda权限的普通用户|  
|
|不同实例生成的报告|实例1|  
|  
|
|  
|实例2|  
|  
|
|  
|实例3|  
|  
|
|权限|sys或者dba用户手工创建snapshot|非sys或者dba用户手工创建snapshot|  
|
|大量的sql|  
|  
|  
|
|大量会话|  
|  
|  
|
|sql中含有字符集特殊字符|  
|  
|  
|
|集群tpcc|  
|  
|  
|
|是否有自动生成|快照信息自动生成|  
|  
|
|系统表|SYS.WRH$_CLUSTER_INFO,SYS.WRH$_CLUSTER_TASK_STAT,SYS.WRH$_CLUSTER_MESSAGE_STAT,WRH$_SYSSTAT|  
|  
|


  


**dfx测试项**  ：

|测试项|是否涉及|测试点|
|:---|:---|:---|
|CT|否|  
|
|长稳|-|  
|
|一致性|-|  
|
|安全|否|  
|
|HA|否|  
|
|压力|-|  
|
|性能|是|生成AWR报告的性能|
|资料|是|  
|


  


  


# 4. 测试用例

  


  


# 5. 测试框架设计

不涉及

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|集群|


# 7. 工作量评估

工作量：2  *人周*

计划测试完成时间：2024/01/31

  


会议纪要：

1.实例系统时间人为更改，生成报告是否正常

2. 不同实例快照ID相同场景测试

3.指标项数据构造

4.测试新增系统表查询新增插入等语句

5.2个实例同时生成AWR

6.替换

## Attachments:



 (text/html)    
