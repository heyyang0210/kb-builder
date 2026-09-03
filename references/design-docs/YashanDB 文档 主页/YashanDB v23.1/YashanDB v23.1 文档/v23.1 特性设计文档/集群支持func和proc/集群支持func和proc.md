Created by 郝鑫刚, last modified on 六月 12, 2023

  [YDBRD-13620](https://jira.yasdb.com/browse/YDBRD-13620?src=confmacro)    -  procedure和普通udf的集群化改造  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

function和procedure的功能适配在集群下正常使用。

1）function和procedure在一个实例上执行DDL后，其它实例上也有相应变化。

2）function和procedure的DDL并发在集群下无问题。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

  


|功能|  
|  
|
|:---|:---|:---|
|CREATE/REPLACE FUNCTION|  
|  
|
|CREATE/REPLACE PROCEDURE|  
|  
|
|ALTER FUNCTION|compile|  
|
|ALTER PROCEDURE|compile|  
|
|DROP FUNCTION|  
|  
|
|DROP PROCEDURE|  
|  
|
|DML中使用FUNCTION和PROCEDURE|  
|  
|


  


  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

  


  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

  


本次无新增功能，只是适配FUNCTION/PROCEDURE的原有功能在集群多实例下的使用。

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

  


function和procedure使用时候是DictEntry结构，verify通过名字找到DictEntry则认为存在，然后校验参数，参数匹配后记录user、name、oid、entry、version。

执行时通过名字再获取Entry，如果version和oid不变则使用DictEntry执行函数。

  


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

function/procedure本身的并发控制策略：

```
typedef enum EnSoStatus {
    SO_NOREADY,           // 未编译，需要编译才能使用 
    SO_READY,             // 已编译完成。 entity中没有无效的对象则可以执行，否则需要重新编译。
    SO_DROPING,           // 正在删除。
    SO_COMPILING_HEAD,    // 正在编译IS/AS前的head部分，entity还不存在。
    SO_COMPILING_BODY     // 正在编译IS/AS后的body部分，entity中可以获取参数信息。用于verify时并行参数校验。
} SoStatus;
```

  


  


|场景|并发策略|  
|  
|锁适配|其它适配|  
|
|---|---|---|---|---|---|---|
|CREATE     ankCreateSo|创建DictEntry, HEAD, so.callCount++|OBJ$索引控制无并发|通过SpinLock控制同时只有一个连接修改DictEntry结构。,通过so.callCount控制不能DML和DDL并发|有oid后获取gls X锁,持续到soDDLCompileEntity结束。|发消息，其它实例创建DictEntry|  
,通过LwLock保证了获取X锁后其它实例只能是NOREADY或READY（且无连接使用）。,在需要修改DictEntry专题时时首先要获取集群锁。,所以在gls 锁内可以直接修改DictEntry→so。,  
,因为某些接口要获取spinLock（freeEntry），所以申请集群锁时不能持有spinLock。,  
    
|
|REPLACE     ankReplaceSo|*dcLockNsEntryByName*,获取SpinLock。DictEntry->lock,so.callCount > 0报错,DROP、HEAD、BODY报错,  
|status改为HEAD,so.callCount++||根据oid获取gls X锁。,需要持续到soDDLCompileEntity结束。|发消息，其它实例改为NOREADY，version++,如果是READY,主动失效soContext。,失效依赖的对象。||
|DROP    ankDropSo||status改为DROP|根据oid获取gls X锁||发消息，其它实例删除DictEntry,如果是READY,主动失效soContext。,失效依赖的对象。||
|  
,ALTER   |ankInvalidateAndRecompileSo,*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry→lock,READY和NOREADY改HEAD。,so.callCount++,HEAD、BODY、DROP报错。|  
|compile相当于强制进行一次编译动作。|根据oid获取gls X锁|发消息，其它实例改为NOREADY||
|verify      ankVerifySo|*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry→lock,so.callCount++,NOREADY改为HEAD,READY和BODY使用entity,DROP报错。,HEAD等待或超时报错、递归报错。|verifyStoredMethod完成后so.callCount--。,状态最终是READY。,  
|  
,通过status控制不同DML不能同时修改entity。,  
    
    
|根据oid获取gls S锁|  
|  
|
|exec    ankPrepareSo|*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry→lock,DROP 报错。,version或oid变化报错。,so.callCount++|调用so前先将so.callCount++。,执行完后so.callCount--。||根据oid获取gls S锁|  
|  
|
|exec      ankCallSo|*spinLock*,获取SpinLock。DictEntry→lock,DROP 报错。,NOREADY改为HEAD。,READY使用entity。,HEAD或BODY等待或超时报错。||  
||  
|  
|
|dep        ankInvalidateSo|*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry->lock,NOREADY返回。,READY改为NOREADY。,HEAD、BODY、DROP报错|状态最终是NOREADY。||加S锁。|  
|  
|


  


NOREADY时可以操作DictEntry。  可以DDL。

READY且so.callCount == 0时可以操作DictEntry，可以DDL。

HEAD和BODY时so.callCount必然大于0。

  


*dcLockNsEntryByName*

*dcTryLockNsEntryWithPublic*

1）通过名字获取出DictEntry。非集群或entry为NULL返回。

2）保存objectId。然后放spinLock。（不能一直持有spinLock，因为  **处理消息有dcFreeEntry时要获取spinLock**  ）

3）根据记录的objectId获取集群的X锁或S锁。（  **集群下对DictEntry->so修改时保证先获取集群锁，则处理消息时可以不用加锁**  ）

4）根据记录的objectId重新获取DictEntry。如果不存在说明已被删除，放集群锁返回NULL。

5）获取锁，判断entry->objectId和记录的objectId无变化，返回DictEntry。

  


时序问题：

1. 所有DDL操作加gls X锁可以保证部分先收到消息的实例无法在所有实例未处理完当前消息前做DDL操作。（解决CREATE消息先处理的实例DROP且DROP消息先到实例3后core问题）。
1. 要先获取gls 锁再获取本地锁。因为获取gls 锁时可能有其它实例在执行DDL，获取到gls锁后DictEntry结构有变化。除非先在本地记录objectId，version，获取gls后再检查一次。
1. 收到所有实例处理完消息后再放锁。


  


  


|实例0\实例n|CREATE |REPLACE|ALTER |DROP|DML|
|---|---|---|---|---|---|
|CREATE |OBJ$唯一约束|gls X锁|gls X锁|gls X锁|gls X锁|
|REPLACE |OBJ$唯一约束|gls X锁。获取锁后会因为version不一致而报错。|gls X锁。获取锁后会因为version不一致而报错。|gls X锁。获取锁后会因为version不一致而报错。|gls X锁。获取锁后会因为version不一致而报错。|
|ALTER|OBJ$唯一约束|gls X锁|gls X锁|gls X锁|gls X锁|
|DROP |新的DictEntry在EntryBucket前面，实例执行时获取的是新的。,DROP消息通过oid删除|gls X锁。获取锁后会因为oid不一致而报错。|gls X锁。获取锁后会因为oid不一致而报错。,  
|gls X锁。获取锁后会因为oid不一致而报错。|gls X锁。获取锁后会因为oid不一致而报错。|
|DML|OBJ$唯一约束|gls S锁,DML间隙可以REPLACE.,so的context因为version不一致失效,执行前version不一致报错,exec的正常执行结束|gls S锁,DML正常执行，如果编译失败则报错。|gls S锁,DML间隙可以DROP,so的context因为oid不一致失效,执行前oid不一致报错,exec的正常执行结束|可以并发执行|


  


  


  


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考**  ** **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** **  **）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考**  ** **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** **  **）。用于支撑测试方案的灰盒测试。**

  


**参考 gAXCMsgProcessor 中的实现DictEntry同步。**

  


1. 函数接口


|name|Meaning|
|:---|:---|
|AXC_CB->axcBcstCreateSo|广播同步createSo消息|
|AXC_CB->axcBcstReplaceSo|广播同步replaceSo消息|
|AXC_CB->axcBcstDropSo|广播同步dropSo消息|
|AXC_CB->axcBcstAlterSo|广播同步alterSo消息|


1. 消息接口


|name|function|Meaning|
|:---|:---|:---|
|MSG_CREATE_SO|msgCreateSo|以OID创建DictEntry。|
|MSG_CREATE_SO_ACK|msgNullFunc|  
|
|MSG_REPLACE_SO|msgReplaceSo|以OID获取DictEntry，version++,如果是READY,主动失效soContext。,失效依赖的对象。|
|MSG_REPLACE_SO_ACK|msgNullFunc|  
|
|MSG_DROP_SO|msgDropSo|以OID获取DictEntry，删除。,如果是READY,主动失效soContext。,失效依赖的对象。|
|MSG_DROP_SO_ACK|msgNullFunc|  
|
|MSG_ALTER_SO|msgAlterSo|以OID获取DictEntry，设置为NOREADY,如果是READY,主动失效soContext。,失效依赖的对象。|
|MSG_ALTER_SO_ACK|msgNullFunc|  
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

1. 实例0 create function/procedure，实例1、2端验证function/procedure的存在。
1. 实例0 drop function/procedure，实例1、2验证function/procedure的销毁。 
1. 实例0 replace function/procedure，实例1、2验证function/procedure的变化
1. 验证以上ddl的交叉并发是否正确
1. 验证以上ddl并发是否无core。


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及资料变动。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[image2023-5-15_11-40-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGY4OTcwYzJhZjRmNTIwMzk3IiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyODg4LCJleHAiOjE3ODIzNzkyODh9.0EjkdCn93624O5SDGST-TKXTVbamAZZP39vprpb6oac)

 (image/png)    


[image2023-5-14_12-0-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGZhMWFkOWEzMzExZGM4MjBiIiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyODg4LCJleHAiOjE3ODIzNzkyODh9.Eg2l1kQaurZ7iW1sJ3f1IpriK24fOooIuA2B0sbZe_I)

 (image/png)    


[image2023-5-14_11-58-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGZhMWFkOWEzMzExZGM4MjBjIiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyODg4LCJleHAiOjE3ODIzNzkyODh9.0GLYz8GjfjYIY6vuESk2Q2ze7-XtmiYuuFeI8HQJQio)

 (image/png)    


[image2023-5-10_16-10-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGY4OTcwYzJhZjRmNTIwMzk5IiwicmVmX2lkIjoiNjczOTZiNGY1OTNmOTljOWZmMjM2MGEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyODg4LCJleHAiOjE3ODIzNzkyODh9._HVegEVJigucRNYAdyEeLyu8lYkMTvf5ideSnE5bDKo)

 (image/png)    


## Comments:

|  [](null)  ,先获取spinLock时，消息处理时候不需要加spinlock锁。,Posted by haoxingang at 六月 09, 2023 11:36|
|---|
|  [](null)  ,head错误也会创建对象，要考虑发送消息的时机,Posted by haoxingang at 六月 09, 2023 11:56|
