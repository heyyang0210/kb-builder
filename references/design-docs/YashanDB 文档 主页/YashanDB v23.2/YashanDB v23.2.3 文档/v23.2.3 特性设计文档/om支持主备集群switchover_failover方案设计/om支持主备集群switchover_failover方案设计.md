Created by 瞿蓝孟, last modified on 六月 04, 2024

## 1. 总述

主备集群需要支持集群间手动switchover和failover的能力，现om需要支持共享集群的主备切换功能。

### 1.1 需求来源

集群要求

### 1.2 调研文档

  [详细设计-YDBRD-26294 : 集群支持Switchover 方案设计](150619173.html)  

  [详细设计-YDBRD-25968 : 集群支持备库升主能力方案设计](147778640.html)  

  


  


### 1.3 需求分析

- 需求规格：
-     1. 支持同构集群复制，要求节点数对等，版本相同
    1. 支持备集群的failover
    1. 集群间复制支持最大性能模式

-   



### 1.4 数据字典

无

### 1.5 开源依赖

 无

## 2. 接口

#switchover    
  $ yasboot node switchover -c yashandb -n 2-1    
  ​    
  #failover    
  $ yasboot node failover -c yashandb -n 2-1

命令跟单机/分布式一致，只需要适配共享集群即可

## 3. 规格与约束

- switchover的约束：
    - 支持同构集群复制，要求节点数对等，版本相同
    - 主集群的1号实例必须open。
    - 其他存活实例的状态必须是open状态，不能出现nomount状态或者是mount状态。
    - 执行switchover期间，新的实例加入集群需要报错。
    - 执行switchover期间，如果有实例退出，switchover失败。
    - 如果正在执行reform，switchover报错
    - 备集群只能是1号实例执行switchover，并且是处于open阶段。
    - 备集群的所有实例的redo传输必须是正常的（连接正常并且状态也是正常）。
    - switchover期间备集群阻塞其他实例加入集群。（同Failover表现一致）
    - switchover完成之后，如果脏页没有刷完，新主的其他实例也是不可以加入集群的。（同Failover表现一致)
- Failover的约束：
-     1. Failover时备集群的1号实例必须open
    1. 所有实例的连接必须断连，如果有一个实例连接着备集群，那么将不能执行failover

-   

-   



## 4. 特性

switchover流程：

1. 检查节点数对等，版本相同
1. 必须是HA（group>1）
1. 主集群的  所有节点  都是  open状态
1. 备集群只能是1号实例执行switchover，并且是处于open阶段（database视图的switchover_status必须是to primary）；
1. 备集群1号实例执行switchover命令
1. switchover切主成功
1. 原备集群  剩余实例  ope  n（假如open失败了，整体算成功还是失败？）


  


Failover流程：

1. 检查节点数对等（主集群已经挂了，检查不了版本）
1. 必须是HA（group>1）
1. 主集群所有节点均故障；
1. 备集群只能是1号实例执行switchover
1. 备集群1号实例执行Failover命令
1. Failover切主成功
1. 原备集群剩余实例open（同上）


  


## 5. Testcases（自测用例）

1.部署主备集群，在备集群1号实例执行switchover；

2.部署主备集群，kill所有主集群，在备集群1号实例执行failover；

## 6.资料设计章节

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

## 7.未来规划

  


## Comments:

|  [](null)  ,会议纪要：,时间：2024-06-03,与会人：杨德柳、朱国旭、瞿蓝孟、吕雷齐、高亚宁、张彩虹,1. 检查所有存活节点（已经挂掉的节点不进行校验）
1. switchover时，主节点检查  switchover_status必须是to standby
1. 备集群其他实例只有nomount状态需要open；挂掉节点不处理
1. open过程中有节点失败，整体算成功，但是要在命令行界面打印warnning信息
,方案是否通过：是,Posted by qulanmeng at 六月 03, 2024 17:28|
|---|
