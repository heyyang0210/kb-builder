Created by 李世铭, last modified by  朱立国 on 一月 24, 2024

# 1. 概述

由于网络部署调整、机房搬迁、网络故障等带来主机IP地址变更，  当数据库的IP发生变更，OM工具需要支持快速更换IP的能力。

目前只支持单机形态。

新增命令进行IP更换。

# 2. 需求分析

SR：    [YDBRD-25038](https://jira.yasdb.com/browse/YDBRD-25038?src=confmacro)    -  【OM】支持一键式更新数据库和OM的IP更换  完成

设计文档：    [支持一键式更新数据库和OM的IP更换 设计方案](141570122.html)  

概要设计：    [YDBRD-23829 OM支持一键式更换IP概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141568032)  

## 2.1 功能点分析

- 新增  ipchange yasom命令，用来修改yasom的ip


|长参|短参|含义|限制|
|---|---|---|---|
|--toml|-t|安装om时使用的hosts.toml文件|必填|
|--new-ip|-n|新ip|  
|


- 新增  ipchange yasagent命令，用来修改yasagent的ip


|长参|短参|含义|限制|
|---|---|---|---|
|--new-ip|-n|新ip|  
|
|--toml|-t|安装om时使用的hosts.toml文件|必填|
|--host-id|  
|替换指定hostid机器上的yasgaent|  
|


- 新增  ipchange host命令，用来修改数据库节点的ip


|长参|短参|含义|限制|
|---|---|---|---|
|--start|-s|更换ip后启动集群|  
|
|--toml|-t|安装om时使用的hosts.toml文件|必填|
|--host-id|  
|需要替换集群ip的主机id|  
|
|--replica-ip|-r|新的replication addr|  
|
|--listen-ip|-l|新的listen addr|  
|
|--replica-cidr|-rc|新的replication cidr |  
|
|--listen-cidr|-lc|新的listen cidr|  
|


替换ip流程：

1. 替换yasom ip
1. 替换yasagent ip
1. 替换host ip
1. 重启集群


流程限制逻辑：

1. om必须可用，才有能力去更换yasagent。假如om的ip不可用，则需要更换om的ip。更换后会重启om，使om可用。
1. 每个yasagent都必须可用，才有能力去更换host上的db。按照背景，至少会有一台机器ip不可用，使yasagent的ip不可用。所以至少需要更换一次yasagent，使所有yasagent可用，每次更换都会重启当前yasagent。
1. om、yasagent都可用了，此时才有能力更换db。以主机为单位，修改主机上的db节点，每次修改前都会停止db节点。
1. 等所有host更改完成后，启动db节点，此时集群可用。


## 2.2 应用场景

1)  网络部署调整，机房搬迁，网络故障带来主机IP变化；

2）数据库的IP出现变化。

## 2.3 约束

1) 本次只实现单机部署更换IP，分布式和共享集群不支持。

2) 目前只支持更换ip，不支持更换端口

3) 无法自动修改白名单配置，如果开启白名单后更换ip可能会出现无法连接数据库的情况，需要重新手动设置白名单

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


# 4. 测试用例

详见附件

# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


需要另外创建虚拟机以便进行更换ip测试

# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：1/26

## Attachments:

[OM支持一键式收集trace.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmI4OTcwYzJhZjRmNTIwNmExIiwicmVmX2lkIjoiNjczOTZiYmI1OTNmOTljOWZmMjM2NjZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjAzLCJleHAiOjE3ODIzODMwMDN9.0aUu7ooePyu-4A5jdNwsyyPeKVWPfUX1kNlqQ71FOGw)

 (application/x-xmind)    


[OM支持一键式更换IP详细测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmJhMWFkOWEzMzExZGM4NTE3IiwicmVmX2lkIjoiNjczOTZiYmI1OTNmOTljOWZmMjM2NjZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjAzLCJleHAiOjE3ODIzODMwMDN9.ORk-udyJUtTD4KHGdlyDFaK6KpxGss5U4wYhHpP8WLw)

 (application/x-xmind)    


[YDBRD-25038 OM支持一键式更换IP文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmJhMWFkOWEzMzExZGM4NTE5IiwicmVmX2lkIjoiNjczOTZiYmI1OTNmOTljOWZmMjM2NjZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjAzLCJleHAiOjE3ODIzODMwMDN9.5h-J4EgGpLNBkpOQmCm3hSWgjCBf_foGdEIMvszT_3g)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-25038 OM支持一键式更换IP文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmI4OTcwYzJhZjRmNTIwNmEzIiwicmVmX2lkIjoiNjczOTZiYmI1OTNmOTljOWZmMjM2NjZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjAzLCJleHAiOjE3ODIzODMwMDN9.XAc_kbZbwSHQRZt-FLh6MkIMD-9GXZofjhhjJXj8f9c)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[OM支持一键式更换IP详细测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYmI4OTcwYzJhZjRmNTIwNmE0IiwicmVmX2lkIjoiNjczOTZiYmI1OTNmOTljOWZmMjM2NjZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NjAzLCJleHAiOjE3ODIzODMwMDN9.u6hBoQ2eZo9zDuc0iCWw4A0ht3lEeV3Abf48vCV_hlw)

 (application/x-xmind)    


## Comments:

|  [](null)  ,评审纪要 时间：2024/1/24 参与人：施新华、朱立国、瞿蓝孟、刘顺鹏、李世铭,1.需要同开发明确更换ip流程与执行顺序限制机制,2.更换ip命令有部分参数改动，需要开发修改设计文档后更新用例,3.需要使用yasboot cluster status命令检查数据库ip是否更换正确,4.需要检查新ip的原端口被占用的情况下是否有相应错误处理,Posted by lishiming at 一月 24, 2024 17:46|
|---|
|  [](null)  ,修改：1.开发提供更换ip流程与执行顺序限制规则，不满足规则更换IP应返回相应报错提示信息,Posted by lishiming at 一月 24, 2024 18:42|
