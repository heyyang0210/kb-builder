Created by 陈俊杰, last modified on 十月 18, 2024

**详细设计-YDBRD-29721 ICS网络性能统计信息补充**

* IR链接：*  *YDBRD-XXXX*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6611a8c1579a3edb84d86111](https://pingcode.yasdb.com/pjm/items/6611a8c1579a3edb84d86111)  

  [tcp(7) - Linux manual page (man7.org)](https://man7.org/linux/man-pages/man7/tcp.7.html)  

##   [1. 总述](#1-总述)  

补充ICS网络性能统计信息，增强分布式对网络性能相关问题的定位能力。

###   [1.1 需求来源](#11-需求来源)  

深智城项目现场遇到问题时，ICS统计信息缺少网络性能相关项，导致定位能力不足。

经初步讨论，现场需要关注  **TCP收发缓冲区使用情况**  、  **ICS链路响应速度**  、  **ICS节点级和链路级的吞吐统计**  以及  **收发超时累计次数**  。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|链路级收发缓冲区使用情况展示|视图查询时通过操作系统接口获取|是|是|
|功能|链路级响应速度展示|视图查询前通过高级包主动触发探测|是|是|
|功能|节点级、链路级吞吐量展示|链路级记录、节点级汇总，显示到视图|是|是|
|功能|全局和节点级收发超时累计次数展示|接收超时、发送超时按照控制通道、数据通道分别统计|是|是|
|性能|响应速度探测机制|通过高级包主动触发探测而非定时探测，不引入不必要的性能消耗|是|是|
|可靠性|节点异常或网络故障|主动探测响应速度时容忍节点或网络故障，显示非法值|是|是|
|可维可测|DIN相关视图查询|新增字段|是|是|
|兼容性|兼容不同操作系统和网络层协议|windows上不支持查询SEND/RECV_QUEUE_SIZE，方案对ipv4和ipv6协议兼容|是|是|


##   [2. 接口](#2-接口)  

###   [2.1 新增视图字段](#21-新增视图字段)  

**DV$DIN_LINK**

|字段|类型|说明|备注|适用场景|边界值|
|---|---|---|---|---|---|
|SEND_QUEUE_SIZE|INTEGER|tcp发送缓冲区使用大小|单位: 字节|1、网络拥塞或丢包导致发送方不停重发；	2、发送速率过快或接收方处理速度太慢；|-1: 获取失败； 其他: 有效值|
|RECV_QUEUE_SIZE|INTEGER|tcp接收缓冲区使用大小|单位: 字节|同上|-1: 获取失败； 其他: 有效值|
|RESPONSE_TIME|NUMBER|链路响应速度：发送探测到收到ack的往返时间(RTT)，不带业务处理|单位: ms|1、关注链路实时性能； 2、网络延迟、丢包、节点异常时会显示异常值|-1: 网络故障或节点故障或超时； NULL: 未主动探测或链路是接收链路； 其他: 有效值|
|THROUGHPUT|BIGINT|链路吞吐量|单位: 字节每分钟，5秒刷新一次|1、关注链路繁忙程度|无异常值|


**DV$DIN_NODE**

|字段|类型|说明|备注|关注场景|边界值|
|---|---|---|---|---|---|
|THROUGHPUT|BIGINT|节点吞吐量|单位: 字节每分钟，刷新粒度: 秒|1、关注节点级网络繁忙程度|无异常值|
|CONTROL_SEND_TIMEOUT_COUNT|BIGINT|与对端节点控制通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|CONTROL_RECV_TIMEOUT_COUNT|BIGINT|与对端节点控制通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|
|DATA_SEND_TIMEOUT_COUNT|BIGINT|与对端节点数据通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|DATA_RECV_TIMEOUT_COUNT|BIGINT|与对端节点数据通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|


**DV$DIN_STAT**

|字段|类型|说明|备注|关注场景|边界值|
|---|---|---|---|---|---|
|CONTROL_SEND_TIMEOUT_COUNT|BIGINT|与所有节点控制通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|CONTROL_RECV_TIMEOUT_COUNT|BIGINT|与所有节点控制通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|
|DATA_SEND_TIMEOUT_COUNT|BIGINT|与所有节点数据通道发送超时累计次数|超过1秒即超时|1、通常是网络拥塞导致消息发送超时|无异常值|
|DATA_RECV_TIMEOUT_COUNT|BIGINT|与所有节点数据通道接收超时累计次数|超过1秒即超时|1、通常是业务处理超时|无异常值|


*1. 需要区分缓冲区使用大小需要与缓冲区大小，前者是使用情况，后者是配置值，cod默认2M*

*2. V$和X$有类似的字段调整，不逐一罗列*

###   [2.2 新增高级包](#22-新增高级包)  

**DBMS_DIN**

```
DBMS_DIN.TRACE_TRIGGER(
    node_id      IN    INTEGER    DEFAULT -1,                // 指定探测节点ID
    link_level   IN    SMALLINT    DEFAULT -1,               // 指定链路level
    link_id      IN    SMALLINT    DEFAULT -1,               // 指定链路ID
    packet_size  IN    INTEGER    DEFAULT 28,                // 探测携带的额外数据包大小，单位：字节
);

示例：
SQL&gt; EXEC DBMS_DIN.TRACE_TRIGGER(
   2 NODE_ID=&gt;1,
   3 PACKET_SIZE=&gt;10);

PL/SQL Succeed.


```

1. 四个入参均为可选项，前三个参数用于选择是否指定探测的节点或链路，后一个参数用于指定数据包长度（包括包头的28字节）；
1. 若指定node_id而不指定link_level和link_id，则会向指定节点的所有有效链路发送探测包；
1. 指定探测链路时，需要同时设置node_id、link_level与link_id；
1. 若指定的探测节点或链路本身不可用或不活跃，则既不会发送探测也不会报错；
1. packet_size最大不超过32768字节（32K）；
1. 不设置packet_size时，每次探测只发送28字节（消息包头固定大小）；


##   [3. 规格与约束](#3-规格与约束)  

|类型|内容|原因|备注|
|---|---|---|---|
|约束|只支持分布式查询||若集群、YCS有类似的需求，需要进行适配|
|规格|只支持TCP链路|ICS只支持TCP协议，规格延续||
|规格|响应速度探测只针对发送链路|收发分离后接收链路本身不发送，不存在响应速度这一概念||


##   [4. 特性](#4-特性)  

###   [4.1 方案讨论](#41-方案讨论)  

####   [4.1.1 链路级收发缓冲区使用情况](#411-链路级收发缓冲区使用情况)  

|方案|优点|缺点|备注|
|---|---|---|---|
|操作系统API查询|实现简单|API需要考虑操作系统和网络协议兼容性|  [linux manual page](https://man7.org/linux/man-pages/man7/tcp.7.html)  |


####   [4.1.2 链路级响应速度探测](#412-链路级响应速度探测)  

|方案|优点|缺点|备注|
|---|---|---|---|
|定期触发|不用手动触发|有性能损耗、节点数较大时可能引起网络风暴||
|隐藏参数触发|无额外性能损耗|通过设置参数来触发内部的探测可能关联比较隐晦||
|高级包触发|无额外性能损耗且关联更直观|没有恰当的高级包|需要熟悉相关框架，工作更耗时|


*结论：通过新增高级包触发*

####   [4.1.3 节点级、链路级吞吐量统计](#413-节点级链路级吞吐量统计)  

|方案|优点|缺点|备注|
|---|---|---|---|
|以分钟为粒度刷新|代码实现简单|会有明显跳变，不精确||
|以秒为粒度刷新|代码稍复杂些|更精确|工作量稍大|
|同时统计最大吞吐|能够关注到历史峰值|1、有性能消耗，且若要统计节点级最大吞吐，那么每次链路发生吞吐都要向上刷新； 2、视图框架未来可能会实现峰值统计|若要统计最大值，是否只统计到链路级|


*结论：以秒为粒度刷新，且不统计吞吐的历史峰值；具体实现时考虑到内存占用，刷新粒度为5秒*

###   [4.2 关键流程](#42-关键流程)  

####   [4.2.1 tcp收发缓冲区](#421-tcp收发缓冲区)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d63a1ad9a3311dc90e2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FCQUFBQUFBQUFBQWdBQUFBQUlBQUFBQkFBQUFBQUFBQUFBSVFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4NzAsImV4cCI6MTc4MjMxODY3MH0.aBNd8p2lNZzlBvjtcTAQDj5LwzRnB-fS7_2VuqPBD6I)

1. tcp链路是全双工的，链路的两端都有发送和接收缓冲区
1. ICS实现了收发分离以提升性能，因此理论上而言，发送链路只会使用发送缓冲区，接收链路只会使用接收缓冲区
1. cod打开socket时默认收发缓冲区大小(TCP_DEFAULT_BUFFER_SIZE)为2M，且不是可调整参数，需要体现到视图文档


####   [4.2.2 链路响应速度探测机制](#422-链路响应速度探测机制)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d638970c2af4f521271/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FCQUFBQUFBQUFBQWdBQUFBQUlBQUFBQkFBQUFBQUFBQUFBSVFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc4NzAsImV4cCI6MTc4MjMxODY3MH0.aBNd8p2lNZzlBvjtcTAQDj5LwzRnB-fS7_2VuqPBD6I)

1. 发送探测到收到ack的往返时间(RTT)，不带业务处理
1. 发送ICS_CMD_TRACE时指定linkId通过指定链路发送，发送ICS_CMD_TRACE_ACK时统一由心跳链路(INNER)发送
1. 接收链路不负责发送，不需要探测，视图显示NULL
1. 若hbTraceTime == hbResponseTime == 0，说明未触发心跳探测，视图字段显示NULL
1. 若hbTraceTime为有效值，hbResponseTime == INVALID，说明未收到ack，视图字段显示-1，表示超时或异常
1. 若hbTraceTime和hbResponseTime均为有效值，说明收到ack，其差值为链路响应时间，视图字段显示正常值，单位ms


####   [4.2.3 链路级吞吐量统计](#423-链路级吞吐量统计)  

*绘图较困难，将在“4.3 代码落实”里用函数接口体现相关流程设计*

###   [4.3 代码落实](#43-代码落实)  

*设计阶段伪代码只描述大致流程，可能存在需要封装和抽象的代码，具体实现后再补充*

####   [4.3.1 数据结构](#431-数据结构)  

**1. 与视图字段对应的数据结构字段调整**

```
typedef struct StIcsLinkStat {
    IcsAddress   addr;
    CodUint16    peerId;
    IcsAddress   peerAddr;
    CodUint16    linkLevel;
    CodUint16    linkId;
    CodUint32    connVersion;
    CodUint16    peerNodeVersion;
    CodUint8     localConnVersion;
    CodUint8     peerConnVersion;
    CodDate      linkCreateTime;
    IcsLinkState linkState;
    CodUint64    sendPackets;
    CodUint64    recvPackets;
    CodUint64    sendBytes;
    CodUint64    recvBytes;

    CodInt32     tcpOutQueueSize;   // 新增，表示tcp发送缓冲区使用大小
    CodInt32     tcpInQueueSize;    // 新增，表示tcp接收缓冲区使用大小
    CodUint64    hbTraceTime;       // 新增，表示主动发送心跳探测的开始时间
    CodUint64    hbResponseTime;    // 新增，表示主动发送心跳探测收到ack的时间
    CodUint64    throughput;        // 新增，表示链路每分钟吞吐量

    CodDate      lastSendTime;
    CodDate      lastRecvTime;
} IcsLinkStat;

// IcsLinkPool、IcsNodeStat、IcsLink等结构体有类似新增字段，不逐一罗列

```

**2. 新增ICS_INNER_CMD类型、IcsTraceData结构体和IcsTraceParam结构体以实现链路级主动探测机制**

```
typedef enum EnIcsInnerCommand {
    ICS_CMD_INVALID = 0,
    ICS_CMD_HEARTBEAT = 1,
    ICS_CMD_HEARTBEAT_ACK = 2,
    ICS_CMD_TRACE = 3,              // 新增，主动探测时携带
    ICS_CMD_TRACE_ACK = 4,          // 新增，回复探测时携带
    __ICS_CMD_RESERVED_COUNT__ = 32,
} IcsInnerCommand;

typedef union UnIcsTraceData {
    CodUint8 smartData[ICS_MSG_SMART_DATA_SIZE];
    struct {
        IcsLinkId linkId;           // 新增，目前只携带链路ID
        CodUint8 traceId;           // trace的消息序列号，避免触发多次时ack互相影响
        CodUint8 unused[7];         // 预留
    };
} IcsTraceData;                     // 新增，主动探测时填写traceData到ICS消息包头的预留字段

typedef struct StIcsTraceParam {
    IcsLinkId linkId;               // trace的LinkId
    CodUint32 packetSize;           // trace的数据包大小，28到32768字节
    CodUint8  unused[4];
    CodPointer buf;                 // 申请的数据包内存指针
    CodPointer caller;              // 触发trace的调用者
    IcsTraceInterrupt interrupt;    // 回调接口，用于判断是否打断trace
} IcsTraceParam;

```

**3. 新增数据结构用于以秒为槽位记录链路最近一分钟内吞吐量**

```
// 对IcsThroughput结构体实现calcSum, increase, append，update等访存操作，将在"4.4 关键函数"一节说明
typedef struct StIcsThroughput {
    CodUint32 timeInSec;            // 上一次刷新时间（秒）
    CodUint32 tempSlot;             // 吞吐量刷新的buffer，避免明显跳变
    CodUint32 slot[SLOT_NUM];
} IcsThroughput;

```

####   [4.3.2 关键函数](#432-关键函数)  

**1. 获取收发缓冲区使用大小**

```
#ifdef _WIN32
#define GET_TCP_SEND_QUEUE_SIZE(socket, ret) IOCTL_ERROR   // UNSUPPORTED IN WINDOWS
#define GET_TCP_RECV_QUEUE_SIZE(socket, ret) IOCTL_ERROR   // UNSUPPORTED IN WINDOWS
#else
#define GET_TCP_SEND_QUEUE_SIZE(socket, ret) ioctl(socket, SIOCOUTQ, ret)
#define GET_TCP_RECV_QUEUE_SIZE(socket, ret) ioctl(socket, SIOCINQ, ret)
#endif

CodResult icsGetTcpQueueSize(CsLink* link, CodInt32* queueSize, CodBool isSend)
{
// 接口说明：ICS提供的外部查询指定link的收发缓冲区使用情况的接口
    if isSend {
        // isSend说明查询的是发送缓冲区使用大小
        ret = GET_TCP_OUT_QUEUE_SIZE(link-&gt;tcp.fd, queueSize);
        if ret == -1 {
            return error;
        }
    } else {
        // 反之，查询接收缓冲区使用大小
        ret = GET_TCP_IN_QUEUE_SIZE(link-&gt;tcp.fd, queueSize);
        if ret == -1 {
            return error;
        }
    }
    return success;
}

```

**2. 主动探测链路级响应速度**

```
/* 外部触发trace的接口，需要传入IcsTraceParam */
CodResult icsTraceTrigger(IcsManager* mgr, IcsTraceParam* param)
{
    COD_CHECK_POINTER3(mgr, param, param-&gt;buf);
    if (param-&gt;linkId.nodeId == mgr-&gt;profile.localId) {
        return COD_SUCCESS;
    }
    COD_LOG_DEBUG(COD_SUCCESS, "[ICS] trace triggered with param(nodeId:%u, linkLevel:%u, linkId:%u, packetSize:%u)",
                  param-&gt;linkId.nodeId, param-&gt;linkId.linkLevel, param-&gt;linkId.linkId, param-&gt;packetSize);
    if (param-&gt;linkId.nodeId != ICS_INITED_ITER_NODE_ID) {
        // specified nodeId
        COD_CALL(icsSendTraceByNodeId(mgr, param-&gt;linkId.nodeId, param));
    } else {
        CodUint32 nodeId = ICS_INITED_ITER_NODE_ID;
        while (!param-&gt;interrupt(param-&gt;caller) &amp;&amp; icsGetNextNodeId(mgr, &amp;nodeId)) {
            COD_CALL(icsSendTraceByNodeId(mgr, nodeId, param));
        }
    }
    return COD_SUCCESS;
}

/* 接收线程处理INNER CMD */
CodVoid icsProcessInnerMsg(IcsLink* link, IcsMsgHead* head)
{
    IcsLinkPool* pool = link-&gt;pool;
    if (head-&gt;cmd == ICS_CMD_HEARTBEAT) {
        icsQuickHeartbeat(pool-&gt;mgr, head-&gt;srcNode, COD_TRUE);
    } else if (head-&gt;cmd == ICS_CMD_TRACE) {
        IcsTraceData* traceData = (IcsTraceData*)head-&gt;smartData;
        IcsMsg msg = {0};
        IcsMsgHead msgHead = {0};
        icsPackTraceMsg(&amp;msg, (CodChar*)&amp;msgHead, ICS_MSG_HEAD_SIZE, &amp;traceData-&gt;linkId, traceData-&gt;traceId, COD_TRUE);
        msg.head-&gt;srcNode = (CodUint16)pool-&gt;mgr-&gt;profile.localId;
        msg.head-&gt;dstNode = head-&gt;srcNode;
        if (icsSend(pool-&gt;mgr, ICS_INNER_LINK_LEVEL, &amp;msg, ICS_TRACE_SEND_TIMEOUT, NULL) != COD_SUCCESS) {
            codCleanCurError();
        }
        if (head-&gt;size &gt; ICS_MSG_HEAD_SIZE) {
            (CodVoid)icsLinkReadRemainMsg(link, head-&gt;size - (CodUint32)ICS_MSG_HEAD_SIZE);
        }
    } else if (head-&gt;cmd == ICS_CMD_TRACE_ACK) {
        IcsTraceData* traceData = (IcsTraceData*)head-&gt;smartData;
        IcsLink* ackLink = NULL;
        if (icsGetLinkById(link-&gt;pool-&gt;mgr, &amp;traceData-&gt;linkId, &amp;ackLink) != COD_SUCCESS) {
            codCleanCurError();
        } else if (ackLink-&gt;traceId == traceData-&gt;traceId) {
            ackLink-&gt;hbResponseTime = ICS_GET_TIME_US(&amp;link-&gt;pool-&gt;mgr-&gt;profile);
        }
    }
}

```

**3. 获取节点级、链路级吞吐量**

```
CodVoid icsThroughputUpdate(IcsThroughput* throughput, CodUint32 currTime)
{
// 接口说明：每一次访存吞吐量时都需要根据当前时间刷新吞吐槽位和当前时间
    CodUint32 timeDiff = currTime - throughput-&gt;timeInSec;
    if (COD_UNLIKELY(throughput-&gt;timeInSec == 0 || timeDiff &gt;= SEC_PER_MIN)) {
        (CodVoid)codSafeMemSet(throughput, sizeof(IcsThroughput), 0, sizeof(IcsThroughput));
        throughput-&gt;timeInSec = currTime;
        return;
    }
    CodUint8 oldIdx = GET_IDX(throughput-&gt;timeInSec);
    CodUint8 currIdx = GET_IDX(currTime);
    if (timeDiff &lt; SLOT_WIDTH &amp;&amp; oldIdx == currIdx) {
        throughput-&gt;timeInSec = currTime;
        return;
    } else {
        throughput-&gt;slot[oldIdx] = throughput-&gt;tempSlot;
        throughput-&gt;tempSlot = 0;
        for (CodUint8 idx = IDX_FOR_STEP(oldIdx, 1); idx != currIdx; idx = IDX_FOR_STEP(idx, 1)) {
            throughput-&gt;slot[idx] = 0;
        }
        throughput-&gt;timeInSec = currTime;
    }
}

CodUint64 icsThroughputCalcSum(IcsThroughput* throughput, CodUint32 currTime)
{
// 接口说明：刷新，计算IcsThroughput中所有槽位吞吐量的合
    icsThroughputUpdate(throughput, currTime);
    CodUint64 sum = 0;
    for (CodUint8 idx = 0; idx &lt; SLOT_NUM; idx ++) {
        sum += throughput-&gt;slot[idx];
    }
    return sum;
}

CodVoid icsThroughputIncrease(IcsThroughput* throughput, CodUint32 currTime, CodUint32 num)
{
// 接口说明：刷新，给当前秒所属吞吐槽位增加指定值的吞吐量（写到tempSlot避免跳变）
    icsThroughputUpdate(throughput, currTime);
    throughput-&gt;tempSlot += num;
}


CodVoid icsThroughputAppend(IcsLinkPool* pool, CodUint32 currTime, IcsLink* link)
{
// 接口说明：link释放时需要把该链路上一分钟的吞吐量转移到pool上记录（否则链路一被释放其上一分钟吞吐量就汇总不到节点级了）
    icsThroughputUpdate(&amp;pool-&gt;poolThroughput, currTime);
    icsThroughputUpdate(&amp;link-&gt;linkThroughput, currTime);
    for (CodUint8 idx = 0; idx &lt; SLOT_NUM; idx ++) {
        pool-&gt;poolThroughput.slot[idx] += link-&gt;linkThroughput.slot[idx];
    }
    pool-&gt;poolThroughput.tempSlot += link-&gt;linkThroughput.tempSlot;
    (CodVoid)codSafeMemSet(&amp;link-&gt;linkThroughput, sizeof(IcsThroughput), 0, sizeof(IcsThroughput));
}

```

###   [4.4 工作量评估](#44-工作量评估)  

|工作项|具体拆分|备注|总计|
|---|---|---|---|
|设计|实际设计（3人天）||3人天|
|开发|收发缓冲区（0.5人天）+ 链路响应速度（1.0人天）+ 吞吐量统计（1.5人天）+ 单元测试和资料（1.0人天）+ 预留（1.0人天）||5人天|
|自测|测试工具的学习和调试（1人天）+ 实际测试（2.0人天）||3人天|
|预估|4/15完成设计，4/16开发评审，4/22完成编码，4/25前完成自测||11人天|


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

###   [5.1 单元测试用例](#51-单元测试用例)  

1. 看护icsGetTcpQueueSize的异常分支
1. 看护icsEnableTrace公共接口
1. 看护IcsThroughput结构体相关的增删改查基础函数


###   [5.2 自动化测试用例](#52-自动化测试用例)  

|类型|场景|测试方法|预期|备注|
|---|---|---|---|---|
|正常用例|关注空闲时链路tcp收发缓冲区使用情况|正常查询视图|不core不报错，SEND/RECV_QUEUE_SIZE显示的值较低||
|正常用例|关注繁忙时链路tcp收发缓冲区使用情况|通过某种方法提高网络繁忙程度，再查询视图|不core不报错，SEND/RECV_QUEUE_SIZE显示的值较高|值是大是小基于经验和比较|
|正常用例|未主动触发探测时关注链路响应速度|不触发探测直接查询视图|不core不报错，字段显示NULL||
|正常用例|主动触发探测后关注链路响应速度|触发探测后查询视图|不core不报错，正常发送链路的响应速度全为较低有效值，接收链路仍为NULL||
|正常用例|关注空闲时链路和节点级吞吐量|正常查询视图|不core不报错，THROUGHPUT显示的值较低||
|正常用例|关注繁忙时链路和节点级吞吐量|通过某种方法提高网络繁忙程度，正常查询视图|不core不报错，THROUGHPUT显示的值较高|值是大是小基于经验和比较|
|异常用例_延迟|关注网络延迟时tcp收发缓冲区情况|主动注入网络延迟故障后查询视图|收发缓冲区使用大小均高于正常场景||
|异常用例_延迟|关注网络延迟时链路响应速度|主动注入网络延迟故障后查询视图|链路响应速度远低于正常场景||
|异常用例_丢包|关注网络丢包时tcp收发缓冲区情况|主动注入网络丢包故障后查询视图|收发缓冲区使用大小均高于正常场景||
|异常用例_丢包|关注网络丢包时链路响应速度|主动注入网络丢包故障后查询视图|链路响应速度远低于正常场景或显示-1||
|异常用例_网卡故障|关注网卡故障时tcp收发缓冲区情况|主动注入down网卡故障后查询视图|||
|异常用例_网卡故障|关注网卡故障时链路响应速度|主动注入down网卡故障后查询视图|||
|异常用例_节点故障|关注节点故障时tcp收发缓冲区情况|主动kill节点后查询视图|||
|异常用例_节点故障|关注节点故障时链路响应速度|主动kill节点后查询视图|||


###   [5.3 手动测试用例](#53-手动测试用例)  

|类型|场景|测试方法|预期|备注|
|---|---|---|---|---|
|单机部署|在单主机上部署分布式后关注网络相关视图|单主机部署分布式后查询视图|不core不报错，在几种正常场景下显示与多机部署相差不多||
|Ipv6兼容|在支持IPV6的机器上部署分布式后关注网络相关视图|配置IPV6部署后查询视图|不core不报错，显示正常||
|WIN兼容|在Windows机器上部署分布式后关注网络相关视图|Windows部署后查询视图|不core不报错，显示正常||


##   [6.资料设计章节](#6资料设计章节)  

1. 视图新增字段的说明
1. 高级包相关文档
1. 特性相关修改补充到ICS模块设计文档


##   [7.未来规划](#7未来规划)  

## Attachments:

[v2-43e37c2bc9209e4b32652ab9d3826083_1440w.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjNhMWFkOWEzMzExZGM5MGRlIiwicmVmX2lkIjoiNjczOTZkNjM3MjgyMDZlZmI5MmYxZTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODcwLCJleHAiOjE3ODIzOTQyNzB9.mXH4SaTKKfPuOZsd7THyyaZLinmpKqMuqzilwKz5has)

 (image/png)    


[22c7b5ab655640cb8660ad5abdaf8f59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjNhMWFkOWEzMzExZGM5MGRmIiwicmVmX2lkIjoiNjczOTZkNjM3MjgyMDZlZmI5MmYxZTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODcwLCJleHAiOjE3ODIzOTQyNzB9.y-8wKEcGe0SHA9Vyp3GgtpyNJkzUmeP9xHyk-6zymJM)

 (image/png)    


[clipbord_1713157110975.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjM4OTcwYzJhZjRmNTIxMjZkIiwicmVmX2lkIjoiNjczOTZkNjM3MjgyMDZlZmI5MmYxZTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODcwLCJleHAiOjE3ODIzOTQyNzB9.eMo49tpCwuKt5-7KE1-CdPIIG8lYH2nw3c-sPRlCwkA)

 (image/png)    


[链路响应速度探测.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjNhMWFkOWEzMzExZGM5MGUwIiwicmVmX2lkIjoiNjczOTZkNjM3MjgyMDZlZmI5MmYxZTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODcwLCJleHAiOjE3ODIzOTQyNzB9.xobLadYWhm5t62TspasjC0AdQYQ6VQe2EWS_N_5oUYw)

 (image/png)    


[链路响应速度探测.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjNhMWFkOWEzMzExZGM5MGUxIiwicmVmX2lkIjoiNjczOTZkNjM3MjgyMDZlZmI5MmYxZTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODcwLCJleHAiOjE3ODIzOTQyNzB9.xSjE3q0K5whzP7bI5iHKr9QkZ2g8ur_u83PFNdJhYn0)

 (image/png)    


[tcp收发缓冲区_网图.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjM4OTcwYzJhZjRmNTIxMjZmIiwicmVmX2lkIjoiNjczOTZkNjM3MjgyMDZlZmI5MmYxZTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3ODcwLCJleHAiOjE3ODIzOTQyNzB9.bcK3EyVaRv82E62yZsXJUybfzu60dFZe6G-0QQhxXoA)

 (image/png)    


## Comments:

|  [](null)  ,开发设计评审纪要：    [开发设计评审纪要 - 陈俊杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150616489)  ,Posted by chenjunjie at 四月 16, 2024 15:53|
|---|
