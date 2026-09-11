Created by 徐凡博, last modified on 十二月 19, 2023

### 重构SR：    [YDBRD-21365](https://jira.yasdb.com/browse/YDBRD-21365?src=confmacro)    -  支持两节点故障恢复  完成

  [YDBRD-22325](https://jira.yasdb.com/browse/YDBRD-22325?src=confmacro)    -  CLONE - 支持两节点故障恢复  完成

### 【开发重构设计方案】

1、    [YCS启停设计](https://conf.yasdb.com/pages/viewpage.action?pageId=130147446)  

2、    [ycs去依赖SCSI——监控流程设计方案](/pages/createpage.action?spaceKey=YAS&title=ycs%E5%8E%BB%E4%BE%9D%E8%B5%96SCSI%E2%80%94%E2%80%94%E7%9B%91%E6%8E%A7%E6%B5%81%E7%A8%8B%E8%AE%BE%E8%AE%A1%E6%96%B9%E6%A1%88)      &      [ycs磁盘心跳监控方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133577030)  

3、    [ycs去依赖SCSI——IOFENCE](133575533.html)  

主要变更项:

1、磁盘无锁访问

2、变更选举算法

3、增加DB磁盘心跳

### 【23.1相关SR】

**在**    [【YCS去SCSI】原测试需求梳理](https://conf.yasdb.com/pages/viewpage.action?pageId=130141425)    **中，除YCR相关的SR均在本SR范围内。**

主要特性：

1、YCS节点启停、资源启停（两节点&三节点）

2、监控流程

3、IOFENCE流程

4、两节点集群故障

5、其他：日志、配置参数、ycsctl工具、IPV6等。

### 【测试策略】

除iofence等特性变化较大、监控需补充设计部分用例外，重新设计外，本SR基本延用历史用例。

### 【补充设计方案】

-   [【YDBRD-15216 & YDBRD-21695】【共享集群YCS去scsi】支持IOFENCE--测试设计](133589348.html)  
-   [【重构测试】YCS心跳监控](133586056.html)  


### 【23.1遗留问题】

  [YDBRD-21811](https://jira.yasdb.com/browse/YDBRD-21811?src=confmacro)    -  【RTO测试】心跳超时参数设置为较小值时，2节点隔离tpcc业务的过程中reboot master节点，非master节点上的db一直在被重拉  解决关闭

  [YDBRD-21812](https://jira.yasdb.com/browse/YDBRD-21812?src=confmacro)    -  CLONE-【RTO测试】心跳超时参数设置为较小值时，2节点隔离tpcc业务的过程中reboot master节点，非master节点上的db一直在被重拉  解决关闭

  [YDBRD-21822](https://jira.yasdb.com/browse/YDBRD-21822?src=confmacro)    -  【RTO测试】心跳超时参数设置为较小值时，2节点隔离tpcc业务的过程中reboot非master节点，master节点上的db一直在被重拉  解决关闭