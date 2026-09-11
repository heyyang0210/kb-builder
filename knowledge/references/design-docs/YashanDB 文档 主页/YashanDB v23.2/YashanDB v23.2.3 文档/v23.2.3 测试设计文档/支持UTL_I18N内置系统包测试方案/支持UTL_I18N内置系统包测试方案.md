Created by 董灵林, last modified on 六月 18, 2024

**测试详细设计目的：**    
  **1.继承需求调研文档和测试概要设计，并补充开发设计机制、内部规格等来完善测试设计**    
  **2.梳理测试点，指导测试用例撰写**

# 1. 概述

产品化需求，兼容ORACLE。

SR链接：    [https://pingcode.yasdb.com/pjm/items/66271e31fd997db58adf6151](https://pingcode.yasdb.com/pjm/items/66271e31fd997db58adf6151)    ?#YDBRD-26599 支持UTL_I18N内置系统包

开发设计文档：

# 2. 需求分析

本次需求值涉及子函数  string_to_raw、raw_to_char  ，且字符集关注 yashandb 已支持的字符集：UTF8,UTF16, GBK, GB18030, ISO88591。

- STRING_TO_RAW 函数：此函数是将 VARCHAR2 及 NVARCHAR2 类型转换成 oracle 支持的另一个字符集，并将结果作为 RAW 数据返回。


|  `UTL_I18N.STRING_TO_RAW(`      
    `   `      `data          IN VARCHAR2 CHARACTER SET ANY_CS,`      
    `   `      `dst_charset   IN VARCHAR2 DEFAULT NULL)`      
    `RETURN RAW;`  |
|:---|


函数参数说明：

|Parameter|Description|
|:---|:---|
|  `data`  |指定要转换的 VARCHAR或 NVARCHAR字符串。|
|  `dst_charset`  |指定目标字符集。如果 dst_charset 为空，则 CHAR 数据使用数据库字符集，NCHAR 数据使用国家字符集。|


注：如果用户指定了无效的字符集、NULL 字符串或长度为 0 的字符串，则该函数将返回 NULL 字符串。

- RAW_TO_CHAR   函数：此函数将 RAW 数据从有效的 Oracle 字符集转换为数据库字符集中的VARCHAR2字符串。


|  `UTL_I18N.RAW_TO_CHAR(`      
    `   `      `data          IN RAW,`      
    `   `      `src_charset   IN VARCHAR2 DEFAULT NULL)`      
    ` `      `RETURN VARCHAR2;`      
    
    `分段转换将原始数据逐段转换为字符数据（因为当前高级包框架不支持重载函数，此函数暂不实现）`      
    `UTL_I18N.RAW_TO_CHAR (`      
    `   `      `data            IN RAW,`      
    `   `      `src_charset     IN VARCHAR2 DEFAULT NULL,`      
    `   `      `scanned_length  OUT PLS_INTEGER,`      
    `   `      `shift_status    IN OUT PLS_INTEGER)`      
    `RETURN VARCHAR2;`  |
|:---|


参数说明：

|Parameter|Description|备注|
|:---|:---|---|
|  `data`  |in参数，指定要转换为 VARCHAR2 字符串的 RAW 数据|  
|
|  `src_charset`  |in参数，指定 RAW 数据的字符集。如果 src_charset 为空，则使用数据库字符集。|  
|
|  `scanned_length`  |out参数，整形，已转换长度|此参数本次不支持|
|  `shift_status`  |in out参数，整形，转换状态，当前试验结果，不管传入0还是非零值，转换成功后输出值为0，转换失败后直接报错，没有碰到输出非零的情况|此参数本次不支持|


# 3. 详细测试设计

## 3.1 测试设计方法

- 功能验证：边界值、等价类划分，正交法
- 性能验证：典型场景设计
- 可靠性：等价类划分、场景组合


## 3.2 详细测试设计

|序号|测试分类|功能点|测试点|备注|
|---|---|---|---|---|
|1|语法测试|STRING_TO_RAW参数校验|data参数为字符串常量、null、数值等字面量|test_sdv_YDBRD_26599_001|
|  
|  
|  
|data参数边界值测试|test_sdv_YDBRD_26599_001-002|
|2|  
|  
|data参数为表的char, char(n char), nchar, varchar, varchar(n char), nvarchar字段|test_sdv_YDBRD_26599_004|
|3|  
|  
|data参数为表的其他字段类型（数值类型、时间类型、lob类型、bit类型、boolean类型等）|test_sdv_YDBRD_26599_005|
|4|  
|  
|data参数为ST_GEOMETRY、BOX2D、自定义类型等|test_sdv_YDBRD_26599_006|
|5|  
|  
|dst_charset参数为缺省、有效字符集（  UTF8,UTF16, GBK, GB18030, ISO88591）、无效字符集、非字符类型|test_sdv_YDBRD_26599_004|
|6|  
|  
|使用命名参数赋值,正常参数组合：,data +   dst_charset,data,异常参数组合：,dst_charset,无参|test_sdv_YDBRD_26599_003|
|7|  
|RAW_TO_CHAR  参数校验|data参数为字符串常量、null、数值等字面量|test_sdv_YDBRD_26599_007|
|  
|  
|  
|data参数边界值测试|test_sdv_YDBRD_26599_007-008|
|8|  
|  
|data参数为raw|test_sdv_YDBRD_26599_010|
|9|  
|  
|data参数为表的varchar、nvarchar、char、varchar、blob字段（可以隐式转换为raw类型的类型）|test_sdv_YDBRD_26599_011|
|10|  
|  
|data参数为表的其他字段类型（数值类型、时间类型、bit类型、boolean类型等）|test_sdv_YDBRD_26599_012|
|11|  
|  
|data参数为ST_GEOMETRY、BOX2D、自定义类型等|test_sdv_YDBRD_26599_013|
|12|  
|  
|src_charset参数为缺省、有效字符集（  UTF8,UTF16, GBK, GB18030, ISO88591）、无效字符集、非字符类型|test_sdv_YDBRD_26599_010|
|13|  
|  
|使用命名参数赋值，,正常参数组合：,data +   src_charset,data,异常参数组合：,src_charset|test_sdv_YDBRD_26599_009|
|14|  
|  
|校验出参类型|test_sdv_YDBRD_26599_004-006,test_sdv_YDBRD_26599_010|
|15|使用场景测试|投影列|select xxx from dual|test_sdv_YDBRD_26599_001,test_sdv_YDBRD_26599_007|
|16|  
|  
|select xxx from tb|test_sdv_YDBRD_26599_004-006,test_sdv_YDBRD_26599_010-013|
|17|  
|  
|两个函数自嵌套、互相嵌套、嵌套128层|test_sdv_YDBRD_26599_015|
|24|  
|  
|case when子句中|评审可以舍弃|
|25|  
|filter|单独使用、and/or串联、between and串联、in/any/all条件（非子查询）|test_sdv_YDBRD_26599_014|
|26|  
|group by having|  
|评审可以舍弃|
|27|  
|子查询|filter子查询|评审可以舍弃|
|28|  
|  
|project（标量子查询）|评审可以舍弃|
|29|  
|  
|in/exists/any/all子查询|评审可以舍弃|
|  
|  
|plsql|自定义包、函数、存储过程、匿名块中使用|test_sdv_YDBRD_26599_014|
|30|字符集测试|修改数据库字符集（只测试字符集缺省场景）|分别设置数据库字符集为  GBK、UTF-8、GB18030、ASCII和ISO-8859-1，测试两个函数转换结果,测试任意一种即可（GB18030）,select UTL_I18N.STRING_TO_RAW('中文', 'gb18030'), UTL_I18N.STRING_TO_RAW('中文'), UTL_I18N.STRING_TO_RAW('中文', 'utf8') from dual;|手工执行|
|32|  
|  
|YashanDB无法修改国家字符集，只能是  UTF-16，无法修改|手工执行|
|  
|  
|重点关注功能转换是否符合预期|  
|  
|


  


  


# 4. 测试用例

# 5. 测试框架设计

|验证项|框架|
|:---|:---|
|FT|yasft|
|性能|不涉及|
|并发|不涉及|
|dfx|不涉及|


## Attachments:

[支持UTL_I18N内置系统包测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMjY4OTcwYzJhZjRmNTIxMGFjIiwicmVmX2lkIjoiNjczOTZkMjY3MjgyMDZlZmI5MmYxYmIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2MjQyLCJleHAiOjE3ODIzOTI2NDJ9.ikncaYBXUAwnXc_PqSqdLq0oNiaRDOREeI7H2liooAg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
