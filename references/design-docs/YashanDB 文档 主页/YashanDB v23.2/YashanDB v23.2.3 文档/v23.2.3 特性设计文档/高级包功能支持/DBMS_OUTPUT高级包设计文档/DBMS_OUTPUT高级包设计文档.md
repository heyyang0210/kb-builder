Created by 王海峰, last modified by  龚雯 on 十月 15, 2024

*详细设计-*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c7](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2c7)    *?*    
  *#YASHAN-887 支持DBMS_OUTPUT内置系统包和对应子函数*

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

（1）新增高级包属于ORACLE兼容性需求；（2）有外场反馈过调用，单机形态；（3）调试器打印提过需求。

支持形态：单机、集群。

###   [1.2 调研文档](#12-调研文档)  

友商参考：    [https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_OUTPUT.html](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_OUTPUT.html)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|ENABLE|功能开启函数，完成缓存初始化|是|是|
|功能|DISABLE|功能关闭函数，完成缓存清理|是|是|
|功能|NEW_LINE/PUT/PUT_LINE|打印函数，将需要打印内容放入缓存中，涉及多次打印、与GET类函数联动的处理；|是|是|
|功能|GET_LINE|获取函数，从缓存中读取一行打印内容，并将缓存改为获取状态，与后续PUT类函数有联动处理|是|是|
|功能|GET_LINES|获取函数，从缓存中读取所有需打印内容，使用UDT类型（CHAR字符串数组）作为出参；|是|是|
|功能|yasql协议适配|执行打印函数后，调用GET_LINES函数获取打印内容发送CMD_OUTPUT报文；|是|是|
|性能|性能场景1|----|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|内存溢出|当单次打印超过行允许的size大小，以及多次打印后累计值超过缓存大小，会通过抛出异常方式|否|是|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](#14-数据字典)  

无

###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|语法分支1描述|----|否|
|SQL语法|语法分支2描述|----|否|
|函数|参数/返回值描述|----|否|
|高级包|在功能场景已展开|----|是|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|补充内存溢出错误码|----|是|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](#3-规格与约束)  

（1）单行允许打印最大值为32000B（2）缓存大小在ENABLE的时候可以配置，配置范围为[2000 .. 1，000，000]，单位为B。参数指定为NULL时等效于1000000。

##   [4. 特性](#4-特性)  

###   [4.1 ENABLE/DISABLE函数和缓存设计](#41-enabledisable函数和缓存设计)  

```
  过程声明
  procedure enable (buffer_size in integer default 20000);
  procedure disable;

  缓存设计
  ENABLED         BOOLEAN;
  BUF_SIZE        BINARY_INTEGER;
  BUFLEFT         BINARY_INTEGER;
  TYPE            CHARARR IS TABLE OF VARCHAR2(32000) INDEX BY BINARY_INTEGER;
  BUF             CHARARR;

```

（1）原实现了DBMS_OUTPUT内置高级包的版本，没有设计缓存，这导致每次PUT/PUTLINE必须立即输出；当前实现要清除内置高级包实现代码，完全采用UDP方式实现。（2）参照o的DBMS_OUTPUT源码后，我们当前设计为PACKAGE级别的VARCHAR2数组。（3）缓存大小在ENABLE的时候可以配置，配置范围为[2000 .. 1，000，000]，如果小于2000按2000处理，大于1 000 000按1 000 000处理，如果设为NULL则BUF_SIZE置为1 000 000，然后设置BUF大小；（4）DISABLE函数，主要功能为清理缓存数组，重置BUF大小。（5）原    `set serveroutput on / off`    是通过handler上标记位来记录的。参照o实现，需要将    `set serveroutput on / off`    对应调整为调用enable和disable函数。

###   [4.2 NEW_LINE/PUT/PUT_LINE函数设计](#42-new-lineputput-line函数设计)  

```
  过程声明
  procedure put(string in varchar2);
  procedure put_line(line in varchar2);
  procedure new_line;

  缓存设计
  LINEBUFLEN      BINARY_INTEGER; 
  PUTIDX          BINARY_INTEGER;

```

（1）PUT函数核心的功能是在ENABLE情况下，将需要打印的字符串放入缓存数组中（2）此时需要做单行是否超过32000的上限判断、是否超过BUFFER SIZE的溢出判断，如果超出将分别抛出异常，提示错误。（3）PUT_LINE函数，在PUT函数调用后增加一次换行操作，NEW_LINE函数调用；（4）NEW_LINE函数，完成换行操作，LINEBUFLEN清0， PUTIDX自增。

###   [4.3 GET_LINE函数设计](#43-get-line函数设计)  

```
  过程声明
  procedure get_line(line out varchar2, status out integer);
  
  缓存设计
  GETIDX          BINARY_INTEGER;
  GET_IN_PROGRESS BOOLEAN;

```

（1）GET_LINE函数核心功能是在ENABLE情况下，将已经放入缓存数组中的字符串取出；（2）按GETIDX去取缓存数组对应行，取出后GETIDX自增；如果GETIDX小于PUTIDX，无法取出数据；（3）进行GET会将GET_IN_PROGRESS置为TRUE;（4）若GET后再触发了PUT动作，因为GET_IN_PROGRESS为TRUE，将重置缓存，并将GET_IN_PROGRESS改为FALSE；

###   [4.4 GET_LINES函数设计](#44-get-lines函数设计)  

```
  type chararr is table of varchar2(32000) index by binary_integer;
  procedure get_lines(lines out chararr, numlines in out integer);

  procedure get_lines(lines out dbmsoutput_linesarray, numlines in out integer); --注：因为函数重载并不支持，而且get_lines函数已实现一个版本，所以这次IR交付不包含该函数。

```

（1）GET_LINES函数的核心功能在于将缓存数组全部返回，会涉及UDT类型作为出参输出的功能；协议上支持这块需要进一步展开。（2）方案设计上，是一个WHILE循环，每次进行GET_LINE调用，准备好chararr数组后按出参形式输出。

###   [4.5 yasql协议适配设计](#45-yasql协议适配设计)  

（1）新客户端

YaSQL执行set serveroutput on时，服务端执行DBMS_OUTPUT.enable()；

YaSQL执行set serveroutput off时，服务端执行DBMS_OUTPUT.disable()；

（2）服务端适配旧客户端

在服务端执行CMD_XXX请求完成后，在发送ACK应答以前，嵌入执行GET_LINES获取函数，并发送CMD_OUTPUT包。

协议见下（图2）。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

1.serveroutput on+dbms_output enable，调用put+put_line+new_line+put_line+get_line+get_lines，检查get到的数据和屏幕打印数据的正确性。2.serveroutput off+dbms_output enable，调用put+put_line+new_line+put_line+get_line+get_lines。3.serveroutput on+dbms_output disable，调用put+put_line+new_line+put_line+get_line+get_lines。4.serveroutput off+dbms_output disable，调用put+put_line+new_line+put_line+get_line+get_lines。5.测试行溢出、buffer溢出的报错场景。

##   [6.资料设计章节](#6资料设计章节)  

修改PL参考手册-内置高级包-DBMS_OUTPUT章节，新增存储过程描述和类型chararr描述。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。（1）支持重载后需要新增get_lines另一种实现。（2）客户端支持udt解析后，需要协议调整，见图3。

- 图1


- 图2


![](https://pingcode.yasdb.com/atlas/files/public/67396d8aa1ad9a3311dc91e7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUNBQVFBQUFBQUFCQUFCQUFBQWdBQUFBQWdBQUNBQUFBQUFBQUVBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkxMTYsImV4cCI6MTc4MjMxOTkxNn0.3uAxVgeUWAwYToKmWqeQ7UVnXLCgpRtytG3G9hBXxjE)

- 图3


![](https://pingcode.yasdb.com/atlas/files/public/67396d8a8970c2af4f521376/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUNBQVFBQUFBQUFCQUFCQUFBQWdBQUFBQWdBQUNBQUFBQUFBQUVBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkxMTYsImV4cCI6MTc4MjMxOTkxNn0.3uAxVgeUWAwYToKmWqeQ7UVnXLCgpRtytG3G9hBXxjE)

  


## Attachments:

[image2024-5-20_15-10-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODk4OTcwYzJhZjRmNTIxMzZmIiwicmVmX2lkIjoiNjczOTZkODk1OTNmOTljOWZmMjM3YzgxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MTE2LCJleHAiOjE3ODIzOTU1MTZ9.I_oboSs-WmDBc9Ur8GBwK8C0JdE8uB4AwRw4zt_Lgt0)

 (image/png)    


[image2024-5-20_15-29-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODk4OTcwYzJhZjRmNTIxMzcwIiwicmVmX2lkIjoiNjczOTZkODk1OTNmOTljOWZmMjM3YzgxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MTE2LCJleHAiOjE3ODIzOTU1MTZ9.dNmp5o1c-srWAZqc8Up3S_khD-CQTUpR2nLxpP5996s)

 (image/png)    


[image2024-5-20_15-49-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODk4OTcwYzJhZjRmNTIxMzcxIiwicmVmX2lkIjoiNjczOTZkODk1OTNmOTljOWZmMjM3YzgxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MTE2LCJleHAiOjE3ODIzOTU1MTZ9.RF6fS1-5qWvl-D0rqrXZzifrTh81Vj7iQ1wSnWtWAio)

 (image/png)    


## Comments:

|  [](null)  ,旧客户端兼容性,Posted by gongwen at 五月 21, 2024 10:56|
|---|
