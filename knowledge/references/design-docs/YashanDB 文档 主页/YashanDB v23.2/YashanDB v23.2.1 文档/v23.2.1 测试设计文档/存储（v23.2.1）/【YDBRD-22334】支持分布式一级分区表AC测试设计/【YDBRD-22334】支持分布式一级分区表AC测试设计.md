Created by 郑荃, last modified on 十二月 18, 2023

# 1. 概述

​ 当前系统内的AC存储表空间和主表保持一致，不满足分布式特性，另外目前AC在创建时不支持延迟创建方式，这两个缺陷都在扩缩容时造成很大阻力。因此，需要使分区表下的AC分区和所在分区表空间保持一致，保证在迁移的时候chunk上所有的对象可以随着chunk一起迁移，还要支持延迟创建，适配目前的元数据迁移思路。

# 2. 需求分析

SR链接：    [YDBRD-22334](https://jira.yasdb.com/browse/YDBRD-22334?src=confmacro)    -  支持分布式一级分区表AC  完成

设计文档：

  [【AC】支持分布式一级分区表AC](133585282.html)  

  [【AC】支撑延迟创建](/pages/createpage.action?spaceKey=YAS&title=%E3%80%90AC%E3%80%91%E6%94%AF%E6%92%91%E5%BB%B6%E8%BF%9F%E5%88%9B%E5%BB%BA)  

## 2.1 功能点分析

**AC功能适配：**

|功能|设计表现|设计说明|
|:---|:---|:---|
|分区表的AC表空间和所在分区一致|AC所在表空间和所在分区一致|分布式下AC更符合目前的chunk存储思路 并且便于数据迁移|
|AC支持延迟创建|新创建AC时不创建对应数据段 只在后台ac数据生成时创建|适配表空间元数据迁移时对象必须支持延迟创建特征 此外可一定程度节省表空间|
|表空间带AC支持扩缩容|存在AC的数据库系统可进行扩缩容|补齐分布式扩缩容能力 凸显AC优势|


**扩缩容适配：**

- 在AC的扩缩容适配中 需支持transport AC和reclaim AC的相关语法
- 元数据获取分为两个部分：transport迁移对象和reclaim迁移对象的具体元数据信息


                   transport迁移对象指的是迁移对象的定义 根据对象的定义元素获取创建此对象需要的子句

                   reclaim迁移对象指的是迁移对象的数据段元数据 一般是一些数据段的entry和spaceid信息。  reclaim对象是迁移对象中极关键的一步 它通过逻辑上类似于挂载对象元数据的方式 使得一个对象拥有完整的元数据信息从而完成一个对象的迁移

![](https://pingcode.yasdb.com/atlas/files/public/67396beea1ad9a3311dc8681/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUNBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUJBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgwMzcsImV4cCI6MTc4MjMwODgzN30.SbC7iLk4mQZjNVwKl3KkbVii96900wbqebTd3_QRKvU)

![](https://pingcode.yasdb.com/atlas/files/public/67396bee8970c2af4f52080c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUNBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUJBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgwMzcsImV4cCI6MTc4MjMwODgzN30.SbC7iLk4mQZjNVwKl3KkbVii96900wbqebTd3_QRKvU)

**视图：**

DBA_ACS和DBA_PART_ACS视图显示AC基础元数据信息

## 2.2 应用场景

1、需求本身的主要应用场景

- 主要应用于分布式带AC时的扩缩容


2、需求与其他特性的关联场景

- 带AC场景下的表空间迁移
- 带AC场景下分布式扩缩容
- 含有废弃的AC slice 走归档清理后的扩缩容   


## 2.3 规格约束

- 只支持适配一级分区表AC的相关能力


# 3. 详细测试设计

## 3.1 测试设计方法

功能验证：场景法组合及错误推测法进行设计。主要验证AC表空间和segment创建、以及扩缩容功能。

语法：新增transport AC和reclaim AC的相关语法，不对外呈现，不需要对语法进行验证，只需要结合功能验证表空间迁移和扩缩容功能正常即可。 

  


测试范围：

- 部署模式：单机、分布式
- 表的存储类型：lsc、tac、heap， 测试中主要采用LSC进行验证，TAC和HEAP只是做单点覆盖
- 表类型：单机（普通表、一级分区表，二级分区表拦截）、分布式（一级分布分区表，普通复制表，一级分区复制表，二级分区复制表拦截，二级分布分区表拦截）
- 表空间的对应关系：表和AC在同一个表空间、 表的分区和表不在一个表空间、 表的各个分区不在同一个表空间（单机）


## 3.2 详细测试设计

|  
|测试场景|用例详细描述|部署模式|预期|备注|
|---|---|---|---|---|---|
|1|分区表的AC表空间和所在分区一致|创建普通LSC表，创建AC|单机：普通表,分布式：  普通复制表|表和AC在同一个表空间|观测视图：,DBA_ACS,DBA_PART_ACS,DBA_SEGMENTS,DBA_AC_COLUMNS,DBA_TAB_PARTITIONS,ALL_ACS,ALL_PART_ACS,USER_ACS,USER_PART_ACS,  
|
|2|  
|创建分区表，各个分区和表在同一个表空间|单机、分布式支持的所有表类型|表和AC在同一个表空间||
|3|  
|创建分区表，各个分区和表不在通一个表空间|单机：分区表,分布式：,一级分区复制表支持, 分布表不支持指定分区的表空间|AC跟分区在同一个表空间||
|4|  
|创建分区表，AC指定表空间和分区、表都不在一个表空间|单机支持，分布式不支持指定|  
||
|5|AC支持延迟创建|1、无冷数据时创建AC，查询AC的segment情况,2、再做冷数据转换，再查询AC的segment情况|单机、分布式|1、无冷数据时，不会创建egment,2、做alter slice转换后，会创建AC数据后可以查询到AC的segment信息，数据查询正确||
|6|  
|先生成冷数据，再创建AC，再查询，观测segement是否创建|单机、分布式|创建AC后，会创建segment（后台生成后创建）,先关闭AC开关，然后打开AC开关，做转换||
|7|  
|在TAC和HEAP上创建AC|单机覆盖即可|不会有segement||
|8|  
|部分AC分区有数据，部分分区没有数据，看是否只有有数据的AC分区创建了segment|单机、分布式|有数据的分区会创建（有冷数据），无数据不会创建|构造方案有几种，指定部分分区插数，再转换静态数据，这个时候就只有部分分区有数；另外也可以先插入数据，转冷。然后关闭AC生成开关，再指定分区drop或者truncate|
|9|  
|delete数据segment不会删，truncate表会删|单机、分布式|truncate表会删再插入数据会新创建segment|  
|
|10|  
|AC失效（合并或者更新/删除冷数据）后重新生成是用之前的segment还是会删掉重建|单机、分布式|复用之前的segment|合并或者更新/删除冷数据，就会触发AC失效|
|11|扩缩容、表空间迁移|无冷数据时创建AC后做扩缩容、表空间迁移|单机、分布式|成功，目标端的AC无segement，查询结果为空|扩缩容后的校验：,1、相关视图目的端和源端做对比,2、迁移后直连AC查询、或者AC方式查询数据正确,3、迁移后数据做delete、update正常,4、迁移后新插入数据，做alter slice转换生成新的AC正常,5、做静态数据合并正常,  
|
|12|  
|有冷数据，且冷数据已全部转换成AC数据时扩缩容、表空间迁移|单机、分布式|成功，目标端的AC相关视图查询结果正确，数据正确||
|13|  
|有冷数据，未转换AC数据完成时做扩缩容、表空间迁移|单机、分布式|还是先扩缩容完成再到目标端继续做||
|14|  
|部分AC分区有数据，部分分区没有数据进行表空间迁移、扩缩容|单机、分布式|  
||
|15|  
|构造废弃的AC slice（在  garbage_data$  ） 时做扩缩容、表空间迁移,（  带ac含静态数据的表合并、delete、update(AC失效数据重新生成)  ）|单机、分布式|  
||
|16|  
|构造废弃的AC slice（在  arch_data$  ） 时做扩缩容、表空间迁移,（  带ac含静态数据的表合并、delete、update(AC失效数据重新生成)  ）|单机、分布式|  
||
|17|  
|源端和目的端对比查看AC元数据是否正确,​ dbms_tts_metadata.get_tts_ddl,​ dbms_reclaim_metadata.get_reclaim_ddl|单机、分布式|  
||
|18|  
|手动执行transport和reclaim|单机覆盖即可|可以成功||
|19|  
|表空间迁移自包含不全场景下报错，是否会残留清理,1、AC和表都在迁移范围内的表空间,2、表在迁移的表空间，AC在不迁移的表空间,3、AC在迁移的表空间，表不在迁移的表空间中,4、部分AC迁移的表空间，部分AC不在迁移的表空间中|单机、分布式|AC应该要做残留清理||
|20|  
|在HEAP和TAC表创建AC，进行迁移，扩缩容|单机：heap和tac,分布式覆盖:tac|成功|  
|
|21|  
|tac+users_aim的表对应的AC|  
|  
|  
|
|22|  
|扩容前alter drop col--AC列，扩容后查AC|  
|  
|  
|
|23|拦截场景|二级分区带AC 迁移或者扩缩容|单机、分布式|应该拦截|  
|
|24|  
|创建分区表，AC指定表空间和分区、表都不在一个表空间，做表空间迁移|单机覆盖|待确认|  
|
|25|并发|表空间或扩缩容迁移过程中，并发做alter slice转换（源端、目的端）|单机覆盖即可|  
|  
|
|26|  
|迁移到一半，源端或者目标端被kill|单机覆盖即可|  
|  
|
|27|  
|表空间迁移过程中，对表做DML操作（源端、目的端）|单机覆盖即可|  
|  
|
|28|HA|表空间迁移：,目标端是HA，源端是单机,源端是HA，目标端是单机,目标端是HA，源端是HA|单机覆盖即可|  
|  
|


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|/|
|HA|涉及|
|压力|/|
|性能|/|
|可维护性|/|


  


# 4. 测试用例

冒烟用例：

测试用例

# 5. 测试框架设计

- *单机的表空间迁移，使用HA框架实现*
-   [      https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_heap/testcase/ha_schedule_common/tablespace/duplicate_tablepsace](https://git.yasdb.com/cod-test/yasft/-/tree/master/ha/ha_heap/testcase/ha_schedule_common/tablespace/duplicate_tablepsace)  
- *分布式扩缩容，使用yastest_dfx实现*
-   [       https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/dst_ha_test/src/test/dst/scale_group](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/dst_ha_test/src/test/dst/scale_group)  
- *AC功能，使用guider框架，用例放在yasft下*
- *     *    [https://git.yasdb.com/zhengquan/yasft](https://git.yasdb.com/zhengquan/yasft)  


# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  [详细测试设计文档模板.doc](#)  

## Attachments:

[AC用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWVhMWFkOWEzMzExZGM4NjdmIiwicmVmX2lkIjoiNjczOTZiZWU3MjgyMDZlZmI5MmYwYmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MDM2LCJleHAiOjE3ODIzODQ0MzZ9.XBX35Ne2hFEBh2LRIIibtgR5YDRLV6hhwt7O31VSpW4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[AC测试门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWVhMWFkOWEzMzExZGM4NjgwIiwicmVmX2lkIjoiNjczOTZiZWU3MjgyMDZlZmI5MmYwYmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MDM2LCJleHAiOjE3ODIzODQ0MzZ9.Yph7pQKsSXKoJne74V6JehwoFbt9sxoa5aAM7rTzcCE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[AC用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZWU4OTcwYzJhZjRmNTIwODBiIiwicmVmX2lkIjoiNjczOTZiZWU3MjgyMDZlZmI5MmYwYmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MDM2LCJleHAiOjE3ODIzODQ0MzZ9.PnxpGPJZCZNpEaoRYmm8mMcmp99vjVxwTR-4eYJLb_g)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
