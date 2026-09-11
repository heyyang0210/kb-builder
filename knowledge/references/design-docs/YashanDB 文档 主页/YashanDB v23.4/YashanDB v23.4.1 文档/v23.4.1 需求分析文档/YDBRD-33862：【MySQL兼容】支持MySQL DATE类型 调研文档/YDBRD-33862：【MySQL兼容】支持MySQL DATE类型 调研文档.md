*# 特性调研-YDBRD-33862: 【MySQL兼容】支持MySQL DATE类型 调研文档 特性调研*

*SR链接：*  [#YDBRD-33862 【MySQL兼容】支持MySQL DATE类型](https://pingcode.yasdb.com/pjm/items/6707aefae489dd0868f43993?)  



##   [1. 总述](#1-总述)  

The   `DATE`   type is used for values with a date part but no time part. MySQL retrieves and displays   `DATE`   values in   `YYYY-MM-DD`   format. The supported range is   `'1000-01-01'`   to   `'9999-12-31'`  .



##   [2. 接口](#2-接口)  

create table时指定date类型，或通过指定date关键字+字符串的形式指定date类型。



##   [3. 规格与约束](#3-规格与约束)  

###   [3.1 MySQL中date格式输入](#14-开源依赖)  

对于’2000-01-01 1' 这种包含时间部分的数据，MySQL可以insert成功但是报warning。

|形式|表现|分析|备注|
|---|---|---|---|
|‘2000-1-1’,‘2000:1:1’,'2000\\1\\1','2000/1/1','2000.1.1','2000;1;1','2000_1_1',2000[1[1','2000]1]1'|2000-01-01|字符串形式输入按照格式填充|MySQL permits a “  relaxed  ” format for values specified as strings, in which any punctuation character may be used as the delimiter between date parts or time parts. In some cases, this syntax can be deceiving. For example, a value such as   `'10:11:12'`   might look like a time value because of the   `:`  , but is interpreted as the year   `'2010-11-12'`   if used in date context. The value   `'10:45:15'`   is converted to   `'0000-00-00'`   because   `'45'`   is not a valid month.,  
  MySQL中任何标点符号都可以当作分隔符|
|'1-1-2','01-1-2','001-1-3'|0001-01-02,2001-01-02,0001-01-03|年份为1为或3位，填充0补齐至4位,年份为2位，填充20补齐至4位||
|20000101|2000-01-01|按照格式填充|不足或超过8位报错|


###   [3.2 MySQL中其他类型转换为date类型表现](#14-开源依赖)  

mysql支持的数据类型与date类型的转换关系（通过insert into select调研）：

|mysql,类型|bool|unsigned tinyint/smallint/int/bigint|int/smallint/tinyint/mediunint/bigint|decimal/numeric|float/double|bit|date/datetime/timestamp/time/year|char/varchar|binary/varbinary|blob/text|enum/set|json|
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|date|报错|1.数值最少为三位数，若月日为单数，则需补0，如14插入失败，104为1月4日，10101为2001年1月1日,2.将其转换为字符串后理解，按照422的顺序进行映射，从右到左匹配,3.补全均基于2000年,4.如果为浮点数，则直接报错（cast可以直接输入浮点转换成功）,5.设置了zero_date参数，使用100插入成功报warning,,转换规则：从右到左（即先日后月再年）,三位：21,四位：22,五位：221,六位：222,七位：error,八位：224,九位：warnings||||将bit值转为10进制后，按照数值型转换规则处理|date/timestamp提取日期部分输出,time输出当天日期,year应当是补全再按数值型处理，由于规格原因，不可转为date|1.直接转为日期，如果是纯数字，要求至少有五位。,2.如果有分隔符要求分割出三部分,3.疑似支持00,4.带有分隔符形式，如果年份为1或3位，基于0年  （那就可以出现1000年以下的年份了？）,,转换规格：（从左到右）先年后月再日,五位：221,六位：222,七位：222，忽略最后一位但报warnings,八位：422,九位：插入成功但忽略多余部分且报warnings，如果用cast函数无warnings|varbin同string,bin会带着补全的x00进行转换|blob转十进制同string,text同string|同char/varchar的处理方式|报错|


**对于数值和字符串都为10101的情况转换的结果不同进行分析：**

数值型：10101 -> 2001年1月1日，从右到左，224映射

字符串：10101 -> 2010年10月1日：

###   [3.3 MySQL中date类型转换为其他类型表现](#14-开源依赖)  

其中date值为最小值1000-01-01

|mysql类型|bool|unsigned tinyint/smallint/int|int/smallint/tinyint/mediunint|bigint/unsigned bigint|decimal/numeric/double|float|bit|date/datetime/timestamp/time/year|char/varchar|binary/varbinary|blob/text|enum/set|json|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|date|报错,（out of range，经测试bool类型与tinyint范围一直）|out of range,报错||10000101000000,补0策略是？,建表定义bigint(12)，也是补6个0|10000101,直接去掉分隔符|10000100,舍弃分隔符并将day部分设为0|乱码,比较插入double类型的10000101000000，结果一致,猜测转bigint再转bit,|对于需要时间的补00:00:00,year应当是转数值再转year，由于规格原因不可转|直接为1000-01-01,为什么char类型的长度和varchar一致？而不是建表定义长度？|显示结果同string '1000-01-01'|显示结果同string '1000-01-01'|建表时写为'1000-01-01'/'10000101'/'10000101000000'均报错|报错,ERROR 3140 (22032): Invalid JSON text: "The document root must not be followed by other values." at position 4 in value for column 'test_type_json.c1'.,|




###   [3.4 MySQL中date类型与其他类型进行运算表现](#14-开源依赖)  

|mysql类型|unsigned tinyint|unsigned smallint|unsigned int|unsigned bigint/bool|tinyint|smallint|int|bigint|decimal/numeric|float/double|bit|datetime/timestamp|time|date|year|char/varchar|binary/varbinary|blob/text|enum/set|json|
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|+|int(9) unsigned|int(9) unsigned|bigint(11) unsigned|bigint(21) unsigned|bigint|bigint|bigint|bigint|decimal(11,0)|double|bigint(65) unsigned|bigint|bigint|bigint|int(9) unsigned|double|double|double|double|double|
|-|int(9) unsigned |int(9) unsigned|bigint(11) unsigned|bigint(21) unsigned |bigint|bigint|bigint|bigint|decimal(11,0)|double|bigint(65) unsigned|bigint|bigint|bigint|int(9) unsigned|double|double|double|double|double|
|*|bigint(11) unsigned|bigint(13) unsigned |bigint(18) unsigned|bigint(28) unsigned|bigint|bigint|bigint|bigint|decimal(18,0)|double|bigint(65) unsigned|bigint|bigint|bigint|bigint(12) unsigned|double|double|double|double|double|
|date/|decimal(12,4)|decimal(12,4) |decimal(12,4)|decimal(12,4)|decimal(12,4)|decimal(12,4)|decimal(12,4)|decimal(12,4)|decimal(12,4)|double|decimal(12,4)|decimal(12,4)|decimal(12,4)|decimal(12,4)|decimal(12,4)|double|double|double|double|double|
|/date|decimal(7,4) |decimal(9,4) |decimal(14,4)|decimal(24,4)|decimal(7,4) |decimal(9,4) |decimal(14,4)|decimal(24,4)|decimal(14,4)|double|decimal(65,4)|decimal(18,4)|decimal(11,4)|decimal(12,4)|decimal(8,4) |double|double|double|double|double|
|date%|bigint(10)|bigint(10)|bigint(10)|bigint(20)|bigint|bigint|bigint|bigint|decimal(10,0)|double|bigint|bigint|bigint|bigint|bigint|double|double|double|double|double|
|%date|bigint(10) unsigned |bigint(10) unsigned |bigint(10) unsigned |bigint(20) unsigned|bigint|bigint|bigint|bigint|decimal(10,0)|double|bigint(65) unsigned|bigint|bigint|bigint|bigint(10) unsigned|double|double|double|double|double|
|and|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|
|or|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|
|xor|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|bigint(21) unsigned|
|备注|||||||||开发时number定义ps，保证输出一致|位运算中感觉是通过四舍五入的方式处理过小数，然后再进行位运算的||位运算对于datetime转为10000101000000,位运算timestamp转为19700102000000|||||位运算结果和预期不符，查询报warnings，如果用单独用b'00000001'的形式，符合预期|位运算小数去除小数部分进行比较||查询每一列都报warning|


位运算：

1.小数四舍五入后进行位运算；

2.字符串&date，如果是char，报warning，如果是varchar，truncate小数部分。

3.text，truncate小数部分

compare：

||int8/int16/int32/int64|float/double|number|date|time|timestamp|char/varchar|clob/blob|bit|
|---|---|---|---|---|---|---|---|---|---|
|date|date转成int比较|date转浮点型|date转number|转成int|time的比较看不明白|date和timestamp都转为整数比较|将多余部分缺省，转成date比较,问题是如果是转成日期比较,'10000101.1'为什么比date'1000-01-01'大？|同char|转成int比较|
|备注|||||||数值型日期型都可以,不管了 ，转成日期型比较|||




###   [3.5 MySQL中时间函数对于date的处理](#14-开源依赖)  

|函数名|功能|备注|
|---|---|---|
|date|DATE函数用于提取  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  日期部分的值并返回。|按照yyyy-mm-dd返回|
|date_add|DATE_ADD函数用于执行日期运算，通过  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  的值加上给定的区间值得到时间推进或后退过的结果。|date和unit结合判定返回类型|
|DATE_FORMAT|DATE_FORMAT函数将给定的参数  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  按format定义的格式进行提取，返回VARCHAR类型的字符串。|理论上讲天然适配|
|DAYOFWEEK|DAYOFWEEK函数用于计算  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  位于所在周的第几天（以周日为第一天计算），返回一个INT类型的数值。|理论上讲天然适配|
|EXTRACT|EXTRACT函数对给定参数  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  进行年、月、日、小时、分、秒等数值的提取：|理论上讲天然适配|
|LAST_DAY|LAST_DAY函数返回  [expr](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/expr.html)  表示的日期所在月份的最后一天的日期值，返回类型为DATE。|理论上讲天然适配|
|NOW|NOW函数返回数据库所在的操作系统设置的当前日期时间值，返回值类型为TIMESTAMP，格式为'YYYYMMDD HH:MI:SS'。|与date类型无关|
|LOCALTIMESTAMP/LOCALTIME|LOCALTIMESTAMP/LOCALTIME函数为  [NOW](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/MySQL-Compatibility-Mode-Reference-Manual/Functions-Supported-by-MySQL-Compatibility-Mode/NOW.html)  函数的同义词。|与date类型无关|
|SYSDATE|SYSDATE函数返回数据库所在的操作系统设置的当前日期时间值，返回值类型为TIMESTAMP，格式为'YYYYMMDD HH:MI:SS'。|与date类型无关|
|UTC_TIMESTAMP|UTC_TIMESTAMP函数返回数据库所在的操作系统设置的当前协调世界时（UTC），返回值类型为TIMESTAMP，格式为'YYYYMMDD HH:MI:SS'。|与date类型无关|


**说明调研特性对外的功能规格或约束。给出各友商的差异点、优缺点描述。**

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

## Comments:

|,（1）名称上直接放入SR ID,（2）特性调研文档用于提供方案的参考，不等同于 关键特性的备选概念，后者需要落在概要设计或详细设计文档,（3）“功能限制” 改名成 “规格与约束”,（4）细化 概要设计、Story详细设计 的必选项,（5）概要设计需要有SR列表，Story设计需要有AR列表,（6）增加资料设计章节，资料在设计阶段，要识别出来相关需要调整的范围、大纲,（7）5.4 增加DFX设计章节，涉及安全、性能、可靠、可维、可测；按特性可选；模板给出参考和必选项,（8）关键特性需要有概要设计文档，对于成熟模块的特性建议概要设计和详细设计可合一,（9）概要设计文档模板独立出来,Posted by ouweijie at 十月 20, 2022 12:22|
|---|


