Created by 郑嘉星, last modified by  张璐恒 on 一月 30, 2024

##   [一、概述](#一概述)  

随着业务量增大，数据需要分布在更多的节点上，所以需要能动态增删数据节点。同时保证具有较好的迁移效率、较小的业务影响，以及较好的易用性和故障恢复能力。

在23.1版本，为了减少服务端对外部的依赖，扩容流程的控制中心从工具转移到服务端，使用户可以通过SQL命令就可以完成数据的重分布。

  [数据空间管理](https://conf.yasdb.com/pages/viewpage.action?pageId=76917292)  

  [信通院版本在线扩容](https://conf.yasdb.com/pages/viewpage.action?pageId=95107243)  

##   [二、 功能特性](#二-功能特性)  

支持在线增加DN节点组，并且保证数据及时均衡到所有节点组中。用户也可以按自己的需求，让数据在不同DN组有更灵活的分布。

##   [三、接口](#三接口)  

###   [OM命令](#om命令)  

####   [3.1 主机相关](#31-主机相关)  

#####   [3.1.1如果host为新增的主机](#311如果host为新增的主机)  

该命令会生成hosts_add.toml，生成yasdbName_add.toml，新增主机和节点信息；如果文件已经存在，会被覆盖

```
yasboot config group gen -c yashandb -u yashan -p password --ip 127.0.0.1 --port 22 --node 2 --group 2

```

参数：

|选项|含义|
|---|---|
|-c, --cluster|生成的集群名称|
|-u, --username|主机ssh用户名|
|-p, --password|ssh登录密码|
|-N|ssh免密登录|
|--ip|部署的ip地址，允许多个ip上新增|
|--port|主机ssh连接端口|
|-i, --install-path|数据库安装路径（HOME目录）|
|--host-id|host id|
|--data-path|数据库实例的DATA目录|
|-f, --force|是否强制部署数据库，强制表示不会检查当前主机运行状态是否能够部署|
|--node|新增的总节点数。默认为1|
|--group|新增的总组数。默认为1|


hosts_add.toml示例

```
cluster = "tt"
secret_key = "5457c544ee7da671"
[om]
hostid = "host0001"
[om.config]
LISTEN_ADDR = "192.168.0.1:1675"

[[host]]
hostid = "host0001"
user = "jenkins"
ip = "192.168.0.1"
port = 22
path = "/var/lib/jenkins/anchorbase/install"
[host.yasagent]
	[host.yasagent.config]
    	LISTEN_ADDR = "192.168.0.1:1676"

```

#####   [3.1.2 如果host为已有的主机](#312-如果host为已有的主机)  

主机id为hosts.toml中的hostid字段

```
yasboot config group gen --host-id host0001  --node 2 --cluster yashandb

```

|--host-id|主机的id）|
|---|---|
|--node|新增的总节点数。默认为1|
|--cluster|集群名称|


#####   [3.1.3 部署主机](#313-部署主机)  

```
yasboot host add --install-pkg yashandb-22.2.0.9-linux-x86_64.tar.gz -t hosts_add.toml

```

|选项|含义|
|---|---|
|--disable|屏蔽任务进度条展示|
|-c,--cluster|集群名称|
|-f, --force|忽略错误并强制安装，默认为false|
|-i,--install-pkg|软件包文件本地路径|
|-t,--toml|要安装软件包的主机相关信息的配置文件|


####   [3.2 扩容命令](#32-扩容命令)  

```
 yasboot group add --toml yasdbName_add.toml --cluster yashandb

```

|选项|含义|
|---|---|
|-t,--toml|扩容的节点配置文件|
|-c,--cluster|集群名称|
|“-w, --nowait”|运行后不等待执行命令结果|
|“-d, --child”|展示任务以及子任务信息|


####   [3.3 重分布命令](#33-重分布命令)  

临时设置，直接调用db高级包

```
yasboot dataspace redistribute --dataspace-id 0 --cluster yashandb


```

|选项|含义|
|---|---|
|-c,--cluster|集群名称|
|--dataspace-id||


```
// 和重分布公用，有chunkid走move
yasboot dataspace redistribute --dataspace-id 0 --chunk-id 1,2 --target-group 111 --cluster yashandb

```

|选项|含义|
|---|---|
|-c,--cluster|集群名称|
|--dataspace-id||
|--chunk-id||
|--target-group||


####   [3.4 缩容命令](#34-缩容命令)  

```
 yasboot group remove --cluster yashandb --group-id 3 --purge --force

```

|选项|含义|
|---|---|
|-c,--cluster|集群名称|
|--purge|清理节点data数据。默认为false|
|-f,--force|true：跳过删除节点的确认操作。默认为false|
|--group-id|要删除的组id|


##   [](#)  

**1. 执行扩容DN组的命令：**

打屏信息：

新DN组拉起，所有节点NOMOUNT->OPEN

扩容任务状态变化，INIT->START->FINISH

重分布任务状态变化，INIT->START->FINISH

（用户也可以自己连mn查v$task视图，查看任务详细信息，    [任务框架设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=109601837)    ）

**2. 清理失败的扩容任务**

删除group的能力包含清理增加节点组任务残留。

删除组有单独的SR承载     [https://jira.yasdb.com/browse/YDBRD-6406](https://jira.yasdb.com/browse/YDBRD-6406)  

**命令细节参考增删节点方案**    [om支持单机/分布式组内扩缩节点设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=109595114)  

##   [四、功能限制](#四功能限制)  

###   [规格限制](#规格限制)  

只支持一个内置的dataspace，不支持用户创建dataspace。

一次可以增加[1,31]个DN组，组内可以有多个节点。

###   [并发限制](#并发限制)  

集群中增删节点组命令和其他会改变集群状态的命令不能并发，如组内增删节点、集群正常停止或重启（-f可以）等。

增删节点组过程中，执行ddl会报错。

###   [集群状态要求](#集群状态要求)  

扩容命令开始执行时所有主节点状态正常，否则报错。

迁移表空间过程中，目标DN组所有主备机全程在线，否则报错。

###   [故障恢复](#故障恢复)  

不支持扩容任务续接，如果执行到一半失败，只能保证已经成功的部分可用，失败的部分可清理，但不能重新执行任务。

重分布过程中出现异常中断情况，chunk迁移会保持在出现中断时的状态，可能会有一部分chunk迁移成功，一部分chunk迁移失败。

##   [五、详细设计](#五详细设计)  

###   [5.1 主要流程](#51-主要流程)  

**扩容：**

```
添加带多个节点的DN组
    用高级包到MN创建相关集群信息
    新DN节点拉起，建库，到OPEN状态
    迁移数据：
        注册系统级dataspace扩容任务到MN
        启动系统级dataspace扩容任务
            限制DDL
            同步元数据
            同步复制表空间（过程中限制复制表DML并发，重试尽量不报错）
            刷新系统级dataspace元数据
            放开DDL限制
    系统级dataspace下的分布表数据重分布（可选）：
        注册重分布任务
        启动重分布任务

```

dataspace扩容定义为dataspace包含的DN组的增加，dataspace包含的DN组就是dataspace的chunk可以选择去分布的范围（chunk也可以只分布在其中的部分DN组）

系统级dataspace扩容会多一层含义，系统级dataspace的DN组，同时表示有全量元数据和复制表数据的DN组（DDL和复制表DML只会到这些DN组上去执行）。系统级dataspace只有一个。

**缩容：**

```
移除多个DN组
    注册系统级dataspace缩容任务
    启动系统级dataspace缩容任务
        限制DDL
        迁移所有被移除DN组的chunk到剩余DN组
        刷新系统级dataspace元数据（从dataspace$.groups中移除）
        放开DDL限制
    用高级包到MN删除相关DN组信息
    停止所以被移除节点进程（可选）
    删除所有被移除节点数据目录（可选）

```

  


![](https://pingcode.yasdb.com/atlas/files/public/67396a2e8970c2af4f51fced/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1NDgsImV4cCI6MTc4MjIyMjM0OH0.IYxdm89lifIqrwnQsSaW5At4sY-EQ6lq5GrXfhH108o)

  


###   [5.2 模块划分](#52-模块划分)  

####   [5.2.1 服务端提供给OM的接口](#521-服务端提供给om的接口)  

**1. 增加DN组和节点的集群信息**

```
DBMS_CM.CREATE_GROUP()

DBMS_CM.CREATE_NODE()

```

**2. 注册并启动扩容任务**

扩缩容相关任务命名示例：

- ADD_GROUP：扩容DN组使用，如果后续支持扩容MN组时，逻辑没有差异，则可以重用，否则扩展ADD_MN_GROUP
- ADD_NODE： 扩容DN组内节点使用，如果后续支持扩展MN组时，逻辑没有差异，则可以重用，否则扩展ADD_MN_NODE
- ADD_CN_GROUP：当前不实现
- ADD_CN_NODE：扩容CN使用
- REMOVE_GROUP: 缩容使用REMOVE前缀


增加任务接口使用示例：

```
DECLARE
    task_id BIGINT;
BEGIN
    DBMS_TASK.ADD(
        task_id,
        'ADD_GROUP',
        '{"GROUP": 5}'
    );
    DBMS_TASK.START(task_id)；
END;
/

```

**3. 注册并启动缩容任务**

增加任务接口使用示例：

```
DECLARE
    task_id BIGINT;
BEGIN
    DBMS_TASK.ADD(
        task_id,
        'REMOVE_GROUP',
        '{"GROUP": [5,6,7]}'
    );
    DBMS_TASK.START(task_id)；
END;
/

```

**4. 查询任务状态**

系统视图V$TASK

```
SELECT 
    STATUS 
from
    V$TASK
where 
    ID = task_id

```

####   [5.2.2 任务管理框架回调函数定义](#522-任务管理框架回调函数定义)  

```
typedef struct StAndTask {
    CodUint64 id;
    CodUint64 parentId;
    CodUint32 type;
    CodUint8 parentStep;
    CodUint8 currentStep;
    CodUint8 totoalStep;
    CodUint8 status;
    CodUint8 tryTimes;
    CodUint8 failTimes;
    Variant* jsonData;
    CodChar lastError[64];
    CodDate createTime;
    CodData updateTime;
} AndTask;

typedef struct StAndTaskCaller {
    CodUint64 taskId;         // 执行任务的Id
    CodBool isLocal;
    CodBool needRespPrimary;  // 需要回应主节点
    CodUint16 reqEndpoint;
    CodNodeId reqNode;        // 远程请求节点信息
    volatile isCancel;        // 任务打断标志，任务过程中需要响应打断
} AndTaskCaller;

// 任务数据校验，高级包add函数时，由具体任务逻辑对数据进行校验
// todo: 回调接口待讨论
typedef CodResult (*AndTaskCreate)(AnlStmt* stmt, Variant* jsonData);
typedef CodResult (*AndTaskExecute)(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task);    // 执行或重新执行任务，需要支持重入
typedef CodResult (*AndTaskRollback)(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task);   // 回滚已经异常的任务，需要支持重入
typedef struct StAndTaskEntry {
    CodText name;
    AndTaskCreate create;
    AndTaskExecute execute;    // 非子任务的执行、回滚可以使用内置默认函数，也可以自定义实现
    AndTaskRollback rollback;
} AndTaskEntry;

typedef enum EnAndTaskType {
    AND_TASK_ADD_GROUP = 1000,
    AND_TASK_TRANSPORT_META_DATA = 1001,
    AND_TASK_TRANSPORT_DUP_SPACE = 1002,
} AndTaskType;

static AndTaskEntry gTasks[] = {
    [AND_TASK_ADD_GROUP] = {
        .name = COD_TEXT_DEF("ADD GROUP"),
        .create = createAddGroupTask,
        .execute = executeAddGroupTask,
        .rollback = rollbackAddGroupTask,
    },
    
    [AND_TASK_TRANSPORT_META_DATA] = {
        .name = COD_TEXT_DEF("TRANSPORT META DATA"),
        .create = createTransportMetaDataTask,
        .execute = executeTransportMetaDataTask,
        .rollback = rollbackTransportMetaDataTask,
    },

    [AND_TASK_TRANSPORT_DUP_SPACE] = {
        .name = COD_TEXT_DEF("TRANSPORT DUP SPACE"),
        .create = createTransportDupSpaceTask,
        .execute = executeTransportDupSpaceTask,
        .rollback = rollbackTransportDupSpaceTask,
    }
}


```

####   [5.2.3 迁移父任务接口实现](#523-迁移父任务接口实现)  

#####   [json定义:](#json定义)  

```
{
    "target group id": xxx
}

```

```
CodResult createAddGroupTask(AnlStmt* stmt, Variant* jsonData)
{
    // 0. 检查是否已存在AddGroupTask且状态不为FINISH或FAILED，是则返回报错
    // 1. 使用传入的包含新DN组id的jsonData，创建迁移元数据子任务（step 1），创建迁移复制表空间子任务（step 2）。（后面主节点信息，表空间信息还可能变化，所以不能在一开始都确定下来。）
    return COD_SUCCESS;
}

CodResult executeAddGroupTask(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task)
{
    // 1. 执行迁移元数据子任务(如果已成功，跳过；如果已失败，直接进入失败流程)
    // 2. 执行迁移复制表空间子任务(如果已成功，跳过；如果已失败，直接进入失败流程)

    // 失败后调用rollbackScaleOutTask，最后再将状态置为FAILED
    return COD_SUCCESS;
}

CodResult rollbackAddGroupTask(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task)
{
    // 1. 调回滚迁移元数据子任务
    // 2. 调回滚迁移复制表空间子任务
    return COD_SUCCESS;
}

```

####   [5.2.3 迁移元数据子任务接口实现](#523-迁移元数据子任务接口实现)  

#####   [json定义](#json定义-1)  

```
// 本地任务
{
    "target group id": xxx
}

// 远端任务
{
    "ddl line": "create table xxx;/create index xxx;/..."
}

```

#####   [接口实现](#接口实现)  

```
CodResult createImpMetaDataTask(AnlStmt* stmt, Variant* jsonData)
{
    // 生成任务的Task表记录，直接将包含目标DN组ID的jsonData写入系统表
    return COD_SUCCESS;
}

CodResult executeImpMetaDataTask(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task)
{
    // 根据caller-&gt;isLocal判断当前是本地还是远端
    //
    //  本地：
    //    0. 检查task-&gt;tryTimes判断是否曾经执行过，是则直接返回失败
    //    1. 禁止DDL操作
    //    2. 通过元数据迁移服务提供的接口获取一部分DDL语句，组装成远端任务
    //    3. 将远端任务发到目标DN组主节点
    //    4. 重复2,3直到获取完所有DDL语句
    //    5. 返回成功
    //
    //  远端：
    //    1. 执行任务消息中的DDL语句
    //    2. 回应对端
    return COD_SUCCESS;
}

CodResult rollbackImpMetaDataTask(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task)
{
    // 放开DDL限制
    return COD_SUCCESS;
}

```

#####   [输出：](#输出)  

1. 成功
1.     - 目标DN组同步（除segment外）全量元数据。
    - 禁止DDL执行。

1. 失败
1.     - 目标DN组残留部分元数据。
    - 放开DDL执行



#####   [可重入能力：](#可重入能力)  

不支持重试，报错后放开DDL限制，状态置为失败。

开始执行时发现曾经执行过，直接放开DDL限制并返回失败。

（后续有支持重试的能力，但是重试时间太长对业务会有影响，最好搭配任务取消能力）

####   [5.2.4 迁移复制表空间子任务接口实现](#524-迁移复制表空间子任务接口实现)  

#####   [json定义:](#json定义-2)  

```
// 本地任务
{
    "target group id": xxx,
    
    "source group id": xxx //（迁移执行过程中填入）
}

// 远端任务：迁移复制表空间
{
    "remote type": "TRANSPORT",

    "target group id": xxx,

    "target ip": xxx,
    
    "target port": xxx,

    "target file path": xxx
}

// 远端任务：修改路由
{
    "remote type": "MODIFY ROUTE",

    "target group id": xxx
}

// 远端任务：查询路由状态
{
    "remote type": "QUERY ROUTE",

    "target group id": xxx
}

```

#####   [接口实现：](#接口实现-1)  

```
CodResult createImpDupSpaceTask(AnlStmt* stmt, Variant* jsonData)
{
    // 生成任务的Task表记录，直接将包含目标DN组ID的jsonData写入系统表
    return COD_SUCCESS;
}

CodResult executeImpDupSpaceTask(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task)
{
    // 根据caller-&gt;isLocal判断当前是本地还是远端
    //
    //  本地：
    //    0. 检查task-&gt;jsonData中是否存在“source group id"信息，如有，生成“查询路由状态”远端任务，发到迁移该DN组主节点执行，如果发现元数据已刷新，直接跳到步骤6。检查task-&gt;tryTimes是否为0，如果非0，直接返回失败。
    //    1. 通过SpaceManager遍历所有表空间，记录其中SPCF_BUILTIN（内置），SPCF_DEFAULT（分布表）为false的复制表空间
    //    2. 从task-&gt;jsonData中读取迁移目标DN组id，并获取目标DN组的主节点ip、端口、数据文件路径
    //    3. 将复制表空间列表和目标DN组信息构造成json，生成“迁移复制表空间”远端任务
    //    4. 获取除迁移目标DN组之外的一个正常的DN组的主节点endpoint，并将该DN组id记录到当前task的jsonData中，同时将task-&gt;tryTimes加1，将对task的修改写入系统表
    //    5. 调用任务框架远端执行接口，将构造的“迁移复制表空间”远端任务发到第4步获取的节点上执行
    //    6. 生成“修改路由”远端任务，到除第4步获取的DN组之外的所有主节点上执行，重试直到所有节点返回成功。
    //    7. 放开DDL限制
    //
    //  远端：
    //    根据jsonData中的"remote type"，选择相应的执行流程
    //
    //    "IMP":
    //      1. 解析task-&gt;jsonData中的表空间列表和目标DN节点信息
    //      2. 以第一步获取的信息为参数调用ankDuplicateSpace命令
    //      3. 调用ankAlterDataspace接口，将目标DN组id加到USERS dataspace的dn groups中
    //      4. 回应远端
    //
    //    "MODIFY ROUTE":
    //      1. 调用ankAlterDataspace接口，将目标DN组id加到USERS dataspace的dn groups中，忽略dn group已存在的报错
    //      2. 回应远端
    //
    //    "QUERY ROUTE":
    //      1. 通过routeDict判断目标DN组id是否在USERS dataspace中。
    //      2. 回应远端一个布尔值
    return COD_SUCCESS;
}

CodResult rollbackImpDupSpaceTask(AnlStmt* stmt, AndTaskCaller* caller, AndTask* task)
{
    return COD_SUCCESS;
}

```

#####   [输出：](#输出-1)  

1. 成功
1.     - 目标DN组同步所有复制表空间。
    - 所有节点系统dataspace元数据刷新（新DN组加入系统dataspace）。
    - DDL限制放开。

1. 失败
1.     - 目标DN组残留部分复制表空间。
    - （dataspace元数据必须一致）
    - DDL限制放开。



#####   [可重入能力：](#可重入能力-1)  

如果任务开始的时候，dataspace元数据已经有部分成功刷新，任务会一直尝试刷新其他节点元数据，直到一致。即使MN主节点故障，MN主节点恢复之后仍然会继续不断尝试刷新元数据。

如果任务开始的时候，发现任务已经执行过，但是dataspace元数据没有刷新，则会放开DDL限制然后报错。

（后续可以考虑增强可重入能力，需要增加去新DN上删除残留的表空间的逻辑）

###   [5.3 路由管理](#53-路由管理)  

```
CREATE TABLE DATASPACE$
(
    DS_ID        BINARY_BIGINT   NOT NULL,
    NAME         VARCHAR(64)     NOT NULL,
    CHUNK_COUNT  BINARY_INTEGER  NOT NULL,
    GROUP_COUNT  BINARY_INTEGER  NOT NULL,
    GROUPS       VARCHAR(8000)   NOT NULL,
    VERSION      BINARY_BIGINT   NOT NULL
) ORGANIZATION HEAP SYSTEM
/

CREATE TABLE ROUTE$
(
    DS_ID       BINARY_BIGINT   NOT NULL,
    CHUNK#      BINARY_INTEGER  NOT NULL,
    GROUP#      BINARY_BIGINT   NOT NULL,
    VERSION     BINARY_BIGINT   NOT NULL
) ORGANIZATION HEAP SYSTEM
/

```

dataspace描述了数据在DN上的分布特征，主要包括两部分：

- 若干DN组的集合；
- 若干chunk及其与上述DN组的对应关系。


DN组的集合描述了dataspace所包含数据的分布范围。

chunk与DN组的对应关系描述了分布表的每个分片在DN组上的分布情况。

dataspace分为系统dataspace和用户dataspace。

####   [5.3.1 系统dataspace](#531-系统dataspace)  

系统dataspace每个集群只有一个，名称固定为USERS。在创建集群的时候就会创建出系统dataspace。

系统dataspace包含了所有元数据、所有复制表和其下属分布表的分布信息。

之所以把所有元数据和所有复制表的分布信息放到系统dataspace中，是为了将元数据和复制表数据从集群管理中解耦出来，打破集群中所有DN组必须要有全量元数据和复制表数据的约束，而是改成系统dataspace中必须要有全量元数据和复制表数据。如果没有系统dataspace这一层，元数据和复制表的路由只能由集群管理维护，但是集群管理设计的出发点不包含管理数据路由，所以在路由变更这种比较复杂的场景下就会有问题。

由于元数据和复制表在每个DN组只有一份且DN组之间完全一致，所以只需要DN组的集合（DATASPACE$.GROUPS）就可以描述元数据和复制表的分布信息。除非在增删DN组的过程中，否则系统dataspace必须包含集群中所有的DN组，不允许单独缩容系统dataspace而不删除DN组。

分布表则还需要chunk和DN组之间的对应关系。

####   [5.3.2 用户dataspace](#532-用户dataspace)  

23.1版本不支持用户dataspace。

用户dataspace是用户单独使用CREATE DATASPACE命令创建的，不包含元数据和复制表的路由信息，只包含建在其下的分布表的路由信息。

####   [5.3.3 路由变更](#533-路由变更)  

#####   [5.3.3.1 系统dataspace路由变更](#5331-系统dataspace路由变更)  

系统dataspace路由变更包括扩缩容和重分布两种情况。

扩缩容的时候，变更DN组集合的成员为集群最新的所有DN组。dataspace扩缩容只在增删DN组的时候进行。缩容之前需要保证没有任何chunk分布在删除的DN组上（缩容可以包括先自动重分布的选项）。

重分布的时候，变更chunk和DN组之间的对应关系。

DDL和DML跨节点执行的时候，都要进行路由版本校验，保证一个DDL或DML执行过程中使用的都是相同版本的路由。路由版本校验失败后会有一段时间的重试，超时后报错。

由于路由版本校验是在执行涉及到的节点间进行的，所以只要执行相关节点的路由版本都刷新了或者都未刷新，执行都能正常进行。

#####   [5.3.3.2 用户dataspace路由变更](#5332-用户dataspace路由变更)  

用户dataspace路由同样包括扩缩容和重分布。和系统dataspace的区别是不涉及元数据和复制表的搬迁，而且可以单独执行某一个用户dataspace的扩缩容。

###   [5.4 异常处理](#54-异常处理)  

增加DN组包含两部分：

**任务1. 集群和系统dataspace中增加DN组**

**任务2. 系统dataspace数据重分布**

任务有如下几个特点：

- 每个任务成功后相应的服务即可用。
- 增加DN组命令执行失败的话，OM不会自动清理残留，而是通过用户根据失败的阶段选择相应的逆操作进行清理。
- yasboot group remove是兜底手段，一定能清理任何阶段的失败。


####   [5.4.1 不同阶段失败对应的清理操作](#541-不同阶段失败对应的清理操作)  

**1. 任务1失败**

任务1失败的处理手段只有group remove。所以需要在group remove的流程中，考虑到扩容可能未彻底完成的情况。

**2. 任务1成功，任务2失败**

这时候只会残留一些表空间和数据文件，不影响正常使用，如果用户尝试再次重分布的时候，内部会先尝试清理再去重新创建，所以不需要单独清理。

group remove分为如下步骤：

- 判断是否有扩容任务在进行
- 判断是否有重分布任务在进行
- 迁出分布表数据
- 删除组和节点的集群信息、实例、数据


group remove，必须要在扩容任务结束之后才能做，如果扩容任务没有结束的话，group remove报错。

**原则**  ：服务端扩容任务需要保证在结束的时候（成功or失败），除了新增的DN组之外，不存在其他残留，如DDL拦截，表空间read only，元数据不一致等。失败的中间残留由任务执行的逻辑cover，如果MN发生重启，发现扩容任务正在进行，直接进入清理残留流程，最后再将任务状态置为FAILED。

####   [5.4.4 服务端任务残留自动清理](#544-服务端任务残留自动清理)  

当前版本不支持任务续接，所以失败的话不需要保留未完成的任务，而且需要及时放开对业务的限制。

服务端扩容任务置为失败状态之前，需要在任务流程中完成自动清理，之后再返回失败。

**1. DDL拦截的解除**

在任务执行的失败流程中添加，在任务状态置为FAILED之前执行。

**2. 表空间read only的解除**

在DN执行迁移表空间的时候，不管成功还是失败，都要主动解除，重启也会解除（内存状态）。

**3. 路由信息变更**

进入刷新路由流程之后，任务必须成功，否则会引起部分旧节点不可用。

这种需要不断重试的步骤，在服务端控制，MN重启后需要能自动执行已经开始的任务。只有服务端确保任务结束不会有问题时，才会将任务的状态置为失败。

###   [5.5. 并发控制](#55-并发控制)  

####   [5.5.1 工具层对扩容命令的并发控制](#551-工具层对扩容命令的并发控制)  

工具层不允许扩容命令和其他会有修改操作的命令并发。只允许并发查询状态。

####   [5.5.2 DDL并发控制](#552-ddl并发控制)  

通过gInstance上的标记控制DDL的限制并发，注册扩容任务的时候，修改标记。启动的时候检查是否存在扩容任务，是则修改标记。

####   [5.5.3 DML并发控制](#553-dml并发控制)  

表空间迁移过程中通过表空间的read only状态限制  **复制表写操作**  ，表空间迁移完成之后，通过路由信息的版本来控制DML并发，这时候会影响  **系统dataspace下的所有表**  。如果路由信息校验不一致，则进行reparse。正常情况下，重试一定次数后可以成功。在出现节点异常或网络故障的情况下，会因为重试达到一定次数或者超时而报错，避免卡住。

即使路由刷新没有全部完成，如果一次执行只涉及刷新路由成功的节点，那么这次执行的路由版本校验仍然能成功。

####   [5.5.4 其他不通过工具调用的命令](#554-其他不通过工具调用的命令)  

分布式备份：扩容过程中备份不保证备份可用。建议先备份好，再扩容。

离线升级：需要所有实例停止，但是在扩容过程中禁止停止集群。即使采取其他手段停止集群，可以完成升级，但是扩容任务将会由于MN重启而失败。所以只要保证升级之后，扩容任务残留的清理仍然能够完成即可。另一种情况，迁移任务正在刷新路由，这时整个集群停机，完成了升级之后再拉起来，版本变更不应影响继续刷新路由。

##   [六、测试用例](#六测试用例)  

###   [6.1 无并发无故障场景](#61-无并发无故障场景)  

1. 准备数据，包括一些元数据和复制表数据
1. 扩容带三个节点的DN组


检查项：

- 扩容过程中查询v$task检查状态
- 扩容结束后确认新DN组元数据和复制表数据完整
- 扩容结束后执行DDL、复制表和分布表DML（包括操作扩容前创建的对象和扩容后创建的对象），应该正常


###   [6.2 并发场景](#62-并发场景)  

1. 准备数据，包括一些元数据、复制表和分布表数据
1. 扩容带三个节点的DN组


检查项：

- 扩容过程中执行DDL应该报错（迁移任务开始后）
- 扩容过程中执行复制表DML不应该报错（可能会执行时间较长）
- 扩容过程中执行分布表DML不应该报错


###   [6.3 故障场景](#63-故障场景)  

1. 扩容前有节点故障
1. 扩容过程中有节点故障后恢复


预期：不参与扩容任务的节点故障后恢复，扩容可以成功；节点故障后不恢复，扩容任务可能会一直等待（一直尝试刷新路由）。扩容失败后可以通过逆操作清理残留。

  


  


  
    
    


## Attachments:

[DN组扩缩容.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmQ4OTcwYzJhZjRmNTFmY2U3IiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.S03QA6dkL6AuFXJ7rkibv-9LaZJfoabkglhvWaoFjsg)

 (image/png)    


[DN组扩缩容.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmVhMWFkOWEzMzExZGM3YjVkIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.JRJKi17xVaylbgDzzsZz1a6GUc-pBSE2fSGzAcsmthg)

 (image/png)    


[DN组扩缩容.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmU4OTcwYzJhZjRmNTFmY2U4IiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.C31EssAesxGbQD4jhbQDWUK4piAGMQ6LKTY3M-9mpQg)

 (image/png)    


[DN组扩容（新）.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmVhMWFkOWEzMzExZGM3YjVlIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.Nj3VQG4HGG7fXjMHXHSGu5_uUnZ3BLYqnoOdxHLB7ik)

 (image/png)    


[DN组扩容（新）.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmU4OTcwYzJhZjRmNTFmY2U5IiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.00LBM0atDd0Z7YsLRePPCqsCrpvxOePdBmEnXd7R1j8)

 (image/png)    


[DN组扩容（新）.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmU4OTcwYzJhZjRmNTFmY2VhIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.07-NvREkjclM3jVaeEa6n3eLL7bOfw4CTKGMnlR4WtM)

 (image/png)    


[DN组扩容（新） (1).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmVhMWFkOWEzMzExZGM3YjVmIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.m5Eq0HW8AW_Wq99Pj_kZR-lC1M68rNsW-w3xbua_hcU)

 (image/png)    


[DN组扩容（新） (2).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmU4OTcwYzJhZjRmNTFmY2ViIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.5J4zBuMsrVTziUaaYvwX8sKRyEWXHPlNW6ZOKyz3hzc)

 (image/png)    


[DN组扩容（新） (3).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmVhMWFkOWEzMzExZGM3YjYwIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.Du8IH1YU-AQI-iMBSKdJ7pKYT73jn8kt1j3wqkKn6PQ)

 (image/png)    


[DN组扩容（新） (4).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmVhMWFkOWEzMzExZGM3YjYxIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.wF71zwCO2--hfXSMGiA5wpcUi00_NHnOdePcxOW_AAc)

 (image/png)    


[DN组扩容（新） (5).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmVhMWFkOWEzMzExZGM3YjYyIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.0-C1DA2uhAiRyodPMD0MWgJqWg7JYgKzIlxMGalOnOM)

 (image/png)    


[DN组扩容（新） (6).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMmU4OTcwYzJhZjRmNTFmY2VjIiwicmVmX2lkIjoiNjczOTZhMmQ3MjgyMDZlZmI5MmVmYjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjExNTQ4LCJleHAiOjE3ODIyOTc5NDh9.kLeRORAqQII18a3Osu-3SdrR9uYA3S3_-dtzI4BERhw)

 (image/png)    
