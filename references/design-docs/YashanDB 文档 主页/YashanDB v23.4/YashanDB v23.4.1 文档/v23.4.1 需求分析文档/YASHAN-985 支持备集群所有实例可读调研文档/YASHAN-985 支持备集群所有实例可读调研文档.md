*# 特性调研-*  YASHAN-985 【主备集群】主备集群支持备集群只读能力  * *

*IR链接：*  [https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b329](https://pingcode.yasdb.com/ship/ideas/660b7443009f91eb87f2b329)  ?  
#YASHAN-985 【主备集群】主备集群支持备集群只读能力



##   [1. 总述](#1-总述)  

###   [1.1 需求合理性分析](#11-需求合理性分析)  

备集群所有实例支持启动到open状态， 并能进行可读操作， 配合一些工具， 做读写分离， 减少主库的负载。

###   [1.2 需求实现分析](#12-需求实现分析)  

目前， 很少有友商用共享集群作为备库的HA产品， 大多友商都是单机主备， 用共享集群作为备库的友商中，我们调研了oracle和达梦（oracle的资料比较少）。



### 1.2.1 oracle

oracle 11g 引入了   **Active Data Guard（简称ADG）**  ，使得备用库不仅可以作为灾难恢复的目标，而且可以启用只读模式。

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/sbydb/configuring-data-guard-standby-databases-in-oracle-RAC.html#GUID-00B72AF1-0453-4FBD-901F-A3764631BE1F](https://docs.oracle.com/en/database/oracle/oracle-database/19/sbydb/configuring-data-guard-standby-databases-in-oracle-RAC.html#GUID-00B72AF1-0453-4FBD-901F-A3764631BE1F)  

|功能|实现方式|规格约束|
|---|---|---|
|部署形式|单实例（主）和多实例（备）、多实例（主）和单实例（备）、多实例（主）和多实例（备）相互组合||
|多实例重做日志|SQL命令中提供了一个新子句。   `INSTANCES [ ALL | integer]`    `ALTER DATABASE RECOVER MANAGED STANDBY DATABASE`  ,要在 Active Data Guard 环境中将内存列存储与多实例重做应用一起使用，请将  `enable_imc_with_mira`  初始化参数设置为  `TRUE`  。,- 该  `ALL`  选项使重做应用在 Oracle RAC 备用数据库中所有在启动恢复时处于打开或已安装状态的实例上运行。所有实例必须处于相同状态 — 打开或已安装。不允许混合状态
- 此  `integer`  选项将重做应用使用的实例数限制为您指定的数量。对于整数，请指定从 1 到备用数据库中的实例数的整数值。数据库选择要执行重做应用的实例；您无法指定特定实例。
- 如果省略该  `INSTANCES `  子句，则恢复仅发生在发出该命令的一个实例上。
|版本：Oracle Database 12   `c`  Release 2 (12.2.0.1)开始,其他：,- 此子句仅适用于 Oracle Real Application Clusters (Oracle RAC) 或 Oracle RAC One Node 数据库。
- 当您在主数据库上 启用  `STANDBY NOLOGGING FOR DATA AVAILABILITY`  或时，您不能使用多实例重做应用。  `STANDBY NOLOGGING FOR LOAD PERFORMANCE`  
|


![image.png](https://pingcode.yasdb.com/atlas/files/public/673d5421a1ad9a3311de3458/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUNBQUlBQUFBUUFnQUFBSUFBZ0FBQUFBQUFBQUFBQUFBQUVBQUFBQ0FBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5MTQsImV4cCI6MTc4MjQ2NjcxNH0.T_YFgtPaWEc962lw2Bs6eSYY2jy8J-2xAJecL3RQpsk)



![image.png](https://pingcode.yasdb.com/atlas/files/public/673d543ca1ad9a3311de345a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUNBQUlBQUFBUUFnQUFBSUFBZ0FBQUFBQUFBQUFBQUFBQUVBQUFBQ0FBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5MTQsImV4cCI6MTc4MjQ2NjcxNH0.T_YFgtPaWEc962lw2Bs6eSYY2jy8J-2xAJecL3RQpsk)





### 1.2.2 达梦

  [https://eco.dameng.com/document/dm/zh-cn/pm/data-watch-overview.html#2.7%20DMDSC%20%E6%95%B0%E6%8D%AE%E5%AE%88%E6%8A%A4](https://eco.dameng.com/document/dm/zh-cn/pm/data-watch-overview.html#2.7%20DMDSC%20%E6%95%B0%E6%8D%AE%E5%AE%88%E6%8A%A4)  

|功能|实现方式|规格约束|
|---|---|---|
|部署形式|DMDSC（主）和 DMDSC（备）、DMDSC（主）和单节点（备）、单节点（主）和 DMDSC（备）相互之间都可以作为主备库的数据守护||
|日志发送|1. 归档日志发送：控制节点扫描本地归档和远程归档目录，收集所有节点的归档日志文件，并发送到备库
1. 实时日志发送：各节点将本实例产生的 Redo 日志直接发送到备库重演实例
|普通节点不发送归档日志|
|日志重演|按照日志包之间的依赖关系依次将不同节点的日志包按照顺序加入同一个重演任务系统，在开启并行重演的情况下，每个日志包会再交给多路并行重演线程进行并行重演，以此确保备库重演的性能|备库只由集群内的一个节点进行日志重演，称为重演实例。非重演实例收到重做日志直接报错处理，DM 规定将 DMDSC 备库的控制实例作为重演实例。|
|重演完成判断|在故障备库恢复，守护进程判断其是否可加入主备系统时，守护进程会判断备库的重演实例是否重演完成，根据备库重演到的 RSEQ/RLSN 和 SSEQ/SLSN 进行比较、备库联机日志已写入的 ASEQ/ALSN 和 SSEQ/SLSN 进行比较；如果都相等，说明重演完成。||
|节点退出|当 DMDSC 集群作为备库时，不支持仅退出集群中的单个节点。当用户针对 DMDSC 备库执行退出单节点命令时，DMDSC 备库所有节点将一起退出|不支持仅退出集群中的单个节点。当用户针对 DMDSC 备库执行退出单节点命令时，DMDSC 备库所有节点将一起退出|
|主备网络异常|主备库之间网络出现异常时，主库发送归档失败，导致主库节点挂起，如果主库是 DMDSC 集群，任何一个节点挂起，都会通知其他节点同步挂起，守护进程会自动将主库转入 Failover 状态处理。||
|备库故障|- 如果是备库 DMDSC 非控制节点故障，备库 DMDSC 控制节点故障处理流程不需要重做节点联机日志。
- 如果是备库 DMDSC 控制节点故障，新的控制节点故障处理流程需要重做节点联机日志。
- 备库 DMDSC 故障处理流程（不论是控制节点故障，还是非控制节点故障）一律不需要收集回滚段，不需要处理活动事务回滚和已提交事务清理动作。
- 备库普通节点故障，重演实例可以正常接收主库日志，但 DMDSC 故障处理过程中，挂起工作线程等操作可能会导致日志重演挂起；备库重做 Redo 日志，可能需要访问故障节点的 GBS 等全局资源，也可能导致日志重演卡住。
|也就是说，虽然备库重演实例处于正常状态，但备库的日志重演仍然可能挂起|


![image.png](https://pingcode.yasdb.com/atlas/files/public/673d54aea1ad9a3311de345c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUNBQUlBQUFBUUFnQUFBSUFBZ0FBQUFBQUFBQUFBQUFBQUVBQUFBQ0FBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU5MTQsImV4cCI6MTc4MjQ2NjcxNH0.T_YFgtPaWEc962lw2Bs6eSYY2jy8J-2xAJecL3RQpsk)



##   [2. 接口](#2-接口)  

无

##   [3. 规格与约束](#3-规格与约束)  

见1.2小节。

