Created by 张江, last modified on 六月 05, 2024

# 1.概述

SR链接：    [YDBRD-22220](https://jira.yasdb.com/browse/YDBRD-22220?src=confmacro)    -  DBMS_SQL游标相关操作函数  开发中

本次需求涉及到的DBMS_SQL游标相关操作函数主要为：  DBMS_SQL.OPEN_CURSOR、DBMS_SQL.PARSE、DBMS_SQL.EXECUTE、DBMS_SQL.CLOSE_CURSOR、DBMS_SQL.IS_OPEN

# 2.需求分析

## 2.1功能点分析

1）  DBMS_SQL.OPEN_CURSOR：用于打开一个新游标，语法有如下：

DBMS_SQL.OPEN_CURSOR (

    security_level IN INTEGER,

    treat_as_client_for_results IN BOOLEAN DEFAULT FALSE

) RETURN INTEGER;

参数treat_as_client_for_results表示作为客户端接受结果集，可以不用指定，默认为false，用于语法兼容；  security_level表示安全级别，目前只支持级别1，0和2用于语法兼容.

2)  DBMS_SQL.PARSE：在给定游标中解析给定的语句，所有语句都会立即解析，同时DDL语句在解析后会立即执行。语法结构如下：

DBMS_SQL.PARSE (

    c IN INTEGER,

    statement IN VARCHAR2,

    language_flag IN INTEGER[

    [,edition IN VARCHAR2 DEFAULT NULL],

    apply_crossedition_trigger IN VARCHAR2 DEFAULT NULL,

    fire  edition  _apply_trigger IN BOOLEAN DEFAULT TRUE]

    [,schema IN VARCHAR2 DEFAULT NULL]

    [,container IN VARCHAR2)];

or

DBMS_SQL.PARSE (

    c IN INTEGER,

    statement IN CLOB,

    language_flag IN INTEGER[

    [,edition IN VARCHAR2 DEFAULT NULL],

    apply_crossedition_trigger IN VARCHAR2 DEFAULT NULL,

    fire_apply_trigger IN BOOLEAN DEFAULT TRUE]

    [,schema IN VARCHAR2 DEFAULT NULL]

    [,container IN VARCHAR2)];

参数c表示要解析语句的游标ID，statement表示要解析的sql语句，当sql语句长度大于32k是需存储在clob类型中；language_flag表示sql语句的行为，常用值为DBMS_SQL.NATIVE，yasdb应的常量值如下：

|名称|数据类型|值|描述|
|---|---|---|---|
|NATIVE|INTEGER|1|指定程序所连接的数据库的正常行为|


schema表示要解析对象名称的模式，如果为NULL，则为当前模式；edition、apply_crossedition_trigger、fire_apply_trigger、container用户语法兼容。

3)     DBMS_SQL.EXECUTE：执行给定的游标ID，返回处理的数据行数，返回值只对INSERT、UPDATE和DELETE语句有效，其他类型语句无返回值。语法如下：

DBMS_SQL.EXECUTE (

    c IN INTEGER

) RETURN INTEGER;参数c表示给定的游标ID。

4)    DBMS_SQL.CLOSE_CURSOR：关闭一个已经打开的游标。对同一游标多次调用时则报错，语法如下：

DBMS_SQL.CLOSE_CURSOR (

    c IN OUT INTEGER

);参数c表示要关闭的游标ID。

5)  DBMS_SQL.IS_OPEN：检查当前给定的游标是否打开，语法如下：

DBMS_SQL.IS_OPEN (

    c IN INTEGER

) RETURN BOOLEAN;参数c表示要检查的游标ID。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机和集群环境。

# 3.详细测试设计

## 3.1测试设计方法

主要采用等价类划分、边界值、场景法组合进行设计。

## 3.2详细测试设计

### 3.2.1等价类划分：

DBMS_SQL.OPEN_CURSOR(  security_level,  treat_as_client_for_results)

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|  
,  
,  
,  
,  
,参数校验|参数个数|可以是0或者1或者2|参数个数大于2|
||参数类型|1、  security_level合法类型：,整型：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、varchar、char等,2、treat_as_client_for_results合法类型：,boolean型,可以同boolean型互相转换的其他类型如整型、字符型,  
|  
,1、security_level：,- 负数、  0  ，非1和2的其他正数值
- 不能隐式转换成数值型的其他类型值
,2、treat_as_client_for_results：,- 非boolean类型值
- 不能同boolean型互相转换的数据
,3、输入参数只有一个显示值为NULL|
||参数值|1、  security_level合法参数值：,- 有效值为1；
- 2为支持语法兼容；
- 为NULL(需同时指定treat_as_client_for_results也为NULL)、空串；
- 可以通过变量赋值的方式输入：普通变量、record变量、constant常量、可以隐式转换成整型的常量或者变量；
,2、treat_as_client_for_results用于语法兼容，可以输入的值有true、false、null||
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|返回值类型|使用typeof查询返回值类型正确|/|
||返回值|返回一个integer整型范围内的数值|/|
|数据规格|/|- 默认情况下最多支持同时打开300个游标(最大支持的游标资源数)
- 通过配置OPEN_CURSORS参数可以增加并发数量(在300内可以测试效果)
|并发数超过OPEN_CURSORS参数值时数据库报错，报错信息正确|
|异常处理|/|/|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行open_cursor操作|/|
|使用场景|/|- 通常可定义一个整型变量用于接受打开的游标ID
- 可以通过package全局变量来接受ID
- 安全级别：设置为1，需要校验parse、execute、绑定变量和存储过程嵌套调用时是同一个用户下可以正常执行
|/|


DBMS_SQL.PARSE(c,statement,language_flag,  edition,apply_crossedition_trigger,fire_apply_trigger,schema,container  )

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,参数校验    
    
|参数个数|根据需要可以输入的参数个数范围在[3,8]|<3或者>9|
||参数类型|1、参数c：,整型：int/integer、bigint、number,可以兼容的类型：bigint、number、float、double(tinyint、smallint是否能存储游标返回值大小),2、参数statement：,字符型：varchar、char,大对象型：clob,3、参数  language_flag：,整型如：int/integer,可以兼容的类型：tinyint、smallint、bigint、number、varchar、char等,4、schema|1、参数c：,字符型或者不在有效类型范围内的其他类型,2、参数statement：,char/nchar/nvarchar/nclob等,3、参数  language_flag：,不可以隐式转换成整型的其他类型|
||参数值|1、参数c：正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor,2、参数statement：,语句类型：DDL(参考王伟)、DML、DQL(重点 涉及入参结果)、PLSQL过程体对象(涉及入参和出参)、RETURNING子句等,匿名块：begin execute immediate '';end,语句大小：覆盖<32k、=32k、(32k,2M]，大于32k长度时通过clob变量存储,3、参数  language_flag：,可以是显示输入0、1、2、3、4、5、6数值,通过DBMS_SQL常量值来输入，DBMS_SQL.NATIVE=1(oracle值为6),4、其他语法兼容性参数：,edition=null,  apply_crossedition_trigger=null,ire_apply_trigger=null(只校验类型),5、shema|1、参数c：,- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID
- 指定非数值型的其他类型值
,2、参数statement：,- 带解析的语句有报错，如语法编译错误、引用对象名不存在；
- statement语句最后末尾有分号，如如dbms_sql.parse(c,'insert into test_cursor2 values(1003,103);',dbms_sql.NATIVE)；
- statement语句大小超过2M
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|/|/|
|数据规格|语句大小|varchar类型：<=32k,clob类型：<=2M|  
|
|异常处理|/|ddl阶段：,编译时：语法校验报错,执行时：执行时报错通过others或者系统预定义异常去捕获处理|/|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,权限控制|/|需要针对parse中语句的类型和引用的对象类型进行验证：,1、DDL语句,在用户自己的schema下创建/修改/删除表、索引、序列、同义词、视图、自定义类型、存储过程等对象，需要有如下权限：,create table/index/sequence/synonym/view/type/procedure,在任意schema下创建/修改/删除表、索引、序列、同义词、视图、自定义类型、存储过程等对象，需要有如下权限：,create/alter/drop any table/index/sequence/synonym/view/type/procedure,2、DML语句,对数据中指定schema下的表执行insert、update、delete操作，需要有如下权限：,insert/update/delete on schema.table,对数据中任意表执行insert、update、delete操作，需要有如下权限：,insert/update/delete any table,3、DQL语句,对数据中指定schema下的表、序列、视图执行查询操作，需要有如下权限：,select on schema.table/squence/view,对数据中任意schema下的表、序列、视图执行查询操作，需要有如下权限：,select any table/sequence/view,4、执行PLSQL过程体对象,对数据中指定schema下的自定义类型、存储过程、自定义函数、自定义package对象，需要有如下权限：,execute schema.type/procedure,对数据中任意schema下的自定义类型、存储过程、自定义函数、自定义package对象，需要有如下权限：,execute any type/procedure,5、schema：当前current、嵌套调用plsql的用户、parse中的schema区分|缺少对应的权限|
|使用场景|/|具体见3.2.2章节"解析的sql语句类型",- 覆盖临时表、分区表、视图、物化视图
- 是否支持dblink查询
- parse中事务提交、parse前执行事务操作检查结果；跨session中游标不可见；跨session有事务提交检查结果正确性
|缺少parse操作，后续执行dbms_sql其他子函数都报错|


DBMS_SQL.EXECUTE(c)

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|  
,  
,参数校验|参数个数|1个|0或者大于1个|
||参数类型|整型：int/integer,可以兼容的类型：bigint、number、float、decimal|- 字符型如varchar/char/nchar/nvarchar/nclob
- 不在有效类型范围内的其他类型
|
||参数值|正常调用open_cursor后返回的游标ID,c integer :=   dbms_sql.open_cursor,package变量|- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID如123
- 指定非数值型的其他类型值、NULL值
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|  
,返回值校验|返回值类型|使用typeof查询返回值类型正确|/|
||返回值|- 对于dml语句，返回值为实际受影响的行数
- 对于dql和其他类型语句，返回值为0
- merge、多表update/insert、执行异常时校验返回结果
|/|
|数据规格|受影响结果集行数|验证大数据量下dml语句执行情况|  
|
|异常处理|/|参数校验异常,执行时异常：报错通过others或者系统句柄去捕获处理|  
|
|权限控制|/|同parse子函数中权限控制|/|
|使用场景|/|参考DBMS_SQL执行流程和其他子函数结合使用|缺少execute操作时，执行fetch_rows报错；执行column_value获取值为空|


DBMS_SQL.CLOSE_CURSOR(c)

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|  
,  
,参数校验    
    
|参数个数|1个|0或者大于1个|
||参数类型|整型：int/integer,可以兼容的类型：bigint、number、float、decimal|- 字符型如varchar/char/nchar/nvarchar/nclob
- 不在有效类型范围内的其他类型
|
||参数值|正常调用open_cursor后返回的游标ID,c integer :=   dbms_sql.open_cursor|- 游标定义未打开
- 游标打开后关闭
- 指定不存在的游标ID如123
- 指定非数值型的其他类型值、NULL值
- 对同一游标多次调用close_cursor
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|返回值校验|/|出参：正常返回值为NULL,类型：,整型：int/integer,可以兼容的类型：bigint、number、float、decimal|/|
|数据规格|/|/|/|
|异常处理|/|/|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行close_cursor操作|/|
|使用场景|  
|- 用在IF语句中检查关闭游标
- 用在异常处理模块关闭游标
|对同一游标执行多次  close_cursor操作则报错|


DBMS_SQL.IS_OPEN(c)

|输入条件1|输入条件2|有效等价类|无效等价类|
|---|---|---|---|
|  
,  
,  
,参数校验    
    
|参数个数|1个|0或者大于1个|
||参数类型|整型：int/integer,可以兼容的类型：bigint、number、float、decimal|- 字符型如varchar/char/nchar/nvarchar/nclob
- 不在有效类型范围内的其他类型
|
||参数值|- 正常调用open_cursor后返回的游标ID，c integer :=   dbms_sql.open_cursor
- 输入参数为NULL、空串''
- 游标定义未打开
- 游标打开后关闭
|- 指定不存在的游标ID如123
- 指定非数值型的其他类型值、NULL值
|
|关键字校验|/|高级包名称及其子函数大小写|高级包名称及其子函数拼写有误|
|  
,返回值校验|返回值类型|使用typeof查询返回值类型正确|/|
||返回值|- 游标正常打开时，返回值为true
- 输入参数为NULL、空串''时，返回值为false
- 游标定义未打开、游标打开后关闭，返回值为false
|/|
|数据规格|/|/|/|
|异常处理|/|/|/|
|权限控制|/|目前DBMS_SQL高级包未做权限控制，新建用户只需要有登录(create session)权限就可以执行is_open操作|/|
|使用场景|/|- 用在IF语句中判断程序执行完后检查游标状态
- 用在异常处理模块中当程序出现异常后检查游标状态
|/|


### 3.2.2单机使用场景：

|分类|使用场景|示例|
|---|---|---|
|应用对象|游标高级包函数常用在匿名块、存储过程、自定义函数、自定义package、过程体之间的嵌套调用|  
|
|解析的sql语句类型|可以是DDL、DML、DQL、PLSQL过程体对象、RETURNING子句等,1、DDL语句包含但不限于：,create table、create [or replace] view、create [or replace] synonym、,create sequence、create [or replace] function、create [or replace] procedure、,create [or replace] package、create [or replace] type、create [or replace] type body、,create [or replace] trigger等,2、DML语句包含但不限于insert、insert into select、update、delete、merge等,3、RETURNING子句包含insert  returning语句(delete returning、update returning目前暂不支持),4、DQL语句包含但不限于单表查询、多表关联查询、子查询,select语句中带有的子句有where、order by、limit、in(not in)、exists(not exists)、case when、distinct等,5、PLSQL过程体对象：匿名块、存储过程、自定义函数、自定义package、过程体之间的嵌套调用|declare     
      c integer := dbms_sql.open_cursor;    
      num int;    
  begin     
      dbms_sql.parse(c,'declare v1 int;v2 int;begin insert into test_cursor2 values (100,1000) returning      col1+10,col2+100 into v1,v2;    
  dbms_output.put_line(''v1 is '' || v1);    
  dbms_output.put_line(''v2 is '' || v2);    
  end;',    
  dbms_sql.NATIVE);    
      num := dbms_sql.execute(c);    
      dbms_sql.close_cursor(c);    
  end;    
  /|
|异常处理语句|1、当程序中途发生异常退出存储过程时，导致游标未能关闭，需在异常处理中关闭游标,2、  通过异常句柄捕获处理，可能涉及到的异常句柄有(待补充)：|EXCEPTION,    WHEN OTHERS THEN,        IF DBMS_SQL.IS_OPEN(c) THEN ,            DBMS_SQL.CLOSE_CURSOR(c);,        END IF;|
|条件选择语句|通常在调用IS_OPEN和CLOSE_CURSOR子函数时会用到|IF DBMS_SQL.IS_OPEN(c) THEN ,    DBMS_SQL.CLOSE_CURSOR(c);,END IF;|
|循环控制语句|通常可以在循环语句中调用open_cursor、parse、execute、close_cursor子函数,循环语句有for loop、while loop|FOR syn_rec IN syn_cur    
  LOOP    
      sqlstr := 'DROP SYNONYM ' || syn_rec.synonym_name;    
      tCursor := dbms_sql.open_cursor;    
      dbms_sql.parse(tCursor, sqlstr, dbms_sql.NATIVE);    
      RetVal := dbms_sql.execute(tCursor);    
      dbms_sql.close_cursor(tCursor);    
  END LOOP;|
|边界值|构造要解析的sql语句长度等于32k、在(32k,2M)时是否能正确解析执行|  
|
|并发场景|1、默认会话打开的最大游标数上限为300；,2、根据dbms_sql子函数执行流程和使用场景，使用testkill框架并发执行，根据数据库对象分类如下：,table的并发：ddl、dml、select、ddl+dml+select组合操作,plsql过程体对象的并发：ddl、exec、过程体之间的嵌套调用,table和plsql过程体对象之间的并发使用场景可以参考之前已有的ci用例,3、并发测试时当并发数超过默认支持最大游标数量300时，检查数据库状态；,4、存储过程中动态执行ddl操作时，检查并发执行时否出现死锁卡主问题；,5、用例中打开游标不主动关闭时，随着并发数的增加，检查cursor资源是否存在泄露,6、参考实际场景使用的,  
|1、创建存储过程    
  create or replace procedure proc_exec_008(n1 int) as    
  vsql varchar(2000);    
  begin    
  vsql := '    
  create or replace procedure proc_exec_007(p1 int ) as    
  begin    
  dbms_output.put_line(p1);    
  execute immediate ''drop procedure proc_exec_008'';    
  end;';    
  execute immediate vsql;    
  execute immediate 'begin proc_exec_007(:x1); end;' using n1;    
  end;    
  /    
  2、调用    
  begin    
  proc_exec_008(9);    
  end;    
  /|


#### 3.2.3集群使用场景：

|分类|场景|
|---|---|
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,实例间串行操作|1、DDL场景：,1)、CREATE：数据库对象在实例间同步创建，实例1执行open_cursor、parse、close_cursor后，实例2可以查询并使用这些对象,语句包含但不限于：,create table,create [or replace] view,create [or replace] synonym,create sequence,create [or replace] function,create [or replace] procedure,create [or replace] package,create [or replace] type,create [or replace] type body,create [or replace] trigger等,2)、ALTER：实例1执行open_cursor、parse、close_cursor后，实例2可以感知对象结构定义变化,语句包含但不限于：,alter table add column,alter table drop column,alter table rename to,alter table modify column,alter table add partition,alter table drop partition,alter table truncate partition,alter sequence等,3)、DROP：实例1执行open_cursor、parse、close_cursor后，实例2检查数据库对象不存在，无法使用,语句包含但不限于：,drop table,drop view,drop sequence,drop function,drop procedure,drop package,drop type,drop trigger等,4)、TRUNCATE：实例1执行open_cursor、parse、close_cursor后，实例2查看表数据为空，语句为：truncate table,2、DML场景：,1)、INSERT：实例1执行open_cursor、parse、close_cursor后，实例2可以查看到新增的数据,2)、UPDATE：实例1执行open_cursor、parse、close_cursor后，实例2可以查看到更新后的数据,3)、DELETE：实例1执行open_cursor、parse、close_cursor后，实例2可以检查数据已删除,5)多实例执行ddl和dml时，检测死锁状态(功能覆盖)|
|  
,  
,  
,  
,实例间并发操作|根据要解析的sql语句类型和应用对象，使用testkill框架并发执行游标操作子函数，列举如下：,sql语句类型：,1、DDL语句：create+alter+drop组合形式，实例1和实例2并发执行,2、DML语句：insert+update+delete组合形式，实例1和实例2并发执行,3、DDL+DML语句组合形式，实例1和实例2并发执,4、DQL语句：select语句中带有order by、where、limit、not in、not exists、case when子句等,5、PLSQL过程体对象：匿名块、存储过程、自定义函数、自定义包、过程体之间的嵌套调用等,应用对象：,常用的有匿名块、存储过程、自定义函数、自定义包以及过程体之间的嵌套使用。|


### 3.2.4HA使用场景(实际验证查看结果)

|分类|场景|
|---|---|
|  
,  
,  
,  
,  
,主备间数据同步|1、DDL操作：,主节点调用DBMS_SQL.PARSE函数时可以正常执行DDL操作，备节点调用DBMS_SQL.PARSE和EXECUTE时则报错,可以正常调用OPEN_CURSOR、IS_OPEN、CLOSE_CURSOR子函数操作,需检查数据库对象已同步至备节点,2、DML操作,主节点调用DBMS_SQL.EXECUTE函数可以正常执行DML操作，备节点调用DBMS_SQL.EXECUTE时则报错,可以正常调用OPEN_CURSOR、PARSE、IS_OPEN、CLOSE_CURSOR子函数操作,需检查数据已同步至备节点,3、DQL,主备节点可以正常调用各子函数执行查询操作,4、PLSQL过程体对象调用,主备节点可以正常调用各子函数执行过程体对象，遵循主读写备只读机制|
|主备间切换操作|主节点执行完DBMS_SQL操作后，执行主备切换(switchover)操作，新主机可以继续执行DBMS_SQL操作,切换完成后检查游标资源是否泄露(v$open_cursor)|
|主备间故障操作|1、备机出现故障时，主机可以继续正常执行DBMS_SQL操作,2、主节点出现故障时，执行failover切换后的新主机可以正常执行DBMS_SQL操作,切换完成后检查游标资源是否泄露(v$open_cursor)|


2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


   电子表格

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

  


  


## Comments:

|  [](null)  ,1.每个函数的异常情况，返回的异常错误码，异常处理句柄；异常发生，过程体执行结束后cursor是否正常释放；,2.stmt实际获取数据的大小，比如select 语句返回大数据量；,3.并发验证打开大量cursor是否存在资源泄露；,4.cursor的复用；,5.HA场景要验证；,6.集群，多实例DDL/DML触发死锁的情况；,7.权限详细验证。 结合   security_level 验证，是否使用AUTHID CURRENT_USER编译，parse的内容中使用对象的schema不是当前的schema 当前用户是否有对象的访问权限、user1.proc1中调用user2.proc2 等场景,8.传参方式：按位置、名称、混合？,Posted by zhangxin at 十一月 24, 2023 14:16|
|---|
