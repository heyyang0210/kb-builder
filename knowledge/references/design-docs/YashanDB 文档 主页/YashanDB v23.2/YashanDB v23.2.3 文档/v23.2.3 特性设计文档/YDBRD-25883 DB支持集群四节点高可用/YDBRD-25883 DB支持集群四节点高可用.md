Created by 李佐龙, last modified on 四月 30, 2024

#   [DB支持集群四节点高可用](#db支持集群四节点高可用)  

PingCode链接：    [YDBRD-25883 DB支持集群四节点高可用](https://pingcode.yasdb.com/pjm/items/6611a8d7579a3edb84d86165)  

##   [1. Overview（概述）](#1-overview概述)  

  [集群DB在线恢复](https://conf.yasdb.com/pages/viewpage.action?pageId=119552238)    ：

>   集群形态部署下，每个DB实例均为对等状态，承载部分全局资源，所有DB实例共享数据库，通过共享缓存模块完成业务的并发控制。如果部分DB实例异常关闭，导致整个DB集群处于不一致状态，包括数据库物理页面的不一致，共享缓存状态的不一致。YCS检测到部分DB异常关闭时，通过更新其他DB实例的拓扑状态，使得MASTER DB感知到其他DB实例的异常，MASTER DB实例需要触发故障的在线恢复，修正前述的不一致问题，让整个DB集群处于正常提供全量服务的状态。  

DB支持集群四节点高可用，之前    [YDBRD-21550 集群4节点故障](https://conf.yasdb.com/pages/viewpage.action?pageId=135604678)    针对DB集群多节点故障进行了交付验证，本次SR主要在其之上解除了限制：

1. 现允许 YCS 并发启停
1. 现允许 DB 的二次故障
1. 现允许 YCS 的故障


##   [2. Features（功能特性）](#2-features功能特性)  

DB支持集群四节点高可用。

##   [3. Interfaces（接口）](#3-interfaces接口)  

本方案不涉及新增接口

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 如果实例未处于open状态，实例被切换为主，自己abort
1. 集群DB故障在线恢复期间，涉及GRC访问的业务会卡住重试，直至对应的GRC资源已经处于正确状态
1. 不包含主备复制--集群主备的Failover & SwitchOver


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

  [集群DB在线恢复 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119552238)  

测试期间发现的问题以及修改（    [MR](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/33612)    内也会记录，可能同步不及时）：

- 当DB shutdown时，仍然要响应来自master的ddl广播消息，否则可能会阻塞master因其他db abort触发的reform，进一步导致DB shutdown退出卡住：    [YDBRD-26419 【共享集群】【DB故障】实例故障和其他实例启停并发的场景下，db master 实例reform卡住，卡在逻辑日志回放](https://pingcode.yasdb.com/pjm/items/661e1d52fd997db58ada75ea)  
-   `grcRecoverRequestMsg`    中需根据topo->instMap发送判断是否继续发送消息恢复GRC资源，否则无法响应二次故障：    [YDBRD-26656 【共享集群】【DB故障】两个db 非master实例同时kill，恢复后，db master执行后置sql（drop tablespace）时卡住](https://pingcode.yasdb.com/pjm/items/6628eae7fd997db58ae12192)  
- 在线恢复中从BufferPool分配BufferCtrl给rcy bp ctrl使用时需设置resStatus，drop tablespace会扫描BufferCtrl因状态卡死：    [YDBRD-26656 【共享集群】【DB故障】两个db 非master实例同时kill，恢复后，db master执行后置sql（drop tablespace）时卡住](https://pingcode.yasdb.com/pjm/items/6628eae7fd997db58ae12192)  
- 梳理补充在线逻辑日志回放中，遗漏逻辑日志对应的锁ID：    [YDBRD-26487 【共享集群】【DB故障】业务运行过程中，db的master角色产生"网络丢包"故障，故障后db实例reform卡住](https://pingcode.yasdb.com/pjm/items/6620ced7fd997db58adc8616)  
- 事务托管逻辑调整（方案确认中）：    [YDBRD-26633 【共享集群】【DB故障】业务下发的过程中，"非master停止+master和其他非master故障"并发，实例core在”applyHeapUndoBatchInsert“](https://pingcode.yasdb.com/pjm/items/662793a4fd997db58ae02595)  
- msgReplaceTrigger中entry为NULL时没处理，导致core（郝鑫刚）：    [YDBRD-26506 【共享集群】【DB故障】业务运行过程中，db master和非master实例同时产生网卡down的故障，实例2 core在“dcInvalidateSo”](https://pingcode.yasdb.com/pjm/items/662109c5fd997db58adce829)  
-   [YDBRD-26392 【共享集群】【YCS】实例故障和启停并发，并发业务执行卡住，YCS层下发topo不正确](https://pingcode.yasdb.com/pjm/items/661de6e3fd997db58ada29e8)  
- 锁闭环检测机制中，对于是否为cancel的判断需要修改：    [YDBRD-26719 【共享集群】【DB故障】业务运行过程中，master和非master先后产生网络延迟和网络闪断故障，db4 core在“spinLock”](https://pingcode.yasdb.com/pjm/items/662b62c4c36a3d30a85e220a)  
- RA请求中，需要先获取topo version，否则可能使用旧的dht、新的topo去做请求，最终卡在reform：    [YDBRD-26778 【共享集群】【DB故障】多实例并发执行DML业务的过程中，随机触发db或ycs故障，实例reform卡住](https://pingcode.yasdb.com/pjm/items/662f3c00c36a3d30a85fcb1c)  


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

-   [YDBRD-21550 集群4节点故障](https://conf.yasdb.com/pages/viewpage.action?pageId=135604678)    的自测用例基于原先的二实例旧用例，部分用例包含了对DB的二次故障。
-   [YDBRD-21550 集群4节点故障](https://conf.yasdb.com/pages/viewpage.action?pageId=135604678)    需求中由测试提供的冒烟用例中也涉及db的二次故障：    [用例代码](https://git.yasdb.com/lizuolong/yasft/-/blob/89946752b7511d65025d393f7eca264133080b1d/ha/ha_cluster/testcase/fault_test/db_fault/smoking-test-4nodes-fault)    。
- 再补充分机部署情况下，以网络故障为主的二次故障场景（正在测试）：    [用例代码](https://git.yasdb.com/lizuolong/yasft/-/blob/my-lab/ha/ha_cluster/testcase/my-lab/YDBRD-25883-cluster-HA)    。


##   [7. 资料设计章节](#7-资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Comments:

|  [](null)  ,一、会议时间：2024/04/11 16:00-16:30     
  二、会议地点：腾讯会议     
  三、会议主持人：李佐龙    
  四、参会人员：陈宜顺、同二鹏、李佐龙、李道一、吕雷奇、张丽红、马爽、牛亚娜     
  五、会议主题：DB支持集群四节点高可用设计评审     
  六、设计评审纪要    
  - 补充规格：1. 不包含主备复制--集群主备的Failover & SwitchOver,Posted by lizuolong at 四月 11, 2024 18:14|
|---|
