Created by 廖增康, last modified on 五月 24, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-1-总述)  

###   [1.1 背景介绍](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-11-背景介绍)  

 1. CN扩容现状:

     1.1 新扩容CN节点OM调CM高级包接口添加节点, 建库后直接进入 NORMAL状态, 其他节点都能获取扩容新CN节点.

     1.2 分布式DCL执行流程为CN节点直接调MN,DN,CN节点执行，如果当前正在CN扩容，当前CN节点调扩容CN节点建连失败报错，其他节点执行成功导致DCL设置不一致.

     1.3 扩容过程中，调用分布式DV视图，可能会报失败，导致扩容过程分布式视图不能使用 – 待确认.

     1.4 CN扩容拉取新CN过程中分布式DDL执行回同步DDL操作给新CN节点，同步过程中建连失败，DDL执行最终会走后台异步推送流程，导致扩容报失败，为了兼容在拉取新CN节点前添加DDL Lock，

           在扩容前设置Ddl Lock没有taskid, 并发控制不好处理, 兼容处理流程导致设置Ddl Lock和DN扩容不一致.

     1.5 CM不记录扩容中间状态，新扩容CN节点要阻止DDL,DML,DCL执行只能通过OM先把新CN拉取到nomount状态，设置CN禁止服务标志位，在重新拉取到mount状态建库直接到open状态,

           nomount状态下没有加载文件，不能通过控制文件或系统表持久化禁止服务标志位，只能写配置文件隐藏参数的方式持久化标志位，配置文件用户能修改存在风险.

2. CN扩容修改目标:

     2.1 CM 不记录节点扩容中间状态，导致CN扩容各种打补丁的方式做兼容，逻辑不清晰，容易遗漏。

     2.2  CN 扩容流程，OM先添加CM新CN位扩容状态，添加成功后建库拉取到 FULL_ASYNC 状态，等元数据迁移完成后，通过子任务修改扩容CN节点到 NORMAL 状态，调用CM同步通知接口，通知成功后再放开Ddl Lock。

###   [1.3 特性对比](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-13-特性对比)  

见上表。

其中，当前受限于元数据存储架构的影响，协调节点CN间的元数据同步采用的DDL逻辑同步；

##   [2. 总体框架设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-2-总体框架设计)  

###   [2.1 模块定位](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-21-模块定位)  

CN扩缩容负责CN扩缩容处理流程的定义以及DB侧的流程实现，提供相关接口由OM/yasboot工具进行扩缩容任务的调度和执行；

其中CN扩容流程中最重要的一环是元数据的迁移，而DN组扩容同样需要进行元数据迁移，因此需要对元数据迁移进行抽象成一个子任务，便于复用；

  


###   [2.2 模块间交互](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-22-模块间交互)  

|依赖模块|被依赖模块|依赖内容|
|---|---|---|
|CN扩缩容|高级包模块|依赖  DBMS_MM和DBMS_CM高级包能力|
|CN扩缩容|任务管理模块|依赖任务管理框架调度CN扩容任务；相关模块文档：    [任务管理模块设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138548389)  |
|CN扩缩容|SQL引擎|对元数据迁移的DDL语法适配支持|
|yasboot|CN扩缩容|  
|
|OM|CN扩缩容|  
|
|  
|  
|  
|


  


###   [2.3 模块内架构](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-23-模块内架构)  

|模块名|作用|依赖关系|
|---|---|---|
|task_add_cn_node|注册CN扩容任务；根据任务管理框架规范，实现扩容CN任务执行相关接口|任务管理框架|
|task_transport_meta|元数据迁移子任务|任务管理框架|
|dbms_mm|dbms_mm高级包，控制CN对外服务的开关，分布式DDL禁止开关|builtin内置高级包|
|transport ddl parser|transport ddl的解析和校验|SQL parser & verifier|


##   [3. 接口定义](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-3-接口定义)  

*模块对外的所有接口，展示外部如何使用该模块*

###   [3.1 API接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-31-api接口)  

####   [3.1.1 用户API接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-311-用户api接口)  

DB侧的相关接口为对内部OM/yasboot工具可见，对用户不可见；用户侧实际使用OM/yasboot工具完成扩缩容的操作，详细设计以及操作流程参见：

  [om支持CN组内扩容节点方案设计](119552900.html)  

####   [3.1.2 内部接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-312-内部接口)  

以下接口为DB侧提供给内部工具使用的接口，对用户不可见；

1，注册CN节点新是否扩容状态字段

```
DBMS_CM.CREATE_NODE(CodBool isSyncMeta)   //该命令在MN执行，注册新的CN节点   -- 新增是否扩容中字段
// 用法：begin dbms_cm.create_node(?, ?, ?, ?, ?, ?, ?, ?); end;
// 参数：out(nodeid), out(endpoint), groupid, nodeType, hostip, dataPath, listenAddr, replicationAddr, dinAddr

```

  


2，CM 新增设置新CN节点状态同步通知接口:

```
CodResult andCmNotifyScalingFinishedToCnMn(ClusterManager* cm, CodUint32 timeout)

```

  


  


###   [3.2 命令行参数](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-32-命令行参数)  

###   [3.3 配置参数](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-33-配置参数)  

###   [3.4 SQL语法](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-34-sql语法)  

##   [4. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-4-规格约束)  

|规格约束|原因|
|---|---|
|CN扩容失败，需要调用OM clean命令清理新CN节点才能继续扩容|CN扩容更新状态子任务执行失败，需要OM调用 clean删除新CN节点，并且解锁DDL LOCK|
|发起CN扩容，执行DCL设置系统参数可能会导致扩容节点参数不一致|OM执行扩容，到扩容任务加DDL LOCK前时间段执行DCL设置系统参数，会导致新CN没有设置系统参数|


##   [5. 功能设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-5-功能设计)  

###   [5.1 功能场景](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-51-功能场景)  

###   [5.2 关键技术](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-52-关键技术)  

1，现有CN扩容业务流程

![](https://pingcode.yasdb.com/atlas/files/public/67396cc1a1ad9a3311dc8c9f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBUUFBQUFRQUFDQUFBRUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFFQUFBQUFBQUFRQUFBQUNBQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBaEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMyNDcsImV4cCI6MTc4MjMxNDA0N30.xrj_8tHFx2ub4o1g848EyaPptLESVl8n9SHC5geL_oA)

    2. CM添加CN节点扩容中间态后CN扩容流程:

        2.1 开始扩容，  调用CM高级包把新CN节点加入到CM集群中，注册CN节点信息，使用接口：DBMS_CM.CREATE_NODE，添加扩容状态字段.

        2.2 OM 拉起新CN实例到nomount状态.

        2.3 OM 调用新CN节点建库，节点建库完成后自动切换到OPEN状态.

        2.4   OM 调用高级包注册CN扩容任务，并启动扩容任务执行，使用接口：DBMS_TASK.ADD和DBMS_TASK.START。

              a. OM根据返回的TaskID持续查询任务视图，探测扩容任务的执行状态，直到扩容任务终止（成功或者失败）

              b. 如果扩容任务执行成功，则执行后续步骤8。

**              c. 如果扩容任务失败，则报错退出。DBA需要重新执行缩容命令，将新CN缩容。**

       2.5  CN扩容父任务添加分布式DDL Lock，  防止在扩容过程中，执行DDL操作。添加失败，直接报错退出，DBA需要重新执行缩容命令，将新CN缩容。

       2.6 扩容任务调用元数据迁移子任务从MN节点迁移全量元数据。

             a. 检查元数据迁移任务是否已经执行过，  如果已经执行过，则终止任务的执行（元数据迁移执行前检查任务执行execTimes，以防止故障时任务重入问题）  。

             b. 通过查询系统视图，拼接迁移DDL，导出MN节点全量元数据（不包括统计信息）SQL语句到LOB缓存中。

             c. 启动新CN节点元数据迁移子任务远程任务。

             d. 远程任务执行MN节点元数据迁移任务发送的SQL语句，迁移元数据。

             e. 元数据迁移完成后，结束远程任务。

       2.7 元数据迁移任务完成后，调用修改新CN节点状态修改子任务。

             a. 在新CN节点调CM接口把运行状态修改为 NORMAL 状态.

             b. 修改成功后调用CM同步通知节点，把新CN节点状态通知到各个CN节点和MN主节点，如果同步通知成功，则解锁DDL Lock；如果同步通知失败，报扩容任务失败退出，

                 OM调 clean 删除新CN节点，成功后调任务rollback接口解锁DDL Lock.

       2.8 扩容任务执行完成。

       2.9 CN 扩容执行新流程图:

![](https://pingcode.yasdb.com/atlas/files/public/67396cc18970c2af4f520e32/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBUUFBQUFRQUFDQUFBRUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFFQUFBQUFBQUFRQUFBQUNBQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBaEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMyNDcsImV4cCI6MTc4MjMxNDA0N30.xrj_8tHFx2ub4o1g848EyaPptLESVl8n9SHC5geL_oA)

  3. 扩容执行失败异常处理:

      3.1 扩容任务更改状态子任务执行前失败，扩容任务报失败，并且解锁DDL LOCK。

      3.2 扩容任务更改状态子任务执行失败，扩容任务报失败，不解锁DDL LOCK, DDL LOCK通过OM clean命令清理.

            a. OM clean任务执行逻辑，先调MN节点CM模块高级包删除节点，查询视图，等所有节点都更新到新扩容CN节点已经删除后，调扩容任务 rollback节点，rollback解锁DDL LOCK。

  


  4. 分布式DCL流程修改:

      4.1 分布式DCL执行先调MN节点，判断当前是否有添加DDL LOCK锁，如果添加了，报执行失败.

![](https://pingcode.yasdb.com/atlas/files/public/67396cc1a1ad9a3311dc8ca0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBUUFBQUFRQUFDQUFBRUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFFQUFBQUFBQUFRQUFBQUNBQUFBQWdBQUFBQUFBQUFFQUFBQUFBQUFBaEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMyNDcsImV4cCI6MTc4MjMxNDA0N30.xrj_8tHFx2ub4o1g848EyaPptLESVl8n9SHC5geL_oA)

       4.2 分布式DCL命令类型是否需要添加校验DDL LOCK：

|DCL类型|DCL ACTION 类型|是否需要添加校验DDL LOCK|备注|
|---|---|---|---|
|ALTER SYSTEM|ALTER_SYS_KILL|否|其他ALTER SYSTEM ACTION类型只支持单机类型，不需要添加判断DDL LOCK|
||ALTER_SYS_CANCEL|否||
||ALTER_SYS_SET|是||
||ALTER_SYS_FLUSH_GTS|否||
||ALTER_SYS_CLEAN_RESIDUAL_SPACE|否||
|ALTER SESSION|  
|否|  
|
|COMMIT|  
|否|  
|
|ROLLBACK|  
|否|  
|
|GRANT|  
|否|走分布式DDL逻辑，有判断DDL LOCK|
|REVOKE|  
|否|走分布式DDL逻辑，有判断DDL LOCK|
|RELEASE SAVEPOINT|  
|否|跟COMMIT, ROLLBACK逻辑相同，不加判断|
|SAVEPOINT|  
|否|跟COMMIT, ROLLBACK逻辑相同，不加判断|
|SET TRANSACTION|  
|否|分布式不支持|


##   [6. 非功能设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-6-非功能设计)  

###   [6.1 性能设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-61-性能设计)  

###   [6.2 可用性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-62-可用性设计)  

*可用性是指系统正常运行的时间占比，例如7*24运行无影响等*

###   [6.3 可靠性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-63-可靠性设计)  

###   [6.4 可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-64-可维可测设计)  

*需要考虑定位*

####   [6.4.1 视图](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-641-视图)  

OM向MN注册新的CN节点，注册成功后，可以通过节点视图(V$CM_NODE_INFO)，观察节点的信息；

CN扩容任务调度和执行主要由任务管理框架进行调度，这里可以通过任务管理框架提供的任务视图（V$TASK），观察任务的状态和进度；

  


####   [6.4.2 告警项](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-642-告警项)  

####   [6.4.3 错误码](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-643-错误码)  

####   [6.4.4 等待事件](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-644-等待事件)  

  


|  
|
|---|


  


  


####   [6.4.5 运行日志](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-645-运行日志)  

扩缩容任务的注册、执行过程应记录关键事件的日志，包含任务id，执行步骤，执行时间等关键信息；

分别输出元数据迁移子任务的DDL导出和DDL执行的时间，以及对象个数；

###   [6.5 安全性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-65-安全性设计)  

1，内部接口只允许内部工具并且是以sys用户登陆的会话调用

2，transport命令只允许以sys用户登陆操作

3，上述高级包相关命令具备审计能力

###   [6.6 兼容性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-66-兼容性设计)  

1，  对于后续  新增的分布式DDL对象，需要实现TRANSPORT命令和元数据迁移，同时关注对象的依赖关系和迁移顺序；

2，对于DDL新增的option参数等，也需要同步元数据迁移相关的内容（反序列化拼接的DDL需要增加对应的参数等）；

###   [6.7 周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-67-周边配合)  

CN扩容成功后，需要应用把新增的CN地址加入到连接串列表或者注册到发现服务中；

CN缩容后，需要应用把缩容的CN地址从连接串地址列表中移除或者从发现服务中移除；

##   [7. 自测用例](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-7-自测用例)  

|序号|测试场景|测试方法|状态|计划完成时间|备注|
|---|---|---|---|---|---|
|1|扩容执行流程中，dml, 分布式dv$view 查询能正常执行，  **预期**  DDL, DCL执行被阻止|pytest  add_cn_node 流程新增dml,查询分布式视图,ddl,dcl语句执行|done|4月1日|  
|
|2|扩容执行过程中，元数据迁移失败，任务框架触发自动解锁ddl lock，扩容任务失败，不影响DDL, DCL正常执行，有残留的扩容任务，再次扩容，  **预期**  失败|新增pytest设置failpoint，执行完成验证分布式DDL,DCL能正常执行|  
|4月1日|  
|
|3|扩容执行过程中，元数据迁移成功，广播新扩容的CN节点失败，  **预期**  不解锁ddl lock，此时DDL，DCL执行报错，需要手动调用OM解锁DDL lock & 清理扩容节点，有残留的扩容任务|新增pytest设置failpoint，执行完成验证分布式DDL,DCL不能正常执行，调用om clean程序后，分布式DDL,DCL能正常执行|  
|4月1日|  
|
|5|有有背景DDL执行背景情况下，反复扩缩容，  **预期**  均可成功|写python连续多次执行CN扩容和缩容，最后执行无异常|  
|4月2日|有约束说明|
|6|反复执行，一次扩容多个节点能执，  **预期**  成功|python程序调用扩容多个CN命令执行|  
|4月2日|  
|
|7|扩容过程中，MN节点异常挂掉或者主备切换，  **预期**  扩容任务失败|  
|  
|4月2日|  
|


##   [8. 资料文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-8-资料文档)  

*模块相关使用文档、用户文档等链接*

###   [8.1 专利](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-81-专利)  

###   [8.2 软文](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-82-软文)  

###   [8.3 案例](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-83-案例)  

##   [9. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-9-未来展望)    工作量评估:

|模块|修改点|工作量|  
|
|---|---|---|---|
|OM    
    
|CN扩容添加新CN节点新高级包接口修改|  
  1D|  
|
||CN扩容新流程删除设置DDL LOCK,CN禁止服务，解锁DDL LOCK旧接口代码||  
|
||clean调用解锁高级包接口改成任务rollback接口||  
|
|CM|CM添加节点新增扩容状态和新增同步修改状态通知接口|2D|  
|
|CN扩容流程    
    
    
    
|分布式DCL流程新增查询MN节点是否添加DDL LOCK|1D|SIT先解决|
||CN扩容现有流程按新流程梳理修改|0.5D|转需求SIT后解决|
||更新状态子任务代码添加|1.5D|  
|
|  
|CN扩容整体联调和自测|3D|  
|
|  
|分支代码跑上车流程|2D|  
|


  


##   [10. 代码说明](https://conf.yasdb.com/pages/viewpage.action?pageId=138556953#CN扩缩容模块设计文档-10-代码说明)  

##   [11. 版本与特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138548389#11-%E7%89%88%E6%9C%AC%E4%B8%8E%E7%89%B9%E6%80%A7)  

*模块关联的版本与特性信息，部分需要与测试设计文档进行关联*

|版本号|特性|变更说明|关联设计文档|关联测试设计文档|相关IR/SR/AR|
|:---|:---|:---|:---|:---|:---|
|23.1|CN扩缩容|分布式支持CN扩缩容|  [YDBRD-12916: 分布式CN扩容设计](119544064.html)  |  
|  [YDBRD-817](https://jira.yasdb.com/browse/YDBRD-817?src=confmacro)    -  CN支持在线扩容  完成|
|23.1|元数据迁移|元数据迁移|  [元数据迁移方案设计](109603333.html)  |  
|  
|


## Attachments:

[scale_in.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzE4OTcwYzJhZjRmNTIwZTJlIiwicmVmX2lkIjoiNjczOTZjYzE3MjgyMDZlZmI5MmYxNjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMjQ3LCJleHAiOjE3ODIzODk2NDd9.RvTYL8pvYTmXG0Rut087zsd6xKI540mnUzZLmO28w94)

 (image/png)    


[new_cn_scaleout.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzE4OTcwYzJhZjRmNTIwZTJmIiwicmVmX2lkIjoiNjczOTZjYzE3MjgyMDZlZmI5MmYxNjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMjQ3LCJleHAiOjE3ODIzODk2NDd9.wUeJRqUSYQTDvUHEPbmNJiMSUplhKC9s9xG9LngIofQ)

 (image/png)    


[new_cn_scaleout.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzFhMWFkOWEzMzExZGM4YzlkIiwicmVmX2lkIjoiNjczOTZjYzE3MjgyMDZlZmI5MmYxNjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMjQ3LCJleHAiOjE3ODIzODk2NDd9.b6qbRO4QwHzLCqIGtsLjOAywUMg6I9Q1kh34j3jH0Fg)

 (image/png)    


[new_cn_scaleout.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzE4OTcwYzJhZjRmNTIwZTMwIiwicmVmX2lkIjoiNjczOTZjYzE3MjgyMDZlZmI5MmYxNjczIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMjQ3LCJleHAiOjE3ODIzODk2NDd9.48lMFis7ksBVq0BUac3DkChaK19JG0yJJALjCtJOnd4)

 (image/png)    


## Comments:

|  [](null)  ,会议辑要:,与会人：陈布隆、何金阳, 李晶，许中立、刘美秀、廖增康,会议时间：2024-3-19,1. 更新状态子任务CM接口，MN,CN节点同步更新，DN异步方式更新。
1. 排查新增CN节点FULL SYNC状态过滤对DDL，DCL，资源管理，统计信息，save point影响。
1. DCL需要MN校验是否添加DDL LOCK命令字列齐。
1. 修改分两步:  1. 修复DCL提交MN校验DDL LOCK。 2. CN扩容CM添加扩容状态修改.  先修改1提MR修复问题单，2CCB转需求修改.
,Posted by liaozengkang at 三月 19, 2024 11:33|
|---|
