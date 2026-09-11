Created by 刘晓旋, last modified on 十月 16, 2024

#   [1. Overview（概述）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#1-overview%E6%A6%82%E8%BF%B0)  

IR 链接：    [#YASHAN-959](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b30f)  

SR 链接：    [#YDBRD-19098](https://pingcode.yasdb.com/pjm/items/661155b3579a3edb84d6885c)  

#   [2. 友商的实现情况](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#3-interfaces%E6%8E%A5%E5%8F%A3)  

### Oracle

可查询 AUDITABLE_SYSTEM_ACTIONS 数据字典视图的 COMPONENT 和 NAME 列来找到 Oracle Label Security 支持的审计事件有哪些

```
SQL> SELECT NAME FROM AUDITABLE_SYSTEM_ACTIONS WHERE COMPONENT = 'Label Security';

NAME
--------------------------------------------------------------------------------
APPLY POLICY
REMOVE POLICY
SET AUTHORIZATION
PRIVILEGED ACTION
ENABLE POLICY
DISABLE POLICY
SUBSCRIBE OID
UNSUBSCRIBE OID
CREATE DATA LABEL
ALTER DATA LABEL
DROP DATA LABEL
CREATE POLICY
ALTER POLICY
DROP POLICY
CREATE LABEL COMPONENTS
ALTER LABEL COMPONENTS
DROP LABEL COMPONENTS
ALL

18 rows selected.
```

  


Oracle Label Security 审计事件支持以下：

|审计事件|描述|
|---|---|
|  `CREATE POLICY`  |  `SA_SYSDBA.CREATE_POLICY`       创建 Oracle Label Security 策略|
|  `ALTER POLICY`  |  `SA_SYSDBA.ALTER_POLICY`       更改 Oracle Label Security 策略|
|  `DROP POLICY`  |  `SA_SYSDBA.DROP_POLICY`       删除 Oracle Label Security 策略|
|  `APPLY POLICY`  |通过过程应用表策略或通过过程       `SA_POLICY_ADMIN.APPLY_TABLE_POLICY`    应用架构策略    `SA_POLICY_ADMIN.APPLY_SCHEMA_POLICY`  |
|  `REMOVE POLICY`  |通过过程删除表策略或通过过程 删除    `SA_POLICY_ADMIN.REMOVE_TABLE_POLICY`    架构策略    `SA_POLICY_ADMIN.REMOVE_SCHEMA_POLICY`  |
|  `SET AUTHORIZATION`  |涵盖所有 Oracle Label Security 授权，包括 Oracle Label Security 权限和用户标签（无论是用户还是受信任的存储过程）。与事件相对应的 PL/SQL 过程    `SET AUTHORIZATION`    是    `SA_USER_ADMIN.SET_USER_LABELS`    、    `SA_USER_ADMIN.SET_USER_PRIVS`    和    `SA_USER_ADMIN.SET_PROG_PRIVS`    。|
|  `PRIVILEGED ACTION`  |涵盖需要用户拥有 Oracle Label Security 权限的任何操作。这些操作包括登录、    `SA_SESSION.SET_ACCESS_PROFILE`    执行和调用受信任的存储过程。|
|  `ENABLE POLICY`  |通过以下程序启用 Oracle Label Security 策略：,-   `SA_SYSDBA.ENABLE_POLICY`    ：对受策略保护的表和架构实施访问控制
-   `SA_POLICY_ADMIN.ENABLE_TABLE_POLICY`    ：为指定表启用 Oracle 标签安全策略
-   `SA_POLICY_ADMIN.ENABLE_SCHEMA_POLICY`    ：为指定模式中的所有表启用 Oracle 标签安全策略
|
|  `DISABLE POLICY`  |通过以下步骤禁用 Oracle Label Security 策略：,-   `SA_SYSDBA.DISABLE_POLICY`    ：禁用 Oracle Label Security 策略的执行
-   `SA_POLICY_ADMIN.DISABLE_TABLE_POLICY`    ：禁用针对指定表的 Oracle 标签安全策略的执行
-   `SA_POLICY_ADMIN.DISABLE_SCHEMA_POLICY`    ：禁用针对指定架构中的所有表实施 Oracle 标签安全策略
|
|  `SUBSCRIBE OID`  |  `SA_POLICY_ADMIN.POLICY_SUBSCRIBE`    通过以下程序     订阅支持 Oracle Internet Directory 的 Oracle Label Security 策略|
|  `UNSUBSCRIBE OID`  |  `SA_POLICY_ADMIN.POLICY_UNSUBSCRIBE`    通过以下程序     取消订阅支持 Oracle Internet Directory 的 Oracle Label Security 策略|
|  `CREATE DATA LABEL`  |通过过程创建 Oracle Label Security 数据标签    `SA_LABEL_ADMIN.CREATE_LABEL`    。    `CREATE DATA LABEL`    也对应于    `LBACSYS.TO_DATA_LABEL`    函数。|
|  `ALTER DATA LABEL`  |  `SA_LABEL_ADMIN.ALTER_LABEL`       更改 Oracle Label Security 数据标签|
|  `DROP DATA LABEL`  |  `SA_LABEL_ADMIN.DROP_LABEL`       删除 Oracle Label Security 数据标签|
|  `CREATE LABEL COMPONENT`  |通过以下步骤创建 Oracle Label Security 组件：,- 级别：       `SA_COMPONENTS.CREATE_LEVEL`  
- 隔间：       `SA_COMPONENTS.CREATE_COMPARTMENT`  
- 群组：       `SA_COMPONENTS.CREATE_GROUP`  
|
|  `ALTER LABEL COMPONENTS`  |通过以下步骤更改 Oracle Label Security 组件：,- 级别：       `SA_COMPONENTS.ALTER_LEVEL`  
- 隔间：       `SA_COMPONENTS.ALTER_COMPARTMENT`  
- 团体：       `SA_COMPONENTS.ALTER_GROUP`    和    `SA_COMPONENTS.ALTER_GROUP_PARENT`  
|
|  `DROP LABEL COMPONENTS`  |通过以下步骤删除 Oracle Label Security 组件：,- 级别：       `SA_COMPONENTS.DROP_LEVEL`  
- 隔间：       `SA_COMPONENTS.DROP_COMPARTMENT`  
- 群组：       `SA_COMPONENTS.DROP_GROUP`  
|
|  `ALL`  |支持审计所有 Oracle Label Security 操作|


  


#   [3. 示例（接口）](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#3-interfaces%E6%8E%A5%E5%8F%A3)  

Oracle

1、CREATE AUDIT POLICY 语句可以将用户从策略中排除。以下示例显示如何创建排除用户 ols_mgr 操作的统一审计策略。

```
CREATE AUDIT POLICY auth_ols_audit_pol
 ACTIONS SELECT ON HR.EMPLOYEES
 ACTIONS COMPONENT=OLS DROP POLICY, DISABLE POLICY;

AUDIT POLICY auth_ols_audit_pol EXCEPT ols_mgr;
```

2、以下示例显示如何审计 HR.EMPLOYEES 表上的 DROP POLICY、DISABLE POLICY、UNSUBSCRIBE OID 事件以及 UPDATE 和 DELETE 语句。然后，此策略将应用于 HR 和 LBACSYS 用户，并且仅当审计操作成功时，审计记录才会写入统一审计跟踪。

```
CREATE AUDIT POLICY generic_audit_pol
 ACTIONS UPDATE ON HR.EMPLOYEES, DELETE ON HR.EMPLOYEES
 ACTIONS COMPONENT=OLS DROP POLICY, DISABLE POLICY, UNSUBSCRIBE OID;

AUDIT POLICY generic_audit_pol BY HR, LBACSYS WHENEVER SUCCESSFUL;
```

3、LBACSYS.ORA_GET_AUDITED_LABEL 函数可用于 UNIFIED_AUDIT_TRAIL 查询以查找已审计的 Oracle Label Security 会话标签。以下示例显示如何在 UNIFIED_AUDIT_TRAIL 数据字典视图查询中使用 LBACSYS.ORA_GET_AUDITED_LABEL 函数。

```
SELECT ENTRY_ID, SESSIONID,
       LBACSYS.ORA_GET_AUDITED_LABEL( APPLICATION_CONTEXTS,'GENERIC_AUDIT_POL1') AS  SESSION_LABEL1,
       LBACSYS.ORA_GET_AUDITED_LABEL( APPLICATION_CONTEXTS,'GENERIC_AUDIT_POL2') AS  SESSION_LABEL2
FROM UNIFIED_AUDIT_TRAIL;
/

ENTRY_ID  SESSIONID  SESSION_LABEL1  SESSION_LABEL2
--------  ---------  --------------  --------------
       1       1023  SECRET          LEVEL_ALPHA
       2       1024  TOP_SECRET      LEVEL_BETA
```

4、UNIFIED_AUDIT_TRAIL 视图的 OLS_* 列显示特定于 Oracle Label Security 的审计数据。如：

```
SELECT OLS_PRIVILEGES_USED FROM UNIFIED_AUDIT_TRAIL WHERE DBUSERNAME = 'psmith';

OLS_PRIVILEGES_USED
-------------------
READ
WRITEUP
WRITEACROSS
```

  


#   [4. 参考文档](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#5-example%E7%94%A8%E4%BE%8B)  

Oracle 参考：

  [https://docs.oracle.com/en/database/oracle/oracle-database/23/olsag/auditing-under-oracle-label-security.html#GUID-3F768C21-B841-4BA3-96EA-05094428C9CF](https://docs.oracle.com/en/database/oracle/oracle-database/23/olsag/auditing-under-oracle-label-security.html#GUID-3F768C21-B841-4BA3-96EA-05094428C9CF)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/creating-custom-unified-audit-policies.html#GUID-777AE231-6593-42C5-A047-13CCC1E8ABE1](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/creating-custom-unified-audit-policies.html#GUID-777AE231-6593-42C5-A047-13CCC1E8ABE1)  

  


#   [5. 后续关注](https://conf.yasdb.com/display/YAS/ST_LongestLine+Design#6-reference%E5%8F%82%E8%80%83%E6%96%87%E6%A1%A3)  

NA

  


  


## Attachments:

[image2023-11-21_16-49-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGU4OTcwYzJhZjRmNTIxNTkwIiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.HB5-yyuMcg1cyvdv9SqK7E5vzCaA-38y0b6YuDgkwK4)

 (image/png)    


[image2023-11-9_17-11-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGU4OTcwYzJhZjRmNTIxNTkyIiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.V3TZWEK89cJgmiLIGEksBJWJyBELo3yN14R3oQwuvpQ)

 (image/png)    


[image2023-11-9_17-11-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGVhMWFkOWEzMzExZGM5NDA0IiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.AAph0ykLTO4P2W6jw3SU_uJDAGf92_hT1DKXfuT1dCQ)

 (image/png)    


[image2023-10-31_21-3-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGVhMWFkOWEzMzExZGM5NDA2IiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.ZTt6fRhAK5rPKguJT4caTs3RGwg2lG5STi-fMomBW78)

 (image/png)    


[image2023-10-31_20-54-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGU4OTcwYzJhZjRmNTIxNTkzIiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.vACMO8LaLd_mxm4DTa1uluxeuqs2H93szjWmGpZisZk)

 (image/png)    


[image2023-10-17_10-29-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGVhMWFkOWEzMzExZGM5NDA3IiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.2GL669UAZ8Y1mJlX3Zk9sHIFVk5sBD17qmqe4pzI3BY)

 (image/png)    


[image2023-10-17_10-28-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGVhMWFkOWEzMzExZGM5NDA4IiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.4Vn_44S_e_VCOacX3wm76_BrGldN9rYo6Epf55iZj28)

 (image/png)    


[image2023-10-17_10-11-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGU4OTcwYzJhZjRmNTIxNTk1IiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.asmZhT-YN-icEni9CvD4n9v-HPd26WwZ34OMfDsuQCM)

 (image/png)    


[image2023-10-17_10-11-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZGU4OTcwYzJhZjRmNTIxNTk2IiwicmVmX2lkIjoiNjczOTZkZGQ1OTNmOTljOWZmMjM4MDc4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNjc4LCJleHAiOjE3ODIzOTkwNzh9.AfKf6dEhhm_WNlIAZO82mRq-dpfxMYcakMvWS1vEiCQ)

 (image/png)    
