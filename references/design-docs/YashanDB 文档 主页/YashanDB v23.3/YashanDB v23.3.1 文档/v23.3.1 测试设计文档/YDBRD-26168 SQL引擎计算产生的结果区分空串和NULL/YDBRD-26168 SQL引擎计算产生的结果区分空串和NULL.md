Created by 李凯峰, last modified on 七月 24, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/6618e61afd997db58ad828ca](https://pingcode.yasdb.com/pjm/items/6618e61afd997db58ad828ca)    ?    
  #YDBRD-26168 SQL引擎计算产生的结果区分空串和NULL

*开发设计文档：*    [特性设计-YDBRD-26168：SQL引擎计算产生的结果区分空串和NULL - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159426961)  

*调研文档：*    [特性调研-YDBRD-26168：SQL引擎计算产生的结果区分空串和NULL - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153026401)  

# 2. 需求分析

## 2.1 功能点分析

- 当该参数设置为False时，SQL层计算产生的中间结果（内置函数、类型转换等）需要区分NULL和空串。


## 2.2 应用场景

- 作为数据插入的场景
- 四则运算的场景
- 运算符的场景
- null、空串可以出现的位置的语法场景、非法场景
- null、空串作为函数入参
- 类型转换


## 2.3 规格约束

- EMPTY_STRING_AS_NULL=true时对齐oracle，null=空串
- EMPTY_STRING_AS_NULL=false时对齐mysql，空串是字符串，不等于NULL
- 作为函数入参不对齐mysql
- mysql中空串返回值为0，四则运算等场景作为0来运算，我们保持差异


# 3. 详细测试设计

## 3.1 测试设计方法

1.场景法

2.边界值

3.等价类

4.错误推测法

## 3.2 详细测试设计

[引擎中生成空串.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTE4OTcwYzJhZjRmNTIxODRiIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.TZhCk_llqHULA5hP3KhzqVhHP_vo8dA7H92nr2vluDE)

1.数据类型、表类型覆盖

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|存储类型|HEAP|  
|  
|
|数据类型|覆盖已支持的类型|  
|  
|
|表类型|分区表、非分区表|  
|交付范围是单机，是否支持分布式集群？不支持|
|部署模式|单机|  
|交付范围是单机，是否支持分布式集群？不支持|


2.字符型函数，非用户输入的空串，sql引擎生成的空串，返回值预期是空串，非NULL

|字符函数|有效等价类|无效等价类|备注|
|---|---|---|---|
|ASCII |入参空串，返回NULL，需要对齐|  
|  
|
|BIT_LENGTH |入参空串，返回空串，与ASCII相反|  
|  
|
|FIND_IN_SET |入参空串结果与mysql不一致，是否在这个需求下对齐|  
|  
|
|left |select length(left('aaa',0)) from dual;|  
|  
|
|lpad|select length(lpad('aaa','0','aaa')) from dual; 返回NULL，需要对齐|  
|  
|
|rpad|select length(rpad('aaa','0','aaa')) from dual;返回NULL，需要对齐|  
|  
|
|LTRIM|SELECT length(LTRIM('3333','33')) res FROM DUAL;|  
|  
|
|REGEXP_REPLACE|SELECT length(REGEXP_SUBSTR('1234567890', '')) "REGEXP_SUBSTR" FROM DUAL;   返回null，需要对齐|  
|  
|
|REPLACE|SELECT REPLACE('shenzhen', 'shenzhen', '') REPLACE FROM DUAL;|  
|  
|
|right|SELECT length(RIGHT('yunshenbuzhiguichu',0)) res FROM DUAL;|  
|  
|
|rpad|select length(rpad('yunshen',0,'buzhi')) from dual; 返回null，需要对齐|  
|  
|
|RTRIM|select length(rtrim('333','333')) from dual; |  
|  
|
|SPLIT|select length(SPLIT('a,,a',',',2)) from dual;返回null，需要对齐|  
|  
|
|substr|select length(SUBSTR('yunshen',0,0)) from dual;|  
|  
|
|substrb|select length(SUBSTRB('yunshen',0,0)) from dual;返回null，需要对齐|  
|  
|
|SUBSTRING|select length(SUBSTRING('yunshen',0,0)) from dual;返回null，需要对齐|  
|  
|
|SUBSTRING_INDEX|SELECT length(SUBSTRING_INDEX(',192.168.0.1','', 1)) from dual;|  
|  
|
|TRANSLATE|select length(TRANSLATE('ch','ch','')) from dual;返回null，需要对齐|  
|  
|
|TRIM|SELECT TRIM(' ') t_default from dual;|  
|  
|
|UNISTR|SELECT length(UNISTR('')) FROM DUAL; 返回null，需要对齐|  
|  
|
|upper|SELECT length(UPPER('')) res FROM DUAL;返回null，需要对齐|  
|  
|


*3.转换函数，非用户输入的空串，sql引擎生成的空串，返回值预期是空串，非NULL*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|bin|SELECT length(BIN('')) res FROM DUAL;返回null，需要对齐|  
|  
|
|cast|如：  cast('' as char(1)) ，覆盖全数据类型|  
|  
|
|to_date|select to_date('2022-10-10','') from dual;返回null，需要对齐|  
|  
|
|to_char|select length(to_char('2022-10-10','')) from dual;返回null，需要对齐|  
|  
|
|empty_clob()|  
|  
|  
|
|empty_blob()|  
|  
|  
|


*4.yasldr/load data*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|csv中的数据入参|''|  
|  
|
|  
|null|  
|  
|
|  
|,,|  
|  
|
|  
|' '|  
|  
|
|  
|考虑所有的数据类型导入以上场景数据,创建一个char(0)的列，导入空串|  
|  
|


*5.*  *exp/imp*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|表中的数据入参|''|  
|  
|
|  
|null|  
|  
|
|  
|,,|  
|  
|
|  
|' '|  
|  
|
|  
|考虑所有的数据类型导入以上场景数据,创建一个char(0)的列，导入空串|  
|  
|


*6.驱动入参为空串*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|jdbc|select ? ,length(?),? is null from dual;    
  ?分别传入"","''","null",null,"' '",不用绑定参数测试以上场景|  
|  
|
|python|select ? ,length(?),? is null from dual;    
  ?分别传入"","''","null",null,"' '",不用绑定参数测试以上场景|  
|  
|
|C驱动|select ? ,length(?),? is null from dual;    
  ?分别传入"","''","null",null,"' '",不用绑定参数测试以上场景|  
|  
|


*7.其他ddl、dml、dql复用YDBRD-26167的用例*

|测试点|有效等价类|无效等价类|备注|
|---|---|---|---|
|表达式|表达式中使用函数的返回值和其他的返回空串的函数|||  
|  
|
|  
|函数嵌套的场景返回空串|  
|  
|
|create table中使用default ''|  
|  
|  
|


*8.yasldr新增参数empty_string_as_null、exp --csv新增参数empty-string-as-null*

|测试点（客户端参数）|有效等价类|无效等价类|备注|
|---|---|---|---|
|*empty_string_as_null入参*,*empty-string-as-null*|入参为空,null,"",'',0,中文|  
|  
|
|*empty_string_as_null=false*,*empty-string-as-null*|服务端是true,服务端是false|  
|  
|
|*empty_string_as_null=true*,*empty-string-as-null*|服务端是true,服务端是false|  
|  
|
|*empty_string_as_null=true*  默认场景是true,*empty-string-as-null*|服务端是true,服务端是false|  
|  
|
|*yasldr新增参数empty_string_as_null=true、false、exp --csv新增参数empty-string-as-null=true、false，服务端empty_string_as_null=true、false情况组合测试*|1. yasldr.empty_string_as_null=true, --csv.empty-string-as-null=true, 服务端empty_string_as_null=true
1. yasldr.empty_string_as_null=true, --csv.empty-string-as-null=true, 服务端empty_string_as_null=false
1. yasldr.empty_string_as_null=true, --csv.empty-string-as-null=false, 服务端empty_string_as_null=true
1. yasldr.empty_string_as_null=true, --csv.empty-string-as-null=false, 服务端empty_string_as_null=false
1. yasldr.empty_string_as_null=false, --csv.empty-string-as-null=true, 服务端empty_string_as_null=true
1. yasldr.empty_string_as_null=false, --csv.empty-string-as-null=true, 服务端empty_string_as_null=false
1. yasldr.empty_string_as_null=false, --csv.empty-string-as-null=false, 服务端empty_string_as_null=true
1. yasldr.empty_string_as_null=false, --csv.empty-string-as-null=false, 服务端empty_string_as_null=false
|  
|  
|


*2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


  


# 4. 测试用例

# 5. 测试框架设计

yasft框架

# 6. 测试环境说明

  


# 7. 工作量评估

工作量：

计划测试完成时间：2024.7.24

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTE4OTcwYzJhZjRmNTIxODRjIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.R85ufH_7QCIuUi1lWjo2pSZRuW0arCdOXYnEqqfP2S0)

## Attachments:

[YDBRD-26167 新增参数对齐mysql空串与null规格.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTFhMWFkOWEzMzExZGM5NmJlIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.iwAn02d75DJmHDsLg2es2VYGrFNIVVHNjcsfbblw2ww)

 (application/x-xmind)    


[dblink支持远端sequence.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTJhMWFkOWEzMzExZGM5NmJmIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.ocUUL3Sb6b2SZ2WFxhdCwYy5W974L2Qh80-QY6DwPyI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[dblink支持sequence.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTJhMWFkOWEzMzExZGM5NmMwIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.VTwqZRO_riRaA7DHIWNKUV2lHuy4wpqVzFSjKtDPZuI)

 (application/x-xmind)    


[dblink支持seq.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTJhMWFkOWEzMzExZGM5NmMxIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.MFxh6BXibxF-izYZWnm8NkAYhY27TypOICqxkSDdWV0)

 (application/x-xmind)    


[支持as别名为空.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTJhMWFkOWEzMzExZGM5NmMyIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.L-RV4jPChqTS2yOOXCrjtxwejQWBrkruryBc2tUAjTM)

 (application/x-xmind)    


[崖山支持8K的错误码信息长度返回.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTI4OTcwYzJhZjRmNTIxODRkIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.0iOvnVmvRwpzkZDpo69YDG4vkOi5T-by6KEwIuXaAdo)

 (application/x-xmind)    


[崖山支持设置错误码长度.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTI4OTcwYzJhZjRmNTIxODRlIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.Rh5omI-gPz9F3g_NZrVyPXkAZxi1CUsSGKRM0xYY2PI)

 (application/x-xmind)    


[动态加载openssl， 安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTI4OTcwYzJhZjRmNTIxODRmIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.ajANkW5-K1eWD-pDITTLfBDD4PKjfvU72zt53A-8WRA)

 (application/x-xmind)    


[动态加载openssl，安装包不自带.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTI4OTcwYzJhZjRmNTIxODUwIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.e5ieGrAgRDiaCxpLNfcMnrSPuRgf-mLLh3kDIzd39eU)

 (application/x-xmind)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTE4OTcwYzJhZjRmNTIxODRjIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.R85ufH_7QCIuUi1lWjo2pSZRuW0arCdOXYnEqqfP2S0)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTJhMWFkOWEzMzExZGM5NmMzIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.apWfQKO62mvNPOeA4d79hHx1eQaavYDDv2rgU9VvKrw)

 (application/msword)    


[引擎中生成空串.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTE4OTcwYzJhZjRmNTIxODRiIiwicmVmX2lkIjoiNjczOTZlNTE1OTNmOTljOWZmMjM4M2E0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMjczLCJleHAiOjE3ODI0NTc2NzN9.TZhCk_llqHULA5hP3KhzqVhHP_vo8dA7H92nr2vluDE)

 (application/x-xmind)    
