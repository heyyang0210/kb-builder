Created by 李浩勇, last modified on 八月 06, 2024

# 1. 概述

本文描述BULK COLLECT语法的测试设计

IR：    [YDBRD-9638](https://jira.yasdb.com/browse/YDBRD-9638?src=confmacro)    -  支持FORALL功能  完成

  


支持范围：单机，集群，分布式 （只 支持local UDT，不支持存储过程）

# 2. 需求分析

## 2.1 功能点分析

FORALL语句会把多条插入、更新、删除操作绑定到一起批量处理，使PL/SQL引擎与SQL引擎的上下文切换只发生一次，从而减少系统开销，提升性能。

  


语法结构

```
FORALL index IN
	[ lower_bound ... upper_bound ]
	[ SAVE EXPECTIONS ]
	sql_statement;
```

  


语法使用

```
declare
	type ty_test is table of tb_test%rowtype;
	res_test ty_test;
	cursor cur_test(s int) is select * from tb_test where c1 <= s;
begin
	open cur_test(5);
	fetch cur_test bulk collect into res_test;
	forall idx in res_test.first .. res_test.last
		update tb_test set c3 = c3 + 10 where c1 = res_test(idx).c1;
	for n in res_test.first .. res_test.last loop
		DBMS_OUTPUT.PUT_LINE(res_test(n));
	end loop;
end;
/
```

## 2.2 应用场景

当有多条DML语句需要处理时，使用FORALL语法可以提升性能，包括insert，update，delete，merge into，并且DML语句包含与索引变量相关内容。

## 2.3 规格约束

1、forall主题语句必须是一个单独的DML语句（insert，update，delete，merge into）；    
  2、forall的上下边界不必覆盖整个集合内容；    
  3、上下边对SQL语句必须为连续有效值；    
  4、集合下标不支持索引表达式；    
  5、暂不支持使用returning + bulk collect into     
  6、支持属性：SQL%FOUND、SQL%NOTFOUND、SQL%ROWCOUNT、SQL%ISOPEN、SQL%BULK_ROWCOUNT、SQL%BULK_EXCEPTIONS    
  7、回滚及异常：    
  如发生异常回滚则整体回滚；    
  异常发生后默认结束执行，加上save exceptions可继续执行（下标越界优先级高于save）    
  8、暂不支持indices of 和 values of

# 3. 详细测试设计

## 3.1 测试设计方法

本次测试主要采用场景法、正交组合法、等价类进行测试

## 3.2 详细测试设计

### 3.2.1 测试设计

|FORALL|语法验证|关键字|有空格或者引号||||
|---|---|---|---|---|---|---|
||||拼写错误||||
||||大小写识别||||
|||index_name|’index‘||||
||||与变量重名||||
||||不合法字符|数字/字符串/时间|||
|||整体语法不完整/错误|||||
|||commit与rollback验证|||||
||lower_bound .. upper_bound|传入参数校验|0/负数/null/字符串/时间||||
|||upper <= lower|||||
|||集合正常的返回值|first/last|t_tb_forall_005.FIRST .. t_tb_forall_005.LAST|||
||||COUNT|1 .. t_tb_forall_005.count|||
||||limit|1 .. t_tb_forall_005.limit|　直接报错（场景细分）||
||||边界值|65535/65536/2113663/2113664|无异常与有异常|  
|
||indices of/values of|不支持/拦截|||||
||dml_statement|语句类型|insert||||
||||delete||||
||||update||||
||||merge into||||
||||ddl|编译阶段报错|||
||||select|编译阶段报错|  
|  
|
|||语句执行方式|静态||||
||||动态|不支持语句编译阶段报错|||
|||对象表|不存在||||
|||values|类型（嵌套组合）|table|||
|||||varry|||
|||||object|||
|||||record|||
||||来源|预定义并赋值的UDT变量|||
|||||预定义由BULK COLLECT从表中取出的数据|||
|||||构造函数|普通构造函数||
||||||数组函数操作    
  (自定义数组，BULK返回数组)|String_to_array|
|||||||array_append|
|||||||array_remove|
|||||||array_replace|
|||||||extend/delete/trim|
||||子查询|报错|||
||||表类型覆盖|tac表/LSC表/临时表/分区表/大宽表|  
|  
|
||||运算A.f(i) + 1/表达式abs(A.f(i))|  
|  
|  
|
||||多值导入，单值导入|  
|  
|  
|
||||where条件与字段匹配/不匹配|  
|  
|  
|
||||传入变量|in/out/in out|||
||||function返回值||||
||||pkg头部定义的变量||||
||||嵌套类型的元素|table、varray、object|||
||||元素|下标存在与不存在|||
||||values类型与目标表类型不匹配|可转化|||
|||||不可转化|||
|||index|纯index打印，表达式|A(i).f　|||
|||BULK与FORALL结合测试|BULK获取数据供FORALL使用|  
|  
|  
|
||save exceptions|异常种类|zero_divide异常||||
||||InvalidNumber异常||||
||||NoDataFound异常|不触发异常|||
||||index does not exist||||
||||自定义异常||||
||||无异常||||
||||未处理异常||||
||||无关键字有异常处理模块||||
||||FORALL自带异常验证|ERR_PL_FORALL_DML_ERRORS|FORALL有SAVE EXCEPTIONS时内部dml出错时会抛出此错误码|  
|
|||||ERR_PL_FORALL_EXCEPTION_INIT_ERRORS|引用了FORALL特有的但未进行初始化的隐式游标|  
|
|||||ERR_PL_FORALL_IN_BIND_ERRORS|FORALL的dml中没有出现COLLECTION(I)的绑定|  
|
|||||ERR_PL_FORALL_I_ISOLATE_ERRORS|FORALL的dml中index单独出现|  
|
|||异常属性|COUNT||||
||||ERROR_INDEX||||
||||ERROR_CODE||||
||||异常属性索引验证||||
||||在exception之外打印异常属性||||
|||异常处理方式及错误码|系统预定义|  
|||
||||EXCEPTION变量声明|  
|||
||||RAISE_APPLICATION_ERROR|  
|||
||||EXCEPTION_INIT|  
|||
||||SQLCODE&SQLERRM|  
|  
|  
|
||||STANDARD|  
|  
|  
|
||||RAISE|  
|  
|  
|
|||关键字语法验证 |||||
|||save EXCEPTION 结合rollback,commit 验证|  
|  
|  
|  
|
||FORALL属性|SQL%FOUND|||||
|||SQL%NOTFOUND|||||
|||SQL%ROWCOUNT|||||
|||SQL%ISOPEN|||||
|||SQL%BULK_ROWCOUNT|||||
|||SQL%BULK_EXCTPTIONS|||||
||兼容交互|包/存储过程/函数中使用|||||
||性能|不劣化（UID）测试基线|  
|  
|  
|  
|


### 并发设计

||并发场景（表数据量10000）|并发|
|---|---|---|
|并发测试|对同一张表的FORALL insert操作，含where条件，多列多值导入，values与条件均为集合变量，打印rowcount|10|
||对同一张表的FORALL update操作，含where条件，动态执行，values与条件均为集合变量，打印rowcount|10|
||对同一张表的FORALL delete操作，含where条件，多列多值导入，打印rowcount|10|
||对同一张表的update操作，与其余DML操作不起锁冲突|5|
||对同一张表的insert操作，与其余DML操作不起锁冲突|5|
||对同一张表的delete操作，与其余DML操作不起锁冲突|5|
||对同一张表的除0和非空约束异常FORALL操作,异常处理|5|
||对同一分区表的FORALL insert操作，含where条件，多列多值导入，values与条件均为集合变量，打印rowcount|10|
||对同一张分区表的FORALL update操作，含where条件，动态执行，values与条件均为集合变量，打印rowcount|10|
||对同一张分区表的FORALL delete操作，含where条件，多列多值导入，打印rowcount|10|
||对同一张分区表的update操作，与其余DML操作不起锁冲突|5|
||对同一张分区表的insert操作，与其余DML操作不起锁冲突|5|
||对同一张分区表的delete操作，与其余DML操作不起锁冲突|5|
||对同一张分区表进行分区truncate操作，与其余DML操作不起锁冲突，且不影响bulk操作数据|5|
||对普通表的查询操作，全表扫描|5|
||对分区表的查询操作，全表扫描|5|
||存储过程调用|10|


forall 异常叠加

1、异常类型：

FORALL  越界（ i 超过varray长度，i 值在关联数组键值中不存在）

值错误，字符类型存入数字类型

值长度超出，varchar(10) - > varchar(5)

除 0 错误

主键冲突

2、异常对象组合

FORALL异常 有、无 save exceptions

DML异常 有、无 save exceptions

所有异常 + varray 有、无 save exceptions

所有异常 + 关联数组 有、无 save exceptions

  


用例设计-oracle对比

|序号|场景描述|用例|yashan|oracle|
|---|---|---|---|---|
|1|纯FORALL循环异常,关联数组,forall first 值不存在,  
,有无save exceptions,相同|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
	type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
	type type_001 is table of pkg_indexby_nestedpl_012.type_001 index by pls_integer;
begin
	declare
		v1 type_001 := type_001(-5=>pkg_indexby_nestedpl_012.type_001(-5, 'test1'), 0=>pkg_indexby_nestedpl_012.type_001(0, 'test2'));
	begin

    v1(5) := pkg_indexby_nestedpl_012.type_001(5, 'test');
	
    forall i in -10 .. 10
      insert into tb_indexby_nestedpl_012 values(v1(i).c1, v1(i).c2);

		exception
			when others then
  			DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
				DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);	
				DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);

				FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
					DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
					DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
				END LOOP;
	end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|![](https://pingcode.yasdb.com/atlas/files/public/67396bf8a1ad9a3311dc86c7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),均无数据导入|![](https://pingcode.yasdb.com/atlas/files/public/67396bf88970c2af4f520851/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),均无数据导入|
|2|纯FORALL循环异常,关联数组,forall first 值存在,  
,无save exceptions|forall i in -5 .. 10,  
,其余同上|![](https://pingcode.yasdb.com/atlas/files/public/67396bf8a1ad9a3311dc86c8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),![](https://pingcode.yasdb.com/atlas/files/public/67396bf8a1ad9a3311dc86c9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf88970c2af4f520852/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),![](https://pingcode.yasdb.com/atlas/files/public/67396bf8a1ad9a3311dc86ca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|3|纯FORALL循环异常,关联数组,forall first 值存在,  
,有save exceptions|forall i in -5 .. 10 save exceptions,  
,其余同上|![](https://pingcode.yasdb.com/atlas/files/public/67396bf88970c2af4f520854/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),![](https://pingcode.yasdb.com/atlas/files/public/67396bf88970c2af4f520855/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54), 只导入第一条数据|![](https://pingcode.yasdb.com/atlas/files/public/67396bf8a1ad9a3311dc86cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),正常数据全部导入|
|4|纯FORALL循环异常,table,forall first 值不存在,  
,有无save exceptions,相同|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
	type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
	type type_001 is table of pkg_indexby_nestedpl_012.type_001;
begin
	declare
		v1 type_001 := type_001(pkg_indexby_nestedpl_012.type_001(-5, 'test1'), pkg_indexby_nestedpl_012.type_001(0, 'test2'), pkg_indexby_nestedpl_012.type_001(5, 'test2'));
	begin
	
    forall i in -5 .. 3 --save exceptions
      insert into tb_indexby_nestedpl_012 values(v1(i).c1, v1(i).c2);

		exception
			when others then
  			DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
				DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);	
				DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);

				FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
					DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
					DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
				END LOOP;
	end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|![](https://pingcode.yasdb.com/atlas/files/public/67396bf88970c2af4f520857/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf8a1ad9a3311dc86cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|5|纯FORALL循环异常,table,forall first 值存在,  
,无save exceptions|forall i in 1 .. 5,其余同上|![](https://pingcode.yasdb.com/atlas/files/public/67396bf88970c2af4f520858/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf8a1ad9a3311dc86cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|6|纯FORALL循环异常,table,forall first 值存在,  
,有save exceptions|v1.delete(2);,构造 table 稀疏数组,forall i in 1 .. 5 save exceptions|![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f52085a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|7|纯FORALL循环异常,varray,forall first 值不存在,  
,有无save exceptions,相同|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
	type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
	type type_001 is varray(3) of pkg_indexby_nestedpl_012.type_001;
begin
	declare
		v1 type_001 := type_001(pkg_indexby_nestedpl_012.type_001(-5, 'test1'), pkg_indexby_nestedpl_012.type_001(0, 'test2'), pkg_indexby_nestedpl_012.type_001(5, 'test2'));
	begin
    forall i in -5 .. 5 save exceptions
      insert into tb_indexby_nestedpl_012 values(v1(i).c1, v1(i).c2);

		exception
			when others then
  			DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
				DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);	
				DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);

				FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
					DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
					DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
				END LOOP;
	end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f52085b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|8|纯FORALL循环异常,varray,forall first 值存在,  
,无save exceptions|forall i in 1 .. 5|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f52085c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86d0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|9|纯FORALL循环异常,varray,forall first 值存在,  
,有save exceptions|forall i in 1 .. 5 save exceptions,数组长度为3，元素个数为3,  
,/,  
,  
,forall i in 1 .. 10 save exceptions,数组长度为5，元素个数为3|![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|10|forall + DML,关联数组,FORALL first 值存在,无save exceptions|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
type type_001 is table of pkg_indexby_nestedpl_012.type_001 index by pls_integer;
begin
declare
v1 type_001 := type_001(-10=>pkg_indexby_nestedpl_012.type_001(-10, 'test1'), 10=>pkg_indexby_nestedpl_012.type_001(10, 'test2'));
begin


    v1(20) := pkg_indexby_nestedpl_012.type_001(20, 'testtesttesttest');
    v1(30) := pkg_indexby_nestedpl_012.type_001(30, 'testtesttesttest');
    v1(40) := pkg_indexby_nestedpl_012.type_001('test1', 'test');
    v1(50) := pkg_indexby_nestedpl_012.type_001(50, 'test');
    v1(60) := pkg_indexby_nestedpl_012.type_001('test2', 'testtesttesttest');
    v1(70) := pkg_indexby_nestedpl_012.type_001(0, 'test');
    v1(80) := pkg_indexby_nestedpl_012.type_001(50, 'test');

    forall i in -10 .. 80 --save exceptions
      insert into tb_indexby_nestedpl_012 values(1000/v1(i).c1, v1(i).c2);

exception
when others then
DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);
DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(-10):' ||SQL%BULK_ROWCOUNT(-10) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(10):' ||SQL%BULK_ROWCOUNT(10) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(20):' ||SQL%BULK_ROWCOUNT(20) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(30):' ||SQL%BULK_ROWCOUNT(30) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(40):' ||SQL%BULK_ROWCOUNT(40) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(50):' ||SQL%BULK_ROWCOUNT(50) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(60):' ||SQL%BULK_ROWCOUNT(60) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(70):' ||SQL%BULK_ROWCOUNT(70) || ' rows.');
DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(70):' ||SQL%BULK_ROWCOUNT(80) || ' rows.');


FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
END LOOP;
end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f52085e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f52085f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|11|forall + DML,关联数组,FORALL first 值存在,有save exceptions|forall i in -10 .. 80 save exceptions,  
|![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86d6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f520860/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86d8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f520861/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54),此场景下，oracle 主键 冲突异常 合其他异常不同|
|12|forall + DML,table,FORALL first 值存在,无save exceptions|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
	type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
	type type_001 is table of pkg_indexby_nestedpl_012.type_001;
begin
	declare
		v1 type_001 := type_001(pkg_indexby_nestedpl_012.type_001(-10, 'test1'), pkg_indexby_nestedpl_012.type_001(10, 'test2'), pkg_indexby_nestedpl_012.type_001(20, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(30, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001('test1', 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'), pkg_indexby_nestedpl_012.type_001('test2', 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(0, 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'));
	begin
		v1.delete(2);
    forall i in 1 .. 15 --save exceptions
      insert into tb_indexby_nestedpl_012 values(1000/v1(i).c1, v1(i).c2);

		exception
			when others then
				DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
				DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);	
				DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);
				for i in 1 .. SQL%BULK_EXCEPTIONS.COUNT loop
					DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(-10):' ||SQL%BULK_ROWCOUNT(i) || ' rows.');
				end loop;
				
				FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
					DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
					DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
				END LOOP;
	end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|  
,![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f520862/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f520863/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|13|forall + DML,table,FORALL first 值存在,有save exceptions|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396bf9a1ad9a3311dc86da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bf98970c2af4f520864/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|14|forall + DML,varray,FORALL first 值存在,无save exceptions|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
	type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
	type type_001 is varray(10) of pkg_indexby_nestedpl_012.type_001;
begin
	declare
		v1 type_001 := type_001(pkg_indexby_nestedpl_012.type_001(-10, 'test1'), pkg_indexby_nestedpl_012.type_001(10, 'test2'), pkg_indexby_nestedpl_012.type_001(20, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(30, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001('test1', 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'), pkg_indexby_nestedpl_012.type_001('test2', 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(0, 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'));
	begin
    forall i in 1 .. 15 --save exceptions
      insert into tb_indexby_nestedpl_012 values(1000/v1(i).c1, v1(i).c2);

		exception
			when others then
				DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
				DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);	
				DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);
				for i in 1 .. SQL%BULK_EXCEPTIONS.COUNT loop
					DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(-10):' ||SQL%BULK_ROWCOUNT(i) || ' rows.');
				end loop;
				
				FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
					DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
					DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
				END LOOP;
	end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|![](https://pingcode.yasdb.com/atlas/files/public/67396bfa8970c2af4f520865/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bfaa1ad9a3311dc86db/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|15|forall + DML,varray,FORALL first 值存在,有save exceptions|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396bfaa1ad9a3311dc86dc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bfaa1ad9a3311dc86dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|16|无异常|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
	type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
	type type_001 is table of pkg_indexby_nestedpl_012.type_001;
begin
	declare
		v1 type_001 := type_001(pkg_indexby_nestedpl_012.type_001(-10, 'test1'), pkg_indexby_nestedpl_012.type_001(10, 'test2'), pkg_indexby_nestedpl_012.type_001(20, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(30, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001('test1', 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'), pkg_indexby_nestedpl_012.type_001('test2', 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(0, 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'));
	begin
    forall i in 1 .. 9 save exceptions
      insert into tb_indexby_nestedpl_012 values(1000/v1(i).c1, v1(i).c2);

		exception
			when others then
				DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
				DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);	
				DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);
				for i in 1 .. SQL%BULK_EXCEPTIONS.COUNT loop
					DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(-10):' ||SQL%BULK_ROWCOUNT(i) || ' rows.');
				end loop;
				
				FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
					DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
					DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
				END LOOP;
	end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|![](https://pingcode.yasdb.com/atlas/files/public/67396bfa8970c2af4f520868/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bfaa1ad9a3311dc86de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|17|indices of table ,(稀疏),DML 索引越界|```
drop table tb_indexby_nestedpl_012;
create table tb_indexby_nestedpl_012(c1 int, c2 varchar(6));
create unique index idx_indexby_nestedpl_012_1 on tb_indexby_nestedpl_012(c1);

--create package
create or replace package pkg_indexby_nestedpl_012 is
	type type_001 is record(c1 varchar(100), c2 varchar(100));
end;
/

--create procedure1
create or replace procedure pro_indexby_nestedpl_012_1(c1 int) is
	type type_001 is table of pkg_indexby_nestedpl_012.type_001;
begin
	declare
		v1 type_001 := type_001(pkg_indexby_nestedpl_012.type_001(-10, 'test1'), pkg_indexby_nestedpl_012.type_001(10, 'test2'), pkg_indexby_nestedpl_012.type_001(20, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(30, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001('test1', 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'), pkg_indexby_nestedpl_012.type_001('test2', 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(0, 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'));
		v2 type_001 := type_001(pkg_indexby_nestedpl_012.type_001(-10, 'test1'), pkg_indexby_nestedpl_012.type_001(10, 'test2'), pkg_indexby_nestedpl_012.type_001(20, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(30, 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001('test1', 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'), pkg_indexby_nestedpl_012.type_001('test2', 'testtesttesttest'), pkg_indexby_nestedpl_012.type_001(0, 'test'), pkg_indexby_nestedpl_012.type_001(50, 'test'));
	begin
	v2.delete(2);
	v2.delete(5);
    forall i in indices of v1 save exceptions
      insert into tb_indexby_nestedpl_012 values(1000/v2(i).c1, v2(i).c2);

		exception
			when others then
				DBMS_OUTPUT.PUT_LINE('exception_code: ' || SQLCODE);
				DBMS_OUTPUT.PUT_LINE('exception_info: ' || SQLERRM);	
				DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions.count:' ||SQL%BULK_EXCEPTIONS.COUNT);
				for i in 1 .. SQL%BULK_EXCEPTIONS.COUNT loop
					DBMS_OUTPUT.PUT_LINE ('SQL%BULK_ROWCOUNT(-10):' ||SQL%BULK_ROWCOUNT(i) || ' rows.');
				end loop;
				
				FOR I IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
					DBMS_OUTPUT.PUT_LINE('sql%bulk_exceptions(i).error_index:' || SQL%BULK_EXCEPTIONS(I).ERROR_INDEX);
					DBMS_OUTPUT.PUT_LINE('sqlerrm sql%bulk_exceptions(i).error_code:' || SQLERRM(SQL%BULK_EXCEPTIONS(I).ERROR_CODE));
				END LOOP;
	end;
end pro_indexby_nestedpl_012_1;
/

call pro_indexby_nestedpl_012_1(10);
```|![](https://pingcode.yasdb.com/atlas/files/public/67396bfa8970c2af4f52086a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|![](https://pingcode.yasdb.com/atlas/files/public/67396bfaa1ad9a3311dc86df/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUNvS0JBRVFLQ1JCQUVLQlVBQUFDQ0FBRFJCQUFBaUlBRllnZ2xBU0NBRWdVUVlBQUlBVUFJQ2tDQkNWSUFBQUdBQUFBQ2dBREFnS0ZBQUFsQVFBQUJBQ0FCRUNBQWdNQ0FwQWM0QUVBUkZBQUJVSWdBZ29aQWZKQUFBQWxRUUJCdGdBSlFBSUZFV2dBU1FBd2NBU0VBQUJBbWV4QUVJZ0FBUThvUkFDQkFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMTUsImV4cCI6MTc4MjMwOTExNX0.DAJgSHSPHeszCEj7X7hhLmT2qtDB2_8i3gw98_1Uq54)|
|18|  
|  
|  
|  
|
|19|  
|  
|  
|  
|
|20|  
|  
|  
|  
|


### 3.2.2 涉及的测试DFX

|系统级DFX分类|是否涉及|
|:---|:---|
|CT 并发测试|是|
|DFR|/|
|HA|/|
|KT kill测试|是|
|一致性|是|
|三方测试工具    
  (sqltest，sqlancer)|/|
|压力|/|
|可维护性|/|
|安全|/|
|性能|是|
|长稳|是|


# 4.   **测试用例**

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

工作量：10  *人天*

计划测试完成时间：

  


  


  


  


  


  


  


  


## Attachments:

[FORALL文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjU4OTcwYzJhZjRmNTIwODJkIiwicmVmX2lkIjoiNjczOTZiZjQ1OTNmOTljOWZmMjM2OGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzE1LCJleHAiOjE3ODIzODQ3MTV9.EUk02JxZfw8l0J8dHz52mjI-wjLS6VLlT-uupC6bDXM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-8-6_10-57-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjU4OTcwYzJhZjRmNTIwODM1IiwicmVmX2lkIjoiNjczOTZiZjQ1OTNmOTljOWZmMjM2OGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzE1LCJleHAiOjE3ODIzODQ3MTV9.ZwxGhx76VqykRALxo681cO9W6A8YrtCuf-csrcdakVg)

 (image/png)    


[image2024-8-6_11-42-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZjY4OTcwYzJhZjRmNTIwODQ2IiwicmVmX2lkIjoiNjczOTZiZjQ1OTNmOTljOWZmMjM2OGVjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzE1LCJleHAiOjE3ODIzODQ3MTV9.fmDGOm2clUYzQBMvRRO0aYCAG8_iYSGapYjdFe12xwc)

 (image/png)    


## Comments:

|  [](null)  ,并发：,1.for all需要测试KT场景（带kill的并发  kill方式用  randomkill  ）,2.for all + bulk 并发,3.for all过程中触发异常，无save exception、有save exception两种场景分别并发。,Posted by zhangxin at 十二月 21, 2023 10:54|
|---|
