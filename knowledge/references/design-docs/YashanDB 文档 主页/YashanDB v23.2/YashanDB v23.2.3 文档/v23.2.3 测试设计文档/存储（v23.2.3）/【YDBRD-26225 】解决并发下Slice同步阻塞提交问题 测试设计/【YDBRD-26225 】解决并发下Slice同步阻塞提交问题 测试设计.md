Created by 陈瑞, last modified on 五月 08, 2024

# 1. 概述

SR:    [https://pingcode.yasdb.com/pjm/items/6618f7adfd997db58ad86048](https://pingcode.yasdb.com/pjm/items/6618f7adfd997db58ad86048)    ?#YDBRD-26225 解决并发下Slice同步阻塞提交问题

背景：外场在使用datax并发对同一个表导入，并发大的场景下导数性能上不去。

当前：  当前实现是在redo发送时，检查对应LFN下是否还有SLice发送，但是并发下可能会无法slice还没有发送到备机，  Slice同步在尚未完成时就已经取了LFN。这样redo发送的等待等待Slice文件发送。阻塞内部其他事务（尤其是自治事务）提交，导致系统并发能力上不去。

需求合入后：Slice文件同步完成再设置lfn，保证redo发送时拿到的lfn都是已经发送到备机的

  


# 2. 需求分析

## 2.1 功能点分析

- LFN设置放到Slice文件同步完成
- scol sync busy wait/log file sync 变短，目标端是单机主备的场景性能有所提升


## 2.2 应用场景

- *datax在bulkinsert模式大并发导数(主备复制有瓶颈)，目标端是单机主备/分布式主备，且保护模式是最大保护。*


## 2.3 规格约束

- 不涉及


# 3. 详细测试设计

## 3.1 测试设计方法

使用datax在bulkinsert 模式导入10个G的tpch数据lineitem表。尝试设置channel为8 或16,通过比对相同配置下的之不同版本性能/功能表现

1、性能

- 首先验证需求来源的性能问题场景，相对优化前的版本，并发大的导数性能有所提升。


2、修改了主备复制的lfn设置的时机，测试bulkinsert方式的主备同步场景。

- 最大性能，lfn的设置时机预期不需要等备机传送
- 最大可用，备机无故障时，等同于最大保护
- 最大可用，备机故障时，等同最大性能，lfn的设置预期不需要等备机传送
- bucketinsert方式导数与其他业务场景并发。包括被导入的表dml/dql业务，heap表dml/dql业务


3、原有的列存主备复制功能是否受到影响(旧用例看护)

  


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|备注|
|---|---|---|
|CT|涉及|  
|
|KT|不涉及|不需要故障场景|
|长稳|涉及，旧用例覆盖|slice的主备同步，较基础场景，旧用例有覆盖|
|一致性|不涉及|内部机制修改，无改动|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|不涉及第三方|
|安全|不涉及|内部机制修改，无安全相关改动|
|DFR|不涉及|内部机制修改|
|HA|涉及|  
|
|压力|不涉及|内部机制修改|
|性能|涉及|  
|
|可维护性|不涉及|内部机制修改，不涉及|


|模块|场景|  
|
|---|---|---|
|性能|单机→分布式dn多副本,1mn1cn3dn，每个dn两副本，设置最大保护模式。|相同模式下，对比优化后比优化前版本性能有优化，  scol sync busy wait/log file sync 变短|
|  
|YashanDB单机->YashanD单机主备,datax导数到单机一主两备数据库中，设置最大保护模式。|相同模式下，对比优化后比优化前版本性能有优化，  scol sync busy wait/log file sync 变短|
|保护模式|测试YashanDB单机->YashanD单机一主两备，设置最大性能模式。|与导入纯单机无主备性能对比，性能相同，或略微下降|
|  
|测试YashanDB单机->YashanD单机一主两备，设置最大可用模式。|备机无故障时，相当于最大保护模式，与导入单机一主两备的保护模式下对比，性能相同|
|  
|测试YashanDB单机->YashanD单机一主两备，设置最大可用模式，备机全部故障。|备机故障时，相当于最大性能，与导入单机纯无主备对比，性能相同|
|功能|最大保护模式下，YashanD单机一主两备，bulkinsert导数与其他业务并发,业务1：在主机上对被导入的表lineitem 表做dml/dql并发|业务不卡住，不关注性能|
|  
|最大保护模式下，YashanD单机一主两备，bulkinsert导数与其他业务并发,业务2：在主机上对heap表的dml/dql业务并发|业务不卡住，不关注性能|


# -DbatchSize=2048 -Dbinder=3 -DbatchesPerTxn=100

改小批量提交，多批次提交

# 4. 测试用例

# 5. 测试框架设计

- 并发的功能用例用ha_regress实现
- 性能看护一个单机主备的场景，不使用框架，增加一个工程脚本


# 6. 测试环境说明

*物理机：*

*源端：192.168.7.11*    
  *主机 192.168.7.12 备机： 192.168.7.10*

# 7. 工作量评估

工作量：1  *人周*

计划测试完成时间：5/10

## Attachments:

[slice同步阻塞提交.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjFhMWFkOWEzMzExZGM4ZWVlIiwicmVmX2lkIjoiNjczOTZkMjA3MjgyMDZlZmI5MmYxYjdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTAxLCJleHAiOjE3ODIzOTI1MDF9.qNvrvapiXcMRkNlJq018CqrbF3iAlLQsgIphQzl6Uf8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[冒烟用例-slice同步阻塞提交.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjFhMWFkOWEzMzExZGM4ZWVmIiwicmVmX2lkIjoiNjczOTZkMjA3MjgyMDZlZmI5MmYxYjdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MTAxLCJleHAiOjE3ODIzOTI1MDF9.HnRlSgvtWS8_2ZrQVCwwqTEI9rfmVQ5eOonvcITO6R8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,与会人：易文亮、陈瑞、谢锐、万谦 评审时间：2024-05-8 15:00-15:30 评审地点：线上    
  会议主题：【解决并发下slice同步阻塞提交问题】测试设计评审,评审纪要信息：    
  1、改小批量提交，多批次提交观察 -DbatchSize=2048 -Dbinder=3 -DbatchesPerTxn=100 --谢锐    
  2、工作量评估3人天不准确，修改为1人周 --易文亮    
       
  结论：    
  增加测试点1    
  修改工作量2    
  已检查测试点已覆盖，评审通过,Posted by chenrui at 五月 10, 2024 14:26|
|---|
