Created by 张茜, last modified on 十月 15, 2024

**SR链接：**  ** **    [https://pingcode.yasdb.com/pjm/items/6621e50afd997db58add56bc](https://pingcode.yasdb.com/pjm/items/6621e50afd997db58add56bc)    **?#YDBRD-26516 集群支持在线redo文件操作**

**开发设计文档链接：**    [集群支持在线redo文件操作 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152999316)  

# 1. 概述

目前集群下实例的redo file是在建库时指定，无法新建或删除。本需求支持集群下实例在线增删redo file。

# 2. 需求分析

## 2.1 功能点分析

功能：

支持集群下实例在线增删redo file，操作管理在线redo文件。

|ALTER DATBASE ADD LOGFILE|为数据库增加新的redo日志，且支持同时增加多个，此操作需要数据库处于OPEN状态。|ALTER DATABASE ADD LOGFILE ('/home/yasdb/YASDB_DATA/dbfiles/redo5' SIZE 72355840,'/home/yasdb/YASDB_DATA/dbfiles/redo6' SIZE 72355840);|
|:---|:---|:---|
|ALTER DATBASE DROP LOGFILE|删除一个已存在的redo日志，对于正在使用中的redo日志则不被允许删除。此操作需要数据库处于OPEN状态。|ALTER DATABASE DROP LOGFILE '/home/yasdb/YASDB_DATA/dbfiles/redo5';|


## 2.2 应用场景

需求本身应用场景：主要涉及以下两类：

（1）本地节点增删本地节点（open状态）

（2）  本地节点增删其他离线节点 – 2024/6/14前不交付

## 2.3 规格约束

- 部署形态：共享集群
- 节点数：4节点


# 3. 详细测试设计

  


## 3.1 测试设计方法

具体测试方法如下：

1、对于基本语法进行语法校验测试，采用边界值，场景法进行测试

2、对于并发场景主要采用场景法测试

  


3.1 测试场景

测试场景主要有：

|测试对象|测试项|测试描述|详细测试内容|
|:---|:---|:---|:---|
|**ALTER DATABASE ADD/DROP LOGFILE**    
    
    
    
    
    
|语法验证|验证参数输入有效性，覆盖边界值，通过等价类测试方法验证参数内容,1、size范围测试，超边界值和正常值。,2、关键字校验,      1）缺失 add /drop 关键字,      2）add/drop 关键字为不识别关键字，例：modify、delete、update等,      3）THREAD关键字改为：THREAD# 、THREAD##、instance   --2024/6/14前不交付,      4）缺失THREAD、缺失 THREAD后数字,3、路径格式校验,      1）+DG0,      2）/data 自定义文件路径：路径不存在、路径无权限、路径存在且权限正常,      3）redoxx.log--命名格式：+REDO/' '/' '.log、+REDO/" "/" ".log、+REDO/"中文—path_1"/"中文—log_1".log、+REDO/"中文—path_1"/"中文@#$%^&*!()log_1".log,+REDO/"中文@#$%^&*!()path_1"/"中文@#$%^&*!()log_1".log,  
|  
    
    
    
,[集群支持在线redo操作.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTlhMWFkOWEzMzExZGM4ZWIwIiwicmVmX2lkIjoiNjczOTZkMTg1OTNmOTljOWZmMjM3N2E5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODIwLCJleHAiOjE3ODIzOTIyMjB9.46dNBMpn2mVGIPrR2qCaPlv-ujzzrJOZKy5q7reVRKE)|
||在线节点增删REDO验证|1、节点1 open状态操作验证,      1）本地节点增删redo，正常,      2）节点1给在线的节点2增删redo，报错,      3）节点1给offline的节点3增删redo，正常,      4）给不存在节点增删redo--THREAD 5,2、节点1非open状态（  mount，started  ）操作验证，均报错,      1）本地增删redo,      2）节点1给节点2增删redo,      3）节点1给offline的节点3增删redo||
||可靠性场景验证|1、节点1增删节点1，故障节点1,2、节点1增删节点1，故障节点3，正常,3、节点1增删节点2，故障节点1，节点1恢复后，再次下发增删成功,4、节点1增删节点2，故障节点2，节点2恢复后，再次下发增删成功,5、节点2增删节点2，故障节点1，正常,6、kill增删操作,  
,故障类型覆盖：模拟写磁盘卡、kill -9 、延迟、丢包、断网卡||
||kill增redo1操作，A窗口yasql下发add、drop命令，B窗口sleep 1；kill -9 yasql 并发下发操作|中断操作，再次下发同样的增命令成功||
||kill删redo1操作，A窗口yasql下发add、drop命令，B窗口sleep 1；kill -9 yasql 并发下发操作|中断操作，再次下发同样的删命令成功||
||并发修改redo文件验证|1、add循环并发,      1）循环并发100创建,      2）循环并发n*265创建成功,      3)   循环并发n*800创建报错超过redo文件最大值 --单实例3……256。 n*256,      4）循环并发100w创建直到超磁盘空间报错,2、drop循环并发–基于上一次创建并发删,3、add/drop循环并发–创建1，2……1000同时删除1，2……10000,4、add/drop/dml/ddl语法循环并发,5、yfscmd rm redo文件和add、drop并发||
||增删redo文件和其他功能并发验证|1、查看v$logfile视图过程中add redo并发、drop redo并发、add和drop redo文件并发,      1）节点1，2，3，4各自操作redo和节点1，2，3，4查视图操作,2、备份恢复过程中add redo并发、drop redo并发、add和drop redo文件并发,      1）执行cluster备份和add redo并发，备份成功。再次下发,      2）恢复过程中和drop redo并发，删除备份中的redo文件，可能会报错也可能不会  。 --恢复成功,      3）执行cluster备份和drop redo并发，备份成功。,      4）恢复过程中和add redo并发，恢复成功。,      5）备份并发add、drop脚本，可能报错但报错信息明确即可，但是脚本停止后，再次下发备份成功。恢复同理。,3、ALTER SYSTEM SWITCH LOGFILE;过程中add redo并发、drop redo并发、add和drop redo文件并发,       1）switch和add并发，switch成功,       2）switch和drop并发，switch成功,       3）switch和add、drop并发，switch成功,4、在线恢复过程中add redo并发、drop redo并发、add和drop redo文件并发。在线恢复成功。,5、部署形态：集群ha，备节点上查v$logfile  （注意是否是全局信息，查gv$）||
|视图|增删redo文件后，v$logfile、gv$logfile查看logfile显示结果是否正确，所有实例|
|资料|增加集群支持相关说明|


|kill增redo1操作，A窗口yasql下发add、drop命令，B窗口sleep 1；kill -9 yasql 并发下发操作|中断操作，再次下发同样的增命令成功|
|---|---|
|kill删redo1操作，A窗口yasql下发add、drop命令，B窗口sleep 1；kill -9 yasql 并发下发操作|中断操作，再次下发同样的删命令成功|


## 3.2 关联特性/依赖分析

1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|并发|
|KT|涉及，可靠性测试|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|
|RTO|不涉及|


## 3.3 详细测试设计

# 4. 测试用例

  


# 5. 测试框架设计

基本语法校验考虑使用guider自动化，并发验证使用ha框架进行自动化

# 6. 测试环境说明

4节点多实例集群

# 7. 工作量评估

工作量：5-7  *人天*

计划测试完成时间：xx

工作量分析：

|工作项|时间成本|备注|
|:---|:---|:---|
|测试设计评审|0.5人/天|转测前完成|
|测试用例输出|1人/天|转测前完成|
|测试用例自动化|1人/天|转测前完成|
|测试执行|3人/天|  
|
|需求上车|1.5人/天|  
|


上车工程分析：

  [Agile_master_L2_Build #4817 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/4817/)  

|工程|结果|备注|
|:---|:---|:---|
|  [Agile_L2_sa_heap_HA_1_docker #4525 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/4525/)  |重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d198970c2af4f521045/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_sa_tac_yasft_arm #2663 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/2663/)  |  [Agile_L2_sa_tac_yasft_arm #2686 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/2686/)    ,lastfail 已绿|  
|
|  [Agile_L2_sa_lsc_yasft_arm #2793 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/2793/)  |  
|  
|
|  [Agile_L2_sa_upgrade_FT_3_docker #3123 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/3123/)  |  [Agile_L2_sa_upgrade_FT_3_docker #3145 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/3145/)     已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d198970c2af4f521046/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_cluster_heap_yasft_sa_case_arm #2528 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/2528/)  |重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d19a1ad9a3311dc8eb7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_cluster_yasft_cluster_case_arm #2593 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2593/)  |重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d198970c2af4f521048/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_cluster_yasft_ycs_arm #2353 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/2353/)  |重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d19a1ad9a3311dc8eb9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_cluster_backup_arm_1 #2062 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/2062/)  |重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d19a1ad9a3311dc8eba/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_cluster_backup_arm_2 #2056 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_2/2056/console)  |  [Agile_L2_cluster_backup_arm_2 #2094 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_2/2094/)     重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d198970c2af4f521049/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_cluster_backup_arm_3 #775 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/775/)  |  [Agile_L2_cluster_backup_arm_3 #796 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/796/)     重跑已绿|  
|
|  [Agile_L2_cluster_yasft_muti_difObj_sa_5_arm #142 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_muti_difObj_sa_5_arm/142/)  |重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d198970c2af4f52104a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|
|  [Agile_L2_dst_lsc_yasft_arm #2040 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/2040/)  |重跑已绿|![](https://pingcode.yasdb.com/atlas/files/public/67396d19a1ad9a3311dc8ebb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUVBQUFnQUFBQUFBQUFBQUJnQUFBQUFnQUFBQWdRQUNBQUlnQUFBSUFBQUFBQUFBZ0FBSWdBQUFBQUFBQUFBQUFBQUNBQUFBQUNDQUFBUUJBQUFCQUFBQ0VnZ0FBQWdBQUFBR0FBQUFBQUFBQUFJQUFBQUFBQUlRQUlBZ0FBQ0FBQUFBQ0JBQUFBUUFBQUFBQUNBQUJBQUFRQkFBQUFBQUFBZ0JBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDU4MjAsImV4cCI6MTc4MjMxNjYyMH0.PLJLGcOKmU0lsNtlvlOoD2DdbxOc5zVmvt4j4m5EHTc)|


## Attachments:

[集群支持在线redo操作.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTlhMWFkOWEzMzExZGM4ZWIwIiwicmVmX2lkIjoiNjczOTZkMTg1OTNmOTljOWZmMjM3N2E5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODIwLCJleHAiOjE3ODIzOTIyMjB9.46dNBMpn2mVGIPrR2qCaPlv-ujzzrJOZKy5q7reVRKE)

 (application/x-xmind)    


[image2024-6-6_14-50-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTlhMWFkOWEzMzExZGM4ZWIxIiwicmVmX2lkIjoiNjczOTZkMTg1OTNmOTljOWZmMjM3N2E5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1ODIwLCJleHAiOjE3ODIzOTIyMjB9.8g-ioKDT8zGz4ByhMnKgannNBmA_L7n2AacevhgEK4M)

 (image/png)    


## Comments:

|  [](null)  ,yfscmd rm删除集群目录，不保证结果正确性 --不测试,Posted by zhangqian at 五月 27, 2024 16:34|
|---|
