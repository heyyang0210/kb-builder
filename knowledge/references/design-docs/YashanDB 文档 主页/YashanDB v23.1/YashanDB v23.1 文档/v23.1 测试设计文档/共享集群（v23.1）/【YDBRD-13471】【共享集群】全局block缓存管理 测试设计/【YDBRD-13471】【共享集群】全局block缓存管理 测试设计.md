Created by 张丽红, last modified by  张彩虹 on 十一月 08, 2023

**SR链接：**    [YDBRD-13471](https://jira.yasdb.com/browse/YDBRD-13471?src=confmacro)    **-**  **【共享集群】全局block缓存管理**  **完成**

**开发设计文档链接：**    [全局block缓存管理(GCS)](109582569.html)  

# **1.概述**

全局缓存管理服务(Global Cache Service)，简称GCS。在集群架构下作为核心的组件提供页面缓存服务。在单机模式下，页面的访问通过buffer进行，但在集群模式下，本地buffer只能提供对本地访问能力，同时block的生命周期要复杂很多，block不在本地buffer时，有可能在其他实例的buffer上；即使block在本地的buffer里，它也有可能不是一个有效的页面，是否修改得根据全局资源状态决定。

GCS和GRC以及GLS之间是相互协同合作的，对block的请求消息会首先到达GRC进行排队，GRC有自己的task service，requester请求到达GRC之后，GRC的task service甄别该请求是对block资源的请求之后，会将该消息发给GCS，再由GCS自己的task service负责处理，如果甄别到室对锁资源的申请和处理等相关请求，这个时候会用到GLS，GLS也有自己的task service，会负责处理锁相关消息的处理。

# **2.需求分析**

### 功能特性

- 从共享存储加载block到buffer
- 对block的访问，包括读写
- buffer淘汰
- block的并发访问
- pastcopy的维护


# **3.规格**

1、部署形态：集群

2、测试环境：模拟器环境+磁阵环境

3、集群节点规格：4节点为上限

# **4.约束限制**

- 不支持消息异常处理


# **5.动态视图/配置参数**

### **5.1 动态视图：本次不涉及动态视图的新增和转测，测试过程中涉及到一些场景构造是否成功，可以使用已有动态视图来进行查询，主要涉及以下几个动态视图：**

V$GLS_LOCK    
  V$GRC_RESOURCE    
  V$RESOURCE_REQUEST    
  V$GRC_PASTCOPY    
  V$BUFFER_CONTROL    
  V$SYSSTAT    
  V$SYSTEM_EVENT

# **6.测试设计方法**

## **测试方式**

1、技术项目阶段已针对全量场景做过基础测试，涉及了普通表、分区表、索引3种对象，这次测试在技术项目的基础上做增量测试

2、对于基础流程，精确构造必现场景做覆盖，场景是否构造成功要有观测手段来验证（v$buffer_control，v$grc_resources，v$gls_lock）  --------详细步骤需要根据具体场景梳理，是否校验成功需要开发帮忙一起确认

3、对新增对象，重点测试并发场景；涉及到的新增对象：  同义词、视图、序列、用户

# **7.详细测试设计**

## **7.1 全场景测试时考虑的因素**

### 7.1.1 RMO模型中，RMO3者之间的关系

|编号|RMO3者之间的关系|备注|
|---|---|---|
|1|requester与master在相同节点，owner在单独节点|  
|
|2|owner与master在相同节点，requester在单独节点|  
|
|3|requester与owner在相同节点，master在单独节点|  
|
|4|requester/master/owner分别在不同节点|  
|
|5|requester/master/owner都在相同节点|这种场景是单个实例上的场景，不必做重点验证|
|6|无owner，requester和master在相同节点|主要在"  本地加载block  "这种消息流中会用到|
|7|无owner，requester和master在不同节点|主要在"  本地加载block  "这种消息流中会用到|


### 7.1.2 对资源的请求方式

|编号|请求方式|请求实例|备注|
|---|---|---|---|
|1|串行|相同实例|  
|
|2|并行|相同实例|  
|
|3|串行|不同实例|  
|
|4|并行|不同实例|  
|


### 7.1.3 消息处理场景

|编号|场景描述|消息交互流|备注|
|---|---|---|---|
|1|本地加载block|1、requester本地无可用current block,发送请求给master    
  2、master检查到current block无owner，授权requester本地读    
  3、requester本地读完current block，回复ACK给master，注册owner|A:requester和master是相同实例时，不会有跨实例消息交互    
  B:requester和master是不同实例时，会有跨实例消息交互|
|2|请求current block读|1、requester本地无可用current block,发送请求给master    
  2、master检查到current block有owner，随机选取一个owner路由请求    
  3、owner收到请求后，发送current block到requester    
  4、requester收到current block后，回复ACK给master，注册owner|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同|
|3|请求current block写|1、requester本地无可用current block,发送请求给master    
  2、master检查到current block有多个owner，广播"失效消息"到非Xowner    
  3、sowner收到请求后，失效本地block，回复ACK到master    
  4、master收到最后一个sowner失效的消息后，发送原始请求到xowner    
  5、xowner收到请求后，发送current block到requester并失效本地block    
  6、requester收到current block后，回复ACK给master，注册owner|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同|
|4|请求upgrade block|1、requester本地持有current block的S锁,发送请求给master    
  2、master检查到current block有多个owner，广播"失效消息"到非Xowner    
  3、sowner收到请求后，失效本地block，回复ACK到master    
  4、master收到最后一个sowner失效的消息后，发送原始请求到xowner    
  5、xowner收到请求后，回复ACK到requester并失效本地block    
  6、requester收到ACK后修改本地锁模式，回复ACK给master，修改owner信息|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同    
  D:锁升级类似请求写的流程，但是锁升级只有消息传输，没有block传输    
  E:在并发场景下，进行锁升级的同时，自身的S锁有可能会被失效(其他实例也进行锁升级)。此时需要转换为请求 current block写。|
|5|buffer 淘汰|1、requester进行buffer淘汰，发现当前buffer上持有有效的锁模式，发送淘汰请求到master    
  2、master收到淘汰请求后，发送淘汰ACK给requester    
  3、requester失效本地block锁模式之后，回复ACK给master，清除owner信息|v$SysStat中通过"free buffer requested"统计项可以尝试查看值的变化，但到不了精确的地步|
|6|pc的维护|1、当前实例修改被别的实例持有的脏页时会有pc的产生    
  2、已经持有pc的实例再次持有current block X时，pc被释放    
  3、刷redo时增加机制：只要是脏页就刷(requester收到current block时，通过比较handler的lfn和block的lfn来判断直接进行下一步操作还是等待)|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同,"刷redo时增加的机制"要在故障场景下的一致性中重点考虑|


### 7.1.4 owner个数以及owner类型

|编号|owner个数|owner类型|备注|
|---|---|---|---|
|1|无owner|/|  
|
|2|1个owner|xowner|  
|
|3|多个owner|1个xowner和多个sowner|  
|


### 7.1.5 涉及到的新增对象

|编号|对象类型|备注|
|---|---|---|
|1|同义词|有单独IR转测该需求，|
|2|序列|  
|
|3|用户|  
|
|4|视图|  
|
|5|lob|  
|
|6|临时表|  
|


### 7.1.6 涉及到的读写操作业务

|编号|读写操作|操作子类型|操作子类型|备注|
|---|---|---|---|---|
|1|读操作|dql|select|  
|
|2|写操作|dml|insert|  
|
|3|  
|  
|update|  
|
|  
|  
|  
|delete|  
|
|  
|  
|ddl写操作|create|串行场景中，不用单独测ddl语句，在dml语句中覆盖就可以；ddl和dml的并发中可以针对测试|
|  
|  
|  
|alter|  
|
|  
|  
|  
|drop|  
|


### 7.1.7 pc维护场景中涉及到xowner转移的次数

|编号|xowner转移的次数|备注|
|---|---|---|
|1|1|xowner转移一次会有pc的产生|
|2|3|3节点场景下，xowner转移3次，每次的xowner都不同，每个实例都会有pc|
|3|4|3节点场景下，xowner转移4次，必然会有1个实例释放pc|


## **7.2 基础消息处理场景测试**

测试方式：对于基础流程，精确构造必现场景做覆盖，这部分主要测串行场景，如果特定场景需要并行的方式来构造，针对特定场景用并行手段去构造

### "  本地加载block  "/"  请求current block读  "/"  请求current block写  "场景

这部分测试时，操作对象为基础的表和索引，测试输入条件，会主要考虑  **下面**  这几个因素，将这些因素全量组合后得到的测试场景如下：

考虑的因素：

- 操作对象
- 请求资源的方式
- 请求资源的实例
- 消息处理场景
- RMO3者之间的关系
- "当前持有资源的owner类型"以及"当前持有资源的owner数量"


|场景编号|场景描述|操作对象|RMO3者之间的关系|请求资源的方式|请求资源的实例|当前持有资源的owner类型|当前持有资源的owner数量|备注|
|---|---|---|---|---|---|---|---|---|
|11|本地加载block|表|requester和master在相同节点|串行|多个实例|无owner|无owner|  
|
|12|本地加载block|lob|requester和master在相同节点|串行|多个实例|无owner|无owner|  
|
|13|本地加载block|表+索引|requester和master在不同节点|串行|多个实例|无owner|无owner|  
|
|14|本地加载block|临时表+索引|requester和master在不同节点|串行|多个实例|无owner|无owner|  
|
|15|本地加载block|分区表|requester和master在相同节点|串行|多个实例|无owner|无owner|  
|
|16|本地加载block|分区表+索引|requester和master在相同节点|串行|多个实例|无owner|无owner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|21|请求current block读|表|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|xowner|  
|
|22|请求current block读|表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|23|请求current block读|lob|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|xowner|  
|
|24|请求current block读|临时表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|25|请求current block读|分区表|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|xowner|  
|
|26|请求current block读|分区表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|31|请求current block读|表|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|xowner|  
|
|32|请求current block读|表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|33|请求current block读|lob|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|xowner|  
|
|34|请求current block读|临时表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|35|请求current block读|分区表|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|xowner|  
|
|36|请求current block读|分区表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|41|请求current block读|表|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|xowner|  
|
|42|请求current block读|表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|43|请求current block读|lob|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|xowner|  
|
|44|请求current block读|临时表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|临时表不涉及这种场景：,因为另外的实例写的时候是看不到别的实例的数据的，所以没有办法做修改操作|
|45|请求current block读|分区表|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|xowner|  
|
|46|请求current block读|分区表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|51|请求current block读|表|requester/master/owner分别在不同节点|串行|多个实例|1个owner|xowner|  
|
|52|请求current block读|表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|53|请求current block读|lob|requester/master/owner分别在不同节点|串行|多个实例|1个owner|xowner|  
|
|54|请求current block读|临时表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|55|请求current block读|分区表|requester/master/owner分别在不同节点|串行|多个实例|1个owner|xowner|临时表不涉及这种场景|
|56|请求current block读|分区表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|61|请求current block写|表|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|xowner|  
|
|62|请求current block写|表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|63|请求current block写|lob|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|xowner|  
|
|64|请求current block写|临时表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|临时表不涉及这种场景|
|65|请求current block写|分区表|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|xowner|  
|
|66|请求current block写|分区表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|71|请求current block写|表|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|xowner|  
|
|72|请求current block写|表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|73|请求current block写|lob|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|xowner|  
|
|74|请求current block写|临时表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|临时表不涉及这种场景|
|75|请求current block写|分区表|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|xowner|  
|
|76|请求current block写|分区表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|81|请求current block写|表|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|xowner|  
|
|82|请求current block写|表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|83|请求current block写|lob|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|xowner|  
|
|84|请求current block写|临时表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|临时表不涉及这种场景|
|85|请求current block写|分区表|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|xowner|  
|
|86|请求current block写|分区表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|91|请求current block写|表|requester/master/owner分别在不同节点|串行|多个实例|1个owner|xowner|  
|
|92|请求current block写|表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|93|请求current block写|lob|requester/master/owner分别在不同节点|串行|多个实例|1个owner|xowner|  
|
|94|请求current block写|临时表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|临时表不涉及这种场景|
|95|请求current block写|分区表|requester/master/owner分别在不同节点|串行|多个实例|1个owner|xowner|  
|
|96|请求current block写|分区表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|101|请求upgrade block|表|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|锁升级不涉及这种场景|
|102|请求upgrade block|表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|103|请求upgrade block|lob|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|104|请求upgrade block|临时表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|105|请求upgrade block|分区表|requester与master在相同节点，owner在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|锁升级不涉及这种场景|
|106|请求upgrade block|分区表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|这个场景和编号"66"场景重复，不再重复测试|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|111|请求upgrade block|表|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|112|请求upgrade block|表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|113|请求upgrade block|lob|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|114|请求upgrade block|临时表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|115|请求upgrade block|分区表|owner与master在相同节点，requester在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|116|请求upgrade block|分区表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|121|请求upgrade block|表|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|122|请求upgrade block|表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|123|请求upgrade block|lob|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|124|请求upgrade block|临时表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|125|请求upgrade block|分区表|requester与owner在相同节点，master在单独节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|126|请求upgrade block|分区表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|131|请求upgrade block|表|requester/master/owner分别在不同节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|132|请求upgrade block|表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|这种场景在编号"92"中已覆盖，不再重复覆盖|
|133|请求upgrade block|lob|requester/master/owner分别在不同节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|134|请求upgrade block|临时表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|  
|
|135|请求upgrade block|分区表|requester/master/owner分别在不同节点|串行|多个实例|1个owner|1个xowner和多个sowner|  
|
|136|请求upgrade block|分区表+索引|requester/master/owner分别在不同节点|串行|多个实例|多个owner|1个xowner和多个sowner|这种场景在编号"96"中已覆盖，不再重复覆盖|


### "pc维护"场景

pc维护的场景重点在于多个实例的反复写，xowner不停转移，和其它几个场景的考虑因素不同，所以单独提出来考虑。考虑的因素如下：

- 操作对象
- 请求资源的方式
- 请求资源的实例
- RMO3者之间的关系
- xowner转移的次数


将各种因素全量组合后得到的测试场景如下：

|场景编号|场景描述|操作对象|RMO3者之间的关系|请求资源的方式|请求资源的实例|xowner转移的次数|备注|
|---|---|---|---|---|---|---|---|
|141|pc的维护|表|requester与master在相同节点，owner在单独节点|串行|多个实例|1|  
|
|142|pc的维护|表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|3/4|  
|
|143|pc的维护|lob|requester与master在相同节点，owner在单独节点|串行|多个实例|1|  
|
|144|pc的维护|临时表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|3/4|  
|
|145|pc的维护|分区表|requester与master在相同节点，owner在单独节点|串行|多个实例|1|  
|
|146|pc的维护|分区表+索引|requester与master在相同节点，owner在单独节点|串行|多个实例|3/4|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|
|151|pc的维护|表|owner与master在相同节点，requester在单独节点|串行|多个实例|1|  
|
|152|pc的维护|表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|3/4|  
|
|153|pc的维护|lob|owner与master在相同节点，requester在单独节点|串行|多个实例|1|  
|
|154|pc的维护|临时表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|3/4|  
|
|155|pc的维护|分区表|owner与master在相同节点，requester在单独节点|串行|多个实例|1|  
|
|151|pc的维护|分区表+索引|owner与master在相同节点，requester在单独节点|串行|多个实例|3/4|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|
|161|pc的维护|表|requester与owner在相同节点，master在单独节点|串行|多个实例|1|  
|
|162|pc的维护|表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|3/4|  
|
|163|pc的维护|lob|requester与owner在相同节点，master在单独节点|串行|多个实例|1|  
|
|164|pc的维护|临时表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|3/4|  
|
|165|pc的维护|分区表|requester与owner在相同节点，master在单独节点|串行|多个实例|1|  
|
|166|pc的维护|分区表+索引|requester与owner在相同节点，master在单独节点|串行|多个实例|3/4|  
|
|  
|  
|  
|  
|  
|  
|  
|  
|
|171|pc的维护|表|requester/master/owner分别在不同节点|串行|多个实例|1|  
|
|172|pc的维护|表+索引|requester/master/owner分别在不同节点|串行|多个实例|3/4|  
|
|173|pc的维护|lob|requester/master/owner分别在不同节点|串行|多个实例|1|  
|
|174|pc的维护|临时表+索引|requester/master/owner分别在不同节点|串行|多个实例|3/4|  
|
|175|pc的维护|分区表|requester/master/owner分别在不同节点|串行|多个实例|1|  
|
|176|pc的维护|分区表+索引|requester/master/owner分别在不同节点|串行|多个实例|3/4|  
|


### "  buffer 淘汰  "场景

buffer 淘汰  的场景在单点测试中，没有办法通过单独的串行操作来构造，在测试时，（1）设置data_buffer为较小值，表数据量很大，串行方式可构造；（2）跑ddl/dml并发；观察v$sysStat中"  free buffer requested  "统计项的变化来确认是否有buffer淘汰，但是依旧不能精确构造。

这部分不做单独测试，在并发场景中可以覆盖到。

### "其它组合场景"

这部分组合场景，大部分在基础场景的交叉中，可以覆盖到，但是基于对全场景的考虑，还是组要比较明确的列出场景，做针对性的测试，这部分场景为开发提供，详细场景如下：

|编号|场景描述|消息流机制|场景详细构造方式|备注|  
|
|---|---|---|---|---|---|
|  
|owner在转发block时，block的状态在一个实例上，涉及了多次转换,base->isDirty &&,base->pastCopy == BP_IS_PASTCOPY|1. 实例0上持有b1的X锁
1. 实例1请求b1 的X锁，实例0转发b1，b1在实例0上是pastcopy
1. 实例0请求b1的S锁，实例1转发b1后，降级为S锁
1. 此时master资源信息为：xOwner是实例1，owner是实例0和实例1
1. 实例1进行recycle，master的资源信息变为xOwner是实例0，owner是实例0
1. 实例1在请求b1，实例0转发b1，此时实例0的状态变成前面说的状态
,base->isDirty &&,base->pastCopy == BP_IS_PASTCOPY|  
|这种场景重点描述block在一个实例上的多次状态转换，经历了dirty，pc，current block3种状态，  **这种场景需要单独覆盖**|  
|
|  
|锁升级转为X锁请求|1. 实例0、实例1持有b1 的S锁，两个实例同时做锁升级
1. master先处理了实例0的锁升级，然后会失效调另外一个owner
1. master在处理实例1的锁升级时，需要转为X锁请求
|需要并发场景来构造|**这种场景没有覆盖到，需要单独构造**|  
|
|  
|requester请求current block读时，current block在requester上的一个状态，current block当前被其它实例以写的方式请求持有，在requester上自身为free状态|  
|  
|这种场景在"请求current block读，有1个xowner"的场景中可以覆盖到，不需要再次覆盖|  
|
|  
|requester请求current block读时，current block在requester上的自身的状态为S，即之前以读的方式持有过current block|  
|  
|这种场景在"请求current block读，有多个owner"的场景中可以覆盖到，不需要再次覆盖|  
|
|  
|requester请求current block读时，current block在requester上的自身的状态为X，即之前以读的方式持有过current block|  
|  
|这种场景在"请求current block写，有1个xowner"的场景中可以覆盖到，不需要再次覆盖|  
|
|  
|requester请求current block读时，current block在requester上的自身的状态为past copy|  
|  
|**这种场景没有精准覆盖，需要做覆盖**|  
|
|  
|requester请求current block写时，current block在requester上的自身的状态为free|  
|  
|这种场景在"请求current block写，有1个xowner"的场景中可以覆盖到，不需要再次覆盖|  
|
|  
|requester请求current block写时，current block在requester上的自身的状态为S|  
|  
|这种场景在"请求current block写，有多个owner"的场景中可以覆盖到，不需要再次覆盖|  
|
|  
|requester请求current block写时，current block在requester上的自身的状态为X|  
|  
|这种场景在"请求current block写，有1个xowner"的场景中可以覆盖到，不需要再次覆盖|  
|
|  
|requester请求current block写时，current block在requester上的自身的状态为past copy|  
|  
|这种场景在"pc维护"的场景中可以覆盖到，不需要再次覆盖|  
|


## **7.3 并发场景测试**

测试方式：这部分主要验证各个消息流在并发场景下的处理机制，并发场景下没有办法通过精确的手段来校验消息接收是否正常，只能通过数据库业务的表现是否正常来校验。对于各个消息流，主要涉及读写两类操作，在基本的ddl和dml并发中可以覆盖各种消息流。对于基础的消息流，在上一部分中已经做了一个全量覆盖。所以这部分测试，不会从单个消息流的角度去做测试，而是针对新增对象，从ddl和dml并发的角度去做覆盖。这部分会和GRC、GLS统一测并发场景。主要考虑下面的因素

- 涉及到的对象
- 涉及到的读写操作业务
- 请求资源的实例：多个实例
- 请求资源的方式：并行执行


# **9.测试框架/测试用例自动化**

  


# **10.测试环境说明**

  


# **11.测试版本**

  


## Attachments:

[image2023-5-22_14-31-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjM4OTcwYzJhZjRmNTFmOWZlIiwicmVmX2lkIjoiNjczOTY5YjM1OTNmOTljOWZmMjM1MWQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NDc5LCJleHAiOjE3ODIyOTQ4Nzl9.d5qZxdu8PZY4voZDi1rEU_yXiKFjBxUzlcCuFCek4W0)

 (image/png)    


## Comments:

|  [](null)  ,1、读rowid时是否会读block，第2次读rowid和第一次读rowid有什么区别？    
  A：没区别，本身读rowid时会去读block，但是如果是走索引的话，读的是btree block,Posted by zhanglihong at 五月 30, 2023 16:32|
|---|
|  [](null)  ,质量加固：    [【共享集群】gcs 质量加固](https://conf.yasdb.com/pages/viewpage.action?pageId=141573383)  ,Posted by niuyana at 三月 13, 2024 15:26|
