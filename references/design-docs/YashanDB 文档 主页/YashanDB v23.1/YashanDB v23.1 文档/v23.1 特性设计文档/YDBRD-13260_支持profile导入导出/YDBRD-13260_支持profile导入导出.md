Created by 史鑫, last modified on 十月 15, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#1-overview%E6%A6%82%E8%BF%B0)  

用户资源配置信息Profile

##   [2 规格说明](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#21-%E8%A7%84%E6%A0%BC%E8%AF%B4%E6%98%8E)  

（1）导出：全库带profile信息，tables/user不带

（2）导入：全库带profile信息，tables/FROMUSER不带

（3）profile的资源限制，没有做，仅有密码相关限制。此sr支持的语法全貌如下：

（4）用户与profile的关联：SYS/非SYS。

创建/更新：

![](https://pingcode.yasdb.com/atlas/files/public/67396ae0a1ad9a3311dc7e37/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUZBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBQUFBQUFBQUFBUUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFJQVFBRUFBQUlBQUFnQVlnQUFBQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBRUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk2ODEsImV4cCI6MTc4MjMwMDQ4MX0.BfI_HP6v2p-ynvDs2qV1jI667GpfKAJPRJ5_FVJqEAI)

关联用户：

alter user profile profile_name;

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#51-architecture%E6%9E%B6%E6%9E%84)  

####   [5.1.1 文件格式](#511-文件格式)  

#### 整体格式

![](https://pingcode.yasdb.com/atlas/files/public/67396ae08970c2af4f51ffbf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUZBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBQUFBQUFBQUFBUUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFJQVFBRUFBQUlBQUFnQVlnQUFBQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBRUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk2ODEsImV4cCI6MTc4MjMwMDQ4MX0.BfI_HP6v2p-ynvDs2qV1jI667GpfKAJPRJ5_FVJqEAI)

create profile 放在create user前。

#### 具体格式

![](https://pingcode.yasdb.com/atlas/files/public/67396ae0a1ad9a3311dc7e38/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUZBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBQUFBQUFBQUFBUUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFJQVFBRUFBQUlBQUFnQVlnQUFBQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBRUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk2ODEsImV4cCI6MTc4MjMwMDQ4MX0.BfI_HP6v2p-ynvDs2qV1jI667GpfKAJPRJ5_FVJqEAI)

细节说明：

（1）内置用户采用alter 将profile与用户关联。

（2）非内置用户，create user指定

（3）文件中有profile，非full导入全部忽略。

####   [5.1.2 查询方式](#512-查询方式)  

|信息|视图|完整语句|所需信息|关注点|
|---|---|---|---|---|
|profile信息|DBA_PROFILES|CREATE PROFILE "PROF_1" LIMIT COMPOSITE_LIMIT DEFAULT SESSIONS_PER_USER DEFAULT CPU_PER_SESSION DEFAULT CPU_PER_CALL DEFAULT LOGICAL_READS_PER_SESSION DEFAULT LOGICAL_READS_PER_CALL DEFAULT IDLE_TIME DEFAULT CONNECT_TIME DEFAULT PRIVATE_SGA DEFAULT FAILED_LOGIN_ATTEMPTS 1 PASSWORD_LIFE_TIME DEFAULT PASSWORD_REUSE_TIME DEFAULT PASSWORD_REUSE_MAX DEFAULT PASSWORD_LOCK_TIME DEFAULT PASSWORD_GRACE_TIME DEFAULT INACTIVE_ACCOUNT_TIME DEFAULT|  
|（1）不进行设置，则LIMIT全是DEFAULT，导出时，全部以limit字段导出，就没问题。,（2）expr无需特殊处理，直接导出LIMIT。|
|profile 与user的对应关系|DBA_USERS->profile字段|--内置用户    
  ALTER USER "SYS" IDENTIFIED EXTERNALLY TEMPORARY TABLESPACE "TEMP" PROFILE "PROF_1"    
  --创建的用户    
  CREATE USER "SX1" IDENTIFIED EXTERNALLY DEFAULT TABLESPACE "USERS" TEMPORARY TABLESPACE "TEM P" PROFILE "PROF_1"|  
|（1）用户创建后不指定，回以内置的default profile与其关联，创建用户/alter，不管profile的名字形式，全部带上。,（2）profile在create user语句中的位置：最后位置|


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
--user
drop user user1 cascade;
drop user user2 cascade;
create user user1 identified by 1;
create user user2 identified by 1;
grant dba to user1;
grant dba to user2;

drop profile profie_1 cascade;
drop profile profie_2 cascade;
drop profile profie_3 cascade; 

--profie_1:default/unlimited/expr
CREATE PROFILE profie_1 LIMIT FAILED_LOGIN_ATTEMPTS 1 PASSWORD_LIFE_TIME unlimited PASSWORD_REUSE_TIME DEFAULT PASSWORD_REUSE_MAX 2 PASSWORD_LOCK_TIME DEFAULT PASSWORD_GRACE_TIME 1;

--profie_2:expr
CREATE PROFILE profie_2 LIMIT FAILED_LOGIN_ATTEMPTS 3*3*4/2;

--profie_3:全部参数不设置
CREATE PROFILE profie_3 limit;
--普通用户的profile
alter user user1 profile profie_1;
alter user user2 profile profie_2;
--内置用户的profile
alter user sys profile profie_3;

场景：
（1）模式
（2）导入重名profile
F:\代码\anchorbase-fix\anchorbase\out\build\x64-Debug\bin>imp sys/Cod-2022 file=a full=y
YashanDB Import Debug 23.1.0.0 AMD64 3095f20a1b
YAS-02013, name is already used by an existing object. sql:CREATE PROFILE "PROFIE_1" LIMIT  PASSWORD_GRACE_TIME  1  PASSWORD_LOCK_TIME  DEFAULT  PASSWORD_REUSE_MAX  2  PASSWORD_REUSE_TIME  DEFAULT  PASSWORD_LIFE_TIME  UNLIMITED  FAILED_LOGIN_ATTEMPTS  1
import terminated successfully with warnings

查询对象：
select * from DBA_PROFILES order by PROFILE,RESOURCE_NAME,RESOURCE_TYPE,LIMIT;
select * from dba_users order by USERNAME,PROFILE;
select * from user1.t1;
select * from user2.t1;
```

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

##   [9. ProFile代码走读总结](#9-profile代码走读总结)  

设计文档：    [Profile设计文档 - 张志鹏 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=98508092)  

default profie：默认的资源限制，静态编译至内存，建库时写入系统表；

（1）系统表

profile$，profile的基本信息，user$关联profile的id；

profileName：名字等基本信息。

（2）DC

profile 为DictManager 全局信息；

user关联profile的方式：userDict记录 Profile id + profileVersion；其中profile id为数组下标；profileVersion用于控制drop profile和 login的并发，profile drop 后，profileVersion 和userDict->profileVersion对不上，使用default的profile；

（3）并发控制

|session1 - user1|session2 - user1|效果||
|---|---|:---:|---|
|alter profile|login|user1：alter 加X锁，2阶段恢复DC|user2： 加S锁，取profile，深拷贝到userDict下认证|
|drop profile|login|user1：alter 加X锁，2阶段恢复DC，profileVersion++|user2： 加S锁，取profile，useDict→profileVersion和全局的不一致，使用默认的profle。|
|alter profile/drop profile|alter user sys profile prof_1;|user1：X锁|user2： 加S锁，深拷贝profile数据|


注：内部查询profile 通过id直接锁定slot；alter等操作是低频操作，暂时没有通过名字查找的hashBucket加速。

数据结构：

![](https://pingcode.yasdb.com/atlas/files/public/67396ae0a1ad9a3311dc7e39/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUZBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQWdBQUFBQUFBQUFBUUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFJQVFBRUFBQUlBQUFnQVlnQUFBQUFBQUFBQUNBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBRUFBQUFDQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk2ODEsImV4cCI6MTc4MjMwMDQ4MX0.BfI_HP6v2p-ynvDs2qV1jI667GpfKAJPRJ5_FVJqEAI)

## Attachments:

[image2022-11-19_14-32-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTBhMWFkOWEzMzExZGM3ZTM0IiwicmVmX2lkIjoiNjczOTZhZTA1OTNmOTljOWZmMjM1YWUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NjgxLCJleHAiOjE3ODIzNzYwODF9.GYI9HiTryuL728llwu0WDNndrE7yjHmn-rjRV8RURaU)

 (image/png)    
