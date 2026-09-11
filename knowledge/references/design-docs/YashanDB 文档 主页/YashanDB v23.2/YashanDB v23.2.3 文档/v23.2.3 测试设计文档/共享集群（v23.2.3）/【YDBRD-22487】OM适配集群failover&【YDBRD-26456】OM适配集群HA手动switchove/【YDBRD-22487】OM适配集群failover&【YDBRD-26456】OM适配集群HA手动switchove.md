Created by 张彩虹, last modified on 七月 25, 2024

# **1. 概述**

本文描述OM支持主备集群failover和主备集群switchover测试设计。

# **2. 需求分析**

主备集群已支持集群间手动switchover和failover的能力，现om需要支持共享集群的主备切换功能。

## **2.1 功能点分析**

SR链接：    [https://pingcode.yasdb.com/pjm/items/6117e85579a3edb84d76fe0](https://pingcode.yasdb.com/pjm/items/66117e85579a3edb84d76fe0)    ?    
  #YDBRD-22487 【23.2】OM适配集群failover

SR链接：    [https://pingcode.yasdb.com/pjm/items/661f31d2fd997db58adb15a0](https://pingcode.yasdb.com/pjm/items/661f31d2fd997db58adb15a0)    ?    
  #YDBRD-26456 OM适配集群HA手动switchover

开发方案文档：    [om支持主备集群switchover/failover方案设计](156108107.html)  

### 2.1.1 OM适配集群failover

目前集群HA，备集群只有第一个实例可以open，其他实例都是nomount状态，所以failover SQL执行之后，也只有第一个实例变为主库并提供业务，其他主实例还是nomount，需要OM拉起 

- OM支持failover命令（yasboot node failover -c yashandb -n 2-1）
- 备集群1号实例执行failover 
- failover成功后，打印成功信息，然后open其他备实例


### 2.1.2 OM适配集群HA手动switchover

支持集群间支持手动switchover

- OM支持集群HA的switchover（  yasboot node switchover -c yashandb -n 2-1  ） 
- switchover时，必须是备集群的1号实例
- switchover后，新主集群的1号实例是open的，其余是nomount的，需要OM拉起到open


## **2.3 规格约束**

- switchover的约束：
    - 支持同构集群复制，要求节点数对等，版本相同
    - 主集群的1号实例必须open。
    - 其他存活实例的状态必须是open状态，不能出现nomount状态或者是mount状态。
    - 执行switchover期间，新的实例加入集群需要报错(  instance cannot be mounted when switchover  )。
    - 执行switchover期间，如果有实例退出，switchover失败(备集群退出执行switchover实例报错：  the database is busy, try again later；备集群退出非master：成功  )。
    - 如果正在执行reform，switchover报错
    - 备集群只能是1号实例执行switchover，并且是处于open阶段。
    - 备集群的所有实例的redo传输必须是正常的（连接正常并且状态也是正常）。
    - switchover期间备集群阻塞其他实例加入集群。（同Failover表现一致）
    - switchover完成之后，如果脏页没有刷完，新主的其他实例也是不可以加入集群的。（同Failover表现一致)
- Failover的约束：
-     1. Failover时备集群的1号实例必须open
    1. 所有实例的连接必须断连，如果有一个实例连接着备集群，那么将不能执行failover



# **3. 详细测试设计**

## **3.1 测试设计方法**

该需求是  OM适配集群failover和switchover，  重点需要验证集群在正常或者异常状态下OM执行failover和swichover的情况以及集群failover和swichover后集群可正常使用。

针对功能测试主要采用场景法组合及错误推测法进行设计。

## **3.2 详细测试设计**

1、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|涉及|
|三方测试工具(sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|涉及|
|性能|涉及|
|可维护性|涉及|


2、详细测试点

|  
|测试场景|子场景描述|预期|备注|
|---|---|---|---|---|
|1|  
    
    
    
    
,failover场景|主集群无存活实例-->OM命令备集群升主（备集群1号实例open）-->升主后检查新主是否都为open状态-->执行业务操作正常-->switchover还原环境|成功|完成|
|2||主集群无存活实例-->OM命令备集群升主（备集群1号实例nomount）|报错|完成|
|3||主集群无存活实例-->OM命令备集群升主（备集群1号实例mount）|报错|完成|
|4||主集群有存活实例(nomount)-->OM命令备集群升主（备集群1号实例open）-->升主后检查新主是否都为open状态-->执行业务操作正常-->switchover还原环境|成功|完成|
|5||主集群有存活实例(mount)-->OM命令备集群升主（备集群1号实例open）|报错|完成|
|6||主集群有存活实例(open)-->OM命令备集群升主（备集群1号实例open）|报错|完成|
|7||主集群实例全部故障-->OM命令备集群1升主（备集群1号实例open）-->新主故障-->备2升主（failover循环多次）-->switchover还原环境|成功|完成|
|8||构造failover成功但是open实例失败场景|显示成功但是有告警信息|  
|
|9|  
    
    
    
  switchover场景    
    
    
|主集群存活实例都open->OM命令备集群执行switchover（备集群1号实例open）→升主后检查集群状态都正常-->执行业务操作正常|成功|完成|
|10||主集群存活实例都open->OM命令备集群执行switchover（备集群1号实例nomount）→升主后检查集群状态都正常-->执行业务操作正常|报错|完成|
|11||主集群存活实例都open->OM命令备集群执行switchover（备集群1号实例mount）→升主后检查集群状态都正常-->执行业务操作正常|报错|完成|
|12||主集群存活实例为nomount-->OM命令备集群执行switchover（备集群1号实例open）|报错|完成|
|13||主集群存活实例为mount-->OM命令备集群执行switchover（备集群1号实例open）|报错|完成|
|14||主集群实例全部故障-->OM命令备集群执行switchover（备集群1号实例open）|报错|完成|
|15||switchover循环多次|成功|完成|
|16||构造switchover成功但是open实例失败场景|显示成功但是有告警信息|  
|
|17|并发场景    
    
    
|两个备集群同时执行failover|两个都成功|完成|
|18||备集群执行  failover与备集群退出实例并发|退出1号时switchover完成后才可加入；退出非1号成功|完成|
|19||备集群执行  failover  与备集群加入实例并发|failover期间不能加入实例|完成|
|20||备集群执行  failover  与主集群加入实例并发|报错|完成|
|21||备集群执行  failover时kill执行failchover节点|failover失败|完成|
|22||两个备集群同时执行switchover|只有一个成功|完成|
|23||备集群执行  switchover与备集群退出实例并发|退出1号时switchover完成后才可加入；退出非1号成功|  
|
|24||备集群执行  switchover与备集群加入实例并发|switchover期间不能加入实例|  
|
|25||备集群执行  switchover与主集群加入实例并发|switchover期间不能加入实例|  
|
|26||备集群执行  switchover与主集群退出实例并发|退出成功，switchover失败（连接主集群实例失败）|  
|
|27||备集群执行  switchover时kill执行switchover节点|switchover报错（需要重新建库）|  
|
|28|压力场景|压力场景(TPCC)    TPCC执行中执行switchover和failover；有gap的情况下执行switchover和failover|  
|  
|
|29|  
|最大保护模式下执行switchover和failover，数据不会丢失++|SIT|  
|


# **4. **  **测试用例**

冒烟用例

|  
|测试场景|预期|
|---|:---|:---|
|1|主集群无存活实例-->OM命令备集群升主（备集群1号实例open）-->升主后检查新主是否都为open状态-->执行业务操作正常-->switchover还原环境|成功|
|2|主集群有存活实例-->OM命令备集群升主（备集群1号实例open）|报错|
|3|主集群存活实例都open->OM命令备集群执行switchover（备集群1号实例open）→升主后检查集群状态都正常-->执行业务操作正常|成功|
|4|主集群存活实例未open->OM命令备集群执行switchover（备集群1号实例open）|报错|


  


# **5. 测试框架设计**

框架使用ha_regress框架（需要适配yasboot后可用）

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|集群|


# **7、工作量评估**

总计 11人天

测试设计+评审  2人天

测试 5人天

自动化+调试稳定 3人天

上车分析 1人天