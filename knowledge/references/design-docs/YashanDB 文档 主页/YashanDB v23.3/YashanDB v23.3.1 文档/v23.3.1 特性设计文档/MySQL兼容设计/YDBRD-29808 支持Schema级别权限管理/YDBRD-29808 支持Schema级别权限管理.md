Created by 张鹏飞, last modified on 七月 17, 2024

  [https://pingcode.yasdb.com/pjm/items/667bd5b7288e197820af36b7](https://pingcode.yasdb.com/pjm/items/667bd5b7288e197820af36b7)    ?    
  #YDBRD-29808 【mysql兼容】支持Schema级别权限管理

##   [1. 总述](#1-总述)  

Schema级权限管理，指可以向用户或角色授予在某个特定Schema下执行相应操作的权限。

###   [1.1 需求来源](#11-需求来源)  

当前YashanDB的权限分为系统级权限、对象级权限。

系统级权限，指某个用户（或角色）拥有某个特定权限后，可以在数据库上执行相应的操作，而不需要关心该操作实际发生的关系模式范围。

对象级权限，指某个用户（或角色）拥有在某个对象上的某个特定权限后，可以在该对象上执行相应的操作，但该权限仅在该对象上生效。

例如，用户User1试图在Schema1的表T1上执行update操作，则需要通过对User1或其拥有的角色授予Schema1.T1的update权限，update any table的系统权限。这两种方式各有弊端：

- 授予Schema1.T1的对象级权限，可以达到最小授权，但如果User1需要访问Schema1下的所有表，则需要为User1单独授予Schema1下每张表的权限，操作复杂。
- 授予系统权限，会造成权限放大。
- 特别是DDL操作，可能授予系统权限，并且系统权限仅区分用户在自己的schema下和其他所有schema下的权限。


MySQL的用户和Schema是两个不同的概念，用户不包含任何对象，schema不代表任何身份，因此，生产系统需要给用户授予指定schema下的权限。为避免权限放大和过度复杂的对象级授权，MySQL早期版本已支持schema级授权。Oracle从23ai版本也开始支持schema级授权。

###   [1.2 调研文档](#12-调研文档)  

Oracle语法：

```
= GRANT  {schema_privilege|ALL PRIVILEGES} ON SCHEMA schema TO {grantee_clause|grantee_identified_by} [WITH {ADMIN|DELEGATE} OPTION]

```

```
grantee_clause = { user | role | PUBLIC }
  [, { user | role | PUBLIC } ]...

```

```
grantee_identified_by = user [, user ]... IDENTIFIED BY password [, password ]...

```

授予Schema级权限时，grantor必须满足以上条件之一：

- grantor是schema的owner
- grantor拥有schema的shema_privilege权限，并且带WITH ADMIN OPTION
- grantor有GRANT ANY SCHEME PRIVILEGE权限


不允许授予sys schema的权限。

MySQL语法：

```
GRANT
    priv_type [(column_list)]
      [, priv_type [(column_list)]] ...
    ON [object_type] priv_level
    TO user [auth_option] [, user [auth_option]] ...
    [REQUIRE {NONE | tls_option [[AND] tls_option] ...}]
    [WITH {GRANT OPTION | resource_option} ...]

GRANT PROXY ON user
    TO user [, user] ...
    [WITH GRANT OPTION]

object_type: {
    TABLE
  | FUNCTION
  | PROCEDURE
}

priv_level: {
    *
  | *.*
  | db_name.*
  | db_name.tbl_name
  | tbl_name
  | db_name.routine_name
}

user:
    (see Section 6.2.4, “Specifying Account Names”)

auth_option: {
    IDENTIFIED BY 'auth_string'
  | IDENTIFIED WITH auth_plugin
  | IDENTIFIED WITH auth_plugin BY 'auth_string'
  | IDENTIFIED WITH auth_plugin AS 'auth_string'
  | IDENTIFIED BY PASSWORD 'auth_string'
}

tls_option: {
    SSL
  | X509
  | CIPHER 'cipher'
  | ISSUER 'issuer'
  | SUBJECT 'subject'
}

resource_option: {
  | MAX_QUERIES_PER_HOUR count
  | MAX_UPDATES_PER_HOUR count
  | MAX_CONNECTIONS_PER_HOUR count
  | MAX_USER_CONNECTIONS count
}

```

MySQL中，grantor向grantee授予某个schema的权限的前提是，grantor拥有该权限，并且有WITH GRANT OPTION选项。

|priv_level|含义|
|---|---|
|*|授予当前schema的权限，即oracle的schema级权限|
|*.*|授予所有schema的权限，相当于oracle的系统权限|
|db_name.*|授予指定schema的权限|
|db_name.tbl_name|授予对象权限|
|tbl_name|授予对象权限|
|db_name.routine_name|授予对象权限|


MySQL与Oracle的差异：

Oracle的schema级权限类别是系统权限，而非对象权限。

例如，给用户user1授予sch1下所有对象的select权限，Oracle语法为：

```
grant select any table on schema sch1 to user1;

```

```
grant select on sch1.* to user1;

```

因此MySQL授权是否可传递，取决于是否有WITH GRANT OPTION选项，Oracle取决于是否有WITH ADMIN OPTION选项。

###   [1.3 需求分析](#13-需求分析)  

本特性主要解决MySQL模式下的schema级授权问题。总体机制与Oracle类似，支持MySQL模式下的grant语法。具体内容包括以下几点：

1. grant\revoke语法解析
1. 权限映射，将用户指定的MySQL权限名称映射到YashanDB的系统权限
1. 选项映射，如果是SCHEMA级的权限，则将WITH GRANT OPTION映射为WITH ADMIN OPTION
1. 授权记录写入系统表
1. 常用权限的缓存
1. 授权较验流程由"系统权限->对象级"修改为系统权限->schema级系统权限->对象权限


由于MySQL权限与YashanDB权限并非一一对应，因此，第2步权限映射时，如能找到一一对应的权限，则按映射后的权限处理，如没有找到，则按用户原始输入的权限处理：

- 用户原始输入了MySQL的合法权限，并找到了与之对应的YashanDB权限，则命令可能执行成功。
- 用户原始输入了MySQL的合法权限，但未找到对应的YashanDB权限（YashanDB不支持该权限，或对应YashanDB的多个权限），则命令执行不成功。
- 用户原始输入了YashanDB的合法权限，将该权限视作MySQL的权限去找YashanDB的权限，未找到，则按原始输入的权限继续处理，命令可能执行成功。
- 用户输入非法权限，未找到对应的YashanDB权限，则按原始输入的权限继续处理，命令失败


##   [2. 接口](#2-接口)  

SQL语法

```
= grant {mysql_privilege|yashandb_system_privilege} on [object_type] priv_level to user [with grant option] 

```

```
= revoke {mysql_privilege|yashandb_system_privilege} on [object_type] priv_level from user

```

系统表

schauth$

|列名|数据类型|允许为空|含义|
|---|---|---|---|
|GRANTEE#|BINARY_INTEGER|否|grantee对应的userid|
|SCHEMA#|BINARY_INTEGER|否|schema对应的userId|
|PRIVILEGE#|BINARY_INTEGER|否|系统权限对应的roleId|
|REFSEQUENCE|BINARY_BIGINT|否|授权的序列号|
|OPTION|BINARY_INTEGER|是|授权选项|


CREATE INDEX I_SCHAUTH_1 ON SCHAUTH$(GRANTEE#, SCHEMA#, PRIVILEGE#)/CREATE INDEX I_SCHAUTH_2 ON SCHAUTH$(SCHEMA#)/

##   [3. 规格与约束](#3-规格与约束)  

约束

1. 不支持一次授予多个权限
1. 不支持将权限一次授予多个用户
1. 不支持将权限授予角色
1. MySQL权限在YashanDB没有对等权限的，不能通过与MySQL完全一致的语法进行授权


##   [4. 特性](#4-特性)  

###   [4.1 语法解析](#41-语法解析)  

尝试用MySQL语法解析，如果未解析成功，则重置错误码，并交给YashanDB模式解析。

###   [4.2 权限映射](#42-权限映射)  

本特性只针对schema级权限做映射。

|MySQL权限|崖山权限|含义|
|---|---|---|
|ALL [PRIVILEGES]|ALL PRIVILEGES||
|ALTER|ALTER ANY TABLE||
|ALTER ROUTINE|ALTER ANY PROCEDURE||
|CREATE|CREATE ANY TABLE||
|CREATE ROUTINE|CREATE ANY PROCEDURE||
|CREATE VIEW|CREATE ANY VIEW||
|DELETE|DELETE ANY TABLE||
|DROP|DROP ANY TABLE||
|EXECUTE|EXECUTE ANY PROCEDURE||
|INSERT|INSERT ANY TABLE||
|SELECT|READ ANY TABLE|查询表，不包含select for update|
|UPDATE|UPDATE ANY TABLE||


###   [4.3 权限缓存](#43-权限缓存)  

schema级的权限缓存是放在schema上，而不是user上。

```
typedef struct StSchPrivs {
    SpinLock    lock;
    CodUint16   userId;
    CodUint16   sysPrivs;
} SchPrivs;

typedef struct StUserDict {
    UserProfile    profile;
    ...
    List*          schPrivs;
} UserDict;

```

###   [4.4 并发控制](#44-并发控制)  

1 授权过程中，需要对schema和user加共享锁。

2 修改缓存时，由于多个grant\revoke操作可以并发，所以SchPrivs需要自旋锁做并发控制。

###   [4.5 权限校验](#45-权限校验)  

修改点：

```
typedef struct StPrivAuthInfo {
    CodUint32      userId;
    CodUint32      schemaId;    // 由isSysSchema改为传入schemaId
    ...
} PrivAuthInfo;

```

userCheckCommonPriv中，非sys schema的情况下，先检验系统权限，再校验schema级权限。

roleCheckUserSysPriv中，先检查全局的系统权限，再检查schema级的系统权限。

###   [4.6 DDL执行](#46-ddl执行)  

修改点：

```
typedef enum EnPrivilegeModifyAction {
    GRANT_SYS_ROLE = 0,
    GRANT_OBJ_ROLE,
    GRANT_SCHEMA_ROLE,           /* 新增 */
    GRANT_SYS_ALL_PRIVILEGES,
    GRANT_OBJ_ALL_PRIVILEGES,
    GRANT_SCHEMA_ALL_PRIVILEGES, /* 新增 */
    GRANT_NORMAL_ROLE,
    REVOKE_SYS_ROLE,
    REVOKE_OBJ_ROLE,
    REVOKE_SCHEMA_ROLE,          /* 新增 */
    REVOKE_SYS_ALL_PRIVILEGES,
    REVOKE_OBJ_ALL_PRIVILEGES,
    REVOKE_SCHEMA_ALL_PRIVILEGES,   /* 新增 */
    REVOKE_NORMAL_ROLE
} PrivilegeModifyAction;

```

新增以下函数，用于完成grant和revoke操作

```
grantSchRoleToUser、revokeSchPrivFromUser

```

DDLInfo中，如果是schema级的grant或revoke，则将ddlInfo->objId设置为schemaId，用于在第二阶段设置（或清理）缓存、解锁schema。

redo日志新增两种类型：

```
LOGT_GRANT_SCHEMA_PRIV,
LOGT_REVOKE_SCHEMA_PRIV

```

redo结构体新增以下类型

```
typedef struct StRecGrantSchema {
    CodUint32 granteeId;
    CodUint32 schemaId;
    CodUint32 schPrivId;
} RecGrantSchema;

```

drop user时，删除所有授予给该user的schema权限，删除所有该user(作为schema)授权的记录。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


  [https://conf.yasdb.com/pages/viewpage.action?pageId=159433141](https://conf.yasdb.com/pages/viewpage.action?pageId=159433141)  

##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,评审纪要：,1 拦截mysql对象级和系统级权限的授权，建议用户用yashan语法，mysql模式只解决schema级权限    
    
,Posted by zhangpengfei at 七月 18, 2024 10:40|
|---|
