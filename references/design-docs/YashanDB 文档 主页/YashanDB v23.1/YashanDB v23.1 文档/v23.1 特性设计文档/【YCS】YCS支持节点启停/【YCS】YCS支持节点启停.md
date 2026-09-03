Created by 陈步隆, last modified by  李垠 on 十一月 08, 2024

#   [YDBRD-13464 : 支持启停YCS节点方案设计](#ydbrd-13464--支持启停ycs节点方案设计)  

IR链接：    [YDBRD-12106](https://jira.yasdb.com/browse/YDBRD-12106)     / SR链接：    [YDBRD-13464](https://jira.yasdb.com/browse/YDBRD-13464)  

##   [1. Overview（概述）](#1-overview概述)  

崖山集群服务（后续简称YCS）负责管理共享集群数据库，包括：集群节点管理，节点的加入退出，故障仲裁；集群资源管理，例如数据库、文件系统、浮动IP（技术项目阶段暂不支持）等等，维护资源依赖关系，启停、监控节点上的资源，并提供查询节点资源拓扑的接口能力方便被管理资源根据拓扑信息进行集群重组。

参考：

1. 
1.   [崖山集群服务ycs方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=100098993)  


##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|YCS进程启动|通过命令行拉起YCS进程|客户端工具进程直接启动YCS进程|
|YCS进程停止|通过命令行停止YCS进程|客户端工具发送停止命令到YCS服务端，服务端自行停止|
|YCS集群初始化|启动流程自动触发|首个启动节点对投票盘进行初始化|
|YCS节点加入集群|启动流程自动触发|主节点正常启动及备节点向主节点申请加入集群|
|YCS节点退出集群|退出流程自动触发|备节点退出集群|
|YCS节点主备切换|退出流程自动触发|主节点先转移主角色再退出集群|
|YCS topo状态查看|通过命令查看topo状态|客户端工具从服务端获取topo信息并展示|


##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 工具命令](#31-工具命令)  

####   [3.1.1 ycsctl启动节点](#311-ycsctl启动节点)  

- 命令行    `ycsctl start ycs`  


####   [3.1.2 ycsctl停止节点](#312-ycsctl停止节点)  

- 命令行    `ycsctl start ycs`  


####   [3.1.3 ycsctl查看topo信息](#313-ycsctl查看topo信息)  

- 命令行    `ycsctl status`  


###   [3.2 客户端工具协议接口](#32-客户端工具协议接口)  

略

###   [3.3 客户端资源协议接口](#33-客户端资源协议接口)  

1. 资源加入
1. 资源退出
1. 资源切换
1. 获取Topo信息


>   【注】客户端资源协议接口对用户不可见，属内部接口  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1. 目前只支持2节点
    1. 基于2节点进行加固补充
    1. 多节点支持功能跟当前持平
1. 异常场景不支持
    1. 节点异常退出、磁阵异常、网络异常等异常场景不支持
    1. 正常的并发、错误处理需要处理
1. 不支持带DB并发启停
1. 不带DB支持两节点并发启停，不支持三节点及以上并发启停
1. 暂不支持告警日志


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

######   [原实例架构图](#原实例架构图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7f98/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

######   [实例架构图](#实例架构图)  

对原架构有一定调整

1. 将YFS直接当做内嵌模块
1. 引入ICS作为内部通讯框架


![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f520123/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

>   【注】YCS现有内部通讯在可靠性上欠缺较多，而且功能跟ICS大部分重合，考虑直接引入ICS作为内部通讯基础。  

####   [5.1.1 集群管理](#511-集群管理)  

#####   [5.1.1.1 节点内部状态](#5111-节点内部状态)  

节点内部状态方便节点内部实例管理时，对并发操作、启停流程等

######   [原节点内部状态](#原节点内部状态)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7f99/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

######   [节点内部状态](#节点内部状态)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f520125/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

|原状态|新状态|状态说明|变化说明|备注|
|---|---|---|---|---|
|Idle|Idle|起始状态或退出状态|不变|节点退出流程可能会有其他状态直接到Idle的场景，可能还要再梳理一下|
|Ready|Primary|主节点正常工作状态|将Ready状态按主、备进行分拆|使用Primary/Standby表示主、备，一是要跟单机、分布式对齐，二是避免使用Master/Slave等敏感词汇|
|Ready|Standby|备节点正常工作状态|同上||
|NodeJoin|N/A|有节点正加入集群|删除，直接在Primary状态下完成|原NodeJoin状态，主要是为了避免新节点加入过程中异常，导致集群重组|
|TackeOver|TakeOver|备节点发现主节点异常时，尝试升级为主|不变|仅适用2节点集群|
|StandAlone|StandAlone|主节点发现备节点异常时，尝试独立运行|不变|仅适用2节点集群|
|N/A|Vote|集群出现节点异常，整个集群进行选主仲裁阶段|增加|适用3节点以上集群|


#####   [5.1.1.2 节点对外状态](#5112-节点对外状态)  

|状态|说明|
|---|---|
|Online|节点对外可用|
|Offline|节点对外不可用|


#####   [5.1.1.3 并发控制](#5113-并发控制)  

集群管理的操作目前有两个源头，一个是通过命令工具的启停命令间接触发，一个是节点间的加入集群、退出集群、switchover等内部命令触发。本来就是不同处理线程在处理，来自不同节点的内部命令之间也存在并发。在关键操作流程中，需要使用锁进行隔离。

######   [集群管理并发控制设计原则](#集群管理并发控制设计原则)  

- 进程内部的对集群变更的操作并发使用线程锁隔离，避免lockDisk直接并发
- lockDisk只考虑进程间的并发
- 内存数据读写并发使用spinlock


####   [5.1.1.4 YCS实例状态](#5114-ycs实例状态)  



|状态|说明|
|---|---|
|Initing|YCS实例初始化过程中|
|Inited|YCS 实例初始化完成|
|Starting|YCS实例启动过程中|
|Started|YCS实例启动完成|
|Stopping|YCS实例停止过程中|
|Stopped|YCS实例停止完成|


####   [5.1.2 实例模块](#512-实例模块)  

#####   [5.1.2.1 配置信息](#5121-配置信息)  

- VOTING_DISK 投票盘配置信息
- YCR_DISK YCR磁盘配置信息
- _HOSTNAME 主机名
- LOG_LEVEL 运行日志级别划分


#####   [5.1.2.2 线程](#5122-线程)  

####   [5.1.2.3 YCS实例模块化](#5123-ycs实例模块化)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7f9a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

1. 基础模块
1.     - 日志模块（Log）：提供基础的日志能力
    - 定时模块(CodTimer)：定时模块
    - ICS网络模块(ICS)：提供基础的通信能力
    - 线程管理模块(CodThreadM)：提供基础的线程分配能力
    - 磁盘模块(CodDisk)：提供基础的磁盘读写能力

1. 业务模块
1.     - 监控模块（Monitor）：提供监控资源，节点的能力
    - 集群管理模块（Cluster）: 提供节点管理的能力
    - 内部业务处理模块(InnerService)：提供内部业务逻辑处理能力
    - 资源模块(Resource)：提供内嵌资源以及外部资源的启停，topo查询的能力

1. 接口层
1.     - 对应工具接口（YcsCtrlInterface）: 对应外部工具需求，提供相应的接口，例如：topo 查询，启停节点等
    - 内部业务交互接口（InnerInterface）: 外应内部业务消息交互接口：例如：心跳，topo同步等



####   [5.1.3 并发控制](#513-并发控制)  

#####   [5.1.3.1 并发控制原则](#5131-并发控制原则)  

- 并发保护使用适当的加锁方式，避免全局大锁，避免不同模块之间嵌套加锁
- 各模块拥有单一职责，即只关注自身的功能，模块内部对自身流程做并发控制
- 加锁访问范围尽量小，避免将设置错误码、写日志等无需锁保护的操作也放到锁内


####   [5.1.4 客户端通讯管理](#514-客户端通讯管理)  

略（暂不作调整）

####   [5.1.5 内部通讯管理](#515-内部通讯管理)  

#####   [5.1.5.1 ICS内部通讯服务](#5151-ics内部通讯服务)  

引入ICS内部通讯服务模块，将网络通讯从业务流程中解耦出来。    [ICS设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91779093)  

######   [ICS相关特点](#ics相关特点)  

1. 支持链路等级资源隔离，YFS、YCS各自通讯互不干扰
1. 支持单独心跳链路，避免业务处理线程卡顿等因素（例如写运行日志卡顿）影响可靠性
1. 支持整体-Node-Link三级状态展示（需要对接实现）
1. 支持异常事件上报处理，将网络问题处理尽量整合到一起
1. 内存需要适配层或业务层提供
1. 适配层需注入消息处理回调，由ICS数据接收线程直接调用
1. 建议消息处理回调函数足够轻量，避免影响接收处理效率


######   [ICS设置](#ics设置)  

1. 支持三级链路等级，每个等级一个链路
    1. 心跳链路（ICS内置）
    1. YCS链路
    1. 资源链路（YFS）
1. 设置心跳超时时间为6秒（3秒一个检测周期，2个周期没有心跳则判断超时）
1. 设置每次启动都会自增的版本号，通过网络能感知节点异常重启场景


######   [启动版本号](#启动版本号)  

在投票盘的NodeCtrl里，增加16位的启动版本号，每次启动都自增1

#####   [5.1.5.2 ICS适配层](#5152-ics适配层)  

1. 改造原有收发接口，底层替换为ICS
1. 网络接收回调
    1. 接收到内部命令后，直接在ICS接收线程里处理（方案待定）
    1. 回应等待直接对接现有WaitRoom


######   [内部命令处理选型对比](#内部命令处理选型对比)  

|对比项|方案一|方案二|备注|
|---|---|---|---|
|方案内容|接收到内部命令后，直接在ICS接收线程里处理|接收到内部命令后，通过消息队列转交Worker线程处理||
|所需基础能力|基本不需要|需要引入消息队列，Worker池或单个Worker线程||
|消息处理方式|同步|同步、异步结合（轻量消息同步处理，重操作异步处理）||
|优点|简单|重操作不会阻塞网络线程，对于需要网络交互的命令比较好处理，容易并发||


#####   [5.1.5.3 网络事件处理](#5153-网络事件处理)  

|网络事件|网络事件处理|备注|
|---|---|---|
|连接事件|无需处理||
|断连事件|抛出YCSE_INTER_CHANNEL_CLOSED异常|同当前处理|
|重连事件|无需处理||
|重启事件|节点重启处理|处理行为待梳理|


#####   [5.1.5.4 通讯协议](#5154-通讯协议)  

略（暂不作调整）

#####   [5.1.5.5 网络可靠性设计](#5155-网络可靠性设计)  

1. 监听处理网络异常事件
1. 回应超时需要重发（暂不支持）
1. 接收端对相同消息进行过滤（暂不支持）


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1 集群管理流程](#521-集群管理流程)  

#####   [5.2.1.1 集群初始化](#5211-集群初始化)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f520126/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

######   [集群初始化并发](#集群初始化并发)  

通过磁盘锁控制并发

#####   [5.2.1.2 首节点启动](#5212-首节点启动)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7f9b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

#####   [5.2.1.3 备节点加入集群](#5213-备节点加入集群)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7f9d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

######   [启动过程中并发控制](#启动过程中并发控制)  

1. 初始化确认
    1. 先免锁确认投票盘是否初始化
    1. 并发进入后，通过磁盘锁隔离开
1. 如果节点启动过程中遇到其他节点正在做集群初始化，需要等待
1. 加入集群过程中
    1. 如果主节点回应拒绝，备节点将循环尝试
    1. 如果原主节点已经退出，备节点将尝试成为主节点（当前实现可参考后面takeover流程，不过对于3节点以上集群，这个点还需要打开看一下）


#####   [5.2.1.4 备节点退出集群](#5214-备节点退出集群)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f520128/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

#####   [5.2.1.5 主节点退出集群](#5215-主节点退出集群)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7f9f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

######   [退出集群中并发控制](#退出集群中并发控制)  

1. 客户端命令和内部消息命令处理线程并发，通过线程锁
1. 主节点switchover过程中，遇备节点正在退出，switchover未完成，投票盘中还是旧主信息
1. 备节点退出过程中，遇到主节点正在退出，状态可能没有切换到Offline，主节点启动后需要重新审视节点状态(当前缺少)


#####   [5.2.1.6 2节点集群，备节点异常](#5216-2节点集群备节点异常)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f52012a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

#####   [5.2.1.7 2节点集群，主节点异常](#5217-2节点集群主节点异常)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7fa1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

#####   [5.2.1.8 3节点以上集群，节点异常](#5218-3节点以上集群节点异常)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f52012b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f52012c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

![](https://pingcode.yasdb.com/atlas/files/public/67396b0fa1ad9a3311dc7fa2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

####   [5.2.2 启动流程](#522-启动流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f52012d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

#####   [5.2.2.1 初始化YCS各个模块资源](#5221-初始化ycs各个模块资源)  

#####   [5.2.2.1 初始化YCS各个模块资源](#5221-初始化ycs各个模块资源-1)  

1. 初始化配置项以及环境变量信息
1.     - 根据启动时获取命令行参数 -H 判断是否指定节点目录
    - 未使用-H 参数指定目录启动时，取YASCM_HOME环境变量值启动
    - 未指定节点HOME目录且未设置YACM_HOME时，启动失败，进程退出。
    - 加载配置参数
        - 通过读取YASCM_HOME下的配置文件（YASCM_HOME/config/yascs.ini），将 5.2.1.1配置信息加载到内存中
        - 加载过程中校验每个配置参数的有效性，如果校验失败，返回失败，调用YcsShutdown接口，进程退出

1. 初始化实例资源
1.     - 创建YcsInstance实例
    - 设置实例当前的状态Initing
    - 创建失败，返回失败，调用YcsShutdown接口，进程退出

1. 初始化日志模块
1.     - 通过配置文件中设置的run log日志等级，初始化日志模块
    - 日志模块初始化失败，调用YcsShutdown接口，进程退出

1. 初始化ThreadManager
1.     - 初始化ThreadManager, 若初始化失败，调用YcsShutdown接口，进程退出

1. 初始化Disk
1.     - 初始化Disk信息，若初始化失败后，调用YcsShutdown接口，进程退出

1. 初始化网络模块（ICS）
1.     - 初始化ICS失败后，若初始化失败，调用YcsShutdown接口，进程退出

1. 初始化集群管理模块（Cluster）
1.     - 初始化集群管理模块，，若初始化失败，调用YcsShutdown接口，进程退出

1. 初始化资源管理模块（Resource）
1.     - 加载YFS动态库，若加载失败，调用YcsShutdown接口，进程退出

1. 初始化监控模块（Monitor）-略
1. 设置实例状态Inited


#####   [5.2.2.2 启动YCS各个模块](#5222-启动ycs各个模块)  

1. 设置实例状态Starting
1. 启动网络模块（ICS）
1.     - 若启动ICS失败，调用YcsShutdown接口，进程退出

1. 启动集群管理模块（Cluster）
1.     - 打开共享磁盘
    - 加入集群
    - 若开启共享磁盘或者加入集群失败，调用YcsShutdown接口，进程退出

1. 启动资源模块（Resuorce）
1.     - 启动内嵌资源YFS
    - 启动外部资源YASDB
    - 若启动YFS或者YASDB失败，调用YcsShutdown接口，进程退出

1. 启动监控模块（Monitor）
1.     - 启动集群 monitor
    - 启动YFS monitor
    - 启动YASDB monitor

1. 设置YCS实例状态 Started
1. 同步topo信息


####   [5.2.3 停止流程](#523-停止流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b0f8970c2af4f52012e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFDQUFRQVFFQWdCQUlCRUFBQUFBQWdnQUVBQUFBQUFBS0FJQUFBQUFBQUFBUUNFQUFCRUFBUVFnUUFFUUNVQUNBQkFBQUFSQUFBQUFBQUJnb0VBQkFJUUVBU0JnQUVFRXhBQkJBQVFBZ0FCQUFJYWdBRUFFRUNDQUFBQUFFRUFBZ0FCQUFCQUNnQWdBQUFBQkFBQUFJQUFHQUFBQUFCQUVBZ0FBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA3MTEsImV4cCI6MTc4MjMwMTUxMX0.Ic-IyfzlJ3EfHo_NBXmD19H-GLgWW4_Lm3oG3I5V_Wo)

1. 判断YcsInstance 是否为null,为null 直接返回成功
1. 设置实例状态Stopping
1. 判断YcsInstance 状态是否为Starting或者Started
    1. 当前实例状态处于Starting或者Started
    1. 停止monitor模块
    1. 停止资源模块
    1. 停止集群管理模块
    1. 停止网络模块
1. 设置实例状态Stopped
1. 销毁监控模块（monitor）
1. 销毁资源模块（Resource）
1. 销毁集群管理模块（Cluster）
1. 销毁网络模块ICS
1. 销毁YcsInstance
1. 若进入shutdown流程时，实例状态处于Initing或者Inited状态，则设置Stopped状态后，直接从步骤５开始


####   [5.2.4 切换流程](#524-切换流程)  

  [YASCL-296](https://jira.yasdb.com/browse/YASCL-296)  

针对YASCL-296问题，在切换过程中，无论节点处于升主，降备的过程中，接收到消息时，需要返回特定的错误码，例如：ERR_YCS_UNSERVICE, 客户端收到特定错误码后，进程重试操作，超时时间设置为RTO时间。

####   [5.2.5 业务消息处理](#525-业务消息处理)  

####   [5.2.5.1 目前业务处理架构](#5251-目前业务处理架构)  

1. 目前YCS架构针对业务消息处理属于串行处理，没有并行处理业务消息的能力
1. 若一个业务消息中存在io操作，例如：磁盘读写，网络IO等操作时，可能会造成处理时间拉长，导致后续业务消息滞后处理


####   [5.2.5.2 参照分布式集群管理架构](#5252-参照分布式集群管理架构)  

1. 引入WorkPool，消息队列等基础模块，目的是提升业务消息处理能力


参考分布式集群管理设计：    [分布式集群管理](https://conf.yasdb.com/pages/viewpage.action?pageId=95110445)  

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

不涉及

###   [5.4 DFX设计](#54-dfx设计)  

####   [5.4.1 ycsctl查看状态](#541-ycsctl查看状态)  

- 命令行    `ycsctl status`  
- 选项
    - topo或空，显示topo信息
    - ics_stat，显示ics整体状态信息
    - ics_node，显示ics各节点状态信息
    - ics_link，显示ics个链路状态信息


>   【注】ics_stat/node/link选项不在SR交付范围内，仅为开发人员定位问题手段，工具触发后，先简单在运行日志里输出，正式规划后重新进行评审。  

####   [5.4.2 ycsctl动态修改配置参数](#542-ycsctl动态修改配置参数)  

- 命令行    `ycsctl set server`  
- 选项
    - run_log_level，运行日志等级，有效值：Error/Warn/Info/Debug/Trace
    - heartbeat_timeout，ycs节点间心跳超时时间（单位：秒），有效值：[6, 3600]


>   参考：    [crsctl set](https://docs.oracle.com/en/database/oracle/oracle-database/12.2/cwadd/oracle-clusterware-control-crsctl-utility-reference.html#GUID-EC9F0760-0A5C-4D9A-B04B-D6E6F43940D2)    

>   【注】该特性不在SR交付范围内，仅为开发人员定位问题手段，正式规划后重新进行评审。  

####   [5.4.3 运行日志](#543-运行日志)  

######   [运行日志级别动态调整](#运行日志级别动态调整)  

见    `ycsctl set sever run_log_level`  

>   【注】ics_stat/node/link选项不在SR交付范围内，单独的SR承载  

######   [关键信息需要记录日志](#关键信息需要记录日志)  

1. 进程启停，INFO级别
1. 线程启停，建议DEBUG级别
1. 模块启停流程，建议DEBUG级别
1. 节点状态切换


####   [5.4.4 黑匣子](#544-黑匣子)  

集成黑匣子功能，在进程crash后，可以保留当时的堆栈信息。在客户现场关闭coredump时，帮助非常大。

>   【注】暂不支持，开发、测试环境上当前目前都可以正常core下来。  

####   [5.4.5 告警日志](#545-告警日志)  

对影响正常运行的关键事件记录到告警日志中。

>   【注】暂不支持，主要通过运行日志定位查看。  

###   [5.5 AR划分及工作量估算](#55-ar划分及工作量估算)  

|AR|代码行评估|工作量评估|备注|
|---|---|---|---|
|ICS替代现有内部通讯框架||5人天||
|节点加入集群流程调整||3人天||
|节点启停流程调整||5人天||
|业务消息并发处理（引入workPool）||3人天||
|节点启停并发补充加固||4人天||


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

###   [6.1 ICS替代现有内部通讯框架](#61-ics替代现有内部通讯框架)  

|用例场景|预期|备注|
|---|---|---|
|2节点，集群拉起后停止|没有报错，查询topo信息正常||
|3节点，集群拉起后停止|没有报错，查询topo信息正常||
|集群正常运行少量ddl、dml业务|业务正常||
|集群启动，不带业务运行3分钟|没有网络异常日志|检验ICS内部心跳功能|
|集群启动，kill -9杀死备节点|心跳超时时间后，主节点感知故障并处理|查看日志|


###   [6.2 节点正常启停](#62-节点正常启停)  

|用例场景|预期|备注|
|---|---|---|
|2节点，首次启动，依次拉起|查询topo信息正常||
|2节点，集群正常运行后，停止备节点|停止正常，查询topo信息正常||
|2节点，集群正常运行后，停止备节点再拉起|停止正常，查询topo信息正常||
|2节点，集群正常运行后，反复停止备节点再拉起|查询topo信息正常||
|2节点，集群正常运行后，停止主节点|停止正常，查询topo信息正常|原备节点升级为主|
|2节点，集群正常运行后，停止主节点再拉起|停止正常，查询topo信息正常|原备节点升级为主|
|2节点，集群正常运行后，停止主节点后，再停止原备节点|停止正常||
|2节点，集群正常运行后，停止主节点后，再停止原备节点，拉起原备节点|停止正常，查询topo信息正常|投票盘上原备节点为主，原备节点升级为主|
|2节点，集群正常运行后，停止主节点后，再停止原备节点，拉起原主节点|停止正常，查询topo信息正常|投票盘上原备节点为主，原主节点重新拉起后升级为主|
|2节点，集群正常运行后，停止原备节点后，再停止原主节点|停止正常||


###   [6.3 节点异常启停](#63-节点异常启停)  

|用例场景|预期|备注|
|---|---|---|
|单节点启动|未设置YASCS_HOME,环境变量且不指定启动目录|启动报错|
|单节点启动|不创建yascs.ini|启动报错|
|单节点启动|指定启动目录为已启动的节点目录|启动报错|
|单节点启动|配置异常的ip地址|启动报错|
|单节点启动|占用配置inner_url端口后启动|启动报错|


###   [6.4 节点并发启停](#64-节点并发启停)  

|用例场景|预期|备注|
|---|---|---|
|2节点，首次启动，同时拉起两节点|没有报错，最终为一主一备形态，查询topo信息正常||
|2节点，集群正常运行后，同时停下两节点后拉起|没有报错，最终为一主一备形态，查询topo信息正常||
|2节点，集群正常运行后，停下备节点，再同时拉起原备节点和停下主节点|没有报错，最终为一主一备形态，查询topo信息正常||
|2节点，集群正常运行后，反复分别启停两个节点|没有报错，最终为一主一备形态，查询topo信息正常||


###   [6.5 带业务启停](#65-带业务启停)  

|用例场景|预期|备注|
|---|---|---|
|2节点，带业务运行，停止备节点|没有异常，查询topo信息正常||
|2节点，带业务运行，停止主节点|没有异常，查询topo信息正常||
|2节点，带业务运行，交替启停两个节点|没有异常，查询topo信息正常||
|2节点，带业务运行，反复分别启停两个节点|没有异常，查询topo信息正常||


###   [6.6 3节点正常启停](#66-3节点正常启停)  

|用例场景|预期|备注|
|---|---|---|
|3节点，首次启动，依次拉起|查询topo信息正常||
|3节点，集群正常运行后，停止备节点|停止正常，查询topo信息正常||
|3节点，集群正常运行后，停止备节点再拉起|停止正常，查询topo信息正常||
|3节点，集群正常运行后，反复停止备节点再拉起|查询topo信息正常||
|3节点，集群正常运行后，停止主节点|停止正常，查询topo信息正常|原备节点（nodeId小的）升级为主|
|3节点，集群正常运行后，停止主节点再拉起|停止正常，查询topo信息正常|原备节点（nodeId小的）升级为主|


##   [7.资料设计章节](#7资料设计章节)  

1. 配置参数文档（待确认在哪里添加）
1. 启停命令操作文档
1. 查看topo信息操作文档


##   [8. TODO（遗留问题）](#8-todo遗留问题)  

YASDB Q启停问题：    [https://jira.yasdb.com/browse/YASCL-295](https://jira.yasdb.com/browse/YASCL-295)     转需求

## Attachments:

[ycs_status2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGU4OTcwYzJhZjRmNTIwMTE2IiwicmVmX2lkIjoiNjczOTZiMGU3MjgyMDZlZmI5MmYwMTAxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzExLCJleHAiOjE3ODIzNzcxMTF9.TVveWuoR8cLb2uPKomeHl93mccdIXc7jNPwwvXX67cM)

 (image/png)    


[ycs_cluster_join.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGVhMWFkOWEzMzExZGM3ZjhmIiwicmVmX2lkIjoiNjczOTZiMGU3MjgyMDZlZmI5MmYwMTAxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzExLCJleHAiOjE3ODIzNzcxMTF9.weA8wEh9vBPmOP4MX72DVSCksH83Atqjy4Ofgl5IlJk)

 (image/png)    


[ycs_cluster_switchover.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGVhMWFkOWEzMzExZGM3ZjkzIiwicmVmX2lkIjoiNjczOTZiMGU3MjgyMDZlZmI5MmYwMTAxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzExLCJleHAiOjE3ODIzNzcxMTF9.ibkp_TBD1YaoU8EP0wMpBto-k0_s8xN7YRIkqO1cNik)

 (image/png)    


[ycs_cluster_exit.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGVhMWFkOWEzMzExZGM3Zjk0IiwicmVmX2lkIjoiNjczOTZiMGU3MjgyMDZlZmI5MmYwMTAxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzExLCJleHAiOjE3ODIzNzcxMTF9.9tC56_O_g5cACB3V_Gnz9gK9DUNO2ro2Df0Nw1y071g)

 (image/png)    


[崖山集群服务 1.1.pptx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMGU4OTcwYzJhZjRmNTIwMTFjIiwicmVmX2lkIjoiNjczOTZiMGU3MjgyMDZlZmI5MmYwMTAxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNzExLCJleHAiOjE3ODIzNzcxMTF9.Ye3lg95_RSpAGsJySguLECsOsvGwASN0FhN-MqE7Xqc)

 (application/vnd.openxmlformats-officedocument.presentationml.presentation)    


## Comments:

|  [](null)  ,1. 模块划分要与ycr中的模块划分整合。    
  2. 当前sr不考虑引入workpool等基础模块，需要后续可靠性SR承载    
  3. 关注一下YCS不处于稳态（standby,primary）,而是处于过渡状态（vote,promoting,demoting）状态时对外部请求的影响    
  4. 要实现服务端异步处理业务并发处理的能力，需要分析当前内部服务哪些需要串行处理，哪些需要允许并发处理    
  5. 需要整理支持最小范围的故障场景，提供测试可测的异常场景    
  6. YCS需要支持告警日志的能力,Posted by lijing at 五月 06, 2023 14:26|
|---|
