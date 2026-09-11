Created by 张彩虹, last modified on 十一月 07, 2024

SR链接：    [https://pingcode.yasdb.com/pjm/items/670740c6e489dd0868f372a3](https://pingcode.yasdb.com/pjm/items/670740c6e489dd0868f372a3)    ?    
  #YDBRD-33768 主备集群两地三中心（RTO、RPO摸底）

# 1.   **概述**

本文档描述集群HA RTO测试设计

# 2.   **需求分析**

**RTO（**  **恢复时间目标**  **，**  **Recovery Time Objective**  **）指的是在发生故障或灾难后，数据库恢复至完全可用所需的最大时间。**

主集群

- 主集群中master或者非master实例故障后数据库恢复至完全可用时间。


主备切换：

Switchover：

- switchover表示计划内的切换，在保证数据不丢失的前提下，将主备角色互换
- 切换过程会同步Redo，保证不会丢失数据
- 旧主库先降备，旧备库再升主，因此可能出现2个都是备库的中间状态，但是不会出现双主情况
- 应用于数据库运维，比如滚动升级


Failover：

- failover表示故障切换，在主库故障宕机的情况下，将某个备库升为新主库，以便恢复业务
- 非最大保护模式下，备库Redo可能落后于原主库，所以failover之后可能会丢失数据
- 一般用于主库故障后，转移恢复业务


当前集群HA RTO测试主要采用tpcc业务模型，涉及场景主要有如下两类：

- tpcc一共运行10min，在tpmc跑到60wtpmc的前提下，产生故障，检查数据库恢复至完全可用所需要的时间（ycs+yfs+db）
- tpcc一共运行10min，在tpmc跑到最大压力的前提下，产生故障，检查数据库恢复至完全可用所需要的时间（ycs+yfs+db）


# 3.   **测试设计方法**

主要基于RTO版本目标，采用场景法，分析外场可能出现的故障类型，在这些故障场景下，验证RTO的规格。

# 4.   **详细测试设计**

## 4.1 当前考虑测试因子

异地灾备两地三中心需要加网络时延（根据距离设置，深圳——西安）

最大保护模式

|测试因子|覆盖取值|备注|
|:---|:---|:---|
|节点数|2节点|当前只考虑X86，arm待arm的性能调优完成后进行|
|  
|4节点|性能机器紧张，目前先摸底2节点数据|
|tpcc业务涉及表类型|分区表|  
|
|  
|普通表|  
|
|故障角色|主集群master|db的master角色实例和ycs的master角色实例在相同节点|
|  
|主集群非master|  
|
|  
|主集群所有实例(failover)|  
|
|  
|主备切换(switchover)|  
|
|故障类型|kill -9 db|  
|
|  
|db心跳网ifdown|ycs心跳网和db心跳网络在同一网段|
|  
|reboot主机|  
|


## 4.2 详细测试场景

主备模式下以下测试场景分两大类：

1、同单集群tpmc压力（60wTPMC和最大TPMC）

2、同单机HA TPCC仓数和并发（300仓50并发，60wTPMC）

3、集群主备最大保护模式下进行测试

4、  备集群是否需要本地文件系统部署？

**需求指标：生产中心内RPO=0，RTO<20S，同城灾备中心间RPO=0、RTO<30s，异地灾备中心RPO=1~60s、RTO<60s。**

**recover_progress可查看回放速度**

**单集群开归档TPCC**

**单集群不开归档TPCC**

**最大性能和最大保护主库TPCC性能劣化对比（一主一备）**

**最大保护模式下多少TPMC下主备无延迟/延迟小（replicaiton_status视图查看主备同步）**



|  
|服务器架构|部署节点|tpmc压力|tpcc业务涉及表类型|故障db实例的角色|故障类型|该版本调整|优先级|单集群RTO值|单机HA RTO值|集群HA RTO值（52-54环境）|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
|1|X86|2节点|60wTPMC|分区表|主集群master|kill -9 db|  
|最高|20s  
|  
|12.7：87s,![image.png](https://pingcode.yasdb.com/atlas/files/public/6756a330a1ad9a3311de449f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFDQUJDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBRUFBQVFBRUFDQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBSUFnQ0FBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgxMzQsImV4cCI6MTc4MjQ2ODkzNH0.t79ps8KtY-z-OZ0BN2pvaIXb5kC-cvYeBUcUwjz-oD0)|
|2|X86|2节点|60wTPMC|分区表|主集群master|db心跳网ifdown|  
|高|  
|  
||
|3|X86|2节点|60wTPMC|分区表|主集群master|reboot主机|  
|高|  
|  
||
|4|X86|2节点|60wTPMC|分区表|主集群非master|kill -9 db|  
|高|  
|  
|12.7：172s,![image.png](https://pingcode.yasdb.com/atlas/files/public/6756a301a1ad9a3311de449c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFDQUJDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBRUFBQVFBRUFDQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBSUFnQ0FBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgxMzQsImV4cCI6MTc4MjQ2ODkzNH0.t79ps8KtY-z-OZ0BN2pvaIXb5kC-cvYeBUcUwjz-oD0)|
|5|X86|2节点|60wTPMC|分区表|主集群非master|db心跳网ifdown|  
|高|  
|  
||
|6|X86|2节点|60wTPMC|分区表|主集群非master|reboot主机|  
|高|  
|  
||
|7|X86|2节点|60wTPMC|分区表|主集群所有实例|pkill yas主集群所有进程（failvoer）|  
|最高|  
|  
|![image.png](https://pingcode.yasdb.com/atlas/files/public/67542563a1ad9a3311de43d8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFDQUJDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBRUFBQVFBRUFDQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBSUFnQ0FBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgxMzQsImV4cCI6MTc4MjQ2ODkzNH0.t79ps8KtY-z-OZ0BN2pvaIXb5kC-cvYeBUcUwjz-oD0),![image.png](https://pingcode.yasdb.com/atlas/files/public/67542619a1ad9a3311de43d9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFDQUJDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBRUFBQVFBRUFDQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFnQUFBQUJBQUFBQUFBQUFBQUFBSUFnQ0FBQkFDQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgxMzQsImV4cCI6MTc4MjQ2ODkzNH0.t79ps8KtY-z-OZ0BN2pvaIXb5kC-cvYeBUcUwjz-oD0),12.07：227s|
|8|X86|2节点|60wTPMC|分区表|主集群所有实例|down主备之间心跳网|  
|高|  
|  
|  
|
|9|X86|2节点|60wTPMC|分区表|主集群所有实例|reboot主集群机器|  
|高|  
|  
|  
|
|10|X86|2节点|60wTPMC|分区表|/|switchover|  
|最高|  
|  
|  
|
|11|X86|2节点|60wTPMC|分区表|备集群master实例+|kill -9 db|  
|高|  
|  
|  
|
|12|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|13|X86|2节点|60wTPMC|普通表|主集群master|kill -9 db|  
|中|  
|  
|  
|
|14|X86|2节点|60wTPMC|普通表|主集群master|db心跳网ifdown|  
|中|  
|  
|  
|
|15|X86|2节点|60wTPMC|普通表|主集群master|reboot主机|  
|中|  
|  
|  
|
|16|X86|2节点|60wTPMC|普通表|主集群非master|kill -9 db|  
|中|  
|  
|  
|
|17|X86|2节点|60wTPMC|普通表|主集群非master|db心跳网ifdown|  
|中|  
|  
|  
|
|18|X86|2节点|60wTPMC|普通表|主集群非master|reboot主机|  
|中|  
|  
|  
|
|19|X86|2节点|60wTPMC|普通表|主集群所有实例|pkill yas主集群所有进程|  
|中|  
|  
|  
|
|20|X86|2节点|60wTPMC|普通表|主集群所有实例|down主备之间心跳网|  
|中|  
|  
|  
|
|21|X86|2节点|60wTPMC|普通表|主集群所有实例|reboot主集群机器|  
|中|  
|  
|  
|
|22|X86|2节点|60wTPMC|普通表|/|switchover|  
|中|  
|  
|  
|
|23|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|24|X86|2节点|最大TPMC|分区表|主集群master|kill -9 db|  
|中|  
|  
|  
|
|25|X86|2节点|最大TPMC|分区表|主集群master|db心跳网ifdown|  
|中|  
|  
|  
|
|26|X86|2节点|最大TPMC|分区表|主集群master|reboot主机|  
|中|  
|  
|  
|
|27|X86|2节点|最大TPMC|分区表|主集群非master|kill -9 db|  
|中|  
|  
|  
|
|28|X86|2节点|最大TPMC|分区表|主集群非master|db心跳网ifdown|  
|中|  
|  
|  
|
|29|X86|2节点|最大TPMC|分区表|主集群非master|reboot主机|  
|中|  
|  
|  
|
|30|X86|2节点|最大TPMC|分区表|主集群所有实例|pkill yas主集群所有进程|  
|中|  
|  
|  
|
|31|X86|2节点|最大TPMC|分区表|主集群所有实例|down主备之间心跳网|  
|中|  
|  
|  
|
|32|X86|2节点|最大TPMC|分区表|主集群所有实例|reboot主集群机器|  
|中|  
|  
|  
|
|33|X86|2节点|最大TPMC|分区表|/|switchover|  
|中|  
|  
|  
|
|34|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|35|X86|2节点|最大TPMC|普通表|主集群master|kill -9 db|  
|中|  
|  
|  
|
|36|X86|2节点|最大TPMC|普通表|主集群master|db心跳网ifdown|  
|中|  
|  
|  
|
|37|X86|2节点|最大TPMC|普通表|主集群master|reboot主机|  
|中|  
|  
|  
|
|38|X86|2节点|最大TPMC|普通表|主集群非master|kill -9 db|  
|中|  
|  
|  
|
|39|X86|2节点|最大TPMC|普通表|主集群非master|db心跳网ifdown|  
|中|  
|  
|  
|
|40|X86|2节点|最大TPMC|普通表|主集群非master|reboot主机|  
|中|  
|  
|  
|
|41|X86|2节点|最大TPMC|普通表|主集群所有实例|pkill yas主集群所有进程|  
|中|  
|  
|  
|
|42|X86|2节点|最大TPMC|普通表|主集群所有实例|down主备之间心跳网|  
|中|  
|  
|  
|
|43|X86|2节点|最大TPMC|普通表|主集群所有实例|reboot主集群机器|  
|中|  
|  
|  
|
|44|X86|2节点|最大TPMC|普通表|/|switchover|  
|中|  
|  
|  
|
|45|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|46|arm环境|||||||||||
|47|arm|2节点|60wTPMC|分区表|master|kill -9 db|  
|高|  
|  
|  
|
|48|arm|2节点|60wTPMC|分区表|master|db心跳网ifdown|  
|高|  
|  
|  
|
|49|arm|2节点|60wTPMC|分区表|master|reboot主机|  
|高|  
|  
|  
|
|50|arm|2节点|60wTPMC|分区表|非master|kill -9 db|  
|高|  
|  
|  
|
|51|arm|2节点|60wTPMC|分区表|非master|db心跳网ifdown|  
|高|  
|  
|  
|
|52|arm|2节点|60wTPMC|分区表|非master|reboot主机|  
|高|  
|  
|  
|
|53|arm|2节点|60wTPMC|分区表|主集群所有实例|pkill yas主集群所有进程|  
|高|  
|  
|  
|
|54|arm|2节点|60wTPMC|分区表|主集群所有实例|down主备之间心跳网|  
|高|  
|  
|  
|
|55|arm|2节点|60wTPMC|分区表|主集群所有实例|reboot主集群机器|  
|高|  
|  
|  
|
|56|arm|2节点|60wTPMC|分区表|/|switchover|  
|高|  
|  
|  
|
|57|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|58|arm|2节点|60wTPMC|普通表|master|kill -9 db|  
|高|  
|  
|  
|
|59|arm|2节点|60wTPMC|普通表|master|db心跳网ifdown|  
|高|  
|  
|  
|
|60|arm|2节点|60wTPMC|普通表|master|reboot主机|  
|高|  
|  
|  
|
|61|arm|2节点|60wTPMC|普通表|非master|kill -9 db|  
|高|  
|  
|  
|
|62|arm|2节点|60wTPMC|普通表|非master|db心跳网ifdown|  
|高|  
|  
|  
|
|63|arm|2节点|60wTPMC|普通表|非master|reboot主机|  
|高|  
|  
|  
|
|64|arm|2节点|60wTPMC|普通表|主集群所有实例|pkill yas主集群所有进程|  
|高|  
|  
|  
|
|65|arm|2节点|60wTPMC|普通表|主集群所有实例|down主备之间心跳网|  
|高|  
|  
|  
|
|66|arm|2节点|60wTPMC|普通表|主集群所有实例|reboot主集群机器|  
|高|  
|  
|  
|
|67|arm|2节点|60wTPMC|普通表|/|switchover|  
|高|  
|  
|  
|
|68|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|69|arm|2节点|最大TPMC|分区表|master|kill -9 db|属于该版本新增场景|中|  
|  
|  
|
|70|arm|2节点|最大TPMC|分区表|master|db心跳网ifdown|属于该版本新增场景|中|  
|  
|  
|
|71|arm|2节点|最大TPMC|分区表|master|reboot主机|属于该版本新增场景|中|  
|  
|  
|
|72|arm|2节点|最大TPMC|分区表|非master|kill -9 db|属于该版本新增场景|中|  
|  
|  
|
|73|arm|2节点|最大TPMC|分区表|非master|db心跳网ifdown|属于该版本新增场景|中|  
|  
|  
|
|74|arm|2节点|最大TPMC|分区表|非master|reboot主机|属于该版本新增场景|中|  
|  
|  
|
|75|arm|2节点|最大TPMC|分区表|主集群所有实例|pkill yas主集群所有进程|属于该版本新增场景|中|  
|  
|  
|
|76|arm|2节点|最大TPMC|分区表|主集群所有实例|down主备之间心跳网|属于该版本新增场景|中|  
|  
|  
|
|77|arm|2节点|最大TPMC|分区表|主集群所有实例|reboot主集群机器|属于该版本新增场景|中|  
|  
|  
|
|78|arm|2节点|最大TPMC|分区表|/|switchover|属于该版本新增场景|中|  
|  
|  
|
|79|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|80|arm|2节点|最大TPMC|普通表|master|kill -9 db|属于该版本新增场景|中|  
|  
|  
|
|81|arm|2节点|最大TPMC|普通表|master|db心跳网ifdown|属于该版本新增场景|中|  
|  
|  
|
|82|arm|2节点|最大TPMC|普通表|master|reboot主机|属于该版本新增场景|中|  
|  
|  
|
|83|arm|2节点|最大TPMC|普通表|非master|kill -9 db|属于该版本新增场景|中|  
|  
|  
|
|84|arm|2节点|最大TPMC|普通表|非master|db心跳网ifdown|属于该版本新增场景|中|  
|  
|  
|
|85|arm|2节点|最大TPMC|普通表|非master|reboot主机|属于该版本新增场景|中|  
|  
|  
|
|86|arm|2节点|最大TPMC|普通表|主集群所有实例|pkill yas主集群所有进程|属于该版本新增场景|中|  
|  
|  
|
|87|arm|2节点|最大TPMC|普通表|主集群所有实例|down主备之间心跳网|属于该版本新增场景|中|  
|  
|  
|
|88|arm|2节点|最大TPMC|普通表|主集群所有实例|reboot主集群机器|属于该版本新增场景|中|  
|  
|  
|
|89|arm|2节点|最大TPMC|普通表|/|switchover|属于该版本新增场景|中|  
|  
|  
|
|90|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|  
|


# 6.   **测试框架设计**

使用最新HA框架yasboot方式搭建

# 7.   **测试环境说明**

一台客户端

四台性能机器（主备集群实例都分机部署）