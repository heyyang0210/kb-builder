Created by 李潮, last modified on 五月 27, 2024

# 1.   **概述**

   本文主要内容为支持UTL_RAW内置系统包的RAW类型计算能力和转换能的测试设计。

# 2.   **需求分析**

SR:    [https://pingcode.yasdb.com/pjm/items/66276d59fd997db58adfdc1c](https://pingcode.yasdb.com/pjm/items/66276d59fd997db58adfdc1c)    ?    
  #YDBRD-26622 支持UTL_RAW内置系统包的RAW类型计算能力

  [https://pingcode.yasdb.com/pjm/items/66276d9cfd997db58adfdd27](https://pingcode.yasdb.com/pjm/items/66276d9cfd997db58adfdd27)    ?    
  #YDBRD-26623 支持UTL_RAW内置系统包的RAW类型转换能力

开发文档：    [支持UTL_RAW内置系统包的RAW类型 - 何阳 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150626647)  

  [支持UTL_RAW内置系统包的RAW类型（包含转换和计算） - 汪少华 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153002715)  

测试调研：    [YASHAN-823_支持UTL_RAW内置系统包-测试调研 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153008546&moved=true)  

一.新增UTL_RAW内置系统包的RAW计算函数9个，转换函数11个：

|序号|接口|说明|约束|
|---|---|---|---|
|1|B  IT_AND  ( r1 IN RAW, r2 IN RAW)|两个RAW按位逻辑“与“，返回RAW值|- NULL/空字符串: 如果r1，r2中有一个是null则返回null
- 如果r1和r2长度不同，按照较短的输入进行与，剩余的较长部分直接附在输出后边，返回长度与较长的RAW相同
|
|2|BIT_OR   ( r1 IN RAW, r2 IN RAW)|两个RAW按位逻辑“或“，返回RAW值|- NULL/空字符串: 如果r1，r2中有一个是null则返回null
- 如果r1和r2长度不同，按照较短的输入进行或，剩余的较长部分直接附在输出后边，返回长度与较长的RAW相同
|
|3|BIT_XOR   ( r1 IN RAW, r2 IN RAW)|两个RAW按位逻辑“异或”|- NULL/空字符串: 如果r1，r2中有一个是null则返回null
- 如果r1和r2长度不同，按照较短的输入进行异或，剩余的较长部分直接附在输出后边，返回长度与较长的RAW相同
|
|4|COMPARE  ( r1 IN RAW, r2 IN RAW, pad IN RAW DEFAULT NULL)|比较两个RAW值。如果它们的长度不同，则根据可选的pad参数在右侧扩展较短的那个。|- 如果都是NULL或者一致，返回0
- 如果不一致，返回第一个不一致的位置
|
|5|CONCAT  (r1 IN RAW, r2 IN RAW, r3 IN RAW,…)|将多个RAW连接成一个RAW值|- 当拼接的RAW超过允许的最大值32767字节时，返回错误
|
|6|COPIES  ( r IN RAW, n IN NUMBER)|这个函数返回n个连接在一起的RAW，n必须是正值|- 以下情况返回错误
    - 未输入r ,或者r是 NULL 或者r长度为0
    - n < 1
    - 结果长度大于32767字节(RAW允许的最大长度)
|
|7|LENGTH  ( r IN RAW)|以字节为单位返回RAW的长度|  
|
|8|SUBSTR  ( r IN RAW, pos IN BINARY_INTEGER, len IN BINARY_INTEGER DEFAULT NULL)|这个函数返回len字节，从RAW r开始|- r为NULL返回NULL
- 如果pos为正数, 从头开始截取
- 如果pos为负数，从尾部开始截取
- pos不能为0.
- 如果没有输入len，SUBSTR返回整个r.
- len不能小于1.
|
|9|BIT_COMPLEMENT  ( r IN RAW)|RAW按位逻辑“补码”，返回RAW值|- NULL/空字符串:输入null返回null
|
|10|CAST_TO_RAW  ( c IN VARCHAR2)|将使用一定数量的数据字节表示的VARCHAR2值转换为具有该数量的数据字节的RAW值。不以任何方式修改数据本身，但将其数据类型重新转换为RAW数据类型|- NULL/空字符串:输入null返回null
|
|11|CAST_TO_VARCHAR2  ( r IN RAW)|将使用一定数量的数据字节表示的RAW值转换为具有该数量的数据字节的VARCHAR2值。|- NULL/空字符:输入null返回null
|
|12|CAST_TO_BINARY_INTEGER  ( r IN RAW, endianess IN PLS_INTEGER DEFAULT BIG_ENDIAN)|将BINARY_INTEGER的RAW二进制表示形式转换为BINARY_INTEGER。|入参RAW类型，4个有效字节，如果入参超过4字节，报错，如果是大端序，在高位补0到4个字节，如果是小端序，在低位补0到4个字节|
|13|CAST_FROM_BINARY_INTEGER  ( n IN BINARY_INTEGER , endianess IN PLS_INTEGER DEFAULT BIG_ENDIAN)|返回BINARY_INTEGER值的RAW二进制表示形式。|- 入参为  binary integer，超过边界值时，还在number取值范围内，  取其边界值，即超过2147483647，取2147483647，超过-2147483648，取-2147483648，超过number取值范围，报错
|
|14|CAST_TO_BINARY_DOUBLE  ( r IN RAW endianess IN PLS_INTEGER DEFAULT 1)|将BINARY_DOUBLE的原始二进制表示形式强制转换为BINARY_DOUBLE|- 如果RAW大于8字节，返回是前8字节的转换，剩余的会被忽略
- 如果RAW小于8字节，返回错误信息
- ~~对于-0的结果，返回值为+0~~
- ~~如果返回值是NaN，BINARY_DOUBLE_NAN会返回~~
|
|15|CAST_FROM_BINARY_DOUBLE   (  n   IN BINARY_DOUBLE,   endianess   IN BINARY_INTEGER DEFAULT 1)|返回BINARY_DOUBLE值的RAW二进制表示形式。|- NULL/空字符:输入null返回null
- 入参为DOUBLE时，可以超过Double的上下限值，与oracle不一样的地方，不报错
|
|16|CAST_TO_BINARY_FLOAT   ( r IN RAW, endianess IN PLS_INTEGER DEFAULT 1)|将BINARY_FLOAT的RAW二进制表示形式转换为BINARY_FLOAT。    
|- 如果RAW大于4字节，  高位补齐0成完整的16进制格式RAW，  返回是前4字节的转换，剩余的会被忽略
- 如果RAW小于4字节，返回错误信息
- ~~对于-0的结果，返回值为+0~~
- ~~如果返回值是NaN，BINARY_DOUBLE_NAN会返回~~
|
|17|CAST_FROM_BINARY_FLOAT  ( n IN BINARY_FLOAT, endianess IN PLS_INTEGER DEFAULT 1)|返回BINARY_FLOAT值的RAW二进制表示形式。|- NULL/空字符:输入null返回null
- 入参为  FLOAT时，取值范围可以超过number取值范围，与oracle不一致的地方，不报错
|
|18|CAST_TO_NUMBER  ( r IN RAW)|将NUMBER的原始二进制表示形式转换为NUMBER。|  
|
|19|CAST_FROM_NUMBER   ( n IN NUMBER)|返回NUMBER值的RAW二进制表示形式。|- 入参为number类型时，范围为[1E-130, 1E126），当入参为number，输入为1E126时，会先提升到double，然后转换成number类型，cast_from_number,入参为1E126不会报错，与oracle不一致
|
|20|REVERSE  ( r IN RAW)|将RAW r中的字节序列从头到尾进行反转。|- 当r是NULL 或者长度为0时返回错误
|


  


二.应用场景

1.单语句作为函数使用

2.pl/sql使用（直接使用，绑定参数）

三.规格约束

- 查询的表为列表时，函数里表达式为列表的column时，报错，如果表达式是常量，可以执行
- yashan 视为null 和''为同类


三.需求范围

1.单机，集群

2.交付版本：23.2.3.100

# 3. 详细测试设计(254

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

## 一. 接口功能测试(216)

|BIT_AND   ( r1 IN RAW, r2 IN RAW)|||||
|---|---|---|---|---|
|输入条件1|输入条件2|有效等价类|无效等价类|备注|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r1，r2|1.null，空字符串，普通raw校验,2.普通raw校验，覆盖01，11，00，10四种情况,3.r1,r2长度不一致校验,4.r1,r2边界长度校验,5.入参为  字符型/BLOB类型,6.入参为  字符型/BLOB类型边界长度|1.  BLOB类型长度长度超过32000字节,2.  输入非raw类型且不可隐式转换|10|
|BIT_COMPLEMENT  ( r IN RAW)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r1|1.null，空字符串,,2.'0',3.普通raw校验,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型边界长度|1.  BLOB类型长度长度超过32000字节,2.  输入非raw类型且不可隐式转换|9|
|BIT_OR     ( r1 IN RAW, r2 IN RAW)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r1，r2|1.null，空字符串，普通raw校验,2.普通raw校验，覆盖01，11，00，10四种情况,3.r1,r2长度不一致校验,4.r1,r2边界长度校验,5.入参为  字符型/BLOB类型,6.入参为  字符型/BLOB类型边界长度|1.  BLOB类型长度长度超过32000字节,2.  输入非raw类型且不可隐式转换|10|
|BIT_XOR     ( r1 IN RAW, r2 IN RAW)||||  
|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r1，r2|1.null，空字符串，普通raw校验,2.普通raw校验，覆盖01，11，00，10四种情况,3.r1,r2长度不一致校验,4.r1,r2边界长度校验,5.入参为  字符型/BLOB类型,6.入参为  字符型/BLOB类型边界长度|1.  BLOB类型长度长度超过32000字节,2.  输入非raw类型且不可隐式转换|10|
|COMPARE  ( r1 IN RAW, r2 IN RAW, pad IN RAW DEFAULT NULL)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r1,r2|1.null，空字符串，普通raw校验,2.普通raw校验，覆盖相同与不同,3.r1,r2长度不一致校验,4.r1,r2边界长度校验,5.入参为  字符型/BLOB类型,6.入参为  字符型/BLOB类型边界长度|1.  BLOB类型长度长度超过32000字节,2.  输入非raw类型且不可隐式转换|10|
|  
|pad|1.长度一个字节,2.长度超过一个字节,3.null,空字符串|1.  输入非raw类型且不可隐式转换|  
|
|CONCAT  (r1 IN RAW, r2 IN RAW, r3 IN RAW,…)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r1,r2,r,3....|1.null，空字符串，普通raw组合校验，覆盖0，1，6，12个参数,2.普通raw校验，覆盖0，1，6，12个参数,3.边界值：  总大小为32K,5.入参为  字符型/BLOB类型,6.入参为  字符型/BLOB类型达到边界长度|1.  总大小超过32K,2.  BLOB类型长度长度超过32K字节,3.输入非raw类型且不可隐式转换|10|
|COPIES  ( r IN RAW, n IN NUMBER)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw校验,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度|1.  总大小超过32K,2.  BLOB类型长度长度超过32K字节,3.输入非raw类型且不可隐式转换|15|
|  
|n|1.边界值：NUMBER.MAX_VALUE,2.覆盖1，16，1024|1.0,2.-1,3.‘a'|  
|
|LENGTH  ( r IN RAW)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw校验,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度|1.  总大小超过32K,2.  BLOB类型长度长度超过32K字节,3.输入非raw类型且不可隐式转换|10|
|SUBSTR  ( r IN RAW, pos IN BINARY_INTEGER, len IN BINARY_INTEGER DEFAULT NULL)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw校验,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度,  
|1.  总大小超过32K,2.  BLOB类型长度长度超过32K字节,3.输入非raw类型且不可隐式转换|19|
|  
|pos|1.覆盖0，正数，负数,2.边界值:len,-len|1.abs(pos)超过len,2.输入非整数|  
|
|  
|len|1.覆盖1，合法值,2.覆盖边界值,  
|1.0，负数,2.非整数,3.len超过可最大的子串长度|  
|
|CAST_TO_RAW  ( c IN VARCHAR2)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|c|1.null，空字符串,2.普通字符串,3.边界值：  总大小为32K,4.覆盖  CHAR、VARCHAR、NCHAR，NVARCHAR类型,5.所有类型均可向varchar隐式转换,  
|1.  总大小超过32K,3.输入非字符类型且不可隐式转换|8|
|CAST_TO_VARCHAR2  ( r IN RAW)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度|1.  总大小超过32K,3.输入非字符类型且不可隐式转换|9|
|CAST_TO_BINARY_INTEGER  ( r IN RAW, endianess IN PLS_INTEGER DEFAULT BIG_ENDIAN)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw，覆盖4个字节以内和超过四个字节,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度,6.use_native_type=false|1.  总大小超过32K,3.输入非字符类型且不可隐式转换|13|
|  
|endianess |1.覆盖1,2,3,2.小数（包含负数）,3.覆盖r为空与非空情况|1.非法类型：例如字符串，bool类型|  
|
|CAST_FROM_BINARY_INTEGER  ( n IN BINARY_INTEGER , endianess IN PLS_INTEGER DEFAULT BIG_ENDIAN)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|n|1.null,2.覆盖integer内，integer边界，number内，number边界,3.  use_native_type=false|1.超过number边界,2.非法类型|10|
|  
|endianess |1.覆盖1,2,3,2.小数（包含负数）,3.覆盖r为空与非空情况,  
|1.非法类型：例如字符串，bool类型|  
|
|CAST_TO_BINARY_DOUBLE  ( r IN RAW endianess IN PLS_INTEGER DEFAULT 1)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw，覆盖8个字节以内和成过8个字节,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度|1.  总大小超过32K,2.输入非字符类型且不可隐式转换|13|
|  
|endianess |1.覆盖1,2,3，无参,2.小数（包含负数）,3.覆盖r为空与非空情况|1.非法类型：例如字符串，bool类型|  
|
|#### CAST_FROM_BINARY_DOUBLE   (  n     IN BINARY_DOUBLE,     endianess     IN BINARY_INTEGER DEFAULT 1)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null,2.覆盖double内，double边界，超过double边界|1.非法类型|9|
|  
|#### endianess   |1.覆盖1,2,3，无参,2.小数（包含负数）,3.覆盖r为空与非空情况|1.非法类型：例如字符串，bool类型|  
|
|CAST_TO_BINARY_FLOAT     ( r IN RAW, endianess IN PLS_INTEGER DEFAULT 1)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw，覆盖四个字节 ，超过四个字节,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度,6.use_native_type=false|1.小于四个字节,2.  总大小超过32K,3.输入非字符类型且不可隐式转换|14|
|  
|#### endianess   |1.覆盖1,2,3，无参,2.小数（包含负数）,3.覆盖r为空与非空情况|1.非法类型：例如字符串，bool类型|  
|
|CAST_FROM_BINARY_FLOAT  ( n IN BINARY_FLOAT, endianess IN PLS_INTEGER DEFAULT 1)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null,2.覆盖  number  内，  number  边界，超过  number  边界,3.  use_native_type=false|1.不合法类型|9|
|  
|#### endianess   |1.覆盖1,2,3，无参,2.小数（包含负数）,3.覆盖r为空与非空情况|1.非法类型：例如字符串，bool类型|  
|
|CAST_TO_NUMBER  ( r IN RAW)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null,空串,2.普通raw,3.边界值：  总大小为32K-(22字节，超过22字节截断）,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度,  
|1.不合法类型,2.转换失败时报错（负数）|8|
|CAST_FROM_NUMBER     ( n IN NUMBER)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null,2.普通number,3.边界：  1E-130, 1E126,4.入参为其他整数类型，例如：integer|1.不合法类型|7|
|REVERSE  ( r IN RAW)|||||
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|创建同名用户、表、视图|  
|
|入参校验(校验返回参数类型）|r|1.null，空字符串,2.普通raw,3.边界值：  总大小为32K,4.入参为  字符型/BLOB类型,5.入参为  字符型/BLOB类型达到边界长度|1.  总大小超过32K,2.输入非字符类型且不可隐式转换|9|


  


# 二.场景测试(38)

参考：    [YDBRD-18476 支持UTL_ENCODE内置系统包测试设计 - 徐瑶 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150603204)  

|  
|输入条件1|有效等价类|无效等价类|备注|  
|
|---|---|---|---|---|---|
|单语句中作为函数使用|入参|入参为常量，column|列存column|  
|  
|
|  
|函数功能|1.  自嵌套，混合嵌套,2.  与其他函数嵌套,3.  与其他高级包嵌套|  
|  
|  
|
|  
|dql|作为select投影列，单列，多列,select 语句中带有order by、where、limit、in/not in、exists/not exists、like/not like、between and、case when、destinct等,结合any/all/some/is null/is not null等子查询,结合group by分组(聚合函数和窗口函数),单表查询、多表关联查询、子查询的filter、投影|  
|  
|  
|
|  
|dml|update作为set值以及where条件,insert作为value值，insert values中带子查询，子查询调用该函数,insert into select,delete 作为where条件|  
|  
|  
|
|  
|ddl|create table/view as select +函数|  
|  
|  
|
|plsql中使用|匿名块|匿名块调用高级包和其他plsql（其他plsql中也调用高级包）,exception调用,for循环里面调用|  
|  
|  
|
|  
|自定义函数|case xx when（多个），部分when调用，部分不调用；构造数据匹配when条件,if 分支，else分支调用,while分支调用,return,exception调用|  
|  
|  
|
|  
|存储过程|insert into table values 调用高级包,update set赋值给指定列时指定,loop分支调用,exception分支调用|  
|  
|  
|
|  
|自定义高级包|head中调用，body中不调用,head中不调用，body中调用,head、body中同时调用,package中调用存储过程，存储过程调用自定义函数，自定义函数中调用高级包，同时package也调用高级包|  
|  
|  
|
|  
|job|DBMS_JOB.SUBMIT创建job，  执行的PL/SQL文本  指定调用含高级包的 plsql，触发job运行|  
|  
|  
|
|  
|调用次数|调用1次,连续调用多次|  
|  
|  
|
|绑定参数|plsql+jdbc|insert into table values值,select作为where条件, update set赋值给指定列时,delete作为where的限定条件,group by 、order by|  
|  
|  
|


  


# 5.   **测试用例**

**1.冒烟用例**

   电子表格

**2.文本用例**

   电子表格

  


# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


  


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[YDBRD-26623 && YDBRD-26622冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGNhMWFkOWEzMzExZGM4ZTZkIiwicmVmX2lkIjoiNjczOTZkMGM3MjgyMDZlZmI5MmYxYTdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQzLCJleHAiOjE3ODIzOTE5NDN9.TvpUgjqI-5pRnWIdccv6G-m9WzxLGoDY-jpWmXrd680)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-26623 && YDBRD-26622文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGM4OTcwYzJhZjRmNTIwZmZmIiwicmVmX2lkIjoiNjczOTZkMGM3MjgyMDZlZmI5MmYxYTdmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTQzLCJleHAiOjE3ODIzOTE5NDN9.HQjgojeLyP9KDY8CpPq-cLosoib1xvxRdFFalarOa_Y)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
