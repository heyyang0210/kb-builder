Created by 刘大境, last modified on 一月 04, 2024

# 1. 概述

支持alter index rename功能，其中22.2只支持单机，23.1/23.2支持单机、分布式和集群

支持alter index rename，重命名索引，  alter index old_name   rename     to new_name;

# 2. 需求分析

22.2 SR：       [[YDBRD-22965] 支持alter index rename功能 - SICS-CoD Jira (yasdb.com](https://jira.yasdb.com/browse/YDBRD-22965)      [)](https://jira.yasdb.com/browse/YDBRD-22965)  

23.1 SR:        [[YDBRD-24926] 支持alter index rename功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-24926)  

23.2 SR：    [[YDBRD-23252] 支持alter index rename功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-23252)  

设计：    [支持alter index rename功能 - 郑翌恺 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=135612736)  

## 2.1 功能点分析

语法：

alter index old_name rename to new_name;

## 2.2 应用场景

需求与其他特性的关联场景：

索引相关对象：rename后各种创建、修改、删除、查询对象的操作正常。 对象跟索引有关系（表、表空间、分区表）

约束、依赖关系：renmae以后索引  中存储的对象之间的依赖关系正常：外键约束、触发器等

备份恢复、主备切换：rename以后备份恢复、主备切换查询正常

索引各种操作：rename索引的各种操作正常（invisiable/unusable/useable)

视图：rename以后执行计划正确，走索引扫描可以正常查询出来数据（obj$,DBA_INDEXS,DBA_PART_INDEXES）

  


DDL：rebuild index/modify index使用rename后的索引

2.3 规格约束

**指定的新的索引名称不能为空且必须符合对象命名规范，新名称不能已被其他索引使用**

**修改的系统表：obj$**

**不支持rename_index_partition**

# 3. 详细测试设计

## 3.1 测试设计方法

*语法：主要采用等价类划分的方式，划分有效等价类和无效等价类进行覆盖*

*功能：*  *采用场景法，验证rename前后跟索引、以及索引中的各个对象操作功能正常*

  


*测试范围*

部署模式：单机、分布式（23.2支持），集群(23.2支持) 

对象：表、表空间

表：行表、列表、普通表、分区表（一级分区/二级分区)

索引：  BTREE、RTREE(22.2不支持)、普通索引、local索引、唯一索引、反向索引、函数索引、一级分区索引、二级分区索引（本地索引、全局索引）、通过创建主键\unique约束自建的索引

测试关注：

rename后新的索引alter、drop正常，在新的表空间上对象正常

rename后旧的索引不能用

rename以后执行计划正确，走索引扫描可以正常查询出来数据，继续做dml操作也正常

索引的视图中索引信息都已更新成新的索引

## 3.2 详细测试设计

#### 3.2.1 详细功能测试点:

##### 3.2.1 .1 语法

|输入条件|有效等价类|无效等价类|备注|
|---|---|---|---|
|new_index_name|1. A索引名称 rename B索引名称 再rename回A索引名称,2.alter index rename to 大小写混合,3.renma索引对象长度为1,4.alter index A rename B,  B在当前schema不存在，在其他schema存在|1.rename 索引名称为空,2.rename 超过索引对象名称长度,3.rename 以数字开头,4.alter index A rename A, 重复rename,5.rename带特殊字符、表情,7.alter index A rename B,  B在当前schema存在|  
|
|  `old_name `  |1.存在的索引,2.已经被rename过的旧索引名|alter index 不存在的索引名称 rename|  
|
|关键字|  
|关键字异常:,1、rename 关键字写错,2、to 关键字写错,3、old_name to rename new_name; ,4、alter index rename old_name to new_name;,5、alter table rename old_name to new_name;,关键字重复：,1、alter index old_name rename  rename to new_name;,2、alter index old_name rename  to  to new_name;,3、alter index old_name old_name  rename  to new_name;,4、alter index old_name rename  to new_name new_name;,关键字缺失：,alter index old_name to new_name;,alter index old_name rename   new_name;,alter index  rename   to  new_name;,alter index old_name  rename   to  ;|  
|
|schema|当前session连接的用户为schema A,1、alter index A.old_name rename to new_name;,2. alter index new_name rename to old_name;|当前session连接的用户为schema A,1、alter index A.old_name rename to B.new_name;,2、alter index old_name rename to B.new_name;,3、alter index B.old_name rename to A.new_name;,4、alter index old_name rename to A.new_name;,5、alter index A.old_name rename to A.new_name;|23.2单机、集群、分布式皆可复用22.2语法部分|


  


##### 3.2.1 .2功能场景

|测试场景|用例详细描述|预期|备注|
|---|---|---|---|
|alter index rename 功能测试|1、rename索引前先创建对应表对象,2、alter index rename,3、查询索引的视图中索引信息都已更新成新的索引，打印执行计划explain，走索引扫描可以正常查询出来数据,obj$,DBA_INDEXS,DBA_PART_INDEXES,DBA_SEGMNTS,DBA_OBJECTS(查看下状态，失效对象是否一致),V$TABLE_DICTIONARY(DC是否失效)|2、rename成功,3.查询成功，正常查询出来数据|主要关注以下系统表及视图,obj$,DBA_INDEXS,DBA_PART_INDEXES,DBA_SEGMNTS|
|  
|alter index rename，对索引做修改操作(  invisiable/unusable/useable/coalesce/noparallel/parallel  ),  查看相关视图|可以修改成功,相关视图信息正确|  
|
|  
|不同索引类型rename：  BTREE、RTREE、普通索引、local索引、唯一索引、反向索引、函数索引，分区索引rename后带数据|修改成功|  
|
|  
|rename 前索引状态为   invisiable/unusable/useable，然后做rename index|rename后索引的状态不变|  
|
|  
|索引列上存在约束,1.check约束,2.外键约束,3.unique约束,4.主键约束|  
|以上操作皆带DML /DDL、查询操作,dba_con|
|  
|rename 索引后，table tablea add  主键、唯一约束 using index使用rename 后的索引|  
|  
|
|  
|索引所在的表空间offline，rename index|报错|  
|
|  
|rename_index_partition不支持拦截|  
|  
|
|分布式  (23.2支持)|表类型：,1.分布表（TAC和LSC）——local索引,2.复制表 -非分区表——global 、local索引,3.复制表 -分区表——global 、local索引|  
|重点关注以下视图信息,dba_indexs，DBA_IND_SUBPARTITIONS，DBA_IND_PARTITIONS，DBA_IND_STATISTICS，INDPART$ 索引分区信息|
|  
|索引类型：,1.  唯一索引、分区索引（本地索引，包含一级分区、二级分区场景）|  
|  
|
|  
|schema覆盖上述部分|  
|  
|
|  
|索引列上存在约束,1.check约束,2.外键约束,3.unique约束,4.主键约束|  
|  
|
|  
|rename后，扩缩容|  
|  
|
|  
|rename后， 收集表的统计信息|  
|  
|
|集群  (23.2支持)|1.复用单机功能用例,2.实例1alter index rename，实例1实例2查询DBA_INDEXS视图，执行计划，数据校验|  
|  
|
|表空间迁移(22.2不支持)|rename index后，迁移索引所在的表空间|可以成功迁移，迁移后视图信息正确，对象的功能正常|  
|
|HA|1、reanme前先创建对应的表对象,2.创建索引指定列,3.DML,4.全量备份,5.alter index rename,6.主备切换，新主查询,7.主备倒换，执行恢复操作后，主机查询|  
|  
|
|并发|alter index rename+ 增删索引|  
|  
|
|  
|alter index rename+增删索引+增删改查数据并发|  
|  
|
|  
|alter index rename+ rebuild index|  
|  
|
|  
|alter index rename+ modify   invisiable/unusable/useable|  
|  
|
|  
|alter table rename+ alter index rename并发|  
|主要为了检验开发设计里，写的日志栏：alter index调用的是alter table日志，不需要修改|
|  
|rename table、rename index、 rename tablespace并发|  
|  
|
|长稳|alter index rename后 跑长稳|  
|  
|
|升级|升级成功后，rename索引成功后带查询，最后清理所有对象|rename成功|  
|


|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|涉及|
|三分测试工具|/|
|安全|/|
|DFR|/|
|HA|涉及|
|压力|/|
|性能|/|
|可维护性|/|


# 4. 测试用例

（1）详见22.2版本附件，冒烟文本用例以及测试文本用例

(2) 详见23.2版本附件，冒烟文本用例以及测试文本用例

(3) 详见23.1版本附加，冒烟文本用例以及测试文本用例

# 5. 测试框架设计

*1.功能部分放yasft上看护*

*2.HA、备份恢复、表空间迁移放ha_regress上看护*

*3.CT/KT放testkill框架看护*

# 6. 测试环境说明

|服务器|  
|
|---|---|
|操作系统|linux|
|部署|单机、集群、分布式|


  


# 7. 工作量评估

工作量：1人/1周

计划测试完成时间：

## Attachments:

[image2023-11-28_11-21-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjE4OTcwYzJhZjRmNTIwODE0IiwicmVmX2lkIjoiNjczOTZiZjE3MjgyMDZlZmI5MmYwYmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTM1LCJleHAiOjE3ODIzODQ1MzV9.AlvGmeHaezrR3xF2ndNfdLStNt-Q15gQQT_X_pRt2NE)

 (image/png)    


[支持alter index rename功能测试文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjFhMWFkOWEzMzExZGM4NjhiIiwicmVmX2lkIjoiNjczOTZiZjE3MjgyMDZlZmI5MmYwYmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTM1LCJleHAiOjE3ODIzODQ1MzV9.g4Frxhvnx3_o7xLG4s84aoMLx54Ezxshbm91q3UUo4I)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[支持alter index rename功能冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjE4OTcwYzJhZjRmNTIwODE1IiwicmVmX2lkIjoiNjczOTZiZjE3MjgyMDZlZmI5MmYwYmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTM1LCJleHAiOjE3ODIzODQ1MzV9.gbXMoR8aKFzDOhSF14hh5uakSKrrt-eOwMc_eTeovxs)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[1.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjFhMWFkOWEzMzExZGM4NjhjIiwicmVmX2lkIjoiNjczOTZiZjE3MjgyMDZlZmI5MmYwYmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTM1LCJleHAiOjE3ODIzODQ1MzV9.JzWcnBw-w4F4q1hTOuozMPUoYGvphalUsjOgJvkIJMA)

 (image/jpeg)    


[支持alter index rename功能测试文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjE4OTcwYzJhZjRmNTIwODE2IiwicmVmX2lkIjoiNjczOTZiZjE3MjgyMDZlZmI5MmYwYmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTM1LCJleHAiOjE3ODIzODQ1MzV9.upC5DI1i8l4AhOcKn3huMqL_cm-p9_F6m3ev2Ct1kLk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[支持alter index rename功能测试文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjE4OTcwYzJhZjRmNTIwODE3IiwicmVmX2lkIjoiNjczOTZiZjE3MjgyMDZlZmI5MmYwYmYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MTM1LCJleHAiOjE3ODIzODQ1MzV9.coANIbW_TbDEzLya-K-IkpzAwbRTD5Rp03y0CiUH7po)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
