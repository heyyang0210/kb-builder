Created by 秦湫婷 on 七月 19, 2024

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af67](https://pingcode.yasdb.com/ship/ideas/660b743e009f91eb87f2af67)    *?*    
  *#YASHAN-23 集群子查询支持gv视图*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6611516f579a3edb84d66fd1](https://pingcode.yasdb.com/pjm/items/6611516f579a3edb84d66fd1)    *?*    
  *#YDBRD-18732 集群跨节点执行支持gv视图出现在子查询中*

##   [1. 总述](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#1-overview%E6%A6%82%E8%BF%B0)  

集群子查询需要支持gv视图。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求描述：    
  集群子查询需要支持gv视图。

场 景：    
  当前集群子查询不支持gv视图，在子查询场景受限，需要补齐此能力。

需求范围：

共享集群

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

无

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|集群子查询支持gv视图|基于分布式可支持的子查询范围，放开该范围下的带gv视图的子查询。|是|是|
|性能|性能场景1|----|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|gv$视图出现在子查询中|可在各场景下观察到gv$视图出现在子查询中|是|是|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

所有可支持子查询的语句：

|语句|语法|本需求是否支持|
|---|---|---|
|select|  [SELECT | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html)  |是|
|insert|  [INSERT | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/INSERT.html)  |是|
|update|  [UPDATE | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/UPDATE.html)  |是|
|delete|  [DELETE | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/DELETE.html)  |是|
|explain |  [EXPLAIN | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/EXPLAIN.html)  |是|
|create table as |  [CREATE TABLE AS | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE%20AS.html)  |是|
|create view|  [CREATE VIEW | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20VIEW.html)  |是|
|create outline|  [CREATE OUTLINE | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20OUTLINE.html)  |否，目前view子语句没法做hint映射；保持现状|
|merge|  [MERGE | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/MERGE.html)  |否，分布式不支持|
|存储过程|  [存储过程 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/PL%E5%AF%B9%E8%B1%A1/%E5%AD%98%E5%82%A8%E8%BF%87%E7%A8%8B.html)  |是|
|匿名块|  [匿名块 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/PL%E5%AF%B9%E8%B1%A1/%E5%8C%BF%E5%90%8D%E5%9D%97.html)  |是|
|函数|  [自定义函数 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/PL%E5%AF%B9%E8%B1%A1/%E8%87%AA%E5%AE%9A%E4%B9%89%E5%87%BD%E6%95%B0.html)  |是|
|游标|  [游标 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/PL%E8%AF%AD%E8%A8%80%E5%9F%BA%E7%A1%80/%E5%8F%98%E9%87%8F/%E6%B8%B8%E6%A0%87.html)  |否|


  


##   [3. 规格与约束](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#3-interfaces%E6%8E%A5%E5%8F%A3)  

1.merge、create outline语句先不放开带gv的子查询。

2.dblink相关dml操作，对于gv子查询的放开程度需要讨论。  ==>基于目前现状，放开dblink的select、insert带gv子查询。

3.游标跨节点的操作需要讨论是否支持，分布式不支持游标是因为不支持多stmt切换，那么  集群下跨节点操作的游标是否也需要拦截？==>需要

##   [4. 特性](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

###   [4.1 各场景放开记录（主要）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#51-architecture%E6%9E%B6%E6%9E%84)  

|语句|场景|用例|遇到问题|解决方案|
|---|---|---|---|---|
|insert     
    
|insert into select gv|insert into t1(a,b) select instance_number,instance_number from gv$instance;|问题：在execInsert阶段，会获取insertPlan对bulkLoadTable校验，在获取该计划时，对于PLAN_DSTB_COORD类型的计划，会先判断stmt->planContext->plan->dstbCoord.child->type == PLAN_INSERT，否则assert，集群的dataNode在这一步会assert掉。,原因：这个判断对于分布式节点是适用的，但对于集群，连接节点只是将子查询那部分的计划下发给了dataNode去执行，PLAN_DSTB_COORD的child并不是PLAN_INSERT。|此处集群或者集群的dataNode不做该判断。|
||insert 远端表 select gv|CREATE DATABASE LINK dblink_yashan3 CONNECT TO Sys identified by Cod-2022 using '192.168.18.194:1688';,insert into t1@dblink_yashan3 select instance_number,instance_number from gv$instance;|问题：core在execInsertCursor,原因：目前仅单机、集群支持dblink，支持select、insert带子查询，分布式正在实现dblink，但暂不放开dml操作。该用例失败原因和create table as类似，都认为计划一定是一个insertPlan，直接开始执行plan->insert，但实际该用例是一个coord计划。|dblink对于带gv子查询的放开程度需要讨论|
||存储过程内的insert into select gv带绑定参数|INSERT INTO SYS.WRH$_MEM_USED_COMP(snap_id, dbid, group_id, group_node_id, instance_number, component_id, used_size)    
  SELECT :snap_id, d.database_id, 1, i.instance_number, 0, oc.pmem_used_size    
  FROM gv$database d, gv$instance i    
  JOIN (    
  SELECT inst_id, sum(pmem_used_size) AS pmem_used_size    
  FROM gv$open_cursor    
  GROUP BY inst_id    
  ) AS oc    
  ON oc.inst_id= i.instance_number    
  WHERE d.inst_id = i.inst_id,  
|问题：语句在genLogiInsertDesc生成根算子信息时，iniCboOpt阶段会initCostKernelAttr，在EXEC_MODE_COORD模式下需要获取dn组的数量。对于分布式适用，但对于集群，在首次进入genLogiInsertDesc时模式为EXEC_MODE_STANDALONE，没问题，但若需要重新生成计划，在首次生成计划的createPlanFromOpTree的最后模式已经设置为EXEC_MODE_COORD，那么再次进入genLogiInsertDesc，执行获取dn组数量时将出错。,原因：doExecExecuteImmediateLn阶段虽然已经对语句进行解析并生成计划，但在soExecDynSql执行加载计划时，会判断stmt->planContext->checkItems.execParams和stmt->attr->checkItems.execParams的param的type是否一致，结果不一致然后再重新生成计划。这是因为这两的param分别来自stmt->context->parseTree->params和stmt->paramGroups，plan0的类型是verify阶段确定的，在verify中有一些 rededuce的函数接口，由这个确定绑定参数位置，大概率是什么类型，然后在绑定参数实际传入的时候，也就是执行阶段的时候，判断下两者是不是不同，不同则重新推导个新的计划出来， 新的就是 plan1 一直到planN了。而在verify推导的时候，绑定参数给的类型一直为0 ，因此执行时会重新生成计划。|1.initCboOpt阶段做initCostKernelAttr的执行模式的判断时，加上集群的判断，即满足EXEC_MODE_COORD和非集群执行，才获取dn组数量。,2.createPlanFromOpTree最后不管是否创建PLAN_DSTB_COORD计划，都不将集群的执行模式设置为EXEC_MODE_COORD。实践证明，该问题会px执行上会引发很多问题，不推荐。|
||||问题：语句执行失败，偶现在回滚失败时core掉。,原因：语句中涉及gv视图时，createPlanFromOpTree的最后模式会设置为EXEC_MODE_COORD，那么在doPreExecute时会先做anlInitExecFunc，此时事务会被设置为coord事务，回滚也将为coord回滚，在回滚失败的处理上集群该场景将出问题。|anlInitExecFunc时对于集群下即使是EXEC_MODE_COORD，也设置为单机的ExecFunc。|
|update|update where带gv子查询|UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|同insert需要考虑linkTable的场景|  
|
|delete|deleter where带gv子查询|DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|同insert需要考虑linkTable的场景|  
|
|select     
  （子查询包括非关联子查询与关联子查询，体现为与父查询是否关联）    
    
    
    
    
|where条件带gv子查询|非关联子查询：select * from gv$instance where INSTANCE_NUMBER=(select INSTANCE_NUMBER from gv$instance where DATA_HOME='/dev/shm/data/ce-1-2');,关联子查询：select * from t1 where t1.a=(select INSTANCE_NUMBER from gv$instance i where i.instance_number = t1.b and t1.b = 1);|可支持|  
|
||标量子查询在投影列,  
|非关联子查询：select a8,c8,e8,abs(c8),c8+1,c8-2,e8*0.3, to_char(e8),(select sum(used_size) from gv$global_mpool) q8 from tb_YDBRD_14145_UINQUE_INDEX_heap_03_2 where a8>=50 and c8 <>2;     
  select pmem_used_size / (select inst_id from gv$instance order by 1 limit 1) from gv$open_cursor;,关联子查询：select g.used_size, (select max(value) from gv$sysstat s where s.value > g.used_size) from gv$global_mpool g;|可支持|  
|
||from (gv关联子查询)带where exists|SELECT instance_number    
  FROM (    
  SELECT i.instance_number as instance_number    
  FROM gv$instance i,gv$database d    
  WHERE i.inst_id = d.inst_id    
  ) AS di    
  WHERE EXISTS(select 1 from WRM$_DATABASE_INSTANCE WDI where WDI.instance_number = di.instance_number) ;|问题：报错：  column map error。,原因：dn的view这一层往下找selext投影的时候没有映射上，也是dn上的select column与cn上trsfmat替换后的没有对应上，因为cn在copyPlans后select上的ds和plancontext上面的ds指向不同，导致trsf阶段修改后两者的ds内容不一致。|AnlCopyAssist加上  ObjectArray  *     dataSets  ;,ds只在算子计划复制时复制一遍到  AnlCopyAssist.  dataSets，之后plancontext的ds从AnlCopyAssist.dataSets中获取。,分布式行表分支已修改。    [feat YDBRD-18281 分布式行表DML（DQL）支持（mr之一） (!34342) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/34342/diffs)  |
||join (gv子查询带group by)|SELECT 1, d.database_id, 1, i.instance_number, 0, oc.pmem_used_size    
  FROM gv$database d, gv$instance i    
  JOIN (    
  SELECT inst_id, sum(pmem_used_size) AS pmem_used_size    
  FROM gv$open_cursor    
  GROUP BY inst_id    
  ) AS oc    
  ON oc.inst_id= i.instance_number    
  WHERE d.inst_id = i.inst_id;|问题：查询结果和实际预期不对，缺失数据；并且查询计划下可发现join filter等价类多拓展出了个filter。,原因：这个补丁合进去的谓词上拉的需求，会根据join条件的一侧生成一个join列=投影列的条件，如果投影列为常量这个filter就会被挂进算子里，这里userEnv被认为是个静态常量函数，导致挂进了filter上，但是实际上分布式或者集群下userEnv的执行结果在不同节点不一致，不能认为是静态常量。|将userEnv定义为全局唯一函数。,主干已修改。    [YDBRD-29471-fix: optmz code (sdt group/distinct topN, dynamic const) (!35506) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/35506/diffs)  |
||where exists带gv子查询|非关联子查询：select * from gv$instance i where exists(SELECT * from gv$FIXED_TABLE f) order by 1 limit 5; =>有问题,  
,关联子查询：select * from gv$instance i where exists(SELECT * from gv$FIXED_TABLE f where f.inst_id = i.inst_id) order by 1 limit 5; =>没问题|问题：查询结果和实际预期不对，缺失数据。,原因：右表物化curcor提前释放，并且下面算子是px，px目前没有重新执行的能力（对端无法感知到需要重新执行并且发放数据），导致数据缺失。|当前分布式下的物化计划必须提供rescan的能力，具体表现为close物化计划时不关闭物化cursor，而在释放执行资源的地方统一释放。,分布式行表分支已修改。    [feat YDBRD-18281 分布式行表DML（DQL）支持（mr之一） (!34135) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/34135)  |
||聚合函数having条件带子查询|select /*+parallel(stu,5)*/max(used_size) from gv$global_mpool stu group by inst_id having max(used_size) > any (select max(pmem_used_size) from gv$open_cursor mark group by inst_id having max(pmem_used_size) > 45000);,select /*+parallel(stu,5)*/max(used_size) from gv$global_mpool stu group by inst_id having max(used_size) > any (select max(value) from gv$sysstat stu group by inst_id having max(value) > 8100000);|可支持|  
|
||with as gv|with A(a,b) as(select instance_number,instance_number from gv$instance i,gv$database d where i.inst_id = d.inst_id) select t2.a,t2.b from t2,A where A.a = t2.a;|可支持|  
|
||gv关联查询where条件 = 常量|select * from gv$instance i, gv$database d where i.inst_id = d.inst_id and i.inst_id = 1;|问题：查询结果丢了filter，得到的是全量数据。,原因：  转joinGraph阶段把带谓词的result删除，把谓词放在edges上，最后pickEdgesFilter2Scan时，当前op为viewScan时，由于viewScan上没有谓词，导致删除edge时没有把该edge上的谓词combine到任何op上，导致丢了谓词|调整了pickEdgeFilter2Scan的逻辑，限制了集群下的谓词下推，直接在viewScan层上面拉出result挂上filter。,主干已修改。    [fix YDBRD-30022: fix cluster filter (!35604) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/35604)  |
||linkTable和gv join查询|select * from t1@dblink_yashan3,gv$instance;|问题：core在序列化，主干问题,原因：dblink表在ankGetColumnBitmapBytes获取的dc在gDblinkTableDict，columns是null，因此core了，具体原因还需分析。|主干问题，暂未修改，需要仔细分析。已提单,  [https://pingcode.yasdb.com/pjm/items/668c9426288e197820b8c13d](https://pingcode.yasdb.com/pjm/items/668c9426288e197820b8c13d)    ?    
  #YDBRD-30153 【开发自提】集群下，dblink远端表和gv视图做join，dblink远端表未做序列化反序列化适配,dblink对于带gv子查询的放开程度需要讨论。|
|create table as|create table as select gv|create table t1(a,b)as select STATISTIC#,VALUE from gv$sysstat;    
  create table t4(a,b,c)as select instance_number,STATISTIC#,VALUE from gv$instance i,gv$sysstat s where i.inst_id = s.inst_id;|问题：会在createTableCreatePlan的trsfMatPlan阶段core掉。,原因：当前集群create table as生成计划主要是生成子查询的计划并挂在def下，并且默认子查询的计划一定是个insertPlan，重点缺少了transformPlan阶段来生成satge树；并且在execCreateTable时，在执行了ddl后未提交前，拿生成的dc对子查询直接执行def->insertPlan。对于子查询是PLAN_DSTB_COORD的场景需适配。|1.生成计划时增加transformPlan阶段，并把生成的计划放在cboOpt->context->plan,2.execCreateTable在执行完ddl后，通过anlExecutePlan执行stmt->planContext→plan。,具体流程见4.2|
|create view as|create view as select gv|CREATE VIEW v_area2 AS SELECT * FROM gv$instance;|可支持|  
|
|create outline|create outline on select gv|create outline o on select * from gv$instance;|问题：报错：YAS-04440 invalid sql statement,原因：涉及view这块的执行计划都无法做 hint映射|本需求无法支持create outline？|


###   [4.2 create table as支持子查询跨节点](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

当前create table as流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396dbb8970c2af4f5214e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExOTYsImV4cCI6MTc4MjMyMTk5Nn0.Xp5oymJ6wdbdzFoAuzkmnLDGfpQTHi4OaVxT0iHgmKw)

create table as selete gv流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396dbb8970c2af4f5214e1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTExOTYsImV4cCI6MTc4MjMyMTk5Nn0.Xp5oymJ6wdbdzFoAuzkmnLDGfpQTHi4OaVxT0iHgmKw)

注意：

1.create table as selete gv对于计划的执行通过anlExecutePlan，在执行到execInsertPlan时的dc需通过打开ddl注册时临时保存在的stmt->handler->khdlr->ddlInfo->objEntry->dc。

##   [5. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

*设计开发人员自测用例（文字描述）。*

|测试场景|预期|备注|
|---|---|---|
|select 各场景带gv子查询|数据符合预期|  
|
|insert into select gv|数据符合预期|  
|
|update where带gv子查询|数据符合预期|  
|
|delete where带gv子查询|数据符合预期|  
|
|create table as select gv|数据符合预期|  
|
|create view as select gv|数据符合预期|  
|


##   [6. 资料设计章节](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#7-document%E8%B5%84%E6%96%99)  

上述语句对于gv视图作为子查询的约束检查并放开。

##   [7. 未来规划](http://cod-conf.sics.com/pages/viewpage.action?pageId=72797254#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

1.分布式视图框架也放开gv视图。

## Attachments:

[image2024-7-4_20-8-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmI4OTcwYzJhZjRmNTIxNGRlIiwicmVmX2lkIjoiNjczOTZkYmI3MjgyMDZlZmI5MmYyMmI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTk2LCJleHAiOjE3ODIzOTc1OTZ9.BsvS1Zf8tJ-NLZ60irHSRJYs55q485dTP3MpRjAQds0)

 (image/png)    


[image2024-4-23_11-11-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYmI4OTcwYzJhZjRmNTIxNGRmIiwicmVmX2lkIjoiNjczOTZkYmI3MjgyMDZlZmI5MmYyMmI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzExMTk2LCJleHAiOjE3ODIzOTc1OTZ9.R8iP2aQeIFGrfAiutDyaGAKxWkxBRr4vYA6vSK-P_rs)

 (image/png)    
