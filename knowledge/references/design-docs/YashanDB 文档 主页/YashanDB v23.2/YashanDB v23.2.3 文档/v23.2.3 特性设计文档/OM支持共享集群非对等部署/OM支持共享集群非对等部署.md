Created by 黄思源, last modified on 七月 17, 2024

*详细设计-YDBRD-YDBRD-29506 : OM支持共享集群非对等部署方案设计*

* IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b327](https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b327)    *?*    
  *#YASHAN-983 【主备集群】集群支持非对等集群复制*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6673ff4a288e197820aa47f4](https://pingcode.yasdb.com/pjm/items/6673ff4a288e197820aa47f4)    *?*    
  *#YDBRD-29506 【主备集群】集群支持非对等集群复制*

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

产品化需求

需求描述： 支持备集群节点非对等节点数。OM部署集群主备时，备集群实例个数可以小于主实例个数。一主多备下，每个备集群的实例数可以不等 。

需求规格：

1、主备节点个数不对等（不小于1）

2、部署时，备库节点个数小于主机节点个数

###   [1.2 调研文档](#12-调研文档)  

  [OM支持主备共享集群部署](https://conf.yasdb.com/pages/viewpage.action?pageId=144137319)  

  [OM支持主备共享集群switchover和failover](https://conf.yasdb.com/pages/viewpage.action?pageId=156108107)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|部署支持非对等|放开约束|是|是|
|功能|switchover/failover|放开约束|是|是|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

主要是生成配置文件的命令（package ce gen）。

**方案1**

不变。直接对配置文件进行增删。

**方案2**

新增参数   *--standby-node*  ：用于指定备集群的节点数量。（所有备集群的节点数量一样）

原来的：

--group：控制集群的数量

--node：控制主集群的节点数量。

新增的 --standby-node：如果不填，默认和--node保持一致（即对等集群）。

>   如果想要备集群的数量均不一样，则需要手动修改。  

##   [3. 规格与约束](#3-规格与约束)  

1. 主备节点个数不对等（节点数量都得大于1）。
1. 部署时，备库节点个数小于主机节点个数。


##   [4. 特性](#4-特性)  

1. 生成配置文件：package ce gen
1. 部署、switchover、failover等相应的地方放开约束。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

**参数验证：**

1. standby-node为不合法参数：字符，负数，小数，大于64。
1. node=1，standby-node为空，预期主备集群节点数一致。
1. node=2，standby-node为1，预期主集群节点数量为2，备集群节点数量为1。
1. node=2，standby-node为3，预期报错。


**整体流程验证：**

1. 部署一主一备，主集群数量为3，备集群数量为1。（成功）
1. 执行node switchover。（成功）
1. 执行node failover。（成功）
1. 部署一主一备，主集群数量为3，备集群数量为2。（成功）
1. 执行node switchover。（成功）
1. 执行node failover。（成功）
1. 部署一主两备，主集群数量为2，备集群1数量为1，备集群2数量为2。（成功）
1. 执行node switchover。（成功）
1. 执行node failover。（成功）


##   [6.资料设计章节](#6资料设计章节)  

doc/产品文档/工具手册/yasboot/yasboot命令介绍/yasboot package.md

##   [7.未来规划](#7未来规划)  

无

## Comments:

|  [](null)  ,会议纪要：,时间：2024.07.17,与会人：马志宏、瞿蓝孟、高亚宁、张彩虹、黄思源,1. 生成配置文件，选择方案2，参数名为--standby-node。
1. 补全自测用例。
1. 该需求不走转测流程，开发自测，测试用例由开发补充。
,Posted by huangsiyuan at 七月 17, 2024 17:56|
|---|
