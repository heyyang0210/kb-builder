Created by 孟凡彬, last modified on 六月 16, 2023

  


#   [集群支持synonym方案设计](#集群支持synonym方案设计)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-14779](https://jira.yasdb.com/browse/YDBRD-14779)  

##   [1. Overview（概述）](#1-overview概述)  

主备下已经对同义词做了支持，需要在共享集群形态下，对同义词的功能做集群化设计，使得集群各个节点可以透明的使用同义词能力。

单机下同义词的特点：

- 同一个namespace下表、视图、存储过程、序列、表、同义词不能重名。
- 非public同义词，其作用只是起个对象别名。
- public同义词，不止是对象别名，还可以做到屏蔽跨用户访问。
- 同义词为懒加载机制，第一次有效访问时建立同义词与对象的关系。


##   [2. Features（功能特性）](#2-features功能特性)  

同义词对外提供的功能如下：

|功能场景|场景说明|集群化功能|
|---|---|---|
|create synonym|创建同义词|一个实例创建同义词，其他实例可以使用此同义词。|
|drop synonym|删除同义词|一个实例删除同义词，其他实例使用同义词报错。|
|create or replace synonym|替换同义词|一个实例替换了同义词，其他实例可以使用替换后的同义词。|
|use synonym|使用同义词|多个实例使用同一同义词，功能是一致的。|


##   [3. Interfaces（接口）](#3-interfaces接口)  

单机提供的同义词语法，集群保持一致。

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

不涉及

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 创建同义词](#51-创建同义词)  

创建同义词事务提交时，通过DDL广播机制，将同义词信息广播到其他实例，创建对应的entry。此处类似table entry同步机制，区别在于对象类型为同义词。

###   [5.2 删除同义词](#52-删除同义词)  

删除同义词事务提交时，通过DDL广播机制，将同义词信息广播到其他实例，删除对应的entry。此处类似table entry同步机制，区别在于对象类型为同义词。

###   [5.3 替换同义词](#53-替换同义词)  

同义词的替换流程是结合创建和删除来进行的：

1. 先做当前同义词的检测，如果不能存在则创建；
1. 如果存在则做一定的类型依赖检查，再进行删除；
1. 删除时如果已经不存在，则进行创建；
1. 再将当前新的同义词对象信息写入到系统表。


集群下广播替换同义词，只需要将dc上synclink设置为NULL即可，后续通过懒加载获取到最新的同义词信息。

###   [5.4 并发控制](#54-并发控制)  

|并发场景|单机策略|集群策略|
|---|---|---|
|create/create|两层并发策略，通过user entry的方法控制与通过object名空间下名字唯一性的并发控制。|只采用object名空间下名字唯一性进行并发控制。|
|create/drop|通过object名空间下名字唯一性的并发控制。|通过object名空间下名字唯一性的并发控制。|
|create/replace|通过本地DC与object名空间下名字唯一性并发控制。存在极低概率已存在。|create先在一个实例上执行，然后replace在另外一个实例上并发执行，通过系统表并发控制。存在极低概率已存在。|
|drop/drop|通过object名空间下名字唯一性的并发控制。|通过object名空间下名字唯一性的并发控制。|
|drop/replace|与create/replace类似|drop先在一个实例上执行，然后replace在另外一个实例上并发执行，通过系统表并发控制。|
|replace/replace|与create/replace类似|与create/replace类似|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 以表同义词为例进行基础的功能场景与并发场景测试。
1. 测试视图、存储过程、自定义函数、序列同义词在集群下的基本功能。
