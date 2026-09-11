Created by 李思语, last modified by  张江 on 十二月 18, 2023

-   [](#DBMS_LOB处理函数测试设计-)  
-   [1. 概述](#DBMS_LOB处理函数测试设计-1.概述)  
-   [2. 需求分析](#DBMS_LOB处理函数测试设计-2.需求分析)  
    -   [2.1 功能点分析](#DBMS_LOB处理函数测试设计-2.1功能点分析)  
    -   [2.3 规格约束](#DBMS_LOB处理函数测试设计-2.3规格约束)  
-   [3. 详细测试设计](#DBMS_LOB处理函数测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#DBMS_LOB处理函数测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#DBMS_LOB处理函数测试设计-3.2详细测试设计)  
        -   [3.2.1 参考DBMS_LOB打开关闭函数测试设计](#DBMS_LOB处理函数测试设计-3.2.1参考)  
-   [4. 测试用例](#DBMS_LOB处理函数测试设计-4.测试用例)  
-   [5. 测试框架设计](#DBMS_LOB处理函数测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#DBMS_LOB处理函数测试设计-6.测试环境说明)  
-   [7. 工作量评估](#DBMS_LOB处理函数测试设计-7.工作量评估)  


# 1. 概述

本文描述  DBMS_LOB.INSTR  ，  DBMS_LOB.TRIM  ，  DBMS_LOB.ERASE  测试设计。

SR:     [YDBRD-22219](https://jira.yasdb.com/browse/YDBRD-22219?src=confmacro)    -  DBMS_LOB的LOB处理函数  完成

# 2. 需求分析

## 2.1 功能点分析

- **ERASE**  从指定偏移量开始擦除LOB中指定数量的数据
- **TRIM**  将内部LOB的长度修剪为指定长度（去除末尾超出指定长度的部分）
- **INSTR**  返回LOB中pattern第n次出现的匹配位置，从指定的偏移量开始


语法：

```
DBMS_LOB.INSTR (
   lob_loc  IN  BLOB/CLOB,
   pattern  IN  RAW/VARCHAR,
   offset   IN  BIGINT DEFAULT 1,
   nth      IN  BIGINT DEFAULT 1)
RETURN BIGINT;

DBMS_LOB.ERASE (
   lob_loc  IN OUT  BLOB/CLOB,
   amount   IN OUT  BIGINT,
   offset   IN      BIGINT DEFAULT 1);

DBMS_LOB.TRIM (
   lob_loc  IN OUT  BLOB/CLOB,
   newlen   IN      BIGINT);

```

## 2.3 规格约束

2.3.1 DBMS_LOB.INSTR

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|lob_loc|IN|BLOB/CLOB|是|待匹配的LOB定位符|  
|
|pattern|IN|RAW/VARCHAR|是|用于匹配的pattern|- pattern长度限制为32000字节
|
|offset|IN |BIGINT|否|匹配起点的LOB偏移量|- 整数范围[1, LOBMAXSIZE]，当offset>lob_length且不超出数值范围时，函数返回0
|
|nth|IN|BIGINT|否|第n个匹配|- 整数范围[1, LOBMAXSIZE]，当nth大于实际能匹配上的最大个数且不超出数值范围时，函数返回0
|


* lob_loc支持类型BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW

*  匹配BLOB，数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR；匹配CLOB/NCLOB，数据类型支持RAW/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。

返回值：返回第n个匹配上的pattern首部在LOB中的偏移量，如果未找到则返回0，如果参数为NULL、为invalid temp lob定位符或超出数值范围(数字溢出会报错)则返回NULL。

  


2.3.2 DBMS_LOB.ERASE

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|待擦除的LOB定位符|- 不可使用未初始化或设置为null的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|amount|IN OUT|BIGINT|是|（IN）擦除字节/字符数。（OUT）实际擦除字节/字符数。|- 整数数值范围[1, IN: LOBMAXSIZE]
- BIGINT类型或可隐式转换为BIGINT类型的其他类型
- 不可输入null
|
|offset|IN |BIGINT|否|擦除起点的偏移量（字节/字符数），默认值为1|- 整数数值范围[1, LOBMAXSIZE]
- BIGINT类型或可隐式转换为BIGINT类型的其他类型
- 不可输入null
|


2.3.3 DBMS_LOB.TRIM

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|待修剪的LOB定位符|- 不可使用未初始化或设置为null的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|newlen|IN|BIGINT|是|修剪后LOB的新长度|- 整数数值范围[0, lob length]
- 不可输入null
|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

3.1.1 DBMS_LOB.INSTR

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|2，3，4个（符合要求的参数）|执行成功|0，1，5个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- pattern：  匹配BLOB，数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR；匹配CLOB/NCLOB，数据类型支持RAW/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR。
- offset：数值（可隐式转换为bigint类型，常量小数或number变量小数是截断，字符常量变量小数是四舍五入）
- nth：数值（可隐式转换为bigint类型，常量小数或number变量小数是截断，字符常量变量小数是四舍五入）
|  
|- lob_loc/pattern：数值/时间/bit/boolean/自定义
- offset/nth  ：字符/时间/bit/boolean/blob/clob/nclob/raw/自定义
- pattern与lob_loc类型不匹配
|报错，提示正确|
|  
|参数值|lob_loc：,1.初始化的lob定位符（常量、变量）,    clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,    blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
,2.未初始化的或设定为null的lob定位符,3.无效的lob定位符,4.null|1中未找到返回0,匹配返回pattern首部在LOB中的偏移量,2，3，4返回null,  
,96000字节分块读取，匹配前一段及后一段|  
|  
|
|  
|  
|pattern：,长度<=32000字节,clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,    blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
|pattern：大小写敏感|pattern：  长度大于  32000字节|  
|
|  
|  
|offset/nth:,常量覆盖：,- [1,  LOBMAXSIZE  ] 区间整数(字符，数字)
- [1,  LOBMAXSIZE  ] 区间小数(字符，数字)
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
|  
|offset/nth:,常量/变量覆盖：,- 负数
- 0，大于LOB长度
- 中文、英文字符串
- 日期数据
- boolean，bit
- json
- null
|bit、boolean可以隐式转换为数值型，可以归为有效等价类--zj|
|  
|参数值组合|- pattern与lob_loc 匹配 0次
- pattern与lob_loc 匹配 1次：nth=1；nth>1；nth不配置
- pattern与lob_loc 匹配 多次:nth=1；nth>1；nth=最后一次匹；offset不配置，nth不配置
|offset,nth默认值为1|  
|  
|
|  
|  
|- offset<lob_loc len
- offset>lob_loc len
- offset=lob_loc len 
|  
|  
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|/|/|/|/|创建同名视图，同名表|  
|
|lob来源|/|- 内部
- 临时
- 外部（暂不支持）
|  
|/ |  
|
|返回值校验|/|typeof查询返回值类型正确|返回类型为BIGINT|  
|  
|
|/|/|输出返回值|  
|  
|  
|
|数据量|临时LOB|<=32000字节,>32000字节|  
|  
|  
|
|  
|持久LOB|<=4000字节,>4000字节|  
|  
|  
|
|函数/高级包嵌套|/|其他作为instr入参|  
|  
|  
|
|/|/|instr作为其他入参|  
|  
|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
|  
|


**场景测试**

|输入条件|等价类|  
|
|:---|:---|:---|
|DDL,  
|create时作为列的默认值|  
|
||alter时作为列的default默认值|  
|
||create view as select 高级包|  
|
||create table as select 高级包|  
|
|DML,  
|update|set值|
||delete|  
|
||insert|作为insert的值|
|DQL|作为select投影列返回|  
|
||作为where条件|1. where func(col1) = xx
1. where col1 = func(xx)
|
||结合join|1. 作为join投影列
1. 作为join条件（on,where）
|
||结合in/not in/exists/not exist/between and/like/not like/,any/all/some/is null/is not null等子查询|  
|
||结合group by分组(聚合函数和窗口函数)|  
|
||结合order by|1. order by函数表达式
1. order by其他：作为函数入参的列，非入参的列，存在索引的列，常量
|
||结合distinct|  
|
||参与运算|+ - * /  > < >= <=  and or|
||connect by|  
|
||plsql|自定义函数、匿名块、package、procedure中调用|


  


3.1.2 DBMS_LOB.ERASE

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|2,3个（符合要求的参数）|执行成功|0，1，4个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- amount：数值（可隐式转换为bigint类型，小数四舍五入）
- offset：数值（可隐式转换为bigint类型，常量小数或number变量小数是截断，字符常量变量小数是四舍五入）
|  
|- lob_loc：数值/时间/bit/boolean/自定义
- amount：不可隐式转换为数值的类型
- offset：不可隐式转换为数值的类型
|报错，提示正确|
|  
|参数值|lob_loc：初始化的lob定位符（常量、变量）,    clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,    blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
|  
|- 未初始化的或设定为null的lob定位符
- 无效的lob定位符
- null
|  
|
|  
|  
|amount:,变量覆盖：  整数数值范围[1, IN: LOBMAXSIZE],- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
,  
|  
|  
|  
|
|  
|  
|offset：,常量覆盖：,- 数值范围[1, IN: LOBMAXSIZE]  区间整数
- 数值范围[1, IN: LOBMAXSIZE]  区间小数
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
|  
|常量/变量覆盖：,- 负数
- 0，大于  LOBMAXSIZE
- 中文、英文字符串
- 日期数据
- boolean，bit
- json
- null
|  
|
|  
|参数值组合|- amount>lob len：offset不配置，offset<lob len，  amount>offset>lob len ，offset=lob len，offset>amount;
- amount<lob len：offset不配置，offset<amount；amount<offset<lob len，offset=lob len，offset>lob len
- amount=lob len：offset不配置，offset<amount，offset>amount
|  
|  
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|/|/|/|/|创建同名视图，同名表|  
|
|lob来源|/|- 内部
- 临时
- 外部（暂不支持）
|  
|/ |  
|
|输出参数校验|lob_loc,amount|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|数据量|临时LOB|<=32000字节,>32000字节|  
|  
|  
|
|  
|持久LOB|<=4000字节,>4000字节|  
|  
|  
|
|使用场景|plsql|自定义函数、匿名块、package、procedure中调用|  
|- select 形式调用
- create view as select 高级包
- create table as select 高级包
- ddl/dml/dql
|报错，open无返回值|
|函数/高级包嵌套|/|其他作为erase入参|  
|erase作为其他入参|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
|  
|


3.1.3 DBMS_LOB.TRIM

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|2个（符合要求的参数）|执行成功|0，1，3个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- newlen：数值（可隐式转换为bigint类型，常量小数或number变量小数是截断，字符常量变量小数是四舍五入）
|  
|- lob_loc：数值/时间/bit/boolean/自定义
- newlen：不可隐式转换为数值的类型
|报错，提示正确|
|  
|参数值|lob_loc：初始化的lob定位符(变量),    clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,    blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
|  
|- 未初始化的或设定为null的lob定位符
- 无效的lob定位符
- null
- 常量
|  
|
|  
|  
|newlen：,常量覆盖：,- [0, lob length]   区间整数 :0,lob length,随机
- [0, lob length]  区间小数
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
|  
|常量/变量覆盖：,- 负数
- 大于lob length
- 中文、英文字符串
- 日期数据
- boolean，bit
- json
- null
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|/|/|/|/|创建同名视图，同名表|  
|
|lob来源|/|- 内部
- 临时
- 外部（暂不支持）
|  
|/ |  
|
|输出参数校验|lob_loc|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|数据量|临时LOB|<=32000字节,>32000字节|  
|e|  
|
|  
|持久LOB|<=4000字节,>4000字节|  
|  
|  
|
|使用场景|plsql|自定义函数、匿名块、package、procedure中调用|  
|- select 形式调用
- create view as select 高级包
- create table as select 高级包
- ddl/dml/dql
|报错，open无返回值|
|函数/高级包嵌套|/|其他作为trim入参|  
|trim作为其他入参|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
|  
|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


3.2.1 函数调用流程

### 3.2.1 参考    [DBMS_LOB打开关闭函数测试设计](135609575.html)  

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|否|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：