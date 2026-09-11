Created by 王林, last modified on 十月 18, 2024

*IR链接：*    [[YDBRD-18577] 支持LBAC强制访问控制](https://jira.yasdb.com/browse/YDBRD-18577)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  

根据产品化需求，  通过标签和策略实现对细粒度的权限进行控制，对单机和集群支持强制访问控制。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

产品化需求，能够支持行级访问控制。客户可以通过  标签和策略实现对细粒度的权限进行控制。部署形态为 主备(单机)、集群都要支持该特性。

在关闭LBAC时，不会对性能产生影响；在开启LBAC时，不会对性能产生较大影响（5%）。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

详细调研在在调研文档中展开。

Oracle, OceanBase, 达梦，金仓支持行级访问控制。

OceanBase : 语法同Oracle，支持了Oracle LBAC主要常用功能（策略、level, compartment, group, 表关联策略， 用户关联策略，设置用户session级策略信息）。

达梦：功能类同Oracle语法差别较大，支持了Oracle LBAC主要功能（策略、level, compartment, group, 表关联策略， 用户关联策略，设置用户session级策略信息，特权）。

金仓：功能类同Oracle语法差别不大，支持了Oracle LBAC主要功能（策略、level, compartment, group, 表关联策略， 用户关联策略，设置用户session级策略信息，特权）。

openGauss: 功能和语法都简单，通过给表增加1个用户名的列来识别不同用户可以访问的范围。

调研文档 ：    [LBAC 调研](https://conf.yasdb.com/pages/viewpage.action?pageId=133593853)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

**功能属性**

1.启动和禁用LBCA

2.策略管理：支持创建删除策略

3.标签管理：支持创建删除标签，标签实现基于Level和标签和基于隔离区的标签，可以设置用户标签，session标签和行标签。

4.用户权限与角色支持：增加安全管理员角色与安全管理员。

5.安全谓词：根据配置，生成对应的安全谓词。

6.EXP/IMP支持LBAC策略

7.配置LBAC策略行为的审计，LBAC的策略包括添加、删除标签，启用LBAC策略

**非功能质量属性的理论知识指导，斜体内容正式文档可删除**

*（1）安全谓词的时间消耗同普通谓词对性能的影响一致。性能指系统的响应能力，即要经过多长时间才能对某个事件做出响应，或者某段时间内系统所能处理的事件个数。*     **例如执行表达式和算子类的特性需求，如果不选要给出充分理由。**

**      ：：**  *安全谓词的时间消耗同普通谓词对性能的影响一致。*

*（2）可用性指系统能够正常运行的时间比例。经常用两次故障之间的时间长度或出现故障时系统恢复正常的速度来表示。*     **例如OM、YCS等节点管理的特性需求，如果不选要给出充分理由**

     ：：无，不涉及管理特性

*（3）可靠性是软件系统在应用或系统错误面前，维持软件系统的功能特性的基本能力。*     **例如主备、容灾、存储等的特性需求，如果不选要给出充分理由**

    ：：在异常等情况下，主备缓存信息一致、表内容一致；集群多实例上缓存信息一致

*（4）可测试性指通过测试揭示软件缺陷的容易程度。*     **特性如果不易观察时，要考虑增加DFX视图或者增加告警等手段**

   ：：通过sql语句执行可以反馈LBAC 缓存、存储、计算是否存在问题

*（5）安全性指系统在向合法用户提供服务的同时能够阻止非授权用户使用的企图或拒绝服务的能力。*     **例如协议、驱动、访问控制、通讯、加密等特性需求，如果不选要给出充分理由**

   ：：有权限控制，非LBAC_SYS 和 LBAC_DBA 授权用户无法操作LBAC设置

*（6）易用性指关注对用户来说完成某个期望任务的容易程度和系统所提供的用户支持的种类。*     **如何提升用户体验**

   ：：操作简洁及清晰，逻辑判断清晰

*（7）可修改性指能够快速地以较高的性价比对系统进行变更的能力。*     **后续追加特性的开发容易程度**

   ：：根据特性总体功能，分为了策略、用户、表、标签这几部分进行设置管理

*（8）兼容性指特性开发是否向前兼容，是否涉及升级。*

   ：：涉及升级：系统表的添加、用户的添加、视图的添加，

**CHECKLIST，正式设计文档需要关注**

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|启动和禁用LBCA|高级包YLS_ENFORCEMENT，,子存储过程：  ENABLE_YLS，  DISABLE_YLS|否|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|  
|策略管理：支持创建删除策略|高级包   SA_SYSDBA，,子存储过程：CREATE_POLICY，DROP_POLICY|否|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|  
|标签管理：支持创建删除标签，标签实现基于Level和标签和基于隔离区的标签，可以设置用户标签，session标签和行标签。|高级包   SA_COMPONENTS，,子存储过程：CREATE_LEVEL，DROP_LEVEL，,CREATE_COMPARTMENT，DROP_COMPARTMENT,  
,高级包：CREATE_LABEL，,子存储过程：CREATE_LABEL， DROP_LABEL,  
,高级包：SA_POLICY_ADMIN，,子存储过程：APPLY_TABLE_POLICY，REMOVE_TABLE_POLICY,  
,高级包：  SA_USER_ADMIN，,子存储过程：SET_USER_LABELS，DROP_USER_ACCESS|操作对应的缓存设计，,操作缓存的同步|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|  
|用户权限与角色支持：增加安全管理员角色与安全管理员。|安全管理员LBACSYS，角色LBAC_DBA|否|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|  
|安全谓词：根据配置，生成对应的安全谓词。|新增FILTER: FILTER_SA|安全谓词关联信息的获取，,安全谓词执行效率，,不同操作对执行计划缓存的影响|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|  
|审计|配置LBAC策略行为的审计    
  LBAC的策略包括添加、删除标签，启用LBAC策略|否|是|  [YDBRD-22167](https://jira.yasdb.com/browse/YDBRD-22167?src=confmacro)    -  支持LBAC策略的审计能力  开发中|
|  
|导入导出|EXP/IMP支持LBAC策略|否|是|  [YDBRD-22168](https://jira.yasdb.com/browse/YDBRD-22168?src=confmacro)    -  支持LBAC策略的导入导出能力  开发中|
|性能|LBAC开关关闭，对性能场景测试的影响|benchmarksql 压测|否|否|----|
|  
|LBAC开关打开，策略关联的用户、表均不涉及测试场景的情况下，对性能场景测试的影响|benchmarksql 压测|否|否|----|
|  
|LBAC开关打开，策略关联的用户、表涉及测试场景的情况下，对性能场景测试的影响|benchmarksql 压测|否|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|可用性|恢复场景|----|否|否|----|
|可靠性|故障场景|----|否|否|----|
|可维可测|DFX功能1|----|否|否|----|
|  
|DFX功能2|----|否|否|----|
|安全|安全场景1|----|否|否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|版本升级|低版本升到3.2版本|否|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|周边配合|权限|新增了安全管理员LBACSYS，角色LBAC_DBA|否|是|  [YDBRD-22162](https://jira.yasdb.com/browse/YDBRD-22162?src=confmacro)    -  支持LBAC策略和标签能力  验证中|
|周边配合|审计|审计的内容包括：,配置LBAC策略行为的审计    
  LBAC的策略包括添加、删除标签，启用LBAC策略|否|是|  [YDBRD-22167](https://jira.yasdb.com/browse/YDBRD-22167?src=confmacro)    -  支持LBAC策略的审计能力  开发中|
|周边配合|导入导出工具|EXP/IMP支持LBAC策略|否|是|  [YDBRD-22168](https://jira.yasdb.com/browse/YDBRD-22168?src=confmacro)    -  支持LBAC策略的导入导出能力  开发中|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|LBAC|Label-Based Access Control 即行级访问控制|是|--|
|YLS|YashanDB Label Security 即崖山数标签安全|是|Oracle的OLS|
|标签|用户创建的有level, compartment, group组成的字符串|是|--|
|标记|标签的同义词，即用户创建的有level, compartment, group组成的字符串|是|--|
|范围|指策略的组件compartment|是|--|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

  


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

  


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支描述|----|否|
|函数|参数/返回值描述|----|是|
|  
|CHAR_TO_LABEL|标签值转为标签内容字符串|是|
|  
|LABEL_TO_CHAR|标签内容字符串转为标签值|是|
|  
|LBACSYS.LBAC$SA_LABELS.FROM_LABEL|标签值字符串转为标签内容字符串|是|
|高级包|高级包子对象描述|----|是|
|  
|YLS_ENFORCEMENT.ENABLE_YLS，,YLS_ENFORCEMENT.DISABLE_YLS|YLS状态设置|是|
|  
|SA_SYSDBA.CREATE_POLICY,,SA_SYSDBA.DROP_POLICY,|策略创建、删除|是|
|  
|SA_COMPONENTS.CREATE_LEVEL,,SA_COMPONENTS.DROP_LEVEL,,SA_COMPONENTS.CREATE_COMPARTMENT,,SA_COMPONENTS.DROP_COMPARTMENT,|level创建、删除；,compartment创建、删除|是|
|  
|SA_LABEL_ADMIN.CREATE_LABEL,,SA_LABEL_ADMIN.DROP_LABEL|label创建、删除|是|
|  
|SA_POLICY_ADMIN.APPLY_TABLE_POLICY,,SA_POLICY_ADMIN.REMOVE_TABLE_POLICY|表关联策略、表移除策略|是|
|  
|SA_USER_ADMIN.SET_USER_LABELS,,SA_USER_ADMIN.DROP_USER_ACCESS|用户关联策略、用户移除策略|是|
|系统视图|视图域段描述|----|是|
|  
|DBA_YLS_STATUS|查看开关状态|是|
|  
|DBA_SA_POLICIES|查看创建的安全策略|是|
|  
|DBA_SA_LEVELS|查看安全策略的级别|是|
|  
|DBA_SA_COMPARTMENTS|查看安全策略的范围|是|
|  
|DBA_SA_LABELS|查看创建的标签|是|
|  
|DBA_SA_TABLE_POLICIES|查看表关联的安全策略|是|
|  
|DBA_SA_USER_LABELS|查看用户关联的标签|是|
|动态视图|视图域段描述|----|否|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

  


**约束**

（1）  只支持上面所列出的具体功能，LBAC对照Oracle 功能，没列出来的均不支持，如group组件，对用户赋特权等。

（2）一个表只允许关联1个安全策略。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 YLS开关状态设置](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

**场景描述**

YLS开关设置，LBAC 在开关为打开时才会起作用。

语法格式

```
EXEC LBACSYS.YLS_ENFORCEMENT.ENABLE_YLS;
EXEC LBACSYS.YLS_ENFORCEMENT.DISABLE_YLS;
```

**静态组织结构**

  


  


###   [4.2 策略](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

*场景描述：创建、删除安全策略*

  


###   [4.3 level](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

*场景描述：创建、删除level*

###   [4.4 compartment](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

*场景描述：创建、删除compartment*

###   [4.5 label](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

*场景描述：创建、删除label*

  


###   [4.6 表和策略](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

*场景描述：表关联策略、表移除策略*

  


###   [4.7 用户和策略](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

*场景描述：用户关联策略、用户移除策略*

  


###   [4.8 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

YLS关闭的情况下，对性能影响；

YLS开启的情况下，不涉及策略的表和用户，对性能影响；

YLS开启的情况下，涉及策略的表和用户，对性能影响；

###   [4.9 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

无

###   [4.10 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

无

###   [4.10 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

审计、

导出导入

  


##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

（1）支持特权、

（2）对用户支持session级参数的设置

（3）对表关联策略支持设置  PREDICATE、FUNCTION。

  


  


  
