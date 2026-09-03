Created by 周彬鑫, last modified on 四月 15, 2024

# 1. 概述

IR:    [YDBRD-29770](https://jira.yasdb.com/browse/YDBRD-29770?src=confmacro)    -  to_char的date_format支持[yyyy-mm-dd]格式  设计中

to_char的date_format支持[yyyy-mm-dd]格式

需求场景：    
    
  select to_char(sysdate, '[yyyy/mm/dd]') from dual;    
  select to_char(sysdate, '[yyyy-mm-dd]') from dual;    
    
  需求描述：    
  to_char的date_format支持[yyyy-mm-dd]格式

# 2. 需求分析

## 2.1 功能点分析

- 支持date_format带[]
- 范围：单机行存


## 2.2 应用场景

- select to_char(sysdate, '[yyyy/mm/dd]') from dual;    
  select to_char(sysdate, '[yyyy-mm-dd]') from dual;
- select to_char(sysdate, '[yyyymmdd]') from dual;    



## 2.3 规格约束

- 支持date_format带[]


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
    1. *format格式符*
    1. 函数嵌套
    1. 结合date_format
    1. **参数,format参数含[]**
    1. **对其他转换函数是否有影响 to_date/to_timestamp/to_number**
    1. **修改date_format**
    1. **结合DQL/DDL/DML**
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|测试点|等价类|备注|
|---|---|---|
|format中[]|带[]|  
|
|  
|括号为乱序[][][]]]]]][[[[[|  
|
|  
|中文【】|  
|
|format带[]结合其他格式符（覆盖全部日期类型格式符）|-    
  /    
  ,    
  .    
  ;    
  :,\,_    
  "text"|YASDB不支持`|
|  
|AD,A.D.|YASDB不支持|
|  
|AM,A.M.|  
|
|  
|BC,B.C.|YASDB不支持|
|  
|CC,SCC|  
|
|  
|D|  
|
|  
|DAY|  
|
|  
|DD|  
|
|  
|DDD|  
|
|  
|DL|YASDB不支持|
|  
|DS|YASDB不支持|
|  
|DY|  
|
|  
|E|YASDB不支持|
|  
|EE|YASDB不支持|
|  
|FF[1..9]|  
|
|  
|FM|行存不支持|
|  
|FX|YASDB不支持|
|  
|HH,HH12|  
|
|  
|HH24|  
|
|  
|IW|  
|
|  
|IYYY|  
|
|  
|IYY,IY,I|  
|
|  
|J|  
|
|  
|MI|  
|
|  
|MM|  
|
|  
|MON|  
|
|  
|MONTH|  
|
|  
|PM,P.M.|  
|
|  
|Q|  
|
|  
|RM|YASDB不支持|
|  
|RR|  
|
|  
|RRRR|  
|
|  
|SS|  
|
|  
|SSSSS|  
|
|  
|TS|YASDB不支持|
|  
|TZD|YASDB不支持|
|  
|TZH|YASDB不支持|
|  
|TZM|YASDB不支持|
|  
|TZR|YASDB不支持|
|  
|WW|  
|
|  
|W|  
|
|  
|X|YASDB不支持|
|  
|Y,YYY|YASDB不支持|
|  
|YEAR,SYEAR|YASDB不支持|
|  
|YYYY,SYYYY|  
|
|  
|YYY,YY,Y|  
|
|format包含其他特殊符号|~!@#$%^&*_+=-\/,.;'||YASDB不支持|
|format最长长度？| select to_char(date'2002-12-01','[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[') from dual;|oracle 长度限制71|
|to_char 数值型+[]|select to_char(111,'[999]') from dual;|oracle报错|
|函数嵌套|数学函数|  
|
|  
|字符函数|  
|
|  
|转换函数|  
|
|  
|其他函数|  
|
|  
|自嵌套|  
|


|测试点|等价类|备注|
|---|---|---|
|第一个入参为时间类型|TIME/DATE/TIMESTAMP/YMINTERVAL/DSINTERVAL|  
|
|第一个入参覆盖所有数据类型|smallint/tinyint/int/bigint/float/double/number/char/varchar/nchar/nvar char/bool/nclob/blob/clob/json/xmltype|  
|
|第一个入参为null/''|null/''|  
|
|第一个入参为字面量|date /timestamp|  
|
|第一个入参为特殊日期|闰年，闰月，不存在的日期|  
|
|入参为绑定参数|plsql|  
|
|  
|jdbc|  
|


|测试点|等价类|备注|
|---|---|---|
|其他转换函数的影响|to_date格式符覆盖[]|  
|
|  
|to_timestamp 格式符覆盖[]|  
|
|  
|to_number格式符覆盖[]|不支持报错|


|测试点|等价类|备注|
|---|---|---|
|date_format包含[],alter session set date_format = 'yyyy[mmdd]'|修改了dateformat后执行函数to_char、to_date、to_timestamp函数包含[]|  
|
|  
|字符串转日期类型场景：,insert into values(date);,cast函数 cast(as date),字符串在filter中与日期类型进行比较|  
|
|alter session set date_format='yyyy[mmdd]]]]]]';|insert into values(date); 插入的字符串的]个数只能小于等于date_format的]个数，个数更多会报错，个数少了select时会补全|  
  SQL> insert into t411 values('2022[0101]]');,1 row created.,SQL> select * from t411;,D1    
  ---------------    
  2022[0101]]]]]]|
|  
|insert into values(date); 插入时用其他间隔符（如：_-,.\/ ）代替[] ，插入成功并自动补为[]|SQL> insert into t411 values('2022 0101]]');,1 row created.,SQL> select * from t411;,D1    
  ---------------    
  2022[0101]]]]]]|
|  
|to_char、to_date、to_timestamp、cast函数使用|  
|
|alter session set DATE_FORMAT = 'DD-MON-RR';|to_char 格式符带[] 基本场景|  
|
|多次alter DATE_FORMAT |反复修改，包含[]与不包含[]的date_format，最后查看是否生效|  
|
|ALTER SYSTEM修改DATE_FORMAT，spfile重启生效|重启后，表现是否正常(to_char、to_date、to_timestamp、cast函数使用|  
|


|测试点|等价类|备注|
|---|---|---|
|DML|insert：函数作为value值进行insert操作|  
|
|  
|delete：函数作为where条件|  
|
|  
|update：函数作为set值，where条件|  
|
|DDL|create：create table/view as |  
|
|DQL|操作符：in/not in、exists/not exists 、between and、like/not like、limit等|  
|
|  
|布尔表达式：== 、 != 、 >= 、 > 、 < 和 <=|  
|
|  
|DQL算子：distinct、case when、group by 、group by...having、join on、connect...by、集合操作、order by|  
|
|  
|子查询|  
|
|  
|CTE|  
|


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|  
|
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


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机 行存|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：



## Comments:

|  [](null)  ,会议名称：to_char的date_format支持[]测试设计评审,评审,评审时间：2024/04/15 17:30-18:00,参与人：胡晓畔、徐伟、刘晓旋、严丽英、周彬鑫,1.补充多次  alter DATE_FORMAT ，包含[]与不包含[]场景，最后查看是否生效,2.  ALTER SYSTEM修改DATE_FORMAT，spfile重启生效，是否正常,3.format 包含中文【】,评审结论：通过,Posted by zhoubinxin at 四月 15, 2024 17:51|
|---|
