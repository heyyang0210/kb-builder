Created by 易文亮, last modified on 十一月 10, 2023

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*需求与场景概述*

*需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分 单机行执行 和 单机列执行*

*IR：*    [YDBRD-20465](https://jira.yasdb.com/browse/YDBRD-20465?src=confmacro)    *-*  *LSC主备发送性能优化*  *完成*

*开发概要设计：*    [LSC后台任务优化设计文档 - 李子怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133570049)  

**部署形态**  ：

单机+分布式

**需求来源背景：**

LSC表后台转换、合并、清理等操作消耗系统IO和CPU等资源，前台查询和后台任务并发时，前台一条很快能执行完成的SQL都会卡很久。

**需求描述：**

**技术改进优化：优化后台任务调度策略，引入资源控制机制；**    
  **减少后台的transform、compact、clean arch任务对用户业务的影响**

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1）bulkload导入/增量导入时，自动打断后台任务。

2）增加配置参数，控制后台任务  DATA_TRANSFORMER_ENABLED的开启时间段，增加后台任务历史记录表

3）合并优化：考虑空洞率合并方案

4）资源任务优化，减少忙碌时后台任务调度数

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

*无*

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

  


**需求主要应用场景：**

1、LSC转换、合并、清理与dml并发

2、LSC转换、合并、清理与(bulkload)导入并发

3、合并规则变更验证

**与其它特性关联场景：**

无

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.本设计主要采样场景测试法和异常测试分析法，通过构造各种并发场景、任务打断场景、合并场景等，分别验证各场景符合优化要求。*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力*    
  *1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；*    
  *2.执行表达式和算子类的特性需求，需要考虑性能；*    
  *3.主备、容灾、存储等的特性需求，需要考虑可靠性；*    
  *4.外部常用语法、基础功能要考虑增加稳定性用例；*    
  *5.所有特性均需要考虑可维、可测，可要求研发提供必要的视图。*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略*

*主要sql功能用例使用Guider调用yasft看护，主要场景功能用例使用ha_regress框架*

  


##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

结合具体的资源优化方案、合并改造方案进行详细设计。