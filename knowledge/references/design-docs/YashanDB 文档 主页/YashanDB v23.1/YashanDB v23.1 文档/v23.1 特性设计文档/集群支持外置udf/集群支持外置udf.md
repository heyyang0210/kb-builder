Created by 未知用户 (liaofeng), last modified on 七月 05, 2023

  [任务列表](https://conf.yasdb.com/pages/resumedraft.action?draftId=112724137&draftShareId=83df98a2-b627-42fe-8d22-b1990594596a&)      [YDBRD-13621](https://jira.yasdb.com/browse/YDBRD-13621?src=confmacro)    -  外置UDF的集群化改造  完成

UDP的功能适配在集群下正常使用。

1.1 集群下一个实例CREATE/REPLACE 外置UDF后可以在其它实例上使用外置UDF。

1.2 集群下一个实例DROP 外置UDF后其他实例也无法使用外置UDF。

1.3 集群下一个实例CREATE/REPLACE LIBRARY后可以在其他实例上使用LIBRARY。

1.4 集群下一个实例DROP LIBRARY后其他实例也无法使用LIBRARY。

1.5 集群下一个实例LOADJAVA后可以在其他实例上使用javalib和library

1.6 集群下一个实例DROPJAVA后可以在其他实例也无法使用javalib和library

  


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

  


|功能|  
|  
|
|:---|:---|:---|
|CREATE/REPLACE 外置UDF,CREATE/REPLACE LIBRARY,ALTER 外置UDF,DROP 外置UDF,DROP LIBRARY,DBMS_STANDARD.LOADJAVA,DBMS_STANDARD.DROPJAVA|  
|  
|
|verify UDF,exec UDF,verify library,使用javalib|  
|  
|


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出本方案对外提供的接口、配置参数、API等。

  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明本方案对外的功能规格或约束。

  


本次无新增功能，只是适配外置UDF、LIBRARY和LOAD/DROPJAVA的原有功能在集群多实例下的使用。

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

**注意：**

**外置UDF依赖于yex_server服务端执行，需要每个实例各自拉起自己的yex_server程序，yasdb与yex_server使用UDS通信（依赖YASDB_DATA/instance/yex.ipc文件）**

  


  


function单机并发控制策略：

```
typedef enum EnSoStatus {
    SO_NOREADY,           // 未编译，需要编译才能使用
    SO_READY,             // 已编译完成。 entity中没有无效的对象则可以执行，否则需要重新编译。
    SO_DROPING,           // 正在删除。
    SO_COMPILING_HEAD,    // 正在编译IS/AS前的head部分，entity还不存在。
    SO_COMPILING_BODY     // 正在编译IS/AS后的body部分，entity中可以获取参数信息。用于verify时并行参数校验。
} SoStatus;
```

  


library单机并发控制策略：

```
typedef enum EnLibraryStatus {
    LIB_NOREADY,              //未编译，需要编译才能使用
    LIB_READY,                //已编译完成，可以使用
    LIB_DROPPING,             //正在删除
    LIB_COMPILING             //正在编译，等待编译成功后才可使用
} LibraryStatus;
```

  


外置UDF并发控制策略及集群化适配：

  


|场景|单机并发策略|集群化适配|其他说明|
|---|---|---|---|
|CREATE 外置UDF|1. 创建DictEntry
1. 置为SO_COMPILEING_HEAD状态
1. so.callCount++
1. 同普通FUNCTION，通过obj$的索引控制没有并发
|1. 创建过程中使用axcLockRWLock(x)
1. commit时写实例消息，创建其他实例entry
1. 两阶段编译结束后再axcUnlockRWlock(x)
|需要在两阶段编译结束后放锁，先放本地锁，再放集群锁|
|REPLACE CREATE 外置UDF|1. dcLockNsEntryByName，获取spinLock
1. 判断callCount>0, DROP, HEAD, BODY状态报错
1. 置为SO_COMPILEING_HEAD状态
1. so.callCount++
|1. 使用  dcSoLockNsEntry  ()获取集群锁（gls X锁）和spinLock（同普通function）
1. commit，发消息，将其他实例的entry置为NO_READY状态，version++
1. 两阶段编译结束后再axcUnlockRWLock()
|其他实例,1. 依赖失效
1. ready状态关闭context
1. 尝试删除对应yex_server proc对象
|
|DROP 外置UDF|1. dcLockNsEntryByName，获取spinLock
1. 判断callCount>0,DROP, HEAD, BODY状态报错
1. 置为SO_DROPPING状态
|1. 使用  dcSoLockNsEntry  ()获取集群锁（gls X锁）和spinLock
1. commit阶段，将其他实例的entry删除
1. axcUnlockRWLock()
||
|ALTER外置UDF|1. dcLockNsEntryByName，获取spinLock
1. 判断DROP, HEAD, BODY状态报错
1. 置为SO_COMPILING_HEAD状态
1. so.callCount++
|1. 使用  dcSoLockNsEntry  ()获取集群锁（gls X锁）和spinLock
,将其他实例的entry置为NO_READY状态,重编译结束后放锁|  
|
|CREATE LIBRARY|1. 创建DictEntry
1. 置为LIB_COMPILING状态
1. so.callCount++
1. 通过obj$的索引控制没有并发
|1. 创建过程中使用axcLockRWLock(X)
1. commit时写实例消息创建其他实例entry
1. 编译结束后再axcUnlockRWLock()
|  
|
|REPLACE LIBRARY|1. dcLockNsEntryByName，获取spinLock
1. 判断callCount>0, DROPPING, COMPLING状态报错
1. 置为LIB_COMPILING状态
1. lib.callCount++
|1. 使用  dcSoLockNsEntry  ()获取集群锁（gls X锁）和spinLock
1. commit阶段发消息，将其他实例entry置为NO_READY状态，version++
1. 编译结束后再axcUnlockRWLock()
|其他实例,1. 依赖失效
1. 尝试删除对应yex_server lib对象
,  
|
|DROP LIBRARY|1. dcLockNsEntryByName，获取spinLock
1. 判断callCount>0, DROPPING, COMPLING状态报错
1. 置为LIB_DROPPING状态
|1. 使用  dcSoLockNsEntry  ()获取集群锁（gls X锁）和spinLock
1. commit时发消息drop其他实例的entry
1. axcUnlockRWLock()
||
|DBMS_STANDARD.LOADJAVA|1. 在CREATE LIBRARY阶段通过obj$的索引控制没有并发
|1. javaLib通过在javaVM上增加锁，避免javaLib的并发
1. 其他同CREATE LIBRARY
|其他实例,创建其他实例entry时要  **同步创建javaLib**|
|DBMS_STANDARD.DROPJAVA|1. 通过extJavaLib的refCount++控制没有并发
1. 在drop library阶段，dcLockNsEntryByName，置为LIB_DROPPING状态
|1. javaLib通过在javaVM上增加锁，避免javaLib的并发
1. 同DROP LIBRARY
,  
|其他实例,1. drop其他实例entry时要  **同步drop JavaLib**
1. 依赖失效
1. 其他尝试删除对应的yex_server lib对象
|
|verify 外置udf（ankVerifySo）|*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry→lock,so.callCount++,NOREADY改为HEAD,READY和BODY使用entity,DROP报错。,HEAD等待或超时报错、递归报错,SpinUnlock|1. 使用  dcSoLockNsEntryWithPublic()  获取集群锁（gls S锁）和spinLock
1. 使用结束后spinUnLock和  axcUnlockRWLock()
,  
|yex_server中对应的proc和lib对象跟随entry进行管理。,  
|
|exec 外置udf（ankPrepareSo)|*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry→lock,DROP 报错。,version或oid变化报错。,so.callCount++,SpinUnlock|||
|exec  外置udf（  ankCallSo）|获取SpinLock。DictEntry→lock,DROP 报错。,NOREADY改为HEAD。,READY使用refer entity。,HEAD或BODY等待或超时报错。,spinUnlock|  
|  
|
|verify/exec,LIBRARY/javaLib（ankVerifyLibrary）|*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry→lock,so.callCount++,READY正常使用,NOREADY改为COMPILING,DROP报错。,COMPILING等待为READY或超时报错|1. 使用  dcSoLockNsEntryWithPublic()  获取集群锁（gls S锁）和spinLock
1. 使用结束后spinUnLock和  axcUnlockRWLock()
|  
|
|depend (ankInvalidateSo)|*dcTryLockNsEntryWithPublic*,获取SpinLock。DictEntry->lock,NOREADY返回。,READY改为NOREADY。,HEAD、BODY、DROP报错||  
|


dcSoLockNsEntry()

dcSoLockNsEntryWithPublic()

1）通过名字获取出DictEntry。非集群或entry为NULL返回。

2）保存objectId。然后放spinLock。（不能一直持有spinLock，因为  **处理消息有dcFreeEntry时要获取spinLock**  ）

3）根据记录的objectId获取集群的X锁或S锁。（  **集群下对DictEntry->so修改时保证先获取集群锁，则处理消息时可以不用加锁**  ）

4）根据记录的objectId重新获取DictEntry。如果不存在说明已被删除，放集群锁返回NULL。

5）获取锁，判断entry->objectId和记录的objectId无变化，返回DictEntry。

  


|实例0\实例n|CREATE |REPLACE|ALTER |DROP|DML|
|:---|:---|:---|:---|:---|:---|
|CREATE |OBJ$唯一约束|gls X锁|gls X锁|gls X锁|gls X锁|
|REPLACE |OBJ$唯一约束|gls X锁。获取锁后会因为version不一致而报错。|gls X锁。获取锁后会因为version不一致而报错。|gls X锁。获取锁后会因为version不一致而报错。|gls X锁。获取锁后会因为version不一致而报错。|
|ALTER|OBJ$唯一约束|gls X锁|gls X锁|gls X锁|gls X锁|
|DROP |DROP消息通过oid删除前，entry已存在报错。,DROP消息通过oid删除后，不影响|gls X锁。获取锁后会因为oid不一致而报错。|gls X锁。获取锁后会因为oid不一致而报错。,  
|gls X锁。获取锁后会因为oid不一致而报错。|gls X锁。获取锁后会因为oid不一致而报错。|
|DML|entry存在,OBJ$唯一约束|gls S锁,DML间隙可以REPLACE.,so的context因为version不一致失效,执行前version不一致报错,exec的正常执行结束|gls S锁,DML正常执行，如果编译失败则报错。|gls S锁,DML间隙可以DROP,so的context因为oid不一致失效,执行前oid不一致报错,exec的正常执行结束|可以并发执行|


### 注意：

javaLib可能出现以下情况

1. 实例0进行loadjava，还未发送消息
1. 实例n也刚好进行loadjava，获取了同一个id的javalib
1. 实例0发送消息给实例n，创建了这个id的javalib
1. 实例n由于obj$唯一索引，创建library失败，将这个id的javalib还给pool，导致并发异常（dropjava也有类似的问题）


**由于loadjava，dropjava为兼容性语法，不推荐使用，使用频率较低，采取对javaLib进行ddl过程全程加锁的简化处理来避免上述问题**

1. 实例0发送消息给实例n创建这个id的javalib，与实例n自己创建这个id的javalib互斥


  


### javaLib并发

|实例0\实例n|loadjava|dropjava|drop library|dml|
|---|---|---|---|---|
|loadjava|OBJ$唯一约束|gls X锁|gls X锁|gls X锁|
|dropjava|drop消息通过oid发送前，entry已存在报错。,drop消息发送后，不影响|gls X锁|gls X锁|gls X锁|
|drop library|drop消息通过oid发送前，entry已存在报错。,drop消息发送后，不影响|gls X锁|gls X锁|gls X锁|
|dml|entry存在，报错,obj$唯一约束|gls X锁,  
,DML间隙可以drop，后续再使用时报错|gls X锁,  
,DML间隙可以drop，后续再使用时报错|可以并发执行|


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考**  ** **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** **  **）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考**  ** **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** **  **）。用于支撑测试方案的灰盒测试。**

  


**参考 gAXCMsgProcessor 中的实现DictEntry同步。**

  


1. 函数接口


|name|Meaning|  
|
|:---|:---|---|
|AXC_CB->axcBcstCreateSo|广播同步createSo消息|  
|
|AXC_CB->axcBcstReplaceSo|广播同步replaceSo消息|  
|
|AXC_CB->axcBcstDropSo|广播同步dropSo消息|  
|
|AXC_CB->axcBcstAlterSo|广播同步alterSo消息|  
|
|AXC_CB->axcBcstCreateLibrary|广播同步createLibrary消息|区分javaLib,  
|
|AXC_CB->axcBcstReplaceLibrary|广播同步replaceLibrary消息||
|AXC_CB->axcBcstDropLibrary|广播同步dropLibrary消息||
|  
|  
|  
|


1. 消息接口


|name|function|Meaning|
|:---|:---|:---|
|MSG_CREATE_SO|msgCreateSo|以OID创建DictEntry。|
|MSG_CREATE_SO_ACK|msgNullFunc|  
|
|MSG_REPLACE_SO|msgReplaceSo|以OID获取DictEntry，version++,如果是READY,主动失效soContext。,失效依赖的对象。,如果是外置UDF，尝试删除yex_server上对应的proc|
|MSG_REPLACE_SO_ACK|msgNullFunc|  
|
|MSG_DROP_SO|msgDropSo|以OID获取DictEntry，删除。,如果是READY,主动失效soContext。,失效依赖的对象。,如果是外置UDF，尝试删除yex_server上对应的proc|
|MSG_DROP_SO_ACK|msgNullFunc|  
|
|MSG_ALTER_SO|msgAlterSo|以OID获取DictEntry，设置为NOREADY,如果是READY,主动失效soContext。|
|MSG_ALTER_SO_ACK|msgNullFunc|  
|
|  
|  
|  
|
|MSG_CREATE_LIBRARY|msgCreateLibrary|以OID创建DictEntry,如果是JavaLib，用libId创建ExtJavaLib|
|MSG_CREATE_LIBRARY_ACK|msgNullFunc|  
|
|MSG_REPLACE_LIBRARY|msgReplaceLibrary|以OID获取DictEntry，version++,失效依赖的对象。,尝试删除yex_server上对应的lib|
|MSG_REPLACE_LIBRARY_ACK|msgNullFunc|  
|
|MSG_DROP_LIBRARY|msgDropLibrary|以OID获取DictEntry，删除。,如果是javaLib，用libId获取ExtJavaLib，删除,失效依赖的对象。,尝试删除yex_server上对应的lib|
|MSG_DROP_LIBRARY_ACK|msgNullFunc|  
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

1. 实例0 create library/udf，实例1，2正常使用library/udf
1. 实例0 drop library/udf，实例1，2验证library/udf销毁
1. 实例0 replace library/udf，实例1，2验证library/udf变更
1. 验证ddl并发


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及资料变动。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*