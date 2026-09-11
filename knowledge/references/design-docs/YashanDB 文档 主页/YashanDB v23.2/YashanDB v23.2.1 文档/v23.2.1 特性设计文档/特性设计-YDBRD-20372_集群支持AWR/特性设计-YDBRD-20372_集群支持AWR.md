Created by 未知用户 (liaofeng), last modified on 一月 17, 2024

*SR链接：*    [YDBRD-22809](https://jira.yasdb.com/browse/YDBRD-22809?src=confmacro)    *-*  *集群支持AWR*  *完成*

##   [1. 总述](#1-总述)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](#11-需求来源)  

本需求为集群产品化需求，集群AWR为定位慢SQL和数据库事件，重要的DFX手段。

###   [1.2 调研文档](#12-调研文档)  

参照ORACLE的AWR报告，实现RAC Statistics的章节。可查看附件作为参考。主要为功能体现。

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|集群指标项|从已有视图中计算得到不同指标项(gv$instance、 V$CLUSTER_TASK_STAT、v$sysstat、 v$cluster_message_stat)|是|是|----|
||AWR高级包调整|WRH$表需要调整，保存集群指标项差值；增加一类高级包内置函数，用于生成集群指标项的JSON数组，用于传递给前端页面呈现|是|是|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|----|
||性能场景2|----|否|否|----|
|可用性|恢复场景|----|否|否|----|
|可靠性|故障场景|----|否|否|----|
|可维可测|DFX功能1|----|否|否|----|
||DFX功能2|----|否|否|----|
|安全|安全场景1|----|否|否|----|
|易用性|----|----|否|否|----|
|可修改性|----|----|否|否|----|
|兼容性|数据库升级|----|否|是|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|----|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|LMS|Global Cache Service Process，对应Yashan的GCS TASK|是|  [https://blog.csdn.net/jycjyc/article/details/106096965](https://blog.csdn.net/jycjyc/article/details/106096965)  |
|GES|Global Enqueue Service Process，对应Yashan的GRC TASK|是|同上|
|reconfiguration|对应reform|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）（详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

1. 只在集群环境生成的AWR报告中显示YAC Statistics项，单机环境不显示。


##   [4. 特性](#4-特性)  

RAC是每个实例可以生成一个AWR报告，所以AWR报告上统计的是本实例看到的系统统计信息。

###   [4.1 集群指标项](#41-集群指标项)  

借用ORACLE的指标呈现，从ORACLE的指标来对应我们的指标项

  


|分类|O指标|指标描述|Y指标|指标信息来源|
|:---|:---|:---|:---|:---|
|TOTAL|Number of Instances|整集群中的实例数目|----|select count(*) from gv$instance;（未判断状态）,  
,```
select instance_nums into b_instance_nums from SYS.WRH$_CLUSTER_INFO where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num;
    select instance_nums into e_instance_nums from SYS.WRH$_CLUSTER_INFO where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num;
```|
|TOTAL|Number of LMS's|GCS后台线程数|Number of GCS Tasks|select count(*) from V$CLUSTER_TASK_STAT where TASK_TYPE = 'AXC_GCS_TASK',  
,```
select count(*) into b_LMS_nums from SYS.WRH$_CLUSTER_TASK_STAT where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND TASK_TYPE = 'AXC_GCS_TASK';
    select count(*) into e_LMS_nums from SYS.WRH$_CLUSTER_TASK_STAT where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND TASK_TYPE = 'AXC_GCS_TASK';
```|
|TOTAL|Number of realtime LMS's|  
|----|不支持|
|Global Cache Load Profile|Global Cache blocks received|从其他实例接收的页面数量|  
|select value from v$sysstat where name = 'GC CURRENT BLOCK RECEIVED' or  'GC CR BLOCK RECEIVED';,```
select value into b_gc_curr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 801;
    select value into e_gc_curr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 801;
    select value into b_gc_cr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 804;
    select value into e_gc_cr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 804;
    r_gc_block_received := e_gc_curr_block_received + e_gc_cr_block_received - b_gc_curr_block_received - b_gc_cr_block_received;
```|
|Global Cache Load Profile|Global Cache blocks served|发送给其他实例的页面数量|  
|select value from v$sysstat where name = 'GC CURRENT BLOCK SERVED' or name = 'GC CR BLOCK SERVED';,```
select value into b_gc_curr_block_served FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 800;
    select value into e_gc_curr_block_served FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 800;
    select value into b_gc_cr_block_served FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 803;
    select value into e_gc_cr_block_served FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 803;
    r_gc_block_served := e_gc_curr_block_served + e_gc_cr_block_served - b_gc_curr_block_served - b_gc_cr_block_served;
```|
|Global Cache Load Profile|GCS/GES messages received|收到的全局页面访问/全局锁访问的消息数量|GRC messages received|select sum(recv_times) from v$cluster_message_stat where message_group =  'AXC_GRC_TASK';,```
select sum(recv_times) into b_message_received from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GRC_TASK';
    select sum(recv_times) into e_message_received from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GRC_TASK';
    r_grc_message_received := e_message_received - b_message_received;
```|
||||GCS messages received|select sum(recv_times) from v$cluster_message_stat where message_group =  'AXC_GCS_TASK';,```
select sum(recv_times) into b_message_received from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GCS_TASK';
    select sum(recv_times) into e_message_received from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GCS_TASK';
    r_gcs_message_received := e_message_received - b_message_received;
```|
||||GLS messages received|select sum(recv_times) from v$cluster_message_stat where message_group =  'AXC_GLS_TASK';,```
select sum(recv_times) into b_message_received from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GLS_TASK';
    select sum(recv_times) into e_message_received from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GLS_TASK';
    r_gls_message_received := e_message_received - b_message_received;
```|
|Global Cache Load Profile|GCS/GES messages sent|发送的全局页面访问/全局锁访问的消息数量|GRC messages sent|select sum(send_times) from v$cluster_message_stat where message_group = 'AXC_GLS_TASK';,```
select sum(send_times) into b_message_sent from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GRC_TASK';
    select sum(send_times) into e_message_sent from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GRC_TASK';
    r_grc_message_sent := e_message_sent - b_message_sent;
```|
||||GCS messages sent|select sum(send_times) from v$cluster_message_stat where message_group = 'AXC_GRC_TASK';,```
select sum(send_times) into b_message_sent from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GCS_TASK';
    select sum(send_times) into e_message_sent from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GCS_TASK';
    r_gcs_message_sent := e_message_sent - b_message_sent;
```|
||||GLS messages sent|select sum(send_times) from v$cluster_message_stat where message_group = 'AXC_GCS_TASK';,```
select sum(send_times) into b_message_sent from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GLS_TASK';
    select sum(send_times) into e_message_sent from SYS.wrh$_CLUSTER_MESSAGE_STAT where snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND message_group = 'AXC_GLS_TASK';
    r_gls_message_sent := e_message_sent - b_message_sent;
```|
|Global Cache Load Profile|DBWR Fusion writes|融合写入次数|----|select value from v$sysstat where name = 'DBWR PC OWNER WRITES',```
select value into b_dbwr_fusion_writes FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 89;
    select value into e_dbwr_fusion_writes FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 89;
    r_dbwr_fusion_writes := e_dbwr_fusion_writes - b_dbwr_fusion_writes;
```|
|Global Cache Efficiency Percentages|Buffer access - local cache %|percentage of blocks satisfied from local cache to the total number of blocks requested by sessions. It is desirable to maintain this ratio as high as possible because this is the least expensive and fastest way to get the database block.|----|（总读取次数 - remote cache - disk）/ 总读取次数，参考 Buffer access - remote cache %、Buffer access - disk %,```
select value into b_buffer_gets FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 120;
    select value into e_buffer_gets FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 120;
    r_total_buffer_access := e_buffer_gets - b_buffer_gets;

r_buffer_access_local_cache := r_total_buffer_access - r_buffer_access_remote_cache - r_buffer_access_dist;

r_buffer_access_local_cache_percent := round(r_buffer_access_local_cache*100/r_total_buffer_access, 2);
```|
|Global Cache Efficiency Percentages|Buffer access - remote cache %|percentage of blocks satisfied from remote instance cache to the total number of blocks requested by sessions. The sum of this ratio and Buffer access - local cache % described above should be maintained as high as possible because these two paths of accessing DB blocks are fastest and least expensive to the system. Getting block from the cache of remote instance is about 10 times faster than reading it from the disk.|----|v$sysstat.BUFFER GETS 代表访问页面缓存的次数，v$sysstat.GC CURRENT BLOCK RECEIVED GC CR BLOCK RECEIVED代表远端发过来页面的次数,```
select value into b_gc_curr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 801;
    select value into e_gc_curr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 801;
    select value into b_gc_cr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 804;
    select value into e_gc_cr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 804;
    r_buffer_access_remote_cache := e_gc_curr_block_received + e_gc_cr_block_received - b_gc_curr_block_received - b_gc_cr_block_received;


r_buffer_access_remote_cache_percent := round(r_buffer_access_remote_cache*100/r_total_buffer_access, 2);
```|
|Global Cache Efficiency Percentages|Buffer access - disk %|percentage of blocks read from disk into the cache to the total number of blocks requested by sessions. It is desirable to maintain this ratio low because physical reads is the slowest way to access database blocks.|----|v$sysstat.BUFFER GETS 代表访问页面缓存的次数，GC LOCAL GRANTS代表本地授权读盘次数， GC REMOTE GRANTS代表远端授权读盘次数，（本地授权读盘次数 + 远端授权读盘次数）/ 页面缓存访问总次数,```
select value into b_gc_local_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 807;
    select value into e_gc_local_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 807;
    select value into b_gc_remote_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 811;
    select value into e_gc_remote_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 811;
    r_buffer_access_dist := e_gc_local_grants + e_gc_remote_grants - b_gc_local_grants - b_gc_remote_grants;


r_buffer_access_disk_percent := round(r_buffer_access_dist*100/r_total_buffer_access, 2);
```|
|Global Cache Efficiency Percentages|Global Cache Locality %|  
|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache cr block receive time (us)|从缓存中获取CR页面的平均耗时|805 GC CR BLOCK RECEIVE TIME|(v$sysstat.GC CR BLOCK RECEIVE TIME + v$sysstat.GC LOCAL CR GRANT TIME +v$sysstat.GC REMOTE CR GRANT TIME) / (GC CR BLOCK RECEIVED + GC LOCAL CR GRANTS + GC REMOTE CR GRANTS),  
,```
select value into b_gc_cr_block_receive_time FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 805;
    select value into e_gc_cr_block_receive_time FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 805;
    select value into b_gc_local_cr_grant_time FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 812;
    select value into e_gc_local_cr_grant_time FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 812;
    select value into b_gc_remote_cr_grant_time FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 814;
    select value into e_gc_remote_cr_grant_time FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 814;
    r_gc_cr_block_received_time := e_gc_cr_block_receive_time + e_gc_local_cr_grant_time + e_gc_remote_cr_grant_time - b_gc_cr_block_receive_time - b_gc_local_cr_grant_time - b_gc_remote_cr_grant_time;

    select value into b_gc_cr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 804;
    select value into e_gc_cr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 804;
    select value into b_gc_local_cr_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 811;
    select value into e_gc_local_cr_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 811;
    select value into b_gc_remote_cr_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 813;
    select value into e_gc_remote_cr_grants FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 813;
    r_gc_cr_block_received := e_gc_cr_block_received + e_gc_local_cr_grants + e_gc_remote_cr_grants - b_gc_cr_block_received - b_gc_local_cr_grants - b_gc_remote_cr_grants;


r_avg_gc_cr_block_receive_time := round(r_gc_cr_block_received_time/r_gc_cr_block_received, 2);
```|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache current block receive time (us)|从缓存中获取最新页面的平均耗时|802 GC CURRENT BLOCK RECEIVE TIME|GC CURRENT BLOCK RECEIVE TIME / GC CURRENT BLOCK RECEIVED,```
select value into b_gc_curr_block_receive_time FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 802;
    select value into e_gc_curr_block_receive_time FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 802;
    r_gc_curr_block_receive_time := e_gc_curr_block_receive_time - b_gc_curr_block_receive_time;

    select value into b_gc_curr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 801;
    select value into e_gc_curr_block_received FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 801;
    r_gc_curr_block_received := e_gc_curr_block_received - b_gc_curr_block_received;

r_avg_gc_curr_block_receive_time := round(r_gc_curr_block_receive_time/r_gc_curr_block_received, 2);
```|
|Global Cache and Enqueue Services- Workload Characteristics|Avg LMS process busy %|  
|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache cr block build time (us)|CGS获取CR页面时的CR页面构建时间|812 GC LOCAL CR GRANT TIME|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Global cache log flushes for cr blocks served %|发送CR页面时需要触发log flush的百分比|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache cr block flush time (us)|CR页面请求处理时flush redo的平均时间|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache current block pin time (us)|最新页面获取请求处理时的本地锁获取耗时|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Global cache log flushes for current blocks served %|发送最新页面时触发log flush的百分比|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache current block flush time (us)|数据块平均刷盘耗时|----|DISK WRITE TIME / BUFFER BLOCKS WRITES,  
,```
select value into b_disk_write_time FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 3;
    select value into e_disk_write_time FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 3;
    r_disk_write_time := e_disk_write_time - b_disk_write_time;

    select value into b_buffer_blocks_writes FROM SYS.wrh$_sysstat WHERE snap_id=l_bid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 132;
    select value into e_buffer_blocks_writes FROM SYS.wrh$_sysstat WHERE snap_id=l_eid AND dbid = l_dbid AND instance_number = l_inst_num AND stat_id = 132;
    r_buffer_blocks_writes := e_buffer_blocks_writes - b_buffer_blocks_writes;

 r_avg_gc_curr_block_flush_time := round(r_disk_write_time / r_buffer_blocks_writes);
```|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global enqueue get time (us)|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|Avg message sent queue time (us)|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|Avg message sent queue time on ksxp (us)|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|Avg message received kernel queue time (us)|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|Avg message received queue time (us)|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|Avg GCS message process time (us)|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|Avg GES message process time (us)|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|% of direct sent messages|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|% of indirect sent messages|  
|----|不支持|
|Global Cache and Enqueue Services- Messaging Statistics|% of flow controlled messages|  
|----|不支持|
|YAC stats|  
|  
|GC CURRENT BLOCK SERVED:|  
    
    
    
    
    
    
    
    
    
    
    
    
    
,   r_min_yac_stat_id     NUMBER     :  =     800  ;,   r_max_yac_stat_id     NUMBER     :  =     838  ;,  
    
,   r_stat_id     :  =     r_min_yac_stat_id  ;,   o_sumry     :  =     ''  ;,   FOR     r_stat_id     IN     r_min_yac_stat_id  ..  r_max_yac_stat_id     LOOP,   SELECT     VALUE     into     b_stat_value     from     SYS  .  wrh  $  _sysstat     where     snap_id  =  l_bid     AND     dbid     =     l_dbid     AND     instance_number     =     l_inst_num     AND     stat_id     =     r_stat_id  ;,   SELECT     VALUE     into     e_stat_value     from     SYS  .  wrh  $  _sysstat     where     snap_id  =  l_eid     AND     dbid     =     l_dbid     AND     instance_number     =     l_inst_num     AND     stat_id     =     r_stat_id  ;,   SELECT     NAME     into     r_stat_name     from     V  $  SYSSTAT     where     STATISTIC  #     =     r_stat_id  ;,   IF     r_stat_id     <     r_max_yac_stat_id     then,   o_sumry     :  =     o_sumry     ||     '["'     ||     to_base64  (  r_stat_name     ||     ':'  )     ||     '","'     ||     to_base64  (  e_stat_value     -     b_stat_value  )     ||     '"],'  ;,   else   ,   o_sumry     :  =     o_sumry     ||     '["'     ||     to_base64  (  r_stat_name     ||     ':'  )     ||     '","'     ||     to_base64  (  e_stat_value     -     b_stat_value  )     ||     '"]'  ;|
|  
|  
|  
|GC CURRENT BLOCK RECEIVED:||
|  
|  
|  
|GC CURRENT BLOCK RECEIVE TIME:||
|  
|  
|  
|GC CR BLOCK SERVED:||
|  
|  
|  
|GC CR BLOCK RECEIVED:||
|  
|  
|  
|GC CR BLOCK RECEIVE TIME:||
|  
|  
|  
|GC BLOCK INVALIDATES:||
|  
|  
|  
|GC LOCAL GRANTS:||
|  
|  
|  
|GC LOCAL GRANT TIME:||
|  
|  
|  
|GC REMOTE GRANTS:||
|  
|  
|  
|GC REMOTE GRANT TIME:||
|  
|  
|  
|GC LOCAL CR GRANTS:||
|  
|  
|  
|GC LOCAL CR GRANT TIME:||
|  
|  
|  
|GC REMOTE CR GRANTS:||
|  
|  
|  
|GC REMOTE CR GRANT TIME:||
|  
|  
|  
|GC LOCAL UPGRADES:||
|  
|  
|  
|GC LOCAL UPGRADE TIME:||
|  
|  
|  
|GC REMOTE UPGRADES:||
|  
|  
|  
|GC REMOTE UPGRADE TIME:||
|  
|  
|  
|GC RA BLOCK GRANTS:||
|  
|  
|  
|GC CLEAN BLOCKS:||
|  
|  
|  
|GC SKIP CLEAN BLOCKS:||
|  
|  
|  
|GC LOCAL GRANT LOCKS:||
|  
|  
|  
|GC LOCAL RELEASE LOCKS:||
|  
|  
|  
|GC REMOTE GRANT LOCKS:||
|  
|  
|  
|GC REMOTE RELEASE LOCKS:||
|  
|  
|  
|GC NOTIFY FLUSH:||
|  
|  
|  
|GC CURRENT BLOCK RETRIES:||
|  
|  
|  
|GC CR BLOCK RETRIES:||
|  
|  
|  
|GC UPGRADE RETRIES:||
|  
|  
|  
|GC CLOSE BLOCK RETRIES:||
|  
|  
|  
|GC RECYCLE BLOCK RETRIES:||
|  
|  
|  
|GC RA BLOCK RETRIES:||
|  
|  
|  
|GET REMOTE XACT STATUS:||
|  
|  
|  
|GET REMOTE XACT STATUS TIME:||
|  
|  
|  
|GET REMOTE XACT INFO:||
|  
|  
|  
|GET REMOTE XACT INFO TIME:||
|  
|  
|  
|REMOTE XACT WAITS:||
|  
|  
|  
|REMOTE XACT WAIT TIME:||


###   [4.2 AWR高级包调整](#42-awr高级包调整)  

####   [4.2.1 WRH$系统表](#421-wrh系统表)  

需要新增以下WRH$系统表保存集群指标信息。部分信息保存在已有的WRH$_SYSSTAT内。

创建快照时，将对应视图查询到的信息保存在WRH$内，生成快照时通过两个快照中统计信息的差值计算快照时间段内的统计信息。

```
create table SYS.WRH$_CLUSTER_INFO
(
    snap_id             NUMBER not null,
    dbid                NUMBER not null,
    instance_number     NUMBER not null,
    instance_nums       NUMBER
) ORGANIZATION HEAP
    partition by range (DBID, SNAP_ID)
(
    partition WRH$_CLUSTER_INFO_MXDB_MXSN values less than (MAXVALUE, MAXVALUE)  tablespace SYSAUX
)
SYSTEM 224
/

create table SYS.WRH$_CLUSTER_TASK_STAT
(
    snap_id             NUMBER not null,
    dbid                NUMBER not null,
    instance_number     NUMBER not null,
    TASK_ID             INTEGER,
    SESSION_ID          INTEGER,
    TASK_TYPE           VARCHAR(32),
    CELL_ID             INTEGER,
    PROCESS_MESSAGE_NUM BIGINT
) ORGANIZATION HEAP
    partition by range (DBID, SNAP_ID)
(
    partition WRH$_CLUSTER_TASK_STAT_MXDB_MXSN values less than (MAXVALUE, MAXVALUE)  tablespace SYSAUX
)
SYSTEM 225
/

alter table SYS.WRH$_CLUSTER_TASK_STAT
    add constraint WRH$_CLUSTER_TASK_STAT_PK primary key (DBID, SNAP_ID, INSTANCE_NUMBER, TASK_ID) using index local
/

create table SYS.WRH$_CLUSTER_MESSAGE_STAT
(
    snap_id              NUMBER not null,
    dbid                 NUMBER not null,
    instance_number      NUMBER not null,
    ID                   INTEGER,
    NAME                 VARCHAR(32),
    MESSAGE_GROUP        VARCHAR(32),
    SEND_TIMES           BIGINT,
    SEND_FAILED_TIMES    BIGINT,
    SEND_TOTAL_COSTS     BIGINT,
    SEND_AVG_COST        INTEGER,
    SEND_MAX_COST        INTEGER,
    RECV_TIMES           BIGINT,
    RECV_TOTAL_COSTS     BIGINT,
    RECV_AVG_COST        INTEGER,
    RECV_MAX_COST        INTEGER,
    WAIT_TIMES           BIGINT,
    WAIT_TOTAL_COSTS     BIGINT,
    WAIT_AVG_COST        INTEGER,
    WAIT_MAX_COST        INTEGER,
    PROCESS_TIMES        BIGINT,
    PROCESS_FAILED_TIMES BIGINT,
    PROCESS_TOTAL_COSTS  BIGINT,
    PROCESS_AVG_COST     INTEGER,
    PROCESS_MAX_COST     INTEGER
) ORGANIZATION HEAP
    partition by range (DBID, SNAP_ID)
(
    partition WRH$_CLUSTER_MESSAGE_STAT_MXDB_MXSN values less than (MAXVALUE, MAXVALUE)  tablespace SYSAUX
)
SYSTEM 226
/

alter table SYS.WRH$_CLUSTER_MESSAGE_STAT
    add constraint WRH$_CLUSTER_MESSAGE_STAT_PK primary key (DBID, SNAP_ID, INSTANCE_NUMBER, ID) using index local
/


```

####   [4.2.2 awr高级包子函数](#422-awr高级包子函数)  

新增awr高级包子函数。每个子函数负责一个子项的指标对应的json数组生成，每个指标的具体计算方式见集群指标项表格。

#####   [yac_summary](#yac-summary)  

生成YAC Summary指标项json数组。

- Number of Instances
- Number of GCS Tasks


#####   [gc_load_profile](#gc-load-profile)  

生成Global Cache Load Profile指标项json数组。

- Global Cache blocks received
- GRC/GCS/GLS messages received
- GRC/GCS/GLS messages sent
- DBWR Fusion writes


#####   [gc_efficiency_percentages](#gc-efficiency-percentages)  

生成Global Cache Efficiency Percentages指标项json数组。

- Buffer access - local cache
- Buffer access - remote cache
- Buffer access - disk


#####   [gc_and_es_workload_characteristics](#gc-and-es-workload-characteristics)  

生成Global Cache and Enqueue Services- Workload Characteristics指标项json数组。

- Avg global cache cr block receive time (us)
- Avg global cache current block receive time (us)
- Avg global cache current block flush time (us)


####   [4.2.3 awr报告呈现](#423-awr报告呈现)  

1. 通过查询v$instacne视图的parallel列确认是否在集群环境。若在集群环境，则调用新增的集群指标项子函数生成对应的json数组；若在单机环境，则跳过。
1. 前端页面呈现沿用原有AWR实现框架。


```
select parallel into p_in_yac from v$instance limit 1;

```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,1. wrh$系统表之后可能有变更，需要提前规划升级问题
1. 考虑增加v$sysstat中集群相关统计项呈现
1. 不显示多实例信息
1. GRC/GCS/GLS messages received考虑分开多个统计项。
,  
,Posted by liaofeng at 一月 11, 2024 17:31|
|---|
