Created by 牛亚娜, last modified on 五月 16, 2024

# **1. 概述**

本文描述DB支持集群四节点高可用测试设计

  [https://pingcode.yasdb.com/pjm/items/6611a8d7579a3edb84d86165](https://pingcode.yasdb.com/pjm/items/6611a8d7579a3edb84d86165)    ?    
  #YDBRD-25883 DB支持集群四节点高可用

# **2. 需求分析**

## **2.1 功能点分析**

该需求主要实现：某个DB产生异常时，通过故障恢复机制保证整个集群的可用性，以及异常DB再次启动后，整个集群依旧可用。外部呈现的表现就是：集群内部任意一个DB故障了，集群可以自己内部处理这种异常，在经历短时间的恢复期之后，整个集群依旧是处于一个可用的状态，恢复期的时间是有上限的。

## **2.2 应用场景**

集群本身的高可用只要在产生故障时都会涉及，所以主要应用场景就是故障场景：在故障产生时，集群可以正常处理故障，保证整个集群的可用性。  该需求涉及到整个集群的各个服务组件，各个服务组件之间的交互，主要涉及YCS\YFS\DB，本次只针对DB高可用进行转测测试

## **2.3 规格约束**

- 部署形态：集群
- 节点个数：4
- 支持二次故障，一个节点故障之后，故障恢复的过程中，当前节点或者其他节点继续故障
- 支持YCS故障
- db和ycs可以并发启停
- 如果实例未处于open状态，实例被切换为主，自己abort
- 集群DB故障在线恢复期间，涉及GRC访问的业务会卡住重试，直至对应的GRC资源已经处于正确状态
- 不支持集群HA模式


# **3. 详细测试设计**

本次转测开发层面在规格上对”二次故障“不做限制，其余代码未做修改或新增，测试层面需要审视之前已测内容及针对新的规格新增测试点，使用场景法进行设计

### **23.2版本-DB四节点故障需求已测内容**

#### **1、针对不同的业务类型，主要是不同对象的ddl+dml相关操作，覆盖故障方式为kill -9**

- 不带业务的纯故障：DB处于不同阶段时发生故障（启停和故障并发，其中覆盖不同的启动模式）
- 恢复过程中有业务下发
- 故障时带业务，故障和业务串行
- 故障时带业务，故障和业务并行


#### **2、针对global memory的消息处理流程，打点测试 **    [YCK故障点梳理](https://conf.yasdb.com/pages/viewpage.action?pageId=127651235)  

- 从代码分支和内部实现机制的角度，构造故障点场景
- 构造RMO角色在不同节点上的场景，在请求资源的过程中发生各角色的故障


#### **3、长稳测试：摸底测试一轮，故障方式为kill -9**

- master故障
- 两个非master故障
- master+一个非master故障


### **此次版本-测试内容**

#### **1、从质量加固的角度考虑，审视23.2迭代中功能层面的测试是否完善**

1）关联对象的ddl和dml业务与故障并发（未覆盖，补充测试）

2）启停和故障的组合场景：启停+故障后的快速启动+业务并发（未覆盖，补充测试）----设置  NETWORK_HB_TIMEOUT为极小值，考虑master/非master

|场景|分类|备注|
|---|---|---|
|DB启动+故障后的快速启动+业务并发|非master启动+master故障|  
|
|  
|非master启动+其他非master故障|  
|
|  
|非master启动+master和其他非master故障|  
|
|DB停止+故障后的快速启动+业务并发|非master停止+master故障|  
|
|  
|非master停止+其他非master故障|  
|
|  
|非master停止+master和其他非master故障|  
|
|  
|master停止+非master故障|  
|
|  
|master停止+master故障|  
|
|  
|master停止+master和非master故障|  
|
|DB启停+故障后的快速启动+业务并发|master停止+非master启动+master故障|  
|
|  
|master停止+非master启动+非master故障|  
|
|  
|master停止+非master启动+master和非master故障|  
|
|  
|非master停止+非master启动+master故障|  
|
|  
|非master停止+非master启动+非master故障|  
|
|  
|非master停止+非master启动+master和非master故障|  
|


#### **2、23.2转测时，ycs多节点故障还未支持，网络故障和下电等场景遗留，此次需要针对这些场景新增测试**

**故障场景：**

1）一个实例故障（master/非amster）

2）两个实例故障（master+非master/两个非master）--多点故障场景中覆盖

3）三个实例故障（master+两个非master/三个非master）--多点故障场景中覆盖

**故障类型：**

1）网络故障：网络丢包，网络延迟、断网卡、网络闪断

2）资源异常：  CPU满、内存满

3）服务器异常：  宕机（reboot）

**业务类型：**

1）global memory相关的业务类型，业务过程中产生不同类型的网络故障，数据量可稍微放大，重点走到global memory的全量消息流

2）不同对象相关的业务类型，选取有关联对象的ddl和dml业务，业务过程中产生不同类型的网络故障，并发量增大

|业务类型|故障节点的角色|故障的次数|故障的类型|备注|
|---|---|---|---|---|
|global memory相关的业务类型|master|单次故障|网络丢包|  
|
|  
|  
|  
|网络延迟|  
|
|  
|  
|  
|断网卡|  
|
|  
|  
|  
|网络闪断|  
|
|  
|  
|  
|CPU满|  
|
|  
|  
|  
|内存满|  
|
|  
|  
|  
|reboot|  
|
|  
|  
|连续同类故障（n次）|网络丢包|  
|
|  
|  
|  
|网络延迟|  
|
|  
|  
|  
|断网卡|  
|
|  
|  
|  
|网络闪断|  
|
|  
|  
|  
|CPU满|  
|
|  
|  
|  
|内存满|  
|
|  
|  
|  
|reboot|  
|
|  
|  
|连续不同类故障|全量故障场景|  
|
|  
|非master|单次故障|网络丢包|  
|
|  
|  
|  
|网络延迟|  
|
|  
|  
|  
|断网卡|  
|
|  
|  
|  
|网络闪断|  
|
|  
|  
|  
|CPU满|  
|
|  
|  
|  
|内存满|  
|
|  
|  
|  
|reboot|  
|
|  
|  
|连续同类故障（n次）|网络丢包|  
|
|  
|  
|  
|网络延迟|  
|
|  
|  
|  
|断网卡|  
|
|  
|  
|  
|网络闪断|  
|
|  
|  
|  
|CPU满|  
|
|  
|  
|  
|内存满|  
|
|  
|  
|  
|reboot|  
|
|  
|  
|连续不同类故障|全量故障场景|  
|
|不同对象相关的业务类型|同上|  
|  
|  
|


#### **3、针对多点故障新增测试**

**场景主要包括：多点同时发生同类型故障、多点同时发生不同类型故障、多点先后发生同类型故障、多点先后发生不同类型故障**

**关注点：1）下发故障后表现是否正常；2）reform的时间是否正常（时间过长时需要分析）**

涉及因子：

|因子|分类|备注|
|:---|:---|:---|
|故障的类型|kill db/kill ycs|  
|
|  
|网络丢包|  
|
|  
|网络延迟|  
|
|  
|down网卡|  
|
|  
|网络闪断|  
|
|  
|reboot|  
|
|故障的实例个数|两个实例|  
|
|  
|三个实例|  
|
|故障节点的角色|master+非master|  
|
|  
|都是非master|  
|


各个因子组合后生成的测试场景：

|故障的实例个数|故障节点的角色|故障的类型|备注|
|---|---|---|---|
|两个实例|master+非master|**多点同时发生同类型故障**  ：kill db+kill db|5|
|  
|  
|多点同时发生同类型故障：网络丢包 + 网络丢包|1|
|  
|  
|多点同时发生同类型故障：网络延迟 + 网络延迟|2|
|  
|  
|多点同时发生同类型故障：网络闪断 + 网络闪断|3|
|  
|  
|多点同时发生同类型故障：down网卡 + down网卡|4|
|  
|  
|多点同时发生同类型故障：reboot + reboot|  
|
|  
|  
|**多点同时发生不同类型故障**  ：kill db+网络丢包|7|
|  
|  
|多点同时发生不同类型故障：kill db+网络延迟|8|
|  
|  
|多点同时发生不同类型故障：kill db+网络闪断|9|
|  
|  
|多点同时发生不同类型故障：kill db+down网卡|10|
|  
|  
|多点同时发生不同类型故障：kill db+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络延迟|1|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络闪断|2|
|  
|  
|多点同时发生不同类型故障：网络丢包+down网卡|3|
|  
|  
|多点同时发生不同类型故障：网络丢包+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络延迟+网络闪断|4|
|  
|  
|多点同时发生不同类型故障：网络延迟+down网卡|5|
|  
|  
|多点同时发生不同类型故障：网络延迟+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络闪断+down网卡|6|
|  
|  
|多点同时发生不同类型故障：网络闪断+reboot|  
|
|  
|  
|多点同时发生不同类型故障：down网卡+reboot|  
|
|  
|  
|**多点先后发生同类型故障**  ：kill db+kill db|15|
|  
|  
|多点先后发生同类型故障：网络丢包 + 网络丢包|11|
|  
|  
|多点先后发生同类型故障：网络延迟 + 网络延迟|12|
|  
|  
|多点先后发生同类型故障：网络闪断 + 网络闪断|13|
|  
|  
|多点先后发生同类型故障：down网卡 + down网卡|14|
|  
|  
|多点先后发生同类型故障：reboot + reboot|  
|
|  
|  
|**多点先后发生不同类型故障**  ：kill db+网络丢包|27|
|  
|  
|多点先后发生不同类型故障：kill db+网络延迟|28|
|  
|  
|多点先后发生不同类型故障：kill db+网络闪断|29|
|  
|  
|多点先后发生不同类型故障：kill db+down网卡|30|
|  
|  
|多点先后发生不同类型故障：kill db+reboot|  
|
|  
|  
|多点先后发生不同类型故障：网络丢包+网络延迟|21|
|  
|  
|多点先后发生不同类型故障：网络丢包+网络闪断|22|
|  
|  
|多点先后发生不同类型故障：网络丢包+down网卡|23|
|  
|  
|多点先后发生不同类型故障：网络丢包+reboot|  
|
|  
|  
|多点先后发生不同类型故障：网络延迟+网络闪断|24|
|  
|  
|多点先后发生不同类型故障：网络延迟+down网卡|25|
|  
|  
|多点先后发生不同类型故障：网络延迟+reboot|  
|
|  
|  
|多点先后发生不同类型故障：网络闪断+down网卡|26|
|  
|  
|多点先后发生不同类型故障：网络闪断+reboot|  
|
|  
|  
|多点先后发生不同类型故障：down网卡+reboot|  
|
|  
|非master+非master|同上|  
|
|三个实例|master+两个非master|**多点同时发生同类型故障**  ：kill db+kill db+kill db|5|
|  
|  
|多点同时发生同类型故障：网络丢包 + 网络丢包 + 网络丢包|1|
|  
|  
|多点同时发生同类型故障：网络延迟 + 网络延迟 + 网络延迟|2|
|  
|  
|多点同时发生同类型故障：网络闪断 + 网络闪断 + 网络闪断|3|
|  
|  
|多点同时发生同类型故障：down网卡 + down网卡 + down网卡|4|
|  
|  
|多点同时发生同类型故障：reboot + reboot + reboot|  
|
|  
|  
|**多点同时发生不同类型故障**  ：kill db+网络丢包+网络延迟|5|
|  
|  
|多点同时发生不同类型故障：kill db+网络丢包+网络闪断|6|
|  
|  
|多点同时发生不同类型故障：kill db+网络丢包+down网卡|7|
|  
|  
|多点同时发生不同类型故障：kill db+网络丢包+reboot|  
|
|  
|  
|多点同时发生不同类型故障：kill db+网络延迟+网络闪断|8|
|  
|  
|多点同时发生不同类型故障：kill db+网络延迟+down网卡|9|
|  
|  
|多点同时发生不同类型故障：kill db+网络延迟+reboot|  
|
|  
|  
|多点同时发生不同类型故障：kill db+网络闪断+down网卡|10|
|  
|  
|多点同时发生不同类型故障：kill db+网络闪断+reboot|  
|
|  
|  
|多点同时发生不同类型故障：kill db+down网卡+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络延迟+网络闪断|1|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络延迟+down网卡|2|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络延迟+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络闪断+down网卡|3|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络闪断+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络丢包+down网卡+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络延迟+网络闪断+down网卡|4|
|  
|  
|多点同时发生不同类型故障：网络延迟+网络闪断+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络延迟+down网卡+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络闪断+down网卡+reboot|  
|
|  
|  
|**多点先后发生同类型故障**  ：kill db+kill db+kill db|10|
|  
|  
|多点先后发生同类型故障：网络丢包 + 网络丢包 + 网络丢包|6|
|  
|  
|多点先后发生同类型故障：网络延迟 + 网络延迟 + 网络延迟|7|
|  
|  
|多点先后发生同类型故障：网络闪断 + 网络闪断 + 网络闪断|8|
|  
|  
|多点先后发生同类型故障：down网卡 + down网卡 + down网卡|9|
|  
|  
|多点先后发生同类型故障：reboot + reboot + reboot|  
|
|  
|  
|**多点先后发生不同类型故障**  ：kill db+网络丢包+网络延迟|25|
|  
|  
|多点先后发生不同类型故障：kill db+网络丢包+网络闪断|26|
|  
|  
|多点先后发生不同类型故障：kill db+网络丢包+down网卡|27|
|  
|  
|多点先后发生不同类型故障：kill db+网络丢包+reboot|  
|
|  
|  
|多点先后发生不同类型故障：kill db+网络延迟+网络闪断|28|
|  
|  
|多点先后发生不同类型故障：kill db+网络延迟+down网卡|29|
|  
|  
|多点先后发生不同类型故障：kill db+网络延迟+reboot|  
|
|  
|  
|多点先后发生不同类型故障：kill db+网络闪断+down网卡|30|
|  
|  
|多点先后发生不同类型故障：kill db+网络闪断+reboot|  
|
|  
|  
|多点先后发生不同类型故障：kill db+down网卡+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络延迟+网络闪断|21|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络延迟+down网卡|22|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络延迟+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络闪断+down网卡|23|
|  
|  
|多点同时发生不同类型故障：网络丢包+网络闪断+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络丢包+down网卡+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络延迟+网络闪断+down网卡|24|
|  
|  
|多点同时发生不同类型故障：网络延迟+网络闪断+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络延迟+down网卡+reboot|  
|
|  
|  
|多点同时发生不同类型故障：网络闪断+down网卡+reboot|  
|
|  
|三个非master|同上|  
|


  


#### **4、长稳测试（王伟）**

使用新的版本包，复测已有场景，观测表现是否正常，新增四节点长稳CI工程

#### **5、针对质量加固中梳理的2节点和3+节点差异的需求，补充测试场景**

  [23.1需求2节点、3+节点差异化](https://conf.yasdb.com/pages/viewpage.action?pageId=138562036)      


1）支持托管事务

2）支持飞腾ARM

3）支持鲲鹏ARM

4）YFS加入退出YCS

5）集群支持表空间基本功能

6）支持拓扑状态管理和监控，查看

7）YCS支持故障快速检测

8）PC清理优化

#### 6、参考当前已有CT/KT/TX用例，修改调度，本地使用相应框架进行四节点场景的测试，摸底测试两轮，待新框架适配后新增四节点CI工程（优先级放低）

  [storage_testcase_cluster · master · CoD-X / Yastest Dfx · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/storage_testcase_cluster)  

  [consistency_testcase/cluster · master · CoD-X / Yastest Dfx · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/consistency_testcase/cluster)  

#### 7、DFX设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|是|
|三方测试工具(sqltest，sqlancer)|不涉及sql语法层面的新增/修改|
|安全|不涉及用户密码/用户权限等安全性相关因素|
|DFR|是|
|HA|规格中不支持HA模式|
|压力|此次测试不考虑压力专项，只维护基本功能|
|性能|此次测试不考虑性能专项，只维护基本功能|
|可维护性|是|


# **4. 测试用例**

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[YDBRD-25883-DB四节点高可用-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDFhMWFkOWEzMzExZGM4NTgxIiwicmVmX2lkIjoiNjczOTZiZDE1OTNmOTljOWZmMjM2NzUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk1LCJleHAiOjE3ODIzODM1OTV9._35TrTnlBvzirZyX-oCyP_143vCkLIRpiVwsnju0lzw)

# **5. 测试框架设计**

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


|用例类型|测试框架|用例目录|备注|
|:---|:---|:---|:---|
|基本故障业务场景用例|ha|/fault_test/multi_db_fault|  
|
|TX用例|一致性框架|  
|  
|
|CT用例|testkill框架|  
|  
|
|KT用例|testkill框架|  
|  
|


# **6. 测试环境说明**

测试环境：4节点单主机磁阵环境+4节点多主机磁阵环境

# **7. 工作量评估**

工作量：19人天

计划测试完成时间：2024.05.13

# **8. TODO**

# **9. 上车分析**

**第一轮上车：**    [Agile_master_L2_Build #4609 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/4609/)  

|  
|失败工程|失败原因|是否通过|
|---|---|---|---|
|1|  [Agile_L2_sa_heap_HA_5_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/3840/)  |yasft/ha/ha_heap/testcase/ha_schedule/DB_objects/ha_sequence.py,公共失败问题，非SR影响|  
|
|2|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/2519/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_kwczgXIj&runId=ci_record_y1E59cBN&lastRunId=ci_record_3t0kjIKD&activity=FT)  ,公共失败问题，非SR影响|  
|
|3|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/2789/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_PJTvE9nI&runId=ci_record_Vgi5bR1F&lastRunId=ci_record_EoSIS8v6&activity=FT)  ,公共失败问题，非SR影响：,/function3/date_add/common/test_sdv_func_date_add_011,/function3/date_add/heap/test_sdv_func_date_add_09-10,/plsql01/test_sit_udrein/test_sdv_udrein_101,/plsql01/test_sit_udrein/test_sdv_udrein_138,新特性更新预期问题，非SR影响：,  [单机：YDBRD-29822上车 用例刷新“ (7a57f63b) · 提交 · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/commit/7a57f63be5b0fb9df832ecbf661202868f3873fa)  ,/DFX/audit/audit_syn/test_sdv_audit_sup_01,/system_view/all_view/all_sequences/test_sdv_all_sequences_sys,/system_view/all_view/all_sequences/test_sdv_all_sequences_sys_delete_other_select,/system_view/user_view/user_sequences/test_sdv_user_sequences_sys,/system_view/user_view/user_sequences/test_sdv_user_sequences_sys_delete_other_select|  
|
|4|  [Agile_L2_sa_FT_sqlloader_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_1_docker/3223/)  |  [jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_1_docker/3223/exp_5fimp_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_1_docker/3223/exp_5fimp_5freport/)  ,公共失败问题，非SR影响|  
|
|5|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/2412/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_iPntl64R&runId=ci_record_DZAkgmwp&lastRunId=ci_record_xZykjKPc&activity=FT)  ,公共失败问题，非SR影响|  
|
|6|  [Agile_L2_sa_FT_sqlloader_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_2_docker/3046/)  |  [jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_2_docker/3046/exp_5fimp_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_2_docker/3046/exp_5fimp_5freport/)  ,公共失败问题，非SR影响|  
|
|7|  [Agile_L2_sa_FT_yasldr_1](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/3246/)  |  [jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/3246/exp_5fimp_5freport/](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/3246/exp_5fimp_5freport/)  ,公共失败问题，非SR影响|  
|
|8|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/1664/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_UzwZiFYG&runId=ci_record_JRtLjsJj&lastRunId=ci_record_24FhK1je&activity=FT)  ,公共失败问题，非SR影响|  
|
|9|  [Agile_L2_dst_FT_yasldr_2](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_2/2972/)  |  [jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_2/2972/exp_5fimp_5freport/](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_2/2972/exp_5fimp_5freport/)  ,公共失败问题，非SR影响|  
|
|10|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/1757/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_ZYgtIG7f&runId=ci_record_qbmeIRw6&lastRunId=ci_record_w2uFq3OS&activity=FT)  |  
|
|11|  [Agile_L2_dst_tac_driver_jdbc_debug_asan_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/2993/)  |超时，重新构建|  
|
|12|  [Agile_L2_cluster_heap_yasft_sa_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/2258/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_3t2GuTOG&runId=ci_record_uTZ8wJr3&lastRunId=ci_record_drHfFuz9&activity=FT)  ,公共失败问题，非SR影响,新特性更新预期问题，非SR影响|  
|
|13|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2320/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_AYylcn9j&runId=ci_record_lzE7fj6r&lastRunId=ci_record_MOBK7oJr&activity=FT)  ,公共失败问题，非SR影响|  
|
|14|  [Agile_L2_cluster_FT_expimp_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_FT_expimp_arm/559/)  |用例不稳定，lastfail|pass|
|15|  [Agile_L2_cluster_backup_arm_3](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/539/)  |lastfail|pass|


**第二轮上车：**    [Agile_master_L2_Build #4631 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/view/%E4%B8%8A%E8%BD%A6%E6%A8%A1%E5%BC%8F/view/%E4%B8%8A%E8%BD%A6%E5%B7%A5%E7%A8%8B%E5%85%A5%E5%8F%A3/job/Agile_master_L2_Build/4631/)  

|  
|失败工程|失败原因|是否通过|
|---|---|---|---|
|1|  [Agile_L2_sa_heap_HA_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/4324/)  |ha_schedule_common/tablespace/tablespace_Encryption/test_sdv_ydbrd_26551_backup_AES128_01.py    
  公共失败问题，非SR影响|pass|
|2|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/2547/)  |  [YTP (yasdb.com)](https://ytp.yasdb.com/#/buildAnalysis/taskRecordDetail?taskId=ci_task_kwczgXIj&runId=ci_record_TuzY1U0y&lastRunId=ci_record_MFD5wCuH&activity=FT)  ,公共失败问题，非SR影响|pass|
|3|  [Agile_L2_sa_heap_HA_5_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/3869/)  |ha_schedule/DB_objects/ha_anonymous_block.py,用例不稳定，非SR影响，lastfail|pass|
|4|  [Agile_L2_sa_upgrade_FT_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_1_docker/3381/)  |工程的默认参数没有更新，SR不影响升级|pass|
|5|  [Agile_L2_sa_upgrade_FT_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_2_docker/3381/)  |工程的默认参数没有更新，SR不影响升级|pass|
|6|  [Agile_L2_sa_heap_HA_6_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_6_docker/3848/)  |ha_schedule_backup/backup_yasrman_xmlfile/test_sdv_ydbrd26670_yasrman01.py,ha_schedule_backup/backup_yasrman_xmlfile/test_sdv_ydbrd26670_yasrman02.py,用例不稳定，非SR影响，lastfail|pass|
|7|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/2819/)  |超时，重跑,  [Agile_L2_sa_heap_yasft_arm #2838 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/2838/)  |pass|
|8|  [Agile_L2_sa_upgrade_FT_3_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_upgrade_FT_3_docker/2914/)  |工程的默认参数没有更新，SR不影响升级|pass|
|9|  [Agile_L2_dst_tac_driver_jdbc_debug_asan_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/3026/)  |lastfail|pass|
|10|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/1697/)  |lastfail,  [Agile_L2_dst_tac_yasft_arm #1705 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/1705/)  |pass|
|11|  [Agile_L2_dst_HA_Switch_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/3030/)  |超时，重跑,  [Agile_L2_dst_HA_Switch_docker #3035 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/3035/)  |pass|
|12|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2349/)  |lastfail,  [Agile_L2_cluster_yasft_cluster_case_arm #2356 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/2356/)  |pass|
|13|  [Agile_L2_cluster_backup_arm_3](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/570/)  |超时，重跑,  [Agile_L2_cluster_backup_arm_3 #575 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_3/575/)  |pass|


## Attachments:

[YDBRD-25883-DB四节点高可用-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDFhMWFkOWEzMzExZGM4NTgxIiwicmVmX2lkIjoiNjczOTZiZDE1OTNmOTljOWZmMjM2NzUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTk1LCJleHAiOjE3ODIzODM1OTV9._35TrTnlBvzirZyX-oCyP_143vCkLIRpiVwsnju0lzw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2024/04/11 16:00-16:30    
  二、会议地点：腾讯会议    
  三、会议主持人：牛亚娜    
  四、参会人员：陈宜顺、同二鹏、李佐龙、李道一、吕雷奇、张丽红、马爽、牛亚娜    
  五、会议主题：DB支持集群四节点高可用测试设计评审    
  六、测试评审纪要    
  场景补充：    
  1、增加导入导出基本功能过程中的故障（包括：进程故障、网络故障、reboot）——雷奇适配三层dfr工程为四节点部署，谢昭贤增加场景    
  2、压力场景下的故障——后续在压力专项中需要增加四节点的故障场景，同步给庭德    
  3、针对质量加固中梳理的2节点和3+节点差异的需求——YCS相关需求已同步给凡博，由YCS层负责    
  4、长稳测试场景中通过kill ycs来停止db——同步给王伟,Posted by niuyana at 四月 11, 2024 16:24|
|---|
