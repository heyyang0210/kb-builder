Created by 罗爽, last modified on 五月 20, 2024

# 1. 概述

本文描述支持DBMS_RESOURCE_MANAGER内置系统包的测试设计。

*R链接：*    [https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb6](https://pingcode.yasdb.com/ship/ideas/660b74c5009f91eb87f2ceb6)    *?*    
  *#YASHAN-2225 支持DBMS_RESOURCE_MANAGER内置系统包*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66276b55fd997db58adfd4c9](https://pingcode.yasdb.com/pjm/items/66276b55fd997db58adfd4c9)    *?*    
  *#YDBRD-26619 支持DBMS_RESOURCE_MANAGER内置系统包*

*开发设计文档链接：*    [YDBRD-26619: 支持DBMS_RESOURCE_MANAGER内置系统包](150633944.html)  

# 2. 需求分析

1）在已有资源管理功能的基础上，新增如下内容：

|分类|接口|功能描述|修改点|
|---|---|---|---|
|高级包|DBMS_RESOURCE_MANAGER.CREATE_PLAN|创建一个资源计划|新增接口|
|  
|DBMS_RESOURCE_MANAGER.DELETE_PLAN|删除一个资源计划|新增接口|
|  
|DBMS_RESOURCE_MANAGER.CREATE_CONSUMER_GROUP|创建消费者组|支持comment参数为为null|
|  
|DBMS_RESOURCE_MANAGER.SET_CONSUMER_GROUP_MAPPING|设置或修改映射关系|1.支持consumer_group参数为NULL  ，表示删除映射,2.之前SET_CONSUMER_GROUP_MAPPING group1→group2报错，现成功，,表示可以修改用户的映射关系|
|配置参数|RESOURCE_MANAGER_PLAN|当前生效的计划|新增参数|
|系统视图|DBA_RSRC_PLANS|查看  资源计划相关信息|新增视图|
|日志|PLAN切换时打印日志|记录切换的PLAN及时间等信息|  
|


2）新增规格约束：

- 任何时刻最多只有一个plan生效
- RESOURCE_MANAGER_PLAN需要全局保持一致
- 不支持创建subplan
- 未创建plan的情况下无法新增对应指令
- 删除plan前需要先删除对应所有指令
- 切换plan时在备机上可能出现plan不存在的问题
- 正在生效的计划无法删除
- plan与consumer group为多对多关系


# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略。

## 3.2 详细测试设计

1）高级包和配置参数的语法测试采用边界值、等价类划分方法。

|测试项|有效等价类|无效等价类|备注|
|---|---|---|---|
|PLAN 资源计划名 ,VARCHAR(64)|中英文|null、空字符串|  
|
|  
|数字|TOALL|  
|
|  
|特殊字符|SYSGROUP|  
|
|  
|  
|DEFAULT_CONSUMER_GROUP|  
|
|  
|create_plan - plan不存在|create_plan - plan已存在|  
|
|  
|delete_plan - plan存在|delete_plan - plan不存在|  
|
|  
|边界值[1,64]|长度>64|  
|
|  
|  
|非字符串类型|  
|
|COMMENT 资源计划的注释,VARCHAR(2000) DEFAULT NULL|null、空字符串|长度>2000|  
|
|  
|中英文|非字符串类型|  
|
|  
|数字|  
|  
|
|  
|特殊字符|  
|  
|
|绑定参数（=>）赋值|合法顺序,(plan=>v1, comment=>v2),(v1, comment=>v2)|非法顺序,(plan=>v1, v2)|  
|
|CREATE_CONSUMER_GROUP|comment为null|  
|  
|
|SET_CONSUMER_GROUP_MAPPING|设置映射 u1 - null|设置映射 SYS - null|关注相关DBA视图|
|  
|修改映射groupA → groupA|修改映射groupA → group不存在|  
|
|  
|修改映射groupA → groupB|  
|  
|
|RESOURCE_MANAGER_PLAN参数,  
|cluster config set|group/node config set|参数需要全局一致|
|  
|alter system xxx type=all|alter session修改|  
|
|  
|alter system xxx type=cn/mn/dn|  
|  
|
|  
|null??待确认|TOALL|  
|
|  
|空串：单引号 双引号??(om alter)|SYS_GROUP|  
|
|  
|自定义计划|DEFAULT_CONSUMER_GROUP|  
|
|  
|  
|不存在的计划|  
|
|  
|边界值[1,64]|边界外65|  
|


  


2）参数关联测试

RSRC_MODE=''和CPU都会校验RESOURCE_MANAGER_PLAN

|RSRC_MODE|RESOURCE_MANAGER_PLAN|预期|
|---|---|---|
|''|任意值|1.修改RESOURCE_MANAGER_PLAN为合法值成功,2.修改RESOURCE_MANAGER_PLAN为非法值成功,3.资源管理不生效|
|CPU|''|与DEFAULT_CONSUMER_GROUP一致|
|  
|自定义plan|指定plan生效|
|  
|非法值|报错|


3）功能测试场景

|场景I|场景II|预期|
|---|---|---|
|RESOURCE_MANAGER_PLAN取值|RESOURCE_MANAGER_PLAN = '',执行业务|资源管理不生效|
|  
|RESOURCE_MANAGER_PLAN = planA,执行业务|1.planA下的组受资源管控,2.非planA下的组与default组一致,3.  SYS_GROUP的cpu_share动态调整|
|RESOURCE_MANAGER_PLAN生效方式,（planA生效）|scope=memory|1.重启前planA生效，  SYS_GROUP的  cpu_share动态调整,2.重启后没有plan生效，  SYS_GROUP的  cpu_share动态调整|
|  
|scope=spfile|1.重启前没有plan生效，  SYS_GROUP的  cpu_share无变化,2.重启后planA生效，  SYS_GROUP的  cpu_share动态调整|
|  
|scope=both|1.重启前planA生效，  SYS_GROUP的  cpu_share动态调整,2.重启后planA生效，  SYS_GROUP的cpu_share无变化|
|RESOURCE_MANAGER_PLAN切换|'' → ''|1.旧session与  DEFAULT_CONSUMER_GROUP一致,2.新session与  DEFAULT_CONSUMER_GROUP一致|
|  
|'' → planA|1.旧session与  DEFAULT_CONSUMER_GROUP一致,2.新session按planA生效,3.  SYS_GROUP的cpu_share动态调整|
|  
|planA → ''|1.旧  session按planA生效,2.新session与DEFAULT_CONSUMER_GROUP一致,3.SYS_GROUP的cpu_share动态调整|
|  
,  
|planA → planB|1.旧  session按planB生效,2.新session按planB生效,3.SYS_GROUP的cpu_share动态调整|
|plan_directive创建/删除,（planA生效）|planA下新增一个groupA的指令|1.旧session groupA  与DEFAULT_CONSUMER_GROUP一致,2.新session groupA按planA生效,3.SYS_GROUP的cpu_share动态调整|
|  
|planA下删除一个groupB的指令|1.旧session groupB按planA生效,2.新session groupB  与DEFAULT_CONSUMER_GROUP一致,3.SYS_GROUP的cpu_share动态调整|
|set_consumer_group_mapping|修改映射从groupA → groupB|1.旧session 按groupA的指令生效,2.新session 按groupB的指令生效|
|  
|删除映射 groupA → null|1.旧session 按groupA的指令生效,2.新session 与DEFAULT_CONSUMER_GROUP一致|
|约束|plan不存在，创建相应指令|报错|
|  
|指令存在，删除plan|报错|
|  
|plan生效，删除plan|报错|


4）DFX测试场景

|场景I|场景II|预期|
|---|---|---|
|RESOURCE_MANAGER_PLAN,节点参数不一致|cn1与cn2不一致|按节点生效|
||cn与dn不一致|同上|
||dn主与dn备不一致|同上|
||全局修改参数,（om、alter system）|1.修改成功，节点参数一致,2.旧session按新指令生效,3.新session按新指令生效,4.SYS_GROUP的cpu_share动态调整|
||删除某个节点的生效plan|报错？？待确认|
|HA|主备切换|1.新主机元数据同步,2.新主机受资源管控|
|  
|主备切换后切换plan|备机上可能出现plan不存在的问题|
|并发|并发修改元数据 + 切换plan|数据正确，不core|
|  
|并发修改元数据 + 执行业务|不core|
|扩缩容|扩容cn|元数据一致，资源管理符合预期|
|  
|dn组内扩容|元数据一致，资源管理符合预期|
|  
|dn组间扩容|元数据一致，资源管理符合预期|
|升级|升级完成，执行业务|没有plan受管控|
|  
|升级完成，手动切换plan|指定plan生效|
|  
|升级失败|回退成功|
|  
|plan配置参数|  
|
|备份恢复|备份恢复，备份前后plan不一致,plan新增、删除|成功|


## 3.3 DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|是|
|KT kill测试|/|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/|
|长稳|/|
|升级|是|
|扩缩容|是|
|备份恢复|是|


# 4. 测试用例

# 5. 测试框架设计

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现。

# 6. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux、Ubuntu v1/v2、ARM|
|部署|单机、分布式|


  


  


## Comments:

|  [](null)  ,测试评审会议纪要：    
  时间：2024/05/17 15:00~16:00    
  内容：    
  -- 责任人：测试    
  1.consumer_group_name关注特殊字符/、空格、.、..的表现    
  2.补充测试RESOURCE_MANAGER_PLAN为双引号，包括om修改和alter system修改    
  3.参数关联测试更正：无论RSRC_MODE取什么值，都会校验RESOURCE_MANAGER_PLAN    
  4.升级补充测试：旧版本RESOURCE_MANAGER_PLAN有值（存在和不存在）的场景    
  5.备份恢复补充测试：备份前后生效plan不一致，备份前后有plan新增，删除的场景    
  6.DBA_RSRC_PLANS视图的plan个数    
  -- 责任人：开发     
  7.梳理SET_CONSUMER_GROUP_MAPPING consumer_group参数为NULL的表现    
  8.确认RESOURCE_MANAGER_PLAN=null是否可以修改成功，包括om修改和alter system修改    
  9.推荐修改参数的方式补充到文档中    
  10.RESOURCE_MANAGER_PLAN节点参数不一致，删除某个节点的生效plan，确认表现,Posted by luoshuang at 五月 17, 2024 18:12|
|---|
