Created by 张周玺, last modified on 七月 29, 2024

  


  [[YDBRD-22292] 【jdbc】支持XA协议 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22292)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

XA方案是目前业界通用的一种分布式事务解决方案，通过两阶段提交来解决分布式事务。咱们驱动需要补足这一块的能力，所以需要实现该需求。

关于  **分布式事务**  和  **两阶段提交**  ，已经在调研文档中写明，在此不再赘述    [YDBRD-22292 jdbc支持XA协议特性调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144132064)  

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**Oracle实现情况：**    [YDBRD-22292 jdbc支持XA协议特性调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144132064)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|XAResource接口实现|实现XAResource里面的接口，这是XA操作的原子能力|是|是|----|
|  
|XID实现|xid是xa操作唯一标识，实现时需要注意不仅可用，而且要要用，好理解，便于用户使用|是|是|----|
|  
|其它XA接口实现|XAConnection，,OracleXADataSource等xa接口实现|是|是|  
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


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

  


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


Xid接口：

|接口|
|---|
|int getFormatId();|
|byte[] getGlobalTransactionId();|
|byte[] getBranchQualifier();|


## XAConnection接口：

|接口|
|---|
|javax.transaction.xa.XAResource   getXAResource  ()   throws   SQLException  ;|


### XADataSource

|接口|
|---|
|XAConnection   getXAConnection  ()   throws   SQLException  ;|
|XAConnection   getXAConnection  (String user  ,   String password)    
  throws   SQLException  ;|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**目前数据库服务端XA相关功能只支持单机。**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 X](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    id实现

Xid只需要实现那三个接口即可。

而且Xid是可以使用驱动实现，也可以用户自己实现，所以驱动实现的Xid也不用太复杂，因为要适配用户自定义的Xid,所以自己额外加的代码逻辑也没什么用。

int formatId;

byte[] bqual;

byte[] gtrid;     
  Xid包含这三个字段，    
  其中bqual和gtrid都不超64位.（Oracle的规格限制，mysql,pg无此限制）    
  Xid格式如下.

|gtrid数据，最长64位，不足的补零|gtrid数据，最长64位，不足的补零|
|---|---|


  


**总共128位。**

需要注意的是，Xid的校验，序列化，反序列化都必须在Xid外面完成，因为要适配用户自定义的Xid。

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)    XAResource实现

XAResource接口是XA方案的核心，提供了commit,start,end等原子能力，数据库服务端只提供了这些原子能力的接口，但是没提供对应的高级包或者SQL接口，所以驱动定一个协议与服务端进行交互。

#### 4.2.1 XA协议设计：

加一个  CMD_XA  (  27  )。

  


|operationCode(u8)|unused(u8)|gtridLength(u8)|bqualLength(u8)||||||||||
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|formatId  (u32)|||||||||||||
|xaFlags(u32)|||||||||||||
|timeout  (u32)|||||||||||||
|reserved(u32)|||||||||||||
|gtrid []|||||||||||||
|bqual[]|||||||||||||


  
    


ReqXa结构体为：    


typedef struct   StReqXa   {    
  CodUint8    operationCode  ;    
        CodUint8    unused  ;    
        CodUint8    gtridLength  ;    
        CodUint8    bqualLength  ;    
        CodUint32   formatId  ;    
        CodUint32   xaFlags  ;    
        CodUint32   timeout  ;    
        CodUint32   reserved  ;    
  }   ReqXa  ;

  
    


|主要接口|operation   |参数|备注|
|---|---|---|---|
|start|1|Xid,,int flag|flag三个取值：,XAResource.  TMNOFLAGS = 0;    
  XAResource.  TMJOIN  =  2097152  ;    
  XAResource.  TMRESUME  =  134217728  ;    
    
    
    
|
|end|2|Xid,,int flag|flag三个取值：,XAResource.  TMSUSPEND   =   33554432  ;,XAResource.  TMSUCCESS   =   67108864  ;,XAResource.  TMFAIL   =   536870912  ;|
|prepare|3|Xid|返回值：失败会报错，成功时统一返回,XA_OK   =   0  ;|
|commit|4|Xid,,Boolean ,onePhase|onePhase为true时映射成,TMONEPHASE   =   1073741824  ;    
  false时映射成XAResource.  TMNOFLAGS = 0;|
|forget|5|Xid|  
|
|rollback|6|Xid|  
|
|Xid[]   recover  (  int   var1) |  
|  
|不走协议，通过sql从系统视图里面查 v$2pc_pending|


#### 4.2.2 服务端的状态流转图：

![](https://pingcode.yasdb.com/atlas/files/public/67396dd28970c2af4f521565/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE5NDIsImV4cCI6MTc4MjMyMjc0Mn0.dfhV7H5FO8x14zh0Ev6aTa-kLwSuv02zlXeD3cYAx3Q)

**补充说明：后续服务端实现有变化，start join和resume只支持自身已绑定的xid,游离xid两种，不支持新xid.**

  


###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    XAConnection，XADataSource等xa接口实现。

XAConnection，经过调研，用于XA的会话和普通会话是没有区别的，所以只需要在普通连接的基础上多实现XAConnection接口就可以了，和连接关系不大，最终所有XA功能都在  XAResource里面实现。

XAConnection是继承了PooledConnection接口，所以实现上，YasXAConnection也必须继承YasPooledConnection。

XADataSource同理，继承YasDataSource然后实现XADataSource就可以了。

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

构造分布式事务场景，对上面接口进行测试。

测试正常，异常场景。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

## Comments:

|  [](null)  ,协议层做成活的，把xid三个字段的完整信息都传过去,Posted by zhangzhouxi at 七月 29, 2024 11:11|
|---|
