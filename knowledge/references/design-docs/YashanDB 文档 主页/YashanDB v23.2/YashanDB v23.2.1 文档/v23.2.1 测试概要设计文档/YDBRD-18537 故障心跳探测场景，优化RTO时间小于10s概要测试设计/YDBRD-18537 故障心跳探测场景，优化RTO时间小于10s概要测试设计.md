Created by 施新华 on 十月 12, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

IR链接：    [YDBRD-18537](https://jira.yasdb.com/browse/YDBRD-18537)     -   分布式故障心跳探测场景，优化RTO时间，小于10s  完成    
  需求描述：    
  1. 对于心跳探测的故障，主要是故障探测的时间。    
  2.非心跳探测类故障，23.2先不关注心跳不感知的故障。    
    
  需求范围：  单机、分布式

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1）  HA_HEARTBEAT_INTERVAL=1, HA_ELECTION_TIMEOUT=6 HA部署单节点故障  满足规格RPO=0，RTO < 10s。

2）包含1主1备，1主多备部署。

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1）网络质量差时，可能导致自动重选；

2）若是触发多次选举，不能满足规格。

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

1）目前实现探测心跳异常导致的主备切换，  满足常见故障处理指标（单点故障）， RTO<10S，RPO=0；纯查询业务，TPCH 50%负载。

2）部署包含单机、分布式1主1备，1主多备场景。

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

配置：  HA_HEARTBEAT_INTERVAL=1

           HA_ELECTION_TIMEOUT=6

|场景|详细描述|
|:---|:---|
|场景|详细描述|
|部署|单机1主1备，1主多备|
||分布式1主1备(DN)，1主多备|
|单节点故障|单节点故障，满足规格|
|多节点故障|满足规格|
|网络异常|满足规格|
|主机重启|满足规格|
|主机crash|满足规格|


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

需要关注以下特性：

高可用(重点)

DFR

可维护性

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

用现有HA框架增加用例。

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*后续涉及到主备复制特性需要进行验证。*