Created by 贺天欢, last modified on 十二月 12, 2023

#   [YDBRD-XXXX : XXX Design（XXX测试方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#ydbrd-xxxx--xxx-designxxx%E6%B5%8B%E8%AF%95%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：    [YDBRD-8158](https://jira.yasdb.com/browse/YDBRD-8158?src=confmacro)    -  支持UNISTR函数  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

需求描述：    
  支持UNISTR函数，Unicode转换为中文    
  需求范围：    
  1、单机和集群    
  2、行表

**当前YashanDB支持国家字符集（NATIONAL_CHARACTER_SET）只为UTF-16，建库时指定，后续无法更改；**

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1. 支持yanshanDB全部数据类型的字符串或  解析为字符数据的表达式  转换成NVARCHAR返回，  **非Unicode编码部分的字符保留原型**  ，Unicode编码部分的字符转换正确（  **覆盖全部uinicode编码字符）**
1. 支持数据库的ddl、dml、dql、plsql操作
1. 支持数据的隐式转换（字符串参数的隐式转换，返回值整体的隐式转换）
1. 函数作为整体拼接其他不同数据类型（  返回规则按照：  nclob > nvarchar > nchar > clob >varchar > char >其他数据类型      的优先级进行转换；  ），不同单位拼接，需要关注长度（length\lengthb）和返回类型（typeof）是否正确，规格和限制与nvarchar对齐；
1. 转换后的输出超过返回值规格时，截断显示
1. v$function视图和 JDBC 驱动的 getFunction 接口新增这个函数
1. 字符串参数支持绑定参数（jdbc、plsql都支持）
1. 一、  **CHARACTER_SET=UTF8（默认），NATIONAL_CHARACTER_SET=UTF16（默认不变）**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：    
  a.非Unicode编码（全部数据类型），保留原型，typeof查看是nvarchar
1. b.Unicode编码（全部数据类型），转换成功，typeof查看是nvarchar
1. c.非Unicode编码||Unicode编码（全部数据类型），转换成功（保留原型||unicode编码对应字符），typeof查看是nvarchar
1. （2）当字符串的字符集（sql文件）是utf16时：同上
1. （3）当字符串的字符集（sql文件）是其他时（ASCII、GBK、ISO-8859-1）：
    1. 非Unicode编码（全部数据类型），  nchar\nvarchar数据类型部分显示乱码（typeof查看是nvarchar）  ，其他数据类型  转换报错还是对齐oracle移出处理方式（数据库不能core不能崩溃）
    1. Unicode编码（全部数据类型），  nchar\nvarchar数据类型原样输出（typeof查看是nvarchar）  ，其他数据类型  转换报错还是对齐oracle移出处理方式（数据库不能core不能崩溃）
1. 二、  **CHARACTER_SET=GBK，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：
    1. 非Unicode编码（全部数据类型），  nchar\nvarchar数据类型部分显示乱码（typeof查看是nvarchar）  ，其他数据类型  转换报错还是对齐oracle移出处理方式（数据库不能core不能崩溃）
    1. Unicode编码（全部数据类型），  nchar\nvarchar数据类型原样输出（typeof查看是nvarchar）  ，其他数据类型  转换报错还是对齐oracle移出处理方式（数据库不能core不能崩溃）
1. （2）当字符串的字符集（sql文件）是GBK时：
    1. 非Unicode编码（全部数据类型），保留原型，typeof查看是nvarchar
    1. Unicode编码（全部数据类型），转换成功，typeof查看是nvarchar
    1. 非Unicode编码||Unicode编码（全部数据类型），转换成功（保留原型||unicode编码对应字符），typeof查看是nvarchar
1. 三、  **CHARACTER_SET=ASCII，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：同场景二
1. （2）当字符串的字符集（sql文件）是ASCII时：同场景二
1. 四、  **CHARACTER_SET=ISO88591，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：同场景二
1. （2当字符串的字符集（sql文件）是ISO-8859-1时：同场景二


*从研发概要设计中获取，列出从IR层级对外可以感知的特性，对应提供的功能点、函数、语法图、配置参数、视图、接口等*

*结合调研文档，如有与友商实现的规格差异，要体现出来*

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

*1、参数个数：1*

*2、两个*  *反斜杠转换：一个反斜杠；一个反斜杠+4个合法的16进制数转换：unicode对应编码字符*

*3、参数长度：单行string的最大输入长度32000B*

*4、返回值规格：nvarchar类型，32000B*

*      返回值默认长度：32000B（oracle是入参字符串长度的5倍）*

*5、函数自嵌套层数：127*

*6*  *、支持隐式转换*

*7、支持全部数据类型*

|数据类型|是否支持|
|---|---|
|TINYINT|✓|
|SMALLINT|✓|
|INT|✓|
|BIGINT|✓|
|NUMBER|✓|
|FLOAT|✓|
|DOUBLE|✓|
|CHAR/VARCHAR|✓|
|NCHAR/NVARCHAR|✓|
|DATE|✓|
|TIMESTAMP|✓|
|YM_INTERVAL|✓|
|DS_INTERVAL|✓|
|TIME|✓|
|BOOLEAN|✓|
|CLOB|✓（不支持LOB类型outline部分）|
|BLOB|✓（不支持LOB类型outline部分）|
|NCLOB|✓（不支持LOB类型outline部分）|
|BIT|✓|
|RAW|✓|
|JSON|✓|
|ROWID/UROWID|✓|


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景*

*场 景：*

1. **CHARACTER_SET=UTF8（默认），NATIONAL_CHARACTER_SET=UTF16（默认不变）**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：    
  a.非Unicode编码（全部数据类型），保留原型，typeof查看是nvarchar
1. b.Unicode编码（全部数据类型），转换成功，typeof查看是nvarchar
1. c.非Unicode编码||Unicode编码（全部数据类型），转换成功（保留原型||unicode编码对应字符），typeof查看是nvarchar


*需求与其他特性的关联场景*

1. 函数作为整体拼接其他不同数据类型，不同单位拼接，需要关注长度（length\lengthb）和返回类型（typeof）是否正确，规格和限制与varchar/nvarchar对齐
1. 支持数据库的ddl、dml、dql、plsql操作
1. 非unicode编码的UNISTR函数转换结果和长度与to_char的是否一致


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.*  *主要采用的等价类划分，边界值*  *，场景法组合及错误推测法进行设计*

*2.*  *需*  *覆盖全部uinicode编码字符，需考虑不同字符集下使用该函数*

*3.*  *分布式和列表需要加拦截用例*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略：优先测试冒烟用例，再覆盖基本功能，场景部分最后测试*

*测试框架满足度：Guider即可*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

## Attachments:

[UNISTR概要测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzE4OTcwYzJhZjRmNTIwNGEwIiwicmVmX2lkIjoiNjczOTZiNzE3MjgyMDZlZmI5MmYwNWVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MjU0LCJleHAiOjE3ODIzODA2NTR9.FrLzjz1bY7HRw8VN3UuqljQU9N4crJZfQjN8Mvlgmg8)

 (application/x-xmind)    
