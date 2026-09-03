Created by 李凯峰, last modified on 五月 09, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/6618d1bdfd997db58ad7ffea](https://pingcode.yasdb.com/pjm/items/6618d1bdfd997db58ad7ffea)    ?    
  #YDBRD-26127 崖山DBLINK连接ORACLE支持SEQUENCE

*开发设计文档：*    [YDBRD-27844：DBLINK支持SEQUENCE 设计文档 - 朱月婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147779887)  

# 2. 需求分析

## 2.1 功能点分析

- dblink支持使用远端的sequence，本地支持使用sequence的地方都支持dblink远端使用


## 2.2 应用场景

- 投影列中使用
- ddl中使用，如  create table as、create materialized view等
- dml中使用，如update、insert、select（delete报错，不支持在filter中使用）


## 2.3 规格约束

- 不支持在filter中使用
- 不支持子查询中使用
- 不支持远端创建


# 3. 详细测试设计

## 3.1 测试设计方法

  


1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

[dblink支持sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTdhMWFkOWEzMzExZGM4ZDczIiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.kxr_ZajYDPWE2p0jE2KqjRPYrZ5PoiVGebgu2_6WDvM)

1.数据类型、表类型覆盖

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|存储类型|HEAP|  
|  
|
|数据类型|覆盖已支持的类型|  
|  
|
|表类型|分区表、非分区表|  
|  
|
|部署模式|单机，集群（是否支持）|  
|  
|


2.与其他特性交互测试，ddl中使用

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|create table as|create table t2 as select seq_01.nextval@mydblink from dual;|  
|  
|
|alter table|alter table t3 modify c1 default seq_02.nextval@mydblink;|  
|  
|
|create table|create table t3 (c1 int default seq_01.nextval@mydblink);,  
|  
|  
|
|create view|  
,  
|create view t4 as select seq_02.nextval@mydblink from t1;|  
|
|create materialized view|create materialized view t4 as select seq_02.nextval@mydblink from t1|  
|  
|
|create outline|CREATE OUTLINE ol_a FOR CATEGORY ctgy_ab ON select seq_01.nextval@mydblink from t1;|  
|  
|
|create sqlmap|CREATE SQLMAP map_branch (sales,'SELECT seq_01.nextval@mydblink FROM branches','select seq_01.nextval@mydblink from branches where area_no in (select area_no from area)');|  
|  
|


*3.与其他特性交互测试，dml中使用*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|delete|  
|DELETE FROM t1 WHERE c1=seq_01.nextval@mydblink;|  
|
|update（多字段、单字段）|UPDATE t1 SET c1=seq_01.nextval@mydblink WHERE c1=1;|  
|  
|
|  
|update test_update_par_tac_15618_01 t0,test_update_par_tac_15618_02 t1 set (t0.col1,t0.col2,t0.col3,t0.col4)=(seq_01.nextval,seq_01.nextval,seq_01.nextval,seq_01.nextval),(t1.col1,t1.col2,t1.col3,t1.col4)= (select col1,col2,col3,col4 from test_update_par_tac_15618_03 where col1=-101) where t0.col1=1 and t1.col1=-11;|  
|  
|
|update set的值符合约束与违反约束|check、union、primary key、not null、foreign key|check、union、primary key、not null、foreign key|  
|
|insert |insert into t1 values(seq_01.nextval@mydblink);|  
|  
|
|  
|INSERT INTO t2 SELECT seq_02.nextval@mydblink FROM t1 WHERE c1=1;|  
|  
|
|insert的值符合约束与违反约束|check、union、primary key、not null、foreign key|check、union、primary key、not null、foreign key|  
|
|merge|  
|报错|  
|
|select|投影列|  
|  
|
|  
|  
|limit后|  
|
|  
|  
|子查询|  
|
|  
|  
|order by后|  
|
|  
|  
|fetch sequence rows only|  
|
|group by|  
|select c1+seq_02.nextval,sum(seq_02.nextval) from t1 group by c1+seq_02.nextval; |  
|
|  
|  
|having|  
|
|rollup/cube/grouping sets|  
|select c1+seq_02.nextval,sum(seq_02.nextval) from t1 group by cube(c1+seq_02.nextval); |  
|
|  
|  
|select c1+seq_02.nextval,sum(seq_02.nextval) from t1 group by rollup(c1+seq_02.nextval); |  
|
|  
|  
|select c1+seq_02.nextval,sum(seq_02.nextval) from t1 group by grouping sets(c1+seq_02.nextval); |  
|
|  
|  
|cte|  
|
|connect_by_clause|SELECT id, father_id, LEVEL, CONNECT_BY_ROOT area_name AS name, SYS_CONNECT_BY_PATH(seq_01.nextval@mydblink, '/') path FROM area_info CONNECT BY id<>757 AND PRIOR id = father_id START WITH father_id = 0; |  
|  
|
|  
|SELECT seq_01.nextval@mydblink, father_id, LEVEL, CONNECT_BY_ROOT area_name AS name, SYS_CONNECT_BY_PATH(seq_01.nextval, '/') path FROM area_info CONNECT BY id<>757 AND PRIOR id = father_id START WITH father_id = 0; |  
|  
|
|  
|  
|SELECT seq_01.nextval, father_id, LEVEL, CONNECT_BY_ROOT area_name AS name, SYS_CONNECT_BY_PATH(seq_01.nextval, '/') path FROM area_info CONNECT BY id<>seq_01.nextval@mydnlink AND PRIOR id = father_id START WITH father_id = 0; |  
|
|  
|  
|  
|  
|
|四则运算+colunm|  
|  
|  
|
|四则运算+伪列|rownum、rowid、rowscn|  
|  
|
|user伪列|SELECT user||seq_01.nextval FROM t1;|  
|  
|
|作为函数入参（挑选函数大类测试几个），覆盖出现的位置|select中、update中、insert中|  
|  
|
|远端创建sequence的参数类型|increment by、maxvalue/nomaxvalue、cycle/nocycle、order/noorder、cache/nocache|  
|  
|
|表列缺省表达式| insert (seq.nextval (+-*/ n)|  
|  
|
|  
|create table t1 ( id int default seq.nextval (+-*/ n)， col1 number default seq.nextval (+-*/ n));、alter table add column col2 number default seq.nextval (+-*/ n));|  
|  
|
|PL/SQL对象中使用|存储过程、匿名块、udf、udp、udt、trigger|  
|  
|
|覆盖nextval、currval|  
|  
|  
|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


  


# 4. 测试用例

1.冒烟用例：

[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTc4OTcwYzJhZjRmNTIwZjA0IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.9J63OqagIPEB2Jtl1590_HgX2x0yrhHN70Dgy1fJ5Lk)

# 5. 测试框架设计

yasft框架

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：

计划测试完成时间：2024/1/8

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTc4OTcwYzJhZjRmNTIwZjA1IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.I2OA4tJQpUC-gma-ZikSsw7OnTsp5P88DWZ7jzxb_XI)

## Attachments:

[支持as别名为空.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTdhMWFkOWEzMzExZGM4ZDc1IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.T-zvm3YK3jgiFwldEm7FBNTOwzRb30hmlsN2AvZguMg)

 (application/x-xmind)    


[崖山支持8K的错误码信息长度返回.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTdhMWFkOWEzMzExZGM4ZDc2IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.bayiM_v6Sfz9MSji-WX0gndu1PHaD24K318jt4eVRpU)

 (application/x-xmind)    


[崖山支持设置错误码长度.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTc4OTcwYzJhZjRmNTIwZjA2IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.uHzgbkkyRK7DjibKkL8p-u-RAY2Kh2y_7t5MgrAiuNM)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTc4OTcwYzJhZjRmNTIwZjA3IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.Yy2F6FiDSc6yLNDMcAbK_chZVwG0wQtGunFcNPwbjz8)

 (application/x-xmind)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTdhMWFkOWEzMzExZGM4ZDc3IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.JoICXR6h7Y2SHV2S1K-PW8uM5oGUILZnWJ5G1Y_gfXc)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTc4OTcwYzJhZjRmNTIwZjA1IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.I2OA4tJQpUC-gma-ZikSsw7OnTsp5P88DWZ7jzxb_XI)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTg4OTcwYzJhZjRmNTIwZjA4IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.DSQ3ugxH7QrHwqc1V545huK8LrU0AesiZEIqSzV3ImU)

 (application/msword)    


[dblink支持seq.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTg4OTcwYzJhZjRmNTIwZjA5IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.mi-90ExK6xlQqMlLfzyXaQGt77SnsRedqO8eqn43l1M)

 (application/x-xmind)    


[dblink支持sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTdhMWFkOWEzMzExZGM4ZDczIiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.kxr_ZajYDPWE2p0jE2KqjRPYrZ5PoiVGebgu2_6WDvM)

 (application/x-xmind)    


[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTc4OTcwYzJhZjRmNTIwZjA0IiwicmVmX2lkIjoiNjczOTZjZTc3MjgyMDZlZmI5MmYxODQ5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NTU3LCJleHAiOjE3ODIzOTA5NTd9.9J63OqagIPEB2Jtl1590_HgX2x0yrhHN70Dgy1fJ5Lk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
