Created by 刘丹, last modified on 五月 15, 2024

IR：    [YASHAN-925 【mysql兼容】支持特定的视图&系统表](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2ed?%20#YASHAN-925%20%20%E3%80%90mysql%E5%85%BC%E5%AE%B9%E3%80%91%E6%94%AF%E6%8C%81%E7%89%B9%E5%AE%9A%E7%9A%84%E8%A7%86%E5%9B%BE&%E7%B3%BB%E7%BB%9F%E8%A1%A8)  

SR:     [YDBRD-26300 支持mysql模式下特定视图及系统表](https://pingcode.yasdb.com/pjm/items/66192d90fd997db58ad8a75d?%20#YDBRD-26300%20%E6%94%AF%E6%8C%81mysql%E6%A8%A1%E5%BC%8F%E4%B8%8B%E7%89%B9%E5%AE%9A%E8%A7%86%E5%9B%BE%E5%8F%8A%E7%B3%BB%E7%BB%9F%E8%A1%A8)  

# 1. 概述

支持mysql的五个系统表，mysql.user,mysql.db,msql.table_priv,mysql.columns_priv,mysql.procs_priv,级别分别是：全局级别、数据库层、表级、列级、子程序级

# 2. 需求分析

  [【YDBRD-26300】支持mysql模式下特定视图及系统表调研 - 刘丹 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/resumedraft.action?draftId=150628644&draftShareId=4d783106-713e-449e-90f3-7111f175b7c5&)  

## 2.1 功能点分析

共涉及5个视图，根据权限级别从大到小依次是  USER(全局权限  DBA_USERS  )>db(数据库级权限  SYS.  USER  $  )>tables_priv(表级权限)(  DBA_TAB_PRIVS)  >columns_priv(列级权限)>procs_priv(对象级别权限  DBA_OBJECTS O, DBA_SYS_PRIVS  )

- USER视图主要记录了用户的基本信息
- DB视图主要记录了库里对应用户的权限，给用户1在test库select,insert的权限，记录在这个视图
- tables_priv视图主要记录了一个表拥有的对象级权限，比如给user1用户下的table1，select的权限
- columns_priv视图主要记录对表某个列的权限(yashan目前不支持）
- procs_priv视图主要记录了存储存储过程和函数级别的权限信息，例如哪些用户有权执行特定的存储过程或函数。


```
mysql语法：
grant select on test.t1 to 'user1'@'%';--只在tables_priv视图中可以查询
grant select on test.*  to 'user1'@'%';--只在db视图中可以查询
grant select on *.*  to 'user1'@'%';--只可以在user视图中查询到
```

  


权限总和：

|权限类型|权限名称|作用|备注|
|---|---|---|---|
|role_privilege|PUBLIC，CONNECT（会话），RESOURCE（table，sequence,procedure,trigger），SELECT_CATALOG_ROLE(v$,gv$），AUDIT_VIEWER(审计)    
  DBA,AUDIT_ADMIN,SECURITY_ADMIN，SYSDBA(shutdown),SYSOPER(shutdown),SYSBACKUP---管理员|  
|  
|
|object_privilege|ALL PRIVILEGES、INSERT、update、delete、select、alter、index、flashback、read、references|  
|  
|
|system_privilege|all privileges,system,database,session,audit,tablespaces,user,role,any table,any index,any sequence,create view,create proceudure,trigger|  
|  
|


## 2.2 应用场景

- 对用户、对象执行grant或者revoke操作，在视图中查看具体所对应的权限是否被记录


## 2.3 规格约束

- 不支持授予权限给FUNCTION或PROCEDURE类型的对象（feature "privileges on specified object type" has not been implemented yet），因此mysql.procs_priv视图查询的结果恒为空
- mysql.table_privs视图查询的Table_priv字段不会出现'Create','Drop','Grant','Show view','Create view','Trigger'   
- 不支持权限控制到列，因此mysql.columns_priv视图查询结果恒为空，mysql.table_privs视图查询的Column_priv字段结果恒为空
- enum，set，text类型当前不支持, desc 分别显示为char, varchar, varchar


# 3. 详细测试设计

## 3.1 测试设计方法

对于本次设计主要采用场景法

- 通过构造不同权限场景，在视图中查看是否记录了相应的权限；取消权限后，视图中相应的场景也要减少


## 3.2 详细测试设计

涉及场景：

1.环境：单机，集群，分布式

|系统级DFX分类|是否涉及|
|---|---|
|CT|涉及|
|KT|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


视图字段验证：字段个数与数据类型与mysql系统表一致(除  enum，set，text)

|序号|视图名|字段个数|备注|
|---|---|---|---|
|1|procs_priv|8|不支持授予权限给FUNCTION或PROCEDURE类型的对象，视图查询结果恒为空|
|2|columns_priv|7|默认粒度到表，查询结果恒为空|
|3|tables_priv|8|Column_priv字段结果恒为空|
|4|db|22|  
|
|5|USER|45|  
|


功能验证：

|编号|测试场景||用例详细描述|预期|备注|
|---|---|---|---|---|---|
|1|基础场景|  
|mysql兼容模式下，可以正常查询到这5个视图，(select,  desc---兼容模式下支持  )|字段准确，数据类型准确|覆盖兼容模式和非兼容模式|
||  
|  
|兼容模式下，通过dba_tab_columns查询视图的字段|可查询，字段准确，数据类型准确|  
|
|2|tables_priv视图|权限列|创建一个一张表table1和一个新用户user1，给予这个user1用户insert、update、delete、select、alter、references、index table1的权限,收回部分权限，,收回全部权限|在table_priv视图的Table_priv字段中可以查询出来新用户下已经授予的表级权限,Table_priv字段减少,table_priv视图查询为空|其余字段对比DBA_TAB_PRIVS视图,覆盖SYS用户，DBA用户授权|
|  
|  
|  
|创建一个角色role1和一张表table1，将insert、update、delete、select、alter、references、index 权限赋予这个role1，在创建一个用户user1,将role1角色给予user1用户,在创建一个角色role2和一个用户user2，将role1授予role2，在将role2授予user2,解除role1对role2的授权|在table_priv视图的Table_priv字段中可以查询出来新用户下已经授予的表级权限,  
,查询字段不变,user2的字段为空|  
|
|  
|  
|  
|创建一个角色role1和一张表table1，将部分权限授予role1，创建用户user1,将role1授予user1,然后再将剩余的部分权限直接授予user1,,解除role1对user1的授权|在视图中查询到已经授予的权限,  
,在视图中可以查询到新授予部分的权限,视图中查询到的权限减少|  
|
|  
|  
|  
|创建一个一张表table1和一个新用户user1，将这个表的ALL PRIVILEGES权限授予用户user1,删除这个表table1，|Table_priv字段包含所有对象,  
,查询结果为空|  
|
|  
|  
|权限级别|同上|db视图和user视图中对应字段查询字段都是N|  
|
|  
|多表|  
|创建用户user1，创建表t1,t2,t3，将t1的insert、update、delete权限授予user1,将t2的select、alter权限授予user1,将t3的references、index权限授予user1,撤销user1对t3和t2的所有权限|tables_privs视图user=user1,查询到3行记录|  
|
|  
|级联授权|  
|创建用户表t1，将表的select,update,insert,delete权限授予use1,带with grant option，alter、references、index授予user1不带with grant option,在user1用话下在将insert、update、delete、select、alter、references、index权限授予user2|select,update,insert,delete对user2授权成功，alter、references、index授权失败，ables_privs视图中user=user2的Table_priv字段只有select,update,insert,delete|  
|
|3|db视图|权限列|创建一个新用户，授予这个新用户系统级别的权限，,给予新用户user1,select any table的权限,收回user1用户的select any table的权限|db视图的Select_priv字段是Y,查询结果为空|覆盖系统级别的权限(表、表空间、索引、序列、同义词、视图、存储过程、触发器、with grant option),Host,DB,User列对比USER$表|
|  
|  
|  
|创建一个角色，授予这个角色所有系统级别的权限，在将这个角色授予用户,解除这个角色对用户的授权,重新授予这个用户部分系统级别的权限|db视图的对应权限字段是Y,查询字段为空,相对应的权限字段是Y|  
|
|  
|  
|权限级别|同上|table_priv视图查询为空|  
|
|  
|不支持|  
|Create_tmp_table_priv字段|不支持Create_tmp_table_priv权限，字段恒为N|  
|
|4|USER视图(权限)|权限列|创建一个新用户，将SYSDBA和SYSOPER角色授予这个新用户,解除SYSDBA和SYSOPER角色对新用户的权限|user视图中的Shutdown_priv字段是Y,user视图的Select_priv字段是N|其余字段对比dba_user和mysql视图,同上覆盖系统级别的权限|
|  
|  
|  
|创建一个角色，授予这个角色所有系统级别的权限，在将这个角色授予用户,解除这个角色对用户的授权,重新授予这个用户部分系统级别的权限|user视图的对应字段权限是Y,查询字段是空,相对应的权限字段是Y|  
|
|  
|  
|权限级别|同上|table_priv视图查询为空|  
|
|  
|ssl_type,ssl_cipher,x509_issuer,x509_subject|安全列|创建用户，授权,默认为空|对比mysql视图|  
|
|  
|max_questions、max_updates、max_connections、max_user_connections,plugin,authentication_string|资源列|默认为0,max_connections是针对所有用户的最大连接数，修改max_sessions参数，查询---  目前是按0处理|  
|  
|
|  
|password_expired,password_last_changed,password_lifetime,account_locked|用户密码|创建用户时指定对应的参数|查询的对应字段与dba_users相同|  
|
|  
|不支持|  
|Reload_priv（  flush语句  ）、Process_priv（进程）、File_priv（文件）、Create_tmp_table_priv（临时表）、Repl_slave_priv（  请求主库的binlog日志  ）、Repl_client_priv（  使用show master status, show slave status和show binary logs语句)、Show_view_priv、Event_priv|不支持，字段恒为N|  
|
|5|公共场景测试|  
|覆盖查询方式(直接查询，联合查询，like,带filter和不带filter,写操作拦截)|  
|  
|
|6|并发|  
|grant,revoke和select * 视图并发|无core和卡住的问题|没必要测试|


# 4. 测试用例

1、门槛用例

[支持mysql视图门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODg4OTcwYzJhZjRmNTIxOTMxIiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.mzOJfEMTAoQ8mlclYa-eHtHD_1AnryFWwNXr3OEOrLk)

  


2、文本用例

[兼容视图文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODg4OTcwYzJhZjRmNTIxOTMyIiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.tAbUJDlzqnfpI9wTHPg0D2dsKpmR-yhMV1BCtHeW-rU)

# 5. 测试框架设计

- guider框架


# 6. 测试环境说明

linux

# 7. 工作量评估

工作量：  *1人/7天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODlhMWFkOWEzMzExZGM5N2E1IiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.HBRIWjjl3vsHk-lJwRTMJ34zN54a1Tc__TgwsCeE-q4)

## Attachments:

[IO等待事件的文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODk4OTcwYzJhZjRmNTIxOTMzIiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.4EQmVVhLf72MPr0p5VyaEYuct70ehlWrg7p-4ltath8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[IO等待事件增加门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODlhMWFkOWEzMzExZGM5N2E2IiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.k3LIxe5bt7Y1iXBsuVzdNK4r2WRzgWCEJX0OFzC7TuQ)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[session_event文本用例模版.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODlhMWFkOWEzMzExZGM5N2E3IiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.pxakxSfIWCPzsymTbEsvy5fHU8ODCjlEt7SLk3vj75Q)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODlhMWFkOWEzMzExZGM5N2E1IiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.HBRIWjjl3vsHk-lJwRTMJ34zN54a1Tc__TgwsCeE-q4)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODlhMWFkOWEzMzExZGM5N2E4IiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.8OhrcCs30BQmGPOi_XmCxqEPI_S8VBfd-dddHp9RMys)

 (application/msword)    


[支持mysql视图门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODg4OTcwYzJhZjRmNTIxOTMxIiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.mzOJfEMTAoQ8mlclYa-eHtHD_1AnryFWwNXr3OEOrLk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[兼容视图文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODg4OTcwYzJhZjRmNTIxOTMyIiwicmVmX2lkIjoiNjczOTZlODg3MjgyMDZlZmI5MmYyOTBjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3ODA2LCJleHAiOjE3ODI1MjQyMDZ9.tAbUJDlzqnfpI9wTHPg0D2dsKpmR-yhMV1BCtHeW-rU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,与会人：刘丹、郑荃、李子怡、张鹏飞、林子豪、崔园园    
  会议时间：2024.05.07    
  会议地点：线上会议,会议  纪要：,1. 兼容模式下才可以desc视图
1. max_connections目前是按0处理
1. 并发可以不考虑
,Posted by liudan at 五月 07, 2024 18:24|
|---|
