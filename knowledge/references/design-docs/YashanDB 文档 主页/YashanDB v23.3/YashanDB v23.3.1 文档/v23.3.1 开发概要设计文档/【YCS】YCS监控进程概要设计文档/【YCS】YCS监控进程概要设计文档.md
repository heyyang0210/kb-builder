Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

*IR链接：YDBRD-XXXX*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#1-%E6%80%BB%E8%BF%B0)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

**共享集群**  下。因为YCS和YFS之间有  **强相关的耦合**  关系，且两个模块共存于一个进程内。出了  **难以调节**  的问题（比如进程挂起导致的短暂双主问题等）就需要监控出手，使得进程（强制）重启从而避免数据写坏。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

*调研文档：*    [oracle rac看护进程调研报告](/pages/createpage.action?spaceKey=YAS&title=oracle+rac%E7%9C%8B%E6%8A%A4%E8%BF%9B%E7%A8%8B%E8%B0%83%E7%A0%94%E6%8A%A5%E5%91%8A)  

由调研文档中我们可以看出。因为Oracle基于多进程多层次的管理，每个进程各司其职，形成了一套自上而下层级比较分明的管理体系。

而我们目前来说比较扁平，只有YCS（YFS）与DB的管理关系两层，引入高层次的监控管理体系要根据我们自身特有的架构去设计。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

**功能属性**  ，需要遵循等价类正交划分的原则，考虑完备的拆分成多个子功能，每个子功能可以单独转测和上线，达到主体功能支撑IR到SR的拆分目的。

**非功能质量属性的理论知识指导，斜体内容正式文档可删除**

*（1）性能指系统的响应能力，即要经过多长时间才能对某个事件做出响应，或者某段时间内系统所能处理的事件个数。*     **例如执行表达式和算子类的特性需求，如果不选要给出充分理由。**

*（2）可用性指系统能够正常运行的时间比例。经常用两次故障之间的时间长度或出现故障时系统恢复正常的速度来表示。*     **例如OM、YCS等节点管理的特性需求，如果不选要给出充分理由**

*（3）可靠性是软件系统在应用或系统错误面前，维持软件系统的功能特性的基本能力。*     **例如主备、容灾、存储等的特性需求，如果不选要给出充分理由**

*（4）可测试性指通过测试揭示软件缺陷的容易程度。*     **特性如果不易观察时，要考虑增加DFX视图或者增加告警等手段**

*（5）安全性指系统在向合法用户提供服务的同时能够阻止非授权用户使用的企图或拒绝服务的能力。*     **例如协议、驱动、访问控制、通讯、加密等特性需求，如果不选要给出充分理由**

*（6）易用性指关注对用户来说完成某个期望任务的容易程度和系统所提供的用户支持的种类。*     **如何提升用户体验**

*（7）可修改性指能够快速地以较高的性价比对系统进行变更的能力。*     **后续追加特性的开发容易程度**

*（8）兼容性指特性开发是否向前兼容，是否涉及升级。*

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
|YCS和YCS_MONITOR之间实现握手建连|考虑类似DB和YCS之间的  UDS连接  ，把超时时间带过来|是|是|  
|
|  
|YCS和YCS_MONITOR之间实现本地心跳|考虑把本地心跳和磁盘心跳放在一起写|是|是|  
|
|  
|YCS内部写心跳线程剥离|考虑把磁盘心跳和网络心跳线程拆成两个独立线程|否|是|  
|
|  
|YCS_MONITOR与YASOM的适配|YASOM要负责看护YCS_MONITOR|是|是|需要OM适配|
|  
|YCS_MONITOR需要监听YCS|YCS_MONITOR需要实现监听线程|是|是|  
|
|  
|YCS_MONITOR可以实现配置是否主动拉起YCS|需要配置文件，也许可以配置AUTO_START，监听端口|否|是|  
|
|  
|YCS_MONITOR需要记录关键信息|需要关键日志记录，引入日志系统|否|是|  
|
|性能|性能场景1|该方案暂不考虑性能|是/否|是/否|----|
|  
|性能场景2|----|是/否|是/否|----|
|可用性|恢复场景|最终都可以恢复到一个可用的状态|是|是|----|
|可靠性|故障场景|----|是/否|是/否|----|
|可维可测|DFX功能1|----|是/否|是/否|----|
|  
|DFX功能2|----|是/否|是/否|----|
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
|YCS_MONITOR|本篇设计需要实现的YCS的监控|无|原创名|


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


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    监控与YCS以及YASOM之间的关系

和Oracle相似，YASOM可以配置monitor去监控YCS_MONITOR，YCS_MONITOR去监控YCS。

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    YCS_MONITOR如何实现与YCS之间的连接

连接方面可以参考目前YCS已经实现的DB与YCS之间建连的模式UDS。监听方面有两种方案可选。

#### 4.2.1 方案一

按层级架构来说的话。由YCS_MONITOR来监控YCS的，YCS_MONITOR启动UDS监听线程，由YCS来和它建立连接。

#### 4.2.2 方案二

按代码适配性来说，因为YCS上已经实现了一套监听机制用于监听ycsctl工具和db，再加一个YCS_MONITOR的话代码改动量较小，但不符合层级关系，需要看此连接是否有其他判断用途。

#### 4.2.3 额外考虑的一些点

1. UDS断连能否作为YCS掉线的依据，马上重新拉起。一般来说，YCS自重启也是不切断网络相关的。
1. 如果1能成立，是否不需要以pid为依据去守护ycs进程，亦或是也引入此机制，双重保险。


###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    YCS进程本地心跳

根据Oracle Rac的本地心跳这一机制。考虑新增YCS通过UDS连接定期向YCS_MONITOR发送本地心跳。

#### 4.3.1 发送本地心跳的间隔时间

根据YCS发磁盘心跳和网络心跳的时间，目前是100ms一个轮询，本地心跳可参考这个时间。

#### 4.3.2 发送本地心跳的方式

本地心跳发送的线程和磁盘心跳同属一个线程。

###   [4.4 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    YCS_MONITOR如何感知网络心跳的超时时间

目前的想法是不感知YCR相关，只与YCS交互，YCS在与YCS_MONITOR首次握手时，把网络超时时间带过去。

###   [4.5 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    YCS在部分不可自己解决的场景，需要自杀

可能会导致主备切换形成短暂双主的场景，需要识别。原来的软件方案均改为自杀（先杀掉DB，再自杀）

###   [4.6 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    需要看护掉线的YCS节点

如果确定YCS已经掉线的话，结合4.5中的场景，需要把它拉起重新加入集群恢复工作。方法大致有如下2种。

#### 4.6.1 方案一

YCS_MONITOR在与YCS首次握手了之后，收到YCS发来的自己的pid信息，并启动轮询监控线程对这个pid做一定的看护，如果pid不存在，则尝试拉起ycs。

#### 4.6.2 方案二

YCS_MONITOR在与YCS断连后认为YCS已经掉线，且一段时间内无重连请求，则可作为ycs掉线（或者hang住）的依据。具体怎么配合还要详细打开。

###   [4.7 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)    本地心跳

YCS每隔特定的时间，比如1s，会向YCS_MONITOR写本地心跳（类似DB和YCS之间的gettopo），并记录时间，作为轮询时间的监控进程判断超时的依据。

###   [4.8 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    需要看护可能挂起的YCS节点

YCS_MONITOR需要一个轮询的线程去查看上一次写下的本地心跳的时间，并与计时器时间做对比，若超过超时时间则认为YCS已经磁盘心跳超时，若为原主且pid存在，则kill -9后重启。

###   [4.9 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    需要解决的YFS短暂双主的问题

#### 4.9.1 经典场景

这种是近期解决问题中最常见的场景。比较经典的场景有：

1. 磁盘心跳卡住，原主重启流程中停YFS卡住，导致双主
1. 原主YFS写盘前kill -19，备机YFS升主，kill -18原主YFS，导致双主


#### 4.9.2 解决方案

1. 或者YCS自己检查到自己是主并且被驱逐时，自杀，可以解决上述的情况1
1. 原主完全挂住且备机升主的情况，证明已经发生了FENCE，此时如果pid还存在则理论上本地超时时间已经超时，可以通过上述4.8场景的做法进行看护。


###   [4.10 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    监控和YCS的启动流程

#### 4.10.1 方案一

新增命令ycsctl start/stop monitor。

启动：

ycsctl start ycs&功能不变。新增ycsctl start monitor去启动监控。

监控先启动，ycs后启动。可配置监控的auto_start去选择是否需要在启动monitor的时候就启动ycs，但不作为是否监听的依据。

停止：

正常停ycs的时候会发信息给YCS_MONITOR让它取消监控行为。

#### 4.10.2 方案二

不新增命令。

启动：

ycsctl start ycs&改为启动YCS_MONITOR，再由YCS_MONITOR去启动YCS。

停止：

先停YCS，再停YCS_MONITOR，会发信息给YCS_MONITOR让它取消监控行为。

###   [4.11 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    本地日志模块

YCS_MONITOR在每次接收到本地心跳的时候都应该打日志。

YCS_MONITOR心跳监控线程若发现心跳时间异常也需要打中途的日志。

###   [4.12 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

1. **监控进程考虑和下毒机制配合。**
1. **监控进程需要与YASOM适配。**


##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,也许进程或者线程没有挂住，监控可能需要读投票盘检查驱逐（或者找节点要最新的磁盘信息）的情况，如果有卡住的情况可以根据时间也把节点kill -9 ,Posted by duyuxuan at 五月 14, 2024 14:52|
|---|
|  [](null)  ,在发现被驱逐的时候，改成自杀的情况（并自杀DB）。,YASOM可配置。YCS_MONITOR必须部署。层级为YASOM-YCS_MONITOR-YCS,Posted by duyuxuan at 五月 14, 2024 17:25|
|  [](null)  ,启动流程的变更需要描述一下，测试会感知，ycsctl start ycs是先拉起ycs_monitor然后再由ycs_monitor拉起ycs,Posted by liuyuyun at 五月 16, 2024 15:52|
|  [](null)  ,增加看护进程后，如果同时用kill -19把ycs和ycs_monitor挂起，然后恢复，需要ycs_monitor能识别并立刻杀掉ycs，而且ycs_monitor需要每隔1秒写一次本地日志文件，便于通过日志分析ycs_monitor没有正常工作的情况。,Posted by liuyuyun at 五月 16, 2024 15:59|
|  [](null)  ,1.MONITOR对YCS单方面监控。没ack。,2.YCS_MONITOR后续考虑root权限设置。可能可以支持管理多个YCS。,3.YCS_MONITOR认为自己在就可以处理所有的情况。,4.考虑正常停止YCS的时候吧YCS强制停掉。,Posted by chenjunjie at 五月 16, 2024 18:11|
|  [](null)  ,今天会议结论：,1.MONITOR对YCS单方面监控。没ack。    
  2.YCS_MONITOR认为自己在就可以处理所有的情况，暂时不考虑reboot操作系统的情况。    
  3.详细设计文档中用表格形式把yascs和YCS_MONITOR的kill -19/kill -18、kill -9组合的支持情况、预期结果写清楚（包括同时kill -19 yascs和YCS_MONITOR，超时后再同时kill -18，yascs要能够kill掉重启）    
  4.yascs启动时，要求YCS_MONITOR必须存在，否则报错    
  5.这个IR完成两个SR，一个是io保护增强（    [https://pingcode.yasdb.com/pjm/items/6611a8c3579a3edb84d86119?），一个是IPMI，IPMI暂时不提SR](https://pingcode.yasdb.com/pjm/items/6611a8c3579a3edb84d86119?），一个是IPMI，IPMI暂时不提SR)      
    [https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af68](https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af68)    ?    
  #YASHAN-24 集群脑裂IO保护增强,om需要做的工作    
  1、适配启动、停止 ycs_monitor 的命令    
  2、删除对yascs的监控，增加对ycs_monitor的监控,后期需要考虑的问题：    
  1、YCS_MONITOR考虑root权限设置，可能可以支持管理多个YCS。    
  2、考虑正常停止YCS的时候如果停不掉，把YCS强制停掉    
  3、一个YCS_MONITOR管理多个yascs    
  4、ycs选举算法，是否采用多数派存活原则，后续再讨论,Posted by duyuxuan at 五月 20, 2024 11:44|
