Created by 李子怡, last modified on 五月 13, 2024

IR：    [YASHAN-925 【mysql兼容】支持特定的视图&系统表](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ed? #YASHAN-925  【mysql兼容】支持特定的视图&系统表)  

SR:     [YDBRD-26300 支持mysql模式下特定视图及系统表](https://pingcode.yasdb.com/pjm/items/66192d90fd997db58ad8a75d? #YDBRD-26300 支持mysql模式下特定视图及系统表)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#1-overview%E6%A6%82%E8%BF%B0)  

在原有的mysql框架之上，适配相关的系统表。  它是一个虚拟数据库，物理上并不存在相关的目录和文件，均采用视图进行实现。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1.    [columns_priv](https://conf.yasdb.com/display/~liziyi/columns_priv)      这里  指定的权限适用于一个表的特定列。  （由于默认权限粒度到表级，故此视图查询结果为空）

2.    [db](https://conf.yasdb.com/display/~liziyi/db)    ：数据库级别权限，  这里指定的权限适用于一个数据库中的所有表。（系统级权限）

3.    [procs_priv](https://conf.yasdb.com/display/~liziyi/procs_priv)    ：  这里代表允许使用某个存储过程和存储函数的权限。

4.    [tables_priv](https://conf.yasdb.com/display/~liziyi/tables_priv)     ：表级权限，  这里指定的一个权限适用于一个表的所有列。（对象级权限）

5.    [user](https://conf.yasdb.com/display/~liziyi/user)     : 记录  账户信息，包括用户名、密码、权限等。  涉及的均是全局权限，并适用于所有数据库。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#3-interfaces%E6%8E%A5%E5%8F%A3)  

新增：    [check_user_privilege](https://conf.yasdb.com/display/~liziyi/check_user_privilege)     内置函数，用于判断用户是否具有特定权限（SYS用户拥有所有权限）

```
CodResult bifVerifyCheckUserPrivilege(AnlVerifier* vrfr, ExprNode* node);
CodResult bifConcludeCheckUserPrivilege(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);
CodResult bifExecCheckUserPrivilege(AnlStmt* stmt, ExprNode* node, Variant* retValue);

```

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

本方案仅支持已有的权限

功能限制：

- 不支持某些mysql独有权限，详见    [check_user_privilege](https://conf.yasdb.com/display/~liziyi/check_user_privilege)     中需要验证的为AUTH_NONE对应的权限。
- 不支持权限控制到列，因此mysql.columns_priv视图查询结果恒为空，mysql.table_privs视图查询的Column_priv字段结果恒为空。
- 受限于  table_privilege_map$ 字段， mysql.table_privs视图查询的Table_priv字段不会出现'Create','Drop','Grant','Show view','Create view','Trigger' （create view是系统级权限，不在此处显示）
- 不支持授予权限给FUNCTION或PROCEDURE类型的对象（feature "privileges on specified object type" has not been implemented yet），因此mysql.procs_priv视图查询的结果恒为空。
- enum，set，text，blob类型当前不支持, desc 分别显示为char, varchar, varchar, char


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. create database 后 mysql兼容模式下能正常查询到这些mysql系统表。
1. grant/revoke 对应权限，查看系统表显示是否满足预期。
1. desc 查看字段数据类型是否与预期一致。(yashan 模式)


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

- 支持 show db， process, show view 等对应的权限控制


  
