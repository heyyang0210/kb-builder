Created by 杜宇轩, last modified on 六月 07, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af68](https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af68)    *?*    
  *#YASHAN-24 集群脑裂IO保护增强*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6611a8c3579a3edb84d86119](https://pingcode.yasdb.com/pjm/items/6611a8c3579a3edb84d86119)    *?*    
  *#YDBRD-25875 IO脑裂保护增强——YCS*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#1-%E6%80%BB%E8%BF%B0)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

**共享集群**  下。因为YCS和YFS之间有  **强相关的耦合**  关系，且两个模块共存于一个进程内。出了  **难以调节**  的问题（比如进程挂起导致的短暂双主问题等）就需要监控出手，使得进程（强制）重启从而避免数据写坏。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

*调研文档：*    [oracle rac看护进程调研报告](https://conf.yasdb.com/pages/viewpage.action?pageId=153005754)  

由调研文档中我们可以看出。因为Oracle基于多进程多层次的管理，每个进程各司其职，形成了一套自上而下层级比较分明的管理体系。

而我们目前来说比较扁平，只有YCS（YFS）与DB的管理关系两层，引入高层次的监控管理体系要根据我们自身特有的架构去设计。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|进程掉线可拉起恢复|pid检测，若离线，执行启动命令|是|是|----|
|  
|进程挂起可杀死重启|若长期未收到本地心跳，超过超时时间，则Kill -9进程，执行启动命令|是|是|----|
|  
|原有异常的FENCE场景，原主|原主原来抛脑裂重启的地方改为abort，且kill -9 db（或者shutdown abort)|是|是|  
|
|  
|YCS和YCS_MONITOR之间实现握手建连|考虑类似DB和YCS之间的UDS连接，把超时时间带过来|是|是|  
|
|  
|YCS和YCS_MONITOR之间实现本地心跳|考虑把本地心跳和磁盘心跳放在一起写|是|是|  
|
|  
|YCS_MONITOR与YASOM的适配|YASOM要负责看护YCS_MONITOR|是|是|需要OM适配|
|  
|YCS_MONITOR需要监听YCS|YCS_MONITOR需要实现监听线程|是|是|  
|
|  
|YCS_MONITOR可以实现配置是否主动拉起YCS|需要配置文件，也许可以配置AUTO_START，监听端口|否|是|本次不做|
|  
|YCS_MONITOR需要记录关键信息|需要关键日志记录，引入日志系统|否|是|本次酌情做|
|  
|YCS需要监听YCS_MONITOR发来的停止请求|YCS上原有的监听线程新增监听YCS_MONITOR|是|是|  
|
|性能|RTO场景|因为处理故障的流程有变化，RTO场景需要跑一下|是/否|是/否|----|
|  
|性能场景2|----|是/否|是/否|----|
|可用性|除Monitor有问题|最终都可以恢复到一个可用的状态|是|是|----|
|可靠性|kill -9 YCS|可看护拉起|是|是|----|
|  
|kill -19 YCS|可强杀重启|是|是|  
|
|可维可测|ycsctl start ycs&|能力上多启动一个monitor进程，测试/用户实际不感知|是|是|----|
|  
|ycsctl stop ycs|可以正常停掉两个进程，测试/用户实际不感知|是|是|----|
|安全|安全场景1|----|是/否|是/否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|----|----|是/否|是/否|----|
|周边配合|权限|----|----|是/否|----|
|周边配合|审计|----|----|是/否|----|
|周边配合|YASOM|----|----|是/否|----|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|YCSM|本篇设计需要实现的YCS的监控|无|原创名|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

暂无。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#2-%E6%8E%A5%E5%8F%A3)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

缺点：

1. 我们和Oracle的本身层级架构不同。YCS和YFS在一个进程内，如果YFS出问题，外源方面只能整个重启。
1. 相比之下Oracle因为多进程的架构，异常恢复会灵活一些。


优点：

1. 我们已经有了比较成熟的YASOM方案。


具体约束：

- 如果要构造看护进程故障的场景，看护进程起到的作用有限或者不起作用，仅支持两种情况，第一：ycsm和ycs同时kill -9， yasboot monit如果配置了负责拉起它们；第二：同时将ycsm和ycs kill -19，备升主后又同时kill -18，仅支持ycs重启，存在一定概率双主
- 只有在部署了yasboot monit的情况下，看护进程没了后才能被拉起，否则不能被自动拉起
- 如果ycs首次启动失败（在握手之前自己abort），则监听握手的线程每隔100ms检测一次yascs是否存在，检测5次不存在，则ycsm自然退出
- YCSM无限次拉起ycs，不设置频度和次数
- YCSM需要等到ycs来握手后才能开始监控，否则一直等待握手
- YCSM离线，ycs尝试重连，不退出
- ycs保存的db pid可能是旧的，再传给ycsm也有延迟，所以使用db pid kill掉db时，可能存在因为pid是旧的而无法杀掉db的情况，这是无法避免的


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    监控与YCS以及YASOM之间的关系

和Oracle相似，YASOM可以配置monitor去监控YCS_MONITOR，YCS_MONITOR去监控YCS。

在我们此次的设计里，YCSM认为可以涵盖住YCS的全部异常行为，本身拥有绝对的自信。

#### 4.1.1 新代理架构

整体的代理架构大致可以抽象为：

![](https://pingcode.yasdb.com/atlas/files/public/67396e948970c2af4f521981/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBUUFBZ0FBRUFBUUFBQUFJQUFBQUFBQkFBQUFJQUFBQUFnQUFBQUFBQUFBQUFBQUFHRkFBQUpBQUJBQkFBRkFBQUFBQVJBQUFRQUFBQUFBQUFBRUNRQUFBQUFBQUFBQUJBQUFnQUFBQ0FBQUFBQUFBQUFBQUNBQUFBSUFBQUFBZ0FBQUFBSkFBQUFBQUFCQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwOTUsImV4cCI6MTc4MjQ0ODg5NX0._rO8VQiGIt0kSus05P4AQbmc6jpgCiySt1CwUYK8QZc)

与原来架构的区别是工具和YCS之间多了一层YCSM。

###   [4.2 YCSM](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    如何实现与YCS之间的连接与监听

连接方面可以参考目前YCS已经实现的DB与YCS之间建连的模式UDS。方便代码复用。

现有架构需要双向可以监听行为。

#### 4.2.1 YCSM监听YCS的心跳

由YCSM来监控YCS的，YCSM启动UDS监听线程，由YCS来和它建立连接。

该监听连接之后为  **长连接**  ，类似DB发信息握手YCS，YCS发握手信息给YCSM。

成功建立连接之后，YCS每隔  **100ms**  给YCSM发送心跳， 并带上本地的时间戳。

如果YCSM收到了  **停止**  命令，则带上停止标志位ack回给YCS，YCS走退出流程。

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    YCS进程本地心跳

根据Oracle Rac的本地心跳这一机制。考虑新增YCS通过UDS连接定期向YCSM发送本地心跳。

本地心跳夹带信息本地时间戳、db的pid，ack会告诉YCS要不要停。

写本地心跳的时候，可以更新上次写磁盘的时间戳，做为自查的依据

#### 4.3.1 发送本地心跳的间隔时间

根据YCS发磁盘心跳和网络心跳的时间，目前是100ms一个轮询，本地心跳可参考这个时间。

#### 4.3.2 发送本地心跳的方式

原打算本地心跳发送的线程和磁盘心跳、网络心跳同属一个线程。

但是实际上本地心跳需要有重连机制，若是连接不成功则势必影响其他两个心跳，与设计初衷违背。

#### 4.3.3 发送本地心跳的线程建立的时机

在YCS启动实例的时候建立ThreadMgr之后，即启动握手和监听。若首次握手失败，则启动失败退出。

#### 4.3.4 重连机制

若首次握手成功，但后续断连无法发送心跳，则该线程无限发重连请求。

###   [4.4 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    YCSM如何感知网络心跳的超时时间

目前的想法是不感知YCR相关，只与YCS交互，YCS在与YCS_MONITOR首次握手时，把网络超时时间和pid带过去。

###   [4.5 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    YCS在部分不可自己解决的场景，需要自杀

可能会导致主备切换形成短暂双主的场景，需要识别。原来的软件方案均改为自杀（先杀掉DB，再自杀）

1. ycs尝试以主节点方式启动但是trysurvive失败时
1. 当备节点尝试加入主节点失败时，检查主节点，发现主节点活着且存在磁盘心跳时
1. 内部重启cm失败时
1. 备机的磁盘心跳监控线程在集群无主时也要做检查，因为在故障叠加场景下，备机可能已经被主机驱逐但备机因为IO卡顿等原因未感知到，而主机已停止了。检查时如果自身节点是上一个主的备机，且topo被设为offline，且startversion与当前运行进程一致。——问题单场景
1. 备机被主机驱逐时
1. 本地心跳线程目前负责发送心跳、重连。并且自查磁盘心跳的结果，如果有问题，abort


###   [4.6 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    需要看护掉线的YCS节点

如果确定YCS已经掉线的话，结合4.5中的场景，需要把它拉起重新加入集群恢复工作。

YCSM在与YCS首次握手了之后，收到YCS发来的自己的pid信息，并启动轮询监控线程对这个pid做一定的看护，如果pid不存在，则直接尝试拉起ycs。

###   [4.7 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    需要看护可能挂起的YCS节点

YCSM需要一个轮询的线程去查看目前内存写下的本地心跳的时间，并与本地时钟时间做对比，若超过超时时间则认为YCS已经磁盘心跳超时，若为原主且pid存在，则kill -9后重启。

###   [4.8 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    监控和YCS的正常启停流程

#### 4.8.1 启动

1. ycsctl start ycs&改为启动YCSM，再由YCSM去启动YCS。
1. YCSM与ycs之间使用UDS通信
1. YCSM启动ycs，先fork出子进程，在子进程中，通过 codExecvp 启动 yascs 进程
1. YCSM与ycs握手时，db还没有启动，而且也不应该依赖db是否启动，所以这个时候无法通过ycs告知YCSM db的pid，这种情况不需要kill -9 db。
1. 日志与yascs在一个目录，位置为 /log/yascsm/run.log
1. kill yasdb时，如果db pid有效，则执行kill yasdb的动作，否则只kill ycs


![](https://pingcode.yasdb.com/atlas/files/public/67396e948970c2af4f521982/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBUUFBZ0FBRUFBUUFBQUFJQUFBQUFBQkFBQUFJQUFBQUFnQUFBQUFBQUFBQUFBQUFHRkFBQUpBQUJBQkFBRkFBQUFBQVJBQUFRQUFBQUFBQUFBRUNRQUFBQUFBQUFBQUJBQUFnQUFBQ0FBQUFBQUFBQUFBQUNBQUFBSUFBQUFBZ0FBQUFBSkFBQUFBQUFCQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwOTUsImV4cCI6MTc4MjQ0ODg5NX0._rO8VQiGIt0kSus05P4AQbmc6jpgCiySt1CwUYK8QZc)

#### 4.8.2 停止

1. ycsctl下发停止消息给YCSM，YCSM监听线程负责监听这个消息。
1. 增加两个标志位，  instanceStop负责控制监听线程给ycs回复停止标志，ycs收到停止消息后做出停止处理；instanceOpen负责控制主循环退出
1. YCSM主循环退出前，要检测yascs是否存在，不存在再退出
1. YCSM主循环退出前需要给ycsctl发响应消息，让ycsctl退出（因为第一步的ycsctl stop ycs在阻塞等待这个回复）
1. 如果ycs停止流程卡住，YCSM会一直等待


![](https://pingcode.yasdb.com/atlas/files/public/67396e94a1ad9a3311dc97f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBUUFBZ0FBRUFBUUFBQUFJQUFBQUFBQkFBQUFJQUFBQUFnQUFBQUFBQUFBQUFBQUFHRkFBQUpBQUJBQkFBRkFBQUFBQVJBQUFRQUFBQUFBQUFBRUNRQUFBQUFBQUFBQUJBQUFnQUFBQ0FBQUFBQUFBQUFBQUNBQUFBSUFBQUFBZ0FBQUFBSkFBQUFBQUFCQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwOTUsImV4cCI6MTc4MjQ0ODg5NX0._rO8VQiGIt0kSus05P4AQbmc6jpgCiySt1CwUYK8QZc)

###   [4.9 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    需要解决的YFS短暂双主的问题

#### 4.9.1 经典场景

这种是近期解决问题中最常见的场景。比较经典的场景有：

1. 磁盘心跳卡住，原主重启流程中停YFS卡住，导致双主
1. 原主YFS写盘前kill -19，备机YFS升主，kill -18原主YFS，导致双主


#### 4.9.2 解决方案

1. YCS自己检查到自己是主并且被驱逐时，自杀，可以解决上述的情况1
1. 原主完全挂住且备机升主的情况，证明已经发生了FENCE，此时如果pid还存在则理论上本地超时时间已经超时，可以通过上述4.7场景的做法进行看护。


###   [4.10 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    本地日志模块

YCSM在每次接收到本地心跳的时候都应该打日志。

YCSM心跳监控线程若发现心跳时间异常也需要打中途的日志。

###   [4.11 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

1. **监控进程考虑和下毒机制配合。**
1. **监控进程需要与YASOM适配。**


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|序号|自测场景|具体步骤|期望结果|其他|
|---|:---|:---|:---|:---|
|1|各种Kill、挂起场景|kill -19 ycs|监控超过超时时间后，强杀掉重启|  
|
|2|  
|kill -9 ycs|监控发现pid掉线，直接拉起|  
|
|3|  
|kill -19 ycs,kill -19 ycs_monitor|这种情况不能恢复|  
|
|4|  
|kill -19 ycs,kill -19 ycs_monitor,再kill -18 ycs_monitor|检查是否超时，若超时，直接强杀重启。若不超时，则等待超时后强杀重启。|  
|
|5|  
|kill -19 ycs,kill -19 ycs_monitor,再kill -18 ycs_monitor ycs|检查是否超时，若超时，直接强杀重启。若不超时，且重连成功，则正常运行。|  
|
|6|  
|kill -19 ycs,kill -9 ycs_monitor|这种情况不能恢复|  
|
|7|  
|kill -19 ycs,kill -9 ycs_monitor,后拉起ycs_monitor|若查询到pid仍存在，则强杀重启。|  
|
|8|正常场景|启动ycs|成功后界面有提示|![](https://pingcode.yasdb.com/atlas/files/public/67396e94a1ad9a3311dc97f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBUUFBZ0FBRUFBUUFBQUFJQUFBQUFBQkFBQUFJQUFBQUFnQUFBQUFBQUFBQUFBQUFHRkFBQUpBQUJBQkFBRkFBQUFBQVJBQUFRQUFBQUFBQUFBRUNRQUFBQUFBQUFBQUJBQUFnQUFBQ0FBQUFBQUFBQUFBQUNBQUFBSUFBQUFBZ0FBQUFBSkFBQUFBQUFCQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwOTUsImV4cCI6MTc4MjQ0ODg5NX0._rO8VQiGIt0kSus05P4AQbmc6jpgCiySt1CwUYK8QZc)|
|9|正常场景|停止ycs|成功后界面有提示|![](https://pingcode.yasdb.com/atlas/files/public/67396e948970c2af4f521983/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBUUFBZ0FBRUFBUUFBQUFJQUFBQUFBQkFBQUFJQUFBQUFnQUFBQUFBQUFBQUFBQUFHRkFBQUpBQUJBQkFBRkFBQUFBQVJBQUFRQUFBQUFBQUFBRUNRQUFBQUFBQUFBQUJBQUFnQUFBQ0FBQUFBQUFBQUFBQUNBQUFBSUFBQUFBZ0FBQUFBSkFBQUFBQUFCQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwOTUsImV4cCI6MTc4MjQ0ODg5NX0._rO8VQiGIt0kSus05P4AQbmc6jpgCiySt1CwUYK8QZc)|
|10|正常场景|并发启动|成功后界面有提示，都能启动成功|![](https://pingcode.yasdb.com/atlas/files/public/67396e94a1ad9a3311dc97f7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBUUFBZ0FBRUFBUUFBQUFJQUFBQUFBQkFBQUFJQUFBQUFnQUFBQUFBQUFBQUFBQUFHRkFBQUpBQUJBQkFBRkFBQUFBQVJBQUFRQUFBQUFBQUFBRUNRQUFBQUFBQUFBQUJBQUFnQUFBQ0FBQUFBQUFBQUFBQUNBQUFBSUFBQUFBZ0FBQUFBSkFBQUFBQUFCQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwOTUsImV4cCI6MTc4MjQ0ODg5NX0._rO8VQiGIt0kSus05P4AQbmc6jpgCiySt1CwUYK8QZc)|
|11|正常场景|并发停止|最开始执行的能成功，后面执行的握手不上，且YCSM日志有对应信息|日志：,![](https://pingcode.yasdb.com/atlas/files/public/67396e94a1ad9a3311dc97f9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQVFBQUFBQUFBQUFBQUFBUUFBZ0FBRUFBUUFBQUFJQUFBQUFBQkFBQUFJQUFBQUFnQUFBQUFBQUFBQUFBQUFHRkFBQUpBQUJBQkFBRkFBQUFBQVJBQUFRQUFBQUFBQUFBRUNRQUFBQUFBQUFBQUJBQUFnQUFBQ0FBQUFBQUFBQUFBQUNBQUFBSUFBQUFBZ0FBQUFBSkFBQUFBQUFCQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgwOTUsImV4cCI6MTc4MjQ0ODg5NX0._rO8VQiGIt0kSus05P4AQbmc6jpgCiySt1CwUYK8QZc)|
|12|故障场景|启动yas monit监控，kill -9 ycsmonitor|ycsmonitor被拉起，能够与ycs握手，握手成功后（日志中打印），kill -9/19 ycs，ycs能够被自动拉起/重启|  
|
|13|故障场景|同时kill -19 ycsmonitor和yascs，备升主后，同时kill -18 ycsmonitor和yascs|yascs和db能够被重启|  
|
|14|故障场景|多次kill -19 yascs|预期yascs和db能够重启，之后停止、启动ycs，功能正常|  
|
|15|故障场景|多次kill -9 yascs|预期yascs和db能够被拉起，之后停止、启动ycs，功能正常|  
|
|16|故障场景|通过故障点模拟ycs不来握手|kill -9 ycs，ycs不会被拉起|  
|
|17|故障场景|重复多次启动、停止ycs|成功|  
|
|18|故障场景|停止ycs过程中发生故障，先kill -19 ycs，再ycsctl stop ycs|报错|  
|
|19|跑RTO|  
|对比CI不劣化|  
|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

新增介绍Monitor和架构相关篇幅。

## 7    [.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. YCSM考虑root权限设置，可能可以支持管理多个YCS。
1. 考虑正常停止YCS的时候如果停不掉，把YCS强制停掉
1. 一个YCSM管理多个yascs
1. ycs选举算法，是否采用多数派存活原则，后续再讨论
1. 考虑后期单独把monitor的起停命令独立开
1. 需要心跳仲裁线程


## Attachments:

[image2024-5-20_17-0-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTNhMWFkOWEzMzExZGM5N2VhIiwicmVmX2lkIjoiNjczOTZlOTI3MjgyMDZlZmI5MmYyOWE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDk1LCJleHAiOjE3ODI1MjQ0OTV9.doI75_In43_mz9kejosNr7nvkOqbF1GLejWkWYCmGaY)

 (image/png)    


[image2024-5-20_19-28-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTM4OTcwYzJhZjRmNTIxOTc2IiwicmVmX2lkIjoiNjczOTZlOTI3MjgyMDZlZmI5MmYyOWE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDk1LCJleHAiOjE3ODI1MjQ0OTV9.4nM7cvaAjqO8OybxYhDqYkOwiA4XjJjGhdaegBaxmcM)

 (image/png)    


[image2024-5-20_19-29-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTM4OTcwYzJhZjRmNTIxOTc3IiwicmVmX2lkIjoiNjczOTZlOTI3MjgyMDZlZmI5MmYyOWE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDk1LCJleHAiOjE3ODI1MjQ0OTV9.rqB4lz-Clycku7PHoSeCYESXF0s0wisoToz6AVjOneA)

 (image/png)    


[image2024-5-21_10-20-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTNhMWFkOWEzMzExZGM5N2VjIiwicmVmX2lkIjoiNjczOTZlOTI3MjgyMDZlZmI5MmYyOWE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDk1LCJleHAiOjE3ODI1MjQ0OTV9.RJQ3UKXilzXq50UKkcDmIjRKhN2mxYRgI9ptWRhiJOw)

 (image/png)    


[image2024-5-21_10-21-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTNhMWFkOWEzMzExZGM5N2VkIiwicmVmX2lkIjoiNjczOTZlOTI3MjgyMDZlZmI5MmYyOWE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDk1LCJleHAiOjE3ODI1MjQ0OTV9.1Y1ivB_rVeE5uIIo2eQsi3evlXoeowVRmHuJccX7Wvw)

 (image/png)    


[image2024-5-21_10-21-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTM4OTcwYzJhZjRmNTIxOTc5IiwicmVmX2lkIjoiNjczOTZlOTI3MjgyMDZlZmI5MmYyOWE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDk1LCJleHAiOjE3ODI1MjQ0OTV9.93PU2N-J9dS9CYkeeKEYflbUu9IPNUOnOUr2uNJP_3w)

 (image/png)    


[image2024-5-21_21-23-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTM4OTcwYzJhZjRmNTIxOTdiIiwicmVmX2lkIjoiNjczOTZlOTI3MjgyMDZlZmI5MmYyOWE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MDk1LCJleHAiOjE3ODI1MjQ0OTV9.o2gXyqdpk5TRbuuPSJoTXGM_oMs6StT0nGspp93K9qc)

 (image/png)    


## Comments:

|  [](null)  ,本地心跳包含哪些内容需要明确。pid、磁盘心跳超时时间、时间戳,Posted by liyin at 五月 20, 2024 20:14|
|---|
|  [](null)  ,ycs启动流程，与ycs_monitor握手、与ycs_monitor重连、发送本地心跳三个流程在启动流程中的位置，用流程图明确下来,Posted by liyin at 五月 20, 2024 20:15|
|  [](null)  ,1.首次启动如果ycs进程不存在就不等待了。ycs_monitor自然退出。,2.统一叫YCSM,3.写本地心跳的时候，可以更新上次写磁盘的时间戳,4.考虑不监听停，停的时候设置标志位，心跳ack回去的时候告诉ycs停,5.本地心跳带当前时间戳发给YCSM,6.本地心跳线程目前负责发送心跳、重连。并且自查磁盘心跳的结果，如果有问题，abort。,7.需要心跳仲裁线程（后期）,8.把上次带来的时间戳的时间和本地时间做对比，超时kill -9,9.心跳内容多加一个db的pid，如果无效值，则不kill db,Posted by duyuxuan at 五月 21, 2024 18:38|
