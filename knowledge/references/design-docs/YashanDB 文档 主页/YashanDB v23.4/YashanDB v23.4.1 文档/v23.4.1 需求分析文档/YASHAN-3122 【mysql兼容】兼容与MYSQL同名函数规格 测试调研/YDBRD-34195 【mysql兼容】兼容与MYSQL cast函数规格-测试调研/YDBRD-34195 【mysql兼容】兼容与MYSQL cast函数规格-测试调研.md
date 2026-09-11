Created by 赵育, last modified on 十一月 06, 2024



-   [1. 需求概述](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-1.需求概述)  
-   [2. 友商的实现情况](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-2.友商的实现情况)  
-   [3. 示例](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-3.示例)  
-   [4. 参考文档](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-4.参考文档)  
-   [5. 后续关注 ](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-5.后续关注)  




# 1. 需求概述

  [https://pingcode.yasdb.com/pjm/items/670e0a28e489dd0868f7a7e3?](https://pingcode.yasdb.com/pjm/items/670e0a28e489dd0868f7a7e3?)  

#YDBRD-34195 【mysql兼容】兼容与MYSQL cast函数规格

需求场景：当前在MYSQL模式下，存在与MYSQL同名，但是行为不一样的函数，需要兼容MYSQL。



# 2. 友商的实现情况

|名称|函数格式|描述|
|---|---|---|
|  `CAST()`  |CAST(expr AS type) 与 CONVERT(expr,type) 等效|将值转换为特定类型|


type 允许的类型：

1、BINARY[(N)]，返回值为 VARBINARY 类型，expr 长度为 0 时，返回值为 BINARY(0);如果给定可选长度 N，则转换为长度不超过 N 字节的 BINARY(N)，不足 N 自己的填充 0x00，如果 N 未指定，则返回表达式的最大长度。如果计算出来的长度超过类型的最大长度，则会提升类型，比如从 BLOB 类型，提升到 LONGBLOB。

2、CHAR[(N)] [charset_info],返回值为 VARCHAR 类型，expr 长度为 0 时，返回值为 CHAR(0);如果给定可选长度 N，则转换为长度不超过 N 字节的 CHAR(N)，不足 N 则不填充，如果 N 未指定，则返回表达式的最大长度。如果计算出来的长度超过类型的最大长度，则会提升类型，比如从 BLOB 类型，提升到 LONGBLOB。

如果 charset_info 未指定，返回 默认字符集的 CHAR 类型，如果指定 charset_info,允许指定如下值：

-   `CHARACTER SET `    `charset_name`  ：生成具有给定字符集的字符串。
-   `ASCII`  ： 的简写   `CHARACTER SET latin1`  。
-   `UNICODE`  ： 的简写   `CHARACTER SET ucs2`  。


在所有情况下，字符串都具有字符集默认排序规则。

3、DATE，返回 DATE 类型值

4、DATETIME[(M)]，返回 DATETIME 类型，如果指定了 M，则指定秒的小数部分精度。

5、DECIMAL[(M[,D])]，返回 decimal 值，如果给定了可选的 M 和 D 值，则它们指定最大位数和小数点后的位数，如果 D 省略，则假定为0，如果 M 省略，则假定为 10.

6、JSON,返回 JOSN 类型值，转换规则见详细说明。

7、NCHAR[(N)],与 CHAR 类似，但生成国家字符集的字符串，与 CHAR 不同的是，NCHAR 不允许指定尾随字符集信息。

8、SIGNER[INTERGER]，返回由符号的 BIGINT 值

9、TIME[(m)]，返回 TIME 类型值，如果给定了可选的 M 值，则指定秒的小数部分精度。

10、UNSIGNED[INTERGER]，返回无符号的 BIGINT 值。



# 3. 示例

  [https://dev.mysql.com/doc/refman/5.7/en/cast-functions.html](https://dev.mysql.com/doc/refman/5.7/en/cast-functions.html)    


# 4. 参考文档

  [https://dev.mysql.com/doc/refman/5.7/en/cast-functions.html](https://dev.mysql.com/doc/refman/5.7/en/cast-functions.html)  

  


# 5. 后续关注 



