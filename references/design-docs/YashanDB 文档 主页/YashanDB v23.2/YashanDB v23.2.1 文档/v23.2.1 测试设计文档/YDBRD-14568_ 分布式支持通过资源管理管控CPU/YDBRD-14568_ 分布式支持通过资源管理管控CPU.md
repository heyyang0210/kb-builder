SR链接：    [YDBRD-14568](https://jira.yasdb.com/browse/YDBRD-14568?src=confmacro)    -  分布式支持通过资源管理管控CPU  完成

# 目录



-   [目录](#YDBRD14568:分布式支持通过资源管理管控CPU-目录)  
-   [1. Overview (概述)](#YDBRD14568:分布式支持通过资源管理管控CPU-1.Overview(概述))  
-   [2. Features (功能特性)](#YDBRD14568:分布式支持通过资源管理管控CPU-2.Features(功能特性))  
-   [3. Interfaces (接口)](#YDBRD14568:分布式支持通过资源管理管控CPU-3.Interfaces(接口))  
    -   [3.1. 高级包调用接口](#YDBRD14568:分布式支持通过资源管理管控CPU-3.1.高级包调用接口)  
    -   [3.2. 内部接口](#YDBRD14568:分布式支持通过资源管理管控CPU-3.2.内部接口)  
-   [4. Limitations (功能限制)](#YDBRD14568:分布式支持通过资源管理管控CPU-4.Limitations(功能限制))  
-   [5. Detail Design (详细设计)](#YDBRD14568:分布式支持通过资源管理管控CPU-5.DetailDesign(详细设计))  
    -   [5.1. 文件目录结构](#YDBRD14568:分布式支持通过资源管理管控CPU-5.1.文件目录结构)  
    -   [5.2. 数据一致性保证](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.数据一致性保证)  
        -   [5.2.1 系统表变更](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.1系统表变更)  
        -   [5.2.2 约束](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.2约束)  
        -   [5.2.2 一阶段提交](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.2一阶段提交)  
            -   [5.2.2.1 执行流程](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.2.1执行流程)  
        -   [5.2.3 限制匿名块内资源管理命令的数量](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.3限制匿名块内资源管理命令的数量)  
            -   [5.2.3.1 场景分析](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.3.1场景分析)  
        -   [5.2.3.2 实现方案](#YDBRD14568:分布式支持通过资源管理管控CPU-5.2.3.2实现方案)  
    -   [5.3. 节点扩缩容](#YDBRD14568:分布式支持通过资源管理管控CPU-5.3.节点扩缩容)  
        -   [5.3.1 节点扩容](#YDBRD14568:分布式支持通过资源管理管控CPU-5.3.1节点扩容)  
        -   [5.3.2 节点缩容](#YDBRD14568:分布式支持通过资源管理管控CPU-5.3.2节点缩容)  
    -   [5.4 并发控制](#YDBRD14568:分布式支持通过资源管理管控CPU-5.4并发控制)  
    -   [5.5 视图](#YDBRD14568:分布式支持通过资源管理管控CPU-5.5视图)  
        -   [5.5.1 DBA_RSRC_CONSUMER_GROUPS](#YDBRD14568:分布式支持通过资源管理管控CPU-5.5.1DBA_RSRC_CONSUMER_GROUPS)  
        -   [5.5.2 DBA_RSRC_GROUP_MAPPINGS](#YDBRD14568:分布式支持通过资源管理管控CPU-5.5.2DBA_RSRC_GROUP_MAPPINGS)  
        -   [5.5.3 DBA_RSRC_PLAN_DIRECTIVES](#YDBRD14568:分布式支持通过资源管理管控CPU-5.5.3DBA_RSRC_PLAN_DIRECTIVES)  
        -   [5.5.4 DV$CPUSTAT](#YDBRD14568:分布式支持通过资源管理管控CPU-5.5.4DV$CPUSTAT)  
-   [6. Test Cases (自测用例)](#YDBRD14568:分布式支持通过资源管理管控CPU-6.TestCases(自测用例))  
-   [7. Workload (工作量)](#YDBRD14568:分布式支持通过资源管理管控CPU-7.Workload(工作量))  
-   [8. References (参考文档)](#YDBRD14568:分布式支持通过资源管理管控CPU-8.References(参考文档))  
-   [9. TODO (遗留问题)](#YDBRD14568:分布式支持通过资源管理管控CPU-9.TODO(遗留问题))  
-   [10. 会议纪要](#YDBRD14568:分布式支持通过资源管理管控CPU-10.会议纪要)  




  


# 1. Overview (概述)

将CPU资源管理功能从单机推广到分布式，满足分布式管理需求，保证MN、CN和DN上的数据一致性，实现统一的资源管理。并且支持主备切换（不支持级联备）、扩缩容等任务。

# 2. Features (功能特性)

1. 用户线程实现统一的CPU管控；
1. 所有节点上的CPU资源配比保持一致；
1. 当出现故障和异常时，保证所有节点最终一致；
1. 扩缩容时，保证扩容节点（CN或DN）的资源管理与主MN节点一致；（细节需确认）
1. 提供DBA视图和动态DV$CPUSTAT


# 3. Interfaces (接口)

## 3.1. 高级包调用接口

复用单机下CPU资源管理的高级包调用命令。在分布式下，通过CN调用资源管理命令，由CN分发给其它节点执行。

```
1. DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(consumer_group VARCHAR(64), COMMENT VARCHAR(2000));

2. DBMS_RESOURCE_MANAGER.DELETE_CONSUMER_GROUP(consumer_group VARCHAR(64));

3. DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING(user VARCHAR(64), user_name VARCHAR(64), consumer_group VARCHAR(2000));

4. DBMS_RESOURCE_MANAGER.DELETE_CONSUMER_GROUP_MAPPING(user	VARCHAR(64), user_name VARCHAR(64));

5. DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(plan VARCHAR(64), consumer_group VARCHAR(64), cpu_share INTEGER, cpu_limit INTEGER);

6. DBMS_RESOURCE_MANAGER.UPDATE_PLAN_DIRECTIVE(plan VARCHAR(64), consumer_group VARCHAR(64), cpu_share INTEGER, cpu_limit INTEGER);

7. DBMS_RESOURCE_MANAGER.DELETE_PLAN_DIRECTIVE(plan VARCHAR(64), consumer_group VARCHAR(64));
```

注：不允许直连MN或DN修改机器上的资源配比。

## 3.2. 内部接口

新增如下内部接口

```
// 判断执行语句是否包括资源管理高级包
CodResult isDstbAnonyResControlBlock();
// MN调用接口
static CodResult execAnonyousResControlEntry(AnlStmt* stmt);
// CN、MN下根据ddlCtx执行
static CodResult execAnonymousResControlCtx(AnlStmt* stmt, const DdlContext* ddlCtx);
// CN上判断是否包含资源管理指令以及指令数量
static CodResult adoVerifyResourceManager(AnlVerifier* vrfr, CodPointer Ctx);
// oid锁
static CodResult executeLockCgroupOids(AnlStmt* stmt);
```

# 4. Limitations (功能限制)

参考    [分布式资源管理规格对齐 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133585957)  

|序号|描述|备注|
|:---:|:---:|:---:|
|1|只支持Linux系统，不支持windows等其它系统|基于cgroup实现的资源管理功能，目前只支持linux|
|2|只有SYS用户能够调用资源管理命令|具备DBA权限的用户也不能调用资源管理命令|
|3|不支持直连MN和DN调用资源管理命令|现阶段只实现多节点的资源配比一致，不一致的方案还没想到。后续有能力实现不一样配比方案也不一定会放开这部分限制，修改单节点的资源管控可以通过yasboot实现，也更方便|
|4|匿名块内调用资源管理命令只允许  **逐条执行**  ，且不能与其它类型语句混合|资源管理命令比较特殊，类似DDL语句，一旦写入文件，回滚代价较大，因此与其它类型语句混合时，一旦出现故障和异常，难以处理；目前会在编译后，执行前判断匿名块内的语句命令数量，一旦有多条就会报错；    
    
|


# 5. Detail Design (详细设计)

## 5.1. 文件目录结构

1.分布式cgroup的目录结构与单机类似，一旦打开资源管理开关，将分别在每个节点下创建对应的目录和文件。

![](https://pingcode.yasdb.com/atlas/files/public/67396b978970c2af4f52059a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQ0FBQUFBQUFBZ0FBQUFBQUFnQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBRUFRQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFDQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU2ODAsImV4cCI6MTc4MjMwNjQ4MH0.kAKDbdt6FDsSM4RzvumR1L8mFrCMkIJim-huShq3DfY)

2.一键开启命令需要OM提供支持（    [host info | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/yasboot/yasboot%E5%91%BD%E4%BB%A4%E4%BB%8B%E7%BB%8D/yasboot%20host.html#host-cgroup-create)    ）

3.单机下cgroup-path的表现

![](https://pingcode.yasdb.com/atlas/files/public/67396b97a1ad9a3311dc8413/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQ0FBQUFBQUFBZ0FBQUFBQUFnQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBRUFRQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFDQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU2ODAsImV4cCI6MTc4MjMwNjQ4MH0.kAKDbdt6FDsSM4RzvumR1L8mFrCMkIJim-huShq3DfY)

## 5.2. 数据一致性保证

### 5.2.1 系统表变更

使用oid+version的方案实现分布式下各节点的数据一致性，因此现有的资源管理系统表需要修改：

|系统表|修改项|备注|
|---|---|---|
|RSRC_CONSUMER_GROUPS$|新增字段id BINARY_BIGINT|单机下不使用该字段，创建和删除时添加排他锁，修改资源指令时添加共享锁 |
|RSRC_GROUP_MAPPINGS$|新增字段id BINARY_BIGINT|单机下不使用该字段，创建和删除时添加排他锁，修改用户和consumer_group时添加共享锁|
|RSRC_PLAN_DIRECTIVES$|新增字段id BINARY_BIGINT和version BINARY_BIGINT|单机下不使用该字段，创建和删除，修改时添加排他锁|


### 5.2.2 约束

分布式与单机的区别：

1. 新增字段id和version只有通过CN执行资源管理命令时才会设置；
1. 数据库启动加载默认的SYS_GROUP、DEFAULT_CONSUMER_GROUP以及创建后台线程资源指令时均不使用id和version字段。


### 5.2.2 一阶段提交

CPU资源管理底层依赖cgroup组件，其中在创建计划指令时会创建相应的目录和文件并写入内容。因此为了保证执行成功和节点间数据的一致性，需要走一阶段提交。一旦MN执行成功，则视为所有节点执行成功。故障场景下，由MN推送给CN和DN执行保障所有节点的数据一致性。

![](https://conf.yasdb.com/download/attachments/91771381/DDL%E6%89%A7%E8%A1%8C%E6%A1%86%E6%9E%B6%E7%AE%80%E5%9B%BE-%E4%B8%8D%E6%94%AF%E6%8C%81%E4%B8%A4%E9%98%B6%E6%AE%B5%E7%9A%84DDL%E6%B5%81%E7%A8%8B.png?version=1&modificationDate=1666339178000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQ0FBQUFBQUFBZ0FBQUFBQUFnQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBRUFRQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFDQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU2ODAsImV4cCI6MTc4MjMwNjQ4MH0.kAKDbdt6FDsSM4RzvumR1L8mFrCMkIJim-huShq3DfY)

#### 5.2.2.1 执行流程

具体执行流程如下图：

1. CN上会校验匿名块内的语句数量，具体实现在adoVerifyResourceManager()函数；
1. MN上执行时会分配全局唯一的oid和version，执行成功立即commit，并写入ddl_queue和ddl_log；
1. 如果其它节点执行失败，则通过ddl_queue后台推送，保证最终一致性。


![](https://pingcode.yasdb.com/atlas/files/public/67396b978970c2af4f52059b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQ0FBQUFBQUFBZ0FBQUFBQUFnQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBRUFRQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUJBQUFBQUFBQUFBQUFDQUFBQkFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU2ODAsImV4cCI6MTc4MjMwNjQ4MH0.kAKDbdt6FDsSM4RzvumR1L8mFrCMkIJim-huShq3DfY)

### 5.2.3 限制匿名块内资源管理命令的数量

#### 5.2.3.1 场景分析

|序号|场景|用例|预期|备注|
|---|---|---|---|---|
|一|匿名块内多条资源管理命令|begin    
  dbms_resource_manager.create_consumer_group('TeStGroup1','Comment1');    
  dbms_resource_manager.delete_consumer_group('TeStGroup1');    
  end;    
  /|预期报错，报错信息,YAS-04371 unsupport dbms_resource_manager with multiple sql in distributed database|报错信息待确认|
|二|匿名块内多条资源管理命令，且带有  **异常分支**|begin    
  dbms_resource_manager.create_consumer_group('TeStGroup1','Comment1');    
  dbms_resource_manager.delete_consumer_group('TeStGroup1');    
  exception    
  when others then    
  dbms_output.put_line(SQLCODE || SQLERRM);    
  end;    
  /|预期报错，报错信息,YAS-04371 unsupport dbms_resource_manager with multiple sql in distributed database|拦截放在了匿名块编译阶段，因此不会走异常分支|
|三|匿名块内混合资源管理命令和其它语句|begin    
  dbms_resource_manager.create_consumer_group('TeStGroup1','Comment1');    
  dbms_output.put('TEST');    
  end;    
  /|预期报错，报错信息,YAS-04371 unsupport dbms_resource_manager with multiple sql in distributed database|无法在匿名块编译期拦截|
|四|使用  **EXEC**  调用资源管理命令|EXEC dbms_resource_manager.create_consumer_group('TeStGroup','Comment');|预期成功|  
|
|五|使用  **CALL**  调用资源管理命令|CALL dbms_resource_manager.create_consumer_group('TeStGroup','Comment');|预期成功|  
|


### 5.2.3.2 实现方案

目前实现的是方案三

|方案|实现方式|优点|缺点|
|---|---|---|---|
|方案一|匿名块内编译时判断资源管理指令是否是第二条命令|简单，报错带有匿名块编译报错信息|1.如果匿名块带有异常分支，报错不会走异常分支,2.无法拦截资源管理指令的位置大于第二条的情况|
|方案二|匿名块内执行时判断资源管理指令是否是第二条命令|1.报错时能够走异常分支|1.无法拦截资源管理指令的位置大于第二条的情况,2.当匿名块内有多条资源管理命令时，第一条资源管理命令会执行成功，剩下的会执行失败|
|方案三|在CN上，匿名块编译后，执行前会经过verify阶段，判断整个匿名块内的语句数量|1.拦截所有场景|1.报错没有匿名块的编译信息，无法知道是在编译报错还是执行报错|
|方案四|混合方案一和方案三，方案三主要用于拦截场景三|1.拦截所有场景|1.不同场景的报错信息不一致|


## 5.3. 节点扩缩容

### 5.3.1 节点扩容

无论是CN节点还是DN节点扩容，都涉及元数据的迁移。当进行节点扩容时，把资源管理调用命令当作元数据处理即可。参考CN节点扩容过程，将恢复资源管理的调用命令发送到新的节点，让新节点重新执行一遍即可。

### 5.3.2 节点缩容

节点缩容后脱离了yasboot的管理，此时缩容节点也不会受到资源管控。

  


## 5.4 并发控制

|场景|锁动作|备注|
|---|---|---|
|创建/删除资源组|资源组oid加TX锁|  
|
|创建/删除资源映射|用户id加TS锁，资源组加TS锁，映射id加TX锁|  
|
|创建/删除资源指令|资源组加TS锁，指令id加TX锁|  
|
|修改资源指令|资源组加TS锁，指令id加TX锁|  
|


  


## 5.5 视图

### 5.5.1 DBA_RSRC_CONSUMER_GROUPS

该视图用于展示数据库中所有资源组的信息

|字段|类型|是否可以为NULL|描述|
|---|---|---|---|
|CONSUMER_GROUP_ID|BIGINT|YES|资源使用组 ID（SYS_GROUP和DEFAULT_CONSUMER_GROUP，以及单机下添加的资源组没有ID）|
|CONSUMER_GROUP|VARCHAR(64)|NO|资源组的名称|
|CPU_METHOD|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_METHOD|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|INTERNAL_USE|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|COMMENTS|VARCHAR(2000)|YES|对资源组的备注信息|
|CATEGORY|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|STATUS|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MANDATORY|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|


### 5.5.2 DBA_RSRC_GROUP_MAPPINGS

本视图显示数据库中用户和资源使用组之间的映射关系  。

|字段|类型|是否可以为NULL|描述|
|---|---|---|---|
|ATTRIBUTE|VARCHAR(64)|NO|属性，当前仅支持  USER|
|VALUE|VARCHAR(64)|NO| 属性值，当属性为  USER  时，记录的是用户名|
|CONSUMER_GROUP|VARCHAR(64)|NO|用户映射的资源使用组的名称|
|STATUS|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|


### 5.5.3 DBA_RSRC_PLAN_DIRECTIVES

该视图用于记录数据库中每组资源计划指令的详细信息。

|字段|类型|是否可以为NULL|描述|
|---|---|---|---|
|PLAN|VARCHAR(64)|NO|资源指令的名称|
|GROUP_OR_SUBPLAN|VARCHAR(64)|NO|指令所属的资源使用组名|
|TYPE|VARCHAR(14)|NO|标识GROUP_OR_SUBPLAN是指资源使用组还是计划，目前仅支持资源使用组|
|CPU_P1|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|CPU_P2|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|CPU_P3|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|CPU_P4|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|CPU_P5|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|CPU_P6|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|CPU_P7|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|CPU_P8|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_P1|INTEGER|NO|CPU 共享模式比重|
|MGMT_P2|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_P3|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_P4|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_P5|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_P6|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_P7|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MGMT_P8|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|ACTIVE_SESS_POOL_P1|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|QUEUEING_P1|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|PARALLEL_TARGET_PERCENTAGE|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|PARALLEL_DEGREE_LIMIT_P1|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_GROUP|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_FOR_CALL|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_TIME|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_IO_MEGABYTES|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_IO_REQS|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_ESTIMATE|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MAX_EST_EXEC_TIME|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|UNDO_POOL|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MAX_IDLE_TIME|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MAX_IDLE_BLOCKER_TIME|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MAX_UTILIZATION_LIMIT|INTEGER|NO|CPU 独占模式比重|
|PARALLEL_QUEUE_TIMEOUT|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_TIME_IN_CALL|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_IO_LOGICAL|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SWITCH_ELAPSED_TIME|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|PARALLEL_SERVER_LIMIT|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|UTILIZATION_LIMIT|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|PARALLEL_STMT_CRITICAL|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|SESSION_PGA_LIMIT|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|PQ_TIMEOUT_ACTION|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|COMMENTS|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|STATUS|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|
|MANDATORY|VARCHAR(1)|YES|仅用于兼容，目前值固定为NULL|


### 5.5.4 DV$CPUSTAT

继承单机V$CPUSTAT，用于记录资源组使用的CPU时间和限制情况。

|字段|类型|是否可以为NULL|描述|
|---|---|---|---|
|GROUP_ID|INTEGER|NO|组ID|
|GROUP_NODE_ID|INTEGER|NO|组内节点ID|
|RESNAME|VARCHAR(256)|NO|资源使用组的名称|
|USER|VARCHAR(256)|NO|表示所有子进程在用户态运行的 CPU 时间总和|
|SYSTEM|VARCHAR(256)|NO|表示所有子进程在内核态运行的 CPU 时间总和|
|NR_PERIODS|VARCHAR(256)|NO|表示在限制CPU使用率的时间段内，任务被调度器调度的次数|
|NR_THROTTLED|VARCHAR(256)|NO|表示在限制CPU使用率的时间段内，任务被限制的次数|
|THROTTLED_TIME|VARCHAR(256)|NO|表示在限制CPU使用率的时间段内，任务被限制的时间总和|


# 6. Test Cases (自测用例)

|场景|预期|进展|备注|
|---|---|---|---|
|所有节点正常且均打开开关，执行资源管理命令|所有资源管理命令正常执行|部分实现|指令执行正常，并发尚未实现，开关未测试|
|所有节点正常但存在节点开关未打开，执行资源管理命令|所有资源管理命令正常执行，但开关未打开的节点不生效|  
|  
|
|资源管理命令执行过程中MN失败|执行失败，所有节点回滚|  
|  
|
|资源管理命令执行过程中CN/DN失败|执行成功，由MN推送给失败节点|  
|  
|
|并发执行，修改资源指令的同时删除消费者组|执行失败，报错|  
|  
|
|多条资源管理命令在一个匿名块内|执行失败，报错不支持|部分实现，会在编译后，执行前进行verify判断语句数量；但是verify阶段不属于编译和执行，因此没有走异常流程；放在编译期内报错也不会走异常流程|如果匿名块有异常分支，则不会走异常分支    
    
|
|资源管理命令混合其它语句在一个匿名块内|执行失败，报错不支持|  
|  
|
|CN/DN扩缩容，数据是否一致|扩容节点数据与MN保持一致|  
|  
|
|主备切换，数据是否一致|数据保持一致|  
|  
|
|版本升级|升级后需要支持资源管理功能|  
|  
|
|视图查看|提供DBA视图和动态视图|部分实现，DBA视图已实现，动态视图未实现|DBA视图显示内容待确认，动态视图待确认|


  


# 7. Workload (工作量)

|任务|描述|工作量（人/天）|责任人|
|---|---|---|---|
|资源管理系统表改造|RSRC_CONSUMER_GROUP$新增id字段，RSRC_GROUP_MAPPINGS$新增字段id，RSRC_PLAN_DIRECTIVES$新增字段id和version|已实现|赖美全|
|资源数据一致性保障|分布式下故障推送，涉及是否支持多条语句执行|已实现|赖美全|
|资源数据并发修改|并发下对系统表的访问，涉及共享锁和排他锁的实现|已实现，待验证|赖美全|
|分布式视图实现|分布式视图和单机视图|部分实现|赖美全|
|支持扩缩容|扩缩容保证数据一致，以扩容节点的数据为准|已实现，待验证|赖美全|
|yasboot支持资源管理相关功能|1.按cluser/group/node级别打开资源管理开关；,2.扩缩容支持；,  
|  
|瞿蓝孟|
|文档|分布式资源管理文档，高危操作（修改后台线程配比）|6~8|赖美全|
|上车|  
|  
|  
|
|代码review|  
|  
|  
|
|问题单|  
|  
|  
|


# 8. References (参考文档)

[1].     [单机支持资源管理管控CPU详细设计方案](109598257.html)  

[2].     [YashanDB 分布式CPU 资源管理](/pages/createpage.action?spaceKey=YAS&title=YashanDB+%E5%88%86%E5%B8%83%E5%BC%8FCPU+%E8%B5%84%E6%BA%90%E7%AE%A1%E7%90%86)  

[3].     [YashanDB的元数据管理方案](/pages/createpage.action?spaceKey=YAS&title=YashanDB%E7%9A%84%E5%85%83%E6%95%B0%E6%8D%AE%E7%AE%A1%E7%90%86%E6%96%B9%E6%A1%88)  

[4].     [分布式订阅推送方案设计](/pages/createpage.action?spaceKey=YAS&title=%E5%88%86%E5%B8%83%E5%BC%8F%E8%AE%A2%E9%98%85%E6%8E%A8%E9%80%81%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

[5].     [YDBRD-12916: 分布式CN扩容设计](119544064.html)  

# 9. TODO (遗留问题)

1. CGROUP_DIR目录在不同节点上不一致的表现？


# 10. 会议纪要

设计评审时间: 2023/11/13

转测：2023/12/06

## Attachments:

[image2023-11-9_11-14-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTdhMWFkOWEzMzExZGM4NDBmIiwicmVmX2lkIjoiNjczOTZiOTY3MjgyMDZlZmI5MmYwN2RlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjgwLCJleHAiOjE3ODIzODIwODB9.Yu2jDql4hpBvBNrK6lVQQCjg8MTDO8GLC1t1TLZ2H0c)

 (image/png)    


[image2023-11-13_9-41-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTdhMWFkOWEzMzExZGM4NDExIiwicmVmX2lkIjoiNjczOTZiOTY3MjgyMDZlZmI5MmYwN2RlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjgwLCJleHAiOjE3ODIzODIwODB9.4cajycrdaZKCkgW_F_ugbjXilsNyW4pV9QILyNu9PtY)

 (image/png)    


[image2023-11-13_9-42-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTc4OTcwYzJhZjRmNTIwNTk5IiwicmVmX2lkIjoiNjczOTZiOTY3MjgyMDZlZmI5MmYwN2RlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NjgwLCJleHAiOjE3ODIzODIwODB9.wvcKkSdhw3OrVcBLCA5cI4yOyzJTXSus_jX-i0VZHdU)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：,时间: 2023年11月13日 1100 ~12:00,参与人员：陈步隆  何阳 赖美全 施新华 罗爽,1. DBA视图具体内容要和ORACLE对齐 -- 赖美全
1. OM部分需要找工具确认 --
1. 自测用例（需要关注覆盖率）  -- 赖美全
,Posted by laimeiquan at 一月 04, 2024 19:56|
|---|


