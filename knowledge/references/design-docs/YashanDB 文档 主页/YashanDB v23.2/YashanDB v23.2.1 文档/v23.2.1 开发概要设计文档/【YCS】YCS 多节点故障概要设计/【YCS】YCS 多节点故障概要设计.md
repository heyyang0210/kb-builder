Created by 李晶, last modified by  李垠 on 十一月 08, 2024

##   [1. 总述](#1-总述)  

本设计需求主要来源与集群产品对外竞争力，本设计主要是集群4节点可靠性能力。

###   [1.1 需求来源](#11-需求来源)  

部署形态：共享集群

内部需求，提高集群产品对外竞争力。

###   [1.2 调研文档](#12-调研文档)  

  [ORACLE RAC 集群软件异常处理调研](https://conf.yasdb.com/pages/viewpage.action?pageId=138559677)  

参考文献： 《Oracle RAC 核心技术详解》

  [YCS去SCSI协议启停设计](https://conf.yasdb.com/pages/viewpage.action?pageId=13014744)  

###   [1.3 需求分析](#13-需求分析)  

基于目前的YCS架构要处理多节点故障场景存在以下风险：

```
1. YCS，YFS之间的消息通信是通过底层网络框架ICS进行交互，其中YCS/YFS业务逻辑与ICS消息接收线程强耦合，在某些特定场景下会存在ICS底层start/stop 节点连接并发导致挂起。
2. YCS 故障处理目前基本由主线程完成，两节点故障处理故障的效率不明显看出问题，多节点故障场景下，多个故障叠加，多个节点同时故障时，对目前YCS故障处理的能力有较大的冲击，可能会造成多个节点的异常未及时处理导致各种意想不到的问题。

```

处理方案：

需要将YCS业务处理逻辑与ICS网络接收线程解耦。

方案一：    
  如果两个模块解耦后，即ICS接收线程将不再处理业务，通过消息队列投递到YCS主线程处理。YCS/YFS之间的消息会变成单线程出现，所以需要引入workPool（线程池）机制来处理YCS/YFS之间的消息。引入WorkPool(线程池处理机制):

```
1. 增加YCS相关对外配置参数：MAX_WORKERS，THREAD_STACK_SIZE。
    
2. 增强YCS架构消息处理能力，引入WORKPOOL，加强YCS多任务处理能力。

```

方案二：使用节点专用线程处理业务消息，即每个节点的消息对应专用线程处理。

结论：采用专用线程方案，即方案二。

###   [1.4 专用线程处理YCS之间的消息通信以及节点故障信息](#14-专用线程处理ycs之间的消息通信以及节点故障信息)  

1. 内存管理：
1. 两种方案：
1. 两种方案的优缺点：


```
 1. 引入YASDB内部内存管理机制，采用memPool来管理处理业务消息时的内存以及创建任务任务过程中的内存申请以及释放

 2. 直接使用操作系统的内存

```

```
 1. 优点是内存可控，内存管理机制完善，缺点：工作量未知，未有清楚的工作量考量(最好有比较熟悉的这块实现的同事参与)

 2. 优点是简单，不太需要额外的工作量考量，缺点：内存不可控，

```

结论：采用方案二

```
YCS目前针对实例本身需要处理的任务：
    
1. YCS内部重启任务：即将YCS的cluster模块以及资源模块（YFS,DB）都重新启停一遍，其中YCS不会释放资源，YFS,DB会将自身的资源都是放并启动时重新申请，触发场景主要有：读写盘异常，YCS脑裂异常

2. 资源重启任务：即将资源（YFS,DB）重启，触发场景：启动资源失败的场景
    
3. 选举任务：即YCS内部触发了集群重组，触发场景：主YCS节点掉线，主YCS磁盘心跳异常，主YCS与备YCS之间网络隔离等
    
4. YCS升主任务： 即通过选举选出的新的主YCS，YCS以主节点身份运行
    
5. YCS以备运行任务： 即通过选举选出新的主YCS且主不是当前YCS节点，当前YCS节点以备身份运行
    
6. YASDB启动/停止任务： 即YCS资源（DB的启动和停止），触发场景有用户端触发（ycsctl）,资源监控线程
    
7. YCS停止任务： 即YCS自身的停止，触发场景由用户触发（ycsctl）

```

其中关于资源启停的任务，目前考虑由资源监控线程独立完成，这块有单独的AR，从AR角度去设计考量。以上分为两种场景：1. 节点自身的故障：磁盘故障（读写盘异常）导致的节点内部重启，发现脑裂异常等2. 外部故障处理：例如收到其他节点的网络故障事件，其他节点磁盘故障事件的处理可以交由单独的任务管理机制处理故障处理的优先级：1. 节点自身的故障处理优先级最高，处理自身故障的过程中，根据实际的逻辑做一些故障清理。2. 处理外部故障时，需要引入WORKPOOL以及任务管理机制处理管理

这些任务如果保证并发以及任务的优先级，以及需要有任务管理，对任务去重。

UDS消息即ycsctl以及DB与ycs之间的心跳不考虑生成work任务处理，本身每个ycsctl消息都是一个独立的线程处理，期望本身保持不变。

###   [1.3.1 功能拆分](#131-功能拆分)  

|功能|方案设计|关键技术点|特性是否涉及|备注|
|---|---|---|---|---|
|新增配置参数|基于YCS现有参数框架完成|否|否|无需参数引入|
|引入入workPool|基于现有workPool基础模块完成|是|否|不使用workPool，采用专用线程处理|
|YCS内部任务处理|YCS任务管理设计|是|否|需要在详细设计中体现整体设计的完整性|
|YCS内存管理|YCS内存管理|是|否|是否考虑要做|
|YCS4节点启停|YCS重构启停|是|否|目前YCS已支持，但DB在23.1上还不支持|
|YCS4节点故障处理|YCS故障处理详细设计|是|是|详细设计中体现|


###   [1.3.2 DFX能力](#132-dfx能力)  

YCS本身没有视图的能力，相关DFX能力依赖告警日志以及ycsctl 外部工具对topo查询。

告警日志的完备性检查：

```
1. YCS之间网络断链告警

2. YCS与DB之间的心跳断链告警

3. YCS检测到其他节点的磁盘心跳异常告警

```

###   [1.5 开源依赖](#15-开源依赖)  

无开源依赖

##   [2. 接口](#2-接口)  

1. ycsctl set paramter MAX_WORKERS=xxx;
1. ycsctl set paramter THREAD_STACK_SIZE=xxx;


##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**

规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

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


##   [4. 特性](#4-特性)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**  针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

内部架构：

![](https://pingcode.yasdb.com/atlas/files/public/67396b638970c2af4f520436/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFCQUFBQUFBSUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM4MjksImV4cCI6MTc4MjMwNDYyOX0.NDQTNnpGDOD7OwH1cEA5YWsWMDsf76INl8lEcAsJkm0)

模块设计：

![](https://pingcode.yasdb.com/atlas/files/public/67396b63a1ad9a3311dc82ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFCQUFBQUFBSUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUJBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTM4MjksImV4cCI6MTc4MjMwNDYyOX0.NDQTNnpGDOD7OwH1cEA5YWsWMDsf76INl8lEcAsJkm0)

###   [基础设施层](#基础设施层)  

- ICSManager
- 负责YCS/YFS之间的网络消息交互模块
- TopoManager
- 负责集群节点列表在内存中的缓存。在YCS主节点需要保证TopoManager以及磁盘（NodeBlock）中的数据与数据的一致性。
- Common
- 多个模块共享的基础代码。


###   [业务层](#业务层)  

- Startup
- 负责YCS节点启动流程，节点启动注册、获取集群信息、通知节点/资源状态等流程。
- Elect
- 主要选举结束后，主节点对所有节点信息的处理流程
- ClusterManager
- 处理集群中集群信息管理的相关业务。
- ResourceManager
- 处理资源的启停，监控，异常处理的模块


###   [接口层](#接口层)  

- ICS Service
- 接收处理ICS网络消息服务
- UDS Service
- 处理UDS消息服务


###   [4.1 新增配置参数](#41-新增配置参数)  

1. 通过YCS参数框架支持：MAX_WORKERS ，THREAD_STACK_SIZE参数配置（参考DB的参数值）
    1. MAX_WORKERS
        1. 参数取值范围（0~1024）
        1. 取0值时MAX_WORKERS 取值为CPU核数*2
        1. 默认值 0
        1. 不支持在线修改
    1. THREAD_STACK_SIZE
        1. 取值范围：（KB(512) ~ MB(64))
        1. 默认值：1024K


###   [4.2 YCS内存管理（不确定是否需要做）](#42-ycs内存管理不确定是否需要做)  

```
1. ICS层接收线程与YCS的消息处理线程之间通过消息队列传递，传递的过程中需要分配内存
2. 创建work任务时需要分配内存
3. 消息通过work处理完成后将内存失败。

如果此处不用memPool做内存管理，直接从操作系统分配内存。
此处内存管理不只是针对YCS消息收发，如果需要做内存池化需要调整整个YCS中内存的使用。

```

###   [4.3 YCS引入workpool基础模块](#43-ycs引入workpool基础模块)  

```
1. 在YCS主线程中处理YCS之间的网络消息，将消息放入到workPool中处理
2. workPool中work的数量由MAX_WORKERS参数决定
3. 每个work的线程栈大小由参数 THREAD_STACK_SIZE参数决定
4. workPool 对象挂载在ClusterManager 对象下，生命周期与clusterManager一致。

```

###   [4.4 YCS多节点（4节点）节点启停](#44-ycs多节点4节点节点启停)  

前置条件：（YFS,YASDB需要支持4节点启停）

目前资源已支持，YCS也支持四节点正常启停，无额外开发工作量

###   [4.5 YCS多节点（4节点）故障处理](#45-ycs多节点4节点故障处理)  

前置条件：（YFS,YASDB需要支持4节点故障）

YASDB支持四节点故障需求转测中。

目前只是大体流程描述，具体细节不在此处展开。

####   [4.5.1 YCS主节点异常](#451-ycs主节点异常)  

```
1. 备YCS 发现主 YCS ICS 网络心跳异常断链，触发Disconnect event

2. 备YCS 会去检查主YCS节点的磁盘心跳是否异常 

3. 发现主磁盘心跳也超时时，会将主YCS 的Topo信息置为OFFLINE，并刷新Vote模块的可见列表为false，并发起选举

4. 其他存活的节点发现选举正在选举，会跟随发起选举的节点进入选举线程  

5. 选举结束后 新主以主身份运行，备机就以备身份运行（即加入集群）

```

####   [4.5.2 YCS备节点异常](#452-ycs备节点异常)  

```
1. 主YCS发现备YCS 的ICS网络心跳异常断链时，触发Disconnect event

2. 主YCS会去将其（包括资源等）踢出集群，并广播最新的topo 

```

####   [4.5.2 YCS 选举过程中旧主的处理方式](#452-ycs-选举过程中旧主的处理方式)  

```
1. YCS旧主在Topo信息中保持的旧主，在选举模块中的主节点是无效值，保持到选举成功后，刷新新主。

2. YasDB的在Topo信息中保持的是旧主.（无DB存活节点时，DB的主节点ID为255）

3. Yasfs的主节点在Topo信息中保持的也是旧主信息（无法将YFS的主节点置成无效值，YFS底层有拦截，如果旧主是255会core;与YFS对过，YFS内部无法处理旧主为255的场景）。

```

####   [4.5.3 YCS资源监控优化](#453-ycs资源监控优化)  

##   [5.未来规划](#5未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

有一个极端场景下的处理是否合理，待讨论：就是所有集群中所有的节点只有主节点被网络隔离的场景下，其余所有备节点之间是正常网络通畅此时主节点会将所有的备机置为下线处理，会导致所有的备机会去重启加入主机。

优化点可以参考ORACLE一个节点无法访问多数派的VF时做重启的概念，当主节点超过多数派的备节点异常时且这些备节点的磁盘心跳都正常的场景下，主机降备且发起重选，让多数派的小集群中的节点当选主节点

##   [6. 会议纪要](#6-会议纪要)  

概要设计评审会议记录：

1. ORACLE RAC 多进程架构深入研究
1. 梳理资源对YCS下发信息强依赖关系梳理
1. 多线程处理机制变动，每个启动一个节点后申请一个线程，并单独处理改节点的消息。
1. 内存池也暂时应该暂时用不上，先简化考虑
1. 配置参数取消。
1. 就是所有集群中所有的节点只有主节点被网络隔离的场景下，其余所有备节点之间是正常网络通畅 此时主节点会将所有的备机置为下线处理，会导致所有的备机会去重启加入主机。（单独需求处理，无法避免双主的场景处理-Trump


## Attachments:

## Comments:

|  [](null)  ,1、选举进行中，topo如何处理，这个时候ycs master、yfsmaster、dbmaster分别是什么？旧的还是无效值？,2、关于内存管理：有哪些新增的内存需要管理？,3、多节点故障场景需要考虑复杂场景，比如：1是master，1不能写磁盘心跳，1和2网络隔离，3不能写磁盘心跳，4正常,4、dfx能力需要有关于  WORKPOOL 问题的能力,  
,  
,Posted by liyin at 十二月 16, 2023 19:16|
|---|
|  [](null)  ,概要设计评审会议记录：    
  1. ORACLE RAC 多进程架构深入研究    
  2. 梳理资源对YCS下发信息强依赖关系梳理    
  3. 多线程处理机制变动，每个启动一个节点后申请一个线程，并单独处理改节点的消息。,4. 内存池也暂时应该暂时用不上，先简化考虑    
  5. 配置参数取消。    
  6. 就是所有集群中所有的节点只有主节点被网络隔离的场景下，其余所有备节点之间是正常网络通畅 此时主节点会将所有的备机置为下线处理，会导致所有的备机会去重启加入主机。（单独需求处理，无法避免双主的场景处理-Trump,Posted by lijing at 十二月 19, 2023 10:44|
