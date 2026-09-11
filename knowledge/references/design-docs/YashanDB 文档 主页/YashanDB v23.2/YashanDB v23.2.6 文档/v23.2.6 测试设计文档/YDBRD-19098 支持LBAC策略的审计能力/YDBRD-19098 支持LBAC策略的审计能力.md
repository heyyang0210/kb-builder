Created by 韩晓盼, last modified on 九月 23, 2024

IR：    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b30f](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b30f)    ?    
  #YASHAN-959 支持LBAC强制访问控制

SR：    [https://pingcode.yasdb.com/pjm/items/661155b3579a3edb84d6885c](https://pingcode.yasdb.com/pjm/items/661155b3579a3edb84d6885c)    ?    
  #YDBRD-19098 支持LBAC策略的审计能力

# 1.   **概述**

本需求设计范围是支持LBAC策略的审计能力。

# 2.   **需求分析**

**1、LBAC**

- **定义**


YashanDB Label Security，通过Label-Based Access Control （简称LBAC）一种基于行标签的访问控制，实现了基于策略对数据库中的表提供行级安全控制功能。

- **目前YaShanDB支持能力**


1、创建删除策略：CREATE POLICY、CREATE POLICY

2、创建删除组件：  CREATE LEVEL、CREATE COMPARTMENT、DROP LEVEL、DROP COMPARTMENT

3、创建删除标签：CREATE LABEL、DROP LABEL

4、表关联取消策略：APPLY TABLE POLICY、REMOVE TABLE POLICY

5、用户关联取消策略：SET USER LABELS、DROP USER ACCESS

6、LBAC开关打开关闭：ENABLE、DISABLE

  


**2、需求来源**

需求来源：    
  EAL4测评    
    
  场 景：    
  1、  需要对用户执行的行访问控制操作进行审计记录。  对行访问控制进行审计，也是完善对用户操作行为审计所需要的    
    
  需求描述：    
  支持LBAC策略的审计能力    
    
  需求范围：    
  1、单机    
  2、行表

  


**3、功能分析**

支持LBAC的审计能力。

1）YaShanDB与Oracle支持  **审计事件**  差异对比：

|序号|Oracle支持的审计事件|描述|YashanDB支持的审计事件|描述|备注|
|---|---|---|---|---|---|
|1|/|/|  `LBAC STATUS`  |lbac 开或关,yls_enforcement.enable_yls,yls_enforcement.disable_yls|**与oracle差异：**,Oracle 无此审计项，也不会写审计记录|
|2|  `CREATE POLICY`  |  `SA_SYSDBA.CREATE_POLICY`       创建 Oracle Label Security 策略|  `CREATE POLICY`  |创建安全策略,sa_sysdba.create_policy|同Oracle|
|3|  `ALTER POLICY`  |  `SA_SYSDBA.ALTER_POLICY`       更改 Oracle Label Security 策略|/|/|/|
|4|  `DROP POLICY`  |  `SA_SYSDBA.DROP_POLICY`       删除 Oracle Label Security 策略|  `DROP POLICY`  |删除安全策略,sa_sysdba.drop_policy|同Oracle|
|5|  `APPLY POLICY`  |通过过程应用表策略或通过过程       `SA_POLICY_ADMIN.APPLY_TABLE_POLICY`    应用架构策略    `SA_POLICY_ADMIN.APPLY_SCHEMA_POLICY`  |  `APPLY POLICY`  |表关联安全策略,sa_policy_admin.apply_table_policy|同Oracle|
|6|  `REMOVE POLICY`  |通过过程删除表策略或通过过程 删除    `SA_POLICY_ADMIN.REMOVE_TABLE_POLICY`    架构策略    `SA_POLICY_ADMIN.REMOVE_SCHEMA_POLICY`  |  `REMOVE POLICY`  |表取消关联安全策略,sa_policy_admin.remove_table_policy|同Oracle|
|7|  `SET AUTHORIZATION`  |涵盖所有 Oracle Label Security 授权，包括 Oracle Label Security 权限和用户标签（无论是用户还是受信任的存储过程）。与事件相对应的 PL/SQL 过程    `SET AUTHORIZATION`    是    `SA_USER_ADMIN.SET_USER_LABELS`    、    `SA_USER_ADMIN.SET_USER_PRIVS`    和    `SA_USER_ADMIN.SET_PROG_PRIVS`    。|  `SET AUTHORIZATION`  |用户关联安全策略,sa_user_admin.set_user_labels|同Oracle|
|8|/|/|  `DROP AUTHORIZATION`  |用户取消关联安全策略,sa_user_admin.drop_user_access|**与oracle差异：**,Oracle 无此审计项，也不会写审计记录|
|9|  `PRIVILEGED ACTION`  |涵盖需要用户拥有 Oracle Label Security 权限的任何操作。这些操作包括登录、    `SA_SESSION.SET_ACCESS_PROFILE`    执行和调用受信任的存储过程。|/|/|/|
|10|  `ENABLE POLICY`  |通过以下程序启用 Oracle Label Security 策略：,-   `SA_SYSDBA.ENABLE_POLICY`    ：对受策略保护的表和架构实施访问控制
-   `SA_POLICY_ADMIN.ENABLE_TABLE_POLICY`    ：为指定表启用 Oracle 标签安全策略
-   `SA_POLICY_ADMIN.ENABLE_SCHEMA_POLICY`    ：为指定模式中的所有表启用 Oracle 标签安全策略
|/|/|/|
|11|  `DISABLE POLICY`  |通过以下步骤禁用 Oracle Label Security 策略：,-   `SA_SYSDBA.DISABLE_POLICY`    ：禁用 Oracle Label Security 策略的执行
-   `SA_POLICY_ADMIN.DISABLE_TABLE_POLICY`    ：禁用针对指定表的 Oracle 标签安全策略的执行
-   `SA_POLICY_ADMIN.DISABLE_SCHEMA_POLICY`    ：禁用针对指定架构中的所有表实施 Oracle 标签安全策略
|/|/|/|
|12|  `SUBSCRIBE OID`  |  `SA_POLICY_ADMIN.POLICY_SUBSCRIBE`    通过以下程序     订阅支持 Oracle Internet Directory 的 Oracle Label Security 策略|/|/|/|
|13|  `UNSUBSCRIBE OID`  |  `SA_POLICY_ADMIN.POLICY_UNSUBSCRIBE`    通过以下程序     取消订阅支持 Oracle Internet Directory 的 Oracle Label Security 策略|/|/|/|
|14|  `CREATE DATA LABEL`  |通过过程创建 Oracle Label Security 数据标签    `SA_LABEL_ADMIN.CREATE_LABEL`    。    `CREATE DATA LABEL`    也对应于    `LBACSYS.TO_DATA_LABEL`    函数。|  `CREATE DATA LABEL`  |创建标签,sa_label_admin.create_label   ,可能自动创建标签的场景：char_to_label，登录时自动创建标签、  用户关联安全策略|**与oracle差异：**,若非USER/DATA LABEL属性的标签，则不写审计记录；,可能自动创建标签的场景：char_to_label、登录时自动创建标签、  用户关联安全策略， 都没写审计记录|
|15|  `ALTER DATA LABEL`  |  `SA_LABEL_ADMIN.ALTER_LABEL`       更改 Oracle Label Security 数据标签|/|/|/|
|16|  `DROP DATA LABEL`  |  `SA_LABEL_ADMIN.DROP_LABEL`       删除 Oracle Label Security 数据标签|  `DROP DATA LABEL`  |删除标签,sa_label_admin.drop_label|**与oracle差异：**,若非USER/DATA LABEL属性的标签，则不写审计记录|
|17|  `CREATE LABEL COMPONENT`  |通过以下步骤创建 Oracle Label Security 组件：,- 级别：       `SA_COMPONENTS.CREATE_LEVEL`  
- 隔间：       `SA_COMPONENTS.CREATE_COMPARTMENT`  
- 群组：       `SA_COMPONENTS.CREATE_GROUP`  
|  `CREATE LABEL COMPONENT`  |创建组件,sa_components.create_level，,sa_components.create_compartment |同Oracle|
|18|  `ALTER LABEL COMPONENTS`  |通过以下步骤更改 Oracle Label Security 组件：,- 级别：       `SA_COMPONENTS.ALTER_LEVEL`  
- 隔间：       `SA_COMPONENTS.ALTER_COMPARTMENT`  
- 团体：       `SA_COMPONENTS.ALTER_GROUP`    和    `SA_COMPONENTS.ALTER_GROUP_PARENT`  
|/|/|/|
|19|  `DROP LABEL COMPONENTS`  |通过以下步骤删除 Oracle Label Security 组件：,- 级别：       `SA_COMPONENTS.DROP_LEVEL`  
- 隔间：       `SA_COMPONENTS.DROP_COMPARTMENT`  
- 群组：       `SA_COMPONENTS.DROP_GROUP`  
|  `DROP LABEL COMPONENTS`  |删除组件,sa_components.drop_level，,sa_components.drop_compartment |同Oracle|
|20|  `ALL`  |支持审计所有 Oracle Label Security 操作|/|/|/|


2）YaShanDB与Oracle支持  **审计表**  差异对比：

|序号|Oracle审计表字段名|字段类型|描述|YaShanDB审计表字段名|字段类型|描述|涉及场景|备注|
|---|---|---|---|---|---|---|---|---|
||**UNIFIED_AUDIT_TRAIL**|||SYS.AUD$UNIFIED新增列|||||
|1|OLS_POLICY_NAME|VARCHAR2(128)|安全策略名|YLS_POLICY_NAME|VARCHAR(4000)    
  varchar(64)|安全策略名|（1）创建安全策略,（2）删除安全策略,（3）其它LBAC操作都需要写明涉及的安全策略。|/|
|2|OLS_STRING_LABEL|VARCHAR2(4000)|USER/DATA LABEL属性的标签的字符串内容|YLS_STRING_LABEL|VARCHAR(4000)|标签的字符串内容|（1）创建标签,（2）删除标签,（3）用户关联安全策略时可能需要创建标签,（4）用户删除安全策略时，可能需要删除该策略下的标签|/|
|3|OLS_LABEL_COMPONENT_TYPE|VARCHAR2(12)|组件属性，内容为“LEVEL", "COMPARTMENT"， ”GROUP“|YLS_LABEL_COMPONENT_TYPE|VARCHAR(12)|组件属性，内容为“LEVEL", "COMPARTMENT"， ”GROUP“|（1）创建level、删除level,（2）创建compartment, 删除compartment|/|
|4|OLS_LABEL_COMPONENT_NAME|VARCHAR2(30)|组件名|YLS_LABEL_COMPONENT_NAME|VARCHAR(64)|组件名|（1）创建level、删除level,（2）创建compartment, 删除compartment|/|
|5|OLS_GRANTEE|VARCHAR2(128)|关联安全策略的用户名, 对应用户关联安全策略操作|YLS_GRANTEE|VARCHAR(64)|关联安全策略的用户名, 对应用户关联安全策略操作|（1）用户关联安全策略,（2）用户取消关联安全策略|/|
|6|OLS_MAX_READ_LABEL|VARCHAR2(4000)|最大读，  对应用户关联安全策略操作|YLS_MAX_READ_LABEL|VARCHAR(4000)|最大读，  对应用户关联安全策略操作|（1）用户关联安全策略|/|
|7|OLS_MAX_WRITE_LABEL|VARCHAR2(4000)|最大写，  对应用户关联安全策略操作|YLS_MAX_WRITE_LABEL|VARCHAR(4000)|最大写，  对应用户关联安全策略操作|（1）用户关联安全策略|/|
|8|OLS_MIN_WRITE_LABEL|VARCHAR2(4000)|最小写，  对应用户关联安全策略操作|YLS_MIN_WRITE_LABEL|VARCHAR(64)|最小写，  对应用户关联安全策略操作|（1）用户关联安全策略|/|
|9|RLS_INFO|CLOB|Stores virtual private database (VPD), Oracle Label Security (OLS), Real Application Security (RAS), and redaction policy names and predicates separated by a delimiter. In the case of redaction policies, the policy expression is displayed in place of the predicate.,To format the output into individual rows, use the       `DBMS_AUDIT_UTIL.DECODE_RLS_INFO_ATRAIL_UNI`       function. （参考    [Oracle  unified_audit_trail 视图定义](https://docs.oracle.com/en/database/oracle/oracle-database/21/refrn/UNIFIED_AUDIT_TRAIL.html)    ）|RLS_INFO|CLOB|表关联的LBAC策略名称，若多个则用‘，’隔开|执行查询等SQL涉及关联安全策略的表，在LBAC开关打开的情况下，需要将表上挂的安全策略信息都写到该字段。|/|


说明：

（1）创建删除标签时，不区分标签是否为USER/DATA LABEL, 在对应审计项  CREATE DATA LABEL、DROP DATA LABEL， 都会写审计记录。

（2）删除策略时，会关联移除用户关联标签、表关联标签、策略下的标签、范围、等级，均会分别判断是否符合审计，若符合会写审计记录。

（3）有关行访问控制的审计项类型，作为 ”STANDARD ACTION“， 不同于Oracle 细分为 ”OLS ACTION“。

  


3）目前  AUD$UNIFIED审计表  现存字段

![](https://pingcode.yasdb.com/atlas/files/public/67396de0a1ad9a3311dc9411/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI3NjcsImV4cCI6MTc4MjMyMzU2N30.02XvKLuG3yiTChrudyLPzEUfXN0W1zOufWbqkB3TzVo)

|字段|字段类型|描述|备注|
|---|---|---|---|
|SESSIONID|BIGINT|会话ID|  
|
|OS_USER|VARCHAR(128)|操作系统用户名|  
|
|HOST_NAME|VARCHAR(128)|主机用户名|  
|
|INSTANCE_ID|SMALLINT|实例ID|  
|
|DBID|INTEGER|数据库ID|  
|
|AUTHENTICATION_TYPE|VARCHAR(256)|认证类型|  
|
|USERID|VARCHAR(128)|用户ID|  
|
|CLIENT_PROGRAM_NAME|VARCHAR(84)|客户端程序名|  
|
|STATEMENT_ID|BIGINT|statement ID|  
|
|EVENT_TIMESTAMP|TIMESTAMP|事件发生的时间|  
|
|ACTION|INTEGER|审计类型|  
|
|RETURN_CODE|INTEGER|返回码|  
|
|THREAD_ID|BIGINT|线程ID|  
|
|SCN|BIGINT|系统更改序号|  
|
|SQL_TEXT|CLOB|原始SQL|  
|
|CURRENT_USER|VARCHAR(128)|当前用户|  
|
|UNIFIED_AUDIT_POLICIES|VARCHAR(4000)|审计策略|  
|
|NODE_NAME|VARCHAR(68)|物理节点名称，单机记为"unknown"|  
|
|OBJ_OWNER|VARCHAR(68)|对象拥有者|  
|
|OBJ_NAME|VARCHAR(68)|对象名|审计项：  LBAC STATUS     描述：“ENABLE”，“DISABLE”|
|SYSTEM_PRIVILEGE_USED|VARCHAR(1024)|权限列|  
|
|SQL_BINDS|VARCHAR(4000)|绑定参数|  
|
|TRANSACTION_ID|BIGINT|事务ID|  
|
|ROLE|VARCHAR(64)|登录用户角色类型|  
|


目前UNIFIED_AUDIT_TRAIL  审计视图  现存字段

![](https://pingcode.yasdb.com/atlas/files/public/67396de08970c2af4f52159f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQ0FBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI3NjcsImV4cCI6MTc4MjMyMzU2N30.02XvKLuG3yiTChrudyLPzEUfXN0W1zOufWbqkB3TzVo)

参考：    [YDBRD-19098 支持LBAC策略的审计能力调研文档 - 刘晓旋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153024088)  

  [特性调研-YDBRD-19098：支持LBAC策略的审计能力 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=163019005)  

  [详细设计-YDBRD-19098 : 支持LBAC策略的审计能力 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=163019016)  

# 3.   **测试设计方法**

使用边界值，等价类，场景分析等测试方法。

如XXX测试中使用了边界值测试，XXX测试使用了等价类测试，XXX测试使用了场景分析法。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点

1、功能测试

新增字段基本测试：

|测试点|测试场景|有效类|无效类|备注|
|---|---|---|---|---|
|审计表/视图新增字段|字段名称|YLS_POLICY_NAMES、YLS_STRING_LABEL、...|与上述2.3节描述不一致|desc查看  SYS.AUD$UNIFIED新增列,desc查看sys.UNIFIED_AUDIT_TRAIL新增列|
|  
|字段类型大小|VARCHAR(64)...|与上述2.3节描述不一致|  
|
|  
|字段新增个数|8列|其他|  
|
|  
|新增字段无法更改|dml操作报错|不报错|  
|


新增字段值测试：

|测试点|测试场景|有效类|无效类|涉及审计项|涉及字段（描述）|备注|
|---|---|---|---|---|---|---|
|LBAC开关|1、打开开关,2、重复打开|成功，会审计|失败，不会审计|LBAC STATUS|1、OBJ_NAME（“ENABLE”）|  
|
|  
|1、关闭开关,2、重复关闭|成功，会审计|失败，不会审计|LBAC STATUS|1、OBJ_NAME（“DISABLE”）|  
|
|策略相关|创建策略,create_policy|成功，会审计|失败，会审计,1、入参个数不对，报错 CALL SA_SYSDBA.CREATE_POLICY ()，不会审计;,2、入参类型不对，可以审计 ,3、重复创建同名策略，可|CREATE POLICY|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAME（'P1'）,3、RLS_INFO为空|创建策略名为|
|  
|删除策略,drop_policy|成功，会审计|失败,1、删除不存在的策略（重复删），可以审计,2、删除策略语法不对（入参个数（不），入参类型（可））|DROP POLICY|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAME（'P1'）|  
|
|等级相关|创建组件等级,create_level|成功，会审计,  
|失败,1、创建时，使用不存在的策略，会审计,2、创建语法不对,3、重复创建等级（error code）|CREATE LABEL COMPONENTS|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAME（'P1'）,3、  YLS_LABEL_COMPONENT_TYPE（”LEVEL“）,4、  YLS_LABEL_COMPONENT_NAME（'L1'）|  
|
|  
|删除组件等级,drop_level|成功，会审计,  
|失败,1、删除时，使用不存在的等级（重复删）,2、删除语法不对|DROP   LABEL COMPONENTS|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAME（'P1'）,3、  YLS_LABEL_COMPONENT_TYPE（”LEVEL“）,4、  YLS_LABEL_COMPONENT_NAME（'L1'）|  
|
|范围相关|创建组件范围,create_compartment|成功，会审计|失败,1、创建时，使用不存在的策略,2、创建语法不对|CREATE LABEL COMPONENTS|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAME（'P1'）,3、  YLS_LABEL_COMPONENT_TYPE（”COMPARTMENT“）,4、  YLS_LABEL_COMPONENT_NAME（'C1'）|  
|
|  
|删除组件范围,drop_compartment |成功，会审计|失败,1、删除时，使用不存在的等级（重复删）,2、删除语法不对|DROP   LABEL COMPONENTS|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAME（'P1'）,3、  YLS_LABEL_COMPONENT_TYPE（”COMPARTMENT“）,4、  YLS_LABEL_COMPONENT_NAME（'C1'）|  
|
|（数据）标签|创建标签,create_label   |成功，会审计,1、手动创建标签,2、自动：创建策略、level, compartment 后， 然后执行 select char_to_label('p1', ... 会自动创建label（不审计，与oracle一致）|失败,1、创建时，使用不存在的策略,2、创建语法不对,3、重复创建|CREATE DATA LABEL|1、OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAME（'P1'）,3、YLS_STRING_LABEL（'L1:C1'）|sys,非sys：dba+lbac_dba角色,普通用户：会审计|
|  
|删除标签,drop_label|成功，会审计|失败,1、删除时，使用不存在的等级（重复删）,2、删除语法不对|DROP   DATA LABEL|1、YLS_POLICY_NAME（'P1'）,2、YLS_STRING_LABEL（'L1:C1'）|  
|
|表与策略相关|表关联策略成功,apply_table_policy|成功，会审计|失败,1、创建时，使用不存在的策略/不存在表/用户,2、重复关联同一策略,3、再次关联不同策略（一个表只能挂一个策略）,4、创建语法不对|APPLY POLICY|1、  OBJ_OWNER（'U1'）,2、YLS_POLICY_NAME（'P1'）,3、OBJ_NAME（’T1‘）|  
|
|  
|表取消关联策略成功,remove_table_policy|成功，会审计|失败,1、取消时，使用不存在的等级（重复取消）,2、取消语法不对|REMOVE   POLICY|1、  OBJ_OWNER（'U1'）,2、YLS_POLICY_NAME（'P1'）,3、OBJ_NAME（’T1‘）|  
|
|用户标签相关|用户关联策略成功,set_user_labels|成功，会审计,（重复执行同一句，审计数据多一行）|失败,1、语法不对,2、不存在label，会审计,3、不存在的用户，会|SET AUTHORIZATION|1、  YLS_POLICY_NAME（’P1‘）,2、  YLS_GRANTEE （’user1‘）,3、  YLS_MAX_READ_LABEL,4、  YLS_MAX_WRITE_LABEL,5、  YLS_MIN_WRITE_LABEL,6、  YLS_STRING_LABEL（  'L1:C1'  ）|  
|
|  
|用户取消关联策略成功,drop_user_access|成功，会审计|失败,1、取消不存在的用户（重复取消）,2、语法不对|DROP   AUTHORIZATION|1、  YLS_POLICY_NAME（’P1‘）,2、  YLS_GRANTEE （’user1‘）,3、  YLS_MAX_READ_LABEL,4、  YLS_MAX_WRITE_LABEL,5、  YLS_MIN_WRITE_LABEL,6、  YLS_STRING_LABEL（  'L1:C1'  ）|  
|
|针对含LBAC策略表做DML操作|select单表|成功，会审计|/|SELECT ANY TABLE|1、RLS_INFO（策略名1，策略名2，。。）|权限审计|
|  
|select多表,1、带lbac策略+带策略表,2、带lbac策略+普通表|成功，两种表都会审计，带策略的，字段  YLS_POLICY_NAME会带策略名|/|SELECT ANY TABLE |1、RLS_INFO（策略名1，策略名2，。。）|权限审计|
|  
|insert 带策略表|成功，会审计,受策略原因，插入失败，会审计|/|INSERT ANY TABLE |1、RLS_INFO（策略名1，策略名2，。。）|权限审计|
|  
|update 带策略表|成功，会审计|/|UPDATE ANY TABLE |1、RLS_INFO（策略名1，策略名2，。。）|权限审计|
|  
|delete 带策略表|成功，会审计|/|DELETE ANY TABLE |1、RLS_INFO（策略名1，策略名2，。。）|权限审计|
|  
|  
|  
|  
|  
|  
|  
|
|  
|select单表|成功，会审计|/|SELECT ON T1|1、RLS_INFO（策略名1，策略名2，。。）|行为审计|
|  
|select多表,1、带lbac策略+带策略表,2、带lbac策略+普通表|成功，两种表都会审计，带策略的，字段  YLS_POLICY_NAME会带策略名,  
|/|SELECT ON T1|1、RLS_INFO（策略名1，策略名2，。。）|行为审计|
|  
|insert 带策略表|成功，会审计,受策略原因，插入失败，会审计？|/|INSERT ON T1|1、RLS_INFO（策略名1，策略名2，。。）|行为审计|
|  
|update 带策略表|成功，会审计|/|UPDATE ON T1 |1、RLS_INFO（策略名1，策略名2，。。）|行为审计|
|  
|delete 带策略表|成功，会审计|/|DELETE ON T1|1、RLS_INFO（策略名1，策略名2，。。）|行为审计|
|针对含LBAC策略表做DDL操作|drop 带策略表|成功，会审计？|/|DROP ANY TABLE ,  
|1、  OBJ_OWNER（'U1'）,2、YLS_POLICY_NAMES（'P1'）,3、OBJ_NAME（’T1‘）|权限审计|
|针对含LBAC用户|drop 用户（带标签）|成功，会审计？|/|DROP USER,  
|1、  YLS_POLICY_NAME（’P1‘）,2、  YLS_GRANTEE （’user1‘）,3、  YLS_MAX_READ_LABEL,4、  YLS_MAX_WRITE_LABEL,5、  YLS_MIN_WRITE_LABEL,6、  YLS_STRING_LABEL（  'L1:C1'  ）|权限审计|
|新增审计项测试|创建审计只包含LBAC审计项  CREATE POLICY（一项）|执行上述LBAC操作，审计表/视图只包含  CREATE POLICY相关的内容，其余项不会被审计|/|CREATE POLICY|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAMES（'P1'）|参考语句？？：,create audit policy up1 actions  ** **  **CREATE POLICY**  ;    
  audit policy up1;|
|  
|创建审计包含LBAC审计项  CREATE POLICY、DROP POLICY、LBAC STATUS（多项）|执行上述LBAC操作，审计表/视图只包含  CREATE POLICY、DROP POLICY、LBAC STATUS  相关的内容，其余项不会被审计|/|CREATE POLICY,DROP POLICY,LBAC STATUS|1、  OBJ_OWNER（'SYS'）,2、YLS_POLICY_NAMES（'P1'）,3、OBJ_NAME（“ENABLE”）、OBJ_NAME（“DIS  ABLE”）|参考语句？？：,create audit policy up1 actions  ** **  **CREATE POLICY, DROP POLICY, LBAC STATUS**  ;    
  audit policy up1;|
|  
|创建审计包含所有审计项|执行上述LBAC操作，审计表/视图会记录所有LBAC审计项|/|ALL|ALL|参考语句？？：,create audit policy up1 actions   **component=yls all, all on regress.t1**  ;（报错）    
  audit policy up1;|
|约束测试|一个语句涉及多表，每个表关联不同策略,（  策略名总长度（包含间隔符’,‘)>4000  ）|成功，会审计，且  超过4000字节在写审计记录到RLS_INFO会截断|/|SELECT ANY TABLE|1、  YLS_POLICY_NAME|没有限制|
|主备测试|在主节点上，执行以上可审计项，去备节点上查询审计表/视图,切主|执行成功，备节点上有审计数据|失败，不审计|以上LBAC审计项|审计表/视图相关字段|  
|
|审计开关测试|以上为打开审计开关测试|同上|同上|/|/|  
|
|  
|审计开关关闭|执行上述lbac相关操作，审计表不会新增数据|/|/|/|  
|
|  
|LBAC开关关闭|不审计|  
|  
|  
|  
|


2、性能测试

|场景|SQL语句|数据量|并发数|LBAC打开，审计开关打开|LBAC打开，审计开关关闭|结论|
|---|---|---|---|---|---|---|
|查策略表|select * from T1G;|1G|10|  
|  
|  
|
|  
|  
|  
|100|  
|  
|  
|
|  
|select * from T10G;|10G|10|  
|  
|  
|
|  
|  
|  
|100|  
|  
|  
|


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|是|
|可维护性|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2024-4-16_17-37-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGZhMWFkOWEzMzExZGM5NDBjIiwicmVmX2lkIjoiNjczOTZkZGY3MjgyMDZlZmI5MmYyNDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNzY3LCJleHAiOjE3ODIzOTkxNjd9.8ixnrwXonQ4YtV1sM9Ym1wkPtcYWKUthgd4n8-fklSg)

 (image/png)    


[image2024-4-16_17-43-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTA4OTcwYzJhZjRmNTIxNTliIiwicmVmX2lkIjoiNjczOTZkZGY3MjgyMDZlZmI5MmYyNDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNzY3LCJleHAiOjE3ODIzOTkxNjd9.3FYDwZ-3mtFqABsW5Ao3IJPVVg_e-99fank7VYe-DUI)

 (image/png)    


[image2024-4-16_17-44-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTA4OTcwYzJhZjRmNTIxNTljIiwicmVmX2lkIjoiNjczOTZkZGY3MjgyMDZlZmI5MmYyNDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNzY3LCJleHAiOjE3ODIzOTkxNjd9.d1OHj_oDR-4FsrbS5gkt15F-X4iN8AUnt0j5nbc-MI8)

 (image/png)    


[image2024-4-16_17-52-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTA4OTcwYzJhZjRmNTIxNTlkIiwicmVmX2lkIjoiNjczOTZkZGY3MjgyMDZlZmI5MmYyNDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNzY3LCJleHAiOjE3ODIzOTkxNjd9.EXKZrlbRtZvQ_LDX1LFZya_xdQbIVtC7W-HGplJreC0)

 (image/png)    


[image2024-5-14_14-28-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTA4OTcwYzJhZjRmNTIxNTllIiwicmVmX2lkIjoiNjczOTZkZGY3MjgyMDZlZmI5MmYyNDIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNzY3LCJleHAiOjE3ODIzOTkxNjd9.eCeamQ0tbe4c1UjT4bAzQN3vspOxhDBBa8njAVYxEkU)

 (image/png)    
