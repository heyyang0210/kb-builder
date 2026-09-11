Created by 刘美秀, last modified on 八月 21, 2024

# 1. 概述

分布式下分布键可以支持多列

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/6618e085fd997db58ad81eb3](https://pingcode.yasdb.com/pjm/items/6618e085fd997db58ad81eb3)    ?    
  #YDBRD-26159 分布式支持insert into select from外部表

  


开发设计：    [YDBRD-26159 分布式支持insert into select from外部表设计方案](https://conf.yasdb.com/pages/viewpage.action?pageId=159437815)  

## 2.1 功能点分析

- insert   本地表  select   外部表
- 外部表select查询只在CN节点执行，读取外部文件扫描数据，不去DN节点执行


## 2.2 应用场景

使用外部表（External Table）结合 `INSERT INTO ... SELECT * FROM ...` 语句可以高效地实现数据迁移和批量加载操作，并行处理能力来加速数据加载过程

1. 数据迁移：将数据从一个yashan数据库迁移到另一个yashan数据库或不同的数据库平台，特别是当数据量很大时

2. 跨平台数据同步：在不同的操作系统或数据库平台之间同步数据时，使用外部表可以避免数据格式和编码问题。

3. 数据归档：将历史数据导出到文件中进行归档存储，以减少数据库中的数据量，提高查询性能。

## 2.3 规格约束

|约束|
|:---|
|外部表只支持读取外部文件数据，分布式insert into select只支持select外部表，不支持insert 外部表|
|insert into select from 外部表只支持行执行，不执行列执行|
|分布式insert into select from 外部表支持select ，insert并行----待定|


## 3. 详细测试设计

## 3.1 测试设计方法

|验证项|设计方法|  
|
|---|---|---|
|表类型覆盖|等价类划分|  
|
|数据类型覆盖|等价类划分|  
|
|数据类型转换|  
|  
|
|值类型覆盖|等价类划分|  
|
|select 列|  
|  
|
|~~select fileter 覆盖~~|~~等价类划分~~|  
|


  


## 3.2 详细测试设计

|验证项|测试点|备注|
|---|---|---|
|内部表类型覆盖|复制表|  
|
|  
|一级分区表|  
|
|  
|二级分区表|  
|
|  
|列表|拦截|
|内部+外部表数据类型覆盖|数值类型    
  tinyint、smallint、int、bigint、float、double、number、布尔,时间类型    
  date、time、timestamp、interval,字符类型    
  char、varchar、nchar、nvarchar|  
|
|内部表数据类型覆盖|大对象类型,clob、blob、nlob |外部表是字符型,clob--可以、blob-报错，|
|数据类型转换|内部表为varchar，外部表为tinyint、smallint、int、bigint、float、double、number，date、time、timestamp、interval、char、varchar、|  
|
|  
|内部表为int，外部表为varchar|  
|
|值类型覆盖|字符覆盖：中、英、数字、特殊字符，单引号|  
|
|  
|边界值|  
|
|  
|null|  
|
|  
|覆盖utf8的特殊字符，包括表情符等、另外包括公式符号|导出内部表的数据，对比内部表和外部表的csv|
|select 列|部分|  
|
|  
|*|  
|
|~~select fileter 覆盖~~|~~where~~,- ~~比较符号（=, >, >=, <, <=, <>）~~
- ~~between and , in , exists, any, all, NULL判断， ~~
- ~~and, or~~
- ~~常量，列，表达式，函数，子查询~~
|  [SQL功能测试checklist](https://conf.yasdb.com/pages/viewpage.action?pageId=117080628)  ,  
,select fileter 覆盖---流程无变动，不需要在此SR覆盖|
|  
|~~join~~,~~外部表join 外部表~~,~~外部表join 内部表~~,~~外部表join 系统视图~~|  
|
|  
|~~from 子查询~~,~~关联子查询，非关联子查询， 子查询嵌套~~|  
|
|  
|~~集合运算~~,- ~~union/union all~~
- ~~intersect/intersect all~~
- ~~minus/minus all~~
|  
|
|  
|~~GROUP BY~~|  
|
|  
|~~ORDER BY~~|  
|
|外部表|REJECT LIMIT--  可容忍的最多错误数据行数,REJECT LIMIT为0，存在1行，首行数据错误，插入0行---查询报错,REJECT LIMIT为10，忽略错误行，其他行插入成功|  
|
|  
|DEFAULT DIRECTORY directory 目录不存在，报错|  
|
|  
|records delimited by newline--行分隔,fields terminated by ','   --字段分隔,terminated by 制表符|  
|
|  
|指定ACCESS PARAMETERS ,ACCESS PARAMETERS( records    
  logfile  directory_ydbrd_21783_directory_026:'logfile_026.log'    
  badfile  directory_ydbrd_21783_directory_026:'badfile_026.bad'|logfile_026 记录内容？,---log，访问|
|  
|directory+location_specifier,~~相对~~  、绝对路径|  
|
|  
|csv文件内容为空|  
|
|  
|~~csv存在标题行~~|~~外部表无标题行概念~~|
|  
|文件超大--性能摸底验证|  
|
|4096列|  
|  
|
|值长度超范围|内部表varchar20，外部表值长度30|内部表报错,YAS-04008 C1 size exceeding limit 2|
|最大行长度|63K|  
|
|并行|alter session set   degree_of_parallel=  4  ;|  
|
|  
|insert hint|是否支持待定|


  


**专项验证**

|测试项|描述|备注|
|---|---|---|
|并发|DDL/DML时查询|CT/KT框架暂不支持|
|性能|tpch100  lineitem.csv 性能摸底，insert 时间|csv文件大小=74G,行数=600037902,行长度=131|
|扩缩容,  
|DML/DQL 作为扩缩容背景业务|  
|
|DFR|DML/DQL 作为可靠性工程的背景业务|  
|


  


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

冒烟：

L0

开发验证：L0/L2

文本：

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *5人天*

计划测试执行时间：

## Attachments:

[分布式下分布键可以支持多列文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzY4OTcwYzJhZjRmNTIxNzdmIiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.liRFiIyHwcPxnPwDaYf_Cu6zKaRM4DiuSrfDToDvBc0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-6-18_15-28-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzZhMWFkOWEzMzExZGM5NWY0IiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.HpUL360WR2c9LDPKFbwvVcBcYl3Z1Gx3FizIwi6yS3U)

 (image/png)    


[test_sr26618_smoke.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzZhMWFkOWEzMzExZGM5NWY1IiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.GgD68IhDIiqZbs-0zxtf6gKIgi7nG7Fa9boGLYuWdIM)

 (application/octet-stream)    


[DBMS_APPLICATION_INFO文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzdhMWFkOWEzMzExZGM5NWY2IiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.-TMMVJ3hDnCwSbQL-iNmQQrvOOcqAwOhTwBe7U8RyzM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-5-22_1-9-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzc4OTcwYzJhZjRmNTIxNzgzIiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.A2t77CUzZEWGEhrE19wJnMHTb6JQRDT32BTrNCClJlQ)

 (image/png)    


[set_false.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzc4OTcwYzJhZjRmNTIxNzg1IiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.uBd9P2BQr7UPOn1fOoOKyKtPeCYxDfaEHDrUeWEBKvo)

 (image/png)    


[分布式外部表insert into select文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzc4OTcwYzJhZjRmNTIxNzg2IiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.BXEHgVwg0JBG_FwTgSZt8NPEdIzzvboZF6OAl7wev28)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式外部表insert into select文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzdhMWFkOWEzMzExZGM5NWY4IiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.icLac-COV8SWdsDSmd9ELU0BRJwbu7AXYSLoAvnXyPw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式外部表insert into select文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMzdhMWFkOWEzMzExZGM5NWY5IiwicmVmX2lkIjoiNjczOTZlMzY3MjgyMDZlZmI5MmYyNmVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMTI4LCJleHAiOjE3ODI0NTc1Mjh9.dM0XTn3yBtWM4p-YdL6UNuDO318aUMQatr5MSSiY4G0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：    
  与会人：廖增康，何阳，赵育，罗爽，刘美秀    
  会议时间：2024/8/8 14:30-16:00    
  会议地点：1002,insert into select 纪要信息：    
  1.信息裁决：insect 内部表 select from 外部表 filter 覆盖    
  ---对比insect select from 内部表流程无变动，且select 外部表 filter 已在分布式外部表SR中有覆盖，故不需要在此SR重复验证    
  2.数据类型验证：新增urowid    
  3.信息同步：外部表是字符型，内部表是clob插入成功，是blob插入报错    
  4.信息同步：值长度超范围--内部表varchar20，外部表值长度30，内部表报错YAS-04008 C1 size exceeding limit 2    
  5.信息同步：分布式行表hint--支持,Posted by liumeixiu at 八月 08, 2024 16:37|
|---|
