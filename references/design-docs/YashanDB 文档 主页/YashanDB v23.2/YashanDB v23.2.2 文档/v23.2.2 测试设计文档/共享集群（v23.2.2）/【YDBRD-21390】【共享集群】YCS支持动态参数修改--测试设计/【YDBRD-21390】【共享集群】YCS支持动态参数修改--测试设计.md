Created by 徐凡博, last modified on 四月 03, 2024

# 1. 概述

本文描述共享集群YCS支持动态参数修改测试设计。

SR：    [YDBRD-21390](https://jira.yasdb.com/browse/YDBRD-21390?src=confmacro)    -  YCS支持动态参数修改  验证中

开发设计文档：    [【YCS】YCS支持动态参数修改](135605485.html)  

测试概要设计：    [概要设计-19928](138555030.html)  

# 2. 需求分析

## 2.1 功能点分析

- 本SR主要是支持YCS的参数在线修改。


2.1.1 修改参数涉及的接口：

ycsctl set xxx value             动态修改xxx参数

ycsctl get xxx                      得到xxx参数

ycsctl show parameter        -get all yascs config parameter                       打印得到ycs的内部参数，即yascs.ini里的参数

### 2.1.2 支持在线修改的参数：

|序号|参数名|参数意义|应用场景|生效模式|参数类型|默认值|取值范围|可测约束|备注|
|---|---|---|---|---|---|---|---|---|---|
|1|RESTART_TIMES|数据库实例异常掉线时，Monitor重试拉起数据库实例的次数|YCS监控DB|即时生效|数值|3|[0,100]|必须在DB启动且在线的情况下修改或者是DB未启动的情况下修改|YDBRD-24201做优化|
|2|RESTART_INTERVAL|每次重试拉起数据库实例之后增加等待的时间步长，单位为s|YCS监控DB，DB下线后重拉|即时生效|30|30|[0,600]|必须在DB启动且在线的情况下修改或者是DB未启动的情况下修改或者restartTimes=0时修改|原参数STOP_STEP，需注意名字变更影响|
|3|AUTO_START|启动YCS时是否同时启动本节点上的数据库实例|YCS启动|重启YCS生效|字符串|ALWAYS|ALWAYS，NEVER|1.启动YCS的时候无法修改,2.执行ycsctl show parameter  不可修改,3.实际生效需要重启|  
|
|4|WAIT_STOP_FIN_TIME|YCS执行停止数据库脚本之后，等待其完全停止的时间，单位为s（秒）|主动停DB，由于DB处于reform导致停止时间过长|即时生效|数值|90|[0,300]|在主动停资源时禁止修改|主动停资源时修改会排队等待|
|5|LOG_LEVEL|指定运行日志级别|  
|即时生效|字符串|DEBUG|OFF，FATAL，ERROR，WARN，INFO，DEBUG，TRACE，ALL|仅涉及命令行help信息的修改，其他部分无变更|注意资料变更；并发控制|
|6|LOG_SIZE|指定每个运行日志文件的大小，超过将形成归档，并创建新的运行日志文件。|  
|即时生效|数值|20M|[1M,4G]|仅涉及命令行help信息的修改，其他部分无变更|注意资料变更；并发控制|
|7|LOG_NUMBER|指定运行日志文件同时存在的个数。|  
|即时生效|数值|10|[2,10000]|仅涉及命令行help信息的修改，其他部分无变更|注意资料变更，并发控制|


**备注：**  不在本SR测试范围内，即不支持动态修改的参数

|序号|参数名|参数意义|备注|
|---|---|---|---|
|1|_MONITOR_SWITCH|该参数控制监控的开关状态。|开发自测|
|2|DISK_HB_KEEP_ALIVE|指定YCS磁盘心跳超时时间，单位为s（秒）|YCR后续特性优化|
|3|NETWORK_HB_TIMEOUT|指定YCS网络心跳超时时间，单位为s（秒）|YCR后续特性优化|
|4|YCR_DISK|YCR盘路径|YCR后续特性优化|
|5|VOTING_DISK|VOTING_DISK盘路径|YCR后续特性优化|


### 2.1.3 并发控制

- 同一参数单节点并发，同一参数多节点并发，不同参数单节点并发
- 节点内并发控制继承ycsctl工具的最大并发数10。


### **2.1.4 一致性保证**

由于故障导致等导致设置中断的，保证YCS重启之后，内存和文件中参数的值一致。

## 2.2 应用场景

- 提供给用户动态修改YCS参数。
- 具体每个参数取值范围及适用场景均不同，详见2.1.2节表格.


## 2.3 规格约束

- 部署形态：集群
- 节点数目：  **本需求与节点数无关，**  以  **两节点**  需求转测
- 其他约束详见2.1.2节；参数约束场景之外的设置，并未做拦截，不允许core。


# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用场景法、正交组合法、边界值、无效等价法进行测试

- 针对接口的基本功能、各参数的生效机制及参数应用场景验证采用场景法设计。
- 针对接口的输入值、参数值设置等采用边界法、无效等价法进行测试。
- 针对并发测试，包括节点内、节点间等，主要采用场景法和正交组合法设计。


## 3.2 详细测试设计

### 3.2.1 接口测试

本部分仅测试接口层面，不针对任何参数。

ycsctl show parameter命令没有变化，之前SR针对这部分测试过，不再重复测试。

|  
|场景|场景细分|说明|备注|
|---|---|---|---|---|
|1|资料验证|新增接口描述set、get|原接口针对具体参数罗列，新接口需要综合所有参数在一条命令阐述|  
|
|2|help信息打印|新增help信息|原接口针对具体参数罗列，新接口需要综合所有参数在一条命令阐述|  
|
|3|  
|删除旧的命令信息|删除原对LOG相关具体参数的命令阐述|  
|
|4|语法验证|关键字错误|本部分关键字仅限ycsctl、set、get三个关键字，参数/参数值部分在3.2.2设计|  
|
|5|  
|关键字缺失|本部分关键字仅限ycsctl、set、get三个关键字，参数/参数值部分在3.2.2设计|  
|
|6|  
|多余指定关键字|本部分关键字仅限ycsctl、set、get三个关键字，参数/参数值部分在3.2.2设计|  
|
|7|  
|多余空格|关键字之间多余空格|  
|
|8|对YCSC的依赖|ycs未启动|执行set、get命令|  
|


### 3.2.2 动态修改参数公共场景

主要针对本SR新增的支持动态修改的参数：RESTART_TIMES、RESTART_INTERVAL、AUTO_START、WAIT_STOP_FIN_TIME；而LOG_LEVEL、LOG_SIZE、LOG_NUMBER主要关注help、资料信息等的变更，其他沿用已有用例测试即可。

|  
|场景|有效等价类|无效等价类|说明|
|---|---|---|---|---|
|1|资料验证|  
|  
|参数在set、get列表中|
|2|help信息打印|  
|  
|参数在set、get列表中|
|3|show命令查询|  
|  
|可以用show parameter查询到值|
|4|关键字输入|关键字正常|关键字缺失|  
|
|5|  
|  
|关键字多余|  
|
|6|  
|  
|关键字错误（含多余空格）|  
|
|7|设置参数值|中间值|  
|  
|
|8|  
|最大值|越界值--超过最大值|  
|
|9|  
|最小值|越界值--超过最小值|  
|
|10|  
|  
|参数值为空|  
|
|11|  
|  
|参数值为特殊字符|  
|


### 3.2.3 动态修改参数特定应用场景

对于故障场景，参数取值不再覆盖参数值的全部范围进行设置修改，主要修改参数为非默认值做验证即可。

3.2.3.1 RESTART_TIMES 

**约束为：**  必须在DB启动且在线的情况下修改或者是DB未启动（DB重新手动拉起生效）的情况下修改

**生效前提**  ：AUTO_START=ALWAYS情况下，修改DB配置，使得DB拉不成功，才能观测具体拉起次数。

|  
|场景|预期结果|备注|
|---|---|---|---|
|1|DB启动并在线时，命令修改RESTART_TIMES值，kill掉DB触发重拉流程|修改生效|如何观测？告警日志是否可以提供？--  提供告警|
|2|DB未启动时，命令修改RESTART_TIMES值，启动DB之后kill掉DB|修改生效|  
|
|3|DB在线且RESTART_TIMES=0情况下，kill DB之后修改RESTART_TIMES值为非0|值被修改，但功能不生效|需要重启|
|4|DB在线，RESTART_TIMES为0时，kill DB同时修改RESTART_TIMES值为非0|不core|可能被修改|
|5|DB在线，RESTART_TIMES不为0时，kill DB同时修改RESTART_TIMES值为其他非0值|不core|可能被修改|


#### 3.2.3.2 RESTART_INTERVAL

**约束为：**  必须在DB启动且在线的情况下修改或者是DB未启动的情况下修改或者restartTimes=0时修改

**生效前提**  ：依赖RESTART_TIMES不为0生效，且需要修改DB配置，使得DB拉不成功，才能观测具体拉起间隔变化。

|  
|场景|分场景|预期结果|备注|
|---|---|---|---|---|
|1|DB启动并在线且RESTART_TIMES不为0时命令修改RESTART_INTERVAL值，kill掉DB触发重拉流程|  
|生效|如何观察？|
|2|DB未启动且RESTART_TIMES不为0时，命令修改RESTART_INTERVAL值，启动DB之后kill掉DB|  
|生效|  
|
|3|DB在线且RESTART_TIMES=0时，killDB同时动态修改RESTART_INTERVAL|不重启|参数修改成功，功能不生效DB不被拉起|  
|
|4|  
|重启DB，修改RESATRT_TIMES为非0 kill DB|参数修改成功，功能生效DB被拉起间隔合理|  
|
|5|DB在线且RESTART_TIMES不为0时，kill DB同时动态修改RESTART_INTERVAL|  
|不core|  
|


#### 3.2.3.3   AUTO_START

**约束为：**  1.启动YCS的时候无法修改 2.执行ycsctl show parameter中无法修改 3.实际生效需要重启

|  
|场景|分场景|预期结果|备注|
|---|---|---|---|---|
|2|默认设置（AWALYS）情况下，YCS运行且DB在线时，命令修改AUTO_START为NEVER|不重启YCS|内存不修改，   文件修改，但不立刻生效|内存修改观测show parameter|
|3|  
|重启YCS|生效|  
|
|4|基于NEVER设置场景，YCS运行且DB不在线时，命令修改AUTO_START为ALWAYS|不重启YCS|内存不修改，  文件修改，但不立刻生效|  
|
|5|  
|重启YCS|生效|  
|


#### 3.2.3.4 WAIT_STOP_FIN_TIME

**约束为：**  1.在主动停资源（DB、YFS）时无法修改

这个参数需要开发提供埋点，卡住stop流程。  -- 不提供埋点，清空stop_instance.sh文件

|  
|场景|分场景|预期结果|备注|
|---|---|---|---|---|
|1|集群正常运行时，动态修改WAIT_STOP_FIN_TIME，  清空stop_instance.sh文件  ，下发停DB命令|修改为0|DB挂住无法停止|  
|
|2|  
|修改为30|DB在30秒后强制停止|  
|
|3|集群运行过程中，动态修改备节点WAIT_STOP_FIN_TIME；触发网络故障+  YCS_RM_FAULT_POINT_23埋点|修改为0|备DB无法停止，备节点重启流程挂住|  
|
|4|  
|修改为60|备DB 30+60秒后强制停止，备节点重启|  
|
|5|集群正常运行时，动态修改WAIT_STOP_FIN_TIME为非默认，同时stop DB|  
|主动停资源时修改会排队等待|  
|


#### 3.2.3.5 LOG相关的参数

复用已有用例，重点关注并发控制（3.2.4节）。

### 3.2.4 并发控制 

本部分针对所有参数支持动态修改的参数：RESTART_TIMES、RESTART_INTERVAL、AUTO_START、WAIT_STOP_FIN_TIME、LOG_LEVEL、LOG_SIZE、LOG_NUMBER

由于并发情况下，命令先后处理顺序不可预判，同意一参数修改结果根据具体场景分析在设置值范围里即可视为合理。

|  
|场景|分场景1|分场景2|分场景3|预期结果|参数选取|备注|
|---|---|---|---|---|---|---|---|
|1|写并发|同一参数单节点内并发动态修改|修改为不同值|超过并发数|并发报错，未报错命令修改成功，具体值不可预判|针对所有参数|  
|
|2|  
|  
|  
|不超过并发数|不可预判具体数值|针对所有参数|  
|
|3|  
|  
|修改为相同值（非默认）|超过并发数|超过并发；未报错命令修改成功|针对所有参数|  
|
|4|  
|  
|  
|不超过并发|修改成功|针对所有参数|  
|
|5|  
|同一参数不同节点并发动态修改|修改为相同值|  
|修改成功|针对所有参数|  
|
|6|  
|  
|修改为不同值|不重启|修改成功|针对所有参数|  
|
|7|  
|  
|  
|重启|系统正常重启，不同节点不同值互不影响|针对所有参数|  
|
|8|  
|不同参数设置单节点内并发动态修改|  
|不超过并发数|所有参数修改成功|使用正交组合法组合不同参数|  
|
|9|  
|  
|  
|超过并发数|超过并发的参数修改失败|使用正交组合法组合不同参数|  
|
|10|读写并发|同一参数单节点内读写并发|  
|不超过并发数|读到旧值新值均未合理|针对所有参数|  
|
|11|  
|  
|  
|超过并发数|失败命令不执行|针对所有参数|  
|
|12|  
|同一参数不同节点之间读写并发|  
|  
|互不影响|针对所有参数|  
|
|13|  
|不同参数单节点内读写并发|  
|不超过并发数|执行成功|使用正交组合法组合不同参数|  
|
|14|  
|  
|  
|超过并发数|超过并发数的执行失败，其他执行成功|使用正交组合法组合不同参数|  
|
|15|读并发|同一参数单节点内读|  
|超过并发数|  
|针对所有参数|  
|
|16|  
|  
|  
|不超过并发数|  
|针对所有参数|  
|
|17|  
|同一参数不同节点间并发读|  
|  
|互不影响|针对所有参数|  
|
|18|  
|不同参数单节点内并发读|  
|超过并发|  
|使用正交组合法组合不同参数|  
|
|19|  
|  
|  
|不超过并发|  
|使用正交组合法组合不同参数|  
|


### 3.2.5 一致性测试

这部分需要开发提供埋点，在修改内存与修改文件的流程中间卡住，做一致性验证。

本部分针对所有参数支持动态修改的参数：RESTART_TIMES、RESTART_INTERVAL、AUTO_START、WAIT_STOP_FIN_TIME、LOG_LEVEL、LOG_SIZE、LOG_NUMBER

|  
|场景|分场景|预期结果|备注|
|---|---|---|---|---|
|1|集群运行正常，注入埋点，动态修改参数值|观察show parameter命令呈现、文件表现|文件修改   内存不修改|  
|
|2|  
|kill YCS并重启|内存与文件一致|  
|
|3|集群运行正常，设置参数同时kill ycs|拉起YCS观察|  
|  
|
|4|集群运行正常，设置参数时延1s kill ycs|拉起YCS观察|  
|  
|


### 3.2.6 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|---|---|
|CT|并发控制已经考虑，用HA框架实现|
|KT|参数涉及故障场景已经考虑，用HA框架实现|
|长稳|不涉及，本SR不涉及DB业务|
|一致性|一致性场景已经考虑|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，本SR不涉及DB业务|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|故障场景已经考虑|
|HA|不涉及主备集群|
|压力|不涉及，本SR不涉及DB业务|
|性能|不涉及，本SR不涉及DB业务|
|可维护性|本SR所有用例均会自动化看护|


  


# 4. 测试用例

[【冒烟用例】YDBRD-21390 YCS支持动态参数修改.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjg4OTcwYzJhZjRmNTIwZTA5IiwicmVmX2lkIjoiNjczOTZjYjg1OTNmOTljOWZmMjM3MjUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTY3LCJleHAiOjE3ODIzODkzNjd9.9pvWWiCSmV_rTwpUBatOFSHlSy9lWaMtyh3tjP4mRSQ)

[YDBRD-21390 YCS支持动态参数修改module_V1.1.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjhhMWFkOWEzMzExZGM4YzdhIiwicmVmX2lkIjoiNjczOTZjYjg1OTNmOTljOWZmMjM3MjUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTY3LCJleHAiOjE3ODIzODkzNjd9.p1OJ-hhZCZpuAfkuN9_Zgh9UX97ehCXlSarORn7Q0yw)

# 5. 测试框架设计

本次测试使用Guider框架和HA框架实现。

  


Guider新增入口：

@clusterTool ycs ${YASCS_HOME} set_param param value;    
  转化成：    
  python3 yat-master/pymodule/cluster/cluster_tool/cluster_ycsctl.py --home_path ${YASCS_HOME} --operate_type set_param --param_list "param, value"

@clusterTool ycs ${YASCS_HOME} get_param param;    
  转化成：    
  python3 yat-master/pymodule/cluster/cluster_tool/cluster_ycsctl.py --home_path ${YASCS_HOME} --operate_type get_param --param_list "param"

@clusterTool ycs ${YASCS_HOME} show_param;    
  转化成：    
  python3 yat-master/pymodule/cluster/cluster_tool/cluster_ycsctl.py --home_path ${YASCS_HOME} --operate_type show_param

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

工作量：6人天

计划测试完成时间：2023/12/28（前提12.20转测）

  


## Attachments:

[【冒烟用例】YDBRD-21390 YCS支持动态参数修改.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjg4OTcwYzJhZjRmNTIwZTA5IiwicmVmX2lkIjoiNjczOTZjYjg1OTNmOTljOWZmMjM3MjUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTY3LCJleHAiOjE3ODIzODkzNjd9.9pvWWiCSmV_rTwpUBatOFSHlSy9lWaMtyh3tjP4mRSQ)

 (text/plain)    


[YDBRD-21390 YCS支持动态参数修改module_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjhhMWFkOWEzMzExZGM4YzdiIiwicmVmX2lkIjoiNjczOTZjYjg1OTNmOTljOWZmMjM3MjUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTY3LCJleHAiOjE3ODIzODkzNjd9.VlbLfq1fgq1TS37OMkKZ2BzXo7R5Ivdvo7BnA6FC4Ds)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-21390 YCS支持动态参数修改module_V1.1.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjhhMWFkOWEzMzExZGM4YzdhIiwicmVmX2lkIjoiNjczOTZjYjg1OTNmOTljOWZmMjM3MjUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTY3LCJleHAiOjE3ODIzODkzNjd9.p1OJ-hhZCZpuAfkuN9_Zgh9UX97ehCXlSarORn7Q0yw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,【YDBRD-21365 支持两节点故障恢复 】YCS模块重构测试设计评审会议纪要     
  一、会议时间：2023/12/20 周三16：00-17:10    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：李垠、杜宇轩、张丽红、徐凡博    
  五、会议主题：【YDBRD-21390 YCS支持动态参数修改】测试设计评审,会议纪要：    
  1、AUTO_START动态修改未重启前，ycsctl show parameter需显示之前的值    
  2、WAIT_STOP_FIN_TIME在主动停资源时动态修改会排队等待    
  3、在规格约束中要写清楚“本需求与节点数无关”，因此目前才可以用两节点转测    
  4、接口语法层面需要添加一下“多余空格”的用例    
  5、对于RESTART_TIMES和RESTART_INTERVAL参数的测试需要开发提供告警日志    
  6、WAIT_STOP_FIN_TIME卡住stop流程开发自验时考虑提供可执行手段    
  7、一致性测试方面，考虑提供业务场景，采用并发或者延时方式检测。,  
  测试设计文档：    
  ---     [https://conf.yasdb.com/pages/viewpage.action?pageId=138551600](https://conf.yasdb.com/pages/viewpage.action?pageId=138551600)  ,Posted by xufanbo at 十二月 20, 2023 17:25|
|---|
