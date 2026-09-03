Created by 易文亮, last modified on 二月 20, 2024

# **1. 概述**

本文描述LSC表热数据支持OrderKey的测试设计

# **2. 需求分析**

SR：        [YDBRD-13038](https://jira.yasdb.com/browse/YDBRD-13038?src=confmacro)    -  LSC热数据支持OrderKey  完成

开发设计：    [【Spearfish】 LSC表热数据支持OrderKey - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=100088862)  

语法验证： order key的约束跟btree索引保持一致，包括长度、数据类型

ORDER BY "("column_name{"," column_name}")" [NULLS (FIRST|LAST)] [ASC|DESC] [SCOL]，默认对MCOL/SCOL都排序，旧的逻辑等同SCOL

1，创建时可指定仅针对SCOL或全部使用order key, 建表时指定，不可修改

2，支持动态启用/关闭 mcol order key。  enable时创建segment，disable删除。

alter table xx enable/disable mcol order by ;

3，支持通过v$sysstat以及autotrace等方式观察MCOL执行方式。

新增系统表   TABSORT$，sortmcol为null/false，mcol不排序

orderkey加速index scan验证，仅支持等值：

（1）set autotrace on;  alter session set statistics_level = all;   会显示  order key scan

（2）统计视图确认：select * from v$sysstat where name like ‘%MCOL%’; 增加了MCOL SCAN和MCOL ORDER KEY SCAN

# **3. 测试**  **设计方法**   

测试设计主要采用等价类结合边界值和场景测试法进行设计

# 4.   **详细测试设计**

4.1 语法覆盖

|输入条件  1|输入条件2|有效等价类|编号|无效等价类|编号|备注|
|---|---|---|---|---|---|---|
|表类型|  
|lsc普通表(覆盖ttl)/range/list/hash/interval|1,2,3,4,5,6|tac/heap|7,8|  
|
|orderkey列|是否缺省|缺省/不缺省    
|9,10|1、使用表中不存在的列,2、使用重复的列|  
|  
|
||列数|1列/多列|11,12|  
|  
|  
|
||数据类型|同index的限制，  tinyint/smallint/integer/bigint/float/double/date/timestamp/time/interval year to month/interval day to second/boolean/char/varchar  等|  
|raw/clob/blob/json  等不支持的数据类型|  
|  
|
||key总长度|同index限制，6000以内|  
|6000以上|  
|  
|
||顺序|ASC(缺省)/DESC|  
|  
|  
|  
|
||nulls条件|NULLS FIRST(缺省)/NULLS LAST|  
|  
|  
|  
|
|scol|  
|默认(scol+mcol)/scol|  
|mcol|  
|  
|


4.2 逻辑验证

|编号|内容|备注|
|---|---|---|
|1|验证  ORDER BY (column_name) [NULLS (FIRST|LAST)] [ASC|DESC] [SCOL]的逻辑正确性|  
|
|2|构造1个slice，构造多个slice下order key逻辑正确|  
|
|3|结合alter table enable/disable验证|  
|
|4|兼容性：升级验证|  
|
|5|新增视图TABSORT$、SORTCOL$验证,属性正确|  
|


4.3 场景测试结合scanfilter

a.满足条件下推(=,=>,<=,>,<,in;相同列使用or连接,不同列使用and连接)

b.key列做点查

建表带order key,构造1个slice数据/构造多个slice数据, 确认走scanfilter，diable关闭后，确认不走scanfilter

set autotrace on;

alter session set statistics_level = all;

确认统计信息

select * from v$sysstat where name like ‘%MCOL%’  ;  

  


# 5.   **测试用例**

[LSC表orderkey测试设计(ydbrd13038).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTc4OTcwYzJhZjRmNTFmYjIwIiwicmVmX2lkIjoiNjczOTY5ZTY3MjgyMDZlZmI5MmVmOGMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTEwLCJleHAiOjE3ODIyOTYzMTB9.NEjjljIMHdCRGHWsaxfDfCpgUz_FtRO5RuFZzJSnFZY)

[YDBRD13038 lsc表热数据支持orderkey测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTdhMWFkOWEzMzExZGM3OTk2IiwicmVmX2lkIjoiNjczOTY5ZTY3MjgyMDZlZmI5MmVmOGMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTEwLCJleHAiOjE3ODIyOTYzMTB9.dXzI6WrzLv2Qg5ejZkD4tZbIvxpTJ1svVlOtwyW0V-M)

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[LSC表orderkey测试设计(ydbrd13038).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTc4OTcwYzJhZjRmNTFmYjIwIiwicmVmX2lkIjoiNjczOTY5ZTY3MjgyMDZlZmI5MmVmOGMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTEwLCJleHAiOjE3ODIyOTYzMTB9.NEjjljIMHdCRGHWsaxfDfCpgUz_FtRO5RuFZzJSnFZY)

 (application/x-xmind)    


[YDBRD13038 lsc表热数据支持orderkey测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTdhMWFkOWEzMzExZGM3OTk2IiwicmVmX2lkIjoiNjczOTY5ZTY3MjgyMDZlZmI5MmVmOGMwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTEwLCJleHAiOjE3ODIyOTYzMTB9.dXzI6WrzLv2Qg5ejZkD4tZbIvxpTJ1svVlOtwyW0V-M)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
