# 1. 概述

1、需求来源：产品化需求

2、需求概述：

对于共享集群来说，如果集群节点之间发生网络断连等故障，导致集群裂变成多个集群，那么共享的存储介质就会被多个独立的集群同时进行读写，如果不做处理，将会导致数据出现损坏、不一致等致命问题。

因此引入IOfence机制，增加防护，当出现脑裂时，首先需要对要被剔除的节点进行屏蔽，屏蔽系统盘和数据盘，阻止其写入数据盘，防止在脑裂情况下出现读写盘混乱，再进行仲裁流程剔除节点。

**目前：**  通过在途IO保护实现软件iofence能力。

以kill 主ycs+yascsm为例：DBtopo更新为offline的时间为：其他3个节点完成投票仲裁驱逐节点1，同时db会感知自己被驱逐，自己主动fence，等io完自杀。时间为：仲裁投票升主时间+等在途io完的时间

**该需求：**  利用硬件设备提供的IO fence能力杜绝被驱逐节点写坏数据盘的风险。

以kill 主ycs+yascsm为例：DBtopo更新为offline的时间为：其他3个节点完成投票仲裁驱逐节点1，然后直接驱逐db1，fencedb1，db1写盘直接报错退出。时间为：投票仲裁升主时间+db1写盘直接报错退出，整个过程可能都没有超时时间长。

3、部署形态：集群

4、涉及的SR：

  [https://pingcode.yasdb.com/pjm/items/67077928e489dd0868f3c01c?](https://pingcode.yasdb.com/pjm/items/67077928e489dd0868f3c01c?)  

#YDBRD-33803 集群支持硬件方式的io保护

  [https://pingcode.yasdb.com/pjm/items/6760dd62622069d46df913df?](https://pingcode.yasdb.com/pjm/items/6760dd62622069d46df913df?)  

#YDBRD-36618 集群支持安装前检查是否支持SCSI能力

  [https://pingcode.yasdb.com/pjm/items/6760e678622069d46df91c1d?](https://pingcode.yasdb.com/pjm/items/6760e678622069d46df91c1d?)  

#YDBRD-36625 集群支持升级到支持硬件iofence的版本

  [https://pingcode.yasdb.com/pjm/items/6760e76d622069d46df91d58?](https://pingcode.yasdb.com/pjm/items/6760e76d622069d46df91d58?)  

#YDBRD-36629 ycsrootagent开机启动和监控

# 2. 需求分析

由于硬件iofence相关操作需要root权限以直接访问和修改裸设备，新增了专门执行root级别操作的ycsrootagent进程。

因此从需求整体框架分析，需求整体从底层到上层需要做到：

1)、软件新增硬件io保护机制。

2)、新增ycsrootagent进程，以便给ycs+db提供SCSI协议服务，达到可使用硬件iofence保护机制。

3)、安装部署时配置可选开机自启ycsrootagent进程，做到提供硬件fence保护。

4)、安装部署时需要检测硬件是否支持SCSI协议服务（不支持时安装部署给出风险提示交互安装），支持则该值安装部署时给检测支持的最优值。

5)、以及根据产品整体规划，需要考虑升级、扩容

## 2.1 功能点分析

针对每一步流程拆分大颗粒功能分析如下：

|场景|场景|
|---|---|
|磁阵覆盖|华为/联想，具体到型号|
|硬件fence功能|根据fence特征，在故障场景下，做到拦截io写坏磁盘；,该特性的主要场景为各种故障场景，YCS包含但不限：服务器类、存储类、操作系统资源类、集群组件类。,参考ycs故障模式库：,  [(3215) 单集群故障模式库 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YAS/pages/67484245d2baff0fd558814a)  |
|安装部署及安装部署检测硬件能力|yasboot交互式安装。,检测是否支持fence能力，支持走是否安装硬件io，不支持是/否 继续安装。,是否选择开机自启agent进程。|
|ycsrootagent|kill，sudo stop/start，普通用户stop/start报错。fence类型为硬件fence时，该进程不在，ycs节点会自杀掉线。|
|ycsctl set_ycr fencetype |设置有效值、无效值、错误值、多值、特殊符号等|
|ycsctl show config、ycsctl show fence |查看显示是否符号预期|
|根据产品整体规划|升级、扩容|


## 2.2 约束

1、硬件规格约束：

|规格/约束|类型|说明|
|---|---|---|
|磁阵必须支持SCSI3协议和SPC-3命令集|规格|不支持时抛出警告、提示风险，但不影响安装部署|
|支持两种预留类型|规格|仅注册节点可读写(Exclusive Access, registrants only)和仅注册节点可写、所有节点可读(Write Exclusive, registrants only)|
|硬件iofence白名单|约束|1. 不支持SCSI3的磁阵无法使用本需求提供的IO fence功能；  
2. 仅经过充分验证的磁阵型号会被列到用户文档的白名单；|


2、新增ycsrootagent进程约束：

1. 按一定权限策略被sudo启动，具备root权限
1. 不在ycs的启停链条里，不影响其他进程的权限


3、集群4节点。（2节点和主备集群_DFR只执行现有故障用例，不进行新增场景验证）

# 3. 详细测试设计

## 3.1 测试设计方法

采用场景法、正交组合法进行详细设计场景。

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|是|
|长稳|是，优先级低|
|一致性|否|
|三方测试工具(sqltest，sqlancer)|否|
|安全|是|
|DFR|是|
|HA|是|
|压力|否|
|性能|否|
|RTO|是|
|可维护性|是|


### 3.2.1 功能测试

根据场景该功能主要测试方向分为以下几大部分：

1、fence基本功能：硬件fence、软件fence。

2、ycsrootagent 新增进程

3、ycsctl 新增接口：ycsctl set_ycr fencetype、ycsctl show fence、ycsctl show config

4、开机自启能力

5、交互安装及安装部署时硬件检测能力

6、升级、扩容

7、RTO、长稳  
8、资料

由于fence基本功能场景主要为故障场景，可复用之前的4节点/2节点高可用用例（在硬件fence能力前提下，执行该部分用例，如无问题，只需将网络工程2，kill 19等用例调整为硬件fence能力看护，其他用例不变,默认软件fence），再针对性补充故障模式库中未覆盖的方式以及新增功能的测试，因此详细设计场景如下：

|测试项|命令接口|测试场景|详细测试|预期|是否已有用例且自动化|备注|
|---|---|---|---|---|---|---|
|fence基本功能|硬件fence,,无论是硬件还是软件，ycsrootagent进程在存在且为开机自启的前提下，进行测试。| ycs副本故障，多副本破坏，权限，删除软连接 多个ycs才会掉，才会走到fence流程。|  [https://pingcode.yasdb.com/wiki/pages/67396e71728206efb92f2818](https://pingcode.yasdb.com/wiki/pages/67396e71728206efb92f2818)  ||自动化查漏补缺，找张茜对接。|需提供接口或者工具，检测磁阵是否支持硬件fence能力，软件fence此处相同，用例公用一份即可。|
|||业务网络故障，丢包、延迟、断网卡。|后台带简单的db dml/dcl业务，故障1个节点且为主节点；故障2个节点为主备；故障2个节点为备备；故障3个节点为主备备；故障3个节点备备备.|不core，topo正常更新，fence日志正常，节点剔除成功|自动化查漏补缺，找张茜对接。||
|||存储网络故障，丢包、延迟、断网卡。||不core，topo正常更新，fence日志正常，节点剔除成功|自动化查漏补缺，找张志华对接。||
|||reboot||不core，topo正常更新，fence日志正常，节点剔除成功|手动执行||
|||kill -9/kill -15/kill -19 ycs（不包含yascsm）||不core，topo正常更新，fence日志正常，节点剔除成功，ycs会被拉起。|自动化查漏补缺，找张茜对接。||
|||kill -9/kill -15/kill -19 ycs+yascsm||不core，topo正常更新，fence日志正常，节点剔除成功|自动化查漏补缺，找张茜对接。||
|||kill -9/kill -15/kill -19 ycsrootagent/stop ycsrootagent |后台带简单的db dml/dcl业务，故障1个节点且为主节点；故障2个节点为主备；故障2个节点为备备；故障3个节点为主备备；故障3个节点备备备。|设置开机自启，故障后，ycs自杀后，fence日志正常，节点剔除成功，但自杀的ycs会被yascsm再次拉起。,kill/stop 不管主动或被动，都会被自动拉起。,|无|**ycsrootagent进程故障，只有在硬件fence的前提下，才起到故障场景，ycs自杀。**|
|||机器环境线程不足下故障|后台带简单的db dml/dcl业务,kill -9 单ycs 主，主备，主备备，备备备,kill -9 ycs_yascsm 主，主备，主备备，备备备,kill -19 单ycs 主，主备，主备备，备备备,kill -19 ycs_yascsm 主，主备，主备备，备备备|不core，topo正常更新，fence日志正常，节点剔除成功|无|软件fence此处相同，用例公用一份即可。,新增用例测试方法和自动化看护原则为：搭建硬件之后通过set_ycr改为软件fence。|
|||机器环境句柄不足下故障||不core，topo正常更新，fence日志正常，节点剔除成功|无||
|||共享磁盘io不足下故障|使用blade工具，满到95%|集群依旧正常运行，无fence|无||
||||满到95%，kill ycs，kill ycs+yascsm|不core，topo正常更新，fence日志正常|无||
||||io 100%，kill ycs，kill ycs+yascsm|不core，topo正常更新，fence日志正常|无||
||软件fence|kill ycsrootagent/stop ycsrootagent ,|进程数量根据机器。|故障该进程，对集群无任何影响。,跑几个简单的故障场景。|无||
|ycsctl  新增 接口|ycsctl set_ycr fencetype|语法测试|一、集群离线下，ycsctl set_ycr fencetype values ,values取值,1、有效值：,1）、硬件fence改为软件fence，提示风险。,2）、硬件fence改为另一种硬件fence能力。,3）、硬件fence改为软件fence再改为硬件fence能力。,2、无效值：特殊符号、null、空、整型、超长字符、多值。,二、集群在线下，ycsctl set_ycr fencetype values |语法错误，报错明确。|无||
|||功能场景测试，不设置开机自启|硬件fence改为软件fence，kill ycsrootagent进程|ycs不自杀，集群正常，无fence等异常日志|||
||||硬件fence改为另一种硬件fence能力，stop ycsrootagent进程|1、不core，topo正常更新，fence日志正常，节点剔除成功。,2、ycs自杀，ycs+db拉起失败，查看ycs日志，连接agent超时。,3、start进程后，ycs+db被成功拉起，集群正常，自动拉起。|||
||||硬件fence改为软件fence再改为硬件fence能力，kill ycsrootagent进程||||
||||磁阵无硬件fence能力，但是set_ycr设置硬件fence能力|需要报错无此能力，无法设置大概明确的报错。||setycr不提示的话，资料需给出风险提示|
||ycsctl show fence|ycsctl show fence|新增命令展示集群fence状态|1、ycsrootagent进程在线显示正常,2、ycsrootagent进程不在线需要报错。|||
||ycsctl show config|ycsctl show config|新增展示硬件iofence配置信息||||
|ycsrootagent进程,||集群未启动的前提下，启停进程|ycsrootagent start/stop -H $homePath ,1、普通用户不加sudo启停,2、普通用户加sudo启停,3、root启停|除普通用户不加sudo启停报错权限问题，其他均成功。,启动进程，不会启动集群。||不参与集群的启停流程|
|||进程离线时，启动ycs+db，|ycsrootagent 进程不存在，ycsctl start ycs/yasboot cluster start -c  test|该进程不启动|||
|||进程在线时，停止ycs|ycsrootagent 进程存在，ycsctl stop ycs/yasboot cluster stop -c   test|该进程不停止|||
|开机自启能力||部署时选择开启开机自启|reboot机器,|观察是否被拉起||硬件fence的前提下，ycs会自杀，进程不启动，ycs不能被拉起|
|||自启后，kill/stop/start 进程|进程可正常stop/start|start会报错已存在。|||
|安装部署时硬件检测能力||交互安装||||待开发详细设计后再补充,  [(3774) 【YDBRD-36618】硬件iofence--集群安装前检查是否支持SCSI能力--测试设计 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67c5746f529b5c0231cc215f)  |
|升级、扩容||无硬件fence到该特性的升级|不支持硬件fence能力到支持硬件fence的升级||||
||||不支持硬件fence能力到不支持硬件fence的升级||||
||||无该特性到支持硬件fence的升级||||
||||无该特性到不支持硬件fence的升级||||
|||有硬件fence到该特性的升级|支持硬件fence能力到支持的升级||||
||||支持硬件fence能力到不支持的升级||||
|启停||硬件iofence|配置该参数的前提下启停集群，执行现有2/4并发启停用例,|启停流程不变，工程执行正常|  [master_L3_cluster_para_startstop_arm_1 [Jenkins] (yasdb.com)               --2节点](https://jenkins.yasdb.com/user/zhangqian/my-views/view/%E6%88%91%E7%9A%84%E8%A7%86%E5%9B%BE--3%E5%B1%82/job/master_L3_cluster_para_startstop_arm_1/)  并发启停,  [master_L3_cluster_ycs_4nodes_fault_1 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/user/zhangqian/my-views/view/%E6%88%91%E7%9A%84%E8%A7%86%E5%9B%BE--3%E5%B1%82/job/master_L3_cluster_ycs_4nodes_fault_1/)  ,--4节点并发启停，及启停中加kill -9/19故障,  [Agile_L2_cluster_yasft_ycs_arm_copy_xfb [Jenkins] (yasdb.com) ](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L2_cluster_yasft_ycs_arm_copy_xfb/)  ,--串行启停||
|||软件iofence|||||
|RTO|||||||
|硬件iofence下的长稳执行||配置硬件fence下，执行长稳||||看环境情况，有则执行，优先级低|
|安装部署后，yfs alter add新增盘|||||||
|盘无硬件fence能力，就设置硬件能力，观察现象||集群部署的时候已经检测到了不支持，但是设置了不支持，,但是你设置了硬件，直接告警起不来ycs。,|修改部分已有功能，不检测，直接设置硬件能力，fence时|||只有存在硬件不支持fence的能力的情况非得修改set fencetype为硬件能力，才会出现告警起不来ycs集群的情况。（可考虑正常运行的集群，是否会存在ycs自杀等现象）,其他场景下set fencetype均能设置成功且集群正常使用。,,目前集群配置硬件能力，新增的盘必须也得有硬件能力。（否则 yfs 执行检测预留会直接报错）,|
|资料|||||||


# 4. 冒烟用例

|测试场景|预期|
|---|---|
|kill -9 ycs+yascsm，同时故障2节点（主+备）|不core，topo正常更新，fence日志正常，节点剔除成功|
|kill -19 ycs（不包含yascsm），同时故障3节点（主+备+备）|不core，topo正常更新，fence日志正常，节点剔除成功|
|set fencetype为软件fence时，kill ycsrootagent/stop ycsrootagent |故障该进程，对集群无任何影响。|
|硬件fence时，kill ycsrootagent/stop ycsrootagent |未设置自启，kill之后，ycs+db拉起失败，查看ycs日志，需有agent未启动的明确报错。|
||设置自启，kill之后，ycs自杀，db掉线；ycsrootagent被自启后，ycs被yascsm拉起，db被ycs拉起|


# 5. 测试框架设计

使用ha_regress框架自动化

长稳使用长稳框架

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|部署|  
|
|操作系统|Linux|


# **7、工作量评估**

1、原有用例适配——1.5人周  
2、新增场景测试&自动化——2.5人周

总计：4人周

检测方法：

上车方案，根据磁阵情况：

   1)、yasboot 

       1、磁阵支持硬件fence，yasboot安装后，执行用例前；修改部分工程fence类型为支持硬件fence；

       2、磁阵不支持硬件fence，yasboot默认安装，不修改用例。

   2)、HA框架，只需要在部分工程安装后执行用例前增加检测传值，修改配置命令看护硬件fence能力，其他ha框架默认。

主测华为磁阵。搭建数据盘多副本和ycs3副本即可。

  [Agile_master_L2_Build #6327 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/6327/)     --上车，feat33803 zhangqian zq_ha_master

||失败原因|重跑结果|
|---|---|---|
|  [Agile_L2_sa_tac_HA_4_docker #6216 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_4_docker/6216/)  |主干问题，和特性无关|  [Agile_L2_sa_tac_HA_4_docker #6229 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_4_docker/6229/)  ,,和特性无关。主干问题 YDBRD-38755 |
|  [Agile_L2_sa_lsc_HA_1_docker #6181 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/6181/)  |不稳定|  [Agile_L2_sa_lsc_HA_1_docker #6192 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/6192/)  ,已绿|
|  [Agile_L2_sa_heap_HA_2_docker #6361 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/6361/)  |主干问题，和特性无关  [https://pingcode.yasdb.com/pjm/items/67c90ba76dccc3daa314c2c3?](https://pingcode.yasdb.com/pjm/items/67c90ba76dccc3daa314c2c3?)  ,#YDBRD-38755 【CI】【共享集群】master_L2_cluster_backup_arm_3工程backup database卡住||
|  [Agile_L2_sa_heap_HA_5_docker #5905 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/5905/)  |||
|  [Agile_L2_sa_heap_HA_6_docker #5854 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/5854/)  |||
|  [Agile_L2_sa_lsc_yasft_arm #5047 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/5047/)  |超时重跑|  [Agile_L2_sa_lsc_yasft_arm #5058 [Jenkins] (yasdb.com)   lastfail 已绿](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/5058/)  |
|  [Agile_L2_sa_heap_yasft_arm #5743 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5743/)  |||
|  [Agile_L2_sa_tac_yasft_arm #4750 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4750/)  |||
|  [Agile_L2_sa_heap_HA_10_arm #1176 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/1176/)  |时间过长，退出，和特性无关||
|  [Agile_L2_sa_heap_HA_8_docker #1282 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_8_docker/1282/)  |||
|  [Agile_L2_sa_heap_HA_9_docker #1305 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/1305/)  |和特性无关|  [Agile_L2_sa_heap_HA_9_docker #1318 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/1318/console)  ,lastfail 已绿|
|  [Agile_L2_sa_heap_ha_profile #1003 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_ha_profile/1003/)  ||  [Agile_L2_sa_heap_ha_profile #1014 [Jenkins] (yasdb.com)     ](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_ha_profile/1014/)  ,已绿|
|  [Agile_L2_sa_yasft_code_sensitive_arm #868 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/868/)  |||
|  [Agile_sa_L2_empty_string_yasft_arm #618 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_sa_L2_empty_string_yasft_arm/618/)  |资源不足|  [Agile_sa_L2_empty_string_yasft_arm #630 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_sa_L2_empty_string_yasft_arm/630/)  ,lastfail 已绿|
|  [Agile_L2_dst_lsc_yasft_arm #4366 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/4366/)  |和特性无关，其他构建也有类似问题||
|  [Agile_L2_dst_tac_yasft_arm #3994 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3994/)  ||  [Agile_L2_dst_tac_yasft_arm #4011 [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/4011/)  |
|  [Agile_L2_dst_HA_Switch_docker #5088 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/5088/)  |||
|  [Agile_L2_dst_HA_yasft_arm #3324 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/3324/)  |被abort了|  [Agile_L2_dst_HA_yasft_arm #3340 [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/3340/)  |
|  [Agile_L2_dst_pn_yasft_arm #757 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/757/)  |被abort了||
|  [Agile_L2_dst_yasft_code_sensitive_arm #850 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/850/)  |和特性无关||
|  [Agile_L2_dst_heap_yasft_arm #497 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_heap_yasft_arm/497/)  |和特性无关||
|  [Agile_L2_cluster_heap_yasft_sa_case_arm #4589 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/4589/)  |和特性无关||
|  [Agile_L2_cluster_yasft_cluster_case_arm #4991 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4991/)  |和特性无关||
|  [Agile_L2_cluster_yasft_ycs_arm #4241 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/4241/)  |磁阵慢导致db open慢。|  [Agile_L2_cluster_yasft_ycs_arm #4248 [Jenkins] (yasdb.com)    lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/4248/)  |
|  [Agile_L2_cluster_yasft_yfs_arm #4130 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/4130/)  |磁阵慢|  [Agile_L2_cluster_yasft_yfs_arm #4136 [Jenkins] (yasdb.com)   ](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/4136/)      [ lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/4248/)  |
|  [Agile_L2_cluster_backup_arm_1 #3857 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/3857/)  |和特性无关，未rebase主线代码||
|  [Agile_L2_cluster_backup_arm_3 #2626 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/2626/)  |主线问题：  [https://pingcode.yasdb.com/pjm/items/67c90ba76dccc3daa314c2c3?](https://pingcode.yasdb.com/pjm/items/67c90ba76dccc3daa314c2c3?)  ,#YDBRD-38755 【CI】【共享集群】master_L2_cluster_backup_arm_3工程backup database卡住||
|  [Agile_L2_cluster_yasft_faultpoint_arm #1742 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_faultpoint_arm/1742/)  |框架需求修改为ps ux格式||
|  [Agile_L2_cluster_FT_ha_arm #1858 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1858/)  |test_sdv_YASHAN_2817_para_insert_select_ha_01.py,![image.png](https://pingcode.yasdb.com/atlas/files/public/67cbec4b6a1ae92ae3736be4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUlBQUFBQUFBQUVBQUNBQUFBQUFBQ0FBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFRQUFnQUFnQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzOTMsImV4cCI6MTc4MjQ2OTE5M30.5oj0bDmI5b9pWwocKg9sbI1ULna6kCZSzwdE5sBXZYQ),test_sdv_YASHAN_2817_para_insert_select_ha_03.py,![image.png](https://pingcode.yasdb.com/atlas/files/public/67cbec9b6a1ae92ae3736be5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUlBQUFBQUFBQUVBQUNBQUFBQUFBQ0FBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFRQUFnQUFnQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzOTMsImV4cCI6MTc4MjQ2OTE5M30.5oj0bDmI5b9pWwocKg9sbI1ULna6kCZSzwdE5sBXZYQ),test_sdv_cluster_haReplication_04.py,![image.png](https://pingcode.yasdb.com/atlas/files/public/67cbecc26a1ae92ae3736be6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUlBQUFBQUFBQUVBQUNBQUFBQUFBQ0FBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFRQUFnQUFnQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzOTMsImV4cCI6MTc4MjQ2OTE5M30.5oj0bDmI5b9pWwocKg9sbI1ULna6kCZSzwdE5sBXZYQ),test_sdv_cluster_haReplication_idx5_12.py,![image.png](https://pingcode.yasdb.com/atlas/files/public/67cbecef6a1ae92ae3736be7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUlBQUFBQUFBQUVBQUNBQUFBQUFBQ0FBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQWdBQUFRQUFnQUFnQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBSUFCQUFBQUFBQUFBQUFBQUFBQUFBQUJBUUFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzOTMsImV4cCI6MTc4MjQ2OTE5M30.5oj0bDmI5b9pWwocKg9sbI1ULna6kCZSzwdE5sBXZYQ)||
|  [Agile_L2_cluster_yasft_code_sensitive_arm #862 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/862/)  |和特性无关||
||||
||||
||||


