# 1. 概述

1、需求来源：产品化需求

2、需求概述：

YCS支持操作系统监控工具箱OSWBB(Operating System Watcher Black Box)

YCS作为共享集群的管理服务，需要根据系统负载以及运行状态来调整系统策略以及运行。方便集群服务管理

3、部署形态：集群

4、涉及的SR：

  [https://pingcode.yasdb.com/pjm/items/67077f70e489dd0868f3cc99?](https://pingcode.yasdb.com/pjm/items/67077f70e489dd0868f3cc99?)  

#YDBRD-33812 【DFX】ycs支持私网、存储网络相关的延迟等监控日志信息

# 2. 需求分析

增加线程收集服务器系统资源并保存，方便集群服务管理。

## 2.1 功能点分析

该需求需要实现一下功能：

1、收集时间间隔可配置。

2、收集的数据可以保存到当前路径和归档路径

3、OSWbb支持通过ycsctl启动和停止

4、OSWbb支持如下命令

ps、top、mpstat、iostat、vmstat等

5、采集到的信息需要带有时间

6、文件要能够自动清理，不能无限增长

- 新增命令：  
ycsctl start osw
ycsctl stop osw
- 配置参数增加


|**名称**|**范围**|**默认值**|**含义**|
|---|---|---|---|
|OSW_AUTOSTART|ON, OFF|ON|ycs启动时是否拉起OSW|
|OSW_INTERVAL|[1, 86400]|10s|OSW收集信息的间隔，单位秒，当取默认值0时，实际间隔等于磁盘心跳时间的1/3，1s ~ 1day|
|OSW_FILE_NUM|[2, 10000]|20|OSW数据文件数量|
|OSW_FILE_SIZE|[1M, 4G]|20M|OSW单个数据文件大小|


## 2.2 规格约束

- 产品形态：集群


# 3. 详细测试设计

## 3.1 关联特性/依赖分析

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|/|
|一致性|/|
|三方测试工具  
(sqltest，sqlancer)|/|
|安全|/|
|DFR|否|
|HA|/|
|压力|/|
|性能|是|
|可维护性|是|
|RTO|/|


## 3.2 详细测试设计

|模块|测试场景|预期|备注|
|---|---|---|---|
|新增配置参数,yascs.ini|osw_auto_start,OSW_FILE_NUM,OSW_FILE_SIZE,OSW_INTERVAL,基本场景， 所有参数入参违法：,null、空值、$#@￥%……*（）？、中文、非数字参数入参数字、数字参数入参负值和非数字、小数|正常报错，报错信息明确||
||1、osw_auto_start=OFF，ycsctl start ycs,2、ycsctl start osw|1、等待20s，查看osw目录下无收集日志的目录生成,2、20s,启动后再次查看目录下有日志生成,且文件命名带有时间,内容||
||多次下发start使其报错已经启动，再次下发stop,同理，多次下发stop使其报错已停止，再次下发start|||
||osw_auto_start=ON，ycsctl start ycs,|等待20s，查看osw目录下有收集日志生成||
||OSW_FILE_NUM最小、OSW_FILE_SIZE默认|等待时间较长，查看日志目录下只能生成filenum个数||
||OSW_FILE_NUM最小、OSW_FILE_SIZE 最小|等待5分钟，观察日志文件只能生成filenum个数和最小的文件size||
||OSW_INTERVAL 默认,|1、查看OSW_INTERVAL 时间默认值为磁盘心跳的3分之一即20s,2、看日志文件的收集时间按照参数配置生成||
||OSW_INTERVAL 设置最小|日志内容按照参数配置生成，大小没达到，内容累加||
||OSW_INTERVAL  设置最大|日志文件的收集时间按照参数配置生成，一天收集一次，,设置最大后，ycsctl stop ycs。,再次ycsctl start ycs，设置为5s，观察从最大收集修改后5s左右后继续收集,再次设置最大，ycsctl stop osw。设置为5s，再次启动osw，观察日志每隔5s收集一次,设置osw_auto_start为off ，OSW_INTERVAL  最大，ycsctl stop ycs，yasboot stop||
||配置OSW_FILE_NUM最大、OSW_FILE_SIZE 最大，构造dd占满磁盘90%|等待10分钟，观察日志文件写到磁盘满后再不写日志报错。||
||ycsctl show parameter|||
|~~归档备份~~|~~配置归档路径~~|~~观察日志不仅在当前的diag下生成，在归档开启之后，归档路径下也有一份存留~~|~~不支持。~~|
|osw线程启停|osw_auto_start=OFF/ON，启动ycs带db不影响,使用ycsctl和yasboot 两种方式||默认为on，跑上车即能覆盖到。主测off|
||osw_auto_start=OFF/ON，停止ycs带db不影响,使用ycsctl和yasboot 两种方式|||
||ycsctl start ycs/yasboot已默认带该线程启动，再次手动下发ycsctl start osw|不报错，启动成功||
||ycsctl stop ycs/yasboot node stop 已停止ycs进程，再次手动下发 ycsctl stop osw|不报错||
|并发|10并发下发ycsctl start osw|不报错，不卡||
||10并发下发ycsctl stop osw|||
||1、10并发下发ycsctl start osw、ycsctl stop osw,2、ycsctl stop osw,3、ycsctl start osw|1、不core即可,2、并发后再次手动stop osw，等待1min之后，观察不在收集日志,3、再次手动start osw，等待20s之后，观察继续收集日志||
|故障|osw_auto_start默认值，kill ycs|观察ycs再次被拉起后的20s后，有新的监控日志生成||
||1、OSW_AUTOSTART默认值，kill ycs+yascsm，等待时间超过间隔时间,2、ycsctl start ycs|观察ycs再次被拉起后的20s后，有新的监控日志生成||
||1、osw_auto_start=OFF，ycsctl start osw；kill ycs,2、sleep 300,3、ycsctl start osw|2、观察不默认启动该线程，ycs被拉起之后，5分钟内都不会有新的日志生成,3、5分钟后，手动启动线程，20s后观察有新的日志生成||
||使用系统大页内存占满机器内存，只剩200m左右,下发ycsctl start osw|启动成功,观察日志收集情况||
|性能|cpu、内存前后变化|||
|部署形态|单机、分布式、HA主备|单机分布式，执行报错,ha主备部署后，观察主备节点均有收集日志生成||
|资料|ycsctl工具章节：增加命令的说明,ycs配置参数章节：增加4个参数的说明,集群服务管理章节|||


# 4. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 5. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 6. 工作量评估

工作量：3  *人天*

计划测试完成时间：xx

# 7. 测试用例维护

- *规划不同类型的用例自动化看护的是哪个库，哪个文件夹，哪个调度，是否需要新增工程*
- *确认用例耗时情况，若有耗时久的，进行备注*


|测试项|框架|目录|备注|
|:---|:---|:---|:---|
|ycsctl|ha  
|  
|需要观察日志生成  
|


# 8. 上车分析

  [Agile_master_L2_Build #6092 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/6092/)                --dev-oswbb



|工程|失败原因|重跑解雇哦|
|---|---|---|
|单机|||
|  [Agile_L2_sa_heap_HA_1_docker #6120 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/6120/)  |||
|  [Agile_L2_sa_lsc_yasft_arm #4730 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4730/)  |||
|  [Agile_L2_sa_tac_yasft_arm #4468 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4468/)  |不稳定|  [Agile_L2_sa_tac_yasft_arm [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A0%E5%8D%95%E6%9C%BA/job/Agile_L2_sa_tac_yasft_arm/)  ,lastfail已绿|
|  [Agile_L2_sa_heap_yasft_arm #5310 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/5310/)  |||
|  [Agile_L2_sa_lsc_yastx_arm #560 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yastx_arm/560/)  |超时重跑|  [Agile_L2_sa_lsc_yastx_arm #572 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yastx_arm/572/)  ,重跑已绿|
|  [Agile_L2_sa_yasft_code_sensitive_arm #585 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/585/)  |||
|  [Agile_sa_L2_empty_string_yasft_arm #387 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_sa_L2_empty_string_yasft_arm/387/)  |||
|  [Agile_L2_sa_heap_HA_10_arm #884 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_10_arm/884/)  |超时重跑||
|  [Agile_L2_sa_heap_HA_9_docker #1034 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/1034/)  ||  [Agile_L2_sa_heap_HA_9_docker #1053 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/1053/)  ,lastfail 已绿|
|集群|||
|  [Agile_L2_cluster_heap_yasft_sa_case_arm #4302 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/4302/)  ||  [Agile_L2_cluster_heap_yasft_sa_case_arm #4313 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_heap_yasft_sa_case_arm/4313/)  ,lastfail 已绿|
|  [Agile_L2_cluster_yasft_cluster_case_arm #4660 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4660/)  |||
|  [Agile_L2_cluster_yasft_ycs_arm #3962 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3962/)  |不稳定|  [Agile_L2_cluster_yasft_ycs_arm #3972 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/3972/)  ,lastfail 已绿|
|  [Agile_L2_cluster_yasft_yfs_arm #3865 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3865/)  |不稳定|  [Agile_L2_cluster_yasft_yfs_arm #3876 [Jenkins] (yasdb.com)   ](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_yfs_arm/3876/)  ,lastfail 已绿|
|  [Agile_L2_cluster_backup_arm_1 #3607 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/3607/)  ||  [Agile_L2_cluster_backup_arm_1 #3620 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/3620/)  ,lastfail 已绿|
|  [Agile_L2_cluster_yasft_code_sensitive_arm #572 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/572/)  |||
|分布式|||
|  [Agile_L2_dst_lsc_yasft_arm #4020 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/4020/)  ||  [Agile_L2_dst_lsc_yasft_arm #4068 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/4068/)  ,lastfail 已绿|
|  [Agile_L2_dst_HA_Switch_docker #4795 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4795/)  ||  [Agile_L2_dst_HA_Switch_docker #4808 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/4808/)  ,重跑已绿|
|  [Agile_L2_dst_yasft_code_sensitive_arm #562 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/562/)  |||
|  [Agile_L2_dst_tac_yasft_arm #3702 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3702/)  ||  [Agile_L2_dst_tac_yasft_arm #3735 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3735/)  ,lastfail 已绿|
|  [Agile_L2_dst_pn_yasft_arm #484 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/484/)  |超时重跑|  [Agile_L2_dst_pn_yasft_arm #509 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A1%E5%88%86%E5%B8%83%E5%BC%8F/job/Agile_L2_dst_pn_yasft_arm/509/)  ,已绿|




|1|  [https://pingcode.yasdb.com/pjm/items/67077f70e489dd0868f3cc99?](https://pingcode.yasdb.com/pjm/items/67077f70e489dd0868f3cc99?)  ,#YDBRD-33812 【DFX】ycs支持私网、存储网络相关的延迟等监控日志信息|总数：3,致命：0,严重：0,一般：3,提示：0|3|0|1|B|A|设计/实现无偏差；有少量功能问题，性能达标，无基本功能问题；缺陷率不超过0.4%；|无||李道一|张茜|张茜|8|1000|4|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|


