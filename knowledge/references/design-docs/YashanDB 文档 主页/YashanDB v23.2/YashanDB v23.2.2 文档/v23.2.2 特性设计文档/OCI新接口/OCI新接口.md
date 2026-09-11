Created by 冯皓博, last modified on 一月 30, 2024

|接口名|说明|说明|
|---|---|---|
|  [OCIEnvInit](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/deprecated-oci-functions.html#GUID-1AC89920-7DB1-46AC-BBAA-9854DDAD6AB7)  |sword OCIEnvInit ( OCIEnv **envhpp,    
  ub4 mode,    
  size_t xtramemsz,    
  void **usrmempp );|OCI已弃用，封装空函数体0工作量|
|  [OCIBreak](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/miscellaneous-functions.html#GUID-A414B5DE-07A3-4593-A448-B6023F87C2D0)  |sword OCIBreak ( void *hndlp,    
  OCIError *errhp );|立即执行异步中断。推测同yacCancel。封装工作量。|
|  [OCIReset](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/miscellaneous-functions.html#GUID-7223B6DC-12C5-4C7E-80D2-83FB35655BE1)  |sword OCIReset ( void *hndlp,    
  OCIError *errhp );|重置中断的异步操作和协议。无类似接口，需要调研。|
|  [OCILobOpen](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/lob-functions.html#GUID-B007A3C7-999B-4AD7-8BF7-C6D14572F470)  |sword OCILobOpen ( OCISvcCtx *svchp,    
  OCIError *errhp,     
  OCILobLocator *locp,     
  ub1 mode );|暂未调研完善其功能|
|  [OCILobGetLength2](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/lob-functions.html#GUID-9BC0A78A-37CB-432F-AE2B-22C905608C4C)  |sword OCILobGetLength2 ( OCISvcCtx *svchp,    
  OCIError *errhp,    
  OCILobLocator *locp,    
  oraub8 *lenp );|同yacGetLobLength2，封装工作量。|
|  [OCILobClose](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/lob-functions.html#GUID-CBEB9238-6B47-4A08-8C8D-FC2E5ED56557)  |sword OCILobClose ( OCISvcCtx *svchp,    
  OCIError *errhp,     
  OCILobLocator *locp );|暂未调研完善其功能|
|  [OCIInitialize](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/deprecated-oci-functions.html#GUID-F50356A8-450D-4A96-8AB5-5726502766B2)  |sword OCIInitialize ( ub4 mode,    
  const void *ctxp,     
  const void *(*malocfp)     
  ( void *ctxp,    
  size_t size ),    
  const void *(*ralocfp)    
  ( void *ctxp,    
  void *memptr,    
  size_t newsize ),    
  const void (*mfreefp)    
  ( void *ctxp,    
  void *memptr ));|OCI已弃用，封装空函数体0工作量|
