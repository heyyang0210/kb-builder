Created by 赖美全, last modified by  邬建川 on 六月 13, 2024

*---------------以下为正文开始分隔线-----------------*  *GET_SQL_HASH --- 简单 done*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/66164a89009f91eb87f36f1a](https://pingcode.yasdb.com/ship/ideas/66164a89009f91eb87f36f1a)    *?*

## FORMAT_ERROR_BACKTRACE

*#YASHAN-2829 新增DBMS_UTILITY系统包子函数*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/66276c48fd997db58adfd88c](https://pingcode.yasdb.com/pjm/items/66276c48fd997db58adfd88c)    *?*    
  *#YDBRD-26620 新增DBMS_UTILITY系统包子函数*

##   [1. 总述](#1-总述)  

支持DBMS_UTILITY系统包子函数，提供了多种工具类子程序。

###   [1.1 需求来源](#11-需求来源)  

产品化需求，ORACLE兼容场景。

需求范围：

- 单机
- 分布式
- 集群


###   [1.2 调研文档](#12-调研文档)  

  [调研文档：DBMS_UTILITY系统包子函数](https://conf.yasdb.com/pages/viewpage.action?pageId=150630661)  

###   [1.3 需求分析](#13-需求分析)  

该特性新增以下子过程/函数：

- GET_HASH_VALUE
- GET_TIME
- FORMAT_ERROR_BACKTRACE
- COMMA_TO_TABLE
- TABLE_TO_COMMA
- ACTIVE_INSTANCES    **参考gv$instance视图**
- CURRENT_INSTANCE
- DB_VERSION    **参考v$version**
- GET_ENDIANNESS
- GET_PARAMETER_VALUE    **参考v$parameter**
- GET_SQL_HASH
- IS_BIT_SET
- IS_CLUSTER_DATABASE    **参考v$instance视图的PARALLEL字段**
- NAME_RESOLVE
- NAME_TOKENIZE
- OLD_CURRENT_SCHEMA
- OLD_CURRENT_USER
- PORT_STRING


|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|术语1|描述|是|业界资料链接|
|术语2|描述|无|原创技术，参考技术设计链接|


##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|高级函数|DBMS_UTILITY.GET_HASH_VALUE|计算给定字符串的哈希值，哈希值落在给定的范围内。|是|
|高级函数|DBMS_UTILITY.GET_TIME|返回一个数值用于表示当前时间，以百分之一秒为单位。|是|
|高级函数|DBMS_UTILITY.GET_ENDIANNESS|获取数据库平台的字节序。|是|
|高级函数|DBMS_UTILITY.IS_CLUSTER_DATABASE|判断数据库是在集群模式，只有RAC部署返回为true。|是|
|高级函数|DBMS_UTILITY.OLD_CURRENT_SCHEMA|返回当前会话的SCHEMA。|是|
|高级函数|DBMS_UTILITY.OLD_CURRENT_USER|返回当前会话的USER。|是|
|高级函数|DBMS_UTILITY.IS_BIT_SET|检查给定的RAW变量对应位置的bit是否被设置。|是|
|高级函数|DBMS_UTILITY.PORT_STRING|返回操作系统的平台以及版本。|是|
|高级函数|DBMS_UTILITY.CURRENT_INSTANCE|返回当前连接实例id。|是|
|高级过程|DBMS_UTILITY.ACTIVE_INSTANCES|返回当前活跃实例id。|是|
|高级函数|DBMS_UTILITY.FORMAT_ERROR_BACKTRACE|返回PLSQL调用错误信息。|是|
|高级过程|DBMS_UTILITY.DB_VERSION|返回数据库版本信息。|是|
|高级过程|DBMS_UTILITY.NAME_RESOLVE|返回对象名字解析信息。|是|
|高级过程|DBMS_UTILITY.GET_SQL_HASH|返回SQL的MD5的hash值信息。|是|
|高级包过程|DBMS_UTILITY.COMMA_TO_TABLE|将逗号分隔的名字字符串转换成数组|是|
|高级包过程|DBMS_UTILITY.TABLE_TO_COMMA|将名字数组转换成逗号分隔的字符串|是|
|高级包过程|DBMS_UTILITY.NAME_TOKENIZE|将形如 **a [. b [. c ]][@ dblink ]**的字符串转换为4部分：a,b,c,dblink进行输出|是|
|高级包函数|DBMS_UTILITY.GET_PARAMETER_VALUE|通过参数名拿取,v$parameter中的参数值|是|
|高级包类型|DBMS_UTILITY.LNAME_ARRRAY|关联数组定义：  **TYPE LNAME_ARRAY IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;**|是|
|高级包类型|DBMS_UTILITY.UNCL_ARRAY|关联数组定义：  **TYPE UNCL_ARRAY IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;**|是|
|高级包类型|DBMS_UTILITY.INSTANCE_RECORD|TYPE INSTANCE_RECORD IS RECORD (inst_number   NUMBER, inst_name     VARCHAR(64));|是|
|高级包类型|DBMS_UTILITY.INSTANCE_TABLE|TYPE INSTANCE_TABLE IS TABLE OF INSTANCE_RECORD;|是|
|错误码|ERR_PL_TOO_MANY_PART_OF_NAME 报错信息：input object has too many parts|name_tokenize/name_resolve/comma_to_table 校验输入时，对于只能接收 a.b.c这种小于3个的情况，如果多了，就报这个错。以及dblink中@后面的identifier多于一个也报这个错|是|


##   [3. 规格与约束](#3-规格与约束)  

|规格/约束|描述|说明|备注|
|---|---|---|---|
|规格|table_to_comma 关联数组中的table不进行校验，可以是任意字符串，即不合法的对象名||表现同oracle|
|规格|comma_to_table，对于uncl_array则每个name的格式为   **a [. b [. c ]][ @ d ]**  。 对于lname_array格式为:  **a [. b]***  . 并对a,b,c,d这些name进行命名合法性校验|object标识沿用anchorbase数据约束规格||
|规格|name_tokenize，输入的一般格式为   **a [. b [. c ]][@ dblink ]**  ，尝试读identifier时：如果第一个字符是合法的，向后读到不合法字符时停止。如果第一个字符不合法则会报错。|存在一些oracle报错但是yashandb不报错，返回对应的nextpos的场景 但是保证解析出来的   *a,b,c,dbLink*   都是合法的|与oracle不一致|
|规格|get_parameter_value的 listno为int，无实际意义，兼容。|预留|与oracle不一致|
|规格|GET_HASH_VALUE参数范围和ORACLE保持一致，哈希算法采用内部实现。|hash算法跟oracle不一致|与oracle不一致|
|规格|GET_TIME返回当前时间戳。|anchorbase输出为i64值,oracle输出为i32的值|与oracle不一致|
|规格|IS_BIT_SET对n的范围进行校验，只能是正整数，且小于RAW变量所能表示的位数。|oracle允许n的取值大于raw变量表示的位数，且最大支持到n+5字节的位数；另外n还能取值0和负数，且表现难以推断|与oracle不一致|
|约束|COMMA_TO_TABLE，TABLE_TO_COMMA, ACTIVE_INSTANCES中的内置UDT在分布式下不支持，函数/过程不支持。||分布式不支持|


##   [4. 特性](#4-特性)  

###   [4.1 GET_HASH_VALUE子函数](#41-get-hash-value子函数)  

计算给定字符串的哈希值，哈希值落在给定的范围内。

####   [语法](#语法)  

```
DBMS_UTILITY.GET_HASH_VALUE (
   name      VARCHAR2, 
   base      NUMBER, 
   hash_size NUMBER)
  RETURN NUMBER;

```

####   [参数](#参数)  

|参数名|描述|
|---|---|
|name|需要计算哈希值的字符串|
|base|哈希值的起始值|
|hash_size|哈希值的大小|


###   [使用说明](#使用说明)  

基于字符串的哈希值，落在范围[base, base + hash_size -1]里。

- 在oracle中，base和hash_size的范围都是int，即[-2  31. 2  31 - 1];
- 在oracle中，base值如果是浮点数，会四舍五入取整。如1.2 => 1, 1.5 => 2, 1.7 => 2;
- 在oracle中，hash_size取值不能是0、浮点数；


和oracle保持一致，新增以下规格：

- base和hash_size的实际类型是INT，范围是[-2  31. 2  31 - 1];
- base值如果是浮点数，会四舍五入取整；
- hash_size取值不能是0或浮点数；
- 因为采用的是内部的哈希函数，所以hash值与oracle的结果不一致；


####   [用例](#用例)  

```
select DBMS_UTILITY.GET_HASH_VALUE('abc', 1000, 2048) from dual;

select DBMS_UTILITY.GET_HASH_VALUE('ABC', 1000, 2048) from dual;

select DBMS_UTILITY.GET_HASH_VALUE('abc', 0, -1) from dual;

```

###   [4.2 GET_TIME子函数](#42-get-time子函数)  

该函数返回一个数值（系统时间戳）用于表示当前时间，以百分之一秒为单位。用于确定时间间隔时需要考虑数字的符号。

####   [语法](#语法-1)  

```
DBMS_UTILITY.GET_TIME
  RETURN NUMBER;

```

####   [使用说明](#使用说明-1)  

用于确定间隔时必须考虑数字的符号。在两个负数的情况下，应用程序的逻辑是必须允许第一个（较早的）数字大于接近零的第二个（较晚的）数字。同样的，应用程序还应该允许第一个（较早的）数字为负数，而第二个（较晚的）数字为正数。

####   [用例](#用例-1)  

```
-- 获取当前时间
select DBMS_UTILITY.GET_TIME() from dual;

-- 输出200hsec = 2 sec
set serveroutput on;
DECLARE
  start_time NUMBER;
  end_time NUMBER;
BEGIN
  start_time:= DBMS_UTILITY.GET_TIME();
  DBMS_LOCK.SLEEP(2);
  end_time:= DBMS_UTILITY.GET_TIME() - start_time;
  DBMS_OUTPUT.PUT_LINE('elapsed = ' || end_time || 'hsecs');
END;
/
set serveroutput off;


```

###   [4.3 GET_ENDIANNESS子函数](#43-get-endianness子函数)  

该函数获取数据库平台的字节序。

####   [语法](#语法-2)  

```
  DBMS_UTILITY.GET_ENDIANNESS
   RETURN NUMBER;

```

####   [使用说明](#使用说明-2)  

返回 NUMBER 值，指示数据库平台的字节序：1 表示大端字节序，2 表示小端字节序。

####   [用例](#用例-2)  

```
select DBMS_UTILITY.GET_ENDIANNESS() from dual;

```

###   [4.4 IS_CLUSTER_DATABASE子函数](#44-is-cluster-database子函数)  

该函数判断数据库是否是共享集群模式。

####   [语法](#语法-3)  

```
DBMS_UTILITY.IS_CLUSTER_DATABASE
  RETURN BOOLEAN;

```

###   [使用说明](#使用说明-3)  

处于共享集群模式就返回TRUE，否则返回FALSE。分布式和单机部署均返回FALSE。

该返回值与    `v$instance`    的    `PARALLEL`    取值相同，也与配置参数    `CLUSTER_DATABASE`    取值相同。

####   [用例](#用例-3)  

```
select value from v$parameter where name='cluster_database';
set serveroutput on;
BEGIN
  IF DBMS_UTILITY.IS_CLUSTER_DATABASE THEN
    DBMS_OUTPUT.PUT_LINE('TRUE');
  ELSE
    DBMS_OUTPUT.PUT_LINE('FALSE');
  END IF;
END;
/
set serveroutput off;

-- oracle rac执行结果
SQL&gt; select value from v$parameter where name='cluster_database';

VALUE
--------------------------------------------------------------------------------
TRUE

SQL&gt; set serveroutput on;
BEGIN
  IF DBMS_UTILITY.IS_CLUSTER_DATABASE THEN
    DBMS_OUTPUT.PUT_LINE('TRUE');
  ELSE
    DBMS_OUTPUT.PUT_LINE('FALSE');
  END IF;
END;
/
set serveroutput off;SQL&gt;   2    3    4    5    6    7    8  TRUE

PL/SQL procedure successfully completed.

```

###   [4.5 OLD_CURRENT_SCHEMA子函数](#45-old-current-schema子函数)  

返回当前会话的SCHEMA。

####   [语法](#语法-4)  

```
DBMS_UTILITY.OLD_CURRENT_SCHEMA 
 RETURN VARCHAR2;

```

####   [用例](#用例-4)  

```
-- 获取当前会话的schema
select DBMS_UTILITY.OLD_CURRENT_SCHEMA() from dual;

-- 切换schema
create user test identified by Cod-2022;
grant dba to test;
alter session set current_schema = test;
select DBMS_UTILITY.OLD_CURRENT_SCHEMA() from dual;

```

###   [OLD_CURRENT_USER子函数](#old-current-user子函数)  

返回当前会话的USER。

####   [语法](#语法-5)  

```
DBMS_UTILITY.OLD_CURRENT_USER 
 RETURN VARCHAR2;

```

####   [用例](#用例-5)  

```
-- 获取当前的用户
select DBMS_UTILITY.OLD_CURRENT_USER() from dual;

create user test identified by Cod-2022;
grant dba to test;
-- 切换schema
alter session set current_schema = test;
select DBMS_UTILITY.OLD_CURRENT_USER() from dual;
-- 切换用户
conn test/Cod-2022;
select DBMS_UTILITY.OLD_CURRENT_USER() from dual;

```

####   [4.6 IS_BIT_SET子函数](#46-is-bit-set子函数)  

检查给定的RAW变量对应位置的bit是否被设置（为1）。

####   [语法](#语法-6)  

```
DBMS_UTILITY.IS_BIT_SET (
   r     IN    RAW,
   n     IN    NUMBER)
 RETURN NUMBER;

```

####   [参数](#参数-1)  

|参数名|描述|
|---|---|
|r|需要检查的RAW变量|
|n|需要检查的位置|


###   [使用说明](#使用说明-4)  

如果对应位置的bit为1则返回1。从高位到低位进行编号，最低位是1。

- oracle只能对大于3个字节的r变量进行判断；
- oracle允许n变量输入值为0或负数，但表现难以推断；
- 当n变量为浮点数时，表现与n向下取整相同；
- 如果r有n个字节，则oracle允许对n+5个字节的位置进行判断，补充的5个字节满足一定的规律。如 '89ABCDEF'会补充5个字节'89ABCDEF89'，如'456789ABCDEF'会补充5个字节'456789ABCD’;


为方便实现以及便于理解，新增以下规格：

- 不限制r的长度；
- n只能取正整数，其它类型报错；
- 当n大于r对应的位数时报错；


####   [用例](#用例-6)  

```
-- 报错
SELECT DBMS_UTILITY.IS_BIT_SET(HEXTORAW('EF'), 1) FROM DUAL;
-- 报错
SELECT DBMS_UTILITY.IS_BIT_SET(HEXTORAW('CDEF'), 1) FROM DUAL;
-- 报错
SELECT DBMS_UTILITY.IS_BIT_SET(HEXTORAW('ABCDEF'), 1) FROM DUAL;
-- 报错
SELECT DBMS_UTILITY.IS_BIT_SET(HEXTORAW('89ABCDEF'), 73) FROM DUAL;

select DBMS_UTILITY.IS_BIT_SET(HEXTORAW(LPAD('AB',2000,'AB')),8000) from dual;
select DBMS_UTILITY.IS_BIT_SET(HEXTORAW(LPAD('AB',2000,'AB')),8040) from dual;
-- 报错
select DBMS_UTILITY.IS_BIT_SET(HEXTORAW(LPAD('AB',2000,'AB')),8041) from dual;

select DBMS_UTILITY.IS_BIT_SET(HEXTORAW(LPAD('AB',4000,'AB')),16000) from dual;
select DBMS_UTILITY.IS_BIT_SET(HEXTORAW(LPAD('AB',4000,'AB')),16040) from dual;
-- 报错
select DBMS_UTILITY.IS_BIT_SET(HEXTORAW(LPAD('AB',4000,'AB')),16041) from dual;

```

###   [4.7 PORT_STRING子函数](#47-port-string子函数)  

返回操作系统的平台以及版本。

####   [语法](#语法-7)  

```
DBMS_UTILITY.PORT_STRING
  RETURN VARCHAR;

```

###   [用例](#用例-7)  

```
select DBMS_UTILITY.PORT_STRING() from dual;
-- oracle的返回内容
DBMS_UTILITY.PORT_STRING()
--------------------------------------------------------------------------------
x86_64/Linux 2.4.xx

-- uname输出
Linux AchorBase 3.10.0-1160.el7.x86_64 #1 SMP Mon Oct 19 16:18:59 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux

-- 不修改输出
DBMS_UTILITY.PORT_ST                  
------------------------------------- 
x86_64/Linux 3.10.0-1160.el7.x86_64 

-- 修改输出
DBMS_UTILITY.PORT_ST                  
------------------------------------- 
x86_64/Linux 3.10.xx 

```

## GET_SQL_HASH

语法

```
DBMS_UTILITY.GET_SQL_HASH (
   name          IN   VARCHAR2,
   hash          OUT  RAW,
   pre10ihash    OUT  NUMBER)
  RETURN NUMBER;
```

  


|参数|解释|
|:---|:---|
|name|要进行哈希计算的字符串。|
|hash|用于存储所有返回 16 字节哈希值的可选字段。|
|pre10ihash|不支持此参数，返回结果为   NULL  。|


hash值采用md5算法得到

返回值，取hash值的后4个字节，强转为int类型返回

name 为NULL时，返回值为null

**返回值**

基于输入字符串的哈希值（最后 4 个字节）。

MD5 计算一个 16 字节的哈希值，但只返回最后 4 个字节，从而得到一个实际数字。也可以使用可选的原始参数来获取所有 16 个字节。

示例：

```
set serveroutput on

DECLARE
 h Varchar(32);
 n NUMBER;
 x NUMBER;
BEGIN
  x :=  dbms_utility.get_sql_hash(NULL, h, x);

  dbms_output.put_line('Return Value: ' || TO_CHAR(x));
  dbms_output.put_line('Hash: ' || h);
  dbms_output.put_line('Pre10iHash: ' || TO_CHAR(n));
END;
/

--- out
Return Value: 3151900052
Hash: A0B3A8D4AEFC34DE2BF681CA942DDEBB
Pre10iHash: 952265716


DECLARE
 h Raw(32);
 n NUMBER;
 x NUMBER;
BEGIN
  x:=dbms_utility.get_sql_hash('select 1 from dual', h, x);
  
  dbms_output.put_line('Hash: ' || h);
  dbms_output.put_line('Pre10iHash: ' || TO_CHAR(n));
END;
/
```

  
  ​

## CURRENT_INSTANCE 

这个函数返回当前连接的实例号。参考v$instance/gv$instance的instance_number字段。

语法

```
DBMS_UTILITY.CURRENT_INSTANCE
   RETURN NUMBER;
```

   

参数：

无

返回值：

instance_number值

示例：

```
SQL> select dbms_utility.current_instance from dual;
​
CURRENT_INSTANCE
----------------
           1
​
SQL> select dbms_utility.current_instance() from dual;
​
DBMS_UTILITY.CURRENT_INSTANCE()
-------------------------------
                  1
                  
​
set serveroutput on
declare
num number;
begin
   num := dbms_utility.current_instance;
   dbms_output.put_line('Instance: '|| num);
end;
/
SQL>   2    3    4    5    6    7  /
Instance: 1
​
PL/SQL procedure successfully completed.
```

  
  ​    
     

## ACTIVE_INSTANCES 

当前过程，返回活跃的instance个数。

分布式和单机，返回的是连接节点的instance_id和instance_name，集群返回的是gv$instance视图上的instance_id和instance_name

语法：

```
TYPE INSTANCE_RECORD IS RECORD (
       inst_number   NUMBER,
       inst_name     VARCHAR(60));
       
TYPE INSTANCE_TABLE IS TABLE OF INSTANCE_RECORD INDEX BY BINARY_INTEGER;


DBMS_UTILITY.ACTIVE_INSTANCES (
   instance_table   OUT INSTANCE_TABLE,
   instance_count   OUT NUMBER);
```

  


  


参数：

|PROCEDURE|描述|
|:---|:---|
|instance_table|包含活动实例编号和名称的列表。当没有实例启动时，列表为空。|
|instance_count|活跃实例个数|


返回值：

无

示例：

```
set serveroutput on
DECLARE 
 inst_tab dbms_utility.instance_table;
 inst_cnt NUMBER; 
BEGIN
    dbms_utility.active_instances(inst_tab, inst_cnt);
    for i in 1..inst_cnt loop            DBMS_OUTPUT.put_line(inst_tab(i).inst_number || ' = ' || inst_tab(i).inst_name);
    end loop;
END;
/
SQL>   2    3    4    5    6    7    8    9  /
1 = AchorBase:XE
​
PL/SQL procedure successfully completed.
​
typedef struct instance_table {
    int inst_number;
    char* inst_name;
} instance_table;
​
​
set serveroutput on
declare  
    CURSOR  emp_cur IS SELECT INSTANCE_NUMBER, INSTANCE_NAME FROM GV$INSTANCE ORDER BY INSTANCE_NUMBER, INSTANCE_NAME;
    TYPE INSTANCE_RECORD IS RECORD (
       inst_number   NUMBER,
       inst_name     VARCHAR(60)
    );
    TYPE INSTANCE_TABLE IS TABLE OF INSTANCE_RECORD;
    
    ins_record INSTANCE_RECORD;
    ins_table INSTANCE_TABLE := INSTANCE_TABLE();
​
BEGIN
    FOR v_emp_rec IN emp_cur LOOP
 --       count := count + 1;
        ins_recnnord.INST_NUMBER := v_emp_rec.INSTANCE_NUMBER;
        ins_record.INST_NAME := v_emp_rec.INSTANCE_NAME;
        ins_table(1) := ins_record;
    END LOOP;
END;
/
```

  


```
// INSTANCE_RECORD类型用VarRecord表示
typedef struct StVarRecord {
    CodUint16 count;  // member数量
    CodBool   isObject;
    CodUint8  unused[5];
    Variant** members;
} VarRecord;
​
// INSTANCE_TABLE用VarVarray表示，其中udtDef为VarRecord类型
typedef struct StVarVarray {
    VarrayMembers* members;
    CodPointer     udtDef;
    CodUint32      limit;
} VarVarray;
```

  


## FORMAT_ERROR_BACKTRACE 

即使子程序是从外部作用域中的异常处理程序调用的，该函数也会在引发异常的位置显示调用堆栈。

- 显示3类信息，错误码，高级包名字以及错误行号
- 超过2000字节截断后面的内容


格式为：

YAS  -  [  errcode  ]:   at   [  objectName  ],   line   [  number  ]

新增错误码：ERR_ANS_PDEBUG_BACKTRACE， 表示PLSQL出现异常点，errmsg:   at %s, line %d

  


语法：

```
DBMS_UTILITY.FORMAT_ERROR_BACKTRACE 
  RETURN VARCHAR2;
```

  


返回值：

回溯字符串。如果当前没有处理错误，则返回NULL字符串。

  


  


示例

```
drop table if exists YDBRD14156_tb_proc_01;
create table YDBRD14156_tb_proc_01 (id int,name varchar(200),class_id int);
insert into YDBRD14156_tb_proc_01 values(1, 'jack'  ,1);
insert into YDBRD14156_tb_proc_01 values(2, 'john'  ,1);
insert into YDBRD14156_tb_proc_01 values(3, 'harry',2);
insert into YDBRD14156_tb_proc_01 values(4, 'hemin',2);
insert into YDBRD14156_tb_proc_01 values(10,null,null);
commit;
​
--msg表
drop table if exists YDBRD14156_tb_proc_02_1;
create table YDBRD14156_tb_proc_02_1 (times varchar(2000),err_msg varchar(2000),obj_name varchar(2000));
​
create or replace procedure YDBRD14156_proc_excep_09(c1 in int,c2 int) is
    n1 varchar(200);
    n2 varchar(200);
begin
select name into n1 from YDBRD14156_tb_proc_01 where id = c1;
dbms_output.put_line('n1 = '||n1);
begin
select name into n2 from YDBRD14156_tb_proc_01 where id = c2;
dbms_output.put_line('utility_proc2_msg0:'||dbms_utility.format_error_stack);
insert into YDBRD14156_tb_proc_02_1 values (systimestamp,dbms_utility.format_error_stack,dbms_utility.format_call_stack);
end;
EXCEPTION
        WHEN NO_DATA_FOUND THEN
            dbms_output.put_line('utility_proc1_msg1:'||dbms_utility.format_error_stack);
insert into YDBRD14156_tb_proc_02_1 values (systimestamp,dbms_utility.format_error_stack,dbms_utility.FORMAT_ERROR_BACKTRACE);
WHEN OTHERS THEN
            dbms_output.put_line('utility_proc1_msg2:'||dbms_utility.format_error_stack);
insert into YDBRD14156_tb_proc_02_1 values (systimestamp,dbms_utility.format_error_stack,dbms_utility.format_call_stack);
end;
/
​
​
---
call YDBRD14156_proc_excep_09(3,7);
```

## DB_VERSION 

此  **过程**  返回数据库的版本信息。

语法：

  


```
dbms_utility.db_version (
version       OUT VARCHAR2,
compatibility OUT VARCHAR2);
```

​

返回值：

无

参数：

由于现在都是兼容的，所以compatibility字段都返回的是大版本信息

|参数|描述|
|:---|:---|
|version|一个字符串，表示数据库的内部软件版本|
|compatibility|数据库的兼容性设置由“compatible”init决定。如果没有在兼容性配置文件上指定，NMULL返回|


  


示例：

```
set serveroutput on
​
DECLARE
 ver    char(20);
 compat char(12);
BEGIN
  dbms_utility.db_version(ver, compat);
  dbms_output.put_line('Version: ' || ver ||' Compatible: ' || compat);
END;
/
```

  


  


## NAME_RESOLVE 

此过程解析给定的名称，包括必要的同义词转换和授权检查。

语法：

```
DBMS_UTILITY.NAME_RESOLVE (
   name          IN  VARCHAR2, 
   context       IN  NUMBER,
   schema        OUT VARCHAR2, 
   part1         OUT VARCHAR2, 
   part2         OUT VARCHAR2,
   dblink        OUT VARCHAR2, 
   part1_type    OUT NUMBER, 
   object_number OUT NUMBER);
```

  


返回值:

无

参数：

|PARAMETER|DESCRIPTION|
|:---|:---|
|name|对象名。格式[[a.]b.]c[@d]。a,b,c是SQL对象，d是dblink.|
|context|[0,10]范围的正数 - table1 - PL/SQL (for 2 part names)2 - sequences3 - trigger4 - Java Source5 - Java resource6 - Java class7 - type8 - Java shared data9 - index   **实际上10也可以**|
|schema|对象的schema，如果未指定，名字由对象所属schema决定|
|part1|名字的第一部分。此名称的类型指定为part1_type(同义词或包)。|
|part2|如果非null，则这是子程序名。如果part1非null，则子程序位于part1所指示的包内。如果part1为NULL，则子程序是顶级子程序|
|dblink|如果该值为非null，则数据库链接被指定为name的一部分，或者name是一个同义词，该同义词解析为具有数据库链接的内容。在这种情况下，如果需要进一步的名称转换，则必须调用DBMS_UTILITY。此远程节点上的NAME_RESOLVE过程。|
|part1_type|Type of   part1   ,对应的是obj$系统表中的type类型，具体参考：表oracle object type|
|object_number|object Id|


单机&分布式&集群不支持对象类型：

java store，java resource，java class，java shared data

补充说明：

dblink的含义：一个数据库到另外一个数据库的路径对象，dblink允许查询远程表以及执行远程程序。

访问其他数据库示例  select * from user@dblink  ，这样可以访问其他数据库的user表

context   0   =   table    
  context   1   = function, procedure, package    
  context   2   = sequence    
  context   3   = trigger     
  context   4   = java store     
  context   5   = java resource     
  context   6   = java class     
  context   7   = type    
  context   8   = java shared data    
  context   9   = index    
  ​    
  part1_type   5   = synonym    
  part1_type   7   = procedure (top level)    
  part1_type   8   = function (top level)    
  part1_type   9   = package     
  ​

|CONTEXT|描述|备注|
|:---|:---|:---|
|0 table|schema为owner字段，part1为表名，part2缺省|  
|
|1 function|schema为owner字段，part1缺省，part2为function名|  
|
|1 package|schema为owner字段，part1包名，part2为子程序名|  
|
|1 procedure|schema为owner字段，part1缺省，part2为procedure名|  
|
|2 sequence|schema为owner字段，part1为sequence名，part2缺省|  
|
|3 trigger|schema为owner字段，part1为trigger名，part2缺省|  
|
|4|报错object not exist|不支持|
|5|报错object not exist|不支持|
|6|报错object not exist|不支持|
|7 type|schema为owner字段，part1为type名，part2缺省|  
|
|8|报错object not exist|不支持|
|9|schema为owner字段，part1为index名，part2缺省|  
|


  


补充说明:

- 当name为a.b.c@test格式时，part1_type输出为0， object_number输出为0，不会去校验对象是否存在
-   



```
set serveroutput on
​
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('sys.t1', 0, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
--- out
Owner:  SYS
Table:  T1
Column:
Link:
part1_type:   2
object_number:   81776
​
PL/SQL procedure successfully completed.
​
​
---package
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('utl_file.fopen', 1, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
--- out
Owner:  SYS
Table:  UTL_FILE
Column: FOPEN
Link:
part1_type:   9
object_number:   7661
​
PL/SQL procedure successfully completed.
​
​
--- 
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('sys.t1', 11, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
​
--- procedure1
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('DVSYS.SET_FACTOR', 1, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
---- out
Owner:  DVSYS
Table:
Column: SET_FACTOR
Link:
part1_type:   7
object_number:   75573
​
PL/SQL procedure successfully completed.
​
--- procedure2
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('SET_FACTOR.c1.t1', 1, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
---- out
ORA-06563: name has too many parts
ORA-06512: at "SYS.DBMS_UTILITY", line 156
ORA-06512: at line 9
​
​
--- function  
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('SYS.GET_MAX_CHECKPOINT', 1, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
Owner:  SYS
Table:
Column: GET_MAX_CHECKPOINT
Link:
part1_type:   8
object_number:   10450
​
PL/SQL procedure successfully completed.
​
​
--- sequence
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('SYS.UTL_RECOMP_SEQ', 2, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
--- out
Owner:  SYS
Table:  UTL_RECOMP_SEQ
Column:
Link:
part1_type:   6
object_number:   76652
​
PL/SQL procedure successfully completed.
​
DECLARE
 s  VARCHAR2(30);
 p1 VARCHAR2(30);
 p2 VARCHAR2(30);
 d  VARCHAR2(30);
 o  NUMBER(10);
 ob NUMBER(10); 
BEGIN
  dbms_utility.name_resolve('DVSYS.PLSQL_STACK_ARRAY', 7, s, p1, p2, d, o, ob);
​
  dbms_output.put_line('Owner:  ' || s);
  dbms_output.put_line('Table:  ' || p1);
  dbms_output.put_line('Column: ' || p2);
  dbms_output.put_line('Link:   ' || d);
  dbms_output.put_line('part1_type:   ' || o);
  dbms_output.put_line('object_number:   ' || ob);
END;
/
```

  


  
  ​

错误码：

ERR_ANK_DBVERSION_INCOMPATIBLE    
  ​

```
// 已有错误码
ERR_ANK_OBJECT_NOT_FOUND  "%s does not exist"
​
```

  


object存在，但是类型和指定的context不一致时。按照该对象不存在报错。这也是系统内自然的报错。

#### anchorbase object type

   0  ,   'NEXT OBJECT'  ,   1  ,   'TABLE'  ,   2  ,   'VIEW'  ,   3  ,   'DYNAMIC_VIEW'  ,   4  ,   'INDEX'  ,   5  ,   'SEQUENCE'  ,   6  ,   'AC'  ,      
                        7  ,   'TABLE PARTITION'  ,   8  ,   'INDEX PARTITION'  ,   9  ,   'LOB'  ,   10  ,   'LOB PARTITION'  ,   11  ,   'SYNONYM'  ,   12  ,   'UDF'  ,    
                                13  ,   'PROCEDURE'  ,   14  ,   'PACKAGE'  ,   15  ,   'TRIGGER'  ,   16  ,   'AC PARTITION'  ,   17  ,   'AUDIT POLICY'  ,   18   ,   'JOB'  ,    
                                19  ,   'PACKAGE BODY'  ,   20  ,   'TYPE'  ,   21  ,   'TYPE BODY'  ,   22  ,   'LIBRARY'  ,   23  ,   'TABLE SUBPARTITION'  ,   24  ,   'INDEX SUBPARTITION'  ,    
                        25  ,   'LOB SUBPARTITION'  ,   26  ,   'MATERIALIZED VIEW'  ,   27  ,   'DATABASE LINK'  ,   28  ,   'OUTLINE'  ,   31  ,   'DIRECTORY'

  


#### 表oracle object type

|TYPE#|ID|描述|
|:---|:---|:---|
|NEXT OBJECT|0|  
|
|INDEX|1|  
|
|TABLE|2|  
|
|CLUSTER|3|  
|
|VIEW|4|  
|
|SYNONYM|5|  
|
|SEQUENCE|6|  
|
|PROCEDURE|7|  
|
|FUNCTION|8|  
|
|PACKAGE|9|  
|
|PACKAGE BODY|11|  
|
|TRIGGER|12|  
|
|TYPE|13|  
|
|TYPE BODY|14|  
|
|TABLE PARTITION|19|  
|
|INDEX PARTITION|20|  
|
|LOB|21|  
|
|LIBRARY|22|  
|
|DIRECTORY|23|  
|
|QUEUE|24|  
|
|JAVA SOURCE|28|  
|
|JAVA CLASS|29|  
|
|JAVA RESOURCE|30|  
|
|INDEXTYPE|32|  
|
|OPERATOR|33|  
|
|TABLE SUBPARTITION|34|  
|
|INDEX SUBPARTITION|35|  
|
|LOB PARTITION|40|  
|
|LOB SUBPARTITION|41|  
|
|CASE (SELECT BITAND(s.xpflags, 8388608 + 34359738368)        FROM sum$ s        WHERE s.obj#=o.obj#)         WHEN 8388608 THEN 'REWRITE EQUIVALENCE'         WHEN 34359738368 THEN 'MATERIALIZED ZONEMAP'         ELSE 'MATERIALIZED VIEW'         END|42|  
|
|DIMENSION|43|  
|
|CONTEXT|44|  
|
|RULE SET|46|  
|
|RESOURCE PLAN|47|  
|
|CONSUMER GROUP|48|  
|
|SUBSCRIPTION|51|  
|
|LOCATION|52|  
|
|XML SCHEMA|55|  
|
|JAVA DATA|56|  
|
|EDITION|57|  
|
|RULE|59|  
|
|CAPTURE|60|  
|
|APPLY|61|  
|
|EVALUATION CONTEXT|62|  
|
|JOB|66|  
|
|PROGRAM|67|  
|
|JOB CLASS|68|  
|
|WINDOW|69|  
|
|SCHEDULER GROUP|72|  
|
|SCHEDULE|74|  
|
|CHAIN|79|  
|
|FILE GROUP|81|  
|
|MINING MODEL|82|  
|
|ASSEMBLY|87|  
|
|CREDENTIAL|90|  
|
|CUBE DIMENSION|92|  
|
|CUBE|93|  
|
|MEASURE FOLDER|94|  
|
|CUBE BUILD PROCESS|95|  
|
|FILE WATCHER|100|  
|
|DESTINATION|101|  
|
|CONTAINER|111|  
|
|SQL TRANSLATION PROFILE|114|  
|
|UNIFIED AUDIT POLICY|115|  
|
|MINING MODEL PARTITION|144|  
|
|LOCKDOWN PROFILE|148|  
|
|HIERARCHY|150|  
|
|ATTRIBUTE DIMENSION|151|  
|
|ANALYTIC VIEW|152|  
|
|MLE LANGUAGE|163|  
|


```
SQL> select text from view$ where obj# = 4883;
​
TEXT
--------------------------------------------------------------------------------
select u.name, o.name, o.subname, o.obj#, o.dataobj#,
       decode(o.type#, 0, 'NEXT OBJECT', 1, 'INDEX', 2, 'TABLE', 3, 'CLUSTER',
              4, 'VIEW', 5, 'SYNONYM', 6, 'SEQUENCE',
              7, 'PROCEDURE', 8, 'FUNCTION', 9, 'PACKAGE',
​
              11, 'PACKAGE BODY', 12, 'TRIGGER',
              13, 'TYPE', 14, 'TYPE BODY',
              19, 'TABLE PARTITION', 20, 'INDEX PARTITION', 21, 'LOB',
              22, 'LIBRARY', 23, 'DIRECTORY', 24, 'QUEUE',
              28, 'JAVA SOURCE', 29, 'JAVA CLASS', 30, 'JAVA RESOURCE',
              32, 'INDEXTYPE', 33, 'OPERATOR',
              34, 'TABLE SUBPARTITION', 35, 'INDEX SUBPARTITION',
              40, 'LOB PARTITION', 41, 'LOB SUBPARTITION',
              42, CASE (SELECT BITAND(s.xpflags, 8388608 + 34359738368)
                FROM sum$ s
                WHERE s.obj#=o.obj#)
              WHEN 8388608 THEN 'REWRITE EQUIVALENCE'
              WHEN 34359738368 THEN 'MATERIALIZED ZONEMAP'
              ELSE 'MATERIALIZED VIEW'
              END,
              43, 'DIMENSION',
              44, 'CONTEXT', 46, 'RULE SET', 47, 'RESOURCE PLAN',
              48, 'CONSUMER GROUP',
              51, 'SUBSCRIPTION', 52, 'LOCATION',
              55, 'XML SCHEMA', 56, 'JAVA DATA',
              57, 'EDITION', 59, 'RULE',
              60, 'CAPTURE', 61, 'APPLY',
              62, 'EVALUATION CONTEXT',
              66, 'JOB', 67, 'PROGRAM', 68, 'JOB CLASS', 69, 'WINDOW',
              72, 'SCHEDULER GROUP', 74, 'SCHEDULE', 79, 'CHAIN',
              81, 'FILE GROUP', 82, 'MINING MODEL', 87, 'ASSEMBLY',
              90, 'CREDENTIAL', 92, 'CUBE DIMENSION', 93, 'CUBE',
              94, 'MEASURE FOLDER', 95, 'CUBE BUILD PROCESS',
              100, 'FILE WATCHER', 101, 'DESTINATION',
              111, 'CONTAINER',
              114, 'SQL TRANSLATION PROFILE',
              115, 'UNIFIED AUDIT POLICY',
              144, 'MINING MODEL PARTITION',
              148, 'LOCKDOWN PROFILE',
              150, 'HIERARCHY',
              151, 'ATTRIBUTE DIMENSION',
              152, 'ANALYTIC VIEW',
              163, 'MLE LANGUAGE',
             'UNDEFINED'),
       o.ctime, o.mtime,
       to_char(o.stime, 'YYYY-MM-DD:HH24:MI:SS'),
       decode(o.status, 0, 'N/A', 1, 'VALID', 'INVALID'),
       decode(bitand(o.flags, 2), 0, 'N', 2, 'Y', 'N'),
       decode(bitand(o.flags, 4), 0, 'N', 4, 'Y', 'N'),
       decode(bitand(o.flags, 16), 0, 'N', 16, 'Y', 'N'),
       o.namespace,
       o.defining_edition,
       decode(bitand(o.flags, (65536+131072+4294967296)),
          4294967296+65536, 'EXTENDED DATA LINK', 65536, 'METADATA LINK',
          131072, 'DATA LINK', 'NONE'),
       case when o.type# in (4,5,7,8,9,11,12,13,14,22,87,114) then
       decode(bitand(o.flags, 1048576), 0, 'Y', 1048576, 'N', 'Y')
     else null end,
       decode(bitand(o.flags, 4194304), 4194304, 'Y', 'N'),
       decode(bitand(o.flags, 134217728), 134217728, 'Y', 'N'),
       case when o.type# in (2,4,7,8,9,12,13) then
       nls_collation_name(nvl(o.dflcollid, 16382))
     when (o.type# = 42
           and exists
           (SELECT 1
        FROM sum$ s
        WHERE s.obj#=o.obj#
        -- not rewrite equivalence or zone map
        and bitand(s.xpflags, 8388608 + 34359738368) = 0)) then
       nls_collation_name(nvl(o.dflcollid, 16382))
     else null end,
       -- DUPLICATED
       decode(bitand(o.flags, 2684354560),
             0, 'N',
             2147483648, 'Y', /* KQDOBREF set */
             2684354560, 'Y', /* both KQDOBREF and KQDOBOAS set */
             'N'),
       -- SHARDED
       decode(bitand(o.flags, 1073741824), 0, 'N', 1073741824, 'Y', 'N'),
       -- EXTERNAL SHARDING (for federated database)
       decode(bitand(o.flags, 34359738368), 0, 'N', 34359738368, 'Y', 'N'),
       -- CREATED_APPID
       o.CREAPPID,
       -- CREATED_VSNID
       o.CREVERID,
       -- MODIFIED_APPID,
       o.MODAPPID,
       -- MODIFIED_VSNID,
       o.MODVERID
from sys."_CURRENT_EDITION_OBJ" o, sys.user$ u
where o.owner# = u.user#
  and o.linkname is null
   and o.type# !=  10 /* NON-EXISTENT */
  and o.name != '_NEXT_OBJECT'
  and o.name != '_default_auditing_options_'
  and bitand(o.flags, 128) = 0
  -- Exclude XML Token set objects */
  and (o.type# not in (1 /* INDEXES */,
               2 /* TABLES */,
               6 /* SEQUENCE */)
      or
      (o.type# = 1 and not exists (select 1
        from sys.ind$ i, sys.tab$ t, sys.obj$ io
        where i.obj# = o.obj#
          and io.obj# = i.bo#
          and io.type# = 2
          and i.bo# = t.obj#
          and bitand(t.property, power(2,65)) =  power(2,65)))
      or
      (o.type# = 2 and 1 = (select 1
        from sys.tab$ t
        where t.obj# = o.obj#
          and (bitand(t.property, power(2,65)) = 0
            or t.property is null)))
      or
      (o.type# = 6 and 1 = (select 1
        from sys.seq$ s
        where s.obj# = o.obj#
          and (bitand(s.flags, 1024) = 0 or s.flags is null))))
union all
select u.name, l.name, NULL, to_number(null), to_number(null),
       'DATABASE LINK',
       l.ctime, to_date(null), NULL, 'VALID','N','N', 'N', NULL, NULL,
       'NONE', NULL, 'N', 'N', NULL, 'N', 'N', 'N',
       -- CREATED_APPID
       NULL,
       -- CREATED_VSNID
       NULL,
       -- MODIFIED_APPID
       NULL,
       -- MODIFIED_VSNID
       NULL
from sys.link$ l, sys.user$ u
where l.owner# = u.user#
```

####   [COMMA_TO_TABLE](#comma-to-table)  

#####   [描述](#描述)  

本过程将逗号分隔的名字列表字符串转换为名字的关联数组

#####   [语法](#语法)  

```
DBMS_UTILITY.COMMA_TO_TABLE ( 
   list   IN  VARCHAR,
   tablen OUT BINARY_INTEGER,
   tab    OUT uncl_array); 

DBMS_UTILITY.COMMA_TO_TABLE ( 
   list   IN  VARCHAR,
   tablen OUT BINARY_INTEGER,
   tab    OUT lname_array);

```

#####   [参数](#参数)  

|参数|描述|
|---|---|
|list|逗号分隔的 'name' 列表字符串， 'name'有两种形式,对于tab为uncl_array:   **a [. b [. c ]][ @ d ]**  。 对于tab为lname_array:   **a [. b]***|
|tablen|分割的name的数量|
|tab|name列表字符串转换成的关联数组|


#####   [使用说明](#使用说明)  

1.list中的名字可以用双引号。list不能为空字符串2.对于多bytes字符（中文）无法返回正常的输出

#####   [示例](#示例)  

```
DECLARE
    l_list    VARCHAR(4000) := '            a     ,abcdefgasdkklllfasdfh.kokokmaosdmfoask99999900000kkkkkkkkkkkkkkkkklllllllll.kokokmaosdmfoask9999999999lllllllllllllllkkkkkk000000000000kkkkkklllllllll@k99900.k1.k2.k3,dd';
    l_count   BINARY_INTEGER;
    l_array   DBMS_UTILITY.UNCL_ARRAY;
BEGIN
    -- 将逗号分隔的字符串转换为表
    DBMS_UTILITY.COMMA_TO_TABLE(list =&gt; l_list, tablen =&gt; l_count, tab =&gt; l_array);
    
    -- 输出转换后的表的元素数
    DBMS_OUTPUT.PUT_LINE('Number of elements: ' || TO_CHAR(l_count));
	DBMS_OUTPUT.PUT_LINE('2: ' || l_array(2) || 'end');
    DBMS_OUTPUT.PUT_LINE('1: ' || l_array(1) || 'end' );
    
END;
/

输出：

Number of elements: 3
2:
abcdefgasdkklllfasdfh.kokokmaosdmfoask99999900000kkkkkkkkkkkkkkkkklllllllll.koko
kmaosdmfoask9999999999lllllllllllllllkkkkkk000000000000kkkkkklllllllll@k99900.k1
.k2.k3end
1:             a     end


```

####   [TABLE_TO_COMMA](#table-to-comma)  

#####   [描述](#描述-1)  

将'name'的关联数组，转换为逗号分隔的字符串

#####   [语法](#语法-1)  

```
DBMS_UTILITY.TABLE_TO_COMMA ( 
   tab    IN  UNCL_ARRAY, 
   tablen OUT BINARY_INTEGER,
   list   OUT VARCHAR2);

DBMS_UTILITY.TABLE_TO_COMMA ( 
   tab    IN  lname_array,
   tablen OUT BINARY_INTEGER,
   list   OUT VARCHAR2);

```

#####   [参数](#参数-1)  

|参数|描述|
|---|---|
|tab|'name'的关联数组|
|tablen|数组长度|
|list|返回的逗号分隔的'name'的字符串|


#####   [使用说明](#使用说明-1)  

无

#####   [示例](#示例-1)  

```
DECLARE
   -- 使用DBMS_UTILITY.LNAME_ARRAY类型
   myArray DBMS_UTILITY.UNCL_ARRAY;
   
   -- 用于存储转换后的字符串和数组长度
   listOut VARCHAR(4000);
   tabLen  BINARY_INTEGER;
BEGIN
   -- 向数组中添加数据
   myArray(1) := 'a.b';
   myArray(2) := '11111111000000000000011111111111111111111111111111111111111111111111110000000000000000000000000000000000000000000m';
   myArray(3) := 'omcs';

   -- 调用TABLE_TO_COMMA过程
   DBMS_UTILITY.TABLE_TO_COMMA(
      tab    =&gt; myArray, 
      tablen =&gt; tabLen,
      list   =&gt; listOut
   );

   -- 输出结果
   DBMS_OUTPUT.PUT_LINE('Comma-separated list: ' || listOut);
   DBMS_OUTPUT.PUT_LINE('Number of elements: ' || tabLen);
END;
/

输出：

Comma-separated list:
a.b,1111111100000000000001111111111111111111111111111111111111111111111111000000
0000000000000000000000000000000000000m,omcs
Number of elements: 3


```

####   [NAME_TOKENIZE](#name-tokenize)  

#####   [描述](#描述-2)  

将输入的'name'字符串parse为几个部分，输入格式  **a [. b [. c ]][@ dblink ]**   ， 如果没有双引号则转换为大写。

#####   [语法](#语法-2)  

```
DBMS_UTILITY.NAME_TOKENIZE ( 
   name    IN  VARCHAR2,
   a       OUT VARCHAR2,
   b       OUT VARCHAR2,
   c       OUT VARCHAR2,
   dblink  OUT VARCHAR2, 
   nextpos OUT BINARY_INTEGER);

```

#####   [参数](#参数-2)  

|参数|描述|
|---|---|
|name|由sql identifier组成，形如 'scott.foo@dblink'|
|a|第一部分token|
|b|第二部分token|
|c|第三部分token|
|dblink|@之后的dblink部分|
|nextpos|parse终止的字符串下标， 例如'a.b c', 则nextpos为3|


#####   [内部实现描述](#内部实现描述)  

- 先以combined模式尝试读     `a.[b]*`     这样的形式，其中a,b都是identifier，需满足yashandb identifier的命名要求，支持双引号，可用字符要求，以及长度不超过64。
- 读到不符合     `a.[b]*`     模式 的字符后。尝试读   **@**  ，如果没有读到   **@**  ，则停止，nextPos为停止的字符下标。
- 读到   **@**   则尝试读一个identifier，读到后停止。  **@**   后没有合法的identifier则报错


#####   [使用说明](#使用说明-2)  

name_tokenize的规格：

- 字符串中的空格部分会被忽略掉。标准的输入形式为     `identifier.[.identifier[.identifier]][@dbLink]`     其中   **dbLink**   的形式为     `identifier[.identifier]*[@identifier]`  
- **.**   或者   **@**   后面会紧接着尝试读一个   **identifier**   。如果读到的第一个字符不是   **identifier**   的合法组成，则会报错。如果读到的第一个字符合法，后续读到不合法字符时会停止。
- 支持   **"asjdfk km>k l"**   双引号形式的   **identifier**   ，双引号内部可以存任意字符。  双引号的   **identifier**   输出会把双引号去掉。 没有双引号的   **identifier**   输出转化为大写（兼容Oracle）
-   `a.b.c.d`    ，类似这样   **@**   前面的   **identifier**   组合多于3个会报错。


规格和Oracle的区别：

1. oracle 在尝试读identifier时，如果读到     `abc #`     这样的组合会报错，但是我们会读出     `abc`    作为合法的identifier并返回   **#**   的下标。
1. oracle   **@**   后面的   **identifier**   双引号内有特殊字符也会报错，yashandb支持双引号内包含特殊字符。
1. oracle 会把有双引号的   **identifier**   的双引号去掉再输出，yashandb不去掉。
1. oracle   **identifier**   的最大长度为128，我们是64


#####   [示例](#示例-2)  

```
DECLARE
   name VARCHAR(20000) := '      a#akjskdlf9 . c   @ rdb. abc . asdf. asdf. asdf. aazzfv. asdkfalskdfa . a.b.c.d.askdfl.aksldmkfaslkdmfalkdsmflkasdflkasdmf.aksmdlfaksmc';
   a VARCHAR(2000);
   b VARCHAR(2000);
   c VARCHAR(2000);
   dblink VARCHAR(2000);
   nextpos BINARY_INTEGER;
BEGIN
   DBMS_UTILITY.NAME_TOKENIZE(
      name =&gt; name,
      a =&gt; a,
      b =&gt; b,
      c =&gt; c,
      dblink =&gt; dblink,
      nextpos =&gt; nextpos
   );
   -- 输出解析结果和nextpos的值
   DBMS_OUTPUT.PUT_LINE('A: ' || a || ' eof');
   DBMS_OUTPUT.PUT_LINE('B: ' || b || ' eof');
   DBMS_OUTPUT.PUT_LINE('C: ' || c || ' eof');
   DBMS_OUTPUT.PUT_LINE('DBLink: ' || dblink  || ' end');
   DBMS_OUTPUT.PUT_LINE('Nextpos: ' || nextpos);
END;
/

输出：

A: A#AKJSKDLF9 eof
B: C eof
C:  eof
DBLink:
RDB.ABC.ASDF.ASDF.ASDF.AAZZFV.ASDKFALSKDFA.A.B.C.D.ASKDFL.AKSLDMKFASLKDMFALKDSMF
LKASDFLKASDMF.AKSMDLFAKSMC end
Nextpos: 141

```

####   [GET_PARAMETER_VALUE](#get-parameter-value)  

#####   [描述](#描述-3)  

获取v$parameter中包含的参数的参数值，输入为参数名称。

#####   [语法](#语法-3)  

```
DBMS_UTILITY.GET_PARAMETER_VALUE (
   parnam     IN        VARCHAR2,
   intval     OUT       BINARY_INTEGER,
   strval     OUT       VARCHAR2,
   listno     IN        BINARY_INTEGER DEFAULT 1)
  RETURN BINARY_INTEGER;

```

#####   [参数](#参数-3)  

|参数|描述|
|---|---|
|parnam|参数名称|
|intval|对于integer的参数是参数值。对于string的参数则是string长度|
|strval|string类型参数的值|
|listno|如果查的参数可以被指定多次值，则用本参数来获取每一个值|


#####   [返回值](#返回值)  

如果参数是 integer/bool 类型则返回 0如果参数是 string 类型则返回 1

#####   [使用说明](#使用说明-3)  

使用本高级包函数，要求用户具有查询v$parameter的权限

- oracle的listno参数用于对可多次指定值的参数依次获取每一个值
- yasdb的listno不支持对应功能，仅兼容，无论输入是多少都返回唯一的参数值。


#####   [示例](#示例-3)  

```
DECLARE
  -- 参数名、整数值、字符串值及参数类型
  parnam  VARCHAR2(256) := 'DSINTERVAL_FORMAT';  -- 参数名称
  intval  BINARY_INTEGER;  -- 可存储整数参数的值或字符串参数值的长度
  strval  VARCHAR2(256);  -- 可存储字符串参数的值
  partyp  BINARY_INTEGER;  -- 参数类型标识符
BEGIN
  -- 使用GET_PARAMETER_VALUE函数检索参数值及类型
  partyp := DBMS_UTILITY.GET_PARAMETER_VALUE(parnam, intval, strval);
  
  -- 输出参数值
  DBMS_OUTPUT.PUT('Parameter value is: ');
  IF partyp = 1 THEN
    DBMS_OUTPUT.PUT_LINE(strval);  -- 如果是字符串参数，输出字符串值
  ELSE
    DBMS_OUTPUT.PUT_LINE(TO_CHAR(intval));  -- 如果是整数参数，输出整数值
  END IF;

  -- 如果是字符串参数，还可以输出该字符串的长度
  IF partyp = 1 THEN
    DBMS_OUTPUT.PUT('Parameter value length is: ');
    DBMS_OUTPUT.PUT_LINE(intval);  -- 输出字符串值的长度
  END IF;

  -- 输出参数类型（整数或字符串）
  DBMS_OUTPUT.PUT('Parameter type is: ');
  IF partyp = 1 THEN
    DBMS_OUTPUT.PUT_LINE('string');
  ELSE
    DBMS_OUTPUT.PUT_LINE('integer');
  END IF;
END;
/


输出：

Parameter value is: dd hh24:mi:ss.ff
Parameter value length is: 16
Parameter type is: string


```

  
  ​

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

1.高级包DBMS_UTILITY新增相关子过程/函数描述与用例

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  
  ​