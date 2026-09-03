Created by 牛亚娜, last modified on 一月 04, 2024

**SR链接：**  ** **    [YDBRD-21550](https://jira.yasdb.com/browse/YDBRD-21550?src=confmacro)    **-**  **DB支持集群多节点故障**  **完成**

**开发设计文档链接：**    [集群4节点故障](https://conf.yasdb.com/pages/viewpage.action?pageId=135604678)  

# **1. 概述**

本文描述DB支持集群多节点故障测试设计

集群形态部署下，每个DB实例均为对等状态，承载部分全局资源，所有DB实例共享数据库，通过共享缓存模块完成业务的并发控制。如果部分DB实例异常关闭，导致整个DB集群处于不一致状态，包括数据库物理页面的不一致，共享缓存状态的不一致。YCS检测到部分DB异常关闭时，通过更新其他DB实例的拓扑状态，使得MASTER DB感知到其他DB实例的异常，MASTER DB实例需要触发故障的在线恢复，修正前述的不一致问题，让整个DB集群处于正常提供全量服务的状态。

# **2. 需求分析**

## **2.1 功能点分析**

该需求主要实现：某个DB产生异常时，通过故障恢复机制保证整个集群的可用性，以及异常DB再次启动后，整个集群依旧可用。外部呈现的表现就是：集群内部任意一个DB故障了，集群可以自己内部处理这种异常，在经历短时间的恢复期之后，整个集群依旧是处于一个可用的状态，恢复期的时间是有上限的。

之前针对两节点场景进行了测试，本次主要转测四节点故障。

## **2.2 应用场景**

集群本身的高可用只要在产生故障时都会涉及，所以主要应用场景就是故障场景：在故障产生时，集群可以正常处理故障，保证整个集群的可用性。  该需求涉及到整个集群的各个服务组件，各个服务组件之间的交互，主要涉及YCS\YFS\DB，本次只针对DB高可用进行转测测试

- 在故障过程中必然要有业务才有测试的意义，该特性涉及到的关联业务较多，从对象的角度划分，主要有如下对象：


|对象类型|对象覆盖责任人|备注|
|---|---|---|
|表空间|牛亚娜|集群当前支持的操作：创建表空间，删除表空间，增加数据文件，删除数据文件，设置表空间/数据文件自动扩展或关闭，重命名表空间，加密表空间,不支持的操作：透明压缩表空间，MMS表空间，resize datafile，offline/online表空间或数据文件，shrink表空间|
|普通表+TABLE AS|牛亚娜|  
|
|分区表+二级分区|牛亚娜|  
|
|临时表|牛亚娜|  
,  
|
|lob|马爽|  
|
|索引|牛亚娜|  
|
|视图|马爽|  
|
|序列|牛亚娜|  
|
|同义词|马爽|  
|
|trigger|张丽红|  
|
|profile|张丽红|  
|
|过程体/存储过程/自定义函数|张丽红|  
|
|高级包|张丽红|  
|
|权限管理|马爽|  
|
|审计|马爽|  
|
|用户和角色|马爽|  
|
|outline|马爽|  
|
|gv视图|马爽|  
|
|外置udf+LIBRARY(创建一个自定义库)|马爽|  
|
|自定义类型udt|马爽|  
|
|dblink|牛亚娜|  
|
|SQLMAP|牛亚娜|  
|


## **2.3 规格约束**

- 部署形态：集群
- 节点个数：4
- 不支持二次故障，一个节点故障之后，故障恢复的过程中，当前节点或者其他节点继续故障--（当前支持，可以直接测试）
- 不支持YCS故障，有单独的SR转测
- db层面可以并发启停，但是ycs不可以并发启停，ycs并发启停的需求中需要考虑ycs和db层面的交互
- 网络异常中，只对网络丢包场景有限制，其它场景无限制
- 如果实例未处于open状态，实例被切换为主，自己abort
- 集群DB故障在线恢复期间，涉及GRC访问的业务会卡住重试，直至对应的GRC资源已经处于正确状态
- 不支持集群HA模式


# **3. 详细测试设计**

## **3.1 测试设计方法**

4节点高可用的实现和2节点高可用的实现在整体方案上无较大变更，但是与2节点高可用相比，场景更加复杂。整体测试设计思路沿用"2节点高可用"需求的测试方案，但是需要在2节点高可用测试设计的基础上做相应的补充。该需求的测试主要分以下几个方面，集中采用场景法梳理测试场景

**1、功能层面测试**

（1）覆盖不同的业务类型，主要是不同对象的ddl+dml相关操作

（2）覆盖不同的故障类型，包括：

- kill方式：kill -9、 kill -19/kill -18、 kill -15，shutdown immediate，shutdown abort（两节点和多节点无特殊变化）
- 公共故障：网络故障（网卡down，网络延迟，网络闪断）、服务器异常  （网络故障场景涉及到ycs，需要等ycs支持多节点故障后补充测试）


（3）针对global memory的消息处理流程，从代码分支和内部实现机制的角度，做打点测试（  开发提供故障点--    [YCK故障点梳理 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127651235)    ）

（4）针对global memory的消息处理流程，构造RMO角色在不同节点上的场景，在请求资源的过程中发生各角色的故障

（5）针对DB并发启停，当前用例场景是三节点，三节点和四节点没有区别，但需要使用转测包跑一下。对于需要加固的场景进行四节点的补充测试--  (质量加固梳理补充)

**2、并发KT层面测试**

（1）识别哪些场景需要增加四节点并发KT看护（  梳理两节点和四节点区别  ）

**3、数据一致性KT层面测试**

（1）基础串行业务场景中异常恢复后的一致性校验，优先测试

（2）大并发过程中异常恢复后的一致性校验（质量加固中梳理补充）

**4、长稳层面测试--王伟**

（1）已有长稳基础业务中增加部分故障场景（涉及主/备分别故障或者主备同时故障），检查DB层面集群能否正常恢复

（2）已有长稳模型中增加故障场景，检查DB层面集群能否正常恢复

## **3.2 详细测试设计**

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|不涉及sql语法层面的新增/修改|
|安全|不涉及用户密码/用户权限等安全性相关因素|
|DFR|是|
|HA|规格中不支持HA模式|
|压力|此次测试不考虑压力专项，只维护基本功能|
|性能|此次测试不考虑性能专项，只维护基本功能|
|可维护性|是|


[集群支持DB多节点故障恢复.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2Y4OTcwYzJhZjRmNTIwNmZiIiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.lw3Fd-MPW5kB1IUH0UtiqZZxm_AeIeSBSO00bnaITg0)

# **4. 测试用例**

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[YDBRD-21550-DB支持集群多节点故障-冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2ZhMWFkOWEzMzExZGM4NTZmIiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.21YOXQKzdzZ0aLZ8DG5GeNV8OHKfRXo4wwyO35lam-M)

[YDBRD-21550-DB支持集群多节点故障-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2Y4OTcwYzJhZjRmNTIwNmZlIiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.UhBm4_sMJeJcMsDEiFZb-CX2Fjhqo184kBRau-s0hvY)

# **5. 测试框架设计**

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


|用例类型|测试框架|用例目录|用例个数|备注|
|:---|:---|:---|:---|:---|
|基本故障业务场景用例|ha|/fault_test/multi_db_fault|/|  
|
|DB并发启停用例|ha|/DBParaStartStop/|/|使用个人分支代码验证库上用例有无新增问题|
|公共故障场景用例|dfr|  
|  
|  
|


# **6. 测试环境说明**

测试环境：4节点单主机磁阵环境+4节点多主机磁阵环境

# **7. 工作量评估**

工作量：20人天

计划测试完成时间：2023/12/29

# **8. TODO**

1、网络故障场景涉及到ycs，需要等ycs支持多节点故障后补充测试

2、表空间相关操作还有部分未支持，后续需求支持时需要考虑故障场景（两节点+3节点以上）

3、DB并发启停场景，在质量加固中进行梳理补充

# **9. 上车工程分析**

|  
|失败工程|失败原因|最终结果|备注|
|---|---|---|---|---|
|1|  [Agile_L2_sa_heap_HA_3_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_3_docker/3325/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd08970c2af4f520702/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败用例|忽略|  
|
|2|  [Agile_L2_sa_heap_HA_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_1_docker/3376/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd08970c2af4f520703/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败用例|忽略|  
|
|3|  [Agile_L2_sa_heap_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/3444/)  |不稳定用例|再次构建pass|  [Agile_L2_sa_heap_HA_2_docker #3445 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_2_docker/3445/)  |
|4|  [Agile_L2_sa_heap_driver_debug_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_driver_debug_docker/3455/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd08970c2af4f520705/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败用例，jdbc改了输出的时间日期格式|忽略|  
|
|5|  [Agile_L2_sa_tac_HA_4_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_4_docker/3353/)  |环境上有个进程占用内存太多，导致系统开始杀进程|再次构建pass|  [Agile_L2_sa_tac_HA_4_docker #3354 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_HA_4_docker/3354/)  |
|6|  [Agile_L2_sa_lsc_HA_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/3306/)  |环境上有个进程占用内存太多，导致系统开始杀进程|再次构建pass|  [Agile_L2_sa_lsc_HA_1_docker #3307 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_1_docker/3307/)  |
|7|  [Agile_L2_sa_heap_HA_5_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/2922/)  |环境上有个进程占用内存太多，导致系统开始杀进程,不稳定用例|再次构建pass|  [Agile_L2_sa_heap_HA_5_docker #2923 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/2923/)  ,  [Agile_L2_sa_heap_HA_5_docker #2924 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_HA_5_docker/2924/)  |
|8|  [Agile_L2_sa_lsc_HA_2_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/3368/)  |环境上有个进程占用内存太多，导致系统开始杀进程|再次构建pass|  [Agile_L2_sa_lsc_HA_2_docker #3369 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_HA_2_docker/3369/)  |
|9|  [Agile_L2_sa_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_tac_yasft_arm/1451/)  |用例失败过多，大部分为输出的时间日期格式变化|重新构建|  
|
|10|  [Agile_L2_sa_heap_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1697/)  |超时|重新构建|  [Agile_L2_sa_heap_yasft_arm #1702 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_heap_yasft_arm/1702/)  |
|11|  [Agile_L2_sa_FT_yasldr_1](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/2362/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd08970c2af4f520706/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4)|再次构建pass|  [Agile_L2_sa_FT_yasldr_1 #2365 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_yasldr_1/2365/console)  |
|12|  [Agile_L2_sa_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_lsc_yasft_arm/1513/)  |用例失败过多，大部分为输出的时间日期格式变化|重新构建|  
|
|13|  [Agile_L2_sa_FT_sqlloader_1_docker](https://jenkins.yasdb.com/job/Agile_L2_sa_FT_sqlloader_1_docker/2347/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd0a1ad9a3311dc8579/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败|忽略|  
|
|14|  [Agile_L2_sa_HA_heap_driver_c_arm](https://jenkins.yasdb.com/job/Agile_L2_sa_HA_heap_driver_c_arm/599/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd08970c2af4f520707/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败|忽略|  
|
|15|  [Agile_L2_dst_tac_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/642/)  |超时|重新构建|  [Agile_L2_dst_tac_yasft_arm #647 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_arm/647/console)  |
|16|  [Agile_L2_dst_tac_yasft_32K_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_yasft_32K_arm/554/)  |用例失败过多，大部分为输出的时间日期格式变,再次构建已成功|忽略|  
|
|17|  [Agile_L2_dst_lsc_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/672/)  |超时,  
|重新构建|  [Agile_L2_dst_lsc_yasft_arm #676 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_yasft_arm/676/)  |
|18|  [Agile_L2_dst_HA_yasft_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/433/)  |超时,失败用例为输出的时间日期格式变化|超时，重新构建,忽略|  [Agile_L2_dst_HA_yasft_arm #436 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_yasft_arm/436/)  |
|19|  [Agile_L2_dst_FT_yasldr_1](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_1/2130/)  |环境上有个进程占用内存太多，导致系统开始杀进程|再次构建pass|  [Agile_L2_dst_FT_yasldr_1 #2131 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_FT_yasldr_1/2131/)  |
|20|  [Agile_L2_dst_lsc_CT_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_CT_docker/2083/)  |host0003 failed, 103, 尝试建立SSH链接失败:, ssh: handshake failed: EOF|再次构建pass|  [Agile_L2_dst_lsc_CT_docker #2084 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_lsc_CT_docker/2084/)  |
|21|  [Agile_L2_dst_HA_Switch_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/2131/)  |用例不稳定|再次构建pass|  [Agile_L2_dst_HA_Switch_docker #2133 Console [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_dst_HA_Switch_docker/2133/console)  |
|22|  [Agile_L2_dst_tac_driver_jdbc_debug_asan_docker](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_debug_asan_docker/2119/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd0a1ad9a3311dc857a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败用例，jdbc改了输出的时间日期格式|忽略|  
|
|23|  [Agile_L2_dst_tac_driver_jdbc_arm](https://jenkins.yasdb.com/job/Agile_L2_dst_tac_driver_jdbc_arm/804/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd08970c2af4f520708/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败用例，jdbc改了输出的时间日期格式|忽略|  
|
|24|  [Agile_L2_cluster_heap_yasft_sa_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_heap_yasft_sa_case_arm/1276/)  |用例失败过多，大部分为输出的时间日期格式变化|重新构建|  
|
|25|  [Agile_L2_cluster_yasft_cluster_case_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1295/)  |用例失败原因：输出的时间日期格式变化,  
|超时，重新构建,忽略|  [Agile_L2_cluster_yasft_cluster_case_arm #1299 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_cluster_case_arm/1299/)  |
|26|  [Agile_L2_cluster_yasft_ycs_arm](https://jenkins.yasdb.com/job/Agile_L2_cluster_yasft_ycs_arm/1201/)  |![](https://pingcode.yasdb.com/atlas/files/public/67396bd0a1ad9a3311dc857b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFFQUFBQUtBQVFBQUFBZ0FnUUFJZ0FBQUFBR0FBQUlBQUVBQkFRQWdBRUFBQUFBQUFBQUFBQUFBUkFBQUlBQUFCQUVBQUFBQUFBQVFBQUlBQURBQUFZQ0FBQUFBRUFBQUFBQUFJQUFGQkFBZ3dBQ0FBQUFBQUFBQUFBQVFBQUFBQUFFQUFBQUFBRUFBQUFBQ0FBQUFBQUFRSUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTcxOTIsImV4cCI6MTc4MjMwNzk5Mn0.azH1I2G-2a3J17VCwAVDF4FvufDYVQ8KD-9M8t54VR4),公共失败用例，jdbc改了输出的时间日期格式|忽略|  
|
|27|  [Agile_L2_cluster_backup_arm_1](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/948/)  |用例不稳定|再次构建pass|  [Agile_L2_cluster_backup_arm_1 #949 [Jenkins] (yasdb.com)](https://jenkins.yasdb.com/job/Agile_L2_cluster_backup_arm_1/949/)  |


## Attachments:

[YDBRD-21550-DB支持集群多节点故障-冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2ZhMWFkOWEzMzExZGM4NTZmIiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.21YOXQKzdzZ0aLZ8DG5GeNV8OHKfRXo4wwyO35lam-M)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[集群支持DB多节点故障恢复.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2Y4OTcwYzJhZjRmNTIwNmZiIiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.lw3Fd-MPW5kB1IUH0UtiqZZxm_AeIeSBSO00bnaITg0)

 (application/x-xmind)    


[YDBRD-21550-DB支持集群多节点故障-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2ZhMWFkOWEzMzExZGM4NTcwIiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.OoQcgbd9iPznb3G_5v3UIylveWNQMHxKP9Rd1f6WNC4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2023-12-28_14-32-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDBhMWFkOWEzMzExZGM4NTc1IiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.SYS0GUQWvCu4Oif-qhrZs8V9SZb0YEjYYv1vDgHAXAY)

 (image/png)    


[YDBRD-21550-DB支持集群多节点故障-文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiY2Y4OTcwYzJhZjRmNTIwNmZlIiwicmVmX2lkIjoiNjczOTZiY2Y3MjgyMDZlZmI5MmYwYTc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MTkxLCJleHAiOjE3ODIzODM1OTF9.UhBm4_sMJeJcMsDEiFZb-CX2Fjhqo184kBRau-s0hvY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一、会议时间：2023/12/01 16:00-17:00    
  二、会议地点：腾讯会议    
  三、会议主持人：牛亚娜    
  四、参会人员：陈宜顺、同二鹏、李佐龙、李道一、马程飞、吕雷奇、张丽红、马爽、牛亚娜    
  五、会议主题：DB支持集群多节点故障测试设计评审    
  六、测试评审纪要    
  场景限制：    
  1、down掉某条链路，可被另一条链路正常连接    
  2、网卡down依托于ycs的表现，db层面并不做处理    
  3、大量的网络延迟，会出现很多的重试消息，重试消息没有去重，消息池会爆满，会出现卡住现象    
  4、故障点列表提供，开发提供，明确时间------TBD    
  5、两节点和四节点区别，开发提供------pass，已提供    
  6、审视3节点并发启停是否有漏测场景----TBD,2节点和4节点的主要差异：    
  1、对象类区别不大，表空间需要重点测试    
  2、gcs，3节点和2节点路径差异比较多    
  3、节点数，reform部分启停涉及的实例个数有变化，启停的并发混合，多实例并发启停，实例加入/退出恢复    
  4、性能：实例恢复的过程中动态申请资源（页面恢复过程中申请资源比较多，恢复过程中页面比较多/redo积攒比较大）    
  ：日志加载时是动态申请buffer；物理恢复和活跃事务是并发的，共同抢占databuffer资源，事务托管也是动态申请内存（内存类：动态申请-malloc内存和初始已分配好的内存-预分配内存两类；线程类：启动线程和回滚线程类，回滚类线程有可配置参数）,Posted by niuyana at 十二月 20, 2023 10:08|
|---|
