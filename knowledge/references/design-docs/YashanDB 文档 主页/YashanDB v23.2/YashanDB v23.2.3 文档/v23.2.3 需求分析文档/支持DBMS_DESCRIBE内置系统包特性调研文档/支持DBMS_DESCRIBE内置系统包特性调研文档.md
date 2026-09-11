Created by 曾思尹, last modified on 五月 27, 2024

  [https://pingcode.yasdb.com/pjm/items/662213a8fd997db58add8d4d](https://pingcode.yasdb.com/pjm/items/662213a8fd997db58add8d4d)    ?    
  #YDBRD-26523 支持DBMS_DESCRIBE内置系统包

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_DESCRIBE文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_DESCRIBE.html#GUID-7B74EADA-2F2D-4D8A-9073-CC944C58BB00)  

（1）  **DESCRIBE_PROCEDURE**   输入存储过程的名称，返回有关该过程的参数信息。

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 DESCRIBE_PROCEDURE Procedures](#21-describe-procedure-procedures)  

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
TYPE VARCHAR2_TABLE IS TABLE OF VARCHAR2(30)
    INDEX BY BINARY_INTEGER;

TYPE NUMBER_TABLE IS TABLE OF NUMBER
    INDEX BY BINARY_INTEGER;

DBMS_DESCRIBE.DESCRIBE_PROCEDURE(
   object_name                   IN  VARCHAR2,
   reserved1                     IN  VARCHAR2,
   reserved2                     IN  VARCHAR2,
   overload                      OUT NUMBER_TABLE,
   position                      OUT NUMBER_TABLE,
   level                         OUT NUMBER_TABLE,
   argument_name                 OUT VARCHAR2_TABLE,
   datatype                      OUT NUMBER_TABLE,
   default_value                 OUT NUMBER_TABLE,
   in_out                        OUT NUMBER_TABLE,
   length                        OUT NUMBER_TABLE,
   precision                     OUT NUMBER_TABLE,
   scale                         OUT NUMBER_TABLE,
   radix                         OUT NUMBER_TABLE,
   spare                         OUT NUMBER_TABLE
   include_string_constraints    IN  BOOLEAN DEFAULT FALSE); 

```

####   [2.1.2 Parameter（参数）](#212-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|object_name|IN|VARCHAR2|是|-|过程名|
|reserved1|IN|VARCHAR2|是|-|保留字段|
|reserved2|IN|VARCHAR2|是|-|保留字段|
|overload|OUT|NUMBER_TABLE|是|-|可重载的版本号|
|position|OUT|NUMBER_TABLE|是|-|参数在参数列表中的位置，返回值位置为0|
|level|OUT|NUMBER_TABLE|是|-|参数数据类型（复合类型）的嵌套深度|
|argument_name|OUT|VARCHAR2_TABLE|是|-|参数名|
|datatype|OUT|NUMBER_TABLE|是|-|参数的数据类型（type code）|
|default_value|OUT|NUMBER_TABLE|是|-|参数是否具有默认值（1/0）|
|in_out|OUT|NUMBER_TABLE|是|-|参数方向（0-IN, 1-OUT, 2-IN OUT）|
|length|OUT|NUMBER_TABLE|是|-|参数长度（字符类型返回宽度，如果有的话，否则返回0）|
|precision|OUT|NUMBER_TABLE|是|-|NUMBER类型精度，非NUMBER类型返回0|
|scale|OUT|NUMBER_TABLE|是|-|NUMBER类型刻度，非NUMBER类型返回0|
|radix|OUT|NUMBER_TABLE|是|-|数值类型基数（10进制返回10），其他类型返回0|
|spare|OUT|NUMBER_TABLE|是|-|保留字段，返回0|
|include_string_constraints|IN|BOOLEAN|否|FALSE|对于字符类型的过程体参数，置为true时length参数返回字符类型宽度（字节），置为false时length参数返回0|


####   [2.1.3 Details（详细分析）](#213-details详细分析)  

该过程返回的参数通过查系统表获取存储过程的参数信息。

```
CURSOR GET_PROCEDURE_ARGS(OBJ_NUMBER BINARY_INTEGER) IS 
  SELECT ARGUMENT, OVERLOAD#, POSITION# POSITION, TYPE# TYPE,
         NVL(CHARSETID,0) CHARSETID, NVL(CHARSETFORM,0) CHARSETFORM,
         NVL(DEFAULT#,0) DEFAULT#, NVL(IN_OUT,0) IN_OUT,
         NVL(LEVEL#,0) LEVEL#, NVL(LENGTH,0) LENGTH, 
         NVL(PRECISION#,0) PRECISION, 
         DECODE(TYPE#,1,0,96,0,NVL(SCALE,0)) SCALE, 
         NVL(RADIX,0) RADIX,
         DECODE(TYPE#,1,NVL(SCALE,0),96,NVL(SCALE,0),0) CHARLENGTH
  FROM ARGUMENT$ 
  WHERE OBJ# = OBJ_NUMBER
  ORDER BY OBJ#,PROCEDURE$,OVERLOAD#,SEQUENCE#;

CURSOR GET_PACKAGE_ARGS(OBJ_NUMBER BINARY_INTEGER,PROC_NAME VARCHAR2) IS 
  SELECT ARGUMENT, OVERLOAD#, POSITION# POSITION, TYPE# TYPE,
         NVL(CHARSETID,0) CHARSETID, NVL(CHARSETFORM,0) CHARSETFORM,
         NVL(DEFAULT#,0) DEFAULT#, NVL(IN_OUT,0) IN_OUT,
         NVL(LEVEL#,0) LEVEL#, NVL(LENGTH,0) LENGTH, 
         NVL(PRECISION#,0) PRECISION, 
         DECODE(TYPE#,1,0,96,0,NVL(SCALE,0)) SCALE, 
         NVL(RADIX,0) RADIX,
         DECODE(TYPE#,1,NVL(SCALE,0),96,NVL(SCALE,0),0) CHARLENGTH
  FROM ARGUMENT$
  WHERE OBJ# = OBJ_NUMBER AND PROCEDURE$ = PROC_NAME
  ORDER BY OBJ#,PROCEDURE$,OVERLOAD#,SEQUENCE#;

```

（1）object_name参数    
  此参数的语法遵循SQL中用于标识符的规则。该名称可以是同义词。此参数是必需的，不能为null。名称的总长度不能超过197个字节。错误指定的OBJECT_NAME可能导致以下异常之一：    
  ORA-20000-指定了一个程序包。只能指定存储过程、存储函数、包的子过程或包的子函数。    
  ORA-20001-指定的过程或函数不存在于给定的程序包中。    
  ORA-20002-指定的对象是远程对象。此过程当前无法描述远程对象。    
  ORA-20003-指定的对象无效，无法描述。    
  ORA-20004-指定对象时出现语法错误。

（2）datatype参数    
  0   placeholder for procedures with no arguments    
  1   VARCHAR, VARCHAR, STRING    
  2   NUMBER, INTEGER, SMALLINT, REAL, FLOAT, DECIMAL    
  3   BINARY_INTEGER, PLS_INTEGER, POSITIVE, NATURAL    
  8   LONG    
  11  ROWID    
  12  DATE    
  23  RAW    
  24  LONG RAW    
  58  OPAQUE TYPE    
  96  CHAR (ANSI FIXED CHAR), CHARACTER    
  106 MLSLABEL    
  121 OBJECT    
  122 NESTED TABLE    
  123 VARRAY    
  178 TIME    
  179 TIME WITH TIME ZONE    
  180 TIMESTAMP    
  181 TIMESTAMP WITH TIME ZONE    
  231 TIMESTAMP WITH LOCAL TIME ZONE    
  250 PL/SQL RECORD    
  251 PL/SQL TABLE    
  252 PL/SQL BOOLEAN

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

  


  
