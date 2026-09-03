Created by 马志宏, last modified on 十一月 15, 2024

概要设计-  YASHAN-985  ：备集群支持所有实例只读

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b329](https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b329)    ?    
  #YASHAN-985 【主备集群】主备集群支持备集群只读能力

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#1-%E6%80%BB%E8%BF%B0)  

目前备集群只有master实例处于open状态， 其他备实例都是处于nomount状态，约束较大，用户体验和竞争力差。

![image.png](https://pingcode.yasdb.com/atlas/files/public/673af40b8970c2af4f53b510/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFnQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBSUFBQUFBQUFCZ0FBQUFnUUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBUUFCQUFCZ0FDRUFFQVRBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NzgsImV4cCI6MTc4MjQ2NzI3OH0.BiQOemuD8afkXqEq68YzEW7TWQ-U1ptPW9aodWFhvoM)

1. 单实例open，单实例回放：实现集群容灾基础能力
1. 多实例open，单实例回放：真正意义的备集群，只读能力提升，约束较少
1. 多实例open，多实例回放：备库负载均衡，回放性能提升，竞争力强


 为了实现真正意义的备集群，备集群的非master实例也需要支持启动到open状态， 并支持只读操作。



###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求描述：

- 主备集群产品形态下， 支持备集群所有实例可读


需求规格：

- 集群HA容灾备集群只读能力，需要保证同步复制主备之前数据一致性，异步复制不做要求（最终一致性）；
- 主备集群内部各个实例之间数据要一致；
- 支持所有实例只读


交付版本：

- v23.4


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [(783) YASHAN-985 支持备集群所有实例可读调研文档 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/673c4f80593f99c9ff26ba2e)  



###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

基于目前主集群和备集群各自独有的特点， 需要从以下几个维度去进行需求设计：

|属性|场景|分析|
|:---|:---|:---|
|功能|数据一致性|涉及多实例数据一致性的模块主要是：Buffer，事务，元数据，Ctrl,Buffer：与主集群相同，通过GRC获取页面,事务  ：与主集群  **不同**  ，备集群是master回放所有事务，推进SCN，需要设计新的机制保证多实例读一致性,DC：与主集群  **不同**  ，DDL日志在备master串行回放，回放后需要广播通知其他实例,Ctrl：与主集群  **不同**  ，表空间操作在主集群上是全部操作完成后，一次性广播；在备集群上，每回放一个表空间日志就需要广播|
|功能|主备切换|switchover：主集群的非master不需要重启到nomount， 直接修改角色； 备集群所有实例同时升主，OM无需将非master实例open。,failover：备集群所有实例同时升主，OM无需将非master实例open。|
|可用性,可靠性|reform|因为所有的脏页在备集群的master上，所以reform机制与主集群有较大差异：,- 非master宕机，reform只需做GRC恢复
- master宕机后，新master的reform流程需要:
,1. 回放  **所有实例的redo**  ，托管所有实例的事务区
1. 不能无限制分析redo，需要定义redo  **分析结束点**  ，这个结束点要大于等于原master宕机时的回放点
1. 因为不知道原master的精确回放点，可能会多回放redo，打破了CURRENT页面版本最新的原则，需要特殊处理
1. 备库新master接收redo和reform可以并行，避免最大保护主库事务长时间卡住
|
|性能|回放性能|备集群master在回放时，需要广播SCN和回放进度，可能会对回放性能有影响。需要设计异步通知机制消除，使回放性能不劣化。|
|可维可测|视图|备集群回放进度，回放性能|
|  
|DFX功能2|----|
|安全|当前需求不涉及|无|
|兼容性|当前需求不涉及|无|
|周边配合|安装部署|OM适配备集群实例全部open|




###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口类型|接口说明|
|:---|:---|:---|
|alter database mount/open|SQL|备集群所有实例可以mount和open|
|alter database switchover|SQL|备集群所有实例可以执行switchover|
|alter database failover|SQL|备集群所有实例可以执行failover|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

### 约束

- 备集群只有master实例可以接收和回放redo。
- 备集群普通实例与主库没有连接，依赖于主备通信的部分功能无法在备集群普通实例启动（如YStream）。
- 备集群failover升主之后，在升主前产生的脏页刷盘完成前，master挂了，整个集群将会重启。
- 备集群switchover，需要先等待旧主脏页全部刷盘（属于现有约束继承）。


**注：上述约束属于技术约束，不属于产品约束， 这些约束在后续多实例并行回放的需求中会被解除。**

### 规格

- 备集群所有实例可以open。
- 备集群所有实例可读，支持瞬时一致性。
- 备集群多实例Open回放性能与单实例Open回放性能相同。
- 备集群failover RTO < 3s （下发failover到failover执行结束）


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#4-%E7%89%B9%E6%80%A7)  

**备集群架构图**

![image.png](https://pingcode.yasdb.com/atlas/files/public/673ae8a48970c2af4f53b4f9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFnQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBSUFBQUFBQUFCZ0FBQUFnUUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBUUFCQUFCZ0FDRUFFQVRBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NzgsImV4cCI6MTc4MjQ2NzI3OH0.BiQOemuD8afkXqEq68YzEW7TWQ-U1ptPW9aodWFhvoM)

- master接收和回放所有实例redo，推进所有实例Checkpoint，托管所有实例事务区
- 非master支持只读，不产生脏页，不执行Checkpoint，不维护自己的事务区


###   [4.1 数据一致性](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#41-gcs)  

备集群形态下， 影响数据一致性的主要有4个方面：  **Buffer访问**  ，  **事务可见性**  ，  **元数据同步**  ，  **Ctrl同步**  。

####   [4.1.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#42-ddl%E5%90%8C%E6%AD%A5)  Buffer访问

备集群的buffer访问逻辑和主集群基本没有差异，都是通过cohesive memory。在master上既有读又有写，普通实例上只有读。唯一的不同是，所有脏页都是master刷盘，所以普通实例拉取页面后，不能设为脏页。

####   [4.1.2 事务](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#43-%E8%A1%A8%E7%A9%BA%E9%97%B4%E5%90%8C%E6%AD%A5)  

**事务区托管**

备集群是master回放所有实例的事务，那么事务页面都在master实例修改。·事务状态获取是访问内存里的事务区，非master实例上的事务区没法与事务页面进行同步。

所以master需要托管所有事务区。其他实例查询事务状态，需要向master发送消息。

这个类似于主集群上单个实例跑业务，其他查询事务状态也都会走消息通道。

对普通备实例上的查询性能有影响，需要看能不能将已提交事务的状态广播给所有实例，优先从本地查询事务状态，这样主集群和备集群查询性能都能提升。

**可见性**

备集群由master回放事务，回放commit后事务状态立刻可见。如果回放完成后直接更新和广播SCN，因为SCN广播有延迟，在多实例查询时可能会出现不一致。

为此要引入主集群事务的incommit机制，在master回放完事务后设为incommit=TRUE，阻塞事务状态查询。等SCN广播给所有实例后，再将incommit设为FLASE。

这样就能保证所有备实例查询的瞬时一致性。

**SCN同步**

目前主集群SCN同步的场景如下：

|场景|同步方式|备集群是否涉及|
|:---|:---|:---|
|事务提交|刷redo前通知后台线程异步广播ankGetScn到所有实例，redo刷完后，等ack；其他实例收到后调ankLamportScn|不涉及|
|事务访问查询|事务访问时双边同步； 实例1查询实例2的事务，查询时带了本实例的scn， 实例2收到后同步scn， 返回时也带上事务上的scn， 实例1收到事务信息时同步scn|备集群不需要，由回放同步|
|CR页面请求|owner在发送CR页面时同步requester带过来的查询scn；requester收到页面时同步owner带过来的scn|备集群不需要，由回放同步|
|current页面请求|所有owner同步requester带来的scn，requester收到页面同步owner带来的scn|备集群不需要，由回放同步|
|reform期间加锁放锁|reform，grc latch加锁与放锁时， 所有实例同步master实例的scn|备集群在reform时保持同样的行为|
|集群备份期间获取rcyBegin、flushpoint|集群备份期间获取rcyBegin、flushpoint向所有实例广播同步scn|备集群暂时不支持备份，故没有这个场景|
|主集群DDL串行|DDL事务结束时所用实例同步scn|备集群没有事务结束操作|
|DDL元数据同步|同步元数据时需要同步SCN|备集群回放DDL前，要等所有实例同步SCN|


备集群SCN同步与回放事务相关，但是为了不影响回放性能，需要做两个优化：

1. 不要在回放commit后，广播SCN并死等ACK
1. 后台定时广播SCN，回放commit后可以立刻唤醒广播


![](https://pingcode.yasdb.com/atlas/files/public/67396eee8970c2af4f521c7b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFnQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBSUFBQUFBQUFCZ0FBQUFnUUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBUUFCQUFCZ0FDRUFFQVRBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NzgsImV4cCI6MTc4MjQ2NzI3OH0.BiQOemuD8afkXqEq68YzEW7TWQ-U1ptPW9aodWFhvoM)

注：由于实例之间SCN和LSN不保序，所以可能出现SCN大的事务先回放，SCN小的后回放，因此需要用所有实例中最小的SCN去广播全局SCN。



####   [4.1.3 DC同步](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#43-%E8%A1%A8%E7%A9%BA%E9%97%B4%E5%90%8C%E6%AD%A5)  

主集群在reform在线恢复阶段，会通过DDL的apply函数进行DC同步，也就是DC同步逻辑已经写在对应apply函数里实现，只不过备库回放时会跳过。

因此备集群回放DDL可以说天然支持， 只需增加相应的标志， 让其进行DC同步即可。

此外，在回放DDL的日志前，需要强制等待SCN同步给所有备实例，保证DDL日志前提交的事务都可见。

####   [4.1.4 Ctrl同步](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#43-%E8%A1%A8%E7%A9%BA%E9%97%B4%E5%90%8C%E6%AD%A5)  

涉及Ctrl同步的，主要有表空间和Redo文件操作。与主集群不同的是，备集群每个日志都要做ctrl同步，而主集群是一系列操作（比如建表空间，会产生一个create tablespace+多个create datafile的日志）完成后，一次性同步。

其中，表空间日志同步主要涉及的操作有：

- 修改控制文件
- 失效数据文件
- 修改datafile、space manager内存


  [**同步修改控制文件**](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#431-%E5%90%8C%E6%AD%A5%E4%BF%AE%E6%94%B9%E6%8E%A7%E5%88%B6%E6%96%87%E4%BB%B6)  

为了保证一致性，同步修改控制文件大概流程如下所示：

![控制文件同步.png](https://pingcode.yasdb.com/atlas/files/public/673c73788970c2af4f53b5e1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFnQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBSUFBQUFBQUFCZ0FBQUFnUUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBUUFCQUFCZ0FDRUFFQVRBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NzgsImV4cCI6MTc4MjQ2NzI3OH0.BiQOemuD8afkXqEq68YzEW7TWQ-U1ptPW9aodWFhvoM)

1. 在回放ctrl相关的日志之前，先给其他实例内存打上标记，标记master即将回放日志的日志类型
1. 在回放ctrl相关的日志之后，通知其他实例重载ctrl文件，以及内存修改，然后删除标记
1. 如果master实例在修改控制文件期间挂了， 那么新的master通过标记，进行重新reloadCtrl，进行同步。


注：其他实例可能处于mount阶段，此时ctrl同步逻辑要单独考虑

####   [4.1.5 ](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#43-%E8%A1%A8%E7%A9%BA%E9%97%B4%E5%90%8C%E6%AD%A5)  过渡方案演进分析

本需求（  多实例open，单实例回放  ）是过渡方案，所以需要分析一下数据一致性设计，对后续  **多实例回放架构的影响**  分析：

|类别|**多实例open**|多实例回放|对比结论|
|:---|:---|:---|:---|
|事务区托管|master托管所有实例的事务区|各实例维护自己的事务区,master额外托管宕机实例的事务区|本质是一样的：回放redo的实例，托管redo所有者的事务区,所以该设计基本  **可继承**  ，可在此基础上做适配，不会推倒重来|
|可见性|incommit机制保证所有实例读一致性|incommit机制保证所有实例读一致性|该设计  **可继承**  ，无需大改|
|SCN同步|master实例给其他实例广播SCN|各实例将回放进度上报给master，master实例进行统一广播|基本  **可继承**  ，可在此基础上做适配|
|DC同步|master串行回放DDL辅助日志，apply函数中同步DC|master协调各实例串行回放DDL辅助日志，apply函数中同步DC|该设计  **可继承**  ，无需大改|
|Ctrl同步|master串行回放Ctrl相关日志，先打标记，然后在apply函数中同步Ctrl|master协调各实例串行回放Ctrl相关日志，先打标记，然后在apply函数中同步Ctrl|该设计  **可继承**  ，无需大改|




###   [4.2 主备切换](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#47-switchover-%E5%92%8C-failover)  

主备切换主要考虑switchover和failover。

####   [4.2.1 switchover](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#471-switchover)  

- 主在降备时，非master不需要重启到nomount，全量checkpoint完成后，直接修改角色即可。
- 主降备之后的master实例要托管所有实例的事务区， 同时非master实例要取消自己的事务区。
- 备集群的master升主之后， 通知其他实例升主， 如果其他实例升主失败后直接重启到open； 同时升主之后，master实例要取消已经托管的事务区， 其他实例自己加载事务区。
- 非master实例执行switchover，需要转发给master实例。


####   [4.2.2 failover](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#472-failover)  

- master实例修改角色之前， 要取消对已经open实例的事务区的托管。
- master实例升主之后， 通知其他实例进行升主， 如果其他实例升主失败， 直接重启到open；同时升主之后，master实例要取消已经托管的事务区， 其他实例自己加载事务区。
- 非master实例执行failover，需要转发给master实例。




为了快速对外提供服务， failover不需要等checkpoint做完， 直接可以升主提供服务，在备集群单实例open的情况下没有什么问题

但是多实例open时存在一个问题， 就是升主之后再checkpoint还没做完之前， master实例发生了故障， 其他实例变成master之后做reform， 此时的reform比较复杂：

1. 需要分析旧master实例(备)所有实例的redo
1. 还要分析升主之后新产生的redo


这处理起来很复杂， 即使能处理， 但是后续多实例并行回放时，该方案也是临时方案，可能会推翻重写。 

为了暂时规避上述场景，   **这里做了一个临时约束方案， 及failover升主之后，如果checkpoint还没做完， master实例发生故障， 新master将所有实例进行重启， 进行crash recover。**

![failover.png](https://pingcode.yasdb.com/atlas/files/public/673c742c8970c2af4f53b5e3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFnQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBSUFBQUFBQUFCZ0FBQUFnUUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBUUFCQUFCZ0FDRUFFQVRBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NzgsImV4cCI6MTc4MjQ2NzI3OH0.BiQOemuD8afkXqEq68YzEW7TWQ-U1ptPW9aodWFhvoM)



####   [4.2.3 过渡方案](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#473-%E8%BF%87%E6%B8%A1%E6%96%B9%E6%A1%88%E5%AF%B9%E6%AF%94%E6%8F%8F%E8%BF%B0)  演进分析

switchover和failover有一些相似之处， 而且该需求的一些设计方案为过渡方案， 将来在多实例并行回放会有新的设计方案，过渡方案描述以及对比如下

|类别|**多实例open**|多实例回放|对比结论|
|:---|:---|:---|:---|
|switchover降备|主降备时需要等全量的checkpoint做完|不需要等，降备之后可以继续做|后续多实例回放  **支持后不存在该问题**  。目前主要受备集群master实例推点限制，即使该需求中对此做了优化设计，也是个  **临时方案，且工作量不小**  。,在后面的多实例并行回放中也需要推翻重新设计，故该需求暂时不考虑swtichover的加速，  **保持现状**,规避措施：提高Checkpoint频率可以降低switchover耗时|
|switchover降备|主降备后，master实例需要托管所有非master实例的事务区|各自加载|本质是一样的：回放redo的实例，托管redo所有者的事务区,因此基本  **可以继承**|
|switchover、failover升主|备升主之后， 所有实例各自加载自己的事务区|各自加载|master集中托管是一个过渡方案，但该方案  **工作量不大**,后续多实例回放  **重构代价小**|
|switchover、failover升主|升主之后，master上既有其他实例的脏页，又有升主后产生的脏页。,此时如果master实例故障了，那么在线恢复设计方案降比较复杂，需要分析备集群期间所有实例的redo， 还需要分析挂了实例的redo。,为了解决这一问题， 如果在升主之后master挂了， 将直接做集群重启|因为备库各实例回放自己的redo，所以脏页也是自己的，master故障和非master故障没区别，不存在该问题|后续多实例回放  **支持后不存在该问题**  。如果对此做优化，还是  **临时方案，且工作量不小**  。,考虑到failover执行后短时间内master宕机的概率很小，目前先  **加约束**  ，master宕机后所有实例需重启|




###   [4.3 reform](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#45-reform)  

reform过程主要有实例启动、实例停止、实例故障， 在结合实例角色，主要有以下场景

|场景|角色|需求设计|
|:---|:---|:---|
|实例启动|master|无|
|实例启动|非master|支持启动到open（不能加载自己事务区）；open过程中需要阻塞master回放DDL和Ctrl日志回放，保证元数据和ctrl加载一致性|
|实例正常停止|非master|实例可正常停止，退出集群 ；shutdown过程中需要阻塞master回放DDL和Ctrl日志回放，保证元数据和ctrl一致性|
|实例正常停止|master|新的master实例能够接收主集群的redo并进行回放， 新master做完reform之后， 即可启动回放线程做回放|
|实例故障|非master|master实例进行reform，只做grc资源恢复，不做在线恢复（相当与主机群非abort）|
|实例故障|master|新master实例进行reform、grc资源恢复、在线恢复；,新master在redo分析阶段需要分析所有实例的(包括自己)；,实例被选为master之后便可以启动redo接收线程进行接收redo；,reform结束后， 启动回放线程回放主集群redo， 同时托管所有实例的事务区。|


对于以上场景， reform过程中有两个特别注意的事项：

- redo分析结束点
- 分析阶段CURRENT页面处理


#### 4.3.1 reform过程redo分析结束点

主集群上，reform时直接把宕机实例的redo回放完毕就行。但是备集群的redo会持续不断地接收，并且其他实例无法精确知道，master宕机时回放到什么位置了。

因为效率问题，备集群reform不能把所有redo回放完，也不能少回放redo。reform结束点的设计：

1. master回放redo是一批一批回放的
1. 在回放开始前，将待回放redo的结束点（End Point），同步给所有实例
1. reform的时候，将End Point作为分析结束点


这样一定不会少回放日志，但是可能会多回放

####   [4.3.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#452-reform%E8%BF%87%E7%A8%8Bredo%E5%88%86%E6%9E%90%E9%98%B6%E6%AE%B5)  分析阶段CURRENT页面处理

由于备集群redo分析阶段，可能会多回放日志。这种情况下，我们需要分析和解决以下两个问题：

1. 加锁阶段current页面的获取
1. 页面死锁问题


#####   [加锁阶段current页面的获取](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#%E5%8A%A0%E9%94%81%E9%98%B6%E6%AE%B5current%E9%A1%B5%E9%9D%A2%E7%9A%84%E8%8E%B7%E5%8F%96)  

在主集群上，CURRENT页面一定是最新的，在redo分析和回放时会跳过。但是备集群reform时，就存在  **多回放日志**  的情况，此时  **CURRENT不一定是最新的**  ，在线恢复时可能还会修改成更新的版本。

修改CURRENT页面，就需要对CURRENT页面加锁，和主集群获取CURRENT页面的差别如下图所示。

![current.png](https://pingcode.yasdb.com/atlas/files/public/673da6e7a1ad9a3311de34a1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBSUFBQUFBQVFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFnQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBSUFBQUFBQUFCZ0FBQUFnUUFBQUFBQUFBQUFBQUFBQUFFQVFBQUFBQUFBUUFCQUFCZ0FDRUFFQVRBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NzgsImV4cCI6MTc4MjQ2NzI3OH0.BiQOemuD8afkXqEq68YzEW7TWQ-U1ptPW9aodWFhvoM)

特别注意：

1. 发current页面， 不需要加锁， 可以直接搜索BufferCtrl进行拷贝页面内容。
1. 如果current页面持有了读锁长时间不放， 为了不阻塞reform进行， 可以先对BufferCtrl做个标记（后续会话获取到BufferCtrl，如果有这个标记，不可用）， 等detach时，直接release掉BufferCtrl（refcount=0），主要是避免后续会话继续用一个旧版本的页面。
1. 如果发生二次故障， 在grc资源恢复中， 扫描bufferPool时， 遇到有上述标记的BufferCtrl， 此时不需要注册到master。


#####   [页面死锁问题](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#%E9%A1%B5%E9%9D%A2%E6%AD%BB%E9%94%81%E9%97%AE%E9%A2%98)  

该场景主要是考虑页面嵌套锁， 然而在线恢复的页面访问没用bpAttachBlock接口， 所以不会出现死锁的问题。

####   [4.3.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#452-reform%E8%BF%87%E7%A8%8Bredo%E5%88%86%E6%9E%90%E9%98%B6%E6%AE%B5)  reform与redo接收

新master执行reform的第一步，就是启动日志接收线程，接收日志。因为接收的日志一定是redo分析结束点之后的，所以不影响reform流程。

redo接收和reform可以同时进行，这样可以大大减少最大保护模式下，主库事务阻塞的时间。



###   [4.4 性能](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#48-%E6%80%A7%E8%83%BD)  

|影响因素|需求方案|解决方案|
|:---|:---|:---|
|CR构建|备集群的CR构建只能访问事务页面，不能访问事务区|现有方案与主集群单实例执行写，其他实例读的情况一样。,性能影响不大，保持现状。  
|
|回放一批日志前，给其他实例广播日志点|必须等到ACK才可以开始回放|并行回放分两个阶段，先分析再回放,分析和回放也是并行的，分析完后，上一批回放可能还没结束，需要等,所以可以在分析完后广播日志点，广播完成后，再等待上一批日志的回放结束，基本上不会影响回放速率|


### 4.5 特性可维可测设计

1. 动态视图：
1.     - V$INSTANCE：显示实例OPEN状态。
    - V$RECOVERY_STATUS：显示所有实例Redo回放进度，状态。
    - v$archive_dest_status：主库连接状态。
    - v$replication_status：备库连接状态。
    - 新增x$redo_manager_info: 显示redo manager上的所有内存值，用于调式和定位问题。
    - 新增x$recovery_manager_info: 显示recovery manager上的所有内存值，用于调式和定位问题。



### 4.6 特性周边配合

OM：

1. 主备集群部署：备集群build完后，需要open其他实例
1. switchover，failover：升主之后，OM不需要发起OPEN命令给非master实例


Ystream：

1. YStream启动需要和主库通信，备集群非master实例上启动会失败，需要加约束


备集群备份（开发中）：

1. 备库备份开始时需要给主库发消息
1. 备份过程中需要和表空间日志回放互斥
1. 计划是先加约束，只能在备集群master实例进行备集群备份




## 5.安全性

本次设计只涉及主备切换的内部逻辑以及reform流程的修改，不涉及SQL查询、文件读写、命令执行和进行网络操作，不涉及身份验证、授权、访问控制、加密机制和审计机制等安全功能的调整，安全攻击面未变化，不存在被仿冒、篡改、否认、信息泄露、拒绝服务、权限提升等风险。经评估，本次改动无新增安全风险。



## 6.工作量评估

|模块|工作量|责任人|  
|
|---|---|---|---|
|事务管理|2人周|龙忠友|14人周，1个SR，分两个AR开发,  [https://pingcode.yasdb.com/pjm/items/67072fb0e489dd0868f335c5?](https://pingcode.yasdb.com/pjm/items/67072fb0e489dd0868f335c5?)  ,#YDBRD-33687 【主备集群】主备集群支持备集群只读能力|
|元数据同步|2人周|龙忠友||
|reform|4人周|龙忠友||
|回放逻辑优化|2人周|马志宏||
|主备切换适配|2人周|马志宏||
|性能优化|2人周|龙忠友||
|OM适配|2人周|瞿蓝孟|  [https://pingcode.yasdb.com/pjm/items/67074bfbe489dd0868f39058?](https://pingcode.yasdb.com/pjm/items/67074bfbe489dd0868f39058?)  ,#YDBRD-33789 【主备集群】OM适配备集群实例全部open|


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=177849539#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

- 备集群多实例并行回放
- 备集群多实例接收Redo
- LSN与SCN合并


## Attachments:

[控制文件同步.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWU4OTcwYzJhZjRmNTIxYzc5IiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDc4LCJleHAiOjE3ODI1NDI4Nzh9.r58gtFbldeBz0aZIXjlgVl-OM8jFCcwVqFAJLAo8s_8)

 (image/png)    


[image2024-11-15_10-55-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWU4OTcwYzJhZjRmNTIxYzdhIiwicmVmX2lkIjoiNjczOTZlZWU1OTNmOTljOWZmMjM4YjEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDc4LCJleHAiOjE3ODI1NDI4Nzh9.yfDaI73Y3qbeqslkVGE0c2BgiSg8qaMPoN1ttarLqQw)

 (image/png)    
