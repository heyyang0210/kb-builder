Created by 施新华, last modified on 十一月 14, 2023

# 1.   **概述**

基于分布式集群故障恢复能力增强的需求，在已有dv$data_connetcion视图的情况下，需要在出现网络故障时也能查询到本地视图，因此新增v$data_connection视图，显示当前节点已创建的会话内连接信息。该视图在open阶段可以对外查询，且为instance级别的视图。

SR：    [YDBRD-14725](https://jira.yasdb.com/browse/YDBRD-14725?src=confmacro)    -  支持v$data_connection视图  完成

# 2.   **需求分析Y**

实现v$data_connection视图查询，在分布式下，使用sql查询语句，显示自身已创建的会话内连接信息。

**约束**  ：

1. 该v$data_connection视图支持分布式场景下使用，单机场景下查询结果为空。
1. 该v$data_connection视图在分布式场景下使用时，只有对cn查询时可以查询到数据，对dn、mn查询时则查询结果为空。
1. 该v$data_connection视图在分布式场景下使用并且对cn进行查询时，若会话内没有sql执行过，即会话内没有连接信息，则查询结果为空。


# 3.   **测试设计方法**

## 3.1 功能测试

3.1.1 视图定义

|字段|类型|说明|
|---|---|---|
|GLOBAL_SESSION_ID|INTEGER|分布式全局会话ID|
|HANDLER_ID|SMALLINT|自身handler ID|
|SERIAL#|INTEGER|分配序列号|
|SEQ_ID|INTEGER|sequence ID|
|SQL_ID|VARCHAR(13)|当前会话正在执行的SQL ID（SQL文本的哈希/加密运算结果）|
|PEER_GROUP_ID|INTEGER|对端组ID|
|PEER_GROUP_NODE_ID|INTEGER|对端组内节点ID|
|PEER_ENDPOINT|SMALLINT|对端节点通信ID|
|STATUS|VARCHAR(8)|连接状态<br>* IDLE<br>* BUSY<br>* ERROR<br>* FAILED|
|WAIT_ACK_TIME|BIGINT|等待回应时间|
|IS_CONNECTED|VARCHAR(8)|CN与对应节点是否连接 <br>* YES<br>* NO|
|IS_FIRST|VARCHAR(8)|是否是第一次连接 <br>* YES<br>* NO|
|CONNECTION_VERSION|INTEGER|使用ICS的连接版本|
|PEER_HANDLER_ID|INTEGER|对端handler ID|
|PEER_HANDLER_SERIAL#|INTEGER|对端handler序列号|


  


3.1.2 测试点设计

|测试项|测试场景|
|---|---|
|部署|单机部署，查询视图为空：select * from   v$data_connection|
|  
|分布式部署3cn3mn3dn，cn查询|
|  
|分布式部署3cn3mn3dn，dn查询|
|  
|分布式部署3cn3mn3dn，mn查询|
|语法|带filter|
|  
|join：本地视图与本地视图，本地视图与分布式视图，本地视图与系统表，本地视图与普通表|
|  
|子查询|
|  
|desc 视图|
|节点正常查询视图|无业务场景下查询视图|
|  
|带背景业务下查询视图|
|节点故障场景下查询视图|cn故障，dn故障，mn故障|
|并发|并发业务下查询视图|


梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|是|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 5.   **测试用例**

  


# 6.   **测试框架设计**

**yasft和testkill**

# 7.   **测试环境说明**

虚拟机