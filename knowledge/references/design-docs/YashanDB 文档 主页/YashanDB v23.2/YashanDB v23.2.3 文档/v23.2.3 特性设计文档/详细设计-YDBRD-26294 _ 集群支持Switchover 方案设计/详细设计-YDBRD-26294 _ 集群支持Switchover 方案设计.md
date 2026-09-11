Created by 朱国旭, last modified on 十一月 11, 2024

*详细设计-YDBRD-26294 : 集群支持Switchover 方案设计*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2affa](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2affa)    *?*    
  *#YASHAN-170 【主备集群】集群间支持手动switchover*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66191dcafd997db58ad89fec](https://pingcode.yasdb.com/pjm/items/66191dcafd997db58ad89fec)    *?*    
  *#YDBRD-26294 【主备集群】集群间支持手动switchover*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#1-%E6%80%BB%E8%BF%B0)  

根据业务的实际需要，主备集群需要支持集群间手动switchover的能力。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求描述：

内部测试需求：支持集群间支持手动switchover。

场景：

在客户场景测试或者演练过程中，需要进行主备之间的倒换演练。需要主备集群支持集群间支持手动switchover

需求范围：

集群

需求规格：

1. 支持同构集群复制，要求节点数对等，版本相同
1. 1号实例switchover成功后，其他备实例需要手动open


交付版本：

23.2.x

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

同友商实现方式有差异，功能依赖现有规格和单机的实现功能对齐。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|主备切换的能力|执行alter database switchover操作实现。（当前SR实现）|是|是|
|周边配合|权限|同单机权限保持一致|否|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|alter database switchover|主备角色在线切换|是|
|动态视图|v$database的  SWITCHOVER_STATUS|主备角色切换的状态|是|
|动态视图|v$REPLICATION_STATUS|主备连接状态|是|
|错误码|错误码、ACTION描述|primary   instance %u   switchover is failed|是|
|错误码|错误码、ACTION描述|instance %u has exited the cluster|是|
|错误码|错误码、ACTION描述|the cluster is undergoing reform|是|
|错误码|错误码、ACTION描述|instance 1 must be opened|是|
|错误码|错误码、ACTION描述|instance cannot be mounted when switchover|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**备集群**

1. 备集群的所有实例的redo传输必须是正常的（连接正常并且状态也是正常）。
1. switchover期间备集群阻塞其他实例加入集群。（同Failover表现一致）
1. switchover完成之后，如果脏页没有刷完，新主的其他实例也是不可以加入集群的。（同Failover表现一致)


**主集群**

1. 其他存活实例的状态必须是open状态，不能出现nomount状态或者是mount状态。
1. 执行switchover期间，新的实例加入集群需要报错。
1. 执行switchover期间，如果有实例退出，switchover失败。
1. 如果正在执行reform，switchover报错


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性设计——主备集群差异性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

#### 4.1.1   备集群独有的特性

1. 非master号实例不能正常open，可以正常加入集群和ctrlMount
1. checkpoint推点都是更新所有实例的，具有独特的脏页辅助链。
1. 多个redo buffer cache
1. 多个归档线程


#### 4.1.2 主集群独有的特性

1. 托管其他实例，帮其他实例启动发送线程


###   [4.2 细节设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

#### 4.2.2 主集群异常错误返回

主备集群的switchover连接是1号实例之间建立连接，其他实例切换过程中发生错误需要将错误信息返回给主集群的1号实例，由主集群的1号实例返回给备集群，最后返回给客户端。

1号实例需要感知其他实例的进度，避免其他实例异常后，1号实例继续执行降备。（  校验通过的时候需要记录当前集群的topo关系，避免有节点退出集群没感知到  ）

其他实例也要感知1号实例的进度，避免1号实例异常后，其他实例还在做降备工作。

#### 4.2.3 集群加入的拦截

- Switchover开始时校验在线集群的状态，所有实例的状态必须是open。但是无法避免校验完成之后，又重新拉起一个实例。（该实例启动到nomount并不影响，做容错处理）
- 其他实例加入集群是需要做拦截，提前报错，当前正在做switchover，所以需要在alter database mount时发送广播消息去其他实例查询其他实例是不是在做switchover。
- 主集群的reform不能阻塞，需要处理集群退出。主集群完成redo传输之后，就可以降备了，降备之前需要关闭除1号实例之外的所有实例，让他们启动到nomount阶段。
- 等待所有实例触发重启之后，再修改主机的角色为备机。


#### 4.2.6 备机回放

1. 备机回放完成之后，redo buffer将不会再使用，可以释放其他实例的buffer。
1. 回放完成之后，将不会再产生新的脏页，需要执行一次全量checkpoint，（同failover一致）
1. 回放完成之后需要做LSN的Lamport，保证当前实例的lsn推到最大。


#### 4.2.7 备集群reformMaster适配

同Failover一致，升主期间，数据库肯定不能进行集群加入，reform master线程需要暂停，不能正常工作。

#### 4.2.8 checkpoint线程适配

这部分集群Failover已经适配，这里不做特殊介绍。（参考：    [详细设计-YDBRD-25968 : 集群支持备库升主能力方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147778640)    ）

###   [4.3 整体实现](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d7e8970c2af4f52130f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg4NDAsImV4cCI6MTc4MjMxOTY0MH0.74VodwDFbVsra6isMUdzQ3i04OJhVLW__TK46ckuFhQ)

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


|序号 |测试场景|预期|
|---|---|---|
|1|在主机上执行switchover|switchover cannot be executed on primary database|
|2|数据库处于nomount阶段执行switchover|the database is not open|
|3|主集群实例1退出集群，实例2存活，执行switchover|instance 1 must be opened|
|4|主集群实例1非master实例，实例2存活，执行switchover|Succeed|
|5|主集群实例1存活，实例2退出，执行switchover|Succeed|
|6|主集群两实例都存活，执行switchover，执行一半kill实例1|database is not connected to instance 1 of primary|
|7|主集群两实例都存活，执行switchover，实例2处于准备降备阶段被kill|primary instance 2 switchover is failed|
|8|主集群两实例都存活，执行switchover，实例2等待回放阶段被kill|database is not connected to instance 2 of primary|
|9|主集群两实例都存活，执行switchover，实例2完成全量checkpoint被kill|primary instance 2 switchover is failed|
|10|主集群两实例都存活，执行switchover，实例2重启阶段被kill|Succeed|
|11|正常场景反复执行switchover|无异常|
|12|执行switchover期间，实例2 mount数据库|报错|
|13|主集群正在做在线恢复，执行switchover|报错|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. 备集群支持多实例open。
1. 备集群执行switchover只需连接主集群master实例即可，要求必须1号实例open。
1. 主集群降备时无需关闭其他实例。


## Attachments:

[集群支持Switchover.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkN2VhMWFkOWEzMzExZGM5MTdlIiwicmVmX2lkIjoiNjczOTZkN2U3MjgyMDZlZmI5MmYxZmE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODQwLCJleHAiOjE3ODIzOTUyNDB9.l4R7sNXZ9tu0bwojJVXVtlIGV7uhzGSwRj9yWjB1_ss)

 (image/png)    


## Comments:

|  [](null)  ,1. 主集群实例之间消息交互，并且判断topo
,Posted by zhuguoxu at 四月 24, 2024 15:08|
|---|
