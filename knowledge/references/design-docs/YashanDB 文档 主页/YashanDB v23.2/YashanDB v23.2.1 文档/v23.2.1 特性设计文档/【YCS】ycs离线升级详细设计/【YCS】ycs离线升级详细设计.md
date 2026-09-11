Created by 许中立, last modified by  李垠 on 十一月 08, 2024

IR链接：    [YDBRD-20261](https://jira.yasdb.com/browse/YDBRD-20261?src=confmacro)    -  集群升级（23.1升级23.2）  完成

SR链接：    [YDBRD-22517](https://jira.yasdb.com/browse/YDBRD-22517?src=confmacro)    -  ycs支持集群升级  完成

##   [1. 总述](#1-总述)  

在概要设计文档的基础上，进行详细设计。概要设计文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=138571200](https://conf.yasdb.com/pages/viewpage.action?pageId=138571200)  

###   [1.1 需求来源](#11-需求来源)  

支持共享集群从23.1版本离线升级到23.2版本，集群管理服务（YCS）需要支持离线升级的能力。

###   [1.2 调研文档](#12-调研文档)  

略（这个升级主要在现有的升级框架内完成，而且23.1版本已经做了一部分内容）

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|升级前检查|检查系统健康状态，是否适合进行升级|否|是|YDBRD-22517|
||升级前备份|对关键数据进行备份|是|是|YDBRD-22517|
||离线升级|离线完成整个集群升级|是|是|YDBRD-22517|
||升级后检查|检查系统是否升级成功|否|是|YDBRD-22517|
||升级异常回滚|升级过程中发生异常需要回滚到升级前的状态|是|是|YDBRD-22517|


##   [2. 接口](#2-接口)  

###   [2.1 升级相关目录结构](#21-升级相关目录结构)  

```
$YASDB_HOME/admin/dbr/upgrade
  |- 23.1.1
  |- 23.1.2
  |- 23.1.3
    |- diff.sql
    |- dstb_preupgrade.out
    |- dstb_preupgrade.sql
    |- dstb_upgrade.sql
    |- postupgrade.out
    |- postupgrade.sql
    |- preupgrade.out
    |- preupgrade.sql
    |- upgrade.sql
    |- upgrade.toml
    |- yac_precheck.sh         # 升级前检查脚本
    |- yac_preupgrade.sh       # 升级前准备的脚本，进行YCR盘备份，生成导入ycr的配置文件
    |- yac_upgrade.sh          # 升级脚本，处理不兼容变更
    |- yac_rollback.sh         # 是否存在备份恢复无法回滚的操作需要专门的脚本来处理？
    |- yac_postcheck.sh        # 升级后检查脚本

```

yasboot升级使用流程参考文档：    [https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%8D%87%E7%BA%A7/%E7%A6%BB%E7%BA%BF%E5%8D%87%E7%BA%A7.html。](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%AE%89%E8%A3%85%E5%92%8C%E5%8D%87%E7%BA%A7/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%8D%87%E7%BA%A7/%E7%A6%BB%E7%BA%BF%E5%8D%87%E7%BA%A7.html%E3%80%82)  

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

###   [4.1 整体离线升级流程](#41-整体离线升级流程)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c6da1ad9a3311dc8a84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFDQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQWdBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA3NjMsImV4cCI6MTc4MjMxMTU2M30.5DiZtiproSACI-412yGIzZ0is8n8EAjak7EAW6g2Sj0)

1. 逐个节点进行升级前检查，如果有哪个节点状态异常，则报错退出
    1. 配置环境yac相关脚本执行环境
    1. **执行yac_precheck.sh，返回0表示检查通过**
    1. 检查DB状态，通过preupgrade.sql检查
1. 对YCS元数据进行备份1.配置环境yac相关脚本执行环境
    1. 对各个节点执行  **yac_preupgrade.sh**  。
1. 停止YCS的守护服务（进程退出自动拉起），目前YCS没有守护服务
1. 停止集群内所有节点
1. 备份DB元数据
    1. 备份DB的元数据文件
        1. 元数据文件（system文件）
        1. 用户数据文件
        1. 日志（redo/undo）
1. 替换二进制程序，将工具升级
    1. 逐个主机更新安装包
    1. 逐个主机更新环境变量
1. 离线适配ycs不兼容修改
    1. 配置环境yac相关脚本执行环境
    1. **对各个节点执行yac_upgrade.sh，返回0表示执行通过**    //  YCR备份只需一个节点操作，脚本通过识别YAC_NODE_ID，判断在哪个节点上执行
1. 变更DB元数据
    1. 拉起其中一个DB节点到nomount状态
    1. 进入upgrade模式，alter database open upgrade
    1. 升级元数据，执行upgrade.sql，upgrade.toml中共享集群节点类型是ce
    1. 退出upgrade模式， alter database exit upgrade
    1. 节点退出，shutdown
1. 恢复拉起所有节点。
1. 检查升级后的状态
    1. 配置环境yac相关脚本执行环境
    1. **执行yac_postcheck.sh，返回0表示检查通过**
    1. 检查DB状态
1. 恢复YCS的守护服务


```
ycsctl stop cluster -c cluster_name

```

>   【注】部分流程参考原有OM设计    [OM实现支持集群数据库离线升级](https://conf.yasdb.com/pages/viewpage.action?pageId=122078637)    

######   [yac相关脚本执行环境](#yac相关脚本执行环境)  

- YASCS_HOME: 执行路径。
- YAC_NODE_ID: 节点序列ID，从1开始。
- YAC_YCR_BACKUP_FILE: OM前面导出的ycr.sh文件路径


####   [4.1.1 导入导出YCR盘命令格式](#411-导入导出ycr盘命令格式)  

```
ycsctl import src_path ycrbackup.sh // 导入
ycsctl export dest_path  // 导出

```

####   [4.1.2 脚本详细流程（错误信息通过打屏输出）](#412-脚本详细流程错误信息通过打屏输出)  

#####   [yac_precheck(所有节点执行)](#yac-precheck所有节点执行)  

1. 检查YCS节点状态，
1. 检测YAC_YCR_BACKUP_FILE/下是否存在导出的配置文件 ycrbackup.sh。存在则报错，提示删掉。


#####   [yac_preupgrade.sh（只在一个节点上正式执行）](#yac-preupgradesh只在一个节点上正式执行)  

1. 判断该节点是否满足YAC_NODE_ID。
1. 备份YCR盘内容，执行ycsctl export dest_path ycrbackup.sh ，生成ycrbackup.sh。  **脚本示例**  ：


```
ycsctl export YAC_YCR_BACKUP_FILE

```

#####   [yac_upgrade.sh（只在一个节点上正式执行）](#yac-upgradesh只在一个节点上正式执行)  

1. 通过标志位isYcrUpgrade判断是否需要导入导出，isVotingDiskUpgrade重置votingDisk。
1. 修改YCR配置后，导入YCR盘
    1. 解析YCR导出文件ycrbackup.sh，生成新的YCR配置文件：ycr_upgrade.sh。
    1. 脚本修改ycr_upgrade.sh配置。
    1. 通过命令将ycr_upgrade.sh文件导入YCR盘。
1. 重置VotingDisk（导入YCR，自动重置VotingDisk）


```
# 如果当前不是节点1则跳过
if [ "X$YAC_NODE" != "X1" ]; then
    exit 0
fi

ycsctl import YAC_YCR_BACKUP_FILE/ycr_upgrade.sh

```

#####   [yac_rollback.sh（只在一个节点上正式执行）](#yac-rollbacksh只在一个节点上正式执行)  

1. 通过标志位isYcrUpgrade判断是否需要导入导出回滚，isVotingDiskUpgrade重置votingDisk。
1. 导入YCR盘
    1. 通过导入命令ycsctl import src_path ycrbackup.sh，将YCR回退至升级前的版本。
1. 重置VotingDisk（导入YCR，自动重置VotingDisk）


#####   [yac_postcheck.sh(所有节点执行)](#yac-postchecksh所有节点执行)  

1. 检查YCS节点状态。


###   [4.2 升级异常回退（通过命令进行回滚）](#42-升级异常回退通过命令进行回滚)  

####   [4.2.1 步骤2或之前异常](#421-步骤2或之前异常)  

1. 报错，中断升级流程


####   [4.2.2 步骤5或之前异常](#422-步骤5或之前异常)  

1. 报错，中断升级流程
1. 整体拉起集群内所有节点
1. 恢复YCS的守护服务


####   [4.2.3 步骤6异常 （工具并无持久化内容，不会有不兼容情况）](#423-步骤6异常-工具并无持久化内容不会有不兼容情况)  

1. 报错，中断升级流程
1. 回退相关路径环境变量
1. 整体拉起集群内所有节点
1. 恢复YCS的守护服务


####   [4.2.4 步骤7、8异常](#424-步骤78异常)  

1. 报错，中断升级流程
1. 二进制程序替换，回退至升级前的版本，工具版本回退。
1. 将升级前备份恢复到集群里
    1. 配置相关环境变量，执行  **yac_rollback.sh**   脚本，恢复YCR盘内容。
    1. 恢复DB元数据文件
1. 回退相关路径环境变量
1. 整体拉起集群内所有节点
1. 恢复YCS的守护服务


####   [4.2.5 步骤8及以后异常](#425-步骤8及以后异常)  

1. 报错，中断升级流程
1. 停止YCS的守护服务（进程退出自动拉起）
1. 停止集群内所有节点
1. 二进制程序替换，回退至升级前的版本，工具版本回退。
1. 将升级前备份恢复到集群里
    1. 配置相关环境变量，执行  **yac_rollback.sh**   脚本，恢复YCR盘内容。
    1. 恢复DB元数据文件
1. 回退相关路径环境变量
1. 整体拉起集群内所有节点，DB打开至Open
1. 恢复YCS的守护服务


###   [4.3 三个配置参数从ini文件移到YCR](#43-三个配置参数从ini文件移到ycr)  

在yac_upgrade.sh脚本中适配，原ini文件中继续保留（回滚无需变更），新版本软件直接从YCR读取

###   [4.4 升级过程日志记录](#44-升级过程日志记录)  

主要体现在OM上，整体略

###   [4.5 兼容性变更指导](#45-兼容性变更指导)  

略

##   [5.未来规划](#5未来规划)  

未来考虑通过滚动升级的方法，使对业务影响时间降到最低。

###   [5.2 23.1升级到23.2版本](#52-231升级到232版本)  

由于23.1工具侧不支持导入导出，需通过特殊方法进行升级。

1. yac_preupgrade.sh 脚本对23.1进行特殊处理，不通过工具生成ycrbackup.sh，脚本根据23.2版本特性，拼凑出特殊的导入脚本，ycr_upgrade_23.1.sh.
1. yac_upgrade.sh 脚本对23.1 进行特殊处理，导入ycr_upgrade_23.1.sh。


##   [6.测试用例](#6测试用例)  

|场景|预期|
|---|---|
|23.2.2升级至23.2.3|升级成功|
|23.2.2升级至23.2.3的过程中，在db升级过程中，注入DB挂掉故障|升级退出报错，执行回退正确回退|
|23.2.3升级至23.2.4|升级成功|
|23.2.2升级至23.2.4的过程中，在db升级过程中，注入DB挂掉故障|升级退出报错，执行回退正确回退|


3. 补充ci上ycs离线升级看护用例。（依赖OM，等OM实现完后再补充）

## Attachments:

[YCS离线升级脚本流程图.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmRhMWFkOWEzMzExZGM4YTgyIiwicmVmX2lkIjoiNjczOTZjNmQ3MjgyMDZlZmI5MmYxMjc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzYzLCJleHAiOjE3ODIzODcxNjN9.8E42Zgwv_CZoCBUpqlhzTJuB8nc109py-jMcolPkR4Q)

 (image/png)    


[YCS离线升级脚本流程图.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmQ4OTcwYzJhZjRmNTIwYzE1IiwicmVmX2lkIjoiNjczOTZjNmQ3MjgyMDZlZmI5MmYxMjc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzYzLCJleHAiOjE3ODIzODcxNjN9.QQLKZ1UUPrVCjkDZr6hbofNPu81y1mKu28T4d9NQ6SA)

 (image/png)    


[YCS离线升级脚本流程图.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmQ4OTcwYzJhZjRmNTIwYzE2IiwicmVmX2lkIjoiNjczOTZjNmQ3MjgyMDZlZmI5MmYxMjc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzYzLCJleHAiOjE3ODIzODcxNjN9.Y1_Mlod1CyogQ2aY8lao_xMo9vJAVUcTwijKGDBXCrI)

 (image/png)    


[YCS离线升级脚本流程图.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNmRhMWFkOWEzMzExZGM4YTgzIiwicmVmX2lkIjoiNjczOTZjNmQ3MjgyMDZlZmI5MmYxMjc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNzYzLCJleHAiOjE3ODIzODcxNjN9.mBvDQO_armN7WamtOuzvfivdT2UPol6R--IDpMEyAb8)

 (image/png)    
