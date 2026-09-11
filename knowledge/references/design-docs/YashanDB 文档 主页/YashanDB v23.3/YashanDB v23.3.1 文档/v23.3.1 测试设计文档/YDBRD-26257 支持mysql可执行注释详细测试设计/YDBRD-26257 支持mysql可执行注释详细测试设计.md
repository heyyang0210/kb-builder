Created by 李凯峰, last modified on 八月 15, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/66190c75fd997db58ad88713](https://pingcode.yasdb.com/pjm/items/66190c75fd997db58ad88713)    ?    
  #YDBRD-26257 支持MySQL可执行注释

*开发设计文档：*    [详细设计-【Mysql兼容】支持MySQL可执行注释 - 赵忠源 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159448896)  

# 2. 需求分析

## 2.1 功能点分析

- 兼容mysql可执行注释/*!  +1*/的语法
- 不执行注释中的内容，仅语法兼容，返回成功
- 不关注/*！ */中的内容
- 仅需要在能出现  /*！ */的语法中测试
- 需要用mysql 的客户端链接yasdb测试，分别测试-C 和不带-C的连接方式
- 不用mysql的客户端连接yasdb的时候，即yasql客户端连yasdb时，当compat_vector=mysql时


## 2.2 应用场景

- 任何可以出现块注释的语法中


## 2.3 规格约束

- 仅作为块注释，不执行注释中的语句


# 3. 详细测试设计

## 3.1 测试设计方法

  


1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

1.数据类型、表类型覆盖

|测试对象|测试点|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|  
|部署模式|单机|  
|集群、分布式|  
|
|  
|表类型|heap|  
|  
|  
|
|mysql可执行注释    
  /*! */|表达式中运用|+、-、*、/  |仅作为语法兼容|  
|  
|
|  
|比较运算符|[NOT] IN、[NOT] LIKE、[NOT] BETWEEN AND、IS [NOT] NULL 、=、!= 或 <>、>、>=等|同上|  
|  
|
|  
|单行注释|  
|  
|  
|  
|
|  
|同一行只有注释|  
|  
|  
|  
|
|  
|整条sql都在注释中|  
|  
|  
|  
|
|  
|注释的结束符在下一行，多行注释|  
|  
|  
|  
|
|  
|同一行有多个块注释|/*! *  **/ /**   *! */|  
|  
|  
|
|  
|注释出现的位置|行头|  
|  
|  
|
|  
|  
|行尾|  
|  
|  
|
|  
|  
|行中间|  
|  
|  
|
|  
|多列注释|/*! */ ,/*! */ ,/*! */ |  
|  
|  
|
|  
|注释内内容的边界值|mysql客户端：无限制,yasql：32K |  
|  
|  
|
|  
|注释中嵌套注释|  
|  
|  
|  
|
|  
|注释匹配规则|/*! */  */|  
|  
|  
|
|  
|注释出现在关键字中间|  
|  
|crea/*! */te table c1(id int);|报错|
|  
|注释作为对象名|create table  t1/*! */(c1 int);|  
|create table /*! */(c1 int);|报错|
|  
|  
|  
|  
|create table c/*! */c1(c1 int);|报错|
|  
|  
|  
|  
|create table c1(/*!aa*/ int);|报错|
|  
|  
|  
|  
|create table t1(c/*!*/1 int);|报错|
|  
|注释内有特殊符号|@#$%^&* ,'' "" () +-;~`/\、|{}【】[]|  
|  
|  
|
|  
|  
|多个！！！|  
|  
|  
|
|  
|  
|多个***|  
|  
|  
|
|  
|  
|中文等其他国家的语言|  
|  
|  
|
|  
|注释内是不同的字符集入参|GBK/UTF8/  ASCII/ISO-8859-1/GB18030|  
|  
|  
|
|  
|ddl中运用|create table|  
|  
|  
|
|  
|  
|create table as|  
|  
|  
|
|  
|  
|alter table |  
|  
|  
|
|  
|  
|create view|  
|  
|  
|
|  
|dml中运用|delete|  
|  
|  
|
|  
|  
|update|  
|  
|  
|
|  
|  
|update多字段|  
|  
|  
|
|  
|  
|insert |  
|  
|  
|
|  
|  
|insert into select|  
|  
|  
|
|  
|  
|merge|  
|  
|  
|
|  
|dql(select)|投影列|  
|  
|  
|
|  
|  
|子查询中|  
|  
|  
|
|  
|  
|order by中|  
|  
|  
|
|  
|  
|limit中|  
|  
|  
|
|  
|  
|cby中|  
|  
|  
|
|  
|  
|fetch N rows only|  
|  
|  
|
|  
|  
|group by|  
|  
|  
|
|  
|  
|having|  
|  
|  
|
|  
|  
|cte|  
|  
|  
|
|  
|可执行注释中配置参数|例：/*!40103 SET timing on */|仅作为注释，无实际意义|  
|  
|
|  
|作为函数入参|函数内入参只有注释|  
|  
|  
|
|  
|  
|函数内入参部分参数是注释|  
|  
|  
|
|  
|约束中使用|check 、union、primary key、not null、foreign key|  
|  
|  
|
|  
|连接yashandb的客户端方式|yasql|compat_vector=mysql时可执行注释是否和mysql模式连接表现一致？,当前在该模式下：,select 1/*! +1*/ from dual;会core,执行逻辑：不保留注释，去掉注释传到服务端|  
|  
|
|  
|  
|mysql|执行逻辑：不保留注释，去掉注释传到服务端|  
|  
|
|  
|  
|mysql -c|执行逻辑：保留注释传到服务端|  
|  
|


|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
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

[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWQ4OTcwYzJhZjRmNTIxODcxIiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.Bc3JE1QuPtmD0i5Jo4y7lkpcjk5XWK5b2n_3MoSQqfE)

# 5. 测试框架设计

yasft框架

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：

计划测试完成时间：2024/1/8

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWVhMWFkOWEzMzExZGM5NmU0IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.pXAVWkeIm3nZ9WVMRkoOWU6qMrTc_B5gclaTLp8JhwY)

## Attachments:

[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWQ4OTcwYzJhZjRmNTIxODcxIiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.Bc3JE1QuPtmD0i5Jo4y7lkpcjk5XWK5b2n_3MoSQqfE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[dblink支持sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWU4OTcwYzJhZjRmNTIxODcyIiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.iFQzfH5o9j8JthNwDQO_ILb6ljqrjB4N9JALED_Wrt4)

 (application/x-xmind)    


[dblink支持seq.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWVhMWFkOWEzMzExZGM5NmU1IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.o0fSnyF3nzwMndqG6AFH3pnyFXiZc6zdohYVHxnLuQ4)

 (application/x-xmind)    


[支持as别名为空.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWVhMWFkOWEzMzExZGM5NmU2IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.dFi4FSEDJc1jPamKs49VxgmnviS53xqpARDQWf84qOc)

 (application/x-xmind)    


[崖山支持8K的错误码信息长度返回.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWVhMWFkOWEzMzExZGM5NmU3IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.jXyPVp66iWIzH33jx06cOeTE1Z2_Cwvj2dw-SBl1PEY)

 (application/x-xmind)    


[崖山支持设置错误码长度.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWU4OTcwYzJhZjRmNTIxODczIiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.ccxQ0EonluR4YIrKN-3_nTeA_UGu3Abzafrzs6Ko0Z4)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWU4OTcwYzJhZjRmNTIxODc0IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.bmOLdgqijmKO-sNtlI6Kv_rtNRRjve1-OIkx6xWr5PA)

 (application/x-xmind)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWU4OTcwYzJhZjRmNTIxODc1IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.Gek_z5HLQQghwaautWRITH1rH5Czcae08ojVBU-_Yew)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWVhMWFkOWEzMzExZGM5NmU0IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.pXAVWkeIm3nZ9WVMRkoOWU6qMrTc_B5gclaTLp8JhwY)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNWVhMWFkOWEzMzExZGM5NmU4IiwicmVmX2lkIjoiNjczOTZlNWM3MjgyMDZlZmI5MmYyNzg2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTk5LCJleHAiOjE3ODI0NTc5OTl9.ZHUDRUvFyY0w9gWub7h4vu9usSKsjkeYKZ7WmW6Qops)

 (application/msword)    
