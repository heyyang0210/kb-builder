Created by 徐凡博, last modified on 十二月 27, 2023

## **1、概述**

    本文主要描述共享集群支持iofence的测试设计。

    集群在发生脑裂等故障场景后，会形成新的集群。为避免被驱逐的节点继续下发业务，往共享磁盘写入数据而导致数据不一致，必须fence掉被剔除节点的数据业务。

      **去scsi之前：**   原SR    [YDBRD-15216](https://jira.yasdb.com/browse/YDBRD-15216?src=confmacro)    -  【共享集群】ycs支持iofence功能  完成  原测试设计    [【YDBRD-15216】【共享集群】ycs支持iofence功能 -- 测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=127643678)  

      **去scsi之后     **  AR:     [YDBRD-21695](https://jira.yasdb.com/browse/YDBRD-21695?src=confmacro)    -  支持IOFENCE  完成  开发设计文档：    [ycs去依赖SCSI——IOFENCE](133575533.html)  

## **2、需求分析**

### **2.1 功能点分析**

**解决的两个主要问题：**

**1、fence被驱逐的节点：**  根据选举投票结果决策被驱逐节点。

    主要触发场景的简要分析：

     1）网络故障：网络故障后，选举算法优先选原主，因此备节点会被驱逐。

     2）YCS磁盘心跳超时：

         a) 原主节点磁盘心跳超时后，原主节点被fence，集群会切主

         b) 原备节点磁盘心跳超时后，备节点被fence，集群保留原主

**2、在途IO的拦截处理：**  在发生故障时，DB可能存在在途IO未刷下去。  新主和旧主切换过程中，为避免短时间的双主，需等待旧主处理完在途IO后下线新主再上线。

     基础场景的简要分析：

     1) 被驱逐为原主节点，需清除原主在途IO后abort，新主上线；

     2) 被驱逐为原备节点，清除在途IO后abort。

### 2.2 应用场景

    两节点集群，在有/无DB业务期间发生网络故障、磁盘心跳超时等问题时，集群对现有现有节点的裁决与IO的处理。

### **2.3 规格约束**

    1）部署形态：集群

    2）节点数量：两节点

    3）部署模式：磁阵环境

    4）写磁盘心跳的时延不能等于或者超过秒级，否则如果DISK_HB_KEEP_ALIVE配置到最小时，可能把写盘延时误判成超时。

    5）iofence在磁盘异常时会关掉IO和异常恢复后打开IO, 如果带业务场景DB自身有约束，需要遵循DB约束。

## 3、详细测试设计

### 3.1 测试设计方法

主要采用场景法和错误推测法。

### 3.2 详细设计

### 3.2.1 故障点测试（白盒）

这部分主要利用故障点从流程上检测基本的fence决策和在途IO处理。

故障点列表：

1、alter system set _FAULT_POINT = 'YCS_RM_FAULT_POINT_24' scope = memory; -->当前节点被驱逐

2、在途io相关：

i) alter system set _FAULT_POINT = 'YCS_RM_FAULT_POINT_23' scope = memory; -->在途IO不为0

ii) YCS_RM_FAULT_POINT_25 -->升主节点发现被驱逐节点在途io不为0，等待超时后强制升主

iii) alter system set _FAULT_POINT = 'YCSC_FAULT_POINT_1' scope = memory;  →将在途io卡住，然后触发建表操作，可以看到ycs盘上的writenum不为0

|  
|场景分类|具体描述|预期|测试结果|备注|
|:---|:---|:---|:---|:---|:---|
|1|决策fence节点|~~不带DB业务，设置主节点离线故障~~|~~主节点被驱逐~~|  
|白盒测的都是投票后流程，选举已经结束，不存在主备驱逐|
|2|  
|~~不带DB业务，设置主节点离线故障；topo稳定后，清除故障点~~|~~主节点被驱逐；清除故障点后，主节点加入集群~~|  
|非实际上的驱逐，所以无topo表现|
|3|  
|不带DB业务，设置备节点离线故障|备节点被驱逐|符合预期|  
|
|4|  
|~~不带DB业务，设置主节点离线故障；topo稳定后，清除故障点~~|~~备节点被驱逐；清除故障点后，备节点加入集群~~|  
|非实际上的驱逐，所以无topo表现|
|5|驱逐节点已确定，在途IO为0|~~主节点被驱逐，设置在途IO为0~~|~~主节点被驱逐，直接被abort；topo显示YCS和DB切主~~|  
|白盒测的都是投票后流程，选举已经结束，不存在主备驱逐|
|6|  
|备节点被驱逐，设置在途IO为0|备节点被驱逐|符合预期|  
|
|7|驱逐节点已确定，在途IO不为0，且能在超时时间内清除|~~主节点驱逐，设置在途IO不为0，且能在超时时间内清除~~|~~主节点被驱逐，在途io被清除后，DB被abort；topo显示YCS和DB切主~~|  
|白盒测的都是投票后流程，选举已经结束，不存在主备驱逐|
|8|  
|备节点驱逐，设置在途IO不为0，且能在超时时间内清除|备节点被驱逐，在途io被清除后，DB被abort|取消埋点后，fenced标识没被取消，不符合预期，问题必现，定位中|设置埋点23和24一起，在途IO不为0时，不会abort掉挂住；取消掉在途IO不为0后，直接abort，isfenced标识未取消；取消掉驱逐埋点后，  fenced标识应该被取消|
|9|  
|备节点升主过程中，主节点在途IO不为0，且能在超时时间内清除|在途IO清除后，备节点升主|符合预期|设置25号埋点，kill掉主，超时时间内清除埋点|
|10|驱逐节点已确定，在途IO不为0，超时时间内无法清除|~~主节点驱逐，设置在途IO不为0，且超时时间内无法清除~~|~~主节点被驱逐，在途io在超时时间内无法清除，DB被强制abort；topo显示YCS和DB切主~~|  
|白盒测的都是投票后流程，选举已经结束，不存在主备驱逐|
|11|  
|备节点驱逐，设置在途IO不为0，且超时时间内无法清除|备节点被驱逐，在途io在超时时间内无法清除，DB被超时abort|问题解决后，预期合理| 备磁盘心跳故障+23号埋点|
|12|  
|备节点升主过程中，主节点在途IO不为0，且能在超时时间不清除|超时时间后，强制升主|符合预期|设置25号埋点，kill掉主，超时时间内不清除埋点|


### 3.2.2 场景测试（黑盒）

故障的制造和恢复；磁盘心跳故障也由开发故障点制造，接近客户场景。

磁盘心跳故障埋点：ycsctl set _fault_point 'YCS_RM_FAULT_POINT_27'

不带DB业务场景：

|  
|场景分类|具体描述|预期|测试结果|备注|
|:---|:---|:---|:---|:---|:---|
|1|网络故障|两节点集群，构造两节点之间网络故障至超时|备节点被驱逐，DB被abort掉|符合预期|  
|
|2|  
|两节点集群，构造两节点之间网络故障至超时，然后清除故障|备节点被驱逐，DB被abort掉；清除故障后，YCS被拉起同时拉起DB|符合预期|主显示备加入，备进程在，但是服务不可用；    [YDBRD-22985](https://jira.yasdb.com/browse/YDBRD-22985?src=confmacro)    -  【两节点故障恢复】两节点集群构造网络故障后恢复，备节点进程在，但是ycsc服务不可用  解决关闭  已修复|
|3|磁盘心跳故障|两节点集群，构造主节点磁盘心跳故障至超时|主节点被驱逐，主DB abort, 备YCS+DB升主|符合预期|由于埋点挂住磁盘心跳，主节点TOPO无法更新，此时主节点topo无效，看备节点topo即可|
|4|  
|两节点集群，构造主节点磁盘心跳故障至超时，然后清除故障|主节点被驱逐，主DB abort, 备YCS+DB升主；清除故障后，原主节点YCS+DB拉起，角色为备|不符合预期，主节点加入失败    [YDBRD-23046](https://jira.yasdb.com/browse/YDBRD-23046?src=confmacro)    -  【iofence】构造主节点磁盘心跳超时后恢复，主备topo异常  解决关闭|  
|
|5|  
|两节点集群，构造备节点磁盘心跳故障至超时|备节点被驱逐，DB abort|符合预期|由于埋点挂住磁盘心跳，备节点TOPO无法更新，此时备节点topo无效，看主节点topo即可|
|6|  
|两节点集群，构造备节点磁盘心跳故障至超时，然后清除故障|备节点被驱逐，DB abort；清除故障后，备节点加入集群，YCS+DB均被拉起|符合预期|  
|


带DB业务场景：

|  
|场景分类|具体描述|预期|测试结果|备注|
|:---|:---|:---|:---|:---|:---|
|1|网络故障|两节点集群，下发DB业务后一段时间后结束业务，检查在途IO为0，构造两节点之间网络故障至超时|备节点被驱逐，DB被abort掉|符合预期|  
|
|2|  
|两节点集群，下发DB业务后一段时间后结束业务，检查在途IO为0，构造两节点之间网络故障至超时；topo稳定后，对主节点继续下发业务|备节点被驱逐，DB被abort掉；主节点下发业务正常|符合预期|  
|
|3|  
|两节点集群，下发DB业务后一段时间后结束业务，检查在途IO为0，构造两节点之间网络故障至超时；一段时间后恢复网络|备节点被驱逐，DB被abort掉；恢复网络后，YCS被拉起同时拉起DB|符合预期|DB就是起来比较慢，这里要注意RTO的影响|
|4|  
|两节点集群，下发DB业务后一段时间后结束业务，检查在途IO为0，构造两节点之间网络故障至超时；一段时间后恢复网络；对两个节点继续下发业务|备节点被驱逐，DB被abort掉；恢复网络后，YCS被拉起同时拉起DB；两个节点继续下发业务正常|符合预期|  
|
|5|  
|两节点集群，DB业务下发过程中，构造两节点之间网络故障至超时|备节点被驱逐，在途IO被清除，DB被abort掉；主节点IO不中断|符合预期|  
|
|6|  
|两节点集群，DB业务下发过程中，构造两节点之间网络故障至超时；然后恢复网络|备节点被驱逐，在途IO被清除，DB被abort掉；主节点IO不中断；恢复网络后，备YCS和DB拉起|符合预期|  
|
|7|  
|两节点集群，DB业务下发过程中，构造两节点之间网络故障至超时；然后恢复网络；等到TOPO稳定后，继续下发业务|备节点被驱逐，在途IO被清除，DB被abort掉；主节点IO不中断；恢复网络后，DB在线后，继续下发业务正常|符合预期|  
|
|8|磁盘心跳故障|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造主节点磁盘心跳故障至超时|主节点被驱逐，主DB abort, 备YCS+DB升主|符合预期|  
|
|9|  
|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造主节点磁盘心跳故障至超时；topo稳定后，继续对备节点下发业务|主节点被驱逐，主DB abort, 备YCS+DB升主；继续对备下发业务正常|符合预期|  
|
|10|  
|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造主节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳|主节点被驱逐，主DB abort, 备YCS+DB升主；恢复磁盘心跳后，原主YCS+DB拉起|符合预期|  
|
|11|  
|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造主节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳；继续对两个节点下发业务|主节点被驱逐，主DB abort, 备YCS+DB升主；恢复磁盘心跳后，原主YCS+DB拉起；继续下发业务成功|符合预期|  
|
|12|  
|两节点集群，下发业务中，构造主节点磁盘心跳故障至超时|主节点被驱逐，主在途io清零，DB abort, 备YCS+DB升主|符合预期|备节点升主时，业务会有停掉|
|13|  
|两节点集群，下发业务中，构造主节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳|主节点被驱逐，主在途io清零，主DB abort, 备YCS+DB升主；恢复磁盘心跳后，原主YCS+DB拉起|符合预期|主备YCS和DB都掉线,  [YDBRD-23215](https://jira.yasdb.com/browse/YDBRD-23215?src=confmacro)    -  【磁盘心跳故障】两节点集群，业务执行过程中注入主节点磁盘心跳故障，topo变化稳定后，取消磁盘故障后主备YCS core  解决关闭|
|14|  
|两节点集群，下发业务中，构造主节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳；继续对两个节点下发业务|主节点被驱逐，主在途io清零，主DB abort, 备YCS+DB升主；恢复磁盘心跳后，原主YCS+DB拉起；继续下发业务成功|符合预期|  
|
|15|  
|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造备节点磁盘心跳故障至超时|备节点被驱逐，备DB abort, 主YCS+DB正常|符合预期|备节点不驱逐走重启流程，只是DB abort掉了，原因是磁盘心跳埋点和重启这里共用一把锁，所以重启这里也挂住了|
|16|  
|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造备节点磁盘心跳故障至超时；topo稳定后，继续对主节点下发业务|备节点被驱逐，备DB abort, 主YCS+DB正常；继续对主下发业务正常|符合预期|  
|
|17|  
|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造备节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳|备节点被驱逐，备DB abort, 主YCS+DB正常；恢复磁盘心跳后，备DB拉起|符合预期|  
|
|18|  
|两节点集群，下发业务一段时间后停止，检查在途IO为0后，构造备节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳；继续对两个节点下发业务|备节点被驱逐，备DB abort, 主YCS+DB正常；恢复磁盘心跳后，备YCS+DB拉起；继续下发业务正常|符合预期|  
|
|19|  
|两节点集群，下发业务中，构造备节点磁盘心跳故障至超时|备节点被驱逐，备在途io清零，DB abort，主一切正常|符合预期|备节点不驱逐走重启流程，只是DB abort掉了，原因是磁盘心跳埋点和重启这里共用一把锁，所以重启这里也挂住了|
|20|  
|两节点集群，下发业务中，构造备节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳|备节点被驱逐，备在途io清零，DB abort，主一切正常；恢复磁盘心跳后，备YCS+DB拉起|符合预期|  
|
|21|  
|两节点集群，下发业务中，构造备节点磁盘心跳故障至超时；topo稳定后；恢复磁盘心跳；继续对备节点下发业务|备节点被驱逐，备在途io清零，DB abort，主一切正常；恢复磁盘心跳后，备YCS+DB拉起；继续下发业务成功|符合预期|  
|


### 【质量加固补充】   — 此处不做测试，在    [https://jira.yasdb.com/browse/YDBRD-21385中着重测试。](https://jira.yasdb.com/browse/YDBRD-21385中着重测试。)  

问题：

1、 在途IO是否可以观测？    --无

2、是否有埋点构造在途IO不为0？   --无

|  
|场景分类|场景描述|分场景|预期|测试结果|备注|
|:---|:---|:---|---|:---|:---|:---|
|1|网络故障|两节点集群，YFS业务下发过程中，构造两节点之间网络故障至超时|不做操作|  
|  
|  
|
|2|  
|  
|恢复网络|  
|  
|  
|
|3|  
|  
|恢复网络且继续下业务|  
|  
|  
|
|4|磁盘心跳故障|两节点集群，下发业务中，构造主节点磁盘心跳故障至超时|不做操作|  
|  
|  
|
|5|  
|  
|恢复网络|  
|  
|  
|
|6|  
|  
|恢复网络且继续下业务|  
|  
|  
|
|7|  
|两节点集群，下发业务中，构造备节点磁盘心跳故障至超时|不做操作|  
|  
|  
|
|8|  
|  
|恢复网络|  
|  
|  
|
|9|  
|  
|恢复网络且继续下业务|  
|  
|  
|


### **3.2.3 是否涉及DFX测试**

|系统级DFX分类|是否涉及|
|---|---|
|CT|并发测试已经考虑，主要是业务和故障的并发，用HA框架实现|
|KT|本SR主要是故障测试，因此故障场景已经考虑，用HA框架实现|
|长稳|不涉及，本SR不涉及DB业务|
|一致性|已经考虑故障先后数据的一致性问题|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，主要使用yasql进行业务下发|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|故障场景已经考虑|
|HA|不涉及主备集群|
|压力|不涉及，本SR不涉及DB业务|
|性能|不涉及，本SR不涉及DB业务|
|可维护性|本SR所有用例均会自动化看护|


## **4、测试用例**

**开发门槛用例：**

**测试用例：**

[支持iofence测试用例module_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzVhMWFkOWEzMzExZGM3OGVhIiwicmVmX2lkIjoiNjczOTY5YzQ3MjgyMDZlZmI5MmVmNzI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTIyLCJleHAiOjE3ODIyOTUzMjJ9.oOcSBlVIsi-9ijU-ZOTEYIQQ_0_gvcHXWysNswqXDKM)

## **5、测试框架设计**

本次测试使用HA框架实现

## **6、测试环境说明**

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|  
|


## **7. 工作量评估**

工作量：7人天

  


## Attachments:

 (application/octet-stream)    


[image2023-11-7_10-43-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzVhMWFkOWEzMzExZGM3OGViIiwicmVmX2lkIjoiNjczOTY5YzQ3MjgyMDZlZmI5MmVmNzI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTIyLCJleHAiOjE3ODIyOTUzMjJ9.2GfBa_uE9oz7JfuKzBveLPaLPMbJzcoTtoMQQLV0_Hw)

 (image/png)    


[image2023-11-7_10-43-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzU4OTcwYzJhZjRmNTFmYTc0IiwicmVmX2lkIjoiNjczOTY5YzQ3MjgyMDZlZmI5MmVmNzI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTIyLCJleHAiOjE3ODIyOTUzMjJ9.SoSnCRssoxs1Nku5ObnMFgjSTJuQMonTZHWl3Q8dgok)

 (image/png)    


[支持iofence测试用例module_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzVhMWFkOWEzMzExZGM3OGVhIiwicmVmX2lkIjoiNjczOTY5YzQ3MjgyMDZlZmI5MmVmNzI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTIyLCJleHAiOjE3ODIyOTUzMjJ9.oOcSBlVIsi-9ijU-ZOTEYIQQ_0_gvcHXWysNswqXDKM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,**质量加固梳理：**,**1、文档补充：**,1）详细测试设计–调整格式到23.2标准,2）补充文本用例excel文件,**2、补充场景：**,带YFS业务的网络故障、磁盘心跳故障场景  –-  针对YFS对在途IO的处理（具体用例见设计文档中）,Posted by xufanbo at 十二月 25, 2023 11:56|
|---|
|  [](null)  ,一、会议时间：2023/12/26 周二10：30-11:00    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：Trump、李垠、张丽红、徐凡博    
  五、会议主题：【YDBRD-15216 & YDBRD-21695】【共享集群YCS去scsi】支持IOFENCE--质量加固,说明：原SR YDBRD-15216已经在去scsi方案AR YDBRD-21695中重新设计，质量加固按最新设计实现    
    
  会议纪要：    
  1、YFS对在途IO的处理，不能用术语“IOFENCE”,原理上不算fence，需要开发同学新给相关术语描述。    
  2、关于YFS业务过程中触发网络故障、磁盘心跳故障的场景，对于YFS在途IO的处理本次质量加固不测，和DB在途IO处理缺陷场景在    [https://jira.yasdb.com/browse/YDBRD-21385中着重测试。](https://jira.yasdb.com/browse/YDBRD-21385中着重测试。)      
  3、对于故障前后数据一致性的检测，集群内核模块已有用例看护    
  4、本次质量加固的补测点着重梳理问题单高频场景，进行复测及联想补充测试。,测试设计文档：    
    [--https://conf.yasdb.com/pages/viewpage.action?pageId=133589348](null)  ,Posted by xufanbo at 十二月 26, 2023 14:57|
|  [](null)  ,梳理现有问题单后，需补测场景和自动化看护：,1、主节点磁盘心跳故障后，备节点切主对业务应该是不影响的,2、备磁盘心跳故障+23号埋点对WAIT_FIN_STOP参数的依赖：为0一直挂着不停，非0强制重启。,Posted by xufanbo at 十二月 27, 2023 11:09|
