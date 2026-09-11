Created by 黄杨波, last modified by  Vivian Liu on 五月 08, 2023

#   [YDBRD-13497 : 集群支持interval分区自动拓展方案设计](#ydbrd-13497--集群支持interval分区自动拓展方案设计)  

  [https://jira.yasdb.com/browse/YDBRD-13497](https://jira.yasdb.com/browse/YDBRD-13497)  

##   [1. Overview（概述）](#1-overview概述)  

单机下只有一个节点，在对interval分区表进行insert触发自动拓展时，更新的index->partDict->partList、lobDict->index->partDict->partList、table->partDict->partList内存在本地可见，且interval分区拓展通过spinLock即可解决并发。集群下存在多个写节点，可能同时insert触发interval分区拓展，且由于是上的gls S lock，无法处理并发，因此在单机的spinLock基础上再加上gls Mutex Lock处理节点间的并发interval分区拓展，当执行节点完成后，需要广播同步其他节点index->partDict->partList、lobDict->index->partDict->partList、table->partDict->partList内存，否则其他实例不可见拓展出来的分区。

##   [2. Features（功能特性）](#2-features功能特性)  

1. 集群下某个实例执行insert table触发interval分区拓展，其他实例能感知到interval分区拓展产生的影响
1. 支持多实例并发进行interval分区拓展(通过gls Mutex Lock实现)


##   [3. Interfaces（接口）](#3-interfaces接口)  

1. 函数接口


|name|Meaning|
|---|---|
|AXC_CB->axcBcstExtendIntervalPart|广播同步interval分区拓展产生的dc->partDict->partList内存|


1. 消息接口


|name|function|Meaning|
|---|---|---|
|MSG_EXTEND_INTERVAL_PART|msgExtendIntervalPart|执行实例广播给其他实例同步dc->partDict->partList内存|
|MSG_EXTEND_INTERVAL_PART_ACK|msgNullFunc|其他实例同步完成后返回执行实例ack|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

```
typedef struct StRecIntervalPart {
    CodUint64      oid;
    CodUint64      partNum;
} RecIntervalPart;

```

###   [5.2 方案实现](#52-方案实现)  

interval分区自动拓展：

1. 按照单机逻辑执行ptExtendIntervalPart，在上spinLock处理本地并发前上gls Mutex Lock处理实例间的并发
1. 当本地执行完毕后，调用AXC_CB->axcBcstExtendIntervalPart广播其他实例同步index->partDict->partList、lobDict->index->partDict->partList、table->partDict->partList内存，广播内容为RecIntervalPart结构体中的内容，只需要oid+partNum即可，由于此时执行实例已经写了相关的系统表，因此其他实例只需要访问系统表加载内存信息即可，减轻消息负载
1. 其他实例在同步加载内存信息时需要遵循单机的流程，先extendPartList objArrayAdd NULL到对应的槽位，当把index、lob、table的partList内存全部加载完成后，再统一赋值，便于失败回滚。(此步骤当时是复用的备机重演的接口，extendPartList objArrayAdd对应的槽位，但没有置为NULL，而是置为0，这就会导致这部分partNum可以访问，在没有广播同步完成内存时，会并发的有实例为这部分part创建segment，此时会访问到partList，但为0，导致core掉)
1. 当收到其他所有实例的ack后，此时interval分区拓展在集群范围内生效


interval分区拓展与给分区创建segment并发场景分析及解决方案：

1. 在进行interval分区拓展广播的过程中，会出现部分实例拓展分区完成，部分未完成，可见分区的实例可以并发的给这个分区插数据触发segment的创建，进而广播segment创建同步，对于不可见分区的实例而言就会收到乱序的消息，目前的代码实现中，msgSsmEntry创建segment如果看到分区的内容为NULL时，会认为interval分区拓展同步未完成，进而直接报错，此举动在支持消息重试下是合理的，广播同步segment的实例不断重试即可。但目前不支持消息重试的情况下，需要针对这个场景返回失败的ack到广播实例，广播实例收到之后再重试


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 实例A对interval分区表执行insert操作触发interval分区自动拓展，其他实例查询TABPART$或OBJ$查看对应分区是否拓展出来
1. 多实例并发对interval分区表执行insert操作并发进行interval分区拓展验证正确性


##   [7.资料设计章节](#7资料设计章节)  

1. 部分实例被广播到创建好interval分区后，为该分区创建segment，广播msgSsmEntry，此时未进行interval分区拓展的实例收到此消息会报错，这个问题需要依靠消息重新解决开发手册-SQL参考手册-SQL语句-create table-inteval_clause中，增加对此场景可能出现的提示，并给出用户操作上规避的建议


##   [8. TODO（遗留问题）](#8-todo遗留问题)  