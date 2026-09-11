Created by 侯忠林, last modified on 八月 08, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

为了兼容  ORACLE，需要对标实现DBMS_CRYPTO高级包的相关功能。

参考文档：

  [DBMS_CRYPTO高级包函数调研文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386)  

  [Oracle Database 19c DBMS_CRYPTO文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#GUID-1C98C203-29EF-488D-A5FA-42AD4BD7718D)  

  [达梦 DBMS_CRYPTO文档](https://eco.dameng.com/document/dm/zh-cn/pm/dbms_crypto-package)  

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

需要实现  DBMS_CRYPTO高级包的一下几个函数：

（1）  **DECRYPT**  ：输入加密的源数据RAW，返回RAW解密的数据。

（2）  **ENCRYPT**  ：输入需要加密的源数据RAW，返回RAW加密的数据。

（3）  **Hash**  ：输入hash的源数据RAW、BLOB、CLOB，返回RAW哈希过后的数据。

###   [DBMS_CRYPTO 算法](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#dbms-crypto-%E7%AE%97%E6%B3%95)  

####   [哈希算法](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#%E5%93%88%E5%B8%8C%E7%AE%97%E6%B3%95)  

|名称|描述|是否实现|
|:---|:---|---|
|HASH_MD4|生成128位散列或输入信息的信息摘要|  
|
|HASH_MD5|同样产生128位散列，但比MD4更复杂|  
|
|HASH_SH1|安全散列算法（SHA-1）。产生160位散列值。|  
|
|HASH_SH256|SHA-2，产生256位的哈希值。|是|
|HASH_SH384|SHA-2，产生384位的哈希值。|  
|
|HASH_SH512|SHA-2，产生512位的哈希值。|  
|


####   [加密算法](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#%E5%8A%A0%E5%AF%86%E7%AE%97%E6%B3%95)  

|名称|描述|是否实现|
|:---|:---|---|
|ENCRYPT_DES|数据加密标准。分块密码。使用的密钥长度为 56 位。|  
|
|ENCRYPT_3DES_2KEY|数据加密标准。区块密码。使用 2 个密钥对一个数据块进行 3 次操作。有效密钥长度为 112 位。|  
|
|ENCRYPT_3DES|数据加密标准。区块密码。对一个数据块进行 3 次操作。|  
|
|ENCRYPT_AES128|高级加密标准。区块密码。使用 128 位密钥。|是|
|ENCRYPT_AES192|高级加密标准。区块密码。使用 192 位密钥。|  
|
|ENCRYPT_AES256|高级加密标准。区块密码。使用 256 位密钥。|  
|
|ENCRYPT_RC4|流密码。使用随机生成的密钥，每个会话都是独一无二的。|  
|


###   [DBMS_CRYPTO 分组加密模式](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#dbms-crypto-%E5%88%86%E7%BB%84%E5%8A%A0%E5%AF%86%E6%A8%A1%E5%BC%8F)  

|名称|描述|是否实现|
|:---|:---|---|
|CHAIN_ECB|Electronic Codebook电子密码本模式。对每个明文块进行独立加密。|  
|
|CHAIN_CBC|Cipher Block Chaining密码分组连接模式。明文在加密前与前一个密码文块进行 XOR。|是|
|CHAIN_CFB|Cipher-Feedback密码反馈模式。可对小于数据块大小的数据单位进行加密。|  
|
|CHAIN_OFB|Output-Feedback密码输出反馈模式。可将分块密码作为同步流密码运行。与 CFB 类似，只是前一个输出块的 n 位会被移到数据队列的最右侧位置，等待加密。|  
|


  


###   [DBMS_CRYPTO 密码填充模式](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#dbms-crypto-%E5%AF%86%E7%A0%81%E5%A1%AB%E5%85%85%E6%A8%A1%E5%BC%8F)  

|名称|描述|是否实现|
|:---|:---|---|
|PAD_PKCS5|填充符合 PKCS #5（基于密码的加密标准）|  
|
|PAD_NONE|指定不填充。调用者必须确保块大小正确，否则程序包将返回错误信息。|是|
|PAD_ZERO|填充0。|  
|
|PAD_PKCS7|  
|是|


  


###   [DBMS_CRYPTO 分组加密组合](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#dbms-crypto-%E5%88%86%E7%BB%84%E5%8A%A0%E5%AF%86%E7%BB%84%E5%90%88)  

|名称|描述|是否实现|
|:---|:---|---|
|DES_CBC_PKCS5|ENCRYPT_DES + CHAIN_CBC+ PAD_PKCS5|  
|
|DES3_CBC_PKCS5|ENCRYPT_3DES + CHAIN_CBC + PAD_PKCS5|  
|


##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|高级包|子过程,DBMS_CRYPTO.Hash,DBMS_CRYPTO.ENCRYPT,DBMS_CRYPTO.DECRYPT,参使用的类型,DBMS_CRYPTO.CHAIN_ECB,DBMS_CRYPTO.CHAIN_CBC,DBMS_CRYPTO.CHAIN_CFB,DBMS_CRYPTO.CHAIN_OFB,DBMS_CRYPTO.ENCRYPT_DES,DBMS_CRYPTO.ENCRYPT_3DES_2KEY,DBMS_CRYPTO.ENCRYPT_AES128,DBMS_CRYPTO.ENCRYPT_AES192,DBMS_CRYPTO.ENCRYPT_AES256,DBMS_CRYPTO.ENCRYPT_RC4,DBMS_CRYPTO.HASH_MD4,DBMS_CRYPTO.HASH_MD5,DBMS_CRYPTO.HASH_SH1,DBMS_CRYPTO.HASH_SH256,DBMS_CRYPTO.HASH_SH384,DBMS_CRYPTO.HASH_SH512,DBMS_CRYPTO.PAD_PKCS5,DBMS_CRYPTO.PAD_NONE,DBMS_CRYPTO.PAD_ZERO,DBMS_CRYPTO.DES_CBC_PKCS5,DBMS_CRYPTO.DES3_CBC_PKCS5,  
|输入存储过程的名称，返回有关该过程的参数信息。|是|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


值对应关系（对标oracle）：

```
BEGIN
    DBMS_OUTPUT.PUT_LINE('HASH_MD4: ' || DBMS_CRYPTO.HASH_MD4);
    DBMS_OUTPUT.PUT_LINE('HASH_MD5: ' || DBMS_CRYPTO.HASH_MD5);
    DBMS_OUTPUT.PUT_LINE('HASH_SH1: ' || DBMS_CRYPTO.HASH_SH1);
    DBMS_OUTPUT.PUT_LINE('HASH_SH256: ' || DBMS_CRYPTO.HASH_SH256);
    DBMS_OUTPUT.PUT_LINE('HASH_SH384: ' || DBMS_CRYPTO.HASH_SH384);
    DBMS_OUTPUT.PUT_LINE('HASH_SH512: ' || DBMS_CRYPTO.HASH_SH512);
    DBMS_OUTPUT.PUT_LINE('ENCRYPT_DES: ' || DBMS_CRYPTO.ENCRYPT_DES);
    DBMS_OUTPUT.PUT_LINE('ENCRYPT_3DES_2KEY: ' || DBMS_CRYPTO.ENCRYPT_3DES_2KEY);
    DBMS_OUTPUT.PUT_LINE('ENCRYPT_3DES: ' || DBMS_CRYPTO.ENCRYPT_3DES);
    DBMS_OUTPUT.PUT_LINE('ENCRYPT_AES128: ' || DBMS_CRYPTO.ENCRYPT_AES128);
    DBMS_OUTPUT.PUT_LINE('ENCRYPT_AES192: ' || DBMS_CRYPTO.ENCRYPT_AES192);
    DBMS_OUTPUT.PUT_LINE('ENCRYPT_AES256: ' || DBMS_CRYPTO.ENCRYPT_AES256);
    DBMS_OUTPUT.PUT_LINE('ENCRYPT_RC4: ' || DBMS_CRYPTO.ENCRYPT_RC4);
    DBMS_OUTPUT.PUT_LINE('CHAIN_ECB: ' || DBMS_CRYPTO.CHAIN_ECB);
    DBMS_OUTPUT.PUT_LINE('CHAIN_CBC: ' || DBMS_CRYPTO.CHAIN_CBC);
    DBMS_OUTPUT.PUT_LINE('CHAIN_CFB: ' || DBMS_CRYPTO.CHAIN_CFB);
    DBMS_OUTPUT.PUT_LINE('CHAIN_OFB: ' || DBMS_CRYPTO.CHAIN_OFB);
    DBMS_OUTPUT.PUT_LINE('PAD_NONE: ' || DBMS_CRYPTO.PAD_NONE);
    DBMS_OUTPUT.PUT_LINE('PAD_PKCS5: ' || DBMS_CRYPTO.PAD_PKCS5);
    DBMS_OUTPUT.PUT_LINE('PAD_ZERO: ' || DBMS_CRYPTO.PAD_ZERO);
    DBMS_OUTPUT.PUT_LINE('DES_CBC_PKCS5: ' || DBMS_CRYPTO.DES_CBC_PKCS5);
    DBMS_OUTPUT.PUT_LINE('DES3_CBC_PKCS5: ' || DBMS_CRYPTO.DES3_CBC_PKCS5);
END;
```

HASH_MD4: 1    
  HASH_MD5: 2    
  HASH_SH1: 3    
  HASH_SH256: 4    
  HASH_SH384: 5    
  HASH_SH512: 6    
  ENCRYPT_DES: 1    
  ENCRYPT_3DES_2KEY: 2    
  ENCRYPT_3DES: 3    
  ENCRYPT_AES128: 6    
  ENCRYPT_AES192: 7    
  ENCRYPT_AES256: 8    
  ENCRYPT_RC4: 129    
  CHAIN_ECB: 768    
  CHAIN_CBC: 256    
  CHAIN_CFB: 512    
  CHAIN_OFB: 1024    
  PAD_NONE: 8192    
  PAD_PKCS5: 4096    
  PAD_ZERO: 12288    
  DES_CBC_PKCS5: 4353    
  DES3_CBC_PKCS5: 4355

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

  


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 5    [.1 HASH Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#23-hash-function)  

单向散列函数接收长度可变的输入字符串（即数据），并将其转换为固定长度（通常较小）的输出字符串（称为散列值）。散列值是输入数据的唯一标识符（就像指纹）。你可以使用哈希值来验证数据是否被更改过。

请注意，单向散列函数是一种单向工作的散列函数。从输入数据计算哈希值很容易，但要生成哈希到特定值的数据却很难。因此，单向散列函数能很好地确保数据完整性。

#### 5    [.1.1 Syntax（语法）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#231-syntax%E8%AF%AD%E6%B3%95)  

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

#### 5    [.1.2 Pragmas（编译指示）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#232-pragmas%E7%BC%96%E8%AF%91%E6%8C%87%E7%A4%BA)  

```
<span class="hljs-function">pragma <span class="hljs-title" style="color: rgb(136,0,0);">restrict_references</span><span class="hljs-params">(hash,WNDS,RNDS,WNPS,RNPS)</span></span>;

```

#### 5    [.1.3 Parameter（参数）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#233-parameter%E5%8F%82%E6%95%B0)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|:---|:---|:---|:---|:---|:---|
|src|IN|RAW(BLOB/CLOB咱不实现)|是|-|要哈希散列的源数据。|
|typ|IN|PLS_INTEGER|是|-|使用的哈希算法。|


返回值RAW，哈希过后的数据。

#### 5    [.1.4 Details（详细分析）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#234-details%E8%AF%A6%E7%BB%86%E5%88%86%E6%9E%90)  

1. src参数限制 数据类型为RAW(BLOB/CLOB)。不可为null。错误的入参格式会强制转换为RAW，转换失败则异常。 
1. type参数限制 哈希算法类型只支持上面的有效值，如果不是，则异常报错。是否可以直接输入INTEGER值？
1. src参数可以为空，生成的加密结果也为空。
1. 调用具体的hash方法
1. src数据和结果数据转换成RAW格式。


### 5    [.2 ENCRYPT Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#22-encrypt-function)  

该功能使用用户提供的密钥和可选的IV（初始化向量），使用流密码或块密码对RAW数据进行加密。

#### 5    [.2.1 Syntax（语法）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#221-syntax%E8%AF%AD%E6%B3%95)  

```
DBMS_CRYPTO.ENCRYPT(
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW,
   iv  IN RAW          DEFAULT <span class="hljs-literal" style="color: rgb(120,169,96);">NULL</span>)
 RETURN RAW;

```

#### 5    [.2.2 Pragmas（编译指示）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#222-pragmas%E7%BC%96%E8%AF%91%E6%8C%87%E7%A4%BA)  

```
<span class="hljs-function">pragma <span class="hljs-title" style="color: rgb(136,0,0);">restrict_references</span><span class="hljs-params">(encrypt,WNDS,RNDS,WNPS,RNPS)</span></span>;

```

#### 5    [.2.3 Parameter（参数）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#223-parameter%E5%8F%82%E6%95%B0)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|:---|:---|:---|:---|:---|:---|
|src|IN|RAW|否|-|要加密的RAW数据。|
|typ|IN|PLS_INTEGER|是|-|要使用的流密码或块密码类型。|
|key|IN|RAW|是|-|用于加密数据的key。|
|iv|IN|RAW|否|-|用于块密码的可选初始化向量。|


返回值：RAW类型，加密过后的数据

#### 5    [.2.4 Details（详细分析）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#224-details%E8%AF%A6%E7%BB%86%E5%88%86%E6%9E%90)  

1. src的类型校验，不能为NULL
1. typ校验值类型
1. typ不指定分组加密模式报异常  invalid cipher   type   passed
1. 加密type为NULL报no cipher type specified
1. 根据数据填充方案填充数据src和key
1. 调取对应的加密方法加密
1. 转换加密的结果数据
1. 加密过后的数据再加密抛出异常，怎么实现？


### 5    [.3 DECRYPT Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#21-decrypt-function)  

该函数使用流密码或块密码，并使用用户提供的密钥和可选的 IV（初始化向量）对 RAW 数据进行解密。

#### 5    [.3.1 Syntax（语法）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#211-syntax%E8%AF%AD%E6%B3%95)  

```
DBMS_CRYPTO.DECRYPT(
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW,
   iv  IN RAW DEFAULT <span class="hljs-literal" style="color: rgb(120,169,96);">NULL</span>)
 RETURN RAW;

```

#### 5    [.3.2 Pragmas（编译指示）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#212-pragmas%E7%BC%96%E8%AF%91%E6%8C%87%E7%A4%BA)  

```
<span class="hljs-function">pragma <span class="hljs-title" style="color: rgb(136,0,0);">restrict_references</span><span class="hljs-params">(decrypt,WNDS,RNDS,WNPS,RNPS)</span></span>;

```

####   [2.1.3 Parameter（参数）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#213-parameter%E5%8F%82%E6%95%B0)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|:---|:---|:---|:---|:---|:---|
|src|IN|RAW|否|-|要解密的RAW数据。|
|typ|IN|PLS_INTEGER|是|-|要使用的流密码或块密码类型。|
|key|IN|RAW|是|-|用于解密的key。|
|iv|IN|RAW|否|NULL|用于块密码的可选初始化向量。|


返回值：RAW类型，解密过后的数据

#### 5    [.3.4 Details（详细分析）](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#214-details%E8%AF%A6%E7%BB%86%E5%88%86%E6%9E%90)  

1. src的类型校验，不能为NULL
1. typ校验值类型
1. typ不指定分组加密模式报异常  invalid cipher   type   passed
1. 加密type为NULL报no cipher type specified
1. 根据数据填充方案填充数据src和key
1. 调取对应的解密方法解密
1. 转换解密的结果数据


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. DBMS_CRYPTO.Hash，DBMS_CRYPTO.ENCRYPT，DBMS_CRYPTO.DECRYPT存在不会报错提示找不到
1. DBMS_CRYPTO新增相关参数都不会提示找不到
1. DBMS_CRYPTO.Hash src支持RAW，CLOB，BLOB入参
1. DBMS_CRYPTO.Hash typ支持所有符合的入参，不符合的提示报错
1. DBMS_CRYPTO.Hash 加密出来的数据和oracle保持一致
1. DBMS_CRYPTO.Hash src不支持NULL
1. DBMS_CRYPTO.Hash typ不支持NULL
1. DBMS_CRYPTO.ENCRYPTsrc仅支持RAW类行，其他类型报错
1. DBMS_CRYPTO.ENCRYPT type不能为NULL，必须数据加密算法，填充模式，分组加密模式，少一项提示报错
1. DBMS_CRYPTO.ENCRYPT key不能缺失，并且如果填充方案是不填充，则key长度符合要求，则提示报错
1. DBMS_CRYPTO.ENCRYPT key不能为NULL，类型必须为RAW
1. DBMS_CRYPTO.ENCRYPT iv可以为null，类型必须为RAW
1. DBMS_CRYPTO.ENCRYPT的加密数据和oracle保持一致
1. DBMS_CRYPTO.DECRYPT仅支持RAW类行，其他类型报错
1. DBMS_CRYPTO.DECRYPTtype不能为NULL，必须数据加密算法，填充模式，分组加密模式，少一项提示报错
1. DBMS_CRYPTO.DECRYPTkey不能缺失，并且如果填充方案是不填充，则key长度符合要求，则提示报错
1. DBMS_CRYPTO.DECRYPTkey不能为NULL，类型必须为RAW
1. DBMS_CRYPTO.DECRYPTiv可以为null，类型必须为RAW
1. DBMS_CRYPTO.DECRYPT的能够解密oracle数据并且明文一致
1. DBMS_CRYPTO.DECRYPT的能够解密加密过后的数据，并且和加密明文一致


  


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

以下功能没有实现

###   [MAC Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#mac-function)  

该功能将信息验证码 (MAC) 算法应用于数据，以提供密钥信息保护。

```
DBMS_CRYPTO.MAC (
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW)
 RETURN RAW;

DBMS_CRYPTO.MAC (
   src IN BLOB,
   typ IN PLS_INTEGER
   key IN RAW)
 RETURN RAW;

DBMS_CRYPTO.MAC (
   src IN CLOB CHARACTER SET ANY_CS,
   typ IN PLS_INTEGER
   key IN RAW)
 RETURN RAW;

```

###   [PKDECRYPT Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#pkdecrypt-function)  

该函数使用密钥算法和加密算法辅助的私人密钥解密 RAW 数据，并返回解密后的数据。

```
DBMS_CRYPTO.PKDECRYPT(
   src IN RAW,
   prv_key IN RAW,
   pubkey_alg IN BINARY_INTEGER,
   enc_alg  IN BINARY_INTEGER)
 RETURN RAW;

```

###   [PKENCRYPT Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#pkencrypt-function)  

该功能使用辅助密钥算法和加密算法的公开密钥对 RAW 数据进行加密，并返回加密后的数据。

```
DBMS_CRYPTO.PKENCRYPT(
   src IN RAW,
   pub_key IN RAW,
   pubkey_alg IN BINARY_INTEGER,
   enc_alg  IN BINARY_INTEGER)
 RETURN RAW;

```

###   [RANDOMINTEGER Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#randominteger-function)  

该函数返回 Oracle BINARY_INTEGER 数据类型完整范围内的整数。

```
DBMS_CRYPTO.RANDOMINTEGER
 RETURN BINARY_INTEGER;

```

###   [RANDOMNUMBER Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#randomnumber-function)  

该函数返回 Oracle NUMBER 数据类型中范围为 [0..2**128-1] 的整数。

```
DBMS_CRYPTO.RANDOMNUMBER
 RETURN NUMBER;

```

###   [SIGN Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#sign-function)  

该函数使用密钥算法和签名算法辅助的私钥对 RAW 数据进行签名，并返回签名。

```
DBMS_CRYPTO.SIGN(
   src IN RAW,
   prv_key IN RAW,
   pubkey_alg IN BINARY_INTEGER,
   sign_alg IN BINARY_INTEGER)
 RETURN RAW;

```

###   [VERIFY Function](https://conf.yasdb.com/pages/viewpage.action?pageId=153006386#verify-function)  

该函数使用签名、辅助密钥算法的公钥和签名算法验证 RAW 数据。如果签名已验证，则返回 TRUE。

```
DBMS_CRYPTO.VERIFY(
   src IN RAW,
   sign IN RAW,
   pub_key IN RAW,
   pubkey_alg IN BINARY_INTEGER,
   sign_alg  IN BINARY_INTEGER)
 RETURN BOOLEAN;

```

附加密解密过程

oracle在iv值小于块大小时的输出结果是以稳定的，我们目前的解决方式是统一按照填充0来计算。例如一下场景：

DECLARE    
      l_input RAW(100) := HEXTORAW('01234567899876543210012345678912');    
      l_key RAW(16) := HEXTORAW('01234567899876543210012345678912');    
      l_iv RAW(16) := HEXTORAW('ABD256');    
      l_encrypt RAW(2000);    
  BEGIN    
      l_encrypt := DBMS_CRYPTO.ENCRYPT(    
                      src => l_input,    
                      typ => DBMS_CRYPTO.ENCRYPT_AES128 + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_NONE,    
                      key  => l_key,    
                      iv => l_iv    
                  );

    DBMS_OUTPUT.PUT_LINE('Encrypt value: ' || l_encrypt);    
  END;    
  /

我们在

l_iv RAW(16) := HEXTORAW('ABD256');

l_iv RAW(16) := HEXTORAW('ABD2560000000000');

l_iv RAW(16) := HEXTORAW('ABD25600000000000000000000000000');

l_iv RAW(17) := HEXTORAW('ABD25600000000000000000000000000AB');

这四种情况下是统一的输出结果，Oracle则只能保证后两种是一种输出结果。怀疑Oracle在iv值长度不够时会才内存，所以结果不稳定。有些加密工具则是在iv值不够的时，直接报错，不允许加密。