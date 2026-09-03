Created by 胡晓畔, last modified on 五月 13, 2024

  


# 1. 概述

本需求支持通过DBLINK连接到远端Oracle数据库，查询Oracle的LOB数据，包括 blob,clob ,nclob ，  查看也包括直接查询LOB列和含LOB的表达式  。

# 2. 需求分析

## 2.1 功能点分析

查询远端LOB语法：

select  远端LOB列/含LOB列的表达式  from 远端表@dblink名称;

## 2.2 应用场景

客户应用场景：

查询远端大小超过100MB的LOB数据

关联场景：

含LOB列表的同义词对象 --依赖同义词实现

远端LOB数据insert在本地表后相关视图查询

## 2.3 规格约束

- 当前需求只支持读远端LOB，不支持 insert 远端表 远端LOB，update远端表远端LOB
- ~~返回结果为LOB类型的函数表达式，不支持~~
- 跨LINK查询远端LOB，不支持
- 受限崖山本身的DBLINK能力


  


# 3. 详细测试设计

## 3.1 测试设计方法

从特性功能，LOB类型应用出发，结合等价类，边界值，场景法 ，错误猜测法等，输出测试点

## 3.2 详细测试设计

  


|测试场景|测试点|  
|预期|备注|
|---|---|---|---|---|
|远端 LOB类型|blob,clob,nclob ,  
|三种类型均需要覆盖所有测试点 |  
|Oracle的LOB分为basicfiles LOB和   Securefiles LOB ，对于崖山拿到的是否没有区别 --没有区别,--简单覆盖|
|LOB长度|2000,16000,32000,150M |客户场景为100M以上使用|  
|  
|
|LOB  查询|单列查询|  
|  
|  
|
|  
|多列查询|  
|  
|  
|
|  
||||  
|崖山支持|  
|
|  
|表达式|结果为非LOB的：,LISTAGG   TRANSLATE   RPAD LPAD,TO_CHAR  TO_DATE  ,HEXTORAW,LENGTH     LENGTHB OCTET_LENGTH  ......|  
|LISTAGG: expr不能是NCLOB，separator不可以是LOB,RIGHT  LEFT  INITCAP :    
  当expr为NCLOB 时，返回值为NVARCHAR类型,  
,--入参支持LOB类型的函数较多，是否需要全量覆盖？--覆盖对齐的Oracle的常用函数|
|  
|  
|结果为LOB的：,WM_CONCAT   STRING_AGG   GROUP_CONCAT,TRIM  RTRIM   LTRIM      REPLACE,EMPTY_CLOB   EMPTY_BLOB,......|崖山支持|入参不可以是  NCLOB  ，返回类型CLOB：,WM_CONCAT       STRING_AGG    GROUP_CONCAT  ,expr为CLOB类型时，返回值为CLOB类型：,TRIM，RTRIM  ， LTRIM    ,SUBSTRING，SUBSTR,  
,-- 返回结果为LOB类型的函数较多，  是否需要全量覆盖？--覆盖对齐的Oracle的常用函数|
|  
|  
|高级包：,dbms_lob.getlength,DBMS_LOB.SUBSTR|崖山支持|  
|
|  
|  
|组合场景：,实际返回类型不为LOB ，但包含dbms_lob,  
|崖山支持|确认一下本地表现|
|  
|  
|下推函数列表中支持LOB类型的|  
|  
|
|LOB列位置|LOB列应用位置|order by,limit ,offset ,group by ...|不支持|  
|
|  
|  
|绑定参数|支持|  
|
|  
|  
|filter,rlike  like  is null  --支持？|支持|  
|
|  
|  
|投影列|支持|  
|
|  
|  
|lob在pl/sql中应用：传参，赋值，输出|支持|  
|
|  
|DML|远端LOB列 insert 远端表,远端LOB update 远端表,远端LOB delete 远端表|预期正常拦截，提示信息易懂或保持一致|验证一下表现insert,update：where后带update 的表现？,  
|
|  
|  
|远端LOB 查询后insert 到本地表|支持|  
|
|  
|  
|update本地表 set 后带远端LOB|支持|简单覆盖|
|  
|  
|update本地表 where条件带远端LOB|支持|简单覆盖|
|  
|  
|delete本地表 where条件带远端LOB|支持|简单覆盖|
|  
|DDL|create view as select 远端LOB,create table as select 远端LOB|支持？|  
|
|  
|  
|alter 远端 LOB列|不支持？|  
|
|  
|跨LINK|跨LINK查询,join ，集合|支持？,  
|验证一下,**与本地lob规则一致**|
|  
|  
|schema.link2的LOB@link1 的场景|支持|  
|
|字符集|设置不同字符集|Oracle gbk, yashan  utf8;,oracle  utf8, yashan   gb18030;|  
|  
|
|yashan-yashan|不支持，当前拦截|  
|  
|  
|


  


  


|系统级DFX分类|是否涉及|
|---|---|
|CT|√|
|KT|√|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件     [测试文本用例 - 胡晓畔 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150632523)  

# 5. 测试框架设计

Guider + yasft 

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

  


## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZmZhMWFkOWEzMzExZGM4ZTI2IiwicmVmX2lkIjoiNjczOTZjZmY1OTNmOTljOWZmMjM3NjNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTgyLCJleHAiOjE3ODIzOTE1ODJ9.sY3m-HzjNfUGik4R2AteN5YJszrm7i5rvQF0jOJZYpI)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZmZhMWFkOWEzMzExZGM4ZTI3IiwicmVmX2lkIjoiNjczOTZjZmY1OTNmOTljOWZmMjM3NjNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MTgyLCJleHAiOjE3ODIzOTE1ODJ9.sNfyd3o0rGBUyjjvTSyo8tMgmJuSUyk95PO-yCS2jZc)

 (application/msword)    
