Created by 张欣, last modified on 六月 18, 2024

# 1. 概述

本文档描述动态SQL支持带绑定参数的匿名块详细测试设计。

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*


此前动态SQL质量加固，动态执行匿名块部分场景未实现或规格上有差异，在当前需求实现。实现功能或修改点如下：

|编号|场景描述|参考（历史问题单）|
|---|---|---|
|1|function、procedure调用，形参传入绑定参数|  
|
|2|动态语句执行匿名块-声明单元-default值|  [YDBRD-26743](https://jira.yasdb.com/browse/YDBRD-26743?src=confmacro)    -  【质量加固】【动态SQL】动态执行内容是匿名块，传入绑定参数类型是record，UDT,多个场景不支持  问题已转需求|
|3|动态语句执行匿名块-执行单元-set赋值|  
|
|4|动态语句执行匿名块-声明单元-cursor声明 投影列传绑定参数|  
|
|5|动态语句执行匿名块-执行单元-select into 投影列传绑定参数|  
|
|6|open cursor动态游标，投影列传绑定参数|  [YDBRD-27651](https://jira.yasdb.com/browse/YDBRD-27651?src=confmacro)    -  【质量加固】【动态SQL】游标open动态sql,绑定参数传object变量不识别  问题已转需求,  [YDBRD-27564](https://jira.yasdb.com/browse/YDBRD-27564?src=confmacro)    -  【质量加固】open游标时select list使用从过程体传入的合法UDT变量，执行报错YAS-00014 illegal conversion from - to VARCHAR  问题已转需求|
|7|动态SQL同名标识符原来按位置识别，对齐Oracle按名识别|  
|
|8|select into中类型检测错误 |  [https://pingcode.yasdb.com/pjm/items/66118dcb579a3edb84d7c55e](https://pingcode.yasdb.com/pjm/items/66118dcb579a3edb84d7c55e)    ?    
  #YDBRD-23728 CLONE-【质量加固】【自提单】select into中类型检测错误|
|9|隐式游标，显式游标继承类型时使用varchar兜底，部分场景失败|  [YDBRD-29424](https://jira.yasdb.com/browse/YDBRD-29424?src=confmacro)    -  【外场】date类型变量to_char转换后传入typeof，format报错  问题已转需求,普通类型和udt 都需要加固测试|


- *开发设计的主要原理*


1.将类型检测从执行阶段提前到编译阶段，  往上层调用查找，找到using子句获取传入变量具体的类型定义 和 目标类型比较是否可以转换  ；

2.  在计划的投影列类型中增加udt类型的UdtDict。

3.匿名中绑定参数先找已有的绑定参数，如果有同名，使用同一ID。

部署形态：单机，集群，分布式

## 2.2 应用场景

除了上述实现的场景，动态SQL涉及场景都需要覆盖。

### 2.2.1 场景

|  
|  
|绑定变量可能的方向|  
|
|---|---|---|---|
|函数调用|**function、procedure参数**|in,out,in out|call/exec 调用,在匿名块中调用,select 调用udf|
|  
|UDT构造函数、静态、成员方法参数|  
|  
|
|  
|内置函数参数|  
|内置函数表达式使用场景：,select list,赋值语句,实参,default值 等|
|  
|内置高级包参数|  
|  
|
|静态SQL（绑定变量改写）,动态SQL调静态SQL|**select_list**|in|不支持local type|
|  
|into子句|out|  
|
|  
|(insert)value子句,on_duplicate_clause|  
|  
|
|  
|returning_clause|  
|  
|
|  
|insert into select_list|  
|  
|
|  
|(update)set子句|  
|  
|
|  
|(select update delete)where子句|  
|  
|
|  
|（merge）：,update values，update where，delete where，insert values，insert where|  
|  
|
|游标|**select_list**|  
|显式游标声明 cursor is select ..,open cursor 动态游标 open cursor for select ..,for rec in(select ..)|
|  
|cursor参数|in,out,in out|显式游标 cursor(p1,p2),for +cursor(p1,p2)|
|  
|using IN/OUT|in|open cursor for 动态sql  using ..|
|  
|OPEN :x|  
|不支持|
|  
|OPEN FOR :x|  
|sql语句整体是个绑定变量，内容校验|
|  
|FETCH :x|  
|不支持 |
|  
|FETCH into :x|  
|不支持|
|  
|其他？|  
|  
|
|EXECUTE|执行语句 execute immediate :x|  
|内容校验|
|  
|**into子句**|out |  
|
|  
|**using IN/OUT**|in,out,in out|  
|
|赋值语句|**左值**|  
|左值绑定变量,右值绑定变量,左、右都是绑定变量|
|  
|**右值**|  
|  
|
|变量|**默认值**|  
|  
|
|流程控制|  
|  
|  
|
|CASE/WNEH|表达式|  
|表达式类型：等值，比较,udt类型比较：obj要有MAP,ORDER方法；varray,nstb 某些场景下不支持比较 ？|
|逻辑语句|IF/ELSIF条件|  
|  
|
|循环|FOR/FORALL索引|  
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
|其他|  
|  
|  
|
|  
|cursor参数默认值|  
|不支持|
|  
|varray定义的limit|  
|不支持|
|  
|so参数默认值|  
|不支持|
|  
|varray+下标或方法：:x(1), :x.last|  
|不支持|
|  
|table() 展开绑定参数|  
|在YDBRD-25349中覆盖|


### 2.2.2 绑定变量类型

|类型|  
|来源|
|---|---|---|
|标量类型|说明：简单覆盖,变量窥视sql语境中已有覆盖|变量（特殊值null）,形参,表达式（算数，拼接，逻辑）,内置函数表达式,udf()，,~~udt,record构造函数~~,udt方法,内置高级包表达式（返回udt,执行阶段处理）,嵌套子过程体的变量，形参,嵌套子过程体-udf()|
|constant常量|  
|  
|
|UDT-全局|  
|变量（特殊值null）,形参,表达式（array方法）？,内置函数表达式(gis geometry,b-box;数组函数),udf()，,udt构造函数,udt方法,内置高级包表达式（utl_file.fopen,  dbms_sql  ）,嵌套子过程体的变量，形参,嵌套子过程体-udf()|
|UDT-local,UDT-local(pkg)|sql场景不支持使用，仅plsql|变量（特殊值null）,形参,表达式 ？,内置函数表达式(数组函数),udf()，,udt,record构造函数,~~内置高级包表达式~~,嵌套子过程体的变量，形参,嵌套子过程体-udf()|
|数组函数-返回类型是全局VARRAY (array_append，remove,replace),数组函数-返回类型是LOCAL VARRAY (array_append，remove,replace),数组函数-返回类型是  **无类型的数组**  （string_to_array）|  
|都认为是无类型的数组|
|游标变量-sys_refcursor,强类型（有return type）,弱类型|赋值,select into,传参|变量,形参,udf(),嵌套子过程体的变量，形参,嵌套子过程体-udf()|
|block变量-for循环中的int类型,block变量-for循环cursor中的record类型|  
|  
|
|  
|  
|  
|
|显式游标|不支持|  
|
|异常变量|不支持|  
|


### 2.2.3 同名的绑定变量

1.在sql中（包含动态执行静态sql），绑定变量按位置识别，即使有同名绑定变量，传入绑定参数以绑定变量位置个数为准。

需要注意 可能存在绑定参数个数和投影列个数不相等的情况，要结合into 后的变量个数校验。

  test_sdv_DynamicSQL_057

drop table if exists tb_DynamicSQL_057;    
  create table tb_DynamicSQL_057(c1 int, c2 int,c3 int,c4 int);

declare    
  sql_stmt varchar(200) := 'INSERT INTO tb_DynamicSQL_057 VALUES (:x, :x, :y, :x)';    
  a INT :=1;    
  b int :=2;    
  c int :=3;    
  d int :=4;    
  begin    
  EXECUTE IMMEDIATE sql_stmt USING a, b, c, d;    
  INSERT INTO tb_DynamicSQL_057 VALUES (a, b, c, d);    
  EXECUTE IMMEDIATE sql_stmt USING a, a, b, a;    
  INSERT INTO tb_DynamicSQL_057 VALUES (a, a, b, a);    
  commit;    
  end;    
  /    
  Succeed.

declare    
  sql_stmt varchar(200) := 'INSERT INTO tb_DynamicSQL_057 VALUES (:x, :x, :y, :x)';    
  a INT :=1;    
  b int :=2;    
  begin    
   EXECUTE IMMEDIATE sql_stmt USING a, b;    
  end;    
  /   2    3    4    5    6    7    8 

[6:1]YAS-05234 parameter number 4 mismatch using number 2

  点击此处展开...

create or replace function so2_udt_funccom(a2 date, a1 int) return date is    
  begin    
  return sysdate;    
  end;    
  /

create or replace procedure so2_udt_procbc is    
  vi1 int;    
  vd2 date;    
  vd3 date;    
  begin    
  SELECT so2_udt_funccom(vd2, vi1), vi1 into vd2, vd3 from dual;    
  end;    
  /

  


2.在plsql中（动态执行匿名块或函数调用），绑定变量按名称识别，同名绑定变量只需要传一次。

  test_sdv_DynamicSQL_058

declare    
  a INT :=1;    
  b int :=2;    
  c int :=3;    
  d int :=4;    
  begin    
  EXECUTE IMMEDIATE 'begin DBMS_OUTPUT.PUT_LINE(:x + :x + :y + :x); end;' USING a, b,c,a;    
  end;    
  / 2 3 4 5 6 7 8 9

[7:1]YAS-05234 parameter number 2 mismatch using number 4

SQL> declare    
  a INT :=1;    
  b int :=2;    
  c int :=3;    
  d int :=4;    
  begin    
  EXECUTE IMMEDIATE 'begin DBMS_OUTPUT.PUT_LINE(:x + :x + :y + :x); end;' USING a, b;     
  end;    
  / 2 3 4 5 6 7 8 9     
  5

PL/SQL Succeed.

3.在plsql中执行sql语句，同名绑定变量对匿名块是一个，对  SQL语句本身是多个。

  点击此处展开...

declare    
  a int := 9;    
  begin    
  execute immediate 'declare    
  b int;    
  c int;    
  begin select :1,:1 into b,c from dual; dbms_output.put_line(b|| '' , '' ||c); end;' using a;    
  end;    
  / 2 3 4 5 6 7 8 9     
  9 , 9

PL/SQL Succeed.

SQL> declare    
  a int := 9;    
  begin    
  execute immediate 'declare    
  b int;    
  c int;    
  begin select :1,:1 into b,c from dual; dbms_output.put_line(b|| '' , '' ||c); end;' using a,a;    
  end;    
  / 2 3 4 5 6 7 8 9

[4:1]YAS-05234 parameter number 1 mismatch using number 2

  


需要关注，不同的逻辑行用到同名绑定参数，且有关联逻辑关系，比如out类型多次赋值。

**差异**  ：

**Oracle规则：匿名块中调用，重复绑定变量按名识别；call 调用，重复绑定变量按位置识别，但是带out方向的不支持绑定变量重名**

**yashan: call/exec/匿名块中调用 没有区别，都用按名识别。**

### 2.2.4 类型继承

1.for循环隐式游标，record继承游标投影列类型，之前统一用varchar兜底。部分场景有问题。

这次要覆盖  **全部的标量类型，udt类型**  转换场景。投影列除了简单的变量 还要覆盖 表达式（变量表达式，udf表达式等）。

2.%rowtype 继承显示游标的record。

  


### 2.2.5 绑定参数方向

1.过程体形参，游标的形参，会指定绑定变量的方向（in,out,in out）。using 传入绑定参数的方向要和定义指定的一致或匹配；

2.select_list 需要是in类型；

3.into 变量需要是out类型；

4.default值需要是in类型；

5.set 赋值 := 左边是out类型，右边是in类型；

6.using传入的带方向的变量，需要和using指定的匹配；（嵌套的execute）

7.其他场景根据绑定参数的位置判断支持的方向。

  


|形参\实参|in|out|in out|
|---|---|---|---|
|in|√|x|√|
|out|x|√|√|
|in out|x|x|√|


## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*


1.for循环游标和继承隐式游标的record，select语句中如果使用变量，需要指定别名才可以访问，record成员名为指定的别名；

  


- *内部机制涉及的规格约束*


1.  FETCH :x，FETCH into :x，

2.varray+下标或方法：:x(1), :x.last 

3.insert into return(:x) 

当前还不支持。

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

本设计主要采用场景分析，组合策略

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


1.函数调用

|function、procedure参数|调用方式|call/exec 调用,在匿名块中调用,在sql中调用|  
|  
|
|---|---|---|---|---|
|  
|源类型和目标类型|dts type|source type|source数据来源|
|  
|  
|形参类型:,标量,UDT-全局,UDT-local(pkg),cursor|  
,标量-可以隐式转换,标量-不能转换,UDT-全局,UDT-local,UDT-local(pkg),cursor|变量（特殊值null）,形参,表达式（array方法）？,内置函数表达式(gis geometry,b-box;数组函数),udf()，,udt构造函数,udt方法,内置高级包表达式（utl_file.fopen,  dbms_sql  ）,嵌套子过程体的变量，形参,嵌套子过程体-udf()|
|  
|同名的绑定参数|同一次调用 形参采用同名绑定参数,多次调用，out，in out属性的形参使用同名绑定参数|  
|  
|
|  
|参数方向检查|  
|  
|  
|
|UDT构造函数、静态、成员方法参数|  
|形参类型:,标量,UDT-全局,UDT-local(pkg),cursor|标量-可以隐式转换,标量-不能转换,UDT-全局,UDT-local,UDT-local(pkg),cursor|同上|
|内置函数参数|  
|内置函数定义的入参类型：,标量-按函数大类覆盖,gis(udt)|标量-可以隐式转换,标量-不能转换,UDT-全局-不能转换,UDT-local,UDT-local(pkg),cursor|变量（特殊值null）,形参,表达式（array方法）？,内置函数表达式(gis geometry,b-box;数组函数),udf()，,udt构造函数,udt方法,内置高级包表达式（utl_file.fopen,  dbms_sql  ）,嵌套子过程体的变量，形参,嵌套子过程体-udf()|
|内置高级包函数参数|  
|内置高级包定义的入参类型：,标量|同上|同上|


2.静态SQL

静态SQL（绑定变量改写） select ? into a from dual; 【静态SQL测试已覆盖过，测试点查漏补缺】

动态SQL调静态SQL  execute immediate 'select ? from dual' into a using b;

动态SQL匿名块中包含静态SQL execute immediate 'declare a varchar; begin select ? into a from dual; end;' using b ;     复杂表达式

|场景|  
|  
|
|---|---|---|
|select_list |简单：变量,复杂的 表达式：普通表达式，布尔 表达式，内置函数，数组函数，udf等,绑定参数个数大于投影列个数,PARAM => SOVAR,COLUMN => PARAM,PARAM => PARAM|UDT-全局,UDT-local -直接传入不支持拦截；内置函数，数组函数，udf 参数传入,cursor,  
,表达式中绑定变量，输出 再作为输入|
|into子句|绑定变量,不支持表达式,方向是out,同名绑定参数多次into,结果以最后一次为准|UDT-全局,UDT-local -select list内置函数，数组函数，udf ,cursor|
|select bulk collection into-  select_list |同select list|  
|
|select bulk collection into- into|绑定变量|UDT-集合类型-全局,UDT-集合类型-local (数组函数)|
|(insert)value子句,on_duplicate_clause|绑定变量,表达式|UDT-全局,UDT-local -不支持拦截|
|(insert)returning|不支持绑定变量|  
|
|(insert)returning into|绑定变量,COLUMN => PARAM     列表达式,方向是out|UDT-全局,UDT-集合类型-local (数组函数)|
|insert into select_list|同select list，简单覆盖|还不支持UDT|
|(update)set子句|绑定变量,表达式|UDT-全局,UDT-local -不支持拦截|
|(select update delete)where子句|**变量窥视：**,condition覆盖udt类型：,- =|>|>=|<|<=|!=|<> [ANY|SOME|ALL]
- IN|NOT IN
- IS NULL|IS NOT NULL
- BETWEEN...AND...
- 子查询 select 1 from t1 udt01 = (select ? into a from t2) using udt02;
|UDT-全局,注：object 有MAP,order 方法，无方法不支持参与比较；,varray不支持比较；,nstb 支持等值比较，不支持<>比较；|
|（merge）：,update values，update where，delete where，insert values，insert where|同上，简单覆盖|UDT-全局|


3.游标

|select_list|显式游标声明 cursor is select ..,open cursor 动态游标 open cursor for select ..,for循环隐式游标 for rec in(select ..)|简单：变量,复杂的 表达式：普通表达式，布尔 表达式，内置函数，数组函数，udf等,绑定参数个数大于投影列个数,方向只能是in|UDT-全局,UDT-local -直接传入不支持拦截；内置函数，数组函数，udf 参数传入,cursor|
|:---|:---|---|---|
|where子句|  
|**变量窥视：**,condition覆盖udt类型：,- =|>|>=|<|<=|!=|<> [ANY|SOME|ALL]
- IN|NOT IN
- IS NULL|IS NOT NULL
- BETWEEN...AND...
- 子查询 select 1 from t1 udt01 = (select ? into a from t2) using udt02;
|UDT-全局|
|cursor参数|显式游标 cursor(:1,:2),for +cursor(:1,:2)|  
|UDT-全局|
|using IN/OUT|open cursor for 'select ..'  using ..|select list,where,in/out 方向校验|UDT-全局,cursor|
|OPEN :x|不支持|  
|  
|
|OPEN FOR :x|sql语句整体是个绑定变量，内容校验|  
|  
|
|FETCH :x|不支持 |  
|  
|
|FETCH into :x|不支持|  
|  
|
|游标类型继承|for循环隐式游标 for rec in(select ..),%rowtype 继承显式游标|1.标量使用场景：,1）类型转换函数,to_char(date)，to_char(num),to_number，,to_date,to_timestamp(),,TO_YMINTERVAL，NUMTOYMINTERVAL,TIMESTAMP_TO_SCN，SCN_TO_TIMESTAMP,cast,2)  时间类型相关函数  ,trunc(),add_month,age,date,date_add,date_format,,```
DAYOFWEEK,<span style="color: rgb(44,62,80);">EXTRACT,LAST_DAY,MONTHS_BETWEEN,</span>
```,time,  TIMEDIFF,TIMESTAMP,TIMESTAMPDIFF,,3)其他,FLOOR，ROUND,  
,2.select list 尽量是表达式，一般表达式，udf表达式，函数表达式等,3.继承后typeof函数验证类型,4.匿名块的复用，嵌套使用|标量类型覆盖：全覆盖,UDT-全局,cursor|


4.execute,匿名块中除了静态sql其他场景

|EXECUTE|执行语句 execute immediate :x|内容校验，需要是可执行的静态SQL、匿名块或函数调用|字符串类型|
|:---|:---|:---|---|
|  
|into子句|嵌套执行 动态SQL中执行静态SQL,方向是out|UDT-全局,UDT-local-预期不支持,cursor|
|  
|using IN/OUT|嵌套执行 动态SQL,IN/OUT方向校验|UDT-全局,UDT-local,cursor|
|赋值语句|左值|SOVAR =>PARAM,PARAM => SOVAR,PARAM => PARAM,复杂表达式|UDT-全局,UDT-local,cursor|
|  
|右值|  
|  
|
|变量|默认值|  
|UDT-全局,UDT-local,cursor|
|流程控制|  
|  
|  
|
|CASE/WNEH|表达式|  
|UDT-全局,注：object 有MAP,order 方法，无方法不支持参与比较；,varray不支持比较；,nstb 支持等值比较，不支持<>比较；|
|逻辑语句|IF/ELSIF条件|表达式类型：等值，比较，  IS NULL|IS NOT NULL|/|
|循环|FOR/FORALL索引|upper,lower绑定参数传入,i值作为绑定变量传入|标量|
|  
|CASE/WHEN条件|同IF/ELSIF条件|UDT|
|  
|WHILE条件|同上|UDT|
|  
|CONTINUE条件|同上|UDT|
|  
|EXIT条件|同上|UDT|
|其他函数表达式|decode|  
|  
|
|  
|nvl,nvl2，  COALESCE|  
|  
|
|其他|  
|  
|  
|
|  
|cursor参数默认值|不支持|  
|
|  
|varray定义的limit|不支持|  
|
|  
|so参数默认值|不支持|  
|
|  
|varray+下标或方法：:x(1), :x.last|不支持|  
|


  


  


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|/|
|长稳|是|
|一致性|/|
|三方测试工具    
  (sqltest，sqlancer)|/|
|安全|/|
|DFR|/|
|HA|/|
|压力|/|
|性能|是|
|可维护性|/|


1.CT场景用例设计（大量对象，100+）

|  
|  
|  
|
|---|---|---|
|1|select list,游标list用到全局UDT|UDT type变更，drop,重建，replace修改，alter type重编译|
|2|匿名块中赋值语句，变量default值等场景用到全局UDT|UDT type变更，drop,重建，replace修改，alter type重编译|
|3|匿名块中赋值语句，变量default值等场景用到pkg.local UDT|pkg变更，type重建|
|4|嵌套的匿名块，using绑定参数传入，用到全局UDT，pkg.local UDT|UDT type变更，drop,重建，replace修改，alter type重编译,  
|


2.长稳场景用例设计

1）大量有绑定参数的匿名块在有其他业务场景下同时执行,匿名块和其他sql解析正常。（有绑定参数的匿名块不进sql pool）

3.性能

包含绑定参数的匿名块，和不包含绑定参数的匿名块 执行同样多的次数，比较性能差异。摸底测试

4.驱动用例计划覆盖（检查已有用例覆盖情况）：

过程，函数调用，参数绑定变量传入UDT类型；

select list绑定变量传入UDT类型；

into 绑定变量传入UDT类型；

入参传入重名的绑定参数；

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZmE4OTcwYzJhZjRmNTIwZjgxIiwicmVmX2lkIjoiNjczOTZjZmE3MjgyMDZlZmI5MmYxOTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDc1LCJleHAiOjE3ODIzOTE0NzV9.YgIeYxLuYt_e3ZF8Ew2lYw81BWYtwvc1W7ZAi66KPQQ)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZmE4OTcwYzJhZjRmNTIwZjgxIiwicmVmX2lkIjoiNjczOTZjZmE3MjgyMDZlZmI5MmYxOTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDc1LCJleHAiOjE3ODIzOTE0NzV9.YgIeYxLuYt_e3ZF8Ew2lYw81BWYtwvc1W7ZAi66KPQQ)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZmFhMWFkOWEzMzExZGM4ZGYzIiwicmVmX2lkIjoiNjczOTZjZmE3MjgyMDZlZmI5MmYxOTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1MDc1LCJleHAiOjE3ODIzOTE0NzV9.ZudZhBAmSon49_towYsEPvwwotrLLuHtdHDX_EQE5-8)

 (application/msword)    
