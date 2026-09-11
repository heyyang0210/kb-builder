Created by 王海峰, last modified by  未知用户 (liaofeng) on 一月 11, 2024

*IR链接：*    [YDBRD-20372](https://jira.yasdb.com/browse/YDBRD-20372?src=confmacro)    *-*  *集群支持AWR（增加集群AWR Statistics）*  *完成*

##   [1. 总述](#1-总述)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](#11-需求来源)  

本需求为集群产品化需求，集群AWR为定位慢SQL和数据库事件，重要的DFX手段。

###   [1.2 调研文档](#12-调研文档)  

参照ORACLE的AWR报告，实现RAC Statistics的章节。可查看附件作为参考。主要为功能体现。

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|集群指标项|从已有视图中计算得到不同指标项|是|是|----|
||AWR高级包调整|WRH$表需要调整，保存集群指标项差值；增加一个函数，用于生成集群展示指标项的JSON数组；传递给页面呈现|是|是|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|----|
||性能场景2|----|否|否|----|
|可用性|恢复场景|----|否|否|----|
|可靠性|故障场景|----|否|否|----|
|可维可测|DFX功能1|----|否|否|----|
||DFX功能2|----|否|否|----|
|安全|安全场景1|----|否|否|----|
|易用性|----|----|否|否|----|
|可修改性|----|----|否|否|----|
|兼容性|----|----|否|是|----|
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
|pastcopy||||


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）（详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

RAC是每个实例可以生成一个AWR报告，所以AWR报告上统计的是本实例看到的系统统计信息。

###   [4.1 集群指标项](#41-集群指标项)  

方案1，借用ORACLE的指标呈现，从ORACLE的指标来对应我们的，实现难度大，语义上并不统一

  


|分类|O指标|指标描述|Y指标|指标信息来源|
|:---|:---|:---|:---|:---|
|TOTAL|Number of Instances|整集群中的实例数目|----|select count(*) from gv$instance;（未判断状态）,  
|
|TOTAL|Number of LMS's|GCS后台线程数|Number of GRC/GCS/GLS Tasks|select count(*) from V$CLUSTER_TASK_STAT where TASK_TYPE = 'AXC_GCS_TASK',  
|
|TOTAL|Number of realtime LMS's|  
|----|不支持|
|Global Cache Load Profile|Global Cache blocks received|从其他实例接收的页面数量|  
|select value from v$sysstat where name = 'GC CURRENT BLOCK RECEIVED' or  'GC CR BLOCK RECEIVED';|
|Global Cache Load Profile|Global Cache blocks served|发送给其他实例的页面数量|  
|select value from v$sysstat where name = 'GC CURRENT BLOCK SERVED' or name = 'GC CR BLOCK SERVED';|
|Global Cache Load Profile|GCS/GES messages received|收到的全局页面访问/全局锁访问的消息数量|----|select sum(recv_times) from v$cluster_message_stat where message_group in ('AXC_GRC_TASK','AXC_GCS_TASK','AXC_GLS_TASK')|
|Global Cache Load Profile|GCS/GES messages sent|发送的全局页面访问/全局锁访问的消息数量|----|select sum(send_times) from v$cluster_message_stat where message_group in ('AXC_GRC_TASK','AXC_GCS_TASK','AXC_GLS_TASK )|
|Global Cache Load Profile|DBWR Fusion writes|融合写入次数|----|select value from v$sysstat where name = 'DBWR PC OWNER WRITES'|
|Global Cache Efficiency Percentages|Buffer access - local cache %|percentage of blocks satisfied from local cache to the total number of blocks requested by sessions. It is desirable to maintain this ratio as high as possible because this is the least expensive and fastest way to get the database block.|----|（总读取次数 - remote cache - disk）/ 总读取次数，参考 Buffer access - remote cache %、Buffer access - disk %|
|Global Cache Efficiency Percentages|Buffer access - remote cache %|percentage of blocks satisfied from remote instance cache to the total number of blocks requested by sessions. The sum of this ratio and Buffer access - local cache % described above should be maintained as high as possible because these two paths of accessing DB blocks are fastest and least expensive to the system. Getting block from the cache of remote instance is about 10 times faster than reading it from the disk.|----|v$sysstat.BUFFER GETS 代表访问页面缓存的次数，v$sysstat.GC CURRENT BLOCK RECEIVED GC CR BLOCK RECEIVED代表远端发过来页面的次数|
|Global Cache Efficiency Percentages|Buffer access - disk %|percentage of blocks read from disk into the cache to the total number of blocks requested by sessions. It is desirable to maintain this ratio low because physical reads is the slowest way to access database blocks.|----|v$sysstat.BUFFER GETS 代表访问页面缓存的次数，GC LOCAL GRANTS代表本地授权读盘次数， GC REMOTE GRANTS代表远端授权读盘次数，（本地授权读盘次数 + 远端授权读盘次数）/ 页面缓存访问总次数|
|Global Cache Efficiency Percentages|Global Cache Locality %|  
|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache cr block receive time (us)|从缓存中获取CR页面的平均耗时|805 GC CR BLOCK RECEIVE TIME|(v$sysstat.GC CR BLOCK RECEIVE TIME + v$sysstat.GC LOCAL CR GRANT TIME +v$sysstat.GC REMOTE CR GRANT TIME) / (GC CR BLOCK RECEIVED + GC LOCAL CR GRANTS + GC REMOTE CR GRANTS),  
|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache current block receive time (us)|从缓存中获取最新页面的平均耗时|802 GC CURRENT BLOCK RECEIVE TIME|GC CURRENT BLOCK RECEIVE TIME / GC CURRENT BLOCK RECEIVED|
|Global Cache and Enqueue Services- Workload Characteristics|Avg LMS process busy %|  
|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache cr block build time (us)|CGS获取CR页面时的CR页面构建时间|812 GC LOCAL CR GRANT TIME|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Global cache log flushes for cr blocks served %|发送CR页面时需要触发log flush的百分比|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache cr block flush time (us)|CR页面请求处理时flush redo的平均时间|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache current block pin time (us)|最新页面获取请求处理时的本地锁获取耗时|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Global cache log flushes for current blocks served %|发送最新页面时触发log flush的百分比|----|不支持|
|Global Cache and Enqueue Services- Workload Characteristics|Avg global cache current block flush time (us)|数据块平均刷盘耗时|----|DISK WRITE TIME / BUFFER BLOCKS WRITES,  
|
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


方案2，按我们实现分类罗列指标项

|分类|指标|指标描述|备注|
|---|---|---|---|
|GC CURRENT BLOCK|800 GC CURRENT BLOCK SERVED|发送给其他实例current block的数量||
|GC CURRENT BLOCK|801 GC CURRENT BLOCK RECEIVED|接收来自其他实例current block的数量||
|GC CURRENT BLOCK|802 GC CURRENT BLOCK RECEIVE TIME|从其他实例接收current block的耗时||
|GC CURRENT BLOCK|827 GC CURRENT BLOCK RETRIES|本实例请求current block的重试次数||
|GC CR BLOCK|803 GC CR BLOCK SERVED|发送给其他实例CR block的数量||
|GC CR BLOCK|804 GC CR BLOCK RECEIVED|从其他实例接收CR block的数量||
|GC CR BLOCK|805 GC CR BLOCK RECEIVE TIME|从其他实例接收CR block的耗时||
|GC CR BLOCK|828 GC CR BLOCK RETRIES|从其他实例请求CR block的重试次数||
||806 GC BLOCK INVALIDATES|失效block的次数|当进行锁升级，或请求X锁时，如果有其他多个实例持有block的S锁，这时候需要请求其他实例invalid block|
|GC LOCAL|807 GC LOCAL GRANTS|本实例授权加载页面的次数||
|GC LOCAL|808 GC LOCAL GRANT TIME|本实例授权加载页面的耗时||
|GC LOCAL|811 GC LOCAL CR GRANTS|本实例CR请求授权加载页面的次数||
|GC LOCAL|812 GC LOCAL CR GRANT TIME|本实例CR请求授权加载页面的耗时||
|GC LOCAL|815 GC LOCAL UPGRADES|本实例升级页面锁的次数||
|GC LOCAL|816 GC LOCAL UPGRADE TIME|本实例升级页面锁的耗时||
|GC LOCAL|822 GC LOCAL GRANT LOCKS|本实例授权lock的次数||
|GC LOCAL|823 GC LOCAL RELEASE LOCKS|本地释放lock的次数||
|GC REMOTE|809 GC REMOTE GRANTS|远程授权加载页面的次数||
|GC REMOTE|810 GC REMOTE GRANT TIME|远程授权加载页面的耗时||
|GC REMOTE|813 GC REMOTE CR GRANTS|远程CR请求授权加载页面的次数||
|GC REMOTE|814 GC REMOTE CR GRANT TIME|远程CR请求授权加载页面的耗时||
|GC REMOTE|817 GC REMOTE UPGRADES|远程升级页面锁的次数||
|GC REMOTE|818 GC REMOTE UPGRADE TIME|远程升级页面锁的耗时||
|GC REMOTE|824 GC REMOTE GRANT LOCKS|远程授权lock的次数||
|GC REMOTE|825 GC REMOTE RELEASE LOCKS|远程释放lock次数||
||819 GC RA BLOCK GRANTS|页面预读次数||
||820 GC CLEAN BLOCKS|清理block的数量||
||821 GC SKIP CLEAN BLOCKS|pastcopy持有实例跳过清理block的数量||
||826 GC NOTIFY FLUSH|通知其他实例刷redo的次数||
||829 GC UPGRADE RETRIES|本实例请求页面锁升级的重试次数||
||830 GC CLOSE BLOCK RETRIES|页面获取后发送闭环消息的重试次数||
||831 GC RECYCLE BLOCK RETRIES|请求回收页面资源的重试次数||
||832 GC RA BLOCK RETRIES|本实例页面预读请求的重试次数||
|REMOTE XACT|833 GET REMOTE XACT STATUS|获取其他实例事务状态次数||
|REMOTE XACT|834 GET REMOTE XACT STATUS TIME|获取其他实例事务状态耗时||
|REMOTE XACT|835 GET REMOTE XACT INFO|获取其他实例事务信息次数||
|REMOTE XACT|836 GET REMOTE XACT INFO TIME|获取其他实例事务信息耗时||
|REMOTE XACT|837 REMOTE XACT WAITS|远端事务等待次数||
|REMOTE XACT|838 REMOTE XACT WAIT TIME|远端事务等待耗时||
||839 DISKCACHE HIT CNT|磁盘缓存命中总次数||
||840 DISKCACHE MISS CNT|磁盘缓存未命中总次数||
||841 DISKCACHE READ BYTES|磁盘缓存读取总字节数||
||842 DISKCACHE READ TIME|磁盘缓存读取总时间，单位毫秒||
||843 DISKCACHE READ CNT|磁盘缓存读取总次数||
||844 DISKCACHE WRITE BYTES|磁盘缓存写入总字节数||
||845 DISKCACHE WRITE TIME|磁盘缓存写入总时间，单位毫秒||
||846 DISKCACHE WRITE CNT|磁盘缓存写入总次数||
||847 ARCH DATA LFN|Arch Data归档清理中可清理LFN||
||848 ARCH DATA STBY MIN LFN|节点及其备机、级联备的最小Arch Data的LFN||
||849 ARCH DATA CHECK LFN|主机Arch Data中被复盖的最大LFN||


###   [4.2 AWR高级包调整](#42-awr高级包调整)  

step1.WRH$表需要调整，保存集群指标项差值；

step2.增加一个函数，用于生成集群展示指标项的JSON数组；

step3.传递给页面呈现

##   [5.未来规划](#5未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。