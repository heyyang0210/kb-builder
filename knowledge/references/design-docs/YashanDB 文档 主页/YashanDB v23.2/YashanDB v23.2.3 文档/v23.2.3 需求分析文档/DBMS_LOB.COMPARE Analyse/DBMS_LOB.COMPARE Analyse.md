Created by 胡威振, last modified on 十二月 13, 2022

#   [YDBRD-8352: DBMS_LOB.COMPARE Research（DBMS_LOB.COMPARE 特性调研）](#ydbrd-8352-dbms-lobcompare-researchdbms-lobcompare-特性调研)  

SR链接：    [YDBRD-8352](https://jira.yasdb.com/browse/YDBRD-8352?src=confmacro)    -  支持DBMS_LOB.COMPARE  完成

##   [1. Overview（概述）](#1-overview概述)  

```
该调研文档参考Oracle 21。
这个高级包函数功能是比较两个完整的lob或两个lob的一部分。
如果lob_1小于lob_2，则返回-1;如果大于lob_2，则返回 1;如果等于lob_2，则返回 0。

```

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 Syntax（语法）](#21-syntax语法)  

- 在Oracle中可以支持三种类型：BLOB、CLOB、BFILE。 我们只有需要支持BLOB、CLOB类型，所以只调研了BLOB、CLOB类型。


```
DBMS_LOB.COMPARE (
   lob_1            IN BLOB,
   lob_2            IN BLOB,
   amount           IN INTEGER := DBMS_LOB.LOBMAXSIZE,
   offset_1         IN INTEGER := 1,
   offset_2         IN INTEGER := 1)
  RETURN INTEGER;

DBMS_LOB.COMPARE (
   lob_1            IN CLOB  CHARACTER SET ANY_CS,
   lob_2            IN CLOB  CHARACTER SET lob_1%CHARSET,
   amount           IN INTEGER := DBMS_LOB.LOBMAXSIZE,
   offset_1         IN INTEGER := 1,
   offset_2         IN INTEGER := 1)
  RETURN INTEGER;

DBMS_LOB.COMPARE (
   lob_1            IN BFILE,
   lob_2            IN BFILE,
   amount           IN INTEGER,
   offset_1         IN INTEGER := 1,
   offset_2         IN INTEGER := 1)
  RETURN INTEGER;

```

###   [2.2 Parameter （参数）](#22-parameter-参数)  

|参数|类型|是否必填|默认值|说明|
|---|---|---|---|---|
|lob_1|LOB|是|无|用于比较的第一个LOB参数|
|lob_2|LOB|是|无|用于比较的第二个LOB参数。|
|amount|INTEGER|否|LOBMAXSIZE|用于比较的字节数(对于blob)或字符数(对于clob/nclob)。|
|offset_1|INTEGER|否|1|用于比较的第一个LOB(orgin:1)上的字节或字符偏移量。|
|offset_2|INTEGER|否|1|用于比较的第二个LOB(origin:1)上的字节或字符偏移量。|


- 根据Oracle文档描述，对于clob而言，offset和amount均以字符为单位，即从第offset个字符开始，取amount个字符。
- 对于blob而言，offset和amount均以字节为单位，即从第offset个字节开始，取amount个字节。
- 返回值类型是integer。如果数据在offset和amount参数指定的范围内完全匹配，COMPARE返回0。如果第一个LOB小于第二个LOB, COMPARE返回-1，如果它大于第二个CLOB，则返回1。
- 如果amount、offset_1、offset_2中的任意一个不是有效的LOB偏移值，则返回NULL。有效的偏移量在1到LOBMAXSIZE(包括)的范围内。
- 只能比较相同数据类型的lob，BLOB与BLOB比较，CLOB与CLOB比较。
- 对于固定宽度的n字节clob，如果输入的amount大于(LOBMAXSIZE/n)，则amount取(LOBMAXSIZE/n)和Max(length(clob1)， length(clob2))中的较小者。其中LOBMAXSIZE=18446744073709551615。
- 支持隐式转换，小数转成integer时做截断处理。


###   [2.3 Details（详细分析）](#23-details详细分析)  

####   [2.3.1 参数类型](#231-参数类型)  

#####   [2.3.1.1 lob_1、lob_2](#2311-lob-1lob-2)  

```
-- 不支持 integer、float、double、decimal
create table t(i int, f binary_float, d binary_double, n number);
insert into t values(1, 1, 1, 1);
select DBMS_LOB.COMPARE(i, i) from t;
select DBMS_LOB.COMPARE(f, f) from t;
select DBMS_LOB.COMPARE(d, d) from t;
select DBMS_LOB.COMPARE(n, n) from t;
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误

-- 不支持 date、timestamp、intervalYM、intervalDT
create table t(d date, ts timestamp(2), iym interval year(9) to month, ids interval day(3) to second(2));
insert into t values(to_date('2022', 'YYYY'), localtimestamp(2), '10-1', interval '5' day);
select DBMS_LOB.COMPARE(d, d) from t
select DBMS_LOB.COMPARE(ts, ts) from t
select DBMS_LOB.COMPARE(iym, iym) from t
select DBMS_LOB.COMPARE(ids, ids) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误

-- 支持 char、varchar、blob、clob、raw
SQL&gt; create table t(ch char(10), vch varchar(10), b blob, c clob, r raw(10));
SQL&gt; insert into t values('1', '1', '1', '1', '1');
SQL&gt; select DBMS_LOB.COMPARE(ch, ch) from t;

DBMS_LOB.COMPARE(CH,CH)
-----------------------
                      0

SQL&gt; select DBMS_LOB.COMPARE(vch, vch) from t;

DBMS_LOB.COMPARE(VCH,VCH)
-------------------------
                        0

SQL&gt; select DBMS_LOB.COMPARE(b, b) from t;

DBMS_LOB.COMPARE(B,B)
---------------------
                    0

SQL&gt; select DBMS_LOB.COMPARE(c, c) from t;

DBMS_LOB.COMPARE(C,C)
---------------------
                    0
SQL&gt; select DBMS_LOB.COMPARE(r, r) from t;

DBMS_LOB.COMPARE(R,R)
---------------------
                    0

```

#####   [2.3.1.2 amount、offset_1、offset_2](#2312-amountoffset-1offset-2)  

```
-- 不支持 date、timestamp、intervalYM、intervalDT
SQL&gt; create table t(d date, ts timestamp(2), iym interval year(9) to month, ids interval day(3) to second(2));
SQL&gt; insert into t values(to_date('2022', 'YYYY'), localtimestamp(2), '10-1', interval '5' day);
SQL&gt; select DBMS_LOB.COMPARE('1', '1', d) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', ts) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', iym) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', ids) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, d, ts) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, iym, ids) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误

-- 支持 integer、float、double、decimal
SQL&gt; create table t(i int, f binary_float, d binary_double, n number);
SQL&gt; insert into t values(1, 1, 1, 1);
SQL&gt; select DBMS_LOB.COMPARE('1', '1', i) from t;

DBMS_LOB.COMPARE('1','1',I)
---------------------------
                          0

SQL&gt; select DBMS_LOB.COMPARE('1', '1', f) from t;

DBMS_LOB.COMPARE('1','1',F)
---------------------------
                          0

SQL&gt; select DBMS_LOB.COMPARE('1', '1', d) from t;

DBMS_LOB.COMPARE('1','1',D)
---------------------------
                          0

SQL&gt; select DBMS_LOB.COMPARE('1', '1', n) from t;

DBMS_LOB.COMPARE('1','1',N)
---------------------------
                          0

SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, i, f) from t;

DBMS_LOB.COMPARE('1','1',1,I,F)
-------------------------------
                              0

SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, d, n) from t;

DBMS_LOB.COMPARE('1','1',1,D,N)
-------------------------------
                              0

-- 支持 char、varchar，不支持blob、clob
SQL&gt; create table t(ch char(10), vch varchar(10), b blob, c clob);
SQL&gt; insert into t values('1', '1', '1', '1');
SQL&gt; select DBMS_LOB.COMPARE('1', '1', ch) from t;

DBMS_LOB.COMPARE('1','1',CH)
----------------------------
                           0

SQL&gt; select DBMS_LOB.COMPARE('1', '1', vch) from t;

DBMS_LOB.COMPARE('1','1',VCH)
-----------------------------
                            0

SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, ch, vch) from t;

DBMS_LOB.COMPARE('1','1',1,CH,VCH)
----------------------------------
                                 0
SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, b, b) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, c, c) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', c) from t
SQL&gt; select DBMS_LOB.COMPARE('1', '1', b) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误

```

####   [2.3.2 null测试](#232-null测试)  

```
-- 任意一个为空，则返回空
SQL&gt; select DBMS_LOB.COMPARE(null, '1', 1, 1, 1) from t;
SQL&gt; select DBMS_LOB.COMPARE('1', null, 1, 1, 1) from t;
SQL&gt; select DBMS_LOB.COMPARE('1', '1', null, 1, 1) from t;
SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, null, 1) from t;
SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, 1, null) from t;

DBMS_LOB.COMPARE('1','1',1,1,NULL)
----------------------------------


```

####   [2.3.3 数字、小数处理方式](#233-数字小数处理方式)  

```
SQL&gt; select DBMS_LOB.COMPARE('12','1',1) from t;
----------------------------
                           0

SQL&gt; select DBMS_LOB.COMPARE('12', '1', 2) from t;

DBMS_LOB.COMPARE('12','1',2)
----------------------------
                           1

SQL&gt; select DBMS_LOB.COMPARE('12', '1', 1.4) from t;

DBMS_LOB.COMPARE('12','1',1.4)
------------------------------
                             0

SQL&gt; select DBMS_LOB.COMPARE('12', '1', 1.6) from t;

DBMS_LOB.COMPARE('12','1',1.6)
------------------------------
                             0

SQL&gt; select DBMS_LOB.COMPARE('12', '1', 2) from t;

DBMS_LOB.COMPARE('12','1',2)
----------------------------
                           1

SQL&gt; select DBMS_LOB.COMPARE('1', '1', -1) from t;

DBMS_LOB.COMPARE('1','1',-1)
----------------------------


SQL&gt; select DBMS_LOB.COMPARE('1', '1', 1, -1) from t;

DBMS_LOB.COMPARE('1','1',1,-1)
------------------------------

// amount、offset超出最大值，返回为null
SQL&gt; select dbms_lob.compare(c, c, 18446744073709551615) from t;

DBMS_LOB.COMPARE(C,C,18446744073709551615)
------------------------------------------
                                         0


SQL&gt; select dbms_lob.compare(c, c, 18446744073709551616) from t;

DBMS_LOB.COMPARE(C,C,18446744073709551616)
------------------------------------------

SQL&gt; select dbms_lob.compare(c, c, 1, 18446744073709551615) from t;

DBMS_LOB.COMPARE(C,C,1,18446744073709551615)
--------------------------------------------
                                          -1

SQL&gt; select dbms_lob.compare(c, c, 1, 18446744073709551616) from t;

DBMS_LOB.COMPARE(C,C,1,18446744073709551616)
--------------------------------------------


```

####   [2.3.4 不支持BLOB、RAW与CLOB、CHAR、VARCHAR比较](#234-不支持blobraw与clobcharvarchar比较)  

```
SQL&gt; select DBMS_LOB.COMPARE(b, c) from t;
select DBMS_LOB.COMPARE(b, c) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误


SQL&gt; select DBMS_LOB.COMPARE(b, ch) from t;
select DBMS_LOB.COMPARE(b, ch) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误


SQL&gt; select DBMS_LOB.COMPARE(b, vch) from t;
select DBMS_LOB.COMPARE(b, vch) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误


SQL&gt; select DBMS_LOB.COMPARE(r, c) from t;
select DBMS_LOB.COMPARE(r, c) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误


SQL&gt; select DBMS_LOB.COMPARE(r, ch) from t;
select DBMS_LOB.COMPARE(r, ch) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误


SQL&gt; select DBMS_LOB.COMPARE(r, vch) from t;
select DBMS_LOB.COMPARE(r, vch) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'COMPARE' 时参数个数或类型错误

```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

##   [6. Document（参考文档）](#6-document参考文档)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-F3AA0160-6282-487C-A08A-C0FA22C67F4E](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-F3AA0160-6282-487C-A08A-C0FA22C67F4E)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-4D20E628-C73F-4579-8AE8-770ADC4E05C1](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-4D20E628-C73F-4579-8AE8-770ADC4E05C1)  