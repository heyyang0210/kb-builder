Created by 冯皓博, last modified on 六月 04, 2024

  [https://pingcode.yasdb.com/pjm/items/6618f665fd997db58ad85c83](https://pingcode.yasdb.com/pjm/items/6618f665fd997db58ad85c83)    ?    
  #YDBRD-26216 【mysql兼容】（协议）COM_QUERY文本结果集支持LOB类型

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

【mysql兼容】协议支持原生兼容COM_QUERY触发结果集类型：    
  支持tinytext、text、mediumtext、longtext类型    
  支持tinyblob、blob、mediumblob、longblob类型

PS：本特性同时转测所有之前COM_QUERY未支持的结果集类型，包括其元数据+数据

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

外场mysql

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [https://conf.yasdb.com/x/4u0eCQ](https://conf.yasdb.com/x/4u0eCQ)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

类型映射+元数据+数据规格确认：

|序号|数据类型|MySQL规格|YaShan兼容策略、规则|MYSQL实现|映射MYSQL宏值|字符集|显示宽度|decimal|结果集协议格式|元数据差异|数据差异|
|---|---|---|---|---|---|---|---|---|---|---|---|
|1|TINYINT  [(M)]|同义词：无，M表示显示宽度（[0,255]），范围：-128~127|使用tinyint映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_TINY|YSMY_CHARSET_BIN = 63|有符号：4,无符号：3,**PS：此处带M的语法待实现**|0|整数|  
|  
|
|2|SMALLINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -32768  ~  32767|使用smallint映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_SHORT|YSMY_CHARSET_BIN = 63|有符号：5,无符号：6,**PS：此处带M的语法待实现**|0|整数|  
|  
|
|3|INTEGER[(M)]|同义词：INT，M表示显示宽度（[0,255]），范围：-  2147483648~2147483647|使用integer映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_LONG|YSMY_CHARSET_BIN = 63|有符号：10,无符号：11,**PS：此处带M的语法待实现**|0|整数|  
|  
|
|4|BIGINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -9223372036854775808~9223372036854775807|使用bigint映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_LONGLONG|YSMY_CHARSET_BIN = 63|20,**PS：此处带M的语法待实现**|0|整数|  
|  
|
|5|MEDIUMINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -8388608~8388607|使用  **integer**  映射，范围同integer（比MySQL大），  **支持带M的语法，无实际意义**|  
|MY_TYPE_LONG|YSMY_CHARSET_BIN = 63|有符号：10,无符号：11,**PS：此处带M的语法待实现**,**同**  **INTEGER**|0|整数|暂时差异，后续补全|  
|
|6|DECIMAL     [(M [,D])]|同义词：  DEC、FIXED，NUMERIC,M是总位数，D是小数点后的位数，M的范围为[1,65]，D的范围[0,30]，且D <= M，M缺省10，D缺省0|使用  NUMBER(P,S)  映射  **，M和D的范围以yashan为准（MySQL的范围比yashan大，超过yashan范围报错），取值：(-1E126，-1E-130]、**  **0和[1E-130，1E126)**,P：精度，表示数字的有效位数，取值范围[1,38],S：刻度，表示数字从小数点到最右侧有效数字的位数，取值范围[-84,127]|  
|MY_TYPE_NEWDECIMAL|YSMY_CHARSET_BIN = 63|D > 0 ? M + 2 : M + 1|D|  
|默认p、s不同|  
|
|7|DOUBLE  ([M, D])|同义词：  DOUBLE PRECISION，REAL,M是总位数，D是小数点后的位数，0 < M <= 255,  0 <= D <= 30, 并且D <= M，可精确到15个小数位,-1.7976931348623157E+308到-2.2250738585072014E-308,0和2.2250738585072014E-308到1.7976931348623157E+308|使用double映射，  **yashan已兼容M/D语法，无实际意义（超过定义范围报错）**,[-1.79769313486232E308, -4.94065645841247E-324]、  0  、[4.94065645841247E-324, 1.79769313486232E308]|  
|MY_TYPE_DOUBLE|YSMY_CHARSET_BIN = 63|22,**PS：此处带M的语法待实现**|0x1f,**PS：此处带D的语法待实现**|  
|  
|打印格式可能有差异|
|8|FLOAT  ([M, D])|同义词：无，M/D含义和范围同上，精度为小数点后7位,-3.402823466E+38到-1.175494351E-38,0和1.175494351E-38到3.402823466E+38|使用float映射，  **yashan已兼容M/D，无实际意义（超过定义范围报错）**,[-3.402823E38, -1.401298E-45]、  0、  [1.401298E-45, 3.402823E38]|  
|MY_TYPE_FLOAT|YSMY_CHARSET_BIN = 63|12,**PS：此处带M的语法待实现**|0x1f,**PS：此处带D的语法待实现**|  
|  
|打印格式可能有差异|
|9|DOUBLE(p),FLOAT(p)|p表示以位为单位的精度，0~24类型为float，25~53类型为double|使用float映射，yashan已兼容p语法，无实际意义（超过定义范围报错），0~24定义为float，25~53定义为double|【  **yashan**  】1、float的p范围0<=p<=126，  大于53小于等于126的部分会当作53处理,2、m或者p值超过23，系统将类型转换为DOUBLE类型|MY_TYPE_FLOAT,MY_TYPE_DOUBLE|YSMY_CHARSET_BIN = 63|12/22,**显示长度与M无关**|0x1f|  
|  
|打印格式可能有差异|
|10|BOOLEAN|同义词：  TINYINT(1)、BOOL,支持输入：  0/1，'0'/'1'，true/false,不支持输入：'true'/'false'，' t'/'f'， 'on'/'off'， 'yes'/'no'|使用tinyint映射，  **支持输入的规格与mysql一致**|  
|MY_TYPE_TINY|YSMY_CHARSET_BIN = 63|4,**和MYSQL差异，MySQL为1（本质是**  **TINYINT**  **[(M)]未实现M）**|0|整数|显示宽度差异|  
|
|11|DATE|同义词：无，范围：  1000-01-01~9999-12-31|使用date映射，按yashan规格（范围  0001-01-01 00:00:00 ~ 9999-12-31 23:59:59，比MySQL大  ）|  
|MY_TYPE_DATE|YSMY_CHARSET_BIN = 63|10|0|"YYYY-MM-DD"|  
|  
|
|12|DATETIME  [(fsp)]|同义词：无，范围：  1000-01-01 00:00:00.000000~9999-12-31 23:59:59.999999,fsp定义微秒的精度，  范围0~6|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）|fsp没限制范围|MY_TYPE_TIMESTAMP|YSMY_CHARSET_BIN = 63|fsp  >0?20  +  fsp  :19|fsp|"yyyy-mm-dd hh24:mi:ss.ff"|  
|打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|
|13|TIME  [(fsp)]|同义词：无，范围：  -838:59:59.000000~838:59:59.000000|使用time映射，按yashan规格（范围  00:00:00.000000 ~ 23:59:59.999999，  **比MySQL范围小，超过报错**  **）**|1、fsp没限制范围,2、yashan不支持time'23:59:59.999999'写法|MY_TYPE_TIME|YSMY_CHARSET_BIN = 63|fsp   > 0 ? 11 +   fsp   : 10|fsp|"hh24:mi:ss.ff"|  
|打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|
|14|TIMESTAMP  [(fsp)]|同义词：无，范围：  1970-01-01 00:00:01.000000 UTC ~2038-01-19 03:14:07.999999 UTC|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）|fsp没限制范围|MY_TYPE_TIMESTAMP|YSMY_CHARSET_BIN = 63|fsp  >0?20  +  fsp  :19|fsp|"yyyy-mm-dd hh24:mi:ss.ff"|  
|打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|
|15|BINARY[(M)]|同义词：  CHAR BYTE  **（为了兼容，不支持使用时指定长度）**,范围0~255字节，  **缺省为1**  ；存储二进制字节字符串,![](https://pingcode.yasdb.com/atlas/files/public/67396e98a1ad9a3311dc980e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgyNDgsImV4cCI6MTc4MjQ0OTA0OH0.EeZ4zaapa-jlIMHTw04Ub1ZS4Xz_3vj_qY5LsjFRcuU),**插入长度为0的方法和mysql允许将int转换为bin：**,mysql> insert into test_binary(c2)   **values('');**,mysql> insert into test_binary(c1)   **values(1);**,mysql> select * from test_binary;    
  +------+------+------+------+------+------+    
  | c1 | c2 | c3 | c4 | c6 | c8 |    
  +------+------+------+------+------+------+    
  | NULL | | NULL | NULL | NULL | NULL |    
  | 1 | NULL | NULL | NULL | NULL | NULL |    
  +------+------+------+------+------+------+    
  2 rows in set (0.00 sec)|使用raw映射，范围0~255，yashan已支持1~255，  **需支持0；实际长度小于定义长度时，不补0x00**|  
|MY_TYPE_VAR_STRING|YSMY_CHARSET_BIN = 63|M|0|二进制|类型映射差异，定长类型映射成变长类型|二进制转字符串差异(yashan按照16进制转换，mysql转换后格式不变)|
|16|VARBINARY(M)|同义词：无,范围0~65535字节，M不能省略（不带报错）|使用raw映射，范围0~8000，yashan已支持1~8000，  **需支持0；**  **8001~65535不支持报错**|  
|MY_TYPE_VAR_STRING|YSMY_CHARSET_BIN = 63|M|0|二进制|  
|同  BINARY|
|17|CHAR[(M)]|同义词：  CHARACTER,范围0~255字节，缺省为1|使用char映射，范围0~255，yashan已支持1~255，  **需支持0**|  
|MY_TYPE_STRING|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|M*服务端字符集最大字符数,**和SQL_MODE相关**|0|字符串|  
|  
|
|18|VARCHAR(M)|同义词：  ~~CHARACTER VARYING~~,范围0~65535字节，M不能省略（不带报错）|使用varchar映射，范围0~32000，yashan已支持1~8000，  **需支持0；**  **32001~65535不支持报错**|  
|MY_TYPE_VAR_STRING|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|M*服务端字符集最大字符数,**和SQL_MODE相关**|0|字符串|  
|  
|
|19|NCHAR[(M)]|同义词：  NATIONAL CHAR、NATIONAL CHARACTER,范围0~255字符，缺省为1|使用nchar映射，范围0~255字符，yashan已支持1~255，  **需支持0**|  
|MY_TYPE_STRING|YSMY_CHARSET_UTF16 = 54|M*4(UTF16 max len)|0|字符串|  
|  
|
|20|NVARCHAR(M)|同义词：  NATIONAL   VARCHAR、NATIONAL CHARACTER VARYING,范围0~65535字符，M不能省略（不带报错）|使用nvarchar映射，范围0~16000字符，yashan已支持1~16000，  **需支持0；**  **32001~65535不支持报错**|  
|MY_TYPE_VAR_STRING|YSMY_CHARSET_UTF16 = 54|M*4(UTF16 max len)|0|字符串|  
|  
|
|21|TINYBLOB|同义词：无，  范围0~255字节|使用  **BLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|  
|
|22|BLOB|同义词：无，范围  0~65535字节|同上|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|  
|
|23|MEDIUMBLOB|同义词：无，范围0~  16777215字节|同上|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|  
|
|24|LONGBLOB|同义词：无，范围0~  4294967295字节|同上|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|  
|
|25|TINYTEXT|同义词：无，  范围0~255字节|使用  **CLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|  
|
|26|TEXT|同义词：无，范围  0~65535字节|同上|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|  
|
|27|MEDIUMTEXT|同义词：无，范围0~  16777215字节|同上|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|  
|
|28|LONGTEXT|同义词：无，范围0~  4294967295字节|同上|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|  
|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、新增yspi层函数：

|函数|功能|
|---|---|
|YspiResult     yspiGetLobSize2  (  YspiHandle     hSession  ,     YspiValue  *     yspiValue  ,     uint64_t  *     size  )|获取lob长度，调用,anlGetVarLobSize|
|YspiResult     yspiReadLob2  (  YspiHandle     hSession  ,     YspiValue  *     yspiValue  ,     uint64_t     offset  ,     uint64_t  *     size  ,     char  *     buf  )|获取lob数据，调用,anlReadVarLobData|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

LOB相关不涉及loblocator，所有LOB数据均一次读完，不存在多次读取

###   [4.1 元数据](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

|类型|目前值|说明|
|---|---|---|
|catalog|def|永远为def|
|database|当前schema|返回当前schema（  当前为大写，而非和mysql一致的原大小写  ）|
|virtual table name|""|返回当前表名|
|physical table name|""|原表名|
|virtual column name|列名|返回当前  列名  （  当前为原大小写  ）|
|physical column name|""|原列名|
|length of fixed length fields|10|固定0x0c|
|client charset number|character_set_results（完善）|见需求分析类型映射表|
|size|显示宽度（完善）|见需求分析类型映射表|
|type|对应类型（完善）|见需求分析类型映射表|
|flags|MY_FIELD_FLAG_NOT_NULL          1,MY_FIELD_FLAG_UNSIGNED_FLAG     32,MY_FIELD_FLAG_BLOB_FLAG（新增）         16,目前已支持上述属性|#define MY_FIELD_FLAG_PRI_KEY_FLAG      2    
  #define MY_FIELD_FLAG_UNIQUE_KEY_FLAG   4    
  #define MY_FIELD_FLAG_MULTIPLE_KEY_FLAG 8    
  #define MY_FIELD_FLAG_ZEROFILL_FLAG     64    
  #define MY_FIELD_FLAG_BINARY_FLAG       128,目前支持的flag不完整|
|decimals|符合mysql要求的decimals（完善）|见需求分析类型映射表|
|reserved|0|  
|


###   [4.2 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

1、测试元数据差异

2、测试数据格式是否正确

3、测试  NCHAR、NVARCHAR，在mysql-client、mysql-jdbc下表现不同，转测前会修正

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


  


  


## Attachments: