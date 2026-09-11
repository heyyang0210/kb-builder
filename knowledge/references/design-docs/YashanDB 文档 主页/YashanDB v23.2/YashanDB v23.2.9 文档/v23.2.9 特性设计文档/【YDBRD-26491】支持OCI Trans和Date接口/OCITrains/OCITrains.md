Created by 方少奎, last modified on 九月 24, 2024

c驱动事务处理

  [XA接口方案设计【详细版】](https://conf.yasdb.com/pages/viewpage.action?pageId=138550006)  

  [详细设计 YDBRD-22292 jdbc支持XA协议](130144770.html)  

Oracle文档见：    [Transaction Functions (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/transaction-functions.html#GUID-DDAE3122-8769-4A30-8D78-EB2A3CCF77D4)  

|接口|参数说明|说明|
|---|---|---|
|sword OCITransCommit ( OCISvcCtx *svchp,    
  OCIError *errhp,    
  ub4 flags );|svchp (IN)：服务上下文句柄.,errhp (IN)：当出现错误时，您可以传递给 OCIErrorGet() 以获取诊断信息的错误句柄.,flags (IN)：,用于全局事务中单阶段提交优化的标志.,Note：使用 OCI_TRANS_WRITENOWAIT 时，可能会出现静默事务丢失。,在关闭中止、强制启动以及任何实例或节点故障时，事务丢失都会静默发生。,在 Oracle RAC 系统上，异步提交的更改可能无法立即在其他实例上读取。,最后四个选项仅影响顶级非分布式事务的提交，对于外部协调的分布式事务将被忽略。,它们可以使用 OR 运算符组合，但须遵守规定的限制.,Comments,当前与服务上下文关联的事务已提交。如果是服务器无法提交的全局事务，此调用还会从数据库检索事务的状态，以在错误句柄中返回给用户。,如果应用程序已定义多个事务，则此函数将对当前与服务上下文关联的事务进行操作。,如果应用程序仅使用在进行数据库更改时创建的隐式本地事务，则提交该隐式事务。,如果应用程序在对象模式下运行，则此事务的对象缓存中已修改或更新的对象也将被刷新和提交。,在正常情况下， OCITransCommit() 返回的状态表明事务已提交或回滚。对于全局事务，事务现在可能处于不确定状态，这意味着它既未提交也未终止。,在这种情况下， OCITransCommit() 尝试从服务器检索事务的状态。返回状态。|  
|
|FLAGS|说明|
|OCI_DEFAULT |如果事务是非分布式的，则忽略 flags 参数，并且可以将 OCI_DEFAULT 作为其值传递|
|OCI_TRANS_TWOPHASE |管理全局事务的 OCI 应用程序应将此值传递给两阶段提交的 flags 参数。默认值为一阶段提交|
|OCI_TRANS_WRITEIMMED |I/O 由 LGWR（后台的日志写入器进程）发起，将（内存中的）重做缓冲区写入在线重做日志。,IMMEDIATE 意味着通过向 LGWR 发送消息立即写出事务的重做缓冲区，LGWR 会立即处理该消息|
|OCI_TRANS_WRITEBATCH |LGWR 不会发出任何 I/O 来将事务的内存重做缓冲区写入联机重做日志。,BATCH 表示 LGWR 在启动整个批次的 I/O 之前对重做缓冲区进行批处理。,如果同时指定 BATCH 和 IMMEDIATE，则会发生错误。IMMEDIATE 是默认值|
|OCI_TRANS_WRITEWAIT |请求 LGWR 将提交的重做写入在线重做日志，提交等待重做缓冲区写入在线重做日志。,WAIT 表示直到事务对应的内存重做缓冲区写入（持久）在线重做日志后，提交才返回|
|OCI_TRANS_WRITENOWAIT |请求 LGWR 将提交的重做写入在线重做日志，但提交不等待缓冲区写入在线重做日志就返回。,NOWAIT 表示在内存重做缓冲区刷新到在线重做日志之前，提交返回给用户。,如果同时指定 WAIT 和 NOWAIT，则会发生错误。WAIT 是默认值|
|sword OCITransRollback ( void *svchp,     
  OCIError *errhp,    
  ub4 flags );|svchp (IN)A service context handle. The transaction currently set in the service context handle is rolled back.,errhp (IN)An error handle that you can pass to OCIErrorGet() for diagnostic information when there is an error.,flags (IN)You must pass a value of OCI_DEFAULT for this parameter.,Comments,当前事务（定义为自上次 OCITransCommit() 或 OCISessionBegin() 以来执行的语句集）被回滚。,如果应用程序在对象模式下运行，则此事务的对象缓存中修改或更新的对象也将被回滚。,尝试回滚当前不活动的全局事务会导致错误。|  
|
|sword OCITransStart,( OCISvcCtx *svchp,   OCIError *errhp,    uword timeout,   ub4 flags );|svchp (IN/OUT)：  服务上下文句柄。如果标志指定要启动的新事务，则在调用结束时初始化服务上下文句柄中的事务上下文。,errhp (IN/OUT)  ：  一个OCI error句柄。如果出现错误，则将其记录在err中，此函数返回OCI_ERROR。可以通过调用OCIErrorGet()来获取诊断信息。,timeout (IN)：当指定OCI_TRANS_RESUME时，等待事务恢复可用的时间(以秒为单位)。,当指定OCI_TRANS_NEW时，timeout参数表示事务在被系统自动终止之前可以处于非活动状态的秒数。,事务在分离(使用OCITransDetach())和使用OCITransStart()恢复之间处于非活动状态。,flags (IN)：,指定是正在启动新事务还是正在恢复现有事务。还指定serializability或read-only状态。,可以指定多个值。缺省情况下，启动读写事务。标志值为:,如果代码或事务服务中存在错误，则会产生错误消息。该错误表明您尝试对已经准备好的事务执行操作。,Comments,此函数设置全局事务或可序列化事务的开始。如果flags参数指定应该启动新事务，则在调用结束时初始化当前与服务上下文句柄关联的事务上下文。,事务的XID设置为事务句柄的属性(OCI_ATTR_XID)。|Sets the beginning of a transaction.|
|Flags|说明|
|  `OCI_TRANS_NEW`     |启动一个新的事务分支。默认情况下，启动一个紧密耦合且可迁移的分支。|
|  `OCI_TRANS_TIGHT`     |显式指定紧耦合分支。|
|  `OCI_TRANS_LOOSE`     |指定松耦合分支。|
|  `OCI_TRANS_RESUME`     |恢复一个现有的事务分支。|
|  `OCI_TRANS_READONLY`     |启动只读事务。|
|  `OCI_TRANS_SERIALIZABLE`     |启动一个可序列化的事务。|
|  `OCI_TRANS_SEPARABLE`     |在每次调用后分离事务。此标志将导致使用常规事务启动事务的警告。服务器的9.0.1版本不支持分离事务。|
|sword OCITransDetach,(OCISvcCtx *svchp,OCIError *errhp,ub4 flags );|svchp     (IN)：  服务上下文句柄。,errhp     (IN)：  一个错误句柄。,flags     (IN)：  必须传递此参数的值。,Comments,将全局事务与服务上下文句柄分离。在此调用结束时，当前附加到服务上下文句柄的事务将变为非活动状态。,事务可以稍后通过调用  OCITransStart()指定OCI_TRANS_RESUME的标志值  来恢复。,当一个事务分离后，事务启动时的  OCITransStart()  参数中指定的  timeout  值用于确定分支在被服务器的PMON进程删除之前可以保持不活动的时间。,Note：  如果事务具有相同的授权，则可以通过与分离事务的进程不同的进程来恢复事务。如果在事务实际启动之前调用此函数，则此函数不起作用。|Detaches a global transaction.,分离全局事务。,将活跃的事务转化为游离状态，resume恢复事务。|
|sword OCITransPrepare,( OCISvcCtx *svchp,OCIError *errhp,ub4 flags );|svchp     (IN)：  服务上下文句柄。,errhp     (IN)  ：  一个错误句柄。,flags (IN)  ：  必须传递此参数的值。,Comments,准备要提交的指定全局事务。,此调用仅对全局事务有效。,如果事务未进行任何更改，则调用将返回    `OCI_SUCCESS_WITH_INFO`    。,错误句柄指示事务是只读的。,当前未使用该    `flags`    参数。|Prepares a global transaction for commit.,为提交准备一个全局事务。|
|sword OCITransForget,( OCISvcCtx *svchp,OCIError *errhp,ub4 flags );|svchp (IN)：  服务上下文句柄。,errhp (IN)  ：  一个错误句柄。,flags (IN)  ：  必须传递此参数的值。,Comments,忘记一个经启发式完成的全局事务。服务器从系统的挂起事务表中删除事务的状态。,将进行遗忘的事务的 XID 设置为事务句柄（    `OCI_ATTR_XID`    ）的属性。|Causes the server to forget a heuristically completed global transaction.,导致服务器忘记启发式完成的全局事务。|


|FLAGS|说明|
|---|---|
|OCI_DEFAULT |如果事务是非分布式的，则忽略 flags 参数，并且可以将 OCI_DEFAULT 作为其值传递|
|OCI_TRANS_TWOPHASE |管理全局事务的 OCI 应用程序应将此值传递给两阶段提交的 flags 参数。默认值为一阶段提交|
|OCI_TRANS_WRITEIMMED |I/O 由 LGWR（后台的日志写入器进程）发起，将（内存中的）重做缓冲区写入在线重做日志。,IMMEDIATE 意味着通过向 LGWR 发送消息立即写出事务的重做缓冲区，LGWR 会立即处理该消息|
|OCI_TRANS_WRITEBATCH |LGWR 不会发出任何 I/O 来将事务的内存重做缓冲区写入联机重做日志。,BATCH 表示 LGWR 在启动整个批次的 I/O 之前对重做缓冲区进行批处理。,如果同时指定 BATCH 和 IMMEDIATE，则会发生错误。IMMEDIATE 是默认值|
|OCI_TRANS_WRITEWAIT |请求 LGWR 将提交的重做写入在线重做日志，提交等待重做缓冲区写入在线重做日志。,WAIT 表示直到事务对应的内存重做缓冲区写入（持久）在线重做日志后，提交才返回|
|OCI_TRANS_WRITENOWAIT |请求 LGWR 将提交的重做写入在线重做日志，但提交不等待缓冲区写入在线重做日志就返回。,NOWAIT 表示在内存重做缓冲区刷新到在线重做日志之前，提交返回给用户。,如果同时指定 WAIT 和 NOWAIT，则会发生错误。WAIT 是默认值|


|Flags|说明|
|---|---|
|  `OCI_TRANS_NEW`     |启动一个新的事务分支。默认情况下，启动一个紧密耦合且可迁移的分支。|
|  `OCI_TRANS_TIGHT`     |显式指定紧耦合分支。|
|  `OCI_TRANS_LOOSE`     |指定松耦合分支。|
|  `OCI_TRANS_RESUME`     |恢复一个现有的事务分支。|
|  `OCI_TRANS_READONLY`     |启动只读事务。|
|  `OCI_TRANS_SERIALIZABLE`     |启动一个可序列化的事务。|
|  `OCI_TRANS_SEPARABLE`     |在每次调用后分离事务。此标志将导致使用常规事务启动事务的警告。服务器的9.0.1版本不支持分离事务。|


OCI标准和yashandb协议的Flags标志差异：

OCI flags

|Start|End|
|---|---|
|OCI_TRANS_NEW   (  0x00000001  )|OCI_TRANS_TWOPHASE   (  0x01000000  )|
|OCI_TRANS_JOIN   (  0x00000002  )|OCI_TRANS_WRITEBATCH   (  0x00000001  )|
|OCI_TRANS_RESUME   (  0x00000004  )|OCI_TRANS_WRITEIMMED   (  0x00000002  )|
|OCI_TRANS_PROMOTE   (  0x00000008  )|OCI_TRANS_WRITEWAIT   (  0x00000004  )|
|OCI_TRANS_STARTMASK   (  0x000000ff  )|OCI_TRANS_WRITENOWAIT   (  0x00000008  )|
|OCI_TRANS_READONLY   (  0x00000100  )|  
|
|OCI_TRANS_READWRITE   (  0x00000200  )|  
|
|OCI_TRANS_SERIALIZABLE   (  0x00000400  )|  
|
|OCI_TRANS_ISOLMASK   (  0x0000ff00  )|  
|
|OCI_TRANS_LOOSE   (  0x00010000  )|  
|
|OCI_TRANS_TIGHT   (  0x00020000  )|  
|
|OCI_TRANS_TYPEMASK   (  0x000f0000  )|  
|
|OCI_TRANS_NOMIGRATE   (  0x00100000  )|  
|
|OCI_TRANS_SEPARABLE   (  0x00200000  )|  
|
|OCI_TRANS_OTSRESUME   (  0x00400000  )|  
|
|OCI_TRANS_OTHRMASK   (  0xfff00000  )|  
|


yashandb flags

|Start|End|
|---|---|
|XA_TMNOFLAGS(  0x00000000L  )|XA_TMSUSPEND(  0x02000000L  )|
|XA_TMJOIN(  0x00200000L  )|XA_TMNOFLAGS(  0x00000000L  )|
|XA_TMRESUME(  0x08000000L  )|XA_TMSUCCESS(  0x04000000L  )|
|  
|XA_TMFAIL(  0x20000000L  )|


XA协议报文：

|operationCode(u8)|unused(u8)|gtridLength(u8)|bqualLength(u8)||||||||||
|:---|:---|:---|:---|---|---|---|---|---|---|---|---|---|
|formatId  (u32)|||||||||||||
|xaFlags(u32)|||||||||||||
|timeout  (u32)|||||||||||||
|reserved(u32)|||||||||||||
|gtrid []|||||||||||||
|bqual[]|||||||||||||


```
int main()
{
  OCIEnv *envhp;
  OCIServer *srvhp;
  OCIError *errhp;
  OCISvcCtx *svchp;
  OCISession *usrhp;
  OCIStmt *stmthp1, *stmthp2;
  OCITrans *txnhp1, *txnhp2;
  void      *tmp;
  XID gxid;
  text sqlstmt[128];

  OCIEnvCreate(&envhp, OCI_DEFAULT, (void  *)0, 0, 0, 0,
        (size_t)0, (void  *)0);

  OCIHandleAlloc( (void  *) envhp, (void  **) &errhp, (ub4)
                OCI_HTYPE_ERROR, 52, (void  **) &tmp);
  OCIHandleAlloc( (void  *) envhp, (void  **) &srvhp, (ub4)
               OCI_HTYPE_SERVER, 52, (void  **) &tmp);

  OCIServerAttach( srvhp, errhp, (text *) 0, (sb4) 0, (ub4) OCI_DEFAULT);

  OCIHandleAlloc( (void  *) envhp, (void  **) &svchp, (ub4) OCI_HTYPE_SVCCTX,
                52, (void  **) &tmp);

  OCIHandleAlloc((void  *)envhp, (void  **)&stmthp1, OCI_HTYPE_STMT, 0, 0);
  OCIHandleAlloc((void  *)envhp, (void  **)&stmthp2, OCI_HTYPE_STMT, 0, 0);

  OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)srvhp, 0,
                  OCI_ATTR_SERVER, errhp);

  /* set the external name and internal name in server handle */
  OCIAttrSet((void  *)srvhp, OCI_HTYPE_SERVER, (void  *) "demo", 0,
                  OCI_ATTR_EXTERNAL_NAME, errhp);
  OCIAttrSet((void  *)srvhp, OCI_HTYPE_SERVER, (void  *) "txn demo", 0,
                          OCI_ATTR_INTERNAL_NAME, errhp);

  /* allocate a user context handle */
  OCIHandleAlloc((void  *)envhp, (void  **)&usrhp, (ub4) OCI_HTYPE_SESSION,
                (size_t) 0, (void  **) 0);

  OCIAttrSet((void  *)usrhp, (ub4)OCI_HTYPE_SESSION, (void  *)"HR",
             (ub4)strlen("HR"), OCI_ATTR_USERNAME, errhp);
  OCIAttrSet((void  *)usrhp, (ub4)OCI_HTYPE_SESSION, (void  *)"HR",
             (ub4)strlen("HR"),OCI_ATTR_PASSWORD, errhp);

  OCISessionBegin (svchp, errhp, usrhp, OCI_CRED_RDBMS, 0);

  OCIAttrSet((void  *)svchp, (ub4)OCI_HTYPE_SVCCTX,
                (void  *)usrhp, (ub4)0, OCI_ATTR_SESSION, errhp);

  /* allocate transaction handle 1 and set it in the service handle */
  OCIHandleAlloc((void  *)envhp, (void  **)&txnhp1,  OCI_HTYPE_TRANS, 0, 0);
  OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp1, 0,
                          OCI_ATTR_TRANS, errhp);

  /* start a transaction with global transaction id = [1000, 123, 1] */
  gxid.formatID = 1000; /* format id = 1000 */
  gxid.gtrid_length = 3; /* gtrid = 123 */
  gxid.data[0] = 1; gxid.data[1] = 2; gxid.data[2] = 3;
  gxid.bqual_length = 1; /* bqual = 1 */
  gxid.data[3] = 1;

  OCIAttrSet((void  *)txnhp1, OCI_HTYPE_TRANS, (void  *)&gxid, sizeof(XID),
                          OCI_ATTR_XID, errhp);

  /* start global transaction 1 with 60-second time to live when detached */
  OCITransStart(svchp, errhp, 60, OCI_TRANS_NEW);

  /* update hr.employees employee_id=7902, increment salary */
  sprintf((char *)sqlstmt, "UPDATE EMPLOYEES SET SALARY = SALARY + 1 \
                                           WHERE EMPLOYEE_ID = 7902");
  OCIStmtPrepare(stmthp1, errhp, sqlstmt, strlen((char *)sqlstmt),
                 OCI_NTV_SYNTAX, 0);
  OCIStmtExecute(svchp, stmthp1, errhp, 1, 0, 0, 0, 0);

  /* detach the transaction */
  OCITransDetach(svchp, errhp, 0);

  /* allocate transaction handle 2 and set it in the service handle */
  OCIHandleAlloc((void  *)envhp, (void  **)&txnhp2,  OCI_HTYPE_TRANS, 0, 0);

  OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp2, 0,
                          OCI_ATTR_TRANS, errhp);

  /* start a transaction with global transaction id = [1000, 124, 1] */
  gxid.formatID = 1000; /* format id = 1000 */
  gxid.gtrid_length = 3; /* gtrid = 124 */
  gxid.data[0] = 1; gxid.data[1] = 2; gxid.data[2] = 4;
  gxid.bqual_length = 1; /* bqual = 1 */
  gxid.data[3] = 1;

  OCIAttrSet((void  *)txnhp2, OCI_HTYPE_TRANS, (void  *)&gxid, sizeof(XID),
                          OCI_ATTR_XID, errhp);

  /* start global transaction 2 with 90 second time to live when detached */
  OCITransStart(svchp, errhp, 90, OCI_TRANS_NEW);

  /* update hr.employees employee_id=7934, increment salary */
  sprintf((char *)sqlstmt, "UPDATE EMPLOYEES SET SALARY = SALARY + 1 \
                                            WHERE EMPLOYEE_ID = 7934");
  OCIStmtPrepare(stmthp2, errhp, sqlstmt, strlen((char *)sqlstmt),
                 OCI_NTV_SYNTAX, 0);
  OCIStmtExecute(svchp, stmthp2, errhp, 1, 0, 0, 0, 0);

  /* detach the transaction */
  OCITransDetach(svchp, errhp, 0);

  /* Resume transaction 1, increment salary and commit it */
  /* Set transaction handle 1 into the service handle */
  OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp1, 0,
                          OCI_ATTR_TRANS, errhp);

  /* attach to transaction 1, wait for 10 seconds if the transaction is busy */
  /* The wait is clearly not required in this example because no other */
  /* process/thread is using the transaction. It is only for illustration */
  OCITransStart(svchp, errhp, 10, OCI_TRANS_RESUME);
  OCIStmtExecute(svchp, stmthp1, errhp, 1, 0, 0, 0, 0);
  OCITransCommit(svchp, errhp, (ub4) 0);

  /* attach to transaction 2 and commit it */
  /* set transaction handle2 into the service handle */
  OCIAttrSet((void  *)svchp, OCI_HTYPE_SVCCTX, (void  *)txnhp2, 0,
                          OCI_ATTR_TRANS, errhp);
  OCITransCommit(svchp, errhp, (ub4) 0);
}
```

## Attachments:

[image2024-4-24_11-23-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMWM4OTcwYzJhZjRmNTIxNmIxIiwicmVmX2lkIjoiNjczOTZlMWM1OTNmOTljOWZmMjM4MjM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjA0LCJleHAiOjE3ODI0MTEwMDR9.g_2AWY62GFPccXR3nEbMuEreqgykgAzgC9bxKcUAcLs)

 (image/png)    
