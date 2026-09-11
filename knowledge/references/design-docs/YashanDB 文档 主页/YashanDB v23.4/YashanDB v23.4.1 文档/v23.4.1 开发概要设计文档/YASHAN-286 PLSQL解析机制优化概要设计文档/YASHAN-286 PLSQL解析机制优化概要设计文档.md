Created by 王海峰, last modified on 十一月 15, 2024

概要设计-YASHAN-286 【CCB转需求】PLSQL解析机制优化

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b06e](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b06e)    ?    
  #YASHAN-286 【CCB转需求】PLSQL解析机制优化

##   [1. 总述](#1-总述)  

需求来源：O兼容性产生。在已发布版本POC过程中，对外场存储过程语言的修改，主要集中在过程体中的语句，要求存储过程中出现的局部变量名，不能和表的列名重名。原始需求来源为DML语句中词优先匹配表列，然后是变量。

需求分析：在PL/SQL语言中，在静态SQL和显式游标等功能中，对接SQL语句，会在PL编译器中，先进行预编译动作再送入SQL引擎编译。这样就产生优先匹配局部变量名、报错pos不符的问题。

功能概要描述：

（1）去除PL编译器中的预编译动作；

（2）遵循O兼容性语义，优先匹配SQL中的资源语义，如表的列名、序列名等，然后再匹配PL中的局部变量；

（3）维持原有写SQL的方式，使得报错POS可以匹配。

###   [1.1 需求来源](#11-需求来源)  

需求来源已描述，优化PLSQL解析机制，解决以下问题：

（1）PLSQL中，DML语句内的词优先匹配表中列，其次是变量；这是为了避免用户的PL程序产生O兼容性语义的修改。

（2）PLSQL中的DML语句在报错时，显示正确的行号和列号。这是为了能更准确的反应实际的出错位置，是可测试性和易用性的体现。

从需求描述上可以看出，该需求主要是解决特定场景问题的功能特性要求，性能、安全等各非功能质量属性要求少。而且本需求并不与部署形态绑定，主备(单机)、分布式、集群均支持，不区分行列。

###   [1.2 调研文档](#12-调研文档)  

该需求为O兼容性需求。在友商有相同的需求实现情况。功能情况描述分为以下几个场景：

|场景|调研用例|友商O表现|Yashan v23.3表现|
|---|---|---|---|
|静态SQL语句，访问表列与局部标量类型变量名相同|code  `create table tt1(a int); `  
  `insert into tt1 values(1);`  
  `declare`  
  `a char(10) := 'a';`  
  `begin`  
  `select a into a from tt1;`  
  `dbms_output.put_line(a);`  
  `end;`  
  `/`  |SQL语句中的同名优先匹配表的列资源,output  `SQL> create table tt1(a int);`  
  `表已创建。`  
  `SQL>`  
  `SQL> insert into tt1 values(1);`  
  `已创建 1 行。`  
  `SQL>`  
  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   begin`  
  `  4   select a into a from tt1;`  
  `  5   dbms_output.put_line(a);`  
  `  6   end;`  
  `  7   /`  
  `1`  
  `PL/SQL 过程已成功完成。`  |优先匹配局部变量名，导致兼容性评价很差|
|静态SQL语句，访问表名、别名等与局部标量类型变量名相同|code  `create table tt1(a1 int); `  
  `insert into tt1 values(1);`  
  `declare`  
  `a char(10) := 'a';`  
  `begin`  
  `select a1 a into a from tt1;`  
  `dbms_output.put_line(a);`  
  `end;`  
  `/`  |别名无影响，可正常执行,output  `SQL> create table tt1(a1 int);`  
  `表已创建。`  
  `SQL>  insert into tt1 values(1);`  
  `已创建 1 行。`  
  `SQL>`  
  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   begin`  
  `  4   select a1 a into a from tt1;`  
  `  5   dbms_output.put_line(a);`  
  `  6   end;`  
  `  7   /`  
  `1`  
  `PL/SQL 过程已成功完成。`  |表名、列名等位置不允许出现局部变量，报错|
|静态SQL语句，访问表的ADT列与局部UDT类型变量名相同|code  `drop table tt1;`  
  `create type col1 is object(a int, b int);`  
  `/`  
  `create table tt1(c col1); `  
  `insert into tt1 values(col1(1,1));`  
  `declare `  
  ` c col1 := col1(100,100); `  
  `begin `  
  ` select c into c from tt1; `  
  ` dbms_output.put_line(c.a); `  
  ` dbms_output.put_line(c.b); `  
  `end; `  
  `/ `  |SQL语句中的同名优先匹配表的列资源,output  `SQL> create type col1 is object(a int, b int);`  
  `  2  /`  
  `类型已创建。`  
  `SQL> create table tt1(c col1);`  
  `表已创建。`  
  `SQL> insert into tt1 values(col1(1,1));`  
  `已创建 1 行。`  
  `SQL>  declare`  
  `  2   c col1 := col1(100,100);`  
  `  3   begin`  
  `  4   select c into c from tt1;`  
  `  5   dbms_output.put_line(c.a);`  
  `  6   dbms_output.put_line(c.b);`  
  `  7   end;`  
  `  8   /`  
  `1`  
  `1`  
  `PL/SQL 过程已成功完成。`  |优先匹配局部变量名|
|静态SQL语句，访问表的ADT列中member成员名与局部UDT类型变量成员名相同|code  `create type col1 is object(a int, b int);`  
  `/`  
  `create table tt1(c col1); `  
  `insert into tt1 values(col1(1,1));`  
  `declare `  
  ` c col1 := col1(100,100); `  
  `begin `  
  ` select c.a, c.b+1 into c.a, c.b from tt1; `  
  ` dbms_output.put_line(c.a); `  
  ` dbms_output.put_line(c.b); `  
  `end; `  
  `/`  
  `select c.a, c.b+1 from tt1;`  |特殊用例，O无法直接通过SQL语句访问ADT列中的成员，所以局部变量呈现结果,output  `SQL> create type col1 is object(a int, b int);`  
  `  2  /`  
  `类型已创建。`  
  `SQL> create table tt1(c col1);`  
  `表已创建。`  
  `SQL> insert into tt1 values(col1(1,1));`  
  `已创建 1 行。`  
  `SQL> declare`  
  `  2   c col1 := col1(100,100);`  
  `  3  begin`  
  `  4   select c.a, c.b+1 into c.a, c.b from tt1;`  
  `  5   dbms_output.put_line(c.a);`  
  `  6   dbms_output.put_line(c.b);`  
  `  7  end;`  
  `  8  /`  
  `100`  
  `101`  
  `PL/SQL 过程已成功完成。`  
  `SQL> select c.a, c.b+1 from tt1;`  
  `select c.a, c.b+1 from tt1`  
  `            *`  
  `第 1 行出现错误:`  
  `ORA-00904: "C"."B": 标识符无效`  |相同|
|静态SQL语句中，投影表达式、Filter表达式、TABLE表达式等各标识符位置，使用了存储过程中的局部变量|code  `create table tt1(a int); `  
  `insert into tt1 values(1);`  
  `declare `  
  ` a1 int := 100;`  
  ` a  int := 1;`  
  `begin `  
  ` select a a1, a1 a into a, a1 from tt1 where a != a1; `  
  ` dbms_output.put_line(a); `  
  ` dbms_output.put_line(a1);`  

  ` a := 100;`  
  ` select a a1, a1 a into a, a1 from tt1 where a = a1;`  
  `end; `  
  `/`  |将局部变量转为绑定参数，可以在如V$SQL的视图中查询到转换后的语句,output  `SQL> declare`  
  `  2   a1 int := 100;`  
  `  3   a  int := 1;`  
  `  4  begin`  
  `  5   select a a1, a1 a into a, a1 from tt1 where a != a1;`  
  `  6   dbms_output.put_line(a);`  
  `  7   dbms_output.put_line(a1);`  
  `  8`  
  `  9   a := 100;`  
  ` 10   select a a1, a1 a into a, a1 from tt1 where a = a1;`  
  ` 11  end;`  
  ` 12  /`  
  `1`  
  `100`  
  `declare`  
  `*`  
  `第 1 行出现错误:`  
  `ORA-01403: 未找到任何数据`  
  `ORA-06512: 在 line 10`  
  `SQL> select sql_text from v$sql where sql_text like '%TT1%';`  
  `SQL_TEXT`  
  `--------------------------------------------------------------------------------`  
  `SELECT A A1, :B1 A FROM TT1 WHERE A != :B1`  
  `已选择 1 行。`  ,SQL在谓词部分要匹配过程体|相同|
|静态SQL语句类型包括 SELECT / INSERT / UPDATE / DELETE / MERGE 5种语句。其中SELECT语句具有[BULK COLLECT] INTO子句特殊处理|code  `create table tt1(a1 int); `  
  `insert into tt1 values(1);`  
  `declare`  
  `a char(10) := 'a';`  
  `begin`  
  `select a1 a into a from tt1;`  
  `dbms_output.put_line(a);`  
  `end;`  
  `/`  |[BULK COLLECT] INTO子句在SQL引擎中不可见,output  `SQL> create table tt1(a1 int);`  
  `表已创建。`  
  `SQL>  insert into tt1 values(1);`  
  `已创建 1 行。`  
  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   begin`  
  `  4   select a1 a into a from tt1;`  
  `  5   dbms_output.put_line(a);`  
  `  6   end;`  
  `  7   /`  
  `1`  
  `PL/SQL 过程已成功完成。`  
  `SQL> select sql_text from v$sql where sql_text like '%TT1%';`  
  `SQL_TEXT`  
  `--------------------------------------------------------------------------------`  
  `SELECT A1 A FROM TT1`  |相同|
|CURSOR显式游标带参数场景|code  `create table tt1(a int);`  
  `insert into tt1 values(1);`  
  `declare`  
  `type tt1_type is record(a int, b char(10));`  
  `cursor c1(t tt1_type) is select a, t.b from tt1;`  
  `t2 tt1_type;`  
  `begin`  
  `open c1(tt1_type(100, 'x'));`  
  `fetch c1 into t2;`  
  `dbms_output.put_line(t2.a);`  
  `dbms_output.put_line(t2.b);`  
  `close c1;`  
  `end;`  
  `/`  
  `declare`  
  `type tt1_type is record(a int, b char(10));`  
  `cursor c1(a int, b char) is select a, b from tt1;`  
  `t2 tt1_type;`  
  `begin`  
  `open c1(100, 'x');`  
  `fetch c1 into t2;`  
  `dbms_output.put_line(t2.a);`  
  `dbms_output.put_line(t2.b);`  
  `close c1;`  
  `end;`  
  `/`  |output  `SQL>  declare`  
  `  2   type tt1_type is record(a int, b char(10));`  
  `  3   cursor c1(t tt1_type) is select a, t.b from tt1;`  
  `  4   t2 tt1_type;`  
  `  5   begin`  
  `  6   open c1(tt1_type(100, 'x'));`  
  `  7   fetch c1 into t2;`  
  `  8   dbms_output.put_line(t2.a);`  
  `  9   dbms_output.put_line(t2.b);`  
  ` 10   close c1;`  
  ` 11   end;`  
  ` 12   /`  
  `1`  
  `x`  
  `PL/SQL 过程已成功完成。`  
  `SQL> declare`  
  `  2  type tt1_type is record(a int, b varchar(10));`  
  `  3  cursor c1(a int, b varchar) is select a, b from tt1;`  
  `  4  t2 tt1_type;`  
  `  5  begin`  
  `  6  open c1(100, 'x');`  
  `  7  fetch c1 into t2;`  
  `  8  dbms_output.put_line(t2.a);`  
  `  9  dbms_output.put_line(t2.b);`  
  ` 10  close c1;`  
  ` 11  end;`  
  ` 12  /`  
  `1`  
  `x`  
  `PL/SQL 过程已成功完成。`  |优先级匹配兼容性问题|
|非动态游标的SQL语句|code  `create table tt1(a int);`  
  `insert into tt1 values(1);`  
  `declare`  
  `a char(10) := 'a';`  
  `b char(10) := 'x';`  
  `cursor c1 is select a,b from tt1;`  
  `begin`  
  `open c1;`  
  `fetch c1 into a,b;`  
  `dbms_output.put_line(a);`  
  `dbms_output.put_line(b);`  
  `close c1;`  
  `end;`  
  `/`  |output  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   b char(10) := 'x';`  
  `  4   cursor c1 is select a,b from tt1;`  
  `  5   begin`  
  `  6   open c1;`  
  `  7   fetch c1 into a,b;`  
  `  8   dbms_output.put_line(a);`  
  `  9   dbms_output.put_line(b);`  
  ` 10   close c1;`  
  ` 11   end;`  
  ` 12   /`  
  `1`  
  `x`  
  `PL/SQL 过程已成功完成。`  |相同|
|游标OPEN SQL语句|code  `create table tt1(a int);`  
  `insert into tt1 values(1);`  
  `declare`  
  `a char(10) := 'a';`  
  `b char(10) := 'x';`  
  `c1 sys_refcursor;`  
  `begin`  
  `open c1 for select a,b from tt1;`  
  `fetch c1 into a,b;`  
  `dbms_output.put_line(a);`  
  `dbms_output.put_line(b);`  
  `close c1;`  
  `end;`  
  `/`  |output  `SQL> declare`  
  `  2  a char(10) := 'a';`  
  `  3  b char(10) := 'x';`  
  `  4  c1 sys_refcursor;`  
  `  5  begin`  
  `  6  open c1 for select a,b from tt1;`  
  `  7  fetch c1 into a,b;`  
  `  8  dbms_output.put_line(a);`  
  `  9  dbms_output.put_line(b);`  
  ` 10  close c1;`  
  ` 11  end;`  
  ` 12  /`  
  `1`  
  `x`  
  `PL/SQL 过程已成功完成。`  |优先级匹配兼容性问题|
|FOR语句IN（SELECT语句）|code  `create table tt1(a int);`  
  `insert into tt1 values(1);`  
  `declare`  
  `a char(10) := 'a';`  
  `b char(10) := 'x';`  
  `begin`  
  `for i in (select a,b from tt1) loop`  
  `dbms_output.put_line(i.a);`  
  `dbms_output.put_line(i.b);`  
  `end loop;`  
  `end;`  
  `/`  |output  `SQL> declare`  
  `  2  a char(10) := 'a';`  
  `  3  b char(10) := 'x';`  
  `  4  begin`  
  `  5  for i in (select a,b from tt1) loop`  
  `  6  dbms_output.put_line(i.a);`  
  `  7  dbms_output.put_line(i.b);`  
  `  8  end loop;`  
  `  9  end;`  
  ` 10  /`  
  `1`  
  `x`  
  `PL/SQL 过程已成功完成。`  |优先级匹配兼容性问题|
|FORALL语句出现的SQL语句|code  `create table tt1(a int);`  
  `insert into tt1 values(1);`  
  `declare`  
  `type numlist is table of int;`  
  `a numlist := numlist(2,3,4);`  
  `begin`  
  ` forall i in 1..3`  
  `    insert into tt1(a) values(a(i));`  
  `end;`  
  `/`  
  `select * from tt1;`  
  `declare`  
  `type numlist is table of int;`  
  `a numlist := numlist(2,3,4);`  
  `begin`  
  ` forall i in 1..3`  
  `    insert into tt1(a) select a from tt1 where a = a(i);`  
  `end;`  
  `/`  
  `select * from tt1;`  
  `truncate table tt1;`  
  `insert into tt1 values(1);`  
  `declare`  
  `type numlist is table of int;`  
  `a1 int := 1000;`  
  `n numlist := numlist(1,2,3,4);`  
  `begin`  
  ` forall i in 1..3`  
  `    insert into tt1(a) select a from tt1 where a = n(i);`  
  `end;`  
  `/`  
  `select * from tt1;`  |output  `SQL> create table tt1(a int);`  
  `表已创建。`  
  `SQL> insert into tt1 values(1);`  
  `已创建 1 行。`  
  `SQL>`  
  `SQL> declare`  
  `  2  type numlist is table of int;`  
  `  3  a numlist := numlist(2,3,4);`  
  `  4  begin`  
  `  5   forall i in 1..3`  
  `  6      insert into tt1(a) values(a(i));`  
  `  7  end;`  
  `  8  /`  
  `PL/SQL 过程已成功完成。`  
  `SQL> select * from tt1;`  
  `         A`  
  `----------`  
  `         1`  
  `         2`  
  `         3`  
  `         4`  
  `SQL> declare`  
  `  2  type numlist is table of int;`  
  `  3  a numlist := numlist(2,3,4);`  
  `  4  begin`  
  `  5   forall i in 1..3`  
  `  6      insert into tt1(a) select a from tt1 where a = a(i);`  
  `  7  end;`  
  `  8  /`  
  `PL/SQL 过程已成功完成。`  
  `SQL> select * from tt1;`  
  `         A`  
  `----------`  
  `         1`  
  `         2`  
  `         3`  
  `         4`  
  `         2`  
  `         3`  
  `         4`  
  `已选择 7 行。`  
  `SQL> truncate table tt1;`  
  `表被截断。`  
  `SQL> insert into tt1 values(1);`  
  `已创建 1 行。`  
  `SQL> declare`  
  `  2  type numlist is table of int;`  
  `  3  a1 int := 1000;`  
  `  4  n numlist := numlist(1,2,3,4);`  
  `  5  begin`  
  `  6   forall i in 1..3`  
  `  7      insert into tt1(a) select a from tt1 where a = n(i);`  
  `  8  end;`  
  `  9  /`  
  `PL/SQL 过程已成功完成。`  
  `SQL> select * from tt1;`  
  `         A`  
  `----------`  
  `         1`  
  `         1`  |优先级匹配兼容性问题|
|动态SQL中出现 匿名块 + 静态SQL 的场景，迭代出现以上场景|code  ` truncate table tt1;`  
  ` insert into tt1 values(1);`  
  `declare`  
  `a char(10) := 'a';`  
  `begin`  
  `execute immediate 'declare`  
  `a char(10) := ''x'';`  
  `begin select a into a from tt1; :1 := a; end;' using out a;`  
  `dbms_output.put_line(a);`  
  `end;`  
  `/`  
  `declare`  
  `a char(10) := 'a';`  
  `begin`  
  `execute immediate 'declare`  
  `a char(10) := ''x'';`  
  `begin select a, :1 into a, :1 from tt1; end;' using in out a;`  
  `dbms_output.put_line(a);`  
  `end;`  
  `/`  
  `declare`  
  `a char(10) := 'a';`  
  `b char(10) := 'y';`  
  `begin`  
  `execute immediate 'declare`  
  `a char(10) := ''x'';`  
  `begin select a, :1 into :2, :3 from tt1; end;' using in a, out a, out b;`  
  `dbms_output.put_line(a);`  
  `dbms_output.put_line(b);`  
  `end;`  
  `/`  
  `declare`  
  `a char(10) := 'a';`  
  `b char(10) := 'y';`  
  `begin`  
  `execute immediate 'declare`  
  `a char(10) := ''x'';`  
  `begin select a, :1 into :2, :1 from tt1; end;' using in out a, out b;`  
  `dbms_output.put_line(a);`  
  `dbms_output.put_line(b);`  
  `end;`  
  `/`  |output  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   begin`  
  `  4   execute immediate 'declare`  
  `  5   a char(10) := ''x'';`  
  `  6   begin select a into a from tt1; :1 := a; end;' using out a;`  
  `  7   dbms_output.put_line(a);`  
  `  8   end;`  
  `  9   /`  
  `1`  
  `PL/SQL 过程已成功完成。`  
  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   begin`  
  `  4   execute immediate 'declare`  
  `  5   a char(10) := ''x'';`  
  `  6   begin select a, :1 into a, :1 from tt1; end;' using in out a;`  
  `  7   dbms_output.put_line(a);`  
  `  8   end;`  
  `  9   /`  
  `a`  
  `PL/SQL 过程已成功完成。`  
  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   b char(10) := 'y';`  
  `  4   begin`  
  `  5   execute immediate 'declare`  
  `  6   a char(10) := ''x'';`  
  `  7   begin select a, :1 into :2, :3 from tt1; end;' using in a, out a, out b;`  
  `  8   dbms_output.put_line(a);`  
  `  9   dbms_output.put_line(b);`  
  ` 10   end;`  
  ` 11   /`  
  `1`  
  `a`  
  `PL/SQL 过程已成功完成。`  
  `SQL>  declare`  
  `  2   a char(10) := 'a';`  
  `  3   b char(10) := 'y';`  
  `  4   begin`  
  `  5   execute immediate 'declare`  
  `  6   a char(10) := ''x'';`  
  `  7   begin select a, :1 into :2, :1 from tt1; end;' using in out a, out b;`  
  `  8   dbms_output.put_line(a);`  
  `  9   dbms_output.put_line(b);`  
  ` 10   end;`  
  ` 11   /`  
  `a`  
  `1`  
  `PL/SQL 过程已成功完成。`  |相同|




###   [1.3 需求分析](#13-需求分析)  

从需求描述上可以看出，该需求主要是解决特定场景问题的功能特性要求，主要为了解决原PL/SQL编译方案设计上“预编译”方案带来的O兼容性问题（PL/SQL编译方案 4.3 SQL语句，可查阅  [https://pingcode.yasdb.com/wiki/pages/67397026593f99c9ff23974a](https://pingcode.yasdb.com/wiki/pages/67397026593f99c9ff23974a)  ),同时因为“预编译”会打乱原SQL语句的组织形式，导致报错信息和用户输入不符，所以也需要解决报错信息不符问题。对于其他的非功能质量属性，该需求并不涉及。

原方案为PL引擎和SQL引擎解耦，通过“预编译”动作，将用户输入的SQL语句，用LEXER分词器挨个取一遍，在匹配到PL中的变量名后，改写成绑定参数，拼接成新的SQL语句，传入SQL引擎进行编译、执行动作。该方案优点主要是通过绑定参数机制完全隔离了两个引擎，不会有重复代码产生。缺点已赘述，不展开。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|静态SQL语句，PL与SQL引擎对接实现功能|PL与SQL引擎的对接要保持解耦，所以还是通过绑定参数对接。但绑定参数的改写不能提前在预编译做。因此计划将SQL语句先过一次SQL引擎进行解析，优先匹配SQL引擎中各种元素，在匹配到PL的局部变量后，编译结束回到PL中，将变量进行改写后，再进SQL引擎。|是|是|----|
||静态SQL语句，PL保留的预处理功能|有一些特殊的SQL语法，如BULK属性、INTO子句等，只在PL语境中出现；这些带入到SQL引擎中，会影响SQL语句的缓存和复用能力。因此PL的预编译去除局部变量优先，还要保留针对这些特殊语法的预处理能力。|是|是|----|
||游标场景下，PL与SQL引擎对接实现功能|游标场景和静态SQL，在方案框架上是一致的，主要区别的是游标的特殊场景，比如显式游标带有形参情况，形参和绑定参数参与匹配的方式和普通行访问变量差异较大;游标的查询语句语法和静态SQL的一些细微差异。|是|是|----|
||FOR语句IN（SELECT语句），PL与SQL引擎对接实现功能|FOR语句中的SELECT语句，和静态SQL在方案框架上是一致的，但略微有差别的，主要是对FOR出现变量的查找匹配；语法和静态SQL的细微差异。|是|是|----|
||FORALL语句出现的SQL语句，PL与SQL引擎对接实现功能|FORALL语句中的SQL语句，和静态SQL在方案框架上是一致的，但略微有差别的，主要是语法和静态SQL的细微差异。|是|是|----|
||动态SQL中出现 匿名块 + 静态SQL 的场景，PL与SQL引擎对接实现功能|主要考虑绑定参数级联查找的适配。|是|是|----|
|性能|不涉及|该场景下关键性能指标通过什么方案满足|否|否|----|
|可用性|不涉及|----|否|否|----|
|可靠性|不涉及|----|否|否|----|
|可维可测|SQL语句出现报错，错误抛出策略|1.确保用户输入的原始SQL文本不做大的调整，使得首次解析报错信息POS可以较为准确报出,2.遵循改写规则，可以从V$SQL等运维视图中呈现|是|是|----|
|安全|解析机制的调整，要应对拼接SQL可能导致的内存溢出问题|1.静态SQL的原始文本不做调整，但做长度判断，超过8K大小走Large Page，超过Large Page抛错。避免内存溢出。,2.完整的走SQL引擎的解析、权限校验、资源校验等流程，避免拼接SQL绕过检测。|否|是|----|
|易用性|不涉及|----|否|否|----|
|可修改性|不涉及|----|否|否|----|
|兼容性|不涉及|----|否|否|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|----|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|预编译|在PL编译器会针对PL语言元素，在SQL编译器会针对SQL语句分别进行编译动作；为了减少PL编译器重复实现了SQL语句的编译，所以会提前带一定目的针对SQL语句做识别处理，然后重新拼接组装的SQL传入到SQL引擎进行编译。这个提前处理过程，称为“预编译”动作。本方案主要对预编译目的做轻量化处理。|是||


###   [1.5 开源依赖](#15-开源依赖)  

未使用任何开源组件。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|----|----|否|
|函数|----|----|否|
|高级包|----|----|否|
|系统视图|从V$SQL类的视图，可以查看PL预编译的，改写为绑定参数的SQL语句。|----|是|
|动态视图|----|----|否|


##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

针对“预编译”的改写，主要思考了以下3种方案：

方案一

(1) 削除PLSQL预编译重组SQL能力，只保留类似INTO子句处理；

(2) 把SQL语句直接调用anlParse，但在verifyColumnExpr、verifyFunction, verifyAccess等表达式时，  识别处于PLSQL语境内  ，尝试对外寻找处于过程体中的变量，寻找到则记录到输出变量匹配链表中；不会产生实际报错返回。

(3) 完成编译，一旦变量匹配链表有值，则编译实际是出错的。不保留已创建的context。如果变量匹配链表没有值，可以保留context直接成功返回（注，这里有一个INTO CLAUSE的特殊形式，需探讨是否继续改写再进SQL引擎）。

(4) 回到PLSQL中，根据变量匹配链表产生inputVars信息，同时修改原SQL，改成将对应位置改成绑定参数；

(5) 再次将SQL语句进行anlParse。

方案二

(1) 削除PLSQL预编译重组SQL能力，只保留类似INTO子句处理；

(2) 把SQL语句直接调用anlParse，但在verifyColumnExpr时，处于PLSQL语境内，尝试对外寻找处于过程体中的变量，寻找到则记录到输出变量匹配链表中，同时生成绑定参数的expr节点，生成修改后sql语句；

(3) 完成编译后，修改已生成anlContext的sql语句和hashvalue。编译成功进缓存。

(4) 回到PLSQL中，根据变量匹配链表产生inputVars信息。

方案三

(1) 削除PLSQL预编译重组SQL能力，只保留类似INTO子句处理；

(2) 把SQL语句直接调用anlParse，但在verifyColumnExpr时，处于PLSQL语境内，尝试对外寻找处于过程体中的变量，寻找到则将EXPR改写SO_VAR; 同时往inputVars链表插入;

(3) 该SQL一旦有SO_VAR，不进缓存，变成匿名块私有。

方案一和方案二可以较大程度的保留与O兼容性，但方案一需要两次编译，编译效率低；方案二需要比较复杂的原SQL CONTEXT改写，实现复杂度高。方案三实现简单，但SQL的生命周期会跟随PL释放；即静态SQL不做绑定参数改写了，但这块和O兼容性不对应。

这3种方案，都可以做个小的变形，即把INTO子句带入SQL引擎去识别，但SQL引擎不参与AST生成。

无论哪种方案，首次进入SQL解析的场景，需要SQL解析器参与适配，即  识别SO_VAR变量，而且将该变量视为绑定参数的等价处理  。

综上所述，目前采用方案一进行代码实现；而且修改不能造成已支持功能的后退。



=>  ** 2024/11/22 概要设计评审遗留的讨论项结论**

1. 和晓锋对齐后的，上午方案大体不变，但在EXPR_SOVAR识别后，伪装成EXPR_PARAM，确保后续VERIFY和OPTIMZ不需要额外调整，减少对SQL引擎的侵扰。

2. 另一个争议项在于是否需要参与数据类型推导，这个目前变量窥视有了，是可以支持的。 数据类型推导部分，可以将EXPR_SOVAR类型提取参与SQL的类型推导生成PLAN0。如果这个语句被复用但绑定新的参数类型时，按变量窥视处理。



###   [4.1 静态SQL语句，PL与SQL引擎对接实现功能](#41-静态sql语句pl与sql引擎对接实现功能)  

PL与SQL引擎的对接要保持解耦，所以还是通过绑定参数对接。但绑定参数的改写不能提前在预编译做。因此计划将SQL语句先过一次SQL引擎进行解析，优先匹配SQL引擎中各种元素，在匹配到PL的局部变量后，编译结束回到PL中，将变量进行改写后，再进SQL引擎。

方案规划：

![image.png](https://pingcode.yasdb.com/atlas/files/public/673c3002a1ad9a3311de33dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQkFBQUFBQUJBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBU0FBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NjgsImV4cCI6MTc4MjQ2NzI2OH0.k_GBaaQzbO3ZxBk5g1pUGGJzaljyyYHz0A40teSS8BY)

因为首次SQL解析，直接通过SQL引擎对接，所以需要将过程体查找能力，在SQL引擎其他匹配不上时对接找回。

当前主要通过AnlStmt上携带的过程体编译信息，即在PL处理的SQL语句编译时：

1. **需要优先匹配SQL自身的资源，如表、视图、序列、内置资源等；**
1. **当上述资源无法匹配，而且发现处于过程体编译语境中，需要尝试寻找过程体自身的局部变量资源；**
1. **当局部变量无法匹配，尝试寻找自定义的全局变量资源。**
1. 注意寻址为PL的变量，无法参与一些优化规则，如静态优化动作。


在SQL首次解析后，得到的变量类型：

1. 如果是普通的过程体变量，在SQL引擎解析后得到的表达式类型为EXPR_SOVAR;
1. 如果是UDT变量，在SQL引擎解析后得到的表达式类型为EXPR_SOVAR、EXPR_FUNCTION、EXPR_ACCESS这三种类型之一；（注：虽然是3种类型，但是VERIFYEXPR完成后，都会转为EXPR_SOVAR；需要注意携带足够的原始文本信息）。


均需要将这些表达式类型加入到预编译的变量链表中，供后续改写使用。

###   [4.2 静态SQL语句，PL保留的预处理功能](#42-静态sql语句pl保留的预处理功能)  

在PL的逻辑行功能中，包括以下几种语法，在SQL引擎是无法直接识别的：

1. SELECT ... [INTO CLAUSE] FROM ...
1. SELECT ... [BULK COLLECT INTO CLAUSE] FROM ...


解决方案：

PL保留的“预编译”能力，主要应对解析INTO子句，生成该逻辑行必须得OutputVars；

进入SQL引擎解析前，有两种方式，

一种将INTO子句全部置为空格，这样SQL引擎可以不关心，但缺点在于赋值空格，需要将SQL文本拷贝一遍，结合后面再做绑定参数处理，相当于拷贝两遍，效率低；对于超长文本，还有可能持有两个Large Page；

另一种将INTO子句带入到SQL引擎中，SQL引擎的解析增加忽略此子句的能力；缺点在于PLANCACHE中缓存的SQL文本携带有INTO子句，非PL入口的SQL文本无法匹配。注：与ORACLE此处行为上有差异；应对方法是SQL文本原地更新，或者重置SQL文本再进解析器。

###   [4.3 游标场景下，PL与SQL引擎对接实现功能](#43-游标场景下pl与sql引擎对接实现功能)  

PL的游标在该特性中，主要划分为两类：

1. 显式游标+形参，其特殊点在于显式游标有形参情况下，多了一层游标参数压栈情形，其编址寻址方式是特殊的。
1. 其他游标形式，该情况下与静态SQL的形态是完全一样的。


###   [4.4 FOR语句IN（SELECT语句），PL与SQL引擎对接实现功能](#44-for语句inselect语句pl与sql引擎对接实现功能)  

FOR语句的SQL语句，要求是不能出现INTO子句，与普通SQL处理的差别在于，在PL的“预编译”处理中，需要做特殊的断句流程，即不能通过普通解析流程出现分号就特殊处理，而是要判断出现一个特殊的，孤立的右括号，完成断句。

###   [4.5 FORALL语句出现的SQL语句，PL与SQL引擎对接实现功能](#45-forall语句出现的sql语句pl与sql引擎对接实现功能)  

FORALL语句的SQL语句，涵盖各种类型的DML语句。在PL的“预编译”处理中，通过普通解析流程出现分号就特殊处理。

###   [4.6 动态SQL中出现 匿名块 + 静态SQL 的场景，PL与SQL引擎对接实现功能](#46-动态sql中出现-匿名块--静态sql-的场景pl与sql引擎对接实现功能)  

在此场景中，静态SQL中的各个位置都可能出现绑定参数，此时绑定参数的出现，要和SoVar的出现处理一致。以确保生成完整的InputVars、OutPutVars。

### 4.7 SQL语句出现报错，错误抛出策略

1. 在PL的“预编译”处理，不能调整原始SQL语句的写法，这样报错时产生的POS可以更贴近于用户理解的情况。
1. 如图所示，报错需要叠加，首先给出SQL的编译报错POS，再叠加外层的行号位置。
1. 一种特殊的写法是，SQL语句用局部变量存储，按动态SQL执行；处理方式同2。
1. 
1. ![WXWorkLocalPro_17321902778254.png](https://pingcode.yasdb.com/atlas/files/public/673f204fa1ad9a3311de359b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQkFBQUFBQUJBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBU0FBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NjgsImV4cCI6MTc4MjQ2NzI2OH0.k_GBaaQzbO3ZxBk5g1pUGGJzaljyyYHz0A40teSS8BY)




### 4.8 特性安全设计

PL/SQL中静态SQL功能，需要应对SQL文本过长、SQL文本拼接恶意绕过检测等安全问题。因为新的方案调整后，PL的”预编译”流程降得非常轻，实际要考虑的点可以降为2个部分：1、防止内存溢出；2.防止SQL绕过校验。

1.静态SQL的原始文本不做调整，但做长度判断，超过8K大小走Large Page，超过Large Page抛错。避免内存溢出。

2.完整的走SQL引擎的解析、权限校验、资源校验等流程，避免拼接SQL绕过检测。



##   [5.未来规划](#5未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。



附录：

![](https://pingcode.yasdb.com/atlas/files/public/67396eeda1ad9a3311dc9aea/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQWdBZ0FBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQkFBQUFBQUJBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBU0FBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY0NjgsImV4cCI6MTc4MjQ2NzI2OH0.k_GBaaQzbO3ZxBk5g1pUGGJzaljyyYHz0A40teSS8BY)

## Attachments:

[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWQ4OTcwYzJhZjRmNTIxYzc2IiwicmVmX2lkIjoiNjczOTZlZWQ3MjgyMDZlZmI5MmYyZTVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDY4LCJleHAiOjE3ODI1NDI4Njh9.1Po6FO6zUG6dBlmDaIObdXJQXOivTDjKI-yevoG8fkQ)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWRhMWFkOWEzMzExZGM5YWU2IiwicmVmX2lkIjoiNjczOTZlZWQ3MjgyMDZlZmI5MmYyZTVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDY4LCJleHAiOjE3ODI1NDI4Njh9.MpopxA3GLHLX0feTjCkCk14MQqJGuTjC7-eh6Cxa0T4)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWRhMWFkOWEzMzExZGM5YWU3IiwicmVmX2lkIjoiNjczOTZlZWQ3MjgyMDZlZmI5MmYyZTVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDY4LCJleHAiOjE3ODI1NDI4Njh9.uVlTWUmzD63MroyHAuSgkWK-2e7R3UDJNGETsAk6UkE)

 (image/png)    


[image2024-11-11_12-1-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWRhMWFkOWEzMzExZGM5YWU4IiwicmVmX2lkIjoiNjczOTZlZWQ3MjgyMDZlZmI5MmYyZTVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NDY4LCJleHAiOjE3ODI1NDI4Njh9.wgsMsq2e_q-b0SJzDZ1JDFhbECEaGc1OcBYmoYW5d6g)

 (image/png)    
