Created by 赵育, last modified on 十一月 06, 2024



-   [1. 需求概述](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-1.需求概述)  
-   [2. 友商的实现情况](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-2.友商的实现情况)  
-   [3. 示例](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-3.示例)  
-   [4. 参考文档](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-4.参考文档)  
-   [5. 后续关注 ](#YDBRD34278【mysql兼容】支持VALIDATE_PASSWORD_STRENGTH函数测试调研-5.后续关注)  




# 1. 需求概述

  [https://pingcode.yasdb.com/pjm/items/670e0efae489dd0868f7ac62?](https://pingcode.yasdb.com/pjm/items/670e0efae489dd0868f7ac62?)  

#YDBRD-34198 【mysql兼容】兼容与MYSQL DECODE等同名函数规格

需求场景：兼容 mysql 的同名加密和压缩函数。



# 2. 友商的实现情况

mysql 5.7 支持的加密和压缩函数。

|名称|函数格式|描述|已弃用|yashandb 是否兼容|
|:---|---|:---|:---|---|
|  `AES_DECRYPT()`  ||使用 AES 解密||是？比   `DECODE()`   函数功能更丰富，未调研用法|
|  `AES_ENCRYPT()`  ||使用 AES 加密||是？比   `ENCODE()`   函数功能更丰富，未调研用法|
|  `COMPRESS()`  ||以二进制字符串形式返回结果|||
|  `DECODE()`  |DECODE(crypt_str,pass_str),crypt_str：已加密字符串,pass_str：解密密码,返回值：解密后的字符串|使用 ENCODE() 解码加密的字符串，标记为 deprecated ,使用    `AES_ENCRYPT()`   及   `AES_DECRYPT()`  代替|是的|是|
|  `DES_DECRYPT()`  ||解密字符串|是的||
|  `DES_ENCRYPT()`  ||加密字符串|是的||
|  `ENCODE()`  |ENCODE(str,pass_str),crypt_str：待加密字符串,pass_str：加密密码,返回值：长度与 str 相同的二进制字符串|编码字符串，标记为 deprecated ，使用    `AES_ENCRYPT()`   及   `AES_DECRYPT()`  代替,使用 mysql client 端使用该函数，设置    `--binary-as-hex`   ，以二进制显示。|是的|是|
|  `ENCRYPT()`  ||加密字符串|是的||
|  `MD5()`  |MD5(str),返回值：32个十六进制数字的字符串形式，入参是 null，则返回 null|计算字符串的128位  MD5 校验和||是|
|  `PASSWORD()`  ||计算并返回密码字符串|是的||
|  `RANDOM_BYTES()`  ||返回随机字节向量|||
|  `SHA1()`    `SHA()`  ||计算 SHA-1 160 位校验和|||
|  `SHA2()`  ||计算 SHA-2 校验和|||
|  `UNCOMPRESS()`  ||解压压缩的字符串|||
|  `UNCOMPRESSED_LENGTH()`  ||返回压缩前的字符串长度|||
|  `VALIDATE_PASSWORD_STRENGTH()`  ||确定密码强度|||


1、加密和压缩函数返回的字符串类型可能包含不同的字节值，使用 varbinary 或者 blob 来存储字符串数据类型。这可以避免尾部空格或者字符集转换导致的数据改变的一些潜在问题。

2、一些加密函数返回 ASCII 字符的字符串，比如 md5()、password()、sha()、sha1()，返回值是字符串，字符集由   `character_set_connection `   及   `collation_connection`   系统变量决定。除非指定为 binary 字符集，否则返回值是非二进制的

3、md5()、sha1() 的返回十六进制数字的字符串，可以使用   `UNHEX()`   来转成 binary，每对十六进制数字需要1字节的 binary，因此 md5() 返回 16 字节的 16 进制字符长度。

4、hash 函数可能会存在hash 冲突，一种解决的方案是设置为主键来检测。  






# 3. 示例

  [https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html](https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html)    


# 4. 参考文档

  [https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html](https://dev.mysql.com/doc/refman/5.7/en/encryption-functions.html)  

  


# 5. 后续关注 



||
|---|


