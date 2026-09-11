Created by 张彩虹, last modified on 八月 27, 2024

# **1. 概述**

本文描述集群failover测试设计。

# **2. 需求分析**

集群支持failover即集群支持主备集群（容灾）能力，在主集群发生故障不可用时，可手动切换备集群为主集群继续对外提供业务服务。

## **2.1 功能点分析**

SR链接：    [https://pingcode.yasdb.com/pjm/items/66117e83579a3edb84d76fd8](https://pingcode.yasdb.com/pjm/items/66117e83579a3edb84d76fd8)    ?    
  #YDBRD-22486 集群支持failover

  


概要设计文档：    [概要设计-YDBRD-20241 : 集群支持备库升主能力方案设计](147779553.html)  

开发方案文档：    [详细设计-YDBRD-25968 : 集群支持备库升主能力方案设计](147778640.html)  

该需求主要分为两个大的功能（包含语法测试和功能测试）：

1、功能点1：集群故障后，备集群手动执行failover操作可以将备集群升为主集群；

2、功能点2：备集群升主后，需要手动将原主集群降为备集群。

### 2.1.1 备机升主能力

alter database failover操作实现

### 2.1.2   主机手动降备能力

alter database convert to physical standby操作实现

## **2.3 规格约束**

- Failover的约束：


1. Failover时备集群的1号实例必须open
1. 所有实例的连接必须断连(查询视图  v$replication_status中连接状态  )，如果有一个实例连接着备集群，那么将不能执行failover


- 手动降备的约束：


1. 执行的实例只能是1号实例，且该实例必须是master
1. 仅在HA模式下执行
1. 仅在主机上执行
1. mount阶段


# **3. 详细测试设计**

## **3.1 测试设计方法**

该需求测试设计思路主要是场景法，大的测试场景主要分为语法测试、备库升主、旧主降备、并发和压力这五个部分。

根据故障方式不同、主备集群状态不同、数据量不同又可以细化为不同的子场景

## **3.2 详细测试设计**

|编号|测试场景|子场景描述|预期|备注|
|:---|---|:---|:---|:---|
|1|语法测试|主集群执行  alter database failover;|报错|自动化|
|2||备集群降备  alter database convert to physical standby;|报错|自动化|
|3|备库升主    
    
    
    
    
    
    
|一主两备集群-->做业务-->主集群故障（pkill -9 yasdb）-->备1升主(open)-->旧主降备-->查询数据一致性-->新主做业务-->主备集群查询数据一致性（scn）|成功|自动化|
|4||一主两备集群-->做业务-->主集群故障（pkill -9 yascs）-->备1升主(open)-->旧主降备-->查询数据一致性-->新主做业务-->主备集群查询数据一致性|成功|自动化|
|5||一主两备集群-->做业务→主集群故障（kill -11所有实例）-->备1升主(open)-->旧主降备-->查询数据一致性-->新主做业务-->主备集群查询数据一致性|成功|未自动化|
|6||一主两备集群-->做业务→主集群故障（ifdown网卡）-->备1切主(open)-->旧主降备-->查询数据一致性-->新主做业务-->主备集群查询数据一致性|成功|自动化|
|7||一主两备集群-->做业务→主集群故障（网络超时，心跳时间改成10S，HA_HEARTBEAT_INTERVAL  参数）-->备1切主(open)-->旧主降备-->查询数据一致性-->新主做业务-->主备集群查询数据一致性++|成功|自动化|
|8||~~一主两备集群-->做业务-->主集群故障（pkill -9 yas）-->备1切主(open)备2非open-->旧主降备-->查询数据一致性-->新主做业务-->主备集群查询数据一致性~~|~~成功-删除~~|删除|
|9||一主两备集群-->做业务-->主集群故障（pkill -9 yas）-->备1升主(非open)|报错|自动化|
|10||一主两备集群-->做业务-->主集群故障（有1个存活实例）-->备1升主|报错|自动化|
|11||一主两备集群-->做业务-->主集群故障（pkill -9 yas）-->备1升主(open)-->新主故障-->备2升主（failover循环多次）|成功|自动化|
|12||一主两备集群-->做业务-->主集群故障(磁盘满)-->备1升主(open)-->新主故障-->备2升主（failover循环多次）|成功|手动|
|13||备库升主后新主做归档清理|成功|自动化|
|14||备库升主后新主做PITR恢复|成功|自动化|
|15||failover之后，其他两实例不拉起，实例1做业务后kill，再拉起全部实例（顺序随机），校验数据一致性++|成功|自动化|
|16|旧主降备    
    
    
    
|执行降备实例是master，但不是1号实例|报错|自动化|
|17||执行降备实例是1号实例，但不是master|报错|自动化|
|18||原主集群三个实例中只启动一个实例，1号master实例执行降备|成功|自动化|
|19||原主集群三个实例中启动两个实例，1号master实例执行降备|成功|自动化|
|20||新主做业务过程中（时间较长业务）  两个主各做业务  ，旧主降备  （不支持脑裂修复）++|会脑裂|自动化|
|21||非mount状态下降备（open  nomount）++|报错|自动化|
|22|并发    
    
|~~备1执行failover和备2执行查询并发X~~|~~成功~~|删除|
|23||~~备1执行failover时备2故障X~~|~~成功~~|删除|
|24||~~旧主降备时备2故障X~~|~~成功~~|删除|
|25||两个备集群同时执行failover|两个成功|自动化|
|26||备1执行failover的时候备1执行业务 ++|  
|自动化|
|27||备1执行failover时，加入其他实例（查询v$checkpoint中TRUNC_POINT字段由0-XXX变为1-XXX说明failover完成）|failover未完成时加入其他实例报错|自动化|
|28||备1执行failover时，其他实例做shutdown操作++|报错|自动化|
|29||旧主两个会话同时手动降备    ++|只有一个成功|自动化|
|30|压力场景|集群主备执行TPCC产生大量脏页，执行TPCC过程中故障主集群，备集群升主后继续执行TPCC（  v$checkpoint中TRUNC_POINT字段未变成1时，加入实例卡住）|成功|手动测试|
|31|性能场景|failover性能|  
|需要性能环境测试|


# **4. 测试用例**

冒烟用例

|序号|测试场景|预期|
|---|:---|:---|
|1|一主两备集群-->做业务-->主集群故障（pkill -9 yas）-->备1升主-->旧主降备-->查询数据一致性-->新主做业务-->主备集群查询数据一致性|成功|
|2|一主两备集群-->做业务-->主集群故障（有存活实例）-->备1升主|报错|
|3|执行降备实例是master，但不是1号实例|报错|
|4|执行降备实例是1号实例，但不是master|报错|


文本用例：

[集群支持手动failover文本测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTRhMWFkOWEzMzExZGM4ZTk2IiwicmVmX2lkIjoiNjczOTZkMTQ1OTNmOTljOWZmMjM3Nzk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzMzLCJleHAiOjE3ODIzOTIxMzN9.wRPsaD0udEMiIogD0VKDGFoCVRnayqjEPxFPUcKXtmQ)

自动化用例：

  [https://git.yasdb.com/cod-test/yasft/-/merge_requests/8109](https://git.yasdb.com/cod-test/yasft/-/merge_requests/8109)  

# **5. 测试框架设计**

本次测试使用anchor_regress框架  实现

# **6. 测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|集群|


# **7、工作量评估**

总计 11人天

测试设计+评审  2人天

测试 5人天

自动化+调试稳定 3人天

上车分析 1人天

## Attachments:

[集群支持手动failover文本测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTRhMWFkOWEzMzExZGM4ZTk2IiwicmVmX2lkIjoiNjczOTZkMTQ1OTNmOTljOWZmMjM3Nzk1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzMzLCJleHAiOjE3ODIzOTIxMzN9.wRPsaD0udEMiIogD0VKDGFoCVRnayqjEPxFPUcKXtmQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  一、会议时间：2024/04/11 周四 15：10-16：00    
  二、会议地点：西安办公室（2）    
  三、会议主持人：张彩虹    
  四、参会人员：马志宏、朱国旭、高亚宁、张彩虹    
  五、会议主题：集群支持failover测试设计评审    
  六、会议总结    
  增加测试点：    
  1、备库升主：增加网络超时故障方式（HA_interval_timeout参数设置为10S）    
  2、备库升主：failover之后，其他两实例不拉起，实例1做业务后kill，再拉起全部实例（顺序随机），校验数据一致性    
  3、旧主降备：非mount状态下降备（open nomount）    
  4、并发场景：备1执行failover的时候备1执行业务&其他实例做shutdown操作    
  5、并发场景：旧主两个会话同时手动降备    
  删除测试点（备1备2相互独立，此场景不涉及）：    
  1、备1执行failover和备2执行查询并发    
  2、备1执行failover时备2故障    
  3、旧主降备时备2故障,Posted by zhangcaihong at 四月 11, 2024 18:48|
|---|
