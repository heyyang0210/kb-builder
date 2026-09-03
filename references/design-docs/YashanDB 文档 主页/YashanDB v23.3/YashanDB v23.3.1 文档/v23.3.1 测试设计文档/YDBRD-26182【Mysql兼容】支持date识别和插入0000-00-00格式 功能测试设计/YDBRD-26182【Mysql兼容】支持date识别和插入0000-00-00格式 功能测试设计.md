Created by 钟溱, last modified on 十月 12, 2024

SR：    [https://pingcode.yasdb.com/pjm/items/6618eb5efd997db58ad837c3](https://pingcode.yasdb.com/pjm/items/6618eb5efd997db58ad837c3)    ?    
  #YDBRD-26182 MySQL兼容模式下支持date识别和插入0000-00-00格式

# 1. 概述

场 景：mysql兼容

需求描述：【mysql兼容】支持date识别和插入0000-00-00格式

需求范围：  单机、分布式、集群

需求规格：    
  1、设置NO_ZERO_DATE、NO_ZERO_IN_DATE时，向date类型传入0000-00-00格式的日期返回错误    
  2、未设置NO_ZERO_DATE、NO_ZERO_IN_DATE时，可向date类型传入0000-00-00格式的日期

# 2. 需求分析

## 2.1 功能点分析

1、功能：

- 新增2个配置项  **NO_ZERO_DATE**  、  **NO_ZERO_IN_DATE**


配置项控制规则

|  
|**NO_ZERO_DATE**|**NO_ZERO_IN_DATE**|效果|
|:---|:---|:---|:---|
|1|打开|打开|不允许插入  '0000-00-00'，也不允许年、月、日单独为0（mysql年可以为0）|
|2|关闭|打开|允许插入'0000-00-00'，不允许年，月、日单独为0|
|3|打开|关闭|不允许插入'0000-00-00'，允许月、日单独为0|
|4|关闭|关闭|允许插入  '0000-00-00'，允许年、月、日单独为0|


- 涉及的日期数据类型：date、timestamp
- 除日期类型可以存储0000-00-00外，还有类型转换、函数等场景涉及支持0000-00-00格式


2、差异：

- mysql涉及的日期类型包括  **date、year、datetime、timestamp，**  yashandb涉及的日期类型  **date、timestamp**
- 转换、日期类函数表现上也存在差异


## 2.2 应用场景

- 1、应用场景：日期数据类型的存储和函数处理
- 2、关联场景：新增配置项


## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


# 3. 详细测试设计

## 3.1 测试设计方法

本特性测试设计，主要使用等价类、边界值、场景分析等测试设计工程方法。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|条件1|条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|配置参数,  
,  
,  
|NO_ZERO_DATE,NO_ZERO_IN_DATE,  
,  
,  
|配置参数大小写|  
|拼写错误|  
|
|||NO_ZERO_DATE：打开、  NO_ZERO_IN_DATE：打开,不允许插入'0000-00-00'，也不允许年、月、日单独为0|alter system set NO_ZERO_DATE=true/false,不能alter session set NO_ZERO_DATE=true/false    
  无需重启生效|alter为0、1、on、off \空等|  
|
|||NO_ZERO_DATE：关闭、  NO_ZERO_IN_DATE：打开,允许插入'0000-00-00'，不允许月、日单独为0|先开，插入数据后关闭再查询|  
|  
|
|||NO_ZERO_DATE：打开、  NO_ZERO_IN_DATE：关闭,不允许插入'0000-00-00'，允许月、日单独为0    
|  
|  
|  
|
|||NO_ZERO_DATE：关闭、  NO_ZERO_IN_DATE：关闭,允许插入'0000-00-00'，允许年、月、日单独为0|  
|  
|  
|
|DATE    
    
    
    
    
,  
|DDL|作为create建表默认值|  
|  
|  
|
|||作为alter列默认值|  
|  
|  
|
||DML|插入 0000-00-00 、0001-00-00 、0000-01-00、 0000-00-01 格式的日期,还包括部分为0的时间格式，例如1000-00-00.|不同日期分隔符(    `:`    、    `-`    、    `/`    、    `.`    、    `,`    、    `;`    、    `\`    、    `_、空格`    )|000-00-00、0000-00-0、-0000-00-00等|  
|
|||update/delete   where覆盖左值和右值|  
|  
|  
|
||DQL    
    
,  
|select 投影列，作为where过滤条件|  
|  
|  
|
|||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null等子查询|  
|  
|  
|
|||结合order by 排序|  
|  
|  
|
|timestamp|同上|同上|  
|  
|  
|
|SHORTTIME|alter session set COMPAT_VECTOR = MYSQL;|同上|开MySQL兼容模式，然后建一个date类型的列,desc一下，就是shorttime类型|  
|  
|
|函数|cast/隐式转换|所支持的与时间类型互转,  
||  
|  
|
||日期类型函数|to_date/to_timestamp转换|  [YDBRD-14171 日期格式支持中文测试设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=135606868)  |  
|  
|
||DATE_FORMAT|%Y 四位年份    
  %y 两位年份,%m月份（01...12）,%c 月份（1...12）|  [https://git.yasdb.com/cod-test/yasft/-/blob/master/standalone/testcase/function3/date_format/heap/test_sdv_func_date_format_01.sql](https://git.yasdb.com/cod-test/yasft/-/blob/master/standalone/testcase/function3/date_format/heap/test_sdv_func_date_format_01.sql)  |  
|  
|
||DATE_ADD()|  
|  
|  
|  
|
|参与运算|+，-，*，/、and\or、> <..|  
|  
|覆盖减成0的边界，年月日|  
|
|日期格式|“YYYY/MM/DD”等是否影响“0000-00-00”的识别。|alter session set date_format = 'yyyy/mm/dd';,alter session set date_format = 'yyyy[mmdd]';,alter session set date_format='yyyy[mmdd]]]]]]';,alter session set DATE_FORMAT = 'DD-MON-RR';|create table A (id int,c1 date);    
  insert into A values(1,'2024[0426]');,SQL> select to_char(c1, '[yyyy-mm-dd]') from A;,TO_CHAR(C1,'[YYYY-MM     
  --------------------     
  [2024-04-26],1 row fetched.,  
    
|  
|  
|
|plsql|存储过程|DATE类型字段，插入或更新0000-00-00格式的值，调用存储过程|  
|  
|  
|
|json|json类型插时间格式的数据？|  
|  
|  
|  
|


  


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；




# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：



## Attachments:

[image2024-4-25_17-41-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTU4OTcwYzJhZjRmNTIxODVlIiwicmVmX2lkIjoiNjczOTZlNTU1OTNmOTljOWZmMjM4M2QwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzc5LCJleHAiOjE3ODI0NTc3Nzl9.wiUiL_M11568NMK9Xg-BVBYHo01nw0zysy8LEamRuXU)

 (image/png)    


[image2024-4-25_17-42-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTZhMWFkOWEzMzExZGM5NmQwIiwicmVmX2lkIjoiNjczOTZlNTU1OTNmOTljOWZmMjM4M2QwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzc5LCJleHAiOjE3ODI0NTc3Nzl9.C1Uzi_nvvGO3mYIEA9DAyu-ixOJXgjHvm0-bXauWvQo)

 (image/png)    


[YDBRD-26182-date.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTY4OTcwYzJhZjRmNTIxODVmIiwicmVmX2lkIjoiNjczOTZlNTU1OTNmOTljOWZmMjM4M2QwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzc5LCJleHAiOjE3ODI0NTc3Nzl9.XU-qjc5zhsh9NehI3MuGz_S1lHa5RYcZxJs-ggveoU8)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
