Created by 程康, last modified on 十一月 08, 2024

### 日期类型

  
  create table   t   as select   truncate  (  sysdate  (),  1  )   as   a   from   dual  ;    
  create table   t2   as select   truncate  (  curdate  (),  1  )   as   a   from   dual  ;    
  create table   t3   as select   truncate  (  current_timestamp  (),  1  )   as   a   from   dual  ;    
    


![](https://pingcode.yasdb.com/atlas/files/public/6739e3a7a1ad9a3311de2596/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

  
    


double

  


presicion：17+第二个参数    
  scale：第二个参数    
    
    


### 两个入参均为常数

create table   t4   as select   truncate  (  1231563.1321653  ,   2  )   as   a   from   dual  ;    


![](https://pingcode.yasdb.com/atlas/files/public/6739e3a78970c2af4f53a743/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

  
    


（  decimal  ，int）（decimal，decimal）

**decimal**

**presicion：第一个参数的整数位数 + 第二个参数**    
  **scale：第二个参数**

  


create table   t5   as select   truncate  (  10000325  , -  5.1  )   as   a   from   dual  ;

（  int  ，int）（int，decimal）

 返回 int

precision:第一个参数的整数位数

  


  


### 第一个入参为变量

  


create table   t6   as select   truncate  (  CEILING  (  RAND  () *   76  ),   5  )   as   a   from   dual  ;

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a7a1ad9a3311de2597/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

（double，int）（double，double）

presicion：17 + 第2个参数    
  scale：第2个参数

  


（decimal，int）（decimal，decimal）

create table   t5   as select   truncate  (  cast  (  RAND  () *   6   as decimal  ),   2  )   as   a   from   dual  ;

decimal(12,2)

presicion：10 + 第2个参数    
  scale：第2个参数

  


### 第二个入参为变量

  


（decimal，double）

create table   t5   as select   truncate  (  1.2654654254  ,   CEILING  (  RAND  () *   6  ))   as   a   from   dual  ;

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a8a1ad9a3311de2598/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

create table   t5   as select   truncate  (  10000.265  ,   CEILING  (  RAND  () *   6  ))   as   a   from   dual  ;    


![](https://pingcode.yasdb.com/atlas/files/public/6739e3a8a1ad9a3311de2599/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

**decimal**

**presicion：16 + 第一个参数的小数位**    
  **scale：第一个参数的小数位**

  


（int，double）

create table   t5   as select   truncate  (  10000  ,   CEILING  (  RAND  () *   6  ))   as   a   from   dual  ;

double（17，0）

  


  


（decimal，decimal）

create table   t5   as select   truncate  (  10000.265  ,   cast  (  RAND  () *   6   as decimal  ))   as   a   from   dual  ;

  


### 入参为变量

（decimal，decimal）

create table   t6   as select   truncate  (  cast  (  rand  ()*  23   as decimal  ),   cast  (  ceiling  (  rand  ()*  19  )   as decimal  ))   as   a   from   dual  ;

decimal(17,0)

presicion：17    
  scale：0

  


**返回decimal的情况：**

**第一个参数是decimal**

  


  


  


**mysql decimal precision max 65**

create table   t111  (  c1   decimal  (  500  ,  5  ));    
    
  但是下面的超过65 精度可以执行 结果   **scale最大为 30**    
    
  select   truncate  (  215310000123141241241121531000012314124124112153100001231412412411111.120000  ,   33  );    
    
  这句执行失败，走了65 的precision限制    
  create table   t6   as select   truncate  (  215310000123141241241121531000012314124124112153100001231412412411111.12  ,   40  );

  


**yashan number precision 38**

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a88970c2af4f53a744/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

  


**---------------11.4**

  


drop table   buildin_tb_intercept  ;    
  create table   buildin_tb_intercept  (  c1   integer  ,  c2   bigint  ,  c3   decimal  (  20  ,   10  ),  c4   float  );    
  insert into   buildin_tb_intercept   values  (  187368  ,   234687561  ,   '141244'  ,   '3.5E20'  );    
  create table   tp   as select   truncate  (  1  ,   c1  )   as   integer_  ,   truncate  (  2  ,   c2  )   as   bigint_  ,   truncate  (  3  ,   c3  )   as   decimal_  ,  truncate  (  3  ,   c4  )   as   float_   from   buildin_tb_intercept  ;    
  desc   tp  ;    
  select   *   from   tp  ;    
    


![](https://pingcode.yasdb.com/atlas/files/public/6739e3a88970c2af4f53a745/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

  


  


  


--------------11.5

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a88970c2af4f53a746/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

![](https://pingcode.yasdb.com/atlas/files/public/6739e3a9a1ad9a3311de259a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFDQUFBQWdBQUFBb0FBQUFZQUlBQVVBQUFBZ0FBQkFBQVJBQUVBQUFBQWlBQUJBUUFJQUFBQUFBQkNBQUFBQUlBQUFBQUFBQUFBQUFCQUFnUUFRQUFBQ0VBSUFBSUFBQ0NBQVVBQUFJb0FFQUFBQUFJQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQkFBQUFRQUFBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTU1MDIsImV4cCI6MTc4MjQ2NjMwMn0.mbEDj3132SzWO-3tOnxghzBhGVHnnaeTj5Rk8P7tJY8)

## Attachments:

[image2024-10-30_14-13-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYTU4OTcwYzJhZjRmNTNhNzNjIiwicmVmX2lkIjoiNjczOWUzYTU3MjgyMDZlZmI5MzE2ZTMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTAyLCJleHAiOjE3ODI1NDE5MDJ9.hhbMukGDQXsaTEllAo5BSHWuJ0Qp2HGOR6hormJpKAk)

 (image/png)    


[image2024-10-30_17-16-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYTZhMWFkOWEzMzExZGUyNTkyIiwicmVmX2lkIjoiNjczOWUzYTU3MjgyMDZlZmI5MzE2ZTMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTAyLCJleHAiOjE3ODI1NDE5MDJ9.mhTB6gyCxBQnOUV_EAPzk_WLPmuuDd2lbr37g5ZQRkE)

 (image/png)    


[image2024-10-31_9-52-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYTZhMWFkOWEzMzExZGUyNTkzIiwicmVmX2lkIjoiNjczOWUzYTU3MjgyMDZlZmI5MzE2ZTMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTAyLCJleHAiOjE3ODI1NDE5MDJ9.I3CWTjWer7uDZ8tuBAvveAQOjD8Lt8lAiH_qBBzPyh0)

 (image/png)    


[image2024-10-31_9-56-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOWUzYTY4OTcwYzJhZjRmNTNhNzNmIiwicmVmX2lkIjoiNjczOWUzYTU3MjgyMDZlZmI5MzE2ZTMxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1NTAyLCJleHAiOjE3ODI1NDE5MDJ9.E4Z_4iCSvg9UKP-eDomSxGh6awHxvDFW5u2rnWar6Qs)

 (image/png)    
