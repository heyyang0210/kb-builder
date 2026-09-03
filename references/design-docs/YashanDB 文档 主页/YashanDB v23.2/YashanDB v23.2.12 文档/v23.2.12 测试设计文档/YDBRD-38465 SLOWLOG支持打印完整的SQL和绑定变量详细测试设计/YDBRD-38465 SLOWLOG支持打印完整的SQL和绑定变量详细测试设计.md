Created by 李凯峰, last modified on 十二月 19, 2023

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR:  [https://pingcode.yasdb.com/pjm/items/67beb8307ce85d5a0755512a?](https://pingcode.yasdb.com/pjm/items/67beb8307ce85d5a0755512a?)  

#YDBRD-38465 SLOWLOG支持打印完整的SQL和绑定变量

设计文档:  [https://pingcode.yasdb.com/wiki/spaces/GONGWEN/pages/67c56000529b5c0231cc17c9](https://pingcode.yasdb.com/wiki/spaces/GONGWEN/pages/67c56000529b5c0231cc17c9)  

需求来源：博时基金有部分慢sql，语句复杂并且有绑定参数，当前sql长度上限2000无法完整打印，导致无法分析慢sql。

# 2. 需求分析

## 2.1 功能点分析

- SLOWLOG日志记录上限增大，最长可记录2M长度的sql
- SLOWLOG日志记录绑定参数的具体值，最大能记录长度为64K的绑定参数
- SLOW_LOG_SQL_MAX_LEN新增参数0，表示启用当前需求的功能，记录长sql


## 2.2 应用场景

- 分析慢sql场景，且sql复杂sql长度很长的场景
- sql中存在绑定参数的场景


## 2.3 规格约束

- 


# 3. 详细测试设计

## 3.1 测试设计方法

根据需求主要采用：

等价类、边界值、场景法、错误推测法编写测试设计

## 3.2 详细测试设计

功能

|测试项|测试点|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|部署模式|单机、集群||分布式不支持慢日志|||
|客户端|yasql、jdbc驱动|||||
|入参测试|SLOW_LOG_SQL_MAX_LEN入参|0,等号两边有空格,等号两边无空格,入参多个0,入参结果为0的表达式,入参1个参数,||负数,1-19的数,2001,字符串,NULL,科学计数法,特殊符号,中文,空串,无入参,入参2个参数,入参其他表达式||
||新增参数SLOW_LOG_PARAM_MAX_LEN：控制绑定参数的入参测试|入参20B,入参64K,入参24K,||入参19B,入参65536B,入参65537B,入参0,入参负数,入参字符串,入参NULL,入参科学计数法,入参特殊符号,入参中文,参数=边有空格,参数=边无空格,入参表达式,无入参,入参多个参数||
||SLOW_LOG_PARAM_MAX_LEN|alter system：scope=SPFILE|MEMORY|BOTH||alter session||
||绑定参数的长度：,params参数的长度：[20,64K]，受参数SLOW_LOG_PARAM_MAX_LEN影响，默认值2000|1.设置SLOW_LOG_PARAM_MAX_LEN=24K，入参长度24K+1；,2.设置SLOW_LOG_PARAM_MAX_LEN=64K，入参长度64K+1；,3.设置SLOW_LOG_PARAM_MAX_LEN=64K，入参长度1B；,4.长度8K,5.长度16K,6.长度32K|我们规格是每记录2000字节会换行，因此要关注下换行符，如在第2000、2001处是一个换行符|||
||sql记录的最大长度:2M|长度2M+1B : 2097153B,长度8K,长度16K,长度32K|我们规格是每记录2000字节会换行，因此要关注下换行符，如在第2000、2001处是一个换行符|||
||绑定参数的类型|NULL,空串,数值,LOB,字符串,布尔值,日期型,二进制,json,特殊符号,科学计数法,中文,覆盖当前支持的数据类型||||
||绑定参数的长度|单个绑定参数长度2000B,单个绑定参数长度63K,单个绑定参数长度64K||||
||绑定参数的个数|0个,1个,32000个||32001个||
|长sql：,1.绑定参数,2.非绑定参数,|DDL|create table ,create table as  select,create view,create materialized view,alter table,drop table||||
||DML|insert,insert into select,delete,update,select,CTE|1.insert 绑定多行参数时，只打印最后一行慢sql以及绑定参数的值,2.insert 覆盖单行绑定、多行绑定两种场景|||
|PL/SQL,1.绑定参数,2.非绑定参数|存储过程|覆盖超长的存储过程，绑定参数||||
||匿名块|覆盖超长的匿名块，绑定参数||||
||UDP|覆盖超长的UDP，绑定参数||||
||UDF|覆盖超长的UDF，绑定参数||||
||UDT ?|覆盖超长的UDT，绑定参数||||
||定时任务 如统计信息时间长的场景|覆盖超长的定时任务，绑定参数||||
||触发器 ?|覆盖超长的触发器，绑定参数||||
||create library?|覆盖超长的自定义库，绑定参数||||
|SLOW_LOG_OUTPUT=TABLE，查看系统视图SLOW_LOG$|SLOW_LOG$新增SQL_FULLTEXT和SQL_PARAMS字段，类型为CLOB，可为空|1.SLOW_LOG_SQL_MAX_LEN=0，SQL_TEXT字段以2000为上限截断，SQL_FULLTEXT打印完整SQL,2.当SLOW_LOG_SQL_MAX_LEN!=0，SQL_TEXT字段以SLOW_LOG_SQL_MAX_LEN为上限截断，SQL_FULLTEXT为空,3.有绑定参数，若绑定参数总长度超过64K，以参数顺序依次转为text，超过的部分丢弃,4.无绑定参数，SQL_PARAMS字段记录为空||||
|SLOW_LOG_OUTPUT=FILE，日志记录在slow.log文件中|覆盖以上长sql|1.SLOW_LOG_SQL_MAX_LEN=0，慢日志中显示长度最大2M,2.SLOW_LOG_SQL_MAX_LEN!=0，慢日志超过长度部分截断,3.绑定参数，若绑定参数总长度超过64K，以参数顺序依次转为text，超过的部分丢弃,4.无绑定参数，不打印||||
|超长varchar测试|构造单个包大小是128K，或者超过128K的场景||构造超长的sql 和超长的绑定参数|||
|主备测试|在慢日志写盘的时候，执行主备切换操作，会不会阻塞主备切换的任务,写盘时,KILL节点，再拉起|||||
|并发/KILL数据库节点|多个超长sql并发执行、超长绑定参数,覆盖SLOW_LOG_OUTPUT=TABLE/FILE的场景|测试写盘这个队列被打满的场景,或者可以修改隐藏参数：,_SLOW_LOG_QUEUE_SIZE改小，更方便测试队列被打满的场景|多个绑定参数是以逗号隔开，可以测一下绑定参数中有,的场景(绑定参数中的逗号会以""包围)|||
|特殊字符截断场景|如中文、表情截断的场景，能截断，不能报错，正常的值要能正常打印|||||
|绑定参数|绑定udt 、mysql的数据类型、游标||游标：NULL,UDT:   NULL,mysql的数据类型：待确认|||
|mysql数据类型|数据类型隐式转换|||||
||ROWS_SENT insert into select结果不准确|||||
|繁忙大量业务场景的情况下，写日志会不会有core、队列打爆（检查run.log）等情况||||||
|大量长sql，需要不同的sql，不要有sql复用情况||||||
|备机读|||会写慢日志|||
|回顾下之前slow log的测试用例||||||






1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- ytp+Guider


# 6. 测试环境说明

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


# 7. 工作量评估



[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdlMjdiMjYyZDJlZmZlOGZiMjQ1ZmJkIiwicmVmX2lkIjoiNjdlMjdiMjYyZDJlZmZlOGZiMjQ1ZmM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzYzMzg4LCJleHAiOjE3ODI0NDk3ODh9.xMferJWudJCBLF9pUhA0oEKkVyYcmTHL-vomXOZxy3k)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdlMjdiMjYyZDJlZmZlOGZiMjQ1ZmJkIiwicmVmX2lkIjoiNjdlMjdiMjYyZDJlZmZlOGZiMjQ1ZmM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzYzMzg4LCJleHAiOjE3ODI0NDk3ODh9.xMferJWudJCBLF9pUhA0oEKkVyYcmTHL-vomXOZxy3k)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjdlMjdiMjYyZDJlZmZlOGZiMjQ1ZmJiIiwicmVmX2lkIjoiNjdlMjdiMjYyZDJlZmZlOGZiMjQ1ZmM4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzYzMzg4LCJleHAiOjE3ODI0NDk3ODh9.gdqQGxuU_UhDZW50Tt6tz5niOH2Z6sFQE_I9HLTMgf8)

 (application/msword)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    




 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
