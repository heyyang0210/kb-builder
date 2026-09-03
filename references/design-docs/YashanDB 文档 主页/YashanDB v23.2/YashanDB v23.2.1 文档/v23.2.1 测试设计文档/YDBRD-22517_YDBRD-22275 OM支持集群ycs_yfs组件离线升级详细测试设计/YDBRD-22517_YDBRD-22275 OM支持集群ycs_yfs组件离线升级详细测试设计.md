Created by 李世铭 on 一月 31, 2024

# 1. 概述

支持从当前版本开始，后续版本支持集群管理服务（YCS）离线升级的能力。

# 2. 需求分析

SR：    [YDBRD-22275](https://jira.yasdb.com/browse/YDBRD-22275?src=confmacro)    -  【OM】支持集群ycs/yfs组件离线升级  完成    [YDBRD-22517](https://jira.yasdb.com/browse/YDBRD-22517?src=confmacro)    -  ycs支持集群升级  完成

设计文档：    [【OM】YCS离线升级](141587218.html)  

  [【OM】YCS离线升级](141587218.html)  

## 2.1 功能点分析

升级流程

**upgrade_node_prepare**

- 在每一台主机上执行。
- 在新版本的目录下创建upgrade_tmp。
- **在新版本的目录下创建upgrade_tmp/ycr目录，作为 YAC_YCR_BACKUP_FILE 环境变量**


**exec_yac_shell**

- 在每个节点上执行。
- 执行yac_precheck.sh。（小版本和相同版本不存在这个文件，不需要执行，下面同理）


**upgrade_node_before**

- 在第一个节点上执行。
- 执行preupgrade.sql文件。


**exec_yac_shell**

- 在每个节点上执行。
- 执行yac_preupgrade.sh文件。


**upgrade_ce_backup**

- 在不执行升级脚本的节点中执行。
- 停止当前节点。


**upgrade_ce_backup**

- 执行shutdown+备份。
- control文件：共享。    `SELECT VALUE FROM V$PARAMETER WHERE NAME = 'CONTROL_FILES';`  
- system文件：共享。    `SELECT D.NAME FROM V$DATAFILE AS D, V$TABLESPACE AS T WHERE T.NAME='SYSTEM' AND T.ID = D.TS#;`  
- redo文件：只备份当前节点的。    `SELECT NAME FROM V$LOGFILE;`  
- undo文件：备份所有节点的。    `SELECT D.NAME FROM V$DATAFILE AS D, V$TABLESPACE AS T WHERE T.NAME like 'UNDO%' AND T.ID = D.TS#;`  


**exec_yac_shell**

- 在每个节点上执行。
- 执行yac_upgrade.sh文件。


**upgrade_node**

- 补充新版本缺少的目录。
- 只对一个节点执行：nomount状态，进去升级模式，执行升级。


**exec_sql**

- 执行exit upgrade mode。执行退出升级模式。


**start_upgrade_node**

- 对其他节点拉起到open状态。


**exec_yac_shell**

- 每个节点执行。
- 每个节点执行yac_postcheck.sh


回滚流程

**rollback_host**

停止节点

**exec_yac_rollback**

如果存在备份目录的话，需要执行shell脚本。

**rollback_ce_file**

（只有一个节点会真正执行）

如果这个节点存在备份数据，则进行恢复。

1. 拉起该节点。执行ycsctl stop instance停止db。
1. 恢复DB元数据。
1.     - 使用yfscmd rm删除掉原有的数据
    - 使用yfscmd cp将备份的数据拷贝过来

1. 停止ycs。


**rollback_node**

重新拉起节点，共享集群的话不再执行恢复DB元数据的操作。

## 2.2 应用场景

主要用于共享集群数据库升级

## 2.3 约束

- 必须在集群正常运行时升级
- 升级过程不允许其他运维操作
- 只支持下个版本及以后的升级，不支持之前版本的升级


# 3. 详细测试设计

## 3.1 测试设计方法

业务校验，交互验证-场景组合

流程验证–路径覆盖

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
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

  


# 5. 测试框架设计

install_test测试框架，需要根据需求补充功能

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.3.198|32G|700G|SSD|8核|centos7.0|
|192.168.3.140|32G|900G|SSD|8核|centos7.0|


# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：2/2

  


## Attachments:

[YDBRD-22517 OM支持集群ycsyfs组件离线升级文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjBhMWFkOWEzMzExZGM4NGM3IiwicmVmX2lkIjoiNjczOTZiYjA3MjgyMDZlZmI5MmYwOTBhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzM1LCJleHAiOjE3ODIzODI3MzV9.t07J63G3dSoNMT3A0zt1YYIahXJHD2p5FWnWNYDDk1Q)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[OM支持yac升级.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjBhMWFkOWEzMzExZGM4NGM4IiwicmVmX2lkIjoiNjczOTZiYjA3MjgyMDZlZmI5MmYwOTBhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MzM1LCJleHAiOjE3ODIzODI3MzV9.gn5pVh_8L7pbKS3c9R5K8cuVwolQp9KcsiiwuBymlh0)

 (application/x-xmind)    


## Comments:

|  [](null)  ,会议纪要 时间：2024/1/31 参与人：施新华、朱立国、李世铭、瞿蓝孟、黄思源、陈步隆、许中立、杜宇轩,1.在升级流程的每个阶段制造故障测试升级失败回退,2.升级后增加健康检查,3.升级后执行业务检查是否正常,4.目前只有一个版本，无法验证升级脚本，可以先把元数据检查加入ci，等出新版本后可以直接进行检查,Posted by lishiming at 一月 31, 2024 16:16|
|---|
