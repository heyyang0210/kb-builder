Created by 高亚宁, last modified on 十月 25, 2024

# 1.   **概述**

本文描述yasrman恢复支持设置还原路径的测试设计

# 2.   **需求分析**

*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/66d580d84283cf23d4f43c95](https://pingcode.yasdb.com/ship/ideas/66d580d84283cf23d4f43c95)  *?  
#YASHAN-3266 mount模式支持删除归档和跳过损坏的归档*

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/6707434de489dd0868f37893](https://pingcode.yasdb.com/pjm/items/6707434de489dd0868f37893)  *?  
#YDBRD-33774 mount模式支持删除归档和跳过损坏的归档*

开发文档：  [(731) 支持Clear LogFile | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YAS/pages/678396a07bb8e383a778f4dc)  

需求来源：  内部需求

需求范围：单机、分布式和集群

场景：外场遇到磁盘空间满、REDO损坏场景时，目前的归档机制会导致无法启动，需要进行以下优化：

1.mount模式支持删除归档

2.支持跳过损坏的归档

**特性设计：**

|属性|场景名称|方案设计|特性是否涉及|
|:---|:---|:---|:---|
|功能|支持mount下手动清理归档|语法校验放开，但是mount下是无法获取备机的同步情况和备份的归档情况，如果配置参数ARCH_CLEAN_IGNORE_MODE不为BOTH，删除时必须指定FORCE字段。|是|
|功能|数据库open，redo文件内容损坏，无法归档。|可以使用clear logfile操作，重新初始化损坏文件，如果该redo没有归档，那么必须指定unarchived字段。|是|
|功能|数据库open，redo文件被误删。|可以使用clear logfile操作，会将误删的文件重新创建，如果该redo没有归档，那么必须指定unarchived字段。|是|
|功能|数据库mount，redo文件被误删或者内容损坏，导致数据库无法启动|可以使用clear logfile操作，会将误删的文件重新创建或者初始化损坏的文件|是|
|周边配合|权限|同ALTER DATABASE的权限保持一致|否|


  [规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  **：**

1. mount下归档清理，如果ARCH_CLEAN_IGNORE_MODE不为BOTH，需要指定FORCE字段才可以清理（其他策略同open保持一致）
1. 如果当前redo的asn小于等于rcy_point的asn，那么该redo文件不能被clear（需要手动执行checkpoint）。
1. current redo文件是不可以被clear的
1. 如果该redo文件没有被归档，不指定unarchived字段，执行clear，会报错。
1. 集群下，open下只能操作当前实例的redo文件，mount下仅master可以操作其他实例的redo文件（提供集群数据库无法启动的逃生手段）
1. 主库如果执行unarchived操作clear，可能会导致备库出现need repair现象（同归档文件被清理）


# 3.   **测试设计方法**

1. 新增语法，等价类划分法
1. mount模式删除归档和clear logfile功能，场景法和错误推测法
1. 视图：v$logfile新增archived字段，采用场景法校验该字段是否正确
1. 权限：alter database clear [unarchived] logfile filename，采用场景法校验不同权限的用户执行该sql能否执行
1. DFX覆盖


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|是|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|是|


# 4.   **详细测试设计**

测试观测点：

1. mount模式下，使用各种语法删除归档是否成功，删除成功后，校验物理文件和v$ARCHIVED_LOG视图中的文件是否被清理


```
ALTER DATABASE DELETE ARCHIVELOG (ALL|UNTIL ((SEQUENCE INTEGER [THREAD INTEGER])|TIME DATE|SCN INTEGER))[FORCE]
```

1. clear logfile是否执行成功，执行后日志状态是否正确，做业务日志是否能正常写入




### **4.1 语法**

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|alter database clear [unarchived] logfile filename|不带unarchived|关键字写错或者缺失：,alter systeam clear unarchived logfile filename;,alter database  unarchived logfile filename;,alter database clear log filename;,alter database clear unarchive logfile filename;,alter database clean unarchived logfile filename;,alter database delete unarchived logfile filename;,alter database clear [unarchived] logfile ;|
||带unarchived|文件不存在(找库中的redo文件，文件被删除/未被创建)|
||clear standby redo|一次删除多个：alter database clear [unarchived] logfile filename1,filename2,filename3;|


### **4.2 功能**

|序号  
|部署形态|测试场景|预期|备注|
|---|---|---|---|---|
|1|单机|mount模式下删除所有归档(ALTER DATABASE DELETE ARCHIVELOG ALL [force])：,1. ARCH_CLEAN_IGNORE_MODE=both
1. ARCH_CLEAN_IGNORE_MODE=backup
1. ARCH_CLEAN_IGNORE_MODE=STANDBY
1. ARCH_CLEAN_IGNORE_MODE=NONE
1. 考虑带不带force：不满足清理条件，不带force删除失败，带force删除成功
|删除成功|复用现有用例（手动清理）：,单机：yasft\ha\ha_heap\testcase\ha_schedule_common\archive_clean,集群：yasft\ha\ha_cluster\testcase\backup\clean_archive,分布式：无用例|
|2||mount模式下删除指定范围内的归档（ALTER DATABASE DELETE ARCHIVELOG (UNTIL ((SEQUENCE INTEGER [THREAD INTEGER])|TIME DATE|SCN INTEGER))[FORCE]）：,1. ARCH_CLEAN_IGNORE_MODE=both
1. ARCH_CLEAN_IGNORE_MODE=backup
1. ARCH_CLEAN_IGNORE_MODE=STANDBY
1. ARCH_CLEAN_IGNORE_MODE=NONE
1. 考虑带不带force：不满足清理条件，不带force删除失败，带force删除成功
|删除成功|复用现有用例|
|3||备机mount模式下，删除归档，覆盖以上场景|删除成功|复用现有用例|
|||考虑ystream，有ystream sever时，mount下删除未被解析的归档文件——无法校验是否存在server|删除成功||
|||open下redo文件正常，new、inactive状态的文件，执行clear logfile|成功，文件被初始化为NEW|3个redo时执行|
|||open下redo文件正常，current、active状态的文件，执行clear logfile unarchived|报错，current文件要用与crash recover||
|||open下redo文件正常，archived为YES、NO时，分别执行clear log file，指定/不指定unarchived|archived为YES时，指定/不指定unarchived都清理成功,archived为No时，指定unarchived清理成功，不指定unarchived清理报错||
|||open下redo文件内容被损坏，导致没有归档，执行clear log file，指定/不指定unarchived|不指定unarchived报错，该文件要用于归档,指定unarchived成功||
|||mount和open下redo文件被删除，导致归档失败，执行clear log file，指定/不指定unarchived|不指定unarchived报错，该文件要用于归档,指定unarchived成功||
||+|mount和open状态下，current redo被损坏，修复数据库|mount修复失败,open修复成功|需要检查数据库状态，如果异常，需要执行命令convert|
|||使用yasrman做level 0的增量备份1，mount下清理归档，clear log file，open数据库，做业务（含redo切换，增删文件，ddl/dml等），做level 1的增量备份2和归档备份，使用增量备份2恢复数据库，校验数据量是否正确|备份和恢复都成功，数据量正确||
|||主机mount下清理归档，clear log file，open数据库，在主机上做并行build备机|并行build备机成功||
|||redo头损坏或者内容损坏，数据库nomount/mount下，执行clear log file，指定/不指定unarchived|nomount报错,mount不指定unarchived报错，指定unarchived成功||
|||redo头损坏或者内容损坏，在备机mount/open下，执行clear log file|执行成功||
|||clear log file时，kill重启数据库，再次clear log file|第一次失败，第二次成功||
|||v$logfile新增archived字段：,1. 查看该字段类型是否与资料中的一致
1. 构造场景，校验archived字段的值是否正确
|-||
|||权限：sys/dba/sysdba/sysbackup/SYSOPER/YSTREAM_CAPTURE/普通用户分别执行alter database clear [unarchived] logfile filename——加到已有用例中看护|只有sys/dba/sysdba执行成功，其他用户执行报错||
||集群|覆盖单机场景|||
|||集群下，指定其他实例的redo文件，执行clear logfile|报错，该实例中不存在该redo文件||
|||集群mount下，master/非master实例指定其他实例的redo，执行clear logfile|master执行成功,非master执行报错||
|||集群下，实例1clear logfile，实例2 kill重启yasdb/yascs|clear logfile成功||
||分布式|覆盖单机场景|||


# 5.  ** **  **测试用例设计**

文本用例



# 6.   **测试框架设计**

使用regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机：在同一台机器部署一主2备,集群：在同一台机器部署集群3实例,分布式：3cn1mn3dn，mn和dn组内为一主2备|


# 8.   **测试工作量评估**

12人天：

11/18：测试设计+测试设计评审

11/20：转测

11/21~11/29：测试执行+用例编写调试+问题单回归+上车失败分析





