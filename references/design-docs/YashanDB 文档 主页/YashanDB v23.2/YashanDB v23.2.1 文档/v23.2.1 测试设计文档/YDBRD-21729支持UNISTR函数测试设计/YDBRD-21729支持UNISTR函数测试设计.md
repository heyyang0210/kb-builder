Created by 徐瑶, last modified by  周彬鑫 on 三月 01, 2024

# 1.   **概述**

本文描述UNISTR函数的测试设计

# 2.   **需求分析**

SR：     [YDBRD-21729](https://jira.yasdb.com/browse/YDBRD-21729?src=confmacro)    -  支持UNISTR函数  完成

开发设计文档：    [Unistr设计文档](133573066.html)  

### 2.1 语法图

![](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/img/unistr.gif?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxMDMsImV4cCI6MTc4MjMwNjkwM30.onHZMZa_84SaupvWSTfp7OAjqv5NvUAjG83ChlqIOqo)

### **2.2 功能描述**

Unistr函数主要用于将源字符串中的unicode形式的编码转换成对应的字符，再返回nvarchar形式下的目标字符串

1. 支持yanshanDB全部数据类型，（1）  支持INT,FLOAT,NUMBER，SMALLINT，BIGINT等数值类型，实质为转换为数字对应的字符串做转化，（2）  支持char/varchar2/date/timestamp,NCHAR,NVARCHAR2等字符串或能转换成字符串类型，（3）支持CLOB,NCLOB.  但不支持LOB的outline部分
1. 非Unicode编码部分的字符仅做Unicode转换   **当前YashanDB支持国家字符集（NATIONAL_CHARACTER_SET）只为UTF-16，建库时指定，后续无法更改；**
1. 对'\'后合法的'\'或4个合法的16进制数做转换，得到unicode编码对应的值并返回nvarchar类型的结果字符串。  如若要将反斜杠包含在字符串本身中，需在其前面加上另一个反斜杠 (\)
1. 如果任意一个参数为 NULL， UNISTR() 将返回 NULL  ；
1. 函数作为整体拼接其他不同数据类型，不同单位拼接，需要关注长度（length\lengthb）和返回类型（typeof）是否正确，  返回nvarchar类型字符串，长度部分按实际字符长度计算  ；
1. 转换后的输出超过返回值规格时，截断显示    

1. ![](https://pingcode.yasdb.com/atlas/files/public/67396ba78970c2af4f52061a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxMDMsImV4cCI6MTc4MjMwNjkwM30.onHZMZa_84SaupvWSTfp7OAjqv5NvUAjG83ChlqIOqo)
1. 涉及视图和驱动影响（ v$function 新增此函数，jdbc的getfunction接口新增此函数）
1. 支持数据库的ddl、dml、dql、plsql操作
1. 支持绑定参数（jdbc、plsql都支持）


需求范围：    
  1、单机和集群    
  2、行表      

   ()()   ().x  调用数组，参考udt写法

# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|函数关键字|合法关键字|  
|关键字缺失|  
|
|  
|大写(UNISTR)|  
|关键字不全(unstr,unist)|  
|
|  
|小写|  
|关键字拼写错误(unistre,unisrt)|  
|
|  
|大小写组合(Unistr,UNIstr)|  
|带单双引号('unistr'('1234')、unistr("1234")|  
|
|  
|与表、视图同名(create table unistr(c1 int))|  
|  
|  
|
|参数个数|1个|  
|参数个数不匹配（0个/2个）|  
|
|函数参数|常量unistr（'1234'）|  
|  
|  
|
|  
|变量,- 列unistr（c1）
- 表达式
|  
|  
|  
|
|  
|子查询|  
|  
|  
|
|  
|函数|  
|  
|  
|
|  
|伪列  rownum|  
|  
|  
|
|  
|数据类型：,- 数值型：smallint、tinyint、int、bigint、float、double、number，科学计数法，覆盖  正负边界值、【NaN、-INF、INF】
|  
|超过数值边界范围|  
|
|  
|- 字符型：char、varchar、nchar、nvarchar，覆盖普通字符串、字符串长度边界、     ASCII 字符、     Unicode 编码值、  特殊字符、中文、转义字符、混合字符串、  韩文日文俄文表情包、  空：null、’‘，’   ‘  等
|  
|超过单行string的max值|  
|
|  
|- 布尔型：  boolean
|  
|  
|  
|
|  
|- 日期型：
|  
|  
|  
|
|  
|- 大对象：json、clob、blob、nclob（inline lob部分）
|nclob中表现与oracle对齐|outline lob|  
|
|  
|- raw
|  
|  
|  
|
|  
|含有  '\',- 只含有‘\’,个数为2，4，6
- ‘\’后有4个合法的Unicode 编码值（覆盖全部uinicode编码字符），不同\+unicode拼接，‘\’的个数为1，2，3，4，5...
- ‘\’的位置在字符串开头，在字符串中间，在字符串末尾
- ‘\’+4个合法的Unicode 编码值拼接其他类型
|重点！！|‘\’个数为单数个（只含有\，\后不是  4个合法的Unicode 编码值  ）|  
|
|函数功能|函数嵌套127层|  
|大于127|  
|
|  
|与其他函数嵌套(cast、to_char、replace等)|  
|  
|  
|
|  
|返回值与长度：,- typeof()  （函数返回值类型固定为NVARCHAR  ）
,- 长度length\lengthb  （  长度部分按实际字符长度计算  ）
|  
|  
|  
|
|dql|投影列，单列，多列，4096列|  
|  
|  
|
|  
|filter：in/not in、exists/not exists、between and 、like/not like等|  
|  
|  
|
|  
|分组、排序：group by、having、join on、order by、connect by等|  
|  
|  
|
|  
|在子查询的filter、投影|  
|  
|  
|
|dml|update作为set值以及where条件|  
|  
|  
|
|  
|insert作为value值|  
|  
|  
|
|  
|insert select|  
|  
|  
|
|  
|delete 作为where条件|  
|  
|  
|
|ddl|create table/view时作为列的default值|转换后插入表中能正常查询|  
|  
|
|  
|alter时作为列的default值 【alter...add column...】|  
|  
|  
|
|plsql|case、if、for,字符串参数支持绑定参数,jdbc绑定参数|  
|  
|  
|
|v$function 中新增函数名|有unistr函数|  
|  
|  
|
|其他表类型|临时表,lsc/tac不支持：拦截该函数|  
|  
|  
|


### 不同字符集交叉测试

|字符串字符集|类型|数据库字符集|nchar字符集|unistr（）|
|:---|:---|:---|:---|:---|
|utf8|非unicod编码|utf8|utf16|保留原型，typeof为nvarchar|
||unicod编码|||转换成功，typeof为nvarchar|
||非  unicod编码||  unicod编码|||转换成功（原型||unicode对应字符），typeof为nvarchar|
|utf16  (不完全会成功)与oracle对齐|非unicod编码|utf8|utf16|保留原型，typeof为nvarchar|
||unicod编码|||转换成功，typeof为nvarchar|
||非  unicod编码||  unicod编码|||转换成功（原型||unicode对应字符），typeof为nvarchar|
|其他字符集（  ASCII全量覆盖  /GBK/ISO-8859-1  ）  范围？？|非unicod编码|utf8|utf16|nchar\nvarchar数据类型部分显示乱码，typeof查看是nvarchar，非法字符乱码其他类型数据库不能core  （  乱码的话 -f -e执行查看out文件中的字节流与oracle的dump比对）|
||unicod编码|||nchar\nvarchar数据类型原样输出，typeof查看是nvarchar，其他类型数据库不能core|
|gbk|非unicod编码|gbk,  
|utf16|保留原型，typeof为nvarchar|
||unicod编码|||转换成功，typeof为nvarchar|
||非  unicod编码||  unicod编码|||转换成功（原型||unicode对应字符），typeof为nvarchar|
|utf8|非unicod编码|gbk|utf16|nchar\nvarchar数据类型部分显示乱码，typeof查看是nvarchar，其他类型数据库不能core|
||unicod编码|||nchar\nvarchar数据类型原样输出，typeof查看是nvarchar，其他类型数据库不能core|
|ASCII|非unicod编码|ASCII,  
|utf16|保留原型，typeof为nvarchar|
||unicod编码|||转换成功，typeof为nvarchar|
||非  unicod编码||  unicod编码|||转换成功（原型||unicode对应字符），typeof为nvarchar|
|utf8|非unicod编码|ASCII|utf16|nchar\nvarchar数据类型部分显示乱码，typeof查看是nvarchar，其他类型数据库不能core|
||unicod编码|||nchar\nvarchar数据类型原样输出，typeof查看是nvarchar，其他类型数据库不能core|
|ISO88591|非unicod编码|ISO88591|utf16|保留原型，typeof为nvarchar|
||unicod编码|||转换成功，typeof为nvarchar|
||非  unicod编码||  unicod编码|||转换成功（原型||unicode对应字符），typeof为nvarchar|
|utf8|非unicod编码|ISO88591|utf16|nchar\nvarchar数据类型部分显示乱码，typeof查看是nvarchar，其他类型数据库不能core|
||unicod编码|||nchar\nvarchar数据类型原样输出，typeof查看是nvarchar，其他类型数据库不能core|
|  
|  
|  
|  
|  
|


# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
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

**1.测试设计细化后的文本用例**

详见附件

[unistr函数文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTc4OTcwYzJhZjRmNTIwNjE4IiwicmVmX2lkIjoiNjczOTZiYTc1OTNmOTljOWZmMjM2NTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTAzLCJleHAiOjE3ODIzODI1MDN9.dLtwQHbUTHTUO-Y1VqvYMw2VbWSRU-SjXfIZgZRMOFo)

**2.加固测试点**

|测试点|等价类|备注|
|---|---|---|
|参数|参数为子查询|  
|
|  
|参数为||表达式|  
|
|  
|参数为null时返回值类型|  
|
|DML|insert into select|优先级低|
|DDL|create materialized view as select|优先级低|
|视图|视图/物化视图中使用函数|优先级中|
|绑定参数|jdbc|脚本实现|
|DQL|cte|优先级中|


# 6.   **测试框架设计**

1. 使用guider框架，执行sql文件 对比预期与实际输出结果


# 7.   **测试环境说明**

|服务器|  
|
|---|---|
|操作系统|Linux|
|部署|单机、集群|


  


  [XXX功能测试设计.doc](#)  

## Attachments:

[unistr函数文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYTc4OTcwYzJhZjRmNTIwNjE4IiwicmVmX2lkIjoiNjczOTZiYTc1OTNmOTljOWZmMjM2NTQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTAzLCJleHAiOjE3ODIzODI1MDN9.dLtwQHbUTHTUO-Y1VqvYMw2VbWSRU-SjXfIZgZRMOFo)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,针对这个补测并上库自动化用例：    [YDBRD-24649](https://jira.yasdb.com/browse/YDBRD-24649)    [质量加固] isChar和charLen: unistr函数静态优化场景，nvarchar类型建表的字节长度和字符长度都不正确,后续增加checklist：函数返回类型作为整体建表时候的规格是否正确！！！    [内置函数checklist](https://conf.yasdb.com/pages/viewpage.action?pageId=117080630)  ,Posted by hetianhuan at 十二月 26, 2023 15:41|
|---|
|  [](null)  ,与会人：林永豪、赵忠源、刘晓芳、贺天欢、徐瑶    
  评审时间：2023-11-03 11:00-12:00    
  评审地点：702,会议主题：unistr函数的测试设计评审    
  评审纪要信息：,1.需  覆盖全部uinicode编码字符    
  2.需考虑不同字符集下使用该函数,评审通过与否：通过,Posted by xuyao at 十月 18, 2024 09:56|
