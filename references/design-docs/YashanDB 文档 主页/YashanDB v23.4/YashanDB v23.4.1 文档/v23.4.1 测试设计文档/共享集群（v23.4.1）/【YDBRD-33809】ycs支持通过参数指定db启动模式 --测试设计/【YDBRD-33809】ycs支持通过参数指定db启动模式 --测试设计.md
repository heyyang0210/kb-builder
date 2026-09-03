**IR：**  [https://pingcode.yasdb.com/ship/ideas/66cbf5fb4283cf23d4f3b250?](https://pingcode.yasdb.com/ship/ideas/66cbf5fb4283cf23d4f3b250?)  

#YASHAN-3165  ycs支持通过参数指定db启动模式

**SR：**  [https://pingcode.yasdb.com/pjm/items/67077e36e489dd0868f3cabe?](https://pingcode.yasdb.com/pjm/items/67077e36e489dd0868f3cabe?)  

#YDBRD-33809 ycs支持通过参数指定db启动模式

**开发设计文档链接：**  [https://pingcode.yasdb.com/wiki/pages/673eeab2728206efb9334a1b](https://pingcode.yasdb.com/wiki/pages/673eeab2728206efb9334a1b)  

# 1. 概述

ycsctl拉起DB，可以在命令行中指定DB拉起的阶段。

# 2. 需求分析

**之前：**  ycsctl启动DB由start.sh脚本控制启动模式。

**需求：**  ycsctl启动DB增加由ycsctl工具控制启动模式的方法。

## 2.1 功能点分析

**2.1.1 需求规格**

指定-m的情况下，ycsctl start instance/ycs -m nomount/mount/open/NOMOUNT/MOUNT/OPEN，按传入的模式拉起DB，并对非法输入报错。

不指定-m的情况下，ycsctl start instance/ycs，按脚本模式拉起DB。

无论上一次-m指定什么模式启动db，kill故障之后，均按照脚本模式自动拉起DB。

**2.1.2 相关命令**

|ycsctl|yasboot|
|---|---|
|ycsctl start ycs -m <mode>|yasboot cluster start -m|
|ycsctl start instance -m <mode>|yasboot ycs instance start --无启动模式，yasboot cluster start -m nomount启动之后，kill db，db始终会是配置脚本中的open启动。|


## 2.2 规格约束

- 产品形态：集群，4节点


# 3. 详细测试设计

## 3.1 关联特性/依赖分析

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|/|
|一致性|/|
|三方测试工具  
(sqltest，sqlancer)|/|
|安全|/|
|DFR|是|
|HA|/|
|压力|/|
|性能|/|
|可维护性|是|
|RTO|/|


## 3.2 详细测试设计

### 3.3.1 已有CI工程验证

详细的工程列表参考：启停+故障

|工程|备注（复制工程）|
|---|---|
|  [master_L2_cluster_yasft_ycs_arm [Jenkins]](https://jenkins.yasdb.com/view/master/view/master_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L2_cluster_yasft_ycs_arm/)    --yasboot基本串行启停|  [Agile_L2_cluster_yasft_ycs_arm_copy_xfb [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L2_cluster_yasft_ycs_arm_copy_xfb/)  |
|  [master_L3_cluster_fault_kill_arm_1 [Jenkins]    --故障db](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_fault_kill_arm_1/)  ，自动拉起db|  [Agile_L3_cluster_fault_kill_arm_1_copy_zq1 [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_fault_kill_arm_1_copy_zq1/)  |
|  [master_L3_cluster_para_startstop_arm_1 [Jenkins]      --2节点并发启停ycs/instance。默认start.sh启动模式](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_para_startstop_arm_1/)  ,修改框架增加-m 入参，默认为ha安装安装部署的nomount。|  [Agile_L3_cluster_para_startstop_arm_1_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_para_startstop_arm_1_copy_zq/)  |
|  [master_L3_cluster_ycs_4nodes_fault_1 [Jenkins]        ](https://jenkins.yasdb.com/user/zhangqian/my-views/view/%E6%88%91%E7%9A%84%E8%A7%86%E5%9B%BE--3%E5%B1%82/job/master_L3_cluster_ycs_4nodes_fault_1/)     [--4节点并发启停ycs/instance。默认start.sh启动模式](https://jenkins.yasdb.com/view/master/view/master_L3_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L3_cluster_para_startstop_arm_1/)  |  [Agile_L3_cluster_ycs_4nodes_fault_1_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_ycs_4nodes_fault_1_copy_zq/)  |
|  [master_L3_cluster_heap_YASKT [Jenkins]                    --KT基本场景，并发业务过程中kill -9 yasboot shutdown等故障](https://jenkins.yasdb.com/user/zhangqian/my-views/view/%E6%88%91%E7%9A%84%E8%A7%86%E5%9B%BE--3%E5%B1%82/job/master_L3_cluster_heap_YASKT/)  |  [Agile_L3_cluster_heap_YASKT_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_heap_YASKT_copy_zq/)  |
|3层ycs基本功能用例|  [Agile_L3_cluster_yasft_ycs_arm_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_yasft_ycs_arm_copy_zq/)  |
|增删redo工程|  [Agile_L3_cluster_Redo_arm_1_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_Redo_arm_1_copy_zq/)  |
|主备集群故障|  [Agile_L3_cluster_multi_fault_kill_ha_arm_3_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/%E5%88%AB%E4%BA%BA%E7%9A%84copy/job/Agile_L3_cluster_multi_fault_kill_ha_arm_3_copy_zq/)                |
|  [master_L2_cluster_FT_ha_arm [Jenkins]         ](https://jenkins.yasdb.com/view/master/view/master_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/master_L2_cluster_FT_ha_arm/)  两备集群ha功能用例|  [Agile_L2_cluster_FT_ha_arm_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L2_cluster_FT_ha_arm_copy_zq/)  |
|网络故障|  [Agile_L3_cluster_network_fault_copy_zq [Jenkins]](https://jenkins.yasdb.com/user/hezhiwei/my-views/view/zq_copy/job/Agile_L3_cluster_network_fault_copy_zq/)  |
|HA框架修改：启动命令加 -m $start_mode,,CT/KT/GUIDER：不影响变动，均是yasboot启动，走open模式|   
,![image.png](https://pingcode.yasdb.com/atlas/files/public/674d25f2a1ad9a3311de3bb9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzODMsImV4cCI6MTc4MjQ2OTE4M30.Ic1xApqPbdwuHtbVgt7o4POOPyaDW-nU32GS_8uPtiM)|


### 3.3.2 场景验证

||业务场景|详细步骤|预期|
|---|---|---|---|
|ycsctl（yasboot安装）|ycsctl start ycs/instance  -m 语法,  
|-m 入参校验：,1、非法入参：null，特殊符号（'open@#$%^&ll'），started，'open,open'，'open&&open'，'open_open',2、合法入参：nomount/mount/open/NOMOUNT/MOUNT/OPEN|  
1、报错明确,,2、启动模式按照指定入参启动。|
|||-m 顺序校验：,ycsctl -m start ycs/ycsctl start -m ycs,ycsctl -m start instance/ycsctl start -m instance|  
报错明确|
||ycsctl start ycs -m 功能场景,启动脚本和 -m执行模式不一致场景。,且基于每种不一致场景启动之后，做kill db、ycs故障，观测故障之后，kill自动重拉模式由脚本决定。,启动成功后，正常stop ycs/instance;|一、脚本中指定nomount：,1、启动不加-m，启动状态为nomount，按照脚本启动,2、-m 指定 open，启动状态为open。（select * from v$instance）,3、-m 指定 mount，启动状态为mount。,,二、脚本中指定mount：,1、启动不加-m，启动状态为mount，按照脚本启动,2、-m 指定 open，启动状态为open。（select * from v$instance）,3、-m 指定 nomount，启动状态为nomount。,,三、脚本中指定open：,1、启动不加-m，启动状态为open，按照脚本启动,2、-m 指定 nomount，启动状态为nomount。（select * from v$instance）,3、-m 指定 mount，启动状态为mount。|指定 -m按照指定模式启动，不指定按照脚本启动。,kill db之后，不论上次启动db是否指定-m，再次重拉按照脚本重拉。,kill ycs之后，yascsm存在，不论上次启动是否指定-m，再次重拉按照脚本重拉。,|
||ycsctl start instance -m  
|一、auto_start=NEVER，下发ycsctl start ycs -m open。ycs和yascsm正常拉起，db不被启动。,ycsctl start instance -m,,二、脚本中指定nomount：,1、启动不加-m，启动状态为nomount，按照脚本启动,2、-m 指定 open，启动状态为open。（select * from v$instance）,3、-m 指定 mount，启动状态为mount。,,三、脚本中指定mount：,1、启动不加-m，启动状态为mount，按照脚本启动,2、-m 指定 open，启动状态为open。（select * from v$instance）,3、-m 指定 nomount，启动状态为nomount。,,四、脚本中指定open：,1、启动不加-m，启动状态为open，按照脚本启动,2、-m 指定 nomount，启动状态为nomount。（select * from v$instance）,3、-m 指定 mount，启动状态为mount。| |
||ycsctl start ycs/instance 带模式和不带模式穿插执行  
|脚本为nomount启动，一次加了-m open，下一次启动不加 -m ，不加-m，启动依旧按照脚本,保证不能记录上一次的启动模式。,nomount启动之后alter database open；kill ycs进程，yascsm拉起的yascs根据脚本默认启动db||
|yasboot，启动om--monit,|yasboot语法验证|-m 入参校验：,1、非法入参：null，特殊符号（'open@#$%^&ll'），started，'open,open'，'open&&open'，'open_open',2、合法入参：nomount/mount/open/NOMOUNT/MOUNT/OPEN,,-m 顺序校验：,yasboot -m cluster start ,yasboot  cluster -m start ||
||启动脚本和yasboot -m指定不一致,且基于每种不一致场景启动之后，做kill db、ycs、yascsm+db故障，观测故障之后，kill自动重拉模式由脚本决定。,,启动成功后，正常yasboot cluster stop |yasboot cluster start -m ,一、脚本中指定nomount：,1、启动不加-m，启动状态为nomount，按照脚本启动,2、-m 指定 open，启动状态为open。（select * from v$instance）,3、-m 指定 mount，启动状态为mount。,,二、脚本中指定mount：,1、启动不加-m，启动状态为mount，按照脚本启动,2、-m 指定 open，启动状态为open。（select * from v$instance）,3、-m 指定 nomount，启动状态为nomount。,,三、脚本中指定open：,1、启动不加-m，启动状态为open，按照脚本启动,2、-m 指定 nomount，启动状态为nomount。（select * from v$instance）,3、-m 指定 mount，启动状态为mount。|指定 -m按照指定模式启动，不指定按照脚本启动。,kill db之后，不论上次启动db是否指定-m，再次重拉按照脚本重拉。,kill ycs之后，yascsm存在，不论上次启动是否指定-m，再次重拉按照脚本重拉。,kill yascsm、yascs+db之后，om-monit拉起yascsm，yascsm按照脚本拉起ycs+db（open//）|
||升级后，kill db，kill ycs，kill yascsm+yascs|均以open拉起。||
|并发|yasboot -m 和yasboot 不加指定模式并发启动（且指定模式和脚本不一致）。||不core，正常启动，正常报错。启动模式随机碰撞。可能是-m指定，也可能是脚本指定模式|
||  
ycsctl start ycs -m 和ycsctl不加指定模式并发启动（且指定模式和脚本不一致）。|||
||ycsctl start instance -m 和ycsctl不加指定模式并发启动（且指定模式和脚本不一致）。|||
|资料|资料  
|ycsctl start ycs/ycsctl start instance 增加启动模式说明。,yasboot？？无|  
|


4. 测试用例

1. 冒烟文本用例；


|  
|测试场景|预期|
|---|---|---|
|1|-m 入参校验：,1、非法入参：null，特殊符号（'open@#$%^&ll'），started，'open,open'，'open&&open'，'open_open',2、合法入参：nomount/mount/open/NOMOUNT/MOUNT/OPEN||
|2|启动脚本和-m指定不一致,脚本中指定nomount：,1、启动不加-m，启动状态为nomount，按照脚本启动,2、-m 指定 open，启动状态为open。（select * from v$instance）,3、-m 指定 mount，启动状态为mount。,kill ycs、kill db均按脚本默认启动。||




# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：8  *人天*

计划测试完成时间：xx

# 8. 测试用例维护

- *规划不同类型的用例自动化看护的是哪个库，哪个文件夹，哪个调度，是否需要新增工程*
- *确认用例耗时情况，若有耗时久的，进行备注*


|测试项|框架|目录|备注|
|:---|:---|:---|:---|
|ycsctl|ha  
|  
|  
|
|yasboot   
|guider  
|  
|  
|


# 9. 上车分析

  [Agile_master_L2_Build #5797 [Jenkins]](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/5797/)        --开发分支：dev-ycsmode

|工程链接|失败原因|重跑链接|
|---|---|---|
|单机：|||
|  [Agile_L2_sa_lsc_yasft_arm #4383 Console [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4383/console)  |环境资源不足，用例执行不稳定|  [Agile_L2_sa_lsc_yasft_arm #4400 [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/4400/)  |
|  [Agile_L2_sa_tac_yasft_arm #4153 [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4153/)  |超时重跑|  [Agile_L2_sa_tac_yasft_arm #4159 Console [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/4159/console)     --主干core|
|  [Agile_L2_sa_heap_HA_9_docker #746 [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/746/)  |用例不稳定，lastfail|  [Agile_L2_sa_heap_HA_9_docker #788 [Jenkins] (yasdb.com)  --lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_9_docker/788/)  |
|  [Agile_L2_sa_tac_HA_4_docker #5694 [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_4_docker/5694/)  |主干core --YDBRD-36442||
|  [Agile_L2_sa_heap_driver_jdbc_debug_docker #2301 [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_jdbc_debug_docker/2301/)  |主干问题 --YDBRD-36440||
|  [Agile_L2_sa_heap_yasft_arm #4909 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/4909/)  |超时重跑|lastfail，未包含 mysql 兼容user 系统函数 需求,  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/buildRecord?taskId=ci_task_PJTvE9nI&runId=ci_record_HuiNpmwM&lastRunId=ci_record_khIcvfvD)  |
|  [Agile_L2_sa_yasft_code_sensitive_arm #280 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_yasft_code_sensitive_arm/280/console)  ||  [YTP (yasdb.com) ](https://ytp.yasdb.com/#/buildAnalysis/buildRecord?taskId=ci_task_erSbcerX&runId=ci_record_3NETyR7I&lastRunId=ci_record_L7rbtDaw)   lastfail，未包含 mysql 兼容user 系统函数 需求|
||||
||||
|分布式|||
|  [Agile_L2_dst_lsc_yasft_arm #3654 Console [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3654/console)  |环境资源不足，|  [Agile_L2_dst_lsc_yasft_arm #3682 [Jenkins]     --lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3682/)  |
|  [Agile_L2_dst_tac_yasft_32K_arm #2938 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/2938/)  ||  [Agile_L2_dst_tac_yasft_32K_arm #2974 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/2974/)      --重跑已绿|
|  [Agile_L2_dst_tac_driver_jdbc_debug_asan_docker #4482 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/4482/)  |主干问题：#YDBRD-36440 ||
|  [Agile_L2_dst_tac_yasft_arm #3383 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3383/)  ||  [Agile_L2_dst_tac_yasft_arm #3431 [Jenkins] (yasdb.com)   ](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/3431/)     [ --lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3682/)  |
|  [Agile_L2_dst_pn_yasft_arm #179 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/179/)  ||  [Agile_L2_dst_pn_yasft_arm #213 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_pn_yasft_arm/213/)     [ --lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3682/)  |
|  [Agile_L2_dst_tac_driver_jdbc_arm #3146 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/3146/)  |主干问题：#YDBRD-36440 ||
|  [Agile_L2_dst_yasft_code_sensitive_arm #263 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/263/)  ||  [Agile_L2_dst_yasft_code_sensitive_arm #302 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_yasft_code_sensitive_arm/302/)      [--lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3682/)  |
|集群：|||
|  [Agile_L2_cluster_yasft_code_sensitive_arm #264 Console [Jenkins]](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_code_sensitive_arm/264/console)  |主干问题单修改，预期修改|  [Agile_L2_cluster_yasft_code_sensitive_arm #286 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/Agile_L2_%E2%85%A2%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4/job/Agile_L2_cluster_yasft_code_sensitive_arm/286/)   重跑结果：需求合入，预期最新对不上老代码|
|  [jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1301/ha_5freport/](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1301/ha_5freport/)  |用例不稳定|  [Agile_L2_cluster_FT_ha_arm #1306 [Jenkins]    --重跑已绿](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_ha_arm/1306/)  |
|  [Agile_L2_cluster_yasft_cluster_case_arm #4294 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/4294/)  |超时重跑|  [YTP (yasdb.com) ](https://ytp.yasdb.com/#/buildAnalysis/buildRecord?taskId=ci_task_AYylcn9j&runId=ci_record_tlSJFPz1&lastRunId=ci_record_R0ocWLhT)  重跑结果：需求合入，预期最新对不上老代码|
|  [Agile_L2_cluster_yasft_yfs_arm #3585 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3585/)  |磁阵慢，启动超时|  [Agile_L2_cluster_yasft_yfs_arm #3621 [Jenkins] (yasdb.com)   ](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_yfs_arm/3621/)    [ --lastfail已绿](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/3682/)  |
|  [Agile_L2_cluster_jdbc_arm #1716 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_jdbc_arm/1716/)  |主干问题：#YDBRD-36440 ||
|  [Agile_L2_cluster_FT_install_arm #1145 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/1145/console)  |升级有问题，已提单，YDBRD-36593|  [Agile_L2_cluster_FT_install_arm #1180 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_install_arm/1180/)     -重跑已绿|
|  [Agile_L2_cluster_heap_yasft_sa_case_arm #3998 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/3998/)  |未包含需求重复更新检测。|  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/buildRecord?taskId=ci_task_3t2GuTOG&runId=ci_record_FNzxLL43&lastRunId=ci_record_LyjpU6LJ)  |




