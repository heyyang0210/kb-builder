Created by 徐凡博, last modified on 三月 04, 2024

# 1. 概述

本文描述共享集群支持多节点iofence测试设计。

SR：    [YDBRD-22514](https://jira.yasdb.com/browse/YDBRD-22514?src=confmacro)    -  支持多节点iofence  完成

开发设计文档：    [ycs去依赖SCSI——IOFENCE](133575533.html)     （去scsi版修改）

# 2. 需求分析

## 2.1 功能点分析

本SR是原iofence SR的补充，主要针对已有的测试设计方案（已有自动化维护）    [【YDBRD-15216 & YDBRD-21695】【共享集群YCS去scsi】支持IOFENCE--测试设计](133589348.html)    进行场景补充测试。

其新增的功能点主要是”在YCS主节点更新topo中yasdbMap前需要确保该db已无在途IO或磁盘心跳超时”。

  


重点重申在途IO保护的原则：  **所有被驱逐的节点在途IO都需要处理之后才能下线。**  尤其是DB主对应YCS被驱逐，需要进行DB iofence的场景下，需先等待DB主的IO处理完之后，才更新Topo，避免数据不一致问题。

所以，新增的场景主要是YCS异常，DB成为孤儿进程时，对于DB拓扑状态的更新流程以及这块对在途IO的处理影响。

同时，需要明确的场景：

1、若ycs被kill后马上拉起来，DB能解除fence不abort；

2、距离上一次写入心跳超过了磁盘心跳时间，也需要iofence。（这部分场景构造比较难卡，由开发UT覆盖）

## 2.2 应用场景

集群在发生网络故障、磁盘心跳故障、进程异常等情况时，需要对DB的在途IO进行保护。

## 2.3 规格约束

1、部署形态：集群

2、不支持集群HA模式

3、节点数目：2 （裁剪后，只测两节点）

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试设计主要采用场景法、错误推测法  。

## 3.2 详细测试设计

本SR主要针对性地补充测试，会与多节点故障SR有所重叠。

带业务场景本SR不再单独测试，由多节点故障覆盖，本SR主要通过埋点进行在途IO是否存在的测试。

### 3.2.1 主YCS与主DB在同一节点

alter system set _FAULT_POINT = 'YCS_RM_FAULT_POINT_23' scope = memory;   

alter system set _FAULT_POINT = 'CLEAN_YCS_RM_FAULT_POINT_23' scope = memory;

|  
|场景|同节点DB在途IO情况|预期结果|备注|测试记录|结论|
|---|---|---|---|---|---|---|
|1|主YCS进程发生异常|无在途IO|TOPO: 磁盘心跳超时选举，新主更新YCS和YFS拓扑，之后根据在途IO情况更新DB topo,IOFENCE：10秒后fence, abort|DB abort前会写入磁盘心跳信息，YCS可根据这部分更新topo|新主产生之后原主YCS和原主DB几乎同时offline(DB晚一秒),kill: 17:10:27 ,fence&abort: 17:10:37,offline: 17:10:57|符合预期|
|2|  
|有在途IO，超时前可清除|TOPO: 磁盘心跳超时选举，新主更新YCS和YFS拓扑，之后根据在途IO情况更新DB topo,IOFENCE：10秒后fence, 清除掉后abort|  
|清除埋点后DB状态变化|符合预期|
|3|  
|有在途IO，不可清除（埋点）|TOPO: 磁盘心跳超时选举，新主更新YCS和YFS拓扑，之后根据在途IO情况更新DB topo,IOFENCE：10秒后fence, 有在途IO会有磁盘心跳写入，所以一直挂着|23号会写心跳，db一直挂着 abort不掉,1号埋点待确认|不清楚，一直挂着|符合预期|
|4|主DB进程发生异常|有无在途IO一样|直接更新TOPO|AUTO_START=NEVER|  
|符合预期|
|5|备YCS进程发生异常|无在途IO|TOPO: 主YCS更新YCS和YFS拓扑，写入磁盘，之后根据在途IO情况更新DB topo,IOFENCE:主YCS更新topo之后，备DB进行fence，abort|  
|TOPO很快更新,备DB很快就fence abort了|符合预期|
|6|  
|有在途IO，超时前可清除|TOPO: 主YCS更新YCS和YFS拓扑，写入磁盘，之后根据在途IO情况更新DB topo,IOFENCE:主YCS更新topo之后，备DB进行fence，清除后abort|  
|TOPO很快更新,备DB在io清除后就fence abort了|符合预期|
|7|  
|有在途IO，不可清除（埋点）|TOPO: 主YCS更新YCS和YFS拓扑，写入磁盘，之后根据在途IO情况更新DB topo,IOFENCE:主YCS更新topo之后，备DB进行fence，有在途IO会有磁盘心跳写入，所以一直挂着|  
|TOPO很快更新,备DB随着IO hang一直挂着|符合预期|
|8|备DB进程发生异常|有无在途IO一样|直接更新TOPO|  
|  
|符合预期|
|9|主YCS与主DB同时发生异常|有无在途IO一样|TOPO: 磁盘心跳超时选举，新主更新YCS和YFS拓扑,DB：YCS磁盘心跳监控同步检查主DB磁盘心跳超时后，待上面的YCS主选好之后选DB主|原db主的topo在YCS新主产生后一两秒内更新为offline|  
|符合预期|
|10|主YCS与备DB同时发生异常|无在途IO|主节点关于在途IO的表现同场景1，2，3,备节点切主成功后，更新所有状态|更新滞后,test_sdv_ydbrd_22514_iofence_kill_same_node_009.py,  [YDBRD-26835](https://jira.yasdb.com/browse/YDBRD-26835?src=confmacro)    -  【集群】YCS主DB主同节点部署时，同时kill主YCS和备DB，备DB的topo更新为offline时间超过预期  解决关闭|已经解决|bug|
|11|  
|有在途IO，超时前可清除|TOPO: 磁盘心跳超时选举，新主更新YCS和YFS拓扑，之后根据在途IO情况更新DB topo,IOFENCE：10秒后fence, 清除掉后abort,备节点切主成功后，更新所有状态|现有bug    [YDBRD-26215](https://jira.yasdb.com/browse/YDBRD-26215?src=confmacro)    -  【CI】DB故障场景中，YCS下发topo不正确，导致DB加入卡住  解决关闭,test_sdv_ydbrd_22514_iofence_kill_same_node_010.py|已经解决|bug|
|12|  
|有在途IO，不可清除（埋点）|TOPO: 磁盘心跳超时选举，新主更新YCS和YFS拓扑，之后根据在途IO情况更新DB topo,IOFENCE：10秒后fence, 有在途IO会有磁盘心跳写入，所以一直挂着,备节点切主成功后，更新所有状态|  
|  
|同上|
|13|备YCS与主DB同时发生异常|无在途IO|TOPO: 主YCS更新YCS和YFS拓扑，写入磁盘，之后根据在途IO情况更新DB topo,IOFENCE:主YCS更新topo之后，备DB进行fence，abort|11与5一样|  
|符合预期|
|14|  
|有在途IO，超时前可清除|TOPO: 主YCS更新YCS和YFS拓扑，写入磁盘，之后根据在途IO情况更新DB topo,IOFENCE:主YCS更新topo之后，备DB进行fence，清除后abort|  
|  
|符合预期|
|15|  
|有在途IO，不可清除（埋点）|TOPO: 主YCS更新YCS和YFS拓扑，写入磁盘，之后根据在途IO情况更新DB topo,IOFENCE:主YCS更新topo之后，备DB进行fence，有在途IO会有磁盘心跳写入，所以一直挂着|  
|  
|符合预期|
|16|备YCS与备DB同时发生异常|有无在途IO一样|直接更新YCS topo,备DB topo更新需要等磁盘心跳时间|满等30秒的场景|  
|符合预期|
|17|主备DB同时发生异常|有无在途IO一样|直接更新topo|  
|  
|符合预期|
|18|主YCS被kill后快速拉起|  
|  
|  [YDBRD-26845](https://jira.yasdb.com/browse/YDBRD-26845?src=confmacro)    -  【集群在途IO保护】ycs进程被kill后，DB正在ioFenced，ycs无法正常拉起  解决关闭|  [多节点iofence 冒烟用例自测记录](https://conf.yasdb.com/pages/viewpage.action?pageId=144117954)  |质量加固|
|19|备YCS备kill后快速拉起|  
|  
|  [YDBRD-26845](https://jira.yasdb.com/browse/YDBRD-26845?src=confmacro)    -  【集群在途IO保护】ycs进程被kill后，DB正在ioFenced，ycs无法正常拉起  解决关闭|  [多节点iofence 冒烟用例自测记录](https://conf.yasdb.com/pages/viewpage.action?pageId=144117954)  |质量加固|
|20|卡住主DB心跳|  
|心跳超时后后，取消故障|iofence,abort|  
|  
|
|21|卡住备DB心跳|  
|心跳超时后后，取消故障|iofence,abort|  
|  
|


### 3.2.2 主YCS与主DB不在同一节点（主YCS与备DB在一个节点）

|  
|场景|同节点DB在途IO情况|预期结果|备注|测试记录|结论|
|---|---|---|---|---|---|---|
|1|主YCS进程发生异常|无在途IO|TOPO：备YCS需要等待磁盘心跳时间后选举，切主，更新YCS和YFS topo,备DB：10秒后fence, abort，topo在YCS新主产生后更新|  
|17:50:58 备DB 10秒后fence 17:51:08,新主产生之后原主YCS和原备DB几乎同时offline(DB晚一秒)17:51:30|符合预期|
|2|  
|有在途IO，超时前可清除|TOPO：备YCS需要等待磁盘心跳时间后选举，切主，更新YCS和YFS topo,备DB：10秒后fence, 清除后abort，topo在YCS新主产生后更新|  
|  
|符合预期|
|3|  
|有在途IO，不可清除（埋点）|TOPO: 磁盘心跳超时选举，新主更新YCS和YFS拓扑，之后根据在途IO情况更新DB topo,备DB：10秒后fence, 有在途IO会有磁盘心跳写入，所以一直挂着，topo无法更新|  
|  
|符合预期|
|4|主DB进程发生异常|有无在途IO一样|因为备YCS在，所以可以直接更新topo|  
|  
|符合预期|
|5|备YCS进程发生异常（主DB在一个节点）|无在途IO|YCS TOPO：主YCS更新YCS和YFS拓扑，写入磁盘,主DB：根据更新的topo感知到YCS异常，进行fence，abort|  
|  
|符合预期|
|6|  
|有在途IO，超时前可清除|YCS TOPO：主YCS更新YCS和YFS拓扑，写入磁盘,主DB：根据更新的topo感知到YCS异常，进行fence，清除IO后abort|  
|  
|符合预期|
|7|  
|有在途IO，不可清除（埋点）|YCS TOPO：主YCS更新YCS和YFS拓扑，写入磁盘,主DB：根据更新的topo感知到YCS异常，进行fence，有在途IO会有磁盘心跳写入，所以一直挂着|  
|  
|  
|
|8|备DB进程发生异常|有无在途IO一样|主YCS在，所以立马能更新TOPO|  
|  
|符合预期|
|9|主YCS与主DB同时发生异常|无在途IO|备节点等待磁盘心跳时间超时后，切主，更新YCS和YFS状态,主DB：  ~~由磁盘心跳监控流程，发现DB主心跳超时，等待磁盘心跳超时时间（与检查主YCS的心跳并行），YCS新主选出后更新topo   ~~,备DB：10秒后感知到主YCS异常，fence，根据在途IO情况进行abort,最终是新YCS更新所有状态|看最终表现,只有新主产生之后才能拉起DB,中间状态重试拉起DB是合理？,问题单    [YDBRD-26215](https://jira.yasdb.com/browse/YDBRD-26215?src=confmacro)    -  【CI】DB故障场景中，YCS下发topo不正确，导致DB加入卡住  解决关闭|  
|符合预期|
|10|  
|有在途IO，超时前可清除|同上，等IO清除abort|  
|  
|符合预期|
|11|  
|有在途IO，不可清除（埋点）|同上，IO清除不掉，备DB一直挂着|  
|  
|符合预期|
|12|主YCS与备DB同时发生异常|有无在途IO一样|TOPO:备节点等磁盘心跳超时后，切主更新YCS和YFS topo,备DB: 新YCS主出现之后再等待磁盘心跳时间后，更新topo|~~满等30秒的场景~~,不需要等，30多秒即可更新|  
|符合预期|
|13|备YCS与主DB同时发生异常|有无在途IO一样|TOPO: YCS topo直接更新,主DB：磁盘心跳监控发现主DB异常，磁盘心跳超时后后选新DB主，之后更新topo|  
,offline offline online场景 满等30秒|  
|符合预期|
|14|备YCS与备DB同时发生异常|主DB无在途IO|TOPO：备节点TOPO立马更新，备DB TOPO立马更新,主DB：  主DB能从磁盘上检查到本节点被踢出集群，一两秒就会fence  ，abort|主DB能从磁盘上检查到本节点被踢出集群，一两秒就会fence|  
|符合预期|
|15|  
|主DB有在途IO，超市前可清除|TOPO：备节点TOPO立马更新，备DB TOPO立马更新,主DB：  主DB能从磁盘上检查到本节点被踢出集群，一两秒就会fence  ，abort|  
|  
|符合预期|
|16|  
|有在途IO，不可清除（埋点）|TOPO：备节点TOPO立马更新，备DB TOPO立马更新,主DB：  主DB能从磁盘上检查到本节点被踢出集群，一两秒就会fence  ，无法abort|  
|  
|符合预期|
|17|主备DB同时发生异常|有无在途IO一样|直接更新TOPO|  
|  
|符合预期|
|18|主YCS被kill后快速拉起|  
|  
|  [YDBRD-26845](https://jira.yasdb.com/browse/YDBRD-26845?src=confmacro)    -  【集群在途IO保护】ycs进程被kill后，DB正在ioFenced，ycs无法正常拉起  解决关闭|  [多节点iofence 冒烟用例自测记录](https://conf.yasdb.com/pages/viewpage.action?pageId=144117954)  |质量加固|
|19|备YCS备kill后快速拉起|  
|  
|  [YDBRD-26845](https://jira.yasdb.com/browse/YDBRD-26845?src=confmacro)    -  【集群在途IO保护】ycs进程被kill后，DB正在ioFenced，ycs无法正常拉起  解决关闭|  [多节点iofence 冒烟用例自测记录](https://conf.yasdb.com/pages/viewpage.action?pageId=144117954)  |质量加固|
|20|卡住主DB心跳|  
|心跳超时后后，取消故障|iofence,abort|  
|  
|
|21|卡住备DB心跳|  
|心跳超时后后，取消故障|iofence,abort|  
|  
|


  


## 3.3 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|---|---|
|CT|并发测试已经考虑，主要是业务和故障的并发，用HA框架实现|
|KT|本SR主要是故障测试，因此故障场景已经考虑，用HA框架实现|
|长稳|不涉及，本SR不涉及DB业务|
|一致性|不涉及，一致性部分在故障SR中考虑|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，本SR主要利用IO埋点进行测试，业务部分由故障SR覆盖|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|故障场景已经考虑|
|HA|不涉及主备集群|
|压力|不涉及，本SR不涉及DB业务|
|性能|不涉及，本SR不涉及DB业务|
|可维护性|本SR所有用例均会自动化看护|


## **4、测试用例**

**开发门槛用例：**

[多节点IOFENCE门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDlhMWFkOWEzMzExZGM4NWQ2IiwicmVmX2lkIjoiNjczOTZiZDk3MjgyMDZlZmI5MmYwYWJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3Mzk4LCJleHAiOjE3ODIzODM3OTh9.1qFG-emMe35Pk0RC3kvGk-nyIJ_-cOkZiYynfKXsq0A)

**测试用例：**

[YDBRD-22514 支持多节点iofence--测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDk4OTcwYzJhZjRmNTIwNzYxIiwicmVmX2lkIjoiNjczOTZiZDk3MjgyMDZlZmI5MmYwYWJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3Mzk4LCJleHAiOjE3ODIzODM3OTh9.n0pod2uQwwa5NJyGHvwJlTV3NfzbNh9ZAQT6y_093t8)

## **5、测试框架设计**

本次测试使用HA框架实现

## **6、测试环境说明**

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|  
|


## **7. 工作量评估**

工作量：5人天

## Attachments:

[多节点IOFENCE门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDlhMWFkOWEzMzExZGM4NWQ2IiwicmVmX2lkIjoiNjczOTZiZDk3MjgyMDZlZmI5MmYwYWJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3Mzk4LCJleHAiOjE3ODIzODM3OTh9.1qFG-emMe35Pk0RC3kvGk-nyIJ_-cOkZiYynfKXsq0A)

 (text/plain)    


[image2024-1-26_17-14-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDk4OTcwYzJhZjRmNTIwNzYyIiwicmVmX2lkIjoiNjczOTZiZDk3MjgyMDZlZmI5MmYwYWJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3Mzk4LCJleHAiOjE3ODIzODM3OTh9.vfivMOjuFuU95exdlrqFJ6XSYVoE7U90WhsEtFDSYMM)

 (image/png)    


[YDBRD-22514 支持多节点iofence--测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDk4OTcwYzJhZjRmNTIwNzYxIiwicmVmX2lkIjoiNjczOTZiZDk3MjgyMDZlZmI5MmYwYWJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3Mzk4LCJleHAiOjE3ODIzODM3OTh9.n0pod2uQwwa5NJyGHvwJlTV3NfzbNh9ZAQT6y_093t8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2024/1/24 周三16：00-16：50    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：Trump、李垠、杜宇轩、徐凡博    
  五、会议主题：【YDBRD-22514】支持多节点iofence--测试设计评审    
    
  会议纪要：    
  1、本SR主要是特性识别出来的优化点，需要解决DB拓扑更新导致的数据不一致问题。,2、“若ycs被kill后马上拉起来，DB能解除fence不abort”需要开发自测后给具体测试手段，测试角度黑盒需覆盖；,3、在途IO无法清除用埋点模拟，属于极少数场景，可以摸底这种场景下系统的健壮性，若有问题，可根据权重考虑是否解决,4、针对主YCS和备DB在一个节点的部署形态：,（1）“主YCS与主DB同时发生异常”，主要看最终表现，新主产生之前，会有监控流程不断重试拉起DB但失败的情况，原来有这块流程相关的问题单    [https://jira.yasdb.com/browse/YDBRD-25868](https://jira.yasdb.com/browse/YDBRD-25868)  ,（2）“YCS备和DB备同时发生异常”是，主DB是能从磁盘上检查到本节点被提出集群的，一两秒就会fence，不需要等待10秒，这部分预期需要更改,测试设计文档：    
  --     [https://conf.yasdb.com/pages/viewpage.action?pageId=144115124](https://conf.yasdb.com/pages/viewpage.action?pageId=144115124)  ,Posted by xufanbo at 一月 24, 2024 17:06|
|---|
