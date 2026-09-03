Created by 张丽红, last modified on 一月 03, 2024

**SR链接：**    [YDBRD-13768](https://jira.yasdb.com/browse/YDBRD-13768?src=confmacro)    **-**  **【共享集群】集群下DB支持在线故障恢复**  **完成**

**开发设计文档链接：**    [集群DB在线恢复](119552238.html)  

# **1.概述**

集群形态部署下，每个DB实例均为对等状态，承载部分全局资源，所有DB实例共享数据库，通过共享缓存模块完成业务的并发控制。如果部分DB实例异常关闭，导致整个DB集群处于不一致状态，包括数据库物理页面的不一致，共享缓存状态的不一致。YCS检测到部分DB异常关闭时，通过更新其他DB实例的拓扑状态，使得MASTER DB感知到其他DB实例的异常，MASTER DB实例需要触发故障的在线恢复，修正前述的不一致问题，让整个DB集群处于正常提供全量服务的状态。

# **2.需求分析**

该需求主要实现：某个DB产生异常时，通过故障恢复机制保证整个集群的可用，以及异常的DB再次启动后，整个集群依旧可用。外部呈现的表现就是：集群内部任意一个DB故障了，集群可以自己内部处理这种异常，在经历短时间的恢复期之后，整个集群依旧是处于一个可用的状态，恢复期的时间是有上限的。

**故障恢复的主流程如下：该需求重点针对1、5、8的流程做测试设计**

**1). db master实例通过topo map信息，触发故障在线恢复---------故障恢复的入口**

    2). db master实例广播所有实例禁止后续DDL业务，等待正在执行的DDL业务结束

    3). db master实例广播所有实例锁定GRC，不允许访问GRC资源

    4). db master实例执行GRC资源重分布

**5). db master实例进行故障实例日志预分析，识别需要恢复的物理日志及逻辑日志，将需要重演的物理日志涉及的页面资源的grc resource标记recovery状态。**

    6). db master实例广播所有实例本地锁住swap、temp表空间的extent lock，防止业务修改表空间

    7). db master实例广播所有实例解锁GRC

**8). db master实例执行物理日志和控制日志的在线回放。**

    9). db master实例执行逻辑日志的在线回放

    10). temp/swap表空间的在线恢复

    11). 启动事务后台回滚

# **3.规格**

1、部署形态：集群

2、节点数量：2节点

3、部署模式：多主机磁阵+单主机磁阵

# **4.约束限制**

1.暂只支持两实例部署的在线恢复处理

2.集群DB故障在线恢复期间，涉及GRC访问的业务会卡住重试，直至对应的GRC资源已经处于正确状态。

3.集群DB故障在线恢复期间，不能做表空间DDL业务（卡住/可执行，表空间DDL报错）

4.暂不支持二次故障，二次故障指DB在线恢复期间再次发生实例故障

5.如果实例未处于open状态，实例被切换为主，自己abort

6.集群HA模式不支持

# **5.动态视图/配置参数**

新增动态视图：判断当前集群是否恢复完成，待提供，TBD---在v$instance视图中新增了"IN_REFORM"字段

在测试过程中，如果某个DBcore掉，是否会做自动恢复，能否重新拉起，重新拉起之后，可否继续正常提供服务？（一般场景下，可重拉成功，除非是不可恢复的致命core(数据库页面损坏)会导致恢复失败）

# **6.测试设计方法**

### **该需求的测试主要分以下几个方面，集中采用场景法梳理测试场景，高优先级测试功能场景和性能场景，详细测试设计重点描述功能测试场景**

### **6.1 功能层面测试：**

1、针对DB层面的集群恢复，在1、5、8步骤中主要是涉及到回放流程，回放流程中重点需要考虑的场景如下：

（1）单实例在线故障后，剩余实例的在线回放

（2）所有实例都故障后，首个重新拉起的实例的回放

（3）在不同的并行度下，并行回放的性能（tpcc中kill后恢复时的回放性能/kill后用已有备份集恢复时回放的性能）

（4）业务层面需要重点考虑各个对象的DDL操作

2、从DB本身的角度出发，考虑各种条件下DB故障的场景

3、覆盖各种不同类型的故障，涉及的故障方式主要如下：

（1）kill方式：kill -9、 kill -19/kill -18、 kill -15，shutdown immediate，shutdown abort，主要在业务场景中覆盖

（2）重启/下电/内存满/网络异常：主要在故障模式库中覆盖

### **6.2 性能层面测试：**

（1）正常tpcc场景测试，测试该需求对性能指标的影响

（2）tpcc业务过程中kill主/备，检查DB层面集群能否正常恢复

（3）tpcc业务过程中kill主/备，集群自动恢复，测试这个过程中的RTO和RPO，RTO的启止时刻点需要明确

新增视图：新增恢复相关信息，分阶段描述：时间，阶段，redo量

（0）故障检测时间：默认30s

（1）加大锁到放大锁的时间：GRC锁

（2）放大锁之后到完全恢复的时间：业务全部可正常下发

场景1、2要测，场景3测每个阶段的时间点，做摸底，RTO值在SIT阶段测

### **6.3 数据一致性层面测试：**

（1）基础串行业务场景中异常恢复后的一致性校验------功能场景中已覆盖

（2）大并发过程中异常恢复后的一致性校验和持久性校验------框架适配，适配后测试，框架已适配，功能已增加

（3）性能过程中异常恢复后的一致性校验------本次要测，优先级放低

### **6.4 长稳层面测试：----王伟跟踪**

（1）已有长稳基础业务中增加部分故障场景（涉及主/备分别故障或者主备同时故障），检查DB层面集群能否正常恢复

（2）已有长稳模型中增加故障场景，检查DB层面集群能否正常恢复

  


# **7.详细测试设计**

[【YDBRD-13768】【共享集群】集群下DB支持在线故障恢复_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmZhMWFkOWEzMzExZGM3OGNiIiwicmVmX2lkIjoiNjczOTY5YmY3MjgyMDZlZmI5MmVmNmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjkzLCJleHAiOjE3ODIyOTUwOTN9.XCLjN8dIyTDO21XmTJvuqdynvX9owpBqNvUXTn8hWTg)

# **8.测试用例**

[【YDBRD-13768】【共享集群】集群下DB支持在线故障恢复_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmZhMWFkOWEzMzExZGM3OGNjIiwicmVmX2lkIjoiNjczOTY5YmY3MjgyMDZlZmI5MmVmNmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjkzLCJleHAiOjE3ODIyOTUwOTN9.CECLdrR4e5CqJ6cb0LcHxzwtHGnYyGSO4zrBf5E6XVA)

# **9.测试框架/测试用例自动化**

  


# **10.测试环境说明**

  


# **11.测试版本**

  


# **12.上车分析**

  


## Attachments:

[【YDBRD-13768】【共享集群】集群下DB支持在线故障恢复_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmY4OTcwYzJhZjRmNTFmYTU1IiwicmVmX2lkIjoiNjczOTY5YmY3MjgyMDZlZmI5MmVmNmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjkzLCJleHAiOjE3ODIyOTUwOTN9.gDSjKhJF8SCM-Rizg6bp5mlJ3DIKleY2HI5rTnYfS6Q)

 (application/x-xmind)    


[【YDBRD-13768】【共享集群】集群下DB支持在线故障恢复_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmY4OTcwYzJhZjRmNTFmYTU2IiwicmVmX2lkIjoiNjczOTY5YmY3MjgyMDZlZmI5MmVmNmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjkzLCJleHAiOjE3ODIyOTUwOTN9.iJsWFVQlPDtTF50awLgYVLqaCjL1aCbJFvzeG22ooYk)

 (application/x-xmind)    


[【YDBRD-13768】【共享集群】集群下DB支持在线故障恢复_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmZhMWFkOWEzMzExZGM3OGNiIiwicmVmX2lkIjoiNjczOTY5YmY3MjgyMDZlZmI5MmVmNmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjkzLCJleHAiOjE3ODIyOTUwOTN9.XCLjN8dIyTDO21XmTJvuqdynvX9owpBqNvUXTn8hWTg)

 (application/x-xmind)    


[【YDBRD-13768】【共享集群】集群下DB支持在线故障恢复_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmZhMWFkOWEzMzExZGM3OGNjIiwicmVmX2lkIjoiNjczOTY5YmY3MjgyMDZlZmI5MmVmNmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NjkzLCJleHAiOjE3ODIyOTUwOTN9.CECLdrR4e5CqJ6cb0LcHxzwtHGnYyGSO4zrBf5E6XVA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,质量加固设计：    [reform模块质量加固-](https://conf.yasdb.com/pages/viewpage.action?pageId=141564678)  ,Posted by zhanglihong at 二月 28, 2024 17:13|
|---|
