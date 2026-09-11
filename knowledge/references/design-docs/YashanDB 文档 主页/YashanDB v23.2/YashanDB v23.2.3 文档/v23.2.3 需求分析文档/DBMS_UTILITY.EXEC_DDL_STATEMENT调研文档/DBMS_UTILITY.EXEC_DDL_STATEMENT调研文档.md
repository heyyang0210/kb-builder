Created by 邓秋怡, last modified by  未知用户 (liaofeng) on 十二月 11, 2023

#   [DBMS_UTILITY.EXEC_DDL_STATEMENT高级包子函数Research（DBMS_UTILITY.EXEC_DDL_STATEMENT高级包子数特性调研）](#dbms-utilityexec-ddl-statement高级包子函数researchdbms-utilityexec-ddl-statement高级包子数特性调研)  

SR链接：

  [YDBRD-22160](https://jira.yasdb.com/browse/YDBRD-22160?src=confmacro)    -  支持DBMS_UTILITY.EXEC_DDL_STATEMENT函数  完成

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_UTILITY.EXEC_DDL_STATEMENT文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/database-pl-sql-packages-and-types-reference.pdf)  

（1）  **EXEC_DDL_STATEMENT**  ：执行入参的DDL语句。

##   [2. Features（功能特性）](#2-features功能特性)  

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
DBMS_UTILITY.EXEC_DDL_STATEMENT (
 parse_string IN VARCHAR2);

```

####   [2.1.3 Parameter（参数）](#213-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|parse_string|IN|VARCHAR2|是|-|待执行的DDL语句|


返回值：无

####   [2.1.4 Details（详细分析）](#214-details详细分析)  

（1）parse_string参数限制    
  有且只能有一个参数，且参数类型为VARCHAR2。

|入参|结果|
|---|---|
|空|PLS-00306: 调用 'EXEC_DDL_STATEMENT' 时参数个数或类型错误|
|显式NULL|ORA-06561: 程序包 DBMS_SQL 不支持给定的语句[报错信息包含了DBMS_UTILITY和DBMS_SQL，感觉是oracle内部实现有点问题]|
|非字符串类型|ORA-00900: 无效 SQL 语句|
|字符串类型但完全不是sql语句|ORA-00900: 无效 SQL 语句|
|DDL结尾有分号|ORA-00922: 选项缺失或无效|
|多条DDL，中间用分号进行分割|ORA-00922: 选项缺失或无效（估计是因为中间识别到分号了）|
|非DDL，sql语句本身不合法（例：select不存在的表）|子函数执行出错，非ddl编译出错，报非ddl编译时的错误 【plsql用exception可捕获】|
|非DDL，sql语句本身合法|子函数执行成功，非ddl编译成功，但未执行|
|DDL，sql语句本身不合法（例：create已存在的表）|子函数执行出错，根据ddl本身编译执行的报错位置进行报错 【plsql用exception可捕获】|
|DDL，sql语句本身合法|子函数执行成功，且ddl语句编译执行成功|
|varchar变量，且变量内存的是合法ddl|子函数执行成功，且ddl语句编译执行成功|
|varchar变量，且变量内存的是合法非ddl|子函数执行成功，非ddl编译成功，但未执行|
|多条sql一起执行   begin..end （例：匿名块中有条insert触发唯一主键约束的语句，对匿名块来说是编译不报错，执行报错）|子函数执行成功与否取决于  匿名块编译结果。匿名块本身不执行|
|带procedure  begin..end内含procedure|子函数执行成功与否取决于  匿名块及其内部的proc编译结果。匿名块本身不执行|
|sql调udf，udf调高级包，高级包内有dml,ddl。调研此时dml,ddl的编译执行情况。|DML编译但不执行，DDL编译且执行|
|调研入参是否支持lob转成的字符串。调研udf返回的字符串当入参的情况。|和正常赋值一样支持|
|调研varchar长度32000和sql长度2M不匹配对此需求的影响。|如果sql长度超过2M赋值给varchar变量时就已经被拦截。不会走到子函数|
|审计是否会记录由DBMS_UTILITY.EXEC_DDL_STATEMENT执行的sql语句|可以审计到单独的ddl sql语句,单独的非ddl无法审计到|
|调研使用DBMS_UTILITY.EXEC_DDL_STATEMENT(sql)时，用户对此条sql的执行权限对此条子函数执行结果的影响。|用户拥有相应的执行权限才可成功执行子函数|
|调研非ddl编译在子函数内进行编译后，v$sql表是否能查到。|整个匿名块的编译记录，内部非ddl可以查到，ddl查不到|
|ddl执行成功后是会默认进行commit的。调研先dml，后子函数执行ddl，ddl的commit是否会把dml也提交上。|是|
|编译完就会有context（即使是非ddl在子函数内也要编译），代码上注意释放非ddl编译后的context|已释放|


常规测试

```
SQL&gt; set serverout on;
SQL&gt; ----------------------create  succ
SQL&gt; drop table utility_create_15384;
drop table utility_create_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; select * from utility_create_15384;
select * from utility_create_15384
              *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; declare
  2  begin
  3  DBMS_UTILITY.EXEC_DDL_STATEMENT('create table utility_create_15384(a1 number)');
  4  end;
  5  /

PL/SQL 过程已成功完成。

SQL&gt; select * from utility_create_15384;

未选定行

SQL&gt; drop table utility_create_15384;

表已删除。

SQL&gt;
SQL&gt; ---------------------select  ignore
SQL&gt; drop table utility_select_15384;
drop table utility_select_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; create table utility_select_15384(a1 number);

表已创建。

SQL&gt; insert into utility_select_15384 values(11);

已创建 1 行。

SQL&gt; select * from utility_select_15384;

        A1
----------
        11

SQL&gt; declare
  2  begin
  3  DBMS_UTILITY.EXEC_DDL_STATEMENT('select * from utility_select_15384');
  4  end;
  5  /

PL/SQL 过程已成功完成。

SQL&gt; drop table utility_select_15384;

表已删除。

SQL&gt;
SQL&gt; --------------------insert  ignore
SQL&gt; drop table utility_insert_15384;
drop table utility_insert_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; create table utility_insert_15384(a1 number);

表已创建。

SQL&gt; insert into utility_insert_15384 values(11);

已创建 1 行。

SQL&gt; select * from utility_insert_15384;

        A1
----------
        11

SQL&gt; declare
  2  begin
  3  DBMS_UTILITY.EXEC_DDL_STATEMENT('insert into utility_insert_15384 values(12)');
  4  end;
  5  /

PL/SQL 过程已成功完成。

SQL&gt; select * from utility_insert_15384;

        A1
----------
        11

SQL&gt; drop table utility_insert_15384;

表已删除。

SQL&gt;
SQL&gt; -------------------rollback
SQL&gt; drop table utility_rollback_15384;
drop table utility_rollback_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; create table utility_rollback_15384(a1 number);

表已创建。

SQL&gt; insert into utility_rollback_15384 values(11);

已创建 1 行。

SQL&gt; select * from utility_rollback_15384;

        A1
----------
        11

SQL&gt;
SQL&gt; declare
  2  begin
  3  DBMS_UTILITY.EXEC_DDL_STATEMENT('rollback');
  4  end;
  5  /

PL/SQL 过程已成功完成。

SQL&gt;
SQL&gt; select * from utility_rollback_15384;

        A1
----------
        11

SQL&gt; drop table utility_rollback_15384;

表已删除。


```

异常测试

```
SQL&gt; set serverout on;
SQL&gt; ----------------------in param test
SQL&gt; --空参 参数个数错误  编译出错
SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT();
  3  end;
  4  /
DBMS_UTILITY.EXEC_DDL_STATEMENT();
*
第 2 行出现错误:
ORA-06550: 第 2 行, 第 1 列:
PLS-00306: 调用 'EXEC_DDL_STATEMENT' 时参数个数或类型错误
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: Statement ignored


SQL&gt;
SQL&gt; --空参 参数个数错误  编译出错
SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT('create table table_15384(c1 int)','');
  3  end;
  4  /
DBMS_UTILITY.EXEC_DDL_STATEMENT('create table table_15384(c1 int)','');
*
第 2 行出现错误:
ORA-06550: 第 2 行, 第 1 列:
PLS-00306: 调用 'EXEC_DDL_STATEMENT' 时参数个数或类型错误
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: Statement ignored


SQL&gt;
SQL&gt; --NULL /不支持给定的语句 /  dynamic sql should be string and not null  / 执行出错
SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT(NULL);
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-06561: 程序包 DBMS_SQL 不支持给定的语句
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt;
SQL&gt;
SQL&gt;
SQL&gt; --非字符串类型 /无效 SQL 语句  / dynamic sql should be string and not null / 执行出错
SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT(111);
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-00900: 无效 SQL 语句
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt;
SQL&gt; --字符串类型但完全不是sql语句 / 无效 SQL 语句   / keyword expected / 执行出错
SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT('NULL');
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-00900: 无效 SQL 语句
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt;
SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT('abcdefg');
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-00900: 无效 SQL 语句
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt;
SQL&gt;
SQL&gt; --非DDL，sql语句本身不合法  / 执行时报语句的错  /（所以是非DDL也是要执行的？但是结果不会影响？）
SQL&gt; drop table table_15384;

表已删除。

SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT('select * from table_15384');
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-00942: 表或视图不存在
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt;
SQL&gt; --非DDL，sql语句本身合法   执行不报错 但是执行完后不影响任何。
SQL&gt; drop table utility_insert_15384;

表已删除。

SQL&gt; create table utility_insert_15384(a1 number);

表已创建。

SQL&gt; insert into utility_insert_15384 values(11);

已创建 1 行。

SQL&gt; select * from utility_insert_15384;

        A1
----------
        11

SQL&gt; declare
  2  begin
  3  DBMS_UTILITY.EXEC_DDL_STATEMENT('insert into utility_insert_15384 values(12)');
  4  end;
  5  /

PL/SQL 过程已成功完成。

SQL&gt; select * from utility_insert_15384;

        A1
----------
        11

SQL&gt; drop table utility_insert_15384;

表已删除。

SQL&gt;
SQL&gt; --DDL，sql语句本身不合法
SQL&gt; drop table table_15384;
drop table table_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; create table table_15384(c1 int);

表已创建。

SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT('create table table_15384(c1 int)');
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-00955: 名称已由现有对象使用
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt; drop table table_15384;

表已删除。

SQL&gt;
SQL&gt; --分号
SQL&gt; drop table table_15384;
drop table table_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT('create table table_15384(c1 int);');
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-00922: 选项缺失或无效
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt; drop table table_15384;
drop table table_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt;
SQL&gt; --多条DDL
SQL&gt; drop table table_15384;
drop table table_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; begin
  2  DBMS_UTILITY.EXEC_DDL_STATEMENT('create table table_15384(c1 int);create table table_15384_2(c1 int)');
  3  end;
  4  /
begin
*
第 1 行出现错误:
ORA-00922: 选项缺失或无效
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 2


SQL&gt; drop table table_15384;
drop table table_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt;
SQL&gt; --varchar变量，且变量内存的是合法sql 成功执行
SQL&gt; drop table table_15384;
drop table table_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; select * from table_15384;
select * from table_15384
              *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; declare
  2  str varchar(100) := 'create table table_15384(c1 int)';
  3  begin
  4  DBMS_UTILITY.EXEC_DDL_STATEMENT(str);
  5  end;
  6  /

PL/SQL 过程已成功完成。

SQL&gt; select * from table_15384;

未选定行

SQL&gt;
SQL&gt; --varchar变量，且变量内存的是非法sql
SQL&gt; drop table table_15384;

表已删除。

SQL&gt; create table table_15384(c1 int);

表已创建。

SQL&gt; declare
  2  str varchar(100) := 'create table table_15384(c1 int)';
  3  begin
  4  DBMS_UTILITY.EXEC_DDL_STATEMENT(str);
  5  end;
  6  /
declare
*
第 1 行出现错误:
ORA-00955: 名称已由现有对象使用
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 4


SQL&gt; select * from table_15384;

未选定行

SQL&gt;
SQL&gt; --多条sql一起执行  不是begin..end   直接报选项缺失或无效
SQL&gt; drop table table_15384;

表已删除。

SQL&gt; declare
  2  str1 varchar(100) := 'insert into table_15384 values(11);';
  3  str2 varchar(100) := 'insert into table_15384 values(12);';
  4  str3 varchar(100) := str1 || chr(10) || str2;
  5  begin
  6  DBMS_UTILITY.EXEC_DDL_STATEMENT(str3);
  7  end;
  8  /
declare
*
第 1 行出现错误:
ORA-00933: SQL 命令未正确结束
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 6


SQL&gt; select * from table_15384;
select * from table_15384
              *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt;
SQL&gt; --下述类似于  执行成功但回滚了
SQL&gt;
SQL&gt; --多条sql一起执行   begin..end   执行成功  中间操作不生效
SQL&gt; drop table table_15384;
drop table table_15384
           *
第 1 行出现错误:
ORA-00942: 表或视图不存在


SQL&gt; create table table_15384(c1 int);

表已创建。

SQL&gt; declare
  2   v_sql1 varchar(200);
  3   v_sql3 varchar(200);
  4   v_sql varchar(200);
  5  begin
  6   v_sql1 := 'insert into table_15384 values(2);';
  7   v_sql3 := 'DBMS_OUTPUT.put_line (''yes'');';
  8   v_sql := 'begin' || chr(10) || v_sql1 || chr(10) || v_sql3 || 'end;';
  9   DBMS_UTILITY.EXEC_DDL_STATEMENT( v_sql);
 10  end;
 11  /

PL/SQL 过程已成功完成。

SQL&gt; select * from table_15384;

未选定行

SQL&gt;
SQL&gt;
SQL&gt;
SQL&gt; --多条sql一起执行   begin..end
SQL&gt; --内部有语句应该是编译报错的。
SQL&gt; --结果：报编译该有的错
SQL&gt; drop table table_15384;

表已删除。

SQL&gt; create table table_15384(c1 int);

表已创建。

SQL&gt; declare
  2   v_sql1 varchar(200);
  3   v_sql2 varchar(200);
  4   v_sql3 varchar(200);
  5   v_sql varchar(200);
  6  begin
  7   v_sql1 := 'insert into table_test values(2);';
  8   v_sql2 := 'insert into table_15384 values(2,3);';
  9   v_sql3 := 'DBMS_OUTPUT.put_line (''yes'');';
 10   v_sql := 'begin' || chr(10) || v_sql1 || chr(10) || v_sql2 || chr(10) || v_sql3 || 'end;';
 11   DBMS_UTILITY.EXEC_DDL_STATEMENT( v_sql);
 12  end;
 13  /
declare
*
第 1 行出现错误:
ORA-06550: 第 2 行, 第 13 列:
PL/SQL: ORA-00942: 表或视图不存在
ORA-06512: 在 "SYS.DBMS_UTILITY", line 593
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: SQL Statement ignored
ORA-06550: 第 3 行, 第 13 列:
PL/SQL: ORA-00913: 值过多
ORA-06550: 第 3 行, 第 1 列:
PL/SQL: SQL Statement ignored
ORA-06512: 在 "SYS.DBMS_SQL", line 1134
ORA-06512: 在 "SYS.DBMS_UTILITY", line 586
ORA-06512: 在 line 11


SQL&gt; select * from table_15384;

未选定行

SQL&gt;
SQL&gt; --多条sql一起执行   begin..end
SQL&gt; --内部有语句在编译阶段不报错，执行阶段报错。
SQL&gt; --结果：执行完成不报错且并没有执行结果保留的痕迹。
SQL&gt; --结论：begin..end内只作编译不作执行
SQL&gt; drop table table_15384;

表已删除。

SQL&gt; create table table_15384(v1 int, CONSTRAINT c1 PRIMARY KEY(v1));

表已创建。

SQL&gt; insert into table_15384 values(2);

已创建 1 行。

SQL&gt; declare
  2   v_sql1 varchar(200);
  3   v_sql3 varchar(200);
  4   v_sql varchar(200);
  5  begin
  6   v_sql1 := 'insert into table_15384 values(2);';
  7   v_sql3 := 'DBMS_OUTPUT.put_line (''yes'');';
  8   v_sql := 'begin' || chr(10) || v_sql1 || chr(10) || v_sql3 || 'end;';
  9   DBMS_UTILITY.EXEC_DDL_STATEMENT( v_sql);
 10  end;
 11  /

PL/SQL 过程已成功完成。

SQL&gt; select * from table_15384;

        V1
----------
         2

SQL&gt;
SQL&gt; --带procedure  begin 内含procedure
SQL&gt; --内部语句如果执行的话是会报错的
SQL&gt; --结果：未报错
SQL&gt; --结论：同上述begin..end内调proc也是只编译不执行。
SQL&gt; drop table table_15384;

表已删除。

SQL&gt; create table table_15384(v1 int, CONSTRAINT c1 PRIMARY KEY(v1));

表已创建。

SQL&gt; create or replace procedure proc_15384 is
  2  begin
  3  insert into table_15384 values(1);
  4  insert into table_15384 values(1);
  5  DBMS_OUTPUT.put_line ('executing ');
  6  end;
  7  /

过程已创建。

SQL&gt;
SQL&gt; declare
  2  v_sql varchar(200);
  3  begin
  4  v_sql := 'begin proc_15384();end;';
  5  DBMS_UTILITY.EXEC_DDL_STATEMENT(v_sql);
  6  end;
  7  /

PL/SQL 过程已成功完成。

SQL&gt;
SQL&gt; select * from table_15384;

未选定行



```

（2）

(3)

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

子函数本身编译出错【exception捕获不了】：parse_string部分入参个数不正确。子函数本身执行出错【exception能捕获】：parse_string非法（类型不正确、类型正确但非sql语句等），ddl编译错误，ddl执行错误，非ddl编译错误。【非ddl不会执行】    
  如果语句是ddl，则会执行。ddl执行成功无输出，ddl执行失败会打印出错误信息。   子函数的执行成功与否取决于ddl的编译结果。    
  如果语句是其他（非ddl）。非ddl只会进行编译，不会执行。子函数的执行成功与否取决非ddl的编译结果。    
  语句末分号相关测试（以execute immediate作类比）。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  