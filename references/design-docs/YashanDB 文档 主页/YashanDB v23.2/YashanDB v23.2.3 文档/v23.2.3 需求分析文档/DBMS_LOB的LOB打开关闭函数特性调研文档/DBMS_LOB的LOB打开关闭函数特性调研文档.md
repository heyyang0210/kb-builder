Created by 曾思尹 on 十一月 13, 2023

#   [YDBRD-13361: DBMS_LOB的LOB打开关闭函数Research（DBMS_LOB的LOB打开关闭函数特性调研）](#ydbrd-13361-dbms-lob的lob打开关闭函数researchdbms-lob的lob打开关闭函数特性调研)  

SR链接：    [YDBRD-13361](https://jira.yasdb.com/browse/YDBRD-13361?src=confmacro)    -  DBMS_LOB的LOB打开关闭函数  完成

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_LOB文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOB.html#GUID-A35DE03B-41A6-4E55-8CDE-77737FED9306)  

（1）  **OPEN**  以指定的模式（只读、读写）打开LOB（内部、外部或临时）    
  （2）  **CLOSE**  关闭之前打开的LOB    
  （3）  **ISOPEN**  检查LOB是否已经打开

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 OPEN Procedures](#21-open-procedures)  

YASDB暂不支持BFILE，以下调研关于BLOB和CLOB的

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
DBMS_LOB.OPEN (
   lob_loc   IN OUT NOCOPY BLOB,
   open_mode IN            BINARY_INTEGER);
 
DBMS_LOB.OPEN (
   lob_loc   IN OUT NOCOPY CLOB CHARACTER SET ANY_CS,
   open_mode IN            BINARY_INTEGER);

```

####   [2.1.2 Parameter（参数）](#212-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|LOB定位符|
|open_mode|IN|BINARY_INTEGER|是|-|用只读或读写模式打开|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|


####   [2.1.3 Details（详细分析）](#213-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'OPEN' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  不能打开已经打开的LOB    
  （2）open_mode参数限制    
  不可为空，置null错误报告ORA-06502: PL/SQL: 数字或值错误    
  BINARY_INTEGER类型的整数数值范围：[-2  31  ,2  31  -1]    
  BINARY_INTEGER类型对小数四舍五入，字符可隐式转换为BINARY_INTEGER类型    
  DBMS_LOB.LOB_READONLY=0，只读模式，如果试图写入该模式打开的LOB会报错ORA-22294: 无法更新以只读模式打开的 LOB    
  DBMS_LOB.LOB_READWRITE=1，读写模式    
  输入范围内其他数值默认为0    
  OPEN要求内部和外部LOB都往返于服务器。对于内部LOB，OPEN会触发依赖于OPEN调用的其他代码。对于外部LOB（BFILE），OPEN需要往返，因为正在打开服务器端的实际操作系统文件。    
  并非必须将所有LOB操作封装在打开/关闭接口中。但是，如果打开了LOB，则必须在提交事务之前关闭它；如果不这样做，则会产生错误。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。    
  在关闭事务打开的所有已打开LOB之前提交事务是错误的。当返回错误时，将放弃打开的LOB的开放性，但事务已成功提交。因此，事务中对LOB和非LOB数据所做的所有更改都已提交，但基于域和函数的索引不会更新。如果发生这种情况，应该重新生成LOB列上的函数索引和域索引。

```
declare
 clob1 clob;
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 1024
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
 clob1 clob := '1234';
begin
dbms_lob.freetemporary(
      lob_loc =&gt; clob1
);
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 1024
ORA-06512: 在 line 7
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
dbms_lob.open(
      lob_loc =&gt; null
    , open_mode =&gt; 0
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 2 行, 第 1 列:
PLS-00307: 有太多的 'OPEN' 声明与此次调用相匹配
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob := hextoraw('6162');
 raw1 raw(10) := hextoraw('6364');
 clob1 clob := '1234';
 char1 char(10) := '56';
 vchar1 varchar2(10) := '78';
begin
dbms_lob.open(
      lob_loc =&gt; blob1
    , open_mode =&gt; 0
);
dbms_lob.open(
      lob_loc =&gt; raw1
    , open_mode =&gt; 0
);
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
dbms_lob.open(
      lob_loc =&gt; char1
    , open_mode =&gt; 0
);
dbms_lob.open(
      lob_loc =&gt; vchar1
    , open_mode =&gt; 0
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob := '1234';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
end;
/
OUTPUT:
错误报告 -
ORA-22293: LOB 已在同一个事务处理中打开
ORA-06512: 在 "SYS.DBMS_LOB", line 1024
ORA-06512: 在 line 8
22293. 00000 -  "LOB already opened in the same transaction"
*Cause:    An attempt was made to open a LOB that already is open in
           this transaction.
*Action:   Close the LOB before attempting to re-open it.

```

```
declare
 clob1 clob := '1234';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; null
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1024
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
 clob1 clob:='12';
 clob2 clob:='34';
 clob3 clob:='56';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; -2147483648
);
dbms_lob.open(
      lob_loc =&gt; clob2
    , open_mode =&gt; 2147483647.4
);
dbms_lob.open(
      lob_loc =&gt; clob3
    , open_mode =&gt; 2147483647.5
);
end;
/
OUTPUT:
错误报告 -
ORA-01426: 数字溢出
ORA-06512: 在 line 14
01426. 00000 -  "numeric overflow"
*Cause:    Evaluation of an value expression causes an overflow/underflow.
*Action:   Reduce the operands.

```

```
begin
dbms_output.put_line(
      DBMS_LOB.LOB_READONLY
); 
dbms_output.put_line(
      DBMS_LOB.LOB_READWRITE
); 
end;
/
OUTPUT:
0
1

PL/SQL 过程已成功完成。

declare
 clob1 clob:='12';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 1
);
dbms_lob.writeappend(
      lob_loc =&gt; clob1
    , amount =&gt; 3
    , buffer =&gt; '345'
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
12345

PL/SQL 过程已成功完成。

declare
 clob1 clob:='12';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
dbms_lob.writeappend(
      lob_loc =&gt; clob1
    , amount =&gt; 3
    , buffer =&gt; '345'
);
end;
/
OUTPUT:
错误报告 -
ORA-22294: 无法更新以只读模式打开的 LOB
ORA-06512: 在 "SYS.DBMS_LOB", line 1163
ORA-06512: 在 line 8
22294. 00000 -  "cannot update a LOB opened in read-only mode"
*Cause:    An attempt was made to write to or update a LOB opened
           in read-only mode.
*Action:   Close the LOB and re-open it in read-write mode before
           attempting to write  to or update the LOB.

declare
 clob1 clob:='12';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 2
);
dbms_lob.writeappend(
      lob_loc =&gt; clob1
    , amount =&gt; 3
    , buffer =&gt; '345'
);
end;
/
OUTPUT:
错误报告 -
ORA-22294: 无法更新以只读模式打开的 LOB
ORA-06512: 在 "SYS.DBMS_LOB", line 1163
ORA-06512: 在 line 8
22294. 00000 -  "cannot update a LOB opened in read-only mode"
*Cause:    An attempt was made to write to or update a LOB opened
           in read-only mode.
*Action:   Close the LOB and re-open it in read-write mode before
           attempting to write  to or update the LOB.

```

```
错误报告 -
ORA-22297: 警告: 事务处理提交时存在打开的 LOB
22297. 00000 -  "warning: Open LOBs exist at transaction commit time"
*Cause:    An attempt was made to commit a transaction with open LOBs at
           transaction commit time.
*Action:   This is just a warning. The transaction was commited successfully,
           but any domain or functional indexes on the open LOBs were not
           updated. You may want to rebuild those indexes.

```

###   [2.2 CLOSE Procedures](#22-close-procedures)  

YASDB暂不支持BFILE，以下调研关于BLOB和CLOB的

####   [2.2.1 Syntax（语法）](#221-syntax语法)  

```
DBMS_LOB.CLOSE (
   lob_loc    IN OUT NOCOPY BLOB); 

DBMS_LOB.CLOSE (
   lob_loc    IN OUT NOCOPY CLOB CHARACTER SET ANY_CS); 

```

####   [2.2.2 Parameter（参数）](#222-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|LOB定位符|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|
|DBMS_LOB.UNOPENED_FILE|22289|无法在未打开的文件或 LOB 上执行操作|


####   [2.2.3 Details（详细分析）](#223-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'CLOSE' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW，但是CHAR/VARCHAR/RAW类型不能被关闭    
  关闭未打开的LOB报错ORA-22289: 无法在未打开的文件或 LOB 上执行操作

CLOSE要求内部和外部LOB都往返于服务器。对于内部LOB，CLOSE会触发依赖于关闭调用的其他代码，而对于外部LOB（BFILE），CLOSE实际上会关闭服务器端操作系统文件。    
  并非必须将所有LOB操作封装在打开/关闭接口中。但是，如果您打开了LOB，则必须在提交事务之前关闭它；如果不这样做，则会产生错误。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。    
  在关闭事务打开的所有已打开LOB之前提交事务是错误的。当返回错误时，将放弃打开的LOB的开放性，但事务已成功提交。因此，事务中对LOB和非LOB数据所做的所有更改都已提交，但基于域和函数的索引不会更新。如果发生这种情况，您应该重新生成LOB列上的函数索引和域索引。

```
declare
 clob1 clob;
begin
dbms_lob.close(
    lob_loc =&gt; clob1
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 666
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
 clob1 clob := '123';
begin
dbms_lob.freetemporary(
    lob_loc =&gt; clob1
);
dbms_lob.close(
    lob_loc =&gt; clob1
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 666
ORA-06512: 在 line 7
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
declare
 clob1 clob := '123';
begin
dbms_lob.close(
    lob_loc =&gt; NULL
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 4 行, 第 1 列:
PLS-00307: 有太多的 'CLOSE' 声明与此次调用相匹配
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob := hextoraw('6162');
 clob1 clob := '1234';
begin
dbms_lob.open(
      lob_loc =&gt; blob1
    , open_mode =&gt; 0
);
dbms_lob.close(
    lob_loc =&gt; blob1
);
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
dbms_lob.close(
    lob_loc =&gt; clob1
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 raw1 raw(10) := hextoraw('6364');
begin
dbms_lob.open(
      lob_loc =&gt; raw1
    , open_mode =&gt; 0
);
dbms_lob.close(
    lob_loc =&gt; raw1
);
end;
/
OUTPUT:
错误报告 -
ORA-22289: 无法在未打开的文件或 LOB 上执行操作
ORA-06512: 在 "SYS.DBMS_LOB", line 661
ORA-06512: 在 line 8
22289. 00000 -  "cannot perform %s operation on an unopened file or LOB"
*Cause:    The file or LOB is not open for the required operation to be
           performed.
*Action:   Precede the current operation with a successful open operation
           on the file or LOB.

declare
 vchar1 varchar2(10) := '78';
begin
dbms_lob.open(
      lob_loc =&gt; vchar1
    , open_mode =&gt; 0
);
dbms_lob.close(
    lob_loc =&gt; vchar1
);
end;
/
OUTPUT:
错误报告 -
ORA-22289: 无法在未打开的文件或 LOB 上执行操作
ORA-06512: 在 "SYS.DBMS_LOB", line 666
ORA-06512: 在 line 8
22289. 00000 -  "cannot perform %s operation on an unopened file or LOB"
*Cause:    The file or LOB is not open for the required operation to be
           performed.
*Action:   Precede the current operation with a successful open operation
           on the file or LOB.

```

```
declare
 clob1 clob := '1234';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 0
);
dbms_lob.close(
    lob_loc =&gt; clob1
);
dbms_lob.close(
    lob_loc =&gt; clob1
);
end;
/
OUTPUT:
错误报告 -
ORA-22289: 无法在未打开的文件或 LOB 上执行操作
ORA-06512: 在 "SYS.DBMS_LOB", line 666
ORA-06512: 在 line 11
22289. 00000 -  "cannot perform %s operation on an unopened file or LOB"
*Cause:    The file or LOB is not open for the required operation to be
           performed.
*Action:   Precede the current operation with a successful open operation
           on the file or LOB.

```

###   [2.3 ISOPEN Functions](#23-isopen-functions)  

YASDB暂不支持BFILE，以下调研关于BLOB和CLOB的

####   [2.3.1 Syntax（语法）](#231-syntax语法)  

```
DBMS_LOB.ISOPEN (
   lob_loc IN BLOB) 
  RETURN INTEGER; 

DBMS_LOB.ISOPEN (
   lob_loc IN CLOB CHARACTER SET ANY_CS) 
  RETURN INTEGER; 

```

####   [2.3.2 Pragmas（编译指示）](#232-pragmas编译指示)  

```
PRAGMA RESTRICT_REFERENCES(isopen, WNDS, RNDS, WNPS, RNPS); 

```

####   [2.3.3 Parameter（参数）](#233-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN|BLOB/CLOB|是|-|LOB定位符|


返回值：INTEGER类型，打开的lob返回1，否则返回0

|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|


####   [2.3.4 Details（详细分析）](#234-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'ISOPEN' 声明与此次调用相匹配。    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  对于内部LOB，打开状态与LOB相关，而不是与定位符相关。如果locator1打开了LOB，那么locator2也会将LOB视为打开。对于内部LOB，ISOPEN需要往返，因为它检查服务器上的状态以查看LOB是否确实打开

```
declare
 clob1 clob := '1234';
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 1
);
dbms_output.put_line(
    dbms_lob.isopen(lob_loc =&gt; clob1)
);
end;
/
OUTPUT:
1

PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob := '1234';
begin
dbms_output.put_line(
    dbms_lob.isopen(lob_loc =&gt; clob1)
);
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob;
begin
dbms_output.put_line(
    dbms_lob.isopen(lob_loc =&gt; clob1)
);
end;
/
OUTPUT:
declare
*
第 1 行出现错误:
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 907
ORA-06512: 在 line 4

```

```
declare
 clob1 varchar(100):='aaa';
begin
dbms_output.put_line(
    dbms_lob.isopen(lob_loc =&gt; clob1)
);
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob := '1234';
 clob2 clob;
begin
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 1
);
clob2:=clob1;
dbms_output.put_line(
    dbms_lob.isopen(lob_loc =&gt; clob2)
);
end;
/
OUTPUT:
1

PL/SQL 过程已成功完成。

```

```
create table testisopen(c1 clob);
insert into testisopen values('aaa');

declare
 clob1 clob;
 clob2 clob;
begin
select c1 into clob1 from testisopen;
dbms_lob.open(
      lob_loc =&gt; clob1
    , open_mode =&gt; 1
);
select c1 into clob2 from testisopen;
dbms_output.put_line(
    dbms_lob.isopen(lob_loc =&gt; clob2)
);
end;
/
OUTPUT:
1

PL/SQL 过程已成功完成。

```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  