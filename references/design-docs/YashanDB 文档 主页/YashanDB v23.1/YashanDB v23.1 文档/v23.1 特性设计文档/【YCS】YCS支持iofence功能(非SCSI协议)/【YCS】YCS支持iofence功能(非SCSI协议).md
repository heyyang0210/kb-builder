Created by 李雪峰, last modified by  李垠 on 十一月 08, 2024

  [YDBRD-15216](https://jira.yasdb.com/browse/YDBRD-15216?src=confmacro)    -  【共享集群】ycs支持iofence功能  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#1-overview%E6%A6%82%E8%BF%B0)  

   如果ycs主节点写磁盘心跳超时，此时集群可能已经另有新主，旧主节点的yasdb应立即停止对磁盘进行操作。与旧主还有网络联系的其它节点yasdb也应停止对磁盘操作。

  避免脑裂造成数据混乱。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

  主YCS的磁盘心跳超时后，与之正常连接的备ycs所管理的yasdb都会suspend io操作，直到磁盘心跳恢复，如果发生了仲裁切换了新主ycs，无法恢复IO。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#3-interfaces%E6%8E%A5%E5%8F%A3)  

   yasdb查询topo信息，增加返回ycs是否被踢出集群

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1. io fence不能拦截在途IO，假设IO延时足够小，不足以让接管实例完成恢复并与在途IO产生写冲突
1. 备机抢主然后叠加主机加锁写control block超时的场景，可能出现双写冲突，假设IO延时足够小，前述场景不会出现。
1. 写磁盘心跳的时延不能达到秒级，否则如果DISK_HB_KEEP_ALIVE配置到最小时，可能把写盘延时误判成超时。
1. 配置参数DISK_HB_KEEP_ALIVE 不能小于NETWORK_HB_TIMEOUT
1. iofence在磁盘异常时会关掉IO和异常恢复后打开IO, 如果带业务场景DB自身有约束，需要遵循DB约束。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

  主节点成功写入磁盘心跳后，记录当时时间。在yasdb查询topo结果时，计算当前时间与上次成功写磁盘心跳时间差值。

如果如果差值，大于给定的阀值（DISK_HB_KEEP_ALIVE 默认是30秒），则设置被踢下线标记，如果小于阀值则清除踢下线标记，返回给yasdb。

yasdb收到被踢下线标记后，如果没有io没有挂起，就调用yfs挂起io的接口。当收到清除踢下线标记时，io如果没有恢复，

就调用yfs恢复io接口。 

     非主节点也是在其向主节点查询topo结构时，设置踢下线标记，通过下发topo结果转送过去。最终转送到yasdb端。

其也做一样的操作。

iofence涉及的各个时间参数：

|名称|间隔时间|参数|说明|
|---|---|---|---|
|写磁盘心跳间隔|200ms |内部参数：YCS_MONITOR_INTERVAL|  
|
|判断与磁盘正式失联时间|30s|DISK_HB_KEEP_ALIVE|在判断到30s未能写入磁盘，就认为与磁盘失联。,每次DB查询topo就会计算是否已经过了30秒还未写磁盘。,如果是就设置踢下线标记。|
|DB查询topo结构间隔|100ms|内部参数：YCS_INSPECT_INTERVAL|  
|
|网络超时时间|30s |NETWORK_HB_TIMEOUT|  
|


  


  [https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/%E9%9B%86%E7%BE%A4%E6%9C%8D%E5%8A%A1%E7%AE%A1%E7%90%86/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E9%85%8D%E7%BD%AE.html](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/%E9%9B%86%E7%BE%A4%E6%9C%8D%E5%8A%A1%E7%AE%A1%E7%90%86/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E9%85%8D%E7%BD%AE.html)  

几个场景下iofence的表现：

##### 一、2节点网络正常，主节点写磁盘心跳超时。

此种场景如果磁盘在被设置标记为踢下线后，30秒不能恢复则主和备数据库都会 abort。

因为被判定标记为踢下线后，就不会更新接收Topo消息时间，DB在未收到Topo结构30秒后就abort。

具体过程如下：

1）主节点在DISK_HB_KEEP_ALIV（默认30s）E时间内未能成功写入磁盘心跳；

2）主节点DB向YCS查询请求查询Topo

3）主节点YCS检查到写磁盘心跳超时，在响应查询Topo请求里设置踢下线标记

4）非节点DB在向YCS请求查询Topo时，消息转发到YCS主节点，主节点把踢下线标记放到响应里。

##### 二、2节点网络断开，主节点写磁盘心跳超时。

此种场景备节点为takeover主节点。主节点在被takeover后，网络恢复、写磁盘恢复后会触发异常走重新加入集群流程。

主节点和第一种情况的1到3步骤是一样的；

非主节点表现是：

1）网络断开NETWORK_HB_TIMEOUT（默认30s）后触电ICS断连事件

2）ICS断连事件触发通信渠道关闭异常(channel close)

渠道关闭异常开始：

3）设置该渠道关联的结点状态为offline

设置重组操作（ReformCluster）：

4）判断主节点是否存活，每隔1秒读1次磁盘，总共DISK_HB_KEEP_ALIVE次（默认30)，

     每次读到的磁盘信息都一样，说明主节点一直没写盘，判断其为下线，即可执行takeover成功为新主

##### 三、2节点网络断开，主节点正常写磁盘心跳。

此种场景备节点为takeover主节点失败，触发脑裂异常(YCSE_CLUSTER_SEPARATED),不断地尝试重新加入集群。

具体步骤和第二种场景一样，只是在步骤4进行takeover失败。

  


##### 总结：

IOFence只会在写磁盘失败才会发生，所以本次修改不影响第三种场景。提供  YCS_MONITOR_FAULT_POINT_8  故障点，模拟磁盘卡住场景。

可使用blade制造网络断连场景。

###   [5.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)      [Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

YcsClusterMngr新增  maybeEvicted、lastBtTick  字段。

typedef struct StYcsClusterMngr{

SpinLock ctrlLock; // for cluster topology updating

.......

CodBool maybeEvicted; // possibly evicted since master never finish disk beat in time    
  CodUint64 lastBtTick; // tick of last success beat disk

CodUint64 statTicks;

CodUint8 nodeStates[YCS_MAX_NODES]; // type YcsNodeState    
  CodUint8 trySendHeartbeatTimes[YCS_MAX_NODES]; // try send heartbeat times    
  YcsTopoManager topoManager;

} YcsClusterMngr;

  


YcsContext新增  maybeEvicted  字段。

typedef struct StYcsContext {    
  // filled by YCS    
  YcsHandle hSrv;    
  CodUint8 nodeId;    
  volatile CodBool isOpen;    
  CodBool isFormat;    
  CodBool maybeEvicted; // possibly evicted since master never finish disk beat in time  

...

} YcsContext;

#####   [5.2.1 主节点yasDB获取踢下线标记](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#5221-%E5%88%9D%E5%A7%8B%E5%8C%96ycs%E5%90%84%E4%B8%AA%E6%A8%A1%E5%9D%97%E8%B5%84%E6%BA%90)  

  ``  

#####   [5.2.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#5221-%E5%88%9D%E5%A7%8B%E5%8C%96ycs%E5%90%84%E4%B8%AA%E6%A8%A1%E5%9D%97%E8%B5%84%E6%BA%90)      [非主节点yasDB获取踢下线标记](https://conf.yasdb.com/pages/viewpage.action?pageId=109584076#5221-%E5%88%9D%E5%A7%8B%E5%8C%96ycs%E5%90%84%E4%B8%AA%E6%A8%A1%E5%9D%97%E8%B5%84%E6%BA%90)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b098970c2af4f5200e6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2NDAsImV4cCI6MTc4MjMwMTQ0MH0.p9w_fuENIR0Ukaj5OjZa-gEg1CTetpFSzC29QiqsnC4)

  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|场景|结点数|网络|磁盘心跳|执行及预期|
|---|---|---|---|---|
|1|2|正常|正常|正常启停， 结点状态均正确|
|2|3|正常|正常|正常启停，结点状态均正确|
|3|2|正常|超时|主节点和备的yasdb都会挂起，在30秒（netWorkTimeout）内未收到清除挂起请求，最终db abort|
|4|2|正常|超时|主节点和备的yasdb都会挂起，在30秒（netWorkTimeout）内收到清除挂起请求，继续运行|
|5|2|正常运行后断开|超时|主节点的yasdb都会挂起,备节点升主，并能对外正常服务|


  


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#7-document%E8%B5%84%E6%96%99)  

参数配置说明补充DISK_HB_KEEP_ALIVE 设置为30秒。

##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

5人日

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=112728655#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  



## Attachments:

[image2023-6-30_16-25-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDdhMWFkOWEzMzExZGM3ZjQ2IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.60lXoC2nsQAgTa9TpjVSiljbL_pP3F0TXr2-QRdxlXQ)

 (image/png)    


[image2023-6-29_17-52-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDdhMWFkOWEzMzExZGM3ZjQ3IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.52A38D9Cfqyc7b4kODzhQaPgIRQMCiHknilmDsDdB2c)

 (image/png)    


[image2023-6-29_17-51-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGNmIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.ZiSIYuSTzzsIvU_eQIl0lXF64djzp3c3hkb8X8sKEyM)

 (image/png)    


[image2023-6-29_17-50-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGQwIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.Vy3GjcvV8CtIeEXyPcSxQGv-1PfeTp6_hqL1yTZY9g4)

 (image/png)    


[image2023-6-29_17-50-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDhhMWFkOWEzMzExZGM3ZjQ4IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.LNqDem3ifiU8vfDdAuHgMt2QYk0TSPa_ITnZ6zz70PQ)

 (image/png)    


[image2023-6-29_17-46-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDhhMWFkOWEzMzExZGM3ZjQ5IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.X-Ix-20uDE_K0u3dsF2CmliWBrfWjU0hmBC1URXIM0M)

 (image/png)    


[image2023-6-29_17-46-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGQxIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.-QkNMnt341N1kVsBWclYcFtNwzRAxOY8nj0_b30Rdts)

 (image/png)    


[image2023-6-29_17-38-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDhhMWFkOWEzMzExZGM3ZjRhIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.9Jwe0bwTa-yDbzRC11m6dBCBQXSclj-aRJa0DxVWhA0)

 (image/png)    


[image2023-6-29_17-37-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGQyIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.Tttm0MFq9rrobMJ7-w-9gX-TBd1QO-cCSWDKxGeGpI4)

 (image/png)    


[image2023-6-29_17-35-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGQzIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.cxU9vgRy19P2Z6hO31US6N6j1o2-HAqqFKifZcoWY2g)

 (image/png)    


[image2023-6-29_17-35-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDhhMWFkOWEzMzExZGM3ZjRjIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.FNd-ApQWKAdSCs2jbqrYxcIe2FWCcpu_K0ctr3i6IvE)

 (image/png)    


[image2023-6-29_14-14-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGQ1IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.Q8JeKpuqYLZJE6DWMYeld_Osr_plJE0Q16CiGFL6XIc)

 (image/png)    


[image2023-6-29_14-12-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGQ3IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.hnU03Rj-ISq0597jOvhFBKfBnQ0Zrz7ryR2S1U3sEoQ)

 (image/png)    


[image2023-6-29_14-12-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDhhMWFkOWEzMzExZGM3ZjRkIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.-pr-yeQJbiqgZKJA8WmNPDwHMe3ZaM93zWq4Wg2c-cI)

 (image/png)    


[image2023-6-29_14-11-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGQ5IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.MxjLNB-qpcViCzZY-MQoxNm9bXJzUyLSoGHoG9sMSgg)

 (image/png)    


[image2023-6-29_11-16-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGRhIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.5qWBiRsLNO-GxXKjQYIqN1Ak7UpPBaMVcSg1jOBVFBc)

 (image/png)    


[image2023-6-28_21-17-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDhhMWFkOWEzMzExZGM3ZjUyIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.iHQBs69zlu3dwwCgQ5d7dllS0fx945O6Ak1o70ncO5g)

 (image/png)    


[image2023-6-28_21-12-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDhhMWFkOWEzMzExZGM3ZjUzIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.ZD6BVcpIw8Z_Q0W50Df88qcbD6U4niGx3KswlLETbag)

 (image/png)    


[image2023-6-28_21-10-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGRkIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.UQJS0XCid0qlbR0XmRGmm4SwbjqjGKp1XQx-4HkOXGY)

 (image/png)    


[image2023-6-28_21-9-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDg4OTcwYzJhZjRmNTIwMGRlIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.xp_7PL_V0LaoD8XeMpjFimna2CSKRGGslYdoHsUwGr0)

 (image/png)    


[image2023-6-28_21-8-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDlhMWFkOWEzMzExZGM3ZjU1IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.mQRwRCAuHBtDQYScJjkMUNmVML4IuLWuL0dyosz0-OY)

 (image/png)    


[image2023-6-28_20-42-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDlhMWFkOWEzMzExZGM3ZjU2IiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.QHMMVEJ8HMXw35mCM41rI0msEE9jvVtnkCoguD2pZjc)

 (image/png)    


[image2023-6-28_20-1-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDk4OTcwYzJhZjRmNTIwMGUyIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.Xku17hGC_5XC--_j9Q9nmlvE7vxc-AV3bn4l2yYa88g)

 (image/png)    


[image2023-6-28_19-54-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDk4OTcwYzJhZjRmNTIwMGUzIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.RV6358IOf2JHMhWUB7dWpX-aLZGehE9ayotXlg2G8jM)

 (image/png)    


[image2023-8-24_21-26-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDlhMWFkOWEzMzExZGM3ZjVhIiwicmVmX2lkIjoiNjczOTZiMDc1OTNmOTljOWZmMjM1ZDAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjQwLCJleHAiOjE3ODIzNzcwNDB9.tNlhyLr-rXptfIYECEuLlRQ2K0X162Jgxos9odEgshI)

 (image/png)    


## Comments:

|  [](null)  ,非主节点的时间差是怎么计算出来的,Posted by liyin at 八月 25, 2023 10:47|
|---|
|  [](null)  ,“磁盘心跳时间差值”跟脑裂的关系是什么呢？补充一些场景图吧，包括发生了脑裂，没有iofence会怎么样，采用了该算法后如何阻止的脑裂（结合测试用例4，如果主节点写磁盘心跳正常，备升主就会失败，走加入集群流程，这时iofence什么流程？）,Posted by liyin at 八月 25, 2023 11:11|
