Created by 张欣, last modified on 四月 18, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

动态SQL是在编译时不能确定SQL的语句，在过程体执行时才获取具体的SQL语句，然后根据语句进行编译、执行、赋值动作。

使用动态SQL的场景：

1. SQL语句在编译时不能确定。比如WHERE子句条件的具体值。
1. 静态SQL不支持的语句。比如DDL。


IR：NA

交付版本：  22.2，23.1，23.2

交付范围：单机，集群，分布式（只支持匿名块）

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

表2-1

|  
|sql类型|into_clause|using_clause|备注|关联的IR|关联的SR|
|---|---|---|---|---|---|---|
|EXECUTE IMMEDIATE|DDL|/不支持|/不支持|SQL解析 后续新增的DDL语法 特殊的要覆盖，如 dblink,create type相关，分区表|  
|  
|
|  
|SELECT （单行结果）|into   *out_para(*  不可指定out,in out关键字  *)*|using   *in_para（*  不可以是in out  *）*|支持cte,闪回查询关注下|  
|  
|
|  
|SELECT （多行结果）|bulk collection into    *out_para*|using   *in_para*|  
|  
|  
|
|  
|DML|/不支持|using   *in_para（*  可以是in out,不能是out  *）*|  
|  
|  
|
|  
|DML + return into（静态SQL的return）|/不支持|using   *in_para（*  可以是in out,不能是out  *）*|当前只支持insert into return,dynamic_returning_clause- return into   *out_para*  (此处无需指定out  * 默认out) yashan还不支持*,直接into 语法错误|  
|  
|
|  
|匿名块执行|/不支持|using   *in_para（*  可以是in out,不能是out  *）*,如果是into :x1,using out,in out|声明单元和执行单元都可以传绑定变量,执行单元支持DDL,DML,SELECT,过程体调用，匿名块(动态执行嵌套),内置高级包,绑定参数位置 也支持指定in out等方向|  
|  
|
|  
|带形参的过程体调用|/不支持,(udf) into   *out_para 不支持*|using [in/out/in out] para|传入参数模式和形参定义的模式需要匹配,数据类型需要能够兼容|  
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
|内置高级包的形参（有的有方向）|  
|  
|  
|  
|  
|
|  
|内置函数|  
|  
|  
|  
|  
|
|  
|table函数|  
|  
|  
|  
|  
|
|游标|游标参数,for 循环+游标（带参数）|/不支持|using [in/out/in out] para|传入参数模式和形参定义的模式需要匹配,数据类型需要能够兼容,过程体形参 - 传给游标的形参 +using 绑定参数|  [YDBRD-6115](https://jira.yasdb.com/browse/YDBRD-6115?src=confmacro)    -  【2022.2】FOR循环语句支持游标  完成|  [YDBRD-6602](https://jira.yasdb.com/browse/YDBRD-6602?src=confmacro)    -  【22.2】【单机HEAP】FOR循环支持游标  完成,  [YDBRD-6604](https://jira.yasdb.com/browse/YDBRD-6604?src=confmacro)    -  【22.2】【单机HEAP】FOR循环支持显式游标  完成|
|  
|游标 select 语句中传绑定变量|  
|  
|  
|  
|  
|
|游标open 动态sql|open cursor for   **动态sql **|/不支持|using   *in_para *  （只能是in,不能是in out）|只能是查询，支持cte,可以在查询任何位置|  [YDBRD-6148](https://jira.yasdb.com/browse/YDBRD-6148?src=confmacro)    -  【2022.2】支持动态游标，open游标动态绑定sql语句  完成|  [YDBRD-6149](https://jira.yasdb.com/browse/YDBRD-6149?src=confmacro)    -  【22.2】open游标动态绑定sql语句  完成|
|  
|for 循环使用动态sql ， select 语句中传绑定变量|  
|/|  
|  
|  
|
|游标变量|绑定参数传游标变量|  
|  
|过程体形参,赋值,open ? for select ?|  
|  
|
|DBMS_SQL （未转测）|  
|  
|  
|  
|  
|  
|


动态执行语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396ce3a1ad9a3311dc8d61/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBZ0FBQUFBQUVBQkFBQkFBQUFDQUFBQUFBQWdBQUFBQUFRQVFBSUFBQUFBQUFJSUlBSUFBQUFBQ0FBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFDQUFBaEFBRUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFRQUFBSUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ0MjcsImV4cCI6MTc4MjMxNTIyN30.t2xBDiQHgJL7K7wVgs5zGnp4xTUEgnxXUttBhCKDjAE)

区分静态SQL的return 和 动态SQL的return：

![](https://pingcode.yasdb.com/atlas/files/public/67396ce38970c2af4f520ef1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBZ0FBQUFBQUVBQkFBQkFBQUFDQUFBQUFBQWdBQUFBQUFRQVFBSUFBQUFBQUFJSUlBSUFBQUFBQ0FBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFDQUFBaEFBRUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFRQUFBSUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ0MjcsImV4cCI6MTc4MjMxNTIyN30.t2xBDiQHgJL7K7wVgs5zGnp4xTUEgnxXUttBhCKDjAE)

![](https://pingcode.yasdb.com/atlas/files/public/67396ce3a1ad9a3311dc8d62/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBZ0FBQUFBQUVBQkFBQkFBQUFDQUFBQUFBQWdBQUFBQUFRQVFBSUFBQUFBQUFJSUlBSUFBQUFBQ0FBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFDQUFBaEFBRUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFRQUFBSUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ0MjcsImV4cCI6MTc4MjMxNTIyN30.t2xBDiQHgJL7K7wVgs5zGnp4xTUEgnxXUttBhCKDjAE)

动态SQL的return into跟静态SQL的return col into 结合使用，样例：

  点击此处展开...

create     table   tb_DynamicSQL_065(c1 int,c2   varchar  (  200  ));    
  insert     into   tb_DynamicSQL_065   values  (  1  ,  'test'  );    
  commit  ;

  
  declare    
  a int;    
  v_sql   varchar  (  2000  );    
  begin    
    v_sql   :=     'insert into tb_DynamicSQL_065(c1) values(2) return c1 into :x1 '  ;    
      execute immediate   v_sql   return     into   a;    
      dbms_output.  put_line  (a);    
  end  ;    
  /

  


静态SQL的return跟在DML后面，return列或者列表达式。静态SQL的return into 可以跟record，此处可以做列展开； 但是如果把静态SQL的return into 放在动态语句中执行，动态语句中无法做列展开。

例子：

  点击此处展开...

declare    
  a tb1%rowtype ;    
  begin    
  execute immediate 'insert into tb1 values (:x1,:x2 ) return c1,c2 into   :x3,:x4  ' using 4,'c' return into a ;    
  dbms_output.put_line(a.c1);    
  end;    
  /

4

PL/SQL procedure successfully completed.

declare    
  a tb1%rowtype ;    
  begin    
  execute immediate 'insert into tb1 values (:x1,:x2 ) return c1,c2 into   :x3  ' using 4,'c' return into a ;    
  dbms_output.put_line(a.c1);    
  end;    
  /

declare    
  *    
  ERROR at line 1:    
  ORA-01006: bind variable does not exist    
  ORA-06512: at line 4

  


动态SQL的return into,中间不加表达式或者其他内容，传回动态SQL的执行结果给变量。

过程体形参模式和传入实参方向的匹配测试：

表2-2

|形参\实参|in|out|in out|
|---|---|---|---|
|in|√|x|√|
|out|x|√|√|
|in out|x|x|√|


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

3.1 execute规格：

1. SQL语句中每个绑定变量的占位符（格式是':1'或'?'），都需要有对应的绑定变量在USING子句。
1. 如果是SELECT语句，返回一行数据需要有into子句。如果返回多行数据，需要有BULK COLLECTION INTO 子句（23.2合入）。
1. **如果是DML语句且包含RETURNING子句，在RETURNING INTO子句中放OUT的变量**  。
1. 如果匿名块中程序调用，参数的绑定变量要和USING子句中变量的类型和方向匹配。
1. 在非自治事务的查询语句中，不能动态执行DDL或事务语句。
1. EXPLAIN语句不执行语句，且不能有into的变量。
1. USING中不能使用非SQL类型 必须是sql支持的数据类型（持久化的？）（  不能使用index by string类型（还不支持）  ，可以用package里的类型）；
1. **字符串是SQL引擎能直接编译和执行的语法**  。
1. INTO/USING/RETURN三个子句是有顺序的。
1. 绑定变量不能传NULL，如需传NULL,可以通过传入一个未初始化的变量;
1. 动态语句是select，不使用into 实际不会执行；
1. oracle 文档中描述 如果绑定参数数据类型是集合或记录类型，则必须在包规范中声明它。local udt, record type必须是pkg中预定义过的公有类型。


object type,pkg.record type yashan 当前处理还有bug，会core

|oracle|  
|
|---|---|
|--01   oracle不支持动态语句中使用local record,  点击此处展开...,CREATE OR REPLACE PACKAGE pkg AUTHID DEFINER AS    
  TYPE rec IS RECORD (n1 NUMBER, n2 NUMBER);    
  PROCEDURE p (x OUT rec, y NUMBER, z NUMBER);    
  END pkg;    
  /    
  CREATE OR REPLACE PACKAGE BODY pkg AS    
  PROCEDURE p (x OUT rec, y NUMBER, z NUMBER) AS    
  BEGIN    
  x.n1 := y;    
  x.n2 := z;    
  END p;    
  END pkg;    
  /,DECLARE    
  r pkg.rec;    
  dyn_str VARCHAR2(3000);    
  BEGIN    
  dyn_str := 'BEGIN pkg.p(:x, 6, 8); END;';    
  EXECUTE IMMEDIATE dyn_str USING OUT r;    
  DBMS_OUTPUT.PUT_LINE('r.n1 = ' || r.n1);    
  DBMS_OUTPUT.PUT_LINE('r.n2 = ' || r.n2);    
  END;    
  /,  
  DECLARE    
  TYPE rec IS RECORD (n1 NUMBER, n2 NUMBER);    
  r rec;    
  dyn_str VARCHAR2(3000);    
  BEGIN    
  dyn_str := 'BEGIN pkg.p(:x, 6, 8); END;';    
  EXECUTE IMMEDIATE dyn_str USING OUT r;    
  DBMS_OUTPUT.PUT_LINE('r.n1 = ' || r.n1);    
  DBMS_OUTPUT.PUT_LINE('r.n2 = ' || r.n2);    
  END;    
  /,![](https://pingcode.yasdb.com/atlas/files/public/67396ce38970c2af4f520ef2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBZ0FBQUFBQUVBQkFBQkFBQUFDQUFBQUFBQWdBQUFBQUFRQVFBSUFBQUFBQUFJSUlBSUFBQUFBQ0FBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFDQUFBaEFBRUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFRQUFBSUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ0MjcsImV4cCI6MTc4MjMxNTIyN30.t2xBDiQHgJL7K7wVgs5zGnp4xTUEgnxXUttBhCKDjAE)|  
|
|--02  oracle支持动态语句中使用object type  ,  点击此处展开...,create or replace TYPE obj_type IS object (n1 NUMBER, n2 NUMBER);    
  /,create or replace PROCEDURE p (x   IN OUT   obj_type, y NUMBER, z NUMBER) AS    
  BEGIN    
  x.n1 := y;    
  x.n2 := z;    
  END;    
  /    
    
  DECLARE    
  r obj_type :=obj_type (1,1);    
  dyn_str VARCHAR2(3000);    
  BEGIN    
  dyn_str := 'BEGIN p(:x, 6, 8); END;';    
    
  EXECUTE IMMEDIATE dyn_str USING IN OUT r;    
    
  DBMS_OUTPUT.PUT_LINE('r.n1 = ' || r.n1);    
  DBMS_OUTPUT.PUT_LINE('r.n2 = ' || r.n2);    
  END;    
  /,![](https://pingcode.yasdb.com/atlas/files/public/67396ce3a1ad9a3311dc8d63/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBZ0FBQUFBQUVBQkFBQkFBQUFDQUFBQUFBQWdBQUFBQUFRQVFBSUFBQUFBQUFJSUlBSUFBQUFBQ0FBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFDQUFBaEFBRUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFRQUFBSUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ0MjcsImV4cCI6MTc4MjMxNTIyN30.t2xBDiQHgJL7K7wVgs5zGnp4xTUEgnxXUttBhCKDjAE),  
|  
|
|--03 嵌套表，varray类型是非pkg中定义的 也可以使用,  点击此处展开...,CREATE TYPE names IS TABLE OF VARCHAR2(10);    
  /    
    
  CREATE OR REPLACE PROCEDURE print_names (x names) IS    
  BEGIN    
  FOR i IN x.FIRST .. x.LAST LOOP    
  DBMS_OUTPUT.PUT_LINE(x(i));    
  END LOOP;    
  END;    
  /,DECLARE    
  fruits names;    
  dyn_stmt VARCHAR2(3000);    
  BEGIN    
  fruits := names('apple', 'banana', 'cherry');    
    
  dyn_stmt := 'BEGIN print_names(:x); END;';    
  EXECUTE IMMEDIATE dyn_stmt USING fruits;    
  END;    
  /,  
,![](https://pingcode.yasdb.com/atlas/files/public/67396ce38970c2af4f520ef3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQ0FBQUFBZ0FBQUFBQUVBQkFBQkFBQUFDQUFBQUFBQWdBQUFBQUFRQVFBSUFBQUFBQUFJSUlBSUFBQUFBQ0FBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFnQUFBQVFBQUFBQUFBZ0FBQUFBQUFBQUFDQUFBaEFBRUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFRQUFBSUFBUUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ0MjcsImV4cCI6MTc4MjMxNTIyN30.t2xBDiQHgJL7K7wVgs5zGnp4xTUEgnxXUttBhCKDjAE)|  
|


3.2 限制：

execute immediate 现在还不支持   dynamic_returning_clause；

  


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*4.1需求本身的主要应用场景*

1.编译阶段：

1)编译动态执行的字符串、字符串变量或字符串表达式（常见的如拼接）。

**变量类别**  ：cursor参数（只能在cursor中使用 ？）、BLOCK参数（for 循环中的index变量）、声明参数、函数入参、  ~~默认变量（object方法self变量）~~  、全局变量（pkg中的公有变量）

**变量形式**  ：

标量（字符类型或者能转成字符类型），

**record**   （成员）,

单层UDT（成员或元素）: object,varray/array,nested table; 

复合类型（最终元素是标量类型）：record.f, record.f.f , record.f(i), record.f(i).f, record.f.f(i), 

object.f,object.f.f, object.f(i), object.f(i).f, object.f.f(i)

varray(i), varray(i).f, varray(i).v(j), varray(i).f.f, varray(i).v(j).f

nstb(i), nstb(i).f, nstb(i).v(j), nstb(i).f.f, nstb(i).v(j).f

2)编译  INTO子句。保存赋值的标识符。

3)编译USING子句。保存in的标识符。

4)编译RETURN子句。

2.执行阶段

主要涉及变量替换，类型检测

**using传入的变量类型：**

表4-1

|标量|游标变量|block变量||全局 有toid的UDT,（sql）支持的|pkg 定义的全局类型|local udt,record|匿名UDT|默认变量|常量|游标形参|过程体形参|表达式|||||异常变量|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|单个标量，表达式|弱类型,强类型|for i in loop,(int类型)|for循环+游标,for   **record**   in ..,forall   **i**   in   rec  .  FIRST     ..     rec  .  LAST,(varray)|object/varray/nested table|pkg.record type/pkg.varray type/pkg.nestb type|object/varray/nested table,record|数组函数返回值|object方法self变量|标量常量，constant，,常量表达式,特殊值：rownum,rowid,null等|标量/udt/record|标量/udt/record/游标变量|变量表达式（算数，拼接，逻辑）|内置函数表达式|udf()，,udt方法|内置高级包表达式|udt,record 构造函数表达式|  
|
|支持|支持,游标变量带状态：open/fetch|  
|  
|支持|支持|不支持|做in类型的时候，部分场景支持|  
|只有in类型绑定变量位置可以传常量|作用范围只在游标语句中,带方向|带方向|  
|  
|  
|  
|  
|不支持|


**替换类型：**

**表4-2**

|  
|  
|  
|例子|
|---|---|---|---|
|select into    
    
|PARAM => SOVAR|动态语句-静态SQL,动态语句-匿名块,动态语句多层嵌套|execute immediate 'select :x1 from dual' into a using b;,execute immediate 'declare b int; begin select :x1 into b from tb1; dbms_output.put_line(b); end; ' using a ;,execute immediate 'declare a int; b int := 9; begin execute immediate ''select :x1 from dual'' into a using b;  end;';|
||COLUMN => PARAM|动态语句-匿名块,动态语句多层嵌套|execute immediate 'begin select c1 into :x1 from tb1 ; end; ' using out a ;,execute immediate 'begin execute immediate ''select c1 from tb1'' into :x1; end; ' using out a ;|
||PARAM => PARAM|动态语句-匿名块,动态语句多层嵌套|execute immediate 'begin select :x1 into :x2 from tb1 ; end; 'using a , out b ;,execute immediate 'declare a int := 12; begin execute immediate ''select :1 from dual'' into :x1 using a ; dbms_output.put_line(a); end; ' using out a ;|
|select bulk collection into |  
|  
|  
|
|insert into return    
    
|PARAM => SOVAR|动态语句-匿名块,动态语句多层嵌套|execute immediate 'declare a int :=11; begin insert into tb2 values(3,''aaa'') return :1 into a; end; ' using a ;|
||COLUMN => PARAM|动态语句-静态SQL,动态语句-匿名块,动态语句多层嵌套|execute immediate 'insert into tb2(c1) values( :x ) return c1 into :y' using 5,in out a;,execute immediate 'begin insert into tb2(c1) values( :x ) return c1 into :y; end;' using 5,in out a;|
||PARAM => PARAM|动态语句-静态SQL,动态语句-匿名块,动态语句多层嵌套|execute immediate 'insert into tb2(c1) values( :x ) return :x1+1 into :x2' using 5,a,out b;,execute immediate 'declare a int; begin insert into tb2 values(3,''aaa'') return :1 into :x2; end; ' using a, out b ;|
|赋值：  A := B;|SOVAR =>PARAM|动态语句-匿名块,动态语句多层嵌套|execute immediate 'declare a int :=3 ; begin :x1 := a; end;' using out b;,execute immediate 'declare a int :=3 ;b int; begin execute immediate ''declare a int :=5 ;begin :x1 := a; end;'' using out b; end;';|
||PARAM => SOVAR|动态语句-匿名块,动态语句多层嵌套|execute immediate 'declare a int :=3 ; begin a:= :x1;  end;' using 9;,execute immediate 'declare b int := 80;begin execute immediate ''declare a int :=3 ; begin a := :x2;  end;'' using in out b; dbms_output.put_line(b); end;';|
||PARAM => PARAM|动态语句-匿名块,动态语句多层嵌套|execute immediate 'begin :x1 := :x2; end;' using out b,a;,execute immediate 'declare a int :=3 ;b int;begin execute immediate ''begin :x1 := :x2; end;'' using out b,a; end;';|
|A := funciton();    
    
|SOVAR =>PARAM|动态语句-匿名块,动态语句多层嵌套|execute immediate 'declare a int :=3 ; begin :x1 := udf_exec_01(1,a); end;' using out b;,execute immediate 'declare a int :=3 ; b int; begin execute immediate ''declare a int :=5 ;begin :x1 := udf_exec_01(1,a); end;'' using out b; end;';|
|  
|PARAM => SOVAR|动态语句-匿名块,动态语句多层嵌套|execute immediate 'declare a int :=3 ; begin a := udf_exec_01(1,:x1); end;' using in out b;,execute immediate 'declare a int :=3 ;b int:= 2;begin execute immediate ''declare a int :=5 ; begin a := udf_exec_01(:x1,:x2); end;'' using a,in out b; end;';|
|  
|PARAM => PARAM|动态语句-匿名块,动态语句多层嵌套|execute immediate 'declare a int :=5 ; begin :z1 := udf_exec_01(:x1,:x2); end;' using out a,a,in out b;,execute immediate 'declare a int :=3 ;b int:= 2;begin execute immediate ''declare a int :=5 ; begin :z1 := udf_exec_01(:x1,:x2);  end;'' using out a,a,in out b;end;';|
|USING子句|  
|上述的动态语句多层嵌套场景下都可能用到|declare    
  c int := 27;    
  begin    
  execute immediate 'declare a int :=3 ;b int:= 2; begin execute immediate ''declare a int :=5 ; begin :z1 := udf_exec_01(:x1,:x2); dbms_output.put_line(a); end;'' using out a,a ,in out :y;end;' using in out c;    
  end;    
  /|
|RETURN  into_clause 不支持|  
|  
|  
|
|3.7补充场景|  
|  
|  
|
|存储过程调用|调用一个,调用多个 |  
,入参有in out方向；入参使用相同的变量（有关联）|  
|
|execute 的内容用绑定参数传入|execute immediate :x1|无绑定参数,有绑定参数：using IN，  using OUT|  
|
|  
|open cursor :x1|无绑定参数,有绑定参数：using IN，  using OUT|  
|
|变量默认值|声明变量默认值|  
|  
|
|  
|形参默认值 – 不支持|  
|  
|
|  
|cursor参数默认值|  
|  
|
|UDT构造函数 形参传绑定参数|  
|  
|  
|
|varray定义 varray(:x1) of xx 不支持|  
|  
|  
|
|流程控制|IF/ELSIF条件|  
|  
|
|  
|FOR/FORALL索引|  
|  
|
|  
|CASE/WHEN条件|  
|  
|
|  
|WHILE条件|  
|  
|
|  
|CONTINUE条件|  
|  
|
|  
|EXIT条件|  
|  
|


  


3.其他

1）重名的绑定参数标识符

oracle规格：

如果execute 执行的是静态SQL，绑定参数根据位置传入，忽略同名的标识符；

如果execute 执行的是匿名块或者过程体调用，每个唯一的占位符名称必须在USING子句中有一个相应的绑定变量。如果重复占位符名称，则不需要重复其对应的绑定变量。

2）特殊的：ddl对象是当前过程体，当前过程体依赖的对象

  


*4.2需求与其他特性的关联场景*

1)权限

动态执行DDL,DML 访问对象的权限；

execute peocedure的权限；

using pkg.var,pkg的访问权限

2）HA

备机部分操作没有权限DDL,DML 

3）分布式

  


  


4.3相关的历史问题单

|问题关键字|概要|问题类型|分类|是否加固过|问题场景|根因分析|
|---|---|---|---|---|---|---|
|  [YDBRD-25415](https://jira.yasdb.com/browse/YDBRD-25415?src=confmacro)    -  【质量加固】【 动态SQL 】绑定参数为record变量，同时作为参数使用core在了soInitVarlenRef  解决关闭|绑定参数为record变量，同时作为参数使用|  
|  
|  
|  
|  
|
|YDBRD-23722|【plsql】plsql中循环执行1000ci alter 带default，sql报错YAS-04213 expression expected|  
|  
|  
|动态语句|在表列默认值为var时编译阶段将其信息存入def->defaultText.value时，用的浅拷贝。在plsql中如果parse和exec使用不同的stmt时（forkstmt），原来空间被清空。|
|  [YDBRD-24940](https://jira.yasdb.com/browse/YDBRD-24940?src=confmacro)    -  【质量加固】【自提单】动态sql使用into语句时，未检测using子句中包含out参数  解决关闭|【质量加固】【自提单】动态sql使用into语句时，未检测using子句中包含out参数|  
|  
|  
|  
|动态sql包含into语句时，未检查using参数中是否包含out方向的参数，未报错|


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.说明测试设计的整体思路，明确测试范围，规格限制。可以使用流程图、逻辑覆盖等方法体现测试思路。*

*2.关键数据、测试场景的构造方法，用例自动化方法，可能涉及的测试框架说明。*

*3.关联特性：如导入导出、审计、权限等*

*涉及新增数据库语法，需要考虑系统权限和系统审计；*

*涉及数据库对象的特性测试，需要考虑对象级权限、对象级审计、导入导出、对象安全访问和主备同步实现；*

*涉及新增数据类型，需要考虑在已支持的各类场景和对象中使用、导入导出等；*

*4.分布式、集群、列表不支持的特性，需要考虑补充拦截用例*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力*

*1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；*

*2.执行表达式和算子类的特性需求，需要考虑性能；*

*3.主备、容灾、存储等的特性需求，需要考虑可靠性；*

*4.外部常用语法、基础功能要考虑增加稳定性用例；*

*5.所有特性均需要考虑可维、可测，可要求研发提供必要的视图。*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略*

*测试框架满足度*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

## Attachments:

[image2024-1-8_18-41-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTJhMWFkOWEzMzExZGM4ZDViIiwicmVmX2lkIjoiNjczOTZjZTI3MjgyMDZlZmI5MmYxN2Y1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NDI3LCJleHAiOjE3ODIzOTA4Mjd9.8tzpQKdOblJXDgRPuIMKBh7YDUyUi2vrZ_WnvrDEP1A)

 (image/png)    


[image2024-1-8_18-46-16.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTI4OTcwYzJhZjRmNTIwZWViIiwicmVmX2lkIjoiNjczOTZjZTI3MjgyMDZlZmI5MmYxN2Y1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NDI3LCJleHAiOjE3ODIzOTA4Mjd9.HodnlUNJdXr-hHysiTdRuZ4NQ62_uualBYD_C2hHYP0)

 (image/png)    


[image2024-1-8_19-0-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZTI4OTcwYzJhZjRmNTIwZWVlIiwicmVmX2lkIjoiNjczOTZjZTI3MjgyMDZlZmI5MmYxN2Y1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NDI3LCJleHAiOjE3ODIzOTA4Mjd9.4jp87ASJttc62Vpcqo9RqbM5Krv6digYOQ1pMnBMIiQ)

 (image/png)    
