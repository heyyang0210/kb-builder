Created by 徐卓, last modified on 四月 28, 2024

# 1. 概述

该需求为集群补齐gv视图

SR链接：     [https://pingcode.yasdb.com/pjm/items/6611a953579a3edb84d863d8](https://pingcode.yasdb.com/pjm/items/6611a953579a3edb84d863d8)    ?    
  #YDBRD-25929 补齐gv视图（范围见描述）    
    
  *IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b080](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b080)    *?*    
  *#YASHAN-304 集群补齐gv视图*    
    
  开发设计文档：    [补齐GV$视图](https://conf.yasdb.com/pages/viewpage.action?pageId=150608359)  

# 2. 需求分析

## 2.1 功能点分析

为了支持共享集群形态下新增GV$，需要对当前动态视图框架进行统一的调整，使得后续动态视图更易于维护、扩展和升级。因此引入了fixed view/table。

基于gv$视图新框架，继续补齐未适配的gv$视图。

  


## 2.2 应用场景

可以查询出目前未补齐的gv$视图，并且在共享集群部署模式下为各个实例的数据汇总，在单机下为当前实例的数据。

## 2.3 规格约束

部署模式：集群,单机

1、创建outline不能和系统视图同名，创建报错对象已存在，和oracle不一致。

2、只有DDL操作权限不足的时候会报insufficient privilege，如果不允许查到对应的表报的都是table or view not exists，和oracle不一致。

# 3. 详细测试设计

## 3.1 测试设计方法

针对该需求的测试主要从视图的公共测试角度进行，主要采用场景法进行，涉及的主要测试维度如下：

1、针对视图本身的名称和字段名称，字段类型定义的规范性做校验，这部分涉及资料，原则上针对目前现有的均不该有变化

2、针对视图的DDL和DML写操作是否做拦截，做校验

3、针对视图的权限做校验，所有用户都有权限查看动态视图（非sys用户访问需要加  Schema  ），非sys用户可创建不同  Schema  下的同名动态视图，非sys用户不加schema不可访问

4、针对视图的基本过滤查询做校验

5、针对每个视图各自定义，看其在各自部署环境上的表象。

6、针对视图中涉及到的每个字段的值的正确性做校验，需构造相应的场景，建立对应的表和字段、字段值来验证值的正确性

7、从业务的角度考虑视图和业务的并发操作，因为查询V$视图本质上是读系统表。执行业务过程中会对相关的系统表做一些读写操作，环环相扣。 因此需要在执行业务过程的同时对相关视图进行查询操作。校验并发过程前中后无core，无hang，无异常报错

8、select查询视图过程中，构造基础故障场景kill -9 实例、断网

9、视图和业务的并发过程中，构造基础故障场景kill -9 实例、断网

## 3.2 详细测试设计

涉及视图：

|视图名称|视图功能|备注|
|:---|:---|:---|
|GV$TABLE_STATISTICS_CACHE|本视图显示字典缓存上表的统计信息内容 。|  
|
|GV$INDEX_STATISTICS_CACHE|本视图显示字典缓存上索引的统计信息内容 。|  
|
|GV$COLUMN_STATISTICS_CACHE|本视图显示字典缓存上列的统计信息内容 。|  
|
|GV$SESS_TIME_MODEL|本视图显示各种操作的会话累积时间。|  
|
|GV$INSTANCE_RECOVERY|本视图显示最近一次实例恢复任务的信息。|  
|
|GV$RECOVERY_STATUS|本视图显示日志回放状态的信息。|  
|
|GV$ARCHIVE_GAP|本视图显示归档gap区间。|  
|
|GV$REPLICATION_STATUS|本视图显示集群中所有节点的备机redo传输汇总信息。|  
|
|GV$SEGMENTS|本视图显示所有已经分配的segment信息。|  
|
|GV$TABLESPACE|本视图显示所有表空间的汇总信息。|  
|
|GV$CONTROLFILE|本视图显示当前所有控制文件信息。|  
|
|GV$DATATYPE|本视图显示当前系统提供的所有数据类型信息。|  
|
|GV$ERROR_CODE|本视图显示所有错误码的详细信息。|  
|
|GV$FUNCTION|本视图显示当前系统提供的所有内置函数信息|  
|


  


|  
|测试点|测试步骤|预期结果|备注|
|---|---|---|---|---|
|  
|公共拦截校验--  以上  视图    
    
|1、部署集群环境，ycs正常运行    
  2、创建同名对象拦截，同名对象的拦截需要对比oracle,如果创建成功oracle同理的，可以应用在业务场景，存在多个和视图同名的对象，故障恢复后确认视图和同名对象的正确性    
  3、alter视图拦截，删除列、增加列、增加约束（主键、外键、检查、唯一约束）、增加索引、修改列字段类型    
  4、drop 视图拦截    
  5、dml拦截    
  6、权限校验    
  7、基本filter过滤条件校验|和oracle保持一致，dml，ddl均拦截报错|  
|
|  
|查询视图过程中，故障查询节点 --断网 方式--通用|1、节点1查询视图过程中，故障节点1    
  2、故障恢复后启动节点1，再次查询|1、查询过程中故障当前节点，报错明确、无core、无hang的情况。    
  2、查询正常，查询值符合逻辑|  
|
|  
|查询视图过程中，故障查询节点 --kill   ~~9 方式~~   -通用|1、节点1查询视图过程中，故障节点1    
  2、故障恢复后启动节点1，再次查询|1、查询过程中故障当前节点，报错明确、无core、无hang的情况。    
  2、查询正常，查询值符合逻辑|  
|
|  
|查询视图过程中，故障其他节点 --断网 方式--通用|1、节点1查询视图过程中，故障节点2    
  2、故障恢复后启动节点2，节点1，2上再次查询|1、查询过程中故障其他节点该节点继续正常查询并返回结果。                                                      
  2、节点1和节点2上均查询正常，值符合逻辑|  
|
|  
|查询视图过程中，故障其他节点 --kill   ~~9 方式~~   -通用|1、节点1查询视图过程中，故障节点2    
  2、故障恢复后启动节点2，节点1，2上再次查询|1、查询过程中故障其他节点该节点继续正常查询并返回结果。                                                      
  2、节点1和节点2上均查询正常，值符合逻辑|  
|
|  
|校验视图字段的正确性|1、字段 BLOCKS    
  2、字段 CREATION_DATE    
  3、字段 DELETE_TIME     
  4、字段 BYTES    
  5、字段 BLOCK_SIZE|  
|  
|
|  
|查看视图和业务的并发 --  GV$CONTROLFILE+G  V$DATATYPE+V$ERROR_CODE+V$FUNCTION|该视图无法构造业务并发场景|无该场景|  
|
|  
|查看视图和业务的并发 --G  V$TABLE_STATISTICS_CACHE|并发收集统计信息及视图查询业务|  
|  
|
|  
|查看视图和业务的并发 --  GV$INDEX_STATISTICS_CACHE|并发收集统计信息及视图查询业务|  
|  
|
|  
|查看视图和业务的并发 --  GV$COLUMN_STATISTICS_CACHE|并发收集统计信息及视图查询业务|  
|  
|
|  
|查看视图和业务的并发 --  GV$SESS_TIME_MODEL|并发新session及视图查询业务|成功查询，无hang无core|  
|
|  
|查看视图和业务的并发 --  GV$INSTANCE_RECOVERY|并发启停实例及视图查询业务|成功查询，无hang无core|  
|
|  
|查看视图和业务的并发 --  GV$RECOVERY_STATUS|需部署集群备机|  
|  
|
|  
|查看视图和业务的并发 --GV$ARCHIVE_GAP|需部署集群备机|  
|  
|
|  
|查看视图和业务的并发--GV$REPLICATION_STATUS|需部署集群备机|  
|  
|
|  
|查看视图和业务的并发--GV$SEGMENTS|并发创建表、索引、分区表等业务并查询视图|成功查询，无hang无core|  
|
|  
|查看视图和业务的并发--GV$TABLESPACE|并发创建表空间并查询视图|成功查询，无hang无core|  
|
|  
|查看视图和业务的并发过程中--kill -9 方式 节点1|1、节点1：    
  做视图相关业务操作，整个过程中循环select GV视图并发操作    
  2、sleep 30 上一步过程中 kill -9 节点1    
  3、节点正常启动后，再次操作业务和查询并发操作，直到业务正常结束|2、过程中故障，正常报错    
  3、故障恢复后操作正常|  
|
|  
|查看视图和业务的并发过程中--断网 方式 节点2|1、节点1：做视图相关业务操作，整个过程中循环select GV视图并发操作    
  2、sleep 30 上一步过程中断网节点2    
  3、节点正常启动后，节点2操作业务和查询并发操作，直到业务正常结束|2、过程中故障其他节点，当前节点继续正常执行返回结果    
  3、继续查询正常|  
|
|  
|补充查询视图过程中启停ycs/instance|  
|  
|  
|


## 3.3 是否涉及DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|并发测试已经考虑，主要是业务和故障的并发，用HA框架实现|
|KT|并发测试已经考虑，主要是业务和故障的并发，用HA框架实现|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，本SR不涉及第三方测试工具|
|安全|针对不同用户的视图权限做校验|
|DFR|不涉及|
|HA|部分视图涉及集群主备，需考虑业务和故障并发，用HA框架实现|
|压力|不涉及|
|性能|不涉及|
|可维护性|本SR所有用例均会自动化看护|


# 4. 测试用例

开发门槛用例：    
  测试用例：    
  测试设计：

[补全GV视图门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTNhMWFkOWEzMzExZGM4ZTkzIiwicmVmX2lkIjoiNjczOTZkMTM3MjgyMDZlZmI5MmYxYWViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzIzLCJleHAiOjE3ODIzOTIxMjN9.VOX4dfQdSLFnRBMlYR95rHWOBIgNzBlAE3hRw9X-FNY)

[补全GV视图测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTM4OTcwYzJhZjRmNTIxMDIzIiwicmVmX2lkIjoiNjczOTZkMTM3MjgyMDZlZmI5MmYxYWViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzIzLCJleHAiOjE3ODIzOTIxMjN9.gkOUYFX639_82oa5JFU1Eh-eQtWP0dOjBEQFtA0ArBU)

[【YDBRD-25929】【共享集群】GV视图补全.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTRhMWFkOWEzMzExZGM4ZTk0IiwicmVmX2lkIjoiNjczOTZkMTM3MjgyMDZlZmI5MmYxYWViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzIzLCJleHAiOjE3ODIzOTIxMjN9.G354psH0rtHWvEbpE2B9bjnH4VHUL-3HfGcNhNNwdr8)

  


## 5、测试框架设计

本次测试使用HA框架实现

## 6、测试环境说明

|服务器|双机磁阵|
|:---|:---|
|操作系统|Linux x86/arm|
|部署|  
|


## 7. 工作量评估

工作量：7人天

** **  **电子表格**

## Attachments:

[补全GV视图测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTM4OTcwYzJhZjRmNTIxMDIzIiwicmVmX2lkIjoiNjczOTZkMTM3MjgyMDZlZmI5MmYxYWViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzIzLCJleHAiOjE3ODIzOTIxMjN9.gkOUYFX639_82oa5JFU1Eh-eQtWP0dOjBEQFtA0ArBU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[【YDBRD-25929】【共享集群】GV视图补全.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTRhMWFkOWEzMzExZGM4ZTk0IiwicmVmX2lkIjoiNjczOTZkMTM3MjgyMDZlZmI5MmYxYWViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzIzLCJleHAiOjE3ODIzOTIxMjN9.G354psH0rtHWvEbpE2B9bjnH4VHUL-3HfGcNhNNwdr8)

 (application/x-xmind)    


[补全GV视图门槛用例.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMTNhMWFkOWEzMzExZGM4ZTkzIiwicmVmX2lkIjoiNjczOTZkMTM3MjgyMDZlZmI5MmYxYWViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NzIzLCJleHAiOjE3ODIzOTIxMjN9.VOX4dfQdSLFnRBMlYR95rHWOBIgNzBlAE3hRw9X-FNY)

 (text/plain)    


## Comments:

|  [](null)  ,**主题:**   【YDBRD-25929】补齐gv视图  --测试设计评审    
  **日期:**   2024/04/28 14:30:21 (周日)    
    
  一、会议时间：  2024/04/28 14:30-15:00    
  二、会议地点：线上会议    
  三、会议主持人：徐卓    
  四、参会人员：张茜、冯浩楠、秦湫婷、徐卓    
  五、会议主题：【YDBRD-25929】补齐gv视图--测试设计评审    
    
  会议纪要：    
  1、补充查询视图中，启停另一实例ycs/instance场景    
  2、查看视图和业务的并发过程中–断网/kill -9场景中，构造大数据场景，增长在线恢复时间，确保另一实例处在IN_REFORM状态中。    
    
  测试设计文档：    
  --    [https://conf.yasdb.com/pages/viewpage.action?pageId=150613866](https://conf.yasdb.com/pages/viewpage.action?pageId=150613866)  ,Posted by xuzhuo at 四月 28, 2024 15:27|
|---|
