Created by 赵育, last modified on 十一月 06, 2024



-   [1. 需求概述](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-1.需求概述)  
-   [2. 友商的实现情况](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-2.友商的实现情况)  
-   [3. 示例](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-3.示例)  
-   [4. 参考文档](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-4.参考文档)  
-   [5. 后续关注 ](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-5.后续关注)  




# 1. 需求概述

  [https://pingcode.yasdb.com/pjm/items/670e3b98e489dd0868f7e50e?](https://pingcode.yasdb.com/pjm/items/670e3b98e489dd0868f7e50e?)  

#YDBRD-34246 【mysql兼容】兼容与MYSQL 字符串拼接函数

需求场景：兼容 mysql 的同名字符串拼接函数。



# 2. 友商的实现情况

|序号|名称|函数格式|描述|引入版本|yashandb 是否兼容|
|---|:---|---|:---|:---|---|
|1|CONCAT(str1, str2, .....)||返回连接参数后得到的字符串。可能有一个或多个参数。,如果所有参数都是非二进制字符串，则结果为非二进制字符串。,如果参数包含任何二进制字符串，则结果为二进制字符串。数字参数将转换为其等效的非二进制字符串形式。,如果参数包含 null，则结果返回 null,在 mysql client 端执行 concat()函数，   `--binary-as-hex`  参数值决定二进制字符是否使用 16 进制显示||是|
|2|CONCAT_WS(separator, str1, str2,.....)||第一个参数是分隔符，分隔符可以是字符串，其余参数也可以是字符串。如果分隔符是  `NULL`  ，则结果为   `NULL`  。,函数不会跳过空字符串，但是会跳过分隔符后的 null 值。,||yashandb 的函数名为：BITAND |


功能说明：

1、如果函数返回值长度超过    `max_allowed_packet`   ，则返回 null；





# 3. 示例

```
concat 函数:
mysql> SELECT CONCAT('My', 'S', 'QL');
        -> 'MySQL'
mysql> SELECT CONCAT('My', NULL, 'QL');
        -> NULL
mysql> SELECT CONCAT(14.3);
        -> '14.3'
mysql> SELECT 'My' 'S' 'QL';
        -> 'MySQL'

concat_ws 函数：
mysql> SELECT CONCAT_WS(',', 'First name', 'Second name', 'Last Name');
        -> 'First name,Second name,Last Name'
mysql> SELECT CONCAT_WS(',', 'First name', NULL, 'Last Name');
        -> 'First name,Last Name'
```



# 4. 参考文档

  [https://dev.mysql.com/doc/refman/5.7/en/string-functions.html#function_concat](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html#function_concat)  

  


# 5. 后续关注 





