Created by 张彩虹, last modified on 十二月 14, 2023

# **1. 概述**

本文描述集群备份恢复支持pitr的测试设计， PITR（point-in-time Recovery）指定时间点恢复，只要从备份时间点开始的归档日志和在线日志都在，数据库可以恢复到备份时间点之后的任意一个时间点，若不指定时间点，会尽量恢复到最新点

# **2. 需求分析**

1、与单机相同点：与单机PITR语法相同，可以指定scn和时间点回放

2、与单机不同点：回放机制不同。集群的redo是多个实例独立的，但是回放的时候有关联性，指定到一个时间点，需要多实例的redo共同回放。所以测试点着重考虑集群多实例串行恢复测试场景和集群多实例并发恢复测试场景，恢复至指定目标点之后，所有实例都要验证数据正确性和一致性。

## **2.1 功能点分析**

SR链接：    [YDBRD-21393](https://jira.yasdb.com/browse/YDBRD-21393?src=confmacro)    -  【23.1补丁】集群内核支持PITR  完成    [YDBRD-21629](https://jira.yasdb.com/browse/YDBRD-21629?src=confmacro)    -  集群内核支持PITR  完成

概要设计文档：    [集群PITR概要设计](133564388.html)  

开发方案文档：    [集群PITR方案设计](130140584.html)  

### 2.1.1 恢复语法

RESTORE DATABASE from 备份集;

RECOVER DATABASE UNTIL [  **TIME**   time |   **SCN**   scn];

ALTER DATABASE OPEN   **RESETLOGS**  ;   // until 的recover属于不完整恢复，需要重置redo时间线

yasrman支持PITR（仅单机）

其中 until time有四种格式，时间都是本地时间，不是UTC时间：

1. RECOVER DATABASE UNTIL TIME '2020-12-12 12:12:12';  时间字符串的格式，要与当前session的timestamp_FORMAT参数匹配(精度更高)
1. RECOVER DATABASE UNTIL TIME to_date('2021-06-23 11:14:15', 'yyyy-mm-dd hh24:mi:ss');  使用to_date自定义时间格式
1. RECOVER DATABASE UNTIL TIME to_timestamp('2021-06-23 11:14:15', 'yyyy-mm-dd hh24:mi:ss');使用to_timestamp自定义时间格式
1. timestamp_to_scn不支持，scn_to_timestamp支持


## **2.3 规格约束**

- 指定的时间点过大，数据库无法恢复到指定的时间点时，recover database 会报错（同单机和Oracle保持一致）
- 不完全恢复后，必须要reset logs。（同单机和Oracle保持一致）
- 集群目前不支持yasrman，yasrman语法仅支持单机。
- HA环境，主机执行完PITR恢复，所有备机需要重新构建。（备机会need repair）
- yasrman执行失败后要重新清理环境，重新执行该操作。


# **3. 详细测试设计**

## **3.1 测试设计方法**

该需求测试设计思路主要是语法部分采用等价类划分法，功能部分采用场景法。

一、语法验证(包含yasql和yasrman)：

    1、验证until time后输入正确参数，数据库可正常恢复。

    2、验证until time后输入不正确参数，恢复操作失败，且报错信息明确。

    3、不支持语法拦截。

二、功能场景验证（测试场景验证包含集群串行方式和集群并行方式测试）：

    基本功能场景：

    1、不同备份方式下PITR恢复

    2、不同数据损坏方式下PITR恢复

    3、重复进行PITR恢复

    4、恢复后以不同方式open

    并发场景：

    1、集群所有实例并行恢复

    2、集群所有实例进行ALTER DATABASE OPEN RESETLOGS;

    压力场景：超大数据量下进行PITR恢复

    性能场景：TPCC 1000仓数据对比之前恢复速率（不需要）

    故障场景：

    1、恢复过程中db进程故障

    2、恢复过程中网络故障

三、验证点：

    1、有效参数命令执行成功

    2、无效参数命令执行失败，且报错信息明确

    3、恢复成功后，集群各个实例数据查询正确且一致

    4、恢复成功后数据库可正常使用

## **3.2 详细测试设计**

[集群内核支持PITR.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDI4OTcwYzJhZjRmNTIwNzFjIiwicmVmX2lkIjoiNjczOTZiZDI1OTNmOTljOWZmMjM2Nzc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MjQ0LCJleHAiOjE3ODIzODM2NDR9.Ild74Xqr0OI4rCYiS_SnTa2zQwXWqXdSEbEM76f_j3A)

# **4. 测试用例**

冒烟用例

|序号|测试场景|预期|
|---|:---|:---|
|1|time输入正确参数|成功|
|2|time输入错误参数|报错|
|3|SCN输入正确参数|成功|
|4|SCN输入错误参数|报错|
|5|集群三实例，指定正确时间点恢复|恢复成功，三实例数据正确且一致|
|6|集群三实例，指定正常SCN恢复|恢复成功，三实例数据正确且一致|


  


文本用例

[集群内核支持PITR文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDI4OTcwYzJhZjRmNTIwNzFlIiwicmVmX2lkIjoiNjczOTZiZDI1OTNmOTljOWZmMjM2Nzc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MjQ0LCJleHAiOjE3ODIzODM2NDR9.x5nXxwgu8fDPFUwO5gag8udeJpiHCKpxSVNf6ZPDTfE)

自动化用例路径：

集群：    [https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_cluster/testcase/backup/backup_pitr](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_cluster/testcase/backup/backup_pitr)  

单机：    [https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_heap/testcase/ha_schedule_backup/backup_yasrman](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_heap/testcase/ha_schedule_backup/backup_yasrman)  

# **5. 测试框架设计**

本次测试使用HA框架  实现

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|集群&集群HA|


## Attachments:

[集群内核支持PITR.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDI4OTcwYzJhZjRmNTIwNzFjIiwicmVmX2lkIjoiNjczOTZiZDI1OTNmOTljOWZmMjM2Nzc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MjQ0LCJleHAiOjE3ODIzODM2NDR9.Ild74Xqr0OI4rCYiS_SnTa2zQwXWqXdSEbEM76f_j3A)

 (application/x-xmind)    


[集群内核支持PITR文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDM4OTcwYzJhZjRmNTIwNzFmIiwicmVmX2lkIjoiNjczOTZiZDI1OTNmOTljOWZmMjM2Nzc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MjQ0LCJleHAiOjE3ODIzODM2NDR9.GHvvc2ng6wK2kP_aqHO4R0EFroRggdzQfkaZg9MTpIk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[集群内核支持PITR文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDI4OTcwYzJhZjRmNTIwNzFlIiwicmVmX2lkIjoiNjczOTZiZDI1OTNmOTljOWZmMjM2Nzc0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MjQ0LCJleHAiOjE3ODIzODM2NDR9.x5nXxwgu8fDPFUwO5gag8udeJpiHCKpxSVNf6ZPDTfE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,一、会议时间：2023/11/14  周二 14：30-15：30,二、会议地点：西安办公室（2）,三、会议主持人：张彩虹,四、参会人员：马志宏、朱国旭、高亚宁、张彩虹,五、会议主题：集群内核支持PITR测试设计评审,六、会议总结,1. 不同数据损坏方式下进行恢复场景补充删除某一个实例的归档
1. 补充单机yasrman语法测试场景
,Posted by zhangcaihong at 十二月 11, 2023 18:11|
|---|
