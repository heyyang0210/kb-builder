Created by 钟溱, last modified on 十月 12, 2024

# 1. 概述

本文描述使Yasdb语法兼容Oracle的float(126)测试设计

# 2. 需求分析

- ORACLE的语法兼容FLOAT(126)，实际等于崖山中的FLOAT(53)。
- 规格范围：单机, 分布式, 集群
- SR：    [YDBRD-21638](https://jira.yasdb.com/browse/YDBRD-21638?src=confmacro)    -  ORACLE的语法兼容FLOAT(126)  完成


## 2.1 功能点分析

  


- ### 数据结构与流程


![](https://conf.yasdb.com/download/attachments/133580816/image2023-10-31_9-38-15.png?version=1&modificationDate=1698716096000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU5OTUsImV4cCI6MTc4MjMwNjc5NX0.ZSC-n9cp_F9xGhJyuEyueciSFq6-ose4tHrqTvAdtIo)

  


- ### 功能特性


1、  使Yasdb语法兼容Oracle的float(126)。

## 2.2 规格约束

- float精度只支持1~126。
- 当p大于53，小于等于126时系统内部会将p变成53。
- float的p大于23时，系统内部会将其转为double。
- double的精度范围仍保持不变。


## 2.3 应用场景

1、建表成功，float(p)时，插入总长度超过/不超过m值的数据，能正常插入，  存入的数据会四舍五入截断

2、0-23内，插入float列的数据类型  为float；

24-53内，插入float列的数据类型为double；

53-126内，插入float列的数据类型  为double(53)；

>126，报错提示合理范围是0 <= p <= 126

# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

## 3.2 详细测试设计

|条件1|条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|入参\(p)    
    
,  
|float(p  )|p：0、23|float列的数据类型不转换，依旧为float|  
|  
|
|||p：24、53|float列的数据类型转为double|  
|  
|
|||p：54、126|desc table信息显示正确|  
|  
|
|||p：>126|  
|  
|报错合理|
|||p覆盖科学计数法|  
|  
|  
|
||入参    
    
    
    
    
|小数：  123.45|  
|  
|  
|
|||负数|  
|  
|  
|
|||长度：,1<length<126,length>126|12345678901234567890123456789012345678901234567890123456789012345678901234567890,数字 1.23E+200|  
|  
|
|||非数字字符|字符串 "Hello World"|  
|  
|
|||输入正无穷大、负无穷大、NaN|INF、-INF、NaN|  
|  
|
|||边界值|输入最大值 3.4028235E38 和最小值  -3.4028235E38|  
|  
|
||转换|cast|将整数、小数或字符串转换为FLOAT(126)|  
|  
|
|||入参函数|eg：SELECT ABS(cast(-2.345 as float(126))) from dual;|  
|  
|
|表类型|临时表|1. 创建全局临时表，带  float(126)  列；
1. 创建私有临时表，带  float(126)  列；
|  
|  
|  
|
|  
|float(126)列作为入参|float(126)列作为函数入参|cast、lengthb/length、substr、replace、concat、upper|  
|  
|
|  
|4096列|4096列float(126)|  
|  
|  
|
|  
    
    
    
    
    
    
    
    
    
    
    
    
    
,  
,  
,  
,  
,  
|异常场景    
    
    
    
    
    
    
,  
|p精度覆盖负数|报错，提示合理|  
|  
|
|||p精度覆盖小数|报错，提示合理|  
|  
|
|||p精度带字符|报错，提示合理|  
|  
|
|||p传参常量字符串|类似‘23’之类|  
|  
|
|||p传入变量|子查询、函数（cast as int）、列|  
|  
|
|参与运算|/|参与运算符运算|+，-，*，/、> <..|  
|  
|


## 3.3   场景测试

|输入条件|等价类|  
|
|:---|:---|:---|
|DDL|create时作为列的默认值|  
|
|  
|alter时作为列的default默认值|  
|
|  
|作为分区键的key值|  
|
|Update|set、where覆盖左值和右值|  
|
|DQL 匿名块|最大规格定义时，在匿名块中|  
|
|导入导出|最大规格定义时，导入导出成功且数据一致|  
|
|高级包|最大规格定义时，dbms_metadata.get_ddl获取建表语句|  
|


  


1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

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
|可维护性|否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- 使用guider框架，执行sql文件 对比预期与实际输出结果


# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：5  *人天*

计划测试完成时间：

## Attachments:

[image2023-11-6_15-38-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTJhMWFkOWEzMzExZGM4NDY2IiwicmVmX2lkIjoiNjczOTZiYTE3MjgyMDZlZmI5MmYwODYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1OTk1LCJleHAiOjE3ODIzODIzOTV9.qSTQkbvtmbBYedEuUcUB-kHkDKz4ZhEtXyeQcKSJlwQ)

 (image/png)    


[YDBRD－21638 float(126)文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTJhMWFkOWEzMzExZGM4NDY3IiwicmVmX2lkIjoiNjczOTZiYTE3MjgyMDZlZmI5MmYwODYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1OTk1LCJleHAiOjE3ODIzODIzOTV9.8V3cTbCthI-YKjtmyFmwafh2nQX_PthdlaHnuerTJd0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD－21638 float(126)文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTJhMWFkOWEzMzExZGM4NDY4IiwicmVmX2lkIjoiNjczOTZiYTE3MjgyMDZlZmI5MmYwODYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1OTk1LCJleHAiOjE3ODIzODIzOTV9.MY0PaJziuRx3-Gxn88GjJwMCX_mY5Lxdf-VgxhkHTeg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,Posted by zhongqin at 十一月 23, 2023 16:35|
|---|
