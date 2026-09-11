Created by 易文亮, last modified on 十月 31, 2023

  


# **1. 概述**

本文描述单机列存支持大LOB测试设计

# **2. 需求分析**

**SR:**    [YDBRD-13381](https://jira.yasdb.com/browse/YDBRD-13381?src=confmacro)    **-**  **分布式列表支持大LOB写入，查询 **  **完成**

**开发设计：**    [分布式支持大Lob写入、查询设计文档 - 冯浩楠 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112725825)  

LOB全称为二进制大型对象（Binary Large Object)。它用于存储数据库中的大型二进制对象。可存储的最大大小为4G字节。

列存tac/lsc的大lob行外存储，1是建表默认，LOB字段超过32000；2是指定LOB(colmun)  STORE AS (tablespace tablespace_name   DISABLE   STORAGE IN ROW)

#### **2.1**    [规格设计](http://cod-conf.sics.com/display/YAS/BLOB#%E8%A7%84%E6%A0%BC%E8%AE%BE%E8%AE%A1)  

元数据、存储设计、协议设计参考已实现的    [LOB类型](http://cod-conf.sics.com/pages/viewpage.action?pageId=54690490)    ，SQL层上BLOB与CLOB有差异

#### 2.2    [说明](http://cod-conf.sics.com/display/YAS/BLOB#%E8%AF%B4%E6%98%8E)  

1.blob是二进制对象，无法直接参与加减乘除运算

2.length和lengthb内置函数操作blob类型对象，结果是该二进制对象的字节长度

3.向blob列中插入数据时，支持插入十六进制字符串('0'-'9'、'a'-'f'、'A'-'F')，内部会将这些十六进制字符转成bit（一个十六进制字符用4个bit表示），在内部存储。如果插入的不是十六进制字符串，进行拦截报错。该特点对标Oracle

4.更新blob列中数据，参照插入时的特点

5.查询blob列，yasql支持将blob的二进制串转成十六进制字符串，如果先前插入奇数个十六进制字符，那么内部存储的是奇数个 4个bit，这不能被8整除（一个字节对应8比特）。所以在即将输出结果之前，会在十六进制字符串前补'0'。该特点对标Oracle

6.blob类型对象转成字符串时，blob对象中的字节都会强转成字符

7.  blob参与字符串运算时，因为blob对象中的字节都会强转成字符，所以最后的结果类型也是字符串类型，遵循字符串类型规格，这个和clob有区别。该特点对标Oracle

#### 2.3  测试分析

1、heap默认超过4000存行外，列存默认超过32000存行外。

2、单机列存已支持clob inline,blob建表不支持， 本次的测试范围为列存clob outline，列存blob inline/outline

3、验证LSC/TAC普通表、分区表建表，insert\select\delete

4、tac表验证分区表的alter增删分区，alter增删列，update更新非lob列(包含跨分区)

5、验证大lob的导入

6、使用jdbc接口验证lob api的insert/select

# **3. 测试**  **设计方法**   

1.基本的语法及基础sql层、存储层测试，继承旧的blob的用例，参考    [*LOB - YashanDB - SICS-CoD Confluence](http://cod-conf.sics.com/display/YAS/*LOB)  

2.可靠性测试，采用场景法，覆盖HA、并发场景

2.针对问题单，举一反三，补充lob测试，参考    [[所有问题] 问题导航器 - SICS-CoD Jira](http://cod-jira.sics.com/issues/?filter=-4&jql=text%20~%20%22lob%22%20order%20by%20created%20DESC)  

3.针对blob自身的规格，采用等价类，边界值法，  场景法组合及错误推测法

#### **3.1对于blob自身规格的验证**

|输入条件|场景|有效等价类|无效等价类|备注|
|:---|:---|:---|:---|:---|
|DML|insert/update值类型|'0'-'9'、'a'-'f'、'A'-'F'|其他英文字母（大小写）|drop table test2;    
  create table test2(id int, c1 blob);    
  insert into test2 values(1,'aaaa');    
  commit;    
  insert into test2 values(2,(select c1 from test2 where id=1));,update test2 set c1=(select c1 from test2 where id=1);|
|  
|  
|null，空串|空格串||
|  
|  
|子查询|特殊符号||
|  
|  
|函数表达式|中文，日文，韩文，西欧语言||
|  
|  
|  
|数值||
|  
|  
|  
|操作符表达式||
|  
|insert/update值长度|<=32000|>32000||
|  
|insert into on duplicate key update|  
|  
|  
|
|  
|insert all|  
|  
|  
|
|DDL|create table (a blob default值)|同上|同上|  
|
|  
|create table if not exists (a blob default值)|字符长度小于4000的常量字符串|字符长度超过4000的常量字符串|  
|
|  
|alter table add col default|函数返回值（字节长度<=32000）|函数返回值（字节长度>32000）|  
|
|  
|create table (a default,b default,...) as select blob 列|  
|  
|  
|
|DQL|投影列|单独查询|  
|  
|
|  
|  
|函数表达式|  
|  
|
|  
|filter 列|like/not like|>, <, =, !=, >=, <=|  
|
|  
|  
|exists/not exists|in/not in|  
|
|  
|  
|is null/is not null|between and|  
|
|  
|  
|case when|any/some/all|  
|
|  
|  
|union all|union|filter exists中的union优化为union all，第一个返回就可以？？|
|  
|  
|  
|join|  
|
|  
|结合其他|结合count|结合distinct|oracle不支持count，distinct，order by，group by|
|  
|  
|  
|结合order by|  
|
|  
|  
|  
|结合group by|  
|
|~~内置函数~~|~~字符函数~~|~~substr，lengthb，lpad，rpad，cast，concat，upper，lower，trim，find_in_set~~|~~instr，replace，position~~|~~oracle支持instr，replace~~|
|  
|~~聚集函数~~|~~count~~|~~max，min~~|  
|


|综合|
|:---|
|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|常量/变量|insert  table:,- blob数据列
- clob数据列
,create table ：,- blob数据列默认值
- clob数据列默认值
,alter table：,- blob数据列赋值
- 新增数据列的默认值
- clob数据列赋值,modify  （覆盖大变小，小变大）
- 新增clob数据列的默认值
|8000|正常插入，不报错；查询显示正确|/|/|
|  
|insert  table:,- blob数据列
- clob数据列
,create table ：,- blob数据列默认值
- clob数据列默认值
,alter table：,- 新增blob数据列的默认值
- clob数据列,modify  （覆盖大变小，小变大）
- 新增clob数据列的默认值
|31900|  
|32001|报错，无法插入或者更改|
|查询|上述用例场景，都需要覆盖length、lengthb函数|  
|  
|3|  
|


#### yasql有长度限制，使用jdbc可验证insert或导入32000+的数据

#### **3.2与其他新增特性结合的验证**

|特性|场景|备注|
|:---|:---|:---|
|rebuild index|与rebuild index进行并发测试，更改非lob索引属性|  
|
|  
|修改lob索引属性|拦截|
|  
|列存lob的函数计算|拦截|


#### **3.3对于问题单测试点的梳理**

|序号|场景|备注|  
|
|:---|:---|:---|:---|
|1|不同用户下，创建表带外键，父表与子表中包含lob列|  
|  
|
|2|clob列插入数值|oracle支持|  
|
|3|内置函数中使用lob（参考oracle是否支持）|substr函数，  结束位置超过lob长度|  
|
|4|内置函数中使用lob的多字符集（检查该函数是否支持，不支持是否拦截）|  
|  
|
|5|插入lob数据时使用子查询的方式("insert into tb values(2,(select c1 from tb where id=1))")|  
|  
|
|6|lob出现在filter中|  
|  
|
|7|存储过程，自定义函数|  
|  
|


# 4.   **测试用例**

[列存分布式支持大lob测试设计(ydbrd13381).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTc4OTcwYzJhZjRmNTFmYjIxIiwicmVmX2lkIjoiNjczOTY5ZTc1OTNmOTljOWZmMjM1NDAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTIwLCJleHAiOjE3ODIyOTYzMjB9.GpSQNWSYOGVaGGJl1zbLmn5BVWTEUxdL54HJxHQefdk)

# 5.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|分布式|


## Attachments:

[列存分布式支持大lob测试设计(ydbrd13381).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTc4OTcwYzJhZjRmNTFmYjIxIiwicmVmX2lkIjoiNjczOTY5ZTc1OTNmOTljOWZmMjM1NDAyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5OTIwLCJleHAiOjE3ODIyOTYzMjB9.GpSQNWSYOGVaGGJl1zbLmn5BVWTEUxdL54HJxHQefdk)

 (application/x-xmind)    
