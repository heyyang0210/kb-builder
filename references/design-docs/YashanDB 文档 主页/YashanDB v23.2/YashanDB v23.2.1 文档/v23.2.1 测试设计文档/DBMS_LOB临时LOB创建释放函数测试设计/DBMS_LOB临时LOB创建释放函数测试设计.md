Created by 李思语, last modified on 一月 24, 2024

-   [](#DBMS_LOB临时LOB创建释放函数测试设计-)  
-   [1. 概述](#DBMS_LOB临时LOB创建释放函数测试设计-1.概述)  
-   [2. 需求分析](#DBMS_LOB临时LOB创建释放函数测试设计-2.需求分析)  
    -   [2.1 功能点分析](#DBMS_LOB临时LOB创建释放函数测试设计-2.1功能点分析)  
    -   [2.3 规格约束](#DBMS_LOB临时LOB创建释放函数测试设计-2.3规格约束)  
-   [3. 详细测试设计](#DBMS_LOB临时LOB创建释放函数测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#DBMS_LOB临时LOB创建释放函数测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#DBMS_LOB临时LOB创建释放函数测试设计-3.2详细测试设计)  
-   [4. 测试用例](#DBMS_LOB临时LOB创建释放函数测试设计-4.测试用例)  
-   [5. 测试框架设计](#DBMS_LOB临时LOB创建释放函数测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#DBMS_LOB临时LOB创建释放函数测试设计-6.测试环境说明)  
-   [7. 工作量评估](#DBMS_LOB临时LOB创建释放函数测试设计-7.工作量评估)  


# 1. 概述

本文描述  DBMS_LOB.CREATETEMPORARY，  DBMS_LOB.FREETRMPORARY，  DBMS_LOB.ISTEMPORARY  测试设计。

SR:     [YDBRD-13360](https://jira.yasdb.com/browse/YDBRD-13360?src=confmacro)    -  DBMS_LOB的临时LOB创建释放函数  完成

# 2. 需求分析

## 2.1 功能点分析

- **CREATETEMPORARY **  在临时表空间创建临时LOB(BLOB,CLOB)及其对应的索引
- **FREETEMPORARY **  释放位于默认临时表空间中的临时 BLOB 或 CLOB
- **ISTRMPORARY **  返回  一个 LOB 实例是否是临时的LOB


语法：

```
DBMS_LOB.CREATETEMPORARY (
   lob_loc  IN OUT  BLOB/CLOB,
   cache    IN      BOOLEAN DEFAULT FALSE,
   dur      IN      INTEGER DEFAULT 10); 

DBMS_LOB.FREETEMPORARY (
   lob_loc  IN OUT  BLOB/CLOB); 

DBMS_LOB.ISTEMPORARY (
   lob_loc  IN  BLOB/CLOB)
RETURN INTEGER; 


```

## 2.3 规格约束

|函数|参数名|参数类型|数据类型|是否必填|参数说明|参数限制|
|---|---|---|---|---|---|---|
|createtemporary|lob_loc|IN OUT|BLOB/CLOB|是|LOB定位符|- 数据类型支持BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR
- OUT lob_loc 长度为0
|
|/|cache|IN|BOOLEAN|否|指定是否将LOB读入缓冲区缓存|- 保留字段，仅语法兼容  （no_cache）默认是 FALSE
- BOOLEAN类型或可隐式转换为BOOLEAN类型的参数。
- 不可为NULL
,  
|
|  
|dur|IN|INTEGER|否|指定临时 LOB 在会话结束或调用结束时是否进行清理，如果省略，参数默认值是DBMS_LOB.SESSION|- 保留字段，仅语法兼容  （与目前实现的临时lob生命周期一致）默认是 10
- INTEGER类型或可隐式转换为INTEGER类型的参数
- 不可为NULL
|
|freetemporary|lob_loc|IN OUT|BLOB/CLOB|是|LOB定位符|- 有效的temp lob定位符
- BLOB/CLOB/NCLOB类型
- 不可为NULL
|
|istemporary|lob_loc|IN|BLOB/CLOB|是|LOB定位符|- BLOB/CLOB/CHAR/VARCHAR/RAW/NCLOB/NCHAR/NVARCHAR类型
- lob_loc是临时的且存在，返回值为1；不是临时或者不存在，返回值为0；给定的lob_loc为NULL，则返回NULL
- 输入常量NULL，结果返回NULL--与oracle有差异
|


**v$temporary_lobs视图**

|字段|含义|
|---|---|
|SID|会话ID|
|CACHE_LOBS|保留字段，值为0|
|NOCACHE_LOBS|通过调用dbms_lob.createtemporary显式创建的临时lob数量|
|ABSTRACT_LOBS|隐式创建的，存储在vm上的临时lob数量(暂不统计，值为0)|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

3.1.1 DBMS_LOB.CREATETEMPORARY

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|1，2个，3个（符合要求的参数）|执行成功|0，4个|报错，提示正确|
|/|参数类型|- lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW
- cache:  BOOLEAN类型或可隐式转换为BOOLEAN类型的参数
- dur:  INTEGER类型或可隐式转换为INTEGER类型的参数
|  
|- lob_loc：数值/时间/bit/boolean/自定义
- open_mode：不可转换为BOOLEAN的类型
- dur:不可转换成int的类型
|报错，提示正确|
|  
|参数值|lob_loc：（temp lob & knl lob）,- 未初始化的 lob定位符
- 初始化的lob定位符
- 无效的lob定位符（调用了freetemporary)
,cache:,常量：,- 字符型：  'true'、't'、 'yes'、 'y'、 'on'、 '1'  、 'false'、'f'、 'no'、 'n'、 'off'、 '0'
- 标识符：true、false
- 数值型：非0整数，0，非0小数
,变量：,- tinyint、smallint、int、bigint、number、bit列
- char、varchar、nchar、nvarchar列：数字型字符串
,dur:,数值范围在[-2^31,2^31-1] 区间,常量覆盖：,- [-2147483648,2147483647] 区间整数/小数（字符、数字）
,变量覆盖：,- tinyint、smallint、int、bigint、float、double、number、bit、Boolean列
- char、varchar、nchar、nvarchar列：数字型字符串
- 小数
- 整数
|  
|lob_loc：,- 常量
- null
- 变量不存在
,cache:,- 中文、英文字符串
- 日期数据
- json
- xmltype
- null
- float,double类型数字
,dur:,- 小于-2^31
- 大于2^31-1；
- 中文、英文字符串
- 日期数据
- json
- xmltype
- null
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|  
|/|/|  
|创建同名视图，同名表|  
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
|报错，createtemporary无返回值|
|/ |函数/高级包嵌套|其他作为createtemporary入参|  
|createtemporary作为其他入参|  
|
|v$temporary_lobs视图校验|SID|- desc 校验字段名称，类型
- 会话次数：1次，多次
|  
|  
|  
|
|/|NOCACHE_LOBS|- plsql内校验
- plsql外校验
|与执行次数结合测试|  
|  
|
|执行次数|调用函数createtemporary|- 同一lob对象创建多次(v$temporary_lobs.  NOCACHE_LOB统计createtemporary执行次数  )
- 不同lob对象
|  
|  
|  
|


  


3.1.2 DBMS_LOB.FREETEMPORARY

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|1个（符合要求的参数）|执行成功|0，2个|报错，提示正确|
|/|参数类型|lob_loc：BLOB/CLOB/NCLOB|  
|lob_loc：字符/数值/时间/bit/boolean/自定义/|报错，提示正确|
|  
|参数值|lob_loc：  有效的temp lob定位符,  
,  
|  
|lob_loc：,- 未初始化或为null的lob定位符；
- 无效的lob定位符（调用了freetemporary）；
- knl lob定位符
- 常量；
- null
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|  
|  
|  
|  
|创建同名视图，同名表|  
|
|输出参数校验|lob_loc|通过dbms_output.put_line输出校验out参数|  
|  
|  
|
|执行次数|隐式创建temp lob|执行freetemporary一次|  
|同一个temp lob执行freetemporary超过一次|  
|
|  
|显式创建temp lob|执行freetemporary一次|  
|  
|  
|
|v$temporary_lobs视图校验|NOCACHE_LOBS|freetemporary执行成功一次|NOCACHE_LOBS字段值减1|  
|  
|
|使用场景|plsql|自定义函数、匿名块、package、procedure中调用|  
|- select 形式调用
- create view as select 高级包
- create table as select 高级包
- ddl/dml/dql
|报错，函数无返回值|
|/ |函数/高级包嵌套|其他函数作为freetemporary入参|  
|freetemporary函数作为其他入参|  
|


3.1.3 DBMS_LOB.ISTEMPORARY

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|
|参数校验|参数个数|1个（符合要求的参数）|执行成功|0，2个|报错，提示正确|
|/|参数类型|lob_loc：BLOB/CLOB/NCLOB/CHAR/VARCHAR/NCHAR/NVARCHAR/RAW|  
|lob_loc：数值/时间/bit/boolean/自定义|报错，提示正确|
|/|参数值|lob_loc：temp lob & knl lob,- 初始化的lob定位符
- 未初始化的lob定位符(未赋值，赋值为null)
- 无效的lob定位符（调用了freetemporary)
|- 如果给定的lob_loc参数值为NULL，则返回NULL。
- 如果 lob 是valid temp lob，则返回1。
- 如果 lob 是invalid temp lob，则返回0。
- 如果给定的lob_loc不是temp lob，则返回0。
- 常量null,返回null
|lob_loc：,- lob常量
|  
|
|关键字校验|/|高级包名称大小写|  
|高级包名称拼写错误|  
|
|返回值校验|/|typeof查询返回值类型正确|  
|  
|  
|
|/|/|查看结果|  
|  
|  
|
|函数/高级包嵌套|/|其他作为istemporary入参|  
|  
|  
|
|/|/|istemporary作为其他入参|  
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
||plsql|自定义函数、匿名块、package、procedure中调用|


## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方*


3.2.1 函数调用流程

参考    [DBMS_LOB打开关闭函数测试设计](135609575.html)  

|系统级DFX分类|是否涉及|
|---|---|
|CT|是|
|KT|是|
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

## Comments:

|  [](null)  ,1.列存lob先禁掉,2.knl lob更新后会更改lob id---待提单，ccb,  
,Posted by lisiyu at 十二月 07, 2023 18:15|
|---|
