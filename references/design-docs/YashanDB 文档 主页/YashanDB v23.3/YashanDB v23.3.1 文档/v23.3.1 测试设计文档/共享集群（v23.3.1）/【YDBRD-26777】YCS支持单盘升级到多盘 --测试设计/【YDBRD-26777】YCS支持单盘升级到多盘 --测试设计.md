Created by 张茜, last modified on 九月 13, 2024

# **1. 概述**

本文描述共享集群  YCS  从裸盘升级到yfs管理的多副本  测试设计。

SR：        [https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2](https://pingcode.yasdb.com/pjm/items/662f3aedc36a3d30a85fc9d2)    ?    
  #YDBRD-26777 YCS支持单盘升级到多盘

开发设计文档：    [yfs管理ycs多副本升级详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159423809)  

  [YFS支持ycs裸盘升级到多盘 详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156120564)  

# **2. 需求分析**

## **2.1 功能点分析**

该需求主要实现：  一键升级多盘集群环境

## 基本功能特性

|功能|涉及接口|
|:---|:---|
|多盘升级命令|yasboot cluster upgrade --cluster yashandb|
|升级失败，手动回滚|sh yac_upgrade.sh|
|升级后集群正常使用|  
|
|  
|  
|


## **2.2 应用场景**

主要应用于共享集群实现一键升级多盘集群环境

## **2.3 规格约束**

- 部署形态：集群
- 节点个数：4节点，2节点（基础使用）
- 仅考虑23.3内部升级，即从23.3.0.6版本升级到23.3.0.y版本


# **3. 详细测试设计**

## **3.1 测试设计方法**

**./bin/yasboot package upgrade -t /home/yashan/install/hosts.toml -p yashandb-23.2.3.100.tar.gz  //原始命令，无需覆盖测试**

**yasboot cluster upgrade --cluster yashandb **

根据yasboot新增接口，主要根据错误推测法、场景法覆盖测试场景，以及设置后的功能正常:

1、yasboot命令测试：yasboot cluster upgrade --cluster yashandb 

/bin/  yasboot cluster upgrade --cluster yashandb --disk-found-path   /dev/  yfs --system-data   /dev/  yfs  /ycsdisk1,/  dev  /yfs/  ycsdisk2,  /dev/  yfs/ycsdisk3

**(此次是临时升级路径，回合master之后需要验证master直接升级、以及升级多盘之后的多盘到多盘升级)**

![](https://pingcode.yasdb.com/atlas/files/public/67396e748970c2af4f5218bf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIyMTgsImV4cCI6MTc4MjM4MzAxOH0.dwfZ7evHvfxBWH2wNvSdwtenRA5v8lMM635AbuNyIMA)

**2、环境形态：单机集群、多机集群**

测试场景主要有：

**升级为离线升级：（升级过程中会自动停止节点）**

**1、**  **集群所有节点在线升级，报错**

**      集群节点2在线，节点1离线，升级，报错节点状态异常，无法升级**

**      集群节点1在线，节点2离线，升级，报错节点状态异常，无法升级**

|测试对象|测试项|测试描述|详细测试内容|
|:---|:---|:---|:---|
|yasboot cluster upgrade --cluster yashandb     
    
    
    
    
    
|disk-found-path|1、异常入参格式：,’‘、” “、null，空、特殊字符’@#@￥#%……&*111‘、整型数字，-1,2、正常,/dev/yfsdata、不指定|  
    
    
    
    
|
||system-data|1、异常入参格式：,’‘、” “、null、特殊字符’@#@￥#%……&*111‘、整型数字，-1、入参和data相同、systemdata入参为6,2、正常场景：,多个systemdata入参：1、3、5,-system-data /dev/yfs/lun1, /dev/yfs/lun2, /dev/yfs/lun3（正常冗余度根据盘决定）,3、不指定该参数 （ 不报错，无默认值,升级过程中需要报错）,复用ycr、voting盘,冗余度是1即可,指定 之前的data盘,指定不同路径，比如：,disk-found-path  --/dev/mapper/,system-data  --/dev/mapper_1/||
||指定不识别参数|--ycr、--voting||
||卸载|yasboot卸载||
|升级失败回滚、  **集群有一定业务量，tpcc 300仓，kill主节点的yascs，恢复后**|升级失败回滚、修改失败后，继续升级，成功|1、执行yasboot命令之前，修改各个阶段的脚本，让其报错，失败回滚（手动）,yac_precheck.sh,yac_preupgrade.sh,yac_upgrade.sh,yac_rollback.sh,yac_postcheck.sh ,2、升级前，损坏磁盘(权限不足、升级过程中dd盘、断存储网络),升级前，损坏磁盘,3、修复磁盘/修改正常脚本后再次执行升级命令，正常升级||
||失败回滚后的集群正常使用、|正常启停,2节点串行启停，2节点并行启停,正常启停,4节点串行启停，4节点并行启停,yasboot node start -c yashandb -n 1-2 --disable &,yasboot node stop -c yashandb -n 1-2 ,kill ycs,kill yascsm,kill db,磁盘埋点27,ycsctl create cluster clustername [-o],ycsctl add node yas0 127.0.0.1:3001,ycsctl add yasdbinstance yas2.yasdb start_instance.sh stop_instance.sh monitor_instance.sh||
|升级成功后集群正常使用，心跳 3s，60s测试、  **集群有一定业务量，tpcc 300仓，kill主节点的yascs，恢复后**|  
|kill ycs,kill yascsm,kill db,磁盘埋点27 ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27',ycsctl create cluster test -o,ycsctl add node yas1 127.0.0.1:5005    
  ycsctl add yasdbinstance yas1.yasdb start.sh stop.sh monitor.sh    
  ycsctl add node yas2 127.0.0.1:5006    
  ycsctl add yasdbinstance yas2.yasdb start.sh stop.sh monitor.sh,ddl、dml、dcl,正常启停,执行ycs启动的guider自动化用例,执行ycr等相关用例,破坏1个副本,dd if=/dev/urandom bs=1K count=6 | yfscmd -D N1.ycs_home() cin -s 0-c 0 +SYSTEM/voting',破坏2个副本,破坏3个副本||
|并发|报错|yasboot cluster upgrade --cluster yashandb 纯并发,yasboot cluster upgrade --cluster yashandb和 yac_precheck.sh并发,yasboot cluster upgrade --cluster yashandb和 yac_preupgrade.sh 并发,yasboot cluster upgrade --cluster yashandb和 yac_upgrade.sh并发,yasboot cluster upgrade --cluster yashandb和 yac_rollback.sh并发,yasboot cluster upgrade --cluster yashandb和 yac_postcheck.sh并发,如果失败、手动回滚，再次yasboot cluster upgrade --cluster yashandb升级成功。||
|日志|  
|升级失败回滚报错时看日志是否有具体报错，在om日志中||
|资料|  
|yasboot cluster upgrade --cluster yashandb  命令及入参增加说明（--disk-found-path，--system-data）||


## **3.2 详细测试设计''**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是，升级成功后/失败回滚后的部分故障场景覆盖|
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

[om支持ycs升级多副本.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzNhMWFkOWEzMzExZGM5NzJlIiwicmVmX2lkIjoiNjczOTZlNzM3MjgyMDZlZmI5MmYyODI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjE4LCJleHAiOjE3ODI0NTg2MTh9.ZPrBtJO7CZ8HVLx78rllSOeuFh4piKSnKT6zqyqZe08)

冒烟用例：

前提，存在一定的数据

|yasboot cluster upgrade --cluster yashandb    
    
    
    
    
    
|disk-found-path|1、异常入参格式：,’‘、” “、null，空、特殊字符’@#@￥#%……&*111‘、整型数字，-1|  
    
    
    
    
|
|:---|:---|:---|:---|
||system-data|1、异常入参格式：,’‘、” “、null、特殊字符’@#@￥#%……&*111‘、整型数字，-1、入参和data相同、systemdata入参为6,复用ycr盘,指定目前集群的data盘--报错，手动回滚成功，再次升级正常||
|正常升级流程|disk-found-path、system-data|均不指定，升级过程中需要报错。手动回滚||
||disk-found-path、system-data|均指定/dev/mapper||
||disk-found-path、system-data|指定不同路径，比如：,disk-found-path  --/dev/mapper/,system-data  --/dev/mapper_1/||
|并发|报错|yasboot cluster upgrade --cluster yashandb 纯并发,yasboot cluster upgrade --cluster yashandb和 yac_precheck.sh并发,如果失败、手动回滚，再次yasboot cluster upgrade --cluster yashandb升级成功。||
|失败回滚及回滚后正常使用|  
|升级前，损坏磁盘(权限不足),yasboot启停、ycsctl启停正常,yasboot node start -c yashandb -n 1-2 --disable &,yasboot node stop -c yashandb -n 1-2 ||
|升级正常后的使用|  
|kill -9 yascs、ddl、dml操作||


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

测试环境：4节点单主机磁阵环境+4节点多主机磁阵环境+2节点环境

# **7. 工作量评估**

工作量：6人天

计划测试完成时间：2024/7/26

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

[om支持ycs升级多副本.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzNhMWFkOWEzMzExZGM5NzJlIiwicmVmX2lkIjoiNjczOTZlNzM3MjgyMDZlZmI5MmYyODI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjE4LCJleHAiOjE3ODI0NTg2MTh9.ZPrBtJO7CZ8HVLx78rllSOeuFh4piKSnKT6zqyqZe08)

 (application/x-xmind)    


[all_object_15210_select.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzNhMWFkOWEzMzExZGM5NzJmIiwicmVmX2lkIjoiNjczOTZlNzM3MjgyMDZlZmI5MmYyODI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjE4LCJleHAiOjE3ODI0NTg2MTh9.qqqJWOV3ygJsUfGNoA2UqJnHYgnFbZxJAEUz3vAbnpQ)

 (application/octet-stream)    


[all_object_15210_create.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzM4OTcwYzJhZjRmNTIxOGJkIiwicmVmX2lkIjoiNjczOTZlNzM3MjgyMDZlZmI5MmYyODI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjE4LCJleHAiOjE3ODI0NTg2MTh9.Bulsnax_kHxRTxUyvAbTa6S_Dt2wMHdzWw4G9enqc-s)

 (application/octet-stream)    


[all_object_15210_dml.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzNhMWFkOWEzMzExZGM5NzMwIiwicmVmX2lkIjoiNjczOTZlNzM3MjgyMDZlZmI5MmYyODI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMjE4LCJleHAiOjE3ODI0NTg2MTh9.1JbXRdkiiq9wky5PMQ6FT1WrX3LPQXDZeda4Wp-e5lA)

 (application/octet-stream)    


## Comments:

|  [](null)  ,复用ycr和voting盘，如果在盘不变的情况下，dd擦掉ycr voting信息之后，盘之后还能用吗？,Posted by zhangqian at 七月 19, 2024 15:59|
|---|
|  [](null)  ,一、会议时间：2024/7/15  15:00-16:00    
  二、会议地点：线上会议    
  三、会议主持人：张茜    
  四、参会人员：李垠、马勇、瞿蓝孟、徐凡博、张茜    
  五、会议主题：单盘升级多盘--测试设计评审,会议纪要：    
  1、升级暂不考虑主备集群,2、升级考虑带数据量测试,测试设计文档：    
    [【YDBRD-26777】YCS支持单盘升级到多盘 --测试设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159430428)  ,Posted by zhangqian at 八月 29, 2024 09:35|
|  [](null)  ,单盘升级到多盘加固场景：    
  1、带数据量升级失败、回滚及升级成功；    
  2、后台带业务升级失败、回滚及升级成功。（可能不支持，资料有明确限制，就想看下效果）    
  3、升级过程中，kill agent，回滚、启动agent再次升级    
  4、升级过程中，单机sudo reboot，多机中其中一个reboot    
  5、多机升级过程中（网路故障，断网卡、延迟）,Posted by zhangqian at 八月 29, 2024 15:32|
