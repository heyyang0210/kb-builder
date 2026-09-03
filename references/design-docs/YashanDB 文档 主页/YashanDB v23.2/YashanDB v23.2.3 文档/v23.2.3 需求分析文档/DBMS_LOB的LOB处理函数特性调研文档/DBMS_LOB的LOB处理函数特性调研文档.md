Created by 曾思尹, last modified on 一月 18, 2024

#   [YDBRD-22219: DBMS_LOB的LOB处理函数Research（DBMS_LOB的LOB处理函数特性调研）](#ydbrd-22219-dbms-lob的lob处理函数researchdbms-lob的lob处理函数特性调研)  

SR链接：    [YDBRD-22219](https://jira.yasdb.com/browse/YDBRD-22219?src=confmacro)    -  DBMS_LOB的LOB处理函数  完成

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_LOB文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOB.html#GUID-A35DE03B-41A6-4E55-8CDE-77737FED9306)  

（1）  **ERASE**  从指定偏移量开始擦除LOB中指定数量的数据    
  （2）  **TRIM**  将内部LOB的长度修剪为指定长度（去除末尾超出指定长度的部分）    
  （3）  **INSTR**  返回LOB中pattern第n次出现的匹配位置，从指定的偏移量开始

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 ERASE Procedures](#21-erase-procedures)  

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
DBMS_LOB.ERASE (
   lob_loc           IN OUT   NOCOPY   BLOB,
   amount            IN OUT   NOCOPY   INTEGER,
   offset            IN                INTEGER := 1);

DBMS_LOB.ERASE (
   lob_loc           IN OUT   NOCOPY   CLOB CHARACTER SET ANY_CS,
   amount            IN OUT   NOCOPY   INTEGER,
   offset            IN                INTEGER := 1);

```

####   [2.1.2 Parameter（参数）](#212-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|待擦除LOB的定位符|
|amount|IN OUT|INTEGER|是|-|(IN)擦除字节/字符数 (OUT)实际擦除字节/字符数|
|offset|IN|INTEGER|否|1|擦除起点的偏移量（字节/字符数）|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|
|DBMS_LOB.INVALID_ARGVAL|21560|参数超出范围|
|QUERY_WRITE|14553|无法在查询或PDML并行执行服务器内执行LOB写入|
|BUFFERING_ENABLED|22279|如果在LOB上启用了缓冲，则无法在启用了LOB缓冲的情况下执行操作|


####   [2.1.3 Details（详细分析）](#213-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'ERASE' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  （2）amount参数限制    
  不可为空，整数数值范围[1, IN: LOBMAXSIZE]，char隐式转换为数值，INTEGER类型变量对小数四舍五入    
  （3）offset参数限制    
  不可为空，整数数值范围[1, LOBMAXSIZE]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  当offset大于LOB末尾时，amount(OUT)=amount(IN)

从LOB中间擦除数据时，将分别为BLOB或CLOB写入零字节填充符或空格。当删除LOB的一部分时，LOB的长度不会减少。要减少LOB值的长度，请参阅“TRIM程序”。    
  如果在擦除指定的数字之前达到LOB值的末尾，则实际擦除的字节或字符数可能与amount参数指定的数字不同。实际擦除的字符或字节数在amount参数中返回。    
  如果LOB已存档，ERASE将获取该LOB，除非擦除覆盖整个LOB。    
  如果要擦除的LOB是DBFS-Link，则会引发异常。    
  将LOB操作封装在打开/关闭接口中并不是强制性的。如果在执行操作之前没有打开LOB，则在调用期间会更新LOB列上的函数索引和域索引。但是，如果在执行操作之前打开了LOB，则必须在提交事务之前关闭它。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。    
  如果未将LOB操作包装在打开/关闭API中，则每次写入LOB时都会更新函数索引和域索引。这可能会对性能产生不利影响。因此，建议将对LOB的写操作包含在OPEN或CLOSE语句中。

```
declare
 clob1 clob;
 amt int:=1;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/

OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 786
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
 clob1 clob := '1234';
 amt int:=1;
begin
dbms_lob.freetemporary(
    lob_loc =&gt; clob1
);
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/
OUTPUT:
错误报告 -
ORA-22275: 指定的 LOB 定位符无效
ORA-06512: 在 "SYS.DBMS_LOB", line 786
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
 clob1 clob := '1234';
 amt int:=1;
begin
dbms_lob.erase(
    lob_loc =&gt; NULL
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/
OUTPUT:
错误报告 -
ORA-06550: 第 5 行, 第 1 列:
PLS-00307: 有太多的 'ERASE' 声明与此次调用相匹配
ORA-06550: 第 5 行, 第 1 列:
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
 amt int:=1;
begin
dbms_lob.erase(
    lob_loc =&gt; blob1
  , amount =&gt; amt
  , offset =&gt; 2
);
dbms_lob.erase(
    lob_loc =&gt; raw1
  , amount =&gt; amt
  , offset =&gt; 2
);
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
dbms_lob.erase(
    lob_loc =&gt; char1
  , amount =&gt; amt
  , offset =&gt; 2
);
dbms_lob.erase(
    lob_loc =&gt; vchar1
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob := '1234';
 amt int:=NULL;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 786
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
 clob1 clob := '1234';
 amt int:=dbms_lob.lobmaxsize-2;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 clob1 clob := '1234';
 amt int:=dbms_lob.lobmaxsize-1;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/
OUTPUT:
错误报告 -
ORA-22923: 在流动的 LOB 写入中指定的数据数量为 0
ORA-06512: 在 "SYS.DBMS_LOB", line 786
ORA-06512: 在 line 5
22923. 00000 -  "amount of data specified in streaming LOB write is 0"
*Cause:    Trying to write LOB value via the streaming mechanism (i.e.
           unlimited write) but the input amount of data to stream was
           specified as 0.  Thus, the user is trying to write 0 bytes to
           the LOB value.
*Action:   Write more than 0 bytes to the LOB value.

declare
 clob1 clob := '1234';
 amt int:=dbms_lob.lobmaxsize;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
end;
/
OUTPUT:
错误报告 -
无法从套接字读取更多的数据
（此时连接关闭）

```

```
declare
 clob1 clob := '1234';
 amt int:=1;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; null
);
end;
/
OUTPUT:
错误报告 -
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 786
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
 clob1 clob := '1234';
 amt int:=1;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; dbms_lob.lobmaxsize
);
end;
/
OUTPUT:
PL/SQL 过程已成功完成。

declare
 clob1 clob := '1234';
 amt int:=1;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 1.5
);
dbms_output.put_line(
    clob1
);
end;
/
OUTPUT:
234

PL/SQL 过程已成功完成。

```

```
declare
 clob1 clob := '1234';
 amt int:=1;
begin
dbms_lob.erase(
    lob_loc =&gt; clob1
  , amount =&gt; amt
  , offset =&gt; 2
);
dbms_output.put_line(
    clob1
);
end;
/
OUTPUT:
1 34

PL/SQL 过程已成功完成。

```

###   [2.2 TRIM Procedures](#22-trim-procedures)  

####   [2.2.1 Syntax（语法）](#221-syntax语法)  

```
DBMS_LOB.TRIM (
   lob_loc        IN OUT  NOCOPY BLOB,
   newlen         IN             INTEGER);

DBMS_LOB.TRIM (
   lob_loc        IN OUT  NOCOPY CLOB CHARACTER SET ANY_CS,
   newlen         IN             INTEGER);

```

####   [2.2.2 Parameter（参数）](#222-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|-|待修剪LOB的定位符|
|newlen|IN|INTEGER|是|-|修剪后LOB的新长度（BLOB字节数/CLOB字符数）|


|异常|错误码|说明|
|---|---|---|
|VALUE_ERROR|6502|参数为null|
|DBMS_LOB.INVALID_ARGVAL|21560|参数超出范围|
|QUERY_WRITE|14553|无法在查询或PDML并行执行服务器内执行LOB写入|
|BUFFERING_ENABLED|22279|如果在LOB上启用了缓冲，则无法在启用了LOB缓冲的情况下执行操作|


####   [2.2.3 Details（详细分析）](#223-details详细分析)  

（1）lob_loc参数限制    
  不可使用未初始化的或设置为null的LOB定位符，否则报错ORA-06502: PL/SQL: 数字或值错误: 指定的 LOB 定位符无效: ORA-22275    
  不可使用无效的LOB定位符，否则报错ORA-22275: 指定的 LOB 定位符无效    
  直接输入null而不是变量 报错ORA-06550 PLS-00307：有太多的 'TRIM' 声明与此次调用相匹配。错误报告不是null不能用作赋值目标    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  （2）newlen参数限制    
  不可为空，整数数值范围[0, lob length]，char隐式转换为数值，常量小数向下取整

将LOB操作封装在打开/关闭接口中并不是强制性的。如果在执行操作之前没有打开LOB，则在调用期间会更新LOB列上的函数索引和域索引。但是，如果在执行操作之前打开了LOB，则必须在提交事务之前关闭它。当内部LOB关闭时，它会更新LOB列上的函数索引和域索引。如果未将LOB操作包装在打开/关闭API中，则每次写入LOB时都会更新函数索引和域索引。这可能会对性能产生不利影响。因此，建议将对LOB的写操作包含在OPEN或CLOSE语句中。    
  如果需要，TRIM在更改LOB的长度之前获取LOB，除非指定的新长度为“0”

```
declare
clob1 clob:='abcde';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 2
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
ab

PL/SQL 过程已成功完成。

```

```
declare
clob1 clob;
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 2
);
end;
/
OUTPUT:
declare
*
第 1 行出现错误:
ORA-06502: PL/SQL: 数字或值错误 : invalid LOB locator specified: ORA-22275
ORA-06512: 在 "SYS.DBMS_LOB", line 1133
ORA-06512: 在 line 4

```

```
declare
clob1 varchar(100):='abc';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 2
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
ab

PL/SQL 过程已成功完成。

```

```
declare
clob1 varchar(100):='abc';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; null
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
declare
*
第 1 行出现错误:
ORA-06502: PL/SQL: 数字或值错误
ORA-06512: 在 "SYS.DBMS_LOB", line 1133
ORA-06512: 在 line 4

```

```
declare
clob1 varchar(100):='abc';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; -1
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
declare
*
第 1 行出现错误:
ORA-21560: 参数 2 为空, 无效或超出范围
ORA-06512: 在 "SYS.DBMS_LOB", line 1133
ORA-06512: 在 line 4

```

```
declare
clob1 varchar(100):='abc';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 4
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
declare
*
第 1 行出现错误:
ORA-03001: 未实施的功能
ORA-06512: 在 "SYS.DBMS_LOB", line 1133
ORA-06512: 在 line 4

```

```
declare
clob1 varchar(100):='abc';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 1.5
);
dbms_output.put_line(
      clob1
);
end;
/
OUTPUT:
a

PL/SQL 过程已成功完成。

```

```
declare
clob1 varchar(100):='abc';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 0
);
dbms_output.put_line(
      dbms_lob.getlength(
          lob_loc =&gt; clob1
      )
);
if clob1 is null then
dbms_output.put_line(
     'varchar is null'
);
end if;
end;
/
OUTPUT:
varchar is null

PL/SQL 过程已成功完成。

declare
clob1 clob:='aaa';
begin
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 0
);
dbms_output.put_line(
      dbms_lob.getlength(
          lob_loc =&gt; clob1
      )
);
if clob1 is null then
dbms_output.put_line(
     'lob is null'
);
end if;
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
dbms_lob.createtemporary(
      lob_loc =&gt; clob1
    , cache =&gt; true
    , dur =&gt; 10
);
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 0
);
dbms_output.put_line(
      dbms_lob.getlength(
          lob_loc =&gt; clob1
      )
);
if clob1 is null then
dbms_output.put_line(
     'lob is null'
);
end if;
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

declare
clob1 clob;
begin
dbms_lob.createtemporary(
      lob_loc =&gt; clob1
    , cache =&gt; true
    , dur =&gt; 10
);
dbms_lob.trim(
      lob_loc =&gt; clob1
    , newlen =&gt; 1
);
dbms_output.put_line(
      dbms_lob.getlength(
          lob_loc =&gt; clob1
      )
);
if clob1 is null then
dbms_output.put_line(
     'lob is null'
);
end if;
end;
/
OUTPUT:
declare
*
第 1 行出现错误:
ORA-22926: 指定的截取长度大于当前的 LOB 值长度
ORA-06512: 在 "SYS.DBMS_LOB", line 1133
ORA-06512: 在 line 9

```

###   [2.3 INSTR Functions](#23-instr-functions)  

####   [2.3.1 Syntax（语法）](#231-syntax语法)  

```
DBMS_LOB.INSTR (
   lob_loc    IN   BLOB,
   pattern    IN   RAW,
   offset     IN   INTEGER := 1,
   nth        IN   INTEGER := 1)
  RETURN INTEGER;

DBMS_LOB.INSTR (
   lob_loc    IN   CLOB      CHARACTER SET ANY_CS,
   pattern    IN   VARCHAR2  CHARACTER SET lob_loc%CHARSET,
   offset     IN   INTEGER := 1,
   nth        IN   INTEGER := 1)
  RETURN INTEGER;

```

####   [2.3.2 Pragmas（编译指示）](#232-pragmas编译指示)  

```
pragma restrict_references(INSTR, WNDS, WNPS, RNDS, RNPS);

```

####   [2.3.3 Parameter（参数）](#233-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|lob_loc|IN|BLOB/CLOB|是|-|待匹配的LOB定位符|
|pattern|IN|RAW/VARCHAR|是|-|用于匹配的pattern（字节组用于BLOB，字符串用于CLOB），pattern最大长度为16383字节|
|offset|IN|INTEGER|否|1|匹配起点的LOB偏移量（字节/字符数）|
|nth|IN|INTEGER|否|1|第n个匹配|


返回值：INTEGER类型，第n个匹配上的pattern首部在LOB中的偏移量，如果未找到则返回0，如果参数无效或超出范围则返回NULL

|异常|错误码|说明|
|---|---|---|
|BUFFERING_ENABLED|22279|如果在LOB上启用了缓冲，则无法在启用了LOB缓冲的情况下执行操作|


####   [2.3.4 Details（详细分析）](#234-details详细分析)  

（1）lob_loc参数限制    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  （2）pattern参数限制    
  数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW    
  （3）offset参数限制    
  整数数值范围[1, LOBMAXSIZE]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  当offset大于LOB末尾且不超出数值范围时，函数返回0    
  （4）nth参数限制    
  整数数值范围[1, LOBMAXSIZE]，char隐式转换为数值（小数转换为数值后四舍五入），输入常量小数向下取整    
  当nth大于实际能匹配上的最大个数且不超出数值范围时，函数返回0

VARCHAR2缓冲区（模式参数）的形式必须与CLOB参数的形式匹配。换句话说，如果输入LOB参数的类型为NCLOB，那么缓冲区必须包含NCHAR数据。相反，如果输入LOB参数的类型是CLOB，那么缓冲区必须包含CHAR数据。    
  接受RAW或VARCHAR2参数进行模式匹配的操作（如INSTR）不支持模式参数或子字符串中的正则表达式或特殊匹配字符（如SQL LIKE）。

```
declare
clob1 clob:='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'ab'
    , offset =&gt; 1
    , nth =&gt; 1
  )
);
end;
/
OUTPUT:
3

PL/SQL 过程已成功完成。

declare
clob1 clob:='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'abc'
    , offset =&gt; 1
    , nth =&gt; 1
  )
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
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'ab'
    , offset =&gt; 1
    , nth =&gt; 1
  )
);
end;
/
OUTPUT:

PL/SQL 过程已成功完成。

```

```
declare
clob1 varchar(100):='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'ab'
    , offset =&gt; 1
    , nth =&gt; 1
  )
);
end;
/
OUTPUT:
3

PL/SQL 过程已成功完成。

```

```
declare
clob1 clob:='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; clob1
    , offset =&gt; 1
    , nth =&gt; 1
  )
);
end;
/
OUTPUT:
1

PL/SQL 过程已成功完成。

```

```
declare
clob1 clob:='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'ab'
    , offset =&gt; 100
    , nth =&gt; 1
  )
);
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

declare
clob1 clob:='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'ab'
    , offset =&gt; 0
    , nth =&gt; 1
  )
);
end;
/
OUTPUT:

PL/SQL 过程已成功完成。

```

```
declare
clob1 clob:='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'ab'
    , offset =&gt; 1
    , nth =&gt; 0
  )
);
end;
/
OUTPUT:

PL/SQL 过程已成功完成。

declare
clob1 clob:='ddabdabdab';
begin
dbms_output.put_line(
    dbms_lob.instr(
      lob_loc =&gt; clob1
    , pattern =&gt; 'ab'
    , offset =&gt; 1
    , nth =&gt; 4
  )
);
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  