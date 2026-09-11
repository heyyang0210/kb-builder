Created by 郝鑫刚, last modified on 六月 09, 2023

  [YDBRD-13626](https://jira.yasdb.com/browse/YDBRD-13626?src=confmacro)    -  触发器的集群化改造  完成

  


##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

trigger的功能适配在集群下正常使用。

1）触发器在一个实例上执行DDL后，其它实例上也有相应变化。

2）触发器的DDL并发在集群下无问题。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

  


|功能|  
|  
|
|:---|:---|:---|
|CREATE/REPLACE TRIGGER|  
|  
|
|ALTER TRIGGER |rename/compile/enable/disable|  
|
|DROP TRIGGER|  
|  
|
|DML中使用触发器所在的表|  
|  
|


  


  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

CREATE/REPLACE TRIGGER，ALTER TRIGGER，DROP TRIGGER

  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

  


本次无新增功能，只是适配触发器的原有功能在集群多实例下的使用。

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

trigger本身的并发控制策略：

|场景|并发策略|其它动作|  
|
|---|---|---|---|
|CREATE TRIGGER|获取所在用户的S锁。,获取所在表的SHARE锁。,获取dc->triggerSet.latch的X锁。|OBJ$索引控制无并发,  
|  
  表的S锁确保表不能DDL。,latch的X锁保证触发器DDL之间、DDL和DML之间无并发。|
|REPLACE TRIGGER||  
||
|ALTER TRIGGER||  
||
|DROP TRIGGER||  
||
|DML|获取dc->triggerSet.latch的S锁|  
|  
|


  


  


|场景|锁适配|其它适配|备注|
|---|---|---|---|
|CREATE TRIGGER|  
,获取表的S锁,获取表的TRIGGER锁 X锁|发消息，其它实例创建DictEntry，如果dc存在则通过oid从系统表读取触发器，然后将触发器注册到dc。|  
,  
|
|REPLACE TRIGGER||发消息，如果dc存在则移除dc中的触发器，根据oid从系统表读取触发器，然后注册到dc。||
|ALTER TRIGGER||COMPILE： 其它实例设置为NOREADY,ENABLE/DISABLE：设置TriggerHead结构。,RENAME：移除DictEntry、改名、插入DictEntry||
|DROP TRIGGER||发消息，其它实例删除DictEntry，如果dc存在则移除dc中的触发器。||
|DML|获取表的TRIGGER锁 S锁|  
||


  


时序问题：

1. 一个表上的触发器是一把锁，触发器的DDL要求表现存在，收到所有实例处理完消息后再放锁可以保证无乱序问题。


  


  


  


  


  


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考**  ** **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** **  **）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考**  ** **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** **  **）。用于支撑测试方案的灰盒测试。**

  


**参考 gAXCMsgProcessor 中的实现DictEntry同步。**

  


1. 函数接口


|name|Meaning|
|:---|:---|
|AXC_CB->axcBcstCreateTrigger|广播同步create Trigger消息|
|AXC_CB->axcBcstDropTrigger|广播同步drop Trigger消息|
|AXC_CB->axcBcstAlterTrigger|广播同步alter Trigger消息|
|AXC_CB->axcBcstReplaceTrigger|广播同步replace Trigger消息|


1. 消息接口


|name|function|Meaning|
|:---|:---|:---|
|MSG_CREATE_TRIGGER|msgCreateTrigger|创建DictEntry，如果dc存在则通过oid从系统表读取触发器，然后将触发器注册到dc。|
|MSG_CREATE_TRIGGER_ACK|msgNullFunc|  
|
|MSG_DROP_TRIGGER|msgDropTrigger|删除DictEntry，如果dc存在则移除dc中的触发器。|
|MSG_DROP_TRIGGER_ACK|msgNullFunc|  
|
|MSG_ALTER_TRIGGER|msgAlterTrigger|COMPILE： 其它实例DictEntry设置为NOREADY,ENABLE/DISABLE：设置TriggerHead结构。,RENAME：移除DictEntry、改名、插入DictEntry|
|MSG_ALTER_TRIGGER_ACK|msgNullFunc|  
|
|MSG_REPLACE_TRIGGER|msgReplaceTrigger|如果dc存在则移除dc中的触发器，根据oid从系统表读取触发器，然后注册到dc。|
|MSG_REPLACE_TRIGGER_ACK|msgNullFunc|  
|


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. 实例0 create trigger，实例1、2端验证trigger的存在。
1. 实例0 drop trigger，实例1、2验证trigger的销毁。 
1. 实例0 replace trigger，实例1、2验证trigger的变化
1. 验证以上ddl的交叉并发是否正确
1. 验证以上ddl并发是否无core。


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及资料变动。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-5-15_11-40-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTE4OTcwYzJhZjRmNTIwM2FlIiwicmVmX2lkIjoiNjczOTZiNTE3MjgyMDZlZmI5MmYwNDViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzMDEyLCJleHAiOjE3ODIzNzk0MTJ9.sd18Y-N3MNQ6RC-yVA-yB5aJPkocpmNsY3byDMjOp1M)

 (image/png)    


[image2023-5-14_12-0-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTE4OTcwYzJhZjRmNTIwM2IwIiwicmVmX2lkIjoiNjczOTZiNTE3MjgyMDZlZmI5MmYwNDViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzMDEyLCJleHAiOjE3ODIzNzk0MTJ9.9DNObmoVZkuQxW1EA3xR1iIzVnLmBSnk_V0Qi3bPl-U)

 (image/png)    


[image2023-5-14_11-58-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTFhMWFkOWEzMzExZGM4MjI1IiwicmVmX2lkIjoiNjczOTZiNTE3MjgyMDZlZmI5MmYwNDViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzMDEyLCJleHAiOjE3ODIzNzk0MTJ9.w_qDUbFfQlzq1k71ONe60dKJcFQt_Qmg12BRQl9z2lk)

 (image/png)    


[image2023-5-10_16-10-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTFhMWFkOWEzMzExZGM4MjI3IiwicmVmX2lkIjoiNjczOTZiNTE3MjgyMDZlZmI5MmYwNDViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkzMDEyLCJleHAiOjE3ODIzNzk0MTJ9.KF-F2_RuzaUAysUuA3POSSF5fvsY55cgYOrTAe3hChI)

 (image/png)    
