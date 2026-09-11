Created by 孟麟, last modified on 八月 21, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/66191837fd997db58ad898c0](https://pingcode.yasdb.com/pjm/items/66191837fd997db58ad898c0)    ?    
  #YDBRD-26289 兼容MySQL数据类型

数据类型兼容的整体策略：

1. YashanDB特有的数据类型，如nchar, udt，在兼容模式下也可以使用
1. MySQL特有的数据类型，YashanDB没有的数据类型，如enum、Set，由于YashanDB不支持，因此需要开发
1. 两者都有，但规格存在差异的类型，第一步，先做类型映射，解决有无问题，第二步，对齐规格
1. 暂不兼容的类型（有差异不处理、没有不支持）：bit、serial


本需求覆盖的是上述第1、3点。

## 1.1相关文档

开发文档：    [MySQL数据类型与YashanDB规格差异](https://conf.yasdb.com/pages/viewpage.action?pageId=144118162)    、    [详细设计-YDBRD-26289：兼容MySQL数据类型](150617954.html)  

测试调研：    [YASHAN-926_测试调研](https://conf.yasdb.com/pages/viewpage.action?pageId=150622922)  

其他：    [生态兼容总体设计](/pages/createpage.action?spaceKey=YAS&title=%E7%94%9F%E6%80%81%E5%85%BC%E5%AE%B9%E6%80%BB%E4%BD%93%E8%AE%BE%E8%AE%A1)  

# 2. 需求分析

## 2.1 功能点分析

1、数据类型范围、每种类型的规格差异、以及兼容的处理规则

|序号|分类|数据类型|MySQL规格|YaShan兼容策略、规则|7-9/7-29刷新兼容策略和规则,（由于ddl和协议导致变更）|MySQL同名对象|其他补充信息|
|---|---|---|---|---|---|---|---|
|1|数字型|TINYINT  [(M)]|同义词：无，M表示显示宽度（[0,255]），范围：-128~127|使用tinyint映射，数据范围一致，  **支持带M的语法，无实际意义**|无变化|不允许|  
|
|2|  
|SMALLINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -32768  ~  32767|使用smallint映射，数据范围一致，  **支持带M的语法，无实际意义**|无变化|不允许|  
|
|3|  
|INTEGER[(M)]|同义词：INT，M表示显示宽度（[0,255]），范围：-  2147483648~2147483647|使用integer映射，数据范围一致，  **支持带M的语法，无实际意义**|无变化|不允许|  
|
|4|  
|BIGINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -9223372036854775808~9223372036854775807|使用bigint映射，数据范围一致，  **支持带M的语法，无实际意义**|无变化|不允许|  
|
|5|  
|MEDIUMINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -8388608~8388607|使用  **integer**  映射，范围同integer（比MySQL大），  **支持带M的语法，无实际意义**|**值的范围与mysql一致(**  **-8388608~8388607**  **)**  ，超过报错|不允许|  
|
|6|  
|DECIMAL     [(M [,D])]|同义词：  DEC、FIXED，NUMERIC,M是总位数，D是小数点后的位数，M的范围为[1,65]，D的范围[0,30]，且D <= M，M缺省10，D缺省0，  定义为decimal/decimal(0)/decimal(0,0)时，实际为DECIMAL(10,0),不支持DECIMAL(*)语法|使用  NUMBER(P,S)  映射  **，M和D的范围以yashan为准（MySQL的范围比yashan大，超过yashan范围报错），取值：(-1E126，-1E-130]、**  **0和[1E-130，1E126)**,P：精度，表示数字的有效位数，取值范围[1,38]，缺省38,S：刻度，表示数字从小数点到最右侧有效数字的位数，取值范围[-84,127]，缺省0,定义为DECIMAL时实际为浮动精度；支持DECIMAL(*)语法，效果同浮动精度|1、定义为  decimal/decimal(0)/decimal(0,0)  时与mysql保持一致（decimal(10,0)）,2、不支持DECIMAL(*)这个语法,3、M范围与崖山一致[1,38]，D的范围限制为[0,30],（7-29迭代4协议需求修改）|允许：fixed,其他不允许|  
|
|7|  
|DOUBLE  ([M, D])|同义词：  DOUBLE PRECISION，REAL,M是总位数，D是小数点后的位数，0 < M <= 255,  0 <= D <= 30, 并且D <= M，可精确到15个小数位,-1.7976931348623157E+308到-2.2250738585072014E-308,0和2.2250738585072014E-308到1.7976931348623157E+308|使用double映射，  **yashan已兼容M/D语法，无实际意义（超过定义范围报错）**,[-1.79769313486232E308, -4.94065645841247E-324]、  0  、[4.94065645841247E-324, 1.79769313486232E308]|无变化|不允许|  
|
|8|  
|FLOAT  ([M, D])|同义词：无，M/D含义和范围同上，精度为小数点后7位,-3.402823466E+38到-1.175494351E-38,0和1.175494351E-38到3.402823466E+38|使用float映射，  **yashan已兼容M/D，无实际意义（超过定义范围报错）**,[-3.402823E38, -1.401298E-45]、  0、  [1.401298E-45, 3.402823E38]|无变化|不允许|  
|
|9|  
|~~DOUBLE(p)~~,FLOAT(p)|p表示以位为单位的精度，  **0~24**  类型为float，25~53类型为double,注：mysql并不支持double(p)这种语法|使用float映射，  **yashan已兼容p语法，无实际意义（超过定义范围报错），0~24定义为float，25~53定义为double**|无变化|不允许|【  **yashan**  】1、float的p范围0<=p<=126，  大于53小于等于126的部分会当作53处理,2、m或者p值  **>23（<=23 为float）**  ，系统将类型转换为DOUBLE类型|
|10|  
|BOOLEAN|同义词：  TINYINT(1)、BOOL,支持输入：  0/1，'0'/'1'，true/false（为tinyint(1)，可输入-128~127）,不支持输入：'true'/'false'，' t'/'f'， 'on'/'off'， 'yes'/'no',**非0则为true，列类型可直接用于bool表达式**|使用tinyint(1)映射，  **支持输入的规格与mysql一致**|无变化|**允许**|  
|
|11|日期时间型|DATE|同义词：无，范围：  1000-01-01~9999-12-31|使用date映射，按yashan规格（范围  0001-01-01 00:00:00 ~ 9999-12-31 23:59:59，比MySQL大  ）|无变化|**允许**|  
|
|12|  
|DATETIME  [(fsp)]|同义词：无，范围：  1000-01-01 00:00:00.000000~  9999-12-31 23:59:59.499999,fsp定义微秒的精度，  范围0~6，  **默认精度为0（与**  **标准SQL默认值6不同，以便与以前的MySQL版本兼容**  **）**|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）,在数据类型定义时，微秒精度可定义范围为  **0~9**  ，但输出的  **实际精度值均为6**|无变化|**允许**|**与mysql差异：**,无论设置什么fsp值，均按6处理（fsp不生效）|
|13|  
|TIMESTAMP  [(fsp)]|同义词：无，范围：  1970-01-01 00:00:01.000000 UTC ~2038-01-19 03:14:07.999999 UTC,fsp  **同上**|同上|无变化|**允许**|同上|
|14|  
|TIME  [(fsp)]|同义词：无，范围：  -838:59:59.000000~838:59:59.000000,fsp  **同上**|使用time映射，按yashan规格（范围  00:00:00.000000 ~ 23:59:59.999999，  **比MySQL范围小，超过报错**  **）**,**yashan不支持time(fsp)语法，微秒精度6**|无变化|**允许**|**与mysql差异：**,yashan不支持time'23:59:59.999999'写法,yashan插入'23:59:59.9999999'报错|
|15|字符型|BINARY[(M)]|同义词：  CHAR BYTE  **（为了兼容，不支持使用时指定长度）**,范围0~255字节，  **缺省为1**  ；存储二进制字节字符串,![](https://pingcode.yasdb.com/atlas/files/public/67396e678970c2af4f52189a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4NDUsImV4cCI6MTc4MjM4MjY0NX0.o2KUhBxXvQDbxo-npwmRKlWVQAbk8U2MMpZFoErk_Xw),**插入长度为0的方法和mysql允许将int转换为bin：**,mysql> insert into test_binary(c2)   **values('');**,mysql> insert into test_binary(c1)   **values(1);**,mysql> select * from test_binary;    
  +------+------+------+------+------+------+    
  | c1 | c2 | c3 | c4 | c6 | c8 |    
  +------+------+------+------+------+------+    
  | NULL | | NULL | NULL | NULL | NULL |    
  | 1 | NULL | NULL | NULL | NULL | NULL |    
  +------+------+------+------+------+------+    
  2 rows in set (0.00 sec)|使用raw映射,范围0~255，yashan已支持1~255，  **需支持0，缺省1**,**实际长度小于定义长度时，不补0x00**|无变化|不允许|**7-30 raw表现与mysql binary差异较大：**    
  1、长度是mysql的2倍    
  2、内容：mysql可以插入非16进制字符（中文也可以）；允许插入int类型的值等,create table test_sr26289_binary_02(c1 binary(255),,c2 BinAry, c3 BINARY(0), c4 char byte, c5 binary(255));    
  insert into test_sr26289_binary_02 values(lpad('0123456789ABCDEFabcdef', 510, 'abcdef0123456ABCDEF789'), '0f', '', '00', lpad('00112789AadEebDeEfF', 510, '0011cDdEeFfaAbBcCdDeEfF'));    
  --mysql实际能插入的是255    
  select length(c1),c1,length(c2),c2,length(c3),c3,,length(c4),c4,length(c5),c5,from test_sr26289_binary_02;,--下面的在mysql执行成功    
  insert into test_sr26289_binary_02(c1) values(123);    
  insert into test_sr26289_binary_02(c1) values('1中c文a');    
  insert into test_sr26289_binary_02(c1) values('q(≧▽≦q)');|
|16|  
|VARBINARY(M)|同义词：无,范围0~65535字节，M不能省略（不带报错）|使用raw映射，范围0~8000，yashan已支持1~8000，  **需支持0；**  **8001~65535不支持报错**|无变化|不允许|  
|
|17|  
|CHAR[(M)]|同义词：  CHARACTER,范围0~255  **字符**  ，缺省为1|使用char映射  **(字节)**  ，范围0~255，yashan已支持1~255，  **需支持0**|使用char映射  **(字符)**,范围0~255字符，超过报错，缺省1|不允许|  
|
|18|  
|VARCHAR(M)|同义词：  ~~CHARACTER VARYING~~,范围0~65535  **字节（UTF8MB4字符集下单字符最大占4个字节，实际可定义长度16383）**  ，M不能省略（不带报错）|使用varchar映射  **(字节)**  ，范围0~32000，yashan已支持1~8000，  **需支持0；**  **32001~65535不支持报错**|使用varchar映射  **(字符)**,**范围0~8000字符（32000字节），超过报错**|不允许|  
|
|19|  
|NCHAR[(M)]|同义词：  NATIONAL CHAR、NATIONAL CHARACTER,范围0~255  **字符**  ，缺省为1|使用nchar映射，范围0~255字符，yashan已支持1~255，  **需支持0，超过报错**|无变化|**允许**|nchar允许|
|20|  
|NVARCHAR(M)|同义词：  NATIONAL   VARCHAR、NATIONAL CHARACTER VARYING,范围0~65535  **字节(国家字符集为UTF8，单字符最大长度3字节，实际可定义长度21845)**  ，M不能省略（不带报错）|使用nvarchar映射，范围0~16000字符，yashan已支持1~16000，  **需支持0；**  **32001~65535不支持报错**|使用nvarchar映射,**范围0~8000字符（32000字节）**  ，超过报错|**允许**|nvarchar允许|
|21|大对象|TINYBLOB|同义词：无，  范围0~255字节|使用  **BLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|使用blob映射，  **范围**  **0~255字节**  的十六进制字符串，超过报错|不允许|  
|
|22|  
|BLOB|同义词：无，范围  0~65535字节|同上|使用blob映射，  **范围**  **0~65535字节**  的十六进制字符串，超过报错|不允许|  
|
|23|  
|MEDIUMBLOB|同义词：无，范围0~  16777215字节|同上|使用blob映射，  **范围**  **0~16777215字节**  的十六进制字符串，超过报错|不允许|  
|
|24|  
|LONGBLOB|同义词：无，范围0~  4294967295字节|同上|使用blob映射，  **范围**  **0~4294967295字节**  的十六进制字符串，超过报错|不允许|  
|
|25|  
|TINYTEXT|同义词：无，  范围0~255字节|使用  **CLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|使用clob映射，范围  **0~255字符**  ，超过报错|不允许|  
|
|26|  
|TEXT|同义词：无，范围  0~65535字节|同上|使用clob映射，范围  **0~65535字符**  ，超过报错|**允许**|  
|
|27|  
|MEDIUMTEXT|同义词：无，范围0~  16777215字节|同上|使用clob映射，范围  **0~16777215字符**  ，超过报错|不允许|  
|
|28|  
|LONGTEXT|同义词：无，范围0~  4294967295字节|同上|使用clob映射，范围  **0~4294967295字符**  ，超过报错|不允许|  
|


2、对实现方案的理解：

- 需要在MySQL兼容模式下才支持，  alter   s  ession     set     compat_vector=mysql；非mysql模式下除无法识别MySQL特有数据类型关键字，可以正常操作mysql模式下创建的表及数据
- MySQL模式下，  YashanDB  本身的数据类型规格保持不变
- SQL语句兼容  采用重载模式，YashanDB原有的SQL体系作为父类，兼容模式作为子类，当一个功能（一条SQL语句、一个语法分支、一个词）子类可以完成时，则父类不再重复完成，此时我们称子类的方法重载了父类的方法。当子类不能完成时，则由父类完成
- 本需求通过映射兼容适配的实现：SQL引擎中统一的入口代码做的映射处理，即不区分SQL语句类型（DDL、DML、DQL、PLSQL等）和出现在语句的位置（投影列、函数内、子查询、filter、group、order等）
- DDL的兼容由单独的需求交付，本需求带上了基本的create table以支持需求验收，分区、约束等还不支持，根据上一条，本需求也可不关注


3、客户端执行语句后需显示服务端数据的场景(如查询类)，客户端也涉及数据类型的处理；本需求通过映射兼容的类型，yasql客户端/jdbc驱动无需适配，mysql client需要适配，有单独的需求交付(  YDBRD-26234/YDBRD-26235  )

![](https://pingcode.yasdb.com/atlas/files/public/67396e67a1ad9a3311dc970c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4NDUsImV4cCI6MTc4MjM4MjY0NX0.o2KUhBxXvQDbxo-npwmRKlWVQAbk8U2MMpZFoErk_Xw)

## 2.2 应用场景

MySQL生态业务

## 2.3 规格约束

见2.1表格各数据类型

# 3. 详细测试设计

## 3.1 测试设计方法

1、所有数据类型均涉及的公共测试点，数据类型分类后该类别公共测试点，每种数据类型特有的测试点

2、测试点分析采用边界值、等价类等测试设计工程方法

## 3.2 详细测试设计

1、功能测试分析

|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|本需求数据类型(公共)|compat_vector配置参数|mysql|本需求默认测试条件|  
|/|/|
|  
|  
|yashan|mysql模式下创建的表，覆盖基础的DML操作|  
|通过create table覆盖本需求涉及的所有数据类型|报错信息明确|
|  
|关键字校验|拼写|大写、小写、混合|  
|拼写错误|报错信息明确|
|  
|  
|语法|1、xx([M])，M可选：不带M(缺省)，带M及M边界值,2、xx(M)，M必选：带M及M边界值,3、xx 无参数：xx|执行(建表)成功|1、xx([M])：()，(非M数据类型)，(错误写法，如整型，输入小数、负数、科学计数、Nan/Inf)，(M范围外的值),2、xx(M)：不带M，(非M数据类型)，(错误写法，如整形，输入小数、负数、科学计数、Nan/Inf)，(M范围外的值),3、xx 无参数：xx()，xx(参数)|报错信息明确|
|  
|  
|同名对象|列名、表名、"xx"|对象类型较多，覆盖1种|/|mysql不支持关键字创建同名对象，单独的需求处理：？|
|  
|  
|同义词（别名）|每个数据类型支持的同义词|表现一致|/|/|
|  
|数据值|数值型|1、规格范围内及边界,2、不同写法：科学计数法,3、特殊值：Nan、Inf、-Inf、null、''|执行(insert)成功，查询结果正确|1、规格范围外,2、错误写法|执行(insert)失败，报错信息明确|
|  
|  
|时间型|1、规格范围内及边界,2、不同内容：不同分隔符、null、'',3、不同date_format(带汉字)、timestamp_format|同上|1、规格范围外,2、错误写法|同上|
|  
|  
|字符型|1、长度小于、等于定义长度,2、不同内容：单字节(数字、字母、特殊字符)、多字节(汉字、表情等)、null、''、' '、'""'、'" "',3、不同字符集|同上|1、长度超过定义长度|同上|
|  
|  
|大对象|1、长度小于、等于规格长度,2、不同内容：单字节(数字、字母、特殊字符)、多字节(汉字、表情等)、null、''、' '、'""'、'" "'、empty_blob()/empty_clob(),3、不同字符集|同上|1、长度超过规格长度|同上|
|  
|  
|RAW|1、长度小于、等于定义长度,2、不同内容：0-9/a-f/A-F、null、''|同上|1、长度超过定义长度,2、不支持内容：非16进制|同上|
|  
|普通表|单列|1、create table结合'关键字校验-语法,2、insert/update数据和查询，结合‘数据值’,3、create table/view as select */数据类型列，insert/update和查询数据|1、建表成功，desc表信息正确,2、insert/update成功，查询结果正确,3、create成功，insert成功查询结果正确,all、视图信息正确性：DBA_DEPENDENCIES、DBA_OBJECTS、DBA_TAB_COLS、DBA_TAB_COLUMNS|1、create table结合'关键字校验-语法,2、insert/update数据和查询，结合‘数据值’|报错信息明确|
|  
|  
|多列|1、create table结合'关键字校验-语法,2、insert/update数据和查询，结合‘数据值’|同上|同上|同上|
|  
|  
|混合列|与mysql其他数据类型列、yashan数据类型列混合|同上|同上|同上|
|  
|  
|~~列规格~~|4096列|建表成功，desc表信息正确|超过4096列|创建失败|
|  
|分区表|range|本需求不涉及|  
|  
|  
|
|  
|  
|list|本需求不涉及|  
|  
|  
|
|  
|  
|hash|本需求不涉及|  
|  
|  
|
|  
|  
|二级分区|本需求不涉及|  
|  
|  
|
|  
|约束|default值|本需求不涉及|  
|  
|  
|
|  
|  
|primary key|本需求不涉及|  
|  
|  
|
|  
|  
|unique|本需求不涉及|  
|  
|  
|
|  
|  
|foreign key|本需求不涉及|  
|  
|  
|
|  
|  
|check|本需求不涉及|  
|  
|  
|
|  
|索引|类别：  普通、唯一、组合、函数、反向、列式、分区、rtree|本需求不涉及|  
|  
|  
|
|  
|alter表  **【覆盖到】**|新增列 alter table add|1、有数据表，结合‘关键字校验-语法’覆盖边界值，插入数据并查询,2、无数据表，结合‘关键字校验-语法’覆盖边界值，插入数据并查询|执行成功，desc表信息正确，插入成功，查询结果正确|结合‘关键字校验-语法‘覆盖不合法值|报错信息明确|
|  
|  
|删除列alter table drop|1、有数据表，drop指定列，插入数据并查询,2、无数据表，drop指定列，插入数据并查询|执行成功，desc表信息正确，插入成功，查询结果正确|/|/|
|  
|  
|其他数据类型→被测类型|按大类覆盖1种规则允许的类型，插入数据并查询，    [规则](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20TABLE.html#altercolumnclause)  |执行成功，desc表信息正确，插入成功，查询结果正确|按大类覆盖1种规则不允许修改的类型|报错信息准确|
|  
|  
|被测类型→其他数据类型|同上|同上|同上|同上|
|  
|  
|变更被测类型规格|1、有数据表，规格改大、不变；插入数据并查询,2、无数据表，规格改大、不变、改小；插入数据并查询|执行成功，desc表信息正确，插入成功，查询结果正确|1、有数据表，规格改小|报错信息准确|
|  
|删除表|truncate|有/无数据表，truncate，查询|truncate执行成功，查询结果为空|/|/|
|  
|  
|drop|有/无数据表，drop，desc表|drop执行成功，desc报表不存在|/|/|
|  
|~~表类型~~|~~临时表~~|1、创建全局临时表，带被测数据类型，desc表；插入数据并查询,2、创建私有临时表，带被测数据类型，desc表；插入数据并查询|执行成功|/|/|
|  
|  
|单机lsc/tac|/|/|create table含被测类型|拦截报错|
|  
|  
|分布式分布表/复制表/lsc/tac|/|/|create table含被测类型|拦截报错|
|  
|  
|集群|/|/|create table含被测类型|拦截报错|
|  
|数据类型转换|隐式转换|覆盖到（create table含被测类型列和其他类型列，insert时被测类型列对应可隐式转换的数据类型，查询）|insert成功，查询结果正确|覆盖到（create table含被测类型列和其他类型列，insert时被测类型列对应不可隐式转换的数据类型）|insert报错，报错信息准确|
|  
|  
|强制转换(cast)|覆盖到（cast 字符串->被测类型，被测类型->字符串）|转换成功，结果正确|覆盖到（cast 不可转类型->被测类型，被测类型->不可转类型）|转换失败|
|  
|函数|  
|覆盖到|  
|  
|  
|
|  
|DML|update|覆盖到|  
|  
|  
|
|  
|  
|delete|覆盖到|  
|  
|  
|
|  
|DQL|投影列|覆盖到|  
|  
|  
|
|  
|  
|  [condition](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/condition.html)  ||  
|  
|  
|
|  
|  
|order by||  
|  
|  
|
|  
|  
|group by having||  
|  
|  
|
|  
|  
|join||  
|  
|  
|
|  
|  
|子查询||  
|  
|  
|
|  
|  
|运算+、-、*、/、mod||  
|  
|  
|
|  
|PLSQL|匿名块|覆盖到|  
|  
|  
|
|  
|  
|UDT|覆盖到|  
|  
|  
|
|  
|  
|内置高级包|覆盖到：大对象DBMS_LOB|  
|  
|  
|
|  
|导入导出|  
|本需求不涉及|  
|  
|  
|
|YashanDB数据类型|  
|  
|mysql模式下，create table含yashandb支持的所有数据类型，insert数据，查询|执行成功，数据正确|/|/|


2、经分析，专项主要涉及CT，mysql模式下并发的建表、操作数据

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|Y|
|KT|N|
|长稳|N|
|一致性|N|
|三方测试工具    
  (sqltest，sqlancer)|N|
|安全|N|
|DFR|N|
|HA|N|
|压力|N|
|性能|N|
|可维护性|N|


  


# 4. 测试用例

1. 冒烟：create table使用到本需求涉及的所有数据类型，insert数据，select查询
1. 文本用例：


[mysql_datatype_compat_testcases.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjdhMWFkOWEzMzExZGM5NzA5IiwicmVmX2lkIjoiNjczOTZlNjc1OTNmOTljOWZmMjM4NDQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODQ1LCJleHAiOjE3ODI0NTgyNDV9.qhkg698l9cEp2EO5L-JQt0FKD8S_al-p8SIIYZtxa8c)

# 5. 测试框架设计

- 功能测试使用yasft可以满足需求


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：8  *人天*

计划测试完成时间：

## Attachments:

[mysql_datatype_compat_testcases.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjdhMWFkOWEzMzExZGM5NzA5IiwicmVmX2lkIjoiNjczOTZlNjc1OTNmOTljOWZmMjM4NDQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODQ1LCJleHAiOjE3ODI0NTgyNDV9.qhkg698l9cEp2EO5L-JQt0FKD8S_al-p8SIIYZtxa8c)

 (text/csv)    


[image2024-5-14_9-17-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjdhMWFkOWEzMzExZGM5NzBhIiwicmVmX2lkIjoiNjczOTZlNjc1OTNmOTljOWZmMjM4NDQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODQ1LCJleHAiOjE3ODI0NTgyNDV9.zI7HWOtwAAYeQuEoc-Mdc-cbijp4RAUaDJToIh7-ErM)

 (image/png)    


[image2024-5-14_9-13-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjdhMWFkOWEzMzExZGM5NzBiIiwicmVmX2lkIjoiNjczOTZlNjc1OTNmOTljOWZmMjM4NDQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODQ1LCJleHAiOjE3ODI0NTgyNDV9.qHnM2pCdLda7-lfCPXaY4ch3jfJVej8B4qDL88SGnhI)

 (image/png)    
