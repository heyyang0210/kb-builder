Created by 李垠, last modified on 十一月 08, 2024

  


IR链接：    [[YDBRD-10948] 集群支持高可用指标RTO<30S，RPO=0 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-10948)     / SR链接：    [[YDBRD-15225] 【共享集群】ycs支持故障快速检测 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-15225)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

调研报告

达梦集群只有磁盘心跳，通过如下参数控制容错时间，默认值是60s，取值范围是  5~600

参数描述如下：

     DCR_GRP_DSKCHK_CNT 磁盘心跳机制，容错时间，单位秒S，缺省60S，取值范围5~600    


  


ORACLE RAC

FAILURE_INTERVAL 默认值：30s    
  The interval, in seconds, before which Oracle Clusterware stops a resource if the resource has exceeded the number of failures specified by the FAILURE_THRESHOLD attribute. If the value is zero (0), then tracking of failures is disabled.

这个间隔，单位是秒，在它之前如果失败次数已经超过了由FAILURE_THRESHOLD限定的失败次数则停止资源，如果这个值被设置位0，那么失败跟踪将被禁用。

  


FAILURE_THRESHOLD，默认值3    
  The number of failures of a resource detected within a specified FAILURE_INTERVAL for the resource before Oracle Clusterware marks the resource as unavailable and no longer monitors it. If a resource fails the specified number of times, then Oracle Clusterware stops the resource. If the value is zero (0), then tracking of failures is disabled. The maximum value is 20.

在FAILURE_INTERVAL之内，一个资源被检测到的失败次数，在资源被标记为不可用之前并且不再监控它， 如果一个资源达到了这个失败次数，那么Oracle Clusterware会停止这个资源，如果这个值设置为0，那么监控会被禁止。最大值是20。

  


11gR2版本，用misscount表示超时时间，在这个例子中，misscount的值是30s，猜测30s也是默认值：

![](https://pingcode.yasdb.com/atlas/files/public/67396b0d8970c2af4f520113/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBRUFBRUFBQVFBQUFBQUFBQ0FBUkFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2NjcsImV4cCI6MTc4MjMwMTQ2N30.bRNojkdacB0T4z4xQhCHlWtWe1TuhH1rI5K5AzMRGb4)

下面这段日志是离线表决盘日志，等待时间200s，推测200s是默认时间：

![](https://pingcode.yasdb.com/atlas/files/public/67396b0da1ad9a3311dc7f88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBRUFBRUFBQVFBQUFBQUFBQ0FBUkFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2NjcsImV4cCI6MTc4MjMwMTQ2N30.bRNojkdacB0T4z4xQhCHlWtWe1TuhH1rI5K5AzMRGb4)

，

misscount在OCR中的配置如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396b0da1ad9a3311dc7f8a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBRUFBRUFBQVFBQUFBQUFBQ0FBUkFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2NjcsImV4cCI6MTc4MjMwMTQ2N30.bRNojkdacB0T4z4xQhCHlWtWe1TuhH1rI5K5AzMRGb4)

  


21c版本默认值如下，misscount的默认值是30s

![](https://pingcode.yasdb.com/atlas/files/public/67396b0da1ad9a3311dc7f8b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBa0FBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQ0FBRUFBRUFBQVFBQUFBQUFBQ0FBUkFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUJBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2NjcsImV4cCI6MTc4MjMwMTQ2N30.bRNojkdacB0T4z4xQhCHlWtWe1TuhH1rI5K5AzMRGb4)

综上，达梦的心跳容错时间默认值是60s，ORACLE的心跳容错时间默认值是30s（10g版本是60s）

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

现状介绍

- DB与ycs的心跳


基础超时时间 YCS_CLIENT_HB_TIMEOUT 6s   

超时次数  YCS_CLIENT_TIMEOUT_TIMES 3

超过YCS_CLIENT_HB_TIMEOUT ，yfs服务会被挂起

超过 YCS_CLIENT_TIMEOUT_TIMES * YCS_CLIENT_HB_TIMEOUT（18s）  进程终止   exit(0)   DB进程终止

- ycs之间的心跳


1. 网络心跳   ~~如果发送网路心跳失败，则会抛出异常  YCSE_INTER_CHANNEL_CLOSED，触发集群投票（在投票流程中，会挂起监控，所以在这个投票期间不会走到磁盘心跳和通道心跳）~~  发送心跳失败，会重试三次，如果依然失败，则抛出异常，进入故障处理流程
1. 磁盘心跳  （只有master才会进行磁盘心跳），每隔1s进行一次磁盘心跳，发现磁盘读写错误，或者集群正在进行投票，立即抛异常
1. ~~通道检测~~


~~基础超时时间 #define YCS_NETWORK_TIMEOUT_TICKS 6000（相当于6s）~~

~~网络心跳给其他ycs发消息，其他ycs收到后向ycs master查询topo，主ycs收到这个查询后更新本地的”接收时间“，在通道检测流程中，用”当前时间“ - ”接收时间“，这个差值如果大于或者等于 YCS_NETWORK_TIMEOUT_TICKS ，便会触发YCSE_INTER_CHANNEL_CLOSED异常，这就是通道检测的主要处理流程~~

- ycs对于DB的监控


基础超时时间 #define YCS_NETWORK_TIMEOUT_TICKS 6000（相当于6s）

依赖于DB与ycs的心跳，DB向ycs查询topo，ycs向master查询topo，master接收到这个查询后，就会更新接收时间，当接收超时大于或者等于 YCS_NETWORK_TIMEOUT_TICKS ，认为DB离线

|心跳类型|挂起yfs超时时间|容错时间|分析结果|配置项名称|
|:---:|:---:|:---:|:---:|:---:|
|DB 与 ycs的心跳|YCS_CLIENT_HB_TIMEOUT 6s|YCS_CLIENT_TIMEOUT_TIMES * YCS_CLIENT_HB_TIMEOUT（18s）|容错时间修改为可配置参数|NETWORK_HB_TIMEOUT|
|网络心跳|无|无|ICS本身已经具备了网络探测能力，这里去掉超时重试以及抛出异常的处理，完全依赖ICS层的故障处理|NETWORK_HB_TIMEOUT|
|磁盘心跳——磁盘异常|无|无|这里是写磁盘心跳，出错概率低，沿用当前的处理措施，一旦发现读写磁盘失败，立即进入异常处理，不需要容错时间|无|
|磁盘心跳——投票异常|无|无|同上|无|
|~~通道心跳（监控接收通道）~~|~~无~~|~~YCS_NETWORK_TIMEOUT_TICKS 6000（相当于6s）~~|~~YCS_NETWORK_TIMEOUT_TICKS修改为可配置参数~~|~~NETWORK_HB_TIMEOUT~~|
|ycs对于DB的监控|无|YCS_NETWORK_TIMEOUT_TICKS 6000（相当于6s）|YCS_NETWORK_TIMEOUT_TICKS修改为可配置参数|NETWORK_HB_TIMEOUT|
|takeover流程中的对原master的探活|无|YCS_DISK_WAITING_INTERVAL * 5（相当于5s）|将这里的容错时间改为可配置参数，重试次数为容错时间除以YCS_DISK_WAITING_INTERVAL |DISK_HB_KEEP_ALIVE|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

不涉及

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

配置参数取值范围和默认值设计

|  
|NETWORK_HB_TIMEOUT|DISK_HB_KEEP_ALIVE|
|---|:---:|:---:|
|最小值|2s|2s|
|最大值|600s|600s|
|默认值|30s|6s|


  


一、 DB监控YCS的容错时间设计

YCS_CLIENT_HB_TIMEOUT改为可配置参数，名字为NETWORK_HB_TIMEOUT，重试次数固定为  **3**  次

  


DB ABORT的容错时间改为:  NETWORK_HB_TIMEOUT

IO阻断容错时间改为         :   ** NETWORK_HB_TIMEOUT/3**

  


二、 通道监控和YCS对DB的监控容错时间设计

这两个监控流程使用的是同一个参数NETWORK_HB_TIMEOUT

  


三、磁盘心跳容错时间设计

磁盘心跳采用DISK_HB_KEEP_ALIVE作为配置参数

  


四、 监控流程开关（开发内部调试使用，不对外提供，不需要测试）

增加一个开关，控制三个监控流程，即：网络心跳、DB监控YCS、磁盘心跳，用三位的位图表示，名字为 _  **MONITOR_SWITCH(在在yascs.ini中）**

范围：０~15

默认值：０　（打开监控）

通过ycsctl set _monitor_switch xxx 命令设置开关值，立即生效，xxx 可以的取值如下

从右向左

第0位 　　网络心跳，十进制为1

第1位 　　DB监控YCS，十进制为2

第2位　　磁盘心跳，十进制为4

第3位         YCS监控DB

对应的位设置位1，表达关闭该项功能，0表达打开该项功能

多个数位之间可以自由组合，可以实现关闭、打开多项功能

通过设置YASCS_HOME，来决定设置哪个节点的开关

  


【举个例子】

比如要 gdb 调试 node_1 的 yasdb

第一步：则首先 YASCS_HOME 设置为 node_1 的路径

export YASCS_HOME=/home/yasdb/anchor_regress/ha_regress/cluster_home/YASCS_HOME1

第二步：设置开关，关闭ycs监控db的功能

ycsctl set _monitor_switch 8

第三步：可以开始gdb yasdb了

当调试完成时，可以根据需要打开监控功能，执行如下命令

ycsctl set _monitor_switch 0

|xxx数值|ycs监控db,第3位|磁盘心跳,第2位|DB监控YCS,第1位|网络心跳,第0位|含义|对应命令|应用场景|
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
|0|0|0|0|0|打开所有监控功能（默认）|ycsctl set _monitor_switch 0|需要打开所有监控功能的场景|
|1|0|0|0|1|关闭ycs之间的topo同步|ycsctl set _monitor_switch 1|无|
|2|0|0|1|0|关闭db监控ycs，即db不会因为获取不到topo而abort|ycsctl set _monitor_switch 2|想要gdb 调试yascs时设置|
|4|0|1|0|0|ycs不写磁盘心跳，会导致该节点被提出集群|ycsctl set _monitor_switch 4|无|
|8|1|0|0|0|关闭ycs监控db，即ycs不会将db重启|ycsctl set _monitor_switch 8|想要gdb 调试yasdb时设置|


  


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

不涉及

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

一、监控开关流程

ycsResMonitorProc、ycsMonitorProc、ycscProc三个流程中，在while循环中，首先判断MONITOR_SWITCH，如果对应位置为1，则不进行监控动作

###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

不涉及

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

YCS监控DB

停止DB倒计时 YCS_NETWORK_TIMEOUT_TICKS - (ticks - item→recvTicks)  ，这里需要打印日志

  


DB监控YCS

DB abort倒计时 YCS_CLIENT_TIMEOUT_TIMES * YCS_CLIENT_HB_TIMEOUT - (codNow() - conn→lastHeartBeat)  ， 需要打印日志

阻断yfs服务倒计时  YCS_CLIENT_HB_TIMEOUT - （codNow() - conn->lastHeartBeat） ， 需要打印日志

  


网络心跳

触发通道异常倒计时 ， TRY_TIMES_LEFT * TRY_INTERVAL， 打印日志

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- 配置参数的值在有效范围以外，需要报错
- 配置参数的值等于边界值，能够生效
- 配置参数的默认值生效
- 配置参数的值在有效范围内
- 重复配置参数
- 不带DB，kill ycs ，记录容错时间是否约等于预期的值
- 不带DB，验证换主的流程，重试次数是否符合预期
- 带DB，一个节点，kill掉ycs，查看DB日志的中记录的容错时间
- 带DB，一个节点，kill掉db，查看ycs日志中记录的容错时间，同时可以观察打屏信息，计时，看是否符合预期
- 关闭所有监控开关，带DB，查看是否能够正常启停


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

以下四个参数放入资料中

doc/产品文档/运维手册/共享集群管理/配置参数.md

**NETWORK_TIMEOUT**

**DISK_TIMEOUT**

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments:

[image2023-5-15_10-20-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTA1IiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.AKd9FAUgRsu6sN4oKVi-1q2mqEC_taotlhrHZBSkMxQ)

 (image/png)    


[image2023-4-25_17-38-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTA2IiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.EqJgObBD7du-EJJSERX8aO_gNFidUFBvWFi-s4rqJQg)

 (image/png)    


[image2023-5-5_20-45-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGNhMWFkOWEzMzExZGM3ZjdkIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.KqkEgKUl09ILxKENkqTxafFXbQd2xOnfYsosYxt7syI)

 (image/png)    


[image2023-5-5_14-40-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGNhMWFkOWEzMzExZGM3ZjdlIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.RcnYMnsGmTpcjY9xrFVBB5ijxZoR4xKB79tHo-CKMsM)

 (image/png)    


[image2023-5-8_21-12-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTA3IiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.5GxSHErj5n0SGXug7BRypT1TFsF2HibJsTc6ri2KNwk)

 (image/png)    


[image2023-5-5_21-33-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTA4IiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.nP9GBqOOmuiIvOB7zE1_ypPn43UNvi11Dj5FVpSLVLI)

 (image/png)    


[image2023-5-5_21-37-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTA5IiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.COof5u0k-2M3sQSmYbIjLMtlC6NOHMZSn4_H2C1O5LQ)

 (image/png)    


[image2023-4-24_19-23-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGNhMWFkOWEzMzExZGM3ZjdmIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9._Go9Xn0H81VforatShRRHwom0GHuhjxLjnFpsawbsaU)

 (image/png)    


[image2023-5-8_21-20-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTBhIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.wtr1dEBmvkFRaioUF8s9H6VfsMYcvZDZ59Y99wOmf5Q)

 (image/png)    


[image2023-4-24_20-37-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGNhMWFkOWEzMzExZGM3ZjgwIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.TPOhnxvo9ZXJ4LAH3Gt8Y4NHb9h1-o9Dk6nAcYMNr6E)

 (image/png)    


[image2023-4-25_10-44-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGNhMWFkOWEzMzExZGM3ZjgxIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.BGRTDxqFija3HPqi5J2vrr5c7WUS3gPtNh82m270aVo)

 (image/png)    


[image2023-5-8_21-27-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTBjIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.h9WzT4qLvtE2ieF1EnULwTaifNqR-xlG8ooanb2isWI)

 (image/png)    


[image2023-4-26_11-42-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGM4OTcwYzJhZjRmNTIwMTBkIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.mqJkt_skh6NdX3JDQFdhM6oZmMD31C7iJHdbD7YRkQg)

 (image/png)    


[image2023-4-25_14-32-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGNhMWFkOWEzMzExZGM3ZjgzIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.o-9hntSoBZRtJc0FgGnqpcQ7Wig0w6z4Dkooqt1yBn4)

 (image/png)    


[image2023-4-25_14-37-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGNhMWFkOWEzMzExZGM3Zjg1IiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.z-Uk2okwTiawdDvap8WToqbxJIl689brQN_MUe0SWm4)

 (image/png)    


[image2023-6-17_18-49-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGQ4OTcwYzJhZjRmNTIwMTEyIiwicmVmX2lkIjoiNjczOTZiMGM3MjgyMDZlZmI5MmYwMGRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjY3LCJleHAiOjE3ODIzNzcwNjd9.HY9_AYEkGNTBJsM1OoqKPwQ_TvAAUWC1fZUKLH77cgM)

 (image/png)    


## Comments:

|  [](null)  ,1、李晶也用NETWORK_HB_TIMEOUT这个参数,Posted by liyin at 七月 03, 2023 16:37|
|---|
