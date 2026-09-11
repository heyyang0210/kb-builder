Created by 唐文林, last modified on 七月 15, 2024

1、DBMS_UTILITY.EXEC_DDL_STATEMENT

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|嵌套子过程中调用此函数（嵌套子过程覆盖所有ddl语句）|多层嵌套多层调用、不同层调用、组合使用|UDP、UDF、procedure、匿名块|  
|
|动态执行中调用高级包(静态SQL、匿名块、udf、udp、procedure、嵌套子过程)|1、有使用绑定参数,2、没有使用绑定参数,3、动态sql多层嵌套，不同层调用|  
|  
|
|匿名块 支持语句区（begin .. end）嵌套数据区(declare ..),![](https://pingcode.yasdb.com/atlas/files/public/6739a40aa1ad9a3311dd5a68/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIzNTQsImV4cCI6MTc4MjMyMzE1NH0.fy-PFBm4Kph-BMP9cUjsaC4_uHgIspxWNl96RpNi-ok)|  
|  
|  
|
|  
|  
|  
|  
|
|  
|  
|  
|  
|
|  
|  
|  
|  
|


2、DBMS_UTILITY.FORMAT_CALL_STACK、DBMS_UTILITY.FORMAT_ERROR_STACK

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|udt成员方法中直接调用高级包|/|静态方法、成员方法（map函数、order函数）|  
|
|嵌套子过程中调用此函数|多层嵌套多层调用、不同层调用、组合使用|UDP、UDF、procedure、匿名块|  
|
|直接select使用，高级包作投影了|/|/|报错|
|普通用户非dba用户调用高级包、创建同名PKG|/|  
|  
|
|动态执行中调用高级包(静态SQL、匿名块、udf、udp、procedure、嵌套子过程)|1、有使用绑定参数,2、没有使用绑定参数,3、动态sql多层嵌套，不同层调用|  
|  
|
|游标中调用高级包|/|  
|报错|
|匿名块 支持语句区（begin .. end）嵌套数据区(declare ..),![](https://pingcode.yasdb.com/atlas/files/public/6739a40aa1ad9a3311dd5a68/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIzNTQsImV4cCI6MTc4MjMyMzE1NH0.fy-PFBm4Kph-BMP9cUjsaC4_uHgIspxWNl96RpNi-ok)|  
|  
|  
|
|  
|  
|  
|  
|
|  
|  
|  
|  
|


## Attachments:

## Comments:

|  [](null)  ,DBMS_UTILITY.EXEC_DDL_STATEMENT,1. 触发器是insert before，函数执行insert，预期不会触发
1. 函数创建function,function里面调用函数创建同名函数 （eg: DBMS_UTILITY.EXEC_DDL_STATEMENT('...fun1 ()  DBMS_UTILITY.EXEC_DDL_STATEMENT('fun1() ...')....')
1. 函数创建function,function里面调用函数创建不同名
1. 合法ddl，参数类型是clob，入参大于32000字节
1. 合法ddl,结合set savepoint +rollback (eg: begin  set savepoint sp1;  DBMS_UTILITY.EXEC_DDL_STATEMENT...; rollback sp1;)
1. 使用关键字参数传值，校验参数名
1. 权限校验：  7.1 ddl指定schema (指定当前schema，非当前schema)；  7.2 普通用户非dba有ddl权限用户调用函数； 7.3 无ddl系统权限/对象 用户调用函数
1. dbsm_sql 中statement调用 DBMS_UTILITY.EXEC_DDL_STATEMENT 创建合法ddl
,DBMS_UTILITY.FORMAT_ERROR_STACK,1. **内置高级包新增的异常捕获调用函数**
,DBMS_UTILITY.FORMAT_CALL_STACK,1. 匿名块是语句区（begin .. end）嵌套数据区(declare ..)调用函数
,Posted by lisiyu at 七月 12, 2024 11:25|
|---|
