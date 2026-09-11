# 1. 概述

SR：  [https://pingcode.yasdb.com/pjm/items/670727abe489dd0868f31e47?](https://pingcode.yasdb.com/pjm/items/670727abe489dd0868f31e47?)  

#YDBRD-33670 stage增加按需启动的调度方式

开发设计：  [https://pingcode.yasdb.com/wiki/pages/675b895aa03b82348608d9f1](https://pingcode.yasdb.com/wiki/pages/675b895aa03b82348608d9f1)  

交付形态：分布式 

交付表类型：列表

# 2. 需求分析

当前Stage按照步长划分为多个StageGroup，每个StageGroup执行时会把所有Stage全部启动，但是部分Stage可能依赖后面其它Stage，先启动会造成资源浪费，特别是资源紧张情况下，影响较大。另外划分StageGroup时未考虑把runtime filter的使用者和生成者放到一个Stage Group，因此会禁用跨了Stage Group的runtime filter。因此本特性进行优化，按照火山模型调度Stage。

## 2.1 功能点分析

（1）按照火山模型驱动Stage执行

        单个StageGroup场景，按照火山模型选出一个Stage第一个执行，无需驱动。

        多StageGroup场景下，MatSend所在的Stage，其依赖的第一个stage就是第一个需要执行的Stage。

        所有的stage 都要找到第一个依赖的Stage，当Stage没有依赖的Stage（不包含子查询Stage）时，其依赖的Stage就是自己。不需要驱动执行的Stage如下：

- CN上RootStage： 不占用并行线程
- 第一个依赖的Stage：
- MatSend 依赖的第一个stage：此种stage是孤立的Stage，其所依赖stage是第一个要启动的stage


标识为不需要驱动执行的Stage，初始后就可以运行，其他所有的Stage按照下面的规则驱动执行

- Px Sender发送数据前，需要驱动接收端所在的Stage执行。
- PxReceiver执行时，需要驱动下层Stage所依赖的第一个Stage启动
- PxReceiver还没有执行就退出时，需要驱动下层的Stage启动


增加如下的通知机制

- PxReceiver首次执行，需要通知其依赖的第一个Stage启动
- PxReceiver结束之后如果其之前没有驱动过其依赖的第一个Stage启动，需要通知其child Stage启动
- Px Sender发送数据之前，需要驱动接收者启动


减少消息发送的机制

- 触发Stage启动时，如果发现收到对方的触发消息，就不再通知对方
- 触发stage启动时，优先驱动本节点对应的stage启动


（2）增加隐藏参数控制是否需要按需启动Stage

         _SCHEDULE_STAGE_THRESHOLD 参数范围[2,1000]， 默认：4

用于控制触发Stage调度的最小stage数量，当stage达到或者超过此值就会触发stage调度。

（3）Stage实例和线程解除绑定 

（4）Runtime filter改造 

Runtime filter的发送超时不需要报错（原来发送超时会报错）,TableScan使用全局Runtimer filter时，不需要死等，Stage启动后，Runtime filter等待时间变成最多等待100毫秒,等待不到所有的runtime filter继续执行。

（5）增加视图GV$PX_STAGE

|参数名称|内容|
|---|---|
|GROUP_ID||
|GROUP_NODE_ID||
|INST_ID||
|SQL_ID||
|STAGE_ID||
|STAGE_STATUS|init，ready，running，finished|
|是否需要驱动执行||
|stage依赖的第一个stage||
|stage启动时间||


## 2.2 应用场景

（1）查询。

（2）runtime filter。

## 2.3 规格约束

（1）当前不考虑减少预申请的线程数。

（2）只支持列执行，对行存无影响。

（3)  多stage Group不支持。

（4）Delete 和Update 不支持。

# 3. 详细测试设计

## 3.1 测试设计方法

场景法验证

## 3.2 详细测试设计

隐藏参数配置按需启动stage

|测试场景|测试项|测试项描述|说明|
|---|---|---|---|
|单StageGroup场景|单表查询|单个StageGroup，查询视图GV$PX_STAGE|单StageGroup，触发stage调度|
||多表关联查询(2，8，16，128)|多表连接查询，查询视图GV$PX_STAGE|select * from GV$px_stage order by 1,2,3;|
||SELECT subquery FROM |投影列小于128子查询||
|||投影列128子查询||
||SEELCT FROM subquery|谓词列带子查询||
|||小于128表嵌套查询||
|||128表嵌套查询||
||SEELCT subquery FROM subquery|投影和谓词列带子查询||
||修改MAX_WORKERS_PER_EXEC=2，8，32，128|设置步长不同，再次查询上述sql|查询正常|
||修改_SCHEDULE_STAGE_THRESHOLD=2,4,16,128,1000|设置不同触发阈值，再次查询上述sql||
|多StageGroup场景|执行上面SQL|通过设置MAX_WORKERS_PER_EXEC步长分为多StageGroup|多StageGroup不触发|
|UPDATE|update table 条件中带子查询|update table set column=(subquery)|不触发stage调度|
|||update table set column=(subquery)  where 条件带子查询|不触发stage调度|
|DELETE|delete table 条件中带子查询|delete table where带条件子查询|不触发stage调度|
|CTE|单表cte查询|子查询包含嵌套||
||多表cte查询|子查询包含多表嵌套||
|create table as select |select 不带子查询|查询视图GV$PX_STAGE|若是单StageGroup触发Stage调度|
||select带子查询|查询视图GV$PX_STAGE|若是单StageGroup触发Stage调度|
|insert into select |select 不带子查询|查询视图GV$PX_STAGE|若是单StageGroup触发Stage调度|
||select带子查询|查询视图GV$PX_STAGE|若是单StageGroup触发Stage调度|
|runtime filter|join查询|分布表join分布表|BLOOM_FILTER_FACTOR=1|
|||分布表join复制表|BLOOM_FILTER_FACTOR=1|
|视图|分布式GV$PX_STAGE/V$PX_STAGE|带子查询多StageGroup，查询视图GV$PX_STAGE||
|||MN/CN/DN节点执行V$PX_STAGE|无异常，CN上rootStage启动无依赖|
|||部分节点故障CN执行GV$PX_STAGE|剔除故障节点|
||单机部署执行GV$PX_STAGE/V$PX_STAGE|查询背景下执行视图查询|查询结果为空|
||共享集群GV$PX_STAGE/V$PX_STAGE|查询背景下执行视图查询|查询结果为空|
|隐藏参数_SCHEDULE_STAGE_THRESHOLD|配置项验证|边界值验证[2,1000]||
||生效方式|立即生效||
||生效节点|CN配置生效，DN和MN配置无效,alter system set _SCHEDULE_STAGE_THRESHOLD=4 type=cn;,alter system set _SCHEDULE_STAGE_THRESHOLD=4 type=dn;,alter system set _SCHEDULE_STAGE_THRESHOLD=4 type=mn;,alter system set _SCHEDULE_STAGE_THRESHOLD=4 type=all;,alter system set _SCHEDULE_STAGE_THRESHOLD=4 node=2-*;,alter system set _SCHEDULE_STAGE_THRESHOLD=4 scope=memory|both|spfile;,alter session set _SCHEDULE_STAGE_THRESHOLD=x;||
|CI|二层CI|二层CI未引入新问题||
|性能|TPCH|性能不下降||
||TPCDS|性能不下降|资源紧张场景下，性能提升|


||||
|---|---|---|
|系统级DFX分类|是否涉及|测试点|
|CT|﻿|﻿|
|KT|﻿|﻿|
|长稳|﻿|﻿|
|一致性|||
|三方测试工具  
(sqltest，sqlancer)|﻿|﻿|
|安全|﻿|﻿|
|DFR|||
|HA|﻿|﻿|
|压力|﻿是|﻿观测无异常|
|性能|是|观测性能不能下降|
|可维护性|﻿|﻿|


﻿

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

|服务器| 192.168.6.153/155|
|:---|:---|
|操作系统|Linux|
|部署|分布式|


# 7. 工作量评估

工作量：10人天

计划测试完成时间：2025.1.15