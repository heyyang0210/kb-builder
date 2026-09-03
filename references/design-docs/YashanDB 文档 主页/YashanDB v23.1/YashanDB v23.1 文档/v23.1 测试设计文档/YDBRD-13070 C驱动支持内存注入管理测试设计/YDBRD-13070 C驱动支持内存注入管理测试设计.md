Created by 刘清萍, last modified on 十月 15, 2024

## 1.概述

  本文主要内容为c驱动支持内存注入管理的测试设计。

## 2.需求分析

### 2.1需求来源

     SR链接： 

  [YDBRD-13070](https://jira.yasdb.com/browse/YDBRD-13070?src=confmacro)    -  【驱动】c驱动支持内存注入管理  完成

  


    开发设计文档：    [C驱动支持内存注入](https://conf.yasdb.com/pages/viewpage.action?pageId=119540204)  

  [          c驱动支持内存注入管理 - 刘亮杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127635847)  

### 2.2 概述

支持单机C驱动使用外部内存管理，支持malloc、realloc、free使用用户回调函数+用户内存管理上下文，以支撑内存注入

### 2.3新增接口

###   `/* YACLI mem callbacks */`      
    `typedef`         `YacPointer (*YacMalocFunc)(YacPointer ctxp, `      `size_t`         `size);`      
    `typedef`         `YacPointer (*YacRalocFunc)(YacPointer ctxp, YacPointer memptr, `      `size_t`         `newSize);`      
    `typedef`         `YacVoid (*YacMfreeFunc)(YacPointer ctxp, YacPointer memptr);`      
    
  **YacResult yacAllocEnvWithMemCb(YacHandle* env, YacPointer ctxp, YacMalocFunc malocFp, YacRalocFunc ralocFp, YacMfreeFunc mfreeFp);**

yacAllocEnvWithMemCb在Yac环境中创建带有内存回调的环境，根据传入的回调函数情况，创建Yac环境并设置相应的内存回调函数，返回创建结果。参数：

- `env`: Yac环境句柄的指针
-  `ctxp`: 上下文指针
-  `malocFp`: 内存分配回调函数
-  `ralocFp`: 内存重新分配回调函数
-  `mfreeFp`: 内存释放回调函数


  


示例：

  `static`         `YacPointer testYacMalocFunc(YacPointer ctxp, `      `size_t`         `size)`      
    `{`      
    `    `      `YacUint32* memCtx = (YacUint32*)ctxp;`      
    `    `      `COD_ASSERT(*memCtx == 1);`      
    `    `      `YacPointer buf = `      `malloc`      `(size);`      
    `    `      `return`         `buf;`      
    `}`      
    
    `static`         `YacPointer testYacRalocFunc(YacPointer ctxp, YacPointer memptr, `      `size_t`         `newSize)`      
    `{`      
    `    `      `YacUint32* memCtx = (YacUint32*)ctxp;`      
    `    `      `COD_ASSERT(*memCtx == 1);`      
    `    `      `YacPointer buf = `      `realloc`      `(memptr, newSize);`      
    `    `      `return`         `buf;`      
    `}`      
    
    `static`         `YacVoid testYacMfreeFunc(YacPointer ctxp, YacPointer memptr)`      
    `{`      
    `    `      `YacUint32* memCtx = (YacUint32*)ctxp;`      
    `    `      `COD_ASSERT(*memCtx == 1);`      
    `    `      `free`      `(memptr);`      
    `}`      
    
    `TEST_F(TestYacDriverBase, testYacMemCallback)`      
    `{`      
    `    `      `YacUint32 memCtx = 1;`      
    
    `    `      `YacHandle env = NULL;`      
    `    `      `YacHandle conn = NULL;`      
    `    `      `YacHandle stmt = NULL;`      
    `    `      `YAC_EXPECT_CALL(yacAllocEnvWithMemCb(&env, &memCtx, testYacMalocFunc, testYacRalocFunc, testYacMfreeFunc));`      
    `    `      `YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_DBC, env, &conn));`      
    `    `      `YAC_EXPECT_CALL(yacConnect(conn, gSrvStr, YAC_NULL_TERM_STR, user, YAC_NULL_TERM_STR, pwd, YAC_NULL_TERM_STR));`      
    
    `    `      `YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_STMT, conn, &stmt));`      
    `    `      `YAC_EXPECT_CALL(yacDirectExecute(stmt, `      `"select 1 from dual"`      `, YAC_NULL_TERM_STR));`      
    `    `      `YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt));`      
    
    `    `      `yacDisconnect(conn);`      
    `    `      `YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_DBC, conn));`      
    `    `      `YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_ENV, env));`      
    `}`  

  


## 3.测试设计方法

        主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|编号|有效等价类 |备注|无效等价类|备注|
|---|---|---|---|---|
|1|申请多次|  
|参数值异常|  
|
|2|正常使用|  
|内存使用完后申请|  
|
|3|全部已有用例使用内存注入管理|  
|不释放内存-----内存泄漏|  
|
|4|连接断开表现（TAF）|  
|异常释放位置---core|  
|


## 4.测试用例设计

  


## 5.测试框架设计

 本次测试采用cunit测试框架实现，执行test_memory_injection.h文件，对比期望结果与输出结果，输出测试结果。

## 6.测试环境说明

|  
,服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|  
|


## Attachments:

[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzNhMWFkOWEzMzExZGM3NmEzIiwicmVmX2lkIjoiNjczOTY5NzM1OTNmOTljOWZmMjM0ZjA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3Njc1LCJleHAiOjE3ODIyMTQwNzV9.kgOMG1L-FkX38o5BbM8LmQlwGst173TgD8E3HrRGg0k)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NzM4OTcwYzJhZjRmNTFmODJjIiwicmVmX2lkIjoiNjczOTY5NzM1OTNmOTljOWZmMjM0ZjA2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3Njc1LCJleHAiOjE3ODIyMTQwNzV9.4yueIcANzvl0q8FEB2A8Gx4SLY38DUPUxX17G9Jcvmg)

 (image/svg+xml)    
