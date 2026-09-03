Created by 刘晓旋, last modified on 十月 09, 2024

# 1. 概述

IR:  * *    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b072](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b072)    *?  #YASHAN-290 【mysql兼容】支持特定函数*

支持 HEX 等字符串函数的使用，与 MySQL 5.7 对齐

# 2. 需求分析

## 2.1 功能点分析

- HEX(str)、HEX(N)


           对输入  的字符串或数字，函数返回字符串的十六进制形式或返回数值的十六进制。

- OCT(N)


           对输入的字符串或数字，函数返回字符串转成数值后的八进制形式，或直接返回数值的八进制形式。

- STRCMP(str1, str2)


           将输入的两个字符串进行比较，当字符相同时函数返回值为0；当第1个字符串 < 第2个字符串时函数返回值-1，否则返回1。

- FORMAT(X, D [, locale])


           将输入的数值 X 四舍五入到 D 位小数，返回的类型为字符串类型。当 D = 0 时，则结果没有小数位部分。第3个参数 locale 为可选参数，  支持指定结果数值的小数点、千位分隔符以及分隔符之间分组的区域设置。当未指定 [locale] 时，默认为 "en_US"。

## 2.2 应用场景

mysql> select HEX(1);

mysql> select OCT(1e4);

mysql> select STRCMP('text', 'TEXT');

mysql> select FORMAT(123.456, 4);

## 2.3 规格约束

与 MySQL 的差异：

- MYSQL 中 STRCMP 的结果会受字符序影响，YASHAN 目前 STRCMP 的比较结果遵循 yashan 设置的字符序，默认字符序 utf8mb4_general_ci（不区分大小写）。
- MYSQL 中 FORMAT 的结果会受第三个参数 locale 的影响，YASHAN 目前 FORMAT 第三个参数的功能暂时未实现，编译阶段拦截。
- MYSQL中 OCT,HEX 溢出（[-2  63  ,2  64  -1] 外）后会输出一个不变的数据或无法理解的数据，YASHAN 目前 OCT,HEX 溢出后会直接报错；OCT、HEX 的参数 str 长度如果 >32K，溢出直接报错。


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：函数参数–边界值；等价类*

*场景法覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用 xmind 的方式*
    1. *HEX 函数*  *测试*
    1. *OCT 函数*  *测试*
    1. *STRCMP 函数*  *测试*
    1. *FORMAT 函数*  *测试*
    1. *HEX函数嵌套测试*
    1. *视图*  *测试（v$function）*
    1.   

    1. **a. HEX 函数测试场景**
    1. **b. OCT 函数测试场景**
    1. **c. STRCMP 函数测试场景**
    1. **d. FORMAT 函数测试场景**
    1. **e. HEX 函数嵌套测试**
    1. 将 hex/oct/strcmp/format 这几个新增函数进行嵌套测试。
    1. **f. 视图测试场景**
    1. 检查 v$function、jdbc 获取函数接口是否新增以上函数。
    1. **MySQL 的一些行为记录**


|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|函数名称测试    
    
    
    
    
    
    
    
    
    
    
|- 函数名称
- 与表、视图=同名
|- 名称大小写
- 与表、视图同名
- 作为别名：表别名、列别名、子查询别名等
- 带反引号
,  
|- 名称拼写有误
- 函数名称带单、双引号
|  
|
|函数参数    
    
    
    
    
    
    
    
    
,  
|参数个数|1|0、2|  
|
||参数类型|- 数值类型（TINYINT/SMALLINT/INT/BIGINT/FLOAT/DOUBLE/NUMBER）
- BIT
- 字符串：CHAR/VARCHAR/NCHAR/NVARCHAR
- BOOLEAN
- 日期类型（date/timestamp/time/interval ds/interval ym）
- ROWID/UROWID
- 大对象类型：CLOB/NCLOB、BLOB、RAW
- JSON
- XMLTYPE
|- ST_GEOMETRY
- BOX2D
- UDT
|  
|
||参数边界值|- 当参数为数值类型时，  [-2  63  ,2  64  -1]
- 当参数为非数值类型时，字符长度<=32k
|- 当参数为数值类型时，<   -2  63    或 >   2  64  -1
- 当参数为非数值类型时，字符长度>32k
|  
|
||参数数值形式|- 普通数值，如 123.345
- 科学计数法，如 1.23345e2
|  
|  
|
||参数字符串形式|- 普通数值，如 "123.345"
- 科学计数法，如 "1.23345e2"
- 非数值格式：英文字符、特殊字符、中文、转义符
|  
|  
|
||参数为伪列|ROWNUM、ROWID、USER、ROWSCN、SEQUENCE.val|  
|  
|
||参数为空|''、null|  
|  
|
||参数为空串|'   '|  
|  
|
||参数为字面量|数值、字符串、时间、二进制、布尔|  
|  
|
||参数为列|覆盖所有类型的列，见上面 "参数类型"|  
|  
|
||参数为函数/表达式|- 参数为函数，覆盖：数值函数、字符函数、日期函数、聚合函数、窗口函数、转换函数、typeof函数
- 参数为表达式，覆盖：算数运算、比较运算、连接运算||、位运算（  &、|、^  ）
|- 逻辑运算（and/or/not）
|  
|
||参数为子查询|- 参数为子查询：select hex((select 1 from dual)) from dual;
|  
|  
|
|函数所在位置|  
|- 位于投影
- 位于filter
- 位于order by
- 位于group by (having)
- 位于connect by
- 位于join on
- 位于case ... when ... then
- 位于default值
- 位于函数索引
- 位于子查询（子查询的投影、子查询的filter）
- 位于create table as select后
- 位于create view as select后
- 位于insert into select后
|  
|  
|
|函数嵌套层数|  
|127 层|> 127层|  
|
|绑定参数|  
|select hex(?) from dual;|  
|  
|


|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|函数名称测试    
    
    
    
    
    
    
    
    
    
    
|- 函数名称
- 与表、视图=同名
|- 名称大小写
- 与表、视图同名
- 作为别名：表别名、列别名、子查询别名等
- 带反引号
,  
|- 名称拼写有误
- 函数名称带单、双引号
|  
|
|函数参数    
    
    
    
    
    
    
    
    
,  
|参数个数|1|0、2|  
|
||参数类型|- 数值类型（TINYINT/SMALLINT/INT/BIGINT/FLOAT/DOUBLE/NUMBER）
- BIT
- 全数值格式的字符串、非数值类型的字符串、数值开头含其他字符的字符串、开头为非数值类型的字符串：CHAR/VARCHAR/NCHAR/NVARCHAR
- BOOLEAN
- 日期类型（date/timestamp/time/interval ds/interval ym）
- ROWID/UROWID
- 大对象类型：CLOB/NCLOB、BLOB、RAW
- JSON
- XMLTYPE
|- ST_GEOMETRY
- BOX2D
- UDT
|  
|
||参数边界值|- 当参数为数值类型时，  [-2  63  ,2  64  -1]
|- 当参数为数值类型时，<   -2  63  ，或 >   2  64  -1
|  
|
||参数数值形式|- 普通数值，如 123.345
- 科学计数法，如 1.23345e2
|  
|  
|
||参数字符串形式|- 普通数值，如 "123.345"
- 科学计数法，如 "1.23345e2"
- 非数值格式：英文字符、特殊字符、中文、转义符
|  
|  
|
||参数为伪列|ROWNUM、ROWID、USER、ROWSCN、SEQUENCE.val|  
|  
|
||参数为空|''、null|  
|  
|
||参数为空串|'   '|  
|  
|
||参数为字面量|数值、字符串、时间、二进制、布尔|  
|  
|
||参数为列|覆盖所有类型的列，见上面 "参数类型"|  
|  
|
||参数为函数/表达式|- 参数为函数，覆盖：数值函数、字符函数、日期函数、聚合函数、窗口函数、转换函数、typeof函数
- 参数为表达式，覆盖：算数运算、比较运算、连接运算||、位运算（  &、|、^  ）
|- 逻辑运算（and/or/not）
|  
|
||参数为子查询|- 参数为子查询：select oct((select 1 from dual)) from dual;
|  
|  
|
|函数所在位置|  
|- 位于投影
- 位于filter
- 位于order by
- 位于group by (having)
- 位于connect by
- 位于join on
- 位于case ... when ... then
- 位于default值
- 位于函数索引
- 位于子查询（子查询的投影、子查询的filter）
- 位于create table as select后
- 位于create view as select后
- 位于insert into select后
|  
|  
|
|函数嵌套层数|  
|127 层|> 127层|  
|
|绑定参数|  
|select oct(?) from dual;|  
|  
|


|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|函数名称测试    
    
    
    
    
    
    
    
    
    
    
|- 函数名称
- 与表、视图=同名
|- 名称大小写
- 与表、视图同名
- 作为别名：表别名、列别名、子查询别名等
- 带反引号
,  
|- 名称拼写有误
- 函数名称带单、双引号
|  
|
|函数参数    
    
    
    
    
    
    
    
    
,  
|参数个数|2|0、1、3|  
|
||参数类型|- 数值类型（TINYINT/SMALLINT/INT/BIGINT/FLOAT/DOUBLE/NUMBER）
- BIT
- 全数值格式的字符串、非数值类型的字符串、数值开头含其他字符的字符串、开头为非数值类型的字符串：CHAR/VARCHAR/NCHAR/NVARCHAR
- BOOLEAN
- 日期类型（date/timestamp/time/interval ds/interval ym）
- ROWID/UROWID
- 大对象类型：CLOB/NCLOB、BLOB、RAW
- JSON
- XMLTYPE
|- ST_GEOMETRY
- BOX2D
- UDT
|  
|
||参数比较类型|- 2个参数类型完全相同
- 2个参数类型不同，但可隐式转换
- 2个参数类型不同，不可隐式转换
|  
|  
|
||参数比较值|- 2个参数字符内容完全相同
- 字符内容相同大小写不同
- 字符内容相同长度不同（有空格）
- 2个参数都为NULL、2个参数都为''
- 其中1个参数为NULL或''
- 第1个参数 > 第2个参数
- 第1个参数 < 第2个参数
|  
|  
|
||参数长度|- 字符串长度<=32k、>32k
|  
|  
|
||参数字符串形式|- 数值（科学计数法、普通数值）、英文字符、特殊字符、中文、转义符
|  
|  
|
||参数为伪列|ROWNUM、ROWID、USER、ROWSCN、SEQUENCE.val|  
|  
|
||参数为空|''、null|  
|  
|
||参数为空串|'   '|  
|  
|
||参数为字面量|数值、字符串、时间、二进制、布尔|  
|  
|
||参数为列|覆盖所有类型的列，见上面 "参数类型"|  
|  
|
||参数为函数/表达式|- 参数为函数，覆盖：数值函数、字符函数、日期函数、聚合函数、窗口函数、转换函数、typeof函数
- 参数为表达式，覆盖：算数运算、比较运算、连接运算||、位运算（  &、|、^  ）
|- 逻辑运算（and/or/not）
|  
|
||参数为子查询|- 参数为子查询报错：select strcmp((select 1 from dual), null) from dual;
|  
|  
|
|函数所在位置|  
|- 位于投影
- 位于filter
- 位于order by
- 位于group by (having)
- 位于connect by
- 位于join on
- 位于case ... when ... then
- 位于default值
- 位于函数索引
- 位于子查询（子查询的投影、子查询的filter）
- 位于create table as select后
- 位于create view as select后
- 位于insert into select后
|  
|  
|
|函数嵌套层数|  
|127 层|> 127层|  
|
|绑定参数|  
|select strcmp(?,?) from dual;|  
|  
|


|测试场景|测试项|等价类|非等价类|备注|
|---|---|---|---|---|
|函数名称测试    
    
    
    
    
    
    
    
    
    
    
|- 函数名称
- 与表、视图=同名
|- 名称大小写
- 与表、视图同名
- 作为别名：表别名、列别名、子查询别名等
- 带反引号
,  
|- 名称拼写有误
- 函数名称带单、双引号
|  
|
|函数参数    
    
    
    
    
    
    
    
    
,  
|参数个数|2|1、3|  
|
||参数类型|- 数值类型（TINYINT/SMALLINT/INT/BIGINT/FLOAT/DOUBLE/NUMBER（p,s））
- BIT
- 全数值格式的字符串、非数值类型的字符串、数值开头含其他字符的字符串、开头为非数值类型的字符串：CHAR/VARCHAR/NCHAR/NVARCHAR
- BOOLEAN
- 日期类型（date/timestamp/time/interval ds/interval ym）
- ROWID/UROWID
- 大对象类型：CLOB/NCLOB、BLOB、RAW
- JSON
- XMLTYPE
|- ST_GEOMETRY
- BOX2D
- UDT
|  
|
||参数边界值|- 在 number 范围内
|- 超出 number 范围
|  
|
||参数数值形式|- 普通数值，如 123.345
- 科学计数法，如 1.23345e2
- Inf、Nan（double 的无穷写法）
- 参数 D （小数位覆盖 <0、=0、>0）
|  
|  
|
||参数字符串形式|- 普通数值，如 "123.345"
- 科学计数法，如 "1.23345e2"
- 非数值格式：英文字符、特殊字符、中文、转义符
|  
|  
|
||参数为伪列|ROWNUM、ROWID、USER、ROWSCN、SEQUENCE.val|  
|  
|
||参数为空|''、null|  
|  
|
||参数为空串|'   '|  
|  
|
||参数为字面量|数值、字符串、时间、二进制、布尔|  
|  
|
||参数为列|覆盖所有类型的列，见上面 "参数类型"|  
|  
|
||参数为函数/表达式|- 参数为函数，覆盖：数值函数、字符函数、日期函数、聚合函数、窗口函数、转换函数、typeof函数
- 参数为表达式，覆盖：算数运算、比较运算、连接运算||、位运算（  &、|、^  ）
|- 逻辑运算（and/or/not）
|  
|
||参数为子查询|- 参数为子查询报错：select format((select 1 from dual), null) from dual;
|  
|  
|
|函数所在位置|  
|- 位于投影
- 位于filter
- 位于order by
- 位于group by (having)
- 位于connect by
- 位于join on
- 位于case ... when ... then
- 位于default值
- 位于函数索引
- 位于子查询（子查询的投影、子查询的filter）
- 位于create table as select后
- 位于create view as select后
- 位于insert into select后
|  
|  
|
|函数嵌套层数|  
|127 层|> 127层|  
|
|绑定参数|  
|select format(?,?) from dual;|  
|  
|


|场景|备注|
|---|---|
|HEX 函数|- 科学计数法表示的数值和字符串结果不同
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6a8970c2af4f5218a6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc)|
|OCT 函数|- 支持非数值字符串，在第1个非数值的字母进行截断，如 oct('12A') 截断后为 oct('12')
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6aa1ad9a3311dc9719/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- 支持时间类型，返回的结果跟 oct(year) 一致（只截取年份）
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6aa1ad9a3311dc971a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- bit 类型传入字面量时返回0，传入列时返回正常值（不理解？）
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6aa1ad9a3311dc971b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc)|
|STRCMP 比较的参数类型不同时，MySQL 有些类型支持有些类型又不支持，行为有点奇怪|- 支持 number 和时间类型的比较
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6a8970c2af4f5218a7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- 不支持 bit 类型、字符类型和时间类型的比较
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6aa1ad9a3311dc971c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- MySQL 空串和 NULL 不等价，strcmp('', '') 返回0
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6a8970c2af4f5218a8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- blob 的 'a' 和 'A' 不相等，但是 char/varchar 的 'a' 和 'A' 相等？
,注：MySQL 的 blob 分为 tinyblob、blob、mediumblob、longblob，这几个类型之间的区别是：在存储文件的最大大小上不同。tinyblob 最大 255 字节、blob  最大 65K，mediumblob 最大 16M，longblob 最大 4G,![](https://pingcode.yasdb.com/atlas/files/public/67396e6a8970c2af4f5218a9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc)|
|FORMAT 函数|- format 函数2个参数都传入 ''，报 warning
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6a8970c2af4f5218aa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- 参数是字面量且是非数值时，结果截断，报 warning
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6aa1ad9a3311dc971d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- 参数是 char/varchar 列时，列值包含非数值部分时，部分情况报 warning，部分情况不报 warning（不理解？）
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6aa1ad9a3311dc971e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- 参数是 date 类型，直接转成数值形式，不报错
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6a8970c2af4f5218ab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),- 参数是 blob 类型且不是数值格式，MySQL 返回0，且不报 warning；但如果参数是 char/varchar 类型时，返回0 但报了 warning
,![](https://pingcode.yasdb.com/atlas/files/public/67396e6a8970c2af4f5218ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc),![](https://pingcode.yasdb.com/atlas/files/public/67396e6aa1ad9a3311dc971f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFCQUFBQUVDQUFBRUFnQWdBQVFRQUFBQUFBQUFBS0FJQWdBQUFBQUFBQUFFQUVBQUFCQXdBQUFBQkNBQUVBQUFBUUJBQ0FBQXdSQUFBQUFBQUVnQVJBQUFBQVFnSUFDQVFBQUFBUUFBQUJoSUFBQUNBQ0FDQUFBREFBQUFCQUNBQUFnQUFCQUFBQWtJQUFFQUEwQVFBQUFJQUlBSUFBQUFBQUJFR3dBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE4OTAsImV4cCI6MTc4MjM4MjY5MH0.tTVVTeAg2JqsJnZLNVdAahT4O2jWXmOTqIBoOMTIGmc)|
|||
|||
|||
|||
|||
||
||
||
||
||
||
||
||
||
||




*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*    


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|是|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

[HEX函数冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjk4OTcwYzJhZjRmNTIxODlkIiwicmVmX2lkIjoiNjczOTZlNjk1OTNmOTljOWZmMjM4NDRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODkwLCJleHAiOjE3ODI0NTgyOTB9.8QepnE-wuzvSD6me9ZRsTAPomT6SFQ9EYCnHJCqgVaE)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：

## Attachments:

[image2024-5-8_11-17-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmE4OTcwYzJhZjRmNTIxOGEzIiwicmVmX2lkIjoiNjczOTZlNjk1OTNmOTljOWZmMjM4NDRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODkwLCJleHAiOjE3ODI0NTgyOTB9.SUZv4fLJteEyIf_3zOMMDcRwWplsZAbEV0kJYbu5-T8)

 (image/png)    


[image2024-5-8_11-18-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmE4OTcwYzJhZjRmNTIxOGE0IiwicmVmX2lkIjoiNjczOTZlNjk1OTNmOTljOWZmMjM4NDRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODkwLCJleHAiOjE3ODI0NTgyOTB9.GS740RmjYSlxg1sTCOzPYmKWqCi_cFJwo0L7hUSSsWQ)

 (image/png)    


[image2024-5-8_11-32-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNmFhMWFkOWEzMzExZGM5NzE4IiwicmVmX2lkIjoiNjczOTZlNjk1OTNmOTljOWZmMjM4NDRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODkwLCJleHAiOjE3ODI0NTgyOTB9.O1TD_qsnvy-nYS0CUVTxcjXQGYoyX66wnAReurAc_9k)

 (image/png)    


[HEX函数冒烟文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNjk4OTcwYzJhZjRmNTIxODlkIiwicmVmX2lkIjoiNjczOTZlNjk1OTNmOTljOWZmMjM4NDRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxODkwLCJleHAiOjE3ODI0NTgyOTB9.8QepnE-wuzvSD6me9ZRsTAPomT6SFQ9EYCnHJCqgVaE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,会议纪要：,与会人：邓秋怡、林永豪、张鹏飞、周彬鑫、胡晓畔、刘晓旋    
  会议时间：2024-5-08 16：00 ~ 17：00    
  腾讯会议：796 171 225    
  纪要信息：,1、strcmp 的参数传入 blob，且大小写不同（默认是不区分大小写）。如 b1 和 b2 都是 blob 类型，b1 和 b2 的值分别是 'a'、'A'，strcmp(b1, b2) 在 MySQL 中返回的结果是 1 非 0，我们是否需要跟 MySQL 对齐？ —— 待开发确认,评审通过与否：通过,Posted by liuxiaoxuan at 五月 08, 2024 17:45|
|---|
