Created by 张茜, last modified on 七月 18, 2024

# **1. 概述**

本文描述共享集群  YCS的voting disk和ycr disk支持多盘--om部署的测试设计。

SR：        [https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9](https://pingcode.yasdb.com/pjm/items/6611a8ba579a3edb84d860f9)    ?    
  #YDBRD-25871 YCS支持多盘——OM

开发设计文档：    [om适配ycs多盘详细设计文档](156139209.html)  

# **2. 需求分析**

## **2.1 功能点分析**

该需求主要实现：  一键部署多盘集群

## 基本功能特性

|功能|涉及接口|
|:---|:---|
|yfs磁盘发现|yasboot package ce gen  --disk-found-path|
|system--data导入toml|yasboot package ce gen  --system-data|
|【YDBRD-25871】om适配ycs多盘安装部署--测试设计|  
|
|  
|  
|


## **2.2 应用场景**

主要应用于共享集群实现一键部署多盘集群

## **2.3 规格约束**

- 部署形态：集群
- 节点个数：4节点，2节点（基础使用）


# **3. 详细测试设计**

## **3.1 测试设计方法**

./bin/yasboot package ce gen --cluster yashandb -u zq_ycs -p 123456 --ip 192.168.7.183 --port 22 --install-path /data/yas/yasboot/yasdb_home1 --data-path /data/yas/yasboot/instance1/yasdb_data1 --begin-port 1688 --node 2 --data /dev/mapper/LUN2T01

./bin/yasboot package install -t hosts.toml -i xx    //未作变化，不重点测试

./bin/yasboot cluster deploy -t yashandb.toml --yfs-force-create    //未作变化，不重点测试

根据yasboot新增接口，主要根据场景法覆盖测试场景，以及设置后的功能正常:

1、yasboot命令测试：  语法yasboot package ce gen 

2、toml配置测试

3、环境形态：单机集群、多机集群、主备集群

测试场景主要有：

|测试对象|测试项|测试描述|详细测试内容|
|:---|:---|:---|:---|
|yasboot package ce gen     
    
    
    
    
    
|disk-found-path|1、入参格式：,’‘、” “、null、特殊字符’@#@￥#%……&*111‘、/dev/yfd_path （软链接）–正常、/dev/yfs(存在且合法的目录，且目录下要有磁盘)、/dev/yfd_path_no(目录下没有内容)、/dev/yfd_path_no(有内容但不是磁盘),2、不指定该参数 --正常|  
    
    
    
    
|
||system-data|1、入参格式：,’‘、” “、null、特殊字符’@#@￥#%……&*111‘,2、盘入参数量：,多个systemdata入参：1、3、5、6（6报错）,-system-data /dev/yfs/lun1, /dev/yfs/lun2, /dev/yfs/lun3（正常冗余度根据盘决定）,-system-data /dev/yfs/lun1 -system-data /dev/yfs/lun2 -system-data /dev/yfs/lun3（？？）,3、入参和data相同,4、不指定该参数 --报错||
||--vote|1、不指定该参数,2、指定该参数 --报错||
||--ycr|1、不指定该参数,2、指定该参数 --报错||
||au_size/disk_size |正常值    
  超范围33M,disk_size （10M）    
  0    
  空 ||
||卸载|yasboot卸载||
|toml配置|system.diskgroup 模块配置|1、redundancy ,1. NORMAL：对应sytemdisk数量：1，3，5，6，空
,    1）数量为1正常的情况下：system.disk 配置中disk路径软连接正常，name命名、空、正常/不正常、disk路径写真实路径，非软连接（正常）、空、特殊符号,    EXTERNAL：对应sytemdisk数量：1，3，5，6，空,    1）数量为3正常的情况下：system.disk 配置中disk路径软连接正常，name命名、空、正常/不正常、disk路径写真实路径，非软连接（正常）、空、特殊符号,    HIGH：对应sytemdisk数量：1，3，5，6，空,    1）数量为5正常的情况下：system.disk 配置中disk路径软连接正常，name命名、空、正常/不正常、disk路径写真实路径，非软连接（正常）、空、特殊符号,  2.入参错误：空（' '," ",null）、特殊符号（23@#￥%&*~）,2、name,其他配置正常，name小写system（对应修改ycs配置）、23@#￥%&*~、超长31、空,3、yfs_force_create,其他配置正常，yfs_force_create=true/false/空/null/字符串||
||ycs配置|1、YCR_DISK:已去除，校验不识别参数,2、VOTING_FILE_NAME、YCR_FILE_NAME,1. 默认不写配置
1. +system小写（对应上面的name为大写SYSTEM，不一致）
1. /dev/mapper/lun1 具体磁盘配置
1. +SYSTEM/ycr、+SYSTEM/voting
1. 空（' '," ",null）
1. 特殊符号（23@#￥%&*~）
1. 和DG命名不一致
||
||yfs配置|1、BOOT_DISK:已去除，校验不识别参数（不报错）配置不识别（和system不一致。）,（配置文件专门写错，然后执行安装，报错，修改正确后再次执行安装应正常安装）,2、group.yfsconfig（FILE_SIZE）,1.  0
1. 2M ，搭建不成功ycs拉不起，ycs日志
1. 3M，搭建起来，执行几个故障ycs场景。
1. 负数 -1
1. 空、特殊符号
||
|安装部署后的正常使用|  
|kill ycs,kill yascsm,kill db,磁盘埋点27 ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27',ddl、dml、dcl,ycsctl create cluster clustername  [-o],ycsctl     add     node     yas0   127  .0  .0  .1  :3001   ,ycsctl     add     yasdbinstance     yas2  .yasdb     start_instance  .sh     stop_instance  .sh     monitor_instance  .sh||
|日志|  
|启动，搭建等报错时看日志是否有具体报错||
|资料|  
|disk-found-path、system-data、toml配置||
|并发|报错|yasboot package ce gen、yasboot package install -t hosts.toml -i xx、yasboot cluster deploy -t yashandb.toml --yfs-force-create 3个命令各自并发和两两并发||


## **3.2 详细测试设计**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|否，本SR只针对om的部署，故障已在ycs支持多盘SR中覆盖|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


  


# **4. 测试用例**

[ycs支持多盘--om.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzFhMWFkOWEzMzExZGM5NzJhIiwicmVmX2lkIjoiNjczOTZlNzE3MjgyMDZlZmI5MmYyODFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTU2LCJleHAiOjE3ODI0NTg1NTZ9.ryl_kckvGg58gNqnVKw2c3fVCydgkljAekTY61_rfrs)

  


|冒烟用例|  
|  
|
|---|---|---|
|yasboot package ce gen |disk-found-path|入参格式：,’‘、” “、null、特殊字符’@#@￥#%……&*111‘、/dev/yfd_path （软链接）–正常、/dev/yfs(存在且合法的目录，且目录下要有磁盘)、/dev/yfd_path_no(目录下没有内容)、/dev/yfd_path_no(有内容但不是磁盘)|
||system-data|入参格式：,’‘、” “、null、特殊字符’@#@￥#%……&*111‘,2、盘入参数量：,多个systemdata入参：1、3、5、6（6报错）,-system-data /dev/yfs/lun1, /dev/yfs/lun2, /dev/yfs/lun3（正常冗余度根据盘决定）|
|toml配置|ycs配置|VOTING_FILE_NAME、YCR_FILE_NAME,1. 空（' '," ",null）
1. 特殊符号（23@#￥%&*~）
|
||yfs配置|group.yfsconfig（FILE_SIZE）,1. 负数 -1
1. 空、特殊符号
|


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

测试环境：4节点单主机磁阵环境+4节点多主机磁阵环境+主备ha集群

# **7. 工作量评估**

工作量：6人天

计划测试完成时间：2024/7/19

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

## Attachments:

[ycs支持多盘--om.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzFhMWFkOWEzMzExZGM5NzJhIiwicmVmX2lkIjoiNjczOTZlNzE3MjgyMDZlZmI5MmYyODFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTU2LCJleHAiOjE3ODI0NTg1NTZ9.ryl_kckvGg58gNqnVKw2c3fVCydgkljAekTY61_rfrs)

 (application/x-xmind)    


## Comments:

|  [](null)  ,一、会议时间：2024/7/5 周五 10:00-11:00    
  二、会议地点：线上会议    
  三、会议主持人：张茜    
  四、参会人员：李垠、马勇、瞿蓝孟、徐凡博、张茜    
  五、会议主题：om适配ycs多盘安装部署--测试设计评审    
    
  会议纪要：    
  1、VOTING_FILE_NAME、YCR_FILE_NAME和DG配置一致就可以，不一定要是SYSTEM才行    
  2、YCR/VOTING文件拓展大小需要配置3M以上才能搭建成功    
    
  测试设计文档：    
    [https://conf.yasdb.com/pages/viewpage.action?pageId=159418908](https://conf.yasdb.com/pages/viewpage.action?pageId=159418908)  ,Posted by zhangqian at 七月 29, 2024 15:04|
|---|
