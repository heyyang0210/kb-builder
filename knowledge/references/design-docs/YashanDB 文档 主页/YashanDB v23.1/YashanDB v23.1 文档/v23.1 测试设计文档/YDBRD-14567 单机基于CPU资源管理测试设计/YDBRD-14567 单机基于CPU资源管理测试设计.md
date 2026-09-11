Created by 施新华, last modified on 十一月 14, 2023

# 1. 概述 

资源管理是数据库一个重要能力，资源管理正确配置可以提高系统的性能，同时也可以避免资源浪费。  OS或数据库资源有限，通过资源管理对于不同用户或者进程可以进行资源限制来优化数据库可靠性以及性能，同时也可以保护其他用户或者进程免受某个用户或进程的大量资源消耗的影响。

资源管理包含的范畴有：单机，分布式和集群模式下的资源（CPU，IO，内存，硬盘，并发连接数等）的隔离、弹性使用和上限限制。

当前需求验证范围只限于单机部署模式下CPU资源管理。

# 2. 需求分析 

SR：    [YDBRD-14567](https://jira.yasdb.com/browse/YDBRD-14567?src=confmacro)    -  单机支持通过资源管理管控CPU  完成

参考文档：

  [单机支持资源管理管控CPU详细设计方案](109598257.html)  

  [OM支持安装部署配置资源管理cgroup的目录 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119538200)  

## 2.1 单机CPU资源管理

- 设置YashanDB 服务进程在整个机器的CPU 最大使用率，比如 最大占整个机器所有CPU 80%。
- 设置系统线程，用户线程的CPU 资源比例。
- 设置资源使用组，根据用户绑定资源，从而隔离用户的CPU资源。
- 设置不同用户组资源使用优先级。
- 隔离用户资源分三种，第1种是相对隔离，这种是按照权重设置的，这种最大的优点是当CPU 不忙时，用户使用CPU 可盗取借用； 第2种是绝对隔离，比如设置使用CPU 80%，那么就最多只能使用80%；   第3种是指定CPU 核隔离资源，比如把特定用户线程绑定到特定CPU 核；第3种目前不支持  。
- 资源隔离有系统级别，用户级别和语句级别，暂时实现系统级别和用户级别，后续再扩展语句级别；目前只支持用户级别。


## 2.2 单机资源管理实现原理

      目前资源管理的实现组件是利用内核模块cgroup：

1. 对于YashanDB来说，只是需要嵌入自研cgroup 接口层 的API 就可以，不需要了解操作系统cgroup 底层的细节；
1. cgroup在这个架构中可以简单理解为一个文件系统，对cgroup 任何操作，简单类比为对文件系统的内容修改，在cgroup 中创建了一个有读写权限的yashanDB 目录。
1. 资源计划和资源计划指令是通过名字映射到cgroup 目录来实现 对应关系的。
1. 目前业界主流的是cgroup v1, 建议是在满足cgroup v1 基础上，适配cgroup v2 , 当然，版本发布时是要V1 和V2 都要兼容的，这个是cgroup 接口层自动适配的工作，开发者和用户都无感知。cgroup介绍：    [cgroup](/pages/createpage.action?spaceKey=YAS&title=cgroup)  


          Ubuntu系统修改：

Ubuntu 下V1 和 V2 版本的切换，操作时需要root 权限。当systemd.unified_cgroup_hierarchy=0 为V1, systemd.unified_cgroup_hierarchy=1 为V2.

Vi /etc/default/grub

增加 GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"

update-grub2

reboot

备注：只有系统管理才有分配资源的写权限；普通用户只能根据系统管理员分配的资源来运行。

![](https://pingcode.yasdb.com/atlas/files/public/673969978970c2af4f51f944/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDc2MTgsImV4cCI6MTc4MjIxODQxOH0.D_n8OWX-y19oiArhYZxUhDtTsHV53OBzJKfS4KsYhrE)

## 2.3 单机部署变化

yasboot     package   se gen 新增参数如下，若是需要创建cgroup目录，--create-cgroup必须添加。

|序号|长参|短参|说明|是否必填|
|:---|:---|:---|:---|:---|
|1|--groupname|  
|group名称|否|
|2|--sudo--username|-su|具有sudo权限的ssh用户|否|
|3|--sudo--password|-sp|具有sudo权限的ssh用户密码|否|
|4|--create-cgroup|  
|是否创建Cgroup目录，默认否，bool类型|否|
|5|--cgroup-path|  
|cgroup路径，默认为/sys/fs/cgroup|否|


例如：

yasboot package se gen -c yashan -u test  -p test  -i /xxx    --ip 127.0.0.1  --port 22  --data-path  /xxx/  --node 3   --create-cgroup

或 yasboot package se gen -c yashan -u test  -p test  -i /xxx    --ip 127.0.0.1  --port 22  --data-path  /xxx/  --node 3   --create-cgroup   --groupname test  --sudo–username root  --sudo–password xxx 

*备注：当不输入sudo用户名和密码，默认从-u -p 参数获取*  *。*

然后执行: yasboot install   -i packagename  -t hosts.toml

                 yasboot cluster deploy -t yashan.toml

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=119538200#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

## 2.4 单机CPU资源管理配置方式

前提已经创建用户(create user)，通过执行高级包方式进行资源管理相关配置的创建，更新以及删除。

### **资源管理创建流程**  ：

**步骤1：修改参数使得资源管理功能生效，alter system set CGROUP_ENABLED= 1  scope=spfile;   /* 该参数重启生效*/**

               *参数值：0 关闭； 1：开CPU*

**步骤2：创建消费者组(Consumer Groups)**

**步骤3：创建消费者组映射规则(Consumer Group Mapping Rules)**

**步骤4：创建资源计划指令(Plan Directives)**

**详细描述**  ：

1）创建消费者组(Consumer Groups)

资源使用组由许多用户会话组成，这些会话有相同的资源使用请求；新创建一个会话时，资源管理器根据设置自动把它分配到某个组，数据库管理员还可以手动的调整某个会话所属的组。

存在三类特别的组是系统组，它们不能被修改或删除：SYS_GROUP ，DEFAULT_CONSUMER_GROUP ，OTHER_GROUP。

- 创建消费者组


       dbms_resource_manager.create_cosumer_group(  '组名'  ,  '注释'  );

- 删除消费者组


      dbms_resource_manager.delete_consumer_group(  '组名'  );

       备注：当消费者组被资源计划指令引用，不能删除。

2）创建消费者映射规则(Consumer Group Mapping Rules)

     把用户映射到消费者组，该用户即有消费者组映射的资源管理功能。

- 创建映射


    dbms_resource_manager.set_consumer_group_mapping（   '属性', '用户名', ‘消费者组名称  ’);   /* '属性' 目前只支持'USER'， 当前一个用户只能映射到一个消费者*/

- 删除映射


    dbms_resource_manager.delete_consumer_group_mapping(  '属性', '用户名'  );

    备注：oracle没有删除接口，去掉映射set消费者组为NULL，并且属性支持通配。

3）创建资源计划指令(Plan Directives)

     创建资源使用计划并映射到消费者。

-     创建资源计划指令


dbms_resource_manager.create_plan_directive(   '计划名字', ‘消费者组名称', '注释', ‘cpu_share’,'cpu_limit','io_byte','io_count'  );

      cpu_share  => 'CPU共享模式配置值'

      cpu_limit  => 'CPU独占模式配置值'

      io_byte  => '暂未使用'

      io_count  => '暂未使用'

- 更新资源计划指令


     dbms_resource_manager.update_plan_directive(   '计划名字', ‘消费者组名称', '注释', ‘cpu_share’,'cpu_limit','io_byte','io_count'  );

- 删除资源计划指令


     dbms_resource_manager.delete_plan_directive(  '计划名字', ‘消费者组名称'  );

**示例：**

```
create user USER4 identified by 123456;

grant dba to USER4;

begin
dbms_resource_manager.create_consumer_group('TESTUSER28','create TESTUSER28');
end;
/

begin
Dbms_resource_manager.set_consumer_group_mapping('USER','USER4','TESTUSER28');
end;
/

begin
Dbms_resource_manager.create_plan_directive('TESTEST','TESTUSER28','hello',0,64,0,0);
end;
/

begin
Dbms_resource_manager.update_plan_directive('TESTEST','TESTUSER28','hello',0,10,0,0);
end;
/
```

**上述流程约束关系：**

|场景|表现|
|:---|:---|
|创建消费者组，已经存在相同名称|报错|
|创建映射，用户不存在|提示用户不存在|
|创建映射，消费者组不存在|报错|
|创建映射，属性和用户名相同|报错|
|创建计划指令，消费者组不存在|消费者不存在|
|创建计划指令，已包含该指令|报错 plan directive {PLAN}，{CONSUMER_GROUP} already exists|
|创建计划指令，超过资源最大值上限|成功，具体控制比例待查看|
|删除用户，用户下有映射到消费者|成功，mapping变为pending|
|删除消费者组，但被被包含于计划指令|失败，报错 plan/consumer_group %s referred to by another plan and cannot be deleted|
|删除消费者，有用户映射到消费者|成功，映射同时被删除|
|删除资源计划指令|用户连接中，报错；用户退出后删除成功。|
|创建映射与删除用户并发|不影响用户删除，删除用户后提交，创建成功|


  


## 2.5 资源管理相关系统表和视图

 资源消费者表(RSRC_CONSUMER_GROUPS)

|列名|属性|说明|
|:---|:---|:---|
|CONSUMER_GROUP|PRIMARY KEY NOT NULL VARCHAR(64)|资源消费者|
|COMMENTS|VARCHAR(2000)|注释说明|
|INSTANCE_ID|BIGINT|实例ID|


资源使用者映射规则表 (RSRC_GROUP_MAPPINGS)

|ATTRIBUTE|PRIMARY KEY , NOT NULL VARCHAR(64)|属性类型比如是用户属性，客户端属性等|
|:---|:---|:---|
|VALUE|VARCHAR(64) NOT NULL|用户名|
|CONSUMER_GROUP|VARCHAR(64) NOT NULL|资源消费者组|
|INSTANCE_ID|BIGINT|实例ID|


资源计划指令 ( RSRC_PLAN_DIRECTIVES）

|列名|属性|说明|
|:---|:---|:---|
|GROUP_OR_SUBPLAN|VARCHAR(64)  NOT NULL|组名（子计划名）|
|PLAN|VARCHAR(64)  NOT NULL|计划名字|
|MAX_UTILIZATION_LIMIT|INTEGER|指定消费者允许的最大CPU绝对上限|
|MAX_IO_SHARE|INTEGER|IO share 最大值|
|MAX_IO_LIMIT|INTEGER|IO 限制 最大值|
|MGMT_P1|INTEGER|共享CPU使用占比|
|INSTANCE_ID|INTEGER|实例ID|


## 动态视图(  **V$CPUSTAT**  )

|列|描述|
|:---|:---|
|RESNAME|资源组|
|USER|用户态|
|SYSTEM|系统态|
|NR_PERIODS|周期|
|NR_THROTTLED|阻断次数|
|THROTTLED_TIME|阻断时间|


## 2.6 新增参数

|配置名|默认值|说明|
|:---|:---|:---|
|CGROUP_ROOT_DIR|/sys/fs/cgroup|资源管理模块根目录|
|RESOURCE_MANAGER_PALN|''|正在运行的资源计划，为空表示不使用资源管理|
|CGROUP_ENABLED|0|资源管理开关，  *0 关闭； 1：开CPU； 2：开IO; 3: CPU 和IO 都开， 该参数重启生效*|


## 2.7 权限管理

  
  只有SYS用户可以配置。

## 2.8 约束

1. 目前消费者组映射配置中属性只支持USER；
1. CPU资源管理配置不支持指定某个CPU，而是取的系统CPU平均值；
1. 不支持create plan配置。
1. 只有SYS用户可以配置资源管理，其它用户无权限配置。


# 3. 测试设计方法 

主要采用的等价类划分，场景法组合及错误推测法进行设计 。

# 4. 详细测试设计

  [单机CPU资源管理.xmind](#)  

# 5. 测试用例

  [单机资源管理测试用例.xlsx](#)  

# 6. 测试框架设计

本次测试采用导入导出测试框架实现，执行py文件，对导入后视图进行检验。

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments: