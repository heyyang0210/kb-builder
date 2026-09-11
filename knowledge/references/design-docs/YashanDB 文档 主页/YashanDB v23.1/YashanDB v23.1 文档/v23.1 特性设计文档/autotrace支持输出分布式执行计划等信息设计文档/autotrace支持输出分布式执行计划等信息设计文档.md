Created by 秦湫婷 on 一月 18, 2024

  [YDBRD-13063](https://jira.yasdb.com/browse/YDBRD-13063?src=confmacro)    -  autotrace支持输出分布式执行计划等信息  完成

##   [1. Overview（概述）](#1-overview概述)  

分布式下已经支持antotrace输出单个sql的分布式执行计划和算子级别统计信息等信息，现需要补充分布式相关信息，主要为算子级别px信息统计和执行级别统计信息的network io。

单机环境下，设置并行度，如果能正常执行，会有一条px信息显示在px local info下；

##   [2. Features（功能特性）](#2-features功能特性)  

已实现的autotrace内容，用户在开启autotrace，和输入sql之后：

- 显示sql的执行结果
    - 如果表不存在或者sql错误,返回error
- 显示该sql的执行计划
- 显示该sql算子级别的统计信息
- 显示该sql的统计信息
- 显示该sql执行级别的统计信息


在补充了px算子信息后，信息会根据节点进行显示，各节点的px算子信息显示在sql算子级别的统计信息的px remote info 或px local info下；

在补充了执行级别统计信息之后，会显示一条新的network io统计信息在原有执行级别统计信息之后。

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
alter session set statistics_level=all;
set autotrace on;
select..

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 在除cn外的节点上执行sql，如果能正常执行，也不能获取到该px remote info；
1. 统计的网络io只包括经过PX的数据消息大小，不包含outline lob数据以及控制消息，对于outline lob只能统计到lob localtor，不包含lob data；
1. 分布式下因为px localInfo相关的是列表，实现逻辑在rust，因此这里的实现px localInfo下不会展示px算子信息；
1. 同理3，单机环境下，需要设置表为行表，才会在px localInfo下显示px信息；
1. 关于主备部署，因为在dv视图下才会显示备节点信息，没什么意义，因此不展示备节点信息。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 新增信息](#51-新增信息)  

####   [新增px算子信息](#新增px算子信息)  

新增显示各个节点上的px算子信息

|Name|DataType|Description|
|---|---|---|
|total time|Integer|激活时间，即开始执行到结束时间，单位毫秒，取各子线程最大值|
|send_bytes|Bigint|采样时间内发送的数据量，单位byte|
|send_packets|Integer|采样时间内发送包的个数|
|send_acks|Integer|采样时间内发送ack的个数|
|wait_space_times|Integer|采样时间内因发送缓存不足而等待的次数|
|wait_space_timeout|Integer|采样时间内因发送缓存不足而等待超时的次数|
|recv_bytes|Bigint|采样时间内接收的数据量，单位byte|
|recv_packets|Integer|采样时间内接收包的个数|
|recv_acks|Integer|采样时间内接收ack的个数|
|wait_data_times|Integer|采样时间内接收端因数据未到来而等待的次数|
|wait_data_timeout|Integer|采样时间内接收端因数据未到来而等待超时的次数|


####   [新增执行级别统计信息](#新增执行级别统计信息)  

新增network io信息

|Name|DataType|Description|
|---|---|---|
|bytes sent via PX|Integer|网络上PX发送的数据量,，单位bytes|


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [主要相关数据结构](#主要相关数据结构)  

全部执行统计信息：

```
typedef struct StExecStat {
    PlanBaseStat* planBaseStat;    // PlanBaseStat[]
    ObjectArray*  planExtStatBuf;  // PlanExtStatInfo
    ObjectArray*  totalStatBuf;    // SqlTraceStatInfo
    AnkStat       sysStat;
    SqlRefStat    sqlRefStat;
    SpinLock      lock;
    CodUint32     unused;
} ExecStat;


```

表外算子级别统计信息：

```
typedef struct StPlanExtStatInfo {
    CodText      sqlId;
    PlanStatType statType;
    union {
        CodUint32    planId;
        CodUint32    queueId;
    };
    CodUint32    groupId;
    CodUint32    nodeId;
    CodUint64    parallelId;
    CodText      key;
    union {
        CodText   vText;
        CodUint64 vUInt64;
    };
} PlanExtStatInfo;


```

执行级别统计信息：

```
typedef struct StSqlStatInfo {
    CodText   sqlId;
    CodText   statName;
    CodUint64 val;
    CodUint32 stat;
    CodUint32 unused;
} SqlTraceStatInfo;


```

####   [实现流程](#实现流程)  

1. DN子线程（anlStageProc())、CN主线程（fetchDstbCorrdMaster())将queue对应的port的channel信息以key-value形式和queueId、statType一起写进planExtSatBuf数组（stmt->planStat->planExtSatBuf）；
1. DN、CN主线程执行后将所有DN子线程信息汇总（anlMergePlanStat()),并且拼成字符串写进系统表，dn将系统表信息经过序列化和反序列化后统一发送到cn；
1. CN获取本地系统表信息和远程信息写进stmt->planStat->planExtSatBuf；
1. 根据queueId和statType将信息取出，整理格式写到frame->annex->pxInfo并push到数组；
1. 将数组内保存的该信息取出并进行输出。


以三节点(1CN2DN）为例，以下channel1和channel2为一个queue，包含了px sender和px recevier，因此不便以planId进行统计而为queueId

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/07/13_17_58_49_20230713175842.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTEzMjIsImV4cCI6MTc4MjIyMjEyMn0.yYPUV0fmBvGLwonkWCtKjWAaqVa_6AHPgeqpMcaJys4)

![](https://pingcode.yasdb.com/atlas/files/public/67396a0e8970c2af4f51fbb7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTEzMjIsImV4cCI6MTc4MjIyMjEyMn0.yYPUV0fmBvGLwonkWCtKjWAaqVa_6AHPgeqpMcaJys4)

####   [预期效果](#预期效果)  

分布式环境下：

sql:

```
SQL&gt;CREATE  TABLE parallel_lsc_table(parallel_lsc_tableNO INT /*PRIMARY KEY*/,ENAME  VARCHAR(10),JOB  VARCHAR(9),MGR INT,HIREDATE DATE,SAL INT,COMM INT,DEPTNO INT) organization lsc;
SQL&gt;alter session set statistics_level=all;
SQL&gt;set autotrace on;
SQL&gt;SELECT * FROM parallel_lsc_table e WHERE e.sal &lt; 100;


```

预期输出：

```
PARALLEL_LSC_TABLENO ENAME         JOB                    MGR HIREDATE                                  SAL         COMM       DEPTNO 
-------------------- ------------- ------------- ------------ -------------------------------- ------------ ------------ ------------ 




Execution Plan                                                   
---------------------------------------------------------------- 
SQL hash value: 1003464640                                      
Optimizer: ADOPT_C                                              
                                                                
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
| Id | Operation type                 | Name                 | Owner      | E - Rows | A - Rows | Cost(%CPU)  | A - Time | Loops    | Memory   | Disk     | Partition info                 |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
|  0 | SELECT STATEMENT               |                      |            |          |          |             |     64869|          |          |          |                                |
|  1 |  DISTRIBUTED COORDINATOR       |                      |            |          |          |             |     64869|          |          |          |                                |
|  2 |   COL TO ROW                   |                      |            |          |          |             |     62944|          |          |          |                                |
|  3 |    PX N2I REMOTE               | QUEUE_0              |            |     33000|         0|      557( 0)|     62780|          |          |          |                                |
|* 4 |     TABLE ACCESS FULL          | PARALLEL_LSC_TABLE   | SYS        |     33000|         0|      445( 0)|     58400|          |          |          |                                |
+----+--------------------------------+----------------------+------------+----------+----------+-------------+----------+----------+----------+----------+--------------------------------+
                                                                
Operation Information (identified by operation id):             
---------------------------------------------------             
                                                                
   2 - Projection: RemoteTable[1][INTEGER], RemoteTable[1][VARCHAR, 10], RemoteTable[1][VARCHAR, 9], RemoteTable[1][INTEGER], RemoteTable[1][DATE], RemoteTable[1][INTEGER], RemoteTable[1][INTEGER], RemoteTable[1][INTEGER]
   3 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 10], Tuple[0, 2][VARCHAR, 9], Tuple[0, 3][INTEGER], Tuple[0, 4][DATE], Tuple[0, 5][INTEGER], Tuple[0, 6][INTEGER], Tuple[0, 7][INTEGER]
       Execution : [RowCountStatistics]  : [0,512]:0, (512, 1024]:0, (1024,2048]:0, &gt;2048:0 
       PX RemoteInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER : 3-&gt;1 [3][4][5]-&gt;[2])
                      [CN 2-1, 2] total time: 100ms, send_bytes: 0, send_packets: 0, send_acks: 0, wait_space_times: 0, wait_space_timeout: 0, recv_bytes: 0, recv_packets: 0, recv_acks: 0, wait_data_times: 0, wait_data_timeout: 0     
                      [DN 3-1, 3] total time: 100ms, send_bytes: 0, send_packets: 0, send_acks: 0, wait_space_times: 0, wait_space_timeout: 0, recv_bytes: 0, recv_packets: 0, recv_acks: 0, wait_data_times: 0, wait_data_timeout: 0 
                      [DN 4-1, 4] total time: 100ms, send_bytes: 0, send_packets: 0, send_acks: 0, wait_space_times: 0, wait_space_timeout: 0, recv_bytes: 0, recv_packets: 0, recv_acks: 0, wait_data_times: 0, wait_data_timeout: 0 
                      [DN 5-1, 5] total time: 100ms, send_bytes: 0, send_packets: 0, send_acks: 0, wait_space_times: 0, wait_space_timeout: 0, recv_bytes: 0, recv_packets: 0, recv_acks: 0, wait_data_times: 0, wait_data_timeout: 0 
   4 - Projection: Tuple[0, 0][INTEGER], Tuple[0, 1][VARCHAR, 10], Tuple[0, 2][VARCHAR, 9], Tuple[0, 3][INTEGER], Tuple[0, 4][DATE], Tuple[0, 5][INTEGER], Tuple[0, 6][INTEGER], Tuple[0, 7][INTEGER]
       Execution : [Down Filters]  : total filters: 1, supported filters: 1, unsupported filters: 0
 [Down Filters]  : total filters: 1, supported filters: 1, unsupported filters: 0
 [Down Filters]  : total filters: 1, supported filters: 1, unsupported filters: 0
 [MColStatistics] : total slices: 1, order key scan slices: 0
 [MColStatistics] : total slices: 1, order key scan slices: 0
 [MColStatistics] : total slices: 1, order key scan slices: 0
 [Precise]  : total rows: 4, precise rows: 0, not precise rows: 4
 [Precise]  : total rows: 5, precise rows: 0, not precise rows: 5
 [Precise]  : total rows: 5, precise rows: 0, not precise rows: 5
 [RowCountStatistics]  : [0,512]:0, (512, 1024]:0, (1024,2048]:0, &gt;2048:0 [RowCountStatistics]  : [0,512]:0, (512, 1024]:0, (1024,2048]:0, &gt;2048:0 [RowCountStatistics]  : [0,512]:0, (512, 1024]:0, (1024,2048]:0, &gt;2048:0 [SColStatistics] : total slices: 0, total rowgroups: 0, total rows: 0, match slices: 0, match rowgroups: 0, match rows: 0
 [SColStatistics] : total slices: 0, total rowgroups: 0, total rows: 0, match slices: 0, match rowgroups: 0, match rows: 0
 [SColStatistics] : total slices: 0, total rowgroups: 0, total rows: 0, match slices: 0, match rowgroups: 0, match rows: 0
 
       Predicate : access("E"."SAL" &lt; 100)                      




Statistics
----------------------------------------------------------------------------------------------------
          0 physical reads                                                  
          0 db block gets                                                   
          0 consistent gets                                                 
       1984 redo size                                                       
          4 recursive calls                                                 
          0 bytes sent via SQL*Net to client                                
          0 bytes received via SQL*Net from client                          
          0 SQL*Net roundtrips to/from client                               
          0 sorts (memory)                                                  
          0 sorts (disk)                                                    
          0 rows processed                                                  
          0 block received                                                  
      88213 bytes received via PX

39 rows fetched.

```

单机环境下：

设置并行度能输出px LocalInfo如下，没有节点信息：

```
PX LocalInfo: (RANDOM SENDER -&gt; RANDOM RECEIVER :DEGREE_1,PART_2)
              (DB) total time: 100ms, send_bytes: 0, send_packets: 0, send_acks: 0, wait_space_times: 0, wait_space_timeout: 0, recv_bytes: 0, recv_packets: 0, recv_acks: 0, wait_data_times: 0, wait_data_timeout: 0   

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

|测试类型|说明|预期|
|---|---|---|
|分布式1cn 3dn，简单sql，连接cn|在1cn 3dn测试场景下连接cn测试简单sql（能输出px信息的简单sql）|在px remote info下输出该4个节点的px信息|
|分布式1cn 3dn，简单sql，连接dn|在1cn 3dn测试场景下连接dn测试简单sql（能输出px信息的简单sql）|在px remote info下无px信息|
|分布式1cn 3dn，复杂sql，连接cn|在1cn 3dn测试场景下连接cn测试复杂sql（能输出多个px算子的信息的复杂sql）|在多个px remote info下输出该4个节点的px信息|
|分布式1cn 3dn，复杂sql，连接dn|在1cn 3dn测试场景下连接dn测试复杂sql（能输出多个px算子的信息的复杂sql）|在多个px remote info下无px信息|
|单机，简单sql|在单机测试场景下测试简单sql（能输出px信息的简单sql），设置并行度|在px local info下输出一条没有节点信息的px信息|
|单机，复杂sql|在单机测试场景下测试测试复杂sql（能输出多个px算子的信息的复杂sql），设置并行度|在多个px local info下输出一条没有节点信息的px信息|


##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

200行，3人/天

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

  
