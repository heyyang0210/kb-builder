Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

JIRA：    [YDBRD-15390](https://jira.yasdb.com/browse/YDBRD-15390?src=confmacro)    -  【共享集群】故障恢复——监控流程  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#1-overview%E6%A6%82%E8%BF%B0)  

本文档描述共享集群软件中集群管理模块YASCS系统对于监控流程这块的异常梳理与恢复

异常： 1. 资源（DB）异常 2. 网络异常 3. 磁盘异常

根据上述异常而触发YASCS软件整体的异常流程处理。

参考文献：[YASDB故障模式库-共享集群]       [https://conf.yasdb.com/pages/viewpage.action?pageId=104221906](https://conf.yasdb.com/pages/viewpage.action?pageId=104221906)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

*说明本方案的功能特性。*

通过埋点等手段模拟监控运行过程中可能遇到的异常场景以及观察集群是否能有有效手段去处理这些异常。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#3-interfaces%E6%8E%A5%E5%8F%A3)  

*列出本方案对外提供的接口、配置参数、API等。*

无新增接口

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

*说明本方案对外的功能限制或约束。*

仅针对YCS实例运行中的内部监控处理流程以及资源监控处理流程。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

  
  监控流程主要分为两块。一块是YCS实例的监控、一块是资源（DB）的监控。

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 5.2.1 资源监控

资源监控的启动：启动DB的时候默认就启动了，启动失败会直接报错。失败的原因只有启动线程的时候失败了。

资源监控的停止：void函数，不存在失败分支。

资源监控的运行过程中：1.DB异常，监控正常运行。2.DB正常，网络抖动等问题。3.前两种异常叠加

|故障分类|故障子类|故障名称|故障检测|故障定位|故障原因|故障修复|影响范围（可选）|故障预防（可选）|故障注入（测试）|是否落需求|
|---|---|---|---|---|---|---|---|---|---|---|
|监控流程|资源（DB）监控启动异常|启动监控线程的时候，线程的ThreadManager已经为空或者已经关闭或者分配不出新线程的系统内存，启动失败。|  
|  
|  
|YCS启动失败|  
|  
|codStartThread失败|是，埋点YCS_MONITOR_FAULT_POINT_2|
|  
|资源（DB）监控异常运行|内部通讯网络UDS断连，但DB仍然存在。DB不会进行重启。|  
|  
|内部通讯网络断连，误判DB掉线。|ycsCheckReallyOffline中会判断DB的进程是否存在，避免误判。|  
|  
|破坏monitorCb函数模拟|是，埋点YCS_MONITOR_FAULT_POINT_7|
|  
|资源（DB）监控异常运行|YCS节点内部通讯网络断连，但DB仍然存在。|  
|  
|YCS内部通讯网络断连|如果自己是主节点，则DB存活。如果自己不是主节点，且主节点存在，DB掉线。|  
|  
|系统层面破坏InterUrl的端口号|是|
|  
|资源（DB）监控异常运行叠加DB异常|内部通讯网络UDS断连，且DB不存在，DB会进行重启。|  
|  
|内部通讯网络断连叠加DB掉线|ycs会认为DB掉线，会重启DB， 但重启失败。|  
|  
|破坏monitorCb函数模拟|可以测，不保证结果|
|  
|资源（DB）监控异常运行叠加DB异常|YCS节点内部通讯网络断连，且DB不存在|  
|  
|内部通讯网络断连叠加DB掉线|尝试拉起但拉起失败|  
|  
|系统层面破坏InterUrl的端口号|可以测，不保证结果|
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


#### 5.2.2 YCS实例监控

YCS实例监控的启动：启动YCS的时候默认就启动了，启动失败会直接报错。失败的原因只有启动线程的时候失败了。

YCS实例监控的停止：void函数，不存在失败分支。在停实例监控前，会先设置标志位ycsMonitorSuspend让实例监控线程运行失效。

YCS实例监控的运行过程中：现在主要运行时主要做两件事。

一件是网络心跳以及抛出异常事件ycsTryBeatNetwork，这个是时刻都在运行的。但新流程里，这部分已经不放在监控里，而放在ICS里做了。这部分只负责ycsInterServiceSendTopoHeartBeat，但不保证成功。

另一件是磁盘心跳以及抛出异常事件ycsTryBeatDisk，需要加锁运行。主要分析这块可能的异常。

|故障分类|故障子类|故障名称|故障检测|故障定位|故障原因|故障修复|影响范围（可选）|故障预防（可选）|故障注入（测试）|是否落需求|
|---|---|---|---|---|---|---|---|---|---|---|
|监控流程|YCS监控启动异常|启动YCS监控线程的时候，线程的ThreadManager已经为空或者已经关闭或者分配不出新线程的系统内存，启动失败。|  
|  
|  
|YCS启动失败|  
|  
|codStartThread失败|是，埋点YCS_MONITOR_FAULT_POINT_1|
|  
|资源（DB）监控正常运行|检查投票盘时，发现读取投票盘时失败。|  
|可以查看日志，观察是否有异常处理重启cmcluster|  
|写日志。抛出异常YCSE_VOTING_DISK_ERROR。|  
|  
|diskRead失败|是，埋点YCS_MONITOR_FAULT_POINT_3|
|  
|  
|检查投票盘时，发现别的节点正在投票。|  
|可以查看日志，观察是否有异常处理ycsElectVote|  
|写日志。抛出异常YCSE_NEW_VOTING_EXPECTED。|  
|  
|埋点使得votingDisk上的对应数值发生变化。|是，埋点YCS_MONITOR_FAULT_POINT_4|
|  
|  
|发送磁盘心跳时，读取ctrlBlock失败。|  
|可以查看日志，观察是否有异常处理重启cmcluster|  
|写日志。抛出异常YCSE_VOTING_DISK_ERROR。|  
|  
|diskRead失败|是，埋点YCS_MONITOR_FAULT_POINT_5|
|  
|  
|发送磁盘心跳时，写ctrlBlock失败。|  
|可以查看日志，观察是否有异常处理重启cmcluster|  
|写日志。抛出异常YCSE_CLUSTER_SEPARATED|  
|  
|diskWrite失败|是，埋点YCS_MONITOR_FAULT_POINT_6|
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


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

*说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计*

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

###   [6.1 不带业务场景](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#61-%E4%B8%8D%E5%B8%A6%E4%B8%9A%E5%8A%A1%E5%9C%BA%E6%99%AF)  

|用例名称|用例步骤描述|期望|实际结果|备注|埋点名|
|:---|:---|:---|:---|:---|---|
|启动YCS实例监控线程时，系统内存分配失败|使用faultPoint，在启动YCS实例监控线程位置注入内存分配失败的异常，启动ycs|启动报错|  
|正常报错，无core|YCS_MONITOR_FAULT_POINT_1|
|启动资源实例监控线程时，系统内存分配失败|使用faultPoint，在启动资源监控线程位置注入内存分配失败的异常，启动ycs|启动报错|  
|正常报错，无core|YCS_MONITOR_FAULT_POINT_2|
|磁阵异常|检查投票盘时，使用faultPoint注入故障，模拟读取投票盘失败|不报错，内部抛出异常之后，重启cmcluster|  
|无core，用户层面不感知|YCS_MONITOR_FAULT_POINT_3|
|磁阵异常|检查投票盘时，使用faultPoint注入故障，模拟埋点使得votingDisk上的对应数值发生变化。|不报错，内部抛出异常之后，进行ycsElectVote|  
|无core，用户层面不感知|YCS_MONITOR_FAULT_POINT_4|
|磁阵异常|发送磁盘心跳时，使用faultPoint注入故障，读取ctrlBlock失败|不报错，内部抛出异常之后，重启cmcluster|  
|无core，用户层面不感知|YCS_MONITOR_FAULT_POINT_5|
|磁阵异常|发送磁盘心跳时，使用faultPoint注入故障，写ctrlBlock失败|不报错，内部抛出异常之后，重启cmcluster|  
|无core，用户层面不感知|YCS_MONITOR_FAULT_POINT_6|
|网络异常|系统层面注入网络故障错误，破坏InterUrl的端口号（节点之间通信）|内部通讯网络断连，如果DB是主，存活。如果DB是备，掉线。|  
|具体情况具体分析|  
|
|网络异常|使用faultPoint，注入网络故障错误，破坏monitorCb函数模拟（YCS和DB通信）|内部UDS通讯网络断连，DB不会重启|  
|用户不感知|YCS_MONITOR_FAULT_POINT_7|
|DB进程异常叠加网络异常（异常叠加场景考虑，但是不做）|使用faultPoint，注入网络故障错误，破坏monitorCb函数模拟。用命令行停止DB，或者kill -9DB，且restart_times设置不为0。|监控可以自动拉起DB，但不能启动成功，因为拿不到topo。|  
|异常叠加还是需要具体情况才能看。理论上是尝试拉，拉不起来报错退出。|  
|
|  
|注入网络故障错误，破坏InterUrl的端口号。用命令行停止DB，或者kill -9DB，且restart_times设置不为0。|监控可以自动拉起DB，但不能启动成功，因为拿不到topo。|  
|异常叠加还是需要具体情况才能看。理论上是尝试拉，拉不起来报错退出。|  
|


  


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#7-document%E8%B5%84%E6%96%99)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量2（人天）。*

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,network_timeout配置时间的时候 ，如果确定DB掉线，可以不等待，直接进入重启流程。,Posted by duyuxuan at 七月 24, 2023 16:07|
|---|
