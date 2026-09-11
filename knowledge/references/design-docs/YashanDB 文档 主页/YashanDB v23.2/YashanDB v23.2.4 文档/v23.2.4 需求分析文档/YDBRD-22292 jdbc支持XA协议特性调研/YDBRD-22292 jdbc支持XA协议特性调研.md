Created by 张周玺, last modified on 二月 29, 2024

i    [[YDBRD-22292] 【jdbc】支持XA协议 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22292)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

### XA是分布式事务的一种解决方案。

### 1.1 分布式事务

随着互联网的快速发展，软件系统由原来的单体应用转变为分布式应用，在多个服务/数据库之间实现的事务就称为分布式事务。

分布式事务的一个典型场景就是  **跨数据库实例**  的分布式事务  **。**

比如用户信息和订单数据分别在两个数据库实例里面储存，当需要删除用户信息时要同时在用户库里删用户，在订单数据库里删该用户的订单。由于这一个事务中涉及两个数据库的操作，这就产生了分布式事务。

![](https://pic4.zhimg.com/80/v2-2f6161c1ae1b7eaeb59a1e1c727d7237_1440w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFnQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIwODMsImV4cCI6MTc4MjMyMjg4M30.63xX0v83j9hkgrGIVWt0x2VijntKZKTwHpm58HrcEFc)

  


### 1.2 分布式事务解决方案之 2PC

2PC 即两阶段提交协议，是将整个事务流程分为两个阶段，准备阶段（Prepare phase）、提交阶段（commit phase），2 是指两个阶段，P 是指准备阶段，C 是指提交阶段。

1. 准备阶段（Prepare phase）：事务管理器给每个参与者发送 Prepare 消息，每个数据库参与者在本地执行事务，并写本地的 Undo/Redo 日志，此时事务没有提交。（Undo 日志是记录修改前的数据，用于数据库回滚，Redo 日志是记录修改后的数据，用于提交事务后写入数据文件）
1. 提交阶段（commit phase）：如果事务管理器收到了参与者的执行失败或者超时消息时，直接给每个参与者发送回滚（Rollback）消息；否则，发送提交（Commit）消息；参与者根据事务管理器的指令执行提交或者回滚操作，并释放事务处理过程中使用的锁资源。注意：  **必须在最后阶段释放锁资源**  。


下图展示了2PC的两个阶段，分成功和失败两个情况说明：

成功情况：

![](https://pic1.zhimg.com/80/v2-c6bec5eb89af72bad6055c2a46b5d560_1440w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFnQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIwODMsImV4cCI6MTc4MjMyMjg4M30.63xX0v83j9hkgrGIVWt0x2VijntKZKTwHpm58HrcEFc)

失败情况：

![](https://pic3.zhimg.com/80/v2-4a56b58dde5beb2e569cefe9d0cbf652_1440w.webp?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFnQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIwODMsImV4cCI6MTc4MjMyMjg4M30.63xX0v83j9hkgrGIVWt0x2VijntKZKTwHpm58HrcEFc)

### 1.3 2PC的具体实现–XA方案

为了统一标准减少行业内不必要的对接成本，需要制定标准化的处理模型及接口标准，国际开放标准组织 Open Group 定义了分布式事务处理模型  **DTP**  （Distributed Transaction Processing Reference Model。

DTP 模型定义如下角色：

- **AP**  （Application Program）：即应用程序，可以理解为使用 DTP 分布式事务的程序。
- **RM**  （Resource Manager）：即资源管理器，可以理解为事务的参与者，一般情况下是指一个数据库实例，通过资源管理器对该数据库进行控制，资源管理器控制着分支事务。
- **TM**  （Transaction Manager）：事务管理器，负责协调和管理事务，事务管理器控制着全局事务，管理事务生命周期，并协调各个 RM。  **全局事务**  是指分布式事务处理环境中，需要操作多个数据库共同完成一个工作，这个工作即是一个全局事务。
- DTP 模型定义TM和RM之间通讯的接口规范叫     **XA**  ，简单理解为数据库提供的 2PC 接口协议，  **基于数据库的 XA 协议来实现 2PC 又称为 XA 方案。**


以上三个角色之间的交互方式如下：

  `1. TM 向 AP 提供 应用程序编程接口，AP 通过 TM 提交及回滚事务。`  

  `2. TM 交易中间件通过 XA 接口来通知 RM 数据库事务的开始、结束以及提交、回滚等。两个阶段的具体动作：`  

（1）在  **准备阶段**     RM 执行实际的业务操作，但不提交事务，资源锁定

（2）在  **提交阶段**     TM 会接受 RM 在准备阶段的执行回复，只要有任一个RM执行失败，TM 会通知所有 RM 执行回滚操作，否则，TM 将会通知所有 RM 提交该事务。提交阶段结束资源锁释放。

###   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

jdbc 4.3规范定义了一系列的xa相关接口，Oracle也已经实现了这些接口，支持一整套完整的xa相关功能。

###   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

ORACLE的xa实现：    [Developing Applications with Oracle XA](https://docs.oracle.com/en/database/oracle/oracle-database/21/adfns/xa.html#GUID-1DAB062F-F796-4424-9FFD-9756688AC5B7)  

Oracle的xa对jdbc的支持：     [Transaction Guard for Java (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/jjdbc/transaction-guard.html#GUID-6F363D40-9EEB-4D34-B085-B5BF4E988D38)  

  


Oracle的JDBC对XA有两套实现，

一套基于高级包的实现，调高级包实现start,end,commit等操作。

![](https://pingcode.yasdb.com/atlas/files/public/67396dd38970c2af4f521566/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFnQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIwODMsImV4cCI6MTc4MjMyMjg4M30.63xX0v83j9hkgrGIVWt0x2VijntKZKTwHpm58HrcEFc)

  


另一套是基于JNI（java native   interface  ）的实现，需要安装oci,oci里面给出具体实现，编译出ddl，java代码底层调native接口来实现。

![](https://pingcode.yasdb.com/atlas/files/public/67396dd38970c2af4f521567/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFnQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIwODMsImV4cCI6MTc4MjMyMjg4M30.63xX0v83j9hkgrGIVWt0x2VijntKZKTwHpm58HrcEFc)

###   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

  


###   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

友商特性对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志等

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
|---|
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


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明调研特性对外的功能规格或约束。给出各友商的差异点、优缺点描述。**

  


**3.1 Xid的实现。**

**xid三个接口：**

|接口|
|---|
|int getFormatId();|
|byte[] getGlobalTransactionId();|
|byte[] getBranchQualifier();|


  


**Oracle与mysql的xid基本相同，看不出明显差异。**

**唯一有差别的是Oracle提供了两个构造函数：**

|  
|Oracle|mysql|备注|
|---|---|---|---|
|构造方法    
    
|OracleXid  (  int formatId  , byte  []   gtrid  , byte  []   bqual  )|MysqlXid  (  byte  [] gtrid  , byte  [] bqual  , int   formatId)|  
|
||OracleXid  (  int formatId  , byte  []   gtrid  , byte  []   bqual  , byte  []   txctx  )|  
|Oracle多了一个构造方法，多一个参数  txctx，但是翻遍所有的代码，都没发现txctx字段有啥用，可以认为是个废弃字段|


**但是在对xid的处理上，Oracle的**  **gtrid和**  **bqual**  **是最大64位，mysql没有校验长度**  。这点规格上可以和Oracle保持一致。

  


Oracle，mysql，PG都是是通过bqual和gtrid和formatId这三个字段的组合来确定Xid唯一性的。

  


此外，xid是允许用户自定义的，所以驱动给出的实现只需要个简单实现，并不需要把逻辑功能设计的非常复杂。

**3.2 几个功能类之间的结构设计。**

Oracle，MySQL，PG的XAResource与XAConnection都是严格的一一对应关系，实现上略有不同，MySQL，PG都是直接把XAResource与XAConnection合二为一，Oracle由于XAResource有多种实现，所以XAResource与XAConnection是分开的。

XAConnection是继承了PooledConnection接口，所以实现上没有争议，三者都是在继承PooledConnection实现的基础上实现XAConnection。

XADataSource的实现，MySQL，PG都是继承自各自DataSource实现，而Oracle是继承ConnectionPoolDataSource实现，这点比较奇怪，也比较有争议。结合实际，XADataSource继承DataSource实现实现就可以了。

3.3协议设计

start-end

|operation start1,end 2|是否带context表示|context length|formatid|gtridLength|bqualLength|Xidlength(不管gtrid+bqual够不够128，这里总是128)|flags|timeout|connection.internalNameLength|connection  .  externalName  .  length|gtrid+bqual实际内容，固定128位，不足的补0|connectionName|  
|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|


##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

## Attachments: