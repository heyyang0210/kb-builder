Created by 党文琪, last modified on 十一月 05, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/670c82d2e489dd0868f6c366](https://pingcode.yasdb.com/pjm/items/670c82d2e489dd0868f6c366)    ?    
  #YDBRD-34021 【mysql兼容】支持FROM_BASE64字符串函数

测试调研文档：

  [YDBRD-34021【mysql兼容】支持FROM_BASE64字符串函数 需求调研 - 党文琪 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=177838195)  

交付范围:

单机

# 2. 需求分析

## 2.1 功能点分析

FROM_BASE64() 函数可以解码 TO_BASE64() 函数  将给定参数所表示的字符串使用BASE64进行编码  的结果，函数入参只有加密过的字符串，函数返回值与对应的TO_BASE64() 函数入参一致

FROM_BASE64() 函数只能在开启mysql兼容的条件下使用，TO_BASE64()函数却无此限制，无论是否开启兼容，加密解密的字符串要能够对应

关注下规格上于mysql有差异的场景如何处理，不同类型的字符串做入参，及函数的使用场景，TO_BASE64()差异也需要关注对齐

## 2.2 应用场景

主要应用于mysql兼容场景

## 2.3 规格约束

# 3. 详细测试设计

## 3.1 测试设计方法

从函数语法和功能出发，覆盖语法检查，结合等价类，边界值，场景法等，输出测试点

## 3.2 详细测试设计

|  
|类别|测试点|  
|预期|
|---|---|---|---|---|
|1|语法测试|无入参|  
|报错|
|2|  
|一个字符串入参，但非  TO_BASE64()转换过的字符串|  
|乱码,确认下返回的是null还是乱码|
|3|  
|一个字符串入参，但  TO_BASE64()转换过的字符串|  
|与  TO_BASE64()入参一致|
|4|  
|多个入参|  
|报错|
|5|  
|非mysql兼容模式下使用|  
|报错|
|6|  
|拼写错误|  
|报错|
|7|入参测试|入参无引号|  
|报错|
|8|  
|入参为空或null|  
|返回null|
|9|  
|入参超过32000字节|  
||
|10|  
|四则运算表达式做入参|  
|  
|
|15|  
|表列做入参，覆盖列表|  
|  
|
|16|  
|子查询结果做入参|  
|  
|
|17|  
|内置函数返回值做入参|to_base64|  
|
|18|  
|  
|其他函数|  
|
|||根据编码规则构造|'+'，'/'||
||||字符数不是4的倍数|预计返回null|
||||超过76个字符边界值，|tobase预计此处与mysql有差异|
||||包含换行符、回车符、制表符和空格。||
||多层嵌套|与tobase嵌套128层|||
||返回值类型验证|未超过512，返回varchar|||
|||超过xxx，返回lob|||
|19|入参类型遍历,(注意交叉覆盖下参数传入的方式）|数值型,TINYINT,SMALLINT,INT,BIGINT,FLOAT,DOUBLE,NUMBER|  
|  
|
|20|  
|字符型,CHAR,VARCHAR,NCHAR,NVARCHAR|  
关注下变长类型的边界，结合规格补充测试细节，长字符短字符都需要覆盖|  
|
|21|  
|布尔型,BOOLEAN|  
|  
|
|22|  
|日期时间型,DATE,TIME,TIMESTAMP,INTERVAL YEAR TO MONTH,INTERVAL DAY TO SECOND|  
|  
|
|23|  
|大对象型,BLOB,CLOB,NCLOB|  
|  
|
|24|  
|raw|  
|  
|
|25|  
|json|  
|  
|
|26|  
|xmltype|  
|  
|
|27|  
|ROWID UROWID|  
|  
|
|28|  
||  
|  
|
|29|  
||  
|  
|
|30|  
||  
|  
|
|42|功能测试  
|DML语句中使用|insert时的表列值|  
|
|43|  
|  
|update时set值|  
|
|44|  
|  
|delete时filter值|  
|
|45|  
|  
|merge into|  
|
|46|  
|ddl|create：create table/view/materialized view as ，列默认值  
|  
|
||||alter：列默认值||
|47|  
|DQL|操作符：in/not in、exists/not exists 、between and、like/not like、limit等|  
|
|48|  
||布尔表达式：== 、 != 、 >= 、 > 、 < 和 <=  
|  
|
|49|  
||DQL算子：distinct、case when、group by 、group by...having、join on、connect...by、集合操作、order by  
|  
部分看护，简单覆盖|
|50|  
||子查询  
|  
|
|51|  
||  
CTE|  
|
|52|视图|select * from V$FUNCTION;不可见,select * from V$MYSQL_FUNCTION; 可见|  
|  
|
||字符集|修改字符集，函数结果无异常,（yashan修改字符集按照普通模式下方式即可0|||


并发用例设计：

1. 创建依赖表
1. 并发调用函数，将依赖表中的数据更新为from_base64加密后的值
1. 并发调用函数，将数据更新为to_base64解密后的值
1. 部分session打开mysql兼容调用，部分session关闭mysql兼容调用


  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|  
|
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

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

测试评审纪要：

1、不关注tobase64行为

2、DCL算子与本次修改无强关联，交叉覆盖关注

3、关注下变长类型的边界，结合规格补充测试细节，长字符短字符都需要覆盖

4、未经过tobase64编码的字符串做frombase64入参，返回结果可能为null或当前字符集不能解析的乱码

