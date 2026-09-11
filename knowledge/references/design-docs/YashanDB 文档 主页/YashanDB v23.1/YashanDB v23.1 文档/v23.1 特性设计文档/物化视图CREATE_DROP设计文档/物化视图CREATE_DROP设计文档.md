Created by 苏凡, last modified on 八月 21, 2023

#   [YDBRD-13581 : Materialized View Create/Drop Design（物化视图创建与删除方案设计）](#ydbrd-13581--materialized-view-createdrop-design物化视图创建与删除方案设计)  

IR链接：    [https://jira.yasdb.com/browse/YDBRD-940](https://jira.yasdb.com/browse/YDBRD-940)      SR链接：    [https://jira.yasdb.com/browse/YDBRD-13581](https://jira.yasdb.com/browse/YDBRD-13581)  

##   [1. Overview（概述）](#1-overview概述)  

物化视图是一种数据库内重要的关键特性，它与普通视图最大的区别是拥有一份自己的持久化数据，用以包装和保存一些复杂查询的结果集。当后续有诉求对某种复杂查询进行分析、查询改写时，可以直接使用物化视图中的快照数据。这样做有许多好处，包括以下特点：

- 提高查询性能，更快的获取结果集
- 对聚合和计算后的结果，可以提前处理，在每次实际查询中可以避免复杂计算
- 数据复制，可以在同数据库或不同实例之间复制一份数据，方便的提供只读访问
- 通过物化视图中存储的数据，可以优化复杂查询
- 可以将多表数据整个到单个物化视图中（数据集成）……


本次特性范围仅支持物化视图的基础CREATE/DROP功能，其他功能后续演进；部署模式限制：

- 特性支持的部署形态为 主备(单机) （其他部署形态视后续演进支持）
- 单机行执行 （列执行后续演进支持）


##   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|设计表现|设计说明|
|---|---|---|
|物化视图CREATE|物化视图能够通过提供的语法正确创建|创建后可以在各个系统表内查到相关内容；创建后属性指定正确；创建后能够访问物化视图|
|物化视图DROP|物化视图能够通过提供语法删除|删除后清空相关系统表记录；物化视图无法再访问|


(2) SQL语法有关的功能特性设计，需要给出语法图或EBNF，说明各语法分支的具体含义。不支持的分支可以不提及，但只做了语法兼容的分支，要给出显著而且明确的说明。

支持两类语法：CREATE MATERIALIZED VIEW 和DROP MATERIALIZED VIEW【注：语法每一项具体说明在第三部分中详细展开】

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396b388970c2af4f5202c5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQlVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFFQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFDQUFBQUFBQUFBQUFRSUFBQUFBQUFBSUFBQUFRQUFBQUFBQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE5NTYsImV4cCI6MTc4MjMwMjc1Nn0.Snv0QwHUWtTBZVTKtXihgOE1ggwU_dSS7YORTyqcb1I)

![](https://pingcode.yasdb.com/atlas/files/public/67396b38a1ad9a3311dc813a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQlVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFFQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFDQUFBQUFBQUFBQUFRSUFBQUFBQUFBSUFBQUFRQUFBQUFBQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE5NTYsImV4cCI6MTc4MjMwMjc1Nn0.Snv0QwHUWtTBZVTKtXihgOE1ggwU_dSS7YORTyqcb1I)

![](https://pingcode.yasdb.com/atlas/files/public/67396b38a1ad9a3311dc813b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQlVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFFQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFRQUFBQUFDQUFBQUFBQUFBQUFRSUFBQUFBQUFBSUFBQUFRQUFBQUFBQUFBQUFBQUFBQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE5NTYsImV4cCI6MTc4MjMwMjc1Nn0.Snv0QwHUWtTBZVTKtXihgOE1ggwU_dSS7YORTyqcb1I)

【特别注意：以下表格罗列仅支持语法，无功能支撑的部分说明，特此强调】

|功能|调研表现|调研表现|
|---|---|---|
|create_mv_refresh_clause|仅支持语法|支持语法，明显语法矛盾会报错；不支持真正的刷新功能|
|build分支|build immediate或build deferred|仅支持语法，不支持刷新数据|


##   [3. Interfaces（接口）](#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

**1.SQL语法，必须给出EBNF。禁止描述不存在的分支。**

语法图在第二部分已说明，重点说明本特性中特有的部分：

- 创建物化视图可以指定schema、tablespace，其他存储属性暂时不支持指定
- build分支语法【仅语法支持，无刷新功能】
    - build immediate：指创建时即完成一次全量数据刷新，填充数据并持久化
    - build deferred： 指创建时仅完成定义创建，不刷新数据
- create mv refresh子句【仅语法支持，无刷新功能】
    - 刷新类型选项
        - fast：快速刷新（增量）
        - complete：全量刷新
        - force：优先快速，如快速刷新不可用则切换为全量刷新
    - 刷新模式选项
        - on demand：根据手动命令或高级包刷新
        - on commit：事务提交时刷新相关联物化视图
        - on statement：跟随DML语句刷新
    - 定时刷新选项
        - start with date：指定第一次刷新定时时间
        - next date：指定刷新间隔时间
    - 指定不刷新：never refresh


语法ENBF：

CREATE 语法：

```
create_materialiazed_view = CREATE MATERIALIZED VIEW [SCHEMA "."] materialized_view_name 
["("  (column_name {"," column_name}) ")"] [TABLESPACE tablespace_name] 
[BUILD (IMMEDIATE | DEFERRED)] 
[create_mv_refresh_clause] 
[query_rewrite_clause] 
AS subquery.

```

刷新子句：

```
create_mv_refresh_clause = 
((REFRESH ((FAST | COMPLETE | FORCE) 
| (ON DEMAND | ON COMMIT | ON STATEMENT) 
| (((START WITH date) | NEXT date))) 
| (NEVER REFRESH)).

```

DROP语法：

```
drop_materialiazed_view = DROP MATERIALIZED VIEW [SCHEMA "."] materialized_view_name .

```

**2.与数据库的功能相关的系统表、系统视图和配置参数，需要罗列，给出设计说明。**

相关系统表说明：

|系统表|内容说明|
|---|---|
|MATERIALIZED_VIEW$|物化视图基础系统表，记录物化视图相关的属性和信息|
|MV_REFOP$|根据物化视图属性而自动生成的物化视图刷新操作相关信息|
|MV_REFTIME$|记录物化视图刷新动作相关信息|
|SUM_DETAIL$|记录物化视图相关master table信息|


以下：

系统表字段详细说明：

#####   [MATERIALIZED_VIEW$](#materialized-view)  

|字段|数据类型|说明|
|---|---|---|
|MV_OID|BINARY_BIGINT，not null|物化视图OID|
|MV_OWNER|VARCHAR  (  64  )，not null|物化视图owner名字|
|MV_NAME|VARCHAR  (  64  )，not null|物化视图名字|
|CONTAINER_NAME|VARCHAR(64),   not null|物化视图容器表名字|
|MATER_OWNER|VARCHAR(64)|物化视图master table owner|
|MATER_TAB|VARCHAR(64) |物化视图master table名字|
|MV_INTERNAL_ID|BINARY_BIGINT |物化视图内部ID|
|REFRESH_MODE|INTEGER|物化视图刷新模式,0：on demand,1：on commit,2：on statement|
|REFRESH_TYPE|INTEGER|物化视图刷新类型,0：force,1：fast,2：complete,3：never refresh|
|MASTER_TABLES|INTEGER|物化视图基表数量|
|QUERY_LEN|INTEGER|物化视图定义查询语句长度|
|QUERY_TXT|CLOB|物化视图定义中的查询语句|
|DDL_TIME|DATE|物化视图发生DDL的时间戳|


系统表字段详细说明：

#####   [MV_REFOP$](#mv-refop)  

|字段|数据类型|详细说明|
|---|---|---|
|MV_OID|BIGINT,   not null|物化视图OID|
|MV_OWNER|VARCHAR(64),  not null|物化视图owner名字|
|MV_NAME|VARCHAR(64),  not null|物化视图名字|
|OPERATION#|INTEGER, not null|物化视图刷新策略,0：create table as select,1：insert into select|
|SQL_TXT|CLOB|物化视图对应策略的刷新语句|


系统表字段详细说明：

#####   [MV_REFTIME$](#mv-reftime)  

|字段|数据类型|详细说明|
|---|---|---|
|MV_OID|BIGINT,   not null|物化视图OID|
|MV_OWNER|VARCHAR(64),  not null|物化视图owner名字|
|MV_NAME|VARCHAR(64),  not null|物化视图名字|
|TAB_NUM|INTEGER, not null|物化视图master table编号|
|MASTER_OWNER|VARCHAR(64)|物化视图master table owner|
|MASTER_TAB|VARCHAR(64)|物化视图master table名字|
|MASTER_OBJ#|BIGINT|物化视图master table oid|
|LAST_REF_TIME|DATE|上次刷新时间戳|
|LAST_REF_SCN|BIGINT|上次刷新scn|


系统表字段详细说明：

#####   [SUM_DETAIL$](#sum-detail)  

|字段|数据类型|详细说莫|
|---|---|---|
|SUM_OBJ#|BIGINT|物化视图oid|
|DETAIL_OJB#|BIGINT|物化视图master table的oid|
|DETAIL_OBJTYPE|INTEGER|物化视图的master table的类型|
|DETAIL_ALIAS|VARCHAR(64)|物化视图定义中对master table的别名|
|LAST_REF_SCN|BIGINT|上次刷新的scn|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

本方案仅支持物化视图创建、删除、select访问，支持其中语法图中提供的所有语法兼容；

功能限制：

- 不支持刷新功能。
- 不支持权限控制
- 不支持其他DDL，无法支持的会报错，不影响使用的会成功


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

**与协议、通讯、多线程多进程同步、涉及多个模块互相配合的功能特性设计，必须需要给出时序图（为了跨模块分解AR和定义模块间接口，可参考 **    [https://www.jianshu.com/p/282d57f09692](https://www.jianshu.com/p/282d57f09692)    ** ）。**

**给出功能特性的工作流程图（体现功能特性内部工作流程，可参考 **    [https://zhuanlan.zhihu.com/p/112731728](https://zhuanlan.zhihu.com/p/112731728)    ** ）。用于支撑测试方案的灰盒测试。**

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

有新增系统表和索引，其他旧版本使用需要走升级脚本。

###   [5.4 DFX设计](#54-dfx设计)  

备机可以访问物化视图；

###   [5.5 其他](#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

自测基础场景：

1. 语法组合测试
1. 正常创建+系统表维护内容测试
1. 增删改查DML，其中select可以查出空表，其他DML报错。
1. 一般DDL对物化视图进行（以DDL table为基准），不允许做的DDL预期报错。
1. DROP物化视图，正确删除，系统表相关记录清理。
1. 备机可以访问物化视图


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

- 后续迭代开发全量刷新
- 后续演进支持列存和其他形态部署
- 后续迭代开发物化视图权限控制
- 物化视图alter等DDL


## Attachments: