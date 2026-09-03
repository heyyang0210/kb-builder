Created by 徐千禧, last modified on 四月 02, 2024

*IR链接：*    [YDBRD-24509](https://jira.yasdb.com/browse/YDBRD-24509?src=confmacro)    *-*  *过程体和匿名块支持CTE语法功能*  *设计中*

*SR链接：*    [YDBRD-29068](https://jira.yasdb.com/browse/YDBRD-29068?src=confmacro)    *-*  *PL语言中静态SQL支持CTE语法*  *编码完成*

  


##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

​	源于博时基金市场需求，主要针对存储过程静态SQL支持CTE语法功能。

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能1|静态支持CTE语法|解析和重构CTE语句，保证能正常进入校验流程。|是|是|
|功能2|CURSOR支持CTE语法|隐式游标、静态游标、动态游标、系统游标均能支持CTE语句解析。|是|是|
|性能|性能场景1||是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|安全|安全场景1|----|是/否|是/否|
|易用性|----|----|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|兼容性|----|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|无||||


###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|soReStructCteHead|解析静态SQL的CTE语法subquery_factoring_clause：WTIH cte_name1(columns) AS (SELECT 1 FROM  DUAL ), cte_name2(columns)AS (SELECT 1 FROM  DUAL ), ...|CTE 的subquery_factoring_clause部分，指可以复用的CTE查询结果集。|是|
|soReStructCursorCte|解析静态SQL的CTE语法 select_clause：SELECT col INTO resultSet FROM cte_name1;|可使用上述CTE作为TABLE进行查询的SELECT子句。|是|
|soReStructCursorCte|解析游标的CTE语法|----|是|
|高级包|高级包子对象描述|----|是/否|
|系统视图|视图域段描述|----|是/否|
|动态视图|视图域段描述|----|是/否|
|配置参数|配置参数作用、生效方式|----|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|
|错误码|错误码、ACTION描述|----|是/否|
|告警|告警描述|----|是/否|
|日志|日志触发条件、等级、事件描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

1. CTE语法在PLSQL中使用的约束：
    1. 作为游标的结果集，不允许出现into关键字（oracle语法上支持，功能上未实现）。
    1. 所有位置已变量优先；
1. 目前对于非法table的报错，都为invalid variant name， oracle为invalid table name；
1. CTE语法暂未实现递归用法；


##   [4. 特性](#4-特性)  

语法图

![](https://pingcode.yasdb.com/atlas/files/public/67396cd4a1ad9a3311dc8d09/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBZ0FBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM3MzAsImV4cCI6MTc4MjMxNDUzMH0._-DoLxFU5hr_CJhEJwHsHdGpPvMXkfX31DjaFQf5F8c)

![](https://pingcode.yasdb.com/atlas/files/public/67396cd48970c2af4f520e99/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBSUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBZ0FBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM3MzAsImV4cCI6MTc4MjMxNDUzMH0._-DoLxFU5hr_CJhEJwHsHdGpPvMXkfX31DjaFQf5F8c)

5. Testcases（自测用例）

|静态SQL|说明|结果|
|---|---|---|
|declare    
  so2_var_cte int;    
  begin    
  with cte as (select 99 from sys.dual) select * into so2_var_cte from cte;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|正确用例|成功|
|declare    
  so2_var_cte int;    
  begin    
  with cte(a) as (select 1 from sys.dual select a into so2_var_cte from cte;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|缺少括号|失败|
|declare    
  so2_var_cte int;    
  begin    
  with cte cte as (select 1 from sys.dual) select a into so2_var_cte from cte;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|多个cte 名称|失败|
|declare    
  so2_var_cte int;    
  begin    
  with cte as as (select 1 from sys.dual) select a into so2_var_cte from cte;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|多个AS关键字|失败|
|declare    
  so2_var_cte int;    
  begin    
  with cte as (select 1 from sys.dual), (select 2 from sys.dual) select a into so2_var_cte from cte;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|多个缺少cte 名称的query|失败|
|declare    
  so2_var_cte int;    
  begin    
  with cte1 (a) as (select 1 from sys.dual),    
  with cte2 (b) as (select 2 from sys.dual)    
  select * into so2_var_cte from cte2;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|每个cte都用with声明|失败|
|declare    
  so2_var_cte int;    
  begin    
  with cte1 (a) as (select 1 from sys.dual),    
  cte2 (b) as (select 2 from sys.dual),    
  select * into so2_var_cte from cte2;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|多余逗号，紧跟select子句|失败|
|declare    
  so2_var_cte int;    
  begin    
  with cte1 (a) as (select 1 from sys.dual),    
  cte2 (b) as (select 2 from sys.dual),    
  cte3 (a) as (select 3 from sys.dual)    
  select * into so2_var_cte from cte3;    
  DBMS_OUTPUT.PUT_LINE(so2_var_cte);    
  end;    
  /|三个正确语法的cte|成功|


|游标SQL|说明|结果|
|---|---|---|
|declare    
  begin    
  FOR cur IN (with cte as (select 1 from sys.dual) select * from cte) LOOP    
  NULL;    
  END LOOP;    
  end;    
  /|缺少cte columns的正确语法|成功|
|declare    
  begin    
  FOR cur IN (with cte(a) as (select 1 from sys.dual) select a from cte) LOOP    
  NULL;    
  END LOOP;    
  end;    
  /|包含cte columns的正确语法|成功|
|declare    
  begin    
  FOR cur IN (with cte(a as (select 1 from sys.dual select a from cte) LOOP    
  NULL;    
  END LOOP;    
  end;    
  /|缺少括号|失败|
|declare    
  begin    
  FOR cur IN     
  (with cte1 (a) as (select 1 from sys.dual),    
  cte2 (b) as (select 2 from sys.dual),    
  select * from cte2    
  ) LOOP    
  NULL;    
  END LOOP;    
  end;    
  /|存在多余逗号，select作为cte 名称|失败|
|declare    
  begin    
  FOR cur IN (select (with cte as (select 1 from sys.dual) select * from sys.dual) from sys.dual) LOOP    
  NULL;    
  END LOOP;    
  end;    
  /|cte作为columns查询|成功|


|种类|SQL|
|---|---|
|隐式游标|declare    
  begin    
  FOR file IN (with cte(a) as (select 1 from sys.dual) select a from cte) LOOP    
  NULL;    
  END LOOP;    
  end;    
  /|
|显示（静态）游标|DECLARE    
  CURSOR c1(id INT) IS with cte(a) as (select 1 from sys.dual) select a,id from cte;    
  resultStr VARCHAR(200);    
  BEGIN    
  FOR v_sal IN c1(2) LOOP    
  resultStr := resultStr||v_sal.a||    [v_sal.id](http://v_sal.id)    ;    
  DBMS_OUTPUT.PUT_LINE(resultStr);    
  END LOOP;    
  END;    
  /|
|动态游标（静态SQL\  ~~动态SQL~~  ）|DECLARE    
  TYPE cursor IS REF CURSOR;    
  cur cursor;    
  TYPE record1 IS RECORD (    
  c1 int    
  );    
  rec1 record1;    
  BEGIN     
  OPEN cur FOR with cte(a) as (select 1 from sys.dual) select a from cte;    
  FETCH cur INTO rec1;    
  DBMS_OUTPUT.PUT_LINE(rec1.c1 );    
  CLOSE cur;    
  END;    
  /|
|系统游标|declare    
  a sys_refcursor;    
  a1 a%type;    
  TYPE AR IS RECORD (    
  f1 int    
  );    
  b AR;    
  begin    
  open a for with cte(c) as (select 1 from sys.dual) select c from cte;    
  a1 := a;    
  fetch a1 into b;    
  dbms_output.put_line(b.f1);    
  close a;    
  end;    
  /|


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-4-1_16-16-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDQ4OTcwYzJhZjRmNTIwZTk4IiwicmVmX2lkIjoiNjczOTZjZDQ3MjgyMDZlZmI5MmYxNzI1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzNzMwLCJleHAiOjE3ODIzOTAxMzB9.SkVR15ja-S5FJlX7w6X21ML4iGEg0k7-QViYD_jdoVQ)

 (image/png)    
