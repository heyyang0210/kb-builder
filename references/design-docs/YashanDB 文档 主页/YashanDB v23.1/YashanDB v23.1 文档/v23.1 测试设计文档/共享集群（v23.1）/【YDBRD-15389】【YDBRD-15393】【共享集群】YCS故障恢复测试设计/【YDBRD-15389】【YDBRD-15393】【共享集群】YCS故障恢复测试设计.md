Created by 牛亚娜, last modified on 一月 29, 2024



-   [1. 概述](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-1.概述)  
-   [2. 需求分析](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-2.需求分析)  
    -   [2.1 测试规格](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-2.1测试规格)  
-   [3. 测试设计方法 ](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-3.测试设计方法)  
-   [4. 详细测试设计  ](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-4.详细测试设计)  
    -   [4.1 针对YCS基本启停/takeover流程的测试](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-4.1针对YCS基本启停/takeover流程的测试)  
    -   [4.2 针对各种公共故障类型的测试](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-4.2针对各种公共故障类型的测试)  
    -   [4.3 针对YCS异常停止方式的测试](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-4.3针对YCS异常停止方式的测试)  
    -   [4.4 针对YCS启停带业务的串行测试](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-4.4针对YCS启停带业务的串行测试)  
    -   [4.5 针对YCS启停的并发测试](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-4.5针对YCS启停的并发测试)  
-   [5. 测试用例](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-5.测试用例)  
-   [6. 测试框架设计](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-【YDBRD15389】【YDBRD15393】【共享集群】YCS故障恢复测试设计-7.测试环境说明)  




# **1. 概述**

本文描述YCS故障恢复测试设计

SR:

  [YDBRD-15389](https://jira.yasdb.com/browse/YDBRD-15389?src=confmacro)    -  【共享集群】故障恢复——启动停止流程  完成

  [YDBRD-15393](https://jira.yasdb.com/browse/YDBRD-15393?src=confmacro)    -  【共享集群】故障恢复——异常处理流程  完成

开发设计文档：    [YCS可靠性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688)  

# **2. 需求分析**

本SR主要涉及共享集群软件中集群管理模块YASCS系统可靠性的测试

系统异常： 1. 资源异常 2. 网络异常 3. 服务器异常

根据系统异常而触发YASCS软件整体的异常流程处理。

参考文献：[YASDB故障模式库-共享集群]       [https://conf.yasdb.com/pages/viewpage.action?pageId=104221906](https://conf.yasdb.com/pages/viewpage.action?pageId=104221906)  

### 2.1 测试规格

- 部署形态：集群
- 部署环境：多主机磁阵环境
- 节点个数：2节点


# **3. 测试**  **设计方法**   

主要采用场景法和错误推测法

# 4.   **详细测试设计**   

### 4.1 针对YCS基本启停/takeover流程的测试

这部分主要是针对YCS基本启停流程，takeover流程的各个分支构造故障点，构造方式为  开发提供的FaultPoint接口。

|  
|流程|故障点|故障描述|Faultpoint|预期|测试结果|备注|
|---|---|---|---|---|---|---|---|
|1|启动流程|  
|  
|  
|  
|  
|  
|
|2|  
|校验配置参数错误|启动过程中，使用  faultPoint注入校验配置参数值出错|黑盒测试|启动报错，无core|启动报错，无core|之前测过，进行查漏补缺|
|3|  
|加载配置文件信息|启动过程中，使用faultPoint注入  读取文件出错,比如：文件权限问题，文件路径问题|黑盒测试|启动报错，无core|启动报错，无core|  
|
|4|  
|初始化YCSInstance时，分配内存失败|启动过程中，使用  faultPoint注入初始化YCSInstance分配内存失败|YCS_FAULT_POINT_6|启动失败，报错退出  ，无core|启动报错，无core|  
|
|5|  
|初始化信号时，系统调用失败|启动过程中，使用  faultPoint注入系统调用失败的故障|YCS_FAULT_POINT_7|启动失败，报错退出  ，无core|启动报错，无core|  
|
|6|  
|初始化线程管理模块，分配内存失败|启动过程中，使用  faultPoint注入分配内存失败的故障|YCS_FAULT_POINT_8|启动失败，报错退出  ，无core|启动报错，无core|  
|
|7|  
|初始化黑匣子相关资源，获取文件路径失败|启动过程中，使用  faultPoint注入获取文件信息失败|YCS_FAULT_POINT_9|启动失败，报错退出  ，无core|启动报错，无core|  
|
|8|  
|初始化日志模块失败|启动过程中，使用  faultPoint注入初始化日志模块失败|YCS_FAULT_POINT_10|启动失败，报错退出  ，无core|启动报错，无core|  
|
|9|  
|初始化告警日志模块失败|启动过程中，使用  faultPoint注入初始化日志模块失败|YCS_FAULT_POINT_10|启动失败，报错退出  ，无core|启动报错，无core|  
|
|10|  
|初始化网络资源|  
|YCS_FAULT_POINT_55|启动失败，报错退出  ，无core|启动报错，无core|YCS-00101 cannot allocate 549024 bytes for ics manager of ycs.|
|11|  
|初始化YCS资源管理模块失败|启动过程中，使用  faultPoint注入分配内存失败|YCS_FAULT_POINT_11|启动失败，报错退出  ，无core|启动报错，无core|资源内存，例如YFS|
|12|  
|初始化YCS集群管理模块失败，分配内存失败|启动过程中，使用  faultPoint注入分配内存失败|YCS_FAULT_POINT_12|启动失败，报错退出  ，无core|启动报错，无core|管理topo信息等|
|13|  
|初始化YCS集群管理模块失败，磁盘异常|启动过程中，使用  faultPoint注入读取YCR盘失败|YCS_FAULT_POINT_13|启动失败，报错退出  ，无core|启动报错，无core|  
|
|14|  
|  
|启动过程中，使用  faultPoint注入读取VOTING DISK盘失败|YCS_FAULT_POINT_17|启动失败，报错退出  ，无core|启动报错，无core|  
|
|15|  
|启动YCS 定时器模块失败，创建线程失败|启动过程中，使用  faultPoint注入故障，创建timer线程异常|YCS_FAULT_POINT_14|启动失败，报错退出  ，无core|启动报错，无core|  
|
|16|  
|启动YCS ICS模块失败，bind 失败|启动过程中，使用  faultPoint注入故障，让innerUrl的端口被占用|YCS_FAULT_POINT_15|启动失败，报错退出  ，无core|启动报错，无core|  
|
|17|  
|~~启动YCS消息监听线程~~|~~启动过程中，使用~~  ~~faultPoint注入故障，创建线程失败~~|~~YCS_FAULT_POINT_20~~|~~启动失败，报错退出~~  ~~，无core~~|  
|  
|
|18|  
|启动YCS 集群管理中的定时器失败，创建线程失败|faultPoint注入故障，创建timer线程异常|YCS_FAULT_POINT_16|启动失败，报错退出  ，无core|启动报错，无core|  
|
|19|  
|~~启动YCS 集群管理模块中，启动共享磁盘失败~~|~~启动过程中，使用faultPoint注入故障，内存分配失败异常~~|~~YCS_FAULT_POINT_12~~|~~启动报错，无core~~|  
|  
|
|20|  
|启动YCS 集群管理模块中，读取CtrlBlock失败|启动过程中，使用faultPoint注入故障，读取CtrlBlock失败|YCS_FAULT_POINT_17|启动失败，报错退出  ，无core|启动报错，无core|  
|
|21|  
|启动YCS 集群管理模块中，写入CtrlBlock失败|启动过程中，使用faultPoint注入故障，写入CtrlBlock失败|YCS_FAULT_POINT_18|启动失败，报错退出  ，无core|启动报错，无core|  
|
|22|  
|启动YCS 集群管理模块中，初始化VotingDisk|启动过程中，使用faultPoint注入故障，读盘失败(先读后写)|YCS_FAULT_POINT_19|启动失败，报错退出  ，无core|启动报错，无core|  
|
|23|  
|启动YCS 集群管理模块中，启动YCS监控线程|启动过程中，使用faultPoint注入故障，创建线程失败|YCS_FAULT_POINT_20|启动失败，报错退出  ，无core|启动报错，无core|  
|
|24|  
|启动YCS 资源管理模块，启动YFS|启动过程中，使用faultPoint注入故障，加载动态库失败|YCS_FAULT_POINT_21|启动失败，报错退出  ，无core|启动报错，无core|  
|
|25|  
|启动YCS 资源管理模块，启动YFS|启动过程中，使用faultPoint注入故障，确认主节点流程中，注入网络消息收发异常（即发送接口报错）|YCS_FAULT_POINT_22|启动失败，报错退出  ，无core|启动报错，无core|  
|
|26|  
|启动YCS 资源管理模块，启动YFS监控线程|启动过程中，使用faultPoint注入故障，创建线程失败|YCS_MONITOR_FAULT_POINT_2|启动失败，报错退出  ，无core|启动报错，无core|  
|
|27|  
|启动YCS 资源管理模块，启动DB监控线程|启动过程中，使用faultPoint注入故障，创建线程失败|YCS_FAULT_POINT_23|启动失败，报错退出  ，无core|启动报错，无core|  
|
|28|初始化磁盘流程|  
|  
|  
|  
|  
|  
|
|29|  
|对CtrlBock加锁失败|faultPoint 注入故障点|YCS_FAULT_POINT_57|YCS_FAULT_POINT  _47|正常报错，无core|正常报错，无core,YAS-05724 failed to load disk, reason: failed to lock disk    
  YAS-05705 ycs throw an exception, id:1, msg:disk error.|首次初始化盘才有效|
|30|  
|将CtrlBock加载到内存失败|faultPoint 注入故障点|YCS_FAULT_POINT_17|正常报错，无core|启动失败，报错|  
|
|31|  
|释放磁盘锁失败|faultPoint 注入故障点|YCS_FAULT_POINT_57|YCS_FAULT_POINT  _48|正常报错，无core|正常报错，无core,YCS-05705 ycs throw an exception, id:2, msg:cluster separated    
  YAS-05724 failed to load disk, reason: failed to unlock disk    
  YAS-05705 ycs throw an exception, id:1, msg:disk error.|首次初始化盘才有效|
|32|  
|磁盘未正常初始化，重置投票盘与缓存信息失败|faultPoint 注入故障点|YCS_FAULT_POINT_57|YCS_FAULT_POINT_  49|正常报错，无core|正常报错，无core,YCS-05705 ycs throw an exception, id:2, msg:cluster separated    
  YAS-05724 failed to load disk, reason: failed to init voting disk    
  YAS-05705 ycs throw an exception, id:1, msg:disk error.|首次初始化盘才有效|
|33|集群重组流程|  
|  
|  
|  
|  
|  
|
|34|  
|主节点重置共享磁阵中的CtrlBlock中的topo信息失败|faultPoint 注入故障点|YCS_FAULT_POINT  _51|正常报错，无core|正常报错，无core|测试方法：,1. 先启动主节点，然后kill -19 主节点
1. 在备机的配置的faultpoint.ini文件中设置51号埋点，启动备机
|
|35|  
|备节点向主节点发起加入集群的请求失败|faultPoint 注入故障点|YCS_FAULT_POINT  _50|正常报错，无core|报错YCS-05705 ycs throw an exception, id:2, msg:cluster separated，无core;去掉埋点后加入正常|  
|
|36|YCS主备节点之间topo|  
|  
|  
|  
|  
|  
|
|37|  
|模拟YCS主备节点之间topo信息不一致|使用faultPoint 故障注入，修改备节点上的topo信息，造成主备之间的topover或者age不一致|YCS_FAULT_POINT  _52|备节点需要主动拉取主节点的topo信息或者直接重新读盘获取最新的topo信息|使用埋点后，最终两节点topo表现一致，不好观测,通过kill -19+kill -18构造|慎用，此处打点在心跳处理接口中，如果故障点一直不取消，会一直尝试从主节点获取topo信息。,不好观测，因为是心跳线程，不会打日志，也不会报错退出，我觉得这里不一定要用断点来描述，用其他外部测试手段更好测试|
|38|停止流程|  
|  
|  
|  
|  
|  
|
|39|  
|集群部署成功后，通过ycsctl命令停止主节点时hang住|  
|  
|无core，备节点心跳超时，备节点投过选举成为主节点|无core，主节点进程在，ycsctl命令会报超时错误”failed to connect ycs, reason: YCS-00413, receive shaking message timeout“;备节点升主；kill -18后主节点加入作为备|kill -19 ycs|
|40|  
|集群部署成功后，停止主节点，swithover卡住|faultPoint 注入故障点|YCS_FAULT_POINT  _53|无core|备节点topo不更新，主节点一直在线，清除埋点后，备topo更新，备节点升主|现象是备机不会立即升主，一直卡在switchover流程中，当前节点会一直是备机，直到hang超时结束，也可直接取消断点|
|41|  
|集群部署成功后，通过ycsctl命令停止备节点时hang住|  
|  
|无core，主节点给备节点发送心跳超时，抛出备节点网络异常|无core，备节点进程在，topo变为offline，ycsctl命令会报超时错误”failed to connect ycs, reason: YCS-00413, receive shaking message timeout“;kill -18后恢复正常|kill -19 ycs|
|42|  
|集群部署成功后，备节点停止时，尝试请求主节点退出集群失败|faultPoint 注入故障点|YCS_FAULT_POINT  _54|无core，停止不会报错，最多是这个消息发不出去，主节点会走其他处理流程，感知到这个节点offline|备节点停止不报错，备节点日志中出现”[errno=05706]: ycs communication timeout”|  
|
|43|takeover流程|  
|  
|  
|  
|  
|  
|
|44|  
|主节点独立运行时|faultPoint 注入读盘失败|YCS_FAULT_POINT_24|报错抛出异常，由节点触发重启节点，重启之后成为主节点无异常|YCS ELECT,disconnect event trigger|  
|
|45|  
|主节点独立运行时|faultPoint 注入写盘失败|YCS_FAULT_POINT_24|报错抛出异常，由节点触发重启节点，重启之后成为主节点无异常|YCS ELECT,disconnect event trigger|  
|
|46|  
|主节点异常，备节点takeover|faultPoint 读盘失败|YCS_FAULT_POINT_25|报错抛出异常，由节点触发重启节点，重启之后成为主节点无异常|  [YDBRD-18035](https://jira.yasdb.com/browse/YDBRD-18035?src=confmacro)    -  【集群YCS故障测试】takeover场景，非主节点注入故障”YCS_FAULT_POINT_25“后，kill -9主节点，备节点takeover后topo未更新  解决关闭|  
|
|47|  
|主节点异常，备节点takeover|faultPoint 读盘后age不一致|YCS_FAULT_POINT_26|报错抛出异常，由节点触发重启节点，重启之后成为主节点无异常|触发重启节点，重启之后成为主节点，topo无异常|  
|
|48|  
|主节点异常，备节点takeover|faultPoint tryReset失败|YCS_FAULT_POINT_27|报错抛出异常，由节点触发重启节点，重启之后成为主节点无异常|触发重启节点，重启之后成为主节点，topo无异常|  
|


### 4.2 针对各种公共故障类型的测试

这部分主要基于集群故障模式库，  覆盖故障模式库中的各种故障场景以及服务本身的一些故障。    [集群故障模式库细化 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122079694)  

|  
|故障类型|故障类子场景|备注|测试结果|重构测试结果|
|---|---|---|---|---|---|
|1|磁盘异常|集群部署成功后，修改磁盘权限构造磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|2|  
|集群部署成功后，修改磁盘路径构造磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|3|  
|启动主节点的过程中，YCR磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|4|  
|启动主节点的过程中，voting disk磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|5|  
|启动备节点的过程中，YCR磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|6|  
|启动备节点的过程中，voting disk磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|7|  
|YCR-磁盘损坏，读取数据被篡改|dd、ycsycrdump工具| ycsycrdump ycr dump, ycsycrdump ycr reset 45056, ycsycrdump ycr reset redun 45056, ycsycrdump ycr dump,启动时报错：,YCS-05724 failed to load disk, reason: failed to read ycr disk!    
  YAS-05720 checksum error, disk damage.|工具部分测了|
|8|  
|VotingDisk-磁盘损坏，读取数据被篡改|dd、ycsycrdump工具|ycsycrdump ycs dump    
  ycsycrdump ycs reset 12288    
  ycsycrdump ycs reset redun 12288    
  ycsycrdump ycs dump,ycsctl start ycs &报错：    
  YCS-05705 ycs throw an exception, id:2, msg:cluster separated    
  YAS-05705 ycs throw an exception, id:1, msg:disk error    
  YAS-05720 checksum error, disk damage|工具部分测了|
|9|  
|运行过程中，YCR-磁盘损坏，YCS无法读取磁盘信息|YCR工具ycsctl show config命令测试会覆盖|  
|  
|
|10|  
|运行过程中，VotingDisk-磁盘损坏，YCS无法读取磁盘信息|建议故障点测试；4.1已覆盖；takeover流程|  
|  
|
|11|  
|停止主节点的过程中，磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|12|  
|停止备节点的过程中，磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|13|  
|takeover的过程中，voting磁盘异常|建议故障点测试；4.1已覆盖|  
|  
|
|14|网络异常|集群部署成功后，主节点网卡故障，YCS-YCS心跳超时|ifconfig ens192 down;sleep 120;ifconfig ens192 up|备节点日志：YAS-05705 ycs throw an exception, id:2, msg:cluster separated    
  备节点ycsctl status，报错：failed to connect ycs, reason: YCS-00413, receive shaking message timeout    
  网卡恢复后，实例状态正常|sudo ifconfig ens192 down;sleep 120;sudo ifconfig ens192 up,备节点日志：YCS INSTANCE] trigger expected: Ycs Channel Open|
|15|  
|集群部署成功后，备节点网卡故障，YCS-YCS心跳超时|ifconfig enp1s0 down;sleep 120;ifconfig enp1s0 up|主节点日志：2023-08-15 11:51:51.859 350650 [DEBUG] [YCS] channel 1 is Abnormal [ycs_inter.c:139]    
  2023-08-15 11:51:51.860 350650 [INFO] [YCS ELECT] run as standalone begin. [ycs_elect.c:9]    
  2023-08-15 11:51:51.860 350650 [DEBUG] [YCS ELECT] begin to run as standalone. [ycs_elect.c:21],备节点日志：2023-08-15 11:51:49.028 317512 [DEBUG][errno=05705]: ycs throw an exception, id:2, msg:cluster separated [ycs_elect.c:87]    
  2023-08-15 11:51:49.029 317512 [ERROR][errno=-0001]: [YCS ELECT] take over failed, failed to try reset, master:0, age:64 [ycs_elect.c:89]    
  2023-08-15 11:51:49.030 317512 [ERROR][errno=-0001]: [YCS INSTANCE] trigger expected: Ycs Cluster Separated [ycs_instance.c:46],网卡恢复后，topo在线正常|备节点下线,网卡恢复后，topo在线正常|
|16|  
|集群部署成功后，主节点网卡故障，制造YCS client-YCS连接超时|UDS连接，网卡无法制造故障，删除yascs.ipc，制造连接失败|客户端不可用，无法输入命令，进程在；恢复后，客户端命令行可用|客户端不可用，无法输入命令，进程在；恢复后，客户端命令行可用|
|17|  
|集群部署成功后，备节点网卡故障，制造YCS client-YCS连接超时|UDS连接，网卡无法制造故障，删除yascs.ipc，制造连接失败|客户端不可用，无法输入命令，进程在；恢复后，客户端命令行可用|客户端不可用，无法输入命令，进程在；恢复后，客户端命令行可用|
|18|  
|集群部署成功后，YCS-DB实例心跳超时|YCS_FAULT_POINT_56|日志打印yasdb at 100% heartbeat fatal, exception handle after retry monitor；按照预想是DB会被abort，然后重新拉起，但是目前没有，属于策略问题，有另外一个类似场景的单    [YDBRD-18434](https://jira.yasdb.com/browse/YDBRD-18434?src=confmacro)    -  【DB故障恢复】kill -19 挂起实例1的DB进程，30s后不退出挂起，发现实例1的DB进程未被剔除重拉  解决关闭|kill -19 挂住DB，kill -18恢复|
|19|  
|集群部署成功后，实例通信网络闪断，消息处理超时|for((i=1;i<=2;i++))    
  do    
  ifdown ens192    
  sleep 60    
  ifup ens192    
  sleep 3    
  done|备节点日志：YAS-05705 ycs throw an exception, id:2, msg:cluster separated,备节点ycsctl status报错：failed to connect ycs, reason: YCS-00413, receive shaking message timeout,网络恢复正常后，ycsctl status正常|[errno=05705]: ycs throw an exception, id:2, msg:cluster separated [ycs_cluster.c:1122],备节点被fence,恢复后正常,  
|
|20|  
|集群部署成功后，主节点上构造网络延迟|# 对整个网卡 enp1s0做40秒延迟，排除 22口    
   ./blade create network delay --time 40000 --interface enp1s0 --exclude-port 22|主节点：[YCS ELECT] run as standalone success, master:1. [ycs_elect.c:55],备节点：[errno=05705]: ycs throw an exception, id:2, msg:cluster separated [ycs_elect.c:87]    
   [ERROR][errno=-0001]: [YCS ELECT] take over failed, failed to try reset, master:1, age:68 [ycs_elect.c:89],topo正常变化，备节点下线,主节点故障恢复后，备节点重启加入集群，状态正常|topo正常变化，备节点下线,主节点故障恢复后，备节点重启加入集群，状态正常|
|21|  
|集群部署成功后，备节点上构造网络延迟|# 对整个网卡 ens192 做40秒延迟，排除 22口    
   ./blade create network delay --time 40000 --interface ens192 --exclude-port 22|备节点日志：YAS-05705 ycs throw an exception, id:2, msg:cluster separated,备节点ycsctl status报错：failed to connect ycs, reason: YCS-00413, receive shaking message timeout,主节点日志：[YCS ELECT] run as standalone success, master:0.,备节点网络恢复后，ycsctl status正常，两节点状态正常|备节点网络恢复后，ycsctl status正常，两节点状态正常,  
,DB起来有点慢，日志中有ERROR|
|22|  
|集群部署成功后，主节点上构造网络丢包|./blade create network loss --interface ens192 --percent 50|blade: 丢包率50%：命令行输入比较卡，topo状态正常|./blade create network loss --interface enp1s0- -percent 50,命令行输入比较卡，topo状态正常|
|23|  
|集群部署成功后，备节点上构造网络丢包|丢包率高了以后，底下ics心跳发生断链"disconnect event trigger",两端网络断开之后，主节点会尝试独立运行，它认为备机挂了，所以他会在自身上改备机状态，备机呢连不上主机了，它自己会做takeover，读盘的时候发现主节点还在，他就会重启，重启需要加入集群，但是呢因为网络不通，加入不了，它又尝试成为主节点，通过磁盘心跳发现还是有主节点，备机应该就会一直重复这个动作，所以你看到的备机进程还在，其实是在内部一直尝试加入主机|blade: 丢包率60%：命令行输入比较卡，仍然可以查询状态，但是命令比较卡，最开始备YCS状态都没变化；到一定时间后，备节点走重启加入集群流程，状态会有短暂的offline，接着online   主节点上备状态没更新    [YDBRD-18326](https://jira.yasdb.com/browse/YDBRD-18326?src=confmacro)    -  【YCS网络故障】集群部署后，备节点chaosblade模拟丢包率达到60%，备节点走重启流程后，主节点未更新备节点的topo状态  解决关闭,  
,  
|100%丢包 iofence测了,这里60%丢包，topo正常，就是命令行比较卡|
|24|  
|主节点启动成功后，启动备节点的过程中，  实例通信网络闪断，超时时间内不恢复|单向网络闪断有问题，优先级放低，优先测试双向|备节点日志打印：,[DEBUG][errno=00406]: connection is closed [ani_tcp.c:835]    
  [DEBUG] [ICS] ics receive loop for link 0_1_0 stopping [ics_pool.c:400]    
  [DEBUG] [ICS] ics service loop for link ICS_SEND0_1_0 end [ics_pool.c:462]|for((i=1;i<=50;i++))    
  do    
  ifdown ens192    
  sleep 3    
  ifup ens192    
  done,闪断过程中备YCS topo oneline，闪断结束后DB起,Starting instance open    
  receive shaking message timeout    
  Failed to start instance    
  Starting instance open    
  receive shaking message timeout    
  Failed to start instance    
  ycsctStarting instance open    
  Instance started|
|25|  
|主节点启动成功后，启动备节点的过程中，  实例通信网络闪断，超时时间内恢复|单向网络闪断有问题，优先级放低，优先测试双向,for((i=1;i<=10;i++))    
  do    
  ifdown ens192    
  sleep 3    
  ifup ens192    
  done|1、主备都在线的时候，闪断恢复后主备都在线，日志中有ICS打印,闪断有ICS日志打印[errno=00406]: connection is closed [ani_tcp.c:835]    
  2023-08-16 11:01:06.840 4974 [DEBUG] [ICS] ics receive loop for link 0_2_0 stopping [ics_pool.c:400]    
  2023-08-16 11:01:06.840 4974 [DEBUG] [ICS] ics service loop for link ICS_RECV0_2_0 end [ics_pool.c:462]    
  2023-08-16 11:01:06.886 4979 [DEBUG][errno=00406]: connection is closed [ani_tcp.c:835],2、起备的同时，制造闪断，闪断恢复后，备未启动成功不在线。|主备都在线的时候，闪断恢复后主备都在线，日志中有ICS打印,起备的同时，制造闪断并恢复，闪断过程中备YCS topo online，闪断结束后DB起|
|26|  
|主节点启动成功后，启动备节点的过程中，主  节点网卡故障|ifconfig enp1s0 down;sleep 120;ifconfig enp1s0 up|备节点执行ycsctl status时：,[ERROR][errno=-0001]: [YCSC] doConnect failed, ycs url is UDS//data/xfb/cluster_home/YASCS_HOME2//instance/yascs.ipc    
  failed to connect ycs, reason: YCS-00413, receive shaking message timeout,日志中： [CM] master 0 is isActive [ycs_cluster.c:370],[CM] failed to try join: connect to server timeout,网卡恢复后，  备节点进程在（应该stop掉，stop挂住了    [YDBRD-18300](https://jira.yasdb.com/browse/YDBRD-18300?src=confmacro)    -  【YCS网路故障】主节点启动后，备节点启动过程中，制造主节点网卡故障并恢复后，备节点YCS进程还在，卡在stop流程中  解决关闭  ），但是YCS不可用  ；主节点topo显示备节点offline.|备节点日志,[YCS CM] failed to start cluster: failed to join ycs, reason: YCS joining master timeout,恢复后，topo正常，备节点启动|
|27|  
|主节点启动成功后，启动备节点的过程中，备  节点网卡故障|ifconfig ens192 down;sleep 60;ifconfig ens192 up|主节点正常，备节点启动失败，日志输出：,[DEBUG][errno=05702]: failed to join ycs, reason: form cluster timeout, master:1, self:0|2023-11-23 17:14:13.393 31882 [WARN][errno=00422]: [YCS CM] failed to joining master: send message to node 0 with link level 1 timeout 3000ms, try reconnect timeout|
|28|  
|主节点启动成功后，启动备节点的过程中，主备节点网卡都故障|ifconfig ens192 down;sleep 120;ifconfig ens192 up,  
|备节点：,YAS-00402 failed to connect socket, errno 101, error message "Network is unreachable". [ycs_cluster.c:581]    
   [DEBUG][errno=05705]: ycs throw an exception, id:2, msg:cluster separated [ycs_cluster.c:582],网卡恢复后，备节点启动失败，没进程，主节点正常运行。|网卡恢复后，主备都在线|
|29|  
|集群部署成功后，主节点停止，备节点升主的过程中，主节点  网卡故障|ifconfig ens192 down;sleep 60;ifconfig ens192 up|主节点停止成功，备节点升主|偶现问题，恢复后TOPO异常    [YDBRD-23367](https://jira.yasdb.com/browse/YDBRD-23367?src=confmacro)    -  【YCS重构测试--2节点故障】ycsctl start ycs & 启动备节点的时候，reboot主节点，发现备节点的DB未被拉起  解决关闭|
|30|  
|集群部署成功后，主节点停止，备节点升主的过程中，备  节点网卡故障|ifconfig ens192 down;sleep 60;ifconfig ens192 up|主节点停止成功,网络恢复后，备节点升主|主节点停止成功,网络恢复后，备节点升主,此过程中备节点会重启（需要新包测试）|
|31|  
|多实例之间时间不同步，同步SCN互相影响。-YCS层面|时钟修改相关命令（向前/向后都修改）；YCS心跳不会受影响|启动前，主节点始终超前9分钟：YCS无影响；运行中，主节点超前20分钟，无影响， stop也无影响。,启动前，备节点推迟20分钟，启动无影响；运行过程中，备节点推迟20分钟：YCS无影响。停止前，调整始终备节点推迟20分钟：YCS无影响。|无影响|
|32|服务器异常|主节点加入的过程中，主节点服务器掉电|  
|无core|  
|
|33|  
|备节点加入的过程中，备节点服务器掉电|  
|topo正常，无core|  
|
|34|  
|备节点加入的过程中，主节点服务器掉电|  
|备起成功为主|  
|
|35|  
|主节点加入的过程中，主节点服务器掉电后重启|  
|重启成功|  
|
|36|  
|备节点加入的过程中，备节点服务器掉电后重启|  
|重启后，加入成功|  
|
|37|  
|备节点加入的过程中，主节点服务器掉电后重启|  
|主加入成功为备|  
|
|38|  
|集群部署成功后，主节点停止，备节点升主的过程中，主节点服务器掉电后重启|  
|备节点升主，重启后，原主节点加入成功|  
|
|39|  
|集群部署成功后，主节点停止，备节点升主的过程中，备节点服务器掉电后重启|  
|主节点停止成功，重启后，节点启动成功|  
|
|40|  
|集群部署成功，主节点不带DB，reboot，备节点感知超时|  
|备节点升主，topo正常，takeover，日志打印,[errno=05705]: ycs throw an exception, id:0, msg:inter channel closed [ycs_ics.c:90]|  
|
|41|  
|集群部署成功，备节点不带DB，reboot，主节点感知超时|  
|主节点查询topo正常，主独立运行，日志打印,[errno=05705]: ycs throw an exception, id:0, msg:inter channel closed|  
|
|42|  
|集群部署成功，主节点不带DB，reboot，备节点感知超时，启动主节点ycs|  
|备节点升主，主节点再次加入成功|  
|
|43|  
|集群部署成功，备节点不带DB，reboot，主节点感知超时，启动备节点ycs|  
|备节点加入成功|  
|
|44|资源异常|内存满的前提下，  启动主节点|建议故障点测试；4.1已覆盖|  
|  
|
|45|  
|内存满的前提下，  启动备节点|建议故障点测试；4.1已覆盖|  
|  
|
|46|  
|启动主节点的过程中内存满|建议故障点测试；4.1已覆盖|  
|  
|
|47|  
|启动备节点的过程中内存满|建议故障点测试；4.1已覆盖|  
|  
|
|48|  
|CPU满  的前提下，  启动主节点|  
|root用户占用95%，非root正常启动ycs，无core; root用户占用100%，非root正常启动ycs，无core|无core|
|49|  
|CPU满  的前提下，  启动备节点|  
|相同用户占用100%，正常启动ycs，无core|无core|
|50|  
|集群运行过程中，CPU满，下发YCS请求|  
|下发YCS业务正常，无core|无core|
|51|  
|启动时，多节点配置文件中YCR_DISK、VOTING_DISK不一致|  
|YCS检测不到，参数设置不同时YCS可以启动成功，互为独立的集群|备节点会报找不到hostname在盘里,YCS-05716 hostname YAS2 not found in ycr.|
|52|组件异常|YCS主-YFS主进程故障退出，当前节点DB立即abort|  
|DB进程随后退出，无core|DB进程随后退出，无core|
|53|  
|YCS备-YFS备进程故障退出，当前节点DB立即abort|  
|DB进程随后退出，无core|DB进程随后退出，无core|
|54|其他|gdb attach进程号生成core后不重启|  
|detach后YCS进程未退出|生成core后未重启|


### 4.3 针对YCS异常停止方式的测试

这部分主要是纯操作类型的测试，覆盖YCS异常停止方式为kill -19(再kill -18)，kill -9，kill -15

|  
|场景|预期|测试结果|备注|
|---|---|---|---|---|
|1|集群部署成功后，kill -19 主/备节点，再 kill -18 |表现正常，无core|kill -19后，进程在，节点offline，ycsctl服务无法提供， kill -18恢复|  
|
|2|~~集群带DB部署成功后，kill -19 主/备节点，再 kill -18 ~~|  
|kill -19后，YCS和DB进程都在，对点DB重启；kill -18之后，对点又启动DB，然后topo不一致了| 已确认，不支持带DB|
|3|集群部署成功后，kill -9 主/备节点|表现正常，无core|表现正常，无core，topo表现正常|  
|
|4|集群部署成功后，kill -15 主/备节点|表现正常，无core|无core 停止成功|  
|
|5|集群部署成功后，kill -9 主/备节点，再拉起节点|表现正常，无core，再次拉起节点成功|无core，停止成功，再次拉起节点成功|  
|
|6|集群部署成功后，kill -15 主/备节点，再拉起节点|表现正常，无core，再次拉起节点成功|无core，停止成功，再次拉起节点成功|  
|
|7|集群部署成功后，以不同方式并发kill两节点(kill -19 , kill -9)|表现正常，无core|kill -9的节点停止成功，kill -19的节点挂起，再kill -18恢复，topo正常|  
|
|8|集群部署成功后，以不同方式并发kill两节点(kill -19 , kill -15)|表现正常，无core|kill -15的节点停止成功，kill -19的节点挂起，再kill -18恢复，topo正常|  
|
|9|集群部署成功后，以不同方式并发kill两节点(kill -9 , kill -15)|表现正常，无core|无core，停止成功|  
|


### 4.4 针对YCS启停带业务的串行测试

这部分主要针对YCS启停前后带基本业务进行测试，YCS停止方式为kill -9（kill的节点是不带DB的），下发的业务包括数据库相关业务和YFS相关业务

|  
|测试点分类|测试场景|预期|测试结果|
|---|---|---|---|---|
|1|启停前后带数据库业务|  
|  
|  
|
|2|  
|集群正常运行后，kill YCS主节点，备节点DB下发数据库相关业务，再次拉起原主节点，继续下发业务|无core，拉起节点成功，下发业务正常|符合预期|
|3|  
|集群正常运行后，kill YCS主节点，备节点DB下发数据库相关业务，再次拉起原主节点，继续下发业务；再kill原备节点，剩余节点继续下发业务，再次拉起原备节点，继续下发业务|无core，拉起节点成功，下发业务正常|符合预期|
|4|  
|集群正常运行后，kill YCS主节点，备节点DB下发数据库相关业务，再次拉起原主节点，继续下发业务；再kill原主节点，剩余节点继续下发业务，再次拉起原主节点，继续下发业务|无core，拉起节点成功，下发业务正常|符合预期|
|5|  
|集群正常运行后，kill YCS备节点，主节点DB下发数据库相关业务，再次拉起原备节点，继续下发业务|无core，拉起节点成功，下发业务正常|符合预期|
|6|  
|集群正常运行后，kill YCS备节点，主节点DB下发数据库相关业务，再次拉起原备节点，继续下发业务；再kill原备节点，剩余节点继续下发业务，再次拉起原备节点，继续下发业务|无core，拉起节点成功，下发业务正常|符合预期|
|7|  
|集群正常运行后，kill YCS备节点，主节点DB下发数据库相关业务，再次拉起原备节点，继续下发业务；再kill原主节点，剩余节点继续下发业务，再次拉起原主节点，继续下发业务|无core，拉起节点成功，下发业务正常|符合预期|
|8|启停前后带YFS业务|  
|  
|  
|
|9|  
|集群正常运行后，kill YCS主节点，备节点下发YFS相关业务，再次拉起原主节点，继续下发业务|无core，拉起节点成功，下发业务正常|无core，拉起成功，业务正常|
|10|  
|集群正常运行后，kill YCS主节点，备节点下发YFS相关业务，再次拉起原主节点，继续下发业务；再kill原备节点，剩余节点继续下发业务，再次拉起原备节点，继续下发业务|无core，拉起节点成功，下发业务正常|无core，拉起成功，业务正常|
|11|  
|集群正常运行后，kill YCS主节点，备节点下发YFS相关业务，再次拉起原主节点，继续下发业务；再kill原主节点，剩余节点继续下发业务，再次拉起原主节点，继续下发业务|无core，拉起节点成功，下发业务正常|无core，拉起成功，业务正常|
|12|  
|集群正常运行后，kill YCS备节点，主节点下发YFS相关业务，再次拉起原备节点，继续下发业务|无core，拉起节点成功，下发业务正常|无core，拉起成功，业务正常|
|13|  
|集群正常运行后，kill YCS备节点，主节点下发YFS相关业务，再次拉起原备节点，继续下发业务；再kill原备节点，剩余节点继续下发业务，再次拉起原备节点，继续下发业务|无core，拉起节点成功，下发业务正常|无core，拉起成功，业务正常|
|14|  
|集群正常运行后，kill YCS备节点，主节点下发YFS相关业务，再次拉起原备节点，继续下发业务；再kill原主节点，剩余节点继续下发业务，再次拉起原主节点，继续下发业务|无core，拉起节点成功，下发业务正常|状态不一致    [YDBRD-18156](https://jira.yasdb.com/browse/YDBRD-18156?src=confmacro)    -  【YCS故障测试】主备节点kill ycs前后，执行YFS业务，多次交叉操作之后，ycsctl status两节点显示信息不一致  解决关闭|


### 4.5 针对YCS启停的并发测试

这部分主要测试两大类场景：

1、纯并发停止YCS节点，YCS停止方式为kill -9

2、停止YCS节点的过程中，其他节点同时下发业务，YCS停止方式为kill -9，下发的业务包括数据库相关业务和YFS相关业务

|  
|测试点分类|测试场景|预期|测试结果|备注|
|---|---|---|---|---|---|
|1|不带业务并发|  
|  
|  
|  
|
|2|  
|集群正常运行后，同时kill两节点|无core|无core|主，备节点只启动YCS|
|3|  
|集群正常运行后，同时kill两节点，然后再依次拉起不带DB|无core，再次拉起成功|无core，拉起成功|主，备节点只启动YCS|
|4|  
|集群正常运行后，同时kill两节点，然后再依次拉起带DB，下发业务|无core，下发业务正常|无core，下发业务正常|主，备节点只启动YCS|
|5|  
|集群正常运行后，kill YCS主节点，然后原主节点启动和kill YCS原备节点并发|无core，原主节点启动成功，原备节点停止|符合预期|主，备节点只启动YCS|
|6|  
|集群正常运行后，kill YCS备节点，然后原备节点启动和kill YCS原主节点并发|无core，原备节点启动成功，原主节点停止|符合预期|主，备节点只启动YCS|
|7|  
|YCS主节点启动成功，kill YCS主节点的过程中启动YCS备节点|无core，主节点停止成功，备节点启动成功，变为主|符合预期|只启动一个YCS节点|
|8|  
|集群正常运行后，ycsctl停止备节点的过程中kill备节点|无core，节点停止成功|符合预期|只启动一个YCS节点|
|9|  
|启动主节点同时kill -9 YCS|无core，节点启动失败|符合预期|节点未启动|
|10|  
|集群正常运行后，ycsctl停止备节点的过程中kill主节点|无core，两节点停止成功|符合预期|主，备节点只启动YCS|
|11|  
|集群正常运行后，ycsctl停止主节点的过程中kill备节点|无core，两节点停止成功|符合预期|主，备节点只启动YCS|
|12|带业务并发（数据库业务）|  
|  
|  
|  
|
|13|  
|kill YCS主节点的过程中，备节点DB下发数据库相关业务|无core，备节点DB业务不受影响|符合预期|主节点只启动YCS，备节点启动YCS+DB|
|14|  
|kill YCS备节点的过程中，主节点DB下发数据库相关业务|无core，主节点DB业务不受影响|符合预期|备节点只启动YCS，主节点启动YCS+DB|
|15|  
|kill YCS主节点的过程中，备节点DB下发数据库相关业务，然后再次拉起原主节点带DB，继续在两节点下发业务|无core，再次拉起节点成功，在两节点下发DB业务正常|符合预期|主节点只启动YCS，备节点启动YCS+DB|
|16|  
|kill YCS备节点的过程中，主节点DB下发数据库相关业务，然后再次拉起原备节点带DB，继续在两节点下发业务|无core，再次拉起节点成功，在两节点下发DB业务正常|符合预期|备节点只启动YCS，主节点启动YCS+DB|
|17|  
|kill重启YCS主节点的过程中，备节点DB下发数据库相关业务|无core，备节点DB业务不受影响|符合预期|主节点只启动YCS，备节点启动YCS+DB|
|18|  
|kill重启YCS备节点的过程中，主节点DB下发数据库相关业务|无core，主节点DB业务不受影响|符合预期|备节点只启动YCS，主节点启动YCS+DB|
|19|带业务并发（YFS业务）|  
|  
|  
|  
|
|20|  
|kill YCS主节点的过程中，备节点下发YFS相关业务|无core，备节点YFS业务不受影响|无core，业务正常|主，备节点只启动YCS|
|21|  
|kill YCS备节点的过程中，主节点下发YFS相关业务|无core，主节点YFS业务不受影响|无core，业务正常|主，备节点只启动YCS|
|22|  
|kill YCS主节点的过程中，备节点下发YFS相关业务，然后再次拉起原主节点，继续在两节点下发业务|无core，再次拉起节点成功，在两节点下发YFS业务正常|无core，正常拉起，业务正常|主，备节点只启动YCS|
|23|  
|kill YCS备节点的过程中，主节点下发YFS相关业务，然后再次拉起原备节点，继续在两节点下发业务|无core，再次拉起节点成功，在两节点下发YFS业务正常|无core，正常拉起，业务正常|主，备节点只启动YCS|
|24|  
|kill重启YCS主节点的过程中，备节点下发YFS相关业务|无core，备节点YFS业务不受影响|无core，备节点YFS业务不受影响|主，备节点只启动YCS|
|25|  
|kill重启YCS备节点的过程中，主节点下发YFS相关业务|无core，主节点YFS业务不受影响|无core，主节点YFS业务不受影响|主，备节点只启动YCS|


# 5.   **测试用例**

[YCS故障恢复门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2U4OTcwYzJhZjRmNTFmYTliIiwicmVmX2lkIjoiNjczOTY5Y2U1OTNmOTljOWZmMjM1MzEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQ3LCJleHAiOjE3ODIyOTU0NDd9.mwhfFRHTiHvr1W3Nq1ryKIkJOGGEVeITaooK_gwq9ik)

# 6.   **测试框架设计**

  [YCS故障(Fault Point)注入功能](https://conf.yasdb.com/pages/viewpage.action?pageId=115150762)  

故障点构造参考：

  [Linux下故障注入工具ChaosBlade](https://conf.yasdb.com/pages/viewpage.action?pageId=59637504)  

  [blade create cpu load - chaosblade-help-zh-CN (gitbook.io)](https://chaosblade-io.gitbook.io/chaosblade-help-zh-cn/blade-create-cpu-load)  

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-8-8_16-34-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2VhMWFkOWEzMzExZGM3OTEyIiwicmVmX2lkIjoiNjczOTY5Y2U1OTNmOTljOWZmMjM1MzEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQ3LCJleHAiOjE3ODIyOTU0NDd9.h-PIiEsAcpp1w6WP0Ef3XB1nuVdiJhDKzjy-18fgMZE)

 (image/png)    


[YCS故障恢复门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Y2U4OTcwYzJhZjRmNTFmYTliIiwicmVmX2lkIjoiNjczOTY5Y2U1OTNmOTljOWZmMjM1MzEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MDQ3LCJleHAiOjE3ODIyOTU0NDd9.mwhfFRHTiHvr1W3Nq1ryKIkJOGGEVeITaooK_gwq9ik)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,质量加固：    [【共享集群】YCS故障恢复—启动停止流程 质量加固](https://conf.yasdb.com/pages/viewpage.action?pageId=141570318)  ,Posted by niuyana at 三月 05, 2024 09:23|
|---|
