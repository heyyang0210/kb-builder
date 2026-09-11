Created by 杜宇轩, last modified by  李垠 on 十一月 08, 2024

## 共享集群的工具支持并发读设计方案

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#1-overview%E6%A6%82%E8%BF%B0)  

【共享集群】启停节点，启停资源，以及查询拓扑状态

ycsctl工具已支持提供启动、停止yfs、yasdb的功能且支持  提供查询拓扑状态yfs、yasdb拓扑状态的功能。

但  客户端不支持并发操作，需要修改代码逻辑使得可以接受并发查询，修改状态（启停）操作还是需要加锁串行。    


且错误码处理方面因为之前比较粗糙，可能也需要整改。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

  [崖山集群服务ycs方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=100098993)    中的command line客户端部分。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#3-interfaces%E6%8E%A5%E5%8F%A3)  

Ycs对外提供命令字接口，供用户使用。

ycsctl start ycs--启动ycs服务，会同时启动数据库资源

ycsctl stop ycs--停止ycs服务

ycsctl start instance--启动ycs所管理的实例资源（这个管理的资源也就是数据库，需要在配置文件中注册，后续介绍）

ycsctl stop instance--停止ycs所管理的实例资源

ycsctl     status--打印集群topo

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

暂定并发上限是10个，超出就报错。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#51-architecture%E6%9E%B6%E6%9E%84)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

#### 5.1.1 旧的架构以及弊端

1. 现有的ycsctl工具与server通信主要是靠发消息的时候请求的ID为COD_INVALID_ID8来识别。这点相当于是约定的内部逻辑，算是临时方案，不利于维护也不利于理解。
1. 现有的并发控制主要靠resourceItem上的inProcess标志位来判断。所以现在就是一刀切的模式，这样不利于并发读（即查询拓扑状态）。所有的命令都是同一时间只能执行一条。考虑对写操作加并发控制（加锁控制串行），对读操作不做控制。
1. 目前的并发控制在握手阶段完成，同时instance上只能维护一个ycsctlItem，所以不能同时维护多个连接。理论上的并发控制应该在ycsProcessIpcMessage里更合适一些。


#### 5.1.2 新的架构以及好处

1. 需要给握手的request结构体里加一个客户端类型的字段，比如clientType，取值是resource或者ycsctl。这样在ycsTryAcceptResource里就可以通过这个字段来判断，而不需要用COD_INVALID_ID8的隐藏逻辑。
1. 在Instance上单独维护一个ycsItems数组，专门用于维护ycsctl的连接的相关信息，这样就能同时处理多个工具的连接，同时维护多份信息。
1. 并发的控制不在握手时，而在执行时，即ycsProcessIpcMessage里面。这样的好处是握手不负责执行层的逻辑，只负责记录和维护连接的信息。有利于逻辑的解耦。
1. 给新定义的YcsctrlItem和resourceItem定义一个Union，和clientType组合成一个结构体。这样的好处是在ycsTryAcceptResource里就不用把代码根据type类型做分支判断，代码看起来可以更加整洁清爽，也便于管理。


###   [5.2 Data Structures & Flow（数据结构与流程）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

*设计主要数据结构、工作流程、序列图等。*

#### 5.2.1 现有的工具消息处理流程

  ` `  

1. 服务端在启动的时候自己会起一个后台监听线程，函数ycsStartResourceLsnr。
1. 客户端在发握手请求的时候，服务端就能监听到这个消息。接受到消息就启动一个处理消息的ycsIpcService线程。
1. 目前服务端接受到消息的状态是唯一的布尔值inProcess，即无论收到什么消息的握手请求，都会把inProcess布尔值置为true，并且设置唯一在instance上的ycsctrlItem，再在ycsIpcService线程处理完了之后改回false。


  
  这样的问题就会导致不论是读（查询拓扑）的消息请求还是写（改变状态启停）的请求都会上锁。instance上只能同时维护一份ycsctl的握手信息。弊端就是读请求无法并发进行。

####   
  5.2.2 期望的工具消息处理流程

1. RES_CMD_START_RES、RES_CMD_STOP_RES、RES_CMD_STOP_YCS加锁串行执行，拓扑打印能并发执行。该并发逻辑在ycsProcessIpcMessage里实现。
1. 服务端能同时接收多个ycsctl的连接请求并维护这份数据，目前暂定这个连接上限是10。
1. 接2，YcsInstance上定义YcsctrlItem ycsItems[YCS_TOOL_MAX_CONNS]，用于维护ycsctl的连接信息。


对比图：

![](https://pingcode.yasdb.com/atlas/files/public/67396b128970c2af4f52013a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3ODMsImV4cCI6MTc4MjMwMTU4M30.eJddikwBezUofQsYDC-u-fDZGSaO5HS84oqZAId7GvM)

#### 5.2.3 具体调整设计方案

##### 5.2.3.1 背景

1. 因为握手阶段需要判断resourceitem的id。原本ycsctl的都是Invalid值作为判断，没有消息类型的枚举承载，相当于是一个默认逻辑。
1. 原本ycsctl工具的并发控制在握手阶段做，同时只能在Instance上维护一个握手信息，工具消息只能串行执行。


##### 5.2.3.2 解决方案

1. 在客户端发送握手的request的时候就增加一个字段clientType，取值是resource或者ycsctl。
1. 在Instance上单独维护一个ycsItems数组，专门用于维护ycsctl的连接的相关信息。
1. 新定义的YcsctrlItem和resourceItem定义一个Union，和clientType组合成一个结构体。作为记录连接的信息使用和维护。


##### 5.2.3.3 主要数据结构设计

```
typedef enum EnYcsClientType {
YCS_CLIENT_RESOURCE = 0, // type resource for shaking
YCS_CLIENT_YCSCTL = 1, // type ycsctl for shaking
} YcsClientType;



typedef struct StYcsctlItem {
SpinLock lock;
volatile CodBool inProcess;
volatile CodBool isWrite;
YcsContext context;

// for ipc resource
CodThread thread;
ResourceIpc ipc;
volatile CodUint64 recvTicks; // ticks of the last packet recv
} YcsctlItem;



typedef struct StIpcItem {
    CodUint8 clientType;
    union {
        YcsctlItem*   ycsctlItem;
        ResourceItem* resourceItem;
    };
} IpcItem;

typedef struct StYcsInstance {
    SpinLock          lock;
    YcsProfile        profile;
    volatile CodBool  close;
    volatile CodUint8 resTarget;       // target status of resources
    volatile CodBool  needNotifyTopoChange;
    volatile CodBool  inspect;
    ResourceItem      resItems[YCS_MAX_RESOURCES];
    YcsctlItem        ycsctrlItems[YCS_TOOL_MAX_CONNS];         // for ycsctl tool
    YcsClusterMngr*   clusterMngr;
    volatile CodUint8 exceptions[__YCSE_COUNT__];
    YcsWaitRoom       rooms[YCS_WAIT_ROOM_NUM];
    IpcLsnr           lsnr;
    CodThreadManager  threadM;
    CodTimer          timer;
} YcsInstance;
```

##### 5.2.3.4 并发控制的办法

1. 有ycsctl的消息来的时候，遍历一遍instance上的ycsItems数组，如果有的inProcess不为true，则拿到其下标，否则报错超过最大连接数。读写的时候加instance上的大锁。
1. 通过拿到数组下标的方式，将定义的指针挂在instance的数组对应下标的地址上。
1. 在处理消息时，如果进行写操作，则先遍历一遍数组看是否没有地方的isWrite为true，如果有则等待，没有则把当前消息的isWrite改为true。
1. 消息处理结束的话，把isWrite和inProcess都改为false。


##### 5.2.3.5 优点

1. 可以维护多个ycsctl工具的连接信息，实现并发。
1. 可以用单独的数据结构记录ycsctl工具的连接信息，少记录冗杂的信息。
1. 并发控制从握手后移到消息处理，更符合逻辑。


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

1.多并发的读，成功

2.写的时候多并发的读，成功

3.多并发写的同时多并发的读，写等待，读成功

4.并发数超过10的读/写，超出的并发报错

  `  

`  

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量3（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72803535#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments: