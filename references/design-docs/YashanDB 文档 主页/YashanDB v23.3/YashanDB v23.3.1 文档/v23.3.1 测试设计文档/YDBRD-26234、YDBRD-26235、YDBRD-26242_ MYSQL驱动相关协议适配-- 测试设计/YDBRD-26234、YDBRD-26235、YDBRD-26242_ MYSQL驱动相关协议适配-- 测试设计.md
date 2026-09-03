Created by 杜卓林, last modified on 七月 09, 2024

SR：

  [https://pingcode.yasdb.com/pjm/items/6618ffa0fd997db58ad87037](https://pingcode.yasdb.com/pjm/items/6618ffa0fd997db58ad87037)    ?    
  #YDBRD-26234 【mysql兼容】（协议）MYSQL驱动相关协议适配-支持普通类型二进制结果集fetch

  [https://pingcode.yasdb.com/pjm/items/6618fff7fd997db58ad87094](https://pingcode.yasdb.com/pjm/items/6618fff7fd997db58ad87094)    ?    
  #YDBRD-26235 【mysql兼容】（协议）MYSQL驱动相关协议适配-支持LOB类型二进制结果集fetch

  [https://pingcode.yasdb.com/pjm/items/6619041bfd997db58ad87b22](https://pingcode.yasdb.com/pjm/items/6619041bfd997db58ad87b22)    ?    
  #YDBRD-26242 【mysql兼容】（协议）MYSQL驱动相关协议适配-支持LOB类型批量绑定执行

  


# 1. 概述

【mysql兼容】（协议）MYSQL驱动相关协议适配

支持 普通类型 & LOB类型 二进制结果集fetch，支持LOB类型批量绑定执行

  


**二进制结果集触发条件：**

    连接参数：useServerPrepStmts=true

    执行方式 ：  **prepare+execute模式**

## 2.2 应用场景

用户使用 mysql client/mysql jdbc 驱动将数据同步/插入到 yashandb 服务端，通过 mysql client/mysql jdbc驱动查询不同数据类型的数据；测试场景均基于该前提。

- 部分数据类型 mysql server 与 yashandb 范围未严格一致，不考虑通过 yashandb 客户端插入数据，通过 mysql client 端获取数据的情况；


## 2.3 规格约束

无

  


# 3. 详细测试设计

## 3.1 测试设计方法

从功能出发，结合等价类、边界值的测试设计方法，输出测试设计。

测试策略：

#### 1、支持两种fetch模式

2、JDBC：设  参数    `useCursorFetch=`      `true`         `+ useServerPrepStmts=`      `true `    ，采用   prepare + execute 模式执行

3、在测试不同列类型的数据时，覆盖 JDBC 所有关于不同数据类型的查询接口，包括获取元数据接口、获取值的接口。特别是 LOB  类型的接口。

4、  覆盖2种批量执行的模式：  rewriteBatchedStatements=true、rewriteBatchedStatements=false 

5、超过列类型的范围处理，参考：    [MySQL :: MySQL 8.0 Reference Manual :: 13.1.7 Out-of-Range and Overflow Handling](https://dev.mysql.com/doc/refman/8.0/en/out-of-range-and-overflow.html)     ，  不支持 SQL MODE   

  


## 3.2 详细测试设计

|  
|数据类型|mysql|yashan类型映射|执行方式|测试点|元数据测试点|
|---|---|---|---|---|---|---|
|  
|  
|  
|  
|  `useServerPrepStmts=`      `true `  ,  `useCursorFetch=`      `true`     / false,  `rewriteBatchedStatements=true / false`  ,  
,  
,**YDBRD-26234 & YDBRD-26235**,1、默认fetch 带全部结果集,2、开启cursor  fetch + 绑定批量插入查询（  一次 add batch 一次 excute）,  
,  
,  
,**YDBRD-26242**,1、默认fetch+ 绑定批量插入查询（  一次 add batch 一次 excute）,2、默认fetch+ 绑定批量插入查询（一次 add batch 多次 excute）,3、开启cursor  fetch + 绑定批量插入查询（一次 add batch 一次 excute）|结合YDBRD-26241、YDBRD-26216遗留测试点，,  [YDBRD-26216: （协议）COM_QUERY文本结果集支持LOB类型测试总结 - 赵育 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156137730)  ,  [MYSQL遗留问题 - 冯皓博 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156137281)  ,  
,本次测试点：,（1）类型测试点,        类型范围取值（合法值、非法值、边界值、边界值运算超范围）,        精度范围取值（合法值、边界值、非法值）,        类型同义词,        针对字符类型：插入记录的长度覆盖还类型的最大长度,（2）元数据测试点,        显示宽度,        列类型,        列明,        数据正确性,        Precision 精度（字段长度）,        Scale      范围（小数位数）||
|1|TINYINT  [(M)]|MYSQL_TYPE_TINY,同义词：无，M表示显示宽度（[0,255]）,范围：-128~127|使用tinyint映射，数据范围一致，  **支持带M的语法**,YSDB_TINYINT|  
|**有符号 & 无符号均适用**,1、范围：[-128，127],2、精度范围：[0,255]，取 -1，0，255，256，  查询值正常显示   ,     --- 已经支持M，需关注元数据变动,3、无同义词,4、算数运算，超过本类型边界值会自动类型提升，不报错,5、  使用 min、max 函数计算 ，  查询值正常显示,  
|1、显示宽度,          有符号：4,          无符号：3,2、列类型   MY_TYPE_TINY,3、列名,4、列大小   Precision  ​,5、批量插入结果数,6、查询数据正确性|
|2|SAMLLINT  [(M)]|MY_TYPE_SHORT,同义词：无，M表示显示宽度（[0,255]）,范围：  -32768  ~  32767|使用smallint映射，数据范围一致，  **支持带M的语法**,YSDB_SMALLINT|  
|**有符号 & 无符号均适用**,1、范围：[  -32768，  32767  ],2、精度范围：[0,255]，取 -1，0，255，256，  查询值正常显示       ,--- 已经支持M，需关注元数据变动   ,3、无同义词,4、算数运算，超过本类型边界值会自动类型提升，不报错,5、  使用 min、max 函数计算 ，  查询值正常显示|同上,变动点：,1、显示宽度,          有符号：5,          无符号：6,2、列类型    MY_TYPE_SHORT|
|3|INTEGER  [(M)]|MY_TYPE_LONG,同义词：INT，M表示显示宽度（[0,255]）,范围：-  2147483648~2147483647|使用integer映射，数据范围一致，  **支持带M的语法**,YSDB_INTEGER|  
|**有符号 & 无符号均适用**,1、范围：[-  2147483648，2147483647  ],2、精度范围：[0,255]，取 -1，0，255，256，  查询值正常显示         , --- 已经支持M，需关注元数据变动,3、同义词：INT,4、算数运算，超过本类型边界值会自动类型提升，不报错,5、  使用 min、max 函数计算 ，  查询值正常显示|同上,变动点：,1、显示宽度,          有符号：10,          无符号：11,2、列类型   MY_TYPE_LONG|
|4|MEDIUMINT  [(M)]|MY_TYPE_LONG,同义词：无，M表示显示宽度（[0,255]）,范围：  -8388608~8388607|**使用**  **integer**  **映射，范围同integer（比MySQL大），**  **支持带M的语法**,YSDB_INTEGER|  
|**有符号 & 无符号均适用**,1、范围：[  -8388608，8388607  ]， 需测试 [-  2147483648，2147483647  ],2、精度范围：[0,255]，取 -1，0，255，256，  查询值正常显示          ,--- 已经支持M，需关注元数据变动,3、无同义词,4、算数运算，超过本类型边界值会自动类型提升，不报错,5、  使用 min、max 函数计算 ，  查询值正常显示|同上,变动点：,1、显示宽度,          有符号：10,          无符号：11,2、列类型   MY_TYPE_LONG|
|5|BIGINT  [(M)]|MY_TYPE_LONGLONG,同义词：无，M表示显示宽度（[0,255]）,范：  -9223372036854775808~9223372036854775807|使用bigint映射，数据范围一致，  **支持带M的语法**,YSDB_BIGINT|  
|**有符号 & 无符号均适用**,1、范围：[  -9223372036854775808，9223372036854775807  ],2、精度范围：[0,255]，取 -1，0，255，256，  查询值正常显示          ,--- 已经支持M，需关注元数据变动,3、无同义词,4、算数运算，不报错   ------  bigint运算提升为NUMBER,5、  使用 min、max 函数计算 ，  查询值正常显示|同上,变动点：,1、显示宽度,          有符号：20,          无符号：20,2、列类型   MY_TYPE_LONGLONG|
|6|DECIMAL     [(M [,D])]|MY_TYPE_NEWDECIMAL,同义词：  DEC、FIXED，NUMERIC,M是总位数，D是小数点后的位数，,M：[1,65]，D：[0,30]，且D <= M,缺省(10,0)|使用  **NUMBER(P,S)**  映射  **，M和D的范围以yashan为准（**  MySQL的范围比yashan大，超过yashan范围报错）  **，取值：(-1E126，-1E-130]、**  **0和[1E-130，1E126)**,P：精度，表示数字的有效位数，取值范围[1,38],S：刻度，表示数字从小数点到最右侧有效数字的位数，取值范围[-84,127]|  
|1、范围：  **(-1E126，-1E-130]、**  **0、[1E-130，1E126)、整数**,2、不指定M/D ，默认为(10,0)  ------     **与mysql一致**,3、指定M/D,         (1) 0 > M >= D & M < D < 0;,         (2) M >= D >0 &  0< M < D ;,4、  M 值覆盖：-1、0、65、66，查询值正常显示,5、D 值覆盖：-1、0、30、31  ，查询值正常显示,6、同义词   DEC、FIXED，NUMERIC,7、算数运算，计算 decimal 列类型、超范围的场景 -----  不报错,8、  使用 min、max 函数计算 ，  查询值正常显示,9、使用语法 DECIMAL（M）创建列，插入小数、整数值；查询记录，列类型为      MY_TYPE_NEWDECIMAL  ，值正确；,10、使用 DECIMAL 创建列，插入数字位数 > 10 的小数、数字位数 > 10 的整数值；查询记录值正确；----  跟 yashandb 表现不一致；提单跟踪？是否已修改？,  
|1、显示宽度,         D > 0 ? M + 2 : M + 1,          有符号：4,          无符号：3,2、列类型   MY_TYPE_NEWDECIMAL,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|7|DOUBLE  ([M, D])|MY_TYPE_DOUBLE,同义词：  DOUBLE PRECISION，REAL,M是总位数，D是小数点后的位数，0 < M <= 255,  0 <= D <= 30, 并且D <= M，  **可精确到15个小数位**,-1.7976931348623157E+308到-2.2250738585072014E-308,0和2.2250738585072014E-308到1.7976931348623157E+308|使用double映射，  **yashan已兼容M/D语法，超过定义范围报错**,  
|  
|1、范围：[  -1.79769313486232E308， -4.94065645841247E-324]  、0、  [4.94065645841247E-324， 1.79769313486232E308]   整数,2、不指定M/D ，默认为(10,0) ？ ------     **与mysql一致**,3、指定M/D,         (1) 0 > M >= D & M < D < 0;,         (2) M >= D >0 &  0< M < D ;,4、  M 值覆盖：-1、0、65、66，查询值正常显示,5、D 值覆盖：-1、0、30、31  ，查询值正常显示,6、同义词  DOUBLE PRECISION，REAL,  
,打印格式可能有差异|1、显示宽度：  ** 22 ？**,2、列类型   MY_TYPE_DOUBLE,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性,  
,遗留问题3  ：  double 类型使用 meteData.getColumnDisplaySize(1) 获取的列最大长度不对，预期为 10，实际22； — 已提单，等M合入后修正|
|8|FLOAT  ([M, D])|MY_TYPE_FLOAT,同义词：无，M/D含义和范围同上，  **精度为小数点后7位**,-3.402823466E+38到-1.175494351E-38,0和1.175494351E-38到3.402823466E+38|使用float映射，  **yashan已兼容M/D，超过定义范围报错**|  
|1、范围：  [-3.402823E38,，-1.401298E-45]  、0、  [1.401298E-45，3.402823E38]     整数,2、不指定M/D ，默认为(10,0) ？  ------     **与mysql一致**,3、指定M/D,         (1) 0 > M >= D & M < D < 0;,         (2) M >= D >0 &  0< M < D ;,4、  M 值覆盖：-1、0、65、66，查询值正常显示,5、D 值覆盖：-1、0、30、31  ，查询值正常显示,6、同义词  DOUBLE PRECISION，REAL,  
,打印格式可能有差异|1、显示宽度：12,2、列类型   MY_TYPE_FLOAT,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|9|DOUBLE(p),FLOAT(p)|p表示以位为单位的精度，0~24类型为float，25~53类型为double|使用float映射，yashan已兼容p语法，无实际意义（超过定义范围报错），0~24定义为float，25~53定义为double|1、float的p范围0<=p<=126，  大于53小于等于126的部分会当作53处理,2、m或者p值超过23，系统将类型转换为DOUBLE类型|1、范围 同 DOUBLE  ([M, D])、  FLOAT  ([M, D]),2、指定 DOUBLE(p),         (1) p<=24；  列类型为 MY_TYPE_FLOAT，值正确,         (2) 53>=p>=25；  列类型为 MY_TYPE_DOUBLE，值正确,         (3) p<=0 / p>126 ------------报错,3、指定 FLOAT(p),         (1) 0<=p<=24；  列类型为 MY_TYPE_FLOAT，值正确,         (2) 53>=p>=25；  列类型为 MY_TYPE_DOUBLE，值正确,         (3) 54<=p<=126;列类型为 MY_TYPE_DOUBLE，值正确,         (4) p  <=0 / p>126 ------------报错,  
,打印格式可能有差异|1、显示宽度,          有符号：  12   /    22,          无符号：  12    /   22,2、列类型   MY_TYPE_DOUBLE /   MY_TYPE_FLOAT,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|10|BOOLEAN|MY_TYPE_TINY,同义词：  TINYINT(1)、BOOL,支持输入：  0/1，'0'/'1'，true/false,不支持输入：'true'/'false'，' t'/'f'， 'on'/'off'， 'yes'/'no'|使用tinyint映射，  **支持输入的规格与mysql一致**|  
|**有符号 & 无符号均适用**,1、范围：  0/1，'0'/'1'，true/false,2、插入 0、1、非 0 值；查询记录，列类型为 MY_TYPE_TINY，值正确,3、同义词 TINYINT(1)、BOOL   ------    显示宽度会是 4 ,4、查询验证TRUE =1，FALSE =0,SELECT IF(0 = FALSE, 'true', 'false');        -----       true,SELECT IF(1 = TRUE, 'true', 'false');          -----       true,SELECT IF(2 = TRUE, 'true', 'false');          -----       false,SELECT IF(2 = FALSE, 'true', 'false')          -----       false|1、显示宽度：  4    ------   与  **MYSQL差异，MySQL为1**,2、列类型 MY_TYPE_TINY,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性,  
,tinyInt1isBit =true(默认)，且tinyInt存储长度为1 ，则转为java.lang.Boolean; 否则转为java.lang.Integer,tinyInt1isBit=true 时meteData.getColumnType为 -7，宽度为1,tinyInt1isBit=false时meteData.getColumnType为 -6，宽度为1|
|11|DATE|MY_TYPE_DATE,同义词：无,范围：  1000-01-01~9999-12-31,DATE 没有精度|使用date映射，按yashan规格（范围  0001-01-01 00:00:00 ~ 9999-12-31 23:59:59，  **比MySQL大**  ）,DATE 没有精度,格式：  "YYYY-MM-DD"|  
  2、  DATETIME，同 TIMESTAMP  ---元数据类型不对，先提单跟踪； ---  已提单    
    
,  
|1、范围：[  0001-01-01 00:00:00 ， 9999-12-31 23:59:59  ],2、零值：  '0000-00-00',3、  值验证：典型值、边界值（mysql 及 yashandb 的边界值），查询值正确,4、  字符串类型、数字类型,  
|1、显示宽度  ：  10,2、列类型   MY_TYPE_DATE,3、列名,4、  批量插入结果数,5、查询数据正确性|
|12|DATETIME  [(fsp)]|MY_TYPE_TIMESTAMP,同义词：无,范围：  1000-01-01 00:00:00.000000~9999-12-31 23:59:59.999999,fsp定义微秒的精度，  **范围0~6，默认为0**|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）,**fsp没限制范围，无法设置？设置后无效？**,**默认为6**,  
,  
,**格式：**  **"yyyy-mm-dd hh24:mi:ss.ff"**||1、范围：[  1-1-1 00:00:00.000000 ， 9999-12-31 23:59:59.999999  ],2、零值验证：'0000-00-00 00:00:00',3、值验证：典型值、边界值（mysql 及 yashandb 的边界值），查询值正确,4、不带 fsp 创建列，默认值为 6？,5、fsp 覆盖：-1、0、3、6、7 ---  合法值列创建成功，插入值覆盖不同的精度，查询值正确,6、值覆盖：字符串类型、数字类型,  
,打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|1、显示宽度  ：  fsp  >0 ? 20  +  fsp   :19,2、列类型   MY_TYPE_TIMESTAMP,3、列名,4、  批量插入结果数,5、查询数据正确性,  
,遗留问题5  ：  DATETIME 类型使用 meteData.getColumnTypeName(1) 获取列类型，预期为 DATETIME，实际为 TIMESTAMP ------   结论：  可以和MYSQL一致，映射成对应类型|
|13|TIME  [(fsp)]|MY_TYPE_TIME,同义词：无，范围：  -838:59:59.000000~838:59:59.000000,fsp定义微秒的精度，  **范围0~6，默认为0 **|使用time映射，按yashan规格（范围  00:00:00.000000 ~ 23:59:59.999999，  **比MySQL范围小，超过报错**  **）**,**fsp没限制范围，无法设置？设置后无效？**,**默认为6**,  
,**格式：**  **"hh24:mi:ss.ff"**||1、范围：[  00:00:00.000000 ， 23:59:59.999999  ],2、零值：'00:00:00',3、值验证：典型值、边界值（mysql 及 yashandb 的边界值），查询值正确,4、不带 fsp 创建列，默认值为 6？,5、fsp 覆盖：-1、0、3、6、7 ---  合法值列创建成功，插入值覆盖不同的精度，查询值正确,6、值覆盖：字符串类型、数字类型,  
,打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|1、显示宽度  ：  fsp   > 0 ? 11 +     fsp   : 10,2、列类型   MY_TYPE_TIME,3、列名,4、  批量插入结果数,5、查询数据正确性|
|14|TIMESTAMP  [(fsp)]|MY_TYPE_TIMESTAMP,同义词：无,范围：  1970-01-01 00:00:01.000000 UTC ~2038-01-19 03:14:07.999999 UTC,fsp定义微秒的精度，  **范围0~6，默认为 0**|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）,  
,1、fsp没限制范围--  **无法设置？设置后无效？**,2、yashan不支持time'23:59:59.999999'写法,3、fsp  范围是 1-6，默认精度是6；,  
,**格式：**  **"yyyy-mm-dd hh24:mi:ss.ff"**||1、范围：[  1-1-1 00:00:00.000000 ， 9999-12-31 23:59:59.999999  ],2、零值：'0000-00-00 00:00:00',3、值验证：典型值、边界值（mysql 及 yashandb 的边界值），查询值正确,4、不带 fsp 创建列，默认值为 6？,5、fsp 覆盖：-1、0、3、6、7 ---  合法值列创建成功，插入值覆盖不同的精度，查询值正确,6、值覆盖：字符串类型、数字类型,  
,打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|1、显示宽度  ：  fsp  >0 ? 20   +   fsp   : 19,2、列类型   MY_TYPE_TIMESTAMP,3、列名,4、  批量插入结果数,5、查询数据正确性|
|15|CHAR[(M)]|MY_TYPE_STRING,同义词：  CHARACTER,范围0~255字节，缺省为1|使用char映射，范围0~255，yashan已支持1~255，  **需支持0**|  
|1、范围：[1，255]、中英文、  ""，“ ”，null,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：  CHARACTER,4、插入记录的长度覆盖：0、1、255、256，记录插入成功，查询返回列类型(  MY_TYPE_STRING  )及值正确,5、后置空格返回需去掉|1、显示宽度  ：,M * 服务端字符集最大字符数  -----  与  **SQL_MODE相关**,**默认为？**,2、列类型   MY_TYPE_STRING,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|16|VARCHAR(M)|MY_TYPE_VAR_STRING,同义词：  ~~CHARACTER VARYING~~,范围0~65535字节，M不能省略（不带报错）|使用varchar映射，范围0~32000，yashan已支持1~8000，  **需支持0；**  **32001~65535不支持报错**,varchar 类型最大支持 32000 字节，,mysql server 字符数=32000/3, ,yashandb 字符数=  32000/4，,中文支持的字符数：16000/3=5333|  
|1、范围：[1，8000]、中英文、  ""，“ ”，null ,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：无？,4、插入记录的长度覆盖：0、1、65535、65536，记录插入成功，查询返回列类型(  MY_TYPE_STRING  )及值正确,5、后置空格返回需去掉,  
,  
|1、显示宽度  ：,M * 服务端字符集最大字符数  -----  与  **SQL_MODE相关**,**默认为？**,2、列类型：   MY_TYPE_VAR_STRING,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|17|NCHAR[(M)]|MY_TYPE_STRING,同义词：  NATIONAL CHAR、NATIONAL CHARACTER,范围0~255字符，缺省为1|使用nchar映射，范围0~255字符，yashan已支持1~255，  **需支持0**|遗留问题2：,nchar+nvarchar不支持jdbc  ---  已支持   ,  
  遗留问题6：,当前Yashan NCHAR+NVARCHAR映射为NCHAR+NVARCHAR,MYSQL 的 NCHAR同CHAR,NVARCHAR同VARCHAR,区别在于字符集，系列是utf8,---    先映射成CHAR+VARCHAR|1、范围：[1，255]、中英文、  ""，“ ”，null,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：  NATIONAL CHAR、NATIONAL CHARACTER,4、插入记录的长度覆盖：0、1、255、256，记录插入成功，查询返回列类型(  MY_TYPE_STRING  )及值正确,5、后置空格|1、显示宽度  ：  **M*4(UTF16 max len)**,2、列类型：   MY_TYPE_STRING,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|18|NVARCHAR(M)|MY_TYPE_STRING,同义词：  NATIONAL   VARCHAR、NATIONAL CHARACTER VARYING,范围0~65535字符，M不能省略（不带报错）|使用nvarchar映射，范围0~16000字符，yashan已支持1~16000，  **需支持0；**  **32001~65535不支持报错**||1、范围：[1~16000]、中英文、  ""，“ ”，null,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：  NATIONAL   VARCHAR、NATIONAL CHARACTER VARYING,4、插入记录的长度覆盖：0、1、65535、65536，记录插入成功，查询返回列类型(  MY_TYPE_STRING  )及值正确,5、后置空格返回需去掉|1、显示宽度  ：  ** **  **M*4(UTF16 max len)**,2、列类型：   MY_TYPE_VAR_STRING,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|19|TINYTEXT|MY_TYPE_BLOB,同义词：无，  范围0~255字节|使用  **BLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|遗留点：    
  **longtext**   类型可以到 4G byte，实际上目前测试最大值只测试到 1G，更长的字符串会超过 max_allowed_package  而报错，暂时没找到办法构造这种测试场景；    
    
,遗留问题4：,text/mediumtext 类型使用 meteData.getColumnDisplaySize(1) 获取的列最大长度不对，预期为 4194303，实际为 536870911,  
,遗留问题：,1、pstmt.setClob(1, clob); 指定字符集目前暂不支持，暂未测试,  
|1、范围：[1， 255]、中英文、  ""，“ ”，null,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：无,4、插入记录的长度覆盖：0、1、  255  、  256  ，记录插入成功，查询返回值正确|1、显示宽度  ：  ** **  **4294967295**,2、列类型：   MY_TYPE_BLOB,3、列名,4、  precision & scale,5、批量插入结果数,6、查询数据正确性|
|20|TEXT|MY_TYPE_BLOB,同义词：无，范围  0~65535字节|同上||1、范围：[1， 65535]、中英文、  ""，“ ”，null,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：无,4、插入记录的长度覆盖：0、1、  65535  、  65536  ，记录插入成功，查询返回值正确|同  TINYTEXT|
|21|MEDIUMTEXT|MY_TYPE_BLOB,同义词：无，范围0~  16777215字节|同上||1、范围：[1，  16777215  ]、中英文、  ""，“ ”，null,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：无,4、插入记录的长度覆盖：0、1、  16777215  、  16777216  ，记录插入成功，查询返回值正确|同  TINYTEXT|
|22|LONGTEXT|MY_TYPE_BLOB,同义词：无，范围0~  4294967295字节|同上||1、范围：[1，   4294967295  ]、中英文、  ""，“ ”，null,2、字符长度定义列类型长度，按照字符长度来测试,3、同义词：无,4、插入记录的长度覆盖：0、1、  4294967295  、  4294967296  ，记录插入成功，查询返回值正确|同  TINYTEXT|
|23|TINYBLOB|同义词：无，  范围0~255字节|使用  **BLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|遗留问题：,blob 不支持，暂未测试    
    
    
|-- 尚不支持二进制数据格式，本SR不测试|  
|
|24|BLOB|同义词：无，范围  0~65535字节|同TINYBLOB||-- 尚不支持二进制数据格式，本SR不测试|  
|
|25|MEDIUMBLOB|同义词：无，范围0~  16777215字节|同TINYBLOB||-- 尚不支持二进制数据格式，本SR不测试|  
|
|26|LONGBLOB|同义词：无，范围0~  4294967295字节|同TINYBLOB||-- 尚不支持二进制数据格式，本SR不测试|  
|
|27|BINARY[(M)]|同义词：CHAR BYTE  **（为了兼容，不支持使用时指定长度）**,范围0~255字节，  **缺省为1**  ；存储二进制字节字符串,![](https://pingcode.yasdb.com/atlas/files/public/67396e5a8970c2af4f521869/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE1MzMsImV4cCI6MTc4MjM4MjMzM30.KnUPD_4ghrnXM_eukzDIwRWgOyOSN7pT_7gBqcOSUv0),**插入长度为0的方法和mysql允许将int转换为bin：**,mysql> insert into test_binary(c2)   **values('');**,mysql> insert into test_binary(c1)   **values(1);**,mysql> select * from test_binary;    
  +------+------+------+------+------+------+    
  | c1 | c2 | c3 | c4 | c6 | c8 |    
  +------+------+------+------+------+------+    
  | NULL | | NULL | NULL | NULL | NULL |    
  | 1 | NULL | NULL | NULL | NULL | NULL |    
  +------+------+------+------+------+------+    
  2 rows in set (0.00 sec)|使用raw映射，范围0~255，yashan已支持1~255，  **需支持0；实际长度小于定义长度时，不补0x00**|  
|-- 尚不支持二进制数据格式，本SR不测试|  
|
|28|VARBINARY(M)|同义词：无,范围0~65535字节，M不能省略（不带报错）|使用raw映射，范围0~8000，yashan已支持1~8000，  **需支持0；**  **8001~65535不支持报错**|  
|-- 尚不支持二进制数据格式，本SR不测试|  
|


- jdbc 驱动跟列类型相关的配置参数需测试；


tinyInt1isBit --- 待测试

transformedBitIsBoolean ------待测试

  


- java 驱动的接口需要补测  


text setString、  setClob；

滚动结果、  可更新结果 ---已拦截，未测试，是否要测？

  


#### 支持两种fetch模式：

1、默认fetch方式为服务端一直推送结果集到客户端，这样内存最大使用值为结果集大小，可能引发驱动测 OOM

- COM_STMT_EXECUTE后带全部结果集


2、cursor fetch方式为根据设置的fetchsize确认每次往返给客户端的结果集行数，同yashandb默认模式

- COM_STMT_EXECUTE后一行结果集都不带
- COM_STMT_FETCH后带fetchsize行结果集


#### jdbc开启方式：

1、连接参数：

|  `useCursorFetch=`      `true`         `+ useServerPrepStmts=`      `true`  |
|:---|


2、使用：

|  `pstmt = connection.prepareStatement(`      `"select * from test_cursor_fetch"`      `, ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY);`      
    `pstmt.setFetchSize(100);`      
    `pstmt.setFetchDirection(ResultSet.FETCH_FORWARD);`  |
|:---|


  


*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
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


详见附件

# 5. 测试框架设计

- testng 测试框架，补充 mysql jdbc 驱动测试用例


# 6. 测试环境说明

*不涉及*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

## Attachments: