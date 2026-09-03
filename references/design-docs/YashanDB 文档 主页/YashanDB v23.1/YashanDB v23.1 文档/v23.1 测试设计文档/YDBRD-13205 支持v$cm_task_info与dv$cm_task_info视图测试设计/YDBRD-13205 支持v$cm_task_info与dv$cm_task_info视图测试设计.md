Created by 刘美秀 on 十月 31, 2023

# 1. 概述

本文档描述 分布式视图   v$cm_task_info和dv$cm_task_info的测试设计

SR：           [YDBRD-13205](https://jira.yasdb.com/browse/YDBRD-13205?src=confmacro)    -  支持v$cm_task_info与dv$cm_task_info视图  完成

开发设计文档：    [v$cm_task_info，dv$cm_task_info视图设计方案 - 陈俊杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122075299)         [集群管理通信消息详细设计 - 许中立 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95114863)  

# **2. 需求分析**

## **2.1 功能特性**

- v$cm_task_info和dv$cm_task_info：包括四类任务  cluster manager内的探测（probe）、通知（notify）、推送（push）和拉取（pull）
- 仅记录执行的记录


### 5.1 v$cm_task_info视图

#### 字段展示

|字段|类型|说明|
|:---|:---|:---|
|TASK_TYPE|VARCHAR(16)|任务名字|
|TARGET_NODE_LIST|VARCHAR(128)|目标节点|
|SENDTIMES|INTEGER|发送次数|
|TASK_MSG|VARCHAR(128)JSON|任务消息|


#### 任务类型与任务信息

|任务类型-TASK_TYPE|任务消息-TASK_MSG|消息组成|备注|
|:---|:---|---|---|
|PULL_TASK|pull node " " expecting version " "|node+expectedVersion+num+endpoint()|向主MN拉取|
|PUSH_TASK|push cluster version " " lastUpdated on " "|clusterVersion|主MN向主DN、CN 推送（局部/全量）|
|NOTIFY_TASK|notify [status change/ abnormal node/ cluster version]|type(CM_NOTIFY_LOCAL_NODE_ALTER/CM_NOTIFY_OTHER_NODE_ABNORMAL/CM_NOTIFY_TARGET_NODE_PULL)|  
|
|PROBE_TASK|probe node " " [running state/ primary]|type/targetEndpoint|2s --节点故障后/remove、部署|


### 5.2 dv$cm_task_info视图

#### 字段展示

|字段|类型|说明|
|:---|:---|:---|
|GROUP_ID|INTEGER|组ID|
|NODE_ID|INTEGER|节点ID|
|...|  
|  
|


### 5.2 Data Structures & Flow（数据结构与流程）

#### 5.2.1 PULLINFO

|字段|类型|说明|
|:---|:---|:---|
|expectedVersion|INTEGER|预期版本|
|node|VARCHAR(16)|拉取目标节点|
|num|  
|节点数|
|index|  
|目标节点索引|


#### 5.2.2 PUSHINFO

|字段|类型|说明|
|:---|:---|:---|
|clusterVersion|INTEGER|节点自身的集群版本|
|lastUpdateTime|TIMESTAMP|推送的集群信息最后的更新时间|


#### 5.2.3 NOTIFYINFO

|字段|类型|说明|
|:---|:---|:---|
|type|VARCHAR(64)|通知任务类型|
|localNodeStatus|VARCHAR(64)|节点自身状态|
|abnormalNode|INTEGER|异常节点|
|clusterVersion|INTEGER|集群版本|


#### 5.2.4 PROBEINFO

|字段|类型|说明|
|:---|:---|:---|
|type|VARCHAR(64)|探测任务类型|
|targetEndpoint|INTEGER|目标节点|


## **2.2 规格约束**

# **3 测试设计方法**

### 3.1 特性关联领域分析：

- 功能性：  消息字段、内容校验是否正确


- 部署形态：分布式  （一主两备）同机部署、跨机部署、打开自选主
- 可靠性/并发：异常时查询、业务背景下查询
- 易用性：消息内容清楚


### 3.2 测试设计：

本次测试设计主要采用场景法以及边界值、等价类方法验证功能性、可靠性、并发

  


# **4 详细测试设计**

测试设计如下：

（1）消息类型覆盖

|  
|任务类型-TASK_TYPE|任务消息-TASK_MSG|消息组成|备注|场景|TARGET_NODE_LIST|
|:---|:---|:---|---|---|---|---|
|1|PULL_TASK|pull node " " expecting version " "|node+expectedVersion+num+index|向主MN拉取|节点故障期间，其他节点stop，节点重启后pull|  
|
|2|  
|  
|  
|  
|节点故障期间，扩容/缩容，节点重启后pull|  
|
|3|PUSH_TASK|push cluster version " " lastUpdated on " "|clusterVersion+lastUpdateTime|主mn修改  v$cm_cluster_info/v$cm_group_info/v$cm_node_info后，主MN向主DN、CN 推送（局部/全量）|  
|  
|
|4|NOTIFY_TASK|notify [status change/ abnormal node/ cluster version]|CM_NOTIFY_LOCAL_NODE_ALTER|通知其他节点，本地节点发生状态变更的消息|MN /DN switchover|  
|
|5|  
|  
|  
|  
|MN /DN failover|  
|
|6|  
|  
|  
|  
|MN /DN 主节点start|  
|
|7|  
|  
|  
|  
|MN /DN 备节点restart |  
|
|8|  
|  
|  
|  
|CN restart|  
|
|9|  
|  
|CM_NOTIFY_OTHER_NODE_ABNORMAL|通知其他节点，发现有节点处于异常情况|MN /DN 主节点 stop|  
|
|10|  
|  
|  
|  
|MN /DN 主节点stop -f|  
|
|11|  
|  
|  
|  
|网络断连|  
|
|12|  
|  
|CM_NOTIFY_TARGET_NODE_PULL|通知其他节点进行拉取操作|节点启动？|  
|
|13|  
|  
|  
|  
|  
|  
|
|14|PROBE_TASK|probe node " " [running state/ primary]|type/targetEndpoint|探测节点的运行状态，或探测group组的主节点|？|  
|


（2）

|  
|场景|测试点|预期|
|---|---|---|---|
|1|业务|空载查询|查询结果为空|
|2|  
|单机查询|返回结果为空|
|3|  
|MN /DN switchover|  
|
|4|  
|MN /DN failover|  
|
|5|  
|MN /DN 主节点start|  
|
|6|  
|MN /DN 备节点restart |  
|
|7|  
|CN restart|  
|
|8|  
|MN /DN 主节点 stop|  
|
|9|  
|MN /DN 主节点stop -f|  
|
|10|  
|cluster restart|  
|
|11|  
|  
|  
|
|12|  
|ddl/dml时查询|查询结果正确|
|13|  
|节点状态变更：open/mount/nomout|  
|
|14|部署|3MN/8CN/32 DN时节点状态变更，查询|TARGET_NODE_LIST 能列出正确的节点，不会遗漏|
|15|视图查询语法|filter ：in/not in、exists/not exists、between and、like/not like|  
|
|16|  
|distinct|  
|
|17|  
|order by|  
|
|18|  
|group by/group by...having|  
|
|19|  
|join on|  
|
|20|  
|子查询|  
|
|21|  
|union/union all|  
|
|22|函数|聚合函数|  
|
|23|  
|to_char|  
|
|24|  
|cast|  
|
|25|  
|concat|  
|
|26|  
|regexp_like|  
|
|27|并发|相同视图并发查询|  
|
|28|  
|不同视图并发查询|  
|
|29|  
|业务并发时查询--testkill|  
|
|30|  
|可靠性测试添加视图查询|  
|
|31|可靠性|查询时Kill MN主节点|不影响|
|32|  
|查询时Kill 执行CN|  
|
|33|  
|查询时kill DN主节点|不影响|
|34|  
|磁盘满时查询|  
|
|35|  
|CPU 高时查询|  
|
|36|  
|内存满时查询|  
|


  


  


（2）  专项测试设计情况：

|专项|是否涉及|
|:---|:---|
|并发|是|
|可靠性|是|


# **5 测试用例**

门槛用例

  


# **6 测试框架设计**

本次测试采用codbase_test测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **7 测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|1节点部署,1主2备部署|
