Created by 王仁松, last modified on 六月 25, 2024

概要设计-YDBRD-29014 Nestloop并行和下推到DN

IR链接：    [https://pingcode.yasdb.com/pjm/items/6667aa93288e1978209fecc1](https://pingcode.yasdb.com/pjm/items/6667aa93288e1978209fecc1)    ?    
  #YDBRD-29014 Nestloop并行和下推到DN

##  1. 总述

Nestloop并行和下推到DN  。

- 计划放开分布式下的nl并行执行，并下推到dn执行
- 列存需要对放开后的计划做相应的开发自测保证


### 1.1 需求来源

1、业务场景里面，一个聚集结果跟另外大表做nestloop， 查询条件没有等值条件

### 1.2 调研文档 _

_概述__ 友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。 _可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。_

### 1.3 需求分析

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。 __功能属性__，需要遵循等价类正交划分的原则，考虑完备的拆分成多个子功能，每个子功能可以单独转测和上线，达到主体功能支撑IR到SR的拆分目的。 __非功能质量属性的理论知识指导，斜体内容正式文档可删除__ _

（1）性能指系统的响应能力，即要经过多长时间才能对某个事件做出响应，或者某段时间内系统所能处理的事件个数。_ __例如执行表达式和算子类的特性需求，如果不选要给出充分理由。__ _

（2）可用性指系统能够正常运行的时间比例。经常用两次故障之间的时间长度或出现故障时系统恢复正常的速度来表示。_ __例如OM、YCS等节点管理的特性需求，如果不选要给出充分理由__ _

（3）可靠性是软件系统在应用或系统错误面前，维持软件系统的功能特性的基本能力。_ __例如主备、容灾、存储等的特性需求，如果不选要给出充分理由__ _

（4）可测试性指通过测试揭示软件缺陷的容易程度。_ __特性如果不易观察时，要考虑增加DFX视图或者增加告警等手段__ _

（5）安全性指系统在向合法用户提供服务的同时能够阻止非授权用户使用的企图或拒绝服务的能力。_ __例如协议、驱动、访问控制、通讯、加密等特性需求，如果不选要给出充分理由__ _

（6）易用性指关注对用户来说完成某个期望任务的容易程度和系统所提供的用户支持的种类。_ __如何提升用户体验__ _

（7）可修改性指能够快速地以较高的性价比对系统进行变更的能力。_ __后续追加特性的开发容易程度__ _

（8）兼容性指特性开发是否向前兼容，是否涉及升级。

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|----|
||子功能2|子功能2通过什么方案满足|是/否|是/否|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|----|
||性能场景2|----|是/否|是/否|----|
|可用性|恢复场景|----|是/否|是/否|----|
|可靠性|故障场景|----|是/否|是/否|----|
|可维可测|DFX功能1|----|是/否|是/否|----|
||DFX功能2|----|是/否|是/否|----|
|安全|安全场景1|----|是/否|是/否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|----|----|是/否|是/否|----|
|周边配合|权限|----|----|是/否|----|
|周边配合|审计|----|----|是/否|----|
|周边配合|导入导出工具|----|----|是/否|----|


  


  


### 1.4 数据字典

描述本篇文档中特性的术语集

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|nl|nest loop简称|是|业界资料链接|


### 1.5 开源依赖

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

## 2. 接口

__列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。__ IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

## 3. 规格与约束

- 单机并行
- 分布式并行


## 4. 特性

自测大体有三个点：

1. 开启并行
1. 下推到dn执行
1. nested loop场景覆盖


## 4.1 开启并行

|  `alter session set degree_of_parallel = 2;`  |
|:---|


## 4.2 下推到dn执行

需要自测中分析计划当中是否是nested loop下推到各个dn节点上执行，由cn合并。

## 4.3 nested loop场景覆盖

### 4.3.1 基本自测

首先是根据join的各种类型分为不同的情况：

- 交叉连接
- 内连接
- 左连接
- 右连接
- 左半连接
- 右半连接
- 反半连接


|  `select * from l_table, r_table;`      
    `select * from l_table, r_table where l_int > r_int;`      
    `select * from l_table join r_table on l_int > r_int;`      
    `select * from l_table left join r_table on l_int > r_int;`      
    `select * from l_table right join r_table on l_int > r_int;`      
    `select * from l_table where exists( select * from r_table where l_int > r_int);`      
    `select * from l_table where not exists( select * from r_table where l_int > r_int);`      
    `select * from l_table where l_int in ( select l_int from r_table);`      
    `select * from l_table where l_int not in ( select l_int from r_table);`  |
|:---|


### 4.3.2 复杂情况

由于设计到并行，并且场景是包含单机和分布式，但不管是哪种场景，都会涉及到分发策略，单机上会有local的分发，分布式会有remote的分发，对应都有不同的分发策略。

在测试数据并不复杂的情况下，采用不同的分发策略最终的结果可能是一致的，但是从原理上来说某些场景下执行某种分发策略会有本质上的逻辑错误。

1. 比如对于等值比较的情况，可以是重分发，将每个线程所需要的数据发送到具体的各个线程（相同key的数据必须分到同一个线程），也可以将一张表广播到每个线程。
1. 而对于非等值比较，比如<、>这种，nested loop做内连接时需要比较另外一张表的所有数据，因此其中一张表需要广播到所有线程，不然可能会漏数据。


举个例子：

|  `alter session set degree_of_parallel = 2;`      
    
    `drop table `      `if`         `exists test1;`      
    `create table test1(f1 `      `int`      `, f2 `      `int`      `) organization tac;`      
    `insert into test1 values(1, 2);`      
    `insert into test1 values(3, 4);`      
    `insert into test1 values(7, 8);`      
    
    `drop table `      `if`         `exists test2;`      
    `create table test2(f1 `      `int`      `, f2 `      `int`      `) organization tac;`      
    `insert into test2 values(1, 20);`      
    `insert into test2 values(3, 40);`      
    `insert into test2 values(6, 60);`      
    
    `select * from test1, test2 where test1.f1 < test2.f1;`      
    
    `-- 正确结果`      
    `SQL> select * from test1, test2 where test1.f1 < test2.f1;`      
    
    `          `      `F1           F2           F1           F2`      
    `------------ ------------ ------------ ------------`      
    `           `      `1            2            3           40`      
    `           `      `1            2            6           60`      
    `           `      `3            4            6           60`  |
|:---|


采用重分发，如果（1，2）和（3，40）、（6，60）被恰好分配到同一个线程，那么结果正确，如果不被分配到同一个线程，那么结果应该是错误的。因此需要确认计划中是否是正确的分发策略。

|join类型|预期计划|说明|
|:---|:---|:---|
|交叉连接|- 一个是Random分发，另一个是BroadCast分发
- 一个是hash分发，另一个是BroadCast分发
- 重点：必须有一个是BroadCast分发，不然会漏数据从原理上结果就不对
|select * from test1, test2;|
|内连接|- 一个是hash分发，另一个是hash分发
- 一个是Random分发，另一个是BroadCast分发
- 一个是hash分发，另一个是BroadCast分发
- 重点：如果两个都是hash分发，必须关注hash分区以及hash分发是否将同一批数据发送到同一个节点同一个线程
|explain /*+ USE_NL(test1) */ select * from test1, test2 where test1.f1 = test2.f1;|
|左连接|- 左表是random分发，右表是Broadcast分发
- 左表是hash分发，右表是Broadcast分发
- 重点：右表必须是Broadcast分发，不然会漏数据从原理上结果就不对
|select /*+ USE_NL(test1) */ * from test1 left join test2 on test1.f1 < test2.f1;|
|右连接|- 右表是random分发，左表是Broadcast分发
- 右表是hash分发，左表是Broadcast分发
- 重点：左表必须是Broadcast分发，不然会漏数据从原理上结果就不对
- 补充：可能左右表顺序呼唤，注意区分
|select /*+ USE_NL(test1) */ * from test1 right join test2 on test1.f1 < test2.f1;|
|左半连接|- 左表是random分发，右表是Broadcast分发
- 左表是hash分发，右表是Broadcast分发
- 重点：右表必须是Broadcast分发，不然会漏数据从原理上结果就不对
|select /*+ USE_NL(test1) */ * from test1 where exists(select * from test2 where test1.f1 < test2.f1);|
|右半连接|- 右表是random分发，左表是Broadcast分发
- 右表是hash分发，左表是Broadcast分发
- 重点：左表必须是Broadcast分发，不然会漏数据从原理上结果就不对
|select /*+ USE_NL(test1) */ * from test2 where exists(select * from test1 where test1.f1 < test2.f1);|
|反半连接|- 一个是random分发，另一个是Broadcast分发
- 一个是hash分发，另一个是Broadcast分发
- 重点：有一个必须是Broadcast分发，不然会漏数据从原理上结果就不对
- 补充：是半连接的语义的反
|select /*+ USE_NL(test1) */ * from test2 where not exists(select * from test1 where test1.f1 < test2.f1);|


  


|  
|类型|Join类型|复合场景|
|:---|:---|:---|:---|
|1|TINYINT|1. 交叉连接
1. 内连接
1. 左连接
1. 右连接
1. 左半连接
1. 右半连接
1. 反半连接
,  
,  
,  
,  
,  
,  
,  
,  
|1. 表中有null
1. 数值类型测试POW函数等
1. 字符型测试UPPER，LOWER等
,  
,  
|
|2|SMALLINT|||
|3|INT|||
|4|BIGINT|||
|5|FLOAT|||
|6|DOUBLE|||
|7|CHAR|||
|8|VARCHAR|||
|9|BOOLEAN|||
|10|DATE|||
|11|TIME|||
|12|TIMESTAMP|||
|13|INTERVALYM|||
|14|INTERVALDS|||
|15|RAW|||
|16|RAW|||
|17|左右表类型不同|||
|18|简单INT类型嵌套128层|||


~~而对于分布式环境下，还会有分布key和分区key不同的情况下也有分发策略的不同：~~

- ~~无Rmoete分发和本地分发~~    
  ~~probe分布key和builder表分布key相同，且分区key相同，且都是join key的子集，就可以没有remote分发和本地分发~~


- ~~无Remote分发，有本地分发~~
- ~~probe分布key和builder表分布key相同，是join key子集，但是分区key不相同，或者不是join key的子集，就可以没有remote分发，但是有本地分发~~
- ~~有Remote分发，无本地分发~~    
  ~~分布key不同，或者分布key不是join key的子集，分区key不同或者分区key不是join key的子集~~
- ~~有Remote分发，有本地分发~~    
  ~~此种场景不存在，一个px不会出现有remote hash 分发，又有local hash 分发~~


新版本下，分布式环境都是remote分发。

测试场景：1. 检查结果，2.查看计划是否正常下推到dn即可

|场景|
|:---|
|nl probe表和bulder表分布key一样，且是join key子集， 分区key一样且是join key子集|
|nl probe表和bulder表分布key一样，且是join key子集， 分区key不一样|
|nl probe表和bulder表分布key不一样， 分区key一样且是join key子集|
|nl probe表和bulder表分布key不一样， 分区key不一样|


以上均覆盖各个join类型。

### 4.3.3 提交构建

默认开启并行：

|  `NORMAL_SES_PARAM_DEF(PARAM_OPTMZ_DEGREE_OF_PARALLEL,    `      `"DEGREE_OF_PARALLEL"`      `,         `      `"2"`      `,        cbpmOptmzDOP, anlSetDegreeOfParallel, anlGetDegreeOfParallel),`  |
|:---|


将degree_of_parallel参数默认值改为2。

采用将hash join和merge join的路径代码注释掉，默认只跑nested loop。

在本地跑pytest，可以不管计划变更产生的错误，只关于原本的hash join等分布式并行用例的结果是否正确。

### 4.3.4 二层

1. 未注释hash join和merge join的路径源代码，跑二层分析
1. 注释hash join和merge join的路径，默认全走nl，跑二层分析


### 4.3.5 原测试用例分析

将现有的测试用例拉过来开启并行跑，同时分析结果。

用例：

单机：

1.   [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/execute_path/nl_ppd](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/execute_path/nl_ppd)  
1.   [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/test_Nestloop_full_join](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/dml3/test_Nestloop_full_join)  


分布式：

1.   [https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/DML6/join](https://git.yasdb.com/cod-test/yasft/-/tree/master/distribution/testcase/DML6/join)  


## 5.未来规划

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。