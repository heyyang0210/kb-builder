Created by 李子怡, last modified on 四月 26, 2024

IR：    [YASHAN-925 【mysql兼容】支持特定的视图&系统表](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ed? #YASHAN-925  【mysql兼容】支持特定的视图&系统表)  

SR:     [YDBRD-26300 支持mysql模式下特定视图及系统表](https://pingcode.yasdb.com/pjm/items/66192d90fd997db58ad8a75d? #YDBRD-26300 支持mysql模式下特定视图及系统表)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#1-overview%E6%A6%82%E8%BF%B0)  

在原有的mysql框架之上，适配相关的系统表。  它是一个虚拟数据库，物理上并不存在相关的目录和文件，均采用视图进行实现。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=109601972#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1.columns_priv  这里  指定的权限适用于一个表的特定列。  （由于默认权限粒度到表级，故此视图查询结果为空）

2.db：数据库级别权限，  这里指定的权限适用于一个数据库中的所有表。（系统级权限）

3.procs_priv：  这里代表允许使用某个存储过程和存储函数的权限。

4.tables_priv ：表级权限，  这里指定的一个权限适用于一个表的所有列。（对象级权限）

5.USER : 记录  账户信息，包括用户名、密码、权限等。  涉及的均是全局权限，并适用于所有数据库。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#3-interfaces%E6%8E%A5%E5%8F%A3)  

新增：check_user_privilege 内置函数，用于判断用户是否具有特定权限（SYS用户拥有所有权限）

```
CodResult bifVerifyCheckUserPrivilege(AnlVerifier* vrfr, ExprNode* node);
CodResult bifConcludeCheckUserPrivilege(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);
CodResult bifExecCheckUserPrivilege(AnlStmt* stmt, ExprNode* node, Variant* retValue);

```

用途：该函数主要用在mysql视图内用于过滤权限结果

输入：参数1：userid，参数2：权限id

输出：

true：该指定userid的user有权限类型（参数2）代表的权限；

false：该指定的user没有对应的权限；

  


此函数可判断的权限列表：

|权限id|权限名称|返回true需要验证的权限|含义|
|:---|:---|:---|:---|
|19|SELECT|AUTH_SELECT|允许查询表|
|20|INSERT|AUTH_INSERT|允许向表中插入行|
|21|UPDATE|AUTH_UPDATE|允许更新表中的行|
|22|DELETE|AUTH_DELETE|允许删除表中的行|
|24|CREATE|AUTH_CREATE_TABLE_IN_SCHEMA|允许创建表|
|27|DROP|AUTH_DROP_TABLE|允许删除表|
|  
|RELOAD|AUTH_NONE |允许使用flush语句（不支持）|
|  
|SHUTDOWN|"ankVerifyShutdown"|允许使用shutdown语句（SYS, DBA, OPER 用户具有该权限）|
|  
|PROCESS|AUTH_NONE |允许使用show processlist查看正在运行的进程（不支持）|
|  
|FILE|AUTH_NONE |允许使用load data infile读写文件（不支持）|
|  
|GRANT|"WITH GRANT OPTION"|允许把自己拥有的权限授给其他用户或废除|
|406|REFERENCES|AUTH_REFERENCES|允许创建外键|
|32|INDEX|AUTH_INDEX_IN_SCHEMA|允许创建或删除索引|
|26|ALTER|AUTH_ALTER_TABLE|允许使用alter table语句|
|  
|SHOW_DB|  
|允许使用show db语句|
|  
|SUPER|AUTH_NONE |允许使用其他管理语句，如SET GLOBAL等（不支持）|
|  
|CREATE_TMP_TABLE|AUTH_NONE |允许创建临时表（不支持）|
|  
|LOCK_TABLES|AUTH_LOCK_TABLE|允许使用LOCK TABLES语句|
|58|EXECUTE|AUTH_EXECUTE_PROCEDURE|允许用户执行存储过程|
|  
|REPL_SLAVE|AUTH_NONE |允许从库请求主库的binlog日志（不支持）|
|  
|REPL_CLIENT|AUTH_NONE |允许使用show master status, show slave status和show binary logs语句 （不支持）|
|50|CREATE_VIEW|AUTH_CREATE_VIEW_IN_SCHEMA|允许创建视图|
|  
|SHOW_VIEW|AUTH_NONE |允许使用show create view语句（不支持）|
|55|CREATE_ROUTINE|AUTH_CREATE_PROCEDURE_IN_SCHEMA|允许创建存储过程|
|59|ALTER_ROUTINE|AUTH_ALTER_PROCEDURE|允许修改存储过程|
|13|CREATE_USER|AUTH_CREATE_USER|允许创建用户|
|  
|EVENT|AUTH_NONE|允许使用事件（不支持）|
|61|TRIGGER|AUTH_CHECK_TRIGGER_PRIVILEGE|允许触发器操作|
|45|CREATE_TABLESPACE|AUTH_CREATE_TABLESPACE|允许创建表空间|


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

本方案仅支持已有的权限

功能限制：

- 不支持某些mysql独有权限，详见check_user_privilege 中需要验证的为AUTH_NONE对应的权限。
- 不支持权限控制到列，因此mysql.columns_priv视图查询结果恒为空，mysql.table_privs视图查询的Column_priv字段结果恒为空。
- 受限于  table_privilege_map$ 字段， mysql.table_privs视图查询的Table_priv字段不会出现'Create','Drop','Grant','Show view','Create view','Trigger' （create view是系统级权限，不在此处显示）
- 不支持授予权限给FUNCTION或PROCEDURE类型的对象（feature "privileges on specified object type" has not been implemented yet），因此mysql.procs_priv视图查询的结果恒为空。
- enum，set，text类型当前不支持, desc 分别显示为char, varchar, varchar


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. create database 后 mysql兼容模式下能正常查询到这些mysql系统表。
1. grant/revoke 对应权限，查看系统表显示是否满足预期。
1. desc 查看字段数据类型是否与预期一致。


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=113972889#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  
