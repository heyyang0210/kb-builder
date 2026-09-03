Created by 郑荃, last modified on 五月 16, 2024

SR:：    [https://pingcode.yasdb.com/pjm/items/66115d3b579a3edb84d6b27d](https://pingcode.yasdb.com/pjm/items/66115d3b579a3edb84d6b27d)    ?#YDBRD-19732 支持分区DC懒加载与淘汰

开发设计：    [分区DC懒加载与回收](150602493.html)  

# 1. 概述

分区数量较多，加载单个表的dc内存过大，此时可以将分区dc按需加载，引入淘汰机制，解决drop 时报错dc不足场景

# 2. 需求分析

## 2.1 功能点分析

- 当前的机制是分区表的所有分区DC会一起加载，当分区比较多的时候，DC的内存占用会比较大，引入优化机制，DC按需加载，使用哪个分区就加载哪个分区的DC。
- 淘汰机制后续可实现分区DC单独回收，当前的SR还是按照整表来回收


## 2.2 应用场景

*需求本身的主要应用场景*

- 分区表的数据操作只涉及部分分区时，会按需加载涉及到的分区
- 分区表的DDL操作，只会加载少量的表、分区的信息，不会全部分区都加载


*需求与其他特性的关联场景*

- *分区表的dml、ddl、select*
- *嵌套表的分区加载*


## 2.3 规格约束

不涉及

# 3. 详细测试设计

## 3.1 测试设计方法

场景法：分析DC的加载、失效、淘汰的机制的各阶段的处理的流程的不同，构造不同的场景覆盖DC的各个流程

测试范围

- 模式：单机、集群、分布式
- 表类型：heap、lsc
- 分区表：一级分区表、二级分区表、嵌套表一级分区
- 分区索引
- 分区lob


观测DC的视图：V$DICT_CACHE 查看字典缓存的情况，V$SHARE_POOL查看DC pool还剩余的情况

## 3.2 详细测试设计

|场景|场景详细说明|预期|备注|
|---|---|---|---|
|DC访问、加载    
    
|创建一级分区、二级分区不进行任何的dml和select操作，查看DC的情况|  
|可以带索引、不带、以及带lob和不带lob都进行下观测|
||dml、select只涉及部分分区（第一次加载，已经在内存中）|dml和select结果正确，V$DICT_CACHE、  V$SHARE_POOL  中的信息正确|一级分区、二级分区、分区本地索引和分区lob|
||dml、select的部分分区dc已加载，部分分区需要加载到内存中|dml和select结果正确，V$DICT_CACHE、  V$SHARE_POOL  中的信息正确|一级分区、二级分区、分区本地索引和分区lob|
||查询分区表的所有分区数据|全部分区DC都会加载|  
|
|DC淘汰    
    
    
|1、手动清理缓存,ALTER SYSTEM FLUSH SHARED_POOL;,2、再通过dml和select加载|清理缓存后，DC淘汰，再次加载可以成功|清理过程中有长查询涉及某些分区，有DC不会被淘汰，,无dml和ddl的分区会被淘汰|
||构造DC不足触发DC淘汰|  
|构造DC不足的过程中,有长查询涉及某些分区，有DC不会被淘汰，,无dml和ddl的分区会被淘汰|
||有很多个分区，依次查询不同的分区，查询到后面的分区DC不足|  
|表现是？|
|DC失效|已经加载了部分分区DC后,alter table  rename、 增删列、修改数据类型、增删分区、增加\删除\修改\启动\禁用约束|表和分区的DC都被失效掉 |  
|
|  
|drop table 、drop partition 、drop subpartion 、truncate table |  
|  
|
|  
|反复create 、select、dml、alter、drop分区表，不会出现DC不足的情况|  
|  
|
|  
|DC pool剩余空间不多（不足以加载全部分区DC，但是在新方案下可以支持表的DC加载），执行create 、drop 、alter操作|旧版本要加载全部的DC，会出现DC不足，新版本不会出现|  
|
|并发|分区表的各种ddl和select并发|  
|查询的过程中，即使原来的DC失效，DC也不会失效，  只有当最后一个使用者结束时，才能释放此内存|
|  
|分区表的各种dml、select并发，过程中再触发DC淘汰|  
|  
|
|  
|有一个长查询的过程中，ddl导致DC失效，手动清理缓存|  
|  
|
|对比|1W、10W个，10W个一级分区，select或者dml只涉及到部分的分区， 新版本和旧版本DC的占用情况对比， 查询的时候性能对比|  
|  
|
|  
|二级分区1W，10W，100W个分区，select或者dml只涉及到部分的分区， 新版本和旧版本DC的占用情况对比， 查询的时候性能对比|  
|  
|
|  
|一级、二级分区，分区数比较多的情况下， 全部加载上来，查看DC内存的占用情况|分区比较多的情况，可能内存占用会略多余原有机制，但是不会相差太大|  
|
|集群|集群不同实例加载分区表的不同的分区DC|  
|集群大部分用例可以复用单机的用例|
|  
|一个实例执行DDL失效DC，在其他实例查询，也都失效了|  
|  
|


  


DFX覆盖说明

|系统级DFX分类|是否涉及|原因|
|:---|:---|---|
|CT|涉及|查询的过程中，即使原来的DC失效，DC也不会失效，  只有当最后一个使用者结束时，才能释放此内存,查询过程中，原来的DC失效，查询依然基于旧DC不会换到新的DC,需要验证dc加载、失效的过程中并发dml、select是否会有异常|
|KT|涉及|kill重新拉起后，会涉及一些DC entry等常驻内存的加载，需要查看重启后DC后续加载功能是否正常|
|长稳|不涉及|原有的长稳用例有分区表的各种操作，不需要再单独补充|
|一致性|不涉及|DC不涉及事务|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|不涉及跟第三方工具的对接|
|安全|不涉及|DC不涉及安全|
|DFR|不涉及|  
|
|HA|涉及|机制在备机也生效|
|压力|不涉及|DC加载和失效和淘汰不涉及压力|
|性能|不涉及|  
|
|可维护性|不涉及|当前框架就能看护|


  


# 4. 测试用例

1、测试设计评审时提供冒烟文本用例；

|SR编号|SR名称|用例集|用例编号|用例测试点|级别|模块|预置条件(可选)|测试步骤(可选)|预期结果(可选)|
|---|---|---|---|---|---|---|---|---|---|
|YDBRD-19732|分区DC懒加载|  
|test_sdv_YDBRD_14378_001|dml、select只涉及部分分区（第一次加载、全部在内存中、部分在内存部分需要加载）|L0|存储|  
|1、带索引、不带、以及带lob和不带lob的场景下，dml、select只涉及部分分区（第一次加载）|dml和select结果正确，V$DICT_CACHE中的信息正确|
|YDBRD-19732|分区DC懒加载|  
|test_sdv_YDBRD_14378_002|查询分区表的所有分区数据|L0|存储|  
|select * from table     
  全部分区DC都会加载|  
|


2、启动测试之前提供文本用例，并完成大部分自动化用例；

[DC懒加载.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWZhMWFkOWEzMzExZGM4ZWRmIiwicmVmX2lkIjoiNjczOTZkMWY3MjgyMDZlZmI5MmYxYjZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MDQ2LCJleHAiOjE3ODIzOTI0NDZ9.GfEasIEfg5Wq8_HF6v2vuQUPtNWJU3M4fgU-zWb2Y4M)

# 5. 测试框架设计

- *不需要单独设计框架， 当前的框架可以满足*


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

工作量：  *10人天*

计划测试完成时间：

## Attachments:

[DC懒加载.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMWZhMWFkOWEzMzExZGM4ZWRmIiwicmVmX2lkIjoiNjczOTZkMWY3MjgyMDZlZmI5MmYxYjZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MDQ2LCJleHAiOjE3ODIzOTI0NDZ9.GfEasIEfg5Wq8_HF6v2vuQUPtNWJU3M4fgU-zWb2Y4M)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,【会议纪要】DC分区懒加载测试设计评审,一、会议时间：2024/4/22 周一 15:30-16:00,二、会议地点：线上会议,三、会议主持人：郑荃,四、参会人员：张锐，陈瑞,五、会议主题：DC分区懒加载测试设计评审,六、会议总结 ：无,Posted by zhengquan at 四月 22, 2024 15:51|
|---|
