Created by 史鑫, last modified on 十月 15, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#1-overview%E6%A6%82%E8%BF%B0)  

touser导入过程换对象的用户。将原始对象的owner换成touser指定的用户。默认值：NONE

目标：找出最小且合理的支持场景，解决现场问题。

##   [2 规格说明](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#21-%E8%A7%84%E6%A0%BC%E8%AF%B4%E6%98%8E)  

满足客户现场场景，部分约束：

（1）fromuser和touser的数量必须一致；可指定多个，fromuser会去重，touser不去重。去重后fromuser的数量和touser必须一致。

（2）touser要求  登录用户必须有dba权限

（3）权限级联说明

toUser开启后，仅导入grantor是tableOwner的权限。

（4）touser必须与formuser配合，单独touser，报错。统计项如下：

|语法|现象|约束|
|---|---|---|
|imp user1/1 full=y touser=user2 file=a|报错|报错|
|imp sys/Cod-2022  touser=user2 file=a|touser 必须配合使用fromuser|报错|
|imp sys/Cod-2022  fromuser=user3 touser=user2 file=a|user模式，指定fromuser=user3，则将user3 的数据导入到user2，|成功，登录用户user1必须有dba权限|
|imp sys/Cod-2022 fromuser=user3,user4 touser=user2 file=a|报错|报错，fromuser和touser的数量必须一致|
|imp sys/Cod-2022  fromuser=user3 touser=user2,user4  file=a|报错|报错，fromuser和touser的数量必须一致|
|**imp sys/Cod-2022  fromuser=user3,user3 touser=user2,user4  file=a**|**fromuser重复，只算一次，fromuser是1个，touser是2个，报错**|**报错，fromuser和touser的数量必须一致**|
|**imp sys/Cod-2022  fromuser=user3,user3 touser=user2 file=a**|成功|成功|
|imp sys/Cod-2022  fromuser=user4,user5 touser=user2,user2  file=a|touser重复，但是数量和fromuser一致  user4->user2，user5 -》user2，如果user4和user5有重名对象，则warning：对象已存在|成功|
|imp sys/Cod-2022  fromuser=user4 touser=notExist file=a|touser的用户notExist不存在，则报错：YAS-02010 user 'a' does not exist|报错|
|imp sys/Cod-2022  fromuser=user1,user2 touser=user3,user4  file=a|user1->user3，user2 -》user4|成功|
|imp sys/Cod-2022  touser=user2,user3 tables=t1 file=a|touser 必须配合使用fromuser|报错，touser 必须配合使用fromuser|
|imp sys/Cod-2022  fromuser=user1,user4 touser=user2,user3 tables=t1 file=a|成功|成功|
|imp sys/Cod-2022  fromuser=user1 touser=user2,user3 tables=t1 file=a|报错|报错，fromuser和touser的数量必须一致|
|  
|  
|  
|
|  
|  
|  
|


（5）用户下对象包括：Sequences，Synonyms，Tables，Indexes，Constraints（check,unique,PrimaryKeys,ForeignKeys）,对象：'VIEW', 'TRIGGER', 'PROCEDURE', 'PACKAGE', 'PACKAGE BODY', 'UDF', 'JOB'

（6）fromuser/touser个数限制：33824（list的限制）。

（7）fromuser/touser长度限制: 以67截断，不报错。

（8）所有arg的总长不能超 16KB

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#3-interfaces%E6%8E%A5%E5%8F%A3)  

  


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#51-architecture%E6%9E%B6%E6%9E%84)  

pair:fromuser ;touser记录导入用户切换信息。

对象：导入看到PUMP_TAG_OWNER：如果有以上pair，就切换到touser，否则切换到obj的owner。

对象权限：user1有表t1，user1:grant select on t1 to user2 with grant option;    user2:grant  select on t1 to user3; 导出表t1，再导入 fromuser=user1,  touser=user4，其中user2,user3,user4 都没有dba权限。   导入后，user2的t1权限的grantor由原来的user1变成user4。

导入出错的表：创建的表，touser中存在，且ignore=Y,表依赖的对象导入；ignore=N不导入表依赖对象

```
typedef struct StImpTouserPair {
    CodChar fromUser[COD_NAME_BUFFER_SIZE];
    CodChar toUser[COD_NAME_BUFFER_SIZE];
} ImpTouserPair;

typedef struct StImpContext {
    YacPump*         pump;
    YacChar          loginUser[COD_NAME_BUFFER_SIZE];
    ExpSummary       summary;
    CodChar          currOwner[COD_NAME_BUFFER_SIZE];//object owner
    CodChar          currSchema[COD_NAME_BUFFER_SIZE];//cur shchema,differ from object owner when has touser  --新增
    ImpStream        stream;
    CodChar*         bindBuf;      //binding buffer
    CodInt64         bindBufSize;  
    ImportMode       mode;
    CodUint16        colCount;
    CodBool          importOther;
    CodBool          hasDBAPriv;
    CodChar          sqlBuf[ANS_SQLBUFFER_SIZE];
    ImpBindingColumn columns[ANS_MAX_COLUMNS];
    CodUint32        maxParamsetSize;
    CodUint32        batchRows;
    List*            tables;
    List*            users;
    List*            spaces;
    List*            ignoreTables;
    List*            tousers;//ImpTouserPair
    CodUint32        objectId;
    CodChar          reserved[4];
    CodInt64         objectOffset;
    CodInt64         sizeArray[EXP_SIZE_ARRAY_LEN];
    FILE*            logFile;
    CodVoid*         insertErrBuf;
} ImpContext;
```

新增currSchema，意义：currSchema和currOwner的意义不同，currOwner是文件中对象的owner，用于从文件中挑选用户导入；currSchema为当前connection下的schema，用于schema的切换。没有touser，两者一样，当有touser=user2，fromuser=currOwner=user1，两者有差异。

tousers：实际为fromuser/touser的用户对。当currOwner和用户对中fromuser对应时，将shecma切换到touser上，否则切换到currOwner上。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
--role
drop role role_a;
drop role role_b;
create role role_a;
create role role_b;

drop user user1 cascade;
drop user user2 cascade;
drop user user3 cascade;
drop user user4 cascade;

--user1/user2
create user user1 identified by 1;
grant create session to user1;
grant create table to user1;
grant create view to user1;
grant create SYNONYM to user1;
grant create PROCEDURE to user1;
grant AUDIT SYSTEM to user1;
grant CREATE ANY OUTLINE to user1;
grant ALTER ANY OUTLINE to user1;
grant DROP ANY OUTLINE to user1;
grant create audit policy to user1;
create user user2 identified by 1;
grant create session to user2;
grant create table to user2;
grant create view to user2;
grant create SYNONYM to user2;
grant create PROCEDURE to user2;
create user user3 identified by 1;
grant create session to user3;
grant create table to user3;
grant create view to user3;
grant create SYNONYM to user3;
grant create PROCEDURE to user3;

create user user4 identified by 1;
grant dba to user4;

--user1/user2下对象：表
conn user1/1
create table user1_t1(id1 int,id2 int,id3 int,id4 int,id5 int);
insert into user1_t1 values(1,1,1,1,1);
insert into user1_t1 values(2,2,2,2,2);
commit;
grant select on user1_t1 to user2 with grant option;

conn user2/1
grant select on user1.user1_t1 to user3 with grant option;

conn user3/1
grant select on  user1.user1_t1 to user4 with grant option;

--user2创建对象
conn user2/1
create table user2_t1(id1 int,id2 int,id3 int,id4 int,id5 int);
insert into user2_t1 values(1,1,1,1,1);
insert into user2_t1 values(2,2,2,2,2);
commit;

grant select on user2_t1 to user1 with grant option;

conn user1/1
grant select on user2.user2_t1 to user3 with grant option;

conn user3/1
grant select on  user2.user2_t1 to user4 with grant option;

--user1/user2
--check 约束
conn user1/1
alter table user1_t1 add CONSTRAINT check_constraint CHECK (id1 is not null);
conn user2/1
alter table user2_t1 add CONSTRAINT check_constraint CHECK (id1 is not null);
--comment
conn user1/1
COMMENT ON COLUMN user1_t1.id2 is 'export comment';
conn user2/1
COMMENT ON COLUMN user2_t1.id2 is 'export comment';
--视图
conn user1/1
drop view if exists view_export1;
create view view_export1 as select * from user1_t1;
conn user2/1
drop view if exists view_export2;
create view view_export2 as select * from user2_t1;
--同义词
conn user1/1
CREATE SYNONYM synom_view1 for view_export1;
conn user2/1
CREATE SYNONYM synom_view2 for view_export2;
--索引
conn user1/1
CREATE UNIQUE INDEX index_export1 on user1_t1(id2);
CREATE INDEX index_export2 on user1_t1(id3);
conn user2/1
CREATE UNIQUE INDEX index_export1 on user2_t1(id2);
CREATE INDEX index_export2 on user2_t1(id3);
--主键
conn user1/1
ALTER TABLE user1_t1 ADD CONSTRAINT PRIMARY_export1 PRIMARY KEY(id3);
conn user2/1
ALTER TABLE user2_t1 ADD CONSTRAINT PRIMARY_export2 PRIMARY KEY(id3);
--外键
conn user1/1
ALTER TABLE user1_t1 ADD CONSTRAINT FOREIGN_export1 FOREIGN KEY(id4) REFERENCES user1_t1(id3);
conn user2/1
ALTER TABLE user2_t1 ADD CONSTRAINT FOREIGN_export2 FOREIGN KEY(id4) REFERENCES user2_t1(id3);

--过程体：'TRIGGER', 'PROCEDURE', 'PACKAGE', 'PACKAGE BODY', 'UDF', 'JOB'
--user1的过程体
conn user1/1
CREATE OR REPLACE PROCEDURE ya_proc1(i INT) IS
BEGIN
CASE i
WHEN 1 THEN
DBMS_OUTPUT.PUT_LINE('hello');
WHEN 2 THEN
DBMS_OUTPUT.PUT_LINE('world');
END CASE;
END ya_proc1;
/
create or replace package pkg_subtype_3 as
	va int := 458;
    PROCEDURE ya_proc1;
    PROCEDURE ya_proc2;
end;
/

CREATE OR REPLACE PROCEDURE ya_proc2(i INT) IS
BEGIN
CASE i
WHEN 1 THEN
DBMS_OUTPUT.PUT_LINE('hello');
WHEN 2 THEN
DBMS_OUTPUT.PUT_LINE('world');
END CASE;
END ya_proc2;
/

create or replace package body pkg_subtype_3 as
	procedure ya_proc1 is
begin
	ya_proc1(1);
	DBMS_OUTPUT.PUT_LINE(va);
end;

	procedure ya_proc2 is
begin
	ya_proc2(1);
	DBMS_OUTPUT.PUT_LINE(va);
end;
end;
/

conn user2/1
CREATE OR REPLACE PROCEDURE ya_proc1(i INT) IS
BEGIN
CASE i
WHEN 1 THEN
DBMS_OUTPUT.PUT_LINE('hello');
WHEN 2 THEN
DBMS_OUTPUT.PUT_LINE('world');
END CASE;
END ya_proc1;
/
create or replace package pkg_subtype_3 as
	va int := 458;
    PROCEDURE ya_proc1;
    PROCEDURE ya_proc2;
end;
/

CREATE OR REPLACE PROCEDURE ya_proc2(i INT) IS
BEGIN
CASE i
WHEN 1 THEN
DBMS_OUTPUT.PUT_LINE('hello');
WHEN 2 THEN
DBMS_OUTPUT.PUT_LINE('world');
END CASE;
END ya_proc2;
/

create or replace package body pkg_subtype_3 as
	procedure ya_proc1 is
begin
	ya_proc1(1);
	DBMS_OUTPUT.PUT_LINE(va);
end;

	procedure ya_proc2 is
begin
	ya_proc2(1);
	DBMS_OUTPUT.PUT_LINE(va);
end;
end;
/

--AudPolicy:全库外忽略
conn user1/1
drop audit policy UNIFIED_AUDIT_UP_11;
create audit policy UNIFIED_AUDIT_UP_11 actions select on user1_t1;

--Outlines全库外忽略
conn user1/1
drop OUTLINE ol1;
CREATE OUTLINE ol1 FOR CATEGORY category_name  ON select * from user1_t1 ;


场景：
场景一：
--导出全库
exp sys/Cod-2022 file=a full=y
--查询预期
yasql sys/Cod-2022 -f -e D:\导入导出工具总结\touser\select.sql > D:\导入导出工具总结\touser\select.expected
--将user1,user2数据导入user3,user4
imp sys/Cod-2022 file=a fromuser=user1,user2 touser=user3,user4
yasql sys/Cod-2022 -f -e D:\导入导出工具总结\touser\select.sql > D:\导入导出工具总结\touser\select.out
场景二：
全库导出
--将user1的表user1_t1导入到user3
imp sys/Cod-2022 file=a fromuser=user1 touser=user3 tables=user1_t1
场景三：
导出用户user1数据
将user1导入到user2
imp sys/Cod-2022 file=a fromuser=user1 touser=user3
```

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

完整约束：

（1）touser不指定，导入到文件中的用户；指定后，导入到touser。

（2）touser用户必须已经存在。否则在切换schema时报错。

（3）touser选项必须dba权限用户才能使用。否则报错。

（4）导入过程，对象已存在，警告。fromuser=user1,user2 touser=user3,user3，user1和user2都有表t1，第二次导入t1警告。

（5）imp 中 touser和full的限制：touser，不能指定full=y。即：touser仅可在fromuser/tables的模式下进行，不能将全库中对象全部导入到某个用户；也不存在touser和create user/role/profile等高于user的对象的创建。

|模式|语句|说明|
|---|---|---|
|full + touser|imp user2/1 file=a full=y  touser=user1|报错|
|tables + touser|imp user2/1 file=a tables=t1 touser=user1,user2|将user2的表t1，导入到|
|fromuser + touser|  
|  
|
|touser|  
|  
|
|fromuser + tables + touser|  
|  
|
|  
|  
|  
|


（1）fromuser=user1,user2（多个） touser=user3，行为。fromuser和touser的数量不一致，行为。

|fromuser|touser|行为|
|---|---|---|
|user1,user2|user3|user1-》user3；user2-》user2|
|user1,user2|user3,user4|user1-》user3；user2-》user4|
|user1|user3|user1->user3|
|user1|user3,user4|  
|
|不设置|user3|  
|
|user1|不设置|  
|


（2）使用touser，登录用户的权限必须DBA?(oracle 必须是有  IMP_FULL_DATABASE role，我们暂时用DBA系统权限控制  )    
  （2）登录用户为小权限，touser=sys等大权限的用户，行为。    
  （3）touser后，对象权限的schema/loginuser的设置。    
  （4）touser在不同table/user/full的模式，参数组合下的行为。

满足客户现场场景，部分约束：

（1）fromuser和touser的数量必须一致；touser可重复，fromuser重复的算一次，然后对比touser的个数。

（2）touser要求  登录用户必须有dba权限

（3）touser必须与formuser配合，统计项如下：

|语法|现象|约束|
|---|---|---|
|imp user1/1 full=y touser=user2|报错|报错|
|imp user1/1  touser=user2|touser 必须配合使用fromuser|报错|
|imp user1/1  fromuser=user3 touser=user2|user模式，指定fromuser=user3，则将user3 的数据导入到user2，|成功，登录用户user1必须有dba权限|
|imp user1/1  fromuser=user3,user4 touser=user2|报错|报错，fromuser和touser的数量必须一致|
|imp user1/1  fromuser=user3 touser=user2,user4 |报错|报错，fromuser和touser的数量必须一致|
|**imp user1/1  fromuser=user3,user3 touser=user2,user4 **|**fromuser重复，只算一次，fromuser是1个，touser是2个，报错**|**报错，fromuser和touser的数量必须一致**|
|imp user1/1  fromuser=user4,user5 touser=user2,user2 |touser重复，但是数量和fromuser一致  user4->user2，user5 -》user2，如果user4和user5有重名对象，则warning：对象已存在|成功|
|imp user1/1  fromuser=user4 touser=notExist|touser的用户notExist不存在，则报错：YAS-02010 user 'a' does not exist|报错|
|imp user1/1  fromuser=user1,user2touser=user3,user4 |user1->user3，user2 -》user4|成功|
|imp user1/1  touser=user2,user3 tables=t1|touser 必须配合使用fromuser|报错，touser 必须配合使用fromuser|
|imp user1/1  fromuser=user1,user4 touser=user2,user3 tables=t1|成功|成功|
|imp user1/1  fromuser=user1 touser=user2,user3 tables=t1|报错|报错，fromuser和touser的数量必须一致|
|  
|  
|  
|
|  
|  
|  
|


## Attachments:

[image2023-4-17_16-38-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTk4OTcwYzJhZjRmNTFmZmRkIiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMDQ3LCJleHAiOjE3ODIzNzY0NDd9._Hqv_WI567S1zwhOWwuqCji5ndQi7RoO1bhodaE1Ugk)

 (image/png)    


[image2023-4-3_18-15-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTlhMWFkOWEzMzExZGM3ZTUyIiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMDQ3LCJleHAiOjE3ODIzNzY0NDd9.k_oywkI9GEGPHId1nNAIWgpgd_gqzJ1raGNcFCriFyI)

 (image/png)    


[image2023-4-3_18-17-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTk4OTcwYzJhZjRmNTFmZmRlIiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMDQ3LCJleHAiOjE3ODIzNzY0NDd9.F8Fo2mcz1pBaJzvr4oqVqO2tYxJJwstuWMsZNrFJDgs)

 (image/png)    


[image2023-4-21_20-9-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTlhMWFkOWEzMzExZGM3ZTUzIiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMDQ3LCJleHAiOjE3ODIzNzY0NDd9.So-TWeavdPXEkbtbG0h0yFRsY74SfJwc8PzluzcMZAs)

 (image/png)    


[select.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZTlhMWFkOWEzMzExZGM3ZTU0IiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjJhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMDQ3LCJleHAiOjE3ODIzNzY0NDd9.FOvBHAVLSeVvIpntwJS74GDdI2gmjsDZuDZHoIrWIw0)

 (application/octet-stream)    
