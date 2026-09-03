Created by 徐凡博, last modified on 八月 29, 2024

# 1. 概述

本文描述共享集群支持多节点故障测试设计。

SR：   SR链接：    [https://pingcode.yasdb.com/pjm/items/6611a8c3579a3edb84d86119](https://pingcode.yasdb.com/pjm/items/6611a8c3579a3edb84d86119)    ?    
  #YDBRD-25875 IO脑裂保护增强——YCS

开发设计文档：    [IO脑裂保护增强（YCS监控进程）详细设计文档](153012344.html)  

# 2. 需求分析

## 2.1 功能点分析

该需求的主要功能点即为YCS增加一个监控进程YCSM。

**1）涉及到已有功能的改变如下：**

|  
|功能|原流程|变化点|备注|
|---|---|---|---|---|
|1|YCS启动流程|启动YCS进程|先启动YCSM进程，再启动YCS进程|  
|
|2|YCS停止流程|停止YCS进程|先停止YCS进程，再停止YCSM进程|  
|
|3|YCS脑裂重启加入集群场景|YCS进程在，会一直走走重启加入集群流程，期间服务不可用，TOPO显示offline|先杀掉DB再杀掉YCS，由YCSM拉起YCS|网路故障，磁盘心跳故障|


**2）由监控产生的新功能点：**

|  
|功能|功能描述|备注|
|---|---|---|---|
|1|YCSM进程本身|与YCS以1对1形式存在，HOME目录同为YASCS_HOME|  
|
|2|YCSM、YCS的依赖关。系|两者均可以单独存在：,1）YCSM独立存在，可拉起YCS,2）YCS独立存在时，可以继续处理业务，新YCSM连接后，会停YCS起新进程|  
|
|3|YCS进程掉线时|YCSM会拉起YCS|kill -9 , kill -15|
|4|YCS进程挂起|YCSM会杀死原YCS再重启|kill -19|
|5|监控日志|记录关键日志信息|  
|


## 2.2 应用场景

本特性涉及YCS的启动、停止、故障等场景。

## 2.3 规格约束

1）规格：

- 部署形态：集群
- 节点数目：原则上与节点数无关，  两节点转测


2）测试约束：

- 如果要构造看护进程故障的场景，看护进程起到的作用有限或者不起作用，仅支持两种情况，第一：ycsm和ycs同时kill -9， yasboot monit如果配置了负责拉起它们；第二：同时将ycsm和ycs kill -19，备升主后又同时kill -18，仅支持ycs重启，存在一定概率双主 –   取决于磁盘心跳时间
- 只有在部署了yasboot monit的情况下，看护进程没了后才能被拉起，否则不能被自动拉起    
- 如果ycs首次启动失败（在握手之前自己abort），则监听握手的线程每隔100ms检测一次yascs是否存在，检测5次不存在，则ycsm自然退出   –  提供一个埋点？
- YCSM无限次拉起ycs，不设置频度和次数
- YCSM需要等到ycs来握手后才能开始监控，否则一直等待握手 
- YCSM离线，ycs尝试重连，不退出  –- ycs可以独立存在
- ycs保存的db pid可能是旧的，再传给ycsm也有延迟，所以使用db pid kill掉db时，可能存在因为pid是旧的而无法杀掉db的情况，这是无法避免的    – 很难构造


# 3. 详细测试设计

## 3.1 测试设计方法

本需求主要采用场景法、错误推测法来进行测试设计。

[YDBRD-25875 IO脑裂保护增强.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzI4OTcwYzJhZjRmNTIxOGI3IiwicmVmX2lkIjoiNjczOTZlNzI3MjgyMDZlZmI5MmYyODIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTk3LCJleHAiOjE3ODI0NTg1OTd9.HNXMSCmsxVlY6kJlisfVL1SPuzoJ1p9h0X_0kwVFIxY)

  


【质量加固场景】

主要是存储网络故障叠加场景：

|  
|场景|预期|  
|  
|
|---|---|---|---|---|
|1|主节点存储网段网卡down掉后 stop ycs|  
|  
|  
|
|2|主节点存储网段网卡down掉，同时kill -9 YCS|  
|  
|  
|
|3|主节点存储网段网卡down掉，同时kill -19 YCS，超时前kill -18|  
|  
|  
|
|4|主节点存储网卡down掉，同时stop备节点ycs|  
|  
|  
|
|5|主节点存储网卡down掉，同时kill -19备节点YCS|  
|  
|  
|
|6|主节点存储网卡down掉, 同时kill -9备节点YCS|  
|  
|  
|


## 3.2 详细测试设计

### **3.2.1 详细测试场景设计**

**原则：1、ycs与ycsm的测试需要注意YCS的主备角色；**

**           2、kill -19的场景要注意超时时间是从什么时候开始算。**

### **3.2.2 已有测试用例，需修改场景预期**

**复制工程包括（优先级由高到低）：**

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L2_cluster_yasft_ycs_arm_copy_xfb/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L2_cluster_yasft_ycs_arm_copy_xfb/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_kill_arm_4_copy_xfb/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_kill_arm_4_copy_xfb/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_kill_arm_6_copy_xfb3/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_kill_arm_6_copy_xfb3/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_point_1_arm_copy_xfb/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_fault_point_1_arm_copy_xfb/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_ycs_4nodes_fault_1_copy_xfb1/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_ycs_4nodes_fault_1_copy_xfb1/)  

  [https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_network_fault_copy_xfb/](https://jenkins.yasdb.com/view/%E9%97%AE%E9%A2%98%E5%A4%8D%E7%8E%B0/job/Agile_L3_cluster_network_fault_copy_xfb/)  

没上库的双主core相关用例（张茜本地）。

### **3.2.2 是否涉及DFX测试**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，考虑了故障并发|
|KT|是，有考虑YCS、DB等进程异常场景|
|长稳|不涉及，长稳主要关注DB故障情况下的故障恢复和多次稳定运行，四节点已做过相关测试。|
|一致性|是，已考虑故障前后业务一致性|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，该需求不涉及sql语法层面的新增/修改|
|安全|不涉及，该需求不涉及用户密码/用户权限等安全性相关因素，所以不涉及安全专项|
|DFR|是，本身就是故障类测试，注意RTO测试|
|HA|规格中不支持HA模式|
|压力|此次测试不考虑压力专项，只维护基本功能|
|性能|此次测试不考虑性能专项，只维护基本功能|
|可维护性|是，用例会自动化维护|


# 4. 测试用例

### 4.1 门槛用例

[IO脑裂保护门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzI4OTcwYzJhZjRmNTIxOGI4IiwicmVmX2lkIjoiNjczOTZlNzI3MjgyMDZlZmI5MmYyODIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTk3LCJleHAiOjE3ODI0NTg1OTd9.d4Pe-PUCwwBZzhQpJcIgAmoiG88-qABI9MMXVSihhaw)

# 5. 测试框架设计

自动化主要使用HA框架实现。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

测试工作量：3人周

## Attachments:

[YDBRD-25875 IO脑裂保护增强.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzI4OTcwYzJhZjRmNTIxOGI5IiwicmVmX2lkIjoiNjczOTZlNzI3MjgyMDZlZmI5MmYyODIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTk3LCJleHAiOjE3ODI0NTg1OTd9.ZnmRVL_6wjDs7yyx0wLAe70GHfCvf_Nm34iJsgvnb2g)

 (application/x-xmind)    


[IO脑裂保护门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzI4OTcwYzJhZjRmNTIxOGJhIiwicmVmX2lkIjoiNjczOTZlNzI3MjgyMDZlZmI5MmYyODIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTk3LCJleHAiOjE3ODI0NTg1OTd9.ToJvp5mBOyFabnzyE9N1hRhFh4tAf2xHzstS2Sj23bM)

 (text/plain)    


[IO脑裂保护门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzI4OTcwYzJhZjRmNTIxOGI4IiwicmVmX2lkIjoiNjczOTZlNzI3MjgyMDZlZmI5MmYyODIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTk3LCJleHAiOjE3ODI0NTg1OTd9.d4Pe-PUCwwBZzhQpJcIgAmoiG88-qABI9MMXVSihhaw)

 (text/plain)    


[YDBRD-25875 IO脑裂保护增强.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNzI4OTcwYzJhZjRmNTIxOGI3IiwicmVmX2lkIjoiNjczOTZlNzI3MjgyMDZlZmI5MmYyODIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMTk3LCJleHAiOjE3ODI0NTg1OTd9.HNXMSCmsxVlY6kJlisfVL1SPuzoJ1p9h0X_0kwVFIxY)

 (application/x-xmind)    


## Comments:

|  [](null)  ,【YDBRD-25875 IO脑裂保护增强——YCS】测试设计评审会议纪要    
  一、会议时间：2024/05/31 星期五 10：30-11：40    
  二、会议地点：线上会议    
  三、会议主持人：徐凡博    
  四、参会人员：孟凡彬、Trump、李垠、杜宇轩、吕雷奇、张茜、徐凡博    
  五、会议主题：【YDBRD-25875 IO脑裂保护增强——YCS】测试设计评审,会议纪要：    
  1、YCS脑裂重启加入集群流程，相对以前来说多一层YCS自杀然后被拉起，其他与原流程一致。    
  2、本需求由于在DEV分支开发转测，当前以两节点规格转测，评估合入master时，需提示分支差异导致的风险。    
  3、YCSM与YCS之间的超时时间即为磁盘心跳时间。    
  4、ycsm在kill ycs之前会kill db，可能db的pid会是旧的，该场景很难构造，若在测试中碰撞到该场景，开发定位为此原因，视为合理约束。    
  5、kill -19/-9 YCSM的故障场景，与没有YCSM的版本类似，同样会出现双主情况，此类场景保证不core，但是预期结果不保证。    
  6、YCSM端的埋点测试暂时无法提供埋点，在后续故障补充测试中再考虑。,  
  测试设计文档：    
  ---     [https://conf.yasdb.com/pages/viewpage.action?pageId=153020325](https://conf.yasdb.com/pages/viewpage.action?pageId=153020325)  ,Posted by xufanbo at 五月 31, 2024 12:21|
|---|
|  [](null)  ,kill -9 YCSM。不论过多长时间拉起，只要YCS还在正常工作能握手，就能重连上。,Posted by duyuxuan at 五月 31, 2024 15:36|
|  [](null)  ,再拉起YCSM ,Posted by duyuxuan at 五月 31, 2024 15:36|
|  [](null)  ,Kill -19 YCSM，不超过超时时间能够重连。超过超时时间了，目前YCSM会自己退出。,Posted by duyuxuan at 五月 31, 2024 16:43|
|  [](null)  ,重新拉起YCSM能恢复。,Posted by duyuxuan at 五月 31, 2024 16:43|
