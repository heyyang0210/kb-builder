Created by 张茜, last modified on 三月 05, 2024

# 1. 概述

本文描述共享集群支持多节点iofence测试设计。

SR：     [YDBRD-21385](https://jira.yasdb.com/browse/YDBRD-21385?src=confmacro)    -  IOFENCE优化  资料整理

开发设计文档：    [YCS IO保护优化详细设计方案 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144123849)  

# 2. 需求分析

## 2.1 功能点分析

本SR是原iofence SR的优化补充。因此首先明确iofence基本功能：  ycs服务端和ycs客户端(yasdb)分别完成对在途IO的保护，在YCS主节点给yasdb选新主前需要确保无在途IO；或磁盘心跳超时，在yasdb感知到被驱逐、与服务端网络心跳超时或服务端进程异常等，退出前需要阻断在途IO。

当集群选举完成，新主（ycs、yfs）产生后，由新主检测磁盘中原db主的在途IO数，当这个数量为0时，新主才能正式升主且稳定运行。

此SR和旧IOFENCE方案的区别主要在于针对  IO数量记录时机：

旧方案：

IO数量记录先是存在内存，再由ycs和db磁盘心跳周期将io数量写入磁盘。

优化后方案：

IO数量记录直接写入磁盘。且写入磁盘的时机触发有：

1、yfs写触发（yfscmd -D ycs_home 'touch xx'）和db写触发

2、ycs磁盘心跳和db磁盘心跳周期写盘

## 2.2 应用场景

集群在发生网络故障、磁盘心跳故障、进程异常等异常情况时，需要对DB的在途IO进行保护。

## 2.3 规格约束

1、部署形态：集群

2、不支持集群HA模式

3、节点数目：2 （只测两节点）

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用场景法、错误推测法。

## 3.2 详细测试设计

本SR会与多节点iofence SR、故障SR有所重叠，因此主要针对性  yfs写触发和db写触发写io数量进行  补充测试。

因此该SR可复用之前的iofence和故障SR测试用例，并针对性补充测试场景，主要补充场景为：yfs业务写、db业务写操作触发io数量写磁盘动作时故障模拟，模拟故障处理时可能存在在途io的场景、以及新增埋点的补充测试。

细化后补充场景为：

1、故障类型：kill -19/kill -18，磁盘故障YCS_RM_FAULT_POINT_27，网络延迟、丢包、断网卡、kill -9 （  ~~kill -15、reboot ？？？~~  ）

2、写操作时，故障ycs（主备故障均覆盖），模拟可能存在io不为0即有在途io时，存活节点的处理表现（  查看在途io接口？？？--ycsdump其他节点查看磁盘io，本节点查看内存io，埋点打运行日志  ）

     1）后台循环DB业务写操作前提下，构造故障场景，模拟可能存在在途io的场景

     2）后台循环yfs业务写操作前提下，构造故障场景，模拟可能存在在途io的场景

     3）后台循环db&&yfs业务写操作前提下，构造故障场景，模拟可能存在在途io的场景

|场景|过程|通用场景|测试责任人|结果|
|---|---|---|---|---|
|带DB业务|2节点yasql触发db同时写同时读的前提下  ，kill -19  **（pstack 保存堆栈辅助开发定位问题）**  ,kill -18 主节点/备节点、|**心跳裁决要考虑小于30，等于30，大于30，比如600s**|徐凡博|观察要被fence掉的节点在途io数量，是否有不为0的情况，如果存在，等待io变为0之后，主节点fence掉后，查看topo变为offline以及查看日志。    
    
    
    
    
    
    
    
,  
|
|带DB业务|2节点yasql触发db同时写同时读的前提下  ，网络延迟主节点/备节点  ||徐凡博||
|带DB业务|2节点yasql触发db同时写同时读的前提下  ，丢包主节点/备节点  ||徐凡博||
|带DB业务|2节点yasql触发db同时写同时读的前提下  ，断网卡主节点/备节点  ||张茜||
|带DB业务|2节点yasql触发db同时写同时读的前提下  ，YCS_RM_FAULT_POINT_27主节点/备节点  ||张茜||
|带DB业务|2节点yasql触发db同时写同时读的前提下  ，kill -9 主节点/备节点  ||张茜||
|带yfs业务|2节点ysfcmd触发yfs同时写同时读的前提下  ，kill -19,kill -18主主节点/备节点 ||张茜||
|带yfs业务|2节点ysfcmd触发yfs同时写同时读的前提下  ，网络延迟主节点/备节点  ||张茜||
|带yfs业务|2节点ysfcmd触发yfs同时写同时读的前提下  ，丢包主节点/备节点  ||张茜||
|带yfs业务|2节点ysfcmd触发yfs同时写同时读的前提下  ，断网卡主节点/备节点  ||徐凡博||
|带yfs业务|2节点ysfcmd触发yfs同时写同时读的前提下  ，YCS_RM_FAULT_POINT_27主节点/备节点  ||徐凡博||
|带yfs业务|2节点ysfcmd触发yfs同时写同时读的前提下  ，kill -9 主节点/备节点  ||徐凡博||
|同时带db和yfs业务|2节点yasql触发db和ysfcmd触发yfs同时写同时读的前提下  ，kill -19,kill -18主节点/备节点  ||张茜||
|同时带db和yfs业务|2节点yasql触发db和ysfcmd触发yfs同时写同时读的前提下  ，网络延迟主节点/备节点  ||张茜||
|同时带db和yfs业务|2节点yasql触发db和ysfcmd触发yfs同时写同时读的前提下  ，丢包主节点/备节点  ||徐凡博||
|同时带db和yfs业务|2节点yasql触发db和ysfcmd触发yfs同时写同时读的前提下  ，断网卡主节点/备节点  ||徐凡博||
|同时带db和yfs业务|2节点yasql触发db和ysfcmd触发yfs同时写同时读的前提下  ，YCS_RM_FAULT_POINT_27主节点/备节点  ||徐凡博||
|同时带db和yfs业务|2节点yasql触发db和ysfcmd触发yfs同时写同时读的前提下  ，kill -9 主节点/备节点  ||张茜||


3、覆盖新增埋点，

FP_YCS_IOGUARD_61~FP_YCS_IOGUARD_70

*ycsctl set _fault_point  '*  *FP_YCS_IOGUARD_61*  *'     --*  设置故障点

*ycsctl set _fault_point *   'CLEAN_ALL'                     --清理全部

|**场景**|**过程**|**结果**|
|---|---|---|
|ycs、db磁盘心跳卡住（模拟kill 19/18发生在绿色区域）|执行业务，设置故障点FP_YCSC_IOGUARD_61，同时设置FP_YCS_RM_25（卡住主db磁盘心跳），主ycs的FP_YCS_MONITOR_5（ycs磁盘心跳卡住）故障点，触发备升主，备升主后，取消所有故障点|日志报错begin write failed, failde to check node evicted，不会出现双主，不core|
|db前序db io未完成写盘|执行业务，设置故障点FP_YCSC_IOGUARD_62，业务卡住，取消故障点FP_YCSC_IOGUARD_62，业务继续执行|业务执行成功，设置故障点时，日志中打印[YCSC] wait pre io flushed, writeCount，取消故障点会打印[YCSC] wait pre io flushed out|
|db io 数从非零递增|执行业务，观察日志|业务执行成功，日志中[YCSC] db begin write, not force writeCount后面打印的数目必须是大于1。观察是否产生core文件，不产生core文件为正确|
|db io保护门槛用例|详见用例  **（埋点节点的在途io不为0，然后埋点卡住在途io写，构造该节点故障kill -9。存活节点升主的时候查看到故障节点的io不为0，就是卡住，卡个多长时间日志是一直检测处理还是多长时间之后报错，一定时间取消卡住在途io写的故障点，io为0了，存活节点正常升主）**  **–kill -19故障场景补充**|  
|
|(验证yfs io 保护)ycs磁盘心跳卡住（模拟kill 19/18发生在绿色区域）|执行业务，设置故障点FP_YCS_IOGUARD_63，设置主ycs的FP_YCS_MONITOR_5（ycs磁盘心跳卡住）故障点，触发备升主，备升主后，取消所有故障点|日志报错[YCS RM]yfs begin write failed, master is not self，不会出现双主，不core|
|yfs前序yfs io未完成写盘|执行业务，设置故障点FP_YCS_IOGUARD_64，业务卡住，取消故障点FP_YCS_IOGUARD_64，业务继续执行|业务执行成功，设置故障点时，日志中打印[YCS] wait pre yfs io flushed, writeCount，取消故障点会打印[YCS] wait pre yfs io flushed out, writeCount|
|yfs io 数从非零递增|执行业务，观察日志|业务执行成功，日志中[YCS RM] yfs begin write, not force writeCount后面打印的数目必须是大于1。观察是否产生core文件，不产生core文件为正确|


**注：3节点同理操作，并且构造多节点同时执行业务时，构造多节点同时故障**

4、RTO用例复用执行

记录：

5、tpcc性能测试用例执行

记录：不能相差1s左右

6、  ycsdump线上观察工具

[IOFENCE优化.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjdhMWFkOWEzMzExZGM4Yzc1IiwicmVmX2lkIjoiNjczOTZjYjY3MjgyMDZlZmI5MmYxNjE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTM2LCJleHAiOjE3ODIzODkzMzZ9.T0BcRN8FDhYniqXg2U3H5QnsZO6smuZBmPf5JisKVkI)

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，并发测试已经考虑，主要是业务和故障的并发，用HA框架实现|
|KT|是，本SR主要是构造场景为故障场景，因此故障场景已经考虑，用HA框架实现|
|长稳|不涉及，本SR不涉及DB业务|
|一致性|不涉及，一致性部分在故障SR中考虑|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，本SR主要利用IO埋点进行测试，业务部分由故障SR覆盖|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|是，故障场景已经考虑|
|HA|不涉及主备集群|
|压力|不涉及，本SR不涉及DB业务|
|性能|不涉及，本SR不涉及DB业务|
|可维护性|是，本SR所有用例均会自动化看护|


## **4、测试用例**

**开发门槛用例：**

[iofence优化--冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjdhMWFkOWEzMzExZGM4Yzc2IiwicmVmX2lkIjoiNjczOTZjYjY3MjgyMDZlZmI5MmYxNjE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTM2LCJleHAiOjE3ODIzODkzMzZ9.HUH00cA-BFq2u81yGt0Tnrkop5qkutl9Pd9QvaD9-0g)

**测试用例：**

## **5、测试框架设计**

本次测试使用HA框架实现

## **6、测试环境说明**

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|集群|


## **7. 工作量评估**

工作量：10人天

## Attachments:

[iofence优化--冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjdhMWFkOWEzMzExZGM4Yzc2IiwicmVmX2lkIjoiNjczOTZjYjY3MjgyMDZlZmI5MmYxNjE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTM2LCJleHAiOjE3ODIzODkzMzZ9.HUH00cA-BFq2u81yGt0Tnrkop5qkutl9Pd9QvaD9-0g)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[IOFENCE优化.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjc4OTcwYzJhZjRmNTIwZTA2IiwicmVmX2lkIjoiNjczOTZjYjY3MjgyMDZlZmI5MmYxNjE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTM2LCJleHAiOjE3ODIzODkzMzZ9.mLvfNOepsGNeFIdY1vi98q8vL3R79pajcVONx4eO9DU)

 (application/x-xmind)    


[IOFENCE优化.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYjdhMWFkOWEzMzExZGM4Yzc1IiwicmVmX2lkIjoiNjczOTZjYjY3MjgyMDZlZmI5MmYxNjE3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyOTM2LCJleHAiOjE3ODIzODkzMzZ9.T0BcRN8FDhYniqXg2U3H5QnsZO6smuZBmPf5JisKVkI)

 (application/x-xmind)    


## Comments:

|  [](null)  ,一、会议时间：2024/2/23 周五10:30-11:30    
  二、会议地点：线上会议    
  三、会议主持人：张茜    
  四、参会人员：Trump、李垠、马勇、陈俊杰、吕雷奇、徐凡博、张茜    
  五、会议主题：【YDBRD-21385】IOFENCE优化 -- 测试设计    
  会议纪要：    
  1、补充场景：在途io不为0埋点卡住不写为0的情况下，构造kill -19 场景    
  2、所有牵扯还原故障场景，比如kill -18 要覆盖大于设置时间，小于，等于场景（心跳裁决设置时间只覆盖较小的5s场景）。    
  3、开发单元测试需要覆盖在途io不为0时，查看io数量确保不为0，以及在io不为0的前提下构造真实故障场景（比如网络延迟）,遗留问题：    
  开发单元测试需要覆盖在途io不为0时，查看io数量确保不为0，以及在io不为0的前提下构造真实故障场景（比如网络延迟） --李垠,测试设计文档：    
    [https://conf.yasdb.com/pages/viewpage.action?pageId=144129834](https://conf.yasdb.com/pages/viewpage.action?pageId=144129834)  ,Posted by zhangqian at 二月 23, 2024 11:55|
|---|
