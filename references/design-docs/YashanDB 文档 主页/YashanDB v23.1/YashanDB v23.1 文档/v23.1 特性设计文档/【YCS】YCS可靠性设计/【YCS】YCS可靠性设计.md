Created by 李晶, last modified by  李垠 on 十一月 08, 2024

#   [YCS可靠性设计方案](#ycs可靠性设计方案)  

JIRA：    [BEAS-YCS启停可靠性](https://jira.yasdb.com/browse/YDBRD-15389)    JIRA：    [BEAS-YCS故障处理-takeover](https://jira.yasdb.com/browse/YDBRD-15393)  

##   [1. Overview（概述）](#1-overview概述)  

本文档描述共享集群软件中集群管理模块YASCS系统可靠性的总体原则，以及相关子系统的详细方案。

系统异常：1. 资源异常2. 网络异常3. 服务器异常

根据系统异常而触发YASCS软件整体的异常流程处理。

参考文献：[YASDB故障模式库-共享集群]     [https://conf.yasdb.com/pages/viewpage.action?pageId=104221906](https://conf.yasdb.com/pages/viewpage.action?pageId=104221906)  

##   [2. Features（功能特性）](#2-features功能特性)  

*说明本方案的功能特性。*

##   [3. Interfaces（接口）](#3-interfaces接口)  

*列出本方案对外提供的接口、配置参数、API等。*

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 目前主要是两节点可靠性


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 YASCS 启停流程异常处理](#51-yascs-启停流程异常处理)  

此处描述一个YCS节点从开始初始化到启动成功的整个流程中所有异常的处理。YASCS 启动流程：

1. 根据参数校验YCS数据目录
1. 加载Profile配置文件信息
1. 创建YcsInstance实例
    1. 初始化Instance内存资源
    1. 初始化信号处理
    1. 初始化线程管理模块
    1. 初始化黑匣子相关资源
    1. 初始化日志模块
    1. 初始化告警框架
    1. 初始化网络资源
    1. 初始化资源管理模块
    1. 初始化集群管理模块
    1. 初始化ICS
1. 启动YCSInstance实、、   1. 启动定时器模块
    1. 启动ICS
    1. 启动YCS消息监听线程
    1. 启动集群管理模块
    1. 启动YCS资源模块


YASCS 停止流程：

1. 停止YCS资源模块
1. 尝试退出集群
    1. 当停止为主节点时，尝试switchover
    1. 当为备节点时，尝试请求主节点退出集群
1. 关闭所有channel，设置主线程退出标记close为true
1. 恢复客户端消息（不要求一定成功）
1. 主线程接收到close标记后进入正式退出流程：
    1. 清理YFS等待消息响应的waitRoom
    1. 停止YCS资源模块
    1. 停止YCS消息监听线程
    1. 停止YCS集群管理模块
    1. 停止ICS网络模块
    1. 停止timer计时器模块
    1. 停止线程管理模块
    1. 关闭线程模块
1. 销毁整个YCSInstance实例及其子模块


####   [5.1 不带DB启停异常处理](#51-不带db启停异常处理)  

#####   [5.1.1 流程异常处理](#511-流程异常处理)  

**Note: 异常处理原则，设计上要考虑流程完整性**  ；

#####   [5.1.2 系统资源异常处理](#512-系统资源异常处理)  

|故障点|故障描述|期望处理机制|备注|
|---|---|---|---|
|加载配置信息|faultPoint 注入读取文件出错|报错退出|正常报错，无core|
|校验配置参数错误|faultPoint 注入校验配置参数值出错|报错退出|正常报错，无core|
|初始化YCSInstance时，分配内存失败|faultPoint 注入初始化YCSInstance分配内存失败|报错退出|正常报错，无core|
|初始化信号时，系统调用失败|faultPoint 注入系统调用失败的故障|报错退出|正常报错，无core|
|初始化线程管理模块，分配内存失败|faultPoint注入分配内存失败故障|报错退出|正常报错，无core|
|初始化黑匣子相关模块，获取文件路径失败|faultPoint注入获取文件信息失败|报错退出|正常报错，无core|
|初始化日志模块失败|faultPoint注入初始化日志模块失败|报错退出|正常报错，无core|
|初始化告警日志模块失败|faultPoint注入初始化日志模块失败|报错退出|正常报错，无core|
|初始化YCS资源管理模块失败|faultPoint注入分配内存失败|报错退出|正常报错，无core|
|初始化YCS集群管理模块失败，分配内存失败|faultPoint注入分配内存失败|报错退出|正常报错，无core|
|初始化YCS集群管理模块失败，磁盘异常|faultPoint注入读取YCR盘失败|报错退出|正常报错，无core|
|启动YCS定时器模块失败，创建线程失败|faultPoint注入故障，创建timer线程异常|报错退出|正常报错，无core|
|启动YCS ICS模块失败，bind 失败|faultPoint注入故障，让innerUrl的端口被占用|报错退出|正常报错，无core|
|启动YCS 集群管理中的定时器失败，创建线程失败|faultPoint注入故障，创建timer线程异常|报错退出|正常报错，无core|
|启动YCS 集群管理模块中，启动共享磁盘失败|faultPoint注入故障，内存分配失败异常|报错退出|正常报错，无core|
|启动YCS 集群管理模块中，读取CtrlBlock失败|faultPoint注入故障，读取CtrlBlock失败|报错退出|正常报错，无core|
|启动YCS 集群管理模块中，初始化VotingDisk|faultPoint注入故障，读盘失败|报错退出|正常报错，无core|
|启动YCS 集群管理模块中，启动YCS监控线程|faultPoint注入故障，创建线程失败|报错退出|正常报错，无core|
|启动YCS 资源管理模块，启动YFS|faultPoint注入故障，加载动态库失败|报错退出|正常报错，无core|
|启动YCS 资源管理模块，启动YFS|faultPoint注入故障，确认主节点流程中，注入网络消息收发异常（即发送接口报错）|报错退出|正常报错，无core|
|启动YCS 资源管理模块，启动YFS监控线程|faultPoint注入故障，创建线程失败）|报错退出|正常报错，无core|


####   [5.2 带DB启停异常处理](#52-带db启停异常处理)  

#####   [5.2.1 初始化共享磁盘中Topo信息信息](#521-初始化共享磁盘中topo信息信息)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b07a1ad9a3311dc7f3d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFCQUFBQUFnQUFBSUFCSUFBQUFDQ0FBQUJBQUFBQ0FBQUFBQUFBQUFCQUFBQUFBQWdBQUFDQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUFBQUFFQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBUVFnQUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MjYsImV4cCI6MTc4MjMwMTQyNn0.qNTMrRBV6EuQmXtM1IlpHi0ytAKGNi7ODvay_2PCUlo)

启动阶段在读写磁盘过程中读写磁盘异常，其中存在异常的情况实属于磁盘异常，抛出磁盘异常后，进程退出。

**Note：此流程无新增工作量**  。

#####   [5.2.2 集群重组](#522-集群重组)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b07a1ad9a3311dc7f3f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFCQUFBQUFnQUFBSUFCSUFBQUFDQ0FBQUJBQUFBQ0FBQUFBQUFBQUFCQUFBQUFBQWdBQUFDQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUFBQUFFQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBUVFnQUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MjYsImV4cCI6MTc4MjMwMTQyNn0.qNTMrRBV6EuQmXtM1IlpHi0ytAKGNi7ODvay_2PCUlo)

1. 判断启动的节点是否为主节点
    1. 当前节点为主节点时进入以下流程
        1. 重置共享磁阵中的CtrlBlock中的topo信息以及当前节点的NodeBlock
        1. 设置当前节点的状态为YCS_CLU_PRIMARY
    1. 当前节点非主节点是进入以下流程
        1. 设置当前节点状态为YCS_PHASE_JOINING
        1. 重置当前节点的NodeBlock
        1. 开启当前共享集群中所有存活节点的通道
            1. 开启通道失败后，进程报错退出。
        1. 根据当前的最新的topo信息，向主节点发起加入集群的请求
            1. 当加入集群的动作失败时，会尝试5次加入集群，5次都加入失败会抛出加入集群超时，进程退出
        1. 设置当前节点的nodeState为YCS_PHASE_ACCEPTED
        1. 设置当前节点状态为YCS_CLU_STANDBY, 即备节点启动成功


**Note 此流程无新增工作量**  。

#####   [5.2.3 YFS启动分析](#523-yfs启动分析)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b07a1ad9a3311dc7f40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFCQUFBQUFnQUFBSUFCSUFBQUFDQ0FBQUJBQUFBQ0FBQUFBQUFBQUFCQUFBQUFBQWdBQUFDQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUFBQUFFQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBUVFnQUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MjYsImV4cCI6MTc4MjMwMTQyNn0.qNTMrRBV6EuQmXtM1IlpHi0ytAKGNi7ODvay_2PCUlo)

1. 判断启动的节点是否为主节点
    1. 当前节点为主节点时进入以下流程
        1. 更新topo信息中yfs主节点信息并自增topoVersion
        1. 更新最新的topo信息到共享磁盘中的CtrlBlock中
    1. 当前节点非主节点时进入以下流程
        1. 根据当前的topo信息向主节点发送请求资源加入的请求（网络交互失败后，需要网络重试容错），超时报错，进程退出。
        1. 请求响应成功后，从共享磁阵中的CtrlBlock中读取最新的topo信息，并更新至缓存中。


**适配工作量**  ：

1. 资源请求加入的网络消息交互没有重试机制，此处需要新增重试机制。


#####   [5.2.4 YCS心跳加固](#524-ycs心跳加固)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b078970c2af4f5200ca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFCQUFBQUFnQUFBSUFCSUFBQUFDQ0FBQUJBQUFBQ0FBQUFBQUFBQUFCQUFBQUFBQWdBQUFDQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUFBQUFFQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBUVFnQUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MjYsImV4cCI6MTc4MjMwMTQyNn0.qNTMrRBV6EuQmXtM1IlpHi0ytAKGNi7ODvay_2PCUlo)

1. 心跳会判断当前节点是否为备节点，非备机点不处理心跳信息
1. 校验心跳中的topoVersion，当收到心跳topoVersion大于本地topoVersion时
    1. 通过getTopo请求从主节点中获取最新的topo信息
1. 当收到的心跳的topoVersion 小于等于本地的topoVersion时，不处理心跳消息。


**Note: 主要考虑DB启动过程进入YCS部分流程的异常处理**  ；

###   [5.3 TakeOver 流程异常处理](#53-takeover-流程异常处理)  

![](https://pingcode.yasdb.com/atlas/files/public/67396b07a1ad9a3311dc7f42/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBQUFBSUFBSUFBQUFCQUFBQUFnQUFBSUFCSUFBQUFDQ0FBQUJBQUFBQ0FBQUFBQUFBQUFCQUFBQUFBQWdBQUFDQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUNBQUFBQUFBQUFFQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBUVFnQUFBSUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA2MjYsImV4cCI6MTc4MjMwMTQyNn0.qNTMrRBV6EuQmXtM1IlpHi0ytAKGNi7ODvay_2PCUlo)

1. 当出现网络异常时，ICS会抛出disconnected事件，由disconnected事件触发集群重组流程
1. 此时出现两种出流程：
    1. 当前节点为主节点且节点个数小于两个
        1. 主节点会尝试独自运行
        1. 进入独立运行时会检查ctrlBlock中是否已经存在主节点，若已经存在主节点时结束重组流程
        1. 设置节点状态为STANDALONE
        1. 关闭所有节点通道，age自增更新缓存中的topo信息以及CtrlBlock磁盘信息
        1. 设置节点状态为YCS_CLU_PRIMARY
    1. 当前节点为备节点以及节点数大于2时
        1. 进入集群重组流程
        1. 先从ctrlBlock中读取集群topo信息
        1. 校验ctrlBlock中的age以及缓存中的age是否一致，不一致时会抛出YCSE_CLUSTER_SEPARATED异常，进行入重启流程
        1. 判断当前节点数小于2时进入takeover流程
            1. 设置当前节点状态为YCS_CLU_TAKEOVER
            1. 设置其他节点为OFFLINE状态
            1. 进入tryReset尝试自己成为主节点，如果当前集群已经存在主节点，将抛出YCSE_CLUSTER_SEPARATE异常，进入集群重启流程
            1. 设置自己状态为主节点
        1. 判断当前节点数大于2进入投票流程
            1. 尝试往投票盘中写入自身的信息
            1. 进入doSurvive流程往CtrlBlock写入自身信息，写入失败抛出YCSE_VOTING_DISK_ERROR异常
            1. takeover流程结束


|故障点|故障描述|期望处理机制|备注|
|---|---|---|---|
|主节点独立运行时|faultPoint 注入读盘失败|报错抛出异常，由节点触发重启节点|重启之后成为主节点无异常|
|主节点独立运行时|faultPoint 注入写盘失败|报错抛出异常，由节点触发重启节点|重启之后成为主节点无异常|
|主节点异常，备节点takeover|faultPoint 读盘失败，|报错抛出异常，由节点触发重启节点|重启之后成为主节点无异常|
|主节点异常，备节点takeover|faultPoint age不一致断点|报错抛出异常，由节点触发重启节点|重启之后成为主节点无异常|
|主节点异常，备节点takeover|faultPoint tryReset失败|报错抛出异常，由节点触发重启节点|重启之后成为主节点无异常|
|**Note: 三节点投票流程暂不注入异常**||||


###   [5.4 Cache与持久化（写磁盘）部分加固设计](#54-cache与持久化写磁盘部分加固设计)  

目前缓存更新以及更新topo信息不是一个原子操作，接口流程上存在差异，容易出现更新缓存的topo信息却没有更新ctrlBlock.这里根据实际需要封装为统一的接口，让此处更新时原子操作。

topo信息更新后需要写盘的字段有：

|字段名称|描述|备注|
|---|---|---|
|ageTime|age更新时间||
|age|age朝代||
|nodeCount|当前集群中存活的节点数||
|master|当前集群中主节点id||
|nodeMap[YCS_MAX_NODES]|当前集群中所有节点的状态|YCS_STAT_ONLINE,YCS_STAT_OFFLINE|


**风险：重构后可能会拉长自测时长**  ；

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

略

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

###   [6.1 不带业务场景](#61-不带业务场景)  

|用例名称|用例步骤描述|期望|实际结果|备注|
|---|---|---|---|---|
|yascs.ini缺失|部署环境后，删除yascs.ini文件，重启yascs|启动报错||正常报错，无core|
|yascs.ini配置信息异常|部署环境后，篡改yascs.ini中的配置信息，改成无效值|启动报错||正常报错，无core|
|磁阵异常|启动过程中，使用faultPoint注入故障，模拟磁盘读写异常|启动报错||正常报错，无core|
|线程资源异常|使用faultPoint,注入线程分配失败的异常，启动ycs|启动报错||正常报错，无core|
|内存资源异常|使用faultPoint,注入内存分配失败的异常，启动ycs|启动报错||正常报错，无core|
|网络异常|使用faultPoint,注入网络故障错误，启动ycs|启动报错||正常报错，无core|
|YCS主节点hang住|kill -19 YCS主节点|备机心跳超时，备节点投过选举成为主节点||无core，备机成为新的主节点，新的主节点的db因为与主节点心跳超时会自动abort,恢复后会抛出脑裂异常重新启动|
|YCS备节点hang住|kill -19 YCS备节点|主节点给备机发送心跳超时，抛出备机网络异常，清理异常channle||无core，备节点db会abort，恢复后，备节点通过monitor重启拉起db。|
|YCS主节点服务器宕机|kill -9 YCS主节点模拟宕机|主节点给备机发送心跳超时，抛出备机网络异常，清理异常channle||无core，备节点db会abort，恢复后，备节点通过monitor重启拉起db。|
|YCS备节点服务器宕机|kill -9 YCS备节点模拟宕机|主节点给备机发送心跳超时，抛出备机网络异常，清理异常channle||无core，备节点db会abort，恢复后，备节点通过monitor重启拉起db。|
|模拟YCS主备节点之间topo信息不一致|使用faultPoint 故障注入，修改备节点上的topo信息，造成主备之间的topover或者age不一致|备节点需要主动拉取主节点的topo信息或者直接重新读盘获取最新的topo信息||主备之间的topo信息一致业务正常|


###   [6.2 带业务测试6.1场景中的用例](#62-带业务测试61场景中的用例)  

同上（带业务需要资源DB，YFS支持异常分支处理）

##   [7. Document（资料）](#7-document资料)  

1. 补充YCS启停设计文档中，如出设计中的异常处理流程相关异常报错信息补充以及处理措施。


##   [8. Workload（工作量）](#8-workload工作量)  

|功能模块|描述|实际工作量|备注|
|---|---|---|---|
|YCS启动流程|启动时网络交互都需要加入重试机制|1.5人天||
|缓存与写盘机制部分重构|主要让所有更新CTRL盘信息以及更新topo信息需要统一接口|4人天|包含自验|
|功能自测|验证测试用例中所有的场景|3人天|尝试使用faultPoint 再启动流程中注入故障|


##   [9. TODO（遗留问题）](#9-todo遗留问题)  

目前YCS之间的topo心跳是相互发送的， 以前是为了通道检测，现在节点之间网络心跳由ICS接管，可以认为通道检测下沉到ICS层，所以这里期望由topo信息的发送只由主节点发送，备机就不发送topoHeartBeat消息，只接收心跳消息。

## Attachments:

[YCS启停-YFS启动分析.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDc4OTcwYzJhZjRmNTIwMGM0IiwicmVmX2lkIjoiNjczOTZiMDY3MjgyMDZlZmI5MmYwMGJkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjI2LCJleHAiOjE3ODIzNzcwMjZ9.p-aLLW0Hz9Rg9_0ZVFGRPik1FhqunA7ZeDTI7kcXvfQ)

 (image/svg+xml)    


[YCS启停流程-监控加固处理.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDc4OTcwYzJhZjRmNTIwMGM2IiwicmVmX2lkIjoiNjczOTZiMDY3MjgyMDZlZmI5MmYwMGJkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNjI2LCJleHAiOjE3ODIzNzcwMjZ9.pha9tqpO7DHTf3qVcYK-o0QVAvwjJHRyGfOBXxIt9aE)

 (image/svg+xml)    


## Comments:

|  [](null)  ,1. 功能特性补上。    
  2. faultPoint 使用ut覆盖。    
  3. 下来考虑下消息的可重入性。,Posted by lijing at 七月 24, 2023 16:54|
|---|
