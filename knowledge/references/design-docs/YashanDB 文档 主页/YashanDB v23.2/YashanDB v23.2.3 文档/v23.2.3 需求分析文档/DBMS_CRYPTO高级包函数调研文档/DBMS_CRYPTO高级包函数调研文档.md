Created by 侯忠林, last modified on 五月 17, 2024

#   [DBMS_CRYPTO高级包函数Research（DBMS_CRYPTO高级包函数调研文档）](#dbms-crypto高级包函数researchdbms-crypto高级包函数调研文档)  

SR链接:

  [YDBRD-26602 支持DBMS_CRYPTO内置系统包的HASH函数](https://pingcode.yasdb.com/pjm/items/66272547fd997db58adf6f46)  

  [YDBRD-26603 支持DBMS_CRYPTO内置系统包的加解密函数](https://pingcode.yasdb.com/pjm/items/662726c5fd997db58adf7173)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_CRYPTO文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_CRYPTO.html#GUID-1C98C203-29EF-488D-A5FA-42AD4BD7718D)  

  [达梦 DBMS_CRYPTO文档](https://eco.dameng.com/document/dm/zh-cn/pm/dbms_crypto-package)  

（1）  **DECRYPT**  ：输入加密的源数据RAW，返回RAW解密的数据。

（2）  **ENCRYPT**  ：输入需要加密的源数据RAW，返回RAW加密的数据。

（3）  **Hash**  ：输入hash的源数据RAW、BLOB、CLOB，返回RAW哈希过后的数据。

###   [DBMS_CRYPTO 算法](#dbms-crypto-算法)  

####   [哈希算法](#哈希算法)  

|名称|描述|
|---|---|
|HASH_MD4|生成128位散列或输入信息的信息摘要|
|HASH_MD5|同样产生128位散列，但比MD4更复杂|
|HASH_SH1|安全散列算法（SHA-1）。产生160位散列值。|
|HASH_SH256|SHA-2，产生256位的哈希值。|
|HASH_SH384|SHA-2，产生384位的哈希值。|
|HASH_SH512|SHA-2，产生512位的哈希值。|


####   [加密算法](#加密算法)  

|名称|描述|
|---|---|
|ENCRYPT_DES|数据加密标准。分块密码。使用的密钥长度为 56 位。|
|ENCRYPT_3DES_2KEY|数据加密标准。区块密码。使用 2 个密钥对一个数据块进行 3 次操作。有效密钥长度为 112 位。|
|ENCRYPT_3DES|数据加密标准。区块密码。对一个数据块进行 3 次操作。|
|ENCRYPT_AES128|高级加密标准。区块密码。使用 128 位密钥。|
|ENCRYPT_AES192|高级加密标准。区块密码。使用 192 位密钥。|
|ENCRYPT_AES256|高级加密标准。区块密码。使用 256 位密钥。|
|ENCRYPT_RC4|流密码。使用随机生成的密钥，每个会话都是独一无二的。|


###   [DBMS_CRYPTO 分组加密模式](#dbms-crypto-分组加密模式)  

|名称|描述|
|---|---|
|CHAIN_ECB|Electronic Codebook电子密码本模式。对每个明文块进行独立加密。|
|CHAIN_CBC|Cipher Block Chaining密码分组连接模式。明文在加密前与前一个密码文块进行 XOR。|
|CHAIN_CFB|Cipher-Feedback密码反馈模式。可对小于数据块大小的数据单位进行加密。|
|CHAIN_OFB|Output-Feedback密码输出反馈模式。可将分块密码作为同步流密码运行。与 CFB 类似，只是前一个输出块的 n 位会被移到数据队列的最右侧位置，等待加密。|


分组密码是每次只能处理特定长度的一块数据的一类密码算法，这里的“一块”就称为分组。一个分组的比特数就称为分组长度。流密码是对数据流进行连续处理的一类密码算法。流密码一般以1比特、8比特或32比特等为单位进行加密和解密。分组密码算法只能加密固定长度的分组，但需要加密的明文长度可能会超过分组密码的分组长度，这就需要对分组密码算法进行迭代，以便将一段很长的明文全部加密。迭代的方法就被称为分组密码的模式。

###   [DBMS_CRYPTO 密码填充模式](#dbms-crypto-密码填充模式)  

|名称|描述|
|---|---|
|PAD_PKCS5|填充符合 PKCS #5（基于密码的加密标准）|
|PAD_NONE|指定不填充。调用者必须确保块大小正确，否则程序包将返回错误信息。|
|PAD_ZERO|填充0。|


在分组加密算法中（例如DES），我们首先要将原文进行分组，然后每个分组进行加密，然后组装密文。其中有一步是分组。如何分组？假设我们现在的数据长度是24字节，BlockSize是8字节，那么很容易分成3组，一组8字节。例如，有一个17字节的数据，BlockSize是8字节，怎么分组？可以对原文进行填充（padding），将其填充到8字节的整数倍！

PKCS #5是什么？首先PKCS是什么？The Public-Key Cryptography Standards (PKCS)是由美国RSA数据安全公司及其合作伙伴制定的一组公钥密码学标准，其中包括证书申请、证书更新、证书作废表发布、扩展证书内容以及数字签名、数字信封的格式等方面的一系列相关协议。PKCS5是其中的密码基值加密标准，是8字节PKCS5填充的，即填充一定数量的内容，使得成为8的整数倍，而填充的内容取决于需要填充的数目。例如，串0x56在经过PKCS5填充之后会成为0x56 0x07 0x07 0x07 0x07 0x07 0x07 0x07因为需要填充7字节，因此填充的内容就是7。当然特殊情况下，如果已经满足了8的整倍数，按照PKCS5的规则，仍然需要在尾部填充8个字节，并且内容是0x08,目的是为了加解密时统一处理填充。

###   [DBMS_CRYPTO 分组加密组合](#dbms-crypto-分组加密组合)  

|名称|描述|
|---|---|
|DES_CBC_PKCS5|ENCRYPT_DES + CHAIN_CBC+ PAD_PKCS5|
|DES3_CBC_PKCS5|ENCRYPT_3DES + CHAIN_CBC + PAD_PKCS5|


##   [2. Features（功能特性）](#2-features功能特性)  

oracle 数据库会在SYS模式中安装该软件包。可以根据需要向现有用户和角色授予软件包访问权限。

###   [2.1 DECRYPT Function](#21-decrypt-function)  

该函数使用流密码或块密码，并使用用户提供的密钥和可选的 IV（初始化向量）对 RAW 数据进行解密。

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
DBMS_CRYPTO.DECRYPT(
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW,
   iv  IN RAW DEFAULT NULL)
 RETURN RAW;

```

####   [2.1.2 Pragmas（编译指示）](#212-pragmas编译指示)  

```
pragma restrict_references(decrypt,WNDS,RNDS,WNPS,RNPS);

```

####   [2.1.3 Parameter（参数）](#213-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|src|IN|RAW|否|-|要解密的RAW数据。|
|typ|IN|PLS_INTEGER|是|-|要使用的流密码或块密码类型。|
|key|IN|RAW|是|-|用于解密的key。|
|iv|IN|RAW|否|NULL|用于块密码的可选初始化向量。|


返回值：RAW类型，解密过后的数据

####   [2.1.4 Details（详细分析）](#214-details详细分析)  

```
--DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO
DECLARE
    l_input RAW(100) := HEXTORAW('77D58A92CE7B4064F5D8B6BE84BCDB90');
    l_key VARCHAR2(100) := '0123456789ABCDEF';
    l_decrypt RAW(2000);
BEGIN
    l_key := UTL_I18N.STRING_TO_RAW(l_key, 'AL32UTF8');

    l_decrypt := DBMS_CRYPTO.DECRYPT(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO,
                    key  =&gt; l_key,
                    iv =&gt; NULL
);

    DBMS_OUTPUT.PUT_LINE('Decrypt value: ' || utl_raw.cast_to_varchar2(l_decrypt));
END;
/

OUTPUT:
Decrypt value: YourSecretData

--密文输入非密文
DECLARE
    l_input RAW(100) := HEXTORAW('12345665');
    l_key VARCHAR2(100) := '0123456789ABCDEF';
    l_decrypt RAW(2000);
BEGIN
    l_key := UTL_I18N.STRING_TO_RAW(l_key, 'AL32UTF8');

    l_decrypt := DBMS_CRYPTO.DECRYPT(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO,
                    key  =&gt; l_key,
                    iv =&gt; NULL
);

    DBMS_OUTPUT.PUT_LINE('Decrypt value: ' || utl_raw.cast_to_varchar2(l_decrypt));
END;
/

OUTPUT:
DECLARE
*
ERROR at line 1:
ORA-28817: PL/SQL function returned an error.
ORA-06512: at "SYS.DBMS_CRYPTO_FFI", line 67
ORA-06512: at "SYS.DBMS_CRYPTO", line 44
ORA-06512: at line 8

--加密解密的key不一致
DECLARE
    l_input RAW(100) := HEXTORAW('77D58A92CE7B4064F5D8B6BE84BCDB90');
    l_key VARCHAR2(100) := 'ABCDEF';
    l_decrypt RAW(2000);
BEGIN
    l_key := UTL_I18N.STRING_TO_RAW(l_key, 'AL32UTF8');

    l_decrypt := DBMS_CRYPTO.DECRYPT(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO,
                    key  =&gt; l_key,
                    iv =&gt; NULL
);

    DBMS_OUTPUT.PUT_LINE('Decrypt value: ' || utl_raw.cast_to_varchar2(l_decrypt));
END;
/

Decrypt value: ����ݷ��*!�$�

```

###   [2.2 ENCRYPT Function](#22-encrypt-function)  

该功能使用用户提供的密钥和可选的IV（初始化向量），使用流密码或块密码对RAW数据进行加密。

####   [2.2.1 Syntax（语法）](#221-syntax语法)  

```
DBMS_CRYPTO.ENCRYPT(
   src IN RAW,
   typ IN PLS_INTEGER,
   key IN RAW,
   iv  IN RAW          DEFAULT NULL)
 RETURN RAW;

```

####   [2.2.2 Pragmas（编译指示）](#222-pragmas编译指示)  

```
pragma restrict_references(encrypt,WNDS,RNDS,WNPS,RNPS);

```

####   [2.2.3 Parameter（参数）](#223-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|src|IN|RAW|否|-|要加密的RAW数据。|
|typ|IN|PLS_INTEGER|是|-|要使用的流密码或块密码类型。|
|key|IN|RAW|是|-|用于加密数据的key。|
|iv|IN|RAW|否|-|用于块密码的可选初始化向量。|


返回值：RAW类型，加密过后的数据

####   [2.2.4 Details（详细分析）](#224-details详细分析)  

```
--DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO
DECLARE
    l_input VARCHAR2(100) := 'YourSecretData';
    l_key VARCHAR2(100) := '0123456789ABCDEF';
    l_encrypt RAW(2000);
BEGIN
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');
    l_key := UTL_I18N.STRING_TO_RAW(l_key, 'AL32UTF8');
    
    l_encrypt := DBMS_CRYPTO.ENCRYPT(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO,
                    key  =&gt; l_key,
                    iv =&gt; NULL
                );

    DBMS_OUTPUT.PUT_LINE('Encrypt value: ' || RAWTOHEX(l_encrypt));
END;
/

OUTPUT:
Encrypt value: 77D58A92CE7B4064F5D8B6BE84BCDB90

PL/SQL 过程已成功完成。

--加密过后再加密，DoubleEncryption 28233
--如果当前页面没有进行过上面的加密，直接执行下面解密，则不会异常

DECLARE
    l_input RAW(100) := HEXTORAW('77D58A92CE7B4064F5D8B6BE84BCDB90');
    l_key VARCHAR2(100) := '0123456789ABCDEF';
    l_encrypt RAW(2000);
BEGIN
    l_key := UTL_I18N.STRING_TO_RAW(l_key, 'AL32UTF8');
    
    l_encrypt := DBMS_CRYPTO.ENCRYPT(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO,
                    key  =&gt; l_key,
                    iv =&gt; NULL
                );

    DBMS_OUTPUT.PUT_LINE('Encrypt value: ' || RAWTOHEX(l_encrypt));
END;
/

DECLARE
*
ERROR at line 1:
ORA-28233: double encryption not supported
ORA-06512: at "SYS.DBMS_CRYPTO_FFI", line 3
ORA-06512: at "SYS.DBMS_CRYPTO", line 13
ORA-06512: at line 8

--KeyNull 28239
DECLARE
    l_input VARCHAR2(100) := 'YourSecretData';
    l_encrypt RAW(2000);
BEGIN
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');
    
    l_encrypt := DBMS_CRYPTO.ENCRYPT(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.CHAIN_CBC + DBMS_CRYPTO.PAD_ZERO,
                    key  =&gt; NULL,
                    iv =&gt; NULL
                );

    DBMS_OUTPUT.PUT_LINE('Encrypt value: ' || RAWTOHEX(l_encrypt));
END;
/

OUTPUT:
DECLARE
*
ERROR at line 1:
ORA-28239: no key provided
ORA-06512: at "SYS.DBMS_CRYPTO_FFI", line 3
ORA-06512: at "SYS.DBMS_CRYPTO", line 13
ORA-06512: at line 7

--不指定分组加密模式CipherSuiteInvalid 28827
DECLARE
    l_input VARCHAR2(100) := 'YourSecretData';
    l_key VARCHAR2(100) := '0123456789ABCDEF';
    l_encrypt RAW(2000);
BEGIN
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');
    l_key := UTL_I18N.STRING_TO_RAW(l_key, 'AL32UTF8');
    
    l_encrypt := DBMS_CRYPTO.ENCRYPT(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_DES + DBMS_CRYPTO.PAD_ZERO,
                    key  =&gt; l_input,
                    iv =&gt; NULL
                );

    DBMS_OUTPUT.PUT_LINE('Encrypt value: ' || RAWTOHEX(l_encrypt));
END;
/

OUTPUT:
DECLARE
*
ERROR at line 1:
ORA-28827: invalid cipher type passed
ORA-06512: at "SYS.DBMS_CRYPTO_FFI", line 3
ORA-06512: at "SYS.DBMS_CRYPTO", line 13
ORA-06512: at line 9

--加密type为NULL,CipherSuiteNull 28829
DECLARE
    l_input VARCHAR2(100) := 'YourSecretData';
    l_key VARCHAR2(100) := '0123456789ABCDEF';
    l_encrypt RAW(2000);
BEGIN
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');
    l_key := UTL_I18N.STRING_TO_RAW(l_key, 'AL32UTF8');
    
    l_encrypt := DBMS_CRYPTO.ENCRYPT(
                    src =&gt; l_input,
                    typ =&gt; NULL,
                    key  =&gt; l_key,
                    iv =&gt; NULL
                );

    DBMS_OUTPUT.PUT_LINE('Encrypt value: ' || RAWTOHEX(l_encrypt));
END;
/

OUTPUT:
DECLARE
*
ERROR at line 1:
ORA-28829: no cipher type specified
ORA-06512: at "SYS.DBMS_CRYPTO_FFI", line 3
ORA-06512: at "SYS.DBMS_CRYPTO", line 13
ORA-06512: at line 9

```

###   [2.3 HASH Function](#23-hash-function)  

单向散列函数接收长度可变的输入字符串（即数据），并将其转换为固定长度（通常较小）的输出字符串（称为散列值）。散列值是输入数据的唯一标识符（就像指纹）。你可以使用哈希值来验证数据是否被更改过。

请注意，单向散列函数是一种单向工作的散列函数。从输入数据计算哈希值很容易，但要生成哈希到特定值的数据却很难。因此，单向散列函数能很好地确保数据完整性。

####   [2.3.1 Syntax（语法）](#231-syntax语法)  

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

####   [2.3.2 Pragmas（编译指示）](#232-pragmas编译指示)  

```
pragma restrict_references(hash,WNDS,RNDS,WNPS,RNPS);

```

####   [2.3.3 Parameter（参数）](#233-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|src|IN|RAW/BLOB/CLOB|是|-|要哈希散列的源数据。|
|typ|IN|PLS_INTEGER|是|-|使用的哈希算法。|


返回值RAW，哈希过后的数据。

Oracle 建议使用 SHA-1（安全散列算法）或 SHA-2，因为它比 MD4 或 MD5 更能抵御暴力破解攻击。如果必须使用消息摘要算法，则 MD5 比 MD4 提供更高的安全性。

####   [2.3.4 Details（详细分析）](#234-details详细分析)  

（1）src参数限制数据类型为RAW/BLOB/CLOB。不可为null。错误的入参格式会强制转换为RAW，转换失败则异常。（2）type参数限制哈希算法类型只支持上面的有效值，如果不是，则异常报错。

```
-- 使用 SHA-256 算法
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    -- 计算消息的哈希值
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );

    -- 将哈希值转换为十六进制字符串以便显示
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
OUTPUT:
Hash value: F27F3BE39C013B4E7ABE2130AFC996B1CFF32E18AED9EB206162CCE29F763F1C

PL/SQL 过程已成功完成。

-- 使用 HASH_SH384 算法
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    -- 计算消息的哈希值
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_SH384
                );

    -- 将哈希值转换为十六进制字符串以便显示
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
OUTPUT:
Hash value: 428D74255974346C3F9750239C7262928174B5C9CC82374A3ACF67DD68890867C45A2E7DC788D3BF063BCB450F0DBB1F

-- 使用 HASH_SH512 算法
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    -- 计算消息的哈希值
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_SH512
                );

    -- 将哈希值转换为十六进制字符串以便显示
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
OUTPUT:
Hash value: 2EEC8B023C08E375B0589940A17A8599C7BF4FC6ADA2A1D2F5E4E08793B6B550598EEFBAAAC8A3E8F42F20EA267732965ACBBDF9398AF9949221DBDA065257E0

-- 使用 HASH_SH1 算法
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    -- 计算消息的哈希值
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_SH1
                );

    -- 将哈希值转换为十六进制字符串以便显示
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
OUTPUT:
Hash value: 599100288131D647E4E42AD148A476D628721EC9

-- 使用 HASH_MD5 算法
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    -- 计算消息的哈希值
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_MD5
                );

    -- 将哈希值转换为十六进制字符串以便显示
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
OUTPUT:
Hash value: D4E6A4A2092D2879A616692C9ABEB60C

-- 使用 HASH_MD4 算法
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    -- 计算消息的哈希值
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_MD4
                );

    -- 将哈希值转换为十六进制字符串以便显示
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
OUTPUT:
Hash value: B4B3532F75C1E4AC6B2B1C07E8A99DB9

--使用错误的加密type
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    -- 计算消息的哈希值
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_SH257
                );

    -- 将哈希值转换为十六进制字符串以便显示
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/

OUTPUT:
typ =&gt; DBMS_CRYPTO.HASH_SH257
                   *
ERROR at line 11:
ORA-06550: line 11, column 40:
PLS-00302: component 'HASH_SH257' must be declared
ORA-06550: line 9, column 5:
PL/SQL: Statement ignored

----使用不支持的加密type ENCRYPT_AES128
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');

    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.ENCRYPT_AES128
                );

    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/

--ENCRYPT_AES128加密结果和使用HASH_SH512加密结果一致
--ENCRYPT_DES加密结果和使用HASH_MD4加密结果一致
OUTPUT:
Hash value: 2EEC8B023C08E375B0589940A17A8599C7BF4FC6ADA2A1D2F5E4E08793B6B550598EEFBAAAC8A3E8F42F20EA267732965ACBBDF9398AF9949221DBDA065257E0

--src使用错误的入参格式
DECLARE
    l_input VARCHAR2(32767) := 'YourSecretData';
    l_hash RAW(2000);
BEGIN
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
OUTPUT:
DECLARE
*
ERROR at line 1:
ORA-06502: PL/SQL: numeric or value error: hex to raw conversion error
ORA-06512: at line 5

--src为空值
DECLARE
    l_input VARCHAR2(32767);
    l_hash RAW(2000);
BEGIN
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_input,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/

OUTPUT:
Hash value:

--src为clob
DECLARE
    l_lob_data CLOB;
    l_hash RAW(2000);
    l_offset INTEGER := 1;
    l_input VARCHAR2(32767) := 'YourSecretData';
BEGIN
    DBMS_LOB.CREATETEMPORARY(l_lob_data,true);
    DBMS_LOB.WRITE(
        lob_loc =&gt; l_lob_data,
        amount =&gt; LENGTH(l_input),
        offset =&gt; l_offset,
        buffer =&gt; l_input
    );
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_lob_data,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/

--输出的加密数据和RAW参数中相同l_input的加密结果一致
OUTPUT:
Hash value: F27F3BE39C013B4E7ABE2130AFC996B1CFF32E18AED9EB206162CCE29F763F1C

--src为blob
DECLARE
    l_lob_data BLOB;
    l_hash RAW(2000);
    l_offset INTEGER := 1;
    l_input VARCHAR2(32767) := 'YourSecretData';
BEGIN
    -- 将输入数据转换为 RAW 格式
    l_input := UTL_I18N.STRING_TO_RAW(l_input, 'AL32UTF8');
    DBMS_LOB.CREATETEMPORARY(l_lob_data,true);
    DBMS_LOB.WRITE(
        lob_loc =&gt; l_lob_data,
        amount =&gt; 14,
        offset =&gt; l_offset,
        buffer =&gt; l_input
    );
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_lob_data,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/

--输出的加密数据和RAW参数、clob参数中相同l_input的加密结果一致
OUTPUT:
Hash value: F27F3BE39C013B4E7ABE2130AFC996B1CFF32E18AED9EB206162CCE29F763F1C

--src为未定义的clob
DECLARE
    l_lob_data CLOB;
    l_hash RAW(2000);
BEGIN
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_lob_data,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/

OUTPUT:
DECLARE
*
ERROR at line 1:
ORA-01405: fetched column value is NULL

--src为空的clob
DECLARE
    l_lob_data CLOB;
    l_hash RAW(2000);
BEGIN
    l_lob_data := EMPTY_CLOB();
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_lob_data,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/
--或者
DECLARE
    l_lob_data CLOB;
    l_hash RAW(2000);
BEGIN
    l_lob_data := EMPTY_CLOB();
    l_hash := DBMS_CRYPTO.HASH(
                    src =&gt; l_lob_data,
                    typ =&gt; DBMS_CRYPTO.HASH_SH256
                );
    DBMS_OUTPUT.PUT_LINE('Hash value: ' || RAWTOHEX(l_hash));
END;
/

--两种lob结果输出一致
OUTPUT:
Hash value: E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855


```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

该函数限制在SYS模式模式中，如果使用需要向现有用户和角色授予软件包访问权限。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

（1）HASH Function中依赖clob，blob到RAW类型的转换。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

以下功能没有调研

###   [MAC Function](#mac-function)  

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

###   [PKDECRYPT Function](#pkdecrypt-function)  

该函数使用密钥算法和加密算法辅助的私人密钥解密 RAW 数据，并返回解密后的数据。

```
DBMS_CRYPTO.PKDECRYPT(
   src IN RAW,
   prv_key IN RAW,
   pubkey_alg IN BINARY_INTEGER,
   enc_alg  IN BINARY_INTEGER)
 RETURN RAW;

```

###   [PKENCRYPT Function](#pkencrypt-function)  

该功能使用辅助密钥算法和加密算法的公开密钥对 RAW 数据进行加密，并返回加密后的数据。

```
DBMS_CRYPTO.PKENCRYPT(
   src IN RAW,
   pub_key IN RAW,
   pubkey_alg IN BINARY_INTEGER,
   enc_alg  IN BINARY_INTEGER)
 RETURN RAW;

```

###   [RANDOMINTEGER Function](#randominteger-function)  

该函数返回 Oracle BINARY_INTEGER 数据类型完整范围内的整数。

```
DBMS_CRYPTO.RANDOMINTEGER
 RETURN BINARY_INTEGER;

```

###   [RANDOMNUMBER Function](#randomnumber-function)  

该函数返回 Oracle NUMBER 数据类型中范围为 [0..2**128-1] 的整数。

```
DBMS_CRYPTO.RANDOMNUMBER
 RETURN NUMBER;

```

###   [SIGN Function](#sign-function)  

该函数使用密钥算法和签名算法辅助的私钥对 RAW 数据进行签名，并返回签名。

```
DBMS_CRYPTO.SIGN(
   src IN RAW,
   prv_key IN RAW,
   pubkey_alg IN BINARY_INTEGER,
   sign_alg IN BINARY_INTEGER)
 RETURN RAW;

```

###   [VERIFY Function](#verify-function)  

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

ECB    
    


![](https://pingcode.yasdb.com/atlas/files/public/67396d858970c2af4f521357/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

![](https://pingcode.yasdb.com/atlas/files/public/67396d858970c2af4f521359/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

  
    
  CBC    


![](https://pingcode.yasdb.com/atlas/files/public/67396d858970c2af4f52135b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d85a1ad9a3311dc91cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

  
    
  CFB    
    


![](https://pingcode.yasdb.com/atlas/files/public/67396d858970c2af4f52135d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d85a1ad9a3311dc91ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

  
  OFB    


![](https://pingcode.yasdb.com/atlas/files/public/67396d85a1ad9a3311dc91cf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d85a1ad9a3311dc91d1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY)

## Attachments:

[image2024-5-15_15-21-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODQ4OTcwYzJhZjRmNTIxMzRjIiwicmVmX2lkIjoiNjczOTZkODQ1OTNmOTljOWZmMjM3YzNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5NTI1LCJleHAiOjE3ODIzOTU5MjV9.wv_KYxlb7YiWwWwt18gmcZTp5vBYMwLscydDg3y00dE)

 (image/png)    


[image2024-5-15_15-22-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODQ4OTcwYzJhZjRmNTIxMzRkIiwicmVmX2lkIjoiNjczOTZkODQ1OTNmOTljOWZmMjM3YzNmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5NTI1LCJleHAiOjE3ODIzOTU5MjV9.Gx7AQJ4gro5NBjAVWHUSIE9K70q1ghxLcBs7fTRCPNM)

 (image/png)    


## Comments:

|  [](null)  ,DECLARE    
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
                  );,    DBMS_OUTPUT.PUT_LINE('Encrypt value: ' || l_encrypt);    
  END;    
  /,oracle在iv值小于块大小时的输出结果是以稳定的，我们目前的解决方式是统一按照填充0来计算,![](https://pingcode.yasdb.com/atlas/files/public/67396d858970c2af4f521360/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQkFBQUNBQUFBQUFDQUFBQUFRSUFBZ0JBQUFBQUFBQUFBQUVCQUNBQUFBQVFBQUFBQUFBQkFBQUFBQUFrQUFBQUNBQ0FCQkFBQUFDQUFBQUFBQWdBQUVDQUFFQUNnQkFBQUFrQUFCRUFBUUFBQUFBQUFBQUFBQUFRQUJBQUFBQUFBQUFBQUFDQ0FBRUNBQUFBQUFBUUFBQUFBQUpBQUFBQUFCRUFnQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MjUsImV4cCI6MTc4MjMyMDMyNX0.B4A9cnlXXf4fDksjZfYAgzRyZSn_aBkm9x-eDIwF_tY),Posted by houzhonglin at 八月 08, 2024 16:52|
|---|
