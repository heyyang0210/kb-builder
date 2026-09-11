Created by 刘顺鹏, last modified by  许中立 on 十二月 20, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#1-overview概述)  

1. yashan分布式数据库目前只支持3节点及以上的自动选举，由于是基于raft的一致性算法，无法做到一主一备。因此需要特殊处理，支持一主一备部署形态，支持故障自动切换，以支持降低存储成本。
1. 该方案基于OM实现单机一主一备的功能上进行开发。    [https://conf.yasdb.com/pages/viewpage.action?pageId=100083280](https://conf.yasdb.com/pages/viewpage.action?pageId=100083280)  


IR：    [https://jira.yasdb.com/browse/YDBRD-19830W](https://jira.yasdb.com/browse/YDBRD-19830W)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#2-features功能特性)  

1.支持DN组一主一备的自选主，由yasom仲裁。MN组，CN组不支持。    
  2.支持最大可用，最大性能模式，最大保护模式（数据零丢失，但是切换条件更严）。    
  3.支持手动触发switchvoer，支持由yasom触发failover。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#3-interfaces接口)  

1. yasboot提供命令新增：
    1. yasboot election enable on/off --force -g/--group group-id // 开启或关闭OM仲裁选主功能, on：开启自主，off：关闭自选主，--force：在数据库状态异常的情况下，强制关闭自选主（可能会导致数据库主机无法启动）, -g/--group:指定组。
    1. yasboot election config -k key -v value -g/--group group-id // 设置选主相关参数, -g/--group:指定组。
    1. yasboot election config show -g/--group group-id // 显示主备选举状态和选举参数配置, -g/--group:指定组。
    1. yasboot election event show -g/--group group-id // 显示yasom启动以来，发送的选主相关事件，以组为单位显示, -g/--group:指定组。 注意：
    1. yasboot不提供对单个节点的自选更改命令，需要保持组内节点自选集参数保持一致。
    1. yasboot命令只支持DN组，如是CN组或MN组需要报错拦截。
1. 参数：
    1. FailoverThreshold = 9; // 触发failover的心跳超时时间，单位s
    1. FailoverAutoReinstate = false； // 旧主机连上新主机后，自动执行脑裂修复
    1. ZeroDataLossMode=true; // 数据零丢失模式，正常情况下以最大保护模式运行，切换后变为最大可用，并禁止自动切换 ，直到旧主机降备并完全同步新主机


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#4-limitations功能限制)  

1. 分布式组内yasom仲裁选举与自选举互斥，用户设置相关参数时，需要拦截（DB 拦截）。
1. 主备发生网络隔离时，备机可能升主，导致双主
1. 从OM下发的组内扩缩容，与仲裁选举要互斥，即在开启仲裁选举模式时，不可组内扩缩容。
1. 拦截用户通过从OM下发的failover。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#5-detail-design详细设计)  

###   [5.1 总体设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#51-总体设计)  

在原有设计框架下进行改动，使其适配分布式。下列会讲明与原有的区别。未讲明的采用原有设计方案。

![](https://conf.yasdb.com/download/attachments/133589997/%E4%B8%80%E4%B8%BB%E4%B8%80%E5%A4%87.drawio%20%281%29.svg?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3OTcsImV4cCI6MTc4MjMxMTU5N30.mM9-9qNbqGO6f7ltnp_GHyI5ELJnnAqwlqEtCg6OlnI)

###   [5.2 单机与分布式区别](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#52-单机与分布式区别)  

1. 自动切换要求（一主一备），采用原有功能设计:
    1. 自动切换开启，主机和备机均已OPEN，并且备机不是NEED REPAIR状态。
    1. yasom与主机失联时间超过FailoverThreshold，并且目标备机与主机断连。
    1. 如果是零丢失模式，备机不丢失数据的情况下，才能自动切换。
1. 普通模式（一主一备），采用原有功能设计：
    1. 每个主机上的yasgent监控线程会每隔一段时间查询对应节点视图，查看主备状态。每一个DN节点对应agent里一个线程，agent采用短连接与DN节点进行查询视图。
    1. 主备断连时候，agent上报给OM。  正常则不上报  。
    1. OM检测group内的节点状态，判断是否满足自动切换的要求。
    1. agent向备机发送failover的sql语句，执行切换。
1. 零丢失模式（一主一备）,采用原有功能设计，在原有功能的基础上增加修改：    
  原有设计：    
  一主一备，如果RPO必须是0，只能是最大保护模式，但是备库断连后，会影响主库写业务。为了兼顾自动切换的RPO=0和主库的可用性，设计了一个带限制的自动切换方案，保证数据不丢失的情况下，再去切换。
    1. 部署时或启动时，初始时zero_lose = FALSE，主备都设成最大保护，并在OM上设置对应组的zero_lose=TRUE。
    1. 如果备库断连，导致主库业务阻塞后，OM将主库降为最大可用，并设置zero_lose=FALSE。    
  a. 当备库恢复连接后，等待备库同步REDO后，再将主库升为最大保护，并设置zero_lose=TRUE。
    1. 如果主库宕机，触发选举后，OM先判断zero_lose。    
  a. zero_lose为FALSE，说明数据可能丢失，不自动切换，等待人工介入。    
  b. zero_lose为TRUE，说明数据不丢失，先将zero_lose置为FALSE，备机升主，然后设为最大可用（因为旧主库挂了，新主库没有备库，只能设为最大可用）
    1. 旧主库降备后，需要等待REDO同步后，再将新主库升为最大保护，并设置zero_lose=TRUE。
1. yasoma的管辖范围（主备不在于同一台机器上的场景）：
    1. yasagent以机器为单位，只监管自己机器上节点的状态。（存在不同yasagent并发对同一DN组上报事件的场景）。
1. yasoma 监控DN组流程采用单机原有设计
1. yasom下发命令到DB时，目前为同步单线程发送命令，需改造成多线程  。


###   [5.3 并发与异常处理](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#53-并发与异常处理)  

####   [5.3.1 并发处理](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#531-并发处理)  

1. 从OM下发的手动switchover和failover，ALTER DATABASE SET STANDBY DATABASE TO XXX（保护模式），与自动切换要互斥，即不可同时执行，需要报错。    
  Q. 如何禁止用户手动下发ALTER DATABASE SET STANDBY DATABASE TO XXX命令，导致OM不感知。    
  A. 直接使用go驱动，定义内部协议和yasdb交互，不走sql语句。同switchover手动下发处理。
1. 自动仲裁与自选举命令互斥。在开启自动仲裁模式下，手动执行，或通过OM执行自选举相关的命令都报错。 这个需要db内部报错。
1. om仲裁模式下，不允许扩缩容。需要关闭仲裁模式再进行扩缩容。
1. 从OM下发的手动shutdown，与自动切换要互斥，即不可同时执行，需要报错（force级别的shutdown不受影响）。


####   [5.3.2 异常处理](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#532-异常处理)  

1. 零丢失模式下  yasagent发现异常时（agent与db联系不到，不会触发事件上报）  ，有以下不同情况：    
  原则： 切换需要满足零丢失模式的要求（满足自动切换的同时，zero_lose=True），确定主节点不可用才可切换备机为主。
    1. 主备链路断连，主机与yasagent断连。  备机的agent上报事件  ，由OM仲裁是否满足零丢失模式切换要求，让备机自动切主。
        1. 主机agent与OM断连，此时主机孤立。这种情况下，yasom可能已经选出了新主机。如果旧主机不是最大保护模式，并且与客户端正常连接提供服务，则发生脑裂。如果CN与DN在同一个故障区，脑裂的时间与风险更大。
        1. 备机的agent与OM断连，此时无法无法自动切主。待人工介入修复。
    1. 主备链路断连，备机与yasagent断连。  主机的agent  ，由OM仲裁，zero_lose置为FALSE，将主机设为最大可用模式。
        1. 主机的agent 与OM断连则无法处理该事件。备机的agent与OM断连则无影响。
    1. 主备链路断连，主备与yasagent正常通信，  由OM仲裁，zero_lose置为FALSE将主机设为最大可用模式  。
        1. 主机的agent 与OM断连则无法处理该事件。备机的agent与OM断连则无影响。
    1. 主备链路正常，主机与yasgent断连，并无事件上报，不进行处理。
    1. 主备链路正常，备机与yasagent断连，并无事件上报，不进行处理。
1. 普通模式下yasagent发现异常时，有以下不同的情况，原则：只有满足自动切换条件，才可切换。
    1. 主备链路断连，主机与yasagent断连。主机的agent，备机的agent上报事件，由OM仲裁是否满足自动切换要求，让备机自动切主。
        1. 主机agent与OM断连，此时主机孤立。这种情况下，yasom可能已经选出了新主机。如果旧主机不是最大保护模式，并且与客户端正常连接提供服务，则发生脑裂。如果CN与DN在同一个故障区，脑裂的时间与风险更大。
        1. 备机的agent与OM断连，此时无法无法自动切主。待人工介入修复。
    1. 主备链路断连，备机与yasagent断连。主机的agent，备机的agent上报事件，由OM仲裁，将主机设为最大可用模式。
        1. 主机的agent 与OM断连则无法处理该事件。备机的agent与OM断连则无影响。
    1. 主备链路断连，主备与yasagent正常通信，由OM仲裁，将主机设为最大可用模式  。
        1. 主机的agent 与OM断连则无法处理该事件。备机的agent与OM断连则无影响。
    1. 主备链路正常，主机与yasgent断连，并无事件上报，不进行处理。
    1. 主备链路正常，备机与yasagent断连，并无事件上报，不进行处理。


####   [5.3.4 切换后处理（与单机保持一致）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#534-切换后处理与单机保持一致)  

1. 切换到新主后，如果yasom能重新连接到旧主机，此时会有以下几种状态：
    1. 旧主机OPEN，角色为Primary。
    1. 旧主机OPEN，角色已经转换为Standby。
    1. 旧主机正在重启。
    1. 旧主机无法启动。
1. 旧主机降备,以下处理流程：
    1. 如果旧主机处于OPEN模式并且为Primary角色，则先shutdown abort，重新open。
    1. 重新open的过程中，在mount模式下，等待接收到yasagent的心跳，获取到自己的角色为standby，该进程自行降备，并open。
1. 脑裂修复 ：    
  在最大性能模式下，由于redo是异步发送，很可能备机（新主机）的日志比旧主机少，所以容易发生redo分叉，导致数据不一致，即脑裂。 最大可用模式也可能出现脑裂 当FailoverAutoReinstate参数为TRUE时，yasom会在旧主机降备后，按以下步骤尝试修复脑裂数据：
    1. 等待主机连接到备机。
    1. 在主机上执行build database repair standby ‘name’。    
  注：为防止数据丢失或不一致，在脑裂被修复前，该备机不能自动升主，也就是说。新主机挂了之后，若备机是NEED REPIAR状态，不能自动切换，需要人工介入。


####   [5.3.4 分布式扩缩容如何使用](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#534-分布式扩缩容如何使用)    （待讨论，是否补充成资料，或OM自动实现该流程）

1. 扩容（DN组节点数量：2->3）：
    1. 通过OM命令，将该DN组的OM仲裁关闭。
    1. 通过OM命令，开启该DN组的自选举。
    1. 通过OM命令，执行分布式组内扩容命令。
1. 缩容（DN组节点数量：3->2）：
    1. 通过OM命令，执行分布式组内缩容命令。
    1. 通过OM命令，关闭该DN组的自选举。
    1. 通过OM命令，将该DN组的OM仲裁关闭。
1. 缩容（DN组节点数量：2->1）：
    1. 通过OM命令，将该DN组的OM仲裁关闭
    1. 通过OM命令，执行分布式组内缩容命令。
1. tip: 自选举开启与扩缩容命令执行顺序可以颠倒执行，不影响结果。


###   [5.7 DFX](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#57-dfx)  

1. 在单机基础上，DV$REPLICATION_STATUS 增加last heart_beat等字段  。
1. yasom提供命令查看各组选举参数现状，yasboot group election config show -g/--group group-id // 显示主备选举状态和选举参数配置, -g/--group:指定组。
1. 在yasom和yasagent详细记录log，包括故障发现时间，故障修复时间，失败尝试次数等。


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#6-testcases自测用例)  

|场景ID|测试场景|预期|备注|
|---|---|---|---|
|1|DN组主机电脑断网。|备机升主，保护模式切换成最大可用模式|  
|
|2|在场景1下，主机服务器网络恢复。|旧主降备。保护模式不变|  
|
|3|启动零丢失模式，重复进行场景1，场景2。|备机升主，旧主降备。最后俩节点的保护模式为最大保护模式|  
|
|4|DN组备机故障，主机正常运行。|主机切换成最大可用模式|零丢失与普通模式皆一样|
|5|零丢失模式下，DN组主机，备机升主后，将旧主恢复。此时在切换成最大保护模式之前，DN新主故障。|旧主不会重新升主，zero_loss为false|  
|
|6|DN组的主备在不同机器上，agent数量大时（按现有规模的最大值），OM上对处理高并发agent上报的事件以及自身高并发下更新元数据的负载能力。|正常处理上述场景12345|自测可能构建不出该场景，可能需要测试帮助提供机器|


  


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#7-document资料)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#8-workload工作量)  

|OM基于单机基础上适配分布式一主一备|  
|人天|  
|
|---|---|---|---|
|OM仲裁负载能力提升，支持分布式下多节点，高并发场景|  
|人天|  
|
|DB开启仲裁时，拦截除yasagent之前的sql命令|许中立|1人/周|  
|
|自测以及问题修订|  
|人天|  
|
|资料补充|  
|2人天|  
|


*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=133589997#9-todo遗留问题)  

1. db内核开启仲裁时，拦截用户执行的ALTER DATABASE SET STANDBY DATABASE TO XXX（保护模式）/修改保护模式的命令。OM下发的则不拦截。    
  om也是下发sql，用户也是下发sql，DB没法识别是不是OM下发的命令。  或客户端协议层带上一个om的标记位，涉及改造协议  。（单机也有同样遗留问题，实现可一起做了）


*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,1）手动执行switcover也需要支持；,2）手动关闭或开启_OM_ELECTION_ENABLE开关，OM是否需要校验,3）节点状态abnormal需要拦截切换,4）yasboot命令为什么不继承原来的增加group-id参数,5）分布式OM修改参数模式修改保护模式不支持（  key  =  "PROTECTION_MODE"  ,   value  =  "AVAILABILITY"  ）,Posted by shixinhua at 十二月 15, 2023 18:25|
|---|
|  [](null)  ,一主一备会议纪要：,1. 遗留问题：yasboot group命令支持同时操作多DN组。后续作为需求实现。,结论：顺手在本SR一起做了。最后实现的效果补充在本设计文档中，补充在对外资料中。     
    
  2. 遗留问题：单机和分布式yasboot 仲裁命令是否统一。 —— 杨德柳,结论：命令统一，统一使用yasboot election .....。,  
  3. 遗留问题：_OM_ELECTION_ENABLE 和 HA_ELECTION_ENABLE 是否需要合并，对外只需要一个参数。    
  4. 手动关闭或开启_OM_ELECTION_ENABLE开关，OM是否需要校验。    
  5. 分布式扩缩容和仲裁操作流程，资料体现。    
  6. 通过客户端进程号，区分命令来源是yasql，还是yasagent。拦截用户下发的部分命令。评估工作量，决定本SR是否交付该能力。    
  7. 补充多DN组故障自测场景。包含共部署和分部署。补充agent故障场景。,8. OM修改成最大保护模式的流程原则为：先切换模式成功，再修改zero_loss为 true。 将最大保护模式退出的流程为：先修改zero_loss 为false，再修改保护模式。,Posted by xuzhongli at 十二月 18, 2023 19:13|
