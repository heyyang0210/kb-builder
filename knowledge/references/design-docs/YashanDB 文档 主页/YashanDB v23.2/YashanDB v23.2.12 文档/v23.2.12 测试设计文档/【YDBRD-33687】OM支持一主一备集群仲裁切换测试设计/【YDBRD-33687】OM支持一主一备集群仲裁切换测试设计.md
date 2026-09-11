Created by 张彩虹, last modified on 十一月 07, 2024

SR链接：

  [https://pingcode.yasdb.com/pjm/items/67d7934e7ce85d5a0759eaae?](https://pingcode.yasdb.com/pjm/items/67d7934e7ce85d5a0759eaae?)  

#YDBRD-39077 主备集群支持自动failover（主集群实例全部宕机一主一备）



开发设计文档：  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67d786972d2effe8fb230270](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67d786972d2effe8fb230270)  

# **1. 概述**

本文描述OM一主一备集群仲裁切换测试设计

# **2. 需求分析**

一主一备集群，支持主集群实例全部故障后，备集群自动failover升主。

## **2.1 功能点分析**

|场景名称|场景描述|
|:---|:---|
|零丢失模式|1. 主备正常时，开启最大保护模式，备库宕机时，降为最大可用模式
1. 主库所有实例宕机后，在满足最大保护模式的情况下，自动进行failover
1. 否则不进行failover
,|
|非零丢失模式|1. 主备使用最大可用或者最大性能模式
1. 主库所有实例宕机后，进行failover
|


## 2.2 参数

yasboot election命令参考：  [https://cod-doc.yasdb.com/yashandb/23.4/zh/Tools-Guide/yasboot/Introduction-to-yasboot-Command/yasboot-election.html](https://cod-doc.yasdb.com/yashandb/23.4/zh/Tools-Guide/yasboot/Introduction-to-yasboot-Command/yasboot-election.html)  

1、election enable on/off  --force：本命令用于启用/关闭 基于yasom的仲裁选主，  --force：在数据库状态异常的情况下，强制关闭自选举（可能会导致数据库主机无法启动）

- yasboot election enable on -c yashandb
- yasboot election enable off -c yashandb
- yasboot election enable off --force -c yashandb


2、election status：本命令用于展示仲裁选主的运行状态（如：yasboot election status -c yashandb）  
3、election config show：本命令用于展示仲裁选主的参数设置，条件切换配置和运行状态（如：yasboot election config show -c yashandb）

4、election event show:本命令用于查看仲裁选主相关的事件，包括事件名、发生时间、处理时间以及处理是否成功等（如：yasboot election event show -c yashandb）

5、election config set：本命令用于设置仲裁选主相关的参数，仅允许在仲裁选主未启用的情况下设置选举参数

- yasboot election config set -k FailoverThreshold -v 5 -c yashandb   --设置心跳
- yasboot election config set -k FailoverAutoReinstate -v true -c yashandb  --脑裂修复，不支持
- yasboot election config set -k ZeroDataLossMode -v false -c yashandb   --设置为非零丢失模式


  
参数如下：

FailoverThreshold：默认值为9，取值范围[2,1000]，备节点心跳超时时间，到达该时间后，yasom将执行failover切换流程

FailoverAutoReinstate：是否启用自动脑裂修复。默认值为false，集群不支持脑裂自动修复，此参数不可修改

ZeroDataLossMode：是否启用零丢失模式。默认值为true，启用后，将设置主备为最大保护模式，当主集群宕机时，备集群可自动failover；当备集群异常时，主集群将由yasom降级为最大可用模式，并禁止自动failover，直到备集群恢复同步后，yasom重新将主集群升级为最大保护模式后，可以自动failover

## **2.3 规格约束**

1. 仅支持一主一备集群
1. 零丢失模式下，主实例宕机前处于最大保护模式时，才能触发failover
1. 不支持脑裂自动修复
1. 开启OM选举时，必须所有实例在线（非master不要求open）
1. failover切换和保护模式切换依赖于yasom和对应节点的yasagent正常


# **3. 详细测试设计**

## **3.1 测试设计方法**

主要采用场景法进行测试设计。

## **3.2 详细测试设计**

1、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|涉及|
|HA|涉及|
|压力|涉及|
|性能|涉及（数据量小:检测时间+2s）|
|可维护性|涉及|


2、详细测试点

|序号|测试场景|测试子场景|预期|用例编号|备注 ||
|:---|---|:---|:---|---|---|---|
|1|接口|启用自选主：  yasboot election enable on -c yashandb|主备集群自选主开启|,23.2无此命令，23.4有,,,,test_sdv_cluster_om_portect_autofailover_002.py|张茜||
|2||关闭自选主：  yasboot election enable off -c yashandb|主备集群自选主关闭||张茜||
|3||强制关闭自选主：  yasboot election enable off --force -c yashandb|主备集群自选主强制关闭||张茜||
|4||查看仲裁选主的运行状态：yasboot election status -c yashandb|显示仲裁选主的运行状态   ||张茜||
|5||查看仲裁选主的参数设置，条件切换配置和运行状态：yasboot election config show -c yashandb|显示仲裁选主的参数设置，条件切换配置和运行状态||张茜||
|6||查看仲裁选主相关的事件：yasboot election event show -c yashandb|查看仲裁选主相关的事件，包括事件名、发生时间、处理时间以及处理是否成功等||张茜||
|7|心跳参数(单机覆盖的集群不用再覆盖)|设置心跳参数超过最小边界值：yasboot election config set -k FailoverThreshold -v 1 -c yashandb|报错||张茜||
|8||设置心跳参数超过最大边界值：yasboot election config set -k FailoverThreshold -v 2001 -c yashandb|报错||张茜||
|9||设置心跳参数为最小边界值：yasboot election config set -k FailoverThreshold -v 2 -c yashandb|成功||张茜||
|10||设置心跳参数为最大边界值：yasboot election config set -k FailoverThreshold -v 2000 -c yashandb|成功||张茜||
|11||设置心跳参数为正常值：yasboot election config set -k FailoverThreshold -v 30 -c yashandb|成功||张茜||
|12|脑裂修复参数|开启脑裂修复：yasboot election config set -k FailoverAutoReinstate -v true -c yashandb|报错：集群不支持||张茜||
|13|是否开启零丢失参数|开启非零丢失模式：yasboot election config set -k ZeroDataLossMode -v false -c yashandb|成功|忽略|张茜||
|14||开启零丢失模式：yasboot election config set -k ZeroDataLossMode -v true -c yashandb|成功|忽略|张茜||
|15|零丢失模式（后台并发执行业务）——  保护模式降级校验，心跳参数生效校验|主集群所有实例故障——kill|备集群自动升主(保护模式降为最大可用；旧主拉起后自动降备，备集群成功拉起后，主备均变为最大保护模式)，数据不会丢失|test_sdv_cluster_om_portect_autofailover_001|张茜||
|16||主集群所有实例故障——断主集群网卡|备集群自动升主，最大保护模式将为最大可用；旧主拉起后自动降备，备集群成功拉起后，主备均变为最大保护模式，数据不会丢失|test_sdv_cluster_om_portect_autofailover_009|张茜||
|17||主集群所有实例故障——ycsctl stop|备集群自动升主，数据不会丢失|test_sdv_cluster_om_portect_autofailover_003|张茜||
|18||主集群所有实例故障——yasboot  stop|备集群不会自动升主|test_sdv_cluster_om_portect_autofailover_004|张茜||
|19||主集群实例依次故障——kill|最后一个实例故障后，备集群自动升主，数据不会丢失|场景同test_sdv_cluster_om_portect_autofailover_001|张茜||
|20||主集群实例依次故障——ycsctl stop|最后一个实例故障后，备集群自动升主，数据不会丢失|场景同test_sdv_cluster_om_portect_autofailover_003|张茜||
|21||主集群实例依次故障——yasboot stop|最后一个实例故障后，备集群不会自动升主|场景同test_sdv_cluster_om_portect_autofailover_004|张茜||
|22||主集群全部故障后，自动升主期间新主集群实例故障——kill方式|最终主备集群状态正常/会有双备，但是不会有双主|test_sdv_cluster_om_portect_autofailover_006|张茜||
|23||主集群全部故障后，自动升主期间新主集群实例故障——stop方式|最终主备集群状态正常/会有双备，但是不会有双主|test_sdv_cluster_om_portect_autofailover_007,test_sdv_cluster_om_portect_autofailover_008|张茜||
|24||主集群全部故障后，自动升主期间新主集群实例故障——断网|最终主备集群状态正常/会有双备，但是不会有双主|test_sdv_cluster_om_portect_autofailover_009|张茜||
|25||主集群全部故障后，自动升主期间新主集群实例随机故障（网卡延迟、kill、stop、断网）|最终主备集群状态正常/会有双备，但是不会有双主||张茜||
|26||备集群所有实例停止（ycsctl stop）再拉起为open|主集群保护模式先降为最大可用（中间状态校验，不拉起即为最大可用），再变成最大保护|test_sdv_cluster_om_portect_autofailover_011.py,test_sdv_cluster_om_portect_autofailover_013|张茜||
|27||备集群所有实例停止（kill）再拉起为open|主集群保护模式先降为最大可用，再变成最大保护|test_sdv_cluster_om_portect_autofailover_012.py|张茜||
|28||备集群所有实例与主集群断网，再恢复网络|主集群保护模式先降为最大可用，再变成最大保护||张茜||
|29||主集群所有实例故障后，备集群升主，升主后做switchover后继续故障主集群|备集群会自动切换，数据不会丢失|test_sdv_cluster_om_portect_autofailover_014.py|张茜||
|30||备集群有实例状态为nomount时，主集群故障|备集群会自动切换，数据不会丢失|不用单独在23.2上测试，23.2默认为nomount|张茜||
|31||备集群有实例状态为mount时，主集群故障|备集群会自动切换，数据不会丢失||张茜||
|32||yasagent进程不在，主集群所有实例故障  （yasagent起来后自动切换）|备集群不会自动升主（无agent就无法上报异常）|test_sdv_cluster_om_autofailover_pro_010.py|张茜||
|33||yasom与主集群部署在同一个机器上，主备断联|备集群不会自动升主（yasom能看到主集群，yasom和备集群都检测不到主集群时才会自动升主）|test_sdv_cluster_om_autofailover_pro_013.py|张茜||
|||shutdown 方式也会触发自动切换||test_sdv_cluster_om_portect_autofailover_005|张茜||
|||主集群网络隔离后 yasom和备都检测不到主，但是主还可以继续做业务，会出现双主脑裂场景|||张茜||
|34|非零丢失模式——最大可用模式（后台并发执行业务）|最大可用模式，主集群所有实例故障——kill|备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_ava_001|张彩虹||
|35||最大可用模式，主集群所有实例故障——断主集群网卡|备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_KT_ava_012|张彩虹||
|36||最大可用模式，主集群所有实例故障——ycsctl stop|备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_ava_002|张彩虹||
|37||最大可用模式，主集群所有实例故障——yasboot  stop|备集群不会自动升主|test_sdv_cluster_om_autofailover_ava_003|张彩虹||
|38||最大可用模式，主集群实例依次故障——kill|最后一个实例故障后，备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_ava_004|张彩虹||
|39||最大可用模式，主集群实例依次故障——ycsctl stop|最后一个实例故障后，备集群自动升主，旧主拉起后自动降备|同test_sdv_cluster_om_autofailover_ava_002|张彩虹||
|40||最大可用模式，主集群实例依次故障——yasboot stop|最后一个实例故障后，备集群不会自动升主|test_sdv_cluster_om_autofailover_ava_005|张彩虹||
|41||最大可用模式，主集群全部故障后，自动升主期间新主集群实例故障——kill方式|最终主备集群状态正常/会有双备（  中间状态  ），但是不会有双主？|test_sdv_cluster_om_autofailover_KT_ava_006|张彩虹||
|42||最大可用模式，主集群全部故障后，自动升主期间新主集群实例故障——stop方式|最终主备集群状态正常/会有双备，但是不会有双主？|test_sdv_cluster_om_autofailover_KT_ava_007|张彩虹||
|43||最大可用模式，主集群全部故障后，自动升主期间新主集群实例故障——断网|最终主备集群状态正常/会有双备，但是不会有双主？||张彩虹||
|44||最大可用模式，主集群全部故障后，自动升主期间新主集群实例随机故障（网卡延迟、kill、stop、断网）|最终主备集群状态正常/会有双备，但是不会有双主？|test_sdv_cluster_om_autofailover_KT_ava_008|张彩虹||
|||主集群网络隔离后 yasom和备都检测不到主，但是主还可以继续做业务，会出现双主脑裂场景（需要主备之间网络配置和集群内部网络配置分开）|||张彩虹||
|45||最大可用模式，备集群所有实例停止（ycsctl stop）再拉起为open|主保护模式不变|test_sdv_cluster_om_autofailover_ava_006.py|张彩虹||
|46||最大可用模式，备集群所有实例停止（kill）再拉起为open|主保护模式不变|test_sdv_cluster_om_autofailover_ava_007.py|张彩虹||
|47||最大可用模式，备集群所有实例与主集群断网，再恢复网络|主保护模式不变|test_sdv_cluster_om_autofailover_ava_013.py|张彩虹||
|48||最大可用模式，主集群所有实例故障后，备集群升主，升主后做switchover（  只能OM层面下发，yasql方式会拦截  ）后继续故障主集群|备集群会自动切换，旧主脑裂手动修复后，可正常switchover|test_sdv_cluster_om_autofailover_ava_008.py|张彩虹||
|49||最大可用模式，备集群有实例状态为nomount时，主集群故障|备集群会自动切换|test_sdv_cluster_om_autofailover_ava_009.py|张彩虹||
|||最大可用模式，备集群所有实例状态为nomount时，主集群故障|备集群不会自动切换|test_sdv_cluster_om_autofailover_ava_009.py|||
|50||最大可用模式，备集群有实例状态为mount时，主集群故障|备集群不会自动切换|test_sdv_cluster_om_autofailover_ava_009.py|张彩虹||
|51||最大可用模式，yasagent进程不在，主集群所有实例故障  （yasagent起来后自动切换）|备集群不会自动升主（无agent就无法上报异常）|test_sdv_cluster_om_autofailover_ava_010.py|张彩虹||
|52||最大可用模式，yasom与主集群部署在同一个机器上，主备断联|备集群不会自动升主（yasom能看到主集群，yasom和备集群都检测不到主集群时才会自动升主）|同test_sdv_cluster_om_autofailover_ava_013.py|张彩虹||
|||shutdown 方式也会触发自动切换||test_sdv_cluster_om_autofailover_ava_011.py|张彩虹||
|53|非零丢失模式——最大性能模式（后台并发执行业务）|最大性能模式，主集群所有实例故障——kill|备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_per_001.py|张彩虹||
|54||最大性能模式，主集群所有实例故障——断主集群网卡|备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_KT_per_012|张彩虹||
|55||最大性能模式，主集群所有实例故障——ycsctl stop|备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_per_002.py|张彩虹||
|56||最大性能模式，主集群所有实例故障——yasboot  stop|备集群不会自动升主|test_sdv_cluster_om_autofailover_per_003|张彩虹||
|57||最大性能模式，主集群实例依次故障——kill|最后一个实例故障后，备集群自动升主，旧主拉起后自动降备|test_sdv_cluster_om_autofailover_per_004|张彩虹||
|58||最大性能模式，主集群实例依次故障——ycsctl stop|最后一个实例故障后，备集群自动升主，旧主拉起后自动降备|同test_sdv_cluster_om_autofailover_per_002|张彩虹||
|59||最大性能模式，主集群实例依次故障——yasboot stop|最后一个实例故障后，备集群不会自动升主|test_sdv_cluster_om_autofailover_per_005|张彩虹||
|60||最大性能模式，主集群全部故障后，自动升主期间新主集群实例故障——kill方式|最终主备集群状态正常/会有双备，但是不会有双主？|test_sdv_cluster_om_autofailover_KT_per_006|张彩虹||
|61||最大性能模式，主集群全部故障后，自动升主期间新主集群实例故障——stop方式|最终主备集群状态正常/会有双备，但是不会有双主？|test_sdv_cluster_om_autofailover_KT_per_007|张彩虹||
|62||最大性能模式，主集群全部故障后，自动升主期间新主集群实例故障——断网|最终主备集群状态正常/会有双备，但是不会有双主？||张彩虹||
|63||最大性能模式，主集群全部故障后，自动升主期间新主集群实例随机故障（网卡延迟、kill、stop、断网）|最终主备集群状态正常/会有双备，但是不会有双主？|test_sdv_cluster_om_autofailover_KT_per_008|张彩虹||
|64||最大性能模式，备集群所有实例停止（ycsctl stop）再拉起为open|主保护模式不变|test_sdv_cluster_om_autofailover_per_006.py|张彩虹||
|65||最大性能模式，备集群所有实例停止（kill）再拉起为open|主保护模式不变|test_sdv_cluster_om_autofailover_per_007.py|张彩虹||
|66||最大性能模式，备集群所有实例与主集群断网，再恢复网络|主保护模式不变|test_sdv_cluster_om_autofailover_per_013.py|张彩虹||
|67||最大性能模式，主集群所有实例故障后，备集群升主，升主后做switchover后继续故障主集群|备集群会自动切换，旧主脑裂手动修复后，可正常switchover|test_sdv_cluster_om_autofailover_per_008.py|张彩虹||
|68||最大性能模式，备集群有实例状态为nomount时，主集群故障|备集群会自动切换|test_sdv_cluster_om_autofailover_per_009.py|张彩虹||
|69||最大性能模式，备集群有实例状态为mount时，主集群故障|备集群会自动切换|test_sdv_cluster_om_autofailover_per_009.py|张彩虹||
|70||最大性能模式，yasagent进程不在，主集群所有实例故障|备集群不会自动升主（无agent就无法上报异常）|test_sdv_cluster_om_autofailover_per_009.py|张彩虹||
|71||最大性能模式，yasom与主集群部署在同一个机器上，主备断联|备集群不会自动升主（yasom能看到主集群，yasom和备集群都检测不到主集群时才会自动升主）|同test_sdv_cluster_om_autofailover_per_013.py|张彩虹||
|||shutdown 方式也会触发自动切换||test_sdv_cluster_om_autofailover_per_011.py|张彩虹||
|72|拦截场景|一主两备部署下，不支持自动切换，部署成功后停掉一个备集群后也不支持打开|OM开启自选主参数时拦截报错||张彩虹||
|||开启自选主后，手动修改主备DB层面心跳参数|||张彩虹||
||升级|目前不支持，支持主备升级后加固测试||/|张彩虹||
||性能|RTO 和switchover（不做ckpt）时间（60W压力场景 kill场景，网络超时）||专项测试|张彩虹||
|||yasboot方式set和unset是否都能生效|||张彩虹||


# **4. 测试用例**

冒烟用例

|序号|测试场景|预期|
|:---|:---|:---|
|1|零丢失模式，主集群所有实例故障——kill|备集群自动升主(保护模式降为最大可用；旧主拉起后自动降备，备集群成功拉起后，主备均变为最大保护模式)，数据不会丢失|
|2|零丢失模式，主集群所有实例故障——yasboot  stop|备集群不会自动升主|
|3|非零丢失模式，最大可用模式，主集群所有实例故障——kill|备集群自动升主，旧主拉起后自动降备|
|4|非零丢失模式，最大性能模式，主集群所有实例故障——kill|备集群自动升主，旧主拉起后自动降备|


# **5. 测试框架设计**

本次测试使用anchor_regress框架实现

框架需要适配备集群实例全部可open

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|主备集群|


# **7、工作量评估**

测试设计+评审：1.5人天

测试执行+用例自动化：14人天

上车分析：1人天  


# 8、上车分析





