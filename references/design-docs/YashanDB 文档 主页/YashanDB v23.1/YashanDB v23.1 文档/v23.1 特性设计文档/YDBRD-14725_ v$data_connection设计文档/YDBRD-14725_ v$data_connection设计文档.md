Created by 汪少华 on 十月 14, 2024

  [YDBRD-14725](https://jira.yasdb.com/browse/YDBRD-14725?src=confmacro)    -  支持v$data_connection视图  完成

##   [1. Overview（概述）](#1-overview概述)  

基于分布式集群故障恢复能力增强的需求，在已有dv$data_connetcion视图的情况下，需要在出现网络故障时也能查询到本地视图，因此新增v$data_connection视图，显示当前节点已创建的会话内连接信息。该视图在open阶段可以对外查询，且为instance级别的视图。

##   [2. Features（功能特性）](#2-features功能特性)  

实现v$data_connection视图查询，在分布式下，使用sql查询语句，显示自身已创建的会话内连接信息。

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
select * from v$data_connection;


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 该v$data_connection视图支持分布式场景下使用，单机场景下查询结果为空。
1. 该v$data_connection视图在分布式场景下使用时，只有对cn查询时可以查询到数据，对dn、mn查询时则查询结果为空。
1. 该v$data_connection视图在分布式场景下使用并且对cn进行查询时，若会话内没有sql执行过，即会话内没有连接信息，则查询结果为空。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Display(字段展示）](#51-display字段展示)  

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


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [视图主要数据结构](#视图主要数据结构)  

```
#define v$DataConnectionOpen dvDataConnectionOpen
#define v$DataConnectionClose dvDataConnectionClose
#define v$DataConnectionFetch dvDataConnectionFetch


```

```

typedef struct StDataConnectionInfo {
    CodUint32 sid;
    CodUint16 handlerId;
    CodUint32 serial;
    CodUint32 seqId;
    CodChar   sqlId[ANL_SQL_ID_MD5_LENGTH];
    CodUint16 peerEndpoint;
    CodUint8  status;
    CodUint64 waitAckTime;
    CodUint8  isConnected;
    CodUint8  isFirst;
    CodUint32 connectionVersion;
    CodUint32 peerHandlerId;
    CodUint32 peerHandlerSerial;
} DataConnectionInfo;


```

####   [v$data_connection视图流程](#vdata-connection视图流程)  

1. 打开VM，申请内存；
1. 获取会话内连接信息，并保存为DataConnectionInfo,然后将DataConnectionInfo保存到VM；
1. 获取VM内保存的DataConnectionInfo信息；
1. 将DataConnectionInfo信息填充至系统表进行输出；
1. 释放内存。


![](https://pingcode.yasdb.com/atlas/files/public/67396aea8970c2af4f51ffe4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVCQUFBQUFBQUFBQUFBQUFBQUFDNEJBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBVUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBSUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxMzIsImV4cCI6MTc4MjMwMDkzMn0.aEyOBdXhalgvfa6FIkuPOmhHhBKSfJv46gau2nauiNo)

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 1mn1cn3-1dn集群正常拉起情况下，在cn上查看v$data_connection视图，校验数据显示是否正确。开启一个sql执行，即有连接信息后，再查看v$data_connection视图，校验数据是否正确。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396aea8970c2af4f51ffe5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVCQUFBQUFBQUFBQUFBQUFBQUFDNEJBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBVUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBSUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxMzIsImV4cCI6MTc4MjMwMDkzMn0.aEyOBdXhalgvfa6FIkuPOmhHhBKSfJv46gau2nauiNo)
1. 1mn1cn3-1dn集群正常拉起情况下，在主mn，主dn上查看v$data_connection视图，校验数据显示是否正确。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396aeaa1ad9a3311dc7e5c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVCQUFBQUFBQUFBQUFBQUFBQUFDNEJBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBVUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBSUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxMzIsImV4cCI6MTc4MjMwMDkzMn0.aEyOBdXhalgvfa6FIkuPOmhHhBKSfJv46gau2nauiNo)
1. 1mn2cn3-1dn集群正常拉起情况下，重复自测用例1和自测用例2的测试步骤，在cn上查看v$data_connection视图，校验数据是否正确。在主mn，主dn上查看v$data_connection视图，校验数据是否正确。
1. ![](https://pingcode.yasdb.com/atlas/files/public/67396aea8970c2af4f51ffe6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQUFBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUVCQUFBQUFBQUFBQUFBQUFBQUFDNEJBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBVUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBSUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxMzIsImV4cCI6MTc4MjMwMDkzMn0.aEyOBdXhalgvfa6FIkuPOmhHhBKSfJv46gau2nauiNo)


##   [7. Document（资料）](#7-document资料)  

在doc文件目录下增加动态视图v$data_connection的介绍（即V$DATA_CONNECTIONDE.md）

##   [8. Workload（工作量）](#8-workload工作量)  

2人/天

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

  
