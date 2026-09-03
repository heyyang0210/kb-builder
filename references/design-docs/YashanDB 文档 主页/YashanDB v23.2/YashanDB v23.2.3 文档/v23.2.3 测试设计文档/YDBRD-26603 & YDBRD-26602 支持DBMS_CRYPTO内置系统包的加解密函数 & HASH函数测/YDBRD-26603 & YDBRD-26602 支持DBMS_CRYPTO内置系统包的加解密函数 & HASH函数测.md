Created by 赵育, last modified on 六月 07, 2024

# 1. 概述

支持DBMS_CRYPTO内置系统包，可以加密和解密存储的数据，可以与运行网络通信的 PL/SQL 程序结合使用，并支持加密和哈希算法

开发设计文档：    [DBMS_CRYPTO高级包函数设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153006390)  

# 2. 需求分析

## 2.1 功能点分析

本 SR 支持 DBMS_CRYPTO 内置系统包的加解密函数及 HASH 函数

- 加密函数：  输入加密的源数据RAW，返回RAW解密的数据。


接口说明：根据用户提供的 key 及 iv，使用 stream 或 block cipher 对 RAW 数据进行加密，返回加密后的 RAW 数据。

```
DBMS_CRYPTO.ENCRYPT(
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW,
   iv  IN RAW DEFAULT NULL)
 RETURN RAW;
```

参数说明：

|Parameter Name|Description|
|---|---|
|  `src`  |待加密的数据|
|  `typ`  |Stream or block cipher type and modifiers to be used.|
|  `key`  |加密密钥|
|  `iv`  |Optional initialization vector for block ciphers. Default is       `NULL`    .|


DBMS_CRYPTO Encryption Algorithms

|Name|Description|
|---|---|
|  `ENCRYPT_DES`  |Data Encryption Standard. Block cipher. Uses key length of 56 bits.|
|  `ENCRYPT_3DES_2KEY`  |Data Encryption Standard. Block cipher. Operates on a block 3 times with 2 keys. Effective key length of 112 bits.|
|  `ENCRYPT_3DES`  |Data Encryption Standard. Block cipher. Operates on a block 3 times.|
|  `ENCRYPT_AES128`  |Advanced Encryption Standard. Block cipher. Uses 128-bit key size.|
|  `ENCRYPT_AES192`  |Advanced Encryption Standard. Block cipher. Uses 192-bit key size.|
|  `ENCRYPT_AES256`  |Advanced Encryption Standard. Block cipher. Uses 256-bit key size.|
|  `ENCRYPT_RC4`  |Stream cipher. Uses a secret, randomly generated key unique to each session.|


DBMS_CRYPTO Block Cipher Chaining Modifiers

|Name|Description|
|---|---|
|  `CHAIN_ECB`  |Electronic Codebook. Encrypts each plaintext block independently.|
|  `CHAIN_CBC`  |Cipher Block Chaining. Plaintext is XORed with the previous ciphertext block before it is encrypted.|
|  `CHAIN_CFB`  |Cipher-Feedback. Enables encrypting units of data smaller than the block size.|
|  `CHAIN_OFB`  |Output-Feedback. Enables running a block cipher as a synchronous stream cipher. Similar to CFB, except that     n     bits of the previous output block are moved into the right-most positions of the data queue waiting to be encrypted.|


DBMS_CRYPTO Block Cipher Padding Modifiers

|Name|Description|
|---|---|
|  `PAD_PKCS5`  |Provides padding which complies with the PKCS #5: Password-Based Cryptography Standard|
|  `PAD_NONE`  |Provides option to specify no padding. Caller must ensure that blocksize is correct, else the package returns an error.|
|  `PAD_ZERO`  |Provides padding consisting of zeroes|


DBMS_CRYPTO Block Cipher Suites

|Name|Description|
|---|---|
|  `DES_CBC_PKCS5`  |ENCRYPT_DES    [Foot 2](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#GUID-CE3CF17D-E781-47CB-AEE7-19A9B2BCD3EC__BJFEGJJE)       + CHAIN_CBC    [Foot 3](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#GUID-CE3CF17D-E781-47CB-AEE7-19A9B2BCD3EC__BJFJAADE)    + PAD_PKCS5    [Foot 4](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#GUID-CE3CF17D-E781-47CB-AEE7-19A9B2BCD3EC__BJFBICJJ)  |
|  `DES3_CBC_PKCS5`  |  `ENCRYPT_3DES`      [Foot 2](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#fnsrc_d218528e2032)       +       `CHAIN_CBC`      [Foot 3](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#fnsrc_d218528e2037)       + PAD_PKCS5    [Foot 4](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#fnsrc_d218528e2040)  |


typ 参数是   DBMS_CRYPTO Encryption Algorithms + DBMS_CRYPTO Block Cipher Chaining Modifiers + DBMS_CRYPTO Block Cipher Padding Modifiers 的组合，可以使用已定义的  DBMS_CRYPTO Block Cipher Suites，也可以按照如下格式  自定义

```
DES_CBC_NONE CONSTANT PLS_INTEGER := DBMS_CRYPTO.ENCRYPT_DES
                                     + DBMS_CRYPTO.CHAIN_CBC
                                     + DBMS_CRYPTO.PAD_NONE;
```

其他入参均为 RAW 格式，如果使用 VARCHAR2 类型，需先将 VARCHAR2   类型转成 RAW 格式；

- 解密函数：  输入需要加密的源数据RAW，返回RAW加密的数据。


接口说明：根据用户提供的 key 及 iv，使用 stream 或 block cipher 对 RAW 数据进行解密，返回解密后的 RAW 数据。

```
DBMS_CRYPTO.DECRYPT(
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW,
   iv  IN RAW DEFAULT NULL)
 RETURN RAW;
```

参数说明：要解密出数据，要使用与加密函数完全相同的 typ、key、iv；如果在加密之前将 VARCHAR2 转换成 RAW，你必须使用高级包再将其转换会原来的数据库字符集。

|Parameter Name|Description|
|---|---|
|  `src`  |待解密的 RAW 数据|
|  `typ`  |Stream or block cipher type and modifiers to be used.|
|  `key`  |解密密钥|
|  `iv`  |Optional initialization vector for block ciphers. Default is       `NULL`    .|


- HASH 函数：  输入hash的源数据RAW、BLOB、CLOB，返回RAW哈希过后的数据，它是个单向函数。


接口说明

```
DBMS_CRYPTO.Hash (
   src IN RAW,
   typ IN PLS_INTEGER)
 RETURN RAW;

DBMS_CRYPTO.Hash (
   src IN BLOB,
   typ IN PLS_INTEGER)
 RETURN RAW;

DBMS_CRYPTO.Hash (
   src IN CLOB CHARACTER SET ANY_CS,
   typ IN PLS_INTEGER)
 RETURN RAW;
```

参数说明

|Parameter Name|Description|
|---|---|
|  `src`  |The source data to be hashed.|
|  `typ`  |The hash algorithm to be used.|


DBMS_CRYPTO Cryptographic Hash Functions

|Name|Description|
|---|---|
|  `HASH_MD4`  |Produces a 128-bit hash, or message digest of the input message|
|  `HASH_MD5`  |Also produces a 128-bit hash, but is more complex than MD4|
|  `HASH_SH1`  |Secure Hash Algorithm (SHA-1). Produces a 160-bit hash.|
|  `HASH_SH256`  |SHA-2, produces a 256-bit hash.|
|  `HASH_SH384`  |SHA-2, produces a 384-bit hash.|
|  `HASH_SH512`  |SHA-2, produces a 512-bit hash.|


## 2.2 应用场景

用于在数据库中执行加密、解密、hash 操作。它提供了各种加密、hash 算法和选项，可以帮助我们保护敏感的数据。

## 2.3 规格约束

- 默认是 SYS 用户安装此软件包，也可以根据需要向现有的用户和角色授权。


# 3. 详细测试设计

## 3.1 测试设计方法

采用等价类、边界值的测试设计方法，对高级包的功能进行验证，同时考虑高级包的入参及返回值。下面分别对本 SR 中的 3 个高级包函数进行测试设计：

## 3.2 详细测试设计

|类型|函数名|测试场景|预期结果|备注|
|---|---|---|---|---|
|功能测试|DBMS_CRYPTO.ENCRYPT,DBMS_CRYPTO.DECRYPT|1、入参：src、key、iv 为 RAW 类型，typ 指定为：ENCRYPT_AES128 + CHAIN_CBC + PAD_NONE，调用高级包 ENCRYPT 函数对数据进行加密；  key 的长度必须是 128 位(补充参数校验验证),2、再调用高级包 DECRYPT 函数对数据进行解密；|对加密后的数据进行解密，与 src 入参内容一致(与 oracle 进行比对)|  
|
|  
|  
|1、入参：src、key、iv 为 RAW 类型，typ 指定为：ENCRYPT_AES128 + CHAIN_CBC + PAD_PKCS7，调用高级包 ENCRYPT 函数对数据进行加密；  key 长度任意,2、再调用高级包 DECRYPT 函数对数据进行解密；|对加密后的数据进行解密，与 src 入参内容一致(与 oracle 进行比对),PAD_PKCS7---与开源算法一致|  
|
|  
|DBMS_CRYPTO.Hash|入参 src 为 RAW 类型，typ 指定为 HASH_SH256，调用高级包 HASH 函数|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|  
|  
|入参 src 为 BLOB 类型，typ 指定为 HASH_SH256，调用高级包 HASH 函数   ---不实现|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|  
|  
|入参 src 为 CLOB 类型，typ 指定为 HASH_SH256，调用高级包 HASH 函数   ---不实现|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|参数校验|DBMS_CRYPTO.ENCRYPT,DBMS_CRYPTO.DECRYPT|入参校验：src、key、iv 为非 RAW 字符串类型，  非 RAW 类型的支持隐式转换；  比如: 非 16 进制数据、中文、null、‘’，调用高级包 ENCRYPT 函数,  
|执行加密/解密函数报错，错误信息正确|  
|
|  
|  
|入参 typ 指定为目前暂不支持取值：比如：ENCRYPT_AES256、CHAIN_CFB、PAD_PKCS5、其他值、null 、‘’，调用高级包 ENCRYPT 函数,组合必须都存在，否则报错,常量对标 oracle；|执行加密/解密函数报错，错误信息正确|  
|
|  
|  
|入参 RAW 类型长度及特殊值验证，覆盖：1、8000、8001|1、1~8000 范围内的数据，加密、解密函数执行成功，数据正确,2、8001 的数据，加密、解密函数执行失败，错误信息正确|  
|
|  
|  
|类型为 RAW 类型的入参为函数，比如 cast('aa' as raw(5))|对加密后的数据进行解密，与 src 入参内容一致|  
|
|  
|  
|使用参数名 => 参数值的方式，改变参数顺序调用高级包函数|对加密后的数据进行解密，与 src 入参内容一致|  
|
|  
|  
|使用  typeof() 函数验证函数返回值|类型为 RAW|  
|
|  
|  
|调用的高级包名、函数名大小写验证|不区分大小写，执行成功|  
|
|  
|  
|绑定参数的方式执行高级包函数|对加密后的数据进行解密，与 src 入参内容一致|  
|
|  
|DBMS_CRYPTO.Hash|入参校验 src 类型验证：不是 RAW 类型、BLOB 类型、CLOB 类型|执行报错，错误信息正确|  
|
|  
|  
|入参校验 typ 验证：    `HASH_MD4、其他值、null、'' 等`  |执行报错，错误信息正确|  
|
|  
|  
|入参 RAW 类型长度验证，覆盖：1、8000、8001|1、1~8000 范围内的数据，hash 函数执行成功，数据正确,2、8001 的数据，hash 函数执行成功，错误信息正确|  
|
|  
|  
|入参 BLOB 类型长度验证，覆盖：  1、4G*DB_BLOCK_SIZE、4G*DB_BLOCK_SIZE+1    ---不支持，不验证|1、  1~4G*DB_BLOCK_SIZE   范围内的数据，hash 函数执行成功，数据正确,2、  4G*DB_BLOCK_SIZE+1   的数据，hash 函数执行成功，错误信息正确|  
|
|  
|  
|入参 CLOB 类型长度验证，覆盖：  1、4G*DB_BLOCK_SIZE、4G*DB_BLOCK_SIZE+1   ---不支持，不验证|1、  1~4G*DB_BLOCK_SIZE   范围内的数据，hash 函数执行成功，数据正确,2、  4G*DB_BLOCK_SIZE+1   的数据，hash 函数执行成功，错误信息正确|  
|
|  
|  
|src 入参为函数，比如使用 cast 函数转成 RAW|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|  
|  
|使用参数名 => 参数值的方式，改变参数顺序调用高级包函数|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|  
|  
|使用  typeof() 函数验证函数返回值|类型为 RAW|  
|
|  
|  
|调用的高级包名、函数名大小写验证|不区分大小写，执行成功|  
|
|  
|  
|绑定参数的方式执行高级包函数|执行成功，生成的 HASH 值正确(与 oracle 进行比对)|  
|
|部署模式|  
|1、单机上执行高级包的加密、解密函数、HASH 函数|1、高级包执行成功|  
|
|  
|  
|1、集群上执行高级包的加密、解密函数、HASH 函数|1、高级包执行成功|  
|
|权限验证|  
|sys 用户执行高级包的加密、解密函数、HASH 函数|1、高级包执行成功|  
|
|  
|  
|非 sys 用户执行高级包|1、执行失败，不存在，待定|  
|


|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

[YDBRD-26603 & YDBRD-26602 支持DBMS_CRYPTO内置系统包的加解密函数 & HASH函数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDk4OTcwYzJhZjRmNTIwZmVjIiwicmVmX2lkIjoiNjczOTZkMDk1OTNmOTljOWZmMjM3NmMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NDgwLCJleHAiOjE3ODIzOTE4ODB9.Quj2L4nr5xoNBeYVz8q0lDpJ9dFO1xV8-goqVEiijQM)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDk4OTcwYzJhZjRmNTIwZmVkIiwicmVmX2lkIjoiNjczOTZkMDk1OTNmOTljOWZmMjM3NmMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NDgwLCJleHAiOjE3ODIzOTE4ODB9.cpCL56doCgr7y34XisCjp037IxzX2Pdat0w23CTAjo8)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDk4OTcwYzJhZjRmNTIwZmVkIiwicmVmX2lkIjoiNjczOTZkMDk1OTNmOTljOWZmMjM3NmMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NDgwLCJleHAiOjE3ODIzOTE4ODB9.cpCL56doCgr7y34XisCjp037IxzX2Pdat0w23CTAjo8)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDk4OTcwYzJhZjRmNTIwZmVlIiwicmVmX2lkIjoiNjczOTZkMDk1OTNmOTljOWZmMjM3NmMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NDgwLCJleHAiOjE3ODIzOTE4ODB9.2q508zAEypAWCZzFHAL5sETikT2aAAMN2i-7lyYuthU)

 (application/msword)    


[YDBRD-26603 & YDBRD-26602 支持DBMS_CRYPTO内置系统包的加解密函数 & HASH函数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMDk4OTcwYzJhZjRmNTIwZmVjIiwicmVmX2lkIjoiNjczOTZkMDk1OTNmOTljOWZmMjM3NmMzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NDgwLCJleHAiOjE3ODIzOTE4ODB9.Quj2L4nr5xoNBeYVz8q0lDpJ9dFO1xV8-goqVEiijQM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,与会人：侯忠林、冯皓博、贺国峰、史鑫、赵育,评审会议纪要：    
  1、加密函数：ENCRYPT，PAD_NONE 的填充模式，key 长度必须是 128 位，增加参数校验用例覆盖    
  2、Hash 函数，clob 和 blob 入参，本 sr 不实现，删除相关测试点    
  3、typ 必须是组合值，不支持单值，补充测试用例    
  4、高级包执行权限暂定 sys 用户，其他用户无权限执行，对标 oracle，测试时关注,Posted by zhaoyu at 六月 11, 2024 18:03|
|---|
