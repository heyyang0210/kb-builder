

**目的：**    
1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等
2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)
3.给测试概要设计和测试详细设计做输入

IR：

  [https://pingcode.yasdb.com/ship/ideas/66d6ecad89f961f330107599?](https://pingcode.yasdb.com/ship/ideas/66d6ecad89f961f330107599?)  

#YASHAN-3286  OM支持主备滚动升级

# 1. 需求概述



需求概述：OM支持主备滚动升级

需求来源：产品化需求

部署形态：单机

需求场景：23.3内核已经支持逻辑备库功能，需要OM支持主备滚动自动升级能力，支持大版本的滚动升级





# 2. 友商的实现情况

oracle

|类型|||
|---|---|---|
|DDL|升级期间不会拦截DDL操作，但不推荐升级期间执行DDL||
||||






# 3. 示例

## 3.1 创建复杂资源计划

|步骤|ORACLE示例|备注|
|---|---|---|
|配置计划|1.DBMS_ROLLING.INIT_PLAN ,2.DBMS_ROLLING.SET_PARAMETER |指定如何实施滚动升级过程|
|编译|DBMS_ROLLING.BUILD_PLAN|启编译制定滚动升级计划|
|执行|1.DBMS_ROLLING.START_PLAN：执行滚动升级，物理备机转换为逻辑备机,2.执行升级脚本,3.DBMS_ROLLING.SWITCHOVER ,4.升级二进制,5.DBMS_ROLLING.FINISH_PLAN||
|删除计划|DBMS_ROLLING.DESTROY_PLAN||
||||






  


# 4. 参考文档

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/sbydb/using-DBMS_ROLLING-to-perform-rolling-upgrade.html#GUID-5DDF9197-33A4-4279-8058-46B3B8C0FAE4](https://docs.oracle.com/en/database/oracle/oracle-database/21/sbydb/using-DBMS_ROLLING-to-perform-rolling-upgrade.html#GUID-5DDF9197-33A4-4279-8058-46B3B8C0FAE4)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/upgrd/major-steps-upgrade-process-oracle-database.html](https://docs.oracle.com/en/database/oracle/oracle-database/21/upgrd/major-steps-upgrade-process-oracle-database.html)  

# 5. 后续关注(可选)

*后续测试设计与执行过程中需跟友商做细化对比的内容*