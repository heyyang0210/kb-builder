Created by 李世铭, last modified on 六月 07, 2024

# 1. 概述

OM支持分布式小版本在线滚动升级，  在不影响业务的前提下进行升级，保证在升级过程中每个group至少有一个节点在open状态

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/661e7b28fd997db58adaea43](https://pingcode.yasdb.com/pjm/items/661e7b28fd997db58adaea43)    ?    
  #YDBRD-26446 【Om】支持分布式在线滚动升级

设计文档：    [【OM】支持分布式在线滚动升级](152997485.html)  

## 2.1 功能点分析

- 支持分布式在线滚动升级
-     1. 升级各MN组（参考DN组升级）
    1. 升级各DN组（DN组做成并行升级，OM任务最大的并发量是10）
        1. 关闭各节点自动选举开关（先备后主）。
        1. 两节点在最大可用模式下执行滚动升级，三节点及以上不修改保护模式（先主后备）。
        1. 关闭备库。
        1. 用新版本拉起备机，等待备节点同步完（select * from v$replication_status; apply_lag < 1s, connection, status）
        1. 重复步骤三，四，依次将同一组内所有备机升级完毕。
        1. 选择一个备节点进行switchover升主，等待启动完成
        1. 将旧主（备节点）进行步骤三，四的操作。
        1. 恢复原自动选举开关（先主后备）。恢复保护模式（先主后备）。
        1. 根据--keep-primary参数决定是否切回原主。
    1. 依次升级CN节点。
        1. 执行shutdown immediate方式，快速关闭，尽量减少关闭时间。
        1. 升级前备份（冷备份，用于回退，CN节点是否需要备份）
        1. 用新版本拉起CN节点。（CN不需要等待同步）

- 升级失败后支持滚动回退
-     1. 回滚MN
    1. 回滚DN
        1. 主节点是旧版本
            1. 找出挂了的备节点和新版本的备节点。
            1. 依次用旧版本拉起节点。
            1. 恢复节点升级前的HA和保护模式。
        1. 主节点是新版本
            1. 选定一个旧版本的节点切换为主节点（挂了的节点 or 旧版本的节点）。
            1. 依次用旧版本拉起节点。
            1. 恢复节点升级前的HA和保护模式。
    1. 回滚CN（依次回滚）
        1. 停止新版本的CN
        1. 用旧版本拉起CN节点

- 原有命令不变，放开对分布式滚动升级的拦截
    - cluster upgrade
    - cluster rollback


|参数|含义|
|:---|:---|
|--keep-primary|保留主节点|
|--rolling|滚动升级|


|参数|含义|
|:---|:---|
|--rolling|滚动升级，不能和force一起使用|


## 2.2 应用场景

主要验证在升级时执行业务，业务可以报错但是数据不会出错

## 2.3 约束

1. 不允许扩缩容。
1. 升级前各节点运行正常。
1. MN组和DN组至少有两个节点。


# 3. 详细测试设计

## 3.1 测试设计方法

参数检查——边界值，等价类

功能验证——场景组合 

|系统级DFX分类|是否涉及|
|:---|:---|
|长稳|否|
|性能|否|
|安全|否|
|可维护性|是|
|压力|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|一致性|否|
|KT|否|
|HA|是|
|DFR|否|
|CT|否|


**场景组合**

|测试项|场景|  
|
|:---|:---|:---|
|升级|正常执行滚动升级|可以升级成功，升级过程中持续查看集群状态，每个组至少一个节点open|
|  
|升级过程中持续执行业务|业务可以出错，但是根据业务成功和失败的结果，数据符合预期|
|  
|在不同保护模式下升级|最大保护/最大性能/最大可用|
|  
|打开/关闭自选举升级|  
|
|  
|local模式部署进行滚动升级|  
|
|回退|在停止节点前kill yasdb旧版本备节点|升级报错，可以滚动回退|
|  
|在停止节点前kill yasdb旧版本主节点|升级报错，滚动回退拦截，可以常规回退|
|  
|用新yasdb拉起节点后，alter database前kill yasdb|升级报错，可以滚动回退|
|  
|用新yasdb拉起节点后，alter database后kill yasdb|升级报错，滚动回退拦截，可以常规回退|
|  
|升级过程中kill yasom|升级报错，重新拉起后yasom可以滚动回退|
|  
|升级过程中kill yasagent|升级报错，重新拉起后yasagent可以滚动回退|
|  
|升级出错回退后可以重新升级|  
|
|升级后检查|升级后系统创建对象元数据符合预期|  
|
|  
|升级后实例重启正常|  
|
|  
|升级后备份及恢复正常|  
|
|  
|升级后保护模式与升级前保持一致|  
|
|  
|升级后自选举设置与升级前保持一致|  
|
|  
|升级后用户数据与升级前一致|  
|
|  
|升级后可以正常执行扩缩容|  
|
|  
|升级后swichover正常|  
|
|升级前检查|大版本执行滚动升级|拦截|
|  
|扩缩容后执行滚动升级|~~拦截 ~~  正常升级|
|  
|扩容后等待数据同步时执行滚动升级|拦截|
|  
|mn组/dn组其中一个组只有一个节点|拦截|
|  
|cn组只有一个节点|正常升级|
|  
|升级前kill部分节点|拦截|
|  
|开启OM仲裁后升级|拦截|
|  
|加--keep-primary参数是否切回原主|  
|


升级拦截扩缩容/重分布

1主32备8cn测试

滚动升级后开启monit检查功能是否正常

**部署规模**

|场景|规模|
|---|---|
|普通用例|3mn3cn3-3dn|
|非HA拦截|1mn3cn3-3dn|
|  
|3mn3cn1-1dn2-3dn|
|  
|3mn1cn3-3dn|


# 4. 测试用例

# 5. 测试框架设计

install_test测试框架

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：6/12

## Attachments:

[YDBRD-26446 OM支持分布式在线滚动升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDY4OTcwYzJhZjRmNTIwZmU1IiwicmVmX2lkIjoiNjczOTZkMDY3MjgyMDZlZmI5MmYxYTE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MzM3LCJleHAiOjE3ODIzOTE3Mzd9.aKfhQGTVqpcUE9uD3_XX0YxtXhaE9jLwDF2oat_7hls)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要,时间 2024/06/07 参与人：刘美秀、瞿蓝孟、黄思源、李世铭,1.验证扩容后后台执行数据同步任务时是否拦截滚动升级,2.验证升级时拦截扩缩容命令,3.验证最大部署规模下可以正常滚动升级：1主32备8cn,4.滚动升级后开启monit功能检查功能是否正常,Posted by lishiming at 六月 07, 2024 15:29|
|---|
