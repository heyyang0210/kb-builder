Created by 施新华 on 十月 12, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

IR链接：       [YDBRD-19830](https://jira.yasdb.com/browse/YDBRD-19830)       -     分布式DN组支持一主一备形态部署     完成

为了节省客户资源，同时满足高可用能力，分布式DN需要支持1主1备部署模式。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1）DN组支持部署1主1备，通过yasom进程进行仲裁；

2）主节点故障，备节点自动升主并且不丢失数据；

3）备节点故障，主节点业务运行正常。

4）HA_HEARTBEAT_INTERVAL=1, HA_ELECTION_TIMEOUT=6配置满足规格：RPO=0，RTO < 10s。

5）可手动进行主备切换不丢失数据。

6）支持最大保护，最大可用和最大性能保护模式。

7）OM新增命令yasboot group election。

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

- 只有DN组支持配置1主1备开启仲裁服务。
- 开启仲裁，DN组内不支持扩缩容。


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

资源不足当时需要支持自动切换场景。

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

|场景|详细描述|
|:---|:---|
|场景|详细描述|
|部署|DN组内部署1主1备，CN和MN开启仲裁需要拦截。|
|DML|DML执行正常|
|视图|分布式视图查询正常|
|主备切换|1. 主节点故障，备节点自动升主并且不丢失数据。
1. 备节点故障，主节点业务运行正常。
1. 满足规格RPO=0，RTO < 10s。
1. 可手动进行主备切换不丢失数据。
|
|配置命令|yasboot命令|
|资源|开启仲裁后内存，cpu资源使用无上涨|


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

需要关注以下特性：

- 高可用(重点)
- 一致性
- 升级
- DFR
- 可维护性
- 操作并发


##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

用现有HA框架，需要新增工程进行验证。

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*后续涉及到主备复制特性需要进行验证。*