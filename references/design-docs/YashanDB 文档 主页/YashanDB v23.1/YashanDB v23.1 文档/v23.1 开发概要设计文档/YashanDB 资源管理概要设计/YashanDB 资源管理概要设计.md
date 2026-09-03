Created by 未知用户 (zhongsongjin), last modified on 四月 24, 2023

##   [1. Overview（概述）](#1-overview概述)  

YaShanDB资源管理的目的：

1：YaShanDB在保证数据库稳定运行的前提下最大限度提高整体资源利用率。

2：核心用户和紧急任务更多资源运行。

3：在资源紧张时为定位不同用户资源占用问题提供定位依据。

资源管理包含的范畴有：单机，分布式和集群模式下的资源（CPU,IO,内存，硬盘，并发连接数等等）的隔离，弹性使用和上限限制。

设计之前，已经跟竞品opengauss, oceanbase, mysql, oracle 做了充方调研：

OceanBase资源管理特性调研

  [https://conf.yasdb.com/pages/viewpage.action?pageId=104222637](https://conf.yasdb.com/pages/viewpage.action?pageId=104222637)  

openGauss  资源管理特性调研

  [https://baijiahao.baidu.com/s?id=1731318373001441716&wfr=spider&for=pc](https://baijiahao.baidu.com/s?id=1731318373001441716&wfr=spider&for=pc)  

MySQL 资源管理特性调研

  [https://blog.51cto.com/imysql/3084000](https://blog.51cto.com/imysql/3084000)  

Oracle 资源管理特性调研

  [https://www.shuzhiduo.com/A/kmzLpYbzGE/](https://www.shuzhiduo.com/A/kmzLpYbzGE/)  

  [http://xy2401.com/local-doc-oracle-19c.zh/content/admin/managing-resources-with-oracle-database-resource-manager.html#GUID-D695EE69-E08B-41BB-90FB-207E6810B938](http://xy2401.com/local-doc-oracle-19c.zh/content/admin/managing-resources-with-oracle-database-resource-manager.html#GUID-D695EE69-E08B-41BB-90FB-207E6810B938)  

其他资源管理调研

  [https://conf.yasdb.com/pages/viewpage.action?pageId=95109555](https://conf.yasdb.com/pages/viewpage.action?pageId=95109555)  

IO 资源限制：

  [https://www.pianshen.com/article/4665845089/](https://www.pianshen.com/article/4665845089/)  

协议调研

  [https://conf.yasdb.com/pages/viewpage.action?pageId=104230702](https://conf.yasdb.com/pages/viewpage.action?pageId=104230702)  

并且写了demo 做了可行性验证：    [https://git.yasdb.com/codbase/cgroup-demo。](https://git.yasdb.com/codbase/cgroup-demo%E3%80%82)  

所有技术方案已经代码demo中运行通过，并且业界也验证过的，不存在不可行的问题。 跟业界对比，我们该方案有2个优点：

1：资源管理所有代码全部自研，没有引入任何第三方组件，并且全自动适配linux 底层的不同资源模块功能。

2：资源管理同时面向单机和分布式。

3:   无缝oracle 操作体验。

##   [2. Features（功能特性）](#2-features功能特性)  

2.1  单机CPU 资源管理

- 设置YashanDB 服务进程在整个机器的CPU 最大使用率，比如 最大占整个机器所有CPU 80%。
- 设置系统线程，用户线程的CPU 资源比例。
- 设置资源使用组，根据用户绑定资源，从而隔离用户的CPU资源。
- 隔离用户资源分3种，第1种是相对隔离，这种是按照权重设置的，这种最大的优点是当CPU 不忙时，用户使用CPU 可盗取借用； 第2种是绝对隔离，比如设置使用CPU 80%，那么就最多只能使用80%；  第2种是指定CPU 核隔离资源，比如把特定用户线程绑定到特定CPU 核。
- 资源隔离有系统级别，用户级别和语句级别，暂时实现系统级别和用户级别，后续再扩展语句级别。


2.2   单机 io 资源管理

- IOPS 上限控制；
- IOPS  相对比例控制；


2.4  单机内存资源管理

- 总的内存资源控制；


2.2   分布式版本CPU 资源管理

- MN, CN 资源管理资源组分配，这个有别于DN;
- 同一个物理机下，MN, CN ,DN 混合部署资源分配；


2.3   分布式io 资源管理

- IOPS 总量控制


2.4    分布式内存资源管理

- 总的内存资源控制；


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [3.1 概念体系](#31-概念体系)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/8_18_8_25_WXWorkLocal_16809482856963.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

####   [3.1.1 资源使用组](#311-资源使用组)  

资源使用组由许多用户会话组成，这些会话有相同的资源使用请求。新创建一个会话时，DBRM会根据你的设定自动把它分配到某个组。数据库管理员还可以手动的调整某个会话所属的组。

下面三类特别的组是系统组，它们不能被修改或删除。

•SYS_GROUP•DEFAULT_CONSUMER_GROUP•OTHER_GROUP

####   [3.1.2 资源计划指令](#312-资源计划指令)  

一种规格的 CPU、内存、存储空间、IOPS资源组合的描述，是数据库服务内部的资源容器。比如 资源计划指令 A CPU 4个，IOS 128 MEM 50M DISK 50G.  在RDMB根据当前活动资源计划中的一系列资源计划指令为资源使用组分配资源。资源计划和指令间有着一对多的关系，资源计划中不能包含两条相同的指令。

####   [3.1.3 资源计划](#313-资源计划)  

资源计划包含一系列指令，这些指令就决定了给每个组的资源分配配置。要执行资源的分配，你只需执行相应的资源计划。一个用户在一个数据库中同一时间只有一个资源计划起作用。

####   [3.1.4  资源映射](#314--资源映射)  

就是资源使用组要映射到哪一个资源计划指令的规则。默认开启的是EXPLICIT 和 ORACLE_USER。 其他每个匹配规则实现为可拔插的方式，用户可以自行设置每种方式的优先级别，运行中最终选择的是匹配最高优先级别的。支持的规则有：

|会话属性|类型|描述|
|---|---|---|
|EXPLICIT|n/a|默认|
|ORACLE_USER|Login|这是V$SESSION中的USERNAME。登陆时，会话使用这个用户名进行数据库的验证。|
|SERVICE_NAME|Login|这是用来连接到数据库的数据库服务名，也是V$SESSION的SERVICE_NAME|
|CLIENT_OS_USER|Login|这是用户发起连接机器的操作系统用户账户，也是V$SESSION中的OSUSER|
|CLIENT_PROGRAM|Login|这是最终用户连接到数据库所使用的可执行文件名，例如，toad.exe，资源管理器并不区分其大小写。|
|CLIENT_MACHINE|Login|这是用户发起连接的机器名，也是V$SESSION的MACHINE列。|
|MODULE_NAME|Runtime|这是连接到数据库的应用程序设置的模块名。它存储于V$SESSION试图的MODULE列，通过调用DBMS_APPLICATION_INFO.SET_MODULE存储过程进行设置。这是一个可选设置，一些应用程序并不使用它。|
|MODULE_NAME_ACTION|Runtime|这是模块（MODULE）和动作(ACTION)拼接起来的，格式为module.action。应用程序通过调用下列存储过程进行设置：l  DBMS_APPLICATION_INFO.SET_MODULEl  DBMS_APPLICATION_INFO.SET_ACTION|
|SERVICE_MODULE|Runtime|这是连接到数据库的服务名和模块名所拼接起来的，格式为service.module|
|SERVICE_MODULE_ACTION|Runtime|此属性是由服务名、模块名和动作名拼接起来的，格式为service.module.action|
|ORACLE_FUNCTION|Runtime|这是一个特殊的属性，有数据库内部维护。当运行RMAN或者Data Pump时会进行相应设置。如执行backup…as backupset时，这个属性会被设置为BACKUP；执行backup…as copy时，会被设置为COPY。当使用Data Pump加载数据到数据库是，这个属性会被设置为DATALOAD。这些属性自动地被映射到内建的如BATCH_GROUP何ETL_GROUP这些使用者组。|


###   [3.2 接口](#32-接口)  

####   [3.2.1 接口定义](#321-接口定义)  

只有系统管理员才有创建整个资源计划的权限，下面是操作步骤：

**第1步，创建用户**

**第2步：创建使用者组(Consumer Groups)**

**第3步：创建使用者映射规则(Consumer Group Mapping Rules)**

**第4步：设置使用者组映射优先级(Resource Group MappingPriorities)**

**第5步：创建资源计划(Resource Plan)和计划指令(Plan Directives)**

**第6步：激活资源计划(Activate the Resource Plan)**

创建、更新、删除使用者组创建：

```
exec dbms_resource_manager.create_cosumer_group('群名','注释');

```

更新：

```
exec dbms_resource_manager.update_consumer_group('群名','注释');

```

删除：执行此命令后，隶属于此群的用户和会话将自动转到 default_consumer_group.

设定映射规则

```
dbms_resource_manager.set_consumer_group_mapping（
attribute =&gt; 添加属性,
value =&gt;用户名,
consumer_group =&gt; 用户使用组）

```

设定映射优先权：由于可能会出现某会话的两个属性分别满足两个不同的映射规则，那么该服从哪个规则呢？——可以设定各个属性的优先权，服从优先级高的属性。

```
dbms_resource_manager.set_mapping_priority(
使用者组1 =&gt; 1,
使用者组 2=&gt; 2);

```

创建资源计划和计划指令

一般而言，资源计划会和计划指令同时创建，这是因为不能创建一个空的计划。

创建资源计划

```
 dbms_resource_manager.create_plan(

plan    =&gt;'计划名字',

  comment =&gt;'注释');

```

修改资源计划：

```
dbms_resource_manager.update_plan(
plan =&gt; '计划名',
new_属性 =&gt; '新值');

```

删除资源计划：

```
dbms_resource_manager.delete_plan('计划名'）;

```

创建计划指令

```
dbms_resource_manager.create_plan_directive(

plan             =&gt;'计划名字',

group_or_subplan =&gt; ‘指令名字',

comment          =&gt;'注释',

mgmt_p1          =&gt; 数值);

```

更新计划指令

```
dbms_resource_manager.update_plan_directive(
plan             =&gt;'计划名字',
group_or_subplan =&gt; ‘指令名字',
MGMT_P1 =&gt; '新值');

```

删除计划指令

```
dbms_resource_manager.delete_plan_directive(
plan             =&gt;'计划名字',
group_or_subplan =&gt; ‘指令名字');

```

激活资源计划

```
ALTER SYSTEM SET resource_manager_plan='计划名字'

```

系统权限

```
dbms_resource_manager_privs.grant_system_privilege( 

grantee_name=&gt;被授权者,  // 

privilege_name=&gt;'administer_resource_manager',

admin_option=&gt;true);

```

创建，删除，检测，提交 pending_area

这个主要是用来开辟临时存储，保证资源管理的事务一致性。

```
dbms_resource_manager.clear_pending_area();

dbms_resource_manager.create_pending_area();

dbms_resource_manager.delete_consumer_group('资源名字');

dbms_resource_manager.submit_pending_area();

```

####   [3.2.2 表结构设计](#322-表结构设计)  

需要增加下面6个系统表, 表之间关系如下：

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/23_15_56_41_20230423155640.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

资源使用者组表（RSRC_CONSUMER_GROUPS）

|列名|属性|说明|
|---|---|---|
|CONSUMER_GROUP|PRIMARY KEY  NOT NULL VARCHAR2(128)|资源使用者组|
|COMMENTS|VARCHAR2(2000)|注释说明|


资源使用者映射规则表  (RSRC_GROUP_MAPPINGS)

|列名|属性|说明|
|---|---|---|
|ATTRIBUTE|PRIMARY KEY , NOT NULL VARCHAR2(128)|属性类型比如是用户属性，客户端属性等等|
|VALUE|VARCHAR2(128)|对应属性的名字|
|CONSUMER_GROUP|VARCHAR2(128)  constraint FK_CONSUMER_GROUP  references RSRC_CONSUMER_GROUPS(CONSUMER_GROUP)|资源使用者组|


使用者组映射优先级 (RSRC_MAPPING_PRIORITY)

|列名|属性|说明|
|---|---|---|
|ATTRIBUTE|PRIMARY KEY NOT NULL  VARCHAR2(128) constraint FK_ATTRIBUTE references RSRC_GROUP_MAPPINGS(ATTRIBUTE)|属性类型比如是用户属性，客户端属性等等|
|PRIORITY|NUMBER|属性类型优先级别|


资源计划表 （RSRC_PLAN）

|列名|属性|说明|
|---|---|---|
|PLAN|PRIMARY KEY, NOT NULL VARCHAR2(128)|计划名字|
|NUM_PLAN_DIRECTIVES|NUMBER|计划指令个数|
|COMMENTS|VARCHAR2(2000)|注释说明|


资源计划指令 （ RSRC_PLAN_DIRECTIVES）

|列名|属性|说明|
|---|---|---|
|GROUP_OR_SUBPLAN|VARCHAR2(128)   PRIMARY KEY NOT NULL     constraint FK_ GROUP_OR_SUBPLAN references CONSUMER_GROUPS(CONSUMER_GROUP)|组名（子计划名）|
|PLAN|VARCHAR2(128) constraint FK_ATTRIBUTE references RSRC_GROUP_MAPPINGS(ATTRIBUTE)|计划名字|
|MAX_UTILIZATION_LIMIT|NUMBER|指定使用者组允许的最大CPU绝对上限|
|MGMT_P1|NUMBER|level1 对应的百分比|
|MGMT_P2|NUMBER|level2 对应的百分比|
|MGMT_P3|NUMBER|level3 对应的百分比|
|MGMT_P4|NUMBER|level4 对应的百分比|
|MGMT_P5|NUMBER|level5 对应的百分比|
|MGMT_P6|NUMBER|level6 对应的百分比|
|MGMT_P7|NUMBER|level7对应的百分比|
|MGMT_P8|NUMBER|level8 对应的百分比|
|COMMENTS|VARCHAR2(2000)|注释说明|


资源管理权限表 （RSRC_MANAGER_SYSTEM_PRIVS）

|列名|属性|说明|
|---|---|---|
|GRANTEE|VARCHAR2(128) PRIMARY KEY NOT NULL|被授权者|
|PRIVILEGE|NOT NULL VARCHAR2(40)|权限|
|ADMIN_OPTION|VARCHAR2(3)|是否管理员|


涉及核心数据结构

userResourceMGR 用户资源匹配规则

|名字|属性|说明|
|---|---|---|
|users|char[128]|用户|
|priority|int|优先级|
|consumerGroup|char[128]|资源使用组|
|status|char|是否生效|


新加配置参数：

|配置名|默认值|说明|
|---|---|---|
|YASDB_CGROUP_DIR|/sys/fs/cgroup|资源管理模块根目录|
|resource_manager_plan|“‘|正在运行的资源计划，为空表示不使用资源管理|
|RESOURCE_LIMIT|z资源管理开关||


例子如下：

A： 复杂计划：

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/12_16_6_43_WXWorkLocal_16812866709896.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

```
BEGIN
DBMS_RESOURCE_MANAGER.CREATE_PENDING_AREA();
DBMS_RESOURCE_MANAGER.CREATE_PLAN(PLAN =&gt; 'bugdb_plan', 
   COMMENT =&gt; 'Resource plan/method for bug users sessions');
DBMS_RESOURCE_MANAGER.CREATE_PLAN(PLAN =&gt; 'maildb_plan', 
   COMMENT =&gt; 'Resource plan/method for mail users sessions');
DBMS_RESOURCE_MANAGER.CREATE_PLAN(PLAN =&gt; 'mydb_plan', 
   COMMENT =&gt; 'Resource plan/method for bug and mail users sessions');
DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(CONSUMER_GROUP =&gt; 'Online_group', 
   COMMENT =&gt; 'Resource consumer group/method for online bug users sessions');
DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(CONSUMER_GROUP =&gt; 'Batch_group', 
   COMMENT =&gt; 'Resource consumer group/method for batch job bug users sessions');
DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(CONSUMER_GROUP =&gt; 'Bug_Maint_group',
   COMMENT =&gt; 'Resource consumer group/method for users sessions for bug db maint');
DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(CONSUMER_GROUP =&gt; 'Users_group', 
   COMMENT =&gt; 'Resource consumer group/method for mail users sessions');
DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(CONSUMER_GROUP =&gt; 'Postman_group',
   COMMENT =&gt; 'Resource consumer group/method for mail postman');
DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP(CONSUMER_GROUP =&gt; 'Mail_Maint_group', 
   COMMENT =&gt; 'Resource consumer group/method for users sessions for mail db maint');
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'bugdb_plan',
   GROUP_OR_SUBPLAN =&gt; 'Online_group',
   COMMENT =&gt; 'online bug users sessions at level 1', MGMT_P1 =&gt; 80, MGMT_P2=&gt; 0);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'bugdb_plan', 
   GROUP_OR_SUBPLAN =&gt; 'Batch_group', 
   COMMENT =&gt; 'batch bug users sessions at level 1', MGMT_P1 =&gt; 20, MGMT_P2 =&gt; 0,
   PARALLEL_DEGREE_LIMIT_P1 =&gt; 8);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'bugdb_plan', 
   GROUP_OR_SUBPLAN =&gt; 'Bug_Maint_group',
   COMMENT =&gt; 'bug maintenance users sessions at level 2', MGMT_P1 =&gt; 0, MGMT_P2 =&gt; 100);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'bugdb_plan', 
   GROUP_OR_SUBPLAN =&gt; 'OTHER_GROUPS', 
   COMMENT =&gt; 'all other users sessions at level 3', MGMT_P1 =&gt; 0, MGMT_P2 =&gt; 0,
   MGMT_P3 =&gt; 100);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'maildb_plan', 
   GROUP_OR_SUBPLAN =&gt; 'Postman_group',
   COMMENT =&gt; 'mail postman at level 1', MGMT_P1 =&gt; 40, MGMT_P2 =&gt; 0);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'maildb_plan',
   GROUP_OR_SUBPLAN =&gt; 'Users_group',
   COMMENT =&gt; 'mail users sessions at level 2', MGMT_P1 =&gt; 0, MGMT_P2 =&gt; 80);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'maildb_plan',
   GROUP_OR_SUBPLAN =&gt; 'Mail_Maint_group',
   COMMENT =&gt; 'mail maintenance users sessions at level 2', MGMT_P1 =&gt; 0, MGMT_P2 =&gt; 20);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'maildb_plan',
   GROUP_OR_SUBPLAN =&gt; 'OTHER_GROUPS', 
   COMMENT =&gt; 'all other users sessions at level 3', MGMT_P1 =&gt; 0, MGMT_P2 =&gt; 0,
   MGMT_P3 =&gt; 100);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'mydb_plan', 
   GROUP_OR_SUBPLAN =&gt; 'maildb_plan', 
   COMMENT=&gt; 'all mail users sessions at level 1', MGMT_P1 =&gt; 30);
DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(PLAN =&gt; 'mydb_plan', 
   GROUP_OR_SUBPLAN =&gt; 'bugdb_plan', 
   COMMENT =&gt; 'all bug users sessions at level 1', MGMT_P1 =&gt; 70);   
DBMS_RESOURCE_MANAGER.VALIDATE_PENDING_AREA();
DBMS_RESOURCE_MANAGER.SUBMIT_PENDING_AREA();
END;
ALTER SYSTEM SET resource_manager_plan='bugdb_plan');
/

```

在此计划架构中，CPU资源分配如下：

- 在    `mydb_plan`     ，30％的CPU分配给    `maildb_plan`    子计划，70％分配给    `bugdb_plan`    子计划。两个子计划均为1级。由于    `mydb_plan`    本身没有低于级别1的级别，因此其级别1的子计划未使用的任何资源分配都可以由其兄弟子计划使用。因此，如果    `maildb_plan`    仅使用20％的CPU，那么CPU的80％可用来    `bugdb_plan`     。
-   `maildb_plan`    和    `bugdb_plan`    定义级别1,2和3的分配。这些子计划中的级别与其父计划    `mydb_plan`    的级别    `mydb_plan`     。也就是说，计划架构中的所有计划和子计划都有自己的级别1，级别2，级别3等等。
- 在分配给    `maildb_plan`    的30％的CPU中，40％的CPU（实际占总CPU的12％）被分配给1级的    `Postman_group`     。因为    `Postman_group`    在级别1没有兄弟姐妹，所以在级别1有一个隐含的60％。然后，这个60％由    `Users_group`    和    `Mail_Maint_group`    在2级共享，分别为80％和20％。除此之外，     `Users_group`    和    `Mail_Maint_group`    还可以使用    `Postman_group`    在级别1中未使用的40％中的任何一个。
- 在级别2的    `Users_group`    或    `Mail_Maint_group`    未使用的CPU资源将分配给    `OTHER_GROUPS`     ，因为在多级计划中，未使用的资源将重新分配给下一个较低级别的使用者组或子计划，而不是同级别的兄弟。因此，如果    `Users_group`    仅使用70％而不是80％，则    `Mail_Maint_group`    不能使用剩余的10％。这10％仅    `OTHER_GROUPS`    于3级的    `OTHER_GROUPS`     。
- 分配给    `bugdb_plan`    子计划的70％的CPU以类似的方式分配给其使用者组。如果    `Online_group`    或    `Batch_group`    未使用其完整分配，则    `Bug_Maint_group`    可以使用其余部分。如果    `Bug_Maint_group`    不使用所有分配，则余数将转到    `OTHER_GROUPS`     。
- B：限制总体数据库CPU利用率
- 在此示例中，无论数据库负载如何，Oracle数据库的系统工作负载都不会超过CPU的90％，而其他应用程序共享服务器的CPU占10％。


```
BEGIN
  DBMS_RESOURCE_MANAGER.CREATE_PENDING_AREA();

  DBMS_RESOURCE_MANAGER.CREATE_PLAN(
    PLAN    =&gt; 'MAXCAP_PLAN',
    COMMENT =&gt; 'Limit overall database CPU');

  DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE(
    PLAN              =&gt; 'MAXCAP_PLAN',
    GROUP_OR_SUBPLAN  =&gt; 'OTHER_GROUPS',
    COMMENT           =&gt; 'This group is mandatory',
    UTILIZATION_LIMIT =&gt; 90);

  DBMS_RESOURCE_MANAGER.VALIDATE_PENDING_AREA();
  DBMS_RESOURCE_MANAGER.SUBMIT_PENDING_AREA();
END;

ALTER SYSTEM SET resource_manager_plan='MAXCAP_PLAN');
/

```

####   [3.2.3   DC 设置](#323---dc-设置)  

目前只需要把 资源使用者映射规则表 存放在DC 就可以，因为用户登陆操作时（这个是高频操作），只需要用到映射规则，就可以实现资源管控。

其他的5个表等等，主要的功能更多是为了数据完整性控制，业务上下文依赖，还有数据持久化，而且是低频操作（只有系统管理员才用），故不必用DC.

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1：本设计方案暂时支持 linux 系统运行。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.10  架构图](#510--架构图)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/12_19_38_20_WXWorkLocal_16812994755448.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

目前资源管理的实现组件是利用内核模块cgroup。5点说明：

1. 对于YashanDB来说，只是需要嵌入自研cgroup 接口层 的API 就可以，不需要了解操作系统cgroup 底层的细节；
1. cgroup在这个架构中可以简单理解为一个文件系统，我们对cgroup 任何操作，简单类比为对文件系统的内容修改，在cgroup 中我们创建了一个属于yashandb 有读写权限的yashanDB 目录。
1. 资源计划和资源计划指令是通过名字映射到cgroup 目录来实现 对应关系的。
1. 目前业界主流的是cgroup v1, 建议是在满足cgroup v1 基础上，适配cgroup v2 , 当然，版本发布时是要V1 和V2 都要兼容的，这个是cgroup 接口层自动适配的工作，开发者和用户都无感知；
1. 只有系统管理才有分配资源的写权限；普通用户只能根据系统管理员分配的资源来运行。


###   [5.11 单机多进程资源管理架构](#511-单机多进程资源管理架构)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/11_11_21_54_WXWorkLocal_16811832882392.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

1：设置上层属于yashanDB 有读写权限的目录，但是中间多了一个层次来区分属于进程，比如dn-3-1 ，而且多个进程之间可以设置资源比例；

2：到了各个进程内部，比如 dn-3-1, 它的内部使用资源结构和单机版本资源管理结构一致。

完成操作流程：系统启动前首先系统管理员要创建各个资源组，来指定各类资源配额。系统运行用户登录后当发起一个请求后，会根据用户资源匹配规则来绑定资源组，当用户运行时就会按照绑定 linux 底层cgroup 资源组的资源配额来隔离和调度资源。

###   [5.3  关键技术和难点](#53--关键技术和难点)  

####   [5.3.1  Cgroup](#531--cgroup)  

cgroup，是目前业界通用的资源管理组件，其名称源自控制组群（control groups）的简写，是Linux内核的一个功能，用来限制、控制与分离一个进程组的资源（如CPU、内存、磁盘输入输出等）。cgroups 分V1 和 V2 版本，目前绝大多数的 linux 默认是V1 版本， V2 只是作为可选的版本 。

更多cgroup 的知识，参考：

  [https://conf.yasdb.com/display/YAS/cgroup](https://conf.yasdb.com/display/YAS/cgroup)  

####   [5.3.2  资源接口层](#532--资源接口层)  

资源管理涉及多个方面，包括CPU, IO , 内存等等， 虽然说每个实现细节不一致，但是还是有共性部分，由此抽取出一个共性的资源管理接口层，另外，业界开源的libcgroup 功能比较重，采用自己写适配层，一来能够轻量上阵，二来能够更好的结合yashanDB 业务特色。

初步实现，可以参考 ：     [https://git.yasdb.com/codbase/cgroup-demo/-/blob/main/anr_cgroup.c](https://git.yasdb.com/codbase/cgroup-demo/-/blob/main/anr_cgroup.c)  

####   [5.3.3 资源管理MGR 文件设计](#533-资源管理mgr-文件设计)  

这个文件设计目的：

- 模块之间通过接口交互，避免深度耦合；
- 上层模块可以访问下层模块，下层模块不允许访问上层模块；
- 模块遵循单一职责原则，模块的职责要清晰，避免引入过多功能导致模块混乱；


层次如下:

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/23_15_16_38_WXWorkLocal_16822341855725.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

#####   [interface layer](#interface-layer)  

提供用户调用的接口，后续yasdb 用户只需要引用3类核心接口就可以，包括 后台线程资源管控接口，普通用户资源匹配接口，还有高级操作接口大约20个。

#####   [business layer](#business-layer)  

1：资源管理模块唯一对外暴露的接口，上承yashandb 模块调用，下接资源适配层。

2： 主要实现的功能：

a: 初始化: 指的是资源调用模块必须先init，类似其他模块的比如log 模块的init ；

b: 资源匹配: 用户登陆后必须经过系统管理员设定的规则匹配，才能找到对应的资源指令实现资源隔离；

c: 资源权重数值转换: 系统管理员输入的数值，必须通过算法运算后，映射为资源管理能够识别的数值；

d: 资源回调接口：用户操作高级包后，需要对一些数值进行回调，比如让规则生效等等；

3：资源目录：资源管理的初始化目录，默认是 /sys/fs/cgroup,  用户可以人为修改。为了性能和用户体验，对资源管理的目录不超过3层，比如第一场yasdb, 第二层  admin, 第3层 adminuser.

#####   [infra layer](#infra-layer)  

1：资源适配层上承接口层资源管理模块调用，下接内核cgroup文件接口功能。

2： 主要实现的功能：

a: 创建资源组 ：创建cgroup 资源名和对应的资源比例；

b: 设置资源比例: 设置资源比例，包括绝对比例和相对比例；

c:  对接内核目录: 对内核文件实现写，对，权限设置等等。

#####   [linux kernel layer](#linux-kernel-layer)  

由内核提供，无需修改，直接引用。

代码模块安排如下：

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/23_15_46_54_WXWorkLocal_16822359809359.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

#####   [功能点实现](#功能点实现)  

资源管理MGR 文件核心设计：首先yashan启动时初始化cgroup资源模块； 然后运行中要有用户资源匹配规则，这个由系统管理员高级包来写入，并且资源匹配规则存放在全局内存区域。需要改造的是代码中在2个地方实现资源匹配规则的判断，一个地方是用户成功登陆后，一个地方是用户并发线程执行任务时（也就是ParallelAttachWorker 这个接口中），这样业务逻辑就嵌入了资源管控了。用户登陆后，通过资源匹配规则映射到对应的规则指令，然后内核就会对这个用户进行资源管控。整个设计中无需要其他第三方依赖。

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/18_14_5_22_WXWorkLocal_16817979018468.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

#####   [全局内存接入](#全局内存接入)  

// 全局内存加入资源管理模块

```
typedef struct StAnrInstance {

ResouceGroup*       resGroup;

}AnrInstance;

```

// 资源管理模块全局内存结构

```
typedef typedef stResouceGroup {
     CodChar  flag;  // 资源管理模块开关，可以分别设置开关CPU 或者 IO ,比如 0b11 表时开CPU和IO
     CodChar  cgroupVersion;	 // cgroup 版本，有V1 和V2 之分
     CodChar*  cgroupRootDir;    // 按照的根目录，如果按照操作系统默认的，目录时 /sys/fs/cgroup , 用户可人为修改
     SpinLock         lock;   // 资源模块的锁
     UserResConsumerGroup userResConsumerGroup;  //用户资源匹配的数据结构
}ResouceGroup;

```

// 用户资源匹配的数据结构

```
typedef struct stUserResConsumerGroup {
    CodChar attr[128];

    CodChar userName[128];

    CodChar resConsumerGroupName[128];

}UserResConsumerGroup;

```

####   [5.3.4 并发场景](#534-并发场景)  

a:  同一个用户多session 对同一个资源文件并发操作

对同一个资源文件的操作， 这个由操作系统来管控，cgroup  内核是 vfs 调用,  理论上vfs是实现了write 和 read 并发控制的，需要验证。

b:  多个管理员同时对资源管理规则修改

在修改规则的用户一样情况下，最后一个修改的会覆盖前面修改的规则；如果修改规则用户不一样的，则不发生冲突，也就是都生效。 比如 2个管理都修改 用户A 的映射规则，则最后一个修改的才生效；如果2个一个修改A， 一个修改B，那么都生效。

c:  分布式环境下管理员操作后必须MN,CN, DN 同时生效

比如 用户A 绑定资源使用组B， 那么在分布式环境下，必须所有的MN,CN, DN  都要同时生效，不能由模块不生效。 这个可以增加命令下发检测接口，如果由失败的就重发3次。

###   [5.4 初始化流程](#54-初始化流程)  

初始化的目的是为了在linux cgroup 下建立一个YASDB的文件目录，让yashanDB 运行进程有权限对该文件目录下所有文件进行读写操作。

下面是脚本的实现（在执行脚本时必须有root 权限）

1：判别系统的cgroup 版本；

2：根据cgroup V1  和 cgroup V2 不同版本，进入到对应的目录（cgroup 默认安装路径 /sys/fs/cgroup/）

3： 如果之前已经创建过该目录，删除，避免老数据影响；

4： 如果没有，就新建 /sys/fs/cgroup/YASDB 目录；

5：给  /sys/fs/cgroup/YASDB 授权访问读写权限，后续yashanDB  进程可以对该 YASDB目录进行读写操作。

后续这个流程操作要结合OM 来初始化完成。

OM 细节实现参考：    [https://conf.yasdb.com/pages/viewpage.action?pageId=109052012&version=2.5.50000.157&platform=win](https://conf.yasdb.com/pages/viewpage.action?pageId=109052012&version=2.5.50000.157&platform=win)  

###   [5.5 YashanDB 后台线程绑定cgroup](#55-yashandb-后台线程绑定cgroup)  

单机版的 YashanDB 线程主要分3个部分，启动时系统线程 绑定在system 资源组，worker 线程绑定在other 资源组，除此其他线程如果没有特别指定也放入other 资源组。

另外用户有新创建的资源组，那worker 线程就根据用户所属的资源组绑定。比如 新建admin 资源组，用户admin 登录，那么admin 所在的worker 线程就绑定到admin 资源组。

由于worker 线程是公共的，可能存在用户复用的情况，不过同一个时刻，只能有一个用户用这个worker 线程。 这里只需要在这个时刻，把这个worker 线程根据用户属性绑定到对应的资源组。  cgroup 资源绑定有一个特点，当把这个线程tid 绑定到一个资源组后，那么cgroup就会把这个tid 从老的资源组解绑，这样就保证一个线程在同一时刻只绑定一个资源组。

下面是单机系统线程和建议资源配比（父资源组估计占用60%， 各个线程从父资源组中分配资源）

|线程名|建议权重值|
|---|---|
|yasdb|50|
|TIMER|50|
|BUFFER_POOL|100|
|PRELOADER|50|
|SMON|100|
|CKPT|200|
|DBWR|200|
|LISTENER_LOG|100|
|TCP_LSNR|100|
|XFMR|100|
|HEALTH_MONITOR|50|
|HOT_CACHE_RECYCLE|50|
|LOGW|200|
|MMON|100|
|Job Queue|100|
|||
|||


分布式后台线程也是按照类似情况分配。

系统后台线程数值也是可以修改的，系统后台线程只不过是yashandb 在启动时就自己命名好的线程，比如DBWR线程，它安放SYS_GROUP 这个目录下，采用上面的  dbms_resource_manager.delete_plan_directive 接口来调整。

###   [5.6 大查询处理](#56-大查询处理)  

我们认为相比于大查询，让短查询尽快返回对用户更有意义，即大查询的查询优先级更低，当大查询和短查询同时争抢 CPU 时，系统会限制大查询的 CPU 使用。

当一个线程执行的 SQL 查询耗时太长，这条查询就会被判定为大查询, 一旦判定为大查询。大查询初步判断为cost 值，比如cost 大于一定的数值就认为是大查询，那么就把这个线程tid 加入cgroup 大查询的资源组（需要提前创建大查询资源组）。

如果同时有大查询和小查询，可以设置大查询最多占用 30% 的 Worker 线程，30% 这个百分比值可以通过配置项     `large_query_worker_percentage`     来设置。有一点要说明，当没有小查询的时候，大查询可以用到 100% 的 Worker 线程。只有当同时有大查询和小查询时，30% 的比例才生效。

大查询的判断，需要优化器参与，给一个标记让资源组判断即可。

##   [5.7 核心场景分析](#57-核心场景分析)  

####   [5.7.1  AP 和TP 用户在分布式环境下的资源分配](#571--ap-和tp-用户在分布式环境下的资源分配)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/03/29_15_19_16_clipbord_1680074340446.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)

解决思路： 首先在YashanDN DN 上通过系统管理员新加TP 和AP 资源组，并且把 用户userC 绑定到TP 资源组，用户userD 绑定到 AP 资源组；用户userC 和userD 登录后，通过CN sharding 到其中一台DN， 则 userC 和userD 在满负载时按照资源组TP: AP 即 20：10  的比例隔离资源运行。

####   [5.7.2 白天和晚上不同时段 单机 AP 和 TP 用户资源占用比例自动调整](#572-白天和晚上不同时段-单机-ap-和-tp-用户资源占用比例自动调整)  

比如，用户在白天，TP 和 AP 比例为 7：3 ,  但是 晚上是 3：7

解决思路：TP 和 AP 比例先设为为 7：3, 在Linux系统开一个crontab 线程，到了晚上13点后，就实时调整cgroup TP 和AP 为比例3：7，然后到了白天7点，又重新设置比例为7：3.   这样就实现了资源的自动调整。

####   [5.7.3  单机对特定用户运行资源限制](#573--单机对特定用户运行资源限制)  

比如分配一个测试用户 test, 限制它操作时最多使用CPU 资源不超过1个。

解决思路：创建一个资源组，设置这个资源组 cpu.cfs_quota_us = 100000，也就是对应使用CPU 上限为1个，然后把 test测试用户绑定到这个资源组，后续test 用户登录后，它的CPU 使用上限最大1个，即使其他CPU 空闲，也不能够被test 用户借用。

####   [5.7.4  单机对特定用户预留一定资源](#574--单机对特定用户预留一定资源)  

比如 对于admin 用户，即使在系统繁忙时，也要预留足够资源使其能够操作。

解决思路：创建一个资源组，设置这个资源组 cpu.shares = 100，把admin 用户绑定这个资源组，假设其他所有资源组 cpu.shares总和为 1000， 那么admin 用户登陆时，它最少能够使用10%的CPU 资源。

####   [5.7.5  分布式cn, mn, dn 同一台机器部署资源分配](#575--分布式cn-mn-dn-同一台机器部署资源分配)  

比如在分布式场景，cn, mn, dn 同时部署一台物理机器上，设置他们各自资源比例

解决思路：通过脚本，在/sys/fs/cgroup 目录下，创建YASDB-CN, YASDB-MN, YASDB-DN1, YASDB-DN2 等等cgroup 目录文件，并且通过各自cgroup 的cpu.shares 值设定他们资源的比例，比如 分别设置比例为 30：10：30：30.

###   [5.8  IO和内存隔离](#58--io和内存隔离)  

IO和内存 第一阶段先不实现，这里只是简单介绍。

####   [5.8.1   IO隔离](#581---io隔离)  

IO 子系统支持两种IO隔离策略

第一种是相对隔离，按照权重值来配，权重取值范围100-1000。 通过以下两个文件进行配置

blkio.weight 默认值

blkio.weight_device 块设备级的值 （优先级高于blkio.weight）

第二种是绝对隔离，限制IOPS 值的使用上限

```
bytes/s

echo "8:0 10485760" &gt;/cgroup/blkio/test/blkio.throttle.read_bps_device

io/s

echo "8:0 10" &gt; /cgroup/blkio/test/blkio.throttle.read_iops_device

bytes/s

echo "8:0 10485760" &gt; /cgroup/blkio/test/blkio.throttle.write_bps_device

io/s

echo "8:0 10" &gt; /cgroup/blkio/test/blkio.throttle.write_iops_device

```

####   [5.8.2  内存隔离](#582--内存隔离)  

提供两种方式设置自身内存的上限：一种是按照计算机器总内存上限的百分比计算自身可以使用的总内存，由memory_limit_percentage参数配置；另一种是直接设置yanshan可用内存的上限，由memory_limit参数配置。其中memory_limit参数值为0时，使用百分比的配置方式，否则则使用绝对值的配置方式。

###   [5.9  DFX设计](#59--dfx设计)  

1. 性能，根据目前可查到的资料，当满足下面的条件时，对性能基本无影响：
1. a：cgroup的层级建议不超过10层。
1. b：cgroup的数量上限建议不超过1000，且应当尽可能地减少cgroup的数量。
1. 安全, cgroup 本身是linux 内核自带的模块，并且是业界广泛使用的组件，基本无安全隐患。
1. 可靠, 业界多年来已经验证.
1. 可维、可测：通过正常的功能验证和单元测试来保证。增加1个动态视图：RSRC_CONSUMER_GROUP视图，


|列|描述|
|---|---|
|NAME|使用者组的名字|
|ACTIVE_SESSIONS|使用者组中的活动会话的个数|
|EXECUTION_WAITERS|等待CPU时间片的活动会话的个数|
|REQUESTS|使用者组的会话所发出请求的  **累计值**|
|CPU_WAIT_TIME|资源管理器引起的使用者组里的会话等CPU的时间累计值。这个等待事件不包括I/O等待、队列(Queue)或闩(Latch)竞争引起的延迟，或者注诸如此类的时间。CPU_WAIT_TIME是使用者组花在resmgr: CPU quantum等待事件上的时间总和|
|CPU_WAITS|由于资源管理，会话被迫等待次数的累计值|
|CONSUMED_CPU_TIME|使用者组的会话所使用的CPU时间总和|
|YIELDS|由于资源管理，使用者组里的会话对其他会话做出CPU让步的次数  **累计值**|


##   [6. 自测用例](#6-自测用例)  

参考     [git@git.yasdb.com](mailto:git@git.yasdb.com)    :cod-x/anchorbase.git 下的resoucegroup 分支， 里面已经在yashandb 对核心资源管理的功能做了验证。

用yasdb 的实际场景做了测试，符合预期，具体细节如下：

  [https://conf.yasdb.com/pages/viewpage.action?pageId=109576534](https://conf.yasdb.com/pages/viewpage.action?pageId=109576534)  

##   [7. Workload（工作量）](#7-workload工作量)  

跟李怿和何阳商量，初步计划如下：

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/24_9_36_44_WXWorkLocal_16823001644465.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjYwNTIsImV4cCI6MTc4MjEzNjg1Mn0.TczHi3-g8SidmGflfUlox29GV9HYwxbpGGdEGoE6Iaw)