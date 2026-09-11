Created by 张彩虹, last modified on 十二月 06, 2023

# **1. 概述**

本文描述集群OM适配PITR功能测试设计， PITR（point-in-time Recovery）指定时间点恢复，只要从备份时间点开始的归档日志和在线日志都在，数据库可以恢复到备份时间点之后的任意一个时间点，若不指定时间点，会尽量恢复到最新点

之前OM只支持了集群和单机的完全恢复，现在需要适配集群和单机PITR恢复功能。

# **2. 需求分析**

该需求主要是OM为了适配内核PITR功能，所以在测试的时候应该重点考虑OM语法部分测试，以及部分PITR功能场景测试（全量功能测试已在    [【YDBRD-21629】【共享集群】集群内核支持PITR功能测试设计](133594869.html)    中包含）。

## **2.1 功能点分析**

SR链接：    [YDBRD-21406](https://jira.yasdb.com/browse/YDBRD-21406?src=confmacro)    -  【23.1补丁】集群OM适配PITR  完成    [YDBRD-21630](https://jira.yasdb.com/browse/YDBRD-21630?src=confmacro)    -  集群OM适配PITR  完成

开发方案文档：    [OM适配PITR设计](133578895.html)  

### 2.1.1 OM语法

- yasboot cluster clean
- 已有命令，之前不支持集群，现在支持集群；
 --restore与--purge互斥，--purge为彻底清理db数据（包括归档）

|关键参数|选项|说明|
|:---|:---|:---|
|-c,--cluster|必填|共享集群的名称|
|--restore|选填，与--purge互斥|该命令用于只清理数据文件，不清理归档，并让db以nomount的方式启动（单机，分布式已支持，这次主要是适配集群）|


- yasboot backup restore
- 已有命令，之前不支持PITR恢复，现在支持PITR；


|关键参数|选项|说明|
|:---|:---|:---|
|--until-time|选填|指定恢复时间，字符串，格式要求为“2006-01-02 15:04:05”|
|--until-scn|选填|指定恢复SCN，整数|


## **2.3 规格约束**

- 精度到微秒，指定时间恢复；
- 单机PITR底层是通过yasrman来实现的，但是集群因为暂不支持yasrman，所以是通过sql来完成的；
- 其他限制同db，om侧无其他限制


# **3. 详细测试设计**

## **3.1 测试设计方法**

该需求测试设计思路主要是语法部分采用等价类划分法，功能部分采用场景法。（单机yasrman部分： 只能使用OM方式备份，才能使用OM命令恢复，内部逻辑都是在本地）

一、语法验证(OM命令)：

    1、验证使用OM命令until time/scn后输入正确参数，数据库可正常恢复。

    2、验证使用OM命令until time/scn后输入不正确参数，恢复操作失败，且报错信息明确。

    3、不支持语法拦截。

二、功能场景验证（测试场景验证包含集群串行方式和集群并行方式测试）：

    基本功能场景：

    1、不同备份方式下PITR恢复

    2、不同数据损坏方式下PITR恢复

    3、重复进行PITR恢复

    并发场景：

    1、集群所有实例并行恢复

    故障场景：

    1、恢复过程中db进程故障

    2、恢复过程中ycs进程故障

    3、恢复过程中网络故障

三、验证点：

    1、有效参数命令执行成功

    2、无效参数命令执行失败，且报错信息明确

    3、恢复成功后，集群各个实例数据查询正确且一致

    4、恢复成功后数据库可正常使用

## **3.2 详细测试设计**

[集群OM适配PITR.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2FhMWFkOWEzMzExZGM4NTU1IiwicmVmX2lkIjoiNjczOTZiY2E3MjgyMDZlZmI5MmYwYTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTEyLCJleHAiOjE3ODIzODM1MTJ9.Y1Wgap8H74HDFIOLh-HiWoRDFvPvcTPpT7o_TIxRKns)

# **4. 测试用例**

冒烟用例

|序号|测试场景|预期|
|---|:---|:---|
|1|OM命令until time输入正确参数|成功|
|2|OM命令until time输入错误参数|报错|
|3|OM命令until SCN输入正确参数|成功|
|4|OM命令untilSCN输入错误参数|报错|
|5|集群三实例，使用OM命令指定正确时间点恢复|恢复成功，三实例数据正确且一致|
|6|集群三实例，使用OM命令指定正常SCN恢复|恢复成功，三实例数据正确且一致|


文本用例：

[集群OM适配PITR文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2FhMWFkOWEzMzExZGM4NTU2IiwicmVmX2lkIjoiNjczOTZiY2E3MjgyMDZlZmI5MmYwYTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTEyLCJleHAiOjE3ODIzODM1MTJ9.nEsOcxRYydcGxWgdLXcdCkZDV3n3HbBQVkdsTNxsalI)

自动化用例：

集群：    [https://git.yasdb.com/zhangcaihong/yastest_dfx/-/tree/zch1206/install_test/src/test/yasboot_rac](https://git.yasdb.com/zhangcaihong/yastest_dfx/-/tree/zch1206/install_test/src/test/yasboot_rac)  

单机：    [https://git.yasdb.com/zhangcaihong/yastest_dfx/-/blob/zch1206/install_test/src/test/yasboot_se/test_sdv_yasboot_backup_pitr.py](https://git.yasdb.com/zhangcaihong/yastest_dfx/-/blob/zch1206/install_test/src/test/yasboot_se/test_sdv_yasboot_backup_pitr.py)  

# **5. 测试框架设计**

本次测试使用HA框架  实现

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机&集群|


## Attachments:

[集群内核支持PITR.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2E4OTcwYzJhZjRmNTIwNmUxIiwicmVmX2lkIjoiNjczOTZiY2E3MjgyMDZlZmI5MmYwYTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTEyLCJleHAiOjE3ODIzODM1MTJ9._0WmFFt-ywOkoDrbEBfVaFRinv6PZpmOW3Tesq8Y9zk)

 (application/x-xmind)    


[集群OM适配PITR.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2FhMWFkOWEzMzExZGM4NTU1IiwicmVmX2lkIjoiNjczOTZiY2E3MjgyMDZlZmI5MmYwYTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTEyLCJleHAiOjE3ODIzODM1MTJ9.Y1Wgap8H74HDFIOLh-HiWoRDFvPvcTPpT7o_TIxRKns)

 (application/x-xmind)    


[集群OM适配PITR文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2FhMWFkOWEzMzExZGM4NTU2IiwicmVmX2lkIjoiNjczOTZiY2E3MjgyMDZlZmI5MmYwYTQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTEyLCJleHAiOjE3ODIzODM1MTJ9.nEsOcxRYydcGxWgdLXcdCkZDV3n3HbBQVkdsTNxsalI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
