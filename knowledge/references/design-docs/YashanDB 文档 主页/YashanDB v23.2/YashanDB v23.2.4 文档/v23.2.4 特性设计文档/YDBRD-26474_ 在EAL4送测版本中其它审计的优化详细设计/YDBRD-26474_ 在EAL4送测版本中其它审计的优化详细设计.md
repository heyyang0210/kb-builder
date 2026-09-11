Created by 王林, last modified on 十月 18, 2024

*SR链接：*    [YDBRD-26474 在EAL4送测版本中其它审计的优化](https://pingcode.yasdb.com/pjm/items/661f9ff1fd997db58adbc83c? #YDBRD-26474 在EAL4送测版本中其它审计的优化)  

涉及内容：  再启停审计、黑白名单审计、记录事务id,等审计优化

由于LBAC的审计有单独的SR，本次交付内容不涉及LBAC审计内容。

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

    在EAL4测试中，对某些操作场景新增了审计处理，比如数据库启动、黑白名单检测、回滚操作记录对应事务的id等，这些场景的审计处理是对统一审计功能的补充和增强，需要落到通用版本中。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

EAL4测评中，对于单机和集群，新增了对某些场景需要进行审计的要求，

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

《    [YDBRD-26474 在EAL4送测版本中其它审计的优化调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=159430865)    》 , 相关内容为：

DM支持对startup的审计，

Oracle 对审计记录的表或视图的约束：O  racle 不允许直接查看操作审计记录表，具有exec on DBMS_AUDIT_MGMT 权限的用户 或 DBA 用户或SYS用户才可以执行审计清理操作，其他操作均不允许。

Oracle 审计记录表 AUD$UNIFIED 中有字段 transaction_id

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

根据EAL4认证测试用例，整理了新增审计处理内容，见    [《EAL4 审计涉及的点列表》](https://conf.yasdb.com/pages/viewpage.action?pageId=159422579)    。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|兼容性|----|----|否|否|
|功能|数据库启动：yasboot方式nomount, mount, open|新增审计项：startup, 在ankStartup执行处，增加对数据库启动的审计，,nomount, mount 方式时，审计记录写run.log日志文件，其中object_name 标识 nomount, mount；,open方式时，启动成功写系统表，否则写run.log日志文件。|是|是|
|功能|登录：密码过期记录审计事件|识别密码过期错误，添加LOGON审计判断处理|是|是|
|功能|登录：识别密码方式：OS, PASSWORD,,PASSWORD WITH UKEY， OS WITH UKEY|在LOGON审计记录中，object_name 记录密码方式|是|是|
|功能|登录：ssl开启，登录时体现ssl信息|在LOGON审计记录中，  AUTHENTICATION_TYPE 中的 PROTOCOL=tcps|是|是|
|功能|审计记录的处理添加约束|需要区分三权分立是否打开，在打开的情况下：,（1）对aud$unified, unified_audit_trail视图 只有具有audit_admin权限的用户或sys才允许查看,（2）删除审计记录，只能是sys用户或具有audit_admin权限的用户才可以删除,（3）其他操作任何用户都不允许|是,  
|是|
|功能|更改用户密码：  密码复杂度报错需要审计   |将判断密码复杂度从parse阶段调整到verify阶段|是|是|
|功能|添加事务ID|对审计记录表及视图，新增字段transaction_id(bigint)，记录处理语句的事务ID|是|是|
|功能|添加用户属性|在审计记录表及视图，新增字段 role (varchar(64)), 标识用户是：security admin, audit admin, system admin, normal|是|是|
|功能|对黑白名单的审计|新增审计项：ip control，在黑白名单判断处理时进行审计|是|是|
|可修改性|----|----|否|否|
|可用性|----|----|否|否|
|可维可测|----|----|否|否|
|可靠性|----|----|否|否|
|周边配合|----|----|----|否|
|周边配合|审计|新增了审计项：startup, ip control|是|否|
|周边配合|导入导出工具|审计系统表aud$unified 新增了字段：transaction_id, role|是|是|
|安全|安全场景1|----|否|否|
|性能|性能场景1|由于需要识别系统表aud$unified 及视图unified_audit_trail，可能对性能有一点影响|否|否|
|易用性|----|----|否|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|无|  
|  
|  
|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

  


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|高级包子对象描述|----|否|
|系统视图|审计记录视图UNIFIED_AUDIT_TRAIL新增,字段 transaction_id, role|----|是|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|yasboot启动数据库的审计记录，写入run.log|----|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

新增的审计，满足EAL4测试项需要。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

审计场景增强及审计记录内容增加。

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

**系统表**

系统表AUD$UNIFIED 新增字段

```
transaction_id         BINARY_BIGINT,
ROLE                   VARCHAR(64)
```

  


**视图**

视图UNIFIED_AUDIT_TRAIL 新增字段

TRANSACTION_ID ：事务id

ROLE ： "SECURITY ADMIN" , ”AUDIT ADMIN“, ”SYSTEM ADMIN“, ”NORMAL“

  


**结构体**

结构体 UnifiedAudRecordInfo 新增字段

```
typedef struct StUnifiedAudRecordInfo {
  ...
  CodUint64   txid;
  CodChar     role[COD_NAME_BUFFER_SIZE]
  ...
} UnifiedAudRecordInfo;
```

  


结构体AuditQueueNode新增字段

```
typedef struct StUnifAudQueueNode{
  ...
  CodUint64   txid;
  CodChar     role[COD_NAME_BUFFER_SIZE]
  ...
} AuditQueueNode;
```

  


**审计项**

|名称|描述|场景|
|---|---|---|
|STARTUP|数据库启动|yasboot方式启动数据库|
|IP CONTROL|黑白名单IP检测|用户登录|


###   [4.2 审计数据库启动](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

支持对yasboot方式启动数据库的审计，审计日志写入run.log日志中。

![](https://pingcode.yasdb.com/atlas/files/public/67396dbea1ad9a3311dc936c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFRQUFBQUFBQUFHQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEzMjksImV4cCI6MTc4MjMyMjEyOX0.qfrdBTvl0xkZEOad5FNM6brP-9RIlEbygPTE1ifesn0)

不论是否添加针对startup的审计，以nomount, mount 方式启动时，审计记录写run.log日志文件；以open方式启动时，启动成功且审计开关打开时写系统表，启动失败将审计信息写入run.log日志文件。

写入run.log文件中审计记录内容格式示例：

```
[AUDIT] ACTION:STARTUP NOMOUNT, SESSIONID:0, OS_USER:wln, HOST_NAME:vm161, INSTANCE_ID:0, DBID:0, AUTHENTICATION_TYPE:(TYPE=(DATABASE));(CLIENT ADDRESS=((PROTOCOL=uds)(HOST=12.0.0.1))), USER:, CLIENT_PROGRAM_NAME:yasdb, RETURN_CODE:0, THREAD_ID:140559937459776, SCN:0, CURRENT_USER:, UNIFIED_AUDIT_POLICIES:, SYSTEM_PRIVILEGE_USED:0, SQL_TEXT: [anl_audit.c:1739]
```

其中 ACTION 标识启动类型”STARTUP NOMOUNT“、"STARTUP MOUNT"、"STARTUP OPEN"。

若以OPEN方式启动成功，则审计系统表字段OBJECT_NAME 对应”STARTUP OPEN“。

  


###   [4.3 用户登录](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

（1）登录的鉴别机制

分为OS方式登录、普通密码方式登录、是否使用UKEY登录。细分为如下4中类型：

|登录方式|描述|
|---|---|
|OS|基于操作系统的认证|
|OS WITH UKEY|基于UKEY的  操作系统的认证|
|PASSWORD|基于口令的认证|
|PASSWORD WITH UKEY|基于UKEY的口令的认证|


鉴别机制信息存储在登录对应的审计日志的OBJECT_NAME字段中。

（2）新增登录报错场景的审计

在用户登录时，若密码过期，支持对该场景写审计记录。

（3）登录的审计日志体现SSL的状态

开始SSL后，登录的审计日志中  AUTHENTICATION_TYPE 中的 PROTOCOL=tcps。

###   [4.4 增加审计记录表和视图操作约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

审计记录表AUD$UNIFIED

操作行为：只支持select

权限要求：

三权分立关闭时，正常的权限校验； 

三权分立打开时，除了正常的权限校验外，额外增加了检测条件：SYS用户或者有audit_admin权限的用户。

  


审计记录视图 UNIFIED_AUDIT_TRAIL

操作行为：只支持select

权限要求：

三权分立关闭时，正常的权限校验； 

三权分立打开时，除了正常的权限校验外，额外增加了检测条件：SYS用户或者有audit_admin权限的用户。

  


清理审计记录

高级包DBMS_AUDIT_MGMT.CLEAN_AUDIT_TRAIL

操作行为：execute

权限要求：

三权分立关闭时，正常的权限校验； 

三权分立打开时，除了正常的权限校验外，额外增加了检测条件：SYS用户或者有audit_admin权限的用户。

  


判断处理逻辑：

verify kernel table privilege 处理函数中，增加对系统表aud$unified、系统视图unified_audit_trail的 识别，检测用户操作行为是否为select，再检测用户是否为sys或者有audit_admin权限 。

对用户赋予或取消audit_admin角色权限时，同其它对用户赋角色权限一样，会话级别生效。

  


###   [4.5 审计用户密码复杂度报错](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

密码复杂度校验当前是放在parse阶段，需要移动到verify阶段，达到能够对这种报错进行审计的目的。

###   [4.6 审计记录添加事务ID](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

根据EAL4测试要求需要，对审计记录表aud$unified 新增列 transaction_id，对审计记录视图新增列 transaction_id，用来记录执行语句的事务ID

###   [4.6 审计记录添加用户角色类型](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

根据EAL4测试要求需要，对审计记录表aud$unified 新增列 role，对审计记录视图新增列 role，用来记录用户的角色类型，包含：”SECURITY ADMIN“, ”AUDIT ADMIN“, ”SYSTEM ADMIN“, ”NORMAL“。

用户的role角色类型为session级别。用户可以拥有1个或多个角色类型。

（1）若用户不存在 或无法获取用户信息，则role 对应NULL

（2）若是登录失败，则根据用户的角色信息来识别对应的角色类型。

（3）其他情况下，根据用户登录的session->handler信息获取用户的角色类型。

###   [4.6 审计黑白名单检测](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

根据EAL4测试要求需要，增加对黑白名单拦截的审计。在设置黑名单或白名单未被允许通过时，增加审计记录，审计记录写入审计系统表中。

![](https://pingcode.yasdb.com/atlas/files/public/67396dbea1ad9a3311dc936d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFRQUFBQUFBQUFHQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTEzMjksImV4cCI6MTc4MjMyMjEyOX0.qfrdBTvl0xkZEOad5FNM6brP-9RIlEbygPTE1ifesn0)

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- 针对数据库启停测试


```
--yasboot方式安装数据库
rm -rf /data/home/wln/.yasboot/yashandb.env
rm -rf /data/home/wln/anchorbase/install/om
rm -rf /data/home/wln/cluster/instance0/*
yasboot package config gen --cluster yashandb -u wln -p password --ip 127.0.0.1 --port 22 --install-path /data/home/wln/anchorbase/install  --data-path /data/home/wln/cluster/instance0 --begin-port 1688 --yas-type SE
cd ~/anchorbase/install
tar zcvf yashandb.tar.gz ./*
yasboot package install -t hosts.toml -i /data/home/wln/anchorbase/install/yashandb.tar.gz 
yasboot cluster deploy -t yashandb.toml
yasboot cluster stop -c yashandb 
--测试
yasboot cluster start -c yashandb -m nomount
yasboot cluster start -c yashandb -m mount
yasboot cluster start -c yashandb -m open
--查看run.log审计日志信息
```

- 密码过期测试


```
-- 口令过期被锁定
描述：设置用户密码存在时间，超过时间规定登录报错并写审计日志
 
-- 创建用户
create profile audit_profile1 limit password_life_time 0.0001 password_grace_time 0;
create user audit_user1 identified by test profile audit_profile1;
grant create session to audit_user1;
 
-- 创建策略
create audit policy policy1 actions logon;
audit policy policy1 by audit_user1;
 
-- sleep 10s
execute dbms_lock.sleep(10);
 
--尝试登录，报 YAS-02239 the password has expired
conn audit_user1/test@127.0.0.1:1688
 
-- 查看审计记录
conn regress/regress@127.0.0.1:1688
select client_program_name, authentication_type, os_user, host_name, dbid, dbusername, event_timestamp, action, return_code, unified_audit_policies from unified_audit_trail where unified_audit_policies = upper('policy1') and return_code = 2239;
 
CLIENT_PROGRAM_NAME                                              AUTHENTICATION_TYPE                                              OS_USER                                                          HOST_NAME                                                                DBID DBUSERNAME                                                       EVENT_TIMESTAMP                                                  ACTION                                                            RETURN_CODE UNIFIED_AUDIT_POLICIES                                          
---------------------------------------------------------------- ---------------------------------------------------------------- ---------------------------------------------------------------- ---------------------------------------------------------------- ------------ ---------------------------------------------------------------- ---------------------------------------------------------------- ---------------------------------------------------------------- ------------ ----------------------------------------------------------------
yasql                                                            (TYPE=(DATABASE));(CLIENT ADDRESS=((PROTOCOL=tcp)(HOST=127.0.0.1)(PORT=18496))) wln                                                              vm161                                                                       0 AUDIT_USER1                                                      2024-01-10 11:07:47.724240                                       LOGON                                                                    2239 POLICY1                                                        
 
其中错误码 2239 对应错误 the password has expired， 口令过期锁定重新输入密码即可解锁
 
-- 清理
noaudit policy policy1 by audit_user1;
drop audit policy policy1;
drop user audit_user1;
drop profile audit_profile1;
```

- 密码复杂度


```
ALTER SYSTEM SET "_check_password_complexity"=true SCOPE=BOTH;
create audit policy up1 actions create user, alter user;
audit policy up1;

create user u1 identified by test;
create user u1 identified by abc@123ABC;
alter user u1 identified by test;
alter user u1 identified by abc@123BCD;
conn regress/regress@127.0.0.1:1688
select * from unified_audit_trail;
```

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

（1）视图    [UNIFIED_AUDIT_TRAI.md](http://UNIFIED_AUDIT_TRAI.md)     文档修改

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

无

  


  


  


  


  


  


  


  


## Attachments: