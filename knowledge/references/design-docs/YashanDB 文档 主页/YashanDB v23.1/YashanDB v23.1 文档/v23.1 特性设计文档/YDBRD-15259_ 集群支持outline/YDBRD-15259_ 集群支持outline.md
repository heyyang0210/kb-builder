Created by 王林, last modified on 十月 18, 2024

SR     [YDBRD-15259](https://jira.yasdb.com/browse/YDBRD-15259?src=confmacro)    -  outline的集群化改造  完成

#   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-overview%E6%A6%82%E8%BF%B0)  

      集群由多节点实例和共享数据存储组成，每个实例都有相同的对象entry和dc；在做create / drop 等产生或销毁entry内存操作以及alter等使dc失效的操作时，需要将该操作处理同步到其他实例上，使其他实例对该ddl操作的影响可见。

outline 在支持分布式时，分布式同事已增加了OL_OID#， OBJ_VERSION。本次新增outline 的 entry，在判断anlContext是否重用根据outline的entry是否失效来判断。

  


使用outline：

outline 操作包含：

create 操作：create outline, create or replace outline;

alter  操作： alter outline

drop 操作：drop outline

  


使用开关  use_stored_outlines 来控制是否使用outline, 使用时，会根据sql 及hashvalue 去ol$系统表中直接查找是否匹配上，在sqlpool中，缓存的sql信息会带category_name;

在create or replace outline,  alter outline 时，通过更新outline的entry的obj_version 来判断是否可以重用anlcontext；

在drop outline 时，判断entry是否有效来判断是否可以重用anlcontext;

  


#   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. 集群下某个实例执行create outline，alter outline, drop outline 其他实例能感知到ddl产生的影响
1. 支持多实例的outline ddl并发


|类型|集群化处理|接口|
|:---|:---|:---|
|create outline|广播 create outline , 各个实例上生成对应的entry；,根据user+category+sql 对sql缓存失效处理 （user为全部用户）|AXC_CB->axcBcstInvalidOutlnSql|
|alter outline|广播alter outline ，更新各个实例上对应entry的版本号；,若为alter outline change category 或 alter outline enable 则根据user+category+sql 对sql缓存失效处理 （user为全部用户）|AXC_CB->axcBcstInvalidOutlnSql|
|drop outline|广播drop outline, 将各个实例上对应entry设置为无效|axcBcstDropObject|


  


#   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-interfaces%E6%8E%A5%E5%8F%A3)  

主要是在ddl的二阶段提交中提供实例间广播同步内存信息的接口

## 3.1 函数接口

|接口|描述|
|:---|:---|
|AXC_CB->axcBcstInvalidOutlnSql|（1）若为creat outline,若create or replace 语句删除了原有的outline, 则将原有的outline的entry 释放掉；,根据新建outline，创建对应的entry,根据user+category+sql 对sql缓存失效处理 （user为全部用户）,（2）若为alter outline,则将outline 的entry->version 赋予新值 (新值为递增值),若为alter outline change category 或 alter outline enable 则根据user+category+sql 对sql缓存失效处理 （user为全部用户）|
|AXC_CB->axcBcstDropObject|各个实例上设置outLine entry为无效|
|axcBcstInvalidOutlnSql|广播create outline, alter outline消息函数|
|msgInvalidOutlineSql|各个实例接收create outline, alter outline消息的处理函数|


## 3.3 outline 使用的集群锁

|类型|描述|
|:---|:---|
|AXC_CB->axcLockRWLock|针对objectId加集群锁|
|tryUnlockGlsRwLock|针对objectId 释放集群锁|


  


#   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

支持单机支持的所有语法

  


#   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

## 5.1 Data Structures & Flow（数据结构与流程）

**结构体**

StAnlContext 原来只有category信息，新增outline名称信息

|(1) anlcontext 上outline信息    
  typedef     struct     StAnlContext {    
      ...    
      AnlOlCtgy                olCtgy;    
  } AnlContext;    
       
  其中,typedef struct StAnlOlCtgy {    
      CodUint8        type;    
      CodUint8        len;    
      CodChar         str[COD_NAME_BUFFER_SIZE];    
      CodChar         unused[2];    
      CodUint64       id;           --新增    
      CodUint32       version;  --新增    
  } AnlOlCtgy;,  
       
  (2) outline entry    使用   dcCreateEntry 创建,  
, (3) 新增entry类型  OBJECT_TYPE_OUTLINE,  
,(4) create outline, alter outline 广播消息使用的结构体 ,typedef struct StAxcRecOutlnSql {    
      CodBool         isCreate;    
      CodBool         invalidSql;    
      CodChar         reserved[6];    
      CodUint64       originalId;    
      CodUint64       objId;    
      CodChar         olName[COD_NAME_BUFFER_SIZE];    
  } AxcRecOutlnSql;|
|:---|


  


**函数**

新增函数 anlHasInvalidOutline 判断outline是否有效

（1）  AnlOlCtgy→type  ==  CATEGORY_TYPE_FALSE 为有效 

（2）AnlOlCtgy→id  ==  INVALID_OBJECT_ID 为有效 

（3）根据AnlOlCtgy→id 获取entry, 若entry为空则为无效， 或者 entry→version ！= AnlOlCtgy→version 则为无效

  


在判断anlContext 是否可以重用 以及 stmt是否可以重用都需要执行函数anlHasInvalidOutline。

  


## 5.2 方案实现

### 5.2.1 create outline

细分为create outline, create or replace outline

create outline 处理如下：

（1）exec阶段：根据outline 的objId, 加集群读写锁

（2）2 pharse commit:  广播   AXC_CB->  axc  BcstInvalidOutlnSql  ，在各个实例上生成对应的outline的entry， 以及进行sql失效处理

（3）释放读写锁

  


create or replace outline:

（1）exec阶段：根据outline 的objId, 加集群读写锁

（2）2 pharse commit:  广播   AXC_CB->  axcBcs  tInvalidOutlnSql  ，在各个实例上更新对应的outline的entry的版本号

（3）释放集群读写锁

### 5.2.2 alter outline

（1）exec阶段：根据outline 的objId, 加集群读写锁

（2）2 pharse commit:  广播 axcBcstAlterObject，在各个实例上更新对应的outline的entry

（3）释放集群读写锁

### 5.2.3 drop outline

（1）exec阶段：加集群锁，

（2）2 pharse commit:  广播 axcBcstDropObject，在各个实例上设置outline的entry为无效

（3）释放集群读写锁

  


### 5.2.4 create outline, alter outline 消息处理函数

函数 msgInvalidOutlineSql

（1）create outline

         判断 outln->originalId 是否为 INVALID_OBJECT_ID （表示create or replace 语句替换了原有的outline， 需要将原有outline的entry release掉） , 若是，将对应的entry release掉；

         对创建的outline 创建entry；

         根据user+category+sql 对sqlpool中缓存进行失效处理

（2）alter outline

          根据outln→objId, 获取entry, 更新entry→version.

         若为alter outline change category 或 alter outline enable 则根据user+category+sql 对sql缓存失效处理 （user为全部用户）

  


##   [6. ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)    测试用例

测试点说明：    
  outline 有：create outline, alter outline, drop outline，对应系统表sys.ol$, sys.ol$hints, sys.ol$nodes

对于集群支持outline，打开  outline 后（即设置use_stored_outline =xx）, 创建outline后判断各个实例是否可以正常使用outLine;

以及更改outline或者删除outline后，outline 的entry是否同步到各个实例上，是否可以正常判断使用anlcontext缓存

```
--- 集群用例设计1
-- 设计目的：node1 上 drop outline 后再create outline，查看node2上的sql执行计划是否没有使用老的sqlpool中的缓存
  
-- node1
drop table cluser_ol_tb1;
create table cluser_ol_tb1(id1 int, id2 int);
insert into cluser_ol_tb1 values(1,11);
create outline cluster_ol_up1 on select id1 from cluser_ol_tb1 where id1 = 1;
alter system set use_stored_outlines = true;
explain select id1 from cluser_ol_tb1 where id1 = 1;
-- node2
alter system set use_stored_outlines = true;
explain select id1 from cluser_ol_tb1 where id1 = 1;
  
--node1
create index i_cluser_ol_tb1_id1 on cluser_ol_tb1(id1);
  
-- node2
explain select id1 from cluser_ol_tb1 where id1 = 1;
  
--node1
drop outline cluster_ol_up1;
create outline cluster_ol_up1 on select id1 from cluser_ol_tb1 where id1 = 1;
explain select id1 from cluser_ol_tb1 where id1 = 1;
  
--node2
-- 有问题，应该走索引扫描
explain select id1 from cluser_ol_tb1 where id1 = 1;
  
--clean
alter system set use_stored_outlines = false;
drop outline cluster_ol_up1;
drop table cluser_ol_tb1;
  
  
-- 集群用例设计2
-- 设计目的：node1上 alter outline rebuild，则查看node2 上执行原有的sql是否没有使用sqlpool中的缓存
  
-- node1
drop table cluser_ol_tb2;
create table cluser_ol_tb2(id1 int, id2 int);
insert into cluser_ol_tb2 values(1,11);
create outline cluster_ol_up2 for category cluster_ol_ctgy2 on select id1 from cluser_ol_tb2 where id1 = 1;
alter system set use_stored_outlines = cluster_ol_ctgy2;
explain select id1 from cluser_ol_tb2 where id1 = 1;
  
-- node2
alter system set use_stored_outlines = cluster_ol_ctgy2;
explain select id1 from cluser_ol_tb2 where id1 = 1;
  
-- node1
create index i_cluser_ol_tb2_id1 on cluser_ol_tb2(id1);
explain select id1 from cluser_ol_tb2 where id1 = 1;
  
--node2
explain select id1 from cluser_ol_tb2 where id1 = 1;
  
--node1
alter outline cluster_ol_up2 rebuild;
explain select id1 from cluser_ol_tb2 where id1 = 1;
  
-- node2
-- 有问题，应该走索引扫描
explain select id1 from cluser_ol_tb2 where id1 = 1;
  
--clean
alter system set use_stored_outlines = false;
drop outline cluster_ol_up2;
drop table cluser_ol_tb2;
  
-- 集群用例设计3
-- 设计目的：node1上 alter outline change category，则查看node2 上执行原有的sql是否没有使用sqlpool中的缓存
  
--node1
drop table cluser_ol_tb3;
create table cluser_ol_tb3(id1 int, id2 int);
insert into cluser_ol_tb3 values(1,11);
create outline cluster_ol_up3_1 for category cluster_ol_ctgy3_1 on select id1 from cluser_ol_tb3 where id1 = 1;
create index i_cluser_ol_tb3_id1 on cluser_ol_tb3(id1);
create outline cluster_ol_up3_2 for category cluster_ol_ctgy3_2 on select id1 from cluser_ol_tb3 where id1 = 1;
alter system set use_stored_outlines = cluster_ol_ctgy3_1;
explain select id1 from cluser_ol_tb3 where id1 = 1;
  
--node2
alter system set use_stored_outlines = cluster_ol_ctgy3_1;
explain select id1 from cluser_ol_tb3 where id1 = 1;
  
--node1
drop outline cluster_ol_up3_1;
alter outline cluster_ol_up3_2 change category to cluster_ol_ctgy3_1;
explain select id1 from cluser_ol_tb3 where id1 = 1;
  
--node2
-- 有问题，应该走索引扫描
explain select id1 from cluser_ol_tb3 where id1 = 1;
  
--clean
alter system set use_stored_outlines = false;
drop outline cluster_ol_up3_2;
drop table cluser_ol_tb3;
  
  
-- 集群测试用例4
-- 测试 alter outline enable, disable 时sql 在sqlpool中invalid
--node1
drop table cluser_ol_tb4;
create table cluser_ol_tb4(id1 int, id2 int);
insert into cluser_ol_tb4 values(1,11);
create outline cluster_ol_up4_1 for category cluster_ol_ctgy4_1 on select id1 from cluser_ol_tb4 where id1 = 1;
create index i_cluser_ol_tb4_id1 on cluser_ol_tb4(id1);
create outline cluster_ol_up4_2 for category cluster_ol_ctgy4_2 on select id1 from cluser_ol_tb4 where id1 = 1;
alter system set use_stored_outlines = cluster_ol_ctgy4_2;
explain select id1 from cluser_ol_tb4 where id1 = 1;
  
--node2
alter system set use_stored_outlines = cluster_ol_ctgy4_2;
explain select id1 from cluser_ol_tb4 where id1 = 1;
select id1 from cluser_ol_tb4 where id1 = 1;
  
--node1
alter outline cluster_ol_up4_2 disable;
  
--node2
--检测在 stmt reuse时 是否会重用anlContext (加日志才可以看出来)
select id1 from cluser_ol_tb4 where id1 = 1;
  
explain select id1 from cluser_ol_tb4 where id1 = 1;
select id1 from cluser_ol_tb4 where id1 = 1;
  
--node1
alter outline cluster_ol_up4_2 enable;
  
--node2
--检测在 stmt reuse时 是否会重用anlContext (加日志才可以看出来)
select id1 from cluser_ol_tb4 where id1 = 1;
  
explain select id1 from cluser_ol_tb4 where id1 = 1;
select id1 from cluser_ol_tb4 where id1 = 1;
  
--clean
alter system set use_stored_outlines = false;
drop table cluser_ol_tb4;
drop outline cluster_ol_up4_1;
drop outline cluster_ol_up4_2;
  
  
  
  
-- 集群测试用例5
-- 测试 alter outline rename时sql 在sqlpool中invalid
--node1
drop table cluser_ol_tb5;
create table cluser_ol_tb5(id1 int, id2 int);
insert into cluser_ol_tb5 values(1,11);
create outline cluster_ol_up5_1 for category cluster_ol_ctgy5_1 on select id1 from cluser_ol_tb5 where id1 = 1;
alter system set use_stored_outlines = cluster_ol_ctgy5_1;
explain select id1 from cluser_ol_tb5 where id1 = 1;
  
--node2
alter system set use_stored_outlines = cluster_ol_ctgy5_1;
explain select id1 from cluser_ol_tb5 where id1 = 1;
select id1 from cluser_ol_tb5 where id1 = 1;
  
--node1
alter outline cluster_ol_up5_1 rename to cluster_ol_up5_1_2;
  
--node2
explain select id1 from cluser_ol_tb5 where id1 = 1;
select id1 from cluser_ol_tb5 where id1 = 1;
  
--clean
alter system set use_stored_outlines = false;
drop table cluser_ol_tb5;
drop outline cluster_ol_up5_1_2;
```

  


## 7    [. Document（资料）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-document%E8%B5%84%E6%96%99)  

  


## 8    [. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


## 9    [. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#9-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


  


## 10 参考

  
