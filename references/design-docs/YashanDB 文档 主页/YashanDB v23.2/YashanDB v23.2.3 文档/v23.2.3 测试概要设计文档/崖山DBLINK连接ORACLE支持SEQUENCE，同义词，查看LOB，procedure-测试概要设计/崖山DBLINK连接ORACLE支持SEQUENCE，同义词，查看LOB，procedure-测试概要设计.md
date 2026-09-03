Created by 胡晓畔 on 五月 13, 2024

## 1. 需求概述

  


1、需求来源：市场需求，  深燃二期

2、需求概述： 

崖山DBLINK连接到Oracle，支持：

应用远端sequence

为远端对象【表，视图，序列，udp.procedure, udp.function 】创建同义词并应用在本地

查看远端LOB数据，包含clob blob  nclob

调用远端procedure，udf，udp.procedure, udp.function

3、  需求范围：  单机 

  


## 2. 功能点

1、功能：

|sequence|支持DBLINK连接到Oracle，应用远端sequence，规格应当同直接应用本地sequence 一致,调用方式为   seq_oracle@dblink .currval|
|---|---|
|同义词|支持为远端表和视图创建同义词，同义词的DML应与直接操作远端表和视图行为一致，,存在少量场景区别（分区表等）需要发散,创建语法为   CREATE or replace SYNONYM SYNONYMname FOR 远端表@dblink|
|LOB|支持查看远端的clob，blob，NCLOB ，查看包括直接查询LOB列和含LOB的表达式|
|procedure|支持直接调用远端的procedure，UDF，UDP.procedure，udp.function ，支持远端procedure等在本地的应用|


  


2、差异：

|sequence|暂无|
|---|---|
|同义词|当前交付表和视图,后续需要考虑 sequence，procedure等对象--有SR跟进|
|LOB|当前支持查看，不支持insert update delete 带远端LOB|
|procedure|已明确当前不支持udt类型，游标类型,事务支持只读事务，自治事务，不支持XA事务,待补充|


  


## 3. 规格约束

1.sequence

规格同崖山本身sequence实现；

2.同义词

同义词支持表 ，视图的dml范围，受限于崖山DBLINK直接对表操作的支持范围；

存在少量场景区别（分区表等）需要发散-- 范围不明确

3.LOB

Oracle的LOB分为basicfiles LOB和   Securefiles LOB ，对于崖山拿到的是否没有区别 --待确认

4.procedure

已明确当前不支持udt类型，游标类型

事务支持只读事务，自治事务，不支持XA事务

  


  


## 4. 主要应用场景

1、应用场景：

远端sequence应用同本地sequence应用场景一致

同义词对象为远端sequence，table，view，procedure等，操作同义词与直接操作关联的对象没有区别

查看远端LOB数据，远端LOB表达式应用场景

远端procedure等的调用以及返回值的应用场景符合预期

2、关联场景：同义词视图 ；特性间交互；--待补充

  


## 5. 概要测试设计

### 5.1 功能测试设计

1、功能设计：

|sequence|参考崖山本身对sequence     的支持范围，通过DBLINK的场景也需支持,梳理现存sequence用例，明确sequence的使用场景,可改造现有用例全量执行，减少编写用例时间；但不能全部依赖现有用例|关注sequence 本身的功能,  
|1.与Oracle的语法差异,2.sequence 增序,3.sequence 降序,4.sequence是否自循环,5.currval   nextval 组合|  
|
|---|---|---|---|---|
|  
|  
|关注sequence可以出现的位置,  
|insert into 远端表 values  远端sequence,考虑单列和多列|预期支持|
|  
|  
|  
|select  远端sequence from 本地表/远端表|预期支持|
|  
|  
|  
|远端sequence作为建表时候default值,考虑多个default值,考虑对default列的alter操作|预期支持|
|  
|  
|  
|远端sequence update 操作,支持作为set value,不支持作为where条件|部分支持|
|  
|  
|  
|远端sequence delete 操作|不支持|
|  
|  
|  
|远端sequence 其他应用：表达式，  组合函数，select+子查询，绑定参数为远端sequence 等,参考sql测试设计checklist|  
|
|  
|  
|  
|跨DBLINK不支持,验证拦截,需要考虑     远端LINK1表 + schema.link2sequence@link1 的场景，覆盖查询和dml的支持场景|  
|
|  
|  
|结合下推函数|下推函数列表：,差异列没标BIW的都是会下推的,  [yasdb和oracle可下推的函数列表 - 马士杰 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=112729419)  ,函数出现在filter里面，与sql复杂度关系不大|filter的有一些函数是下推到远端执行的，这部分之前没覆盖，这次测试DBLINK需求的时候需要补充|
|synonym|参考崖山本身对   synonym （当前限制为表和视图）的支持范围，通过DBLINK的场景也需支持,关注 synonym 的功能，出现的位置，dml  ， ddl等|synonym创建|远端表和远端视图,LINK1的视图来自LINK2 的表，为LINK1的视图创建同义词,  
,  
|预期支持|
|  
|  
|同义词  创建  嵌套|给远端table 创建SYNONYM_01 ，再给SYNONYM_01 创建 SYNONYM_01_01 ..,  
|预期支持，但是否有最大层数限制？|
|  
|  
|  
|嵌套同义词的 应用|预期使用正常|
|  
|  
|synonym应用|select查询,子查询嵌套 查询|预期支持|
|  
|  
|  
|通过同义词对远端表insert ,考虑带子查询|预期支持|
|  
|  
|  
|update set ,where后使用,受限于崖山DB DBLINK能力，需要验证带子查询拦截|拦截信息内部是否应当一致或易懂|
|  
|  
|  
|delete,受限于崖山DB DBLINK能力，需要验证带子查询拦截|拦截信息内部是否应当一致或易懂|
|  
|  
|  
|跨LINK 应当支持|  
|
|  
|  
|  
|**远端表覆盖分区表**,**update，delete 指定分区表的DBLINK支持受限，确认同义词场景表现**|  
|
|  
|  
|  
|**远端视图考虑物化视图，force视图**|  
|
|  
|  
|同义词视图  syn$|视图功能正确性,标记同义词对象是否是远端对象|  
|
|  
|  
|特性交互|为远端sequence创建同义词,通过同义词操作远端sequence|依赖sequence实现|
|  
|  
|  
|通过同义词操作远端procedure ，udf，udp|依赖存储过程实现|
|  
|  
|结合下推函数|下推函数列表：,差异列没标BIW的都是会下推的,  [yasdb和oracle可下推的函数列表 - 马士杰 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=112729419)  ,函数出现在filter里面，与sql复杂度关系不大|filter的有一些函数是下推到远端执行的，这部分之前没覆盖，这次测试DBLINK需求的时候需要补充|
|LOB|远端表的LOB类型,覆盖clob，blob，NCLOB,本端查看远端LOB，考虑LOB的长度，查询方式，跨LINK查询|远端LOB的类型和长度|clob，blob，NCLOB,4000,8000，32000,80000...,最大覆盖到多少？|  
|
|  
|  
|查询方式|单列查询,多列查询,LOB列 || |支持,支持,？|
|  
|  
|  
|表达式 -结果为非LOB的：,   length      to_char 等入参支持LOB类型但返回非LOB的函数,  
|支持|
|  
|  
|  
|表达式 -结果为LOB的：,to_clob to_blob REPLACE,高级包：,dbms_lob.getlength,DBMS_LOB.SUBSTR|崖山支持，Oracle不支持|
|  
|  
|  
|实际返回类型不为LOB ，但包含dbms_lob|崖山支持，Oracle不支持|
|  
|  
|DML|远端LOB列 insert ,远端LOB update,远端LOB delete|不支持,不支持,Oracle也不支持|
|  
|  
|  
|远端LOB 查询后insert 到本地表|支持？|
|  
|  
|  
|update本地表 set 后带远端LOB|支持？|
|  
|  
|  
|update本地表 where条件带远端LOB|不支持？|
|  
|  
|  
|delete本地表 where条件带远端LOB|不支持？|
|  
|  
|DDL|create view as select 远端LOB|支持？|
|  
|  
|LOB列应用位置|order by,limit ,offset ,group by ...|支持？|
|  
|  
|跨LINK|跨LINK查询,需要考虑       schema.link2的LOB@link1 的场景|不支持,支持|
|  
|  
|结合下推函数|下推函数列表：,差异列没标BIW的都是会下推的,  [yasdb和oracle可下推的函数列表 - 马士杰 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=112729419)  ,函数出现在filter里面，与sql复杂度关系不大|filter的有一些函数是下推到远端执行的，这部分之前没覆盖，这次测试DBLINK需求的时候需要补充|
|procedure|远端procedure function，udp支持在本地调用,--待确认在明确不支持的范围之外，是否默认全部支持？,梳理现存PLSQL相关用例，改写为远端调用场景，再补充特性相关的场景,  
|远端procedure无参|远端procedure无参,覆盖存储过程主要元素|  
|
|  
|  
|远端procedure 有参|远端procedure 有参，支持当前DB所有标量数据类型,--参考DBLINK类型映射,覆盖所有标量类型,覆盖参数方向为 in ， out， in out ，并且验证参数方向正确性|  
|
|  
|  
|远端function-无出参|覆盖返回值类型,--参考DBLINK类型映射，覆盖所有标量类型|  
|
|  
|  
|远端function 有单个/多个out出参|--参考DBLINK类型映射,覆盖所有标量类型,覆盖参数方向为 in ， out， in out ，并且验证参数方向正确性|  
|
|  
|  
|远端function+远端表查询|  
|场景是否必要？|
|  
|  
|远端function+本地表查询|覆盖function使用位置,-- 参考pl语言测试设计checklist|  
|
|  
|  
|远端function作为本地表default 列|验证不支持,-- 同类型验证 作为索引等也不支持|  
|
|  
|  
|远端function + 本地function|本地UDF,本地内置函数,本地内置函数+外部引用|  
|
|  
|  
|远端function + 本地procedure|  
|  
|
|  
|  
|远端function 返回值 + 本地表insert   ，update，delete|是否受限于DBLINK的能力？？|  
|
|  
|  
|结合下推函数|下推函数列表：,差异列没标BIW的都是会下推的,  [yasdb和oracle可下推的函数列表 - 马士杰 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=112729419)  ,函数出现在filter里面，与sql复杂度关系不大|filter的有一些函数是下推到远端执行的，这部分之前没覆盖，这次测试DBLINK需求的时候需要补充|
|  
|  
|udp.procedure,udp.function|异常控制，循环等,-- 参考pl语言测试设计checklist|  
|
|  
|  
|schema.远端function、procedure，UDP.proc ,udp.function |带schema调用|  
|
|  
|  
|游标变量  |Oracle支持yashan不支持的procedure调用结果？|Oracle支持|
|  
|  
|UDT复合类型|array，record，object,嵌套表类型|验证不支持|
|  
|  
|远端调用嵌套本地匿名块|  
|  
|


  


  


  


  


  


2、拦截：

明确不支持的使用位置需要拦截

  


  


### 5.2 DFX测试设计

1、专项覆盖：CT、KT

2、可维可测：已满足

  


## 6. 测试策略

|测试项|自动化|框架|详细|
|:---|:---|:---|:---|
|功能|是|yasft|  
|
|CT/KT|是|testkill|构造各个特性的组合并发场景|


  


## 7. 后续关注(可选)

当前需求的交叉场景

  
