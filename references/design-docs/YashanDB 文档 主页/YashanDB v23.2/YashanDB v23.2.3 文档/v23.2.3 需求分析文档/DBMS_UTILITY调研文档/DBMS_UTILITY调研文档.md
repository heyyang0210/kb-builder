Created by 未知用户 (liaofeng) on 五月 12, 2023

##   [1. Overview（概述）](#1-overview概述)  

  [oracle DBMS_UTILITY文档](https://docs.oracle.com/database/121/ARPLS/d_util.htm#ARPLS73240)  

1. **FORMAT_ERROR_STACK**  返回当前的error stack格式化输出，可以用于在异常处理模块查看整个error stack信息
1. **FORMAT_CALL_STACK**  返回当前call stack（plsql函数调用栈）的格式化输出，用于stored procedure或触发器中去获取call stack，对debug十分有用。


##   [2. Features（功能特性）](#2-features功能特性)  

###   [1.语法](#1语法)  

**FORMAT_ERROR_STACK:**

```
DBMS_UTILITY.FORMAT_ERROR_STACK 
  RETURN VARCHAR2;

```

**FORMAT_CALL_STACK:**

```
DBMS_UTILITY.FORMAT_CALL_STACK 
  RETURN VARCHAR2;

```

###   [2.Pragmas](#2pragmas)  

**FORMAT_ERROR_STACK:**    
  无

**FORMAT_CALL_STACK:**

```
pragma restrict_references(format_call_stack,WNDS);

```

###   [3.返回值](#3返回值)  

**FORMAT_ERROR_STACK:**    
  返回当前error stack的格式化输出，最大2000字节。

输出示例

```
ORA-01476: divisor is equal to zero
ORA-01403: no data found

```

**FORMAT_CALL_STACK:**    
  返回当前call stack的格式化输出，最大2000字节。

输出示例

```
----- PL/SQL Call Stack -----
  object      line  object
  handle    number
name
00007FFC815D4210         4  procedure C##LIAOF.PROC1
00007FFC9C2E8BA8
6  package body C##LIAOF.PKG1.PROC2
00007FFC9C2E8250         8  procedure
C##LIAOF.PROC3
00007FFC9D2F4210         2  anonymous block

```

###   [4.功能以及限制](#4功能以及限制)  

**FORMAT_ERROR_STACK:**

1. 在存在执行错误的情况下输出错误信息，否则输出null。
1. 存在多个错误时，例如exception嵌套或者调用plsql对象，错误信息依次入栈，输出时按先进后出的次序（出栈次序）依次输出错误信息，用换行符分隔，最后一个错误信息也会输出一个换行符
1. 使用超过2000个字节的errMsg，输出截断，回退栈帧时会恢复被截断的内容（猜测buf大小不止2000）
1. 调用存储过程或自定义函数时，存储过程或自定义函数内部的error stack会在退出调用时退栈
1. 使用raise_application_error生成异常会清空之前的error stack，设置为raise_application_error的错误信息，后续可以继续入栈新的错误信息，但在存储过程调用结束后，error stack不会恢复调用前的栈帧，而是为清空状态，且清空状态会向调用栈的外层传染。
1. 普通的用户自定义异常与系统错误处理逻辑一致


**FORMAT_CALL_STACK:**

1. 输出四列信息，object handle为对象内存地址，line number为行号，object对象类型（普通sql语句显示anonymous，trigger不显示），name对象名称，包含schema，对于package或type的子过程体还包含package或type名字和子过程体名字，package的init section输出为schema.packName.__pkg_ini。oracle输出格式较为混乱
1. 能在在任何stored procedure中使用，以及匿名块和普通sql语句中使用，普通sql语句输出对象为anonymous block
1. 超过2000个字节时截断后面的内容
1. 如果是非so sql或so中的sql语句调用format_error_stack，此时补充输出一个anonymous，
1. 如果是so中sql语句再调用过程体，被调用的过程体内调用format_error_stack，并不会输出sql语句的栈帧。
1. 对于由job执行的后台线程，oracle由于job是由package实现的，会显示job对应package的调用关系（yasdb job由内置高级包实现，不会显示）


![](https://pingcode.yasdb.com/atlas/files/public/67396d8b8970c2af4f521380/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQWdBQUFBQUFBQUFBZ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk3NjEsImV4cCI6MTc4MjMyMDU2MX0.N0kRZnMtq-aka0lu2jW1kFxA_YghMyb0ApzCZBHiYHc)

## Attachments: