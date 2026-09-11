Created by 刘亮杰, last modified on 一月 03, 2024

# yasql支持设置参数控制heading和feedback

SR：

  [YDBRD-22421](https://jira.yasdb.com/browse/YDBRD-22421?src=confmacro)    -  【yasql】支持设置参数控制heading和feedback  完成    [YDBRD-25043](https://jira.yasdb.com/browse/YDBRD-25043?src=confmacro)    -  【yasql】支持设置heading和feedback  完成

  


##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#1-overview%E6%A6%82%E8%BF%B0)  

支持打印属性设置：heading列名显示控制；feedback回显设置

需求范围：  单机

需求来源：  数研所    
    
  需求描述：    
  1、yasql支持set heading on /set heading off（显示/不显示表头信息）    
  2、yasql支持set feedback on/set feedback off（显示/不显示反馈）    


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

ORACLE文档

  [SET System Variable Summary (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqpug/SET-system-variable-summary.html#GUID-2C90B73B-A7E0-4357-9382-5EBAF53BF528)  

  [SET System Variable Summary (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqpug/SET-system-variable-summary.html#GUID-3C66D0E2-9EA1-4478-BB64-6F55405BEEC7)  

**（1）设置：**

|参数名|默认值|设置值|效果|
|---|---|---|---|
|feedback|on|on/off|on:开启回显,off:关闭回显|
|heading|on|on/off|on:显示列名,off:不显示列名|


Usage: 

SET FEEDBACK { ON | OFF}

feedback包括：

‘Succeed.’  ‘PL/SQL Succeed.’ ‘ROW_NUM row/rows affected.’

示例：

```
SQL> select * from dual;

DUMMY
-----
X

1 row fetched.

SQL> set feedback off
SQL> select * from dual;
DUMMY
-----
X
SQL>
```

SET HEADING { ON | OFF}

heading控制列头信息的打印。

示例：

```
SQL> select * from dual;

DUMMY
-----
X

1 row fetched.

SQL> set heading off
SQL> select * from dual;

X

1 row fetched.

SQL>
```

  


**（2）查看：**

show 可查看当前值

show   FEEDBACK 

show   HEADING

示例：

```
SQL> show heading
heading ON
SQL> show feedback
feedback OFF
SQL>
```

**（3）生效**

当前yasql进程生效。

**（4）说明**

FEED - FEEDBACK  HEA - HEADING均可解析

  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#3-interfaces%E6%8E%A5%E5%8F%A3)  

  [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

仅支持

SET FEED[BACK] {ON | OFF}    SQL_ID暂不支持

SET HEA[DING] {ON | OFF} 

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c80a1ad9a3311dc8ad5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQVFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDExMjQsImV4cCI6MTc4MjMxMTkyNH0.qe7Oz-WMFocf-ViPSpG2Ye80j2nuNkNd7_Q3ugrWlFc)

PrintContext控制打印属性。

（1）打印属性

```
typedef struct StPrintContext {
    CodChar*  buf;
    FILE*     file;
    FILE*     spool;
    FileName  spoolFile;
    CodUint32 offset;
    CodUint32 bufSize;
    union {
        CodUint32       oFlag;
        struct {
            CodUint32 feedback : 1;
            CodUint32 echo : 1;
            CodUint32 promote : 1;
            CodUint32 heading : 1;
            CodUint32 msg : 1;
            CodUint32 srvout : 1;
        };
    };
    CodBool interactive;
} PrintContext;
```

（2）打印控制

宏函数内根据PrintContext控制打印

```
#define ASQL_OUTPUT(type, fmt, ...) \
if ((type) & gCmdEnv.print.oFlag) { \
asqlPrintf(&gCmdEnv.print, fmt, ##__VA_ARGS__); \
}

#define PRINTF_ECHO(p, fmt, ...) asqlPrintfEcho(&gCmdEnv.print, p, fmt, ##__VA_ARGS__);

#define PRINTF_FEEDBACK(fmt, ...) \
if (PRINT_FLAG_FEEDBACK & gCmdEnv.print.oFlag) { \
asqlPrintf(&gCmdEnv.print, fmt, ##__VA_ARGS__); \
}

#define PRINTF_LINE(type, str, w, c, cc) \
if ((type) & gCmdEnv.print.oFlag) { \
asqlPrintLine(&gCmdEnv.print, (str), (w), (c), (cc)); \
}

#define PRINTF_PADD(type, str, c, w) \
if ((type) & gCmdEnv.print.oFlag) { \
asqlPrintPadded(&gCmdEnv.print, (str), (c), (w)); \
}
```

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

（1）名字解析测试

|参数|用例|
|---|---|
|feedback|show fee; show feed; show feedb; show feedback;|
|heading|show he;show hea; show head; show heading;|


（2）参数设置

单独设置；混合设置；设置后查看正确性

（3）参数查询

show 显示；

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments: