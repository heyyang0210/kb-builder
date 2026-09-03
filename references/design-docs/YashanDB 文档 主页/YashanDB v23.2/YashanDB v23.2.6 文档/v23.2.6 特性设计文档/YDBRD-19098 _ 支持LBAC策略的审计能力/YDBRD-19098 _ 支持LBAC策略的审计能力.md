Created by 王林, last modified on 十月 18, 2024

SR: YDBRD-19098     [支持LBAC策略的审计能力 ](https://pingcode.yasdb.com/pjm/items/661155b3579a3edb84d6885c)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

YashanDB Label Security，通过Label-Based Access Control （简称LBAC）一种基于行标签的访问控制，实现了基于策略对数据库中的表提供行级安全控制功能。

在用户进行行访问控制设置时，通过审计记录相应的操作行为，保证用户操作行为的可追溯，维护数据库的安全。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

EAL4测评中，需要对用户执行的行访问控制操作进行审计记录。  对行访问控制进行审计，也是完善对用户操作行为审计所需要的。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [调研文档 --  YDBRD-19098 支持LBAC策略的审计能力 ](https://conf.yasdb.com/pages/viewpage.action?pageId=153023795)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|需求调研|关键技术点|特性是否涉及|逆向工程|
|:---|:---|:---|:---|:---|:---|
|功能|子功能1|对创建、删除安全策略的审计。|否|是|否|
|  
|子功能2|对创建、删除组件的审计：包含创建和删除等级，创建和删除范围。|否|是|否|
|  
|子功能3|对创建、删除标签的审计|否|是|否|
|  
|子功能4|对表关联策略、取消关联策略的审计|否|是|否|
|  
|子功能5|对用户关联策略、取消关联策略的审计|否|是|否|
|  
|子功能6|审计记录中增加执行语句使用的安全策略。|否|是|否|
|性能|性能场景1|判断语句中是否涉及安全策略，会产生微影响。|否|是|否|
|可用性|恢复场景|----|否|否|否|
|可靠性|故障场景|----|否|否|否|
|可维可测|DFX功能1|----|否|否|否|
|  
|DFX功能2|----|否|否|否|
|安全|安全场景1|----|否|否|否|
|易用性|----|----|否|否|否|
|可修改性|----|----|否|否|否|
|兼容性|----|----|否|否|否|


  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|YLS|YaShanDB Label Security,YaShanDB   基于数据标签和会话标签执行数据访问控制|无|无|


  


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

  


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

### 3.1 规格

新增审计项

|审计项|描述|对应语句|与Oracle不同点|
|:---|:---|:---|---|
|LBAC STATUS|lbac 开或关|yls_enforcement.enable_yls,yls_enforcement.disable_yls|oracle 执行 lbacsys.ols_enforcement.disable_ols 或  lbacsys.ols_enforcement.enable_ols 不写审计记录。|
|CREATE POLICY|创建安全策略|sa_sysdba.create_policy|无|
|DROP POLICY|删除安全策略|sa_sysdba.drop_policy|无|
|CREATE LABEL COMPONENTS|创建组件|sa_components.create_level，,sa_components.create_compartment |无|
|DROP LABEL COMPONENTS|删除组件|sa_components.drop_level，,sa_components.drop_compartment |无|
|CREATE DATA LABEL|创建标签|sa_label_admin.create_label   |若非USER/DATA LABEL属性的标签，则不写审计记录；|
|DROP DATA LABEL|删除标签|sa_label_admin.drop_label|若非USER/DATA LABEL属性的标签，则不写审计记录|
|APPLY POLICY|表关联安全策略|sa_policy_admin.apply_table_policy|无|
|REMOVE POLICY|表取消关联安全策略|sa_policy_admin.remove_table_policy|无|
|SET AUTHORIZATION|用户关联安全策略|sa_user_admin.set_user_labels|无|
|DROP AUTHORIZATION |用户取消关联安全策略|sa_user_admin.drop_user_access|Oracle 无此审计项，也不会写审计记录。|


  


审计记录系统表SYS.AUD$UNIFIED新增列

|列名|类型|描述|涉及的场景|Oracle 中字段名称和类型|
|:---|:---|:---|---|---|
|YLS_POLICY_NAME|VARCHAR(64)|安全策略名|（1）创建安全策略,（2）删除安全策略,（3）其它LBAC操作都需要写明涉及的安全策略。|OLS_POLICY_NAME,VARCHAR2(128)|
|YLS_STRING_LABEL|VARCHAR(4000)|标签的字符串内容|（1）创建标签,（2）删除标签,（3）用户关联安全策略时可能需要创建标签,（4）用户删除安全策略时，可能需要删除该策略下的标签|OLS_STRING_LABEL,VARCHAR2(4000)|
|YLS_LABEL_COMPONENT_TYPE|VARCHAR(12)|组件属性，内容为“LEVEL", "COMPARTMENT"， ”GROUP“|（1）创建level、删除level,（2）创建compartment, 删除compartment|OLS_LABEL_COMPONENT_TYPE,VARCHAR2(12)|
|YLS_LABEL_COMPONENT_NAME|VARCHAR(64)|组件名|（1）创建level、删除level,（2）创建compartment, 删除compartment|OLS_LABEL_COMPONENT_NAME,VARCHAR2(30)|
|YLS_GRANTEE|VARCHAR(64)|关联安全策略的用户名, 对应用户关联安全策略操作|（1）用户关联安全策略,（2）用户取消关联安全策略|OLS_GRANTEE,VARCHAR2(128)|
|YLS_MAX_READ_LABEL|VARCHAR(4000)|最大读，  对应用户关联安全策略操作|（1）用户关联安全策略|OLS_MAX_READ_LABEL,VARCHAR2(4000)|
|YLS_MAX_WRITE_LABEL|VARCHAR(4000)|最大写，  对应用户关联安全策略操作|（1）用户关联安全策略|OLS_MAX_WRITE_LABEL,VARCHAR2(4000)|
|YLS_MIN_WRITE_LABEL|VARCHAR(64)|最小写，  对应用户关联安全策略操作|（1）用户关联安全策略|OLS_MIN_WRITE_LABEL,VARCHAR2(4000)|
|RLS_INFO|CLOB|表关联的LBAC策略名称，若多个则用‘，’隔开|执行查询等SQL涉及关联安全策略的表，在LBAC开关打开的情况下，需要将表上挂的安全策略信息都写到该字段。|RLS_INFO CLOB,  
|


  


说明：

（1）创建删除标签时，不区分标签是否为USER/DATA LABEL, 在对应审计项  CREATE DATA LABEL、DROP DATA LABEL， 都会写审计记录。

（2）删除策略时，会关联移除用户关联标签、表关联标签、策略下的标签、范围、等级，均会分别判断是否符合审计，若符合会写审计记录。

（4）有关行访问控制的审计项类型，作为 ”STANDARD ACTION“， 不同于Oracle 细分为 ”OLS ACTION“。

### 3.2 约束

无

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

对行访问控制进行审计，在当前已有审计的系统表结构及审计项，需要对审计记录表新增多列、新增多个审计项。

- lbac enable,disable 设置， 对应审计项 LBAC STATUS
- 创建安全策略，对应审计项 CREATE POLICY
- 删除安全策略，对应审计项 DROP POLICY
- 创建等级，对应审计项   CREATE LABEL COMPONENTS
- 删除等级，对应审计项   DROP LABEL COMPONENTS
- 创建范围，对应审计项   CREATE LABEL COMPONENTS
- 删除范围，对应审计项   DROP LABEL COMPONENTS
- 创建标签，对应审计项   CREATE DATA LABEL
- 删除标签，对应审计项   DROP DATA LABEL
- 表关联策略，对应审计项   APPLY POLICY
- 表取消关联策略，对应审计项   REMOVE POLICY
- 用户关联策略，对应审计项   SET AUTHORIZATION
- 用户取消关联策略，对应审计项   DROP AUTHORIZATION


### 4.1 LBAC 设置开关状态的审计

包含lbac开启的审计、lbac关闭的审计。

#### 4.11 lbac开启的审计

审计项：LBAC STATUS

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|OBJECT_NAME|“ENABLE”|


#### 4.12  lbac关闭的审计

审计项：LBAC STATUS

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|OBJECT_NAME|“DISABLE”|


###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    创建删除安全策略的审计

包含安全策略的创建的审计、安全策略删除的审计。

#### 4.2.1 创建安全策略的审计

审计项：CREATE POLICY

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|OBJECT_SCHEMA|安全策略的拥有者，为'SYS’|
|YLS_POLICY_NAME|安全策略名|


  


涉及的语句：     sa_sysdba.create_policy

#### 4.2.2 删除安全策略的审计

审计项：DROP POLICY

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|OBJECT_SCHEMA|安全策略的拥有者，为'SYS’|
|YLS_POLICY_NAME|安全策略名|


  


涉及的语句：     sa_sysdba.drop_policy

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    创建删除等级的审计

包含等级的创建的审计、等级的删除的审计。

#### 4.3.1 创建等级的审计

审计项：  CREATE LABEL COMPONENTS

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|OBJECT_SCHEMA|等级的拥有者，为'SYS’|
|YLS_LABEL_COMPONENT_TYPE|组件类型：值为”LEVEL“|
|YLS_LABEL_COMPONENT_NAME|等级名|


  


涉及的语句：   sa_components.create_level

#### 4.3.2 删除等级的审计

审计项：DROP   LABEL COMPONENTS

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|OBJECT_SCHEMA|等级的拥有者，为'SYS’|
|YLS_LABEL_COMPONENT_TYPE|组件类型：值为”LEVEL“|
|YLS_LABEL_COMPONENT_NAME|等级名|


  


涉及的语句：   sa_components.drop_level

###   [4.4 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    创建删除范围的审计

包含范围的创建的审计、范围的删除的审计。

#### 4.4.1 创建范围的审计

审计项：  CREATE LABEL COMPONENTS

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|OBJECT_SCHEMA|范围的拥有者，为'SYS’|
|YLS_LABEL_COMPONENT_TYPE|组件类型：值为”COMPARTMENT“|
|YLS_LABEL_COMPONENT_NAME|范围名|


  


涉及的语句：   sa_components.create_comartment

#### 4.4.2 删除范围的审计

审计项：DROP   LABEL COMPONENTS

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|OBJECT_SCHEMA|范围的拥有者，为'SYS’|
|YLS_LABEL_COMPONENT_TYPE|组件类型：值为”COMPARTMENT“|
|YLS_LABEL_COMPONENT_NAME|范围名|


涉及的语句：   sa_components.drop_comartment

  


###   [4.5 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    创建删除标签的审计

包含标签的创建的审计、范围的删除的审计。

#### 4.5.1 创建标签的审计

审计项：  CREATE DATA LABEL

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|YLS_STRING_LABEL|标签的字符串内容|


涉及的语句：   sa_label_admin.create_label

可能自动创建标签的场景：char_to_label，登录时自动创建标签、用户关联安全策略

  


#### 4.5.2 删除标签的审计

审计项：DROP   DATA LABEL

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|YLS_STRING_LABEL|标签的字符串内容|


涉及的语句：sa_label_admin.drop_label

  


### 4.6 表关联安全策略的审计

包括表关联安全策略的审计、表取消关联安全策略的审计。

#### 4.6.1 表关联安全策略的审计

审计项：  APPLY POLICY

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|OBJECT_SCHEMA|表所属的用户|
|OBJECT_NAME|表名|


  


涉及的语句：  sa_policy_admin.apply_table_policy

  


#### 4.6.2 表取消关联安全策略的审计

  


审计项：REMOVE   POLICY

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|OBJECT_SCHEMA|表所属的用户|
|OBJECT_NAME|表名|


  


涉及的语句：  sa_policy_admin.remove_table_policy

  


### 4.7 用户关联安全策略的审计

包含用户关联安全策略的审计、用户取消关联安全策略的审计。

#### 4.71. 用户关联安全策略的审计

审计项：  SET AUTHORIZATION

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|YLS_GRANTEE |用户名   |
|YLS_MAX_READ_LABEL|最大读|
|YLS_MAX_WRITE_LABEL|最大写|
|YLS_MIN_WRITE_LABEL|最小写|
|YLS_STRING_LABEL|为USER/DATA LABEL 标签属性的标签内容|


  


涉及的语句：sa_user_admin.set_user_labels

#### 4.72. 用户取消关联安全策略的审计

审计项：DROP   AUTHORIZATION

审计记录视图中主要字段：

|字段名|描述|
|---|---|
|YLS_POLICY_NAME|安全策略名|
|YLS_GRANTEE |用户名 |
|YLS_MAX_READ_LABEL|最大读|
|YLS_MAX_WRITE_LABEL|最大写|
|YLS_MIN_WRITE_LABEL|最小写|
|YLS_STRING_LABEL|为USER/DATA LABEL 标签属性的标签内容|


  


涉及的语句：sa_user_admin.drop_user_access

  


### 4.8 执行语句涉及关联安全策略的表

若审计记录的对象是关联安全策略的表，则在R  LS_INFO中记录该表关联的安全策略名，若关联多个则用‘，’隔开。若LBAC 开关关闭，则 RLS_INFO内容为NULL。

###   [4.9 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

无

###   [4.10 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

无

###   [4.11 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

无

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

补充 视图 UNIFIED_AUDIT_TRAIL 定义的列。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

完善YLS 基础功能后，需要添加对应功能的审计能力。

  


  


  


  


  


  


  


  


  


## Comments:

|  [](null)  ,2024.09.04 设计方案评审：,评审意见：,（1）审计记录系统表新增字段同Oracle 对齐， 同Oracle 有差异的点需要说明清楚。,      :: 已更新设计文档,Posted by wanglin at 九月 04, 2024 18:56|
|---|
