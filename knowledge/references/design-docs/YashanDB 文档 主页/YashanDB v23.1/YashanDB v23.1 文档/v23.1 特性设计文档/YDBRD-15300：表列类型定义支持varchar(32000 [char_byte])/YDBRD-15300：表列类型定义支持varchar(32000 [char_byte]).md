Created by 钟金健 on 七月 17, 2023

IR:    [YDBRD-14315](https://jira.yasdb.com/browse/YDBRD-14315?src=confmacro)    -  表字段支持定义、存储和处理字符长度最高32kb能力  完成

SR:    [YDBRD-15300](https://jira.yasdb.com/browse/YDBRD-15300?src=confmacro)    -  VARCHAR支持单列存储规格提升为32000  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

该特性是为了支持建表（只包括行表）时定义varchar( n  [char|byte] ) 数据类型时，从原有的n为1-8000提升到1-32000。  char(n [char | byte] )的规格维持1-8000不变化  。数据库还不支持nvarchar，所以只在语法阶段放开限制到16000   

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

### 一：DDL语句（建表、modify、建索引、数据增删改）

**普通字符串列**  ：没有存储超过8000字节的字符串类型（即原来就支持的规格内的字符串类型）

**超长字符串列**  ：使用lob存储的字符串类型。具体来说varchar(n) 单位是字节，当n超过8000时，就是超长字符串；varchar(n char) 单位是字符，n * MaxCharWidth > 8000时，认为是超长字符串类型（其中MaxCharWidth是字符集最大字节长度，UTF8下是4，GBK下是2，ISO8859-1和ASCII下是1）。

  


规则一：超长字符串列和普通字符串列不管表数据是否为空都  **不可以互相modify**  。超长字符串列只能在超长字符串列的范围内modify，普通字符串列只能在普通字符串列范围内modify

规则二：超长字符串列  不支持建索引、不能作为主键、不能有唯一约束、不能作为分区键、不能建外键

规则三：PTT不能建超长字符串列

  


**注意：**

- 原来没有超长字符串列和普通字符串列区分的时候，UTF8场景下，varchar(2001 char - 8000 char)是可以modify到varchar( 1 char - 2000 char)的。增加这个改动以后，varchar(2001 - 8000 char）认为是超长字符串列，varchar(1 - 2000 char)认为是普通字符串列，所以不能互相modify
- 原来varchar(2001 - 8000 char)只能存储8000字节的数据，超过这个字节数则会报错，现在varchar(2001 - 8000 char)可以存储超过8000字节的数据
- varchar(n char)作为分区键的时候新旧版本差异：待确定
- dba_lobs视图能查询到超长字符串列
- 需要关注新旧版本升级
- 旧版本已经定义为varchar(2001 char - 8000 char)范围内的存量数据升级到新版本以后，modify为varchar( 1 char - 2000 char）的表现
- 关注一下函数索引返回类型为varchar(n ) n > 6000 的表现


  


  


  


场景一：lob存储的字符串与普通存储的字符串 插入、查询、运算、删除等多种操作的性能差异

t1 data varchar(8001)

t2 data varchar(8000);

inRow   lob  4000

  


  


场景二：超长字符串在需要使用物化区的运算场景，实际数据超过63K时具体表现

1. ~~ create table t1( data varchar(8000),  data varchar(8000) ... 8 -10 ）； 63K （此次SR不需要关心） ~~


       2. data varchar(32000), data2 varchar(32000) , data3 varchar(32000)   63K

           insert into t1 values( lpad('a', 32000, 'a'), xxx , xx) ;

           select  data, data2, data3 from t1 order by id;    – 超过63K数据，报错

场景三：

select data from t1;

select data||'a' from t1;

  


  [varChar32K - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?spaceKey=~zhangzhipeng&title=varChar32K)  

### 二：DML语句（数据查询）

#### 系统表查询

  


- 系统表col$增加字段char_len
- ~~在varchar/char(n [ char| byte] )的情况下char_len为n（无论是字符长度单位还是字节长度单位）；~~
- VARCHAR(N CHAR) char_len = n;    varchar(n) char_len = n;
- 其他非字符串类型，char_len字段的值应该是0
- col$ size 存的字节长度，如果定义varchar( 8001 char)， size = 32000,  char_len = 8001


#### 普通表数据查询

- 普通查询语句查询lob存储的超长字符串时，与正常字符串形式一致，不感知差异


### 三：对其他部分功能的影响

服务端  -> 客户端：发送的size调整为字符数 （待确定）

SQL引擎 <-> 存储引擎：varchar类型的超长数据存入与取出，char_len的存入与取出 

持久化到系统表：char_len存字符数，size存字节数

#### 1）.内置函数返回规格的变化

- 涉及返回字符串数据类型的函数（列表格说明影响的函数）


|函数名|入参类型|返回规格|原规格|备注|
|---|---|---|---|---|
|concat / concat_ws|  
|返回varchar时，varchar的长度规格为varchar(1 - 32000)，varchar( 1 char - 32000 char)|返回varchar时，varchar的长度规格为varchar(1 - 32000)，varchar( 1 - 8000 char)|  
|
|colesce|如果入参是字符串类型|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|greatest / least|如果入参字符串类型|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|nvl / nvl2|如果入参字符串类型|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|split|如果入参字符串类型|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|trim / ltrim / rtrim|如果入参字符串类型|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|cast函数|  
|返回varchar类型时，长度规格varchar(1 - 32000), varchar(1 char - 8000 char),  
,cast ( xx as varchar(n char)) n > 8000 报错,cast ( xx as varchar(n)) n > 8000 报错|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|不支持cast( xx as varchar(8001 - 32000)和cast(xx as varchar(8001 char - 32000 char)|
|date_format|  
|只返回varhcar类型，长度规格varchar(32000)|返回varhcar类型，长度规格varchar(8000)|  
|
|if|如果入参字符串类型|返回varhcar类型，长度规格varchar( 1 - 32000)，varchar( 1 char - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|left / right|如果入参字符串类型|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|substring|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|substr|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|substring_index|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|translate|  
|返回varchar长度规格为varchar(32000), varchar(32000 char) |返回varchar长度规格为varchar(32000), varchar(8000 char)|  
|
|nullif|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|~~lpad、rpad~~|  
|~~返回varchar长度规格为varchar(1-32000),~~|~~返回varchar长度规格为varchar(1-32000)~~|~~不影响~~|
|nlssort|  
|返回varchar长度规格为varchar(32000), varchar(32000 char) |返回varchar长度规格为varchar(32000), varchar(8000 char)|  
|
|replace|  
|返回varchar长度规格为varchar(32000), varchar(32000 char) |返回varchar长度规格为varchar(32000), varchar(8000 char)|  
|
|upper/lower|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|initCap|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000), varchar(1 - 8000 char)|  
|
|first_value/last_value|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000)|以前版本遗漏了对char/varchar(n char)场景的识别|
|lead/lag|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000)||
|min / max  聚集函数与窗口函数|如果入参varchar( 1 - 32000)和varchar(1 char - 32000 char)|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-32000)||
|listagg  聚集函数与窗口函数|  
|返回varchar长度规格为varchar(1-32000), varchar(1 - 32000 char) |返回varchar长度规格为varchar(1-8000)||
|  
|  
|  
|  
||
|userenv|  
|返回varchar长度规格为varchar(1-32000)|返回varchar长度规格为varchar(1-8000)|  
|
|arraytostring 和stringtoarray|stringtovarry不返回字符串，不关心,varrytostring|返回varchar长度为varchar(1-32000)|返回varchar长度规格为varchar(1-8000)|  
|
|高级包中返回字符串类型的函数返回规格的变化|看下表|  
|  
|  
|


|bip高级包|函数|新规格|原规格|
|---|---|---|---|
|DBMS_STANDARD|DELETING|不涉及|  
|
|  
|DROPJAVA|不涉及|  
|
|  
|INSERTING|不涉及|  
|
|  
|LOADJAVA|不涉及|  
|
|  
|UPDATING|不涉及|  
|
|  
|RAISE_APPLICATION_ERROR|不涉及|  
|
|DBMS_CM|CREATE_CLUSTER|不涉及|  
|
|  
|CREATE_GROUP|不涉及|  
|
|  
|CREATE_NODE|不涉及|  
|
|  
|DELETE_GROUP|不涉及|  
|
|  
|DELETE_NODE|不涉及|  
|
|  
|TRIGGER_PUSH|不涉及|  
|
|  
|UPDATE_DATA_PATH|不涉及|  
|
|DBMS_HM|GET_RUN_REPORT|varchar(32000)|varchar(8000)|
|  
|RUN_CHECK|不涉及|  
|
|DBMS_IJOB|SUBMIT|不涉及|  
|
|DBMS_JOB|BROKEN|不涉及|  
|
|  
|CHANGE|不涉及|  
|
|  
|INTERVAL|不涉及|  
|
|  
|NEXT_DATE|不涉及|  
|
|  
|REMOVE|不涉及|  
|
|  
|RUN|不涉及|  
|
|  
|SUBMIT|不涉及|  
|
|  
|WHAT|不涉及|  
|
|DBMS_LOB|COMPARE|不涉及|  
|
|  
|GET_LENGTH|不涉及|  
|
|  
|GETLENGTH|不涉及|  
|
|  
|SUB_STR|varchar(32000)|varchar(32000)|
|  
|SUBSTR|varchar(32000)|varchar(32000)|
|DBMS_LOCK|SLEEP|不涉及|  
|
|DBMS_METADATA|GET_DDL|不涉及|  
|
|DBMS_OUTPUT|put_line|varchar(32000)|varchar(8000)|
|  
|put|不涉及|  
|
|DBMS_PARAM|APPLY_RECOMMEND|不涉及|  
|
|  
|OPTIMIZE|不涉及|  
|
|  
|SHOW_RECOMMEND|不涉及|  
|
|DBMS_RANDOM|INITIALIZE|不涉及|  
|
|  
|NORMAL|不涉及|  
|
|  
|RANDOM|不涉及|  
|
|  
|SEED|不涉及|  
|
|  
|STRING|varchar(32000)|varchar(8000)|
|  
|TERMINATE|不涉及|  
|
|  
|VALUE|不涉及|  
|
|DBMS_SCHEDULER|CREATE_JOB|不涉及|  
|
|  
|DISABLE|不涉及|  
|
|  
|DROP_JOB|不涉及|  
|
|  
|ENABLE|不涉及|  
|
|  
|RUN_JOB|不涉及|  
|
|  
|SET_ATTRIBUTE|不涉及|  
|
|DBMS_SPACE_ADMIN|SEGMENT_NUMBER_BLOCKS|不涉及|  
|
|  
|SEGMENT_NUMBER_EXTENTS|不涉及|  
|
|DBMS_SQL|RETURN_RESULT|不涉及|  
|
|DBMS_STATS|DELETE_COLUMN_STATS|不涉及|  
|
|  
|FLUSH_DATABASE_MONITORING_INFO|不涉及|  
|
|  
|GATHER_DATABASE_STATS|不涉及|  
|
|  
|GATHER_INDEX_STATS|不涉及|  
|
|  
|GATHER_SCHEMA_STATS|不涉及|  
|
|  
|GATHER_TABLE_STATS|不涉及|  
|
|  
|LOCK_PARTITION_STATS|不涉及|  
|
|  
|LOCK_SCHEMA_STATS|不涉及|  
|
|  
|LOCK_TABLE_STATS|不涉及|  
|
|  
|SET_COLUMN_HISTOGRAM|不涉及|  
|
|  
|SET_COLUMN_STATS|不涉及|  
|
|  
|SET_DATABASE_PREFS|不涉及|  
|
|  
|SET_GLOBAL_PREFS|不涉及|  
|
|  
|SET_INDEX_STATS|不涉及|  
|
|  
|SET_SCHEMA_PREFS|不涉及|  
|
|  
|SET_TABLE_PREFS|不涉及|  
|
|  
|SET_TABLE_STATS|不涉及|  
|
|  
|UNLOCK_PARTITION_STATS|不涉及|  
|
|  
|UNLOCK_SCHEMA_STATS|不涉及|  
|
|  
|UNLOCK_TABLE_STATS|不涉及|  
|
|DBMS_UTILITY|FORMAT_CALL_STACK|不涉及|  
|
|  
|FORMAT_ERROR_STACK|不涉及|  
|


#### 3）jdbc、c驱动

- 变量绑定预推导类型长度从以前的8000变为32000
- select length(?) from dual;


3  ）.yasql

- 协议发送内容发生变化，旧版本与新版本对服务端发送过来的size的处理行为不一致。如果版本不一致，可能会出现不可预知问题 (待确定)


4）.导入导出工具(exp\imp\yasldr)

- 导入导出varchar(8000-32000)的数据是否需要适配 （评审时说天然支持）


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

#### 1）.varchar(n char)

- varchar(n char)虽然可以定义varchar(32000 char)实际存储上限也只有32000字节


2).普通字符串列和lob存储的超长字符串列不能互相modify

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

服务端  -> 客户端：precision和scale清零，size调整为字符数

SQL引擎 <-> 存储引擎：ColumnAttr.size、ColumnAttr.charLen的信息可以直接传递，varchar类型的存入取出

~~持久化到系统表：precision存字符数，size存字节数（需要调整许多的系统表取出precision和scale的逻辑，系统视图也相应要调整）~~

  


SQL引擎内部：

1. TypeDesc 、columnAttr、ExprNode上描述数据类型的信息传递( size, type, isChar, precision, scale ) (charLen就是p和s的union，所以传递了p和s就是传递了charLen)
1. 需要处理各种表达式评估出来的charLen（尤其是内置函数，具体有    [n char影响函数修改项整理 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104214692)    ）
1. 从存储引擎取出数据（sendRow, execExpr）
1. gTypeDeclSet大数组调整和适配（可能需要刷新用例比较多）


![](https://pingcode.yasdb.com/atlas/files/public/67396aeba1ad9a3311dc7e5e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxNzMsImV4cCI6MTc4MjMwMDk3M30.kIiLNdRyjswCZEqzHkCvO6nzHVe_ZyogQ7jI6YuemrE)

  


疑难点记录：

1. case when
1. 客户端接受到的columnAttr.size是字符长度，不再是字节长度。所以客户端遇到是varchar(n char)的场景要预估一个最大的长度。yacColAttribute、yacDescribeCol2、yacGetColSize、
1. cast(xx as varchar(n char) 边界值的处理条件


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- 基本DDL语句（建表、删表、modify、建索引、数据增删改查）
- 返回类型为字符串的内置函数返回规格的变动
- 系统表col$的char_len字段
- yasql、jdbc、c驱动、导入导出工具等外围工具对功能的适配
- #### 高级包DBMS_METADATA.getDDL获取原始建表语句和导出工具构建原始建表语句


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments: