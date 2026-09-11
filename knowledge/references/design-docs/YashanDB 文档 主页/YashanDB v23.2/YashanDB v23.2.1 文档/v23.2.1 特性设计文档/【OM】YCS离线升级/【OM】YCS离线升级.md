Created by 黄思源, last modified on 一月 23, 2024

*IR链接：*    [YDBRD-18799](https://jira.yasdb.com/browse/YDBRD-18799?src=confmacro)    *-*  *OM适配支持集群升级*  *完成*

*SR链接：*    [YDBRD-22275](https://jira.yasdb.com/browse/YDBRD-22275?src=confmacro)    *-*  *【OM】支持集群ycs/yfs组件离线升级*  *完成*

  


##   [1. 总述](#1-总述)  

在概要设计文档的基础上，进行详细设计。概要设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=138571200](https://conf.yasdb.com/pages/viewpage.action?pageId=138571200)  

###   [1.1 需求来源](#11-需求来源)  

支持从当前版本开始，后续版本支持集群管理服务（YCS）需要支持离线升级的能力。

###   [1.2 调研文档](#12-调研文档)  

略。

###   [1.3 需求分析](#13-需求分析)  

###   [1.3 需求分析](#13-需求分析-1)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|升级前检查|检查系统健康状态，是否适合进行升级|否|是|YDBRD-22517|
||升级前备份|对关键数据进行备份|是|是|YDBRD-22517|
||离线升级|离线完成整个集群升级|是|是|YDBRD-22517|
||升级后检查|检查系统是否升级成功|否|是|YDBRD-22517|
||升级异常回滚|升级过程中发生异常需要回滚到升级前的状态|是|是|YDBRD-22517|


##   [2. 接口](#2-接口)  

**升级**

yasom/yasagent升级：

```
yasboot package upgrade -c minidb

```

数据库升级：

```
yasboot cluster upgrade -c minidb

```

**回滚**

数据库回滚：

```
yasboot cluster rollback -c minidb

```

yasom/yasagent回滚：

```
yasboot package rollback -c minidb

```

##   [3. 规格与约束](#3-规格与约束)  

|规格、约束项|类型|规格、约束|原理说明|备注|
|---|---|---|---|---|
|离线升级|约束|集群运行状态正常才允许升级|升级前进行状态检查||
||规格|离线升级会造成业务中断，而且升级过程中业务无法连接使用|离线升级||
||规格|离线升级结束后，集群将恢复正式可用状态|升级完将重新拉起集群||
||规格|支持23.1.3.100及以后版本升级到23.2版本|只支持版本路径中的版本进行升级，去sics修改前版本不支持升级到当前版本||
||约束|升级过程中不允许其他运维操作|OM进行约束||
||规格|升级过程异常，需要手动执行回滚操作|OM命令||
||规格|回滚成功后，集群将恢复正式可用状态|回滚结束将重新拉起集群||
||规格|只支持共享集群自身版本升级，不支持单机升级为集群|||
||约束|升级只考虑23.2后的版本升级，不支持23.1升级|23.1不支持导入导出，暂不考虑回合|本设计预留设计，如后续市场有需求，可支持23.1升级|


##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

####   [升级](#升级)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c5da1ad9a3311dc89e5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA0MDksImV4cCI6MTc4MjMxMTIwOX0.Whi0itcNa2sMTwxitYP9mT63seEsvWKgfpr9rThEQCI)



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
- control文件：共享。    `SELECT VALUE FROM V$PARAMETER WHERE NAME = 'CONTROL_FILES';`  
- system文件：共享。    `SELECT D.NAME FROM V$DATAFILE AS D, V$TABLESPACE AS T WHERE T.NAME='SYSTEM' AND T.ID = D.TS#;`  
- redo文件：只备份当前节点的。    `SELECT NAME FROM V$LOGFILE;`  
- undo文件：备份所有节点的。    `SELECT D.NAME FROM V$DATAFILE AS D, V$TABLESPACE AS T WHERE T.NAME like 'UNDO%' AND T.ID = D.TS#;`  


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


####   [回滚](#回滚)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c5d8970c2af4f520b76/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA0MDksImV4cCI6MTc4MjMxMTIwOX0.Whi0itcNa2sMTwxitYP9mT63seEsvWKgfpr9rThEQCI)



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

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

[ycs离线升级.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWQ4OTcwYzJhZjRmNTIwYjczIiwicmVmX2lkIjoiNjczOTZjNWM3MjgyMDZlZmI5MmYxMTY2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNDA4LCJleHAiOjE3ODIzODY4MDh9.X51GXIEcsWTRgps3pfx5ybg_Mn3y2NnSi-AhW4TR_ek)

 (image/png)    


[ycs离线升级.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWQ4OTcwYzJhZjRmNTIwYjc0IiwicmVmX2lkIjoiNjczOTZjNWM3MjgyMDZlZmI5MmYxMTY2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNDA4LCJleHAiOjE3ODIzODY4MDh9.iTtkhDePuo_MvZ0bZ5GzsjfxgUVUXTTBIu5cBHCpadk)

 (image/png)    


[ycs离线升级回滚.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWRhMWFkOWEzMzExZGM4OWUyIiwicmVmX2lkIjoiNjczOTZjNWM3MjgyMDZlZmI5MmYxMTY2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNDA4LCJleHAiOjE3ODIzODY4MDh9.hHgM7AlgUwe32glw-cethyMtmRMzZ7-mtZCSuBCQr0A)

 (image/png)    
