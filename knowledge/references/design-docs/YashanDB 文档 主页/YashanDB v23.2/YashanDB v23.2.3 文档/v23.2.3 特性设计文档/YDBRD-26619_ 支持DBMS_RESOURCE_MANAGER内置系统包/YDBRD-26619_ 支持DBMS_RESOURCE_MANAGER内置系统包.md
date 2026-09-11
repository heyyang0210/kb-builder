Created by 赖美全, last modified on 十月 14, 2024

*详细设计-YDBRD-26619: 支持DBMS_RESOURCE_MANAGER内置系统包方案设计*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb6](https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb6)    *?*    
  *#YASHAN-2225 支持DBMS_RESOURCE_MANAGER内置系统包*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66276b55fd997db58adfd4c9](https://pingcode.yasdb.com/pjm/items/66276b55fd997db58adfd4c9)    *?*    
  *#YDBRD-26619 支持DBMS_RESOURCE_MANAGER内置系统包*

##   [1. 总述](#1-总述)  

支持DBMS_RESOURCE_MANAGER内置系统包，支持维护计划、消费者群体和计划指令等组合使用；

###   [1.1 需求来源](#11-需求来源)  

产品化需求，兼容ORACLE。

需要支持的部署形态包括:

- 单机
- 分布式


###   [1.2 调研文档](#12-调研文档)  

  [YDBRD-26619: 支持DBMS_RESOURCE_MANAGER内置系统包特性调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150633813)  

###   [1.3 需求分析](#13-需求分析)  

该特性实现CREATE_PLAN和DELETE_PLAN两个子函数。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|创建plan|高级包子函数|是|是|
|功能|删除plan|高级包子函数|是|是|
|功能|切换plan|修改配置参数RESOURCE_MANAGER_PLAN|是|是|
|可维可测|DBA视图|新增DBA_RSRC_PLANS视图|是|是|
|兼容性|数据库升级后资源管理生效问题|默认所有指令不生效，需要手动切换plan指定生效plan|是|是|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|plan资源计划|用来描述指定资源分配给资源消费者组的指令集，通过激活特定的资源计划来指定数据库如何分配资源。|是|  [oracle术语描述](https://docs.oracle.com/en/database/oracle/oracle-database/23/admin/managing-resources-with-oracle-database-resource-manager.html#GUID-04B4805A-A3B4-4B1E-B42D-01BAB4D4ECB4)  |


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级包|DBMS_RESOURCE_MANAGER.CREATE_PLAN|创建一个资源计划|是|
|高级包|DBMS_RESOURCE_MANAGER.DELETE_PLAN|删除一个资源计划|是|
|高级包|DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP|支持comment参数为NULL|是|
|高级包|DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING|支持consumer_group参数为NULL，表示删除映射|是|
|系统视图|DBA_RSRC_PLANS视图|查询资源计划相关信息,兼容oracle所有字段|是|
|配置参数|RESOURCE_MANAGER_PLAN|按scope=all, type=all生效|是|
|日志|PLAN切换时打印日志|记录切换的PLAN及时间等信息|是|


##   [3. 规格与约束](#3-规格与约束)  

新增以下规格/约束，资源管理之前的规格/约束仍然保持:

|规格/约束|描述|说明|备注|
|---|---|---|---|
|规格|任何时刻最多只有一个plan生效|兼容oracle||
|规格|RESOURCE_MANAGER_PLAN需要全局保持一致|所有节点保持一致|需要OM支持|
|约束|不支持创建subplan|用户不支持创建subplan子计划，SYS_GROUP子计划仅用作内部管理后台线程||
|约束|未创建plan的情况下无法新增对应指令|新增指令时需要对应plan存在|数据库升级兼容处理，旧指令的所有计划需要创建才能生效，允许删除旧指令|
|约束|删除plan前需要先删除对应所有指令|与资源组相似约束，指令存在时无法直接删除计划和资源组||
|约束|切换plan时在备机上可能出现plan不存在的问题|主备元数据同步是通过redo日志回放实现的，切换plan时redo日志不一定已经回放了，可能存在时间差||
|约束|正在生效的计划无法删除|删除正在生效的计划需要考虑切换问题||


##   [4. 特性](#4-特性)  

资源计划(plan)用来描述指定资源的分配规则，包含一系列的指令(directive)。资源计划与指令存在父子关系，每个指令关联了一个资源使用组。

本特性实现create_plan和delete_plan子函数，提供对资源计划的管理能力，以及通过修改配置参数RESOURCE_MANAGER_PLAN，具备切换活动资源计划的能力。

![](https://pingcode.yasdb.com/atlas/files/public/67396d518970c2af4f5211ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDczMzksImV4cCI6MTc4MjMxODEzOX0._6UrU2-swWYHv4s2J30ej7gtIla0CjIkRJbwXUfAOMY)

###   [4.1 高级包子函数](#41-高级包子函数)  

####   [create_plan 子函数](#create-plan-子函数)  

```
DBMS_RESOURCE_MANAGER.CREATE_PLAN (
    PLAN          IN   VARCHAR(64), 
    COMMENT       IN   VARCHAR(2000) DEFAULT NULL);

```

该程序用于创建资源计划，目前仅支持创建一级计划，不支持创建子计划。

系统包含如下默认资源计划：

- TOALL: 一级资源计划，包含关联内部进程和DEFAULT_CONSUMER_GROUP的指令。
- SYS_GROUP: 二级资源计划，属于TOALL的子计划，包含关联系统用户sys和系统进程的指令。


|参数|描述|
|---|---|
|PLAN|资源计划名|
|COMMENT|注释|


####   [delete_plan 子函数](#delete-plan-子函数)  

```
DBMS_RESOURCE_MANAGER.DELETE_PLAN (
    PLAN IN VARCHAR(64));

```

该程序用于删除资源计划，无法删除内置资源计划TOALL和SYS_GROUP。

|参数|描述|
|---|---|
|PLAN|资源计划名|


####   [系统表变更](#系统表变更)  

系统表RSRC_PLAN$新增ID字段，废弃NUM_PLAN_DIRECTIVES字段：

|变更|字段|类型|说明|
|---|---|---|---|
|新增|ID|BIGINT|分布式下数据一致性|
|废弃|NUM_PLAN_DIRECTIVES|INTEGER|维护需要做较多工作量，内部暂无需使用，视图查询可以通过group by 实现|


#####   [计划id的分配](#计划id的分配)  

资源计划的ID采用OID分配的形式，预留范围[0, 1023]用作后续拓展，内置计划的id:

- TOALL: 0
- SYS_GROUP: 1


用户创建的oid从MN上分配下来，跳过预留范围的id。

####   [create_consumer_group子函数](#create-consumer-group子函数)  

```
DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP (
    CONSUMER_GROUP    IN   VARCHAR(64), 
    COMMENT           IN   VARCHAR(2000) DEFAULT NULL);

```

|参数|描述|
|---|---|
|CONSUMER_GROUP|资源使用组，名称唯一且符合YashanDB的对象命名规范|
|COMMENT|注释|


允许参数'COMMENT'为空或NULL值。

```
-- 以下几个执行的效果等同
exec dbms_resource_manager.create_consumer_group('TEST', NULL);
exec dbms_resource_manager.create_consumer_group('TEST');

```

####   [set_consumer_group_mapping子函数](#set-consumer-group-mapping子函数)  

```
DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING(
    ATTRIBUTE      IN VARCHAR(64),
    VALUE          IN VARCHAR(64),
    CONSUMER_GROUP IN VARCHAR(64) DEFAULT NULL); 

```

|参数|描述|
|---|---|
|ATTRIBUTE|映射属性 仅支持USER，即资源使用者以用户为维度|
|VALUE|待映射的用户名，必须为已存在的用户|
|CONSUMER_GROUP|待映射的资源使用组, 为NULL时表示删除对应映射|


允许参数'CONSUMER_GROUP'为空，空字符串或NULL值，表示删除对应映射，表现与DELETE_CONSUMER_GROUP_MAPPING一致。

如果原本已经存在映射，那么将更新用户的映射到新的资源组。

```
-- 以下几个执行的效果等同
exec dbms_resource_manager.set_consumer_group_mapping('USER', 'TEST', '');
exec dbms_resource_manager.set_consumer_group_mapping('USER', 'TEST', 'DEFAULT_CONSUMER_GROUP');
exec dbms_resource_manager.set_consumer_group_mapping('USER', 'TEST', NULL);
exec dbms_resource_manager.set_consumer_group_mapping('USER', 'TEST');
exec dbms_resource_manager.delete_consumer_group_mapping('USER', 'TEST');

```

###   [4.2 计划生效/切换](#42-计划生效切换)  

使用配置参数RESOURCE_MANAGER_PLAN进行计划的生效与失效。

- 参数类型：字符串
- 默认值: ''
- 取值范围/格式: 资源计划名称，长度最大64
- 参数说明：指定活动资源计划，关联到该计划的指令均生效。
- 修改立即生效：是
- 会话级参数：否
- 只读参数：否
- 引入版本： v23.2


任何时刻最多只有一个用户资源计划plan生效，内置资源计划TOALL和SYS_GROUP在打开RSRC_MODE(设置为'CPU')时默认生效，无法内置计划。

|取值|表现|
|---|---|
|''|没有用户计划生效|
|'TEST_PLAN'|资源计划'TEST_PLAN'生效，关联到该计划的指令均生效|
|'TOALL'|报错，无法设置|
|'SYS_GROUP'|报错，无法设置|


需要在om层限制参数设置要求全局一致。

####   [校验plan](#校验plan)  

1. 通过会话设置plan时，会通过系统表校验plan是否存在;
1. 通过配置文件修改时，会在资源管理模块初始化时校验plan是否存在。


####   [切换资源计划后不同资源组表现](#切换资源计划后不同资源组表现)  

|资源组|旧计划|新计划|旧会话表现|新会话表现|
|---|---|---|---|---|
|资源使用组A|没有关联的指令|没有关联的指令|保持原来表现，留在DEFAULT_GROUP|表现与DEFAULT_CONSUMER_GROUP一致，线程加入到DEFAULT_GROUP|
|资源使用组B|关联了指令|没有关联的指令|保持原来表现，使用旧指令|表现与DEFAULT_CONSUMER_GROUP一致，线程加入到DEFAULT_GROUP|
|资源使用组C|没有关联的指令|关联了指令|保持原来表现，留在DEFAULT_GROUP|按新指令生效|
|资源使用组D|关联了指令|关联了指令|按新指令生效|按新指令生效|


####   [切换具体实现](#切换具体实现)  

|旧计划|新计划|变更实现|
|---|---|---|
|没有关联的指令|没有关联的指令|cgroup文件不变，dc不变|
|关联了指令|没有关联的指令|cgroup文件不变，刷新dc，消除指令指针|
|没有关联的指令|关联了指令|创建cgroup文件，刷新dc，新增指令指针|
|关联了指令|关联了指令|刷新cgroup文件内容，刷新dc，修改指令指针|


除了上面对资源组的修改，还需刷新SYS_GROUP的MGMT_P1值，确保仍在区间[40%, 60%]内。

###   [4.3 并发控制](#43-并发控制)  

增加资源管理全局锁，资源管理相关操作均会加锁:

- 创建/删除资源组
- 创建/删除用户映射
- 创建/删除计划
- 创建/删除/更新/计划指令
- 切换计划


###   [4.4 DBA视图](#44-dba视图)  

视图DBA_RSRC_PLANS显示数据库中所有资源计划的信息。

|字段|类型|说明|
|---|---|---|
|PLAN_ID|BIGINT|资源计划ID|
|PLAN|VARCHAR(64)|资源计划名称|
|NUM_PLAN_DIRECTIVES|INTEGER|资源计划包含的指令数量|
|CPU_METHOD|VARCHAR(1)|仅用于兼容，目前值固定为    `NULL`  |
|MGMT_METHOD|VARCHAR(1)|仅用于兼容，目前值固定为    `NULL`  |
|ACTIVE_SESS_POOL_MTH|VARCHAR(1)|仅用于兼容，目前值固定为    `NULL`  |
|PARALLEL_DEGREE_LIMIT_MTH|VARCHAR(1)|仅用于兼容，目前值固定为    `NULL`  |
|QUEUING_MTH|VARCHAR(1)|仅用于兼容，目前值固定为    `NULL`  |
|SUB_PLAN|VARCHAR(3)|资源计划是否为子计划（YES）或不是（NO）|
|COMMENTS|VARCHAR(2000)|资源计划的注释信息|
|STATUS|VARCHAR(1)|仅用于兼容，目前值固定为    `NULL`  |
|MANDATORY|VARCHAR(1)|仅用于兼容，目前值固定为    `NULL`  |


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|功能|场景|预期|备注|
|---|---|---|---|
|创建计划|创建自定义计划|预期成功||
||创建内置计划TOALL或者SYS_GROUP|预期失败||
|删除计划|计划没有对应指令|预期成功||
||计划有对应指令|预期失败||
|切换计划|自定义计划|预期成功|切换不同plan时刷SYS_GROUP的mgmt_p1|
||''|预期成功|SYS_GROUP的mgmt_p1值回到[40%, 60%]区间|
||TOALL|预期失败||
||SYS_GROUP|预期失败||
|查询视图|查询DBA_RSRC_PLANS视图|预期数据正确||
|扩缩容后，元数据是否一致|创建自定义PLAN|预期目标节点和原节点一致||
|版本升级|未手动切换plan|预期用户计划全部失效||
||手动切换plan，但plan不存在|切换失败||
|并发控制|并发元数据修改|预期数据正确|排他锁限制并发执行|
||并发元数据修改和切换计划|预期正常|限制元数据修改和切换计划并发执行|
|主备切换|元数据修改后主备是否一致|预期一致||
||切换plan以后备机是否切换||主备同步需要时间，可能存在时间内未完全同步|


##   [6.资料设计章节](#6资料设计章节)  

1. 资源管理章节增加计划的描述
1. 高级包DBMS_RESOURCE_MANAGER增加CREATE_PLAN和DELETE_PLAN的描述
1. 增加视图DBA_RSRC_PLANS描述


##   [7. 工作量](#7-工作量)  

|功能|任务|工作量|
|---|---|---|
|增加子函数|语法支持，元数据插入|2d|
|视图查询|新增视图DBA_RSRC_PLANS|0.5d|
|计划生效|修改参数RESOURCE_MANAGER_PLAN|2d|
|支持扩缩容|PLAN对象元数据迁移|1d|
|文档修改|资料修改|2d|
|自测|功能验证|3d|


##   [8.未来规划](#8未来规划)  

1. 实现subplan子计划


## Attachments:

[plan关系梳理.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTFhMWFkOWEzMzExZGM5MDZlIiwicmVmX2lkIjoiNjczOTZkNTE1OTNmOTljOWZmMjM3YTBmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MzM5LCJleHAiOjE3ODIzOTM3Mzl9.BrDa0OZFCMj1UBjNPdjRhUb8BmqcZ3jE2VYjDAVmDUY)

 (image/png)    


[plan关系梳理.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTE4OTcwYzJhZjRmNTIxMWZkIiwicmVmX2lkIjoiNjczOTZkNTE1OTNmOTljOWZmMjM3YTBmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3MzM5LCJleHAiOjE3ODIzOTM3Mzl9.mEW0CFVv3_Wnn21E7Y1ArzoYHm5kxMo1nD3yixSwybU)

 (image/png)    
