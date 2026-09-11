Created by 陈步隆, last modified by  胡威振 on 十一月 04, 2024

##   [1. Overview（概述）](#1-overview概述)  

分布式目前只支持inline的LOB数据，数据大小限制在32000字节，场景非常受限，需要对此规格进行扩展。扩展后的LOB数据采取了outline方式，配套有一套完整的LOB API。分布式版本需要根据自身特点，进行适配。

参考信息：

-   [LOB协议](https://conf.yasdb.com/pages/viewpage.action?pageId=68294902)  
-   [LSC表Outline LOB存储方案](https://conf.yasdb.com/pages/viewpage.action?pageId=104203899)  
-   [单机列存CLOB类型支持](https://conf.yasdb.com/display/YASDOC/LOB)  


##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|分布式支持Outline LOB插入|分布式系统里插入大LOB数据||
|分布式支持Outline LOB查询|分布式系统里查询大LOB数据||
|分布式支持Outline LOB删除|分布式系统里删除大LOB相关数据||
|分布式支持Outline LOB更新|分布式系统更新大LOB数据||
|分布式支持完整LOB api操作|支持通过api方式操作大LOB数据||


##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 内部接口](#31-内部接口)  

```
CodResult anlDstbReadLobData(AnlStmt* stmt, VarLob* lob, CodUint32 offset, CodChar* buffer, CodUint32 size);

```

>   【注】暂时不考虑批量请求的场景。  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 规格](#41-规格)  

(1) Clob/lob大小规格

|大对象类型|最大|说明|
|---|---|---|
|clob|1~4G*DB_BLOCK_SIZE|主要关注100MB以下|
|blob|1~4G*DB_BLOCK_SIZE||


(2) clob/blob 支持建表，alter table 增加列

|功能|是否支持|说明|
|---|---|---|
|deafult值|Y||
|list分区|||
|range分区|||
|hash分区|||
|tablescape属性|||
|DISABLE STORAGE IN ROW|||
|ENABLE STORAGE IN ROW|||
|compression_clause|||
|table_sort_clause|||


(3) 插入/删除/更新

(4) clob

|函数|clob|Oracle输出类型|yashan|说明|
|---|---|---|---|---|
|concat|Y|clob|Y|字符串连接符支持，但是concat不支持|
|LPAD, RPAD|Y|clob|CNV|行存先转varchar，等同于只支持inline clob|
|TRIM, LTRIM, RTRIM|Y|clob|CNV|行存先转varchar，等同于只支持inline clob|
|REPLACE|Y|Clob|N|行存报错类型不支持|
|SUBSTR|Y|Clob|Y||
|ASCII|CNV|int32|N|行存报错类型不支持|
|LENGTHB|Y|int64|Y||
|REGEXP_LIKE|Y|bool|CNV|行存先转varchar，等同于只支持inline clob|
|REGEXP_REPLACE|Y|clob|CNV|行存先转varchar，等同于只支持inline clob|
|REGEXP_INSTR|Y|Int64|CNV|行存先转varchar，等同于只支持inline clob|
|REGEXP_SUBSTR|Y|clob|CNV|行存先转varchar，等同于只支持inline clob|
|TO_CHAR|Y|varchar|CNV|都是先转varchar后计算|
|TO_NUMBER|CNV|number|N|行存报错类型不支持|
|TO_DATE|CNV||CNV|行先转成varchar后计算|
|DECODE|CNV(19c不支持，21文档写支持)||N|行存报错类型不支持|
|NVL|Y|NA|Y||


备注： 由于当前行存代码大部分都是加了Varconvert的，部分函数的参数是不计划支持Clob的，但是由于没有拦截，可能实际支持了clob，所以开发时，需要挨个函数调研，避免行列不一致。或者列存执行对于没有在列表中的函数，把clob转成varchar处理，不支持clob的统一由行存来拦截。

(5) blob

|函数|blob|Oracle输出类型|yashan|说明|
|---|---|---|---|---|
|concat|Y|NA|Y|先转varchar后运算|
|LPAD, RPAD|Y|varchar|Y|先转varchar后运算|
|TRIM, LTRIM, RTRIM|Y|varchar||先转varchar后运算|
|REPLACE|Y|varchar|N|先转varchar后运算|
|SUBSTR|Y|varchar|Y|先转varchar后运算|
|ASCII|Y|int32|N|行存报错类型不支持|
|LENGTHB|int64|Y|||
|REGEXP_LIKE|Y|bool|Y|先转varchar|
|REGEXP_REPLACE|Y|varchar|先转varchar||
|REGEXP_INSTR|Y|Int64|Y||
|REGEXP_SUBSTR|Y|varchar|Y|先转varchar|
|TO_CHAR|Y|varchar|Y|先转varchar|
|TO_NUMBER|Y|number|N|行存报错类型不支持, oracle先转varchar后计算|
|TO_TIMESTAMP|N|NA|N|oracle 19c不支持，但是21文档写支持|
|TO_DATE|Y|date|Y|先转varchar后运算|
|DECODE|NA(19c不支持, 需要看21c是否支持)||N||
|NVL|Y|NA|Y||


Functions designated as CNV in the SQL or PL/SQL column in the table are performed by converting the CLOB to a character data type, such as VARCHAR2. In the SQL environment, only the first 4K bytes of the CLOB are converted and used in the operation. In the PL/SQL environment, only the first 32K bytes of the CLOB are converted and used in the operation.

(4) cast 对于Clob/Blob类型的支持

|原始类型|目标类型|Yashan|说明|
|---|---|---|---|
|clob|char/varchar|Y||
|char/varchar|clob|Y||
|blob|char/varchar|Y||
|char/varchar|blob|Y||
|blob|raw|Y||
|raw|blob|Y||
|raw|clob|Y|Oracle不支持|


(4) 绑定参数需要支持Clob/Blob

>   【注】同单机版本保持一致。  

###   [4.2 约束](#42-约束)  

- clob/blob不支持 min/max 聚合
- clob/blob不支持distinct


```
select distinct f_clob from test_lob

```

- clob/blob不支持作为group by key


```
select count(f_clob) from test_lob group by f_clob;

```

- clob/blob不支持作为order by key


```
select * from test_lob order  by f_clob;

```

- clob/blob不支持作为join key


```
select * from test_lob, test_lob_join where test_lob.f_clob = test_lob_join.f_clob;

```

- clob/blob不支持集合操作UNION, INTERSECT, MINUS


```
select * from test_lob union  select * from test_lob_join;

```

- 不支持= , !=, >, >=, <, <=, <>, ^=， int/not int/any/all/some/BETWEEN/GREATEST/LEAST


>   【注】同单机版本保持一致。  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/supported-functions-and-operators.html#GUID-10C6706D-CE73-4E21-A2B1-55F11A27A6EF](https://docs.oracle.com/en/database/oracle/oracle-database/21/adlob/supported-functions-and-operators.html#GUID-10C6706D-CE73-4E21-A2B1-55F11A27A6EF)  

###   [4.3 其他](#43-其他)  

1. 暂不考虑Memory LOB类型外发支持


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/6739693ca1ad9a3311dc752b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFFQUFBQWdBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFnQ0VBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzAsImV4cCI6MTc4MjEzNjk3MH0.xs8N6fOaAQIvG0rUQg9xrXWT31c-TfUz1aWcM6sf_xM)

使用LOB协议场景

|客户端|服务端|通讯通道|使用场景|协议说明|
|---|---|---|---|---|
|Client|CN|客户端链路|客户端驱动进行SQL操作|原始LOB协议|
|CN|DN|ICS链路，数据通道|由client驱动向数据节点传输数据|分布式LOB协议|
|DN|DN|ICS链路，数据通道|SQL执行期间按需跟目标节点传输数据|分布式LOB协议|


>   【注】分布式LOB协议是指在分布式下，需要给原始的LOB协议消息上增加分布式的头，本质上还是LOB协议。  

####   [5.1.1 分布式LOB协议](#511-分布式lob协议)  

目前单机下使用的LOB协议只涉及客户端与服务端间，在唯一链路上的通讯。而在分布式下，节点与节点之间是通过ICS通讯框架通讯。ICS下链路是共享的，LOB请求响应完全会通过不同链路进行收发。针对分布式场景下的特殊性，分布式下需要对LOB协议做一些适配工作。

![](https://pingcode.yasdb.com/atlas/files/public/6739693ca1ad9a3311dc752c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFFQUFBQWdBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFnQ0VBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzAsImV4cCI6MTc4MjEzNjk3MH0.xs8N6fOaAQIvG0rUQg9xrXWT31c-TfUz1aWcM6sf_xM)

#####   [5.1.1.1 分布式下适配](#5111-分布式下适配)  

1. 统一使用数据链路来收发
1. 数据包在原始的LOB协议消息包基础上，增加ICS层的消息头以及分布式LOB头
1. LOB相关流程，不区分行存列存，统一一套接口
1. LOB请求是Stmt级别的，不同Stmt间可以并发请求和接收响应
1. LOB处理是Session级别的，不同节点或Stmt的LOB请求，统一进入到消息队列中排队
1. 根据LOB类型判断是否需要请求CHUNK_SIZE


#####   [5.1.1.2 分布式涉及的场景](#5112-分布式涉及的场景)  

1. DML参数绑定
1. 查询


#####   [5.1.1.3 CN支持客户端LOB命令](#5113-cn支持客户端lob命令)  

所有客户端LOB命令，在CN上都需要判断一下LOB对象是否在本地，如果在本地则直接操作返回，否则需要将命令转发到对应DN节点上，再将DN回应返回到客户端

#####   [5.1.1.4 分布式LOB命令支持](#5114-分布式lob命令支持)  

|LOB命令|分布式是否需要实现|备注|
|---|---|---|
|LOB_GET_LEN|不需要|VarLob里已经包含了LobSize，节点间不需要专门获取|
|LOB_READ|需要||
|LOB_TRIM|需要||
|LOB_WRITE|需要|LOB协议增强，扩展了write协议，版本2需要支持非Temp类型Lob的写入|
|LOG_TMP_CREATE|不需要|经过insert方案明确，绑定参数操作都转换为到CN的LOG_TMP_CREATE/LOB_WRITE和其他节点到CN的LOB_READ|
|LOB_TMP_FREE|不需要|原来客户端协议未使用|
|LOB_OPEN|不需要|原来客户端协议未使用|
|LOB_CLOSE|需要||
|LOB_ISOPEN|不需要|原来客户端协议未使用|
|LOB_GET_CHUNK_SIZE|需要||


######   [LOB_READ](#lob-read)  

相对客户端LOB_READ，分布式下LOB_READ需要考虑以下几点

1. 内存管理，分布式下LOB传输数据不限制于64K，分布式下需要自己管理内存
    1. 请求端，由内部调用者提供接收内存
    1. 回应端，发送buffer较小（可能64K），需要分段请求、分包发送
1. 分批请求
    1. 请求数据超过了4M（64*64k），需要分批请求
    1. 请求端指定数据块大小（较小的数据块范围内，例如64K内），服务端无法满足则报错（同单机处理）
    1. 接收完一批数据再接收下一批
    1. 接收完调用者指定大小数据后，才返回
1. 批次内数据分包发送（不要求网络保序）
    1. 需要记录哪些数据块已经收到（bitmap）
    1. 数据回应包中需要包含数据块大小（所有回应必须一致，除非是最后一个）
    1. 超时没有收到的数据块，需要重新请求


######   [LOB_TRIM](#lob-trim)  

同单机LOB协议中服务端处理

######   [LOB_WRITE](#lob-write)  

分布式LOB_WRITE需要处理

1. 内存管理，客户端写入64K的数据，服务端接收消息直接使用ctrl msg内存接收（支持自动扩展内存）
    1. CN请求端，构造请求消息时，直接将ics msg的iov地址指向cs packet
    1. 需要根据ics msg里iov的分布，高效读取buf内容
1. 从场景看，LOB_WRITE每个handler只会有一个，不会存在占用过多内存问题


######   [LOB_CLOSE](#lob-close)  

同单机LOB协议中服务端处理

######   [LOB_GET_CHUNK_SIZE](#lob-get-chunk-size)  

根据LOB类型判断是否需要请求CHUNK_SIZE，为后续云存储做准备

#####   [5.1.1.5 分布式LOB消息格式](#5115-分布式lob消息格式)  

######   [ICS消息头中SmartId信息](#ics消息头中smartid信息)  

|字段|类型|含义|
|---|---|---|
|sid|CodUint32|全局Session ID|
|stmtId|CodUint16|Stmt ID|
|unused|CodUint16|预留|
|serial|CodUint32|Handler序列号|
|sequenceId|CodUint16|Session执行序列号|
|msgId|CodUint16|消息Id|


######   [分布式LOB头](#分布式lob头)  

|字段|类型|含义|
|---|---|---|
|blockSize|CodUint32|每次发包大小（请求总大小在LOB请求内）|
|curPackage|CodUint16|当前分包序号|
|unused|CodUint16|预留|


>   【注】由于VarLob里包含了lob size，消息里不需要带is end信息  

#####   [5.1.1.6 分布式客户端缓存](#5116-分布式客户端缓存)  

```
typedef struct StAnlDstbLobContext {
    VarLob*         lob;
    CodUint32       batchIdx;  // 超过4M数据，分批接收
    CodUint64       bitmap;    // 记录已经接收到分包数据的哪些块
    // buffer发送或接收的buf
    // 如果是发送读请求，这里是调用者传入的buffer，收到数据后直接写入
    // 如果是处理读请求，这里是从memctx申请的buffer（建议64k），读入lob并发送的buffer
    // 如果是发送写请求，这里是调用者传入的lob数据，组包后直接发送
    // 如果是处理写请求，这里是接收到的lob数据，按请求写入lob对象中
    CodUint8*       buffer;
    CodUint32       bufferSize;
} AnlDstbLobContext;

typedef struct StAnlStmt {
    // ...
    AnlDstbLobContext   dstbLobCtx; 
    // ...
} AnlStmt;

```

#####   [5.1.1.7 分布式服务端内存管理](#5117-分布式服务端内存管理)  

服务端从handler->stack申请一定大小内存（客户端读请求中指定，64K）。在请求指定范围内，按每个包最大64K进行发送。

####   [5.1.2 LOB生命周期管理](#512-lob生命周期管理)  

Outline LOB的生命周期比较特殊，后面有不少设计也是根据这点需要进行适配。

#####   [5.1.2.1 背景](#5121-背景)  

- 一般的数据在当次执行结束后，数据完整返回给客户端，内部产生的临时资源就可以全部释放掉了，不需要考虑生命周期问题。
- Outline LOB服务端将LOB Locator返回给客户端后，客户端可以在执行完当前SQL后，继续使用LOB协议访问LOB数据。只有客户端明确调用了Close接口，或者会话结束，临时产生的LOB才能被销毁。


>   【注】这里说的LOB主要是指存放在VM的Temp LOB或者直接放在内存里的Memory LOB。  

#####   [5.1.2.2 单机实现](#5122-单机实现)  

1. 计算过程中的Temp LOB，保留在stmt对应的vm列表中
1. 数据发往客户端时，将对应Temp LOB从stmt的vm列表移到handler的vm列表上，并记录到lob列表上
1. 客户端主动Close时，释放对应Temp LOB
1. session释放时，释放相关所有Temp LOB资源


```
typedef struct StAnlStmt {
    // ...
    VmCacheList       tempLobList;  // 计算过程产生的temp lob
    // ...
} AnlStmt;

typedef struct StLobCacheCtx {
    VmCacheList cacheVmList;   // temp lob数据
    AnlAppHeap  appHeap;
    CodUint32*  hashBuckets;
    List*       cachedLobs;    // 按temp id进行管理
} LobCacheCtx;

typedef struct StAnlHandler {
    // ...
    LobCacheCtx   lobCacheCtx;
    // ...
} AnlHandler;

```

#####   [5.1.2.3 分布式下面临的困难](#5123-分布式下面临的困难)  

1. Temp类型Lob释放过晚，需要在handler释放时进行释放（单机也有类似问题）
1. 分布式存在广播数据场景，Temp Lob Locator广播扩散后，无法通过单一生命周期进行管理
1. 需要跨节点完成Temp Lob生命周期管理


#####   [5.1.2.4 分布式下解决思路](#5124-分布式下解决思路)  

1. 单次执行完，没有对外提供的Lob，批量进行清理
    1. CN提供出去的Temp Lob Locator，按节点生成一个列表（列表超大场景：内存从memctx出，申请不到就报错）
        1. 对Temp LOB类型，只记录temp lob id，u32
        1. 对Memory LOB类型，要打开最小信息的大小
    1. CN将对应节点需要保留的Locator列表，发送到对应节点上，进行批量关闭
    1. 对应节点将不在列表上的Locator进行释放
    1. 分布式自己增加一个命令来处理
1. 用户主动关闭的Lob，在对应节点上同步关闭
1. handler释放时，清理所有Lob资源


######   [分布式协议调整](#分布式协议调整)  

1. 增加批量清理的请求


#####   [5.1.2.5 相关优化项](#5125-相关优化项)  

1. 计划上需要给出哪些Temp Lob列是发往客户端的，哪些是内部使用的，方便计算层及时释放Temp Lob


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 分布式LOB处理流程](#521-分布式lob处理流程)  

![](https://pingcode.yasdb.com/atlas/files/public/6739693ca1ad9a3311dc752d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUVBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFFQUFBQWdBQUFBQUlBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFnQ0VBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYxNzAsImV4cCI6MTc4MjEzNjk3MH0.xs8N6fOaAQIvG0rUQg9xrXWT31c-TfUz1aWcM6sf_xM)

#####   [5.2.1.1 DML绑定参数执行](#5211-dml绑定参数执行)  

参数绑定相关语句：

1. insert
1. update
1. delete
1. select


######   [单机insert流程](#单机insert流程)  

1.   `client`    : 向服务端请求生成Temp LOB
1.   `server`    : 生成Temp LOB，并返回LOB Locator信息
1.   `client`    : 将LOB数据，通过LOB协议传到服务端
1.   `server`    : 将LOB数据写入Temp LOB
1.   `client`    : 将LOB Locator进行参数绑定，并向服务端发送执行DML请求
1.   `server`    : 执行DML
1.   `client`    : 主动Close服务端Temp LOB
1.   `server`    : 释放Temp LOB资源


######   [分布式insert流程，方案二](#分布式insert流程方案二)  

1.   `client`    : 向服务端请求生成Temp LOB
1.   `cn`    : 生成Temp LOB，并返回LOB Locator信息
1.   `client`    : 将LOB数据，通过LOB协议传到服务端
1.   `cn`    : 将LOB数据写入Temp LOB
1.   `client`    : 将LOB Locator进行参数绑定，并向服务端发送执行DML请求
1.   `cn`    : 执行DML
    1.   `cn`    : 按原流程向dn发送执行DML请求
    1.   `dn`    :   **执行DML操作，解析发现有LOB Locator**
    1.   `dn`    : 向cn请求LOB数据
    1.   `cn`    : 发送LOB数据
    1.   `dn`    : 将LOB数据写入存储
1.   `client`    : 主动Close服务端Temp LOB
1.   `cn`    : 释放Temp LOB资源


>   【注】方案一及方案选项对比见5.5.2章节。另外，选定方案二后，分布式协议只需实现读协议即可。  

#####   [5.2.1.2 查询返回结果](#5212-查询返回结果)  

######   [单机查询流程](#单机查询流程)  

1.   `client`    : 发送查询请求
1.   `server`    : 执行查询
    1.   `server`    : 内部计算产生部分Temp LOB
1.   `server`    : 将涉及的Temp LOB或存储LOB的LOB Locator信息返回
1.   `client`    : 通过LOB Locator向服务端要数据
1.   `server`    : 向客户端返回数据
1.   `client`    : 主动Close服务端指定Temp LOB
1.   `server`    : 释放指定Temp LOB资源
1.   `server`    : session结束，handler销毁，释放所有Temp LOB资源


######   [分布式查询流程](#分布式查询流程)  

1.   `client`    : 发送查询请求
1.   `cn`    : 执行查询
    1.   `cn`    : 生成分布式查询计划，并分发到各DN节点
    1.   `dn`    : 查询过程中生成了部分Temp LOB，并根据需要发送对应的LOB Locator
    1.   `dn`    : 需要访问LOB的地方，通过LOB Locator向对应节点请求LOB数据
    1.   `dn`    : 最终结果返回到cn
1.   `cn`    : 将涉及的Temp LOB或存储LOB的LOB Locator信息返回
1.   `client`    : 通过LOB Locator向服务端要数据
1.   `cn`    : 响应客户端请求
    1.   `cn`    : 根据LOB Locator中节点信息，向对应节点请求LOB数据
    1.   `dn`    : 根据LOB请求，返回LOB数据
    1.   `cn`    : 向客户端返回数据
1.   `client`    : 主动Close服务端指定Temp LOB
1.   `cn`    : 响应客户端请求
    1.   `cn`    : 根据LOB Locator中节点信息，向对应节点请求关闭Temp LOB
    1.   `dn`    : 释放指定Temp LOB资源
    1.   `cn`    : 回应客户端执行结果
1.   `cn`    : session结束
    1.   `cn`    : 通知所有dn节点session结束
    1.   `dn`    : handler销毁，释放所有Temp LOB资源
    1.   `cn`    : handler销毁，释放所有Temp LOB资源


###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

####   [5.3.1 客户端LOB协议](#531-客户端lob协议)  

分布式下客户端LOB协议保持兼容，版本兼容策略与现有客户端协议保持一致。

####   [5.3.2 分布式LOB协议](#532-分布式lob协议)  

分布式LOB协议整体按ICS协议兼容方案进行兼容。在集群所有节点都升级完后，再统一切换到新版本协议。

>   【注】参考    [分布式网络兼容设计](https://conf.yasdb.com/pages/viewpage.action?pageId=95111536)    

###   [5.4 DFX设计](#54-dfx设计)  

####   [5.4.1 分布式网络容错](#541-分布式网络容错)  

#####   [5.4.1.1 请求发送重试机制](#5411-请求发送重试机制)  

1. LOB请求发送时，三秒内没有收到回应，将重新发送
1. 服务端收到已经处理过的消息后，跳过重复消息
1. 超时5次？后，请求失败，整个执行失败中断


#####   [5.4.1.2 请求过程中节点异常](#5412-请求过程中节点异常)  

1. 按分布式异常处理流程处理
    1. DN发现CN异常，清理session
    1. CN发现DN异常，打断操作，通知其他节点
    1. DN发现DN异常，等待CN通知（这个场景里DN与DN直接可能没有px通讯，与一般查询不同）


###   [5.5 其他](#55-其他)  

####   [5.5.1 SR拆解](#551-sr拆解)  

|单号|SR|开发工作量评估|备注|
|---|---|---|---|
|YDBRD-13381|分布式列表支持大LOB写入，查询|1100行，9人周|包含分布式内LOB接口封装|
|YDBRD-13383|分布式支持Outline LOB删除|200行，1人周||
|YDBRD-13382|分布式支持完整LOB api操作|300行，2人周||


#####   [5.5.1.1 分布式列表支持大LOB写入，查询工作量拆解](#5511-分布式列表支持大lob写入查询工作量拆解)  

1. YDBRD-14317 会话改造及网络容错实现 300行 6人周
1. YDBRD-14318 实现分布式LOB读  400行 2人周
    1. 分布式LOB协议框架改造
    1. 分布式LOB读协议实现
1. YDBRD-14319 插入流程实现 200行 1人周
    1. 封装、旁路远程LOB的读取等接口
1. 大LOB生命周期管理（取消）  200行 1人周
    1. CN维护外发LOB队列
    1. CN通知DN关闭不需要保留的Temp LOB
1. YDBRD-14320 查询流程实现 200行 1人周


#####   [5.5.1.2 分布式列表支持LOB更新删除工作量拆解](#5512-分布式列表支持lob更新删除工作量拆解)  

1. YDBRD-14322 delete流程实现 100行 0.5人周
1. YDBRD-14321 update流程实现 100行 0.5人周


#####   [5.5.1.3 分布式支持完整LOB api操作工作量拆解](#5513-分布式支持完整lob-api操作工作量拆解)  

1. YDBRD-14323 LOB write/trim实现 300行 2人周


####   [5.5.2 分布式insert方案选型（已选方案二）](#552-分布式insert方案选型已选方案二)  

#####   [分布式insert流程，方案一](#分布式insert流程方案一)  

1.   `client`    : 向服务端请求生成Temp LOB
1.   `cn`    : 生成Temp LOB，并返回LOB Locator信息
1.   `client`    : 将LOB数据，通过LOB协议传到服务端
1.   `cn`    : 将LOB数据写入Temp LOB
1.   `client`    : 将LOB Locator进行参数绑定，并向服务端发送执行DML请求
1.   `cn`    : 执行DML
    1.   `cn`    :   **根据行记录中分布键信息，推算出记录落在的dn节点**
    1.   `cn`    : 对outline类型LOB，向对应dn请求生成Temp LOB
    1.   `dn`    : 生成Temp LOB，并返回LOB Locator信息
    1.   `cn`    : 将LOB数据，通过LOB协议传到dn
    1.   `dn`    : 将LOB数据写入Temp LOB
    1.   `cn`    :   **改写参数绑定信息，并向dn发送执行DML请求**
    1.   `dn`    : 执行DML
1.   `client`    : 主动Close服务端Temp LOB
1.   `cn`    : 释放Temp LOB资源


#####   [分布式insert流程对比](#分布式insert流程对比)  

|对比项|方案一|方案二|备注|
|---|---|---|---|
|角色变化|面对客户端时，CN是服务端；面对DN时，CN是客户端|CN始终是服务端||
|主要差异点|CN上需要明确知道各种类型数据的去向，提前在目标节点创建Temp LOB|CN只做绑定参数的转发，由目标节点主动向CN获取数据||
|资源占用|CN、DN上都需要创建Temp LOB|只有CN需要有Temp LOB，DN直接从网络获取||
|LOB生命周期|DN上执行完自动关闭，CN上Temp LOB由客户端关闭|CN上Temp LOB由客户端关闭||
|实现难点|CN需要打开绑定参数，判断是否处理大LOB；需要关心表是否复制表等|现有的会话管理都是CN作为客户端，这里CN需要作为服务端，对现有流程有一定冲击||
|对特殊SQL场景处理|必须在CN测能推断数据的目标节点（现有insert多条记录实现需要调整）|无要求||


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

不涉及

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[lob_frame.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5M2M4OTcwYzJhZjRmNTFmNmIzIiwicmVmX2lkIjoiNjczOTY5M2M1OTNmOTljOWZmMjM0YzBmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MTcwLCJleHAiOjE3ODIyMTI1NzB9.bBWev7brBYQZ_5YNFqZRjRnt5cOwYKztdDB9tWjkBlM)

 (image/png)    


## Comments:

|  [](null)  ,3月10号讨论纪要    
  1.   fetch lob数据时，可以不进行缓存    
  2.   服务端内部可以直接使用CHUNK大小    
  3.   计划上需要给出哪些Temp Lob列是发往客户端的，哪些是内部使用的    
  4.   考虑在handler上增加一个列表记录stmt结束后，    
  5.   Stage内部的临时Temp Lob可以立即回收    
  6.   考虑MemoryLob时，CN缓存列表中包含哪些信息    
  7.   内部Api使用VarLob，收发时再转换CsLobLocator    
  8.   没有批量获取Lob的场景，暂不考虑,Posted by chenbulong at 三月 14, 2023 14:54|
|---|
|  [](null)  ,3月15号讨论纪要,  [李伟超](https://conf.yasdb.com/display/~liweichao)      [吕雷奇](https://conf.yasdb.com/display/~lvleiqi)      [张鹏飞](https://conf.yasdb.com/display/~zhangpengfei)      [谢锐](https://conf.yasdb.com/display/~xierui)      [黄靖东](https://conf.yasdb.com/display/~huangjingdong)      [罗继鸿](https://conf.yasdb.com/display/~luojihong)  ,1. 本地封装lob size接口    
  2. context里buffer用u8类型    
  3. 单机场景可以对个别insert场景进行优化    
  4. 分布式update，也是通过参数绑定执行    
  5. 不需要向计算层提供远程LOB关闭接口    
  6. 跟优化器对一下哪些场景可以提前关闭本地Temp LOB    
  7. 根据LOB类型判断是否需要请求CHUNK_SIZE    
  8. 响应读请求时，回应消息需要拆包    
  9. 分布式下open lob优化    
  10. DstbLobContext，拆包相关信息    
  11. CN提供出去的列表从mctx申请内存，如果太多申请不出内存就报错    
  12. DML绑定参数使用方案二,Posted by chenbulong at 三月 15, 2023 12:29|
