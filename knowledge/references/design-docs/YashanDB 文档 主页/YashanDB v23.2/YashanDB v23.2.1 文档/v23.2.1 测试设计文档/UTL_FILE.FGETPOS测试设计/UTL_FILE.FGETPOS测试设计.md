Created by 张江, last modified on 十一月 09, 2023

# 1.概述

本文档用于描述UTL_FILE.FGETPOS函数测试设计。

SR链接：    [YDBRD-21680](https://jira.yasdb.com/browse/YDBRD-21680?src=confmacro)    -  高级包UTL_FILE新增FGETPOS子函数  完成

# 2.需求分析

## 2.1功能点分析

1)函数功能：以字节为单位返回当前文件指针所在的相对文件开头(pos=0)的偏移位置，返回值类型为INTEGER。

2)语法介绍：

UTL_FILE.FGETPOS ( 

    file IN FILE_TYPE  --正确打开的文件句柄

) 

RETURN PLS_INTEGER;

FILE_TYPE类型结构：

TYPE file_type IS RECORD (

    id BINARY_INTEGER,  --文件句柄编号

    datatype BINARY_INTEGER,  --标识文件是CHAR、Nchar、二进制文件

    byte_mode BOOLEAN  --打开模式

);

3)适配范围：单机和集群

4)可以结合UTL_FILE其他子函数一起使用，具体用法说明见    [https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/UTL_FILE.html#GUID-EBC42A36-EB72-4AA1-B75F-8CF4BC6E29B4](https://docs.oracle.com/en/database/oracle/oracle-database/23/arpls/UTL_FILE.html#GUID-EBC42A36-EB72-4AA1-B75F-8CF4BC6E29B4)  

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

本次需求支持单机和集群环境。

# 3.  详细测试设计

## 3.1测试设计方法

本次测试设计主要采用等价类、边界值和场景分析法。

## 3.2.详细测试设计

1）  使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

等价类划分：

|输入条件|有效等价类|无效等价类|
|---|---|---|
|utl_file.fgetpos(file)|1、file类型为utl_file.file_type,2、状态是open,3、打开模式：可以是r、w、a中的任意一种,4、文件存在,5、参数个数为1|1、file为非utl_file.file_type类型，如integer类型,2、状态为closed,3、打开模式为二进制(ab、rb、wb),4、file已定义但未打开,5、参数为空、空串''、NULL等无效值,6、参数个数大于1|


使用场景：

|一级分类|二级分类|使用场景|备注|
|---|---|---|---|
|  
,  
,  
,  
,  
,返回值校验    
    
,  
|  
,  
,  
,  
,  
,文件读操作|  
,  
,utl_file.get_line(fhandle,buffer,len)+fgetpos|1、指定参数len：,1)若  len值>第一行字节数+1，FGETPOS返回值为第一行数据字节数+1,2)若  len值<=第一行数据字节数+1，FGETPOS返回值为len值,2、不指定参数len：FGETPOS返回值为第一行数据字节数+1|
|||utl_file.fseek(  fhandle,absolute_offset,relative_offset  )|FGETPOS返回值为absolute_offset值|
|||utl_file.fseek+utl_file.get_line组合使用|1、若  len值+absolute_offset > 第一行字节数+1，则FGETPOS返回值为第一行字节数+1,2、若  len值+absolute_offset <= 第一行字节数+1，则FGETPOS返回值为len + absolute_offset|
|||fopen+fremove+fgetpos|执行FREMOVE后，再执行FGETPOS可以正常获取到偏移量|
|||fopen+frename+fgetpos|执行FRENAME后，再执行FGETPOS可以正常获取到偏移量|
|||文件打开后不做任何操作时，默认返回值为0||
||文件写操作|使用PUT_LINE正常写文件时，FGETPOS始终返回值为0||
||边界值|目前最大偏移量应小于2*1024*1024*1024，目前和oracle保持一致，最大偏移量为2147471580，超过则会截断为-2147465715||
|  
,  
,  
,  
,  
,文件句柄相关||1、赋予正确的文件句柄id、datatype、byte_mode,2、只赋予正确的文件句柄id,3、赋予错误的文件句柄id,4、赋予正确的文件句柄id，同时赋予错误的datatype,5、赋予正确的文件句柄id，同时赋予datatype为null,6、赋予正确的文件句柄id，同时赋予byte_mode为false,7、赋予正确的文件句柄id，同时赋予byte_mode为null,8、赋予正确的文件句柄id和datatype，当赋予byte_mode为true(二进制模式)时,9、赋予正确的文件句柄id和datatype，当赋予byte_mode为非boolean值如字符串时,10、赋予文件句柄id为已存在的句柄id,11、赋予正确的文件句柄id，同时赋予create_num为null值||
|  
,异常测试|执行时报错|异常句柄捕获：,1、  INVALID_FILEHANDLE：如file定义但未打开初始化、打开后关闭文件、参数值为NULL,2、INVALID_MODE：当文件以ab、wb、rb二进制模式打开时||
||编译时报错|参数异常：  空串''、'NULL'、缺少参数、类型为非utl_file.file_type、多个参数值||
|  
,  
,并发场景||1、  多个session同时打开和读文件，获取偏移量,2、  多个session同时打开和写文件，获取偏移量,3、  多个session同时打开和读、写文件，获取偏移量,4、  多个session同时打开、移动文件指针，获取偏移量,5、  多个session同时打开、删除、创建文件时，获取偏移量,6、  多个session同时打开、重命名文件，获取偏移量||


集群场景：

|分类|场景|
|---|---|
|实例间串行操作|实例1和实例2执行FGETPOS是隔离互不影响，同单机场景|
|  
,  
,多实例并发|1、  实例1和实例2并发执行FOPEN+FGETPOS+FCLOSE,2、  实例1和实例2并发执行FOPEN+GET_LINE+FGETPOS+FCLOSE,3、  实例1和实例2并发执行FOPEN+PUT_LINE+FGETPOS+FCLOSE,4、  实例1和实例2执行FOPEN+PUT_LINE+FFLUSH+GET_LINE+FGETPOS+FCLOSE,5、  实例1和实例2同时执行FOPEN+FREMOVE+FGETPOS+FCLOSE,6、  实例1和实例2同时执行FOPEN+FRENAME+FGETPOS+FCLOSE|


xmind版测试设计见：

2）  梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


# 4.测试用例

细化后的文件用例见：

# 5.测试框架设计

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 6.测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[UTL_FILE.FGETPOS测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTM4OTcwYzJhZjRmNTIwNTg1IiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2I3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTU3LCJleHAiOjE3ODIzODE5NTd9.R7WNYpt7fpSb9xgjzUrKSWEwxAZRAu0_MYCMPtOMyGA)

 (application/x-xmind)    


[UTL_FILE.FGETPOS函数测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTM4OTcwYzJhZjRmNTIwNTg2IiwicmVmX2lkIjoiNjczOTZiOTM3MjgyMDZlZmI5MmYwN2I3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTU3LCJleHAiOjE3ODIzODE5NTd9.WxzHEBl5B50V5xpj_gPLXtydvVrIC7rk79d6SoMP9NU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,windows的换行和linux统计pos有差异。当前版本暂时不出windows商用，先不测试。后续如果有win相关测试场景 补充测试,Posted by zhangxin at 十一月 01, 2023 09:26|
|---|
