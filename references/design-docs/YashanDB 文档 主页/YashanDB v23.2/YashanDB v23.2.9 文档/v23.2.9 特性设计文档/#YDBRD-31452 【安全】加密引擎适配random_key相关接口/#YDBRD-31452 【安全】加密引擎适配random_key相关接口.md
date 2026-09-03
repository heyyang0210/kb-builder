Created by 史鑫, last modified on 十一月 14, 2024

#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

  [YDBRD-26492 基于密码卡开发加解密、签名验签、摘要等功能 - YashanDB 文档 - SICS-CoD Confluence](https://conf.yasdb.com/pages/resumedraft.action?draftId=147775996&draftShareId=c1de8e71-401e-474a-b1dc-9ef3085f7e1c&)  

#   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

子需求：

  [https://pingcode.yasdb.com/pjm/items/66bad0858f5ee191734cff19](https://pingcode.yasdb.com/pjm/items/66bad0858f5ee191734cff19)    ?    
  #YDBRD-31452 【安全】加密引擎适配random/key相关接口

共以下  **14个**  算法类型  需要适配：

|适配接口|提供方|配置参数|业务依赖|
|---|---|---|---|
|GenRandom|- openssl
- GMSSL
- 密码卡
,  
    
    
|ENCRYPT_ENGINE_TYPE配置,- openssl
- GMSSL
- PCIE
,  
|- GenRandom
    - 内置函数：select crypt_selftest('random',10000) from dual;
- SM4GenKey
- 
- 登录：alter system set PASSWORD_CRYPTO_METHOD =SM4 scope=spfile;
|
|SM4GenKey||||
|EVP接口，算法类型：,- ENCRYPT_ALGO_SM4_CBC
- ENCRYPT_ALGO_AES_128_CBC
- ENCRYPT_ALGO_AES_128_CBC_PKCS7
|- openssl
- GMSSL
- 密码卡
||- ENCRYPT_ALGO_SM4_CBC    

    - 加解密bif：select crypt_encrypt('abc', 'sm4', 'CBC', '12345678901234567890123456789012', '12345678901234567890123456789012') as xxxx from dual;
- ENCRYPT_ALGO_AES_128_CBC/ENCRYPT_ALGO_AES_128_CBC_PKCS7    

    - 加解密bip：DBMS_CRYPTO.ENCRYPT/DBMS_CRYPTO.DECRYPT
|
|EVP接口，算法类型：,- ENCRYPT_ALGO_DES = 5,
- ENCRYPT_ALGO_DES_CBC = 11,
- ENCRYPT_ALGO_DES_CBC_PKCS7 = 12,
- ENCRYPT_ALGO_3DES = 6,
- ENCRYPT_ALGO_3DES_CBC = 13,
- ENCRYPT_ALGO_3DES_CBC_PKCS7 = 14,
- ENCRYPT_ALGO_3DES_2KEY_CBC = 15,
- ENCRYPT_ALGO_3DES_2KEY_CBC_PKCS7 = 1
- ENCRYPT_ALGO_3DES_2KEY = 7,
|- openssl
- ~~GMSSL~~
- 密码卡
,**说明**  ：GMSSL没有支持DES/3DES的能力，配置成GMSSL，相应的业务  **报错**||- 加解密bip：DBMS_CRYPTO.ENCRYPT/DBMS_CRYPTO.DECRYPT中使用
|


#   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

GMSSL没有支持DES/3DES的能力，配置成GMSSL，相应的业务（BIP）报错。

#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

![](https://pingcode.yasdb.com/atlas/files/public/673996e18970c2af4f52b5e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBRUFBQUFBQUFBRUFCQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NjgsImV4cCI6MTc4MjMzNTQ2OH0.QUNnIZXxMzdxp_4IS5zOWz8-NhD1gL_fpvjXJc4bLSY)

## **适配点 ：**

基本流程：aniEvpCipherCtxSetPadding/encrFinal（padding相关）

- 基本原则：    

    - GMSSL：使用相应的padding接口aes_cbc_padding_encrypt/aes_cbc_padding_decrypt，yashan自己不做padding处理
    - PCIE：自己保留padding信息，加密前自己加padding，解密后在final接口去除padding，非padding模式，即使入参是整数倍，也要加padding，否则padding/真实数据分不清。
- 接口：
    - aniEvpCipherCtxSetPadding：pcie和gmssl保存信息，加解密是起作用。
    - encrFinal：GMSSL使用aes_cbc_padding_encrypt已经处理padding了，直接返回；pcie内部不处理，要自己处理。
- 算法：EVP接口增加算法需要适配的点    

    - 算法上下文：aniEvpCipherCtxNew/aniEvpCipherCtxFree
    - 算法属性：getEncryptEvpCipher
    - init：aniEvpEncryptInitEx/aniEvpDecryptInitEx
    - padding模式设置：aniEvpCipherCtxSetPadding
    - 加解密：aniEvpEncryptUpdate
    - final：aniEvpEncryptFinalEx/aniEvpDecryptFinalEx


|类型|openssl|gmssl|pcie|应用|
|---|---|---|---|---|
|ENCRYPT_ALGO_SM4_CBC|~~已支持~~    
    
|ok|ok|select crypt_encrypt('abc', 'sm4', 'CBC', '12345678901234567890123456789012', '12345678901234567890123456789012') as xxxx from dual;|
|ENCRYPT_ALGO_AES_128_CBC||ok|ok|bip:cryptoInitEncrAlgo|
|**ENCRYPT_ALGO_AES_128_CBC_PKCS7**||待实现|||
|~~ENCRYPT_ALGO_DES/ENCRYPT_ALGO_3DES~~||||~~没用到，删了吧~~|
|**ENCRYPT_ALGO_DES_CBC**||||bip:cryptoInitEncrAlgo|
|**ENCRYPT_ALGO_DES_CBC_PKCS7**|||||
|**ENCRYPT_ALGO_3DES_CBC**|||||
|**ENCRYPT_ALGO_3DES_CBC_PKCS7**|||||
|**ENCRYPT_ALGO_3DES_2KEY_CBC**|||||
|**ENCRYPT_ALGO_3DES_2KEY_CBC_PKCS7**|||||
|**ENCRYPT_ALGO_3DES_2KEY**|||||


## padding相关的说明

- pcie需自行revoke/add padding，其中revome封装到pcieFinal中。
- 自行padding的接口结果要和三方库自己的padding结果一致。
- 内存：如果添加了padding，加密后的结果可能会变长，注意调用者的内存长度。


![](https://pingcode.yasdb.com/atlas/files/public/673996e18970c2af4f52b5e1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUVBQUFBQUFBQUFBQUFBRUFBQUFBQUFBRUFCQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUJBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ2NjgsImV4cCI6MTc4MjMzNTQ2OH0.QUNnIZXxMzdxp_4IS5zOWz8-NhD1gL_fpvjXJc4bLSY)

# 5.兼容性

#   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

# 7.自测用例

密码卡环境：192.168.132.196 

# 8.细节记录

## Attachments:

[image2024-5-10_19-28-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTk2ZTFhMWFkOWEzMzExZGQzNDQxIiwicmVmX2lkIjoiNjczOTk2ZTE3MjgyMDZlZmI5MzAzZmUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzI0NjY4LCJleHAiOjE3ODI0MTEwNjh9.O0nDYa-c3TrCv7dxKdSO3IUZHsWRlzaX_D4WnrQaNmg)

 (image/png)    
