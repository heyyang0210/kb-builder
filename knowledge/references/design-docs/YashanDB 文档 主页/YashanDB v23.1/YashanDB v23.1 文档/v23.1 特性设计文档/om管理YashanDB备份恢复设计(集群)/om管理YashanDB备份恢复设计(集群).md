Created by 朱松平, last modified on 七月 14, 2023

#   [om管理YashanDB备份恢复设计(集群)](#om管理yashandb备份恢复设计集群)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-13230](https://jira.yasdb.com/browse/YDBRD-13230)  

##   [1. Overview（概述）](#1-overview概述)  

说明本设计方案的需求来源，需求分析，功能概要描述。参照已有商业数据库开发的特性，原则上必须有特性调研文档。

  `OM`    已经支持了单机和分布式的部署形态的备份与恢复，现在需要支持集群的部署形态。

##   [2. Features（功能特性）](#2-features功能特性)  

- 支持集群部署形态
    - 所有备份和恢复命令，通过驱动执行sql完成 (与单机、分布式不同，是通过yasrman)
- 备份策略 (和单机、分布式的相同)
    - 生成备份策略配置文件
        - 支持配置并行度、分块大小、压缩算法、加密算法参数
        - 支持最大保存天数和数量
        - 支持按月/周/天/时备份
        - 支持全量、普通增量和累计增量备份
    - 新增、删除、展示、应用、取消应用备份策略
- 其他备份操作(和单机、分布式的相同)
    - 创建备份
    - 删除备份
    - 恢复备份
    - 查询备份列表


##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

**yasboot不新增命令行接口，和单机、分布式基本保持一致**

详情参考：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107391712](https://conf.yasdb.com/pages/viewpage.action?pageId=107391712)  

**不同点**

  `backup restore`    命令    `--node-id`    参数无效，默认通过备份的实例恢复

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

**备份**

- 默认的备份路径为各自节点    `$YASDB_DATA/backup`    目录下
- 执行备份操作前必须打开归档，集群环境打开归档必须保证当前节点为mount状态，且其他节点处于nomount状态。
- 集群多节点下，同一时间只能由一个节点执行备份操作，且备份期间如果有节点宕机，则备份会中断。
- 执行备份期间无法执行表空间等文件增删操作。
- 增量备份的多个备份集可采用不同的压缩算法。如果集群多个节点采用分机部署，请使用同一节点执行增量备份。
- 增量备份的多个备份集必须采用一致的加密策略（都加密或都不加密，都加密时密码相同），但可以采用不同的加密算法。
- 备份并行度只能在    `[1-8]`    范围内选择。
- 超过1000次连续LEVEL 1增量备份。
- 第一次增量备份必须为LEVEL 0备份
- 集群环境下，数据库暂不支持删除备份集操作；
    - OM删除的是备份文件以及OM备份记录，在数据库中通过DBA_BACKUP_SET视图中依然可以查询到被删除的备份集记录
- 若指定共享磁盘为存贮路径，需要在    `+DG0`    目录下，否则会备份失败


**恢复**

- 执行恢复语句的节点必须是在nomount状态，且该实例角色为MASTER_ROLE。
-   `+DG0/dbfiles`    、    `+DG0/arch_files`    目录下存在数据库文件会被删除


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

**必选项1：关键技术点说明，设计方案要契合代码原有架构，涉及架构整改的工作，必须详细方案展开，同时评估好对其他特性的影响。**

**必选项2：第三方组件，组件的开源协议，引入后可能带来的影响。不允许未经过DRB评审的第三方组件合入。**

**必选项3：SR的特性设计需要跨模块配合，要拆解出来AR列表。**

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

![](attachments/100106090/100106103.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNjksImV4cCI6MTc4MjIyMjk2OX0.Iv7TCzU1l3UUBxGw06tIzHIlXBSlQsurzhtv8noQT5g)

![](picture/%E6%9E%B6%E6%9E%84%E5%9B%BE.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNjksImV4cCI6MTc4MjIyMjk2OX0.Iv7TCzU1l3UUBxGw06tIzHIlXBSlQsurzhtv8noQT5g)

整体的架构如上图，主要新增部分如下：

- 在yasboot中    `backup`    命令，用于下发备份恢复的指令
- 在yasom中的    `cron`    模块，用于调度定时任务
    - 基于备份策略，    `cron`    模块周期性的下发    `备份任务`    到    `task`    模块


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考 **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** ）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考 **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** ）。用于支撑测试方案的灰盒测试。**

###   [5.2.1 整体流程](#521-整体流程)  

主要交互流程如下：

![](attachments/100106090/100106101.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNjksImV4cCI6MTc4MjIyMjk2OX0.Iv7TCzU1l3UUBxGw06tIzHIlXBSlQsurzhtv8noQT5g)

![](picture/%E6%80%BB%E4%BD%93%E6%B5%81%E7%A8%8B.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIxNjksImV4cCI6MTc4MjIyMjk2OX0.Iv7TCzU1l3UUBxGw06tIzHIlXBSlQsurzhtv8noQT5g)

###   [5.2.2 备份命令行接口详细设计](#522-备份命令行接口详细设计)  

与单机分布式版保持一致，详细参考：    [https://conf.yasdb.com/pages/viewpage.action?pageId=107391712](https://conf.yasdb.com/pages/viewpage.action?pageId=107391712)  

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