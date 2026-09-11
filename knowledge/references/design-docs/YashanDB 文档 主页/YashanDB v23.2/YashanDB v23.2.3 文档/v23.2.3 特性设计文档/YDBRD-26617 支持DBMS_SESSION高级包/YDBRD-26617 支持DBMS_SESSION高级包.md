Created by 邬建川, last modified on 五月 16, 2024

  [https://pingcode.yasdb.com/pjm/items/66276a74fd997db58adfd1e4](https://pingcode.yasdb.com/pjm/items/66276a74fd997db58adfd1e4)    ?    
  #YDBRD-26617 支持DBMS_SESSION高级包

#   [DBMS_SESSION模块设计文档](#dbms-session模块设计文档)  

##   [1. 总述](#1-总述)  

DBMS_SESSION是数据库管理系统（DBMS）中的一个模块，它支持会话级别的上下文管理。

###   [1.1 需求来源](#11-需求来源)  

oracle兼容

需支持的部署形态包括：

- 主备（单机）


###   [1.2 调研文档](#12-调研文档)  

  [DBMS_SESSION调研](https://conf.yasdb.com/pages/viewpage.action?pageId=153005940)  

###   [1.3 需求分析](#13-需求分析)  

兼容oracle支持DBMS_SESSION高级包

- DBMS_SESSION.SET_CONTEXT
- DBMS_SESSION.CLEAR_ALL_CONTEXT
- DBMS_SESSION.CLEAR_CONTEXT


上述三个procedure经分析，需要依赖create context的支持。在本SR暂不做。

支持以下三个procedure:

- DBMS_SESSION.SET_IDENTIFIER
- DBMS_SESSION.CLEAR_IDENTIFIER
- DBMS_SESSION.FREE_UNUSED_USER_MEMORY


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

###   [添加DBMS_SESSION高级包，涉及三个procedure：](#添加dbms-session高级包涉及三个procedure)  

|接口|参数|返回值|接口说明|
|---|---|---|---|
|DBMS_SESSION.SET_IDENTIFIER|client_identifier(VARCHAR)|无|设置客户端标识符|
|DBMS_SESSION.CLEAR_IDENTIFIER|无|无|清除客户端标识符|
|DBMS_SESSION.FREE_UNUSED_USER_MEMORY|无|无|仅兼容，无实际作用|


###   [V$SESSION 增加字段](#vsession-增加字段)  

|字段|类型|说明|
|---|---|---|
|CLIENT_IDENTIFIER|VARCHAR|当前会话的客户端标识符|


##   [3. 规格与约束](#3-规格与约束)  

- client_identifier的最大长度为64，超过该长度则报错
- DBMS_SESSION.FREE_UNUSED_USER_MEMORY 为兼容oracle，对系统暂无实际影响
- 未设置client_identifier的会话，查到v$session上对应字段为NULL
- SET_IDENTIFIER 可以置NULL
- 任何用户都有权限执行这些过程


##   [4. 特性](#4-特性)  

**增加DBMS_SESSION高级包**  ，支持  **3个过程(PROCEDURE)**

###   [4.1 PROCEDURE](#41-procedure)  

-   `DBMS_SESSION.SET_IDENTIFIER`    :


在AnlHandlerAttr上增加clientId字段，用于存储client_identifier

```
typedef struct StAnlHandlerAttr {
    ...
    CodChar           clientId[COD_NAME_BUFFER_SIZE]; 
} AnlHandlerAttr;

```

|参数|参数说明|功能|实现|
|---|---|---|---|
|client_identifier VARCHAR|client_identifier的最大长度是64字节，超过则报错|为用户会话设置客户端标识符|将客户端标识符存在handlerAttr上|


-   `DBMS_SESSION.CLEAR_IDENTIFIER`    :


|参数|参数说明|功能|实现|
|---|---|---|---|
|无|无|清除客户端标识符|将标志client_identifier是否有效的标志位置为无效|


-   `DBMS_SESSION.FREE_UNUSED_USER_MEMORY`    :


|参数|参数说明|功能|实现|
|---|---|---|---|
|无|无|无|高级包可以调用不报错，对系统无实际影响|


###   [4.2 特性可维可测设计](#42-特性可维可测设计)  

- **V$SESSION 增加 client_identifier**  字段可验证DBMS_SESSION.SET_IDENTIFIER 和 DBMS_SESSION.SET_IDENTIFIER 生效与否。


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|测试场景|预期|
|---|---|
|对于新连接未设置clientId的会话查询v$session|client_identifier 字段为 NULL|
|对未设置clientId的会话调用，CLEAR_IDENTIFIER|系统无报错，查v$session，对应字段为NULL|
|调用DBMS_SESSION.SET_IDENTIFIER|查v$session, client_identifier 更新成功|
|调用DBMS_SESSION.CLEAR_IDENTIFIER|查v$session, client_identifier字段为 NULL|
|调用DBMS_SESSION.SET_IDENTIFIER，对应的标识符超过64字节|报错|
|调用DBMS_SESSION.SET_IDENTIFIER,参数为NULL|client id 变为 NULL|
|调用DBMS_SESSION.FREE_UNUSED_USER_MEMORY|高级包返回成功|


##   [6.资料设计章节](#6资料设计章节)  

- DBMS_SESSION高级包资料添加
- V$SESSION 增加字段


##   [7.未来规划](#7未来规划)  

- DBMS_SESSION后续要在支持create context 后补齐SET_CONTEXT/CLEAR_CONTEXT/CLEAR_ALL_CONTEXT 三个procedure


## Comments:

|  [](null)  ,1.client_identiifer 能设成NULL吗,2. 中文截断的表现,3. oracle 多会话可一样吗,4. 并行handler,5.复用清理的问题,Posted by wujianchuan at 五月 15, 2024 15:51|
|---|
