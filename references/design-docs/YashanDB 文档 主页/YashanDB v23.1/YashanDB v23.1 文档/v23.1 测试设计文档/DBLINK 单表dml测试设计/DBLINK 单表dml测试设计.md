Created by 王莹, last modified on 十一月 08, 2023

# **1. 概述**

这几个SR实现的是DBlink 单表dml的功能

  [YDBRD-13330](https://jira.yasdb.com/browse/YDBRD-13330?src=confmacro)    -  实现DBLINK DML的INSERT单表能力  完成

  [YDBRD-13334](https://jira.yasdb.com/browse/YDBRD-13334?src=confmacro)    -  实现DBLINK的DML UPDATE单表能力  完成

  [YDBRD-13335](https://jira.yasdb.com/browse/YDBRD-13335?src=confmacro)    -  实现DBLINK的DML DELETE单表能力  完成

# **2. 需求分析**

执行实现原理：

1. yasdb将从客户端收到的dblink  ** 原始sql改写从绑定参数形式**  ，如 insert into t1@test_dblink values(1, 'ee'); 改写成insert into t1 values(:1, :2)并构造好绑定参数写入协议包发送给yex_server进程。
1. yex_server进程收到后，解析CsPacket->head->cmd, 对于insert操作，为DBLINK_CMD_EXECUTE_SQL，然后主要是  **调用ODBC相关接口**  ，如OCIStmtPrepare2， OCIStmtExecute，发送到oracle执行，并将结果返回给yasdb。


      3.yasdb收到yex_server发送的ack包，根据ack->head→result将结果返回给客户端

### **2.1  SR：**    [[YDBRD-13330] 实现DBLINK DML的INSERT单表能力 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13330)  

开发设计文档：    [YDBRD-13330, 单表insert - 胡波洋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109589655)  

支持dblink 单表insert数量到远端表。

insert into tb@dblink [col] values(),();

约束：

1. 多表insert不支持
1. insert + select不支持
1. insert + on duplicate key 不支持
1.  insert + return 不支持（对齐oracle）


### 2.2 SR：    [[YDBRD-13334] 实现DBLINK的DML UPDATE单表能力 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13334)  

开发设计文档：    [YDBRD-13334, 单表update - 胡波洋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109589650)  

1.支持update本地表filter子查询带远端表，支持依赖于当前dblink select的支持范围。

2.实现单表update远端表支持，带子查询（本地，远端）禁掉。多表update拦截报错。

约束：

1. update远端表，对update的filter有如下限制(与dblink单表delete filter 限制一样)：
    1.             *投影列，aggr聚集函数，窗口函数，子查询，sequence，udf在filter中出现当前会拦截报错
1. update远端表， filter中使用内置函数，按照yasdb内部函数进行校验，如yasdb内部没有实现的函数，校验报错。
1. 多表update


### 2.3 SR：    [[YDBRD-13335] 实现DBLINK的DML DELETE单表能力 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13335)  

开发设计文档：    [YDBRD-13335, 单表delete - 胡波洋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109589647)  

1.支持delete本地表filter子查询带远端表，支持依赖于当前dblink select的支持范围。

2.实现delete远端表支持，带子查询（本地，远端）禁掉， 多表delete拦截报错。

约束与update一致

  


  


# **3. 测试**  **设计方法**

**本次测试设计主要采用**  **场景法，组合法等**

# 4.   **详细测试设计**

**4.1功能**

**4.2专项**

并发，一致性，（框架不支持）

  


# 5.   **测试用例**

  


# **6 测试框架设计**

**框架暂时不支持**

## Attachments:

[DBlink.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDc4OTcwYzJhZjRmNTFmNmZmIiwicmVmX2lkIjoiNjczOTY5NDc1OTNmOTljOWZmMjM0Y2I3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2NTEwLCJleHAiOjE3ODIyMTI5MTB9.H0mjbveJCuxFM9lFA6Hq0XM3t8YWCsOIXYgh0qRoFbI)

 (application/x-xmind)    
