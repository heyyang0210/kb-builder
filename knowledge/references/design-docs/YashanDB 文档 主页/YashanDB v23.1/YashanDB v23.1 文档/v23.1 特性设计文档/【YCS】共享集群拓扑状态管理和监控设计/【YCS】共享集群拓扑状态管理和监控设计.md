Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#1-overview%E6%A6%82%E8%BF%B0)  

ycs原本已经实现了内部资源的监控和DB的监控，但是代码本身可能实现上有些粗糙。

本设计就来详细看一看原本实现的逻辑还有可能存在的一些缺陷，给它补全。

主要是DB的无限重试拉和无限重试停，都有一定的问题。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

  [崖山集群服务ycs方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=100098993)    中的  Monitor线程和Resource monitor线程。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#3-interfaces%E6%8E%A5%E5%8F%A3)  

ycsStartInterMonitor   内部资源（网络心跳、磁盘心跳）监控启动

ycsStopInterMonitor   内部资源（网络心跳、磁盘心跳）监控停止

ycsStartResMonitor     资源（DB）监控启动

ycsStopResMonitor     资源（DB）监控停止

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. 目前resource的监控其实就只是对DB的监控
1. 本功能基于李垠的YCR：SR-13483进行开发，依赖autoStart的能力


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

不管是对内部资源的监控还是对DB的监控，都是通过内部线程来实现的。

#### 5.1.1 现有YCS monitor实现架构

1. 启动实例/资源的时候会启动监控主函数。
1. 监控主要是通过启动一个内部线程实现，内部线程绑定在resourceItem或者clustermng的结构体上，这些结构体都挂在instance上。
1. 线程实现的函数通过1000ms一次sleep的while循环来实现轮询的监控能力。


实现架构这块保持不变。

#### 5.1.2 现有YCS monitor和OM monitor实现比对

|  
|YCS monitor|OM monitor|
|---|---|---|
|实现单元|内部线程|后台进程|
|监控依据|磁盘心跳、网络心跳、状态检查|pid进程文件是否存在|
|默认守护状态|守护DB依据是target状态，如果不符合会无限会向目标状态改变|守护目标进程存活|
|拉起逻辑|每过一个固定间隔，发现状态不对立马就拉，且无限次拉|对于前一次拉起失败的话，后一次拉起会增加拉起的时间间隔。有一个有限的默认值，也可以设置成一个很大的值近似无限拉。|
|停止逻辑|每过一个固定间隔，发现状态不对立马就停，且无限次停|monitor不负责自动停|
|主动停节点时的行为|把节点的目标状态切为offline|把节点在监控名单的状态改为不监控|
|主动起节点时的行为|把节点的目标状态切为online|把节点在监控名单的状态改为监控|
|实现代码归属|自行实现|集成外部库能力（今年会自己实现一套）|


###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 5.2.1 现有内部监控流程

1. ycsTryBeatNetwork 启动网络心跳
1. ycsMonitorTryBegin 重置monitor的正在启动的状态
1. ycsMonitorChannels 检查Channel是否已经关闭
1. ycsTryBeatDisk 检查磁盘心跳
1. ycsMonitorEnd 结束，把monitor正在启动状态关闭


内部监控流程本次不变更

#### 5.2.2 现有DB监控流程

1. ycsMonitorTryBegin 重置monitor的正在启动的状态
1. 获取现有状态newStat和之前的状态oldStat。


进行对比。

**如果之前的状态为online而现有状态为offline：**

1. 二次检查是否真的是offline
1. 确认离线后，执行停止资源的回调
1. 把资源的状态设置为离线
1. 检测资源的目标状态是否为在线
1. 如果是，则再检测是否有资源的master
1. 如果有，则执行启动资源的回调


**如果之前的状态为offline而现有状态为online：**

1. 刷新现有的状态为Online
1. 检查目标状态是否为offline
1. 如果是，则执行停止资源的回调


执行monitor结束，把monitor正在启动状态关闭。

#### 5.2.3 期待的DB监控流程区别

1.自动启动流程的区别

增加一个startTimes参数记录自动起的次数，这个参数挂在ResourceItem上，初始值为0。

每进入Monitor执行一次自动起的操作的话，就把这个参数加1。

在自动起流程里增加startTimes*1s的休眠时间。这个休眠时间在stopCb之前。

这个参数在monitor检查到oldStat == YCS_STAT_ONLINE && newStat == YCS_STAT_ONLINE 时重置。

讨论：在ycsCheckReallyOffline之前，增加一个等待时间，默认值为1min，该参数可配置在yascs的ini里。参考别家的故障恢复。

2.自动停流程的区别

因为自动停流程风险较大，所以在停止且刷新target为offline的时候应该保证可以停止资源。

monitor不再承载自动停资源的能力。

同时，因为之前的停不保证成功，这种方案还需要改动停脚本，在停未成功的情况下，调用kill -9保证能稳定停成功。

#### 5.2.4 新增配置项

1.增加RESTART_TIMES参数，记录在yascs.ini，表示monitor会尝试多次启动的次数，默认值为3（不配置也可以），参数规格[0,100]，uint型，启动ycs之前写进ini生效。    
  2.增加STOP_STEP参数，记录在yascs.ini，表示monitor在多次拉起失败时，在再次尝试拉起前会增加等待的时间，默认值为30（不配置也可以），单位是秒 ，参数规格[0,600]，uint型，启动ycs之前写进ini生效。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

1.在monitor启动的状态去异常停止DB，看是否能够自动拉起。---能

2.在monitor启动的状态下去异常停止DB，且损坏一定的文件，看能否能够自动拉起。---不能，会重复多次拉，每次拉增加拉的间隔时长

  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量2（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[WXWorkLocal_16826648663967.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMTA4OTcwYzJhZjRmNTIwMTMyIiwicmVmX2lkIjoiNjczOTZiMTA3MjgyMDZlZmI5MmYwMTA5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzY5LCJleHAiOjE3ODIzNzcxNjl9.g0d4SUuVwaMKhEKjy4PfnVg2EvpEMGJJrskThrSNMdI)

 (image/png)    


## Comments:

|  [](null)  ,1、"在自动起流程里增加startTimes*1s的休眠时间 "  与  原有的休眠时间  “  COD_MSLEEP(1000);”有什么区别？ ,2、ycsCheckReallyOffline之前，是不是应该有个时间间隔，表示“当超过时间阈值，再次检测依然离线时，再去stopcb和重启”，而且这个时间间隔需要做成可配置的参数，放到yascs.ini里面，注意参数要有范围和默认值,Posted by liyin at 五月 09, 2023 11:01|
|---|
|  [](null)  ,1.offline调研。资料方面确实找不到相关的篇幅，问了甘露，答案是oracle rac确实不管自动停。,2.monitor是否自动拉起，有一个参数配置。autoStart。这个参数也控制要不要在起YCS的时候默认启动DB。目前的target状态其实也就是配置文件里这个参数，没有别的地方去变动。之后考虑把拓扑打印里的target打印去掉，加在日志里（目前没有）。,3.调研一下pid可以怎么来（如果停脚本增加用pid的Kill -9的方式）。,4.结合监控shell脚本去检测节点是否确实offline。（后期YCR会实现代入）,5.yascs.ini增加参数可配置RESTART_TIMES，默认值为5，意为monitor支持的最大的重启次数。增加参数可配置STOP_DURING，默认值为30，单位为s，意为每多增加一次重启次数，需要多等待的时间。,Posted by duyuxuan at 五月 09, 2023 18:25|
|  [](null)  ,20230531对齐内容：,结论：,1、DB异常通过"破坏DB配置文件"这种轻量级的操作去构造，不涉及业务；涉及DB业务过程中的异常暂时不支持,2、对内部资源的监控属于内部机制不可测，在故障场景时需要考虑,3、对yfs资源的监控不属于本次测试范围,4、测试规格是3节点,5、"主动停节点和主动启节点"不在本次验证范围内，不做测试,6、monitor是否启动，测试从ycs进程的角度去观测即可：ycs进程在，monitor就在；ycs进程不在，monitor也不在,遗留项：,1、对yfs的监控可以从"yfs启停后是否可以正常工作"这个角度来考虑做测试，在"ycs节点启停/yfs节点启停"相关的需求中考虑（涉及需求    [YDBRD-13472](https://jira.yasdb.com/browse/YDBRD-13472)    ）----张丽红,2、需要提供本次需求中涉及的新增配置参数的相关说明（参数名称，参数含义，参数取值范围，参数取值格式，参数默认值，参数生效方式，参数使用限制）—杜宇轩,3、ycs基础资料新增完成后，李垠需要同步给宇轩，宇轩进行该需求相关资料的新增----李垠、杜宇轩,4、新增配置参数的参数含义需要明确----杜宇轩、张丽红,Posted by zhanglihong at 五月 31, 2023 15:46|
