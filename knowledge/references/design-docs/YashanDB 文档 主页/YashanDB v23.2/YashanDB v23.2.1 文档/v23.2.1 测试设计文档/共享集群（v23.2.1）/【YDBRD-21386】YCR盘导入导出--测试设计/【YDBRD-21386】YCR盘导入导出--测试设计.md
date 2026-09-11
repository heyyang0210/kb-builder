Created by 张茜, last modified on 一月 29, 2024

# **1. 概述**

升级需要共享集群支持配置参数可以导出导入，实现YCR集群配置的导出备份和导入恢复功能，节省升级工作量，给升级功能做辅助。

本特性的主要功能就是：1.支持配置文件导入YCR 2.支持导出YCR的配置文件

SR：        [YDBRD-21386](https://jira.yasdb.com/browse/YDBRD-21386?src=confmacro)    -  YCR盘导入导出  完成

开发设计文档：    [YCR支持导入导出详细设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141565150)  

测试概要设计：    [【YDBRD-19938】YCR盘导入导出--测试概要设计](141567691.html)  

# **2. 需求分析**

## **2.1 功能点分析**

该需求主要实现：  一键导出配置文件后导入，实现集群配置的备份恢复。

## 基本功能特性

|功能|涉及接口|
|:---|:---|
|配置文件导入|ycsctl import src_path|
|配置文件里的参数导入|ycsctl set ycr_config key value|
|导出配置文件到指定位置|ycsctl export dest_path|
|格式化集群|create cluster name -ycsdisk path -o|
|DISK_HB_KEEP_ALIVE|ycsctl show config/ycsctl show parameter|
|NETWORK_HB_TIMEOUT|ycsctl show config/ycsctl show parameter|
|新增错误码ERROR_YCS_YCR_EXPORT|  
|
|新增错误码ERROR_YCS_YCR_IMPORT|  
|


## **2.2 应用场景**

主要应用于共享集群实现YCR集群配置的备份恢复，一键导入进行升级。

## **2.3 规格约束**

- 部署形态：集群
- 节点个数：2节点测试为主，4节点只测基本功能
- 导入目前只支持离线一键导入
- 只考虑带DB、open启动


# **3. 详细测试设计**

## **3.1 测试设计方法**

根据ycsctl新增接口，主要根据场景法覆盖测试场景，以及设置后的功能正常:

1、业务层面和基本语法测试：

    1.语法校验覆盖：

     1）create cluster name -ycsdisk path （path入参、ycsdisk格式层面考虑  ）

     2）ycsctl import/export命令path入参校验（path入参格式、权限层面）

     3）set ycr_config语法校验（value值为运算结果的返回、参数值入参错误：比如设置_HOST_NAME/YCR_DISK）

     3）导入导出错误码校验

   2.部署方式覆盖：

      1）  导入YCR配置文件 2.启动集群

      2）1.  create cluster 2. add node 3.add shell 4.导入参数(set config) 5.启动

   3.导入、导出、set ycr_setconfig参数业务功能覆盖：

      1）导入、导出正常场景覆盖

      2）导入导出交叉场景覆盖

           1.导入后再次导出

           2.导出后再次导入

           3.导出后修改文件，再次导入后结合命令行完成配置启动

2、并发场景

     1.并发导入    ？？

     2.并发导出

     3.并发导入导出

3、故障场景

     1.导入过程中构造故障（reboot、延迟、丢包、内存满、cpu满）

     2.导出过程中构造故障（reboot、延迟、丢包、内存满、cpu满、kill -9、kill -19）

4、4节点场景

     1.按照导出格式修改4节点，安装部署，启动集群，执行DB业务和yfs业务正常

     2.导出后再次导入成功，启动集群，执行DB业务和yfs业务正常

     3.导出后修改内容为2节点，再次导入正常，启动2节点正常，执行DB业务和yfs业务正常

5、资料验证

## **3.2 详细测试设计**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|否，故障对于导出不影响，因此并发过程中故障必要性不大|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|是|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


# **4. 测试用例**

冒烟用例–ycr导入导出

# **5. 测试框架设计**

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


|用例类型|测试框架|用例目录|用例个数|备注|
|:---|:---|:---|:---|:---|
|基本故障业务场景用例|ha|  
|/|  
|
|DB并发启停用例|ha|  
|/|  
|
|公共故障场景用例|dfr|  
|  
|  
|
|长稳用例|regress_rac|  
|  
|  
|
|并发KT用例|testkill|  
|  
|  
|
|一致性KT用例|consistency|  
|  
|  
|
|不可自动化用例|/|  
|  
|  
|


# **6. 测试环境说明**

测试环境：2节点单主机磁阵环境+2节点多主机磁阵环境

# **7. 工作量评估**

工作量：xx人天

计划测试完成时间：2024/1/30

|工作量|备注|
|:---|:---|
|用例输出|  
|
|用例自动化|  
|
|用例测试执行|  
|
|问题单跟踪回归|  
|
|CI工程新增和沟通对齐|  
|
|需求上车|  
|


# **8. TODO**

  


# **9. 上车工程分析**

|工程名|工程连接|分析结果|解决方案|备注|
|---|---|---|---|---|
|**单机：**|  
|  
|  
|  
|
|  [Agile_L2_sa_FT_yasldr_1](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/2628/)  |2631|  
|  [https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/2631/](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/2631/)  |已绿|
|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/1832/)  |重拉：构建1836|超时 |  
|已绿|
|  [Agile_L2_sa_heap_HA_4_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_4_docker/3193/)  |lastfail：3197|N1.run('recover database until time to_date(\'' + target_,time1 + '\', \'yyyy-mm-dd hh24:mi:ss\')').expect('Succeed')|lastfail|已绿|
|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/1750/)  |  
|bloom_hash_inner_join_14_tac --开发确认中    
  dml3–order by 排序，用例问题 与上车无关    
|  
|已绿|
|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/2050/)  |重拉：构建2054\2060|超时    
  2054：no free space in virtual memory pool    
  cbo+plsql_DBMS_external用例不稳定    
    
|lastfail|已绿|
|**分布式：**|  
|  
|  
|  
|
|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/979/)  |重拉：构建985|超时     
    [YDBRD-26592](https://jira.yasdb.com/browse/YDBRD-26592?src=confmacro)    -  【CI】master_L2_dst_tac_yasft_arm工程统计信息用例core在statsSrlzStats，统计信息上列统计信息的项数和表的列数不同  解决关闭|  
|  
|
|  [Agile_L2_dst_tac_yasft_32K_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/810/)  |lastfail：813|test_sdv_function_index_tac_123 --分布式已支持DBMS_STATS功能|lastfail|已绿|
|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/1032/)  |重拉：构建1038|超时，    [Agile_L2_dst_lsc_yasft_arm #1038 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/1038/console)      
    
    [YDBRD-26607](https://jira.yasdb.com/browse/YDBRD-26607?src=confmacro)    -  【CI】master_L2_dst_lsc_yasft_arm工程core在dstbStatsSetColumns,统计信息上列统计信息的项数和表的列数不同  解决关闭|  
|  
|
|  [Agile_L2_dst_FT_yasldr_4](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_4/2092/)  |重拉：构建2095|超时，    [Agile_L2_dst_FT_yasldr_4 #2095 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_4/2095/)  |  
|重跑  --已绿|
|  [Agile_L2_dst_FT_yasboot_load](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasboot_load/2247/)  |重拉：构建2251|导入并发数太高出现oom，lastfail|  
|已绿|
|**集群：**|  
|  
|  
|  
|
|Agile_L2_cluster_backup_arm_1|  [Agile_L2_cluster_backup_arm_1 #1219 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/1219/console)  |用例不稳定，和特性无关--已同步用例作者修改用例保证稳定|重跑|重跑---已绿|
|  [Agile_L2_cluster_heap_TX_2_debug_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_TX_2_debug_arm/1358/)  |  
|超时，    [Agile_L2_cluster_heap_TX_2_debug_arm #1362 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_TX_2_debug_arm/1362/)  |重跑|重跑---已绿|
|Agile_L2_cluster_yasft_cluster_case_arm|  [YTP](http://192.168.29.132:8772/#/buildAnalysis/taskRecordDetail?taskId=ci_task_AYylcn9j&runId=ci_record_qQlkJVj9&lastRunId=ci_record_SGbQGunk&activity=FT)  |特性修改用例及预期|修改后重跑。报错为不稳定|  
|
|  [Agile_L2_cluster_heap_yasft_sa_case_arm #1574 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1574/)  |  
|上车显示问题，ytp显示正常     [Agile_L2_cluster_heap_yasft_sa_case_arm #1582 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1582/)  |重拉|重跑---已绿|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


## Attachments:

[【YDBRD-21386】YCR盘导入导出_new.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzk4OTcwYzJhZjRmNTIwNmRkIiwicmVmX2lkIjoiNjczOTZiYzk1OTNmOTljOWZmMjM2NmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDg3LCJleHAiOjE3ODIzODM0ODd9.qu0UBlEsK10qobbF_Dcy_7bdIRIQt3hDIcFRD8VRpqI)

 (application/x-xmind)    


[【YDBRD-21386】YCR盘导入导出.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzlhMWFkOWEzMzExZGM4NTUzIiwicmVmX2lkIjoiNjczOTZiYzk1OTNmOTljOWZmMjM2NmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDg3LCJleHAiOjE3ODIzODM0ODd9.jILKJvF0NYD0zhUr1Pfrwg4Tk4R41hPYCjK1JuTlauQ)

 (application/x-xmind)    


[【YDBRD-21386】YCR盘导入导出.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzk4OTcwYzJhZjRmNTIwNmRlIiwicmVmX2lkIjoiNjczOTZiYzk1OTNmOTljOWZmMjM2NmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDg3LCJleHAiOjE3ODIzODM0ODd9.pf-3MWtk8cjBne6mKk6aRsM5ivkRtiqse4O6f0LIKEg)

 (application/x-xmind)    


 (application/octet-stream)    


 (application/octet-stream)    


[YCR导入导出--文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzk4OTcwYzJhZjRmNTIwNmUwIiwicmVmX2lkIjoiNjczOTZiYzk1OTNmOTljOWZmMjM2NmYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MDg3LCJleHAiOjE3ODIzODM0ODd9.G9yzcgwufg457pfqq4tpuefb5AFiT5ZPhZgDaD5vL7w)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2024/01/09 周二10:30-11：30    
  二、会议地点：线上会议    
  三、会议主持人：张茜    
  四、参会人员：Trump、李垠、杜宇轩、徐凡博、张茜    
  五、会议主题：【YDBRD-21386】YCR盘导入导出--测试设计,会议纪要：    
  1、故障场景作为门槛用例。    
  2、并发多个导入是否会有多个文件的穿插情况存在    
  3、ycsctl set ycr_config,ycr_config命名不合适    
  4、导出导入超长路径，路径过长。    
  5、ycsctl 考虑改成ycrctl,遗留问题：    
  1、ycsctl set ycr_config,ycr_config命名不合适    
  2、导出导入超长路径，需要限制字符长度    
  3、ycsctl 考虑改成ycrctl之类的将ycr和ycs进行区别    
  4、并发导入需要确认。 是否保证一个文件的所有命令,Posted by zhangqian at 一月 09, 2024 12:04|
|---|
|  [](null)  ,并发导入不保证导入之后的顺序，,1、文件1和文件2并发导入，可能文件1一部分，文件2一部分。验证并发导入，启动报错即可,2、并发导入成功，启动也成功，正常使用集群，执行db和yfs业务即可,  
,Posted by zhangqian at 一月 10, 2024 17:44|
|  [](null)  ,1.导入path不支持相对路径，完整的路径可以支持（因为用的system函数）    
  2.导入导出脚本里的ycsctl必须是完整的路径，因为不在脚本里设置环境变量,Posted by duyuxuan at 一月 11, 2024 10:19|
|  [](null)  ,测试用例需要注意使用全路径,Posted by zhangqian at 一月 11, 2024 10:43|
|  [](null)  ,遗留提示问题：,1、ycsctl import ycrbackup.sh 执行报错的不是文件不存在，而是命令找不到。由于是C接口中，因此该问题无法修改,![](https://pingcode.yasdb.com/atlas/files/public/67396bcaa1ad9a3311dc8554/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcwODcsImV4cCI6MTc4MjMwNzg4N30.Su2ztyKKRstZvzSYfyiu0RV92DBAcRYVft5KLReLRcQ),Posted by zhangqian at 一月 22, 2024 15:37|
