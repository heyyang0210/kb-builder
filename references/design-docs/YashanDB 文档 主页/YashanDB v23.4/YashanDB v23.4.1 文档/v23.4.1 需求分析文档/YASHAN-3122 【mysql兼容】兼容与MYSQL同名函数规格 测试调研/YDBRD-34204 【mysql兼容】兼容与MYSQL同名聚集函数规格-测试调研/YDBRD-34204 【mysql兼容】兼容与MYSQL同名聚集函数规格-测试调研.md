Created by 赵育, last modified on 十一月 06, 2024



-   [1. 需求概述](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-1.需求概述)  
-   [2. 友商的实现情况](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-2.友商的实现情况)  
-   [3. 示例](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-3.示例)  
-   [4. 参考文档](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-4.参考文档)  
-   [5. 后续关注 ](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-5.后续关注)  




# 1. 需求概述

  [https://pingcode.yasdb.com/pjm/items/670e1144e489dd0868f7aed4?](https://pingcode.yasdb.com/pjm/items/670e1144e489dd0868f7aed4?)  

#YDBRD-34204 【mysql兼容】兼容与MYSQL同名聚集函数规格

需求场景：兼容 mysql 的同名聚集函数。



# 2. 友商的实现情况

mysql 5.7 支持的聚集函数，通常与子句 group by 一起使用，将值分组为子集。

|序号|名称|函数格式|描述|引入版本|yashandb 是否兼容|
|---|:---|---|:---|:---|---|
|1|  `AVG()`  |AVG([DISTINCT] expr)|返回参数的平均值，可以使用 distinct 来返回不同值的平均值。如果没有匹配的行，则返回 null||是|
|2|  `BIT_AND()`  ||返回按位与，以 bigint 精度来执行，如果没有匹配的行，则返回中性值(所有位设置为1)||yashandb 的函数名为：BITAND |
|3|  `BIT_OR()`  ||返回按位或，以 bigint 精度来执行，如果没有匹配的行，则返回中性值(所有位设置为0)||yashandb 的函数名为：BITOR|
|4|  `BIT_XOR()`  ||返回按位异或，以 bigint 精度来执行，如果没有匹配的行，则返回中性值(所有位设置为0)||yashandb 的函数名为：BITXOR|
|5|  `COUNT()`  |COUNT(expr)|返回返回行数的计数，非 null 值得数量，如果没有匹配的行，则返回0.,count(*),返回包括null 值得行数，该语句仅计算事务可见得行数。,如果未强制执行，count(*) 使用聚簇索引来执行。,count(*) 和 count(1) 处理方式相同，性能上没有差异。||是|
|6|  `COUNT(DISTINCT)`  |COUNT(DISTINCT expr,[expr...])|返回不同值的数量，不包括 null 值。如果没有匹配的行，则返回0。||是|
|7|  `GROUP_CONCAT()`  |GROUP_CONCAT(expr)|返回连接字符串。返回非 null 的连接字符串，如果没有非 null 值的行，则返回 null。消除重复值，请使用 DISTINCT 子句，对结果集进行排序，请使用 ORDER BY 子句，使用降序排序，请使用 DESC,默认使用升序排序，也可以手动指定 ASC 进行升序排序，默认分隔符是逗号，也可以使用 SEPARATOR 指定分隔符，如果需要消除分隔符，使用 SEPARATOR ''.,结果将被截断为系统变量指定的最大长度：  `group_concat_max_len`   ，默认值为 1024，该值的最大有效长度受   `max_allowed_packet `  影响，更改   `group_concat_max_len`   语法如下：,SET [GLOBAL | SESSION] group_concat_max_len =   *val*  ;  --val 为无符号整型。,返回值为二进制或者非二进制字符串，取决于入参是二进制还是非二进制。,在   `group_concat_max_len`   <=512 时，返回值类型为 text 或者 blob，其他情况返回值为 varchar、varbinary。,在 mysql client 端使用   `GROUP_CONCAT()`   函数，  `--binary-as-hex`   参数会显示为二进制字符串结果。||是|
|8|  `JSON_ARRAYAGG()`  ||以单个 JSON 数组形式返回结果集|5.7.22||
|9|  `JSON_OBJECTAGG()`  ||将结果集作为单个 JSON 对象返回|5.7.22||
|10|  `MAX()`  |MAX([DISTINCT] expr)|返回最大值,入参可以是字符串类型，DISTINCT 关键字可以查找不同值的最大值，如果没有匹配的行，则返回 NULL。,max 函数，会按照字符串比较 enum 和 set 类型。||是|
|11|  `MIN()`  |MIN([DISTINCT] expr)|返回最小值,入参可以是字符串类型，DISTINCT 关键字可以查找不同值的最大值，如果没有匹配的行，则返回 NULL.,min 函数，会按照字符串比较 enum 和 set 类型。||是|
|12|  `STD()`  ||返回总体标准差，是   `STDDEV_POP()`   函数的同义词，作为 mysql 的扩展提供|||
|13|  `STDDEV()`  |STDDEV(expr)|返回总体标准差，是   `STDDEV_POP()`   函数的同义词，与 oracle 兼容,如果没有匹配的行，则返回 NULL||是|
|14|  `STDDEV_POP()`  |STDDEV_POP(expr)|返回总体标准差，与  `STD()`  及   `STDDEV()`   等效，但不是标准 SQL,如果没有匹配的行，则返回 NULL||是|
|15|  `STDDEV_SAMP()`  |STDDEV_SAMP(expr)|返回样本标准差,如果没有匹配的行，则返回 NULL||是|
|16|  `SUM()`  |SUM([DISTINCT] expr)|返回总数,如果没有匹配的行，则返回 NULL,可以使用 DISTINCT 仅对不同值求和||是|
|17|  `VAR_POP()`  |VAR_POP(expr)|返回总体标准方差,它将行视为整个总体，而不是样本，因此其分母为行数。您也可以使用   `VARIANCE()`  ，它等效但不是标准 SQL。,如果没有匹配的行，   `VAR_POP()`  则返回   `NULL`  ||是|
|18|  `VAR_SAMP()`  |VAR_SAMP(expr)|返回样本方差，分母是行数减一,如果没有匹配的行，   `VAR_SAMP()`  则返回   `NULL`  ||是|
|19|  `VARIANCE()`  |VARIANCE(expr)|返回总体标准方差,   `VARIANCE()`  是标准 SQL 函数的同义词   `VAR_POP()`  ，作为 MySQL 扩展提供,如果没有匹配的行，   `VARIANCE()`  则返回   `NULL`  ||是|


功能说明：

1、除非另外说明，聚集函数会忽略 null 值

2、使用聚集函数的同时不适用 group by 子句，相当于对所有行进行分组。

3、方差和标准差函数，返回 double 类型。avg 和 sum 函数返回 decimal 类型值。近似值 float 或者 double ，返回 double 类型

4、avg 和 sum 函数，不适应于时间类型，时间类型需要先转换为数字类型，执行聚合计算，再转回时间类型

SELECT SEC_TO_TIME(SUM(TIME_TO_SEC(  *time_col*  ))) FROM   *tbl_name*  ;  
SELECT FROM_DAYS(SUM(TO_DAYS(  *date_col*  ))) FROM   *tbl_name*  ;

5、avg 和 sum 函数，入参必须是数字类型，对于 set 和 enum 值，转换操作回使用底层数字值

6、bit_and、bit_or、bit_xor 函数执行按位运算，入参为 bigint，返回值为 bigint，其他类型回转换为 bigint，有可能会发生截断，mysql 8.0 中允许位运算采用二进制字符串类型参数。详细资料参考 8.0 对应的文档。



# 3. 示例

  [https://dev.mysql.com/doc/refman/5.7/en/aggregate-functions.html](https://dev.mysql.com/doc/refman/5.7/en/aggregate-functions.html)    


# 4. 参考文档

  [https://dev.mysql.com/doc/refman/5.7/en/aggregate-functions.html](https://dev.mysql.com/doc/refman/5.7/en/aggregate-functions.html)  

  


# 5. 后续关注 



||
|---|


