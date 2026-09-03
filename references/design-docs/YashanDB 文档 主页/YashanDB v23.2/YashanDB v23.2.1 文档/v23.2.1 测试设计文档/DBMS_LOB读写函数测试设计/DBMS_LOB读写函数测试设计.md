Created by 李思语, last modified on 十二月 27, 2023

# 1. 概述

-   [1. 概述](#DBMS_LOB读写函数测试设计-1.概述)  
-   [2. 需求分析](#DBMS_LOB读写函数测试设计-2.需求分析)  
    -   [2.1 功能点分析](#DBMS_LOB读写函数测试设计-2.1功能点分析)  
    -   [2.3 规格约束](#DBMS_LOB读写函数测试设计-2.3规格约束)  
        -   [2.3.1 DBMS_LOB.READ](#DBMS_LOB读写函数测试设计-2.3.1DBMS_LOB.READ)  
        -   [2.3.2 DBMS_LOB.WRITE](#DBMS_LOB读写函数测试设计-2.3.2DBMS_LOB.WRITE)  
        -   [2.3.3 DBMS_LOB.APPEND](#DBMS_LOB读写函数测试设计-2.3.3DBMS_LOB.APPEND)  
        -   [2.3.4 DBMS_LOB.WRITEAPPEND](#DBMS_LOB读写函数测试设计-2.3.4DBMS_LOB.WRITEAPPEND)  
        -   [2.3.5 DBMS_LOB.COPY](#DBMS_LOB读写函数测试设计-2.3.5DBMS_LOB.COPY)  
-   [3. 详细测试设计](#DBMS_LOB读写函数测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#DBMS_LOB读写函数测试设计-3.1测试设计方法)  
        -   [3.1.1 DBMS_LOB.READ](#DBMS_LOB读写函数测试设计-3.1.1DBMS_LOB.READ)  
        -   [3.1.2 DBMS_LOB.WRITE](#DBMS_LOB读写函数测试设计-3.1.2DBMS_LOB.WRITE)  
        -   [3.1.3 DBMS_LOB.APPEND](#DBMS_LOB读写函数测试设计-3.1.3DBMS_LOB.APPEND)  
        -   [3.1.4 DBMS_LOB.WRITEAPPEND](#DBMS_LOB读写函数测试设计-3.1.4DBMS_LOB.WRITEAPPEND)  
        -   [3.1.5 DBMS_LOB.COPY](#DBMS_LOB读写函数测试设计-3.1.5DBMS_LOB.COPY)  
    -   [3.2 详细测试设计](#DBMS_LOB读写函数测试设计-3.2详细测试设计)  
        -   [3.2.1 参数类型正交](#DBMS_LOB读写函数测试设计-3.2.1参数类型正交)  
-   [4. 测试用例](#DBMS_LOB读写函数测试设计-4.测试用例)  
-   [5. 测试框架设计](#DBMS_LOB读写函数测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#DBMS_LOB读写函数测试设计-6.测试环境说明)  
-   [7. 工作量评估](#DBMS_LOB读写函数测试设计-7.工作量评估)  


本文描述  DBMS_LOB.READ，  DBMS_LOB.WRITE，  DBMS_LOB.APPEND，DBMS_LOB.WRITEAPPEND，DBMS_LOB.COPY  测试设计。

SR:     [YDBRD-22218](https://jira.yasdb.com/browse/YDBRD-22218?src=confmacro)    -  DBMS_LOB的LOB读写函数  完成

# 2. 需求分析

## 2.1 功能点分析

- **READ：**  从LOB指定偏移量开始读取指定数量的数据返回到buffer参数中
- **WRITE：**  将buffer参数中指定数量的数据从LOB指定偏移量开始写入LOB（覆盖偏移量处指定数量的已有数据）
- **APPEND：**  将完整的源LOB内容附加到目标LOB
- **WRITEAPPEND：**  将buffer参数中指定数量的数据写入LOB的末尾
- **COPY：**  将源LOB的全部或部分复制到目标LOB


语法：

```
DBMS_LOB.READ (
   lob_loc  IN      BLOB,
   amount   IN OUT  BIGINT,
   offset   IN      BIGINT,
   buffer   OUT     RAW);

DBMS_LOB.READ (
   lob_loc  IN      CLOB,
   amount   IN OUT  BIGINT,
   offset   IN      BIGINT,
   buffer   OUT     VARCHAR);
 
DBMS_LOB.WRITE (
   lob_loc  IN OUT  BLOB,
   amount   IN      BIGINT,
   offset   IN      BIGINT,
   buffer   IN      RAW);

DBMS_LOB.WRITE (
   lob_loc  IN OUT  CLOB,
   amount   IN      BIGINT,
   offset   IN      BIGINT,
   buffer   IN      VARCHAR);

DBMS_LOB.APPEND (
   dest_lob  IN OUT  BLOB, 
   src_lob   IN      BLOB); 

DBMS_LOB.APPEND (
   dest_lob  IN OUT  CLOB, 
   src_lob   IN      CLOB); 

DBMS_LOB.WRITEAPPEND (
   lob_loc  IN OUT  BLOB, 
   amount   IN      BIGINT, 
   buffer   IN      RAW); 

DBMS_LOB.WRITEAPPEND (
   lob_loc  IN OUT  CLOB, 
   amount   IN      BIGINT, 
   buffer   IN      VARCHAR); 

DBMS_LOB.COPY (
  dest_lob     IN OUT  BLOB,
  src_lob      IN      BLOB,
  amount       IN      BIGINT,
  dest_offset  IN      BIGINT DEFAULT 1,
  src_offset   IN      BIGINT DEFAULT 1);

BMS_LOB.COPY (
  dest_lob     IN OUT  CLOB,
  src_lob      IN      CLOB,
  amount       IN      BIGINT,
  dest_offset  IN      BIGINT DEFAULT 1,
  src_offset   IN      BIGINT DEFAULT 1);


```

## 2.3 规格约束

* lob_loc支持类型BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW

### 2.3.1 DBMS_LOB.READ

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|lob_loc|IN|BLOB/CLOB|是|待读取的LOB定位符|- 不可使用未初始化的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|amount|IN OUT|BIGINT|是|(IN)读取字节/字符数 (OUT)实际读取到的字节/字符数|- 范围为[1, 32000]  ，  出参最大为buffer的size
- BIGINT或可以隐式转换为BIGINT类型的参数
- 不可输入NULL
|
|offset|IN|BIGINT|是|读取起点的偏移量（BLOB字节/CLOB字符数）|- 范围为[1, LOB长度]
- BIGINT或可以隐式转换为BIGINT类型的参数
- 不可输入null
|
|buffer|OUT|RAW/VARCHAR|是|读操作的输出缓冲区|- buffer的size小于实际读取的字节数会报错
- 不可输入null
|


*  读BLOB，buffer数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR（RAW到HEX的转换）；读CLOB，buffer数据类型支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW（HEX到RAW的转换）

### 2.3.2 DBMS_LOB.WRITE

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|lob_loc|IN OUT|BLOB/CLOB|是|待写入的LOB定位符|- 不可使用未初始化的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|amount|IN |BIGINT|是|写入字节（BLOB）/字符（CLOB）数|- 范围为[1, buffer size]，其他情况报错
- BIGINT或可以隐式转换为BIGINT类型的参数
- 不可输入NULL
- amount > buffer 长度会报错
- amount < buffer 只写入buffer中前amount个字节/字符到lob
|
|offset|IN|BIGINT|是|写入起点的偏移量|- 范围为[1, LOBMAXSIZE]，lobmaxsize = 2^63-1
- BIGINT或可以隐式转换为BIGINT类型的参数
- 不可输入null
- 当offset超出LOB的末尾，LOB末尾到offset之间会补充0（blob）或空格(clob)
- 当offset大于4G时，报错（超出lob maxsize）
|
|buffer|IN|RAW/VARCHAR|是|写操作的输入缓冲区|- 不可输入null
- 如果是LOB类型，不可使用invalid temp lob定位符
|


*  写BLOB时，buffer支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR（HEX到RAW的转换）类型。写CLOB时，buffer支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW（RAW到HEX的转换）类型

### 2.3.3 DBMS_LOB.APPEND

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|dest_lob |IN OUT|BLOB/CLOB|是|待附加数据的目标LOB定位符|- 不可使用未初始化或设置为null的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|src_lob |IN |BLOB/CLOB|是|待读取数据的源LOB定位符|- 不可使用未初始化或设置为null的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|


*  两者同时为CLOB/CHAR/VARCHAR或者BLOB/RAW，也可以为同一个变量

### 2.3.4 DBMS_LOB.WRITEAPPEND

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|lob_loc |IN OUT|BLOB/CLOB|是|待写入的LOB定位符|- 不可使用未初始化的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|amount |IN|BIGINT|是|写入字节（BLOB）/字符数（CLOB）|- 范围为[1, buffer size]，其他情况报错
- BIGINT或可以隐式转换为BIGINT类型的参数
- 不可输入NULL
- amount > buffer 长度会报错
- amount < buffer 只写入buffer中前amount个字节/字符到lob
|
|buffer |IN|RAW/VARCHAR|是|写操作的输入缓冲区|- 不可输入null
- 如果是LOB类型，不可使用invalid temp lob定位符
|


*  写BLOB时，buffer支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR（HEX到RAW的转换）类型。写CLOB时，buffer支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW（RAW到HEX的转换）类型

### 2.3.5 DBMS_LOB.COPY

|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|
|dest_lob|IN OUT|BLOB/CLOB|是|复制目标LOB的LOB定位符|- 不可使用未初始化的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|src_lob|IN|BLOB/CLOB|是|复制源LOB的LOB定位符|- 不可使用未初始化的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|amount|IN|BIGINT|是|复制的字节（对于BLOB）或字符（对于CLOB）数|- 数值范围[1, DBMS_LOB.LOBMAXSIZE]
- BIGINT或可隐式转换为BIGINT类型的其他类型
- 当src_lob剩余字节或字符数不满足amount时，amount按实际取到的字节或字符数计算并参与后续的写入dest_lob
- 不可输入null
|
|dest_offset|IN|BIGINT|否|复制开始时目标LOB中的偏移量（以字节或字符为单位）|- 数值范围[1, DBMS_LOB.LOBMAXSIZE]
- BIGINT或可隐式转换为BIGINT类型的其他类型
- 当dest_offset超出dest_lob的末尾，dest_lob末尾到dest_offset之间会补充0（blob）或空格(clob)；偏移量小于目标dest_lob的当前长度，则覆盖现有数据
- 未指定参数时，默认值为1
- 不可输入null
|
|src_offset|IN|BIGINT|否|复制开始时源LOB中的偏移量（以字节或字符为单位）|- 数值范围[1, DBMS_LOB.LOBMAXSIZE]
- BIGINT或可隐式转换为BIGINT类型的其他类型
- 未指定参数时，默认值为1
- 不可输入null
|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

### 3.1.1 DBMS_LOB.READ

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|4个（符合要求的参数）|执行成功|0，2，5个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- amount：数值（可隐式转换为bigint类型，小数四舍五入）
- offset: 数值（可隐式转换为bigint类型，常量小数或number变量小数是截断，字符常量变量小数是四舍五入）
- buffer：lob_loc为blob时，  buffer数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR；  lob_loc为clob时，  buffer数据类型支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW；
|  
|- lob_loc：数值/时间/bit/boolean/自定义
- amount：不可隐式转换为数值的类型
- offset：不可隐式转换为数值的类型
- buffer：与lob_loc类型不匹配
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
|lob_loc：,- 未初始化或为null的lob定位符
- 无效的lob定位符（调用了freetemporary）
- null
|  
|
|  
|  
|amount：,覆盖：,- [1,32000] 区间整数（字符、数字）
- [1,32000] 区间小数（字符、数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
- boolean，bit
- 小数
- 整数
|  
|常量/变量覆盖：,- 负数
- 0，32001
- 中文、英文字符串
- 日期数据
- json
- null
,常量[1,32000] 区间整数|  
|
|  
|  
|offset:,常量覆盖：,- [1,LOB长度] 区间整数
- [1,LOB长度] 区间小数
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- boolean，bit
- char、varchar列：数字型字符串
|  
|常量/变量覆盖：,- 负数
- 0，大于LOB长度
- 中文、英文字符串
- 日期数据
- json
- null
|  
|
|  
|  
|buffer:,- buffer的size大于等于实际读取的字节/字符数
- 1，8000(RAW)，32000(VARCHAR)
,  
|  
|- buffer的size小于实际读取的字节/字符数
- null
- 常量
- 大于8000(RAW)
- 大于32000(VARCHAR)
|  
|
|  
|参数值组合|前提：buffer size不小于实际读取字节数,- amount>lob len：offset=1，offset<lob len，  amount>offset>lob len ，offset=lob len，offset>amount;
- amount<lob len：offset=1，offset<amount；amount<offset<lob len，offset=lob len，offset>lob len
- amount=lob len：offset=1，offset<amount，offset>amount
|  
|/|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
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
|数据量|临时LOB|<=32000字节,>32000字节|  
|  
|  
|
|  
|持久LOB|<=4000字节,>4000字节,列存LOB|  
|  
|  
|
|输出参数校验|amount/buffer|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|使用场景|plsql|自定义函数、匿名块、package、procedure中调用|  
|- select 形式调用
- create view as select 高级包
- create table as select 高级包
- ddl/dml/dql
|报错，函数无返回值|
|/ |函数/高级包嵌套|其他作为read入参|  
|read作为其他入参|  
|
|  
|校验异常|对比oracle异常表格|  
|  
|  
|


### 3.1.2 DBMS_LOB.WRITE

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|4个（符合要求的参数）|执行成功|0，2，5个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- amount：数值（可隐式转换为bigint类型）
- offset: 数值（可隐式转换为bigint类型）
- buffer：lob_loc为blob时，  buffer数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR；  lob_loc为clob时，  buffer数据类型支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW；
|  
|- lob_loc：数值/时间/bit/boolean/自定义
- amount：不可隐式转换为数值的类型
- offset：不可隐式转换为数值的类型
- buffer：与lob_loc类型不匹配
|报错，提示正确|
|  
|参数值|lob_loc：初始化的lob定位符（变量）,    clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,    blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
|  
|lob_loc：,- 未初始化或为null的lob定位符
- 无效的lob定位符（调用了freetemporary）
- null
- 常量
|  
|
|  
|  
|amount：,常量覆盖：,- [1,  buffer size  ] 区间整数（字符，数字）
- [1,  buffer size  ] 区间小数（字符，数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
- boolean，bit
- 整数，小数
|  
|amount：  常量/变量覆盖：,- 负数
- 0，>buffer size
- 中文、英文字符串
- 日期数据
- json
- null
|  
|
|  
|  
|offset:,常量覆盖：,- [1,4G] 区间整数（字符，数字）
- [1,4G] 区间小数字符，数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
- boolean，bit
- 整数，小数
|  
|offset：  常量/变量覆盖：,- 负数
- 0，4G+1，9223372036854775808
- 中文、英文字符串
- 日期数据
- json
- null
|（旧）补空格、0 会限制offset上限是4G----最新规格取消限制|
|  
|  
|buffer内容:（常量、变量）,clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
|  
|buffer：,- null
- 未初始化或为null的lob
- 无效的lob定位符
|buffer上限是32000字节|
|  
|参数值组合|amount <= buffer   长度,- offset=1：offset+amount<lob len，offset+amount>=lob len
- offset<lob len：offset+amount<lob len，offset+amount>=lob len
- offset>lob len
|  
|amount > buffer   长度|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|/|/|/|/|创建同名视图，同名表|  
|
|输出参数校验|lob_loc|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|lob来源|/|- 内部
- 临时
- 外部（暂不支持）
|  
|/ |  
|
|数据量|临时LOB|<=32000字节,>32000字节|in row 写到 out row,- 大数据量 如G级别如何快捷测试？
|  
|  
|
|  
|持久LOB|<=4000字节,>4000字节|in row 写到 out row|  
|  
|
|使用场景|plsql|自定义函数、匿名块、package中调用|  
|- select 形式调用
- create view as select 高级包
- create table as select 高级包
- ddl/dml/dql
|报错，函数无返回值|
|/ |函数/高级包嵌套|其他作为write入参|  
|write作为其他入参|  
|


### 3.1.3 DBMS_LOB.APPEND

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|2个（符合要求的参数）|执行成功|0，1，3个|报错，提示正确|
|/|参数类型|- dest_lob/src_lob：BLOB  /CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
|  
|dest_lob/src_lob  ：,- 数值/时间/bit/boolean/自定义
- dest_lob  与  src_lob  类型不匹配（dest_lob和src_lob需要同时为BLOB/RAW，或者同时为CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR）
|报错，提示正确|
|  
|参数值|dest_lob/src_lob  ：初始化的lob定位符（常量、变量）,    clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,    blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
|  
|dest_lob/src_lob：,- 未初始化或为null的lob定位符
- 无效的lob定位符（调用了freetemporary）
- null
,dest_lob为常量|  
|
|  
|参数对象|- dest_lob&src_lob为同一变量
- dest_lob&src_lob为不同变量
|  
|  
|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|/|/|/|/|创建同名视图，同名表|  
|
|输出参数校验|dest_lob|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|lob来源|/|- 内部
- 临时
- 外部（暂不支持）
|  
|/ |  
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
|报错，函数无返回值|
|/ |函数/高级包嵌套|其他作为APPEND入参|  
|APPEND作为其他入参|  
|


### 3.1.4 DBMS_LOB.WRITEAPPEND

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|3个（符合要求的参数）|执行成功|0，1，4个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- amount：数值（可隐式转换为bigint类型）
- buffer：lob_loc为blob时，  buffer数据类型支持RAW/BLOB/CHAR/VARCHAR/NCHAR/NVARCHAR；  lob_loc为clob时，  buffer数据类型支持CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW；
|  
|- lob_loc：数值/时间/bit/boolean/自定义
- amount：不可隐式转换为数值的类型
- buffer：与lob_loc类型不匹配
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
|lob_loc：,- 未初始化或为null的lob定位符
- 无效的lob定位符（调用了freetemporary）
- null
|  
|
|  
|  
|amount：,常量覆盖：,- [1,  buffer size  ] 区间整数（字符，数字）
- [1,  buffer size  ] 区间小数（字符，数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
- 整数，小数
|  
|amount：  常量/变量覆盖：,- 负数
- 0，>buffer size
- 中文、英文字符串
- 日期数据
- boolean，bit
- json
- null
|  
|
|  
|  
|buffer内容:,clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
,buffer与lob_loc为同一个定位符,buffer与lob_loc为不同定位符|  
|buffer：,- null
- 未初始化或为null的lob
- 无效的lob定位符
- 空串
|  
|
|  
|参数值组合|amount <= buffer   长度|  
|amount > buffer   长度|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|/|/|/|/|创建同名视图，同名表|  
|
|输出参数校验|lob_loc|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|lob来源|/|- 内部
- 临时
- 外部（暂不支持）
|  
|/ |  
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
|报错，函数无返回值|
|/ |函数/高级包嵌套|其他作为writeappend入参|  
|writeappend作为其他入参|  
|


### 3.1.5 DBMS_LOB.COPY

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|3，4，5个（符合要求的参数）|执行成功|0，6个|报错，提示正确|
|/|参数类型|- dest_lob：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- src_lob：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- amount：数值（可隐式转换为bigint类型）
- dest_offset: 数值（可隐式转换为bigint类型）
- src_offset：数值（可隐式转换为bigint类型）
|  
|- dest_lob/src_lob：数值/时间/bit/boolean/自定义
- dest_lob类型与src_lob类型不匹配
- amount：不可隐式转换为数值的类型
- dest_offset/src_offset：不可隐式转换为数值的类型
|报错，提示正确|
|/|参数值|dest_lob/src_lob：初始化的lob定位符,    clob/char/varchar/nclob/nchar/nvarchar：,- 数字：‘0’，‘1’，‘-1234’，‘0.12378’，‘-9999.932’
- 数组：[]，[1,"test"]，数组嵌套，数组嵌套对象
- 对象：{}，{"KEY":xxxxx}，对象嵌套，对象嵌套数组
- 特殊字符：$\#/*)!!~~等，不可见字符，
- \u转义字符
- 日期数据，中文字符，其他语言，表情包
,    blob/raw：,- 16进制数据：包含字母，不包含字母
- 二进制数据
,dest_lob/src_lob为同一个变量,dest_lob/src_lob为不同变量,src_lob为常量|  
|dest_lob/src_lob：,- 未初始化或为null的lob定位符
- 无效的lob定位符（调用了freetemporary）
- null
,dest_lob为常量,  
|  
|
|/|/|amount：,常量覆盖：,- [1,  LOBMAXSIZE  ] 区间整数（字符型数字，数字）
- [1,  LOBMAXSIZE  ] 区间小数（字符型数字，数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
- 整数，小数
|  
|amount：  常量/变量覆盖：,- 负数
- 0，>  LOBMAXSIZE
- 中文、英文字符串
- 日期数据
- boolean，bit
- json
- null
|  
|
|/|/|src_offset/dest_offset  :,常量覆盖：,- [1,  LOBMAXSIZE  ] 区间整数（字符型数字，数字）
- [1,  LOBMAXSIZE  ] 区间小数（字符型数字，数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
- 整数，小数
|  
|src_offset/dest_offset：  常量/变量覆盖：,- 负数
- 0，>  LOBMAXSIZE
- 中文、英文字符串
- 日期数据
- boolean，bit
- json
- null
|  
|
|/|参数值组合|针对目标lob:,- dest_offset>dest_lob len
- dest_offset<dest_lob len
- dest_offset=dest_lob len
- dest_offset不配置
,针对源lob：,- amount>src_lob len: src_offset不配置，src_offset<src_lob len,src_lob len<src_offset<amount,src_offset>amount
- amount<src_lob len: src_offset不配置，src_offset<amount,src_lob len>src_offset>amount,src_offset>src_lob len
- amount=src_lob len:src_offset不配置,src_offset<src_lob len,src_offset>src_lob len,src_offset=src_lob len
- src_offset不配置
,dest_offset不配置,src_offset不配置|- dest_offset>dest_lob len:会在dest_lob补充  零字节（写blob）或空格字符（写clob/nclob）到dest_offset再写入数据（  dest_offset不能大于4GB  ）
- src_offset<src_lob len 且 src_offset+amount>src_lob len时：amount按实际取到的字节或字符数计算并参与后续的写入目标LOB
- src_offset >src_lob len 时，不会改变dest_lob的内容。
|  
|  
|
|字符集|/|覆盖不同字符集GBK,UTF-8(默认）|传参类型为CLOB/CHAR/VARCHAR/NCLOB/NCHAR/NVARCHAR时，GBK、UTF-8两种字符集的差异|  
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|/|/|/|/|创建同名视图，同名表|  
|
|输出参数校验|dest_lob|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|lob来源|/|- 内部
- 临时
- 外部（暂不支持）
|  
|/ |  
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
|报错，函数无返回值|
|/ |函数/高级包嵌套|其他作为copy入参|  
|copy作为其他入参|  
|


##   
  3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


参考    [DBMS_LOB打开关闭函数测试设计](135609575.html)  

### 3.2.1 参数类型正交

参数1：lob_loc/dest_lob

参数2：buffer/src_lob

|参数1类型|参数2类型|类型是否匹配|
|---|---|---|
|RAW|VARCHAR||
|CHAR|VARCHAR||
|CHAR|RAW||
|CHAR|NCLOB||
|NCLOB|VARCHAR||
|CLOB|NVARCHAR||
|NCHAR|CLOB||
|CLOB|VARCHAR||
|NCHAR|CHAR||
|RAW|NCHAR||
|BLOB|NVARCHAR||
|NVARCHAR|CLOB||
|NCLOB|CHAR||
|CLOB|NCLOB||
|RAW|CHAR||
|RAW|BLOB||
|VARCHAR|CLOB||
|VARCHAR|CHAR||
|BLOB|RAW||
|NCLOB|NCLOB||
|NCHAR|VARCHAR||
|BLOB|BLOB||
|NVARCHAR|NCLOB||
|VARCHAR|BLOB||
|VARCHAR|NCHAR||
|**BLOB**|**CLOB**||
|NVARCHAR|RAW||
|CHAR|CLOB||
|NVARCHAR|VARCHAR||
|NVARCHAR|NVARCHAR||
|NCHAR|NVARCHAR||
|**BLOB**|**NCLOB**||
|BLOB|VARCHAR||
|BLOB|NCHAR||
|**CLOB**|**BLOB**||
|CLOB|NCHAR||
|NVARCHAR|BLOB||
|VARCHAR|VARCHAR||
|NCHAR|RAW||
|NCHAR|NCHAR||
|CLOB|CHAR||
|VARCHAR|RAW||
|NCLOB|CLOB||
|NVARCHAR|CHAR||
|CHAR|NVARCHAR||
|RAW|CLOB||
|**NCLOB**|**BLOB**||
|CLOB|CLOB||
|NCLOB|NCHAR||
|NCHAR|NCLOB||
|NVARCHAR|NCHAR||
|CHAR|CHAR||
|VARCHAR|NVARCHAR||
|RAW|NVARCHAR||
|NCHAR|BLOB||
|NCLOB|RAW||
|CLOB|RAW||
|BLOB|CHAR||
|CHAR|NCHAR||
|NCLOB|NVARCHAR||
|RAW|NCLOB||
|VARCHAR|NCLOB||
|CHAR|BLOB||
|RAW|RAW||


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