Created by 汪少华 on 十月 14, 2024

SR：    [https://pingcode.yasdb.com/pjm/items/66276af6fd997db58adfd37f](https://pingcode.yasdb.com/pjm/items/66276af6fd997db58adfd37f)    ?    
  #YDBRD-26618 支持DBMS_APPLICATION_INFO内置系统包

##   [1. 总述](#1-总述)  

DBMS_APPLICATION_INFO用于注册应用程序名称和操作，以用于审核或性能跟踪。

###   [1.1 需求来源](#11-需求来源)  

兼容oracle DBMS_APPLICATION_INFO内置系统包。

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=150632499](https://conf.yasdb.com/pages/viewpage.action?pageId=150632499)  

###   [1.3 需求分析](#13-需求分析)  

通过调用DBMS_APPLICATION_INFO包，在会话上记录用户设定的信息。

###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

```
DBMS_APPLICATION_INFO.READ_CLIENT_INFO (
   client_info OUT VARCHAR);

DBMS_APPLICATION_INFO.READ_MODULE ( 
   module_name OUT VARCHAR, 
   action_name OUT VARCHAR);

DBMS_APPLICATION_INFO.SET_ACTION (
   action_name IN VARCHAR);

DBMS_APPLICATION_INFO.SET_CLIENT_INFO (
   client_info IN VARCHAR); 

DBMS_APPLICATION_INFO.SET_MODULE ( 
   module_name IN VARCHAR, 
   action_name IN VARCHAR); 

```

  `V$SESSION`    增加CLIENT_INFO     `VARCHAR(64)`    字段

设置的    `client_info`    值可通过查询    `V$SESSION`    的    `CLIENT_INFO`    字段或调用    `READ_CLIENT_INFO`    查询本会话的值。

设置的    `module_name`    和    `action_name`    值可通过查询    `V$SQLAREA`    的    `MODULE`    和    `ACTION`    字段（本会话生成的计划会设置）到或调用    `READ_MODULE`    查询本会话的值。

##   [3. 规格与约束](#3-规格与约束)  

1. SET_ACTION输入的action_name超过32字节截断
1. SET_CLIENT_INFO输入的client_info超过64字节截断
1. SET_MODULE输入的module_name超过48字节截断，action_name超过32字节截断
1. 设置的字段如果在过程体结束后没被设置成null，后续操作也会使用相同字段，直到会话退出。
1. 支持部署模式：单机


##   [4. 特性](#4-特性)  

###   [4.1 client_info 字段](#41-client-info-字段)  

通过SET_CLIENT_INFO函数设置，READ_CLIENT_INFO返回当前会话上次设置的值，当前会话无设置则返回null。

  `V$SESSION`    增加CLIENT_INFO     `VARCHAR(64)`    字段，展示会话上次设置的client_info。通过在stmt(handler)上增加clientInfo字段保存实现。

###   [4.2 module 字段](#42-module-字段)  

通过SET_MODULE函数设置，READ_MODULE返回当前会话上次设置的值，当前会话无设置则返回null。

  `V$SQLAREA`    的MODULE字段显示sql第一次解析当前会话MODULE设置的值。

调用SET_MODULE则设置module值到anlhandler上，在sql解析时加载到anlContext上，若复用plan cache中的计划，则不会设置上。若同一语句被多个会话设置module，取第一次解析的会话设置的module。

###   [4.3 action 字段](#43-action-字段)  

类似module字段。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1. 调用SET函数设置当前会话的各个字段，通过调用READ函数查询设置值。
1. 调用SET函数设置当前会话的各个字段，通过查询    `V$SESSION`    及    `V$SQLAREA`    查看设置值是否正确。
1. 调用SET函数设置当前会话的各个字段，不清空字段，会话退出后复用会话，通过调用READ函数查询设置值是否为null。


##   [6.资料设计章节](#6资料设计章节)  

无

##   [7.未来规划](#7未来规划)  

无