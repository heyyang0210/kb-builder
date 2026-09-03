Created by 未知用户 (zhongsongjin), last modified on 八月 08, 2023

##   [1. Overview（概述）](#1-overview概述)  

YaShanDB资源管理的目的：

1：YaShanDB在保证数据库稳定运行的前提下最大限度提高整体资源利用率。

2：核心用户和紧急任务更多资源运行。

3：在资源紧张时为定位不同用户资源占用问题提供定位依据。

资源管理包含的范畴有：单机，分布式和集群模式下的资源（CPU,IO,内存，硬盘，并发连接数等等）的隔离，弹性使用和上限限制。

跟业界对比，我们该方案有3个优点：

1：资源管理所有代码全部自研，没有引入任何第三方组件，并且全自动适配linux 底层的不同资源模块功能。

2：资源管理同时面向单机和分布式。

3:   无缝oracle 操作体验。

本期先实现 单机CPU 资源管理。

##   [2. Features（功能特性）](#2-features功能特性)  

2.1  单机CPU 资源管理

- 设置YashanDB 服务进程在整个机器的CPU 最大使用率，比如 最大占整个机器所有CPU 80%。
- 设置系统线程，用户线程的CPU 资源比例。
- 设置资源使用组，根据用户绑定资源，从而隔离用户的CPU资源。
- 隔离用户资源分3种，第1种是相对隔离，这种是按照权重设置的，这种最大的优点是当CPU 不忙时，用户使用CPU 可盗取借用； 第2种是绝对隔离，比如设置使用CPU 80%，那么就最多只能使用80%；  第2种是指定CPU 核隔离资源，比如把特定用户线程绑定到特定CPU 核。


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [3.1 概念体系](#31-概念体系)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/8_18_8_25_WXWorkLocal_16809482856963.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE2OTUsImV4cCI6MTc4MjMwMjQ5NX0.f2Vd01KNyZfDZn367Fq7lkgkS0BE9exU8RIDXJN9WCU)

####   [3.1.1 资源使用组](#311-资源使用组)  

资源使用组由许多用户会话组成，这些会话有相同的资源使用请求。新创建一个会话时，DBRM会根据你的设定自动把它分配到某个组。数据库管理员还可以手动的调整某个会话所属的组。

下面两类特别的组是系统组，它们不能被修改或删除。

•SYS_GROUP•DEFAULT_CONSUMER_GROUP

####   [3.1.2 资源计划指令](#312-资源计划指令)  

一种规格的 CPU、内存、存储空间、IOPS资源组合的描述，是数据库服务内部的资源容器。比如 资源计划指令 A CPU 4个，IOS 128 MEM 50M DISK 50G.  在RDMB根据当前活动资源计划中的一系列资源计划指令为资源使用组分配资源。资源计划和指令间有着一对多的关系，资源计划中不能包含两条相同的指令。执行完资源管理命令使用的是当前的CPU个数，重新设置的CPU个数不生效，如果要生效，需要重启启动yasdb 进程。

####   [3.1.3 资源计划](#313-资源计划)  

资源计划包含一系列指令，这些指令就决定了给每个组的资源分配配置。要执行资源的分配，你只需执行相应的资源计划。一个用户在一个数据库中同一时间只有一个资源计划起作用。

####   [3.1.4  资源映射](#314--资源映射)  

就是资源使用组要映射到哪一个资源计划指令的规则。默认开启的是EXPLICIT 和 ORACLE_USER。

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

####   [3.2.2 表结构设计](#322-表结构设计)  

需要增加下面6个系统表, 表之间关系如下：

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/23_15_56_41_20230423155640.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE2OTUsImV4cCI6MTc4MjMwMjQ5NX0.f2Vd01KNyZfDZn367Fq7lkgkS0BE9exU8RIDXJN9WCU)

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
|MAX_IO_SHARE|NUMBER|IO share 最大值|
|MAX_IO_LIMIT|NUMBER|IO 限制 最大值|
|MGMT_P1|NUMBER|level1 对应的百分比|
||||


资源管理权限表 （RSRC_MANAGER_SYSTEM_PRIVS）

|列名|属性|说明|
|---|---|---|
|GRANTEE|VARCHAR2(128) PRIMARY KEY NOT NULL|被授权者|
|PRIVILEGE|NOT NULL VARCHAR2(40)|权限|
|ADMIN_OPTION|VARCHAR2(3)|是否管理员|


约束关系

|场景|表现|
|---|---|
|删除用户，用户下有映射到使用者组|成功，mapping变为pending|
|删除使用者组，使用者组被包含于指令|失败，报错 plan/consumer_group %s referred to by another plan and cannot be deleted|
|删除使用者组，有用户映射到使用者组|成功，映射同时被删除|
|删除计划|成功，删除计划下的所有指令|
|创建映射与用户并发|不影响用户删除，删除用户后提交，创建成功|
|创建指令，超过资源最大值上限|成功，具体控制比例待查看|
|创建映射，用户不存在|oracle需要先给用户切换到某个使用者组的权限，然后才能切换，授权报错|
|创建映射，消费者组不存在|oracle需要先给用户切换到某个使用者组的权限，然后才能切换，授权报错|
|创建指令，消费者组不存在|报错消费者组不存在|
|创建指令，已包含该指令|报错 plan directive {PLAN}，{CONSUMER_GROUP} already exists|


新加配置参数：

|配置名|默认值|说明|
|---|---|---|
|YASDB_CGROUP_DIR|/sys/fs/cgroup|资源管理模块根目录|
|resource_manager_plan|“‘|正在运行的资源计划，为空表示不使用资源管理|
|RESOURCE_LIMIT|资源管理开关||


####   [3.2.3   DC 设置](#323---dc-设置)  

目前只需要把 资源使用者映射规则表 存放在DC 就可以，因为用户登陆操作时（这个是高频操作），只需要用到映射规则，就可以实现资源管控。

ResMgrDict映射规则表

|名字|属性|说明|
|---|---|---|
|consumerGroupName|CodChar[128]|资源使用组|
|id|CodUint32|资源使用组个数|
|isInvalid|CodBoolshi'f|是否被删除|
|refCount|CodUint32|引用计数|
|hasDirective|CodAtomicBool|资源组是否生效|
|used|CodBool|槽位是否被占用|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1：本设计方案暂时支持 linux 系统运行。2: 用户最多最大配置126个，包括SYS_GROUP 和 DEFAULT ，总共1283: 映射用户属性只支持USER（大小写都可以）。4：cpu_share，cpu_limit  范围0~99，0不生效，相当于不用，程序不提示错误；100 提示错误；非整数或者负数提示参数输入错误5：CGROUP_FLAG，资源管理开关， 0 关闭； 1：开CPU； 目前只支持 0 和 1；输入其他输入提示错误。6: 资源删除规则这里，有一个创建操作，就会对应一个删除操作。7：资源删除规则唯一的依赖关系，对应同一个资源组，资源指令和映射，就必须先操作Dbms_resource_manager.delete_plan_directive 和Dbms_resource_manager.delete_consumer_group_mapping，才能dbms_resource_manager.delete_consumer_group。否则会报错。8：用户不能自己把资源组命名为 SYS_GROUP 和 DEFAULT_CONSUMER_GROUP,但是对用户名名字，计划名字无限制。9：目前资源管理用户共享和绝对限制 都是0 的不允许，也很难理解（实际上资源管理不能为0）。   最少要输入 共享和绝对资源 有一个非零。   下面的情况是输入时会提示无效参数: begindbms_resource_manager.create_plan_directive('TEStEST','TESTUsER130',0,0);end;/10：用户体系和资源管理体系关系:a：创建映射，用户不存在，不能创建；b：删除用户，不会删除映射，提供删除用户接口，需要用户手动去删除映射；c：增加pending 字段为后续多计划扩展用，pending 放在RSRC_PLAN_DIRECTIVES$; d: 为了保证sys的资源，sys 用户的映射不能被删除；

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.10  架构图](#510--架构图)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/12_19_38_20_WXWorkLocal_16812994755448.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE2OTUsImV4cCI6MTc4MjMwMjQ5NX0.f2Vd01KNyZfDZn367Fq7lkgkS0BE9exU8RIDXJN9WCU)

目前资源管理的实现组件是利用内核模块cgroup。5点说明：

1. 对于YashanDB来说，只是需要嵌入自研cgroup 接口层 的API 就可以，不需要了解操作系统cgroup 底层的细节；
1. cgroup在这个架构中可以简单理解为一个文件系统，我们对cgroup 任何操作，简单类比为对文件系统的内容修改，在cgroup 中我们创建了一个属于yashandb 有读写权限的yashanDB 目录。
1. 资源计划和资源计划指令是通过名字映射到cgroup 目录来实现 对应关系的。
1. 目前业界主流的是cgroup v1, 建议是在满足cgroup v1 基础上，适配cgroup v2 , 当然，版本发布时是要V1 和V2 都要兼容的，这个是cgroup 接口层自动适配的工作，开发者和用户都无感知；
1. 只有系统管理才有分配资源的写权限；普通用户只能根据系统管理员分配的资源来运行。


###   [5.11 单机多进程资源管理架构](#511-单机多进程资源管理架构)  

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/11_11_21_54_WXWorkLocal_16811832882392.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE2OTUsImV4cCI6MTc4MjMwMjQ5NX0.f2Vd01KNyZfDZn367Fq7lkgkS0BE9exU8RIDXJN9WCU)

1：设置上层属于yashanDB 有读写权限的目录，但是中间多了一个层次来区分属于进程，比如dn-3-1 ，而且多个进程之间可以设置资源比例；

2：到了各个进程内部，比如 dn-3-1, 它的内部使用资源结构和单机版本资源管理结构一致。

完成操作流程：系统启动前首先系统管理员要创建各个资源组，来指定各类资源配额。系统运行用户登录后当发起一个请求后，会根据用户资源匹配规则来绑定资源组，当用户运行时就会按照绑定 linux 底层cgroup 资源组的资源配额来隔离和调度资源。

###   [5.3  关键技术和难点](#53--关键技术和难点)  

####   [5.3.1  Cgroup](#531--cgroup)  

cgroup，是目前业界通用的资源管理组件，其名称源自控制组群（control groups）的简写，是Linux内核的一个功能，用来限制、控制与分离一个进程组的资源（如CPU、内存、磁盘输入输出等）。cgroups 分V1 和 V2 版本，目前绝大多数的 linux 默认是V1 版本， V2 只是作为可选的版本 。

更多cgroup 的知识，参考：

  [https://conf.yasdb.com/display/YAS/cgroup](https://conf.yasdb.com/display/YAS/cgroup)  

Ubuntu 下V1 和 V2 版本的切换，操作时需要root 权限。当systemd.unified_cgroup_hierarchy=0 为V1, systemd.unified_cgroup_hierarchy=1 为V2.

Vi /etc/default/grub

增加 GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"

update-grub2

reboot

####   [5.3.2  资源接口层](#532--资源接口层)  

资源管理涉及多个方面，包括CPU, IO , 内存等等， 虽然说每个实现细节不一致，但是还是有共性部分，由此抽取出一个共性的资源管理接口层，另外，业界开源的libcgroup 功能比较重，采用自己写适配层，一来能够轻量上阵，二来能够更好的结合yashanDB 业务特色。

//资源组件版本   zhongsongjin 20230230enum CgroupVersion {NoneMount,cgroupMountV1,cgroupMountV2};

// 资源管理模块初始化  zhongsongjin 20230230CodResult initCPUCgroup(CodChar *path,CodUint32 initFlag,enum CgroupVersion *deviceCgroupVersion,CodChar *cgroupCpuRootPath, CodChar *cgroupIORootPath);

// 创建第一层资源组  zhongsongjin 20230230CodResult createleveloneCgroup(CodChar* plan, CodChar *leveloneCgroup, CodInt32 shareweight, CodInt32 limit,CodInt32 IOByteLimit, CodInt32 IOCountLimit,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

// 创建系统线程资源组  zhongsongjin 20230230CodResult createSysCgroupTid(const CodInt32 tid,CodChar *parentPath, CodChar *username,CodUint32 initFlag,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

// 创建用户线程资源组  zhongsongjin 20230230CodResult matchUserCgroupWriteTid(const CodInt32 tid,CodChar *parentPath, CodChar *username,CodUint32 initFlag,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

// 创建默认资源组  zhongsongjin 20230230CodResult matchDefaultCgroupWriteTid(const CodInt32 tid,CodChar *parentPath, CodChar *username,CodUint32 initFlag,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

//删除第一层资源组  zhongsongjin 20230230CodResult deleteleveloneCgroup( CodChar *leveloneCgroup,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

//获取CPU 资源使用情况   zhongsongjin 20230230CodResult getCgroupCpuUsageStat(CodChar *resname,CodChar *user,CodChar *system,CodChar *nr_periods,CodChar *nr_throttled,CodChar *throttled_time,const CodChar *cgroupCpuRootPath);

####   [5.3.3 资源管理MGR 文件设计](#533-资源管理mgr-文件设计)  

层次如下:

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/23_15_16_38_WXWorkLocal_16822341855725.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE2OTUsImV4cCI6MTc4MjMwMjQ5NX0.f2Vd01KNyZfDZn367Fq7lkgkS0BE9exU8RIDXJN9WCU)

#####   [功能点实现](#功能点实现)  

资源管理MGR 文件核心设计：首先yashan启动时初始化cgroup资源模块； 然后运行中要有用户资源匹配规则，这个由系统管理员高级包来写入，并且资源匹配规则存放在全局内存区域。需要改造的是代码中在2个地方实现资源匹配规则的判断，一个地方是用户成功登陆后，一个地方是用户并发线程执行任务时（也就是ParallelAttachWorker 这个接口中），这样业务逻辑就嵌入了资源管控了。用户登陆后，通过资源匹配规则映射到对应的规则指令，然后内核就会对这个用户进行资源管控。整个设计中无需要其他第三方依赖。

![](https://git.yasdb.com/linjunzhe/pics/-/raw/main/pictures/2023/04/18_14_5_22_WXWorkLocal_16817979018468.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE2OTUsImV4cCI6MTc4MjMwMjQ5NX0.f2Vd01KNyZfDZn367Fq7lkgkS0BE9exU8RIDXJN9WCU)

#####   [接口实现](#接口实现)  

//资源组件版本   zhongsongjin 20230230enum CgroupVersion {NoneMount,cgroupMountV1,cgroupMountV2};

// 资源管理模块初始化  zhongsongjin 20230230CodResult initCPUCgroup(CodChar *path,CodUint32 initFlag,enum CgroupVersion *deviceCgroupVersion,CodChar *cgroupCpuRootPath, CodChar *cgroupIORootPath);

// 创建第一层资源组  zhongsongjin 20230230CodResult createleveloneCgroup(CodChar* plan, CodChar *leveloneCgroup, CodInt32 shareweight, CodInt32 limit,CodInt32 IOByteLimit, CodInt32 IOCountLimit,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

// 创建系统线程资源组  zhongsongjin 20230230CodResult createSysCgroupTid(const CodInt32 tid,CodChar *parentPath, CodChar *username,CodUint32 initFlag,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

// 创建用户线程资源组  zhongsongjin 20230230CodResult matchUserCgroupWriteTid(const CodInt32 tid,CodChar *parentPath, CodChar *username,CodUint32 initFlag,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

// 创建默认资源组  zhongsongjin 20230230CodResult matchDefaultCgroupWriteTid(const CodInt32 tid,CodChar *parentPath, CodChar *username,CodUint32 initFlag,enum CgroupVersion deviceCgroupVersion,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

//删除第一层资源组  zhongsongjin 20230230CodResult deleteleveloneCgroup( CodChar *leveloneCgroup,const CodChar *cgroupCpuRootPath,const CodChar *cgroupIORootPath);

//获取CPU 资源使用情况   zhongsongjin 20230230CodResult getCgroupCpuUsageStat(CodChar *resname,CodChar *user,CodChar *system,CodChar *nr_periods,CodChar *nr_throttled,CodChar *throttled_time,const CodChar *cgroupCpuRootPath);

####   [5.3.4 多线程并发场景](#534-多线程并发场景)  

a:  同一个用户多session 对同一个资源文件并发操作

对同一个资源文件的操作， 这个由操作系统来管控，cgroup  内核是 vfs 调用,  vfs是实现了write 和 read 并发控制的，这个无需额外工作量。

b:  多个管理员同时对资源管理规则修改

目前资源管理规则是存储在DC中（当然有持久化），DC 有专门的模块所来SPINLOCK_DICT，利用这个模块所可以实现并发控制。

c:  分布式环境下管理员操作后必须MN,CN, DN 同时生效

比如 用户A 绑定资源使用组B， 那么在分布式环境下，必须所有的MN,CN, DN  都要同时生效，不能由模块不生效。 这个可以增加命令下发检测接口，如果由失败的就重发3次。

目前可以这样理解，资源管理模块是支持多线程并发的。

####   [5.3.5  分布式资源消息一致性](#535--分布式资源消息一致性)  

通过高级包分发消息，必须在分布式下保证所有的消息一致，这个需要另外方案讨论。

####   [5.3.6 资源匹配规则生效](#536-资源匹配规则生效)  

目前是系统管理员操作了资源匹配规则后，如果是未登陆的session 用户，那么登陆后马上匹配最新修改的规则；如果是已经登陆的sessio用户，那么是用老的规则。

###   [5.4 功能使用](#54-功能使用)  

####   [5.4.1 初始化流程](#541-初始化流程)  

初始化的目的是为了在linux cgroup 下建立一个YASDB的文件目录，让yashanDB 运行进程有权限对该文件目录下所有文件进行读写操作。

下面是脚本的实现（在执行脚本时必须有root 权限）

1：判别系统的cgroup 版本；

2：根据cgroup V1  和 cgroup V2 不同版本，进入到对应的目录（cgroup 默认安装路径 /sys/fs/cgroup/）

3： 如果之前已经创建过该目录，删除，避免老数据影响；

4： 如果没有，就新建 /sys/fs/cgroup/YASDB 目录；

5：给  /sys/fs/cgroup/YASDB 授权访问读写权限，后续yashanDB  进程可以对该 YASDB目录进行读写操作。

后续这个流程操作要结合OM 来初始化完成。

OM 细节实现参考：    [https://conf.yasdb.com/pages/viewpage.action?pageId=109052012&version=2.5.50000.157&platform=win](https://conf.yasdb.com/pages/viewpage.action?pageId=109052012&version=2.5.50000.157&platform=win)  

####   [5.4.2 资源数值修改](#542-资源数值修改)  

1：在 system_tables.sql 中配置好系统线程和用户线程的比例，初始化时会把这些数据写入数据库并且运行时使用。后续这些数值可以通过高级包来修改。

2：系统线程和用户线程的资源比例最终体现在cgroup 的权重中。

3：只有授权的用户才有权限修改资源比例。

####   [5.4.3 用户资源分配](#543-用户资源分配)  

1：资源管理正常情况对用户无感知，用户登陆后自动映射到对应配置好资源组。

2：只有当资源不足时，各个用户才会按照配置好的比例来分配资源。此时，分配资源多的用户肯定性能要快些。

3：极端情况下， 如果资源模块出现问题，有开关可以关闭资源模块，那么就回到了没有资源管理的情况。这个是保持系统稳定的最低条件。

###   [5.5 YashanDB 后台线程绑定cgroup](#55-yashandb-后台线程绑定cgroup)  

单机版的 YashanDB 线程主要分3个部分，启动时系统线程 绑定在system 资源组，worker 线程绑定在other 资源组，除此其他线程如果没有特别指定也放入other 资源组。

另外用户有新创建的资源组，那worker 线程就根据用户所属的资源组绑定。比如 新建admin 资源组，用户admin 登录，那么admin 所在的worker 线程就绑定到admin 资源组。

由于worker 线程是公共的，可能存在用户复用的情况，不过同一个时刻，只能有一个用户用这个worker 线程。 这里只需要在这个时刻，把这个worker 线程根据用户属性绑定到对应的资源组。  cgroup 资源绑定有一个特点，当把这个线程tid 绑定到一个资源组后，那么cgroup就会把这个tid 从老的资源组解绑，这样就保证一个线程在同一时刻只绑定一个资源组。

下面是单机系统线程和建议资源配比（父资源组估计占用60%， 各个线程从父资源组中分配资源）

|线程名|建议权重值|
|---|---|
|yasdb|10|
|TIMER|10|
|BUFFER_POOL|10|
|PRELOADER|10|
|SMON|10|
|CKPT|10|
|DBWR|10|
|LISTENER_LOG|10|
|TCP_LSNR|10|
|XFMR|10|
|HEALTH_MONITOR|10|
|HOT_CACHE_RECYCLE|10|
|LOGW|10|
|MMON|10|
|Job Queue|10|
|||
|||


分布式后台线程也是按照类似情况分配。

系统后台线程资源分配可以看作时特殊的用户线程资源分配，只不过系统线程资源分配是程序启动时系统分配的，而用户线程资源分配是后续系统管理员操作的。 这个可以在wr_tables.sql 增加想要的操作语句：

begindbms_resource_manager.create_consumer_group('DEFAULT_CONSUMER_GROUP','create DEFAULT_CONSUMER_GROUP');end;/

begindbms_resource_manager.create_consumer_group('SYS_GROUP','create SYS_GROUP');end;/

beginDbms_resource_manager.create_plan_directive('TOALL','SYS_GROUP',50,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('TOALL','DEFAULT_CONSUMER_GROUP',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','HEALTH_MONITOR',5,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','YASDB',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','TIMER',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','BUFFER_POOL',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','PRELOADER',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','SMON',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','CKPT',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','DBWR',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','LISTENER_LOG',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','TCP_LSNR',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','HOT_CACHE_RECYCLE',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','LOGW',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','MMON',10,0,0,0);end;/

beginDbms_resource_manager.create_plan_directive('SYS_GROUP','JOBQUEUE',10,0,0,0);end;/。。。。。。

系统后台线程数值也是可以修改的，采用上面的  dbms_resource_manager.update_plan_directive 接口来调整,但是系统线程资源不能删除，也不能被用户映射。

###   [5.6 YashanDB 用户线程绑定cgroup](#56-yashandb-用户线程绑定cgroup)  

用户线程分2种，detached 模式 和 workpool 模式。

第一种：detached 模式的，首先必须在 open 状态下，然后先查询规则组，命中后根据规则把线程写入内核cgroup.

```
if( gInstance-&gt;startUpPhase== STARTUP_OPEN &amp;&amp; gInstance-&gt;profile.maxWorkers == 0) {
    CodChar* consumerGroup;
    CodBool  isFound;
    if (ankDcGetConsumerGroupByUser(anlGetKnlHandler(session-&gt;handler), &amp;session-&gt;client.user, &amp;consumerGroup, &amp;isFound) != COD_SUCCESS) {
        COD_RLOG_LAST_ERROR("get consumer group failed");
    } else {
        if (isFound &amp;&amp; writeUserResCgroup(worker-&gt;thread.id, session-&gt;client.user.str, consumerGroup) != COD_SUCCESS) {
            COD_RLOG_LAST_ERROR("writeUserResCgroup fail");
        }
    }
}

```

特别指出的是 SYS_GROUP 是系统资源，必须保证有足够的系统可以运行，当SYS_GROUP 的共享资源相对比较少，系统会在用户输入是做动态调整，调整公式时：

SYS_GROUP / （SYS_GROUP + 所有 USER_GROUP） < 40% 时， 就调为 SYS_GROUP = 所有 USER_GROUP

做数值调整的目的是为了保证系统可用 。只要满足上面的条件，就会动态调整，否则不管是删除还是修改，都不会调整。

另外，系统设置SYS_GROUP 的绝对上限不能少于40%。 目的也是为了保证系统的可用。

第二种，workpool 模式，这个模式对资源管理有一定损耗，暂时情况可以观察，后面根据实际情况看看是否启用。具体修改 anrAttachParalWorker 函数下。

##   [5.7 核心场景分析](#57-核心场景分析)  

####   [5.7.1  单机对特定用户运行资源限制](#571--单机对特定用户运行资源限制)  

比如分配一个测试用户 test, 限制它操作时最多使用CPU 资源不超过1个。

解决思路：创建一个资源组，设置这个资源组 cpu.cfs_quota_us = 100000，也就是对应使用CPU 上限为1个，然后把 test测试用户绑定到这个资源组，后续test 用户登录后，它的CPU 使用上限最大1个，即使其他CPU 空闲，也不能够被test 用户借用。

####   [5.7.2  单机对特定用户预留一定资源](#572--单机对特定用户预留一定资源)  

比如 对于admin 用户，即使在系统繁忙时，也要预留足够资源使其能够操作。

解决思路：创建一个资源组，设置这个资源组 cpu.shares = 100，把admin 用户绑定这个资源组，假设其他所有资源组 cpu.shares总和为 1000， 那么admin 用户登陆时，它最少能够使用10%的CPU 资源。

####   [5.7.3  分布式cn, mn, dn 同一台机器部署资源分配](#573--分布式cn-mn-dn-同一台机器部署资源分配)  

比如在分布式场景，cn, mn, dn 同时部署一台物理机器上，设置他们各自资源比例

解决思路：通过脚本，在/sys/fs/cgroup 目录下，创建YASDB-CN, YASDB-MN, YASDB-DN1, YASDB-DN2 等等cgroup 目录文件，并且通过各自cgroup 的cpu.shares 值设定他们资源的比例，比如 分别设置比例为 30：10：30：30.

####   [5.7.4  主备资源管理](#574--主备资源管理)  

1：备机也要执行 OM 安装资源管理的命令；否则备机资源管理不生效。2：只有当备升级为主时，如果资源开关打开的情况下，将触发资源管理，资源管理的规则和逻辑和主机相同；如果资源管理开关关闭，将不触发资源管理。不触发备升级为主时，资源管理不生效，也就是按照之前的老逻辑。3：目前主机备机没有办法保证消息一致性，也就是说，主机打开资源开关，备机不会同步打开开关，备机要打开开关，必须手动去打开；4：主机变为备机，原来资源管理的规则还继续生效。

####   [5.7.5 用户体系和资源管理体系关系:](#575-用户体系和资源管理体系关系)  

a：创建映射，用户不存在，不能创建；b：删除用户，自动去删除映射关系；c：增加pending 字段为后续多计划扩展用，pending 放在RSRC_PLAN_DIRECTIVES$;d: sys 用户默认映射到sys_group 下；d: 为了保证sys的资源，sys 用户的映射不能被删除；

###   [5.9  DFX设计](#59--dfx设计)  

1. 性能，根据目前可查到的资料，当满足下面的条件时，对性能基本无影响：
1. a：cgroup的层级建议不超过10层。
1. b：cgroup的数量上限建议不超过1000，且应当尽可能地减少cgroup的数量。
1. 安全, cgroup 本身是linux 内核自带的模块，并且是业界广泛使用的组件，基本无安全隐患。
1. 可靠, 业界多年来已经验证.
1. 可维、可测：通过正常的功能验证和单元测试来保证。增加1个动态视图，


本视图显示分布式集群中所有节点的数据库汇总信息。

本视图显示分布式集群中所有节点的数据库汇总信息。

|字段|类型|说明|
|---|---|---|
|RESNAME|VARCHAR(256)|资源组|
|USER|VARCHAR(256)|用户态|
|SYSTEM|VARCHAR(256)|系统态|
|NR_PERIODS|VARCHAR(256)|周期|
|NR_THROTTLED|VARCHAR(256)|阻断次数|
|THROTTLED_TIME|VARCHAR(256)|阻断时间|


##   [6. 自测用例](#6-自测用例)  

参考     [git@git.yasdb.com](mailto:git@git.yasdb.com)    :cod-x/anchorbase.git 下的resoucegroup 分支， 里面已经在yashandb 对核心资源管理的功能做了验证。

用yasdb 的实际场景做了测试，符合预期，具体细节如下：

  [https://conf.yasdb.com/pages/viewpage.action?pageId=109576534](https://conf.yasdb.com/pages/viewpage.action?pageId=109576534)  

##   [7. Workload（工作量）](#7-workload工作量)  

|任务（SR）|优先级|SR|AR|描述|工作量|责任人|
|---|---|---|---|---|---|---|
|单机CPU 资源管理|1|单机支持通过资源管理管控CPU|||6-15 ~ 7-7|钟松金|
||||支持cgroup适配层||5-23 ~ 6-6|钟松金|
||||支持系统线程的资源管控||6-7 ~ 6-14|钟松金|
||||OM支持安装部署配置root权限cgroup的目录||6-7 ~ 6-20|德柳|
|分布式CPU 资源管理||分布式支持通过资源管理管控CPU|||6-20-7-15|钟松金|
||||分布式资源管理消息一致性||5-23 ~ 6-20|何阳|
||||||||
||||||||
||||||||
