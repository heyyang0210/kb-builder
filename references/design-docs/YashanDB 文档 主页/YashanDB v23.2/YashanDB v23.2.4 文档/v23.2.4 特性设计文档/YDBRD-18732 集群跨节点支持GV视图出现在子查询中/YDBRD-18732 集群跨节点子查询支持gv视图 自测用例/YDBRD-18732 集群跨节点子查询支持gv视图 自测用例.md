Created by 秦湫婷, last modified on 八月 02, 2024

### dml场景用例暂时请见：    [集群跨节点支持GV视图出现在子查询中 - 秦湫婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159417176)  

### create table as场景：

ps：规格和表现和原来子查询不跨节点一致，实现可以带gv子查询创建普通表、全局临时表和私有临时表。

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|创建普通表，子查询为gv视图|create table t1(a,b)as select STATISTIC#,VALUE from gv$sysstat;,select * from t1;|创建成功，并且查询结果和子查询结果一致|  
|  
|
|创建普通表，子查询为gv视图关联查询|create table t4(a,b,c)as select instance_number,STATISTIC#,VALUE from gv$instance i,gv$sysstat s where i.inst_id = s.inst_id;|创建成功，并且查询结果和子查询结果一致|  
|  
|
|创建普通表，子查询为gv视图和普通表关联查询|create table t5(a,b,c)as select instance_number,t1.b,t1.c from gv$instance i, t1 where i.inst_id = t1.a;|创建成功，并且查询结果和子查询结果一致|  
|  
|
|创建全局临时表，子查询为gv视图|create global temporary table t2(a,b)as select STATISTIC#,VALUE from gv$sysstat;|创建成功，但查询结果为空|  
|  
|
|创建全局临时表，子查询为gv视图，并且指定ON COMMIT PRESERVE ROWS|create global temporary table t2(a,b) ON COMMIT PRESERVE ROWS as select STATISTIC#,VALUE from gv$sysstat;|创建成功，并且查询结果和子查询结果一致|  
|  
|
||create global temporary table t2(a,b) ON COMMIT PRESERVE ROWS as select STATISTIC#,VALUE from gv$sysstat;,commit;|commit提交后表数据不会清空|  
|  
|
|创建私有临时表，子查询为gv视图|create private temporary table YAS$PTT_t2(a,b)as select STATISTIC#,VALUE from gv$sysstat;|创建成功，并且查询结果和子查询结果一致|  
|  
|
||create private temporary table YAS$PTT_t2(a,b)as select STATISTIC#,VALUE from gv$sysstat;,commit;,select * from YAS$PTT_t2;|提交后，查询表，结果为表不存在|  
|  
|
|创建私有临时表，子查询为gv视图，并且指定ON COMMIT PRESERVE DEFINITION|create private temporary table YAS$PTT_t3(a,b) ON COMMIT PRESERVE DEFINITION as select STATISTIC#,VALUE from gv$sysstat;,commit;,select * from YAS$PTT_t3;|创建成功，并且提交后，查询表，表数据和子查询结果一致|  
|  
|
|为其他用户创建普通表|create user regress identified by regress;    
  grant dba to regress;    
  create user sales identified by sales;    
  grant dba to sales;,连接sales:,create table regress.t1(a,b)as select STATISTIC#,VALUE from gv$sysstat;,select * from regress.t1;|创建成功，并且查询结果和子查询结果一致|  
|  
|
|为其他用户创建私有临时表|连接sales:,create private temporary table regress.YAS$PTT_t2(a,b)as select STATISTIC#,VALUE from gv$sysstat;|报错，YAS-02270 cannot create private temporary table for another user|  
|  
|
|为其他用户创建全局临时表|连接sales:,create global temporary table regress.t2(a,b) ON COMMIT PRESERVE ROWS as select STATISTIC#,VALUE from gv$sysstat;|创建成功，并且查询结果和子查询结果一致|  
|  
|


### dblink表场景：

ps：和原来规格一致，实现select 和insert带子查询，拦截update和delete的子查询。

前置条件：CREATE DATABASE LINK dblink_yashan CONNECT TO sys IDENTIFIED BY Cod-2022 USING '192.168.7.125:1688'; 并且远端数据库存在table t1(a int,b int);

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|查询远端表|select * from t1@dblink_yashan;|查询结果正确|  
|  
|
|远端表和gv视图关联查询|select * from t1@dblink_yashan,gv$instance;|查询结果正确|序列化问题，主干已修复    [fix:YDBRD-30153, srlz ylntable (!35842) · Merge requests · CoD-X / AnchorBase · GitLab (yasdb.com)](https://git.yasdb.com/cod-x/anchorbase/-/merge_requests/35842/diffs)  |  
|
|查询带gv子查询|select * from t1@dblink_yashan t1 where t1.a=(select INSTANCE_NUMBER from gv$instance i where i.instance_number = t1.b and i.instance_number = 1);|查询结果正确|  
|  
|
|insert into 远端表 select，子查询带gv|insert into t1@dblink_yashan select instance_number, instance_number from gv$instance;|插入成功|  
|  
|
|insert into 远端表 select，子查询为gv关联查询|insert into t1@dblink_yashan select instance_number, instance_number from gv$instance i, gv$database d where i.inst_id = d.inst_id;|插入成功|  
|  
|
|insert into 远端表 select，子查询为gv和普通表关联查询|insert into t1@dblink_yashan select instance_number, instance_number from gv$instance i, t1 where i.inst_id = t1.a and t1.a = 1;|插入成功|  
|  
|
|insert into 远端表 select，子查询为gv和远端表关联查询|insert into t1@dblink_yashan select instance_number, instance_number from gv$instance i, t1@dblink_yashan t1 where i.inst_id = t1.a and t1.a = 1;|插入成功|  
|  
|
|update带gv子查询|UPDATE t1@dblink_yashan SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|报错，YAS-04303 unexpected subquery|  
|  
|
|delete带gv子查询|DELETE from t1@dblink_yashan where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|报错，YAS-04303 unexpected subquery|  
|  
|
|sequence作为gv的投影列|sys：CREATE SEQUENCE seq_yashan1;,SELECT seq_yashan1.NEXTVAL@dblink_yashan FROM gv$instance;|报错，YAS-04833 unsupported dblink sequence with global view in cluster database|  
|  
|


### create outline场景：

ps：view子语句无法做hint映射，所以子查询若全为view查询，则认为这个执行计划不支持映射为hint，报错。

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|create outline 子查询为gv查询|create outline o on select /*+ FULL(a) */* from gv$instance;|报错，YAS-04440 invalid sql statement|  
|  
|
|create outline 子查询为gv视图和普通表关联查询|create outline o on select /*+ FULL(a) */* from gv$instance i, t1 where i.inst_id = t1.a;|创建成功|  
|  
|
|create outline 子查询为gv视图和远端表关联查询|create outline o2 on select /*+ FULL(a) */* from gv$instance i, t1@dblink_yashan where i.inst_id = t1.a;|创建成功|  
|  
|
|create outline 子查询为gv视图关联查询|create outline o1 on select /*+ FULL(a) */* from gv$instance i, gv$database d where d.inst_id = i.inst_id;|报错，YAS-04440 invalid sql statement|目前会core，正在处理，使其报错|  
|
|create outline 子查询为gv和v$关联查询|create outline o1 on select /*+ FULL(a) */* from v$instance i, gv$database d where d.inst_id = i.instance_number;|报错，YAS-04440 invalid sql statement|目前会core，正在处理，使其报错|  
|


### merge场景：

ps：merge场景拦截gv子查询，无gv视图merge语句执行正常

前置条件：create table t1(a int,b int);

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|merge子查询带gv|merge into t1    
  using (select * from gv$instance) i    
  on (t1.a = i.inst_id)    
  WHEN MATCHED THEN UPDATE SET t1.a=i.instance_number,t1.b = i.instance_number;|报错，YAS-04833 unsupported merge into with global view in cluster database|  
|  
|
|merge的update带gv子查询|merge into t1    
  using (select * from v$instance) i    
  on (t1.a = i.instance_number)    
  WHEN MATCHED THEN UPDATE SET t1.a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|报错，YAS-04833 unsupported merge into with global view in cluster database|  
|  
|
|merge子查询不带gv|merge into t1    
  using (select * from v$instance) i    
  on (t1.a = i.instance_number)    
  WHEN MATCHED THEN UPDATE SET t1.a=i.instance_number,t1.b = i.instance_number    
  WHEN NOT MATCHED THEN INSERT VALUES (i.instance_number, i.instance_number);|插入一条数据|  
|  
|
|merge的update带子查询，非gv|merge into t1    
  using (select * from v$instance) i    
  on (t1.a = i.instance_number)    
  WHEN MATCHED THEN UPDATE SET t1.a = (SELECT a.instance_number FROM v$instance a WHERE a.instance_number=1) WHERE a = 1;|更新一条数据|  
|  
|
|merge into远端表|本地数据库和远端数据库均已加载样例表：,MERGE INTO employees@dblink_yashan b    
  USING (SELECT * FROM employees) a    
  ON (a.employee_no=b.employee_no)    
  WHEN MATCHED THEN UPDATE SET b.sex=a.sex,b.entry_date=a.entry_date    
  WHEN NOT MATCHED THEN INSERT VALUES (a.branch,a.department,a.employee_no,a.employee_name,a.sex,a.entry_date);|报错,YAS-04328 can only select from fixed tables/views|  
|  
|


### create sqlMap场景：

前置条件：alter system set SQL_MAP = TRUE;

create user regress identified by regress;    
  grant dba to regress;

连接regress用户：

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|sql语句类型为select，A语句为普通表查询，B语句为gv视图查询|create table t1(a int,b int);,CREATE SQLMAP map_branch1 (regress,'select * from t1 where a = 2','select * from gv$instance');,select * from t1 where a = 2;|结果为执行B语句的数据|  
|  
|
|sql语句类型为select，A语句为gv视图查询，B语句为gv视图查询|CREATE SQLMAP map_branch2 (regress,'select * from gv$database','select * from gv$instance');,select * from gv$database；|结果为执行B语句的数据|  
|  
|
|sql语句类型为insert，A语句为普通表insert，B语句为普通表insert|CREATE SQLMAP map_branch3 (regress,'insert into t1 values(4,4)','insert into t1 values(3,3)');,insert into t1 values(4,4);|结果为执行B语句的数据|  
|  
|
|sql语句类型为insert，A语句、B语句为insert into select gv|CREATE SQLMAP map_branch4 (regress,'insert into t1(a,b) select inst_id,inst_id from gv$database where inst_id = 2','insert into t1(a,b) select instance_number,instance_number from gv$instance');,insert into t1(a,b) select inst_id,inst_id from gv$database where inst_id = 2;|结果为执行B语句的数据|  
|  
|
|sql语句类型为insert，A语句为普通表insert，B语句为insert into select gv|CREATE SQLMAP map_branch5 (regress,'insert into t1 values(5,5)','insert into t1(a,b) select inst_id,inst_id from gv$database where inst_id = 2');,insert into t1 values(5,5);|结果为执行B语句的数据|  
|  
|
|sql语句类型为insert，A语句为普通表insert，B语句为insert 远端表 select gv|CREATE SQLMAP map_branch6 (regress,'insert into t1 values(1,1)','insert into dblink_remote_t3@dblink_yashan values(127)');,insert into t1 values(1,1);|拦截，SQL语句里不出现dblink表或者结果为执行B语句的数据|目前会报错，YAS-07332 the length of dblink sql text must less than 262144，报错内容不符合预期。正在分析，sql的内存地址相差很大|  
|
|所有用户建立映射，sql语句类型为insert，A语句、B语句为insert into select gv|CREATE SQLMAP map_branch7 (all,'insert into t1(a,b) select inst_id,inst_id from gv$database where inst_id = 1','insert into t1(a,b) select instance_number,instance_number from gv$instance');,连接sys用户：insert into t1(a,b) select inst_id,inst_id from gv$database where inst_id = 1;|结果为执行B语句的数据|  
|  
|
|sql语句类型为update，A语句为普通表update，B语句为update带gv子查询|CREATE SQLMAP map_branch12 (regress,'UPDATE t1 SET a = 3 where a = 2','UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 2');,UPDATE t1 SET a = 3 where a = 2;|结果为执行B语句的数据|  
|  
|
|sql语句类型为delete，A语句为普通表delete，B语句为delete带gv子查询|CREATE SQLMAP map_branch13 (regress,'DELETE from t1@dblink_yashan where a = 3','DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2)');,DELETE from t1@dblink_yashan where a = 3|结果为执行B语句的数据|  
|  
|


### 游标场景：

ps：放开本地的游标操作，拦截跨实例的游标操作。

前置条件：set serveroutput on;

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|for 显式游标，游标内容为普通表查询|DECLARE    
  CURSOR emp_cur IS select * from t1;    
  BEGIN    
  DBMS_OUTPUT.PUT_LINE('EMPNO ENAME');    
  DBMS_OUTPUT.PUT_LINE('----- -------');    
  FOR v_emp_rec IN emp_cur LOOP    
  DBMS_OUTPUT.PUT_LINE(v_emp_rec.a || ' ' || v_emp_rec.b);    
  END LOOP;    
  END;    
  /|正常输出结果|  
|  
|
|for 显式游标，游标内容为gv查询|DECLARE    
  CURSOR emp_cur IS select * from gv$instance;    
  BEGIN    
  DBMS_OUTPUT.PUT_LINE('EMPNO ENAME');    
  DBMS_OUTPUT.PUT_LINE('----- -------');    
  FOR v_emp_rec IN emp_cur LOOP    
  DBMS_OUTPUT.PUT_LINE(v_emp_rec.inst_id || ' ' || v_emp_rec.inst_id);    
  END LOOP;    
  END;    
  /|报错，YAS-04833 unsupported Cursor for cross-instance operations in cluster database|  
|  
|
|只生成游标，不对游标操作|DECLARE    
  CURSOR emp_cur IS select * from gv$instance;    
  BEGIN    
  DBMS_OUTPUT.PUT_LINE('EMPNO ENAME');    
  DBMS_OUTPUT.PUT_LINE('----- -------');    
  END;    
  /|不报错，没有游标内容的输出|  
|  
|
|open 显式游标|DECLARE     
  CURSOR cur(c1 int) IS    
  SELECT inst_id,instance_number FROM gv$instance WHERE inst_id=c1;    
  TYPE record1 IS RECORD (    
  c1 int,    
  c2 int    
  );    
  rec record1;    
  BEGIN     
  OPEN cur(c1=>1);    
  FETCH cur INTO rec;    
  DBMS_OUTPUT.PUT_LINE(rec.c1 ||' '||rec.c2);    
  CLOSE cur;    
  END;    
  /|报错，YAS-04833 unsupported Cursor for cross-instance operations in cluster database|  
|  
|
|隐式游标属性，隐式游标内容为gv查询|DECLARE    
  a int;    
  BEGIN    
  select inst_id into a from gv$instance where inst_id = 2;    
  IF SQL%found THEN    
  DBMS_OUTPUT.PUT_LINE('Total '||SQL%rowcount||' lines are selected.');    
  END IF;    
  ROLLBACK;    
  END;    
  /|输出结果为1|  
|  
|
|for 隐式游标，隐式游标内容为gv查询|DECLARE    
  resultStr VARCHAR(200);    
  BEGIN    
  FOR id IN (SELECT inst_id, instance_number FROM gv$instance) LOOP    
  resultStr := resultStr||id.inst_id||id.instance_number;    
  DBMS_OUTPUT.PUT_LINE(resultStr);    
  END LOOP;    
  DBMS_OUTPUT.PUT_LINE(resultStr);    
  END;    
  /|报错，YAS-04833 unsupported Cursor for cross-instance operations in cluster database|  
|  
|
|for 隐式游标，隐式游标内容为普通表查询|DECLARE    
  resultStr VARCHAR(200);    
  BEGIN    
  FOR id IN (select a,b from t1) LOOP    
  resultStr := resultStr||id.a||id.b;    
  DBMS_OUTPUT.PUT_LINE(resultStr);    
  END LOOP;    
  DBMS_OUTPUT.PUT_LINE(resultStr);    
  END;    
  /|正常输出结果|  
|  
|
|动态游标，第一次打开的sql语句是单实例的，第二次打开的sql是跨实例的|DECLARE    
  TYPE cursor IS REF CURSOR;    
  cur cursor;    
  TYPE record1 IS RECORD (    
  c1 CHAR(2),    
  c2 VARCHAR(20)    
  );    
  rec1 record1;    
  TYPE record2 IS RECORD (    
  c1 INT,    
  c2 INT,    
  c3 VARCHAR(20)    
  );    
  rec2 record2;    
  BEGIN     
  OPEN cur FOR select b,c from t1 where a= 1 and b =1;    
  FETCH cur INTO rec1;    
  DBMS_OUTPUT.PUT_LINE(rec1.c1 ||' '||rec1.c2);    
  CLOSE cur;    
  OPEN cur FOR SELECT inst_id, instance_number,startup_time FROM gv$instance where inst_id = 1;    
  FETCH cur INTO rec2;    
  DBMS_OUTPUT.PUT_LINE(rec2.c1 ||' '||rec2.c2||' '||rec2.c3);    
  CLOSE cur;    
  END;    
  /|输出第一次open和fetch的结果，第二次open报错，YAS-04833 unsupported Cursor for cross-instance operations in cluster database|  
|  
|
|sys_refcursor，第一次打开的sql语句是单实例的，第二次打开的sql是跨实例的|CREATE OR REPLACE PROCEDURE getArea(cur IN OUT SYS_REFCURSOR) AS    
  BEGIN    
    OPEN cur FOR SELECT inst_id, instance_number,startup_time FROM gv$instance;    
  END;    
  /,CREATE OR REPLACE FUNCTION getArea_func RETURN SYS_REFCURSOR AS    
    cur SYS_REFCURSOR;    
  BEGIN    
    OPEN cur FOR SELECT * FROM t1 WHERE a  = 1 and b = 1;    
    RETURN cur;    
  END;    
  /,DECLARE    
    TYPE record IS RECORD (    
      c1 CHAR(2),    
   c2 VARCHAR(20),    
   c3 VARCHAR(20)    
    );    
    rec record;    
    cur SYS_REFCURSOR;    
  BEGIN    
    cur := getArea_func;    
    FETCH cur INTO rec;    
    DBMS_OUTPUT.PUT_LINE(rec.c1 ||' '||rec.c2||' '||rec.c3);    
    CLOSE cur;    
    getArea(cur);    
    FETCH cur INTO rec;    
    DBMS_OUTPUT.PUT_LINE(rec.c1 ||' '||rec.c2||' '||rec.c3);    
    CLOSE cur;    
  END;    
  /|输出第一次open和fetch的结果，第二次open报错，YAS-04833 unsupported Cursor for cross-instance operations in cluster database|  
|  
|


### 触发器场景：

前置条件：

create user regress identified by regress;    
  grant dba to regress;

连接regress用户：

drop table t1;

create table t1(a int,b int);    
  insert into t1 values(1,1);    
  insert into t1 values(2,2);    
  insert into t1 values(3,3);

commit;    
  set serveroutput on

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|before触发器，静态select语句带gv子查询，触发语句为简单insert语句|CREATE OR REPLACE TRIGGER tri BEFORE INSERT OR DELETE    
  ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a<>1 OR tnew.a <> 1)    
  DECLARE    
  aSelect int;    
  BEGIN    
  IF INSERTING THEN    
  select a into aSelect from t1 where t1.a=(select INSTANCE_NUMBER from gv$instance i where i.instance_number = t1.b and t1.b = 1);    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END IF;    
  END;    
  /,insert into t1 values(4,4);|SQL> insert into t1 values(4,4);    
  Inserting. id is 4    
  plsql select. id is 1,  
  1 row affected.|  
|  
|
|before触发器，动态select语句带gv子查询，触发语句为简单insert语句|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a<>1 OR tnew.a <> 1)    
  DECLARE    
  aSelect int;    
  BEGIN    
  IF INSERTING THEN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and s.inst_id = t1.b and t1.b = :newB)'    
  INTO aSelect USING :tnew.b;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || aSelect);    
  END IF;    
  END;    
  /,insert into t1 values(3,3);|SQL> insert into t1 values(3,3);    
  Inserting. id is 3,1 row affected.|  
|  
|
|before触发器，动态select语句带gv子查询，触发语句为insert into select v$|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a<>2 OR tnew.a <> 2)    
  DECLARE    
  aSelect int;    
  BEGIN    
  IF INSERTING THEN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and t1.b = :newB limit 1)'    
  INTO aSelect USING :tnew.b;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || aSelect);    
  END IF;    
  END;    
  /,insert into t1 select instance_number, instance_number from v$instance i;|SQL> insert into t1 select instance_number, instance_number from v$instance i;    
  Inserting. id is 1,1 row affected.|  
|  
|
|before触发器，动态select语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1    
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a<>1 OR tnew.a <> 1)    
  DECLARE    
  aSelect int;    
  BEGIN    
  IF INSERTING THEN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and t1.b = :newB limit 1)'    
  INTO aSelect USING :tnew.b;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || aSelect);    
  END IF;    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|  
|YAS-02277 error during execution of trigger TRI    
  YAS-05235 cannot perform a DML or DDL or DCL inside a query or DML,当前结果报错，需要分析是否符合预期  =>已分析，并修改，待开发调休后确认是否修改合理|  
|
|before触发器，动态select语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE UPDATE OF a ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  DECLARE    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and t1.b = :newA limit 1)'    
  INTO aSelect USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updatinging. id is ' || aSelect);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|SQL> UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  Updatinging. id is 2,1 row affected.|  
|  
|
|before触发器，动态select语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  DECLARE    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and t1.b = :OldA limit 1)'    
  INTO aSelect USING :told.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || aSelect);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|SQL> DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);    
  Deleting. id is 2|  
|  
|
|after触发器，动态select语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri AFTER INSERT ON t1    
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  DECLARE    
  aSelect int;    
  BEGIN    
  IF INSERTING THEN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and t1.b = :newB limit 1)'    
  INTO aSelect USING :tnew.b;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || aSelect);    
  END IF;    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|[5:1]YAS-02277 error during execution of trigger TRI    
  YAS-05205 exact fetch returns more than requested number of rows|  
|  
|
|after触发器，动态select语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER UPDATE OF a ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  DECLARE    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and t1.b = :newA limit 1)'    
  INTO aSelect USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updatinging. id is ' || aSelect);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|SQL> UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  Updatinging. id is 2,1 row affected.|  
|  
|
|after触发器，动态select语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  DECLARE    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and t1.b = :OldA limit 1)'    
  INTO aSelect USING :told.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || aSelect);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|SQL> DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);,[4:1]YAS-02277 error during execution of trigger TRI    
  YAS-05206 no data found|  
|  
|
|before触发器，普通动态insert语句，触发语句为普通insert语句|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select instance_number, instance_number from v$instance where instance_number = :newB'    
  USING :tnew.b;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /    
  insert into t1 select instance_number, instance_number from v$instance i;|报错：,SQL> insert into t1 select instance_number, instance_number from v$instance i;,YAS-02277 error during execution of trigger TRI    
  YAS-02277 error during execution of trigger TRI    
  YAS-02277 error during execution of trigger TRI    
  YAS-00109 work stack overflow, try to push 1052 bytes|触发器的insert into t1也在不断触发，一直触发导致爆栈|  
|
|before触发器，静态insert语句带gv子查询，触发语句为普通insert语句|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a<>2 OR tnew.a <> 2)    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select instance_number, instance_number from gv$instance where instance_number = 2';    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from v$instance;|SQL> insert into t1 select instance_number, instance_number from v$instance i;    
  Inserting. id is 1,1 row affected.|  
|  
|
|before触发器，静态insert语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a<>2 OR tnew.a <> 2)    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select instance_number, instance_number from gv$instance where instance_number = 2';    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 1;|SQL> insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 1;    
  Inserting. id is 1,1 row affected.|  
|  
|
|before触发器，动态insert语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a = 2 OR tnew.a = 2)    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :newA and STATISTIC# !=:newA limit 1' USING :tnew.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|SQL> insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;    
  Inserting. id is 2,1 row affected.|  
|  
|
|before触发器，动态insert语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE UPDATE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :newA and STATISTIC# =:newA limit 1' USING :tnew.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updating. id is ' || :tnew.a);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|SQL> SQL> UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  Updating. id is 2,1 row affected.|  
|  
|
|before触发器，动态insert语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :newA and STATISTIC# =:newA limit 1' USING :told.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || :told.a);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|SQL> DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);    
  Deleting. id is 2,1 row affected.|  
|  
|
|after触发器，动态insert语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri AFTER INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  WHEN (told.a = 2 OR tnew.a = 2)    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :newA and STATISTIC# !=:newA limit 1' USING :tnew.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|SQL>     
  SQL> insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;,YAS-02277 error during execution of trigger TRI    
  YAS-05236 the table has changed and triggers/functions cannot read it|  
|  
|
|after触发器，动态insert语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER UPDATE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :newA and STATISTIC# =:newA limit 1' USING :tnew.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updating. id is ' || :tnew.a);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|SQL> UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;,YAS-02277 error during execution of trigger TRI    
  YAS-05236 the table has changed and triggers/functions cannot read it|  
|  
|
|after触发器，动态insert语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :newA and STATISTIC# =:newA limit 1' USING :told.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || :told.a);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|SQL> DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);,YAS-02277 error during execution of trigger TRI    
  YAS-05236 the table has changed and triggers/functions cannot read it|  
|  
|
|before触发器，动态update语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = 1' USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|SQL> insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;    
  Inserting. id is 2,1 row affected.|  
|  
|
|before触发器，动态update语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE UPDATE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE,WHEN (told.a = 1),BEGIN    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = :2' USING :tnew.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updating. id is ' || :tnew.a);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|SQL> UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  Updating. id is 2,1 row affected.|  
|  
|
|before触发器，动态update语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = 1' USING :told.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || :told.a);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|  
|  
|  
|
|after触发器，动态update语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri AFTER INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = 1' USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|  
|  
|  
|
|after触发器，动态update语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER UPDATE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = :2' USING :tnew.a, :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updating. id is ' || :tnew.a);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|  
|  
|  
|
|after触发器，动态update语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = 1' USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || :told.a);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|  
|  
|  
|
|before触发器，动态delete语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri BEFORE INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1)' USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|  
|  
|  
|
|before触发器，动态delete语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE UPDATE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE,WHEN (told.a = 1),BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1)' USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updating. id is ' || :tnew.a);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|  
|  
|  
|
|before触发器，静态delete语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE,WHEN (told.a = 2),BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=1)';    
  DBMS_OUTPUT.PUT_LINE('Deleting.t1. id is ' || :told.a);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|SQL> DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);    
  Deleting. id is 2,1 row affected.|没有条件时不断触发，报错：YAS-04154 remote instance invalid node: message confusion|  
|
|before触发器，动态delete语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri BEFORE DELETE ON t1    
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE,BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT i.instance_number FROM gv$instance i WHERE i.instance_number=:1)' USING :told.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || :told.a);    
  END;    
  /,DELETE from t1 where a = (SELECT i.instance_number FROM gv$instance i WHERE i.instance_number=2);|  
|YAS-02094 current session has been killed or canceled|  
|
|before触发器，动态delete语句带gv子查询，触发语句为delete带gv子查询，操作不同表|create table t2(a int,b int);insert into t2 values(1,1);nsert into t2 values(2,2);commit;,CREATE OR REPLACE TRIGGER tri1 BEFORE DELETE ON t2    
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE,BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT i.instance_number FROM gv$instance i WHERE i.instance_number=:1)' USING :told.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting.t2. id is ' || :told.a);    
  END;    
  /,DELETE from t2 where a = (SELECT i.instance_number FROM gv$instance i WHERE i.instance_number=2);|SQL> DELETE from t2 where a = (SELECT i.instance_number FROM gv$instance i WHERE i.instance_number=2);    
  Deleting. id is 2,1 row affected.|YAS-02094 current session has been killed or canceled,=>drop trigger tri后正常|  
|
|after触发器，动态delete语句带gv子查询，触发语句为insert into select gv|CREATE OR REPLACE TRIGGER tri AFTER INSERT ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1)' USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Inserting. id is ' || :tnew.a);    
  END;    
  /,insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;|SQL> insert into t1 select instance_number, instance_number from gv$instance i where i.inst_id = 2;,YAS-02277 error during execution of trigger TRI    
  YAS-05236 the table has changed and triggers/functions cannot read it|  
|  
|
|after触发器，动态delete语句带gv子查询，触发语句为update带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER UPDATE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1)' USING :tnew.a;    
  DBMS_OUTPUT.PUT_LINE('Updating. id is ' || :tnew.a);    
  END;    
  /,UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;|SQL> UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;,YAS-02277 error during execution of trigger TRI    
  YAS-05236 the table has changed and triggers/functions cannot read it|  
|  
|
|after触发器，动态delete语句带gv子查询，触发语句为delete带gv子查询|CREATE OR REPLACE TRIGGER tri AFTER DELETE ON t1     
  REFERENCING OLD AS told NEW AS tnew    
  FOR EACH ROW    
  ENABLE    
  BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT i.instance_number FROM gv$instance i WHERE i.instance_number=:1)' USING :told.a;    
  DBMS_OUTPUT.PUT_LINE('Deleting. id is ' || :told.a);    
  END;    
  /,DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);|SQL>     
  SQL> DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);,YAS-02277 error during execution of trigger TRI    
  YAS-05236 the table has changed and triggers/functions cannot read it|  
|  
|


### 存储过程场景：

前置条件：set serveroutput on

drop table t1;    
  create table t1(a int,b int);    
  insert into t1 values(1,1);    
  insert into t1 values(2,2);    
  insert into t1 values(3,3);

commit;

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|静态sql|CREATE OR REPLACE PROCEDURE test_static_sql IS    
  aSelect int;    
  BEGIN    
  select a into aSelect from t1 where t1.a=(select INSTANCE_NUMBER from gv$instance i where i.instance_number = t1.b and t1.b = 1);    
  DBMS_OUTPUT.PUT_LINE('select result is '||aSelect);    
  insert into t1 select instance_number, instance_number from gv$instance where instance_number = 2;    
  DBMS_OUTPUT.PUT_LINE('insert rows is '||SQL%ROWCOUNT);    
  UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  DBMS_OUTPUT.PUT_LINE('update rows is '||SQL%ROWCOUNT);    
  DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);    
  DBMS_OUTPUT.PUT_LINE('delete rows is '||SQL%ROWCOUNT);    
  commit;    
  END;    
  /    
  call test_static_sql();|SQL> call test_dynamic_sql();    
  select result is 1    
  insert rows is 1    
  update rows is 1    
  delete rows is 3,PL/SQL Succeed.|  
|  
|
|动态sql|CREATE OR REPLACE PROCEDURE test_dynamic_sql IS    
  aSelect int;    
  aUse int;    
  BEGIN    
  aUse := 1;    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and s.inst_id = t1.b and t1.b = :newB)'    
  INTO aSelect USING aUse;    
  DBMS_OUTPUT.PUT_LINE('select result is '||aSelect);    
  aUse := 2;    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :1 and STATISTIC# !=:2 limit 1' USING aUse, aUse;     
  DBMS_OUTPUT.PUT_LINE('insert rows is '||SQL%ROWCOUNT);    
    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = 1' USING aUse;     
  DBMS_OUTPUT.PUT_LINE('update rows is '||SQL%ROWCOUNT);    
    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1)' USING aUse;     
  DBMS_OUTPUT.PUT_LINE('delete rows is '||SQL%ROWCOUNT);    
  commit;    
  END;    
  /    
  call test_dynamic_sql();|SQL> call test_dynamic_sql();    
  select result is 1    
  insert rows is 1    
  update rows is 1    
  delete rows is 2,PL/SQL Succeed.|  
|  
|
|  
|  
|  
|  
|  
|


### 匿名块场景：

前置条件：set serveroutput on

drop table t1;    
  create table t1(a int,b int);    
  insert into t1 values(1,1);    
  insert into t1 values(2,2);    
  insert into t1 values(3,3);

commit;

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|静态sql|declare    
  aSelect int;    
  BEGIN    
  select a into aSelect from t1 where t1.a=(select INSTANCE_NUMBER from gv$instance i where i.instance_number = t1.b and t1.b = 1);    
  DBMS_OUTPUT.PUT_LINE('select result is '||aSelect);    
  insert into t1 select instance_number, instance_number from gv$instance where instance_number = 2;    
  DBMS_OUTPUT.PUT_LINE('insert rows is '||SQL%ROWCOUNT);    
  UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  DBMS_OUTPUT.PUT_LINE('update rows is '||SQL%ROWCOUNT);    
  DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2);    
  DBMS_OUTPUT.PUT_LINE('delete rows is '||SQL%ROWCOUNT);    
  commit;    
  END;    
  /|select result is 1    
  insert rows is 1    
  update rows is 1    
  delete rows is 3,PL/SQL Succeed.|  
|  
|
|动态sql|declare    
  aSelect int;    
  aUse int;    
  BEGIN    
  aUse := 1;    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and s.inst_id = t1.b and t1.b = :newB)'    
  INTO aSelect USING aUse;    
  DBMS_OUTPUT.PUT_LINE('select result is '||aSelect);    
  aUse := 2;    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :1 and STATISTIC# !=:2 limit 1' USING aUse, aUse;     
  DBMS_OUTPUT.PUT_LINE('insert rows is '||SQL%ROWCOUNT);    
    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = 1' USING aUse;     
  DBMS_OUTPUT.PUT_LINE('update rows is '||SQL%ROWCOUNT);    
    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1)' USING aUse;     
  DBMS_OUTPUT.PUT_LINE('delete rows is '||SQL%ROWCOUNT);    
  commit;    
  END;    
  /|select result is 1    
  insert rows is 1    
  update rows is 1    
  delete rows is 2,PL/SQL Succeed.|  
|  
|
|  
|  
|  
|  
|  
|


### 自定义函数场景：

前置条件：set serveroutput on

drop table t1;    
  create table t1(a int,b int);    
  insert into t1 values(1,1);    
  insert into t1 values(2,2);    
  insert into t1 values(3,3);

commit;

|测试点|测试用例|预期结果|备注|是否已自动化|
|---|---|---|---|---|
|静态select|CREATE OR REPLACE FUNCTION test_function_static_select RETURN INT IS    
  aSelect int;    
  BEGIN    
  select a into aSelect from t1 where t1.a=(select INSTANCE_NUMBER from gv$instance i where i.instance_number = t1.b and t1.b = 1);    
  RETURN aSelect;    
  END;    
  /    
  select test_function_static_select() from dual;|SQL> select test_function_static_select() from dual;,TEST_FUNCTION_STATIC     
  --------------------     
  1,1 row fetched.|  
|  
|
|静态insert|CREATE OR REPLACE FUNCTION test_function_static_insert RETURN INT IS    
  aSelect int;    
  BEGIN    
  insert into t1 select instance_number, instance_number from v$instance where instance_number = 2;    
  RETURN SQL%ROWCOUNT;    
  END;    
  /    
  select test_function_static_insert() from dual;|YAS-05235 cannot perform a DML or DDL or DCL inside a query or DML|  
|  
|
|静态update|CREATE OR REPLACE FUNCTION test_function_static_update RETURN INT IS    
  aSelect int;    
  BEGIN    
  UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  RETURN SQL%ROWCOUNT;    
  END;    
  /    
  select test_function_static_update() from dual;|YAS-05235 cannot perform a DML or DDL or DCL inside a query or DML|  
|  
|
|静态delete|CREATE OR REPLACE FUNCTION test_function_static_delete RETURN INT IS    
  aSelect int;    
  BEGIN    
  UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=2) WHERE a = 1;    
  RETURN SQL%ROWCOUNT;    
  END;    
  /    
  select test_function_static_update() from dual;|AS-05235 cannot perform a DML or DDL or DCL inside a query or DML|  
|  
|
|动态select|CREATE OR REPLACE FUNCTION test_function_dynamic_select(aUse INT) RETURN INT IS    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'select a from t1 where t1.a=(select STATISTIC# from gv$sysstat s where s.STATISTIC# = t1.b and s.inst_id = t1.b and t1.b = :1)'    
  INTO aSelect USING aUse;    
  RETURN aSelect;    
  END;    
  /    
  select test_function_dynamic_select(1) from dual;|SQL> select test_function_dynamic_select(1) from dual;,TEST_FUNCTION_DYNAMI     
  --------------------     
  1,1 row fetched.|  
|  
|
|动态insert|CREATE OR REPLACE FUNCTION test_function_dynamic_insert(aUse INT) RETURN INT IS    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'insert into t1 select STATISTIC#, value from gv$sysstat where inst_id = :1 and STATISTIC# !=:2 limit 1' USING aUse, aUse;     
  RETURN SQL%ROWCOUNT;    
  END;    
  /    
  select test_function_dynamic_insert(2) from dual;|YAS-05235 cannot perform a DML or DDL or DCL inside a query or DML|  
|  
|
|动态update|CREATE OR REPLACE FUNCTION test_function_dynamic_update(aUse INT) RETURN INT IS    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'UPDATE t1 SET a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1) WHERE a = 1' USING aUse;     
  RETURN SQL%ROWCOUNT;    
  END;    
  /    
  select test_function_dynamic_update(2) from dual;|YAS-05235 cannot perform a DML or DDL or DCL inside a query or DML|  
|  
|
|动态delete|CREATE OR REPLACE FUNCTION test_function_dynamic_delete(aUse INT) RETURN INT IS    
  aSelect int;    
  BEGIN    
  EXECUTE IMMEDIATE 'DELETE from t1 where a = (SELECT a.instance_number FROM gv$instance a WHERE a.instance_number=:1)' USING aUse;     
  RETURN SQL%ROWCOUNT;    
  END;    
  /    
  select test_function_dynamic_delete(2) from dual;|YAS-05235 cannot perform a DML or DDL or DCL inside a query or DML|  
|  
|
