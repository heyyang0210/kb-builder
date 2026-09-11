Created by 曾思尹 on 十一月 13, 2023

#   [YDBRD-22218: DBMS_LOB的LOB读写函数Research（DBMS_LOB的LOB读写函数特性调研）](#ydbrd-22218-dbms-lob的lob读写函数researchdbms-lob的lob读写函数特性调研)  

SR链接：    [YDBRD-22218](https://jira.yasdb.com/browse/YDBRD-22218?src=confmacro)    -  DBMS_LOB的LOB读写函数  完成

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_LOB文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOB.html#GUID-A35DE03B-41A6-4E55-8CDE-77737FED9306)  

（1）  **READ**  从LOB指定偏移量开始读取指定数量的数据返回到buffer参数中    
  （2）  **WRITE**  将buffer参数中指定数量的数据从LOB指定偏移量开始写入LOB（覆盖偏移量处指定数量的已有数据）    
  （3）  **APPEND**  将完整的源LOB内容附加到目标LOB    
  （4）  **WRITEAPPEND**  将buffer参数中指定数量的数据写入LOB的末尾    
  （5）  **COPY**  将源LOB的全部或部分复制到目标LOB    
  （6）  **LOBMAXSIZE**   INTEGER类型常量，值为18446744073709551615=2  64  -1，LOB的最大字节数

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 READ Procedures](#21-read-procedures)  

YASDB暂不支持BFILE，以下调研关于BLOB和CLOB的

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
DBMS_LOB.READ (
   lob_loc   IN             BLOB,
   amount    IN OUT  NOCOPY INTEGER,
   offset    IN             INTEGER,
   buffer    OUT            RAW);

DBMS_LOB.READ (
   lob_loc   IN             CLOB CHARACTER SET ANY_CS,
   amount    IN OUT  NOCOPY INTEGER,
   offset    IN             INTEGER,
   buffer    OUT            VARCHAR2 CHARACTER SET lob_loc%CHARSET); 

```

####   [2.1.2 Parameter（参数）](#212-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN|BLOB/CLOB|是|-|待读LOB的定位符|
|amount|IN OUT|INTEGER|是|-|(IN)读取字节/字符数 (OUT)实际读取到的字节/字符数|
|offset|IN|INTEGER|是|-|读取起点的偏移量（字节/字符数）|
|buffer|OUT|RAW/VARCHAR2|是|-|读操作的输出缓冲区|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|
|DBMS_LOB.INVALID_ARGVAL|21560|参数超出范围|
|NO_DATA_FOUND|1403|到达LOB的末尾，并且没有更多的字节或字符可从LOB中读取，amount(OUT)=0|


####   [2.1.3 Details（详细分析）](#213-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'READ' 声明与此次调用相匹配    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  （2）amount参数限制    
  不可为空，整数数值范围[1, IN: 32767 (2  15  -1)  OUT: buffer容量]，char隐式转换为数值，INTEGER类型变量对小数四舍五入    
  （3）offset参数限制    
  不可为空，整数数值范围[1, LOB字节/字符数]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  （4）buffer参数限制    
  读BLOB，buffer数据类型支持RAW/BLOB/CHAR/VARCHAR（RAW到HEX的转换）；读CLOB，buffer数据类型支持VARCHAR/CHAR/CLOB/RAW（HEX到RAW的转换）    
  buffer作为out参数会对变量进行赋值，当lob_loc和buffer用同一个LOB定位符时，定位符会被替换

VARCHAR2缓冲区的形式必须与CLOB参数的形式匹配。换句话说，如果输入LOB参数的类型为NCLOB，那么缓冲区必须包含NCHAR数据。相反，如果输入LOB参数的类型是CLOB，那么缓冲区必须包含CHAR数据。    
  从客户端调用DBMS_LOB.READ时（例如，在SQL*Plus中的BEGIN/END块中），返回的缓冲区包含客户端字符集中的数据。数据库将LOB值从服务器的字符集转换为客户端的字符集，然后再将缓冲区返回给用户。    
  如果需要，READ在读取之前获取LOB。    
  如果LOB是DBFS LINK，则数据将从DBFS流式传输（如果可能的话），否则将引发异常。

```
declare
 clob1 clob;
 amt int:=2;
 buf varchar2(100);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 1081
ORA-06512: 在 line 6
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
 amt int:=2;
 buf varchar2(100);
begin
dbms_lob.freetemporary(
      lob_loc =&gt; clob1
);
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
end;
/
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 1081
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

```

```
declare
 clob1 clob:='12';
 amt int:=2;
 buf varchar2(100);
begin
dbms_lob.read(
      lob_loc =&gt; null
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 6 行, 第 1 列:
PLS-00307: 有太多的 'READ' 声明与此次调用相匹配
ORA-06550: 第 6 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob:=hextoraw('6162');
 raw1 raw(10):=hextoraw('6162');
 clob1 clob:='12';
 char1 char(10):='34';
 vchar1 varchar(10):='56';
 amt int:=2;
 buf varchar2(100);
begin
dbms_lob.read(
      lob_loc =&gt; blob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
dbms_lob.read(
      lob_loc =&gt; raw1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
dbms_lob.read(
      lob_loc =&gt; char1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
dbms_lob.read(
      lob_loc =&gt; vchar1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob:='12';
 amt int:=null;
 buf varchar2(100);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1081
ORA-06512: 在 line 6
06502. 00000 -  "PL/SQL: numeric or value error%s"
*Cause:    An arithmetic, numeric, string, conversion, or constraint error
           occurred. For example, this error occurs if an attempt is made to
           assign the value NULL to a variable declared NOT NULL, or if an
           attempt is made to assign an integer larger than 99 to a variable
           declared NUMBER(2).
*Action:   Change the data, how it is manipulated, or how it is declared so
           that values do not violate constraints.

declare
 clob1 clob:='12';
 amt int:=32767;
 buf varchar2(3);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
dbms_output.put_line(
      amt
);
end;
/
OUTPUT:
2

PL/SQL 过程已成功完成。

declare
 clob1 clob:='12';
 amt int:=32768;
 buf varchar2(3);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-21560: 参数 2 为空, 无效或超出范围
ORA-06512: 在 "SYS.DBMS_LOB", line 1081
ORA-06512: 在 line 6
21560. 00000 -  "argument %s is null, invalid, or out of range"
*Cause:    The argument is expecting a non-null, valid value but the
           argument value passed in is null, invalid, or out of range.
           Examples include when the LOB/FILE positional or size
           argument has a value outside the range 1 through (4GB - 1),
           or when an invalid open mode is used to open a file, etc.
*Action:   Check your program and correct the caller of the routine
           to not pass a null, invalid or out-of-range argument value.

declare
 clob1 clob:='123';
 amt int:=32767;
 buf varchar2(2);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; buf
);
dbms_output.put_line(
      amt
);
end;
/
OUTPUT:
错误报告 -
ORA-21560: 参数 2 为空, 无效或超出范围
ORA-06512: 在 "SYS.DBMS_LOB", line 1081
ORA-06512: 在 line 6
21560. 00000 -  "argument %s is null, invalid, or out of range"
*Cause:    The argument is expecting a non-null, valid value but the
           argument value passed in is null, invalid, or out of range.
           Examples include when the LOB/FILE positional or size
           argument has a value outside the range 1 through (4GB - 1),
           or when an invalid open mode is used to open a file, etc.
*Action:   Check your program and correct the caller of the routine
           to not pass a null, invalid or out-of-range argument value.

```

```
declare
 clob1 clob:='123';
 amt int:=3;
 buf varchar2(10);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; null
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1081
ORA-06512: 在 line 6
06502. 00000 -  "PL/SQL: numeric or value error%s"
*Cause:    An arithmetic, numeric, string, conversion, or constraint error
           occurred. For example, this error occurs if an attempt is made to
           assign the value NULL to a variable declared NOT NULL, or if an
           attempt is made to assign an integer larger than 99 to a variable
           declared NUMBER(2).
*Action:   Change the data, how it is manipulated, or how it is declared so
           that values do not violate constraints.

declare
 clob1 clob:='123';
 amt int:=3;
 buf varchar2(10);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 4
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-01403: 未找到任何数据
ORA-06512: 在 "SYS.DBMS_LOB", line 1081
ORA-06512: 在 line 6
01403. 00000 -  "no data found"
*Cause:    No data was found from the objects.
*Action:   There was no data from the objects which may be due to end of fetch.

declare
 clob1 clob:='123';
 amt int:=3;
 buf varchar2(10);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; '1.5'
    , buffer =&gt; buf
);
dbms_output.put_line(
      buf
);
end;
/
OUTPUT:
23

PL/SQL 过程已成功完成。

declare
 clob1 clob:='123';
 amt int:=3;
 buf varchar2(10);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1.5
    , buffer =&gt; buf
);
dbms_output.put_line(
      buf
);
end;
/
OUTPUT:
123

PL/SQL 过程已成功完成。

```

```
declare
 blob1 blob:=hextoraw('616263');
 amt int:=3;
 rawbuf raw(10);
 blobbuf blob;
 charbuf char(10);
 vcharbuf varchar2(10);
begin
dbms_lob.read(
      lob_loc =&gt; blob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; rawbuf
);
dbms_lob.read(
      lob_loc =&gt; blob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; blobbuf
);
dbms_lob.read(
      lob_loc =&gt; blob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; charbuf
);
dbms_lob.read(
      lob_loc =&gt; blob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; vcharbuf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 blob1 blob:=hextoraw('616263');
 amt int:=3;
 clobbuf clob;
begin
dbms_lob.read(
      lob_loc =&gt; blob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; clobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 6 行, 第 1 列:
PLS-00306: 调用 'READ' 时参数个数或类型错误
ORA-06550: 第 6 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

declare
 clob1 clob:='abc';
 amt int:=3;
 rawbuf raw(10);
 clobbuf clob;
 charbuf char(10);
 vcharbuf varchar2(10);
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; rawbuf
);
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; clobbuf
);
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; charbuf
);
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; vcharbuf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 clob1 clob:='abc';
 amt int:=3;
 blobbuf blob;
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 1
    , buffer =&gt; blobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 6 行, 第 1 列:
PLS-00306: 调用 'READ' 时参数个数或类型错误
ORA-06550: 第 6 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 clob1 clob:='abc';
 amt int:=3;
begin
dbms_lob.read(
      lob_loc =&gt; clob1
    , amount =&gt; amt
    , offset =&gt; 2
    , buffer =&gt; clob1
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
bc

PL/SQL 过程已成功完成。

```

###   [2.2 WRITE Procedures](#22-write-procedures)  

####   [2.2.1 Syntax（语法）](#221-syntax语法)  

```
DBMS_LOB.WRITE (
   lob_loc  IN OUT NOCOPY  BLOB,
   amount   IN             INTEGER,
   offset   IN             INTEGER,
   buffer   IN             RAW);

DBMS_LOB.WRITE (
   lob_loc  IN OUT  NOCOPY CLOB   CHARACTER SET ANY_CS,
   amount   IN             INTEGER,
   offset   IN             INTEGER,
   buffer   IN             VARCHAR2 CHARACTER SET lob_loc%CHARSET); 

```

####   [2.2.2 Parameter（参数）](#222-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|待写入LOB的定位符|
|amount|IN|INTEGER|是|-|写入字节/字符数|
|offset|IN|INTEGER|是|-|写入起点的偏移量（字节/字符数）|
|buffer|IN|RAW/VARCHAR|是|-|写操作的输入缓冲区|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|
|DBMS_LOB.INVALID_ARGVAL|21560|参数超出范围|
|QUERY_WRITE|14553|无法在查询或PDML并行执行服务器内执行LOB写入|
|BUFFERING_ENABLED|22279|如果在LOB上启用了缓冲，则无法在启用了LOB缓冲的情况下执行操作|
|DBMS_LOB.SECUREFILE_OUTOFBOUNDS|43883|尝试在具有FRAGMENT_*的LOB末尾后执行写入操作|
|DBMS_LOB.ACCESS_ERROR|22925|试图向LOB写入太多数据：LOB大小限制为4GB|


####   [2.2.3 Details（详细分析）](#223-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'WRITE' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  （2）amount参数限制    
  不可为空，整数数值范围[1, buffer字节/字符数]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  （3）offset参数限制    
  不可为空，整数数值范围[1, DBMS_LOB.LOBMAXSIZE]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  （4）buffer参数限制    
  不可为空。写BLOB，buffer数据类型支持RAW/BLOB/CHAR/VARCHAR（HEX到RAW的转换）；写CLOB，buffer数据类型支持VARCHAR/CHAR/CLOB/RAW（RAW到HEX的转换）    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  buffer可以和lob_loc为同一个变量

如果amount大于缓冲区中的数据，则会出现错误。如果amount小于缓冲区中的数据，则只有缓冲区中字节或字符的量被写入LOB。如果指定的偏移量超出了LOB中当前数据的末尾，则会在BLOB或CLOB中分别插入零字节填充符或空格。    
  VARCHAR2缓冲区的形式必须与CLOB参数的形式匹配。换句话说，如果输入LOB参数的类型为NCLOB，那么缓冲区必须包含NCHAR数据。相反，如果输入LOB参数的类型是CLOB，那么缓冲区必须包含CHAR数据。    
  从客户端调用DBMS_LOB.WRITE时（例如，在SQL*Plus中的BEGIN/END块中），缓冲区必须包含客户端字符集中的数据。在将缓冲区数据写入LOB之前，数据库将客户端缓冲区转换为服务器的字符集。    
  将LOB操作封装在打开/关闭接口中并不是强制性的。如果在执行操作之前没有打开LOB，则在调用期间会更新LOB列上的函数索引和域索引。但是，如果在执行操作之前打开了LOB，则必须在提交事务之前关闭它。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。    
  如果未将LOB操作包装在打开/关闭API中，则每次写入LOB时都会更新函数索引和域索引。这可能会对性能产生不利影响。因此，建议将对LOB的写操作包含在OPEN或CLOSE语句中。    
  如果需要，WRITE在写入LOB之前获取LOB，除非指定写入覆盖整个LOB。

```
declare
 clob1 clob;
 buf varchar2(2):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 4
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 1149
ORA-06512: 在 line 5
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
 clob1 clob:='abc';
 buf varchar2(2):='de';
begin
dbms_lob.freetemporary(
      lob_loc =&gt; clob1
);
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 4
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 1149
ORA-06512: 在 line 8
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
 clob1 clob:='abc';
 buf varchar2(2):='de';
begin
dbms_lob.write(
      lob_loc =&gt; null
    , amount =&gt; 2
    , offset =&gt; 4
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00307: 有太多的 'WRITE' 声明与此次调用相匹配
ORA-06550: 第 5 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob:=hextoraw('616263');
 raw1 raw(10):=hextoraw('6465');
 clob1 clob:='abc';
 char1 char(10):='de';
 vchar1 varchar2(10):='fg';
 buf varchar2(2):='66';  --for blob, hex 66 to raw is 1 byte; for clob, char 66 is 2 chars 
begin
dbms_lob.write(
      lob_loc =&gt; blob1
    , amount =&gt; 1
    , offset =&gt; 4
    , buffer =&gt; buf
);
dbms_lob.write(
      lob_loc =&gt; raw1
    , amount =&gt; 1
    , offset =&gt; 4
    , buffer =&gt; buf
);
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 4
    , buffer =&gt; buf
);
dbms_lob.write(
      lob_loc =&gt; char1
    , amount =&gt; 2
    , offset =&gt; 4
    , buffer =&gt; buf
);
dbms_lob.write(
      lob_loc =&gt; vchar1
    , amount =&gt; 2
    , offset =&gt; 4
    , buffer =&gt; buf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob:='abc';
 buf varchar2(2):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; null
    , offset =&gt; 4
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1149
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
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 3
    , offset =&gt; 4
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-21560: 参数 2 为空, 无效或超出范围
ORA-06512: 在 "SYS.DBMS_LOB", line 1149
ORA-06512: 在 line 5
21560. 00000 -  "argument %s is null, invalid, or out of range"
*Cause:    The argument is expecting a non-null, valid value but the
           argument value passed in is null, invalid, or out of range.
           Examples include when the LOB/FILE positional or size
           argument has a value outside the range 1 through (4GB - 1),
           or when an invalid open mode is used to open a file, etc.
*Action:   Check your program and correct the caller of the routine
           to not pass a null, invalid or out-of-range argument value.

declare
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 1.5
    , offset =&gt; 4
    , buffer =&gt; buf
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
abcd

PL/SQL 过程已成功完成。

declare
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; '1.5'
    , offset =&gt; 4
    , buffer =&gt; buf
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
abcde

PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; null
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1149
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
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; dbms_lob.lobmaxsize
    , buffer =&gt; buf
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
abc

PL/SQL 过程已成功完成。

declare
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; dbms_lob.lobmaxsize-1
    , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-22925: 操作将超出 LOB 值允许的最大大小
ORA-06512: 在 "SYS.DBMS_LOB", line 1149
ORA-06512: 在 line 5
22925. 00000 -  "operation would exceed maximum size allowed for a LOB value"
*Cause:    An attempt was made to write too much data to the LOB value.
           LOB size is limited to (4 gigabytes - 1) * DB_BLOCK_SIZE.
*Action:   Either start writing at a smaller LOB offset or write less data
           to the LOB value.

declare
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; '1.5'
    , buffer =&gt; buf
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
ade

PL/SQL 过程已成功完成。

declare
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 1.5
    , buffer =&gt; buf
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
dec

PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob:='abc';
 buf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 4
    , buffer =&gt; null
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1149
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
 blob1 blob:=hextoraw('616263');
 rawbuf raw(10):=hextoraw('6465');
 blobbuf blob:=hextoraw('6465');
 charbuf char(4):='6465';  --hex 6465 to raw is 2 bytes
 vcharbuf varchar2(10):='6465';
begin
dbms_lob.write(
      lob_loc =&gt; blob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; rawbuf
);
dbms_lob.write(
      lob_loc =&gt; blob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; blobbuf
);
dbms_lob.write(
      lob_loc =&gt; blob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; charbuf
);
dbms_lob.write(
      lob_loc =&gt; blob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; vcharbuf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 blob1 blob:=hextoraw('616263');
 clobbuf clob:='6465';
begin
dbms_lob.write(
      lob_loc =&gt; blob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; clobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00306: 调用 'WRITE' 时参数个数或类型错误
ORA-06550: 第 5 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

declare
 clob1 clob:='abc';
 rawbuf raw(10):=hextoraw('6465');
 clobbuf clob:='de';
 charbuf char(4):='de';
 vcharbuf varchar2(10):='de';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; rawbuf
);
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; clobbuf
);
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; charbuf
);
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; vcharbuf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 clob1 clob:='abc';
 blobbuf blob:=hextoraw('6465');
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; blobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00306: 调用 'WRITE' 时参数个数或类型错误
ORA-06550: 第 5 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 clob1 clob:='abc';
 clobbuf clob:='de';
begin
dbms_lob.freetemporary(
      lob_loc =&gt; clobbuf
);
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 2
    , offset =&gt; 3
    , buffer =&gt; clobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 line 8
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
 clob1 clob:='abc';
begin
dbms_lob.write(
      lob_loc =&gt; clob1
    , amount =&gt; 3
    , offset =&gt; 3
    , buffer =&gt; clob1
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
ababc

PL/SQL 过程已成功完成。

```

###   [2.3 APPEND Procedures](#23-append-procedures)  

####   [2.3.1 Syntax（语法）](#231-syntax语法)  

```
DBMS_LOB.APPEND (
   dest_lob IN OUT  NOCOPY BLOB, 
   src_lob  IN             BLOB); 

DBMS_LOB.APPEND (
   dest_lob IN OUT  NOCOPY CLOB  CHARACTER SET ANY_CS, 
   src_lob  IN             CLOB  CHARACTER SET dest_lob%CHARSET);

```

####   [2.3.2 Parameter（参数）](#232-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|dest_lob|IN OUT|BLOB/CLOB|是|-|待附加数据的目标LOB定位符|
|src_lob|IN|BLOB/CLOB|是|-|待读取数据的源LOB定位符|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|
|QUERY_WRITE|14553|无法在查询或PDML并行执行服务器内执行LOB写入|
|BUFFERING_ENABLED|22279|如果在LOB上启用了缓冲，则无法在启用了LOB缓冲的情况下执行操作|


####   [2.3.3 Details（详细分析）](#233-details详细分析)  

（1）dest_lob和src_lob参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  两者同时直接输入null 报错ORA-06550 PLS-00307：有太多的 'APPEND' 声明与此次调用相匹配    
  两者同时为CLOB/CHAR/VARCHAR或者BLOB/RAW。char由于是定长类型填充空格，在末尾append字符会超出字符串缓冲区    
  两者可以为同一个变量

将LOB操作封装在打开/关闭接口中并不是强制性的。如果在执行操作之前没有打开LOB，则在调用期间会更新LOB列上的函数索引和域索引。但是，如果在执行操作之前打开了LOB，则必须在提交事务之前关闭它。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。    
  如果未将LOB操作包装在打开/关闭API中，则每次写入LOB时都会更新函数索引和域索引。这可能会对性能产生不利影响。因此，建议将对LOB的写操作包含在OPEN或CLOSE语句中。    
  如果在已存档的LOB上调用APPEND，它会在写入第一个字节之前隐式地获取LOB    
  如果在作为DBFS链接的SecureFiles LOB上调用APPEND，则会引发异常。

```
declare
 clob1 clob;
begin
dbms_lob.append(
      dest_lob =&gt; clob1
    , src_lob =&gt; '123'
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 656
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
 clob1 clob:='abc';
begin
dbms_lob.freetemporary(
      lob_loc =&gt; clob1
);
dbms_lob.append(
      dest_lob =&gt; clob1
    , src_lob =&gt; '123'
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 656
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
 clob1 clob:='abc';
begin
dbms_lob.append(
      dest_lob =&gt; null
    , src_lob =&gt; null
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 4 行, 第 1 列:
PLS-00307: 有太多的 'APPEND' 声明与此次调用相匹配
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 clob1 clob:='abc';
 vchar1 varchar2(10):='123';
begin
dbms_lob.append(
      dest_lob =&gt; clob1
    , src_lob =&gt; vchar1
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 blob1 blob:=hextoraw('6162');
 raw1 raw(10):=hextoraw('6364');
begin
dbms_lob.append(
      dest_lob =&gt; raw1
    , src_lob =&gt; blob1
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 clob1 clob:='1234';
 raw1 raw(10):=hextoraw('6364');
begin
dbms_lob.append(
      dest_lob =&gt; raw1
    , src_lob =&gt; clob1
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00306: 调用 'APPEND' 时参数个数或类型错误
ORA-06550: 第 5 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 clob1 clob:='1234';
begin
dbms_lob.append(
      dest_lob =&gt; clob1
    , src_lob =&gt; clob1
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
12341234

PL/SQL 过程已成功完成。

```

###   [2.4 WRITEAPPEND Procedures](#24-writeappend-procedures)  

####   [2.4.1 Syntax（语法）](#241-syntax语法)  

```
DBMS_LOB.WRITEAPPEND (
   lob_loc IN OUT NOCOPY BLOB, 
   amount  IN            INTEGER, 
   buffer  IN            RAW); 

DBMS_LOB.WRITEAPPEND (
   lob_loc IN OUT NOCOPY CLOB CHARACTER SET ANY_CS, 
   amount  IN            INTEGER, 
   buffer  IN            VARCHAR2 CHARACTER SET lob_loc%CHARSET); 

```

####   [2.4.2 Parameter（参数）](#242-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|待写入LOB的定位符|
|amount|IN|INTEGER|是|-|写入字节/字符数|
|buffer|IN|RAW/VARCHAR|是|-|写操作的输入缓冲区|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|
|DBMS_LOB.INVALID_ARGVAL|21560|参数超出范围|
|QUERY_WRITE|14553|无法在查询或PDML并行执行服务器内执行LOB写入|
|BUFFERING_ENABLED|22279|如果在LOB上启用了缓冲，则无法在启用了LOB缓冲的情况下执行操作|


####   [2.4.3 Details（详细分析）](#243-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'WRITEAPPEND' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW。char由于是定长类型填充空格，在末尾append字符会超出字符串缓冲区    
  （2）amount参数限制    
  不可为空，整数数值范围[1, buffer字节/字符数]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  （3）buffer参数限制    
  不可为空。写BLOB，buffer数据类型支持RAW/BLOB/CHAR/VARCHAR（HEX到RAW的转换）；写CLOB，buffer数据类型支持VARCHAR/CHAR/CLOB/RAW（RAW到HEX的转换）    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效

VARCHAR2缓冲区的形式必须与CLOB参数的形式匹配。换句话说，如果输入LOB参数的类型为NCLOB，那么缓冲区必须包含NCHAR数据。相反，如果输入LOB参数的类型是CLOB，那么缓冲区必须包含CHAR数据。    
  从客户端调用DBMS_LOB.WRIEAPPEND时（例如，在SQL*Plus中的BEGIN/END块中），缓冲区必须包含客户端字符集中的数据。在将缓冲区数据写入LOB之前，数据库将客户端缓冲区转换为服务器的字符集。    
  将LOB操作封装在打开/关闭接口中并不是强制性的。如果在执行操作之前没有打开LOB，则在调用期间会更新LOB列上的函数索引和域索引。但是，如果在执行操作之前打开了LOB，则必须在提交事务之前关闭它。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。    
  如果未将LOB操作包装在打开/关闭API中，则每次写入LOB时都会更新函数索引和域索引。这可能会对性能产生不利影响。因此，建议将对LOB的写操作包含在OPEN或CLOSE语句中。    
  WRITEAPPEND在附加到LOB之前获取LOB（如果需要）。

```
declare
 clob1 clob;
begin
dbms_lob.writeappend(
      lob_loc =&gt; clob1
    , amount =&gt; 3
    , buffer =&gt; '567'
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 1163
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
 clob1 clob:='1234';
begin
dbms_lob.freetemporary(
      lob_loc =&gt; clob1
);
dbms_lob.writeappend(
      lob_loc =&gt; clob1
    , amount =&gt; 3
    , buffer =&gt; '567'
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 1163
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
 clob1 clob:='1234';
begin
dbms_lob.writeappend(
      lob_loc =&gt; null
    , amount =&gt; 3
    , buffer =&gt; '567'
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 4 行, 第 1 列:
PLS-00307: 有太多的 'WRITEAPPEND' 声明与此次调用相匹配
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 blob1 blob:=hextoraw('6465');
 clob1 clob:='abc';
 raw1 raw(10):=hextoraw('6465');
 vchar1 varchar2(10):='de';
 buf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; blob1
      , amount =&gt; 1
      , buffer =&gt; buf
);
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 2
      , buffer =&gt; buf
);
dbms_lob.writeappend(
        lob_loc =&gt; raw1
      , amount =&gt; 1
      , buffer =&gt; buf
);
dbms_lob.writeappend(
        lob_loc =&gt; vchar1
      , amount =&gt; 2
      , buffer =&gt; buf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob:='abc';
 buf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; null
      , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1163
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
 clob1 clob:='abc';
 buf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 3
      , buffer =&gt; buf
);
end;
/
OUTPUT:
错误报告 -
ORA-21560: 参数 2 为空, 无效或超出范围
ORA-06512: 在 "SYS.DBMS_LOB", line 1163
ORA-06512: 在 line 5
21560. 00000 -  "argument %s is null, invalid, or out of range"
*Cause:    The argument is expecting a non-null, valid value but the
           argument value passed in is null, invalid, or out of range.
           Examples include when the LOB/FILE positional or size
           argument has a value outside the range 1 through (4GB - 1),
           or when an invalid open mode is used to open a file, etc.
*Action:   Check your program and correct the caller of the routine
           to not pass a null, invalid or out-of-range argument value.

declare
 clob1 clob:='abc';
 buf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 1.5
      , buffer =&gt; buf
);
dbms_output.put_line(
    clob1
);
end;
/
OUTPUT:
abc6

PL/SQL 过程已成功完成。

declare
 clob1 clob:='abc';
 buf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; '1.5'
      , buffer =&gt; buf
);
dbms_output.put_line(
    clob1
);
end;
/
OUTPUT:
abc63

PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob:='abc';
 buf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 2
      , buffer =&gt; null
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1163
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
 blob1 blob:=hextoraw('61');
 rawbuf raw(10):=hextoraw('61');
 blobbuf blob:=hextoraw('61');
 charbuf char(2):='63';
 vcharbuf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; blob1
      , amount =&gt; 1
      , buffer =&gt; rawbuf
);
dbms_lob.writeappend(
        lob_loc =&gt; blob1
      , amount =&gt; 1
      , buffer =&gt; blobbuf
);
dbms_lob.writeappend(
        lob_loc =&gt; blob1
      , amount =&gt; 1
      , buffer =&gt; charbuf
);
dbms_lob.writeappend(
        lob_loc =&gt; blob1
      , amount =&gt; 1
      , buffer =&gt; vcharbuf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 blob1 blob:=hextoraw('61');
 clobbuf clob:='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; blob1
      , amount =&gt; 1
      , buffer =&gt; clobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00306: 调用 'WRITEAPPEND' 时参数个数或类型错误
ORA-06550: 第 5 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

declare
 clob1 clob:='61';
 rawbuf raw(10):=hextoraw('61');
 clobbuf clob:='61';
 charbuf char(2):='63';
 vcharbuf varchar2(10):='63';
begin
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 1
      , buffer =&gt; rawbuf
);
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 2
      , buffer =&gt; clobbuf
);
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 2
      , buffer =&gt; charbuf
);
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 2
      , buffer =&gt; vcharbuf
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 clob1 clob:='61';
 blobbuf blob:=hextoraw('61');
begin
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 1
      , buffer =&gt; blobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00306: 调用 'WRITEAPPEND' 时参数个数或类型错误
ORA-06550: 第 5 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
declare
 clob1 clob:='61';
 clobbuf clob:='61';
begin
dbms_lob.freetemporary(
    lob_loc =&gt; clobbuf
);
dbms_lob.writeappend(
        lob_loc =&gt; clob1
      , amount =&gt; 1
      , buffer =&gt; clobbuf
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 line 8
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

###   [2.5 COPY Procedures](#25-copy-procedures)  

####   [2.5.1 Syntax（语法）](#251-syntax语法)  

```
DBMS_LOB.COPY (
  dest_lob    IN OUT NOCOPY BLOB,
  src_lob     IN            BLOB,
  amount      IN            INTEGER,
  dest_offset IN            INTEGER := 1,
  src_offset  IN            INTEGER := 1);

DBMS_LOB.COPY ( 
  dest_lob    IN OUT NOCOPY CLOB  CHARACTER SET ANY_CS,
  src_lob     IN            CLOB  CHARACTER SET dest_lob%CHARSET,
  amount      IN            INTEGER,
  dest_offset IN            INTEGER := 1,
  src_offset  IN            INTEGER := 1);

```

####   [2.5.2 Parameter（参数）](#252-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|dest_lob|IN OUT|BLOB/CLOB|是|-|复制目标LOB的LOB定位符|
|src_lob|IN|BLOB/CLOB|是|-|复制源LOB的LOB定位符|
|amount|IN|INTEGER|是|-|复制的字节（对于BLOB）或字符（对于CLOB）数|
|dest_offset|IN|INTEGER|否|1|复制开始时目标LOB中的偏移量（以字节或字符为单位）|
|src_offset|IN|INTEGER|否|1|复制开始时源LOB中的偏移量（以字节或字符为单位）|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|不可为null的参数为null，字符串缓冲区太小|
|DBMS_LOB.INVALID_ARGVAL|21560|参数数值超出范围|
|QUERY_WRITE|14553|无法在查询或PDML并行执行服务器内执行LOB写入|
|BUFFERING_ENABLED|22279|如果在任一LOB上启用了缓冲，则无法在启用了LOB缓冲的情况下执行操作|


####   [2.5.3 Details（详细分析）](#253-details详细分析)  

（1）dest_lob和src_lob参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  dest_lob和src_lob的数据类型同时为BLOB（支持BLOB/RAW），或同时为CLOB（支持CLOB/CHAR/VARCHAR）    
  两者同时直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'COPY' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  （2）amount参数限制    
  不可为空，整数数值范围[1, DBMS_LOB.LOBMAXSIZE]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  对于由固定宽度多字节字符组成的CLOB，参数的最大值不得超过（lobmaxsize/character_width_in_bytes）个字符    
  （3）dest_offset参数限制    
  不可为空，整数数值范围[1, DBMS_LOB.LOBMAXSIZE]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  对于由固定宽度多字节字符组成的CLOB，参数的最大值不得超过（lobmaxsize/character_width_in_bytes）个字符    
  对于char/varchar类型，不恰当的偏移量和实际写入字符可能会超出字符串缓冲区；对于raw类型也是如此，但错误报告不同    
  （4）src_offset参数限制    
  不可为空，整数数值范围[1, DBMS_LOB.LOBMAXSIZE]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  对于由固定宽度多字节字符组成的CLOB，参数的最大值不得超过（lobmaxsize/character_width_in_bytes）个字符

如果在目标LOB中指定的偏移量超出了该LOB中当前数据的末尾，则将在目标BLOB或CLOB中分别插入零字节填充符或空格。如果偏移量小于目标LOB的当前长度，则覆盖现有数据。    
  根据src_offset和amount参数取源LOB字节或字符，当源LOB剩余字节或字符数不满足amount时，amount按实际取到的字节或字符数计算并参与后续的写入目标LOB    
  将LOB操作封装在Open/Close API中并不是强制性的。如果在执行操作之前没有打开LOB，则在调用期间会更新LOB列上的函数索引和域索引。但是，如果在执行操作之前打开了LOB，则必须在提交事务之前关闭它。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。    
  如果不在Open/Close API中封装LOB操作，则每次写入LOB时都会更新函数索引和域索引。这可能会对性能产生不利影响。因此，建议将对LOB的写操作包含在OPEN或CLOSE语句中。    
  复制之前，如果源和目标LOB当前已存档，则会检索它们。对于完全重写，不会检索目标LOB。    
  如果源LOB是DBFS链接，则数据将从DBFS流式传输（如果可能），否则将引发异常。如果目标LOB是DBFS链接，则会引发异常。

```
declare
 clobs clob := 'abcd';
 clobd clob;
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 1
    , src_offset =&gt; 1
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 727
ORA-06512: 在 line 5
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
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.freetemporary(
      lob_loc =&gt; clobs
);
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 1
    , src_offset =&gt; 1
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 727
ORA-06512: 在 line 8
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
 blobs raw(10) := hextoraw('6465');
 blobd blob := hextoraw('616263');
begin
dbms_lob.copy(
      dest_lob =&gt; blobd
    , src_lob =&gt; blobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 3
    , src_offset =&gt; 1
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 clobs varchar2(10) := 'de';
 clobd clob := 'abc';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 3
    , src_offset =&gt; 1
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
abde

PL/SQL 过程已成功完成。

declare
 blobs raw(10) := hextoraw('6465');
 clobd clob := 'abc';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; blobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 3
    , src_offset =&gt; 1
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00306: 调用 'COPY' 时参数个数或类型错误
ORA-06550: 第 5 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

```
begin
dbms_lob.copy(
      dest_lob =&gt; null
    , src_lob =&gt; null
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 3
    , src_offset =&gt; 1
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 2 行, 第 1 列:
PLS-00307: 有太多的 'COPY' 声明与此次调用相匹配
ORA-06550: 第 2 行, 第 1 列:
PL/SQL: Statement ignored
06550. 00000 -  "line %s, column %s:\n%s"
*Cause:    Usually a PL/SQL compilation error.
*Action:

```

可以为同一个LOB

```
declare
 clobd clob := 'abc';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobd
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 3
    , src_offset =&gt; 1
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
ababc

PL/SQL 过程已成功完成。

```

```
declare
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; null
    , dest_offset =&gt; 3
    , src_offset =&gt; 2
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 727
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
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; '1.5'
    , dest_offset =&gt; 3
    , src_offset =&gt; 2
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
12bc

PL/SQL 过程已成功完成。

declare
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; 1.5
    , dest_offset =&gt; 3
    , src_offset =&gt; 2
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
12b4

PL/SQL 过程已成功完成。

```

```
declare
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; null
    , src_offset =&gt; 2
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 727
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
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; '1.5'
    , src_offset =&gt; 2
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
1bcd

PL/SQL 过程已成功完成。

declare
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 1.5
    , src_offset =&gt; 2
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
bcd4

PL/SQL 过程已成功完成。

```

```
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 :  原始变量长度太大
ORA-06512: 在 line 9
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
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 4
    , src_offset =&gt; null
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 727
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
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 4
    , src_offset =&gt; '1.5'
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
123bcd

PL/SQL 过程已成功完成。

declare
 clobs clob := 'abcd';
 clobd clob := '1234';
begin
dbms_lob.copy(
      dest_lob =&gt; clobd
    , src_lob =&gt; clobs
    , amount =&gt; dbms_lob.lobmaxsize
    , dest_offset =&gt; 4
    , src_offset =&gt; 1.5
);
dbms_output.put_line(
      clobd
);
end;
/
OUTPUT:
123abcd

PL/SQL 过程已成功完成。

```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  