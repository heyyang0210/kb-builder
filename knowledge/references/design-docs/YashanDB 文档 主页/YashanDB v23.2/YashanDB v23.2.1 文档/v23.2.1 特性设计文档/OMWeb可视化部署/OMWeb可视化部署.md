Created by 周宇昕, last modified on 九月 14, 2023

#   [YDBRD-XXXX : OMWeb部署YashanDB](#ydbrd-xxxx--omweb部署yashandb)  

IR链接：YDBRD-XXXX / SR链接：YDBRD-XXXX

##   [1. Overview（概述）](#1-overview概述)  

目前    `OM`    部署    `YashanDB`    是通过    `yasboot`    在终端自定义配置文件后，通过    `package install`    命令安装    `yasom`    以及    `yasagent`    ，再使用    `cluster deploy`    命令部署数据库。

本方案实现部署    `YashanDB`    的第二种方式：可视化页面部署。可视化部署本质上也是调用    `yasboot`    的命令，在外层支持通过api接口实现参数与数据库配置的可视化交互。

主机与数据库信息配置完成后即可一键部署，部署失败支持清理。

##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|检查主机|点击检查单个主机|检查单个主机的连通性，路径权限和配置要求|
|生成推荐配置|根据主机和数据库规模自动生成配置信息|生成推荐信息后可供修改|
|部署数据库|所有配置完成后点击部署|一键部署|


##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 总览](#31-总览)  

|接口|Method|URL|
|---|---|---|
|获取初始信息|GET|/api/initial/info|
|检查主机连通性|POST|/api/host/check|
|检查主机总内存|POST|/api/host/add/check|
|生成主机hostid|POST|/api/host/hostid|
|获取当前数据库已生成配置|GET|/api/cluster/config|
|生成并获取推荐配置|POST|/api/cluster/config|
|更新数据库配置|PUT|/api/cluster/config|
|清理数据库配置|DELETE|/api/cluster/config|
|获取建库语句|POST|/api/cluster/sql/database|
|部署数据库|POST|/api/cluster/deploy|
|卸载清理|POST|/api/cluster/clean|
|获取当前部署任务状态|GET|/api/task/deploy|
|退出服务端|POST|/api/exit|


###   [3.2 详细接口](#32-详细接口)  

####   [3.2.1 获取初始信息 (GET | /api/initial/info)](#321-获取初始信息-get--apiinitialinfo)  

**Response**

|字段名|类型|说明|展示|
|---|---|---|---|
|packages|[]string|默认目录下已存在的包|可选择|
|configs|[]Config|已存在的配置文件|可选择|


- Config


|字段名|类型|说明|展示|
|---|---|---|---|
|hosts|Hosts|主机信息|初始页面|
|yashandb|YashanDB|数据库配置信息|前三页面均涉及|
|error|string|配置错误信息|初始页面|
|parameters|Parameters|默认配置列表|参数页面|


- Hosts


|字段名|类型|说明|展示|
|---|---|---|---|
|cluster|string|数据库名称|忽略|
|secret_key|string|rpc密钥|忽略|
|create_cgroup|bool|是否创建cgroup，需要sudo权限|节点配置页面|
|boot_start_monit|bool|是否把monit添加到开机自启，需要sudo权限|节点配置页面|
|add_yasdba|bool|把用户添加到YASDBA用户组,需要sudo权限,默认开启|节点配置页面|
|recommend_param|bool|开启推荐参数|推荐参数模块|
|om|Yasom|om所在机器信息|节点配置页面|
|host|[]Host|各主机信息|初始页面|


- Yasom


|字段名|类型|说明|展示|
|---|---|---|---|
|hostid|string|host id|节点配置页面|
|config|map[string]string|om配置，监听地址:LISTEN_ADDR|节点配置页面|


- Host


|字段名|类型|说明|展示|
|---|---|---|---|
|hostid|string|host id|初始页面|
|group|string|用户组名称|初始页面|
|user|string|用户名称|初始页面|
|password|string|用户密码|初始页面|
|ip|string|IP地址|初始页面|
|port|int|ssh端口|初始页面|
|path|string|安装路径|初始化页面|
|cgroup_path|string|cgroup路径，可不传|主机信息页面|
|no_password|bool|是否免密|忽略|
|yasagent|YasAgent|agent信息|节点配置页面|
|permission|Permission|权限信息，可不传|节点配置页面|
|memory_limit|string|必传，主机内存限制|推荐参数模块|
|total_memory|int|主机总内存，byte|前端内存校验|


- Permission


|字段名|类型|说明|展示|
|---|---|---|---|
|user|string|sudo权限用户|主机配置页面|
|password|string|sudo权限密码|主机配置页面|
|sudo_path|string|sudo路径，可不传|主机配置页面|


- YasAgent


|字段名|类型|说明|展示|
|---|---|---|---|
|config|map[string]string|agent配置，监听地址:LISTEN_ADDR|节点配置页面|


- YashanDB


|字段名|类型|说明|展示|
|---|---|---|---|
|uuid|string|uuid标识|忽略|
|cluster|string|数据库名称|初始页面|
|yas_type|string|数据库类型，SE, DE, CE|初始页面|
|install_path|string|安装路径|忽略|
|sys_password|string|数据库初始密码|忽略|
|deploy_mode|string|部署模式，MINI, NORMAL|忽略|
|host|[]YasdbHost|主机IP信息|和host一同修改，页面不展示|
|group|[]YasdbGroup|节点组信息|节点配置页面 && 参数页面|
|ce_disk|CEDisk|集群配置（集群特有）|节点配置页面|
|yfs_config|YFSConfig|yfs配置（集群特有）|参数页面|
|recommend_param|bool|开启推荐参数|推荐参数模块|
|table_type|string|可不传，默认为HEAP，可选值[HEAP,TAC,LSC]|推荐参数模块|


- YasdbHost


|字段名|类型|说明|展示|
|---|---|---|---|
|hostid|string|host id|和host一同修改，页面不展示|
|yasdb_ip|YasdbIP|数据库IP信息|和host一同修改，页面不展示|


- YasdbIP


|字段名|类型|说明|展示|
|---|---|---|---|
|listen_ip|string|节点参数的IP地址，以下均设置相同|和host一同修改，页面不展示|
|din_ip|string|同上|和host一同修改，页面不展示|
|replica_ip|string|同上|和host一同修改，页面不展示|
|inter_ip|string|同上|和host一同修改，页面不展示|
|inter_url|string|同上|和host一同修改，页面不展示|


- YasdbGroup


|字段名|类型|说明|展示|
|---|---|---|---|
|name|string|组名称|节点配置页面|
|group_type|string|组类型， mn, cn, dn, db, ce|节点配置页面|
|create_sql|CreateSQL|初始化数据库SQL语句|生成建库语句窗口 && 组参数页面|
|config|map[string]string|组配置|组配置页面|
|node|[]YasdbNode|节点信息|节点配置页面|


- CreateSQL


|字段名|类型|说明|展示|
|---|---|---|---|
|create_database|string|建库SQL语句|生成建库语句窗口 && 组参数页面|
|create_diskgroup|string|创建diskgroup语句|生成建库语句窗口 && 组参数页面|


- YasdbNode


|字段名|类型|说明|展示|
|---|---|---|---|
|hostid|string|host id|节点配置页面|
|data_path|string|节点路径|节点配置页面|
|role|int|1: primary, 2: standby|节点配置页面|
|config|map[string]string|节点配置|参数页面|
|memory_limit|string|必传，节点内存限制|推荐参数模块|


- CEDisk


|字段名|类型|说明|展示|
|---|---|---|---|
|data|string|disk data path|节点配置页面|
|vote|string|disk vote path|节点配置页面|
|ycr|string|disk ycr path|节点配置页面|


- YFSConfig


|字段名|类型|说明|展示|
|---|---|---|---|
|LOG_LEVEL|string|yfs日志级别: OFF, FATAL, ERROR, WARN, INFO, DEBUG, TRACE, ALL|参数页面|
|SHM_POOL_SIZE|string|共享内存空间大小，与支持的 DG 数量、磁盘数量有关。启动时检测，不足则抛出异常,32M ~ 无穷大|参数页面|
|SYS_AREA_SIZE|string|YFS目录内存大小, 32M ~ 无穷大|参数页面|
|RECY_INTERVAL|string|回收已删除文件空间的时间间隔，单位为s, 0 ~ 无穷大|参数页面|
|YFS_PACKET_SIZE|string|客服端和服务端通信包大小， 6K ~ 无穷大|参数页面|


- Parameters


|字段名|类型|说明|展示|
|---|---|---|---|
|create_params|[]param|建库参数(节点组)|组参数页面|
|node_params|[]param|节点参数|参数页面|
|yfs_params|[]param|yfs参数（集群）|参数页面|


- param


|字段名|类型|说明|
|---|---|---|
|key|string|参数名称|
|type|string|参数类型，enum, number, bytes|
|default|string|默认值|
|immediately|string|是否立即生效|
|Area|string|参数范围|
|max|int|最大值|
|min|int|最小值|
|options|[]string|可选项|
|readonly|string|是否只读|
|scope|string|范围：both, spfile|
|session|string|是否会话级参数|
|tip|string|参数说明|
|complete_parse|bool|是否完成解析|


####   [3.2.2 检查主机连通性(POST | /api/host/check)](#322-检查主机连通性post--apihostcheck)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|hosts|[]HostInfo|是|主机信息|


**Response**

|字段名|类型|说明|
|---|---|---|
|hosts|[]HostCheckRes|主机连通结果|


- HostInfo


|字段名|类型|是否必传|说明|
|---|---|---|---|
|ip|string|是|IP地址|
|user|string|是|用户名|
|port|int|否|ssh端口号，默认22|
|password|string|否|用户密码，不传默认免密|


- HostCheckRes


|字段名|类型|说明|
|---|---|---|
|ip|string|IP地址|
|success|bool|是否连通|
|error|string|连通失败信息|


####   [3.2.3 检查主机总内存(POST | /api/host/add/check)](#323-检查主机总内存post--apihostaddcheck)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|cluster|string|是|数据库名称|
|hosts|[]HostInfoV2|是|主机信息|


- HostInfoV2


|字段名|类型|是否必传|说明|
|---|---|---|---|
|ip|string|是|IP地址|
|user|string|是|用户名|
|port|int|否|ssh端口号，默认22|
|password|string|否|用户密码，不传默认免密|
|path|string|是|安装路径|


**Response**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|hosts|[]HostResV2|是|主机信息|


- HostResV2


|字段名|类型|说明|
|---|---|---|
|ip|string|IP地址|
|success|bool|是否成功|
|error|string|失败信息|
|total_memory|int|总内存|


####   [3.2.4 生成主机hostid (POST | /api/host/hostid)](#324-生成主机hostid-post--apihosthostid)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
||[]HostIDInfo|是|IP以及对应的hostid|


**Response**

|字段名|类型|说明|
|---|---|---|
||[]HostIDInfo|IP以及对应的hostid|


- HostIDInfo


|字段名|类型|是否必传|说明|
|---|---|---|---|
|hostid|string|否|host id，为空则会生成并返回|
|ip|string|是|主机IP地址|


####   [3.2.5 获取当前数据库已生成配置(GET | /api/cluster/config)](#325-获取当前数据库已生成配置get--apiclusterconfig)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|cluster|string|是|数据库名称|
|yas_type|string|是|数据库类型，可选SE, DE, CE|


**Response**

|字段名|类型|说明|
|---|---|---|
|found|bool|是否已存在配置|
|yashandb_conf|string|数据库配置信息|


####   [3.2.6 生成并获取推荐配置 (POST | /api/cluster/config)](#326-生成并获取推荐配置-post--apiclusterconfig)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|cluster|string|是|数据库名称|
|yas_type|string|是|数据库类型，可选SE, DE, CE|
|hosts|[]Host|是|主机信息|
|mn|int|否|mn节点数量（分布式）|
|cn|int|否|cn节点数量（分布式）|
|dn|int|否|dn节点数量（分布式）|
|dn_group|int|否|dn节点组数量（分布式）|
|db|int|否|单机节点数量（单机）|
|ce|int|否|集群节点数量（集群）|
|begin_port|int|否|节点起始端口，默认1688|
|data_path|string|否|节点默认路径，不传则为主机安装路径下data目录|
|ce_data|string|否|磁阵数据存储盘路径（集群）|
|ce_vote|string|否|磁阵投票盘路径（集群）|
|ce_ycr|string|否|磁阵YCR盘路径（集群）|
|recommend_param|bool|否|是否开启推荐参数|
|memory_limit|int|否|主机内存占用百分比 1~100|
|table_type|string|否|默认为HEAP，可选值[HEAP,TAC,LSC]|


**Response**

|字段名|类型|说明|
|---|---|---|
|hosts|Hosts|主机配置信息|
|yashandb|YashanDB|数据库配置信息|
|parameters|Parameters|默认配置列表|


- Host


|字段名|类型|是否必传|说明|
|---|---|---|---|
|ip|string|是|IP地址|
|user|string|是|用户名|
|password|string|否|用户密码，不传默认免密|
|port|int|否|ssh端口号，默认22|
|path|string|是|安装路径|


####   [3.2.7 更新数据库配置 (PUT | /api/cluster/config)](#327-更新数据库配置-put--apiclusterconfig)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|hosts|Hosts|是|主机配置信息|
|yashandb|YashanDB|是|数据库配置信息|


**Response**

|字段名|类型|说明|
|---|---|---|
|code|int|错误码（不是状态码）|
|content|string|状态信息|
|msg|string|通用信息|


####   [3.2.8 清理数据库配置 (DELETE | /api/cluster/config)](#328-清理数据库配置-delete--apiclusterconfig)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|cluster|string|是|数据库名称|
|yas_type|string|是|数据库类型，可选SE, DE, CE|


**Response**

|字段名|类型|说明|
|---|---|---|
|code|int|错误码（不是状态码）|
|content|string|错误信息|
|msg|string|通用信息|


####   [3.2.9 获取建库语句 (POST | /api/cluster/sql/database)](#329-获取建库语句-post--apiclustersqldatabase)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|cluster|string|是|数据库名称|
|yas_type|string|是|数据库类型，可选SE, DE, CE|
|node_num|int|否|节点数量（集群必传）|
|ce_data|string|否|磁盘data路径（集群必传）|
|group_config|map[string]string|是|组配置信息|


**Response**

|字段名|类型|说明|
|---|---|---|
|create_database|string|建库语句|
|create_diskgroup|string|创建diskgroup语句(集群特有)|


####   [3.2.10 部署数据库 (POST | /api/cluster/deploy)](#3210-部署数据库-post--apiclusterdeploy)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|install_pkg|string|是|安装包路径|
|hosts|Hosts|是|主机配置信息|
|yashandb|YashanDB|是|数据库配置信息|


**Response**

|字段名|类型|说明|
|---|---|---|
|code|int|错误码（不是状态码）|
|content|string|状态信息|
|msg|string|通用信息|


####   [3.2.11 卸载清理 (POST | /api/cluster/clean)](#3211-卸载清理-post--apiclusterclean)  

**Request**

|字段名|类型|是否必传|说明|
|---|---|---|---|
|cluster|string|是|数据库名称|
|yas_type|string|是|数据库类型，可选SE, DE, CE|


**Response**

|字段名|类型|说明|
|---|---|---|
|code|int|错误码（不是状态码）|
|content|string|错误信息|
|msg|string|通用信息|


####   [3.2.12 获取当前部署任务状态 (GET | /api/task/deploy)](#3212-获取当前部署任务状态-get--apitaskdeploy)  

**注：失败的状态(3)需要调用Clean接口，把状态置为初始状态才能下一次部署 **

**Response**

|字段名|类型|说明|
|---|---|---|
|cluster|string|数据库名称|
|yas_type|string|数据库类型，SE, DE, CE|
|status|int|任务状态|
|progress|int|进度，0 ~ 100|
|msg|string|状态信息|


**task status**

```
OriginalState = 0 // 初始状态(未开始)
RunningState = 1  // 运行中
SuccessState = 2  // 成功
FailedState = 3   // 失败

```

####   [3.2.13 退出服务端 (POST | /api/exit)](#3213-退出服务端-post--apiexit)  

** 后端校验确实部署已完成则返回成功, 5秒后服务端自动关闭 **

**Response**

|字段名|类型|说明|
|---|---|---|
|code|int|错误码（不是状态码）|
|content|string|错误信息|
|msg|string|通用信息|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

###   [4.1 规格](#41-规格)  

1. 支持单机，分布，集群三种形态数据库部署
1. 前端参考YCM现有页面
1. GET接口请求为    `query`    ，其他接口请求为    `json`  


####   [4.1.1 节点规格](#411-节点规格)  

- 最大配置


|节点(组)类型|最大数量|
|---|---|
|MN组|1|
|MN节点|3|
|CN组|1|
|CN节点|3|
|DN组|32|
|DN节点|3|
|DB(单机)节点|33|
|CE(集群)节点|4|


- 默认配置


|节点(组)类型|默认数量|
|---|---|
|MN组|1|
|MN节点|1|
|CN组|1|
|CN节点|1|
|DN组|3|
|DN节点|1|
|DB(单机)节点|1|
|CE(集群)节点|3|


####   [4.1.2 节点展示地址](#412-节点展示地址)  

1. 单机


- LISTEN_ADDR
- REPLICATION_ADDR


1. 分布式


- LISTEN_ADDR
- REPLICATION_ADDR
- DIN_ADDR


1. 集群


- LISTEN_ADDR
- CLUSTER_INTERCONNECT
- INTER_URL


###   [4.2 约束](#42-约束)  

1. 不支持local部署
1. 数据库名称应由大小写字母，数字和特殊字符组成(不支持中文)，以字母开头，长度限制为1~63，不能出现特殊字符'\0'     ','     ' '     '+'      '-'     '*'     '/'    '|'      '('   ')'  '[' ']' '{'  '}'  '~' '`'   '%'    ':'       '?'    '.'    '\t'       '\r'      '\n'     '='      '\'        '!'      '>'        '<'     ';'      '&'   '@'   '^'  '''   '"'
1. 集群数据库部署的前置步骤参考：    [共享集群部署](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E8%BF%90%E7%BB%B4%E6%89%8B%E5%86%8C/%E5%AE%89%E8%A3%85%E9%83%A8%E7%BD%B2/YashanDB%E4%BA%A7%E5%93%81%E5%AE%89%E8%A3%85/om%E5%AE%89%E8%A3%85.html#%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E9%83%A8%E7%BD%B2)  
1. 可视化集群数据库部署不支持debug模式(模拟盘)
1. 任务失败的状态(3)需要调用Clean接口，把状态置为初始状态才能下一次部署
1. 返回已有主机信息接口不带密码，需要重新输入
1. 推荐参数只支持单机和分布式


###   [4.3 其他](#43-其他)  

1. 前端需要npm install编译吗？需要的话CI的所有编译环境和开发编译环境是不是都需要安装node 和npm。
1. 前端第三方
1. 是否需要websocket?(部署进度展示)  ycm使用    `gorilla/websocket`    第三方，官方的有    `golang.org/x/net/websocket`  


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c1f8970c2af4f520964/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQVFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBQUFBSUFBQUVBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkxNDYsImV4cCI6MTc4MjMwOTk0Nn0.s-jIi2NGtG5J4sF2LlfC8CVmPWnaojrTzCcWSH_aBfY)

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

整体流程

![](https://pingcode.yasdb.com/atlas/files/public/67396c1f8970c2af4f520965/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQVFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUVBQUFBQUFBQUFBQUFBQUFBSUFBQUVBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkxNDYsImV4cCI6MTc4MjMwOTk0Nn0.s-jIi2NGtG5J4sF2LlfC8CVmPWnaojrTzCcWSH_aBfY)

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

CREATE DATABASE minidb CHARACTER SET utf8 LOGFILE('?/dbfiles/redo1' SIZE 128M BLOCKSIZE 4K,'?/dbfiles/redo2' SIZE 128M BLOCKSIZE 4K,'?/dbfiles/redo3' SIZE 128M BLOCKSIZE 4K,'?/dbfiles/redo4' SIZE 128M BLOCKSIZE 4K)            ARCHIVELOG

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

## Comments:

|  [](null)  ,1. 到100%后超时退出（失败不退出），增加主动退出接口
1. 包路径必填项，先默认在前一级目录找,增加接口：返回包，env, toml(host), 
1. 推荐配置直接返回信息
1. 根据建库参数生成SQL, 改SQL后可以返回给后端
,Posted by zhouyuxin at 七月 26, 2023 10:52|
|---|
