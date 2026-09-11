Created by 谢昭贤, last modified on 十月 16, 2024

# YDBRD-31458【安全】openssl去除版本依赖

  


-   [YDBRD-31458【安全】openssl去除版本依赖](#YDBRD31458【安全】openssl去除版本依赖测试设计-YDBRD-31458【安全】openssl去除版本依赖)  
-   [](#YDBRD31458【安全】openssl去除版本依赖测试设计-)  
-   [1. 概述](#YDBRD31458【安全】openssl去除版本依赖测试设计-1.概述)  
    -   [1.1 相关文档](#YDBRD31458【安全】openssl去除版本依赖测试设计-1.1相关文档)  
    -   [1.2 特性说明](#YDBRD31458【安全】openssl去除版本依赖测试设计-1.2特性说明)  
-   [2. 需求分析](#YDBRD31458【安全】openssl去除版本依赖测试设计-2.需求分析)  
    -   [2.1 功能点分析](#YDBRD31458【安全】openssl去除版本依赖测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#YDBRD31458【安全】openssl去除版本依赖测试设计-2.2应用场景)  
        -   [2.2.1 客户现场](#YDBRD31458【安全】openssl去除版本依赖测试设计-2.2.1客户现场)  
    -   [2.3 规格约束](#YDBRD31458【安全】openssl去除版本依赖测试设计-2.3规格约束)  
-   [3. 详细测试设计](#YDBRD31458【安全】openssl去除版本依赖测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#YDBRD31458【安全】openssl去除版本依赖测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#YDBRD31458【安全】openssl去除版本依赖测试设计-3.2详细测试设计)  
        -   [3.2.1 DFX测试](#YDBRD31458【安全】openssl去除版本依赖测试设计-3.2.1DFX测试)  
        -   [3.2.2 等价类](#YDBRD31458【安全】openssl去除版本依赖测试设计-3.2.2等价类)  
-   [4. 测试用例](#YDBRD31458【安全】openssl去除版本依赖测试设计-4.测试用例)  
    -   [4.1 冒烟用例](#YDBRD31458【安全】openssl去除版本依赖测试设计-4.1冒烟用例)  
    -   [4.2 文本用例](#YDBRD31458【安全】openssl去除版本依赖测试设计-4.2文本用例)  
-   [5. 测试框架设计](#YDBRD31458【安全】openssl去除版本依赖测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#YDBRD31458【安全】openssl去除版本依赖测试设计-6.测试环境说明)  
-   [7. 工作量评估](#YDBRD31458【安全】openssl去除版本依赖测试设计-7.工作量评估)  


# 1. 概述

## 1.1 相关文档

SR:     [YDBRD-31458 【安全】openssl去除版本依赖](https://pingcode.yasdb.com/pjm/items/66bad1f366228b94707e33ea)  

开发设计文档：    [crypto-- check version](https://conf.yasdb.com/display/~shixin/crypto--+check+version)  

个人调研文档：    [4.2.0【个人调研】YDBRD-31458](https://conf.yasdb.com/pages/viewpage.action?pageId=163008429)  

调研文档：    [4.2.0【个人调研】YDBRD-31458](https://conf.yasdb.com/pages/viewpage.action?pageId=163008429)  

概要设计文档：

## 1.2 特性说明

**YashanDB对于openssl版本支持。**

1. 不论什么版本，都需要  **能够起库**
1.1.1及以上的，要  **全适配**1.1.1以下的，不适配的功能进行  **合理报错**

# 2. 需求分析

## 2.1 功能点分析

|  [libcrypto.so](http://libcrypto.so)    .1.1|openssl|1.1.1|加密|
|---|---|---|---|
|  [libssl.so](http://libssl.so)  |openssl|1.1.1|网络通信|


|版本|链接|支持性|
|:---|:---|---|
|3.0.0|  [https://openssl-library.org/source/old/3.0/index.html](https://openssl-library.org/source/old/3.0/index.html)  |全支持|
|1.1.1及以上|  [openssl-1.1.1.tar.gz](https://www.openssl.org/source/old/1.1.1/openssl-1.1.1.tar.gz)  |全支持|
|1.1.1-pre1|  [openssl-1.1.1-pre1.tar.gz](https://www.openssl.org/source/old/1.1.1/openssl-1.1.1-pre1.tar.gz)     |合理报错|
|1.1.0及以下|  [openssl-1.1.0.tar.gz](https://www.openssl.org/source/old/1.1.0/openssl-1.1.0.tar.gz)     |合理报错|


  


## 2.2 应用场景

### 2.2.1 客户现场

|版本|  
|
|---|---|
|3.0.7|![](https://pingcode.yasdb.com/atlas/files/public/67396e0fa1ad9a3311dc94f4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUNDRUFBQ0FBSUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM4OTQsImV4cCI6MTc4MjMyNDY5NH0.K3-gZEro2qjRV6sK3bzbPa8Ux1WWYNPpwRpzOaRv6pE)|
|3.1.1|![](https://pingcode.yasdb.com/atlas/files/public/67396e0f8970c2af4f521681/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUNDRUFBQ0FBSUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM4OTQsImV4cCI6MTc4MjMyNDY5NH0.K3-gZEro2qjRV6sK3bzbPa8Ux1WWYNPpwRpzOaRv6pE)|
|3.3.1|![](https://pingcode.yasdb.com/atlas/files/public/67396e0fa1ad9a3311dc94f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUNDRUFBQ0FBSUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTM4OTQsImV4cCI6MTc4MjMyNDY5NH0.K3-gZEro2qjRV6sK3bzbPa8Ux1WWYNPpwRpzOaRv6pE)|
|  
|  
|


## 2.3 规格约束

1） 不论什么版本，都需要  **能够起库**

2） 1.1.1及以上的，要  **全适配**

3） 1.1.1以下的，不适配的功能进行  **合理报错**

  


  


# 3. 详细测试设计

## 3.1 测试设计方法

1）使用等价类划分、边界值覆盖

**2）编写自动化代码，在用例执行过程中，能够动态替换openssl库**

## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT并发|否|  
|
|KT|否|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|是|  
|
|DFR故障|否|  
|
|HA高可用|否|  
|
|压力|否|  
|
|性能|否|  
|
|可维护性|否|  
|


### 3.2.2 等价类

|序|类别|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|1|功能校验|**yasboot起库**|-   [3.3](https://openssl-library.org/source/old/3.3)  
-   [3.2](https://openssl-library.org/source/old/3.2)  
-   [3.1](https://openssl-library.org/source/old/3.1)  
-   [3.0](https://openssl-library.org/source/old/3.0)  
-   [1.1.1](https://openssl-library.org/source/old/1.1.1)  
-   [1.1.0](https://openssl-library.org/source/old/1.1.0)  
-   [1.0.2](https://openssl-library.org/source/old/1.0.2)  
-   [1.0.1](https://openssl-library.org/source/old/1.0.1)  
-   [1.0.0](https://openssl-library.org/source/old/1.0.0)  
-   [0.9.x](https://openssl-library.org/source/old/0.9.x)  
|  
|  
|  
|
|2|  
|yasboot|TLS加密|  
|  
|  
|
|3|  
|登陆|口令加密,ukey验签|  [UKEY认证登录](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/C%E8%AF%AD%E8%A8%80%E7%B3%BB%E9%A9%B1%E5%8A%A8/C%E9%A9%B1%E5%8A%A8/C%E9%A9%B1%E5%8A%A8%E9%AB%98%E7%BA%A7%E5%8A%9F%E8%83%BD%E8%AF%B4%E6%98%8E/UKEY%E8%AE%A4%E8%AF%81%E7%99%BB%E5%BD%95.html)  ,  
,低版本，没有这些函数调用，会起库报错（nomount时，作参数检查）|  
|  
|
|4|  
|**SSL通信加密**|SSL_CERT_FILE    
  SSL_KEY_FILE    
  SSL_DH_PARAM_FILE    
  SSL_ENABLE,HA_SSL_ENABLE|show parameter ssl,SSL相关：    [SSL连接配置](https://doc.yashandb.com/yashandb/23.2/zh/%E6%95%B0%E6%8D%AE%E5%BA%93%E7%AE%A1%E7%90%86/%E5%9F%BA%E6%9C%AC%E6%95%B0%E6%8D%AE%E5%BA%93%E7%AE%A1%E7%90%86/SSL%E8%BF%9E%E6%8E%A5%E9%85%8D%E7%BD%AE.html)  ,  
,低版本，没有这些函数调用，会起库报错（作参数检查）|  
|  
|
|5|  
|**HASH密码**|PASSWORD_HASH_METHOD       
,PASSWORD_LOGON_MIN_VERSION|  [隐藏参数](https://doc.yashandb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%9A%90%E8%97%8F%E5%8F%82%E6%95%B0.html)  ,  
,  
,低版本，没有这些函数调用，会起库报错（作参数检查）|  
|  
|
|6|  
|**密码传输**|PASSWORD_CRYPTO_METHOD|低版本，没有这些函数调用，会起库报错（作参数检查）|  
|  
|
|7|  
|**表空间级的TDE（透明加密）技术**|CREATE TABLESPACE  ENCRYPT|  
|  
|  
|
|8|  
|CREATE USER|指定密文来创建密码|  
|  
|  
|
|9|  
|CREATE TABLE|列定义加密属性，支持AES128算法和SM4算法|  
|  
|  
|
|10|  
|ALTER TABLE|增加列字段时同时定义列的加密属性|  
|  
|  
|
|11|  
|BACKUP DATABASE|四种加密算法|  
|  
|  
|
|12|  
|BACKUP ARCHIVELOG|四种加密算法|  
|  
|  
|
|13|  
|**内置函数 **,  
,  
,**具体是哪些？**|  [CHAR_TO_LABEL](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CHAR_TO_LABEL)  ,  [CRYPT_HASH](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_HASH)  ,  [CRYPT_HMAC](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_HMAC)  ,  [CRYPT_KEY](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_KEY)  ,  [CRYPT_RANDOM](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_RANDOM)  ,  [CRYPT_SIGN](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_SIGN)  ,  [CRYPT_VERIFY](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_VERIFY)  ,  [ENCRYPT_AES128](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/ENCRYPT_AES128)  ,  [DECRYPT_AES128](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/DECRYPT_AES128)  ,  [CRYPT_ASYM_ENCRYPT](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_ASYM_ENCRYPT)  ,  [CRYPT_ASYM_DECRYPT](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_ASYM_DECRYPT)  ,  [CRYPT_ENCRYPT](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_ENCRYPT)  ,  [CRYPT_DECRYPT](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_DECRYPT)  ,  [CRYPT_SELFTEST](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/CRYPT_SELFTEST)  ,  [LABEL_TO_CHAR](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/LABEL_TO_CHAR)  ,  [SECURITY_CLEAR_CSP](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SECURITY_CLEAR_CSP)  ,  [SECURITY_MOD_STATUS](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SECURITY_MOD_STATUS)  ,  [SECURITY_MOD_VERSION](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/SECURITY_MOD_VERSION)  |  [安全函数security-function](https://doc.yashandb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E5%AE%89%E5%85%A8%E5%87%BD%E6%95%B0-security-function)  |  
|  
|
|14|  
|内置高级包|DBMS_CRYPTO|  
|  
|  
|
|15|  
|PL源码加密|yaswrap|  
|  
|  
|
|16|  
|  
|  
|  
|  
|  
|
|17|  
|YashanDB JDBC ？|SSL加密通信,TLCP加密通信,SM4密码加密算法|  
|  
|  
|
|18|  
|  
|  
|  
|  
|  
|
|19|文档校验|需求合入要放开文档,1.1.1  →  1.1.1及以上|doc/产品文档/安装和升级/安装部署/安装前准备/依赖项准备.md|  
|  
|  
|
|20|  
|  
|  
|  
|  
|  
|
|21|  
|库由某个版本的算法文件A启动，但实例没有A的能力,sm3，nomount的时候加载了(配置参数、版本)，,open的时候（文件、版本）,  
,库文件版本的能力和实例不一样，open的时候校验出错，回到nomount状态,  
,重新open|  
|  
|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


## 4.1 冒烟用例

```
1.
```

  


## 4.2 文本用例

文本用例：

[X_文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGVhMWFkOWEzMzExZGM5NGYxIiwicmVmX2lkIjoiNjczOTZlMGU1OTNmOTljOWZmMjM4MWFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODk0LCJleHAiOjE3ODI0MDAyOTR9.l_fGKdH1ANVGO8YqFhcZVxk6XX4Iz99L-sU89KtwOWA)

# 5. 测试框架设计

1） 自动化用例：

使用     [https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/install_test](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/install_test)     框架，编写用例

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

1）辅助工具：

Guider部署、执行、字符集配置脚本：    [https://git.yasdb.com/xiezhaoxian/scripts](https://git.yasdb.com/xiezhaoxian/scripts)  

2）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.104|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.114.2.el7.x86_64|50G|303G|HDD|


# 7. 工作量评估

工作量：天

计划测试完成时间：

  


## Attachments:

[X_文本用例模板.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGVhMWFkOWEzMzExZGM5NGYxIiwicmVmX2lkIjoiNjczOTZlMGU1OTNmOTljOWZmMjM4MWFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODk0LCJleHAiOjE3ODI0MDAyOTR9.l_fGKdH1ANVGO8YqFhcZVxk6XX4Iz99L-sU89KtwOWA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-22421.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGU4OTcwYzJhZjRmNTIxNjdlIiwicmVmX2lkIjoiNjczOTZlMGU1OTNmOTljOWZmMjM4MWFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODk0LCJleHAiOjE3ODI0MDAyOTR9.vqX2N5kFpjXvuYYT1IRH7PgLaMy4xwsU9NniWQBpbTM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[TESTCASE_YDBRD-22421.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlMGVhMWFkOWEzMzExZGM5NGYyIiwicmVmX2lkIjoiNjczOTZlMGU1OTNmOTljOWZmMjM4MWFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzODk0LCJleHAiOjE3ODI0MDAyOTR9.aFIzE2ZpZR9W9fzwQlozrTAm9qrRhXPXCNd-OaPOHSU)

 (text/csv)    


## Comments:

|  [](null)  ,9.26 转测,Posted by xiezhaoxian at 九月 19, 2024 15:27|
|---|
