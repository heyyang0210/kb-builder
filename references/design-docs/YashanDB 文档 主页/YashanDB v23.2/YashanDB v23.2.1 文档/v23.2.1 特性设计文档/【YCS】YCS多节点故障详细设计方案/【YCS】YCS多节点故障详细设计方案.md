Created by 李晶, last modified by  李垠 on 十一月 08, 2024

#   [YCS支持多节点可靠性详细设计方案](#ycs支持多节点可靠性详细设计方案)  

SR链接:     [YDBRD-21560](https://jira.yasdb.com/browse/YDBRD-21560)  

##   [1. 总述](#1-总述)  

主要针对共享集群多节点可靠性的支持，共享集群最大支持节点数为64，但目前需要支持4节点可靠性交付。

###   [1.1 需求来源](#11-需求来源)  

部署形态：共享集群

内部需求，提高集群产品对外竞争力。

###   [1.2 调研文档](#12-调研文档)  

  [ORACLE RAC 集群软件异常处理调研](https://conf.yasdb.com/pages/viewpage.action?pageId=138559677)  

参考文献： 《Oracle RAC 核心技术详解》

###   [1.3 需求分析](#13-需求分析)  

|功能|方案设计|关键技术点|特性是否涉及|备注|
|---|---|---|---|---|
|采用专用线程处理不同节点的消息|YCS内部专用线程处理机制|是|是|不使用workPool|
|YCS内部任务处理|YCS任务管理设计|是|是|部分任务采用专用线程处理|
|YCS多节点启停||YCS4节点并发启停|是|依赖项，由其他SR实现|
|YCS4节点故障处理|YCS多节点故障处理|是|是||
|易用性|不涉及|否|否||
|兼容性|不涉及||否|否|
|周边配合|YFS支持多节点故障|是|否|依赖项，其他SR承载|
|周边配合|YASDB支持多节点故障|是|否|依赖项，其他SR承载|


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

无对外接口设计

##   [3. 规格与约束](#3-规格与约束)  

|规格/约束项|类型|规格、约束|原理说明|备注|竞品分析|
|---|---|---|---|---|---|
|故障感知|规格|网络出现异常后，节点能相互感知到|节点间网络心跳|超时时间通过NETWORK_HB_TIMEOUT配置参数指定|Oracle也感知并处理网络故障|
||规格|节点卡住或掉线，服务器宕机，能被其他节点感知到|节点磁盘心跳|超时时间由DISK_HB_KEEP_ALIVE配置参数指定|Oracle也感知并处理类似故障|
|故障处理|约束|节点故障后无法自动拉起|OM的monit没有集成||Oracle的monitor会定期监控集群程序状态，发现异常将自动拉起|
||规格|主节点异常后，集群内将投票仲裁，选出新的幸存者列表和主节点|基于共享磁盘的投票仲裁||Oracle下任意节点异常都触发重配置集群|
||规格|存在网络分区场景下，新的幸存者列表可能不是最优|使用贪心算法实现||Oracle文档说明是节点数最多子集群存活|
||规格|只有网络故障场景下，YCS将整体重启（包括YFS和DB）|||Oracle在这个场景下，只会重启集群管理软件，不会重启资源|
||规格|节点发现自己不在幸存者列表中将重启|主节点根据幸存者列表变更节点状态，节点启动后先读取主节点上的节点状态||Oracle是读取kill block中的    `有毒`    信息判断是否重启，只是实现机制差异，功能一致|
|其他|规格|目前只支持基于单个共享盘的投票仲裁|||Oracle可以通过磁盘的可见性进行仲裁|
||约束|超过4个节点的故障场景暂时不能完整支持||||
||约束|只支持基本故障类型: 磁盘故障，网络故障，进程故障，不支持运行过程中资源类故障（例如运行过程中内存耗尽等）||||
||约束|场景kill -19 再kill -18后，有一定的概率发生双主、数据写坏，这种场景无法100%解决|kill -19可以卡在任何地方，当kill -18时，在运行到保护机制之前，这个时间出现的错误无法解决|SR：YDBRD-21385会实现kill-19保护，建议在这个SR验证kill -19问题，主要验证保护机制是否生效，但是也无法完全避免kill -18引起的问题||


##   [4. 特性](#4-特性)  

###   [4.1 YCS专用消息处理线程设计](#41-ycs专用消息处理线程设计)  

####   [4.1.1 特性设计模块构件图](#411-特性设计模块构件图)  



如图所示，根据不同YCS节点发送过来的消息，通过消息队列投递到不同的专用消息处理线程中，使其能与ICS消息接收线程解耦。

- 启动时根据YCR盘配置信息，根据当前集群中节点个数（N）预分配（N）个线程处理消息。
- 停止节点时销毁线程，线程生命周期与YCS实例一致。


####   [4.1.2 特性设计相关数据结构](#412-特性设计相关数据结构)  

```

typedef struct StYcsMessage {
    LinkListNode listNode;
    YcsMsgType   msgType;
    union {
        YcsIcsMsg  icsMsg; //网络层消息处理
        YcsVoteMsg voteMsg; //投票消息处理
        YcsExceptionMsg exceptionMsg; //节点异常消息处理 已经由磁盘心跳监控线程统一处理异常信息，这里可能不再需要了。
    };

} YcsMsg;

typedef struct StYcsDedicatedThreadContext {

    CodUint8  nodeId; //专用处理线程的归属节点ID
    CodThread thread; //消息处理专用线程
    CodMsgQueue msgQueue; //消息处理线程专用消息队列

} YcsDedicatedThreadContext;


```

####   [4.1.3 特性流程设计](#413-特性流程设计)  



1. YCS中ICS模块通过消息接收线程接收到了其他YCS的发送的消息后。
1. 通过srcId（也就是发送端YCS的节点ID）找到对应的YcsDedicatedThreadContext，判断当前对应节点的专用消息处理线程是否已经启动:
    1. 未启动时需要自己尝试启动对应的DedicatedThread,启动成功后将消息投递到对应的消息队列中
    1. 未启动且尝试启动失败，只能由当前的消息接收线程处理（最坏的情况）
1. YcsDedicatedThread轮询消息队列中的消息，每次将消息队列中所有消息去除并处理。
1. 每个消息处理完成后，将消息内存释放。


***当无法正常分配出实际处理线程时，还是由网络线程处理消息***

###   [4.2 YCS内部任务处理设计](#42-ycs内部任务处理设计)  

###   [4.2.1 投票任务处理](#421-投票任务处理)  



1. 主节点故障或者主节点主动下线场景下，YCS备节点都会发起选举，会通过生成YcsVote的消息交由YCS主线程处理
1. 整个投票任务处理的流程为：
    1. 检查当前集群是否已经处于选举过程中，当集群已经处于选举过程中时，将当前节点的状态设置为YCS_CLU_VOTE状态，即结束处理（YCS心跳线程会自动跟随当前集群的选举流程）
    1. 检查当前集群主节点是否处于正常运行过程中，如果发现当前集群中已经有正常运行的主节点，也不会发起投票，而是直接加入新的集群
    1. 设置当前节点状态YCS_CLU_VOTE, 当前节点成为候选者（Candidate）角色，并更新voting Age(即将原来的age自增),发起选举流程
    1. 待选举模块选出新主时，集群中每个节点会因主备的不同触发两个消息：
        1. YCS_VOTE_PRIAMRY: 当前节点以主节点身份运行
        1. YCS_VOTE_STANDBY: 当前节点以备节点身份运行
    1. 以主身份运行的流程与以备身份流程运行再次不过多赘述，跟节点正常启动的流程基本一致。


***选举成功后的事件消息YCS_VOTE_PRIMARY, YCS_VOTE_STANDBY,在消息队列中只能存在一个，根据Age信息做去重处理***

####   [4.2.2 内部重启任务处理](#422-内部重启任务处理)  



- 内部重启分为两阶段, 停止clusterMnager以及资源 和 启动资源和clusterManager 模块
- 停止clusterManager模块和资源


1. 停止YCS相关的监控线程，防止当前节点通过监控线程写入脏数据自己的block
1. 清理当前节点主线程中消息队列中的消息，不再处理
1. 开始停止资源，首先会停止DB，根据实际参数WAIT_STOP_FIN_TIME 是否为0 来判断在DB停止超时后，是否需要强制停止DB
1. DB停止成功后，YCS会设置DB的状态为OFFLINE，并通知当前集群中YCS主节点更新当前集群的TOPO，并广播到集群中其他节点
1. 停止YFS，YFS停止成功后通知当前集群中的YCS主节点更新当前集群的TOPO，并广播到集群中其他节点


###   [4.3 YCS多节点故障处理设计](#43-ycs多节点故障处理设计)  

实际处理故障的流程与两节点故障并无区别，需要结合网络心跳以及磁盘心跳来判断节点是否需要下线,

详细可参考YCS去scsi协议中磁盘心跳监控流程



- 弱化网络故障处理，当网络出现故障时，会设置当前节点为abnormal
- 由磁盘监控线程结合磁盘心跳信息来判断处理


  [监控线程异常处理机制](https://conf.yasdb.com/pages/viewpage.action?pageId=130146158)  

基于目前故障类型在YCS层面看体现两种类型故障：

- 网络故障
    - 网络故障的感知依赖底层网络框架ICS
- 磁盘故障
    - 磁盘故障的感知依赖YCS磁盘监控线程对每个节点的磁盘监控，即对磁盘上的心跳计数变化的感知


两个故障是相互辅助处理：

- ICS感知到网络故障时，底层会向上层YCS提供相关网络故障的处理事件，YCS设置相应的网络故障信息。
- 磁盘监控线程在感知到网络故障时同时观测当前的磁盘心跳信息，当网络故障节点为备节点时，无需观测故障的磁盘心跳信息直接将该节点踢出当前集群
- 当网络故障的节点为主节点时，需要检查磁盘心跳是否超时，如果磁盘心跳超时，会更新选举模块的可见列表信息，并发起选举。
- 当磁盘心跳检测到节点故障时，网络心跳还未感知到时，同样会更新选举模块的可见列表信息，并发起选举。
- 通过选举模块来决定出新的主节点。


####   [4.3.1 YCS选举模块处理流程](#431-ycs选举模块处理流程)  



- 选举模块选举触发是需要外部线程触发（即主节点磁盘故障或者主节点网络故障以及磁盘故障）
- 选举线程会判断当前集群是否处于选举过程中
- 未处于选举过程中且实际触发选举的标记被设置上时，需要更新当前集群中的newMaster 为255，并记录旧主节点信息
- 将选举状态设置为Candidate状态，进入Candidate流程
- 通过当检查当前集群中所有节点的voteInfo信息，选出Teller节点
- Teller节点通过所有节点VoteInfo通过可见列表算出节点id最小的节点作为当前集群中的主节点
- Teller节点判断当前幸存者列表中存在旧主信息时，选择旧主当选主节点
- Follower 节点在发现已经处于选举状态时进入跟随状态，需要做的事情是等待新主的产生，若超时时间内未有新主产生就自身发现新的一轮选举
- 在新主产生后，通过消息队列将选举结果投递到主线程，由主线程处理投票结果信息。


***此处不需要选举线程处理幸存者列表，由主节点中的topo信息为offline的节点标记位异常节点，当其他节点通过topo信息发现自己为offline时，需要重启重新加入主节点***

***触发选举时，资源主与YCS主为同一节点时，需要将主节点身份信息重置为255，待新主产生后重新选出资源主***

###   [4.4 YCS多节点资源故障处理（不能只停留在YCS自身的故障处理流程中，需要包含资源）](#44-ycs多节点资源故障处理不能只停留在ycs自身的故障处理流程中需要包含资源)  

####   [4.4.1 YFS故障处理流程](#441-yfs故障处理流程)  

故障处理原则：

1. YFS为Ycs内嵌资源，YFS的主节点随着YCS主节点的变化而变化
1. YFS目前在YCS选举过程过程中，在缓存上保留的是原主信息，当YCS新主产生后才会切换为YFS新主。
1.     - 需要优化，在选举过程需要设置YFS无新主状态，即设置主节点无效值： 255
    - 在YCS发起选举时，集群内所有节点需要将自身的yfs主节点设置为：255, 并且需要强制刷新到资源中。（需要强制刷新的原因是无主无法自增topoVer，导致无法下发到资源）
    - 启动YFS场景优化，当启动YFS失败后需要停止当前YCS进程。



- 数据结构更新


```

typedef CodResult (*YcsTopoCallback)(YcsHandle hRes, const YcsDesc* desc, CodBool isForceQueryTopo); // 强制更新topoVer不变，YFS主节点为无效值的场景


```

YFS需要如何支持主节点为255的场景，YFS内部考虑？

- 场景1（启动或者备机升主的过程中故障掉线）：
-     1. 在YCS主节点故障场景下，选出了新的YCS主，YFS新主产生后进入升主流程
    1. 此时主YFS故障掉线（例如被kill 或者core了）
    1. YCS选出新的主节点，并下发topo到所有YFS节点

- 场景2 （备升主或者主启动过程中，备机加入集群）
-     1. 对于还未开始发送startBuild消息的，备机会一直重发startBuild消息，待主机启动或者备升主完成后处理startbuild请求即可。
    1. 对于已经加载完数据，准备发送endbuild消息的备机，YFS主启动完成或者备升主完成后，处理该消息即可。
    1. 其他情况，需要直接发加入集群请求。

- 场景3 （存在多节点同时offline或者online的情况）
-     1. 两节点不存在多节点并发offline online情况，但多节点存在该情况。需要YFS能够处理。

- 场景4 （脑裂情况）
-     1. YFS 不处理脑裂情况，由YCS 直接调用stopResource处理。

- 场景5 （主撤换）
-     1. YFS主机启动时，master切换，这种情况YFS不处理，ycs 调用stopResource处理
    1. YFS备机启动时，master切换，YFS会按主启动
    1. YFS备升主时，master切换，YFS不处理。ycs 调用stopResource处理。
    1. YFS 备机发现备升主时，YFS根据情况做加入新主或者备升主的决策。

- 场景6 （stopResource场景处理）
-     1. 原YCS 用isOpen标记位，记录YFS状态，比较粗。YFS启动成功后，会将isOpen设置为TRUE。stopResource开始，会判断isOpen状态，如果是false直接退出。因此假如YFS启动过程中，YCS要停掉YFS，是停不掉的。
    1. YFS梳理现有状态机，将装机器标记为打在YCS上。并在YCS上加一把latch锁。
    1. YFS需要支持无论yfs当前处于任何状态，当YCS调用stopResouce都要能够停下来。
    1. YCS调用startResource，stopResource时，可以判断是状态。但不能全程加锁。

- 场景7 （YFS正在停止或者启动时，YCS下发增量复制或者topo消息）
-     1. 在场景6，已经将状态记录在YCS上。
    1. YFS梳理现有消息，分为同步数据类消息，集群控制消息两类。对不同状态下可以收发的消息进行区分。给出回调接口。供YCS在收发消息前检查使用。
    1. YCS在处理消息时加共享锁。YFS停止资源时加排它锁。



1. 网络隔离场景下，YCS主会将备YCS踢出集群，整个过程中会有几个时间窗口：
    1. YCS发现与备机网络隔离的过程，网络心跳超时时间-默认30秒
    1. YCS 发现备机网络异常，处理异常到下发处理后的结果到资源的这个时间间隔
    1. YCS备发现自己被主节点踢出集群的这个时间段，YFS处理这个异常消息的时间段，这个时间段可能网络突然恢复了，YFS还没处理异常的topo，导致给备的YFS发送了一些写盘的消息（例如增量复制的消息）。备机不会写盘
    1. YCS 备机重启的这个时间段，即stop db 的时候，YFS如果收到了主机发送的消息，但还没处理异常topo消息，先处理了主机发送过来的消息。---场景7已经解决


备注：YFS要支持主节点为255的场景

详细参考：    [https://conf.yasdb.com/pages/viewpage.action?pageId=141566058](https://conf.yasdb.com/pages/viewpage.action?pageId=141566058)  

####   [4.4.2 YASDB故障处理流程](#442-yasdb故障处理流程)  

DB选主原则：

- 旧主的获得被选举优先级最低，优先选择非旧主。
- 选新主时需要等待db旧主在途io不为0或者超时
- DB 需要支持无主的状态


#####   [4.4.2.1 DB 单独故障](#4421-db-单独故障)  



1. Ycs资源监控线程感知到DB故障，会出现状态转换处理即Ycs监控线程将DB从online->offline状态切换。
1. 重启db
1. 判断资源管理上下文中记录的pid对应的进程是否还存活
1. 存活时需要重启db，未存活则跳过停止db的流程，直接进入设置db状态的流程
1. 判断管理当前db的ycs是否为主节点，非主节点需要通知主YCS执行后续步骤
1. 通过ComfirmResource消息通知YCS主节点更新状态，若当前集群总已无db主节点，YCS还需要选择新的资源主节点
1. 选择出新的主节点后，更新topo信息并广播到当前集群所有节点


#####   [4.4.2.2 DB与YCS一起故障](#4422-db与ycs一起故障)  

- DB单独故障与DB与YCS一起故障处理流程的区别在于有无YCS主节点去选择资源主。
- 具体处理流程与YCS多节点故障处理一致，在YCS无主的场景下（YCS处于选举过程中）将资源（DB,YFS）主都设置为255。
- 在waitIo结束前，db主都为255的状态，直至waitIo数为0或者waitIo超时, 由YCS判断是否可以选出新的DB主


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

###   [5.1 不带业务场景](#51-不带业务场景)  

部署形态：共享集群（4节点集群）

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


###   [5.2 带业务测试6.1场景中的用例](#52-带业务测试61场景中的用例)  

同上（带业务需要资源DB，YFS支持异常分支处理）

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[集群管理内部结构-第 3 页-第 13 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmI4OTcwYzJhZjRmNTIwYzBjIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.Yq9xH-hcDWS3Vf22Swv-JzYaU-aYWufzuAvcwppjXrE)

 (image/png)    


[集群管理内部结构-第 3 页-第 3 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmJhMWFkOWEzMzExZGM4YTdjIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.LL5wOK2oXeuc0bwX4cIrQtxQm05SFiR7PHYJia5ETXs)

 (image/png)    


[集群管理内部结构-第 3 页-第 10 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmI4OTcwYzJhZjRmNTIwYzBkIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.PcpupHQkyRrfFCUyazUdSivT4GJWG0sPvT6cbCDTxsg)

 (image/png)    


[集群管理内部结构-第 3 页-第 12 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmI4OTcwYzJhZjRmNTIwYzBlIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.7ZkVY7D1PsAbs9_u3TTj_np722PUOP0MaAHl_WeIJ80)

 (image/png)    


[集群管理内部结构-第 3 页-第 11 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmJhMWFkOWEzMzExZGM4YTdkIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.KQ-zf3SJdt4rspFIj_VuJvDdSl2u-P-zQMNhT5lfF-I)

 (image/png)    


[集群管理内部结构-第 3 页-第 9 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmNhMWFkOWEzMzExZGM4YTdlIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.d0hPbaOHHkgBkoZp7bDFNh0w36OZ788k4FnQIzFbBYA)

 (image/png)    


[集群管理内部结构-第 3 页-第 4 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmNhMWFkOWEzMzExZGM4YTdmIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.E8gWUnFXWJaBy2SnCUkNrFHfeBH2e7COSV5w1yB56LE)

 (image/png)    


[集群管理内部结构-第 4 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmM4OTcwYzJhZjRmNTIwYzBmIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.2NkJ1mzuthucO2rc069HokCglIWaSVLxDrZ0WQnO214)

 (image/png)    


[集群管理内部结构-第 3 页.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmM4OTcwYzJhZjRmNTIwYzEwIiwicmVmX2lkIjoiNjczOTZjNmI1OTNmOTljOWZmMjM2ZTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzAxLCJleHAiOjE3ODIzODcxMDF9.4pqHjVojFGpXFH0Hq6_jARF_c0jQls2VXJ5-zsQ5ewc)

 (image/png)    


## Comments:

|  [](null)  ,  [YCS故障设计方案会议纪要](https://conf.yasdb.com/pages/viewpage.action?pageId=141573346)  ,Posted by lijing at 一月 08, 2024 10:52|
|---|
