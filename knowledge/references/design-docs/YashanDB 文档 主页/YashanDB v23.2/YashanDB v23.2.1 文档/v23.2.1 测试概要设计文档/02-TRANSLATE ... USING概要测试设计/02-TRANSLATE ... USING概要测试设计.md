Created by 贺天欢, last modified on 十二月 12, 2023

#   [YDBRD-21635: TRANSLATE ... USING（](https://conf.yasdb.com/pages/viewpage.action?pageId=133564328#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [测试方案设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#ydbrd-xxxx--xxx-designxxx%E6%B5%8B%E8%AF%95%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

IR链接：       [YDBRD-14304](https://jira.yasdb.com/browse/YDBRD-14304)       -     支持TRANSLATE ... USING函数     设计中     / SR链接：       [YDBRD-21635](https://jira.yasdb.com/browse/YDBRD-21635)       -     支持TRANSLATE ... USING函数     设计中

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

**将输入的字符串转换成用数据库字符集或国家字符集编码的字符串**

**USING CHAR_CS表示用数据库字符集编码，输出VARCHAR**

**USING NCHAR_CS表示用国家字符集编码，输出NVARCHAR**

单机、集群

行表

PS.

**当前**  **YashanDB支持如下数据库字符集（CHARACTER_SET）：**

- **ASCII**
- **GBK**
- **UTF8（默认值）**
- **ISO88591**


**YashanDB支持国家字符集（NATIONAL_CHARACTER_SET）为UTF-16，建库时指定，后续无法更改；**

**yashanDB数据库字符集修改参考**    [*中文编码测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=76929084)  

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1. 支持yanshanDB全部数据类型的字符串转换成VARCHAR或NVARCHAR
1. 输入参数有误时，错误码、报错信息改变
1. 支持数据的隐式转换（varchar/nvarchar支持的场景，都支持）；
1. 函数作为整体拼接其他不同数据类型（  返回规则按照：  nclob > nvarchar > nchar > clob >varchar > char >其他数据类型      的优先级进行转换；  ），不同单位拼接，需要关注长度（length\lengthb）和返回类型（typeof）是否正确，规格和限制与varchar/nvarchar对齐；
1. 转换后的输出超过返回值规格时，截断显示
1. 不涉及视图和驱动影响（本次不涉及，还是原来的translate函数）
1. 支持数据库的ddl、dml、dql、plsql操作
1. 字符串参数支持绑定参数（jdbc、plsql都支持）
1. 一、  **CHARACTER_SET=UTF8，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：    
  a.char\varchar数据类型using char_cs，不转换原样输出，但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出，但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换成功，typeof查看数据类型是varchar
1. d.非nchar\nvarchar数据类型using nchar_cs，转换成功，typeof查看数据类型是nvarchar
1. （2）当字符串的字符集（sql文件）是utf16时：同上
1. （3）当字符串的字符集（sql文件）是其他时（ASCII、GBK、ISO-8859-1）：
1. a.char\varchar数据类型using char_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. d.非nchar\nvarchar数据类型using nchar_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. 二、  **CHARACTER_SET=GBK，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：    
  a.char\varchar数据类型using char_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. d.非nchar\nvarchar数据类型using nchar_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. （2）当字符串的字符集（sql文件）是GBK时：
1. a.char\varchar数据类型using char_cs，不转换原样输出，但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出，但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换成功，typeof查看数据类型是varchar
1. d.非nchar\nvarchar数据类型using nchar_cs，转换成功，typeof查看数据类型是nvarchar
1. 三、  **CHARACTER_SET=ASCII，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：    
  a.char\varchar数据类型using char_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. d.非nchar\nvarchar数据类型using nchar_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. （2）当字符串的字符集（sql文件）是ASCII时：
1. a.char\varchar数据类型using char_cs，不转换原样输出，但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出，但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换成功，typeof查看数据类型是varchar
1. d.非nchar\nvarchar数据类型using nchar_cs，转换成功，typeof查看数据类型是nvarchar
1. 四、  **CHARACTER_SET=ISO88591，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：    
  a.char\varchar数据类型using char_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出（显示部分乱码，覆盖不乱码和乱码的字符），但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. d.非nchar\nvarchar数据类型using nchar_cs，转换报错还是对齐oracle异常，数据库不能core不能崩溃
1. （2当字符串的字符集（sql文件）是ISO-8859-1时：
1. a.char\varchar数据类型using char_cs，不转换原样输出，但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出，但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换成功，typeof查看数据类型是varchar
1. d.非nchar\nvarchar数据类型using nchar_cs，转换成功，typeof查看数据类型是nvarchar


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

*1、参数个数： 2*

*2、参数长度：单行string的最大输入长度32000B*

*3、返回值规格：USING CHAR_CS时是VARCHAR当前max32000B；USING NCHAR_CS时是NVARCHAR当前max32000B*

*      返回值默认长度：32000B（oracle是入参字符串长度的5倍）*

*4、函数自嵌套层数：127*

*5*  *、支持隐式转换*

*6、支持全部数据类型*

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
|CLOB|✓|
|BLOB|✓|
|NCLOB|✓|
|BIT|✓|
|RAW|✓|
|JSON|✓|
|ROWID/UROWID|✓|


##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求本身的主要应用场景：*

1. **CHARACTER_SET=UTF8，NATIONAL_CHARACTER_SET=UTF16**  时：
1. （1）当字符串的字符集（sql文件）是utf8时：    
  a.char\varchar数据类型using char_cs，不转换原样输出，但typeof查看数据类型是varchar
1. b.nchar\nvarchar数据类型using nchar_cs，不转换原样输出，但typeof查看数据类型是nvarchar
1. c.非char\varchar数据类型using char_cs，转换成功，typeof查看数据类型是varchar
1. d.非nchar\nvarchar数据类型using nchar_cs，转换成功，typeof查看数据类型是nvarchar


*需求与其他特性的关联场景：*

1. 函数作为整体拼接其他不同数据类型，不同单位拼接，需要关注长度（length\lengthb）和返回类型（typeof）是否正确，规格和限制与varchar/nvarchar对齐
1. 支持数据库的ddl、dml、dql、plsql操作
1. TRANSLATE ... USING转换的结果和长度与to_char的是否一致


##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.*  *主要采用的等价类划分，边界值*  *，场景法组合及错误推测法进行设计*

*2.*  *分布式和列表需要加拦截用例*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*不涉及*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略：优先测试冒烟用例，再覆盖基本功能，场景部分最后测试*

*测试框架满足度：Guider即可*

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

## Attachments:

[TRANSLATE ... USING概要测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzBhMWFkOWEzMzExZGM4MzE1IiwicmVmX2lkIjoiNjczOTZiNzA3MjgyMDZlZmI5MmYwNWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MjIzLCJleHAiOjE3ODIzODA2MjN9.LzpDxz0Xo8h8pD1ncoWDWzLy128cYilyoJDz3uACePI)

 (application/x-xmind)    


[TRANSLATE ... USING概要测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzA4OTcwYzJhZjRmNTIwNDljIiwicmVmX2lkIjoiNjczOTZiNzA3MjgyMDZlZmI5MmYwNWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MjIzLCJleHAiOjE3ODIzODA2MjN9.bTahEUGFYN-5LqvxjnaxJbKyT3nOG-tohd8N1SsXQ3A)

 (application/x-xmind)    


[TRANSLATE ... USING概要测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzA4OTcwYzJhZjRmNTIwNDlkIiwicmVmX2lkIjoiNjczOTZiNzA3MjgyMDZlZmI5MmYwNWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MjIzLCJleHAiOjE3ODIzODA2MjN9.zW2wADCJf-eIQk9PU3ZmAtSVmYC_GW1NE9sWxZ_svhw)

 (application/x-xmind)    


[TRANSLATE ... USING概要测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzA4OTcwYzJhZjRmNTIwNDllIiwicmVmX2lkIjoiNjczOTZiNzA3MjgyMDZlZmI5MmYwNWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MjIzLCJleHAiOjE3ODIzODA2MjN9.0fV5JWI4N15-PmMCKGeehl8gSaV68Xhgb8Xn05pRdmg)

 (application/x-xmind)    


[TRANSLATE ... USING概要测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzA4OTcwYzJhZjRmNTIwNDlmIiwicmVmX2lkIjoiNjczOTZiNzA3MjgyMDZlZmI5MmYwNWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MjIzLCJleHAiOjE3ODIzODA2MjN9.5SXj-_TFJ5NJCvyLKdQvxLJadT49A9Cee_5qO3hOzLE)

 (application/x-xmind)    


[TRANSLATE ... USING概要测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzBhMWFkOWEzMzExZGM4MzE2IiwicmVmX2lkIjoiNjczOTZiNzA3MjgyMDZlZmI5MmYwNWUxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0MjIzLCJleHAiOjE3ODIzODA2MjN9.lKOpBCW-PGXZTJ5Mj3Ir6VS57bRRyo8vUBFyHfTMOh8)

 (application/x-xmind)    
