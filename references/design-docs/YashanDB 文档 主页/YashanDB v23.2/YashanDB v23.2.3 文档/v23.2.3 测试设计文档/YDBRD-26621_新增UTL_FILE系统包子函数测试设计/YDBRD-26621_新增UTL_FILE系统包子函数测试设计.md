Created by 黄家华, last modified on 十月 15, 2024

# **1. 概述**

本文描述utf_file高级包新增子函数的测试设计;

前置开发设计：    [UTL_FILE设计-](https://conf.yasdb.com/pages/viewpage.action?pageId=109580185)  

前置SR：    [YDBRD-13358](https://jira.yasdb.com/browse/YDBRD-13358)     -   支持UTL_FILE高级包函数  完成

前置SR:     [YDBRD-13359](https://jira.yasdb.com/browse/YDBRD-13359)     -   实现UTL_FILE.FCLOSE_ALL函数  完成

前置SR:     [[YDBRD-18477] 高级包UTL_FILE新增FGETPOS子函数 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-18477)  

本SR:     [#YDBRD-26621 新增UTL_FILE系统包子函数](https://pingcode.yasdb.com/pjm/items/66276cccfd997db58adfd9f7)  

开发文档：    [【YDBRD-26621】开发设计文档 - 陈俊杰 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153002705)  

  


  


# **2. 需求分析**

## 2.1 描述

### 需求场景：

1、ORACLE兼容场景，PLSQL支持从缓存区对RAW的读写

### 需求描述：

新增UTL_FILE系统包子函数

### 需求范围：

单机、  **分布式和集群**

### 需求规格：

GET_RAW    
  PUT_RAW

所属迭代    
  YashanDB-23.2.3.100

## 2.2 功能描述

### 概要设计方案

  [ UTL_FILE设计- - 蔡思南 - SICS-CoD Confluence (yasdb.com) ](https://conf.yasdb.com/pages/viewpage.action?pageId=109580185)  

### 开发设计方案

  [ 【YDBRD-26621】开发设计文档 - 陈俊杰 - SICS-CoD Confluence (yasdb.com) ](https://conf.yasdb.com/pages/viewpage.action?pageId=153002705)  

### 开发设计方案评审会议纪要

1、关联特性实现UTL_FILE高级包时未支持  **ab, wb, rb**   三种打开模式，在此需求交付时予以支持    
  2、关联特性交付UTL_FILE高级包时未验证  **分布式和集群的兼容性**  ，在此需求交付时完成兼容验证    
  3、分布式下以  **匿名块**  执行    
  4、put_raw往文件里写不符合字符集的raw串，后用get_line读出的场景需要自测覆盖，并与oracle做对比    
  5、是否支持同时以不同的读写模式打开同一个utl_file.file_type

### 前置操作：

UTL_FILE包为用户提供了读写系统文件的能力，用户可以通过UTL_FILE操作系统文件。

在PL/SQL中通过FOPEN获取到文件句柄后，就可以通过PUT_RAW和GET_RAW等函数实现对文件做读写的操作，通过FCLOSE关闭文件。

## 2.3 规格限制

1. 因为文件操作必须指定目录，所以  缺省路径为YASDB_DATA（还未设置）  ，然后指定目录需要手动创建。目前数据库并不支持create directory的语法。
1. 基本上在对文件进行读写动作之前都需要先执行fopen打开文件，  通过调用FOPEN返回文件句柄，在后续的操作中使用该文件句柄调用GET_RAW或者PUT_RAW等操作完成对文件的I/O。完成之后，调用FCLOSE释放资源。
1. 如果以rb方式打开，调用函数比如FSEEK、F_GETLINE、FGETPOS会报INVALID OPERATION错误，也不能调用写函数。
1. 如果以wb方式打开，调用PUTF、PUT_LINE、NEW_LINE会报INVALID OPERATION错误，也不能调用读函数。
1. 如果以r方式打开，不能调用比如PUT_RAW()
1. 如果以w方式打开，不能调用GET_RAW()
1. 本次需求支持单机、集群和分布式环境，分布式仅支持匿名块
1. 当入参类型为raw类型时，支持可以隐式转换为raw的类型（字符，blob等）
1. GET_RAW时按行读取再转为RAW，若单次读到的最大行超过fopen时指定的max_linesize，报错； 2、PUT_RAW时将RAW转为字符串按行写入文件，若单次写入的行长度超过fopen时指定的max_linesize，报错； 3、范围1~32000，默认1024


# **3. 测试设计方法 **

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

测试场景：

1. 基本功能测试 - 见下表
1. 交叉功能测试 - 运行原有测试用例
1. 并发测试


参考    [YDBRD-13358 YDBRD-13359 支持UTL_FILE高级包函数测试设计 - 徐瑶 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109594402)  

### 3.1   GET_RAW  函数基本功能：(  从一个打开的文件中读取RAW)

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大写，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file |- 句柄全大写，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|- 拼写错误
- 无效文件句柄 (句柄处于关闭状态)
- 数据类型错误（char,double，boolean等）
- 不填该参数
- NULL,’‘
|INVALID_FILEHANDLE,INVALID_OPERATION,INVALID_MAXLINESIZE  —,NO_DATA_FOUND  --文件是空,READ_ERROR --已经读到文件末尾，还在执行读操作|
|  
|buffer 存储读取的Buff    
|- 覆盖 全大写，全小写，大小写混合
- 数据类型为RAW
- 数据类型为RAW能隐式转换的varchar2, varchar, char, nvarchar, nchar, blob
|  
|- 超过数据类型限制的长度
- 数据类型错误（int、boolean、float、date、clob等）
- 空格
- 空串
|  
|
|  
|len实际读取长度    
    
|- 正数，小于文件中RAW的长度
- 0
- null（默认）
- 负数
- 不设置该参数
- 运算式，包含+-*/
- 嵌套数学函数
|  
|- 大于文件中RAW的长度
- 其他字符中文，英文
|  
|
|与其他函数组合|fopen|- 打开模式为r、rb
- 实际文件内容长度小于Max_linesize
|  
|打开模式为w、a、wb、ab|  
|
|  
|fseek|- 设置absolute_offset，relative_offset后调用get_raw读取
- get_raw读取后调用fseek
- get_raw(len)读取后调用fseek
|  
|  
|  
|
|  
|fgetpos|- get_raw读取后调用fgetpos
- get_raw(len)读取后调用fgetpos
|  
|  
|  
|
|  
|put_line，put，put_raw|- 一个handle读get_raw()文件，一个handle写(put_line, put, put_raw)文件，flush后新建一个handle读该文件或者使用之前的handle(如果handle没有读到文件尾)。
- 设置一个handle读取(get_raw)一个文件，并将读取的数据写到(put_line,put,put_raw)另一个文件去
- 循环读取一个文件(get_raw)，并将读取的数据写到(put_line,put,put_raw)另一个文件去
- 设置不同的handle读取(get_raw)不同的文件，并将读取的数据写到(put_line, put, put_raw)另一个文件去
|  
|  
|  
|
|  
|frename, fremove|文件在打开并进行读操作过程中|  
|  
|  
|
|其他场景|  
|- 使用shell 生成文件，检查get_raw读入后转换成字符。
- 用户自定义包UDP调用
|  
|- 循环读取超过文件尾 - no data found
- 读取的文件为空 - no data found
- 文件没有读权限 - access denied
,  
|  
|


### 3.2 PUT_RAW函数基本功能：

  


|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大写，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file |- 句柄全大写，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|- 拼写错误
- 无效文件句柄(句柄处于关闭状态、未初始化)
- 数据类型错误（char,double，boolean等）
- 不填该参数
- 文件句柄打开方式为读(r,rb)
|INVALID_FILEHANDLE,INVALID_MAXLINESIZE  —,INVALID_OPERATION ---,WRITE_ERROR  --- 要写入的数据>open时候设置的一行最大长度|
|  
|buffer 存储要写的Buff    
|- 覆盖 全大写，全小写，大小写混合
- 数据类型为RAW
- 数据类型为varchar, char, nchar, nvarchar, blob
- 常量
- 字符串包含数据可以隐式转换为RAW
,  
,  
|  
|- 超过数据类型限制的长度
- 数据类型错误（int、boolean、float、date等）
- 空格
- 空串
- 字符串包含不可转换为RAW的数据
|  
|
|  
|autoflush  用于表示在写之后是否立即刷到磁盘，默认是false    
|- 数据类型为boolean
- 循环写入设置false/true
- 省略该参数
|  
|- 数据类型错误（int、char、float、date等）
- 其他字符如0/1,中文等
|  
|
|与其他函数组合|fopen|- 打开模式为w，a
- 待写入内容长度小于Max_linesize
- 待写入的内容为空
- for循环put_raw
- 待写入的文件为空/非空
- 不同的内容写入同一个文件
- 同时写入多个文件（相同的内容，不同的内容）
- 写入大量数据
|  
|- 打开模式为r
- 待写入内容长度大于Max_linesize
|  
|
|  
|fflush|- 对一个文件写数据，不调用fflush查看文件内容
- 对一个文件写数据，调用fflush, 查看文件内容
- 写入内容很多超过缓冲区大小，不调用fflush（能写入）
- 数据量很少的时候如1字节能否写进去
- close后再调用fflush刷缓存数据
|  
,  
|  
|  
|
|  
|get_line|- 一个handle写put_raw()文件，一个handle读(get_line)文件，flush后使用get_line再读文件
|  
|  
|  
|
|  
|frename, fremove|- utl_file.put_raw()写文件，执行frename，rename成功，原句柄失效，新打开文件句柄(ab)可以继续写put_raw()
- 文件打开并进行utl_file.put_raw()写文件，执行fremove成功，原句柄失效
|  
|  
|  
|
|其他场景|  
|- put_raw后使用cat查看文件内容
- 用户自定义包UDP调用
|  
|- 循环写超过max_linesize再刷盘 - write error
- 打开文件句柄后移除文件目录，写文件目录不存在
- 文件没有写权限
|  
,  
|


### 3.3 FOPEN新增参数选项’rb、wb、ab'

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|入参校验|open_mode   |rb、wb、ab、RB、WB、AB、Rb、Wb、Ab|  
|1. open_mode的错误输入在YDBRD-13358已经覆盖，跑现有用例即可
|  
|
|  
|rb、wb、ab三种参数选项与其他参数组合|rb、wb、ab+max_linesize取非默认值,  
|  
|- rb、wb、ab + max_linesize取无效值
- rb、wb、ab + filename取无效值(文件名长度超过255，文件名以\或者/结尾)
- rb、wb、ab + location取无效值
|  
|
|与其他函数组合|fseek、get_line、put、put_line、fgetpos、new_line|  
|  
|传入rb、wb、ab模式打开的句柄均报错|INVALID_OPERATION|
|  
|fclose、fclose_all|rb、wb、ab|  
|  
|  
|
|  
|put_raw、fflush|wb、ab|  
|rb|Oracle 19C put_raw(rb打开的句柄)没报错|
|  
|get_raw|rb|  
|wb、ab|  
|
|其他场景|  
|- wb、ab后检查文件是否创建
- 用户自定义包UDP
|  
|- 文件目录不存在
- 文件没有读写权限
- rb打开时文件不存在
- 重复打开文件超过50次
- 打开超过50个文件
|  
|


### 3.4 UTL_FILE支持分布式和集群

在分布式和集群上运行现有UTL_FILE自动化用例

yasft-master\standalone\testcase\plsql_DBMS_external_01\UTL_FILE\*.sql

### 3.5 可能产生的异常

**用plsql  exception分支捕获，能正常捕获**

|Exception Name|Description|测试涉及的函数|
|:---|:---|:---|
|  `YAS-00326 INVALID_FILEtype`  |File handle is invalid.|get_raw -文件句柄处于关闭状态，省略句柄参数，句柄为空，null，为空格,put_raw - 省略句柄，句柄为空，null，为空格，已关闭的文件句柄|
|  `YAS-00301 INVALID_OPERATION`  |File could not be opened or operated on as requested.|- fseek-打开模式为wb、ab、rb，进行seek读数据
- new_line-打开模式为wb、ab、rb
- fgetpos-打开模式为wb、ab、rb
- get_line-打开模式为wb、ab、rb
- put_line-打开模式为wb、ab、rb
- put_raw-打开模式为r、rb
- get_raw-打开模式为w、a、wb、ab
|
|  `YAS-00328 READ_ERROR`  |Destination buffer too small, or operating system error occurred during the read operation|get_raw - buffer小于文件长度, len为负值|
|  `YAS-00325 WRITE_ERROR`  |Operating system error occurred during the write operation.|put_raw - put_raw待写入内容大于max_linesize|
|  `INTERNAL_ERROR`  |Unspecified PL/SQL error|  
|
|  `YAS-00336 FILE_OPEN`  |The requested operation failed because the file is open.|  
|
|  `YAS-00333 INVALID_MAXLINESIZE`  |The       `MAX_LINESIZE`       value for       `FOPEN()`       is invalid; it should be within the range 1 to 32767.|fopen-max_linesize参数设置=0，大于32000，为负数    
  get_raw-|
|  `YAS-00331 INVALID_FILENAME`  |The filename parameter is invalid.|fopen-文件名为空|
|  `YAS-00313 ACCESS_DENIED`  |Permission to access to the file location is denied.|fopen-|
|  `YAS-00314 DELETE_FAILED`  |The requested file delete operation failed.|fremove-一个session在put_raw，另一个session在remove|
|  `YAS-00315 RENAME_FAILED`  |The requested file rename operation failed.|frename-一个session在rename，另一个session在put_raw|
|其他error|  
|  
,  
|
|YAS-00336 too many open files , exceed 50|  
|fopen-重复打开文件超过50次，打开超过50个文件|
|YAS-00215 length of concat texts exceeds the buffer limit|  
|fopen-文件名长度超过255|
|YAS-00003 invalid parameter|  
|get_raw省略buffer参数、buffer为空‘’/null，buffer为空格‘ ’，,put_raw-autoflush为其他类型，autoflush参数加引号，buffer类型为bool|
|YAS-00008 type convert error|  
|get_raw中buffer参数与文件内容不符，len为其他字符,put_raw中buffer参数无法转换为RAW|
|YAS-00211 no data found|  
|get_raw读取的文件为空，不加seek循环读，读取的长度超过最大值|
|YAS-04204 number of String length must be between 1 and 32000|  
|put_raw-buffer超过数据类型限制长度,  
|


### 3.6 并发测试 & 可靠性测试

参考    [并发测试记录 - 徐瑶 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=115147685)     和     [UTL_FILE.FGETPOS测试设计 - 张江 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133564283)  

|  
||场景描述||
|---|---|---|---|
|并发场景||- 2  个session同时打开一个文件，session 1 put_raw写文件，session 2 get_raw读文件
- 2  个session同时打开文件，session 1 Put_raw写文件，session 2 put_raw 写文件
- session 1打开文件、put_raw写文件的同时session 2 copy文件
- session 1打开文件、get_raw读文件的同时session 2 copy 文件
- session 1打开、put_raw写文件的同时session 2 删除文件
- session 1打开、get_raw读文件的同时session 2 删除文件
- session 1打开、put_raw写文件的同时session 2 重命名文件
- session 1打开、get_raw读文件的同时session 2 重命名文件
||
|可靠性场景||读写的同时，实例进程被kill||


# 4.   **详细设计**

[YDBRD-26621_新增UTL_FILE系统包子函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGNhMWFkOWEzMzExZGM4ZTZhIiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.swPGSbkDH0ZFHJIGc40nPPR9Q0-tLGMMNfUniGwqgzY)

#   
  5.   **测试用例**

[YDBRD-26621_新增UTL_FILE系统包子函数测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGI4OTcwYzJhZjRmNTIwZmY1IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.ESHrZObF3NYscPIM9SpnoEEtBcmh9O0uIGKafeMdB3U)



|一级目录|二级目录|用例编号|用例名称|用例测试点|优先级|模块|用例集|SR编号|预置条件|操作|输入|预期结果|版本号|是否自动化|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|UTL_FILE.PUT_RAW函数测试用例|功能用例|1|test_sdv_YDBRD_26621_utl_file_putraw_01|UTL_FILE.PUT_RAW函数名校验||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||2|test_sdv_YDBRD_26621_utl_file_putraw_02|UTL_FILE.PUT_RAW函数参数校验||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||3|test_sdv_YDBRD_26621_utl_file_putraw_03|UTL_FILE.PUT_RAW与其他函数(fopen,fseek,fgetpos,put_line,put,put_raw)的组合||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||4|test_sdv_YDBRD_26621_utl_file_putraw_04|UTL_FILE.PUT_RAW与操作系统的交互(权限、文件内容、目录)||SQL引擎(Chitu)|||||||23.2.3.100|是|
||并发用例|5|test_sdv_YDBRD_26621_utl_file_putraw_05|2个session，一个读，一个写；2个session同时写；||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||6|test_sdv_YDBRD_26621_utl_file_putraw_06|2个session，一个写一个复制；2个session，一个写，一个删除；2个session，一个写一个重命名||SQL引擎(Chitu)|||||||23.2.3.100|是|
||可靠性用例|7|test_sdv_YDBRD_26621_utl_file_putraw_07|写的同时，kill实例进程||SQL引擎(Chitu)|||||||23.2.3.100|是|
|UTL_FILE.GET_RAW函数测试用例|功能用例|8|test_sdv_YDBRD_26621_utl_file_getraw_01|UTL_FILE.GET_RAW函数名校验||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||9|test_sdv_YDBRD_26621_utl_file_getraw_02|UTL_FILE.GET_RAW参数校验||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||10|test_sdv_YDBRD_26621_utl_file_getraw_03|UTL_FILE.GET_RAW与其他函数(fopen,fseek,fgetpos,put_line,put,put_raw)的组合||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||11|test_sdv_YDBRD_26621_utl_file_getraw_04|UTL_FILE.GET_RAW与操作系统的交互(权限、文件内容、目录)||SQL引擎(Chitu)|||||||23.2.3.100|是|
||并发用例|12|test_sdv_YDBRD_26621_utl_file_getraw_05|2个session同时读；||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||13|test_sdv_YDBRD_26621_utl_file_getraw_06|2个session，一个读一个复制；2个session，一个读，一个删除；2个session，一个读一个重命名||SQL引擎(Chitu)|||||||23.2.3.100|是|
||可靠性用例|14|test_sdv_YDBRD_26621_utl_file_getraw_07|写的同时，kill实例进程||SQL引擎(Chitu)|||||||23.2.3.100|是|
|UTL_FILE.FOPEN函数测试用例|功能用例|15|test_sdv_YDBRD_26621_utl_file_fopen_05|UTL_FILE.FOPEN参数校验(wb、ab、rb)||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||16|test_sdv_YDBRD_26621_utl_file_fopen_06|UTL_FILE.FOPEN与其他函数的组合||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||17|test_sdv_YDBRD_26621_utl_file_fopen_07|UTL_FILE.FOPEN与操作系统的交互(权限、目录)||SQL引擎(Chitu)|||||||23.2.3.100|是|
|||18|test_sdv_YDBRD_26621_utl_file_udp_02|通过用户自定义包和存储过程调用这三个子函数||SQL引擎(Chitu)|||||||23.2.3.100|是|




#   
  6.   **测试框架设计**

本次测试采用Guider测试框架实现功能用例，执行sql文件，对比期望结果与输出结果，输出测试结果。

CT/KT框架实现并发和可靠性用例。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、集群、分布式|


# 8. 补充

1. PUT_LINE()写入和操作系统字符集设置不一致的字符，get_raw读取到数据库，并检查数据。
1. Windows，验证fopen 二进制模式打开文件，并读写。
1. get_raw()读取大文件。
1. I/O磁盘故障、I/O繁忙


- [x] 手动测试：修改操作系统字符集，用put_line写入文件，用vi写入文件，get_raw读取到数据库并检查数据   

- [x] 手动测试：修改Oracle字符集，Oracle用put_raw输出，复制到yashan用get_raw打开，并转换成文本检查数据。   

- [x] 手动测试：修改Oracle字符集，yashan用put_raw输出，复制到Oracle用get   

- [ ] yashan没有Windows部署   

- [x] 手动测试：在Windows上创建文本文档，上传到服务器端进行读写，回到Windows端再次打开。   

- [x] 手动测试：在Oracle和yashan分别读取10G的大文件。- 性能远逊于Oracle：Oracle花费大概25秒读完12G文件，YashanDB花费大约2分半读完12G文件。   

- [x] 手动测试：在Oracle和yashan分别写10G的大文件。- 性能远逊于Oracle：Oracle花费大约2分半读写完12G文件，YashanDB花费大约   

- [x] 磁盘满：  dd if=/dev/zero of=./bill_test bs=1G count=10 - 读写大文件的时候直接报错了：就没有构造这个故障：[40:5]YAS-00301 file operation "write file" failed, errno 28, error message "No space left on device   

## Attachments:

[YDBRD-26621_新增UTL_FILE系统包子函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGI4OTcwYzJhZjRmNTIwZmY2IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.JXA4UdaV9rSnNKWzIfWgzo5oVlNZjv8izJw2S7Wqr9Q)

 (application/x-xmind)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGJhMWFkOWEzMzExZGM4ZTY1IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.ADG4H71T7281R0VvpPcprr34ZTjA2T2lvhwJi83_yUE)

 (application/x-xmind)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGI4OTcwYzJhZjRmNTIwZmY3IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.s1GqGXx-GWqMZtY6_m_GXJ9k_wWuoc_x8dMSzR_Eb4Y)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGJhMWFkOWEzMzExZGM4ZTY2IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.oXAZTp3itR5vV1YhpAt9p02GCVB8e0HS8wf8lfjIxdg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGJhMWFkOWEzMzExZGM4ZTY3IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.gP5MEcGHGg6gWY_aFiRi0MfmRUv2X_WfOh0FEUMClEM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGNhMWFkOWEzMzExZGM4ZTY5IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.Fu7nDUB4hbFrjvoZjheXke6jRmNw0PU1ogFMe78pdz8)

 (application/x-xmind)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGM4OTcwYzJhZjRmNTIwZmZhIiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.iNgv-U6036UpGVvxE-rSYFNvMR-ngWK11LYxrkiliRU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGI4OTcwYzJhZjRmNTIwZmY1IiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.ESHrZObF3NYscPIM9SpnoEEtBcmh9O0uIGKafeMdB3U)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26621_新增UTL_FILE系统包子函数测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGNhMWFkOWEzMzExZGM4ZTZhIiwicmVmX2lkIjoiNjczOTZkMGI3MjgyMDZlZmI5MmYxYTc1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQwLCJleHAiOjE3ODIzOTE5NDB9.swPGSbkDH0ZFHJIGc40nPPR9Q0-tLGMMNfUniGwqgzY)

 (application/x-xmind)    
