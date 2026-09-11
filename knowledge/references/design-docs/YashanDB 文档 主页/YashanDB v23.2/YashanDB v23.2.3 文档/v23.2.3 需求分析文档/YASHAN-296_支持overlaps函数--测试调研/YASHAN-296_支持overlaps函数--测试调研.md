Created by 孟麟, last modified on 四月 12, 2024

# 1. 需求概述

  [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b078](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b078)    ?    
  #YASHAN-296 支持overlaps函数

  [YDBRD-29150](https://jira.yasdb.com/browse/YDBRD-29150?src=confmacro)    -  支持overlaps函数  待内部评审

场 景： 1、判断两个时间段是否有重叠 

需求描述： 支持overlaps函数，判断两个时间段是否有重叠 

需求范围： 1、单机

用户使用语句：

![](https://pingcode.yasdb.com/atlas/files/public/67396cdd8970c2af4f520ec5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUlBQUFBQUFBSUFBQUFBQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk0MzUsImV4cCI6MTc4MjMyMDIzNX0.p6JD-yzO-Aw3UbB1m2PcbnJ5pXvJqtqqgbTeFZ74-wE)

# 2. 友商的实现情况

|特性|友商|实现情况|
|:---|:---|:---|
|overlaps函数|oracle|语法：(start1, end1) overlaps (start2, end2),功能：  判断2个时间段是否存在重叠，有重叠返回true，没有则返回false,注：oracle正式资料中无该函数信息（不推荐使用？）|


# 3. 示例

**1、基本使用**

SQL> select * from dual where (sysdate,sysdate+4) overlaps (sysdate+2,sysdate+3);

D    
  -    
  X

SQL> select * from dual where (sysdate,sysdate+4) overlaps (sysdate+4,sysdate+5);

no rows selected

  


**2、数据类型：只支持date和timestamp，而且不能混用**

SQL> select * from dual where (date'2022-01-01', date'2022-02-01') overlaps (date'2022-01-11', date'2022-01-12');

D    
  -    
  X

SQL> select * from dual where (timestamp'2022-01-01 00:00:00.0', timestamp'2022-02-01 00:00:00.0') overlaps (timestamp'2022-01-11 00:00:00.0', timestamp'2022-01-12 00:00:00.0');

D    
  -    
  X

SQL> select * from dual where (to_yminterval('1-1'), to_yminterval('2-1')) overlaps (to_yminterval('1-1'), to_yminterval('2-4'));    
  select * from dual where (to_yminterval('1-1'), to_yminterval('2-1')) overlaps (to_yminterval('1-1'), to_yminterval('2-4'))    
  *    
  ERROR at line 1:    
  ORA-00932: inconsistent datatypes: expected DATE got INTERVAL YEAR TO MONTH

  
  SQL> select * from dual where (to_dsinterval('1 0:0:0'), to_dsinterval('2 0:0:0')) overlaps (to_dsinterval('1 1:0:0'), to_dsinterval('3 2:0:0'));    
  select * from dual where (to_dsinterval('1 0:0:0'), to_dsinterval('2 0:0:0')) overlaps (to_dsinterval('1 1:0:0'), to_dsinterval('3 2:0:0'))    
  *    
  ERROR at line 1:    
  ORA-00932: inconsistent datatypes: expected DATE got INTERVAL DAY TO SECOND

  
  SQL> select * from dual where (1, 100) overlaps (50, 200);    
  select * from dual where (1, 100) overlaps (50, 200)    
  *    
  ERROR at line 1:    
  ORA-00932: inconsistent datatypes: expected DATE got NUMBER

SQL> select * from dual where (timestamp'2022-01-01 00:00:00.0', timestamp'2022-02-01 00:00:00.0') overlaps (date'2022-01-11', date'2022-01-12');    
  select * from dual where (timestamp'2022-01-01 00:00:00.0', timestamp'2022-02-01 00:00:00.0') overlaps (date'2022-01-11', date'2022-01-12')    
  *    
  ERROR at line 1:    
  ORA-00932: inconsistent datatypes: expected TIMESTAMP got DATE

  
  SQL> select * from dual where (date'2022-01-11', date'2022-01-12') overlaps (timestamp'2022-01-01 00:00:00.0', timestamp'2022-02-01 00:00:00.0');    
  select * from dual where (date'2022-01-11', date'2022-01-12') overlaps (timestamp'2022-01-01 00:00:00.0', timestamp'2022-02-01 00:00:00.0')    
  *    
  ERROR at line 1:    
  ORA-00932: inconsistent datatypes: expected DATE got TIMESTAMP

  


SQL> select * from dual where (date'2022-01-01', timestamp'2022-02-01 00:00:00.0') overlaps (date'2022-01-11', date'2022-01-12');    
  select * from dual where (date'2022-01-01', timestamp'2022-02-01 00:00:00.0') overlaps (date'2022-01-11', date'2022-01-12')    
  *    
  ERROR at line 1:    
  ORA-00932: inconsistent datatypes: expected DATE got TIMESTAMP

  


**3、计算重叠的规则（边界等）**

--前面的end等于后面的start，结果是不重叠

SQL> select * from dual where (date'2022-01-01', date'2022-02-01') overlaps (date'2022-02-01', date'2022-02-10');

no rows selected

--允许start的时间大于end

SQL> select * from dual where (date'2022-02-01', date'2022-01-01') overlaps (date'2022-01-01', date'2022-02-10');

D    
  -    
  X

--timestamp可以精确到微秒

SQL> select * from dual where (timestamp'2022-01-01 00:00:00.99', timestamp'2022-02-01 00:00:00.99') overlaps (timestamp'2022-02-01 00:00:00.98', timestamp'2022-02-12 00:00:00.0');

D    
  -    
  X

  


**4、其他场景**

**（1）可以出现在case when中，不能作为投影列（是因为oracle没有boolean数据类型？崖山是否要限制？）**

SQL> select case when (sysdate,sysdate+4) overlaps (sysdate+2,sysdate+3) then 'check rst:overlap' else 'check rst:nonoverlap' end from dual;

CASEWHEN(SYSDATE,SYS    
  --------------------    
  check rst:overlap

SQL> select ((sysdate,sysdate+4) overlaps (sysdate+2,sysdate+3)) over_laps from dual;    
  select (sysdate,sysdate+4) overlaps (sysdate+2,sysdate+3) over_laps from dual    
  *    
  ERROR at line 1:    
  ORA-00907: missing right parenthesis

**（2）null处理**

SQL> select * from dual where (null,null) overlaps(null, null);    
  select * from dual where (null,null) overlaps(null, null)    
  *    
  ERROR at line 1:    
  ORA-01870: the intervals or datetimes are not mutually comparable

  
  SQL> select * from dual where (null,null) overlaps (sysdate, sysdate+1);    
  select * from dual where (null,null) overlaps (sysdate, sysdate+1)    
  *    
  ERROR at line 1:    
  ORA-01870: the intervals or datetimes are not mutually comparable

  
  SQL> select * from dual where (sysdate, sysdate+1) overlaps (null,null);    
  select * from dual where (sysdate, sysdate+1) overlaps (null,null)    
  *    
  ERROR at line 1:    
  ORA-01870: the intervals or datetimes are not mutually comparable

  
  SQL> select * from dual where (null, sysdate) overlaps (sysdate-1, sysdate+1);

D    
  -    
  X

SQL> select * from dual where (sysdate, null) overlaps (sysdate-1, sysdate+1);

D    
  -    
  X

**--恒为false？**

SQL> select * from dual where (null, sysdate) overlaps (null, sysdate-1);

no rows selected

# 4. 参考文档

  [https://support.oracle.com/knowledge/Oracle%20Database%20Products/1056382_1.html](https://support.oracle.com/knowledge/Oracle%20Database%20Products/1056382_1.html)  

  [https://www.postgresql.org/docs/current/functions-datetime.html](https://www.postgresql.org/docs/current/functions-datetime.html)  

# 5. 后续关注(可选)

*后续测试设计与执行过程中需跟友商做细化对比的内容*

## Attachments: