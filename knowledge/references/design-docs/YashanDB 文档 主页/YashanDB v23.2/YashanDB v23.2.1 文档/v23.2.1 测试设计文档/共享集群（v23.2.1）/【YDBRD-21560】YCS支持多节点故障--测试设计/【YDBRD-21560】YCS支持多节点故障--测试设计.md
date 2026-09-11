Created by 徐凡博, last modified on 二月 20, 2024

# 1. 概述

本文描述共享集群支持多节点故障测试设计。

SR：    [YDBRD-21560](https://jira.yasdb.com/browse/YDBRD-21560?src=confmacro)    -  YCS支持多节点故障  完成

开发设计文档：    [YCS多节点故障详细设计方案](https://conf.yasdb.com/pages/viewpage.action?pageId=138570746)  

测试概要设计：    [概要设计-YDBRD-18797-集群支持4节点高可用](/pages/createpage.action?spaceKey=~zhanglihong&title=%E6%A6%82%E8%A6%81%E8%AE%BE%E8%AE%A1-YDBRD-18797-%E9%9B%86%E7%BE%A4%E6%94%AF%E6%8C%814%E8%8A%82%E7%82%B9%E9%AB%98%E5%8F%AF%E7%94%A8)      [YCS多节点故障--规格约束](/pages/createpage.action?spaceKey=~zhanglihong&title=YCS%E5%A4%9A%E8%8A%82%E7%82%B9%E6%95%85%E9%9A%9C--%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

# 2. 需求分析

## 2.1 功能点分析

### 2.1.1 基本故障类型

本需求主要针对共享集群多节点的可靠性，支撑集群在发生以下故障（    [YashanDB 故障模式库-集群（已废弃）](https://conf.yasdb.com/pages/viewpage.action?pageId=104221906)    ）时仍提供给高可用性：

1、操作系统类故障：含网络、磁盘、  ~~内存、CPU~~  等各种类型的故障；（  两节点内存、CPU资源类的故障运行中摸底测试  ）

2、集群资源类异常：主要考虑与YFS、DB等的交互异常；

3、集群组件故障：YCS/YFS/DB进程的异常退出、停止、进程挂起等（kill -9,   ~~kill -19， kill 18,~~   kill 15）；

4、服务器宕机，包含reboot。

### 2.1.2 同一类型故障

针对相同的故障，原则上允许发生：

1、多点故障：多个节点  **同时**  发生同一故障。

2、连续故障：相同/不同节点  **先**  发生了一个故障还未处理完成，  **后**  发生同一故障。

### 2.1.2 不同类型故障

针对不同的故障，原则上允许以下类型的发生：

1、叠加故障：相同/不同节点  **同时**  产生  **不同**  类型的故障

2、多点故障：多个节点  **同时**  发生  **不同**  类型的故障

3、连续故障：相同/不同节点  **先**  发生了一个故障还未处理完成，  **后**  发生不同故障。

## 2.2 应用场景

集群发生故障的场景，原则上故障过程中不影响系统可用性，且在故障排除后集群可以快速恢复。

## 2.3 规格约束

1、部署形态：集群

2、不支持集群HA模式

3、节点数目：4， 优先保证两节点故障测试，四节点按优先级裁剪测试

4、  目前只支持基于单个共享盘的投票仲裁。

5、存在网络分区情况下，幸存列表可能不是最优。

6  ~~、超过4个节点的故障场景暂时不能完整支持~~  ； –- 理论上支持，开发未自测，不作为转测约束

7、只支持基本故障类型: 磁盘故障，网络故障，进程故障，不支持运行过程中资源类故障（例如运行过程中内存耗尽等）

8、相同类型故障约束：

       1）多点故障：仅限四节点，两节点不涉及；

       2）连续故障：两节点仅限一个节点异常；四节点针对整个集群支持

9、 不同类型故障约束：

1）叠加故障：两节点仅限一个节点异常；四节点针对整个集群同时产生两种不同类型的故障（此时与多点故障相同）

2）多点故障：四节点支持，两节点不涉及

3）连续故障：两节点仅限一个节点异常；四节点针对整个集群支持

10、关于在途IO保护相关的故障场景，取决于特性交付顺序，具体预期与现象合理性由开发根据当前代码版本判定。

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用场景法、错误推测法、正交组合法进行测试设计。

- 对于各种类型故障发生的阶段以及预期判定，主要采用场景法、错误推测法进行设计；
- 对于叠加故障、连续故障、多点故障等复杂场景，主要通过错误推测法、正交组合发进行设计覆盖。


## 3.2 详细测试设计

对于故障的设计原则上，轻量级故障组合场景(故障总数<=2)，可观察故障后的表现是否在符合开发的流程设计，并观察故障排除后的系统恢复；

多重故障发生的场景（故障总数 >2），主要通过业务执行角度观测故障过程中系统的可用性，并观察故障排除后系统的恢复。

### 3.2.1 两节点针对性补充

#### 3.2.1.1 YCS故障层面的补充

两节点YCS故障已在历史SR种覆盖，且有自动化用例维护。但，23.1故障特性    [【YDBRD-15389】【YDBRD-15393】【共享集群】YCS故障恢复测试设计](122076866.html)    ，仅支持单一故障发生。

因此，针对23.2现有方案，两节点需要补充以下场景的测试：

1）相同故障类型：连续故障；

2）不同故障类型：叠加故障、连续故障。

  


网络故障包括：网络丢包、网络时延、网卡故障等；

进程异常包括：kill -9,  ~~ kill -19， kill 18~~  ,   kill 15 

磁盘心跳异常：通过27号埋点  YCS_RM_FAULT_POINT_27  构造

服务器宕机：reboot构造。

启动前内存耗尽、CPU满等系统资源类场景，已经在两节点已有SR种覆盖过，此处不再重复设计。

|  
|是否相同故障|故障组合类型|故障数目|是否带DB业务|故障场景|预期结果|备注|
|---|---|---|---|---|---|---|---|
|1|相同故障|连续故障|相同故障  **发生**  两次|不带DB业务|网络故障*2|备下线走重启流程|  
|
|2|  
|  
|  
|  
|主磁盘心跳故障*2|主下线|  
|
|3|  
|  
|  
|  
|备磁盘心跳故障*2|备下线|  
|
|4|  
|  
|  
|  
|主节点YCS进程异常*2|主YCS异常|  
|
|5|  
|  
|  
|  
|备节点YCS进程异常*2|备YCS异常|  
|
|6|  
|  
|  
|  
|主节点DB进程异常*2|主DB异常|  
|
|7|  
|  
|  
|  
|备节点DB进程异常*2|备DB异常|  
|
|8|  
|  
|  
|  
|主节点reboot*2|备节点正常|  
|
|9|  
|  
|  
|  
|备节点reboot*2|主节点正常|  
|
|10|  
|  
|相同故障  **先后**  发生n次|带DB业务|网络故障*n|原则上非故障节点业务不受影响|n在自动化时选择多种取值，下同|
|11|  
|  
|  
|  
|主磁盘心跳故障*n|原则上非故障节点业务不受影响|  
|
|12|  
|  
|  
|  
|备磁盘心跳故障*n|原则上非故障节点业务不受影响|  
|
|13|  
|  
|  
|  
|主节点YCS进程异常*n|原则上非故障节点业务不受影响|  
|
|14|  
|  
|  
|  
|备节点YCS进程异常*n|原则上非故障节点业务不受影响|  
|
|15|  
|  
|  
|  
|主节点DB进程异常*n|原则上非故障节点业务不受影响|  
|
|16|  
|  
|  
|  
|备节点DB进程异常*n|原则上非故障节点业务不受影响|  
|
|17|  
|  
|  
|  
|主节点reboot*n|原则上非故障节点业务不受影响|  
|
|18|  
|  
|  
|  
|备节点reboot*n|原则上非故障节点业务不受影响|  
|
|19|不同故障|连续故障|最多两个不同故障  **先后**  发生（+列举同样表达先后）|不带DB业务|网络故障+备节点磁盘心跳故障|主节点不受影响|  
|
|20|  
|  
|  
|  
|网络故障+备节点YCS进程异常|主节点不受影响|  
|
|21|  
|  
|  
|  
|网络故障+备节点DB进程异常|主节点不受影响|  
|
|22|  
|  
|  
|  
|网络故障+备节点reboot|主节点不受影响|  
|
|23|  
|  
|  
|  
|备节点磁盘心跳故障+网络故障|主节点不受影响|  
|
|24|  
|  
|  
|  
|备节点磁盘心跳异常+备节点YCS进程异常|主节点不受影响|  
|
|25|  
|  
|  
|  
|备节点磁盘心跳异常+备节点DB进程异常|主节点不受影响|  
|
|26|  
|  
|  
|  
|备节点磁盘心跳异常+备节点reboot|主节点不受影响|  
|
|27|  
|  
|  
|  
|主节点磁盘心跳故障+网络异常|若网络断连，备无法切主，系统异常；网络延时、拥塞等备节点可能不受影响|  
|
|28|  
|  
|  
|  
|主节点磁盘心跳故障+主节点YCS进程异常|备节点不受影响|  
|
|29|  
|  
|  
|  
|主节点磁盘心跳故障+主节点DB进程异常|备节点不受影响|  
|
|30|  
|  
|  
|  
|主节点磁盘心跳故障+主节点reboot|备节点不受影响|  
|
|31|  
|  
|n个不同故障  **先后**  发生（+列举不分先后，可随意排序组合）|带DB业务|网络故障+备节点磁盘心跳故障+备节点DB进程异常+备节点YCS进程异常+备节点reboot|主节点业务不受影响|自动化时，任意排列组合。|
|32|  
|  
|  
|  
|主节点磁盘心跳故障+网络异常（不含断连）+主节点DB进程异常+主节点YCS异常+主节点reboot|备节点业务不受影响|自动化时，任意排列组合。|
|33|不同故障|叠加故障|最多两个不同故障  **同时**  发生|不带DB业务|网络故障+备节点磁盘心跳故障|主节点不受影响|  
|
|34|  
|  
|  
|  
|网络故障+备节点YCS进程异常|主节点不受影响|  
|
|35|  
|  
|  
|  
|网络故障+备节点DB进程异常|主节点不受影响|  
|
|36|  
|  
|  
|  
|网络故障+备节点reboot|主节点不受影响|  
|
|37|  
|  
|  
|  
|备节点磁盘心跳故障+网络故障|主节点不受影响|  
|
|38|  
|  
|  
|  
|备节点磁盘心跳异常+备节点YCS进程异常|主节点不受影响|  
|
|39|  
|  
|  
|  
|备节点磁盘心跳异常+备节点DB进程异常|主节点不受影响|  
|
|40|  
|  
|  
|  
|备节点磁盘心跳异常+备节点reboot|主节点不受影响|  
|
|41|  
|  
|  
|  
|主节点磁盘心跳故障+网络异常|若网络断连，备无法切主，系统异常；网络延时、拥塞等备节点可能不受影响|  
|
|42|  
|  
|  
|  
|主节点磁盘心跳故障+主节点YCS进程异常|备节点不受影响|  
|
|43|  
|  
|  
|  
|主节点磁盘心跳故障+主节点DB进程异常|备节点不受影响|  
|
|44|  
|  
|  
|  
|主节点磁盘心跳故障+主节点reboot|备节点不受影响|  
|
|45|  
|  
|n个不同故障  **同时**  发生|带DB业务|网络故障+备节点磁盘心跳故障+备节点DB进程异常+备节点YCS进程异常+备节点reboot|主节点业务不受影响|自动化时，任意排列组合。|
|46|  
|  
|  
|  
|主节点磁盘心跳故障+网络异常（不含断连）+主节点DB进程异常+主节点YCS异常+主节点reboot|备节点业务不受影响|自动化时，任意排列组合。|


  


#### 3.2.1.2 YFS故障相关的用例补充

TBD

### 3.2.2  四节点场景用例设计

理论上，四节点可以代表三节点以上的所有多节点部署架构，因此这里主要针对四节点场景进行测试设计即可。

四节点需要考虑仍需要考虑以下几类故障：

网络故障包括：网络丢包、网络时延、网卡故障等；

进程异常包括：kill -9,   ~~kill -19， kill -18, ~~    kill -15 

磁盘心跳异常：通过27号埋点  YCS_RM_FAULT_POINT_27  构造

服务器宕机：reboot构造。

资源类故障场景：  **启动前**  内存耗尽、CPU满等。（这部分在两节点故障中已覆盖，原则上无区别）

#### 3.2.2.1 YCS四节点故障场景

四节点与两节点的主要区别有：

1）存在一主多备的角色；

2）存在多点发生故障不可用的情况。

因此，多节点故障主要针对故障节点的角色（主备）、发生故障的节点数目（单一、多个）以及故障发生的顺序（并发、先后）等维度进行设计。

四节点故障主要考虑以下场景（优先级从上到下，从左到右，依次降低）：

**1）单节点故障：**

**a) 主节点故障：**  单一故障、多次同类故障（连续）、多不同类故障（连续、叠加）  --  主要观察切主过程中，备节点表现（不可下线不可重启）；新主优先为nodeid小的节点

**b) 备节点故障：**  单一故障、多次同类故障（连续）、多不同类故障（连续、叠加） 

**2）两节点故障：**

**a)**  **主备故障：**  同类故障（多点、连续）、不同类故障（多点、连续）

**b) 备备故障：**  同类故障（多点、连续）、不同类故障（多点、连续）

**3）三节点故障：**

**a)**  **主备备故障：**  同类故障（多点、连续）、不同类故障（多点、连续）

**b) 备备备故障：**  同类故障（多点、连续）、不同类故障（多点、连续）

具体故障组合见

[YDBRD-21560 YCS支持多节点故障（四节点YCS）--测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDFhMWFkOWEzMzExZGM4NTg2IiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.3coTxDXaGL2CBTfCN_t-dVwvbvqLzluaH1aq34E6QB4)

**注：**  以上场景涉及的网络故障中，原则上会需要覆盖2+2， 1+3，3+1的脑裂场景。

  


**3.2.2.2 YFS四节点故障场景**

  [YFS 支持多节点故障测试设计](141585741.html)  

### 3.2.3 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，考虑了故障并发|
|KT|是，有考虑YCS、DB等进程异常场景|
|长稳|不涉及，长稳主要关注DB故障情况下的故障恢复和多次稳定运行，四节点已做过相关测试。|
|一致性|是，已考虑故障前后业务一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，该需求不涉及sql语法层面的新增/修改|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|是，本身就是故障类测试|
|HA|规格中不支持HA模式|
|压力|此次测试不考虑压力专项，只维护基本功能|
|性能|此次测试不考虑性能专项，只维护基本功能|
|可维护性|是，用例会自动化维护|


# 4. 测试用例

[YCS多节点故障门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDE4OTcwYzJhZjRmNTIwNzExIiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.BofmkD78xYanUo9nTUkzAX5Y9qW8szld6F2P-qUNEKU)

[YDBRD-21560 YCS支持多节点故障测试设计.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDE4OTcwYzJhZjRmNTIwNzEyIiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.gVNEwnQl1GZ1SEp9MELxNZaTKXJ9Bdd1QO6eOLhdnkE)

# 5. 测试框架设计

自动化主要使用HA框架实现。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

两节点故障：YCS 10人天； YFS ？人天

四节点故障：YCS 14人天；YFS 

## Attachments:

[image2024-1-10_17-5-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDE4OTcwYzJhZjRmNTIwNzEzIiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.3sO7WGz5soAN2EfxOITUqTtgujVQU8R5d327C1pFP0w)

 (image/png)    


[YDBRD-21560 YCS支持多节点故障--测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDFhMWFkOWEzMzExZGM4NTg3IiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.cU6Rsvo1OYsGYOKh7EG1YHS_5gWl6kgktYoILstbbD4)

 (application/x-xmind)    


[YDBRD-21560 YCS支持多节点故障（四节点YCS）--测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDFhMWFkOWEzMzExZGM4NTg2IiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.3coTxDXaGL2CBTfCN_t-dVwvbvqLzluaH1aq34E6QB4)

 (application/x-xmind)    


[YCS多节点门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDE4OTcwYzJhZjRmNTIwNzE0IiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.Z_rnJrc7s3q2CMD4NHMgr8OgH38G6mjtGPeiUI_W0wc)

 (text/plain)    


[YCS多节点故障门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDE4OTcwYzJhZjRmNTIwNzExIiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.BofmkD78xYanUo9nTUkzAX5Y9qW8szld6F2P-qUNEKU)

 (text/plain)    


[YDBRD-21560 YCS支持多节点故障测试设计.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDE4OTcwYzJhZjRmNTIwNzE1IiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.fbFpFrMobSJjaoFCNCBq8S3lGNbvIZUcKlrZG-8V8l8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-21560 YCS支持多节点故障测试设计.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDJhMWFkOWEzMzExZGM4NTg4IiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.ghramLA97ur7BcuZ0X0CNa7bk5YCtpMWE_E6WEDxZGQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-21560 YCS支持多节点故障测试设计.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDE4OTcwYzJhZjRmNTIwNzEyIiwicmVmX2lkIjoiNjczOTZiZDE3MjgyMDZlZmI5MmYwYThhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk5LCJleHAiOjE3ODIzODM1OTl9.gVNEwnQl1GZ1SEp9MELxNZaTKXJ9Bdd1QO6eOLhdnkE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2024/1/18 周四10：00-10：30    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：Trump、陈步隆、李垠、杜宇轩、陈俊杰、吕雷奇、张茜、徐凡博    
  五、会议主题：【YDBRD-21560】YCS支持多节点故障--测试设计评审    
    
  会议纪要：    
  1、两节点内存、CPU资源类运行中故障需摸底测试一下；    
  2、kill -19暂时约束不测，kill -19 的保护计划在YDBRD-21385实现（理论上也是无法完全避免所有问题）    
  3、针对约束”超过四节点故障场景暂时不完全支持“的变更：理论上支持，开发未自测，不作为转测约束    
  4、YFS部分针对状态变化会有比较多的加固测试场景，与YCS故障观测点不同，后续会再评审（雷奇）    
  5、轻量级故障会观测集群系统表现，多重故障叠加主要以业务表现观测系统可用性和健壮性。    
    
  测试设计文档：    
    [--https://conf.yasdb.com/pages/viewpage.action?pageId=141571337](null)  ,Posted by xufanbo at 一月 19, 2024 14:28|
|---|
|  [](null)  ,与开发确认，kill -19限制YCS和DB进程，暂时都不测。,Posted by xufanbo at 一月 19, 2024 14:37|
