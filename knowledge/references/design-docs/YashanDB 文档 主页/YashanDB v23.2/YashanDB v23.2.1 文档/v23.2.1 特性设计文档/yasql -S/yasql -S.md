Created by 史鑫, last modified by  侯忠林 on 四月 23, 2023

#   [User Design（用户方案设计）](#user-design用户方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

静默模式使用yasql。静默模式和非静默有以下区别：

（1）  命令行提示(SQL>)

（2）命令回显信息（相当于echo off）

（3）登陆时显示的提示信息。登陆时省略了用户的用户名和密码，或者用户名密码输入错误，静默模式下，无提示信息。please input user name:，please input password: 

（4）版本信息

静默非静默，除以上信息外，无差异，如：结果集显示，错误信息等。

参照：

Suppresses all SQL*Plus information and prompt messages, including the command prompt, the echoing of commands, and the banner normally displayed when you start SQL*Plus. If you omit username or password, SQL*Plus prompts for them, but the prompts are not visible! Use SILENT to invoke SQL*Plus within another program so that the use of SQL*Plus is invisible to the user.

SILENT is a useful mode for creating reports for the web using the USQLPLS -MARKUP command inside a CGI script or operating system script. The SQL*Plus banner and prompts are suppressed and do not appear in reports created using the SILENT option.

##   [2. Features（功能特性）](#2-features功能特性)  

（1）静默模式开启方式：yasql -S username/pwd。-S[ILENT] 必须第一个arg，不区分大小写。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

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
            CodUint32 verify : 1;
            CodUint32 heading : 1;
            CodUint32 msg : 1;
            CodUint32 srvout : 1;
        };
    };
    CodBool interactive; --静默/交互
} PrintContext;
```

函数控制位置：

|控制项|代码位置|
|---|---|
|命令行提示(SQL>)|asqlPromot|
|命令回显信息|doEchoSQLCmd|
|登陆时显示的提示信息|asqlPrintVersion,ASQL_OUTPUT,tag:PRINT_FLAG_MSG|
|版本信息||


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. yasql -S user/password@ip:port 登录，不会有提示信息；
1. yasql -S 登录，不会提示输入user；不会提示输入passowrd；
1. 执行SQL，不会有 SQL> 输入提示符
1. exit后不会有提示信息


|交互|静默|
|---|---|
|SQL> select * from t1;,ID    
  ----------    
  1    
  1    
  1,SQL> ;    
  1* select * from t1|select * from t1;,ID    
  ----------    
  ID2    
  --------------------------------------------------------------------------------    
  1    
  aaaaaaa,1    
  aaaaaaa,  
  ;    
  1* select * from t1|
|SQL> select    
  2 *    
  3 from    
  4 t1;,ID    
  ----------    
  1    
  1    
  1,SQL>|select    
  *    
  from    
  t1    
  ;,ID    
  ----------    
  ID2    
  --------------------------------------------------------------------------------    
  1    
  aaaaaaa,1    
  aaaaaaa|
|  
|  
|


|语句|会话模式||@file||-f -e ||
|:---:|:---:|---|:---:|---|:---:|---|
||正常|-S|正常|-S|正常|-S|
|SQL>|显示|屏蔽|屏蔽|屏蔽|显示|屏蔽|
|命令回显信息|显示|屏蔽|屏蔽|屏蔽|显示|显示|
|登陆提示,please input user name:，,please input password: |显示|屏蔽|显示|屏蔽|显示|屏蔽|
|版本信息|显示|屏蔽|显示|屏蔽|显示|屏蔽|


##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:

[image2022-4-10_16-26-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMzQ4OTcwYzJhZjRmNTIwYTBjIiwicmVmX2lkIjoiNjczOTZjMzQ3MjgyMDZlZmI5MmYwZWZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NzQ0LCJleHAiOjE3ODIzODYxNDR9.6q8SUb_-tRZ62LG2_8NrpFmj-QazVZJbjXcdpNCyyws)

 (image/png)    
