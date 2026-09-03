Created by 李美娥 on 十一月 04, 2024

# 1. 概述

本文描述

IR：        [https://pingcode.yasdb.com/pjm/items/66115655579a3edb84d68bdb](https://pingcode.yasdb.com/pjm/items/66115655579a3edb84d68bdb)    ?    
  #YDBRD-19152 支持WHERE CURRENT OF子句

# 2. 需求分析

## 2.1 功能点分析

where {current of cursor_name| search_condition}，cursor_name是for update游标

## 2.2 应用场景

cursor cursor_name is select ...  for update of 表+  update/delete 表where current of cursor_name 

从单个表查询，锁单个表，update/delete单张表；

从多个表查询，锁单个表，update/delete单张表；

锁多张表，update单张表（多张表可以覆盖在不同模式下，不常见，也不生效）

## 2.3 规格约束

1  、数据库形态：单机，集群

2、对象类型：行表  ，同名词，视图，临时表

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用等价类、错误推测法进行测试，  for update方案罗列的测试点下，后面添加update/delete操作，此需求额外强相关的测试点如下：

|一级分类|二级分类|测试点|
|---|---|---|
|语法图|新增的current of语法,update/delete本身语法图，抽样覆盖|新增的current of语法：,1、cursor_name的长度、名称含特殊字符等、大小写名敏感、cursor_name是其他模式的pkg下的全局包游标（模式和pkg都达到上限长度）--低,2、缺少关键字current或者of，报错,3、跟search_condition混合使用，报错,4、多次使用current of cursor_name,cursor_name或者current of cursor_name and current of cursor_name,5、update where修改的值触发了主键约束、值超过范围等异常,6、父子表存在外键约束，修改或者删除主表，验证子表的数据,update/delete本身语法图，抽样覆盖:,1、  update的set后面default值、expr、子查询、函数的返回值,2、update修改/delete删除某个分区（查询的数据跨度多个分区，修改仅针对某一个分区）,3、update delete  带上dblink|
|cursor_name|  
|1、cursor_name是其他类型游标：非显示游标后面不带for update，后面修改使用where current of curname，报错,4、cursor_name使用在其他非delete update的where current of后，报错(select后面使用等)|


## 3.2 详细测试设计

### 3.2.1 测试设计

无单独的，在for update后面均使用update where current of即可（delete where current of是从update里面挑选一些测试，不全面涵盖）

### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|/|
|KT kill测试|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|/|
|长稳|/|


# 4.   **测试用例**     电子表格

# 5.   **测试框架设计**

本次测试使用guider框架，一致性框架、testkill框架和ha框架  实现

# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# **7. 工作量评估**

工作量：X  *人天*

计划测试完成时间：



# 8.部分差异

|序号|描述|语句|yashan表现|  
oracle表现|结论|
|---|---|---|---|---|---|
|1|**某些列存在重复数据时，跟oracle有差异**,**test_sdv_YDBRD_19151_dynamic_08_1也有这个差异**,----------------------------,|create table tb_YDBRD_19151_dynamic_01(employee_id int,department_id int,job_id VARCHAR(50),salary number,last_name varchar(50),first_name varchar(2000),hire_date  date,overpayment varchar(2000));insert into tb_YDBRD_19151_dynamic_01 values(2,1,'SA_REP',4400,'fdsfdf1','fdsfdf','2024-4-22','fdsfdf');insert into tb_YDBRD_19151_dynamic_01 values(1,2,'SA_REP',24000,'fdsfdf2','fdsfdf','2024-4-22','fdsfdf');insert into tb_YDBRD_19151_dynamic_01 values(2,3,'SA_REP',17000,'fdsfdf3','fdsfdf','2024-4-22','fdsfdf');insert into tb_YDBRD_19151_dynamic_01 values(1,4,'SA_REP',4400,'fdsfdf4','fdsfdf','2024-4-22','fdsfdf');insert into tb_YDBRD_19151_dynamic_01 values(3,5,'SA_REP',24000,'fdsfdf5','fdsfdf','2024-4-22','fdsfdf');insert into tb_YDBRD_19151_dynamic_01 values(3,6,'SA_REP',17000,'fdsfdf6','fdsfdf','2024-4-22','fdsfdf');insert into tb_YDBRD_19151_dynamic_01 values(2,1,'SA_REP',4400,'fdsfdf7',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));insert into tb_YDBRD_19151_dynamic_01 values(1,2,'SA_REP',24000,'fdsfdf8',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));insert into tb_YDBRD_19151_dynamic_01 values(2,3,'SA_REP',17000,'567fdsfdf',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));insert into tb_YDBRD_19151_dynamic_01 values(1,4,'SA_REP',4400,'fdsfdf9',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));insert into tb_YDBRD_19151_dynamic_01 values(3,5,'SA_REP',24000,'fdsfdf10',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));insert into tb_YDBRD_19151_dynamic_01 values(3,6,'SA_REP',17000,'fdsfdf11',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));commit;SELECT employee_id ,department_id ,job_id,salary ,last_name FROM tb_YDBRD_19151_dynamic_01 WHERE employee_id=1 for update SKIP LOCKED order by 1,2,3,4,5;CREATE OR REPLACE PROCEDURE pro_YDBRD_19151_dynamic_01(C INT) ISCURSOR cur1(N1 INT) is  SELECT * FROM tb_YDBRD_19151_dynamic_01 WHERE employee_id=N1 for update SKIP LOCKED order by 1,2,3,4,5,6,7,8;rec1 tb_YDBRD_19151_dynamic_01%rowtype;TYPE cusor1 IS REF CURSOR RETURN cur1%ROWTYPE; var_cur1 cusor1;TYPE cusor2 IS REF CURSOR RETURN var_cur1%ROWTYPE ;var_cur2 cusor2;v_int int;BEGIN	for rec1 in cur1(C) loop      delete from  tb_YDBRD_19151_dynamic_01 WHERE current of cur1;	  dbms_output.put_line('cur1 rowcount:=' || cur1%rowcount);    END LOOP;	select count(*) into v_int FROM tb_YDBRD_19151_dynamic_01 WHERE employee_id>=1 ;	dbms_output.put_line('v_int :='||v_int);	open var_cur2 for SELECT * FROM tb_YDBRD_19151_dynamic_01 WHERE employee_id>=c  for update SKIP LOCKED  order by 1,2,3,4,5,6,7,8;	LOOP    fetch var_cur2 into rec1;    EXIT WHEN var_cur2%NOTFOUND;	dbms_output.put_line('var_cur2 rowcount :='||var_cur2%rowcount);  dbms_output.put_line('rec1.employee_id: ' || rec1.employee_id || ' rec1.department_id ' || rec1.department_id);    UPDATE tb_YDBRD_19151_dynamic_01  SET salary = salary*0.25 where employee_id=rec1.employee_id and department_id = rec1.department_id;    END LOOP;    close var_cur2;END;/exec pro_YDBRD_19151_dynamic_01(1);--查询表数据已删除SELECT employee_id ,department_id ,job_id,salary ,last_name FROM tb_YDBRD_19151_dynamic_01 WHERE employee_id>=1 for update SKIP LOCKED order by 1,2,3,4,5;drop PROCEDURE pro_YDBRD_19151_dynamic_01;drop table tb_YDBRD_19151_dynamic_01;|![image.png](https://pingcode.yasdb.com/atlas/files/public/674916eea1ad9a3311de39ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|![image.png](https://pingcode.yasdb.com/atlas/files/public/67491708a1ad9a3311de39ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|测试推测：把for update去掉或者理论应该就是8行，oracle为什么处理只有四行暂不知道原因,开发结论：待补充,,12/3结论：,视为oracle bug, 做为不一致案例。|
|5|**两层嵌套的时候，update去找数据，里层的删除可能已经删掉了**,----------------------------,不同游标（SQL）在同一个事务当中更新同一条记录（当前存储引擎无法识别判断），建议合理性差异加入2层CI维持关注。|CREATE TABLE tb_YDBRD_19151_53_1 (,    employee_id NUMBER PRIMARY KEY,,    first_name VARCHAR2(50),,    last_name VARCHAR2(2000),,    salary NUMBER,);,insert into  tb_YDBRD_19151_53_1 values(1,'fdsfd',lpad('fdsfd',2000,'a'),45.67);,insert into  tb_YDBRD_19151_53_1 values(2,'fdsfd',lpad('fdsfd',2000,'b'),45.67);,insert into  tb_YDBRD_19151_53_1 values(3,'fdsfd',lpad('fdsfd',2000,'a'),45.67);,insert into  tb_YDBRD_19151_53_1 values(4,'fdsfd',lpad('fdsfd',2000,'b'),45.67);,insert into  tb_YDBRD_19151_53_1 values(5,'fdsfd',lpad('fdsfd',2000,'a'),45.67);,insert into  tb_YDBRD_19151_53_1 values(6,'fdsfd',lpad('fdsfd',2000,'b'),45.67);,commit;,declare,CURSOR emp_cursor IS SELECT employee_id, first_name, last_name, salary  FROM tb_YDBRD_19151_53_1   where employee_id>=1 order by employee_id  FOR UPDATE OF salary;,CURSOR emp_cursor_0 IS SELECT employee_id, first_name, last_name, salary  FROM tb_YDBRD_19151_53_1  where employee_id=2 order by employee_id   FOR UPDATE OF first_name;,begin,for rec in emp_cursor loop,  update tb_YDBRD_19151_53_1 set salary=9 where current of emp_cursor;,   for rec in emp_cursor_0 loop,  delete from  tb_YDBRD_19151_53_1  where current of emp_cursor_0;,  END LOOP;,end loop;,commit;,end;,/,select employee_id from tb_YDBRD_19151_53_1;,drop table tb_YDBRD_19151_53_1;,|![image.png](https://pingcode.yasdb.com/atlas/files/public/67491913a1ad9a3311de39b9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|![image.png](https://pingcode.yasdb.com/atlas/files/public/67491905a1ad9a3311de39b7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|感觉是问题，待开发结论,,12/3 结论,---------------------------------,跟进分析原因，拉存储一起看。|
|7|结果跟oracle不一样|create table tb_YDBRD_19151_68_01 (key int,c01 int, c02 int,c03 int,c04 int,c05 number,c06 number,c07 number,c08 number);,insert into tb_YDBRD_19151_68_01 values(1,111                  , 1412       , 111 , 255130    , 1346.5    ,  1345262         , 111 ,101);,insert into tb_YDBRD_19151_68_01 values(2,122                  , 1412       , 122  , 573436    , 1.5       ,  304562          , 123 ,101   )   ;,insert into tb_YDBRD_19151_68_01 values(3,122                  , 1411       , 111  , 573436    , 256.45    ,  7534562         , 111 ,101);,insert into tb_YDBRD_19151_68_01 values(4,2147483647 , 32767  , 127  , 9.2233720 ,3.402823   ,  -2334.0000002334, -122,1002  )  ;,insert into tb_YDBRD_19151_68_01 values(5,2147483647 , 32767        , 127  , 9.2233720 ,3.402823   ,  -2334.0000002334, 123 ,1002)  ;,insert into tb_YDBRD_19151_68_01 values(6,-2147483648, -32768       , -128 , -9.2233720, -3.402823 , 2334.0000002334  , -1.79769313486232, -1001)  ;,insert into tb_YDBRD_19151_68_01 values(7,-2147483648, -32768       , -128 , -9.2233720, -3.402823 , 2334.0000002334  , -1.79769313486232, -1001)  ;,insert into tb_YDBRD_19151_68_01 values(8,111        , 67           , 120  , 377365    , 65.3      ,  null            , 123 , 1001)  ;,insert into tb_YDBRD_19151_68_01 values(9,119        , 1411         , 111  , null      , 65.3      ,  4542562         , 127 , 1001)  ;,insert into tb_YDBRD_19151_68_01 values(10,123       , 67           , 121  , 377365    , null      ,  4542562         , 105 , 1001)  ;,insert into tb_YDBRD_19151_68_01 values(null, null,null,null,null,null,null,null,null)  ;,commit;,,,select key,c02,case when c02>119 then 1 else 0 end as c001  from tb_YDBRD_19151_68_01 where (c02,1) in (select t2.c02,case when t2.c02>119 then 1 else 0 end as c001 from tb_YDBRD_19151_68_01 t2  where rownum<= 1 group by t2.c02  )   for update order by 1,2;,CREATE OR REPLACE PROCEDURE pro_YDBRD_19151_68(C INT) IS,CURSOR cur1(N1 INT) is  select key,c02,case when c02>119 then 1 else 0 end as c001  from tb_YDBRD_19151_68_01 where (c02,1) in (select t2.c02,case when t2.c02>119 then 1 else 0 end as c001 from tb_YDBRD_19151_68_01 t2  where rownum<= 1 group by t2.c02  )   for update order by 1,2;,type rec is record(c0 int,c1 int,c2 int);,rec1 rec;,BEGIN,  OPEN cur1(C);,  LOOP,    fetch cur1 into rec1;,    EXIT WHEN cur1%NOTFOUND;,    UPDATE tb_YDBRD_19151_68_01  SET c08 = c08*2  WHERE  CURRENT OF cur1;,  END LOOP;,  CLOSE cur1;,END;,/,--成功，C02为1412的行对应的c08变化,exec pro_YDBRD_19151_68(1);,select c01,c02,c08 from tb_YDBRD_19151_68_01 order by 1,2,3;,,rollback;,drop table  tb_YDBRD_19151_68_01;,drop PROCEDURE pro_YDBRD_19151_68;|![image.png](https://pingcode.yasdb.com/atlas/files/public/674986a3a1ad9a3311de3ad6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|![image.png](https://pingcode.yasdb.com/atlas/files/public/674986b0a1ad9a3311de3ad7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|根据理论推，Oracle是正确的，待开发结论,,**of columns 相关相同问题单**|
|8|join相关|set serveroutput on,,,-- 创建部门表,CREATE TABLE tb_YDBRD_19151_67_departments (,    department_id NUMBER ,,    department_name VARCHAR2(50),);,,,-- 创建员工表,CREATE TABLE tb_YDBRD_19151_67_employees (,    employee_id NUMBER ,,    first_name VARCHAR2(50),,    last_name VARCHAR2(50),,    department_id NUMBER,,    salary NUMBER,);,,,-- 插入部门数据,declare,begin,for i in 1..1 loop,INSERT INTO tb_YDBRD_19151_67_departments (department_id, department_name) VALUES (1, 'HR');,INSERT INTO tb_YDBRD_19151_67_departments (department_id, department_name) VALUES (2, 'IT');,INSERT INTO tb_YDBRD_19151_67_departments (department_id, department_name) VALUES (3, 'Sales');,INSERT INTO tb_YDBRD_19151_67_departments (department_id, department_name) VALUES (4, 'Sales版本');,INSERT INTO tb_YDBRD_19151_67_departments (department_id, department_name) VALUES (5, 'Sales版本');,end loop;,end;,/,,,,,-- 插入员工数据，有重复行,declare,begin,for i in 1..1 loop,INSERT INTO tb_YDBRD_19151_67_employees (employee_id, first_name, last_name, department_id, salary) VALUES (1, 'John', 'Doe', 1, 5000);,INSERT INTO tb_YDBRD_19151_67_employees (employee_id, first_name, last_name, department_id, salary) VALUES (2, 'Jane', 'Smith', 2, 6000);,INSERT INTO tb_YDBRD_19151_67_employees (employee_id, first_name, last_name, department_id, salary) VALUES (3, 'Alice', 'Johnson', 1, 7000);,INSERT INTO tb_YDBRD_19151_67_employees (employee_id, first_name, last_name, department_id, salary) VALUES (4, 'Bob', 'Brown', NULL, 8000);,end loop;,end;,/,COMMIT;,,,SELECT e.first_name, e.last_name, d.department_name FROM tb_YDBRD_19151_67_employees e right JOIN tb_YDBRD_19151_67_departments d ON e.department_id = d.department_id for update of e.salary skip locked;,,--@testPoint 多表join，创建for update游标,set serveroutput on,CREATE OR REPLACE PROCEDURE pro_YDBRD_19151_67(C INT) IS,CURSOR cur3 is  SELECT e.first_name, e.last_name, d.department_name FROM tb_YDBRD_19151_67_employees e right JOIN tb_YDBRD_19151_67_departments d ON e.department_id = d.department_id for update of e.salary skip locked;,BEGIN,  for rec1 in cur3 loop,    dbms_output.put_line(rec1.first_name);,    UPDATE tb_YDBRD_19151_67_employees  SET salary = salary*2  WHERE  CURRENT OF cur3;,   NULL;,  end loop;,END;,/,exec pro_YDBRD_19151_67(2);,,,--查询表数据已修改,select * from tb_YDBRD_19151_67_employees   where LAST_NAME='Brown' order by 1,2,3,4,5;,,rollback;,drop PROCEDURE pro_YDBRD_19151_67;,drop table tb_YDBRD_19151_67_departments;,drop table tb_YDBRD_19151_67_employees;|![image.png](https://pingcode.yasdb.com/atlas/files/public/674d6f0ea1ad9a3311de3cb7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|![image.png](https://pingcode.yasdb.com/atlas/files/public/674d732aa1ad9a3311de3cc2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)|同  **问题9**|
|9|**待定**,----------------------------,right join 补NULL 值做为cusor内容的记录也会更新到，导致差异。在left join/inner join 时两条结果一致。,建议：当前yanshan 更合适些，非问题。做为2层CI，关注差异部分。|  [https://pingcode.yasdb.com/pjm/items/674587192c685d48562ecf83?](https://pingcode.yasdb.com/pjm/items/674587192c685d48562ecf83?)  ,#YDBRD-35818 【cursor for update】2个表进行right join，锁定其中一个表，采用where current of修改报错invalid ROWID，预期成功|||12/3 日结论：,做为差异案例|
|10|**待定**,----------------------------,两部分内容：,1. 视图部分差异为SQL层不支持，非PLSQL 导致。建议非问题。
1. of columns 为空时，oracle 在各个版本表现不一致，建议定一个自己标准处理，维护内部逻辑的一致性。建议非问题。
|  [https://pingcode.yasdb.com/pjm/items/67452811d6ec4c2fdf774df7?](https://pingcode.yasdb.com/pjm/items/67452811d6ec4c2fdf774df7?)  ,#YDBRD-35749 【cursor for update】锁定多表修改一个表/锁定的是表，修改的是视图/查询表含table函数仅带for update未具体指定锁定的列，跟oracle的表现不一致|||12/03 结论：,1. 跟进分析原因
,,    2. 分析规律：单表无需指定of colunns,,    多表是否指定唯一表的of columns ，待调研分析。,|
|11|锁定4个表里面的2个表，然后依次修改4张表，跟Oracle不一致（我们会检测表是否一致，yashan符合设计，跟oracle保持不一致)|drop table if exists tb_YDBRD_19151_19_1;,create table tb_YDBRD_19151_19_1(employee_id int,department_id int,job_id VARCHAR(50),salary number,last_name varchar(50),first_name varchar(2000),hire_date  date,overpayment varchar(2000));,insert into tb_YDBRD_19151_19_1 values(2,1,'SA_REP',4400,'fdsfdf',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));,insert into tb_YDBRD_19151_19_1 values(1,2,'SA_REP',24000,'fdsfdf',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));,insert into tb_YDBRD_19151_19_1 values(2,3,'SA_REP',17000,'567fdsfdf',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));,insert into tb_YDBRD_19151_19_1 values(1,4,'SA_REP',4400,'fdsfdf',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));,insert into tb_YDBRD_19151_19_1 values(3,5,'SA_REP',24000,'fdsfdf',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf',2000,'b'));,insert into tb_YDBRD_19151_19_1 values(3,6,'SA_REP',17000,'fdsfdf',lpad('fdsfdf',2000,'b'),'2024-4-22',lpad('fdsfdf9',2000,'b'));,commit;,create index index_YDBRD_19151_19 on tb_YDBRD_19151_19_1(employee_id);,CREATE TABLE tb_YDBRD_19151_19_2 AS SELECT * FROM tb_YDBRD_19151_19_1;,CREATE TABLE tb_YDBRD_19151_19_3 AS SELECT * FROM tb_YDBRD_19151_19_2;,CREATE TABLE tb_YDBRD_19151_19_4 AS SELECT * FROM tb_YDBRD_19151_19_3;,CREATE TABLE tb_YDBRD_19151_19_5 AS SELECT * FROM tb_YDBRD_19151_19_4;,,CREATE OR REPLACE PROCEDURE pro_YDBRD_19151_19(VAR_C INT) IS,CURSOR cur1(N1 INT) is  SELECT a.employee_id, b.department_id, c.salary,FROM tb_YDBRD_19151_19_1 a,, tb_YDBRD_19151_19_2 b,, tb_YDBRD_19151_19_3 c ,WHERE a.department_id IN (,    SELECT d.department_id,    FROM tb_YDBRD_19151_19_4 d,    WHERE d.department_id = 6,),AND c.employee_id = (,    SELECT e.employee_id,    FROM tb_YDBRD_19151_19_5 e,    WHERE e.overpayment = lpad('fdsfdf9',2000,'b'),) for update of a.employee_id ,b.salary;,TYPE  record_type IS record(a int,b int ,c number);,rec1 record_type;,BEGIN,  OPEN cur1(VAR_C);,  LOOP,    fetch cur1 into rec1;,    EXIT WHEN cur1%NOTFOUND;,	UPDATE tb_YDBRD_19151_19_1 a SET a.salary = a.salary*2  WHERE  CURRENT OF cur1;,	UPDATE tb_YDBRD_19151_19_2 a SET a.salary = a.salary*3  WHERE  CURRENT OF cur1;,	UPDATE tb_YDBRD_19151_19_3 a SET a.salary = a.salary*4  WHERE  CURRENT OF cur1;,	UPDATE tb_YDBRD_19151_19_4 a SET a.salary = a.salary*4  WHERE  CURRENT OF cur1;,  END LOOP;,  CLOSE cur1;,END;,/,exec pro_YDBRD_19151_19(0);||||


2、

（1）报错保持差异

![clipbord_1733813230750.png](https://pingcode.yasdb.com/atlas/files/public/6757e69fa1ad9a3311de45ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)



（2）、视图通过group by的方式创建

![image.png](https://pingcode.yasdb.com/atlas/files/public/6758014aa1ad9a3311de4631/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFDQUVBQUFBQUJBQUFJQ0FBQUNBQVFBQUVBQUFBRUFBQUFnQUJBQkFBQUVBRUFBQUFBUUFBQUFBd2dBQUFBQUVvQUFBQUFBQUFBQUFDQUFBQUdBQUFBQUFBRUFFZ0FBQkJnQUFDQUFBRUFBQUFBQUFBQUFBQ0FBQUFBQWdBQUlBQVVBQUVBSUFBQUFBQUlBQUFDRUVBQUFBQUFRS0FBRVFBQUFBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTc0NDIsImV4cCI6MTc4MjQ2ODI0Mn0.4NKucLxlb63sAuk5b7lj01e4sbdC9QtwsQcK7kOPdTQ)

