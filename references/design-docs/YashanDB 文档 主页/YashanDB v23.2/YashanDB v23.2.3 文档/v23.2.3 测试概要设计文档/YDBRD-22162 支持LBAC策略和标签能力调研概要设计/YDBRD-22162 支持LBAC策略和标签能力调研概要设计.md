Created by 刘晓旋, last modified on 十月 16, 2024

#   [1. Overview（概述）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#1-overview%E6%A6%82%E8%BF%B0)  

IR 链接：    [YDBRD-18577](https://jira.yasdb.com/browse/YDBRD-18577?src=confmacro)    -  支持LBAC强制访问控制  待RMT评审

YashanDB Label Security，通过 Label-Based Access Control （简称LBAC）一种基于行标签的访问控制，实现了基于策略对数据库中的表提供行级安全控制功能。

Label Security 是强制访问控制的一种方式，通过在表中添加一个 Label 列来记录每行的 Label 值，在访问时通过比较用户的 Label 和数据的 Label 值，达到约束主体（用户）对客体（表中的数据）访问的目的。

LBAC 由策略、组件、标签构成。  策略是一种预定义标记组件，由等级（level)、范围（compartment）和组（group) 构成，从3个不同的维度对数据进行描述，其中等级在策略中是必须存在的，范围和组可以缺省。

![](https://pingcode.yasdb.com/atlas/files/public/67396cde8970c2af4f520ed0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUVBQWdBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQxMzIsImV4cCI6MTc4MjMxNDkzMn0.anQqcqieuh48udh-sUZJejZEFUFofmH6kRVwkv80toA)

标签由等级、范围、组构成，其中等级是必选的，范围和组可以省略。

![](https://pingcode.yasdb.com/atlas/files/public/67396cdea1ad9a3311dc8d41/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUVBQWdBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBUUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQxMzIsImV4cCI6MTc4MjMxNDkzMn0.anQqcqieuh48udh-sUZJejZEFUFofmH6kRVwkv80toA)

说明如下：

- Policy： 就是安全策略，一个安全策略是level，compartment，group，label的集合。
- Level：  等级，这是最基础的安全控制等级，必须设置。
- Compartment：范围，提供第二级的安全控制，是可选的。
- Group：组，提供第三级的安全控制，是可选的。
- Label：标签，最终体现到每一行上的安全标签，必须设置。只有用户被赋予的标签和此行上的标签相同或者等级更高的时候，该行才能够被用户存取。


  


数据库提供了内置的安全管理员 LBACSYS 来管理和使用该功能，安全管理员可以通过创建安全策略、定义策略中的 Label、设置用户的 Label，来定制自己的安全策略。

一个安全策略可以应用到多张表上，一张表也可以应用多个安全策略。每当一个安全策略被应用，这张表上自动会添加一列，用于该安全策略的访问控制。

创建策略等操作对应的权限需要有 LBAC_DBA 角色权限。

#   [2. 友商的实现情况](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#3-interfaces%E6%8E%A5%E5%8F%A3)  

Oracle 21c 支持 LBAC。  众所周知，GRANT 是控制对象访问，Oracle Label Security 则是对表的数据行进行访问控制。

### Oracle Label Security 简介

Oracle Label Security 使用分配给特定单个表行和应用程序用户的标签来控制单个表行的显示。

Oracle Label Security 的工作原理是将行标签与用户的标签授权进行比较，使能够轻松地将敏感信息限制为仅授权用户可见。这样，不同权限级别的用户（例如经理、销售代表）就可以访问表中的特定行数据。可以将 Oracle Label Security 策略应用到一个或多个应用程序表。

### Oracle Lable Security 的优势

Oracle Label Security 为控制行级别管理提供了多项优势。

- 它支持行级数据分类，并根据数据分类和用户标签授权或安全许可提供开箱即用的访问中介。
- 它使你能够向数据库用户和应用程序用户分配标签授权或安全许可。


### 谁有权使用 Oracle Lable Security ？

当你向数据库注册 Oracle Label Security 时，注册过程会创建一个名为 的管理用户     `LBACSYS`    ，该用户具有该     `LBAC_DBA `    角色。

你可以将此角色授予任何负责管理 Oracle Label Security 策略的数据库用户。此外，你还可以授予 Oracle Label Security 管理员执行 Oracle Label Security 包的权限以及管理各个 Oracle Label Security 策略的权限。

### Oracle Lable Security 的组件

Oracle Label Security 策略具有一组标准组件。

这些组件如下：

- Labels。  数据和用户的标签以及用户和程序单元的授权控制对指定受保护对象的访问。标签由以下部分组成：
    - Levels。（必选）  级别指示你要分配给行的敏感度类型（例如，    `SENSITIVE `    或     `HIGHLY SENSITIVE`    ）。级别是强制性的。
    - Compartments。  （可选）数据可以具有相同的级别（例如，  Public, Confidential and Secret  ），但可以属于公司内部的不同项目（例如，ACME Merger 和 IT Security）。  Compartments   代表本示例中的项目，有助于定义更精确的访问控制。它们最常用于政府环境。
    - Groups。  （可选）Groups 标​​识拥有或访问数据的组织（例如   UK, US, Asia, Europe  ）。Groups 可用于商业和政府环境，并且由于其灵活性而经常被使用。
- Policy。  策略是与这些标签、规则、授权和受保护表关联的名称。


|组件名称|描述|示例|
|---|---|---|
|Level|已建立的有序等级内标记数据敏感性的单一规范|  `CONFIDENTIAL`    (1)、    `SENSITIVE`    (2)、    `HIGHLY_SENSITIVE`    (3)|
|Compartment|与标记数据相关的零个或多个类别|  `FINANCIAL`    ,       `STRATEGIC`    ,     `NUCLEAR`  |
|Group|拥有或访问数据的组织的零个或多个标识符|  `EASTERN_REGION`    ,     `WESTERN_REGION`  |


  


- Level 示例：


|数字形式|长名称|短名称|
|---|---|---|
|  `40`  |  `HIGHLY_SENSITIVE`  |  `HS`  |
|  `30`  |  `SENSITIVE`  |  `S`  |
|  `20`  |  `CONFIDENTIAL`  |  `C`  |
|  `10`  |  `PUBLIC`  |  `P`  |


###### 每个 Label 必须包含一个 Level。Oracle Label Security 允许在 Policy 中定义最多 10,000 个 Level。对于每个 Level，Oracle Label Security 管理员定义了一个数字形式、长名称以及短名称。

  


- Compartment 示例：


|数字形式|长名称|短名称|
|---|---|---|
|  `85`  |  `FINANCIAL`  |  `FINCL`  |
|  `65`  |  `CHEMICAL`  |  `CHEM`  |
|  `45`  |  `OPERATIONAL`  |  `OP`  |


###### Compartment 将数据跟1个或多个安全区域相关联。

###### Compartment 是可选的，1个 Label 可以包含0个或多个 Compartment。Oracle Label Security 最多可定义 10,000 个 Compartment。

###### 不是所有的 Label 都需要 Compartments。比如，你可以指定不带 Compartments 的     `HIGHLY_SENSITIVE`     和       `CONFIDENTIAL 的 Level，以及1个带 Compartments 的 SENSITIVE Level。`  

  


- Group 示例：


|数字形式|长名称|短名称|Parent 组|
|---|---|---|---|
|  `1000`  |  `WESTERN_REGION`  |  `WR`  |  
|
|  `1100`  |  `WR_SALES`  |  `WR_SAL`  |  `WR`  |
|  `1200`  |  `WR_HUMAN_RESOURCES`  |  `WR_HR`  |  `WR`  |
|  `1300`  |  `WR_FINANCE`  |  `WR_FIN`  |  `WR`  |
|  `1310`  |  `WR_ACCOUNTS_PAYABLE`  |  `WR_AP`  |  `WR_FIN`  |
|  `1320`  |  `WR_ACCOUNTS_RECEIVABLE`  |  `WR_AR`  |  `WR_FIN`  |


###### Group 是可选的；Label 可以包含零个或多个组。Oracle Label Security 允许定义最多 10,000 个 Group。

###### 所有 Label 都不需要有 Group。当分析数据的敏感性时，你可能会发现某些 Group 仅在特定级别使用。例如，你可以指定不带 Group 的     `HIGHLY_SENSITIVE`       and       `CONFIDENTIAL`       标签，以及带含 Group 的     `SENSITIVE `    标签。

### Level、Compartment 以及 Group 的行业示例

以下表格举例列出各个行业中实施 Oracle Label Security 的 Level、Compartment、Group 的典型方式

|行业|Level|Compartment|Group|
|---|---|---|---|
|企业与企业之间 (B to B)|  `TRADE_SECRET`  ,  `PROPRIETARY`  ,  `COMPANY_CONFIDENTIAL`  ,  `PUBLIC`  |  `MARKETING`  ,  `FINANCIAL`  ,  `SALES`  ,  `PERSONNEL`  |  `AJAX_CORP`  ,  `BILTWELL_CO`  ,  `ACME_INC`  ,  `ERSATZ_LTD`  |
|金融服务|  `ACQUISITIONS`  ,  `CORPORATE`  ,  `CLIENT`  ,  `OPERATIONS`  |  `INSURANCE`  ,  `EQUITIES`  ,  `TRUSTS`  ,  `COMMERCIAL_LOANS`  ,  `CONSUMER_LOANS`  |  `CLIENT`  ,  `TRUSTEE`  ,  `BENEFICIARY`  ,  `MANAGEMENT`  ,  `STAFF`  |
|司法|  `NATIONAL_SECURITY`  ,  `SENSITIVE`  ,  `PUBLIC`  |  `CIVIL`  ,  `CRIMINAL`  |  `ADMINISTRATION`  ,  `DEFENSE`  ,  `PROSECUTION`  ,  `COURT`  |
|卫生保健|  `PRIMARY_PHYSICIAN`  ,  `PATIENT_CONFIDENTIAL`  ,  `PATIENT_RELEASE`  |  `PHARMACEUTICAL`  ,  `INFECTIOUS_DISEASES`  |  `CDC`  ,  `RESEARCH`  ,  `NURSING_STAFF`  ,  `HOSPITAL_STAFF`  |
|防御|  `TOP_SECRET`  ,  `SECRET`  ,  `CONFIDENTIAL`  ,  `UNCLASSIFIED`  |  `ALPHA`  ,  `DELTA`  ,  `SIGMA`  |  `UK`  ,  `NATO`  ,  `SPAIN`  |


  


### Oracle Lable Security 的 Packages 管理包

|Package 名称|作用|
|---|---|
|  `SA_SYSDBA`  |创建、更改和删除 Oracle Label Security 策略,请参见     [SA_SYSDBA 策略管理 PL/SQL 包](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-520B4DCF-487C-4DFB-972B-0E4A9AA5E497)  |
|  `SA_COMPONENTS`  |定义策略的级别、区间和组,请参见     [SA_COMPONENTS 标签组件 PL/SQL 包](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-582E2D69-0891-4C5B-A287-E5E50A0307B1)  |
|  `SA_LABEL_ADMIN`  |执行标准标签策略管理功能，例如创建标签,请参见     [SA_LABEL_ADMIN 标签管理 PL/SQL 包](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-37A51947-C20F-4FDA-95FA-DB1A0A6579B9)  |
|  `SA_POLICY_ADMIN`  |将策略应用到架构和表,请参见     [SA_POLICY_ADMIN 策略管理 PL/SQL 包](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-5A1345FF-404B-468E-A5EA-792511E386DB)  |
|  `SA_USER_ADMIN`  |管理级别、分区和组的用户授权以及程序单元权限。还可以管理用户权限。,请参见     [SA_USER_ADMIN.SET_USER_PRIVS](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-73B905A4-6B4F-4BA0-A44E-9475F2AEC414)    和    [SA_USER_ADMIN.SET_PROG_PRIVS](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-ED613128-0715-43B0-9753-004403250E08)  |
|  `SA_AUDIT_ADMIN`  |设置选项以审核管理任务和权限的使用,请参见     [SA_AUDIT_ADMIN Oracle 标签安全审核 PL/SQL 包](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-C4FB5E20-D9B8-48A1-9DDB-1ACA4722846E)  |
|  `SA_SESSION`  |在管理员设置的授权范围内，在会话期间更改标签,请参见     [SA_SESSION 会话管理 PL/SQL 包](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-406E4A7D-EC93-4720-BE46-0553EA0B1BB7)  |
|  `SA_UTL`  |一组实用函数，设计用于在 PL/SQL 程序中使用，以数字标签值的形式返回有关会话安全属性当前值的信息,请参见     [SA_UTL PL/SQL 实用程序函数和过程](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/oracle-label-security-pl-sql-packages.html#GUID-24F0A51B-B7C1-4788-9E97-719AE28FAEA1)  |


#   [3. 示例（接口）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#3-interfaces%E6%8E%A5%E5%8F%A3)  

### Oracle Lable Security 的

Oracle Label Security 的示例：

```
-- 1、注册并打开 Oracle Label Security 
EXEC LBACSYS.CONFIGURE_OLS; -- This procedure registers Oracle Label Security.
EXEC LBACSYS.OLS_ENFORCEMENT.ENABLE_OLS; -- This procedure enables it.

-- 2、查看 Oracle Label Security 的状态
SELECT * FROM DBA_OLS_STATUS;

-- 3、创建 Policy，此次没有指定 default_option，后续还可以使用另一个存储过程加上
conn lbacsys/lbacsys@127.0.0.1:1521/orclpdb
BEGIN
 SA_SYSDBA.CREATE_POLICY (
  policy_name      => 'HR_OLS_POL',
  column_name      => 'OLS_COL');
END;
/

-- 4、查看 dba_sa_policies 视图
select policy_name,column_name,status,policy_options,policy_subscribed from dba_sa_policies;

-- 5、打开 Policy
EXEC SA_SYSDBA.ENABLE_POLICY ('HR_OLS_POL');

-- 6、创建2个 Level 组件，一个高级别 'HS'，一个低级别 'S'
BEGIN
   SA_COMPONENTS.CREATE_LEVEL (
      policy_name => 'HR_OLS_POL',
      level_num   => 3000,
      short_name  => 'HS',
      long_name   => 'HIGHLY_SENSITIVE');

   SA_COMPONENTS.CREATE_LEVEL (
      policy_name => 'HR_OLS_POL',
      level_num   => 2000,
      short_name  => 'S',
      long_name   => 'SENSITIVE');
END;
/

-- 7、为上面2个 Level 分别创建2个标签。（注：Label_tag 跟 Level 不同，只作为内部的唯一标识，不作为区分级别高低；Data_label 设置为 TRUE，即将该标签应用于行数据）
BEGIN
   SA_LABEL_ADMIN.CREATE_LABEL (
      policy_name  => 'HR_OLS_POL',
      label_tag    => 3100,
      label_value  => 'HS',
      data_label   => TRUE);

   SA_LABEL_ADMIN.CREATE_LABEL (
      policy_name  => 'HR_OLS_POL',
      label_tag    => 2100,
      label_value  => 'S',
      data_label   => TRUE);
END;
/

-- 8、为用户 userA 和 userB 设置 level 级别
BEGIN
   SA_USER_ADMIN.SET_LEVELS (
      policy_name  => 'HR_OLS_POL',
      user_name    => 'userA', 
      max_level    => 'HS',
      min_level    => 'S');

   SA_USER_ADMIN.SET_LEVELS (
      policy_name  => 'HR_OLS_POL',
      user_name    => 'userB', 
      max_level    => 'S',
      min_level    => 'S');
END;
/

-- 9、应用该 Policy，schema 为 HR。如果前面 SA_SYSDBA.CREATE_POLICY 没有指定 default_options 参数，那么这里必须要强制设置。 
BEGIN
  SA_POLICY_ADMIN.APPLY_TABLE_POLICY (
    policy_name    => 'HR_OLS_POL',
    schema_name    => 'HR', 
    table_name     => 'EMPLOYEES',
    table_options  => 'READ_CONTROL');
END;
/

-- 10 使能该 Policy
BEGIN
   SA_POLICY_ADMIN.ENABLE_TABLE_POLICY (
      policy_name => 'HR_OLS_POL',
      schema_name => 'HR',
      table_name  => 'EMPLOYEES');
END;
/

-- 往 HR.EMPLOYEES 中插入107条数据。并使用 UPDATE 命令来设置哪些数据是 high level 可以看，哪些数据是 low level 不能看
UPDATE employees
SET    ols_col = CHAR_TO_LABEL('HR_OLS_POL','HS')
WHERE  UPPER(employee_id) IN (200, 101, 102, 176, 201, 122, 114);    -- high sensitive 可见

UPDATE employees
SET    ols_col = CHAR_TO_LABEL('HR_OLS_POL','S')
WHERE  UPPER(employee_id) NOT IN (200, 101, 102, 176, 201, 122, 114);  -- sensitive 不可见

-- 登录 userA 用户（level 为 'HS'），能看到全部数据
conn userA
select * from HR.EMPLOYEE;
FIRST_NAME                LAST_NAME                 EMPLOYEE_ID OLS_LABEL
------------------------- ------------------------- ----------- ----------
Steven                    King                              100 S
Alexander                 Hunold                            103 S
...
William                   Gietz                             206 S
Neena                     Kochhar                           101 HS
Lex                       De Haan                           102 HS
Den                       Raphaely                          114 HS
Michael                   Hartstein                         201 HS
Jonathon                  Taylor                            176 HS
Jennifer                  Whalen                            200 HS
Payam                     Kaufling                          122 HS

107 rows selected

-- 登录 userB 用户（level 为 'S'），部分数据不可见
conn userB
select * from HR.EMPLOYEE;
FIRST_NAME                LAST_NAME                 EMPLOYEE_ID OLS_LABEL
------------------------- ------------------------- ----------- ----------
Steven                    King                              100 S
Alexander                 Hunold                            103 S
Bruce                     Ernst                             104 S
David                     Austin                            105 S
Valli                     Pataballa                         106 S
Diana                     Lorentz                           107 S
Nancy                     Greenberg                         108 S
Daniel                    Faviet                            109 S
...
100 rows selected

-- 删除 Policy
BEGIN
  SA_SYSDBA.DROP_POLICY ( 
    policy_name  => 'HR_OLS_POL',
    drop_column  => TRUE);
END;
/
```

#   [4. 参考文档](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#5-example%E7%94%A8%E4%BE%8B)  

开发设计：    [LBAC详细设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133583636)  

Oracle LBAC 文档：    [https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/index.html#Oracle%C2%AE-Label-Security](https://docs.oracle.com/en/database/oracle/oracle-database/21/olsag/index.html#Oracle%C2%AE-Label-Security)  

#   [5. 后续关注](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#6-reference%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3)  

  


  


  


## Attachments:

[image2023-10-17_10-29-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGVhMWFkOWEzMzExZGM4ZDNjIiwicmVmX2lkIjoiNjczOTZjZGU1OTNmOTljOWZmMjM3NDQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTMyLCJleHAiOjE3ODIzOTA1MzJ9.fWNnqOIs26EgXHCkD_G_FGlTmGXGNEAuZfxwrwtqyiE)

 (image/png)    


[image2023-10-17_10-28-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGVhMWFkOWEzMzExZGM4ZDNkIiwicmVmX2lkIjoiNjczOTZjZGU1OTNmOTljOWZmMjM3NDQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTMyLCJleHAiOjE3ODIzOTA1MzJ9.Iiw4aESqhRiOuFEFr6jFmKoVFM-jVHaWKbD9M0mdFu8)

 (image/png)    


[image2023-10-17_10-11-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGU4OTcwYzJhZjRmNTIwZWNkIiwicmVmX2lkIjoiNjczOTZjZGU1OTNmOTljOWZmMjM3NDQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTMyLCJleHAiOjE3ODIzOTA1MzJ9.9-BydlHzVAkAKyWjq3YGtuiFmG5O8hls9_gMK5eg-oM)

 (image/png)    


[image2023-10-17_10-11-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGU4OTcwYzJhZjRmNTIwZWNlIiwicmVmX2lkIjoiNjczOTZjZGU1OTNmOTljOWZmMjM3NDQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTMyLCJleHAiOjE3ODIzOTA1MzJ9.YlIj2ttrvar_e_4rhVDetnYbxtCvdk-d9DNO-pLSuMU)

 (image/png)    


[image2023-11-9_17-11-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGVhMWFkOWEzMzExZGM4ZDNmIiwicmVmX2lkIjoiNjczOTZjZGU1OTNmOTljOWZmMjM3NDQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTMyLCJleHAiOjE3ODIzOTA1MzJ9.B-OH5OQ-yj3UT6ccNTA_SmOFasd9gA-q8eYtZgoXhWE)

 (image/png)    


[image2023-11-9_17-11-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGVhMWFkOWEzMzExZGM4ZDQwIiwicmVmX2lkIjoiNjczOTZjZGU1OTNmOTljOWZmMjM3NDQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTMyLCJleHAiOjE3ODIzOTA1MzJ9.iKozeCEI7o7T50fvYN2zS2tw_5jDhTHhdK16FJ0fRuU)

 (image/png)    
