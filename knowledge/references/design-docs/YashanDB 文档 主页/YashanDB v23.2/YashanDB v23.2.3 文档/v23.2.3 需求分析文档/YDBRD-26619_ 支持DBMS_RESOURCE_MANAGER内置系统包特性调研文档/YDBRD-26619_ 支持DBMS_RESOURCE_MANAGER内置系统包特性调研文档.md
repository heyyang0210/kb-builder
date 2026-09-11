Created by 赖美全, last modified on 四月 30, 2024

*# 特性调研-YDBRD-26619: 支持DBMS_RESOURCE_MANAGER内置系统包特性调研*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb6](https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb6)    *?*    
  *#YASHAN-2225 支持DBMS_RESOURCE_MANAGER内置系统包*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66276b55fd997db58adfd4c9](https://pingcode.yasdb.com/pjm/items/66276b55fd997db58adfd4c9)    *?*    
  *#YDBRD-26619 支持DBMS_RESOURCE_MANAGER内置系统包*

##   [1. 总述](#1-总述)  

DBMS_RESOURCE_MANAGER内置系统包实现资源管理功能，调研参考ORACLE和OCEANBASE。

###   [1.1 需求合理性分析](#11-需求合理性分析)  

支持DBMS_RESOURCE_MANAGER内置系统包，支持维护计划、消费者群体和计划指令等组合使用

###   [1.2 需求实现分析](#12-需求实现分析)  

使用cgroup作为底层资源管理功能使用，参考oceanbase。

实现子函数包含如下:

1. CREATE_CONSUMER_GROUP
1. CREATE_PLAN
1. CREATE_PLAN_DIRECTIVE
1. DELETE_CONSUMER_GROUP
1. DELETE_PLAN
1. DELETE_PLAN_DIRECTIVE
1. SET_CONSUMER_GROUP_MAPPING
1. UPDATE_PLAN_DIRECTIVE


###   [1.3 数据字典](#13-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|cgroup|inux 内核提供的一种机制，这种机制可以根据特定的行为，将一系列系统任务及其子任务整合（或分隔）到按资源划分等级的不同组内，从而为系统资源管理提供一个统一的框架。|是|  [https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000749748](https://www.oceanbase.com/docs/common-oceanbase-database-cn-1000000000749748)  |


##   [2. 接口](#2-接口)  

友商特性对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级包|DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP|----|是|
|高级包|DBMS_RESOURCE_MANAGER.CREATE_PLAN|----|是|
|高级包|DBMS_RESOURCE_MANAGER.CREATE_PLAN_DIRECTIVE|----|是|
|高级包|DBMS_RESOURCE_MANAGER.DELETE_CONSUMER_GROUP|----|是|
|高级包|DBMS_RESOURCE_MANAGER.DELETE_PLAN|----|是|
|高级包|DBMS_RESOURCE_MANAGER.DELETE_PLAN_DIRECTIVE|----|是|
|高级包|DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING|----|是|
|高级包|DBMS_RESOURCE_MANAGER.UPDATE_PLAN_DIRECTIVE|----|是|
|系统视图|DBA_RSRC_PLANS视图|兼容oracle所有字段|是|
|配置参数|RESOURCE_MANAGER_PLAN|按scope=memory, type=all生效|是|


####   [高级包子函数](#高级包子函数)  

|子函数|oracle|oceanbase|yashanDB|
|---|---|---|---|
|CREATE_CONSUMER_GROUP|支持|支持，仅实现consumer_group和comment两个参数|同oceanbase|
|CREATE_PLAN|支持|支持，仅实现plan和comment两个参数|不支持|
|CREATE_PLAN_DIRECTIVE|支持|支持，仅实现部分参数，额外实现MIN_IOPS, MAX_IOPS和WEIGHT_IOPS参数|支持，仅实现部分参数|
|DELETE_CONSUMER_GROUP|支持|支持|支持|
|DELETE_PLAN|支持|支持|不支持|
|DELETE_PLAN_DIRECTIVE|支持|支持|支持|
|SET_CONSUMER_GROUP_MAPPING|支持|支持|支持|
|UPDATE_PLAN_DIRECTIVE|支持|支持，仅实现部分参数，额外实现MIN_IOPS, MAX_IOPS和WEIGHT_IOPS参数|支持，仅实现部分参数|
|DELETE_CONSUMER_GROUP_MAPPING|不支持|不支持|支持|
|UPDATE_PLAN|支持|不支持|不支持|
|SWITCH_PLAN|支持|不支持|不支持|


##   [3. 规格与约束](#3-规格与约束)  

**说明调研特性对外的功能规格或约束。给出各友商的差异点、优缺点描述。**

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。