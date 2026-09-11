Created by 朱松平, last modified on 六月 30, 2023

#   [OM支持单机巡检&巡检策略](#om支持单机巡检巡检策略)  

SR链接：

  [https://jira.yasdb.com/browse/YDBRD-13293](https://jira.yasdb.com/browse/YDBRD-13293)  

  [https://jira.yasdb.com/browse/YDBRD-13287](https://jira.yasdb.com/browse/YDBRD-13287)  

##   [1. Overview（概述）](#1-overview概述)  

说明本设计方案的需求来源，需求分析，功能概要描述。参照已有商业数据库开发的特性，原则上必须有特性调研文档。

收集数据库相关的指标信息，提升数据库的运维能力。

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持单机
- 巡检策略
    - 生成巡检策略配置文件
        - 巡检对象(数据库名称)
        - 支持配置巡检项
            - 支持按照模块和最小巡检项配置
            - db巡检项：    [https://conf.yasdb.com/pages/viewpage.action?pageId=113969768](https://conf.yasdb.com/pages/viewpage.action?pageId=113969768)  
        - 支持按每月/周/天/时巡检
    - 应用巡检策略
    - 取消应用巡检策略
    - 删除巡检策略
    - 展示巡检策略
- 巡检报告
    - 展示巡检报告
        - 巡检报告列表、详情
    - 下载巡检报告
    - 删除巡检报告
    - 创建巡检
        - 立即发起巡检，并生成巡检报告


##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

yasboot新增巡检相关命令：

- 巡检策略


|命令|说明|
|---|---|
|patrol strategy gen|生成巡检策略配置文件|
|patrol strategy add|添加巡检策略|
|patrol strategy apply|应用巡检策略|
|patrol strategy cancel|取消应用巡检策略|
|patrol strategy delete|删除巡检策略|
|patrol strategy list|展示巡检策略列表|


- 巡检报告


|命令|说明|
|---|---|
|patrol report list|展示巡检报告记录列表|
|patrol report get|获取巡检报告详细信息|
|patrol report delete|删除巡检报告|
|patrol report create|立即发起巡检，并生成巡检报告|


###   [3.1 巡检策略](#31-巡检策略)  

####   [3.1.1 patrol strategy gen](#311-patrol-strategy-gen)  

**命令说明**  ：生成巡检配置文件

**参数**  ：

- **--cluster, -c**  ：集群名称，必填项
- **--strategy-name, -s**  ：策略名称，必填项
- **--strategy-type, -t**  ：策略类型，默认为    `PERIOD`    ，可选值(不区分大小写)有：
    -   `PERIOD`    ：周期性巡检策略，可执行多次
    -   `TIMING`    ：定时巡检策略，执行一次
- **--cron-expression，-ce**  ：    `cron`    表达式 (设置了该参数，下面三个参数失效)
    - 格式：    `* * * * *`    ，分别表示：    `分钟、小时、天、月、周`  
- **--frequency，-f**  ：巡检频率，默认为    `weekly`    ，可选值如下：
    -   `monthly`    ：每月
    -   `weekly`    ：每周，默认值
    -   `daily`    ：每天
    -   `hourly`    ：每小时
- **--days，-d**  ：具体某天，表示每月或者每周的第几天，可填写多天 。 eg:     `1,5,6,7`    和    `1，5-7`    都表示第1、5、6和7天；
    - 只有在    `monthly`    、    `weekly`    才参数有效
    - 当频率为    `monthly`    ，取值范围为    `1~31`    ，默认值为    `1-5`  
    - 当频率为    `weekly`    ，取值范围为    `1~7`    ，表示星期一到星期天，默认值为    `1-5`  
- **--start-time，-st**  ：策略开始时间
    - 当频率为    `monthly`    、    `weekly`    和    `daily`    ，格式为    `**:**`    ，表示小时和分钟；默认为    `00:00`  
    - 当频率为    `hourly`    ，格式为    `**`    ，表示分钟；默认为    `00`  
- **--store-path，sp**  ：巡检文件存贮地址，选填项
    - 若指定，必须是绝对路径
    - 默认保存在OM主机地址：    `$YASDB_HOME/om/${CLUSTER_NAME}/data/patrol_report`  
-  **-store-days，sd**  ：最大保存天数，选填项，默认保存所有    - 仅在策略为    `PERIOD`    下有效
- **--store-num，sn**  ：最大巡检报告数量，选填项，默认保存所有
    - 仅在策略为    `PERIOD`    下有效
- **--patrol-module**  ：巡检模块，默认为    `db`    ，填写多个使用    `,`    隔开   (该迭代不不支持，预留参数)
    - 可选：    `db`    、    `all`    预留(    `host`    、    `log`    、    `awr`    等)
    - 支持配置一个巡检模块
- **--db-toml-path**  ：数据库巡检配置文件地址
    - 为空：采用默认数据库巡检配置
    - 不为空：生成数据库巡检默认配置文件，并在策略配置文件中指定该文件
- **--awr-toml-path**  ：awr巡检配置文件地址(该迭代不不支持，预留参数)
- **--host-toml-path**  ：主机巡检配置文件地址(该迭代不不支持，预留参数)
- **--log-toml-path**  ：日志巡检配置文件地址(该迭代不不支持，预留参数)


**注意**  ：

- 生成的巡检配置文件名：    `${strategy_name}_patrolStrategy.toml`  


```
$ yasboot patrol strategy gen -c yashan -s patrol_01 -t period -f weekly -d 1-3,6 -st 12:10

$ yasboot patrol strategy gen -c yashan -s patrol_01 -t period -ce "10 12 1,2,3,6 ? *"

```

**巡检策略配置文件**  ：    `patrol_01_partolStrategy.toml`  

```
cluster = "tp"
strategy_name = "patrol_01"
strategy_type = "PERIOD"

[time_config]
  # cron_expression = "10 12 1,2,3,6 ? *"
  frequency = "weekly"                 // 每周进行巡检 
  days = [1,2,3,6]                     // 每周的星期一、星期二、星期三和星期天巡检
  Start_time = "12:10"                 // 每天12:10开始巡检

[store_config]
  store_path = "/opt/yasom/patrol"     // 巡检报告存贮地址
  store_days = 12                      // 最大保存天数
  store_num = 10                       // 巡检保存数量

[patrol_module]
  [patrol_module.db]
  		# ignore = false 
		config_path = "${YASDB_HOME}/om/${cluster}/config/db.patrol.toml"  #指定巡检配置
 #[patrol_module.awr]  # 后续迭代支持
  		# ignore = false
  		# config_path = "${YASDB_HOME}/om/${cluster}/config/awr.patrol.toml" #未指定的话，采用默认的巡检配置
 #[patrol_module.host] # 后续迭代支持
        # ignore = false
  		# config_path = "${YASDB_HOME}/om/${cluster}/config/host.patrol.toml" 
 #[patrol_module.log] # 后续迭代支持
        # ignore = false
  		# config_path = "${YASDB_HOME}/om/${cluster}/config/log.patrol.toml" 

```

**数据库巡检项配置文件**  ：    `db.patrol.toml`  

```
[[patrol_item]]
  ignore = false
  name = "max_sessions"
  query = "select value max_sessions from sys.v$parameter where name = 'MAX_SESSIONS'"

[[patrol_item]]
  ignore = false
  name = "max_workers"
  query = "select value max_workers from sys.v$parameter where name = 'MAX_WORKERS'"

[[patrol_item]]
  ignore = false
  name = "ha_election_timeout"
  query = "select value ha_election_timeout from sys.v$parameter where name = 'HA_ELECTION_TIMEOUT'"

[[patrol_item]]
  ignore = false
  name = "querys"
  query = "select value as querys from sys.v$sysstat where name ='QUERY COUNT'"

```

####   [3.1.2 patrol strategy add](#312-patrol-strategy-add)  

**命令说明**  ：添加巡检策略

**参数**  ：

- **--toml，-t**  ：巡检策略配置文件，必填项


####   [3.1.3 patrol strategy apply](#313-patrol-strategy-apply)  

**命令说明**  ：应用巡检策略

**参数**  ：

- **--cluster, -c**  ：集群名称，必填项
- **--strategy-name, -s**  ：策略名称，必填项


####   [3.1.4 patrol strategy cancel](#314-patrol-strategy-cancel)  

**命令说明**  ：取消应用巡检策略

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：策略名称，必填项


####   [3.1.5 patrol strategy delete](#315-patrol-strategy-delete)  

**命令说明**  ：删除巡检策略

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：策略名称，必填项
- **--force,-f**  ：是否强制删除
    - 被应用了的巡检策略不能直接删除，可以通过    `-f`    强制删除


####   [3.1.6 patrol strategy list](#316-patrol-strategy-list)  

**命令说明**  ：分页展示巡检策略

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name, -s**  ：策略名称，选填项
- **--size**  ：一页数据量，默认值为10
- **--page，-p**  ：当前分页，默认值为1


###   [3.2 巡检报告](#32-巡检报告)  

####   [3.2.1 patrol report list](#321-patrol-report-list)  

**命令说明**  ：分页展示巡检报告记录

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：策略名称，选填项，用于展示指定策略产生的巡检记录
- **--size**  ：一页数据量，默认值为10
- **--page，-p**  ：当前分页，默认值为1


####   [3.2.2 patrol report get](#322-patrol-report-get)  

**命令说明**  ：获取巡检报告详细信息

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--uuid，-u**  ：巡检报告uuid(唯一标识)，必填项
- **--output，-o**  ：巡检报告输出路径，相对路径和绝对路径均支持


**注意**  ：

- 参数    `--output，-o`    为空的时候，直接将报告输出到当前地址，不支持将其打印到屏幕
- 巡检报告文件名称：    `patrolReport_{strategy_name}_{uuid}.json`  


####   [3.2.3 patrol report delete](#323-patrol-report-delete)  

**命令说明**  ：删除巡检报告

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--uuid，-u**  ：巡检报告uuid，支持填写多个uuid，使用逗号隔开
- **--strategy-name, -s**  ：策略名称


**注意**  ：参数    `--uuid，-u`    和    `--strategy-name, -s`    互斥，能且只能填写一个

```
# 删除指定uuid的巡检报告(单个)
$ yasboot patrol report delete -c yashan -u 46464316456

# 删除指定uuid的巡检报告(多个)
$ yasboot patrol report delete -c yashan -u 46464316456,56464316456

# 删除指定巡检策略的所有巡检报告
$ yasboot patrol report delete -c yashan -s patrol_strategy_01

```

####   [3.2.4  patrol report create](#324--patrol-report-create)  

**命令说明**  ：立即发起巡检，并生成巡检报告

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：巡检策略，选填项
- **--db-toml**  ：数据库巡检配置文件
    - 为空：采用默认数据库巡检配置
- **--output，-o**  ：巡检报告输出路径
- **--no-download,-n**  ：是否将报告从    `OM`    下载到本地，默认下载（该参数为true，    `--output`    失效）
- **--child，-d**  ：展示任务以及子任务信息
- **--disable**  ：屏蔽任务进度条展示


**注意**  ：存在以下两种方式发起巡检

```
# 基于OM中保存的策略下发巡检
$ yasboot patrol create -c yashan -s patrol_strategy_01

# 基于命令行输入的配置参数下发巡检
$ yasboot patrol create -c yashan --db-toml db_patrol.toml

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

- 巡检报告只支持保存在OM所在主机
- db巡检报告只支持    `json`    输出格式
-   `PERIOD`    类型策略下发的巡检任务的最小间隔时间为1小时
- 巡检策略下发任务时，前一次巡检任务没有完成，当前巡检任务会下发任务失败
- db巡检sql该迭代不做检查
- 巡检项之间相互独立，某个巡检项执行失败，不会导致巡检任务失败，以及影响到其它巡检项


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

略

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考 **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** ）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考 **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** ）。用于支撑测试方案的灰盒测试。**

总体流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396a3f8970c2af4f51fd4f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBd0FBQUFBZ0FBQkFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQVFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdCQUFBQUFBQUFBQ0FBQVFBQUFBQUFDQUFBQUFCQUFBQUFBQVlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNDcsImV4cCI6MTc4MjIyMjk0N30.Z9Z_ulluj6bu_ZZNHPo_czGoeS7WYCNm3V3HMMl3VY8)



####   [5.2.1 应用巡检策略](#521-应用巡检策略)  

有两种应用巡检策略的方式：

- 通过巡检策略配置文件应用
- 直接应用OM已保存的巡检策略


![](https://pingcode.yasdb.com/atlas/files/public/67396a3f8970c2af4f51fd50/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBd0FBQUFBZ0FBQkFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQVFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdCQUFBQUFBQUFBQ0FBQVFBQUFBQUFDQUFBQUFCQUFBQUFBQVlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNDcsImV4cCI6MTc4MjIyMjk0N30.Z9Z_ulluj6bu_ZZNHPo_czGoeS7WYCNm3V3HMMl3VY8)



####   [5.2.2 删除巡检策略](#522-删除巡检策略)  

- 若巡检策略被应用了，可以强制删除，或者取消应用后删除


![](https://pingcode.yasdb.com/atlas/files/public/67396a3f8970c2af4f51fd51/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBd0FBQUFBZ0FBQkFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQVFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdCQUFBQUFBQUFBQ0FBQVFBQUFBQUFDQUFBQUFCQUFBQUFBQVlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNDcsImV4cCI6MTc4MjIyMjk0N30.Z9Z_ulluj6bu_ZZNHPo_czGoeS7WYCNm3V3HMMl3VY8)



####   [5.2.3 数据库巡检流程](#523-数据库巡检流程)  

该迭代只支持db模块的巡检

**巡检项**  ：    [https://conf.yasdb.com/pages/viewpage.action?pageId=113969768](https://conf.yasdb.com/pages/viewpage.action?pageId=113969768)  

**单机**  ：连接DN主节点

**分布式**  ：连接CN节点

![](https://pingcode.yasdb.com/atlas/files/public/67396a3f8970c2af4f51fd52/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBd0FBQUFBZ0FBQkFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQVFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdCQUFBQUFBQUFBQ0FBQVFBQUFBQUFDQUFBQUFCQUFBQUFBQVlBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNDcsImV4cCI6MTc4MjIyMjk0N30.Z9Z_ulluj6bu_ZZNHPo_czGoeS7WYCNm3V3HMMl3VY8)



###   [5.3 巡检报告](#53-巡检报告)  

格式：    `json`  

存贮在OM所在主机地址：    `${YASDB_HOME}/om/${cluster_name}/data/patrol_report`  

报告名称：    `patrolReport_{strategy_name}_{uuid}.json`  

报告内容：

```


```

###   [5.4 DFX设计](#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

###   [5.6 参考资料](#56-参考资料)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[_storage_emulated_0_Download_WeiXin_ora.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2U4OTcwYzJhZjRmNTFmZDQ2IiwicmVmX2lkIjoiNjczOTZhM2U1OTNmOTljOWZmMjM1N2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTQ3LCJleHAiOjE3ODIyOTg1NDd9.OhoPKptw5k0wSpuHa3M36qAFNdvd8qdc8U3LM-DqT2s)

 (application/octet-stream)    


[patrol-应用巡检策略.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2U4OTcwYzJhZjRmNTFmZDQ3IiwicmVmX2lkIjoiNjczOTZhM2U1OTNmOTljOWZmMjM1N2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTQ3LCJleHAiOjE3ODIyOTg1NDd9.XeZr67SFeqONYTQ95bORT-BGj3iTtSmRwJIFOO2Zhcc)

 (image/svg+xml)    


[patrol-总体流程图.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2VhMWFkOWEzMzExZGM3YmJlIiwicmVmX2lkIjoiNjczOTZhM2U1OTNmOTljOWZmMjM1N2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTQ3LCJleHAiOjE3ODIyOTg1NDd9.C1teTLcMQebBkLvGpoEZrytQPU7mR6PDBzYoIPYzWng)

 (image/svg+xml)    


[patrol-删除巡检策略.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2VhMWFkOWEzMzExZGM3YmMwIiwicmVmX2lkIjoiNjczOTZhM2U1OTNmOTljOWZmMjM1N2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTQ3LCJleHAiOjE3ODIyOTg1NDd9.JMAQwxf4v1CF-Ig5X--_ylOqJhoNVkpgLRNEUO6kV_Y)

 (image/svg+xml)    


[patrol-数据库巡检流程.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2U4OTcwYzJhZjRmNTFmZDRhIiwicmVmX2lkIjoiNjczOTZhM2U1OTNmOTljOWZmMjM1N2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTQ3LCJleHAiOjE3ODIyOTg1NDd9.gHvlF8FvawKnoWO_9VZdQAZ_vDZduQ55uoykxvtisoQ)

 (image/svg+xml)    


[patrol-数据库巡检流程.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhM2U4OTcwYzJhZjRmNTFmZDRjIiwicmVmX2lkIjoiNjczOTZhM2U1OTNmOTljOWZmMjM1N2Y2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEyMTQ3LCJleHAiOjE3ODIyOTg1NDd9.Px1vbC9K-KoMwBhqzsDfcay-t9u82F8CTeQjDEJkgUo)

 (image/svg+xml)    


## Comments:

|  [](null)  ,2023/6/8 评审纪要,1、巡检策略保存后，巡检项是否支持通过配置文件修改需要和德哥确认？如果可以修改，db.toml必须在om所在主机？,2、巡检策略要支持--store-path，--store-days，--store-num 保存参数,3、命令    [ patrol strategy show](https://conf.yasdb.com/pages/viewpage.action?pageId=112729282#326-patrol-strategy-show)    有歧义，合并入    [patrol report list](https://conf.yasdb.com/pages/viewpage.action?pageId=112729282#327-patrol-report-list)    命令中，增加参数--strategy-name用于查询策略生成的报告,4、命令     [patrol report get](https://conf.yasdb.com/pages/viewpage.action?pageId=112729282#328-patrol-report-get)     不支持将巡检报告打印到屏幕，支持下载,5、连接cn节点时，需要获取正常可用的cn节点，而不是简单的第一个节点,6、从oracle脚本中整理出的巡检项存在绑定参数，需要确认是否可以使用？,Posted by zhusongping at 六月 08, 2023 14:24|
|---|
