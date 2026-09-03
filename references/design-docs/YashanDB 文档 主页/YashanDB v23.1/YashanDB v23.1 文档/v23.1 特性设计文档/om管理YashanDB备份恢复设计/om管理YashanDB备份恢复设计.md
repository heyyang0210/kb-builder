Created by 朱松平, last modified on 六月 30, 2023

#   [om管理YashanDB备份恢复设计(单机)](#om管理yashandb备份恢复设计单机)  

SR链接：

1、    [https://jira.yasdb.com/browse/YDBRD-13303](https://jira.yasdb.com/browse/YDBRD-13303)  

2、    [https://jira.yasdb.com/browse/YDBRD-13304](https://jira.yasdb.com/browse/YDBRD-13304)  

3、    [https://jira.yasdb.com/browse/YDBRD-13305](https://jira.yasdb.com/browse/YDBRD-13305)  

##   [1. Overview（概述）](#1-overview概述)  

说明本设计方案的需求来源，需求分析，功能概要描述。参照已有商业数据库开发的特性，原则上必须有特性调研文档。

为了提升数据库的易用性，    `OM`    需要管理YashanDB的备份恢复能力。

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持单机
    - 所有备份和恢复操作调用工具    `yasrman`    完成
- 备份策略
    - 生成备份策略配置文件
        - 支持配置并行度、分块大小、压缩算法、加密算法参数
        - 支持最大保存天数和数量
        - 支持按月/周/天/时备份
        - 支持全量、普通增量和累计增量备份
    - 新增、删除、展示、应用、取消应用备份策略
- 其他备份操作
    - 创建备份
    - 删除备份
    - 恢复备份
    - 查询备份列表


##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

**yasboot新增命令行接口**

- 备份策略命令
- 其他备份命令


|命令|说明|
|---|---|
|backup strategy config gen|生成备份策略配置文件|
|backup strategy add|新增备份策略|
|backup strategy apply|应用备份策略|
|backup strategy cancel|取消应用备份策略|
|backup strategy delete|删除备份策略|
|backup strategy list|展示备份策略列表|
|backup strategy show|展示备份策略执行信息|


|命令|说明|
|---|---|
|backup create|创建备份|
|backup delete|删除备份|
|backup restore|恢复备份|
|backup list|查询备份列表|
|backup get|获取备份集的详细信息|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

1、备份策略

- 应用对象
    - 单机的节点 ：备份单个节点 (主节点或者备节点)
- 策略类型：
    -   `PERIOD`    ：周期性策略，可执行多次
    -   `TIMING`    ：定时备份策略，执行一次
    -   `IMMEDIATE`    ：立即备份策略，执行一次
- 限制
    -   `PERIOD`    、    `TIMING`    类型的策略最多同时被一个节点应用一次
    -   `IMMEDIATE`    类型的策略可以被应用多次
    -   `PERIOD`    类型策略下发的备份任务的最小间隔时间为1小时
    - 最大保存天数和最大保存数量只支持     `PERIOD`    类型策略和    `FULL`    类型备份


2、数据库备份与恢复

- 备份和恢复操作全部使用工具    `yasrman`    完成
- 限制
    - 备份
        - 数据库必须是    `open`    状态，且为归档模式
        - 最多执行1000次连续的    `LEVEL 1`    增量备份
        - 只支持在节点主机存贮备份文件
    - 恢复
        - 数据库必须是    `nomount`    状态，且旧的数据文件全部删除
    - 增量备份恢复必须保证增量备份集完整，否则恢复失败
    - yasrman
        - 对于同一个数据库最多同时执行一个备份或者恢复命令
        - 并行度取值范围    `[1,8]`  
        - 若指定备份地址，该备份文件夹必须不存在


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

![](attachments/100106090/100106103.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E6%9E%B6%E6%9E%84%E5%9B%BE.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

整体的架构如上图，主要新增部分如下：

- 在yasboot中新增    `backup`    命令，用于下发备份恢复的指令
- 在yasom中，新增    `cron`    模块，用于调度定时任务
    - 基于备份策略，    `cron`    模块周期性的下发    `备份任务`    到    `task`    模块


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考 **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** ）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考 **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** ）。用于支撑测试方案的灰盒测试。**

###   [5.2.1 整体流程](#521-整体流程)  

主要交互流程如下：

![](attachments/100106090/100106101.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E6%80%BB%E4%BD%93%E6%B5%81%E7%A8%8B.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

####   [](#5211-cron模块设计)  

  `cron`    是用于管理定时任务的模块。根据    `cronExpression`    ，在固定的时间或者时间间隔，周期性或者定时的触发相同任务。要实现的功能如下：

- 初始化    `cron`    任务集(yasom启动时)
- 添加/移除    `cron`    任务
- 异步执行    `cron`    任务


#####   [](#52111-初始化备份cron任务)  

![](attachments/100106090/100106102.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E5%88%9D%E5%A7%8B%E5%8C%96Cron.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

#####   [](#52112-cron任务接口)  

```
type Croner interface {
    GenCronExpression() string   // 生成cron任务的 cron expression
    FuncJob() func()             // 生成cron任务的job执行函数
}

```

####   [5.2.1.2  应用备份策略流程](#5212--应用备份策略流程)  

备份策略是否被应用的判断逻辑（    `IMMEDIATE`    类型策略没有该限制）：

分布式：若已被集群应用，则无法被再次应用

单机：若被节点应用，则无法被相同节点或者其它节点应用

![](attachments/100106090/100106100.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E5%BA%94%E7%94%A8%E7%AD%96%E7%95%A5.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

####   [5.2.1.3  删除备份策略流程](#5213--删除备份策略流程)  

在备份策略已经被应用的情况下：

- 若非强制删除，则删除失败
- 若强制删除，则先删除所有的应用记录，以及产生的备份cron任务，在删除备份策略


![](attachments/100106090/100106097.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E5%88%A0%E9%99%A4%E5%A4%87%E4%BB%BD%E7%AD%96%E7%95%A5.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

####   [5.2.1.4 数据库备份流程](#5214-数据库备份流程)  

有以下两种情况触发数据库备份流程：

- 备份cron任务定时触发
- 立即触发


单节点备份：yasrman直接连接该节点，只备份该节点数据

分布式集群备份：yasrman连接cn节点，对集群中的所有主节点数据库备份

![](attachments/100106090/100106098.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E6%95%B0%E6%8D%AE%E5%BA%93%E5%A4%87%E4%BB%BD%E6%B5%81%E7%A8%8B.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

####   [5.2.1.5 恢复数据库备份流程](#5215-恢复数据库备份流程)  

恢复备份的前置操作，通过    `yasboot clean -c cName --restore --force`    命令完成，完成的操作如下：

- 关闭集群所有节点
- 删除    `archive`    、    `data`    、    `dbfiles`    和    `local_fs`    中所有文件
- 以    `nomount`    方式驱动所有节点


分布式集群备份恢复：    `yasrman`    会restore所有主节点数据，接着recover、open所有主节点，并完成所有备节点重建

单节点备份恢复：    `yasrman`    会restore单节点数据，接着recover、open该节点数据库，但需要手动重建备节点

![](attachments/100106090/100106099.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E6%95%B0%E6%8D%AE%E5%BA%93%E6%81%A2%E5%A4%8D%E6%B5%81%E7%A8%8B.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

####   [5.2.1.6 备份删除流程](#5216-备份删除流程)  

删除增量备份，有可能破坏增量备份集的连续性，导致恢复同组其它增量备份失败。

方案一：校验其连续性吗？若不破坏连续性，需要强制才能删除？

连续性校验比较麻烦？不好记录用户不通过    `yasboot`    进行的备份操作

方案二：或者直接警告，将后果直接告知用户，不进行校验？，同样需要强制才能删除

####   [5.2.1.7 最大保存天数/数量实现流程](#5217-最大保存天数数量实现流程)  

只在    `period`    类型，    `全量备份`    的策略中有效。

通过定时    `cron`    任务下发，周期为每天    `00:00`    执行一次

![](attachments/100106090/104204860.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

![](picture/%E6%9C%80%E5%A4%A7%E4%BF%9D%E5%AD%98%E5%A4%A9%E6%95%B0&%E6%95%B0%E9%87%8F%E6%B5%81%E7%A8%8B.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNTgsImV4cCI6MTc4MjIyMjk1OH0.TL9f1zEJvRfhsMrnNAhHkpiHaZdw1j8REycvGLilNp0)

###   [5.2.2 备份命令行接口详细设计](#522-备份命令行接口详细设计)  

####   [5.2.2.1  生成备份策略配置文件](#5221--生成备份策略配置文件)  

**子命令**  ：    `backup strategy config gen`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name, -s**  ：策略名称，必填项
- **--strategy-type, -t**  ：策略类型，默认为    `PERIOD`    ，可选值(不区分大小写)有：
    -   `PERIOD`    ：周期性策略，可执行多次
    -   `TIMING`    ：定时备份策略，执行一次
    -   `IMMEDIATE`    ：立即备份策略，执行一次
- **--backup-type，-bt**  ：备份类型，默认为    `FULL`    ，可选值(不区分大小写)有：
    -   `FULL`    ：全量备份
    -   `INCREMENTAL`    ：普通增量备份
    -   `CUMULATIVE`    ：累计增量备份
- **--section-size, -ss**  ：文件分片的大小，范围    `[128M，32T]`    ，默认为系统自动计算的最优值
- **--compression, -cm**  ：压缩算法和压缩级别(使用冒号分割，不区分大小写)，默认为    `ZSTD:LOW`  
    - 压缩算法：    `ZSTD`    、    `LZ4`  
    - 压缩级别：    `HIGH`    、    `MEDIUM`    、    `LOW`  
- **--encryption，-e**  ：加密算法和密码(使用冒号分割，加密算法不区分大小写)。eg:     `AES128:password_123`  
    - 加密算法：    `AES128`    、    `AES192`    、    `AES256`    、    `SM4`  
- **--parallelism，-p**  ：并行度，选填项，默认为2，取值范围    `[1,8]`  
- **--cron-expression，-ce**  ：    `cron`    表达式 (设置了该参数，下面三个参数失效)
    - 格式：    `* * * * *`    ，分别表示：    `分钟、小时、天、月、周`  
- **--frequency，-f**  ：备份频率，默认为    `weekly`    ，可选值如下：
    -   `monthly`    ：每月
    -   `weekly`    ：每周，默认值
    -   `daily`    ：每天
    -   `hourly`    ：每小时
- **--days，-d**  ：具体某天，表示每月或者每周的第几天，可填写多天 。 eg:     `1,5,6,7`    和    `1，5-7`    都表示第1、5、6和7天；
    - 只有在    `monthly`    、    `weekly`    才参数有效
    - 当频率为    `monthly`    ，取值范围为    `1~31`    ，默认值为    `1-5`  
    - 当频率为    `weekly`    ，取值范围为    `1-7`    ，表示星期一到星期天，默认值为    `1-5`  
- **--start-time，-st**  ：策略开始时间
    - 当频率为    `monthly`    、    `weekly`    和    `daily`    ，格式为    `**:**`    ，表示小时和分钟；默认为    `00:00`  
    - 当频率为    `hourly`    ，格式为    `**`    ，表示分钟；默认为    `00`  
- **--store-path，sp**  ：备份文件存贮地址，选填项
    - 若指定，必须是绝对路径
    - 默认保存在    `$YASDB_HOME/om/${CLUSTER_NAME}/catalog/backup`  
-  **-store-days，sd**  ：最大保存天数，选填项，默认保存所有    - 仅在全量备份    `FULL`    、策略为    `PERIOD`    下有效
- **--store-num，sn**  ：最大备份数量，选填项，默认保存所有
    - 仅在全量备份    `FULL`    、策略为    `PERIOD`    下有效
- **--config-path**  ：配置文件输出地址，默认为    `当前地址`  


备份策略配置文件：    `test01-backupStrategy.toml`  

```
cluster = "tp"
strategy_name = "test01"
strategy_type = "PERIOD"

[backup_config]
  backup_type = "FULL"
  section_size = "128M"
  parallelism = 2
  compression_algorithm = "ZSTD"
  Compress_level = "HIGH"
  encryption_algorithm = "SM4"
  encryption_password = "123"

[time_config]
  # cron_expression = "10 12 1,6,7 ? *"
  frequency = "weekly"                 // 每周进行备份 
  days = [1,6,7]                       // 每周的星期一、星期六和星期天备份
  Start_time = "12:10"                 // 每天12:10开始备份

[store_config]
  store_path = "/opt/yasom/backup"     // 备份存贮地址，数据库节点所在主机本地存贮
  store_days = 12                      // 备份最大保存天数
  store_num = 10                       // 最大备份保存数量

```

####   [5.2.2.2  新增备份策略](#5222--新增备份策略)  

**子命令**  ：    `backup strategy add`  

**参数**  ：

- **--toml，-t**  ：备份策略配置文件，必填项


备注：解析toml配置文件中的备份策略，并将其存贮到om(sqlite3)中

####   [5.2.2.3 应用备份策略](#5223-应用备份策略)  

**子命令**  ：    `backup strategy apply`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：策略名称，必填项
- **--node-id，-n**  ：节点id
    - 单机：必填项
    - 分布式：该参数无效，分布式备份整个集群


####   [5.2.2.4 取消应用备份策略](#5224-取消应用备份策略)  

**子命令**  ：    `backup strategy cancel`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：策略名称，必填项
- **--node-id，-n**  ：节点id
    - 单机：必填项
    - 分布式：该参数无效，分布式备份整个集群


####   [5.2.2.5 删除备份策略](#5225-删除备份策略)  

**子命令**  ：    `backup strategy delete`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：策略名称，必填项
- **--force，-f**  ：强制删除，选填项，默认为    `false`  
    - 若策略已经被应用，需要强制或者取消应用后才能删除


####   [5.2.2.6 分页展示备份策略](#5226-分页展示备份策略)  

**子命令**  ：    `backup strategy list`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--node-id，-n**  ：备份策略应用的节点ID  ，选填项
- **--detail，-d**  ：详细信息，选填项
- **--size**  ：一页数据量，默认值为10
- **--page，-p**  ：当前分页，默认值为1
- **--sort，S**  ：排序字段，默认为    `created_at`  
- **--order，-o**  ：排序，默认为    `dasc`    ，可选值有：    `dasc`    和    `asc`  
- **--search**  ：通过列搜索；格式为    `rowName:searchValue`  
    - 支持的搜索列有：    `strategy_name`    ,    `strategy_type`    ,     `backup_type`    ,     `cron_expression`  


```
# 单机
$ ./bin/yasboot yasboot backup strategy    list -c tp
 strategy_name | strategy_type | backup_type | cron_expression | apply
--------------------------------------------------------------------------------
 store         | PERIOD        | FULL        | 0/2 * * * ?     | node: 1-1
---------------+---------------+-------------+-----------------+----------------
 timing        | TIMING        | FULL        | 0/1 * * * ?     | node: 1-1
---------------+---------------+-------------+-----------------+----------------
 cumulative    | PERIOD        | CUMULATIVE  | 1/2 * * * ?     | -
---------------+---------------+-------------+-----------------+----------------
 immediate     | IMMEDIATE     | FULL        | -               | node: 1-1, 1-2
---------------+---------------+-------------+-----------------+----------------
 incremental   | PERIOD        | INCREMENTAL | 0/2 * * * ?     | -
---------------+---------------+-------------+-----------------+----------------
 period        | PERIOD        | FULL        | 0/2 * * * ?     | -
---------------+---------------+-------------+-----------------+----------------


$ ./bin/yasboot backup strategy    list -c tp  -d
 strategy_name | strategy_type | backup_type | cron_expression | apply          | parallelism | compression | encryption | store_days  | store_num | store_path
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 store         | PERIOD        | FULL        | 0/2 * * * ?     | node: 1-1      | 2           | ZSTD:HIGH   | -          | -           | -         | /home/peter/backup/test
---------------+---------------+-------------+-----------------+----------------+-------------+-------------+------------+-------------+-----------+-------------------------
 timing        | TIMING        | FULL        | 0/1 * * * ?     | node: 1-1      | 2           | ZSTD:HIGH   | -          | -           | -         | -
---------------+---------------+-------------+-----------------+----------------+-------------+-------------+------------+-------------+-----------+-------------------------
 cumulative    | PERIOD        | CUMULATIVE  | 1/2 * * * ?     | -              | 2           | ZSTD:HIGH   | -          | -           | -         | -
---------------+---------------+-------------+-----------------+----------------+-------------+-------------+------------+-------------+-----------+-------------------------
 immediate     | IMMEDIATE     | FULL        | -               | node: 1-1, 1-2 | 2           | ZSTD:HIGH   | -          | -           | -         | -
---------------+---------------+-------------+-----------------+----------------+-------------+-------------+------------+-------------+-----------+-------------------------
 incremental   | PERIOD        | INCREMENTAL | 0/2 * * * ?     | -              | 2           | ZSTD:HIGH   | -          | -           | -         | -
---------------+---------------+-------------+-----------------+----------------+-------------+-------------+------------+-------------+-----------+-------------------------
 period        | PERIOD        | FULL        | 0/2 * * * ?     | -              | 2           | ZSTD:HIGH   | -          | -           | -         | -
---------------+---------------+-------------+-----------------+----------------+-------------+-------------+------------+-------------+-----------+-------------------------



```

####   [5.2.2.7 展示备份策略的执行信息](#5227-展示备份策略的执行信息)  

**子命令**  ：    `backup strategy show`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--strategy-name，-s**  ：策略的名称，必填项
- **--node-id，-n**  ：节点名称，选填项
- **--detail，-d**  ：详细信息，选填项
- **--size**  ：一页数据量，默认值为10
- **--page，-p**  ：当前分页，默认值为1


```
$ ./bin/yasboot backup strategy show -c tp -s  store
 uuid             | tag                | backup_type | node_id | status
------------------------------------------------------------------------
 95551c5846830e46 | bak_20230419163600 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 058623e2eadb8c3a | bak_20230419163400 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 ad0a95bf493041f4 | bak_20230419163200 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 8557fd87a87aabb8 | bak_20230419163000 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 59765cf0ccb234f4 | bak_20230419162800 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 28d9d7d2c8ef7717 | bak_20230419162600 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 cf81eddcf2b97c9c | bak_20230419162400 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------

$ ./bin/yasboot backup strategy show -c tp -s  store -d
 uuid             | tag                | backup_type | node_id | status | start_time          | completion_time     | hostid   | backup_path
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 95551c5846830e46 | bak_20230419163600 | FULL        | 1-1     | finish | 2023-04-19 16:36:00 | 2023-04-19 16:36:02 | host0001 | /home/peter/backup/test/bak_20230419163600
------------------+--------------------+-------------+---------+--------+---------------------+---------------------+----------+--------------------------------------------
 058623e2eadb8c3a | bak_20230419163400 | FULL        | 1-1     | finish | 2023-04-19 16:34:00 | 2023-04-19 16:34:02 | host0001 | /home/peter/backup/test/bak_20230419163400
------------------+--------------------+-------------+---------+--------+---------------------+---------------------+----------+--------------------------------------------
 ad0a95bf493041f4 | bak_20230419163200 | FULL        | 1-1     | finish | 2023-04-19 16:32:00 | 2023-04-19 16:32:01 | host0001 | /home/peter/backup/test/bak_20230419163200
------------------+--------------------+-------------+---------+--------+---------------------+---------------------+----------+--------------------------------------------
 8557fd87a87aabb8 | bak_20230419163000 | FULL        | 1-1     | finish | 2023-04-19 16:30:00 | 2023-04-19 16:30:02 | host0001 | /home/peter/backup/test/bak_20230419163000
------------------+--------------------+-------------+---------+--------+---------------------+---------------------+----------+--------------------------------------------
 59765cf0ccb234f4 | bak_20230419162800 | FULL        | 1-1     | finish | 2023-04-19 16:28:00 | 2023-04-19 16:28:01 | host0001 | /home/peter/backup/test/bak_20230419162800
------------------+--------------------+-------------+---------+--------+---------------------+---------------------+----------+--------------------------------------------
 28d9d7d2c8ef7717 | bak_20230419162600 | FULL        | 1-1     | finish | 2023-04-19 16:26:00 | 2023-04-19 16:26:12 | host0001 | /home/peter/backup/test/bak_20230419162600
------------------+--------------------+-------------+---------+--------+---------------------+---------------------+----------+--------------------------------------------
 cf81eddcf2b97c9c | bak_20230419162400 | FULL        | 1-1     | finish | 2023-04-19 16:24:00 | 2023-04-19 16:24:17 | host0001 | /home/peter/backup/test/bak_20230419162400
------------------+--------------------+-------------+---------+--------+---------------------+---------------------+----------+--------------------------------------------

```

####   [5.2.2.8 创建备份](#5228-创建备份)  

**子命令**  ：    `backup create`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--node-id，-n**  ：节点id
    - 单机：必填项
    - 分布式：该参数无效，分布式备份整个集群
- **--backup-type，-bt**  ：备份类型，默认为    `FULL`    ，选填项，可选值(不区分大小写)有：
    -   `FULL`    ：全量备份
    -   `INCREMENTAL`    ：增量备份
    -   `CUMULATIVE`    ：累计增量备份
- **--backup-base**  ：当备份类型是    `INCREMENTAL`    、    `CUMULATIVE`    时，是否执行level 0的基准备份
- **--section-size，-ss**  ：文件分片的大小，范围    `[128M，32T]`    ，可选参数，默认为系统自动计算的最优值
- **--compression，-cm**  ：压缩算法和压缩级别(使用冒号分割，不区分大小写)，默认为    `ZSTD:LOW`  
    - 压缩算法：    `ZSTD`    、    `LZ4`  
    - 压缩级别：    `HIGH`    、    `MEDIUM`    、    `LOW`  
- **--encryption，-e**  ：加密算法和密码(使用冒号分割)，默认不加密
    - 加密算法：    `AES128`    、    `AES192`    、    `AES256`    、    `SM4`  
- **--parallelism，-p**  ：并行度，默认为2，选填项，取值范围    `[1,8]`  
- **--store-path，-sp**  ：存贮地址，选填项


####   [5.2.2.9  删除备份](#5229--删除备份)  

**子命令**  ：    `backup delete`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--uuid，-u**  ：备份集的UUID，必填项
- **--force，-f**  ：是否强制删除，默认为false，选填项


####   [5.2.2.10 展示备份列表](#52210-展示备份列表)  

**子命令**  ：    `backup list`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--detail，-d**  ：详细信息，选填项
- **--node-id，-n**  ：节点id，选填项，若为空则查询所有的节点，分布式没有该列
- **--size，-s**  ：一页数据量，默认值为10
- **--page，-p**  ：当前分页，默认值为1
- **--sort，S**  ：排序字段，默认为    `created_at`  
- **--order，-o**  ：排序，默认为    `dasc`    ，可选值有：    `dasc`    和    `asc`  
- **--search**  ：通过列搜索；格式为    `rowName:searchValue`  
    - 支持的搜索列有：    `uuid`    ，    `tag`    ，    `backup_type`    ，     `status`    ，    `hostid`    ，     `strategy_name`  


```
$ ./bin/yasboot backup list -c tp

 uuid             | tag                | backup_type | node_id | status
------------------------------------------------------------------------
 95551c5846830e46 | bak_20230419163600 | FULL        | 1-1     | failed
------------------+--------------------+-------------+---------+--------
 058623e2eadb8c3a | bak_20230419163400 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 ad0a95bf493041f4 | bak_20230419163200 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------
 8557fd87a87aabb8 | bak_20230419163000 | FULL        | 1-1     | finish
------------------+--------------------+-------------+---------+--------

$ ./bin/yasboot backup list -c tp -d
 uuid             | tag                | backup_type | node_id | status | strategy_name | start_time          | completion_time     | hostid   | backup_path
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
 87865c0929a0dc6a | bak_20230425114049 | FULL        | 1-2     | finish | -             | 2023-04-25 11:40:49 | 2023-04-25 11:40:54 | host0002 | /home/peter/tp01/yashandb/23.1.0.0/om/tp01/catalog/backup/bak_20230425114049
------------------+--------------------+-------------+---------+--------+---------------+---------------------+---------------------+----------+------------------------------------------------------------------------------
 e890e02cefca3a34 | bak_20230425114028 | FULL        | 1-3     | finish | -             | 2023-04-25 11:40:28 | 2023-04-25 11:40:33 | host0002 | /home/peter/tp01/yashandb/23.1.0.0/om/tp01/catalog/backup/bak_20230425114028
------------------+--------------------+-------------+---------+--------+---------------+---------------------+---------------------+----------+------------------------------------------------------------------------------
 560d76a0ec525a70 | bak_20230425112731 | FULL        | 1-1     | finish | -             | 2023-04-25 11:27:31 | 2023-04-25 11:27:35 | host0001 | /home/peter/tp01/yashandb/23.1.0.0/om/tp01/catalog/backup/bak_20230425112731
------------------+--------------------+-------------+---------+--------+---------------+---------------------+---------------------+----------+------------------------------------------------------------------------------
 c5b49461eb6eb319 | bak_20230425112721 | FULL        | 1-1     | finish | -             | 2023-04-25 11:27:21 | 2023-04-25 11:27:23 | host0001 | /home/peter/tp01/yashandb/23.1.0.0/om/tp01/catalog/backup/bak_20230425112721
------------------+--------------------+-------------+---------+--------+---------------+---------------------+---------------------+----------+------------------------------------------------------------------------------


```

####   [5.2.2.11 展示备份详细信息](#52211-展示备份详细信息)  

**子命令**  ：    `backup get`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--uuid，-u**  ：备份集的UUID，必填项


```
$ ./bin/yasboot backup get -c tp -u 95551c5846830e46
{
   "uuid": "1e0dc5a504e291ec",
   "tag": "bak_20230419172800_store",
   "nodeId": "1-1",
   "status": "failed",
   "startTime": "2023-04-19 17:28:00",
   "comletionTime": "2023-04-19 17:28:01",
   "backupType": "FULL",
   "incrementLevel": "",
   "hostid": "host001",
   "backupPath": "",
   "compressLevel": "HIGH",
   "strategyName": "store",
   "failedReason": "backup node failed%!(EXTRA string=[Node 0]YAS-02570 yasrman has been started by another process",
   "id": 0,
   "createdAt": "",
   "updatedAt": ""
 }

```

####   [5.2.2.12 恢复备份](#52212-恢复备份)  

**子命令**  ：    `backup restore`  

**参数**  ：

- **--cluster，-c**  ：集群名称，必填项
- **--uuid，-u**  ：备份集uuid，必填项
- **--node-id，-n**  ：恢复的节点，选填项，默认为备份时的节点
- **--parallelism，-p**  ：并行度，默认为2，选填项，取值范围    `[1,8]`  
- **--sys-password，-sp**  ：sys用户密码，必填参数，可以通过命令行交互式填写 (恢复备份属于高危操作，需要密码确认)
- **--decryption-password，-dp**  ：备份文件解密密码，也就是备份加密密码


###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；

2.执行表达式和算子类的特性需求，需要考虑性能；

3.主备、容灾、存储等的特性需求，需要考虑可靠性；

4.所有特性均需要考虑可维、可测。

###   [5.5 其他](#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

###   [5.6 参考资料](#56-参考资料)  

1、cron表达式：    [https://zhuanlan.zhihu.com/p/437328366](https://zhuanlan.zhihu.com/p/437328366)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

1. 运维手册-备份恢复下新建“OM备份恢复”目录，内容为使用yasboot工具进行备份恢复的介绍、要求和步骤，参考同级其他工具
1. 工具手册-yasboot-yasboot命令介绍下增加备份恢复命令选项介绍


##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*