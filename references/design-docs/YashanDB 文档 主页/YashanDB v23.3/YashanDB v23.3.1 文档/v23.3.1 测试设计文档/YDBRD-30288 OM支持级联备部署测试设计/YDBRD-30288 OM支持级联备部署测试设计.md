Created by 李世铭, last modified on 八月 08, 2024

# 1. 概述

db一直支持级联备部署，但是OM还没有适配，OM在这个需求适配级联备部署

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/6690918f288e197820ba894d](https://pingcode.yasdb.com/pjm/items/6690918f288e197820ba894d)    ?    
  #YDBRD-30288 【OM】支持单机主备模式的级联备部署

设计文档：    [om支持级联备部署](162988659.html)  

## 2.1 功能点分析

- yasboot package se gen新增cascaded-node和cascaded-parent参数


|参数|限制|默认值|取值范围|含义|
|---|---|---|---|---|
|--cascaded-node|选填|0|[0,32-备节点数]|级联备节点个数|
|--cascaded-parent|选填|最后一个备节点|[1,备节点数]|级联备绑定备节点|


支持生成带有级联备节点的配置文件，所有级联备绑定在一个备节点上，安装部署流程没有变化

- cluster status命令的展示结果新增source_node字段，展示级联备节点绑定的备节点node id，级联备的database_role字段展示为standby（cascade）


## 2.2 应用场景

单机HA异地部署，对异地备机进行级联备

## 2.3 约束

- 只考虑一个备机绑定级联备，多个备机绑定级联备暂不考虑
- 不支持开启自选主
- 不支持开启OM仲裁


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

|参数|测试点|  
|
|---|---|---|
|cascaded-node|默认值|0|
|  
|取值范围|[0, 32-备节点数]|
|cascaded-parent|默认值|备节点数|
|  
|取值范围|[1, 备节点数]|


**场景组合**

|测试点|测试项|  
|  
|
|---|---|---|---|
|部署|正常部署|一主二备二级联，生成配置文件并部署|可以正常部署，部署后cluster status查询集群状态显示正确|
|  
|测试最大规模部署|一主二备三十级联备，生成配置文件并部署|可以正常部署，部署后cluster status查询集群状态显示正确|
|  
|部署指定级联备的父节点|一主三备二级联，指定cascaded-parent为1，部署后检查集群状态|可以正常部署，部署后cluster status查询集群状态显示正确，级联备绑定在第二个备节点|
|OM基础功能|启停|cluster/group/node start/stop/restart|可以正常启停，重新拉起后cluster status查询集群状态显示正确|
|  
|设置密码|cluster password set|级联备节点密码成功修改|
|  
|monit|monit start|正确开启级联备节点的monit，并且kill 级联备节点可以自动拉起|
|  
|配置参数|修改级联备配置参数，修改后查询|成功修改级联备的配置参数，修改后查询级联备的配置参数符合预期|
|  
|主备切换|可以切换到普通备|切换后cluster status查询集群状态显示正确|
|  
|  
|可以切换到级联备|切换后cluster status查询集群状态显示正确    不可以直接switchover到级联备|
|  
|yasdb process start|  
|  
|
|  
|yasbak 备份恢复  | |资料约束  --级联备需要手动恢复|
|  
|yasbak reset|  
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
|扩缩容|扩容普通备|可以扩容普通备机|扩容后cluster status查询集群状态显示正确|
|  
|缩容普通备|删除不带级联备的备机|缩容后cluster status查询集群状态显示正确|
|  
|缩容带级联备的备机|删除带级联备的备机|报错|
|  
|缩容级联备|删除级联备节点|报错|
|  
|普通备加级联备数量到达上限后扩容|一主二备三十级联备，扩容普通备|报错，节点数已到达上限|
|升级|检查升级顺序|  
|关注升级模式退出顺序：备机-级联备-主机|


主节点故障failover   级联备可以连到父节点不能直接failover

# 4. 测试用例

  [OM支持级联备部署文本用例](162995232.html)  

# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：8/14

## Comments:

|  [](null)  ,会议纪要,时间：2024/8/8 与会人：瞿蓝孟、马志宏、施新华、高亚宁、李世铭,1.增加failover场景：不论主节点是否存在，级联备可以连到父节点不能failover，级联备连不到父节点可以failover,2.增加yasdb process start/stop/restart用例,3.增加yasbak备份恢复用例，yasbak restore清理所有节点数据，yasbak run --build-all只能恢复主备，级联备需要手动build database   --增加资料约束,4.switchover和failover增加node-id超出范围用例,Posted by lishiming at 八月 08, 2024 16:29|
|---|
