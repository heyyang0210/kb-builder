Created by 胡威振, last modified on 十二月 13, 2022

#   [YDBRD-8349: DBMS_LOB.GETLENGTH Research（DBMS_LOB.GETLENGTH 特性调研）](#ydbrd-8349-dbms-lobgetlength-researchdbms-lobgetlength-特性调研)  

SR链接：    [YDBRD-8349](https://jira.yasdb.com/browse/YDBRD-8349?src=confmacro)    -  支持DBMS_LOB.GETLENGTH函数  完成

  


##   [1. Overview（概述）](#1-overview概述)  

```
该调研文档参考Oracle 21。
该高级包函数获取指定 LOB 的长度。返回以字节或字符为单位的长度。

```

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 Syntax（语法）](#21-syntax语法)  

- 在Oracle中可以支持三种类型：BLOB、CLOB、BFILE。 我们只有需要支持BLOB、CLOB类型，所以只调研了BLOB、CLOB类型。


```
DBMS_LOB.GETLENGTH (
   lob_loc    IN  BLOB) 
  RETURN INTEGER;
 
DBMS_LOB.GETLENGTH (
   lob_loc    IN  CLOB   CHARACTER SET ANY_CS) 
  RETURN INTEGER; 

DBMS_LOB.GETLENGTH (
   file_loc    IN  BFILE) 
  RETURN INTEGER;

```

###   [2.2 Parameter （参数）](#22-parameter-参数)  

- 只接受一个参数，参数类型为blob、clob、char、varchar、raw类型，返回lob的字节或字符长度，返回值类型是INTEGER。
- 对于blob和raw而言，返回的是字节的长度；对于char、varchar、clob而言，返回的是字符的长度。
- 如果输入为Null，则输出为Null。


###   [2.3 Details（详细分析）](#23-details详细分析)  

####   [2.3.1 参数类型](#231-参数类型)  

```
-- 不支持 integer、float、double、decimal
SQL&gt; create table t(i int, f binary_float, d binary_double, n number);
SQL&gt; insert into t values(1, 1, 1, 1);
SQL&gt; select DBMS_LOB.GETLENGTH(i) from t;
SQL&gt; select DBMS_LOB.GETLENGTH(f) from t;
SQL&gt; select DBMS_LOB.GETLENGTH(d) from t;
SQL&gt; select DBMS_LOB.GETLENGTH(n) from t;
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'GETLENGTH' 时参数个数或类型错误

-- 不支持 date、timestamp、intervalYM、intervalDT
SQL&gt; create table t(d date, ts timestamp(2), iym interval year(9) to month, ids interval day(3) to second(2));
SQL&gt; insert into t values(to_date('2022', 'YYYY'), localtimestamp(2), '10-1', interval '5' day);
SQL&gt; select  DBMS_LOB.GETLENGTH(d) from t
SQL&gt; select DBMS_LOB.GETLENGTH(ts) from t
SQL&gt; select DBMS_LOB.GETLENGTH(iym) from t
SQL&gt; select DBMS_LOB.GETLENGTH(ids) from t
       *
第 1 行出现错误:
ORA-06553: PLS-306: 调用 'GETLENGTH' 时参数个数或类型错误

-- 支持 char、varchar、blob、clob、raw
SQL&gt; create table t(ch char(10), vch varchar(10), b blob, c clob, r raw(10));
SQL&gt; insert into t values('1', '1', '1', '1', '1');
SQL&gt; select  DBMS_LOB.GETLENGTH(ch) from t;

DBMS_LOB.GETLENGTH(CH)
----------------------
                    10

SQL&gt; select  DBMS_LOB.GETLENGTH(vch) from t;

DBMS_LOB.GETLENGTH(VCH)
-----------------------
                      1

SQL&gt; select  DBMS_LOB.GETLENGTH(b) from t;

DBMS_LOB.GETLENGTH(B)
---------------------
                    1

SQL&gt; select  DBMS_LOB.GETLENGTH(c) from t;

DBMS_LOB.GETLENGTH(C)
---------------------
                    1

SQL&gt; select  DBMS_LOB.GETLENGTH(r) from t;

DBMS_LOB.GETLENGTH(R)
---------------------
                    1

```

####   [2.3.2 null测试](#232-null测试)  

```
-- 输入为空，则返回空
SQL&gt; create table t(b blob);
SQL&gt; insert into t values(null);
SQL&gt; select DBMS_LOB.GETLENGTH(b) from t;

DBMS_LOB.GETLENGTH(B)
---------------------


```

####   [2.3.3 对raw的处理方式](#233-对raw的处理方式)  

```
SQL&gt; select r, length(r), dbms_lob.getlength(r) from t1;

R                                         LENGTH(R) DBMS_LOB.GETLENGTH(R)
---------------------------------------- ---------- ---------------------
01                                                2                     1
02                                                2                     1
15                                                2                     1
16                                                2                     1
20                                                2                     1
0100                                              4                     2
1000                                              4                     2
010000                                            6                     3
01000000                                          8                     4

```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

##   [6. Document（参考文档）](#6-document参考文档)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-61FDB1D4-829F-4990-8C89-271EB4A5C04C](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-61FDB1D4-829F-4990-8C89-271EB4A5C04C)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-4D20E628-C73F-4579-8AE8-770ADC4E05C1](https://docs.oracle.com/en/database/oracle/oracle-database/21/arpls/DBMS_LOB.html#GUID-4D20E628-C73F-4579-8AE8-770ADC4E05C1)  