Created by 高亚宁, last modified on 十一月 09, 2023

## 1.   **概述**

-   [1. 概述](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-1.概述)  
-   [2. 需求分析  ](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-2.需求分析)  
    -   [2.1 SR：集群支持swap表空间的异常恢复](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-2.1SR：集群支持swap表空间的异常恢复)  
-   [3. 测试设计方法 ](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-3.2测试设计：)  
-   [4. 详细测试设计   ](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-4.详细测试设计)  
    -   [4.1  v$temp_extent_pool ](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-4.1v$temp_extent_pool)  
    -   [4.2  temp/swap表空间集群故障恢复](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-4.2temp/swap表空间集群故障恢复)  
-   [5. 测试用例](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-5.测试用例)  
-   [6. 测试框架设计](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-【YDBRD14778】集群支持swap表空间的异常恢复测试设计-7.测试环境说明)  


集群2实例下，某个db实例被kill或者异常退出时，存活的db实例需要对故障实例做在线恢复，回收  swap表空间和临时表空间所占用的资源，本文描述集群2实例下，swap表空间和临时表空间异常恢复的测试设计

## 2.   **需求分析**

### 2.1 SR：  集群支持swap表空间的异常恢复

链接：    [YDBRD-14778](https://jira.yasdb.com/browse/YDBRD-14778?src=confmacro)    -  集群支持swap表空间的异常恢复  完成

设计文档：    [temp/swap表空间集群故障恢复 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119558493)      


场 景：  有实例退出集群时，需要释放其占用的temp/swap表空间，分为两种情况：

- 实例异常退出：由托管实例负责释放，由于temp/swap空间占用是内存信息，所以托管实例通过存活实例的占用信息，间接处理故障实例
- 实例shutdown退出：由当前实例自己释放temp/swap空间


功能：

1. 新增视图v$temp_extent_pool 查看temporary extent分配情况
1. 实例异常退出时，托管实例恢复故障实例的数据


功能限制：

1. 暂只支持两实例部署的在线恢复处理
1. 集群DB故障在线恢复期间，涉及GRC访问的业务会卡住重试，直至对应的GRC资源已经处于正确状态。
1. 集群DB故障在线恢复期间，不能做DDL业务
1. 暂不支持二次故障，二次故障指DB在线恢复期间再次发生实例故障
1. 如果实例未处于open状态，实例被切换为主，自己abort


## 3.   **测试设计方法**   

### 3.1 特性关联领域分析：

1. 视图：新增  v$temp_extent_pool
1. 功能：swap、temp表空间异常恢复——重点
1. 部署形态：单机部署集群2实例
1. 梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点


|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|是|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|是，新增  v$temp_extent_pool的描述|


### 3.2 测试设计：

针对新增视图  v$temp_extent_pool，需要构造场景，测试每个字段是否正确，采用场景法和错误推测法设计

功能部分，需要校验每个场景下，数据库能否正常恢复，采用  场景法和错误推测法进行设计

## 4.   **详细测试设计**

### 4.1  v$temp_extent_pool   

一个临时表空间可以有多个数据文件

|列名|数据类型|描述|
|:---|:---|:---|
|TABLESPACE_NAME|DTYPE_VARCHAR|表空间名称|
|FILE_ID|DTYPE_INTEGER|数据文件全局ID|
|EXTENTS_CACHED|DTYPE_NUMBER|已缓存的临时表空间extent数量|
|EXTENTS_USED|DTYPE_NUMBER|已使用的临时表空间extent数量|
|BLOCKS_CACHED|DTYPE_NUMBER|已缓存的临时表空间block数量|
|BLOCKS_USED|DTYPE_NUMBER|已使用的临时表空间block数量|
|BYTES_CACHED|DTYPE_NUMBER|已缓存的字节数|
|BYTES_USED|DTYPE_NUMBER|已使用的字节数|
|INTER_FNO|DTYPE_INTEGER|数据文件在表空间内的文件ID|


|  
|测试场景|用例详细描述|预期|测试结果|备注|
|:---|:---|---|---|---|:---|
|1|数据库不同状态下查看v$temp_extent_pool |nomount/mount状态查询该视图|报错||dba_data_files|
|2|  
|open状态查询|成功||  
|
|3|查看视图中的字段是否正确|不做业务，查询该视图中的字段是否齐全，显示是否正确|字段齐全，显示正确，与Oracle基本一致||可对比Oracle|
|4|  
|create/drop临时表，查询该视图中各字段的值是否正确|各字段的值正确||  
|
|5|  
|执行并发业务，构造swap表空间换入换出，查询该视图|查询成功，各字段的值正确||  
|


### 4.2  temp/swap表空间集群故障恢复

|  
|测试场景|用例详细描述|预期|测试结果|备注|
|:---|:---|---|---|---|:---|
|1|master实例故障|master mount状态时，kill该实例，切换其他实例至mount状态|新主实例状态未达到OPEN，自身ABORT，YCS再次选择主实例，直到新主实例是OPEN状态||auto_start=never/always,kill yasdb,kill yascs,kill yascs/yasdb|
|2|  
|master open状态时，建临时表/触发swap换入换出，kill该实例，切换其他实例至open状态|新主实例会触发在线恢复，  释放temp/swap空间||  
|
|3|非master实例故障|nomount状态时，kill 非master实例|故障实例未加入DB集群，  主实例不会触发在线恢复||  
|
|4|  
|mount状态时，kill 非master实例|故障实例已加入DB集群，主实例触发在线恢复||  
|
|5|  
|open状态时，建临时表/触发swap换入换出  ，  kill 非master实例|故障实例已加入DB集群，主实例触发在线恢复，释放temp/swap空间||  
|
|6|  
|数据库正在做业务时，切断DB和对应的YCS之间的网络，触发在线恢复|在线恢复成功|未构造出来|  
|
|7|2个实例都故障|2个实例分别建临时表/触发swap换入换出，kill 重启2个实例，校验数据|走重启恢复，重启后会  释放temp/swap空间||  
|
|8|实例故障与业务并发|master实例执行临时表ddl/dml业务过程中，kill重启master实例，在另一个实例上查询在线恢复视图，做ddl、dml业务|视图中显示正在做在线恢复，做表空间ddl拦截，其他ddl成功，dml成功，在线恢复成功后，ddl业务成功||  
|
|9|  
|master实例：改小  VM_BUFFER_SIZE，  执行普通表dml业务过程中，kill重启master实例，在另一个实例上查询在线恢复视图，做ddl、dml业务|视图中显示正在做在线恢复，做ddl报错，dml成功，在线恢复成功后，ddl业务成功||swap表空间extent分配|
|10|  
|master实例：改小  VM_BUFFER_SIZE，做统计信息收集（表、列、索引、分区、系统）时  ，kill重启master实例，在另一个实例上查询在线恢复视图，做ddl、dml业务|视图中显示正在做在线恢复，做ddl报错，dml成功，在线恢复成功后，ddl业务成功||  
|


## 5.   **测试用例**

  


## 6.   **测试框架设计**

本次测试使用ha_regress框架实现。

## 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-6-1_9-22-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjJhMWFkOWEzMzExZGM3OWMxIiwicmVmX2lkIjoiNjczOTY5ZjI1OTNmOTljOWZmMjM1NDVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjY5LCJleHAiOjE3ODIyOTY2Njl9.waWNg_gKHgPiP6sdcQTkHDdelv8ykjTb2Djrr1TiiIw)

 (image/png)    
