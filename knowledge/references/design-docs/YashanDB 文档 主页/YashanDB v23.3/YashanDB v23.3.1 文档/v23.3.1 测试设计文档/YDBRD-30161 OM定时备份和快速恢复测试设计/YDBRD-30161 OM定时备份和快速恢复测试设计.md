Created by 李世铭, last modified on 八月 13, 2024

# 1. 概述

OM高可用，支持定期备份，在OM异常无法启动后在异地快速恢复。

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/668cdb6e288e197820b8e277](https://pingcode.yasdb.com/pjm/items/668cdb6e288e197820b8e277)    ?    
  #YDBRD-30161 【OM】定时备份，支持OM异常无法启动后在异地快速恢复

设计文档：    [YDBRD-30161 OM定时备份和快速恢复 (old)](/pages/createpage.action?spaceKey=YAS&title=YDBRD-30161+OM%E5%AE%9A%E6%97%B6%E5%A4%87%E4%BB%BD%E5%92%8C%E5%BF%AB%E9%80%9F%E6%81%A2%E5%A4%8D+%28old%29)  

## 2.1 功能点分析

- 支持yasom主备，可以拉起一个primary yasom和多个secondary
- 定期同步数据


![](https://conf.yasdb.com/download/attachments/159445172/OM%E5%BF%AB%E9%80%9F%E6%81%A2%E5%A4%8D-syncManager.svg?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE5NjcsImV4cCI6MTc4MjM4Mjc2N30.r15PbFWtnDlwoBZ6i04rkK6LYCo6JuJU7gQifygFDxQ)

父任务主动触发同步配置项

```
sync_mode = "async"
# 默认为async，非法值统一为async。
# async：下发备份即可，不理会是否成功。后续有轮询失败节点的操作。
# sync_half：大于一半节点同步备份。如果是2个节点的话，则需要所有节点都同步到。
sync_retry_time = 3
# 如果失败，则重试，sync_half的时候生效

# 如果同步失败了，则父任务仍然是成功，提示一个warning。
```

  


- 定期删除备份


```
[backup]
  # 配置错误的时候，会导致yasagent无法拉起，报错信息在yasagent.log中查看
  max_age = "7d"	# 最长保存时间。d表示天，h表示小时，m表示分钟，s表示秒。
  max_num = 3		# 最小保存份数，不允许小于3
  interval = 30 	# 清理的时间间隔
```

- 新增yasboot process yasom recover命令，用来恢复yasom或者备升主


|字段|含义|
|:---|:---|
|-c, --cluster|集群名称|
|--role|拉起的yasom的角色，默认为secondary。可选值[primary, secondary]|
|-m, --meta|sqlite文件的导出路径，默认在om/{cluster}/data/backup/meta.sql.{term}.{seq}。如果没有填写，则默认使用这台机器上最新的meta文件。|
|-l, --listen|yasom的监听地址。如果是从secondary->primary，则不需要填写。|
|-f, --force|直接恢复，不需要确认。但无法跳过|
|--force-create|忽略最新备份集不在该机器，直接拉起yasom。|


- 新增yasboot process yasom clean命令，清理yasom


|字段|含义|
|:---|:---|
|-c，--cluster|集群名|


限制：

1. 支持清理secondary yasom，清理不受限制。
1. 当前机器的yasom并不是自己承认的primary yasom，支持清理。
1. 支持清理primary yasom。仅在存在多主才允许操作。


- 新增yasboot process yasom sync命令，用于同步主节点的env文件


|字段|含义|
|:---|:---|
|-c, --cluster|集群名称|


- yasboot process yasom status显示改造


原来展示的结果：

```
./bin/yasboot process yasom status -c minidb
 hostid | pid | run_user | listen_address     | run_path                                                    | log_path                                                                  
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 -      | off | -        | 192.168.7.203:6675 | /home/huangsiyuan/yashandb_home/yashandb/23.2.4.5/bin/yasom | /home/huangsiyuan/yashandb_home/yashandb/23.2.4.5/om/minidb/log/yasom.log 
--------+-----+----------+--------------------+-------------------------------------------------------------+---------------------------------------------------------------------------
```

预计改造后：

```
hostid: 主机id
pid: pid
ip_addr: 主机的ip
primary: 认定的主
secondary: 认定的备
local_yasom_addr: 当前的yasom的地址，如果不存在为-
role: yasom的角色，primary | secondary | -
backup_num: 备份集数量
max_seq: 备份集最大的版本号

$ ./bin/yasboot process  yasom status -c minidb
 hostid   | pid   | ipaddr         | primary             | secondary | local_yasom_addr    | role    | backup_num | max_seq 
----------------------------------------------------------------------------------------------------------------------------
 host0001 | off   | 192.168.7.203  | 192.168.18.167:6675 | []        | -                   | -       | 3          | 41      
----------+-------+----------------+---------------------+-----------+---------------------+---------+------------+---------
 host0002 | 11241 | 192.168.18.167 | 192.168.18.167:6675 | []        | 192.168.18.167:6675 | primary | 3          | 41      
----------+-------+----------------+---------------------+-----------+---------------------+---------+------------+---------
 host0003 | off   | 192.168.3.149  | 192.168.18.167:6675 | []        | -                   | -       | 3          | 41      
----------+-------+----------------+---------------------+-----------+---------------------+---------+------------+---------
```

## 2.2 应用场景

OM异常无法启动后在异地快速恢复

## 2.3 约束

1. 一台机器上一套集群只能有一个yasom，secondary/primary yasom。
1. 一个集群的secondary yasom允许有多个。
1. 如果secondary yasom还能和primary yasom通信，则无法升主。
1. recover支持将secondary yasom -> primary yasom，0 -> primary yasom。


# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


**参数检查**

|命令|参数|测试点|  
|
|---|:---|:---|:---|
|yasboot process yasom recover|--role|默认值|secondary|
|  
|  
|取值范围|[primary, secondary]|
|  
|-m, --meta|默认值|om/{cluster}/data/backup/meta.sql.{term}.{seq}，默认使用最新的sql文件|
|  
|  
|取值范围|正确的om sql文件路径|
|  
|-l, --listen|默认值|如果是从secondary→primary，则不需要填写，如果是从0->primary或0->secondary，需要填写|
|  
|  
|取值范围|本机可以绑定的ip地址|
|  
|-f, --force|默认值|默认不加--force|
|  
|  
|取值范围|加--force跳过确认，不加需要确认|
|  
|--force-create|默认值|默认不加--force  -create|
|  
|  
|取值范围|加--force  -create不检查是否最新备份集  ，不加--force-create如果不是最新备份集不能拉起yasom|
|环境变量|YASDB_CONNECTED_OM_ADDR|取值范围|[ip:port]或[0,备yasom数量]|
|备份保存策略|max_age |默认值|7d|
|  
|  
|取值范围|最长保存时间。d表示天，h表示小时，m表示分钟，s表示秒|


  


**场景组合**

|测试点|测试项|  
|  
|
|:---|:---|:---|:---|
|拉起备yasom|正常拉起备yasom|部署集群后，在host002拉起备yasom|通过修改环境变量连接，执行需要写om数据库的操作拦截，执行不需要写om数据库的操作成功|
|  
|重复拉起yasom|部署集群后，在host002拉起备yasom，再次执行拉起主/备yasom|重复拉起yasom报错|
|拉起主yasom|集群正常时，拉起主yasom|部署集群后，在host002拉起主yasom|报错可以连接到主yasom|
|  
|隔离主yasom，备yasom升主|部署集群后，在host002拉起备yasom，隔离host001，在host002执行yasom recover|升主成功，可以执行job add|
|  
|隔离主yasom，拉起主yasom|部署集群后，隔离host001，在host002拉起主yasom |可以成功拉起主yasom，可以执行job add|
|异常状况下恢复主yasom|  
|1.部署集群后，node add后，同步备份集时kill 主yasom,2.恢复host001，重新拉起主yasom|om状态恢复正常|
|清理yasom|清理主yasom|部署集群后，在host002拉起备yasom，尝试清理host001 yasom|报错不可以清理主yasom|
|  
|清理备yasom|部署集群后，在host002拉起备yasom，尝试清理host002 yasom|清理成功|
|  
|没有yasom的host执行|  
|直接返回成功|
|同步env|  
|1.部署集群后，隔离host003，在host002拉起备yasom，恢复host003,2.执行env同步 |1.查看yasom状态，host003没有正确的备机信息,2.同步后，host003可以正确显示备机信息|
|双主|构造双主并清理一个主|1.部署集群后，执行node add，并在同步备份集时隔离host001，node add操作没有同步到备机,2.host002拉起主yasom，执行job add,3.恢复host001，查看asboot process yasom status,4.清理host002 yasom，执行yasboot process yasom sync|1.没有同步备份集到备机,2.主yasom拉起成功，job add成功,3.可以看到有两个主yasom，并且host001和host002认定的主不同,4.清理时给出  每个主om的incr值和节点数量信息，清理host002成功，执行env同步成功，查看yasom状态，各个节点认定的主一致，om恢复正常|
|备份集清理|超过最长保存时间，没有超过最小保存份数|  
|不清理|
|  
|没有超过最长保存时间，超过最小保存份数|  
|不清理|
|  
|超过最长保存时间，且超过最小保存份数|  
|清理|
|主动同步模式|async|同步备份集时隔离主机|命令返回成功|
|  
|sync_half|1.同步备份集时隔离主机,2.设置  sync_retry_time=5，同步备份集时隔离主机|1.命令返回warning，备份集同步失败，查看日志有3次重试,2.命令返回warning，备份集同步失败，查看日志有5次重试|
|升级|拉起备yasom后升级|部署集群后，在host002拉起备yasom，执行package upgrade/rollback|备yasom可以正常升级、回退|
|failover|隔离后执行failover|部署集群后，隔离host001，在host002拉起主yasom，执行node failover|failover成功|


# 4. 测试用例

  [OM定时备份和快速恢复文本用例](162999585.html)  

# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：8/19

## Comments:

|  [](null)  ,会议纪要,时间 2024/08/12 与会人：瞿蓝孟、黄思源、刘美秀、李世铭,1.增加隔离后拉起主yasom后node failover测试,2.测试max_age设置各种单位是否可以正确生效,3.测试同步备份集时kill主yasom，重新拉起主yasom是否可以恢复正常,4.测试package rollback，备yasom是否可以正确回退,Posted by lishiming at 八月 12, 2024 15:51|
|---|
