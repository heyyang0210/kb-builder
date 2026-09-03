Created by 严丽英, last modified on 十二月 19, 2023

# 1.   **概述**

  [YDBRD-23061](https://jira.yasdb.com/browse/YDBRD-23061?src=confmacro)    -  支持sys_extract_utc函数  完成

需求：  select (cast(sys_extract_utc(systimestamp) as date) - date'1970-01-01') * 86400 from dual;

SYS_EXTRACT_UTC函数主要用于将输入的timestamp转换成UTC（原格林尼治标准时间）对应的时间返回，返回类型为timestamp。

# 2.   **需求分析**

**2.1语法图：**

![](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/img/sys_extract_utc.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY5MTAsImV4cCI6MTc4MjMwNzcxMH0.K_4XItJs7rUYT6JVhxGM5KeDlqj1xP5kcb_er8ob-Ys)

SYS_EXTRACT_UTC(datetime);

  


**2.2应用场景**

从具有时区偏移量或者时区名的日期时间值中提取 UTC

**2.2规格限制**

本需求支持单机，集群行存

本函数仅支持Timestamp类型，入参和出参都为Timestamp类型

崖山Timestamp类型目前只支持基础功能，对于TIMESTAMP WITH TIME ZONE，TIMESTAMP WITH LOCAL TIME ZONE 暂不支持，目前为转换时拦截

select sys_extract_utc(systimestamp) from dual;比如当前时间2023-11-02 09:44:10，返回2023-11-02 01:44:10

# 3.   **详细测试设计**

## **3.1测试设计方法**

函数入参–采用边界值 等价类

其它场景采用等价类

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|入参：,SYS_EXTRACT_UTC(datetime)|Timestamp类型,1.参数为子查询：select sys_extract_utc((select col2 from test1 ))from test2;,2.特殊日期 跨天、跨年、跨月,3.函数大小写,4.绑定参数/框架绑定参数,  
,5.插入数据为null|1.其它类型 date，time,2.多个参数：SYS_EXTRACT_UTC(datetime，datetime),3.为空：SYS_EXTRACT_UTC(),4.参数为常量：SYS_EXTRACT_UTC(null)/SYS_EXTRACT_UTC(1),5.加减时区：  SYS_EXTRACT_UTC(TIMESTAMP '2000-03-28 11:30:00.00 -08:00'),6.格式：sys_extract_utc('2023-11-1 14:50:00')/sys_extract_utc(timestamp),  
|
|做关键字|表名/字段名/别名|  
|
|type|typeof|  
|
|嵌套|SYS_EXTRACT_UTC(SYS_EXTRACT_UTC(datetime))   128层数|129  层|
|与其他函数嵌套|TIMESTAMP(sys_extract_utc(col1)),sys_extract_utc(SCN_TO_TIMESTAMP(1245145611))|  
|
|  
|转换类型cast(  SYS_EXTRACT_UTC(datetime)as date  )|  
|
|filter|where/having:,in/not in、like/not like、exists/not exist,and/or、order by、connect by、limit/limit offset|  
|
|  
|1. inner join、left join、right join、full join
,2. 子查询 （在表、在投影列、再where）,3. 集合union/unionall、intersect/intersect all/minus/minus all|  
|
|函数位置|在group by、where、 order by|  
|
|dml|1. insert into select   SYS_EXTRACT_UTC(datetime)
,2. update..where a in（select SYS_EXTRACT_UTC(datetime) from ...,3. delete... where a in（select SYS_EXTRACT_UTC(datetime) from ...|  
|
|视图|view/  materialized view/dual/,v$function|  
|
|约束|index|  
|
|表类型|heap（分区表）|  
|
|  
|  
|  
|


# 3.2     **详细测试设计**

|系统级DFX分类|是否涉及|
|:---|:---|
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
|可维护性|否|


|dfx测试设计|  
|
|:---|:---|
|ct/kt|dml/dql 之间并发、|


  


# 4.   **测试用例**

1.测试设计评审时提供冒烟文本用例；

2.启动测试之前提供文本用例，并完成大部分自动化用例；

详见附件

[SYS_EXTRACT_UTC文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzU4OTcwYzJhZjRmNTIwNmQzIiwicmVmX2lkIjoiNjczOTZiYzU1OTNmOTljOWZmMjM2NmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTEwLCJleHAiOjE3ODIzODMzMTB9.mUlVR4nRk1MpOnC7cbDobxzBaoAqk5yNxRgB0qZaDgE)

# 5.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 确认使用的测试框架及其满足度


# 6.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|linux|
|部署|单机,集群|


# 7. 工作量评估

工作量：  *1人天*

计划测试完成时间：2023-12-05

  


  


  


## Attachments:

[SYS_EXTRACT_UTC文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYzU4OTcwYzJhZjRmNTIwNmQzIiwicmVmX2lkIjoiNjczOTZiYzU1OTNmOTljOWZmMjM2NmQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2OTEwLCJleHAiOjE3ODIzODMzMTB9.mUlVR4nRk1MpOnC7cbDobxzBaoAqk5yNxRgB0qZaDgE)

 (application/vnd.ms-excel)    
