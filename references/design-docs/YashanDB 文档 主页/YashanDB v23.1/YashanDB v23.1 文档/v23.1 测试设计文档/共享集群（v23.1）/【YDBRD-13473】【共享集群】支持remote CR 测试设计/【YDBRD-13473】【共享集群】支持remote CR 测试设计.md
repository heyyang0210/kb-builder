Created by 张丽红, last modified on 十一月 08, 2023

**SR链接：**    [YDBRD-13473](https://jira.yasdb.com/browse/YDBRD-13473?src=confmacro)    **-**  **【共享集群】支持remote CR**  **完成**

**开发设计文档链接：**    [全局一致性读(GCR)](109582559.html)  

# **1.概述**

单机CR读：通过current block + query scn可以生成一个对当前查询可见的CR block

集群模式下：如果current block在本地，那CR读的机制和单机是一致的；但是如果current block不在本地且在其他实例，此时通过CR Transfer的机制完成一致性读，避免无效的block传输。

# **2.需求分析**

### 功能特性

- 提供CR请求转换为本地读盘的能力，当current block不在本地，且不在其他实例，发生的CR的请求可以直接读盘。
- 提供远程实例构建CR block的能力，当current block不在本地，且在其他实例，发生的CR请求可以路由在其他实例，由其他实例构建CR block返回。
- 提供CR请求的并发访问，协调多个实例之间同时对同一个block的CR 访问。


### 主要消息场景

- CR 本地读
- master发送CR block
- owner 发送CR block
- master排队CR请求
- owner没有current block    



# **3.规格**

1、部署形态：集群

2、测试环境：模拟器

3、集群节点个数：4节点为上限

# **4.约束限制**

1. 不支持消息异常处理。
1. 不支持Memeory mapped tablespace


# **5.动态视图/配置参数**

### **5.1 配置参数：**  **_REMOTE_CR_THRESHOLD，该参数在技术项目阶段已经新增，但是技术项目阶段并未做测试，在产品化阶段需要做测试**

|参数|参数说明|默认值|取值范围|生效方式|参数类型|备注|
|---|---|---|---|---|---|---|
|_REMOTE_CR_THRESHOLD|实例持有remote CR block的最大数,当requester请求同一个current block的CR block次数超过限制时  ，下次及后续CR请求会自动转换为current S请求，直到本地S block被失效，该参数设置的就是这个阈值|4|   [0, 255]|立即生效|隐藏参数|  
|


### **5.2 动态视图：本次不涉及动态视图的新增和转测，测试过程中涉及到一些场景构造是否成功，可以使用已有动态视图来进行查询，主要涉及以下几个动态视图：**

V$GLS_LOCK    
  V$GRC_RESOURCE    
  V$RESOURCE_REQUEST    
  V$GRC_PASTCOPY    
  V$BUFFER_CONTROL    
  V$SYSSTAT    
  V$SYSTEM_EVENT

# **6.测试设计方法**

**1、本次测试主要针对基础场景做全量覆盖，精确构造必现场景做覆盖，重点就是这部分的测试，场景是否构造成功要有观测手段来验证（v$buffer_control，v$grc_resources，v$gls_lock）**  **--------详细步骤需要根据具体场景梳理，是否校验成功需要开发帮忙一起确认**

2、对于大数据量大业务的并发，统一在ddl/dml/ddl+dml的并发中去考虑，不会在这里再次做重复测试

3、对于配置参数，按照配置参数的公共测试方法去做测试

# **7.详细测试设计**

## **7.1 全场景测试时考虑的因素**

### 7.1.1 RMO模型中，RMO3者之间的关系

|编号|RMO3者之间的关系|备注|
|:---|:---|:---|
|1|requester与master在相同节点，owner在单独节点|  
|
|2|owner与master在相同节点，requester在单独节点|  
|
|3|requester与owner在相同节点，master在单独节点|  
|
|4|requester/master/owner分别在不同节点|  
|
|5|requester/master/owner都在相同节点|这种场景是单个实例上的场景，不必做重点验证|
|6|无owner，requester和master在相同节点|主要在"  CR 本地读  "这种消息流中会用到|
|7|无owner，requester和master在不同节点|主要在"  CR 本地读  "这种消息流中会用到|


### 7.1.2 对资源的请求方式

|编号|请求方式|请求实例|备注|
|:---|:---|:---|:---|
|1|串行|相同实例|  
|
|2|并行|相同实例|  
|
|3|串行|不同实例|  
|
|4|并行|不同实例|  
|


### 7.1.3 消息处理场景

|编号|场景描述|消息流交互|备注|
|:---|:---|---|---|
|1|CR 本地读|前提：所有实例都没有持有current block    
  1、requester发现本地无可用的CR block以及current block，requester发送CR请求到master    
  2、master检查当前block没有owner，授权requester本地读    
  3、requester本地读完当前block，回复ACK给master，注册owner|A:requester和master是相同实例时，不会有跨实例消息交互    
  B:requester和master是不同实例时，会有跨实例消息交互|
|2|master发送CR block|前提：当前有实例持有current block，且持有current block的实例是master    
  1、requester发现本地无可用的CR block以及current block，发送CR请求到master    
  2、master检查到当前实例也是owner，直接读取本地block构造CR发送给requester|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同|
|3|owner 发送CR block|前提：当前有实例持有current block，且持有current block的实例不是master    
  1、requester发现本地无可用的CR block以及current block，发送CR请求到master    
  2、master检查到current block有owner，路由CR 请求到当前owner    
  3、当前owner生成CR发送给requester|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同|
|4|master排队CR请求|前提：当前current block上有别的并发请求    
  1、requester发现本地无可用的CR block以及current block，发送CR请求到master    
  2、master发现current block上有别的请求在进行，master排队当前的CR请求，直到请求被唤醒；master路由CCR请求到owner    
  3、owner生成CR发送给requester    
  4、requester收到CR block后，闭环消息请求，使得master可以唤醒下一个请求|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同,备注：这种场景没法儿单独构造，需要在并发场景中碰撞|
|5|owner没有current block|前提：owner在转发CR block时，发现自己没有current block    
  1、requester发现本地无可用的CR block以及current block，发送CR请求到master    
  2、master路由CR请求到owner    
  3、owner发现自己本地无可用的current block用于构造CR block，重新路由请求到master通知master    
  4、master排队当前的CR请求，直到请求被唤醒；master路由CCR请求到新owner    
  5、新owner生成CR发送给requester    
  6、requester收到CR block后，闭环消息请求，使得master可以唤醒下一个请求|A:RMO3者关系不同时，走的消息流分支不同    
  B:owner类型不同时，走的消息流分支不同    
  C:owner个数不同时，走的消息流分支不同,备注：这种场景没法儿单独构造，需要在并发场景中碰撞|


  


### 7.1.4 owner个数以及owner类型

|编号|owner个数|owner类型|备注|
|:---|:---|:---|:---|
|1|无owner|/|  
|
|2|1个owner|xowner|  
|
|3|多个owner|1个xowner和多个sowner|  
|


### 7.1.5 涉及到的基础对象

|编号|对象类型|备注|
|:---|:---|:---|
|1|表|  
|
|2|索引|  
|
|3|lob|  
|
|4|临时表|  
|


### 7.1.6 涉及到的读写操作业务

|编号|读写操作|操作子类型|操作子类型|备注|
|:---|:---|:---|:---|:---|
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
|ddl写操作|create|  
|
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


### 7.1.7 请求CR block时current block所在的位置

|编号|current block的位置|备注|
|---|---|---|
|1|current block在本地|  
|
|2|current block不在本地，且不在其它实例|  
|
|3|current block不在本地，且在其它实例|  
|


### 7.1.8 请求CR block的次数

|编号|请求CR block的次数|备注|
|---|---|---|
|1|小于  _REMOTE_CR_THRESHOLD阈值|  
|
|2|等于  _REMOTE_CR_THRESHOLD阈值|  
|
|3|大于  _REMOTE_CR_THRESHOLD阈值|  
|


### 7.1.9 CR block读之后是否修改此block

|编号|CR block读之后是否修改此block|备注|
|---|---|---|
|1|只做CR block读操作|  
|
|2|CR block读之后对其进行修改操作|  
|


### 7.1.10 请求CR block时，其它实例上针对该current block开启的事务的状态

|编号|请求CR block时，其它实例上针对该current block开启的事务的状态|涉及的|备注|
|---|---|---|---|
|1|事务未结束|  
|  
|
|2|事务已结束-commit|  
|  
|
|3|事务已结束-rollback|  
|  
|


### 7.1.11 构建CR block时其它实例上有事务，涉及的其它实例的个数

|编号|### 构建CR block时跨越的实例个数|备注|
|---|---|---|
|1|0个实例，没有任何实例上有事务|  
|
|2|1个实例，有1个实例上有事务|  
|
|3|2个实例，有2个实例上有事务|这里可以多考虑一点，考虑部分实例上事务commit，部分实例上事务rollback，部分实例上事务未提交|
|4|3个实例，有3个实例上有事务|  
|


## **7.2 对基础场景的全量测试**

测试方式：对于基础流程，精确构造必现场景做覆盖，这部分主要测串行场景，如果特定场景需要并行的方式来构造，针对特定场景用并行手段去构造。

### "CR 本地读/master发送CR block/owner 发送CR block"场景，这部分主要是串行场景，构造起来相对比较容易

将上述涉及到的各个因素做正交组合后，作为一个全量的测试场景，详细测试场景如下：

|编号|消息场景|RMO3者,之间的关系|请求资源,的方式|请求资源,的实例|owner个数|owner类型|操作对象|操作业务|请求CR block时,current block所在的位置|构建CR block时其它实例上有事务，涉及的其它实例的个数|请求CR block的,次数|CR block读之后,是否修改此block|请求CR block时，,其它实例上针对该current block开启的事务的状态|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|101|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|临时表|基础读写操作|current block在本地|1|大于阈值|只做CR block读操作|事务未结束|
|102|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|索引|基础读写操作|current block不在本地-且在其它实例|1|等于阈值|CR block读之后对其进行修改操作|事务已结束-commit|
|103|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|索引|基础读写操作|current block不在本地-且不在其它实例|2|小于阈值|只做CR block读操作|事务已结束-rollback|
|104|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|lob|基础读写操作|current block在本地|1|小于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|105|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|表|基础读写操作|current block在本地|2|等于阈值|只做CR block读操作|事务已结束-commit|
|106|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|lob|基础读写操作|current block不在本地-且在其它实例|2|大于阈值|CR block读之后对其进行修改操作|事务未结束|
|107|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|临时表|基础读写操作|current block不在本地-且不在其它实例|3|等于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|108|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|临时表|基础读写操作|current block不在本地-且在其它实例|0|小于阈值|只做CR block读操作|事务已结束-commit|
|109|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|表|基础读写操作|current block不在本地-且不在其它实例|0|大于阈值|CR block读之后对其进行修改操作|事务未结束|
|110|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|索引|基础读写操作|current block在本地|3|大于阈值|只做CR block读操作|事务未结束|
|111|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|索引|基础读写操作|current block在本地|0|等于阈值|只做CR block读操作|事务已结束-rollback|
|112|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|lob|基础读写操作|current block不在本地-且不在其它实例|0|等于阈值|只做CR block读操作|事务已结束-commit|
|113|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|临时表|基础读写操作|current block不在本地-且在其它实例|2|大于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|114|CR 本地读|无owner-requester和master在相同节点|串行|不同实例|无owner|/|表|基础读写操作|current block不在本地-且在其它实例|3|小于阈值|CR block读之后对其进行修改操作|事务未结束|
|115|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|lob|基础读写操作|current block不在本地-且不在其它实例|3|大于阈值|只做CR block读操作|事务已结束-commit|
|116|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|表|基础读写操作|current block不在本地-且不在其它实例|1|等于阈值|只做CR block读操作|事务未结束|
|117|CR 本地读|无owner-requester和master在不同节点|串行|不同实例|无owner|/|表|基础读写操作|current block不在本地-且在其它实例|1|等于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
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
|  
|  
|  
|
|201|master发送CR block|无owner-requester和master在相同节点|串行|不同实例|多个owner|1个xowner和多个sowner|索引|基础读写操作|current block在本地|3|小于阈值|只做CR block读操作|事务未结束|
|202|master发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|lob|基础读写操作|current block不在本地-且不在其它实例|0|等于阈值|CR block读之后对其进行修改操作|事务已结束-commit|
|203|master发送CR block|无owner-requester和master在不同节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block不在本地-且在其它实例|0|大于阈值|只做CR block读操作|事务已结束-rollback|
|204|master发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|表|基础读写操作|current block不在本地-且在其它实例|3|大于阈值|CR block读之后对其进行修改操作|事务已结束-commit|
|205|master发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block不在本地-且不在其它实例|1|等于阈值|只做CR block读操作|事务已结束-rollback|
|206|master发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block不在本地-且不在其它实例|2|小于阈值|CR block读之后对其进行修改操作|事务未结束|
|207|master发送CR block|无owner-requester和master在相同节点|串行|不同实例|1个owner|xowner|临时表|基础读写操作|current block在本地|1|大于阈值|CR block读之后对其进行修改操作|事务未结束|
|208|master发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|表|基础读写操作|current block在本地|2|等于阈值|只做CR block读操作|事务已结束-rollback|
|209|master发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|临时表|基础读写操作|current block不在本地-且在其它实例|2|小于阈值|只做CR block读操作|事务已结束-commit|
|210|master发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|临时表|基础读写操作|current block不在本地-且在其它实例|3|等于阈值|CR block读之后对其进行修改操作|事务未结束|
|211|master发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block在本地|1|小于阈值|只做CR block读操作|事务已结束-commit|
|212|master发送CR block|无owner-requester和master在不同节点|串行|不同实例|1个owner|xowner|表|基础读写操作|current block不在本地-且不在其它实例|1|小于阈值|CR block读之后对其进行修改操作|事务未结束|
|213|master发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|临时表|基础读写操作|current block不在本地-且不在其它实例|2|大于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|214|master发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block在本地|0|等于阈值|只做CR block读操作|事务未结束|
|215|master发送CR block|无owner-requester和master在相同节点|串行|不同实例|1个owner|xowner|临时表|基础读写操作|current block在本地|0|小于阈值|只做CR block读操作|事务已结束-rollback|
|216|master发送CR block|无owner-requester和master在相同节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block不在本地-且在其它实例|2|等于阈值|CR block读之后对其进行修改操作|事务已结束-commit|
|217|master发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block不在本地-且不在其它实例|3|等于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|218|master发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block在本地|3|大于阈值|只做CR block读操作|事务未结束|
|219|master发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|1个owner|xowner|表|基础读写操作|current block在本地|0|等于阈值|CR block读之后对其进行修改操作|事务未结束|
|220|master发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block不在本地-且在其它实例|1|小于阈值|CR block读之后对其进行修改操作|事务未结束|
|221|master发送CR block|无owner-requester和master在相同节点|串行|不同实例|多个owner|1个xowner和多个sowner|表|基础读写操作|current block不在本地-且不在其它实例|3|小于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|222|master发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|表|基础读写操作|current block不在本地-且在其它实例|2|大于阈值|只做CR block读操作|事务已结束-commit|
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
|  
|  
|  
|
|301|owner 发送CR block|无owner-requester和master在相同节点|串行|不同实例|多个owner|1个xowner和多个sowner|索引|基础读写操作|current block在本地|3|小于阈值|只做CR block读操作|事务未结束|
|302|owner 发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|lob|基础读写操作|current block不在本地-且不在其它实例|0|等于阈值|CR block读之后对其进行修改操作|事务已结束-commit|
|303|owner 发送CR block|无owner-requester和master在不同节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block不在本地-且在其它实例|0|大于阈值|只做CR block读操作|事务已结束-rollback|
|304|owner 发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|表|基础读写操作|current block不在本地-且在其它实例|3|大于阈值|CR block读之后对其进行修改操作|事务已结束-commit|
|305|owner 发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block不在本地-且不在其它实例|1|等于阈值|只做CR block读操作|事务已结束-rollback|
|306|owner 发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block不在本地-且不在其它实例|2|小于阈值|CR block读之后对其进行修改操作|事务未结束|
|307|owner 发送CR block|无owner-requester和master在相同节点|串行|不同实例|1个owner|xowner|临时表|基础读写操作|current block在本地|1|大于阈值|CR block读之后对其进行修改操作|事务未结束|
|308|owner 发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|表|基础读写操作|current block在本地|2|等于阈值|只做CR block读操作|事务已结束-rollback|
|309|owner 发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|临时表|基础读写操作|current block不在本地-且在其它实例|2|小于阈值|只做CR block读操作|事务已结束-commit|
|310|owner 发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|临时表|基础读写操作|current block不在本地-且在其它实例|3|等于阈值|CR block读之后对其进行修改操作|事务未结束|
|311|owner 发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block在本地|1|小于阈值|只做CR block读操作|事务已结束-commit|
|312|owner 发送CR block|无owner-requester和master在不同节点|串行|不同实例|1个owner|xowner|表|基础读写操作|current block不在本地-且不在其它实例|1|小于阈值|CR block读之后对其进行修改操作|事务未结束|
|313|owner 发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|临时表|基础读写操作|current block不在本地-且不在其它实例|2|大于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|314|owner 发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block在本地|0|等于阈值|只做CR block读操作|事务未结束|
|315|owner 发送CR block|无owner-requester和master在相同节点|串行|不同实例|1个owner|xowner|临时表|基础读写操作|current block在本地|0|小于阈值|只做CR block读操作|事务已结束-rollback|
|316|owner 发送CR block|无owner-requester和master在相同节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block不在本地-且在其它实例|2|等于阈值|CR block读之后对其进行修改操作|事务已结束-commit|
|317|owner 发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|1个owner|xowner|索引|基础读写操作|current block不在本地-且不在其它实例|3|等于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|318|owner 发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block在本地|3|大于阈值|只做CR block读操作|事务未结束|
|319|owner 发送CR block|requester与master在相同节点-owner在单独节点|串行|不同实例|1个owner|xowner|表|基础读写操作|current block在本地|0|等于阈值|CR block读之后对其进行修改操作|事务未结束|
|320|owner 发送CR block|无owner-requester和master在不同节点|串行|不同实例|多个owner|1个xowner和多个sowner|lob|基础读写操作|current block不在本地-且在其它实例|1|小于阈值|CR block读之后对其进行修改操作|事务未结束|
|321|owner 发送CR block|无owner-requester和master在相同节点|串行|不同实例|多个owner|1个xowner和多个sowner|表|基础读写操作|current block不在本地-且不在其它实例|3|小于阈值|CR block读之后对其进行修改操作|事务已结束-rollback|
|322|owner 发送CR block|requester与owner在相同节点-master在单独节点|串行|不同实例|1个owner|xowner|表|基础读写操作|current block不在本地-且在其它实例|2|大于阈值|只做CR block读操作|事务已结束-commit|


### "master排队CR请求"这种场景需要并发场景来构造，构造起来相对比较费劲

构造方式：  小字段表，大数据量，全表查和全表写同时进行

校验方式：日志和视图2种方式，但是视图基本看不到，日志可以看到，但看到的概率也很小

### "  owner没有current block  "这种场景需要并发场景来构造，构造起来相对比较费劲

构造方式：

|1. 实例0、1、2；1是master，2是owner
1. 实例0、实例2同时分别请求CR，和recycle
1. CR请求先到了master，然后recycle到master不需要排队，
1. master回复recycle的ACK先到了实例2owner
1. 然后master 要求实例2owner构建CR的请求后到了
1. 上面的步骤就会出现实例2owner在构建CR时没有命中current block，因为自己的current block已经被recycle
|
|:---|


校验方式：这种场景和开发沟通，无可观测的统计项，只能通过并发场景来构造，不能精确构造

## **7.3 配置参数测试**

配置参数的测试主要采用配置参数的公共测试方法，主要使用边界值法和等价类划分法，涉及以下几个角度

1、参数名称的命名规范性（名称中无缩写，隐藏参数以下划线开始）

2、新增参数是否有在产品文档里新增对应的资料描述

3、参数的类型是否正确（隐藏参数/非隐藏参数）

4、参数设置成对应值时的业务场景的测试

5、参数生效方式的验证

6、参数取值的验证

7、基础语法验证

8、业务相关场景验证

配置参数相关的详细测试场景如下：

|测试场景|有效等价类|无效等价类|备注|测试是否完成|
|---|---|---|---|---|
|参数命名的规范性验证|  
|  
|参数名称无缩写，隐藏参数以"_"开头|  
|
|对应参数在资料中有新增，新增信息是否正确|  
|  
|  
|  
|
|参数类型验证|  
|  
|隐藏参数在x$parameter中，非隐藏参数在v$parameter中|  
|
|参数生效方式验证|重启生效-直接写入配置文件启动DB|  
|  
|  
|
|  
|重启生效-通过alter system修改后重启DB|设置scope为"both"/"memory"|  
|  
|
|  
|立即生效-直接写入配置文件启动DB|  
|  
|  
|
|  
|立即生效-通过alter system修改|设置scope为"both"/"spfile"|对于立即生效的参数，设置为"both"/"spfile"/"memory"都可以设置成功|  
|
|参数值校验|默认值|  
|  
|  
|
|  
|最大值|越界值-大于最大值|  
|  
|
|  
|最小值|越界值-小于最小值|  
|  
|
|  
|中间值|  
|  
|  
|
|  
|  
|值为空，值为NULL，值为空串|  
|  
|
|  
|  
|值为特殊字符：中文，小数，非指定的可选项，#￥#…………这类特殊字符|  
|  
|
|  
|  
|在配置文件中，给该参数设置2次值，且2次的值不相同|  
|  
|
|语法验证|  
|关键字缺失-参数名缺失/生效方式关键字缺失|主要是异常场景|  
|
|  
|  
|关键字错误-参数名错误/生效方式关键字错误/不存在|  
|  
|
|业务场景验证|设置该参数值为0|  
|requester发起多次CR请求–---每次都是走current block请求|  
|
|  
|设置该参数值为非0|  
|requester发起CR请求的次数-超过阈值------超过阈值后走current block请求  ，  当前只能看v$buffer_control|  
|
|  
|设置该参数值为0，默认值，最大值|  
|在这3种场景下，对比性能变化，检查实测值是否符合预期；oracle测试也做对比|  
|


性能测试结果记录：最优场景下

|版本|版本说明|_REMOTE_CR_THRESHOLD值|性能结果|截图|备注|
|---|---|---|---|---|---|
|g3d7bbb4|master-最新包性能|默认值4|['sample10minTerm-00,', 'Running', 'Average', 'tpmTOTAL:', '2699250.10', 'Average', 'tpmC:', '1214262.32', 'Memory', 'Usage:', '967MB', '/', '2952MB']  **03:55:09**     OrderedDict([('tpmc10min', '1214262.32'), ('tpmc60min', '1212587.14')])|  
|使用的CI结果|
|g7804be3|yashan-转测包-release版本|默认值4|144w|![](https://pingcode.yasdb.com/atlas/files/public/673969b68970c2af4f51fa1c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|  
|
|  
|  
|最小值0|129w|![](https://pingcode.yasdb.com/atlas/files/public/673969b6a1ad9a3311dc7890/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|  
|
|  
|  
|最大值255|132w|![](https://pingcode.yasdb.com/atlas/files/public/673969b6a1ad9a3311dc7891/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|  
|
|  
|oracle-release版本|默认值4|  
|  
|  
|
|  
|  
|最小值0|  
|  
|  
|
|  
|  
|最大值255|  
|  
|  
|


# **8.测试用例**

  


# **9.测试框架/测试用例自动化**

  


# **10.测试环境说明**

  


# **11.测试版本**

  


# **12.上车工程分析**

**构建号：1784**

**构建链接：**    [https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/1784/](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/1784/)  

**上车工程结果截图：**

![](https://pingcode.yasdb.com/atlas/files/public/673969b6a1ad9a3311dc7892/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)

|工程名称|失败用例|失败原因|解决方案|
|---|---|---|---|
|单机工程|  
|  
|  
|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/1638/](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/1638/)  |ha_TAC/testcase/ha_schedule/Parallel_build/test_sdv_ha_parallelBuild_15.py|现象：并行build31个备机时失败,原因：超过框架设置的超时时间，偶现失败，建议跑last fail,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/1643/](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_2_docker/1643/)  ,![](https://pingcode.yasdb.com/atlas/files/public/673969b68970c2af4f51fa1d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|已pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_3_docker/1632/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_3_docker/1632/)  |ha_LSC/testcase/ha_schedule_backup/backup_basic/test_sdv_backup_21.py|现象：使用备份集恢复，拉起node3时失败,原因：超过框架设置的超时时间，偶现失败，建议跑last fail,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_3_docker/1637/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_3_docker/1637/)  ,![](https://pingcode.yasdb.com/atlas/files/public/673969b6a1ad9a3311dc7893/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|已pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/1649/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/1649/)  |ha_LSC/testcase/ha_schedule_common/path/test_sdv_relative_path_01.py,last fail失败分析：,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_imp_01.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_imp_02.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_01.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_02.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_03.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_04.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_05.py|现象：备份信息中out是一样的，但是报错不一样,原因：超过框架设置的超时时间，偶现失败，建议跑last fail,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/1654/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/1654/)  ,last fail失败原因：YDBRD-11786带来的变更，参数_columnar_slice_rows改名为_MCOL_SLICE_ROWS，参数_COLUMNAR_SLICE_SORT_ROWS/DATA_TRANSFORMERS删除|忽略|
|  
|ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_imp_01.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_imp_02.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_01.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_02.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_03.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_04.py,ha_LSC/testcase/ha_schedule_common/mcol/test_sdv_mcol_create_table_05.py|报错信息："_MCOL_SLICE_ROW"配置参数不存在,原因：YDBRD-11786带来的变更，参数_columnar_slice_rows改名为_MCOL_SLICE_ROWS，参数_COLUMNAR_SLICE_SORT_ROWS/DATA_TRANSFORMERS删除|忽略|
|  
|  
|  
|  
|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1123/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1123/)  |ha/testcase/ha_schedule/DB_objects/alter_user_and_select_user.py|现象：主备倒换时失败,原因：超过框架设置的超时时间，偶现失败，建议跑last fail,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1128/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/1128/)  ,![](https://pingcode.yasdb.com/atlas/files/public/673969b6a1ad9a3311dc7894/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|已pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_test/898/](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_test/898/)  |/dml1/hashjoin/hash_join_right_anti_in_result/test_sdv_hash_right_anti_in_join_combination_result.sql,/dml1/hashjoin/hash_join_right_semi_exists_result/test_sdv_hash_right_semi_exists_join_combination_result.sql,/dml1/hashjoin/hash_join_right_semi_in_result/test_sdv_hash_right_semi_in_join_combination_result.sql|现象：hash join查询结果变更,![](https://pingcode.yasdb.com/atlas/files/public/673969b6a1ad9a3311dc7895/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：arm环境跟x86环境精度存在差异的，之前讨论过是合理的|忽略|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_test/1015/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_test/1015/)  |/storage_dfx/dba_view/dba_synonyms/test_sdv_dba_synonyms.sql|报错："  [1:16]YAS-2013 name is already used by an existing object  ",![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa1e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：怀疑有同名对象，已知会用例作者排查并修改|忽略|
|  
|/datatype/operator/bit_operation/heap/test_sdv_bitfunc_28to33.sql|现象：结果变更，和用例作者确认,![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc7896/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：用例作者修改用例前置时忘记修改该用例，导致用例结果失败，最新修改用例已合入master|忽略|
|  
|/DFX/system_parameter/parameter/heap/test_parameter_003.sql,/DFX/system_parameter/parameter/heap/test_parameter_004.sql,/DFX/system_parameter/parameter/heap/test_parameter_005.sql|现象：配置参数查询结果变更,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa1f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：该配置参数在最新库上已经删除，变更忽略|忽略|
|  
|/plsql_DBMS_external/dbms_metadata/getddl_plsql/test_sdv_dbms_metadata_getddl_package_011.sql,/plsql_DBMS_external/dbms_metadata/getddl_plsql/test_sdv_dbms_metadata_getddl_package_012.sql,/plsql_DBMS_external/dbms_metadata/getddl_table/test_sdv_dbms_getddl_table_005.sql,/plsql_DBMS_external/dbms_metadata/getddl_table/test_sdv_dbms_metadata_getddl_04.sql,/plsql_DBMS_external/dbms_metadata/getddl_view/test_sdv_getddl_view_07_heap.sql,/plsql_DBMS_external/dbms_stats/set_prefs/test_sdv_dbms_set_prefs_14.sql,/plsql_DBMS_external/dbms_stats/set_prefs/test_sdv_dbms_set_prefs_15.sql,/plsql_DBMS_external/dbms_stats/set_prefs/test_sdv_dbms_set_prefs_16.sql,/plsql_DBMS_external/dbms_stats/set_prefs/test_sdv_dbms_set_prefs_18.sql,/plsql_DBMS_external/dbms_stats/set_prefs/test_sdv_dbms_set_prefs_post.sql|失败原因：有core产生，导致失败，需要重新跑lastfail,原因：  数据库连接失败，环境上并无core对应时间点的core产生，开发分析后，定位该工程并无core产生，建议重新跑last fail,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_test/1028/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_test/1028/)  ,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa20/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|已pass|
|  
|/plsql_DBMS_external/external_procedures/test_sdv_YDBRD7448_add_audit.sql|现象：视图查询结果变更,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa21/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：用例受到了别的用例影响，已知会用例作者修改相应用例到主库，可忽略|忽略|
|  
|/plsql_DBMS_external/dbms_stats/selectance/histograms/test_sdv_histogram_4096.sql,/plsql_DBMS_external/dbms_stats/selectance/sigletable/test_sdv_sigletb_4096.sql|现象：报错"虚拟内存池不足",![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa22/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：VM_BUFFER_SIZE=2G为2G时才可以，当前框架上设置VM_BUFFER_SIZE=32M，遵从主库原则，可忽略|忽略|
|  
|/dml2/merge_into/heap/merge_full_join_result/test_sdv_merge_full_join_combination_result.sql,/dml2/merge_into/heap/merge_left_join_result/test_sdv_merge_left_join_combination_result.sql,/dml2/merge_into/heap/merge_right_join_result/test_sdv_merge_right_join_combination_result.sql,/dml2/merge_into/heap/merge_semi_join_exists_result/test_sdv_merge_semi_exists_join_combination_explain.sql,/dml2/merge_into/heap/merge_semi_join_in_result/test_sdv_merge_semi_in_join_combination_result.sql|现象：查询结果变更,原因：arm环境跟x86环境精度存在差异的，之前讨论过是合理的|忽略|
|  
|/system_view/all_view/TAB_VIEW/ALL_TAB_PRIVS.sql|现象：查询结果未排序，导致结果随机,![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc7897/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：未排序导致，需要用例作者修改用例到主库，已知会用例作者，可忽略|忽略|
|  
|/system_view/all_view/all_tables/test_sdv_all_tables_same_name_otheruser.sql|现象：查询结果变化,![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc7898/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：全库的统计信息在凌晨2点的时候会自动搜集，这几个字段都是统计信息相关的字段，这个用例执行时间正好在凌晨2点钟，忽略|忽略|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_4_docker/549/](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_4_docker/549/)  |ha_LSC/testcase/ha_schedule_common/slice/test_sdv_slice_compact_01.py|现象：修改配置参数后启库失败,![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc7899/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc789a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因  ：scol_slice_rows是昨天合入新增的参数，上车代码未rebase，符合预期，忽略,  
|忽略|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_7_docker/353/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_7_docker/353/)  |/|原因：工程问题报错，建议重新跑一遍,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_7_docker/358/](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_7_docker/358/)  ,![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc789b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|已pass|
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_bcp_docker/512/](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_bcp_docker/512/)  |heap_bcp.parttable.test_sqlloader_heap_hash_132.SqlLoader132,test_datatype,heap_bcp.parttable.test_sqlloader_heap_interval_161.SqlLoader161,test_datatype,heap_bcp.parttable.test_sqlloader_heap_range_148.SqlLoader148,test_datatype,heap_bcp.parttable.test_sqlloader_heap_range_151.SqlLoader151,test_datatype|报错信息：table test_sqlloader_132 is in setting logging async!!!,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa23/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：等待异步ckpt超时，概率性出现，原因是机器卡，尝试重跑一次lastfail，当前默认超时时间是15s,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_bcp_docker/517/](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_bcp_docker/517/)  ,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa24/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|已pass|
|  
|  
|  
|  
|
|集群工程|  
|  
|  
|
|  [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_test/135/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_test/135/)  |/global_memory/grc/grc_parameter/test_sdv_cluster_grc_parameter_GRC_TASK_COUNT_002.sql,/global_memory/grc/grc_parameter/test_sdv_cluster_grc_parameter_GRC_TASK_COUNT_001.sql,/global_memory/gcs/gcs_cr/parameter__REMOTE_CR_THRESHOLD/test_sdv_gcs_ydbrd_13473_cr_block_parameter__REMOTE_CR_THRESHOLD_006.sql,/global_memory/gcs/gcs_cr/parameter__REMOTE_CR_THRESHOLD/test_sdv_gcs_ydbrd_13473_cr_block_parameter__REMOTE_CR_THRESHOLD_003.sql,/global_memory/gcs/gcs_cr/parameter__REMOTE_CR_THRESHOLD/test_sdv_gcs_ydbrd_13473_cr_block_parameter__REMOTE_CR_THRESHOLD_004.sql,/global_memory/gcs/gcs_cr/parameter__REMOTE_CR_THRESHOLD/test_sdv_gcs_ydbrd_13473_cr_block_parameter__REMOTE_CR_THRESHOLD_007.sql,/global_memory/gcs/gcs_cr/parameter__REMOTE_CR_THRESHOLD/test_sdv_gcs_ydbrd_13473_cr_block_parameter__REMOTE_CR_THRESHOLD_010.sql|现象：,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa25/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),原因：配置参数中新增"  DEFAULT_VALUE  "字段，转测包中没有，替换预期后，重新跑last fail,last fail构建号：    [https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_test/139/](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_test/139/)  ,![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc789c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|已pass|
|  
|  
|  
|  
|
|分布式工程|  
|  
|  
|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/516/](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/516/)  |test_ha_mn_noload_killmn_04|mn节点选主慢，校验30s还未选出主----用例不稳定|忽略|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_Stability_debug_asan_docker/516/](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_Stability_debug_asan_docker/516/)  |/lsc/imp/path/base/lsta_alter_slice20220117|_MCOL_SLICE_ROWS报错不存在----新上车SR影响|忽略|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_FT_1_docker/536/](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_FT_1_docker/536/)  |/lsc/dml/simple_queries/lsc_sq_35|_MCOL_SLICE_ROWS报错不存在----新上车SR影响|忽略|
|  
|/lsc/dml/function/test_sdv_dml_rpad_LSC_base|V$SYSSTAT新增记录|替换预期|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_FT_2_docker/423/](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_FT_2_docker/423/)  |/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_03,/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_05,/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_06,/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_07,/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_partition_01,/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_partition_03,/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_partition_04,/lsc/ddl/create_alter_table_mcol/test_sdv_create_duplicated_table_mcol_partition_05,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_03,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_05,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_06,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_07,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_partition_01,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_partition_03,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_partition_04,/lsc/ddl/create_alter_table_mcol/test_sdv_create_sharded_table_mcol_partition_05|失败原因：,1、  _MCOL_SLICE_ROWS报错不存在,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa26/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),2、,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa27/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),其他特性也有同样失败  ----新上车SR影响|忽略|
|  
|/lsc/ddl/lsc_order/test_sdv_orderkey_ydbrd13038_lsc_05,/lsc/ddl/lsc_order/test_sdv_orderkey_ydbrd13038_lsc_07,/lsc/ddl/lsc_order/test_sdv_orderkey_ydbrd13038_lsc_08,/lsc/ddl/lsc_order/test_sdv_orderkey_ydbrd13038_lsc_09|_MCOL_SLICE_ROWS报错不存在----新上车SR影响|忽略|
|  
|/lsc/ddl/alter_slice/test_paramter_data_transformer_enabled,/lsc/ddl/alter_slice/test_paramter_scol_slice_rows|参数data_transformer_enabled，scol_slice_rows报错不存在----新上车SR影响|忽略|
|  
|/lsc/ddl/alter_slice/test_sdv_compact_async_01,/lsc/ddl/alter_slice/test_sdv_compact_async_02,/lsc/ddl/alter_slice/test_sdv_compact_async_03,/lsc/ddl/alter_slice/test_sdv_compact_async_05,/lsc/ddl/alter_slice/test_sdv_compact_async_06,/lsc/ddl/alter_slice/test_sdv_compact_ydbrd11786_01,/lsc/ddl/alter_slice/test_sdv_compact_ydbrd11786_02,/lsc/ddl/alter_slice/test_sdv_compact_ydbrd11786_03,/lsc/ddl/alter_slice/test_sdv_transform_compact_01,/lsc/ddl/alter_slice/test_sdv_transform_compact_02,/lsc/ddl/alter_slice/test_sdv_transform_compact_03,/lsc/ddl/alter_slice/test_sdv_transform_compact_04,/lsc/ddl/alter_slice/test_sdv_transform_compact_05,/lsc/ddl/alter_slice/test_sdv_transform_compact_06,/lsc/ddl/alter_slice/test_sdv_transform_compact_07,/lsc/ddl/alter_slice/test_sdv_transform_compact_08|1、,![](https://pingcode.yasdb.com/atlas/files/public/673969b78970c2af4f51fa28/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),2、  参数data_transformer_enabled报错不存在,---------新上车SR影响|忽略|
|  
|/lsc/sys_view/test_sdv_sys_view_dv_session,/lsc/sys_view/test_sdv_sys_view_dv_desc,/lsc/sys_view/test_sdv_dv_lsc_slice_stat,/lsc/sys_view/test_sdv_dv_sql_stats|线程名变更，新增字段sorted，compacted  ---新上车SR影响|  
  忽略|
|  
||||
|  
|/lsc/sys_view/test_sit_view_slice_stat,/lsc/sys_view/test_sit_view_slice_stat_pre|参数_MCOL_SLICE_ROWS变化---新上车SR影响|忽略|
|  
|/lsc/sys_view/test_sdv_dv_mystat,/lsc/sys_view/test_sdv_dv_sesstat|查询结果增多，新增统计信息,select group_id,GROUP_NODE_ID,STATISTIC# from DV$MYSTAT where group_id=1 order by 1,2,3;,select distinct STATISTIC# from DV$SESSTAT where group_id=4;|替换预期|
|  
|/lsc/sys_view/test_sdv_dv_system_parameter|配置参数变化|替换预期|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_expimp/336/](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_expimp/336/)  |  [https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_expimp/336/exp_5fimp_5freport/](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_expimp/336/exp_5fimp_5freport/)  |![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc789d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),其他特性也是同样失败|忽略|
|  [https://jenkins.yasdb.com/job/Agile_L2_dst_tac_FT_docker/538/](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_FT_docker/538/)  |/tac/dml/function/test_sdv_dml_rpad_EPC_base,/tac/dml/function/test_sdv_dml_rpad_TAC_base|![](https://pingcode.yasdb.com/atlas/files/public/673969b7a1ad9a3311dc789e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),---  V$SYSSTAT新增记录|替换预期|
|  
|/tac/sys_view/base/test_sdv_DPRD186_dvparameter|查询  dv$parameter：162变为161，324变为322,新增grc_task_count，  DATA_TRANSFORMER  S这个参数也有变化,![](https://pingcode.yasdb.com/atlas/files/public/673969b8a1ad9a3311dc789f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w),![](https://pingcode.yasdb.com/atlas/files/public/673969b8a1ad9a3311dc78a0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|替换预期|
|  
|/tac/sys_view/base/test_sdv_DPRD305_dvsysstat|V$SYSSTAT新增记录,![](https://pingcode.yasdb.com/atlas/files/public/673969b88970c2af4f51fa29/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiT0NBUUFFQURUSUU0Z1FBS0FoWklBRVFDQUFRRUNBSUFLUVlBQ0VCSUFBQUNBQUFBQUFLQUFnSVFJQ0FCQUFJU1VBUkVSUWhCRVFBRUFBQWdVSGdCU0FBSUVBQVlNQUFRSUFFQWdBQUFGQUNBQUFBQVNVQ0FBaFJrQkZRQUlNZ1FBRUFBQUFBaENnWUdDUUFBQkFBRUFFQWtBQUFBRUNJQWdGSkVFQUFLQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDg1MDAsImV4cCI6MTc4MjIxOTMwMH0.kZwpgBTylUanhaOF0ppRNvBqDMdNUqM_4B93XL0gp8w)|替换预期|


## Attachments:

## Comments:

|  [](null)  ,待对齐疑问：已对齐，2023/5/20，忠友,0、实例持有remote CR block的最大数，这个是requester来统计还是owner来统计，需要明确机制？？,答：：当前机制是requester来统计，后期可能涉及到这个机制的调研和修改,  
  1、集群模式下，如果current block在本地，那CR 读的机制和单机是否一致,答：：一致,  
  2、如果current block不在本地，那又怎么读？,答：：按照当前该需求的机制即可,  
  3、"CR本地读"场景和"current block本地读"场景一样？区别在哪里？current block读的是当前页，CR block读的是过去页？"requester本地读完当前block，回复ACK给master，注册owner"这里读的是CR block吧，只是说读CR block的时候，需要先持有current block,答：：current block读的是当前页，CR block读的是过去页；"requester本地读完当前block，回复ACK给master，注册owner"这里读的是CR block吧，只是说读CR block的时候，需要先持有current block,  
  4、"master发送CR block"的场景中，为什么不需要发送闭环消息？那master怎么知道requester收到了？在gcs的current block S请求场景中，如果master是owner，master把current block发给requester之后，requester是否需要回复ACK给master？需要的吧？,答：：只有涉及到current block的owner变更时，才需要发送闭环消息，CR block的读取是不需要发送闭环消息的（这里指的是基础场景，有部分特殊场景是需要发送闭环消息的）；在gcs的current block S请求场景中，是需要发送闭环消息的,  
  5、"master发送CR block"的场景中，如果此时有多个owner都持有current block怎么处理？是什么机制？,答：：有多个owner时，只要识别到master是owner，master就会直接发送，不会管其它owner,  
  6、"owner发送CR block"的场景中，如果当前有多个owner（xowner+sowner），那"路由CR 请求"给owner时，是给任意一个owner吗？,答：：是的，"路由CR 请求"给owner时，是给任意一个owner,  
  7、"owner发送CR block"的场景中，为什么也不需要发送闭环消息？,只有涉及到current block的owner变更时，才需要发送闭环消息，CR block的读取是不需要发送闭环消息的,  
  8、"master排队CR请求"的场景中，CR请求下发时，发现有别的并发请求，这里的"并发请求"是指不同类型的请求（比如读写请求）还是同类型的请求（CR请求），什么情况下CR请求会很久，久到需要排队？,答：：这里的并发请求，指的是读写请求；CR请求本身是可以并发，不需要排队的；CR请求和CR请求本身可以并发；CR请求和读/写/recycle请求可以并发；读/写/recycle请求本身是不可以并发的；在前面的读写请求很多的场景下需要排队,  
  9、"owner没有命中current block"的场景中，owner转发CR block时，发现自己没有current block，为什么会有这种场景？,答：：（1）比如现在有2个请求同时下发，分别是"CR 读"请求和"recycle"请求,          （2）如果"CR 读"请求先到达了master，"recycle"请求后到达了master,          （3）但是在不同实例间进行消息传送时（master发送消息给owner）时，"recycle"请求对应的消息先到达，那等"CR 读"请求到达后，就会发现自己没有current block，因为已经被"recycle"请求给淘汰掉了,  
,10、CR请求下发时，CR请求的构造为什么不会跨越3个实例，只会跨越2个实例？,答：：（1）CR请求下发时只涉及requester和owner的交互，master只是做了一个协调的事情，真正做事和交互的是requester和owner，这里只涉及2个实例,          （2）如果当前有3个实例都对current block进行了修改，scn分别是1，2，3；这个时候在实例3上请求CR block（scn为0），那这个时候的处理机制是，实例3（owner）先获取事务block，检查自己有没有CR block的undo，如果有的话，自己直接回滚，然后将CR block发送给前台客户端；如果自己没有，那直接回滚自己当前能回滚的给requester，再由requester发送请求给持有undo的实例（分别是实例1和实例2），由他们去构造对应的CR block给前台客户端。,Posted by zhanglihong at 五月 13, 2023 14:24|
|---|
