  [https://pingcode.yasdb.com/pjm/items/661112e4579a3edb84d50031?](https://pingcode.yasdb.com/pjm/items/661112e4579a3edb84d50031?)  

#YDBRD-13417 集群支持nologging表



# 1. 概述

集群支持nologging表，logging和nologging互相转换.

支持 create/rebuild index nologging



集群可以拉起多个实例，但只能在单实例上进行nologging导入，退化成单机nologging模式。

单机出现故障重启会markCorrupted，集群故障会进行reform，reform需要在对外提供服务前把所有nologging表标记为corrupted。



# 2. 需求分析

## 2.1 功能点分析

#### 集群现状表和索引指定logging/nologging不生效默认还是logging。

- 状态在不同实例同步  --集群
    - nologging状态在不同实例的同步；表启动nologging实例所在的instance id 同步；恢复成logging表后，表entry的instance id置为invalid。
    - corrupted 状态在不同实例同步，集群reform时，在对外提供服务前同步corrupted状态
- ddl：
    - 建nologging表 --单机
    - alter table nologging/logging能力支持 --单机
    - alter index rebuild nologging/logging；--单机
    - 索引的logging/nologging属性跟随表，指定索引logging属性无效，且视图写死始终为logging --单机
    - truncate表corrupted，将该表恢复成logging表 ，instance id 消失，  单机以后也修改为该规格   --单机/集群
    - drop表 --单机
- dml/dql：
    - 批插/单条插入/导入只在单实例导入  单机/集群
    - 查询  --不支持并发查询  --单机/集群
    - 不支持集群非启动nologging实例插入 --集群
    - 支持启动nologging实例并发插入 --集群
- nologging不记录undo，记录少量redo，当前限制，回滚或者reform后表corrupted。  
    - 触发corrupted的操作验证，回滚或者reform，或者实例宕机，表corrupted  --单机/集群
    - corrupted 状态拦截除drop/truncate外的所有操作   --单机/集群
    - corrupted 状态truncate后可以恢复，恢复后表设置为logging，恢复后导入/插入无影响
- 故障，集群故障reform，恢复服务前把所有nologging表标记为corrupted
    - 集群任意一个实例故障，nologging 表标记为corrupted  --集群 kt测+yasft 精准看护
    - 设置nologging过程中故障/设置logging过程中故障  --集群--kt测
    - 实例加入退出同故障处理 --集群--kt测
- nologging其他功能交互，逻辑备机、约束、alter table ddl交互  --单机
- *视图：gv$corrupted_table，gv$*  dict_cache新增视图展示nologging表的instance id字段  *，*  dba_tables、user_tables、all_tables，dba_indexes、user_indexes、all_indexes


## 2.2 应用场景                                                                                                                                                                                                                         

主要应用场景：批量数据场景下，nologging的方式提高效率，降低系统IO负载。csv导入nologging表后，修改表为logging。继续做业务               

                                                                                                                                                                                                       

## 2.3 规格约束

- logging 表创建nologing索引拦截
- 不支持临时表
- 不支持online索引
- 不支持update、delete、并发查询（查询改动的blocks）
- 不支持ha环境，主机建表/修改为nologging会失败(目前测试通过是否存在链路来判断)  
- 节点1修改为nologging，只能在节点1设置为logging


# 3. 详细测试设计

## 3.1 测试设计方法

#### 1、集群现状表指定logging/nologging不生效默认还是logging，语法已经兼容，复用单机用例进行语法验证。执行create tableddl后对功能使用场景法验证。

1）、创建logging表，nologging 导入数据成功。

2）、指定nologging表属性生效，集群不同节点插入/导入数据成功

3）、插入/导入数据后，修改 nologging -> logging 后，表和索引属性生效。表执行业务正常。

4）、插入/导入数据后，修改 logging -> nologging 后，表和索引属性生效。



#### 2、对corrupted的触发场景，corrupted 状态在其他存活实例同步，以及corrupted后truncate 恢复的验证

1）、insert 回滚，不同节点 truncate后，恢复后导入/插入业务无影响，alter table logging成功

2）、集群任意节点宕机/重启后，表corrupted。truncate 后，恢复后导入/插入业务无影响，alter table logging成功

3）、corrupted 后拦截除了truncate/drop 外的其他操作。包括alter table logging/dml/ddl



#### 3、对异常场景和功能拦截场景验证

1）、存在物理备机/逻辑备机的情况下，创建nologging表拦截

2）、update、delete、online创建索引、临时表等其他场景



#### 4、以上复用单机用例的同时，新增在集群特有的场景，在不同节点的执行和同步验证。穿插视图  *gv$corrupted_table，*  dba_tables，dba_indexes，验证  *corrupted，*  nologging属性。

1）、索引的logging/nologging属性跟随表，指定索引logging属性无效，且dba_indexes视图LOGGING始终为logging



#### 5、对单机未覆盖的场景在集群加固



## 3.2 详细测试设计

以下插入，使用单条插入，insert into select批插和yasldr导入几种方式验证。

|测试场景|测试点|备注|
|---|---|---|
|状态同步|创建nologging表，所有实例查询表都是nologging，所有实例查询 instance id 是创建表的实例ID|带索引/不带索引都测|
||创建logging表，修改为nologging表，所有实例查询表都是nologging，所有实例查询 instance id 是修改表为nologging的实例ID|带索引/不带索引都测|
||创建logging表，分别在节点1，节点2 先后修改为nologging表，所有实例查询 instance id 是节点1的ID|带索引/不带索引都测|
||创建logging表,节点1修改为nologging，查询instance id 为节点1，,节点1 修改为logging，查询instance id 为空，,在节点1 修改为nologging。查询instance id 为节点2|带索引/不带索引都测|
|corrupted状态同步|在节点1 rollback，触发表corrupted，在节点1，节点2 查询视图均为corrupted，插入数据报错|带索引/不带索引都测|
||在节点1 重启，触发表corrupted为，在节点1，节点2 查询视图均为corrupted，插入数据报错|带索引/不带索引都测|
|ddl|truncate corrupted的表，所有实例表恢复为logging。--单机和集群都测，单机刷预期|带索引/不带索引都测|
||truncate nologging的表，但是未corrupted，表还是logging。--单机和集群都测||
|导入|实例1创建logging表，实例1 修改为nologging后，导入/插入/批插均正常，实例2报错|带索引/不带索引都测|
||实例1创建logging表，实例2 修改为nologging后，导入/插入/批插均正常，实例1报错|带索引/不带索引都测|
||实例1创建nologging表，在实例1 导入/插入/批插均正常，实例2报错||
|yasldr带参数|实例1创建logging表，实例1/实例2 yasldr带nologging参数导入/插入/批插均正常，导入后还是表还是logging||
||实例1创建nologging表，实例1 yasldr不带nologging参数导入/插入/批插均正常，导入后表还是nologging||
|并发|实例1创建nologging表插入未提交，实例1并发插入不报错||
||实例1创建nologging表插入未提交，实例2并发插入/导入报错，delete/update报错||
||实例1插入未提交，实例1，实例2新增 session  查询均报错。||
||实例1 多个yasldr 同时导入成功，数据准确。||
||实例1上导入过程中，实例2 重启，表corrupted。truncate重新导入成功||
||不同实例上导入 + 插入 + 批插 + 修改logging属性 并发，不看护结果。带kill db 重启故障||
||实例1上导入，实例2 故障||
|导入和修改logging 并发|实例1 nologging 导入过程中，实例2并发设置为logging /并发truncate表|？？|
|基础场景表类型覆盖|实例1创建logging表，实例1 nologging导入 ,一级分区 四种,二级分区 三种|带分区索引/不带分区索引|
|corrupted|corrupted 后，执行除truncate/drop 以外的 ddl，dql，dml。truncate会恢复|业务覆盖|
|触发corrupted，并truncate 验证恢复|1、insert 后回滚，corrupted，查询gv$corrupted_table。truncate后恢复,2、kill db1，corrupted，查询gv$corrupted_table。truncate后恢复,3、kill db1，拉起后，corrupted，查询gv$corrupted_table。truncate后恢复,4、kill db1、db2，拉起后，corrupted，查询gv$corrupted_table。truncate后恢复,5、重启 db1，拉起后，corrupted，查询gv$corrupted_table。truncate后恢复,6、重启 db1，db2，拉起后，corrupted，查询gv$corrupted_table。truncate后恢复,7、插入/导入数据数据，违反（唯一，not null，check，外键）约束（回滚），corrupted。truncate后恢复||
|新增字段了|单机升级，集群升级。|集群升级确认能不能升级|
||单机的v$dict_cache新增视图||
|拦截场景|存在物理备机/逻辑备机的情况下，创建nologging表拦截/修改为nologging拦截||
||update、delete 拦截报错||
||online创建/重建索引报错||
||临时表创建nologging表、修改为nologging拦截||
||只能在启动为nologging节点设置为logging||
|RTO性能|reform过程遍历nologging表的entry耗时可能影响RTO,--存在100张nologging的情况下，故障重启|--开发保证,RTO无明显劣化，有测试需要再投入|




    2. :DFX覆盖

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|  
不涉及|
|长稳|  
不涉及|
|一致性|  
不涉及|
|三方测试工具  
(sqltest，sqlancer)|不涉及  
|
|安全|  
不涉及|
|DFR|不涉及  
|
|HA|  
涉及|
|压力|  
不涉及|
|性能|不涉及  
|
|可维护性|  
不涉及|


  


# 4. 测试用例

  [集群支持nologging.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdkN2NlZDczOTgyM2YyYWMxZjI2YjQ0IiwicmVmX2lkIjoiNjdjNjUxN2Q1MjliNWMwMjMxY2MyZGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5NzEyLCJleHAiOjE3ODI1NDYxMTJ9.dg1sYTNozyhqdQidJbxPFP5JrebsHeM68p2vlxnqdks)  

# 5. 测试框架设计

- *yasft 满足功能测试，对于有kill 故障和主备的场景使用集群ha框架。*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *10人天*

- *调研+测试设计+评审 --2人天*
- *用例自动化+测试+上车--8人天*


计划测试完成时间：



参考:

1、单机nologging设计：  [Nologing优化 - YashanDB 文档 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=91774551)  

  [[YDBRD-6250] 【2022.2】HEAP支持nologging load - SICS-CoD Jira](https://jira.yasdb.com/browse/YDBRD-6250?jql=text%20~%20%22HEAP%E6%94%AF%E6%8C%81nologging%20load%22)  

2、单机梳理:  [https://pingcode.yasdb.com/wiki/pages/67c560e32d2effe8fb209f60](https://pingcode.yasdb.com/wiki/pages/67c560e32d2effe8fb209f60)  

1、单机nologging测试总结  [https://pingcode.yasdb.com/wiki/pages/6739bffb728206efb930d829](https://pingcode.yasdb.com/wiki/pages/6739bffb728206efb930d829)  

2、单机测试设计：  [nologging优化测试设计 - YashanDB - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=141570883)  