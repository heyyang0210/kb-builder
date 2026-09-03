Created by 赵楠, last modified on 九月 14, 2024

# 1.   **概述**

本文描述  主备支持并行build  的测试设计。

# 2.   **需求分析**

### 2.1 SR：

链接：       [https://pingcode.yasdb.com/pjm/items/66bdc9338f5ee191734e24b5](https://pingcode.yasdb.com/pjm/items/66bdc9338f5ee191734e24b5)    ?    
  #YDBRD-31646 支持并行创建备库

设计文档：  [(731) 并行BUILD特性设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67396e09593f99c9ff23817e)    


场 景：

1. 用户指定BUILD执行并发线程数，主备同时开启同样个数线程，主机负责读文件发送，备机负责接收 写文件
1. 网络IO性能较好的环境下，并行BUILD能有效提高建库速率。
1. slice文件多为碎片小文件，IO占用小，文件操作、文件网络IO确认效率较低。提高并行度对该文件提升较大。


  
  需求范围：

1. 单机、分布式、集群支持
1. 主机可以设置并行连接数，同时给多个备机发送数据
1. 主机/备机BUILD在不配置并行连接数时，默认并行连接数为4
1. 主机可以指定对应备机并行build


  


需求规格：

1.  最大支持32个备机同时build
1. 并行连接数限制上限为8-目前上限不限制


功能限制：

### 2.2 SQL语法

|1. build database [parallelism  count]
1. build database to standby （*） [parallelism  count]
|
|:---|


### 2.3 相关视图

V$BACKUP_PROGRESS

|字段|类型|说明|
|---|---|---|
|TYPE|VARCHAR(16)|备份恢复的类型    
  * NONE：未执行备份恢复    
  * BACKUP：正在备份    
  * RESTORE：正在恢复|
|STAGE|VARCHAR(16)|备份（恢复）当前阶段    
  * none：未执行备份恢复    
  * start：已开始    
  * base data file：基线备份集的数据文件阶段    
  * base bucket file：基线备份集的LSC表不可变数据文件阶段    
  * ctrl file：控制文件阶段    
  * archive prepare：归档备份集恢复扫描准备阶段    
  * data file：数据文件阶段    
  * archive file：归档文件阶段    
  * bucket file：LSC表的不可变数据文件阶段    
  * profile：总结文件阶段    
  * extend：文件扩展阶段    
  * wait open：等待备库open    
  * end：已结束|
|STAGE_PROGRESS|INTEGER|当前阶段完成百分比，范围：[0, 100]|
|AVG_INPUT_RATE|NUMBER|平均IO读取速度（单位：MB/s）。该值表示所有备份恢复子线程的IO读取平均速度，与INPUT_BYTES / ELAPSED_TIME得到的值不同|
|START_TIME|TIMESTAMP|备份恢复开始时间，为服务器本地时间|
|END_TIME|TIMESTAMP|备份恢复结束时间，为服务器本地时间|


# 3.   **测试设计方法**

### 3.1 特性关联领域分析：

1. 并行build语法及功能
1. 性能：    
  分机部署一主两备，heap表使用tpcc 1000仓数据，并行build备机的时间，比较单线程和多线程并行的时间，是否优化    
  分机部署一主两备，lsc表使用tpch-100G数据，并行build备机的时间，比较单线程行和多线程并行的时间，，是否优化
1. 与动态增删备机节点结合
1. 并行build的可靠性、异常场景


### 3.2 测试设计：

主要采用  场景法和错误推测法进行设计

1. 语法验证：采用场景法，针对语法进行覆盖，主要验证并行build语法是否正常，报错是否明确
1. 并行build功能部分，采用场景法，异常场景采用错误推测法
1. 性能部分：基准测试、容量测试


# 4.   **详细测试设计**

### 4.1  并行build语法功能

### 单机

|序号|测试场景|备注|
|:---|:---|:---|
|1|主机执行  build   DATABASE TO STANDBY  (  **S1,**     **S2**  ) parallelism  1~8;成功，主机做业务，查看主备线程数，主备正常同步|  
|
|2|主机执行  build   DATABASE TO STANDBY  (  **S1,**     **S2**  ) ;成功，主机做业务，查看主备线程数为  默认值  4，主备正常同步|  
|
|3|主机执行  build   DATABASE TO STANDBY  (  **S2**  ) parallelism  5 ; 成功，主机做业务，查看主备线程数，主备正常同步|  
|
|4|主机执行  build   DATABASE TO STANDBY  (  *****  )   parallelism  5;成功，主机做业务，查看主备线程数，主备正常同步|  
|
|5|主机执行  build   DATABASE TO STANDBY  (  *****  )   ;成功，主机做业务，查看主备线程数为默认值4，主备正常同步|  
|
|6|备库执行build database parallelism  6；  查看主备线程数，  备库正常同步主库数据|  
|
|7|备库执行build database ；  查看主备线程数为默认值4，  查看主备线程数，  备库正常同步主库数据|  
|
|8|并行数错误，关键字拼写错误、不写并行数，超出最大并行数限制：,build   DATABASE TO STANDBY  (  **S1,**     **S2**  ) parallelism  小数/数学表达式/字符；,build   DATABASE TO STANDBY (  **S1,**     **S2**  )   ** **  **parallelism **  ;,build DATABASE TO STANDBY (  **S1,**     **S2**  )   ** 5 **  ;,build DATABASE TO STANDBY (  **S1,**     **S2**  )   ** parllelism **  ; ,build DATABASE   ** parllelism 4 **  ;,build DATABASE   ** parallelism  **  ;,build DATABASE   ** 5  parallelism**  ;,build DATABASE   **   parallelism 9**  ;,报错|  
|
|9|主机执行BUILD DATABASE TO REMOTE ('127.0.0.1:2901', '127.0.0.1:2902') parallelism 5  ；  查看主备线程数为5，  备库正常同步主库数据|  
|
|10|表空间迁移，  查看主备线程数为4，  备库正常同步主库数据,duplicate   tablespace (tbs1, tbs2, tbs3) to   节点：端口      '/YASDB_DATA/data/'|全量build-默认4,增量build、脑裂修复，表空间迁移-单线程|
|11|备库扩容一个节点,  查看主备线程数为4，  备库正常同步主库数据|yasboot/手动|
|12|32个备机，BUILD并行数为8，查看主备线程数，备库正常同步数据|  
|
|13|级联备执行build database parallelism  6；  查看主备线程数为6，  备机同步成功|  
|


### 分布式

  


|序号|测试场景|备注|
|---|---|---|
|1|MN主节点  build   DATABASE TO STANDBY  (  *****  )   parallelism  4;查看主备线程数为4，备库正常同步主库数据|  
|
|2|DN备节点  build   DATABASE    parallelism  4;查看主备线程数为4，备库正常同步主库数据|  
|
|3|表空间迁移，DN节点执行build database parallelism  4；  查看主备线程数为4，  备库正常同步主库数据,duplicate   tablespace (tbs1, tbs2, tbs3) to   节点：端口      '/YASDB_DATA/data/'|保证功能稳定|
|4|DN节点扩容，  查看主备线程数为4，  备库正常同步主库数据|  
|


### 集群

|序号|测试场景|备注|
|---|---|---|
|1|主集群  build   DATABASE TO STANDBY  (  *****  )   parallelism  4;查看主备线程数为4，备库正常同步主库数据|不支持。待确认|
|2|备机群  build   DATABASE    parallelism  4;查看主备线程数为4，备库正常同步主库数据|  
|


### 4.2  并行build性能

单机

|序号|测试场景|备注|
|:---|:---|:---|
|   1|tpcc1000仓数据,主节点BUILD单线程，计算build时间|1000仓数据-看备份时间确定|
|2|tpcc1000仓数据,主节点BUILD2线程并行，计算build时间|测算扩展比，每增加一个线程并行,速度增长速率|
|   3|tpcc1000仓数据，主节点BUILD4线程并行，计算build时间|  
|
|   4|tpcc1000仓数据,主节点BUILD6线程并行，计算build时间|  
|
|   5|tpcc1000仓数据,主节点BUILD8线程并行，计算build时间|  
|
|   6 |tpch（lsc）100G数据导入，主节点BUILD单线程，,slice文件SCOL_SLICE_ROWS=4K,8M,128M 计算build时间|确认常用的大小,监控网络io、磁盘io|
|7|tpch（lsc）100G数据导入，主节点BUILD2线程并行，,slice文件SCOL_SLICE_ROWS=4K,8M,128M，计算build时间|  
|
|   8|tpch（lsc）100G数据导入，主节点BUILD4线程并行,slice文件SCOL_SLICE_ROWS=4K,8M,128M，计算build时间|  
|
|9|tpch（lsc）100G数据导入，主节点BUILD6线程并行，slice文件SCOL_SLICE_ROWS=4K,8M,128M，计算build时间|  
|
|10|tpch（lsc）100G数据导入，主节点BUILD8线程并行，slice文件SCOL_SLICE_ROWS=4K,8M,128M，计算build时间|  
|


分布式

|序号|测试场景|备注|
|---|---|---|
|1|tpch（lsc）100G数据导入，主节点BUILD单线程,slice文件SCOL_SLICE_ROWS=4K,8M,128M，计算build时间|  
|
|2|tpch（lsc）100G数据导入，主节点BUILD4线程并行,slice文件SCOL_SLICE_ROWS=4K,8M,128M，计算build时间|确认常用的大小|
|3|tpch（lsc）100G数据导入，主节点BUILD8线程并行，slice文件SCOL_SLICE_ROWS=4K,8M,128M，计算build时间|  
|


集群性能有时间跑一下，300仓

300仓数据，摸底线程最优

# 5.  ** **  **测试用例设计**

使用ha_regress框架+手动执行

  


# 6.   **测试框架设计**

采用ha_regress框架，编写python脚本执行

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2022-10-9_10-46-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZmFhMWFkOWEzMzExZGM5NGExIiwicmVmX2lkIjoiNjczOTZkZmE3MjgyMDZlZmI5MmYyNGI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMzU1LCJleHAiOjE3ODIzOTk3NTV9.-0YyDT4Q3h71PjF4JWsu8ZtYiqiXT4C5sbfEbae0rpM)

 (image/png)    
