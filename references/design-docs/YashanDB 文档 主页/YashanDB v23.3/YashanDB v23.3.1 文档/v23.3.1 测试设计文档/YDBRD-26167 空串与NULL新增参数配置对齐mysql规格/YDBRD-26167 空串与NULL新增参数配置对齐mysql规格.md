Created by 李凯峰, last modified on 六月 17, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/6618e50ffd997db58ad82724](https://pingcode.yasdb.com/pjm/items/6618e50ffd997db58ad82724)    ?    
  #YDBRD-26167 支持插入空串

*开发设计文档：*    [空串与Null YDBRD-20608 - 邓秋怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150606177)  

*调研文档：*    [支持插入空串调研文档 - 邓秋怡 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153002925)  

# 2. 需求分析

## 2.1 功能点分析

- 空串等于字符串，不等于NULL；
- 建库级参数EMPTY_STRING_AS_NULL=true时规格对齐oracle，null=空串（默认为true）；
- 建库级参数EMPTY_STRING_AS_NULL=false时，规格对齐mysql，null != 空串


## 2.2 应用场景

- 作为数据插入的场景
- 四则运算的场景
- 运算符的场景
- null、空串可以出现的位置的语法场景、非法场景
- null、空串作为函数入参


## 2.3 规格约束

- EMPTY_STRING_AS_NULL=true时对齐oracle，null=空串
- EMPTY_STRING_AS_NULL=false时对齐mysql，空串是字符串，不等于NULL
- 作为函数入参不对齐mysql？
- mysql中空串返回值为0，四则运算等场景作为0来运算，我们保持差异？


# 3. 详细测试设计

## 3.1 测试设计方法

1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

[YDBRD-26167 新增参数对齐mysql空串与null规格.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzhjIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.8R8yl4E9GqeX10eRqRHvonA-nA6rvCQo7INCjLVQtXU)

1.数据类型、表类型覆盖

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|存储类型|HEAP、lsc、tac|  
|  
|
|数据类型|覆盖已支持的类型|  
|  
|
|表类型|分区表、非分区表、复制表、分布表|  
|交付范围是单机，是否支持分布式集群？|
|部署模式|单机，集群、分布式（是否支持）|  
|交付范围是单机，是否支持分布式集群？|


2.与其他特性交互测试，ddl中使用

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|create table as|create table t3 as select 1 from dual where '' is not null;|create table t2 as select 1 as '' from dual;|  
|
|alter table|  
|alter table t1 modify c1 default ' '|  
|
|create table|  
,  
|create table t1 (c1 int default ' ');|  
|
|create view|create view t4 as select 1 from dual where '' is not null;|  
|  
|
|create materialized view|create materialized view t4 as select 1 from dual where '' is not null;|  
|  
|
|create outline|CREATE OUTLINE ol_a FOR CATEGORY ctgy_ab ON select 1 from dual where ' ' is not null;|  
|  
|
|create sqlmap|CREATE SQLMAP map_branch (sales,'select 1 from dual where '' is not null;','select 1 from dual where ' ' is not null;');|  
|  
|


*3.与其他特性交互测试，dml中使用*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|delete|DELETE FROM t1 WHERE c1='';|  
|  
|
|update|UPDATE t1 SET c1='' WHERE c1='';|  
|  
|
|update set的值符合约束与违反约束|check、union、primary key、not null、foreign key|check、union、primary key、not null、foreign key|  
|
|insert |insert into t1 values('')|  
|  
|
|  
|insert into t1 select 1 from dual where '' is not null;|  
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
|fetch '' rows only|  
|  
|
|group by|select '',sum(1) from dual group by '';|  
|  
|
|  
|having|  
|  
|
|rollup/cube/grouping sets|select '',sum(seq_02.nextval) from t1 group by cube('');|  
|  
|
|  
|select '',sum(seq_02.nextval) from t1 group by rollup('');|  
|  
|
|  
|select '',sum(seq_02.nextval) from t1 group by grouping sets('');|  
|  
|
|cte|  
|  
|  
|
|connect_by_clause|SELECT id, father_id, LEVEL, CONNECT_BY_ROOT area_name AS name, SYS_CONNECT_BY_PATH(’‘, '/') path FROM area_info CONNECT BY id<>’‘ AND PRIOR id = father_id START WITH father_id = ’‘; |  
|  
|
|四则运算|详见XMIND|  
|  
|
|四则运算+伪列|rownum、rowid、rowscn|  
|  
|
|user伪列|  
|  
|  
|
|作为函数入参,覆盖已支持的函数|select中、update中、insert中|  
|  
|
|PL/SQL对象中使用|存储过程、匿名块、udf、udp、udt、trigger|  
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

[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzhhMWFkOWEzMzExZGM5NjAwIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.SiTgrcRgI1o4mt_lbqhJphgXgjPZ6iLPx3OhL5d5k7Q)

# 5. 测试框架设计

yasft框架

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：

计划测试完成时间：2024.6.29

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzhkIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.-Dx5INM2sIxxJF0G3jC8GB3ymaLAtHcylpkXa4_ktNk)

## Attachments:

[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzhhMWFkOWEzMzExZGM5NjAwIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.SiTgrcRgI1o4mt_lbqhJphgXgjPZ6iLPx3OhL5d5k7Q)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[dblink支持sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzhhMWFkOWEzMzExZGM5NjAxIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.xtNLjZq-4ZSP0CcASTeTIo8UMZJ-Zq_OYh6fEJbNZdc)

 (application/x-xmind)    


[dblink支持seq.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzhlIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.nyr_ByhHA2YKW7SqD1yRwVy23wpdb_FN-KYGc68wRFk)

 (application/x-xmind)    


[支持as别名为空.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzhmIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.lrHZkQ_W8skXZ6cLQquhOI1DxOWqfMkVmTJZlj0wZXg)

 (application/x-xmind)    


[崖山支持8K的错误码信息长度返回.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzhhMWFkOWEzMzExZGM5NjAzIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.H2PxnDstao0aRjdtuYntZiATWmHVSa2eBEOqiM45v9U)

 (application/x-xmind)    


[崖山支持设置错误码长度.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzkxIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.GSD0a2Y8EqT_6GY6ckigrloIecLKVUzvU_rNnJBsR5s)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzkyIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.ndQrqdt7EXRlltjNsvktbZYjrNe0mzdgw5It_OFDdUY)

 (application/x-xmind)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzhhMWFkOWEzMzExZGM5NjA0IiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.rsbdW13heuFsW1J4j5VbAeO_HCGFRiYG9KyonsVSfmo)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzhkIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.-Dx5INM2sIxxJF0G3jC8GB3ymaLAtHcylpkXa4_ktNk)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzk4OTcwYzJhZjRmNTIxNzkzIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.xpv7gzwK_Qovr9fo4kgyU6sNurkLRGgM8fqAMNYz2Bo)

 (application/msword)    


[YDBRD-26167 新增参数对齐mysql空串与null规格.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzg4OTcwYzJhZjRmNTIxNzhjIiwicmVmX2lkIjoiNjczOTZlMzg3MjgyMDZlZmI5MmYyNmZmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTYyLCJleHAiOjE3ODI0NTc1NjJ9.8R8yl4E9GqeX10eRqRHvonA-nA6rvCQo7INCjLVQtXU)

 (application/x-xmind)    
