Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66b329568f5ee191734b1c62](https://pingcode.yasdb.com/pjm/items/66b329568f5ee191734b1c62)    *?*    
  *#YDBRD-31269 YCS实例启停和故障仲裁优化*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#1-%E6%80%BB%E8%BF%B0)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

ycs启动流程、停止流程、故障处理流程、选举和重连断连信息消息池处理流程、同属于  **一个线程处理**  ，启停与选举和重连断连信息消息池处理属于两个完全独立的功能，不应该  **耦合**  到一起。此次需要优化此逻辑。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

与优化相关的问题单合集：    [YCS主线程耦合CM的业务逻辑](https://conf.yasdb.com/pages/viewpage.action?pageId=156114968)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|把选举和重连断连信息消息池处理的能力单独抽一个线程出来|设计一个线程用于处理选举和重连断连信息消息池。|是|是|----|
|  
|故障信息处理流程部分可优化|删去一些冗余操作和代码|是|是|  
|
|  
|CM里的内部重启废弃|删除对应代码|是|是|  
|
|  
|不影响原有场景和能力|----|是|是|----|
|性能|RTO场景|因为处理故障的流程有变化，RTO场景需要跑一下|是/否|是/否|----|
|  
|性能场景2|----|是/否|是/否|----|
|可用性|不影响原有能力|---|是|是|----|
|可靠性|不影响原有能力|----|是|是|----|
|可维可测|不影响原有工程|  
|是|是|----|
|安全|安全场景1|----|是/否|是/否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|----|----|是/否|是/否|----|
|周边配合|权限|----|----|是/否|----|
|周边配合|审计|----|----|是/否|----|
|周边配合|---|----|----|是/否|----|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

内部代码优化，无依赖。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#2-%E6%8E%A5%E5%8F%A3)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|是/否|
|SQL语法|语法分支2描述|----|是/否|
|函数|参数/返回值描述|----|是/否|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

具体约束：

- 新增线程处理原有消息池的同时不影响原有的能力
- 删除代码不影响现有逻辑实现


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    原有主线程中的故障信息处理能力优化

首先梳理一下原有线程处理异常消息及处理方式的逻辑。

#### 4.1.1 已经废弃的功能代码需要移除

YCSE_VOTING_DISK_ERROR和YCSE_CLUSTER_SEPARATED，在引入YCSM的时候，原有的逻辑代码已经没有地方会去抛出这两个异常信息，但是当时并未清除掉这部分代码，在本次能力中予以清除。

#### 4.1.2 可能可以调整的逻辑

YCSE_RES_TRIGGER_RESTART异常唯一还存活的地方是在给YFS的回调里。如果YFS在promote失败的时候，会触发YCS的内部重启。这个我认为触发的时候直接abort重新拉起也是可以的。

**已经和YFS讨论，改为abort。**

#### 4.1.3 异常YCSE_RES_TRIGGER_STOP

该异常在首次启动的时候，如果YFS启动失败，会触发该异常，以触发ycs主线程的退出。

#### 4.1.4 异常YCSE_DB_STARTUP_ERROR

该异常会在DB启动失败的时候抛出，抛出该异常后会根据重启的次数来判断是否要把重启的消息推给重启的消息池，以达成重启DB的目标。

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    新起线程相关设计

#### 4.2.1 线程名

YCS_PROCESS_MSG_QUEUE

#### 4.2.2 线程生命周期

启动在实例启动的前面位置，在ycsIcsStart之前。

停止在实例停止的较后位置，在ycsIcsStop之后。

#### 4.2.3 线程能力

能够处理消息池里的两种类型的信息，YCS_MESSAGE_TYPE_ICS_EVENT和YCS_MESSAGE_TYPE_VOTE。

YCS_MESSAGE_TYPE_ICS_EVENT：负责处理重连和断连时间的信息，来给对应的标志位设置。（23.3已经删除，待回合）

YCS_MESSAGE_TYPE_VOTE：负责处理选举里的notify信息，作为节点是以主运行还是以备运行的依据。

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    原有起停标志位的思考和优化

#### 4.3.1 标志位设置规范

目标是考虑把所有设置进程状态的地方都规整到进程的起停主流程里面，但是因为触发原因的问题，有些标志位不可避免的在别的地方加，需要控制影响。

#### 4.3.2 目前没有在起停主流程里加的状态

1. YCS_INSTANCE_STATE_STOPPING在ycsMonitorStopYcs里面。这里因为ycsm新流程需要在这里触发停，所以和close状态绑定，并加进程锁，这里用是安全的。
1. ycsTriggerStopInstance里，启动YFS失败之后会触发异常走该流程，让进程退出。这里同样是加了进程锁，且和close状态绑定，也是安全的。


结论：标志位设置安全，不需要改。

#### 4.3.3 可能可以修改的散落的使用状态的地方

YDBRD-27168里加的对于YCS_INSTANCE_STATE_STOPPING状态在主备启动流程中的修改可以考虑回退。

  [https://git.yasdb.com/cod-x/anchorbase/-/commit/7162c5214acb0eeaeb3ecb4a6965f3c1026de686](https://git.yasdb.com/cod-x/anchorbase/-/commit/7162c5214acb0eeaeb3ecb4a6965f3c1026de686)  

结论：先改先测，有问题再具体分析

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

主要参考测试方案设计来，    [【YDBRD-31269】YCS实例启停和故障仲裁优化 --测试设计](167158471.html)  

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=138569064#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

  


## 7    [.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138570711#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

## Attachments:

[image2024-5-20_17-7-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDc4OTcwYzJhZjRmNTIxNjVmIiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjk2LCJleHAiOjE3ODI0MDAwOTZ9.I29eVrH5bW2hSxLEFyuXDkzMjOmM6HePFiVB9kvkoq4)

 (image/png)    


[image2024-5-21_20-58-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDc4OTcwYzJhZjRmNTIxNjYwIiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjk2LCJleHAiOjE3ODI0MDAwOTZ9.nn0i-QG5IxHd3r9gsGvojINIdycIqjYrTVVyMICsk3w)

 (image/png)    


[image2024-5-21_21-25-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDdhMWFkOWEzMzExZGM5NGQzIiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjk2LCJleHAiOjE3ODI0MDAwOTZ9.UVWGpdhYhjvYSOWe86fy3P9M9ChdbB_Z3EvfrYQwWWA)

 (image/png)    


[image2024-6-4_16-22-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDc4OTcwYzJhZjRmNTIxNjYxIiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjk2LCJleHAiOjE3ODI0MDAwOTZ9.3wHDVY6lMNo0SszHhKAIxOwjMTErd6rNjeZKT6SX3Hg)

 (image/png)    


[image2024-6-4_16-24-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDdhMWFkOWEzMzExZGM5NGQ0IiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjk2LCJleHAiOjE3ODI0MDAwOTZ9.8S7-nnC7hSyEHcUiFHAhjJOHqX2tnrfuUmB99bHvO2Q)

 (image/png)    


[image2024-6-4_16-22-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDdhMWFkOWEzMzExZGM5NGQ1IiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjk2LCJleHAiOjE3ODI0MDAwOTZ9.vPpVOJC4UmEjusGmGL0X_m0IK5PN3DUScY5clLw7I4c)

 (image/png)    


[image2024-6-4_16-24-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMDc4OTcwYzJhZjRmNTIxNjYyIiwicmVmX2lkIjoiNjczOTZlMDc1OTNmOTljOWZmMjM4MTZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzNjk2LCJleHAiOjE3ODI0MDAwOTZ9.Hh60I49PeHkwQ_W4d2nv_qYCojc8ULVhSYWs95cfeNA)

 (image/png)    
