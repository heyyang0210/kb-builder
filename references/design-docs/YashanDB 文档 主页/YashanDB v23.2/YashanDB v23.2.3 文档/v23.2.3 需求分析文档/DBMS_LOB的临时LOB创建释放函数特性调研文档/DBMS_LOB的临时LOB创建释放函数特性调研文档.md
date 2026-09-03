Created by 曾思尹 on 十一月 13, 2023

#   [YDBRD-13360: DBMS_LOB的临时LOB创建释放函数Research（DBMS_LOB的临时LOB创建释放函数特性调研）](#ydbrd-13360-dbms-lob的临时lob创建释放函数researchdbms-lob的临时lob创建释放函数特性调研)  

SR链接：    [YDBRD-13360](https://jira.yasdb.com/browse/YDBRD-13360?src=confmacro)    -  DBMS_LOB的临时LOB创建释放函数  完成

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_LOB文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOB.html#GUID-A35DE03B-41A6-4E55-8CDE-77737FED9306)  

（1）  **CREATETEMPORARY**  在用户的默认临时表空间中创建临时BLOB或CLOB及其相应索引    
  （2）  **FREETEMPORARY**  释放默认临时表空间中的临时BLOB或CLOB    
  （3）  **ISTEMPORARY**  检查LOB定位符指向的LOB是否为临时LOB

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 CREATETEMPORARY Procedures](#21-createtemporary-procedures)  

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
DBMS_LOB.CREATETEMPORARY (
   lob_loc IN OUT NOCOPY BLOB,
   cache   IN            BOOLEAN,
   dur     IN            PLS_INTEGER := DBMS_LOB.SESSION);
  
DBMS_LOB.CREATETEMPORARY (
   lob_loc IN OUT NOCOPY CLOB CHARACTER SET ANY_CS,
   cache   IN            BOOLEAN,
   dur     IN            PLS_INTEGER := 10);

```

####   [2.1.2 Parameter（参数）](#212-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|LOB定位符|
|cache|IN|BOOLEAN|是|-|指定是否将LOB读取到缓冲区缓存中|
|dur|IN|PLS_INTEGER|否|DBMS_LOB.SESSION|2个预定义的持续时间值（SESSION或CALL）中的1个，指定是否在会话或调用结束时清理临时LOB|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|cache或dur参数为null|


####   [2.1.3 Details（详细分析）](#213-details详细分析)  

（1）lob_loc参数限制    
  可输入未初始化的、设置为null的或无效的LOB定位符    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'CREATETEMPORARY' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  （2）cache参数限制    
  不可为空，置null错误报告ORA-06502: PL/SQL: 数字或值错误    
  数据类型支持BOOLEAN，该类型存储逻辑值包括Boolean值true和false、未知值null，可以用Boolean表达式赋值    
  （3）dur参数限制    
  不可为空，置null错误报告ORA-06502: PL/SQL: 数字或值错误    
  PLS_INTEGER类型的整数数值范围：[-2  31  ,2  31  -1]    
  PLS_INTEGER类型对小数四舍五入，字符可隐式转换为PLS_INTEGER类型    
  预定义的持续时间值：SESSION=10，CALL=12    
  使用临时表空间存储临时LOB的数据，临时LOB的数据不会永久存储在数据库内。    
  临时LOB在创建时为空。默认情况下，所有临时LOB都将在创建它们的会话结束时删除。如果进程意外死亡或数据库崩溃，则会删除临时LOB，并释放临时LOB的空间。

```
declare
 blob1 blob;
 blob2 blob := null;
 clob1 clob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; blob2
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; clob1
    , cache =&gt; true
    --, dur =&gt; 
);
--set clob1 invalid
dbms_lob.freetemporary(
      lob_loc =&gt; clob1
);
dbms_lob.createtemporary(
      lob_loc =&gt; clob1
    , cache =&gt; true
    --, dur =&gt; 
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
begin
dbms_lob.createtemporary(
      lob_loc =&gt; null
    , cache =&gt; true
    --, dur =&gt; 
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 2 行, 第 1 列:
PLS-00307: 有太多的 'CREATETEMPORARY' 声明与此次调用相匹配
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob;
 clob1 clob;
 raw1 raw(1000);
 char1 char(1000);
 varchar1 varchar2(1000);
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; clob1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; raw1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; char1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; varchar1
    , cache =&gt; true
    --, dur =&gt; 
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
declare
 blob1 blob;
 a int := 1;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; null
    --, dur =&gt; 
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 734
ORA-06512: 在 line 5
06502. 00000 -  "PL/SQL: numeric or value error%s"
*Cause:    An arithmetic, numeric, string, conversion, or constraint error
           occurred. For example, this error occurs if an attempt is made to
           assign the value NULL to a variable declared NOT NULL, or if an
           attempt is made to assign an integer larger than 99 to a variable
           declared NUMBER(2).
*Action:   Change the data, how it is manipulated, or how it is declared so
           that values do not violate constraints.

declare
 blob1 blob;
 a int := 1;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; null
    --, dur =&gt; 
);
exception
  when value_error then
    dbms_output.put_line('cannot be null');
end;
/
OUTPUT:
cannot be null

PL/SQL 过程已成功完成。

```

```
declare
 blob1 blob;
 a int := 1;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; false
    --, dur =&gt; 
);
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; a &lt; 2
    --, dur =&gt; 
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
declare
 blob1 blob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; null
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 734
ORA-06512: 在 line 4
06502. 00000 -  "PL/SQL: numeric or value error%s"
*Cause:    An arithmetic, numeric, string, conversion, or constraint error
           occurred. For example, this error occurs if an attempt is made to
           assign the value NULL to a variable declared NOT NULL, or if an
           attempt is made to assign an integer larger than 99 to a variable
           declared NUMBER(2).
*Action:   Change the data, how it is manipulated, or how it is declared so
           that values do not violate constraints.

```

```
declare
 blob1 blob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; 2147483647
);
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; -2147483648
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 blob1 blob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; 2147483648
);
end;
/
OUTPUT:
错误报告 -
ORA-01426: 数字溢出
ORA-06512: 在 line 4
01426. 00000 -  "numeric overflow"
*Cause:    Evaluation of an value expression causes an overflow/underflow.
*Action:   Reduce the operands.

```

```
declare
 blob1 blob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; '2147483647.4'
);
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; 2147483647.4
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 blob1 blob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; 2147483647.5
);
end;
/
OUTPUT:
错误报告 -
ORA-01426: 数字溢出
ORA-06512: 在 line 4
01426. 00000 -  "numeric overflow"
*Cause:    Evaluation of an value expression causes an overflow/underflow.
*Action:   Reduce the operands.

```

```
begin
  dbms_output.put_line(dbms_lob.session);
  dbms_output.put_line(dbms_lob.call);
end;
/
OUTPUT:
10
12

PL/SQL 过程已成功完成。

```

###   [2.2 FREETEMPORARY Procedures](#22-freetemporary-procedures)  

####   [2.2.1 Syntax（语法）](#221-syntax语法)  

```
DBMS_LOB.FREETEMPORARY (
   lob_loc  IN OUT  NOCOPY BLOB); 

DBMS_LOB.FREETEMPORARY (
   lob_loc  IN OUT  NOCOPY CLOB CHARACTER SET ANY_CS); 

```

####   [2.2.2 Parameter（参数）](#222-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|LOB定位符|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|lob_loc参数为null|


####   [2.2.3 Details（详细分析）](#223-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'FREETEMPORARY' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW，但是CHAR/VARCHAR/RAW会报错：无效的LOB定位符    
  当创建了新的临时LOB，并且当前没有使用相同持续时间的临时LOB时，将创建一个新的临时LOB段。当释放临时LOB时，它所占用的空间将释放给临时段。如果在相同的持续时间内没有其他临时LOB，则该临时段也将被释放。    
  在调用FREETEMPORARY之后，释放的LOB定位符被标记为无效。    
  如果使用OCI中的OCILobLocatorAssign或通过PL/SQL中的赋值操作将无效的LOB定位符分配给另一个LOB定位符，则该赋值的目标也将被释放并标记为无效。

```
declare
 blob1 blob;
begin
dbms_lob.freetemporary(
      lob_loc =&gt; blob1
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 830
ORA-06512: 在 line 4
06502. 00000 -  "PL/SQL: numeric or value error%s"
*Cause:    An arithmetic, numeric, string, conversion, or constraint error
           occurred. For example, this error occurs if an attempt is made to
           assign the value NULL to a variable declared NOT NULL, or if an
           attempt is made to assign an integer larger than 99 to a variable
           declared NUMBER(2).
*Action:   Change the data, how it is manipulated, or how it is declared so
           that values do not violate constraints.

```

```
declare
 blob1 blob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    , dur =&gt; 10
);
--set blob1 invalid
dbms_lob.freetemporary(
      lob_loc =&gt; blob1
);
dbms_lob.freetemporary(
      lob_loc =&gt; blob1
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 830
ORA-06512: 在 line 13
22275. 00000 -  "invalid LOB locator specified"
*Cause:    There are several causes
           initialized; (2) the locator is for a BFILE and the routine
           expects a BLOB/CLOB/NCLOB locator; (3) the locator is for a
           BLOB/CLOB/NCLOB and the routine expects a BFILE locator;
           (4) trying to update the LOB in a trigger body -- LOBs in
           trigger bodies are read only; (5) the locator is for a
           BFILE/BLOB and the routine expects a CLOB/NCLOB locator;
           (6) the locator is for a CLOB/NCLOB and the routine expects
           a BFILE/BLOB locator;
*Action:   For (1), initialize the LOB locator by selecting into the locator
           variable or by setting the LOB locator to empty.  For (2),(3),
           (5) and (6)pass the correct type of locator into the routine.
           For (4), remove the trigger body code that updates the LOB value.

```

```
begin
dbms_lob.freetemporary(
      lob_loc =&gt; null
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 2 行, 第 1 列:
PLS-00307: 有太多的 'FREETEMPORARY' 声明与此次调用相匹配
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob;
 clob1 clob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; blob1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.freetemporary(
      lob_loc =&gt; blob1
);
dbms_lob.createtemporary(
      lob_loc =&gt; clob1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.freetemporary(
      lob_loc =&gt; clob1
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 raw1 raw(1000);
begin
dbms_lob.createtemporary(
      lob_loc =&gt; raw1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.freetemporary(
      lob_loc =&gt; raw1
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 830
ORA-06512: 在 line 9
06502. 00000 -  "PL/SQL: numeric or value error%s"
*Cause:    An arithmetic, numeric, string, conversion, or constraint error
           occurred. For example, this error occurs if an attempt is made to
           assign the value NULL to a variable declared NOT NULL, or if an
           attempt is made to assign an integer larger than 99 to a variable
           declared NUMBER(2).
*Action:   Change the data, how it is manipulated, or how it is declared so
           that values do not violate constraints.

declare
 raw1 raw(1000):=hextoraw('1234');
begin
dbms_lob.freetemporary(
      lob_loc =&gt; raw1
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 line 4
22275. 00000 -  "invalid LOB locator specified"
*Cause:    There are several causes
           initialized; (2) the locator is for a BFILE and the routine
           expects a BLOB/CLOB/NCLOB locator; (3) the locator is for a
           BLOB/CLOB/NCLOB and the routine expects a BFILE locator;
           (4) trying to update the LOB in a trigger body -- LOBs in
           trigger bodies are read only; (5) the locator is for a
           BFILE/BLOB and the routine expects a CLOB/NCLOB locator;
           (6) the locator is for a CLOB/NCLOB and the routine expects
           a BFILE/BLOB locator;
*Action:   For (1), initialize the LOB locator by selecting into the locator
           variable or by setting the LOB locator to empty.  For (2),(3),
           (5) and (6)pass the correct type of locator into the routine.
           For (4), remove the trigger body code that updates the LOB value.

declare
 char1 char(1000);
begin
dbms_lob.createtemporary(
      lob_loc =&gt; char1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.freetemporary(
      lob_loc =&gt; char1
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 line 9
22275. 00000 -  "invalid LOB locator specified"
*Cause:    There are several causes
           initialized; (2) the locator is for a BFILE and the routine
           expects a BLOB/CLOB/NCLOB locator; (3) the locator is for a
           BLOB/CLOB/NCLOB and the routine expects a BFILE locator;
           (4) trying to update the LOB in a trigger body -- LOBs in
           trigger bodies are read only; (5) the locator is for a
           BFILE/BLOB and the routine expects a CLOB/NCLOB locator;
           (6) the locator is for a CLOB/NCLOB and the routine expects
           a BFILE/BLOB locator;
*Action:   For (1), initialize the LOB locator by selecting into the locator
           variable or by setting the LOB locator to empty.  For (2),(3),
           (5) and (6)pass the correct type of locator into the routine.
           For (4), remove the trigger body code that updates the LOB value.

declare
 varchar1 varchar2(1000);
begin
dbms_lob.createtemporary(
      lob_loc =&gt; varchar1
    , cache =&gt; true
    --, dur =&gt; 
);
dbms_lob.freetemporary(
      lob_loc =&gt; varchar1
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 835
ORA-06512: 在 line 9
06502. 00000 -  "PL/SQL: numeric or value error%s"
*Cause:    An arithmetic, numeric, string, conversion, or constraint error
           occurred. For example, this error occurs if an attempt is made to
           assign the value NULL to a variable declared NOT NULL, or if an
           attempt is made to assign an integer larger than 99 to a variable
           declared NUMBER(2).
*Action:   Change the data, how it is manipulated, or how it is declared so
           that values do not violate constraints.

declare
 varchar1 varchar2(1000) := '1234';
begin
dbms_lob.freetemporary(
      lob_loc =&gt; varchar1
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 line 4
22275. 00000 -  "invalid LOB locator specified"
*Cause:    There are several causes
           initialized; (2) the locator is for a BFILE and the routine
           expects a BLOB/CLOB/NCLOB locator; (3) the locator is for a
           BLOB/CLOB/NCLOB and the routine expects a BFILE locator;
           (4) trying to update the LOB in a trigger body -- LOBs in
           trigger bodies are read only; (5) the locator is for a
           BFILE/BLOB and the routine expects a CLOB/NCLOB locator;
           (6) the locator is for a CLOB/NCLOB and the routine expects
           a BFILE/BLOB locator;
*Action:   For (1), initialize the LOB locator by selecting into the locator
           variable or by setting the LOB locator to empty.  For (2),(3),
           (5) and (6)pass the correct type of locator into the routine.
           For (4), remove the trigger body code that updates the LOB value.

```

###   [2.3 ISTEMPORARY Functions](#23-istemporary-functions)  

####   [2.3.1 Syntax（语法）](#231-syntax语法)  

```
DBMS_LOB.ISTEMPORARY (
   lob_loc IN BLOB)
  RETURN INTEGER;
 
DBMS_LOB.ISTEMPORARY (
   lob_loc IN CLOB CHARACTER SET ANY_CS)
  RETURN INTEGER;

```

####   [2.3.2 Pragmas（编译指令）](#232-pragmas编译指令)  

```
PRAGMA RESTRICT_REFERENCES(istemporary, WNDS, RNDS, WNPS, RNPS);

```

####   [2.3.3 Parameter（参数）](#233-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN|BLOB/CLOB|是|-|LOB定位符|


返回值：数据类型为INTEGER，如果LOB是临时的并且存在，则返回值为1；如果LOB不是临时的或不存在，则为0；如果给定的定位符为NULL，则为NULL。    
  直接输入字符串返回值为1

####   [2.3.4 Details（详细分析）](#234-details详细分析)  

（1）lob_loc参数限制    
  可输入未初始化的、设置为null的或无效的LOB定位符    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'ISTEMPORARY' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  使用FREETEMPORARY释放临时LOB时，LOB定位符不会设置为NULL。因此，ISTEMPORARY将为已释放但未显式重置为NULL的定位符返回0。

```
declare
 clob1 clob;
 clob2 clob := null;
 clob3 clob := '1234';
 clob4 clob := 'abcd';
begin
--return null
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; clob1
    )
);
--return null
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; clob2
    )
);
--set clob3 invalid
dbms_lob.freetemporary(
      lob_loc =&gt; clob3
);
--return 0
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; clob3
    )
);
--return 1
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; clob4
    )
);
end;
/
OUTPUT:


0
1

PL/SQL 过程已成功完成。

```

```
begin
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; null
    )
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 3 行, 第 5 列:
PLS-00307: 有太多的 'ISTEMPORARY' 声明与此次调用相匹配
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob := hextoraw('1234');
 clob1 clob := '567';
 raw1 raw(1000) := hextoraw('89');
 char1 char(1000) := 'abcd';
 varchar1 varchar2(1000) := 'efg';
begin
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; blob1
    )
);
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; clob1
    )
);
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; raw1
    )
);
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; char1
    )
);
dbms_output.put_line(
    dbms_lob.istemporary(
        lob_loc =&gt; varchar1
    )
);
end;
/
OUTPUT:
1
1
1
1
1

PL/SQL 过程已成功完成。

```

###   [2.4 DBMS_LOB Exceptions](#24-dbms-lob-exceptions)  

|异常|错误码|说明|
|---|---|---|
|DBMS_LOB.ACCESS_ERROR|22925|试图向LOB写入太多数据：LOB大小限制为4GB|
|BUFFERING_ENABLED|22279|无法在启用LOB缓冲的情况下执行操作|
|DBMS_LOB.CONTENTTYPE_TOOLONG|43859|contenttype字符串的长度超过了定义的最大值。修改contenttype字符串的长度，然后重试该操作|
|DBMS_LOB.CONTENTTYPEBUF_WRONG|43862|contenttype缓冲区的长度小于定义的常量。修改contenttype缓冲区的长度，然后重试该操作|
|DBMS_LOB.INVALID_ARGVAL|21560|参数数值超出范围|
|DBMS_LOB.INVALID_DIRECTORY|22287|如果是第一次访问当前操作所使用的目录，或者DBA自上次访问后对其进行了修改，则该目录无效|
|NO_DATA_FOUND|1403|用于循环读取操作的ENDOFLOB指示符。这不是一个严重的错误|
|DBMS_LOB.NOEXIST_DIRECTORY|22285|指向该文件的目录不存在|
|DBMS_LOB.NOPRIV_DIRECTORY|22286|用户对目录或文件没有操作所需的访问权限|
|DBMS_LOB.OPEN_TOOMANY|22290|打开的文件数已达到最大限制|
|DBMS_LOB.OPERATION_FAILED|22288|尝试对文件执行的操作失败|
|QUERY_WRITE|14553|无法在查询或PDML并行执行服务器内执行LOB写入|
|DBMS_LOB.SECUREFILE_BADLOB|43856|在仅SECUREFILE调用中使用了非SECUREFFILE LOB类型|
|DBMS_LOB.SECUREFILE_BADPARAM|43857|向SECUREFILE子程序传递了无效参数|
|DBMS_LOB.SECUREFILE_MARKERASED|43861|提供给FRAGMENT_*操作的标记已被删除|
|DBMS_LOB.SECUREFILE_OUTOFBOUNDS|43883|尝试在LOB末尾后执行FRAGMENT_*操作|
|DBMS_LOB.UNOPENED_FILE|22289|文件未打开，无法执行所需的操作|
|VALUE_ERROR|6502|PL/SQL错误，因为子程序参数的值无效|


##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

  


  
