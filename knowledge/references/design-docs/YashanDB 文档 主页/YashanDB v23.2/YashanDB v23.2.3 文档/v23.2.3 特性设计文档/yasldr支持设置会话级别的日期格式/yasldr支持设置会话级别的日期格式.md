Created by 程康, last modified on 五月 22, 2024

*IR链接：YDBRD-16092*

*SR链接：YDBRD-22278*

##   [1. 总述](#1-总述)  

csv文件可能含有日期列，日期的格式不一定与session默认的日期格式相同

此需求支持yasldr在导入时设定日期格式，例如 'yyyy-mm-dd hh24:mi:ss'，以此导入

csv文件中符合此格式的日期到对应的列

###   [1.1 需求来源](#11-需求来源)  

支持设置导入时设置会话级别日期格式，比如alter session set date_format

###   [1.2 调研文档](#12-调研文档)  

oracle 支持date_format的设置，对每一列在ctrl文件中可以配置

  [yasldr 支持配置导入的日期格式--调研文档 - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144113952)  

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

不涉及

###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

|**接口**|**接口表现**|**接口说明**|**是否涉及**|
|---|---|---|---|
|配置参数|date_format|设置导入的日期格式|是|
|配置参数|time_format|设置导入的时间格式|是|
|配置参数|timestamp_format|设置导入的时间戳格式|是|


##   [3. 规格与约束](#3-规格与约束)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**   规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

1、date_format 参数的值，可能含有空格，因此 需要  以双引号+单引号包围

2、date_format 参数支持中文年月日，同sql侧，中文年月日需要用双引号包围，同时linux下此双引号也需要使用 \ 转义

3、csv有不同列的date，格式不同，不支持对单列进行设置各自的 date_format、time_format、timestamp_format 

  


例如：

```
yasldr ck/1@127.0.0.1:1688 control_file=/exp/ck_date.ctl date_format="'yyyy-mm-dd hh24:mi:ss'"
yasldr ck/1@127.0.0.1:1688 control_file=/exp/ck_date.ctl date_format="'yyyy-mm-dd'"
yasldr ck/1@127.0.0.1:1688 control_file=/exp/ck_date.ctl date_format="'yyyy\"年\"mm\"月\"dd\"日\"'"
yasldr sys/Cod-2022 date_format="'yyyy-mm-dd hh24:mi:ss'" time_format="'hh24:ss:mi'" timestamp_format="'yyyy-mm-dd ff.hh24:mi:ss'" control_text="'load data infile '/data/exp/ck_test' fields terminated by '|' into table ck_test(c1,c2,c3,c4,c5)'"
```

默认值：

date – yyyy-mm-dd hh24:mi:ss

time – hh24:mi:ss.ff

timestamp – yyyy-mm-dd hh24:mi:ss.ff

##   [4. 特性](#4-特性)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d3fa1ad9a3311dc8fd5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5NDcsImV4cCI6MTc4MjMxNzc0N30.bWVYy-eJp1qMcRvNxzti0ishc8nq_Qvw1TzTzhTMWD0)

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|date format|  
|
|---|---|
|yyyy-mm-dd hh24:mi:ss|  
|
|yyyy-mm-dd|  
|
|mm-yy-dd hh24:mi:ss|  
|
|yy mm dd hh24 mi ss|  
|
|yyyy年mm月dd日|  
|


csv中多余空格的df转换处理行为

date作为csv其中一列的行为

windows linux

##   [6.资料设计章节](#6资料设计章节)  

修改yasldr 参数相关资料，说明设置date_format、time_format 、timestamp_format 的作用

##   [7.未来规划](#7未来规划)  

  


  


## Attachments:

[image2024-1-19_16-13-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2U4OTcwYzJhZjRmNTIxMTY0IiwicmVmX2lkIjoiNjczOTZkM2U3MjgyMDZlZmI5MmYxY2I0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTQ3LCJleHAiOjE3ODIzOTMzNDd9.9MAwAwq7jvUfIXUriwTxsWBRXXFvxa8atLOjmDyBHo4)

 (image/png)    


## Comments:

|  [](null)  ,1、oracle是否有统一配置df的参数 – 无,Posted by chengkang at 一月 23, 2024 10:32|
|---|
|  [](null)  ,1、interval 形式的df是否支持？--  不支持,2、time 数据类型，timeStamp数据类型，和exp --csv能力保持一致 – 当前sr设置格式仅影响 date类型的字段,Posted by chengkang at 四月 24, 2024 15:55|
|  [](null)  ,需要支持 timestamp_format  time_format,Posted by chengkang at 四月 30, 2024 14:17|
|  [](null)  ,exp --csv 是否支持导出中文年月日 – 支持 类似,exp --csv -f csv -u sys -p Cod-2022 -T ck_test -O sys --fields-terminated-by , --date-format 'yyyy"  年  "mm"  月  "dd"  日  "',dateFormat   yyyy : mm : dd   2022-02-03,                      xxxx  校验是否合法,  
,csv：02-2022-01,参数：mm-yyyy-dd,db：2022-02-01,Posted by chengkang at 五月 22, 2024 16:34|
