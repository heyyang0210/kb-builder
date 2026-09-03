Created by 王莹, last modified on 一月 22, 2024

# 1. 概述

sr：    [YDBRD-24354](https://jira.yasdb.com/browse/YDBRD-24354?src=confmacro)    -  to_char/to_date支持iw、iyyy\iyy\iy\i、rrrr、sssss格式符  完成

*本需求是23.2版本 to_char/to_date 的新增格式符测试，其中新增格式符为：*

*to_char(expr,fmt)，fmt新增*  *iw、iyyy\iyy\iy\i、rrrr、sssss格式符*

*to_date(expr,fmt)，fmt新增*  *rrrr、sssss格式符，拦截iyyy\iyy\iy\i、iw格式符*

  


# 2. 需求分析

开发设计：    [to_char/to_date支持iw、iyyy\iyy\iy\i、rrrr、sssss格式符 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141564817)  

## 2.1 功能点分析

to_char函数

- 入参为时间类型：       `DATE`    ,       `TIMESTAMP`    ,     TIME  ，    `TIMESTAMP WITH TIME ZONE`    /    `TIMESTAMP WITH LOCAL TIME ZONE(yashan不支持)`    ,       `INTERVAL DAY TO SECOND`    , 或       `INTERVAL YEAR TO MONTH`  


|fmt|含义|范围|例子|备注|
|---|---|---|---|---|
|iw|在ISO格式下，返回日期参数在一年中的周数（1~53）|[1，53]|select to_char(date '2022-12-12','iw') from dual;,TO    
  --    
  50|  
|
|iyyy|  
  在ISO格式下，返回日期参数对应  **ISO年份**|[0001,9999]|select to_char(date '2022-12-12','iyyy') from dual;,TO_C    
  ----    
  2022,  
,select to_char(date '2022-12-12','iyy') from dual;,TO_C    
  ----    
  022,  
|ISO格式：新年的第一个天以当天星期几为准，到周日为一周，每周都一定为7天； 当去年最后一周不足7天，则用今年第一周补或者延续到今年第一周|
|iyy|ISO年的最后三位数字|[000,999]|||
|iy|ISO年的最后两位数字|[00,99]|||
|i|ISO年的最后一位数字|[0,9]|||
|rrrr,  
|返回日期参数的年份|[0001,9999]|select to_char(date '2022-12-12','rrrr') from dual;,TO_C    
  ----    
  2022,select to_char(date '2022-12-12','rrrr-mm-dd') from dual;,  
|接受4位或2位输入。如果是2位数，则提供与RR相同的返回值|
|sssss,  
|返回一天经历的总秒数|[00000,86399]|SELECT to_char( TO_TIMESTAMP( '2020-01-01,1','YYYY-MM-DD,DDD' ), 'sssss') res FROM DUAL;,RES    
  -----    
  00000,  
,SELECT to_char( TO_TIMESTAMP( '2020-01-01,11:43:21.7776','YYYY-MM-DD,hh24.mi.ss.ff' ), 'sssss') res FROM DUAL;,RES    
  -----    
  42201|  
,  
|


除此以外支持的fmt：YYYY/YYY/YY/Y、  MM/MONTH/MON 、DD、DDD、  W/DAY/D、HH24/HH12/HH、MI、SS、FF1-9、AM/A.M.、FM/F.M.

文档上待补充：CC/SCC，DY，Q，SYYYY

~~拦截的fmt：AD/A.D.、 BC/B.C.、  DL、DS、E/EE、FX、J、RM、TS、TZD/TZH/TZM/TZR、X、YEAR/SYEAR~~

- 第一入参为数值型：报错


支持的fmt：， . $ 0 9  D S   ~~G EEEE B C  L MI PR RN/rn S TM U V X~~

拦截的fmt：时间型fmt，尤其注意新加的几个fmt

- 第一入参为其他：带格式符报错


  


to_date函数

支持  *rrrr、sssss，拦截iyyy\iyy\iy\i、iw格式符*

*sssss，rrrr：to_date入参格式会校验，不符合的会报错，比如*

![](https://pingcode.yasdb.com/atlas/files/public/67396b838970c2af4f520514/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTUyMzksImV4cCI6MTc4MjMwNjAzOX0.7sIJ7qHQJaBFn-zcXam3tg3lTDJKdsXJNjNj8Qmwuas)

![](https://pingcode.yasdb.com/atlas/files/public/67396b83a1ad9a3311dc838b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUlBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTUyMzksImV4cCI6MTc4MjMwNjAzOX0.7sIJ7qHQJaBFn-zcXam3tg3lTDJKdsXJNjNj8Qmwuas)

## 2.2 应用场景

- *函数转换场景*
- *与其他函数嵌套的场景*


## 2.3 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

边界值法：sssss结果的边界

组合法：多种连接符组合

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*


|测试点|有效类|无效类|
|---|---|---|
|to_char 第一个入参为时间型|-   `TIME,DATE`    ,       `TIMESTAMP`    ,       `INTERVAL DAY TO SECOND`    , 或       `INTERVAL YEAR TO MONTH`  
|-      `TIMESTAMP WITH TIME ZONE`    ,       `TIMESTAMP WITH LOCAL TIME ZONE`  
|
|  
|列|字面量|
|  
|内置函数（cast，to_date,to_timestamp,to_ds,to_ym,日期类函数,,NUMTODSINTERVAL,  NUMTOYMINTERVAL,）|  
|
|  
|udf|udt|
|  
|运算（结果跨天，跨月，跨年，跨时等）|  
|
|to_char 第一个入参为数值型|  
|fmt为新增的格式符|
|to_char 第一个入参为字符型，布尔型，大对象型，xml，伪劣，raw|  
|fmt为新增的格式符|
|第一个入参为 空|null，''|’     ‘|
|第一个入参为特殊日期|闰年，1-1，12-31覆盖不同星期数（周一，周二等）|不存在的日期|
|第一个入参绑定参数|  
|  
|
|第二个入参|字面量，列，内置函数，拼接符|udf|
|  
|数据类型：字符型（定长/变长）|大对象型|
|  
|  
|  
|
|第二个入参单个格式符|*iw、iyyy\iyy\iy\i、rrrr、sssss*|格式符中带空格，或其他连接符|
|  
|格式符前后有空格，或其他连接符|  
|
|  
|*格式符的边界值*|  
|
|  
|格式符大小写|  
|
|  
|格式符与expr长度（不）一致|  
|
|组合|新增格式符组合（不同位置）|  
|
|  
|与未拦截格式符组合|新增与拦截格式符组合|
|  
|与所有连接符组合|  
|
|第二个入参为绑定参数|字面量|  
|
|  
|字符型，大对象型|  
|
|  
    
||  
|
|||  
|
|to_date第一个入参|符合fmt的字符型，字面量，内置函数，拼接符|数值型、布尔型、大对象、  ~~xml~~  、伪劣、  ~~raw~~|
|  
|时间型，xml/raw/clob  （不拦截）|  
|
|  
|空值：null,  ''|'    '|
|第一个入参为特殊日期|闰年，闰月|不存在的日期|
|第二个入参|  
|  
|
|第二个入参单个格式符|*rrrr、sssss*|*拦截iyyy\iyy\iy\i、iw格式符*|
|组合多个格式符|新增格式符组合（不同位置）|  
|
|  
|与未拦截格式符组合|与（新增）拦截格式符组合|
|  
|与所有连接符组合|  
|
|第二个入参为绑定参数|字面量，字符型，大对象型|  
|
|修改机器时时间|  
|  
|
|其他带fmt的函数拦截新增的这几个格式符|round,   trunc(待确定)  ,   date  , date_format,   ~~to_number,~~  to_timestamp|  
|


  


  


1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|系统级DFX分类|是否涉及|
|---|---|
|CT|Y|
|KT|  
|
|长稳|Y|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


用例路径：  standalone/expect/functi  ‎on6/to_char_to_date_fmt/

[YDBRD-24354冒烟用例_文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiODNhMWFkOWEzMzExZGM4Mzg2IiwicmVmX2lkIjoiNjczOTZiODI1OTNmOTljOWZmMjM2MzgwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MjM5LCJleHAiOjE3ODIzODE2Mzl9.XZvuUpPY_83jpi9BByTTTfhX_kS4GjxkEDyTnVMF-sU)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：2.3  *人/周*

计划测试完成时间：

## Attachments:

[YDBRD-24354冒烟用例_文本用例.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiODNhMWFkOWEzMzExZGM4Mzg2IiwicmVmX2lkIjoiNjczOTZiODI1OTNmOTljOWZmMjM2MzgwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MjM5LCJleHAiOjE3ODIzODE2Mzl9.XZvuUpPY_83jpi9BByTTTfhX_kS4GjxkEDyTnVMF-sU)

 (application/vnd.ms-excel)    


## Comments:

|  [](null)  ,  [TO_CHAR (datetime) (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_CHAR-datetime.html#GUID-0C3EEFD1-AE3D-452D-BF23-2FC95664E78F)  ,  [Format Models (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Format-Models.html#GUID-24E16D8D-25E4-4BD3-A38D-CE1399F2897C)  ,Posted by wangying at 一月 02, 2024 17:28|
|---|
|  [](null)  ,1. RR和RRRR和Y/YY/YYY/YYYY均为不同的格式符，相同的格式符不能同时出现，不同的格式符可同时出现（与oracle一致）；
1. RR和RRRR和Y/YY/YYY/YYYY同时出现时，年份最终取值为最后一个（与oracle一致）；
1. RR和RRRR和Y/YY/YYY/YYYY同时出现时，每个格式符按自己的规则进行校验，与出现前后顺序无关（与oracle不一致，支持范围比oracle更大，上面报错能正常执行）
1. RR/RRRR规则：可支持1-4位数字：    
  数字长度为1时，补充当前世纪；    
  数字长度为2时：    
      数字小于50时：    
          如果当前时间在前半世纪，则输出当前世纪+输入的数字（select to_date('19', 'rrrr') from dual; 返回2019年）；    
          如果当前时间在后半世纪，则输出下个世纪+输入的数字（select to_date('19', 'rrrr') from dual; 如果当前为2060年返回2119年）；    
      数字大于等于50时：    
          如果当前时间在前半世纪，则输出上个世纪+输入的数字（select to_date('69', 'rrrr') from dual; 返回1969年）；    
          如果当前时间在后半世纪，则输出当前世纪+输入的数字（select to_date('69', 'rrrr') from dual; 如果当前为2060年返回2069年）；    
  数字长度为3、4时，正常输出年份，无需补充；
,Posted by wangying at 一月 11, 2024 11:45|
|  [](null)  ,1.y/yyy长度需要一致,2.yy 长度可为2或4,3.yyyy 长度均可：1/2/3/4,Posted by wangying at 一月 11, 2024 11:46|
