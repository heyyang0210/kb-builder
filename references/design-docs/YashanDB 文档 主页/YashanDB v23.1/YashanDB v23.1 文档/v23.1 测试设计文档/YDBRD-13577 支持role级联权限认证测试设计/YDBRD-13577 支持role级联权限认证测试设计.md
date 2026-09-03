Created by 胡晓畔, last modified on 四月 01, 2024

# **1.**  ** **  **概述**

SR：

  [[YDBRD-13577] 支持role级联权限认证 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13577)  

  [YDBRD-13577](https://jira.yasdb.com/browse/YDBRD-13577?src=confmacro)    -  支持role级联权限认证  完成

当前已支持给角色  赋予权限，  为了增强角色权限控制能力，现支持给角色授予角色，从角色回收角色，实现角色的级联鉴权。

# **2.**  ** **  **需求分析**

开发文档：

  [角色级联设计文档 - 张志鹏 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109588800)  

规格约束：

1.禁止role成环，也不  能给role重复授权role

2.  grant role to role是延迟生效的，即如果用户A拥有roleA, 用户登录，此时只有roleA

如果此时grant roleB to roleA, 用户A将不会继承roleB角色。只有当用户A退出再连接，或者另起连接才同时拥有roleA,roleB。

drop role 立即生效

3.用户登录可生效的role的上限为148，如果用户拥有的role超过这一限制值，根据ID排序取前148个生效

-- create session的特殊处理：前148个role没有create session权限，第149个role拥有create session权限，此时第149个role将顶替第148个role，使用户拥有create session权限

-- 超过148之后再drop的特殊处理：drop 148 之前的ID，后续role会复用ID，这点与Oracle不同

-- 用户可被授予的role原则上无上限

4.SYS用户和DBA角色为特权用户，特权用户的角色权限回收不会影响其行为；public角色的权限所有用户默认拥有

5.HA环境，role权限授予/回收要求主备同步    


6.grant role to role 不支持带option

7.分布式和集群在当前转测时期不支持，要求拦截

  


# **3.**  ** **  **详细测试设计**

1.grant /revoke  role to role 语法测试

2.相关视图测试

user_role_privs视图 查看用户直接拥有的角色

role_role_privs视图 查看用户拥有的角色其角色关系

动态视图v$session_roles 查看当前用户生效的角色

DBA_SYS_PRIVS视图 用户或者角色的系统权限信息

DBA_ROLE_PRIVS 角色间的授权信息

DBA_TAB_PRIVS视图 所有授权的对象权限信息

3.用户登录可生效的role 上限为148    
  超过148时，根据ID排序取前148个生效    
  超过148后再drop，drop 148 之后的ID    
  drop148之前的ID – ID复用，与Oracle不同

4.role权限覆盖：

系统级权限    
  数据库与会话权限    
  表空间权限权限    
  安全管理类系统权限    
  对象操作类系统权限

5.验证直接继承 间接继承权限

6.role权限授予/回收 主备同步：在主机测试，备机验证：role1（权限1）授予用户1，删除role1，再创建同名role1 （权限1）    
  此时用户不再拥有role1 的权限1    
  7.考虑特殊场景

role1（权限1）授予用户1，删除role1，再创建同名role1 （权限1）    
  role1（权限1）授予用户1，删除role1，再创建同名role1 （权限2） 授予用户1    
  前148个role没有create session权限，第149个role拥有create session权限    
  多用户，多角色，多权限后重启数据库

用户-role1 - role2 ,当role2失效时，原本能执行的SQL语句预期执行失败

public角色：所有用户都默认拥有的角色，无需grant    
  内置角色授予其他角色/内置角色    
  ALTER SESSION SET CURRENT_SCHEMA 角色级联校验

8.drop role测试

9.分布式拦截

  


![](https://pingcode.yasdb.com/atlas/files/public/6739698ea1ad9a3311dc7784/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDcxNzYsImV4cCI6MTc4MjIxNzk3Nn0.K2cR-313jvOEZyW4irGBhnzFkRuxI-gjAjOGTwsMMng)

[支持role级联权限认证测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGU4OTcwYzJhZjRmNTFmOTBkIiwicmVmX2lkIjoiNjczOTY5OGU1OTNmOTljOWZmMjM0ZmRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MTc1LCJleHAiOjE3ODIyOTM1NzV9.mhGwOJpZ1c4rr5K_KXw-h3SFizR3geD9iVtLV3lL1NM)

|专项|是否涉及|
|:---|:---|
|并发|√|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|√|
|安全|否|
|DFR/testkill|√|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# **4.**  ** **  **测试用例**

  


  [standalone/testcase/storage_dfx/db_Privilege/cascade_role · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage_dfx/db_Privilege/cascade_role)  

|  
|用例编号|用例测试点|级别|模块|版本交付|交付形态|是否自动化|备注|
|---|---|---|---|---|---|---|---|---|
|1|test_sdv_ydbrd13577_role_01|验证可生效role为148个,-- 创建1000个    `create session 权限的test_role ，检查视图dba_roles  DBA_SYS_PRIVS符合预期`  ,  `--创建1000个t_role 将相应的test_role 授予t_role，验证没有其他权限`  ,  `-- 检查视图user_role_privs  role_role_privs  符合预期`  ,  `-- 当前和删除两个role之后，验证v$session_roles中生效role都为148`  ,  `--通过role name验证ID复用`  ,  `-- 重复授权 role，预期报错`  ,  `-- drop 2000个role`  |  
|  
|23.1|单机|是|  
|
|2|test_sdv_ydbrd13577_role_02|验证禁止role成环,  `验证可间接继承role权限`  ,  `--从role 回收拥有登录权限的role ，从另一session回收 延迟生效,登录失败`  ,  `--role回收全部权限，对应用户失去全部权限`  ,  `从角色revoke 不存在的角色 ，预期报错`  ,  `结合数据库会话权限的授权、 回收操作`  |  
|  
|23.1|单机|是|  
|
|3|test_sdv_ydbrd13577_role_03|  `drop 具有登录权限的role，该用户登录失败`      `重复drop role, 预期报错`      ` `  ,  `create 已drop的同名role，给已drop的同名role 授予登录权限`  ,  `另一session drop role，验证 drop role时立即生效`  ,  `结合表空间权限，ALTER SYSTEM权限`  |  
|  
|23.1|单机|是|  
|
|4|test_sdv_ydbrd13577_role_04|  `验证create session的特殊处理`  ,  `--创建148个role，并授予create table权限，第149 个role ，授予登录权限，预期登录成功`  ,  `结合审计权限，验证角色权限的授予和回收`  |  
|  
|23.1|单机|是|  
|
|5|test_sdv_ydbrd13577_role_05|  `多用户，多角色，多权限`  ,  `-- 不同用户授予级联角色，角色拥有不同用户的对象权限，验证对象级权限的授予 、回收都符合预期`  ,  `结合权限管理类权限，存储刚要，对象级权限`  |  
|  
|23.1|单机|是|  
|
|6|test_sdv_ydbrd13577_role_06|  `内置角色`  ,  `--CONNECT 角色 、 RESOURCE角色、SYSDBA、 SYSOPER 授予普通角色，验证级联拥有该角色的用户拥有对应权限`  |  
|  
|23.1|单机|是|  
|
|7|test_sdv_ydbrd13577_role_07|  `public 角色`  ,  `-- public 角色,所有用户默认拥有，将普通角色授予 PUBLIC，此时 public 角色预期拥有role的权限`  ,  `--角色用例的权限包含系统权限和对象权限，验证权限的授予、 回收都符合预期`  |  
|  
|23.1|单机|是|  
|
|8|test_sdv_ydbrd13577_role_08|  `内置角色之间的级联授权`  ,  `-- connect  RESOURCE public`      `内置角色授权 回收操作符合预期`  ,  `内置角色成环，预期报错`  |  
|  
|23.1|单机|是|  
|
|9|test_sdv_ydbrd13577_role_09|  `切换schema`  ,  `--拥有级联角色的用户，授予其他用户的对象操作权限`  ,  `-- 切换 schema，预期有权限 允许操作，无权限预期报错`  ,  `schema 修改结合 public 角色测试`  |  
|  
|23.1|单机|是|  
|
|10|test_sdv_ydbrd13577_sit_role_01|  `视图权限补充用例:判断视图owner对于视图的权限是否还有效`  ,  `dba 权限 ，sysdba 权限 ，sysoper 权限，security_admin 权限授予 回收测试`  |  
|  
|23.1|单机|是|  
|


# **5.**  ** **  **测试框架设计**

单机：Guider+ yasft框架

分布式：Codbase_test

# **6.**  ** **  **测试环境说明**

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

单机normal

## Attachments:

[支持role级联权限认证测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGU4OTcwYzJhZjRmNTFmOTBkIiwicmVmX2lkIjoiNjczOTY5OGU1OTNmOTljOWZmMjM0ZmRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MTc1LCJleHAiOjE3ODIyOTM1NzV9.mhGwOJpZ1c4rr5K_KXw-h3SFizR3geD9iVtLV3lL1NM)

 (application/x-xmind)    
