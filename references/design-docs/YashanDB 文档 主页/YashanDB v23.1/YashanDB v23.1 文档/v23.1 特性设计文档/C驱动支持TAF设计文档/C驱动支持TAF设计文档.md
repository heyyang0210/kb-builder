Created by 冯皓博 on 一月 18, 2024

  [C驱动支持TAF调研 - 冯皓博 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109603415)  

# 概述：

透明应用程序故障转移 （TAF） 是一项客户端功能，旨在最大程度地减少数据库连接因实例或网络故障而失败时对最终用户应用程序的中断。

TAF 可以在各种系统配置上实施，包括 Oracle Real Application Clusters （Oracle RAC） 和 Oracle Data Guard 物理备用数据库。TAF 也可以在重新启动单个实例系统后使用（例如，在进行修复时）。

可以将 TAF 配置为还原数据库会话，也可以选择重播打开的查询。从 Oracle 数据库 10g 第 2 版 （10.2） 开始，应用程序在尝试故障转移失败后尝试使用的所有语句。也就是说，尝试执行或获取其他语句会进行 TAF 恢复，就像失败时语句一样。后续语句现在可能会成功（而过去它们会失败），或者应用程序可能会收到与尝试的 TAF 恢复相对应的错误（例如       `ORA-25401`    ）。

注：远程数据库链接或 DML 语句不支持 TAF。

同时支持服务端+客户端配置

# C驱动TAF设计

### **1、**  **TAF(Transparent Application Failover)**

**FAILOVER**  **：**

子参数

|参数名|值|说明|
|:---|:---|:---|
|BACKUP|  
|通过其网络服务名称指定故障转移节点。必须为故障转移节点创建一个单独的网络服务名称。（暂不支持）|
|TYPE|  `session`    ：故障转移会话；也就是说，如果用户的连接丢失，将自动为备份用户创建一个新会话。这种类型的故障转移不会尝试恢复选择。,  `select`    ：允许打开游标的用户在失败后继续获取它们。但是，这种模式在正常的选择操作中涉及到客户端的开销。,  `none`    ：这是默认设置，其中不使用故障转移功能。这也可以明确指定以防止发生故障转移。|指定故障转移的类型。默认情况下，    [Oracle 调用接口 (OCI)](https://docs.oracle.com/cd/B10500_01/network.920/a96581/glossary.htm#998160)    应用程序可以使用三种类型的 Oracle Net 故障转移功能：|
|METHOD|  `basic`    ：这是默认设置，在故障转移时建立连接。此选项几乎不需要在故障转移时间之前对备份数据库服务器进行任何操作。,  `preconnect`    ：预先建立连接。这提供了更快的故障转移，但要求备份实例能够支持来自每个受支持实例的所有连接。|指定从主节点到备份节点的故障转移速度|
|RETRIES|  
|指定故障转移后尝试连接的次数。如果    `DELAY`    指定，    `RETRIES`    则默认为五次重试。|
|DELAY|  
|指定在连接尝试之间等待的时间（以秒为单位）。如果    `RETRIES`    指定，    `DELAY`    则默认为一秒。|


**笔记：**

如果注册了回调函数，则忽略    `RETRIES,DELAY`    子参数。

如果使用  preconnect   模式，那么必须指定  BACKUP  参数。

### **2、**  **Client-Side**   Connect  ** Time Failover**

**FAILOVER**  **：**

如果用户端tnsname 中配置了多个地址，用户发起连接请求时，会先尝试连接地址表中的第一个地址，如果这个连接尝试失败，则继续尝试使用第二个地址，直至连接成功或者遍历了所有的地址。

这种Failover的特点：　只在建立连接那一时刻起作用，也就是说，这种Failover方式只在发起连接时才会去感知节点故障，如果节点没有反应，则自动尝试地址列表中的下一个地址。一旦连接建立之后，节点出现故障都不会做处理，从客户端的表现就是会话断开了，用户程序必须重新建立连接。

启用这种Failover的方法就是在客户端的tnsnames.ora中添加FAILOVER=ON 条目，这个参数默认就是ON，所以即使不添加这个条目，客户端也会获得这种Failover能力。

# 支持项：

### 1、yasc_service.ini配置项支持

目前我们的ini框架不支持复杂格式譬如.ORA格式的解析，仅支持key+ value形式的解析，故tnsnames.ora类似参数目前实现还需配置文件解析框架支持

支持格式：

YASDB_DATASOURCE = 192.168.1.1:1688,192.168.1.1:1688,192.168.1.1:1688?failover_mode=on&failoverType=session&failoverMethod=basic&failoverRetires=2  0    [&failoverDelay =1](yasdb://192.168.1.1:1688/yashan?connecTimeout=60&socketTimeout=120&loginTimeout=60&serverMode=dedicated)    5

**2、首次连接FAILOVER机制支持**

**FAILOVER**  **：**

配置多IP/PORT后尝试顺次连接

**3、FAILOVER_MODE机制支持**

**FAILOVER_MODE**  **：**

TAF支持

新增YAC_ATTR_TAF_ENABLED只读项用于获取当前TAF是否开启（还未实现，正在补充）

**4、心跳检测支持**

新增CMD_PING

新增yacPing函数

在yacEnv上新建心跳连接和心跳链表

在yacEnv上新建后台线程，用于ping以及心跳失败后连接的异步关闭

yacConnect挂链，yacDisConnect摘链

20s

**5、回调函数支持**

应用程序开发人员可以注册故障转移回调函数。如果发生故障转移，则在重新建立用户会话时会多次调用回调函数。

对回调函数的第一次调用发生在数据库首次检测到实例连接丢失时。此回调旨在允许应用程序通知用户即将到来的延迟。如果故障转移成功，则在重新建立连接并可用时，将再次调用回调函数。

重新建立连接后，客户端可能需要重播命令并通知用户故障转移已发生。如果故障转移不成功，则调用回调以通知应用程序无法进行故障转移。此外，每次在新连接上重新验证主句柄以外的用户句柄时，都会调用回调。由于每个用户句柄表示一个服务器端会话，因此客户端可能需要重播该会话的  ALTER   SESSION  命令。

回调函数动作：

#define YAC_TAF_END 0x00000001 表示故障转移成功完成。    
  #define YAC_TAF_ABORT 0x00000002 指示故障转移不成功，并且没有重试选项。    
  #define YAC_TAF_BEGIN 0x00000008 指示故障转移已检测到连接丢失并且故障转移正在启动。    
  #define YAC_TAF_ERROR 0x00000010   还指示故障转移不成功，但它使应用程序有机会处理错误并重试故障转移。

**6、负载均衡+主备要不要做**

不需要做

  


回调函数返回值：

|  `typedef`         `enum`         `EnYacTafResult {`      
    `YAC_TAF_SUCCESS = 0,`      
    `YAC_TAF_RETAY = 25410,`      
    `YAC_TAF_ERROR = -1,`      
    `} YacTafResult;`  |
|:---|


回调函数声明：

|  `YacTafResult yacTAFCallBackFn(YacHandle hConn, YacHandle hEnv, YacVoid* tafCtx, YacUint32 tafType, YacUint32 tafEvent);`  |
|:---|


回调函数注册结构：

|  `typedef`         `YacTafResult (*YacCallbackFailover)(YacHandle hConn, YacHandle hEnv, YacVoid* tafCtx, YacUint32 tafType, YacUint32 tafEvent);`      
    
    `typedef`         `struct`      
    `{`      
    `  `      `YacCallbackFailover callback_function;`      
    `  `      `void`         `*foCtx;`      
    `}`      
    `YacFocbkStruct;`  |
|:---|


回调函数注册方法：

包括注册故障转移和取消注册故障转移

|  `设置句柄yacSetConnAttr`      
    `属性：YAC_ATTR_FOCBK`  |
|:---|


# 并发控制：

## 临界资源：

![](https://pingcode.yasdb.com/atlas/files/public/67396a2c8970c2af4f51fce0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE0NzUsImV4cCI6MTc4MjIyMjI3NX0.qGNJ8RonnNz6zZm_Ws5IOQgryAH5oLuJP8tW5P2D20o)

  


# 测试场景：

### 心跳相关：

1、心跳断连过程中如果有新连接进入，这时心跳能做到不误关新链接

2、心跳断连过程中如果有新连接进入，这时心跳能做到不放过应关闭的老链接

### TAF相关：

1、TAF重启后能够恢复通过驱动接口设置后的conn级别属性

2、单节点模式能够触发TAF，多节点模式正常顺延

3、TAF重启前如果有事务，那么事务禁止除ROLLBACK之外的操作

4、TAF失败后创建好的lob失效

5、回调函数？

# 验证项：

# 测试用例：

```
YacResult testConnect1()
{
    const YacChar* gSrvStr = "127.0.0.1:1688?failover = on & FAILOVER_TYPE = SESSION & FAILOVER_RETRIES = 10 & FAILOVER_DELAY = 1";
    const YacChar* user = "sys";
    const YacChar* pwd = "Cod-2022";

    YAC_CALL(yacAllocHandle(YAC_HANDLE_ENV, NULL, &gTestEnv.env));
    YacHandle conn1
    YAC_CALL(yacAllocHandle(YAC_HANDLE_DBC, gTestEnv.env, &conn1));
    YAC_CALL(yacConnect(conn1, gSrvStr, YAC_NULL_TERM_STR, user, YAC_NULL_TERM_STR, pwd, YAC_NULL_TERM_STR));
    printf("connected!");

    YacHandle stmt1;
    YAC_CALL(yacAllocHandle(YAC_HANDLE_STMT, conn1, &stmt1));
    // 断
    YacResult res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);

    YAC_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt1));
    yacDisconnect(conn1);
    YAC_CALL(yacFreeHandle(YAC_HANDLE_DBC, conn1));
    YAC_CALL(yacFreeHandle(YAC_HANDLE_ENV, gTestEnv.env));

    return YAC_SUCCESS;
}

YacResult testConnect2()
{
    const YacChar* gSrvStr = "127.0.0.1:1688?failover = on & FAILOVER_TYPE = SESSION & FAILOVER_RETRIES = 1 & FAILOVER_DELAY = 1";
    const YacChar* user = "sys";
    const YacChar* pwd = "Cod-2022";

    YAC_CALL(yacAllocHandle(YAC_HANDLE_ENV, NULL, &gTestEnv.env));
    YacHandle conn1;
    YacHandle conn2;
    YAC_CALL(yacAllocHandle(YAC_HANDLE_DBC, gTestEnv.env, &conn1));
    YAC_CALL(yacAllocHandle(YAC_HANDLE_DBC, gTestEnv.env, &conn2));
    YAC_CALL(yacConnect(conn1, gSrvStr, YAC_NULL_TERM_STR, user, YAC_NULL_TERM_STR, pwd, YAC_NULL_TERM_STR));
    YAC_CALL(yacConnect(conn2, gSrvStr, YAC_NULL_TERM_STR, user, YAC_NULL_TERM_STR, pwd, YAC_NULL_TERM_STR));
    printf("connected!");

    YacHandle stmt1;
    YacHandle stmt2;
    YAC_CALL(yacAllocHandle(YAC_HANDLE_STMT, conn1, &stmt1));
    YAC_CALL(yacAllocHandle(YAC_HANDLE_STMT, conn2, &stmt2));
    // 断+重启
    YacResult res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);

    res = yacDirectExecute(stmt2, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);

    YAC_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt1));
    YAC_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt2));
    yacDisconnect(conn1);
    yacDisconnect(conn2);
    YAC_CALL(yacFreeHandle(YAC_HANDLE_DBC, conn1));
    YAC_CALL(yacFreeHandle(YAC_HANDLE_DBC, conn2));
    YAC_CALL(yacFreeHandle(YAC_HANDLE_ENV, gTestEnv.env));

    return YAC_SUCCESS;
}

YacTafResult tafCb(YacHandle hConn, YacHandle hEnv, YacPointer tafCtx, YacTafType tafType, YacTafEvent tafEvent) 
{
    YacUint32* intRetry = tafCtx;
    if (tafEvent == YAC_TAF_EVENT_BEGIN) {
        *intRetry = 0;
    }

    printf("TAF callback: %d, %d\n", tafType, tafEvent);
    if (tafEvent == YAC_TAF_EVENT_ERROR && *intRetry < 1) {
        (*intRetry)++;
        sleep(1000);
        return YAC_TAF_RETRY;
    }
    return YAC_TAF_SUCCESS;
}

YacResult testConnect1WithCallBack()
{
    const YacChar* gSrvStr = "127.0.0.1:1688?failover = on & FAILOVER_TYPE = SESSION & FAILOVER_RETRIES = 10 & FAILOVER_DELAY = 1";
    const YacChar* user = "sys";
    const YacChar* pwd = "Cod-2022";

    YAC_CALL(yacAllocHandle(YAC_HANDLE_ENV, NULL, &gTestEnv.env));
    YacHandle conn1;
    YacHandle conn2;
    YAC_CALL(yacAllocHandle(YAC_HANDLE_DBC, gTestEnv.env, &conn1));

    YacChar* buf = malloc(sizeof(YacUint32));
    if (buf == NULL) {
        return YAC_ERROR;
    }
    YacUint32* intRetry = (YacUint32*)buf;
    YacTafCallbackStruct cbStruct = { .tafCtx = intRetry,.tafCallbackFunc = tafCb };

    YAC_CALL(yacSetConnAttr(conn1, YAC_ATTR_TAF_CALLBACK, (YacVoid*)&cbStruct, sizeof(YacTafCallbackStruct)));
    YAC_CALL(yacConnect(conn1, gSrvStr, YAC_NULL_TERM_STR, user, YAC_NULL_TERM_STR, pwd, YAC_NULL_TERM_STR));
    printf("connected!");
    //Sleep(10000);
    YacHandle stmt1;
    YAC_CALL(yacAllocHandle(YAC_HANDLE_STMT, conn1, &stmt1));
    // 断
    YacResult res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);
    res = yacDirectExecute(stmt1, "select 1 from dual", YAC_NULL_TERM_STR);

    YAC_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt1));
    yacDisconnect(conn1);
    YAC_CALL(yacFreeHandle(YAC_HANDLE_DBC, conn1));
    YAC_CALL(yacFreeHandle(YAC_HANDLE_ENV, gTestEnv.env));

    return YAC_SUCCESS;
}
```

  


  


## Attachments: