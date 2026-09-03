Created by 林博, last modified on 六月 28, 2023

IR链接：    [YDBRD-11533](https://jira.yasdb.com/browse/YDBRD-11533)     / SR链接：    [YDBRD-8125](https://jira.yasdb.com/browse/YDBRD-8125)  

##   [1. Overview（概述）](#1-overview概述)  

本方案是分布式TPCH优化项目的一个优化点：支持分布式场景下Runtime Filter的使用。

##   [2. Features（功能特性）](#2-features功能特性)  

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

支持的RuntimeFilter规格与单机一致，详细为：

- 只对单个Join Key的Hash Join进行下推；
- Join key只能是列，且数据类型要求一致；
- Left/Full/AntiSemi不支持下推；


2023年6月28日更新：SR     [YDBRD-14150](https://jira.yasdb.com/browse/YDBRD-14150)    合入后:

- 支持多字段；
- Joinkey可以是表达式；


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

分布式RuntimeFilter需要解决的问题主要是跨Stage的Runtime Filter的分发、合并与下推（跨Stage的分发合并需要和单机并行的分发合并区别开）。

###   [5.1 Architecture（架构）](#51-architecture架构)  

**分发与合并：**

- 如果stage内部能够得到由全量build数据构造的runtime filter，则不需要进行合并。比如右表是复制表或者右表做Broadcast分发。
- 如果是stage内部做local join，不涉及到跨stage的join，则不需要进行分发与合并；


否则，就需要将各个Stage上由部分build数据生成的Part Runtime Filter分发到其他Stage上进行合并；

补充2023年6月27日：

1. dn内join，build无分发


- probe有分发：需要分发，需要合并，src和dst都置为所有dn节点；
- probe无分发：不需要分发，不需要合并，src和dst都置为空数组；


1. dn内join，build Broadcast分发：


- probe无分发：不需要分发，不需要合并，src和dst都置为空数组；
- probe有分发：不需要分发，不需要合并，src和dst都置为空数组；


1. dn内join，build非Broadcast分发：


- probe无分发：不需要分发，不需要合并，src和dst都置为空数组；
- probe有分发：需要分发，需要合并，src和dst都置为所有dn节点；


1. dn内join，probe无分发：不需要分发，不需要合并，src和dst都置为空数组；
1. dn内join，build侧的join key全是复制表（等价build Broadcast？）不需要分发，不需要合并，src和dst都置为空数组；
1. cn内join，不需要合并，需要分发到dn上，src置为cn自己的endpoint，dst置为所有dn节点；


**Scan等待下推：**

如果某个Stage上有Scan要用到推下来的Total Runtime Filter，则该Scan算子不能立即执行，需要等拿到合并之后的Total Runtime Filter之后，才可以开始执行。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 Part Runtime Filter：Send/Merge](#521-part-runtime-filtersendmerge)  

在单个stage的Hash Join执行过程中，Runtime Filter的构造发生在build阶段，即根据build数据构造Hash Table之后再利用计算得到的hash value构造runtime filter，构造完成之后在Probe侧进行下推；

Probe侧下推过程中：

- 没有Px Receiver Remote，并且没有Px Receiver Local：没有跨stage的分发合并，没有单机并行的分发合并；
- 没有Px Receiver Remote，有Px Receiver Local：没有跨stage的分发合并，有单机并行的分发合并；
- 有Px Receiver Remote，没有Px Receiver Local：有跨stage的分发合并，没有单机并行的分发合并；
- 有Px Receiver Remote，有Px Receiver Local：有跨stage的分发合并，有单机并行的分发合并；


分发发生在PxReceiver的push_filter处。

####   [5.2.2 计划提供信息](#522-计划提供信息)  

- Runtime Filter是Global的还是Local的；
- Runtime Filter是否需要Merge；
- Runtime Filter进行Merge时，需要Merge的总数；
- Runtime Filter需要Global Merge时，产生该runtime filter的节点endpoint；


####   [5.2.3 数据结构](#523-数据结构)  

**Runtime Filter序列化与反序列化：**

格式定义：

```


```

**ColScanCursor执行等待：**

ColScanCursor执行时判断是否用到了Global的RuntimeFilter。如果用到了，需要根据ID拿到合并之后的Global Total Runtime Filter 才可以执行。

```
loop {
    if self.ctx.is_interrupted() {
        return Err(Error::Interrupted(format!("colscan is interrupted")));
    }

    match get_total_runtime_filter(id)? {
        Some(filter) =&gt; {
            break;
        }
        None =&gt; {
            sleep(Duration::from_micros(WAIT_TIME));
        }
    }
}

```

- 发送超时：


如果某个Part Runtime Filter发送超时，发送失败的节点会报错，然后会设置interrupt，除了打断自身外，也会打断其他节点。ColScanCursor可以接收到Interrupt结束等待；

- 网络断连：


网络断连时，协调节点会发送打断命令字去打断接收方，ColScanCursor也可以接收到Interrupte结束等待；

- 接收异常


接收到PartRuntimeFilter时，如果反序列化时候出现异常，则需要设置Interrupte打断ColScanCursor的等待（或者要求发送方重传？）；

**Runtime Filter分发：**

相关链接：    [ICS消息接口文档](https://conf.yasdb.com/pages/viewpage.action?pageId=98501599)  

- **ICS新增CMD：**


增加一种消息类型：ICS_CMD_RUNTIME_FILTER。

- **发送方：**


Stage之间发送Part Runtime Filter的时候，发送的Msg的Header->cmd为此类型。

```
// 基于可扩展不连续内存构造消息

csMsgBuilder builder = ICS_INITED_MSG_BUILDER;
// 初始化builder
icsMsgBuilderInitAutoScale(builder, extendSize, ctx, (AllocMem)alloc, (FreeMem)free);

// 序列化RuntimeFilter
srlRuntimeFilter = srlzRuntimeFilter(rf);

// 构造消息
icsMsgWriteData(builder, srlRuntimeFilter, size);
anlWriteIcsHead(&amp;builder, ICS_CMD_RUNTIME_FILTER, *endpoint, gsid, stmt-&gt;attr.id); 

// 得到构造好的消息
msg = icsMsgBuilderFinish(&amp;builder);

// 发送消息
anlDstbSendMessageAsync(handler, enpointlist, msg);

// 等待接收端回复，可以自定义anlProcResult处理接收端的回复；
anlWaitExecuteResult(handler, anlProcResult, COD_FALSE);

```

- **接收方：**


```
IcsMsgReader reader = ICS_INITED_MSG_READER;
// 初始化MsgReader
icsMsgReaderInit(&amp;reader, msg);

// 读取数据
icsMsgReadData(reader, dsrlzRuntimeFilter, size);

// 反序列化得到RuntimeFilter
rf = dsrlzRuntimeFilter(dsrlzRuntimeFilter);

// 合并
mergeById(rf);

```

**Runtime Filter保存：**

stmt上新增字段runtime_context_map，该字段为一个HashTable，key为Runtime Filter ID，value是一个RuntimeContext。

RuntimeContext用来：保存接收到的Part Runtime Filter；合并；保存合并之后的Total Runtime Filter；

1）PxReceiver push_filter的时候，把自身的Part RunTime Filter根据runtime_filter_id添加到stmt对应的runtime_context中；

2）某个节点收到ICS_CMD_MERGE_RF的msg时，根据msg->header->stmtId拿到对应的stmt，反序列化Part Runtime Filter，根据runtime_filter_id添加到stmt对应的runtime_context中；

3）向runtime_context添加PartRuntimeFilter时，进行合并，同时记录哪些节点的Part Runtime Filter已经被合并了。如果达到了需要Merge的总数，标记合并完成，得到了TotalRuntimeFilter；

4）ColScanCursor从runtime_context_map根据runtime_filter_id取Total Runtime Filter；

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.资料设计章节](#7资料设计章节)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  