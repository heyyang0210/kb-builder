Created by 李晶, last modified by  李垠 on 十一月 08, 2024

#   [YCS启停设计](#ycs启停设计)  

JIRA：    [*BEAS-DSTB*](https://jira.yasdb.com/browse/YDBRD-20935)  

##   [1. Overview（概述）](#1-overview概述)  

共享集群管理软件YASCS去除SCSI协议后设计与实现

##   [2. Features（功能特性）](#2-features功能特性)  

- YASCS节点启停
- YASCS资源管理
- YASCSfailover


##   [3. Interfaces（接口）](#3-interfaces接口)  

- 略


##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 略


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c67a1ad9a3311dc8a58/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUlBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2NTYsImV4cCI6MTc4MjMxMTQ1Nn0.XD0S-OZtcDW0mtX1xGVxu69MyfHurTIWDeCUmkj_pT0)

1. 接口层：统一对外接口，其中包含ICS 网络层业务消息接口，资源，工具UDS相关业务消息
1. 业务层架构:
1. 消息队列：维护由外部消息或者内部事件产生的消息
1. 主线程：消费消息队列中的消息，由主线程处理
1. 缓存：缓存整体集群的Topo信息，外部需要获取集群的信息，从缓存中获取
1. 存储接口：主要针对共享磁盘中操作相关接口


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 YASCSTOPO管理](#521-yascstopo管理)  

#####   [5.2.1.1 Topo管理原则:](#5211-topo管理原则)  

```
1. TOPO版本号变更只能由主节点变更。
2. TOPO管理的资源TOPO上下线只能由管理的YCS节点变更，通知主节点进行广播。
3. 资源获取TOPO结构从缓存中获取且需要校验TOPO版本号，版本号只能递增不能递减。
4. 写盘TOPO结构时需要校验版本号变更。
5. 资源获取的topo全部只能从缓存中获取，期望管理topo信息使用读写锁，因为大多数情况下都是读topo，更新topo一般都只存在于topo发生变化的过程中。
6. Topo缓存提供CRUD接口，外部不直接操作读写盘接口。

```

###   [5.3 YASCS详细设计](#53-yascs详细设计)  

####   [5.3.1 YASCS实例与YCSElect选举算法交互](#531-yascs实例与ycselect选举算法交互)  

#####   [5.3.1.1 选举算法状态切换](#5311-选举算法状态切换)  



- 选举算法状态


|选举状态|描述|备注|
|---|---|---|
|YCS_ELECT_NORMAL|选举的起始或者结束状态||
|YCS_ELECT_FOLLOWER|选举算法中跟随者状态||
|YCS_ELECT_TELLER|选举算法中统计者状态||
|YCS_ELECT_CANDIDATE|选举算法中候选者状态||


- 选举结束后触发选举相关事件


|选举事件|描述|备注|
|---|---|---|
|TranstToStandby|YCS切换为主节点||
|TranstToFollower|YCS切换成备节点||


1. 选举的发起与结束都是以YCS_ELECT_NORMAL状态为标记
1. 选举结束后触发选举事件透传给YCS主线程
1. YCS根据不同是的选举事件做相应的处理


#####   [5.3.1.2 YCS实例状态切换](#5312-ycs实例状态切换)  



1. YCS实例的状态机切换
1. 启动时从INIT切换到选举状态（Voting）
1. 通过选举框架触发不同的选举事件，YCS进入不同的状态。
1. 选举框架触发TransToStandby事件，YCS实例进入Standby状态，若果当前YCS为主节点，那么需要进入YCS降备流程。
1. 选举框架触发TransToPrimary事件，YCS实例进入Primary状态，则YCS进入升主流程。


####   [5.3.2 YASCS资源管理](#532-yascs资源管理)  

YCS需要处理资源启停的目标线程有三种:

1. monitor线程：- 主要针对对资源监控出现异常时会触发重启资源(主要针对YASDB, YFS与YCS在同一进程内)
1. 工具服务线程- 外部工具YCSCTL会触发资源启停
1. YCS主线程异常处理- YCS内部接收到外部异常事件（ICS网络异常，读写磁盘异常等）YCS需要内部重启，同样也会重启资源目前对资源管理存在不稳定因素，因为多个线程会触发启停资源。


#####   [方案一：](#方案一)  

```
1. 多个线程触发资源启停时，有且仅有一个线程能实际启停资源（主要是DB）, 目前考虑使用monitor线程。
2. 当YCSCTL 发送命令需要启动DB时，工具服务线程只是设置标记通过Monitor线程启动db,（若当前资源已经处于启动或者shutdwon过程中）,工具层报错，通过用户稍后再试。

```

#####   [方案二：](#方案二)  

```
由主线程主导处理资源的启动，复用YSCE抛异常的方式，新增YCSE_START_RESOURCE,YCSE_STOP_RESOURCE枚举，当需要启动或者停止资源时，由主线程去停止或者启动资源。

```

上述两个方案都是为将资源的启动控制在一个线程中，防止各类异常叠加出现多个线程同时触发资源的启动或者停止。

资源管理需要引入状态管理：

|资源状态|描述|备注|
|---|---|---|
|YCS_RES_INIT|资源初始化状态||
|YCS_RES_START|资源启动状态||
|YCS_RES_STOP|资源停止状态||
|YCS_RES_PREMOTING|资源升主状态||
|YCS_RES_DEMOTING|资源降备状态||
|YCS_RES_ONLINE|启动完成后的上线状态|可服务状态|
|YCS_RES_OFFLINE|停止完成后的下线状态|完全不可服务状态|


YCS对资源的管理不能简单的通过标记位来描述，需要通过与资源交互明确资源（YFS,DB）内部处于的状态，期望资源能提供相应的接口由YCS调用：

方案一：由资源提供接口给YCS：

1. init,start,premote,demote等接口，当YCS需要对资源切换主节点，启动资源等，可以根据不同的状态切换调用不同的资源接口。
1. init => YCS_RES_INIT 状态：此时资源处于初始化状态，如果此时发生资源切换，或者有YFS消息进入，YCS可以屏蔽相关消息或者不选举当前DB为主节点。
1. start => YCS_RES_START 状态：资源启动完成。
1. premote => YCS_RES_PREMOTING状态： 当YCS触发切换资源主节点时，可以调用premote升主接口
1. demote => YCS_RES_DEMOTING状态： 可能因为异常出现主节点降备的流程。


方案二：基于目前的流程还是以topo变更触发不同的流程，但是触发流程前需要资源通知YCS自身目前处于什么状态即资源内部的状态变化需要与YCS交互。

方案三：node master发现有node请求加入，如果这个node已经是online状态并且是accept状态，说明这个node曾经故障过，这时立即更新topo，并做清理工作，然后在处理node加入的请求优点：yfs、db没有工作量缺点：只能解决一个场景，即非主节点kill掉后立即拉起的场景

![](https://pingcode.yasdb.com/atlas/files/public/67396c67a1ad9a3311dc8a59/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBZ0FBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUlBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2NTYsImV4cCI6MTc4MjMxMTQ1Nn0.XD0S-OZtcDW0mtX1xGVxu69MyfHurTIWDeCUmkj_pT0)

####   [5.3.3 YASCS启动](#533-yascs启动)  



1. YCS启动流程其中初始化流程以及除集群管理模块启动流程外，其他模块启动流程没有发生变化。
1. 本方案设计主要针对集群管理模块（ClusterManager）的启动。
1. 启动时需要开始写初始心跳到自身的NodeBlock中
1. 读投票盘信息, 检查当前集群是否处于选举状态。
1.     - 非选举状态时，检查投票盘上是否存在主节点, 并进行主节点探活。
    -         1. 存在主节点时，节点以备节点身份运行，需要通过网络调用加入集群，主节点会将当前的topo信息返回给当前节点。
        1.             - 如果加入主节点失败，从步骤b开始重新执行。

        1. 更新主节点的topo信息到自身的缓存以及磁盘中。
        1. 启动资源（yfs，yasdb）,资源启动流程暂时不变动。
        1. 资源启动完成后，整个启动流程结束。

    - 处于选举状态时，当前节点也需要参与选举。
    -         1. 参与选举流程，等待选举结束
        1. 选举结束后，判断自身是否为主节点，若非主节点进入非选举状态流程。
        1. 若自身为主节点，以主节点身份运行，刷新自身nodeBlock，且通过网络广播topo到所有可见的节点（不要求一定能广播成功）。
        1. 启动资源（yfs，yasdb），资源启动流程暂时不变动。
        1. 资源启动完成，整个启动流程结束。




####   [5.3.4 YASCS停止](#534-yascs停止)  



#####   [5.3.4.1 停止节点](#5341-停止节点)  

1. YCS停止的步骤在停止YCS CM模块前的流程与之前无变化
1. 停止集群管理模块前（CM）重要的流程是优先停止所有的资源（YFS,YASDB)
1. YCS CM（集群管理模块）停止分为两种不同的流程：
1.     - 停止YCS主节点
    -         1. 停止YCS主节点，首先需要停止当前YCS中的资源模块。
        1. 主节点在停止前需要写自身nodeBlock，并向所有存活的YCS节点广播最新的topo信息
        1. 需要将当前集群中所有的资源主节点置为无效值，需要等待YCS新主出现后重新选出资源类的主节点。
        1. 通知当前存活且节点Id最小的节点, 该节点收到请求后通过Elect(选举模块)，发起新一轮选举。
        1. 选举结束收，各个YCS进程会收到不同的选举事件：
            1. 未当选主节点的YCS处理TranstToStandby事件，处理成为备节点流程（加入新的主节点）。
            1. 当选主节点的YCS节点处理TranstToPrimary事件，处理备节点升主的流程
                1. 成为新的主节点，选出新的资源主节点
                1. 写入自身nodeBlock,topoVersion自增并广播最新topo信息
        1. 重组集群稳定后继续工作

    - 停止YCS备节点
    -         1. 停止YCS 备机点时，需要通知YCS主节点
        1. YCS主节点收到节点停止的请求时，将停止的节点状态更新成为OFFLINE,并自增TopoVersion,写入自身的nodeBlock中，由主节点广播到其他YCS节点中
        1. YCS备机销毁自身资源，退出进程
        1. YCS备节点退出不影响整体集群的稳定




###   [5.4 YCS异常处理（Failover）](#54-ycs异常处理failover)  

####   [5.4.1 YCS异常处理-磁盘心跳异常](#541-ycs异常处理-磁盘心跳异常)  

- 磁盘心跳异常需要使用IOFENCE机制 --李垠


####   [5.4.2 YCS异常处理-网络心跳异常](#542-ycs异常处理-网络心跳异常)  

- 备机感知主节点为网络异常


1. 需要将主节点的状态在内存中设置为offline，并触发选举进入选举流程。
1. 若选举失败后，重启YCS，进入到YCS启动流程。


- 主机感知备节点网络异常


1. 更新YCS备节点的状态，自增TopoVersion,并广播到所有可见的YCS节点。


整体处理与原有流程变动不大。

###   [5.5 Compatibility（兼容性）](#55-compatibility兼容性)  

- 略


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

###   [6.1 节点正常启停](#61-节点正常启停)  

|用例场景|预期|备注|
|---|---|---|
|2节点，首次启动，依次拉起|查询topo信息正常||
|2节点，集群正常运行后，停止备节点|停止正常，查询topo信息正常||
|2节点，集群正常运行后，停止备节点再拉起|停止正常，查询topo信息正常||
|2节点，集群正常运行后，反复停止备节点再拉起|查询topo信息正常||
|2节点，集群正常运行后，停止主节点|停止正常，查询topo信息正常|原备节点升级为主|
|2节点，集群正常运行后，停止主节点再拉起|停止正常，查询topo信息正常|原备节点升级为主|
|2节点，集群正常运行后，停止主节点后，再停止原备节点|停止正常||
|2节点，集群正常运行后，停止主节点后，再停止原备节点，拉起原备节点|停止正常，查询topo信息正常|投票盘上原备节点为主，原备节点升级为主|
|2节点，集群正常运行后，停止主节点后，再停止原备节点，拉起原主节点|停止正常，查询topo信息正常|投票盘上原备节点为主，原主节点重新拉起后升级为主|
|2节点，集群正常运行后，停止原备节点后，再停止原主节点|停止正常||


###   [6.2 节点异常启停](#62-节点异常启停)  

|用例场景|预期|备注|
|---|---|---|
|单节点启动|未设置YASCS_HOME,环境变量且不指定启动目录|启动报错|
|单节点启动|不创建yascs.ini|启动报错|
|单节点启动|指定启动目录为已启动的节点目录|启动报错|
|单节点启动|配置异常的ip地址|启动报错|
|单节点启动|占用配置inner_url端口后启动|启动报错|


###   [6.5 带业务启停](#65-带业务启停)  

|用例场景|预期|备注|
|---|---|---|
|2节点，带业务运行，停止备节点|没有异常，查询topo信息正常||
|2节点，带业务运行，停止主节点|没有异常，查询topo信息正常||
|2节点，带业务运行，交替启停两个节点|没有异常，查询topo信息正常||
|2节点，带业务运行，反复分别启停两个节点|没有异常，查询topo信息正常||


###   [6.6 3节点正常启停](#66-3节点正常启停)  

|用例场景|预期|备注|
|---|---|---|
|3节点，首次启动，依次拉起|查询topo信息正常||
|3节点，集群正常运行后，停止备节点|停止正常，查询topo信息正常||
|3节点，集群正常运行后，停止备节点再拉起|停止正常，查询topo信息正常||
|3节点，集群正常运行后，反复停止备节点再拉起|查询topo信息正常||
|3节点，集群正常运行后，停止主节点|停止正常，查询topo信息正常|原备节点（nodeId小的）升级为主|
|3节点，集群正常运行后，停止主节点再拉起|停止正常，查询topo信息正常|原备节点（nodeId小的）升级为主|


###   [6.7 不带业务场景](#67-不带业务场景)  

|用例名称|用例步骤描述|期望|实际结果|备注|
|---|---|---|---|---|
|yascs.ini缺失|部署环境后，删除yascs.ini文件，重启yascs|启动报错||正常报错，无core|
|yascs.ini配置信息异常|部署环境后，篡改yascs.ini中的配置信息，改成无效值|启动报错||正常报错，无core|
|磁阵异常|启动过程中，使用faultPoint注入故障，模拟磁盘读写异常|启动报错||正常报错，无core|
|线程资源异常|使用faultPoint,注入线程分配失败的异常，启动ycs|启动报错||正常报错，无core|
|内存资源异常|使用faultPoint,注入内存分配失败的异常，启动ycs|启动报错||正常报错，无core|
|网络异常|使用faultPoint,注入网络故障错误，启动ycs|启动报错||正常报错，无core|
|YCS主节点hang住|kill -19 YCS主节点|备机心跳超时，备节点投过选举成为主节点||无core，备机成为新的主节点，新的主节点的db因为与主节点心跳超时会自动abort,恢复后会抛出脑裂异常重新启动|
|YCS备节点hang住|kill -19 YCS备节点|主节点给备机发送心跳超时，抛出备机网络异常，清理异常channle||无core，备节点db会abort，恢复后，备节点通过monitor重启拉起db。|
|YCS主节点服务器宕机|kill -9 YCS主节点模拟宕机|主节点给备机发送心跳超时，抛出备机网络异常，清理异常channle||无core，备节点db会abort，恢复后，备节点通过monitor重启拉起db。|
|YCS备节点服务器宕机|kill -9 YCS备节点模拟宕机|主节点给备机发送心跳超时，抛出备机网络异常，清理异常channle||无core，备节点db会abort，恢复后，备节点通过monitor重启拉起db。|
|模拟YCS主备节点之间topo信息不一致|使用faultPoint 故障注入，修改备节点上的topo信息，造成主备之间的topover或者age不一致|备节点需要主动拉取主节点的topo信息或者直接重新读盘获取最新的topo信息||主备之间的topo信息一致业务正常|


###   [6.8 带业务测试6.1场景中的用例](#68-带业务测试61场景中的用例)  

自测用例大部分再可靠性工程中存在现有自动化用例，可以本地验证或者CI工程验证可靠性场景。

##   [7. Document（资料）](#7-document资料)  

1.   [ycsElect](https://conf.yasdb.com/pages/viewpage.action?pageId=130121831)  
1.   [ycs可靠性](https://conf.yasdb.com/pages/viewpage.action?pageId=119558688)  
1.   [ycs启停文档](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076)  


##   [8. Workload（工作量）](#8-workload工作量)  

###   [8.1 AR划分及工作量估算](#81-ar划分及工作量估算)  

|AR|代码行评估|工作量评估|备注|
|---|---|---|---|
|Topo信息管理||人天||
|YCS正常启停流程||人天||
|YCS两节点可靠性||人天||
|YCS资源管理||人天||
|YCS适配选举模块||人天||
|自测以及问题修订||人天||


##   [9. TODO（遗留问题）](#9-todo遗留问题)  

1. ycs双主对yfs和db的影响，ycs双主有可能出现db双主，yfs双主?


## Attachments:

[YCS启动-选举层状态机.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjZhMWFkOWEzMzExZGM4YTU2IiwicmVmX2lkIjoiNjczOTZjNjY1OTNmOTljOWZmMjM2ZTJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjU2LCJleHAiOjE3ODIzODcwNTZ9.AtRN_ZGG4v834ufgaBPQF2SBT2uDZWN0hPOs1VG-qSA)

 (image/jpeg)    


[newnodeaccept.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjc4OTcwYzJhZjRmNTIwYmU4IiwicmVmX2lkIjoiNjczOTZjNjY1OTNmOTljOWZmMjM2ZTJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjU2LCJleHAiOjE3ODIzODcwNTZ9.5Q_c_XY3Frag-q3nPFyZRMtF9xZajSTdWoDf1KhJgoY)

 (image/jpeg)    


[image2023-10-12_20-32-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjdhMWFkOWEzMzExZGM4YTU3IiwicmVmX2lkIjoiNjczOTZjNjY1OTNmOTljOWZmMjM2ZTJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjU2LCJleHAiOjE3ODIzODcwNTZ9.Mn9JJ_36HtYYjIGB-TxYvoF1h1zHvgQ2yr1nNaN3wT0)

 (image/png)    


[YCS启动-YCS 实例状态机.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjc4OTcwYzJhZjRmNTIwYmU5IiwicmVmX2lkIjoiNjczOTZjNjY1OTNmOTljOWZmMjM2ZTJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjU2LCJleHAiOjE3ODIzODcwNTZ9.ekPEkUGDRBNzyxm2EkMnyeBCECrVT4-2bncP3jwsni8)

 (image/jpeg)    


[YCS启动-YCS启动.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjc4OTcwYzJhZjRmNTIwYmVhIiwicmVmX2lkIjoiNjczOTZjNjY1OTNmOTljOWZmMjM2ZTJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjU2LCJleHAiOjE3ODIzODcwNTZ9.a2fLuvNh9_cdUzO3ebHV1RaefDvObKSbQGY1b3wndeM)

 (image/jpeg)    
