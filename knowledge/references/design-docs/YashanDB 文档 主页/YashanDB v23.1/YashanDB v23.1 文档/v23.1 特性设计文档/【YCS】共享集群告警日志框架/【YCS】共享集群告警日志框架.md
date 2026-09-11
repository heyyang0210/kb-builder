Created by 李雪峰, last modified by  李垠 on 十一月 08, 2024

  [YDBRD-15220](https://jira.yasdb.com/browse/YDBRD-15220)       -     【共享集群】ycs集成告警框架     待启动

参考：

  [告警日志](https://conf.yasdb.com/pages/createpage.action?spaceKey=~lixuefeng&title=%E5%91%8A%E8%AD%A6%E6%97%A5%E5%BF%97&linkCreation=true&fromPageId=112728655)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#1-overview%E6%A6%82%E8%BF%B0)  

使用单机告警实框架现享集群告警日志。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 支持当共享集群发生特定状况的时候，上报告警。
1. 支持系统特定状况解除时取消报警。


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
<span class="hljs-comment" style="color: rgb(136,136,136);">// 上报告警</span>
#define COD_REPORT_ALERT(alert, sid, oid, ...) \
doAlert(alert, ALERT_REPORT, sid, oid, ALERT_CONTENT_FMT(alert), ##__VA_ARGS__);

<span class="hljs-comment" style="color: rgb(136,136,136);">//取消告警</span>
#define COD_CLEAR_ALERT(alert, sid, oid) doAlert(alert, ALERT_CLEAR, sid, oid, "%s", "")

```

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

目前支持4种告警：

1. 结点间链路异常关闭
1. 访问选举盘异常
1. 结点被踢出集群
1. 磁盘心跳检查异常


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 告警功能](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#51-%E5%91%8A%E8%AD%A6%E5%8A%9F%E8%83%BD)  

1. 支持当共享集群发生特定状况的时候，上报告警。
1. 支持系统特定状况解除时取消报警。


###   [5.1.1 告警日志](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#514-%E5%91%8A%E8%AD%A6%E6%97%A5%E5%BF%97)      [格式](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#514-%E5%91%8A%E8%AD%A6%E6%97%A5%E5%BF%97)  

|字段|类型|是否可选|说明|举例|
|:---|:---|:---|:---|:---|
|TimeStamp|TimeStamp|必选|产生告警的时间|  
|
|Session ID|uint16|必选|产生告警的会话ID，  共享集群填0|  
|
|Event Name|Text|必选|告警类型名称|- Dead Lock|
|Object|Uint64|必选|产生告警的对象ID<br>- Object 和event name一起构成告警的唯一标识符<br>- 这个唯一标识符主要是用来对可消除告警进行检索，进行告警消除<br>- 对于一些不需要消除的告警，则仅仅用于信息过滤<br>- 有些告警不需要object信息，则设置为0|数据库对象，则是object id<br>表空间，则是space id<br>数据块，则是block id|
|Action|int|必选|0： 产生<br>1: 消除|  
|
|Content|text|可选|对该告警的其他附带信息，k1=v1&k2=v2|  
|
|Description|text|可选|供用户进一步了解告警的详细信息|  
|


###   [5.1.2 共享集群告警项](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#51-%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E5%91%8A%E8%AD%A6%E9%A1%B9)  

  


|告警项|告警类型名称|产生告警的对象ID|触发上报告警条件|触发取消报警条件|备注|
|:---|---|---|:---|:---|---|
|结点间链路异常关闭|  `InterChannelClosed`  |对端结点Id|网络心跳超时|结点重连成功|  
|
||||ics链路异常关闭|||
|访问选举盘异常|DiskError|0|读盘异常：,1、请求选举时遇到读盘失败|结点内部重启流程|  
,  
|
|||0|写盘异常：,1、请求选举时遇到写盘失败|||
|||0|锁盘异常：,1、选主时锁盘失败|||
|结点被踢出集群,  
    
|ClusterSeparated|0|在结点异常断连重组集群时，block 上的 age与内存中的不一致|结点内部重启流程|  
|
|||0|结点启动失败|||
|||0|发送磁盘心跳失败|||
|||0|选主时重置失败|||
|||0|选主时该结点是下线状态|||
|选举盘检查异常|NewVoteExpected|0|YCS监控线程中检查到非新加入的选举磁盘age大于内存age|结点内部重启流程|  
|
|数据库异常停止|DBInstanceDown|db的resource id|yasDB进程挂掉|DB重新上线|  
|
|告警日志重置标记|AlertReset|当前结点id|YCS启动成功后|无|遇到该告警项时，之前的告警上报的事件都已经解决，不会再发取消告警。|


  


**示例：**

**TimeStamp | Session ID| Event Name | Object | Action | content |Event Escription**

```
<span class="hljs-comment" style="color: rgb(136,136,136);"># 结点0 上发现结点1与其断连
</span>2023-06-06 19:43:49.673|0|InterChannelClosed|1|0|node id: 1 had disconnected<span class="hljs-string" style="color: rgb(136,0,0);">
# 结点1 重连后撤销告警 
2023-06-06 19:53:50.673|0|InterChannelClosed|1|1</span>
```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

6种情况均能告警上报与恢复

##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#7-document%E8%B5%84%E6%96%99)  

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

预计200行 ，2人/天

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

    上报告警接口doAlert中使用全局变量gAlertEvent，所有告警事件都需要填到该结点才能使用doAlert，

      如果使用该接口，YCS的告警事件需要在DB的代码中加入。如果不用则需要重复写一套；

      有一个中间方案，只给YCS一个事件类型，YCS通过objectId来进一步区分是什么事件。对运维不友好。