Created by 韩晓盼, last modified on 十二月 13, 2023

IR：    [YDBRD-17970](https://jira.yasdb.com/browse/YDBRD-17970?src=confmacro)    -  支持V$SQL_BIND_CAPTURE视图  完成    
  SR：    [YDBRD-8023](https://jira.yasdb.com/browse/YDBRD-8023?src=confmacro)    -  实现视图V$SQL_BIND_CAPTURE  完成

# 1. 概述

本需求设计为YashanDB提供绑定变量视图的功能，对外提供最近在SQL中使用并已经缓存在SGA中的绑定变量及其元数据的查询。

# 2. 需求分析

背景

**     Q：为什么需要绑定变量视图？**

**     A：**  用以查询在sql中使用过的绑定变量的相关信息，每一行都包含了定义在某个游标中的绑定变量的相关信息，相关信息可以分为三类：

1. 绑定变量所在的游标的相关引用：父游标的hash值，地址，子游标的hash值和地址。
1. 绑定变量的元数据：绑定变量的命名，数据类型，字符集id，精度（假如为number类型的话），范围，及最大长度等描述该绑定变量的元数据信息。
1. 绑定变量的值：绑定变量的值是在sql解析的时候被捕获的，分两种情况讨论：（1）在sql硬解析并包含有绑定变量时，永远都会去获取该sql所含的绑定变量的值。（2）在软解析时，为防止频繁更新的绑定变量的值会影响数据库的性能，默认V$SQL_BIND_CAPTURE会受_cursor_bind_capture_interval隐含参数的影响，一般设置900秒，以此间隔去捕获绑定的变量的值。


## 2.1 功能点分析

1、查询所有已在sql中使用的绑定变量的相关信息；

*2、*  开发设计的特性

- 绑定变量视图包含最近执行过的sql中所包含的绑定变量的相关信息，支持对视图的所有查询操作，不支持对该视图进行增删改等操作。
- 绑定变量视图里面的绑定变量的获取是通过游标来获取的，而游标是存储在库缓存中的，所以当库缓存区域被清空，或者数据库服务端进程被杀死，内存数据就会丢失，所有的游标对象在内存中也即丢失，则绑定变量的信息也会丢失。
- 绑定变量可以和其他视图进行表连接查询，如与v$sqlarea和v$sql进行某些字段的join查询。
- 绑定变量视图呈现的并不是实时最新的绑定变量的值，而是受隐含参数_cursor_bind_capture_interval的影响（oracle中为900秒即15分钟）。当sql硬解析时，假如sql中含有绑定变量，则其中的绑定变量的值会随着sql解析而被即时捕获，而当sql软解析时，会按照隐含参数的时间间隔去捕获绑定变量的值。


## 2.2 应用场景

- 本需求实现范围包括，对绑定变量不同入参类型进行捕获，通过本特性视图进行展示。


## 2.3 规格约束

1、本视图字段内容与Oracle有差异，详情见下表

|字段|类型（Yashan）|类型（Oracle）|说明（Yashan）|说明（Oracle）|Yashan|Oracle|
|---|---|---|---|---|---|---|
|ADDRESS|RAW(8)|RAW(8)|sql的地址|父游标的地址|√|√|
|HASH_VALUE|BIGINT|NUMBER|sql的hashValue， 由sqlText计算得到|库缓存中父游标的哈希值。哈希值是视图的固定索引，应始终用于加快对视图的访问速度。|√|√|
|SQL_ID|VARCHAR(13)|VARCHAR2(13)|sqlText 的 md5 + base32 结果|库缓存中父游标的 SQL 标识符|√|√|
|CHILD_ADDRESS|RAW(8)|RAW(8)|子游标的地址|子游标的地址|√|√|
|CHILD_NUMBER|INTEGER|NUMBER|子游标编号|子游标编号|√|√|
|NAME|VARCHAR(64)|VARCHAR2(128)|绑定变量的名称，保留字段|绑定变量的名称|保留字段|√|
|POSITION|INTEGER|NUMBER|绑定变量在sql中的相对位置，下标|绑定变量在 SQL 语句中的位置|√|√|
|DUP_POSITION|INTEGER|NUMBER|假如该绑定变量在sql中有重复使用，则此列的值设置为首个扫描到的绑定变量的位置，保留字段|如果绑定是按名称执行的，并且绑定变量是重复的，则此列提供主绑定变量的位置。|保留字段|√|
|DATATYPE|INTEGER|NUMBER|绑定变量数据类型的内部标识符，即枚举|绑定数据类型的内部标识符。从 Oracle Database 12  c     开始，此列中可以显示一个表示 PL/SQL 数据类型的数字。|√|√|
|DATATYPE_STRING|VARCHAR(22)|VARCHAR2(15)|绑定变量数据类型的文本表示|绑定数据类型的文本表示形式。从 Oracle Database 12  c     开始，此列中可以显示仅 PL/SQL 数据类型的文本表示形式。如果实际数据类型是 PL/SQL 子类型，则将显示数据类型的名称，而不是子类型。|√|√|
|CHARACTER_SID|INTEGER|NUMBER|国家/地区字符集标识符，保留字段|国家/地区字符集标识符|保留字段|√|
|PRECISION|INTEGER|NUMBER|精度（数值类型的绑定变量），数值类型绑定参数才有此值，保留字段|精度（对于数字绑定）|保留字段|√|
|SCALE|INTEGER|NUMBER|范围（数值类型的绑定变量），数值类型绑定参数才有此值，保留字段|小数位数（用于数字绑定）|保留字段|√|
|MAX_LENGTH|INTEGER|NUMBER|绑定变量的最大长度，即绑定变量当前类型所能占用的最大字节数量，显示类型最大长度，不是显示实际绑定的列的类型的长度。|最大绑定长度|√|√|
|WAS_CAPTURED|VARCHAR(3)|VARCHAR2(3)|YES/OR 表示绑定变量的值是否被捕获，保留字段|指示是否捕获了绑定值 （） （    `YES`      `NO`    )|保留字段|√|
|LAST_CAPTURED|DATE|DATE|最近一次捕获绑定变量的值的时间，保留字段|捕获绑定值的日期。执行 SQL 语句时捕获绑定值。为了限制开销，对于给定游标，最多每 15 分钟捕获一次绑定。|保留字段|√|
|VALUE_STRING|VARCHAR(4000)|VARCHAR2(4000)|绑定变量的值，使用varchar(4000)来表示，保留字段|表示为字符串的绑定的值|保留字段|√|
|VALUE_ANYDATA|/|ANYDATA|/|使用数据类型表示的绑定的值。此表示形式可用于以编程方式解码绑定变量的值。如果列中出现仅 PL/SQL 数据类型，则此列为 NULL。    `ANYDATA`      `DATATYPE`  |/|√|
|CON_ID|/|NGTH NUMBER|/|数据所属容器的 ID。可能的值包括：,-   `0`    ：此值用于包含与整个 CDB 相关的数据的行。此值还用于非 CDB 中的行。
-   `1`    ：此值用于包含仅与根相关的数据的行
- n  ：其中     n     是包含数据的行的适用容器 ID
|/|√|


2、其他约束

- 不支持对绑定变量视图的增删改操作。
- 绑定变量视图的字段设置与oracle 19c的字段并非完全相同，因为某些特性YashanDB不存在。
- 绑定变视图是动态视图，使用已有的动态视图框架进行开发，与其他动态视图为平行关系。
- V$SQL_BIND_CAPTURE里面的值，每隔_cursor_bind_capture_interval这个间隔才更新一次，oracle中此隐藏参数的值默认为900s:


![](https://conf.yasdb.com/download/attachments/100093468/image2023-10-17_15-23-33.png?version=1&modificationDate=1697527177000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU1OTksImV4cCI6MTc4MjMwNjM5OX0.N4gc6u8DCWXREV0Ksw-KBpcUcwdwS_94KpzsA44DB-E)

oracle中可以使用alter system set "_cursor_bind_capture_interval"=1; 来更改绑定参数刷新的间隔为1s，即可缩短搜集间隔，做到几乎实时显示。

- oracle只会捕获位于SQL中在where或者having子句中所出现的绑定变量，并且只会展示简单数据类型的绑定变量的值，复杂类型：LONG，LOB，ADT类型的绑定变量的值不会被展示。


# 3. 详细测试设计

## 3.1 测试设计方法

等价类，场景分析等。    
  如，绑定参数为数值类型，可以挑字符类型中的任意一个类型作为实际入参类型，不需要涉及所有字符类型，属于等价类；本视图与业务之间进行并发，包括视图之间join并发和视图join和业务并发，属于场景分析类。

## 3.2 详细测试设计

1. 使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式


3.2.1 公共测试点

|测试点|分类1|分类2|预期|备注|
|---|---|---|---|---|
|针对视图的DDL和DML写操作是否做拦截，做校验|ddl操作拦截|1. create 同名对象
1. alter 视图
1. drop 视图
1. truncate 视图
|1. 创建失败
1. 修改失败
1. 删除失败
1. 操作失败
|具体细节见附件，下同    
  【YDBRD-8023】【视图V$SQL_BIND_CAPTURE测试设计.xmind|
|  
|dml写操作拦截|1. insert 操作
1. update 操作
1. delete 操作
|均操作失败|  
|
|针对视图的权限做校验|sys用户访问视图|  
|不加sys正常访问，能查询到内容|  
|
|  
|非sys用户访问|1. create 同名视图
|1. 可创建成功，并可对该视图进行读写操作
1. 不加schema不可访问
1. 加sys可访问
|  
|
|针对视图的基本过滤查询做校验|filter中使用基本的查询表达式|1. 算数表达式
1. 逻辑表达式
1. 匹配符
1. 分组排序
1. 多层子查询嵌套
|均可正确查询到所需结果|  
|
|与带有相同字段的视图进行连接查询|join|1. V$SQL
1. V$SQLAREA
1. V$SQL_PLAN
|均可正确查询到所需结果|  
|


  


3.2..2 业务场景相关测试

   由于本视图展示的是，  对绑定变量不同入参类型进行捕获，至于绑定参数出现什么位置并不是本特性需要特别关注的。

（1）  针对视图每个字段值的正确性做校验

|构造测试场景|分类1|分类2|分类3|预期（查看视图相关字段的显示，重点关注：  CHILD_NUMBER/POSITION/DATATYPE/DATATYPE_STRING/MAX_LENGTH  ）|示例|备注|
|---|---|---|---|---|---|---|
|绑定参数个数|1个和多个|  
|  
|  
|select SQL_ID from V$SQL_BIND_CAPTURE where SQL_TEXT like '';,select POSITION,DATATYPE,DATATYPE_STRING,MAX_LENGTH from V$SQL_BIND_CAPTURE where SQL_ID like '';|  
|
|不同数据类型作为绑定参数|DML场景,1. select
1. insert
1. update
1. delete
|绑定参数类型与实际传入参数类型保持一致（如varchar的传入类型也varchar）,  
,绑定参数类型：A,实际传入参数：B|TINYINT（实际入参类型） → TINYINT（绑定参数类型）,SMALLINT → SMALLINT,... ...,以此类推|可以在视图V$SQL_BIND_CAPTURE中查到对应正确结果；|1、select * from table1 where c1 =:1 and c2=:2;,2、insert into table1(c1,c2) values(:1,:2);,3、update table1 set c1=:1 where c2=:2;,4、delete from table1 where c1=:1;,  
|用到的数据类型分类,1. 数值型（TINYINT；SMALLINT；INT；BIGINT；FLOAT；DOUBLE；NUMBER；BIT）
1. 字符型（CHAR；VARCHAR；NCHAR；NVARCHAR；NVARCHAR2）
1. 布尔型（BOOLEAN）
1. 日期型（DATE；TIME；TIMESTAMP；INTERVAL YEAR TO MONTH；INTERVAL DAY TO SECOND）
1. 大对象型（BLOB；CLOB；NCLOB）
1. RAW
1. JSON
1. ROWID、UROWID
1. UDT
1. ST_GEOMETRY
|
|  
|  
|绑定参数类型与实际传入参数类型没有保持一致，但属于同类型,（1）B的实际值在A的取值范围内；,（2）B的实际值不在A的取值范围内，直接报错；|以数值型int作为绑定参数类型为例,TINYINT（实际入参类型） → INT（绑定参数类型）,SMALLINT（实际入参类型） → INT（绑定参数类型）,BIGINT（实际入参类型） → INT（绑定参数类型）,FLOAT（实际入参类型） → INT（绑定参数类型）,DOUBLE（实际入参类型） → INT（绑定参数类型）,NUMBER（实际入参类型） → INT（绑定参数类型）,BIT（实际入参类型） → INT（绑定参数类型）,... ...,以此类推|（1）可以在视图V$SQL_BIND_CAPTURE中查到对应正确结果；,（2）sql语句直接报错。情况一：数据类型之间不支持转换，在视图V$SQL_BIND_CAPTURE中查不到结果；情况二：数据类型之间支持转换，但转换数据对不上导致转换失败，在视图V$SQL_BIND_CAPTURE中能查到结果|bigint  := '1024'|  
|
|  
|  
|绑定参数类型与实际传入参数类型没有保持一致，且不属于同类型，但能隐式转换,（1）B的实际值在A的取值范围内；,（2）B的实际值不在A的取值范围内，直接报错；|以数值型int作为绑定参数类型，字符型可隐式转换为例,CHAR（实际入参类型） → INT（绑定参数类型）,VARCHAR（实际入参类型） → INT（绑定参数类型）,NCHAR（实际入参类型） → INT（绑定参数类型）,NVARCHAR（实际入参类型） → INT（绑定参数类型）,NVARCHAR2（实际入参类型） → INT（绑定参数类型）,... ...,以此类推|（1）可以在视图V$SQL_BIND_CAPTURE中查到对应正确结果；,（2）sql语句直接报错。情况一：数据类型之间不支持转换，在视图V$SQL_BIND_CAPTURE中查不到结果；情况二：数据类型之间支持转换，但转换数据对不上导致转换失败，在视图V$SQL_BIND_CAPTURE中能查到结果|char(64)  := '1'|  
|
|  
|  
|绑定参数类型与实际传入参数类型没有保持一致，不属于同类型，也不能隐式转换,  
|以数值型int作为绑定参数类型，字符型不可隐式转换为例,CHAR（实际入参类型） → INT（绑定参数类型）,VARCHAR（实际入参类型） → INT（绑定参数类型）,NCHAR（实际入参类型） → INT（绑定参数类型）,NVARCHAR（实际入参类型） → INT（绑定参数类型）,NVARCHAR2（实际入参类型） → INT（绑定参数类型）,... ...,以此类推|sql语句直接报错。情况一：数据类型之间不支持转换，在视图V$SQL_BIND_CAPTURE中查不到结果；情况二：数据类型之间支持转换，但转换数据对不上导致转换失败，在视图V$SQL_BIND_CAPTURE中能查到结果|char(64)  := 'abc'|  
|
|带绑定参数的 SQL 语句（格式、数量）|绑定参数 SQL 语句不同，实际入参类型不同/相同|1、一条sql,2、多条sql|  
|  
|1、语句不同,select * from table1 where c1 =:1 ;,select * from table1 where c2 =:1 ;,select * from table1 where c1 =:3 ;|  
|
|  
|绑定参数 SQL 语句相同，实际入参类型不同/相同|1、多条sql|  
|着重关注  CHILD_NUMBER的值，超过10条实际入参类型不同，数值应该从0开始|1、语句相同，实际入参类型不同,select * from table1 where c1 =:1 ;,select * from table1 where c1 =:1 ;,select * from table1 where c1 =:1 ;,select * from table1 where c1 =:1 ;,以上4条sql，绑定参数实际入参均不同，比如第一条sql入参varchar、第二条number、第三条char、第四条json,2、语句相同，实际入参类型相同,select * from table1 where c1 =:1 ;,select * from table1 where c1 =:1 ;,select * from table1 where c1 =:1 ;,select * from table1 where c1 =:1 ;,以上4条sql，绑定参数实际入参相同同，比如4条sql入参均为char类型|  
|


（2）部署形式

|部署形态|预期|备注|
|---|---|---|
|单机|  
|交付形态|
|分布式|拦截报错|  
|
|集群|  
|  
|


  


            2.梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式

具体测试如下：

|测试场景|分类1|分类2|预期|备注|
|---|---|---|---|---|
|对于视图和业务的并发|视图之间join并发|  
|并发过程前中后无core，无hang，无异常报错|  
|
|  
|视图join和业务并发|  
|  
|  
|
|执行业务过程/查看视图过程中，构造yasdb故障|select视图过程中|1. 查询视图的节点故障
1. 查询视图节点正常，其他节点故障
|  
|集群|
|  
|视图和业务的并发过程中|1. 校验故障恢复后视图查看正常，字段值符合逻辑即可
|  
|  
|


|系统级DFX分类|是否涉及|
|---|---|
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

[支持视图V$SQL_BIND_CAPTURE文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTQ4OTcwYzJhZjRmNTIwNTg5IiwicmVmX2lkIjoiNjczOTZiOTQ1OTNmOTljOWZmMjM2NDcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTk5LCJleHAiOjE3ODIzODE5OTl9.GZTp_jZ-rvPB5ImokcQmVJyd-hGMBH45kzW8aMbjEJ0)

# 5. 测试框架设计

1. 沿用guider框架


# 6. 测试环境说明

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


# 7. 工作量评估

工作量：10人天

计划测试完成时间：2023-10-28

附件：

[【YDBRD-8023】【视图V$SQL_BIND_CAPTURE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTU4OTcwYzJhZjRmNTIwNThhIiwicmVmX2lkIjoiNjczOTZiOTQ1OTNmOTljOWZmMjM2NDcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTk5LCJleHAiOjE3ODIzODE5OTl9.OtpBlZpOSPPIxq4pghJOknEPKdJTC-uRwiiU-O9wCwM)

## Attachments:

[【YDBRD-8023】【视图V$SQL_BIND_CAPTURE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTU4OTcwYzJhZjRmNTIwNThhIiwicmVmX2lkIjoiNjczOTZiOTQ1OTNmOTljOWZmMjM2NDcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTk5LCJleHAiOjE3ODIzODE5OTl9.OtpBlZpOSPPIxq4pghJOknEPKdJTC-uRwiiU-O9wCwM)

 (application/x-xmind)    


[image2023-5-9_11-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTVhMWFkOWEzMzExZGM4M2ZmIiwicmVmX2lkIjoiNjczOTZiOTQ1OTNmOTljOWZmMjM2NDcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTk5LCJleHAiOjE3ODIzODE5OTl9.ZdJ7LKKQpi0_vS6tzrrdEU31cu-9vtpp6W2hEO-hEYk)

 (image/png)    


[image2023-5-11_11-3-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTU4OTcwYzJhZjRmNTIwNThiIiwicmVmX2lkIjoiNjczOTZiOTQ1OTNmOTljOWZmMjM2NDcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTk5LCJleHAiOjE3ODIzODE5OTl9.FW0b1aE6xuGWkJkDUGVmCWY8lrHSRzzhmdalauFo0g8)

 (image/png)    


[支持视图V$SQL_BIND_CAPTURE文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOTQ4OTcwYzJhZjRmNTIwNTg5IiwicmVmX2lkIjoiNjczOTZiOTQ1OTNmOTljOWZmMjM2NDcyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NTk5LCJleHAiOjE3ODIzODE5OTl9.GZTp_jZ-rvPB5ImokcQmVJyd-hGMBH45kzW8aMbjEJ0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,  [【23.2】【单机】视图V$SQL_BIND_CAPTURE测试设计 - 韩晓盼 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133566261)  ,Posted by hanxiaopan at 十月 24, 2023 17:03|
|---|
