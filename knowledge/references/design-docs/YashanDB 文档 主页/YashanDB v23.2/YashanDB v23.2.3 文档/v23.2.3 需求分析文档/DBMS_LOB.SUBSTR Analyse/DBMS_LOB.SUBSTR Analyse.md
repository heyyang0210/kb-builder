Created by 胡威振, last modified on 十二月 13, 2022

#   [YDBRD-8351: DBMS_LOB.SUBSTR Research（DBMS_LOB.SUBSTR 特性调研）](#ydbrd-8351-dbms-lobsubstr-researchdbms-lobsubstr-特性调研)  

SR链接：    [YDBRD-8351](https://jira.yasdb.com/browse/YDBRD-8351?src=confmacro)    -  支持DBMS_LOB.SUBSTR功能  完成

##   [1. Overview（概述）](#1-overview概述)  

```
该调研文档参考Oracle 21。
该函数返回一个从offset开始，amount个字节或字符的LOB。

```

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 Syntax（语法）](#21-syntax语法)  

- 在Oracle中可以支持三种类型：BLOB、CLOB、BFILE。 我们只有需要支持BLOB、CLOB类型，所以只调研了BLOB、CLOB类型。
- Oracle MAX_STRING_SIZE为32767字节。


```
DBMS_LOB.SUBSTR (
   lob_loc     IN    BLOB,
   amount      IN    INTEGER := 32767,
   offset      IN    INTEGER := 1)
  RETURN RAW;

DBMS_LOB.SUBSTR (
   lob_loc     IN    CLOB   CHARACTER SET ANY_CS,
   amount      IN    INTEGER := 32767,
   offset      IN    INTEGER := 1)
  RETURN VARCHAR2 CHARACTER SET lob_loc%CHARSET;

DBMS_LOB.SUBSTR (
   file_loc     IN    BFILE,
   amount      IN    INTEGER := 32767,
   offset      IN    INTEGER := 1)
  RETURN RAW;

```

###   [2.2 Parameter （参数）](#22-parameter-参数)  

|参数|类型|是否必填|默认值|说明|
|---|---|---|---|---|
|lob|LOB|是|无|要读取的LOB参数|
|amount|INTEGER|否|32767|要读取的字节数(对于blob)或字符数(对于clob/nclob)。|
|offset|INTEGER|否|1|以字节(对于blob)或字符(对于clob)为单位从LOB开始的偏移量(原点:1)。|


- 当参数为BLOB时，返回值类型为RAW，当参数为CLOB时，返回值类型为VARCHAR2。
- 根据Oracle文档描述，对于clob而言，offset和amount均以字符为单位，即从第offset个字符开始，取amount个字符，但返回的结果不超过32767字节。
- 对于blob而言，offset和amount均以字节为单位，即从第offset个字节开始，取amount个字节。
- 支持隐式转换，小数转成integer时做截断处理。
- 当出现一下情况时函数返回NULL：amount < 1、amount > 32767、offset < 1、 offset > LOBMAXSIZE、参数存在null。
- 通过测试发现，当输入的参数是BLOB和RAW时，返回值类型为RAW，当输入的参数是CLOB、CHAR、VARCHAR时，返回值类型为VARCHAR2。


###   [2.3 Details（详细分析）](#23-details详细分析)  

####   [2.3.1 参数类型](#231-参数类型)  

#####   [2.3.1.1 lob](#2311-lob)  

```
-- 不支持 integer、float、double、decimal
SQL&gt; create table t(i int, f binary_float, d binary_double, n number);
SQL&gt; insert into t values(1, 1, 1, 1);
SQL&gt; select DBMS_LOB.SUBSTR(i) from t;
SQL&gt; select DBMS_LOB.SUBSTR(f) from t;
SQL&gt; select DBMS_LOB.SUBSTR(d) from t;
SQL&gt; select DBMS_LOB.SUBSTR(n) from t;
        *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'SUBSTR' 时参数个数或类型错误

-- 不支持 date、timestamp、intervalYM、intervalDT
SQL&gt; create table t(d date, ts timestamp(2), iym interval year(9) to month, ids interval day(3) to second(2));
SQL&gt; insert into t values(to_date('2022', 'YYYY'), localtimestamp(2), '10-1', interval '5' day);
SQL&gt; select DBMS_LOB.SUBSTR(d) from t
SQL&gt; select DBMS_LOB.SUBSTR(ts) from t
SQL&gt; select DBMS_LOB.SUBSTR(iym) from t
SQL&gt; select DBMS_LOB.SUBSTR(ids) from t
        *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'SUBSTR' 时参数个数或类型错误

-- 支持 char、varchar、blob、clob、raw
SQL&gt; create table t(ch char(10), vch varchar(10), b blob, c clob, r raw(10));
SQL&gt; insert into t values('1', '1', '1', '1', '1');
SQL&gt; select DBMS_LOB.SUBSTR(ch) from t;

DBMS_LOB.SUBSTR(CH)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR(vch) from t;

DBMS_LOB.SUBSTR(VCH)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR(b) from t;

DBMS_LOB.SUBSTR(B)
--------------------------------------------------------------------------------
01

SQL&gt; select DBMS_LOB.SUBSTR(c) from t;

DBMS_LOB.SUBSTR(C)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR(r) from t;

DBMS_LOB.SUBSTR(R)
--------------------------------------------------------------------------------
01

```

#####   [2.3.1.2 amount、offset](#2312-amountoffset)  

```
-- 不支持 date、timestamp、intervalYM、intervalDT
SQL&gt; create table t(d date, ts timestamp(2), iym interval year(9) to month, ids interval day(3) to second(2));
SQL&gt; insert into t values(to_date('2022', 'YYYY'), localtimestamp(2), '10-1', interval '5' day);
SQL&gt; select DBMS_LOB.SUBSTR('1', d) from t
SQL&gt; select DBMS_LOB.SUBSTR('1', ts) from t
SQL&gt; select DBMS_LOB.SUBSTR('1', iym) from t
SQL&gt; select DBMS_LOB.SUBSTR('1', ids) from t
SQL&gt; select DBMS_LOB.SUBSTR('1', 1, d) from t
SQL&gt; select DBMS_LOB.SUBSTR('1', 1, ts) from t
SQL&gt; select DBMS_LOB.SUBSTR('1', 1, iym) from t
SQL&gt; select DBMS_LOB.SUBSTR('1', 1, ids) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'SUBSTR' 时参数个数或类型错误

-- 支持 integer、float、double、decimal
SQL&gt; create table t(i int, f binary_float, d binary_double, n number);
SQL&gt; insert into t values(1, 1, 1, 1);
SQL&gt; select DBMS_LOB.SUBSTR('1', i, i) from t;

DBMS_LOB.SUBSTR('1',I,I)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR('1', f, f) from t;

DBMS_LOB.SUBSTR('1',F,F)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR('1', d, d) from t;

DBMS_LOB.SUBSTR('1',D,D)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR('1', n, n) from t;

DBMS_LOB.SUBSTR('1',N,N)
--------------------------------------------------------------------------------
1

-- 支持 char、varchar，不支持blob、clob
SQL&gt; create table t(ch char(10), vch varchar(10), b blob, c clob);
SQL&gt; insert into t values('1', '1', '1', '1');
SQL&gt; select DBMS_LOB.SUBSTR('1', ch, ch) from t;

DBMS_LOB.SUBSTR('1',CH,CH)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR('1', vch, vch) from t;

DBMS_LOB.SUBSTR('1',VCH,VCH)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR('1', b, b) from t;
select DBMS_LOB.SUBSTR('1', b, b) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'SUBSTR' 时参数个数或类型错误


SQL&gt; select DBMS_LOB.SUBSTR('1', c, c) from t;
select DBMS_LOB.SUBSTR('1', c, c) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'SUBSTR' 时参数个数或类型错误

```

####   [2.3.2 null测试](#232-null测试)  

```
-- 任意一个为空，则返回空
SQL&gt; create table t (b blob);
SQL&gt; insert into t values(null);
SQL&gt; select DBMS_LOB.SUBSTR(b, 1, 1) from t;

DBMS_LOB.SUBSTR(B,1,1)
--------------------------------------------------------------------------------


SQL&gt; select DBMS_LOB.SUBSTR('1', null, 1) from t;

DBMS_LOB.SUBSTR('1',NULL,1)
--------------------------------------------------------------------------------


SQL&gt; select DBMS_LOB.SUBSTR('1', null, null) from t;

DBMS_LOB.SUBSTR('1',NULL,NULL)
--------------------------------------------------------------------------------



```

####   [2.3.3 小数处理方式](#233-小数处理方式)  

```
SQL&gt; select DBMS_LOB.SUBSTR('123', 1, 1) from dual;

DBMS_LOB.SUBSTR('123',1,1)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR('123', 2, 1) from dual;

DBMS_LOB.SUBSTR('123',2,1)
--------------------------------------------------------------------------------
12

SQL&gt; select DBMS_LOB.SUBSTR('123', 1.4, 1) from dual;

DBMS_LOB.SUBSTR('123',1.4,1)
--------------------------------------------------------------------------------
1

SQL&gt; select DBMS_LOB.SUBSTR('123', 1.6, 1) from dual;

DBMS_LOB.SUBSTR('123',1.6,1)
--------------------------------------------------------------------------------
1

```

####   [2.3.4 返回值类型](#234-返回值类型)  

```
SQL&gt; create table t(ch char(10), vch varchar(10), b blob, c clob, r raw(10));
SQL&gt; insert into t values('1', '1', '1', '1', '1');
SQL&gt; select dump(dbms_lob.substr(ch)) from t;

DUMP(DBMS_LOB.SUBSTR(CH))
--------------------------------------------------------------------------------
Typ=1 Len=10: 49,32,32,32,32,32,32,32,32,32

SQL&gt; select dump(dbms_lob.substr(vch)) from t;

DUMP(DBMS_LOB.SUBSTR(VCH))
--------------------------------------------------------------------------------
Typ=1 Len=1: 49

SQL&gt; select dump(dbms_lob.substr(b)) from t;

DUMP(DBMS_LOB.SUBSTR(B))
--------------------------------------------------------------------------------
Typ=23 Len=1: 1

SQL&gt; select dump(dbms_lob.substr(c)) from t;

DUMP(DBMS_LOB.SUBSTR(C))
--------------------------------------------------------------------------------
Typ=1 Len=1: 49

SQL&gt; select dump(dbms_lob.substr(r)) from t;

DUMP(DBMS_LOB.SUBSTR(R))
--------------------------------------------------------------------------------
Typ=23 Len=1: 1

```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

##   [6. Document（参考文档）](#6-document参考文档)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-F0F5D13A-C86C-4BC2-8394-8CBA3344D5CE](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-F0F5D13A-C86C-4BC2-8394-8CBA3344D5CE)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-4D20E628-C73F-4579-8AE8-770ADC4E05C1](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-4D20E628-C73F-4579-8AE8-770ADC4E05C1)  