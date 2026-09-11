Created by 吴煜, last modified on 七月 18, 2024

##   [1. 总述](#1-总述)  

DBMS_CRYPTO系统包支持MD5和DES算法

###   [1.1 需求来源](#11-需求来源)  

国信证券融选适配

###   [1.2 调研文档](#12-调研文档)  

  [https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#dbms-crypto-%E7%AE%97%E6%B3%95](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#dbms-crypto-%E7%AE%97%E6%B3%95)  

###   [1.3 需求分析](#13-需求分析)  

适配oracle中dbms_obfuscation_toolkit的DES/3DES加解密算法

```
DBMS_OBFUSCATION_TOOLKIT.DESENCRYPT 
(
        input               IN          RAW,
        key                 IN          RAW,
        encrypted_data      OUT         RAW
);

```

```
DBMS_OBFUSCATION_TOOLKIT.DES3ENCRYPT 
(
        input               IN          RAW,
        key                 IN          RAW,
        encrypted_data      OUT         RAW,
        which               IN          PLS_INTEGER    DEFAULT 0,
        iv                  IN          RAW            DEFAULT NULL
);

```

其中which默认为0表示 3DES_2KEY二次模式，1表示3DES三次加密模式。

iv 默认为NULL  但是在通用接口中等价于    `0123456789abcdef`  

```
DBMS_CRYPTO.ENCRYPT/DECRYPT(
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW,
   iv  IN RAW          DEFAULT NULL)
 RETURN RAW;
 
 typ增加DBMS_CRYPTO.ENCRYPT_DES,DBMS_CRYPTO.ENCRYPT_3DES

```

MD5算法

```
DBMS_CRYPTO.Hash (
   src IN RAW,
   typ IN PLS_INTEGER)
 RETURN RAW;
 
 typ增加 DBMS_CRYPTO.HASH_MD5

```

###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|ENCRYPT_DES|数据加密标准。分块密码。使用的密钥长度为 56 位。|是||
|ENCRYPT_3DES|数据加密标准。区块密码。对一个数据块进行 3 次操作。|是||
|ENCRYPT_3DES_2KEY|数据加密标准。区块密码。对一个数据块进行 2 次操作。|是||
|HASH_MD5|接受一个任意长度的消息作为输入，并产生一个128位（16字节）的哈希值作为输出|是||
|IV|初始化向量（Initialization Vector，简称IV）在加密过程中用于提供随机数种子，以确保即使明文相同，加密结果也会因为不同的初始化向量而不同，从而提高了加密数据的安全性。其主要作用是引入一个随机化因素，使得相同的明文块生成不同的密文块，防止攻击者通过密文模式来分析和推断出明文模式。|是||
|CHAIN_CBC|Cipher Block Chaining密码分组连接模式。明文在加密前与前一个密码文块进行 XOR|是||
|PAD_NONE|指定不填充。调用者必须确保块大小正确，否则程序包将返回错误信息。|是||
|PAD_PKCS7|填充符合 PKCS #7（基于密码的加密标准）|是||


##   [**2. 接口**](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法||----|否|
|函数||----|否|
|动态视图||----|否|
|告警||----|否|
|日志||----|否|
|系统视图||----|否|
|配置参数||----|否|
|错误码||----|否|
|驱动接口||----|否|
|高级包|DBMS_CRYPTO.HASH_MD5、DBMS_CRYPTO.ENCRYPT_DES、DBMS_CRYPTO.ENCRYPT_3DES、DBMS_CRYPTO.ENCRYPT_3DES_2KEY|增加三种加密算法|是|


##   [3. 规格与约束](#3-规格与约束)  

DES（Data Encryption Standard）算法的密钥长度固定为8字节（64位）。在这64位中，有56位是实际用于加密的密钥，而剩余的8位用作奇偶校验。DES密钥小于8字节会报错，大于8字节会截断，跟dbms_obfuscation_toolkit对齐（但跟oracle同名高级包DBMS_CRYPTO不一致，小于8字节会补齐）

本需求中规格DES加密只支持DES_CBC_PAD_NONE、DES3_CBC_PAD_NONE。 代码中已实现DES_CBC_PKCS7、DES3_CBC_PKCS7。

若dbms_obfuscation_toolkit中iv为null 即默认，需在DBMS_CRYPTO高级包中指定iv为'0123456789abcdef'

其他规格同DBMS_CRYPTO高级包。

##   [**4. 特性**](#4-特性)  

####   [哈希算法中增加HASH_MD5](#哈希算法中增加hash-md5)  

1.DbmsCrypto增加PROPERTY的枚举

```
BIP_ITEM_DECLS(DbmsCrypto) = {
    BIP_ITEM_PROPERTY_DECL(DbmsCrypto, "HASH_MD5", BIP_ITEM_PROPERTY, HashMd5, 3),
};

```

2.在高级包的bipExecHash函数中增加switch(typVal）

```
switch (typVal) {
        case BIP_DBMS_CRYPTO_HASH_MD5:
            COD_RESOURCE_CALL(aniMd5Str((CodChar*)src.vBytes.data, src.vBytes.size, (CodChar*)encryStr, &amp;retValue-&gt;vBytes.size), anlPop(stmt));
            break;
}

```

3.实现aniMd5Str函数

####   [加密算法中增加DES、3DES](#加密算法中增加des3des)  

1. DbmsCrypto增加PROPERTY的枚举
1. encrAlgo中增加ENCRYPT_ALGO_DES_CBC、ENCRYPT_ALGO_DES_CBC_PKCS7枚举
1. 加密算法的增加函数数组
1. encrVerify 检查算法中的key size
1. encrPrepare
1. ​	根据传入的加密算法encrAlgo初始化encrm
1. ​		getEncryptEvpCipher 找到对应算法的抽象函数  （动态链接到openssl）
1. ​		aniEvpEncryptInitEx 初始化加密操作
1. ​		aniEvpCipherCtxSetPadding 设置填充模式
1. encrAddPadding
1. ​    对原文进行填充，扩充至8字节的整数倍
1. aniEvpEncryptUpdate
1. encrFinal
1. ​	aniEvpEncryptFinalEx 结束加密


##   [**5. Testcases（自测用例）**](#5-testcases自测用例)  

|场景|结果|预期|
|---|---|---|
|自定义一个16进制的raw用HASH_MD5加密，输出Hash value|输出value|结果与oracle保持一致|
|自定义一个16进制的raw和一个8字节密钥用DES/DES3加解密，输出密文|输出value|结果与oracle保持一致|
|自定义一个16进制的raw和一个非8字节密钥用DES/DES3加解密，输出密文|报错|报key length not match|
|typ不指定分组加密模式|报错|报异常invalid cipher type passed|
|加密type为NULL|报错|报no cipher type specified|
|iv指定NULL|输出value|结果与oracle保持一致|


##   [**6.资料设计章节**](#6资料设计章节)  

DBMS_CRYPTO中增加MD5/DES的说明

##   [**7. 工作量**](#7-工作量)  

##   [**8.未来规划**](#8未来规划)  

## Comments:

|  [](null)  ,7.9 会议纪要,参与人：吴煜，孙志祥，侯忠林，马文英，袁芳达,内容：,1.与dbms_obfuscation_toolkit高级包交叉加解密，确定功能填充模式,2.对齐功能出入参,  
,Posted by wuyu at 七月 09, 2024 15:31|
|---|
