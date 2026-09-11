Created by 陈俊杰, last modified by  李垠 on 十一月 08, 2024

*IR链接：*    [集群版本故障处理优化](https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af6d?%0A#YASHAN-29%20%20%E9%9B%86%E7%BE%A4%E7%89%88%E6%9C%AC%E6%95%85%E9%9A%9C%E5%A4%84%E7%90%86%E4%BC%98%E5%8C%96%20%EF%BC%88RTO%E7%9B%AE%E6%A0%87%EF%BC%89)  

*SR链接：*    [YDBRD-27745 : YCS故障仲裁策略优化方案设计](https://pingcode.yasdb.com/pjm/items/664c1f49288e1978208f8865?%0A#YDBRD-27745%20YCS%E6%95%85%E9%9A%9C%E4%BB%B2%E8%A3%81%E7%AD%96%E7%95%A5%E4%BC%98%E5%8C%96)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#1-%E6%80%BB%E8%BF%B0)  

多节点故障场景下YCS无法确保仲裁结果的最优性，尤其是网络隔离时，YCS的主节点会根据自身的网络可见列表决定最终幸存的子集群，而备节点则没有发起投票的权力，导致极端场景下仅一个主节点存活、其他备节点被全部踢出。

本需求针对上述场景进行优化，预期优化后的仲裁和选举流程能找到最优的子集群（节点数量更多、有旧主、节点ID更小及其他）。

*注：最优子集群的确切标准将在需求交付后完善到设计文档的规格项，在讨论阶段以节点数量更多、有旧主、节点ID更小为标准*

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

提高故障场景下产品可用性和竞争力。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

RAC集群重配置    [调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=156135632)  

kill block    [调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=153002152)    ：  针对此前YCS执行节点驱逐时遇到的问题  （主变更、主异常、选举过程中无主、自身尚未加入主时，如何辨别自身被驱逐）的解决方案

**方案对比**

|对比项|RAC集群件|YCS|差异|
|---|---|---|---|
|信道|主要依赖网络消息完成成员关系确认和选举     驱逐时依赖投票盘上的kill block|主要依赖投票盘的可访问性完成成员关系确认和选举   ,网络可见列表从其他子模块获取，过程中并无网络消息的直接收发|网络 vs 磁盘|
|流程|异常确认》,子集群内选出仲裁节点》,仲裁节点确认自身子集群最优、驱逐劣势子集群并更新集群成员、选主、广播》,幸存节点启动reconfig线程》,与新集群的成员建立连接，进行无效资源清理》|异常感知》,发起投票并等待所有节点参与选举》,选出TELLER节点》,TELLER节点选出最优子集群、驱逐劣势子集群并选主》,幸存节点升主或加入主》|每个子集群一个仲裁节点 vs 每轮选举一个TELLER节点|
|超时时间|将磁盘心跳超时时间区分为LDTO和SDTO，即重配置过程中，已丢失网络心跳的节点磁盘心跳超时的判定时间变得更短     SDTO = misscount - reboottime|投票过程中要求每个节点在MIN( NETWORK_TIMEOUT, DISK_HB_KEEP_ALIVE)内完成磁盘心跳的更新，否则认为该节点异常|  
|


  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

在两节点下发生网络隔离时，每个节点对应一个子集群，子集群的节点数总是对等的因此哪个子集群有旧主哪个子集群优先幸存，因而导致只有主节点异常时才会触发选举，一旦有主了就变成单方面的驱逐。

这一做法延续到了四节点版本，在网络隔离时的仲裁结果不合理。

集群仲裁需要选出最优子集群，驱逐劣势子集群，并在最优子集群内选出新主。即，集群仲裁不仅关心谁是主谁是备，更关心谁是集群的合法成员。过程中可能旧主仍然存活，但不属于最优子集群。

**为实现以上，需：**

1. 实现驱逐劣势子集群的能力
1.     - 投票盘新增集群块（cluster block），记录选举结果和驱逐信息
    - TELLER和主节点可写
    - 所有节点的投票线程定期读，集群块数据不合法时备节点报错，主节点修复；数据合法且自身被驱逐时自杀

1. 调整选举算法的选主逻辑
1.     - 每轮选举仅一个TELLER，决定哪个子集群幸存以及谁是主由TELLER完成，因此只需修改TELLER需要做什么，并不涉及对如何选出TELLER（选举算法的主体）的大量调整
    - CANDIDATE在胜出后成为TELLER前，需等待所有节点参与选举，除非已有某个一定能胜出的子集群产生（子集群成员数大于等于集群总节点数的一半）
    - TELLER选出幸存子集群和新主后，将选举、驱逐结果写到集群块；新主升主前读集群块并等待被驱逐节点全部自杀或超时

1. 投票模块注入的等待时间参数变更
1.     - 选举算法依赖投票盘的可访问性且此前仲裁的触发条件是磁盘心跳超时，因此一直注入的DISK_HB_KEEP_ALIVE；但考虑到投票盘卡顿引起的误仲裁并不少见，目前推荐配置已改为60，成倍大于NETWORK_TIMEOUT
    - 需求方案将在网络隔离场景下也触发选举，投票模块注入的等待时间需要修改



  


**需求引入的其他影响：**

|分类|项|内容|原因|  
|
|---|---|---|---|---|
|对外表现|RTO|- 正常场景和普通异常场景下（yascsm正常工作）下不线性延长RTO，只引入常数项；
- 极端异常场景（yascsm异常，如1是主，reboot {234}）时多引入一个磁盘心跳超时时间；
|若yascsm正常工作，异常场景下yascsm能监控并拉起异常的ycs，ycs重启后版本号会发生变化，其他节点可感知，能大幅减少仲裁流程的等待时间|  
|
||网络隔离场景的预期|- 由主节点优先存活变为最优子集群存活
- 子集群最优的标准见规格约束
|提升可用性|  
|
|兼容性|集群升级兼容性|涉及投票盘结构调整，不影响集群离线升级|YCR盘数据升级前导出，投票盘数据升级时格式化|  
|
|周边配合|ycsdump工具|同步调整ycsdump工具|  
|  
|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|故障点|待补充|  
|是|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|待补充关键定位日志|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

|约束项|类型|内容|备注|
|---|---|---|---|
|网络连通一定是双向的|规格|单向的网络连通也被视为网络不可达|网络异常事件（如网络心跳超时）的感知可能有时差，在某一时刻可能出现单向的连通|
|子集群网络连接是完全图|规格|子集群内所有节点都彼此网络可达，形成完全图|YCS和YFS强调主备通信，备备断连是可接受的，但对集群数据库而言会影响业务；因此备备断连也会把集群划分为两个子集群；RAC亦如此|
|子集群的最优性|规格|节点数量更多>有旧主>节点ID更小|在最优子集群内选主时，选举优先级>节点ID更小|
|极端场景集群块可能被覆写|规格|投票盘上的数据是动态数据，被覆写是可恢复的；且正常  节点读取集群块时会根据一些字段做校验，主节点也会定期写集群块并及时恢复集群块的合法性，因此不会造成致命异常|集群块并非某个节点专属，一旦旧主在写集群块之前被hang住直到超时，新主产生后旧主被恢复，则会导致集群块被覆写；可提供故障点进行测试验证|
|磁盘心跳超时时间与网络心跳超时时间的大小关系|规格|无大小关系的约束，但选举过程中要求节点在最短的超时时间内响应投票|当集群已在仲裁中，有更高的条件概率认为MIN(网络心跳超时， 磁盘心跳超时)时间内未响应选举的节点已异常|
|集群块只是节点驱逐的软件方案|约束|集群块与scsi、ipmi等硬件能力属于同类接口，但无法保证极端场景下集群不双主、数据盘不双写|  
|
|潜在的、尚未形成的更优子集群无法接管已形成的劣势子集群|约束|类似场景受限于YCS实例启动流程，当前的实现要求一个节点先找到主，再与主建立网络连接，后加入主并获取topo与其他成员建立网络连接，导致一旦与主网络隔离，实例就无法启动，更无法发现其他潜在的子集群成员；    
    
  未来YCS启动后若加入集群失败可能不退出实例，而是进入游离的实例状态，在此状态下不启动资源，不停尝试与其他可能的节点建立网络连接，当形成一个更优子集群时，挑战已形成的子集群并接管|举个例子：假设{1} 与 {234}隔离，当{1}已启动并成为主，{2}{3}{4}稍后再启动时，由于无法与{1}建立网络连接，会认为实例启动失败而退出；理想情况是{2}{3}{4}能形成一个3成员的更优子集群并接管{1}，但这种接管似乎会有服务不可用的真空期|
|仲裁结果可能不尽准确|约束|YCS的仲裁流程不涉及直接的网络消息确认，网络可见性由其他子模块维护，导致投票时TELLER收集的信息往往是不准确的，可能造成连续仲裁，严重时可能造成劣势子集群幸存；    
    
  ICS的监控线程和YCS的投票线程分别以1000ms和50ms的时间间隔进行轮询，两者不在一个数量级，监控线程的异常上报存在秒级误差，投票线程却往往在百毫秒内完成仲裁。|举个例子：假设{1}、{2}与{34}网络隔离，预期{34}能幸存，但低概率会出现节点3已感知到12节点网络异常，但4未感知，导致3触发选举后，TELLER会认为仅仅是3与12网络隔离，选择让更优的{124}幸存而非{34}。再过几百毫秒，等节点4意识到12节点网络异常时已孤立无援，最终仅节点1作为旧主幸存    
    
  此场景可通过调大投票线程的轮询时间间隔来降低发生概率，从50ms调整至500ms，能大幅降低仲裁不准确的发生概率；但根因仍然存在，属于方案本身存在的缺点|


  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#4-%E7%89%B9%E6%80%A7)  

### 4.1 集群块（承担kill block的功能）

![](https://pingcode.yasdb.com/atlas/files/public/67396ecea1ad9a3311dc9a08/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUlnQUFnQUJBQUFBRUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFvQUFBRUFBZ0lBSUFBVUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUlBQUFCQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwNzEsImV4cCI6MTc4MjQ0OTg3MX0.RXGmrqbnpE2v_k4pnRHEPq63YRDg58VENTbX_AnMC4s)

1. 定义
1.     - 新增的block被称为YcsClusterBlock（集群块），其中的evictee记录了被驱逐的节点相关信息，termInfo用于校验集群块中的信息是否合法
    - 概念上与RAC有差异，用YCS更普遍使用的evict一词替换kill
    - YCS整个集群一个集群块，而RAC每个节点一个kill block

1. 位置
1.     - 集群块是集群公有的，位于投票盘起始处，其他block的偏移向后移

1. 读写规则
1. 数据结构和函数接口
1. 关键流程——检查集群块判断是否被驱逐
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ece8970c2af4f521b95/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUlnQUFnQUJBQUFBRUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFvQUFBRUFBZ0lBSUFBVUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUlBQUFCQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwNzEsImV4cCI6MTc4MjQ0OTg3MX0.RXGmrqbnpE2v_k4pnRHEPq63YRDg58VENTbX_AnMC4s)
1. ### 4.2 仲裁流程
1. ##### 4.2.1 选举算法大致流程
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ece8970c2af4f521b96/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUlnQUFnQUJBQUFBRUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFvQUFBRUFBZ0lBSUFBVUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUlBQUFCQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwNzEsImV4cCI6MTc4MjQ0OTg3MX0.RXGmrqbnpE2v_k4pnRHEPq63YRDg58VENTbX_AnMC4s)
1.     - CANDIDATE何时能成为TELLER
        - step至少领先其他节点2步
        - 已参与选举的节点优先级高于未响应选举节点 ——> 所有已启动节点都参与选举且跟随或等待超时
        - 超时： MIN(NETWORK_TIMEOUT, DISK_HB_KEEP_ALIVE)
    - TELLER做什么
        - 读盘，将所有节点block内投票相关信息加载到内存
        - 依据每个节点是否部署和启动、是否在集群内、是否参与选举，将所有节点分类为invalid、uninvolved、pending、clustered
        - 根据每个节点的网络可见列表和节点类型，划分出所有子集群
        - 在所有子集群中筛选最优子集群并得到节点驱逐列表
        - 在最优子集群内选出新主
        - 写盘并通知cm模块
        - ![](https://pingcode.yasdb.com/atlas/files/public/67396ece8970c2af4f521b97/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUlnQUFnQUJBQUFBRUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFvQUFBRUFBZ0lBSUFBVUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUlBQUFCQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwNzEsImV4cCI6MTc4MjQ0OTg3MX0.RXGmrqbnpE2v_k4pnRHEPq63YRDg58VENTbX_AnMC4s)
    - 数据结构和函数接口

1.   

1. ##### 4.2.2 仲裁总体流程
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ecea1ad9a3311dc9a09/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBUUlnQUFnQUJBQUFBRUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFvQUFBRUFBZ0lBSUFBVUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUlBQUFCQUFBQUFBQUFBQUFBQVFBQUJBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzkwNzEsImV4cCI6MTc4MjQ0OTg3MX0.RXGmrqbnpE2v_k4pnRHEPq63YRDg58VENTbX_AnMC4s)
1.   

    1. 仲裁的入口
    1.         - 任意两个节点间网络心跳超时或断连，触发选举
        - 任意节点磁盘心跳超时，触发选举
        - 集群无主、主节点退出集群，触发选举
        - 备节点加入退出集群由主节点直接处理

    1. 仲裁的结果
    1.         - 正在加入集群的节点不被选为主（除非所有节点都并发启动中）
        - 未参与选举、不在幸存子集群内的节点被驱逐
        - 新主产生前，集群topo不变；新主产生后，更新topo



|分类|场景/角色|规则|原因|
|---|---|---|---|
|写|TELLER|TELLER处理完本轮选举后，将选举结果和驱逐列表写到集群块|  
|
||主节点已升主|已升主的节点在读集群块发现集群块数据损坏或被覆写时，用内存中的数据修复集群块|  
|
||主节点接纳被驱逐重启后的备节点加入|无需更新集群块|  
|
|读|任意节点正常运行过程中|投票线程每隔100ms读一次集群块,若集群块数据合法，则检查自身是否被驱逐；    
  若集群块数据不合法，备节点仅报错；已升主的主节点会尝试修复,  
|  
|
||备节点加入主过程中|流程中不检查，投票线程在后台持续检查|  
|
||主节点升主过程中|检查集群块有效性，若失效，触发新一轮选举；若有效，读到内存并等待被驱逐节点自杀或超时|  
|


```
typedef union UnYcsClusterBlock {
    struct {
        YcsHealthCheck healthCheck;  // 同盘备份校验和
        
        CodUint8  isInited : 1;      // block是否初始化
        CodUint8  unused : 7;
        
        CodUint8  master;            // 维护此集群块的主节点
        CodUint16 masterVer;         // 维护此集群块的主节点的节点启动版本
        CodUint32 term;              // 维护此集群块的主节点的任期
​
            // evictMap不是survivorMap的补集，除了这两类还包括无效节点和异常重启过的节点
        CodUint64 evictMap;                      // 64位bitMap，表明对应位的节点是否被驱逐
			CodUint64 survivorMap;                    // 64位bitMap，表明对应位的节点是否在最优子集群幸存
        CodUint16 evictVersion[YCS_MAX_NODES];   // 记录对应位的节点被驱逐时刻的节点启动版本
    };
    CodChar     data[YCS_BLOCK_SIZE];
} YcsClusterBlock;

// 集群块在主节点升主时被加载到内存的masterCtx中
typedef struct StYcsMasterCtx {
    YcsCluCtrl cluCtrl;
} YcsMasterCtx;

// 打印集群块关键字段
CodVoid ycsPrintClusterBlock(YcsClusterBlock* cluBlock);
// ycs服务端读集群块，接口在多盘版本后有差异
CodResult ycsReadClusterBlock(CodDisk* disk, CodChar* diskBuf, CodBool readOnly, CodBool* isBroken);
// ycs客户端读集群块
CodResult ycscReadClusterBlock(CodDisk* disk, CodChar* diskBuf, SpinLock* lock, CodBool* isBroken);
​
// ycs服务端检查主机是否被驱逐，如果当前节点是主，会在集群块损坏时尝试修复
CodResult ycsCmCheckHostEviction(YcsClusterMngr* mngr);
// ycs客户端检查主机是否被驱逐
CodResult ycscCheckHostEviction(YcscDiskHBCtx* context, CodUint8 selfNodeId, CodBool* isEvicted);
​
// teller根据选举结果，落盘到集群块
static CodResult ycsFormClusterBlock(YcsVoteManager* voteManager, YcsElectContext* context);
// 新主升主前等待被驱逐节点自杀或超时
static CodVoid waitNodeEvictionAndOnGoingWrite(YcsClusterMngr* mngr);
```

```
typedef struct StYcsVoteSmartData {
    CodUint8  isInited : 1;
    CodUint8  isOpen   : 1;
    CodUint8  inCluster : 1;
    CodUint8  broken : 1;
    CodUint8  reserve : 4;
    CodUint8  priority;
    CodUint8  unused[6];
    CodUint64 beatNo;
    CodUint64 visibleMap;
} YcsVoteSmartData;

typedef struct StYcsVoteTicket {
    // voting info
    CodUint32 votingTerm;
    CodUint16 step;
    CodUint16 selfVer;

    // vote result
    CodUint32 term;
    CodUint16 masterVer;
    CodUint8  newMaster;
    CodUint8  unused;
} YcsVoteTicket;

typedef struct StYcsVoteInfo {
    YcsVoteTicket vote;       // filled by vote kernel
    union {
        YcsVoteSmartData ycs;  // filled by ycs elect adapter
    };
} YcsVoteInfo;
​
typedef struct StYcsSubCluster {
    CodUint8  smallestNode;       // 子集群最小的节点ID
    CodBool   hasPriorMaster;     // 是否有旧主
    CodBool   hasExpected;        // 是否有EXPECTED类型节点
    CodUint8  unused[5];
    CodUint64 memberMap;          // 成员
} YcsSubCluster;
​
typedef enum EnYcsElectStat {
    YCS_ELECT_INVALID = 0,    // undeployed, uninited, stopped or killed long time ago
    YCS_ELECT_UNINVOLVED,     // in cluster but not in vote when process Teller
    YCS_ELECT_PENDING,        // not in cluster but in vote
    YCS_ELECT_EXPECTED,       // in cluster and visible but not in vote when deciding readyToTell or not
    YCS_ELECT_CLUSTERED,      // in cluster and in vote
} YcsElectStat;

// Candidate/Teller的局部变量，处理完后部分信息落盘
typedef struct StYcsElectContext {
    CodBool        pendOnly;      // 是否仅有pending及以下类型节点
    CodUint8       subCluCnt;     // 子集群数量
    CodBool        isTeller;      // 是否是teller，会影响处理流程对UNINVOLVED和EXPECTED类型节点的划分
    CodUint8       unused[5];
    YcsSubCluster* best;
    YcsSubCluster  subClusters[YCS_MAX_NODES];     // 64个节点一一成群时最多仅64个子集群
    YcsElectStat   statList[YCS_MAX_NODES];
    CodUint64      evictMap;
    CodUint16      evictVersion[YCS_MAX_NODES];
} YcsElectContext;
​
// ycs_elect文件对外提供的唯一接口，即获取适配层的回调函数
CodVoid ycsElectGetVoteCallbackSet(YcsVoteProfile* profile);

// 为节点类型分类并找出所有子集群，CANDIDATE和TELLER可调用
// 当是CANDIATE，网络双向可见、心跳未超时、term未落后但未参与选举的节点被视为EXPECTED类型
// 当是TELLER，任何在集群中但未参与选举的节点都被视为UNINVOLVED类型
// 子集群中的每个节点都是彼此双向可见的，形成完全图
CodVoid ycsDetectSubClusters(YcsVoteManager* mngr, CodUint32 votingTerm, YcsElectContext* context)
​
// 筛选最优子集群，输出节点驱逐列表
CodVoid ycsSurviveBestSubCluster(YcsVoteManager* mngr, YcsElectContext* context)
​
// 在最优子集群内，根据节点优先级、节点ID大小，选择新主
CodVoid ycsSelectMaster(YcsVoteManager* mngr, YcsElectContext* context)
​
```

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

#### 5.1 功能用例集

  [【YDBRD-27745】功能测试用例](/pages/createpage.action?spaceKey=~chenjunjie&title=%E3%80%90YDBRD-27745%E3%80%91%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E7%94%A8%E4%BE%8B)  

  [【YDBRD-27745】YCS仲裁策略优化 -- 测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=162994201)  

#### 5.2 典型场景

待整理场景和典型案例

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

集群服务高可用——投票仲裁

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=150605305#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


**待讨论内容**

|讨论点|典型场景|方案一|方案二|对比|备注|
|---|---|---|---|---|---|
|网络可见但未参与选举的节点能否作为子集群的有效成员|{1}和{2，3}网络隔离的同时，3被kill -19一小段时间或超时|能，一个子集群内只要有一个节点参选，那么它可见列表内的节点无论参与选举与否，都认为存活     会选择{2，3}幸存，甚至可能选3为新主，若3被kill -19超时，则会引起新一轮仲裁|不能，要求子集群内所有节点都参选，否则认为未参选的节点不存活，它也在该子集群的可见列表里失效     若3仅kill -19一小段时间，方案二能够容忍这种卡顿并选择{2，3}幸存；若3被挂到超时，方案二会选择{1}幸存|方案一的结果可能不准确，代价是多轮仲裁、错误仲裁,方案二的结果更准确，但一定会引起RTO时间的延长，例如reboot备机,倾向于方案二，因为,1. 叠加故障一旦发生，多轮仲裁本身也是RTO的一部分
1. 部分场景下无需等到超时，例如已有某个一定能胜出的子集群产生
1. yascsm能看护异常ycs并重新拉起，其他节点能感知到异常ycs的节点启动版本变化从而得知无需等待该节点
|  
|
|驱逐流程细节（考虑谁驱逐劣势子集群、驱逐的时机等）|{1}和{2，3}网络隔离的同时，1被kill -19几秒，1被驱逐的同时再次被kill -19|~~1.1 TELLER先确定幸存子集群，后执行劣势子集群的驱逐，等待被驱逐节点都退出或重启后或超时后，再选出新主~~,1.2 TELLER先确定幸存子集群，后执行劣势子集群的驱逐，无需等待驱逐结果直接选出新主，新主升主前等待被驱逐节点都退出或重启后或超时|TELLER确定幸存子集群后直接选出新主，新主在升主前执行劣势子集群的驱逐，等待被驱逐节点都退出或重启后或超时后，升主|方案一会导致有两类节点写kill block，引入一定的复杂度；   ,方案1.1在某些场景下可能导致选举超时触发新的选举，且teller也可能被驱逐，自己等待自己自杀会导致逻辑混乱,方案二仅master写kill block，逻辑上更简单，但master不一定是teller，只有teller能在选举阶段决定谁驱逐谁幸存，因此让master来执行劣势子集群的驱逐存在信息传递的问题   ,方案1.2避免了1.1的选举超时问题，比较合理|RAC的仲裁流程更符合方案1.1|
|读kill block的时机|  
|投票线程定期检查（100ms）|所有读盘接口都检查    
|kill block是软件方案，检查再频繁也无法确保一定不双写，因此方案二没有必要，倾向于方案一|RAC类似方案一，仅写磁盘心跳的线程每秒检查一次|
|投票模块注入的等待时间|  
|DISK_HB_KEEP_ALIVE|MIN(NETWORK_TIMEOUT, DISK_HB_KEEP_ALIVE)|方案一是旧有规格，原因在于,1. 投票的入口往往是主节点磁盘心跳超时
1. 投票的信道是磁盘
,方案二借鉴了RAC的做法，原因在于,1. RAC和YAC在实际部署时，磁盘心跳超时往往大于网络心跳超时
1. 在集群正常运行时，每个节点能容忍更长的磁盘IO卡顿，但在集群已经发生异常的前提下，要求每个节点在更短的超时时间内响应具有合理性
|  
|
|备节点磁盘心跳超时怎么处理|  
|主节点直接驱逐，若主节点也异常，则在因主节点异常引起的仲裁中同时完成该异常备节点的驱逐|触发选举流程|方案一是既往的做法，并无什么不妥,方案二是向rac的对齐，且能够将所有故障的处理方式统一为选举和仲裁流程；,倾向于方案二，这样所有故障的处理流程都统一了|RAC类似方案二  （    [11g R2 RAC: NODE EVICTION DUE TO MISSING DISK HEARTBEAT - ORACLE IN ACTION](http://oracleinaction.com/eviction-disk-heartbeat/)    ）|


  


**工作量评估**

|类型|工作项|人天|时间节点|
|---|---|---|---|
|设计|设计文档和调研|5|7/25|
|设计|开发设计评审|  
|7/29|
|开发|实现驱逐劣势子集群的能力|2|  
|
|开发|调整选举算法的选主逻辑|2|8/2|
|自测|UT|0.5|  
|
|自测|功能用例的手动测试|6|测试和开发一起投入的话，8/8之前转测|


  


  


## Attachments:

[仲裁流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2Q4OTcwYzJhZjRmNTIxYjkxIiwicmVmX2lkIjoiNjczOTZlY2Q3MjgyMDZlZmI5MmYyZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM5MDcxLCJleHAiOjE3ODI1MjU0NzF9.peZKRdqMkANeRCpVfi6Fv83gBk5Qw4IiNe3Xkn_-kI8)

 (image/png)    


[仲裁流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2Q4OTcwYzJhZjRmNTIxYjkyIiwicmVmX2lkIjoiNjczOTZlY2Q3MjgyMDZlZmI5MmYyZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM5MDcxLCJleHAiOjE3ODI1MjU0NzF9.ErWBDEXXXfb3-nbrmYXDsMbp0NxpsJyfqnd3aj2nXeI)

 (image/png)    


[仲裁流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2VhMWFkOWEzMzExZGM5YTA0IiwicmVmX2lkIjoiNjczOTZlY2Q3MjgyMDZlZmI5MmYyZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM5MDcxLCJleHAiOjE3ODI1MjU0NzF9.9NoC2s9SJNaq9xUXKCNp_-8YmhK9NFFgshs_o-LLyZw)

 (image/png)    


[仲裁流程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlY2VhMWFkOWEzMzExZGM5YTA3IiwicmVmX2lkIjoiNjczOTZlY2Q3MjgyMDZlZmI5MmYyZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM5MDcxLCJleHAiOjE3ODI1MjU0NzF9.9n2HJitz-xYzVpnR0dI5at8VbpyiOAEfi-R6b4kIwIY)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要    
  1、选举时候选者需等待所有节点参与选举或超时才能成为teller，未参与选举但在某个子集群可见列表内的节点不被视为该子集群的有效成员    
  2、TELLER选出幸存子集群和新主后将选举结果和驱逐列表写到集群块，新主升主前读集群块并等待被驱逐节点全部自杀或超时    
  3、集群块由投票线程定期检查    
  4、投票过程中的等待时间是否优化为MIN(NETWORK_TIMEOUT, DISK_HB_KEEP_ALIVE)存在争议    
  5、备节点超时是由主节点直接处理还是由统一的仲裁流程处理存在争议,Posted by chenjunjie at 七月 30, 2024 11:42|
|---|
