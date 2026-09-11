Created by 鄢红亮, last modified on 十二月 15, 2023

#   [YDBRD-18930](https://jira.yasdb.com/browse/YDBRD-18930?src=confmacro)    -  支持soundex函数  完成    [YDBRD-18922](https://jira.yasdb.com/browse/YDBRD-18922?src=confmacro)    -  支持soundex  完成

# 1.   **概述**

Soundex是一种语音算法，用于按英语发音对名称进行索引。目标是将同音词编码为相同的表示形式，以支持英文模糊音匹配。

SOUNDEX Research       [https://conf.yasdb.com/pages/viewpage.action?pageId=124256555](https://conf.yasdb.com/pages/viewpage.action?pageId=124256555)  

# 2.   **需求分析**

### 2.1 语法图

![](https://pingcode.yasdb.com/atlas/files/public/67396bfaa1ad9a3311dc86e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTgzMjYsImV4cCI6MTc4MjMwOTEyNn0.SmqWUcsjesPc9-PoXtD4wCWn-ovxzqGgrHHReEs6tP4)

### 2.2 功能描述

SOUNDEX对输入字符串处理返回用经典soundex形式表示的字符串char，用于表示英文发音下单词的一种特殊缩略。该函数可以在查询（where）的子句中使用，也可以作为搜索表达式中的条件。

SOUNDEX算法-wiki百科       [https://en.wikipedia.org/wiki/Soundex](https://en.wikipedia.org/wiki/Soundex)  

Soundex 编码由一个字母后跟三个数字组成：该字母是text的第一个字母，数字通过下面规则对其余辅音进行编码。

将辅音替换为数字，如下所示（在第一个字母之后）：    
  **b、f、p、v → 1**    
  **c、g、j、k、q、s、x、z → 2**    
  **d, t → 3**    
  **l → 4**    
  **m，n → 5**    
  **r → 6**

保存第一个字母。把所有出现的 a、e、i、o、u、y、h、w替换成0

将所有辅音（包括第一个字母）替换为上面表中的数字。

将所有相邻的相同数字替换为一位数字，然后删除所有零 (0) 数字

如果保存的字母的数字与结果的第一位数字相同，则删除该数字（保留字母）。

如果单词中的字母太少而无法分配三个数字，则在后面加0，直到出现三个数字。如果有四个或更多数字，则仅保留前三个。

SOUNDEX主要用于比较拼写不同但英语发音相似的单词，仅支持英文匹配，对于中文/标点符号/数字等除英文字符外的会直接忽略

# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|soundex函数|概述|输入字符串处理返回用经典soundex形式表示的字符串char|  
|  
|  
|
|---|---|---|---|---|---|
|||Soundex('expr')|  
|  
|  
|
|||b、f、p、v = 1    
  c、g、j、k、q、s、x、z = 2    
  d, t = 3    
  l = 4    
  m，n = 5    
  r =6    
  a、e、i、o、u、y、h、w=0|  
|  
|  
|
||规格|关键字校验|函数名称大小写、拼写错误、名称缺失，带单/双引号；|  
|  
|
||||与表、视图同名；|  
|  
|
||||是否与系统表，系统预留字段重名；|  
|  
|
|||入参|参数个数|非法参数个数|  
|
||||参数类型|CHAR|  
|
|||||VARCHAR|  
|
|||||NCHAR|  
|
|||||NVARCHAR|  
|
|||||bool|  
|
|||||int|  
|
|||||number|  
|
|||||smallint|  
|
|||||bigint|  
|
|||||float|  
|
|||||double|  
|
|||||date|  
|
|||||time|  
|
|||||timestmp|  
|
|||||clob|  
|
|||||blob|  
|
|||||nclob|  
|
|||||raw|  
|
|||||json|  
|
|||||数值型|TINYINT|
||||||INTEGER|
||||||BIT|
|||||布尔型|Boolean|
|||||日期型|INTERVAL YEAR TO MONTH|
||||||INTERVAL DAY TO SECOND|
|||||UROWID|  
|
|||||ROWID|  
|
|||||ST_GEOMETRY|  
|
|||||隐式转换|  
|
||||参数长度|blob类型2^32-1会报错|  
|
||||非法参数|语种|中文|
||||||英文|
||||||小语种|
|||||正则表达式符号|  
|
|||||特殊符号|！@#￥%……&*（）/*-+|
|||||空值运算，连接符|  
|
||||正则表达式返回值作为参数|  
|  
|
|||出参|返回保留第一个字母，返回后三位对应不同的数字，不足三位则补0.|  
|  
|
||||出参的数据类型|  
|  
|
||||长度4/8|  
|  
|
||DML|insert：函数作为value值进行insert操作|insert into values|  
|  
|
||||insert into select  ...|  
|  
|
|||delete：函数作为where条件|  
|  
|  
|
|||update：函数作为set值，where条件|  
|  
|  
|
||DDL|create：create table/view as ，列默认值|  
|  
|  
|
|||alter：列默认值、where条件|  
|  
|  
|
||部署|单机|表类型|lsc|  
|
|||||tac|  
|
|||||heap|  
|
||视图|物化视图|  
|  
|  
|
|||v$function|  
|  
|  
|
||PLSQL|udt|  
|  
|  
|
|||绑定参数|  
|  
|  
|
||函数索引|  
|  
|  
|  
|
||函数嵌套|字符函数|CHR|  
|  
|
||||CONCAT|  
|  
|
||||CONCAT_WS|  
|  
|
||||INITCAP|  
|  
|
||||LOWER|  
|  
|
||||LPAD|  
|  
|
||||REPLACE|  
|  
|
||||RPAD|  
|  
|
||||SUBSTRING|  
|  
|
||||SUBSTRING_INDEX|  
|  
|
||||TO_BASE64|  
|  
|
||||TRANSLATE|  
|  
|
||||TRIM|  
|  
|
||||UPPER|  
|  
|
|||聚合函数|sum|  
|  
|
||||avg|  
|  
|
||||min|  
|  
|
||||max|  
|  
|
|||正则函数|REGEXP_COUNT|  
|  
|
||||REGEXP_INSTR|  
|  
|
||||REGEXP_LIKE|  
|  
|
||||REGEXP_REPLACE|  
|  
|
||||REGEXP_SUBSTR|  
|  
|
|||其他函数|NULLIF|  
|  
|
||||DECODE|  
|  
|
||||IF|  
|  
|
||||NVL|  
|  
|
||||NVL2|  
|  
|
||||GREATEST|  
|  
|
||||LEAST|  
|  
|
||||coalesce|  
|  
|
|||自嵌套|127层|  
|  
|
|||与其他函数互嵌套多层|  
|  
|  
|
||位置|from|JOIN|inner join|  
|
|||||left join|  
|
|||||right join|  
|
|||||full join|  
|
||||子查询|关联子查询|  
|
|||||非关联子查询|  
|
|||||子查询嵌套|  
|
|||||在子查询中的位置|  
|
|||WHERE|比较符号（=, >, >=, <, <=, <>）|  
|  
|
||||between and , in , exists, any, all |  
|  
|
||||and, or|  
|  
|
||||order by|  
|  
|
||||GROUP BY|  
|  
|
||||HAVING|  
|  
|
||||LIMIT|  
|  
|
||||集合运算|union|  
|
|||||union all|  
|
|||||intersect|  
|
|||||minus|  
|
||||比较两个同音不同字的词|  
|  
|


  


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

使用guider框架，执行sql文件 对比预期与实际输出结果

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


  


  


  


## Attachments:

[soundex.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmE4OTcwYzJhZjRmNTIwODZjIiwicmVmX2lkIjoiNjczOTZiZmE1OTNmOTljOWZmMjM2OGY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4MzI2LCJleHAiOjE3ODIzODQ3MjZ9.sEVbh4Lno2x-hhnDzLo_kG6nJjT5xmlbaXh1jDYHpNs)

 (application/x-xmind)    
