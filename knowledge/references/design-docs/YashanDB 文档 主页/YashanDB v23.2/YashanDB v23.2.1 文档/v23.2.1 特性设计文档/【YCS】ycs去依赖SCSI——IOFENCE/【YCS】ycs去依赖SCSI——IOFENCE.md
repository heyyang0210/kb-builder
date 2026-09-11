Created by 李垠, last modified on 十一月 08, 2024

IR链接：    [[YDBRD-19898] 取消对磁阵scsi接口依赖 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-19898)     / AR链接：    [[YDBRD-21695] 支持IOFENCE - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21695)  

多节点IO fence SR链接：    [[YDBRD-22514] 支持多节点iofence - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22514)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

    当集群中的master发生故障时，集群会进行投票，以选出新的master节点，过程中可能会产生新的yasdb master。在新的yasdb master以master角色进行工作与旧的yasdb master下线这段时间内，可能会存在双主并存的情况，如果任由这种情况发生，就可能将磁盘写坏，影响集群一致性。

    当集群中的yasdb节点正常退出或异常离线时，YCS的主节点需要更新topo中的yasdbMap以及topo版本号并下发到其他YCS节点和yasdb资源，以完成集群拓扑状态的更新。yasdb节点的上下线状态会影响其他节点对共享存储中block的加载和读写，如果某一节点被topo更新为离线但实际上还存在在途IO的话会导致其他节点异常。

    IO fence功能旨在从ycs服务端和ycs客户端(yasdb)分别完成对在途IO的保护：在YCS主节点给yasdb选新主或更新topo中yasdbMap前需要确保已无在途IO或磁盘心跳超时；在yasdb感知到被驱逐、与服务端网络心跳超时或服务端进程异常等，退出前需要阻断在途IO。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. YCS客户端磁盘心跳
1. 在途IO保护：
    1. 在YCS主节点更新topo中yasdbMap前需要确保该db已无在途IO或磁盘心跳超时
    1. 在YCS主节点给yasdb选新主前要确保旧db主节点已无在途IO或磁盘心跳超时
    1. 在yasdb感知到被驱逐、与服务端网络心跳超时或服务端进程异常等，退出前需要阻断在途IO并等待在途IO清零


  


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 写磁盘心跳的时延不能等于或者超过秒级，否则如果DISK_HB_KEEP_ALIVE配置到最小时，可能把写盘延时误判成超时。
- 配置参数DISK_HB_KEEP_ALIVE 不能小于NETWORK_HB_TIMEOUT
- iofence在磁盘异常时会关掉IO和异常恢复后打开IO, 如果带业务场景DB自身有约束，需要遵循DB约束。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

    YCS客户端磁盘心跳线程定期向votingdisk的指定资源块写入磁盘心跳，内容包括心跳号、在途IO数、IO fence标记等，同时检测本节点的YCS是否被集群踢出，若是则执行IO阻断，同时，当在途IO数清零时，进行abort。

    YCS主节点在更新Topo状态时（如投票结束、处理节点异常、收到备节点资源状态通知），需要确保待驱逐节点无在途IO，否则不能直接更新，交由磁盘心跳监控线程持续对这类异常yasdb做磁盘心跳检查。

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture%E6%9E%B6%E6%9E%84)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

#### 5.2.1 数据结构

- ycs盘中资源block的结构


```
typedef struct StYcsNodeResCtrl{
    YcsHealthCheck healthCheck;
    CodUint8  isInited;
    CodUint8  isOpen;    // 0: close; 1: open
    CodUint8  isFenced;   // 0: IO not fenced; 1: IO fenced
    CodUint8  unuse;
    CodDate   startTime;   // datetime when start ycs resource instance
    CodDate   stopTime;   // datetime when stop ycs resource instance
    CodDate   fenceTime;   // datetime when self is fenced
    CodUint32  writeIONum;  // ongoing write IO request
    YcsVoteInfo voteInfo;
} YcsNodeResCtrl;
```

  


#### 5.2.2 流程设计

- ### YCS客户端在途IO保护设计


db启动与YCS握手成功后依次启动拓扑线程ycscProc和磁盘心跳线程ycscDiskHBProc，其中磁盘心跳线程具备读写votingdisk、感知在途IO、IO fence和异常退出的能力。

![](https://pingcode.yasdb.com/atlas/files/public/67396c6b8970c2af4f520c0b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFJQUFBQUFBQUFBQVFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBSUFBQUFBQUFBQUFBQUFBSUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUVBQUFBQUFBQ0FKQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2OTAsImV4cCI6MTc4MjMxMTQ5MH0.RWut2rSMkqn2Hp9Vz3GV8s4M8Vs2UwPzgU5EA297zOY)

  


YCS客户端两个线程（其中ycscDiskHBProc为新增线程）的工作流程如下图：

1. ycscProc为旧有线程，主要负责定时发送网络消息从服务端获取  **topo**  并在获取失败时尝试重连，并对网络心跳的超时和服务端进程健康做  **检查**  ；
1. ycscProc在检查到与服务端网络心跳超时或服务端进程异常时通过context上的  **needFence标记**  通知ycscDiskHBProc做IO fence和异常退出；
1. ycscDiskHBProc为  **新增**  线程，主要负责定时往votingdisk写入  **磁盘心跳**  ，维护IO fence标记和在途IO数；
1. ycscDiskHBProc在感知到needFence或者通过读盘感知到所在节点已被踢出集群时均会走入IO fence和  **异常退出**  的流程，在流程中以更高的频率刷新  **在途IO数**  ，并在在途IO清除时abort；


![](https://pingcode.yasdb.com/atlas/files/public/67396c6ba1ad9a3311dc8a79/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFJQUFBQUFBQUFBQVFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBSUFBQUFBQUFBQUFBQUFBSUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUVBQUFBQUFBQ0FKQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2OTAsImV4cCI6MTc4MjMxMTQ5MH0.RWut2rSMkqn2Hp9Vz3GV8s4M8Vs2UwPzgU5EA297zOY)

注意事项：

1. db abort后，可以通过ycsctl尝试拉起，但若故障尚未恢复，db仍会abort
1. db abort后，如果YCS感知到异常进行重启，要保证yasdb自动被拉起
1. db fence后无法在线解除fence，需要YCS故障恢复后重新拉起db才能解除fence


  


- ### YCS服务端在途IO保护设计


  


#### YCS磁盘心跳监控线程

磁盘心跳监控线程除了会检测YCS层的磁盘心跳故障外，还会对孤儿db和主db的磁盘心跳做持续的检测，以确保更新yasdbMap和给yasdb选主时无在途IO写坏磁盘；

![](https://pingcode.yasdb.com/atlas/files/public/67396c6ba1ad9a3311dc8a7a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFJQUFBQUFBQUFBQVFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBSUFBQUFBQUFBQUFBQUFBSUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUVBQUFBQUFBQ0FKQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2OTAsImV4cCI6MTc4MjMxMTQ5MH0.RWut2rSMkqn2Hp9Vz3GV8s4M8Vs2UwPzgU5EA297zOY)

  


#### yasdb拓扑更新

![](https://pingcode.yasdb.com/atlas/files/public/67396c6ba1ad9a3311dc8a7b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFJQUFBQUFBQUFBQVFBQUFBQVFBQWdBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUJBQUFCQUFBQUFBSUFBQUFBQUFBQUFBQUFBSUFBQUFBSUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBUUVBQUFBQUFBQ0FKQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2OTAsImV4cCI6MTc4MjMxMTQ5MH0.RWut2rSMkqn2Hp9Vz3GV8s4M8Vs2UwPzgU5EA297zOY)

- OFFLINE到ONLINE： YCS主节点收到YCS备节点发来的资源状态消息，通知该节点已经启动DB时；
- ONLINE到OFFLINE： YCS主节点收到YCS备节点发来的资源状态消息，通知该节点确保DB已经停止时；
- ONLINE到ORPHAN： YCS主节点感知到YCS备节点已异常退出（或备节点感知到主节点磁盘心跳超时），仅将该异常节点的YCS和YFS设为OFFLINE，DB的拓扑状态暂不更新，并持续检查异常节点的DB磁盘心跳；
- ORPHAN到OFFLINE：YCS主节点检查orphan DB的磁盘心跳确认已无在途或磁盘心跳超时，更新yasdbMap和topo version；


注：

1. ORPHAN是新增的概念性的中间状态，意指某节点YCS已经异常离线而DB进程无人看护且可能存在在途IO，  该状态于DB是透明的无需感知和处理；
1. 若DB处于ORPHAN状态，该节点YCS异常恢复重新加入集群时会向主节点通知资源状态并完成DB拓扑状态更新和DB选主；


  


#### yasdb选主

YCS需要给DB选新主的场景包括：

|场景|处理流程|预期结果|
|---|---|---|
|YCS新主升主时|新主dosurvive时刷新集群节点状态和YCS主，必要时给db选新主，若旧主存在在途IO，暂选255为db主|db主要么是孤儿db，要么选255为db主，要么是健康节点的正常db|
|YCS主节点收到备节点发来的DB下线消息|若该下线db是主，则直接给db选新主|由备YCS来保证旧db主真的下线，因此不考虑在途IO|
|YCS备节点异常，备节点的db是主，db主正常|备节点被踢出集群，topo不会立刻将旧db主置为offline，,旧db主会感知到ycs进程异常，并进行io fence，待在途io清除后写CLOSE心跳然后abort,待磁盘心跳监控线程做检查后再更新topo|topo会在一段时间后更新，并完成db选主|
|YCS主节点和主db同时异常|备节点会同步检查YCS主和db主的磁盘心跳，待超时后更新topo并发起选举|对YCS主节点的磁盘心跳检查与在途IO保护基本并行，不延长RTO时间；,新YCS主节点升主后会完成db选主|
|YCS主节点异常，主节点的db是主，db主正常|db主会感知到ycs进程异常（10秒），并进行io fence，待在途io清除后写CLOSE心跳然后abort,备YCS会检查主YCS的磁盘心跳，待超时后完成选举，产生YCS新主,YCS新主无法立即给db选主，待旧db主在途IO清除后给db选主|YCS新主无法立即给db选主，待旧db主在途IO清除后给db选主|
|YCS主节点正在检查旧db主的磁盘心跳时旧db主想要启动|该旧db主所在YCS节点会给YCS主节点发一条“旧db主请求启动”的消息，主YCS处理该消息时会立即更新topo并选新db主|如存在其他db，则旧db主被kill再立即拉起一定不会成为主|


  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx%E8%AE%BE%E8%AE%A1)  

1、补充故障点

2、等待在途IO 清零、执行/恢复 IO、abort时要有日志记录

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- yasdb被驱逐，设置在途IO不为0故障点（不超时），预期结果：被驱逐节点等待在途IO清零，io fence被执行；幸存节点等待被驱逐节点在途IO清零，通过ycsctl status观察Topo，仍然是旧的Topo；取消故障点后，通过ycsctl status观察Topo，显示新的topo
- yasdb被驱逐，设置在途IO为0的故障点，预期结果：yasdb abort；通过ycsctl status观察Topo，显示新的topo
- 集群正常，构造业务，预期结果：yasdb磁盘心跳线程正常写磁盘心跳，通过ycsycrdump工具观察，在途IO有变化，心跳号递增，业务结束后在途IO为0
- 设置ycs node离线故障点，预期结果：io fence被执行，业务无法进行IO操作；清除故障点，io fence被取消，业务正常执行
- yasdb被驱逐，设置在途IO不为0故障点直至超时，预期结果：被驱逐节点等待在途IO清零，io fence被执行；幸存节点等待被驱逐节点在途IO清零，通过ycsctl status观察Topo，仍然是旧的Topo；超时后，查看Topo，这时会显示新的Topo


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

doc/产品文档/共享集群/集群数据库高可用/集群服务高可用.md 中关于 IO Fence的描述要进行修改

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## 9    [. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=130147446#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

### 9    [.1 AR划分及工作量估算](https://conf.yasdb.com/pages/viewpage.action?pageId=130147446#81-ar%E5%88%92%E5%88%86%E5%8F%8A%E5%B7%A5%E4%BD%9C%E9%87%8F%E4%BC%B0%E7%AE%97)  

|AR|代码行评估|工作量评估|备注|
|:---|:---|:---|:---|
|网络心跳+磁盘心跳+资源监控|  
|2人天|  
|
|ycsc监控+ycsc心跳|  
|2人天|  
|
|iofence|  
|2人天|  
|


  


  


## Attachments:

[image2023-10-25_15-21-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjc4OTcwYzJhZjRmNTIwYmViIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.wkIEWT_Po5gAd05sCpuMuI2Yv8eRXm3yjPGjo7MSNPI)

 (image/png)    


[image2023-10-23_20-57-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjc4OTcwYzJhZjRmNTIwYmVjIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.-kG-RDAWnAcR-kysXgHNAi_DXxQY6Btv7fe_OGeDME4)

 (image/png)    


[image2023-10-17_16-57-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjc4OTcwYzJhZjRmNTIwYmVkIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.9t_yW-FG_Rrh5L_qpZ96ANhYm55TUZUz7e9bOK9FQqU)

 (image/png)    


[image2023-10-16_10-1-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjc4OTcwYzJhZjRmNTIwYmVlIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.uEBxG5fW_-o7POzyzIQkpNpcAIXyB16OO4v25ipzrSw)

 (image/png)    


[image2023-10-16_10-1-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmVmIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.n4v5TnpOuYLMYqXuIEnrcEElpk28Q_cA9wEqZc-u6Q8)

 (image/png)    


[image2023-10-13_18-8-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmYwIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.bns8RP_4UxhE4m-q8d7H3mgf81dxpsStIzyPmuPTXTQ)

 (image/png)    


[image2023-10-13_18-5-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTVjIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.AFr1sPApAjPDnlzT49TWiM78uKz7vwJANKD-h1mYo_c)

 (image/png)    


[image2023-10-12_16-20-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmYxIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.unTF1AZjOPaIyORT0w_aZ-V9QoT8glRsU4KM3ol1zv0)

 (image/png)    


[image2023-10-11_17-51-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTVkIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.Qr4FSTFErvzrIkgKei_IY8ucmDvRYaDw81CpcmIFeWk)

 (image/png)    


[image2023-10-11_16-56-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmYyIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.bI28NcOkfmiqA4kjotbDWbz6IrdQPWdHGl3h2iVaeuY)

 (image/png)    


[image2023-10-11_15-24-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTVmIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.O007Q6MFfDofGiUDo4WI-CafoZafBgEV7RSlb9_5w3k)

 (image/png)    


[image2023-10-11_11-59-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmYzIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.r5uCKKZ9TzI0c2EBhef3WUgTxIKMfmOBhjU0TCotu4U)

 (image/png)    


[image2023-10-11_11-3-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTYwIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.5e2-hLWxy44k1m37sX9wil80oal8hOWmUFwZQWrQjug)

 (image/png)    


[image2023-10-11_10-56-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTYxIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.1B4w5I5LqdkFwy0v4hbcr1eGQV1swS3LUEXWKdQrofU)

 (image/png)    


[image2023-10-10_20-41-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTYyIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.bqBK3-Ox4Ga9ptDZz1fFRLLL-MV3gDUrwFf0DZp1moM)

 (image/png)    


[image2023-10-10_20-28-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmY0IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.xQZGU4YUcUlvFRk5wrZAO3BNN8aLzmaom4v9wlSjijQ)

 (image/png)    


[image2023-10-10_20-18-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTYzIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.8C7YYkfoU1iSF0PXFfiDRtXZ6mkeERDbg_WTU0gyDlA)

 (image/png)    


[image2023-10-10_20-18-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTY0IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.JWFKpLCJENfTLF82-ZyKiEGsLtSdNegy_wg0V3aXWhA)

 (image/png)    


[image2023-10-10_20-2-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmY1IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.9t2x8SpcCvAuB9GNp0mfnsrzaa88ghMa87AylxdHvDA)

 (image/png)    


[image2023-7-10_22-41-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmY2IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.gPRf7PfBxyzKccDd8WE9RyJH8H77Nx03j7q0awvWiS4)

 (image/png)    


[image2023-7-8_11-39-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjhhMWFkOWEzMzExZGM4YTY1IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.NG6MrsYAyiswnvkTuf6B1ikE-2JoA0SAiU5CORbzcYo)

 (image/png)    


[image2023-7-8_11-29-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjg4OTcwYzJhZjRmNTIwYmY3IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.6NRvNQaADIrkmtDjB0w5RM4d4JzV0EAQDbtGZYvPImg)

 (image/png)    


[image2023-7-8_11-29-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTY3IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.ONlA-G_j1eEbhH-c0fB30gD2MHtDNIC1DzdlqPVqRCg)

 (image/png)    


[image2023-7-8_10-58-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmY4IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.vcUgVp600wy8exNp-_5NXrocYexUwEARalvpnvshskk)

 (image/png)    


[image2023-5-15_10-20-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmY5IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.zNJi1IVzhc2C-DxM7YoAH81s12S037pQQ0j2bHoL-YI)

 (image/png)    


[image2023-5-8_21-27-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTY4IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.0VOJxVvJ5_ufdkD4H7YOskxsnkq9js4NCAORI4crtUY)

 (image/png)    


[image2023-5-8_21-20-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTY5IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.KTllmy1_DW5pBzGuwoNNitpEt3hCzuJrkzkfzs17Fts)

 (image/png)    


[image2023-5-8_21-17-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmZhIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.ARemNfItj-0N2fTxEeZrqMSaCyVptuOY4LAGxxyxfOk)

 (image/png)    


[image2023-5-8_21-12-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmZiIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.87bzi34RlHpp3Du-DVC1EzDePcbJu73kKyfbSz7H48M)

 (image/png)    


[image2023-5-5_21-55-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTZhIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.BIp57rqMU-s7dgw-DzCV6GBxEiAw245yNAMoq7rPlEI)

 (image/png)    


[image2023-5-5_21-37-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmZjIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.ZTMznJ4Sm9tHGF8oCyxIpVx_GP2wFZyVVdf9W-iqVtk)

 (image/png)    


[image2023-5-5_21-33-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTZiIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.lz-HdnIlKcjp9c3Gifx-4f2dDuquZX9MUBN0eBtUOjU)

 (image/png)    


[image2023-5-5_21-32-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmZkIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.2PYyyj4J6QXKgkadcGJ6oJwcuxZBGa39R7cmr-jY40I)

 (image/png)    


[image2023-5-5_20-45-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTZjIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.tCaoJBw859avc0COY4NkfsxqW2ms20WuuYFLkrgVpMw)

 (image/png)    


[image2023-5-5_16-41-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmZlIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.x20m23u73cSrruY0RacjJzNDt8wmYG_o8TLQZ_JYCx4)

 (image/png)    


[image2023-5-5_14-57-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTZkIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.7t9gwGDubZIL9oegJa0-7iwMwJsr-JSEMGOtSw1aIjY)

 (image/png)    


[image2023-5-5_14-40-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjk4OTcwYzJhZjRmNTIwYmZmIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.2FvbGYL7Gsx5lh1Z0V2xnk3Cpvi20kIpbLpF2RtgMWE)

 (image/png)    


[image2023-4-26_11-42-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTZlIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.MfZDPpSXVGQKxzKhKKDbtGjXr2jVGtg9MElBm9wCgSs)

 (image/png)    


[image2023-4-26_11-41-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjlhMWFkOWEzMzExZGM4YTZmIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.3hULbVJDbOgoADw22C5bV4immErRY8lzdLDqwo_R9Qc)

 (image/png)    


[image2023-4-26_11-37-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmFhMWFkOWEzMzExZGM4YTcwIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.89excRZvdY6bJeOZ5ou3Wtukd-4q94qSfLbX50wZ7VM)

 (image/png)    


[image2023-4-26_11-34-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzAwIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.Krk3XiTC0VE1cb9bGxuV-302O30WJf9hnNLJSi7kcGE)

 (image/png)    


[image2023-4-26_11-21-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzAxIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.mKaYivS103_5ybyL9i-Q40_ZtbX9az9zJy-zJ86zUNA)

 (image/png)    


[image2023-4-25_17-38-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzAyIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.CZjK9zfQqn_dCxWFa4N0R1DGgq1BCnRRrjqDIdVymG8)

 (image/png)    


[image2023-4-25_14-37-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzAzIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.ItJA1c_JQUvAZOxU4F15GwYRcELHE5q3AMK0V3qUV9Q)

 (image/png)    


[image2023-4-25_14-32-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzA0IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.UBLTvQbXn_qpFteaut2-jhhCbTj-OcxY51qd0dHTy5Y)

 (image/png)    


[image2023-4-25_10-44-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzA1IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.fFZVKL-11XluZukDTn2JE2dwlC9YX4wXKfjDAKDO1Eg)

 (image/png)    


[image2023-4-25_10-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmFhMWFkOWEzMzExZGM4YTcxIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.PFVak6gTLzC-y60GZ8nQ0ngrSQX1ovPr1KnKbOolLdA)

 (image/png)    


[image2023-4-24_21-7-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmFhMWFkOWEzMzExZGM4YTcyIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.ZB8TFgPGbr7_XExU5Ao_DzbmGp-8mx5fzj_Sd5ceWzg)

 (image/png)    


[image2023-4-24_20-37-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmFhMWFkOWEzMzExZGM4YTczIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.bzE0ZBr_ig-gtWjRxnTykvgoN_iqCz2mgjWPdumpwcY)

 (image/png)    


[image2023-4-24_20-29-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmFhMWFkOWEzMzExZGM4YTc0IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.AUT9r3aEMGI8YPqu1cESNsZJkTOFpHOHaufmfWv-Nuo)

 (image/png)    


[image2023-4-24_19-23-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzA2IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.cA01BUhe4RWQ70ET_Rhtb_gFlvZuu79FDDcDIIMEiBU)

 (image/png)    


[image2023-4-24_18-46-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzA3IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.TqbGVpvEXhi8XCqvFwoDPw63a1CpdrqxWek0jL46KZA)

 (image/png)    


[image2023-4-24_17-1-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzA4IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.b7BNn7w-h3XIEmQ1LfqIZGxBus4reOLoYRPiMjQXLLo)

 (image/png)    


[image2023-4-23_20-4-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmFhMWFkOWEzMzExZGM4YTc1IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.VG_FwsbJ0eyccysMkvPRUH1ArOIqMG9RqnFkyWu9vnc)

 (image/png)    


[image2024-1-19_12-1-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmE4OTcwYzJhZjRmNTIwYzA5IiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.5siJRGVogVixbCBokmbQyZ2DchYFsBq6XLXetD9mMf8)

 (image/png)    


[磁盘心跳监控线程.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmI4OTcwYzJhZjRmNTIwYzBhIiwicmVmX2lkIjoiNjczOTZjNjc3MjgyMDZlZmI5MmYxMWY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjkwLCJleHAiOjE3ODIzODcwOTB9.pkbsfyE6vwtAPrxQgn9dzczNIbaDSfxskhG-XsgycUY)

 (image/png)    


## Comments:

|  [](null)  ,1. 如果在途io有比较多的时候，这个failover处理就会比较长，很影响RTO的时间
,Posted by lijing at 十一月 06, 2023 11:40|
|---|
|  [](null)  ,升主的那个节点，有超时时间，30s，这个  failover不会随着在途io的增加而线程增长的，确实会影响RTO时间,Posted by liyin at 十一月 14, 2023 11:53|
|  [](null)  ,1. 在途IO保护——保护被踢出集群的节点的在途IO
1. ycs被kill后马上拉起来，db不abort
1. 距离上一次写入磁盘心跳已超过超时时间的话也需要iofence
,Posted by chenjunjie at 一月 22, 2024 16:28|
