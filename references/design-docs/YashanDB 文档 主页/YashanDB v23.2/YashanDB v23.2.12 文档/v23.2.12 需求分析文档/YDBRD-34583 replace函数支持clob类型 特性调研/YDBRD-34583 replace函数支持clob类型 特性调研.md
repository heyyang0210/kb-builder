IR链接：  [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b077?](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b077?)  #YASHAN-295  replace函数支持clob类型

SR链接：  [https://pingcode.yasdb.com/pjm/items/6717aff8e489dd0868fc6d42?](https://pingcode.yasdb.com/pjm/items/6717aff8e489dd0868fc6d42?)  #YDBRD-34583 replace函数支持clob类型

##   [1. 总述](#1-总述)  

eplace函数支持clob类型

###   [1.1 需求合理性分析](#11-需求合理性分析)  

需求来源：华润POC

###   [1.2 需求实现分析](#12-需求实现分析)  

Oracle19c表现：

1、第一个参数EXPR可以是超长的CLOB/NCLOB。

![image.png](https://pingcode.yasdb.com/atlas/files/public/67dd1d4739823f2ac1f26e7d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUJDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA0MzYsImV4cCI6MTc4MjM4MTIzNn0.qhWHlLH-QihVALgxtwA90CLgfsHiuXDiuZH0urio2kc)

2、第二个和第三个参数规格上不拦截CLOB/NCLOB，但是执行阶段会拦截不能转换成VARCHAR的CLOB/NCLOB(oracle是32767字节，yashan现在规格是65534字节)。

![image.png](https://pingcode.yasdb.com/atlas/files/public/67dd1d7a39823f2ac1f26e80/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUJDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzA0MzYsImV4cCI6MTc4MjM4MTIzNn0.qhWHlLH-QihVALgxtwA90CLgfsHiuXDiuZH0urio2kc)



用例：

> drop table buildin_bigLob_tb;  create table buildin_bigLob_tb(id int, c1 clob, c2 nclob);    DECLARE    dest_clob CLOB := cast('dfghabcdDFGHabcd' as clob);-- 16 bytes    src_clob CLOB := cast('dfghabcdDFGHabcd' as clob);    dest_nclob NCLOB := cast('dfghabcdDFGHabcd' as nclob);    src_nclob NCLOB := cast('dfghabcdDFGHabcd' as nclob);  BEGIN  	for i in 1..2046 loop   		DBMS_LOB.APPEND(dest_clob, src_clob);  		DBMS_LOB.APPEND(dest_nclob, src_nclob);  	end loop;      insert into buildin_bigLob_tb values(0, dest_clob, dest_nclob);  	DBMS_LOB.APPEND(dest_clob, src_clob);  	DBMS_LOB.APPEND(dest_nclob, src_nclob);  	insert into buildin_bigLob_tb values(1, dest_clob, dest_nclob);  END;  /      select length(replace(c1, 'a', 'z')) from buildin_bigLob_tb where id = 0;  select length(replace(c1, 'a', 'z')) from buildin_bigLob_tb where id = 1;    select length(replace('a', c1, 'z')) from buildin_bigLob_tb where id = 0;  select length(replace('a', c1, 'z')) from buildin_bigLob_tb where id = 1;    select length(replace('a', 'z', c1)) from buildin_bigLob_tb where id = 0;  select length(replace('a', 'z', c1)) from buildin_bigLob_tb where id = 1;  

3、返回值类型

返回值类型是否为CLOB/NCLOB取决于第一个参数是否为CLOB/NCLOB，第二三个参数类型不影响返回值类型。



drop table buildin_smallLob_tb;

create table buildin_smallLob_tb(c1 clob);

insert into buildin_smallLob_tb values('a');

DROP TABLE buildin_smallLob_suc_tb;

CREATE TABLE buildin_smallLob_suc_tb AS SELECT REPLACE(c1,'a','a') COL1,REPLACE('a',c1,'a') COL2,REPLACE('a','a',c1) COL3 from buildin_smallLob_tb;

DESC buildin_smallLob_suc_tb;

###   [1.3 数据字典](#13-数据字典)  

###   [1.4 开源依赖](#14-开源依赖)  

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

