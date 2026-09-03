Created by 程康, last modified on 十一月 05, 2024

### 简介

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a38970c2af4f53a735/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

  


### 返回值类型：

  


-- yasdb

drop table if exists t1;

drop table if exists temp;

create table t1 (c1 tinyint, c2 smallint, c3 int, c4 bigint, c5 float, c6 double, c7 char(1), c8 varchar(1), c9 bit, c10 bool);

create table temp as select trunc(c1, 1) as tinyint_, trunc(c2, 1) as smallint_,trunc(c3, 1) as int_, trunc(c4, 1) as bigint_, trunc(c5, 1) as float_, trunc(c6, 1) as double_, trunc(c7, 1) as char_, trunc(c8, 1) as varchar_, trunc(c9, 1) as bit_, trunc(c10, 1) as bool_ from t1;

desc temp;

  


-- mysql

drop table if exists t1, temp;

create table t1 (c1 tinyint, c2 smallint, c3 int, c4 bigint, c5 float, c6 double, c7 char(1), c8 varchar(1), c9 bit, c10 bool);

create table temp as select truncate(c1, 1) as tinyint_, truncate(c2, 1) as smallint_,truncate(c3, 1) as int_, truncate(c4, 1) as bigint_, truncate(c5, 1) as float_, truncate(c6, 1) as double_, truncate(c7, 1) as char_, truncate(c8, 1) as varchar_, truncate(c9, 1) as bit_, truncate(c10, 1) as bool_ from t1;

desc temp；

  


![](https://pingcode.yasdb.com/atlas/files/public/6739e3a48970c2af4f53a736/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a4a1ad9a3311de258a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

### mysql的返回值带精度    
    
  日期类型：    
  create table   temp   as select   truncate  (  c12  ,   3  )   as   datetime_  ,   truncate  (  c13  ,   3  )   as   time_  ,   truncate  (  c14  ,   3  )   as   timestmp_   from   t1  ;

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a4a1ad9a3311de258b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

  


### mysql的lob情况：

数字类型 正常truncate，其他类型返回0.

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a4a1ad9a3311de258c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a48970c2af4f53a737/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a48970c2af4f53a738/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

  


### 参考：

  [MySQL兼容函数差异调研文档 - 王博文 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=167180096)  

  [12.6.2 数学函数_MySQL 8.0 参考手册](https://mysql.net.cn/doc/refman/8.0/en/mathematical-functions.html#function_truncate)  

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a48970c2af4f53a739/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)

  
    


|差异|yashan|  
|mysql|  
|
|---|---|---|---|---|
|入参类型|select   trunc  (  1.222  ,  'rasf'  )   from   dual  ;|不支持非number类型|select   truncate  (  1.222  ,  'rasf'  )   from   dual  ;,有warning  不用关注 非数字类型情况|支持，结果等价于   select   truncate  (  1.222  ,0)|
|入参个数|select   trunc  (  1.222  )   from   dual  ;|ok|select   truncate  (  1.222  )   from   dual  ;|缺少入参|
|日期,返回结果|select   trunc  (  sysdate  (),  'MM'  )   from   dual  ;|正常截到月份,2024-10-01|select   truncate  (  sysdate  (),  'MM'  )   from   dual  ;    
  有warning  不用关注 非数字类型情况|把sysdate当num处理了 结果：20241023103215,  
|
|日期入参|select   trunc  (  sysdate  (), 1)   from   dual  ;|不支持|select   truncate  (  sysdate  (),-  5  )   from   dual  ;|正常 20241023100000|
|返回精度|select   trunc  (  1.1  ,  5  ) from dual;|1.1,number类型才有精度,decimal对应number|select   truncate  (  1.1  ,  5  );,常量,变量|1.10000,![](https://pingcode.yasdb.com/atlas/files/public/6739e3a4a1ad9a3311de258d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQ0FBUUFBSUFBQUFBQUNBQUFBQWdBUWdBQUFBQ0FBQkFBQ0FBQUFCQUFBQUFBQUFBQUFBQUFBQUFnQUlBQUFBRUFBQUFBQUFBSUFBZ0FBSVFBQUFBQUFBQ0FBZ0FSRUFDQUFRUWtBQUFBQkFpUkVCQUFBQUFBQUFBQUFBQUJBRUFSQUFBQUFBQUFBQVFBQUJBZ0FBQUFBSUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU0MjYsImV4cCI6MTc4MjQ2NjIyNn0.UEj2l4qNSvz5SPSu8ltUtCBOJIJzQQRDkgZvChiXxFo)|
|  
|  
|  
|create table   t1231   as select   truncate  (  rand  (),   10  )   as   a   from   dual  ;|double(27,10)|
|  
|  
|  
|create table   t1231   as select   truncate  (  1.2654654254  ,   CEILING  (  RAND  () *   6  ))   as   a   from   dual  ;|decimal(26,10)|
|lob|  
|不支持lob截取|  
|支持lob截取，数字类型 正常truncate，其他类型返回0.|


1、返回类型有差异

2、函数名称差异

3、功能差异

## Attachments: