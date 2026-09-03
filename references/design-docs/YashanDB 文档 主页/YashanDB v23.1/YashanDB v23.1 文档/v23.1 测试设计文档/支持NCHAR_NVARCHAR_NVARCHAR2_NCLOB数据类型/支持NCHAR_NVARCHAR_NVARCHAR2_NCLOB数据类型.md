Created by 刘晓芳, last modified on 八月 02, 2023

# **1. 概述**

本文描述nchar/nvarchar/nvarchar2/nclob数据类型的测试设计；  nchar是一种可变长度的Unicode字符集，可以存储多语言字符数据。和char类型不同，nchar数据类型以Unicode字符为单位进行存储，每个字符使用2个字节进行编码

Oracle文档：

开发设计：    [YDBRD-4263：支持NCHAR/NVARCHAR/NVARCHAR2/NCLOB数据类型 设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=109585432)  

SR：       [YDBRD-4263](https://jira.yasdb.com/browse/YDBRD-4263?src=confmacro)    -  支持NCHAR/NVARCHAR/NVARCHAR2/NCLOB数据类型  完成

# **2. 需求分析**

## 2.1语法

create table t1 (c1 nvarchar(4000),c2 nchar(4000),c3 nvarchar2(4000),c4 nclob);

## 2.2 功能描述

1. 支持数据库的ddl、dml、dql操作；
1. nchar最大长度可以插入4000个字符，nvarchar/nvarchar2支持最大长度可以插入16000个字符，nclob最大可以到（行：4G字节，列：32000字节）；
1. 支持数据的隐式转换（char/varchar支持的场景，都支持）；返回规则：
    1. 内置函数有规格返回数据类型的，还是按照规定数据类型返回；
    1. 其他拼接，内置函数传参等场景，返回规则按照：  nclob > nvarchar > nchar > clob >varchar > char >其他数据类型    的优先级进行转换；
1. 适配内置函数：比如concat、length、substr等函数，规格和限制与char/varchar对齐；-  -拼接函数不通过数据类型，不同单位拼接，需要关注长度和返回类型是否正确
1. 默认UTF16 le编码，可以通过配置参数  NLS_CHARACTER_SET（新增配置参数，需要增加拦截，当前未拦截）  在yasdb.ini中设置（全库修改），或者通过  create database test national character set utf16/utf8修改；show parameter NLS_CHARACTER_SET;显示当前国家字符集设置；
1. nchar/nvarchar列支持所有列约束，支持作为分区键；nclob不支持建立除了not null，check以外的其他列约束，不支持作为分区键；
1. 适配导入导出工具（  utf-8编码csv文件导入nchar/nvarchar列中  ）  大端数据导入到nchar/nvarchar数据类型  ；适配所有驱动（C驱动，  ODBC驱动，python驱动 – 没有做修改，需要覆盖下基本功能不会出现异常，CORE，正常报错拦截  ）；
1. 适配plsql；
1. ---列23.1不交付，只交付行表


  


其他数据类型转换成nchar/nvarchar/nvarchar2:

|  
|NCHAR/NVARCHAR|NCLOB|
|---|---|---|
|TINYINT|✓|✓|
|SMALLINT|✓|✓|
|INT|✓|✓|
|BIGINT|✓|✓|
|NUMBER|✓|✓|
|FLOAT|✓|✓|
|DOUBLE|✓|✓|
|CHAR/VARCHAR|✓|✓|
|DATE|✓|X|
|TIMESTAMP|✓|X|
|YM_INTERVAL|✓|X|
|DS_INTERVAL|✓|X|
|TIME|✓|X|
|BOOLEAN|✓|X|
|CLOB|✓|✓|
|BLOB|✓|X|
|BIT|✓|X|
|RAW|✓|X|
|JSON|✓|✓|
|ROWID/UROWID|✓|X|


nchar/nvarchar/nvarchar2转换成其他数据类型：

|  
|TINYINT|SMALLINT|INT|BIGINT|NUMBER|FLOAT|DOUBLE|CHAR/VARCHAR|DATE|TIMESTAMP|YM_INTERVAL|DS_INTERVAL|TIME|BOOLEAN|CLOB|BLOB|BIT|RAW|JSON|ROWID/UROWID|NCLOB|HAR/NVARCHAR|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|NCHAR/NVARCHAR|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|✓|NA|
|NCLOB|✓|✓|✓|✓|✓|✓|✓|✓|X|X|X|X|X|X|✓|X|X|X|✓|X|NA|✓|


## 2.3 规格限制

同char/varchar/clob的限制，

**1、当前版本不支持char/varchar列与nchar/nvarchar列之间的通过alter相互转换（与Oracle有差异），这个当前版本记录规格，作为遗留问题，后续转需求落地；  — 20230719**

  


  


**3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

  


**3.1、功能测试：**

3.1.1、基本操作：

|t测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|---|:---|:---|:---|:---|
|nchar/nvarchar/nvarchar2/nclob    
    
    
|关键字校验    
    
    
|大小写|建表时，数据类型名称覆盖小写、大写；|建表成功，desc table信息显示正确|/|/|
|||同名|1、建表时，列名称 与列数据类型名称相同,2、列名与数据类型名交叉覆盖：nchar nvarchar(1000)等|建表成功，desc table信息显示正确|/|/|
|||拼写错误|/|/|建表时，nchar/nvarchar/nvarchar2/nclob拼写错误|报错信息明确|
|||size|省略，不设置size|默认为1|TODO：是否需要需要兼容|  
|
|||其他|/|/|1、nchar/nvarchar/nvarchar2指定长度时，n输入其他数值类型,2、指定列数据类型时，重复指定数据类型：c1 nchar nchar(xx)，nchar(nchar(xx)),3、nchar/nvarchar/nvarchar2指定长度为空，nclob指定长度，不带括号，带多个括号|报错信息明确|
||||1、创建视图，与nchar/nvarchar/nvarchar2/nclob同名,2、建表，与nchar/nvarchar/nvarchar2/nclob同名|？|/|/|
|nchar,  
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|普通表,视图：,DBA_DEPENDENCIES,DBA_OBJECTS,DBA_TAB_COLS,DBA_TAB_COLUMNS,  
,  
    
    
|单列|1. create table A指定单列nchar，nchar长度覆盖1、2000、4000；
1. insert数据等于nchar指定长度：    

    1. 英文字符串；
    1. 中文字符、韩文、其他特殊语言（参考unicode字符）；
    1. 特殊字符、不可见字符；
    1. 表情包；
    1. null
    1. 空字符串：‘ ’，‘’
1. insert数据小于nchar指定长度：
    1. 英文字符串；
    1. 中文字符、韩文、其他特殊语言（参考unicode字符）；
    1. 特殊字符、不可见字符；
    1. 表情包；
    1. null
    1. 空字符串：‘ ’，‘’
1. create table B / view B as select * from table A；
1. create table b / view B as  select nchar列 from table A；
|1、建表成功，desc表，列数据类型显示nchar，长度显示指定长度；,2、所有数据类型都能正常插入，不会报错；select * ，select nchar列，select length/lengthb都可以正常查询，显示正确；,3、结果与2相同（自动补空）；,4、创建表B/视图B成功，desc表列显示nchar，长度显示指定长度，select 表结果显示正确；,5、预期结果同4；,  
|1、create table指定单列nchar，nchar长度覆盖负数、0、4001,2、create table指定单列nchar，nchar长度覆盖小数、科学计数法,3、create table指定单列nchar，nchar长度覆盖字符串数字：‘1’、‘4000’等,4、nchar指定长度带byte、char、B、b单位,5、inser数据：大于nchar数据列指定的长度|1、报错，提示nchar指定长度必须在1-4000之间,2、报错同1,3、报错同1,4、报错，提示长度单位不对,5、报错，提示插入数据超过指定长度|
|||多列|1、creat table A指定多列nchar列，nchar长度分别覆盖1、4000、及中间值；,2、插入数据，覆盖英文字符串、中文字符串、特殊字符、表情包；,3、插入多行数据，其中1行某1列超过nchar的指定长度；,4、create table B / view B as select * from table A,5、create table b / view B as  select nchar列 from table A|1、建表成功，desc表，列数据类型显示nchar，长度显示指定长度；,2、数据能正常插入，select表回显正确；,3、超过长度的一行数据无法插入，其他行可以正常插入；select查询数据显示正确,4、创建表B/视图B成功，desc表列显示nchar，长度显示指定长度，select 表结果显示正确；,5、预期结果同4；,  
|/|/|
|||混合列|1、create table A，列数据类型覆盖数据库支持的所有数据类型：整型、浮点型、日期型、大对象、布尔型、字符型、nchar；覆盖nchar在第1、中间、最后列；,2、insert插入数据；|1、建表成功；desc表，列数据类型显示正确；,2、insert数据成功，select表查询数据显示正确；length/lengthb指定nchar列/非nchar列，中间列现实正确；|/|/|
|||列规格|1、create table A，指定4096列nchar列，nchar长度覆盖边界值；,2、insert 插入大量数据（100W）？|1、建表成功；desc表，列数据类型显示正确；,2、insert数据成功，select * 数据显示正确；,3、select 4096列nchar列，显示正确；|select 大于4096列nchar列|报错提示投影列超过4096列|
||分区表,视图：,DBA_TAB_PARTITIONS,DBA_LOB_PARTITIONS,  
,  
,  
    
    
|range分区|range分区键：,1. 指定单列nchar列；插入数据符合分区value要求
1. 指定多列ncharl列；插入数据符合分区value要求；
1. 指定nchar列与其他数据列；插入数据符合分区value要求
|1、分区创建成功，数据插入成功；,2、查询分区视图，显示正确；,3、查询dbms_metadata.get_ddl高级包显示正确|未指定maxvalues时，插入数据超过分区value值|报错，提示正确|
|||interval分区|interval分区：  --不支持nchar列作为分区键，报错拦截,1、指定nchar列为range分区键，指定interval值；,2、插入数据超过分区values值；|1、分区建立成功；,2、触发自动扩展分区，查询分区视图，信息显示正确|/|/|
|||list分区|list分区：,1. 指定单列nchar列；插入数据符合分区value要求；
1. 指定多列ncharl列；插入数据符合分区value要求；
1. 指定nchar列与其他数据列；插入数据符合分区value要求
|同range分区|同range分区|同range分区|
|||hash分区|hash分区：,1. 指定单列nchar列；插入数据符合分区value要求；
1. 指定多列ncharl列；插入数据符合分区value要求；
1. 指定nchar列与其他数据列；插入数据符合分区value要求
|同range分区|同range分区|同range分区|
|||二级分区|覆盖9种二级分区场景：,range-range、range-hash、range-list、list-range、list-hash、list-list、hash-range、hash-list、hash-hash|**覆盖基本场景即可，优先级放低，后面再补充（0719）**|  
|  
|
|||  
|分区键覆盖：,1、nchar/nvarchar数据之间两两组合；,2、nchar/nvarchar与其他数据类型之间两两组合|  
|分区键包含nclob列|  
|
||alter表    
    
    
    
    
    
    
|其他数据类型转换成nchar|alter table xxx modify:（空表）：,1. 建表，列数据类型覆盖（数值型、日期型、大对象、布尔型、浮点型）；不插入数据，alter table modify 将每1列都转换成nchar列，nchar列长度覆盖规格边界值；
1. 建表，列数据类型覆盖（char/varchar/varchar2），不插入数据，alter modify将每1列数据类型转成nchar，nchar指定长度小于原数据列的指定长度；
1. 建表，列数据类型覆盖（char/varchar/varchar2），不插入数据，通过alter modify修改每1列数据类型为nchar，nchar指定长度等于原数据列的指定长度；
1. 建表，列数据类型覆盖（char/varchar/varchar2），不插入数据，通过alter modify修改每1列数据类型为nchar，nchar指定长度大于原数据列的指定长度；
|1、修改列类型成功；desc表/select typeof，列显示nchar类型；select 查询表数据显示正确，length/lengthb显示正确；|/|/|
||||alter table xxx modify:（表有数据）：  ---会报错拦截,1. 建表，列数据类型覆盖（数值型、日期型、大对象、布尔型、浮点型），插入数据，通过alter modify修改列数据类型为nchar，且指定长度等于/大于表数据的长度；
1. 建表，列数据类型覆盖（char/varchar）,插入数据，通过alter modify修改列数据类型为nchar，且指定长度等于/大于cha/varchar指定的长度；
1. 建表，列数据类型覆盖（char/varchar, n char单位）,插入数据，通过alter modify修改列数据类型为nchar，且指定长度等于/大于cha/varchar指定的长度；
|1、修改列类型成功；desc表/select typeof，列显示nchar类型；select 查询表数据显示正确，length/lengthb显示正确；,2、预期结果同1；|1、建表，列数据类型覆盖（数值型、日期型、大对象、布尔型、浮点型），插入数据，通过alter modify修改列数据类型为nchar，且指定长度小于表数据的长度；,2、建表，列数据类型覆盖（char/varchar）,插入数据，通过alter modify修改列数据类型为nchar，且指定长度大于数据长度且小于cha/varchar指定的长度；|报错，提示正确|
|||nchar转换成其他数据类型|alter table xxx modify:（空表）：,1. 建表，列数据类型为nchar，nchar列长度覆盖规格边界值；不插入数据，alter table modify 将列转换成：数值型/大对象/布尔型/日期型；
1. 建表，列数据类型为nchar，nchar列长度覆盖规格边界值；不插入数据，alter table modify 将列转换成char/varchar/varchar2,且字符指定长度小于/等于/大于nchar指定长度；
1. 建表，列数据类型为nchar，nchar列长度覆盖规格边界值；不插入数据，alter table modify 将列转换成char（x char）/varchar（x char）/varchar2（x char）
|1、修改列类型成功；desc表/select typeof，列显示nchar类型；select 查询表数据显示正确，length/lengthb显示正确；,2、预期结果同1；,3、能正常转换？|/|/|
||||alter table xxx modify:（表有数据）：  ---会报错拦截,1. 建表，列数据类型为nchar，nchar列长度覆盖规格边界值；插入数据，alter table modify 将列转换成：数值型/大对象/布尔型/日期型；
1. 建表，列数据类型覆盖（char/varchar）,插入数据，通过alter modify修改列数据类型为nchar，且指定长度等于/大于cha/varchar指定的长度；
1. 建表，列数据类型为nchar，nchar列长度覆盖规格边界值；插入数据，alter table modify 将列转换成char（x char）/varchar（x char）/varchar2（x char）
|1、修改列类型成功；desc表/select typeof，列显示nchar类型；select 查询表数据显示正确，length/lengthb显示正确；,2、预期结果同1；,3、能正常转换？|1、建表，列数据类型为nchar，插入数字型字符串，超过tinyint\smallint\int\float\double\bigint\number的最小边界值和最大边界值，alter table 将nchar列改成tinyint\smallint\int\float\double\bigint\number,2、建表，列数据类型为nchar，插入数据，不符合日期转换格式，alter table将列转成日期型数据,3、同覆盖json、布尔型|报错，提示string格式转换失败|
|||nchar长度变更|alter table xxx modify:（空表）,1、建表，列数据类型为nchar(n)，alter table midify nchar(m),覆盖m小于、等于、大于n；,2、建表，列数据类型为nchar(n)，alter table midify改成nvarchar(m)/nvarchar2(m),覆盖m小于、等于、大于n；,3、建表，列数据类型为nchar(n)，alter table midify改成nclob,  
|1、修改列类型成功；desc表/select typeof，列显示nchar类型；select 查询表数据显示正确，length/lengthb显示正确；,2、预期结果同1；|/|/|
|||  
|alter table xxx modify:（带数据）：,1、建表，列数据类型为nchar(n)，插入数据，alter table midify nchar(m),覆盖等于、大于n；,  
|1、修改列类型成功；desc表/select typeof，列显示nchar类型；select 查询表数据显示正确，length/lengthb显示正确；,2、预期结果同1；|1、建表，列数据类型为nchar(n)，插入数据，alter table midify nchar(m),覆盖m小于n;,2、建表，列数据类型为nchar(n)，alter table midify改成nvarchar(m)/nvarchar2(m),覆盖m小于n；,2、建表，列数据类型为nchar(n)，alter table midify改成nvarchar(m)/nvarchar2(m),覆盖m等于、大于n；,3、建表，列数据类型为nchar(n)，alter table midify改成nclob,  
|报错，提示正确|
|||新增nchar列|alter table add xxx：,1、新增nchar列，指定长度覆盖边界值；指定新增列插入数据；,2、新增nchar列，带默认值；列位置覆盖第一列、中间列，最后一列；|1、新增列成功，desc表，新增列显示nchar，插入数据成功，可以正常查询,2、新增列成功，查询新增列的值，显示默认值|1、新增nchar列，列的长度小于1、大于4000|报错，提示正确|
|||删除nchar列|alter table drop xxx：,1、空表删除第1列、中间列，最后一列；,2、带数据后，删除指定列；|1、删除成功，desc table列信息显示正确；,2、预期结果同1|/|/|
||update 表|更新nchar列数据|update table set xxx ='':,1、建表列数据类型为nchar(m)，插入数据；update 该列数据，更新数据长度小于\等于m;,2、建表包含多列nchar列，update同时更新（逗号,隔开）多列nchar数据，更新数据长度小于\等于nchar指定长度；,3、建表指定nchar列带默认值，update更新nchar列数据为null或者空‘’|1、数据更新成功，select查询表数据显示更新后数据，length/lengthb查询更新列数据，显示正确；,2、预期结果同1；,3、更新后，nchar列显示默认值？？？|1、建表列数据类型为nchar(m)，插入数据；update 该列数据，更新数据长度大于m;,2、建表包含多列nchar列，update同时更新（逗号,隔开）多列nchar数据，其中1列/多列更新数据长度大于nchar长度；|1、报错，提示字符过长；,2、提示正确，报错位置为第1次报错的列位置|
||删除表    
    
|delete|1、建表带nchar/nvarchar/varchar2/nclob及其他数据类型，字符类型列长度指定覆盖边界值，不插入数据，delete table；,2、步骤1完成后，插入数据，字符列的数据长度覆盖边界值，delete table,3、插入大量数据（100W行？），delete table|1、delete table成功，desc table列信息显示正确，select table回显为空,2、预计结果同1,3、预期结果同1|/|/|
|||truncate|1、建表带nchar/nvarchar/varchar2/nclob及其他数据类型，字符类型列长度指定覆盖边界值，不插入数据，truncate table；,2、步骤1完成后，插入数据，字符列的数据长度覆盖边界值，truncate table,3、插入大量数据（100W行？），truncate table|1、truncate table成功，desc table列信息显示正确，select table回显为空,2、预计结果同1,3、预期结果同1|/|/|
|||drop|1、建表带nchar/nvarchar/varchar2/nclob及其他数据类型，字符类型列长度指定覆盖边界值，不插入数据，drop table；,2、步骤1完成后，插入数据，字符列的数据长度覆盖边界值，drop table,3、建表4096列nchar/nvarchar/varchar2/nclob，不插入数据，drop table,4、建表4096列nchar/nvarchar/varchar2/nclob，插入数据，drop table|1、drop成功，desc table报错提示表不存在,2、预期结果同1,3、预期结果同1,4、预期结果同1|/|/|
||列约束,视图：,DBA_CONSTRAINTS,DBA_CONS_COLUMNS,  
    
    
    
    
    
    
    
    
    
    
    
|列内约束|default value:,1. nchar列默认值覆盖数值型：整数、科学计数法、浮点数；
1. nchar列默认值覆盖字符型：字符串数字（’1.02‘）、特殊字符、中文、表情包；
1. nchar列默认值覆布尔型型：true/false，TRUE/FALSE
1. nchar列默认值覆大对象型：json标准数据型(字符串、数组，对象、布尔等)、二进制、16进制数据
1. nchar列默认值为空：null/NULL、’‘、'""','   ','"    "'
1. nchar列默认值覆盖日期型：date、time、timestamp等格式的字符串
|1、建表成功，desc table列信息显示正确，指定不带默认值的列插入数据，select 查询表数据显示正确；,2、指定带默认值的列插入数据，select 查询表数据显示正确；|nchar列默认值覆盖:"","  " |报错提示数据类不正确|
|||  
|unique:,1. 建表，指定nchar列带unique；
1. 插入不重复数据；
1. alter table drop删除nchar列的unique约束；
1. 插入重复数据；
1. alter table add 给nchar列新增unique约束
1. 插入重复数据；
1. alter table add给表其他nchar列新增unique约束；
|1、建表成功；desc table ，显示正确,2、插入数据成功|1. 建表，指定nchar列带unique；
1. 插入重复数据；
|报错，提示数据违反unique约束|
|||  
|primary:,1、建表，指定nchar列带primary；插入数据；,2、alter table drop 删除nchar列的primary约束；,3、alter table add 给nchar增加primary约束；,  
|1、建表成功，插入数据成功，desc table，select table数据显示正确；,2、删除列的primary key约束成功；,3、新增列的primary key约束成功；|1、建表，同时指定2个及以上的nchar列带primary key约束；,2、建表时，只有1个nchar列带primary key约束，alter table add新增其他列带primary key约束|报错，提示已经存在primary key|
|||  
|foregin key:,1、子表nchar列（无数据）关联父表nchar列；往子表插入数据；,2、子表nchar列（带数据）关联附表nchar列（包含子表数据），删除父表nchar列的某一行数据；,  
|1、建立foreign key成功，插入数据成功，desc table，查询数据正确；,2、删除成功，查询子表关联的数据也删除；|1、子表nchar列关联父表primary key列（非nchar数据类型列）；,2、子表nchar列关联父表非primary key列（nchar列）；,3、子表nchar列带数据，关联父表nchar列（不报含子表数据）；|报错，提示正确|
|||  
|check: nchar列覆盖not null；check nchar列非空，长度等限制,  
|nchar列约束创建成功，desc table显示列信息正确；|/|/|
|||列外约束|unique: constraint Cname unique(xxx),测试步骤同列内约束|预期结果同列内约束|/|/|
|||  
|primary：constraint Cname primary (xxx),测试步骤同列内约束|预期结果同列内约束|/|/|
|||  
|check|  
|/|/|
|||index,视图：,DBA_IND_COLUMNS,DBA_IND_EXPRESSIONS,DBA_IND_PARTITIONS|单索引：,1、create index on nchar列;,2、create unique index on nchar 列；通过alter table add uninque/primary key（nchar列） using index,3、索引长度边界（6000字节）|1、建立索引成功；,2、预期同1，查看索引视图，显示正确，使用高级包dbms_metadata查询表显示正确|在定义超过6000字节的列上创建索引|报错提示超过索引长度6000|
|||  
|组合索引：,1. nchar列与其他列组合
1. nchar列与nvarchar/nclob组合
|  
|/|/|
|||  
|反向索引：REVERSE|  
|/|/|
|||  
|函数索引,1. nchar列与其他列结合运算符/拼接符
1. nchar列与其他列结合表达式
1. nchar列结合字符函数，拼接函数
|  
|/|/|
|||  
|分区索引：,1、range分区键为nchar列，创建分区索引；,2、list分区键为nchar列，创建分区索引；,3、hash分区键nchar列，创建分区索引；,4、建立分区索引指定local,5、interval分区带local，插入数据触发自动扩展分区|1、分区索引创建成功，查询分区视图显示正确；,2、高级包dbms_metadata查询表显示正确|/|/|
|||tablespace|指定表存储空间|  
|  
|  
|
|nvarchar/nvarchar2    
    
|基本功能|/|复用nchar相关的所有测试点|预期结果同nchar|/|/|
||差异点|/|1. 建表nchar/nvarchar指定长度n时，插入的数据小于n，使用length/lengthb查询
|nchar/nvarchar/nvarchar2显示的长度不一样；nchar会自动补空位，直到有n个字符；|/|  
|
|||  
|2、nvarchar/nvarchar2的最大长度是16000，需要覆盖8000、16000、16001个字符的规格(英文字母、中文、特殊字符等)|  
|  
|  
|
|||**alter 变更**|**沿用varchar字符串扩展32000字节的存储逻辑及限制，待补充用例**|  
|  
|  
|
|||分区键|**在nchar的基础上，需要涵盖nvarchar/nchar/nclob之间的分区键组合**|  
|  
|  
|
|nclob    
    
    
    
    
    
|普通表    
    
|/|建表基本语法同nchar测试点|/|建表基本语法同nchar测试点|/|
|||差异点|nclob指支持与json，varchar/char/varchar2/nchar/nvarchar/nvarchar2进行隐式转换|  
|/|/|
|||  
|nclob规格覆盖：,1、单列插入数据超过4G；查询、删除；  ---最后测试，性能差需要时间比较久,2、插入常量32K字符串到nclob；,3、update nclob列数据超过32K（常量）；,4、nclob列默认值为32K字符串；|数据能正常插入，查询，删除|单列插入数据超过4G+1|/|
||分区表|/|/|/|分区覆盖：range\list\hash\interval|报错，提示nclob列不能创建分区|
||列约束|列内约束|not null ,check|  
|其他列约束报错：unique\primary key\foreign key|报错，提示nclob列不能创建unique/primary key等|
|||列外约束|not null ,check|  
|其他列约束报错：同上|报错，提示nclob列不能创建unique/primary key等|
||index|/|/|/|创建索引：普通索引、唯一索引、分区索引|报错，提示nclob列不能创建索引|
|表类型    
    
    
    
|全局临时表|/|1. 创建全局临时表，带nchar/nvarchar/nclob列；
1. 创建私有临时表，带nchar/nvarchar/nclob列；
|  
|  
|  
|
||嵌套表|/|  
|  
|  
|  
|
||单机表|/|覆盖：,1. 单机heap表；
1. 单机tac表； ---  不支持，拦截报错
1. 单机lsc表（指定排序键，覆盖默认，指定） --  不支持，拦截报错
|  
|  
|  
|
||分布式表（  不支持  ）|分布表|1、创建分布表，带nchar/nvarchar/nvarchar2/nclob列，nchar/nvarchar/nvarchar2/nclob列不是分布键;,2、创建分布表，带nchar/nvarchar/nvarchar2列（非第一列），指定带nchar/nvarchar/nvarchar2列为分布键；|1、建表成功，desc table显示正确，查看分布键显示正确；,2、预期结果同1；|1、创建分布表，带nchar/nvarchar/nvarchar2/nclob列，nclob列为第一列；,2、、创建分布表，带nchar/nvarchar/nvarchar2/nclob列（非第1列），指定nclob为分布键|报错，提示nclob不能作为分布键|
|||复制表|创建复制表，带nchar/nvarchar/nvarchar2/nclob列，列位置覆盖第1列，最后1列；|建表成功，desc table显示正确|/|/|


  


3.1.2、隐式转换

|前置条件|测试场景|预期结果|无效等价类|预期结果|
|---|---|---|---|---|
|建表指定nchar/nvarchar/nvarchar2/nclob列|nchar/nvarchar/nvarchar2插入数据（通过cast/select 子查询）：,1、数值型：tinyint,smallint,int,float,double,bigint,number,2、字符型：char/varchar/varchar2;  指定长度单位覆盖n byte、n char,3、布尔型,4、日期型：date、time、timestamp、  INTERVAL YEAR TO MONTH，INTERVAL DAY TO SECOND,5、大对象：json、clob、blob、nclob、raw、rowid/urowid、bit,nclob插入数据（通过cast/select 子查询）：,1、字符型：char/varchar/varchar2;指定长度单位覆盖n byte、n char；nchar/nvarchar/nvarchar2,2、json数据|可以正常插入数据，select */列数据显示正确，length/lengthb显示正确|nclob插入数据（通过cast/select 子查询）：,1、数值型：tinyint,smallint,int,float,double,bigint,number,2、布尔型,3、日期型：date、time、timestamp、  INTERVAL YEAR TO MONTH，INTERVAL DAY TO SECOND,4、大对象：blob、raw、rowid/urowid、bit|报错，提示数值转换错误|
|alter  table add新增其他数据类型的列|新增数值型、字符型（n byte、n char单位）、布尔型、大对象(json，clob)：,1、通过cast/select 子查询将nchar/nvarchar/nvarchar2/nclob数据插入新增列；,新增大对象（blob、raw、rowid/urowid、bit）、日期型:,1、通过cast/select 子查询将nchar/nvarchar/nvarchar2数据插入新增列；|可以正常插入数据，select */列数据显示正确，length/lengthb显示正确|新增大对象（blob、raw、rowid/urowid、bit）、日期型:,1、通过cast/select 子查询将nclob数据插入新增列；|报错，提示数值转换错误|
|其他|通过 ||等进行拼接，覆盖：,1、nchar/nvarchar/nclob之间组合拼接,2、nchar/nvarchar/nclob与其他数据类型之间的组合拼接,3、需要观察返回值、长度，类型是否正确,4、merge into|  
|  
|  
|


  


  


**3.2、函数测试：**

  [nchar 与内置函数结合](https://conf.yasdb.com/pages/viewpage.action?pageId=109597239)  

  [23.1版本LOB类型各函数支持情况](https://conf.yasdb.com/pages/viewpage.action?pageId=112722256)  

重点测试函数：cast、lengthb/length、substr、replace、concat、upper

观察点：1、查询长度函数，需要关注长度；

               2、拼接函数，需要覆盖nchar/nvarchar/nclob与其他数据类型的拼接，并且查看返回值的数据类型？拼接后的长度？

               3、查找位置函数（字符，字节）查找，能正常查找；

               4、需要覆盖传入参数的最大值，最小值；

  


**3.3、场景测试：**

|场景|输入条件1|输入条件2|备注|无效等价类|备注|  
|
|---|---|---|---|---|---|---|
|DML|update|set、where覆盖左值和右值|/|/|/|  
|
||delete|where覆盖左值和右值|/|/|/|  
|
|DQL投影列|/|常量、变量、常量+变量|/|/|/|  
|
|DQL Filter    
    
    
    
    
    
|操作符|覆盖nchar/nvarchar/nvarchar2/nclob|  
|/|/|  
|
||in/not in|覆盖nchar/nvarchar/nvarchar2/|  
|覆盖nclob列|报错提示不支持|  
|
||exists/not exists|覆盖nchar/nvarchar/nvarchar2/|  
|覆盖nclob列|报错提示不支持|  
|
||between and|覆盖nchar/nvarchar/nvarchar2/|  
|覆盖nclob列|报错提示不支持|  
|
||like/not like|覆盖nchar/nvarchar/nvarchar2/|  
|覆盖nclob列|报错提示不支持|  
|
||is null/is not null   |覆盖nchar/nvarchar/nvarchar2/|  
|覆盖nclob列|报错提示不支持|  
|
||dstinct|覆盖nchar/nvarchar/nvarchar2/nclob|  
|/|/|  
|
|DQL 算子    
    
    
    
|order by|覆盖nchar/nvarchar/nvarchar2/|  
|覆盖nclob列|报错提示不支持|  
|
||group by|同上|  
|同上|报错提示不支持|  
|
||group by...having|同上|  
|同上|报错提示不支持|  
|
||join on|同上|  
|同上|报错提示不支持|  
|
||join级联查询，覆盖各种级联查询，多表级联|  
|  
|  
|  
|  
|
||connect...by|同上|  
|同上|报错提示不支持|  
|
|子查询    
    
    
    
    
    
    
|from 子查询|覆盖nchar/nvarchar/nvarchar2/nclob|  
|/|/|  
|
||having子查询|覆盖nchar/nvarchar/nvarchar2|  
|覆盖nclob列|报错提示不支持|  
|
||select子查询|同上|  
|同上|报错提示不支持|  
|
||exists子查询|同上|  
|同上|报错提示不支持|  
|
||in子查询|同上|  
|同上|报错提示不支持|  
|
||any子查询|同上|  
|同上|报错提示不支持|  
|
||some子查询|同上|  
|同上|报错提示不支持|  
|
||all子查询|同上|  
|同上|报错提示不支持|  
|
|运算|*、/、mod、%、+、-、|覆盖nchar/nvarchar/nvarchar2|  
|覆盖nclob列|报错提示不支持|  
|


  


其他补充：2023/7/26

1、建6000张表，带nchar/nvarchar/nclob，插入数据，导入导出

2、insert all 来插入数据；

  


**3.4、适配测试**

3.4.1、plsql适配 ----   **张欣，需要全量覆盖**

|plsql对象|输入条件2|备注|无效等价类|备注|  
|
|---|---|---|---|---|---|
|udp|nchar/nvarchar/nvarchar2/nclob:,1、变量申明；,2、对申明的变量做赋值、拼接运算操作,3、udp内置存储过程、自定义函数的入参|  
|1、声明nclob变量，赋值日期型数据类型值；,2、定位others exception分支捕获异常|异常能正常捕获|  
|
|udf|nchar/nvarchar/nvarchar2/nclob:,1、变量申明；,2、对申明赋值、拼接运算操作,3、udf 入参，覆盖in\out\in out,4、作为udf return值|  
|同上|同上|  
|
|procedure|nchar/nvarchar/nvarchar2/nclob:,1、变量申明；,2、对申明赋值、拼接运算操作|  
|同上|同上|  
,  
|
|udt|nchar/nvarchar/nvarchar2/nclob:,1、udt数据类型申明；,2、基于步骤1，创建udt varray_type、object_type,3、基于步骤1，创建子udt类型，也申明nchar/nvarchar/nvarchar2/nclob类型|  
|/|/|  
|
|匿名块|nchar/nvarchar/nvarchar2/nclob:,1、变量申明；,2、对申明赋值、拼接运算操作|  
|同上|同上|  
|
|trigger|nchar/nvarchar/nvarchar2/nclob:,1、建表包含上述数据类型；在列上创建trigger；,2、做相应操作，触发trigger,3、创建自治触发器|  
|/|/|  
|
|变量窥视|  
|  
|  
|  
|  
|


**TODO：测试点**  ：

1、出入参覆盖隐式转换

2、显示游标的出入参（变量窥视）

3、udt的成员类型

4、出入参的长度扩展场景，比如传参10字节varcahr，传到plsql赋值给nvarcahr，会变成10字符；

5、table function将udt展开成完整的表，与普通链接操作；

补充用例：    [PL/SQL中支持nchar/nvarchar/nvarchar2/nclob](https://conf.yasdb.com/pages/viewpage.action?pageId=119555691)  

  


  


3.4.2、导入导出

|前置条件|导入导出|检查点|
|---|---|---|
|1、建表包含nchar/nvarchar/nvarchar2/nclob列，长度覆盖边界值；,2、插入数据，创建列约束，覆盖列内约束、列外约束；,3、create view/create table as select nchar/nvarchar/nvarchar2/nclob列；,4、创建分区表，分区键为nchar/nvarchar/nvarchar2，覆盖hash，range，list，interval分区（包含自动扩展分区）；,5、在表上创建trigger|exp/imp:,1. 全库导出，全库导入；
1. 全库导出，fromuser导入；to user导入
1. 全库导出，table导入；
1. schema导出，fromuser导入，to user导入
1. schema导出，table导入
1. table导出，table导入
|1、能正确导出，导入不报错；,2、检查表、分区、索引、object等视图|
|1、创建udp、udt、udf、procedure，变量，返回值，已经代码块都包含nchar/nchar/nvarchar/nvarchar2/nclob|exp/imp:,1. 全库导出，全库导入；
1. 全库导出，fromuser导入；to user导入
1. 全库导出，table导入；
1. schema导出，fromuser导入，to user导入
1. schema导出，table导入
1. table导出，table导入
|  
|
|1、建表包含nchar/nvarchar/nvarchar2/nclob列，长度覆盖边界值；|通过sqlloader/yasldr导入csv文件数据到指定列|  
|


  


3.4.3、yasql

|测试场景|测试点|yasql|服务端|备注|
|---|---|---|---|---|
|yasql --e -f|章节3.1的基本功能用例|linux|linux|  
|
|||windows|linux|  
|
|||linux|winows|不覆盖|
|yasql -c |1、建表包含nchar/nvarchar/nvarchar2/nclob列,2、插入数据，覆盖边界规格；,3、desc table，select全表查询，指定列查询，length/lengthb查询,4、alter table,5、update table,6、drop table|linux|linux|  
|
|||windows|linux|  
|
|||linux|windows|不覆盖|
|!yasql |  
|/|/|  
|


  


3.4.4、视图  

|视图|测试场景|检查点|
|---|---|---|
|ALL_TAB_COLS/DBA_TAB_COLS/USER_TAB_COLS|  
|  
|
|ALL_ARGUMENTS/DBA_ARGUMENTS/USER_ARGUMENTS|  
|  
|
|ALL_COLL_TYPES/DBA_COLL_TYPES/USER_COLL_TYPES|UDT中组合类型的信息|  
|
|ALL_TYPE_ATTRS/DBA_TYPE_ATTRS/USER_TYPE_ATTRS|  
|  
|
|V$DATATYPE|  
|  
|
|DBA_COL_COMMENTS|列的注释信息comment|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|
|  
|  
|  
|


  


3.4.5、内置高级包

|高级包|测试场景|检查点|
|---|---|---|
|dbms_metedata|1、表同时包含nchar/nvarchar/nvarchar2/nclob列,2、建立列索引、列约束,3、建立range、interval、list、hash分区表，分区键是nchar/nvarchar/nvarchar2,4、高级包查询上述表，显示正确|  
|
|dbms_lob|compare、getlength、substr函数，覆盖传参nclob场景|  
|
|dbms_stats|前置条件：,1、建表待nchar/nvarchar/nvarchar2/nclob列,insert数据；,2、收集表的统计信息,3、收集nchar/nvarchar/nvarchar2/nclob列的统计信息,4、nchar/nvarchar/nvarchar2建立索引，收集索引的统计信息|  
|


  


  


**3.5、字符编码&配置参数**

|测试对象|输入条件|备注|无效条件|备注|
|---|---|---|---|---|
|字符编码|覆盖：,1、客户端UTF8，服务端UTF16,2、客户端GBK，服务端UTF16,  
|覆盖3.1章节的基本场景，yasql -e -f执行sql脚本|  
|  
|
|配置参数|NLS_CHARACTER_SET：,1、值大小写：UTF16、utf16、UTF-16,2、配置多个NLS_CHARACTER_SET，覆盖第1个设置utf16和最后一个设置utf16|启动数据库实例成功，查询配置显示改后的值,show parameter NLS_CHARACTER_SET|1、设置多个值：utf16、utf16,2、拼写错误：utf_16|启动数据库报错|
||create database test character set utf8|  
|  
|  
|
||create database test character set utf16|不支持，报错拦截|  
|  
|
||create database test character set gbk|  
|  
|  
|


  


**3.6、测试环境**

|环境|测试策略|其他|
|---|---|---|
|单机HA|HA新增测试点：,1、3.1章节基本功能，涉及查询的点，都需要覆盖备机查询，查询结果与主机一致；,2、备机做create、alter、update、drop/truncate/delete操作会拦截报错；,3、带业务数据主备倒换后，查询数据没有问题（表数据，表结构，视图等）；可以做dml、ddl操作,4、长时间对表的进行dml操作，主备运行正常|存储不涉及修改，无需覆盖|
|分布式|不支持，拦截报错|  
|


  


**3.7、可靠性测试**

|前置条件|可靠性场景|  
|
|---|---|---|
|单机    
    
    
    
    
    
|insert+update并发操作|需要长上时间跑（晚上跑脚本并发）|
||update+delete并发操作|  
|
||insert+delete并发操作|  
|
||select + update并发操作|  
|
||select+delete并发操作|  
|
||delete+select+insert+update并发操作|  
|
||kill ：session，进程等，待业务重启数据库，对nchar/nvarchar/nvarchar2进行更新，删除操作|  
|
|HA    
    
|主：做insert、alter、update、delete操作,备：select操作|  
|
||主备倒换|  
|
||kill主进程/kill备进程|  
|


  


1、yasboot启库工具需要加入国家字符集配置参数，看能否使用，启库

2、导入导出工具需要覆盖大数据量

  


**3.8、其他**

驱动适配有单独SR跟踪单独测试，不在此次设计中体现

  


# **4. 详细设计**

见第3章节

#   
  5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|
