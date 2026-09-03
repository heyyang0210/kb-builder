IR:      [https://pingcode.yasdb.com/pjm/items/670e3debe489dd0868f7e74d? ](https://pingcode.yasdb.com/pjm/items/670e3debe489dd0868f7e74d?)  #YDBRD-34252 【mysql兼容】兼容与MYSQL Left等字符属性函数

SR:   [https://pingcode.yasdb.com/pjm/items/670e3dec6544792659b3722a? ](https://pingcode.yasdb.com/pjm/items/670e3dec6544792659b3722a?)  #YDBRD-34253 开发任务：【mysql兼容】兼容与MYSQL Left等字符属性函数



#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

在原有的mysql框架之上，适配 length、octet_length、upper、lower函数。（left, right 函数放在了   YDBRD-34255中  ）



#   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  



##   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

|功能|调研表现|
|---|---|
|LENGTH(str)|计算字符串的字节长度。|
|OCTET_LENGTH(str)|计算字符串的字节长度， 是LENGTH函数的同义词。|
|UPPER(str)|将字符串改为大写。|
|LOWER(str)|将字符串改为小写。|


### 1.2.1 length 函数

**语法格式**

  `LENGTH(str)`  

**返回值类型**     int(10) 

**描述**

      返回字符串的字节长度。

**示例**

```
mysql> select length('崖山') c1;
+----+
| c1 |
+----+
|  6 |
+----+
1 row in set (0.02 sec)
```



**功能实现**

不同的数据类型会调用不同的函数来获取输入参数的字节长度值。

1. 入参为NULL 返回。
1. 设置字符集
1. 对入参转为字符串处理，然后计算对应的字节长度。


根据 sql_mode  中是否设置 PAD_CHAR_TO_FULL_LENGTH ，区分是否计算字符串末尾的空格。

BLOB: Field_blob::val_str -> Field_blob::get_length

BINARY: my_lengthsp_binary 返回列属性的 field_length 值。

INT:  my_long10_to_str_8bit ， 数值转化为字符串对应的长度。

char: my_charpos_mb （设置了PAD_CHAR_TO_FULL_LENGTH）， my_lengthsp_8bit 

varchar: Field_varstring::val_str 



### 1.2.2 octet_length 函数

**语法格式**

    `  OCTET_LENGTH`  

**返回值类型**    int(10)

**描述**

octet_length 函数是 length 函数的同义词。

**示例**

```
mysql> select octet_length('崖山') c1;
+----+
| c1 |
+----+
|  6 |
+----+
1 row in set (0.02 sec)
```



### 1.2.3 upper函数

**语法格式**

  `UPPER(str)`  

**参数 **  str ， 可以为任意数据类型

**返回值 类型**  ：

|入参类型|yashan 数据库对应的结果类型|mysql 数据库对应的结果类型|
|---|---|---|
|tinyint|varchar(4)|varchar(4) |
|smallint|varchar(6)|varchar(6) |
|int|varchar(11)|varchar(11)|
|bigint|varchar(20)|varchar(20) |
|float|varchar(44)|varchar(12) |
|double|varchar(44)|varchar(22)|
| char(n)|varchar(n)|varchar(n) |
|varchar(n)|varchar(n)|varchar(n) |
|boolean|varchar(4)|varchar(4) |
|binary(10)|varbinary(10) |varbinary(10) |
|varbinary(10)|varbinary(10) |varbinary(10) |
|decimal(125)| varchar(44)|varchar(14) |
|bit（10）|varchar(64)|varbinary(10)|
|blob|longblob|blob|
|text|longblob|longtext|
|json||longtext|
|date|varchar(64)|varchar(10)|
|datetime|varchar(64)|varchar(19)|
|timestamp|varchar(64)|varchar(19)|






**描述**  ：返回字符串str, 其中字符串中所有的字符更改为大写。ucase 是函数upper的同义词。

**示例**

```
mysql> select upper('abc') c1 from dual;
+------+
| c1   |
+------+
| ABC  |
+------+
1 row in set (0.01 sec)
```



注意：

- lower(), upper(）函数对二进制数据类型（bianry, varbinary, blob) 数据无效， 这是因为这些数据类型存储的是原始字节而不是字符，不适用于基于字符编码的大小写转换逻辑。
- 该函数是多字节安全函数。
- mysql 版本差异及重写规则：


函数重写规则的变化：在较早版本的MySQL中，如果在视图定义中使用了UPPER()函数，那么在保存视图定义时，这个函数会被自动重写为UCASE()。然而，在MySQL 5.7中，这种行为被改变了——现在UPPER()不再被重写，相反，如果使用的是UCASE()，则会被重写为UPPER()。这一改动是为了修复Bug #12844279，旨在使函数名称更加统一，并避免由于函数名称不同而导致的潜在混淆。





### 1.2.4 lower函数

**语法格式**

  `LOWER(str)`  

**参数  **  str , 可以为任意数据类型。

**返回值类型**  : 

同 1.2.3 upper 函数 返回值类型。



**描述**

- 返回字符串str, 其中字符串中所有的字符更改为小写。lcase 是函数upper的同义词。
- 该函数是多字节安全函数。
- mysql 版本差异及重写规则：


在MySQL的早期版本中，视图中使用的LOWER() 在存储时被重写为LCASE() 视图的定义。在MySQL 5.7中，LOWER() 在这种情况下永远不会重写，但使用了LCASE()

视图内的内容被重写为LOWER（）。Bug #12844279）



##   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|无||||






##   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无



#   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

//大小写转换处理

String *Item_str_conv::val_str(String *str)；

//upper函数结果属性设置

void Item_func_upper::fix_length_and_dec()；

//lower函数结果属性设置

void Item_func_lower::fix_length_and_dec();



##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

  


##   [5. 参考](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

MySQL  Reference Manual 中内置函数章节 （  [https://dev.mysql.com/doc/refman/5.7/12.8 String Functions and Operators](https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html#function_encode)  ）

  [特性调研-YDBRD-34018：【MySQL兼容】兼容LCASE等字符串函数](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67397ef1593f99c9ff23d777)  

  [详细设计-YDBRD-34018：【MySQL兼容】兼容LCASE等字符串函数](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6745a30e593f99c9ff29246c)  







