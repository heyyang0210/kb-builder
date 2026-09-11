Created by 郝鑫刚, last modified on 七月 12, 2023

  [YDBRD-13622](https://jira.yasdb.com/browse/YDBRD-13622?src=confmacro)    -  UDP的集群化改造  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

UDP的功能适配在集群下正常使用。

1.1 集群下一个实例上CREATE/REPLACE PACKAGE后可以在其它实例上使用PACKAGE。

1.2 集群下一个实例上DROP PACKAGE后其它实例上也不能使用。

1.3 集群下PACKAGE并行DDL无core。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

  


|功能|  
|  
|
|:---|:---|:---|
|CREATE/REPLACE PACKAGE|  
|  
|
|CREATE/REPLACE PACKAGE BODY|  
|  
|
|ALTER PACKAGE|compile|  
|
|DROP PACKAGE|  
|  
|
|DROP PACKAGE BODY|  
|  
|
|使用PACKAGE变量，全局变量区,使用PACKAGE子过程体|  
|  
|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

  


本次无新增功能，只是适配UDP的原有功能在集群多实例下的使用。

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

UDP本身的并发控制策略：

|场景|并发策略|  
|
|---|---|---|
|CREATE PACKAGE|OBJ$索引控制并发，置为PACK_COMPILING状态|  
|
|REPLACE PACKAGE|dcLockNsEntryByName，置为PACK_COMPILING状态|  
|
|DROP PACKAGE|dcLockNsEntryByName，置为PACK_DROPING状态|  
|
|CREATE PACKAGE BODY|如果存在PACKAGE：OBJ$索引控制并发|  
|
|REPLACE PACKAGE BODY|如果存在PACKAGE： dcLockNsEntryByName，置为PACK_COMPILING状态|  
|
|ALTER PACKAGE|dcTryLockNsEntryWithPublic，置为PACK_COMPILING状态|  
|
|ALTER PACKAGE BODY|如果存在PACKAGE：dcTryLockNsEntryWithPublic，置为PACK_COMPILING状态|  
|
|使用package变量或子过程|dcTryLockNsEntryWithPublic，callCount++|  
|


适配集群化后需要改造的部分

*dcLockNsEntryByName、*  *dcTryLockNsEntryWithPublic*

  


1. 先获取集群锁，再获取本地spinLock。避免在其它时候操作中需求spinLock而死锁。
1. DDL时候获取PACK的X锁，DML时候获取PACK的S锁（有修改status操作的）
1. ~~PACK BODY不会单独使用，必须通过PACK使用，所以在PACK BODY的DDL外不需要持有PACK BODY OID的锁。~~
1. 并发编译没问题，但是我们并发编译时候有同时写表的情况，可能索引冲突。写表时索引冲突不报错。（解决方法2 增加互斥锁保证多个实例只有一个编译）


|场景|适配|  
|
|---|---|---|
|CREATE PACKAGE|创建过程中有oid后使用  axcLockRWLock(X)  ,commit时写实例消息创建其他实例entry,doCreatePack两阶段编译结束后再axcUnlockRWLock()|~~通过dcLockNsEntryByName，OBJECT_TYPE_PACKAGE_BODY获取出body的entry，置NO_READY。~~  必然是NO_READY。|
|REPLACE PACKAGE|使用dcSoLockNsEntry()获取集群锁（gls X锁）和本地锁,commit时发消息将其他实例的entry置为NO_READY状态，version++,两阶段结束后再放锁|~~需要注意REPLACE PACKAGE后如果有PACKAGE BODY需要同步失效~~  、全局变量区域要失效|
|DROP PACKAGE|使用dcSoLockNsEntry()获取集群锁（gls X锁）和本地锁,commit时发消息删除其他实例的entry以及放锁|  
|
|CREATE PACKAGE BODY|~~获取PACKAGE的gls X锁（如果有）~~,创建过程中获取body的  axcLockRWLock(X),commit时写实例消息创建其他实例entry,两阶段编译结束后再  axcUnlockRWLock()|~~PACKAGE存在要置NO_READY~~  、全局变量区域要失效,PACKAGE不存在也要在其它实例创建DictEntry,  
|
|REPLACE PACKAGE BODY|~~获取PACKAGE的gls X锁（如果有）~~,使用dcSoLockNsEntry()获取集群锁（gls X锁）和本地锁,将其他实例的entry置为NO_READY状态,所有实例version++,commit,两阶段结束后再  axcUnlockRWLock()|~~PACKAGE存在要置NO_READY~~  、全局变量区域要失效,PACKAGE不存在也要在其它实例创建DictEntry|
|DROP PACKAGE BODY|~~获取PACKAGE的gls X锁（如果有）~~,使用dcSoLockNsEntry()获取集群锁（gls X锁）和本地锁,commit时发消息drop其他实例的entry以及放锁|~~PACKAGE存在要置NO_READY~~,全局变量区域要失效|
|ALTER PACKAGE|~~使用dcSoLockNsEntry()获取PACK集群锁（gls X锁）和本地锁~~,~~将其他实例的PACK和PACK BODY entry置为NO_READY状态~~,~~recompile结束后~~  ~~axcUnlockRWLock()~~,获取S锁。编译完成后放锁。|  
|
|ALTER PACKAGE BODY|~~使用dcSoLockNsEntry()获取PAKC集群锁（gls X锁）和本地锁~~,~~将其他实例的PACK和PACK BODY entry置为NO_READY状态~~,~~recompile结束后~~  ~~axcUnlockRWLock()~~,获取S锁。编译完成后放锁。|  
|
|使用package变量或子过程,anlVerifyPackEntity,ankPreparePack|使用dcSoLockNsEntryWithPublic()获取集群锁（gls S索引）和本地锁,使用结束后  axcUnlockRWLock()|  
|
|  
|  
|  
|


**场景时序图**

![](https://pingcode.yasdb.com/atlas/files/public/67396b50a1ad9a3311dc821d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI5NzMsImV4cCI6MTc4MjMwMzc3M30.Q7gY2k3ZC0vsMy9VXRyPWrjgE4VPTOlVBpMmvHhVYbM)

特殊场景

是否需要考虑将其他实例的package失效后的依赖失效问题。（如果不进行依赖失效，可能会出现package全局变量区无法及时清除，与单机上表现有所差别）

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考**  ** **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** **  **）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考**  ** **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** **  **）。用于支撑测试方案的灰盒测试。**

  


**参考 gAXCMsgProcessor 中的实现DictEntry同步。**

  


目前有统一的CREATE \ALTER \DROP接口，先以不加消息的方式实现。

## Attachments:

[image2023-5-29_21-12-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNTBhMWFkOWEzMzExZGM4MjFiIiwicmVmX2lkIjoiNjczOTZiNTA1OTNmOTljOWZmMjM2MGJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyOTczLCJleHAiOjE3ODIzNzkzNzN9.5edQRIzuZ6hGtExHs555e3dDNaM8IZO_9281SF7k7YU)

 (image/png)    
