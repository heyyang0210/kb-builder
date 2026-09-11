# 1. 概述

 IR链接：  [alter table drop/split/truncate partition支持update global indexes功能](https://pingcode.yasdb.com/ship/ideas/670e20d652495bd785c5d582?%0A#YASHAN-3379%20%20alter%20table%20drop/split/truncate%20partition%E6%94%AF%E6%8C%81update%20global%20indexes%E5%8A%9F%E8%83%BD)  

SR链接：  [alter table drop/split/truncate partition支持update global indexes功能](https://pingcode.yasdb.com/pjm/items/675bf620622069d46df83cd6?%0A#YDBRD-36534%20alter%20table%20drop/split/truncate%20partition%E6%94%AF%E6%8C%81update%20global%20indexes%E5%8A%9F%E8%83%BD)  

转测形态：单机，集群

表类型：heap表，lsc表



alter table drop/split/truncate partition支持update global indexes功能

需求背景：

执行分区DDL，例如drop/truncate/split/merge partition时，默认会将全局索引失效，在执行完成后用户需要手动rebuild索引。

为了使用方便，增加了update global indexes子句。如果用户的分区DDL指定该子句，那么在执行后全局索引仍是有效的，不需要用户再手动rebuild索引。

# 2. 需求分析

  [https://pingcode.yasdb.com/wiki/pages/6763d028a03b8234860add78](https://pingcode.yasdb.com/wiki/pages/6763d028a03b8234860add78)  

## 2.1 功能点分析

对于

- 第一阶段


在DDL阶段标记索引isOrphaned=True。cleanup阶段才回收孤儿key所占的空间。第一阶段是标记索引表示包含孤儿key，并且后续的DML中需要处理孤儿。不影响分区索引处理。



1、当drop、truncate分区时，如果update global indexes则将索引flag上的isOrphaned置为true。



2、split/merge分区不复用分区则会有数据迁移。如果指定update global indexes，则在迁移前将isOrphaned置为true，迁移是处理孤儿。

数据插入到新分区时如果索引是非unique索引会插入到新位置不会覆盖孤儿，调研oracle的unique索引，split/merge分区指定UPDATE GLOBAL INDEXES之后标记ORPHANED_ENTRIES = NO。



3、新增redo，专门清理leaf block上的所有孤儿key。这个redo在unique索引插入和coalesce中用到。

分区ddl+故障场景。假如在覆盖孤儿索引过程中，ddl回退。那么需要





- 第二阶段


清理完的全局索引孤儿key。

1、手动：alter index coalesce cleanup [only]  ,coalesce cleanup中同时进行了3件事：清理孤儿key、compact页面、coalesce。指定only时。只做孤儿key清理



2、高级包：call dbms_part.CLEANUP_GIDX_JOB(parallel => 4,options => 'COALESCE');     

DBMS_PART.CLEANUP_GIDX_JOB (

   parallel          IN   VARCHAR2 DEFAULT NULL,

   options           IN   VARCHAR2 DEFAULT NULL);

|参数|值|
|---|---|
|parallel          |The parallel degree to use for the ALTER INDEX DDLs.|
|options           |The following options are supported:,CLEANUP_ORPHANS: implies that 'cleanup only' mechanism is used.,COALESCE: implies that coalesce cleanup mechanism is used.|




3、job：PMO_DEFERRED_GIDX_MAINT_JOB，调用高级包实现，每天凌晨2点扫描全库的包含孤儿key索引，然后cleanup only



## 2.2 应用场景

#### 1、  使索引失效的原因。分区有数据时

- drop partition/subpartition   --只支持update global indexes语法
- truncate partition/subpartition  --只支持update global indexes语法
- split partition，不复用原分区  --update [global] indexes
- merge partition/subpartition，不复用原分区  --update [global] indexes


指定 update indexes 时，不失效分区索引和全局索引   --分区索引不失效的能力已支持，与本需求无关



#### 2、索引类型覆盖。   --用一张表覆盖所有的所有类型

全局唯一/非唯一索引：btree，列式，函数，reverse，rtree

分区索引本次不涉及。测有全局索引的情况下，带update [global] indexes, 分区索引可用状态不受影响。



#### 3、分析本次全局索引和表分区策略无关。表类型，不做重点测试，但是覆盖到全部的一二级分区类型即可。

场景和以下分区组合到：一级分区用range分区，二级分区用 *-list

基础场景覆盖到几种分区类型即可。range(interval)，list，hash。9种二级分区

heap表  --四类DDL操作

lsc表unique索引    --drop,truncate操作



#### 4、update global indexes dml/select功能不受影响，统计信息准确



#### 5、cleanup后孤儿索引被清理干净



#### 6、视图dba_indexes新增字段，在其他功能场景中验证

      不涉及全局分区索引，DBA_IND_PARTITIONS，DBA_IND_SUBPARTITIONS 不新增字段，外键级联



#### 7、主键，唯一键，外键

指定update global indexes，不影响主键、唯一约束使用，关联的外键不受影响





## 2.3 规格约束

分布式拦截

# 3. 详细测试设计

## 3.1 测试设计方法

按照场景法设计分析

#### 1、第一阶梯

- 指定 update global indexes 后继续执行dml。不同的插入方式底层调用不同的接口，覆盖所有的dml类型。插入数据的多样性，相同的数据，不同的数据
- 指定 update global indexes 后继续执行查询，执行计划准确，索引数据准确(指定hint)，没有误扫描到孤儿索引，索引统计信息准确(查询dba_indexes的NUM_ROWS,LEAF_BLOCKS,BLEVEL)
- 指定update global indexes 后，未执行cleanup，继续执行ddl，包括能继续失效索引的分区ddl，索引ddl，表ddl
- 指定update global indexes ，过程中kill数据库故障，在线恢复后 


1.ddl已提交,未刷盘,故障恢复后，索引状态正常，标记Y，索引数据正常   

2.ddl执行过程中故障，ddl回退，索引的状态，孤儿标记能被准确回退，查询索引数据正常

3.集群节点故障+恢复过程中，执行ddl

- 分区无数据或split/merge分区，数据迁移时复用了原分区，不失效全局索引。
- 先做delete/update操作，使btree结构改变，然后再指定update global indexes 后。
- 指定update index。能同时处理失效全局索引和索引分区的失效




#### 2、第二阶梯

- 语法：有效类和无效类。alter index index_2 modify partition/subpartition xxx coalesce cleanup;
- 高级包参数正常
- 定时任务正常定时触发
- 指定cleanup后，        标记变为N，孤儿索引被清理，页面被compact，空闲页面被回收
- 指定cleanup only后，标记变为N，仅做孤儿索引清理。
- 指定 cleanup [only]后继续执行dml。不用覆盖所有的dml。
- 高级包清理后，标记变为N，孤儿索引被清理，页面被compact，空闲页面被回收
- 后台job清理后，数据库不存在标记=Y 的索引。
- 过程中kill数据库故障，在线恢复后


                  1.已经提交，但未刷盘，在线恢复后，空闲页面已经被回收。

                  2.ddl未提交，ddl被回退，标记能被准确回退为Y，查询索引数据正常。但是孤儿索引可能已经被清理，不回退。

   3.集群节点故障+恢复过程中，执行ddl

- unusable/正常状态的全局索引，cleanup不报错
- drop/truncate完所有有数据的分区。cleanup不报错
- 重复做cleanp




#### 3、testkill，分区ddl带update global indexes + dml + 查询。并发带故障



#### 4、ddl并发+故障过程中，走索引查询数据一致性



#### 5、物理备机标记是否同步。逻辑备机解析ddl是否正确



#### 6、孤儿索引数据量较大，查询、插入、cleanup的性能做一个摸底

## 3.2 详细测试设计

语法类采用有效等价了。涉及alter index xxx  coalesce cleanup only；update global indexes已经做了语法兼容不涉及

||有效类|无效类|
|---|---|---|
|全局索引|coalesce cleanup||
||coalesce cleanup only||
|调换顺序||cleanup coalesce |
|||cleanup coalesce  only|
|||coalesce only cleanup|
|与其他组合可选项组合--oracle支持，yashan拦截||INITRANS /VISIBLE/INVISIBLE /UNUSABLE/COALESCE /NOPARALLEL /PARALLEL /NOLOGGING /LOGGING /+ coalesce cleanup [only]|
|一级索引分区 -- 语法兼容|modify partition P99 coalesce cleanup;||
|| modify partition P99 coalesce cleanup only;||
|||调换顺序,cleanup coalesce ,coalesce cleanup only,coalesce only cleanup|
|||二级分区的一级分区执行modify partition P99 coalesce cleanup|
|||INITRANS/UNUSABLE/COALESCE  + coalesce cleanup [only]|
|二级索引分区 -- 语法兼容|modify subpartition P99 coalesce cleanup;||
|| modify subpartition P99 coalesce cleanup only;||
|||调换顺序,cleanup coalesce ,coalesce cleanup only,coalesce only cleanup|
|||UNUSABLE/COALESCE  + coalesce cleanup [only]|






|序号|功能|场景||
|---|---|---|---|
||表上带全局唯一/非唯一索引：btree，列式，函数，reverse，rtree,执行四种ddl分区操作，,指定 update global indexes 后,继续执行dml,commit,rollback,,执行计划使用到索引|SELECT||
|||指定hit查询索引数据||
|||INSERT  ||
|||普通插入||
|||INSERT INTO SELECT 批量插入||
|||并行插入||
|||多表插入||
|||PARTITION/SUBPARTITION  for (key_value)||
|||PARTITION/SUBPARTITION  (pname/subpname)||
|||ON DUPLICATE KEY UPDATE||
|||LSC表||
|||BULKLOAD冷数据插入||
|||BULKLOAD DEDUPLICATE 冷数据去重插入||
|||热数据插入||
|||LOAD||
|||行表单线程导入||
|||并行导入||
|||lsc冷数据导入||
|||lsc热数据导入||
|||去重导入||
|||DELETE||
|||delete不带condition||
|||delete带condition||
|||PARTITION/SUBPARTITION  for (key_value)||
|||PARTITION/SUBPARTITION  (pname/subpname)||
|||多表delete||
|||指定hit并行delete||
|||lsc表冷数据删除||
|||lsc表热数据删除||
|||UPDATE||
|||update不带condition||
|||update带condition||
|||PARTITION/SUBPARTITION  for (key_value)||
|||PARTITION/SUBPARTITION  (pname/subpname)||
|||多表update||
|||指定hit并行update||
|||lsc表冷数据更新||
|||lsc表热数据更新||
|||merge||
|||merge into insert||
|||merge into update||
|||merge into delete||
||约束|update global 之后，主键，唯一键使用不受影响||
|||update global 之后，与主键、唯一键关联的外键约束使用正常||
|||update global 之后，与主键、唯一键关联的外键级联约束正常||
||指定 update global indexes 后，继续执行ddl，包括能继续失效索引的分区ddl，索引ddl，表ddl|drop index;||
|||alter index INITRANS /VISIBLE/INVISIBLE /UNUSABLE/COALESCE /NOPARALLEL /PARALLEL /NOLOGGING /NOLOGGING;||
|||alter index rebuild [online];  --不存在孤儿索引，标记未N||
|||alter index rebuild  tablespace 重建到其他表空间,alter index rebuild [online] tablespace ;  --不存在孤儿索引，标记未N||
|||alter index rebuild partition [online]; ||
||指定update global indexes ，过程中kill数据库故障，在线恢复后|DDL执行完完毕，但未持久化，故障恢复后，索引状态正常，标记正常，查询索引数据正常,drop partition/subpartition update global indexes,truncate partition/subpartition update global indexes,split partition update [global] indexes,merge partition/subpartition update [global] indexes||
|||ddl执行过程中故障，ddl回退，索引的状态，孤儿标记能被准确回退，查询索引数据正常,split/merge 构造数据量较大的分区。drop / truncate 执行较快，依赖KT覆盖,split partition update [global] indexes,merge partition/subpartition update [global] indexes||
|||集群节点故障+恢复过程中，执行ddl||
||split/merge不失效全局索引的场景|原分区无数据，索引状态不变，标记不变||
|||有数据，结果分区复用复用某一个原分区，索引状态不变，标记不变||
||先做delete/update操作，然后再指定update global indexes 后|delete/update 某个分区部分数据，再update global indexes||
||指定update index|索引分区和全局索引都不失效。||
||cleanup,表上带全局唯一/非唯一索引：btree，列式，函数，reverse，rtree，,执行四种ddl分区update global indexes 后，执行cleanup|指定cleanup后，标记被清理，孤儿索引被清理，页面被compact，空闲页面被回收,||
|||指定cleanup only后，标记被清理，孤儿索引被清理，页面未compact，空闲页面未回收||
|||指定 cleanup [only]后继续执行dml，查询索引数据正常||
|||使用高级包清理，标记被清理，孤儿索引被清理，页面被compact，空闲页面被回收||
|||使用高级包指定并行，标记被清理，孤儿索引被清理，页面被compact，空闲页面被回收。||
|||构造100个索引，后台job清理后，数据库不存在标记=Y 的索引。--手工验证||
||约束|clean 之后，主键，唯一键使用不受影响||
|||clean 之后，与主键、唯一键关联的外键约束使用正常||
|||clean 之后，与主键、唯一键关联的外键级联约束正常||
||drop/truncate完所有有数据的分区|cleanup后，索引无segment，不报错。--||
|||重复做cleanp，不报错||
|||unusable 状态的索引 cleanp。不报错，但什么也没做||
||testkill|4种分区ddl带update global indexes + dml + 查询。并发带故障||
||一致性|4种ddl并发带故障过程中，走索引查询索引数据一致性||
||备机|物理备机标记同步，cleanup后，页面合并同步||
|||逻辑备机解析ddl正确,1、update indexes,2、update global indexes,3、cleanup,4、cleanup only||
||升级|新增系统表字段，验证升级||
||性能--手工测试|孤儿索引数据量较大，查询、插入、cleanup的性能做一个摸底||






|系统级DFX分类|是否涉及|
|---|---|
|CT|  
否|
|KT|是  
|
|长稳|否  
|
|一致性|  
是|
|三方测试工具  
(sqltest，sqlancer)|否  
|
|安全|否  
|
|DFR|否  
|
|HA|是  
|
|压力|否  
|
|性能|是  
|
|可维护性|否  
|


  


# 4. 测试用例

冒烟：

  [test_sdv_YDBRD36534_update_index_000.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4ZGExMGZhMWFkOWEzMzExZGU2ZGUzIiwicmVmX2lkIjoiNjc2YjYzNWZkMmJhZmYwZmQ1NWVmMzZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5NDM5LCJleHAiOjE3ODI1NDU4Mzl9.ys83he01PsYo2e5Oy92AJkLsILK44aO0-fqQDZpKJ_o)  

文本：

  [支持update global indexes.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc4ZGEwZjZhMWFkOWEzMzExZGU2ZGUyIiwicmVmX2lkIjoiNjc2YjYzNWZkMmJhZmYwZmQ1NWVmMzZkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5NDM5LCJleHAiOjE3ODI1NDU4Mzl9.cmtImeLnc9cn6EWHSDKZwK3VQAf6eaZNYUCN1WRZSpk)  

# 5. 测试框架设计

- *yasft--功能，kt，ha*


# 6. 测试环境说明

虚拟机X86

# 7. 工作量评估

工作量：  *14人天*

计划测试完成时间：