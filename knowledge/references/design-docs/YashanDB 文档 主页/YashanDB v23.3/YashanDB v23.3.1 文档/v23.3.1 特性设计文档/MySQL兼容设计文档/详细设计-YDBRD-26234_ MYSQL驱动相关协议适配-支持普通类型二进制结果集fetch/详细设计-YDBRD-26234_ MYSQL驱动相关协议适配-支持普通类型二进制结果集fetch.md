Created by 冯皓博, last modified on 七月 17, 2024

  [https://pingcode.yasdb.com/pjm/items/6618ffa0fd997db58ad87037](https://pingcode.yasdb.com/pjm/items/6618ffa0fd997db58ad87037)    ?    
  #YDBRD-26234 【mysql兼容】（协议）MYSQL驱动相关协议适配-支持普通类型二进制结果集fetch

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

【mysql兼容】（协议）MYSQL驱动相关协议适配-支持普通类型二进制结果集fetch，    
  比如COM_STMT_PREPARE+COM_STMT_EXECUTE+COM_STMT_FETCH+COM_STMT_CLOSE

主要支持二进制结果集，二进制结果集在prepare+execute模式下才能触发（  useServerPrepStmts=true  ）

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

外场mysql

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

类型映射+元数据+数据规格确认：

|序号|数据类型|MySQL规格|YaShan兼容策略、规则|MYSQL实现|映射MYSQL宏值|字符集|显示宽度|decimal|结果集协议格式|数据差异|二进制数据格式|
|---|---|---|---|---|---|---|---|---|---|---|---|
|1|TINYINT  [(M)]|同义词：无，M表示显示宽度（[0,255]），范围：-128~127|使用tinyint映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_TINY|YSMY_CHARSET_BIN = 63|有符号：4,无符号：3,**PS：此处带M的语法待实现**|0|整数|  
|int8|
|2|SMALLINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -32768  ~  32767|使用smallint映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_SHORT|YSMY_CHARSET_BIN = 63|有符号：6,无符号：5,**PS：此处带M的语法待实现**|0|整数|  
|int16|
|3|INTEGER[(M)]|同义词：INT，M表示显示宽度（[0,255]），范围：-  2147483648~2147483647|使用integer映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_LONG|YSMY_CHARSET_BIN = 63|有符号：11,无符号：10,**PS：此处带M的语法待实现**|0|整数|  
|int32|
|4|BIGINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -9223372036854775808~9223372036854775807|使用bigint映射，数据范围一致，  **支持带M的语法，无实际意义**|  
|MY_TYPE_LONGLONG|YSMY_CHARSET_BIN = 63|20,**PS：此处带M的语法待实现**|0|整数|  
|int64|
|5|MEDIUMINT[(M)]|同义词：无，M表示显示宽度（[0,255]），范围：  -8388608~8388607|使用  **integer**  映射，范围同integer（比MySQL大），  **支持带M的语法，无实际意义**|  
|MY_TYPE_LONG|YSMY_CHARSET_BIN = 63|有符号：10,无符号：11,**PS：此处带M的语法待实现**,**同**  **INTEGER**|0|整数|  
|int32|
|6|DECIMAL     [(M [,D])]|同义词：  DEC、FIXED，NUMERIC,M是总位数，D是小数点后的位数，M的范围为[1,65]，D的范围[0,30]，且D <= M，M缺省10，D缺省0|使用  NUMBER(P,S)  映射  **，M和D的范围以yashan为准（MySQL的范围比yashan大，超过yashan范围报错），取值：(-1E126，-1E-130]、**  **0和[1E-130，1E126)**,P：精度，表示数字的有效位数，取值范围[1,38],S：刻度，表示数字从小数点到最右侧有效数字的位数，取值范围[-84,127]|  
|MY_TYPE_NEWDECIMAL|YSMY_CHARSET_BIN = 63|D > 0 ? M + 2 : M + 1|D|  
|  
|text，同文本结果集|
|7|DOUBLE  ([M, D])|同义词：  DOUBLE PRECISION，REAL,M是总位数，D是小数点后的位数，0 < M <= 255,  0 <= D <= 30, 并且D <= M，可精确到15个小数位,-1.7976931348623157E+308到-2.2250738585072014E-308,0和2.2250738585072014E-308到1.7976931348623157E+308|使用double映射，  **yashan已兼容M/D语法，无实际意义（超过定义范围报错）**,[-1.79769313486232E308, -4.94065645841247E-324]、  0  、[4.94065645841247E-324, 1.79769313486232E308]|  
|MY_TYPE_DOUBLE|YSMY_CHARSET_BIN = 63|22,**PS：此处带M的语法待实现**|0x1f,**PS：此处带D的语法待实现**|  
|打印格式可能有差异|double|
|8|FLOAT  ([M, D])|同义词：无，M/D含义和范围同上，精度为小数点后7位,-3.402823466E+38到-1.175494351E-38,0和1.175494351E-38到3.402823466E+38|使用float映射，  **yashan已兼容M/D，无实际意义（超过定义范围报错）**,[-3.402823E38, -1.401298E-45]、  0、  [1.401298E-45, 3.402823E38]|  
|MY_TYPE_FLOAT|YSMY_CHARSET_BIN = 63|12,**PS：此处带M的语法待实现**|0x1f,**PS：此处带D的语法待实现**|  
|打印格式可能有差异|float|
|9|DOUBLE(p),FLOAT(p)|p表示以位为单位的精度，0~24类型为float，25~53类型为double|使用float映射，yashan已兼容p语法，无实际意义（超过定义范围报错），0~24定义为float，25~53定义为double|【  **yashan**  】1、float的p范围0<=p<=126，  大于53小于等于126的部分会当作53处理,2、m或者p值超过23，系统将类型转换为DOUBLE类型|MY_TYPE_FLOAT,MY_TYPE_DOUBLE|YSMY_CHARSET_BIN = 63|12/22,**显示长度与M无关**|0x1f|  
|打印格式可能有差异|double/float|
|10|BOOLEAN|同义词：  TINYINT(1)、BOOL,支持输入：  0/1，'0'/'1'，true/false,不支持输入：'true'/'false'，' t'/'f'， 'on'/'off'， 'yes'/'no'|使用tinyint映射，  **支持输入的规格与mysql一致**|  
|MY_TYPE_TINY|YSMY_CHARSET_BIN = 63|4,**和MYSQL差异，MySQL为1（本质是**  **TINYINT**  **[(M)]未实现M）**|0|整数|  
|int8|
|11|DATE|同义词：无，范围：  1000-01-01~9999-12-31|使用date映射，按yashan规格（范围  0001-01-01 00:00:00 ~ 9999-12-31 23:59:59，比MySQL大  ）|  
|MY_TYPE_DATE|YSMY_CHARSET_BIN = 63|10|0|"YYYY-MM-DD"|  
|自定义格式：,  [https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date](https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date)  |
|12|DATETIME  [(fsp)]|同义词：无，范围：  1000-01-01 00:00:00.000000~9999-12-31 23:59:59.999999,fsp定义微秒的精度，  范围0~6|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）|fsp没限制范围|MY_TYPE_TIMESTAMP|YSMY_CHARSET_BIN = 63|fsp  >0?20  +  fsp  :19|fsp|"yyyy-mm-dd hh24:mi:ss.ff"|打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|自定义格式（同  TIMESTAMP  ）：,  [https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date](https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date)  |
|13|TIME  [(fsp)]|同义词：无，范围：  -838:59:59.000000~838:59:59.000000|使用time映射，按yashan规格（范围  00:00:00.000000 ~ 23:59:59.999999，  **比MySQL范围小，超过报错**  **）**|1、fsp没限制范围,2、yashan不支持time'23:59:59.999999'写法|MY_TYPE_TIME|YSMY_CHARSET_BIN = 63|fsp   > 0 ? 11 +   fsp   : 10|fsp|"hh24:mi:ss.ff"|打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|自定义格式：,  [https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date](https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date)  |
|14|TIMESTAMP  [(fsp)]|同义词：无，范围：  1970-01-01 00:00:01.000000 UTC ~2038-01-19 03:14:07.999999 UTC|使用timestamp映射，按yashan规格（范围  1-1-1 00:00:00.000000 ~ 9999-12-31 23:59:59.999999，比MySQL范围大  ）|fsp没限制范围|MY_TYPE_TIMESTAMP|YSMY_CHARSET_BIN = 63|fsp  >0?20  +  fsp  :19|fsp|"yyyy-mm-dd hh24:mi:ss.ff"|打印格式可能有差异（MYSQL不固定微秒显示宽度为6）|自定义格式：,  [https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date](https://dev.mysql.com/doc/dev/mysql-server/latest/page_protocol_binary_resultset.html#sect_protocol_binary_resultset_row_value_date)  |
|15|BINARY[(M)]|同义词：  CHAR BYTE  **（为了兼容，不支持使用时指定长度）**,范围0~255字节，  **缺省为1**  ；存储二进制字节字符串,![](https://pingcode.yasdb.com/atlas/files/public/67396e99a1ad9a3311dc9811/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0MzgyOTMsImV4cCI6MTc4MjQ0OTA5M30.r12jp6Ulud4htYhIVkWiijQ4pvuEN-FAEkvJTcJdQxE),**插入长度为0的方法和mysql允许将int转换为bin：**,mysql> insert into test_binary(c2)   **values('');**,mysql> insert into test_binary(c1)   **values(1);**,mysql> select * from test_binary;    
  +------+------+------+------+------+------+    
  | c1 | c2 | c3 | c4 | c6 | c8 |    
  +------+------+------+------+------+------+    
  | NULL | | NULL | NULL | NULL | NULL |    
  | 1 | NULL | NULL | NULL | NULL | NULL |    
  +------+------+------+------+------+------+    
  2 rows in set (0.00 sec)|使用raw映射，范围0~255，yashan已支持1~255，  **需支持0；实际长度小于定义长度时，不补0x00**|  
|MY_TYPE_VAR_STRING|YSMY_CHARSET_BIN = 63|M|0|二进制|二进制转字符串差异(yashan按照16进制转换，mysql转换后格式不变)|尚不支持|
|16|VARBINARY(M)|同义词：无,范围0~65535字节，M不能省略（不带报错）|使用raw映射，范围0~8000，yashan已支持1~8000，  **需支持0；**  **8001~65535不支持报错**|  
|MY_TYPE_VAR_STRING|YSMY_CHARSET_BIN = 63|M|0|二进制|同  BINARY|尚不支持|
|17|CHAR[(M)]|同义词：  CHARACTER,范围0~255字节，缺省为1|使用char映射，范围0~255，yashan已支持1~255，  **需支持0**|  
|MY_TYPE_STRING|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|M*服务端字符集最大字符数,**和SQL_MODE相关**|0|字符串|  
|text|
|18|VARCHAR(M)|同义词：  ~~CHARACTER VARYING~~,范围0~65535字节，M不能省略（不带报错）|使用varchar映射，范围0~32000，yashan已支持1~8000，  **需支持0；**  **32001~65535不支持报错**|  
|MY_TYPE_VAR_STRING|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|M*服务端字符集最大字符数,**和SQL_MODE相关**|0|字符串|  
|text|
|19|NCHAR[(M)]|同义词：  NATIONAL CHAR、NATIONAL CHARACTER,范围0~255字符，缺省为1|使用nchar映射，范围0~255字符，yashan已支持1~255，  **需支持0**|  
|MY_TYPE_STRING|YSMY_CHARSET_UTF16 = 54|M*4(UTF16 max len)|0|字符串|  
|text|
|20|NVARCHAR(M)|同义词：  NATIONAL   VARCHAR、NATIONAL CHARACTER VARYING,范围0~65535字符，M不能省略（不带报错）|使用nvarchar映射，范围0~16000字符，yashan已支持1~16000，  **需支持0；**  **32001~65535不支持报错**|  
|MY_TYPE_VAR_STRING|YSMY_CHARSET_UTF16 = 54|M*4(UTF16 max len)|0|字符串|  
|text|
|21|TINYBLOB|同义词：无，  范围0~255字节|使用  **BLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|尚不支持|
|22|BLOB|同义词：无，范围  0~65535字节|同上|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|尚不支持|
|23|MEDIUMBLOB|同义词：无，范围0~  16777215字节|同上|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|尚不支持|
|24|LONGBLOB|同义词：无，范围0~  4294967295字节|同上|  
|MY_TYPE_BLOB|YSMY_CHARSET_BIN = 63|4294967295|0|二进制|  
|尚不支持|
|25|TINYTEXT|同义词：无，  范围0~255字节|使用  **CLOB**  映射，存储范围与yashan一致为  **1~4G*DB_BLOCK_SIZE（不支持0）**|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|text|
|26|TEXT|同义词：无，范围  0~65535字节|同上|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|text|
|27|MEDIUMTEXT|同义词：无，范围0~  16777215字节|同上|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|text|
|28|LONGTEXT|同义词：无，范围0~  4294967295字节|同上|  
|MY_TYPE_BLOB|服务端YSMY字符集，默认：,YSMY_CHARSET_UTF8MB4 = 45|4294967295|0|字符串|  
|text|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

尚不支持binary+blob类型

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

#### 支持两种fetch模式：

1、默认fetch方式为服务端一直推送结果集到客户端，这样内存最大使用值为结果集大小，可能引发驱动测 OOM

- COM_STMT_EXECUTE后带全部结果集


2、cursor fetch方式为根据设置的fetchsize确认每次往返给客户端的结果集行数，同yashandb默认模式

- COM_STMT_EXECUTE后一行结果集都不带
- COM_STMT_FETCH后带fetchsize行结果集


#### jdbc开启方式：

1、连接参数：

```
useCursorFetch=true + useServerPrepStmts=true
```

2、使用：

```
pstmt = connection.prepareStatement("select * from test_cursor_fetch", ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY);
pstmt.setFetchSize(100);
pstmt.setFetchDirection(ResultSet.FETCH_FORWARD);
```

###   [4.1 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

1、测试数据值是否正确

2、测试不同fetch模式下，是否正常获取数据

3、如果实现M+D，那么元数据也要关注

- 元数据本身会变，包括显示宽度和decimal
- 文本结果集会变，影响显示宽度
- 影响二进制结果集的decimal


##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

##   [6.用例](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

```
@Test
	public void testBinaryResult() throws Exception {
		Statement stmt = conn.createStatement();
		stmt.execute("DROP TABLE IF EXISTS test_datatype");
		stmt.execute("CREATE TABLE test_datatype (\n" +
				"    c1_tinyint TINYINT,\n" +
				"    c3_smallint SMALLINT,\n" +
				"    c5_int INT,\n" +
				"    c7_bigint BIGINT,\n" +
				"    c9_mediumint MEDIUMINT,\n" +
				"    c11_decimal DECIMAL(10, 0),\n" +
				"    c14_double DOUBLE,\n" +
				"    c16_float FLOAT,\n" +
				"    c20_float FLOAT ( 10 ),\n" +
				"    c21_float FLOAT ( 30 ),\n" +
				"    c22_boolean boolean,\n" +
				"    c23_date date,\n" +
				"    c24_datetime datetime,\n" +
				"    c25_datetime datetime ( 5 ),\n" +
				"    c26_time time,\n" +
				"    c27_time time( 4 ),\n" +
				"    c28_timestamp TIMESTAMP DEFAULT '2020-01-01 00:00:00',\n" +
				"    c29_timestamp TIMESTAMP ( 3 ) DEFAULT '2020-01-01 00:00:00',\n" +
				"    c31_binary BINARY ( 100 ),\n" +
				"    c32_varbinary VARBINARY ( 200 ),\n" +
				"    c34_char CHAR ( 210 ),\n" +
				"    c35_varchar VARCHAR ( 220 ),\n" +
				"    c39_tinyblob TINYBLOB,\n" +
				"    c40_blob BLOB,\n" +
				"    c41_mediumblob MEDIUMBLOB,\n" +
				"    c42_longblob LONGBLOB,\n" +
				"    c43_tinytext TINYTEXT,\n" +
				"    c44_text text,\n" +
				"    c45_mediumtext MEDIUMTEXT,\n" +
				"  c46_longtext LONGTEXT\n" +
				")");

		stmt.execute("INSERT INTO test_datatype values (100, 32760, 283612873, 9574398579483, 4564611, 1.11111," +
				" 2.22222, 3.33333, 4.44444, 5.55555, 11, '0001-01-01', '1000-01-01 01:01:01.000001'," +
				" '1000-01-01 00:00:00.000','01:01:01.000001', '01:01:01.0001', '2023-01-01 00:00:00'," +
				" '2023-01-01 00:00:00.001', '41', '42', '43', '44', '45', '46', '47', '48', '49', '4a', '4b', '4c')");

		PreparedStatement pstmt = conn.prepareStatement("select * from test_datatype");
		ResultSet resultSet  = pstmt.executeQuery();

		Assert.assertTrue(resultSet.next());
		String str;
		str = resultSet.getString(1);
		Assert.assertEquals(str, "100");
		str = resultSet.getString(2);
		Assert.assertEquals(str, "32760");
		str = resultSet.getString(3);
		Assert.assertEquals(str, "283612873");
		str = resultSet.getString(4);
		Assert.assertEquals(str, "9574398579483");
		str = resultSet.getString(5);
		Assert.assertEquals(str, "4564611");
		str = resultSet.getString(6);
		Assert.assertEquals(str, "1");
		str = resultSet.getString(7);
		Assert.assertEquals(str, "2.22222");
		str = resultSet.getString(8);
		Assert.assertEquals(str, "3.33333");
		str = resultSet.getString(9);
		Assert.assertEquals(str, "4.44444");
		str = resultSet.getString(10);
		Assert.assertEquals(str, "5.55555");
		str = resultSet.getString(11);
		Assert.assertEquals(str, "11");
		str = resultSet.getString(12);
		Assert.assertEquals(str, "0001-01-01");
		str = resultSet.getString(13);
		Assert.assertEquals(str, "1000-01-01 01:01:01.000001");
		str = resultSet.getString(14);
		Assert.assertEquals(str, "1000-01-01 00:00:00.0");
		str = resultSet.getString(15);
		Assert.assertEquals(str, "01:01:01");
		str = resultSet.getString(16);
		Assert.assertEquals(str, "01:01:01");
		str = resultSet.getString(17);
		Assert.assertEquals(str, "2023-01-01 00:00:00.0");
		str = resultSet.getString(18);
		Assert.assertEquals(str, "2023-01-01 00:00:00.001");
		str = resultSet.getString(19);
		Assert.assertEquals(str, "A");
		str = resultSet.getString(20);
		Assert.assertEquals(str, "B");
		str = resultSet.getString(21);
		Assert.assertEquals(str, "43");
		str = resultSet.getString(22);
		Assert.assertEquals(str, "44");
		str = resultSet.getString(23);
		Assert.assertEquals(str, "E");
		str = resultSet.getString(24);
		Assert.assertEquals(str, "F");
		str = resultSet.getString(25);
		Assert.assertEquals(str, "G");
		str = resultSet.getString(26);
		Assert.assertEquals(str, "H");
		str = resultSet.getString(27);
		Assert.assertEquals(str, "49");
		str = resultSet.getString(28);
		Assert.assertEquals(str, "4a");
		str = resultSet.getString(29);
		Assert.assertEquals(str, "4b");
		str = resultSet.getString(30);
		Assert.assertEquals(str, "4c");

		stmt.close();
		pstmt.close();
	}
```

  


  


## Attachments:

[image2024-7-2_11-45-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOTlhMWFkOWEzMzExZGM5ODEwIiwicmVmX2lkIjoiNjczOTZlOTk3MjgyMDZlZmI5MmYyOWYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4MjkzLCJleHAiOjE3ODI1MjQ2OTN9.QH8xNHP27GIt8s9sG-DJtsCwqAVbhjqQvpj9JEVTZCg)

 (image/png)    
