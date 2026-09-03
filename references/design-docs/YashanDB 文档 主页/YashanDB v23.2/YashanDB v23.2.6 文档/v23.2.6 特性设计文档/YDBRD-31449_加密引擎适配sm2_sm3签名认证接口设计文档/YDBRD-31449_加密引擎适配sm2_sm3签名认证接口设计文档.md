Created by 贺国锋, last modified on 九月 14, 2024

# YDBRD-31449:加密引擎适配sm2/sm3签名认证接口设计文档

SR链接：    [https://pingcode.yasdb.com/pjm/items/66bad03066228b94707e32df](https://pingcode.yasdb.com/pjm/items/66bad03066228b94707e32df)    ?#YDBRD-31449 【安全】加密引擎适配sm2/sm3签名认证接口

# 1. 总述

算法适配：以下算法暂时都是openssl提供，要在gmssl/pcie适配

- SM2加解密
- SM2签名/验签
- SM3Hash
- SM3Hmac
- SM2密钥生成


##   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

涉及的的函数列表：

|crypt_key|
|:---|
|crypt_hash|
|crypt_hmac|
|crypt_sign|
|crypt_verify|
|crypt_encrypt|
|crypt_decrypt|


  


# 3. 规格与约束

暂无

# 4. 特性

本特性不涉及对外接口的变更和能力的变更。

仅扩展支持在PCIE和GMSSL环境下，列表中给出的7个函数的使用。

变更加密引擎时，可以修改yasdb.ini配置文件中的ENCRYPT_ENGINE_TYPE  配置参数。

# 5.兼容性

不涉及

# 6.未来规划

# 7.附录

## Comments:

|  [](null)  ,会议时间：2024-09-14 10:00  ,与会人： 赵育、杜卓林、孙志祥、贺国锋,会议纪要：,1. 看下是否能加个日志，输出当前系统生效的加密引擎,2. ENCRYPT_ENGINE_TYPE 参数生效方式,Posted by heguofeng at 九月 14, 2024 10:20|
|---|
