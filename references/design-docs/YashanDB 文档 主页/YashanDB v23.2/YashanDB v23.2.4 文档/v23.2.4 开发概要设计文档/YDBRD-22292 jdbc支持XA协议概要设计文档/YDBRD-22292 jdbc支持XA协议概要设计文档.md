Created by 张周玺, last modified on 二月 22, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  

  [[YDBRD-22292] 【jdbc】支持XA协议 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22292)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

XA方案是目前业界通用的一种分布式事务解决方案，通过两阶段提交来解决分布式事务。咱们驱动需要补足这一块的能力，所以需要实现该需求。

关于  **分布式事务**  和  **两阶段提交**  ，已经在调研文档中写明，在此不再赘述    [YDBRD-22292 jdbc支持XA协议特性调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144132064)  

  


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**Oracle实现情况：**    [YDBRD-22292 jdbc支持XA协议特性调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144132064)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|XAResource接口实现|实现XAResource里面的接口，这是XA操作的原子能力|是|是|----|
|  
|XID实现|xid是xa操作唯一标识，实现时需要注意不仅可用，而且要要用，好理解，便于用户使用|是|是|----|
|  
|其它XA接口实现|XAConnection，,OracleXADataSource等xa接口实现|是|  
|  
|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|----|
|  
|性能场景2|----|是/否|是/否|----|
|可用性|恢复场景|----|是/否|是/否|----|
|可靠性|故障场景|----|是/否|是/否|----|
|可维可测|DFX功能1|----|是/否|是/否|----|
|  
|DFX功能2|----|是/否|是/否|----|
|安全|安全场景1|----|是/否|是/否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|----|----|是/否|是/否|----|
|周边配合|权限|----|----|是/否|----|
|周边配合|审计|----|----|是/否|----|
|周边配合|导入导出工具|----|----|是/否|----|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

  


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|接口|接口表现|接口说明|是否涉及|
|XADataSource|  
|XA的数据源|是/否|
|XAConnection|  
|XA连接|  
|
|Xid|  
|xa的唯一标识|  
|
|XAResource|  
|真正用来调用xa接口|  
|


XAResource的接口

|接口|
|:---|
|void   commit  (Xid var1  , boolean   var2)   throws   XAException  ;|
|void   end  (Xid var1  , int   var2)   throws   XAException  ;|
|void   forget  (Xid var1)   throws   XAException  ;|
|int   getTransactionTimeout  ()   throws   XAException  ;|
|boolean   isSameRM  (XAResource var1)   throws   XAException  ;|
|int   prepare  (Xid var1)   throws   XAException  ;|
|Xid[]   recover  (  int   var1)   throws   XAException  ;|
|void   rollback  (Xid var1)   throws   XAException  ;|
|boolean   setTransactionTimeout  (  int   var1)   throws   XAException  ;|
|void   start  (Xid var1  , int   var2)   throws   XAException  ;|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**目前数据库服务端XA相关功能只支持单机。**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    XAResource实现

XAResource接口是XA方案的核心，提供了commit,start,end等原子能力，数据库服务端只提供了这些原子能力的接口，但是没提供对应的高级高等，所以Oracle的两种实现方案都不具备参考价值，驱动定一个协议与服务端进行交互。

###   [4.2 X](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    id实现

结合服务端要求，设计Xid模型

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    XAConnection，XADataSource等xa接口实现

这块没啥难度，只是在普通Connection和DataSource外包一层，打上xa标记，功能上还是原来那些功能

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。