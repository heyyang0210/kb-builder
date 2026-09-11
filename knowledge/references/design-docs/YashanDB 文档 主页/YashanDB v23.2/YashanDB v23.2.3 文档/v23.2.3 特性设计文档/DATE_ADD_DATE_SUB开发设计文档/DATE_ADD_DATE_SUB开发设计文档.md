Created by 黎超健, last modified by  赵忠源 on 四月 17, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89081082#1-overview%E6%A6%82%E8%BF%B0)  

SR：YDBRD_6252/YDBRD_26957

SR描述：  MYSQL兼容

规格范围：单机

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=89081082#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

DATE_ADD/DATE_SUB(date，interval expr unit);

DATE_ADD为对日期进行加法运算，DATE_SUB为对日期进行减法运算。算法逻辑相同，以下以DATE_ADD介绍为主。

![](https://pingcode.yasdb.com/atlas/files/public/67396d308970c2af4f5210e4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUZBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDYsImV4cCI6MTc4MjMxNzI0Nn0.l8mgdOIL0RhvGH25d7gBAAGWnmpG0VVe7KEcMiiK5bs)

### 2.1函数入参

expr1指定起始日期

expr2  指时间前进或后退的区间值，由value和unit组成

  


expr1支持的类型：DATE类型、TIME类型、TIMESTAMP类型、可转为DATE、TIMESTAMP类型的字符型

expr2支持的类型：可以转换成YMInterval\DSInterval类型的时间类型、可转换为interval类型的常量字符类型（字符类型列报错）

### 2.2.   返回类型

|*expr2\expr1*|DATE|TIMESTAMP|TIME |NULL|
|:---:|:---:|:---:|:---:|:---:|
|DSInterval,(SECOND、MINUTE、HOUR、DAY,MINUTE TO SECOND、HOUR TO SECOND、HOUR TO MINUTE、DAY TO SECOND、DAY TO MINUTE、DAY TO HOUR,)|DATE|TIMESTAMP|TIME （  超过范围翻转  ）|NULL|
|YMInterval,(MONTH、YEAR、YEAR TO MONTH)|DATE|TIMESTAMP|N/A|NULL|
|NULL|NULL|NULL|NULL|NULL|


黄色框块表示计算过程中可能会报错；红色框块表示不支持；绿色框块表示一定成功；

取决于参数：

1）如果expr1输入的是DATE、TIME、TIMESTAMP数据类型中的一种，则返回expr1的数据类型。

2）如果expr1输入的是字符类型，则返回TIMESTAMP数据类型，否则报错。

3）如果expr1输入的是TIME数据类型，expr2为DSInterval时，返回TIME数据类型（  超过范围翻转：即超过24小时的话会求余数，如果是25小时，则翻转为1小时  ）；而expr2是YMInterval数据类型时，则不支持，返回报错。

  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89081082#3-interfaces%E6%8E%A5%E5%8F%A3)  

CodResult bifVerifyDateSub(AnlVerifier* vrfr, ExprNode* node);    
  CodResult bifConcludeDateSub(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);    
  CodResult bifExecDateSub(AnlStmt* stmt, ExprNode* node, Variant* retValue);    
  CodResult bifVerifyDateAdd(AnlVerifier* vrfr, ExprNode* node);    
  CodResult bifConcludeDateAdd(AnlStmt* stmt, ExprNode* node, TypeDesc* retType);    
  CodResult bifExecDateAdd(AnlStmt* stmt, ExprNode* node, Variant* retValue);

##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89081082#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

1.DATE_ADD/DATE_SUB函数是  执行日期运算。  Expr是一个表达式，指定从开始日期添加或者减少的区间值。  Unit也是一个关键字，表示的是一个单位。比如：加上的是1天还是一个小时。

2.interval expr unit（expr2）的解析需符合interval字面量相关规则

4.当unit是SECOND、MINUTE、HOUR、DAY、MINUTE TO SECOND、HOUR TO SECOND、HOUR TO MINUTE、DAY TO SECOND、DAY TO MINUTE、DAY TO HOUR时，可以转换成DSInterval数据类型；当unit是MONTH、YEAR、YEAR TO MONTH时，可以转换成YMInterval数据类型。

7.当expr2为YMInterval数据类型时，会先进行month的增减，之后再看day是否符合month的增减后的day数，如果增减后的month的天数小于增减前的month的天数，那么增减后的day数就是增减后的month的最后一天。例如：

![](https://pingcode.yasdb.com/atlas/files/public/67396d308970c2af4f5210e5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUZBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY0NDYsImV4cCI6MTc4MjMxNzI0Nn0.l8mgdOIL0RhvGH25d7gBAAGWnmpG0VVe7KEcMiiK5bs)

与mysql规格上存在差异

1. interval字面量解析  对于负区间（‘-’）是支持的（interval ‘-1’ year），但不支持interval关键字后面跟着负数，例如：interval -1 year这样子类似的会报错。
1. YASDB暂不支持  以TIME开始，加上''包含的字符串组成的值的时间字面量
1. YASDB上的DATE数据类型是可以包含时、分、秒的，与MySQL上的DATE数据类型不一样，MySQL上的DATE数据类型只能包含年、月、日；


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89081082#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### DATE_ADD/DATE_SUB函数的第二个expr的处理逻辑：

1. verify阶段：先对STRING类型进行处理，如果是CONST STRING的的话，那就看是否可以转换为DTYPE_INTERVAL_YM和DTYPE_INTERVAL_DS，转换不成功就报错。如果是COLUMN STRING的话，那就直接报错。之后把未知类型转换为varchar类型，再判断是否是INTERVAL和STRING类型，如果不是就报错。

2. exec阶段：如果值是NULL（除了COLUMN STRING的值为NULL，因为在verify阶段就报错了），则返回NULL。如果是STRING类型，则先转DTYPE_INTERVAL_YM，失败再转DTYPE_INTERVAL_DS，最后转换不成功就报错。

  


DATE_ADD/DATE_SUB函数本质为将expr1转换成DATE  、  TIME  、  TIMESTAMP类型，expr2转换成INTERVAL（YM/DS）类型，做expr1和expr2的加/减法

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=11698368&draftShareId=389e4978-4109-43bd-a23e-59d9b3c28654&#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

SQL>select DATE_ADD('2018-05-01',INTERVAL 2 DAY) from dual;    
  select DATE_ADD('2018-05-01',INTERVAL 2 DAY) from dual;

DATE_ADD('2018-05-01    
  ----------------------------------------------------------------    
  2018-05-03 00:00:00.000000

1 row fetched.

  


SQL> select DATE_ADD('2020-12-31 23:59:59',INTERVAL 1 SECOND) from dual;    
  select DATE_ADD('2020-12-31 23:59:59',INTERVAL 1 SECOND) from dual;

DATE_ADD('2020-12-31    
  ----------------------------------------------------------------    
  2021-01-01 00:00:00.000000

1 row fetched.

  


SQL>select date_add('2012-10-12',interval '1' year) from dual;    
  select date_add('2012-10-12',interval '1' year) from dual;

DATE_ADD('2012-10-12    
  ----------------------------------------------------------------    
  2013-10-12 00:00:00.000000

1 row fetched.

  


SQL>select date_add('2012-10-12',interval '-1' year) from dual;    
  select date_add('2012-10-12',interval '-1' year) from dual;

DATE_ADD('2012-10-12    
  ----------------------------------------------------------------    
  2011-10-12 00:00:00.000000

1 row fetched.

  


SQL>select date_add('2012-10-12',interval -1 year) from dual;    
  select date_add('2012-10-12',interval -1 year) from dual;

[1:42]YAS-04209 unexpected word year

  


SQL>select date_add('2012-10-12',interval1 year) from dual;    
  select date_add('2012-10-12',interval1 year) from dual;

[1:40]YAS-04209 unexpected word year

  


SQL>select date_add('2012-10-12',interval-1 year) from dual;    
  select date_add('2012-10-12',interval-1 year) from dual;

[1:41]YAS-04209 unexpected word year

  


SQL>select date_add('2012-10-12',interval'1' year) from dual;    
  select date_add('2012-10-12',interval'1' year) from dual;

DATE_ADD('2012-10-12    
  ----------------------------------------------------------------    
  2013-10-12 00:00:00.000000

1 row fetched.

  


SQL>select date_add('2012-10-12',interval'-1' year) from dual;    
  select date_add('2012-10-12',interval'-1' year) from dual;

DATE_ADD('2012-10-12    
  ----------------------------------------------------------------    
  2011-10-12 00:00:00.000000

1 row fetched.

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=11698368&draftShareId=389e4978-4109-43bd-a23e-59d9b3c28654&#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/resumedraft.action?draftId=11698368&draftShareId=389e4978-4109-43bd-a23e-59d9b3c28654&#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments:

[image2022-8-15_17-12-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzBhMWFkOWEzMzExZGM4ZjUyIiwicmVmX2lkIjoiNjczOTZkMzA3MjgyMDZlZmI5MmYxYzE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDQ1LCJleHAiOjE3ODIzOTI4NDV9.voFO6SWBvOm5jDSLWYAeDX3X7CVhujTaEo3V5nE7oG8)

 (image/png)    


[image2022-8-15_17-12-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMzA4OTcwYzJhZjRmNTIxMGUzIiwicmVmX2lkIjoiNjczOTZkMzA3MjgyMDZlZmI5MmYxYzE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2NDQ1LCJleHAiOjE3ODIzOTI4NDV9.ZnWtrIAsB3m0BQGa-sYwEPLdYimf2VdiFUVsitUIPrs)

 (image/png)    


## Comments:

|  [](null)  ,4-17设计评审会议纪要：,暂无异议,Posted by zhaozhongyuan at 四月 22, 2024 16:50|
|---|
