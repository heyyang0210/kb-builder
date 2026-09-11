Created by 赵育, last modified on 七月 02, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6618f665fd997db58ad85c83](https://pingcode.yasdb.com/pjm/items/6618f665fd997db58ad85c83)    ?    
  #YDBRD-26216 【mysql兼容】（协议）COM_QUERY文本结果集支持LOB类型

【mysql兼容】协议支持原生兼容COM_QUERY触发结果集类型：    
  支持tinytext、text、mediumtext、longtext类型    
  支持tinyblob、blob、mediumblob、longblob类型

PS：本特性同时转测所有之前COM_QUERY未支持的结果集类型，包括其元数据+数据

## 2.2 应用场景

用户使用 mysql client/mysql jdbc 驱动将数据同步/插入到 yashandb 服务端，通过 mysql client/mysql jdbc驱动查询不同数据类型的数据；测试场景均基于该前提。

- 部分数据类型 mysql server 与 yashandb 范围未严格一致，不考虑通过 yashandb 客户端插入数据，通过 mysql client 端获取数据的情况；


## 2.3 规格约束

无

# 3. 详细测试设计

## 3.1 测试设计方法

从功能出发，结合等价类、边界值的测试设计方法，输出测试设计。

测试策略：端到端测试，不仅仅关注协议层的改动

1、在测试不同列类型的数据时，覆盖 JDBC 所有关于不同数据类型的查询接口，包括获取元数据接口、获取值的接口。特别是 CLOB、BLOB 类型的接口。

2、对于 zerofill 属性，目前 SR 暂时不实现，测试点已输出，本 SR 暂不测试，后续补测时，需关注：a、无填充，超过 zerofill 位数时，两表 join 查询的结果正确性；b、填充 0 ，两表 join 查询结果的正确性；后续根据     [MySQL :: MySQL 8.0 Reference Manual :: 13.1.6 Numeric Type Attributes](https://dev.mysql.com/doc/refman/8.0/en/numeric-type-attributes.html)     进行补测；

3、超过列类型的范围处理，参考：    [MySQL :: MySQL 8.0 Reference Manual :: 13.1.7 Out-of-Range and Overflow Handling](https://dev.mysql.com/doc/refman/8.0/en/out-of-range-and-overflow.html)     ，不支持 SQL MODE ，不测试，与协议关系不大；

4、mysql-client 及 jdbc 驱动均需要覆盖不同数据类型的插入及查询；mysql-client 可参考 mysql 原生测试用例来覆盖，jdbc 需自己设计用例，无原生用例可参考；

5、jdbc 穿插覆盖相关接口下跟列类型相关的所有方法；

6、jdbc 驱动跟列类型相关的配置参数需测试；—这些参数是 JDBC 驱动的参数，是否需要服务端适配？当前 SR 是否需要关注？    ---先摸底测试，有问题再对齐；

## 3.2 详细测试设计

- 功能测试


不同数据类型在 yashandb 服务端到 mysql 客户端的处理：元数据映射、用户数据映射，测试如下表格中支持的字段类型

|序号|数据类型|MySQL规格|YaShan兼容策略、规则|测试点分析|
|---|---|---|---|---|
|1|TINYINT  [(M)]|同义词：无，M表示显示宽度（[0,255]），范围：-128~127|使用tinyint映射，数据范围一致，  **支持带M的语法，无实际意义**|1、无符号   TINYINT，指定/不指定显示宽度 M ，插入边界值、典型值，并查询，列类型为   MY_TYPE_TINY，值正确    ---无符号没有转测，本SR 不测试,2、有符号   TINYINT，指定/不指定显示宽度 M，插入边界值、典型值，并查询，列类型为   MY_TYPE_TINY，值正确,3、指定 ZEROFILL, 指定 unsigned/不指定 unsigned，插入边界值、典型值、未超过 M 自动填充、超过 M正常显示，  ，列类型为   MY_TYPE_TINY，值正确    ---不支持，本 SR 不测试,4、M 值覆盖：-1、0、255、256，查询值正常显示   ---元数据返回的是默认值，目前 SR 暂不关注，待后续 M 生效后补测；|
|2|SMALLINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -32768  ~  32767|使用smallint映射，数据范围一致，  **支持带M的语法，无实际意义**|同   TINYINT|
|3|INTEGER[(M)]|同义词：INT，M表示显示宽度（[0,255]），范围：-  2147483648~2147483647|使用integer映射，数据范围一致，  **支持带M的语法，无实际意义**|1、同   TINYINT,2、使用   INTEGER、INT 建表后插入数据，查询|
|4|BIGINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -9223372036854775808~9223372036854775807|使用bigint映射，数据范围一致，  **支持带M的语法，无实际意义**|1、SERIAL is an alias for BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE. --是否支持自增字段？不支持的话，暂不关注,2、无符号 bigint 的存储范围,3、使用 min、max 函数对 bigint 计算,4、使用运算符 +、-、* 等运算符计算 bigint 的数据，考虑超范围的场景  ---目前 sql 层是否有对应测试用例，如有，则不重复测试 ---  （配置参数控制）测试执行时关注,其他同 TINYINT|
|5|MEDIUMINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -8388608~8388607|使用  **integer**  映射，范围同integer（比MySQL大），  **支持带M的语法，无实际意义**|同   TINYINT|
|6|DECIMAL     [(M [,D])]|同义词：  DEC、FIXED，NUMERIC,M是总位数，D是小数点后的位数，M的范围为[1,65]，D的范围[0,30]，且D <= M，M缺省10，D缺省0|使用  NUMBER(P,S)  映射  **，M和D的范围以yashan为准（MySQL的范围比yashan大，超过yashan范围报错），取值：(-1E126，-1E-130]、**  **0和[1E-130，1E126)**,P：精度，表示数字的有效位数，取值范围[1,38],S：刻度，表示数字从小数点到最右侧有效数字的位数，取值范围[-84,127]|1、指定 M、D，插入数据覆盖：不超过 M，超过 M，不超过 D，超过 D；并查询记录，  列类型为   MY_TYPE_NEWDECIMAL  ，值正确,2、不指定 M、D，插入数据覆盖：边界值、超范围值、小数、整数；并查询记录，  列类型为   MY_TYPE_NEWDECIMAL  ，值正确,3、指定 ZEROFILL, 指定 unsigned/不指定 unsigned，插入边界值、典型值、未超过 M 自动填充、超过 M正常显示，  列类型为   MY_TYPE_NEWDECIMAL  ，值正确,4、  M 值覆盖：-1、0、65、66，查询值正常显示,5、D 值覆盖：-1、0、30、31  ，查询值正常显示,6、使用运算符 +、-、* 等运算符计算 decimal 列类型定义的M 或 D的定义、超范围的场景  ---目前 sql 层是否有对应测试用例，如有，则不重复测试,7、使用语法 DECIMAL（M）创建列，插入小数、整数值；查询记录，列类型为      MY_TYPE_NEWDECIMAL  ，值正确；,8、使用 DECIMAL 创建列，插入数字位数 > 10 的小数、数字位数 > 10 的整数值；查询记录，列类型为 MY_TYPE_NEWDECIMAL，值正确；----  跟 yashandb 表现不一致；提单跟踪,7、使用如下同义词创建列,DEC[(M[,D])] [UNSIGNED] [ZEROFILL]  , ,NUMERIC[(M[,D])] [UNSIGNED] [ZEROFILL], ,FIXED[(M[,D])] [UNSIGNED] [ZEROFILL]|
|7|DOUBLE  ([M, D])|同义词：  DOUBLE PRECISION，REAL,M是总位数，D是小数点后的位数，0 < M <= 255,  0 <= D <= 30, 并且D <= M，可精确到15个小数位,-1.7976931348623157E+308到-2.2250738585072014E-308,0和2.2250738585072014E-308到1.7976931348623157E+308|使用double映射，  **yashan已兼容M/D语法，无实际意义（超过定义范围报错）**,[-1.79769313486232E308, -4.94065645841247E-324]、  0  、[4.94065645841247E-324, 1.79769313486232E308]|1、指定 M、D，插入数据覆盖：不超过 M，超过 M，不超过 D，超过 D；并查询记录，  列类型为   MY_TYPE_FLOAT  ，值正确,2、不指定 M、D，插入数据覆盖：边界值、超范围值，非 float 的数据；并查询记录；并查询记录，  列类型为   MY_TYPE_FLOAT  ，值正确,3、指定 ZEROFILL, 指定 unsigned/不指定 unsigned，插入边界值、典型值、未超过 M 自动填充、超过 M正常显示，  列类型为   MY_TYPE_FLOAT  ，值正确,4、  M 值覆盖：-1、0、255、256，查询值正常显示,5、D 值覆盖：-1、0、30、31  ，查询值正常显示,6、使用同义词   DOUBLE PRECISION[(M,D)] [UNSIGNED] [ZEROFILL]   创建表，测试点同 DOUBLE  ([M, D]),7、使用同义词   REAL[(M,D)] [UNSIGNED] [ZEROFILL] 创建表，测试点同   DOUBLE  ([M, D])|
|8|FLOAT  ([M, D])|同义词：无，M/D含义和范围同上，精度为小数点后7位,-3.402823466E+38到-1.175494351E-38,0和1.175494351E-38到3.402823466E+38|使用float映射，  **yashan已兼容M/D，无实际意义（超过定义范围报错）**,[-3.402823E38, -1.401298E-45]、  0、  [1.401298E-45, 3.402823E38]|1、指定 M、D，插入数据覆盖：不超过 M，超过 M，不超过 D，超过 D；并查询记录，  列类型为   MY_TYPE_FLOAT  ，值正确,2、不指定 M、D，插入数据覆盖：边界值、超范围值，非 float 的数据；并查询记录；并查询记录，  列类型为   MY_TYPE_FLOAT  ，值正确,3、指定 ZEROFILL, 指定 unsigned/不指定 unsigned，插入边界值、典型值、未超过 M 自动填充、超过 M正常显示，  列类型为   MY_TYPE_TINY，值正确,4、设置 SQL mode =   ANSI, 使用 REAL[(M,D)] [UNSIGNED] [ZEROFILL] 创建表，查询记录，  列类型为 MY_TYPE_TINY，值正确    ---这个 SR 不关注；,  
|
|9|DOUBLE(p),FLOAT(p)|p表示以位为单位的精度，0~24类型为float，25~53类型为double|使用float映射，yashan已兼容p语法，无实际意义（超过定义范围报错），0~24定义为float，25~53定义为double|1、指定 DOUBLE(p)，插入数据的数字位数 <= 24, 查询记录，列类型为 MY_TYPE_FLOAT，值正确,2、指定 DOUBLE(p)，插入数据的数字位数 >=25 & <=53，查询记录，列类型为 MY_TYPE_DOUBLE，值正确,3、指定   FLOAT  (p)，插入数据的数字位数 <= 24, 查询记录，列类型为 MY_TYPE_FLOAT，值正确,4、指定   FLOAT  (p)，插入数据的数字位数 >=25 & <=53，查询记录，列类型为 MY_TYPE_DOUBLE，值正确|
|10|BOOLEAN|同义词：  TINYINT(1)、BOOL,支持输入：  0/1，'0'/'1'，true/false,不支持输入：'true'/'false'，' t'/'f'， 'on'/'off'， 'yes'/'no'|使用tinyint映射，  **支持输入的规格与mysql一致**|1、插入 0、1、非 0 值；查询记录，列类型为 MY_TYPE_TINY，值正确,2、TRUE =1，FALSE =0，使用如下查询验证：SELECT IF(0 = FALSE, 'true', 'false');SELECT IF(1 = TRUE, 'true', 'false');SELECT IF(2 = TRUE, 'true', 'false');SELECT IF(2 = FALSE, 'true', 'false');分别返回：true、true、false、false,3、使用同义词 TINYINT(1)、BOOL 创建表，插入记录，查询记录，列类型为 MY_TYPE_TINY，值正确  --显示宽度会是 4 ,  
|
|11|DATE|同义词：无，范围：  1000-01-01~9999-12-31|使用date映射，按yashan规格（范围  0001-01-01 00:00:00 ~ 9999-12-31 23:59:59，比MySQL大  ）|1、零值：  '0000-00-00',2、值验证：典型值、边界值(同时覆盖：mysql 及 yashandb 的边界值)、超过范围、格式不正确；查询值正确，列类型为：MY_TYPE_TIMESTAMP,3、值覆盖：字符串类型、数字类型|
|12|DATETIME  [(fsp)]|同义词：无，范围：  1000-01-01 00:00:00.000000~9999-12-31 23:59:59.999999,fsp定义微秒的精度，  范围0~6|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）|1、自动更新列：  DEFAULT CURRENT_TIMESTAMP、ON UPDATE CURRENT_TIMESTAMP ，SQL 层不支持，暂不关注,2、零值验证：'0000-00-00 00:00:00',3、值验证：典型值、边界值(同时覆盖：mysql 及 yashandb 的边界值)、超过范围、格式不正确,4、带不同的 fsp 创建 DATETIME 类型，fsp 覆盖：-1、0、3、6、7，合法值列创建成功，插入值覆盖不同的精度，查询值正确，列类型为：MY_TYPE_TIMESTAMP,5、不带 fsp 创建列，默认值为 0   ----默认值不一样；后续会修改，目前暂时不关注,6、值覆盖：字符串类型、数字类型|
|13|TIME  [(fsp)]|同义词：无，范围：  -838:59:59.000000~838:59:59.000000|使用time映射，按yashan规格（范围  00:00:00.000000 ~ 23:59:59.999999，  **比MySQL范围小，超过报错**  **）**|1、零值：  '00:00:00',2、值验证：典型值、边界值(同时覆盖：mysql 及 yashandb 的边界值)、超过范围、格式不正确,3、带不同的 fsp 创建 DATETIME 类型，fsp 覆盖：-1、0、3、6、7，合法值列创建成功，插入值覆盖不同的精度，查询值正确，列类型为：MY_TYPE_TIME,4、不带 fsp 创建列，默认值为 0    ,5、值覆盖：字符串类型、数字类型|
|14|TIMESTAMP  [(fsp)]|同义词：无，范围：  1970-01-01 00:00:01.000000 UTC ~2038-01-19 03:14:07.999999 UTC|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）|1、自动更新列：  DEFAULT CURRENT_TIMESTAMP、ON UPDATE CURRENT_TIMESTAMP ，SQL 层不支持，暂不关注,2、零值验证：'0000-00-00 00:00:00',3、值验证：典型值、边界值(同时覆盖：mysql 及 yashandb 的边界值)、超过范围、格式不正确,4、带不同的 fsp 创建 DATETIME 类型，fsp 覆盖：-1、0、3、6、7，合法值列创建成功，插入值覆盖不同的精度，查询值正确，列类型为：MY_TYPE_TIMESTAMP,5、时区相关--暂不支持，不验证,6、不带 fsp 创建列，默认值为 0   ----默认值不一样；后续会修改，目前暂时不关注,7、分别指定 --explicit-defaults-for-timestamp[={OFF|ON}] 验证功能  ---跟自动更新列有关，不支持,8、值覆盖：字符串类型、数字类型|
|15|BINARY[(M)]|同义词：  CHAR BYTE  **（为了兼容，不支持使用时指定长度）**,范围0~255字节，  **缺省为1**  ；存储二进制字节字符串,![](https://pingcode.yasdb.com/atlas/files/public/67396e588970c2af4f521865/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE0ODIsImV4cCI6MTc4MjM4MjI4Mn0.rV_LVTaauht4fSuKXW_botKlZuWNgHq8Fxnus9IcbVM),**插入长度为0的方法和mysql允许将int转换为bin：**,mysql> insert into test_binary(c2)   **values('');**,mysql> insert into test_binary(c1)   **values(1);**,mysql> select * from test_binary;    
  +------+------+------+------+------+------+    
  | c1 | c2 | c3 | c4 | c6 | c8 |    
  +------+------+------+------+------+------+    
  | NULL | | NULL | NULL | NULL | NULL |    
  | 1 | NULL | NULL | NULL | NULL | NULL |    
  +------+------+------+------+------+------+    
  2 rows in set (0.00 sec)|使用raw映射，范围0~255，yashan已支持1~255，  **需支持0；实际长度小于定义长度时，不补0x00**|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、255、256，记录插入成功，查询返回列类型(  MY_TYPE_VAR_STRING  )及值正确,4、使用   CHAR BYTE 建表，插入记录并查询,-- 所有二进制类型，包括 BLOB 都不转测，暂不测试|
|16|VARBINARY(M)|同义词：无,范围0~65535字节，M不能省略（不带报错）|使用raw映射，范围0~8000，yashan已支持1~8000，  **需支持0；**  **8001~65535不支持报错**|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、65535、65536，记录插入成功，查询返回列类型(  MY_TYPE_VAR_STRING  )及值正确|
|17|CHAR[(M)]|同义词：  CHARACTER,范围0~255字节，缺省为1|使用char映射，范围0~255，yashan已支持1~255，  **需支持0**|1、字符长度定义列类型长度，按照字符长度来测试  ,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、255、256，记录插入成功，查询返回列类型(  MY_TYPE_STRING  )及值正确,4、使用   CHARACTER 创建表，并插入记录,5、关注后置空格，要去掉返回；|
|18|VARCHAR(M)|同义词：  ~~CHARACTER VARYING~~,范围0~65535字节，M不能省略（不带报错）|使用varchar映射，范围0~32000，yashan已支持1~8000，  **需支持0；**  **32001~65535不支持报错**|1、字符长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、65535、65536，记录插入成功，查询返回列类型(  MY_TYPE_VAR_STRING  )及值正确,4、使用   CHARACTER 创建表，并插入记录，查询,5、关注后置空格，要去掉返回；|
|19|NCHAR[(M)]|同义词：  NATIONAL CHAR、NATIONAL CHARACTER,范围0~255字符，缺省为1|使用nchar映射，范围0~255字符，yashan已支持1~255，  **需支持0**|1、字符长度定义列类型长度，按照字符长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、255、256，记录插入成功，查询返回列类型(  MY_TYPE_STRING  )及值正确,4、使用   NATIONAL CHAR   创建表，并插入记录，查询,5、使用 NATIONAL CHARACTER 创建表，并插入记录，查询,6、nchar 在 mysql-client 上支持；jdbc 上不支持   ---暂不支持，先提单|
|20|NVARCHAR(M)|同义词：  NATIONAL   VARCHAR、NATIONAL CHARACTER VARYING,范围0~65535字符，M不能省略（不带报错）|使用nvarchar映射，范围0~16000字符，yashan已支持1~16000，  **需支持0；**  **32001~65535不支持报错**|1、字符长度定义列类型长度，按照字符长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、65535、65536，记录插入成功，查询返回列类型(  MY_TYPE_VAR_STRING  )及值正确,4、使用   NATIONAL   VARCHAR     创建表，并插入记录，查询,5、使用 NATIONAL CHARACTER VARYING 创建表，并插入记录，查询|
|21|TINYBLOB|同义词：无，  范围0~255字节|使用  **BLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、255、256，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确,4、元数据是否有办法观察   MY_FIELD_FLAG_BLOB_FLAG 这个 flag 字段，下述映射成   MY_TYPE_BLOB 的类型类似|
|22|BLOB|同义词：无，范围  0~65535字节|同上|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、  65535  、  65536  ，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确|
|23|MEDIUMBLOB|同义词：无，范围0~  16777215字节|同上|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、  16777215  、  16777216  ，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确|
|24|LONGBLOB|同义词：无，范围0~  4294967295字节|同上|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、  4294967295  、  4294967296  ，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确|
|25|TINYTEXT|同义词：无，  范围0~255字节|使用  **CLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、  255  、  256  ，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确|
|26|TEXT|同义词：无，范围  0~65535字节|同上|1、字节长度定义列类型长度，按照字节长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、  65535  、  65536  ，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确|
|27|MEDIUMTEXT|同义词：无，范围0~  16777215字节|同上|1、字节长度定义列类型长度，按照字符长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、  16777215  、  16777216  ，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确|
|28|LONGTEXT|同义词：无，范围0~  4294967295字节|同上|1、字节长度定义列类型长度，按照字符长度来测试,2、指定非默认的字符集和排序规则来测试，通过插入与默认字符集和排序规则(查询带排序)不一样的数据来验证；---不支持,3、插入记录的长度覆盖：0、1、  4294967295  、  4294967296  ，记录插入成功，查询返回列类型(  MY_TYPE_BLOB  )及值正确|


- jdbc 驱动接口相关测试，具体可参考标准 JDBC 接口使用说明（    [java.sql (Java Platform SE 8 ) (oracle.com)](https://docs.oracle.com/javase/8/docs/api/java/sql/package-summary.html)    ），具体方法在测试设计中不列举


java.sql.Blob  --先不关注

java.sql.Clob

java.sql.DatabaseMetaData

java.sql.ParameterMetaData

java.sql.PreparedStatement

java.sql.ResultSet

java.sql.ResultSetMetaData

java.sql.Statement

- jdbc 驱动跟列类型相关的配置参数需测试；


clobberStreamingResults ---待测试    
    
  tinyInt1isBit ---目前 tinyint 的 M 不生效，与 mysql 无法对齐，暂不测试

transformedBitIsBoolean ------目前 tinyint 的 M 不生效，与 mysql 无法对齐，暂不测试

allowNanAndInf ---驱动端处理，不关注

emptyStringsConvertToZero ---驱动端的处理，不关注

padCharsWithSpace ---驱动端的处理，不关注

CLOB/BLOB 处理相关参数：MySQL :: MySQL Connector/J Developer Guide :: 6.3.10 BLOB/CLOB processing

blobSendChunkSize --- 待测试    
  blobsAreStrings --- blob 类型，本 sr 不关注    
  clobCharacterEncoding ---本 sr 不测试，目前不支持 blob，预期结果与 mysql 不一致，后续有 sr 转测    
  emulateLocators、locatorFetchBufferSize ---blob 类型，本 sr 不关注    
  functionsNeverReturnBlobs --blob 类型，本sr 不关注

  
  DATETIME 处理相关参数：MySQL :: MySQL Connector/J Developer Guide :: 6.3.11 Datetime types processing ---与时区有关，不测试

  


  


  


*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[COM_QUERY文本结果集支持LOB类型测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNThhMWFkOWEzMzExZGM5NmQ2IiwicmVmX2lkIjoiNjczOTZlNTg3MjgyMDZlZmI5MmYyNzZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDgyLCJleHAiOjE3ODI0NTc4ODJ9.8k_lReFmDFGnMIoLI1hm8fwB9_PdKDCWryxvFKVufic)

详见附件

# 5. 测试框架设计

- 适配 mysql-test 测试框架，目前原生测试用例无法执行，可以新增测试套的方式往该测试框架里边补充测试用例
- testng 测试框架，补充 mysql jdbc 驱动测试用例


# 6. 测试环境说明

*不涉及*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNThhMWFkOWEzMzExZGM5NmQ3IiwicmVmX2lkIjoiNjczOTZlNTg3MjgyMDZlZmI5MmYyNzZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDgyLCJleHAiOjE3ODI0NTc4ODJ9.je0Qa5S-qzc03hG813doAAVOvcUWZ6ZJ0wrzpO0_3oU)

## Attachments:

[COM_QUERY文本结果集支持基础类型测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTg4OTcwYzJhZjRmNTIxODYzIiwicmVmX2lkIjoiNjczOTZlNTg3MjgyMDZlZmI5MmYyNzZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDgyLCJleHAiOjE3ODI0NTc4ODJ9.Yz9y1tmhFbc7p5Ufv4h2HvOADGTLPlTidkdzE5yDHT4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-4-23_11-26-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTg4OTcwYzJhZjRmNTIxODY0IiwicmVmX2lkIjoiNjczOTZlNTg3MjgyMDZlZmI5MmYyNzZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDgyLCJleHAiOjE3ODI0NTc4ODJ9.X7xJXc_wENsgM_U4pC-PNu28KEM1OqVrJO5Vv2XpGWQ)

 (image/png)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNThhMWFkOWEzMzExZGM5NmQ3IiwicmVmX2lkIjoiNjczOTZlNTg3MjgyMDZlZmI5MmYyNzZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDgyLCJleHAiOjE3ODI0NTc4ODJ9.je0Qa5S-qzc03hG813doAAVOvcUWZ6ZJ0wrzpO0_3oU)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNThhMWFkOWEzMzExZGM5NmQ4IiwicmVmX2lkIjoiNjczOTZlNTg3MjgyMDZlZmI5MmYyNzZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDgyLCJleHAiOjE3ODI0NTc4ODJ9.3tAQdCAG4qYWoj1curPscHPZBaXEnTU6B9b8gh4WTB8)

 (application/msword)    


[COM_QUERY文本结果集支持LOB类型测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNThhMWFkOWEzMzExZGM5NmQ2IiwicmVmX2lkIjoiNjczOTZlNTg3MjgyMDZlZmI5MmYyNzZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDgyLCJleHAiOjE3ODI0NTc4ODJ9.8k_lReFmDFGnMIoLI1hm8fwB9_PdKDCWryxvFKVufic)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
