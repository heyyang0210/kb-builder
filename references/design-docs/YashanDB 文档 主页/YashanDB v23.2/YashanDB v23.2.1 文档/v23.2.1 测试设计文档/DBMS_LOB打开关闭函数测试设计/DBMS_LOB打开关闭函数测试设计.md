Created by 李思语, last modified on 一月 29, 2024

-   [](#DBMS_LOB打开关闭函数测试设计-)  
-   [1. 概述](#DBMS_LOB打开关闭函数测试设计-1.概述)  
-   [2. 需求分析](#DBMS_LOB打开关闭函数测试设计-2.需求分析)  
    -   [2.1 功能点分析](#DBMS_LOB打开关闭函数测试设计-2.1功能点分析)  
    -   [2.3 规格约束](#DBMS_LOB打开关闭函数测试设计-2.3规格约束)  
-   [3. 详细测试设计](#DBMS_LOB打开关闭函数测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#DBMS_LOB打开关闭函数测试设计-3.1测试设计方法)  
        -   [3.1.1 DBMS_LOB.OPEN](#DBMS_LOB打开关闭函数测试设计-3.1.1DBMS_LOB.OPEN)  
        -   [3.1.2 DBMS_LOB.CLOSE](#DBMS_LOB打开关闭函数测试设计-3.1.2DBMS_LOB.CLOSE)  
        -   [3.1.3 DBMS_LOB.ISOPEN](#DBMS_LOB打开关闭函数测试设计-3.1.3DBMS_LOB.ISOPEN)  
    -   [3.2 详细测试设计](#DBMS_LOB打开关闭函数测试设计-3.2详细测试设计)  
        -   [3.2.1 参数类型，open_mode，loc来源正交表](#DBMS_LOB打开关闭函数测试设计-3.2.1参数类型，open_mode，loc来源正交表)  
        -   [3.2.2 函数操作流程1](#DBMS_LOB打开关闭函数测试设计-3.2.2函数操作流程1)  
            -   [表1：lob基本操作流程](#DBMS_LOB打开关闭函数测试设计-表1：lob基本操作流程)  
            -   [表2：函数两两排列组合测试](#DBMS_LOB打开关闭函数测试设计-表2：函数两两排列组合测试)  
            -   [表3：knl lob 场景](#DBMS_LOB打开关闭函数测试设计-表3：knllob场景)  
        -   [3.2.3 函数操作流程2](#DBMS_LOB打开关闭函数测试设计-3.2.3函数操作流程2)  
        -   [3.2.4 存储方式转换表](#DBMS_LOB打开关闭函数测试设计-3.2.4存储方式转换表)  
        -   [3.2.5 并发正交测试](#DBMS_LOB打开关闭函数测试设计-3.2.5并发正交测试)  
-   [4. 测试用例](#DBMS_LOB打开关闭函数测试设计-4.测试用例)  
-   [5. 测试框架设计](#DBMS_LOB打开关闭函数测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#DBMS_LOB打开关闭函数测试设计-6.测试环境说明)  
-   [7. 工作量评估](#DBMS_LOB打开关闭函数测试设计-7.工作量评估)  


# 1. 概述

本文描述  DBMS_LOB.OPEN，  DBMS_LOB.CLOSE，  DBMS_LOB.ISOPEN  测试设计。

SR:     [YDBRD-13361](https://jira.yasdb.com/browse/YDBRD-13361?src=confmacro)    -  DBMS_LOB的LOB打开关闭函数  完成

# 2. 需求分析

## 2.1 功能点分析

- **OPEN**  以指定的模式（只读、读写）打开LOB
- **CLOSE**  关闭之前打开的LOB
- **ISOPEN**  检查LOB是否已经打开，open返回1，否则返回0。


语法：

```
DBMS_LOB.OPEN (
   lob_loc    IN OUT  BLOB/CLOB,
   open_mode  IN      INTEGER);

DBMS_LOB.CLOSE (
   lob_loc  IN OUT  BLOB/CLOB); 

DBMS_LOB.ISOPEN (
   lob_loc  IN  BLOB/CLOB) 
RETURN INTEGER; 

```

## 2.3 规格约束

|函数|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|---|
|open|lob_loc|IN OUT|BLOB/CLOB|是|LOB定位符|- 不可使用未初始化的或设置为null的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|/|open_mode|IN|INTEGER|是|打开模式（只读/读写）,0：只读模式，1：读写模式|- 数值范围：[-2^31,2^31-1]，输入范围内其他数值默认为0
- 类型可以是可隐式转换为int的类型
|
|close|lob_loc|IN OUT|BLOB/CLOB|是|LOB定位符|- 不可使用未初始化的或设置为null的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|
|isopen|lob_loc|IN|BLOB/CLOB|是|LOB定位符|- 不可使用未初始化的或设置为null的LOB定位符
- 不可使用无效的LOB定位符
- 不可输入null
|


* lob_loc支持类型BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW

# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

### 3.1.1 DBMS_LOB.OPEN

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|2个（符合要求的参数）|执行成功|0，1，3个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- open_mode：数值（可隐式转换为int类型，小数四舍五入）
|  
|- lob_loc：数值/时间/bit/boolean/json/xmltype/rowid/urowid/自定义
- open_mode：字符/时间/blob/clob/nclob/raw/json/xmltype/rowid/urowid/自定义
|报错，提示正确|
|  
|参数值|lob_loc：初始化的lob定位符,EMPTY_CLOB，EMPTY_BLOB,open_mode:数值范围在[-2^31,2^31-1] 区间（输入范围内其他数值默认为0）,常量覆盖：,- [-2147483648,2147483647] 区间整数/小数（字符、数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number列
- char、varchar列：数字型字符串
- Boolean，bit
- 小数
- 整数
|  
|lob_loc：,- 未初始化或为null的lob定位符；
- 无效的lob定位符（调用了freetemporary）
- 常量；
- null
- 伪列
- sequence
,open_mode：,- 小于-2^31
- 大于2^31-1；
- 中文、英文字符串
- 日期数据
- json
- null
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|  
|  
|创建同名视图，同名表|  
|  
|  
|
|lob来源|/|- 内部
- 临时
- V$SQL/V$SQLAREA上的SQL_FULLTEXT 
- 外部（暂不支持）
|  
|/ |  
|
|输出参数校验|lob_loc|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|使用场景|plsql|自定义函数、匿名块、package、procedure中调用|  
|- select 形式调用
- create view as select 高级包
- create table as select 高级包
- ddl/dml/dql
|报错，open无返回值|
|/ |函数/高级包嵌套|其他作为open入参|  
|open作为其他入参|  
|
|创建数量|  
|无上限，资源耗尽会报错，测试资源占用情况|  
|  
|  
|


  


### 3.1.2 DBMS_LOB.CLOSE

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|1个（符合要求的参数）|执行成功|0，2个|报错，提示正确|
|/|参数类型|lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW|CHAR/VARCHAR/RAW/NCHAR/NVARCHAR类型不能被关闭，调用close会报错（设置open也是unopen状态）|lob_loc：数值/时间/bit/boolean/自定义|报错，提示正确|
|  
|参数值|lob_loc：初始化的并且已经open的lob定位符,  
|  
|lob_loc：,- 未初始化或为null的lob定位符；
- 无效的lob定位符（调用了freetemporary）；
- 常量；
- null
- 伪列
- sequence
- 初始化的未open的lob_loc
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|  
|  
|创建同名视图，同名表|  
|  
|  
|
|lob来源|/|- 内部
- 临时
- V$SQL/V$SQLAREA上的SQL_FULLTEXT 
- 外部（暂不支持）
|  
|/ |  
|
|输出参数校验|lob_loc|通过dbms_output.put_line输出校验输出内容|  
|  
|  
|
|使用场景|plsql|自定义函数、匿名块、package、procedure中调用|  
|- select 形式调用
- create view as select 高级包
- create table as select 高级包
- ddl/dml/dql
|报错，函数无返回值|
|/ |函数/高级包嵌套|其他作为close入参|  
|close作为其他入参|  
|


### 3.1.3 DBMS_LOB.ISOPEN

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|1个（符合要求的参数）|执行成功|0，2个|报错，提示正确|
|/|参数类型|lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW|  
|lob_loc：数值/时间/bit/boolean/自定义|报错，提示正确|
|/|参数值|lob_loc：初始化的lob定位符,- open lob
- unopen lob
,常量,  
|  
|lob_loc：,- 未初始化或为null的lob定位符；
- 无效的lob定位符（调用了freetemporary）；
- null
- 伪列
- sequence
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|  
|  
|创建同名视图，同名表|  
|  
|  
|
|lob来源|/|- 内部
- 临时
- V$SQL/V$SQLAREA上的SQL_FULLTEXT 
- 外部（暂不支持）
|  
|/ |  
|
|返回值校验|/|typeof查询返回值类型正确|  
|  
|  
|
|/|/|查看结果|  
|  
|  
|
|函数/高级包嵌套|/|其他作为isopen入参|  
|  
|  
|
|/|/|isopen作为其他入参|  
|  
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
||plsql|自定义函数、匿名块、package中调用|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


### 3.2.1 参数类型，open_mode，loc来源正交表

|  
|参数类型|open_mode|lob来源|未执行open前，isopen预期结果|执行open后，isopen预期结果|执行close后，isopen预期结果|
|---|---|---|---|---|---|---|
|1|BLOB|0|临时|0|1|0|
|2|CLOB|1|临时|0|1|0|
|3|NCLOB|0|临时|0|1|0|
|4|RAW|1|临时|0|0|执行close报错，isopen返回0|
|5|CHAR|0|临时|0|0|执行close报错，isopen返回0|
|6|NCHAR|1|临时|0|0|执行close报错，isopen返回0|
|7|VARCHAR|0|临时|0|0|执行close报错，isopen返回0|
|8|NVARCHAR|1|临时|0|0|执行close报错，isopen返回0|
|9|BLOB|1|内部|0|1|0|
|10|CLOB|0|内部|0|1|0|
|11|NCLOB|1|内部|0|1|0|
|12|RAW|0|内部|0|0|执行close报错，isopen返回0|
|13|CHAR|1|内部|0|0|执行close报错，isopen返回0|
|14|NCHAR|0|内部|0|0|执行close报错，isopen返回0|
|15|VARCHAR|1|内部|0|0|执行close报错，isopen返回0|
|16|NVARCHAR|0|内部|0|0|执行close报错，isopen返回0|


### 3.2.2 函数操作流程1

#### 表1：lob基本操作流程

加测open_mode为小数时，四舍五入和截断

|输入条件1|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|lob基本操作流程|open只读-→read→close|执行成功|open只读→write |报错|
|  
|open只读-→instr→close|  
|open只读→append|  
|
|  
|open读写→read→close|  
|open只读→writeappend|  
|
|  
|open读写→instr→close|  
|open只读→trim|  
|
|  
|open读写→write →close|  
|open只读→erase|  
|
|  
|open读写 src, 读写 dest→append →close|  
|open dest只读→ append|  
|
|  
|open只读 src ,读写 dest→append →close|  
|open dest只读→ copy|  
|
|  
|open读写 src,读写 dest→copy→close|  
|  
|  
|
|  
|open只读 src ,读写 dest→copy →close|  
|  
|  
|
|  
|open读写→writeappend→close|  
|未open→close|单点功能已覆盖|
|  
|open读写→trim→close|  
|open→ open|  
|
|  
|open读写→erase→close|  
|open→ close→ close|  
|
|  
|  
|  
|open→未close提交事务|  
|
|  
|未open→ read|单点功能已覆盖|创建temp lob并初始化→freetemporary→  open|temp lob:隐式创建，显式创建|
|  
|未open→ instr|  
|创建temp lob并初始化→open→ freetemporary→  close|  
|
|  
|未open→ write |  
|创建temp lob并初始化→freetemporary→  read|  
|
|  
|未open→ append|  
|创建temp lob并初始化→freetemporary→ write|  
|
|  
|未open→ writeappend|  
|创建temp lob并初始化→freetemporary→writeappend|  
|
|  
|未open→ trim|  
|创建temp lob并初始化→freetemporary→append|  
|
|  
|未open→ erase|  
|创建temp lob并初始化→freetemporary→trim|  
|
|  
|未open→ copy|  
|创建temp lob并初始化→freetemporary→erase|  
|
|  
|创建temp lob并初始化→freetemporary→  instr|单点功能已覆盖|创建temp lob并初始化→freetemporary→copy|  
|
|  
|创建temp lob并初始化→freetemporary→  istemporary|  
|创建temp lob并初始化→freetemporary→  isopen|  
|


#### 表2：函数两两排列组合测试

|函数名|open|read|instr|write|writeappend|append|copy|erase|trim|
|---|---|---|---|---|---|---|---|---|---|
|read|read→open|read→ read|read→instr|read→ write|read→ writappend|read → append|read→ copy|read→ erase|read→ trim|
|instr|instr→open|instr→ read|instr→ instr|instr→ write|instr→wrtieappend|instr→append|instr→copy|instr→erase|instr→trim|
|write|write→ open|write→read|write→instr|write→write|write→writeappend|write→append|write→copy|write→erase|write→trim|
|writeappend|writeappend→ open|writeappend→read|writeappend→instr|writeappend→write|writeappend→writeappend|writeappend→append|writeappend→copy|writeappend→erase|writeappend→trim|
|append|append→ open|append→read|append→instr|append→write|append→writeappend|append→append|append→copy|append→erase|append→trim|
|copy|copy→ open|copy→ read|copy→ instr|copy→ write|copy→ writeappend|copy→ append|copy→ copy|copy→ erase|copy→ trim|
|erase|erase→ open|erase→ read|erase→ instr|erase→ write|erase→ writeappend|erase→ append|erase→ copy|erase→ erase|erase→ trim|
|trim|trim→ open|trim→ read|trim→ instr|trim→ write|trim→ writeappend|trim→ append|trim→ copy|trim→ erase|trim→ trim|
|close|close→ open|close→ read|close→ instr|close→ write|close→ writeappend|close→ append|close→ copy|close→ erase|close→ trim|


#### 表3：knl lob 场景

|knl lob 场景|
|---|
|select into for update → dbms_lob|
|select into for update→ update → dbms_lob → commit|
|select into for update→ update → commit → dbms_lob|
|insert → select into→ dbms_lob → commit → dbms_lob|
|insert → select into for update→ dbms_lob → commit → dbms_lob|
|insert → select into for update→ update → select into→ dbms_lob → commit → dbms_lob|
|select into for update→ insert → commit → select into for update→ dbms_lob|
|select into B for update → A=>B → dbms_lob A , B|
|select into A for update id =1 → select into B for update  id =1→ dbms_lob A , B|


### 3.2.3 函数操作流程2

|  
|lob分类|操作流程|备注|
|---|---|---|---|
|1|temp lob|open A → A 写 → A赋给B(create) → B 读 → B 处理→ A 读→ B读→ A close→ Afree→ Bfree|- 读：read,instr
- 写：write,writeappend,append,copy
- 处理：erase,trim
|
|2|  
|A(create)→ open A → A 写 → A赋给B → B 读 → B 写→ A 读→ B读→ A close|- 结合已有函数（    [COMPARE](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_LOB.html#compare)    ，    [GET_LENGTH](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_LOB.html#get-length)    ，    [SUB_STR](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PLSQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_LOB.html#sub-str)    ）
- 结合读写处理函数组合测试
|
|3|  
|A(create)→ A写 → A 读 → A赋给B→ A处理→A赋给C(create) → B写→ A读→ B读→ C读→ C赋给B→ B读|  
|
|4|  
|A 写 → A 读 → A赋给B(create)→ A处理→ B写→A赋给C→ A读→ B读→ C读→ B赋给C→ C读|  
|
|5|  
|循环写操作|执行完，查看swap表空间释放被释放|
|6|knl lob|select ... into A from tb→A 写|- 进行修改不加锁，写/处理操作会报错（select ... into ... from tb）
- 进行修改加锁，写/处理操作执行成功(select .. into ...  from tb for update)
|
|7|  
|select ... into A from tb→A 处理|列存lob测试   行列差异：,行表：,- insert into - select into - write成功
- insert into - commit -select into - write报错未锁定行
- insert into - commit -select into for update - write成功
,列表,- inrow的lob是insert into - select into - write报错未锁定行（之后报错信息修改为未支持的特性
- inrow的lob不加for update 报错为未支持的特性
- insert into - select into for update - write成功
|
|8|  
|select ... into A from tb→A读→ select ... into A from tb for update→ A写→A读→ select ... into A from tb→A读|  
|
|9|  
|select ... into A from tb for update→A 读→ A处理→ select ... into A from tb for update→ A 读|  
|
|10|  
|select ... into A from tb for update → A写→ select ... into B from tb for update →B读 →A写→B读→ A读→ select ... into A from tb for update →A读|  
|
|11|  
|select ... into A from tb for update→ A写→Aopen→  A赋给B→ B读→ B写→ A 读→select ... into A from tb for update→ A读→  Aclose|  
|
|12|  
|select ... into A from tb for update→ A写→  A赋给B→A处理→ B处理→ B读→ A 读→ Aclose→ select ... into A from tb for update→ A 读|  
|
|13|  
|select ... into A from tb for update → A写→  A赋给B→ A写→  进行rollback操作→ A读→ B读→select ... into A from tb → A读|  
|
|14|  
|select ... into A from tb for update→ A处理→ A赋给B→ A处理→   进行rollback操作→ A读→ B读→select ... into A from tb → A读|  
|
|15|  
|set autocommit on→ 执行写操作|  
|
|16|  
|set autocommit on→ 执行处理操作|  
|
|17|temp lob → knl lob|A(create)→ A写→ A读→ select ... into A from tb for update→ A读→ A写→  select ... into A from tb for update→ A读|  
|
|18|  
|A(create)→ A写→ select ... into A from tb for update→ A读→ A处理→  select ... into A from tb for update→ A读|  
|
|19|knl lob → temp lob|select ... into A from tb for update→A(create)→ A写→ A读→ select ... into A from tb for update→ A读|  
|
|20|  
|select ... into A from tb for update→A(create)→ A处理→ A读→ select ... into A  from tb for update→ A读|  
|


### 3.2.4 存储方式转换表

|lob分类|存储方式|操作|备注|
|---|---|---|---|
|temp lob |in row→out row|1.write,append,writeappend,copy,erase 操作会转化为out row,2.字符串拼接 ||,3.createtemporary创建的lob是out row|临时LOB    
  temp lob in row：<=32000字节    
  temp lob out row：>32000字节,  
  持久LOB    
  knl lob in row：<=4000字节（包括head，即LobCoupon.data前占12字节）    
  knl lob out row：>4000字节|
|/|~~ out row→in row~~|~~trim ~~,out row trim 小于32000还是out row||
|  
|  
|  
||
|knl lob|in row→ out row|小于4000，write,append,writeappend,copy大于4000|knl lob会回写表，注意表中数据是否正确 ，  事务一致性 |
|/|out row→ in row|大于4000，trim小于4000|同上|


### 3.2.5 并发正交测试

|lob操作|是否open|lob来源|备注|
|---|---|---|---|
|读读|unopen|knl lob|读：read,instr,写：write,writeappend,append,trim,erase,copy|
|读读|open|temp lob|  
|
|写写|unopen|temp lob|  
|
|读写|open|knl lob|  
|
|读写|unopen|temp lob|  
|
|写写|open|knl lob|  
|


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

[dbms_lob文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGRhMWFkOWEzMzExZGM4M2RhIiwicmVmX2lkIjoiNjczOTZiOGQ3MjgyMDZlZmI5MmYwNzc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NDI5LCJleHAiOjE3ODIzODE4Mjl9.BkKTCSIZZGY5PSTpbd9Y0W67BJ4SrGODs36Gd7oiakg)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2023-10-18_11-34-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGQ4OTcwYzJhZjRmNTIwNTY0IiwicmVmX2lkIjoiNjczOTZiOGQ3MjgyMDZlZmI5MmYwNzc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NDI5LCJleHAiOjE3ODIzODE4Mjl9.6Oa55bf7jAmuGdRl38GUvnXSt-3atAsucZJq55X3TSU)

 (image/png)    


[image2023-10-18_11-36-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGRhMWFkOWEzMzExZGM4M2RjIiwicmVmX2lkIjoiNjczOTZiOGQ3MjgyMDZlZmI5MmYwNzc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NDI5LCJleHAiOjE3ODIzODE4Mjl9.sGzySeFz8rLwcjqnLh1EWNSoac5EjsHMiqBVwm9kR90)

 (image/png)    


[dbms_lob文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGRhMWFkOWEzMzExZGM4M2RhIiwicmVmX2lkIjoiNjczOTZiOGQ3MjgyMDZlZmI5MmYwNzc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NDI5LCJleHAiOjE3ODIzODE4Mjl9.BkKTCSIZZGY5PSTpbd9Y0W67BJ4SrGODs36Gd7oiakg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,package 里面声明lob类型变量,UDT 成员为lob_loc,Posted by lisiyu at 十二月 07, 2023 17:21|
|---|
|  [](null)  ,会议纪要    
  1.lob_loc 为伪列,sequence    
  2.lob来源增加memory lob(V$SQL/V$SQLAREA上的SQL_FULLTEXT)    
  3.lob基本操作流程补充append,copy src是读，目标是写操作    
  4.增加列存lob测试    
  5.DBMS_LOB.INSTR注意96000字节分块读取    
  6.校验异常对比oracle异常表格,Posted by lisiyu at 十二月 18, 2023 09:47|
