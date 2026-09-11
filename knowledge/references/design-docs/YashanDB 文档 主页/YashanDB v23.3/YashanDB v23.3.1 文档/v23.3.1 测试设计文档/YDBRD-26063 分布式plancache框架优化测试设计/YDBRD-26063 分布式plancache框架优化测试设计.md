Created by 罗爽, last modified on 五月 09, 2024

# 1. 概述

TP场景下存在大量planContext复用的情况，序列化已经成为性能瓶颈，需要进行planCache框架优化。

SR：    [https://pingcode.yasdb.com/pjm/items/66168fdcfd997db58ad70a47](https://pingcode.yasdb.com/pjm/items/66168fdcfd997db58ad70a47)    ?    
  #YDBRD-26063 分布式plancache框架优化

开发设计文档：    [分布式plancache框架优化](https://conf.yasdb.com/pages/viewpage.action?pageId=150606128)  

# 2. 需求分析

planCache新框架中，CN端会先判断当前sql是否已经执行过，如果执行过则复用已有的planCache。

1）CN去sqlCache中查找当前sql缓存是否存在；

2）查找到后发送精简的planKeyMsg给DN;

3）DN在本地节点缓存中查找sql缓存和计划缓存，没找到则返回错误码给CN需要重新解析；

4）DN上查到sql缓存和计划缓存则复用已有planCache。

## 2.1 功能点分析

1.可以被复用planCache的sql操作 

- dml：update/select/delete     
- 绑定参数（重点测试，覆盖不同的绑定类型）
- 匿名块


2.不能被复用planCache的sql操作和对象  - 本sr无关，不用测

- insert
- 动态视图
- ddl
- dcl


3.planCache在什么情况下失效 

     1）元数据变更：表的元数据发生变化 需要重新解析

     2）两条相同sql之间穿插了大量其他sql 导致planCache被淘汰

4.测试观察点

主要观察planCache是否被复用：dn节点查询v$sqlarea，当planCache被复用时对应sql的EXECUTIONS字段值+1

辅助观察：plancache复用时的sql执行时间比不复用的执行实际短                – 性能关注，功能不用

## 2.2 相关配置参数

sqlCache数量     -    sql_pool_size   控制

planCache个数   -  shared_pool_size / sql_pool_size 控制

# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略

## 3.2 详细测试设计

|场景1|场景2|用例|预期|备注|
|---|---|---|---|---|
|planCache复用|  
|cn上连续执行相同sql|复用dn上的plancache|  
|
|planCache不能复用|cn与dn的planCache内容不一致|cn元数据变更，会通知dn|cn重新解析|  
|
|  
|cn与dn的planCache内容不一致|cn的sql_pool_size小于dn的sql_pool_size，,cn的plancache被淘汰但dn上仍存在|cn重新解析|如何确认planCache是否存在？|
|  
|dn匹配anlContext失败|1.dn节点重启，缓存清空,2.dn的sql_pool_size小于cn的sql_pool_size,,cn的sql缓存存在但dn不存在,  
|返回错误码给cn,重新解析|怎么看sql缓存是否存在？|
|  
|dn匹配planContext失败|cn的sql_pool_size大于dn的sql_pool_size，,dn的plancache超过一定数量被删除|返回错误码给cn,重新解析|  
|
|  
|dn主备切换（switchover, failover）|dn备节点上没有sql和plan缓存|dn匹配anlContext失败，,返回错误码给cn,重新解析|  
|
|  
|cn重启|  
|  
|  
|
|  
|多CN|cn1执行后，其他cn再执行相同SQL|  
|  
|


元数据变更有以下几种：

1. 表变更

   - 表名             

   - comment

2.列变更

   - 列名             

   - 列字段类型

   - 列字段精度

   - 列默认值

   - 增删列

3.索引变更

   - add/drop index

4.分区表分区变更

  - add/drop/modify分区

## 3.2 DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是 ddl+dql|
|DFR|/|
|HA|是|
|KT kill测试|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|是 tpcc|
|长稳|/|


# 4. 测试用例

  


# 5. 测试框架设计

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|分布式1mn2cn2dn，dn为一主两备|


  


  


## Comments:

|  [](null)  ,会议纪要    
  时间：2024/04/26 11:00~12:00     
  1.insert操作不会复用plancache    
  2.重点测试绑定参数，覆盖不同的绑定类型    
  3.plancache复用时sql执行时间提升不太明显（微秒级别，且受网络波动影响）不好观察，性能测试关注即可，功能测试不用关注    
  4.补充测试cn重启，多cn场景    
  5.并发测试 ddl+dql并发    
  6.确认匿名块是否复用plancache - 吴煜    
  7.怎么看plancache和sqlcache是否存在？ - 吴煜,Posted by luoshuang at 四月 26, 2024 14:30|
|---|
