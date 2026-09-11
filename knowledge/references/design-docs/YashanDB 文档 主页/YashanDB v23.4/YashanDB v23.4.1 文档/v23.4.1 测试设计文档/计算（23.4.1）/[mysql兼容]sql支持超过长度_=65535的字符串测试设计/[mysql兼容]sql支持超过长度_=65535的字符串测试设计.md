# 1. 概述



该需求将yashan模式下的varchar/nvarchar/raw，mysql模式下的varchar/varbinary最大长度增大为65535字节



存储层开发文档：  [https://pingcode.yasdb.com/wiki/spaces/LIZIYI/pages/676137e0d2baff0fd55d0c28](https://pingcode.yasdb.com/wiki/spaces/LIZIYI/pages/676137e0d2baff0fd55d0c28)  

计算层开发文档：  [https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6788b38c02a11531a7c8d78e](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6788b38c02a11531a7c8d78e)  

# 2. 需求分析

## 2.1 功能点分析

该需求场景

1. varchar 类型：yashan已支持1~32000，  **需支持32001~65535字节**
1. raw 类型：raw已支持1~8000，  **需支持8001~65535字节**
1. varchar(n) ，raw(n) 的值大于8000的时候，存储方式为lob， 修改n的上限为65535。  **使用lob存储提升规格，对外不感知。**
1. **yashan模式**  ：varchar(65535),nvarchar(65535),raw(65535)
1. **mysql模式：**  varchar(65535),varbinary(65535)


yashan模式数据类型说明

m最大值为65535

|数据类型|说明|字符集|
|---|---|---|
|varchar(m byte)|m为字节长度， 由32000增大为65535||
|varchar(m char)|m为字符个数，存储的字节与字符集有关|GBK（一个字符占用2个字节）,UTF8（英文占一个字节，中文占三个字节）,GB18030（单字节、双字节或四字节）,ASCII（一个字符占一个字节）,ISO88591（一个字符占用一个字节）,utf16(英文中文占2个字节，少量中文四字节)|
|nvarchar(m)|m为字符个数，m个数最大值与字符集（utf16）设置有关，最大为32767||
|raw(m)|m为字节长度，由8000增大为65535||




mysql模式

![image.png](https://pingcode.yasdb.com/atlas/files/public/67b5adf5d6fcabebff225d64/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTk5NzYsImV4cCI6MTc4MjQ3MDc3Nn0.FKXqMtFbF37eFna3UtcEowrXmP37I1-JmAeAoxewpVU)

|数据类型|说明|字符集|
|---|---|---|
|varchar(n byte)|n为字节长度， 由32000增大为65535||
|~~varchar(m char)不支持~~|m为字符个数，存储的字节与字符集有关|GBK（一个字符占用2个字节）,  m 最大为32767,UTF8（英文占一个字节，中文占三个字节），m最大为21845,GB18030（单字节、双字节或四字节），m最大为16383,ASCII（一个字符占一个字节），m最大为65535,~~ISO88591（一个字符占用一个字节），m最大为65535~~|
|varbinary(n)|存储：1~8000Bytes  
运算：1~32000Bytes,此特性将存储和运算都增大为65535字节||


## 2.2 应用场景

yashan模式和mysql模式

## 2.3  约束

- raw(65535)不支持四则运算
- varchar(65535)，nvarchar(65535),raw(65535)不支持作为分区键
- 不支持在varchar(65535)，raw(65535)列上创建索引、主键、唯一键、外键
- 不支持将varchar(65535)转换成其他非lob存储的类型
- 列存建表拦截超过32000字节，执行时相关函数也会拦截
- mysql模式不支持varchar(n char)




# 3. 详细测试设计

## 3.1 测试设计方法

边界值法，组合法，场景法等

## 3.2 详细测试设计

### 3.2.1 yashan模式：

1.varchar/nvarchar/raw(65535)ddl操作

|一级模块|二级模块|有效等价类|无效等价类|
|---|---|---|---|
|表类型|heap|- 单列varchar(65535)，nvarchar(65535),raw(65535)
- 与其他数据类型组合
- 多列65535
|表列超过65535|
||~~tac（列拦截）~~|~~带字典编码~~||
||~~lsc~~|- ~~slice转换~~
- ~~压缩~~
- ~~编码~~
- ~~slice排序键~~
- ~~冷数据dml~~
- ~~导数不同模式~~
||
||分区表(65535列作为分区键，全部拦截)|- range/list/hash/interval分区
- 二级分区各种分区组合
||
||临时表|- 全局临时表
- 私有临时表
||
||外部表|||
|表对象ddl|create table (as select)|desc 查看是否正确，数据是否正确||
||alter table column|- add 65535列
- drop 65535列
||
||alter table modify col（空值，小改大不会报错，大改小报错）,|1.同类型修改,- 1.大改小：65535 修改为32000
- 2.小改大：8000修改为65535
,2.不同类型长度一致,- 65535raw修改为varchar/nvarchar
- 65535varchar/nvarchar修改为raw
,3.无（有）数据修改||
||comment on(目标列为varcar(65535))|||
|||||


2.对65535列创建索引（预期报错，索引长度不超过6k）

|一级模块|二级模块|有效等价类|无效等价类|
|---|---|---|---|
|创建索引|索引类型（一个用例覆盖）|- 普通索引
- 函数索引
- 反向索引
- 唯一索引（考虑是否有重复数据）
- 分区索引
- rtree索引
- ~~lsc（考虑冷热数据）~~
- ~~ac(只有lsc)~~
||
||~~索引个数~~|- ~~单索引~~
- ~~复合索引~~
,~~          1.与其他65535列（相同数据类型或不同数据类型）~~,~~           2.与其他数据类型组合~~||
||~~建索引的时间~~|- ~~空表建索引然后插入数据，更新数据，能走索引扫描（索引算子类型覆盖）~~
- ~~有数据后建索引~~
||
|~~修改索引~~||||
|~~删除索引~~||||


3.对65535列创建约束（raw覆盖，varchar类型优先级别较低）

|一级模块|有效等价类|无效等价类|
|---|---|---|
|主键约束||因为带索引创建会报错（create/alter）|
|唯一约束||因为带索引创建会报错（create/alter）|
|外键约束||报错（lob不支持建外键）|
|check|覆盖场景(插入满足约束和不满足约束的数据):,1. 比较运算符：=、!=、<、>、<=、>= 
1. 逻辑运算符：AND、OR、NOT
1. 模糊查询：LIKE、NOT LIKE、RLIKE、NOT RLIKE
1. 空值检查：IS NULL、IS NOT NULL
1. 范围检查：between and、in、not in、exists、not exists
1. any / all / some
||
|not null|多行null，单行null, 批插（其中有null）|插入null 报错|
|default|对应列不插入数据时观察是否为默认值||


4.执行层相关（  结果对比mysql数据库，但存储有差异，mysql实际建不了65535列，计划按mysql支持的最大字节写用例测试  ）

|模块划分|一级模块|二级模块|有效等价类|无效等价类|
|---|---|---|---|---|
|计算层（dql）|字面量|- 字面量65535字节的常量：length(cast( 字面量 as varchar(65535)))
- 65536的字面量，cast as varchar(65535) 截断
|||
||投影列|字符拼接：||、concat 结合函数|||
|||distinct |- 有重复数据
- 无重复数据
||
|||case when|||
|||四则运算（+-*/）,位运算（&|^）|||
|||bool表达式|- 与相同数据类型比较
- 与不同数据类型比较（与隐式转换测试点相同）
||
||filter条件列变量|- 比较（=、!= 或 <>、>、>=、<、<=）
- in/not in、 exists/not exists、 like/not like
- join on
|||
||group by  (having)||||
||order by||||
||connect by，cte，外部引用||||
||union/minus/intersect/except  |- 前后均为相同的65535列
- 前为varchar(65535),后为nvarchar(65535)
- 前为raw(65535),后为nvarchar(65535)
- 前为varchar(65535),后为raw(65535)
- 前为65535后为非lob（如：varchar(<8000)）均报错
|||
||函数（嘉欣提供测试函数范围，包括列存）|字符型函数,|- ifnull：
- char_length\character_length 报错
- substr\substrb\substring\substring_index
- decode
- instr、instrb
- wm_concat、concat、string_agg、group_concat/list_agg
- trim、ltrm，rtrim，nlssort
- find_in_set(expr超过32k报错)
- to_char
- coalesce
- translate using
- unistr
- MD5
- instrb
- substrb
- soundex
||
|dml操作|insert values |- 字面量65535
- 结合函数
|||
||update set 65535||||
||delete where 65535||||
||dml操作中参杂commit,rollback,truncate tb等操作||||
|特性交互|字符集|- 服务端和客户端支持以下字符集
,1.  GBK
1.  UTF8
1.  GB18030
1. ASCII
1. ISO88591
|||
||类型转换|1)隐式转换为varchar/raw(65535) 采用insert into select,- 数值型tinyint,smallint,int,bigint,number,float,double,bit
- 时间类型：date,timestamp,ym_interval,ds_interval,time
- 布尔型：boolean
- 大对象型：clob,blob,nclob,xmltype,raw,json,
- 其他：rowid,urowid
,2）cast转换为varchar/raw(65535),3）varchar/raw(65535)转换为除lob类型的其他类型均报错|||
||存储过程||||
|||内置高级包|dbms_metadata.get_ddl (数据类型正确),dbms_lob.compare,dbms_lob.get_length\getlength,dbms_lob.substr\substr,dbms_output.put_line||
|||procedure|- in/out/in out 为65535
- default 为65535
- 结合变量
||
|||udf|- in/out/in out 为65535
- default 为65535
- return为65535
- 结合变量
||
|||udt|- ddl（create）
- dml(insert,update,delete)
- dql简单查询
||
|||udp|同procedure,udf||
|||结合游标，引用变量，record，varray等|||
||绑定参数|using in/out/in out 65535变量|||
||视图|动态视图，all/user/dba视图：,- all_tab_cols(data_type,data_length)
- USER_TAB_COLS(data_type,data_length)
- dba_tab_cols(data_type,data_length)
- v$datatype变化：MAX_SIZE为65535 （之前VARCHAR是8000，RAW是2000）
|与表信息一致||
|||- 用户视图
- 物化视图
|- desc
- 简单的dql
||
||同义词|创建、使用、删除、desc|简单使用dql||
||导数工具|yasload：basic，batch，分区表,exp/imp元数据导入导出工具,外部表|表：字段内容null，不同字节，null,特殊字符，空串,视图：用户视图，物化视图,同义词,load data,||
||dblink|dml,dql,同义词，存储过程，导入导出等，修改字符集|远端为yashan场景||
||数据库升级|版本升级后，使用dbms_output正常输出入参为65535字符串函数|||
||大数据量|宽表（1000列65535）插入100w行|||
||批量，并行||||


### 3.2.2 mysql模式：

```
alter session set compat_vector=mysql;
```

|一级模块|有效等价|无效等价|
|---|---|---|
|varchar(n)、varbinary(n)|- n为65535，8001
- 单列
- 多列
,         1.相同数据类型,         2.与其他数据类型组合|65536|
|设置不同字符集|||
|mysql兼容相关的函数(参考yashan需要测试的函数)|||
|其他测试复用yashan模式的用例，可能部分场景不支持|||






## 3.3 专项

|系统级DFX分类|是否涉及|
|---|---|
|CT|基本并发测试，ddl,dml|
|KT|基本并发测试，ddl,dml|
|长稳|长稳添加65535字段的数据类型，涉及ddl，dml等|
|一致性|该特性字符型数据类型存储字节增大，与一致性测试关系不大|
|三方测试工具  
(sqltest，sqlancer)|不涉及sql层面|
|安全|不涉及密码和权限等安全性相关因素|
|DFR|与kill数据库操作关系不大，不考虑|
|HA|该特性字符型数据类型存储字节增大，与HA测试关系不大|
|压力|此次测试不考虑压力测试，只维护基本功能|
|性能|不考虑相关性能测试|
|可维护性|没有增加相关代码，不考虑测试|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；




# 5. 测试框架设计

YTP

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

参考文档

  [https://conf.yasdb.com/pages/viewpage.action?pageId=144145412](https://conf.yasdb.com/pages/viewpage.action?pageId=144145412)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=141570379](https://conf.yasdb.com/pages/viewpage.action?pageId=141570379)  

字符集相关：  [https://conf.yasdb.com/pages/viewpage.action?pageId=159429937](https://conf.yasdb.com/pages/viewpage.action?pageId=159429937)  